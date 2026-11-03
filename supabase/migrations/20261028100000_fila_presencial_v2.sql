-- Fila presencial v2: tudo o que o sistema separado (Node + SQLite) ganhou, agora no Supabase.
--
--   1. fila_config (singleton): marca, TV, cupom, numeração, fuso e avisos por WhatsApp.
--   2. fila_midias + bucket de Storage: playlist de vídeos da TV.
--   3. Senha diária (ciclo) com índice único (ciclo, senha). A restrição antiga, de senha
--      única para sempre, impedia reiniciar a numeração e é removida aqui.
--   4. "Chamar próximo" atômico (FOR UPDATE SKIP LOCKED) e trava de estados encerrados.
--   5. TV pública sem dados pessoais quando a privacidade está ligada. A regra roda no
--      SERVIDOR: o RPC é público (anon) e não pode depender do navegador.
--   6. Aviso à TV por Broadcast (sem dados pessoais): a TV atualiza na hora.
--   7. Avisos ao tutor por WhatsApp, pela outbox que já existe (atendimento_outbox).
--      Nascem DESLIGADOS (fila_config.whatsapp_ativo = false).
--   8. Papel 'totem' (autoatendimento) com menor privilégio e trava restritiva de RLS.
--
-- Idempotente. Não altera migrações anteriores. Requer: fila_itens (20260829/20260902),
-- profiles/perfil_papel()/sou_gestor() (20260725100000).
-- O banco só muda por arquivo de migração: aplique com `supabase db push` ou no SQL Editor.

-- ---------------------------------------------------------------------------
-- 0. Pré-requisitos
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.fila_itens') is null
     or to_regprocedure('public.sou_gestor()') is null
     or to_regprocedure('public.perfil_papel()') is null
     or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'fila_itens' and column_name = 'historico_transferencias') then
    raise exception 'Pré-requisitos ausentes: aplique a base da fila (01_base_fila.sql, ou as migrações 20260829 e 20260902) e a migração de perfis/papéis antes desta.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. Configuração da fila (singleton)
-- ---------------------------------------------------------------------------

-- Se existia a versão legada chave/valor (ou sem singleton), substitui pela modelagem singleton v2
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'fila_config'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'fila_config' and column_name = 'singleton'
  ) then
    drop table public.fila_config cascade;
  end if;
end $$;

create table if not exists public.fila_config (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),

  -- Aparência (TV, totem e cupom). Nome vazio = usa o da empresa em atendimento_config.
  nome_exibicao text check (nome_exibicao is null or char_length(btrim(nome_exibicao)) between 1 and 80),
  subtitulo text not null default 'Painel de Atendimento Presencial' check (char_length(subtitulo) <= 80),
  cor_marca text not null default '#2294aa' check (cor_marca ~ '^#[0-9a-fA-F]{6}$'),
  logo_path text check (logo_path is null or char_length(logo_path) <= 200),

  -- TV
  tv_som boolean not null default true,
  tv_privacidade boolean not null default false,
  tv_layout text not null default 'lateral' check (tv_layout in ('lateral', 'tela_cheia', 'video_16_9')),
  tv_video_mudo boolean not null default true,
  tv_aviso_segundos smallint not null default 12 check (tv_aviso_segundos between 4 and 60),
  -- A TV é pública (qualquer um com a chave anon do projeto consulta o RPC): por padrão NÃO mostra nome de tutor.
  tv_mostrar_tutor boolean not null default false,

  -- Cupom térmico
  cupom_largura_mm text not null default '58' check (cupom_largura_mm in ('58', '80')),
  cupom_rodape text not null default 'Acompanhe pelo telão da sala de espera.' check (char_length(cupom_rodape) <= 120),
  cupom_logo boolean not null default true,

  -- Numeração: reinicia todo dia no fuso da clínica (ou contínua).
  numeracao_diaria boolean not null default true,
  fuso_horario text not null default 'America/Sao_Paulo',

  -- Totem
  totem_pede_telefone boolean not null default false,

  -- Avisos por WhatsApp (chave geral desligada de fábrica)
  whatsapp_ativo boolean not null default false,
  -- Primeiro contato proativo pela instância não oficial aumenta o risco de bloqueio do número: por padrão
  -- só avisa quem já tem conversa com a clínica (atendimento_conversas). Desligue com consentimento do tutor.
  wpp_somente_conhecidos boolean not null default true,
  wpp_avisar_emissao boolean not null default true,
  wpp_avisar_proximo smallint not null default 2 check (wpp_avisar_proximo between 0 and 20),
  wpp_avisar_chamada boolean not null default true,
  wpp_avisar_ausente boolean not null default false,
  wpp_msg_emissao text not null default 'Olá, {{tutor}}! Sua senha na {{clinica}} é *{{senha}}* ({{servico}}). Acompanhe pelo painel da sala de espera. 🐾'
    check (char_length(wpp_msg_emissao) between 1 and 600),
  wpp_msg_proximo text not null default '{{tutor}}, falta pouco! Sua vez na {{clinica}} está chegando: {{a_frente}} à frente da senha *{{senha}}*.'
    check (char_length(wpp_msg_proximo) between 1 and 600),
  wpp_msg_chamada text not null default '🔔 Senha *{{senha}}* chamada! {{pet_ou_tutor}}, dirija-se ao *{{sala}}*.'
    check (char_length(wpp_msg_chamada) between 1 and 600),
  wpp_msg_ausente text not null default 'Chamamos a senha *{{senha}}* e não encontramos você. Procure a recepção da {{clinica}} para ser reposicionado.'
    check (char_length(wpp_msg_ausente) between 1 and 600),

  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

comment on table public.fila_config is
  'Configuração única da fila presencial (marca, TV, cupom, numeração, avisos por WhatsApp).';

-- Semeia o fuso a partir de atendimento_config quando existir (uma só fonte de verdade para o fuso).
do $$
declare
  v_fuso text;
begin
  if to_regclass('public.atendimento_config') is not null then
    execute 'select fuso_horario from public.atendimento_config limit 1' into v_fuso;
  end if;
  insert into public.fila_config (singleton, fuso_horario)
  values (true, coalesce(v_fuso, 'America/Sao_Paulo'))
  on conflict (singleton) do nothing;
end $$;

-- Fuso inválido derrubaria a emissão de TODAS as senhas: valida antes de gravar.
create or replace function public.fila_config_valida()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  begin
    perform now() at time zone new.fuso_horario;
  exception when others then
    raise exception 'Fuso horário inválido: %', new.fuso_horario using errcode = '22023';
  end;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists fila_config_valida on public.fila_config;
create trigger fila_config_valida
  before insert or update on public.fila_config
  for each row execute function public.fila_config_valida();

alter table public.fila_config enable row level security;

drop policy if exists "fila_config equipe le" on public.fila_config;
create policy "fila_config equipe le" on public.fila_config
  for select to authenticated using (true);
drop policy if exists "fila_config gestor altera" on public.fila_config;
create policy "fila_config gestor altera" on public.fila_config
  for update to authenticated using (public.sou_gestor()) with check (public.sou_gestor());

revoke all on public.fila_config from anon, authenticated;
grant select, update on public.fila_config to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Playlist de vídeos da TV
-- ---------------------------------------------------------------------------

create table if not exists public.fila_midias (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 1 and 120),
  -- Caminho no bucket 'fila-midias' (envio pelo painel) OU endereço externo (CDN/servidor da clínica).
  arquivo_path text check (arquivo_path is null or char_length(arquivo_path) <= 300),
  url_externa text check (url_externa is null or url_externa ~* '^https?://'),
  tamanho_bytes bigint not null default 0 check (tamanho_bytes >= 0),
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  check (arquivo_path is not null or url_externa is not null)
);

create index if not exists fila_midias_ordem_idx on public.fila_midias (ordem, created_at);

alter table public.fila_midias enable row level security;

drop policy if exists "fila_midias equipe le" on public.fila_midias;
create policy "fila_midias equipe le" on public.fila_midias
  for select to authenticated using (true);
drop policy if exists "fila_midias gestor configura" on public.fila_midias;
create policy "fila_midias gestor configura" on public.fila_midias
  for all to authenticated using (public.sou_gestor()) with check (public.sou_gestor());

revoke all on public.fila_midias from anon, authenticated;
grant select, insert, update, delete on public.fila_midias to authenticated;

-- Bucket público de leitura (a TV não tem login); escrita só de gestor.
do $$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'Storage indisponível: crie o bucket público "fila-midias" manualmente.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'fila-midias', 'fila-midias', true, 524288000,
    array['video/mp4', 'video/webm', 'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
  )
  on conflict (id) do update
    set public = true,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists "fila_midias gestor envia" on storage.objects';
  execute $p$create policy "fila_midias gestor envia" on storage.objects
    for insert to authenticated with check (bucket_id = 'fila-midias' and public.sou_gestor())$p$;
  execute 'drop policy if exists "fila_midias gestor atualiza" on storage.objects';
  execute $p$create policy "fila_midias gestor atualiza" on storage.objects
    for update to authenticated using (bucket_id = 'fila-midias' and public.sou_gestor())
    with check (bucket_id = 'fila-midias' and public.sou_gestor())$p$;
  execute 'drop policy if exists "fila_midias gestor remove" on storage.objects';
  execute $p$create policy "fila_midias gestor remove" on storage.objects
    for delete to authenticated using (bucket_id = 'fila-midias' and public.sou_gestor())$p$;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Senha diária (ciclo) e campos novos da senha
-- ---------------------------------------------------------------------------

alter table public.fila_itens
  add column if not exists ciclo text,
  add column if not exists telefone text,
  add column if not exists origem text not null default 'balcao',
  add column if not exists avisos jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.fila_itens'::regclass and conname = 'fila_itens_origem_check'
  ) then
    alter table public.fila_itens
      add constraint fila_itens_origem_check
      check (origem in ('balcao', 'totem', 'whatsapp', 'agenda', 'web'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.fila_itens'::regclass and conname = 'fila_itens_telefone_check'
  ) then
    alter table public.fila_itens
      add constraint fila_itens_telefone_check
      check (telefone is null or telefone ~ '^[0-9]{10,15}$');
  end if;
end $$;

-- Ordem de chamada: Emergência > Preferencial > Normal.
create or replace function public.fila_rank_prioridade(p_prioridade text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_prioridade when 'emergencia' then 0 when 'prioridade' then 1 else 2 end
$$;

-- Dia (ou 'continuo') a que uma senha pertence, no fuso da clínica.
create or replace function public.fila_ciclo(p_em timestamptz default now())
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when c.numeracao_diaria
              then to_char(p_em at time zone c.fuso_horario, 'YYYY-MM-DD')
              else 'continuo' end
  from public.fila_config c
  where c.singleton
$$;

-- Telefone no formato E.164 só com dígitos; sem DDI assume o código do país da empresa (padrão 55).
create or replace function public.fila_normalizar_telefone(p_bruto text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_pais text := '55';
  v_digitos text;
begin
  if p_bruto is null then return null; end if;
  if to_regclass('public.atendimento_config') is not null then
    execute 'select codigo_pais from public.atendimento_config limit 1' into v_pais;
    v_pais := coalesce(nullif(v_pais, ''), '55');
  end if;
  v_digitos := regexp_replace(p_bruto, '\D', '', 'g');
  if v_digitos like '00%' then v_digitos := substr(v_digitos, 3); end if;
  if length(v_digitos) between 10 and 11 then v_digitos := v_pais || v_digitos; end if;
  if v_digitos ~ '^[0-9]{10,15}$' then return v_digitos; end if;
  return null;
end $$;

-- Preenche ciclo e normaliza o telefone em qualquer caminho de inserção.
create or replace function public.fila_itens_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ciclo is null then
    new.ciclo := coalesce(public.fila_ciclo(coalesce(new.chegada_em, now())), 'continuo');
  end if;
  if new.telefone is not null then
    new.telefone := public.fila_normalizar_telefone(new.telefone);
  end if;
  return new;
end $$;

drop trigger if exists fila_itens_defaults on public.fila_itens;
create trigger fila_itens_defaults
  before insert on public.fila_itens
  for each row execute function public.fila_itens_defaults();

-- Senhas já emitidas ficam no dia de chegada (no fuso da clínica).
update public.fila_itens
set ciclo = coalesce(public.fila_ciclo(chegada_em), 'continuo')
where ciclo is null;

alter table public.fila_itens alter column ciclo set not null;

-- A senha deixa de ser única para sempre: passa a ser única dentro do ciclo.
alter table public.fila_itens drop constraint if exists fila_itens_senha_key;
create unique index if not exists fila_itens_ciclo_senha_uq on public.fila_itens (ciclo, senha);
create index if not exists fila_itens_telefone_idx on public.fila_itens (telefone) where telefone is not null;
create index if not exists fila_chamadas_created_idx on public.fila_chamadas (created_at desc);

-- ---------------------------------------------------------------------------
-- 4. Operação da fila (RPCs)
-- ---------------------------------------------------------------------------

-- Quem opera a fila é a equipe. O totem só emite senha.
create or replace function public.fila_exige_equipe()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.ativo and p.papel <> 'totem'
  ) then
    raise exception 'Não autorizado' using errcode = '42501';
  end if;
end $$;

revoke all on function public.fila_exige_equipe() from public, anon;
grant execute on function public.fila_exige_equipe() to authenticated;

-- Emissão de senha: as assinaturas antigas (5 parâmetros, de 20260829, e 9, de 20260902) são
-- substituídas por esta, com 2 opcionais novos. Quem chama com parâmetros nomeados continua
-- funcionando. Duas assinaturas coexistindo dariam "function is not unique" no PostgREST.
drop function if exists public.adicionar_item_fila(uuid, text, text, text, text);
drop function if exists public.adicionar_item_fila(uuid, text, text, text, text, bigint, text, text, uuid);

create or replace function public.adicionar_item_fila(
  p_servico_id uuid,
  p_tutor_nome text,
  p_pet_nome text default null,
  p_veterinario_nome text default null,
  p_prioridade text default 'normal',
  p_cliente_id bigint default null,
  p_pet_id text default null,
  p_motivo_resumido text default null,
  p_sala_id uuid default null,
  p_telefone text default null,
  p_origem text default 'balcao'
) returns public.fila_itens
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_papel text;
  v_cfg public.fila_config;
  v_prefixo text;
  v_ciclo text;
  v_numero integer;
  v_origem text := coalesce(p_origem, 'balcao');
  v_item public.fila_itens;
begin
  select p.papel into v_papel
  from public.profiles p
  where p.id = auth.uid() and p.ativo;
  if v_papel is null then
    raise exception 'Não autorizado' using errcode = '42501';
  end if;

  if nullif(btrim(p_tutor_nome), '') is null then
    raise exception 'Nome do tutor é obrigatório' using errcode = '22023';
  end if;
  if p_prioridade not in ('normal', 'prioridade', 'emergencia') then
    raise exception 'Prioridade inválida' using errcode = '22023';
  end if;
  if v_origem not in ('balcao', 'totem', 'whatsapp', 'agenda', 'web') then
    raise exception 'Origem inválida' using errcode = '22023';
  end if;

  select * into v_cfg from public.fila_config where singleton;

  -- O totem é um aparelho exposto ao público: só informa serviço, nomes, prioridade e (se a
  -- clínica quiser) telefone. Origem e vínculos nunca vêm dele, e há limite de emissões.
  if v_papel = 'totem' then
    v_origem := 'totem';
    p_cliente_id := null;
    p_pet_id := null;
    p_sala_id := null;
    p_veterinario_nome := null;
    p_motivo_resumido := null;
    if not coalesce(v_cfg.totem_pede_telefone, false) then p_telefone := null; end if;
    if (select count(*) from public.fila_itens i
        where i.criado_por = auth.uid() and i.created_at > now() - interval '5 minutes') >= 30 then
      raise exception 'Muitas senhas em pouco tempo. Procure a recepção.' using errcode = '54000';
    end if;
  end if;

  select s.prefixo into v_prefixo from public.fila_servicos s where s.id = p_servico_id and s.ativo;
  if v_prefixo is null then
    raise exception 'Serviço indisponível' using errcode = '22023';
  end if;

  -- Serializa a geração por prefixo: duas recepções (ou o totem) nunca recebem o mesmo número.
  perform pg_advisory_xact_lock(hashtext('fila:' || v_prefixo));

  v_ciclo := coalesce(public.fila_ciclo(now()), 'continuo');

  -- Maior número do prefixo no ciclo. Senhas AINDA ATIVAS de dias anteriores (esquecidas na fila)
  -- também entram na conta: nunca existem duas senhas iguais ativas ao mesmo tempo.
  select coalesce(max(substr(i.senha, length(v_prefixo) + 1)::integer), 0) + 1
  into v_numero
  from public.fila_itens i
  where left(i.senha, length(v_prefixo)) = v_prefixo
    and substr(i.senha, length(v_prefixo) + 1) ~ '^[0-9]{1,9}$'
    and (i.ciclo = v_ciclo or i.status in ('aguardando', 'chamado', 'em_atendimento'));

  insert into public.fila_itens (
    senha, ciclo, servico_id, sala_id, tutor_nome, pet_nome, veterinario_nome, prioridade,
    cliente_id, pet_id, motivo_resumido, telefone, origem, criado_por
  ) values (
    v_prefixo || lpad(v_numero::text, 3, '0'), v_ciclo, p_servico_id, p_sala_id,
    btrim(p_tutor_nome), nullif(btrim(p_pet_nome), ''), nullif(btrim(p_veterinario_nome), ''), p_prioridade,
    p_cliente_id, nullif(btrim(p_pet_id), ''), nullif(btrim(p_motivo_resumido), ''),
    p_telefone, v_origem, auth.uid()
  )
  returning * into v_item;

  return v_item;
end $$;

revoke all on function public.adicionar_item_fila(uuid, text, text, text, text, bigint, text, text, uuid, text, text) from public, anon;
grant execute on function public.adicionar_item_fila(uuid, text, text, text, text, bigint, text, text, uuid, text, text) to authenticated;

-- Mudança de status. Itens finalizados ou cancelados não aceitam mais ações.
drop function if exists public.alterar_status_fila(uuid, text, uuid);

create or replace function public.alterar_status_fila(
  p_item_id uuid,
  p_acao text,
  p_sala_id uuid default null,
  p_novo_servico_id uuid default null,
  p_motivo text default null
)
returns public.fila_itens
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.fila_itens;
  v_proximo text;
begin
  perform public.fila_exige_equipe();

  select * into v_item from public.fila_itens where id = p_item_id for update;
  if not found then
    raise exception 'Item da fila não encontrado' using errcode = 'P0002';
  end if;
  if v_item.status in ('finalizado', 'cancelado') then
    raise exception 'Este atendimento já foi encerrado.' using errcode = '55000';
  end if;
  if p_sala_id is not null and not exists (select 1 from public.fila_salas s where s.id = p_sala_id) then
    raise exception 'Sala inexistente' using errcode = '22023';
  end if;
  if p_novo_servico_id is not null and not exists (select 1 from public.fila_servicos s where s.id = p_novo_servico_id) then
    raise exception 'Serviço inexistente' using errcode = '22023';
  end if;

  case p_acao
    when 'chamar' then
      v_proximo := 'chamado';
      v_item.chamado_em := now();
      v_item.chamado_por := auth.uid();
      if p_sala_id is not null then v_item.sala_id := p_sala_id; end if;
    when 'iniciar' then
      v_proximo := 'em_atendimento';
      v_item.iniciado_em := now();
      v_item.iniciado_por := auth.uid();
      if p_sala_id is not null then v_item.sala_id := p_sala_id; end if;
    when 'finalizar' then
      v_proximo := 'finalizado';
      v_item.finalizado_em := now();
      v_item.finalizado_por := auth.uid();
    when 'ausente' then
      v_proximo := 'ausente';
      v_item.ausente_em := now();
      v_item.ausente_por := auth.uid();
    when 'retornar' then
      v_proximo := 'aguardando';
      v_item.chamado_em := null;
    when 'cancelar' then
      v_proximo := 'cancelado';
      v_item.cancelado_em := now();
      v_item.cancelado_por := auth.uid();
    when 'transferir' then
      -- Mantém status e horário de chegada: quem é transferido não perde a vez.
      v_proximo := v_item.status;
      v_item.historico_transferencias := coalesce(v_item.historico_transferencias, '[]'::jsonb)
        || jsonb_build_object(
          'data', now(),
          'usuario_id', auth.uid(),
          'sala_origem', v_item.sala_id,
          'sala_destino', coalesce(p_sala_id, v_item.sala_id),
          'servico_origem', v_item.servico_id,
          'servico_destino', coalesce(p_novo_servico_id, v_item.servico_id),
          'motivo', nullif(btrim(p_motivo), '')
        );
      if p_sala_id is not null then v_item.sala_id := p_sala_id; end if;
      if p_novo_servico_id is not null then v_item.servico_id := p_novo_servico_id; end if;
    else
      raise exception 'Ação de fila inválida' using errcode = '22023';
  end case;

  update public.fila_itens
  set status = v_proximo,
      sala_id = v_item.sala_id,
      servico_id = v_item.servico_id,
      chamado_em = v_item.chamado_em,
      chamado_por = v_item.chamado_por,
      iniciado_em = v_item.iniciado_em,
      iniciado_por = v_item.iniciado_por,
      finalizado_em = v_item.finalizado_em,
      finalizado_por = v_item.finalizado_por,
      ausente_em = v_item.ausente_em,
      ausente_por = v_item.ausente_por,
      cancelado_em = v_item.cancelado_em,
      cancelado_por = v_item.cancelado_por,
      historico_transferencias = v_item.historico_transferencias,
      updated_at = now()
  where id = p_item_id
  returning * into v_item;

  if p_acao = 'chamar' then
    insert into public.fila_chamadas (item_id, sala_id, chamado_por)
    values (p_item_id, v_item.sala_id, auth.uid());
  end if;

  return v_item;
end $$;

revoke all on function public.alterar_status_fila(uuid, text, uuid, uuid, text) from public, anon;
grant execute on function public.alterar_status_fila(uuid, text, uuid, uuid, text) to authenticated;

-- Chamador do consultório: "Chamar próximo" escolhe e chama em uma só transação.
-- FOR UPDATE SKIP LOCKED: duas salas clicando juntas nunca chamam o mesmo paciente.
create or replace function public.sala_chamar_fila(
  p_sala_id uuid,
  p_item_id uuid default null,
  p_acao text default 'chamar'
)
returns public.fila_itens
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid := p_item_id;
begin
  perform public.fila_exige_equipe();

  if v_target is null and p_acao = 'chamar' then
    if not exists (select 1 from public.fila_salas s where s.id = p_sala_id and s.ativa) then
      raise exception 'Sala inexistente ou desativada.' using errcode = '22023';
    end if;

    select i.id into v_target
    from public.fila_itens i
    where i.status = 'aguardando' and (i.sala_id is null or i.sala_id = p_sala_id)
    order by public.fila_rank_prioridade(i.prioridade), i.chegada_em, i.id
    limit 1
    for update skip locked;

    if v_target is null then
      raise exception 'Nenhum paciente aguardando na fila no momento.' using errcode = 'P0002';
    end if;
  end if;

  return public.alterar_status_fila(v_target, p_acao, p_sala_id);
end $$;

revoke all on function public.sala_chamar_fila(uuid, uuid, text) from public, anon;
grant execute on function public.sala_chamar_fila(uuid, uuid, text) to authenticated;

-- Dados do chamador da sala (mesma saída da versão anterior; só a guarda mudou: o totem não entra).
create or replace function public.sala_obter_fila(p_sala_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sala jsonb;
  v_salas jsonb;
  v_atual jsonb;
  v_proximos jsonb;
begin
  perform public.fila_exige_equipe();

  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'ativa', s.ativa) order by s.nome), '[]'::jsonb)
  into v_salas
  from public.fila_salas s
  where s.ativa;

  if p_sala_id is not null then
    select jsonb_build_object('id', s.id, 'nome', s.nome, 'ativa', s.ativa)
    into v_sala
    from public.fila_salas s
    where s.id = p_sala_id;

    select jsonb_build_object(
      'id', i.id, 'ticket', i.senha, 'tutorName', i.tutor_nome, 'petName', i.pet_nome,
      'veterinarianName', i.veterinario_nome, 'priority', i.prioridade, 'status', i.status,
      'arrivedAt', i.chegada_em, 'calledAt', i.chamado_em, 'startedAt', i.iniciado_em,
      'roomId', i.sala_id, 'roomName', s.nome, 'serviceName', serv.nome
    )
    into v_atual
    from public.fila_itens i
    left join public.fila_salas s on s.id = i.sala_id
    left join public.fila_servicos serv on serv.id = i.servico_id
    where i.sala_id = p_sala_id and i.status in ('chamado', 'em_atendimento')
    order by case i.status when 'em_atendimento' then 0 else 1 end, i.chamado_em desc
    limit 1;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', i.id, 'ticket', i.senha, 'tutorName', i.tutor_nome, 'petName', i.pet_nome,
      'veterinarianName', i.veterinario_nome, 'priority', i.prioridade, 'status', i.status,
      'arrivedAt', i.chegada_em, 'calledAt', i.chamado_em, 'startedAt', i.iniciado_em,
      'roomId', i.sala_id, 'roomName', s.nome, 'serviceName', serv.nome
    ) order by public.fila_rank_prioridade(i.prioridade), i.chegada_em, i.id
  ), '[]'::jsonb)
  into v_proximos
  from public.fila_itens i
  left join public.fila_salas s on s.id = i.sala_id
  left join public.fila_servicos serv on serv.id = i.servico_id
  where i.status = 'aguardando' and (i.sala_id is null or i.sala_id = p_sala_id);

  return jsonb_build_object('sala', v_sala, 'salas', v_salas, 'atual', v_atual, 'proximos', v_proximos);
end $$;

revoke all on function public.sala_obter_fila(uuid) from public, anon;
grant execute on function public.sala_obter_fila(uuid) to authenticated;

-- Itens da fila só nascem pelo RPC (o INSERT direto deixaria qualquer login criar senha com telefone).
drop policy if exists "fila equipe cria itens" on public.fila_itens;
revoke insert on public.fila_itens from authenticated;

-- ---------------------------------------------------------------------------
-- 5. TV pública (anon). Privacidade aplicada AQUI, no servidor.
-- ---------------------------------------------------------------------------

create or replace function public.fila_nome_exibicao()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_nome text;
  v_empresa text;
begin
  select c.nome_exibicao into v_nome from public.fila_config c where c.singleton;
  if v_nome is not null then return v_nome; end if;
  if to_regclass('public.atendimento_config') is not null then
    execute 'select nome_empresa from public.atendimento_config limit 1' into v_empresa;
  end if;
  return coalesce(nullif(btrim(v_empresa), ''), 'Clínica Veterinária');
end $$;

create or replace function public.fila_tv_painel()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.fila_config;
  v_priv boolean;
  v_atual jsonb;
  v_recentes jsonb;
  v_proximos jsonb;
  v_midias jsonb;
  v_aguardando integer;
begin
  select * into c from public.fila_config where singleton;
  v_priv := coalesce(c.tv_privacidade, false);

  -- O tutor só sai pela TV com tv_mostrar_tutor (e, mesmo assim, só o PRIMEIRO nome). Padrão: pet e senha.
  select jsonb_build_object(
    'id', i.id, 'senha', i.senha, 'chamado_em', i.chamado_em, 'sala', s.nome, 'prioridade', i.prioridade,
    'pet', case when v_priv then null else i.pet_nome end,
    'tutor', case when v_priv or not c.tv_mostrar_tutor then null else nullif(split_part(btrim(i.tutor_nome), ' ', 1), '') end,
    'veterinario', case when v_priv then null else i.veterinario_nome end
  )
  into v_atual
  from public.fila_itens i
  left join public.fila_salas s on s.id = i.sala_id
  where i.status = 'chamado'
  order by i.chamado_em desc nulls last
  limit 1;

  select coalesce(jsonb_agg(r.x order by r.ts desc), '[]'::jsonb)
  into v_recentes
  from (
    select d.x, d.ts
    from (
      select distinct on (i.id) ch.created_at as ts,
             jsonb_build_object('id', i.id, 'senha', i.senha, 'sala', s.nome, 'chamado_em', ch.created_at) as x
      from public.fila_chamadas ch
      join public.fila_itens i on i.id = ch.item_id
      left join public.fila_salas s on s.id = ch.sala_id
      where ch.created_at > now() - interval '12 hours'
        and (v_atual is null or i.id <> (v_atual ->> 'id')::uuid)
      order by i.id, ch.created_at desc
    ) d
    order by d.ts desc
    limit 4
  ) r;

  select coalesce(jsonb_agg(w.x order by w.rk, w.chegada_em, w.id), '[]'::jsonb), max(w.total)
  into v_proximos, v_aguardando
  from (
    select i.id, i.chegada_em, public.fila_rank_prioridade(i.prioridade) as rk,
           count(*) over () as total,
           jsonb_build_object('id', i.id, 'senha', i.senha, 'prioridade', i.prioridade,
                              'pet', case when v_priv then null else i.pet_nome end) as x
    from public.fila_itens i
    where i.status = 'aguardando'
    order by public.fila_rank_prioridade(i.prioridade), i.chegada_em, i.id
    limit 8
  ) w;

  select coalesce(jsonb_agg(
    jsonb_build_object('id', m.id, 'nome', m.nome, 'path', m.arquivo_path, 'url', m.url_externa, 'tamanho', m.tamanho_bytes)
    order by m.ordem, m.created_at
  ), '[]'::jsonb)
  into v_midias
  from public.fila_midias m
  where m.ativo;

  return jsonb_build_object(
    'config', jsonb_build_object(
      'nome', public.fila_nome_exibicao(),
      'subtitulo', c.subtitulo,
      'cor_marca', c.cor_marca,
      'logo_path', c.logo_path,
      'tv_som', c.tv_som,
      'tv_privacidade', c.tv_privacidade,
      'tv_layout', c.tv_layout,
      'tv_video_mudo', c.tv_video_mudo,
      'tv_aviso_segundos', c.tv_aviso_segundos
    ),
    'atual', v_atual,
    'recentes', v_recentes,
    'proximos', v_proximos,
    'aguardando', coalesce(v_aguardando, 0),
    'midias', v_midias,
    'agora', now()
  );
end $$;

revoke all on function public.fila_tv_painel() from public;
grant execute on function public.fila_tv_painel() to anon, authenticated;

-- Versão anterior da TV (mesmas colunas), agora também respeitando a privacidade.
create or replace function public.fila_tv_estado()
returns table(
  senha text,
  pet_nome text,
  veterinario_nome text,
  sala text,
  status text,
  chamado_em timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.senha,
         case when c.tv_privacidade then null else i.pet_nome end,
         case when c.tv_privacidade then null else i.veterinario_nome end,
         s.nome, i.status, i.chamado_em
  from public.fila_itens i
  left join public.fila_salas s on s.id = i.sala_id
  cross join public.fila_config c
  where c.singleton and i.status in ('chamado', 'em_atendimento', 'aguardando')
  order by
    case i.status when 'chamado' then 0 when 'em_atendimento' then 1 else 2 end,
    case when i.status = 'chamado' then i.chamado_em else null end desc nulls last,
    i.chegada_em asc
  limit 8;
$$;

revoke all on function public.fila_tv_estado() from public;
grant execute on function public.fila_tv_estado() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Aviso em tempo real para as TVs (Broadcast, SEM dados pessoais)
-- ---------------------------------------------------------------------------
-- A TV não tem login e o Realtime "postgres_changes" respeita a RLS, então ela nunca recebia os
-- eventos das tabelas. O gatilho abaixo só manda um "tick" vazio no tópico público 'fila-tv';
-- ao receber, a TV chama fila_tv_painel() (que aplica a privacidade).

create or replace function public.fila_tv_tick()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
      perform realtime.send('{}'::jsonb, 'tick', 'fila-tv', false);
    end if;
  exception when others then
    null; -- avisar a TV nunca pode derrubar a operação
  end;
  return null;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['fila_itens', 'fila_chamadas', 'fila_config', 'fila_midias', 'fila_salas'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_tv_tick', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each statement execute function public.fila_tv_tick()',
      t || '_tv_tick', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Avisos ao tutor por WhatsApp (reaproveita a outbox do atendimento)
-- ---------------------------------------------------------------------------
-- Envio real depende de TRÊS chaves: fila_config.whatsapp_ativo, o segredo
-- ATENDIMENTO_SEND_ENABLED=true e a instância Uazapi conectada. Tudo nasce desligado.

-- Conversa que o número já tem com a clínica (com ou sem o 9º dígito dos celulares BR), ou NULL.
create or replace function public.fila_conversa_existente(p_telefone text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_cands text[] := array[p_telefone || '@s.whatsapp.net'];
  v_session text;
begin
  if p_telefone ~ '^55[0-9]{2}9[0-9]{8}$' then
    v_cands := v_cands || (substr(p_telefone, 1, 4) || substr(p_telefone, 6) || '@s.whatsapp.net');
  elsif p_telefone ~ '^55[0-9]{2}[0-9]{8}$' then
    v_cands := v_cands || (substr(p_telefone, 1, 4) || '9' || substr(p_telefone, 5) || '@s.whatsapp.net');
  end if;

  if to_regclass('public.atendimento_conversas') is not null then
    execute 'select c.session_id from public.atendimento_conversas c where c.session_id = any($1) '
         || 'order by c.ultima_mensagem_em desc nulls last, (c.session_id = $2) desc limit 1'
      into v_session using v_cands, v_cands[1];
  end if;
  return v_session;
end $$;

-- JID da conversa do tutor: a existente, ou o canônico (<dígitos>@s.whatsapp.net) se ainda não houver.
create or replace function public.fila_session_do_telefone(p_telefone text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.fila_conversa_existente(p_telefone), p_telefone || '@s.whatsapp.net')
$$;

create or replace function public.fila_wpp_texto(
  p_modelo text,
  p_item public.fila_itens,
  p_a_frente integer default null
) returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_servico text;
  v_sala text;
  v_tutor text := coalesce(nullif(split_part(btrim(p_item.tutor_nome), ' ', 1), ''), 'tutor');
  v_pet text := coalesce(p_item.pet_nome, '');
  v_texto text := p_modelo;
begin
  select s.nome into v_servico from public.fila_servicos s where s.id = p_item.servico_id;
  select s.nome into v_sala from public.fila_salas s where s.id = p_item.sala_id;

  v_texto := replace(v_texto, '{{senha}}', p_item.senha);
  v_texto := replace(v_texto, '{{tutor}}', v_tutor);
  v_texto := replace(v_texto, '{{pet}}', v_pet);
  v_texto := replace(v_texto, '{{pet_ou_tutor}}', coalesce(nullif(v_pet, ''), v_tutor));
  v_texto := replace(v_texto, '{{servico}}', coalesce(v_servico, 'atendimento'));
  v_texto := replace(v_texto, '{{sala}}', coalesce(v_sala, 'recepção'));
  v_texto := replace(v_texto, '{{clinica}}', public.fila_nome_exibicao());
  v_texto := replace(v_texto, '{{a_frente}}', coalesce(p_a_frente::text, ''));
  -- Variável desconhecida não pode ir literal para o cliente.
  return btrim(regexp_replace(v_texto, '\{\{[a-z_]+\}\}', '', 'g'));
end $$;

create or replace function public.fila_enfileirar_whatsapp(
  p_item public.fila_itens,
  p_evento text,
  p_texto text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session text;
  v_linhas integer;
begin
  if p_item.telefone is null or nullif(btrim(p_texto), '') is null then return false; end if;
  if to_regclass('public.atendimento_outbox') is null or to_regclass('public.atendimento_conversas') is null then
    return false;
  end if;

  -- Antiabuso: no máximo 3 confirmações de senha por telefone por hora.
  if p_evento = 'emissao' and (
    select count(*) from public.atendimento_outbox o
    where o.destino = p_item.telefone and o.dedupe_key like 'fila:%:emissao'
      and o.criado_em > now() - interval '1 hour'
  ) >= 3 then
    return false;
  end if;

  -- Primeiro contato proativo só com a chave wpp_somente_conhecidos desligada (e não cria conversa à toa).
  v_session := public.fila_conversa_existente(p_item.telefone);
  if v_session is null then
    if coalesce((select c.wpp_somente_conhecidos from public.fila_config c where c.singleton), true) then
      return false;
    end if;
    v_session := p_item.telefone || '@s.whatsapp.net';
  end if;
  insert into public.atendimento_conversas (session_id, nome_contato)
  values (v_session, nullif(btrim(p_item.tutor_nome), ''))
  on conflict (session_id) do nothing;

  -- tipo 'notificacao': sai pelo mesmo envio (bloqueio por telefone, tentativas, chave geral)
  -- sem entrar no histórico nem pausar o assistente da conversa.
  insert into public.atendimento_outbox (session_id, dedupe_key, destino, tipo, conteudo)
  values (v_session, 'fila:' || p_item.id || ':' || p_evento, p_item.telefone, 'notificacao', left(p_texto, 3500))
  on conflict (dedupe_key) do nothing;
  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end $$;

create or replace function public.fila_itens_avisos()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.fila_config;
  v_enviou boolean := false;
  v_ok boolean;
  v_q public.fila_itens;
  r record;
begin
  select * into c from public.fila_config where singleton;
  if not found or not c.whatsapp_ativo then return null; end if;

  begin
    if tg_op = 'INSERT' then
      if new.telefone is not null and c.wpp_avisar_emissao then
        v_ok := public.fila_enfileirar_whatsapp(new, 'emissao', public.fila_wpp_texto(c.wpp_msg_emissao, new));
        if v_ok then
          update public.fila_itens set avisos = avisos || jsonb_build_object('emissao', now()) where id = new.id;
          v_enviou := true;
        end if;
      end if;
    else
      if new.status = 'chamado' and old.status is distinct from 'chamado'
         and new.telefone is not null and c.wpp_avisar_chamada then
        v_ok := public.fila_enfileirar_whatsapp(new, 'chamada', public.fila_wpp_texto(c.wpp_msg_chamada, new));
        if v_ok then
          update public.fila_itens set avisos = avisos || jsonb_build_object('chamada', now()) where id = new.id;
          v_enviou := true;
        end if;
      end if;

      if new.status = 'ausente' and old.status is distinct from 'ausente'
         and new.telefone is not null and c.wpp_avisar_ausente then
        v_ok := public.fila_enfileirar_whatsapp(new, 'ausente', public.fila_wpp_texto(c.wpp_msg_ausente, new));
        if v_ok then
          update public.fila_itens set avisos = avisos || jsonb_build_object('ausente', now()) where id = new.id;
          v_enviou := true;
        end if;
      end if;

      -- Alguém saiu da espera: quem está com poucas pessoas à frente recebe "sua vez está chegando".
      if old.status = 'aguardando' and new.status <> 'aguardando' and c.wpp_avisar_proximo > 0 then
        for r in
          select q.id, (
            select count(*) from public.fila_itens w
            where w.status = 'aguardando'
              and (public.fila_rank_prioridade(w.prioridade), w.chegada_em, w.id)
                < (public.fila_rank_prioridade(q.prioridade), q.chegada_em, q.id)
          )::integer as a_frente
          from public.fila_itens q
          where q.status = 'aguardando' and q.telefone is not null and not (q.avisos ? 'proximo')
        loop
          if r.a_frente <= c.wpp_avisar_proximo then
            select * into v_q from public.fila_itens where id = r.id;
            v_ok := public.fila_enfileirar_whatsapp(
              v_q, 'proximo', public.fila_wpp_texto(c.wpp_msg_proximo, v_q, r.a_frente)
            );
            if v_ok then
              update public.fila_itens set avisos = avisos || jsonb_build_object('proximo', now()) where id = r.id;
              v_enviou := true;
            end if;
          end if;
        end loop;
      end if;
    end if;

    -- Entrega imediata, sem esperar o relógio (usa o acionador do atendimento, se existir).
    if v_enviou and to_regprocedure('public.atendimento_tick()') is not null then
      perform public.atendimento_tick();
    end if;
  exception when others then
    -- Aviso por WhatsApp jamais pode impedir emitir ou chamar uma senha.
    raise warning 'fila_itens_avisos: % (%)', sqlerrm, sqlstate;
  end;
  return null;
end $$;

drop trigger if exists fila_itens_avisos_ins on public.fila_itens;
create trigger fila_itens_avisos_ins
  after insert on public.fila_itens
  for each row execute function public.fila_itens_avisos();

drop trigger if exists fila_itens_avisos_upd on public.fila_itens;
create trigger fila_itens_avisos_upd
  after update of status on public.fila_itens
  for each row when (old.status is distinct from new.status)
  execute function public.fila_itens_avisos();

-- Funções internas: ninguém além do banco as chama.
revoke all on function public.fila_config_valida() from public, anon, authenticated;
revoke all on function public.fila_itens_defaults() from public, anon, authenticated;
revoke all on function public.fila_tv_tick() from public, anon, authenticated;
revoke all on function public.fila_itens_avisos() from public, anon, authenticated;
revoke all on function public.fila_session_do_telefone(text) from public, anon, authenticated;
revoke all on function public.fila_conversa_existente(text) from public, anon, authenticated;
revoke all on function public.fila_wpp_texto(text, public.fila_itens, integer) from public, anon, authenticated;
revoke all on function public.fila_enfileirar_whatsapp(public.fila_itens, text, text) from public, anon, authenticated;
revoke all on function public.fila_normalizar_telefone(text) from public, anon, authenticated;
revoke all on function public.fila_rank_prioridade(text) from public, anon, authenticated;
revoke all on function public.fila_nome_exibicao() from public, anon;
grant execute on function public.fila_nome_exibicao() to authenticated;
revoke all on function public.fila_ciclo(timestamptz) from public, anon;
grant execute on function public.fila_ciclo(timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Papel 'totem' (autoatendimento) e trava restritiva
-- ---------------------------------------------------------------------------
-- O totem fica exposto no saguão. É um login comum com o papel 'totem': só emite senha.
-- A trava abaixo é RESTRITIVA (soma-se às políticas existentes): o totem não lê nem grava nada
-- fora das tabelas liberadas, mesmo que alguém use a API direto com o token do aparelho.

do $$
declare
  r record;
  t text;
begin
  foreach t in array array['profiles', 'usuarios_previstos'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    for r in
      select conname from pg_constraint
      where conrelid = ('public.' || t)::regclass and contype = 'c'
        and pg_get_constraintdef(oid) like '%papel%'
    loop
      execute format('alter table public.%I drop constraint if exists %I', t, r.conname);
    end loop;
    execute format(
      'alter table public.%I add constraint %I check (papel in (%L, %L, %L, %L, %L))',
      t, t || '_papel_check', 'admin', 'lider', 'atendente', 'veterinario', 'totem'
    );
  end loop;
end $$;

-- É totem mesmo com o perfil DESATIVADO: perfil_papel() devolve NULL para perfil inativo, e a trava
-- `papel <> 'totem'` deixaria passar justamente o aparelho que foi desligado depois de perdido.
create or replace function public.fila_sou_totem()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.papel = 'totem')
$$;

revoke all on function public.fila_sou_totem() from public, anon;
grant execute on function public.fila_sou_totem() to authenticated;

-- Reaplicável: rode `select public.fila_travar_totem();` depois de criar tabelas novas.
create or replace function public.fila_travar_totem()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_n integer := 0;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and c.relrowsecurity
      -- Liberadas ao totem: o próprio perfil (login) e o que a tela de emissão precisa ler.
      and c.relname not in ('profiles', 'fila_servicos', 'fila_salas', 'fila_config')
  loop
    if not exists (
      select 1 from pg_policy p
      where p.polrelid = format('public.%I', r.relname)::regclass and p.polname = 'fila_totem_sem_acesso'
    ) then
      execute format(
        'create policy fila_totem_sem_acesso on public.%I as restrictive for all to authenticated '
        || 'using (not (select public.fila_sou_totem())) '
        || 'with check (not (select public.fila_sou_totem()))',
        r.relname
      );
      v_n := v_n + 1;
    end if;
  end loop;

  -- Storage: as políticas "qualquer autenticado" de outros buckets (ex.: mídias privadas das conversas)
  -- também valem para o totem. A trava restritiva o exclui de TODOS os buckets; o logotipo e os vídeos
  -- da fila são servidos por URL pública e não passam por esta política.
  if to_regclass('storage.objects') is not null
     and (select c.relrowsecurity from pg_class c where c.oid = 'storage.objects'::regclass)
     and not exists (select 1 from pg_policy p where p.polrelid = 'storage.objects'::regclass and p.polname = 'fila_totem_sem_acesso') then
    execute 'create policy fila_totem_sem_acesso on storage.objects as restrictive for all to authenticated '
         || 'using (not (select public.fila_sou_totem())) with check (not (select public.fila_sou_totem()))';
    v_n := v_n + 1;
  end if;
  return v_n;
end $$;

-- O que a trava NÃO cobre e que um login "totem" ainda alcançaria. Rode como dono (SQL Editor) ANTES de pôr um totem:
--   select * from public.fila_auditar_totem();
-- Cada linha é um ponto a revisar (ver references/totem-e-seguranca.md): função SECURITY DEFINER sem checagem de papel,
-- view/matview que ignora a RLS, tabela sem RLS.
create or replace function public.fila_auditar_totem()
returns table(tipo text, objeto text, detalhe text)
language sql
stable
security definer
set search_path = ''
as $$
  select 'funcao'::text, p.oid::regprocedure::text,
         'SECURITY DEFINER executável por authenticated sem checagem de papel: acrescente perform public.fila_exige_equipe();'::text
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef and p.prokind = 'f'
    and p.prorettype <> 'trigger'::regtype
    and has_function_privilege('authenticated', p.oid, 'execute')
    and p.prosrc !~* '(fila_exige_equipe|fila_sou_totem|sou_gestor|sou_admin|perfil_papel|pode_editar_meu_prompt|papel)'
    and p.proname not in ('fila_tv_painel', 'fila_tv_estado', 'fila_nome_exibicao', 'fila_ciclo', 'fila_sou_totem', 'fila_exige_equipe')
  union all
  select 'view'::text, c.oid::regclass::text,
         'view ou view materializada legível por authenticated que ignora a RLS (use security_invoker = on ou revogue)'::text
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm')
    and has_table_privilege('authenticated', c.oid, 'select')
    and not (c.relkind = 'v' and exists (select 1 from unnest(coalesce(c.reloptions, '{}'::text[])) o where o ~ '^security_invoker=(on|true)$'))
  union all
  select 'tabela_sem_rls'::text, c.oid::regclass::text,
         'tabela sem RLS: a trava do totem só alcança tabelas com RLS ligada'::text
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity
  order by 1, 2
$$;

revoke all on function public.fila_auditar_totem() from public, anon, authenticated;
revoke all on function public.fila_travar_totem() from public, anon, authenticated;
grant execute on function public.fila_travar_totem() to service_role;

select public.fila_travar_totem();

-- Aviso para quem roda `db push`: pontos que o totem ainda alcançaria (lista completa: select * from public.fila_auditar_totem();).
do $$
declare
  v_n integer;
begin
  select count(*) into v_n from public.fila_auditar_totem();
  if v_n > 0 then
    raise notice 'fila: % ponto(s) a revisar ANTES de instalar um totem. Rode: select * from public.fila_auditar_totem();', v_n;
  end if;
end $$;
