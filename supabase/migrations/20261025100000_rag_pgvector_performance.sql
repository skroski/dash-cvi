-- Migração: Sistema de RAG de Alta Performance com PGVector e Google Drive
-- Otimizações: HNSW index, funções de busca ponderada com threshold,
-- agregação de documentos no banco (sem download de vetores pesados) e estatísticas.

create extension if not exists vector with schema public;

-- Garantir colunas essenciais na tabela documents
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'documents') then
    create table public.documents (
      id bigserial primary key,
      content text not null,
      metadata jsonb not null default '{}'::jsonb,
      embedding vector(1536),
      titulo text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  else
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'documents' and column_name = 'created_at') then
      alter table public.documents add column created_at timestamptz not null default now();
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'documents' and column_name = 'updated_at') then
      alter table public.documents add column updated_at timestamptz not null default now();
    end if;
  end if;
end $$;

-- Índice HNSW ultra-rápido para busca vetorial de cosseno (muito superior a seq scan ou ivfflat sem listas suficientes)
create index if not exists documents_embedding_hnsw_idx 
  on public.documents using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Índices relacionais para busca, filtros por categoria/origem e exclusão
create index if not exists documents_titulo_idx on public.documents (titulo);
create index if not exists documents_metadata_gin_idx on public.documents using gin (metadata);
create index if not exists documents_created_at_idx on public.documents (created_at desc);

-- Remove quaisquer versões anteriores/sobrecarregadas de match_documents para evitar conflitos de assinatura (SQLSTATE 42725)
do $$
declare
  r record;
begin
  for r in (
    select oid::regprocedure::text as func_signature
    from pg_proc
    where proname = 'match_documents'
      and pronamespace = 'public'::regnamespace
  ) loop
    execute 'drop function if exists ' || r.func_signature || ' cascade';
  end loop;
end $$;

-- RPC match_documents aprimorada: suporta threshold de similaridade, filtro por metadata e limitação segura
create or replace function public.match_documents (
  query_embedding vector(1536),
  match_count int default 6,
  filter jsonb default '{}'::jsonb,
  similarity_threshold float default 0.25
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select
    d.id,
    d.content,
    d.metadata,
    (1 - (d.embedding <=> query_embedding))::float as similarity
  from public.documents d
  where
    d.embedding is not null
    and (filter = '{}'::jsonb or d.metadata @> filter)
    and (1 - (d.embedding <=> query_embedding)) >= similarity_threshold
  order by d.embedding <=> query_embedding
  limit greatest(1, least(match_count, 100));
end;
$$;

-- RPC listar_documentos_resumo: agrega no PostgreSQL para resposta instantânea e leve
create or replace function public.listar_documentos_resumo()
returns table (
  titulo text,
  categoria text,
  origem text,
  drive_id text,
  total_partes bigint,
  total_caracteres bigint,
  criado_em timestamptz,
  atualizado_em timestamptz,
  primeiro_id bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(nullif(d.titulo, ''), 'Documento sem título') as titulo,
    coalesce(max(d.metadata->>'categoria'), 'Geral') as categoria,
    coalesce(max(d.metadata->>'origem'), 'upload') as origem,
    max(d.metadata->>'drive_id') as drive_id,
    count(*)::bigint as total_partes,
    coalesce(sum(length(d.content)), 0)::bigint as total_caracteres,
    min(d.created_at) as criado_em,
    max(coalesce(d.updated_at, d.created_at)) as atualizado_em,
    min(d.id)::bigint as primeiro_id
  from public.documents d
  group by coalesce(nullif(d.titulo, ''), 'Documento sem título')
  order by max(coalesce(d.updated_at, d.created_at)) desc nulls last;
$$;

-- RPC obter_chunks_documento: retorna os fragmentos de um documento para inspeção no frontend
create or replace function public.obter_chunks_documento(p_titulo text)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.id,
    d.content,
    d.metadata,
    d.created_at
  from public.documents d
  where d.titulo = p_titulo
  order by d.id asc
  limit 100;
$$;

-- RPC obter_estatisticas_rag: métricas em tempo real para o dashboard
create or replace function public.obter_estatisticas_rag()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total_docs bigint;
  v_total_chunks bigint;
  v_total_chars bigint;
  v_origens jsonb;
  v_categorias jsonb;
begin
  select
    count(distinct coalesce(nullif(titulo, ''), 'Documento sem título')),
    count(*),
    coalesce(sum(length(content)), 0)
  into v_total_docs, v_total_chunks, v_total_chars
  from public.documents;

  select coalesce(jsonb_object_agg(origem, total), '{}'::jsonb)
  into v_origens
  from (
    select coalesce(metadata->>'origem', 'upload') as origem, count(*) as total
    from public.documents
    group by coalesce(metadata->>'origem', 'upload')
  ) o;

  select coalesce(jsonb_object_agg(categoria, total), '{}'::jsonb)
  into v_categorias
  from (
    select coalesce(metadata->>'categoria', 'Geral') as categoria, count(distinct coalesce(nullif(titulo, ''), 'Documento sem título')) as total
    from public.documents
    group by coalesce(metadata->>'categoria', 'Geral')
  ) c;

  return jsonb_build_object(
    'total_documentos', v_total_docs,
    'total_chunks', v_total_chunks,
    'total_caracteres', v_total_chars,
    'origens', v_origens,
    'categorias', v_categorias
  );
end;
$$;

-- Segurança: apenas Edge Functions com Service Role ou usuários gestores autorizados
do $$
declare
  r record;
begin
  for r in (
    select oid::regprocedure::text as func_signature
    from pg_proc
    where proname = 'match_documents'
      and pronamespace = 'public'::regnamespace
  ) loop
    execute 'revoke all on function ' || r.func_signature || ' from public, anon';
    execute 'grant execute on function ' || r.func_signature || ' to service_role, authenticated';
  end loop;
end $$;

revoke all on function public.listar_documentos_resumo from public, anon;
grant execute on function public.listar_documentos_resumo to service_role, authenticated;

revoke all on function public.obter_chunks_documento from public, anon;
grant execute on function public.obter_chunks_documento to service_role, authenticated;

revoke all on function public.obter_estatisticas_rag from public, anon;
grant execute on function public.obter_estatisticas_rag to service_role, authenticated;

comment on table public.documents is
  'Base de conhecimento RAG indexada com PGVector (HNSW). Gerenciada pela Edge Function conhecimento e consultada pelos bots e painel.';
