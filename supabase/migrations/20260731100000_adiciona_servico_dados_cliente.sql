-- Adiciona coluna servico na tabela dados_cliente se ainda não existir
ALTER TABLE public.dados_cliente 
ADD COLUMN IF NOT EXISTS servico text;
