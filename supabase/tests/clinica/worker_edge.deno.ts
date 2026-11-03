// Roda o atendimento-worker DE VERDADE (Deno) com OpenAI roteirizada e a Edge `agenda` real por trás.
//   npx deno@2 test -A supabase/tests/clinica/worker_edge.deno.ts
import assert from 'node:assert/strict';
import { carregarFuncao, chamar, instalar, type Backend } from './fake_backend.ts';
import { AGORA, SESSAO, dadosClinica } from './fixture_clinica.ts';

const MODELO = `# Assistente de {{nome_empresa}}
Hoje é {{data_hoje_extenso}}, {{hora_atual}}. Saudação: {{saudacao}}.
Cliente: {{cliente_nome}} | pet {{pet_nome}} | e-mail {{cliente_email}}.
Consulta custa {{preco:consulta}}; horários: {{horarios:consultaveterinaria}}.
Endereço: {{endereco}}. Encerre com "{{frase_encerramento}}". {{variavel_inexistente}}
{{catalogo_servicos}}`;

function preparar(): Backend {
  const b = dadosClinica();
  Object.assign(b.tabelas.atendimento_config[0], {
    nome_assistente: 'Luna', endereco: 'Rua das Flores, 100', frase_encerramento: 'Cuidamos de quem você ama', estilo_comunicacao: 'Formal',
    telefone_contato: '(11) 4000-0000', max_caracteres_mensagem: 400,
    horario_funcionamento: [{ dias: [1, 2, 3, 4, 5], abre: '08:00', fecha: '18:00' }],
  });
  b.tabelas.clinica_servicos = [
    { id: 's1', chave: 'consulta', nome: 'Consulta', preco: 120, quem_agenda: 'assistente', tipo_agenda_id: 't1', ativo: true, ordem: 1, exige_requisicao: false },
    { id: 's2', chave: 'cirurgia', nome: 'Cirurgia', preco: null, quem_agenda: 'recepcao', tipo_agenda_id: null, ativo: true, ordem: 2, exige_requisicao: false },
  ];
  b.tabelas.atendimento_estados = [
    { chave: 'em_andamento', nome: 'Em andamento', deteccao: 'padrao', pausar_bot: false, notificar: false, encerrar_conversa: false, ativo: true, ordem: 0 },
    { chave: 'atendimento_humano', nome: 'Atendimento humano', deteccao: 'mensagem_cliente', criterios: 'pede humano', pausar_bot: true, pausa_horas: 8, notificar: true,
      modelo_notificacao: 'Humano: {{resumo}} wa.me/{{telefone_cliente}}', resumo_instrucao: 'Resuma.', mensagem_cliente: 'Vou chamar a equipe da {{nome_empresa}}.', encerrar_conversa: false, ativo: true, ordem: 10 },
    { chave: 'finalizado', nome: 'Finalizado', deteccao: 'resposta_assistente', frase_gatilho: '{{frase_encerramento}}', pausar_bot: false, notificar: true,
      modelo_notificacao: 'Finalizado ({{nome_empresa}}): {{resumo}} wa.me/{{telefone_cliente}}', resumo_instrucao: 'Resuma o atendimento.', encerrar_conversa: true, ativo: true, ordem: 20 },
  ];
  b.tabelas.notificacao_destinatarios = [
    { id: 'd1', nome: 'Recepção', telefone: '5511900000001', eventos: ['finalizado', 'agendamento_criado'], escopo: 'global', ativo: true },
    { id: 'd2', nome: 'Gestor', telefone: '5511900000002', eventos: ['atendimento_humano'], escopo: 'global', ativo: true },
  ];
  b.tabelas.meu_prompt_versoes = [{ id: 'v1', versao: 1, conteudo: MODELO }];
  b.tabelas.atendimento_conversas = [{ session_id: SESSAO, nome_contato: 'Maria S.', estado_atendimento: null }];
  b.tabelas.atendimento_mensagens = [{ id: 'm1', session_id: SESSAO, direcao: 'entrada', conteudo: 'Oi, quero marcar consulta para o Thor', ocorrido_em: '2026-10-25T14:59:00Z', recebido_em: '2026-10-25T14:59:00Z', processado_em: null }];
  b.tabelas.dados_cliente = [{ id: 1, sessionid: SESSAO, nome: 'Maria', email: null, nome_pet: null, telefone: SESSAO }];
  for (const t of ['atendimento_pausas', 'atendimento_bloqueios', 'atendimento_outbox', 'atendimento_erros', 'atendimento_ia_uso', 'atendimento_estado_eventos', 'atendimento_eventos', 'conversas_status', 'atendimentos']) b.tabelas[t] = [];
  b.rpcs.atendimento_claim_lotes = () => [{ session_id: SESSAO, claim_token: 'tok-1', claimed_at: '2026-10-25T15:00:00Z' }];
  b.rpcs.atendimento_finalizar_lote = () => null;
  b.rpcs.atendimento_reagendar_lote = () => null;
  return b;
}

const resposta = (message: Record<string, unknown>) => (_corpo?: unknown) => ({ choices: [{ message }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } });
const chamadaFerramenta = (id: string, nome: string, args: unknown) => ({ id, type: 'function', function: { name: nome, arguments: JSON.stringify(args) } });

async function comWorker(b: Backend, fn: (executar: () => Promise<any>) => Promise<void>) {
  const restaurar = instalar(b, { agoraIso: AGORA });
  try {
    await carregarFuncao(b, 'agenda');
    const worker = await carregarFuncao(b, 'atendimento-worker');
    await fn(async () => {
      const r = await chamar(worker, {});
      return await r.json();
    });
  } finally {
    restaurar();
  }
}

Deno.test('atendimento completo: prompt renderizado, grava_info, busca e agendamento reais, resposta dividida e estado finalizado', async () => {
  const b = preparar();
  const sistema: string[] = [];
  b.respostasOpenAi.push(
    // 1) classificador de estados (mensagem do cliente)
    resposta({ role: 'assistant', content: 'em_andamento' }),
    // 2) assistente: grava dados e busca horários
    (corpo) => { sistema.push(corpo.messages[0].content); return resposta({ role: 'assistant', content: '', tool_calls: [
      chamadaFerramenta('c1', 'grava_info', { nome_pet: 'Thor', email: 'Maria@Email.com', cpf: '123' }),
      chamadaFerramenta('c2', 'func_agenda', { Funcao: 'buscar', servico: 'consultaveterinaria' }),
    ] })(corpo); },
    // 3) assistente: agenda o horário escolhido
    resposta({ role: 'assistant', content: '', tool_calls: [
      chamadaFerramenta('c3', 'func_agenda', { Funcao: 'agendar', servico: 'consultaveterinaria', date_start: '2026-10-26T10:00:00-03:00' }),
    ] }),
    // 4) resposta final com a frase de encerramento
    resposta({ role: 'assistant', content: '**Agendamento confirmado!** Segue o resumo completo da consulta do Thor com a nossa equipe, tudo certo por aqui.\n\n🗓️ Data: 26/10/2026 · ⏰ Horário: 10:00 · 🩺 Serviço: Consulta de Clínica Geral · 💙 Pet: Thor\n\nCuidamos de quem você ama' }),
    // 5) resumo para a equipe (estado finalizado)
    resposta({ role: 'assistant', content: 'Cliente agendou consulta.' }),
  );

  await comWorker(b, async (executar) => {
    const saida = await executar();
    assert.deepEqual([saida.ok, saida.claimed, saida.processed], [true, 1, 1], JSON.stringify(saida));
    // O único erro registrado é a variável desconhecida do modelo (removida do que o modelo recebe).
    assert.deepEqual(b.tabelas.atendimento_erros.map((e) => [e.codigo, e.detalhe_seguro]), [['prompt_variavel_desconhecida', '{{variavel_inexistente}}']]);

    // O modelo recebeu o prompt RENDERIZADO (data, empresa, cliente, preço, horários) — nenhum marcador sobrando.
    const prompt = sistema[0];
    assert.match(prompt, /# Assistente de Clínica Teste/);
    assert.match(prompt, /Hoje é domingo, 25\/10\/2026, 12:00\. Saudação: boa tarde\./);
    assert.match(prompt, /Cliente: Maria \| pet não informado \| e-mail não informado\./);
    assert.match(prompt, /Consulta custa R\$ 120,00; horários: segunda a quinta, 09:00 às 18:00 \(último horário 17:00\) — pausa para almoço 13:00 às 14:00/);
    assert.match(prompt, /Endereço: Rua das Flores, 100\. Encerre com "Cuidamos de quem você ama"\./);
    assert.match(prompt, /Agendados por você[^\n]*:\n- Consulta: R\$ 120,00/);
    assert.match(prompt, /Agendados SOMENTE pela recepção humana[^\n]*:\n- Cirurgia/);
    assert.doesNotMatch(prompt, /\{\{|\}\}/);
    assert.match(prompt, /Agendas configuradas \(use exatamente estas chaves/);

    // Ferramentas oferecidas ao modelo: func_agenda só com tipos agendáveis, grava_info, conhecimento.
    const tools = b.requisicoesOpenAi[1].corpo.tools.map((t: any) => t.function.name).sort();
    assert.deepEqual(tools, ['consulta_conhecimento', 'func_agenda', 'grava_info']);
    const enumServicos = b.requisicoesOpenAi[1].corpo.tools.find((t: any) => t.function.name === 'func_agenda').function.parameters.properties.servico.enum;
    assert.deepEqual(enumServicos, ['consultaveterinaria']);

    // grava_info: campo permitido gravado (e-mail normalizado), campo estranho recusado.
    assert.equal(b.tabelas.dados_cliente.length, 1);
    assert.deepEqual([b.tabelas.dados_cliente[0].nome_pet, b.tabelas.dados_cliente[0].email], ['Thor', 'maria@email.com']);
    const retornoGrava = JSON.parse(b.requisicoesOpenAi[2].corpo.messages.find((m: any) => m.tool_call_id === 'c1').content);
    assert.deepEqual([retornoGrava.ok, retornoGrava.gravados, retornoGrava.rejeitados], [true, ['nome_pet', 'email'], [{ campo: 'cpf', motivo: 'campo_nao_permitido' }]]);

    // A busca chegou com horários reais e a instrução de apresentação; o agendamento criou o evento de verdade.
    const busca = JSON.parse(b.requisicoesOpenAi[2].corpo.messages.find((m: any) => m.tool_call_id === 'c2').content);
    assert.ok(busca.dias, `busca falhou: ${JSON.stringify(busca)}`);
    assert.equal(busca.dias[0].data, '2026-10-26');
    assert.equal(busca.valor_particular, 'R$ 120,00');
    assert.ok(!('slots' in busca) && !('event' in busca));
    const agendou = JSON.parse(b.requisicoesOpenAi[3].corpo.messages.find((m: any) => m.tool_call_id === 'c3').content);
    assert.equal(agendou.ok, true, JSON.stringify(agendou));
    const evento = b.calendarios['cal-geral@group'][0];
    assert.equal(evento.summary, 'Consulta de Clínica Geral para: Thor | Tutor: Maria | Telefone: (41) 9 9999-0001');
    assert.deepEqual(evento.attendees, [{ email: 'maria@email.com' }]);
    assert.equal(b.tabelas.agenda_agendamentos.length, 1);

    // Resposta ao cliente: markdown convertido e dividida em mensagens ordenadas.
    const mensagens = b.tabelas.atendimento_outbox.filter((o) => o.tipo !== 'notificacao').sort((x, y) => x.criado_em.localeCompare(y.criado_em));
    assert.ok(mensagens.length >= 2, `${mensagens.length} mensagem(ns)`);
    assert.match(mensagens[0].conteudo, /^\*Agendamento confirmado!\* Segue o resumo/);
    assert.equal(mensagens.at(-1)!.conteudo.endsWith('Cuidamos de quem você ama'), true);
    assert.ok(mensagens.every((m) => m.destino === '5541999990001' && !m.conteudo.includes('**')));
    assert.equal(new Set(mensagens.map((m) => m.dedupe_key)).size, mensagens.length);

    // Avisos à equipe: agendamento criado + conversa finalizada (frase vem da configuração da empresa).
    const avisos = b.tabelas.atendimento_outbox.filter((o) => o.tipo === 'notificacao');
    const textos = avisos.map((a) => `${a.destino}|${a.conteudo}`);
    assert.ok(textos.some((t) => t.startsWith('5511900000001|📅 Novo agendamento') && t.includes('Quando: 26/10/2026 10:00')), JSON.stringify(textos));
    assert.ok(textos.some((t) => t.startsWith('5511900000001|Finalizado (Clínica Teste): Cliente agendou consulta. wa.me/5541999990001')));
    assert.ok(!textos.some((t) => t.startsWith('5511900000002')), 'gestor só recebe pedido de humano');
    assert.equal(b.tabelas.atendimento_conversas[0].estado_atendimento, 'finalizado');
    assert.equal(b.tabelas.conversas_status[0].status, 'fechada');
    assert.equal(b.tabelas.atendimento_ia_uso.length, 1);
  });
});

Deno.test('pedido de atendimento humano: classificador pausa o bot, avisa a equipe e não chama o assistente', async () => {
  const b = preparar();
  b.tabelas.atendimento_mensagens[0].conteudo = 'Quero falar com um atendente humano';
  b.respostasOpenAi.push(
    resposta({ role: 'assistant', content: 'atendimento_humano' }),
    resposta({ role: 'assistant', content: 'Cliente quer atendimento humano.' }),
  );
  await comWorker(b, async (executar) => {
    const saida = await executar();
    assert.equal(saida.processed, 1);
    assert.equal(b.requisicoesOpenAi.length, 2); // classificador + resumo; o assistente NÃO foi chamado
    const pausaChamada = b.rpcChamadas.find((c) => c.nome === 'atendimento_definir_pausa')!;
    assert.equal(pausaChamada.args.p_motivo, 'estado:atendimento_humano');
    const horasPausa = (Date.parse(pausaChamada.args.p_expira_em) - Date.now()) / 3_600_000;
    assert.equal(Math.round(horasPausa), 8);
    const saidas = b.tabelas.atendimento_outbox;
    assert.ok(saidas.some((o) => o.destino === '5541999990001' && o.conteudo === 'Vou chamar a equipe da Clínica Teste.'));
    assert.ok(saidas.some((o) => o.tipo === 'notificacao' && o.destino === '5511900000002' && o.conteudo.startsWith('Humano: Cliente quer atendimento humano.')));
  });
});

Deno.test('prompt antigo com expressões do n8n nunca vaza para o modelo e o problema fica registrado', async () => {
  const b = preparar();
  b.tabelas.meu_prompt_versoes = [{ id: 'v1', versao: 1, conteudo: 'Hoje é {{ $now.weekdayLong }} e o e-mail é {{ $(\'DadosClienteSupabase\').item.json.email }}. Você é {{nome_assistente}}.' }];
  b.tabelas.estados = [];
  b.tabelas.atendimento_estados = b.tabelas.atendimento_estados.filter((e) => e.deteccao !== 'mensagem_cliente');
  b.respostasOpenAi.push((corpo) => resposta({ role: 'assistant', content: `ok:${corpo.messages[0].content.length}` })(corpo));
  await comWorker(b, async (executar) => {
    await executar();
    const sistema: string = b.requisicoesOpenAi[0].corpo.messages[0].content;
    assert.match(sistema, /Hoje é  e o e-mail é \. Você é Luna\./);
    assert.doesNotMatch(sistema, /\$now|DadosClienteSupabase/);
    const erro = b.tabelas.atendimento_erros.find((e) => e.codigo === 'prompt_variavel_desconhecida');
    assert.ok(erro && erro.detalhe_seguro.includes('$now'));
  });
});

Deno.test('conversa pausada ou bloqueada não chama a IA nem gera saída', async () => {
  const b = preparar();
  b.tabelas.atendimento_bloqueios = [{ id: 'b1', telefone: '5541999990001', session_id: SESSAO, ativo: true }];
  await comWorker(b, async (executar) => {
    const saida = await executar();
    assert.equal(saida.processed, 1);
    assert.equal(b.requisicoesOpenAi.length, 0);
    assert.equal(b.tabelas.atendimento_outbox.length, 0);
    assert.ok(b.rpcChamadas.some((c) => c.nome === 'atendimento_finalizar_lote'));
  });
});
