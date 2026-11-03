import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  getStoredAccessToken, 
  requestGoogleAccessToken, 
  disconnectGoogleAccount, 
  fetchGoogleCalendars, 
  fetchEventsFromMultipleGoogleCalendars,
  getGoogleCalendarCache,
  getEnabledCalendarIds,
  setEnabledCalendarIds,
  saveCalendarsToSupabase,
  saveEventsToSupabase,
  logSyncExecutionToSupabase,
  fetchCentralCalendarsFromSupabase,
  fetchCentralEventsFromSupabase,
  fetchLastSyncInfoFromSupabase,
  hasEventsDifference,
  ensureGoogleAccessToken,
  triggerServerGoogleSync
} from '@/services/googleCalendarService';
import { GoogleCalendar, CalendarEvent } from '@/types/calendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isSameDay, isToday, isValid } from 'date-fns';

export function useGoogleCalendar(initialDate?: Date) {
  const cached = useMemo(() => getGoogleCalendarCache(), []);

  const [accessToken, setAccessToken] = useState<string | null>(getStoredAccessToken);
  const [allGoogleCalendars, setAllGoogleCalendars] = useState<GoogleCalendar[]>(cached.calendars);
  const [enabledCalendarIds, setEnabledCalendarIdsState] = useState<string[]>(() => {
    const saved = getEnabledCalendarIds();
    if (saved && saved.length > 0) return saved;
    return cached.calendars.map(c => c.id);
  });

  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate ?? new Date());
  const [events, setEvents] = useState<CalendarEvent[]>(cached.events);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSync, setLastSync] = useState<Date | null>(cached.lastSync);
  const [syncedByEmail, setSyncedByEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Travas para evitar requisições concorrentes e estouro de sockets no navegador
  const isFetchingRef = useRef<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);
  const eventsRef = useRef<CalendarEvent[]>(cached.events);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  // Status de conexão e origem dos dados
  const hasGoogleAuth = Boolean(accessToken);
  const isCentralSync = !hasGoogleAuth && (allGoogleCalendars.length > 0 || events.length > 0);
  const isConnected = hasGoogleAuth || allGoogleCalendars.length > 0 || events.length > 0;

  // Agendas sincronizadas no sistema (ativas)
  const syncedCalendars = useMemo(() => {
    return allGoogleCalendars.filter(cal => enabledCalendarIds.includes(cal.id));
  }, [allGoogleCalendars, enabledCalendarIds]);

  // Agendas ainda NÃO sincronizadas no sistema (disponíveis no Google)
  const unsyncedCalendars = useMemo(() => {
    return allGoogleCalendars.filter(cal => !enabledCalendarIds.includes(cal.id));
  }, [allGoogleCalendars, enabledCalendarIds]);

  // Carrega dados da base central do Supabase
  const loadCentralData = useCallback(async (showToast = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const [centralCalendars, centralEvents, syncInfo] = await Promise.all([
        fetchCentralCalendarsFromSupabase(),
        fetchCentralEventsFromSupabase(),
        fetchLastSyncInfoFromSupabase(),
      ]);

      if (centralCalendars && centralCalendars.length > 0) {
        setAllGoogleCalendars(centralCalendars);

        // Se houver IDs salvos no localStorage, valida se batem com as agendas existentes
        const saved = getEnabledCalendarIds();
        const validSaved = (saved || []).filter(id => centralCalendars.some(c => c.id === id));

        if (validSaved.length > 0) {
          setEnabledCalendarIdsState(validSaved);
        } else {
          // Por padrão ativa todas as agendas marcadas como ativas no banco (ou todas se nenhuma)
          const activeIds = centralCalendars.filter(c => c.selected !== false).map(c => c.id);
          const finalIds = activeIds.length > 0 ? activeIds : centralCalendars.map(c => c.id);
          setEnabledCalendarIdsState(finalIds);
          setEnabledCalendarIds(finalIds);
        }
      }

      if (centralEvents) {
        setEvents(centralEvents);
      }

      // Usa o registro real da última sincronização com o Google gravado no banco central
      if (syncInfo.lastSync) {
        const dbSyncDate = new Date(syncInfo.lastSync);
        setLastSync(dbSyncDate);
        try {
          localStorage.setItem('cvi_google_last_sync', dbSyncDate.toISOString());
        } catch { /* noop */ }
      }

      if (syncInfo.syncedByEmail) {
        setSyncedByEmail(syncInfo.syncedByEmail);
      }

      if (showToast) {
        toast.success(`Base central atualizada: ${centralEvents.length} agendamento(s) disponível(is).`);
      }
    } catch (err) {
      console.warn('[useGoogleCalendar] Erro ao carregar base central:', err);
    } finally {
      isFetchingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // Sincronizar agendas e eventos da API do Google Calendar e salvar no Supabase em lote (Bulk)
  const syncWithGoogle = useCallback(async (token: string, targetEnabledIds?: string[], showToast = false) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    setIsSyncing(true);
    setError(null);
    try {
      // 1. Buscar todas as agendas da conta Google
      const fetchedCalendars = await fetchGoogleCalendars(token);
      setAllGoogleCalendars(fetchedCalendars);

      // Determinar quais agendas devem ser sincronizadas
      let currentEnabled = targetEnabledIds;
      if (!currentEnabled || currentEnabled.length === 0) {
        const saved = getEnabledCalendarIds();
        if (saved && saved.length > 0) {
          currentEnabled = saved;
        } else {
          // Por padrão exclui feriados
          currentEnabled = fetchedCalendars
            .filter(c => !c.id.includes('holiday@group.v.calendar.google.com'))
            .map(c => c.id);
          if (currentEnabled.length === 0) {
            currentEnabled = fetchedCalendars.map(c => c.id);
          }
        }
      }
      setEnabledCalendarIdsState(currentEnabled);
      setEnabledCalendarIds(currentEnabled);

      // 2. Persistir agendas no Supabase
      await saveCalendarsToSupabase(fetchedCalendars, currentEnabled);

      // 3. Buscar eventos apenas das agendas habilitadas
      const activeCalendarsToFetch = fetchedCalendars.filter(c => currentEnabled!.includes(c.id));

      if (activeCalendarsToFetch.length > 0) {
        const now = new Date();
        const timeMin = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        const timeMax = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);

        const { events: fetchedEvents, successfulCalendarIds, failedCalendars } = 
          await fetchEventsFromMultipleGoogleCalendars(activeCalendarsToFetch, token, timeMin, timeMax);

        if (failedCalendars.length > 0) {
          const names = failedCalendars.map(f => f.name).join(', ');
          console.warn(`[useGoogleCalendar] Falha ao consultar as seguintes agendas: ${names}`);
          if (showToast) {
            toast.warning(`Atenção: Não foi possível obter dados de: ${names}. Verifique se a conta Google conectada tem permissão de leitura nessas agendas.`);
          }
        }

        // Compara se houve alteração real nos dados dos agendamentos
        const hasDiff = hasEventsDifference(eventsRef.current, fetchedEvents);

        if (hasDiff) {
          // Salva eventos no Supabase apenas para as agendas que responderam com sucesso
          await saveEventsToSupabase(fetchedEvents, successfulCalendarIds, timeMin, timeMax);
          if (showToast) {
            toast.success(`Sincronização concluída: ${fetchedEvents.length} agendamento(s) atualizados na base central!`);
          }
        } else {
          // Sem alteração nos eventos: apenas registra a verificação recente no log central
          await logSyncExecutionToSupabase(successfulCalendarIds.length, fetchedEvents.length, 'sucesso');
          if (showToast) {
            toast.info("Sincronização concluída: tudo atualizado (nenhuma alteração nos agendamentos).");
          }
        }

        // Atualiza a data e horário da requisição para manter o rodapé sempre atualizado a cada ciclo de 10 minutos
        const syncDate = new Date();
        setLastSync(syncDate);
        try {
          localStorage.setItem('cvi_google_last_sync', syncDate.toISOString());
        } catch { /* noop */ }

        setEvents(fetchedEvents);

        // Atualizar email do usuário que sincronizou
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.email) setSyncedByEmail(user.email);
        } catch { /* noop */ }
      } else {
        const hadEvents = eventsRef.current.length > 0;
        setEvents([]);
        if (hadEvents) {
          const syncDate = new Date();
          setLastSync(syncDate);
        }
        if (showToast) {
          toast.info("Nenhuma agenda selecionada para sincronização.");
        }
      }
    } catch (err: unknown) {
      console.warn('[useGoogleCalendar] Erro ao sincronizar:', err);
      const msg = err instanceof Error ? err.message : 'Falha ao sincronizar com Google Calendar';
      setError(msg);
      if (showToast) {
        toast.error(msg);
      }
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, []);

  // Disparo manual de sincronização: se tiver token sincroniza com Google; se não tiver, abre login do Google
  const sync = useCallback(async () => {
    let token = await ensureGoogleAccessToken();

    // Se ainda não temos token, solicita abertura do popup OAuth do Google para sincronizar
    if (!token) {
      try {
        token = await requestGoogleAccessToken();
        if (token) setAccessToken(token);
      } catch (err) {
        console.warn('[useGoogleCalendar] Conexão com Google cancelada ou indisponível:', err);
      }
    }

    if (token) {
      setAccessToken(token);
      await syncWithGoogle(token, enabledCalendarIds, true);
    } else {
      setIsSyncing(true);
      await loadCentralData(true);
      setIsSyncing(false);
      toast.info(
        "Base central recarregada. Conecte sua conta Google para buscar as consultas mais recentes do Google Agenda.",
        { duration: 5000 }
      );
    }
  }, [enabledCalendarIds, loadCentralData, syncWithGoogle]);

  // Conectar com o Google (OAuth Popup)
  const connect = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await requestGoogleAccessToken();
      setAccessToken(token);
      toast.success("Conta Google conectada com sucesso!");
      await syncWithGoogle(token, undefined, true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao conectar com o Google';
      setError(msg);
      toast.error(msg);
      setIsLoading(false);
    }
  }, [syncWithGoogle]);

  // Desconectar do Google (apenas neste navegador)
  const disconnect = useCallback(() => {
    disconnectGoogleAccount();
    setAccessToken(null);
    toast.info("Conta Google desconectada deste dispositivo. A base central continua disponível.");
  }, []);

  // Atualizar a lista de agendas habilitadas para sincronização
  const saveEnabledCalendars = useCallback(async (newEnabledIds: string[]) => {
    setEnabledCalendarIdsState(newEnabledIds);
    setEnabledCalendarIds(newEnabledIds);

    // Atualiza também no Supabase
    await saveCalendarsToSupabase(allGoogleCalendars, newEnabledIds);

    if (accessToken) {
      await syncWithGoogle(accessToken, newEnabledIds, true);
    } else {
      await loadCentralData(false);
    }
  }, [accessToken, allGoogleCalendars, loadCentralData, syncWithGoogle]);

  // Habilitar uma agenda específica não sincronizada
  const enableCalendar = useCallback(async (calendarId: string) => {
    const updated = Array.from(new Set([...enabledCalendarIds, calendarId]));
    await saveEnabledCalendars(updated);
    toast.success("Agenda adicionada à sincronização!");
  }, [enabledCalendarIds, saveEnabledCalendars]);

  // Desabilitar sincronização de uma agenda
  const disableCalendar = useCallback(async (calendarId: string) => {
    const updated = enabledCalendarIds.filter(id => id !== calendarId);
    await saveEnabledCalendars(updated);
    toast.info("Agenda removida da sincronização ativa.");
  }, [enabledCalendarIds, saveEnabledCalendars]);

  // Efeito 1: Carregamento assíncrono ao abrir a página
  // Exibe instantaneamente os dados existentes e dispara sincronização com o Google em segundo plano
  useEffect(() => {
    let isMounted = true;

    // 1. Carrega dados do Supabase imediatamente (sem bloquear a renderização)
    loadCentralData(false);

    // 2. Dispara a sincronização com o Google Calendar de forma 100% ASSÍNCRONA em segundo plano
    const runAsyncGoogleSync = async () => {
      try {
        // Disparo assíncrono no servidor (Edge Function)
        void triggerServerGoogleSync();

        // Sincronização direta via client caso haja token ativo ou renovável
        const token = await ensureGoogleAccessToken();
        if (token && isMounted) {
          setAccessToken(token);
          // Sincroniza em background sem toast obstrutivo
          await syncWithGoogle(token, undefined, false);
        }
      } catch (err) {
        console.warn('[useGoogleCalendar] Sincronização assíncrona inicial:', err);
      }
    };

    runAsyncGoogleSync();

    return () => {
      isMounted = false;
    };
  }, [loadCentralData, syncWithGoogle]);

  // Efeito 2: Supabase Realtime ouvindo apenas novos logs de sincronização (1 único disparo por sync)
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const debouncedLoad = () => {
      // Se este próprio navegador estiver executando a sincronização, ignora a notificação
      if (isSyncingRef.current) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadCentralData(false);
      }, 1500);
    };

    const channel = supabase
      .channel('google-agenda-sync-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'google_agenda_sync_log' }, () => {
        debouncedLoad();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'google_calendars_sincronizados' }, () => {
        debouncedLoad();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Google Calendar Realtime] Conectado e ouvindo notificações de sincronização.');
        }
      });

    // Polling de segurança a cada 60 segundos para manter sincronizado mesmo com abas inativas
    const interval = setInterval(() => {
      if (!isSyncingRef.current && !isFetchingRef.current) {
        loadCentralData(false);
      }
    }, 60000);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [loadCentralData]);

  // Refs para o Efeito 3 acessar sempre os valores mais recentes sem recriar o intervalo
  // (evita reiniciar o timer a cada renderização causada pelo polling da base central)
  const enabledCalendarIdsRef = useRef<string[]>(enabledCalendarIds);
  useEffect(() => {
    enabledCalendarIdsRef.current = enabledCalendarIds;
  }, [enabledCalendarIds]);

  const lastSyncRef = useRef<Date | null>(lastSync);
  useEffect(() => {
    lastSyncRef.current = lastSync;
  }, [lastSync]);

  // Efeito 3: Pull automático e periódico direto do Google Calendar.
  // Sem isso, novos agendamentos criados manualmente no Google só apareciam
  // depois que alguém clicasse em "Sincronizar" — a base central nunca era
  // atualizada sozinha, só relida (o polling acima apenas relê o Supabase).
  useEffect(() => {
    const GOOGLE_PULL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos
    const LEASE_KEY = 'cvi_google_periodic_sync_lease';
    const LEASE_TTL_MS = 9 * 60 * 1000; // 9 minutos (< intervalo de 10 min)

    // Garante que só uma aba/instância (Schedule, Dashboard, etc.) puxe do Google por vez
    const acquireLease = (): boolean => {
      try {
        const now = Date.now();
        const raw = localStorage.getItem(LEASE_KEY);
        if (raw) {
          const ts = Number(raw);
          if (!Number.isNaN(ts) && now - ts < LEASE_TTL_MS) return false;
        }
        localStorage.setItem(LEASE_KEY, String(now));
        return true;
      } catch {
        return true;
      }
    };

    const pullFromGoogle = async () => {
      // Disparo assíncrono no servidor (Edge Function)
      void triggerServerGoogleSync();

      // Reavalia o token a cada tick de 10 min: expira em ~1h e renova silenciosamente se necessário
      const token = await ensureGoogleAccessToken();
      if (!token) return;
      setAccessToken(token);
      if (isSyncingRef.current || isFetchingRef.current) return;
      if (!acquireLease()) return;

      await syncWithGoogle(token, enabledCalendarIdsRef.current, false);
    };

    const intervalId = setInterval(pullFromGoogle, GOOGLE_PULL_INTERVAL_MS);

    // Ao voltar para a aba, sincroniza na hora se já passou o intervalo de 10 minutos
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const last = lastSyncRef.current;
      if (!last || Date.now() - last.getTime() >= GOOGLE_PULL_INTERVAL_MS) {
        pullFromGoogle();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncWithGoogle]);

  // Eventos filtrados pela agenda selecionada e pela data selecionada
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Filtro por agenda do Google
      if (selectedCalendarId !== 'all' && event.calendarId !== selectedCalendarId) {
        return false;
      }

      // Filtro por data (se fornecida)
      if (selectedDate) {
        const eventDate = new Date(event.start);
        if (isValid(eventDate) && !isSameDay(eventDate, selectedDate)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [events, selectedCalendarId, selectedDate]);

  // Agenda ativa selecionada
  const selectedCalendar = useMemo(() => {
    if (selectedCalendarId === 'all') return null;
    return allGoogleCalendars.find(c => c.id === selectedCalendarId) || null;
  }, [allGoogleCalendars, selectedCalendarId]);

  return {
    isConnected,
    hasGoogleAuth,
    isCentralSync,
    allGoogleCalendars,
    syncedCalendars,
    unsyncedCalendars,
    enabledCalendarIds,
    selectedCalendarId,
    setSelectedCalendarId,
    selectedCalendar,
    selectedDate,
    setSelectedDate,
    events,
    filteredEvents,
    isLoading,
    isSyncing,
    lastSync,
    syncedByEmail,
    error,
    connect,
    disconnect,
    sync,
    saveEnabledCalendars,
    enableCalendar,
    disableCalendar,
  };
}
