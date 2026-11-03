-- Migration: 20261017140000_otimizacao_egress_metricas.sql
-- Objetivo: Reduzir drasticamente o Egress (tráfego de saída do Supabase) agregando
-- estatísticas de clientes e pets diretamente no PostgreSQL em vez de puxar tabelas
-- inteiras de 10k+ linhas para a memória do navegador.

-- 1. Estatísticas de raças de pets (substitui fetchAllRows de 10k linhas por ~20 linhas resumidas)
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

-- 2. Lista de raças únicas para filtros de UI (substitui download de 10k linhas)
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

-- 3. Crescimento de clientes por período agrupado no banco (evita baixar todos os registros com created_at)
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
