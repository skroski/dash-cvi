import React from 'react';
import { format, isValid } from 'date-fns';
import { pt } from 'date-fns/locale';
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Clock, Calendar as CalendarIcon, 
  PawPrint, User, Phone, Mail, MapPin, ExternalLink, Copy, Check 
} from 'lucide-react';
import { CalendarEvent } from '@/types/calendar';
import { toast } from 'sonner';

interface AppointmentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
}

export function AppointmentDetailsDialog({ open, onOpenChange, event }: AppointmentDetailsDialogProps) {
  const [copiedPhone, setCopiedPhone] = React.useState(false);

  if (!event) return null;

  const rawStart = new Date(event.start);
  const rawEnd = new Date(event.end);
  const startDate = isValid(rawStart) ? rawStart : new Date();
  const endDate = isValid(rawEnd) ? rawEnd : new Date();

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    toast.success("Telefone copiado para a área de transferência!");
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const attendee = event.attendees?.find(a => a !== null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-2 pb-2 border-b">
          <div className="flex items-center gap-2">
            <span 
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md text-white shadow-2xs"
              style={{ backgroundColor: event.calendarColor || '#3b82f6' }}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {event.calendarName}
            </span>
          </div>
          <DialogTitle className="text-xl font-bold leading-tight text-foreground">
            {event.summary}
          </DialogTitle>
          <DialogDescription className="text-xs flex items-center gap-1.5 text-muted-foreground">
            <CalendarIcon className="h-3.5 w-3.5" />
            {format(startDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: pt })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3">
          {/* Card Horário */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border text-sm">
            <Clock className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="font-semibold text-foreground">
                {format(startDate, 'HH:mm')} às {format(endDate, 'HH:mm')}
              </p>
              <p className="text-xs text-muted-foreground">
                Horário agendado no Google Calendar
              </p>
            </div>
          </div>

          {/* Dados do Paciente e Tutor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border bg-card space-y-1">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <PawPrint className="h-3.5 w-3.5 text-amber-500" />
                Paciente (Pet)
              </span>
              <p className="text-sm font-bold text-foreground">
                {event.petName || 'Não especificado'}
              </p>
            </div>

            <div className="p-3 rounded-lg border bg-card space-y-1">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-blue-500" />
                Tutor / Cliente
              </span>
              <p className="text-sm font-bold text-foreground">
                {event.ownerName || (attendee?.email ? attendee.email : 'Não informado')}
              </p>
            </div>
          </div>

          {/* Telefone e E-mail */}
          {(event.phone || attendee?.email) && (
            <div className="p-3 rounded-lg border bg-card space-y-2 text-sm">
              {event.phone && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-emerald-600" />
                    Telefone:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium">{event.phone}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6" 
                      onClick={() => handleCopyPhone(event.phone!)}
                      title="Copiar telefone"
                    >
                      {copiedPhone ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              )}

              {attendee?.email && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-blue-500" />
                    E-mail:
                  </span>
                  <span className="font-mono text-xs text-foreground truncate max-w-[220px]">
                    {attendee.email}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Localização se houver */}
          {event.location && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span>{event.location}</span>
            </div>
          )}

          {/* Descrição e Observações */}
          {event.description ? (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">
                Observações / Descrição do Agendamento:
              </span>
              <div className="p-3 rounded-lg border bg-muted/20 text-xs text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                {event.description}
              </div>
            </div>
          ) : (
            <p className="text-xs italic text-muted-foreground text-center py-1">
              Sem observações adicionais no Google Agenda.
            </p>
          )}
        </div>

        <DialogFooter className="border-t pt-3 flex flex-row items-center justify-between sm:justify-between">
          <div>
            {event.htmlLink ? (
              <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
                <a href={event.htmlLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 text-primary" />
                  Abrir no Google Agenda
                </a>
              </Button>
            ) : null}
          </div>
          <Button variant="default" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
