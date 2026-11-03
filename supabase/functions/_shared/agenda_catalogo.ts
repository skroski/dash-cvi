/**
 * Catálogo de tipos de agendamento configurável: resolve aliases, durações,
 * operações permitidas e monta a ferramenta/contexto enviados ao modelo.
 * Hierarquia: agenda (profissional x tipo) > tipo > padrões do sistema.
 */
export type Operacao = 'buscar' | 'agendar' | 'reagendar' | 'cancelar';
export const OPERACOES: Operacao[] = ['buscar', 'agendar', 'reagendar', 'cancelar'];
/** Ações da ferramenta func_agenda ("listar" mostra os agendamentos do próprio cliente). */
export const FUNCOES_AGENDA = [...OPERACOES, 'listar'] as const;
/** Dados que o tipo pode exigir antes de agendar ("titulo" e "descricao" são legados: o evento usa modelos). */
export const CAMPOS_OBRIGATORIOS_VALIDOS = ['email', 'nome_cliente', 'nome_pet', 'raca_pet', 'porte_pet', 'titulo', 'descricao'] as const;

export const TITULO_EVENTO_PADRAO = '{{servico}} para {{pet_nome}} | Tutor: {{cliente_nome}} | Telefone: {{cliente_telefone}}';
export const DESCRICAO_EVENTO_PADRAO =
  'Agendado pelo assistente virtual de {{nome_empresa}}.\nEm caso de cancelamento ou remarcação, avise com antecedência.';
export const MENSAGEM_EQUIPE_PADRAO =
  'Este agendamento foi feito pela equipe. Vou encaminhar para a recepção realizar a alteração.';

export interface RegraAgenda {
  id: string;
  profissional_id: string;
  profissional_nome: string;
  profissional_unidade?: string | null;
  profissional_email?: string | null;
  convidar_profissional?: boolean | null;
  calendario_id?: string | null;
  calendario_secret_key?: string | null;
  nome_exibicao?: string | null;
  duracao_padrao_minutos?: number | null;
  duracao_retorno_minutos?: number | null;
  intervalo_slots_minutos?: number | null;
  operacoes_permitidas?: string[] | null;
  instrucoes_prompt?: string | null;
  antecedencia_minima_minutos?: number | null;
  capacidade_simultanea?: number | null;
  max_pets_por_agendamento?: number | null;
  titulo_evento_modelo?: string | null;
  descricao_evento_modelo?: string | null;
  local_evento?: string | null;
}

export interface TipoAgenda {
  id?: string;
  chave: string;
  nome: string;
  aliases: string[];
  duracao_padrao_minutos: number;
  duracao_retorno_minutos: number;
  intervalo_slots_minutos: number;
  operacoes_permitidas: string[];
  campos_obrigatorios: string[];
  instrucoes_prompt?: string | null;
  antecedencia_minima_minutos: number;
  busca_horizonte_dias: number;
  busca_max_dias_com_vaga: number;
  busca_max_horarios_por_dia: number;
  busca_apresentar_max_datas: number;
  busca_apresentar_max_horarios: number;
  busca_ordem: 'proximos' | 'em_torno_da_data';
  max_pets_por_agendamento: number;
  capacidade_simultanea: number;
  titulo_evento_modelo?: string | null;
  descricao_evento_modelo?: string | null;
  local_evento?: string | null;
  enviar_convite_cliente: boolean;
  mensagem_agendamento_equipe?: string | null;
  tag_id?: number | null;
  /** Valor particular vindo do catálogo de serviços ligado a este tipo (se houver). */
  valor_particular?: number | null;
  regras: RegraAgenda[];
}

const semAcento = (valor: unknown) =>
  String(valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Chave canônica do tipo a partir do que o modelo/cliente escreveu. */
export function resolverTipo(bruto: unknown, tipos: TipoAgenda[]): TipoAgenda | undefined {
  const alvo = semAcento(bruto);
  if (!alvo) return undefined;
  return tipos.find((tipo) => semAcento(tipo.chave) === alvo) ??
    tipos.find((tipo) => semAcento(tipo.nome) === alvo) ??
    tipos.find((tipo) => tipo.aliases.some((alias) => semAcento(alias) === alvo));
}

export function resolverRegra(tipo: TipoAgenda, profissional: unknown): RegraAgenda | undefined {
  const alvo = semAcento(profissional);
  if (!alvo) return undefined;
  return tipo.regras.find((regra) => regra.id === alvo || regra.profissional_id === alvo) ??
    tipo.regras.find((regra) => semAcento(regra.profissional_nome) === alvo) ??
    tipo.regras.find((regra) => semAcento(regra.nome_exibicao) === alvo) ??
    tipo.regras.find((regra) => semAcento(regra.profissional_nome).includes(alvo));
}

const limitar = (valor: number, min = 5, max = 480) => Math.max(min, Math.min(Math.round(valor), max));

export function duracaoPara(
  tipo: TipoAgenda,
  regra: RegraAgenda | undefined,
  opcoes: { retorno?: boolean; solicitada?: unknown } = {},
): number {
  const pedida = Number(opcoes.solicitada);
  if (Number.isFinite(pedida) && pedida > 0) return limitar(pedida);
  if (opcoes.retorno) return limitar(regra?.duracao_retorno_minutos ?? tipo.duracao_retorno_minutos);
  return limitar(regra?.duracao_padrao_minutos ?? tipo.duracao_padrao_minutos);
}

export function intervaloSlots(tipo: TipoAgenda, regra?: RegraAgenda): number {
  return limitar(regra?.intervalo_slots_minutos ?? tipo.intervalo_slots_minutos, 5, 240);
}

export function operacoesDe(tipo: TipoAgenda, regra?: RegraAgenda): string[] {
  return regra?.operacoes_permitidas ?? tipo.operacoes_permitidas;
}

export function operacaoPermitida(tipo: TipoAgenda, regra: RegraAgenda | undefined, operacao: string): boolean {
  return operacoesDe(tipo, regra).includes(operacao);
}

/** O assistente pode usar este tipo? (alguma agenda do tipo permite ao menos uma operação) */
export function tipoDisponivelParaAssistente(tipo: TipoAgenda): boolean {
  return tipo.regras.some((regra) => operacoesDe(tipo, regra).length > 0);
}

export interface ParametrosAgenda {
  duracao: number;
  passo: number;
  antecedenciaMin: number;
  capacidade: number;
  maxPets: number;
  tituloModelo: string;
  descricaoModelo: string;
  local: string;
}

/** Valores efetivos (agenda > tipo > padrão do sistema). */
export function parametrosEfetivos(
  tipo: TipoAgenda,
  regra: RegraAgenda | undefined,
  opcoes: { retorno?: boolean; duracaoSolicitada?: unknown } = {},
): ParametrosAgenda {
  return {
    duracao: duracaoPara(tipo, regra, { retorno: opcoes.retorno, solicitada: opcoes.duracaoSolicitada }),
    passo: intervaloSlots(tipo, regra),
    antecedenciaMin: Math.max(0, regra?.antecedencia_minima_minutos ?? tipo.antecedencia_minima_minutos ?? 0),
    capacidade: Math.max(1, regra?.capacidade_simultanea ?? tipo.capacidade_simultanea ?? 1),
    maxPets: Math.max(1, regra?.max_pets_por_agendamento ?? tipo.max_pets_por_agendamento ?? 1),
    tituloModelo: regra?.titulo_evento_modelo?.trim() || tipo.titulo_evento_modelo?.trim() || TITULO_EVENTO_PADRAO,
    descricaoModelo: regra?.descricao_evento_modelo?.trim() || tipo.descricao_evento_modelo?.trim() || DESCRICAO_EVENTO_PADRAO,
    local: regra?.local_evento?.trim() || tipo.local_evento?.trim() || '',
  };
}

export function camposFaltando(tipo: TipoAgenda, dados: Record<string, unknown>): string[] {
  return tipo.campos_obrigatorios.filter((campo) => !String(dados[campo] ?? '').trim());
}

/** Instrução de apresentação devolvida junto com os horários (substitui a regra fixa do n8n). */
export function instrucaoApresentacao(tipo: TipoAgenda): string {
  return `Conheça todos os horários, mas mostre ao cliente no máximo ${tipo.busca_apresentar_max_datas} data(s) com até ${tipo.busca_apresentar_max_horarios} horários por data, escolhendo os que melhor atendem ao pedido do cliente. Não omita que existem outras opções se ele quiser ver mais.`;
}

/** Definição da ferramenta func_agenda cujo enum de serviço vem dos tipos que o assistente pode usar. */
export function montarFerramentaAgenda(tipos: TipoAgenda[]) {
  const usaveis = tipos.filter(tipoDisponivelParaAssistente);
  const chaves = usaveis.map((tipo) => tipo.chave);
  const profissionais = [...new Set(usaveis.flatMap((tipo) => tipo.regras.map((regra) => regra.nome_exibicao || regra.profissional_nome)))];
  const maxPets = Math.max(1, ...usaveis.map((tipo) => tipo.max_pets_por_agendamento));
  return {
    type: 'function',
    function: {
      name: 'func_agenda',
      description:
        'Única fonte de horários e ações de agenda. Funcao: buscar (horários livres), agendar, reagendar, cancelar, listar (agendamentos do cliente). Nunca invente horários nem diga que algo foi agendado antes do retorno de sucesso.',
      parameters: {
        type: 'object',
        properties: {
          Funcao: { type: 'string', enum: [...FUNCOES_AGENDA] },
          servico: chaves.length
            ? { type: 'string', enum: chaves, description: 'Serviço (chave exata da lista de agendas configuradas). Obrigatório, exceto em listar.' }
            : { type: 'string', description: 'Serviço (obrigatório, exceto em listar).' },
          profissional: {
            type: 'string',
            description: profissionais.length
              ? `Profissional da agenda, quando o cliente tiver preferência ou ao agendar o horário que a busca atribuiu a um profissional. Opções: ${profissionais.join(', ')}.`
              : 'Profissional da agenda, quando houver mais de um.',
          },
          date_start: {
            type: 'string',
            description:
              'buscar: data desejada (AAAA-MM-DD) ou data e hora (AAAA-MM-DDTHH:mm:ss); vazio = próximos horários livres. agendar/reagendar: o horário escolhido, EXATAMENTE como veio na busca.',
          },
          data_antiga: {
            type: 'string',
            description: 'reagendar/cancelar: data e hora (AAAA-MM-DDTHH:mm:ss) do agendamento atual do cliente.',
          },
          retorno: { type: 'boolean', description: 'true quando for um retorno (usa a duração de retorno do serviço).' },
          duracao_minutos: { type: 'number', description: 'Somente se o cliente exigir uma duração diferente da padrão.' },
          nome_cliente: { type: 'string', description: 'Nome do tutor (se ainda não estiver no cadastro).' },
          nome_pet: {
            type: 'string',
            description: maxPets > 1
              ? `Nome do pet. Para mais de um pet no mesmo horário, separe por vírgula (limite por serviço: ver agendas configuradas).`
              : 'Nome do pet.',
          },
          email: { type: 'string', description: 'E-mail do cliente (convite do agendamento).' },
          observacao: { type: 'string', description: 'Observação curta para a equipe (opcional).' },
        },
        required: ['Funcao'],
        additionalProperties: false,
      },
    },
  };
}

/** Texto anexado ao prompt de sistema descrevendo os serviços e instruções de cada um. */
export function montarContextoAgenda(tipos: TipoAgenda[]): string {
  const usaveis = tipos.filter(tipoDisponivelParaAssistente);
  if (!usaveis.length) return '';
  const linhas = usaveis.map((tipo) => {
    const profs = tipo.regras.map((regra) => regra.nome_exibicao || regra.profissional_nome).filter(Boolean);
    const partes = [
      `- ${tipo.chave} (${tipo.nome}): ${tipo.duracao_padrao_minutos} min, retorno ${tipo.duracao_retorno_minutos} min`,
      profs.length ? `profissionais: ${profs.join(', ')}` : '',
      tipo.campos_obrigatorios.length ? `dados obrigatórios para agendar: ${tipo.campos_obrigatorios.join(', ')}` : '',
      tipo.operacoes_permitidas.length < OPERACOES.length ? `operações permitidas: ${tipo.operacoes_permitidas.join(', ')}` : '',
      tipo.max_pets_por_agendamento > 1 ? `até ${tipo.max_pets_por_agendamento} pets no mesmo agendamento` : 'um pet por agendamento (para mais pets, faça um agendamento para cada)',
    ].filter(Boolean).join('; ');
    const extras = [tipo.instrucoes_prompt, ...tipo.regras.map((regra) => regra.instrucoes_prompt)]
      .map((texto) => String(texto ?? '').trim()).filter(Boolean);
    return extras.length ? `${partes}\n  Instruções: ${extras.join(' | ')}` : partes;
  });
  return `Agendas configuradas (use exatamente estas chaves em func_agenda.servico):\n${linhas.join('\n')}`;
}

/** Linhas cruas (Supabase) -> catálogo tipado. */
export function montarCatalogo(
  tipos: Array<Record<string, unknown>>,
  regras: Array<Record<string, unknown>>,
  profissionais: Array<Record<string, unknown>>,
  servicos: Array<Record<string, unknown>> = [],
): TipoAgenda[] {
  const prof = new Map(profissionais.map((item) => [String(item.id), item]));
  const numero = (valor: unknown, padrao: number) => (Number.isFinite(Number(valor)) && valor !== null && valor !== '' ? Number(valor) : padrao);
  const texto = (valor: unknown) => (typeof valor === 'string' && valor.trim() ? valor : null);
  const catalogo = tipos.map((tipo): TipoAgenda => {
    // Só há "valor particular do tipo" quando exatamente um serviço com preço está ligado a ele
    // (vários valores, como as vacinas, são citados pelo catálogo, não pela ferramenta).
    const precificados = servicos.filter((s) => s.tipo_agenda_id === tipo.id && s.ativo !== false && s.preco != null);
    const preco = precificados.length === 1 ? precificados[0] : undefined;
    return {
      id: tipo.id ? String(tipo.id) : undefined,
      chave: String(tipo.chave),
      nome: String(tipo.nome ?? tipo.chave),
      aliases: Array.isArray(tipo.aliases) ? (tipo.aliases as unknown[]).map(String) : [],
      duracao_padrao_minutos: numero(tipo.duracao_padrao_minutos, 60),
      duracao_retorno_minutos: numero(tipo.duracao_retorno_minutos, 30),
      intervalo_slots_minutos: numero(tipo.intervalo_slots_minutos, 30),
      operacoes_permitidas: Array.isArray(tipo.operacoes_permitidas) ? (tipo.operacoes_permitidas as unknown[]).map(String) : [...OPERACOES],
      campos_obrigatorios: Array.isArray(tipo.campos_obrigatorios) ? (tipo.campos_obrigatorios as unknown[]).map(String) : [],
      instrucoes_prompt: (tipo.instrucoes_prompt as string | null) ?? null,
      antecedencia_minima_minutos: numero(tipo.antecedencia_minima_minutos, 0),
      busca_horizonte_dias: numero(tipo.busca_horizonte_dias, 20),
      busca_max_dias_com_vaga: numero(tipo.busca_max_dias_com_vaga, 10),
      busca_max_horarios_por_dia: numero(tipo.busca_max_horarios_por_dia, 30),
      busca_apresentar_max_datas: numero(tipo.busca_apresentar_max_datas, 2),
      busca_apresentar_max_horarios: numero(tipo.busca_apresentar_max_horarios, 4),
      busca_ordem: tipo.busca_ordem === 'em_torno_da_data' ? 'em_torno_da_data' : 'proximos',
      max_pets_por_agendamento: numero(tipo.max_pets_por_agendamento, 1),
      capacidade_simultanea: numero(tipo.capacidade_simultanea, 1),
      titulo_evento_modelo: texto(tipo.titulo_evento_modelo),
      descricao_evento_modelo: texto(tipo.descricao_evento_modelo),
      local_evento: texto(tipo.local_evento),
      enviar_convite_cliente: tipo.enviar_convite_cliente !== false,
      mensagem_agendamento_equipe: texto(tipo.mensagem_agendamento_equipe),
      tag_id: tipo.tag_id == null ? null : Number(tipo.tag_id),
      valor_particular: preco ? Number(preco.preco) : null,
      regras: regras
        .filter((regra) => regra.especialidade_id === tipo.id)
        .map((regra): RegraAgenda => {
          const p = prof.get(String(regra.profissional_id));
          const calendario = regra.calendario as { secret_key?: string } | null | undefined;
          return {
            id: String(regra.id),
            profissional_id: String(regra.profissional_id),
            profissional_nome: String(p?.nome ?? ''),
            profissional_unidade: (p?.unidade as string | null) ?? null,
            profissional_email: (p?.email as string | null) ?? null,
            convidar_profissional: Boolean(p?.convidar_por_email),
            calendario_id: (regra.calendario_id as string | null) ?? null,
            calendario_secret_key: calendario?.secret_key ?? null,
            nome_exibicao: (regra.nome_exibicao as string | null) ?? null,
            duracao_padrao_minutos: (regra.duracao_padrao_minutos as number | null) ?? null,
            duracao_retorno_minutos: (regra.duracao_retorno_minutos as number | null) ?? null,
            intervalo_slots_minutos: (regra.intervalo_slots_minutos as number | null) ?? null,
            operacoes_permitidas: (regra.operacoes_permitidas as string[] | null) ?? null,
            instrucoes_prompt: (regra.instrucoes_prompt as string | null) ?? null,
            antecedencia_minima_minutos: (regra.antecedencia_minima_minutos as number | null) ?? null,
            capacidade_simultanea: (regra.capacidade_simultanea as number | null) ?? null,
            max_pets_por_agendamento: (regra.max_pets_por_agendamento as number | null) ?? null,
            titulo_evento_modelo: (regra.titulo_evento_modelo as string | null) ?? null,
            descricao_evento_modelo: (regra.descricao_evento_modelo as string | null) ?? null,
            local_evento: (regra.local_evento as string | null) ?? null,
          };
        }),
    };
  });
  // Tipo sem nenhuma agenda ativa (recém-criado, ainda em teste) não é oferecido ao assistente.
  return catalogo.filter((tipo) => tipo.regras.length > 0);
}
