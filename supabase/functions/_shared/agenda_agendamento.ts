/**
 * Auxiliares de agendamento (puros): leitura de datas do modelo, validações e montagem
 * do evento do calendário a partir dos modelos configurados no painel.
 */
import { renderizarTemplate } from './estados.ts';
import {
  dataKeyDoInstante, diaDaSemana, formatarDataBR, horaTexto, instanteLocal, minutoDoDiaNoFuso, nomeDiaSemana,
} from './fuso.ts';
import { formatarTelefoneExibicao } from './prompt_variaveis.ts';
import type { ParametrosAgenda, TipoAgenda } from './agenda_catalogo.ts';

export interface DataHora {
  dataKey: string;
  /** Minutos desde 00:00 local; null quando só a data foi informada. */
  minuto: number | null;
  /** Instante absoluto; null quando só a data foi informada. */
  instanteMs: number | null;
}

const PADRAO_DATA = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Lê "AAAA-MM-DD" ou "AAAA-MM-DDTHH:mm[:ss][offset]". Sem offset, o relógio é o do fuso da empresa;
 * com offset, vale o instante informado (o dia e a hora locais são recalculados no fuso da empresa).
 */
export function interpretarDataHora(valor: unknown, fuso: string): DataHora | null {
  const texto = String(valor ?? '').trim();
  const m = texto.match(PADRAO_DATA);
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const teste = new Date(Date.UTC(ano, mes - 1, dia));
  if (teste.getUTCFullYear() !== ano || teste.getUTCMonth() !== mes - 1 || teste.getUTCDate() !== dia) return null;
  const dataKey = `${m[1]}-${m[2]}-${m[3]}`;
  if (m[4] === undefined) return { dataKey, minuto: null, instanteMs: null };
  const hora = Number(m[4]);
  const minuto = Number(m[5]);
  if (hora > 23 || minuto > 59) return null;
  if (m[7]) {
    const offset = m[7] === 'Z' ? 'Z' : m[7].replace(/^([+-]\d{2}):?(\d{2})$/, '$1:$2');
    const ms = Date.parse(`${dataKey}T${m[4]}:${m[5]}:${m[6] ?? '00'}${offset}`);
    if (!Number.isFinite(ms)) return null;
    return { dataKey: dataKeyDoInstante(ms, fuso), minuto: minutoDoDiaNoFuso(ms, fuso), instanteMs: ms };
  }
  return { dataKey, minuto: hora * 60 + minuto, instanteMs: instanteLocal(fuso, dataKey, hora * 60 + minuto).getTime() };
}

export function emailValido(email: unknown): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? '').trim());
}

/** Nomes de pets separados por vírgula, ponto e vírgula, "e" ou "&". */
export function nomesDePets(valor: unknown): string[] {
  return String(valor ?? '')
    .split(/\s*(?:,|;|&|\s+e\s+)\s*/i)
    .map((nome) => nome.trim())
    .filter(Boolean);
}

export interface DadosCliente {
  nome?: string | null;
  nomePet?: string | null;
  email?: string | null;
  telefone?: string | null;
  observacao?: string | null;
}

export interface EventoMontado {
  summary: string;
  description: string;
  location: string;
  attendees: string[];
}

export function montarEvento(opcoes: {
  tipo: TipoAgenda;
  parametros: ParametrosAgenda;
  profissional: string;
  inicioMs: number;
  fuso: string;
  cliente: DadosCliente;
  nomeEmpresa: string;
  codigoPais?: string;
  emailProfissional?: string | null;
}): EventoMontado {
  const { tipo, parametros, cliente } = opcoes;
  const dataKey = dataKeyDoInstante(opcoes.inicioMs, opcoes.fuso);
  const naoInformado = 'não informado';
  const variaveis: Record<string, string> = {
    servico: tipo.nome,
    tipo: tipo.chave,
    profissional: opcoes.profissional,
    pet_nome: cliente.nomePet?.trim() || naoInformado,
    cliente_nome: cliente.nome?.trim() || naoInformado,
    cliente_telefone: formatarTelefoneExibicao(cliente.telefone, opcoes.codigoPais ?? '55') || naoInformado,
    cliente_email: cliente.email?.trim() || naoInformado,
    data: formatarDataBR(dataKey),
    dia_semana: nomeDiaSemana(diaDaSemana(dataKey)),
    hora: horaTexto(minutoDoDiaNoFuso(opcoes.inicioMs, opcoes.fuso)),
    nome_empresa: opcoes.nomeEmpresa,
    observacao: cliente.observacao?.trim() ?? '',
  };
  const attendees: string[] = [];
  if (tipo.enviar_convite_cliente && emailValido(cliente.email)) attendees.push(String(cliente.email).trim());
  if (opcoes.emailProfissional && emailValido(opcoes.emailProfissional)) attendees.push(opcoes.emailProfissional.trim());
  const descricao = renderizarTemplate(parametros.descricaoModelo, variaveis).trim();
  return {
    summary: renderizarTemplate(parametros.tituloModelo, variaveis).replace(/\s+/g, ' ').trim().slice(0, 300),
    description: [descricao, variaveis.observacao ? `Observação: ${variaveis.observacao}` : ''].filter(Boolean).join('\n').slice(0, 2000),
    location: parametros.local,
    attendees: [...new Set(attendees)],
  };
}

/** Respostas curtas devolvidas ao modelo; ele as adapta ao tom da conversa. */
export const MENSAGENS_AGENDA = {
  criado: 'Agendamento realizado com sucesso.',
  remarcado: 'Reagendamento realizado com sucesso.',
  cancelado: 'Agendamento cancelado. Informe ao cliente que estamos sempre à disposição para um novo agendamento.',
  dataPassada: 'A data enviada já passou. Peça ao cliente para confirmar a data desejada.',
  emailInvalido: 'O e-mail não foi informado ou está em formato inválido. Pergunte o e-mail do cliente e grave-o com grava_info.',
  horarioIndisponivel: 'Esse horário não está mais disponível. Apresente os horários alternativos e peça que o cliente escolha outro.',
  novoHorarioIndisponivel: 'O novo horário solicitado não está disponível. Apresente alternativas e peça que o cliente escolha outro.',
  naoEncontrado: 'Não encontrei um agendamento feito por este atendimento nesse dia e horário. Confirme a data e a hora com o cliente ou use a função listar.',
  clienteSemAgendamentos: 'O cliente não tem agendamentos futuros feitos por este atendimento.',
} as const;

/** "26/10/2026 09:00" no fuso da empresa para textos curtos (avisos à equipe). */
export function formatarQuando(valor: unknown, fuso: string): string {
  const dh = interpretarDataHora(valor, fuso);
  if (!dh) return '';
  return dh.minuto == null ? formatarDataBR(dh.dataKey) : `${formatarDataBR(dh.dataKey)} ${horaTexto(dh.minuto)}`;
}
