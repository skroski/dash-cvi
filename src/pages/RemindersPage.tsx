import { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BellRing,
  Bot,
  Calendar,
  CalendarCheck2,
  CalendarDays,
  Download,
  ListChecks,
  Loader2,
  MessageSquareText,
  Plus,
  Send,
  Settings2,
  Tags,
  Timer,
  Upload,
  Users,
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
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageContainer from '@/components/layout/PageContainer';
import EmptyState from '@/components/shared/EmptyState';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import SpreadsheetImportDialog from '@/components/shared/SpreadsheetImportDialog';
import ActivityTab from '@/components/reminders/ActivityTab';
import AppointmentFormDialog from '@/components/reminders/AppointmentFormDialog';
import AppointmentsTab from '@/components/reminders/AppointmentsTab';
import DispatchRemindersDialog from '@/components/reminders/DispatchRemindersDialog';
import MessageDetailDialog from '@/components/reminders/MessageDetailDialog';
import MessagesTab from '@/components/reminders/MessagesTab';
import ReminderFormDialog from '@/components/reminders/ReminderFormDialog';
import ReminderSettingsDialog from '@/components/reminders/ReminderSettingsDialog';
import GoogleCalendarDialog from '@/components/reminders/GoogleCalendarDialog';
import RulesTab from '@/components/reminders/RulesTab';
import ServicesTab from '@/components/reminders/ServicesTab';
import TestSendDialog from '@/components/reminders/TestSendDialog';
import { formatTime } from '@/components/reminders/reminderUi';
import {
  AppointmentPeriod,
  MessagePeriod,
  fetchMessageById,
  useReminderDefaultExamples,
  useReminders,
} from '@/hooks/useReminders';
import { useReminderGoogleCalendar } from '@/hooks/useReminderGoogleCalendar';
import { cn } from '@/lib/utils';
import { exportSpreadsheet } from '@/lib/spreadsheet';
import { parseReminderSpreadsheet } from '@/lib/operationalSpreadsheets';
import {
  ReminderConfiguration,
  ReminderConfigurationInput,
  ReminderDelivery,
  ReminderMessage,
  ReminderService,
} from '@/types/reminder';
import { toast } from 'sonner';

type RuleFormState = {
  open: boolean;
  rule: ReminderConfiguration | null;
  tab: 'geral' | 'frases' | 'ia';
};

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
  const next = configurations
    .filter((configuration) => configuration.enabled)
    .map((configuration) => {
      const [hour, minute] = configuration.sendTime.split(':').map(Number);
      const sendMinutes = hour * 60 + minute;
      const currentMinutes = currentMinutesInTimezone(configuration.timezone);
      return {
        configuration,
        delta: (sendMinutes - currentMinutes + 1440) % 1440,
        today: sendMinutes > currentMinutes,
      };
    })
    .sort((a, b) => a.delta - b.delta)[0];
  if (!next) return null;
  return `${next.today ? 'Hoje' : 'Amanhã'}, ${next.configuration.sendTime} (${next.configuration.name})`;
}

const FLOW_STEPS = [
  {
    icon: CalendarCheck2,
    title: 'Agenda',
    description: 'Atendimentos cadastrados aqui ou importados da planilha, com o serviço.',
  },
  {
    icon: Users,
    title: '1 por tutor por dia',
    description: 'No horário da regra, cada tutor entra uma vez na fila, citando todos os pets.',
  },
  {
    icon: Bot,
    title: 'IA escreve',
    description: 'A OpenAI reescreve uma das frases de exemplo com os dados do tutor.',
  },
  {
    icon: Timer,
    title: 'Envio espaçado',
    description: 'Uma mensagem por vez pelo WhatsApp, com intervalo aleatório entre elas.',
  },
];

const RemindersPage = () => {
  const [tab, setTab] = useState('agenda');
  const [appointmentPeriod, setAppointmentPeriod] = useState<AppointmentPeriod>('todos');
  const [customDate, setCustomDate] = useState<string>('');
  const [messagePeriod, setMessagePeriod] = useState<MessagePeriod>('hoje');
  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const api = useReminders({ appointmentPeriod, customDate, messagePeriod });
  const defaultExamples = useReminderDefaultExamples();

  const [ruleForm, setRuleForm] = useState<RuleFormState>({ open: false, rule: null, tab: 'geral' });
  const [appointmentForm, setAppointmentForm] = useState<{
    open: boolean;
    appointment: ReminderDelivery | null;
    isDuplicate?: boolean;
  }>({
    open: false,
    appointment: null,
    isDuplicate: false,
  });
  const [importOpen, setImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [googleCalendarOpen, setGoogleCalendarOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const gcal = useReminderGoogleCalendar();
  const [testRule, setTestRule] = useState<ReminderConfiguration | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<ReminderConfiguration | null>(null);
  const [ruleToDispatch, setRuleToDispatch] = useState<ReminderConfiguration | null>(null);
  const [appointmentToDelete, setAppointmentToDelete] = useState<ReminderDelivery | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<ReminderService | null>(null);
  const [confirmAutoSend, setConfirmAutoSend] = useState(false);
  const [openMessageId, setOpenMessageId] = useState<number | null>(null);
  const [fetchedMessage, setFetchedMessage] = useState<ReminderMessage | null>(null);
  const [sendingId, setSendingId] = useState<number | null>(null);

  const clinicName =
    api.settings?.clinicName ??
    'C.V.I. - Centro Veterinário Integrado';
  const autoSend = api.settings?.autoSend ?? false;
  const nextDispatch = nextDispatchLabel(api.configurations);

  const openMessage =
    openMessageId === null
      ? null
      : api.messages.find((message) => message.id === openMessageId) ??
        (fetchedMessage?.id === openMessageId ? fetchedMessage : null);

  const uncategorizedServices = useMemo(
    () =>
      [...new Set(
        api.appointments
          .filter((appointment) => !appointment.serviceId && appointment.service?.trim())
          .map((appointment) => appointment.service!.trim())
      )].sort(),
    [api.appointments]
  );

  const showMessage = async (messageId: number) => {
    setOpenMessageId(messageId);
    if (!api.messages.some((message) => message.id === messageId)) {
      try {
        setFetchedMessage(await fetchMessageById(messageId));
      } catch {
        toast.error('Não foi possível abrir a mensagem');
        setOpenMessageId(null);
      }
    }
  };

  const saveRule = (input: ReminderConfigurationInput) => {
    const closeAfterSuccess = { onSuccess: () => setRuleForm((state) => ({ ...state, open: false })) };
    if (ruleForm.rule && ruleForm.rule.id > 0) {
      api.updateReminder.mutate({ id: ruleForm.rule.id, input }, closeAfterSuccess);
    } else {
      api.createReminder.mutate(input, closeAfterSuccess);
    }
  };

  const exportReminderRows = async (template = false) => {
    setExporting(true);
    try {
      const rows = template ? [] : await api.getAllDeliveries();
      await exportSpreadsheet({
        fileName: template
          ? 'modelo-importacao-lembretes.xlsx'
          : `lembretes-${new Date().toISOString().slice(0, 10)}.xlsx`,
        sheetName: 'Lembretes',
        columns: [
          { header: 'Data Agendada', width: 16, kind: 'date', value: (row: ReminderDelivery) => row.appointmentDate },
          { header: 'Horário', width: 12, kind: 'time', value: (row: ReminderDelivery) => row.appointmentTime },
          { header: 'Serviços', width: 24, value: (row: ReminderDelivery) => row.service },
          { header: 'Nome Cliente', width: 26, value: (row: ReminderDelivery) => row.ownerName },
          { header: 'Telefone', width: 23, value: (row: ReminderDelivery) => row.phone },
          { header: 'Nome Pet', width: 20, value: (row: ReminderDelivery) => row.petName },
          { header: 'Descrição', width: 30, value: (row: ReminderDelivery) => row.description },
          {
            header: 'Status',
            width: 16,
            kind: 'status',
            value: (row: ReminderDelivery) => row.appointmentStatus ?? 'CONFIRMADO',
          },
          ...(template
            ? []
            : [
                {
                  header: 'Status Lembrete',
                  width: 18,
                  kind: 'status' as const,
                  value: (row: ReminderDelivery) => row.status.toLocaleUpperCase('pt-BR'),
                },
                { header: 'Regra', width: 26, value: (row: ReminderDelivery) => row.configurationName },
                { header: 'Enviado em', width: 20, kind: 'datetime' as const, value: (row: ReminderDelivery) => row.sentAt },
                { header: 'Erro', width: 36, value: (row: ReminderDelivery) => row.error },
              ]),
        ],
        rows,
      });
      toast.success(template ? 'Modelo baixado' : 'Agenda exportada');
    } catch (error) {
      console.error('Erro ao exportar lembretes:', error);
      toast.error('Não foi possível gerar o arquivo Excel');
    } finally {
      setExporting(false);
    }
  };

  if (api.setupError && !api.loading) {
    return (
      <PageContainer>
        <PageHeader title="Lembretes" description="Avisos automáticos pelo WhatsApp antes dos atendimentos." />
        <Card className="shadow-sm">
          <EmptyState
            icon={<BellRing />}
            title="Módulo ainda não configurado no Supabase"
            description="Aplique a migração supabase/migrations/20261013100000_lembretes_envio_supabase.sql no projeto Supabase e recarregue esta página."
          />
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Lembretes"
        dataTour="reminders-header"
        description="Agenda, mensagens e envios automáticos pelo WhatsApp antes dos atendimentos."
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)} className="min-h-11 gap-1.5">
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
              Exportar
            </Button>
            <Button
              variant="outline"
              onClick={() => setGoogleCalendarOpen(true)}
              className="min-h-11 gap-1.5 border-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
              title="Integração Google Calendar"
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              Google Agenda
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              className="h-11 w-11"
              aria-label="Ajustes dos lembretes"
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              onClick={() => setAppointmentForm({ open: true, appointment: null })}
              className="min-h-11 gap-1.5"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Novo agendamento
            </Button>
          </>
        }
      />

      <Card className="mb-6 overflow-hidden shadow-sm" data-tour="reminders-flow">
        <CardContent className="p-0">
          <div className="grid lg:grid-cols-[280px_1fr]">
            <div
              className={cn(
                'flex flex-col justify-between gap-3 border-b p-5 lg:border-b-0 lg:border-r',
                autoSend ? 'bg-success/5' : 'bg-muted/40'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Envio automático</p>
                  <p className={cn('text-sm font-medium', autoSend ? 'text-success' : 'text-muted-foreground')}>
                    {autoSend ? 'Ligado' : 'Desligado'}
                  </p>
                </div>
                <Switch
                  checked={autoSend}
                  disabled={!api.settings || api.updateSettings.isPending}
                  onCheckedChange={(checked) =>
                    checked ? setConfirmAutoSend(true) : api.updateSettings.mutate({ autoSend: false })
                  }
                  aria-label={autoSend ? 'Desligar envio automático' : 'Ligar envio automático'}
                />
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                {autoSend
                  ? nextDispatch
                    ? `Próximo disparo: ${nextDispatch}.`
                    : 'Nenhuma regra ativa: nada será enviado.'
                  : 'Nada sai sozinho. "Enviar agora", "Disparar agora" e testes continuam funcionando.'}
              </p>
            </div>
            <ol className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4" aria-label="Como os lembretes funcionam">
              {FLOW_STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3 bg-card p-4">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <step.icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {index + 1}. {step.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-tour="reminders-stats">
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setTab('agenda');
            setAppointmentPeriod('amanha');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setTab('agenda');
              setAppointmentPeriod('amanha');
            }
          }}
          className="cursor-pointer transition-transform hover:scale-[1.01]"
          title="Clique para ver os atendimentos de amanhã na agenda"
        >
          <StatCard
            title="Atendimentos amanhã"
            value={api.stats.tomorrowAppointments}
            icon={<CalendarDays />}
            loading={api.statsLoading}
            hint={`${api.stats.tomorrowPending} aguardando lembrete`}
          />
        </div>
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setTab('mensagens');
            setMessagePeriod('pendentes');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setTab('mensagens');
              setMessagePeriod('pendentes');
            }
          }}
          className="cursor-pointer transition-transform hover:scale-[1.01]"
          title="Clique para ver todas as mensagens na fila"
        >
          <StatCard
            title="Na fila agora (Pendentes)"
            value={api.stats.queued}
            icon={<ListChecks />}
            tone={api.stats.queued > 0 ? 'warning' : 'default'}
            loading={api.statsLoading}
            hint={api.stats.nextInQueue ? `Próximo às ${formatTime(api.stats.nextInQueue)} · Ver fila` : 'Clique para ver a fila'}
          />
        </div>
        <StatCard
          title="Enviados hoje"
          value={api.stats.sentToday}
          icon={<Send />}
          tone="success"
          loading={api.statsLoading}
        />
        <StatCard
          title="Falhas hoje"
          value={api.stats.failedToday}
          icon={<AlertCircle />}
          tone={api.stats.failedToday > 0 ? 'destructive' : 'default'}
          loading={api.statsLoading}
          hint={api.stats.failedToday > 0 ? 'Veja na aba Mensagens e reenvie' : undefined}
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="h-11 w-full justify-start overflow-x-auto sm:w-auto" data-tour="reminders-tabs">
          <TabsTrigger value="agenda" className="min-h-9 gap-1.5">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Agenda
          </TabsTrigger>
          <TabsTrigger value="mensagens" className="min-h-9 gap-1.5">
            <MessageSquareText className="h-4 w-4" aria-hidden="true" />
            Mensagens
          </TabsTrigger>
          <TabsTrigger value="regras" className="min-h-9 gap-1.5">
            <BellRing className="h-4 w-4" aria-hidden="true" />
            Regras e frases
          </TabsTrigger>
          <TabsTrigger value="servicos" className="min-h-9 gap-1.5">
            <Tags className="h-4 w-4" aria-hidden="true" />
            Serviços
          </TabsTrigger>
          <TabsTrigger value="atividade" className="min-h-9 gap-1.5">
            <Activity className="h-4 w-4" aria-hidden="true" />
            Atividade
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="mt-0">
          <AppointmentsTab
            appointments={api.appointments}
            services={api.services}
            loading={api.appointmentsLoading}
            period={appointmentPeriod}
            onPeriodChange={setAppointmentPeriod}
            customDate={customDate}
            onCustomDateChange={setCustomDate}
            onOpenDispatchModal={() => {
              setRuleToDispatch(null);
              setDispatchDialogOpen(true);
            }}
            onSyncAllGoogle={() => gcal.puxarDoGoogle.mutate()}
            syncGoogleLoading={gcal.puxarDoGoogle.isPending}
            onCreate={() => setAppointmentForm({ open: true, appointment: null, isDuplicate: false })}
            onEdit={(appointment) => setAppointmentForm({ open: true, appointment, isDuplicate: false })}
            onDuplicate={(appointment) => setAppointmentForm({ open: true, appointment, isDuplicate: true })}
            onSendNow={(appointment) => {
              setSendingId(appointment.id);
              api.sendAppointmentNow.mutate(appointment.id, { onSettled: () => setSendingId(null) });
            }}
            onCancel={(appointment) => {
              api.setAppointmentStatus.mutate(
                { id: appointment.id, status: 'cancelado' },
                {
                  onSuccess: () => {
                    if (appointment.messageId) {
                      api.updateConfirmationStatus.mutate({ messageId: appointment.messageId, status: 'cancelado' });
                    }
                    if (appointment.googleEventId) {
                      gcal.sincronizarAgendamento.mutate(appointment.id);
                    }
                  },
                }
              );
            }}
            onReactivate={(appointment) => {
              api.setAppointmentStatus.mutate(
                { id: appointment.id, status: 'pendente' },
                {
                  onSuccess: () => {
                    if (appointment.messageId) {
                      api.updateConfirmationStatus.mutate({ messageId: appointment.messageId, status: 'aguardando' });
                    }
                    if (appointment.googleEventId) {
                      gcal.sincronizarAgendamento.mutate(appointment.id);
                    }
                  },
                }
              );
            }}
            onChangeAttendanceStatus={(appointment, status) => {
              api.updateAppointmentAttendanceStatus.mutate(
                {
                  id: appointment.id,
                  statusAgendamento: status,
                  statusEnvio:
                    status === 'CANCELADO'
                      ? 'cancelado'
                      : appointment.status === 'cancelado'
                      ? 'pendente'
                      : appointment.status,
                },
                {
                  onSuccess: () => {
                    if (appointment.messageId) {
                      const mapConf =
                        status === 'CONFIRMADO'
                          ? 'confirmado'
                          : status === 'CANCELADO'
                          ? 'cancelado'
                          : status === 'REMARCAR'
                          ? 'remarcar'
                          : 'aguardando';
                      api.updateConfirmationStatus.mutate({ messageId: appointment.messageId, status: mapConf });
                    }
                    if (appointment.googleEventId) {
                      gcal.sincronizarAgendamento.mutate(appointment.id);
                    }
                  },
                }
              );
            }}
            onDelete={setAppointmentToDelete}
            onOpenMessage={showMessage}
            onSyncGoogle={(appointment) => gcal.sincronizarAgendamento.mutate(appointment.id)}
            onMarkAsSent={(appointment) => {
              if (appointment.messageId) {
                api.markMessageAsSent.mutate({ messageId: appointment.messageId });
              }
            }}
            onUnlockQueue={(action) => api.unlockQueue.mutate(action)}
            unlockQueueLoading={api.unlockQueue.isPending}
            onUnlockAppointment={(appointment, action) =>
              api.unlockAppointment.mutate({ appointmentId: appointment.id, action })
            }
            sendingId={sendingId}
          />
        </TabsContent>

        <TabsContent value="mensagens" className="mt-0">
          <MessagesTab
            messages={api.messages}
            loading={api.messagesLoading}
            period={messagePeriod}
            onPeriodChange={setMessagePeriod}
            onOpen={(message) => setOpenMessageId(message.id)}
            onRefresh={api.refreshAll}
            onProcessQueue={() => api.processQueue.mutate()}
            processQueuePending={api.processQueue.isPending}
            onUnlockQueue={(action) => api.unlockQueue.mutate(action)}
            unlockQueueLoading={api.unlockQueue.isPending}
          />
        </TabsContent>

        <TabsContent value="regras" className="mt-0">
          <RulesTab
            configurations={api.configurations}
            services={api.services}
            clinicName={clinicName}
            loading={api.configurationsLoading}
            togglePending={api.toggleReminder.isPending}
            onCreate={() => setRuleForm({ open: true, rule: null, tab: 'geral' })}
            onEdit={(rule, initialTab = 'geral') => setRuleForm({ open: true, rule, tab: initialTab })}
            onDuplicate={(rule) =>
              setRuleForm({
                open: true,
                rule: { ...rule, id: 0, name: `${rule.name} (cópia)` },
                tab: 'geral',
              })
            }
            onToggle={(rule, enabled) => api.toggleReminder.mutate({ id: rule.id, enabled })}
            onDispatch={(rule) => {
              setRuleToDispatch(rule);
              setDispatchDialogOpen(true);
            }}
            onTest={setTestRule}
            onDelete={setRuleToDelete}
          />
        </TabsContent>

        <TabsContent value="servicos" className="mt-0">
          <ServicesTab
            services={api.services}
            configurations={api.configurations}
            uncategorized={uncategorizedServices}
            loading={api.servicesLoading}
            saving={api.saveService.isPending}
            onSave={(input) => api.saveService.mutateAsync(input).catch(() => undefined)}
            onDelete={setServiceToDelete}
          />
        </TabsContent>

        <TabsContent value="atividade" className="mt-0">
          <ActivityTab
            events={api.events}
            messages={api.messages}
            loading={api.eventsLoading}
            onOpenMessage={showMessage}
          />
        </TabsContent>
      </Tabs>

      <ReminderFormDialog
        open={ruleForm.open}
        onOpenChange={(open) => setRuleForm((state) => ({ ...state, open }))}
        reminder={ruleForm.rule}
        initialTab={ruleForm.tab}
        services={api.services}
        defaultExamples={defaultExamples.data ?? []}
        clinicName={clinicName}
        isPending={api.createReminder.isPending || api.updateReminder.isPending}
        onSubmit={saveRule}
        previewPending={api.previewAi.isPending}
        onPreview={(input) => api.previewAi.mutateAsync(input)}
      />

      <AppointmentFormDialog
        open={appointmentForm.open}
        onOpenChange={(open) => setAppointmentForm((state) => ({ ...state, open }))}
        appointment={appointmentForm.appointment}
        isDuplicate={appointmentForm.isDuplicate}
        services={api.services}
        configurations={api.configurations}
        isPending={api.saveAppointment.isPending}
        onSubmit={(input) =>
          api.saveAppointment.mutate(
            { id: appointmentForm.isDuplicate ? undefined : appointmentForm.appointment?.id, input },
            { onSuccess: () => setAppointmentForm((state) => ({ ...state, open: false })) }
          )
        }
      />

      <MessageDetailDialog
        message={openMessage}
        configurations={api.configurations}
        clinicName={clinicName}
        onOpenChange={(open) => !open && setOpenMessageId(null)}
        onResend={(message) => api.resendMessage.mutate(message.id)}
        onCancel={(message) => api.cancelMessage.mutate(message.id)}
        onSendDirect={(message, text, botoesConfirmacao, clinic) =>
          api.sendDirectWhatsApp.mutateAsync({
            messageId: message.id,
            phone: message.phone,
            text,
            botoesConfirmacao,
            clinicName: clinic || clinicName,
          })
        }
        onMarkAsSent={(message, text) =>
          api.markMessageAsSent.mutate({ messageId: message.id, text })
        }
        onUnlockMessage={(messageId, action) => {
          if (action === 'enviado') {
            api.markMessageAsSent.mutate({ messageId });
          } else {
            api.unlockQueue.mutate(action);
          }
        }}
        resendPending={api.resendMessage.isPending}
        cancelPending={api.cancelMessage.isPending}
        sendDirectPending={api.sendDirectWhatsApp.isPending}
        markAsSentPending={api.markMessageAsSent.isPending}
        onUpdateConfirmation={(messageId, status) => {
          api.updateConfirmationStatus.mutate({ messageId, status });
          const apt = api.appointments.find((a) => a.messageId === messageId);
          if (apt?.googleEventId) {
            gcal.sincronizarAgendamento.mutate(apt.id);
          }
        }}
        confirmationPending={api.updateConfirmationStatus.isPending}
      />

      <ReminderSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={api.settings}
        isPending={api.updateSettings.isPending}
        onSubmit={(input) =>
          api.updateSettings.mutate(input, { onSuccess: () => setSettingsOpen(false) })
        }
      />

      <GoogleCalendarDialog
        open={googleCalendarOpen}
        onOpenChange={setGoogleCalendarOpen}
      />

      <TestSendDialog
        rule={testRule}
        defaultPhone={api.settings?.testPhone ?? null}
        isPending={api.sendTest.isPending}
        onOpenChange={(open) => !open && setTestRule(null)}
        onSubmit={(phone) =>
          testRule &&
          api.sendTest.mutate(
            { configurationId: testRule.id, phone },
            { onSuccess: () => setTestRule(null) }
          )
        }
      />

      <SpreadsheetImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Importar agenda"
        description="Traga a planilha da agenda (mesmo formato da Pet com Pet). Telefones com @s.whatsapp.net são aceitos; status CONFIRMADO fica aguardando o lembrete e ENVIADO entra como já enviado. O serviço é ligado à categoria de mesmo nome."
        configurationLabel="Regra de lembrete"
        configurations={api.configurations.map((configuration) => ({
          id: configuration.id,
          name: configuration.name,
        }))}
        requiredColumns={['Data Agendada', 'Nome Cliente', 'Telefone']}
        parseFile={parseReminderSpreadsheet}
        onImport={(configurationId, rows) => api.importDeliveries.mutateAsync({ configurationId, rows })}
        onDownloadTemplate={() => exportReminderRows(true)}
      />

      <AlertDialog open={confirmAutoSend} onOpenChange={setConfirmAutoSend}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ligar o envio automático?</AlertDialogTitle>
            <AlertDialogDescription>
              A partir de agora, no horário de cada regra ativa, os tutores da agenda recebem o
              lembrete pelo WhatsApp sem ninguém precisar clicar.{' '}
              {api.stats.tomorrowPending > 0
                ? `Hoje isso inclui ${api.stats.tomorrowPending} atendimento(s) de amanhã.`
                : ''}{' '}
              Faça um "Enviar teste" antes, se ainda não fez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Agora não</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => api.updateSettings.mutate({ autoSend: true })}
            >
              Ligar envio automático
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DispatchRemindersDialog
        open={dispatchDialogOpen}
        onOpenChange={(open) => {
          setDispatchDialogOpen(open);
          if (!open) setRuleToDispatch(null);
        }}
        appointments={api.appointments}
        configurations={api.configurations}
        initialConfigId={ruleToDispatch?.id}
        isPending={api.dispatchDate.isPending}
        onDispatch={(targetDate, configurationId) => {
          api.dispatchDate.mutate(
            { targetDate, configurationId },
            {
              onSuccess: () => {
                setDispatchDialogOpen(false);
                setRuleToDispatch(null);
                setTab('mensagens');
              },
            }
          );
        }}
      />

      <AlertDialog open={!!ruleToDelete} onOpenChange={(open) => !open && setRuleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta regra?</AlertDialogTitle>
            <AlertDialogDescription>
              A regra “{ruleToDelete?.name}” deixa de enviar lembretes. Os atendimentos ligados a ela
              ficam sem regra e o histórico de envios é preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={api.deleteReminder.isPending}
              onClick={() =>
                ruleToDelete &&
                api.deleteReminder.mutate(ruleToDelete.id, { onSuccess: () => setRuleToDelete(null) })
              }
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!appointmentToDelete} onOpenChange={(open) => !open && setAppointmentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este atendimento?</AlertDialogTitle>
            <AlertDialogDescription>
              O atendimento de {appointmentToDelete?.ownerName} sai da agenda. Para só não enviar o
              lembrete, prefira “Cancelar atendimento”, que mantém o registro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={api.deleteAppointment.isPending}
              onClick={() =>
                appointmentToDelete &&
                api.deleteAppointment.mutate(appointmentToDelete.id, {
                  onSuccess: () => setAppointmentToDelete(null),
                })
              }
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!serviceToDelete} onOpenChange={(open) => !open && setServiceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover o serviço “{serviceToDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Os atendimentos mantêm o nome do serviço, mas ficam sem categoria. Para só esconder o
              serviço do cadastro, use o interruptor ao lado dele.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={api.deleteService.isPending}
              onClick={() =>
                serviceToDelete &&
                api.deleteService.mutate(serviceToDelete.id, { onSuccess: () => setServiceToDelete(null) })
              }
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
};

export default RemindersPage;
