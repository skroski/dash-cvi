import React from 'react';
import { format, isSameDay, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { 
  Table, TableHeader, TableBody, TableRow, 
  TableHead, TableCell 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { 
  Edit, Trash2, Clock, Mail, LinkIcon, LoaderCircle, 
  Stethoscope, Calendar,
  Syringe,
  Microscope,
  MapPinHouse
} from 'lucide-react';
import { CalendarEvent } from '@/types/calendar';
import { AgendaType } from '@/hooks/useAgendaType';

interface EventsTableProps {
  events: CalendarEvent[];
  isLoading: boolean;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (event: CalendarEvent) => void;
  onOpenEventLink: (url: string) => void;
  agendaType?: AgendaType;
}

export function EventsTable({ 
  events, 
  isLoading, 
  onEditEvent, 
  onDeleteEvent, 
  onOpenEventLink,
  agendaType = 'consultaveterinaria'
}: EventsTableProps) {
  
  const getStatusColor = (status: string, responseStatus?: string) => {
    if (responseStatus) {
      switch (responseStatus) {
        case 'accepted':
          return 'bg-success/10 text-success';
        case 'tentative':
          return 'bg-warning/10 text-warning';
        case 'declined':
          return 'bg-destructive/10 text-destructive';
        case 'needsAction':
          return 'bg-accent text-accent-foreground';
        default:
          return 'bg-muted text-muted-foreground';
      }
    }
    
    switch (status) {
      case 'confirmed':
        return 'bg-success/10 text-success';
      case 'tentative':
        return 'bg-warning/10 text-warning';
      case 'cancelled':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };
  
  const getResponseStatusLabel = (responseStatus?: string) => {
    switch (responseStatus) {
      case 'accepted':
        return 'Confirmado';
      case 'tentative':
        return 'Provisório';
      case 'declined':
        return 'Recusado';
      case 'needsAction':
        return 'Pendente';
      default:
        return 'Indefinido';
    }
  };

  const getAgendaTypeIcon = () => {
    switch (agendaType) {
      case 'consultaveterinaria':
        return <Stethoscope className="h-4 w-4 text-chart-4" />;
      case 'vacinas':
        return <Syringe className="h-4 w-4 text-chart-6" />;
      case 'exame':
        return <Microscope className="h-4 w-4 text-chart-2" />;
      case 'hotel':
        return <MapPinHouse className="h-4 w-4 text-chart-1" />;
      default:
        return <Calendar className="h-4 w-4 text-chart-5" />;
    }
  };
  
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Horário</TableHead>
            <TableHead className="flex items-center gap-1">
              {getAgendaTypeIcon()}
              <span>Serviço</span>
            </TableHead>
            <TableHead>Participante</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length > 0 ? events.map(event => {
            const startDate = parseISO(event.start);
            const endDate = parseISO(event.end);
            const attendee = event.attendees?.find(a => a !== null);
            
            return (
              <TableRow key={event.id}>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {format(startDate, 'HH:mm')}
                    {!isSameDay(startDate, endDate) && ' - evento de múltiplos dias'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(startDate, "dd/MM/yyyy")}
                  </div>
                </TableCell>
                <TableCell className="font-medium">{event.summary}</TableCell>
                <TableCell>
                  {attendee?.email ? (
                    <div className="flex items-center gap-1">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {attendee.email}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Sem participante</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(event.status, attendee?.responseStatus)}`}>
                    {getResponseStatusLabel(attendee?.responseStatus)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => onEditEvent(event)} 
                      title="Editar evento"
                      className="text-primary hover:bg-accent hover:text-primary"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => onDeleteEvent(event)} 
                      title="Excluir evento"
                      className="text-red-600 hover:text-red-800 hover:bg-red-100 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => onOpenEventLink(event.htmlLink)} 
                      title="Abrir no Google Calendar"
                    >
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          }) : (
            <TableRow>
              <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                {isLoading ? (
                  <div className="flex justify-center items-center gap-2">
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    <span>Carregando eventos...</span>
                  </div>
                ) : (
                  "Nenhum evento encontrado para esta data ou pesquisa."
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
