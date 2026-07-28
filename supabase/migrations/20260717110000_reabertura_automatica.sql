-- Reabertura automática: cliente que volta a escrever reabre a conversa fechada.
-- Rodar no SQL Editor do Supabase (projeto napeofeenweerjhqucua), depois da
-- migração 20260717100000_status_conversas.sql.
--
-- Só conversas FECHADAS reabrem sozinhas. Arquivar é decisão deliberada de
-- tirar a conversa do radar, então arquivadas só reabrem manualmente.

create or replace function public.reabrir_conversa_fechada()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  msg jsonb;
  tipo text;
begin
  -- Mesma heurística do dashboard: 'type' direto no objeto ou na última
  -- entrada de messages[]
  msg := new.message::jsonb;
  if jsonb_typeof(msg) = 'string' then
    msg := (msg #>> '{}')::jsonb; -- mensagem duplamente codificada em string JSON
  end if;

  tipo := msg ->> 'type';
  if tipo is null
     and jsonb_typeof(msg -> 'messages') = 'array'
     and jsonb_array_length(msg -> 'messages') > 0 then
    tipo := msg -> 'messages' -> -1 ->> 'type';
  end if;

  if tipo = 'human' then
    update public.conversas_status
       set status = 'aberta',
           reaberta_em = now(),
           updated_at = now()
     where session_id = new.session_id
       and status = 'fechada';
  end if;

  return new;
exception
  when others then
    -- O registro da mensagem nunca pode falhar por causa do status da conversa
    return new;
end;
$$;

drop trigger if exists trg_reabrir_conversa_fechada on public.n8n_chat_histories;
create trigger trg_reabrir_conversa_fechada
  after insert on public.n8n_chat_histories
  for each row
  execute function public.reabrir_conversa_fechada();
