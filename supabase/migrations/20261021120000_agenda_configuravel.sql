-- Agenda configurável da clínica.
--
-- Esta migração substitui horários e calendários fixados nos workflows n8n por
-- configuração auditável. IDs reais de calendários ficam em Supabase Secrets:
-- cada linha de agenda_calendarios aponta somente para o NOME do secret.

-- ---------------------------------------------------------------------------
-- Configuração administrativa
-- ---------------------------------------------------------------------------

create table if not exists public.agenda_calendarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  secret_key text not null unique check (secret_key ~ '^[A-Z][A-Z0-9_]{2,127}$'),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agenda_calendarios is
  'Rótulos de calendários. O valor do Google Calendar ID fica somente no Supabase Secret indicado por secret_key.';

create table if not exists public.agenda_profissionais (
  id uuid primary key default gen_random_uuid(),
  atendente_id bigint unique references public.atendentes(id) on delete set null,
  nome text not null unique,
  cor text not null default '#0f766e' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agenda_especialidades (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique check (chave ~ '^[a-z0-9_-]{2,80}$'),
  nome text not null unique,
  duracao_padrao_minutos smallint not null default 60 check (duracao_padrao_minutos between 5 and 480),
  duracao_retorno_minutos smallint not null default 30 check (duracao_retorno_minutos between 5 and 480),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agenda_regras (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references public.agenda_profissionais(id) on delete cascade,
  especialidade_id uuid not null references public.agenda_especialidades(id) on delete cascade,
  calendario_id uuid references public.agenda_calendarios(id) on delete restrict,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profissional_id, especialidade_id)
);

create table if not exists public.agenda_janelas_semanais (
  id uuid primary key default gen_random_uuid(),
  regra_id uuid not null references public.agenda_regras(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  inicio time not null,
  fim time not null,
  -- Permite reproduzir a regra antiga em que o último início pode ser diferente
  -- do fim da jornada. Nulo = motor calcula fim - duração do serviço.
  ultimo_inicio time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (inicio < fim),
  check (ultimo_inicio is null or (ultimo_inicio >= inicio and ultimo_inicio <= fim)),
  unique (regra_id, dia_semana, inicio)
);

create table if not exists public.agenda_intervalos (
  id uuid primary key default gen_random_uuid(),
  regra_id uuid not null references public.agenda_regras(id) on delete cascade,
  tipo text not null default 'almoco' check (tipo in ('almoco', 'pausa', 'bloqueio')),
  dia_semana smallint check (dia_semana between 0 and 6),
  data_especifica date,
  inicio time not null,
  fim time not null,
  ativo boolean not null default true,
  descricao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (inicio < fim),
  check (
    (dia_semana is not null and data_especifica is null)
    or (dia_semana is null and data_especifica is not null)
  )
);

create index if not exists agenda_regras_calendario_idx on public.agenda_regras(calendario_id);
create index if not exists agenda_janelas_regra_dia_idx on public.agenda_janelas_semanais(regra_id, dia_semana);
create index if not exists agenda_intervalos_regra_recorrente_idx on public.agenda_intervalos(regra_id, dia_semana) where data_especifica is null and ativo;
create index if not exists agenda_intervalos_regra_data_idx on public.agenda_intervalos(regra_id, data_especifica) where data_especifica is not null and ativo;

-- ---------------------------------------------------------------------------
-- Auditoria: mudanças de configuração são operacionais e nunca silenciosas.
-- ---------------------------------------------------------------------------

create table if not exists public.agenda_config_auditoria (
  id bigint generated always as identity primary key,
  tabela text not null,
  operacao text not null check (operacao in ('INSERT', 'UPDATE', 'DELETE')),
  registro_id uuid,
  antes jsonb,
  depois jsonb,
  autor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists agenda_config_auditoria_registro_idx
  on public.agenda_config_auditoria(tabela, registro_id, created_at desc);

create or replace function public.agenda_atualizar_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.agenda_auditar_configuracao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes jsonb;
  v_depois jsonb;
  v_registro_id uuid;
begin
  if tg_op = 'DELETE' then
    v_antes := to_jsonb(old) - 'secret_key';
    v_depois := null;
    v_registro_id := old.id;
  elsif tg_op = 'INSERT' then
    v_antes := null;
    v_depois := to_jsonb(new) - 'secret_key';
    v_registro_id := new.id;
  else
    v_antes := to_jsonb(old) - 'secret_key';
    v_depois := to_jsonb(new) - 'secret_key';
    v_registro_id := new.id;
  end if;

  insert into public.agenda_config_auditoria (tabela, operacao, registro_id, antes, depois, autor_id)
  values (tg_table_name, tg_op, v_registro_id, v_antes, v_depois, auth.uid());

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'agenda_calendarios', 'agenda_profissionais', 'agenda_especialidades',
    'agenda_regras', 'agenda_janelas_semanais', 'agenda_intervalos'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.agenda_atualizar_updated_at()', t || '_updated_at', t);
    execute format('drop trigger if exists %I on public.%I', t || '_auditoria', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.agenda_auditar_configuracao()', t || '_auditoria', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS. Apenas admins editam regras. As Edge Functions usam service_role e não
-- dependem de policies do navegador.
-- ---------------------------------------------------------------------------

alter table public.agenda_calendarios enable row level security;
alter table public.agenda_profissionais enable row level security;
alter table public.agenda_especialidades enable row level security;
alter table public.agenda_regras enable row level security;
alter table public.agenda_janelas_semanais enable row level security;
alter table public.agenda_intervalos enable row level security;
alter table public.agenda_config_auditoria enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'agenda_calendarios', 'agenda_profissionais', 'agenda_especialidades',
    'agenda_regras', 'agenda_janelas_semanais', 'agenda_intervalos',
    'agenda_config_auditoria'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_total', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.sou_admin()) with check (public.sou_admin())',
      t || '_admin_total', t
    );
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- Não permitir que o navegador chame helpers/triggers diretamente.
revoke all on function public.agenda_atualizar_updated_at() from public, anon, authenticated;
revoke all on function public.agenda_auditar_configuracao() from public, anon, authenticated;

-- Os dados de cada clínica (calendários, profissionais, tipos, jornadas) NÃO são semeados
-- aqui: cadastre pelo painel (Regras da agenda) ou aplique um arquivo de supabase/seeds/.

comment on column public.agenda_janelas_semanais.ultimo_inicio is
  'Último horário inicial permitido. Mantém compatibilidade com regras históricas; nulo usa fim menos a duração solicitada.';
