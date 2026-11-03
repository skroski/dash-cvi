// @ts-nocheck
// deno test supabase/tests/lembretes/mensagem.test.ts
import { assert, assertEquals, assertMatch } from 'jsr:@std/assert@1';
import {
  DadosLembrete,
  capitalizarNome,
  juntarLista,
  montarPrompt,
  nomeSaudacao,
  nomesDosPets,
  renderizarExemplo,
  textoQuando,
  validarTextoIA,
} from '../../functions/lembretes/mensagem.ts';

const dados: DadosLembrete = {
  nomeTutor: 'ANDRÉ',
  pets: ['TOBY', 'Mel'],
  servicos: ['Consulta Veterinária', 'Exame'],
  dataAgendada: '2026-10-14',
  horario: '10:30:00',
  diaEnvio: '2026-10-13',
  clinica: 'Clínica Veterinária',
};

Deno.test('nomes: capitalização, saudação e pets da planilha', () => {
  assertEquals(capitalizarNome('MARIA JÚLIA'), 'Maria Júlia');
  assertEquals(nomeSaudacao('GABRIEL A'), 'Gabriel');
  assertEquals(nomeSaudacao('ANA PAULA '), 'Ana Paula');
  assertEquals(nomeSaudacao('GIOVANNA CARRIJO'), 'Giovanna');
  assertEquals(nomesDosPets(['BRUCE E NINA', 'nina', 'CHARLOTTE, NERI E NINA']), [
    'Bruce',
    'Nina',
    'Charlotte',
    'Neri',
  ]);
  assertEquals(juntarLista(['Toby', 'Mel', 'Bob']), 'Toby, Mel e Bob');
});

Deno.test('quando: hoje, amanhã e dias à frente', () => {
  assertEquals(textoQuando('2026-10-13', '2026-10-13'), 'hoje');
  assertEquals(textoQuando('2026-10-14', '2026-10-13'), 'amanhã');
  assertEquals(textoQuando('2026-10-16', '2026-10-13'), 'em 3 dias');
  assertEquals(textoQuando('2026-11-01', '2026-10-31'), 'amanhã');
});

Deno.test('frase renderizada com 2 pets e 2 serviços', () => {
  const texto = renderizarExemplo(
    'Olá, {{nome_tutor}}! Horário de {{nome_pet}}: {{servico}} {{quando}}, {{data}}, às {{horario}}. Equipe {{clinica}}.',
    dados
  );
  assertEquals(
    texto,
    'Olá, André! Horário de Toby e Mel: Consulta Veterinária e Exame amanhã, 14/10, às 10:30. Equipe Clínica Veterinária.'
  );
});

Deno.test('sem horário a frase não fica quebrada', () => {
  const semHora = { ...dados, horario: null };
  assertEquals(
    renderizarExemplo('É {{quando}}, {{data}}, às {{horario}} ({{servico}}).', semHora),
    'É amanhã, 14/10 (Consulta Veterinária e Exame).'
  );
  assertEquals(
    renderizarExemplo('Lembrete: {{quando}} é dia de {{servico}} para {{nome_pet}}, às {{horario}}.', semHora),
    'Lembrete: amanhã é dia de Consulta Veterinária e Exame para Toby e Mel.'
  );
});

Deno.test('prompt leva dados, frases renderizadas e instruções extras', () => {
  const { sistema, usuario } = montarPrompt(dados, ['Oi {{nome_tutor}}, {{nome_pet}} {{quando}}.'], 'Peça confirmação com SIM.');
  assertMatch(sistema, /amanhã, 14\/10, às 10:30/);
  assertMatch(sistema, /Peça confirmação com SIM\./);
  assertMatch(usuario, /Oi André, Toby e Mel amanhã\./);
  assertMatch(usuario, /quarta-feira/);
  assert(!/\{\{/.test(usuario));
});

Deno.test('validação descarta texto ruim da IA', () => {
  const ok = validarTextoIA('"Olá, André! Toby e Mel têm horário amanhã, 14/10, às 10:30. Até lá!"', dados);
  assert(ok.ok);
  if (ok.ok) assert(!ok.texto.startsWith('"'));
  assertEquals(validarTextoIA('Olá!', dados), { ok: false, motivo: 'texto muito curto' });
  assertEquals(
    validarTextoIA('Olá, Mariana! Toby e Mel têm horário amanhã, 14/10, às 10:30. Até lá!', dados),
    { ok: false, motivo: 'texto sem o nome do tutor' }
  );
  assertEquals(
    validarTextoIA('Olá, André! Confirme aqui: https://exemplo.com amanhã às 10:30.', dados),
    { ok: false, motivo: 'texto com link' }
  );
});

Deno.test('assinatura sempre com o nome completo configurado', () => {
  const nome = 'cvi Clínica Veterinária & Centro de Diagnósticos';
  const d = { ...dados, clinica: nome };
  const corpo = 'Olá, André! Toby e Mel têm horário amanhã, 14/10, às 10:30.';
  for (const bruto of [corpo, `${corpo}\n\nEquipe cvi`, `${corpo}\n\n— cvi`]) {
    const r = validarTextoIA(bruto, d);
    assert(r.ok);
    if (r.ok) assertEquals(r.texto, `${corpo}\n\n${nome}`);
  }
  const ja = validarTextoIA(`${corpo}\n\n${nome}`, d);
  assert(ja.ok && ja.texto.endsWith(nome) && ja.texto.split(nome).length === 2);
});

Deno.test('prompts e validacao por categoria (pos-atendimento, aniversario, satisfacao)', () => {
  // Pós-atendimento ("Como o pet está?")
  const dadosPos = { ...dados, categoria: 'pos_atendimento' };
  const promptPos = montarPrompt(dadosPos, ['Como o Toby está se sentindo?']);
  assertMatch(promptPos.sistema, /PÓS-ATENDIMENTO \/ RECUPERAÇÃO/);
  assertMatch(promptPos.sistema, /perguntando como o pet está se sentindo/);

  // Aniversário do Pet
  const dadosNiver = { ...dados, categoria: 'aniversario_pet' };
  const promptNiver = montarPrompt(dadosNiver, ['Parabéns pelo dia do pet!']);
  assertMatch(promptNiver.sistema, /ANIVERSÁRIO DO PET/);
  assertMatch(promptNiver.sistema, /petiscos/);

  // Pesquisa de satisfação aceita link
  const dadosPesquisa = {
    ...dados,
    categoria: 'satisfacao',
    linkPesquisa: 'https://forms.gle/exemplo123',
  };
  const textoPesquisa =
    'Olá, André! Como foi o atendimento de Toby? Avalie aqui: https://forms.gle/exemplo123. Equipe Clínica Veterinária.';
  const valPesquisa = validarTextoIA(textoPesquisa, dadosPesquisa);
  assert(valPesquisa.ok);
});

