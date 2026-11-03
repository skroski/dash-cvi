import React, { useState } from 'react';
import { format, isValid } from 'date-fns';
import { pt } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  Calendar as CalendarIcon,
  PawPrint,
  User,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Copy,
  Check,
  BellRing,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { UnifiedCalendarItem } from '@/types/calendar';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

interface UnifiedCalendarEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: UnifiedCalendarItem | null;
}

export function UnifiedCalendarEventDialog({
  open,
  onOpenChange,
  event,
}: UnifiedCalendarEventDialogProps) {
  const [copiedPhone, setCopiedPhone] = useState(false);

  if (!event) return null;

  const startDate = isValid(event.start) ? event.start : new Date();
  const endDate = isValid(event.end) ? event.end : startDate;

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    toast.success('Telefone copiado para a área de transferência!');
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const isReminder = event.source === 'reminder';
  const attendee = event.rawGoogleEvent?.attendees?.find((a) => a !== null);
  const cleanPhone = (event.phone || '').replace(/\D/g, '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-2 pb-2 border-b">
          <div className="flex flex-wrap items-center gap-2">
            {isReminder ? (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 gap-1.5 text-xs font-semibold px-2.5 py-1">
                <BellRing className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                Lembrete / Vacina
              </Badge>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md text-white shadow-2xs"
                style={{ backgroundColor: event.color || '#3b82f6' }}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {event.sourceName || 'Google Agenda'}
              </span>
            )}

            {event.status && (
              <Badge variant="outline" className="text-xs uppercase tracking-wider font-mono">
                {event.status}
              </Badge>
            )}

            {event.service && (
              <Badge variant="secondary" className="text-xs font-normal">
                {event.service}
              </Badge>
            )}
          </div>

          <DialogTitle className="text-xl font-bold leading-tight text-foreground">
            {event.title}
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
                {format(startDate, 'HH:mm')}
                {event.end && event.end.getTime() !== event.start.getTime()
                  ? ` às ${format(endDate, 'HH:mm')}`
                  : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                {isReminder
                  ? 'Horário agendado para o atendimento / disparo de lembrete'
                  : 'Horário do evento sincronizado do Google Calendar'}
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
                {event.ownerName ||
                  (attendee?.email ? attendee.email : 'Não informado')}
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
                      {copiedPhone ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    {cleanPhone && (
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-emerald-600 hover:text-emerald-700"
                        title="Abrir no WhatsApp Web"
                      >
                        <a
                          href={`https://wa.me/55${cleanPhone.replace(/^55/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          WhatsApp
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {attendee?.email && (
                <div className="flex items-center justify-between gap-2 pt-1 border-t">
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
                Observações / Descrição:
              </span>
              <div className="p-3 rounded-lg border bg-muted/20 text-xs text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                {event.description}
              </div>
            </div>
          ) : (
            <p className="text-xs italic text-muted-foreground text-center py-1">
              Sem observações adicionais cadastradas.
            </p>
          )}

          {/* Informações extras se for lembrete */}
          {isReminder && event.rawReminder && (
            <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>
                  Regra associada:{' '}
                  <strong>{event.rawReminder.configurationName || 'Padrão'}</strong>
                </span>
              </div>
              <Link
                to="/reminders"
                className="underline hover:text-amber-800 font-semibold text-[11px]"
              >
                Ver Lembretes
              </Link>
            </div>
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
