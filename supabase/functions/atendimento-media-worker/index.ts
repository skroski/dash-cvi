// Extrai conteúdo de mídias UAZAPI antes de encaminhá-lo ao Balthazar.
// O arquivo nunca é buscado de URL arbitrária: a função pede o binário à API
// autenticada pelo id da mensagem e só envia o conteúdo ao provedor necessário.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { obterOpenAiKey, segredo } from '../_shared/segredos.ts';

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

function bytesBase64(value: string) {
  const normalized = value.replace(/^data:[^;,]+;base64,/, '').replace(/\s/g, '');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function baixarMidia(base: string, token: string, messageId: string) {
  const response = await fetch(`${base}/message/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', token },
    body: JSON.stringify({ id: messageId, return_base64: true, return_link: false, generate_mp3: true }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`download_${response.status}`);
  const payload = record(await response.json());
  const base64 = [payload.base64, payload.fileBase64, payload.data, payload.content]
    .find((value) => typeof value === 'string' && String(value).length > 20);
  if (typeof base64 !== 'string') throw new Error('download_without_binary');
  const mimeType = String(payload.mimetype || payload.mimeType || payload.mime || 'application/octet-stream');
  return { bytes: bytesBase64(base64), mimeType };
}

async function transcreverAudio(bytes: Uint8Array, mimeType: string) {
  const apiKey = segredo('GROQ_API_KEY');
  if (!apiKey) throw new Error('groq_not_configured');
  const form = new FormData();
  form.append('model', 'whisper-large-v3');
  form.append('language', 'pt');
  form.append('response_format', 'verbose_json');
  form.append('file', new File([bytes], 'audio.ogg', { type: mimeType }));
  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.timeout(45_000),
  });
  const payload = record(await response.json().catch(() => ({})));
  if (!response.ok) throw new Error('transcription_failed');
  const text = String(payload.text || '').trim();
  if (!text) throw new Error('transcription_empty');
  return `Áudio recebido: ${text}`;
}

async function analisarImagem(bytes: Uint8Array, mimeType: string) {
  const apiKey = await obterOpenAiKey();
  if (!apiKey) throw new Error('openai_not_configured');
  let binary = '';
  for (const part of bytes) binary += String.fromCharCode(part);
  const imageUrl = `data:${mimeType};base64,${btoa(binary)}`;
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini', max_tokens: 400,
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Descreva de forma concisa, em português, o conteúdo relevante desta imagem recebida por uma clínica veterinária. Não invente informações.' },
        { type: 'image_url', image_url: { url: imageUrl } },
      ] }],
    }), signal: AbortSignal.timeout(45_000),
  });
  const payload = record(await response.json().catch(() => ({})));
  if (!response.ok) throw new Error('vision_failed');
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = record(choices[0]);
  const text = String(record(first.message).content || '').trim();
  if (!text) throw new Error('vision_empty');
  return `Imagem recebida: ${text}`;
}

async function extrairDocumento(bytes: Uint8Array, mimeType: string, isPdf: boolean) {
  if (!isPdf && /^text\//i.test(mimeType)) return new TextDecoder().decode(bytes).trim().slice(0, 12_000);
  // PDF é convertido em texto pelo modelo multimodal a partir do conteúdo
  // binário quando a conta configurar OPENAI_API_KEY. A rota evita baixar URL
  // remota e limita o tamanho para não estourar a função.
  if (!isPdf) throw new Error('unsupported_document');
  const apiKey = await obterOpenAiKey();
  if (!apiKey) throw new Error('openai_not_configured');
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('document_too_large');
  const form = new FormData();
  form.append('purpose', 'user_data');
  form.append('file', new File([bytes], 'documento.pdf', { type: 'application/pdf' }));
  const upload = await fetch('https://api.openai.com/v1/files', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.timeout(45_000),
  });
  const uploaded = record(await upload.json().catch(() => ({})));
  const fileId = String(uploaded.id || '');
  if (!upload.ok || !fileId) throw new Error('pdf_upload_failed');
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        input: [{ role: 'user', content: [
          { type: 'input_file', file_id: fileId },
          { type: 'input_text', text: 'Extraia e resuma de forma fiel o texto relevante deste PDF em português, sem inventar informações.' },
        ] }],
      }), signal: AbortSignal.timeout(60_000),
    });
    const result = record(await response.json().catch(() => ({})));
    if (!response.ok) throw new Error('pdf_extract_failed');
    const text = String(result.output_text || '').trim();
    if (!text) throw new Error('pdf_extract_empty');
    return `Documento recebido: ${text.slice(0, 12_000)}`;
  } finally {
    await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000),
    }).catch(() => undefined);
  }
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
  const { data: jobs, error: claimError } = await admin.rpc('atendimento_claim_midias', { p_limite: 5 });
  if (claimError) return json({ error: 'claim_failed' }, 500);
  let processed = 0;

  for (const job of (jobs || []) as Array<{ id: string; mensagem_id: string; session_id: string; mensagem_externa_id: string; tipo: string; tentativas: number }>) {
    try {
      const media = await baixarMidia(base, token, job.mensagem_externa_id);
      const content = job.tipo === 'audio'
        ? await transcreverAudio(media.bytes, media.mimeType)
        : job.tipo === 'imagem'
        ? await analisarImagem(media.bytes, media.mimeType)
        : await extrairDocumento(media.bytes, media.mimeType, job.tipo === 'pdf');
      const { error: messageError } = await admin.from('atendimento_mensagens').update({ conteudo: content }).eq('id', job.mensagem_id);
      if (messageError) throw new Error('message_update_failed');
      await admin.from('atendimento_midias').update({ estado: 'done', processado_em: new Date().toISOString(), ultimo_erro_codigo: null })
        .eq('id', job.id).eq('estado', 'processing');
      await admin.rpc('atendimento_agendar_lote', { p_session_id: job.session_id, p_atraso_segundos: 4 });
      processed++;
    } catch (error) {
      const code = error instanceof Error ? error.message.slice(0, 80) : 'media_processing_failed';
      const retry = job.tentativas < 3;
      await admin.from('atendimento_midias').update({
        estado: retry ? 'pending' : 'failed', ultimo_erro_codigo: code,
        proxima_tentativa_em: new Date(Date.now() + 60_000 * Math.max(1, job.tentativas)).toISOString(),
      }).eq('id', job.id).eq('estado', 'processing');
      if (!retry) {
        await Promise.all([
          admin.from('atendimento_erros').insert({
            funcao: 'atendimento-media-worker', session_id: job.session_id, codigo: code, detalhe_seguro: null,
          }),
          admin.from('atendimento_mensagens').update({
            conteudo: 'O cliente enviou uma mídia que não pôde ser lida automaticamente. Peça, com acolhimento, que envie novamente em texto ou outro formato.',
          }).eq('id', job.mensagem_id),
        ]);
        await admin.rpc('atendimento_agendar_lote', { p_session_id: job.session_id, p_atraso_segundos: 4 });
      }
    }
  }
  return json({ ok: true, claimed: (jobs || []).length, processed });
});
