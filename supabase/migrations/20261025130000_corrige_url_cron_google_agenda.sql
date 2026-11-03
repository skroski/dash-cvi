-- A migração 20260924161500 apontava a sincronização do Google Agenda para outro projeto
-- (napeofeenweerjhqucua). Reaponta função e cron para este projeto (napeofeenweerjhqucua).
-- Só troca a URL; o restante do comportamento permanece igual.

create or replace function public.trigger_google_calendar_sync()
returns jsonb
language plpgsql
security definer
as $$
declare
  v_url text := 'https://napeofeenweerjhqucua.supabase.co/functions/v1/sync-google-calendar';
begin
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('source', 'pg_trigger_rpc', 'triggered_at', now())
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Sincronização assíncrona disparada no servidor com sucesso.',
    'timestamp', now()
  );
exception when others then
  return jsonb_build_object('success', false, 'error', SQLERRM, 'timestamp', now());
end;
$$;

grant execute on function public.trigger_google_calendar_sync() to anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_tables where schemaname = 'cron' and tablename = 'job') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'sync-google-calendar-10-min';
    perform cron.schedule(
      'sync-google-calendar-10-min',
      '*/10 * * * *',
      $cron$
      select net.http_post(
        url := 'https://napeofeenweerjhqucua.supabase.co/functions/v1/sync-google-calendar',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object('source', 'pg_cron_10m')
      );
      $cron$
    );
  end if;
exception when others then
  raise notice 'Aviso ao reagendar pg_cron: %', SQLERRM;
end $$;
