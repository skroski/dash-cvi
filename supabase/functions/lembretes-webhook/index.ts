// Supabase Edge Function: lembretes-webhook
//
// Recebe webhooks da Uazapi (ou Evolution) quando o tutor clica em um botão
// interativo ("Confirmar" ou "Cancelar") ou responde ao lembrete por texto.
//
// URL para cadastrar no webhook da Uazapi:
//   https://<sua-url-supabase>/functions/v1/lembretes-webhook
//
// Não exige autenticação de usuário (JWT) pois é chamada de servidor para servidor
// pela Uazapi. Opcionalmente aceita header ou query param `secret` para validação.

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { segredo } from '../_shared/segredos.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, token, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function extrairTelefone(payload: Record<string, any>): string | null {
  const possiveis = [
    payload.phone,
    payload.sender,
    payload.chatId,
    payload.number,
    payload.from,
    payload.data?.key?.remoteJid,
    payload.key?.remoteJid,
    payload.message?.key?.remoteJid,
    payload.data?.phone,
  ];

  for (const item of possiveis) {
    if (typeof item === 'string' && item.trim()) {
      const semJid = item.split('@')[0];
      const digitos = semJid.replace(/\D/g, '');
      if (digitos.length >= 10) return digitos;
    }
  }
  return null;
}

function extrairResposta(payload: Record<string, any>): { buttonId: string | null; texto: string | null } {
  let buttonId: string | null = null;
  let texto: string | null = null;

  // 1. Botão interativo direto ou legado
  if (typeof payload.buttonResponse?.selectedButtonId === 'string') {
    buttonId = payload.buttonResponse.selectedButtonId;
  } else if (typeof payload.selectedButtonId === 'string') {
    buttonId = payload.selectedButtonId;
  } else if (typeof payload.data?.message?.buttonsResponseMessage?.selectedButtonId === 'string') {
    buttonId = payload.data.message.buttonsResponseMessage.selectedButtonId;
  } else if (typeof payload.data?.message?.templateButtonReplyMessage?.selectedId === 'string') {
    buttonId = payload.data.message.templateButtonReplyMessage.selectedId;
  } else if (typeof payload.message?.buttonsResponseMessage?.selectedButtonId === 'string') {
    buttonId = payload.message.buttonsResponseMessage.selectedButtonId;
  }

  // 2. Texto do botão ou da conversa
  if (typeof payload.buttonResponse?.selectedDisplayText === 'string') {
    texto = payload.buttonResponse.selectedDisplayText;
  } else if (typeof payload.data?.message?.buttonsResponseMessage?.selectedDisplayText === 'string') {
    texto = payload.data.message.buttonsResponseMessage.selectedDisplayText;
  } else if (typeof payload.data?.message?.conversation === 'string') {
    texto = payload.data.message.conversation;
  } else if (typeof payload.data?.message?.extendedTextMessage?.text === 'string') {
    texto = payload.data.message.extendedTextMessage.text;
  } else if (typeof payload.message?.conversation === 'string') {
    texto = payload.message.conversation;
  } else if (typeof payload.text === 'string') {
    texto = payload.text;
  } else if (typeof payload.body === 'string') {
    texto = payload.body;
  }

  // Se não extraiu buttonId, mas veio em selectedId
  if (!buttonId && typeof payload.selectedId === 'string') {
    buttonId = payload.selectedId;
  }

  return { buttonId, texto };
}

const N8N_WEBHOOK = Deno.env.get('N8N_WEBHOOK_URL') || '';

async function encaminharParaN8n(corpo: Record<string, any>) {
  if (!N8N_WEBHOOK) return;
  try {
    await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.warn('[lembretes-webhook] Aviso ao encaminhar para n8n:', err);
  }
}

async function enviarMensagemUazapi(numero: string, texto: string): Promise<boolean> {
  const base = (segredo('UAZAPI_SERVER_URL') || Deno.env.get('UAZAPI_SERVER_URL') || '').replace(/\/$/, '');
  const token = segredo('UAZAPI_INSTANCE_TOKEN') || Deno.env.get('UAZAPI_INSTANCE_TOKEN') || '';
  if (!base || !token) return false;

  const digitos = numero.split('@')[0].replace(/\D/g, '');
  const cleanNumero = digitos.length === 10 || digitos.length === 11 ? `55${digitos}` : digitos;

  try {
    const res = await fetch(`${base}/send/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify({ number: cleanNumero, text: texto }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch (err) {
    console.warn('[lembretes-webhook] Erro ao enviar resposta via WhatsApp:', err);
    return false;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method === 'GET') {
    return json({ status: 'ok', service: 'lembretes-webhook', time: new Date().toISOString() });
  }
  if (request.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Supabase não configurado internamente' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let corpo: Record<string, any>;
  try {
    const bruto = await request.text();
    corpo = bruto ? JSON.parse(bruto) : {};
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  // Ignora mensagens que a própria clínica/instância enviou
  if (corpo.fromMe === true || corpo.data?.key?.fromMe === true || corpo.key?.fromMe === true) {
    return json({ ignorado: true, motivo: 'Mensagem enviada pelo próprio remetente (fromMe)' });
  }

  const telefone = extrairTelefone(corpo);
  if (!telefone) {
    return json({ ignorado: true, motivo: 'Telefone não identificado no payload' }, 200);
  }

  const { buttonId, texto } = extrairResposta(corpo);
  if (!buttonId && !texto) {
    encaminharParaN8n(corpo).catch(() => {});
    return json({ ignorado: true, motivo: 'Sem conteúdo de texto ou botão interativo' }, 200);
  }

  console.log(`[lembretes-webhook] Recebido de ${telefone}: buttonId="${buttonId}", texto="${texto}"`);

  // Chama a função do banco de dados para processar a intenção
  const { data, error } = await admin.rpc('lembrete_processar_resposta_whatsapp', {
    p_telefone: telefone,
    p_resposta: texto,
    p_button_id: buttonId,
  });

  if (error) {
    console.error('[lembretes-webhook] Erro na RPC lembrete_processar_resposta_whatsapp:', error);
    encaminharParaN8n(corpo).catch(() => {});
    return json({ error: error.message }, 500);
  }

  const resultado = data as {
    sucesso: boolean;
    status_confirmacao?: 'confirmado' | 'cancelado';
    nome_tutor?: string;
    nome_pet?: string;
    servico?: string;
    erro?: string;
    mensagem_id?: number;
  };

  if (!resultado?.sucesso) {
    console.log('[lembretes-webhook] RPC retornou sucesso=false:', resultado?.erro);
    // Se não era resposta de lembrete, encaminha para a IA / n8n responder
    encaminharParaN8n(corpo).catch(() => {});
    return json({ processado: false, detalhe: resultado?.erro });
  }

  // Sincroniza em segundo plano com o Google Calendar se o agendamento estiver vinculado
  if (resultado.mensagem_id) {
    (async () => {
      try {
        const { data: envio } = await admin
          .from('lembrete_envios')
          .select('id, google_event_id')
          .eq('mensagem_id', resultado.mensagem_id)
          .limit(1)
          .maybeSingle();

        if (envio?.id && envio.google_event_id) {
          await fetch(`${supabaseUrl}/functions/v1/sync-google-calendar`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              acao: 'sincronizar_agendamento',
              envioId: envio.id,
            }),
          }).catch(() => {});
          console.log(`[lembretes-webhook] Google Calendar sincronizado para envio #${envio.id}`);
        }
      } catch (syncErr) {
        console.warn('[lembretes-webhook] Aviso ao atualizar Google Calendar:', syncErr);
      }
    })().catch(() => {});
  }

  // Envio de mensagem amigável de retorno ao tutor confirmando a ação no WhatsApp
  const pet = resultado.nome_pet ? ` do(a) *${resultado.nome_pet}*` : '';
  const servico = resultado.servico ? ` (${resultado.servico})` : '';

  if (resultado.status_confirmacao === 'confirmado') {
    const msgConfirmacao = `✅ *Presença confirmada com sucesso!*\n\nRegistramos a confirmação do agendamento${pet}${servico}.\nMuito obrigado! Te esperamos na clínica. 🐾`;
    enviarMensagemUazapi(telefone, msgConfirmacao).catch(() => {});
  } else if (resultado.status_confirmacao === 'cancelado') {
    const msgCancelamento = `❌ *Agendamento cancelado!*\n\nRegistramos o cancelamento do agendamento${pet}${servico}.\nSe precisar remarcar para outra data, basta nos avisar por aqui. Estamos à disposição! 💚`;
    enviarMensagemUazapi(telefone, msgCancelamento).catch(() => {});
  }

  return json({
    sucesso: true,
    status_confirmacao: resultado.status_confirmacao,
    dados: resultado,
  });
});
