import { useMemo, useState } from 'react';
import {
  Ban,
  CalendarPlus,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
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
import { AppointmentPeriod, todayInSaoPaulo } from '@/hooks/useReminders';
import { ReminderDelivery, ReminderDeliveryStatus, ReminderService } from '@/types/reminder';
import {
  APPOINTMENT_STATUS_LABEL,
  STATUS_META,
  ServiceBadge,
  StatusBadge,
  formatDateBR,
  formatPhone,
} from './reminderUi';

const PERIODS: { value: AppointmentPeriod; label: string }[] = [
  { value: 'amanha', label: 'Amanhã' },
  { value: 'hoje', label: 'Hoje' },
  { value: 'proximos7', label: 'Próximos 7 dias' },
  { value: 'futuros', label: 'Todos os próximos' },
  { value: 'passados', label: 'Já passaram' },
  { value: 'todos', label: 'Todos' },
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
  onCreate: () => void;
  onEdit: (appointment: ReminderDelivery) => void;
  onSendNow: (appointment: ReminderDelivery) => void;
  onCancel: (appointment: ReminderDelivery) => void;
  onReactivate: (appointment: ReminderDelivery) => void;
  onDelete: (appointment: ReminderDelivery) => void;
  onOpenMessage: (messageId: number) => void;
  sendingId: number | null;
}

const AppointmentsTab = ({
  appointments,
  services,
  loading,
  period,
  onPeriodChange,
  onCreate,
  onEdit,
  onSendNow,
  onCancel,
  onReactivate,
  onDelete,
  onOpenMessage,
  sendingId,
}: AppointmentsTabProps) => {
  const [search, setSearch] = useState('');
  const [serviceFilter, setServiceFilter] = useState('todos');
  const [statusFilter, setStatusFilter] = useState<'todos' | ReminderDeliveryStatus>('todos');
  const serviceById = useMemo(() => new Map(services.map((service) => [service.id, service])), [services]);
  const today = todayInSaoPaulo();

  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    return appointments.filter((appointment) => {
      if (statusFilter !== 'todos' && appointment.status !== statusFilter) return false;
      if (serviceFilter === NO_CATEGORY && appointment.serviceId) return false;
      if (serviceFilter !== 'todos' && serviceFilter !== NO_CATEGORY && appointment.serviceId !== Number(serviceFilter)) {
        return false;
      }
      if (!term) return true;
      return [appointment.ownerName, appointment.petName ?? '', appointment.phone]
        .some((value) => normalize(value).includes(term));
    });
  }, [appointments, search, serviceFilter, statusFilter]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-3 pb-3">
        <div>
          <CardTitle className="text-base">Agenda de lembretes</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Cada linha é um atendimento. Tutores com mais de um atendimento no mesmo dia recebem
            uma única mensagem citando todos.
          </p>
        </div>
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
            title={appointments.length === 0 ? 'Nenhum atendimento neste período' : 'Nada encontrado com esses filtros'}
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atendimento</TableHead>
                  <TableHead>Tutor e pet</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Lembrete</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((appointment) => {
                  const canSend =
                    appointment.appointmentDate >= today &&
                    ['pendente', 'falha', 'ignorado'].includes(appointment.status);
                  const cancelled = appointment.status === 'cancelado';
                  return (
                    <TableRow key={appointment.id} className={cancelled ? 'opacity-60' : undefined}>
                      <TableCell className="whitespace-nowrap">
                        <p className="text-sm font-medium tabular-nums">
                          {formatDateBR(appointment.appointmentDate, true)}
                        </p>
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
                        {appointment.messageId ? (
                          <button
                            type="button"
                            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={() => onOpenMessage(appointment.messageId as number)}
                            title="Ver a mensagem"
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
                            {cancelled ? (
                              <DropdownMenuItem onSelect={() => onReactivate(appointment)}>
                                <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
                                Reativar
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                disabled={['enviado', 'processando'].includes(appointment.status)}
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
