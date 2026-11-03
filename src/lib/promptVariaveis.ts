/**
 * Variáveis {{...}} do prompt: leitura dos marcadores e validação contra o registro do banco
 * (tabela prompt_variaveis). A renderização com dados reais acontece no servidor.
 */
export interface VariavelPrompt {
  nome: string;
  grupo: 'data' | 'empresa' | 'cliente' | 'catalogo';
  descricao: string;
  exemplo: string;
  parametro: string | null;
  alias_de: string | null;
}

const MARCADOR = /\{\{([^{}]*)\}\}/g;
const NOME_VALIDO = /^[a-z0-9_]+(?::[a-z0-9_-]+)?$/;

/** Marcadores que o sistema não reconhece (inclui expressões coladas de outras ferramentas). */
export function marcadoresDesconhecidos(texto: string, registro: VariavelPrompt[]): string[] {
  const simples = new Set(registro.filter((v) => !v.parametro).map((v) => v.nome));
  const comParametro = new Set(registro.filter((v) => v.parametro).map((v) => v.nome));
  const invalidos = new Set<string>();
  for (const m of texto.matchAll(MARCADOR)) {
    const conteudo = m[1].trim();
    if (!NOME_VALIDO.test(conteudo)) {
      invalidos.add(m[0]);
      continue;
    }
    const [nome, parametro] = conteudo.split(':');
    if (parametro ? !comParametro.has(nome) : !simples.has(nome)) invalidos.add(m[0]);
  }
  return [...invalidos];
}

export const ROTULO_GRUPO_VARIAVEL: Record<VariavelPrompt['grupo'], string> = {
  data: 'Data e hora',
  empresa: 'Empresa',
  cliente: 'Cliente e pet',
  catalogo: 'Serviços e agenda',
};

/** Marcador pronto para colar: variáveis com parâmetro ganham um exemplo editável. */
export function marcadorDe(variavel: Pick<VariavelPrompt, 'nome' | 'parametro'>): string {
  return variavel.parametro ? `{{${variavel.nome}:chave}}` : `{{${variavel.nome}}}`;
}
