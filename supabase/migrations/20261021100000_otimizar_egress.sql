-- ==============================================================================
-- TEMPLATE DE MIGRAÇÃO SQL: OTIMIZAÇÃO DE EGRESS DO SUPABASE
-- ==============================================================================
-- Objetivo: Reduzir em até 95% o Database Egress do Supabase agregando contagens,
-- raças e métricas diretamente no PostgreSQL, evitando que o frontend baixe
-- tabelas de 10k+ linhas (dados_cliente, atendimentos, n8n_chat_histories)
-- para processar estatísticas em memória do navegador.
-- ==============================================================================

-- 1. Estatísticas agrupadas de raças de pets
-- Substitui o fetchAllRows de todas as linhas de dados_cliente por ~20 linhas resumidas
create or replace function public.get_pet_breed_stats()
returns table (
  name text,
  value bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    raca_pet as name,
    count(*)::bigint as value
  from public.dados_cliente
  where raca_pet is not null and btrim(raca_pet) <> ''
  group by raca_pet
  order by value desc;
$$;

grant execute on function public.get_pet_breed_stats() to anon, authenticated, service_role;

-- 2. Lista de raças únicas para filtros de UI (Combobox / Select de clientes)
-- Retorna apenas os nomes distintos sem trafegar colunas ou duplicatas
create or replace function public.get_distinct_pet_breeds()
returns table (
  breed text
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct raca_pet as breed
  from public.dados_cliente
  where raca_pet is not null and btrim(raca_pet) <> ''
  order by breed asc;
$$;

grant execute on function public.get_distinct_pet_breeds() to anon, authenticated, service_role;

-- 3. Agrupamento de crescimento de clientes por mês
-- Evita puxar todas as datas de criação da tabela dados_cliente
create or replace function public.get_client_growth_stats(p_start_date timestamptz)
returns table (
  bucket text,
  count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    to_char(created_at, 'YYYY-MM') as bucket,
    count(*)::bigint as count
  from public.dados_cliente
  where created_at >= p_start_date
  group by to_char(created_at, 'YYYY-MM')
  order by bucket asc;
$$;

grant execute on function public.get_client_growth_stats(timestamptz) to anon, authenticated, service_role;

-- 4. Índices para acelerar consultas de histórico de chat e clientes sem varredura sequencial
create index if not exists n8n_chat_histories_session_data_idx
  on public.n8n_chat_histories (session_id, data desc);

create index if not exists dados_cliente_created_at_idx
  on public.dados_cliente (created_at desc);

create index if not exists dados_cliente_raca_pet_idx
  on public.dados_cliente (raca_pet)
  where raca_pet is not null;
