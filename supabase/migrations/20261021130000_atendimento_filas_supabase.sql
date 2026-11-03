-- Estado transacional do atendimento WhatsApp.
-- Substitui Redis (pausa/debounce), Wait e loops de envio do n8n.

create table if not exists public.atendimento_eventos (
  id uuid primary key default gen_random_uuid(),
  provedor text not null default 'uazapi',
  evento_externo_id text not null,
  tipo text not null,
  session_id text,
  mensagem_externa_id text,
  corpo_hash text not null check (corpo_hash ~ '^[a-f0-9]{64}$'),
  recebido_em timestamptz not null default now(),
  processado_em timestamptz,
  status text not null default 'recebido' check (status in ('recebido', 'enfileirado', 'ignorado', 'falhou')),
  unique (provedor, evento_externo_id)
);

create index if not exists atendimento_eventos_session_idx
  on public.atendimento_eventos(session_id, recebido_em desc);

create table if not exists public.atendimento_conversas (
  session_id text primary key,
  nome_contato text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  ultima_mensagem_em timestamptz,
  ultima_resposta_bot_em timestamptz
);

create table if not exists public.atendimento_pausas (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.atendimento_conversas(session_id) on delete cascade,
  motivo text not null default 'atendimento_humano',
  criado_por uuid references auth.users(id) on delete set null,
  iniciado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  encerrado_em timestamptz,
  check (expira_em > iniciado_em)
);

create unique index if not exists atendimento_pausas_ativa_session_uidx
  on public.atendimento_pausas(session_id)
  where encerrado_em is null;
create index if not exists atendimento_pausas_expira_idx
  on public.atendimento_pausas(expira_em)
  where encerrado_em is null;

create table if not exists public.atendimento_mensagens (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references public.atendimento_eventos(id) on delete set null,
  session_id text not null references public.atendimento_conversas(session_id) on delete cascade,
  mensagem_externa_id text not null unique,
  direcao text not null check (direcao in ('entrada', 'saida_humana', 'saida_bot')),
  tipo text not null default 'texto',
  conteudo text,
  media_storage_path text,
  ocorrido_em timestamptz not null,
  recebido_em timestamptz not null default now(),
  processado_em timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists atendimento_mensagens_lote_idx
  on public.atendimento_mensagens(session_id, processado_em, recebido_em);

create table if not exists public.atendimento_lotes (
  session_id text primary key references public.atendimento_conversas(session_id) on delete cascade,
  estado text not null default 'pending' check (estado in ('pending', 'processing', 'idle')),
  proximo_processamento_em timestamptz not null,
  claimed_at timestamptz,
  claim_token uuid,
  updated_at timestamptz not null default now()
);

create index if not exists atendimento_lotes_pendentes_idx
  on public.atendimento_lotes(proximo_processamento_em)
  where estado = 'pending';

create table if not exists public.atendimento_outbox (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.atendimento_conversas(session_id) on delete cascade,
  dedupe_key text not null unique,
  destino text not null,
  tipo text not null default 'texto',
  conteudo text not null,
  estado text not null default 'pending' check (estado in ('pending', 'processing', 'sent', 'failed')),
  tentativas smallint not null default 0 check (tentativas between 0 and 10),
  proxima_tentativa_em timestamptz not null default now(),
  provider_message_id text,
  ultimo_erro_codigo text,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz
);

create index if not exists atendimento_outbox_pendente_idx
  on public.atendimento_outbox(proxima_tentativa_em, criado_em)
  where estado = 'pending';

create table if not exists public.atendimento_erros (
  id bigint generated always as identity primary key,
  funcao text not null,
  evento_id uuid references public.atendimento_eventos(id) on delete set null,
  session_id text,
  codigo text not null,
  detalhe_seguro text,
  created_at timestamptz not null default now()
);

create index if not exists atendimento_erros_created_idx
  on public.atendimento_erros(created_at desc);

create table if not exists public.atendimento_ia_uso (
  id bigint generated always as identity primary key,
  session_id text not null,
  mensagem_id uuid references public.atendimento_mensagens(id) on delete set null,
  modelo text not null,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  created_at timestamptz not null default now()
);

-- RLS sem policy: o histórico operacional é manipulado exclusivamente pelas
-- Edge Functions usando service_role; o painel continua lendo as tabelas de
-- chat já existentes até a troca controlada.
alter table public.atendimento_eventos enable row level security;
alter table public.atendimento_conversas enable row level security;
alter table public.atendimento_pausas enable row level security;
alter table public.atendimento_mensagens enable row level security;
alter table public.atendimento_lotes enable row level security;
alter table public.atendimento_outbox enable row level security;
alter table public.atendimento_erros enable row level security;
alter table public.atendimento_ia_uso enable row level security;

revoke all on public.atendimento_eventos, public.atendimento_conversas,
  public.atendimento_pausas, public.atendimento_mensagens, public.atendimento_lotes,
  public.atendimento_outbox, public.atendimento_erros, public.atendimento_ia_uso
from anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs de fila. Cada conversa tem um único lote em processamento: mensagens
-- novas durante a geração da resposta ficam no próximo lote, nunca se perdem.
-- ---------------------------------------------------------------------------

create or replace function public.atendimento_enfileirar_mensagem(
  p_evento_id uuid,
  p_session_id text,
  p_mensagem_externa_id text,
  p_direcao text,
  p_tipo text,
  p_conteudo text,
  p_ocorrido_em timestamptz,
  p_nome_contato text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mensagem_id uuid;
begin
  if p_direcao not in ('entrada', 'saida_humana', 'saida_bot') then
    raise exception 'Direção inválida' using errcode = '22023';
  end if;

  insert into public.atendimento_conversas (session_id, nome_contato, ultima_mensagem_em)
  values (p_session_id, nullif(trim(p_nome_contato), ''), p_ocorrido_em)
  on conflict (session_id) do update set
    nome_contato = coalesce(excluded.nome_contato, public.atendimento_conversas.nome_contato),
    ultima_mensagem_em = greatest(public.atendimento_conversas.ultima_mensagem_em, excluded.ultima_mensagem_em),
    atualizado_em = now();

  insert into public.atendimento_mensagens (
    evento_id, session_id, mensagem_externa_id, direcao, tipo, conteudo, ocorrido_em
  ) values (
    p_evento_id, p_session_id, p_mensagem_externa_id, p_direcao, p_tipo,
    nullif(p_conteudo, ''), p_ocorrido_em
  ) on conflict (mensagem_externa_id) do nothing
  returning id into v_mensagem_id;

  -- Reentrega do provedor: não redefine debounce nem chama a IA novamente.
  if v_mensagem_id is null then
    select id into v_mensagem_id
    from public.atendimento_mensagens
    where mensagem_externa_id = p_mensagem_externa_id;
    return v_mensagem_id;
  end if;

  -- Mídias entram primeiro na fila de extração. Só depois de transcritas ou
  -- lidas elas agendam o lote que chama o assistente virtual.
  if p_direcao = 'entrada' and nullif(p_conteudo, '') is not null then
    insert into public.atendimento_lotes (session_id, estado, proximo_processamento_em)
    values (p_session_id, 'pending', now() + interval '4 seconds')
    on conflict (session_id) do update set
      -- Uma conversa em processamento mantém seu claim; a finalização detecta
      -- a mensagem nova e abre o próximo lote usando este horário.
      estado = case when public.atendimento_lotes.estado = 'processing' then 'processing' else 'pending' end,
      proximo_processamento_em = now() + interval '4 seconds',
      updated_at = now();
  end if;

  return v_mensagem_id;
end;
$$;

create or replace function public.atendimento_claim_lotes(p_limite integer default 10)
returns table(session_id text, claim_token uuid, claimed_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidatos as (
    select l.session_id
    from public.atendimento_lotes l
    where l.estado = 'pending'
      and l.proximo_processamento_em <= now()
    order by l.proximo_processamento_em, l.session_id
    limit greatest(1, least(coalesce(p_limite, 10), 50))
    for update skip locked
  )
  update public.atendimento_lotes l
  set estado = 'processing',
      claimed_at = now(),
      claim_token = gen_random_uuid(),
      updated_at = now()
  from candidatos c
  where l.session_id = c.session_id
  returning l.session_id, l.claim_token, l.claimed_at;
end;
$$;

create or replace function public.atendimento_finalizar_lote(
  p_session_id text,
  p_claim_token uuid,
  p_mensagem_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tem_pendentes boolean;
begin
  perform 1
  from public.atendimento_lotes
  where session_id = p_session_id
    and estado = 'processing'
    and claim_token = p_claim_token
  for update;

  if not found then
    raise exception 'Claim de lote inválido' using errcode = '42501';
  end if;

  update public.atendimento_mensagens
  set processado_em = now()
  where session_id = p_session_id
    and id = any(coalesce(p_mensagem_ids, array[]::uuid[]))
    and processado_em is null;

  select exists(
    select 1 from public.atendimento_mensagens
    where session_id = p_session_id and direcao = 'entrada' and processado_em is null
  ) into v_tem_pendentes;

  update public.atendimento_lotes
  set estado = case when v_tem_pendentes then 'pending' else 'idle' end,
      claim_token = null,
      claimed_at = null,
      proximo_processamento_em = case
        when v_tem_pendentes then greatest(proximo_processamento_em, now())
        else now()
      end,
      updated_at = now()
  where session_id = p_session_id;
end;
$$;

create or replace function public.atendimento_claim_outbox(p_limite integer default 20)
returns table(id uuid, session_id text, destino text, tipo text, conteudo text, tentativas smallint)
language sql
security definer
set search_path = ''
as $$
  with candidatos as (
    select o.id
    from public.atendimento_outbox o
    where o.estado = 'pending'
      and o.proxima_tentativa_em <= now()
    order by o.proxima_tentativa_em, o.criado_em
    limit greatest(1, least(coalesce(p_limite, 20), 100))
    for update skip locked
  )
  update public.atendimento_outbox o
  set estado = 'processing', tentativas = o.tentativas + 1
  from candidatos c
  where o.id = c.id
  returning o.id, o.session_id, o.destino, o.tipo, o.conteudo, o.tentativas;
$$;

create or replace function public.atendimento_definir_pausa(
  p_session_id text,
  p_expira_em timestamptz,
  p_criado_por uuid,
  p_motivo text default 'atendimento_humano'
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_expira_em <= now() then
    raise exception 'A pausa deve expirar no futuro' using errcode = '22023';
  end if;

  insert into public.atendimento_pausas (
    session_id, motivo, criado_por, iniciado_em, expira_em, encerrado_em
  ) values (
    p_session_id, nullif(trim(p_motivo), ''), p_criado_por, now(), p_expira_em, null
  ) on conflict (session_id) where encerrado_em is null do update set
    motivo = excluded.motivo,
    criado_por = excluded.criado_por,
    iniciado_em = excluded.iniciado_em,
    expira_em = excluded.expira_em;

  return p_expira_em;
end;
$$;

create or replace function public.atendimento_reagendar_lote(
  p_session_id text,
  p_claim_token uuid,
  p_atraso_segundos integer default 30
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.atendimento_lotes
  set estado = 'pending',
      claim_token = null,
      claimed_at = null,
      proximo_processamento_em = now() + make_interval(secs => greatest(5, least(coalesce(p_atraso_segundos, 30), 900))),
      updated_at = now()
  where session_id = p_session_id
    and estado = 'processing'
    and claim_token = p_claim_token;

  if not found then
    raise exception 'Claim de lote inválido' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.atendimento_enfileirar_mensagem(uuid, text, text, text, text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.atendimento_claim_lotes(integer) from public, anon, authenticated;
revoke all on function public.atendimento_finalizar_lote(text, uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.atendimento_claim_outbox(integer) from public, anon, authenticated;
revoke all on function public.atendimento_definir_pausa(text, timestamptz, uuid, text) from public, anon, authenticated;
revoke all on function public.atendimento_reagendar_lote(text, uuid, integer) from public, anon, authenticated;
grant execute on function public.atendimento_enfileirar_mensagem(uuid, text, text, text, text, text, timestamptz, text) to service_role;
grant execute on function public.atendimento_claim_lotes(integer) to service_role;
grant execute on function public.atendimento_finalizar_lote(text, uuid, uuid[]) to service_role;
grant execute on function public.atendimento_claim_outbox(integer) to service_role;
grant execute on function public.atendimento_definir_pausa(text, timestamptz, uuid, text) to service_role;
grant execute on function public.atendimento_reagendar_lote(text, uuid, integer) to service_role;
