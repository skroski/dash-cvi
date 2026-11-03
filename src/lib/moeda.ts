/** Leitura de valores em reais digitados pela equipe. */
/** "120", "120,5" ou "1.200,00" -> número; vazio -> null; inválido -> NaN. */
export function lerPreco(texto: string): number | null {
  const limpo = texto.replace(/[R$\s]/g, '');
  if (!limpo) return null;
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const numero = Number(normal);
  return Number.isFinite(numero) && numero >= 0 ? Math.round(numero * 100) / 100 : Number.NaN;
}

