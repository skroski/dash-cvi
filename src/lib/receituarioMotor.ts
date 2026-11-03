/**
 * Motor Posológico, Bulário Determinístico (Hard Rules Validation) e Gerador de Cronograma Visual
 * do Módulo de Receituário Inteligente com IA (PRD V1 - RF-01 a RF-08 e Seção 8.1/9).
 *
 * Funções puras compatíveis com navegador, Node test runner e Deno Edge Functions.
 */

export type EspeciePaciente = 'canina' | 'felina' | 'silvestre';
export type ViaAdministracao = 'oral' | 'topica' | 'otica' | 'oftalmica' | 'injetavel' | 'inalatoria';
export type CondicaoAlimentar = 'com_alimento' | 'jejum' | 'livre' | 'uso_externo';
export type NivelAlertaSeguranca = 'baixo' | 'medio' | 'alto' | 'critico';
export type CorSemanticaAlerta = 'verde' | 'amarelo' | 'vermelho';
export type VeiculoManipulado =
  | 'biscoito_palatavel'
  | 'pasta_oral'
  | 'suspensao_oral'
  | 'capsula_gastro'
  | 'gel_transdermico'
  | 'solucao_otologica';

export interface PacienteContexto {
  id?: string | null;
  cliente_id?: number | null;
  tutor_nome: string;
  tutor_telefone?: string | null;
  nome: string;
  especie: EspeciePaciente;
  raca?: string | null;
  sexo?: 'macho' | 'femea' | 'indefinido';
  castrado?: boolean;
  idade_texto?: string | null;
  peso_kg: number;
  mutacao_mdr1?: boolean;
  comorbidades?: string[];
  alergias?: string[];
  observacoes?: string | null;
}

export interface ApresentacaoComercial {
  rotulo: string;
  forma: 'comprimido' | 'suspensao_ml' | 'gotas' | 'gotas_otologicas' | 'pipeta_topica' | 'manipulado';
  concentracao_mg?: number;
  concentracao_mg_ml?: number;
  concentracao_mg_gota?: number;
  divisivel?: boolean;
}

export interface RegraBulario {
  slug: string;
  principio_ativo: string;
  nome_comercial_sugerido: string;
  classe_terapeutica: string;
  tipo_padrao: 'industrializado' | 'manipulado';
  icone_via: ViaAdministracao;
  especies_permitidas: EspeciePaciente[];
  especies_contraindicadas: EspeciePaciente[];
  motivo_contraindicacao_especie?: string | null;
  risco_mdr1: boolean;
  mensagem_mdr1?: string | null;
  dose_padrao_mg_kg: number;
  dose_min_mg_kg: number;
  dose_max_mg_kg: number;
  dose_toxica_mg_kg?: number | null;
  dose_felina_max_mg_kg?: number | null;
  alerta_felino_especifico?: string | null;
  frequencia_horas_padrao: number;
  duracao_dias_padrao: number;
  condicao_alimentar: CondicaoAlimentar;
  apresentacoes: ApresentacaoComercial[];
  interacoes_classes: string[];
  comorbidades_cautela: string[];
  orientacoes_padrao: string;
  palavras_chave: string[];
}

export interface ManipuladoDetalhes {
  veiculo: VeiculoManipulado;
  sabor: string;
  dose_unitaria_mg: number;
  quantidade_total_unidades: string;
}

/** Estrutura exata do item de prescrição (compatível com a Seção 8.1 do PRD + extensões da UI). */
export interface ItemPrescricao {
  id: string;
  slug_bulario?: string | null;
  tipo: 'industrializado' | 'manipulado';
  principio_ativo: string;
  nome_comercial_sugerido: string;
  classe_terapeutica?: string;
  dose_mg_kg: number;
  posologia: {
    dose_calculada_mg: number;
    apresentacao_escolhida: string;
    quantidade_por_tomada: string;
    frequencia_horas: number;
    duracao_dias: number;
  };
  orientacoes_tutor: string;
  icone_via: ViaAdministracao;
  condicao_alimentar: CondicaoAlimentar;
  memoria_calculo: string;
  manipulado?: ManipuladoDetalhes | null;
  origem_ia?: boolean;
}

/** Estrutura de payload exigida pela Seção 8.1 do PRD. */
export interface PayloadPosologicoIA {
  alerta_seguranca: {
    nivel: NivelAlertaSeguranca;
    mensagem: string | null;
  };
  itens_prescricao: Array<{
    tipo: 'industrializado' | 'manipulado';
    principio_ativo: string;
    nome_comercial_sugerido: string;
    posologia: {
      dose_calculada_mg: number;
      apresentacao_escolhida: string;
      quantidade_por_tomada: string;
      frequencia_horas: number;
      duracao_dias: number;
    };
    orientacoes_tutor: string;
    icone_via: ViaAdministracao;
    dose_mg_kg?: number;
    slug_bulario?: string | null;
    condicao_alimentar?: CondicaoAlimentar;
    manipulado?: ManipuladoDetalhes | null;
  }>;
}

export interface AlertaValidacaoItem {
  id: string;
  item_id?: string;
  principio_ativo: string;
  nivel: NivelAlertaSeguranca;
  cor: CorSemanticaAlerta;
  categoria: 'especie_toxica' | 'mdr1' | 'sobredose' | 'subdose' | 'interacao' | 'comorbidade' | 'cautela_especie';
  titulo: string;
  mensagem: string;
  bloqueia_emissao: boolean;
}

export interface ResultadoValidacaoPrescricao {
  alerta_seguranca: {
    nivel: NivelAlertaSeguranca;
    mensagem: string | null;
  };
  cor_semantica: CorSemanticaAlerta;
  bloqueia_emissao: boolean;
  alertas: AlertaValidacaoItem[];
  alertas_por_item: Record<string, AlertaValidacaoItem[]>;
}

export interface SlotCronograma {
  horario: string;
  periodo: 'manha' | 'tarde' | 'noite';
  rotulo_periodo: string;
  itens: Array<{
    item_id: string;
    nome_exibicao: string;
    principio_ativo: string;
    quantidade_por_tomada: string;
    icone_via: ViaAdministracao;
    condicao_alimentar: CondicaoAlimentar;
    rotulo_alimentar: string;
    duracao_dias: number;
  }>;
}

export interface ProtocoloClinico {
  codigo: string;
  titulo: string;
  descricao_clinica: string;
  especie_alvo: EspeciePaciente | 'ambas';
  palavras_gatilho: string[];
  itens_template: Array<{
    slug: string;
    dose_mg_kg?: number;
    frequencia_horas?: number;
    duracao_dias?: number;
  }>;
}

export const SABORES_POR_ESPECIE: Record<EspeciePaciente, string[]> = {
  canina: ['Picanha', 'Bacon', 'Frango Assado', 'Carne Grelhada', 'Queijo', 'Baunilha'],
  felina: ['Salmão', 'Atum', 'Bacalhau', 'Frango', 'Sardinha', 'Sem sabor (Gel Transdérmico)'],
  silvestre: ['Banana', 'Maçã', 'Frutas Vermelhas', 'Mel / Tutti-Frutti', 'Baunilha'],
};

export const ROTULO_VEICULO_MANIPULADO: Record<VeiculoManipulado, string> = {
  biscoito_palatavel: 'Biscoito Palatável',
  pasta_oral: 'Pasta Oral Dosadora',
  suspensao_oral: 'Suspensão Oral Saborizada',
  capsula_gastro: 'Cápsula Gastro-resistente',
  gel_transdermico: 'Gel Transdérmico Auricular',
  solucao_otologica: 'Solução Otológica Manipulada',
};

export const ROTULO_CONDICAO_ALIMENTAR: Record<CondicaoAlimentar, string> = {
  com_alimento: 'Com alimento',
  jejum: 'Em jejum (30 min antes)',
  livre: 'Com ou sem alimento',
  uso_externo: 'Uso tópico / externo',
};

export const RACAS_SENSIVEIS_MDR1 = [
  'collie',
  'rough collie',
  'smooth collie',
  'border collie',
  'shetland',
  'pastor de shetland',
  'sheltie',
  'pastor australiano',
  'australian shepherd',
  'mini american shepherd',
  'old english sheepdog',
  'bobtail',
  'whippet',
  'pastor branco',
  'pastor branco suíço',
  'pastor branco suico',
  'silken windhound',
  'mcnab',
];

/** Detecta automaticamente se a raça informada possui predisposição à mutação no gene MDR1 (ABCB1). */
export function detectarRiscoMdr1PorRaca(especie: EspeciePaciente, raca?: string | null): boolean {
  if (especie !== 'canina' || !raca) return false;
  const racaLimpa = raca.toLowerCase().trim();
  return RACAS_SENSIVEIS_MDR1.some((padrao) => racaLimpa.includes(padrao));
}

/** Bulário determinístico local (espelho exato da migration para validação instantânea e offline). */
export const BULARIO_PADRAO: RegraBulario[] = [
  {
    slug: 'amoxicilina-clavulanato',
    principio_ativo: 'Amoxicilina + Clavulanato de Potássio',
    nome_comercial_sugerido: 'Synulox 250 mg',
    classe_terapeutica: 'antibiotico_betalactamico',
    tipo_padrao: 'industrializado',
    icone_via: 'oral',
    especies_permitidas: ['canina', 'felina'],
    especies_contraindicadas: ['silvestre'],
    motivo_contraindicacao_especie:
      'Risco severo de disbiose e enterotoxemia fatal em pequenos mamíferos herbívoros (coelhos, roedores).',
    risco_mdr1: false,
    dose_padrao_mg_kg: 12.5,
    dose_min_mg_kg: 12.5,
    dose_max_mg_kg: 25.0,
    dose_toxica_mg_kg: 50.0,
    frequencia_horas_padrao: 12,
    duracao_dias_padrao: 10,
    condicao_alimentar: 'com_alimento',
    apresentacoes: [
      { rotulo: 'Synulox 50 mg', forma: 'comprimido', concentracao_mg: 50, divisivel: true },
      { rotulo: 'Synulox 250 mg', forma: 'comprimido', concentracao_mg: 250, divisivel: true },
      { rotulo: 'Synulox 500 mg', forma: 'comprimido', concentracao_mg: 500, divisivel: true },
      { rotulo: 'Synulox Suspensão 50 mg/mL', forma: 'suspensao_ml', concentracao_mg_ml: 50 },
    ],
    interacoes_classes: [],
    comorbidades_cautela: ['alergia_penicilina'],
    orientacoes_padrao: 'Administrar logo após as refeições para evitar desconforto gástrico.',
    palavras_chave: ['infecção', 'infeccao', 'piodermite', 'abscesso', 'ferida', 'mordedura', 'amoxicilina', 'clavulanato', 'synulox'],
  },
  {
    slug: 'cefalexina',
    principio_ativo: 'Cefalexina Monoidratada',
    nome_comercial_sugerido: 'Rilexine 300 mg',
    classe_terapeutica: 'antibiotico_cefalosporina',
    tipo_padrao: 'industrializado',
    icone_via: 'oral',
    especies_permitidas: ['canina', 'felina'],
    especies_contraindicadas: ['silvestre'],
    motivo_contraindicacao_especie:
      'Contraindicado por via oral em coelhos e roedores devido ao risco de enterotoxemia por Clostridium.',
    risco_mdr1: false,
    dose_padrao_mg_kg: 25.0,
    dose_min_mg_kg: 15.0,
    dose_max_mg_kg: 30.0,
    dose_toxica_mg_kg: 60.0,
    frequencia_horas_padrao: 12,
    duracao_dias_padrao: 14,
    condicao_alimentar: 'com_alimento',
    apresentacoes: [
      { rotulo: 'Rilexine 75 mg', forma: 'comprimido', concentracao_mg: 75, divisivel: true },
      { rotulo: 'Rilexine 300 mg', forma: 'comprimido', concentracao_mg: 300, divisivel: true },
      { rotulo: 'Rilexine 600 mg', forma: 'comprimido', concentracao_mg: 600, divisivel: true },
    ],
    interacoes_classes: [],
    comorbidades_cautela: ['insuficiencia_renal', 'alergia_penicilina'],
    orientacoes_padrao: 'Oferecer junto com alimento para reduzir náuseas e melhorar a tolerância digestiva.',
    palavras_chave: ['piodermite', 'pele', 'foliculite', 'cefalexina', 'rilexine'],
  },
  {
    slug: 'doxiciclina',
    principio_ativo: 'Hiclato de Doxiciclina',
    nome_comercial_sugerido: 'Doxitrat 80 mg',
    classe_terapeutica: 'antibiotico_tetraciclina',
    tipo_padrao: 'industrializado',
    icone_via: 'oral',
    especies_permitidas: ['canina', 'felina'],
    especies_contraindicadas: [],
    risco_mdr1: false,
    dose_padrao_mg_kg: 5.0,
    dose_min_mg_kg: 5.0,
    dose_max_mg_kg: 10.0,
    dose_toxica_mg_kg: 25.0,
    dose_felina_max_mg_kg: 10.0,
    alerta_felino_especifico:
      'Em felinos, administrar SEMPRE seguido de 3 a 5 mL de água ou alimento úmido para prevenir esofagite e estenose esofágica.',
    frequencia_horas_padrao: 12,
    duracao_dias_padrao: 21,
    condicao_alimentar: 'com_alimento',
    apresentacoes: [
      { rotulo: 'Doxitrat 80 mg', forma: 'comprimido', concentracao_mg: 80, divisivel: true },
      { rotulo: 'Doxitrat 200 mg', forma: 'comprimido', concentracao_mg: 200, divisivel: true },
    ],
    interacoes_classes: ['antiacido'],
    comorbidades_cautela: ['gestante', 'filhote', 'insuficiencia_hepatica'],
    orientacoes_padrao: 'Administrar junto com refeição. Não oferecer junto com laticínios ou suplementos de cálcio/ferro.',
    palavras_chave: ['erliquiose', 'carrapato', 'hemoparasitose', 'micoplasma', 'tosse', 'doxiciclina', 'doxitrat'],
  },
  {
    slug: 'enrofloxacino',
    principio_ativo: 'Enrofloxacino',
    nome_comercial_sugerido: 'Baytril Flavour 50 mg',
    classe_terapeutica: 'antibiotico_fluoroquinolona',
    tipo_padrao: 'industrializado',
    icone_via: 'oral',
    especies_permitidas: ['canina', 'felina', 'silvestre'],
    especies_contraindicadas: [],
    risco_mdr1: false,
    dose_padrao_mg_kg: 5.0,
    dose_min_mg_kg: 5.0,
    dose_max_mg_kg: 10.0,
    dose_toxica_mg_kg: 15.0,
    dose_felina_max_mg_kg: 5.0,
    alerta_felino_especifico:
      'ATENÇÃO FELINOS: Nunca exceder 5 mg/kg/dia em gatos devido ao risco de degeneração retiniana aguda e cegueira irreversível.',
    frequencia_horas_padrao: 24,
    duracao_dias_padrao: 10,
    condicao_alimentar: 'livre',
    apresentacoes: [
      { rotulo: 'Baytril 15 mg', forma: 'comprimido', concentracao_mg: 15, divisivel: true },
      { rotulo: 'Baytril 50 mg', forma: 'comprimido', concentracao_mg: 50, divisivel: true },
      { rotulo: 'Baytril 150 mg', forma: 'comprimido', concentracao_mg: 150, divisivel: true },
    ],
    interacoes_classes: ['antiacido'],
    comorbidades_cautela: ['filhote', 'gestante', 'epilepsia'],
    orientacoes_padrao: 'Administrar a cada 24 horas. Evitar uso concomitante com antiácidos ou sucralfato no mesmo horário.',
    palavras_chave: ['enrofloxacino', 'baytril', 'itu', 'urinária', 'urinaria', 'pseudomonas'],
  },
  {
    slug: 'meloxicam',
    principio_ativo: 'Meloxicam',
    nome_comercial_sugerido: 'Maxicam 0,5 mg',
    classe_terapeutica: 'aine',
    tipo_padrao: 'industrializado',
    icone_via: 'oral',
    especies_permitidas: ['canina', 'felina'],
    especies_contraindicadas: [],
    risco_mdr1: false,
    dose_padrao_mg_kg: 0.1,
    dose_min_mg_kg: 0.05,
    dose_max_mg_kg: 0.2,
    dose_toxica_mg_kg: 0.3,
    dose_felina_max_mg_kg: 0.1,
    alerta_felino_especifico:
      'Em felinos, limitar a dose a 0,05–0,1 mg/kg por curto período (máx. 3 a 5 dias) monitorando função renal.',
    frequencia_horas_padrao: 24,
    duracao_dias_padrao: 4,
    condicao_alimentar: 'com_alimento',
    apresentacoes: [
      { rotulo: 'Flamavet 0,2 mg (Gatos)', forma: 'comprimido', concentracao_mg: 0.2, divisivel: true },
      { rotulo: 'Maxicam 0,5 mg', forma: 'comprimido', concentracao_mg: 0.5, divisivel: true },
      { rotulo: 'Maxicam 2,0 mg', forma: 'comprimido', concentracao_mg: 2.0, divisivel: true },
    ],
    interacoes_classes: ['corticoide', 'aine'],
    comorbidades_cautela: ['insuficiencia_renal', 'insuficiencia_hepatica', 'ulcera_gastrica', 'gestante'],
    orientacoes_padrao: 'Administrar obrigatoriamente após a alimentação. Suspender imediatamente em caso de vômito ou fezes escuras.',
    palavras_chave: ['dor', 'inflamação', 'inflamacao', 'artrose', 'pós-operatório', 'pos-operatorio', 'claudicação', 'meloxicam', 'maxicam', 'flamavet'],
  },
  {
    slug: 'prednisolona',
    principio_ativo: 'Prednisolona',
    nome_comercial_sugerido: 'Prediderm 5 mg',
    classe_terapeutica: 'corticoide',
    tipo_padrao: 'industrializado',
    icone_via: 'oral',
    especies_permitidas: ['canina', 'felina'],
    especies_contraindicadas: [],
    risco_mdr1: false,
    dose_padrao_mg_kg: 0.8,
    dose_min_mg_kg: 0.5,
    dose_max_mg_kg: 2.0,
    dose_toxica_mg_kg: 4.0,
    frequencia_horas_padrao: 24,
    duracao_dias_padrao: 5,
    condicao_alimentar: 'com_alimento',
    apresentacoes: [
      { rotulo: 'Prediderm 5 mg', forma: 'comprimido', concentracao_mg: 5, divisivel: true },
      { rotulo: 'Prediderm 20 mg', forma: 'comprimido', concentracao_mg: 20, divisivel: true },
    ],
    interacoes_classes: ['aine'],
    comorbidades_cautela: ['diabetes', 'insuficiencia_renal', 'ulcera_gastrica', 'gestante'],
    orientacoes_padrao: 'Administrar pela manhã (em cães) ou à noite (em gatos) após refeição. Pode aumentar sede e volume urinário.',
    palavras_chave: ['alergia', 'prurido', 'coceira', 'dermatite', 'prednisolona', 'prediderm', 'corticoide'],
  },
  {
    slug: 'dipirona',
    principio_ativo: 'Dipirona Sódica',
    nome_comercial_sugerido: 'Dipirona Gotas Vet 500 mg/mL',
    classe_terapeutica: 'analgesico_antipiretico',
    tipo_padrao: 'industrializado',
    icone_via: 'oral',
    especies_permitidas: ['canina', 'felina'],
    especies_contraindicadas: [],
    risco_mdr1: false,
    dose_padrao_mg_kg: 25.0,
    dose_min_mg_kg: 15.0,
    dose_max_mg_kg: 28.0,
    dose_toxica_mg_kg: 50.0,
    dose_felina_max_mg_kg: 25.0,
    alerta_felino_especifico:
      'Em felinos, usar intervalo de 12/12h ou 24/24h e diluir ou encapsular para evitar sialorreia intensa pelo sabor amargo.',
    frequencia_horas_padrao: 12,
    duracao_dias_padrao: 4,
    condicao_alimentar: 'com_alimento',
    apresentacoes: [
      { rotulo: 'Dipirona Gotas 500 mg/mL (25 mg/gota)', forma: 'gotas', concentracao_mg_gota: 25, concentracao_mg_ml: 500 },
      { rotulo: 'Dipirona Comprimido 500 mg', forma: 'comprimido', concentracao_mg: 500, divisivel: true },
    ],
    interacoes_classes: [],
    comorbidades_cautela: ['insuficiencia_hepatica', 'discrasia_sanguinea'],
    orientacoes_padrao: 'Administrar 1 gota por kg de peso corporal (ou conforme dose calculada). Em gatos, pode causar salivação passageira.',
    palavras_chave: ['febre', 'analgesia', 'dipirona', 'hipertermia'],
  },
  {
    slug: 'oclacitinib',
    principio_ativo: 'Maleato de Oclacitinib',
    nome_comercial_sugerido: 'Apoquel 5,4 mg',
    classe_terapeutica: 'imunomodulador_jak',
    tipo_padrao: 'industrializado',
    icone_via: 'oral',
    especies_permitidas: ['canina', 'felina'],
    especies_contraindicadas: [],
    risco_mdr1: false,
    dose_padrao_mg_kg: 0.5,
    dose_min_mg_kg: 0.4,
    dose_max_mg_kg: 0.6,
    dose_toxica_mg_kg: 1.2,
    frequencia_horas_padrao: 12,
    duracao_dias_padrao: 14,
    condicao_alimentar: 'livre',
    apresentacoes: [
      { rotulo: 'Apoquel 3,6 mg', forma: 'comprimido', concentracao_mg: 3.6, divisivel: true },
      { rotulo: 'Apoquel 5,4 mg', forma: 'comprimido', concentracao_mg: 5.4, divisivel: true },
      { rotulo: 'Apoquel 16 mg', forma: 'comprimido', concentracao_mg: 16, divisivel: true },
    ],
    interacoes_classes: [],
    comorbidades_cautela: ['filhote', 'neoplasia'],
    orientacoes_padrao: 'Pode ser administrado com ou sem alimento. Manter a cada 12h nos primeiros 14 dias.',
    palavras_chave: ['atopia', 'dermatite alérgica', 'dermatite alergica', 'apoquel', 'oclacitinib'],
  },
  {
    slug: 'maropitant',
    principio_ativo: 'Citrato de Maropitant',
    nome_comercial_sugerido: 'Cerenia 24 mg',
    classe_terapeutica: 'antiemetico',
    tipo_padrao: 'industrializado',
    icone_via: 'oral',
    especies_permitidas: ['canina', 'felina'],
    especies_contraindicadas: [],
    risco_mdr1: false,
    dose_padrao_mg_kg: 2.0,
    dose_min_mg_kg: 1.0,
    dose_max_mg_kg: 2.5,
    dose_toxica_mg_kg: 8.0,
    frequencia_horas_padrao: 24,
    duracao_dias_padrao: 4,
    condicao_alimentar: 'livre',
    apresentacoes: [
      { rotulo: 'Cerenia 16 mg', forma: 'comprimido', concentracao_mg: 16, divisivel: true },
      { rotulo: 'Cerenia 24 mg', forma: 'comprimido', concentracao_mg: 24, divisivel: true },
      { rotulo: 'Cerenia 60 mg', forma: 'comprimido', concentracao_mg: 60, divisivel: true },
      { rotulo: 'Cerenia 160 mg', forma: 'comprimido', concentracao_mg: 160, divisivel: true },
    ],
    interacoes_classes: [],
    comorbidades_cautela: ['insuficiencia_hepatica'],
    orientacoes_padrao: 'Administrar 1 vez ao dia com um pequeno petisco para evitar desconforto gástrico.',
    palavras_chave: ['vômito', 'vomito', 'êmese', 'emese', 'náusea', 'nausea', 'gastroenterite', 'cerenia', 'maropitant'],
  },
  {
    slug: 'omeprazol',
    principio_ativo: 'Omeprazol',
    nome_comercial_sugerido: 'Gaviz V 10 mg',
    classe_terapeutica: 'antiacido',
    tipo_padrao: 'industrializado',
    icone_via: 'oral',
    especies_permitidas: ['canina', 'felina'],
    especies_contraindicadas: [],
    risco_mdr1: false,
    dose_padrao_mg_kg: 1.0,
    dose_min_mg_kg: 0.7,
    dose_max_mg_kg: 1.5,
    dose_toxica_mg_kg: 5.0,
    frequencia_horas_padrao: 24,
    duracao_dias_padrao: 10,
    condicao_alimentar: 'jejum',
    apresentacoes: [
      { rotulo: 'Gaviz V 10 mg', forma: 'comprimido', concentracao_mg: 10, divisivel: true },
      { rotulo: 'Gaviz V 20 mg', forma: 'comprimido', concentracao_mg: 20, divisivel: true },
    ],
    interacoes_classes: ['antibiotico_fluoroquinolona', 'antibiotico_tetraciclina'],
    comorbidades_cautela: [],
    orientacoes_padrao: 'Administrar em jejum, 30 minutos antes da primeira refeição da manhã.',
    palavras_chave: ['gastrite', 'protetor gástrico', 'protetor gastrico', 'omeprazol', 'gaviz'],
  },
  {
    slug: 'gabapentina-manipulada',
    principio_ativo: 'Gabapentina (Fórmula Manipulada)',
    nome_comercial_sugerido: 'Gabapentina Manipulada',
    classe_terapeutica: 'analgesico_neuropatico',
    tipo_padrao: 'manipulado',
    icone_via: 'oral',
    especies_permitidas: ['canina', 'felina'],
    especies_contraindicadas: [],
    risco_mdr1: false,
    dose_padrao_mg_kg: 10.0,
    dose_min_mg_kg: 5.0,
    dose_max_mg_kg: 20.0,
    dose_toxica_mg_kg: 40.0,
    dose_felina_max_mg_kg: 15.0,
    frequencia_horas_padrao: 12,
    duracao_dias_padrao: 14,
    condicao_alimentar: 'livre',
    apresentacoes: [
      { rotulo: 'Biscoito Palatável Manipulado', forma: 'manipulado' },
      { rotulo: 'Pasta Oral Palatável', forma: 'manipulado' },
      { rotulo: 'Suspensão Oral Saborizada', forma: 'manipulado' },
    ],
    interacoes_classes: [],
    comorbidades_cautela: ['insuficiencia_renal'],
    orientacoes_padrao: 'Administrar no horário programado. Pode causar leve sonolência nas primeiras 48 horas.',
    palavras_chave: ['dor crônica', 'dor cronica', 'dor neuropática', 'neuropatia', 'cistite', 'gabapentina', 'fisiatria'],
  },
  {
    slug: 'solucao-otologica-posatex',
    principio_ativo: 'Orbifloxacino + Mometasona + Posaconazol',
    nome_comercial_sugerido: 'Posatex Suspensão Otológica',
    classe_terapeutica: 'otologico_topico',
    tipo_padrao: 'industrializado',
    icone_via: 'otica',
    especies_permitidas: ['canina', 'felina'],
    especies_contraindicadas: [],
    risco_mdr1: false,
    dose_padrao_mg_kg: 0.5,
    dose_min_mg_kg: 0.2,
    dose_max_mg_kg: 1.0,
    dose_toxica_mg_kg: 3.0,
    frequencia_horas_padrao: 24,
    duracao_dias_padrao: 7,
    condicao_alimentar: 'uso_externo',
    apresentacoes: [{ rotulo: 'Posatex Frasco 17,5 mL (Gotas Otológicas)', forma: 'gotas_otologicas' }],
    interacoes_classes: [],
    comorbidades_cautela: ['timpano_perfurado'],
    orientacoes_padrao:
      'Limpar o conduto auditivo previamente com ceruminolítico, aguardar 20 minutos, aplicar as gotas e massagear a base da orelha.',
    palavras_chave: ['otite', 'otite fúngica', 'otite fungica', 'malassezia', 'orelha', 'ouvido', 'posatex', 'auritop', 'otomax'],
  },
  {
    slug: 'ivermectina',
    principio_ativo: 'Ivermectina',
    nome_comercial_sugerido: 'Mectimax 3 mg',
    classe_terapeutica: 'antiparasitario_avermectina',
    tipo_padrao: 'industrializado',
    icone_via: 'oral',
    especies_permitidas: ['canina', 'felina', 'silvestre'],
    especies_contraindicadas: [],
    risco_mdr1: true,
    mensagem_mdr1:
      'RISCO CRÍTICO MDR1 (ABCB1): Contraindicado em doses antiparasitárias para raças sensíveis (Collie, Pastor de Shetland, Pastor Australiano, Border Collie, Old English Sheepdog, Whippet) ou portadores de mutação MDR1 — risco de neurotoxicidade grave, coma e óbito.',
    dose_padrao_mg_kg: 0.4,
    dose_min_mg_kg: 0.2,
    dose_max_mg_kg: 0.6,
    dose_toxica_mg_kg: 1.0,
    frequencia_horas_padrao: 24,
    duracao_dias_padrao: 14,
    condicao_alimentar: 'com_alimento',
    apresentacoes: [
      { rotulo: 'Mectimax 3 mg', forma: 'comprimido', concentracao_mg: 3, divisivel: true },
      { rotulo: 'Mectimax 12 mg', forma: 'comprimido', concentracao_mg: 12, divisivel: true },
    ],
    interacoes_classes: [],
    comorbidades_cautela: ['filhote'],
    orientacoes_padrao: 'Administrar exclusivamente conforme orientação veterinária rigorosa.',
    palavras_chave: ['ivermectina', 'mectimax', 'sarna', 'escabiose', 'demodicose'],
  },
  {
    slug: 'tramadol',
    principio_ativo: 'Cloridrato de Tramadol',
    nome_comercial_sugerido: 'Cronidor 40 mg',
    classe_terapeutica: 'opioide_atipico',
    tipo_padrao: 'industrializado',
    icone_via: 'oral',
    especies_permitidas: ['canina', 'felina'],
    especies_contraindicadas: [],
    risco_mdr1: false,
    dose_padrao_mg_kg: 3.0,
    dose_min_mg_kg: 2.0,
    dose_max_mg_kg: 5.0,
    dose_toxica_mg_kg: 10.0,
    dose_felina_max_mg_kg: 2.0,
    alerta_felino_especifico: 'Em felinos, utilizar 1 a 2 mg/kg a cada 12h; pode causar disforia e midríase.',
    frequencia_horas_padrao: 12,
    duracao_dias_padrao: 5,
    condicao_alimentar: 'com_alimento',
    apresentacoes: [
      { rotulo: 'Cronidor 12 mg', forma: 'comprimido', concentracao_mg: 12, divisivel: true },
      { rotulo: 'Cronidor 40 mg', forma: 'comprimido', concentracao_mg: 40, divisivel: true },
      { rotulo: 'Cronidor 80 mg', forma: 'comprimido', concentracao_mg: 80, divisivel: true },
    ],
    interacoes_classes: ['antidepressivo_triciclico'],
    comorbidades_cautela: ['epilepsia', 'insuficiencia_hepatica', 'insuficiencia_renal'],
    orientacoes_padrao: 'Administrar após alimentação. Observar eventual sedação.',
    palavras_chave: ['dor intensa', 'ortopedia', 'tramadol', 'cronidor'],
  },
  {
    slug: 'amitriptilina-manipulada',
    principio_ativo: 'Cloridrato de Amitriptilina (Manipulado)',
    nome_comercial_sugerido: 'Amitriptilina Gel Transdérmico / Biscoito',
    classe_terapeutica: 'antidepressivo_triciclico',
    tipo_padrao: 'manipulado',
    icone_via: 'oral',
    especies_permitidas: ['canina', 'felina'],
    especies_contraindicadas: [],
    risco_mdr1: false,
    dose_padrao_mg_kg: 1.0,
    dose_min_mg_kg: 0.5,
    dose_max_mg_kg: 2.0,
    dose_toxica_mg_kg: 5.0,
    dose_felina_max_mg_kg: 1.5,
    frequencia_horas_padrao: 24,
    duracao_dias_padrao: 30,
    condicao_alimentar: 'livre',
    apresentacoes: [
      { rotulo: 'Gel Transdérmico Auricular', forma: 'manipulado' },
      { rotulo: 'Pasta Oral Saborizada', forma: 'manipulado' },
    ],
    interacoes_classes: ['opioide_atipico'],
    comorbidades_cautela: ['cardiopatia', 'insuficiencia_hepatica'],
    orientacoes_padrao: 'Administrar no mesmo horário diariamente. Não interromper abruptamente sem orientação.',
    palavras_chave: ['cistite idiopática', 'cistite idiopatica', 'ansiedade', 'lambedura', 'amitriptilina'],
  },
  {
    slug: 'paracetamol',
    principio_ativo: 'Paracetamol (Acetaminofeno)',
    nome_comercial_sugerido: 'Paracetamol 500 mg',
    classe_terapeutica: 'analgesico_antipiretico',
    tipo_padrao: 'industrializado',
    icone_via: 'oral',
    especies_permitidas: ['canina'],
    especies_contraindicadas: ['felina'],
    motivo_contraindicacao_especie:
      'BLOQUEIO CRÍTICO DE SEGURANÇA: O Paracetamol é ALTAMENTE TÓXICO E LETAL para felinos (deficiência de glucuronil-transferase), causando metemoglobinemia, anemia por corpúsculos de Heinz e necrose hepática fulminante mesmo em 1 dose.',
    risco_mdr1: false,
    dose_padrao_mg_kg: 10.0,
    dose_min_mg_kg: 10.0,
    dose_max_mg_kg: 15.0,
    dose_toxica_mg_kg: 25.0,
    dose_felina_max_mg_kg: 0.0,
    alerta_felino_especifico: 'PROIBIDO EM FELINOS: Toxicidade letal absoluta.',
    frequencia_horas_padrao: 12,
    duracao_dias_padrao: 3,
    condicao_alimentar: 'com_alimento',
    apresentacoes: [{ rotulo: 'Comprimido 500 mg', forma: 'comprimido', concentracao_mg: 500, divisivel: true }],
    interacoes_classes: ['aine'],
    comorbidades_cautela: ['insuficiencia_hepatica', 'insuficiencia_renal'],
    orientacoes_padrao: 'Uso restrito exclusivamente à espécie canina sob supervisão estrita. Jamais administrar em gatos.',
    palavras_chave: ['paracetamol', 'acetaminofeno', 'tylenol'],
  },
  {
    slug: 'ibuprofeno',
    principio_ativo: 'Ibuprofeno',
    nome_comercial_sugerido: 'Ibuprofeno',
    classe_terapeutica: 'aine',
    tipo_padrao: 'industrializado',
    icone_via: 'oral',
    especies_permitidas: [],
    especies_contraindicadas: ['canina', 'felina', 'silvestre'],
    motivo_contraindicacao_especie:
      'BLOQUEIO CRÍTICO DE SEGURANÇA: O Ibuprofeno é contraindicado em cães e gatos devido ao altíssimo risco de ulceração/perfuração gástrica e insuficiência renal aguda. Substitua por Meloxicam ou Dipirona veterinária.',
    risco_mdr1: false,
    dose_padrao_mg_kg: 5.0,
    dose_min_mg_kg: 0.0,
    dose_max_mg_kg: 0.0,
    dose_toxica_mg_kg: 5.0,
    frequencia_horas_padrao: 24,
    duracao_dias_padrao: 1,
    condicao_alimentar: 'com_alimento',
    apresentacoes: [],
    interacoes_classes: ['corticoide', 'aine'],
    comorbidades_cautela: ['insuficiencia_renal', 'insuficiencia_hepatica'],
    orientacoes_padrao: 'Contraindicado para uso veterinário em pequenos animais.',
    palavras_chave: ['ibuprofeno', 'advil', 'alivium'],
  },
  {
    slug: 'permetrina',
    principio_ativo: 'Permetrina Spot-On',
    nome_comercial_sugerido: 'Pulvex Pour-On / Pipeta Canina',
    classe_terapeutica: 'ectoparasiticida_piretroide',
    tipo_padrao: 'industrializado',
    icone_via: 'topica',
    especies_permitidas: ['canina'],
    especies_contraindicadas: ['felina'],
    motivo_contraindicacao_especie:
      'BLOQUEIO CRÍTICO DE SEGURANÇA: A Permetrina é altamente neurotóxica e potencialmente fatal para felinos (causa fasciculações, hipertermia e estado epiléptico).',
    risco_mdr1: false,
    dose_padrao_mg_kg: 1.0,
    dose_min_mg_kg: 0.5,
    dose_max_mg_kg: 2.0,
    dose_toxica_mg_kg: 5.0,
    dose_felina_max_mg_kg: 0.0,
    alerta_felino_especifico: 'PROIBIDO EM FELINOS: Neurotoxicidade letal.',
    frequencia_horas_padrao: 168,
    duracao_dias_padrao: 28,
    condicao_alimentar: 'uso_externo',
    apresentacoes: [{ rotulo: 'Pipeta Tópica Canina 1 mL', forma: 'pipeta_topica' }],
    interacoes_classes: [],
    comorbidades_cautela: [],
    orientacoes_padrao: 'Aplicar na região da nuca (dorso) afastando os pelos. Uso exclusivo em cães; manter gatos afastados após aplicação.',
    palavras_chave: ['permetrina', 'pulvex'],
  },
  {
    slug: 'loperamida',
    principio_ativo: 'Cloridrato de Loperamida',
    nome_comercial_sugerido: 'Imosec 2 mg',
    classe_terapeutica: 'antidiarreico_opioide',
    tipo_padrao: 'industrializado',
    icone_via: 'oral',
    especies_permitidas: ['canina'],
    especies_contraindicadas: ['felina'],
    motivo_contraindicacao_especie:
      'Contraindicado em felinos devido ao risco de comportamento excitatório agudo do sistema nervoso central.',
    risco_mdr1: true,
    mensagem_mdr1:
      'RISCO CRÍTICO MDR1 (ABCB1): A Loperamida atravessa a barreira hematoencefálica em cães com mutação no gene MDR1 (Collie, Pastor Australiano, Shetland, Border Collie, Whippet), provocando depressão profunda do SNC e neurotoxicidade.',
    dose_padrao_mg_kg: 0.1,
    dose_min_mg_kg: 0.08,
    dose_max_mg_kg: 0.2,
    dose_toxica_mg_kg: 0.4,
    frequencia_horas_padrao: 12,
    duracao_dias_padrao: 3,
    condicao_alimentar: 'livre',
    apresentacoes: [{ rotulo: 'Comprimido 2 mg', forma: 'comprimido', concentracao_mg: 2, divisivel: true }],
    interacoes_classes: [],
    comorbidades_cautela: ['diarreia_infecciosa', 'insuficiencia_hepatica'],
    orientacoes_padrao: 'Uso sob cautela estrita; suspender ao normalizar a consistência fecal.',
    palavras_chave: ['loperamida', 'imosec'],
  },
];

export const PROTOCOLOS_PADRAO: ProtocoloClinico[] = [
  {
    codigo: 'otite_fungica_bacteriana',
    titulo: 'Otite Externa Fúngica / Bacteriana',
    descricao_clinica: 'Otite fúngica/bacteriana bilateral moderada com prurido e eritema auricular',
    especie_alvo: 'ambas',
    palavras_gatilho: ['otite', 'orelha', 'ouvido', 'malassezia', 'cerume', 'otológica', 'otologica'],
    itens_template: [
      { slug: 'solucao-otologica-posatex', frequencia_horas: 24, duracao_dias: 7 },
      { slug: 'amoxicilina-clavulanato', dose_mg_kg: 12.5, frequencia_horas: 12, duracao_dias: 10 },
    ],
  },
  {
    codigo: 'piodermite_superficial',
    titulo: 'Piodermite Superficial + Prurido Alérgico',
    descricao_clinica: 'Piodermite bacteriana superficial associada a dermatite alérgica com prurido intenso',
    especie_alvo: 'canina',
    palavras_gatilho: ['piodermite', 'foliculite', 'dermatite', 'prurido', 'coceira', 'pústulas', 'pustulas'],
    itens_template: [
      { slug: 'cefalexina', dose_mg_kg: 25, frequencia_horas: 12, duracao_dias: 14 },
      { slug: 'oclacitinib', dose_mg_kg: 0.5, frequencia_horas: 12, duracao_dias: 14 },
    ],
  },
  {
    codigo: 'infeccao_tecidos_moles',
    titulo: 'Infecção Bacteriana / Abscesso / Ferida',
    descricao_clinica: 'Infecção de tecidos moles, ferida contaminada ou abscesso com dor e inflamação aguda',
    especie_alvo: 'ambas',
    palavras_gatilho: ['abscesso', 'ferida', 'mordedura', 'infecção', 'infeccao', 'pós-operatório', 'pos-operatorio'],
    itens_template: [
      { slug: 'amoxicilina-clavulanato', dose_mg_kg: 12.5, frequencia_horas: 12, duracao_dias: 10 },
      { slug: 'meloxicam', dose_mg_kg: 0.1, frequencia_horas: 24, duracao_dias: 4 },
      { slug: 'dipirona', dose_mg_kg: 25, frequencia_horas: 12, duracao_dias: 3 },
    ],
  },
  {
    codigo: 'gastroenterite_aguda',
    titulo: 'Gastroenterite Aguda com Êmese',
    descricao_clinica: 'Quadro agudo de vômitos, náusea e sensibilidade abdominal',
    especie_alvo: 'ambas',
    palavras_gatilho: ['gastroenterite', 'vômito', 'vomito', 'êmese', 'emese', 'gastrite', 'náusea', 'nausea'],
    itens_template: [
      { slug: 'maropitant', dose_mg_kg: 2.0, frequencia_horas: 24, duracao_dias: 4 },
      { slug: 'omeprazol', dose_mg_kg: 1.0, frequencia_horas: 24, duracao_dias: 10 },
      { slug: 'dipirona', dose_mg_kg: 25, frequencia_horas: 12, duracao_dias: 3 },
    ],
  },
  {
    codigo: 'cistite_idiopatica_felina',
    titulo: 'Cistite Idiopática Felina (CIF) / Dor Neuropática',
    descricao_clinica: 'Disúria, periúria e desconforto vesical em felino (manejo multimodal e manipulado)',
    especie_alvo: 'felina',
    palavras_gatilho: ['cistite', 'cif', 'disúria', 'disuria', 'obstrução', 'urinária', 'urinaria'],
    itens_template: [
      { slug: 'gabapentina-manipulada', dose_mg_kg: 10, frequencia_horas: 12, duracao_dias: 14 },
      { slug: 'meloxicam', dose_mg_kg: 0.05, frequencia_horas: 24, duracao_dias: 3 },
      { slug: 'amitriptilina-manipulada', dose_mg_kg: 1.0, frequencia_horas: 24, duracao_dias: 30 },
    ],
  },
  {
    codigo: 'hemoparasitose_erliquiose',
    titulo: 'Hemoparasitose / Erliquiose / Anaplasmose',
    descricao_clinica: 'Tratamento antimicrobiano de 21 dias com proteção gástrica e controle de febre',
    especie_alvo: 'canina',
    palavras_gatilho: ['erliquiose', 'hemoparasitose', 'anaplasma', 'doença do carrapato', 'carrapato'],
    itens_template: [
      { slug: 'doxiciclina', dose_mg_kg: 5.0, frequencia_horas: 12, duracao_dias: 21 },
      { slug: 'omeprazol', dose_mg_kg: 1.0, frequencia_horas: 24, duracao_dias: 21 },
      { slug: 'dipirona', dose_mg_kg: 25, frequencia_horas: 12, duracao_dias: 3 },
    ],
  },
];

function arredondar(valor: number, casas = 2): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}

function formatarNumeroPtBr(valor: number): string {
  return arredondar(valor, 2).toString().replace('.', ',');
}

/** Formata quantidade fracionária de comprimidos de forma legível para o tutor (ex.: 1/2 comprimido, 1 e 1/2 comprimido). */
export function formatarFracaoComprimido(razao: number): { rotulo: string; erroRelativo: number } {
  const opcoes: Array<{ valor: number; texto: string }> = [
    { valor: 0.25, texto: '1/4 de comprimido' },
    { valor: 0.5, texto: '1/2 comprimido' },
    { valor: 0.75, texto: '3/4 de comprimido' },
    { valor: 1.0, texto: '1 comprimido' },
    { valor: 1.25, texto: '1 e 1/4 de comprimido' },
    { valor: 1.5, texto: '1 e 1/2 comprimido' },
    { valor: 2.0, texto: '2 comprimidos' },
    { valor: 2.5, texto: '2 e 1/2 comprimidos' },
    { valor: 3.0, texto: '3 comprimidos' },
  ];

  let melhor = opcoes[0];
  let menorErro = Math.abs(razao - melhor.valor) / Math.max(razao, 0.01);

  for (const op of opcoes) {
    const erro = Math.abs(razao - op.valor) / Math.max(razao, 0.01);
    if (erro < menorErro) {
      menorErro = erro;
      melhor = op;
    }
  }

  return { rotulo: melhor.texto, erroRelativo: menorErro };
}

/** Busca uma regra do bulário por slug ou por correspondência de princípio ativo / nome comercial. */
export function localizarRegraBulario(
  identificador: string,
  bulario: RegraBulario[] = BULARIO_PADRAO
): RegraBulario | undefined {
  const limpo = identificador.toLowerCase().trim();
  if (!limpo) return undefined;

  return (
    bulario.find((b) => b.slug === limpo) ||
    bulario.find(
      (b) =>
        b.principio_ativo.toLowerCase().includes(limpo) ||
        limpo.includes(b.principio_ativo.toLowerCase().split(' ')[0]) ||
        b.nome_comercial_sugerido.toLowerCase().includes(limpo) ||
        b.palavras_chave.some((p) => p.toLowerCase() === limpo)
    )
  );
}

/**
 * Calcula a posologia exata, escolhe a melhor apresentação comercial ou manipulada
 * e monta a memória de cálculo expansível (RF-03, RF-07 e Seção 7.1).
 */
export function calcularPosologiaItem(params: {
  id?: string;
  regra?: RegraBulario;
  paciente: Pick<PacienteContexto, 'peso_kg' | 'especie'>;
  tipo?: 'industrializado' | 'manipulado';
  principio_ativo?: string;
  nome_comercial_sugerido?: string;
  dose_mg_kg?: number;
  frequencia_horas?: number;
  duracao_dias?: number;
  icone_via?: ViaAdministracao;
  condicao_alimentar?: CondicaoAlimentar;
  orientacoes_tutor?: string;
  veiculo_manipulado?: VeiculoManipulado;
  sabor_manipulado?: string;
  origem_ia?: boolean;
}): ItemPrescricao {
  const { regra, paciente } = params;
  const pesoKg = Math.max(0.05, Number(paciente.peso_kg) || 1);
  const especie = paciente.especie || 'canina';

  const tipo = params.tipo ?? regra?.tipo_padrao ?? 'industrializado';
  const principioAtivo = params.principio_ativo ?? regra?.principio_ativo ?? 'Fármaco prescrito';
  const frequenciaHoras = params.frequencia_horas ?? regra?.frequencia_horas_padrao ?? 12;
  const duracaoDias = params.duracao_dias ?? regra?.duracao_dias_padrao ?? 7;
  const iconeVia = params.icone_via ?? regra?.icone_via ?? 'oral';
  const condicaoAlimentar = params.condicao_alimentar ?? regra?.condicao_alimentar ?? 'com_alimento';

  // Ajuste inteligente de dose padrão para felinos quando aplicável
  let doseMgKg = params.dose_mg_kg ?? regra?.dose_padrao_mg_kg ?? 10;
  if (
    params.dose_mg_kg === undefined &&
    especie === 'felina' &&
    regra?.dose_felina_max_mg_kg !== undefined &&
    regra.dose_felina_max_mg_kg !== null &&
    regra.dose_felina_max_mg_kg > 0 &&
    doseMgKg > regra.dose_felina_max_mg_kg
  ) {
    doseMgKg = regra.dose_felina_max_mg_kg;
  }

  const doseCalculadaMg = arredondar(doseMgKg * pesoKg, 2);
  const tomadasPorDia = Math.max(1, Math.round(24 / Math.max(1, frequenciaHoras)));
  const totalDoses = Math.max(1, Math.ceil((24 / Math.max(1, frequenciaHoras)) * duracaoDias));

  let nomeComercial = params.nome_comercial_sugerido ?? regra?.nome_comercial_sugerido ?? principioAtivo;
  let apresentacaoEscolhida = 'comprimido';
  let quantidadePorTomada = '1 unidade';
  let manipulado: ManipuladoDetalhes | null = null;

  if (tipo === 'manipulado') {
    const veiculoPadrao: VeiculoManipulado =
      params.veiculo_manipulado ??
      (especie === 'felina' && principioAtivo.toLowerCase().includes('amitriptilina')
        ? 'gel_transdermico'
        : especie === 'felina'
          ? 'pasta_oral'
          : 'biscoito_palatavel');

    const sabores = SABORES_POR_ESPECIE[especie] || SABORES_POR_ESPECIE.canina;
    const saborEscolhido =
      params.sabor_manipulado ??
      (veiculoPadrao === 'gel_transdermico' ? 'Sem sabor (Gel Transdérmico)' : sabores[0]);

    apresentacaoEscolhida = `${ROTULO_VEICULO_MANIPULADO[veiculoPadrao]} (${saborEscolhido})`;

    if (veiculoPadrao === 'suspensao_oral') {
      const volumeTomadaMl = pesoKg <= 5 ? 1 : 2;
      const volumeTotalMl = Math.ceil((totalDoses * volumeTomadaMl) / 10) * 10;
      quantidadePorTomada = `${volumeTomadaMl} mL (${formatarNumeroPtBr(doseCalculadaMg)} mg/dose)`;
      manipulado = {
        veiculo: veiculoPadrao,
        sabor: saborEscolhido,
        dose_unitaria_mg: doseCalculadaMg,
        quantidade_total_unidades: `q.s.p. ${volumeTotalMl} mL (${formatarNumeroPtBr(doseCalculadaMg)} mg a cada ${volumeTomadaMl} mL)`,
      };
    } else if (veiculoPadrao === 'gel_transdermico') {
      quantidadePorTomada = `1 clique dosador (0,1 mL = ${formatarNumeroPtBr(doseCalculadaMg)} mg) no pavilhão auricular interno`;
      manipulado = {
        veiculo: veiculoPadrao,
        sabor: saborEscolhido,
        dose_unitaria_mg: doseCalculadaMg,
        quantidade_total_unidades: `1 seringa dosadora transdérmica q.s.p. ${totalDoses} doses de ${formatarNumeroPtBr(doseCalculadaMg)} mg`,
      };
    } else {
      const rotuloUnidade =
        veiculoPadrao === 'biscoito_palatavel'
          ? 'biscoito palatável'
          : veiculoPadrao === 'pasta_oral'
            ? 'dose de pasta oral'
            : 'cápsula';
      quantidadePorTomada = `1 ${rotuloUnidade} (${formatarNumeroPtBr(doseCalculadaMg)} mg)`;
      manipulado = {
        veiculo: veiculoPadrao,
        sabor: saborEscolhido,
        dose_unitaria_mg: doseCalculadaMg,
        quantidade_total_unidades: `q.s.p. ${totalDoses} doses de ${formatarNumeroPtBr(doseCalculadaMg)} mg — Sabor ${saborEscolhido}`,
      };
    }
    nomeComercial = `${principioAtivo} — ${ROTULO_VEICULO_MANIPULADO[veiculoPadrao]}`;
  } else if (regra && regra.apresentacoes.length > 0) {
    // Escolhe a apresentação comercial mais prática para o peso do paciente
    const apGotasOto = regra.apresentacoes.find((a) => a.forma === 'gotas_otologicas');
    const apPipeta = regra.apresentacoes.find((a) => a.forma === 'pipeta_topica');
    const apGotas = regra.apresentacoes.find((a) => a.forma === 'gotas');
    const apComprimidos = regra.apresentacoes.filter((a) => a.forma === 'comprimido' && a.concentracao_mg);
    const apSuspensao = regra.apresentacoes.find((a) => a.forma === 'suspensao_ml' && a.concentracao_mg_ml);

    if (apGotasOto) {
      nomeComercial = apGotasOto.rotulo;
      apresentacaoEscolhida = 'suspensão otológica (gotas)';
      quantidadePorTomada = pesoKg < 15 ? '4 gotas em cada orelha afetada' : '8 gotas em cada orelha afetada';
    } else if (apPipeta) {
      nomeComercial = apPipeta.rotulo;
      apresentacaoEscolhida = 'pipeta spot-on';
      quantidadePorTomada = `1 pipeta para faixa de ${formatarNumeroPtBr(pesoKg)} kg`;
    } else if (apGotas && apGotas.concentracao_mg_gota) {
      nomeComercial = apGotas.rotulo;
      apresentacaoEscolhida = 'solução oral (gotas)';
      const numGotas = Math.max(1, Math.round(doseCalculadaMg / apGotas.concentracao_mg_gota));
      quantidadePorTomada = `${numGotas} ${numGotas === 1 ? 'gota' : 'gotas'} (${formatarNumeroPtBr(doseCalculadaMg)} mg)`;
    } else if (apComprimidos.length > 0) {
      // Testa qual concentração comercial gera a menor quantidade de comprimidos dentro de frações práticas (1/2 a 1,5 comp)
      let melhorComp = apComprimidos[0];
      let melhorFracao = formatarFracaoComprimido(doseCalculadaMg / (melhorComp.concentracao_mg || 1));
      let melhorScore = Number.POSITIVE_INFINITY;

      for (const comp of apComprimidos) {
        const conc = comp.concentracao_mg || 1;
        const razao = doseCalculadaMg / conc;
        const fracao = formatarFracaoComprimido(razao);
        // Prefere apresentações entre 0,4 e 1,5 comprimido por tomada (evita dar 3 comprimidos quando 1/2 de 250mg resolve)
        const penalidade = razao < 0.35 ? 0.6 : razao > 1.6 ? 0.35 * razao : 0;
        const score = fracao.erroRelativo + penalidade;
        if (score < melhorScore) {
          melhorScore = score;
          melhorComp = comp;
          melhorFracao = fracao;
        }
      }

      // Se o paciente for muito pequeno e houver suspensão oral disponível com melhor precisão
      if (melhorScore > 0.35 && apSuspensao && apSuspensao.concentracao_mg_ml) {
        nomeComercial = apSuspensao.rotulo;
        apresentacaoEscolhida = 'suspensão oral';
        const ml = arredondar(doseCalculadaMg / apSuspensao.concentracao_mg_ml, 1);
        quantidadePorTomada = `${formatarNumeroPtBr(Math.max(0.1, ml))} mL`;
      } else {
        nomeComercial = melhorComp.rotulo;
        apresentacaoEscolhida = 'comprimido';
        quantidadePorTomada = melhorFracao.rotulo;
      }
    } else if (apSuspensao && apSuspensao.concentracao_mg_ml) {
      nomeComercial = apSuspensao.rotulo;
      apresentacaoEscolhida = 'suspensão oral';
      const ml = arredondar(doseCalculadaMg / apSuspensao.concentracao_mg_ml, 1);
      quantidadePorTomada = `${formatarNumeroPtBr(Math.max(0.1, ml))} mL`;
    }
  } else {
    apresentacaoEscolhida = iconeVia === 'otica' || iconeVia === 'topica' ? 'aplicação tópica' : 'comprimido';
    quantidadePorTomada =
      iconeVia === 'otica'
        ? '4 a 6 gotas no conduto auditivo'
        : `${formatarNumeroPtBr(doseCalculadaMg)} mg por tomada`;
  }

  const orientacoesBase = params.orientacoes_tutor ?? regra?.orientacoes_padrao ?? 'Administrar conforme orientação médica.';
  const orientacoesComAlertaEspecie =
    especie === 'felina' && regra?.alerta_felino_especifico && !orientacoesBase.includes(regra.alerta_felino_especifico)
      ? `${orientacoesBase} ${regra.alerta_felino_especifico}`
      : orientacoesBase;

  const memoriaCalculo = `${formatarNumeroPtBr(doseMgKg)} mg/kg × ${formatarNumeroPtBr(pesoKg)} kg = ${formatarNumeroPtBr(doseCalculadaMg)} mg/tomada (${tomadasPorDia}x/dia por ${duracaoDias} dias → ${quantidadePorTomada})`;

  return {
    id: params.id || `item_${Math.random().toString(36).slice(2, 10)}`,
    slug_bulario: regra?.slug ?? null,
    tipo,
    principio_ativo: principioAtivo,
    nome_comercial_sugerido: nomeComercial,
    classe_terapeutica: regra?.classe_terapeutica,
    dose_mg_kg: doseMgKg,
    posologia: {
      dose_calculada_mg: doseCalculadaMg,
      apresentacao_escolhida: apresentacaoEscolhida,
      quantidade_por_tomada: quantidadePorTomada,
      frequencia_horas: frequenciaHoras,
      duracao_dias: duracaoDias,
    },
    orientacoes_tutor: orientacoesComAlertaEspecie,
    icone_via: iconeVia,
    condicao_alimentar: condicaoAlimentar,
    memoria_calculo: memoriaCalculo,
    manipulado,
    origem_ia: params.origem_ia ?? true,
  };
}

/**
 * Validação Determinística de Regras Duras (Hard Rules Validation - RF-04 e Seção 9).
 * Avalia contraindicações por espécie (ex.: Paracetamol em felinos), mutação MDR1 (ex.: Ivermectina em Collie),
 * sobredoses/subdoses, comorbidades e interações medicamentosas entre os itens prescritos.
 */
export function validarSegurancaPrescricao(
  paciente: PacienteContexto,
  itens: ItemPrescricao[],
  bulario: RegraBulario[] = BULARIO_PADRAO
): ResultadoValidacaoPrescricao {
  const alertas: AlertaValidacaoItem[] = [];
  const alertasPorItem: Record<string, AlertaValidacaoItem[]> = {};
  const temMdr1 = Boolean(paciente.mutacao_mdr1) || detectarRiscoMdr1PorRaca(paciente.especie, paciente.raca);
  const comorbidadesPaciente = (paciente.comorbidades || []).map((c) => c.toLowerCase().trim());
  const alergiasPaciente = (paciente.alergias || []).map((a) => a.toLowerCase().trim());

  const registrar = (alerta: AlertaValidacaoItem) => {
    alertas.push(alerta);
    if (alerta.item_id) {
      if (!alertasPorItem[alerta.item_id]) alertasPorItem[alerta.item_id] = [];
      alertasPorItem[alerta.item_id].push(alerta);
    }
  };

  const regrasResolvidas: Array<{ item: ItemPrescricao; regra?: RegraBulario }> = itens.map((item) => ({
    item,
    regra: localizarRegraBulario(item.slug_bulario || item.principio_ativo || item.nome_comercial_sugerido, bulario),
  }));

  for (const { item, regra } of regrasResolvidas) {
    const textoItemLower = `${item.principio_ativo} ${item.nome_comercial_sugerido}`.toLowerCase();

    // 1. Verificação de alergia declarada do paciente
    for (const alergia of alergiasPaciente) {
      if (alergia.length >= 3 && textoItemLower.includes(alergia)) {
        registrar({
          id: `alergia_${item.id}`,
          item_id: item.id,
          principio_ativo: item.principio_ativo,
          nivel: 'critico',
          cor: 'vermelho',
          categoria: 'comorbidade',
          titulo: `Alergia Registrada ao Fármaco (${item.principio_ativo})`,
          mensagem: `O paciente ${paciente.nome} possui alergia registrada a "${alergia}". Emissão bloqueada por segurança.`,
          bloqueia_emissao: true,
        });
      }
    }

    if (!regra) continue;

    // 2. Contraindicação primária por espécie (ex.: Paracetamol ou Permetrina em felinos, Ibuprofeno em cães/gatos)
    if (regra.especies_contraindicadas.includes(paciente.especie)) {
      registrar({
        id: `especie_toxica_${item.id}`,
        item_id: item.id,
        principio_ativo: item.principio_ativo,
        nivel: 'critico',
        cor: 'vermelho',
        categoria: 'especie_toxica',
        titulo: `Contraindicação Absoluta para Espécie ${paciente.especie.toUpperCase()}`,
        mensagem:
          regra.motivo_contraindicacao_especie ||
          `${item.principio_ativo} é contraindicado e potencialmente tóxico para a espécie ${paciente.especie}.`,
        bloqueia_emissao: true,
      });
      continue;
    }

    // 3. Mutação no gene MDR1 / Sensibilidade racial (ex.: Ivermectina, Loperamida em Collie/Shetland/Pastor Australiano)
    if (regra.risco_mdr1 && temMdr1) {
      registrar({
        id: `mdr1_${item.id}`,
        item_id: item.id,
        principio_ativo: item.principio_ativo,
        nivel: 'critico',
        cor: 'vermelho',
        categoria: 'mdr1',
        titulo: `Alerta Crítico de Sensibilidade Racial / Gene MDR1 (${paciente.raca || 'Portador MDR1'})`,
        mensagem:
          regra.mensagem_mdr1 ||
          `Paciente com risco para mutação no gene MDR1 (ABCB1). ${item.principio_ativo} pode atravessar a barreira hematoencefálica e causar neurotoxicidade severa.`,
        bloqueia_emissao: true,
      });
    }

    // 4. Limite máximo específico para felinos (ex.: Enrofloxacino > 5 mg/kg/dia = degeneração retiniana)
    if (
      paciente.especie === 'felina' &&
      regra.dose_felina_max_mg_kg !== undefined &&
      regra.dose_felina_max_mg_kg !== null &&
      regra.dose_felina_max_mg_kg > 0 &&
      item.dose_mg_kg > regra.dose_felina_max_mg_kg
    ) {
      registrar({
        id: `felino_max_${item.id}`,
        item_id: item.id,
        principio_ativo: item.principio_ativo,
        nivel: 'critico',
        cor: 'vermelho',
        categoria: 'sobredose',
        titulo: `Dose Acima do Teto Seguro para Felinos (${formatarNumeroPtBr(item.dose_mg_kg)} mg/kg)`,
        mensagem:
          regra.alerta_felino_especifico ||
          `A dose máxima segura de ${item.principio_ativo} para felinos é ${formatarNumeroPtBr(regra.dose_felina_max_mg_kg)} mg/kg.`,
        bloqueia_emissao: true,
      });
    } else if (regra.dose_toxica_mg_kg && item.dose_mg_kg >= regra.dose_toxica_mg_kg) {
      // 5. Dose tóxica geral
      registrar({
        id: `dose_toxica_${item.id}`,
        item_id: item.id,
        principio_ativo: item.principio_ativo,
        nivel: 'critico',
        cor: 'vermelho',
        categoria: 'sobredose',
        titulo: `Sobredose Tóxica Detectada (${formatarNumeroPtBr(item.dose_mg_kg)} mg/kg)`,
        mensagem: `A dose informada (${formatarNumeroPtBr(item.dose_mg_kg)} mg/kg) atinge ou ultrapassa o limiar tóxico (${formatarNumeroPtBr(regra.dose_toxica_mg_kg)} mg/kg). Faixa recomendada: ${formatarNumeroPtBr(regra.dose_min_mg_kg)} a ${formatarNumeroPtBr(regra.dose_max_mg_kg)} mg/kg.`,
        bloqueia_emissao: true,
      });
    } else if (regra.dose_max_mg_kg > 0 && item.dose_mg_kg > regra.dose_max_mg_kg * 1.05) {
      // 6. Dose limítrofe acima da faixa terapêutica usual
      registrar({
        id: `dose_alta_${item.id}`,
        item_id: item.id,
        principio_ativo: item.principio_ativo,
        nivel: 'medio',
        cor: 'amarelo',
        categoria: 'sobredose',
        titulo: `Dosagem Acima da Faixa Usual (${formatarNumeroPtBr(item.dose_mg_kg)} mg/kg)`,
        mensagem: `A faixa recomendada no bulário para ${item.principio_ativo} é de ${formatarNumeroPtBr(regra.dose_min_mg_kg)} a ${formatarNumeroPtBr(regra.dose_max_mg_kg)} mg/kg.`,
        bloqueia_emissao: false,
      });
    } else if (regra.dose_min_mg_kg > 0 && item.dose_mg_kg < regra.dose_min_mg_kg * 0.9) {
      // 7. Subdose terapêutica
      registrar({
        id: `subdose_${item.id}`,
        item_id: item.id,
        principio_ativo: item.principio_ativo,
        nivel: 'medio',
        cor: 'amarelo',
        categoria: 'subdose',
        titulo: `Subdose Terapêutica (${formatarNumeroPtBr(item.dose_mg_kg)} mg/kg)`,
        mensagem: `A dose informada está abaixo do mínimo recomendado (${formatarNumeroPtBr(regra.dose_min_mg_kg)} mg/kg), podendo comprometer a eficácia clínica.`,
        bloqueia_emissao: false,
      });
    }

    // 8. Cautelas específicas de espécie (ex.: Doxiciclina ou Dipirona em gatos)
    if (paciente.especie === 'felina' && regra.alerta_felino_especifico && item.dose_mg_kg <= (regra.dose_felina_max_mg_kg ?? 999)) {
      registrar({
        id: `cautela_felina_${item.id}`,
        item_id: item.id,
        principio_ativo: item.principio_ativo,
        nivel: 'medio',
        cor: 'amarelo',
        categoria: 'cautela_especie',
        titulo: `Cuidado Específico para Paciente Felino`,
        mensagem: regra.alerta_felino_especifico,
        bloqueia_emissao: false,
      });
    }

    // 9. Comorbidades do paciente vs cautelas do fármaco
    for (const comorb of regra.comorbidades_cautela) {
      if (comorbidadesPaciente.some((c) => c.includes(comorb.replace('_', ' ')) || c.includes(comorb))) {
        registrar({
          id: `comorb_${item.id}_${comorb}`,
          item_id: item.id,
          principio_ativo: item.principio_ativo,
          nivel: 'alto',
          cor: 'amarelo',
          categoria: 'comorbidade',
          titulo: `Atenção à Comorbidade Prévia (${comorb.replace(/_/g, ' ')})`,
          mensagem: `${item.principio_ativo} exige ajuste posológico ou monitoramento rigoroso em pacientes com ${comorb.replace(/_/g, ' ')}.`,
          bloqueia_emissao: false,
        });
      }
    }
  }

  // 10. Interações Medicamentosas entre pares de itens da prescrição
  for (let i = 0; i < regrasResolvidas.length; i++) {
    for (let j = i + 1; j < regrasResolvidas.length; j++) {
      const a = regrasResolvidas[i];
      const b = regrasResolvidas[j];
      if (!a.regra || !b.regra) continue;

      const classeA = a.regra.classe_terapeutica;
      const classeB = b.regra.classe_terapeutica;

      // Interação Crítica: AINE + Corticoide ou AINE + AINE
      if (
        (classeA === 'aine' && classeB === 'corticoide') ||
        (classeA === 'corticoide' && classeB === 'aine') ||
        (classeA === 'aine' && classeB === 'aine')
      ) {
        const msg =
          classeA === 'aine' && classeB === 'aine'
            ? `Associação duplicada de anti-inflamatórios não esteroidais (${a.item.principio_ativo} + ${b.item.principio_ativo}): risco severo de nefrotoxicidade e ulceração gastrointestinal.`
            : `Interação Medicamentosa Grave (${a.item.principio_ativo} + ${b.item.principio_ativo}): A associação de AINE com Corticoide aumenta drasticamente o risco de ulceração e perfuração gastrointestinal.`;
        registrar({
          id: `interacao_aine_${a.item.id}_${b.item.id}`,
          item_id: a.item.id,
          principio_ativo: `${a.item.principio_ativo} + ${b.item.principio_ativo}`,
          nivel: 'alto',
          cor: 'vermelho',
          categoria: 'interacao',
          titulo: 'Interação Medicamentosa Grave: AINE + Corticoide/AINE',
          mensagem: msg,
          bloqueia_emissao: true,
        });
      } else if (
        a.regra.interacoes_classes.includes(classeB) ||
        b.regra.interacoes_classes.includes(classeA)
      ) {
        registrar({
          id: `interacao_mod_${a.item.id}_${b.item.id}`,
          item_id: a.item.id,
          principio_ativo: `${a.item.principio_ativo} + ${b.item.principio_ativo}`,
          nivel: 'medio',
          cor: 'amarelo',
          categoria: 'interacao',
          titulo: `Interação Medicamentosa: ${a.item.principio_ativo} + ${b.item.principio_ativo}`,
          mensagem: `Administração conjunta de ${a.item.principio_ativo} e ${b.item.principio_ativo} requer cautela ou espaçamento de horários (mínimo de 2h).`,
          bloqueia_emissao: false,
        });
      }
    }
  }

  const temVermelho = alertas.some((a) => a.cor === 'vermelho' || a.bloqueia_emissao);
  const temAmarelo = alertas.some((a) => a.cor === 'amarelo');

  const nivelGlobal: NivelAlertaSeguranca = temVermelho
    ? alertas.some((a) => a.nivel === 'critico')
      ? 'critico'
      : 'alto'
    : temAmarelo
      ? 'medio'
      : 'baixo';

  const corGlobal: CorSemanticaAlerta = temVermelho ? 'vermelho' : temAmarelo ? 'amarelo' : 'verde';

  const mensagemGlobal =
    alertas.length > 0
      ? alertas.map((a) => `${a.titulo}: ${a.mensagem}`).join(' | ')
      : null;

  return {
    alerta_seguranca: {
      nivel: nivelGlobal,
      mensagem: mensagemGlobal,
    },
    cor_semantica: corGlobal,
    bloqueia_emissao: temVermelho,
    alertas,
    alertas_por_item: alertasPorItem,
  };
}

/**
 * Gera a Grade Visual de Cronograma (RF-05) distribuindo os itens prescritos em horários claros
 * do dia com ícones de turno (manhã, tarde, noite) e recomendação alimentar.
 */
export function gerarGradeCronograma(itens: ItemPrescricao[]): SlotCronograma[] {
  const mapaHorarios: Record<number, string[]> = {
    4: ['06:00', '10:00', '14:00', '18:00', '22:00'],
    6: ['06:00', '12:00', '18:00', '23:30'],
    8: ['06:00', '14:00', '22:00'],
    12: ['08:00', '20:00'],
    24: ['08:00'],
    48: ['08:00 (A cada 48h)'],
    72: ['08:00 (A cada 72h)'],
    168: ['08:00 (1x por semana)'],
  };

  const slotsMap = new Map<string, SlotCronograma>();

  const classificarPeriodo = (horario: string): { periodo: 'manha' | 'tarde' | 'noite'; rotulo: string } => {
    const hora = parseInt(horario.slice(0, 2), 10);
    if (hora < 12) return { periodo: 'manha', rotulo: 'Manhã' };
    if (hora < 18) return { periodo: 'tarde', rotulo: 'Tarde' };
    return { periodo: 'noite', rotulo: 'Noite' };
  };

  for (const item of itens) {
    const freq = item.posologia.frequencia_horas;
    // Se for omeprazol (jejum) 24h, aloca às 07:00 antes da refeição das 08:00
    const horarios =
      item.condicao_alimentar === 'jejum' && freq === 24
        ? ['07:00']
        : mapaHorarios[freq] || ['08:00', '20:00'];

    for (const h of horarios) {
      if (!slotsMap.has(h)) {
        const { periodo, rotulo } = classificarPeriodo(h);
        slotsMap.set(h, {
          horario: h,
          periodo,
          rotulo_periodo: rotulo,
          itens: [],
        });
      }
      slotsMap.get(h)!.itens.push({
        item_id: item.id,
        nome_exibicao: item.nome_comercial_sugerido || item.principio_ativo,
        principio_ativo: item.principio_ativo,
        quantidade_por_tomada: item.posologia.quantidade_por_tomada,
        icone_via: item.icone_via,
        condicao_alimentar: item.condicao_alimentar,
        rotulo_alimentar: ROTULO_CONDICAO_ALIMENTAR[item.condicao_alimentar],
        duracao_dias: item.posologia.duracao_dias,
      });
    }
  }

  return Array.from(slotsMap.values()).sort((a, b) => a.horario.localeCompare(b.horario));
}

/**
 * Extrai pistas clínicas estruturadas (peso, espécie, raça) de uma frase em linguagem natural (RF-02).
 * Ex.: "Otite fúngica canina bilateral moderada em cão de 12kg" -> { peso_kg: 12, especie: 'canina' }
 */
export function extrairContextoEntradaClinica(texto: string): {
  peso_kg?: number;
  especie?: EspeciePaciente;
  raca?: string;
} {
  const limpo = texto.toLowerCase();
  const resultado: { peso_kg?: number; especie?: EspeciePaciente; raca?: string } = {};

  // Peso: "12kg", "12,5 kg", "4.2kg"
  const matchPeso = limpo.match(/(\d+(?:[.,]\d+)?)\s*kg\b/i);
  if (matchPeso) {
    const num = parseFloat(matchPeso[1].replace(',', '.'));
    if (num > 0 && num <= 250) {
      resultado.peso_kg = num;
    }
  }

  // Espécie
  if (/\b(gato|gata|felino|felina|felinos|bichano)\b/i.test(limpo)) {
    resultado.especie = 'felina';
  } else if (/\b(coelho|calopsita|hamster|porquinho|jabuti|papagaio|ave|silvestre|exótico|exotico)\b/i.test(limpo)) {
    resultado.especie = 'silvestre';
  } else if (/\b(cão|cao|cadela|cachorro|canino|canina)\b/i.test(limpo)) {
    resultado.especie = 'canina';
  }

  // Raça comum ou sensível a MDR1 mencionada no texto
  for (const racaMdr1 of RACAS_SENSIVEIS_MDR1) {
    if (limpo.includes(racaMdr1)) {
      resultado.raca = racaMdr1
        .split(' ')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');
      break;
    }
  }

  return resultado;
}

/**
 * Copiloto Clínico Determinístico (executa em < 10ms no cliente ou como base/fallback da Edge Function).
 * Interpreta a frase clínica em linguagem natural, seleciona os fármacos adequados, calcula as doses
 * pelo peso e espécie do paciente e retorna tantos os itens estruturados quanto o JSON da Seção 8.1.
 */
export function gerarSugestaoCopilotoLocal(
  entradaClinica: string,
  paciente: PacienteContexto,
  bulario: RegraBulario[] = BULARIO_PADRAO,
  protocolos: ProtocoloClinico[] = PROTOCOLOS_PADRAO
): {
  itens: ItemPrescricao[];
  validacao: ResultadoValidacaoPrescricao;
  payload_prd: PayloadPosologicoIA;
  protocolo_aplicado?: string | null;
} {
  const textoLower = entradaClinica.toLowerCase();
  const slugsEscolhidos = new Map<string, { dose_mg_kg?: number; frequencia_horas?: number; duracao_dias?: number }>();
  let protocoloAplicado: string | null = null;

  // 1. Verifica se o veterinário mencionou explicitamente algum fármaco pelo nome ou princípio ativo
  for (const regra of bulario) {
    const mencionouDireto =
      textoLower.includes(regra.slug.replace(/-/g, ' ')) ||
      textoLower.includes(regra.principio_ativo.toLowerCase().split(' ')[0]) ||
      textoLower.includes(regra.nome_comercial_sugerido.toLowerCase().split(' ')[0]) ||
      regra.palavras_chave.some((k) => k.length >= 5 && textoLower.includes(k.toLowerCase()));

    if (mencionouDireto) {
      slugsEscolhidos.set(regra.slug, {});
    }
  }

  // 2. Verifica correspondência com protocolos clínicos por hipótese diagnóstica ou sinais clínicos
  for (const prot of protocolos) {
    if (prot.especie_alvo !== 'ambas' && prot.especie_alvo !== paciente.especie) {
      continue;
    }
    const bateuGatilho = prot.palavras_gatilho.some((g) => textoLower.includes(g.toLowerCase()));
    if (bateuGatilho) {
      if (!protocoloAplicado) protocoloAplicado = prot.titulo;
      for (const itemTpl of prot.itens_template) {
        if (!slugsEscolhidos.has(itemTpl.slug)) {
          slugsEscolhidos.set(itemTpl.slug, {
            dose_mg_kg: itemTpl.dose_mg_kg,
            frequencia_horas: itemTpl.frequencia_horas,
            duracao_dias: itemTpl.duracao_dias,
          });
        }
      }
    }
  }

  // 3. Se nenhuma palavra-chave específica bateu, sugere protocolo clínico base seguro conforme sinais gerais
  if (slugsEscolhidos.size === 0) {
    if (textoLower.includes('manipulad') || textoLower.includes('biscoito') || textoLower.includes('pasta')) {
      slugsEscolhidos.set('gabapentina-manipulada', {});
    } else {
      slugsEscolhidos.set('amoxicilina-clavulanato', { dose_mg_kg: 12.5, frequencia_horas: 12, duracao_dias: 10 });
    }
  }

  // Se o texto pedir explicitamente manipulado, converte os itens elegíveis
  const pediuManipulado = /\b(manipulad[oa]|biscoito|pasta oral|transd[eé]rmic[oa])\b/i.test(textoLower);

  const itens: ItemPrescricao[] = [];
  let idx = 1;
  for (const [slug, custom] of slugsEscolhidos.entries()) {
    const regra = bulario.find((b) => b.slug === slug);
    if (!regra) continue;

    // Evita associar automaticamente Prednisolona + Meloxicam na sugestão automática a menos que ambos tenham sido nominalmente pedidos
    if (
      regra.classe_terapeutica === 'corticoide' &&
      itens.some((i) => i.classe_terapeutica === 'aine') &&
      !textoLower.includes('prednisolona') &&
      !textoLower.includes('prediderm')
    ) {
      continue;
    }
    if (
      regra.classe_terapeutica === 'aine' &&
      itens.some((i) => i.classe_terapeutica === 'corticoide') &&
      !textoLower.includes('meloxicam') &&
      !textoLower.includes('maxicam')
    ) {
      continue;
    }

    const itemCalculado = calcularPosologiaItem({
      id: `ia_${Date.now()}_${idx++}`,
      regra,
      paciente,
      tipo: pediuManipulado ? 'manipulado' : regra.tipo_padrao,
      dose_mg_kg: custom.dose_mg_kg,
      frequencia_horas: custom.frequencia_horas,
      duracao_dias: custom.duracao_dias,
      origem_ia: true,
    });
    itens.push(itemCalculado);
  }

  const validacao = validarSegurancaPrescricao(paciente, itens, bulario);

  const payloadPrd: PayloadPosologicoIA = {
    alerta_seguranca: validacao.alerta_seguranca,
    itens_prescricao: itens.map((it) => ({
      tipo: it.tipo,
      principio_ativo: it.principio_ativo,
      nome_comercial_sugerido: it.nome_comercial_sugerido,
      posologia: it.posologia,
      orientacoes_tutor: it.orientacoes_tutor,
      icone_via: it.icone_via,
      dose_mg_kg: it.dose_mg_kg,
      slug_bulario: it.slug_bulario,
      condicao_alimentar: it.condicao_alimentar,
      manipulado: it.manipulado,
    })),
  };

  return {
    itens,
    validacao,
    payload_prd: payloadPrd,
    protocolo_aplicado: protocoloAplicado,
  };
}
