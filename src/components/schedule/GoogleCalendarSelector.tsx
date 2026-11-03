import React, { useState } from 'react';
import { GoogleCalendar } from '@/types/calendar';
import { CalendarDays, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface GoogleCalendarSelectorProps {
  calendars: GoogleCalendar[];
  selectedCalendarId: string;
  onSelectCalendar: (calendarId: string) => void;
  countsByCalendar?: Record<string, number>;
  isOpen?: boolean;
  onToggleOpen?: () => void;
}

export function GoogleCalendarSelector({
  calendars,
  selectedCalendarId,
  onSelectCalendar,
  countsByCalendar = {},
  isOpen: externalIsOpen,
  onToggleOpen: externalOnToggleOpen,
}: GoogleCalendarSelectorProps) {
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(() => {
    return localStorage.getItem('dash_schedule_calendar_badges_open') !== 'false';
  });

  const isControlled = externalIsOpen !== undefined;
  const isOpen = isControlled ? externalIsOpen : internalIsOpen;

  const handleToggle = () => {
    if (externalOnToggleOpen) {
      externalOnToggleOpen();
    } else {
      setInternalIsOpen((prev) => {
        const next = !prev;
        localStorage.setItem('dash_schedule_calendar_badges_open', String(next));
        return next;
      });
    }
  };

  const totalCount = Object.values(countsByCalendar).reduce((acc, c) => acc + c, 0);
  const selectedCalendar = calendars.find((c) => c.id === selectedCalendarId);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 text-primary" />
          <span>Agendas do Google ({calendars.length})</span>
        </label>

        <div className="flex items-center gap-2">
          {/* Badge de resumo quando recolhido */}
          {!isOpen && (
            <span className="text-xs font-medium text-foreground flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-lg border">
              {selectedCalendarId === 'all' ? (
                <>
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                  <span>Todas as Agendas</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-bold ml-0.5">
                    {totalCount}
                  </Badge>
                </>
              ) : selectedCalendar ? (
                <>
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs"
                    style={{ backgroundColor: selectedCalendar.backgroundColor || '#3b82f6' }}
                  />
                  <span className="truncate max-w-[130px] sm:max-w-[200px]">{selectedCalendar.summary}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-semibold ml-0.5">
                    {countsByCalendar[selectedCalendar.id] ?? 0}
                  </Badge>
                </>
              ) : null}
            </span>
          )}

          {isOpen && calendars.length > 0 && (
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              Clique na agenda para filtrar
            </span>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleToggle}
            className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            title={isOpen ? "Recolher badges para ganhar espaço" : "Expandir badges das agendas"}
          >
            {isOpen ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span>Recolher Badges</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5 text-primary" />
                <span>Expandir Badges ({calendars.length})</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Badges / Chips das agendas quando expandido */}
      {isOpen && (
        <div className="flex flex-wrap items-center gap-2 pt-1 transition-all">
          {/* Opção Todas as Agendas */}
          <button
            type="button"
            onClick={() => onSelectCalendar('all')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all shadow-xs",
              selectedCalendarId === 'all'
                ? "bg-primary text-primary-foreground border-primary shadow-sm ring-2 ring-primary/20"
                : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
            )}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Todas as Agendas</span>
            <Badge 
              variant="secondary" 
              className={cn(
                "ml-1 text-[10px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center font-bold",
                selectedCalendarId === 'all' ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {totalCount}
            </Badge>
          </button>

          {/* Agendas reais vindas da API do Google */}
          {calendars.map((calendar) => {
            const isSelected = selectedCalendarId === calendar.id;
            const count = countsByCalendar[calendar.id] ?? 0;
            const calendarColor = calendar.backgroundColor || '#3b82f6';

            return (
              <button
                key={calendar.id}
                type="button"
                onClick={() => onSelectCalendar(calendar.id)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all shadow-xs group",
                  isSelected
                    ? "bg-card text-foreground border-primary shadow-sm ring-2 ring-primary/30"
                    : "bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                )}
              >
                {/* Círculo indicador com a cor nativa da agenda no Google */}
                <span 
                  className="h-2.5 w-2.5 rounded-full shrink-0 shadow-xs ring-1 ring-black/10 dark:ring-white/10" 
                  style={{ backgroundColor: calendarColor }}
                />

                <span className="font-medium truncate max-w-[180px] sm:max-w-[220px]">
                  {calendar.summary}
                </span>

                {calendar.primary && (
                  <span className="text-[9px] text-muted-foreground font-normal border rounded px-1">
                    Principal
                  </span>
                )}

                <Badge 
                  variant="outline" 
                  className={cn(
                    "ml-0.5 text-[10px] px-1.5 py-0 h-4 min-w-4 flex items-center justify-center font-semibold border-muted",
                    isSelected ? "bg-primary/10 text-primary border-primary/30" : "bg-muted/60 text-muted-foreground"
                  )}
                >
                  {count}
                </Badge>

                {isSelected && <Check className="h-3 w-3 text-primary ml-0.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
