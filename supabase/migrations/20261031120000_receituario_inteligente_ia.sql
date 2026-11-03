-- ============================================================================
-- MÓDULO DE RECEITUÁRIO INTELIGENTE COM IA (PRD V1)
-- Tabelas:
--   1. public.receituario_pacientes       (RF-01: Coleta Contextual do Paciente)
--   2. public.receituario_bulario         (RF-03 / RF-04 / Seção 9: Hard Rules & Bulário)
--   3. public.receituario_protocolos      (RF-02 / Seção 7.1: Protocolos Rápidos)
--   4. public.receituario_prescricoes     (RF-05 a RF-08: Receitas, Cronograma, ICP-Brasil & QR Code)
--   5. public.receituario_auditoria_ia    (RNF Auditoria Clínica: Prompt, Sugestão Bruta & Aceitação)
-- Idempotente e 100% compatível com RLS e com a trava restritiva do papel 'totem'.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Funções auxiliares de autorização para o Receituário
-- ---------------------------------------------------------------------------
create or replace function public.receituario_sou_equipe()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.perfil_papel() in ('admin', 'lider', 'atendente', 'veterinario'), false)
    and not coalesce(public.fila_sou_totem(), false)
$$;

revoke all on function public.receituario_sou_equipe() from public, anon;
grant execute on function public.receituario_sou_equipe() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tabela de Pacientes (Pets) vinculada a public.dados_cliente (RF-01)
-- ---------------------------------------------------------------------------
create table if not exists public.receituario_pacientes (
  id uuid primary key default gen_random_uuid(),
  cliente_id bigint references public.dados_cliente(id) on delete set null,
  tutor_nome text not null check (char_length(btrim(tutor_nome)) between 1 and 120),
  tutor_telefone text,
  tutor_cpf text,
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  especie text not null default 'canina' check (especie in ('canina', 'felina', 'silvestre')),
  raca text,
  sexo text default 'macho' check (sexo in ('macho', 'femea', 'indefinido')),
  castrado boolean not null default false,
  idade_texto text,
  idade_meses integer check (idade_meses is null or (idade_meses >= 0 and idade_meses <= 480)),
  peso_kg numeric(6,2) not null check (peso_kg > 0 and peso_kg <= 250),
  mutacao_mdr1 boolean not null default false,
  comorbidades text[] not null default '{}'::text[],
  alergias text[] not null default '{}'::text[],
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists receituario_pacientes_cliente_idx on public.receituario_pacientes(cliente_id);
create index if not exists receituario_pacientes_nome_idx on public.receituario_pacientes(nome, tutor_nome);

alter table public.receituario_pacientes enable row level security;

drop policy if exists receituario_pacientes_equipe_all on public.receituario_pacientes;
create policy receituario_pacientes_equipe_all on public.receituario_pacientes
  for all to authenticated
  using ((select public.receituario_sou_equipe()))
  with check ((select public.receituario_sou_equipe()));

revoke all on public.receituario_pacientes from anon;
grant select, insert, update, delete on public.receituario_pacientes to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Bulário Veterinário Determinístico & Hard Rules (RF-03, RF-04 e Seção 9)
-- ---------------------------------------------------------------------------
create table if not exists public.receituario_bulario (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  principio_ativo text not null,
  nome_comercial_sugerido text not null,
  classe_terapeutica text not null,
  tipo_padrao text not null default 'industrializado' check (tipo_padrao in ('industrializado', 'manipulado')),
  icone_via text not null default 'oral' check (icone_via in ('oral', 'topica', 'otica', 'oftalmica', 'injetavel', 'inalatoria')),
  especies_permitidas text[] not null default array['canina', 'felina'],
  especies_contraindicadas text[] not null default '{}'::text[],
  motivo_contraindicacao_especie text,
  risco_mdr1 boolean not null default false,
  mensagem_mdr1 text,
  dose_padrao_mg_kg numeric(8,3) not null check (dose_padrao_mg_kg >= 0),
  dose_min_mg_kg numeric(8,3) not null check (dose_min_mg_kg >= 0),
  dose_max_mg_kg numeric(8,3) not null check (dose_max_mg_kg >= 0),
  dose_toxica_mg_kg numeric(8,3),
  dose_felina_max_mg_kg numeric(8,3),
  alerta_felino_especifico text,
  frequencia_horas_padrao integer not null default 12 check (frequencia_horas_padrao in (4, 6, 8, 12, 24, 48, 72, 168)),
  duracao_dias_padrao integer not null default 7 check (duracao_dias_padrao between 1 and 365),
  condicao_alimentar text not null default 'com_alimento' check (condicao_alimentar in ('com_alimento', 'jejum', 'livre', 'uso_externo')),
  apresentacoes jsonb not null default '[]'::jsonb,
  interacoes_classes text[] not null default '{}'::text[],
  comorbidades_cautela text[] not null default '{}'::text[],
  orientacoes_padrao text not null,
  palavras_chave text[] not null default '{}'::text[],
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists receituario_bulario_principio_idx on public.receituario_bulario(principio_ativo);

alter table public.receituario_bulario enable row level security;

drop policy if exists receituario_bulario_leitura on public.receituario_bulario;
create policy receituario_bulario_leitura on public.receituario_bulario
  for select to authenticated
  using ((select public.receituario_sou_equipe()));

drop policy if exists receituario_bulario_gestor_write on public.receituario_bulario;
create policy receituario_bulario_gestor_write on public.receituario_bulario
  for all to authenticated
  using ((select public.sou_gestor()) and not (select public.fila_sou_totem()))
  with check ((select public.sou_gestor()) and not (select public.fila_sou_totem()));

revoke all on public.receituario_bulario from anon;
grant select, insert, update, delete on public.receituario_bulario to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Protocolos Clínicos Rápidos (Seção 7.1)
-- ---------------------------------------------------------------------------
create table if not exists public.receituario_protocolos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  titulo text not null,
  descricao_clinica text not null,
  especie_alvo text not null default 'ambas' check (especie_alvo in ('canina', 'felina', 'silvestre', 'ambas')),
  palavras_gatilho text[] not null default '{}'::text[],
  itens_template jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.receituario_protocolos enable row level security;

drop policy if exists receituario_protocolos_leitura on public.receituario_protocolos;
create policy receituario_protocolos_leitura on public.receituario_protocolos
  for select to authenticated
  using ((select public.receituario_sou_equipe()));

drop policy if exists receituario_protocolos_gestor_write on public.receituario_protocolos;
create policy receituario_protocolos_gestor_write on public.receituario_protocolos
  for all to authenticated
  using ((select public.sou_gestor()) and not (select public.fila_sou_totem()))
  with check ((select public.sou_gestor()) and not (select public.fila_sou_totem()));

revoke all on public.receituario_protocolos from anon;
grant select, insert, update, delete on public.receituario_protocolos to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Prescrições Emitidas e Rascunhos (RF-05 a RF-08, Seção 9)
-- ---------------------------------------------------------------------------
create table if not exists public.receituario_prescricoes (
  id uuid primary key default gen_random_uuid(),
  codigo_verificacao text not null unique,
  paciente_id uuid references public.receituario_pacientes(id) on delete set null,
  cliente_id bigint references public.dados_cliente(id) on delete set null,
  fila_item_id uuid,
  paciente_snapshot jsonb not null,
  veterinario_id uuid references public.fila_veterinarios(id) on delete set null,
  veterinario_nome text not null,
  veterinario_crmv text not null,
  entrada_clinica text,
  hipotese_diagnostica text,
  alerta_seguranca jsonb not null default '{"nivel":"baixo","mensagem":null}'::jsonb,
  itens_prescricao jsonb not null default '[]'::jsonb,
  cronograma jsonb not null default '[]'::jsonb,
  observacoes_gerais text,
  status text not null default 'emitida' check (status in ('rascunho', 'emitida', 'cancelada')),
  responsabilidade_confirmada boolean not null default false,
  override_alerta_justificativa text,
  modalidade_assinatura text not null default 'icp_brasil_crmv' check (modalidade_assinatura in ('icp_brasil_crmv', 'gov_br', 'vidaas_birdid', 'assinatura_eletronica_crmv')),
  hash_sha256 text not null,
  assinado_em timestamptz not null default now(),
  tempo_emissao_segundos integer check (tempo_emissao_segundos is null or tempo_emissao_segundos >= 0),
  itens_sugeridos_ia integer not null default 0,
  itens_mantidos_ia integer not null default 0,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists receituario_prescricoes_codigo_idx on public.receituario_prescricoes(codigo_verificacao);
create index if not exists receituario_prescricoes_paciente_idx on public.receituario_prescricoes(paciente_id, created_at desc);
create index if not exists receituario_prescricoes_cliente_idx on public.receituario_prescricoes(cliente_id, created_at desc);

alter table public.receituario_prescricoes enable row level security;

drop policy if exists receituario_prescricoes_equipe_all on public.receituario_prescricoes;
create policy receituario_prescricoes_equipe_all on public.receituario_prescricoes
  for all to authenticated
  using ((select public.receituario_sou_equipe()))
  with check ((select public.receituario_sou_equipe()));

revoke all on public.receituario_prescricoes from anon;
grant select, insert, update on public.receituario_prescricoes to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Auditoria Clínica da IA (RNF Auditoria Clínica - Seção 6)
-- ---------------------------------------------------------------------------
create table if not exists public.receituario_auditoria_ia (
  id uuid primary key default gen_random_uuid(),
  prescricao_id uuid references public.receituario_prescricoes(id) on delete set null,
  usuario_id uuid references auth.users(id) on delete set null,
  prompt_enviado text not null,
  contexto_paciente jsonb not null,
  sugestao_bruta_ia jsonb not null,
  alertas_hard_rules jsonb not null default '[]'::jsonb,
  itens_finais_confirmados jsonb,
  origem_motor text not null default 'ia_hibrido' check (origem_motor in ('openai_llm', 'copiloto_deterministico', 'ia_hibrido')),
  tempo_processamento_ms integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists receituario_auditoria_ia_prescricao_idx on public.receituario_auditoria_ia(prescricao_id);
create index if not exists receituario_auditoria_ia_created_idx on public.receituario_auditoria_ia(created_at desc);

alter table public.receituario_auditoria_ia enable row level security;

drop policy if exists receituario_auditoria_ia_leitura on public.receituario_auditoria_ia;
create policy receituario_auditoria_ia_leitura on public.receituario_auditoria_ia
  for select to authenticated
  using ((select public.receituario_sou_equipe()));

drop policy if exists receituario_auditoria_ia_insercao on public.receituario_auditoria_ia;
create policy receituario_auditoria_ia_insercao on public.receituario_auditoria_ia
  for insert to authenticated
  with check ((select public.receituario_sou_equipe()));

drop policy if exists receituario_auditoria_ia_atualizacao on public.receituario_auditoria_ia;
create policy receituario_auditoria_ia_atualizacao on public.receituario_auditoria_ia
  for update to authenticated
  using ((select public.receituario_sou_equipe()))
  with check ((select public.receituario_sou_equipe()));

revoke all on public.receituario_auditoria_ia from anon;
grant select, insert, update on public.receituario_auditoria_ia to authenticated;

-- ---------------------------------------------------------------------------
-- 7. RPCs de Salvamento de Paciente e Validação Pública de Receita (QR Code)
-- ---------------------------------------------------------------------------

-- Salva ou atualiza paciente e sincroniza com dados_cliente
create or replace function public.salvar_paciente_receituario(
  p_id uuid default null,
  p_cliente_id bigint default null,
  p_tutor_nome text default null,
  p_tutor_telefone text default null,
  p_nome text default null,
  p_especie text default 'canina',
  p_raca text default null,
  p_sexo text default 'macho',
  p_castrado boolean default false,
  p_idade_texto text default null,
  p_peso_kg numeric default null,
  p_mutacao_mdr1 boolean default false,
  p_comorbidades text[] default '{}'::text[],
  p_alergias text[] default '{}'::text[],
  p_observacoes text default null
)
returns public.receituario_pacientes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_papel text := public.perfil_papel();
  v_paciente public.receituario_pacientes;
  v_especie text := lower(coalesce(nullif(btrim(p_especie), ''), 'canina'));
  v_raca_lower text := lower(coalesce(p_raca, ''));
  v_mdr1_auto boolean := coalesce(p_mutacao_mdr1, false);
begin
  if v_papel is null or v_papel = 'totem' or public.fila_sou_totem() then
    raise exception 'Não autorizado para gerenciar pacientes do receituário.' using errcode = '42501';
  end if;

  if p_peso_kg is null or p_peso_kg <= 0 or p_peso_kg > 250 then
    raise exception 'Informe um peso válido entre 0,05 kg e 250 kg.';
  end if;

  if v_especie not in ('canina', 'felina', 'silvestre') then
    v_especie := 'canina';
  end if;

  -- Detecção automática preventiva de raças predispostas à mutação MDR1 (ABCB1)
  if v_especie = 'canina' and (
    v_raca_lower like '%collie%' or
    v_raca_lower like '%shetland%' or
    v_raca_lower like '%pastor australiano%' or
    v_raca_lower like '%australian shepherd%' or
    v_raca_lower like '%old english%' or
    v_raca_lower like '%sheepdog%' or
    v_raca_lower like '%whippet%' or
    v_raca_lower like '%pastor branco%'
  ) then
    v_mdr1_auto := true;
  end if;

  if p_id is not null then
    update public.receituario_pacientes
    set
      cliente_id = coalesce(p_cliente_id, cliente_id),
      tutor_nome = coalesce(nullif(btrim(p_tutor_nome), ''), tutor_nome),
      tutor_telefone = coalesce(nullif(btrim(p_tutor_telefone), ''), tutor_telefone),
      nome = coalesce(nullif(btrim(p_nome), ''), nome),
      especie = v_especie,
      raca = nullif(btrim(p_raca), ''),
      sexo = coalesce(p_sexo, sexo),
      castrado = coalesce(p_castrado, castrado),
      idade_texto = nullif(btrim(p_idade_texto), ''),
      peso_kg = p_peso_kg,
      mutacao_mdr1 = v_mdr1_auto,
      comorbidades = coalesce(p_comorbidades, '{}'::text[]),
      alergias = coalesce(p_alergias, '{}'::text[]),
      observacoes = nullif(btrim(p_observacoes), ''),
      updated_at = now()
    where id = p_id
    returning * into v_paciente;
  end if;

  if v_paciente.id is null then
    insert into public.receituario_pacientes (
      cliente_id, tutor_nome, tutor_telefone, nome, especie, raca, sexo,
      castrado, idade_texto, peso_kg, mutacao_mdr1, comorbidades, alergias, observacoes
    ) values (
      p_cliente_id,
      coalesce(nullif(btrim(p_tutor_nome), ''), 'Tutor'),
      nullif(btrim(p_tutor_telefone), ''),
      coalesce(nullif(btrim(p_nome), ''), 'Paciente'),
      v_especie,
      nullif(btrim(p_raca), ''),
      coalesce(p_sexo, 'macho'),
      coalesce(p_castrado, false),
      nullif(btrim(p_idade_texto), ''),
      p_peso_kg,
      v_mdr1_auto,
      coalesce(p_comorbidades, '{}'::text[]),
      coalesce(p_alergias, '{}'::text[]),
      nullif(btrim(p_observacoes), '')
    )
    returning * into v_paciente;
  end if;

  -- Sincroniza nome_pet e raca_pet no cadastro do cliente se houver vínculo
  if v_paciente.cliente_id is not null and to_regclass('public.dados_cliente') is not null then
    begin
      update public.dados_cliente
      set
        nome_pet = coalesce(v_paciente.nome, nome_pet),
        raca_pet = coalesce(v_paciente.raca, raca_pet)
      where id = v_paciente.cliente_id;
    exception when others then
      null;
    end;
  end if;

  return v_paciente;
end;
$$;

revoke all on function public.salvar_paciente_receituario(uuid, bigint, text, text, text, text, text, text, boolean, text, numeric, boolean, text[], text[], text) from public, anon;
grant execute on function public.salvar_paciente_receituario(uuid, bigint, text, text, text, text, text, text, boolean, text, numeric, boolean, text[], text[], text) to authenticated;

-- Validação pública de Receita por QR Code (RNF Segurança e Privacidade / LGPD:
-- retorna autenticidade, primeiro nome do tutor mascarado, dados do pet, veterinário/CRMV,
-- itens prescritos e hash SHA-256 sem expor telefone/CPF do tutor)
create or replace function public.validar_receita_publica(p_codigo text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rec public.receituario_prescricoes;
  v_clinica text := 'Clínica Veterinária';
  v_tutor_bruto text;
  v_tutor_mascarado text;
begin
  if p_codigo is null or char_length(btrim(p_codigo)) < 6 then
    return jsonb_build_object('valida', false, 'motivo', 'Código de verificação inválido.');
  end if;

  select * into v_rec
  from public.receituario_prescricoes
  where upper(btrim(codigo_verificacao)) = upper(btrim(p_codigo))
  limit 1;

  if not found then
    return jsonb_build_object('valida', false, 'motivo', 'Receita não encontrada para o código informado.');
  end if;

  if to_regclass('public.atendimento_config') is not null then
    select coalesce(nullif(btrim(nome_empresa), ''), 'Clínica Veterinária')
    into v_clinica
    from public.atendimento_config
    where singleton
    limit 1;
  end if;

  v_tutor_bruto := coalesce(v_rec.paciente_snapshot->>'tutor_nome', 'Tutor');
  v_tutor_mascarado := split_part(btrim(v_tutor_bruto), ' ', 1) || ' ***';

  return jsonb_build_object(
    'valida', v_rec.status = 'emitida' and v_rec.responsabilidade_confirmada,
    'status', v_rec.status,
    'codigo_verificacao', v_rec.codigo_verificacao,
    'clinica', v_clinica,
    'veterinario_nome', v_rec.veterinario_nome,
    'veterinario_crmv', v_rec.veterinario_crmv,
    'modalidade_assinatura', v_rec.modalidade_assinatura,
    'hash_sha256', v_rec.hash_sha256,
    'assinado_em', v_rec.assinado_em,
    'paciente', jsonb_build_object(
      'nome', coalesce(v_rec.paciente_snapshot->>'nome', 'Paciente'),
      'especie', coalesce(v_rec.paciente_snapshot->>'especie', 'canina'),
      'raca', v_rec.paciente_snapshot->>'raca',
      'peso_kg', v_rec.paciente_snapshot->'peso_kg',
      'tutor_mascarado', v_tutor_mascarado
    ),
    'itens_prescricao', v_rec.itens_prescricao,
    'cronograma', v_rec.cronograma
  );
end;
$$;

grant execute on function public.validar_receita_publica(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Seeds Determinísticos do Bulário Veterinário e Protocolos Rápidos
-- ---------------------------------------------------------------------------
insert into public.receituario_bulario (
  slug, principio_ativo, nome_comercial_sugerido, classe_terapeutica, tipo_padrao, icone_via,
  especies_permitidas, especies_contraindicadas, motivo_contraindicacao_especie,
  risco_mdr1, mensagem_mdr1,
  dose_padrao_mg_kg, dose_min_mg_kg, dose_max_mg_kg, dose_toxica_mg_kg, dose_felina_max_mg_kg, alerta_felino_especifico,
  frequencia_horas_padrao, duracao_dias_padrao, condicao_alimentar,
  apresentacoes, interacoes_classes, comorbidades_cautela, orientacoes_padrao, palavras_chave
) values
(
  'amoxicilina-clavulanato',
  'Amoxicilina + Clavulanato de Potássio',
  'Synulox 250 mg',
  'antibiotico_betalactamico',
  'industrializado',
  'oral',
  array['canina', 'felina'],
  array['silvestre'],
  'Risco severo de disbiose e enterotoxemia fatal em pequenos mamíferos herbívoros (coelhos, roedores).',
  false, null,
  15.0, 12.5, 25.0, 50.0, null, null,
  12, 10, 'com_alimento',
  '[{"rotulo":"Synulox 50 mg","forma":"comprimido","concentracao_mg":50,"divisivel":true},{"rotulo":"Synulox 250 mg","forma":"comprimido","concentracao_mg":250,"divisivel":true},{"rotulo":"Synulox 500 mg","forma":"comprimido","concentracao_mg":500,"divisivel":true},{"rotulo":"Synulox Suspensão 50 mg/mL","forma":"suspensao_ml","concentracao_mg_ml":50}]'::jsonb,
  array[]::text[],
  array['alergia_penicilina'],
  'Administrar logo após as refeições para evitar desconforto gástrico.',
  array['infecção', 'piodermite', 'otite', 'abscesso', 'ferida', 'cistite', 'itu', 'pneumonia', 'amoxicilina', 'synulox']
),
(
  'cefalexina',
  'Cefalexina Monoidratada',
  'Rilexine 300 mg',
  'antibiotico_cefalosporina',
  'industrializado',
  'oral',
  array['canina', 'felina'],
  array['silvestre'],
  'Contraindicado por via oral em coelhos e roedores devido ao risco de enterotoxemia por Clostridium.',
  false, null,
  25.0, 15.0, 30.0, 60.0, null, null,
  12, 14, 'com_alimento',
  '[{"rotulo":"Rilexine 75 mg","forma":"comprimido","concentracao_mg":75,"divisivel":true},{"rotulo":"Rilexine 300 mg","forma":"comprimido","concentracao_mg":300,"divisivel":true},{"rotulo":"Rilexine 600 mg","forma":"comprimido","concentracao_mg":600,"divisivel":true}]'::jsonb,
  array[]::text[],
  array['insuficiencia_renal', 'alergia_penicilina'],
  'Oferecer junto com alimento para reduzir náuseas e melhorar a tolerância digestiva.',
  array['piodermite', 'pele', 'dermatite', 'foliculite', 'cefalexina', 'rilexine']
),
(
  'doxiciclina',
  'Hiclato de Doxiciclina',
  'Doxitrat 80 mg',
  'antibiotico_tetraciclina',
  'industrializado',
  'oral',
  array['canina', 'felina'],
  array[]::text[],
  null,
  false, null,
  5.0, 5.0, 10.0, 25.0, 10.0,
  'Em felinos, administrar SEMPRE seguido de 3 a 5 mL de água ou alimento úmido para prevenir esofagite e estenose esofágica.',
  12, 21, 'com_alimento',
  '[{"rotulo":"Doxitrat 80 mg","forma":"comprimido","concentracao_mg":80,"divisivel":true},{"rotulo":"Doxitrat 200 mg","forma":"comprimido","concentracao_mg":200,"divisivel":true}]'::jsonb,
  array['antiacido'],
  array['gestante', 'filhote', 'insuficiencia_hepatica'],
  'Administrar junto com refeição. Não oferecer junto com laticínios ou suplementos de cálcio/ferro.',
  array['erliquiose', 'carrapato', 'hemoparasitose', 'micoplasma', 'tosse', 'traqueobronquite', 'doxiciclina', 'doxitrat']
),
(
  'enrofloxacino',
  'Enrofloxacino',
  'Baytril Flavour 50 mg',
  'antibiotico_fluoroquinolona',
  'industrializado',
  'oral',
  array['canina', 'felina', 'silvestre'],
  array[]::text[],
  null,
  false, null,
  5.0, 5.0, 10.0, 15.0, 5.0,
  'ATENÇÃO FELINOS: Nunca exceder 5 mg/kg/dia em gatos devido ao risco de degeneração retiniana aguda e cegueira irreversível.',
  24, 10, 'livre',
  '[{"rotulo":"Baytril 15 mg","forma":"comprimido","concentracao_mg":15,"divisivel":true},{"rotulo":"Baytril 50 mg","forma":"comprimido","concentracao_mg":50,"divisivel":true},{"rotulo":"Baytril 150 mg","forma":"comprimido","concentracao_mg":150,"divisivel":true}]'::jsonb,
  array['antiacido'],
  array['filhote', 'gestante', 'epilepsia'],
  'Administrar a cada 24 horas. Evitar uso concomitante com antiácidos ou sucralfato no mesmo horário.',
  array['enrofloxacino', 'baytril', 'itu', 'cistite bacteriana', 'otite pseudomonas']
),
(
  'meloxicam',
  'Meloxicam',
  'Maxicam 0,5 mg',
  'aine',
  'industrializado',
  'oral',
  array['canina', 'felina'],
  array[]::text[],
  null,
  false, null,
  0.1, 0.05, 0.2, 0.3, 0.1,
  'Em felinos, limitar a dose a 0,05–0,1 mg/kg por curto período (máx. 3 a 5 dias) monitorando função renal.',
  24, 4, 'com_alimento',
  '[{"rotulo":"Flamavet 0,2 mg (Gatos)","forma":"comprimido","concentracao_mg":0.2,"divisivel":true},{"rotulo":"Maxicam 0,5 mg","forma":"comprimido","concentracao_mg":0.5,"divisivel":true},{"rotulo":"Maxicam 2,0 mg","forma":"comprimido","concentracao_mg":2.0,"divisivel":true}]'::jsonb,
  array['corticoide', 'aine'],
  array['insuficiencia_renal', 'insuficiencia_hepatica', 'ulcera_gastrica', 'gestante'],
  'Administrar obrigatoriamente após a alimentação. Suspender imediatamente em caso de vômito ou fezes escuras.',
  array['dor', 'inflamação', 'artrose', 'pós-operatório', 'claudicação', 'meloxicam', 'maxicam', 'flamavet']
),
(
  'prednisolona',
  'Prednisolona',
  'Prediderm 5 mg',
  'corticoide',
  'industrializado',
  'oral',
  array['canina', 'felina'],
  array[]::text[],
  null,
  false, null,
  1.0, 0.5, 2.0, 4.0, null, null,
  24, 5, 'com_alimento',
  '[{"rotulo":"Prediderm 5 mg","forma":"comprimido","concentracao_mg":5,"divisivel":true},{"rotulo":"Prediderm 20 mg","forma":"comprimido","concentracao_mg":20,"divisivel":true}]'::jsonb,
  array['aine'],
  array['diabetes', 'insuficiencia_renal', 'ulcera_gastrica', 'gestante'],
  'Administrar pela manhã (em cães) ou à noite (em gatos) após refeição. Pode aumentar sede e volume urinário.',
  array['alergia', 'prurido', 'coceira', 'otite', 'dermatite', 'inflamação', 'prednisolona', 'prediderm']
),
(
  'dipirona',
  'Dipirona Sódica',
  'Dipirona Gotas Vet 500 mg/mL',
  'analgesico_antipiretico',
  'industrializado',
  'oral',
  array['canina', 'felina'],
  array[]::text[],
  null,
  false, null,
  25.0, 15.0, 28.0, 50.0, 25.0,
  'Em felinos, usar intervalo de 12/12h ou 24/24h e diluir ou encapsular para evitar sialorreia intensa pelo sabor amargo.',
  8, 4, 'com_alimento',
  '[{"rotulo":"Dipirona Gotas 500 mg/mL (25 mg/gota)","forma":"gotas","concentracao_mg_gota":25,"concentracao_mg_ml":500},{"rotulo":"Dipirona Comprimido 500 mg","forma":"comprimido","concentracao_mg":500,"divisivel":true}]'::jsonb,
  array[]::text[],
  array['insuficiencia_hepatica', 'discrasia_sanguinea'],
  'Administrar 1 gota por kg de peso corporal (ou conforme dose calculada). Em gatos, pode causar salivação passageira.',
  array['febre', 'dor', 'analgesia', 'dipirona', 'hipertermia']
),
(
  'oclacitinib',
  'Maleato de Oclacitinib',
  'Apoquel 5,4 mg',
  'imunomodulador_jak',
  'industrializado',
  'oral',
  array['canina', 'felina'],
  array[]::text[],
  null,
  false, null,
  0.5, 0.4, 0.6, 1.2, null, null,
  12, 14, 'livre',
  '[{"rotulo":"Apoquel 3,6 mg","forma":"comprimido","concentracao_mg":3.6,"divisivel":true},{"rotulo":"Apoquel 5,4 mg","forma":"comprimido","concentracao_mg":5.4,"divisivel":true},{"rotulo":"Apoquel 16 mg","forma":"comprimido","concentracao_mg":16,"divisivel":true}]'::jsonb,
  array[]::text[],
  array['filhote', 'neoplasia'],
  'Pode ser administrado com ou sem alimento. Manter a cada 12h nos primeiros 14 dias.',
  array['prurido', 'coceira', 'atopia', 'dermatite alérgica', 'apoquel', 'oclacitinib']
),
(
  'maropitant',
  'Citrato de Maropitant',
  'Cerenia 24 mg',
  'antiemetico',
  'industrializado',
  'oral',
  array['canina', 'felina'],
  array[]::text[],
  null,
  false, null,
  2.0, 1.0, 2.5, 8.0, 2.0, null,
  24, 4, 'livre',
  '[{"rotulo":"Cerenia 16 mg","forma":"comprimido","concentracao_mg":16,"divisivel":true},{"rotulo":"Cerenia 24 mg","forma":"comprimido","concentracao_mg":24,"divisivel":true},{"rotulo":"Cerenia 60 mg","forma":"comprimido","concentracao_mg":60,"divisivel":true},{"rotulo":"Cerenia 160 mg","forma":"comprimido","concentracao_mg":160,"divisivel":true}]'::jsonb,
  array[]::text[],
  array['insuficiencia_hepatica'],
  'Administrar 1 vez ao dia com um pequeno petisco para evitar desconforto gástrico.',
  array['vômito', 'êmese', 'náusea', 'gastroenterite', 'cerenia', 'maropitant']
),
(
  'omeprazol',
  'Omeprazol',
  'Gaviz V 10 mg',
  'antiacido',
  'industrializado',
  'oral',
  array['canina', 'felina'],
  array[]::text[],
  null,
  false, null,
  1.0, 0.7, 1.5, 5.0, null, null,
  24, 10, 'jejum',
  '[{"rotulo":"Gaviz V 10 mg","forma":"comprimido","concentracao_mg":10,"divisivel":true},{"rotulo":"Gaviz V 20 mg","forma":"comprimido","concentracao_mg":20,"divisivel":true}]'::jsonb,
  array['antibiotico_fluoroquinolona', 'antibiotico_tetraciclina'],
  array[]::text[],
  'Administrar em jejum, 30 minutos antes da primeira refeição da manhã.',
  array['gastrite', 'vômito', 'protetor gástrico', 'omeprazol', 'gaviz']
),
(
  'gabapentina-manipulada',
  'Gabapentina (Fórmula Manipulada)',
  'Gabapentina Manipulada',
  'analgesico_neuropatico',
  'manipulado',
  'oral',
  array['canina', 'felina'],
  array[]::text[],
  null,
  false, null,
  10.0, 5.0, 20.0, 40.0, 15.0, null,
  12, 14, 'livre',
  '[{"rotulo":"Biscoito Palatável Manipulado","forma":"manipulado"},{"rotulo":"Pasta Oral Palatável","forma":"manipulado"},{"rotulo":"Suspensão Oral Saborizada","forma":"manipulado"}]'::jsonb,
  array[]::text[],
  array['insuficiencia_renal'],
  'Administrar no horário programado. Pode causar leve sonolência nas primeiras 48 horas.',
  array['dor crônica', 'dor neuropática', 'cistite', 'ansiedade', 'estresse', 'gabapentina', 'fisiatria']
),
(
  'solucao-otologica-posatex',
  'Orbifloxacino + Mometasona + Posaconazol',
  'Posatex Suspensão Otológica',
  'otologico_topico',
  'industrializado',
  'otica',
  array['canina', 'felina'],
  array[]::text[],
  null,
  false, null,
  0.5, 0.2, 1.0, 3.0, null, null,
  24, 7, 'uso_externo',
  '[{"rotulo":"Posatex Frasco 17,5 mL (Gotas Otológicas)","forma":"gotas_otologicas"}]'::jsonb,
  array[]::text[],
  array['timpano_perfurado'],
  'Limpar o conduto auditivo previamente com ceruminolítico, aguardar 20 minutos, aplicar as gotas e massagear a base da orelha.',
  array['otite', 'otite fúngica', 'otite bacteriana', 'malassezia', 'orelha', 'ouvido', 'posatex', 'auritop', 'otomax']
),
(
  'ivermectina',
  'Ivermectina',
  'Mectimax 3 mg',
  'antiparasitario_avermectina',
  'industrializado',
  'oral',
  array['canina', 'felina', 'silvestre'],
  array[]::text[],
  null,
  true,
  'RISCO CRÍTICO MDR1 (ABCB1): Contraindicado em doses antiparasitárias para raças sensíveis (Collie, Pastor de Shetland, Pastor Australiano, Border Collie, Old English Sheepdog, Whippet) ou portadores de mutação MDR1 — risco de neurotoxicidade grave, coma e óbito.',
  0.4, 0.2, 0.6, 1.0, null, null,
  24, 14, 'com_alimento',
  '[{"rotulo":"Mectimax 3 mg","forma":"comprimido","concentracao_mg":3,"divisivel":true},{"rotulo":"Mectimax 12 mg","forma":"comprimido","concentracao_mg":12,"divisivel":true}]'::jsonb,
  array[]::text[],
  array['filhote'],
  'Administrar exclusivamente conforme orientação veterinária rigorosa.',
  array['ivermectina', 'mectimax', 'sarna', 'escabiose', 'demodicose']
),
(
  'tramadol',
  'Cloridrato de Tramadol',
  'Cronidor 40 mg',
  'opioide_atipico',
  'industrializado',
  'oral',
  array['canina', 'felina'],
  array[]::text[],
  null,
  false, null,
  3.0, 2.0, 5.0, 10.0, 2.0,
  'Em felinos, utilizar 1 a 2 mg/kg a cada 12h; pode causar disforia e midríase.',
  12, 5, 'com_alimento',
  '[{"rotulo":"Cronidor 12 mg","forma":"comprimido","concentracao_mg":12,"divisivel":true},{"rotulo":"Cronidor 40 mg","forma":"comprimido","concentracao_mg":40,"divisivel":true},{"rotulo":"Cronidor 80 mg","forma":"comprimido","concentracao_mg":80,"divisivel":true}]'::jsonb,
  array['antidepressivo_triciclico'],
  array['epilepsia', 'insuficiencia_hepatica', 'insuficiencia_renal'],
  'Administrar após alimentação. Observar eventual sedação.',
  array['dor intensa', 'dor moderada', 'ortopedia', 'tramadol', 'cronidor']
),
(
  'amitriptilina-manipulada',
  'Cloridrato de Amitriptilina (Manipulado)',
  'Amitriptilina Gel Transdérmico / Biscoito',
  'antidepressivo_triciclico',
  'manipulado',
  'oral',
  array['canina', 'felina'],
  array[]::text[],
  null,
  false, null,
  1.0, 0.5, 2.0, 5.0, 1.5, null,
  24, 30, 'livre',
  '[{"rotulo":"Gel Transdérmico Auricular","forma":"manipulado"},{"rotulo":"Pasta Oral Saborizada","forma":"manipulado"}]'::jsonb,
  array['opioide_atipico'],
  array['cardiopatia', 'insuficiencia_hepatica'],
  'Administrar no mesmo horário diariamente. Não interromper abruptamente sem orientação.',
  array['cistite idiopática', 'ansiedade', 'lambedura psicogênica', 'amitriptilina']
),
(
  'paracetamol',
  'Paracetamol (Acetaminofeno)',
  'Paracetamol 500 mg',
  'analgesico_antipiretico',
  'industrializado',
  'oral',
  array['canina'],
  array['felina'],
  'BLOQUEIO CRÍTICO DE SEGURANÇA: O Paracetamol é ALTAMENTE TÓXICO E LETAL para felinos (deficiência de glucuronil-transferase), causando metemoglobinemia, anemia por corpúsculos de Heinz e necrose hepática fulminante mesmo em 1 dose.',
  false, null,
  10.0, 10.0, 15.0, 25.0, 0.0,
  'PROIBIDO EM FELINOS: Toxicidade letal absoluta.',
  12, 3, 'com_alimento',
  '[{"rotulo":"Comprimido 500 mg","forma":"comprimido","concentracao_mg":500,"divisivel":true}]'::jsonb,
  array['aine'],
  array['insuficiencia_hepatica', 'insuficiencia_renal'],
  'Uso restrito exclusivamente à espécie canina sob supervisão estrita. Jamais administrar em gatos.',
  array['paracetamol', 'acetaminofeno', 'tylenol']
),
(
  'ibuprofeno',
  'Ibuprofeno',
  'Ibuprofeno',
  'aine',
  'industrializado',
  'oral',
  array[]::text[],
  array['canina', 'felina', 'silvestre'],
  'BLOQUEIO CRÍTICO DE SEGURANÇA: O Ibuprofeno é contraindicado em cães e gatos devido ao altíssimo risco de ulceração/perfuração gástrica e insuficiência renal aguda. Substitua por Meloxicam ou Dipirona veterinária.',
  false, null,
  0.0, 0.0, 0.0, 5.0, 0.0, null,
  24, 1, 'com_alimento',
  '[]'::jsonb,
  array['corticoide', 'aine'],
  array['insuficiencia_renal', 'insuficiencia_hepatica'],
  'Contraindicado para uso veterinário em pequenos animais.',
  array['ibuprofeno', 'advil', 'alivium']
),
(
  'permetrina',
  'Permetrina Spot-On',
  'Pulvex Pour-On / Pipeta Canina',
  'ectoparasiticida_piretroide',
  'industrializado',
  'topica',
  array['canina'],
  array['felina'],
  'BLOQUEIO CRÍTICO DE SEGURANÇA: A Permetrina é altamente neurotóxica e potencialmente fatal para felinos (causa fasciculações, hipertermia e estado epiléptico).',
  false, null,
  1.0, 0.5, 2.0, 5.0, 0.0,
  'PROIBIDO EM FELINOS: Neurotoxicidade letal.',
  168, 28, 'uso_externo',
  '[{"rotulo":"Pipeta Tópica Canina 1 mL","forma":"pipeta_topica"}]'::jsonb,
  array[]::text[],
  array[]::text[],
  'Aplicar na região da nuca (dorso) afastando os pelos. Uso exclusivo em cães; manter gatos afastados após aplicação.',
  array['permetrina', 'pulvex', 'carrapato', 'pulga', 'repelente']
),
(
  'loperamida',
  'Cloridrato de Loperamida',
  'Imosec 2 mg',
  'antidiarreico_opioide',
  'industrializado',
  'oral',
  array['canina'],
  array['felina'],
  'Contraindicado em felinos devido ao risco de comportamento excitatório agudo do sistema nervoso central.',
  true,
  'RISCO CRÍTICO MDR1 (ABCB1): A Loperamida atravessa a barreira hematoencefálica em cães com mutação no gene MDR1 (Collie, Pastor Australiano, Shetland, Border Collie, Whippet), provocando depressão profunda do SNC e neurotoxicidade.',
  0.1, 0.08, 0.2, 0.4, 0.0, null,
  12, 3, 'livre',
  '[{"rotulo":"Comprimido 2 mg","forma":"comprimido","concentracao_mg":2,"divisivel":true}]'::jsonb,
  array[]::text[],
  array['diarreia_infecciosa', 'insuficiencia_hepatica'],
  'Uso sob cautela estrita; suspender ao normalizar a consistência fecal.',
  array['loperamida', 'imosec', 'diarreia']
)
on conflict (slug) do update set
  principio_ativo = excluded.principio_ativo,
  nome_comercial_sugerido = excluded.nome_comercial_sugerido,
  classe_terapeutica = excluded.classe_terapeutica,
  tipo_padrao = excluded.tipo_padrao,
  icone_via = excluded.icone_via,
  especies_permitidas = excluded.especies_permitidas,
  especies_contraindicadas = excluded.especies_contraindicadas,
  motivo_contraindicacao_especie = excluded.motivo_contraindicacao_especie,
  risco_mdr1 = excluded.risco_mdr1,
  mensagem_mdr1 = excluded.mensagem_mdr1,
  dose_padrao_mg_kg = excluded.dose_padrao_mg_kg,
  dose_min_mg_kg = excluded.dose_min_mg_kg,
  dose_max_mg_kg = excluded.dose_max_mg_kg,
  dose_toxica_mg_kg = excluded.dose_toxica_mg_kg,
  dose_felina_max_mg_kg = excluded.dose_felina_max_mg_kg,
  alerta_felino_especifico = excluded.alerta_felino_especifico,
  frequencia_horas_padrao = excluded.frequencia_horas_padrao,
  duracao_dias_padrao = excluded.duracao_dias_padrao,
  condicao_alimentar = excluded.condicao_alimentar,
  apresentacoes = excluded.apresentacoes,
  interacoes_classes = excluded.interacoes_classes,
  comorbidades_cautela = excluded.comorbidades_cautela,
  orientacoes_padrao = excluded.orientacoes_padrao,
  palavras_chave = excluded.palavras_chave;

-- Seeds de Protocolos Rápidos (Seção 7.1)
insert into public.receituario_protocolos (
  codigo, titulo, descricao_clinica, especie_alvo, palavras_gatilho, itens_template, ordem
) values
(
  'otite_fungica_bacteriana',
  'Otite Externa Fúngica / Bacteriana',
  'Otite fúngica/bacteriana bilateral moderada com prurido e eritema auricular',
  'ambas',
  array['otite', 'orelha', 'ouvido', 'malassezia', 'cerume', 'otológica'],
  '[{"slug":"solucao-otologica-posatex","frequencia_horas":24,"duracao_dias":7},{"slug":"prednisolona","dose_mg_kg":0.8,"frequencia_horas":24,"duracao_dias":5}]'::jsonb,
  1
),
(
  'piodermite_superficial',
  'Piodermite Superficial + Prurido Alérgico',
  'Piodermite bacteriana superficial associada a dermatite alérgica com prurido intenso',
  'canina',
  array['piodermite', 'foliculite', 'dermatite', 'prurido', 'coceira', 'pústulas'],
  '[{"slug":"cefalexina","dose_mg_kg":25,"frequencia_horas":12,"duracao_dias":14},{"slug":"oclacitinib","dose_mg_kg":0.5,"frequencia_horas":12,"duracao_dias":14}]'::jsonb,
  2
),
(
  'infeccao_tecidos_moles',
  'Infecção Bacteriana / Abscesso / Ferida',
  'Infecção de tecidos moles, ferida contaminada ou abscesso com dor e inflamação aguda',
  'ambas',
  array['abscesso', 'ferida', 'mordedura', 'infecção', 'synulox', 'amoxicilina'],
  '[{"slug":"amoxicilina-clavulanato","dose_mg_kg":15,"frequencia_horas":12,"duracao_dias":10},{"slug":"meloxicam","dose_mg_kg":0.1,"frequencia_horas":24,"duracao_dias":4},{"slug":"dipirona","dose_mg_kg":25,"frequencia_horas":12,"duracao_dias":3}]'::jsonb,
  3
),
(
  'gastroenterite_aguda',
  'Gastroenterite Aguda com Êmese',
  'Quadro agudo de vômitos, náusea e sensibilidade abdominal',
  'ambas',
  array['gastroenterite', 'vômito', 'êmese', 'gastrite', 'náusea'],
  '[{"slug":"maropitant","dose_mg_kg":2.0,"frequencia_horas":24,"duracao_dias":4},{"slug":"omeprazol","dose_mg_kg":1.0,"frequencia_horas":24,"duracao_dias":10},{"slug":"dipirona","dose_mg_kg":25,"frequencia_horas":12,"duracao_dias":3}]'::jsonb,
  4
),
(
  'cistite_idiopatica_felina',
  'Cistite Idiopática Felina (CIF) / Dor Neuropática',
  'Disúria, periúria e desconforto vesical em felino (manejo multimodal e manipulado)',
  'felina',
  array['cistite', 'cif', 'disúria', 'obstrução', 'urinária', 'felina'],
  '[{"slug":"gabapentina-manipulada","dose_mg_kg":10,"frequencia_horas":12,"duracao_dias":14},{"slug":"meloxicam","dose_mg_kg":0.05,"frequencia_horas":24,"duracao_dias":3},{"slug":"amitriptilina-manipulada","dose_mg_kg":1.0,"frequencia_horas":24,"duracao_dias":30}]'::jsonb,
  5
),
(
  'hemoparasitose_erliquiose',
  'Hemoparasitose / Erliquiose / Anaplasmose',
  'Tratamento antimicrobiano de 21 a 28 dias com proteção gástrica e controle de febre',
  'canina',
  array['erliquiose', 'hemoparasitose', 'anaplasma', 'doença do carrapato', 'trombocitopenia'],
  '[{"slug":"doxiciclina","dose_mg_kg":5.0,"frequencia_horas":12,"duracao_dias":21},{"slug":"omeprazol","dose_mg_kg":1.0,"frequencia_horas":24,"duracao_dias":21},{"slug":"dipirona","dose_mg_kg":25,"frequencia_horas":12,"duracao_dias":3}]'::jsonb,
  6
)
on conflict (codigo) do update set
  titulo = excluded.titulo,
  descricao_clinica = excluded.descricao_clinica,
  especie_alvo = excluded.especie_alvo,
  palavras_gatilho = excluded.palavras_gatilho,
  itens_template = excluded.itens_template,
  ordem = excluded.ordem;

-- ---------------------------------------------------------------------------
-- 9. Reaplica a trava restritiva do papel 'totem' nas novas tabelas
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.fila_travar_totem()') is not null then
    perform public.fila_travar_totem();
  end if;
end $$;
