// Backend falso para testar as Edge Functions de verdade (Deno): PostgREST em memória + Google Calendar
// em memória + OpenAI roteirizada. Roda o código real das funções; só a rede é simulada.
//   npx deno@2 test -A supabase/tests/clinica/agenda_edge.deno.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Linha = Record<string, any>;

export interface EventoGoogle {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: Array<{ email: string }>;
  extendedProperties?: any;
  status?: string;
}

export interface Backend {
  tabelas: Record<string, Linha[]>;
  calendarios: Record<string, EventoGoogle[]>;
  chamadasGoogle: Array<{ metodo: string; caminho: string; corpo?: any }>;
  chamadasRest: Array<{ metodo: string; tabela: string; url: string; corpo?: any }>;
  respostasOpenAi: Array<(corpo: any) => any>;
  /** RPCs do Postgres simuladas por teste: nome -> função(argumentos) -> resultado. */
  rpcs: Record<string, (args: any) => any>;
  rpcChamadas: Array<{ nome: string; args: any }>;
  requisicoesOpenAi: any[];
  handlers: Record<string, (request: Request) => Promise<Response>>;
}

const BASE = 'http://fake.supabase.local';
let contador = 0;

/** Valores padrão que o banco aplicaria nas colunas omitidas. */
const PADROES: Record<string, Linha> = {
  agenda_agendamentos: { status: 'confirmado', origem: 'assistente' },
};

function valorDe(linha: Linha, coluna: string) {
  return coluna.includes('->>') ? coluna.split('->>').reduce((acc: any, parte) => acc?.[parte], linha) : linha[coluna];
}

function compara(valor: any, operador: string, argumento: string): boolean {
  const texto = valor === null || valor === undefined ? null : String(valor);
  switch (operador) {
    case 'eq': return texto === argumento.replace(/^"|"$/g, '');
    case 'neq': return texto !== argumento;
    case 'gte': return texto !== null && (Date.parse(texto) >= Date.parse(argumento) || (Number.isNaN(Date.parse(texto)) && texto >= argumento));
    case 'lte': return texto !== null && (Date.parse(texto) <= Date.parse(argumento) || (Number.isNaN(Date.parse(texto)) && texto <= argumento));
    case 'gt': return texto !== null && texto > argumento;
    case 'lt': return texto !== null && texto < argumento;
    case 'in': return argumento.replace(/^\(|\)$/g, '').split(',').map((v) => v.replace(/^"|"$/g, '')).includes(texto ?? '');
    case 'is': return argumento === 'null' ? texto === null : String(valor) === argumento;
    default: throw new Error(`operador não suportado no fake: ${operador}`);
  }
}

function dividirOr(texto: string): string[] {
  const partes: string[] = [];
  let atual = '';
  let aspas = false;
  for (const c of texto) {
    if (c === '"') aspas = !aspas;
    if (c === ',' && !aspas) { partes.push(atual); atual = ''; } else atual += c;
  }
  if (atual) partes.push(atual);
  return partes;
}

function filtrar(linhas: Linha[], params: URLSearchParams): Linha[] {
  let resultado = linhas;
  for (const [chave, bruto] of params.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(chave)) continue;
    if (chave === 'or') {
      const condicoes = dividirOr(bruto.replace(/^\(|\)$/g, ''));
      resultado = resultado.filter((l) => condicoes.some((c) => {
        const [coluna, operador, ...resto] = c.split('.');
        return compara(valorDe(l, coluna), operador, resto.join('.'));
      }));
      continue;
    }
    let operador: string;
    let argumento: string;
    let negar = false;
    const m = bruto.match(/^(not\.)?([a-z]+)\.(.*)$/s);
    if (!m) throw new Error(`filtro não suportado no fake: ${chave}=${bruto}`);
    negar = !!m[1]; operador = m[2]; argumento = m[3];
    resultado = resultado.filter((l) => compara(valorDe(l, chave), operador, argumento) !== negar);
  }
  const ordem = params.get('order');
  if (ordem) {
    for (const campo of ordem.split(',').reverse()) {
      const [coluna, direcao] = campo.split('.');
      resultado = [...resultado].sort((a, b) => {
        const x = a[coluna]; const y = b[coluna];
        const c = x === y ? 0 : x === null || x === undefined ? 1 : y === null || y === undefined ? -1 : x < y ? -1 : 1;
        return direcao === 'desc' ? -c : c;
      });
    }
  }
  const limite = params.get('limit');
  return limite ? resultado.slice(0, Number(limite)) : resultado;
}

function projetar(backend: Backend, tabela: string, linhas: Linha[], select: string | null): Linha[] {
  if (!select) return linhas;
  // relações embutidas: alias:tabela(colunas)
  const relacoes = [...select.matchAll(/(\w+):(\w+)\(([^)]*)\)/g)];
  return linhas.map((linha) => {
    const copia = { ...linha };
    for (const [, alias, tabelaRel] of relacoes) {
      const chaveFk = tabelaRel === 'agenda_calendarios' ? 'calendario_id' : tabelaRel === 'agenda_profissionais' ? 'profissional_id' : 'especialidade_id';
      copia[alias] = backend.tabelas[tabelaRel]?.find((r) => r.id === linha[chaveFk]) ?? null;
    }
    return copia;
  });
}

async function rest(backend: Backend, request: Request, url: URL): Promise<Response> {
  const caminho = url.pathname.replace('/rest/v1/', '');
  const corpo = request.method === 'GET' || request.method === 'DELETE' ? undefined : await request.json().catch(() => undefined);
  backend.chamadasRest.push({ metodo: request.method, tabela: caminho, url: url.search, corpo });

  if (caminho.startsWith('rpc/')) {
    const nome = caminho.slice(4);
    backend.rpcChamadas.push({ nome, args: corpo });
    if (backend.rpcs[nome]) return Response.json(backend.rpcs[nome](corpo) ?? null);
    if (nome === 'agenda_calendario_id_interno') {
      const cal = backend.tabelas.agenda_calendarios?.find((c) => c.id === corpo?.p_calendario_id);
      return Response.json(cal?.google_id ?? null);
    }
    if (nome === 'obter_openai_key_interna') return Response.json('sk-teste');
    if (nome === 'obter_prompt_compilado') return Response.json([{ prompt_completo: backend.tabelas.__prompt?.[0]?.texto ?? '', total_regras_ativas: 1, snapshot: [] }]);
    return Response.json({ code: 'PGRST202', message: `rpc ${nome} não existe no fake` }, { status: 404 });
  }

  const tabela = backend.tabelas[caminho] ?? (backend.tabelas[caminho] = []);
  const select = url.searchParams.get('select');
  const quer = request.headers.get('prefer') ?? '';
  const objeto = (request.headers.get('accept') ?? '').includes('vnd.pgrst.object');

  const responderLinhas = (linhas: Linha[], status = 200) => {
    const saida = projetar(backend, caminho, linhas, select);
    if (objeto) {
      if (saida.length !== 1) return Response.json({ code: 'PGRST116', message: 'The result contains 0 rows', details: `${saida.length} rows` }, { status: 406 });
      return Response.json(saida[0], { status });
    }
    return Response.json(saida, { status });
  };

  if (request.method === 'GET') return responderLinhas(filtrar(tabela, url.searchParams));
  if (request.method === 'POST') {
    const novos: Linha[] = (Array.isArray(corpo) ? corpo : [corpo]).map((l: Linha) => ({ id: l.id ?? `id-${++contador}`, ...(PADROES[caminho] ?? {}), ...l }));
    if (quer.includes('resolution=ignore-duplicates') || quer.includes('resolution=merge-duplicates')) {
      const conflito = (url.searchParams.get('on_conflict') ?? 'id').split(',');
      for (const novo of novos) {
        const existente = tabela.find((l) => conflito.every((c) => l[c] === novo[c]));
        if (!existente) tabela.push(novo);
        else if (quer.includes('merge-duplicates')) Object.assign(existente, novo);
      }
    } else {
      for (const novo of novos) {
        const duplicada = caminho === 'agenda_agendamentos' && tabela.some((l) => l.google_event_id === novo.google_event_id);
        if (duplicada) return Response.json({ code: '23505', message: 'duplicate key' }, { status: 409 });
        tabela.push(novo);
      }
    }
    return quer.includes('return=representation') ? responderLinhas(novos, 201) : new Response(null, { status: 201 });
  }
  if (request.method === 'PATCH') {
    const alvos = filtrar(tabela, url.searchParams);
    for (const alvo of alvos) Object.assign(alvo, corpo);
    return quer.includes('return=representation') ? responderLinhas(alvos) : new Response(null, { status: 204 });
  }
  if (request.method === 'DELETE') {
    const alvos = new Set(filtrar(tabela, url.searchParams));
    backend.tabelas[caminho] = tabela.filter((l) => !alvos.has(l));
    return new Response(null, { status: 204 });
  }
  return new Response('método não suportado', { status: 405 });
}

async function google(backend: Backend, request: Request, url: URL): Promise<Response> {
  const corpo = request.method === 'POST' || request.method === 'PATCH' || request.method === 'PUT' ? await request.json() : undefined;
  const caminho = url.pathname.replace('/calendar/v3', '') + url.search;
  backend.chamadasGoogle.push({ metodo: request.method, caminho, corpo });
  const m = url.pathname.match(/^\/calendar\/v3\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/);
  if (!m) return Response.json({ error: 'rota desconhecida no fake' }, { status: 404 });
  const calendarId = decodeURIComponent(m[1]);
  const eventoId = m[2] ? decodeURIComponent(m[2]) : null;
  const eventos = backend.calendarios[calendarId];
  if (!eventos) return Response.json({ error: 'calendário desconhecido' }, { status: 404 });

  if (request.method === 'GET' && !eventoId) {
    const min = Date.parse(url.searchParams.get('timeMin') ?? '1970-01-01');
    const max = Date.parse(url.searchParams.get('timeMax') ?? '2999-01-01');
    const itens = eventos.filter((e) => {
      const ini = Date.parse(e.start.dateTime ?? `${e.start.date}T00:00:00Z`);
      const fim = Date.parse(e.end.dateTime ?? `${e.end.date}T00:00:00Z`);
      return ini < max && fim > min;
    });
    return Response.json({ items: itens });
  }
  const existente = eventoId ? eventos.find((e) => e.id === eventoId) : undefined;
  if (request.method === 'GET') return existente ? Response.json(existente) : Response.json({ error: 'não encontrado' }, { status: 404 });
  if (request.method === 'POST') {
    const novo: EventoGoogle = { id: `ev-${++contador}`, status: 'confirmed', ...corpo };
    eventos.push(novo);
    return Response.json(novo);
  }
  if (!existente) return Response.json({ error: 'não encontrado' }, { status: 404 });
  if (request.method === 'PATCH' || request.method === 'PUT') { Object.assign(existente, corpo); return Response.json(existente); }
  if (request.method === 'DELETE') { eventos.splice(eventos.indexOf(existente), 1); return new Response(null, { status: 204 }); }
  return new Response('método não suportado', { status: 405 });
}

export function criarBackend(inicial: { tabelas?: Record<string, Linha[]>; calendarios?: Record<string, EventoGoogle[]> } = {}): Backend {
  return {
    tabelas: structuredClone(inicial.tabelas ?? {}),
    calendarios: structuredClone(inicial.calendarios ?? {}),
    chamadasGoogle: [], chamadasRest: [], respostasOpenAi: [], requisicoesOpenAi: [], handlers: {}, rpcs: {}, rpcChamadas: [],
  };
}

/** Instala o fetch falso, as variáveis de ambiente e (opcional) a captura de Deno.serve; devolve a função de restaurar. */
export function instalar(backend: Backend, opcoes: { agoraIso?: string } = {}) {
  const fetchOriginal = globalThis.fetch;
  const nowOriginal = Date.now;
  const serveOriginal = (Deno as any).serve;
  Deno.env.set('SUPABASE_URL', BASE);
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-role-falso');
  Deno.env.set('ATENDIMENTO_INTERNAL_SECRET', 'segredo-interno');
  Deno.env.set('GOOGLE_CALENDAR_ACCESS_TOKEN', 'token-google-falso');
  if (opcoes.agoraIso) { const fixo = Date.parse(opcoes.agoraIso); Date.now = () => fixo; }

  globalThis.fetch = (async (entrada: any, init?: RequestInit) => {
    const request = entrada instanceof Request ? entrada : new Request(entrada, init);
    const url = new URL(request.url);
    if (url.origin === BASE && url.pathname.startsWith('/rest/v1/')) return await rest(backend, request, url);
    if (url.origin === BASE && url.pathname.startsWith('/functions/v1/')) {
      const nome = url.pathname.replace('/functions/v1/', '');
      const handler = backend.handlers[nome];
      if (!handler) return Response.json({ error: `função ${nome} não registrada no fake` }, { status: 404 });
      return await handler(request);
    }
    if (url.hostname === 'www.googleapis.com') return await google(backend, request, url);
    if (url.hostname === 'api.openai.com') {
      const corpo = await request.json();
      backend.requisicoesOpenAi.push({ caminho: url.pathname, corpo });
      const proxima = backend.respostasOpenAi.shift();
      if (!proxima) return Response.json({ error: { message: 'sem resposta roteirizada' } }, { status: 500 });
      return Response.json(proxima(corpo));
    }
    return Response.json({ error: `URL não prevista no fake: ${request.url}` }, { status: 500 });
  }) as typeof fetch;

  (Deno as any).serve = (handler: (r: Request) => Promise<Response>) => { backend.handlers.__ultimo = handler; return { finished: Promise.resolve() }; };
  return () => { globalThis.fetch = fetchOriginal; Date.now = nowOriginal; (Deno as any).serve = serveOriginal; };
}

/** Importa uma Edge Function (que chama Deno.serve no topo) e devolve o handler capturado. */
export async function carregarFuncao(backend: Backend, nome: string): Promise<(r: Request) => Promise<Response>> {
  backend.handlers.__ultimo = undefined as never;
  await import(`../../functions/${nome}/index.ts?v=${++contador}`);
  const handler = backend.handlers.__ultimo;
  if (!handler) throw new Error(`a função ${nome} não registrou handler`);
  backend.handlers[nome] = handler;
  return handler;
}

export function chamar(handler: (r: Request) => Promise<Response>, corpo: unknown, cabecalhos: Record<string, string> = { 'x-internal-secret': 'segredo-interno' }) {
  return handler(new Request('http://fake.supabase.local/functions/v1/x', {
    method: 'POST', headers: { 'content-type': 'application/json', ...cabecalhos }, body: JSON.stringify(corpo),
  }));
}
