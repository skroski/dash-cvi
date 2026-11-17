export const MODELO_COPILOTO_FIXO = 'gpt-5.4-nano' as const;

export type ModeloCopilotoFixo = typeof MODELO_COPILOTO_FIXO;

export interface ContextoOperacionalSnapshot {
  atualizado_em: string;
  modelo_copiloto: ModeloCopilotoFixo;
  empresa: {
    nome_empresa: string;
    nome_assistente: string;
    telefone_contato: string;
    endereco: string;
    fuso_horario: string;
    planos_aceitos: string[];
  };
  clientes: {
    total_clientes: number;
    total_pets: number;
    novos_clientes_mes: number;
    ultimos_clientes: Array<{
      nome: string;
      nome_pet: string;
      created_at?: string;
    }>;
  };
  atendimento: {
    conversas_abertas: number;
    conversas_hoje: number;
    pausadas_humano: number;
    atendentes_ativos: number;
  };
  agenda: {
    agendamentos_hoje: number;
    agendamentos_proximos_7d: number;
    especialidades_ativas: string[];
    profissionais_ativos: string[];
    proximos_agendamentos: Array<{
      titulo: string;
      cliente_nome: string;
      pet_nome: string;
      inicio: string;
    }>;
  };
  lembretes: {
    agendados: number;
    enviados_hoje: number;
    confirmados: number;
    cancelados: number;
  };
  pipelines: {
    total_pipelines: number;
    total_cards: number;
    cards_urgentes: number;
    valor_aberto: number;
  };
  fila_presencial: {
    aguardando: number;
    em_atendimento: number;
    atendidos_hoje: number;
  };
  prompt_ia: {
    versao_ativa: number;
    regras_ativas: number;
    total_regras: number;
  };
  satisfacao: {
    total_avaliacoes: number;
    media_nota: number;
  };
}

export interface AtalhoRotaCopiloto {
  label: string;
  url: string;
}

export interface MensagemCopiloto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  rotaContexto: string;
  modelo: ModeloCopilotoFixo;
  origemMotor: 'openai_gpt_5_4_nano' | 'copiloto_deterministico';
  tempoMs?: number;
  atalhosRota?: AtalhoRotaCopiloto[];
}

export interface SugestaoCopiloto {
  id: string;
  titulo: string;
  pergunta: string;
  categoria: 'operacao' | 'tela_atual' | 'sistema';
}

export interface ModuloManualSistema {
  url: string;
  titulo: string;
  resumo: string;
  comoUsar: string[];
  dicasOperacionais: string[];
  palavrasChave: string[];
}
