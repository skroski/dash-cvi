-- Acionador idempotente para os workers do atendimento. O agendamento no
-- pg_cron só deve ser habilitado no cutover controlado (webhook já validado).

create or replace function public.atendimento_tick()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_worker_url text;
  v_outbox_url text;
  v_secret text;
  v_has_lotes boolean;
  v_has_outbox boolean;
begin
  select exists(
    select 1 from public.atendimento_lotes
    where estado = 'pending' and proximo_processamento_em <= now()
  ) into v_has_lotes;
  select exists(
    select 1 from public.atendimento_outbox
    where estado = 'pending' and proxima_tentativa_em <= now()
  ) into v_has_outbox;
  if not v_has_lotes and not v_has_outbox then return; end if;

  begin
    select decrypted_secret into v_worker_url from vault.decrypted_secrets where name = 'atendimento_worker_url';
    select decrypted_secret into v_outbox_url from vault.decrypted_secrets where name = 'atendimento_outbox_url';
    select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'atendimento_cron_secret';
  exception when others then
    v_worker_url := null;
    v_outbox_url := null;
    v_secret := null;
  end;

  if v_secret is null or (v_has_lotes and v_worker_url is null) or (v_has_outbox and v_outbox_url is null) then
    insert into public.atendimento_erros (funcao, codigo, detalhe_seguro)
    select 'atendimento-tick', 'vault_ausente', 'URLs ou segredo do worker não configurados'
    where not exists (
      select 1 from public.atendimento_erros
      where funcao = 'atendimento-tick' and codigo = 'vault_ausente' and created_at > now() - interval '1 hour'
    );
    return;
  end if;

  if v_has_lotes then
    perform net.http_post(
      url := v_worker_url,
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Internal-Secret', v_secret),
      timeout_milliseconds := 10000
    );
  end if;
  if v_has_outbox then
    perform net.http_post(
      url := v_outbox_url,
      body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'X-Internal-Secret', v_secret),
      timeout_milliseconds := 10000
    );
  end if;
end;
$$;

revoke all on function public.atendimento_tick() from public, anon, authenticated;
grant execute on function public.atendimento_tick() to service_role;
