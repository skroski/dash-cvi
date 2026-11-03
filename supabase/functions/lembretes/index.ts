// Supabase Edge Function: lembretes
//
// Substitui o fluxo n8n "LembretesVacinas" (ver docs/lembretes-migracao-n8n.md).
//
// AÇÕES (POST, corpo JSON):
//   { "acao": "processar" }   Reivindica as mensagens que vencem no próximo
//                             minuto, escreve o texto (OpenAI a partir das
//                             frases de exemplo, ou a própria frase se a IA
//                             falhar), salva o texto e envia pela uazapi no
//                             horário programado (intervalo aleatório já
//                             definido no planejamento). Responde 202 na hora e
//                             processa em segundo plano.
//   { "acao": "previa", ... } Gera textos de exemplo com a IA, sem enviar.
//   { "acao": "diagnostico" } Diz quais segredos estão configurados.
//
// AUTENTICAÇÃO (verify_jwt = false; a checagem é feita aqui):
//   * pg_cron: header X-Cron-Secret (comparação em tempo constante). Aceita
//     LEMBRETES_CRON_SECRET e, durante uma troca, LEMBRETES_CRON_SECRET_ANTERIOR.
//   * Painel: Authorization: Bearer <JWT do usuário logado>.
//
// SEGREDOS:
//   supabase secrets set OPENAI_API_KEY=... UAZAPI_SERVER_URL=... \
//     UAZAPI_INSTANCE_TOKEN=... LEMBRETES_CRON_SECRET=...
//   (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm do runtime)

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import {
  DADOS_EXEMPLO,
  DadosLembrete,
  exemplosValidos,
  montarPrompt,
  renderizarExemplo,
  validarTextoIA,
} from './mensagem.ts';
import { obterOpenAiKey, segredo } from '../_shared/segredos.ts';

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const EXEMPLOS_RESERVA = [
  'Olá, {{nome_tutor}}! Passando para lembrar do horário de {{nome_pet}}: {{servico}} {{quando}}, {{data}}, às {{horario}}.\n\nSe precisar remarcar, é só responder esta mensagem.',
];
const MODELOS_PERMITIDOS = /^(gpt-[\w.-]+|o\d[\w.-]*)$/;
const LIMITE_POR_EXECUCAO = 10;
const HORIZONTE_SEGUNDOS = 55;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const dormir = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Mensagem {
  id: number;
  configuracao_id: number | null;
  disparo: 'automatico' | 'manual' | 'teste';
  dia_envio: string;
  telefone: string;
  nome_tutor: string;
  nomes_pets: string[];
  servicos: string[];
  servicos_texto?: string[];
  data_agendada: string;
  horario_agendado: string | null;
  programado_para: string;
  texto: string | null;
  botoes_confirmacao?: boolean;
  categoria?: string;
}

interface Regra {
  id: number;
  exemplos: string[];
  usar_ia: boolean;
  modelo_ia: string;
  instrucoes_ia: string | null;
  intervalo_min_segundos?: number;
  categoria?: string;
  botoes_confirmacao?: boolean;
}

interface TextoGerado {
  texto: string;
  origem: 'ia' | 'exemplo';
  exemploIndice: number | null;
  modelo: string | null;
  motivoReserva?: string;
}

class ErroEnvio extends Error {}

// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------

async function segredoConfere(recebido: string, esperado: string | undefined) {
  if (!esperado) return false;
  const codificador = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', codificador.encode(recebido)),
    crypto.subtle.digest('SHA-256', codificador.encode(esperado)),
  ]);
  const va = new Uint8Array(a);
  const vb = new Uint8Array(b);
  let diferenca = 0;
  for (let i = 0; i < va.length; i++) diferenca |= va[i] ^ vb[i];
  return diferenca === 0;
}

type Chamador = { tipo: 'cron' } | { tipo: 'usuario'; id: string };

async function autenticar(request: Request, admin: SupabaseClient): Promise<Chamador | null> {
  const segredoCron = request.headers.get('x-cron-secret');
  if (segredoCron) {
    const confere =
      (await segredoConfere(segredoCron, segredo('LEMBRETES_CRON_SECRET'))) ||
      (await segredoConfere(segredoCron, segredo('LEMBRETES_CRON_SECRET_ANTERIOR')));
    return confere ? { tipo: 'cron' } : null;
  }

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return { tipo: 'usuario', id: data.user.id };
}

// ---------------------------------------------------------------------------
// Texto: OpenAI com as frases de exemplo, ou a própria frase como reserva
// ---------------------------------------------------------------------------

async function chamarOpenAI(modelo: string, sistema: string, usuario: string) {
  const chave = await obterOpenAiKey();
  if (!chave) throw new Error('OPENAI_API_KEY não configurada');

  let ultimoErro = '';
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const resposta = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelo,
          temperature: 0.9,
          max_completion_tokens: 600,
          messages: [
            { role: 'system', content: sistema },
            { role: 'user', content: usuario },
          ],
        }),
        signal: AbortSignal.timeout(25_000),
      });
      if (resposta.ok) {
        const dados = await resposta.json();
        return String(dados?.choices?.[0]?.message?.content ?? '');
      }
      ultimoErro = `OpenAI ${resposta.status}`;
      if (resposta.status !== 429 && resposta.status < 500) break;
    } catch (error) {
      ultimoErro = error instanceof Error ? error.name : 'erro de rede';
    }
    await dormir(1_500 * tentativa);
  }
  throw new Error(ultimoErro || 'OpenAI indisponível');
}

async function gerarTexto(
  dados: DadosLembrete,
  regra: Pick<Regra, 'exemplos' | 'usar_ia' | 'modelo_ia' | 'instrucoes_ia'> | null
): Promise<TextoGerado> {
  const exemplos = exemplosValidos(regra?.exemplos);
  const frases = exemplos.length > 0 ? exemplos : EXEMPLOS_RESERVA;
  const indice = Math.floor(Math.random() * frases.length);
  const reserva = (motivo?: string): TextoGerado => ({
    texto: renderizarExemplo(frases[indice], dados),
    origem: 'exemplo',
    exemploIndice: exemplos.length > 0 ? indice : null,
    modelo: null,
    motivoReserva: motivo,
  });

  if (regra && !regra.usar_ia) return reserva();

  const modelo = MODELOS_PERMITIDOS.test(regra?.modelo_ia ?? '') ? regra!.modelo_ia : 'gpt-4.1-mini';
  try {
    const { sistema, usuario } = montarPrompt(dados, frases, regra?.instrucoes_ia);
    const resultado = validarTextoIA(await chamarOpenAI(modelo, sistema, usuario), dados);
    if (!resultado.ok) return reserva(`IA descartada: ${resultado.motivo}`);
    return { texto: resultado.texto, origem: 'ia', exemploIndice: null, modelo };
  } catch (error) {
    return reserva(`IA indisponível: ${error instanceof Error ? error.message : 'erro'}`);
  }
}

// ---------------------------------------------------------------------------
// Envio pela uazapi
// ---------------------------------------------------------------------------

type RespostaUazapi = {
  messageid?: unknown;
  messageId?: unknown;
  id?: unknown;
  key?: { id?: unknown };
  message?: { messageid?: unknown; id?: unknown };
};

function extrairIdMensagem(dados: unknown): string | null {
  if (!dados || typeof dados !== 'object') return null;
  const d = dados as RespostaUazapi;
  const id = d.messageid ?? d.messageId ?? d.id ?? d.key?.id ?? d.message?.messageid ?? d.message?.id;
  return id ? String(id) : null;
}

// Só repete quando a mensagem com certeza não saiu (sem conexão, 429, 502-504).
// Timeout e 500 são ambíguos: viram falha para o reenvio ser decisão humana,
// em vez de arriscar WhatsApp duplicado para o tutor.
async function enviarUazapi(numero: string, texto: string) {
  const base = segredo('UAZAPI_SERVER_URL')?.replace(/\/$/, '');
  const token = segredo('UAZAPI_INSTANCE_TOKEN');
  if (!base || !token) {
    throw new ErroEnvio('WhatsApp não configurado: defina UAZAPI_SERVER_URL e UAZAPI_INSTANCE_TOKEN.');
  }

  let ultimoErro = '';
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    let resposta: Response;
    try {
      resposta = await fetch(`${base}/send/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token },
        body: JSON.stringify({ number: numero, text: texto }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new ErroEnvio(
          'A uazapi não respondeu em 20 s. Confira no WhatsApp se a mensagem chegou antes de reenviar.'
        );
      }
      ultimoErro = 'sem conexão com a uazapi';
      await dormir(2_000 * tentativa);
      continue;
    }

    if (resposta.ok) {
      return extrairIdMensagem(await resposta.json().catch(() => null));
    }

    const corpo = (await resposta.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
    if ([429, 502, 503, 504].includes(resposta.status)) {
      ultimoErro = `uazapi ${resposta.status}`;
      await dormir(3_000 * tentativa);
      continue;
    }
    throw new ErroEnvio(`A uazapi recusou o envio (${resposta.status})${corpo ? `: ${corpo}` : ''}`);
  }
  throw new ErroEnvio(`WhatsApp indisponível após 3 tentativas (${ultimoErro}).`);
}

/**
 * Envia mensagem de confirmação com 2 botões via Uazapi (POST /send/menu).
 * Se a instância não responder ou não suportar menus/botões, faz fallback
 * transparente para enviarUazapi (texto simples), garantindo entrega.
 */
async function enviarUazapiComBotoes(
  numero: string,
  texto: string,
  clinica: string,
  botoes: Array<{ id: string; text: string }> = [
    { id: 'confirmar_agendamento', text: 'Confirmar' },
    { id: 'nao_confirmar_agendamento', text: 'Não Confirmar' },
  ]
) {
  const base = segredo('UAZAPI_SERVER_URL')?.replace(/\/$/, '');
  const token = segredo('UAZAPI_INSTANCE_TOKEN');
  if (!base || !token) {
    throw new ErroEnvio('WhatsApp não configurado: defina UAZAPI_SERVER_URL e UAZAPI_INSTANCE_TOKEN.');
  }

  const choices = botoes.map((b) => `${b.text}|${b.id}`);

  try {
    const resposta = await fetch(`${base}/send/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify({
        number: numero,
        type: 'button',
        text: texto,
        footerText: clinica || undefined,
        choices,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (resposta.ok) {
      const data = await resposta.json().catch(() => null);
      return extrairIdMensagem(data);
    }

    // Tentativa em button_legacy se type button falhar
    const respostaLegacy = await fetch(`${base}/send/menu`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', token },
      body: JSON.stringify({
        number: numero,
        type: 'button_legacy',
        text: texto,
        footerText: clinica || undefined,
        choices,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (respostaLegacy.ok) {
      const data = await respostaLegacy.json().catch(() => null);
      return extrairIdMensagem(data);
    }

    const corpo = (await respostaLegacy.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 150);
    console.warn(`[lembretes] /send/menu retornou status ${respostaLegacy.status}: ${corpo}. Acionando fallback para texto simples.`);
  } catch (erro) {
    console.warn('[lembretes] /send/menu falhou ou timeout, acionando fallback para texto simples:', erro);
  }

  return enviarUazapi(numero, texto);
}


// ---------------------------------------------------------------------------
// Fila
// ---------------------------------------------------------------------------

function dadosDaMensagem(
  mensagem: Mensagem,
  clinica: string,
  categoria?: string,
  linkPesquisa?: string | null
): DadosLembrete {
  return {
    nomeTutor: mensagem.nome_tutor,
    pets: mensagem.nomes_pets ?? [],
    // servicos_texto é como o serviço deve aparecer na frase (ex.: minúsculas).
    servicos: mensagem.servicos_texto?.length ? mensagem.servicos_texto : mensagem.servicos ?? [],
    dataAgendada: mensagem.data_agendada,
    horario: mensagem.horario_agendado,
    diaEnvio: mensagem.dia_envio,
    clinica,
    categoria,
    linkPesquisa,
  };
}

async function registrarEvento(
  admin: SupabaseClient,
  tipo: 'info' | 'erro_sistema',
  descricao: string,
  mensagemId: number | null = null,
  dados: Record<string, unknown> | null = null
) {
  const { error } = await admin
    .from('lembrete_eventos')
    .insert({ tipo, descricao: descricao.slice(0, 500), mensagem_id: mensagemId, dados });
  if (error) console.error('[lembretes] falha ao registrar evento', error.code);
}

/** Envia uma mensagem e devolve o instante do envio (ou null se falhou). */
async function processarMensagem(
  admin: SupabaseClient,
  mensagem: Mensagem,
  regra: Regra | null,
  clinica: string,
  naoAntesDe: number
): Promise<number | null> {
  let texto = mensagem.texto;

  if (!texto) {
    let linkPesquisa: string | null = null;
    const exemplosRegra = regra?.exemplos ?? [];
    if (
      exemplosRegra.some(
        (e) => e.includes('link_pesquisa') || /pesquisa|satisfa[cç][aã]o/i.test(e)
      )
    ) {
      try {
        const { data: configPesquisa } = await admin
          .from('pesquisa_satisfacao_configuracoes')
          .select('google_form_url')
          .eq('ativo', true)
          .limit(1)
          .maybeSingle();
        if (configPesquisa?.google_form_url) {
          linkPesquisa = configPesquisa.google_form_url;
        }
      } catch (_e) {
        // silencioso se a tabela de pesquisa não existir no ambiente
      }
    }

    const dados = dadosDaMensagem(mensagem, clinica, regra?.categoria, linkPesquisa);
    const gerado = await gerarTexto(dados, regra);
    texto = gerado.texto;
    // O texto é salvo antes do envio: o painel mostra exatamente o que saiu e
    // um reenvio não reescreve a mensagem.
    const { error } = await admin
      .from('lembrete_mensagens')
      .update({
        texto,
        origem_texto: gerado.origem,
        exemplo_indice: gerado.exemploIndice,
        modelo_ia: gerado.modelo,
      })
      .eq('id', mensagem.id);
    if (error) throw new Error(`não foi possível salvar o texto (${error.code})`);
    if (gerado.motivoReserva) {
      await registrarEvento(
        admin,
        'info',
        `${gerado.motivoReserva}. Usada a frase de exemplo ${(gerado.exemploIndice ?? 0) + 1}.`,
        mensagem.id
      );
    }
  }

  // O planejamento já espaça a fila; aqui só garantimos que duas mensagens da
  // mesma execução nunca saiam coladas.
  const alvo = Math.max(new Date(mensagem.programado_para).getTime(), naoAntesDe);
  const espera = alvo - Date.now();
  if (espera > 0) await dormir(Math.min(espera, (HORIZONTE_SEGUNDOS + 5) * 1000));

  const numero = mensagem.telefone.split('@')[0].replace(/\D/g, '');
  const comBotoes = Boolean(mensagem.botoes_confirmacao ?? regra?.botoes_confirmacao ?? false);
  try {
    const providerId = comBotoes
      ? await enviarUazapiComBotoes(numero, texto, clinica)
      : await enviarUazapi(numero, texto);
    await admin
      .from('lembrete_mensagens')
      .update({
        status: 'enviado',
        enviado_em: new Date().toISOString(),
        provider_message_id: providerId,
        processando_desde: null,
        erro: null,
      })
      .eq('id', mensagem.id);
    console.log('[lembretes] enviado', mensagem.id, mensagem.disparo, comBotoes ? '(com botões)' : '');
    return Date.now();
  } catch (error) {
    const motivo = error instanceof Error ? error.message : 'Falha desconhecida no envio.';
    await admin
      .from('lembrete_mensagens')
      .update({ status: 'falha', erro: motivo.slice(0, 500), processando_desde: null })
      .eq('id', mensagem.id);
    console.warn('[lembretes] falha', mensagem.id, error instanceof ErroEnvio ? 'envio' : 'interno');
    return null;
  }
}

async function processarFila(admin: SupabaseClient) {
  const { data, error } = await admin.rpc('lembretes_reivindicar', {
    p_limite: LIMITE_POR_EXECUCAO,
    p_horizonte_segundos: HORIZONTE_SEGUNDOS,
  });
  if (error) throw new Error(`reivindicar falhou (${error.code})`);
  const mensagens = ((data ?? []) as Mensagem[]).sort(
    (a, b) => new Date(a.programado_para).getTime() - new Date(b.programado_para).getTime()
  );
  if (mensagens.length === 0) return 0;

  const idsRegras = [...new Set(mensagens.map((m) => m.configuracao_id).filter(Boolean))] as number[];
  const [{ data: regras }, { data: ajustes }] = await Promise.all([
    idsRegras.length
      ? admin
          .from('lembrete_configuracoes')
          .select('id, exemplos, usar_ia, modelo_ia, instrucoes_ia, intervalo_min_segundos, categoria, botoes_confirmacao')
          .in('id', idsRegras)
      : Promise.resolve({ data: [] as Regra[] }),
    admin.from('lembrete_ajustes').select('nome_clinica').eq('id', 1).maybeSingle(),
  ]);
  const regraPorId = new Map(((regras ?? []) as Regra[]).map((regra) => [regra.id, regra]));
  const clinica = (ajustes as { nome_clinica?: string } | null)?.nome_clinica ?? '';

  let ultimoEnvio = 0;
  for (const mensagem of mensagens) {
    const regra = mensagem.configuracao_id ? regraPorId.get(mensagem.configuracao_id) ?? null : null;
    const intervaloMinimo = (regra?.intervalo_min_segundos ?? 20) * 1000;
    try {
      const enviadoEm = await processarMensagem(
        admin,
        mensagem,
        regra,
        clinica,
        mensagem.disparo === 'teste' ? 0 : ultimoEnvio + intervaloMinimo
      );
      if (enviadoEm && mensagem.disparo !== 'teste') ultimoEnvio = enviadoEm;
    } catch (error) {
      const motivo = error instanceof Error ? error.message : 'erro desconhecido';
      await admin
        .from('lembrete_mensagens')
        .update({ status: 'falha', erro: `Erro interno: ${motivo}`.slice(0, 500), processando_desde: null })
        .eq('id', mensagem.id);
      await registrarEvento(admin, 'erro_sistema', `Erro ao processar a mensagem: ${motivo}`, mensagem.id);
    }
  }
  return mensagens.length;
}

// ---------------------------------------------------------------------------
// Prévia (painel)
// ---------------------------------------------------------------------------

interface PedidoPrevia {
  configuracao_id?: number;
  exemplos?: string[];
  instrucoes_ia?: string | null;
  modelo_ia?: string;
  usar_ia?: boolean;
  quantidade?: number;
  dados?: Partial<DadosLembrete>;
}

function textoCurto(valor: unknown, limite: number) {
  return typeof valor === 'string' ? valor.slice(0, limite) : undefined;
}

async function gerarPrevia(admin: SupabaseClient, pedido: PedidoPrevia) {
  let regra: Regra | null = null;
  if (typeof pedido.configuracao_id === 'number') {
    const { data } = await admin
      .from('lembrete_configuracoes')
      .select('id, exemplos, usar_ia, modelo_ia, instrucoes_ia')
      .eq('id', pedido.configuracao_id)
      .maybeSingle();
    regra = (data as Regra | null) ?? null;
  }

  const exemplos = Array.isArray(pedido.exemplos)
    ? pedido.exemplos.slice(0, 10).map((exemplo) => String(exemplo).slice(0, 2000))
    : regra?.exemplos ?? [];
  const configuracao = {
    exemplos,
    usar_ia: typeof pedido.usar_ia === 'boolean' ? pedido.usar_ia : regra?.usar_ia ?? true,
    modelo_ia: textoCurto(pedido.modelo_ia, 60) ?? regra?.modelo_ia ?? 'gpt-4.1-mini',
    instrucoes_ia:
      pedido.instrucoes_ia === undefined ? regra?.instrucoes_ia ?? null : textoCurto(pedido.instrucoes_ia, 1000) ?? null,
  };

  const { data: ajustes } = await admin
    .from('lembrete_ajustes')
    .select('nome_clinica')
    .eq('id', 1)
    .maybeSingle();

  const base = pedido.dados ?? {};
  const dados: DadosLembrete = {
    nomeTutor: textoCurto(base.nomeTutor, 80) || DADOS_EXEMPLO.nomeTutor,
    pets: Array.isArray(base.pets) && base.pets.length ? base.pets.slice(0, 5).map(String) : DADOS_EXEMPLO.pets,
    servicos:
      Array.isArray(base.servicos) && base.servicos.length
        ? base.servicos.slice(0, 5).map(String)
        : DADOS_EXEMPLO.servicos,
    dataAgendada: /^\d{4}-\d{2}-\d{2}$/.test(String(base.dataAgendada)) ? String(base.dataAgendada) : DADOS_EXEMPLO.dataAgendada,
    diaEnvio: /^\d{4}-\d{2}-\d{2}$/.test(String(base.diaEnvio)) ? String(base.diaEnvio) : DADOS_EXEMPLO.diaEnvio,
    horario: base.horario === null ? null : textoCurto(base.horario, 8) ?? DADOS_EXEMPLO.horario,
    clinica: (ajustes as { nome_clinica?: string } | null)?.nome_clinica ?? DADOS_EXEMPLO.clinica,
  };

  const quantidade = Math.min(Math.max(Number(pedido.quantidade) || 1, 1), 3);
  const resultados = await Promise.all(
    Array.from({ length: quantidade }, () => gerarTexto(dados, configuracao))
  );
  return resultados.map((resultado) => ({
    texto: resultado.texto,
    origem: resultado.origem,
    exemplo_indice: resultado.exemploIndice,
    aviso: resultado.motivoReserva ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Servidor
// ---------------------------------------------------------------------------

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[lembretes] credenciais internas do Supabase ausentes');
    return json({ error: 'Serviço indisponível' }, 500);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const chamador = await autenticar(request, admin);
  if (!chamador) return json({ error: 'Não autorizado' }, 401);

  let corpo: Record<string, unknown>;
  try {
    const bruto = await request.text();
    corpo = bruto ? JSON.parse(bruto) : {};
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  const acao = corpo.acao ?? 'processar';

  if (acao === 'processar') {
    const tarefa = processarFila(admin).catch(async (error) => {
      const motivo = error instanceof Error ? error.message : 'erro desconhecido';
      console.error('[lembretes] erro no processamento da fila');
      await registrarEvento(admin, 'erro_sistema', `Erro no processamento da fila: ${motivo}`);
    });
    if (typeof EdgeRuntime !== 'undefined') {
      EdgeRuntime.waitUntil(tarefa);
    } else {
      await tarefa;
    }
    return json({ aceito: true }, 202);
  }

  if (chamador.tipo !== 'usuario') return json({ error: 'Ação permitida só pelo painel' }, 403);

  if (acao === 'previa') {
    try {
      return json({ mensagens: await gerarPrevia(admin, corpo as PedidoPrevia) });
    } catch (error) {
      console.error('[lembretes] erro na prévia');
      return json({ error: error instanceof Error ? error.message : 'Erro na prévia' }, 500);
    }
  }

  if (acao === 'diagnostico') {
    return json({
      openai: !!(await obterOpenAiKey()),
      uazapi: !!(segredo('UAZAPI_SERVER_URL') && segredo('UAZAPI_INSTANCE_TOKEN')),
      cron_secret: !!segredo('LEMBRETES_CRON_SECRET'),
    });
  }

  return json({ error: 'Ação desconhecida' }, 400);
});
