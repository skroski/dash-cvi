-- Adiciona coluna status (boolean) na tabela public.dados_cliente
-- Default true para que todos os clientes existentes e novos sejam considerados Ativos (true)
alter table public.dados_cliente
  add column if not exists status boolean not null default true;

-- Índice para acelerar filtros e ordenação por status na grid
create index if not exists dados_cliente_status_idx
  on public.dados_cliente (status);

comment on column public.dados_cliente.status is 'Status do cliente: true = Ativo, false = Inativo';
