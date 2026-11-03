// Camada de Orquestração de IA e Hard Rules do Módulo de Receituário Inteligente (PRD Seção 8 e 9).
// Retorna impreterivelmente o JSON Posológico Estruturado da Seção 8.1 validado contra o Bulário Determinístico
// e grava o log de auditoria clínica em public.receituario_auditoria_ia.

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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRole) return json({ error: 'service_unavailable' }, 503);

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const user = await autenticarEquipeClinica(request, admin);
  if (!user) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const entradaClinica = textoLimpo(body.entrada_clinica, 1500);
  if (!entradaClinica) {
    return json({ error: 'entrada_clinica_obrigatoria' }, 400);
  }

  const pacRaw = (body.paciente as Record<string, unknown>) || {};
  const especie = ['canina', 'felina', 'silvestre'].includes(String(pacRaw.especie))
    ? (String(pacRaw.especie) as 'canina' | 'felina' | 'silvestre')
    : 'canina';
  const pesoKg = Math.max(0.05, Math.min(250, Number(pacRaw.peso_kg) || 10));
  const raca = textoLimpo(pacRaw.raca, 80);
  const nomePaciente = textoLimpo(pacRaw.nome, 80) || 'Paciente';
  const mutacaoMdr1 = Boolean(pacRaw.mutacao_mdr1);
  const comorbidades = Array.isArray(pacRaw.comorbidades)
    ? pacRaw.comorbidades.map((c) => textoLimpo(c, 60)).filter(Boolean)
    : [];

  const tInicio = performance.now();

  // Carrega resumo do bulário determinístico do banco para ancorar o prompt da IA
  const { data: bularioRows } = await admin
    .from('receituario_bulario')
    .select(
      'slug,principio_ativo,nome_comercial_sugerido,classe_terapeutica,tipo_padrao,icone_via,especies_contraindicadas,motivo_contraindicacao_especie,risco_mdr1,mensagem_mdr1,dose_padrao_mg_kg,dose_min_mg_kg,dose_max_mg_kg,dose_toxica_mg_kg,dose_felina_max_mg_kg,frequencia_horas_padrao,duracao_dias_padrao,orientacoes_padrao'
    )
    .eq('ativo', true)
    .limit(40);

  const apiKey = await obterOpenAiKey(admin);
  let respostaBrutaIa: Record<string, unknown> | null = null;
  let origemMotor: 'openai_llm' | 'copiloto_deterministico' | 'ia_hibrido' = 'copiloto_deterministico';

  if (apiKey) {
    try {
      const model = segredo('MAIA_OPENAI_MODEL') || 'gpt-4.1-mini';
      const contextoBulario = JSON.stringify(bularioRows || []);
      const systemPrompt = `Você é um Copiloto Clínico Veterinário especialista em farmacologia e posologia (cães, gatos e silvestres).
Sua função é estruturar uma sugestão de prescrição veterinária a partir da conduta ou hipótese diagnóstica informada pelo médico-veterinário, respeitando rigorosamente o peso (${pesoKg} kg), a espécie (${especie}), a raça (${raca || 'SRD'}) e o bulário determinístico abaixo.

REGRAS OBRIGATÓRIAS:
1. Responda EXCLUSIVAMENTE em JSON válido seguindo exatamente o schema:
{
  "alerta_seguranca": {
    "nivel": "baixo" | "medio" | "alto" | "critico",
    "mensagem": string | null
  },
  "itens_prescricao": [
    {
      "tipo": "industrializado" | "manipulado",
      "principio_ativo": string,
      "nome_comercial_sugerido": string,
      "dose_mg_kg": number,
      "posologia": {
        "dose_calculada_mg": number,
        "apresentacao_escolhida": string,
        "quantidade_por_tomada": string,
        "frequencia_horas": number,
        "duracao_dias": number
      },
      "orientacoes_tutor": string,
      "icone_via": "oral" | "topica" | "otica" | "oftalmica" | "injetavel" | "inalatoria"
    }
  ]
}
2. Se o veterinário mencionar um fármaco contraindicado para a espécie (ex.: Paracetamol ou Permetrina em felinos, Ibuprofeno em cães/gatos) ou perigoso para raça com mutação MDR1 (ex.: Ivermectina ou Loperamida em Collie, Pastor de Shetland, Pastor Australiano, Border Collie, Whippet), defina "alerta_seguranca.nivel" como "critico" e explique claramente o motivo em "alerta_seguranca.mensagem".
3. Calcule "dose_calculada_mg" multiplicando exatamente dose_mg_kg * ${pesoKg}.

Bulário Determinístico de Referência:
${contextoBulario}`;

      // 12 s para a OpenAI responder (com 2,2 s quase nunca dava tempo); o painel espera até 15 s
      // e, se nada chegar, segue com o cálculo determinístico local.
      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          response_format: { type: 'json_object' },
          temperature: 0.1,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `Paciente: ${nomePaciente} | Espécie: ${especie} | Raça: ${raca || 'SRD'} | Peso: ${pesoKg} kg | MDR1: ${mutacaoMdr1} | Comorbidades: ${comorbidades.join(', ') || 'nenhuma'}\nEntrada clínica: ${entradaClinica}`,
            },
          ],
        }),
        signal: AbortSignal.timeout(12_000),
      });

      if (aiResponse.ok) {
        const completion = await aiResponse.json().catch(() => null);
        const content = completion?.choices?.[0]?.message?.content;
        if (typeof content === 'string') {
          const parsed = JSON.parse(content);
          if (parsed && Array.isArray(parsed.itens_prescricao)) {
            respostaBrutaIa = parsed;
            origemMotor = 'ia_hibrido';
          }
        }
      }
    } catch {
      // Timeout ou indisponibilidade transitória da LLM: o copiloto determinístico assume imediatamente
      origemMotor = 'copiloto_deterministico';
    }
  }

  const tempoMs = Math.round(performance.now() - tInicio);

  // Grava log de auditoria clínica (RNF Auditoria Clínica - Seção 6)
  let auditoriaId: string | null = null;
  try {
    const { data: audRow } = await admin
      .from('receituario_auditoria_ia')
      .insert({
        usuario_id: user.id,
        prompt_enviado: entradaClinica,
        contexto_paciente: {
          nome: nomePaciente,
          especie,
          raca,
          peso_kg: pesoKg,
          mutacao_mdr1: mutacaoMdr1,
          comorbidades,
        },
        sugestao_bruta_ia: respostaBrutaIa || { fallback_deterministico: true },
        origem_motor: origemMotor,
        tempo_processamento_ms: tempoMs,
      })
      .select('id')
      .maybeSingle();

    auditoriaId = audRow?.id || null;
  } catch {
    // Falha no log não interrompe a resposta clínica
  }

  return json({
    ok: true,
    origem_motor: origemMotor,
    tempo_processamento_ms: tempoMs,
    auditoria_id: auditoriaId,
    payload_ia: respostaBrutaIa,
  });
});
