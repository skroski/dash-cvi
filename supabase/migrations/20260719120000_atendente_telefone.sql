-- Telefone (opcional) do atendente — usado para notificar via WhatsApp (UAZAPI)
-- quando um atendimento é atribuído ou transferido para ele.
-- Rodar no SQL Editor do Supabase (projeto napeofeenweerjhqucua) ou via `supabase db push`.

alter table public.atendentes
  add column if not exists telefone text;

comment on column public.atendentes.telefone is
  'Telefone/WhatsApp do atendente (opcional). Formato livre; normalizado no envio.';
