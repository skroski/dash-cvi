/**
 * Variáveis do prompt: registro único, renderizador e validação.
 *
 * O prompt salvo em `meu_prompt_versoes` é um MODELO com marcadores `{{variavel}}`.
 * Ele é renderizado a cada lote de mensagens com dados da empresa (painel), do
 * catálogo de serviços, da agenda e do cliente — nada da clínica fica no código.
 *
 * Sintaxes aceitas:
 *   {{nome}}                  variável simples
 *   {{preco:chave}}           preço de um serviço do catálogo (ex.: R$ 120,00)
 *   {{servico:chave}}         linha completa do serviço (nome, preço, observações)
 *   {{horarios:chave_tipo}}   dias e horários de um tipo de agendamento
 *
 * Marcador desconhecido NUNCA vaza para o modelo: é removido e devolvido em
 * `desconhecidas` para o chamador registrar. Valores inseridos não são
 * reinterpretados (passagem única), então um nome de contato com `{{x}}` é inofensivo.
 */
import { diaDaSemana, nomeDiaSemana, partesNoFuso, somarDias } from './fuso.ts';

export interface HorarioFuncionamento {
  dias: number[];
  abre: string;
  fecha: string;
}

export interface ConfigEmpresa {
  nome_empresa: string;
  nome_assistente: string;
  telefone_contato?: string | null;
  codigo_pais?: string | null;
  fuso_horario?: string | null;
  endereco?: string | null;
  site?: string | null;
  instagram?: string | null;
  email_contato?: string | null;
  chave_pix?: string | null;
  planos_aceitos?: string[] | null;
  frase_encerramento?: string | null;
  estilo_comunicacao?: string | null;
  horario_funcionamento?: HorarioFuncionamento[] | null;
  saudacao_bom_dia_inicio?: string | null;
  saudacao_boa_tarde_inicio?: string | null;
  saudacao_boa_noite_inicio?: string | null;
  aviso_fora_horario_inicio?: string | null;
  aviso_fora_horario_fim?: string | null;
  aviso_fora_horario_texto?: string | null;
}

export type QuemAgenda = 'assistente' | 'recepcao' | 'sem_agendamento' | 'nao_oferece';

export interface ServicoCatalogo {
  chave: string;
  nome: string;
  categoria?: string | null;
  descricao?: string | null;
  preco?: number | string | null;
  preco_observacao?: string | null;
  quem_agenda: QuemAgenda;
  exige_requisicao?: boolean | null;
  aceita_plano?: boolean | null;
  observacoes?: string | null;
  ordem?: number | null;
  ativo?: boolean | null;
}

export interface ClienteContexto {
  nome?: string | null;
  nomeWhatsapp?: string | null;
  email?: string | null;
  telefone?: string | null;
  petNome?: string | null;
  petRaca?: string | null;
  petPorte?: string | null;
}

export interface ContextoPrompt {
  agora: Date;
  empresa: ConfigEmpresa;
  cliente: ClienteContexto;
  servicos: ServicoCatalogo[];
  /** chave do tipo de agenda -> texto de dias/horários (ver horarios_texto.ts). */
  horariosPorTipo: Record<string, string>;
  tipos: Array<{ chave: string; nome: string }>;
}

export type GrupoVariavel = 'data' | 'empresa' | 'cliente' | 'catalogo';

export interface DefinicaoVariavel {
  nome: string;
  grupo: GrupoVariavel;
  descricao: string;
  exemplo: string;
  /** Preenchido nas variáveis com parâmetro ({{nome:parametro}}). */
  parametro?: string;
}

/** Fonte única da lista exibida no painel e validada no banco (ver teste de paridade). */
export const VARIAVEIS: DefinicaoVariavel[] = [
  { nome: 'data_hoje', grupo: 'data', descricao: 'Data de hoje (dd/mm/aaaa) no fuso da empresa.', exemplo: '25/10/2026' },
  { nome: 'data_hoje_extenso', grupo: 'data', descricao: 'Dia da semana e data de hoje.', exemplo: 'domingo, 25/10/2026' },
  { nome: 'dia_semana', grupo: 'data', descricao: 'Dia da semana de hoje.', exemplo: 'domingo' },
  { nome: 'hora_atual', grupo: 'data', descricao: 'Hora atual (hh:mm) no fuso da empresa.', exemplo: '14:35' },
  { nome: 'data_amanha', grupo: 'data', descricao: 'Data de amanhã (dd/mm/aaaa).', exemplo: '26/10/2026' },
  { nome: 'dia_semana_amanha', grupo: 'data', descricao: 'Dia da semana de amanhã.', exemplo: 'segunda-feira' },
  { nome: 'data_daqui_uma_semana', grupo: 'data', descricao: 'Data de hoje mais 7 dias.', exemplo: '01/11/2026' },
  { nome: 'fuso_horario', grupo: 'data', descricao: 'Fuso horário configurado da empresa.', exemplo: 'America/Sao_Paulo' },
  { nome: 'saudacao', grupo: 'data', descricao: 'Bom dia, boa tarde ou boa noite conforme a hora (faixas configuráveis).', exemplo: 'boa tarde' },
  { nome: 'aviso_fora_horario', grupo: 'data', descricao: 'Texto de aviso fora do expediente; vazio durante o horário normal.', exemplo: '' },

  { nome: 'nome_empresa', grupo: 'empresa', descricao: 'Nome da empresa/clínica.', exemplo: 'C.V.I. - Centro Veterinário Integrado' },
  { nome: 'nome_assistente', grupo: 'empresa', descricao: 'Nome do assistente virtual.', exemplo: 'Assistente CVI' },
  { nome: 'telefone_contato', grupo: 'empresa', descricao: 'Telefone de contato da empresa.', exemplo: '(41) 3150-5444' },
  { nome: 'endereco', grupo: 'empresa', descricao: 'Endereço completo.', exemplo: 'Rua Manoel Claudino Barbosa, 1307 – Fazenda Rio Grande, PR' },
  { nome: 'site', grupo: 'empresa', descricao: 'Site / Localização.', exemplo: 'https://share.google/tENaeyydvL9OaHKLH' },
  { nome: 'instagram', grupo: 'empresa', descricao: 'Perfil no Instagram.', exemplo: '@cvi.fazenda' },
  { nome: 'email_contato', grupo: 'empresa', descricao: 'E-mail de contato.', exemplo: 'contato@cvi.com.br' },
  { nome: 'chave_pix', grupo: 'empresa', descricao: 'Chave Pix para pagamentos.', exemplo: '(41) 3150-5444' },
  { nome: 'planos_aceitos', grupo: 'empresa', descricao: 'Convênios e planos de saúde aceitos.', exemplo: 'PetHealth' },
  { nome: 'frase_encerramento', grupo: 'empresa', descricao: 'Frase que fecha o atendimento (também aciona o estado "finalizado").', exemplo: 'Amor, Ética e Comprometimento não são apenas valores, são a forma como honramos cada vida que nos é confiada!' },
  { nome: 'estilo_comunicacao', grupo: 'empresa', descricao: 'Tom de voz do assistente.', exemplo: 'Formal, claro, objetivo e empático' },
  { nome: 'horario_funcionamento', grupo: 'empresa', descricao: 'Horário de funcionamento, gerado da configuração semanal.', exemplo: 'Segunda a sexta: 08:00 às 18:00' },
  { nome: 'lista_especialidades', grupo: 'empresa', descricao: 'Tipos de agendamento ativos.', exemplo: 'Consulta, Vacinas' },

  { nome: 'cliente_nome', grupo: 'cliente', descricao: 'Nome do tutor/cliente (cadastro ou nome do WhatsApp).', exemplo: 'Maria' },
  { nome: 'cliente_nome_whatsapp', grupo: 'cliente', descricao: 'Nome exibido no WhatsApp do cliente.', exemplo: 'Maria S.' },
  { nome: 'cliente_email', grupo: 'cliente', descricao: 'E-mail cadastrado do cliente.', exemplo: 'maria@email.com' },
  { nome: 'cliente_telefone', grupo: 'cliente', descricao: 'Telefone do cliente, formatado.', exemplo: '(41) 9 9999-0001' },
  { nome: 'pet_nome', grupo: 'cliente', descricao: 'Nome do pet cadastrado.', exemplo: 'Thor' },
  { nome: 'pet_raca', grupo: 'cliente', descricao: 'Raça do pet cadastrada.', exemplo: 'Golden Retriever' },
  { nome: 'pet_porte', grupo: 'cliente', descricao: 'Porte do pet cadastrado.', exemplo: 'grande' },

  { nome: 'catalogo_servicos', grupo: 'catalogo', descricao: 'Todos os serviços e valores do catálogo, agrupados por quem agenda.', exemplo: '- Consulta: R$ 120,00' },
  { nome: 'preco', grupo: 'catalogo', descricao: 'Preço de um serviço do catálogo.', exemplo: 'R$ 120,00', parametro: 'chave do serviço' },
  { nome: 'servico', grupo: 'catalogo', descricao: 'Serviço do catálogo em uma linha (nome, preço e observações).', exemplo: 'Consulta: R$ 120,00', parametro: 'chave do serviço' },
  { nome: 'horarios', grupo: 'catalogo', descricao: 'Dias e horários de um tipo de agendamento, gerado das jornadas da agenda.', exemplo: 'segunda a sexta, 09:00 às 18:00', parametro: 'chave do tipo de agendamento' },
];

/** Nomes antigos continuam válidos (regras já salvas e o painel anterior). */
export const ALIASES_VARIAVEIS: Record<string, string> = {
  nome_clinica: 'nome_empresa',
  telefone_clinica: 'telefone_contato',
  nome_tutor: 'cliente_nome',
  nome_pet: 'pet_nome',
  raca_pet: 'pet_raca',
  data_atual: 'data_hoje',
};

const NOMES_SIMPLES = new Set(VARIAVEIS.filter((v) => !v.parametro).map((v) => v.nome));
const NOMES_COM_PARAMETRO = new Set(VARIAVEIS.filter((v) => v.parametro).map((v) => v.nome));

const MARCADOR = /\{\{([^{}]*)\}\}/g;
const NOME_VALIDO = /^[a-z0-9_]+(?::[a-z0-9_-]+)?$/;

export interface Marcador {
  bruto: string;
  nome: string;
  parametro: string | null;
}

/** Todos os marcadores de um texto. Conteúdo fora do formato (ex.: expressão do n8n) vira nome inválido. */
export function extrairMarcadores(texto: string): Marcador[] {
  const resultado: Marcador[] = [];
  for (const m of texto.matchAll(MARCADOR)) {
    const conteudo = m[1].trim();
    if (!NOME_VALIDO.test(conteudo)) {
      resultado.push({ bruto: m[0], nome: conteudo, parametro: null });
      continue;
    }
    const [nome, parametro] = conteudo.split(':');
    resultado.push({ bruto: m[0], nome, parametro: parametro ?? null });
  }
  return resultado;
}

function marcadorConhecido(marcador: Marcador): boolean {
  if (!NOME_VALIDO.test(marcador.parametro ? `${marcador.nome}:${marcador.parametro}` : marcador.nome)) return false;
  const nome = ALIASES_VARIAVEIS[marcador.nome] ?? marcador.nome;
  if (marcador.parametro) return NOMES_COM_PARAMETRO.has(nome);
  return NOMES_SIMPLES.has(nome);
}

/** Marcadores que o sistema não reconhece (serve para validar ao salvar e para a pré-visualização). */
export function marcadoresDesconhecidos(texto: string): string[] {
  return [...new Set(extrairMarcadores(texto).filter((m) => !marcadorConhecido(m)).map((m) => m.bruto))];
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

export function formatarMoeda(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '';
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '';
  return `R$ ${numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Telefone para exibição: BR no formato (DD) 9 XXXX-XXXX; outros países, +dígitos. */
export function formatarTelefoneExibicao(bruto: string | null | undefined, codigoPais = '55'): string {
  const digitos = String(bruto ?? '').split('@')[0].replace(/\D/g, '');
  if (!digitos) return '';
  if (codigoPais === '55') {
    const m13 = digitos.match(/^55(\d{2})(\d)(\d{4})(\d{4})$/);
    if (m13) return `(${m13[1]}) ${m13[2]} ${m13[3]}-${m13[4]}`;
    const m12 = digitos.match(/^55(\d{2})(\d{4})(\d{4})$/);
    if (m12) return `(${m12[1]}) ${m12[2]}-${m12[3]}`;
    return digitos;
  }
  return `+${digitos}`;
}

function limpar(valor: unknown, limite = 160): string {
  return String(valor ?? '')
    .replace(/[{}]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limite);
}

const minutosDe = (hhmm: string | null | undefined, padrao: number): number => {
  const m = String(hhmm ?? '').match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : padrao;
};

export function saudacaoPara(minutoDoDia: number, empresa: ConfigEmpresa): string {
  const bomDia = minutosDe(empresa.saudacao_bom_dia_inicio, 7 * 60);
  const boaTarde = minutosDe(empresa.saudacao_boa_tarde_inicio, 12 * 60);
  const boaNoite = minutosDe(empresa.saudacao_boa_noite_inicio, 18 * 60);
  if (minutoDoDia >= boaNoite || minutoDoDia < bomDia) return 'boa noite';
  if (minutoDoDia >= boaTarde) return 'boa tarde';
  return 'bom dia';
}

/** Janela que pode atravessar a meia-noite (ex.: 23:00–07:00). */
export function dentroDaJanela(minutoDoDia: number, inicio: string | null | undefined, fim: string | null | undefined): boolean {
  if (!inicio || !fim) return false;
  const a = minutosDe(inicio, -1);
  const b = minutosDe(fim, -1);
  if (a < 0 || b < 0 || a === b) return false;
  return a < b ? minutoDoDia >= a && minutoDoDia < b : minutoDoDia >= a || minutoDoDia < b;
}

const DIAS_CURTOS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const capitalizar = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

/** "segunda a quinta", "sexta", "terça e quinta", "segunda, quarta e sexta". */
export function descreverDias(dias: number[]): string {
  const ordenados = [...new Set(dias)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  if (!ordenados.length) return '';
  const blocos: number[][] = [];
  for (const dia of ordenados) {
    const ultimo = blocos.at(-1);
    if (ultimo && dia === ultimo.at(-1)! + 1) ultimo.push(dia);
    else blocos.push([dia]);
  }
  const partes = blocos.flatMap((bloco) => {
    if (bloco.length >= 3) return [`${DIAS_CURTOS[bloco[0]]} a ${DIAS_CURTOS[bloco.at(-1)!]}`];
    return bloco.map((dia) => DIAS_CURTOS[dia]);
  });
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(', ')} e ${partes.at(-1)}`;
}

export function textoHorarioFuncionamento(faixas: HorarioFuncionamento[] | null | undefined): string {
  const validas = (faixas ?? []).filter((f) => Array.isArray(f.dias) && f.dias.length && f.abre && f.fecha);
  if (!validas.length) return '';
  const linhas = validas.map((f) => `${capitalizar(descreverDias(f.dias))}: ${f.abre.slice(0, 5)} às ${f.fecha.slice(0, 5)}`);
  const cobertos = new Set(validas.flatMap((f) => f.dias));
  const fechados = [0, 1, 2, 3, 4, 5, 6].filter((d) => !cobertos.has(d));
  if (fechados.length) linhas.push(`${capitalizar(descreverDias(fechados))}: fechado`);
  return linhas.join('\n');
}

const ROTULO_GRUPO: Array<{ quem: QuemAgenda; titulo: string }> = [
  { quem: 'assistente', titulo: 'Agendados por você (use a ferramenta func_agenda)' },
  { quem: 'recepcao', titulo: 'Agendados SOMENTE pela recepção humana (não agende; explique e ofereça encaminhar)' },
  { quem: 'sem_agendamento', titulo: 'Atendidos sem agendamento' },
  { quem: 'nao_oferece', titulo: 'NÃO oferecidos pela empresa (informe com gentileza)' },
];

function linhaServico(servico: ServicoCatalogo, comGrupo = false): string {
  const preco = formatarMoeda(servico.preco);
  const partes = [
    preco ? `${servico.nome}: ${preco}${servico.preco_observacao ? ` (${servico.preco_observacao})` : ''}` : servico.nome,
    servico.descricao?.trim() ? servico.descricao.trim() : '',
    servico.exige_requisicao ? 'exige requisição ou encaminhamento veterinário' : '',
    servico.aceita_plano === true ? 'aceita plano/convênio' : servico.aceita_plano === false ? 'não atendido por plano/convênio' : '',
    servico.observacoes?.trim() ? servico.observacoes.trim() : '',
    comGrupo && servico.quem_agenda === 'recepcao' ? 'agendamento só pela recepção' : '',
  ].filter(Boolean);
  return partes.join(' — ');
}

export function textoCatalogo(servicos: ServicoCatalogo[]): string {
  const ativos = servicos.filter((s) => s.ativo !== false).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome));
  if (!ativos.length) return '';
  const blocos = ROTULO_GRUPO.map(({ quem, titulo }) => {
    const itens = ativos.filter((s) => s.quem_agenda === quem);
    return itens.length ? `${titulo}:\n${itens.map((s) => `- ${linhaServico(s)}`).join('\n')}` : '';
  }).filter(Boolean);
  return [
    'Catálogo de serviços e valores (valores de atendimento particular; nunca cite preço que não esteja aqui):',
    ...blocos,
  ].join('\n\n');
}

// ---------------------------------------------------------------------------
// Resolução
// ---------------------------------------------------------------------------

function valorSimples(nome: string, ctx: ContextoPrompt): string | undefined {
  const { empresa, cliente } = ctx;
  const fuso = empresa.fuso_horario || 'America/Sao_Paulo';
  const agora = partesNoFuso(ctx.agora, fuso);
  const amanha = somarDias(agora.dataKey, 1);
  const semana = somarDias(agora.dataKey, 7);
  const br = (chave: string) => chave.split('-').reverse().join('/');
  const minuto = agora.hora * 60 + agora.minuto;
  const pais = empresa.codigo_pais || '55';
  const naoInformado = 'não informado';
  switch (nome) {
    case 'data_hoje': return br(agora.dataKey);
    case 'data_hoje_extenso': return `${nomeDiaSemana(diaDaSemana(agora.dataKey))}, ${br(agora.dataKey)}`;
    case 'dia_semana': return nomeDiaSemana(diaDaSemana(agora.dataKey));
    case 'hora_atual': return `${String(agora.hora).padStart(2, '0')}:${String(agora.minuto).padStart(2, '0')}`;
    case 'data_amanha': return br(amanha);
    case 'dia_semana_amanha': return nomeDiaSemana(diaDaSemana(amanha));
    case 'data_daqui_uma_semana': return br(semana);
    case 'fuso_horario': return fuso;
    case 'saudacao': return saudacaoPara(minuto, empresa);
    case 'aviso_fora_horario':
      return dentroDaJanela(minuto, empresa.aviso_fora_horario_inicio ?? '23:00', empresa.aviso_fora_horario_fim ?? '07:00')
        ? (empresa.aviso_fora_horario_texto ?? '').trim()
        : '';
    case 'nome_empresa': return limpar(empresa.nome_empresa, 120);
    case 'nome_assistente': return limpar(empresa.nome_assistente, 60);
    case 'telefone_contato': return limpar(empresa.telefone_contato, 40);
    case 'endereco': return (empresa.endereco ?? '').trim();
    case 'site': return limpar(empresa.site, 120);
    case 'instagram': return limpar(empresa.instagram, 80);
    case 'email_contato': return limpar(empresa.email_contato, 120);
    case 'chave_pix': return limpar(empresa.chave_pix, 160);
    case 'planos_aceitos': return (empresa.planos_aceitos ?? []).map((p) => limpar(p, 80)).filter(Boolean).join(', ');
    case 'frase_encerramento': return limpar(empresa.frase_encerramento, 200);
    case 'estilo_comunicacao': return limpar(empresa.estilo_comunicacao, 120) || 'Cordial e objetivo';
    case 'horario_funcionamento': return textoHorarioFuncionamento(empresa.horario_funcionamento);
    case 'lista_especialidades': return ctx.tipos.map((t) => t.nome).join(', ');
    case 'cliente_nome': return limpar(cliente.nome || cliente.nomeWhatsapp, 80) || naoInformado;
    case 'cliente_nome_whatsapp': return limpar(cliente.nomeWhatsapp, 80) || naoInformado;
    case 'cliente_email': return limpar(cliente.email, 120) || naoInformado;
    case 'cliente_telefone': return formatarTelefoneExibicao(cliente.telefone, pais) || naoInformado;
    case 'pet_nome': return limpar(cliente.petNome, 80) || naoInformado;
    case 'pet_raca': return limpar(cliente.petRaca, 80) || naoInformado;
    case 'pet_porte': return limpar(cliente.petPorte, 40) || naoInformado;
    case 'catalogo_servicos': return textoCatalogo(ctx.servicos);
    default: return undefined;
  }
}

function valorComParametro(nome: string, parametro: string, ctx: ContextoPrompt): string | undefined {
  if (nome === 'horarios') return ctx.horariosPorTipo[parametro];
  const servico = ctx.servicos.find((s) => s.chave === parametro && s.ativo !== false);
  if (!servico) return undefined;
  if (nome === 'preco') return formatarMoeda(servico.preco) || '';
  if (nome === 'servico') return linhaServico(servico);
  return undefined;
}

export interface ResultadoRenderizacao {
  texto: string;
  desconhecidas: string[];
}

export function renderizarPrompt(modelo: string, ctx: ContextoPrompt): ResultadoRenderizacao {
  const desconhecidas = new Set<string>();
  const texto = modelo.replace(MARCADOR, (bruto: string, conteudo: string) => {
    const limpo = conteudo.trim();
    if (!NOME_VALIDO.test(limpo)) {
      desconhecidas.add(bruto);
      return '';
    }
    const [nomeBruto, parametro] = limpo.split(':');
    const nome = ALIASES_VARIAVEIS[nomeBruto] ?? nomeBruto;
    const valor = parametro ? valorComParametro(nome, parametro, ctx) : valorSimples(nome, ctx);
    if (valor === undefined) {
      desconhecidas.add(bruto);
      return '';
    }
    return valor;
  });
  return { texto, desconhecidas: [...desconhecidas] };
}
