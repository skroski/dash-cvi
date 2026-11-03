-- ==============================================================================
-- Migration: Sincronização Server-to-Server e Agendador Cron do Google Calendar
-- Tabela de configuração, Edge Function hook e Cron Job a cada 10 minutos (pg_cron)
-- ==============================================================================

-- 1. Habilita extensões necessárias para chamadas HTTP e agendamento (se suportado no projeto)
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema extensions;

-- 2. Tabela de Configurações Centrais do Google Calendar
create table if not exists public.google_agenda_config (
  id text primary key default 'default',
  service_account_email text,
  service_account_key text,
  refresh_token text,
  client_id text,
  client_secret text,
  access_token text,
  token_expiry timestamptz,
  sync_interval_minutes integer not null default 10,
  is_active boolean not null default true,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Insere o registro padrão se ainda não existir
insert into public.google_agenda_config (id, is_active, sync_interval_minutes)
values ('default', true, 10)
on conflict (id) do nothing;

-- 3. Habilita Row Level Security (RLS)
alter table public.google_agenda_config enable row level security;

-- Limpa policies existentes
drop policy if exists "permitir leitura config agenda" on public.google_agenda_config;
drop policy if exists "permitir atualizacao config agenda" on public.google_agenda_config;

-- Políticas de leitura e gravação
create policy "permitir leitura config agenda"
  on public.google_agenda_config for select
  to anon, authenticated, service_role
  using (true);

create policy "permitir atualizacao config agenda"
  on public.google_agenda_config for all
  to authenticated, service_role
  using (true)
  with check (true);

grant select, insert, update on public.google_agenda_config to anon, authenticated, service_role;

-- 4. Função PL/pgSQL para disparar a Edge Function de Sincronização via SQL/RPC
create or replace function public.trigger_google_calendar_sync()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_request_id bigint;
  v_url text;
begin
  -- URL da Edge Function do Supabase
  v_url := 'https://napeofeenweerjhqucua.supabase.co/functions/v1/sync-google-calendar';

  -- Disparo assíncrono via pg_net
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'source', 'pg_trigger_rpc',
      'triggered_at', now()
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Sincronização assíncrona disparada no servidor com sucesso.',
    'timestamp', now()
  );
exception when others then
  return jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'timestamp', now()
  );
end;
$$;

grant execute on function public.trigger_google_calendar_sync() to anon, authenticated, service_role;

-- 5. Agendamento do Cron Job a cada 10 minutos (pg_cron)
-- Executa a cada 10 minutos no servidor do Supabase de forma 100% autônoma
do $$
begin
  -- Verifica se a extensão pg_cron e a tabela cron.job estão ativas
  if exists (
    select 1 from pg_tables where schemaname = 'cron' and tablename = 'job'
  ) then
    -- Remove job anterior se já existir para evitar duplicidade
    perform cron.unschedule('sync-google-calendar-10-min');

    -- Agenda nova execução a cada 10 minutos
    perform cron.schedule(
      'sync-google-calendar-10-min',
      '*/10 * * * *',
      $cron$
      select net.http_post(
        url := 'https://napeofeenweerjhqucua.supabase.co/functions/v1/sync-google-calendar',
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('source', 'pg_cron_10m')
      );
      $cron$
    );
  end if;
exception when others then
  -- Se o pg_cron não estiver ativo ou exigir permissões especiais do cluster,
  -- a função RPC e a Edge Function continuam 100% funcionais
  raise notice 'Aviso ao agendar pg_cron: %', SQLERRM;
end $$;
