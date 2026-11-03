// Entrada pública da UAZAPI. Valida segredo, deduplica sem guardar o payload
// bruto e só então coloca mensagens de clientes na fila transacional.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { segredo } from '../_shared/segredos.ts';
import { valorFiltro } from '../_shared/postgrest.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-uazapi-webhook-secret, x-webhook-secret, x-event-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

async function segredoConfere(recebido: string | null, esperado: string | undefined) {
  if (!recebido || !esperado) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(recebido)),
    crypto.subtle.digest('SHA-256', encoder.encode(esperado)),
  ]);
  const aa = new Uint8Array(a); const bb = new Uint8Array(b);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < Math.max(aa.length, bb.length); i++) diff |= (aa[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

async function sha256(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textoDaMensagem(message: Record<string, unknown>) {
  const direct = message.text || message.caption || message.body || message.content;
  if (typeof direct === 'string') return direct.trim().slice(0, 6_000);
  const content = record(message.content);
  return String(content.text || content.conversation || content.caption || '').trim().slice(0, 6_000);
}

function sessionCanonica(input: unknown) {
  const raw = String(input || '').trim();
  if (raw.includes('@')) return raw;
  const digits = raw.replace(/\D/g, '');
  return digits ? `${digits}@s.whatsapp.net` : '';
}

function dataDaMensagem(value: unknown) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return new Date(numeric < 1e12 ? numeric * 1_000 : numeric).toISOString();
  }
  const parsed = new Date(String(value || ''));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
}

function tipoDeMidia(message: Record<string, unknown>, type: string) {
  const value = `${type} ${String(message.mimetype || message.mimeType || '')}`.toLowerCase();
  if (value.includes('audio') || value.includes('ptt') || value.includes('voice')) return 'audio';
  if (value.includes('image') || value.includes('sticker')) return 'imagem';
  if (value.includes('pdf')) return 'pdf';
  if (value.includes('document') || value.includes('file')) return 'documento';
  return null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const expected = segredo('UAZAPI_WEBHOOK_SECRET');
  if (expected) {
    const received = request.headers.get('x-uazapi-webhook-secret') || request.headers.get('x-webhook-secret');
    if (!(await segredoConfere(received, expected))) return json({ error: 'unauthorized' }, 401);
  }

  const raw = await request.text();
  if (!raw || raw.length > 1_500_000) return json({ error: 'invalid_payload' }, 400);
  let payload: Record<string, unknown>;
  try { payload = record(JSON.parse(raw)); } catch { return json({ error: 'invalid_json' }, 400); }

  const body = record(payload.body);
  const source = Object.keys(body).length ? body : payload;
  const message = record(source.message);
  const chat = record(source.chat);
  const messageId = String(message.messageid || message.messageId || message.id || record(message.key).id || '').trim();
  const sessionId = sessionCanonica(message.chatid || chat.wa_chatid || message.sender_pn || message.sender || '');
  const fromMe = Boolean(message.fromMe ?? record(message.key).fromMe);
  const eventType = String(source.event || payload.event || message.event || 'message').slice(0, 80);
  const bodyHash = await sha256(raw);
  const eventId = String(request.headers.get('x-event-id') || messageId || `${eventType}:${bodyHash}`).slice(0, 255);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRole) return json({ error: 'service_unavailable' }, 500);
  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: event, error: eventError } = await admin.from('atendimento_eventos').insert({
    provedor: 'uazapi', evento_externo_id: eventId, tipo: eventType,
    session_id: sessionId || null, mensagem_externa_id: messageId || null, corpo_hash: bodyHash,
  }).select('id').maybeSingle();
  if (eventError?.code === '23505') return json({ ok: true, duplicate: true }, 202);
  if (eventError || !event?.id) return json({ error: 'event_persist_failed' }, 500);

  const content = textoDaMensagem(message);
  const messageType = String(message.messageType || message.type || 'texto').slice(0, 80);
  const mediaType = tipoDeMidia(message, messageType);
  const senderName = String(message.senderName || message.pushName || '');

  // Proteção contra bots de operadoras e mensagens institucionais
  const cleanDigits = sessionId.replace(/\D/g, '');
  const isCarrierPattern = (() => {
    const t = (content || '').toLowerCase();
    const n = senderName.toLowerCase();
    if (/\b(tim|claro|vivo|oi)\b/i.test(n) && !/\b(fatima|tutor|dr|dra)\b/i.test(n)) return true;
    return [
      /\btim informa\b/i,
      /\bfatura tim\b/i,
      /\bprotocolo de atendimento\b/i,
      /\bprotocolo:\s*\d+/i,
      /\bdigite \d para\b/i,
      /\bresponda \d para\b/i,
      /\bopcao invalida\b/i,
      /\bopção inválida\b/i,
      /\bcomando invalido\b/i,
      /\bcomando não reconhecido\b/i,
    ].some((regex) => regex.test(t));
  })();

  // Números bloqueados vêm só de atendimento_bloqueios (painel > Configurações).
  let estaBloqueado = false;
  if (!estaBloqueado && sessionId) {
    try {
      const { data: b } = await admin
        .from('atendimento_bloqueios')
        .select('id')
        .or(`telefone.eq.${valorFiltro(cleanDigits)},session_id.eq.${valorFiltro(sessionId)}`)
        .eq('ativo', true)
        .maybeSingle();
      if (b) estaBloqueado = true;
    } catch {
      // prossegue com verificação padrão se tabela ainda não estiver acessível
    }
  }

  if (!sessionId || !messageId || fromMe || (!content && !mediaType) || estaBloqueado || isCarrierPattern) {
    await admin.from('atendimento_eventos').update({ status: 'ignorado', processado_em: new Date().toISOString() }).eq('id', event.id);
    return json({ ok: true, queued: false, motivo: estaBloqueado ? 'bloqueado' : isCarrierPattern ? 'operadora_bot' : 'ignorado' }, 202);
  }

  const { data: messageRowId, error: queueError } = await admin.rpc('atendimento_enfileirar_mensagem', {
    p_evento_id: event.id,
    p_session_id: sessionId,
    p_mensagem_externa_id: messageId,
    p_direcao: 'entrada',
    p_tipo: messageType,
    p_conteudo: mediaType ? null : content,
    p_ocorrido_em: dataDaMensagem(message.timestamp || message.messageTimestamp || chat.wa_lastMsgTimestamp),
    p_nome_contato: String(message.senderName || message.pushName || '').slice(0, 200) || null,
  });
  if (queueError) {
    await admin.from('atendimento_eventos').update({ status: 'falhou' }).eq('id', event.id);
    return json({ error: 'queue_failed' }, 500);
  }
  if (mediaType && messageRowId) {
    const { error: mediaError } = await admin.from('atendimento_midias').insert({
      evento_id: event.id,
      mensagem_id: messageRowId,
      session_id: sessionId,
      mensagem_externa_id: messageId,
      tipo: mediaType,
    });
    if (mediaError && mediaError.code !== '23505') {
      await admin.from('atendimento_eventos').update({ status: 'falhou' }).eq('id', event.id);
      return json({ error: 'media_queue_failed' }, 500);
    }
  }
  await admin.from('atendimento_eventos').update({ status: 'enfileirado', processado_em: new Date().toISOString() }).eq('id', event.id);

  // Aciona o worker diretamente após os 4s de debounce para não esperar o cron de 1 minuto
  const internalSecret = segredo('ATENDIMENTO_INTERNAL_SECRET');
  if (url && internalSecret && !mediaType) {
    const triggerPromise = (async () => {
      // Debounce de 4.1s para permitir agrupamento de mensagens consecutivas
      await new Promise((resolve) => setTimeout(resolve, 4100));
      try {
        await fetch(`${url}/functions/v1/atendimento-worker`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Secret': internalSecret,
          },
          body: '{}',
          signal: AbortSignal.timeout(60_000),
        });
      } catch (err) {
        console.warn('Falha no trigger direto do atendimento-worker:', err);
      }
    })();

    // @ts-ignore EdgeRuntime is available in Supabase
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(triggerPromise);
    }
  }

  return json({ ok: true, queued: true, media: Boolean(mediaType) }, 202);
});
