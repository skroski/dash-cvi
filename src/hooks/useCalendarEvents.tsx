import { useState, useEffect, useCallback } from 'react';
import { 
  fetchCalendarEvents, 
  refreshCalendarEventsPost, 
  addCalendarEvent, 
  editCalendarEvent, 
  deleteCalendarEvent 
} from '@/services/calendarApi';
import { CalendarEvent, EventFormData } from '@/types/calendar';
import { AgendaType } from '@/hooks/useAgendaType';
import { toast } from 'sonner';

export function useCalendarEvents(agendaType: AgendaType = 'consultaveterinaria', selectedDate?: Date | null) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Function to fetch events
  const fetchEvents = useCallback(async () => {
    try {
      const fetchedEvents = await fetchCalendarEvents(agendaType, selectedDate);
      setEvents(fetchedEvents);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error(`Error in useCalendarEvents for ${agendaType}:`, err);
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
      
      // Only show the toast if we don't already have events loaded
      if (events.length === 0) {
        toast.error("Não conseguimos atualizar os eventos, tentando novamente em breve...");
      }
    } finally {
      setIsLoading(false);
    }
  }, [events.length, selectedDate, agendaType]);

  // Function to refresh events using POST method
  const refreshEventsPost = useCallback(async () => {
    setIsLoading(true);
    try {
      const refreshedEvents = await refreshCalendarEventsPost(agendaType, selectedDate);
      setEvents(refreshedEvents);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, agendaType]);

  // Add a new event
  const addEvent = async (formData: EventFormData) => {
    setIsSubmitting(true);
    try {
      const success = await addCalendarEvent(formData, agendaType);
      if (success) {
        await fetchEvents(); // Refresh events
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
        await fetchEvents(); // Refresh events
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
        await fetchEvents(); // Refresh events
      }
      return success;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Initial fetch on mount or when selected date changes
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents, selectedDate, agendaType]);

  // Setup polling every 30 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      console.log(`Polling for ${agendaType} calendar events...`);
      fetchEvents();
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [fetchEvents, agendaType]);

  return { 
    events, 
    isLoading, 
    error, 
    lastUpdated, 
    refreshEvents: fetchEvents,
    refreshEventsPost,
    addEvent,
    editEvent,
    deleteEvent,
    isSubmitting
  };
}

// Re-export types for backward compatibility
export type { CalendarEvent, EventFormData } from '@/types/calendar';
