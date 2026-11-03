-- Pipeline assíncrono para áudio, imagem e PDF recebidos pelo WhatsApp.

create table if not exists public.atendimento_midias (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references public.atendimento_eventos(id) on delete set null,
  mensagem_id uuid not null unique references public.atendimento_mensagens(id) on delete cascade,
  session_id text not null references public.atendimento_conversas(session_id) on delete cascade,
  mensagem_externa_id text not null,
  tipo text not null check (tipo in ('audio', 'imagem', 'pdf', 'documento')),
  estado text not null default 'pending' check (estado in ('pending', 'processing', 'done', 'failed')),
  tentativas smallint not null default 0 check (tentativas between 0 and 6),
  proxima_tentativa_em timestamptz not null default now(),
  ultimo_erro_codigo text,
  created_at timestamptz not null default now(),
  processado_em timestamptz
);

create index if not exists atendimento_midias_pendente_idx
  on public.atendimento_midias(proxima_tentativa_em, created_at)
  where estado = 'pending';

alter table public.atendimento_midias enable row level security;
revoke all on public.atendimento_midias from anon, authenticated;

create or replace function public.atendimento_claim_midias(p_limite integer default 5)
returns table(id uuid, mensagem_id uuid, session_id text, mensagem_externa_id text, tipo text, tentativas smallint)
language sql
security definer
set search_path = ''
as $$
  with candidatos as (
    select m.id
    from public.atendimento_midias m
    where m.estado = 'pending' and m.proxima_tentativa_em <= now()
    order by m.proxima_tentativa_em, m.created_at
    limit greatest(1, least(coalesce(p_limite, 5), 20))
    for update skip locked
  )
  update public.atendimento_midias m
  set estado = 'processing', tentativas = m.tentativas + 1
  from candidatos c
  where m.id = c.id
  returning m.id, m.mensagem_id, m.session_id, m.mensagem_externa_id, m.tipo, m.tentativas;
$$;

create or replace function public.atendimento_agendar_lote(p_session_id text, p_atraso_segundos integer default 4)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.atendimento_lotes (session_id, estado, proximo_processamento_em)
  values (p_session_id, 'pending', now() + make_interval(secs => greatest(1, least(coalesce(p_atraso_segundos, 4), 60))))
  on conflict (session_id) do update set
    estado = case when public.atendimento_lotes.estado = 'processing' then 'processing' else 'pending' end,
    proximo_processamento_em = now() + make_interval(secs => greatest(1, least(coalesce(p_atraso_segundos, 4), 60))),
    updated_at = now();
end;
$$;

revoke all on function public.atendimento_claim_midias(integer) from public, anon, authenticated;
revoke all on function public.atendimento_agendar_lote(text, integer) from public, anon, authenticated;
grant execute on function public.atendimento_claim_midias(integer) to service_role;
grant execute on function public.atendimento_agendar_lote(text, integer) to service_role;

create or replace function public.atendimento_midias_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (select 1 from public.atendimento_midias where estado = 'pending' and proxima_tentativa_em <= now()) then
    return;
  end if;
  begin
    select decrypted_secret into v_url from vault.decrypted_secrets where name = 'atendimento_media_worker_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'atendimento_cron_secret';
  exception when others then
    v_url := null;
    v_secret := null;
  end;
  if v_url is null or v_secret is null then
    insert into public.atendimento_erros (funcao, codigo, detalhe_seguro)
    select 'atendimento-midias-tick', 'vault_ausente', 'URL ou segredo do worker de mídia não configurado'
    where not exists (
      select 1 from public.atendimento_erros
      where funcao = 'atendimento-midias-tick' and codigo = 'vault_ausente' and created_at > now() - interval '1 hour'
    );
    return;
  end if;
  perform net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Internal-Secret', v_secret),
    timeout_milliseconds := 10000
  );
end;
$$;

revoke all on function public.atendimento_midias_tick() from public, anon, authenticated;
grant execute on function public.atendimento_midias_tick() to service_role;
