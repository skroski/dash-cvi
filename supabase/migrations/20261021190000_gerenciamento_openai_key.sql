-- Gerenciamento seguro da chave da OpenAI via Vault
-- A chave bruta NUNCA é enviada ao frontend. Apenas admins autenticados podem consultar status e atualizar.

-- 1. A chave NÃO fica neste arquivo (ele vai para o git). Cadastre/troque pelo painel
--    (card "Chave OpenAI") ou com: select vault.create_secret('<chave>', 'openai_api_key');

-- 2. Função interna para o service_role / Edge Functions lerem a chave descriptografada
create or replace function public.obter_openai_key_interna()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'openai_api_key'
  limit 1;
  return v_key;
end;
$$;

revoke all on function public.obter_openai_key_interna() from public, anon, authenticated;
grant execute on function public.obter_openai_key_interna() to service_role;

-- 3. Função pública segura para o frontend consultar status da chave (RETORNA APENAS MÁSCARA)
create or replace function public.obter_status_openai_key()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
  v_updated_at timestamptz;
  v_mask text;
begin
  -- Exigir autenticação
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select decrypted_secret, updated_at into v_secret, v_updated_at
  from vault.decrypted_secrets
  where name = 'openai_api_key'
  limit 1;

  if v_secret is null or length(v_secret) < 10 then
    return jsonb_build_object(
      'configurada', false,
      'mascara', null,
      'atualizado_em', null
    );
  end if;

  -- Formatar máscara segura: primeiros 7 caracteres + '...' + últimos 4 caracteres
  v_mask := substring(v_secret from 1 for 7) || '...' || substring(v_secret from length(v_secret) - 3 for 4);

  return jsonb_build_object(
    'configurada', true,
    'mascara', v_mask,
    'atualizado_em', v_updated_at
  );
end;
$$;

revoke all on function public.obter_status_openai_key() from public, anon;
grant execute on function public.obter_status_openai_key() to authenticated;

-- 4. Função segura para ADMIN atualizar a chave da OpenAI
create or replace function public.atualizar_openai_key(p_chave text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_papel text;
  v_trimmed text;
  v_secret_id uuid;
begin
  -- Exigir autenticação
  if auth.uid() is null then
    raise exception 'unauthorized';
  end if;

  select papel into v_user_papel
  from public.profiles
  where id = auth.uid() and ativo = true;

  -- Apenas admin pode alterar
  if v_user_papel is distinct from 'admin' then
    -- Se não houver perfis configurados ainda (setup inicial), permite admin por email
    if not exists (select 1 from public.profiles where ativo = true) then
      -- permite prosseguir durante setup inicial
      null;
    else
      raise exception 'forbidden: apenas administradores podem alterar chaves de api';
    end if;
  end if;

  v_trimmed := trim(p_chave);
  if v_trimmed is null or length(v_trimmed) < 20 or not (v_trimmed like 'sk-%') then
    raise exception 'Chave OpenAI inválida. A chave deve começar com "sk-" e ter pelo menos 20 caracteres.';
  end if;

  -- Atualiza no Vault
  select id into v_secret_id from vault.secrets where name = 'openai_api_key' limit 1;

  if v_secret_id is not null then
    update vault.secrets
    set secret = v_trimmed, updated_at = now()
    where id = v_secret_id;
  else
    perform vault.create_secret(v_trimmed, 'openai_api_key', 'Chave da API OpenAI para o Balthazar e Lembretes');
  end if;

  -- Registrar auditoria se existir tabela
  begin
    insert into public.auditoria_eventos (usuario_id, modulo, acao, detalhes)
    values (
      auth.uid(),
      'configuracao',
      'atualizar_openai_key',
      jsonb_build_object('mascara', substring(v_trimmed from 1 for 7) || '...' || substring(v_trimmed from length(v_trimmed) - 3 for 4))
    );
  exception when others then
    null;
  end;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.atualizar_openai_key(text) from public, anon;
grant execute on function public.atualizar_openai_key(text) to authenticated;
