/**
 * Valor seguro dentro de filtros `.or()` do PostgREST. Vírgula, ponto, dois-pontos e parênteses
 * são reservados nesse formato; entre aspas duplas o valor é lido literalmente (JIDs do WhatsApp,
 * como `5561999999999@s.whatsapp.net`, têm pontos).
 */
export function valorFiltro(valor: unknown): string {
  return `"${String(valor ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
