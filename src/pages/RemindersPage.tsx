import { useMemo, useState } from 'react';
import {
  AlertCircle,
  BellRing,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  Loader2,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Download,
  Upload,
  Workflow,
  XCircle,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageContainer from '@/components/layout/PageContainer';
import EmptyState from '@/components/shared/EmptyState';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import SpreadsheetImportDialog from '@/components/shared/SpreadsheetImportDialog';
import ReminderFormDialog from '@/components/reminders/ReminderFormDialog';
import { useReminders } from '@/hooks/useReminders';
import { cn } from '@/lib/utils';
import { exportSpreadsheet } from '@/lib/spreadsheet';
import { parseReminderSpreadsheet } from '@/lib/operationalSpreadsheets';
import {
  ReminderConfiguration,
  ReminderConfigurationInput,
  ReminderDelivery,
  ReminderDeliveryStatus,
} from '@/types/reminder';
import { ReminderSpreadsheetImportRow } from '@/types/spreadsheet';
import { toast } from 'sonner';

const STATUS_META: Record<
  ReminderDeliveryStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  enviado: {
    label: 'Enviado',
    icon: CheckCircle2,
    className: 'border-success/20 bg-success/10 text-success',
  },
  falha: {
    label: 'Falha',
    icon: XCircle,
    className: 'border-destructive/20 bg-destructive/10 text-destructive',
  },
  pendente: {
    label: 'Pendente',
    icon: Clock3,
    className: 'border-warning/20 bg-warning/10 text-warning',
  },
  processando: {
    label: 'Processando',
    icon: Loader2,
    className: 'border-primary/20 bg-primary/10 text-primary',
  },
  ignorado: {
    label: 'Ignorado',
    icon: AlertCircle,
    className: 'border-border bg-muted text-muted-foreground',
  },
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatAppointment(delivery: ReminderDelivery) {
  const date = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${delivery.appointmentDate}T12:00:00Z`));

  return delivery.appointmentTime ? `${date} às ${delivery.appointmentTime}` : date;
}

function currentMinutesInTimezone(timezone: string) {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  return hour * 60 + minute;
}

function nextDispatchLabel(configurations: ReminderConfiguration[]) {
  const candidates = configurations
    .filter((configuration) => configuration.enabled)
    .map((configuration) => {
      const [hour, minute] = configuration.sendTime.split(':').map(Number);
      const sendMinutes = hour * 60 + minute;
      const currentMinutes = currentMinutesInTimezone(configuration.timezone);
      const delta = (sendMinutes - currentMinutes + 1440) % 1440;
      const dayOffset = sendMinutes >= currentMinutes ? 0 : 1;
      return { configuration, delta, dayOffset };
    })
    .sort((a, b) => a.delta - b.delta);

  if (candidates.length === 0) return 'Nenhum';
  const next = candidates[0];
  return `${next.dayOffset === 0 ? 'Hoje' : 'Amanhã'}, ${next.configuration.sendTime}`;
}

const DeliveryStatusBadge = ({ status }: { status: ReminderDeliveryStatus }) => {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        meta.className
      )}
    >
      <Icon
        className={cn('h-3 w-3', status === 'processando' && 'animate-spin')}
        aria-hidden="true"
      />
      {meta.label}
    </span>
  );
};

const RemindersPage = () => {
  const {
    configurations,
    deliveries,
    loading,
    configurationsLoading,
    deliveriesLoading,
    setupError,
    createReminder,
    updateReminder,
    toggleReminder,
    deleteReminder,
    importDeliveries,
    getAllDeliveries,
    refreshDeliveries,
  } = useReminders();
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderConfiguration | null>(null);
  const [reminderToDelete, setReminderToDelete] =
    useState<ReminderConfiguration | null>(null);
  const [statusFilter, setStatusFilter] = useState<'todos' | ReminderDeliveryStatus>(
    'todos'
  );

  const stats = useMemo(() => {
    const todayKey = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const sentToday = deliveries.filter(
      (delivery) =>
        delivery.status === 'enviado' &&
        delivery.sentAt &&
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(delivery.sentAt)) === todayKey
    ).length;
    const failuresToday = deliveries.filter(
      (delivery) =>
        delivery.status === 'falha' &&
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(delivery.updatedAt)) === todayKey
    ).length;
    const completedLastSevenDays = deliveries.filter(
      (delivery) =>
        ['enviado', 'falha'].includes(delivery.status) &&
        new Date(delivery.updatedAt).getTime() >= sevenDaysAgo
    );
    const successLastSevenDays = completedLastSevenDays.filter(
      (delivery) => delivery.status === 'enviado'
    ).length;
    const successRate =
      completedLastSevenDays.length > 0
        ? Math.round((successLastSevenDays / completedLastSevenDays.length) * 100)
        : 0;

    return {
      active: configurations.filter((configuration) => configuration.enabled).length,
      sentToday,
      failuresToday,
      successRate,
    };
  }, [configurations, deliveries]);

  const filteredDeliveries = useMemo(
    () =>
      statusFilter === 'todos'
        ? deliveries
        : deliveries.filter((delivery) => delivery.status === statusFilter),
    [deliveries, statusFilter]
  );

  const openNewReminder = () => {
    setEditingReminder(null);
    setFormOpen(true);
  };

  const openEditReminder = (reminder: ReminderConfiguration) => {
    setEditingReminder(reminder);
    setFormOpen(true);
  };

  const saveReminder = (input: ReminderConfigurationInput) => {
    const closeAfterSuccess = { onSuccess: () => setFormOpen(false) };
    if (editingReminder) {
      updateReminder.mutate(
        { id: editingReminder.id, input },
        closeAfterSuccess
      );
    } else {
      createReminder.mutate(input, closeAfterSuccess);
    }
  };

  const exportReminderRows = async (template = false) => {
    setExporting(true);
    try {
      const rows = template ? [] : await getAllDeliveries();
      await exportSpreadsheet({
        fileName: template
          ? 'modelo-importacao-lembretes.xlsx'
          : `lembretes-${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: 'Lembretes',
        columns: [
          {
            header: 'Data Agendada',
            width: 16,
            kind: 'date',
            value: (row: ReminderDelivery) => row.appointmentDate,
          },
          {
            header: 'Horário',
            width: 12,
            kind: 'time',
            value: (row: ReminderDelivery) => row.appointmentTime,
          },
          {
            header: 'Serviços',
            width: 24,
            value: (row: ReminderDelivery) => row.service,
          },
          {
            header: 'Descrição',
            width: 30,
            value: (row: ReminderDelivery) => row.description,
          },
          {
            header: 'Nome Cliente',
            width: 26,
            value: (row: ReminderDelivery) => row.ownerName,
          },
          {
            header: 'Telefone',
            width: 23,
            value: (row: ReminderDelivery) => row.phone,
          },
          {
            header: 'E-mail',
            width: 30,
            value: (row: ReminderDelivery) => row.email,
          },
          {
            header: 'Nome Pet',
            width: 20,
            value: (row: ReminderDelivery) => row.petName,
          },
          {
            header: 'Porte',
            width: 14,
            value: (row: ReminderDelivery) => row.petSize,
          },
          {
            header: 'Preço',
            width: 14,
            kind: 'currency',
            value: (row: ReminderDelivery) => row.price,
          },
          {
            header: 'Status',
            width: 16,
            kind: 'status',
            value: (row: ReminderDelivery) =>
              row.appointmentStatus ?? row.status.toLocaleUpperCase('pt-BR'),
          },
          ...(template
            ? []
            : [
                {
                  header: 'Status Lembrete',
                  width: 18,
                  kind: 'status' as const,
                  value: (row: ReminderDelivery) =>
                    row.status.toLocaleUpperCase('pt-BR'),
                },
                {
                  header: 'Enviado em',
                  width: 20,
                  kind: 'datetime' as const,
                  value: (row: ReminderDelivery) => row.sentAt,
                },
                {
                  header: 'Erro',
                  width: 36,
                  value: (row: ReminderDelivery) => row.error,
                },
              ]),
        ],
        rows,
      });
      toast.success(template ? 'Modelo baixado' : 'Lembretes exportados');
    } catch (error) {
      console.error('Erro ao exportar lembretes:', error);
      toast.error('Não foi possível gerar o arquivo Excel');
    } finally {
      setExporting(false);
    }
  };

  if (setupError && !loading) {
    return (
      <PageContainer>
        <PageHeader
          title="Lembretes"
          description="Gerencie os avisos automáticos enviados antes dos agendamentos."
        />
        <Card className="shadow-sm">
          <EmptyState
            icon={<BellRing />}
            title="Módulo ainda não configurado no Supabase"
            description="Aplique a migração supabase/migrations/20260716100000_lembretes.sql no projeto Supabase e recarregue esta página."
          />
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Lembretes"
        description="Configure os avisos do dia anterior e acompanhe os envios realizados pelo n8n."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="min-h-11 gap-1.5"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Importar
            </Button>
            <Button
              variant="outline"
              onClick={() => exportReminderRows()}
              disabled={exporting}
              className="min-h-11 gap-1.5"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              Exportar Excel
            </Button>
            <Button onClick={openNewReminder} className="min-h-11 gap-1.5">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Novo lembrete
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Regras ativas"
          value={stats.active}
          icon={<BellRing />}
          tone="success"
          loading={loading}
          hint={`${configurations.length} regra(s) cadastrada(s)`}
        />
        <StatCard
          title="Próximo disparo"
          value={nextDispatchLabel(configurations)}
          icon={<Clock3 />}
          loading={configurationsLoading}
          hint="Horário de Brasília"
          className="[&_[class*='text-3xl']]:text-xl"
        />
        <StatCard
          title="Enviados hoje"
          value={stats.sentToday}
          icon={<Send />}
          tone="success"
          loading={deliveriesLoading}
        />
        <StatCard
          title="Falhas hoje"
          value={stats.failuresToday}
          icon={<AlertCircle />}
          tone={stats.failuresToday > 0 ? 'destructive' : 'default'}
          loading={deliveriesLoading}
          hint={`Taxa de sucesso em 7 dias: ${stats.successRate}%`}
        />
      </div>

      <Card className="mb-6 overflow-hidden shadow-sm">
        <CardContent className="p-0">
          <div className="grid md:grid-cols-[220px_1fr]">
            <div className="flex items-center gap-3 border-b bg-accent/45 p-5 md:border-b-0 md:border-r">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <Workflow className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold">Fluxo de amanhã</p>
                <p className="text-xs text-muted-foreground">Supabase + n8n</p>
              </div>
            </div>
            <ol className="grid gap-px bg-border sm:grid-cols-3" aria-label="Como os lembretes funcionam">
              {[
                {
                  icon: Database,
                  title: '1. Consulta a regra',
                  description: 'O n8n lê as configurações ativas e o horário de envio.',
                },
                {
                  icon: CalendarCheck2,
                  title: '2. Filtra a agenda',
                  description: 'Seleciona somente tutores com serviço marcado para amanhã.',
                },
                {
                  icon: ShieldCheck,
                  title: '3. Envia e registra',
                  description: 'Dispara a mensagem e salva o resultado sem duplicidade.',
                },
              ].map((step) => (
                <li key={step.title} className="flex gap-3 bg-card p-4">
                  <step.icon
                    className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList className="h-11 w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="rules" className="min-h-9 gap-1.5">
            <MessageSquareText className="h-4 w-4" aria-hidden="true" />
            Regras e horários
          </TabsTrigger>
          <TabsTrigger value="history" className="min-h-9 gap-1.5">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Histórico de envios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-0">
          {configurationsLoading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {[0, 1].map((item) => (
                <Card key={item} className="shadow-sm">
                  <CardHeader>
                    <Skeleton className="h-5 w-52" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : configurations.length === 0 ? (
            <Card className="shadow-sm">
              <EmptyState
                icon={<BellRing />}
                title="Nenhum lembrete configurado"
                description="Crie a primeira regra para definir quando e como os tutores serão avisados."
                action={
                  <Button onClick={openNewReminder} className="min-h-11">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Criar lembrete
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {configurations.map((reminder) => (
                <Card key={reminder.id} className="shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-base">{reminder.name}</CardTitle>
                          <Badge
                            variant="outline"
                            className={cn(
                              'font-normal',
                              reminder.enabled
                                ? 'border-success/20 bg-success/10 text-success'
                                : 'text-muted-foreground'
                            )}
                          >
                            {reminder.enabled ? 'Ativo' : 'Pausado'}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Atualizado em {formatDateTime(reminder.updatedAt)}
                        </p>
                      </div>
                      <Switch
                        checked={reminder.enabled}
                        disabled={toggleReminder.isPending}
                        onCheckedChange={(enabled) =>
                          toggleReminder.mutate({ id: reminder.id, enabled })
                        }
                        aria-label={
                          reminder.enabled
                            ? `Pausar ${reminder.name}`
                            : `Ativar ${reminder.name}`
                        }
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <dl className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-3">
                      <div>
                        <dt className="text-xs text-muted-foreground">Envio</dt>
                        <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                          <Clock3 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                          {reminder.sendTime}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Agenda</dt>
                        <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
                          <CalendarDays
                            className="h-3.5 w-3.5 text-primary"
                            aria-hidden="true"
                          />
                          Dia seguinte
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Fuso</dt>
                        <dd className="mt-0.5 text-sm font-medium">Brasília</dd>
                      </div>
                    </dl>

                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
                        Mensagem enviada
                      </p>
                      <p className="line-clamp-4 whitespace-pre-wrap rounded-md border bg-card p-3 text-sm leading-6 text-muted-foreground">
                        {reminder.messageTemplate}
                      </p>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        variant="outline"
                        className="min-h-11 gap-1.5"
                        onClick={() => openEditReminder(reminder)}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        className="min-h-11 gap-1.5 text-muted-foreground hover:text-destructive"
                        onClick={() => setReminderToDelete(reminder)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Remover
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <Card className="shadow-sm">
            <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Últimos envios</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Até 200 registros recentes. A lista é atualizada automaticamente a cada 30
                  segundos.
                </p>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value as 'todos' | ReminderDeliveryStatus)
                  }
                >
                  <SelectTrigger className="min-h-11 flex-1 sm:w-44">
                    <SelectValue placeholder="Filtrar status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    {Object.entries(STATUS_META).map(([status, meta]) => (
                      <SelectItem key={status} value={status}>
                        {meta.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={() => refreshDeliveries()}
                  disabled={deliveriesLoading}
                  aria-label="Atualizar histórico de envios"
                >
                  <RefreshCw
                    className={cn('h-4 w-4', deliveriesLoading && 'animate-spin')}
                    aria-hidden="true"
                  />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {deliveriesLoading ? (
                <div className="space-y-3 p-5">
                  {[0, 1, 2, 3].map((item) => (
                    <Skeleton key={item} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredDeliveries.length === 0 ? (
                <EmptyState
                  icon={<Send />}
                  title={
                    statusFilter === 'todos'
                      ? 'Nenhum envio registrado'
                      : 'Nenhum envio com este status'
                  }
                  description={
                    statusFilter === 'todos'
                      ? 'Os resultados aparecerão aqui quando o n8n começar a processar os lembretes.'
                      : 'Altere o filtro para consultar outros resultados.'
                  }
                  className="py-10"
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Processado em</TableHead>
                        <TableHead>Tutor e pet</TableHead>
                        <TableHead>Agendamento</TableHead>
                        <TableHead>Lembrete</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDeliveries.map((delivery) => (
                        <TableRow key={delivery.id}>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {formatDateTime(delivery.sentAt || delivery.updatedAt)}
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{delivery.ownerName}</p>
                            <p className="text-xs text-muted-foreground">
                              {delivery.petName || 'Pet não informado'} ·{' '}
                              {delivery.phone.replace('@s.whatsapp.net', '')}
                            </p>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <p className="text-sm">{formatAppointment(delivery)}</p>
                            <p className="text-xs text-muted-foreground">
                              {delivery.service || 'Serviço não informado'}
                            </p>
                          </TableCell>
                          <TableCell className="max-w-48">
                            <p className="truncate text-sm" title={delivery.configurationName}>
                              {delivery.configurationName}
                            </p>
                          </TableCell>
                          <TableCell>
                            <DeliveryStatusBadge status={delivery.status} />
                          </TableCell>
                          <TableCell className="max-w-64">
                            <p className="text-xs text-muted-foreground">
                              {delivery.attempts}{' '}
                              {delivery.attempts === 1 ? 'tentativa' : 'tentativas'}
                            </p>
                            {delivery.error && (
                              <p
                                className="mt-0.5 line-clamp-2 text-xs text-destructive"
                                title={delivery.error}
                              >
                                {delivery.error}
                              </p>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ReminderFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        reminder={editingReminder}
        isPending={createReminder.isPending || updateReminder.isPending}
        onSubmit={saveReminder}
      />

      <SpreadsheetImportDialog<ReminderSpreadsheetImportRow>
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Importar agenda de lembretes"
        description="Traga os registros da planilha antiga e associe todas as linhas a uma regra de lembrete."
        configurationLabel="Regra de lembrete"
        configurations={configurations.map((configuration) => ({
          id: configuration.id,
          name: configuration.name,
        }))}
        requiredColumns={[
          'Data Agendada',
          'Horário',
          'Serviços',
          'Nome Cliente',
          'Telefone',
          'Status',
        ]}
        parseFile={parseReminderSpreadsheet}
        onImport={(configurationId, rows) =>
          importDeliveries.mutateAsync({ configurationId, rows })
        }
        onDownloadTemplate={() => exportReminderRows(true)}
      />

      <AlertDialog
        open={!!reminderToDelete}
        onOpenChange={(open) => !open && setReminderToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este lembrete?</AlertDialogTitle>
            <AlertDialogDescription>
              A regra “{reminderToDelete?.name}” deixará de ser consultada pelo n8n. O
              histórico de envios já realizados será preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteReminder.isPending}
              onClick={() => {
                if (!reminderToDelete) return;
                deleteReminder.mutate(reminderToDelete.id, {
                  onSuccess: () => setReminderToDelete(null),
                });
              }}
            >
              {deleteReminder.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
};

export default RemindersPage;
