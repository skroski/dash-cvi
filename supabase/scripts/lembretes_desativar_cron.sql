-- ROLLBACK DO ENVIO DE LEMBRETES. Para imediatamente qualquer envio.
-- Nada é apagado: agenda, mensagens e histórico continuam no banco.

-- 1. Desliga o envio automático (o painel mostra a chave desligada).
update public.lembrete_ajustes set envio_automatico = false where id = 1;

-- 2. Remove o job do pg_cron.
select cron.unschedule('lembretes-worker')
where exists (select 1 from cron.job where jobname = 'lembretes-worker');

-- 3. (Opcional) Cancela o que ainda estava na fila.
-- update public.lembrete_mensagens set status = 'cancelado' where status = 'pendente';

-- Para voltar a enviar: rode de novo supabase/scripts/lembretes_ativar_cron.sql
-- (os segredos do Vault já existem e são mantidos).
