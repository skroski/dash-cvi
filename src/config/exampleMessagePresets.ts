/**
 * Modelos de mensagens e presets de exemplo para clínicas veterinárias.
 * Agnóstico: usa {{clinica}} dinamicamente para servir a qualquer clínica.
 */

export type ReminderPresetCategory =
  | 'consulta'
  | 'vacina'
  | 'pos_atendimento'
  | 'aniversario_pet'
  | 'aniversario_tutor'
  | 'satisfacao';

export interface ExampleMessagePreset {
  id: string;
  name: string;
  category: ReminderPresetCategory;
  title: string;
  description: string;
  badge: string;
  recommendedDaysInAdvance: number;
  recommendedSendTime: string;
  onlyConfirmed: boolean;
  /** Envia 2 botões interativos via Uazapi: Confirmar e Não Confirmar. */
  confirmButtons: boolean;
  examples: string[];
  aiInstructions: string;
}

export const EXAMPLE_MESSAGE_PRESETS: ExampleMessagePreset[] = [
  {
    id: 'exemplo-atendimento',
    name: 'Lembrete de Atendimento / Consulta',
    category: 'consulta',
    title: 'Lembrete de Atendimento / Consulta',
    description: 'Aviso carinhoso com 2 botões interativos (Confirmar / Não Confirmar) na véspera.',
    badge: 'Atendimento (2 Botões)',
    recommendedDaysInAdvance: 1,
    recommendedSendTime: '18:00',
    onlyConfirmed: false,
    confirmButtons: true,
    examples: [
      '🐾 Lembrete da {{clinica}}!\n\nOlá, {{nome_tutor}}! Passando para lembrar do atendimento de {{nome_pet}}: {{servico}} {{quando}}, {{data}}, às {{horario}}.\n\nManter o cuidado em dia é essencial para proteger quem você ama! 🥰\n\nPor favor, confirme sua presença clicando em um dos botões abaixo: 💚\n\n{{clinica}} — Cuidado em 1º lugar! 🐾',
      'Olá, {{nome_tutor}}! 💚🐾\n\nAqui é a equipe da {{clinica}}. Estamos aguardando {{nome_pet}} {{quando}}, {{data}}, às {{horario}}, para {{servico}}.\n\nVocê pode confirmar sua presença ou avisar se teve algum imprevisto nos botões abaixo. 😊\n\nCom carinho,\nEquipe {{clinica}}',
      'Oi, {{nome_tutor}}! 🐶🐱\n\nLembrete especial da {{clinica}}: {{quando}} ({{data}}) é dia de {{servico}} para {{nome_pet}}, às {{horario}}.\n\nPodemos confirmar a presença de vocês? Basta clicar em Confirmar ou Não Confirmar logo abaixo. 💚\n\n{{clinica}} — Cuidado em 1º lugar! 🐾',
      'Olá, {{nome_tutor}}! 🐾\n\nA {{clinica}} tem um lembrete com muito carinho para você. O horário de {{nome_pet}} ({{servico}}) é {{quando}}, {{data}}, às {{horario}}.\n\nCuidado em 1º lugar sempre! Por favor, confirme seu comparecimento nos botões abaixo. 💚',
      'Olá, {{nome_tutor}}! 💚✨\n\nPassando para lembrar que o atendimento de {{nome_pet}} é {{quando}}, {{data}}, às {{horario}} ({{servico}}).\n\nChegar alguns minutinhos antes deixa tudo mais tranquilo. Clique no botão abaixo para confirmar sua presença!\n\nEquipe {{clinica}} 💚🐾',
    ],
    aiInstructions:
      'Adote um tom carinhoso, acolhedor e atencioso. Use emojis adequados (💚🐾🐶🐱🥰✨). Destaque que o cuidado com o pet é prioridade. Convide o tutor a clicar no botão Confirmar ou Não Confirmar abaixo da mensagem.',
  },
  {
    id: 'exemplo-vacina',
    name: 'Lembrete de Vacinação',
    category: 'vacina',
    title: 'Lembrete de Vacinação',
    description: 'Aviso focado na vacinação com 2 botões interativos (Confirmar / Não Confirmar).',
    badge: 'Vacinação (2 Botões)',
    recommendedDaysInAdvance: 1,
    recommendedSendTime: '20:00',
    onlyConfirmed: true,
    confirmButtons: true,
    examples: [
      '🐾 Lembrete da {{clinica}}!\n\nOlá, {{nome_tutor}}! Passando para lembrar que está chegando a hora da vacina de {{nome_pet}} ({{quando}}, {{data}}, às {{horario}}). 💉🐶🐱\n\nManter a vacinação em dia é essencial para proteger quem você ama! 🥰\n\nConfirme a presença de vocês clicando em um dos botões abaixo: 💚\n\n{{clinica}} — Cuidado em 1º lugar! 🐾',
      'Olá, {{nome_tutor}}! 💉🐾\n\nAqui é da {{clinica}}. Lembramos que a vacina de {{nome_pet}} está programada para {{quando}}, {{data}}, às {{horario}}.\n\nVacinar é um ato de amor e proteção! 💚 Por favor, confirme se comparecerá nos botões interativos abaixo.\n\nCom carinho,\nEquipe {{clinica}} 💚🐾',
      'Oi, {{nome_tutor}}! 🐾\n\nLembrete da vacina de {{nome_pet}}: {{quando}}, {{data}}, às {{horario}} na {{clinica}}. 💉✨\n\nA imunização mantém seu pet protegido e saudável. Confirme sua presença clicando em Confirmar abaixo! 🥰\n\n{{clinica}} — Cuidado em 1º lugar! 🐾',
    ],
    aiInstructions:
      'Destaque a importância da vacinação para a proteção e saúde do pet com carinho e responsabilidade. Use emojis adequados (💉🐶🐱💚🐾🥰). Peça confirmação do horário através dos botões Confirmar ou Não Confirmar logo abaixo da mensagem.',
  },
  {
    id: 'exemplo-banho-tosa',
    name: 'Lembrete de Banho e Tosa / Estética',
    category: 'consulta',
    title: 'Lembrete de Banho e Tosa / Estética',
    description: 'Lembrete de banho, tosa e serviços com botões interativos de confirmação.',
    badge: 'Banho e Tosa (2 Botões)',
    recommendedDaysInAdvance: 1,
    recommendedSendTime: '17:00',
    onlyConfirmed: false,
    confirmButtons: true,
    examples: [
      '🐾 Lembrete de Banho e Tosa — {{clinica}}!\n\nOlá, {{nome_tutor}}! Passando para lembrar que {{quando}}, {{data}}, às {{horario}}, é dia de deixar {{nome_pet}} bem cheiroso(a) e com o pelo impecável no nosso serviço de {{servico}}! 🛁✂️✨\n\nPor favor, confirme se podemos aguardar vocês clicando nos botões abaixo. 💚\n\n{{clinica}} — Cuidado e carinho em 1º lugar! 🐾',
      'Oi, {{nome_tutor}}! 🛁🐾\n\nAqui é da {{clinica}}! O horário de estética e bem-estar de {{nome_pet}} para {{servico}} está reservado para {{quando}}, {{data}}, às {{horario}}.\n\nPara mantermos a agenda certinha, clique em Confirmar ou Não Confirmar logo abaixo. Até breve! 🥰✨\n\nEquipe {{clinica}} 💚🐾',
    ],
    aiInstructions:
      'Tom leve, descontraído e carinhoso para banho, tosa e estética pet. Use emojis alegres (🛁✂️🧼🐾💚🥰). Convide o tutor a confirmar a presença clicando no botão abaixo.',
  },
  {
    id: 'exemplo-pos-atendimento',
    name: 'Pós-Atendimento: Como o Pet está?',
    category: 'pos_atendimento',
    title: 'Pós-Atendimento: Como o Pet está?',
    description: 'Check-in de recuperação 1 a 2 dias após a consulta (sem confirmação). Estimula resposta espontânea do tutor.',
    badge: 'Como o Pet está?',
    recommendedDaysInAdvance: 0,
    recommendedSendTime: '10:00',
    onlyConfirmed: false,
    confirmButtons: false,
    examples: [
      'Olá, {{nome_tutor}}! 💚🐾\n\nAqui é da equipe da {{clinica}}. Passando para saber: como o(a) {{nome_pet}} está se sentindo hoje após o atendimento de {{servico}}? 🥰✨\n\nEsperamos que a recuperação esteja ótima! Se tiver alguma dúvida ou se precisar de nós para qualquer coisa, é só nos responder por aqui. 💚\n\nCom carinho,\nEquipe {{clinica}} 🐾',
      'Oi, {{nome_tutor}}! 🐶🐱\n\nPassando para saber como nosso querido(a) {{nome_pet}} passou a noite depois da consulta na {{clinica}}! Está se alimentando direitinho e bem animado(a)? Conta para a gente aqui! 💚\n\nQualquer novidade ou suporte, estamos sempre à disposição. 🥰✨\n\n{{clinica}} — Cuidado em 1º lugar! 🐾',
      'Olá, {{nome_tutor}}! 🐾✨\n\nComo o(a) {{nome_pet}} está hoje? A equipe da {{clinica}} está acompanhando com muito carinho a evolução dele(a) após {{servico}}.\n\nSe precisar de orientações sobre a medicação ou cuidados, basta responder a esta mensagem. Desejamos uma excelente recuperação! 💚🐾\n\nEquipe {{clinica}}',
    ],
    aiInstructions:
      'Mensagem atenciosa, empática e acolhedora de pós-atendimento para saber como o pet passou após a consulta ou procedimento. Pergunte se o pet está bem, se está comendo e como está a recuperação. Convide o tutor a responder contando como o pet está (conversa bilateral para aquecimento e proteção contra bloqueio no WhatsApp). Não exige botões de confirmação. Use emojis carinhosos (💚🐾🥰✨🐶🐱).',
  },
  {
    id: 'exemplo-aniversario-pet',
    name: 'Aniversário do Pet',
    category: 'aniversario_pet',
    title: 'Aniversário do Pet',
    description: 'Celebração festiva cheia de carinho para o pet aniversariante (sem confirmação).',
    badge: 'Aniversário Pet',
    recommendedDaysInAdvance: 0,
    recommendedSendTime: '09:00',
    onlyConfirmed: false,
    confirmButtons: false,
    examples: [
      '🎉💚 Parabéns, {{nome_pet}}! 🐾\n\nA equipe da {{clinica}} deseja a você um dia muito especial, cheio de carinho, brincadeiras, diversão e muitos petiscos! 🦴🥰\n\nQue sua vida seja sempre repleta de saúde, amor, alegria e muitos momentos felizes ao lado da sua família! Que nunca faltem colinhos, passeios, brinquedinhos e, claro, muitos petiscos para comemorar esse dia tão especial! 🐾🎾💚\n\n🎂🐶 Feliz aniversário!\n\nCom muito carinho,\nEquipe {{clinica}} 💚🐾',
      '🎂🐾 Parabéns pelo dia do(a) {{nome_pet}}, {{nome_tutor}}! 🎉💚\n\nA {{clinica}} deseja um aniversário repleto de brincadeiras, passeios deliciosos e muito amor! Que {{nome_pet}} tenha sempre muita saúde e vitalidade. 🥰✨\n\nUm grande abraço de toda a nossa equipe!\n\nEquipe {{clinica}} 💚🐾',
    ],
    aiInstructions:
      'Mensagem festiva, afetuosa e cheia de entusiasmo para comemorar o aniversário do pet. Deseje saúde, petiscos, brinquedos, colinhos e muito amor junto à família. Não mencione consultas, exames ou procedimentos. Mensagem afetiva sem exigir confirmação. Use emojis festivos e fofos (🎉💚🐾🦴🥰🎾🎂🐶).',
  },
  {
    id: 'exemplo-aniversario-tutor',
    name: 'Aniversário do Tutor',
    category: 'aniversario_tutor',
    title: 'Aniversário do Tutor',
    description: 'Felicitações calorosas da equipe para o tutor aniversariante (sem confirmação).',
    badge: 'Aniversário Tutor',
    recommendedDaysInAdvance: 0,
    recommendedSendTime: '09:00',
    onlyConfirmed: false,
    confirmButtons: false,
    examples: [
      '🎉💚 Parabéns, {{nome_tutor}}! 🐾\n\nA equipe da {{clinica}} deseja a você um dia muito especial, cheio de alegria, carinho e momentos felizes! 🥰✨\n\nQue essa nova fase seja repleta de saúde, amor e muitas coisas boas ao lado de {{nome_pet}} e de quem você ama. 💚\n\nFeliz aniversário! 🎂🐾\n\nCom carinho,\nEquipe {{clinica}}',
      '🎂✨ Feliz aniversário, {{nome_tutor}}! 🎉💚\n\nAqui é da {{clinica}} passando para desejar um dia maravilhoso, com muitas comemorações e carinho! Que o novo ciclo venha cheio de realizações, paz e momentos especiais com seu pet. 🐾🥰\n\nCom muito carinho,\nEquipe {{clinica}} 💚🐾',
    ],
    aiInstructions:
      'Mensagem calorosa e afetuosa de felicitações pelo aniversário do tutor(a). Deseje saúde, amor, alegria e momentos felizes ao lado do pet e da família. Não mencione consultas ou procedimentos pendentes. Mensagem afetiva sem exigir confirmação. Use emojis (🎉💚🐾🥰✨🎂).',
  },
  {
    id: 'exemplo-pesquisa',
    name: 'Pesquisa de Satisfação',
    category: 'satisfacao',
    title: 'Pesquisa de Satisfação / Opinião',
    description: 'Mensagem com avaliação rápida pós-atendimento e link de feedback (sem confirmação).',
    badge: 'Satisfação / Opinião',
    recommendedDaysInAdvance: 0,
    recommendedSendTime: '19:00',
    onlyConfirmed: false,
    confirmButtons: false,
    examples: [
      '🐾 PESQUISA DE SATISFAÇÃO – {{clinica}} 💚\n\nOlá, {{nome_tutor}}! 😊\n\nSua opinião é muito importante para nós!\n\nQueremos oferecer um atendimento cada vez melhor para você e seu pet. Responder esta pesquisa leva menos de 1 minuto: 💚\n\n1️⃣ Como você avalia sua experiência na {{clinica}}?\n\n( ) ⭐⭐⭐⭐⭐ Excelente\n( ) ⭐⭐⭐⭐ Muito boa\n( ) ⭐⭐⭐ Boa\n( ) ⭐⭐ Regular\n\nResponda por aqui ou pelo link: {{link_pesquisa}}\n\n{{clinica}} — Cuidado em 1º lugar! 🐾',
      'Olá, {{nome_tutor}}! 💚🐾 Aqui é da {{clinica}}. Como foi sua experiência recente conosco no atendimento de {{nome_pet}}?\n\nSua avaliação nos ajuda a evoluir e oferecer sempre o melhor cuidado! Você pode responder com uma nota de 1 a 5 ou acessar nosso formulário rápido: {{link_pesquisa}}\n\nMuito obrigado pelo carinho e confiança! 🥰✨\n\nEquipe {{clinica}}',
    ],
    aiInstructions:
      'Mensagem educada, atenciosa e direta solicitando feedback do atendimento. Ressalte que responder é rápido e muito importante para continuarmos cuidando com excelência. Mencione que o tutor pode responder pela mensagem ou pelo link {{link_pesquisa}}. Mensagem de opinião sem botões de confirmação. Use emojis (🐾💚😊⭐).',
  },
];
