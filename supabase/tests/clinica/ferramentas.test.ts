// Testes das ferramentas do assistente: func_agenda (preparo), grava_info, formatação WhatsApp e textos de horário.
// Uso: node --experimental-strip-types --test supabase/tests/clinica/ferramentas.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { montarCatalogo, montarFerramentaAgenda, montarContextoAgenda, parametrosEfetivos, resolverTipo, tipoDisponivelParaAssistente, type TipoAgenda } from '../../functions/_shared/agenda_catalogo.ts';
import { prepararChamadaAgenda, type ContextoFerramenta } from '../../functions/_shared/agenda_ferramenta.ts';
import { emailValido, formatarQuando, interpretarDataHora, montarEvento, nomesDePets } from '../../functions/_shared/agenda_agendamento.ts';
import { sanearCadastro, ferramentaGravaInfo } from '../../functions/_shared/cadastro_cliente.ts';
import { dividirMensagens, formatarParaWhatsApp } from '../../functions/_shared/whatsapp_formato.ts';
import { textoHorariosTipo } from '../../functions/_shared/horarios_texto.ts';

const TZ = 'America/Sao_Paulo';

function catalogo(): TipoAgenda[] {
  return montarCatalogo(
    [
      { id: 't1', chave: 'consulta', nome: 'Consulta', aliases: ['consulta veterinária'], duracao_padrao_minutos: 60, duracao_retorno_minutos: 30, intervalo_slots_minutos: 30, campos_obrigatorios: ['email', 'nome_pet'], max_pets_por_agendamento: 3, tag_id: 7, enviar_convite_cliente: true },
      { id: 't2', chave: 'oncologia', nome: 'Oncologia', aliases: [], duracao_padrao_minutos: 60, duracao_retorno_minutos: 30, intervalo_slots_minutos: 30, operacoes_permitidas: [], mensagem_agendamento_equipe: 'Quem agenda é a recepção.' },
      { id: 't3', chave: 'vacina', nome: 'Vacina', aliases: ['vacinas'], duracao_padrao_minutos: 30, duracao_retorno_minutos: 30, intervalo_slots_minutos: 30, operacoes_permitidas: ['buscar', 'agendar'] },
    ],
    [
      { id: 'r1', especialidade_id: 't1', profissional_id: 'p1' },
      { id: 'r2', especialidade_id: 't1', profissional_id: 'p2', duracao_padrao_minutos: 45 },
      { id: 'r3', especialidade_id: 't2', profissional_id: 'p3' },
      { id: 'r4', especialidade_id: 't3', profissional_id: 'p1' },
    ],
    [
      { id: 'p1', nome: 'Dra. Ana', unidade: 'Centro', email: 'ana@clinica.com', convidar_por_email: true },
      { id: 'p2', nome: 'Dr. Bruno' },
      { id: 'p3', nome: 'Dra. Carol' },
    ],
    [{ tipo_agenda_id: 't1', preco: 120, ativo: true }],
  );
}

const ctx = (cadastro = {}, extra: Partial<ContextoFerramenta> = {}): ContextoFerramenta => ({
  catalogo: catalogo(), sessionId: '5541999990001@s.whatsapp.net', fuso: TZ,
  cadastro: { nome: 'Maria', email: 'maria@email.com', nome_pet: 'Thor', ...cadastro }, ...extra,
});

test('catálogo: valor particular vem do serviço ligado ao tipo; tipo só informativo não vai para a ferramenta', () => {
  const cat = catalogo();
  assert.equal(cat.find((t) => t.chave === 'consulta')!.valor_particular, 120);
  assert.equal(tipoDisponivelParaAssistente(cat.find((t) => t.chave === 'oncologia')!), false);
  const enumServicos = (montarFerramentaAgenda(cat).function.parameters.properties.servico as { enum: string[] }).enum;
  assert.deepEqual(enumServicos, ['consulta', 'vacina']);
  assert.equal(montarFerramentaAgenda(cat).function.parameters.required.join(), 'Funcao');
  assert.ok(!('disponibilidade_geral' in montarFerramentaAgenda(cat).function.parameters.properties));
  assert.match(montarContextoAgenda(cat), /consulta \(Consulta\)/);
  assert.doesNotMatch(montarContextoAgenda(cat), /oncologia/);
  assert.equal(resolverTipo('Consulta Veterinária', cat)?.chave, 'consulta');
});

test('parâmetros efetivos: agenda sobrescreve tipo, que sobrescreve o padrão do sistema', () => {
  const t = catalogo()[0];
  assert.equal(parametrosEfetivos(t, t.regras[0]).duracao, 60);
  assert.equal(parametrosEfetivos(t, t.regras[1]).duracao, 45);
  assert.equal(parametrosEfetivos(t, t.regras[0], { retorno: true }).duracao, 30);
  assert.equal(parametrosEfetivos(t, t.regras[0]).maxPets, 3);
  assert.equal(parametrosEfetivos(t, t.regras[0]).capacidade, 1);
  assert.match(parametrosEfetivos(t, t.regras[0]).tituloModelo, /\{\{servico\}\}/);
});

test('func_agenda buscar: sem data pede próximos horários; com data/hora repassa; data inválida volta erro', () => {
  const sem = prepararChamadaAgenda({ Funcao: 'buscar', servico: 'consulta' }, ctx());
  assert.equal(sem.ok, true);
  if (sem.ok) assert.deepEqual([sem.body.acao, sem.body.agendaType, sem.body.dataHora], ['disponibilidade', 'consulta', undefined]);
  const com = prepararChamadaAgenda({ Funcao: 'buscar', servico: 'consulta', date_start: '2026-10-28T14:00:00-03:00', profissional: 'bruno' }, ctx());
  assert.equal(com.ok, true);
  if (com.ok) assert.deepEqual([com.body.dataHora, com.body.regraId], ['2026-10-28T14:00:00-03:00', 'r2']);
  assert.equal(prepararChamadaAgenda({ Funcao: 'buscar', servico: 'consulta', date_start: 'amanhã' }, ctx()).ok, false);
  // o modelo não precisa mais mandar disponibilidade_geral (ignorado)
  assert.equal(prepararChamadaAgenda({ Funcao: 'buscar', servico: 'consulta', disponibilidade_geral: true }, ctx()).ok, true);
});

test('func_agenda: serviço só da recepção, desconhecido, profissional inexistente e função inválida', () => {
  const recepcao = prepararChamadaAgenda({ Funcao: 'buscar', servico: 'oncologia' }, ctx());
  assert.deepEqual(recepcao.ok === false && (recepcao.resultado as { erro: string }).erro, 'servico_somente_recepcao');
  const desconhecido = prepararChamadaAgenda({ Funcao: 'buscar', servico: 'dermato' }, ctx());
  assert.deepEqual(desconhecido.ok === false && (desconhecido.resultado as { servicos_validos: string[] }).servicos_validos, ['consulta', 'vacina']);
  assert.equal(prepararChamadaAgenda({ Funcao: 'buscar', servico: 'consulta', profissional: 'Zé' }, ctx()).ok, false);
  assert.equal(prepararChamadaAgenda({ Funcao: 'apagar', servico: 'consulta' }, ctx()).ok, false);
  // vacina não permite reagendar/cancelar
  const naoPermite = prepararChamadaAgenda({ Funcao: 'cancelar', servico: 'vacina', data_antiga: '2026-10-28T10:00:00' }, ctx());
  assert.equal(naoPermite.ok === false && (naoPermite.resultado as { erro: string }).erro, 'operacao_nao_permitida');
});

test('func_agenda agendar: exige data e hora, dados obrigatórios do tipo e e-mail válido; limita pets', () => {
  const ok = prepararChamadaAgenda({ Funcao: 'agendar', servico: 'consulta', date_start: '2026-10-28T14:00:00-03:00', profissional: 'Dra. Ana' }, ctx());
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.evento, 'agendamento_criado');
    assert.equal(ok.body.acao, 'criar');
    assert.deepEqual(ok.body.contexto, { sessionId: '5541999990001@s.whatsapp.net', telefone: '5541999990001', nomeCliente: 'Maria', nomePet: 'Thor', email: 'maria@email.com', observacao: '' });
  }
  const semHora = prepararChamadaAgenda({ Funcao: 'agendar', servico: 'consulta', date_start: '2026-10-28' }, ctx());
  assert.equal(semHora.ok === false && (semHora.resultado as { erro: string }).erro, 'data_hora_obrigatoria');
  const semPet = prepararChamadaAgenda({ Funcao: 'agendar', servico: 'consulta', date_start: '2026-10-28T14:00:00' }, ctx({ nome_pet: '' }));
  assert.deepEqual(semPet.ok === false && (semPet.resultado as { faltando: string[] }).faltando, ['nome_pet']);
  const semEmail = prepararChamadaAgenda({ Funcao: 'agendar', servico: 'consulta', date_start: '2026-10-28T14:00:00' }, ctx({ email: '' }));
  assert.deepEqual(semEmail.ok === false && (semEmail.resultado as { faltando: string[] }).faltando, ['email']);
  const emailRuim = prepararChamadaAgenda({ Funcao: 'agendar', servico: 'consulta', date_start: '2026-10-28T14:00:00', email: 'maria@' }, ctx({ email: '' }));
  assert.equal(emailRuim.ok === false && (emailRuim.resultado as { erro: string }).erro, 'email_invalido');
  const emailInvalidoGravado = prepararChamadaAgenda({ Funcao: 'cancelar', servico: 'consulta', data_antiga: '2026-10-28T14:00:00' }, ctx({ email: 'sem-arroba' }));
  assert.equal(emailInvalidoGravado.ok === false && (emailInvalidoGravado.resultado as { erro: string }).erro, 'email_invalido');
  const muitosPets = prepararChamadaAgenda({ Funcao: 'agendar', servico: 'consulta', date_start: '2026-10-28T14:00:00', nome_pet: 'Thor, Mel, Bidu e Luna' }, ctx());
  assert.equal(muitosPets.ok === false && (muitosPets.resultado as { erro: string }).erro, 'pets_demais');
  const tres = prepararChamadaAgenda({ Funcao: 'agendar', servico: 'consulta', date_start: '2026-10-28T14:00:00', nome_pet: 'Thor, Mel e Bidu' }, ctx());
  assert.equal(tres.ok, true);
});

test('func_agenda reagendar/cancelar/listar: usam data_antiga e nunca um event_id inventado', () => {
  const re = prepararChamadaAgenda({ Funcao: 'reagendar', servico: 'consulta', date_start: '2026-10-30T10:00:00', data_antiga: '2026-10-28T14:00:00', event_id: 'abc' }, ctx());
  assert.equal(re.ok, true);
  if (re.ok) {
    assert.deepEqual([re.body.acao, re.body.inicio, re.body.dataAntiga, re.body.regraId, re.evento], ['editar', '2026-10-30T10:00:00', '2026-10-28T14:00:00', undefined, 'agendamento_reagendado']);
    assert.ok(!('event_id' in re.body) && !('eventId' in re.body));
  }
  assert.equal(prepararChamadaAgenda({ Funcao: 'reagendar', servico: 'consulta', date_start: '2026-10-30T10:00:00' }, ctx()).ok, false);
  const cancel = prepararChamadaAgenda({ Funcao: 'cancelar', servico: 'consulta', date_start: '2026-10-28T14:00:00' }, ctx());
  assert.equal(cancel.ok, true);
  if (cancel.ok) assert.equal(cancel.body.dataAntiga, '2026-10-28T14:00:00');
  const lista = prepararChamadaAgenda({ Funcao: 'listar' }, ctx());
  assert.equal(lista.ok && lista.body.acao, 'cliente');
});

test('datas: aceita só a data, data e hora local, ou com offset (recalcula no fuso da empresa)', () => {
  assert.deepEqual(interpretarDataHora('2026-10-28', TZ), { dataKey: '2026-10-28', minuto: null, instanteMs: null });
  const local = interpretarDataHora('2026-10-28T14:30:00', TZ)!;
  assert.deepEqual([local.dataKey, local.minuto], ['2026-10-28', 870]);
  assert.equal(local.instanteMs, Date.parse('2026-10-28T17:30:00Z'));
  const comOffset = interpretarDataHora('2026-10-28T14:30:00-03:00', TZ)!;
  assert.equal(comOffset.instanteMs, local.instanteMs);
  const outroOffset = interpretarDataHora('2026-10-28T14:30:00+00:00', TZ)!; // 11:30 em Brasília
  assert.deepEqual([outroOffset.dataKey, outroOffset.minuto], ['2026-10-28', 11 * 60 + 30]);
  assert.equal(interpretarDataHora('2026-02-30', TZ), null);
  assert.equal(interpretarDataHora('28/10/2026', TZ), null);
  assert.equal(interpretarDataHora('2026-10-28T25:00:00', TZ), null);
  assert.equal(formatarQuando('2026-10-28T14:30:00-03:00', TZ), '28/10/2026 14:30');
  assert.equal(formatarQuando('2026-10-28', TZ), '28/10/2026');
});

test('evento: título, descrição, local e convidados saem dos modelos configurados', () => {
  const t = catalogo()[0];
  const p = { ...parametrosEfetivos(t, t.regras[0]), local: 'Unidade Centro', tituloModelo: '{{servico}} — {{pet_nome}} ({{profissional}}) {{data}} {{hora}}' };
  const e = montarEvento({
    tipo: t, parametros: p, profissional: 'Dra. Ana', inicioMs: Date.parse('2026-10-28T17:30:00Z'), fuso: TZ,
    cliente: { nome: 'Maria', nomePet: 'Thor', email: 'maria@email.com', telefone: '5541999990001', observacao: 'primeira vez' },
    nomeEmpresa: 'Clínica Exemplo', emailProfissional: 'ana@clinica.com',
  });
  assert.equal(e.summary, 'Consulta — Thor (Dra. Ana) 28/10/2026 14:30');
  assert.match(e.description, /Agendado pelo assistente virtual de Clínica Exemplo/);
  assert.match(e.description, /Observação: primeira vez/);
  assert.equal(e.location, 'Unidade Centro');
  assert.deepEqual(e.attendees, ['maria@email.com', 'ana@clinica.com']);
  // título padrão tem tutor e telefone formatado; sem convite, não há convidados
  const padrao = montarEvento({
    tipo: { ...t, enviar_convite_cliente: false }, parametros: parametrosEfetivos(t, t.regras[0]), profissional: 'X', inicioMs: Date.parse('2026-10-28T17:30:00Z'), fuso: TZ,
    cliente: { nome: 'Maria', nomePet: 'Thor', email: 'maria@email.com', telefone: '5541999990001' }, nomeEmpresa: 'E',
  });
  assert.equal(padrao.summary, 'Consulta para Thor | Tutor: Maria | Telefone: (41) 9 9999-0001');
  assert.deepEqual(padrao.attendees, []);
  assert.equal(emailValido('a@b.co'), true);
  assert.equal(emailValido('a@b'), false);
  assert.deepEqual(nomesDePets('Thor, Mel e Bidu & Luna; Rex'), ['Thor', 'Mel', 'Bidu', 'Luna', 'Rex']);
});

test('grava_info: aceita só campos permitidos, valida e-mail e limita tamanho', () => {
  const r = sanearCadastro({ nome: '  Maria  \n da Silva ', email: 'MARIA@Email.com', nome_pet: 'Thor', cpf: '123', porte_pet: 'x'.repeat(90) });
  assert.deepEqual(r.valores, { nome: 'Maria da Silva', email: 'maria@email.com', nome_pet: 'Thor', porte_pet: 'x'.repeat(40) });
  assert.deepEqual(r.rejeitados, [{ campo: 'cpf', motivo: 'campo_nao_permitido' }]);
  assert.deepEqual(sanearCadastro({ email: 'ruim' }).rejeitados, [{ campo: 'email', motivo: 'email_invalido' }]);
  assert.deepEqual(sanearCadastro({ nome: '   ', nome_pet: 5 as unknown as string }).valores, {});
  assert.deepEqual(Object.keys(ferramentaGravaInfo().function.parameters.properties), ['nome', 'nome_pet', 'porte_pet', 'raca_pet', 'email', 'servico']);
});

test('WhatsApp: converte markdown, divide por parágrafo, junta curtos e quebra longos', () => {
  assert.equal(formatarParaWhatsApp('**Olá**, veja [nosso site](https://x.com.br)\n\n\n\n- item 1\n- item 2\n## Título'), '*Olá*, veja nosso site https://x.com.br\n\n• item 1\n• item 2\n*Título*');
  const msgs = dividirMensagens('Olá, Maria! Tudo bem?\n\nAqui estão as opções de horários disponíveis para amanhã na clínica, com bastante tempo para você escolher.\n\nOk?');
  assert.deepEqual(msgs.length, 2);
  assert.ok(msgs[1].endsWith('Ok?'));
  const longo = Array.from({ length: 30 }, (_, i) => `Frase número ${i + 1} do texto longo.`).join(' ');
  const partes = dividirMensagens(longo, { maxCaracteres: 200 });
  assert.ok(partes.length > 1 && partes.every((p) => p.length <= 200));
  assert.equal(partes.join(' ').replace(/\s+/g, ' '), longo);
  assert.deepEqual(dividirMensagens('   '), []);
  const muitas = dividirMensagens(Array.from({ length: 12 }, (_, i) => `Parágrafo ${i + 1} com texto suficiente para não ser agrupado automaticamente.`).join('\n\n'), { maxMensagens: 4, maxCaracteres: 300 });
  assert.equal(muitas.length, 4);
  assert.match(muitas.at(-1)!, /Parágrafo 12/);
});

test('horários do tipo: gerados das jornadas (agrupa dias, último horário, almoço, quinzenal, vários profissionais)', () => {
  const geral = {
    profissional: 'Clínica Geral', duracao: 60,
    janelas: [
      ...[1, 2, 3, 4].map((dia_semana) => ({ dia_semana, inicio: '09:00:00', fim: '18:00:00' })),
      { dia_semana: 5, inicio: '08:00:00', fim: '18:00:00' },
      { dia_semana: 6, inicio: '08:00:00', fim: '16:00:00' },
    ],
    intervalos: [1, 2, 3, 4, 5, 6].map((dia_semana) => ({ tipo: 'almoco', dia_semana, inicio: '13:00:00', fim: '14:00:00' })),
  };
  assert.equal(
    textoHorariosTipo([geral]),
    'segunda a quinta, 09:00 às 18:00 (último horário 17:00) — pausa para almoço 13:00 às 14:00\nsexta, 08:00 às 18:00 (último horário 17:00) — pausa para almoço 13:00 às 14:00\nsábado, 08:00 às 16:00 (último horário 15:00) — pausa para almoço 13:00 às 14:00',
  );
  const duas = textoHorariosTipo([
    { profissional: 'Dra. Ana', duracao: 30, janelas: [{ dia_semana: 2, inicio: '10:00', fim: '18:00' }, { dia_semana: 4, inicio: '10:00', fim: '18:00' }], intervalos: [] },
    { profissional: 'Dra. Bia', nome_exibicao: 'Dra. Beatriz', duracao: 30, janelas: [{ dia_semana: 1, inicio: '11:00', fim: '13:30', recorrencia: 'quinzenal' }], intervalos: [] },
  ]);
  assert.equal(duas, 'Dra. Ana: terça e quinta, 10:00 às 18:00 (último horário 17:30)\nDra. Beatriz: segunda, 11:00 às 13:30 (último horário 13:00) — a cada 15 dias');
  assert.equal(textoHorariosTipo([{ profissional: 'X', duracao: 60, janelas: [], intervalos: [] }]), '');
});
