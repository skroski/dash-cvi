-- ============================================================================
-- MÓDULO PRONTUÁRIO COM IA — ESPECIFICAÇÃO AGNÓSTICA SINGLE-TENANT
-- Módulo de Prontuário Veterinário com IA para instalação única (sem clinic_id).
-- Tabelas:
--   1. public.pets                      (Seção 3.9: Cadastro de pets vinculado a dados_cliente)
--   2. public.prontuarios               (Seção 3.1: Registro clínico da consulta + vitais espelhados + hash SHA-256)
--   3. public.internacoes               (Seção 3.2: Ficha de internação hospitalar)
--   4. public.internacao_eventos        (Seção 3.3: Timeline e monitoramento de sinais vitais)
--   5. public.prontuario_ia_drafts      (Seção 3.4: Landing do resultado assíncrono + Realtime + REPLICA IDENTITY FULL)
--   6. public.prontuario_ia_config      (Seção 3.10: Configuração singleton sem default fixo de webhook)
--   7. public.prontuario_consentimentos (Seção 7.2.1: Consentimento do tutor e aviso de transferência internacional)
-- Storage:
--   Bucket privado 'medical-files' com policies para authenticated (path: pet_id/record_id/arquivo)
-- RPCs:
--   - public.confirmar_prontuario_ia            (Seção 6 / G-06 / G-07 / G-14: Commit transacional atômico)
--   - public.expurgar_dados_ia_prontuario       (Seção 7.2.3 / G-10: Retenção e expurgo de áudio/transcrição)
--   - public.eliminar_audio_transcricao_consulta(Seção 7.2.5: Direito de eliminação do titular)
--   - public.exportar_dados_prontuario_tutor    (Seção 7.2.5: Direito de acesso/portabilidade do titular)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Função auxiliar de autorização (usuário autenticado da clínica, bloqueando totem e anon)
-- ---------------------------------------------------------------------------
create or replace function public.prontuario_sou_equipe()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and not coalesce(public.fila_sou_totem(), false)
$$;

revoke all on function public.prontuario_sou_equipe() from public, anon;
grant execute on function public.prontuario_sou_equipe() to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Tabela public.pets (Seção 3.9 — Leitura e vínculo com tutor em dados_cliente)
-- ---------------------------------------------------------------------------
create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  tutor_id bigint references public.dados_cliente(id) on delete set null,
  nome text not null check (char_length(btrim(nome)) >= 1),
  especie text not null default 'canina',
  raca text,
  sexo text not null default 'macho',
  idade integer check (idade is null or idade >= 0),
  peso numeric(6,2) check (peso is null or peso >= 0),
  data_nascimento date,
  porte text,
  castrado boolean default false,
  microchip text,
  status text default 'ativo',
  image_url text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pets_tutor_id on public.pets(tutor_id);
create index if not exists idx_pets_nome on public.pets(nome);

alter table public.pets enable row level security;

drop policy if exists "pets_authenticated_all" on public.pets;
create policy "pets_authenticated_all" on public.pets
  for all to authenticated
  using ((select public.prontuario_sou_equipe()))
  with check ((select public.prontuario_sou_equipe()));

revoke all on public.pets from anon;
grant select, insert, update, delete on public.pets to authenticated;

-- Sincroniza pacientes já existentes em receituario_pacientes para public.pets (mesmo UUID)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'receituario_pacientes'
  ) then
    insert into public.pets (
      id, tutor_id, nome, especie, raca, sexo, idade, peso, castrado, observacoes, created_at, updated_at
    )
    select
      rp.id,
      rp.cliente_id,
      rp.nome,
      rp.especie,
      rp.raca,
      coalesce(rp.sexo, 'macho'),
      case when rp.idade_meses is not null then greatest(0, rp.idade_meses / 12) else null end,
      rp.peso_kg,
      rp.castrado,
      rp.observacoes,
      rp.created_at,
      rp.updated_at
    from public.receituario_pacientes rp
    on conflict (id) do update set
      tutor_id = excluded.tutor_id,
      nome = excluded.nome,
      especie = excluded.especie,
      raca = excluded.raca,
      peso = coalesce(excluded.peso, public.pets.peso),
      castrado = excluded.castrado,
      observacoes = coalesce(excluded.observacoes, public.pets.observacoes),
      updated_at = now();
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Tabela public.prontuarios (Seção 3.1)
-- ---------------------------------------------------------------------------
create table if not exists public.prontuarios (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  data_consulta timestamptz not null default now(),
  motivo_consulta text not null default 'Nova Consulta',
  status text default 'em_andamento' check (status is null or status in ('em_andamento', 'finalizado', 'alta', 'obito')),
  tipo_atendimento text default 'consulta' check (tipo_atendimento is null or tipo_atendimento in ('consulta', 'cirurgia', 'internacao', 'emergencia')),
  veterinario text,
  crmv_responsavel text not null default '',
  anamnese jsonb,
  exame_fisico jsonb,
  anexos jsonb default '[]'::jsonb,
  sintomas text,
  diagnostico text,
  diagnostico_definitivo text,
  cid_vet text,
  hipoteses_diagnosticas text[],
  medicamentos text,
  tratamento text,
  observacoes text,
  procedimentos_realizados jsonb,
  proxima_consulta text,
  assinatura_digital text,
  confirmado_em timestamptz,
  peso_atual numeric,
  temperatura numeric,
  frequencia_cardiaca integer,
  frequencia_respiratoria integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.prontuarios add column if not exists confirmado_em timestamptz;
alter table public.prontuarios add column if not exists assinatura_digital text;
alter table public.prontuarios add column if not exists anexos jsonb default '[]'::jsonb;

create index if not exists idx_prontuarios_pet_status on public.prontuarios(pet_id, status, created_at desc);

alter table public.prontuarios enable row level security;

drop policy if exists "prontuarios_authenticated_all" on public.prontuarios;
create policy "prontuarios_authenticated_all" on public.prontuarios
  for all to authenticated
  using ((select public.prontuario_sou_equipe()))
  with check ((select public.prontuario_sou_equipe()));

revoke all on public.prontuarios from anon;
grant select, insert, update, delete on public.prontuarios to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Tabela public.internacoes (Seção 3.2)
-- ---------------------------------------------------------------------------
create table if not exists public.internacoes (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  prontuario_id uuid references public.prontuarios(id) on delete set null,
  motivo text,
  box text,
  data_entrada timestamptz not null default now(),
  previsao_alta date,
  data_alta timestamptz,
  status text not null default 'internado' check (status in ('internado', 'alta', 'obito')),
  objetos_com_pet text,
  alergias text[],
  sintomas_entrada text,
  observacoes text,
  responsavel text,
  crmv_responsavel text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_internacoes_pet_status on public.internacoes(pet_id, status);

alter table public.internacoes enable row level security;

drop policy if exists "internacoes_authenticated_all" on public.internacoes;
create policy "internacoes_authenticated_all" on public.internacoes
  for all to authenticated
  using ((select public.prontuario_sou_equipe()))
  with check ((select public.prontuario_sou_equipe()));

revoke all on public.internacoes from anon;
grant select, insert, update, delete on public.internacoes to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Tabela public.internacao_eventos (Seção 3.3)
-- ---------------------------------------------------------------------------
create table if not exists public.internacao_eventos (
  id uuid primary key default gen_random_uuid(),
  internacao_id uuid not null references public.internacoes(id) on delete cascade,
  tipo text not null check (tipo in ('medicamento', 'evolucao', 'checkin', 'monitoramento', 'alta')),
  descricao text,
  temperatura numeric,
  frequencia_cardiaca integer,
  frequencia_respiratoria integer,
  pressao_sistolica integer,
  status text default 'realizado' check (status is null or status in ('realizado', 'pendente')),
  responsavel text,
  horario timestamptz not null default now(),
  created_at timestamptz default now()
);

create index if not exists idx_internacao_eventos_internacao_horario on public.internacao_eventos(internacao_id, horario);

alter table public.internacao_eventos enable row level security;

drop policy if exists "internacao_eventos_authenticated_all" on public.internacao_eventos;
create policy "internacao_eventos_authenticated_all" on public.internacao_eventos
  for all to authenticated
  using ((select public.prontuario_sou_equipe()))
  with check ((select public.prontuario_sou_equipe()));

revoke all on public.internacao_eventos from anon;
grant select, insert, update, delete on public.internacao_eventos to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Tabela public.prontuario_ia_drafts (Seção 3.4, G-03, G-04)
--    Single-tenant: audio_path no lugar de audio_url, sem clinic_id e sem created_by.
-- ---------------------------------------------------------------------------
create table if not exists public.prontuario_ia_drafts (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  prontuario_id uuid not null references public.prontuarios(id) on delete cascade,
  audio_anexo_id text not null,
  audio_path text,
  transcript text,
  payload jsonb,
  status text not null default 'pending' check (status in ('pending', 'ready', 'error', 'committed')),
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (prontuario_id, audio_anexo_id)
);

create index if not exists idx_pia_drafts_record_status on public.prontuario_ia_drafts(prontuario_id, status);

-- G-04: Garante que o evento UPDATE do Supabase Realtime entregue a linha completa (payload + transcript)
alter table public.prontuario_ia_drafts replica identity full;

alter table public.prontuario_ia_drafts enable row level security;

drop policy if exists "prontuario_ia_drafts_authenticated_all" on public.prontuario_ia_drafts;
create policy "prontuario_ia_drafts_authenticated_all" on public.prontuario_ia_drafts
  for all to authenticated
  using ((select public.prontuario_sou_equipe()))
  with check ((select public.prontuario_sou_equipe()));

revoke all on public.prontuario_ia_drafts from anon;
grant select, insert, update, delete on public.prontuario_ia_drafts to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.prontuario_ia_drafts;
  end if;
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Tabela public.prontuario_ia_config (Seção 3.10, G-02)
--    Linha única (id = 1), sem default fixo de webhook_url no código.
-- ---------------------------------------------------------------------------
create table if not exists public.prontuario_ia_config (
  id int primary key default 1 check (id = 1),
  webhook_url text,
  system_prompt text,
  veterinario_nome text,
  crmv_responsavel text,
  retencao_dias integer default 90 check (retencao_dias is null or retencao_dias >= 1),
  updated_at timestamptz default now()
);

insert into public.prontuario_ia_config (id, webhook_url, system_prompt, veterinario_nome, crmv_responsavel, retencao_dias)
values (1, null, null, null, null, 90)
on conflict (id) do nothing;

alter table public.prontuario_ia_config enable row level security;

drop policy if exists "prontuario_ia_config_authenticated_all" on public.prontuario_ia_config;
create policy "prontuario_ia_config_authenticated_all" on public.prontuario_ia_config
  for all to authenticated
  using ((select public.prontuario_sou_equipe()))
  with check ((select public.prontuario_sou_equipe()));

revoke all on public.prontuario_ia_config from anon;
grant select, insert, update on public.prontuario_ia_config to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Tabela public.prontuario_consentimentos (Seção 7.2 item 1, G-09)
--    Registra o consentimento informado do tutor e aviso de transferência internacional
-- ---------------------------------------------------------------------------
create table if not exists public.prontuario_consentimentos (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  tutor_id bigint references public.dados_cliente(id) on delete set null,
  prontuario_id uuid references public.prontuarios(id) on delete set null,
  texto_versao text not null,
  operadores_informados text not null default 'Groq Inc. (Whisper) e OpenAI OpCo, LLC (GPT) — processamento nos EUA',
  aceito_em timestamptz not null default now()
);

create index if not exists idx_prontuario_consentimentos_pet on public.prontuario_consentimentos(pet_id, aceito_em desc);

alter table public.prontuario_consentimentos enable row level security;

drop policy if exists "prontuario_consentimentos_authenticated_all" on public.prontuario_consentimentos;
create policy "prontuario_consentimentos_authenticated_all" on public.prontuario_consentimentos
  for all to authenticated
  using ((select public.prontuario_sou_equipe()))
  with check ((select public.prontuario_sou_equipe()));

revoke all on public.prontuario_consentimentos from anon;
grant select, insert, update, delete on public.prontuario_consentimentos to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Bucket privado 'medical-files' e Policies de Storage (Seção 3.8)
--    Path single-tenant: {pet_id}/{record_id}/{arquivo}
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public)
    values ('medical-files', 'medical-files', false)
    on conflict (id) do update set public = false;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'objects'
  ) then
    execute 'drop policy if exists "medical_files_authenticated_select" on storage.objects';
    execute 'create policy "medical_files_authenticated_select" on storage.objects for select to authenticated using (bucket_id = ''medical-files'' and public.prontuario_sou_equipe())';

    execute 'drop policy if exists "medical_files_authenticated_insert" on storage.objects';
    execute 'create policy "medical_files_authenticated_insert" on storage.objects for insert to authenticated with check (bucket_id = ''medical-files'' and public.prontuario_sou_equipe())';

    execute 'drop policy if exists "medical_files_authenticated_update" on storage.objects';
    execute 'create policy "medical_files_authenticated_update" on storage.objects for update to authenticated using (bucket_id = ''medical-files'' and public.prontuario_sou_equipe())';

    execute 'drop policy if exists "medical_files_authenticated_delete" on storage.objects';
    execute 'create policy "medical_files_authenticated_delete" on storage.objects for delete to authenticated using (bucket_id = ''medical-files'' and public.prontuario_sou_equipe())';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 9. RPC Transacional de Commit: public.confirmar_prontuario_ia (Seção 6, G-06, G-07, G-14)
--    Executa os passos 1 a 4 numa única transação atômica:
--      (a) Atualiza prontuarios (JSON + vitais espelhados + confirmado_em + assinatura_digital SHA-256)
--      (b) Anexa a transcrição em prontuarios.anexos[] (se informada)
--      (c) Faz upsert em internacoes + insere internacao_eventos (mapeando fc -> frequencia_cardiaca e fr -> frequencia_respiratoria)
--      (d) Marca prontuario_ia_drafts.status = 'committed' (falhando se o draft não puder ser atualizado)
--    Se qualquer etapa falhar (ex.: T8 falha na internação), toda a transação sofre rollback.
-- ---------------------------------------------------------------------------
create or replace function public.confirmar_prontuario_ia(
  p_pet_id uuid,
  p_record_id uuid,
  p_draft_id uuid default null,
  p_edited jsonb default '{}'::jsonb,
  p_hash_sha256 text default null,
  p_confirmado_em timestamptz default now(),
  p_transcript_anexo jsonb default null,
  p_veterinario text default null,
  p_crmv_responsavel text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rec public.prontuarios%rowtype;
  v_anamnese jsonb;
  v_exame jsonb;
  v_diag jsonb;
  v_internacao jsonb;
  v_anexos jsonb;
  v_hipoteses text[];
  v_peso numeric;
  v_temp numeric;
  v_fc integer;
  v_fr integer;
  v_internacao_id uuid;
  v_evento jsonb;
  v_draft_rows integer;
  v_confirmado timestamptz := coalesce(p_confirmado_em, now());
begin
  if not public.prontuario_sou_equipe() then
    raise exception 'Acesso negado: usuário não autenticado.';
  end if;

  select * into v_rec
  from public.prontuarios
  where id = p_record_id and pet_id = p_pet_id
  for update;

  if not found then
    raise exception 'Prontuário % não encontrado para o pet %.', p_record_id, p_pet_id;
  end if;

  v_anamnese := case
    when p_edited ? 'anamnese' and jsonb_typeof(p_edited->'anamnese') = 'object'
    then p_edited->'anamnese'
    else v_rec.anamnese
  end;

  v_exame := case
    when p_edited ? 'exame_fisico' and jsonb_typeof(p_edited->'exame_fisico') = 'object'
    then p_edited->'exame_fisico'
    else v_rec.exame_fisico
  end;

  v_diag := case
    when p_edited ? 'diagnostico' and jsonb_typeof(p_edited->'diagnostico') = 'object'
    then p_edited->'diagnostico'
    else null
  end;

  v_internacao := case
    when p_edited ? 'internacao' and jsonb_typeof(p_edited->'internacao') = 'object'
    then p_edited->'internacao'
    else null
  end;

  -- Espelhamento dos sinais vitais a partir de exame_fisico (Seção 3.1 e 6)
  v_peso := case
    when v_exame is not null and v_exame ? 'peso' and jsonb_typeof(v_exame->'peso') = 'number'
    then (v_exame->>'peso')::numeric
    else v_rec.peso_atual
  end;

  v_temp := case
    when v_exame is not null and v_exame ? 'temperatura' and jsonb_typeof(v_exame->'temperatura') = 'number'
    then (v_exame->>'temperatura')::numeric
    else v_rec.temperatura
  end;

  v_fc := case
    when v_exame is not null and v_exame ? 'fc' and jsonb_typeof(v_exame->'fc') = 'number'
    then round((v_exame->>'fc')::numeric)::integer
    else v_rec.frequencia_cardiaca
  end;

  v_fr := case
    when v_exame is not null and v_exame ? 'fr' and jsonb_typeof(v_exame->'fr') = 'number'
    then round((v_exame->>'fr')::numeric)::integer
    else v_rec.frequencia_respiratoria
  end;

  -- Hipóteses diagnósticas text[]
  if v_diag is not null and v_diag ? 'hipoteses_diagnosticas' and jsonb_typeof(v_diag->'hipoteses_diagnosticas') = 'array' then
    select coalesce(array_agg(elem), '{}'::text[])
    into v_hipoteses
    from jsonb_array_elements_text(v_diag->'hipoteses_diagnosticas') as elem
    where btrim(elem) <> '';
  else
    v_hipoteses := v_rec.hipoteses_diagnosticas;
  end if;

  -- Anexo de transcrição (Seção 6 passo 3)
  v_anexos := coalesce(v_rec.anexos, '[]'::jsonb);
  if p_transcript_anexo is not null and jsonb_typeof(p_transcript_anexo) = 'object' then
    v_anexos := v_anexos || jsonb_build_array(p_transcript_anexo);
  end if;

  -- (1) e (2) Atualiza prontuarios com dados revisados, vitais espelhados, anexo de transcrição, confirmado_em e assinatura_digital (G-07)
  update public.prontuarios
  set
    anamnese = v_anamnese,
    exame_fisico = v_exame,
    peso_atual = v_peso,
    temperatura = v_temp,
    frequencia_cardiaca = v_fc,
    frequencia_respiratoria = v_fr,
    diagnostico_definitivo = coalesce(v_diag->>'diagnostico_definitivo', v_rec.diagnostico_definitivo),
    diagnostico = coalesce(v_diag->>'diagnostico_definitivo', v_rec.diagnostico),
    cid_vet = coalesce(v_diag->>'cid_vet', v_rec.cid_vet),
    hipoteses_diagnosticas = v_hipoteses,
    tratamento = coalesce(v_diag->>'tratamento', v_rec.tratamento),
    medicamentos = coalesce(v_diag->>'medicamentos', v_rec.medicamentos),
    observacoes = coalesce(v_diag->>'observacoes', v_rec.observacoes),
    veterinario = coalesce(nullif(btrim(p_veterinario), ''), v_rec.veterinario),
    crmv_responsavel = coalesce(nullif(btrim(p_crmv_responsavel), ''), v_rec.crmv_responsavel),
    anexos = v_anexos,
    confirmado_em = v_confirmado,
    assinatura_digital = coalesce(nullif(btrim(p_hash_sha256), ''), v_rec.assinatura_digital),
    updated_at = now()
  where id = p_record_id;

  -- Atualiza peso do pet no cadastro se informado no exame físico
  if v_peso is not null and v_peso > 0 then
    update public.pets set peso = v_peso, updated_at = now() where id = p_pet_id;
  end if;

  -- (3) Internação e eventos (Seção 5.2 e Seção 6 passo 4)
  if v_internacao is not null then
    select i.id into v_internacao_id
    from public.internacoes i
    where i.pet_id = p_pet_id and i.status = 'internado'
    order by i.data_entrada desc
    limit 1
    for update;

    if v_internacao_id is not null then
      update public.internacoes
      set
        prontuario_id = p_record_id,
        motivo = coalesce(v_internacao->>'motivo', motivo),
        box = coalesce(v_internacao->>'box', box),
        previsao_alta = case
          when v_internacao ? 'previsao_alta' and nullif(btrim(v_internacao->>'previsao_alta'), '') is not null
          then (v_internacao->>'previsao_alta')::date
          else previsao_alta
        end,
        objetos_com_pet = coalesce(v_internacao->>'objetos_com_pet', objetos_com_pet),
        alergias = case
          when v_internacao ? 'alergias' and jsonb_typeof(v_internacao->'alergias') = 'array'
          then array(select jsonb_array_elements_text(v_internacao->'alergias'))
          else alergias
        end,
        sintomas_entrada = coalesce(v_internacao->>'sintomas_entrada', sintomas_entrada),
        observacoes = coalesce(v_internacao->>'observacoes', observacoes),
        responsavel = coalesce(nullif(btrim(p_veterinario), ''), responsavel),
        crmv_responsavel = coalesce(nullif(btrim(p_crmv_responsavel), ''), crmv_responsavel),
        updated_at = now()
      where id = v_internacao_id;
    else
      insert into public.internacoes (
        pet_id,
        prontuario_id,
        motivo,
        box,
        previsao_alta,
        status,
        objetos_com_pet,
        alergias,
        sintomas_entrada,
        observacoes,
        responsavel,
        crmv_responsavel
      ) values (
        p_pet_id,
        p_record_id,
        v_internacao->>'motivo',
        v_internacao->>'box',
        case
          when v_internacao ? 'previsao_alta' and nullif(btrim(v_internacao->>'previsao_alta'), '') is not null
          then (v_internacao->>'previsao_alta')::date
          else null
        end,
        'internado',
        v_internacao->>'objetos_com_pet',
        case
          when v_internacao ? 'alergias' and jsonb_typeof(v_internacao->'alergias') = 'array'
          then array(select jsonb_array_elements_text(v_internacao->'alergias'))
          else null
        end,
        v_internacao->>'sintomas_entrada',
        v_internacao->>'observacoes',
        nullif(btrim(p_veterinario), ''),
        nullif(btrim(p_crmv_responsavel), '')
      )
      returning id into v_internacao_id;
    end if;

    -- Insere eventos da internação mapeando fc -> frequencia_cardiaca e fr -> frequencia_respiratoria (Seção 5.2)
    if v_internacao ? 'eventos' and jsonb_typeof(v_internacao->'eventos') = 'array' then
      for v_evento in select * from jsonb_array_elements(v_internacao->'eventos')
      loop
        insert into public.internacao_eventos (
          internacao_id,
          tipo,
          descricao,
          temperatura,
          frequencia_cardiaca,
          frequencia_respiratoria,
          pressao_sistolica,
          responsavel,
          horario
        ) values (
          v_internacao_id,
          coalesce(v_evento->>'tipo', 'evolucao'),
          v_evento->>'descricao',
          case when v_evento ? 'temperatura' and jsonb_typeof(v_evento->'temperatura') = 'number' then (v_evento->>'temperatura')::numeric else null end,
          case
            when v_evento ? 'fc' and jsonb_typeof(v_evento->'fc') = 'number' then round((v_evento->>'fc')::numeric)::integer
            when v_evento ? 'frequencia_cardiaca' and jsonb_typeof(v_evento->'frequencia_cardiaca') = 'number' then round((v_evento->>'frequencia_cardiaca')::numeric)::integer
            else null
          end,
          case
            when v_evento ? 'fr' and jsonb_typeof(v_evento->'fr') = 'number' then round((v_evento->>'fr')::numeric)::integer
            when v_evento ? 'frequencia_respiratoria' and jsonb_typeof(v_evento->'frequencia_respiratoria') = 'number' then round((v_evento->>'frequencia_respiratoria')::numeric)::integer
            else null
          end,
          case when v_evento ? 'pressao_sistolica' and jsonb_typeof(v_evento->'pressao_sistolica') = 'number' then round((v_evento->>'pressao_sistolica')::numeric)::integer else null end,
          nullif(btrim(p_veterinario), ''),
          case
            when v_evento ? 'horario' and nullif(btrim(v_evento->>'horario'), '') is not null
            then (v_evento->>'horario')::timestamptz
            else now()
          end
        );
      end loop;
    end if;
  end if;

  -- (4) Marca o draft como committed (G-14: trata explicitamente se o draft não existir)
  if p_draft_id is not null then
    update public.prontuario_ia_drafts
    set status = 'committed', updated_at = now()
    where id = p_draft_id;

    get diagnostics v_draft_rows = row_count;
    if v_draft_rows = 0 then
      raise exception 'Rascunho de IA % não encontrado para confirmação.', p_draft_id;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'record_id', p_record_id,
    'internacao_id', v_internacao_id,
    'confirmado_em', v_confirmado,
    'assinatura_digital', p_hash_sha256
  );
end;
$$;

revoke all on function public.confirmar_prontuario_ia(uuid, uuid, uuid, jsonb, text, timestamptz, jsonb, text, text) from public, anon;
grant execute on function public.confirmar_prontuario_ia(uuid, uuid, uuid, jsonb, text, timestamptz, jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Rotinas de Conformidade LGPD (Seção 7.2 itens 3, 5 e 6 — G-10)
-- ---------------------------------------------------------------------------

-- 10.1 Expurgo de transcrição e áudio bruto de rascunhos antigos (Retenção G-10)
create or replace function public.expurgar_dados_ia_prontuario(p_dias integer default 90)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_corte timestamptz := now() - make_interval(days => greatest(1, coalesce(p_dias, 90)));
  v_paths text[];
  v_count integer := 0;
begin
  if not public.prontuario_sou_equipe() then
    raise exception 'Acesso negado.';
  end if;

  select coalesce(array_agg(audio_path), '{}'::text[])
  into v_paths
  from public.prontuario_ia_drafts
  where created_at < v_corte
    and status in ('committed', 'error')
    and (transcript is not null or audio_path is not null);

  update public.prontuario_ia_drafts
  set
    transcript = null,
    audio_path = null,
    payload = case when payload is not null then payload - 'transcript' - '_evidence' else null end,
    updated_at = now()
  where created_at < v_corte
    and status in ('committed', 'error')
    and (transcript is not null or audio_path is not null);

  get diagnostics v_count = row_count;

  return jsonb_build_object(
    'expurgados', v_count,
    'audio_paths_para_remover', to_jsonb(v_paths),
    'corte', v_corte
  );
end;
$$;

revoke all on function public.expurgar_dados_ia_prontuario(integer) from public, anon;
grant execute on function public.expurgar_dados_ia_prontuario(integer) to authenticated;

-- 10.2 Direito de eliminação de áudio e transcrição de uma consulta específica (preservando o registro clínico CFMV)
create or replace function public.eliminar_audio_transcricao_consulta(p_prontuario_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_paths text[];
  v_anexos_filtrados jsonb;
begin
  if not public.prontuario_sou_equipe() then
    raise exception 'Acesso negado.';
  end if;

  select coalesce(array_agg(audio_path), '{}'::text[])
  into v_paths
  from public.prontuario_ia_drafts
  where prontuario_id = p_prontuario_id
    and audio_path is not null;

  update public.prontuario_ia_drafts
  set
    transcript = null,
    audio_path = null,
    payload = case when payload is not null then payload - 'transcript' - '_evidence' else null end,
    updated_at = now()
  where prontuario_id = p_prontuario_id;

  select coalesce(
    jsonb_agg(elem) filter (
      where coalesce(elem->>'origem', '') not in ('audio_consulta', 'transcricao')
        and coalesce(elem->>'type', '') not in ('audio', 'transcript')
    ),
    '[]'::jsonb
  )
  into v_anexos_filtrados
  from public.prontuarios p,
       lateral jsonb_array_elements(coalesce(p.anexos, '[]'::jsonb)) as elem
  where p.id = p_prontuario_id;

  update public.prontuarios
  set anexos = coalesce(v_anexos_filtrados, '[]'::jsonb), updated_at = now()
  where id = p_prontuario_id;

  return jsonb_build_object(
    'ok', true,
    'prontuario_id', p_prontuario_id,
    'audio_paths_removidos', to_jsonb(v_paths)
  );
end;
$$;

revoke all on function public.eliminar_audio_transcricao_consulta(uuid) from public, anon;
grant execute on function public.eliminar_audio_transcricao_consulta(uuid) to authenticated;

-- 10.3 Direito de acesso/exportação dos dados de prontuário do pet (Seção 7.2 item 5)
create or replace function public.exportar_dados_prontuario_tutor(p_pet_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pet jsonb;
  v_prontuarios jsonb;
  v_internacoes jsonb;
  v_consentimentos jsonb;
begin
  if not public.prontuario_sou_equipe() then
    raise exception 'Acesso negado.';
  end if;

  select to_jsonb(p.*) into v_pet from public.pets p where p.id = p_pet_id;
  if v_pet is null then
    raise exception 'Pet % não encontrado.', p_pet_id;
  end if;

  select coalesce(jsonb_agg(to_jsonb(pr.*) order by pr.data_consulta desc), '[]'::jsonb)
  into v_prontuarios
  from public.prontuarios pr
  where pr.pet_id = p_pet_id;

  select coalesce(jsonb_agg(to_jsonb(i.*) order by i.data_entrada desc), '[]'::jsonb)
  into v_internacoes
  from public.internacoes i
  where i.pet_id = p_pet_id;

  select coalesce(jsonb_agg(to_jsonb(c.*) order by c.aceito_em desc), '[]'::jsonb)
  into v_consentimentos
  from public.prontuario_consentimentos c
  where c.pet_id = p_pet_id;

  return jsonb_build_object(
    'exportado_em', now(),
    'pet', v_pet,
    'prontuarios', v_prontuarios,
    'internacoes', v_internacoes,
    'consentimentos', v_consentimentos
  );
end;
$$;

revoke all on function public.exportar_dados_prontuario_tutor(uuid) from public, anon;
grant execute on function public.exportar_dados_prontuario_tutor(uuid) to authenticated;
