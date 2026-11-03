-- Mapeamento e-mail → papel: quem entra pela primeira vez já cai com o papel
-- certo e liberado, sem depender de alguém lembrar de configurar na mão.
-- Depende de: 20260725100000_perfis_papeis.sql
--
-- POR QUE ISSO EXISTE: as contas da equipe são criadas por fora do painel
-- (convite pelo Supabase ou primeiro login com Google). Sem este mapa, toda
-- conta nova nasceria como atendente inativo e precisaria de liberação manual —
-- inclusive as de administrador, o que é justamente o pior momento para
-- depender de um passo manual.

-- ---------------------------------------------------------------------------
-- 1. Tabela do mapa
-- ---------------------------------------------------------------------------

create table if not exists public.usuarios_previstos (
  -- Sempre em minúsculas: o e-mail do provedor pode vir com capitalização
  -- diferente e a comparação precisa bater.
  email text primary key check (email = lower(email)),
  papel text not null check (papel in ('admin', 'lider', 'atendente')),
  observacao text,
  created_at timestamptz not null default now()
);

comment on table public.usuarios_previstos is
  'E-mails autorizados e seu papel. Consultado no primeiro login para criar o perfil já liberado.';

-- ---------------------------------------------------------------------------
-- 2. Equipe da cvi
-- ---------------------------------------------------------------------------
-- Para adicionar alguém no futuro, basta um insert aqui antes do primeiro
-- login da pessoa (ou liberar pela tela Usuários e auditoria depois).

insert into public.usuarios_previstos (email, papel, observacao) values
  ('recepcaohovetcvi@gmail.com',   'atendente', 'Recepção — nível operacional'),
  ('adminclinicacvi@gmail.com',    'admin',     'Administração da clínica'),
  ('danielskroski@gmail.com',       'admin',     'Administrador do sistema')
on conflict (email) do update
  set papel = excluded.papel,
      observacao = excluded.observacao;

-- ---------------------------------------------------------------------------
-- 3. Criação do perfil passa a consultar o mapa
-- ---------------------------------------------------------------------------
-- Substitui a versão de 20260725100000. Quem está no mapa nasce com o papel
-- previsto e já ativo; quem não está continua nascendo atendente inativo,
-- aguardando liberação de um admin.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_papel text;
begin
  select up.papel into v_papel
  from public.usuarios_previstos up
  where up.email = lower(new.email);

  insert into public.profiles (id, nome, email, papel, ativo)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    new.email,
    coalesce(v_papel, 'atendente'),
    v_papel is not null -- previsto => já liberado
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Aplica o mapa a quem já tem perfil
-- ---------------------------------------------------------------------------
-- A migração anterior tornou todo usuário pré-existente admin (para não tirar
-- o acesso de ninguém). Aqui o papel real de cada um é corrigido.
--
-- Roda sem JWT (SQL Editor / service_role), contexto em que `profiles_guard`
-- não exige admin — é a mesma porta usada pelo backfill anterior.

update public.profiles p
set papel = up.papel,
    ativo = true
from public.usuarios_previstos up
where lower(p.email) = up.email
  and (p.papel is distinct from up.papel or not p.ativo);

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------

alter table public.usuarios_previstos enable row level security;

-- Só admin enxerga e mexe no mapa: ele decide quem entra e com qual papel.
drop policy if exists "mapa de usuarios: admin le" on public.usuarios_previstos;
create policy "mapa de usuarios: admin le" on public.usuarios_previstos
  for select to authenticated
  using (public.sou_admin());

drop policy if exists "mapa de usuarios: admin escreve" on public.usuarios_previstos;
create policy "mapa de usuarios: admin escreve" on public.usuarios_previstos
  for all to authenticated
  using (public.sou_admin())
  with check (public.sou_admin());

grant select, insert, update, delete on public.usuarios_previstos to authenticated;
revoke all on public.usuarios_previstos from anon;

-- ---------------------------------------------------------------------------
-- ROLLBACK (manual, se necessário)
-- ---------------------------------------------------------------------------
-- Restaurar a versão de handle_new_user() de 20260725100000_perfis_papeis.sql
-- e então:
-- drop table if exists public.usuarios_previstos;
