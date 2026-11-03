/**
 * Normaliza telefones de notificação para só dígitos com código do país.
 * Espelha supabase/functions/_shared/telefone.ts (o front não importa de lá).
 */
export function normalizarTelefone(bruto: unknown, codigoPais = '55'): string | null {
  if (typeof bruto !== 'string' && typeof bruto !== 'number') return null;
  let digitos = String(bruto).replace(/\D/g, '');
  if (digitos.startsWith('00')) digitos = digitos.slice(2);
  if (digitos.length >= 10 && digitos.length <= 11) digitos = `${codigoPais}${digitos}`;
  return /^[0-9]{10,15}$/.test(digitos) ? digitos : null;
}

/** 5561982834411 -> +55 (61) 98283-4411 (formato BR; outros países ficam como +dígitos). */
export function formatarTelefone(digitos: string): string {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digitos);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${digitos}`;
}
