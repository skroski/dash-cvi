import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Ban,
  Calendar,
  CalendarClock,
  CalendarPlus,
  CalendarSync,
  CheckCheck,
  Copy,
  History,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Search,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import EmptyState from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
import { ReminderDelivery, ReminderDeliveryStatus, ReminderService } from '@/types/reminder';
import {
  APPOINTMENT_STATUS_LABEL,
  DayBadge,
  STATUS_META,
  ServiceBadge,
  StatusBadge,
  formatDateBR,
  formatPhone,
} from './reminderUi';
import StuckRemindersAlert from './StuckRemindersAlert';
import {
  AppointmentPeriod,
  proximaSegundaFeiraInSaoPaulo,
  todayInSaoPaulo,
} from '@/hooks/useReminders';

const PERIODS: { value: AppointmentPeriod; label: string }[] = [
  { value: 'todos', label: 'Todos os lembretes' },
  { value: 'hoje', label: 'Hoje (Do dia)' },
  { value: 'amanha', label: 'Amanhã' },
  { value: 'segunda', label: 'Segunda-feira' },
  { value: 'personalizado', label: 'Data escolhida' },
  { value: 'proximos7', label: 'Próximos 7 dias' },
  { value: 'futuros', label: 'Todos os próximos' },
  { value: 'passados', label: 'Já passaram' },
];

const NO_CATEGORY = 'sem-categoria';

function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

interface AppointmentsTabProps {
  appointments: ReminderDelivery[];
  services: ReminderService[];
  loading: boolean;
  period: AppointmentPeriod;
  onPeriodChange: (period: AppointmentPeriod) => void;
  customDate?: string;
  onCustomDateChange?: (date: string) => void;
  onOpenDispatchModal?: () => void;
  onSyncAllGoogle?: () => void;
  syncGoogleLoading?: boolean;
  onCreate: () => void;
  onEdit: (appointment: ReminderDelivery) => void;
  onDuplicate: (appointment: ReminderDelivery) => void;
  onSendNow: (appointment: ReminderDelivery) => void;
  onCancel: (appointment: ReminderDelivery) => void;
  onReactivate: (appointment: ReminderDelivery) => void;
  onChangeAttendanceStatus?: (
    appointment: ReminderDelivery,
    status: 'AGENDADO' | 'CONFIRMADO' | 'CANCELADO' | 'REMARCAR'
  ) => void;
  onDelete: (appointment: ReminderDelivery) => void;
  onOpenMessage: (messageId: number) => void;
  onSyncGoogle?: (appointment: ReminderDelivery) => void;
  onMarkAsSent?: (appointment: ReminderDelivery) => void;
  onUnlockQueue?: (action: 'pendente' | 'enviado' | 'falha') => void;
  unlockQueueLoading?: boolean;
  onUnlockAppointment?: (appointment: ReminderDelivery, action: 'pendente' | 'enviado' | 'falha') => void;
  sendingId: number | null;
}

const AppointmentsTab = ({
  appointments,
  services,
  loading,
  period,
  onPeriodChange,
  customDate,
  onCustomDateChange,
  onOpenDispatchModal,
  onSyncAllGoogle,
  syncGoogleLoading,
  onCreate,
  onEdit,
  onDuplicate,
  onSendNow,
  onCancel,
  onReactivate,
  onChangeAttendanceStatus,
  onDelete,
  onOpenMessage,
  onSyncGoogle,
  onMarkAsSent,
  onUnlockQueue,
  unlockQueueLoading,
  onUnlockAppointment,
  sendingId,
}: AppointmentsTabProps) => {
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | ReminderDeliveryStatus>('todos');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [accordionValue, setAccordionValue] = useState<string | undefined>(
    period === 'passados' ? 'passados' : undefined
  );

  const stuckAppointments = useMemo(
    () => appointments.filter((a) => a.status === 'processando'),
    [appointments]
  );
  const serviceById = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);
  const today = todayInSaoPaulo();
  const tomorrow = todayInSaoPaulo(1);
  const monday = proximaSegundaFeiraInSaoPaulo();

  useEffect(() => {
    if (period === 'passados') {
      setAccordionValue('passados');
    }
  }, [period]);

  const counts = useMemo(() => {
    let hoje = 0;
    let amanha = 0;
    let segunda = 0;
    for (const app of appointments) {
      if (app.appointmentDate === today) hoje++;
      else if (app.appointmentDate === tomorrow) amanha++;
      else if (app.appointmentDate === monday) segunda++;
    }
    return { hoje, amanha, segunda, total: appointments.length };
  }, [appointments, today, tomorrow, monday]);

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    const list = appointments.filter((appointment) => {
      if (statusFilter !== 'todos' && appointment.status !== statusFilter) return false;
      if (serviceFilter === NO_CATEGORY && appointment.serviceId) return false;
      if (serviceFilter !== 'todos' && serviceFilter !== NO_CATEGORY && appointment.serviceId !== Number(serviceFilter)) {
        return false;
      }
      if (!term) return true;
      return [appointment.ownerName, appointment.petName ?? '', appointment.phone]
        .some((value) => normalize(value).includes(term));
    });

    return [...list].sort((a, b) => {
      const cmp = a.appointmentDate.localeCompare(b.appointmentDate);
      if (cmp !== 0) return sortOrder === 'asc' ? cmp : -cmp;
      return (a.appointmentTime || '').localeCompare(b.appointmentTime || '');
    });
  }, [appointments, search, serviceFilter, statusFilter, sortOrder]);

  const { activeAppointments, pastAppointments } = useMemo(() => {
    const active: ReminderDelivery[] = [];
    const past: ReminderDelivery[] = [];
    for (const item of filtered) {
      if (item.appointmentDate < today) {
        past.push(item);
      } else {
        active.push(item);
      }
    }
    return { activeAppointments: active, pastAppointments: past };
  }, [filtered, today]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-3 pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Agenda de lembretes</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Cada linha é um atendimento cadastrado. Tutores com mais de um atendimento no mesmo dia recebem
              uma única mensagem citando todos.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onSyncAllGoogle && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSyncAllGoogle}
                disabled={syncGoogleLoading}
                className="min-h-9 gap-1.5 text-xs border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                title="Puxar eventos da Google Agenda diretamente pelo botão"
              >
                <CalendarSync className={cn('h-3.5 w-3.5', syncGoogleLoading && 'animate-spin')} />
                {syncGoogleLoading ? 'Sincronizando Google...' : 'Sincronizar Google'}
              </Button>
            )}

            {onOpenDispatchModal && (
              <Button
                type="button"
                size="sm"
                onClick={onOpenDispatchModal}
                className="min-h-9 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                title="Disparar lembretes de amanhã, segunda-feira ou data personalizada"
              >
                <Send className="h-3.5 w-3.5" />
                Disparar Lembretes
              </Button>
            )}
          </div>
        </div>

        {onUnlockQueue && (
          <StuckRemindersAlert
            count={stuckAppointments.length}
            onUnlock={onUnlockQueue}
            loading={unlockQueueLoading}
          />
        )}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_180px_200px_170px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar tutor, pet ou telefone"
              className="min-h-11 pl-9"
              aria-label="Buscar na agenda"
            />
          </div>
          <Select value={period} onValueChange={(value) => onPeriodChange(value as AppointmentPeriod)}>
            <SelectTrigger className="min-h-11" aria-label="Período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="min-h-11" aria-label="Serviço">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os serviços</SelectItem>
              {services.map((service) => (
                <SelectItem key={service.id} value={String(service.id)}>
                  {service.name}
                </SelectItem>
              ))}
              <SelectItem value={NO_CATEGORY}>Sem categoria</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as 'todos' | ReminderDeliveryStatus)}
          >
            <SelectTrigger className="min-h-11" aria-label="Status do lembrete">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {(Object.keys(STATUS_META) as ReminderDeliveryStatus[]).map((status) => (
                <SelectItem key={status} value={status}>
                  {APPOINTMENT_STATUS_LABEL[status] ?? STATUS_META[status].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
          <span className="text-xs font-medium text-muted-foreground mr-1">Filtro rápido:</span>

          {/* Botão Hoje */}
          <button
            type="button"
            onClick={() => onPeriodChange('hoje')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all',
              period === 'hoje'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border'
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', period === 'hoje' ? 'bg-primary-foreground' : 'bg-emerald-500 animate-pulse')} />
            Hoje
            {counts.hoje > 0 && (
              <Badge
                variant="secondary"
                className={cn(
                  'ml-0.5 px-1.5 py-0 text-[10px] h-4',
                  period === 'hoje'
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-semibold'
                )}
              >
                {counts.hoje}
              </Badge>
            )}
          </button>

          {/* Botão Amanhã */}
          <button
            type="button"
            onClick={() => onPeriodChange('amanha')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all',
              period === 'amanha'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border'
            )}
          >
            Amanhã
            {counts.amanha > 0 && (
              <Badge
                variant="secondary"
                className={cn(
                  'ml-0.5 px-1.5 py-0 text-[10px] h-4',
                  period === 'amanha'
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                )}
              >
                {counts.amanha}
              </Badge>
            )}
          </button>

          {/* Botão Segunda-feira */}
          <button
            type="button"
            onClick={() => onPeriodChange('segunda')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all',
              period === 'segunda'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border'
            )}
          >
            <Calendar className="h-3 w-3" />
            Segunda-feira ({formatDateBR(monday, false)})
            {counts.segunda > 0 && (
              <Badge
                variant="secondary"
                className={cn(
                  'ml-0.5 px-1.5 py-0 text-[10px] h-4',
                  period === 'segunda'
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-sky-500/20 text-sky-700 dark:text-sky-300'
                )}
              >
                {counts.segunda}
              </Badge>
            )}
          </button>

          {/* Botão Todos */}
          <button
            type="button"
            onClick={() => onPeriodChange('todos')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all',
              period === 'todos'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border'
            )}
          >
            Todos os lembretes
            <Badge
              variant="secondary"
              className={cn(
                'ml-0.5 px-1.5 py-0 text-[10px] h-4',
                period === 'todos' && 'bg-primary-foreground/20 text-primary-foreground'
              )}
            >
              {filtered.length}
            </Badge>
          </button>

          {/* Seletor direto de data personalizada */}
          <div className="flex items-center gap-1.5 sm:ml-auto">
            <span className="text-[11px] text-muted-foreground hidden sm:inline">Data específica:</span>
            <Input
              type="date"
              value={customDate || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (onCustomDateChange) onCustomDateChange(val);
                if (val) onPeriodChange('personalizado');
              }}
              className={cn(
                'h-7 w-36 text-xs px-2 py-0',
                period === 'personalizado' ? 'border-primary ring-1 ring-primary/20' : 'border-dashed'
              )}
              title="Digite ou selecione uma data específica para ver na agenda"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<CalendarPlus />}
            title={appointments.length === 0 ? 'Nenhum atendimento cadastrado neste período' : 'Nada encontrado com esses filtros'}
            description={
              appointments.length === 0
                ? 'Cadastre um agendamento ou importe a planilha da agenda.'
                : 'Altere a busca ou os filtros para ver outros atendimentos.'
            }
            action={
              appointments.length === 0 ? (
                <Button onClick={onCreate} className="min-h-11 gap-1.5">
                  <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                  Novo agendamento
                </Button>
              ) : undefined
            }
            className="py-10"
          />
        ) : (
          <>
            {/* Tabela de agendamentos prioritários (Hoje e Futuros) */}
            {activeAppointments.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button
                          type="button"
                          onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                          className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors font-medium text-xs uppercase"
                          title={sortOrder === 'desc' ? 'Ordenando: Mais recentes e futuros primeiro. Clique para inverter.' : 'Ordenando: Mais antigos primeiro. Clique para inverter.'}
                        >
                          <span>Atendimento</span>
                          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </TableHead>
                      <TableHead>Tutor e pet</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Lembrete</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">Ações</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeAppointments.map((appointment) => {
                      const canSend =
                        appointment.appointmentDate >= today &&
                        ['pendente', 'falha', 'ignorado'].includes(appointment.status);
                      const cancelled =
                        appointment.status === 'cancelado' || appointment.appointmentStatus === 'CANCELADO';
                      const isToday = appointment.appointmentDate === today;
                      const isConfirmed = appointment.appointmentStatus === 'CONFIRMADO';
                      return (
                        <TableRow
                          key={appointment.id}
                          className={cn(
                            cancelled && 'opacity-60 bg-muted/30',
                            isConfirmed &&
                              'bg-emerald-500/[0.06] hover:bg-emerald-500/[0.11] border-l-4 border-l-emerald-500 dark:bg-emerald-500/[0.09]',
                            !isConfirmed && isToday && 'bg-primary/[0.04] border-l-2 border-l-primary'
                          )}
                        >
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium tabular-nums">
                                {formatDateBR(appointment.appointmentDate, true)}
                              </p>
                              <DayBadge date={appointment.appointmentDate} today={today} tomorrow={tomorrow} />
                            </div>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {appointment.appointmentTime ?? 'Sem horário'}
                            </p>
                          </TableCell>
                          <TableCell className="min-w-48">
                            <p className="font-medium">{appointment.ownerName}</p>
                            <p className="text-xs text-muted-foreground">
                              {appointment.petName || 'Pet não informado'} · {formatPhone(appointment.phone)}
                            </p>
                          </TableCell>
                          <TableCell className="max-w-48">
                            <ServiceBadge
                              name={appointment.service}
                              service={appointment.serviceId ? serviceById.get(appointment.serviceId) : null}
                            />
                            <p className="mt-1 truncate text-xs text-muted-foreground" title={appointment.configurationName}>
                              {appointment.configurationName}
                            </p>
                          </TableCell>
                          <TableCell className="min-w-40">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {appointment.messageId ? (
                                <button
                                  type="button"
                                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  onClick={() => onOpenMessage(appointment.messageId as number)}
                                  title="Ver a mensagem do lembrete"
                                >
                                  <StatusBadge status={appointment.status} />
                                </button>
                              ) : (
                                <StatusBadge
                                  status={appointment.status}
                                  label={APPOINTMENT_STATUS_LABEL[appointment.status]}
                                  neutral={appointment.status === 'pendente'}
                                />
                              )}
                              {appointment.appointmentStatus === 'AGENDADO' && (
                                <Badge variant="outline" className="border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-normal text-[11px] gap-1">
                                  <CalendarClock className="h-3 w-3" />
                                  Agendado
                                </Badge>
                              )}
                              {appointment.appointmentStatus === 'CONFIRMADO' && (
                                <Badge className="border-emerald-600/30 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] gap-1 shadow-xs">
                                  <CheckCheck className="h-3 w-3" />
                                  Confirmado
                                </Badge>
                              )}
                              {appointment.appointmentStatus === 'CANCELADO' && (
                                <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive font-normal text-[11px] gap-1">
                                  <Ban className="h-3 w-3" />
                                  Cancelado
                                </Badge>
                              )}
                              {appointment.appointmentStatus === 'REMARCAR' && (
                                <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-normal text-[11px] gap-1">
                                  <CalendarClock className="h-3 w-3" />
                                  Remarcar
                                </Badge>
                              )}
                              {appointment.googleEventId && (
                                <Badge
                                  variant="outline"
                                  className="border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-normal text-[11px] gap-1"
                                  title="Sincronizado com o Google Calendar"
                                >
                                  <Calendar className="h-3 w-3" />
                                  Google Agenda
                                </Badge>
                              )}
                            </div>
                            {appointment.error && (
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={appointment.error}>
                                {appointment.error}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-11 w-11"
                                  aria-label={`Ações para ${appointment.ownerName}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  disabled={!canSend || sendingId === appointment.id}
                                  onSelect={() => onSendNow(appointment)}
                                >
                                  <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                                  Enviar lembrete agora
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => onEdit(appointment)}>
                                  <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => onDuplicate(appointment)}>
                                  <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                                  Duplicar
                                </DropdownMenuItem>
                                {appointment.status === 'processando' && (
                                  <>
                                    <DropdownMenuItem
                                      onSelect={() =>
                                        onUnlockAppointment
                                          ? onUnlockAppointment(appointment, 'pendente')
                                          : undefined
                                      }
                                    >
                                      <RotateCcw className="mr-2 h-4 w-4 text-amber-600" aria-hidden="true" />
                                      Devolver à fila (Tentar de novo)
                                    </DropdownMenuItem>
                                    {onMarkAsSent && (
                                      <DropdownMenuItem onSelect={() => onMarkAsSent(appointment)}>
                                        <CheckCheck className="mr-2 h-4 w-4 text-emerald-600" aria-hidden="true" />
                                        Marcar como enviado
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem
                                      onSelect={() =>
                                        onUnlockAppointment
                                          ? onUnlockAppointment(appointment, 'falha')
                                          : undefined
                                      }
                                    >
                                      <XCircle className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                      Marcar como falha
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {onSyncGoogle && (
                                  <DropdownMenuItem onSelect={() => onSyncGoogle(appointment)}>
                                    <CalendarSync className="mr-2 h-4 w-4" aria-hidden="true" />
                                    Sincronizar no Google
                                  </DropdownMenuItem>
                                )}
                                {onChangeAttendanceStatus && appointment.appointmentStatus !== 'CONFIRMADO' && !cancelled && (
                                  <DropdownMenuItem onSelect={() => onChangeAttendanceStatus(appointment, 'CONFIRMADO')}>
                                    <CheckCheck className="mr-2 h-4 w-4 text-emerald-600" aria-hidden="true" />
                                    Confirmar presença
                                  </DropdownMenuItem>
                                )}
                                {onChangeAttendanceStatus && appointment.appointmentStatus !== 'REMARCAR' && !cancelled && (
                                  <DropdownMenuItem onSelect={() => onChangeAttendanceStatus(appointment, 'REMARCAR')}>
                                    <CalendarClock className="mr-2 h-4 w-4 text-amber-600" aria-hidden="true" />
                                    Marcar para remarcar
                                  </DropdownMenuItem>
                                )}
                                {cancelled ? (
                                  <DropdownMenuItem onSelect={() => onReactivate(appointment)}>
                                    <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                                    Reativar
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    disabled={appointment.status === 'processando'}
                                    onSelect={() => onCancel(appointment)}
                                  >
                                    <Ban className="mr-2 h-4 w-4" aria-hidden="true" />
                                    Cancelar atendimento
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={() => onDelete(appointment)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : period !== 'passados' ? (
              <div className="py-6 px-4 text-center border-b bg-muted/5">
                <p className="text-sm font-medium text-muted-foreground">
                  Nenhum atendimento futuro ou para hoje encontrado.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {pastAppointments.length} atendimento(s) anterior(es) arquivado(s) no acordeon abaixo.
                </p>
              </div>
            ) : null}

            {/* Acordeon para lembretes que já passaram */}
            {pastAppointments.length > 0 && (
              <div className="border-t bg-muted/15">
                <Accordion
                  type="single"
                  collapsible
                  value={accordionValue}
                  onValueChange={setAccordionValue}
                >
                  <AccordionItem value="passados" className="border-none">
                    <AccordionTrigger className="px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:no-underline transition-colors">
                      <div className="flex flex-wrap items-center gap-2 text-left">
                        <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        <span className="font-semibold text-foreground">Lembretes passados</span>
                        <Badge variant="secondary" className="px-1.5 py-0 text-xs">
                          {pastAppointments.length}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-normal">
                          (Anteriores a hoje · não prioritários)
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0 border-t">
                      <div className="overflow-x-auto bg-background/50">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30">
                              <TableHead>
                                <button
                                  type="button"
                                  onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                                  className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors font-medium text-xs uppercase"
                                  title={sortOrder === 'desc' ? 'Ordenando: Mais recentes primeiro. Clique para inverter.' : 'Ordenando: Mais antigos primeiro. Clique para inverter.'}
                                >
                                  <span>Atendimento</span>
                                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                              </TableHead>
                              <TableHead>Tutor e pet</TableHead>
                              <TableHead>Serviço</TableHead>
                              <TableHead>Lembrete</TableHead>
                              <TableHead className="w-12">
                                <span className="sr-only">Ações</span>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pastAppointments.map((appointment) => {
                              const cancelled =
                                appointment.status === 'cancelado' || appointment.appointmentStatus === 'CANCELADO';
                              const isConfirmed = appointment.appointmentStatus === 'CONFIRMADO';
                              return (
                                <TableRow
                                  key={appointment.id}
                                  className={cn(
                                    cancelled && 'opacity-50',
                                    isConfirmed
                                      ? 'bg-emerald-500/[0.05] border-l-4 border-l-emerald-500 hover:bg-emerald-500/[0.09]'
                                      : !cancelled && 'opacity-85 hover:opacity-100',
                                    'transition-colors'
                                  )}
                                >
                                  <TableCell className="whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-sm font-medium tabular-nums">
                                        {formatDateBR(appointment.appointmentDate, true)}
                                      </p>
                                      <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal">
                                        Passado
                                      </Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground tabular-nums">
                                      {appointment.appointmentTime ?? 'Sem horário'}
                                    </p>
                                  </TableCell>
                                  <TableCell className="min-w-48">
                                    <p className="font-medium">{appointment.ownerName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {appointment.petName || 'Pet não informado'} · {formatPhone(appointment.phone)}
                                    </p>
                                  </TableCell>
                                  <TableCell className="max-w-48">
                                    <ServiceBadge
                                      name={appointment.service}
                                      service={appointment.serviceId ? serviceById.get(appointment.serviceId) : null}
                                    />
                                    <p className="mt-1 truncate text-xs text-muted-foreground" title={appointment.configurationName}>
                                      {appointment.configurationName}
                                    </p>
                                  </TableCell>
                                  <TableCell className="min-w-40">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {appointment.messageId ? (
                                        <button
                                          type="button"
                                          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                          onClick={() => onOpenMessage(appointment.messageId as number)}
                                          title="Ver a mensagem do lembrete"
                                        >
                                          <StatusBadge status={appointment.status} />
                                        </button>
                                      ) : (
                                        <StatusBadge
                                          status={appointment.status}
                                          label={APPOINTMENT_STATUS_LABEL[appointment.status]}
                                          neutral={appointment.status === 'pendente'}
                                        />
                                      )}
                                      {appointment.appointmentStatus === 'AGENDADO' && (
                                        <Badge variant="outline" className="border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-normal text-[11px] gap-1">
                                          <CalendarClock className="h-3 w-3" />
                                          Agendado
                                        </Badge>
                                      )}
                                      {appointment.appointmentStatus === 'CONFIRMADO' && (
                                        <Badge className="border-emerald-600/30 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] gap-1 shadow-xs">
                                          <CheckCheck className="h-3 w-3" />
                                          Confirmado
                                        </Badge>
                                      )}
                                      {appointment.appointmentStatus === 'CANCELADO' && (
                                        <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive font-normal text-[11px] gap-1">
                                          <Ban className="h-3 w-3" />
                                          Cancelado
                                        </Badge>
                                      )}
                                      {appointment.appointmentStatus === 'REMARCAR' && (
                                        <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-normal text-[11px] gap-1">
                                          <CalendarClock className="h-3 w-3" />
                                          Remarcar
                                        </Badge>
                                      )}
                                      {appointment.googleEventId && (
                                        <Badge
                                          variant="outline"
                                          className="border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-normal text-[11px] gap-1"
                                          title="Sincronizado com o Google Calendar"
                                        >
                                          <Calendar className="h-3 w-3" />
                                          Google Agenda
                                        </Badge>
                                      )}
                                    </div>
                                    {appointment.error && (
                                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" title={appointment.error}>
                                        {appointment.error}
                                      </p>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-11 w-11"
                                          aria-label={`Ações para ${appointment.ownerName}`}
                                        >
                                          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onSelect={() => onEdit(appointment)}>
                                          <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
                                          Editar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => onDuplicate(appointment)}>
                                          <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                                          Duplicar (reagendar)
                                        </DropdownMenuItem>
                                        {appointment.status === 'processando' && (
                                          <>
                                            <DropdownMenuItem
                                              onSelect={() =>
                                                onUnlockAppointment
                                                  ? onUnlockAppointment(appointment, 'pendente')
                                                  : undefined
                                              }
                                            >
                                              <RotateCcw className="mr-2 h-4 w-4 text-amber-600" aria-hidden="true" />
                                              Devolver à fila (Tentar de novo)
                                            </DropdownMenuItem>
                                            {onMarkAsSent && (
                                              <DropdownMenuItem onSelect={() => onMarkAsSent(appointment)}>
                                                <CheckCheck className="mr-2 h-4 w-4 text-emerald-600" aria-hidden="true" />
                                                Marcar como enviado
                                              </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem
                                              onSelect={() =>
                                                onUnlockAppointment
                                                  ? onUnlockAppointment(appointment, 'falha')
                                                  : undefined
                                              }
                                            >
                                              <XCircle className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                              Marcar como falha
                                            </DropdownMenuItem>
                                          </>
                                        )}
                                        {onSyncGoogle && (
                                          <DropdownMenuItem onSelect={() => onSyncGoogle(appointment)}>
                                            <CalendarSync className="mr-2 h-4 w-4" aria-hidden="true" />
                                            Sincronizar no Google
                                          </DropdownMenuItem>
                                        )}
                                        {onChangeAttendanceStatus && appointment.appointmentStatus !== 'CONFIRMADO' && !cancelled && (
                                          <DropdownMenuItem onSelect={() => onChangeAttendanceStatus(appointment, 'CONFIRMADO')}>
                                            <CheckCheck className="mr-2 h-4 w-4 text-emerald-600" aria-hidden="true" />
                                            Confirmar presença
                                          </DropdownMenuItem>
                                        )}
                                        {onChangeAttendanceStatus && appointment.appointmentStatus !== 'REMARCAR' && !cancelled && (
                                          <DropdownMenuItem onSelect={() => onChangeAttendanceStatus(appointment, 'REMARCAR')}>
                                            <CalendarClock className="mr-2 h-4 w-4 text-amber-600" aria-hidden="true" />
                                            Marcar para remarcar
                                          </DropdownMenuItem>
                                        )}
                                        {cancelled ? (
                                          <DropdownMenuItem onSelect={() => onReactivate(appointment)}>
                                            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                                            Reativar
                                          </DropdownMenuItem>
                                        ) : (
                                          <DropdownMenuItem
                                            disabled={appointment.status === 'processando'}
                                            onSelect={() => onCancel(appointment)}
                                          >
                                            <Ban className="mr-2 h-4 w-4" aria-hidden="true" />
                                            Cancelar atendimento
                                          </DropdownMenuItem>
                                        )}
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-destructive focus:text-destructive"
                                          onSelect={() => onDelete(appointment)}
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                                          Excluir
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            )}
          </>
        )}
        {!loading && appointments.length >= 500 && (
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            Mostrando os 500 primeiros. Use um período menor para ver o restante.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default AppointmentsTab;
