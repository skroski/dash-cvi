// Entrega idempotente da outbox para a UAZAPI, com retry somente em falhas seguras.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { segredo } from '../_shared/segredos.ts';
import { valorFiltro } from '../_shared/postgrest.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
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

function providerMessageId(input: unknown) {
  if (!input || typeof input !== 'object') return null;
  const data = input as Record<string, unknown>;
  const key = data.key as Record<string, unknown> | undefined;
  const message = data.message as Record<string, unknown> | undefined;
  const value = data.messageid || data.messageId || data.id || key?.id || message?.messageid || message?.id;
  return value ? String(value) : null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const internalSecret = segredo('ATENDIMENTO_INTERNAL_SECRET');
  if (!(await segredoConfere(request.headers.get('x-internal-secret'), internalSecret))) return json({ error: 'unauthorized' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const base = segredo('UAZAPI_SERVER_URL')?.replace(/\/$/, '');
  const token = segredo('UAZAPI_INSTANCE_TOKEN');
  if (!url || !serviceRole || !base || !token) return json({ error: 'service_unavailable' }, 500);
  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

  if (segredo('ATENDIMENTO_SEND_ENABLED') !== 'true') {
    // A fila continua íntegra até a liberação explícita de saída em produção.
    return json({ ok: true, delivery: 'disabled', processed: 0 });
  }

  const { data: rows, error: claimError } = await admin.rpc('atendimento_claim_outbox', { p_limite: 20 });
  if (claimError) return json({ error: 'claim_failed' }, 500);
  let sent = 0;

  // Respostas longas saem em várias mensagens; uma pausa entre elas imita a digitação (configurável).
  let pausaMs = 1200;
  try {
    const { data: cfg } = await admin.from('atendimento_config').select('pausa_entre_mensagens_ms').eq('singleton', true).maybeSingle();
    if (Number.isFinite(Number(cfg?.pausa_entre_mensagens_ms))) pausaMs = Math.max(0, Math.min(Number(cfg?.pausa_entre_mensagens_ms), 10_000));
  } catch {
    // mantém o padrão
  }
  let sessaoAnterior = '';

  for (const row of (rows || []) as Array<{
    id: string; session_id: string; destino: string; tipo: string; conteudo: string; tentativas: number;
  }>) {
    const cleanDestino = (row.destino || row.session_id || '').replace(/\D/g, '');
    // Notificação para a equipe não pertence à conversa do cliente: o bloqueio vale
    // só para o número de destino, e nada é gravado no histórico do cliente.
    const ehNotificacao = row.tipo === 'notificacao';
    let bloqueado = false;
    try {
      const filtro = ehNotificacao
        ? `telefone.eq.${valorFiltro(cleanDestino)}`
        : `telefone.eq.${valorFiltro(cleanDestino)},session_id.eq.${valorFiltro(row.session_id)}`;
      const { data: b } = await admin
        .from('atendimento_bloqueios')
        .select('id')
        .or(filtro)
        .eq('ativo', true)
        .maybeSingle();
      if (b) bloqueado = true;
    } catch {
      // prossegue
    }

    if (bloqueado) {
      await admin.from('atendimento_outbox').update({
        estado: 'failed',
        ultimo_erro_codigo: 'bloqueado_blacklist',
      }).eq('id', row.id);
      continue;
    }

    if (!ehNotificacao && sessaoAnterior === row.session_id && pausaMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, pausaMs));
    }
    sessaoAnterior = ehNotificacao ? '' : row.session_id;

    let status = 0;
    let payload: unknown = null;
    let safeError: string | null = null;
    try {
      const response = await fetch(`${base}/send/text`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', token },
        body: JSON.stringify({ number: row.destino, text: row.conteudo }), signal: AbortSignal.timeout(20_000),
      });
      status = response.status;
      payload = await response.json().catch(() => null);
      if (!response.ok) safeError = `provider_${status}`;
    } catch (error) {
      safeError = error instanceof DOMException && error.name === 'TimeoutError' ? 'provider_timeout' : 'provider_unavailable';
    }

    if (!safeError) {
      const externalId = providerMessageId(payload) || `outbox-${row.id}`;
      await admin.from('atendimento_outbox').update({
        estado: 'sent', enviado_em: new Date().toISOString(), provider_message_id: providerMessageId(payload), ultimo_erro_codigo: null,
      }).eq('id', row.id).eq('estado', 'processing');
      if (!ehNotificacao) {
        await admin.from('atendimento_mensagens').insert({
          session_id: row.session_id,
          mensagem_externa_id: externalId,
          direcao: 'saida_bot',
          tipo: 'texto',
          conteudo: row.conteudo,
          ocorrido_em: new Date().toISOString(),
          processado_em: new Date().toISOString(),
        }).then(() => undefined);
        await admin.from('atendimento_conversas').update({ ultima_resposta_bot_em: new Date().toISOString(), atualizado_em: new Date().toISOString() })
          .eq('session_id', row.session_id);
      }
      sent++;
      continue;
    }

    const retryable = status === 0 || [429, 502, 503, 504].includes(status);
    const retry = retryable && row.tentativas < 10;
    const next = new Date(Date.now() + Math.min(900, 15 * 2 ** Math.min(row.tentativas, 6)) * 1000).toISOString();
    await admin.from('atendimento_outbox').update({
      estado: retry ? 'pending' : 'failed',
      proxima_tentativa_em: next,
      ultimo_erro_codigo: safeError,
    }).eq('id', row.id).eq('estado', 'processing');
    if (!retry) await admin.from('atendimento_erros').insert({
      funcao: 'atendimento-outbox', session_id: row.session_id, codigo: safeError, detalhe_seguro: null,
    });
  }
  return json({ ok: true, claimed: (rows || []).length, sent });
});
