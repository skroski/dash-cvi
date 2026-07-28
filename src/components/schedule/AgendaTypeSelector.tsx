
import React from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AgendaType } from '@/hooks/useAgendaType';
import { Stethoscope, Syringe, Microscope, MapPinHouse } from 'lucide-react';

interface AgendaTypeSelectorProps {
  selectedType: AgendaType;
  onTypeChange: (type: AgendaType) => void;
}

export function AgendaTypeSelector({ selectedType, onTypeChange }: AgendaTypeSelectorProps) {
  return (
    <Tabs 
      defaultValue={selectedType} 
      className="w-full" 
      onValueChange={(value) => onTypeChange(value as AgendaType)}
      value={selectedType}
    >
      <TabsList className="grid grid-cols-4 w-full">
        <TabsTrigger value="consultaveterinaria" className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4" />
          <span className="hidden sm:inline">Veterinário</span>
        </TabsTrigger>
        <TabsTrigger value="vacinas" className="flex items-center gap-2">
          <Syringe className="h-4 w-4" />
          <span className="hidden sm:inline">Vacinas</span>
        </TabsTrigger>
        <TabsTrigger value="exame" className="flex items-center gap-2">
          <Microscope className="h-4 w-4" />
          <span className="hidden sm:inline">Exames</span>
        </TabsTrigger>
        <TabsTrigger value="hotel" className="flex items-center gap-2">
          <MapPinHouse className="h-4 w-4" />
          <span className="hidden sm:inline">Hotel</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
