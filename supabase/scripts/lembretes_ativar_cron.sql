-- ATIVAÇÃO DO ENVIO DE LEMBRETES (cutover). Rode no SQL Editor do Supabase
-- do projeto SOMENTE depois de seguir docs/lembretes-implantacao.md (migração
-- aplicada, edge function publicada, segredos cadastrados e teste aprovado).
--
-- Rollback imediato: supabase/scripts/lembretes_desativar_cron.sql

-- 1. Extensões (já vêm ligadas na maioria dos projetos).
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- 2. Segredos no Vault. Troque os dois valores antes de rodar.
--    <SEGREDO> deve ser IGUAL ao LEMBRETES_CRON_SECRET da edge function.
--    Para trocar um segredo já criado, use vault.update_secret.
select vault.create_secret(
  'https://napeofeenweerjhqucua.supabase.co/functions/v1/lembretes',
  'lembretes_function_url',
  'URL da edge function de lembretes'
)
where not exists (select 1 from vault.secrets where name = 'lembretes_function_url');

select vault.create_secret(
  '<SEGREDO>',
  'lembretes_cron_secret',
  'Segredo enviado no header X-Cron-Secret para a edge function de lembretes'
)
where not exists (select 1 from vault.secrets where name = 'lembretes_cron_secret');

-- 3. Job a cada minuto (o pg_cron roda em UTC; o horário de cada regra é
--    comparado em America/Sao_Paulo dentro de lembretes_planejar()).
select cron.unschedule('lembretes-worker')
where exists (select 1 from cron.job where jobname = 'lembretes-worker');
select cron.schedule('lembretes-worker', '* * * * *', $$select public.lembretes_tick();$$);

-- 4. Conferência: deve listar o job ativo.
select jobid, jobname, schedule, active from cron.job where jobname = 'lembretes-worker';

-- O envio AUTOMÁTICO continua desligado até alguém ligar a chave
-- "Envio automático" no painel (lembrete_ajustes.envio_automatico).
-- Com o cron ativo e a chave desligada, só saem testes e envios manuais.
