import type { QueuePriority } from '@/types/vetbotsModules';

export type TvLayout = 'lateral' | 'tela_cheia' | 'video_16_9';

export const TV_LAYOUT_LABEL: Record<TvLayout, string> = {
  lateral: 'Vídeo + painel',
  tela_cheia: 'Vídeo em tela cheia',
  video_16_9: 'Vídeo pequeno e senha gigante',
};

export const TV_LAYOUT_DESCRICAO: Record<TvLayout, string> = {
  lateral: 'Vídeo à esquerda; senha atual, chamadas recentes e próximos à direita.',
  tela_cheia: 'O vídeo ocupa tudo; ao chamar alguém, o aviso grande assume a tela por alguns segundos.',
  video_16_9: 'Vídeo pequeno no canto e a senha com contraste máximo ocupando a tela.',
};

/** Configuração da fila (tabela fila_config), já em camelCase. */
export interface FilaConfig {
  nomeExibicao: string | null;
  subtitulo: string;
  corMarca: string;
  logoPath: string | null;
  tvSom: boolean;
  tvPrivacidade: boolean;
  tvLayout: TvLayout;
  tvVideoMudo: boolean;
  tvAvisoSegundos: number;
  /** Mostra o primeiro nome do tutor na TV pública (padrão: não). */
  tvMostrarTutor: boolean;
  cupomLarguraMm: '58' | '80';
  cupomRodape: string;
  cupomLogo: boolean;
  numeracaoDiaria: boolean;
  fusoHorario: string;
  totemPedeTelefone: boolean;
  whatsappAtivo: boolean;
  /** Só avisa quem já conversou com a clínica no WhatsApp (padrão: sim). */
  wppSomenteConhecidos: boolean;
  wppAvisarEmissao: boolean;
  wppAvisarProximo: number;
  wppAvisarChamada: boolean;
  wppAvisarAusente: boolean;
  wppMsgEmissao: string;
  wppMsgProximo: string;
  wppMsgChamada: string;
  wppMsgAusente: string;
}

export const FILA_CONFIG_PADRAO: FilaConfig = {
  nomeExibicao: null,
  subtitulo: 'Painel de Atendimento Presencial',
  corMarca: '#2294aa',
  logoPath: null,
  tvSom: true,
  tvPrivacidade: false,
  tvLayout: 'lateral',
  tvVideoMudo: true,
  tvAvisoSegundos: 12,
  tvMostrarTutor: false,
  cupomLarguraMm: '58',
  cupomRodape: 'Acompanhe pelo telão da sala de espera.',
  cupomLogo: true,
  numeracaoDiaria: true,
  fusoHorario: 'America/Sao_Paulo',
  totemPedeTelefone: false,
  whatsappAtivo: false,
  wppSomenteConhecidos: true,
  wppAvisarEmissao: true,
  wppAvisarProximo: 2,
  wppAvisarChamada: true,
  wppAvisarAusente: false,
  wppMsgEmissao: '',
  wppMsgProximo: '',
  wppMsgChamada: '',
  wppMsgAusente: '',
};

/** Vídeo da playlist da TV (tabela fila_midias). */
export interface FilaMidia {
  id: string;
  nome: string;
  arquivoPath: string | null;
  urlExterna: string | null;
  tamanhoBytes: number;
  ordem: number;
  ativo: boolean;
}

/** Linha de mídia entregue à TV pelo RPC público (já com a URL final). */
export interface TvMidia {
  id: string;
  nome: string;
  url: string;
  tamanhoBytes?: number;
}

export interface TvChamada {
  id: string;
  senha: string;
  sala: string | null;
  chamado_em: string | null;
  prioridade?: QueuePriority;
  pet?: string | null;
  tutor?: string | null;
  veterinario?: string | null;
}

/** Resposta de fila_tv_painel(): tudo o que a TV precisa, sem dados pessoais quando há privacidade. */
export interface TvPainel {
  config: {
    nome: string;
    subtitulo: string;
    cor_marca: string;
    logo_path: string | null;
    tv_som: boolean;
    tv_privacidade: boolean;
    tv_layout: TvLayout;
    tv_video_mudo: boolean;
    tv_aviso_segundos: number;
  };
  atual: TvChamada | null;
  recentes: TvChamada[];
  proximos: Array<{ id: string; senha: string; prioridade: QueuePriority; pet: string | null }>;
  aguardando: number;
  midias: Array<{ id: string; nome: string; path: string | null; url: string | null; tamanho: number }>;
  agora: string;
}

/** Variáveis aceitas nos modelos de mensagem de WhatsApp. */
export const WPP_VARIAVEIS: Array<{ chave: string; exemplo: string; descricao: string }> = [
  { chave: '{{senha}}', exemplo: 'A014', descricao: 'Senha do paciente' },
  { chave: '{{tutor}}', exemplo: 'Carlos', descricao: 'Primeiro nome do tutor' },
  { chave: '{{pet}}', exemplo: 'Thor', descricao: 'Nome do pet' },
  { chave: '{{pet_ou_tutor}}', exemplo: 'Thor', descricao: 'Pet; se vazio, o tutor' },
  { chave: '{{servico}}', exemplo: 'Consulta', descricao: 'Tipo de atendimento' },
  { chave: '{{sala}}', exemplo: 'Consultório 2', descricao: 'Sala da chamada' },
  { chave: '{{clinica}}', exemplo: 'Clínica Exemplo', descricao: 'Nome da clínica' },
  { chave: '{{a_frente}}', exemplo: '2', descricao: 'Pessoas à frente na espera' },
];
