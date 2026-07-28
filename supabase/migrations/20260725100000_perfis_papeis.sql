-- Perfis de usuário, papéis e vínculo do login com a equipe (atendentes).
-- Rodar no SQL Editor do Supabase (projeto napeofeenweerjhqucua) ou via `supabase db push`.
--
-- CONTEXTO: até aqui o painel usava um login compartilhado e a identidade do
-- atendente vinha de um <Select> no header salvo em localStorage — qualquer
-- pessoa logada podia se passar por qualquer atendente. Esta migração liga cada
-- login a uma linha de `public.atendentes` e introduz papéis reais.
--
-- COMPATIBILIDADE: todos os usuários que JÁ existem em auth.users são migrados
-- como 'admin' ativo, preservando exatamente o acesso atual. Só contas novas
-- nascem pendentes de liberação.

-- ---------------------------------------------------------------------------
-- 1. Tabela de perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------------

-- `auth.users` nunca é exposta ao frontend; o painel lê apenas public.profiles.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  papel text not null default 'atendente' check (papel in ('admin', 'lider', 'atendente')),
  -- Vínculo com a equipe: define de quem são "meus atendimentos".
  -- unique => um cadastro de atendente pertence a no máximo um login.
  atendente_id bigint unique references public.atendentes(id) on delete set null,
  -- Contas novas nascem inativas e precisam ser liberadas por um admin.
  ativo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_papel_idx on public.profiles (papel) where ativo;
create index if not exists profiles_atendente_id_idx on public.profiles (atendente_id);

comment on table public.profiles is
  'Perfil do usuário do painel. Fonte de verdade de papel/vínculo — nunca confiar em dados vindos do navegador.';
comment on column public.profiles.atendente_id is
  'Liga o login a uma linha de public.atendentes. Define quais atendimentos são "meus".';

-- ---------------------------------------------------------------------------
-- 2. Funções auxiliares de autorização
-- ---------------------------------------------------------------------------
-- São `security definer` por um motivo específico: as policies de
-- public.profiles precisam consultar public.profiles, o que causaria recursão
-- infinita de RLS. A função roda com o dono da tabela (ignora RLS) mas só
-- devolve dados do PRÓPRIO usuário (auth.uid()), nunca aceita parâmetro de
-- identidade — não há como um chamador perguntar pelo papel de outra pessoa.
-- `search_path = ''` impede sequestro de resolução de nomes; por isso todos os
-- objetos abaixo são qualificados com schema.

create or replace function public.perfil_papel()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.papel
  from public.profiles p
  where p.id = (select auth.uid()) and p.ativo
$$;

create or replace function public.perfil_atendente_id()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select p.atendente_id
  from public.profiles p
  where p.id = (select auth.uid()) and p.ativo
$$;

create or replace function public.sou_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.perfil_papel() = 'admin', false)
$$;

-- Gestor = quem enxerga a operação da equipe (admin ou líder).
create or replace function public.sou_gestor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.perfil_papel() in ('admin', 'lider'), false)
$$;

-- Menor privilégio: anon não executa nada disso.
revoke execute on function public.perfil_papel() from public, anon;
revoke execute on function public.perfil_atendente_id() from public, anon;
revoke execute on function public.sou_admin() from public, anon;
revoke execute on function public.sou_gestor() from public, anon;

grant execute on function public.perfil_papel() to authenticated;
grant execute on function public.perfil_atendente_id() to authenticated;
grant execute on function public.sou_admin() to authenticated;
grant execute on function public.sou_gestor() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Criação automática do perfil no cadastro
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nome, email, papel, ativo)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    new.email,
    'atendente',
    false -- aguarda liberação de um admin
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4. Trava contra escalação de privilégio e auto-bloqueio
-- ---------------------------------------------------------------------------
-- RLS controla QUAIS LINHAS podem ser alteradas, não QUAIS COLUNAS. Sem este
-- trigger, um usuário com permissão de editar o próprio perfil poderia se
-- promover a admin no mesmo UPDATE (mass assignment).

create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  admins_ativos int;
begin
  -- auth.uid() nulo = contexto confiável (SQL Editor, service_role, migração).
  -- Usuários finais nunca chegam aqui sem JWT: a policy de UPDATE é `to
  -- authenticated`, então a RLS barra antes do trigger.
  if (select auth.uid()) is not null and not public.sou_admin() then
    if new.papel is distinct from old.papel
       or new.ativo is distinct from old.ativo
       or new.atendente_id is distinct from old.atendente_id
       or new.id is distinct from old.id then
      raise exception 'Sem permissão para alterar papel, vínculo de atendente ou situação da conta'
        using errcode = '42501';
    end if;
  end if;

  -- Impede que o último admin ativo se rebaixe ou se desative (lockout).
  if old.papel = 'admin' and old.ativo
     and (new.papel is distinct from 'admin' or not new.ativo) then
    select count(*) into admins_ativos
    from public.profiles p
    where p.papel = 'admin' and p.ativo and p.id <> old.id;

    if admins_ativos = 0 then
      raise exception 'Não é possível remover o último administrador ativo do sistema'
        using errcode = '42501';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_guard_trg on public.profiles;
create trigger profiles_guard_trg
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
-- Diferente das tabelas antigas (que liberam tudo para a anon key), esta tabela
-- nasce com policies reais: ela é a base de autorização de todo o resto.

alter table public.profiles enable row level security;

-- Leitura: o próprio perfil sempre; gestores enxergam a equipe inteira.
drop policy if exists "perfil proprio ou gestor le" on public.profiles;
create policy "perfil proprio ou gestor le" on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()) or public.sou_gestor());

-- Escrita: o próprio usuário edita o próprio perfil (só nome/email — as demais
-- colunas são barradas pelo trigger acima); admin edita qualquer um.
drop policy if exists "perfil proprio ou admin atualiza" on public.profiles;
create policy "perfil proprio ou admin atualiza" on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()) or public.sou_admin())
  with check (id = (select auth.uid()) or public.sou_admin());

-- Sem policy de INSERT/DELETE: perfis só nascem pelo trigger de signup e só
-- somem junto com o usuário em auth.users.

-- Privilégios explícitos (não depender do default privilege do projeto):
-- `authenticated` só lê e atualiza; INSERT/DELETE ficam barrados já no GRANT,
-- antes mesmo da RLS. `anon` não toca na tabela.
grant select, update on public.profiles to authenticated;
-- O projeto concede ALL por default privileges; o revoke abaixo é o que de fato
-- garante o menor privilégio.
revoke insert, delete, truncate on public.profiles from authenticated;
revoke all on public.profiles from anon;

-- ---------------------------------------------------------------------------
-- 6. Backfill — preserva o acesso de quem já usa o painel
-- ---------------------------------------------------------------------------
-- Todo mundo que já tinha login vira admin ativo. Sem isto, aplicar esta
-- migração deixaria o painel inacessível.

insert into public.profiles (id, nome, email, papel, ativo)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1)),
  u.email,
  'admin',
  true
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- ROLLBACK (manual, se necessário)
-- ---------------------------------------------------------------------------
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop trigger if exists profiles_guard_trg on public.profiles;
-- drop function if exists public.handle_new_user();
-- drop function if exists public.profiles_guard();
-- drop function if exists public.sou_gestor();
-- drop function if exists public.sou_admin();
-- drop function if exists public.perfil_atendente_id();
-- drop function if exists public.perfil_papel();
-- drop table if exists public.profiles;
