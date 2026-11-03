import React from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Plus, Calendar as CalendarIcon, RotateCcw, ChevronLeft } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

interface CalendarSidebarProps {
  selectedDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  onAddEvent?: () => void;
  onToggleCollapse?: () => void;
}

export function CalendarSidebar({ 
  selectedDate, 
  onDateChange, 
  onAddEvent,
  onToggleCollapse 
}: CalendarSidebarProps) {
  const today = new Date();
  const tomorrow = addDays(today, 1);

  return (
    <Card className="shadow-sm transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-primary" />
            Calendário
          </CardTitle>
          <div className="flex items-center gap-1">
            {selectedDate && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onDateChange(undefined)}
                title="Ver todas as datas"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            )}
            {onToggleCollapse && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={onToggleCollapse}
                title="Recolher calendário lateral"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <CardDescription className="text-xs">
          Filtre os agendamentos por dia
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col items-center p-3 pt-0">
        <Calendar 
          mode="single" 
          selected={selectedDate} 
          onSelect={onDateChange} 
          className="border rounded-md pointer-events-auto" 
          locale={pt} 
        />

        <div className="flex w-full gap-2 mt-3">
          <Button
            type="button"
            variant={selectedDate && isSameDay(selectedDate, today) ? "default" : "outline"}
            size="sm"
            className="flex-1 text-xs h-8"
            onClick={() => onDateChange(today)}
          >
            Hoje
          </Button>
          <Button
            type="button"
            variant={selectedDate && isSameDay(selectedDate, tomorrow) ? "default" : "outline"}
            size="sm"
            className="flex-1 text-xs h-8"
            onClick={() => onDateChange(tomorrow)}
          >
            Amanhã
          </Button>
        </div>
      </CardContent>

      <CardFooter className="flex flex-col items-center gap-2.5 pt-0">
        <div className="text-xs text-center text-muted-foreground capitalize">
          {selectedDate ? (
            format(selectedDate, "EEEE, dd 'de' MMMM", { locale: pt })
          ) : (
            "Exibindo todos os períodos"
          )}
        </div>
        {onAddEvent && (
          <Button 
            onClick={onAddEvent} 
            className="w-full flex items-center justify-center gap-2 text-xs h-9 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Novo Agendamento
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
