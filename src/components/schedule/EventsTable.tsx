import React from 'react';
import { format, isValid } from 'date-fns';
import { pt } from 'date-fns/locale';
import { 
  Table, TableHeader, TableBody, TableRow, 
  TableHead, TableCell 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
  Clock, ExternalLink, LoaderCircle, 
  Calendar as CalendarIcon, PawPrint, User, Phone, Eye
} from 'lucide-react';
import { CalendarEvent } from '@/types/calendar';

interface EventsTableProps {
  events: CalendarEvent[];
  isLoading: boolean;
  onViewDetails: (event: CalendarEvent) => void;
  onOpenEventLink: (url: string) => void;
  selectedCalendarName?: string;
  onSwitchToAll?: () => void;
  onClearCalendarFilter?: () => void;
}

export function EventsTable({ 
  events, 
  isLoading, 
  onViewDetails, 
  onOpenEventLink,
  selectedCalendarName,
  onSwitchToAll,
  onClearCalendarFilter
}: EventsTableProps) {
  
  const getCalendarBadge = (calendarName?: string, calendarColor?: string) => {
    return (
      <span 
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-md text-white shadow-2xs truncate max-w-[160px]"
        style={{ backgroundColor: calendarColor || '#3b82f6' }}
      >
        <CalendarIcon className="h-3 w-3 shrink-0" />
        <span className="truncate">{calendarName || 'Agenda'}</span>
      </span>
    );
  };

  const parseSafeDate = (isoString?: string) => {
    if (!isoString) return new Date();
    const d = new Date(isoString);
    return isValid(d) ? d : new Date();
  };
  
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[140px] font-semibold">Horário & Data</TableHead>
            <TableHead className="w-[150px] font-semibold">Agenda do Google</TableHead>
            <TableHead className="font-semibold">Procedimento / Título</TableHead>
            <TableHead className="font-semibold">Paciente & Tutor</TableHead>
            <TableHead className="text-right w-[110px] font-semibold">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length > 0 ? (
            events.map((event) => {
              const startDate = parseSafeDate(event.start);
              const endDate = parseSafeDate(event.end);
              const attendee = event.attendees?.find(a => a !== null);
              
              return (
                <TableRow 
                  key={event.id} 
                  className="hover:bg-muted/40 transition-colors cursor-pointer group"
                  onClick={() => onViewDetails(event)}
                >
                  {/* Horário e Data */}
                  <TableCell className="align-top py-3">
                    <div className="flex items-center gap-1.5 font-semibold text-sm text-foreground">
                      <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{format(startDate, 'HH:mm')}</span>
                      <span className="text-xs text-muted-foreground font-normal">
                        - {format(endDate, 'HH:mm')}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                      {format(startDate, "EEE, dd/MM", { locale: pt })}
                    </div>
                  </TableCell>

                  {/* Agenda de Origem no Google */}
                  <TableCell className="align-top py-3">
                    {getCalendarBadge(event.calendarName, event.calendarColor)}
                  </TableCell>

                  {/* Resumo do Atendimento */}
                  <TableCell className="align-top py-3">
                    <div className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                      {event.summary}
                    </div>
                    {event.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 whitespace-pre-line">
                        {event.description}
                      </p>
                    )}
                  </TableCell>

                  {/* Paciente e Tutor */}
                  <TableCell className="align-top py-3">
                    <div className="space-y-1 text-xs">
                      {event.petName ? (
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <PawPrint className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span>{event.petName}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <PawPrint className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="italic">Paciente a confirmar</span>
                        </div>
                      )}

                      {event.ownerName ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <User className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate max-w-[150px]">{event.ownerName}</span>
                        </div>
                      ) : attendee?.email ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <User className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate max-w-[150px]">{attendee.email}</span>
                        </div>
                      ) : null}

                      {event.phone && (
                        <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-[11px]">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span>{event.phone}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Ações */}
                  <TableCell className="align-top py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 px-2 text-xs gap-1 text-primary hover:bg-primary/10"
                        onClick={() => onViewDetails(event)} 
                        title="Ver detalhes do agendamento"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Ver</span>
                      </Button>

                      {event.htmlLink && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => onOpenEventLink(event.htmlLink!)} 
                          title="Abrir no Google Agenda"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                {isLoading ? (
                  <div className="flex flex-col justify-center items-center gap-2 py-4">
                    <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm font-medium">Carregando dados da API do Google...</span>
                  </div>
                ) : (
                  <div className="py-4 space-y-2 flex flex-col items-center">
                    <p className="font-semibold text-foreground">
                      {selectedCalendarName 
                        ? `Nenhum agendamento para ${selectedCalendarName}` 
                        : 'Nenhum agendamento encontrado'}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Alterne a agenda ou a data selecionada para visualizar os dados.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                      {onSwitchToAll && (
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onSwitchToAll}>
                          <CalendarIcon className="h-3 w-3 text-primary" />
                          Ver em Todas as Datas
                        </Button>
                      )}
                      {onClearCalendarFilter && (
                        <Button variant="secondary" size="sm" className="h-7 text-xs gap-1.5" onClick={onClearCalendarFilter}>
                          Ver Todas as Agendas
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
