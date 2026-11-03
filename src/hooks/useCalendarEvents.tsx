import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  fetchCalendarEvents, 
  refreshCalendarEventsPost, 
  addCalendarEvent, 
  editCalendarEvent, 
  deleteCalendarEvent,
  getCachedEvents
} from '@/services/calendarApi';
import { CalendarEvent, EventFormData } from '@/types/calendar';
import { AgendaType } from '@/hooks/useAgendaType';
import { toast } from 'sonner';

export function useCalendarEvents(agendaType: AgendaType = 'todas', selectedDate?: Date | null) {
  // Inicializar com cache se disponível
  const initialCache = useRef(getCachedEvents(agendaType));
  const [events, setEvents] = useState<CalendarEvent[]>(initialCache.current.events);
  const [isLoading, setIsLoading] = useState(initialCache.current.events.length === 0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(initialCache.current.lastUpdated);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Carregar dados da agenda
  const fetchEvents = useCallback(async (isManualSync = false) => {
    if (isManualSync) {
      setIsSyncing(true);
    } else if (events.length === 0) {
      setIsLoading(true);
    }

    try {
      const fetchedEvents = await fetchCalendarEvents(agendaType, selectedDate);
      setEvents(fetchedEvents);
      const now = new Date();
      setLastUpdated(now);
      setError(null);
      if (isManualSync) {
        if (fetchedEvents.length > 0) {
          toast.success(`${fetchedEvents.length} agendamento(s) sincronizado(s) com sucesso!`);
        } else {
          toast.info("Sincronização concluída (nenhum evento retornado pela agenda).");
        }
      }
    } catch (err) {
      console.warn(`[useCalendarEvents] Erro ao sincronizar ${agendaType}:`, err);
      const errorObj = err instanceof Error ? err : new Error('Falha ao conectar com a agenda');
      setError(errorObj);
      if (isManualSync) {
        toast.error("Não foi possível sincronizar com a agenda. Exibindo dados locais.");
      }
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [agendaType, selectedDate, events.length]);

  // Função para sincronização manual (botão "Sincronizar")
  const syncEvents = useCallback(() => {
    return fetchEvents(true);
  }, [fetchEvents]);

  // Add a new event
  const addEvent = async (formData: EventFormData) => {
    setIsSubmitting(true);
    try {
      const success = await addCalendarEvent(formData, agendaType);
      if (success) {
        await fetchEvents(false);
      }
      return success;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit an existing event
  const editEvent = async (eventId: string, formData: EventFormData) => {
    setIsSubmitting(true);
    try {
      const success = await editCalendarEvent(eventId, formData, agendaType);
      if (success) {
        await fetchEvents(false);
      }
      return success;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete an event
  const deleteEvent = async (eventId: string) => {
    setIsSubmitting(true);
    try {
      const success = await deleteCalendarEvent(eventId, agendaType);
      if (success) {
        await fetchEvents(false);
      }
      return success;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Initial fetch on mount or when selected date or agendaType changes
  useEffect(() => {
    fetchEvents(false);
  }, [fetchEvents]);

  // Polling a cada 60 segundos
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchEvents(false);
    }, 60000);

    return () => clearInterval(intervalId);
  }, [fetchEvents]);

  return { 
    events, 
    isLoading, 
    isSyncing,
    error, 
    lastUpdated, 
    syncEvents,
    refreshEvents: () => fetchEvents(true),
    refreshEventsPost: () => fetchEvents(true),
    addEvent,
    editEvent,
    deleteEvent,
    isSubmitting
  };
}

// Re-export types for backward compatibility
export type { CalendarEvent, EventFormData } from '@/types/calendar';
