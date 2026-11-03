import { GoogleCalendar, CalendarEvent } from '@/types/calendar';
import { addHours, isValid } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { ENV_DEFAULTS } from '@/config/env';

export const GOOGLE_CLIENT_ID = ENV_DEFAULTS.GOOGLE_CLIENT_ID;
export const GOOGLE_CALENDAR_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'cvi_google_access_token',
  TOKEN_EXPIRY: 'cvi_google_token_expiry',
  CALENDARS_CACHE: 'cvi_google_calendars_cache',
  ENABLED_CALENDARS: 'cvi_google_enabled_calendars',
  EVENTS_CACHE: 'cvi_google_events_cache',
  LAST_SYNC: 'cvi_google_last_sync',
  IS_CONNECTED: 'cvi_google_is_connected',
};

/**
 * Recupera os IDs das agendas marcadas para sincronização
 */
export function getEnabledCalendarIds(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ENABLED_CALENDARS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Salva os IDs das agendas selecionadas para sincronização no sistema
 */
export function setEnabledCalendarIds(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ENABLED_CALENDARS, JSON.stringify(ids));
  } catch (err) {
    console.warn('[Google Calendar] Erro ao salvar enabled calendar IDs:', err);
  }
}

// Declaração do objeto global google (Google Identity Services)
declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string; expires_in?: number }) => void;
            error_callback?: (err: unknown) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

/**
 * Carrega a biblioteca Google Identity Services sob demanda caso não esteja presente no DOM
 */
export function loadGsiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const existingScript = document.getElementById('google-gsi-client');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', (err) => reject(err));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(new Error(`Falha ao carregar Google Identity Services: ${String(err)}`));
    document.head.appendChild(script);
  });
}

/**
 * Retorna o access_token salvo se ainda estiver válido
 */
export function getStoredAccessToken(): string | null {
  try {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    const expiry = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRY);
    if (!token) return null;

    if (expiry) {
      const expiryTime = Number(expiry);
      // Se expirar em menos de 1 minuto, considera expirado
      if (Date.now() > expiryTime - 60000) {
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
        return null;
      }
    }
    return token;
  } catch (err) {
    console.warn('[Google Calendar] Erro ao recuperar token do localStorage:', err);
    return null;
  }
}

/**
 * Salva o token de acesso central no Supabase para compartilhar entre todos os usuários do sistema
 */
export async function saveCentralGoogleTokenToSupabase(
  token: string, 
  expiresInSeconds: number = 3600
): Promise<void> {
  try {
    const expiryTime = Date.now() + expiresInSeconds * 1000;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase
      .from('google_calendars_sincronizados')
      .upsert({
        id: '__system_google_auth_token__',
        summary: token,
        description: JSON.stringify({
          expiryTime,
          savedAt: new Date().toISOString(),
          savedBy: user?.email || 'sistema'
        }),
        primary_calendar: false,
        ativo: false,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
  } catch (err) {
    console.warn('[Google Calendar] Aviso ao salvar token central no Supabase:', err);
  }
}

/**
 * Recupera o token de acesso central do Supabase se ainda estiver válido
 */
export async function getCentralGoogleTokenFromSupabase(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('google_calendars_sincronizados')
      .select('summary, description')
      .eq('id', '__system_google_auth_token__')
      .maybeSingle();

    if (error || !data || !data.summary) return null;

    if (data.description) {
      try {
        const meta = JSON.parse(data.description);
        if (meta.expiryTime && Date.now() > Number(meta.expiryTime) - 60000) {
          // Token expirado no banco
          return null;
        }
      } catch { /* noop */ }
    }

    // Salva no localStorage local para acelerar próximas consultas
    try {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.summary);
      localStorage.setItem(STORAGE_KEYS.IS_CONNECTED, 'true');
    } catch { /* noop */ }

    return data.summary;
  } catch (err) {
    console.warn('[Google Calendar] Falha ao recuperar token central do Supabase:', err);
    return null;
  }
}

/**
 * Salva o access token com timestamp de expiração local e no Supabase
 */
export function setStoredAccessToken(token: string, expiresInSeconds: number = 3600): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
    const expiryTime = Date.now() + expiresInSeconds * 1000;
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRY, String(expiryTime));
    localStorage.setItem(STORAGE_KEYS.IS_CONNECTED, 'true');
    // Salva assincronamente no Supabase para compartilhar com todos os veterinários
    saveCentralGoogleTokenToSupabase(token, expiresInSeconds);
  } catch (err) {
    console.warn('[Google Calendar] Erro ao salvar token no localStorage:', err);
  }
}

/**
 * Desconecta a conta do Google e limpa o armazenamento local e central
 */
export function disconnectGoogleAccount(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRY);
    localStorage.removeItem(STORAGE_KEYS.CALENDARS_CACHE);
    localStorage.removeItem(STORAGE_KEYS.ENABLED_CALENDARS);
    localStorage.removeItem(STORAGE_KEYS.EVENTS_CACHE);
    localStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
    localStorage.removeItem(STORAGE_KEYS.IS_CONNECTED);
    // Remove também o token do Supabase
    supabase
      .from('google_calendars_sincronizados')
      .delete()
      .eq('id', '__system_google_auth_token__')
      .then(() => {});
  } catch (err) {
    console.warn('[Google Calendar] Erro ao desconectar conta Google:', err);
  }
}

/**
 * Solicita acesso OAuth2 via popup seguro do Google Identity Services
 */
export async function requestGoogleAccessToken(prompt: string = ''): Promise<string> {
  await loadGsiScript();

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services não está disponível.');
  }

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = window.google!.accounts!.oauth2!.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_CALENDAR_SCOPES,
        callback: (resp) => {
          if (resp.error) {
            reject(new Error(`Erro de autorização Google: ${resp.error}`));
            return;
          }
          if (resp.access_token) {
            setStoredAccessToken(resp.access_token, resp.expires_in || 3600);
            resolve(resp.access_token);
          } else {
            reject(new Error('Nenhum token de acesso retornado pelo Google.'));
          }
        },
        error_callback: (err) => {
          reject(new Error(`Erro no fluxo de autenticação: ${String(err)}`));
        },
      });

      tokenClient.requestAccessToken({ prompt });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Garante um token de acesso válido.
 * 1. Verifica localStorage
 * 2. Verifica token central compartilhado no Supabase (gerado por outro computador da clínica)
 * 3. Se expirado mas a conta já esteve conectada neste navegador, tenta renovação silenciosa
 */
export async function ensureGoogleAccessToken(): Promise<string | null> {
  // 1. Tenta recuperar do localStorage deste navegador
  const current = getStoredAccessToken();
  if (current) return current;

  // 2. Tenta recuperar do Supabase (compartilhado entre todos os veterinários)
  const centralToken = await getCentralGoogleTokenFromSupabase();
  if (centralToken) return centralToken;

  // 3. Tenta renovação silenciosa no navegador atual se a conta já foi conectada
  const wasConnected = localStorage.getItem(STORAGE_KEYS.IS_CONNECTED) === 'true';
  if (wasConnected) {
    try {
      const refreshed = await requestGoogleAccessToken('');
      if (refreshed) {
        setStoredAccessToken(refreshed, 3600);
        return refreshed;
      }
    } catch {
      // Renovação silenciosa requer novo consentimento interativo
    }
  }
  return null;
}

/**
 * Busca a lista de todas as agendas da conta Google (calendarList) com suporte a paginação
 */
export async function fetchGoogleCalendars(accessToken: string): Promise<GoogleCalendar[]> {
  try {
    const items: Record<string, unknown>[] = [];
    let pageToken: string | undefined = undefined;

    do {
      const params = new URLSearchParams({
        maxResults: '250',
      });
      if (pageToken) {
        params.append('pageToken', pageToken);
      }

      const res = await fetch(`https://www.googleapis.com/calendar/v3/users/me/calendarList?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          disconnectGoogleAccount();
          throw new Error('Sessão expirada. Conecte-se novamente ao Google.');
        }
        throw new Error(`Erro ao buscar agendas do Google (HTTP ${res.status})`);
      }

      const data = await res.json();
      if (Array.isArray(data.items)) {
        items.push(...data.items);
      }
      pageToken = data.nextPageToken || undefined;
    } while (pageToken);

    const calendars: GoogleCalendar[] = items.map((item: Record<string, unknown>) => ({
      id: String(item.id || ''),
      summary: String(item.summary || 'Agenda sem nome'),
      description: item.description ? String(item.description) : undefined,
      backgroundColor: item.backgroundColor ? String(item.backgroundColor) : '#3b82f6',
      foregroundColor: item.foregroundColor ? String(item.foregroundColor) : '#ffffff',
      primary: Boolean(item.primary),
      selected: Boolean(item.selected),
      timeZone: item.timeZone ? String(item.timeZone) : undefined,
    }));

    // Salvar cache
    localStorage.setItem(STORAGE_KEYS.CALENDARS_CACHE, JSON.stringify(calendars));
    return calendars;
  } catch (err) {
    console.warn('[Google Calendar] Erro ao buscar calendarList:', err);
    // Recuperar cache
    const cached = localStorage.getItem(STORAGE_KEYS.CALENDARS_CACHE);
    if (cached) {
      try { return JSON.parse(cached); } catch { /* noop */ }
    }
    throw err;
  }
}

/**
 * Normaliza um evento retornado pela API do Google Calendar v3
 */
function normalizeGoogleEvent(item: Record<string, unknown>, calendar: GoogleCalendar): CalendarEvent | null {
  if (!item || !item.id) return null;

  const id = String(item.id);
  const summary = String(item.summary || 'Atendimento / Consulta');
  const description = item.description ? String(item.description) : '';

  // Data de início
  let startIso = new Date().toISOString();
  if (item.start && typeof item.start === 'object') {
    const startObj = item.start as { dateTime?: string; date?: string };
    startIso = startObj.dateTime || (startObj.date ? `${startObj.date}T08:00:00-03:00` : startIso);
  }

  // Data de término
  let endIso = addHours(new Date(startIso), 1).toISOString();
  if (item.end && typeof item.end === 'object') {
    const endObj = item.end as { dateTime?: string; date?: string };
    endIso = endObj.dateTime || (endObj.date ? `${endObj.date}T09:00:00-03:00` : endIso);
  }

  // Extração inteligente de paciente (Pet), tutor e telefone
  let petName: string | undefined;
  let ownerName: string | undefined;
  let phone: string | undefined;

  // Padrão comum em clínicas veterinárias: "Consulta - Pipoca (Daniel)" ou "Pipoca / Daniel"
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
    petName = parts[0];
    if (parts[1]) ownerName = parts[1];
  }

  // Se houver telefone ou dados na descrição
  if (description) {
    const phoneMatch = description.match(/(?:(?:whatsapp|tel|cel|contato|fone)[:\s]*)?\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}/i);
    if (phoneMatch) {
      phone = phoneMatch[0].trim();
    }
    if (!petName) {
      const petMatch = description.match(/(?:pet|paciente|animal)[:\s]*([^\n,]+)/i);
      if (petMatch) petName = petMatch[1].trim();
    }
    if (!ownerName) {
      const tutorMatch = description.match(/(?:tutor|propriet[aá]rio|cliente)[:\s]*([^\n,]+)/i);
      if (tutorMatch) ownerName = tutorMatch[1].trim();
    }
  }

  // Participantes do Google Calendar
  const attendees = Array.isArray(item.attendees)
    ? (item.attendees as Array<{ email?: string; displayName?: string; responseStatus?: string }>).map(a => ({
        email: a.email,
        displayName: a.displayName,
        responseStatus: a.responseStatus as 'needsAction' | 'declined' | 'tentative' | 'accepted' | undefined,
      }))
    : undefined;

  if (!ownerName && attendees && attendees.length > 0) {
    const first = attendees.find(a => a.displayName || a.email);
    if (first) ownerName = first.displayName || first.email;
  }

  return {
    id,
    summary,
    description: description || undefined,
    start: startIso,
    end: endIso,
    status: String(item.status || 'confirmed'),
    htmlLink: item.htmlLink ? String(item.htmlLink) : undefined,
    location: item.location ? String(item.location) : undefined,
    calendarId: calendar.id,
    calendarName: calendar.summary,
    calendarColor: calendar.backgroundColor || '#3b82f6',
    petName,
    ownerName,
    phone,
    service: calendar.summary,
    attendees,
  };
}

/**
 * Busca eventos de uma agenda específica via Google Calendar API v3 com suporte completo a paginação
 */
export async function fetchGoogleCalendarEvents(
  calendar: GoogleCalendar,
  accessToken: string,
  timeMin?: Date,
  timeMax?: Date
): Promise<CalendarEvent[]> {
  const MAX_RESULTS_PER_PAGE = 250;
  let pageToken: string | undefined = undefined;
  const rawItems: Record<string, unknown>[] = [];

  do {
    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: String(MAX_RESULTS_PER_PAGE),
    });

    if (timeMin && isValid(timeMin)) {
      params.append('timeMin', timeMin.toISOString());
    }
    if (timeMax && isValid(timeMax)) {
      params.append('timeMax', timeMax.toISOString());
    }
    if (pageToken) {
      params.append('pageToken', pageToken);
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      if (res.status === 401) {
        disconnectGoogleAccount();
        throw new Error('Sessão expirada. Conecte-se novamente ao Google.');
      }
      throw new Error(`Erro ao buscar eventos da agenda "${calendar.summary}" (HTTP ${res.status})`);
    }

    const data = await res.json();
    if (Array.isArray(data.items)) {
      rawItems.push(...data.items);
    }
    pageToken = data.nextPageToken || undefined;
  } while (pageToken);

  return rawItems
    .map((item: Record<string, unknown>) => normalizeGoogleEvent(item, calendar))
    .filter((e): e is CalendarEvent => e !== null);
}

export interface FetchMultipleCalendarsResult {
  events: CalendarEvent[];
  successfulCalendarIds: string[];
  failedCalendars: { id: string; name: string; error: string }[];
}

/**
 * Busca eventos de múltiplas agendas do Google em paralelo e combina os resultados
 */
export async function fetchEventsFromMultipleGoogleCalendars(
  calendars: GoogleCalendar[],
  accessToken: string,
  timeMin?: Date,
  timeMax?: Date
): Promise<FetchMultipleCalendarsResult> {
  if (calendars.length === 0) {
    return { events: [], successfulCalendarIds: [], failedCalendars: [] };
  }

  const results = await Promise.allSettled(
    calendars.map(cal => 
      fetchGoogleCalendarEvents(cal, accessToken, timeMin, timeMax)
        .then(events => ({ calendarId: cal.id, events }))
    )
  );

  const allEvents: CalendarEvent[] = [];
  const successfulCalendarIds: string[] = [];
  const failedCalendars: { id: string; name: string; error: string }[] = [];

  results.forEach((res, index) => {
    const cal = calendars[index];
    if (res.status === 'fulfilled') {
      allEvents.push(...res.value.events);
      successfulCalendarIds.push(res.value.calendarId);
    } else {
      const errMsg = res.reason instanceof Error ? res.reason.message : String(res.reason);
      console.warn(`[Google Calendar] Falha na agenda "${cal.summary}" (${cal.id}):`, errMsg);
      failedCalendars.push({ id: cal.id, name: cal.summary, error: errMsg });
    }
  });

  // Deduplicar eventos que possam aparecer em mais de uma agenda sincronizada
  const uniqueMap = new Map<string, CalendarEvent>();
  allEvents.forEach(e => {
    if (e && e.id) {
      const existing = uniqueMap.get(e.id);
      if (!existing || (!existing.petName && e.petName)) {
        uniqueMap.set(e.id, e);
      }
    }
  });

  // Ordenar por horário de início
  const sorted = Array.from(uniqueMap.values()).sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  // Salvar em cache local para carregamento instantâneo
  try {
    localStorage.setItem(STORAGE_KEYS.EVENTS_CACHE, JSON.stringify(sorted));
  } catch { /* noop */ }

  return {
    events: sorted,
    successfulCalendarIds,
    failedCalendars,
  };
}

/**
 * Compara duas listas de agendamentos para verificar se houve alteração real nos dados
 */
export function hasEventsDifference(
  oldEvents: CalendarEvent[],
  newEvents: CalendarEvent[]
): boolean {
  if (oldEvents.length !== newEvents.length) return true;

  const oldMap = new Map<string, CalendarEvent>();
  for (const event of oldEvents) {
    if (event && event.id) {
      oldMap.set(event.id, event);
    }
  }

  for (const n of newEvents) {
    if (!n || !n.id) continue;
    const o = oldMap.get(n.id);
    if (!o) return true; // Novo evento adicionado

    const oStart = new Date(o.start).getTime();
    const nStart = new Date(n.start).getTime();
    const oEnd = new Date(o.end).getTime();
    const nEnd = new Date(n.end).getTime();

    if (
      o.summary !== n.summary ||
      o.description !== n.description ||
      oStart !== nStart ||
      oEnd !== nEnd ||
      o.status !== n.status ||
      o.location !== n.location ||
      o.calendarId !== n.calendarId ||
      o.petName !== n.petName ||
      o.ownerName !== n.ownerName ||
      o.phone !== n.phone ||
      o.service !== n.service
    ) {
      return true; // Dados do evento alterados
    }
  }

  return false;
}

/**
 * Obtém os eventos e agendas salvos no cache local
 */
export function getGoogleCalendarCache(): {
  calendars: GoogleCalendar[];
  events: CalendarEvent[];
  lastSync: Date | null;
} {
  try {
    const rawCalendars = localStorage.getItem(STORAGE_KEYS.CALENDARS_CACHE);
    const rawEvents = localStorage.getItem(STORAGE_KEYS.EVENTS_CACHE);
    const rawSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);

    return {
      calendars: rawCalendars ? JSON.parse(rawCalendars) : [],
      events: rawEvents ? JSON.parse(rawEvents) : [],
      lastSync: rawSync ? new Date(rawSync) : null,
    };
  } catch {
    return { calendars: [], events: [], lastSync: null };
  }
}

/**
 * Salva a lista de agendas do Google no banco de dados central (Supabase)
 */
export async function saveCalendarsToSupabase(
  calendars: GoogleCalendar[],
  enabledIds?: string[]
): Promise<boolean> {
  if (!calendars || calendars.length === 0) return false;

  try {
    const uniqueMap = new Map<string, GoogleCalendar>();
    calendars.forEach(c => {
      if (c && c.id) uniqueMap.set(c.id, c);
    });

    const rows = Array.from(uniqueMap.values()).map(c => ({
      id: c.id,
      summary: c.summary,
      description: c.description || null,
      background_color: c.backgroundColor || '#3b82f6',
      foreground_color: c.foregroundColor || '#ffffff',
      primary_calendar: Boolean(c.primary),
      ativo: enabledIds ? enabledIds.includes(c.id) : true,
      time_zone: c.timeZone || 'America/Sao_Paulo',
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('google_calendars_sincronizados')
      .upsert(rows, { onConflict: 'id' });

    if (error) {
      console.warn('[Google Calendar] Erro ao salvar agendas no Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Google Calendar] Exceção ao salvar agendas no Supabase:', err);
    return false;
  }
}

/**
 * Salva agendamentos em lote (bulk upsert) no banco de dados central (Supabase)
 */
export async function saveEventsToSupabase(
  events: CalendarEvent[],
  activeCalendarIds: string[],
  timeMin?: Date,
  timeMax?: Date
): Promise<boolean> {
  try {
    // 1. Limpa os eventos antigos das agendas sincronizadas no intervalo coberto
    if (activeCalendarIds.length > 0) {
      let deleteQuery = supabase
        .from('google_eventos_sincronizados')
        .delete()
        .in('calendar_id', activeCalendarIds);

      if (timeMin && isValid(timeMin)) {
        deleteQuery = deleteQuery.gte('start_time', timeMin.toISOString());
      }
      if (timeMax && isValid(timeMax)) {
        deleteQuery = deleteQuery.lte('start_time', timeMax.toISOString());
      }

      const { error: delError } = await deleteQuery;
      if (delError) {
        console.warn('[Google Calendar] Erro ao limpar eventos antigos no Supabase:', delError.message);
      }
    }

    // 2. Remove rigorosamente duplicatas de ID para evitar o erro do PostgreSQL:
    // "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const uniqueEventsMap = new Map<string, CalendarEvent>();
    events.forEach(e => {
      if (e && e.id) {
        const existing = uniqueEventsMap.get(e.id);
        if (!existing || (!existing.petName && e.petName)) {
          uniqueEventsMap.set(e.id, e);
        }
      }
    });

    const uniqueEvents = Array.from(uniqueEventsMap.values());

    if (uniqueEvents.length > 0) {
      const rows = uniqueEvents.map(e => ({
        id: e.id,
        calendar_id: e.calendarId,
        summary: (e.summary || 'Atendimento').slice(0, 250),
        description: e.description ? e.description.slice(0, 2000) : null,
        start_time: new Date(e.start).toISOString(),
        end_time: new Date(e.end).toISOString(),
        status: e.status || 'confirmed',
        html_link: e.htmlLink ? e.htmlLink.slice(0, 500) : null,
        location: e.location ? e.location.slice(0, 250) : null,
        calendar_name: e.calendarName ? e.calendarName.slice(0, 250) : null,
        calendar_color: e.calendarColor || null,
        pet_name: e.petName ? e.petName.slice(0, 150) : null,
        owner_name: e.ownerName ? e.ownerName.slice(0, 150) : null,
        phone: e.phone ? e.phone.slice(0, 50) : null,
        service: e.service ? e.service.slice(0, 200) : null,
        attendees: e.attendees ? (e.attendees as any) : null,
        synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const CHUNK_SIZE = 100;
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const { error: insError } = await supabase
          .from('google_eventos_sincronizados')
          .upsert(chunk, { onConflict: 'id' });

        if (insError) {
          console.warn('[Google Calendar] Erro ao inserir lote de eventos no Supabase:', insError.message);
        }
      }
    }

    // 3. Registra a ação no log de sincronização
    await logSyncExecutionToSupabase(activeCalendarIds.length, events.length, 'sucesso');

    return true;
  } catch (err) {
    console.warn('[Google Calendar] Exceção ao salvar eventos no Supabase:', err);
    return false;
  }
}

/**
 * Registra a execução de uma verificação/sincronização no log central do Supabase
 */
export async function logSyncExecutionToSupabase(
  calendarsCount: number,
  eventsCount: number,
  status: string = 'sucesso'
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('google_agenda_sync_log').insert({
      synced_by: user?.id || null,
      synced_by_email: user?.email || null,
      calendars_count: calendarsCount,
      events_count: eventsCount,
      status,
    });
  } catch {
    // noop
  }
}

/**
 * Carrega a lista de agendas salvas no banco de dados central (Supabase)
 */
export async function fetchCentralCalendarsFromSupabase(): Promise<GoogleCalendar[]> {
  try {
    const { data, error } = await supabase
      .from('google_calendars_sincronizados')
      .select('*')
      .order('summary', { ascending: true });

    if (error) {
      console.warn('[Google Calendar] Aviso ao carregar agendas do Supabase:', error.message);
      return getGoogleCalendarCache().calendars;
    }

    if (!data || data.length === 0) {
      return getGoogleCalendarCache().calendars;
    }

    const calendars: GoogleCalendar[] = data
      .filter(row => !row.id.startsWith('__system_'))
      .map(row => ({
        id: row.id,
        summary: row.summary,
        description: row.description || undefined,
        backgroundColor: row.background_color || '#3b82f6',
        foregroundColor: row.foreground_color || '#ffffff',
        primary: Boolean(row.primary_calendar),
        selected: Boolean(row.ativo),
        timeZone: row.time_zone || undefined,
      }));

    // Atualiza cache local para contingência offline
    try {
      localStorage.setItem(STORAGE_KEYS.CALENDARS_CACHE, JSON.stringify(calendars));
    } catch { /* noop */ }

    return calendars;
  } catch (err) {
    console.warn('[Google Calendar] Falha ao consultar agendas centrais:', err);
    return getGoogleCalendarCache().calendars;
  }
}

/**
 * Carrega os agendamentos salvos no banco de dados central (Supabase)
 */
export async function fetchCentralEventsFromSupabase(
  calendarIds?: string[],
  timeMin?: Date,
  timeMax?: Date
): Promise<CalendarEvent[]> {
  try {
    const PAGE_SIZE = 1000;
    const allRows: Array<{
      id: string;
      calendar_id: string;
      summary: string;
      description: string | null;
      start_time: string;
      end_time: string;
      status: string | null;
      html_link: string | null;
      location: string | null;
      calendar_name: string | null;
      calendar_color: string | null;
      pet_name: string | null;
      owner_name: string | null;
      phone: string | null;
      service: string | null;
      attendees: any;
    }> = [];

    // Janela operacional padrão: últimos 60 dias até o futuro (ou timeMin customizado)
    const effectiveMin = timeMin || new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from('google_eventos_sincronizados')
        .select('id, calendar_id, summary, description, start_time, end_time, status, html_link, location, calendar_name, calendar_color, pet_name, owner_name, phone, service, attendees')
        .gte('start_time', effectiveMin.toISOString())
        .order('start_time', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (calendarIds && calendarIds.length > 0) {
        query = query.in('calendar_id', calendarIds);
      }

      if (timeMax) {
        query = query.lte('start_time', timeMax.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        console.warn('[Google Calendar] Aviso ao carregar lote de eventos do Supabase:', error.message);
        break;
      }

      if (data && data.length > 0) {
        allRows.push(...data);
        if (data.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          from += PAGE_SIZE;
        }
      } else {
        hasMore = false;
      }
    }

    if (allRows.length === 0) {
      const cached = getGoogleCalendarCache().events;
      if (cached.length > 0) return cached;
    }

    const events: CalendarEvent[] = allRows.map(row => {
      let attendeesParsed = undefined;
      if (row.attendees) {
        if (typeof row.attendees === 'string') {
          try { attendeesParsed = JSON.parse(row.attendees); } catch { /* noop */ }
        } else if (Array.isArray(row.attendees)) {
          attendeesParsed = row.attendees;
        }
      }

      return {
        id: row.id,
        summary: row.summary,
        description: row.description || undefined,
        start: row.start_time,
        end: row.end_time,
        status: row.status || 'confirmed',
        htmlLink: row.html_link || undefined,
        location: row.location || undefined,
        calendarId: row.calendar_id,
        calendarName: row.calendar_name || undefined,
        calendarColor: row.calendar_color || '#3b82f6',
        petName: row.pet_name || undefined,
        ownerName: row.owner_name || undefined,
        phone: row.phone || undefined,
        service: row.service || undefined,
        attendees: attendeesParsed,
      };
    });

    // Atualiza cache local para contingência offline
    try {
      localStorage.setItem(STORAGE_KEYS.EVENTS_CACHE, JSON.stringify(events));
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    } catch { /* noop */ }

    return events;
  } catch (err) {
    console.warn('[Google Calendar] Falha ao consultar eventos centrais:', err);
    return getGoogleCalendarCache().events;
  }
}

/**
 * Consulta informações da última sincronização central realizada
 */
export async function fetchLastSyncInfoFromSupabase(): Promise<{
  lastSync: Date | null;
  syncedByEmail: string | null;
  eventsCount: number;
}> {
  try {
    const { data, error } = await supabase
      .from('google_agenda_sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      const local = getGoogleCalendarCache();
      return { lastSync: local.lastSync, syncedByEmail: null, eventsCount: local.events.length };
    }

    return {
      lastSync: new Date(data.created_at),
      syncedByEmail: data.synced_by_email || null,
      eventsCount: data.events_count || 0,
    };
  } catch {
    const local = getGoogleCalendarCache();
    return { lastSync: local.lastSync, syncedByEmail: null, eventsCount: local.events.length };
  }
}

/**
 * Dispara a sincronização assíncrona no servidor (Edge Function / RPC)
 */
export async function triggerServerGoogleSync(): Promise<boolean> {
  try {
    // 1. Tenta chamar a Edge Function sync-google-calendar diretamente
    const { data, error } = await supabase.functions.invoke('sync-google-calendar', {
      body: { source: 'frontend_async_trigger' },
    });

    if (!error && data?.success) {
      return true;
    }

    // 2. Fallback: chama a função RPC trigger_google_calendar_sync() do banco
    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('trigger_google_calendar_sync');
    if (!rpcError && rpcData?.success) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

