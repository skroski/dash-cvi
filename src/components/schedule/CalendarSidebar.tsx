
import React from 'react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';

interface CalendarSidebarProps {
  selectedDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  onAddEvent: () => void;
}

export function CalendarSidebar({ selectedDate, onDateChange, onAddEvent }: CalendarSidebarProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendário</CardTitle>
        <CardDescription>Selecione uma data</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Calendar 
          mode="single" 
          selected={selectedDate} 
          onSelect={onDateChange} 
          className="border rounded-md" 
          locale={pt} 
        />
      </CardContent>
      <CardFooter className="flex flex-col items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {selectedDate && format(selectedDate, "EEEE, dd 'de' MMMM", {
            locale: pt
          })}
        </p>
        <Button 
          onClick={onAddEvent} 
          className="w-full flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Adicionar Evento
        </Button>
      </CardFooter>
    </Card>
  );
}
