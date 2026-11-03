// Pipeline Backend do Prontuário com IA (Seção 4.1, 4.2 e 4.3).
// Edge Function do Supabase para processamento do áudio e extração clínica via IA:
// 1. Recebe POST JSON { draftId, petId, recordId, audioUrl, audioAnexoId, systemPrompt, context }
//    via supabase.functions.invoke (JWT de um usuário ativo da equipe; demais chamadas recebem 401)
// 2. Baixa o áudio da Signed URL (validando origem contra SUPABASE_URL para prevenir SSRF)
// 3. Transcreve via Groq Whisper (whisper-large-v3) ou OpenAI Whisper (whisper-1)
// 4. Extrai o JSON clínico via OpenAI (gpt-4o-mini) com temperature=0 e o systemPrompt configurado
// 5. Atualiza public.prontuario_ia_drafts com credencial de serviço (service_role):
//    - Sucesso: status='ready', transcript, payload
//    - Falha:   status='error', error_message

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { obterOpenAiKey, segredo } from '../_shared/segredos.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function textoLimpo(valor: unknown, limite = 500): string {
  return typeof valor === 'string'
    ? valor.replaceAll(String.fromCharCode(0), '').trim().slice(0, limite)
    : '';
}

// O Whisper escolhe o decodificador pela extensão do arquivo enviado.
const EXTENSOES_WHISPER = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'];

function nomeArquivoAudio(audioUrl: string): string {
  try {
    const ext = new URL(audioUrl).pathname.split('.').pop()?.toLowerCase() || '';
    return `consulta.${EXTENSOES_WHISPER.includes(ext) ? ext : 'webm'}`;
  } catch {
    return 'consulta.webm';
  }
}

async function autenticarEquipeClinica(request: Request, admin: SupabaseClient) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return null;
  const { data, error } = await admin.auth.getUser(bearer);
  if (error || !data.user) return null;

  const { data: profile } = await admin
    .from('profiles')
    .select('papel,ativo')
    .eq('id', data.user.id)
    .maybeSingle();

  if (!profile?.ativo || !['admin', 'lider', 'atendente', 'veterinario'].includes(profile.papel)) {
    return null;
  }
  return data.user;
}

function urlAudioSegura(audioUrl: string, supabaseUrl: string): boolean {
  try {
    const parsedAudio = new URL(audioUrl);
    const parsedBase = new URL(supabaseUrl);
    return (
      (parsedAudio.protocol === 'https:' || parsedAudio.hostname === 'localhost' || parsedAudio.hostname === '127.0.0.1') &&
      parsedAudio.host === parsedBase.host &&
      parsedAudio.pathname.includes('/storage/v1/object/sign/medical-files/')
    );
  } catch {
    return false;
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'service_unavailable' }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Só a equipe logada do painel pode disparar transcrição (custo de IA e escrita com service_role).
  const user = await autenticarEquipeClinica(request, admin);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const draftId = textoLimpo(body.draftId, 64);
  const audioUrl = textoLimpo(body.audioUrl, 2048);
  const systemPrompt = textoLimpo(body.systemPrompt, 12000);
  const ctx = (body.context && typeof body.context === 'object' ? body.context : {}) as Record<string, unknown>;

  if (!draftId || !audioUrl) {
    return json({ error: 'draftId_and_audioUrl_required' }, 400);
  }

  const markDraftError = async (msg: string) => {
    await admin
      .from('prontuario_ia_drafts')
      .update({
        status: 'error',
        error_message: msg.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId);
  };

  if (!urlAudioSegura(audioUrl, supabaseUrl)) {
    await markDraftError('URL de áudio inválida ou fora do bucket autorizado.');
    return json({ error: 'invalid_audio_url' }, 400);
  }

  try {
    // 1. Download do áudio a partir da Signed URL
    const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(20_000) });
    if (!audioRes.ok) {
      throw new Error(`Não foi possível baixar o áudio da consulta (status ${audioRes.status}).`);
    }
    const audioBlob = await audioRes.blob();

    // 2. Transcrição (Groq Whisper whisper-large-v3 prioritário; fallback OpenAI whisper-1)
    const groqKey = segredo('GROQ_API_KEY');
    const openaiKey = await obterOpenAiKey(admin);

    if (!groqKey && !openaiKey) {
      throw new Error('Chave de IA (GROQ_API_KEY ou OPENAI_API_KEY) não configurada no backend.');
    }

    const form = new FormData();
    form.append('file', audioBlob, nomeArquivoAudio(audioUrl));
    form.append('language', 'pt');
    form.append('response_format', 'json');

    let transcript = '';
    if (groqKey) {
      form.append('model', 'whisper-large-v3');
      const whisperRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}` },
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
      if (!whisperRes.ok) {
        throw new Error(`Falha na transcrição Groq Whisper (${whisperRes.status}).`);
      }
      const whisperData = await whisperRes.json();
      transcript = String(whisperData?.text || '').trim();
    } else if (openaiKey) {
      form.append('model', 'whisper-1');
      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: form,
        signal: AbortSignal.timeout(30_000),
      });
      if (!whisperRes.ok) {
        throw new Error(`Falha na transcrição OpenAI Whisper (${whisperRes.status}).`);
      }
      const whisperData = await whisperRes.json();
      transcript = String(whisperData?.text || '').trim();
    }

    if (!transcript) {
      throw new Error('A transcrição do áudio retornou vazia.');
    }

    // 3. Extração estruturada JSON (OpenAI gpt-4o-mini)
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY necessária para extração estruturada do prontuário.');
    }

    const petName = textoLimpo(ctx.petName, 80) || '(não informado)';
    const species = textoLimpo(ctx.species, 40) || 'espécie não informada';
    const veterinario = textoLimpo(ctx.veterinario, 100) || '(não informado)';

    const userContent = `Contexto: paciente ${petName} (${species}). Veterinário: ${veterinario}.\n\nTRANSCRIÇÃO DA CONSULTA:\n${transcript}`;

    const llmRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: segredo('PRONTUARIO_IA_OPENAI_MODEL') || 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              systemPrompt ||
              'Estruture a consulta em JSON. Preencha somente o que foi dito; nunca invente.',
          },
          { role: 'user', content: userContent },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!llmRes.ok) {
      throw new Error(`Falha na extração clínica pela LLM (${llmRes.status}).`);
    }

    const completion = await llmRes.json();
    const rawContent = completion?.choices?.[0]?.message?.content;
    let payload: Record<string, unknown> = {};
    if (typeof rawContent === 'string') {
      try {
        payload = JSON.parse(rawContent) || {};
      } catch {
        payload = {};
      }
    }
    if (!payload.transcript) {
      payload.transcript = transcript;
    }

    // 4. Escrita de volta em prontuario_ia_drafts (Seção 4.2)
    const { error: updateErr } = await admin
      .from('prontuario_ia_drafts')
      .update({
        status: 'ready',
        transcript,
        payload,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draftId);

    if (updateErr) {
      throw new Error('Falha ao gravar rascunho pronto no banco.');
    }

    return json({ ok: true, draftId, status: 'ready' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado no processamento do áudio.';
    await markDraftError(msg);
    return json({ ok: false, draftId, status: 'error', error: msg }, 500);
  }
});
