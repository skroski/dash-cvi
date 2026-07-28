-- Otimização de busca, ordenação e filtros no cadastro de clientes.
create extension if not exists pg_trgm with schema extensions;

-- Índices GIN para busca parcial rápida com ILIKE em email e CPF/CNPJ
create index if not exists dados_cliente_email_trgm_idx
  on public.dados_cliente using gin (email extensions.gin_trgm_ops);

create index if not exists dados_cliente_cpf_cnpj_trgm_idx
  on public.dados_cliente using gin (cpf_cnpj extensions.gin_trgm_ops);

-- Índices B-Tree para ordenação e filtros por data de cadastro e características dos pets
create index if not exists dados_cliente_created_at_desc_idx
  on public.dados_cliente (created_at desc);

create index if not exists dados_cliente_porte_pet_idx
  on public.dados_cliente (porte_pet);

create index if not exists dados_cliente_raca_pet_idx
  on public.dados_cliente (raca_pet);
