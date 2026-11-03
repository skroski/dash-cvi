// @ts-nocheck
// Teste de ponta a ponta da edge function `lembretes`, sem rede:
// Supabase (REST/Auth), OpenAI e uazapi são simulados interceptando fetch.
//
// deno test --allow-env supabase/tests/lembretes/edge.test.ts
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1';

const SUPABASE = 'https://projeto-teste.supabase.co';
const UAZAPI = 'https://uazapi-teste.local';

Deno.env.set('SUPABASE_URL', SUPABASE);
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-role-de-teste');
Deno.env.set('LEMBRETES_CRON_SECRET', 'segredo-cron');
Deno.env.set('OPENAI_API_KEY', 'sk-teste');
Deno.env.set('UAZAPI_SERVER_URL', UAZAPI);
Deno.env.set('UAZAPI_INSTANCE_TOKEN', 'token-instancia');

type Rota = (url: URL, init: RequestInit) => Response | Promise<Response>;

const estado = {
  fila: [] as Record<string, unknown>[],
  updates: [] as { id: string; corpo: Record<string, any> }[],
  eventos: [] as Record<string, any>[],
  uazapi: [] as { numero: string; texto: string; token: string | null }[],
  respostasUazapi: [] as (() => Response | Promise<Response>)[],
  respostasOpenAI: [] as string[],
  openaiChamadas: 0,
};

const rotas: Rota = async (url, init) => {
  const corpo = init.body ? JSON.parse(String(init.body)) : null;
  const headers = new Headers(init.headers);

  if (url.origin === SUPABASE) {
    if (url.pathname === '/auth/v1/user') {
      const token = headers.get('authorization');
      return token === 'Bearer jwt-valido'
        ? Response.json({ id: 'usuario-1', aud: 'authenticated' })
        : Response.json({ msg: 'invalid' }, { status: 401 });
    }
    if (url.pathname === '/rest/v1/rpc/lembretes_reivindicar') {
      const fila = estado.fila;
      estado.fila = [];
      return Response.json(fila);
    }
    if (url.pathname === '/rest/v1/lembrete_configuracoes') {
      return Response.json([
        {
          id: 1,
          exemplos: ['Olá, {{nome_tutor}}! {{nome_pet}}: {{servico}} {{quando}}, {{data}}, às {{horario}}.'],
          usar_ia: true,
          modelo_ia: 'gpt-4.1-mini',
          instrucoes_ia: null,
          intervalo_min_segundos: 1,
        },
      ]);
    }
    if (url.pathname === '/rest/v1/lembrete_ajustes') {
      const objeto = headers.get('accept')?.includes('vnd.pgrst.object');
      return objeto ? Response.json({ nome_clinica: 'Clínica Veterinária' }) : Response.json([{ nome_clinica: 'Clínica Veterinária' }]);
    }
    if (url.pathname === '/rest/v1/lembrete_mensagens' && init.method === 'PATCH') {
      estado.updates.push({ id: url.searchParams.get('id') ?? '', corpo });
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/rest/v1/lembrete_eventos' && init.method === 'POST') {
      estado.eventos.push(corpo);
      return new Response(null, { status: 201 });
    }
    return Response.json({ message: `rota não simulada ${url.pathname}` }, { status: 404 });
  }

  if (url.origin === 'https://api.openai.com') {
    estado.openaiChamadas++;
    assertEquals(headers.get('authorization'), 'Bearer sk-teste');
    const texto = estado.respostasOpenAI.shift() ?? '';
    return Response.json({ choices: [{ message: { content: texto } }] });
  }

  if (url.origin === UAZAPI && url.pathname === '/send/text') {
    estado.uazapi.push({ numero: corpo.number, texto: corpo.text, token: headers.get('token') });
    const resposta = estado.respostasUazapi.shift();
    return resposta ? resposta() : Response.json({ messageid: `WA-${estado.uazapi.length}` });
  }

  throw new Error(`fetch inesperado: ${url}`);
};

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const requisicao = entrada instanceof Request ? entrada : null;
  const url = new URL(requisicao ? requisicao.url : String(entrada));
  const dados: RequestInit = requisicao
    ? { method: requisicao.method, headers: requisicao.headers, body: await requisicao.text() || undefined }
    : init;
  if (init.signal?.aborted) throw new DOMException('timeout', 'TimeoutError');
  return rotas(url, { ...dados, method: dados.method ?? 'GET' });
}) as typeof fetch;

// Captura o handler em vez de abrir uma porta.
let handler: (request: Request) => Promise<Response>;
// deno-lint-ignore no-explicit-any
(Deno as any).serve = (fn: typeof handler) => {
  handler = fn;
  return { finished: Promise.resolve(), shutdown() {} };
};
await import('../../functions/lembretes/index.ts');

function chamar(corpo: unknown, headers: Record<string, string>) {
  return handler(
    new Request('http://localhost/lembretes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(corpo),
    })
  );
}

function mensagem(id: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    configuracao_id: 1,
    disparo: 'automatico',
    dia_envio: '2026-10-13',
    telefone: '556192074568@s.whatsapp.net',
    nome_tutor: 'ANDRÉ',
    nomes_pets: ['TOBY', 'Mel'],
    servicos: ['Consulta Veterinária'],
    data_agendada: '2026-10-14',
    horario_agendado: '10:30:00',
    programado_para: new Date(Date.now() + 300).toISOString(),
    texto: null,
    ...extra,
  };
}

function limpar() {
  estado.fila = [];
  estado.updates = [];
  estado.eventos = [];
  estado.uazapi = [];
  estado.respostasUazapi = [];
  estado.respostasOpenAI = [];
  estado.openaiChamadas = 0;
}

Deno.test('recusa chamada sem credencial ou com segredo errado', async () => {
  limpar();
  assertEquals((await chamar({ acao: 'processar' }, {})).status, 401);
  assertEquals((await chamar({ acao: 'processar' }, { 'X-Cron-Secret': 'errado' })).status, 401);
  assertEquals((await chamar({ acao: 'processar' }, { Authorization: 'Bearer jwt-invalido' })).status, 401);
  assertEquals(estado.uazapi.length, 0);
});

Deno.test('cron não acessa ações do painel', async () => {
  limpar();
  const resposta = await chamar({ acao: 'previa' }, { 'X-Cron-Secret': 'segredo-cron' });
  assertEquals(resposta.status, 403);
});

Deno.test('processa a fila: texto da IA salvo antes do envio e envio pela uazapi', async () => {
  limpar();
  estado.fila = [mensagem(10)];
  estado.respostasOpenAI = ['Olá, André! 🐾\n\nToby e Mel têm Consulta Veterinária amanhã, 14/10, às 10:30.\n\nSe precisar remarcar, responda aqui.'];

  const resposta = await chamar({ acao: 'processar' }, { 'X-Cron-Secret': 'segredo-cron' });
  assertEquals(resposta.status, 202);

  assertEquals(estado.updates.length, 2);
  assertEquals(estado.updates[0].corpo.origem_texto, 'ia');
  assertEquals(estado.updates[0].corpo.modelo_ia, 'gpt-4.1-mini');
  assertEquals(estado.uazapi.length, 1);
  assertEquals(estado.uazapi[0].numero, '556192074568');
  assertEquals(estado.uazapi[0].token, 'token-instancia');
  assertEquals(estado.uazapi[0].texto, estado.updates[0].corpo.texto);
  assertEquals(estado.updates[1].corpo.status, 'enviado');
  assertEquals(estado.updates[1].corpo.provider_message_id, 'WA-1');
});

Deno.test('IA com texto inválido: usa a frase de exemplo e registra o motivo', async () => {
  limpar();
  estado.fila = [mensagem(11)];
  estado.respostasOpenAI = ['Olá, Mariana! Toby e Mel: atendimento amanhã às 10:30, ok?'];

  await chamar({ acao: 'processar' }, { 'X-Cron-Secret': 'segredo-cron' });

  assertEquals(estado.updates[0].corpo.origem_texto, 'exemplo');
  assertEquals(estado.uazapi[0].texto, 'Olá, André! Toby e Mel: Consulta Veterinária amanhã, 14/10, às 10:30.');
  assertMatch(estado.eventos[0].descricao, /nome do tutor/);
  assertEquals(estado.updates[1].corpo.status, 'enviado');
});

Deno.test('usa o texto do serviço (servicos_texto) na frase, e o nome continua na mensagem', async () => {
  limpar();
  estado.fila = [mensagem(12, { servicos_texto: ['consulta veterinária'] })];
  estado.respostasOpenAI = [''];

  await chamar({ acao: 'processar' }, { 'X-Cron-Secret': 'segredo-cron' });

  assertEquals(estado.uazapi[0].texto, 'Olá, André! Toby e Mel: consulta veterinária amanhã, 14/10, às 10:30.');
});

Deno.test('espera o horário programado de cada mensagem (intervalo aleatório)', async () => {
  limpar();
  const agora = Date.now();
  estado.fila = [
    mensagem(20, { programado_para: new Date(agora + 100).toISOString(), texto: 'Primeira mensagem para André, pronta.' }),
    mensagem(21, { programado_para: new Date(agora + 1_300).toISOString(), texto: 'Segunda mensagem para André, pronta.' }),
  ];
  const momentos: number[] = [];
  estado.respostasUazapi = [
    () => (momentos.push(Date.now()), Response.json({ id: 'a' })),
    () => (momentos.push(Date.now()), Response.json({ id: 'b' })),
  ];

  await chamar({ acao: 'processar' }, { 'X-Cron-Secret': 'segredo-cron' });

  assertEquals(estado.openaiChamadas, 0, 'texto já salvo não é reescrito');
  assertEquals(momentos.length, 2);
  assert(momentos[1] - momentos[0] >= 1_100, `intervalo de ${momentos[1] - momentos[0]} ms`);
});

Deno.test('duas mensagens vencidas juntas não saem coladas (intervalo mínimo da regra)', async () => {
  limpar();
  estado.fila = [
    mensagem(25, { programado_para: new Date(Date.now() - 1_000).toISOString(), texto: 'Mensagem A para André, pronta.' }),
    mensagem(26, { programado_para: new Date(Date.now() - 1_000).toISOString(), texto: 'Mensagem B para André, pronta.' }),
  ];
  const momentos: number[] = [];
  estado.respostasUazapi = [
    () => (momentos.push(Date.now()), Response.json({ id: 'a' })),
    () => (momentos.push(Date.now()), Response.json({ id: 'b' })),
  ];

  await chamar({ acao: 'processar' }, { 'X-Cron-Secret': 'segredo-cron' });

  assertEquals(momentos.length, 2);
  assert(momentos[1] - momentos[0] >= 950, `intervalo de ${momentos[1] - momentos[0]} ms`);
});

Deno.test('uazapi 503 é repetido; 400 vira falha sem repetir', async () => {
  limpar();
  estado.fila = [
    mensagem(30, { texto: 'Mensagem para André com retry.' }),
    mensagem(31, { texto: 'Mensagem para André que será recusada.' }),
  ];
  estado.respostasUazapi = [
    () => new Response('instável', { status: 503 }),
    () => Response.json({ messageid: 'OK-30' }),
    () => new Response('número inválido', { status: 400 }),
  ];

  await chamar({ acao: 'processar' }, { 'X-Cron-Secret': 'segredo-cron' });

  assertEquals(estado.uazapi.length, 3);
  const finais = estado.updates.filter((u) => u.corpo.status);
  assertEquals(finais[0].corpo.status, 'enviado');
  assertEquals(finais[0].corpo.provider_message_id, 'OK-30');
  assertEquals(finais[1].corpo.status, 'falha');
  assertMatch(finais[1].corpo.erro, /recusou o envio \(400\)/);
});

Deno.test('timeout da uazapi não repete (evita WhatsApp duplicado)', async () => {
  limpar();
  estado.fila = [mensagem(40, { texto: 'Mensagem para André com timeout.' })];
  estado.respostasUazapi = [
    () => {
      throw new DOMException('demorou', 'TimeoutError');
    },
  ];

  await chamar({ acao: 'processar' }, { 'X-Cron-Secret': 'segredo-cron' });

  assertEquals(estado.uazapi.length, 1);
  const final = estado.updates.find((u) => u.corpo.status);
  assertEquals(final?.corpo.status, 'falha');
  assertMatch(final?.corpo.erro, /Confira no WhatsApp/);
});

Deno.test('painel: prévia com IA e diagnóstico', async () => {
  limpar();
  estado.respostasOpenAI = ['Oi, Mariana! Toby tem Consulta Veterinária amanhã, 14/10, às 10:30. Qualquer coisa, responda aqui.'];
  const previa = await chamar(
    { acao: 'previa', exemplos: ['Olá, {{nome_tutor}}! {{nome_pet}} {{quando}}.'], quantidade: 1 },
    { Authorization: 'Bearer jwt-valido' }
  );
  assertEquals(previa.status, 200);
  const corpo = await previa.json();
  assertEquals(corpo.mensagens[0].origem, 'ia');
  assertEquals(estado.uazapi.length, 0, 'prévia nunca envia');

  const diag = await (await chamar({ acao: 'diagnostico' }, { Authorization: 'Bearer jwt-valido' })).json();
  assertEquals(diag, { openai: true, uazapi: true, cron_secret: true });
});
