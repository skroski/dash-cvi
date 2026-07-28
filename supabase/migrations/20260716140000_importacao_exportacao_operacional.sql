-- Campos legados das planilhas e permissões autenticadas para importação manual
-- pelos módulos de Lembretes e Pesquisas de Satisfação.

alter table public.lembrete_envios
  add column if not exists descricao text,
  add column if not exists email text,
  add column if not exists porte text,
  add column if not exists preco numeric(12, 2),
  add column if not exists status_agendamento text;

drop policy if exists "dashboard importa lembrete_envios"
  on public.lembrete_envios;
create policy "dashboard importa lembrete_envios"
  on public.lembrete_envios
  for insert
  to authenticated
  with check (true);

drop policy if exists "dashboard importa pesquisa_satisfacao_envios"
  on public.pesquisa_satisfacao_envios;
create policy "dashboard importa pesquisa_satisfacao_envios"
  on public.pesquisa_satisfacao_envios
  for insert
  to authenticated
  with check (true);

drop policy if exists "dashboard importa pesquisa_satisfacao_respostas"
  on public.pesquisa_satisfacao_respostas;
create policy "dashboard importa pesquisa_satisfacao_respostas"
  on public.pesquisa_satisfacao_respostas
  for insert
  to authenticated
  with check (true);

drop policy if exists "dashboard atualiza pesquisa_satisfacao_respostas"
  on public.pesquisa_satisfacao_respostas;
create policy "dashboard atualiza pesquisa_satisfacao_respostas"
  on public.pesquisa_satisfacao_respostas
  for update
  to authenticated
  using (true)
  with check (true);

grant insert on public.lembrete_envios to authenticated;
grant usage, select on sequence public.lembrete_envios_id_seq to authenticated;

grant insert on public.pesquisa_satisfacao_envios to authenticated;
grant usage, select on sequence
  public.pesquisa_satisfacao_envios_id_seq to authenticated;

grant insert, update on public.pesquisa_satisfacao_respostas to authenticated;
grant usage, select on sequence
  public.pesquisa_satisfacao_respostas_id_seq to authenticated;
