import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { CalendarEvent, EventFormData } from '@/types/calendar';
import { AgendaType } from '@/hooks/useAgendaType';

type AgendaAction = 'listar' | 'criar' | 'editar' | 'excluir';

function intervaloDaData(selectedDate?: Date | null) {
  if (!selectedDate) return null;
  const year = selectedDate.getFullYear();
  const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
  const day = String(selectedDate.getDate()).padStart(2, '0');
  return {
    start: `${year}-${month}-${day}T00:00:00-03:00`,
    end: `${year}-${month}-${day}T23:59:59-03:00`,
  };
}

async function agendaInvoke<T>(
  acao: AgendaAction,
  agendaType: AgendaType,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('agenda', {
    body: { acao, agendaType, ...payload },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
}

function eventoPayload(formData: EventFormData, id?: string) {
  const date = format(formData.date, 'yyyy-MM-dd');
  return {
    id,
    summary: formData.summary,
    description: formData.description,
    email: formData.email,
    start: `${date}T${formData.startTime}:00-03:00`,
    end: `${date}T${formData.endTime}:00-03:00`,
  };
}

export async function fetchCalendarEvents(
  agendaType: AgendaType = 'consultaveterinaria',
  selectedDate?: Date | null
) {
  const interval = intervaloDaData(selectedDate);
  const response = await agendaInvoke<{ events?: CalendarEvent[] }>('listar', agendaType, interval || {});
  return Array.isArray(response.events) ? response.events : [];
}

export async function refreshCalendarEventsPost(
  agendaType: AgendaType = 'consultaveterinaria',
  selectedDate?: Date | null
) {
  return fetchCalendarEvents(agendaType, selectedDate);
}

export async function addCalendarEvent(
  formData: EventFormData,
  agendaType: AgendaType = 'consultaveterinaria'
) {
  await agendaInvoke('criar', agendaType, { event: eventoPayload(formData) });
  return true;
}

export async function editCalendarEvent(
  eventId: string,
  formData: EventFormData,
  agendaType: AgendaType = 'consultaveterinaria'
) {
  await agendaInvoke('editar', agendaType, { event: eventoPayload(formData, eventId) });
  return true;
}

export async function deleteCalendarEvent(
  eventId: string,
  agendaType: AgendaType = 'consultaveterinaria'
) {
  await agendaInvoke('excluir', agendaType, { event: { id: eventId } });
  return true;
}
