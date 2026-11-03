// Agenda da empresa: horários, agendamento, remarcação e cancelamento sobre o Google Calendar.
// Toda regra (jornada, almoço, feriados, duração, limites de busca, modelos de evento, tag...)
// vem do banco e é editada no painel. Marcador de deploy: AGENDA_EDGE_V2_MOTOR_CONFIGURAVEL

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { segredo } from '../_shared/segredos.ts';
import {
  instrucaoApresentacao, montarCatalogo, operacoesDe, parametrosEfetivos, resolverRegra, resolverTipo,
  type RegraAgenda, type TipoAgenda,
} from '../_shared/agenda_catalogo.ts';
import {
  buscarHorarios, escolherSlot, eventosOcupados, mensagemHorarios, slotsDoDia,
  type AgendaMotor, type EventoOcupado, type FeriadoMotor, type IntervaloMotor, type JanelaMotor, type SlotMotor,
} from '../_shared/agenda_motor.ts';
import {
  emailValido, interpretarDataHora, MENSAGENS_AGENDA, montarEvento, nomesDePets, type DadosCliente,
} from '../_shared/agenda_agendamento.ts';
import { dataKeyDoInstante, fusoValido, isoLocal, isoLocalDoInstante, somarDias } from '../_shared/fuso.ts';

type Acao = 'listar' | 'criar' | 'editar' | 'excluir' | 'disponibilidade' | 'testar' | 'cliente';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
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
  const aa = new Uint8Array(a);
  const bb = new Uint8Array(b);
  let diff = aa.length ^ bb.length;
  for (let index = 0; index < Math.max(aa.length, bb.length); index++) {
    diff |= (aa[index] ?? 0) ^ (bb[index] ?? 0);
  }
  return diff === 0;
}

async function exigirGestor(request: Request, admin: SupabaseClient) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: perfil } = await admin
    .from('profiles')
    .select('papel, ativo')
    .eq('id', data.user.id)
    .maybeSingle();
  if (!perfil?.ativo || !['admin', 'lider'].includes(perfil.papel)) return null;
  return data.user;
}

// ---------------------------------------------------------------------------
// Google Calendar
// ---------------------------------------------------------------------------

let cacheToken: { valor: string; ate: number } | null = null;

async function accessTokenGoogle() {
  const direto = segredo('GOOGLE_CALENDAR_ACCESS_TOKEN');
  if (direto) return direto;
  if (cacheToken && cacheToken.ate > Date.now()) return cacheToken.valor;

  const refreshToken = segredo('GOOGLE_CALENDAR_REFRESH_TOKEN');
  const clientId = segredo('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = segredo('GOOGLE_OAUTH_CLIENT_SECRET');
  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error('google_calendar_not_configured');
  }

  const form = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error('google_token_refresh_failed');
  const payload = await response.json();
  if (typeof payload.access_token !== 'string' || !payload.access_token) {
    throw new Error('google_token_refresh_invalid');
  }
  const validade = Math.max(60, Number(payload.expires_in) || 3000) - 60;
  cacheToken = { valor: payload.access_token, ate: Date.now() + validade * 1000 };
  return payload.access_token as string;
}

async function googleRequest(path: string, init: RequestInit = {}) {
  const token = await accessTokenGoogle();
  // Falhas transitórias (429/5xx) têm 2 novas tentativas com espera crescente.
  for (let tentativa = 0; ; tentativa++) {
    const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status === 204) return null;
    const text = await response.text();
    if (response.ok) return text ? JSON.parse(text) : null;
    if ([429, 500, 502, 503, 504].includes(response.status) && tentativa < 2) {
      await new Promise((resolve) => setTimeout(resolve, 600 * (tentativa + 1)));
      continue;
    }
    if (response.status === 404 || response.status === 410) throw new Error('calendar_event_not_found');
    throw new Error(response.status === 401 || response.status === 403 ? 'google_calendar_unauthorized' : 'google_calendar_failed');
  }
}

function mapEvento(event: Record<string, unknown>) {
  const start = (event.start as Record<string, string> | undefined)?.dateTime ||
    (event.start as Record<string, string> | undefined)?.date || '';
  const end = (event.end as Record<string, string> | undefined)?.dateTime ||
    (event.end as Record<string, string> | undefined)?.date || '';
  return {
    id: String(event.id || ''),
    summary: String(event.summary || ''),
    start,
    end,
    status: String(event.status || 'confirmed'),
    htmlLink: String(event.htmlLink || ''),
    description: typeof event.description === 'string' ? event.description : undefined,
    attendees: Array.isArray(event.attendees) ? event.attendees : [],
  };
}

function erroHttp(error: unknown) {
  const code = error instanceof Error ? error.message : 'internal_error';
  const status = code.includes('not_configured') || code.includes('secret_missing') ? 503
    : code.includes('unauthorized') ? 502
    : code === 'calendar_event_not_found' ? 404
    : 502;
  return json({ error: code }, status);
}

// ---------------------------------------------------------------------------
// Configuração (tudo vem do banco)
// ---------------------------------------------------------------------------

interface Empresa {
  nomeEmpresa: string;
  fuso: string;
  codigoPais: string;
}

interface Carga {
  empresa: Empresa;
  catalogo: TipoAgenda[];
}

const OPERACAO_POR_ACAO: Record<string, string> = {
  disponibilidade: 'buscar', criar: 'agendar', editar: 'reagendar', excluir: 'cancelar',
};

async function carregarEmpresa(admin: SupabaseClient): Promise<Empresa> {
  const { data } = await admin
    .from('atendimento_config')
    .select('nome_empresa,fuso_horario,codigo_pais')
    .eq('singleton', true)
    .maybeSingle();
  const fuso = fusoValido(data?.fuso_horario) ? String(data?.fuso_horario) : 'America/Sao_Paulo';
  return {
    nomeEmpresa: String(data?.nome_empresa || ''),
    fuso,
    codigoPais: String(data?.codigo_pais || '55'),
  };
}

async function carregarCatalogo(admin: SupabaseClient): Promise<TipoAgenda[]> {
  const [tipos, regras, profissionais, servicos] = await Promise.all([
    admin.from('agenda_especialidades').select('*').eq('ativo', true).order('nome'),
    admin.from('agenda_regras').select('*, calendario:agenda_calendarios(secret_key,ativo)').eq('ativo', true),
    admin.from('agenda_profissionais').select('*').eq('ativo', true),
    admin.from('clinica_servicos').select('tipo_agenda_id,preco,ativo').not('tipo_agenda_id', 'is', null),
  ]);
  if (tipos.error || regras.error || profissionais.error) throw new Error('specialty_not_configured');
  const regrasValidas = (regras.data || []).filter((r: Record<string, unknown>) =>
    (r.calendario as { ativo?: boolean } | null)?.ativo !== false);
  return montarCatalogo(tipos.data || [], regrasValidas, profissionais.data || [], servicos.data || []);
}

async function carregar(admin: SupabaseClient): Promise<Carga> {
  const [empresa, catalogo] = await Promise.all([carregarEmpresa(admin), carregarCatalogo(admin)]);
  return { empresa, catalogo };
}

function tipoOuErro(catalogo: TipoAgenda[], chave: string): TipoAgenda {
  const tipo = resolverTipo(chave, catalogo);
  if (!tipo) throw new Error('specialty_not_configured');
  return tipo;
}

function regrasDoTipo(tipo: TipoAgenda, regraId?: string): RegraAgenda[] {
  const regras = regraId ? tipo.regras.filter((r) => r.id === regraId) : tipo.regras;
  if (!regras.length) throw new Error('calendar_not_configured');
  return regras;
}

// ID do calendário: cadastrado pelo painel (Vault) ou, em instalações antigas,
// o Edge Secret apontado por secret_key.
async function calendarIdDaRegra(admin: SupabaseClient, regra: RegraAgenda): Promise<string | null> {
  if (regra.calendario_id) {
    try {
      const { data } = await admin.rpc('agenda_calendario_id_interno', { p_calendario_id: regra.calendario_id });
      if (typeof data === 'string' && data.trim()) return data.trim();
    } catch {
      // Vault indisponível: tenta o Edge Secret
    }
  }
  return regra.calendario_secret_key ? segredo(regra.calendario_secret_key) ?? null : null;
}

async function eventosDoPeriodo(calendarId: string, desde: string, ate: string) {
  const itens: Array<Record<string, unknown>> = [];
  let pagina: string | undefined;
  for (let i = 0; i < 6; i++) {
    const query = new URLSearchParams({
      timeMin: desde, timeMax: ate, singleEvents: 'true', orderBy: 'startTime', maxResults: '2500',
    });
    if (pagina) query.set('pageToken', pagina);
    const resposta = await googleRequest(`/calendars/${encodeURIComponent(calendarId)}/events?${query}`);
    itens.push(...(Array.isArray(resposta?.items) ? resposta.items : []));
    pagina = resposta?.nextPageToken;
    if (!pagina) break;
  }
  return itens;
}

interface AgendaCarregada {
  motor: AgendaMotor;
  regra: RegraAgenda;
  calendarId: string | null;
}

async function montarAgendas(
  admin: SupabaseClient,
  empresa: Empresa,
  tipo: TipoAgenda,
  regras: RegraAgenda[],
  periodo: { primeira: string; ultima: string },
  opcoes: { consultarGoogle?: boolean; retorno?: boolean; duracaoSolicitada?: unknown } = {},
): Promise<AgendaCarregada[]> {
  const ids = regras.map((r) => r.id);
  const [{ data: janelas, error: ej }, { data: intervalos, error: ei }, { data: feriados, error: ef }] = await Promise.all([
    admin.from('agenda_janelas_semanais').select('regra_id,dia_semana,inicio,fim,ultimo_inicio,recorrencia,ancora_quinzenal').in('regra_id', ids),
    admin.from('agenda_intervalos').select('regra_id,dia_semana,data_especifica,inicio,fim,ativo').in('regra_id', ids).eq('ativo', true),
    admin.from('agenda_feriados').select('data,dia_inteiro,inicio,fim,regra_id').gte('data', periodo.primeira).lte('data', periodo.ultima),
  ]);
  if (ej || ei) throw new Error('calendar_not_configured');
  // A tabela de feriados pode ainda não existir em instalações antigas: segue sem feriados.
  const feriadosValidos = (ef ? [] : feriados || []) as FeriadoMotor[];
  const consultar = opcoes.consultarGoogle !== false;
  const desde = isoLocal(empresa.fuso, periodo.primeira, 0);
  const ate = isoLocal(empresa.fuso, somarDias(periodo.ultima, 1), 0);
  const cacheEventos = new Map<string, Promise<EventoOcupado[]>>();

  return await Promise.all(regras.map(async (regra) => {
    const calendarId = await calendarIdDaRegra(admin, regra);
    let ocupados: EventoOcupado[] = [];
    if (consultar) {
      if (!calendarId) throw new Error('calendar_secret_missing');
      if (!cacheEventos.has(calendarId)) {
        cacheEventos.set(calendarId, eventosDoPeriodo(calendarId, desde, ate).then((itens) => eventosOcupados(itens, empresa.fuso)));
      }
      ocupados = await cacheEventos.get(calendarId)!;
    }
    const parametros = parametrosEfetivos(tipo, regra, { retorno: opcoes.retorno, duracaoSolicitada: opcoes.duracaoSolicitada });
    const motor: AgendaMotor = {
      regraId: regra.id,
      profissionalId: regra.profissional_id,
      profissionalNome: regra.nome_exibicao || regra.profissional_nome || 'Profissional',
      duracao: parametros.duracao,
      passo: parametros.passo,
      antecedenciaMin: parametros.antecedenciaMin,
      capacidade: parametros.capacidade,
      janelas: (janelas || []).filter((j: { regra_id: string }) => j.regra_id === regra.id) as JanelaMotor[],
      intervalos: (intervalos || []).filter((i: { regra_id: string }) => i.regra_id === regra.id) as IntervaloMotor[],
      feriados: feriadosValidos,
      ocupados,
    };
    return { motor, regra, calendarId };
  }));
}

// ---------------------------------------------------------------------------
// Disponibilidade
// ---------------------------------------------------------------------------

interface ContextoCliente {
  sessionId?: string;
  telefone?: string;
  nomeCliente?: string;
  nomePet?: string;
  email?: string;
  observacao?: string;
}

function limparTexto(valor: unknown, limite = 200) {
  return typeof valor === 'string' ? valor.replace(/[\r\n]+/g, ' ').trim().slice(0, limite) : '';
}

function lerContexto(bruto: unknown): ContextoCliente {
  const c = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>;
  return {
    sessionId: limparTexto(c.sessionId, 255),
    telefone: limparTexto(c.telefone, 40),
    nomeCliente: limparTexto(c.nomeCliente, 120),
    nomePet: limparTexto(c.nomePet, 200),
    email: limparTexto(c.email, 254),
    observacao: limparTexto(c.observacao, 400),
  };
}

function slotParaResposta(slot: SlotMotor) {
  return {
    inicio: slot.inicio, fim: slot.fim, date_start: slot.dateStart, date_finish: slot.dateFinish,
    profissional: slot.profissional, regra_id: slot.regraId,
  };
}

async function disponibilidade(admin: SupabaseClient, carga: Carga, body: Record<string, unknown>): Promise<Response> {
  const { empresa } = carga;
  const tipo = tipoOuErro(carga.catalogo, String(body.agendaType || ''));
  const regraId = typeof body.regraId === 'string' && /^[0-9a-f-]{36}$/i.test(body.regraId) ? body.regraId : undefined;
  const regras = regrasDoTipo(tipo, regraId);
  const agoraMs = Date.now();
  const hoje = dataKeyDoInstante(agoraMs, empresa.fuso);

  const pedido = interpretarDataHora(body.dataHora ?? body.data ?? body.start, empresa.fuso);
  if (body.dataHora || body.data || body.start) {
    if (!pedido) return json({ error: 'invalid_date' }, 400);
  }
  const dataReferencia = pedido?.dataKey ?? null;
  const retorno = body.retorno === true;
  const horizonte = tipo.busca_horizonte_dias;
  const primeira = dataReferencia && dataReferencia < hoje ? hoje : (dataReferencia ?? hoje);
  const periodo = {
    primeira: tipo.busca_ordem === 'em_torno_da_data' && dataReferencia ? somarDias(dataReferencia, -horizonte) : primeira,
    ultima: somarDias(dataReferencia ?? hoje, horizonte),
  };
  if (periodo.primeira < hoje) periodo.primeira = hoje;

  const agendas = await montarAgendas(admin, empresa, tipo, regras, periodo, {
    retorno, duracaoSolicitada: body.duracaoMinutos,
  });
  const ctx = { fuso: empresa.fuso, agoraMs };
  const motores = agendas.map((a) => a.motor);
  const opcoes = {
    horizonteDias: horizonte,
    maxDiasComVaga: tipo.busca_max_dias_com_vaga,
    maxHorariosPorDia: tipo.busca_max_horarios_por_dia,
    ordem: tipo.busca_ordem,
  };

  // Data específica: se ela tiver vaga, devolve só ela; senão, as alternativas mais próximas.
  let dias = dataReferencia
    ? buscarHorarios(motores, ctx, { ...opcoes, dataReferencia, horizonteDias: 1, maxDiasComVaga: 1 })
    : [];
  const dataSolicitadaIndisponivel = !!dataReferencia && !dias.length;
  if (!dias.length) dias = buscarHorarios(motores, ctx, { ...opcoes, dataReferencia });

  let horarioSolicitadoDisponivel: boolean | undefined;
  if (pedido?.instanteMs != null) {
    horarioSolicitadoDisponivel = motores.some((m) => slotsDoDia(m, pedido.dataKey, ctx).some((s) => s.inicioMs === pedido.instanteMs));
  }

  // Horário que o próprio cliente já tem agendado (evita dizer "sem vagas" para quem já está marcado).
  const contexto = lerContexto(body.contexto);
  let jaAgendado: Record<string, unknown> | undefined;
  if (contexto.sessionId && pedido?.instanteMs != null) {
    const { data } = await admin.from('agenda_agendamentos').select('inicio,fim,tipo_nome,profissional_nome,pet_nome')
      .eq('session_id', contexto.sessionId).eq('status', 'confirmado')
      .gte('inicio', new Date(pedido.instanteMs - 60_000).toISOString())
      .lte('inicio', new Date(pedido.instanteMs + 60_000).toISOString()).limit(1);
    if (data?.length) jaAgendado = data[0];
  }

  const duracao = motores[0]?.duracao ?? tipo.duracao_padrao_minutos;
  const mostrarProfissional = new Set(motores.map((m) => m.profissionalNome)).size > 1;
  const mensagem = mensagemHorarios({
    servicoNome: tipo.nome, dias, duracaoMinutos: duracao, mostrarProfissional,
    maxDatas: tipo.busca_apresentar_max_datas, maxHorarios: tipo.busca_apresentar_max_horarios,
    dataSolicitada: dataReferencia, dataSolicitadaIndisponivel, horizonteDias: horizonte,
  });
  const slotsPlanos = dias.flatMap((d) => d.horarios.map(slotParaResposta));
  return json({
    ok: true,
    especialidade: tipo.nome,
    servico: { chave: tipo.chave, nome: tipo.nome },
    duracaoMinutos: duracao,
    duracao_minutos: duracao,
    valor_particular: tipo.valor_particular != null ? `R$ ${tipo.valor_particular.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null,
    fuso_horario: empresa.fuso,
    data_solicitada: dataReferencia,
    data_solicitada_indisponivel: dataSolicitadaIndisponivel,
    horario_solicitado_disponivel: horarioSolicitadoDisponivel,
    agendamento_do_cliente: jaAgendado,
    dias: dias.map((d) => ({ data: d.data, dia_semana: d.diaSemana, horarios: d.horarios.map(slotParaResposta) })),
    slots: slotsPlanos.map((s) => ({ start: s.date_start, end: s.date_finish, profissional: s.profissional, regraId: s.regra_id })),
    available: horarioSolicitadoDisponivel,
    mensagem,
    instrucao_apresentacao: instrucaoApresentacao(tipo),
  });
}

// ---------------------------------------------------------------------------
// Agendar / remarcar / cancelar
// ---------------------------------------------------------------------------

async function aplicarTag(admin: SupabaseClient, sessionId: string, tagId: number | null | undefined) {
  if (!tagId || !sessionId) return;
  try {
    const { data: cliente } = await admin.from('dados_cliente').select('id').eq('sessionid', sessionId).limit(1).maybeSingle();
    if (!cliente?.id) return;
    await admin.from('client_tags').upsert({ client_id: cliente.id, tag_id: tagId }, { onConflict: 'client_id,tag_id', ignoreDuplicates: true });
  } catch {
    // A tag é um bônus: nunca derruba um agendamento já criado.
  }
}

async function dadosDoCliente(admin: SupabaseClient, contexto: ContextoCliente): Promise<DadosCliente> {
  let cadastro: Record<string, string | null> = {};
  if (contexto.sessionId) {
    const { data } = await admin.from('dados_cliente').select('nome,email,nome_pet').eq('sessionid', contexto.sessionId).limit(1).maybeSingle();
    cadastro = (data || {}) as Record<string, string | null>;
  }
  return {
    nome: contexto.nomeCliente || cadastro.nome || null,
    nomePet: contexto.nomePet || cadastro.nome_pet || null,
    email: contexto.email || cadastro.email || null,
    telefone: contexto.telefone || contexto.sessionId?.split('@')[0] || null,
    observacao: contexto.observacao || null,
  };
}

function dataFutura(instanteMs: number | null | undefined, agoraMs: number) {
  return instanteMs != null && instanteMs > agoraMs;
}

async function agendamentoDoCliente(
  admin: SupabaseClient,
  sessionId: string,
  alvoMs: number,
  tipoChave?: string,
) {
  let consulta = admin.from('agenda_agendamentos').select('*')
    .eq('session_id', sessionId).eq('status', 'confirmado')
    .gte('inicio', new Date(alvoMs - 30 * 60_000).toISOString())
    .lte('inicio', new Date(alvoMs + 30 * 60_000).toISOString());
  if (tipoChave) consulta = consulta.eq('tipo_chave', tipoChave);
  const { data } = await consulta;
  const linhas = (data || []) as Array<Record<string, unknown>>;
  linhas.sort((a, b) => Math.abs(Date.parse(String(a.inicio)) - alvoMs) - Math.abs(Date.parse(String(b.inicio)) - alvoMs));
  return linhas[0];
}

/** Existe evento no horário em alguma agenda do tipo? (agendamento feito pela equipe, fora do registro) */
async function existeEventoNoHorario(admin: SupabaseClient, empresa: Empresa, regras: RegraAgenda[], alvoMs: number) {
  for (const regra of regras) {
    const calendarId = await calendarIdDaRegra(admin, regra);
    if (!calendarId) continue;
    const itens = await eventosDoPeriodo(
      calendarId,
      new Date(alvoMs - 5 * 60_000).toISOString(),
      new Date(alvoMs + 30 * 60_000).toISOString(),
    );
    if (eventosOcupados(itens, empresa.fuso).length) return true;
  }
  return false;
}

async function criarAgendamento(admin: SupabaseClient, carga: Carga, body: Record<string, unknown>): Promise<Response> {
  const { empresa } = carga;
  const tipo = tipoOuErro(carga.catalogo, String(body.agendaType || ''));
  const regraId = typeof body.regraId === 'string' && /^[0-9a-f-]{36}$/i.test(body.regraId) ? body.regraId : undefined;
  const regras = regrasDoTipo(tipo, regraId);
  const agoraMs = Date.now();
  const inicio = interpretarDataHora(body.inicio, empresa.fuso);
  if (!inicio || inicio.instanteMs == null) return json({ error: 'invalid_date' }, 400);
  if (!dataFutura(inicio.instanteMs, agoraMs)) return json({ ok: false, motivo: 'data_passada', mensagem: MENSAGENS_AGENDA.dataPassada });

  const contexto = lerContexto(body.contexto);
  const cliente = await dadosDoCliente(admin, contexto);
  const retorno = body.retorno === true;
  const agendas = await montarAgendas(admin, empresa, tipo, regras, { primeira: inicio.dataKey, ultima: inicio.dataKey }, {
    retorno, duracaoSolicitada: body.duracaoMinutos,
  });
  const motores = agendas.map((a) => a.motor);
  const slot = escolherSlot(motores, { fuso: empresa.fuso, agoraMs }, inicio.instanteMs, regraId ? regraId : undefined);
  if (!slot) {
    const alternativas = buscarHorarios(motores, { fuso: empresa.fuso, agoraMs }, {
      dataReferencia: inicio.dataKey, horizonteDias: tipo.busca_horizonte_dias,
      maxDiasComVaga: tipo.busca_apresentar_max_datas, maxHorariosPorDia: tipo.busca_apresentar_max_horarios, ordem: tipo.busca_ordem,
    });
    return json({
      ok: false, motivo: 'horario_indisponivel', mensagem: MENSAGENS_AGENDA.horarioIndisponivel,
      alternativas: alternativas.map((d) => ({ data: d.data, dia_semana: d.diaSemana, horarios: d.horarios.map(slotParaResposta) })),
    });
  }

  const alvo = agendas.find((a) => a.motor.regraId === slot.regraId)!;
  if (!alvo.calendarId) throw new Error('calendar_secret_missing');
  const parametros = parametrosEfetivos(tipo, alvo.regra, { retorno, duracaoSolicitada: body.duracaoMinutos });

  const pets = nomesDePets(cliente.nomePet);
  if (pets.length > parametros.maxPets) {
    return json({
      ok: false, motivo: 'pets_demais',
      mensagem: `Este serviço aceita até ${parametros.maxPets} pet(s) por agendamento. Faça agendamentos separados para os demais.`,
    });
  }
  const evento = montarEvento({
    tipo, parametros, profissional: slot.profissional, inicioMs: slot.inicioMs, fuso: empresa.fuso, cliente,
    nomeEmpresa: empresa.nomeEmpresa, codigoPais: empresa.codigoPais,
    emailProfissional: alvo.regra.convidar_profissional ? alvo.regra.profissional_email : null,
  });
  const comConvite = evento.attendees.length > 0;
  const criado = await googleRequest(
    `/calendars/${encodeURIComponent(alvo.calendarId)}/events${comConvite ? '?sendUpdates=all' : ''}`,
    {
      method: 'POST',
      body: JSON.stringify({
        summary: evento.summary,
        description: evento.description || undefined,
        location: evento.location || undefined,
        start: { dateTime: slot.dateStart, timeZone: empresa.fuso },
        end: { dateTime: slot.dateFinish, timeZone: empresa.fuso },
        attendees: comConvite ? evento.attendees.map((email) => ({ email })) : undefined,
        extendedProperties: { private: { origem: 'assistente' } },
      }),
    },
  );
  const eventoCriado = mapEvento(criado || {});

  const { data: registro, error: registroErro } = await admin.from('agenda_agendamentos').insert({
    session_id: contexto.sessionId || cliente.telefone || 'desconhecido',
    telefone: (cliente.telefone || '').replace(/\D/g, '') || null,
    regra_id: slot.regraId,
    tipo_chave: tipo.chave,
    tipo_nome: tipo.nome,
    profissional_id: slot.profissionalId,
    profissional_nome: slot.profissional,
    calendario_id: alvo.regra.calendario_id ?? null,
    google_event_id: eventoCriado.id,
    inicio: new Date(slot.inicioMs).toISOString(),
    fim: new Date(slot.fimMs).toISOString(),
    tutor_nome: cliente.nome ?? null,
    pet_nome: cliente.nomePet ?? null,
    email: cliente.email ?? null,
    titulo: evento.summary,
  }).select('id').maybeSingle();
  if (registroErro) console.error('agenda_registro_falhou', registroErro.code);

  if (contexto.sessionId) await aplicarTag(admin, contexto.sessionId, tipo.tag_id);
  return json({
    ok: true,
    mensagem: MENSAGENS_AGENDA.criado,
    agendamento: {
      id: registro?.id ?? null,
      servico: tipo.nome,
      profissional: slot.profissional,
      regra_id: slot.regraId,
      date_start: slot.dateStart,
      date_finish: slot.dateFinish,
      data: slot.data,
      inicio: slot.inicio,
      fim: slot.fim,
      pet: cliente.nomePet ?? null,
      email: cliente.email ?? null,
      convite_enviado_para: evento.attendees,
    },
    event: eventoCriado,
    profissional: { id: slot.profissionalId, nome: slot.profissional },
    regraId: slot.regraId,
  });
}

type Localizado = { erro: Response; linha?: undefined } | { erro?: undefined; linha: Record<string, unknown> };

async function localizarAgendamento(
  admin: SupabaseClient,
  carga: Carga,
  tipo: TipoAgenda,
  contexto: ContextoCliente,
  dataAntigaBruta: unknown,
): Promise<Localizado> {
  const { empresa } = carga;
  const antiga = interpretarDataHora(dataAntigaBruta, empresa.fuso);
  if (!antiga || antiga.instanteMs == null) return { erro: json({ error: 'invalid_date' }, 400) };
  if (!contexto.sessionId) return { erro: json({ error: 'missing_session' }, 400) };
  const linha = await agendamentoDoCliente(admin, contexto.sessionId, antiga.instanteMs, tipo.chave);
  if (linha) return { linha };
  // Não está no registro do assistente: se existe evento nesse horário, foi a equipe que criou.
  const feitoPelaEquipe = await existeEventoNoHorario(admin, empresa, tipo.regras, antiga.instanteMs);
  const mensagem = tipo.mensagem_agendamento_equipe?.trim() || 'Este agendamento foi feito pela equipe. Vou encaminhar para a recepção realizar a alteração.';
  return {
    erro: json(feitoPelaEquipe
      ? { ok: false, motivo: 'agendamento_da_equipe', encaminhar_para_humano: true, mensagem }
      : { ok: false, motivo: 'nao_encontrado', mensagem: MENSAGENS_AGENDA.naoEncontrado }),
  };
}

async function remarcarAgendamento(admin: SupabaseClient, carga: Carga, body: Record<string, unknown>): Promise<Response> {
  const { empresa } = carga;
  const tipo = tipoOuErro(carga.catalogo, String(body.agendaType || ''));
  const contexto = lerContexto(body.contexto);
  const achado = await localizarAgendamento(admin, carga, tipo, contexto, body.dataAntiga);
  if (achado.erro) return achado.erro;
  const linha = achado.linha;

  const agoraMs = Date.now();
  const novo = interpretarDataHora(body.inicio, empresa.fuso);
  if (!novo || novo.instanteMs == null) return json({ error: 'invalid_date' }, 400);
  if (!dataFutura(novo.instanteMs, agoraMs)) return json({ ok: false, motivo: 'data_passada', mensagem: MENSAGENS_AGENDA.dataPassada });

  // A remarcação fica na mesma agenda (mesmo profissional/calendário) do agendamento original.
  if (!linha.regra_id) {
    return json({
      ok: false, motivo: 'agenda_removida', encaminhar_para_humano: true,
      mensagem: 'A agenda deste agendamento não existe mais. Encaminhe o cliente para a recepção.',
    });
  }
  const regras = regrasDoTipo(tipo, String(linha.regra_id));
  const retorno = body.retorno === true;
  const agendas = await montarAgendas(admin, empresa, tipo, regras, { primeira: novo.dataKey, ultima: novo.dataKey }, {
    retorno, duracaoSolicitada: body.duracaoMinutos ?? Math.round((Date.parse(String(linha.fim)) - Date.parse(String(linha.inicio))) / 60_000),
  });
  const ctx = { fuso: empresa.fuso, agoraMs, ignorarEventoId: String(linha.google_event_id) };
  const slot = escolherSlot(agendas.map((a) => a.motor), ctx, novo.instanteMs);
  if (!slot) {
    const alternativas = buscarHorarios(agendas.map((a) => a.motor), ctx, {
      dataReferencia: novo.dataKey, horizonteDias: tipo.busca_horizonte_dias,
      maxDiasComVaga: tipo.busca_apresentar_max_datas, maxHorariosPorDia: tipo.busca_apresentar_max_horarios, ordem: tipo.busca_ordem,
    });
    return json({
      ok: false, motivo: 'horario_indisponivel', mensagem: MENSAGENS_AGENDA.novoHorarioIndisponivel,
      alternativas: alternativas.map((d) => ({ data: d.data, dia_semana: d.diaSemana, horarios: d.horarios.map(slotParaResposta) })),
    });
  }
  const alvo = agendas[0];
  if (!alvo.calendarId) throw new Error('calendar_secret_missing');
  const atualizado = await googleRequest(
    `/calendars/${encodeURIComponent(alvo.calendarId)}/events/${encodeURIComponent(String(linha.google_event_id))}?sendUpdates=all`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        start: { dateTime: slot.dateStart, timeZone: empresa.fuso },
        end: { dateTime: slot.dateFinish, timeZone: empresa.fuso },
      }),
    },
  );
  await admin.from('agenda_agendamentos').update({
    inicio: new Date(slot.inicioMs).toISOString(), fim: new Date(slot.fimMs).toISOString(), atualizado_em: new Date().toISOString(),
  }).eq('id', linha.id);
  return json({
    ok: true,
    mensagem: MENSAGENS_AGENDA.remarcado,
    agendamento: {
      id: linha.id, servico: tipo.nome, profissional: slot.profissional, regra_id: slot.regraId,
      date_start: slot.dateStart, date_finish: slot.dateFinish, data: slot.data, inicio: slot.inicio, fim: slot.fim,
    },
    event: mapEvento(atualizado || {}),
    profissional: { id: slot.profissionalId, nome: slot.profissional },
    regraId: slot.regraId,
  });
}

async function cancelarAgendamento(admin: SupabaseClient, carga: Carga, body: Record<string, unknown>): Promise<Response> {
  const tipo = tipoOuErro(carga.catalogo, String(body.agendaType || ''));
  const contexto = lerContexto(body.contexto);
  const achado = await localizarAgendamento(admin, carga, tipo, contexto, body.dataAntiga);
  if (achado.erro) return achado.erro;
  const linha = achado.linha;
  const regra = tipo.regras.find((r) => r.id === linha.regra_id) ?? tipo.regras[0];
  const calendarId = await calendarIdDaRegra(admin, regra);
  if (!calendarId) throw new Error('calendar_secret_missing');
  try {
    await googleRequest(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(String(linha.google_event_id))}?sendUpdates=all`,
      { method: 'DELETE' },
    );
  } catch (error) {
    // Evento já removido no Google: o cancelamento ainda precisa ficar registrado.
    if (!(error instanceof Error) || error.message !== 'calendar_event_not_found') throw error;
  }
  await admin.from('agenda_agendamentos').update({
    status: 'cancelado', cancelado_em: new Date().toISOString(), atualizado_em: new Date().toISOString(),
  }).eq('id', linha.id);
  return json({
    ok: true,
    mensagem: MENSAGENS_AGENDA.cancelado,
    agendamento: { id: linha.id, servico: tipo.nome, profissional: linha.profissional_nome, date_start: linha.inicio },
    profissional: { id: linha.profissional_id, nome: linha.profissional_nome },
    regraId: linha.regra_id,
  });
}

async function listarDoCliente(admin: SupabaseClient, carga: Carga, body: Record<string, unknown>): Promise<Response> {
  const contexto = lerContexto(body.contexto);
  if (!contexto.sessionId) return json({ error: 'missing_session' }, 400);
  const { data } = await admin.from('agenda_agendamentos')
    .select('tipo_chave,tipo_nome,profissional_nome,pet_nome,inicio,fim')
    .eq('session_id', contexto.sessionId).eq('status', 'confirmado')
    .gte('inicio', new Date().toISOString()).order('inicio').limit(20);
  const agendamentos = (data || []).map((linha: Record<string, string>) => ({
    servico: linha.tipo_nome, servico_chave: linha.tipo_chave, profissional: linha.profissional_nome, pet: linha.pet_nome,
    date_start: isoLocalDoInstante(Date.parse(linha.inicio), carga.empresa.fuso),
  }));
  return json({
    ok: true,
    agendamentos,
    mensagem: agendamentos.length ? undefined : MENSAGENS_AGENDA.clienteSemAgendamentos,
  });
}

// ---------------------------------------------------------------------------
// Fluxo da equipe (painel): eventos "crus" do calendário
// ---------------------------------------------------------------------------

function intervaloValido(inicio?: string, fim?: string) {
  if (!inicio || !fim) return false;
  const start = new Date(inicio);
  const end = new Date(fim);
  return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end > start;
}

interface EventoInput {
  id?: string;
  summary?: string;
  description?: string;
  email?: string;
  start?: string;
  end?: string;
}

async function calendarioDaOperacao(admin: SupabaseClient, tipo: TipoAgenda, regraId?: string, eventoId?: string) {
  const regras = regrasDoTipo(tipo, regraId);
  if (regras.length === 1 || !eventoId) {
    if (regras.length > 1) throw new Error('professional_required');
    const calendarId = await calendarIdDaRegra(admin, regras[0]);
    if (!calendarId) throw new Error('calendar_secret_missing');
    return { calendarId, regra: regras[0] };
  }
  for (const regra of regras) {
    const calendarId = await calendarIdDaRegra(admin, regra);
    if (!calendarId) continue;
    try {
      await googleRequest(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventoId)}`);
      return { calendarId, regra };
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'calendar_event_not_found') throw error;
    }
  }
  throw new Error('calendar_event_not_found');
}

async function operacaoDaEquipe(admin: SupabaseClient, carga: Carga, acao: Acao, body: Record<string, unknown>): Promise<Response> {
  const { empresa } = carga;
  const tipo = tipoOuErro(carga.catalogo, String(body.agendaType || 'consultaveterinaria'));
  const regraId = typeof body.regraId === 'string' && /^[0-9a-f-]{36}$/i.test(body.regraId) ? body.regraId : undefined;
  const event = (body.event || {}) as EventoInput;

  if (acao === 'listar') {
    const start = String(body.start || new Date().toISOString());
    const end = String(body.end || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
    if (!intervaloValido(start, end)) return json({ error: 'invalid_interval' }, 400);
    const query = new URLSearchParams({ timeMin: start, timeMax: end, singleEvents: 'true', orderBy: 'startTime' });
    // Vários profissionais no mesmo tipo: a listagem reúne os calendários de todas as agendas ativas.
    const events: Array<ReturnType<typeof mapEvento> & { profissional?: string | null }> = [];
    const vistos = new Set<string>();
    let algumCalendario = false;
    for (const regra of regrasDoTipo(tipo, regraId)) {
      const calendarId = await calendarIdDaRegra(admin, regra);
      if (!calendarId) continue;
      algumCalendario = true;
      const data = await googleRequest(`/calendars/${encodeURIComponent(calendarId)}/events?${query}`);
      for (const item of Array.isArray(data?.items) ? data.items : []) {
        const evento = mapEvento(item);
        if (vistos.has(`${calendarId}:${evento.id}`)) continue;
        vistos.add(`${calendarId}:${evento.id}`);
        events.push({ ...evento, profissional: regra.profissional_nome ?? null });
      }
    }
    if (!algumCalendario) throw new Error('calendar_secret_missing');
    events.sort((a, b) => a.start.localeCompare(b.start));
    return json({ events });
  }

  if (acao === 'criar' && (!event.summary || !intervaloValido(event.start, event.end))) {
    return json({ error: 'invalid_event' }, 400);
  }
  if ((acao === 'editar' || acao === 'excluir') && !event.id) return json({ error: 'missing_event_id' }, 400);

  let calendarId = '';
  let regraUsada: { id: string; profissional_id: string; profissional_nome: string } | undefined;
  let existente: Record<string, unknown> | null = null;

  if (acao === 'criar' || acao === 'editar') {
    if (acao === 'editar') {
      ({ calendarId } = await calendarioDaOperacao(admin, tipo, regraId, event.id));
      existente = await googleRequest(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id || '')}`);
      if (!existente) return json({ error: 'calendar_event_not_found' }, 404);
      event.summary = event.summary || String(existente.summary || 'Consulta');
      event.description = event.description ?? (typeof existente.description === 'string' ? existente.description : undefined);
      if (!intervaloValido(event.start, event.end)) return json({ error: 'invalid_event' }, 400);
    }
    const inicio = interpretarDataHora(event.start, empresa.fuso);
    const fim = interpretarDataHora(event.end, empresa.fuso);
    if (!inicio?.instanteMs || !fim?.instanteMs) return json({ error: 'invalid_event' }, 400);
    const duracao = Math.round((fim.instanteMs - inicio.instanteMs) / 60_000);
    // O horário escolhido define QUAL agenda atende: com vários profissionais no mesmo tipo,
    // o evento vai para o calendário do profissional cujo horário está livre.
    const agendas = await montarAgendas(admin, empresa, tipo, regrasDoTipo(tipo, regraId), { primeira: inicio.dataKey, ultima: inicio.dataKey }, {
      duracaoSolicitada: duracao,
    });
    const ctx = { fuso: empresa.fuso, agoraMs: 0, ignorarEventoId: acao === 'editar' ? event.id : undefined };
    const slot = escolherSlot(agendas.map((a) => a.motor), ctx, inicio.instanteMs);
    if (!slot) return json({ error: 'calendar_slot_unavailable' }, 409);
    const alvo = agendas.find((a) => a.motor.regraId === slot.regraId)!;
    if (acao === 'criar') {
      if (!alvo.calendarId) return json({ error: 'calendar_secret_missing' }, 503);
      calendarId = alvo.calendarId;
    }
    regraUsada = { id: slot.regraId, profissional_id: slot.profissionalId ?? '', profissional_nome: slot.profissional };
  } else {
    const resolvido = await calendarioDaOperacao(admin, tipo, regraId, event.id);
    calendarId = resolvido.calendarId;
    regraUsada = { id: resolvido.regra.id, profissional_id: resolvido.regra.profissional_id, profissional_nome: resolvido.regra.profissional_nome };
  }

  const corpo = acao === 'excluir' ? undefined : JSON.stringify({
    summary: event.summary,
    description: event.description || undefined,
    start: { dateTime: event.start, timeZone: empresa.fuso },
    end: { dateTime: event.end, timeZone: empresa.fuso },
    attendees: event.email
      ? [{ email: event.email }]
      : Array.isArray(existente?.attendees) ? existente.attendees : undefined,
  });
  const caminho = `/calendars/${encodeURIComponent(calendarId)}/events${event.id ? `/${encodeURIComponent(event.id)}` : ''}`;
  const metodo = acao === 'criar' ? 'POST' : acao === 'editar' ? 'PUT' : 'DELETE';
  const data = await googleRequest(caminho, { method: metodo, body: corpo });
  if (acao === 'excluir' && event.id) {
    await admin.from('agenda_agendamentos').update({ status: 'cancelado', cancelado_em: new Date().toISOString() }).eq('google_event_id', event.id);
  }
  return json({
    ok: true,
    event: data ? mapEvento(data) : null,
    profissional: regraUsada ? { id: regraUsada.profissional_id, nome: regraUsada.profissional_nome } : null,
    regraId: regraUsada?.id ?? null,
  });
}

// ---------------------------------------------------------------------------
// Teste de uma agenda ANTES de ativá-la: usa só as regras do banco (funciona com a
// agenda inativa e sem tocar no Google) e informa se o calendário está acessível.
// ---------------------------------------------------------------------------

async function testarRegra(admin: SupabaseClient, regraId: string, diasSolicitados: number) {
  const empresa = await carregarEmpresa(admin);
  const [{ data: linha }, { data: prof }] = await Promise.all([
    admin.from('agenda_regras')
      .select('*, calendario:agenda_calendarios(secret_key), tipo:agenda_especialidades(*)')
      .eq('id', regraId).maybeSingle(),
    admin.from('agenda_profissionais').select('*'),
  ]);
  if (!linha) throw new Error('specialty_not_configured');
  const tipoLinha = linha.tipo as Record<string, unknown>;
  const [tipo] = montarCatalogo([tipoLinha], [linha], prof || []);
  if (!tipo) throw new Error('specialty_not_configured');
  const regra = tipo.regras[0];
  const dias = Math.max(1, Math.min(diasSolicitados, 14));
  const hoje = dataKeyDoInstante(Date.now(), empresa.fuso);
  const ultima = somarDias(hoje, dias - 1);
  const [agenda] = await montarAgendas(admin, empresa, tipo, [regra], { primeira: hoje, ultima }, { consultarGoogle: false });

  const calendarId = agenda.calendarId;
  let calendarioAcessivel: boolean | null = null;
  if (calendarId) {
    try {
      await googleRequest(`/calendars/${encodeURIComponent(calendarId)}/events?maxResults=1`);
      calendarioAcessivel = true;
    } catch {
      calendarioAcessivel = false;
    }
  }

  const ctx = { fuso: empresa.fuso, agoraMs: Date.now() };
  const lista: Array<{ data: string; horarios: string[] }> = [];
  for (let i = 0; i < dias; i++) {
    const data = somarDias(hoje, i);
    const horarios = slotsDoDia(agenda.motor, data, ctx).map((s) => s.inicio);
    if (horarios.length) lista.push({ data, horarios });
  }
  return {
    ok: true,
    ativa: linha.ativo as boolean,
    profissional: agenda.motor.profissionalNome,
    servico: tipo.nome,
    duracaoMinutos: agenda.motor.duracao,
    passoMinutos: agenda.motor.passo,
    antecedenciaMinutos: agenda.motor.antecedenciaMin,
    capacidadeSimultanea: agenda.motor.capacidade,
    fusoHorario: empresa.fuso,
    calendarioConfigurado: !!calendarId,
    calendarioAcessivel,
    dias: lista,
  };
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRole) return json({ error: 'service_unavailable' }, 500);
  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

  const interno = await segredoConfere(
    request.headers.get('x-internal-secret'),
    segredo('ATENDIMENTO_INTERNAL_SECRET'),
  );
  if (!interno && !(await exigirGestor(request, admin))) return json({ error: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const acao = body.acao as Acao;
  if (!['listar', 'criar', 'editar', 'excluir', 'disponibilidade', 'testar', 'cliente'].includes(acao || '')) {
    return json({ error: 'invalid_action' }, 400);
  }

  try {
    if (acao === 'testar') {
      const regraId = typeof body.regraId === 'string' && /^[0-9a-f-]{36}$/i.test(body.regraId) ? body.regraId : '';
      if (!regraId) return json({ error: 'missing_rule' }, 400);
      return json(await testarRegra(admin, regraId, Number(body.dias) || 7));
    }

    const carga = await carregar(admin);
    if (acao === 'cliente') {
      if (!interno) return json({ error: 'unauthorized' }, 401);
      return await listarDoCliente(admin, carga, body);
    }

    // Operações permitidas (por tipo e, se houver, por agenda) valem para o assistente;
    // a equipe, autenticada no painel, não é limitada por elas.
    if (interno && OPERACAO_POR_ACAO[acao]) {
      const tipo = tipoOuErro(carga.catalogo, String(body.agendaType || ''));
      const regraId = typeof body.regraId === 'string' ? body.regraId : undefined;
      const regras = regraId ? tipo.regras.filter((r) => r.id === regraId) : tipo.regras;
      // Sem agenda escolhida, basta que alguma agenda do tipo permita a operação.
      const permitida = regras.some((r) => operacoesDe(tipo, r).includes(OPERACAO_POR_ACAO[acao]));
      if (!permitida) return json({ error: 'operation_not_allowed' }, 403);
    }

    const semantico = interno && typeof body.contexto === 'object' && body.contexto !== null;
    if (acao === 'disponibilidade') return await disponibilidade(admin, carga, body);
    if (semantico && acao === 'criar') return await criarAgendamento(admin, carga, body);
    if (semantico && acao === 'editar') return await remarcarAgendamento(admin, carga, body);
    if (semantico && acao === 'excluir') return await cancelarAgendamento(admin, carga, body);
    return await operacaoDaEquipe(admin, carga, acao, body);
  } catch (error) {
    console.error('agenda_error', error instanceof Error ? error.message : 'unknown');
    return erroHttp(error);
  }
});
