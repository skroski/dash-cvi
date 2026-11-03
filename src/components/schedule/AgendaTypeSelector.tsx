import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgendaType } from '@/hooks/useAgendaType';
import { CalendarDays, Stethoscope, Syringe, Microscope } from 'lucide-react';

interface AgendaTypeSelectorProps {
  selectedType: AgendaType;
  onTypeChange: (type: AgendaType) => void;
  counts?: {
    todas?: number;
    consultaveterinaria?: number;
    vacinas?: number;
    exame?: number;
  };
}

export function AgendaTypeSelector({ selectedType, onTypeChange, counts }: AgendaTypeSelectorProps) {
  return (
    <Tabs 
      value={selectedType} 
      className="w-full" 
      onValueChange={(value) => onTypeChange(value as AgendaType)}
    >
      <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full h-auto p-1 bg-muted/60">
        <TabsTrigger value="todas" className="flex items-center justify-center gap-2 py-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span>Todas</span>
          {counts?.todas !== undefined && counts.todas > 0 && (
            <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.2 text-[11px] font-semibold text-primary">
              {counts.todas}
            </span>
          )}
        </TabsTrigger>

        <TabsTrigger value="consultaveterinaria" className="flex items-center justify-center gap-2 py-2">
          <Stethoscope className="h-4 w-4 text-chart-4" />
          <span>Consultas</span>
          {counts?.consultaveterinaria !== undefined && counts.consultaveterinaria > 0 && (
            <span className="ml-1 rounded-full bg-chart-4/10 px-1.5 py-0.2 text-[11px] font-semibold text-chart-4">
              {counts.consultaveterinaria}
            </span>
          )}
        </TabsTrigger>

        <TabsTrigger value="vacinas" className="flex items-center justify-center gap-2 py-2">
          <Syringe className="h-4 w-4 text-chart-6" />
          <span>Vacinas</span>
          {counts?.vacinas !== undefined && counts.vacinas > 0 && (
            <span className="ml-1 rounded-full bg-chart-6/10 px-1.5 py-0.2 text-[11px] font-semibold text-chart-6">
              {counts.vacinas}
            </span>
          )}
        </TabsTrigger>

        <TabsTrigger value="exame" className="flex items-center justify-center gap-2 py-2">
          <Microscope className="h-4 w-4 text-chart-2" />
          <span>Exames</span>
          {counts?.exame !== undefined && counts.exame > 0 && (
            <span className="ml-1 rounded-full bg-chart-2/10 px-1.5 py-0.2 text-[11px] font-semibold text-chart-2">
              {counts.exame}
            </span>
          )}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
