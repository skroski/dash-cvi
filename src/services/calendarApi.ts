import { format, addDays, endOfDay } from 'date-fns';
import { toast } from "sonner";
import { CalendarEvent, EventFormData } from '@/types/calendar';
import { AgendaType } from '@/hooks/useAgendaType';
import { getWebhookUrl } from '@/config/env';

// Get the correct endpoint URL based on agenda type
const getApiUrl = (endpoint: string, agendaType: AgendaType = 'consultaveterinaria') => {
  // Map base endpoint names to their specific agenda type variants
  switch (endpoint) {
    case 'base':
      switch (agendaType) {
        case 'consultaveterinaria':
          return getWebhookUrl('agendaVet', '/agenda/consultaveterinaria');
        case 'vacinas':
          return getWebhookUrl('agendaVacinas', '/agenda/vacinas');
        case 'exame':
          return getWebhookUrl('agendaExame', '/agenda/exame');
        case 'hotel':
          return getWebhookUrl('agendaHotel', '/agenda/hotel');
        default:
          return getWebhookUrl('agendaVet', '/agenda/consultaveterinaria');
      }

    case 'adicionar':
      switch (agendaType) {
        case 'consultaveterinaria':
          return getWebhookUrl('agendaAdicionarVet', '/agenda/adicionar/consultaveterinaria');
        case 'vacinas':
          return getWebhookUrl('agendaAdicionarVacinas', '/agenda/adicionar/vacinas');
        case 'exame':
          return getWebhookUrl('agendaAdicionarExame', '/agenda/adicionar/exame');
        case 'hotel':
          return getWebhookUrl('agendaAdicionarHotel', '/agenda/adicionar/hotel');
        default:
          return getWebhookUrl('agendaAdicionarVet', '/agenda/adicionar/consultaveterinaria');
      }

    case 'alterar':
      switch (agendaType) {
        case 'consultaveterinaria':
          return getWebhookUrl('agendaAlterarVet', '/agenda/alterar/consultaveterinaria');
        case 'vacinas':
          return getWebhookUrl('agendaAlterarVacinas', '/agenda/alterar/vacinas');
        case 'exame':
          return getWebhookUrl('agendaAlterarExame', '/agenda/alterar/exame');
        case 'hotel':
          return getWebhookUrl('agendaAlterarHotel', '/agenda/alterar/hotel');
        default:
          return getWebhookUrl('agendaAlterarVet', '/agenda/alterar/consultaveterinaria');
      }

    case 'excluir':
      switch (agendaType) {
        case 'consultaveterinaria':
          return getWebhookUrl('agendaExcluirVet', '/agenda/excluir/consultaveterinaria');
        case 'vacinas':
          return getWebhookUrl('agendaExcluirVacinas', '/agenda/excluir/vacinas');
        case 'exame':
          return getWebhookUrl('agendaExcluirExame', '/agenda/excluir/exame');
        case 'hotel':
          return getWebhookUrl('agendaExcluirHotel', '/agenda/excluir/hotel');
        default:
          return getWebhookUrl('agendaExcluirVet', '/agenda/excluir/consultaveterinaria');
      }
    default:
      return getWebhookUrl('agendaVet', '/agenda/consultaveterinaria');
  }
};

// Fetch events with GET method
export async function fetchCalendarEvents(agendaType: AgendaType = 'consultaveterinaria', selectedDate?: Date | null) {
  try {
    // Format date parameters for the API
    let url = getApiUrl('base', agendaType);

    // If a date is selected, add query parameters for start and end dates
    if (selectedDate) {
      const startDateTime = new Date(selectedDate.getTime() - 186400000).toISOString().split("T")[0] + "T00:00:00";
      const endDateTime = new Date(selectedDate.getTime() + 186400000).toISOString().split("T")[0] + "T23:59:59";



      url += `?start=${startDateTime}&end=${endDateTime}`;
      console.log(`URL with date range: ${url}`);

      console.log(`Fetching ${agendaType} events with date range:`, { startDateTime, endDateTime });
    }
    console.log(`URL:`, url);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(`Error fetching ${agendaType} calendar events:`, err);
    throw err;
  }
}

// Refresh events with POST method
export async function refreshCalendarEventsPost(agendaType: AgendaType = 'consultaveterinaria', selectedDate?: Date | null) {

  try {
    // Create payload with selected date if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = {};

    if (selectedDate) {
      const startDateTime = new Date(selectedDate.getTime() - 186400000).toISOString().split("T")[0] + "T00:00:00";
      const endDateTime = new Date(selectedDate.getTime() + 186400000).toISOString().split("T")[0] + "T23:59:59";

      payload.start = startDateTime;
      payload.end = endDateTime;
      console.log(`Refreshing ${agendaType} events with payload:`, payload);
    }

    const response = await fetch(getApiUrl('base', agendaType), {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    toast.success("Eventos atualizados com sucesso!");
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(`Error refreshing ${agendaType} calendar events:`, err);
    toast.error("Não conseguimos atualizar os eventos, tente novamente.");
    throw err;
  }
}

// Add a new event
export async function addCalendarEvent(formData: EventFormData, agendaType: AgendaType = 'consultaveterinaria') {
  try {
    // Format the date and times for the API
    const { date, startTime, endTime, summary, description, email } = formData;
    const dateStr = format(date, "yyyy-MM-dd");

    const startDateTime = `${dateStr}T${startTime}:00-03:00`;
    const endDateTime = `${dateStr}T${endTime}:00-03:00`;

    const payload = {
      summary,
      description,
      start: startDateTime,
      end: endDateTime,
      email
    };

    console.log(`Adding ${agendaType} event with payload:`, payload);

    const response = await fetch(getApiUrl('adicionar', agendaType), {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    toast.success("Evento adicionado com sucesso!");
    return true;
  } catch (err) {
    console.error(`Error adding ${agendaType} event:`, err);
    toast.error("Erro ao adicionar evento. Tente novamente.");
    return false;
  }
}

// Edit an existing event
export async function editCalendarEvent(eventId: string, formData: EventFormData, agendaType: AgendaType = 'consultaveterinaria') {
  try {
    // Format the date and times for the API
    const { date, startTime, endTime, summary, description, email } = formData;
    const dateStr = format(date, "yyyy-MM-dd");

    const startDateTime = `${dateStr}T${startTime}:00-03:00`;
    const endDateTime = `${dateStr}T${endTime}:00-03:00`;

    const payload = {
      id: eventId,
      summary,
      description,
      start: startDateTime,
      end: endDateTime,
      email
    };

    console.log(`Updating ${agendaType} event with payload:`, payload);

    const response = await fetch(getApiUrl('alterar', agendaType), {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    toast.success("Evento atualizado com sucesso!");
    return true;
  } catch (err) {
    console.error(`Error updating ${agendaType} event:`, err);
    toast.error("Erro ao atualizar evento. Tente novamente.");
    return false;
  }
}

// Delete an event
export async function deleteCalendarEvent(eventId: string, agendaType: AgendaType = 'consultaveterinaria') {
  try {
    const payload = {
      id: eventId
    };

    console.log(`Deleting ${agendaType} event with payload:`, payload);

    const response = await fetch(getApiUrl('excluir', agendaType), {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    toast.success("Evento excluído com sucesso!");
    return true;
  } catch (err) {
    console.error(`Error deleting ${agendaType} event:`, err);
    toast.error("Erro ao excluir evento. Tente novamente.");
    return false;
  }
}
