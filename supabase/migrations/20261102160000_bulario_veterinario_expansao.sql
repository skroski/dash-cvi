-- ============================================================================
-- EXPANSÃO DO BULÁRIO VETERINÁRIO & IMPORTAÇÃO EM LOTE (RECEITUÁRIO + PRONTUÁRIO)
-- ============================================================================
-- 1. Garante permissões de leitura e escrita para equipe clínica (veterinários, admin, líder, atendentes)
-- 2. Índices de busca por nome comercial, princípio ativo, classe e palavras-chave
-- 3. Função RPC para importação em lote atômica com upsert por slug
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Políticas RLS de Leitura e Escrita
-- ---------------------------------------------------------------------------
-- Garante que qualquer membro da equipe clínica possa consultar e cadastrar/atualizar fármacos no bulário
drop policy if exists receituario_bulario_equipe_write on public.receituario_bulario;
create policy receituario_bulario_equipe_write on public.receituario_bulario
  for insert to authenticated
  with check ((select public.receituario_sou_equipe()));

drop policy if exists receituario_bulario_equipe_update on public.receituario_bulario;
create policy receituario_bulario_equipe_update on public.receituario_bulario
  for update to authenticated
  using ((select public.receituario_sou_equipe()))
  with check ((select public.receituario_sou_equipe()));

drop policy if exists receituario_bulario_equipe_delete on public.receituario_bulario;
create policy receituario_bulario_equipe_delete on public.receituario_bulario
  for delete to authenticated
  using ((select public.receituario_sou_equipe()));

-- ---------------------------------------------------------------------------
-- 2. Índices de Alta Performance para Busca de Medicamentos
-- ---------------------------------------------------------------------------
create index if not exists receituario_bulario_nome_comercial_idx
  on public.receituario_bulario(nome_comercial_sugerido);

create index if not exists receituario_bulario_classe_idx
  on public.receituario_bulario(classe_terapeutica);

create index if not exists receituario_bulario_ativo_idx
  on public.receituario_bulario(ativo);

create index if not exists receituario_bulario_palavras_chave_idx
  on public.receituario_bulario using gin (palavras_chave);

-- ---------------------------------------------------------------------------
-- 3. RPC: Importação em Lote do Bulário (CSV / Scraping / JSON)
-- ---------------------------------------------------------------------------
create or replace function public.importar_bulario_em_lote(
  p_medicamentos jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_total int := 0;
  v_inseridos int := 0;
  v_atualizados int := 0;
  v_slug text;
  v_principio text;
  v_nome text;
begin
  -- Exige usuário autenticado da equipe clínica
  if not public.receituario_sou_equipe() then
    raise exception 'Acesso negado: apenas membros da equipe clínica podem importar fármacos para o bulário.';
  end if;

  if jsonb_typeof(p_medicamentos) <> 'array' then
    raise exception 'O parâmetro p_medicamentos deve ser um array JSON.';
  end if;

  v_total := jsonb_array_length(p_medicamentos);

  for v_item in select * from jsonb_array_elements(p_medicamentos) loop
    v_slug := coalesce(btrim(v_item->>'slug'), '');
    v_principio := coalesce(btrim(v_item->>'principio_ativo'), '');
    v_nome := coalesce(btrim(v_item->>'nome_comercial_sugerido'), v_principio);

    -- Gera slug caso vazio
    if v_slug = '' then
      v_slug := lower(regexp_replace(v_principio, '[^a-zA-Z0-9]+', '-', 'g'));
      v_slug := trim(both '-' from v_slug);
      if v_slug = '' then
        v_slug := 'farmaco-' || substr(gen_random_uuid()::text, 1, 8);
      end if;
    end if;

    if v_principio = '' then
      continue;
    end if;

    insert into public.receituario_bulario (
      slug,
      principio_ativo,
      nome_comercial_sugerido,
      classe_terapeutica,
      tipo_padrao,
      icone_via,
      especies_permitidas,
      especies_contraindicadas,
      motivo_contraindicacao_especie,
      risco_mdr1,
      mensagem_mdr1,
      dose_padrao_mg_kg,
      dose_min_mg_kg,
      dose_max_mg_kg,
      dose_toxica_mg_kg,
      dose_felina_max_mg_kg,
      alerta_felino_especifico,
      frequencia_horas_padrao,
      duracao_dias_padrao,
      condicao_alimentar,
      apresentacoes,
      interacoes_classes,
      comorbidades_cautela,
      orientacoes_padrao,
      palavras_chave,
      ativo
    ) values (
      v_slug,
      v_principio,
      v_nome,
      coalesce(nullif(v_item->>'classe_terapeutica', ''), 'outros'),
      coalesce(nullif(v_item->>'tipo_padrao', ''), 'industrializado'),
      coalesce(nullif(v_item->>'icone_via', ''), 'oral'),
      coalesce(
        (select array_agg(elem::text) from jsonb_array_elements_text(coalesce(v_item->'especies_permitidas', '["canina","felina"]'::jsonb)) elem),
        array['canina', 'felina']
      ),
      coalesce(
        (select array_agg(elem::text) from jsonb_array_elements_text(coalesce(v_item->'especies_contraindicadas', '[]'::jsonb)) elem),
        array[]::text[]
      ),
      v_item->>'motivo_contraindicacao_especie',
      coalesce((v_item->>'risco_mdr1')::boolean, false),
      v_item->>'mensagem_mdr1',
      coalesce((v_item->>'dose_padrao_mg_kg')::numeric, 1.0),
      coalesce((v_item->>'dose_min_mg_kg')::numeric, coalesce((v_item->>'dose_padrao_mg_kg')::numeric, 1.0)),
      coalesce((v_item->>'dose_max_mg_kg')::numeric, coalesce((v_item->>'dose_padrao_mg_kg')::numeric, 1.0)),
      case when v_item->>'dose_toxica_mg_kg' is not null then (v_item->>'dose_toxica_mg_kg')::numeric else null end,
      case when v_item->>'dose_felina_max_mg_kg' is not null then (v_item->>'dose_felina_max_mg_kg')::numeric else null end,
      v_item->>'alerta_felino_especifico',
      case 
        when (v_item->>'frequencia_horas_padrao')::int in (4, 6, 8, 12, 24, 48, 72, 168) then (v_item->>'frequencia_horas_padrao')::int
        else 12
      end,
      coalesce(greatest(1, least(365, (v_item->>'duracao_dias_padrao')::int)), 7),
      coalesce(nullif(v_item->>'condicao_alimentar', ''), 'com_alimento'),
      case 
        when jsonb_typeof(v_item->'apresentacoes') = 'array' then v_item->'apresentacoes'
        else '[]'::jsonb
      end,
      coalesce(
        (select array_agg(elem::text) from jsonb_array_elements_text(coalesce(v_item->'interacoes_classes', '[]'::jsonb)) elem),
        array[]::text[]
      ),
      coalesce(
        (select array_agg(elem::text) from jsonb_array_elements_text(coalesce(v_item->'comorbidades_cautela', '[]'::jsonb)) elem),
        array[]::text[]
      ),
      coalesce(v_item->>'orientacoes_padrao', 'Administrar conforme prescrição médica veterinária.'),
      coalesce(
        (select array_agg(elem::text) from jsonb_array_elements_text(coalesce(v_item->'palavras_chave', '[]'::jsonb)) elem),
        array[lower(v_principio)]
      ),
      coalesce((v_item->>'ativo')::boolean, true)
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
      apresentacoes = case when jsonb_array_length(excluded.apresentacoes) > 0 then excluded.apresentacoes else public.receituario_bulario.apresentacoes end,
      interacoes_classes = excluded.interacoes_classes,
      comorbidades_cautela = excluded.comorbidades_cautela,
      orientacoes_padrao = excluded.orientacoes_padrao,
      palavras_chave = excluded.palavras_chave,
      ativo = excluded.ativo;

    if xmax = 0 then
      v_inseridos := v_inseridos + 1;
    else
      v_atualizados := v_atualizados + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'sucesso', true,
    'total_recebido', v_total,
    'inseridos', v_inseridos,
    'atualizados', v_atualizados
  );
end;
$$;

revoke all on function public.importar_bulario_em_lote(jsonb) from public, anon;
grant execute on function public.importar_bulario_em_lote(jsonb) to authenticated;

