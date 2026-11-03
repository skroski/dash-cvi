-- A base vetorial já existia no projeto, mas seu gerenciamento dependia de
-- webhooks do n8n. A escrita e a leitura operacional passam pela Edge Function
-- `conhecimento`; o browser não recebe mais privilégio direto sobre embeddings.
alter table if exists public.documents enable row level security;

revoke all on table public.documents from anon;
revoke all on table public.documents from authenticated;

comment on table public.documents is
  'Base RAG gerenciada exclusivamente pela Edge Function conhecimento; embeddings e conteúdo não são expostos diretamente ao navegador.';
