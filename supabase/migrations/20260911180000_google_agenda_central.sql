-- ==============================================================================
-- Migration: Persistência Central e Sincronização Google Agenda no Supabase
-- Permite leitura e sincronização sem bloqueios de RLS para todos os veterinários,
-- usuários autenticados e modo anônimo (TV/Consultório).
-- ==============================================================================

-- 1. Tabela de Agendas / Calendários Sincronizados
create table if not exists public.google_calendars_sincronizados (
  id text primary key, -- ID nativo do Google Calendar
  summary text not null,
  description text,
  background_color text default '#3b82f6',
  foreground_color text default '#ffffff',
  primary_calendar boolean default false,
  ativo boolean default true,
  time_zone text default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Tabela de Agendamentos / Eventos Sincronizados
create table if not exists public.google_eventos_sincronizados (
  id text primary key, -- ID nativo do evento do Google Calendar
  calendar_id text not null, -- ID da agenda de origem (sem FK rígida para evitar rejeição em lotes)
  summary text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text default 'confirmed',
  html_link text,
  location text,
  calendar_name text,
  calendar_color text,
  pet_name text,
  owner_name text,
  phone text,
  service text,
  attendees jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Remove FK antiga se existir para não travar sincronização de eventos de múltiplas agendas
alter table public.google_eventos_sincronizados drop constraint if exists google_eventos_sincronizados_calendar_id_fkey;

-- Índices de consulta rápida por período e por agenda
create index if not exists google_eventos_start_time_idx on public.google_eventos_sincronizados(start_time);
create index if not exists google_eventos_end_time_idx on public.google_eventos_sincronizados(end_time);
create index if not exists google_eventos_calendar_id_idx on public.google_eventos_sincronizados(calendar_id);

-- 3. Tabela de Log e Metadados de Sincronização
create table if not exists public.google_agenda_sync_log (
  id uuid primary key default gen_random_uuid(),
  synced_by uuid references auth.users(id) on delete set null,
  synced_by_email text,
  calendars_count integer default 0,
  events_count integer default 0,
  status text default 'sucesso',
  created_at timestamptz not null default now()
);

create index if not exists google_agenda_sync_log_created_at_idx on public.google_agenda_sync_log(created_at desc);

-- 4. Replica Identity Full para garantir dados completos no Realtime
alter table public.google_calendars_sincronizados replica identity full;
alter table public.google_eventos_sincronizados replica identity full;

-- 5. Habilita Row Level Security (RLS)
alter table public.google_calendars_sincronizados enable row level security;
alter table public.google_eventos_sincronizados enable row level security;
alter table public.google_agenda_sync_log enable row level security;

-- Limpeza de policies antigas
drop policy if exists "equipe le agendas sincronizadas" on public.google_calendars_sincronizados;
drop policy if exists "equipe gerencia agendas sincronizadas" on public.google_calendars_sincronizados;
drop policy if exists "permitir leitura agendas sincronizadas" on public.google_calendars_sincronizados;
drop policy if exists "permitir gravacao agendas sincronizadas" on public.google_calendars_sincronizados;

drop policy if exists "equipe le eventos sincronizados" on public.google_eventos_sincronizados;
drop policy if exists "equipe gerencia eventos sincronizados" on public.google_eventos_sincronizados;
drop policy if exists "permitir leitura eventos sincronizados" on public.google_eventos_sincronizados;
drop policy if exists "permitir gravacao eventos sincronizados" on public.google_eventos_sincronizados;

drop policy if exists "equipe le log de sincronizacao" on public.google_agenda_sync_log;
drop policy if exists "equipe insere log sincronizacao" on public.google_agenda_sync_log;
drop policy if exists "permitir leitura log sincronizacao" on public.google_agenda_sync_log;
drop policy if exists "permitir gravacao log sincronizacao" on public.google_agenda_sync_log;

-- Políticas universais de Leitura (para public: anon, authenticated, consultório, TV)
create policy "permitir leitura agendas sincronizadas"
  on public.google_calendars_sincronizados for select
  to public
  using (true);

create policy "permitir leitura eventos sincronizados"
  on public.google_eventos_sincronizados for select
  to public
  using (true);

create policy "permitir leitura log sincronizacao"
  on public.google_agenda_sync_log for select
  to public
  using (true);

-- Políticas de Escrita (INSERT, UPDATE, DELETE) para usuários do sistema
create policy "permitir gravacao agendas sincronizadas"
  on public.google_calendars_sincronizados for all
  to public
  using (true)
  with check (true);

create policy "permitir gravacao eventos sincronizados"
  on public.google_eventos_sincronizados for all
  to public
  using (true)
  with check (true);

create policy "permitir gravacao log sincronizacao"
  on public.google_agenda_sync_log for all
  to public
  using (true)
  with check (true);

-- Concessão explícita de privilégios para anon, authenticated e service_role
grant select, insert, update, delete on public.google_calendars_sincronizados to anon, authenticated, service_role;
grant select, insert, update, delete on public.google_eventos_sincronizados to anon, authenticated, service_role;
grant select, insert, update, delete on public.google_agenda_sync_log to anon, authenticated, service_role;

-- 6. Adiciona na publicação Realtime apenas as tabelas de controle
-- (google_agenda_sync_log dispara 1 único evento ao término da sincronização,
-- evitando tempestade de WebSocket por inserir milhares de agendamentos)
alter table public.google_agenda_sync_log replica identity full;

do $$
begin
  -- Remove eventos da publicação caso esteja presente
  if exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
      and schemaname = 'public' 
      and tablename = 'google_eventos_sincronizados'
  ) then
    alter publication supabase_realtime drop table public.google_eventos_sincronizados;
  end if;

  -- Adiciona agendas se ainda não estiver presente
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
      and schemaname = 'public' 
      and tablename = 'google_calendars_sincronizados'
  ) then
    alter publication supabase_realtime add table public.google_calendars_sincronizados;
  end if;

  -- Adiciona log de sincronização se ainda não estiver presente
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
      and schemaname = 'public' 
      and tablename = 'google_agenda_sync_log'
  ) then
    alter publication supabase_realtime add table public.google_agenda_sync_log;
  end if;
end $$;

