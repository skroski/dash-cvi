-- ============================================================================
-- FILA PRESENCIAL V3: INTEGRAÇÃO SUPABASE + WHATSAPP (DADOS_CLIENTE) + VETERINÁRIOS
-- Idempotente.
-- ============================================================================

-- 1. Tabela de Veterinários
create table if not exists public.fila_veterinarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  crmv text check (crmv is null or char_length(crmv) <= 30),
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fila_veterinarios_ordem_idx on public.fila_veterinarios(ordem, nome);

-- RLS para fila_veterinarios
alter table public.fila_veterinarios enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fila_veterinarios' and policyname = 'fila_veterinarios_leitura') then
    create policy fila_veterinarios_leitura on public.fila_veterinarios for select to authenticated using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fila_veterinarios' and policyname = 'fila_veterinarios_gestor') then
    create policy fila_veterinarios_gestor on public.fila_veterinarios for all to authenticated using (
      coalesce((auth.jwt()->'app_metadata'->>'role'), '') = 'admin' or
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.papel in ('gestor', 'administrador'))
    );
  end if;
end $$;

-- 2. Evolução de fila_config (Novos layouts da TV e marca)
alter table public.fila_config
  add column if not exists show_brand_text boolean not null default false,
  add column if not exists tv_theme text not null default 'dark' check (tv_theme in ('dark', 'light')),
  add column if not exists tv_video_size text not null default '2_3' check (tv_video_size in ('1_3', '1_2', '2_3')),
  add column if not exists tv_show_lists boolean not null default true;

-- 3. Evolução de fila_midias (Suporte a YouTube além de upload de MP4)
alter table public.fila_midias
  add column if not exists tipo text not null default 'arquivo' check (tipo in ('arquivo', 'youtube')),
  add column if not exists youtube_id text,
  add column if not exists url text;

-- 4. Evolução de fila_itens (Veterinários, cliente WhatsApp e telefone)
alter table public.fila_itens
  add column if not exists veterinario_id uuid references public.fila_veterinarios(id) on delete set null,
  add column if not exists telefone_whatsapp text;

create index if not exists fila_itens_cliente_idx on public.fila_itens(cliente_id);
create index if not exists fila_itens_vet_idx on public.fila_itens(veterinario_id);

-- 5. RPC para busca inteligente de clientes que passaram pelo WhatsApp (dados_cliente)
create or replace function public.buscar_clientes_fila(termo text)
returns table (
  id bigint,
  nome text,
  telefone text,
  nome_pet text,
  raca_pet text,
  porte_pet text
) language plpgsql security definer set search_path = '' as $$
declare
  v_limpo text;
begin
  v_limpo := btrim(termo);
  if char_length(v_limpo) < 2 then
    return;
  end if;

  return query
  select c.id, c.nome, c.telefone, c.nome_pet, c.raca_pet, c.porte_pet
  from public.dados_cliente c
  where c.nome ilike '%' || v_limpo || '%'
     or c.telefone ilike '%' || v_limpo || '%'
     or c.nome_pet ilike '%' || v_limpo || '%'
  order by c.id desc
  limit 10;
end;
$$;

grant execute on function public.buscar_clientes_fila(text) to authenticated;

-- 6. RPC para cadastrar cliente atendido no presencial direto no banco de clientes do WhatsApp
create or replace function public.cadastrar_cliente_presencial(
  p_nome text,
  p_telefone text,
  p_nome_pet text default null,
  p_raca_pet text default null,
  p_porte_pet text default null
) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_cliente_id bigint;
  v_tel_limpo text;
begin
  v_tel_limpo := regexp_replace(p_telefone, '\D', '', 'g');
  if length(v_tel_limpo) between 10 and 11 then
    v_tel_limpo := '55' || v_tel_limpo;
  end if;

  if length(v_tel_limpo) < 10 then
    raise exception 'Telefone inválido para cadastro do WhatsApp.';
  end if;

  -- Verifica se cliente já existe pelo telefone ou sessionid
  select id into v_cliente_id
  from public.dados_cliente
  where telefone = v_tel_limpo or sessionid = (v_tel_limpo || '@s.whatsapp.net')
  order by id desc
  limit 1;

  if v_cliente_id is not null then
    update public.dados_cliente
    set
      nome = coalesce(nullif(btrim(p_nome), ''), nome),
      nome_pet = coalesce(nullif(btrim(p_nome_pet), ''), nome_pet),
      raca_pet = coalesce(nullif(btrim(p_raca_pet), ''), raca_pet),
      porte_pet = coalesce(nullif(btrim(p_porte_pet), ''), porte_pet),
      updated_at = now()
    where id = v_cliente_id;
  else
    insert into public.dados_cliente (
      nome, telefone, sessionid, nome_pet, raca_pet, porte_pet, created_at, updated_at
    ) values (
      btrim(p_nome),
      v_tel_limpo,
      v_tel_limpo || '@s.whatsapp.net',
      nullif(btrim(p_nome_pet), ''),
      nullif(btrim(p_raca_pet), ''),
      nullif(btrim(p_porte_pet), ''),
      now(),
      now()
    )
    returning id into v_cliente_id;
  end if;

  return v_cliente_id;
end;
$$;

grant execute on function public.cadastrar_cliente_presencial(text, text, text, text, text) to authenticated;

