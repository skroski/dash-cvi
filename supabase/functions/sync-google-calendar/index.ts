// Supabase Edge Function: sync-google-calendar
//
// Sincronização Server-to-Server e Assíncrona do Google Calendar com o banco Supabase.
// Executada automaticamente via cron (de 10 em 10 minutos) ou chamada sob demanda pelo front-end.
//
// SUPORTA 3 MODOS DE AUTENTICAÇÃO:
// 1. Google Service Account (Conta de Serviço JSON) -> NUNCA expira, 24/7/365 independente de usuário
// 2. OAuth2 Refresh Token -> Renovação automática permanente via Google Token Endpoint
// 3. Token Central Ativo do Supabase -> Fallback com o token do navegador compartilhado na clínica

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { segredo } from '../_shared/segredos.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Utilitário para Base64Url
function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Converte chave PEM PKCS#8 para CryptoKey
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cleanPem = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '');

  const binaryDer = atob(cleanPem);
  const binaryDerLength = binaryDer.length;
  const bytes = new Uint8Array(binaryDerLength);
  for (let i = 0; i < binaryDerLength; i++) {
    bytes[i] = binaryDer.charCodeAt(i);
  }

  return await crypto.subtle.importKey(
    'pkcs8',
    bytes.buffer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

// Gera Access Token usando Google Service Account
async function getAccessTokenFromServiceAccount(
  clientEmail: string,
  privateKeyPem: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signInput = `${encodedHeader}.${encodedPayload}`;

  const cryptoKey = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signInput)
  );

  const jwt = `${signInput}.${arrayBufferToBase64Url(signature)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    throw new Error(`Falha ao obter token da Service Account: ${errorText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

// Gera Access Token usando OAuth Refresh Token
async function getAccessTokenFromRefreshToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    throw new Error(`Falha ao renovar refresh_token: ${errorText}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

// Normaliza o agendamento extraindo pet, tutor, telefone
function normalizeGoogleEvent(item: Record<string, unknown>, calendarId: string, calendarName: string, calendarColor: string) {
  if (!item || !item.id) return null;

  const id = String(item.id);
  const summary = String(item.summary || 'Atendimento / Consulta');
  const description = item.description ? String(item.description) : '';

  let startTime = new Date().toISOString();
  if (item.start && typeof item.start === 'object') {
    const startObj = item.start as { dateTime?: string; date?: string };
    startTime = startObj.dateTime || (startObj.date ? `${startObj.date}T08:00:00-03:00` : startTime);
  }

  let endTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();
  if (item.end && typeof item.end === 'object') {
    const endObj = item.end as { dateTime?: string; date?: string };
    endTime = endObj.dateTime || (endObj.date ? `${endObj.date}T09:00:00-03:00` : endTime);
  }

  let petName: string | null = null;
  let ownerName: string | null = null;
  let phone: string | null = null;

  if (summary.includes('-')) {
    const parts = summary.split('-').map(p => p.trim());
    if (parts.length >= 2) {
      const matchParen = parts[1].match(/^([^(]+)(?:\(([^)]+)\))?/);
      if (matchParen) {
        petName = matchParen[1].trim();
        if (matchParen[2]) ownerName = matchParen[2].trim();
      }
    }
  } else if (summary.includes('/')) {
    const parts = summary.split('/').map(p => p.trim());
    petName = parts[0] || null;
    if (parts[1]) ownerName = parts[1] || null;
  }

  if (description) {
    const phoneMatch = description.match(/(?:(?:whatsapp|tel|cel|contato|fone)[:\s]*)?\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}/i);
    if (phoneMatch) phone = phoneMatch[0].trim();
    if (!petName) {
      const petMatch = description.match(/(?:pet|paciente|animal)[:\s]*([^\n,]+)/i);
      if (petMatch) petName = petMatch[1].trim();
    }
    if (!ownerName) {
      const tutorMatch = description.match(/(?:tutor|propriet[aá]rio|cliente)[:\s]*([^\n,]+)/i);
      if (tutorMatch) ownerName = tutorMatch[1].trim();
    }
  }

  return {
    id,
    calendar_id: calendarId,
    summary: summary.slice(0, 250),
    description: description ? description.slice(0, 2000) : null,
    start_time: startTime,
    end_time: endTime,
    status: (item.status as string) || 'confirmed',
    html_link: item.htmlLink ? String(item.htmlLink).slice(0, 500) : null,
    location: item.location ? String(item.location).slice(0, 250) : null,
    calendar_name: calendarName.slice(0, 250),
    calendar_color: calendarColor,
    pet_name: petName ? petName.slice(0, 150) : null,
    owner_name: ownerName ? ownerName.slice(0, 150) : null,
    phone: phone ? phone.slice(0, 50) : null,
    service: summary.split('-')[0]?.trim().slice(0, 200) || null,
    attendees: Array.isArray(item.attendees) ? item.attendees : null,
    synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    return json({ error: 'Configuração do Supabase incompleta (URL ou Service Role ausente)' }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Obter Access Token do Google
    let accessToken: string | null = null;
    let authSource = 'none';

    // A) Verificar Service Account nas variáveis de ambiente ou tabela config
    const envSaKey = segredo('GOOGLE_SERVICE_ACCOUNT_KEY');
    if (envSaKey) {
      try {
        const sa = JSON.parse(envSaKey);
        accessToken = await getAccessTokenFromServiceAccount(sa.client_email, sa.private_key);
        authSource = 'service_account_env';
      } catch (e) {
        console.warn('[Sync Edge Function] Erro na Service Account de ENV:', e);
      }
    }

    // B) Verificar tabela google_agenda_config no Supabase
    if (!accessToken) {
      try {
        const { data: configData } = await supabase
          .from('google_agenda_config')
          .select('*')
          .eq('id', 'default')
          .maybeSingle();

        if (configData) {
          if (configData.service_account_key && configData.service_account_email) {
            accessToken = await getAccessTokenFromServiceAccount(
              configData.service_account_email,
              configData.service_account_key
            );
            authSource = 'service_account_db';
          } else if (configData.refresh_token && configData.client_id && configData.client_secret) {
            accessToken = await getAccessTokenFromRefreshToken(
              configData.refresh_token,
              configData.client_id,
              configData.client_secret
            );
            authSource = 'refresh_token_db';
          }
        }
      } catch (e) {
        console.warn('[Sync Edge Function] Erro ao consultar google_agenda_config:', e);
      }
    }

    // C) Fallback: Token Central salvo pelos usuários no Supabase
    if (!accessToken) {
      const { data: tokenRow } = await supabase
        .from('google_calendars_sincronizados')
        .select('summary, description')
        .eq('id', '__system_google_auth_token__')
        .maybeSingle();

      if (tokenRow && tokenRow.summary) {
        if (tokenRow.description) {
          try {
            const meta = JSON.parse(tokenRow.description);
            if (meta.expiryTime && Date.now() < Number(meta.expiryTime) - 60000) {
              accessToken = tokenRow.summary;
              authSource = 'central_token_db';
            }
          } catch {
            accessToken = tokenRow.summary;
            authSource = 'central_token_db';
          }
        } else {
          accessToken = tokenRow.summary;
          authSource = 'central_token_db';
        }
      }
    }

    if (!accessToken) {
      return json({
        success: false,
        error: 'Nenhum token válido do Google Calendar disponível. Conecte a conta no painel ou configure a Service Account.',
        hint: 'Para sincronização definitiva 24/7 sem expiração, configure GOOGLE_SERVICE_ACCOUNT_KEY no Supabase Secrets.',
      }, 400);
    }

    // 2. Buscar agendas ativas do banco
    const { data: dbCalendars } = await supabase
      .from('google_calendars_sincronizados')
      .select('*')
      .eq('ativo', true)
      .neq('id', '__system_google_auth_token__');

    let activeCalendars = dbCalendars || [];

    // Se nenhuma agenda salva ainda, descobre via calendarList da API
    if (activeCalendars.length === 0) {
      const calRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=250', {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
      });
      if (calRes.ok) {
        const calData = await calRes.json();
        const items = Array.isArray(calData.items) ? calData.items : [];
        activeCalendars = items
          .filter((c: Record<string, unknown>) => !String(c.id).includes('holiday@group.v.calendar.google.com'))
          .map((c: Record<string, unknown>) => ({
            id: String(c.id),
            summary: String(c.summary || 'Agenda'),
            background_color: String(c.backgroundColor || '#3b82f6'),
            ativo: true,
          }));

        // Grava as agendas descobertas
        if (activeCalendars.length > 0) {
          await supabase.from('google_calendars_sincronizados').upsert(
            activeCalendars.map(c => ({
              id: c.id,
              summary: c.summary,
              background_color: c.background_color,
              ativo: true,
              updated_at: new Date().toISOString(),
            })),
            { onConflict: 'id' }
          );
        }
      }
    }

    if (activeCalendars.length === 0) {
      return json({
        success: false,
        error: 'Nenhuma agenda ativa encontrada para sincronizar.',
      }, 404);
    }

    // 3. Janela de sincronização: últimos 60 dias até os próximos 120 dias
    const now = new Date();
    const timeMin = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const timeMax = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);

    const allEvents: ReturnType<typeof normalizeGoogleEvent>[] = [];
    const successfulCalendarIds: string[] = [];

    for (const cal of activeCalendars) {
      try {
        let pageToken: string | undefined = undefined;
        let calEventsCount = 0;

        do {
          const params = new URLSearchParams({
            singleEvents: 'true',
            orderBy: 'startTime',
            maxResults: '250',
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
          });
          if (pageToken) params.append('pageToken', pageToken);

          const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?${params.toString()}`;
          const evRes = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
          });

          if (!evRes.ok) {
            console.warn(`[Sync Edge Function] Erro na agenda ${cal.summary}: HTTP ${evRes.status}`);
            break;
          }

          const evData = await evRes.json();
          const items = Array.isArray(evData.items) ? evData.items : [];
          for (const item of items) {
            const normalized = normalizeGoogleEvent(item, cal.id, cal.summary, cal.background_color || '#3b82f6');
            if (normalized) {
              allEvents.push(normalized);
              calEventsCount++;
            }
          }
          pageToken = evData.nextPageToken || undefined;
        } while (pageToken);

        successfulCalendarIds.push(cal.id);
      } catch (calErr) {
        console.warn(`[Sync Edge Function] Exceção na agenda ${cal.summary}:`, calErr);
      }
    }

    // 4. Limpar eventos antigos e gravar novos em lote no Supabase
    if (successfulCalendarIds.length > 0) {
      await supabase
        .from('google_eventos_sincronizados')
        .delete()
        .in('calendar_id', successfulCalendarIds)
        .gte('start_time', timeMin.toISOString())
        .lte('start_time', timeMax.toISOString());

      // Remove duplicatas de ID para garantir integridade
      const uniqueMap = new Map<string, NonNullable<(typeof allEvents)[0]>>();
      allEvents.forEach(e => {
        if (e && e.id) uniqueMap.set(e.id, e);
      });
      const uniqueEvents = Array.from(uniqueMap.values());

      const CHUNK_SIZE = 100;
      for (let i = 0; i < uniqueEvents.length; i += CHUNK_SIZE) {
        const chunk = uniqueEvents.slice(i, i + CHUNK_SIZE);
        await supabase
          .from('google_eventos_sincronizados')
          .upsert(chunk, { onConflict: 'id' });
      }

      // 5. Registrar log de execução
      await supabase.from('google_agenda_sync_log').insert({
        synced_by_email: `edge_function (${authSource})`,
        calendars_count: successfulCalendarIds.length,
        events_count: uniqueEvents.length,
        status: 'sucesso',
      });

      // Atualiza data do último sync na tabela de config
      try {
        await supabase
          .from('google_agenda_config')
          .upsert({ id: 'default', last_sync_at: new Date().toISOString() }, { onConflict: 'id' });
      } catch { /* noop */ }

      return json({
        success: true,
        source: authSource,
        calendars_synced: successfulCalendarIds.length,
        events_synced: uniqueEvents.length,
        timestamp: new Date().toISOString(),
      });
    }

    return json({
      success: false,
      error: 'Nenhuma agenda pôde ser sincronizada com sucesso.',
    }, 500);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Sync Edge Function] Falha geral:', message);
    return json({ success: false, error: message }, 500);
  }
});
