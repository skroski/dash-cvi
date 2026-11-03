/**
 * Normalização/validação de telefones de notificação (E.164 só com dígitos).
 * Espelhada em src/utils/telefone.ts (o front não importa de supabase/functions).
 */
export function normalizarTelefone(bruto: unknown, codigoPais = '55'): string | null {
  if (typeof bruto !== 'string' && typeof bruto !== 'number') return null;
  let digitos = String(bruto).replace(/\D/g, '');
  if (digitos.startsWith('00')) digitos = digitos.slice(2);
  // Número nacional (DDD + número) sem código do país.
  if (digitos.length >= 10 && digitos.length <= 11) digitos = `${codigoPais}${digitos}`;
  return /^[0-9]{10,15}$/.test(digitos) ? digitos : null;
}

/** Mesma chave usada para cruzar números com e sem o 9º dígito (celulares BR). */
export function chaveTelefone(bruto: unknown): string {
  const digitos = String(bruto ?? '').replace(/\D/g, '');
  if (digitos.startsWith('55') && digitos.length === 13 && digitos[4] === '9') {
    return digitos.slice(0, 4) + digitos.slice(5);
  }
  return digitos;
}
