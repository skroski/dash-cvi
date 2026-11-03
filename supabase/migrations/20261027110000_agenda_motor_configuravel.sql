-- Motor de agenda totalmente configurável pelo painel.
--
-- Tudo o que os fluxos n8n de agenda tinham fixo em JavaScript passa a ser dado:
--   * busca: horizonte, dias com vaga, horários por dia, quantas datas apresentar, ordem;
--   * antecedência mínima, capacidade simultânea e quantos pets por agendamento;
--   * título/descrição/local do evento (com variáveis), convite ao cliente/profissional;
--   * recorrência quinzenal por jornada (âncora), feriados e fechamentos;
--   * tag aplicada ao cliente ao agendar;
--   * registro dos agendamentos feitos pelo assistente (permite cancelar/remarcar com
--     segurança e substitui o e-mail/planilha de auditoria do n8n).
-- Hierarquia: agenda (profissional x tipo) > tipo > padrões do sistema.

-- ---------------------------------------------------------------------------
-- 1. Tipo de agendamento
-- ---------------------------------------------------------------------------

alter table public.agenda_especialidades
  add column if not exists antecedencia_minima_minutos smallint not null default 0,
  add column if not exists busca_horizonte_dias smallint not null default 20,
  add column if not exists busca_max_dias_com_vaga smallint not null default 10,
  add column if not exists busca_max_horarios_por_dia smallint not null default 30,
  add column if not exists busca_apresentar_max_datas smallint not null default 2,
  add column if not exists busca_apresentar_max_horarios smallint not null default 4,
  add column if not exists busca_ordem text not null default 'proximos',
  add column if not exists max_pets_por_agendamento smallint not null default 1,
  add column if not exists capacidade_simultanea smallint not null default 1,
  add column if not exists titulo_evento_modelo text,
  add column if not exists descricao_evento_modelo text,
  add column if not exists local_evento text,
  add column if not exists enviar_convite_cliente boolean not null default true,
  add column if not exists mensagem_agendamento_equipe text,
  add column if not exists tag_id bigint references public.tags(id) on delete set null;

alter table public.agenda_especialidades drop constraint if exists agenda_especialidades_motor_chk;
alter table public.agenda_especialidades add constraint agenda_especialidades_motor_chk check (
  antecedencia_minima_minutos between 0 and 20160
  and busca_horizonte_dias between 1 and 120
  and busca_max_dias_com_vaga between 1 and 60
  and busca_max_horarios_por_dia between 1 and 100
  and busca_apresentar_max_datas between 1 and 10
  and busca_apresentar_max_horarios between 1 and 20
  and busca_ordem in ('proximos', 'em_torno_da_data')
  and max_pets_por_agendamento between 1 and 10
  and capacidade_simultanea between 1 and 20
  and (titulo_evento_modelo is null or char_length(titulo_evento_modelo) <= 300)
  and (descricao_evento_modelo is null or char_length(descricao_evento_modelo) <= 2000)
  and (local_evento is null or char_length(local_evento) <= 300)
  and (mensagem_agendamento_equipe is null or char_length(mensagem_agendamento_equipe) <= 500)
);

comment on column public.agenda_especialidades.busca_ordem is
  'proximos: do dia pedido para frente | em_torno_da_data: alterna dias antes e depois da data pedida.';
comment on column public.agenda_especialidades.max_pets_por_agendamento is
  'Quantos pets cabem em UM agendamento (nomes separados por vírgula no título). Não altera a duração.';
comment on column public.agenda_especialidades.capacidade_simultanea is
  'Quantos eventos podem ocupar o mesmo horário no calendário antes de ele deixar de ser oferecido.';

-- Dados que o tipo pode exigir antes de agendar ("titulo" e "descricao" são legados:
-- o evento agora é montado pelos modelos de título/descrição).
alter table public.agenda_especialidades drop constraint if exists agenda_especialidades_campos_chk;
alter table public.agenda_especialidades add constraint agenda_especialidades_campos_chk
  check (campos_obrigatorios <@ array['email', 'nome_cliente', 'nome_pet', 'raca_pet', 'porte_pet', 'titulo', 'descricao']);

-- ---------------------------------------------------------------------------
-- 2. Agenda (profissional x tipo): sobrescritas opcionais
-- ---------------------------------------------------------------------------

alter table public.agenda_regras
  add column if not exists antecedencia_minima_minutos smallint,
  add column if not exists capacidade_simultanea smallint,
  add column if not exists max_pets_por_agendamento smallint,
  add column if not exists titulo_evento_modelo text,
  add column if not exists descricao_evento_modelo text,
  add column if not exists local_evento text;

alter table public.agenda_regras drop constraint if exists agenda_regras_motor_chk;
alter table public.agenda_regras add constraint agenda_regras_motor_chk check (
  (antecedencia_minima_minutos is null or antecedencia_minima_minutos between 0 and 20160)
  and (capacidade_simultanea is null or capacidade_simultanea between 1 and 20)
  and (max_pets_por_agendamento is null or max_pets_por_agendamento between 1 and 10)
  and (titulo_evento_modelo is null or char_length(titulo_evento_modelo) <= 300)
  and (descricao_evento_modelo is null or char_length(descricao_evento_modelo) <= 2000)
  and (local_evento is null or char_length(local_evento) <= 300)
);

alter table public.agenda_profissionais
  add column if not exists email text,
  add column if not exists convidar_por_email boolean not null default false;

alter table public.agenda_profissionais drop constraint if exists agenda_profissionais_email_chk;
alter table public.agenda_profissionais add constraint agenda_profissionais_email_chk
  check (email is null or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');

-- ---------------------------------------------------------------------------
-- 3. Jornada: recorrência quinzenal
-- ---------------------------------------------------------------------------

alter table public.agenda_janelas_semanais
  add column if not exists recorrencia text not null default 'semanal',
  add column if not exists ancora_quinzenal date;

alter table public.agenda_janelas_semanais drop constraint if exists agenda_janelas_recorrencia_chk;
alter table public.agenda_janelas_semanais add constraint agenda_janelas_recorrencia_chk check (
  recorrencia in ('semanal', 'quinzenal')
  and (recorrencia = 'semanal' or ancora_quinzenal is not null)
);

comment on column public.agenda_janelas_semanais.ancora_quinzenal is
  'Qualquer data de uma semana COM atendimento; o atendimento ocorre nessa semana e de 14 em 14 dias a partir dela.';

-- ---------------------------------------------------------------------------
-- 4. Feriados e fechamentos
-- ---------------------------------------------------------------------------

create table if not exists public.agenda_feriados (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  descricao text check (descricao is null or char_length(descricao) <= 120),
  dia_inteiro boolean not null default true,
  inicio time,
  fim time,
  -- null = vale para todas as agendas
  regra_id uuid references public.agenda_regras(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (dia_inteiro or (inicio is not null and fim is not null and inicio < fim))
);

create unique index if not exists agenda_feriados_unico_idx
  on public.agenda_feriados (data, coalesce(regra_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(inicio, '00:00'::time));
create index if not exists agenda_feriados_data_idx on public.agenda_feriados (data);

-- ---------------------------------------------------------------------------
-- 5. Agendamentos feitos pelo assistente
-- ---------------------------------------------------------------------------

create table if not exists public.agenda_agendamentos (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  telefone text,
  regra_id uuid references public.agenda_regras(id) on delete set null,
  tipo_chave text not null,
  tipo_nome text not null,
  profissional_id uuid references public.agenda_profissionais(id) on delete set null,
  profissional_nome text,
  calendario_id uuid references public.agenda_calendarios(id) on delete set null,
  google_event_id text not null unique,
  inicio timestamptz not null,
  fim timestamptz not null,
  status text not null default 'confirmado' check (status in ('confirmado', 'cancelado', 'remarcado')),
  tutor_nome text,
  pet_nome text,
  email text,
  titulo text,
  origem text not null default 'assistente',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  cancelado_em timestamptz,
  check (fim > inicio)
);

create index if not exists agenda_agendamentos_sessao_idx
  on public.agenda_agendamentos (session_id, inicio) where status = 'confirmado';
create index if not exists agenda_agendamentos_inicio_idx on public.agenda_agendamentos (inicio desc);

-- ---------------------------------------------------------------------------
-- 6. Duplicação passa a copiar as novas sobrescritas e a recorrência
-- ---------------------------------------------------------------------------

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
    operacoes_permitidas, instrucoes_prompt,
    antecedencia_minima_minutos, capacidade_simultanea, max_pets_por_agendamento,
    titulo_evento_modelo, descricao_evento_modelo, local_evento
  ) values (
    p_profissional_id, v_origem.especialidade_id, p_calendario_id, false, v_origem.nome_exibicao,
    v_origem.duracao_padrao_minutos, v_origem.duracao_retorno_minutos, v_origem.intervalo_slots_minutos,
    v_origem.operacoes_permitidas, v_origem.instrucoes_prompt,
    v_origem.antecedencia_minima_minutos, v_origem.capacidade_simultanea, v_origem.max_pets_por_agendamento,
    v_origem.titulo_evento_modelo, v_origem.descricao_evento_modelo, v_origem.local_evento
  )
  on conflict (profissional_id, especialidade_id) do nothing
  returning id into v_nova;
  if v_nova is null then
    raise exception 'Esse profissional já tem uma agenda para este tipo' using errcode = '23505';
  end if;

  insert into public.agenda_janelas_semanais (regra_id, dia_semana, inicio, fim, ultimo_inicio, recorrencia, ancora_quinzenal)
  select v_nova, dia_semana, inicio, fim, ultimo_inicio, recorrencia, ancora_quinzenal
  from public.agenda_janelas_semanais where regra_id = p_regra_id;

  insert into public.agenda_intervalos (regra_id, tipo, dia_semana, data_especifica, inicio, fim, ativo, descricao)
  select v_nova, tipo, dia_semana, data_especifica, inicio, fim, ativo, descricao
  from public.agenda_intervalos where regra_id = p_regra_id;
  return v_nova;
end;
$$;

revoke all on function public.agenda_duplicar_regra(uuid, uuid, uuid) from public, anon;
grant execute on function public.agenda_duplicar_regra(uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Auditoria, updated_at e RLS
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['agenda_feriados']
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

-- O registro de agendamentos só é escrito pelo assistente (service_role); a equipe lê.
alter table public.agenda_agendamentos enable row level security;
drop policy if exists agenda_agendamentos_gestor_le on public.agenda_agendamentos;
create policy agenda_agendamentos_gestor_le on public.agenda_agendamentos
  for select to authenticated using (public.sou_gestor());
revoke all on public.agenda_agendamentos from anon;
revoke insert, update, delete on public.agenda_agendamentos from authenticated;
grant select on public.agenda_agendamentos to authenticated;
