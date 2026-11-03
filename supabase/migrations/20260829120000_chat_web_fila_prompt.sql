-- Chat Web, fila presencial e editor de prompt.
-- As regras de transição e a permissão do prompt vivem no banco; a UI apenas
-- apresenta os recursos que o usuário já pode executar.

create table if not exists public.chat_web_categorias (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,
  rotulo text not null,
  icone text,
  opcoes jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_web_conversas (
  id uuid primary key default gen_random_uuid(),
  codigo text unique,
  nome_tutor text not null,
  nome_pet text,
  telefone text,
  session_id text,
  status text not null default 'aberta' check (status in ('aberta','aguardando','resolvida','arquivada')),
  categoria_id uuid references public.chat_web_categorias(id) on delete set null,
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists chat_web_conversas_codigo_idx on public.chat_web_conversas(codigo);
create index if not exists chat_web_conversas_telefone_idx on public.chat_web_conversas(telefone);
create index if not exists chat_web_conversas_session_idx on public.chat_web_conversas(session_id);

create table if not exists public.chat_web_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.chat_web_conversas(id) on delete cascade,
  conteudo text not null check (char_length(conteudo) between 1 and 8000),
  direcao text not null check (direcao in ('recebida','enviada')),
  categoria_id uuid references public.chat_web_categorias(id) on delete set null,
  opcao_chave text,
  enviado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists chat_web_mensagens_conversa_idx on public.chat_web_mensagens(conversa_id, created_at);

-- Configuração de fila é aberta a gestores; itens são manipulados por RPC.
create table if not exists public.fila_servicos (
  id uuid primary key default gen_random_uuid(), nome text not null unique, prefixo text not null default 'A', ativo boolean not null default true,
  ordem integer not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.fila_salas (
  id uuid primary key default gen_random_uuid(), nome text not null unique, ativa boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.fila_itens (
  id uuid primary key default gen_random_uuid(), senha text not null unique,
  servico_id uuid not null references public.fila_servicos(id), sala_id uuid references public.fila_salas(id),
  tutor_nome text not null, pet_nome text, veterinario_nome text,
  prioridade text not null default 'normal' check (prioridade in ('normal','prioridade','emergencia')),
  status text not null default 'aguardando' check (status in ('aguardando','chamado','em_atendimento','finalizado','ausente','cancelado')),
  chegada_em timestamptz not null default now(), chamado_em timestamptz, iniciado_em timestamptz, finalizado_em timestamptz,
  criado_por uuid references auth.users(id), updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create index if not exists fila_itens_ordenacao_idx on public.fila_itens(status, prioridade, chegada_em);
create table if not exists public.fila_chamadas (
  id uuid primary key default gen_random_uuid(), item_id uuid not null references public.fila_itens(id) on delete cascade,
  sala_id uuid references public.fila_salas(id), chamado_por uuid references auth.users(id), created_at timestamptz not null default now()
);

create table if not exists public.meu_prompt_versoes (
  id uuid primary key default gen_random_uuid(), conteudo text not null check (char_length(conteudo) between 1 and 50000),
  versao integer not null unique, criado_por uuid references auth.users(id), criado_em timestamptz not null default now()
);

-- A senha nasce no banco, serializada por prefixo. Assim duas recepções não
-- podem gerar A023 ao mesmo tempo e o navegador não define a numeração.
create or replace function public.adicionar_item_fila(
  p_servico_id uuid, p_tutor_nome text, p_pet_nome text default null,
  p_veterinario_nome text default null, p_prioridade text default 'normal'
) returns public.fila_itens language plpgsql security definer set search_path = '' as $$
declare v_prefixo text; v_numero integer; v_item public.fila_itens;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.ativo) then
    raise exception 'Não autorizado' using errcode = '42501';
  end if;
  if nullif(trim(p_tutor_nome), '') is null then raise exception 'Nome do tutor é obrigatório' using errcode = '22023'; end if;
  if p_prioridade not in ('normal','prioridade','emergencia') then raise exception 'Prioridade inválida' using errcode = '22023'; end if;
  select prefixo into v_prefixo from public.fila_servicos where id = p_servico_id and ativo;
  if v_prefixo is null then raise exception 'Serviço indisponível' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext(v_prefixo));
  select coalesce(max(nullif(regexp_replace(i.senha, '\D', '', 'g'), '')::integer), 0) + 1 into v_numero
    from public.fila_itens i join public.fila_servicos s on s.id = i.servico_id where s.prefixo = v_prefixo;
  insert into public.fila_itens (senha, servico_id, tutor_nome, pet_nome, veterinario_nome, prioridade, criado_por)
  values (v_prefixo || lpad(v_numero::text, 3, '0'), p_servico_id, trim(p_tutor_nome), nullif(trim(p_pet_nome), ''), nullif(trim(p_veterinario_nome), ''), p_prioridade, auth.uid())
  returning * into v_item;
  return v_item;
end $$;
revoke all on function public.adicionar_item_fila(uuid,text,text,text,text) from public, anon;
grant execute on function public.adicionar_item_fila(uuid,text,text,text,text) to authenticated;

create or replace function public.pode_editar_meu_prompt()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    join public.profiles p on p.id = u.id and p.ativo
    where u.id = auth.uid() and lower(u.email) = 'danielskroski@gmail.com'
  )
$$;
revoke all on function public.pode_editar_meu_prompt() from public, anon;
grant execute on function public.pode_editar_meu_prompt() to authenticated;

-- Centraliza transições, registra chamada e resolve os horários no servidor.
create or replace function public.alterar_status_fila(p_item_id uuid, p_acao text, p_sala_id uuid default null)
returns public.fila_itens language plpgsql security definer set search_path = '' as $$
declare v_item public.fila_itens; v_proximo text;
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.ativo) then raise exception 'Não autorizado' using errcode = '42501'; end if;
  select * into v_item from public.fila_itens where id = p_item_id for update;
  if not found then raise exception 'Item da fila não encontrado' using errcode = 'P0002'; end if;
  case p_acao
    when 'chamar' then v_proximo := 'chamado'; v_item.chamado_em := now();
    when 'iniciar' then v_proximo := 'em_atendimento'; v_item.iniciado_em := now();
    when 'finalizar' then v_proximo := 'finalizado'; v_item.finalizado_em := now();
    when 'ausente' then v_proximo := 'ausente';
    when 'retornar' then v_proximo := 'aguardando'; v_item.chamado_em := null;
    when 'cancelar' then v_proximo := 'cancelado';
    else raise exception 'Ação de fila inválida' using errcode = '22023';
  end case;
  update public.fila_itens set status = v_proximo, sala_id = coalesce(p_sala_id, sala_id), chamado_em = v_item.chamado_em, iniciado_em = v_item.iniciado_em, finalizado_em = v_item.finalizado_em, updated_at = now() where id = p_item_id returning * into v_item;
  if p_acao = 'chamar' then insert into public.fila_chamadas(item_id, sala_id, chamado_por) values (p_item_id, v_item.sala_id, auth.uid()); end if;
  return v_item;
end $$;
revoke all on function public.alterar_status_fila(uuid,text,uuid) from public, anon;
grant execute on function public.alterar_status_fila(uuid,text,uuid) to authenticated;

-- Visão pública mínima: não expõe telefone, tutor ou dados clínicos.
create or replace function public.fila_tv_estado()
returns table(senha text, pet_nome text, veterinario_nome text, sala text, status text, chamado_em timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.senha, i.pet_nome, i.veterinario_nome, s.nome, i.status, i.chamado_em
  from public.fila_itens i left join public.fila_salas s on s.id = i.sala_id
  where i.status in ('chamado','aguardando') order by case i.status when 'chamado' then 0 else 1 end, i.chegada_em asc limit 6
$$;
grant execute on function public.fila_tv_estado() to anon, authenticated;

alter table public.chat_web_categorias enable row level security;
alter table public.chat_web_conversas enable row level security;
alter table public.chat_web_mensagens enable row level security;
alter table public.fila_servicos enable row level security;
alter table public.fila_salas enable row level security;
alter table public.fila_itens enable row level security;
alter table public.fila_chamadas enable row level security;
alter table public.meu_prompt_versoes enable row level security;

create policy "chat web equipe le" on public.chat_web_categorias for select to authenticated using (true);
create policy "chat web gestores configuram" on public.chat_web_categorias for all to authenticated using (public.sou_gestor()) with check (public.sou_gestor());
create policy "chat web equipe conversa" on public.chat_web_conversas for select to authenticated using (true);
create policy "chat web equipe cria conversa" on public.chat_web_conversas for insert to authenticated with check (created_by = auth.uid());
create policy "chat web equipe atualiza conversa" on public.chat_web_conversas for update to authenticated using (true) with check (true);
create policy "chat web equipe le mensagens" on public.chat_web_mensagens for select to authenticated using (true);
create policy "chat web equipe envia" on public.chat_web_mensagens for insert to authenticated with check (direcao = 'enviada' and enviado_por = auth.uid());
create policy "fila equipe le servicos" on public.fila_servicos for select to authenticated using (true);
create policy "fila gestor configura servicos" on public.fila_servicos for all to authenticated using (public.sou_gestor()) with check (public.sou_gestor());
create policy "fila equipe le salas" on public.fila_salas for select to authenticated using (true);
create policy "fila gestor configura salas" on public.fila_salas for all to authenticated using (public.sou_gestor()) with check (public.sou_gestor());
create policy "fila equipe le itens" on public.fila_itens for select to authenticated using (true);
create policy "fila equipe cria itens" on public.fila_itens for insert to authenticated with check (criado_por = auth.uid());
create policy "fila equipe le chamadas" on public.fila_chamadas for select to authenticated using (true);
create policy "prompt autorizado le" on public.meu_prompt_versoes for select to authenticated using (public.pode_editar_meu_prompt());
create policy "prompt autorizado escreve" on public.meu_prompt_versoes for insert to authenticated with check (public.pode_editar_meu_prompt() and criado_por = auth.uid());

grant select, insert, update on public.chat_web_categorias, public.chat_web_conversas, public.chat_web_mensagens to authenticated;
grant select on public.fila_servicos, public.fila_salas, public.fila_itens, public.fila_chamadas to authenticated;
grant insert on public.fila_itens to authenticated;
grant select, insert on public.meu_prompt_versoes to authenticated;
revoke all on public.chat_web_categorias, public.chat_web_conversas, public.chat_web_mensagens, public.fila_servicos, public.fila_salas, public.fila_itens, public.fila_chamadas, public.meu_prompt_versoes from anon;

insert into public.chat_web_categorias(chave,rotulo,icone,ordem,opcoes) values
 ('clinica_veterinaria','Clínica Veterinária','🐶',1,'[{"id":"consulta","label":"Consulta","perguntas":["Quero agendar uma consulta","Quais horários estão disponíveis?"]},{"id":"vacinacao","label":"Vacinação","perguntas":["Quero saber sobre vacinação"]},{"id":"emergencia","label":"Emergência","perguntas":["Preciso de atendimento urgente"]}]')
on conflict (chave) do nothing;
insert into public.fila_servicos(nome,prefixo,ordem) values ('Consulta','A',1),('Retorno','B',2),('Vacinação','C',3),('Exames','E',4),('Emergência','X',0) on conflict (nome) do nothing;
insert into public.fila_salas(nome) values ('Sala 01'),('Sala 02'),('Recepção') on conflict (nome) do nothing;

alter publication supabase_realtime add table public.chat_web_conversas, public.chat_web_mensagens, public.fila_itens, public.fila_chamadas;
