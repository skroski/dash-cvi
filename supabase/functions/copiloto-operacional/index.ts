// Edge Function do Copiloto Operacional & do Sistema (Lateral Direita Retrátil).
// Utiliza exclusivamente o modelo econômico e ultrarrápido `gpt-5.4-nano` para responder
// dúvidas sobre o funcionamento do painel e sobre a operação em tempo real da clínica.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { obterOpenAiKey } from '../_shared/segredos.ts';

export const MODELO_COPILOTO_FIXO = 'gpt-5.4-nano';

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

function textoLimpo(valor: unknown, limite = 1200): string {
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

  if (profile && (!profile.ativo || !['admin', 'lider', 'atendente', 'veterinario'].includes(profile.papel))) {
    return null;
  }
  return {
    user: data.user,
    papel: (profile?.papel as string) || 'admin',
  };
}

interface MensagemHistorico {
  role: 'user' | 'assistant';
  content: string;
}

function sanitizarHistorico(raw: unknown): MensagemHistorico[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-8)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const rec = item as Record<string, unknown>;
      const role = rec.role === 'assistant' ? 'assistant' : rec.role === 'user' ? 'user' : null;
      const content = textoLimpo(rec.content, 1200);
      if (!role || !content) return null;
      return { role, content };
    })
    .filter((m): m is MensagemHistorico => m !== null);
}

const MANUAL_SISTEMA_RESUMO = `
MAPA DE MÓDULOS DO PAINEL (use estas rotas exatas quando sugerir um caminho):
- /dashboard (Início): Visão geral da clínica, indicadores rápidos, clientes recentes e atalhos operacionais.
- /chats (Conversas): Atendimento WhatsApp em tempo real, pausa da IA por conversa, transferência para atendente e abas de Pipelines CRM (Kanban).
- /clients (Clientes): Cadastro completo de tutores e pets, busca por nome/telefone, exportação/importação de planilhas e abas de Pipelines CRM.
- /schedule (Calendário & Agenda): Agenda clínica integrada ao Google Calendar, filtros por profissional/especialidade, criação e reagendamento de consultas.
- /reminders (Lembretes): Disparo automatizado de lembretes de vacinas, retornos e agendamentos via WhatsApp com botões Confirmar/Cancelar.
- /prontuario (Prontuário IA): Gravação de consulta por voz, transcrição clínica com IA, revisão campo a campo e assinatura digital SHA-256 com LGPD.
- /receituario (Receituário IA): Prescrição veterinária inteligente com calculadora posológica mg/kg, bulário de Hard Rules (bloqueio de Paracetamol/Permetrina em gatos e MDR1) e PDF A4 com QR Code.
- /queue (Fila Presencial): Recepção, triagem, chamador de consultório (/chamar), painel de TV (/tv) e totem de senhas (/totem).
- /metrics (Métricas): Desempenho do atendimento, volume de mensagens, tempo de resposta e conversão.
- /attendants (Atendentes): Gestão da equipe de atendimento, departamentos e status operacional.
- /satisfaction-surveys (Pesquisas): Acompanhamento de NPS e avaliações de satisfação dos tutores.
- /uazapi (Conexão WhatsApp): Leitura de QR Code ou Pair Code para conectar a instância do WhatsApp da clínica.
- /knowledge (Base de Conhecimento RAG): Upload de documentos e manuais da clínica para alimentar a memória da assistente virtual.
- /my-prompt (Meu Prompt): Editor modular de regras da assistente virtual por categoria, variáveis dinâmicas {{...}}, prévia compilada, histórico de versões com diff e rollback.
- /agenda-configuracao (Regras da Agenda): Configuração de profissionais, especialidades, durações, horários de atendimento e bloqueios.
- /atendimento-configuracao (Config. do Atendimento): Dados da clínica (endereço, PIX, horários, planos aceitos, nome da assistente e notificações).
- /configuration (Configurações): Chave da OpenAI no Vault e parâmetros técnicos do sistema.
- /users (Usuários e Auditoria): Controle de acessos por papel (admin, líder, atendente, veterinário) e trilha de auditoria.
`.trim();

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRole) return json({ error: 'service_unavailable' }, 503);

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authInfo = await autenticarEquipeClinica(request, admin);
  if (!authInfo) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const pergunta = textoLimpo(body.pergunta, 1000);
  if (!pergunta) {
    return json({ error: 'pergunta_obrigatoria' }, 400);
  }

  const rotaAtual = textoLimpo(body.rota_atual, 120) || '/dashboard';
  const tituloTela = textoLimpo(body.titulo_tela, 120) || 'Painel';
  const historico = sanitizarHistorico(body.historico);
  const contextoOperacionalClient =
    body.contexto_operacional && typeof body.contexto_operacional === 'object'
      ? body.contexto_operacional
      : null;

  const tInicio = performance.now();

  const apiKey = await obterOpenAiKey(admin);
  let respostaTexto = '';
  let origemMotor: 'openai_gpt_5_4_nano' | 'copiloto_deterministico' = 'copiloto_deterministico';

  if (apiKey) {
    const systemPrompt = `Você é o **Copiloto da Operação**, um assistente lateral inteligente embutido no painel de gestão da clínica veterinária.
Você opera exclusivamente no modelo ultrarrápido **${MODELO_COPILOTO_FIXO}**.

CONTEXTO DO USUÁRIO AGORA:
- Tela aberta no momento: ${tituloTela} (rota: ${rotaAtual})
- Papel do usuário: ${authInfo.papel}

DADOS EM TEMPO REAL DA OPERAÇÃO DA CLÍNICA (extraídos agora do Supabase):
${JSON.stringify(contextoOperacionalClient || {}, null, 2)}

${MANUAL_SISTEMA_RESUMO}

DIRETRIZES OBRIGATÓRIAS:
1. Seja direto, claro, prestativo e estruturado em tópicos curtos (estilo copiloto de editor).
2. Quando o usuário perguntar sobre a **operação dele** (ex.: quantos clientes, conversas hoje, agenda de hoje, lembretes, fila presencial, pipelines CRM, regras do prompt, satisfação), responda usando **exatamente os números do JSON de DADOS EM TEMPO REAL DA OPERAÇÃO** acima. Nunca invente números que não estejam no JSON.
3. Quando o usuário perguntar sobre **como usar o sistema** ou sobre a **tela atual**, explique o passo a passo de forma prática e indique a rota entre colchetes no formato [Ir para Nome da Tela](/rota) para que o painel crie um botão clicável de navegação.
4. Responda sempre em Português do Brasil (PT-BR).`;

    const mensagensApi = [
      { role: 'system', content: systemPrompt },
      ...historico,
      { role: 'user', content: pergunta },
    ];

    // Chama prioritariamente o modelo único fixo: gpt-5.4-nano
    const modelosTentativa = [MODELO_COPILOTO_FIXO, 'gpt-4.1-nano'];
    for (const mod of modelosTentativa) {
      try {
        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: mod,
            temperature: 0.2,
            max_completion_tokens: 700,
            messages: mensagensApi,
          }),
          signal: AbortSignal.timeout(12_000),
        });

        if (aiRes.ok) {
          const completion = await aiRes.json().catch(() => null);
          const content = completion?.choices?.[0]?.message?.content;
          if (typeof content === 'string' && content.trim()) {
            respostaTexto = content.trim();
            origemMotor = 'openai_gpt_5_4_nano';
            break;
          }
        } else if (aiRes.status !== 404 && aiRes.status !== 400) {
          break;
        }
      } catch {
        // Segue para fallback se houver timeout
      }
    }
  }

  const tempoMs = Math.round(performance.now() - tInicio);

  if (respostaTexto) {
    try {
      await admin.from('copiloto_auditoria').insert({
        usuario_id: authInfo.user.id,
        rota_atual: rotaAtual,
        pergunta,
        resposta: respostaTexto,
        modelo: MODELO_COPILOTO_FIXO,
        origem_motor: origemMotor,
        tempo_processamento_ms: tempoMs,
      });
    } catch {
      // Falha de log não bloqueia o retorno
    }
  }

  return json({
    ok: Boolean(respostaTexto),
    modelo: MODELO_COPILOTO_FIXO,
    origem_motor: origemMotor,
    tempo_processamento_ms: tempoMs,
    resposta: respostaTexto || null,
  });
});
