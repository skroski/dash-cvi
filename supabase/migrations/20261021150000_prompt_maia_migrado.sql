-- Amplia o limite de tamanho do prompt versionado (um prompt completo, com catálogo de
-- serviços e regras da clínica, passa do limite antigo do formulário).
-- O conteúdo do prompt de cada clínica NÃO é semeado aqui: ele nasce das regras de
-- Meu Prompt (modelo genérico em 20261027100000) e dos seeds de supabase/seeds/.

alter table public.meu_prompt_versoes
  drop constraint if exists meu_prompt_versoes_conteudo_check;
alter table public.meu_prompt_versoes
  add constraint meu_prompt_versoes_conteudo_check
  check (char_length(conteudo) between 1 and 100000);
