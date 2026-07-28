
// Define event types based on the API response
export type CalendarAttendee = {
  email?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
};

export type CalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  status: string;
  htmlLink: string;
  description?: string;
  attendees?: (CalendarAttendee | null)[];
};

export type EventFormData = {
  summary: string;
  description: string;
  email: string;
  date: Date;
  startTime: string;
  endTime: string;
};

// Appointment types (mock data)
export type AppointmentStatus = 'confirmado' | 'pendente' | 'cancelado';

export type Appointment = {
  id: number;
  petName: string;
  ownerName: string;
  phone: string;
  date: Date;
  service: string;
  status: AppointmentStatus;
  notes: string;
};

export type AppointmentFormData = Omit<Appointment, 'id'>;
