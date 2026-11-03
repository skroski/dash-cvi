/**
 * Formata e limpa o texto das mensagens para previews (notificações, listas de conversas, etc).
 * Remove tags HTML, decodifica entidades HTML e limpa marcadores do WhatsApp.
 */
export function stripHtmlAndFormatting(str?: string | null): string {
  if (!str) return '';

  // 1. Decodificar entidades HTML básicas
  let clean = str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/<br\s*\/?>/gi, ' ');

  // 2. Remover tags HTML
  clean = clean.replace(/<[^>]*>/g, ' ');

  // 3. Remover/substituir sintaxe do WhatsApp (*negrito*, _itálico_, ~tachado~, `código`)
  clean = clean
    .replace(/```[\s\S]*?```/g, '[código]')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~([^~]+)~/g, '$1');

  // 4. Normalizar múltiplos espaços em branco e quebras de linha
  return clean.replace(/\s+/g, ' ').trim();
}
