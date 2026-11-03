// Montagem do texto dos lembretes.
//
// Arquivo sem dependências, importado pela edge function (Deno) e pelo painel
// (Vite). Assim a prévia do dashboard usa exatamente as mesmas regras do envio.

export const VARIAVEIS_LEMBRETE = [
  { token: '{{nome_tutor}}', rotulo: 'Tutor' },
  { token: '{{nome_pet}}', rotulo: 'Pet' },
  { token: '{{servico}}', rotulo: 'Serviço' },
  { token: '{{quando}}', rotulo: 'Quando (hoje/amanhã)' },
  { token: '{{data}}', rotulo: 'Data' },
  { token: '{{horario}}', rotulo: 'Horário' },
  { token: '{{clinica}}', rotulo: 'Clínica' },
  { token: '{{link_pesquisa}}', rotulo: 'Link da Pesquisa' },
] as const;

export type CategoriaLembrete =
  | 'consulta'
  | 'vacina'
  | 'pos_atendimento'
  | 'aniversario_pet'
  | 'aniversario_tutor'
  | 'satisfacao';

export interface DadosLembrete {
  nomeTutor: string;
  pets: string[];
  servicos: string[];
  /** Data do atendimento, AAAA-MM-DD. */
  dataAgendada: string;
  /** HH:MM ou HH:MM:SS. */
  horario: string | null;
  /** Dia em que a mensagem sai, AAAA-MM-DD. */
  diaEnvio: string;
  clinica: string;
  categoria?: CategoriaLembrete | string;
  linkPesquisa?: string | null;
}

export const DADOS_EXEMPLO: DadosLembrete = {
  nomeTutor: 'Mariana',
  pets: ['Toby'],
  servicos: ['Consulta Veterinária'],
  dataAgendada: '2026-10-14',
  horario: '10:30',
  diaEnvio: '2026-10-13',
  clinica: 'C.V.I. - Centro Veterinário Integrado',
};

const MINUSCULAS = new Set(['e', 'de', 'da', 'do', 'das', 'dos', 'di']);
const PRENOMES_COMPOSTOS = new Set([
  'ana', 'maria', 'joao', 'jose', 'pedro', 'luiz', 'luis', 'joana', 'paula',
]);

function semAcento(valor: string) {
  return valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** "MARIA JÚLIA" -> "Maria Júlia"; "BRUCE E NINA" -> "Bruce e Nina". */
export function capitalizarNome(valor: string): string {
  return valor
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((palavra, indice) =>
      indice > 0 && MINUSCULAS.has(palavra)
        ? palavra
        : palavra
            .split('-')
            .map((parte) => parte.charAt(0).toLocaleUpperCase('pt-BR') + parte.slice(1))
            .join('-')
    )
    .join(' ');
}

/**
 * Nome usado na saudação: primeiro nome, ou os dois primeiros quando o
 * prenome é composto (Ana Paula, João Marcelo). Ignora iniciais soltas
 * ("GABRIEL A" -> "Gabriel").
 */
export function nomeSaudacao(nomeCompleto: string): string {
  const palavras = capitalizarNome(nomeCompleto)
    .split(' ')
    .filter((palavra) => palavra.replace(/\./g, '').length > 1);
  if (palavras.length === 0) return capitalizarNome(nomeCompleto) || 'tudo bem';
  if (palavras.length >= 2 && PRENOMES_COMPOSTOS.has(semAcento(palavras[0]))) {
    return `${palavras[0]} ${palavras[1]}`;
  }
  return palavras[0];
}

/** ["Toby"] -> "Toby"; ["Toby", "Mel", "Bob"] -> "Toby, Mel e Bob". */
export function juntarLista(itens: string[]): string {
  const limpos = itens.map((item) => item.trim()).filter(Boolean);
  if (limpos.length <= 1) return limpos[0] ?? '';
  return `${limpos.slice(0, -1).join(', ')} e ${limpos[limpos.length - 1]}`;
}

/** Separa "BRUCE E NINA" e "Charlotte, Neri e Nina" em nomes, sem repetir. */
export function nomesDosPets(pets: string[]): string[] {
  const vistos = new Set<string>();
  const nomes: string[] = [];
  for (const entrada of pets) {
    for (const parte of entrada.split(/\s*,\s*|\s+e\s+/i)) {
      const nome = capitalizarNome(parte);
      const chave = semAcento(nome);
      if (!nome || vistos.has(chave)) continue;
      vistos.add(chave);
      nomes.push(nome);
    }
  }
  return nomes;
}

function diasEntre(deIso: string, ateIso: string) {
  const de = Date.UTC(+deIso.slice(0, 4), +deIso.slice(5, 7) - 1, +deIso.slice(8, 10));
  const ate = Date.UTC(+ateIso.slice(0, 4), +ateIso.slice(5, 7) - 1, +ateIso.slice(8, 10));
  return Math.round((ate - de) / 86_400_000);
}

/** "hoje", "amanhã", "depois de amanhã" ou "em N dias". */
export function textoQuando(dataAgendada: string, diaEnvio: string): string {
  const dias = diasEntre(diaEnvio, dataAgendada);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'amanhã';
  if (dias === 2) return 'depois de amanhã';
  return `em ${dias} dias`;
}

/** "2026-10-14" -> "14/10". */
export function formatarData(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

const DIAS_SEMANA = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
  'quinta-feira', 'sexta-feira', 'sábado',
];

export function diaDaSemana(iso: string): string {
  const dia = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
  return DIAS_SEMANA[dia.getUTCDay()];
}

export function formatarHorario(valor: string | null | undefined): string | null {
  const match = String(valor ?? '').match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
}

export function valoresVariaveis(dados: DadosLembrete): Record<string, string> {
  return {
    '{{nome_tutor}}': nomeSaudacao(dados.nomeTutor),
    '{{nome_pet}}': juntarLista(nomesDosPets(dados.pets)) || 'seu pet',
    '{{servico}}': juntarLista(dados.servicos) || 'atendimento',
    '{{quando}}': textoQuando(dados.dataAgendada, dados.diaEnvio),
    '{{data}}': formatarData(dados.dataAgendada),
    '{{horario}}': formatarHorario(dados.horario) ?? 'no horário combinado',
    '{{clinica}}': dados.clinica.trim() || 'clínica',
    '{{link_pesquisa}}': dados.linkPesquisa?.trim() || '',
  };
}

/** Preenche uma frase de exemplo com os dados do agendamento. */
export function renderizarExemplo(template: string, dados: DadosLembrete): string {
  let texto = template;
  if (!formatarHorario(dados.horario)) {
    // Sem horário informado, "às {{horario}}" sai da frase em vez de virar
    // "às no horário combinado".
    texto = texto.replace(/[ \t]*,?[ \t]*(?:às|as|a partir das)[ \t]+\{\{\s*horario\s*\}\}/gi, '');
  }
  for (const [token, valor] of Object.entries(valoresVariaveis(dados))) {
    const nome = token.slice(2, -2);
    texto = texto.replace(new RegExp(`\\{\\{\\s*${nome}\\s*\\}\\}`, 'gi'), valor);
  }
  return texto
    .replace(/[ \t]+([,.!?;:)])/g, '$1')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function exemplosValidos(exemplos: string[] | null | undefined): string[] {
  return (exemplos ?? []).map((exemplo) => exemplo.trim()).filter(Boolean);
}

export interface PromptLembrete {
  sistema: string;
  usuario: string;
}

export function inferirCategoria(dados: DadosLembrete, exemplos: string[]): CategoriaLembrete {
  if (dados.categoria) return dados.categoria as CategoriaLembrete;
  const texto = exemplos.join(' ').toLowerCase();
  if (/anivers[aá]rio\s+do\s+pet|parab[eé]ns.*pet|muitos\s+petiscos/i.test(texto)) return 'aniversario_pet';
  if (/anivers[aá]rio\s+do\s+tutor|feliz\s+anivers[aá]rio.*tutor|novo\s+ciclo/i.test(texto)) return 'aniversario_tutor';
  if (/como\s+(?:o|a)?\s*\{\{\s*nome_pet\s*\}\}\s+est[aá]|recupera[cç][aã]o|passou\s+a\s+noite|se\s+sentindo/i.test(texto)) return 'pos_atendimento';
  if (/pesquisa|satisfa[cç][aã]o|link_pesquisa|avalie|avalia/i.test(texto)) return 'satisfacao';
  if (/vacina|imuniza/i.test(texto)) return 'vacina';
  return 'consulta';
}

export function montarPrompt(
  dados: DadosLembrete,
  exemplos: string[],
  instrucoesExtras?: string | null
): PromptLembrete {
  const categoria = inferirCategoria(dados, exemplos);
  const valores = valoresVariaveis(dados);
  const horario = formatarHorario(dados.horario);
  const quando = `${valores['{{quando}}']}, ${valores['{{data}}']}`;

  let sistema = '';

  if (categoria === 'pos_atendimento') {
    sistema = [
      `Você escreve mensagens carinhosas de PÓS-ATENDIMENTO / RECUPERAÇÃO que a ${valores['{{clinica}}']} envia pelo WhatsApp para tutores de pets.`,
      '',
      'Objetivo: demonstrar cuidado genuíno perguntando como o pet está se sentindo após o atendimento, se a recuperação está boa e se a família precisa de suporte.',
      '',
      'Regras:',
      '- Gere uma única mensagem, em português do Brasil.',
      '- Cumprimente o tutor pelo nome e cite o(s) pet(s) e o serviço realizado.',
      '- Pergunte carinhosamente como o pet passou e incentive o tutor a responder contando como ele está.',
      '- Tom acolhedor, empático e atencioso. Não invente diagnósticos nem agende consultas.',
      '- Formate para WhatsApp: parágrafos curtos separados por linha em branco e até 3 emojis afetivos (💚🐾🥰✨🐶🐱).',
      `- Termine a mensagem com uma última linha contendo somente a assinatura oficial: ${valores['{{clinica}}']}. Nunca altere ou resuma a assinatura.`,
      `- Se citar a empresa no texto, preserve o nome completo ${valores['{{clinica}}']}. Não inclua links.`,
      '- Responda somente com a mensagem pronta, sem aspas, títulos ou explicações.',
      ...(instrucoesExtras?.trim() ? ['', 'Instruções adicionais da clínica:', instrucoesExtras.trim()] : []),
    ].join('\n');
  } else if (categoria === 'aniversario_pet') {
    sistema = [
      `Você escreve mensagens festivas e alegres de ANIVERSÁRIO DO PET que a ${valores['{{clinica}}']} envia pelo WhatsApp.`,
      '',
      'Objetivo: parabenizar o pet aniversariante com muito carinho, afeto e energia positiva, desejando saúde, brincadeiras, petiscos e felicidade com a família.',
      '',
      'Regras:',
      '- Gere uma única mensagem festiva e calorosa em português do Brasil.',
      '- Parabenize com alegria citando o pet e o tutor.',
      '- Não mencione consultas, exames, vacinas ou doenças.',
      '- Formate para WhatsApp: parágrafos curtos e emojis alegres e fofos (🎉💚🐾🦴🥰🎾🎂🐶🐱).',
      `- Termine a mensagem com uma última linha contendo somente a assinatura oficial: ${valores['{{clinica}}']}. Nunca altere ou resuma a assinatura.`,
      `- Se citar a empresa no texto, preserve o nome completo ${valores['{{clinica}}']}. Não inclua links.`,
      '- Responda somente com a mensagem pronta, sem aspas, títulos ou explicações.',
      ...(instrucoesExtras?.trim() ? ['', 'Instruções adicionais da clínica:', instrucoesExtras.trim()] : []),
    ].join('\n');
  } else if (categoria === 'aniversario_tutor') {
    sistema = [
      `Você escreve mensagens carinhosas de ANIVERSÁRIO DO TUTOR que a ${valores['{{clinica}}']} envia pelo WhatsApp.`,
      '',
      'Objetivo: felicitar o tutor pelo seu aniversário, desejando muita saúde, paz, alegria e momentos especiais ao lado de seu pet e família.',
      '',
      'Regras:',
      '- Gere uma única mensagem calorosa em português do Brasil.',
      '- Cumprimente o tutor pelo nome e cite o carinho mútuo com o pet.',
      '- Não mencione cobranças, procedimentos pendentes ou consultas.',
      '- Formate para WhatsApp: parágrafos curtos e emojis carinhosos (🎉💚🐾🥰✨🎂).',
      `- Termine a mensagem com uma última linha contendo somente a assinatura oficial: ${valores['{{clinica}}']}. Nunca altere ou resuma a assinatura.`,
      `- Se citar a empresa no texto, preserve o nome completo ${valores['{{clinica}}']}. Não inclua links.`,
      '- Responda somente com a mensagem pronta, sem aspas, títulos ou explicações.',
      ...(instrucoesExtras?.trim() ? ['', 'Instruções adicionais da clínica:', instrucoesExtras.trim()] : []),
    ].join('\n');
  } else if (categoria === 'satisfacao') {
    sistema = [
      `Você escreve mensagens de PESQUISA DE SATISFAÇÃO / OPINIÃO que a ${valores['{{clinica}}']} envia pelo WhatsApp pós-atendimento.`,
      '',
      'Objetivo: convidar o tutor a avaliar de forma rápida a experiência com o atendimento para seu pet.',
      '',
      'Regras:',
      '- Gere uma única mensagem educada e transparente em português do Brasil.',
      '- Cumprimente o tutor pelo nome e cite o pet.',
      '- Destaque que a opinião dele é muito importante e a resposta leva menos de 1 minuto.',
      valores['{{link_pesquisa}}']
        ? `- Apresente o link da pesquisa: ${valores['{{link_pesquisa}}']}.`
        : '- Informe que o tutor pode responder com uma nota ou mensagem.',
      '- Formate para WhatsApp: parágrafos curtos e emojis adequados (🐾💚😊⭐).',
      `- Termine a mensagem com a assinatura oficial: ${valores['{{clinica}}']}.`,
      '- Responda somente com a mensagem pronta, sem aspas, títulos ou explicações.',
      ...(instrucoesExtras?.trim() ? ['', 'Instruções adicionais da clínica:', instrucoesExtras.trim()] : []),
    ].join('\n');
  } else {
    // consulta ou vacina (padrão de agendamento)
    sistema = [
      `Você escreve lembretes de agendamento que a ${valores['{{clinica}}']} envia pelo WhatsApp para tutores de pets.`,
      '',
      'Objetivo: lembrar o tutor do agendamento com uma mensagem curta, cordial e natural.',
      '',
      'Regras:',
      '- Gere uma única mensagem, em português do Brasil.',
      '- Use somente os dados do agendamento. Não invente preço, endereço, preparo, documentos, nome de profissional nem detalhes do procedimento.',
      '- Não mencione procedimentos, exames ou serviços que não estejam no campo "Serviço".',
      '- Cumprimente o tutor pelo nome e cite o(s) pet(s) e o(s) serviço(s).',
      horario
        ? `- Informe quando é o atendimento exatamente como "${quando}, às ${horario}".`
        : `- Informe quando é o atendimento exatamente como "${quando}". O horário não foi informado: não cite horário.`,
      '- Varie a saudação, as frases e o encerramento, preservando o sentido dos exemplos.',
      '- Formate para WhatsApp: parágrafos curtos separados por uma linha em branco e no máximo 2 emojis.',
      '- Convide o tutor a responder esta mensagem caso precise remarcar.',
      `- Termine a mensagem com uma última linha contendo somente a assinatura, exatamente assim, sem alterar, resumir ou traduzir: ${valores['{{clinica}}']}. Nunca encurte o nome nem assine como uma única pessoa.`,
      `- Se citar a empresa no texto, preserve o nome completo ${valores['{{clinica}}']}. Não inclua links.`,
      '- Responda somente com a mensagem pronta, sem aspas, títulos ou explicações.',
      ...(instrucoesExtras?.trim()
        ? ['', 'Instruções adicionais da clínica:', instrucoesExtras.trim()]
        : []),
    ].join('\n');
  }

  const usuario = [
    'Dados do agendamento:',
    `- Tutor: ${valores['{{nome_tutor}}']}`,
    `- Pet(s): ${valores['{{nome_pet}}']}`,
    `- Serviço: ${valores['{{servico}}']}`,
    `- Quando: ${quando} (${diaDaSemana(dados.dataAgendada)})`,
    `- Horário: ${horario ?? 'não informado'}`,
    ...(valores['{{link_pesquisa}}'] ? [`- Link da Pesquisa: ${valores['{{link_pesquisa}}']}`] : []),
    '',
    'Exemplos para inspiração (não copie literalmente):',
    ...exemplos.flatMap((exemplo, indice) => [
      '',
      `### Exemplo ${indice + 1}`,
      renderizarExemplo(exemplo, dados),
    ]),
  ].join('\n');

  return { sistema, usuario };
}

export type ResultadoValidacao =
  | { ok: true; texto: string }
  | { ok: false; motivo: string };

/** Confere o texto da IA antes de ele ir para o WhatsApp. */
export function validarTextoIA(bruto: string, dados: DadosLembrete): ResultadoValidacao {
  const texto = bruto
    .trim()
    .replace(/^```[a-z]*\n?|```$/gi, '')
    .replace(/^["“”']+|["“”']+$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (texto.length < 30) return { ok: false, motivo: 'texto muito curto' };
  if (texto.length > 1200) return { ok: false, motivo: 'texto muito longo' };
  if (/\{\{|\}\}/.test(texto)) return { ok: false, motivo: 'variável sem preencher' };

  const isSatisfacao =
    dados.categoria === 'satisfacao' ||
    /link_pesquisa|pesquisa|satisfa[cç][aã]o|forms\.gle|docs\.google/i.test(bruto) ||
    /link_pesquisa|pesquisa|satisfa[cç][aã]o|forms\.gle|docs\.google/i.test(texto);

  if (!isSatisfacao && /https?:\/\/|www\./i.test(texto)) {
    return { ok: false, motivo: 'texto com link' };
  }

  const primeiroNome = semAcento(nomeSaudacao(dados.nomeTutor).split(' ')[0]);
  if (primeiroNome && !semAcento(texto).includes(primeiroNome)) {
    return { ok: false, motivo: 'texto sem o nome do tutor' };
  }

  return { ok: true, texto: garantirAssinatura(texto, dados.clinica) };
}

/**
 * Garante que a mensagem termine com o nome completo configurado pelo cliente.
 * Se a IA assinou de forma curta ("Equipe X", "— X") ou não assinou,
 * a assinatura dela é trocada pelo nome oficial.
 */
export function garantirAssinatura(texto: string, clinica: string): string {
  const nome = clinica.trim();
  if (!nome) return texto;
  const normalizado = (valor: string) => semAcento(valor).replace(/\s+/g, ' ').toLowerCase();
  if (normalizado(texto).includes(normalizado(nome))) return texto;

  const paragrafos = texto.split(/\n{2,}/);
  const ultimo = paragrafos[paragrafos.length - 1].trim();
  const pareceAssinatura =
    paragrafos.length > 1 &&
    ultimo.length <= 80 &&
    !/[.!?]\s+\S/.test(ultimo) &&
    (/^(?:[-—–~]|abra[çc]os|atenciosamente|equipe|at[.,]|um abra[çc]o|carinhos)/i.test(ultimo) ||
      normalizado(nome)
        .split(' ')
        .some((palavra) => palavra.length > 3 && normalizado(ultimo).includes(palavra)));
  if (pareceAssinatura) paragrafos.pop();
  return `${paragrafos.join('\n\n').trim()}\n\n${nome}`;
}

