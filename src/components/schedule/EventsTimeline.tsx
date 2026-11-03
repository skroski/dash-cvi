import React from 'react';
import { format, isValid } from 'date-fns';
import { pt } from 'date-fns/locale';
import { 
  Clock, Calendar as CalendarIcon, PawPrint, User, ExternalLink, 
  Eye, Sun, Sunset, Moon, LoaderCircle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CalendarEvent } from '@/types/calendar';

interface EventsTimelineProps {
  events: CalendarEvent[];
  isLoading: boolean;
  onViewDetails: (event: CalendarEvent) => void;
  onOpenEventLink: (url: string) => void;
  selectedCalendarName?: string;
  onSwitchToAll?: () => void;
  onClearCalendarFilter?: () => void;
}

export function EventsTimeline({ 
  events, 
  isLoading, 
  onViewDetails, 
  onOpenEventLink,
  selectedCalendarName,
  onSwitchToAll,
  onClearCalendarFilter
}: EventsTimelineProps) {
  const getCalendarBadge = (calendarName?: string, calendarColor?: string) => {
    return (
      <span 
        className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full text-white shadow-2xs"
        style={{ backgroundColor: calendarColor || '#3b82f6' }}
      >
        <CalendarIcon className="h-3 w-3 shrink-0" />
        <span>{calendarName || 'Agenda'}</span>
      </span>
    );
  };

  const parseSafeDate = (isoString?: string) => {
    if (!isoString) return new Date();
    const d = new Date(isoString);
    return isValid(d) ? d : new Date();
  };

  if (isLoading && events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
        <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm">Carregando agendamentos do Google...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center text-muted-foreground">
        <p className="font-semibold text-foreground">
          {selectedCalendarName 
            ? `Nenhum agendamento para ${selectedCalendarName}` 
            : 'Nenhum agendamento para este período'}
        </p>
        <p className="text-xs mt-1 max-w-md">
          Não há atendimentos correspondentes aos filtros selecionados.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
          {onSwitchToAll && (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={onSwitchToAll}>
              <CalendarIcon className="h-3.5 w-3.5 text-primary" />
              Ver em Todas as Datas
            </Button>
          )}
          {onClearCalendarFilter && (
            <Button variant="secondary" size="sm" className="h-8 text-xs gap-1.5" onClick={onClearCalendarFilter}>
              Ver Todas as Agendas
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Agrupar por turno: Manhã (< 12:00), Tarde (12:00 - 18:00), Noite (>= 18:00)
  const morningEvents = events.filter(e => parseSafeDate(e.start).getHours() < 12);
  const afternoonEvents = events.filter(e => {
    const h = parseSafeDate(e.start).getHours();
    return h >= 12 && h < 18;
  });
  const eveningEvents = events.filter(e => parseSafeDate(e.start).getHours() >= 18);

  const renderGroup = (title: string, icon: React.ReactNode, groupEvents: CalendarEvent[]) => {
    if (groupEvents.length === 0) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 pb-1 border-b text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {icon}
          <span>{title} ({groupEvents.length})</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groupEvents.map(event => {
            const startDate = parseSafeDate(event.start);
            const endDate = parseSafeDate(event.end);
            const attendee = event.attendees?.find(a => a !== null);

            return (
              <div 
                key={event.id}
                onClick={() => onViewDetails(event)}
                className="group relative rounded-xl border bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/40 transition-all cursor-pointer flex flex-col justify-between gap-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
                    <Clock className="h-4 w-4 text-primary shrink-0" />
                    <span>{format(startDate, 'HH:mm')}</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      - {format(endDate, 'HH:mm')}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      ({format(startDate, "dd/MM", { locale: pt })})
                    </span>
                  </div>

                  <div>
                    {getCalendarBadge(event.calendarName, event.calendarColor)}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {event.summary}
                  </h4>
                  {event.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1 whitespace-pre-line">
                      {event.description}
                    </p>
                  )}
                </div>

                {/* Paciente e Tutor info */}
                <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-3">
                    {event.petName && (
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        <PawPrint className="h-3 w-3 text-amber-500" />
                        {event.petName}
                      </span>
                    )}
                    {event.ownerName && (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {event.ownerName}
                      </span>
                    )}
                    {!event.petName && !event.ownerName && attendee?.email && (
                      <span className="text-muted-foreground">{attendee.email}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2 text-xs gap-1 text-primary hover:bg-primary/10"
                      onClick={() => onViewDetails(event)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver
                    </Button>

                    {event.htmlLink && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => onOpenEventLink(event.htmlLink!)}
                        title="Abrir no Google Agenda"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {renderGroup("Manhã", <Sun className="h-4 w-4 text-amber-500" />, morningEvents)}
      {renderGroup("Tarde", <Sunset className="h-4 w-4 text-orange-500" />, afternoonEvents)}
      {renderGroup("Noite", <Moon className="h-4 w-4 text-indigo-500" />, eveningEvents)}
    </div>
  );
}
