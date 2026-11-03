/** Variáveis aceitas nos modelos de título/descrição do evento (resolvidas ao agendar). */
export const VARIAVEIS_EVENTO: Array<{ nome: string; exemplo: string; descricao: string }> = [
  { nome: 'servico', exemplo: 'Consulta de Clínica Geral', descricao: 'Nome do tipo de agendamento' },
  { nome: 'tipo', exemplo: 'consultaveterinaria', descricao: 'Chave do tipo de agendamento' },
  { nome: 'profissional', exemplo: 'Dra. Ana', descricao: 'Profissional da agenda' },
  { nome: 'pet_nome', exemplo: 'Thor', descricao: 'Nome do pet' },
  { nome: 'cliente_nome', exemplo: 'Maria', descricao: 'Nome do tutor' },
  { nome: 'cliente_telefone', exemplo: '(41) 9 9999-0001', descricao: 'Telefone do cliente' },
  { nome: 'cliente_email', exemplo: 'maria@email.com', descricao: 'E-mail do cliente' },
  { nome: 'data', exemplo: '28/10/2026', descricao: 'Data do atendimento' },
  { nome: 'hora', exemplo: '14:30', descricao: 'Hora do atendimento' },
  { nome: 'dia_semana', exemplo: 'quarta-feira', descricao: 'Dia da semana' },
  { nome: 'nome_empresa', exemplo: 'Clínica Exemplo', descricao: 'Nome da empresa' },
  { nome: 'observacao', exemplo: 'primeira vez', descricao: 'Observação do cliente' },
];

export const TITULO_EVENTO_PADRAO = '{{servico}} para {{pet_nome}} | Tutor: {{cliente_nome}} | Telefone: {{cliente_telefone}}';
export const DESCRICAO_EVENTO_PADRAO =
  'Agendado pelo assistente virtual de {{nome_empresa}}.\nEm caso de cancelamento ou remarcação, avise com antecedência.';

/** Pré-visualização do modelo com dados de exemplo. */
export function previaModelo(modelo: string): string {
  return modelo.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, nome: string) =>
    VARIAVEIS_EVENTO.find((v) => v.nome === nome.toLowerCase())?.exemplo ?? '');
}

export const CHAVES_EVENTO = VARIAVEIS_EVENTO.map((v) => v.nome);

/** Marcadores do modelo que o sistema não conhece. */
export function marcadoresEventoInvalidos(modelo: string): string[] {
  return [...new Set([...modelo.matchAll(/\{\{\s*([^{}]*?)\s*\}\}/g)].filter((m) => !CHAVES_EVENTO.includes(m[1])).map((m) => m[0]))];
}
