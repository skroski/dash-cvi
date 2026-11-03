import React, { useState, useEffect } from 'react';
import { format, isValid, addHours } from 'date-fns';
import { Calendar as CalendarIcon, Clock, Stethoscope, Syringe, Microscope } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { EventFormData, CalendarEvent } from '@/types/calendar';

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (formData: EventFormData) => void;
  isSubmitting: boolean;
  event?: CalendarEvent;
  title: string;
  description: string;
  submitLabel: string;
  defaultAgendaType?: 'consultaveterinaria' | 'vacinas' | 'exame';
}

export function EventFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  event,
  title,
  description,
  submitLabel,
  defaultAgendaType = 'consultaveterinaria'
}: EventFormDialogProps) {
  const initialFormState: EventFormData = {
    summary: '',
    description: '',
    email: '',
    date: new Date(),
    startTime: '09:00',
    endTime: '10:00',
    agendaType: defaultAgendaType
  };

  const [formData, setFormData] = useState<EventFormData>(initialFormState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (event) {
      const rawStart = new Date(event.start);
      const startDate = isValid(rawStart) ? rawStart : new Date();
      const rawEnd = new Date(event.end);
      const endDate = isValid(rawEnd) ? rawEnd : addHours(startDate, 1);
      
      setFormData({
        summary: event.summary || '',
        description: event.description || '',
        email: event.attendees?.find(a => a !== null && a.email)?.email || '',
        date: startDate,
        startTime: format(startDate, 'HH:mm'),
        endTime: format(endDate, 'HH:mm'),
        agendaType: event.agendaType || defaultAgendaType
      });
    } else {
      setFormData({
        ...initialFormState,
        agendaType: defaultAgendaType
      });
    }
  }, [event, open, defaultAgendaType]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.summary.trim()) {
      newErrors.summary = 'O título ou procedimento é obrigatório';
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Digite um e-mail válido';
    }
    
    if (!formData.date) {
      newErrors.date = 'A data é obrigatória';
    }
    
    if (!formData.startTime) {
      newErrors.startTime = 'A hora de início é obrigatória';
    }
    
    if (!formData.endTime) {
      newErrors.endTime = 'A hora de término é obrigatória';
    } else if (formData.startTime >= formData.endTime) {
      newErrors.endTime = 'A hora de término deve ser posterior à hora de início';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleChange = <K extends keyof EventFormData>(field: K, value: EventFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="agendaType">Tipo de Agenda / Serviço</Label>
            <Select
              value={formData.agendaType || 'consultaveterinaria'}
              onValueChange={(val) => handleChange('agendaType', val)}
            >
              <SelectTrigger id="agendaType" className="w-full">
                <SelectValue placeholder="Selecione a agenda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consultaveterinaria">
                  <span className="flex items-center gap-2">
                    <Stethoscope className="h-4 w-4 text-chart-4" />
                    Consulta Veterinária
                  </span>
                </SelectItem>
                <SelectItem value="vacinas">
                  <span className="flex items-center gap-2">
                    <Syringe className="h-4 w-4 text-chart-6" />
                    Vacina
                  </span>
                </SelectItem>
                <SelectItem value="exame">
                  <span className="flex items-center gap-2">
                    <Microscope className="h-4 w-4 text-chart-2" />
                    Exame
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="summary">Título / Procedimento <span className="text-destructive">*</span></Label>
            <Input
              id="summary"
              value={formData.summary}
              onChange={(e) => handleChange('summary', e.target.value)}
              placeholder="Ex: Consulta - Pipoca (Daniel Skroski)"
              className={errors.summary ? "border-destructive" : ""}
            />
            {errors.summary && <p className="text-xs text-destructive">{errors.summary}</p>}
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição / Observações</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Detalhes, sintomas, recomendações ou telefone..."
              className="min-h-[70px] text-sm"
            />
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail do tutor (opcional)</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="cliente@exemplo.com"
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="date">Data <span className="text-destructive">*</span></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  id="date"
                  type="button"
                  className={cn(
                    "w-full justify-start text-left font-normal text-sm",
                    !formData.date && "text-muted-foreground",
                    errors.date && "border-destructive"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.date ? format(formData.date, "dd/MM/yyyy") : <span>Selecione uma data</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.date}
                  onSelect={(date) => date && handleChange('date', date)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="startTime">Início <span className="text-destructive">*</span></Label>
              <div className="flex items-center">
                <Clock className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => handleChange('startTime', e.target.value)}
                  className={errors.startTime ? "border-destructive" : ""}
                />
              </div>
              {errors.startTime && <p className="text-xs text-destructive">{errors.startTime}</p>}
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="endTime">Término <span className="text-destructive">*</span></Label>
              <div className="flex items-center">
                <Clock className="mr-2 h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => handleChange('endTime', e.target.value)}
                  className={errors.endTime ? "border-destructive" : ""}
                />
              </div>
              {errors.endTime && <p className="text-xs text-destructive">{errors.endTime}</p>}
            </div>
          </div>
          
          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando...' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
