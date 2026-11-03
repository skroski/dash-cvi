import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, isToday, isValid } from 'date-fns';
import { 
  CalendarDays, Clock, 
  ArrowRight, RefreshCw, LoaderCircle, PawPrint, User, ExternalLink, Calendar as CalendarIcon 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';

export function DashboardAppointmentsList() {
  const { events, isLoading, isSyncing, sync, isConnected } = useGoogleCalendar();

  const todayEvents = useMemo(() => {
    return events
      .filter((e) => {
        const isBlocked = (e.summary || '').toLowerCase().includes('bloqueio') || 
                          (e.description || '').toLowerCase().includes('bloqueio de agenda');
        if (isBlocked) return false;
        const d = new Date(e.start);
        return isValid(d) && isToday(d);
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [events]);

  const getCalendarBadge = (calendarName?: string, calendarColor?: string) => {
    return (
      <span 
        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full text-white shadow-2xs shrink-0 max-w-[140px] truncate"
        style={{ backgroundColor: calendarColor || '#3b82f6' }}
      >
        <CalendarIcon className="h-2.5 w-2.5 shrink-0" />
        <span className="truncate">{calendarName || 'Agenda'}</span>
      </span>
    );
  };

  return (
    <Card className="shadow-sm mb-6" data-tour="dashboard-agendas-hoje">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold">Agendamentos de Hoje</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sincronizados com o Google Agenda (Base Central)
            </p>
          </div>
          {todayEvents.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
              {todayEvents.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isConnected && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => sync()}
              disabled={isSyncing || isLoading}
              title="Atualizar agendamentos"
            >
              {isSyncing ? (
                <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          )}

          <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs">
            <Link to="/schedule">
              Ver agenda completa
              <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading && todayEvents.length === 0 ? (
          <div className="space-y-2.5 py-2">
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        ) : todayEvents.length > 0 ? (
          <div className="divide-y divide-border/60">
            {todayEvents.slice(0, 5).map((event) => {
              const startDate = isValid(new Date(event.start)) ? new Date(event.start) : new Date();
              const endDate = isValid(new Date(event.end)) ? new Date(event.end) : new Date();

              return (
                <div 
                  key={event.id} 
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/30 px-2 rounded-md transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted/60 px-2 py-1 rounded-md shrink-0">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      <span>{format(startDate, 'HH:mm')}</span>
                      <span className="font-normal text-[10px] text-muted-foreground">
                        - {format(endDate, 'HH:mm')}
                      </span>
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        {getCalendarBadge(event.calendarName, event.calendarColor)}
                        <span className="font-medium text-sm text-foreground truncate max-w-[280px] sm:max-w-md">
                          {event.summary}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {event.petName && (
                          <span className="inline-flex items-center gap-1">
                            <PawPrint className="h-3 w-3 text-amber-500" />
                            {event.petName}
                          </span>
                        )}
                        {event.ownerName && (
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {event.ownerName}
                          </span>
                        )}
                        {!event.petName && !event.ownerName && event.description && (
                          <span className="truncate max-w-[200px] text-[11px]">
                            {event.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {event.htmlLink && (
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Abrir no Google Agenda"
                      >
                        <a href={event.htmlLink} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {todayEvents.length > 5 && (
              <div className="pt-2 text-center">
                <Button asChild variant="link" size="sm" className="text-xs text-muted-foreground">
                  <Link to="/schedule">
                    + mais {todayEvents.length - 5} agendamento(s) hoje. Abrir agenda completa →
                  </Link>
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
            <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium text-foreground">Nenhum agendamento para hoje</p>
            <p className="text-xs max-w-sm text-muted-foreground">
              {isConnected 
                ? "Os agendamentos das suas agendas sincronizadas aparecerão aqui automaticamente." 
                : "Conecte sua conta do Google Calendar na página de Agenda para acompanhar os atendimentos."}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-1 h-8 text-xs gap-1.5">
              <Link to="/schedule">
                <CalendarDays className="h-3.5 w-3.5" />
                Acessar Módulo de Agenda
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
