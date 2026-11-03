-- Configuração agnóstica do atendimento.
--
-- Move para o banco (e para o painel) o que antes estava fixo em código ou nos
-- workflows n8n: dados da empresa, estados/classificação do atendimento,
-- destinatários de notificação, tipos de agendamento (biblioteca) e modelos de
-- agenda. Tudo é idempotente. NENHUM dado de cliente é semeado aqui (isso fica em
-- supabase/seeds/); os estados de fábrica são genéricos.
--
-- Hierarquia de configuração (o mais específico vence):
--   atendimento_config (global)  ->  agenda_especialidades (tipo)
--   ->  agenda_regras (profissional x tipo)
-- Isolamento entre clientes: um projeto Supabase por cliente (não há tenant_id).

-- ---------------------------------------------------------------------------
-- 1. Configuração global da empresa/assistente (singleton)
-- ---------------------------------------------------------------------------

create table if not exists public.atendimento_config (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  nome_empresa text not null default 'Minha empresa'
    check (char_length(btrim(nome_empresa)) between 1 and 120),
  nome_assistente text not null default 'Assistente'
    check (char_length(btrim(nome_assistente)) between 1 and 60),
  telefone_contato text check (telefone_contato is null or char_length(telefone_contato) <= 40),
  codigo_pais text not null default '55' check (codigo_pais ~ '^[0-9]{1,3}$'),
  fuso_horario text not null default 'America/Sao_Paulo',
  -- Vazio = usa o secret MAIA_OPENAI_MODEL e, por fim, o padrão do worker.
  modelo_ia text check (modelo_ia is null or modelo_ia ~ '^[A-Za-z0-9._:-]{2,80}$'),
  -- Detecção de loop robô x robô (URA/operadora). Expressões regulares (JS, sem flags).
  padroes_loop_bot text[] not null default array[
    '\btim\b', '\bprotocolo\b', '\bop[cç][aã]o inv[aá]lida\b',
    '\bcomando inv[aá]lido\b', '\bdigite \d\b', '\bresponda \d\b'
  ],
  loop_bot_minimo_respostas smallint not null default 3 check (loop_bot_minimo_respostas between 1 and 20),
  loop_bot_pausa_dias smallint not null default 30 check (loop_bot_pausa_dias between 1 and 365),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

-- Linha única com os padrões neutros; o nome da empresa e do assistente são preenchidos no painel.
insert into public.atendimento_config (singleton) values (true)
on conflict (singleton) do nothing;

-- ---------------------------------------------------------------------------
-- 2. Estados do atendimento (classificação) e seus efeitos
-- ---------------------------------------------------------------------------

create table if not exists public.atendimento_estados (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique check (chave ~ '^[a-z][a-z0-9_]{1,63}$'),
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  descricao text,
  -- padrao: estado quando nada mais se aplica | mensagem_cliente: um classificador
  -- (LLM) lê a mensagem do cliente | resposta_assistente: a resposta do bot contém
  -- uma frase-gatilho | manual: só é aplicado por pessoas (painel).
  deteccao text not null check (deteccao in ('padrao', 'mensagem_cliente', 'resposta_assistente', 'manual')),
  criterios text check (criterios is null or char_length(criterios) <= 8000),
  frase_gatilho text check (frase_gatilho is null or char_length(frase_gatilho) between 3 and 300),
  pausar_bot boolean not null default false,
  pausa_horas smallint check (pausa_horas is null or pausa_horas between 1 and 720),
  notificar boolean not null default false,
  modelo_notificacao text check (modelo_notificacao is null or char_length(modelo_notificacao) <= 2000),
  -- Instrução para o LLM resumir a conversa antes de notificar. Vazio = sem resumo.
  resumo_instrucao text check (resumo_instrucao is null or char_length(resumo_instrucao) <= 4000),
  mensagem_cliente text check (mensagem_cliente is null or char_length(mensagem_cliente) <= 1000),
  encerrar_conversa boolean not null default false,
  ativo boolean not null default true,
  padrao boolean not null default false,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (deteccao <> 'mensagem_cliente' or criterios is not null),
  check (deteccao <> 'resposta_assistente' or frase_gatilho is not null),
  check (not pausar_bot or pausa_horas is not null)
);

-- No máximo um estado "padrao" ativo.
create unique index if not exists atendimento_estados_padrao_uidx
  on public.atendimento_estados ((true)) where deteccao = 'padrao' and ativo;

insert into public.atendimento_estados
  (chave, nome, descricao, deteccao, criterios, frase_gatilho, pausar_bot, pausa_horas,
   notificar, modelo_notificacao, resumo_instrucao, mensagem_cliente, padrao, ordem)
values
(
  'em_andamento', 'Em andamento',
  'Estado padrão: o assistente virtual segue conduzindo a conversa.',
  'padrao', null, null, false, null, false, null, null, null, true, 0
),
(
  'atendimento_humano', 'Atendimento humano',
  'O cliente pediu para falar com uma pessoa. O bot é pausado e a equipe é avisada com um resumo.',
  'mensagem_cliente',
  E'Classifique como atendimento_humano SOMENTE se o cliente pedir explicitamente, ou de forma clara, para falar com uma pessoa/atendente.\n' ||
  E'Exemplos: "Quero falar com um atendente", "Me transfere para um humano", "Preciso de ajuda de alguém real", "Quero atendimento humano", "Falar com suporte, por favor", "Não quero robô", "Odeio essa IA".\n' ||
  E'Tom educado ou impaciente, sem pedido direto, NÃO é atendimento_humano (evita falso positivo).',
  null, true, 8, true,
  E'🚨 Atendimento Humano Solicitado:\n\n{{resumo}}\n\nCliente: wa.me/{{telefone_cliente}}',
  'Faça um resumo sobre a conversa que deverá ser enviada para o atendente humano, seja conciso e não utilize emojis.',
  'Certo! Vou passar a sua conversa para a nossa equipe. Em instantes alguém continua o atendimento por aqui.',
  true, 10
),
(
  'finalizado', 'Atendimento finalizado',
  'O assistente concluiu o atendimento (envio da frase de encerramento da empresa). A equipe recebe o resumo.',
  'resposta_assistente', null, '{{frase_encerramento}}', false, null, true,
  E'🌟 Atendimento Finalizado, segue um resumo do atendimento:\n\n{{resumo}}\n\nCliente: wa.me/{{telefone_cliente}}',
  'Faça um resumo sobre a conversa que deverá ser enviada para o atendente humano, seja detalhado em relação aos dados do cliente, solicitações do cliente, dificuldades se ocorrer, seja conciso no que for possível.',
  null, true, 20
)
on conflict (chave) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Destinatários de notificação
-- ---------------------------------------------------------------------------

-- Eventos válidos = chave de um estado OU evento de sistema da agenda.
create or replace function public.notificacao_evento_valido(p_evento text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_evento in ('agendamento_criado', 'agendamento_reagendado', 'agendamento_cancelado')
      or exists (select 1 from public.atendimento_estados e where e.chave = p_evento);
$$;

create table if not exists public.notificacao_destinatarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  telefone text not null check (telefone ~ '^[0-9]{10,15}$'),
  eventos text[] not null default '{}',
  escopo text not null default 'global' check (escopo in ('global', 'unidade', 'profissional', 'departamento')),
  unidade text,
  profissional_id uuid references public.agenda_profissionais(id) on delete cascade,
  departamento_id bigint references public.departamentos(id) on delete cascade,
  ativo boolean not null default true,
  observacao text check (observacao is null or char_length(observacao) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (escopo <> 'unidade' or nullif(btrim(unidade), '') is not null),
  check (escopo <> 'profissional' or profissional_id is not null),
  check (escopo <> 'departamento' or departamento_id is not null)
);

create index if not exists notificacao_destinatarios_ativos_idx
  on public.notificacao_destinatarios (ativo) where ativo;

create or replace function public.notificacao_validar_destinatario()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_evento text;
begin
  new.telefone := regexp_replace(coalesce(new.telefone, ''), '\D', '', 'g');
  foreach v_evento in array coalesce(new.eventos, '{}') loop
    if not public.notificacao_evento_valido(v_evento) then
      raise exception 'Evento de notificação desconhecido: %', v_evento using errcode = '22023';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists notificacao_destinatarios_validar on public.notificacao_destinatarios;
create trigger notificacao_destinatarios_validar
  before insert or update on public.notificacao_destinatarios
  for each row execute function public.notificacao_validar_destinatario();

-- Os destinatários (telefones da equipe) são cadastrados no painel: Config. do atendimento › Notificações.

-- ---------------------------------------------------------------------------
-- 3b. Estado estruturado da conversa (integração com CRM/automações)
-- ---------------------------------------------------------------------------

alter table public.atendimento_conversas
  add column if not exists estado_atendimento text,
  add column if not exists estado_atualizado_em timestamptz;

create table if not exists public.atendimento_estado_eventos (
  id bigint generated always as identity primary key,
  session_id text not null,
  estado_chave text not null,
  origem text not null default 'automatico' check (origem in ('automatico', 'manual')),
  criado_em timestamptz not null default now()
);
create index if not exists atendimento_estado_eventos_sessao_idx
  on public.atendimento_estado_eventos (session_id, criado_em desc);

alter table public.atendimento_estado_eventos enable row level security;
drop policy if exists atendimento_estado_eventos_gestor on public.atendimento_estado_eventos;
create policy atendimento_estado_eventos_gestor on public.atendimento_estado_eventos
  for select to authenticated using (public.sou_gestor());
revoke all on public.atendimento_estado_eventos from anon;
grant select on public.atendimento_estado_eventos to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Tipos de agendamento (biblioteca) e sobrescritas por profissional x tipo
-- ---------------------------------------------------------------------------

alter table public.agenda_especialidades
  add column if not exists descricao text,
  add column if not exists aliases text[] not null default '{}',
  add column if not exists operacoes_permitidas text[] not null
    default array['buscar', 'agendar', 'reagendar', 'cancelar'],
  add column if not exists intervalo_slots_minutos smallint not null default 30,
  add column if not exists campos_obrigatorios text[] not null default '{}',
  add column if not exists instrucoes_prompt text;

alter table public.agenda_especialidades drop constraint if exists agenda_especialidades_operacoes_chk;
alter table public.agenda_especialidades add constraint agenda_especialidades_operacoes_chk
  check (operacoes_permitidas <@ array['buscar', 'agendar', 'reagendar', 'cancelar']);
alter table public.agenda_especialidades drop constraint if exists agenda_especialidades_slots_chk;
alter table public.agenda_especialidades add constraint agenda_especialidades_slots_chk
  check (intervalo_slots_minutos between 5 and 240);
alter table public.agenda_especialidades drop constraint if exists agenda_especialidades_campos_chk;
alter table public.agenda_especialidades add constraint agenda_especialidades_campos_chk
  check (campos_obrigatorios <@ array['email', 'nome_cliente', 'nome_pet', 'raca_pet', 'porte_pet', 'titulo', 'descricao']);
alter table public.agenda_especialidades drop constraint if exists agenda_especialidades_instrucoes_chk;
alter table public.agenda_especialidades add constraint agenda_especialidades_instrucoes_chk
  check (instrucoes_prompt is null or char_length(instrucoes_prompt) <= 4000);

alter table public.agenda_profissionais
  add column if not exists unidade text,
  add column if not exists titulo text;

alter table public.agenda_regras
  add column if not exists nome_exibicao text,
  add column if not exists duracao_padrao_minutos smallint,
  add column if not exists duracao_retorno_minutos smallint,
  add column if not exists intervalo_slots_minutos smallint,
  add column if not exists operacoes_permitidas text[],
  add column if not exists instrucoes_prompt text;

alter table public.agenda_regras drop constraint if exists agenda_regras_overrides_chk;
alter table public.agenda_regras add constraint agenda_regras_overrides_chk check (
  (duracao_padrao_minutos is null or duracao_padrao_minutos between 5 and 480)
  and (duracao_retorno_minutos is null or duracao_retorno_minutos between 5 and 480)
  and (intervalo_slots_minutos is null or intervalo_slots_minutos between 5 and 240)
  and (operacoes_permitidas is null or operacoes_permitidas <@ array['buscar', 'agendar', 'reagendar', 'cancelar'])
  and (instrucoes_prompt is null or char_length(instrucoes_prompt) <= 4000)
);

-- ---------------------------------------------------------------------------
-- 5. Calendários: o ID do Google Calendar passa a ser cadastrável no painel
--    (guardado no Vault; o navegador nunca o lê de volta).
-- ---------------------------------------------------------------------------

create or replace function public.agenda_salvar_calendario(
  p_nome text,
  p_google_calendar_id text default null,
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
  v_nome text := btrim(coalesce(p_nome, ''));
  v_google text := nullif(btrim(coalesce(p_google_calendar_id, '')), '');
  v_secret_id uuid;
begin
  if not public.sou_admin() then
    raise exception 'forbidden: apenas administradores' using errcode = '42501';
  end if;
  if char_length(v_nome) not between 1 and 80 then
    raise exception 'Nome da agenda inválido' using errcode = '22023';
  end if;
  if v_google is not null and (char_length(v_google) > 255 or v_google ~ '\s') then
    raise exception 'ID do calendário inválido' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.agenda_calendarios (nome, secret_key)
    values (v_nome, 'GOOGLE_CALENDAR_' || upper(substr(md5(gen_random_uuid()::text), 1, 12)))
    returning id into v_id;
  else
    update public.agenda_calendarios set nome = v_nome where id = v_id;
    if not found then
      raise exception 'Calendário não encontrado' using errcode = 'P0002';
    end if;
  end if;

  if v_google is not null then
    select s.id into v_secret_id from vault.secrets s where s.name = 'agenda_calendario_' || v_id::text limit 1;
    if v_secret_id is null then
      perform vault.create_secret(v_google, 'agenda_calendario_' || v_id::text, 'ID do Google Calendar');
    else
      update vault.secrets set secret = v_google, updated_at = now() where id = v_secret_id;
    end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.agenda_calendario_id_interno(p_calendario_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select d.decrypted_secret
  from vault.decrypted_secrets d
  where d.name = 'agenda_calendario_' || p_calendario_id::text
  limit 1;
$$;

create or replace function public.agenda_status_calendarios()
returns table (id uuid, nome text, ativo boolean, origem text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.sou_admin() then
    raise exception 'forbidden: apenas administradores' using errcode = '42501';
  end if;
  return query
    select c.id, c.nome, c.ativo,
      case when exists (select 1 from vault.secrets s where s.name = 'agenda_calendario_' || c.id::text)
        then 'painel' else 'secret_do_ambiente' end
    from public.agenda_calendarios c
    order by c.nome;
end;
$$;

revoke all on function public.agenda_salvar_calendario(text, text, uuid) from public, anon;
revoke all on function public.agenda_calendario_id_interno(uuid) from public, anon, authenticated;
revoke all on function public.agenda_status_calendarios() from public, anon;
grant execute on function public.agenda_salvar_calendario(text, text, uuid) to authenticated;
grant execute on function public.agenda_calendario_id_interno(uuid) to service_role;
grant execute on function public.agenda_status_calendarios() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Modelos reutilizáveis (tipos de agendamento e agendas) + duplicação
-- ---------------------------------------------------------------------------

create table if not exists public.agenda_modelos (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique check (chave ~ '^[a-z0-9_-]{2,80}$'),
  categoria text not null check (categoria in ('tipo', 'agenda')),
  nome text not null,
  descricao text,
  payload jsonb not null default '{}'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Exemplos de uso (dados, não regras do sistema). Qualquer cliente pode apagar.
insert into public.agenda_modelos (chave, categoria, nome, descricao, payload) values
  ('tipo-consulta', 'tipo', 'Consulta', 'Consulta de 60 min, retorno de 30 min.',
   '{"nome":"Consulta","duracao_padrao_minutos":60,"duracao_retorno_minutos":30,"aliases":["consulta"]}'),
  ('tipo-retorno', 'tipo', 'Retorno', 'Retorno curto de 30 min.',
   '{"nome":"Retorno","duracao_padrao_minutos":30,"duracao_retorno_minutos":30,"aliases":["revisão","revisao"]}'),
  ('tipo-vacinacao', 'tipo', 'Vacinação', 'Aplicação de vacinas, 30 min.',
   '{"nome":"Vacinação","duracao_padrao_minutos":30,"duracao_retorno_minutos":30,"aliases":["vacina","vacinas"]}'),
  ('tipo-ultrassonografia', 'tipo', 'Ultrassonografia', 'Exame de imagem, 60 min.',
   '{"nome":"Ultrassonografia","duracao_padrao_minutos":60,"duracao_retorno_minutos":30,"aliases":["ultrassom","ultra"],"campos_obrigatorios":["email"]}'),
  ('tipo-raio-x', 'tipo', 'Raio-X', 'Exame de imagem rápido, 30 min.',
   '{"nome":"Raio-X","duracao_padrao_minutos":30,"duracao_retorno_minutos":30,"aliases":["raio x","radiografia"]}'),
  ('tipo-fisioterapia', 'tipo', 'Fisioterapia', 'Sessão de fisioterapia, 45 min.',
   '{"nome":"Fisioterapia","duracao_padrao_minutos":45,"duracao_retorno_minutos":45,"aliases":["fisio"]}'),
  ('agenda-seg-sex-comercial', 'agenda', 'Segunda a sexta, horário comercial',
   'Segunda a sexta, 09:00–18:00, almoço 12:00–13:00.',
   '{"janelas":[{"dia":1,"inicio":"09:00","fim":"18:00"},{"dia":2,"inicio":"09:00","fim":"18:00"},{"dia":3,"inicio":"09:00","fim":"18:00"},{"dia":4,"inicio":"09:00","fim":"18:00"},{"dia":5,"inicio":"09:00","fim":"18:00"}],"intervalos":[{"tipo":"almoco","inicio":"12:00","fim":"13:00","dias":[1,2,3,4,5]}]}'),
  ('agenda-sabado-manha', 'agenda', 'Sábado de manhã',
   'Sábado, 08:00–12:00.',
   '{"janelas":[{"dia":6,"inicio":"08:00","fim":"12:00"}],"intervalos":[]}'),
  ('agenda-especialista-ter-qui', 'agenda', 'Especialista (terça e quinta à tarde)',
   'Terça e quinta, 14:00–18:00.',
   '{"janelas":[{"dia":2,"inicio":"14:00","fim":"18:00"},{"dia":4,"inicio":"14:00","fim":"18:00"}],"intervalos":[]}')
on conflict (chave) do nothing;

-- Cria um tipo de agendamento a partir de um modelo (idempotente por chave).
create or replace function public.agenda_aplicar_modelo_tipo(p_modelo text, p_chave text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modelo public.agenda_modelos;
  v_chave text;
  v_id uuid;
  v_payload jsonb;
begin
  if not public.sou_admin() then
    raise exception 'forbidden: apenas administradores' using errcode = '42501';
  end if;
  select * into v_modelo from public.agenda_modelos where chave = p_modelo and categoria = 'tipo' and ativo;
  if not found then
    raise exception 'Modelo de tipo não encontrado' using errcode = 'P0002';
  end if;
  v_payload := v_modelo.payload;
  v_chave := coalesce(nullif(btrim(p_chave), ''), regexp_replace(p_modelo, '^tipo-', ''));
  if v_chave !~ '^[a-z0-9_-]{2,80}$' then
    raise exception 'Chave inválida' using errcode = '22023';
  end if;

  insert into public.agenda_especialidades
    (chave, nome, descricao, duracao_padrao_minutos, duracao_retorno_minutos, aliases, campos_obrigatorios)
  values (
    v_chave, v_payload->>'nome', v_modelo.descricao,
    coalesce((v_payload->>'duracao_padrao_minutos')::smallint, 60),
    coalesce((v_payload->>'duracao_retorno_minutos')::smallint, 30),
    coalesce(array(select jsonb_array_elements_text(v_payload->'aliases')), '{}'),
    coalesce(array(select jsonb_array_elements_text(v_payload->'campos_obrigatorios')), '{}')
  )
  on conflict (chave) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.agenda_especialidades where chave = v_chave;
  end if;
  return v_id;
end;
$$;

-- Liga um profissional a um tipo e aplica jornada de um modelo de agenda. A regra
-- nasce INATIVA: o administrador testa e só então ativa.
create or replace function public.agenda_criar_regra_de_modelo(
  p_modelo text,
  p_profissional_id uuid,
  p_especialidade_id uuid,
  p_calendario_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_modelo public.agenda_modelos;
  v_regra uuid;
  v_item jsonb;
  v_dia jsonb;
begin
  if not public.sou_admin() then
    raise exception 'forbidden: apenas administradores' using errcode = '42501';
  end if;
  select * into v_modelo from public.agenda_modelos where chave = p_modelo and categoria = 'agenda' and ativo;
  if not found then
    raise exception 'Modelo de agenda não encontrado' using errcode = 'P0002';
  end if;

  insert into public.agenda_regras (profissional_id, especialidade_id, calendario_id, ativo)
  values (p_profissional_id, p_especialidade_id, p_calendario_id, false)
  on conflict (profissional_id, especialidade_id) do nothing
  returning id into v_regra;
  if v_regra is null then
    raise exception 'Esse profissional já tem uma agenda para este tipo' using errcode = '23505';
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(v_modelo.payload->'janelas', '[]')) loop
    insert into public.agenda_janelas_semanais (regra_id, dia_semana, inicio, fim, ultimo_inicio)
    values (v_regra, (v_item->>'dia')::smallint, (v_item->>'inicio')::time, (v_item->>'fim')::time,
            nullif(v_item->>'ultimo_inicio', '')::time)
    on conflict do nothing;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(v_modelo.payload->'intervalos', '[]')) loop
    for v_dia in select * from jsonb_array_elements(coalesce(v_item->'dias', '[]')) loop
      insert into public.agenda_intervalos (regra_id, tipo, dia_semana, inicio, fim, descricao)
      values (v_regra, coalesce(v_item->>'tipo', 'almoco'), (v_dia #>> '{}')::smallint,
              (v_item->>'inicio')::time, (v_item->>'fim')::time, v_item->>'descricao');
    end loop;
  end loop;
  return v_regra;
end;
$$;

-- Duplica uma agenda (sobrescritas, jornada e intervalos) para outro profissional.
create or replace function public.agenda_duplicar_regra(
  p_regra_id uuid,
  p_profissional_id uuid,
  p_calendario_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origem public.agenda_regras;
  v_nova uuid;
begin
  if not public.sou_admin() then
    raise exception 'forbidden: apenas administradores' using errcode = '42501';
  end if;
  select * into v_origem from public.agenda_regras where id = p_regra_id;
  if not found then
    raise exception 'Agenda de origem não encontrada' using errcode = 'P0002';
  end if;

  insert into public.agenda_regras (
    profissional_id, especialidade_id, calendario_id, ativo, nome_exibicao,
    duracao_padrao_minutos, duracao_retorno_minutos, intervalo_slots_minutos,
    operacoes_permitidas, instrucoes_prompt
  ) values (
    p_profissional_id, v_origem.especialidade_id, p_calendario_id, false, v_origem.nome_exibicao,
    v_origem.duracao_padrao_minutos, v_origem.duracao_retorno_minutos, v_origem.intervalo_slots_minutos,
    v_origem.operacoes_permitidas, v_origem.instrucoes_prompt
  )
  on conflict (profissional_id, especialidade_id) do nothing
  returning id into v_nova;
  if v_nova is null then
    raise exception 'Esse profissional já tem uma agenda para este tipo' using errcode = '23505';
  end if;

  insert into public.agenda_janelas_semanais (regra_id, dia_semana, inicio, fim, ultimo_inicio)
  select v_nova, dia_semana, inicio, fim, ultimo_inicio
  from public.agenda_janelas_semanais where regra_id = p_regra_id;

  insert into public.agenda_intervalos (regra_id, tipo, dia_semana, data_especifica, inicio, fim, ativo, descricao)
  select v_nova, tipo, dia_semana, data_especifica, inicio, fim, ativo, descricao
  from public.agenda_intervalos where regra_id = p_regra_id;
  return v_nova;
end;
$$;

revoke all on function public.agenda_aplicar_modelo_tipo(text, text) from public, anon;
revoke all on function public.agenda_criar_regra_de_modelo(text, uuid, uuid, uuid) from public, anon;
revoke all on function public.agenda_duplicar_regra(uuid, uuid, uuid) from public, anon;
grant execute on function public.agenda_aplicar_modelo_tipo(text, text) to authenticated;
grant execute on function public.agenda_criar_regra_de_modelo(text, uuid, uuid, uuid) to authenticated;
grant execute on function public.agenda_duplicar_regra(uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Auditoria, updated_at e RLS (somente administradores)
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'atendimento_config', 'atendimento_estados', 'notificacao_destinatarios', 'agenda_modelos'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.agenda_atualizar_updated_at()', t || '_updated_at', t);
    execute format('drop trigger if exists %I on public.%I', t || '_auditoria', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.agenda_auditar_configuracao()', t || '_auditoria', t);

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_total', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.sou_admin()) with check (public.sou_admin())',
      t || '_admin_total', t
    );
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;

-- Estados padrão não podem ser removidos pelo painel (podem ser desativados/editados).
create or replace function public.atendimento_estados_proteger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.padrao then
    raise exception 'Estados de fábrica não podem ser excluídos; desative-os.' using errcode = '23503';
  end if;
  return old;
end;
$$;
drop trigger if exists atendimento_estados_proteger on public.atendimento_estados;
create trigger atendimento_estados_proteger before delete on public.atendimento_estados
  for each row execute function public.atendimento_estados_proteger();

-- 8. O compilador do prompt (obter_prompt_compilado) vive em 20261027100000.
