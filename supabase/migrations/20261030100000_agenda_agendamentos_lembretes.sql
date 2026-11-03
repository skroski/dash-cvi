-- Ponte agenda -> lembretes.
--
-- Todo agendamento feito pelo assistente (public.agenda_agendamentos) passa a
-- criar, remarcar e cancelar sozinho o lembrete correspondente na fila do
-- módulo de lembretes (public.lembrete_envios), sem planilha, importação ou
-- cadastro manual. A escolha da regra (vacinação, consulta...) e o horário do
-- envio continuam sendo do módulo de lembretes (gatilho lembrete_envios_preparar).
--
-- Segurança operacional:
--   * Nada é enviado por esta migração. O envio automático segue controlado pela
--     chave geral lembrete_ajustes.envio_automatico (nasce desligada) e pelo
--     agendador (pg_cron) que o dono liga conscientemente.
--   * O módulo de lembretes é opcional: sem as tabelas dele, a ponte não faz nada.
--   * Só agendamentos do assistente entram aqui. Cancelar ou mover o evento direto
--     no Google Agenda NÃO chega ao lembrete; use o painel (docs/publicar-agenda-e-lembretes.md).

-- ---------------------------------------------------------------------------
-- 1. Sincronização agendamento -> lembrete
-- ---------------------------------------------------------------------------

create or replace function public.agenda_agendamento_sincronizar_lembrete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chave text := 'agenda:' || new.id::text;
  v_fuso text := 'America/Sao_Paulo';
  v_local timestamp;
  v_servico_id bigint;
  v_envio_id bigint;
  v_envio_status text;
  v_mensagem_id bigint;
  v_linhas integer;
begin
  -- O módulo de lembretes é opcional.
  if to_regclass('public.lembrete_envios') is null
     or to_regclass('public.lembrete_servicos') is null then
    return null;
  end if;

  select e.id, e.status, e.mensagem_id
  into v_envio_id, v_envio_status, v_mensagem_id
  from public.lembrete_envios e
  where e.agendamento_chave = v_chave
  order by e.id desc
  limit 1
  for update;

  -- Agendamento cancelado (ou remarcado para outro registro): o lembrete que
  -- ainda não saiu é cancelado. O que já foi enviado fica como histórico.
  if new.status <> 'confirmado' then
    if v_envio_id is not null and v_envio_status in ('pendente', 'falha') then
      update public.lembrete_envios
      set status = 'cancelado', status_agendamento = 'CANCELADO', erro = null
      where id = v_envio_id;
      -- O gatilho de revisão da fila não roda dentro de outro gatilho; a revisão
      -- da mensagem já planejada é feita aqui.
      if v_mensagem_id is not null then
        perform public.lembrete_revisar_mensagem(v_mensagem_id);
      end if;
    end if;
    return null;
  end if;

  if to_regclass('public.atendimento_config') is not null then
    select coalesce(nullif(btrim(c.fuso_horario), ''), v_fuso) into v_fuso
    from public.atendimento_config c
    where c.singleton
    limit 1;
    v_fuso := coalesce(v_fuso, 'America/Sao_Paulo');
  end if;
  v_local := new.inicio at time zone v_fuso;

  -- Já existe lembrete deste agendamento: só acompanha a nova data/hora.
  -- Lembrete cancelado à mão no painel continua cancelado.
  if v_envio_id is not null then
    if v_envio_status <> 'cancelado' then
      update public.lembrete_envios
      set data_agendada = v_local::date,
          horario_agendado = v_local::time,
          status_agendamento = 'CONFIRMADO'
      where id = v_envio_id
        and (data_agendada is distinct from v_local::date
             or horario_agendado is distinct from v_local::time);
      get diagnostics v_linhas = row_count;
      -- A mensagem já planejada é refeita (ou cancelada, se não sobrar atendimento).
      if v_linhas > 0 and v_mensagem_id is not null then
        perform public.lembrete_revisar_mensagem(v_mensagem_id);
      end if;
    end if;
    return null;
  end if;

  -- Atendimento no passado ou sem telefone utilizável: não há o que lembrar.
  if new.inicio <= now()
     or length(public.lembrete_telefone_chave(new.telefone)) < 10 then
    return null;
  end if;

  -- Categoria do lembrete: pelo nome ou chave do tipo de agenda; depois pelos
  -- outros nomes (aliases) dele. Ex.: o tipo "Vacinas" cai na categoria "Vacina".
  -- Sem correspondência, o lembrete segue com o nome do tipo e a regra geral.
  select s.id into v_servico_id
  from public.lembrete_servicos s
  join lateral (
    select min(c.prioridade) as prioridade
    from (
      select 0 as prioridade, public.lembrete_normalizar(n) as nome
      from unnest(array[new.tipo_nome, new.tipo_chave]) as n
      union all
      select 1, public.lembrete_normalizar(a)
      from public.agenda_especialidades e, unnest(e.aliases) as a
      where e.chave = new.tipo_chave
    ) c
    where c.nome = s.nome_normalizado
  ) m on m.prioridade is not null
  where s.ativo
  order by m.prioridade, s.ordem, s.id
  limit 1;

  -- configuracao_id e programado_para ficam nulos de propósito: o gatilho
  -- lembrete_envios_preparar escolhe a regra e calcula o horário do envio.
  insert into public.lembrete_envios (
    configuracao_nome, agendamento_chave, data_agendada, horario_agendado,
    servico, servico_id, nome_tutor, nome_pet, telefone,
    status, status_agendamento, origem
  ) values (
    '', v_chave, v_local::date, v_local::time,
    new.tipo_nome, v_servico_id, coalesce(btrim(new.tutor_nome), ''), nullif(btrim(new.pet_nome), ''), new.telefone,
    'pendente', 'CONFIRMADO', 'integracao'
  );
  return null;
end;
$$;

revoke all on function public.agenda_agendamento_sincronizar_lembrete() from public, anon, authenticated;

drop trigger if exists agenda_agendamentos_lembrete on public.agenda_agendamentos;
create trigger agenda_agendamentos_lembrete
after insert or update of status, inicio on public.agenda_agendamentos
for each row execute function public.agenda_agendamento_sincronizar_lembrete();

comment on function public.agenda_agendamento_sincronizar_lembrete() is
  'Mantém em public.lembrete_envios (origem integracao, chave agenda:<id>) o lembrete de cada agendamento do assistente: cria, acompanha remarcação e cancela.';

-- ---------------------------------------------------------------------------
-- 2. Agendamentos futuros que já existiam antes da ponte
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.lembrete_envios') is not null
     and to_regclass('public.lembrete_servicos') is not null then
    -- "update ... set status = status" dispara o gatilho, que cria o lembrete que falta.
    update public.agenda_agendamentos
    set status = status
    where status = 'confirmado' and inicio > now();
  end if;
end;
$$;
