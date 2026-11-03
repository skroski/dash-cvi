-- Migration para adicionar o papel 'veterinario' e registrar o usuário veterinarios-cvi@googlegroups.com
--
-- O papel 'veterinario' permite acesso exclusivo à Agenda de consultas e
-- ao Chamador de Pacientes no Consultório da Fila Presencial, sem acesso a conversas ou gestão.

do $$
declare
  r record;
begin
  -- Remove constraints antigas de papel na tabela profiles
  for r in (
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%papel%'
  ) loop
    execute 'alter table public.profiles drop constraint if exists ' || quote_ident(r.conname);
  end loop;

  -- Remove constraints antigas de papel na tabela usuarios_previstos (se a tabela existir)
  if to_regclass('public.usuarios_previstos') is not null then
    for r in (
      select conname
      from pg_constraint
      where conrelid = 'public.usuarios_previstos'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) like '%papel%'
    ) loop
      execute 'alter table public.usuarios_previstos drop constraint if exists ' || quote_ident(r.conname);
    end loop;
  end if;
end $$;

-- Adiciona constraints atualizadas incluindo 'veterinario'
alter table public.profiles
  add constraint profiles_papel_check
  check (papel in ('admin', 'lider', 'atendente', 'veterinario'));

do $$
begin
  if to_regclass('public.usuarios_previstos') is not null then
    alter table public.usuarios_previstos
      add constraint usuarios_previstos_papel_check
      check (papel in ('admin', 'lider', 'atendente', 'veterinario'));

    -- Registra o e-mail único dos veterinários na tabela de usuários previstos
    insert into public.usuarios_previstos (email, papel, observacao)
    values (
      'veterinarios-cvi@googlegroups.com',
      'veterinario',
      'Visão simplificada para veterinários (agenda e fila presencial)'
    )
    on conflict (email) do update
    set papel = 'veterinario',
        observacao = excluded.observacao;
  end if;
end $$;

-- Se o usuário já tiver perfil criado na tabela profiles, atualiza imediatamente
update public.profiles
set papel = 'veterinario',
    ativo = true
where lower(email) = 'veterinarios-cvi@googlegroups.com';
