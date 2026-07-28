import { formatToBrazilTime } from '@/utils/chatUtils';

// Formata data/hora no padrão do chat ("Hoje HH:MM", "Ontem HH:MM", "seg., dd/mm HH:MM").
export const formatDayTime = (input?: string | Date): string =>
  formatToBrazilTime(input);

export const formatPhone = (phone?: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length > 11 && digits.startsWith('55')) {
    if (digits.length === 13) {
      return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    if (digits.length === 12) {
      return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
    }
  }
  return phone;
};

/**
 * Normaliza um telefone digitado livremente para o formato que a Uazapi espera
 * no envio (só dígitos, com código do país 55). Números locais brasileiros
 * (10-11 dígitos) recebem o prefixo 55; quem já tem código de país é mantido.
 * Retorna '' se não houver dígitos suficientes para um número válido.
 */
export const toWhatsappNumber = (phone?: string | null): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
};
