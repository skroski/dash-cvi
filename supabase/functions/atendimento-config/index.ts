// Testes de configuração (sem efeitos colaterais): simula a classificação de uma
// mensagem, a detecção por frase e a pré-visualização do prompt com os dados atuais
// da empresa. Nada é enviado, pausado ou notificado aqui.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { obterOpenAiKey, segredo } from '../_shared/segredos.ts';
import {
  classificarMensagemCliente, detectarPorFrase, estadoPadrao, estadosClassificaveis, renderizarTemplate,
  type EstadoAtendimento,
} from '../_shared/estados.ts';
import { carregarConfig, variaveisDaEmpresa } from '../_shared/config_atendimento.ts';
import { montarContextoAgenda } from '../_shared/agenda_catalogo.ts';
import { renderizarPrompt, type ClienteContexto } from '../_shared/prompt_variaveis.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRole) return json({ error: 'service_unavailable' }, 500);
  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'unauthorized' }, 401);
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth.user) return json({ error: 'unauthorized' }, 401);
  const { data: perfil } = await admin.from('profiles').select('papel, ativo').eq('id', auth.user.id).maybeSingle();
  if (!perfil?.ativo || perfil.papel !== 'admin') return json({ error: 'forbidden' }, 403);

  let body: {
    action?: string; texto?: string; resposta?: string; estados?: EstadoAtendimento[];
    modelo?: string; agora?: string; cliente?: ClienteContexto;
  };
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }

  if (body.action === 'previa_prompt') {
    // Renderiza o prompt (rascunho enviado ou o compilado das regras ativas) como o assistente o verá.
    const config = await carregarConfig(admin);
    let modelo = typeof body.modelo === 'string' ? body.modelo.slice(0, 120_000) : '';
    if (!modelo) {
      const { data } = await admin.rpc('obter_prompt_compilado');
      const linha = Array.isArray(data) ? data[0] : data;
      modelo = String(linha?.prompt_completo || '');
    }
    const agora = body.agora && Number.isFinite(Date.parse(body.agora)) ? new Date(body.agora) : new Date();
    const cliente: ClienteContexto = {
      nome: body.cliente?.nome ?? 'Maria', nomeWhatsapp: body.cliente?.nomeWhatsapp ?? 'Maria S.',
      email: body.cliente?.email ?? null, telefone: body.cliente?.telefone ?? '5511999990000@s.whatsapp.net',
      petNome: body.cliente?.petNome ?? 'Thor', petRaca: body.cliente?.petRaca ?? null, petPorte: body.cliente?.petPorte ?? null,
    };
    const { texto, desconhecidas } = renderizarPrompt(modelo, {
      agora, empresa: config.empresa, cliente, servicos: config.servicos,
      horariosPorTipo: config.horariosPorTipo, tipos: config.tiposAtivos,
    });
    const contextoAgenda = montarContextoAgenda(config.catalogo);
    const completo = `${texto}${contextoAgenda ? `\n\n${contextoAgenda}` : ''}`;
    return json({
      ok: true,
      texto: completo,
      desconhecidas,
      caracteres: completo.length,
      tokens_estimados: Math.ceil(completo.length / 3.6),
      variaveis_empresa: variaveisDaEmpresa(config),
    });
  }
  if (body.action !== 'testar_classificacao') return json({ error: 'invalid_action' }, 400);

  const texto = String(body.texto || '').slice(0, 2_000);
  const resposta = String(body.resposta || '').slice(0, 4_000);
  // Permite testar o rascunho aberto na tela antes de salvar; senão usa o que está salvo.
  let estados = Array.isArray(body.estados) ? body.estados : [];
  if (!estados.length) {
    const { data } = await admin.from('atendimento_estados').select('*').eq('ativo', true).order('ordem');
    estados = (data || []) as EstadoAtendimento[];
  }

  const resultado: Record<string, unknown> = { ok: true };
  if (texto && estadosClassificaveis(estados).length) {
    const apiKey = await obterOpenAiKey(admin);
    if (!apiKey) return json({ error: 'openai_not_configured' }, 503);
    const { data: cfg } = await admin.from('atendimento_config').select('modelo_ia').eq('singleton', true).maybeSingle();
    try {
      const estado = await classificarMensagemCliente({
        apiKey, modelo: cfg?.modelo_ia || segredo('MAIA_OPENAI_MODEL') || 'gpt-4.1-mini', estados, texto,
      });
      resultado.mensagem_cliente = estado ? { chave: estado.chave, nome: estado.nome } : null;
    } catch {
      return json({ error: 'classifier_failed' }, 502);
    }
  } else if (texto) {
    const padrao = estadoPadrao(estados);
    resultado.mensagem_cliente = padrao ? { chave: padrao.chave, nome: padrao.nome } : null;
  }
  if (resposta) {
    const config = await carregarConfig(admin);
    const estado = detectarPorFrase(resposta, estados, variaveisDaEmpresa(config));
    resultado.resposta_assistente = estado ? { chave: estado.chave, nome: estado.nome } : null;
  }
  const alvo = estados.find((item) => item.chave === (resultado.mensagem_cliente as { chave?: string } | undefined)?.chave) ??
    estados.find((item) => item.chave === (resultado.resposta_assistente as { chave?: string } | undefined)?.chave);
  if (alvo?.notificar) {
    resultado.previa_notificacao = renderizarTemplate(alvo.modelo_notificacao || '{{resumo}}', {
      resumo: '(resumo da conversa gerado pela IA)', telefone_cliente: '5500000000000', estado: alvo.nome, nome_empresa: '',
    });
  }
  return json(resultado);
});
