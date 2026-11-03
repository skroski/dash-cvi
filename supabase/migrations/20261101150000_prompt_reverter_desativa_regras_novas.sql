-- Rollback de prompt volta ao estado EXATO da versão escolhida.
--
-- Antes, prompt_reverter_versao() restaurava só as regras do snapshot e deixava
-- ativas as criadas depois daquela versão; a próxima publicação as trazia de volta
-- sem ninguém perceber. Agora, depois de restaurar o snapshot, as regras que não
-- existiam na versão ficam desativadas (não apagadas; dá para reativar no painel).
--
-- Mesma assinatura, security definer, search_path e permissões da função original
-- (20261027100000_clinica_configuracao_prompt.sql). Nenhuma outra função muda.
-- Versões sem snapshot (snapshot_regras = '[]') continuam sem desativar nada.
-- Atenção: reaplicar a 20261027100000 depois desta volta a função antiga.

-- Reverte as regras para o estado de uma versão e registra a reversão como nova versão.
create or replace function public.prompt_reverter_versao(p_versao integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alvo public.meu_prompt_versoes;
  v_nova integer;
  v_autor text;
  v_item jsonb;
begin
  if not public.pode_editar_meu_prompt() then
    raise exception 'forbidden: apenas administradores' using errcode = '42501';
  end if;
  select * into v_alvo from public.meu_prompt_versoes where versao = p_versao;
  if not found then
    raise exception 'Versão não encontrada' using errcode = 'P0002';
  end if;

  if jsonb_typeof(v_alvo.snapshot_regras) = 'array' then
    for v_item in select * from jsonb_array_elements(v_alvo.snapshot_regras) loop
      if coalesce(v_item->>'codigo', '') = '' then
        continue;
      end if;
      insert into public.prompt_regras (codigo, titulo, categoria, conteudo, padrao, ativa, ordem, atualizado_por)
      values (
        v_item->>'codigo', v_item->>'titulo', v_item->>'categoria', v_item->>'conteudo',
        coalesce((v_item->>'padrao')::boolean, false), coalesce((v_item->>'ativa')::boolean, true),
        coalesce((v_item->>'ordem')::integer, 0), auth.uid()
      )
      on conflict (codigo) do update set
        titulo = excluded.titulo, categoria = excluded.categoria, conteudo = excluded.conteudo,
        ativa = excluded.ativa, ordem = excluded.ordem, atualizado_por = excluded.atualizado_por,
        updated_at = now();
    end loop;

    -- Estado exato da versão: regras que não existiam nela ficam desativadas (não apagadas),
    -- senão a próxima publicação as traria de volta sem ninguém perceber.
    if jsonb_array_length(v_alvo.snapshot_regras) > 0 then
      update public.prompt_regras r
      set ativa = false, atualizado_por = auth.uid(), updated_at = now()
      where r.ativa
        and not exists (
          select 1 from jsonb_array_elements(v_alvo.snapshot_regras) s
          where s->>'codigo' = r.codigo
        );
    end if;
  end if;

  select coalesce(max(versao), 0) + 1 into v_nova from public.meu_prompt_versoes;
  select coalesce(nullif(btrim(p.nome), ''), u.email, 'Administrador')
    into v_autor
    from auth.users u left join public.profiles p on p.id = u.id
    where u.id = auth.uid();

  insert into public.meu_prompt_versoes (conteudo, versao, descricao, autor_nome, snapshot_regras, criado_por)
  values (v_alvo.conteudo, v_nova, 'Revertido para a versão v' || v_alvo.versao, v_autor,
          coalesce(v_alvo.snapshot_regras, '[]'::jsonb), auth.uid());
  return v_nova;
end;
$$;

revoke all on function public.prompt_reverter_versao(integer) from public, anon;
grant execute on function public.prompt_reverter_versao(integer) to authenticated;
