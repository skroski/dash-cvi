/**
 * Centralized Configuration for the CVI Dashboard
 * Exposes only public browser configuration. Provider credentials belong to
 * Supabase Edge Function Secrets and must never be bundled or localStorage.
 */

// 1. Env default fallbacks (using Vite's import.meta.env)
export const ENV_DEFAULTS = {
  // Webhook Configuration
  WEBHOOK_BASE_URL: import.meta.env.VITE_WEBHOOK_BASE_URL || 'https://webhook.cvi.com.br/webhook',

  // Supabase Configuration
  SUPABASE_URL:
    import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://fljoklfmiqgsxwtkbbop.supabase.co',
  // Google OAuth (público por natureza: só o Client ID; o secret fica nas edge functions)
  GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',

  // E-mail de uma conta compartilhada que entra com o papel "veterinário" (vazio = recurso desligado).
  EMAIL_GRUPO_VETERINARIOS: (import.meta.env.VITE_EMAIL_GRUPO_VETERINARIOS || 'veterinarios-cvi@googlegroups.com').toLowerCase(),

  SUPABASE_ANON_KEY:
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'sb_publishable_cXu-nyJQJ78woe2uADPhjQ_Tya4zPN7',
};

export function getActiveConfig() {
  return { ...ENV_DEFAULTS };
}

export function getWebhookUrl(endpointKey: string, defaultPath: string): string {
  try {
    const saved = localStorage.getItem('webhookEndpoints');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed[endpointKey]) return parsed[endpointKey];
    }
  } catch (e) {
    console.error(`[Config] Error loading endpoint override for ${endpointKey}:`, e);
  }

  const config = getActiveConfig();
  const baseUrl = config.WEBHOOK_BASE_URL.replace(/\/$/, '');
  const cleanPath = defaultPath.startsWith('/') ? defaultPath : `/${defaultPath}`;
  return `${baseUrl}${cleanPath}`;
}
