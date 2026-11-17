-- ============================================================================
-- MÓDULO: COPILOTO OPERACIONAL LATERAL RETRÁTIL (GPT-5.4 NANO)
-- ============================================================================
-- Cria:
--   1. Tabela public.copiloto_auditoria para registro de perguntas/respostas,
--      modelo utilizado ('gpt-5.4-nano'), rota de origem e tempo de resposta,
--      com RLS por usuário autenticado.
--   2. RPC public.obter_contexto_copiloto_operacional() que retorna em 1 único
--      round-trip o resumo vivo da operação da clínica (clientes, conversas,
--      agenda, lembretes, fila presencial, pipelines CRM, satisfação e prompt)
--      sem tráfego pesado de linhas (zero desperdício de Egress).
-- ============================================================================

begin;

-- 1. Tabela de Auditoria e Histórico do Copiloto Operacional
create table if not exists public.copiloto_auditoria (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  rota_atual text not null default '/dashboard',
  pergunta text not null check (char_length(pergunta) <= 2000),
  resposta text not null,
  modelo text not null default 'gpt-5.4-nano',
  origem_motor text not null default 'openai_gpt_5_4_nano'
    check (origem_motor in ('openai_gpt_5_4_nano', 'copiloto_deterministico')),
  tempo_processamento_ms integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists copiloto_auditoria_usuario_created_idx
  on public.copiloto_auditoria (usuario_id, created_at desc);

comment on table public.copiloto_auditoria is
  'Histórico e auditoria das interações com o Copiloto Operacional Lateral (modelo único gpt-5.4-nano).';

alter table public.copiloto_auditoria enable row level security;

drop policy if exists "copiloto_auditoria_select_own" on public.copiloto_auditoria;
create policy "copiloto_auditoria_select_own"
  on public.copiloto_auditoria
  for select
  to authenticated
  using ((select auth.uid()) = usuario_id);

drop policy if exists "copiloto_auditoria_insert_own" on public.copiloto_auditoria;
create policy "copiloto_auditoria_insert_own"
  on public.copiloto_auditoria
  for insert
  to authenticated
  with check ((select auth.uid()) = usuario_id);

drop policy if exists "copiloto_auditoria_delete_own" on public.copiloto_auditoria;
create policy "copiloto_auditoria_delete_own"
  on public.copiloto_auditoria
  for delete
  to authenticated
  using ((select auth.uid()) = usuario_id);

-- 2. RPC de Snapshot Operacional em Tempo Real (1 round-trip, seguro e tolerante a esquemas parciais)
create or replace function public.obter_contexto_copiloto_operacional()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_autorizado boolean := false;
  v_hoje_inicio timestamptz := date_trunc('day', now());
  v_mes_inicio timestamptz := date_trunc('month', now());

  -- Empresa / Configuração
  v_empresa jsonb := jsonb_build_object(
    'nome_empresa', 'Clínica Veterinária',
    'nome_assistente', 'Assistente Virtual',
    'telefone_contato', '',
    'endereco', '',
    'fuso_horario', 'America/Sao_Paulo',
    'planos_aceitos', '[]'::jsonb
  );

  -- Clientes
  v_total_clientes bigint := 0;
  v_total_pets bigint := 0;
  v_novos_clientes_mes bigint := 0;
  v_ultimos_clientes jsonb := '[]'::jsonb;

  -- Atendimento / Conversas
  v_conversas_abertas bigint := 0;
  v_conversas_hoje bigint := 0;
  v_pausadas_humano bigint := 0;
  v_atendentes_ativos bigint := 0;

  -- Agenda
  v_agendamentos_hoje bigint := 0;
  v_agendamentos_7d bigint := 0;
  v_especialidades_ativas jsonb := '[]'::jsonb;
  v_profissionais_ativos jsonb := '[]'::jsonb;
  v_proximos_agendamentos jsonb := '[]'::jsonb;

  -- Lembretes
  v_lembretes_agendados bigint := 0;
  v_lembretes_enviados_hoje bigint := 0;
  v_lembretes_confirmados bigint := 0;
  v_lembretes_cancelados bigint := 0;

  -- Pipelines CRM
  v_total_pipelines bigint := 0;
  v_total_cards bigint := 0;
  v_cards_urgentes bigint := 0;
  v_valor_aberto numeric := 0;

  -- Fila Presencial
  v_fila_aguardando bigint := 0;
  v_fila_em_atendimento bigint := 0;
  v_fila_atendidos_hoje bigint := 0;

  -- Meu Prompt
  v_prompt_versao integer := 0;
  v_prompt_regras_ativas bigint := 0;
  v_prompt_total_regras bigint := 0;

  -- Satisfação
  v_satisfacao_total bigint := 0;
  v_satisfacao_media numeric := 0;
begin
  -- Verifica autenticação
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '42501';
  end if;

  if to_regclass('public.profiles') is not null then
    begin
      select exists (
        select 1 from public.profiles
        where id = v_uid
          and coalesce(ativo, true) = true
          and papel in ('admin', 'lider', 'atendente', 'veterinario')
      ) into v_autorizado;
    exception when others then
      v_autorizado := true;
    end;
  else
    v_autorizado := true;
  end if;

  if not v_autorizado then
    raise exception 'Acesso restrito à equipe da clínica' using errcode = '42501';
  end if;

  -- 2.1 Dados da Empresa (atendimento_config)
  if to_regclass('public.atendimento_config') is not null then
    begin
      select jsonb_build_object(
        'nome_empresa', coalesce(nome_empresa, 'Clínica Veterinária'),
        'nome_assistente', coalesce(nome_assistente, 'Assistente Virtual'),
        'telefone_contato', coalesce(telefone_contato, ''),
        'endereco', coalesce(endereco, ''),
        'fuso_horario', coalesce(fuso_horario, 'America/Sao_Paulo'),
        'planos_aceitos', coalesce(to_jsonb(planos_aceitos), '[]'::jsonb)
      )
      into v_empresa
      from public.atendimento_config
      limit 1;
    exception when others then
      null;
    end;
  end if;

  -- 2.2 Clientes e Pets (dados_cliente)
  if to_regclass('public.dados_cliente') is not null then
    begin
      select
        count(*),
        count(*) filter (where nome_pet is not null and btrim(nome_pet) <> ''),
        count(*) filter (where created_at >= v_mes_inicio)
      into v_total_clientes, v_total_pets, v_novos_clientes_mes
      from public.dados_cliente;

      select coalesce(jsonb_agg(row_to_json(c)), '[]'::jsonb)
      into v_ultimos_clientes
      from (
        select
          coalesce(nome, 'Cliente sem nome') as nome,
          coalesce(nome_pet, '') as nome_pet,
          created_at
        from public.dados_cliente
        order by created_at desc nulls last
        limit 5
      ) c;
    exception when others then
      null;
    end;
  end if;

  -- 2.3 Atendimento e Conversas (atendimentos / atendentes)
  if to_regclass('public.atendimentos') is not null then
    begin
      select
        count(*) filter (where status in ('aberto', 'em_atendimento', 'aguardando')),
        count(*) filter (where coalesce(updated_at, created_at) >= v_hoje_inicio),
        count(*) filter (where status = 'em_atendimento')
      into v_conversas_abertas, v_conversas_hoje, v_pausadas_humano
      from public.atendimentos;
    exception when others then
      null;
    end;
  end if;

  if to_regclass('public.atendentes') is not null then
    begin
      select count(*) filter (where coalesce(ativo, true) = true)
      into v_atendentes_ativos
      from public.atendentes;
    exception when others then
      null;
    end;
  end if;

  -- 2.4 Agenda e Especialidades (agenda_eventos / agenda_agendamentos / agenda_especialidades / agenda_profissionais)
  if to_regclass('public.agenda_especialidades') is not null then
    begin
      select coalesce(jsonb_agg(nome order by nome), '[]'::jsonb)
      into v_especialidades_ativas
      from public.agenda_especialidades
      where coalesce(ativo, true) = true;
    exception when others then
      null;
    end;
  end if;

  if to_regclass('public.agenda_profissionais') is not null then
    begin
      select coalesce(jsonb_agg(nome order by nome), '[]'::jsonb)
      into v_profissionais_ativos
      from public.agenda_profissionais
      where coalesce(ativo, true) = true;
    exception when others then
      null;
    end;
  end if;

  if to_regclass('public.agenda_agendamentos') is not null then
    begin
      select
        count(*) filter (
          where inicio >= v_hoje_inicio
            and inicio < v_hoje_inicio + interval '1 day'
            and coalesce(status, 'confirmado') <> 'cancelado'
        ),
        count(*) filter (
          where inicio >= v_hoje_inicio
            and inicio < v_hoje_inicio + interval '7 days'
            and coalesce(status, 'confirmado') <> 'cancelado'
        )
      into v_agendamentos_hoje, v_agendamentos_7d
      from public.agenda_agendamentos;

      select coalesce(jsonb_agg(row_to_json(a)), '[]'::jsonb)
      into v_proximos_agendamentos
      from (
        select
          coalesce(titulo, servico_nome, 'Consulta') as titulo,
          coalesce(cliente_nome, '') as cliente_nome,
          coalesce(pet_nome, '') as pet_nome,
          inicio
        from public.agenda_agendamentos
        where inicio >= now() - interval '2 hours'
          and coalesce(status, 'confirmado') <> 'cancelado'
        order by inicio asc
        limit 5
      ) a;
    exception when others then
      null;
    end;
  end if;

  -- 2.5 Lembretes (lembretes_envios / lembretes)
  if to_regclass('public.lembretes_envios') is not null then
    begin
      select
        count(*) filter (where upper(coalesce(status, '')) in ('AGENDADO', 'PENDENTE', 'FILA')),
        count(*) filter (where enviado_em >= v_hoje_inicio or created_at >= v_hoje_inicio),
        count(*) filter (where upper(coalesce(status, '')) = 'CONFIRMADO'),
        count(*) filter (where upper(coalesce(status, '')) = 'CANCELADO')
      into v_lembretes_agendados, v_lembretes_enviados_hoje, v_lembretes_confirmados, v_lembretes_cancelados
      from public.lembretes_envios;
    exception when others then
      null;
    end;
  end if;

  -- 2.6 Pipelines CRM Kanban (crm_pipelines / crm_pipeline_cards)
  if to_regclass('public.crm_pipelines') is not null and to_regclass('public.crm_pipeline_cards') is not null then
    begin
      select count(*) filter (where ativo = true)
      into v_total_pipelines
      from public.crm_pipelines;

      select
        count(*),
        count(*) filter (where prioridade in ('alta', 'urgente')),
        coalesce(sum(valor_estimado), 0)
      into v_total_cards, v_cards_urgentes, v_valor_aberto
      from public.crm_pipeline_cards;
    exception when others then
      null;
    end;
  end if;

  -- 2.7 Fila Presencial (fila_senhas)
  if to_regclass('public.fila_senhas') is not null then
    begin
      select
        count(*) filter (where status in ('aguardando', 'triagem', 'chamado') and created_at >= v_hoje_inicio),
        count(*) filter (where status = 'em_atendimento' and created_at >= v_hoje_inicio),
        count(*) filter (where status in ('finalizado', 'concluido') and created_at >= v_hoje_inicio)
      into v_fila_aguardando, v_fila_em_atendimento, v_fila_atendidos_hoje
      from public.fila_senhas;
    exception when others then
      null;
    end;
  end if;

  -- 2.8 Meu Prompt (meu_prompt_versoes / prompt_regras)
  if to_regclass('public.meu_prompt_versoes') is not null then
    begin
      select coalesce(max(versao), 0)
      into v_prompt_versao
      from public.meu_prompt_versoes;
    exception when others then
      null;
    end;
  end if;

  if to_regclass('public.prompt_regras') is not null then
    begin
      select
        count(*) filter (where ativa = true),
        count(*)
      into v_prompt_regras_ativas, v_prompt_total_regras
      from public.prompt_regras;
    exception when others then
      null;
    end;
  end if;

  -- 2.9 Pesquisas de Satisfação (pesquisas_satisfacao)
  if to_regclass('public.pesquisas_satisfacao') is not null then
    begin
      select
        count(*),
        coalesce(round(avg(nota)::numeric, 2), 0)
      into v_satisfacao_total, v_satisfacao_media
      from public.pesquisas_satisfacao
      where nota is not null;
    exception when others then
      null;
    end;
  end if;

  return jsonb_build_object(
    'atualizado_em', now(),
    'modelo_copiloto', 'gpt-5.4-nano',
    'empresa', coalesce(v_empresa, '{}'::jsonb),
    'clientes', jsonb_build_object(
      'total_clientes', v_total_clientes,
      'total_pets', v_total_pets,
      'novos_clientes_mes', v_novos_clientes_mes,
      'ultimos_clientes', v_ultimos_clientes
    ),
    'atendimento', jsonb_build_object(
      'conversas_abertas', v_conversas_abertas,
      'conversas_hoje', v_conversas_hoje,
      'pausadas_humano', v_pausadas_humano,
      'atendentes_ativos', v_atendentes_ativos
    ),
    'agenda', jsonb_build_object(
      'agendamentos_hoje', v_agendamentos_hoje,
      'agendamentos_proximos_7d', v_agendamentos_7d,
      'especialidades_ativas', v_especialidades_ativas,
      'profissionais_ativos', v_profissionais_ativos,
      'proximos_agendamentos', v_proximos_agendamentos
    ),
    'lembretes', jsonb_build_object(
      'agendados', v_lembretes_agendados,
      'enviados_hoje', v_lembretes_enviados_hoje,
      'confirmados', v_lembretes_confirmados,
      'cancelados', v_lembretes_cancelados
    ),
    'pipelines', jsonb_build_object(
      'total_pipelines', v_total_pipelines,
      'total_cards', v_total_cards,
      'cards_urgentes', v_cards_urgentes,
      'valor_aberto', v_valor_aberto
    ),
    'fila_presencial', jsonb_build_object(
      'aguardando', v_fila_aguardando,
      'em_atendimento', v_fila_em_atendimento,
      'atendidos_hoje', v_fila_atendidos_hoje
    ),
    'prompt_ia', jsonb_build_object(
      'versao_ativa', v_prompt_versao,
      'regras_ativas', v_prompt_regras_ativas,
      'total_regras', v_prompt_total_regras
    ),
    'satisfacao', jsonb_build_object(
      'total_avaliacoes', v_satisfacao_total,
      'media_nota', v_satisfacao_media
    )
  );
end;
$$;

revoke all on function public.obter_contexto_copiloto_operacional() from public;
grant execute on function public.obter_contexto_copiloto_operacional() to authenticated;

commit;
