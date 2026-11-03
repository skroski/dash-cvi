-- ==============================================================================
-- Migração: Evolução da Gestão de Filas Presenciais do C.V.I. - Centro Veterinário Integrado
-- Data: 2026-09-02
-- Descrição:
--   1. Adiciona referências a cliente/pet existente (cliente_id, pet_id) sem duplicação.
--   2. Adiciona motivo_resumido do atendimento.
--   3. Adiciona campos de auditoria (quem chamou, iniciou, finalizou, cancelou, ausentou).
--   4. Adiciona histórico de transferências de sala/fila preservando a data de chegada.
--   5. Atualiza RPCs adicionar_item_fila e alterar_status_fila de forma 100% retrocompatível.
--   6. Adiciona RPCs sala_obter_fila e sala_chamar_fila para suportar o chamador de consultório.
--   7. Atualiza RPC fila_tv_estado para fornecer histórico recente de chamadas.
-- ==============================================================================

-- 1. Novas colunas em public.fila_itens
alter table public.fila_itens
  add column if not exists cliente_id bigint references public.dados_cliente(id) on delete set null,
  add column if not exists pet_id text,
  add column if not exists motivo_resumido text,
  add column if not exists chamado_por uuid references auth.users(id),
  add column if not exists iniciado_por uuid references auth.users(id),
  add column if not exists finalizado_por uuid references auth.users(id),
  add column if not exists ausente_por uuid references auth.users(id),
  add column if not exists ausente_em timestamptz,
  add column if not exists cancelado_por uuid references auth.users(id),
  add column if not exists cancelado_em timestamptz,
  add column if not exists historico_transferencias jsonb not null default '[]'::jsonb;

create index if not exists fila_itens_cliente_id_idx on public.fila_itens(cliente_id);
create index if not exists fila_itens_created_at_idx on public.fila_itens(created_at desc);

-- 2. Atualizar adicionar_item_fila
drop function if exists public.adicionar_item_fila(uuid, text, text, text, text);
drop function if exists public.adicionar_item_fila(uuid, text, text, text, text, bigint, text, text, uuid);

create or replace function public.adicionar_item_fila(
  p_servico_id uuid,
  p_tutor_nome text,
  p_pet_nome text default null,
  p_veterinario_nome text default null,
  p_prioridade text default 'normal',
  p_cliente_id bigint default null,
  p_pet_id text default null,
  p_motivo_resumido text default null,
  p_sala_id uuid default null
) returns public.fila_itens language plpgsql security definer set search_path = '' as $$
declare
  v_prefixo text;
  v_numero integer;
  v_item public.fila_itens;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.ativo) then
    raise exception 'Não autorizado' using errcode = '42501';
  end if;

  if nullif(trim(p_tutor_nome), '') is null then
    raise exception 'Nome do tutor é obrigatório' using errcode = '22023';
  end if;

  if p_prioridade not in ('normal','prioridade','emergencia') then
    raise exception 'Prioridade inválida' using errcode = '22023';
  end if;

  select prefixo into v_prefixo from public.fila_servicos where id = p_servico_id and ativo;
  if v_prefixo is null then
    raise exception 'Serviço indisponível' using errcode = '22023';
  end if;

  -- Lock consultivo por prefixo para serializar geração atômica da senha
  perform pg_advisory_xact_lock(hashtext(v_prefixo));

  select coalesce(max(nullif(regexp_replace(i.senha, '\D', '', 'g'), '')::integer), 0) + 1 into v_numero
    from public.fila_itens i
    join public.fila_servicos s on s.id = i.servico_id
    where s.prefixo = v_prefixo;

  insert into public.fila_itens (
    senha,
    servico_id,
    sala_id,
    tutor_nome,
    pet_nome,
    veterinario_nome,
    prioridade,
    cliente_id,
    pet_id,
    motivo_resumido,
    criado_por
  ) values (
    v_prefixo || lpad(v_numero::text, 3, '0'),
    p_servico_id,
    p_sala_id,
    trim(p_tutor_nome),
    nullif(trim(p_pet_nome), ''),
    nullif(trim(p_veterinario_nome), ''),
    p_prioridade,
    p_cliente_id,
    nullif(trim(p_pet_id), ''),
    nullif(trim(p_motivo_resumido), ''),
    auth.uid()
  )
  returning * into v_item;

  return v_item;
end $$;

revoke all on function public.adicionar_item_fila(uuid,text,text,text,text,bigint,text,text,uuid) from public, anon;
grant execute on function public.adicionar_item_fila(uuid,text,text,text,text,bigint,text,text,uuid) to authenticated;

-- 3. Atualizar alterar_status_fila com suporte a auditoria e transferência
drop function if exists public.alterar_status_fila(uuid, text, uuid);
drop function if exists public.alterar_status_fila(uuid, text, uuid, uuid, text);

create or replace function public.alterar_status_fila(
  p_item_id uuid,
  p_acao text,
  p_sala_id uuid default null,
  p_novo_servico_id uuid default null,
  p_motivo text default null
)
returns public.fila_itens language plpgsql security definer set search_path = '' as $$
declare
  v_item public.fila_itens;
  v_proximo text;
  v_transf_entry jsonb;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.ativo) then
    raise exception 'Não autorizado' using errcode = '42501';
  end if;

  select * into v_item from public.fila_itens where id = p_item_id for update;
  if not found then
    raise exception 'Item da fila não encontrado' using errcode = 'P0002';
  end if;

  case p_acao
    when 'chamar' then
      v_proximo := 'chamado';
      v_item.chamado_em := now();
      v_item.chamado_por := auth.uid();
      if p_sala_id is not null then
        v_item.sala_id := p_sala_id;
      end if;

    when 'iniciar' then
      v_proximo := 'em_atendimento';
      v_item.iniciado_em := now();
      v_item.iniciado_por := auth.uid();
      if p_sala_id is not null then
        v_item.sala_id := p_sala_id;
      end if;

    when 'finalizar' then
      v_proximo := 'finalizado';
      v_item.finalizado_em := now();
      v_item.finalizado_por := auth.uid();

    when 'ausente' then
      v_proximo := 'ausente';
      v_item.ausente_em := now();
      v_item.ausente_por := auth.uid();

    when 'retornar' then
      v_proximo := 'aguardando';
      v_item.chamado_em := null;

    when 'cancelar' then
      v_proximo := 'cancelado';
      v_item.cancelado_em := now();
      v_item.cancelado_por := auth.uid();

    when 'transferir' then
      v_proximo := v_item.status;
      -- Registra evento de transferência preservando data original de chegada
      v_transf_entry := jsonb_build_object(
        'data', now(),
        'usuario_id', auth.uid(),
        'sala_origem', v_item.sala_id,
        'sala_destino', coalesce(p_sala_id, v_item.sala_id),
        'servico_origem', v_item.servico_id,
        'servico_destino', coalesce(p_novo_servico_id, v_item.servico_id),
        'motivo', nullif(trim(p_motivo), '')
      );
      v_item.historico_transferencias := coalesce(v_item.historico_transferencias, '[]'::jsonb) || v_transf_entry;
      if p_sala_id is not null then
        v_item.sala_id := p_sala_id;
      end if;
      if p_novo_servico_id is not null then
        v_item.servico_id := p_novo_servico_id;
      end if;

    else
      raise exception 'Ação de fila inválida' using errcode = '22023';
  end case;

  update public.fila_itens
  set
    status = v_proximo,
    sala_id = v_item.sala_id,
    servico_id = v_item.servico_id,
    chamado_em = v_item.chamado_em,
    chamado_por = v_item.chamado_por,
    iniciado_em = v_item.iniciado_em,
    iniciado_por = v_item.iniciado_por,
    finalizado_em = v_item.finalizado_em,
    finalizado_por = v_item.finalizado_por,
    ausente_em = v_item.ausente_em,
    ausente_por = v_item.ausente_por,
    cancelado_em = v_item.cancelado_em,
    cancelado_por = v_item.cancelado_por,
    historico_transferencias = v_item.historico_transferencias,
    updated_at = now()
  where id = p_item_id
  returning * into v_item;

  if p_acao = 'chamar' then
    insert into public.fila_chamadas(item_id, sala_id, chamado_por)
    values (p_item_id, v_item.sala_id, auth.uid());
  end if;

  return v_item;
end $$;

revoke all on function public.alterar_status_fila(uuid,text,uuid,uuid,text) from public, anon;
grant execute on function public.alterar_status_fila(uuid,text,uuid,uuid,text) to authenticated;

-- 4. Função para obter dados do chamador da sala (QueueRoomCallerPage)
create or replace function public.sala_obter_fila(p_sala_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_sala jsonb;
  v_salas jsonb;
  v_atual jsonb;
  v_proximos jsonb;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.ativo) then
    raise exception 'Não autorizado' using errcode = '42501';
  end if;

  -- Lista de salas ativas
  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'ativa', s.ativa) order by s.nome), '[]'::jsonb)
  into v_salas
  from public.fila_salas s
  where s.ativa;

  -- Sala solicitada ou primeira ativa
  if p_sala_id is not null then
    select jsonb_build_object('id', s.id, 'nome', s.nome, 'ativa', s.ativa)
    into v_sala
    from public.fila_salas s
    where s.id = p_sala_id;
  end if;

  -- Atendimento em andamento ou chamado na sala
  if p_sala_id is not null then
    select jsonb_build_object(
      'id', i.id,
      'ticket', i.senha,
      'tutorName', i.tutor_nome,
      'petName', i.pet_nome,
      'veterinarianName', i.veterinario_nome,
      'priority', i.prioridade,
      'status', i.status,
      'arrivedAt', i.chegada_em,
      'calledAt', i.chamado_em,
      'startedAt', i.iniciado_em,
      'roomId', i.sala_id,
      'roomName', s.nome,
      'serviceName', serv.nome
    )
    into v_atual
    from public.fila_itens i
    left join public.fila_salas s on s.id = i.sala_id
    left join public.fila_servicos serv on serv.id = i.servico_id
    where i.sala_id = p_sala_id and i.status in ('chamado', 'em_atendimento')
    order by case i.status when 'em_atendimento' then 0 else 1 end, i.chamado_em desc
    limit 1;
  end if;

  -- Próximos da fila (aguardando)
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'ticket', i.senha,
      'tutorName', i.tutor_nome,
      'petName', i.pet_nome,
      'veterinarianName', i.veterinario_nome,
      'priority', i.prioridade,
      'status', i.status,
      'arrivedAt', i.chegada_em,
      'calledAt', i.chamado_em,
      'startedAt', i.iniciado_em,
      'roomId', i.sala_id,
      'roomName', s.nome,
      'serviceName', serv.nome
    ) order by
      case i.prioridade when 'emergencia' then 0 when 'prioridade' then 1 else 2 end,
      i.chegada_em asc
  ), '[]'::jsonb)
  into v_proximos
  from public.fila_itens i
  left join public.fila_salas s on s.id = i.sala_id
  left join public.fila_servicos serv on serv.id = i.servico_id
  where i.status = 'aguardando' and (i.sala_id is null or i.sala_id = p_sala_id);

  return jsonb_build_object(
    'sala', v_sala,
    'salas', v_salas,
    'atual', v_atual,
    'proximos', v_proximos
  );
end $$;

revoke all on function public.sala_obter_fila(uuid) from public, anon;
grant execute on function public.sala_obter_fila(uuid) to authenticated;

-- 5. Função para chamar/interagir direto do chamador da sala
create or replace function public.sala_chamar_fila(
  p_sala_id uuid,
  p_item_id uuid default null,
  p_acao text default 'chamar'
)
returns public.fila_itens language plpgsql security definer set search_path = '' as $$
declare
  v_target_id uuid := p_item_id;
  v_item public.fila_itens;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.ativo) then
    raise exception 'Não autorizado' using errcode = '42501';
  end if;

  -- Se não foi passado item específico e a ação é chamar, pega o próximo aguardando
  if v_target_id is null and p_acao = 'chamar' then
    select i.id into v_target_id
    from public.fila_itens i
    where i.status = 'aguardando' and (i.sala_id is null or i.sala_id = p_sala_id)
    order by
      case i.prioridade when 'emergencia' then 0 when 'prioridade' then 1 else 2 end,
      i.chegada_em asc
    limit 1;

    if v_target_id is null then
      raise exception 'Nenhum paciente aguardando na fila no momento.' using errcode = 'P0002';
    end if;
  end if;

  return public.alterar_status_fila(v_target_id, p_acao, p_sala_id);
end $$;

revoke all on function public.sala_chamar_fila(uuid,uuid,text) from public, anon;
grant execute on function public.sala_chamar_fila(uuid,uuid,text) to authenticated;

-- 6. Atualização de fila_tv_estado para incluir histórico recente
drop function if exists public.fila_tv_estado();

create or replace function public.fila_tv_estado()
returns table(
  senha text,
  pet_nome text,
  veterinario_nome text,
  sala text,
  status text,
  chamado_em timestamptz
)
language sql stable security definer set search_path = '' as $$
  -- Chamados e em atendimento no topo, depois os aguardando
  select i.senha, i.pet_nome, i.veterinario_nome, s.nome as sala, i.status, i.chamado_em
  from public.fila_itens i
  left join public.fila_salas s on s.id = i.sala_id
  where i.status in ('chamado', 'em_atendimento', 'aguardando')
  order by
    case i.status
      when 'chamado' then 0
      when 'em_atendimento' then 1
      else 2
    end,
    case when i.status = 'chamado' then i.chamado_em else null end desc nulls last,
    i.chegada_em asc
  limit 8;
$$;
grant execute on function public.fila_tv_estado() to anon, authenticated;
