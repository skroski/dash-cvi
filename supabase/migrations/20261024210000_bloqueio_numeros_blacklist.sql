-- Migração: Bloqueio Permanente de Números (Blacklist) e Proteção Anti-Loop
-- Impede que números institucionais, operadoras (TIM, Claro, Vivo) ou bots entrem em loop com o Balthazar.

-- 1. Tabela de bloqueios permanentes
create table if not exists public.atendimento_bloqueios (
  id uuid primary key default gen_random_uuid(),
  telefone text not null unique,
  session_id text not null unique,
  motivo text not null default 'operadora_ou_spam',
  observacao text,
  bloqueado_por uuid references auth.users(id) on delete set null,
  bloqueado_em timestamptz not null default now(),
  ativo boolean not null default true
);

create index if not exists atendimento_bloqueios_telefone_idx
  on public.atendimento_bloqueios(telefone)
  where ativo = true;

create index if not exists atendimento_bloqueios_session_idx
  on public.atendimento_bloqueios(session_id)
  where ativo = true;

-- Habilitar RLS
alter table public.atendimento_bloqueios enable row level security;

-- Política de leitura: usuários autenticados da equipe podem ver a lista
drop policy if exists "atendimento_bloqueios_select" on public.atendimento_bloqueios;
create policy "atendimento_bloqueios_select"
  on public.atendimento_bloqueios
  for select
  to authenticated
  using (true);

-- 2. RPC para listar números bloqueados (ordenados pelos mais recentes)
create or replace function public.obter_bloqueios_atendimento()
returns table(
  id uuid,
  telefone text,
  session_id text,
  motivo text,
  observacao text,
  bloqueado_em timestamptz,
  ativo boolean
)
language sql
security definer
set search_path = ''
as $$
  select b.id, b.telefone, b.session_id, b.motivo, b.observacao, b.bloqueado_em, b.ativo
  from public.atendimento_bloqueios b
  where b.ativo = true
  order by b.bloqueado_em desc;
$$;

revoke all on function public.obter_bloqueios_atendimento() from public, anon;
grant execute on function public.obter_bloqueios_atendimento() to authenticated, service_role;

-- 3. RPC para bloquear número/telefone e limpar filas imediatamente
create or replace function public.bloquear_telefone_atendimento(
  p_telefone text,
  p_motivo text default 'operadora_ou_spam',
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_digits text;
  v_session_id text;
  v_user_id uuid;
begin
  -- Obter usuário atual (se autenticado)
  v_user_id := auth.uid();

  -- Extrair apenas dígitos
  v_digits := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  if length(v_digits) < 8 then
    raise exception 'Telefone inválido para bloqueio';
  end if;

  -- Se não incluir código do país (ex: 2120181083 com 10 ou 11 dígitos), adiciona o DDI 55
  if length(v_digits) in (10, 11) and not (v_digits like '55%') then
    v_digits := '55' || v_digits;
  end if;

  v_session_id := v_digits || '@s.whatsapp.net';

  -- 1. Inserir ou atualizar na tabela de bloqueios
  insert into public.atendimento_bloqueios (
    telefone, session_id, motivo, observacao, bloqueado_por, bloqueado_em, ativo
  ) values (
    v_digits, v_session_id, coalesce(nullif(trim(p_motivo), ''), 'operadora_ou_spam'),
    nullif(trim(p_observacao), ''), v_user_id, now(), true
  ) on conflict (telefone) do update set
    session_id = excluded.session_id,
    motivo = excluded.motivo,
    observacao = coalesce(excluded.observacao, public.atendimento_bloqueios.observacao),
    bloqueado_por = coalesce(excluded.bloqueado_por, public.atendimento_bloqueios.bloqueado_por),
    bloqueado_em = now(),
    ativo = true;

  -- 2. Garantir registro na tabela de conversas
  insert into public.atendimento_conversas (session_id, atualizado_em)
  values (v_session_id, now())
  on conflict (session_id) do update set atualizado_em = now();

  -- 3. Aplicar pausa longa (10 anos) na tabela atendimento_pausas para compatibilidade com queries existentes
  insert into public.atendimento_pausas (
    session_id, motivo, criado_por, iniciado_em, expira_em, encerrado_em
  ) values (
    v_session_id, 'bloqueio_blacklist', v_user_id, now(), now() + interval '10 years', null
  ) on conflict (session_id) where encerrado_em is null do update set
    motivo = 'bloqueio_blacklist',
    criado_por = coalesce(excluded.criado_por, public.atendimento_pausas.criado_por),
    iniciado_em = now(),
    expira_em = now() + interval '10 years';

  -- 4. Cancelar imediatamente mensagens pendentes na outbox para este número
  update public.atendimento_outbox
  set estado = 'failed',
      ultimo_erro_codigo = 'bloqueado_blacklist'
  where session_id = v_session_id
    and estado in ('pending', 'processing');

  -- 5. Colocar lote em estado idle
  update public.atendimento_lotes
  set estado = 'idle',
      proximo_processamento_em = now() + interval '100 years',
      updated_at = now()
  where session_id = v_session_id;

  -- 6. Marcar mensagens pendentes como processadas para não reativar
  update public.atendimento_mensagens
  set processado_em = now()
  where session_id = v_session_id
    and processado_em is null;

  return jsonb_build_object(
    'ok', true,
    'telefone', v_digits,
    'session_id', v_session_id
  );
end;
$$;

revoke all on function public.bloquear_telefone_atendimento(text, text, text) from public, anon;
grant execute on function public.bloquear_telefone_atendimento(text, text, text) to authenticated, service_role;

-- 4. RPC para desbloquear número
create or replace function public.desbloquear_telefone_atendimento(p_telefone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_digits text;
  v_session_id text;
begin
  v_digits := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  if length(v_digits) in (10, 11) and not (v_digits like '55%') then
    v_digits := '55' || v_digits;
  end if;
  v_session_id := v_digits || '@s.whatsapp.net';

  -- Desativar bloqueio
  update public.atendimento_bloqueios
  set ativo = false
  where telefone = v_digits or session_id = v_session_id;

  -- Encerrar pausa ativa
  update public.atendimento_pausas
  set encerrado_em = now()
  where session_id = v_session_id
    and encerrado_em is null;

  return jsonb_build_object('ok', true, 'telefone', v_digits);
end;
$$;

revoke all on function public.desbloquear_telefone_atendimento(text) from public, anon;
grant execute on function public.desbloquear_telefone_atendimento(text) to authenticated, service_role;

-- 5. Inserir imediatamente o número da TIM reportado pelo usuário (552120181083) e limpar qualquer mensagem
select public.bloquear_telefone_atendimento(
  '552120181083',
  'operadora_tim',
  'Número da operadora TIM (URA/Robô) bloqueado para interromper loop infinito com o assistente Balthazar'
);
