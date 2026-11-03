import {
  BULARIO_PADRAO,
  type RegraBulario,
  type ApresentacaoComercial,
  type EspeciePaciente,
  type ViaAdministracao,
  type CondicaoAlimentar,
} from './receituarioMotor.ts';

export interface ResultadoParseCsvBulario {
  itens: RegraBulario[];
  erros: string[];
  totalLido: number;
}

/** Remove acentos e converte para minúsculas para comparação flexível de chaves. */
function normalizarChave(chave: string): string {
  return chave
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Converte texto para slug URL-friendly sem acentos. */
export function gerarSlugBulario(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Converte número com vírgula ou ponto para number seguro. */
function parseNumero(valor: any, padrao = 0): number {
  if (typeof valor === 'number') return isNaN(valor) ? padrao : valor;
  if (!valor) return padrao;
  const str = String(valor).trim().replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? padrao : num;
}

/** Converte texto em booleano. */
function parseBooleano(valor: any): boolean {
  if (typeof valor === 'boolean') return valor;
  if (!valor) return false;
  const str = String(valor).trim().toLowerCase();
  return ['true', '1', 'sim', 's', 'yes', 'y'].includes(str);
}

/** Converte lista separada por vírgula ou ponto-e-vírgula em array limpo. */
function parseListaTexto(valor: any): string[] {
  if (Array.isArray(valor)) return valor.map(String).map((s) => s.trim()).filter(Boolean);
  if (!valor) return [];
  return String(valor)
    .split(/[,;\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Identifica delimitador predominante na primeira linha do CSV. */
function detectarDelimitador(primeiraLinha: string): string {
  const contagemPontoVirgula = (primeiraLinha.match(/;/g) || []).length;
  const contagemVirgula = (primeiraLinha.match(/,/g) || []).length;
  const contagemTab = (primeiraLinha.match(/\t/g) || []).length;

  if (contagemPontoVirgula >= contagemVirgula && contagemPontoVirgula >= contagemTab && contagemPontoVirgula > 0) {
    return ';';
  }
  if (contagemTab > contagemVirgula && contagemTab > 0) {
    return '\t';
  }
  return ',';
}

/**
 * Parser de CSV compatível com RFC 4180 (aspas duplas com quebras de linha e delimitadores).
 */
export function dividirCsvEmLinhas(csvText: string, delimitador?: string): string[][] {
  const textoLimpo = csvText.replace(/^\uFEFF/, ''); // Remove BOM se presente
  const linhasBrutas = textoLimpo.split(/\r\n|\n|\r/);
  const sep = delimitador || detectarDelimitador(linhasBrutas[0] || '');

  const resultado: string[][] = [];
  let linhaAtual: string[] = [];
  let campoAtual = '';
  let dentroDeAspas = false;

  for (let i = 0; i < textoLimpo.length; i++) {
    const char = textoLimpo[i];
    const proximoChar = textoLimpo[i + 1];

    if (char === '"') {
      if (dentroDeAspas && proximoChar === '"') {
        campoAtual += '"';
        i++; // pula aspas escapadas
      } else {
        dentroDeAspas = !dentroDeAspas;
      }
    } else if (char === sep && !dentroDeAspas) {
      linhaAtual.push(campoAtual.trim());
      campoAtual = '';
    } else if ((char === '\n' || char === '\r') && !dentroDeAspas) {
      if (char === '\r' && proximoChar === '\n') {
        i++; // pula \r\n
      }
      linhaAtual.push(campoAtual.trim());
      if (linhaAtual.some((c) => c.length > 0)) {
        resultado.push(linhaAtual);
      }
      linhaAtual = [];
      campoAtual = '';
    } else {
      campoAtual += char;
    }
  }

  if (campoAtual.length > 0 || linhaAtual.length > 0) {
    linhaAtual.push(campoAtual.trim());
    if (linhaAtual.some((c) => c.length > 0)) {
      resultado.push(linhaAtual);
    }
  }

  return resultado;
}

/**
 * Converte apresentações em string simples ou JSON para ApresentacaoComercial[].
 * Aceita:
 *  - JSON: '[{"rotulo":"Synulox 250 mg","forma":"comprimido","concentracao_mg":250}]'
 *  - Texto livre: "Synulox 50mg comp; Synulox 250mg comp (divisivel); Gotas 50mg/ml"
 */
export function normalizarApresentacoes(valor: any, nomePadrao = ''): ApresentacaoComercial[] {
  if (Array.isArray(valor) && valor.length > 0) {
    return valor.map((ap) => ({
      rotulo: ap.rotulo || ap.nome || nomePadrao || 'Apresentação',
      forma: ap.forma || 'comprimido',
      concentracao_mg: ap.concentracao_mg ? Number(ap.concentracao_mg) : undefined,
      concentracao_mg_ml: ap.concentracao_mg_ml ? Number(ap.concentracao_mg_ml) : undefined,
      concentracao_mg_gota: ap.concentracao_mg_gota ? Number(ap.concentracao_mg_gota) : undefined,
      divisivel: typeof ap.divisivel === 'boolean' ? ap.divisivel : true,
    }));
  }

  if (!valor) return [];

  const str = String(valor).trim();
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        return normalizarApresentacoes(parsed, nomePadrao);
      }
    } catch {
      // continua para o parser de texto
    }
  }

  // Parse de texto simples separado por ponto-e-vírgula, barra vertical ou quebra de linha
  const partes = str.split(/[;\n|]/).map((p) => p.trim()).filter(Boolean);
  return partes.map((p) => {
    let forma: ApresentacaoComercial['forma'] = 'comprimido';
    const pMin = p.toLowerCase();
    if (pMin.includes('gota')) forma = 'gotas';
    else if (pMin.includes('susp') || pMin.includes('xarope') || pMin.includes('oral') || pMin.includes('ml'))
      forma = 'suspensao_ml';
    else if (pMin.includes('otolog') || pMin.includes('ouvido')) forma = 'gotas_otologicas';
    else if (pMin.includes('pipeta') || pMin.includes('spot-on') || pMin.includes('topico'))
      forma = 'pipeta_topica';
    else if (pMin.includes('manipul')) forma = 'manipulado';

    // Tenta extrair concentração em mg ou mg/ml
    const matchMg = p.match(/(\d+(?:[.,]\d+)?)\s*mg\b/i);
    const matchMgMl = p.match(/(\d+(?:[.,]\d+)?)\s*mg\/ml/i);

    return {
      rotulo: p,
      forma,
      concentracao_mg: matchMg ? parseNumero(matchMg[1]) : undefined,
      concentracao_mg_ml: matchMgMl ? parseNumero(matchMgMl[1]) : undefined,
      divisivel: !pMin.includes('não divisível') && !pMin.includes('nao divisivel'),
    };
  });
}

/**
 * Converte espécies permitidas em array normalizado ('canina', 'felina', 'silvestre').
 */
function normalizarEspecies(valor: any): EspeciePaciente[] {
  const lista = parseListaTexto(valor);
  if (lista.length === 0) return ['canina', 'felina'];

  const permitidas = new Set<EspeciePaciente>();
  for (const item of lista) {
    if (item.includes('cao') || item.includes('cão') || item.includes('can') || item.includes('dog')) {
      permitidas.add('canina');
    } else if (item.includes('gato') || item.includes('fel') || item.includes('cat')) {
      permitidas.add('felina');
    } else if (item.includes('silv') || item.includes('ave') || item.includes('roedor') || item.includes('coelho')) {
      permitidas.add('silvestre');
    } else if (item.includes('todas') || item.includes('ambas') || item.includes('todos')) {
      permitidas.add('canina');
      permitidas.add('felina');
      permitidas.add('silvestre');
    }
  }

  return permitidas.size > 0 ? Array.from(permitidas) : ['canina', 'felina'];
}

/**
 * Mapeia e normaliza uma linha do CSV para o modelo RegraBulario.
 */
export function parseLinhaParaRegra(
  linha: Record<string, string>,
  numeroLinha: number
): { regra?: RegraBulario; erro?: string } {
  // Encontra chave flexível
  const getValor = (...chavesPossiveis: string[]): string => {
    for (const cp of chavesPossiveis) {
      const chaveNorm = normalizarChave(cp);
      for (const [k, v] of Object.entries(linha)) {
        if (normalizarChave(k) === chaveNorm && v) {
          return String(v).trim();
        }
      }
    }
    return '';
  };

  const principioAtivo = getValor('principio_ativo', 'principio', 'substancia', 'farmaco', 'droga', 'active_ingredient');
  const nomeComercial = getValor('nome_comercial_sugerido', 'nome_comercial', 'nome', 'produto', 'medicamento', 'brand_name') || principioAtivo;

  if (!principioAtivo && !nomeComercial) {
    return { erro: `Linha ${numeroLinha}: "Princípio Ativo" ou "Nome Comercial" não informado.` };
  }

  const principioFinal = principioAtivo || nomeComercial;
  const slugManual = getValor('slug', 'id', 'codigo');
  const slug = slugManual ? gerarSlugBulario(slugManual) : gerarSlugBulario(`${nomeComercial}-${principioFinal}`);

  const classeTerapeutica = getValor('classe_terapeutica', 'classe', 'categoria', 'grupo_terapeutico') || 'clinica_geral';
  const tipoPadraoRaw = getValor('tipo_padrao', 'tipo').toLowerCase();
  const tipoPadrao: 'industrializado' | 'manipulado' = tipoPadraoRaw.includes('manipul') ? 'manipulado' : 'industrializado';

  const viaRaw = getValor('icone_via', 'via', 'via_administracao', 'administracao').toLowerCase();
  let iconeVia: ViaAdministracao = 'oral';
  if (viaRaw.includes('top') || viaRaw.includes('derm')) iconeVia = 'topica';
  else if (viaRaw.includes('ot') || viaRaw.includes('ouvid')) iconeVia = 'otica';
  else if (viaRaw.includes('oft') || viaRaw.includes('olho')) iconeVia = 'oftalmica';
  else if (viaRaw.includes('inj') || viaRaw.includes('sc') || viaRaw.includes('im') || viaRaw.includes('iv')) iconeVia = 'injetavel';
  else if (viaRaw.includes('inal')) iconeVia = 'inalatoria';

  const especiesPermitidas = normalizarEspecies(getValor('especies_permitidas', 'especies', 'animais', 'indicacao_especie'));
  const especiesContraindicadas = normalizarEspecies(getValor('especies_contraindicadas', 'contraindicacoes', 'toxico_para'));

  const dosePadrao = parseNumero(getValor('dose_padrao_mg_kg', 'dose_padrao', 'dose_mg_kg', 'dose'), 1.0);
  const doseMin = parseNumero(getValor('dose_min_mg_kg', 'dose_min', 'dose_minima'), dosePadrao);
  const doseMax = parseNumero(getValor('dose_max_mg_kg', 'dose_max', 'dose_maxima'), dosePadrao);
  const doseToxicaRaw = getValor('dose_toxica_mg_kg', 'dose_toxica', 'dose_letal');
  const doseToxica = doseToxicaRaw ? parseNumero(doseToxicaRaw) : undefined;
  const doseFelinaMaxRaw = getValor('dose_felina_max_mg_kg', 'dose_felina_max', 'teto_felino');
  const doseFelinaMax = doseFelinaMaxRaw ? parseNumero(doseFelinaMaxRaw) : undefined;

  const freqHoras = parseNumero(getValor('frequencia_horas_padrao', 'frequencia', 'intervalo_horas', 'posologia_intervalo'), 12);
  const duracaoDias = parseNumero(getValor('duracao_dias_padrao', 'duracao_dias', 'duracao', 'dias'), 7);

  const condicaoAlimentarRaw = getValor('condicao_alimentar', 'alimentacao', 'estomago').toLowerCase();
  let condicaoAlimentar: CondicaoAlimentar = 'com_alimento';
  if (condicaoAlimentarRaw.includes('jejum')) condicaoAlimentar = 'jejum';
  else if (condicaoAlimentarRaw.includes('livre') || condicaoAlimentarRaw.includes('indiferente')) condicaoAlimentar = 'livre';
  else if (condicaoAlimentarRaw.includes('externo') || condicaoAlimentarRaw.includes('topico')) condicaoAlimentar = 'uso_externo';

  const apresentacoes = normalizarApresentacoes(
    getValor('apresentacoes', 'apresentacao', 'concentracao', 'formas_comerciais'),
    nomeComercial
  );

  const riscoMdr1 = parseBooleano(getValor('risco_mdr1', 'mdr1', 'alerta_mdr1', 'gene_mdr1'));
  const mensagemMdr1 = getValor('mensagem_mdr1', 'alerta_mdr1_texto') || (riscoMdr1 ? 'Contraindicado ou usar com extrema cautela em raças portadoras da mutação MDR1 (Collie, Australian Shepherd, Shetland).' : undefined);

  const orientacoesPadrao = getValor('orientacoes_padrao', 'orientacoes', 'instrucoes_tutor', 'modo_de_usar') || 'Administrar conforme prescrição médica veterinária.';
  const alertaFelino = getValor('alerta_felino_especifico', 'alerta_felino', 'aviso_gatos');
  const motivoContraindicacao = getValor('motivo_contraindicacao_especie', 'motivo_contraindicacao');

  const palavrasChave = parseListaTexto(getValor('palavras_chave', 'palavras_gatilho', 'tags', 'indicacoes', 'sintomas'));
  if (!palavrasChave.includes(principioFinal.toLowerCase())) {
    palavrasChave.unshift(principioFinal.toLowerCase());
  }

  const regra: RegraBulario = {
    slug,
    principio_ativo: principioFinal,
    nome_comercial_sugerido: nomeComercial,
    classe_terapeutica: classeTerapeutica,
    tipo_padrao: tipoPadrao,
    icone_via: iconeVia,
    especies_permitidas: especiesPermitidas,
    especies_contraindicadas: especiesContraindicadas,
    motivo_contraindicacao_especie: motivoContraindicacao || undefined,
    risco_mdr1: riscoMdr1,
    mensagem_mdr1: mensagemMdr1,
    dose_padrao_mg_kg: dosePadrao,
    dose_min_mg_kg: doseMin,
    dose_max_mg_kg: doseMax,
    dose_toxica_mg_kg: doseToxica,
    dose_felina_max_mg_kg: doseFelinaMax,
    alerta_felino_especifico: alertaFelino || undefined,
    frequencia_horas_padrao: freqHoras,
    duracao_dias_padrao: duracaoDias,
    condicao_alimentar: condicaoAlimentar,
    apresentacoes: apresentacoes.length > 0 ? apresentacoes : [
      { rotulo: nomeComercial, forma: 'comprimido', divisivel: true }
    ],
    interacoes_classes: parseListaTexto(getValor('interacoes_classes', 'interacoes')),
    comorbidades_cautela: parseListaTexto(getValor('comorbidades_cautela', 'cautela_comorbidades')),
    orientacoes_padrao: orientacoesPadrao,
    palavras_chave: palavrasChave,
  };

  return { regra };
}

/**
 * Lê e processa um arquivo CSV completo, retornando os itens e possíveis erros de validação.
 */
export function parseCsvBulario(csvText: string): ResultadoParseCsvBulario {
  const matriz = dividirCsvEmLinhas(csvText);
  if (matriz.length < 2) {
    return {
      itens: [],
      erros: ['O arquivo CSV precisa conter ao menos uma linha de cabeçalho e uma de dados.'],
      totalLido: 0,
    };
  }

  const cabecalhos = matriz[0].map((c) => c.trim());
  const itens: RegraBulario[] = [];
  const erros: string[] = [];

  for (let i = 1; i < matriz.length; i++) {
    const valores = matriz[i];
    if (valores.length === 0 || (valores.length === 1 && !valores[0])) continue;

    const objetoLinha: Record<string, string> = {};
    for (let j = 0; j < cabecalhos.length; j++) {
      objetoLinha[cabecalhos[j]] = valores[j] || '';
    }

    const { regra, erro } = parseLinhaParaRegra(objetoLinha, i + 1);
    if (erro) {
      erros.push(erro);
    } else if (regra) {
      itens.push(regra);
    }
  }

  return {
    itens,
    erros,
    totalLido: matriz.length - 1,
  };
}

/** Escapa campo para RFC 4180 CSV com aspas se contiver vírgula, ponto-e-vírgula ou aspas. */
function escaparCampoCsv(valor: any): string {
  if (valor === null || valor === undefined) return '';
  const str = String(valor);
  if (str.includes(',') || str.includes(';') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exporta a lista de fármacos em formato CSV UTF-8 estruturado com todas as colunas clínicas.
 */
export function exportarBularioCsv(itens: RegraBulario[]): string {
  const colunas = [
    'slug',
    'principio_ativo',
    'nome_comercial_sugerido',
    'classe_terapeutica',
    'tipo_padrao',
    'icone_via',
    'especies_permitidas',
    'especies_contraindicadas',
    'motivo_contraindicacao_especie',
    'risco_mdr1',
    'mensagem_mdr1',
    'dose_padrao_mg_kg',
    'dose_min_mg_kg',
    'dose_max_mg_kg',
    'dose_toxica_mg_kg',
    'dose_felina_max_mg_kg',
    'alerta_felino_especifico',
    'frequencia_horas_padrao',
    'duracao_dias_padrao',
    'condicao_alimentar',
    'apresentacoes',
    'interacoes_classes',
    'comorbidades_cautela',
    'orientacoes_padrao',
    'palavras_chave',
  ];

  const linhas = [colunas.join(';')];

  for (const item of itens) {
    const linha = [
      escaparCampoCsv(item.slug),
      escaparCampoCsv(item.principio_ativo),
      escaparCampoCsv(item.nome_comercial_sugerido),
      escaparCampoCsv(item.classe_terapeutica),
      escaparCampoCsv(item.tipo_padrao),
      escaparCampoCsv(item.icone_via),
      escaparCampoCsv(item.especies_permitidas.join(', ')),
      escaparCampoCsv(item.especies_contraindicadas.join(', ')),
      escaparCampoCsv(item.motivo_contraindicacao_especie || ''),
      escaparCampoCsv(item.risco_mdr1 ? 'sim' : 'nao'),
      escaparCampoCsv(item.mensagem_mdr1 || ''),
      escaparCampoCsv(item.dose_padrao_mg_kg),
      escaparCampoCsv(item.dose_min_mg_kg),
      escaparCampoCsv(item.dose_max_mg_kg),
      escaparCampoCsv(item.dose_toxica_mg_kg ?? ''),
      escaparCampoCsv(item.dose_felina_max_mg_kg ?? ''),
      escaparCampoCsv(item.alerta_felino_especifico || ''),
      escaparCampoCsv(item.frequencia_horas_padrao),
      escaparCampoCsv(item.duracao_dias_padrao),
      escaparCampoCsv(item.condicao_alimentar),
      escaparCampoCsv(JSON.stringify(item.apresentacoes)),
      escaparCampoCsv(item.interacoes_classes.join(', ')),
      escaparCampoCsv(item.comorbidades_cautela.join(', ')),
      escaparCampoCsv(item.orientacoes_padrao),
      escaparCampoCsv(item.palavras_chave.join(', ')),
    ];
    linhas.push(linha.join(';'));
  }

  // Adiciona BOM UTF-8 (\uFEFF) para garantir exibição correta no Excel no Windows/Mac
  return '\uFEFF' + linhas.join('\r\n');
}

/**
 * Exporta a lista de fármacos como JSON formatado.
 */
export function exportarBularioJson(itens: RegraBulario[]): string {
  return JSON.stringify(itens, null, 2);
}

/**
 * Gera um modelo CSV de exemplo para download ou scraping.
 */
export function gerarModeloCsvBulario(): string {
  return exportarBularioCsv(BULARIO_PADRAO.slice(0, 10));
}
