import React from 'react';
import { format, isSameMonth, isSameDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarRange,
  Clock,
  List,
  Search,
  RefreshCw,
  Ban,
  Layers,
  BellRing,
} from 'lucide-react';
import { GoogleCalendar } from '@/types/calendar';

export type CalendarViewMode = 'month' | 'week' | 'day' | 'list';
export type CalendarSourceFilter = 'all' | 'google' | 'reminder';

interface CalendarControlsProps {
  currentDate: Date;
  viewMode: CalendarViewMode;
  sourceFilter: CalendarSourceFilter;
  selectedCalendarId: string;
  calendars: GoogleCalendar[];
  searchTerm: string;
  hideBlocked: boolean;
  blockedCount: number;
  totalFilteredCount: number;
  isSyncing?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onSourceFilterChange: (filter: CalendarSourceFilter) => void;
  onCalendarSelect: (calendarId: string) => void;
  onSearchChange: (search: string) => void;
  onToggleHideBlocked: (hide: boolean) => void;
  onSync?: () => void;
}

export function CalendarControls({
  currentDate,
  viewMode,
  sourceFilter,
  selectedCalendarId,
  calendars,
  searchTerm,
  hideBlocked,
  blockedCount,
  totalFilteredCount,
  isSyncing,
  onPrev,
  onNext,
  onToday,
  onViewModeChange,
  onSourceFilterChange,
  onCalendarSelect,
  onSearchChange,
  onToggleHideBlocked,
  onSync,
}: CalendarControlsProps) {
  // Formatação do título de acordo com a visualização
  const formatPeriodTitle = () => {
    switch (viewMode) {
      case 'month':
        return format(currentDate, "MMMM 'de' yyyy", { locale: pt });
      case 'week':
        return `Semana de ${format(currentDate, "dd 'de' MMM", { locale: pt })}`;
      case 'day':
        return format(currentDate, "EEEE, dd 'de' MMMM", { locale: pt });
      case 'list':
      default:
        return 'Todos os Agendamentos';
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-xs">
      {/* Linha superior: Navegação e Visualizações */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Navegação de Datas */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
            className="h-8 px-2.5 text-xs font-semibold"
          >
            Hoje
          </Button>
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={onPrev}
              title="Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={onNext}
              title="Próximo"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <span className="text-sm sm:text-base font-bold capitalize text-foreground ml-1">
            {formatPeriodTitle()}
          </span>
          <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">
            ({totalFilteredCount} {totalFilteredCount === 1 ? 'item' : 'itens'})
          </span>
        </div>

        {/* Alternador de Modo de Visualização */}
        <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border text-xs">
          <Button
            variant={viewMode === 'month' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('month')}
            className="h-7 px-2.5 text-xs gap-1.5"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Mês</span>
          </Button>
          <Button
            variant={viewMode === 'week' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('week')}
            className="h-7 px-2.5 text-xs gap-1.5"
          >
            <CalendarRange className="h-3.5 w-3.5" />
            <span>Semana</span>
          </Button>
          <Button
            variant={viewMode === 'day' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('day')}
            className="h-7 px-2.5 text-xs gap-1.5"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Dia</span>
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onViewModeChange('list')}
            className="h-7 px-2.5 text-xs gap-1.5"
          >
            <List className="h-3.5 w-3.5" />
            <span>Lista</span>
          </Button>
        </div>
      </div>

      {/* Linha inferior: Filtros, Busca e Ações */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Filtro de Origem */}
          <Select
            value={sourceFilter}
            onValueChange={(val) => onSourceFilterChange(val as CalendarSourceFilter)}
          >
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  <span>Todos os dados</span>
                </div>
              </SelectItem>
              <SelectItem value="google">
                <div className="flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-blue-500" />
                  <span>Google Agenda</span>
                </div>
              </SelectItem>
              <SelectItem value="reminder">
                <div className="flex items-center gap-1.5">
                  <BellRing className="h-3.5 w-3.5 text-amber-500" />
                  <span>Lembretes & Vacinas</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Subfiltro de agendas do Google (quando aplicável) */}
          {sourceFilter !== 'reminder' && calendars.length > 0 && (
            <Select value={selectedCalendarId} onValueChange={onCalendarSelect}>
              <SelectTrigger className="h-8 w-[190px] text-xs truncate">
                <SelectValue placeholder="Todas as agendas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Agendas Google</SelectItem>
                {calendars.map((cal) => (
                  <SelectItem key={cal.id} value={cal.id}>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: cal.backgroundColor || '#3b82f6' }}
                      />
                      <span className="truncate">{cal.summary}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Campo de Busca Rápida */}
          <div className="relative flex-1 min-w-[160px] max-w-[280px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar pet, tutor, serviço..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 pl-8 text-xs w-full"
            />
          </div>
        </div>

        {/* Lado direito: Ocultar bloqueios & Botão de Sincronizar */}
        <div className="flex items-center gap-3 ml-auto">
          {blockedCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Switch
                id="hide-blocked-toggle"
                checked={hideBlocked}
                onCheckedChange={onToggleHideBlocked}
                className="scale-75"
              />
              <Label
                htmlFor="hide-blocked-toggle"
                className="text-[11px] text-muted-foreground cursor-pointer flex items-center gap-1"
                title="Oculta bloqueios de horário na visualização"
              >
                <Ban className="h-3 w-3 text-amber-500" />
                Ocultar bloqueios ({blockedCount})
              </Label>
            </div>
          )}

          {onSync && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={isSyncing}
              className="h-8 px-2.5 text-xs gap-1.5"
              title="Sincronizar com Google Agenda"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
              <span className="hidden sm:inline">Sincronizar</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
