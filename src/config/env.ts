/**
 * Centralized Configuration for the cvi Dashboard
 * Exposes variables from environment variables (with default fallbacks)
 * and merges dynamic user configurations stored in localStorage.
 */

// 1. Env default fallbacks (using Vite's import.meta.env)
export const ENV_DEFAULTS = {
  // Webhook Configuration
  WEBHOOK_BASE_URL: import.meta.env.VITE_WEBHOOK_BASE_URL || 'https://webhook.cvi.vetbots.com.br/webhook',

  // Supabase Configuration
  SUPABASE_URL: import.meta.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || 'https://fljoklfmiqgsxwtkbbop.supabase.co',
  SUPABASE_ANON_KEY: import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_cXu-nyJQJ78woe2uADPhjQ_Tya4zPN7',

  // Uazapi Configuration
  UAZAPI_SERVER_URL: import.meta.env.VITE_UAZAPI_SERVER_URL || 'https://vetbots.uazapi.com',
  UAZAPI_INSTANCE_TOKEN: import.meta.env.VITE_UAZAPI_INSTANCE_TOKEN || '02c02f95-c9cf-44a5-aeb5-b454759ea0b6',
  UAZAPI_ADMIN_TOKEN: import.meta.env.VITE_UAZAPI_ADMIN_TOKEN || 'oE7h6hkg7XtnLueK6UTOslIKrtXIanN9ojTpJdif209n0HZjV6',
};

// 2. Load configurations dynamically. Priority: localStorage override > Environment Variable > Hardcoded fallback
export function getActiveConfig() {
  const defaults = { ...ENV_DEFAULTS };
  
  try {
    const saved = localStorage.getItem('webhookEndpoints');
    if (saved) {
      const parsed = JSON.parse(saved);
      
      // Map uazapi configurations if defined in localStorage
      if (parsed.uazapiServerUrl) defaults.UAZAPI_SERVER_URL = parsed.uazapiServerUrl;
      if (parsed.uazapiInstanceToken) defaults.UAZAPI_INSTANCE_TOKEN = parsed.uazapiInstanceToken;
      if (parsed.uazapiAdminToken) defaults.UAZAPI_ADMIN_TOKEN = parsed.uazapiAdminToken;
      
      // Also map webhookBaseUrl if they set a custom base or override
      if (parsed.webhookBaseUrl) defaults.WEBHOOK_BASE_URL = parsed.webhookBaseUrl;
    }
  } catch (e) {
    console.error('[Config] Error loading localStorage config overrides:', e);
  }

  return defaults;
}

/**
 * Returns a specific webhook URL path, checking if the individual endpoint has been overridden
 * in ConfigurationManager (saved to localStorage), and if not, constructs it using WEBHOOK_BASE_URL.
 * 
 * @param endpointKey The localStorage endpoint key (e.g. 'pausaBot', 'agendaVet')
 * @param defaultPath The path to append to WEBHOOK_BASE_URL (e.g. '/pausa_bot', '/agenda/consultaveterinaria')
 */
export function getWebhookUrl(endpointKey: string, defaultPath: string): string {
  try {
    const saved = localStorage.getItem('webhookEndpoints');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed[endpointKey]) {
        return parsed[endpointKey];
      }
    }
  } catch (e) {
    console.error(`[Config] Error loading endpoint override for ${endpointKey}:`, e);
  }

  // Construct from base URL
  const config = getActiveConfig();
  const baseUrl = config.WEBHOOK_BASE_URL.replace(/\/$/, '');
  const cleanPath = defaultPath.startsWith('/') ? defaultPath : `/${defaultPath}`;
  return `${baseUrl}${cleanPath}`;
}
