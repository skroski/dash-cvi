-- ============================================================================
-- MÓDULO DE PIPELINES (CRM KANBAN): ATENDIMENTO, LEADS, MARKETING E PÓS-VENDA
-- ============================================================================
-- Cria a estrutura de múltiplos pipelines personalizáveis, estágios com guia
-- operacional para o atendimento e SLA, cards vinculados a clientes
-- (public.dados_cliente), conversas (session_id) e atendentes (public.atendentes),
-- além do histórico de atividades/movimentações.
-- ============================================================================

begin;

-- 1. Tabela de Pipelines
create table if not exists public.crm_pipelines (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  categoria text not null default 'atendimento'
    check (categoria in ('atendimento', 'leads', 'marketing', 'pos_venda', 'outros')),
  cor text not null default '#0d9488',
  padrao boolean not null default false,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_pipelines_ordem_idx
  on public.crm_pipelines (ativo, ordem, created_at);

comment on table public.crm_pipelines is
  'Pipelines de CRM/Kanban da clínica (Atendimento, Captação de Leads, Campanhas de Marketing, Pós-Venda).';

-- 2. Tabela de Estágios (Colunas do Kanban)
create table if not exists public.crm_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.crm_pipelines(id) on delete cascade,
  nome text not null,
  descricao text,
  cor text not null default '#0d9488',
  tipo text not null default 'andamento'
    check (tipo in ('entrada', 'andamento', 'ganho', 'perdido')),
  sla_horas integer check (sla_horas is null or sla_horas > 0),
  checklist_padrao jsonb not null default '[]'::jsonb,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_pipeline_stages_pipeline_ordem_idx
  on public.crm_pipeline_stages (pipeline_id, ordem, created_at);

comment on table public.crm_pipeline_stages is
  'Estágios (colunas) de cada pipeline, com roteiro de orientação para o atendente (descricao), meta de SLA e tipo de etapa.';

-- 3. Tabela de Cards (Contatos / Leads / Atendimentos no Pipeline)
create table if not exists public.crm_pipeline_cards (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.crm_pipelines(id) on delete cascade,
  stage_id uuid not null references public.crm_pipeline_stages(id) on delete cascade,
  client_id bigint references public.dados_cliente(id) on delete set null,
  session_id text,
  titulo text not null,
  nome_contato text not null,
  telefone text,
  email text,
  nome_pet text,
  especie_pet text,
  raca_pet text,
  porte_pet text,
  servico_interesse text,
  valor_estimado numeric(12,2) not null default 0,
  prioridade text not null default 'media'
    check (prioridade in ('baixa', 'media', 'alta', 'urgente')),
  origem text not null default 'whatsapp'
    check (origem in ('whatsapp', 'instagram', 'google_ads', 'indicacao', 'site', 'presencial', 'telefone', 'campanha', 'outros')),
  campanha text,
  atendente_id bigint references public.atendentes(id) on delete set null,
  proxima_acao text,
  proxima_acao_em timestamptz,
  observacoes text,
  checklist jsonb not null default '[]'::jsonb,
  tags_custom text[] not null default '{}',
  motivo_perda text,
  ordem integer not null default 0,
  movido_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_pipeline_cards_pipeline_stage_ordem_idx
  on public.crm_pipeline_cards (pipeline_id, stage_id, ordem, updated_at desc);

create index if not exists crm_pipeline_cards_client_id_idx
  on public.crm_pipeline_cards (client_id) where client_id is not null;

create index if not exists crm_pipeline_cards_session_id_idx
  on public.crm_pipeline_cards (session_id) where session_id is not null;

comment on table public.crm_pipeline_cards is
  'Contatos, oportunidades e atendimentos distribuídos nas colunas dos pipelines.';

-- 4. Tabela de Atividades e Histórico do Card
create table if not exists public.crm_pipeline_activities (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.crm_pipeline_cards(id) on delete cascade,
  tipo text not null default 'nota'
    check (tipo in ('criacao', 'movimentacao', 'nota', 'edicao', 'mensagem', 'tarefa')),
  descricao text not null,
  de_stage_id uuid references public.crm_pipeline_stages(id) on delete set null,
  para_stage_id uuid references public.crm_pipeline_stages(id) on delete set null,
  autor_nome text,
  created_at timestamptz not null default now()
);

create index if not exists crm_pipeline_activities_card_id_idx
  on public.crm_pipeline_activities (card_id, created_at desc);

comment on table public.crm_pipeline_activities is
  'Linha do tempo de movimentações de estágio, notas e interações em cada card do pipeline.';

-- 5. RLS (Row Level Security) com subconsulta escalar InitPlan
alter table public.crm_pipelines enable row level security;
alter table public.crm_pipeline_stages enable row level security;
alter table public.crm_pipeline_cards enable row level security;
alter table public.crm_pipeline_activities enable row level security;

drop policy if exists "crm_pipelines_authenticated_all" on public.crm_pipelines;
create policy "crm_pipelines_authenticated_all"
  on public.crm_pipelines
  for all
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists "crm_pipeline_stages_authenticated_all" on public.crm_pipeline_stages;
create policy "crm_pipeline_stages_authenticated_all"
  on public.crm_pipeline_stages
  for all
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists "crm_pipeline_cards_authenticated_all" on public.crm_pipeline_cards;
create policy "crm_pipeline_cards_authenticated_all"
  on public.crm_pipeline_cards
  for all
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists "crm_pipeline_activities_authenticated_all" on public.crm_pipeline_activities;
create policy "crm_pipeline_activities_authenticated_all"
  on public.crm_pipeline_activities
  for all
  to authenticated
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

-- 6. Semente inicial idempotente (apenas se ainda não houver nenhum pipeline)
do $$
declare
  v_atendimento_id uuid;
  v_leads_id uuid;
  v_marketing_id uuid;
begin
  if not exists (select 1 from public.crm_pipelines limit 1) then
    -- Pipeline 1: Fluxo de Atendimento Clínico
    insert into public.crm_pipelines (nome, descricao, categoria, cor, padrao, ordem)
    values (
      'Fluxo de Atendimento Clínico',
      'Organiza o atendimento diário da recepção: desde o primeiro contato no WhatsApp até o agendamento confirmado e pós-consulta.',
      'atendimento',
      '#0d9488',
      true,
      0
    )
    returning id into v_atendimento_id;

    insert into public.crm_pipeline_stages (pipeline_id, nome, descricao, cor, tipo, sla_horas, checklist_padrao, ordem)
    values
      (
        v_atendimento_id,
        'Triagem / Novo Contato',
        'Acolher o tutor, identificar nome e espécie do pet, entender o sintoma ou serviço desejado e avaliar se há sinais de urgência.',
        '#0ea5e9',
        'entrada',
        1,
        '["Identificar tutor e nome do pet", "Entender queixa principal ou serviço", "Verificar se é urgência/emergência"]'::jsonb,
        0
      ),
      (
        v_atendimento_id,
        'Orçamento & Dúvidas',
        'Informar valores de consulta/exames, explicar preparos necessários (ex.: jejum para exames) e esclarecer dúvidas.',
        '#2563eb',
        'andamento',
        4,
        '["Informar valor do serviço/consulta", "Explicar preparo ou documentos necessários", "Oferecer horários disponíveis na agenda"]'::jsonb,
        1
      ),
      (
        v_atendimento_id,
        'Aguardando Confirmação',
        'Horários já foram enviados ao tutor. Realizar follow-up cordial caso ainda não tenha confirmado o horário.',
        '#d97706',
        'andamento',
        12,
        '["Enviar opções de data e horário", "Realizar follow-up se não responder em 4h"]'::jsonb,
        2
      ),
      (
        v_atendimento_id,
        'Agendado / Confirmado',
        'Horário reservado na agenda! Enviar confirmação com endereço da clínica e orientações pré-consulta.',
        '#16a34a',
        'ganho',
        24,
        '["Registrar agendamento no calendário", "Confirmar dados cadastrais do tutor/pet", "Enviar confirmação e localização"]'::jsonb,
        3
      ),
      (
        v_atendimento_id,
        'Pós-Consulta & Retorno',
        'Entrar em contato após o atendimento para saber como o pet está evoluindo e lembrar sobre retorno ou exames.',
        '#7c3aed',
        'andamento',
        48,
        '["Perguntar como o pet está se recuperando", "Verificar se precisa agendar retorno"]'::jsonb,
        4
      ),
      (
        v_atendimento_id,
        'Não Agendou / Arquivado',
        'Tutor optou por não agendar no momento. Registrar o motivo para futuras ações de repescagem.',
        '#64748b',
        'perdido',
        null,
        '["Registrar motivo pelo qual não agendou"]'::jsonb,
        5
      );

    -- Pipeline 2: Captação de Leads & Comercial
    insert into public.crm_pipelines (nome, descricao, categoria, cor, padrao, ordem)
    values (
      'Captação de Leads & Comercial',
      'Acompanhamento de novos contatos vindos do Instagram, Google Ads, indicações e site até a conversão no primeiro atendimento.',
      'leads',
      '#2563eb',
      false,
      1
    )
    returning id into v_leads_id;

    insert into public.crm_pipeline_stages (pipeline_id, nome, descricao, cor, tipo, sla_horas, checklist_padrao, ordem)
    values
      (
        v_leads_id,
        'Novo Lead',
        'Contato acabou de chegar por anúncio, Instagram, Google ou indicação. Responder rapidamente para aproveitar o interesse quente.',
        '#0ea5e9',
        'entrada',
        1,
        '["Responder em até 15 minutos", "Registrar origem do lead e nome do pet"]'::jsonb,
        0
      ),
      (
        v_leads_id,
        'Qualificação do Pet',
        'Conhecer o perfil do pet (idade, raça, porte, histórico vacinal) e identificar a melhor solução clínica.',
        '#2563eb',
        'andamento',
        4,
        '["Levantar idade, raça e histórico do pet", "Identificar especialidade ou serviço ideal"]'::jsonb,
        1
      ),
      (
        v_leads_id,
        'Apresentação & Proposta',
        'Apresentar diferenciais da clínica, pacotes preventivos, check-ups ou valores da especialidade solicitada.',
        '#7c3aed',
        'andamento',
        12,
        '["Apresentar diferenciais da equipe e estrutura", "Enviar proposta/valores e sugerir horários"]'::jsonb,
        2
      ),
      (
        v_leads_id,
        'Follow-up / Repescagem',
        'Retomar contato com leads que visualizaram a proposta mas ainda não fecharam o agendamento.',
        '#ea580c',
        'andamento',
        24,
        '["Primeiro toque de follow-up", "Segundo toque oferecendo ajuda com horários"]'::jsonb,
        3
      ),
      (
        v_leads_id,
        'Lead Convertido',
        'Lead agendou o primeiro atendimento e virou cliente ativo da clínica!',
        '#16a34a',
        'ganho',
        null,
        '["Cadastrar cliente completo na base", "Confirmar agendamento na agenda"]'::jsonb,
        4
      ),
      (
        v_leads_id,
        'Lead Perdido',
        'Sem retorno após tentativas ou fora do perfil. Anotar o motivo para análise de marketing.',
        '#dc2626',
        'perdido',
        null,
        '["Registrar motivo da perda (preço, distância, sem resposta)"]'::jsonb,
        5
      );

    -- Pipeline 3: Campanhas de Marketing & Preventivos
    insert into public.crm_pipelines (nome, descricao, categoria, cor, padrao, ordem)
    values (
      'Campanhas de Marketing & Preventivos',
      'Gestão de campanhas ativas (Vacinação em Dia, Check-up Sênior, Mês do Gato/Cão, Profilaxia Dental e Retornos).',
      'marketing',
      '#7c3aed',
      false,
      2
    )
    returning id into v_marketing_id;

    insert into public.crm_pipeline_stages (pipeline_id, nome, descricao, cor, tipo, sla_horas, checklist_padrao, ordem)
    values
      (
        v_marketing_id,
        'Público Selecionado',
        'Clientes filtrados por tag, porte ou histórico para receber o convite da campanha preventiva.',
        '#6366f1',
        'entrada',
        24,
        '["Conferir dados do pet e histórico", "Enviar mensagem personalizada da campanha"]'::jsonb,
        0
      ),
      (
        v_marketing_id,
        'Mensagem Enviada',
        'Comunicado da campanha enviado. Aguardando leitura ou interação do tutor.',
        '#0ea5e9',
        'andamento',
        24,
        '["Confirmar entrega da mensagem no WhatsApp"]'::jsonb,
        1
      ),
      (
        v_marketing_id,
        'Interagiu / Interessado',
        'Tutor respondeu com interesse na campanha! Conduzir para escolha de dia e horário.',
        '#d97706',
        'andamento',
        2,
        '["Tirar dúvidas sobre o pacote da campanha", "Sugerir 2 opções de horário"]'::jsonb,
        2
      ),
      (
        v_marketing_id,
        'Agendado pela Campanha',
        'Sucesso! Tutor agendou o serviço promocional/preventivo da campanha.',
        '#16a34a',
        'ganho',
        null,
        '["Confirmar agendamento e aplicar condição da campanha"]'::jsonb,
        3
      ),
      (
        v_marketing_id,
        'Sem Interesse no Momento',
        'Tutor agradeceu mas não participará desta edição da campanha.',
        '#64748b',
        'perdido',
        null,
        '["Manter relacionamento cordial para próximas ações"]'::jsonb,
        4
      );
  end if;
end $$;

commit;
