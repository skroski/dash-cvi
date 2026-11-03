import React from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { UnifiedCalendarItem } from '@/types/calendar';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { BellRing, Calendar as CalendarIcon, Clock, PawPrint } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarMonthGridProps {
  currentDate: Date;
  selectedDate: Date | undefined;
  events: UnifiedCalendarItem[];
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: UnifiedCalendarItem) => void;
  onDoubleClickDate?: (date: Date) => void;
}

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function CalendarMonthGrid({
  currentDate,
  selectedDate,
  events,
  onSelectDate,
  onSelectEvent,
  onDoubleClickDate,
}: CalendarMonthGridProps) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  // Mapear eventos por chave de data (YYYY-MM-DD) para busca ultrarrápida
  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, UnifiedCalendarItem[]>();
    events.forEach((event) => {
      const key = format(event.start, 'yyyy-MM-dd');
      const list = map.get(key) || [];
      list.push(event);
      map.set(key, list);
    });

    // Ordenar eventos de cada dia pelo horário
    map.forEach((list) => {
      list.sort((a, b) => a.start.getTime() - b.start.getTime());
    });

    return map;
  }, [events]);

  return (
    <div className="flex flex-col rounded-xl border bg-card shadow-xs overflow-hidden">
      {/* Cabeçalho dos Dias da Semana */}
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-semibold text-muted-foreground">
        {WEEK_DAYS.map((day, idx) => (
          <div
            key={day}
            className={cn(
              'py-2 border-r last:border-r-0',
              idx === 0 || idx === 6 ? 'text-muted-foreground/75' : 'text-foreground'
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Grade de Células dos Dias */}
      <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y border-b last:border-b-0">
        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayEvents = eventsByDay.get(dateKey) || [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const maxVisibleEvents = 3;
          const visibleEvents = dayEvents.slice(0, maxVisibleEvents);
          const hiddenCount = dayEvents.length - maxVisibleEvents;

          return (
            <div
              key={dateKey}
              onClick={() => onSelectDate(day)}
              onDoubleClick={() => onDoubleClickDate && onDoubleClickDate(day)}
              className={cn(
                'min-h-[105px] sm:min-h-[120px] p-1.5 flex flex-col justify-between transition-colors cursor-pointer select-none group',
                !isCurrentMonth && 'bg-muted/15 text-muted-foreground/50',
                isSelected && 'bg-primary/5 ring-1 ring-inset ring-primary/40',
                'hover:bg-muted/30'
              )}
            >
              {/* Topo da Célula: Número do Dia e Totalizador */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    'text-xs font-semibold h-6 w-6 flex items-center justify-center rounded-full transition-colors',
                    isCurrentDay && 'bg-primary text-primary-foreground font-bold shadow-2xs',
                    !isCurrentDay && isCurrentMonth && 'text-foreground group-hover:text-primary',
                    !isCurrentDay && !isCurrentMonth && 'text-muted-foreground/50'
                  )}
                >
                  {format(day, 'd')}
                </span>

                {dayEvents.length > 0 && (
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground font-medium">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              {/* Lista de Eventos no Dia */}
              <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                {visibleEvents.map((evt) => {
                  const isReminder = evt.source === 'reminder';
                  return (
                    <button
                      key={evt.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(evt);
                      }}
                      className={cn(
                        'w-full text-left rounded px-1.5 py-0.5 text-[11px] truncate flex items-center gap-1 transition-all',
                        isReminder
                          ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200 hover:bg-amber-500/25 border-l-2 border-amber-500'
                          : 'bg-primary/10 text-primary dark:text-primary-foreground hover:bg-primary/20 border-l-2 border-primary',
                        evt.isBlocked && 'opacity-60 bg-muted text-muted-foreground border-muted-foreground'
                      )}
                      style={
                        !isReminder && evt.color
                          ? { borderLeftColor: evt.color }
                          : undefined
                      }
                      title={`${format(evt.start, 'HH:mm')} - ${evt.title} ${evt.petName ? `(${evt.petName})` : ''}`}
                    >
                      {isReminder ? (
                        <BellRing className="h-2.5 w-2.5 shrink-0 text-amber-600" />
                      ) : (
                        <Clock className="h-2.5 w-2.5 shrink-0 text-primary/70" />
                      )}
                      <span className="font-mono text-[10px] shrink-0 font-medium">
                        {format(evt.start, 'HH:mm')}
                      </span>
                      <span className="truncate font-medium">{evt.title}</span>
                    </button>
                  );
                })}

                {/* Botão +N Mais com Popover */}
                {hiddenCount > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] font-semibold text-primary hover:underline text-left px-1 mt-0.5"
                      >
                        +{hiddenCount} mais...
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-72 p-2 shadow-lg"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="font-semibold text-xs pb-1 mb-2 border-b flex items-center justify-between">
                        <span>
                          {format(day, "EEEE, dd 'de' MMMM", { locale: pt })}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {dayEvents.length} agendamentos
                        </Badge>
                      </div>
                      <div className="max-h-56 overflow-y-auto space-y-1">
                        {dayEvents.map((evt) => (
                          <button
                            key={evt.id}
                            type="button"
                            onClick={() => onSelectEvent(evt)}
                            className="w-full text-left p-1.5 rounded hover:bg-muted text-xs flex items-center justify-between gap-2 transition-colors border"
                          >
                            <div className="truncate flex-1">
                              <p className="font-medium truncate">{evt.title}</p>
                              {evt.petName && (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <PawPrint className="h-2.5 w-2.5" />
                                  {evt.petName} {evt.ownerName ? `• ${evt.ownerName}` : ''}
                                </p>
                              )}
                            </div>
                            <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
                              {format(evt.start, 'HH:mm')}
                            </span>
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
