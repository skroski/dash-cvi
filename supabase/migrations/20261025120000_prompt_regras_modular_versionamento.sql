-- Migração: Sistema de Prompt Modular & Versionamento estilo GitHub
-- Permite que clientes e administradores gerenciem regras individuais,
-- aproveitem variáveis da aplicação e mantenham histórico auditável com diff e rollback.

-- ---------------------------------------------------------------------------
-- 1. Permissões de edição do prompt: Daniel + Usuários com papel 'admin'
-- ---------------------------------------------------------------------------

create or replace function public.pode_editar_meu_prompt()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    join public.profiles p on p.id = u.id and p.ativo
    where u.id = auth.uid() and (
      p.papel = 'admin'
    )
  )
$$;

revoke all on function public.pode_editar_meu_prompt() from public, anon;
grant execute on function public.pode_editar_meu_prompt() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Evolução da tabela de versões (meu_prompt_versoes)
-- ---------------------------------------------------------------------------

alter table public.meu_prompt_versoes
  add column if not exists descricao text default 'Atualização do prompt',
  add column if not exists autor_nome text,
  add column if not exists snapshot_regras jsonb default '[]'::jsonb;

comment on column public.meu_prompt_versoes.descricao is
  'Resumo da alteração (estilo commit message do GitHub) para pessoas comuns entenderem o que mudou.';
comment on column public.meu_prompt_versoes.snapshot_regras is
  'Cópia do estado das regras no momento do salvamento para permitir rollback exato.';

-- ---------------------------------------------------------------------------
-- 3. Tabela de Regras Modulares (prompt_regras)
-- ---------------------------------------------------------------------------

create table if not exists public.prompt_regras (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  titulo text not null,
  categoria text not null check (categoria in (
    'comportamento',
    'agendamento',
    'servicos',
    'restricoes',
    'emergencia',
    'personalizadas'
  )),
  conteudo text not null check (char_length(conteudo) between 1 and 20000),
  padrao boolean not null default false,
  ativa boolean not null default true,
  ordem integer not null default 0,
  criado_por uuid references auth.users(id),
  atualizado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prompt_regras_categoria_idx on public.prompt_regras (categoria, ordem);
create index if not exists prompt_regras_ativa_idx on public.prompt_regras (ativa);

alter table public.prompt_regras enable row level security;

-- Policies RLS
drop policy if exists "prompt_regras_select" on public.prompt_regras;
create policy "prompt_regras_select" on public.prompt_regras
  for select to authenticated
  using (public.pode_editar_meu_prompt());

drop policy if exists "prompt_regras_insert" on public.prompt_regras;
create policy "prompt_regras_insert" on public.prompt_regras
  for insert to authenticated
  with check (public.pode_editar_meu_prompt());

drop policy if exists "prompt_regras_update" on public.prompt_regras;
create policy "prompt_regras_update" on public.prompt_regras
  for update to authenticated
  using (public.pode_editar_meu_prompt())
  with check (public.pode_editar_meu_prompt());

drop policy if exists "prompt_regras_delete" on public.prompt_regras;
create policy "prompt_regras_delete" on public.prompt_regras
  for delete to authenticated
  using (public.pode_editar_meu_prompt() and not padrao);

grant select, insert, update, delete on public.prompt_regras to authenticated;
revoke all on public.prompt_regras from anon;

-- 4. O compilador do prompt (obter_prompt_compilado) vive em 20261027100000, o único lugar
--    onde é definido (evita que reexecutar esta migração volte a uma versão antiga).

-- As regras iniciais (genéricas) são criadas em 20261027100000; as regras específicas de
-- cada clínica vêm de supabase/seeds/.
