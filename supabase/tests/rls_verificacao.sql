-- Verificação das policies de RLS com usuários e papéis reais.
--
-- Como rodar: cole o arquivo INTEIRO no SQL Editor do Supabase e execute de uma
-- vez. Ele cria usuários de teste, troca o JWT da sessão para cada papel, roda
-- as verificações e termina em ROLLBACK — nada é gravado.
--
-- Um teste de RLS feito com a conexão administrativa não prova nada: o dono da
-- tabela ignora as policies. Por isso aqui cada bloco assume o papel
-- `authenticated` e um `auth.uid()` diferente, como o painel faz.
--
-- Pré-requisito: as três migrations 20260725* já aplicadas.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------

-- Tabela comum (não temporária): assumir o papel `authenticated` exigiria
-- permissão no schema temporário da sessão. Como tudo roda dentro da transação,
-- o ROLLBACK do final a remove junto com o resto.
create table public._rls_res (
  verificacao text,
  esperado text,
  obtido text
);

grant all on public._rls_res to authenticated, anon;

-- Atendentes de teste
insert into public.atendentes (id, nome, cargo, ativo)
values
  (900001, 'ZZ Teste Atendente A', 'Atendente', true),
  (900002, 'ZZ Teste Atendente B', 'Atendente', true);

-- Usuários de teste (o trigger de signup cria os perfis automaticamente)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a1',
   'authenticated', 'authenticated', 'zz-admin@teste.local', 'x',
   now(), now(), now(), '{"provider":"email"}', '{"name":"ZZ Admin"}'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a2',
   'authenticated', 'authenticated', 'zz-lider@teste.local', 'x',
   now(), now(), now(), '{"provider":"email"}', '{"name":"ZZ Lider"}'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a3',
   'authenticated', 'authenticated', 'zz-atendente@teste.local', 'x',
   now(), now(), now(), '{"provider":"email"}', '{"name":"ZZ Atendente"}');

update public.profiles set papel = 'admin', ativo = true
  where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set papel = 'lider', ativo = true
  where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set papel = 'atendente', ativo = true, atendente_id = 900001
  where id = '00000000-0000-0000-0000-0000000000a3';

-- ---------------------------------------------------------------------------
-- 1. Atendente enxerga apenas o próprio perfil
-- ---------------------------------------------------------------------------

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
set local role authenticated;

insert into public._rls_res
select 'atendente lê apenas o próprio perfil', '1', count(*)::text from public.profiles;

-- ---------------------------------------------------------------------------
-- 2. Atendente não consegue se promover a admin
-- ---------------------------------------------------------------------------

do $$
declare
  afetadas int;
begin
  update public.profiles set papel = 'admin'
  where id = '00000000-0000-0000-0000-0000000000a3';
  get diagnostics afetadas = row_count;
  insert into public._rls_res values (
    'atendente não se promove a admin', 'bloqueado',
    case when afetadas = 0 then 'bloqueado (0 linhas)' else 'FALHA: promoveu' end
  );
exception when others then
  insert into public._rls_res values (
    'atendente não se promove a admin', 'bloqueado', 'bloqueado: ' || sqlerrm
  );
end $$;

-- ---------------------------------------------------------------------------
-- 3. Atendente não altera o próprio vínculo de atendente
-- ---------------------------------------------------------------------------

do $$
declare
  afetadas int;
begin
  update public.profiles set atendente_id = 900002
  where id = '00000000-0000-0000-0000-0000000000a3';
  get diagnostics afetadas = row_count;
  insert into public._rls_res values (
    'atendente não troca o próprio vínculo', 'bloqueado',
    case when afetadas = 0 then 'bloqueado (0 linhas)' else 'FALHA: alterou' end
  );
exception when others then
  insert into public._rls_res values (
    'atendente não troca o próprio vínculo', 'bloqueado', 'bloqueado: ' || sqlerrm
  );
end $$;

-- ---------------------------------------------------------------------------
-- 4. Atendente altera o PRÓPRIO status
-- ---------------------------------------------------------------------------

do $$
begin
  perform public.definir_status_atendente(900001, 'almoco', 'teste', null);
  insert into public._rls_res values ('atendente altera o próprio status', 'permitido', 'permitido');
exception when others then
  insert into public._rls_res values (
    'atendente altera o próprio status', 'permitido', 'FALHA: ' || sqlerrm
  );
end $$;

-- ---------------------------------------------------------------------------
-- 5. Atendente NÃO altera o status de outro
-- ---------------------------------------------------------------------------

do $$
begin
  perform public.definir_status_atendente(900002, 'disponivel', null, null);
  insert into public._rls_res values (
    'atendente não altera status de terceiro', 'bloqueado', 'FALHA: permitiu'
  );
exception when others then
  insert into public._rls_res values (
    'atendente não altera status de terceiro', 'bloqueado', 'bloqueado: ' || sqlerrm
  );
end $$;

-- ---------------------------------------------------------------------------
-- 6. Atendente não apaga nem altera auditoria
-- ---------------------------------------------------------------------------

do $$
declare
  afetadas int;
begin
  delete from public.auditoria_eventos;
  get diagnostics afetadas = row_count;
  insert into public._rls_res values (
    'atendente não apaga auditoria', 'bloqueado',
    case when afetadas = 0 then 'bloqueado (0 linhas)' else 'FALHA: apagou' end
  );
exception when others then
  insert into public._rls_res values (
    'atendente não apaga auditoria', 'bloqueado', 'bloqueado: ' || sqlerrm
  );
end $$;

do $$
declare
  afetadas int;
begin
  update public.auditoria_eventos set acao = 'adulterado';
  get diagnostics afetadas = row_count;
  insert into public._rls_res values (
    'auditoria não pode ser alterada', 'bloqueado',
    case when afetadas = 0 then 'bloqueado (0 linhas)' else 'FALHA: alterou' end
  );
exception when others then
  insert into public._rls_res values (
    'auditoria não pode ser alterada', 'bloqueado', 'bloqueado: ' || sqlerrm
  );
end $$;

-- ---------------------------------------------------------------------------
-- 7. Atendente não escreve auditoria à mão (não pode forjar evento)
-- ---------------------------------------------------------------------------

do $$
begin
  insert into public.auditoria_eventos (acao, entidade) values ('forjado', 'teste');
  insert into public._rls_res values ('atendente não forja auditoria', 'bloqueado', 'FALHA: inseriu');
exception when others then
  insert into public._rls_res values (
    'atendente não forja auditoria', 'bloqueado', 'bloqueado: ' || sqlerrm
  );
end $$;

-- ---------------------------------------------------------------------------
-- 8. Líder enxerga a equipe inteira
-- ---------------------------------------------------------------------------

reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
set local role authenticated;

insert into public._rls_res
select 'líder lê mais de um perfil', '>1',
       case when count(*) > 1 then 'ok (' || count(*) || ')' else 'FALHA: ' || count(*) end
from public.profiles;

-- Líder pode alterar status de um liderado
do $$
begin
  perform public.definir_status_atendente(900002, 'pausa', null, null);
  insert into public._rls_res values ('líder altera status da equipe', 'permitido', 'permitido');
exception when others then
  insert into public._rls_res values ('líder altera status da equipe', 'permitido', 'FALHA: ' || sqlerrm);
end $$;

-- Líder NÃO promove ninguém
do $$
declare
  afetadas int;
begin
  update public.profiles set papel = 'admin'
  where id = '00000000-0000-0000-0000-0000000000a3';
  get diagnostics afetadas = row_count;
  insert into public._rls_res values (
    'líder não altera papel de terceiro', 'bloqueado',
    case when afetadas = 0 then 'bloqueado (0 linhas)' else 'FALHA: promoveu' end
  );
exception when others then
  insert into public._rls_res values (
    'líder não altera papel de terceiro', 'bloqueado', 'bloqueado: ' || sqlerrm
  );
end $$;

-- ---------------------------------------------------------------------------
-- 9. Admin gerencia papéis
-- ---------------------------------------------------------------------------

reset role;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
set local role authenticated;

do $$
declare
  afetadas int;
begin
  update public.profiles set papel = 'lider'
  where id = '00000000-0000-0000-0000-0000000000a3';
  get diagnostics afetadas = row_count;
  insert into public._rls_res values (
    'admin altera papel', 'permitido',
    case when afetadas = 1 then 'permitido' else 'FALHA: ' || afetadas || ' linhas' end
  );
exception when others then
  insert into public._rls_res values ('admin altera papel', 'permitido', 'FALHA: ' || sqlerrm);
end $$;

-- ---------------------------------------------------------------------------
-- 10. Usuário não autenticado não lê nada
-- ---------------------------------------------------------------------------

-- As migrations revogam todo privilégio de `anon` nestas tabelas, então o
-- esperado é "permission denied" — bloqueio antes mesmo da RLS.

reset role;
set local request.jwt.claims = '';
set local role anon;

do $$
declare
  n int;
begin
  select count(*) into n from public.profiles;
  insert into public._rls_res values (
    'anon não lê perfis', 'bloqueado',
    case when n = 0 then 'bloqueado (0 linhas)' else 'FALHA: leu ' || n end
  );
exception when insufficient_privilege then
  insert into public._rls_res values ('anon não lê perfis', 'bloqueado', 'bloqueado (sem privilégio)');
end $$;

do $$
declare
  n int;
begin
  select count(*) into n from public.auditoria_eventos;
  insert into public._rls_res values (
    'anon não lê auditoria', 'bloqueado',
    case when n = 0 then 'bloqueado (0 linhas)' else 'FALHA: leu ' || n end
  );
exception when insufficient_privilege then
  insert into public._rls_res values ('anon não lê auditoria', 'bloqueado', 'bloqueado (sem privilégio)');
end $$;

-- ---------------------------------------------------------------------------
-- Resultado
-- ---------------------------------------------------------------------------

reset role;

select
  verificacao,
  esperado,
  obtido,
  case when obtido like 'FALHA%' then '❌' else '✅' end as resultado
from public._rls_res;

rollback;
