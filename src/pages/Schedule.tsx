import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  isSameDay,
  isToday,
  isValid,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
} from 'date-fns';
import {
  CalendarDays,
  CalendarCheck,
  Layers,
  Sparkles,
  Megaphone,
  ChevronDown,
  ChevronUp,
  BellRing,
} from 'lucide-react';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useReminders } from '@/hooks/useReminders';
import { CalendarEvent, UnifiedCalendarItem } from '@/types/calendar';
import { GoogleConnectCard } from '@/components/schedule/GoogleConnectCard';
import { GoogleCalendarSelector } from '@/components/schedule/GoogleCalendarSelector';
import { ManageGoogleCalendarsDialog } from '@/components/schedule/ManageGoogleCalendarsDialog';
import { CalendarSidebar } from '@/components/schedule/CalendarSidebar';
import { EventsCard } from '@/components/schedule/EventsCard';
import { UnifiedCalendarEventDialog } from '@/components/schedule/UnifiedCalendarEventDialog';
import {
  CalendarControls,
  CalendarViewMode,
  CalendarSourceFilter,
} from '@/components/schedule/CalendarControls';
import { CalendarMonthGrid } from '@/components/schedule/CalendarMonthGrid';
import { CalendarWeekGrid } from '@/components/schedule/CalendarWeekGrid';
import { CalendarDayGrid } from '@/components/schedule/CalendarDayGrid';
import PageContainer from '@/components/layout/PageContainer';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const isBlockedEvent = (e: CalendarEvent): boolean => {
  const summary = (e.summary || '').toLowerCase();
  const desc = (e.description || '').toLowerCase();
  return summary.includes('bloqueio') || desc.includes('bloqueio de agenda');
};

const Schedule = () => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<'day' | 'all'>('day');

  // Modo de visualização do calendário (Mês por padrão, persistido no localStorage)
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() => {
    const saved = localStorage.getItem('dash_calendar_view_mode') as CalendarViewMode;
    return saved && ['month', 'week', 'day', 'list'].includes(saved) ? saved : 'month';
  });

  const handleViewModeChange = (mode: CalendarViewMode) => {
    setViewMode(mode);
    localStorage.setItem('dash_calendar_view_mode', mode);
  };

  // Filtro de Origem: Todos, Google Agenda ou Lembretes & Vacinas
  const [sourceFilter, setSourceFilter] = useState<CalendarSourceFilter>('all');

  // Estado do Calendário Retrátil Lateral (útil no modo lista)
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(() => {
    return localStorage.getItem('dash_calendar_sidebar_open') !== 'false';
  });

  const handleToggleCalendar = () => {
    setIsCalendarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('dash_calendar_sidebar_open', String(next));
      return next;
    });
  };

  // Flag para ocultar ou exibir eventos de Bloqueio (persistido no localStorage)
  const [hideBlocked, setHideBlocked] = useState<boolean>(() => {
    return localStorage.getItem('dash_hide_calendar_blocks') !== 'false';
  });

  const handleToggleHideBlocked = (checked: boolean) => {
    setHideBlocked(checked);
    localStorage.setItem('dash_hide_calendar_blocks', String(checked));
  };

  // Estado para recolher/expandir o resumo e badges do topo
  const [showTopSummary, setShowTopSummary] = useState<boolean>(() => {
    return localStorage.getItem('dash_schedule_summary_open') !== 'false';
  });

  const handleToggleTopSummary = () => {
    setShowTopSummary((prev) => {
      const next = !prev;
      localStorage.setItem('dash_schedule_summary_open', String(next));
      return next;
    });
  };

  // Estado para recolher/expandir apenas os badges das agendas do Google
  const [isCalendarBadgesOpen, setIsCalendarBadgesOpen] = useState<boolean>(() => {
    return localStorage.getItem('dash_schedule_calendar_badges_open') !== 'false';
  });

  const handleToggleCalendarBadges = () => {
    setIsCalendarBadgesOpen((prev) => {
      const next = !prev;
      localStorage.setItem('dash_schedule_calendar_badges_open', String(next));
      return next;
    });
  };

  // Integração com a API do Google Calendar
  const {
    isConnected,
    hasGoogleAuth,
    isCentralSync,
    allGoogleCalendars,
    syncedCalendars,
    unsyncedCalendars,
    selectedCalendarId,
    setSelectedCalendarId,
    selectedCalendar,
    events,
    isLoading: isGoogleLoading,
    isSyncing,
    lastSync,
    syncedByEmail,
    error: googleError,
    connect,
    disconnect,
    sync,
    enableCalendar,
    disableCalendar,
  } = useGoogleCalendar();

  // Integração com os Lembretes & Vacinas do sistema
  const { appointments = [], loadingAppointments } = useReminders({
    appointmentPeriod: 'todos',
    messagePeriod: 'hoje',
  });

  // Modal de Detalhes Unificado
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedUnifiedEvent, setSelectedUnifiedEvent] = useState<UnifiedCalendarItem | null>(null);
  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);

  // Unificação e Normalização dos Dados
  const unifiedItems = useMemo<UnifiedCalendarItem[]>(() => {
    const list: UnifiedCalendarItem[] = [];

    // 1. Origem: Google Calendar
    if (sourceFilter === 'all' || sourceFilter === 'google') {
      events.forEach((e) => {
        const isBlocked = isBlockedEvent(e);
        if (hideBlocked && isBlocked) return;
        if (
          selectedCalendarId !== 'all' &&
          (e.calendarId || '').trim() !== selectedCalendarId.trim()
        ) {
          return;
        }

        const rawStart = new Date(e.start);
        const rawEnd = new Date(e.end);
        if (!isValid(rawStart)) return;

        list.push({
          id: `google-${e.id}`,
          title: e.summary || 'Agendamento sem título',
          start: rawStart,
          end: isValid(rawEnd) ? rawEnd : rawStart,
          source: 'google',
          sourceName: e.calendarName || 'Google Agenda',
          color: e.calendarColor || '#3b82f6',
          petName: e.petName,
          ownerName: e.ownerName,
          phone: e.phone,
          status: e.status,
          service: e.service,
          description: e.description,
          location: e.location,
          isBlocked,
          htmlLink: e.htmlLink,
          rawGoogleEvent: e,
        });
      });
    }

    // 2. Origem: Lembretes / Vacinas
    if (sourceFilter === 'all' || sourceFilter === 'reminder') {
      (appointments || []).forEach((a) => {
        if (!a.appointmentDate) return;
        const timeStr = a.appointmentTime ? a.appointmentTime.slice(0, 5) : '09:00';
        const [year, month, day] = a.appointmentDate.split('-').map(Number);
        const [hour, minute] = timeStr.split(':').map(Number);
        const start = new Date(year, (month || 1) - 1, day || 1, hour || 9, minute || 0);
        if (!isValid(start)) return;
        const end = new Date(start.getTime() + 30 * 60 * 1000);

        list.push({
          id: `reminder-${a.id}`,
          title: a.service || a.configurationName || 'Lembrete de Atendimento',
          start,
          end,
          source: 'reminder',
          sourceName: 'Lembrete WhatsApp',
          color: '#f59e0b',
          petName: a.petName || undefined,
          ownerName: a.ownerName || undefined,
          phone: a.phone || undefined,
          status: a.status,
          service: a.service || undefined,
          description: a.description || undefined,
          rawReminder: a,
        });
      });
    }

    // 3. Filtro de Busca Textual
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return list.filter((item) => {
        const titleMatch = item.title?.toLowerCase().includes(q);
        const descMatch = item.description?.toLowerCase().includes(q);
        const petMatch = item.petName?.toLowerCase().includes(q);
        const ownerMatch = item.ownerName?.toLowerCase().includes(q);
        const phoneMatch = item.phone?.includes(q);
        const serviceMatch = item.service?.toLowerCase().includes(q);
        return (
          titleMatch ||
          descMatch ||
          petMatch ||
          ownerMatch ||
          phoneMatch ||
          serviceMatch
        );
      });
    }

    return list;
  }, [
    events,
    appointments,
    sourceFilter,
    selectedCalendarId,
    hideBlocked,
    searchTerm,
  ]);

  // Contagem de agendamentos por agenda do Google
  const countsByCalendar = useMemo(() => {
    const map: Record<string, number> = {};
    events.forEach((e) => {
      if (hideBlocked && isBlockedEvent(e)) return;
      if (selectedTab === 'day' && selectedDate) {
        const rawDate = new Date(e.start);
        if (!isValid(rawDate) || !isSameDay(rawDate, selectedDate)) return;
      }
      const cId = (e.calendarId || '').trim();
      map[cId] = (map[cId] || 0) + 1;
    });
    return map;
  }, [events, hideBlocked, selectedTab, selectedDate]);

  // Total de bloqueios detectados
  const blockedCount = useMemo(() => {
    return events.filter(isBlockedEvent).length;
  }, [events]);

  // Total para hoje (Google + Lembretes)
  const todayCount = useMemo(() => {
    return unifiedItems.filter((i) => isToday(i.start)).length;
  }, [unifiedItems]);

  // Total de lembretes ativos
  const remindersTotal = useMemo(() => {
    return (appointments || []).length;
  }, [appointments]);

  // Navegação no tempo (Mês, Semana, Dia)
  const handlePrev = () => {
    switch (viewMode) {
      case 'month':
        setCurrentDate((prev) => subMonths(prev, 1));
        break;
      case 'week':
        setCurrentDate((prev) => subWeeks(prev, 1));
        break;
      case 'day':
      case 'list':
        setCurrentDate((prev) => subDays(prev, 1));
        setSelectedDate((prev) => (prev ? subDays(prev, 1) : subDays(new Date(), 1)));
        break;
    }
  };

  const handleNext = () => {
    switch (viewMode) {
      case 'month':
        setCurrentDate((prev) => addMonths(prev, 1));
        break;
      case 'week':
        setCurrentDate((prev) => addWeeks(prev, 1));
        break;
      case 'day':
      case 'list':
        setCurrentDate((prev) => addDays(prev, 1));
        setSelectedDate((prev) => (prev ? addDays(prev, 1) : addDays(new Date(), 1)));
        break;
    }
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  const handleOpenDetails = (item: UnifiedCalendarItem) => {
    setSelectedUnifiedEvent(item);
    setIsDetailsOpen(true);
  };

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    setCurrentDate(date);
  };

  const handleDoubleClickDate = (date: Date) => {
    setSelectedDate(date);
    setCurrentDate(date);
    handleViewModeChange('day');
  };

  return (
    <PageContainer>
      {/* Cabeçalho Principal */}
      <div className="mb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <CalendarDays className="h-6 w-6 text-primary" />
            Calendário & Agenda
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Visualização completa e unificada das agendas do Google e dos lembretes de vacinas/consultas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Atalho para tela dedicada de Chamar em Fila */}
          <Link to="/chamar">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-3 text-xs font-semibold border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 shadow-2xs"
              title="Ir para o Chamador de Fila (/chamar)"
            >
              <Megaphone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Chamar em Fila</span>
            </Button>
          </Link>

          {/* Alternador de resumo do topo */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-3 text-xs text-muted-foreground hover:text-foreground shadow-2xs"
            onClick={handleToggleTopSummary}
            title={
              showTopSummary
                ? 'Recolher indicadores do topo'
                : 'Expandir indicadores do topo'
            }
          >
            {showTopSummary ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Recolher Indicadores</span>
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5 text-primary" />
                <span className="hidden sm:inline">Expandir Indicadores</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Indicadores Principais (Recolhíveis) */}
      {showTopSummary && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5 transition-all duration-300">
          <Card className="shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Agendamentos Hoje
                </p>
                <h3 className="text-2xl font-bold text-foreground mt-0.5">
                  {todayCount}
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <CalendarCheck className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Google Calendar
                </p>
                <h3 className="text-2xl font-bold text-foreground mt-0.5">
                  {events.length}
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <CalendarDays className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Lembretes / Vacinas
                </p>
                <h3 className="text-2xl font-bold text-foreground mt-0.5">
                  {remindersTotal}
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <BellRing className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Agendas Google
                </p>
                <h3 className="text-2xl font-bold text-foreground mt-0.5">
                  {syncedCalendars.length} / {allGoogleCalendars.length}
                </h3>
              </div>
              <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                <Sparkles className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Badges/Chips das Agendas reais do Google */}
      {syncedCalendars.length > 0 && sourceFilter !== 'reminder' && (
        <div className="mb-4" data-tour="schedule-calendars">
          <GoogleCalendarSelector
            calendars={syncedCalendars}
            selectedCalendarId={selectedCalendarId}
            onSelectCalendar={(id) => {
              if (selectedCalendarId === id) {
                setSelectedCalendarId('all');
              } else {
                setSelectedCalendarId(id);
              }
            }}
            countsByCalendar={countsByCalendar}
            isOpen={showTopSummary ? isCalendarBadgesOpen : false}
            onToggleOpen={() => {
              if (!showTopSummary) {
                setShowTopSummary(true);
                setIsCalendarBadgesOpen(true);
              } else {
                handleToggleCalendarBadges();
              }
            }}
          />
        </div>
      )}

      {/* Controles de Navegação e Filtros */}
      <div className="mb-4">
        <CalendarControls
          currentDate={currentDate}
          viewMode={viewMode}
          sourceFilter={sourceFilter}
          selectedCalendarId={selectedCalendarId}
          calendars={syncedCalendars}
          searchTerm={searchTerm}
          hideBlocked={hideBlocked}
          blockedCount={blockedCount}
          totalFilteredCount={unifiedItems.length}
          isSyncing={isSyncing}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
          onViewModeChange={handleViewModeChange}
          onSourceFilterChange={setSourceFilter}
          onCalendarSelect={setSelectedCalendarId}
          onSearchChange={setSearchTerm}
          onToggleHideBlocked={handleToggleHideBlocked}
          onSync={sync}
        />
      </div>

      {/* Renderização das Visualizações do Calendário */}
      <div className="transition-all duration-300">
        {viewMode === 'month' && (
          <CalendarMonthGrid
            currentDate={currentDate}
            selectedDate={selectedDate}
            events={unifiedItems}
            onSelectDate={handleSelectDate}
            onSelectEvent={handleOpenDetails}
            onDoubleClickDate={handleDoubleClickDate}
          />
        )}

        {viewMode === 'week' && (
          <CalendarWeekGrid
            currentDate={currentDate}
            selectedDate={selectedDate}
            events={unifiedItems}
            onSelectDate={handleSelectDate}
            onSelectEvent={handleOpenDetails}
          />
        )}

        {viewMode === 'day' && (
          <CalendarDayGrid
            currentDate={currentDate}
            events={unifiedItems}
            onSelectEvent={handleOpenDetails}
          />
        )}

        {viewMode === 'list' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {isCalendarOpen && (
              <div className="lg:col-span-4 xl:col-span-3">
                <CalendarSidebar
                  selectedDate={selectedDate}
                  onDateChange={(date) => {
                    setSelectedDate(date);
                    if (date) {
                      setCurrentDate(date);
                      setSelectedTab('day');
                    }
                  }}
                  onToggleCollapse={handleToggleCalendar}
                />
              </div>
            )}

            <div
              className={cn(
                'transition-all duration-300',
                isCalendarOpen ? 'lg:col-span-8 xl:col-span-9' : 'lg:col-span-12'
              )}
            >
              <EventsCard
                events={events}
                filteredEvents={events.filter((e) => {
                  if (hideBlocked && isBlockedEvent(e)) return false;
                  if (
                    selectedCalendarId !== 'all' &&
                    (e.calendarId || '').trim() !== selectedCalendarId.trim()
                  )
                    return false;
                  if (selectedTab === 'day' && selectedDate) {
                    const rawDate = new Date(e.start);
                    if (isValid(rawDate) && !isSameDay(rawDate, selectedDate))
                      return false;
                  }
                  if (searchTerm.trim()) {
                    const q = searchTerm.toLowerCase();
                    return (
                      e.summary?.toLowerCase().includes(q) ||
                      e.description?.toLowerCase().includes(q) ||
                      e.petName?.toLowerCase().includes(q) ||
                      e.ownerName?.toLowerCase().includes(q) ||
                      e.phone?.includes(q)
                    );
                  }
                  return true;
                })}
                selectedTab={selectedTab}
                searchTerm={searchTerm}
                selectedDate={selectedDate}
                isLoading={isGoogleLoading && events.length === 0}
                error={googleError}
                lastUpdated={lastSync}
                selectedCalendar={selectedCalendar}
                calendars={syncedCalendars}
                selectedCalendarId={selectedCalendarId}
                onSelectCalendar={setSelectedCalendarId}
                countsByCalendar={countsByCalendar}
                hideBlocked={hideBlocked}
                blockedCount={blockedCount}
                onToggleHideBlocked={handleToggleHideBlocked}
                isCalendarOpen={isCalendarOpen}
                onToggleCalendar={handleToggleCalendar}
                onSearchChange={setSearchTerm}
                onTabChange={(tab) => setSelectedTab(tab as 'day' | 'all')}
                onViewDetails={(e) => {
                  setSelectedUnifiedEvent({
                    id: `google-${e.id}`,
                    title: e.summary,
                    start: new Date(e.start),
                    end: new Date(e.end),
                    source: 'google',
                    sourceName: e.calendarName || 'Google Agenda',
                    color: e.calendarColor,
                    petName: e.petName,
                    ownerName: e.ownerName,
                    phone: e.phone,
                    status: e.status,
                    description: e.description,
                    location: e.location,
                    htmlLink: e.htmlLink,
                    rawGoogleEvent: e,
                  });
                  setIsDetailsOpen(true);
                }}
                onOpenEventLink={(url) => {
                  if (url) window.open(url, '_blank', 'noopener,noreferrer');
                }}
                onSync={sync}
                isSyncing={isSyncing}
                hasGoogleAuth={hasGoogleAuth}
              />
            </div>
          </div>
        )}
      </div>

      {/* Rodapé: Conexão e Gerenciamento da API do Google Agenda */}
      <div className="mt-8 border-t pt-6" data-tour="schedule-connect">
        <GoogleConnectCard
          isConnected={isConnected}
          hasGoogleAuth={hasGoogleAuth}
          isCentralSync={isCentralSync}
          lastSync={lastSync}
          syncedByEmail={syncedByEmail}
          isLoading={isGoogleLoading}
          isSyncing={isSyncing}
          syncedCount={syncedCalendars.length}
          unsyncedCount={unsyncedCalendars.length}
          onConnect={connect}
          onDisconnect={disconnect}
          onSync={sync}
          onOpenManageDialog={() => setIsManageDialogOpen(true)}
        />
      </div>

      {/* Modal Unificado de Detalhes do Agendamento */}
      <UnifiedCalendarEventDialog
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        event={selectedUnifiedEvent}
      />

      {/* Modal de Gerenciamento das Agendas do Google */}
      <ManageGoogleCalendarsDialog
        open={isManageDialogOpen}
        onOpenChange={setIsManageDialogOpen}
        allCalendars={allGoogleCalendars}
        syncedCalendars={syncedCalendars}
        unsyncedCalendars={unsyncedCalendars}
        onEnableCalendar={enableCalendar}
        onDisableCalendar={disableCalendar}
        onSyncAll={sync}
        isSyncing={isSyncing}
      />
    </PageContainer>
  );
};

export default Schedule;
