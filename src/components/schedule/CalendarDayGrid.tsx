import React from 'react';
import { format, isSameDay, getHours, getMinutes } from 'date-fns';
import { pt } from 'date-fns/locale';
import { UnifiedCalendarItem } from '@/types/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  PawPrint,
  User,
  Phone,
  MessageSquare,
  Copy,
  Check,
  BellRing,
  Calendar as CalendarIcon,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CalendarDayGridProps {
  currentDate: Date;
  events: UnifiedCalendarItem[];
  onSelectEvent: (event: UnifiedCalendarItem) => void;
}

const START_HOUR = 7;
const END_HOUR = 21;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

export function CalendarDayGrid({
  currentDate,
  events,
  onSelectEvent,
}: CalendarDayGridProps) {
  const [copiedPhone, setCopiedPhone] = React.useState<string | null>(null);

  const dayEvents = React.useMemo(() => {
    return events
      .filter((e) => isSameDay(e.start, currentDate))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [events, currentDate]);

  const handleCopyPhone = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    toast.success('Telefone copiado!');
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  return (
    <div className="flex flex-col rounded-xl border bg-card shadow-xs overflow-hidden">
      {/* Cabeçalho do Dia */}
      <div className="p-3 bg-muted/40 border-b flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold capitalize text-foreground flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-primary" />
            {format(currentDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: pt })}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {dayEvents.length} {dayEvents.length === 1 ? 'agendamento' : 'agendamentos'} para este dia
          </p>
        </div>

        {dayEvents.length > 0 && (
          <Badge variant="outline" className="font-mono text-xs">
            {format(dayEvents[0].start, 'HH:mm')} -{' '}
            {format(dayEvents[dayEvents.length - 1].start, 'HH:mm')}
          </Badge>
        )}
      </div>

      {/* Conteúdo: Lista rica por Horário ou Estado Vazio */}
      {dayEvents.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center justify-center text-muted-foreground">
          <Clock className="h-10 w-10 text-muted-foreground/30 mb-2" />
          <p className="text-sm font-medium">Nenhum agendamento encontrado para este dia</p>
          <p className="text-xs mt-1 text-muted-foreground/70">
            Você pode selecionar outra data no topo ou alternar para a visualização mensal/semanal.
          </p>
        </div>
      ) : (
        <div className="divide-y max-h-[640px] overflow-y-auto">
          {dayEvents.map((evt) => {
            const isReminder = evt.source === 'reminder';
            const cleanPhone = (evt.phone || '').replace(/\D/g, '');

            return (
              <div
                key={evt.id}
                onClick={() => onSelectEvent(evt)}
                className="p-3 hover:bg-muted/30 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                {/* Lado Esquerdo: Horário e Indicador */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className={cn(
                      'p-2 rounded-lg text-center shrink-0 min-w-[62px]',
                      isReminder ? 'bg-amber-500/10 text-amber-600' : 'bg-primary/10 text-primary'
                    )}
                  >
                    <span className="block text-xs font-mono font-bold">
                      {format(evt.start, 'HH:mm')}
                    </span>
                    <span className="block text-[10px] text-muted-foreground font-mono">
                      {evt.end ? format(evt.end, 'HH:mm') : ''}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      {isReminder ? (
                        <Badge
                          variant="secondary"
                          className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-semibold gap-1 py-0"
                        >
                          <BellRing className="h-2.5 w-2.5" />
                          Lembrete
                        </Badge>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded text-white"
                          style={{ backgroundColor: evt.color || '#3b82f6' }}
                        >
                          <CalendarIcon className="h-2.5 w-2.5" />
                          {evt.sourceName}
                        </span>
                      )}

                      {evt.status && (
                        <Badge variant="outline" className="text-[10px] uppercase font-mono py-0">
                          {evt.status}
                        </Badge>
                      )}

                      {evt.service && (
                        <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground">
                          {evt.service}
                        </Badge>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                      {evt.title}
                    </h4>

                    {/* Dados de Pet e Tutor */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                      {evt.petName && (
                        <span className="flex items-center gap-1 font-medium text-foreground">
                          <PawPrint className="h-3 w-3 text-amber-500" />
                          {evt.petName}
                        </span>
                      )}
                      {evt.ownerName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 text-blue-500" />
                          {evt.ownerName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lado Direito: Telefone e Ações Rápidas */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {evt.phone && (
                    <div className="flex items-center gap-1 bg-muted/60 px-2 py-1 rounded-md text-xs">
                      <Phone className="h-3 w-3 text-emerald-600" />
                      <span className="font-mono text-[11px]">{evt.phone}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 ml-1"
                        onClick={(e) => handleCopyPhone(evt.phone!, e)}
                        title="Copiar telefone"
                      >
                        {copiedPhone === evt.phone ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                      {cleanPhone && (
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-emerald-600 hover:text-emerald-700"
                          title="Abrir no WhatsApp"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a
                            href={`https://wa.me/55${cleanPhone.replace(/^55/, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageSquare className="h-3 w-3" />
                          </a>
                        </Button>
                      )}
                    </div>
                  )}

                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
