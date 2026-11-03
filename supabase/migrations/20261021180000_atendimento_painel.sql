-- Consultas de leitura para o painel de atendimento. As tabelas de fila ficam
-- privadas por RLS; a Edge Function autentica o usuário e chama estes RPCs
-- como service_role, sem expor payloads ou logs sensíveis ao navegador.

create or replace function public.atendimento_listar_conversas(
  p_busca text default null,
  p_limite integer default 200,
  p_offset integer default 0
)
returns table(
  session_id text,
  nome_contato text,
  ultima_mensagem_em timestamptz,
  direcao text,
  conteudo text,
  tipo text,
  ocorrido_em timestamptz,
  cliente_id bigint,
  cliente_nome text,
  cliente_email text,
  cliente_telefone text,
  nome_pet text,
  porte_pet text,
  raca_pet text,
  servico text,
  total_count bigint
)
language sql
security definer
set search_path = ''
as $$
  with conversas as (
    select c.*
    from public.atendimento_conversas c
    where nullif(trim(p_busca), '') is null
       or c.session_id ilike '%' || trim(p_busca) || '%'
       or coalesce(c.nome_contato, '') ilike '%' || trim(p_busca) || '%'
    order by c.ultima_mensagem_em desc nulls last, c.atualizado_em desc
    limit greatest(1, least(coalesce(p_limite, 200), 300))
    offset greatest(0, coalesce(p_offset, 0))
  ), contagem as (
    select count(*)::bigint as total_count
    from public.atendimento_conversas c
    where nullif(trim(p_busca), '') is null
       or c.session_id ilike '%' || trim(p_busca) || '%'
       or coalesce(c.nome_contato, '') ilike '%' || trim(p_busca) || '%'
  )
  select
    c.session_id,
    c.nome_contato,
    c.ultima_mensagem_em,
    m.direcao,
    m.conteudo,
    m.tipo,
    m.ocorrido_em,
    d.id,
    d.nome,
    d.email,
    d.telefone,
    d.nome_pet,
    d.porte_pet,
    d.raca_pet,
    d.servico,
    contagem.total_count
  from conversas c
  cross join contagem
  left join lateral (
    select x.direcao, x.conteudo, x.tipo, x.ocorrido_em
    from public.atendimento_mensagens x
    where x.session_id = c.session_id
    order by x.ocorrido_em desc, x.created_at desc
    limit 1
  ) m on true
  left join lateral (
    select x.id, x.nome, x.email, x.telefone, x.nome_pet, x.porte_pet, x.raca_pet, x.servico
    from public.dados_cliente x
    where x.sessionid = c.session_id
    order by x.id desc
    limit 1
  ) d on true
  order by c.ultima_mensagem_em desc nulls last, c.atualizado_em desc;
$$;

create or replace function public.atendimento_listar_mensagens(
  p_session_id text,
  p_limite integer default 100
)
returns table(
  id uuid,
  direcao text,
  conteudo text,
  tipo text,
  ocorrido_em timestamptz,
  mensagem_externa_id text
)
language sql
security definer
set search_path = ''
as $$
  select m.id, m.direcao, m.conteudo, m.tipo, m.ocorrido_em, m.mensagem_externa_id
  from public.atendimento_mensagens m
  where m.session_id = p_session_id
  order by m.ocorrido_em desc, m.created_at desc
  limit greatest(1, least(coalesce(p_limite, 100), 300));
$$;

revoke all on function public.atendimento_listar_conversas(text, integer, integer) from public, anon, authenticated;
revoke all on function public.atendimento_listar_mensagens(text, integer) from public, anon, authenticated;
grant execute on function public.atendimento_listar_conversas(text, integer, integer) to service_role;
grant execute on function public.atendimento_listar_mensagens(text, integer) to service_role;
