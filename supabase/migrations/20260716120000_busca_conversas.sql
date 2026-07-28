-- Busca global e paginação eficiente da lista de conversas.
--
-- A consulta anterior precisava varrer o histórico em lotes no navegador para
-- descobrir os session_ids únicos. Além de repetir trabalho a cada página, a
-- busca só enxergava as conversas que já tinham sido carregadas.

create extension if not exists pg_trgm with schema extensions;

create index if not exists n8n_chat_histories_session_id_id_desc_idx
  on public.n8n_chat_histories (session_id, id desc);

create index if not exists dados_cliente_sessionid_idx
  on public.dados_cliente (sessionid);

create index if not exists dados_cliente_nome_trgm_idx
  on public.dados_cliente using gin (nome extensions.gin_trgm_ops);

create index if not exists dados_cliente_telefone_trgm_idx
  on public.dados_cliente using gin (telefone extensions.gin_trgm_ops);

create index if not exists dados_cliente_nome_pet_trgm_idx
  on public.dados_cliente using gin (nome_pet extensions.gin_trgm_ops);

create or replace function public.search_conversations(
  p_search text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  session_id text,
  latest_id bigint,
  message jsonb,
  message_date text,
  client_id bigint,
  client_name text,
  client_phone text,
  client_email text,
  pet_name text,
  pet_size text,
  pet_breed text,
  cpf_cnpj text,
  service text,
  asaas_customer_id text,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with search_params as (
    select nullif(btrim(p_search), '') as term
  ),
  matching_sessions as (
    select customer.sessionid as session_id
    from public.dados_cliente as customer
    cross join search_params
    where search_params.term is not null
      and customer.sessionid is not null
      and (
        customer.nome ilike ('%' || search_params.term || '%')
        or customer.telefone ilike ('%' || search_params.term || '%')
        or customer.nome_pet ilike ('%' || search_params.term || '%')
      )
    group by customer.sessionid

    union

    select history.session_id
    from public.n8n_chat_histories as history
    cross join search_params
    where search_params.term is not null
      and history.session_id ilike ('%' || search_params.term || '%')
    group by history.session_id
  ),
  all_latest_histories as (
    select distinct on (history.session_id)
      history.session_id,
      history.id::bigint as latest_id,
      history.message::jsonb as message,
      history.data::text as message_date
    from public.n8n_chat_histories as history
    cross join search_params
    where history.session_id is not null
      and search_params.term is null
    order by history.session_id, history.id desc
  ),
  searched_latest_histories as (
    select
      matching_sessions.session_id,
      latest.latest_id,
      latest.message,
      latest.message_date
    from matching_sessions
    cross join lateral (
      select
        history.id::bigint as latest_id,
        history.message::jsonb as message,
        history.data::text as message_date
      from public.n8n_chat_histories as history
      where history.session_id = matching_sessions.session_id
      order by history.id desc
      limit 1
    ) as latest
  ),
  latest_histories as (
    select * from all_latest_histories
    union all
    select * from searched_latest_histories
  ),
  matching_conversations as (
    select
      latest.session_id,
      latest.latest_id,
      latest.message,
      latest.message_date,
      client.id::bigint as client_id,
      client.nome as client_name,
      client.telefone as client_phone,
      client.email as client_email,
      client.nome_pet as pet_name,
      client.porte_pet as pet_size,
      client.raca_pet as pet_breed,
      client.cpf_cnpj,
      client.servico as service,
      client.asaas_customer_id
    from latest_histories as latest
    left join lateral (
      select customer.*
      from public.dados_cliente as customer
      where customer.sessionid = latest.session_id
      order by customer.id desc
      limit 1
    ) as client on true
  )
  select
    matching.session_id,
    matching.latest_id,
    matching.message,
    matching.message_date,
    matching.client_id,
    matching.client_name,
    matching.client_phone,
    matching.client_email,
    matching.pet_name,
    matching.pet_size,
    matching.pet_breed,
    matching.cpf_cnpj,
    matching.service,
    matching.asaas_customer_id,
    count(*) over ()::bigint as total_count
  from matching_conversations as matching
  order by matching.latest_id desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

grant execute on function public.search_conversations(text, integer, integer)
  to anon, authenticated;
