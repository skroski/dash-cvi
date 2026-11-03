import type { ReminderDelivery } from './reminder';

// Tipos para integração direta com a Google Calendar API v3

export type GoogleCalendar = {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
  selected?: boolean;
  timeZone?: string;
};

export type CalendarAttendee = {
  email?: string;
  displayName?: string;
};

export type CalendarEvent = {
  id: string;
  summary: string;
  start: string; // ISO string
  end: string;   // ISO string
  htmlLink?: string;
  description?: string;
  location?: string;
  calendarId: string;
  calendarName: string;
  calendarColor?: string;
  petName?: string;
  ownerName?: string;
  phone?: string;
  status?: string;
  service?: string;
  attendees?: (CalendarAttendee | null)[];
};

export type UnifiedCalendarItem = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  source: 'google' | 'reminder';
  sourceName: string;
  color?: string;
  petName?: string;
  ownerName?: string;
  phone?: string;
  status?: string;
  service?: string;
  description?: string;
  location?: string;
  isBlocked?: boolean;
  htmlLink?: string;
  rawGoogleEvent?: CalendarEvent;
  rawReminder?: ReminderDelivery;
};
