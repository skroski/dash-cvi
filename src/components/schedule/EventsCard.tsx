import React, { useState } from 'react';
import { format } from 'date-fns';
import { CalendarEvent, GoogleCalendar } from '@/types/calendar';
import { 
  Card, CardHeader, CardTitle, CardDescription, 
  CardContent, CardFooter 
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
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
  AlertCircle, Search, CalendarDays, RefreshCw, 
  LayoutGrid, List, Printer, Ban, PanelLeftClose, PanelLeftOpen, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { EventsTable } from './EventsTable';
import { EventsTimeline } from './EventsTimeline';

interface EventsCardProps {
  events: CalendarEvent[];
  filteredEvents: CalendarEvent[];
  selectedTab: string;
  searchTerm: string;
  selectedDate: Date | undefined;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  selectedCalendar?: GoogleCalendar | null;
  calendars?: GoogleCalendar[];
  selectedCalendarId?: string;
  onSelectCalendar?: (id: string) => void;
  countsByCalendar?: Record<string, number>;
  hideBlocked?: boolean;
  blockedCount?: number;
  onToggleHideBlocked?: (checked: boolean) => void;
  isCalendarOpen?: boolean;
  onToggleCalendar?: () => void;
  onSearchChange: (term: string) => void;
  onTabChange: (tab: string) => void;
  onViewDetails: (event: CalendarEvent) => void;
  onOpenEventLink: (url: string) => void;
  onSync?: () => void;
  isSyncing?: boolean;
  hasGoogleAuth?: boolean;
}

export function EventsCard({
  events,
  filteredEvents,
  selectedTab,
  searchTerm,
  selectedDate,
  isLoading,
  error,
  lastUpdated,
  selectedCalendar,
  calendars = [],
  selectedCalendarId = 'all',
  onSelectCalendar,
  countsByCalendar = {},
  hideBlocked = true,
  blockedCount = 0,
  onToggleHideBlocked,
  isCalendarOpen = true,
  onToggleCalendar,
  onSearchChange,
  onTabChange,
  onViewDetails,
  onOpenEventLink,
  onSync,
  isSyncing = false,
  hasGoogleAuth = false
}: EventsCardProps) {
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');

  const handlePrint = () => {
    window.print();
  };

  const calendarTitle = selectedCalendar ? selectedCalendar.summary : 'Todas as Agendas Sincronizadas';
  const calendarColor = selectedCalendar?.backgroundColor || '#3b82f6';
  const totalCount = Object.values(countsByCalendar).reduce((acc, c) => acc + c, 0);

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div 
              className="p-2.5 rounded-xl border text-white shadow-2xs transition-colors"
              style={{ backgroundColor: selectedCalendar ? calendarColor : 'hsl(var(--primary))' }}
            >
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold flex flex-wrap items-center gap-2">
                <span>{calendarTitle}</span>
                {selectedCalendar?.primary && (
                  <span className="text-[10px] uppercase font-normal tracking-wide px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                    Principal
                  </span>
                )}
                {selectedCalendarId !== 'all' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-[11px] gap-1 font-normal text-muted-foreground hover:text-foreground"
                    onClick={() => onSelectCalendar?.('all')}
                    title="Remover filtro desta agenda e mostrar todas"
                  >
                    <X className="h-3 w-3" />
                    <span>Todas as Agendas</span>
                  </Button>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {selectedTab === 'day' 
                  ? `Exibindo ${filteredEvents.length} agendamento(s) para ${selectedDate ? format(selectedDate, "dd/MM/yyyy") : 'hoje'}`
                  : `Exibindo todos os ${filteredEvents.length} agendamento(s) carregados da API`
                }
              </CardDescription>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Botão de Alternar Calendário Retrátil */}
            {onToggleCalendar && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={onToggleCalendar}
                title={isCalendarOpen ? "Recolher calendário lateral" : "Expandir calendário lateral"}
              >
                {isCalendarOpen ? (
                  <PanelLeftClose className="h-3.5 w-3.5" />
                ) : (
                  <PanelLeftOpen className="h-3.5 w-3.5 text-primary" />
                )}
                <span className="hidden sm:inline">
                  {isCalendarOpen ? 'Recolher Calendário' : 'Ver Calendário'}
                </span>
              </Button>
            )}

            {/* Alternador de Modo de Visualização */}
            <div className="flex items-center rounded-lg border bg-muted/30 p-1">
              <Button
                variant={viewMode === 'timeline' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs gap-1.5"
                onClick={() => setViewMode('timeline')}
                title="Visualização em Linha do Tempo / Cards"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </Button>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs gap-1.5"
                onClick={() => setViewMode('table')}
                title="Visualização em Tabela"
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Tabela</span>
              </Button>
            </div>

            {/* Botão de Impressão */}
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={handlePrint}
              title="Imprimir lista de agendamentos"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Imprimir</span>
            </Button>

            {/* Botão de Sincronização com o Google */}
            {onSync && (
              <Button
                variant="default"
                size="sm"
                className="h-8 px-3 text-xs gap-1.5 font-semibold shadow-xs"
                onClick={onSync}
                disabled={isLoading || isSyncing}
                title={hasGoogleAuth ? "Buscar eventos atualizados do Google Calendar" : "Conectar com Google e sincronizar todos os eventos"}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
                <span>{isSyncing ? "Sincronizando..." : "Sincronizar Google"}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-3 mt-1 border-t">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
            {/* Campo de Busca */}
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                type="search" 
                placeholder="Buscar paciente, tutor ou serviço..." 
                className="pl-9 h-9 text-xs" 
                value={searchTerm} 
                onChange={e => onSearchChange(e.target.value)}
              />
            </div>

            {/* Segunda Forma de Filtrar: Dropdown Select de Agendas */}
            {onSelectCalendar && calendars.length > 0 && (
              <div className="w-full sm:w-[220px]">
                <Select value={selectedCalendarId} onValueChange={onSelectCalendar}>
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Filtrar por agenda..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">
                      <div className="flex items-center justify-between w-full gap-2">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-3.5 w-3.5 text-primary" />
                          <span>Todas as Agendas</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({totalCount})
                        </span>
                      </div>
                    </SelectItem>
                    {calendars.map((cal) => {
                      const count = countsByCalendar[cal.id] ?? 0;
                      return (
                        <SelectItem key={cal.id} value={cal.id} className="text-xs">
                          <div className="flex items-center justify-between w-full gap-2">
                            <div className="flex items-center gap-2 truncate max-w-[150px]">
                              <span 
                                className="h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs" 
                                style={{ backgroundColor: cal.backgroundColor || '#3b82f6' }}
                              />
                              <span className="truncate">{cal.summary}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ({count})
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-end lg:self-center">
            {/* Opção flag para remover/ocultar bloqueios */}
            {onToggleHideBlocked && (
              <div className="flex items-center gap-2 bg-muted/40 border border-border/80 px-2.5 py-1.5 rounded-lg">
                <Ban className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Label htmlFor="hide-blocked-switch" className="text-xs font-medium cursor-pointer select-none text-muted-foreground hover:text-foreground flex items-center gap-1.5">
                  <span>Ocultar bloqueios</span>
                  {blockedCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-muted text-muted-foreground border">
                      {blockedCount}
                    </span>
                  )}
                </Label>
                <Switch
                  id="hide-blocked-switch"
                  checked={hideBlocked}
                  onCheckedChange={onToggleHideBlocked}
                  className="scale-75 origin-right ml-1"
                />
              </div>
            )}

            {/* Alternador de Período (Data Selecionada vs Todas as Datas) */}
            <Tabs value={selectedTab} className="w-auto" onValueChange={onTabChange}>
              <TabsList className="h-9">
                <TabsTrigger value="day" className="text-xs px-3">Data Selecionada</TabsTrigger>
                <TabsTrigger value="all" className="text-xs px-3">Todas as Datas</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && events.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="font-medium">Falha na comunicação com a API do Google Calendar.</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-300/70 mt-0.5">
                  {error}
                </p>
              </div>
            </div>
            {onSync && (
              <Button variant="default" size="sm" className="h-8 gap-1.5 text-xs self-end sm:self-center" onClick={onSync}>
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar Novamente
              </Button>
            )}
          </div>
        )}

        {isLoading && events.length === 0 ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : viewMode === 'timeline' ? (
          <EventsTimeline 
            events={filteredEvents}
            isLoading={isLoading}
            onViewDetails={onViewDetails}
            onOpenEventLink={onOpenEventLink}
            selectedCalendarName={selectedCalendar?.summary}
            onSwitchToAll={selectedTab === 'day' ? () => onTabChange('all') : undefined}
            onClearCalendarFilter={selectedCalendarId !== 'all' ? () => onSelectCalendar?.('all') : undefined}
          />
        ) : (
          <EventsTable 
            events={filteredEvents}
            isLoading={isLoading}
            onViewDetails={onViewDetails}
            onOpenEventLink={onOpenEventLink}
            selectedCalendarName={selectedCalendar?.summary}
            onSwitchToAll={selectedTab === 'day' ? () => onTabChange('all') : undefined}
            onClearCalendarFilter={selectedCalendarId !== 'all' ? () => onSelectCalendar?.('all') : undefined}
          />
        )}
      </CardContent>

      <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
        <div>
          {lastUpdated ? (
            <span>Última sincronização com Google: {format(lastUpdated, "dd/MM/yyyy 'às' HH:mm")}</span>
          ) : (
            <span>Aguardando sincronização com Google Calendar...</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className={cn(
            "inline-block h-2 w-2 rounded-full",
            hasGoogleAuth ? "bg-emerald-500 animate-pulse" : "bg-emerald-500"
          )}></span>
          <span>{hasGoogleAuth ? "Google Calendar API v3 (Conectado)" : "Google Calendar API v3"}</span>
        </div>
      </CardFooter>
    </Card>
  );
}
