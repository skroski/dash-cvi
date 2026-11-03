import { PostgrestError } from '@supabase/supabase-js';

// O PostgREST do projeto aplica db-max-rows = 1000: qualquer .select() sem
// paginação devolve no máximo 1000 linhas SEM erro (truncagem silenciosa),
// mesmo passando um .limit() maior. Tabelas como dados_cliente (~10k linhas)
// e n8n_chat_histories (~9k linhas) já passaram do teto, então qualquer
// leitura completa precisa paginar com .range(). Ver useConversationStatus.ts
// para o incidente que motivou esse padrão.
const DEFAULT_PAGE_SIZE = 1000;

/**
 * Busca todas as linhas de uma query paginando com .range() até a página
 * voltar incompleta. A query passada para `fetchPage` PRECISA ter um
 * .order() explícito e estável (idealmente pela PK) — sem isso, páginas se
 * sobrepõem ou pulam linhas se a tabela for escrita entre as buscas.
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  pageSize = DEFAULT_PAGE_SIZE
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;

    const page = data ?? [];
    rows.push(...page);

    // Página veio menor que o pedido: não há mais linhas.
    if (page.length < pageSize) break;
    from += page.length;
  }

  return rows;
}
