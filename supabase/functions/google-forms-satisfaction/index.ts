import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { segredo } from '../_shared/segredos.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface GoogleFormsWebhookPayload {
  formId?: string;
  responseId?: string;
  submittedAt?: string;
  trackingToken?: string;
  rating?: number | string | null;
  nps?: number | string | null;
  comment?: string | null;
  email?: string | null;
  phone?: string | null;
  answers?: Record<string, unknown>;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function optionalNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Método não permitido' }, 405);
  }

  const expectedSecret = segredo('GOOGLE_FORMS_WEBHOOK_SECRET');
  const providedSecret = request.headers.get('x-webhook-secret');
  if (!expectedSecret) {
    console.error('GOOGLE_FORMS_WEBHOOK_SECRET não configurado');
    return json({ error: 'Integração não configurada' }, 500);
  }
  if (!providedSecret || providedSecret !== expectedSecret) {
    return json({ error: 'Não autorizado' }, 401);
  }

  let payload: GoogleFormsWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  if (!payload.formId || !payload.trackingToken || !payload.submittedAt) {
    return json(
      { error: 'formId, trackingToken e submittedAt são obrigatórios' },
      400
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Credenciais internas do Supabase ausentes');
    return json({ error: 'Serviço indisponível' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc(
    'registrar_resposta_pesquisa_satisfacao',
    {
      p_tracking_token: payload.trackingToken,
      p_form_id: payload.formId,
      p_google_response_id: payload.responseId ?? '',
      p_submitted_at: payload.submittedAt,
      p_nota: optionalNumber(payload.rating),
      p_nps: optionalNumber(payload.nps),
      p_comentario: payload.comment ?? null,
      p_email: payload.email ?? null,
      p_telefone: payload.phone ?? null,
      p_respostas: payload.answers ?? {},
    }
  );

  if (error) {
    console.error('Erro ao registrar resposta do Google Forms:', error);
    const invalidTracking =
      error.message.includes('acompanhamento') || error.message.includes('formulário');
    return json(
      { error: invalidTracking ? 'Resposta não vinculada' : 'Falha ao registrar resposta' },
      invalidTracking ? 404 : 500
    );
  }

  return json({ ok: true, result: data?.[0] ?? null });
});
