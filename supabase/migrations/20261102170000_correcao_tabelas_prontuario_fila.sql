-- ============================================================================
-- CORREÇÃO E ALINHAMENTO: FILA_CONFIG (LOGO_URL), PETS & PRONTUARIO_IA_CONFIG
-- ============================================================================
-- 1. fila_config: Adiciona coluna logo_url (compatibilidade com bundles legados e chamadas REST)
--    e sincroniza com logo_path.
-- 2. pets: Garante existência da tabela, RLS e permissões para authenticated.
-- 3. prontuario_ia_config: Garante existência da tabela, registro singleton id=1 e permissões.
-- 4. Notifica o PostgREST para recarregar o schema cache imediatamente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Compatibilidade em public.fila_config (logo_url <-> logo_path)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'fila_config'
  ) then
    -- Adiciona a coluna logo_url caso ainda não exista
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'fila_config' and column_name = 'logo_url'
    ) then
      alter table public.fila_config add column logo_url text;
    end if;

    -- Sincroniza valores existentes
    update public.fila_config
    set logo_url = logo_path
    where logo_url is null and logo_path is not null;
  end if;
end $$;

-- Trigger para manter logo_url e logo_path sincronizados
create or replace function public.fila_config_sincronizar_logo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.logo_path is not null and (new.logo_url is null or new.logo_url = old.logo_url) then
    new.logo_url := new.logo_path;
  elsif new.logo_url is not null and (new.logo_path is null or new.logo_path = old.logo_path) then
    new.logo_path := new.logo_url;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fila_config_sincronizar_logo on public.fila_config;
create trigger trg_fila_config_sincronizar_logo
  before insert or update on public.fila_config
  for each row execute function public.fila_config_sincronizar_logo();

-- ---------------------------------------------------------------------------
-- 2. Tabela public.pets (Garante criação, constraints e RLS)
-- ---------------------------------------------------------------------------
create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  tutor_id bigint references public.dados_cliente(id) on delete set null,
  nome text not null check (char_length(btrim(nome)) >= 1),
  especie text not null default 'canina',
  raca text,
  sexo text not null default 'macho',
  idade integer check (idade is null or idade >= 0),
  peso numeric(6,2) check (peso is null or peso >= 0),
  data_nascimento date,
  porte text,
  castrado boolean default false,
  microchip text,
  status text default 'ativo',
  image_url text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pets_tutor_id on public.pets(tutor_id);
create index if not exists idx_pets_nome on public.pets(nome);

alter table public.pets enable row level security;

-- Política de acesso permissiva para membros da equipe clínica
drop policy if exists "pets_authenticated_all" on public.pets;
create policy "pets_authenticated_all" on public.pets
  for all to authenticated
  using (
    (select auth.uid()) is not null
    and not coalesce((select exists(select 1 from public.profiles where id = auth.uid() and papel = 'totem')), false)
  )
  with check (
    (select auth.uid()) is not null
    and not coalesce((select exists(select 1 from public.profiles where id = auth.uid() and papel = 'totem')), false)
  );

grant select, insert, update, delete on public.pets to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tabela public.prontuario_ia_config (Garante criação, singleton e RLS)
-- ---------------------------------------------------------------------------
create table if not exists public.prontuario_ia_config (
  id integer primary key check (id = 1),
  webhook_url text,
  system_prompt text,
  veterinario_nome text,
  crmv_responsavel text,
  retencao_dias integer not null default 90 check (retencao_dias between 7 and 365),
  updated_at timestamptz not null default now()
);

insert into public.prontuario_ia_config (id, webhook_url, system_prompt, veterinario_nome, crmv_responsavel, retencao_dias)
values (1, null, null, null, null, 90)
on conflict (id) do nothing;

alter table public.prontuario_ia_config enable row level security;

drop policy if exists "prontuario_ia_config_authenticated_all" on public.prontuario_ia_config;
create policy "prontuario_ia_config_authenticated_all" on public.prontuario_ia_config
  for all to authenticated
  using (
    (select auth.uid()) is not null
    and not coalesce((select exists(select 1 from public.profiles where id = auth.uid() and papel = 'totem')), false)
  )
  with check (
    (select auth.uid()) is not null
    and not coalesce((select exists(select 1 from public.profiles where id = auth.uid() and papel = 'totem')), false)
  );

grant select, insert, update on public.prontuario_ia_config to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Notifica o PostgREST para recarregar o cache do schema imediatamente
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
