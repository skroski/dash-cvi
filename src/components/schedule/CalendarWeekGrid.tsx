import React, { useMemo } from 'react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isToday,
  getHours,
  getMinutes,
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { UnifiedCalendarItem } from '@/types/calendar';
import { BellRing, Clock, PawPrint } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarWeekGridProps {
  currentDate: Date;
  selectedDate: Date | undefined;
  events: UnifiedCalendarItem[];
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: UnifiedCalendarItem) => void;
}

const START_HOUR = 7;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

export function CalendarWeekGrid({
  currentDate,
  selectedDate,
  events,
  onSelectDate,
  onSelectEvent,
}: CalendarWeekGridProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Posição da linha de horário atual (caso hoje esteja na semana visível)
  const now = new Date();
  const currentMinutes = getHours(now) * 60 + getMinutes(now);
  const nowTop = (currentMinutes - START_HOUR * 60);

  // Mapear eventos por dia
  const eventsByDay = useMemo(() => {
    const map = new Map<string, UnifiedCalendarItem[]>();
    events.forEach((evt) => {
      const key = format(evt.start, 'yyyy-MM-dd');
      const list = map.get(key) || [];
      list.push(evt);
      map.set(key, list);
    });
    return map;
  }, [events]);

  return (
    <div className="flex flex-col rounded-xl border bg-card shadow-xs overflow-hidden">
      {/* Cabeçalho da Semana (Dias) */}
      <div className="grid grid-cols-8 border-b bg-muted/40 text-center text-xs font-semibold">
        <div className="py-2.5 px-2 border-r text-muted-foreground text-[11px] flex items-center justify-center">
          Horário
        </div>
        {days.map((day) => {
          const isCurrent = isToday(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          return (
            <div
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={cn(
                'py-2 px-1 border-r last:border-r-0 cursor-pointer transition-colors hover:bg-muted/50 flex flex-col items-center justify-center gap-0.5',
                isSelected && 'bg-primary/5',
                isCurrent && 'text-primary font-bold'
              )}
            >
              <span className="text-[11px] text-muted-foreground uppercase">
                {format(day, 'EEE', { locale: pt })}
              </span>
              <span
                className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center text-xs',
                  isCurrent && 'bg-primary text-primary-foreground font-bold shadow-2xs',
                  !isCurrent && 'text-foreground'
                )}
              >
                {format(day, 'd')}
              </span>
            </div>
          );
        })}
      </div>

      {/* Grade de Horários e Eventos */}
      <div className="relative max-h-[640px] overflow-y-auto">
        <div className="grid grid-cols-8 relative" style={{ height: `${HOURS.length * 60}px` }}>
          {/* Coluna de Horários (Eixo Y) */}
          <div className="border-r bg-muted/10 relative">
            {HOURS.map((hour, idx) => (
              <div
                key={hour}
                className="absolute w-full text-right pr-2 text-[11px] font-mono text-muted-foreground border-b select-none flex items-start justify-end"
                style={{ top: `${idx * 60}px`, height: '60px' }}
              >
                <span className="-translate-y-2">{String(hour).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>

          {/* Colunas dos 7 Dias */}
          {days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDay.get(dateKey) || [];
            const isDayToday = isToday(day);

            return (
              <div
                key={dateKey}
                className="border-r last:border-r-0 relative hover:bg-muted/10 transition-colors"
              >
                {/* Linhas horizontais das horas */}
                {HOURS.map((hour, idx) => (
                  <div
                    key={hour}
                    className="absolute w-full border-b border-muted/50"
                    style={{ top: `${idx * 60}px`, height: '60px' }}
                  />
                ))}

                {/* Linha de Horário Atual se for hoje */}
                {isDayToday && nowTop >= 0 && nowTop <= HOURS.length * 60 && (
                  <div
                    className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                    style={{ top: `${nowTop}px` }}
                  >
                    <div className="h-2 w-2 rounded-full bg-rose-500 -ml-1 shadow-xs" />
                    <div className="h-[1.5px] w-full bg-rose-500 shadow-xs" />
                  </div>
                )}

                {/* Blocos de Eventos */}
                {dayEvents.map((evt) => {
                  const startHour = getHours(evt.start);
                  const startMin = getMinutes(evt.start);
                  const endHour = getHours(evt.end);
                  const endMin = getMinutes(evt.end);

                  const startOffset = (startHour - START_HOUR) * 60 + startMin;
                  let durationMinutes = (endHour - startHour) * 60 + (endMin - startMin);
                  if (durationMinutes <= 0) durationMinutes = 30; // fallback para duração mínima

                  // Se o evento estiver fora da janela visível
                  if (startOffset < 0 && startOffset + durationMinutes <= 0) return null;
                  if (startOffset > HOURS.length * 60) return null;

                  const top = Math.max(0, startOffset);
                  const height = Math.max(26, Math.min(durationMinutes, HOURS.length * 60 - top));
                  const isReminder = evt.source === 'reminder';

                  return (
                    <div
                      key={evt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(evt);
                      }}
                      className={cn(
                        'absolute left-1 right-1 z-10 rounded p-1 text-[11px] cursor-pointer shadow-2xs border overflow-hidden transition-all hover:scale-[1.02] hover:z-30',
                        isReminder
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-950 dark:text-amber-200'
                          : 'bg-primary/20 border-primary/40 text-primary-foreground dark:text-primary',
                        evt.isBlocked && 'opacity-60 bg-muted/70 text-muted-foreground border-muted-foreground'
                      )}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: !isReminder && evt.color ? `${evt.color}25` : undefined,
                        borderColor: !isReminder && evt.color ? evt.color : undefined,
                      }}
                      title={`${format(evt.start, 'HH:mm')} - ${evt.title}`}
                    >
                      <div className="flex items-center gap-1 font-semibold truncate leading-tight">
                        {isReminder ? (
                          <BellRing className="h-2.5 w-2.5 text-amber-600 shrink-0" />
                        ) : (
                          <Clock className="h-2.5 w-2.5 text-primary shrink-0" />
                        )}
                        <span className="font-mono text-[10px]">
                          {format(evt.start, 'HH:mm')}
                        </span>
                        <span className="truncate">{evt.title}</span>
                      </div>

                      {height >= 45 && evt.petName && (
                        <div className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <PawPrint className="h-2.5 w-2.5 shrink-0" />
                          <span>{evt.petName}</span>
                          {evt.ownerName && <span>• {evt.ownerName}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
