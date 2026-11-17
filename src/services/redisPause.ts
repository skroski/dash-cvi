import { getWebhookUrl } from '@/config/env';

/**
 * Pausa a IA/bot para um contato no Redis pelo tempo especificado (em minutos ou segundos).
 *
 * 1. Tenta POST /api/redis-pause (gravação direta no Redis com TTL)
 * 2. Em paralelo ou como fallback, chama o webhook /pausa_bot caso configurado.
 *
 * @param phone Número do contato (ex: 554199865410)
 * @param durationMinutes Duração em minutos (padrão: 1.5 minutos = 90 segundos)
 */
export async function pauseBotInRedis(
  phone: string,
  durationMinutes: number = 1.5
): Promise<{ success: boolean; durationSeconds: number; error?: string }> {
  const cleanPhone = String(phone).replace(/\D/g, '');
  if (cleanPhone.length < 10) {
    return { success: false, durationSeconds: 0, error: 'Telefone inválido' };
  }

  const durationSeconds = Math.max(1, Math.round(durationMinutes * 60));

  let redisOk = false;
  let lastError: string | undefined;

  // 1. Tenta gravar diretamente no Redis através da API /api/redis-pause
  try {
    const res = await fetch('/api/redis-pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: cleanPhone,
        durationSeconds,
      }),
    });

    if (res.ok) {
      redisOk = true;
    } else {
      const data = await res.json().catch(() => null);
      lastError = data?.error || `HTTP ${res.status}`;
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
  }

  // 2. Notifica também o webhook /pausa_bot para manter sincronismo com n8n/chat
  try {
    const webhookUrl = getWebhookUrl('pausaBot', '/pausa_bot');
    if (webhookUrl) {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          duration: durationSeconds,
          unit: 'seconds',
        }),
      }).catch((webhookErr) => {
        console.warn('[pauseBotInRedis] Webhook /pausa_bot falhou (silencioso):', webhookErr);
      });
    }
  } catch {
    // Webhook opcional
  }

  return {
    success: redisOk,
    durationSeconds,
    error: lastError,
  };
}
