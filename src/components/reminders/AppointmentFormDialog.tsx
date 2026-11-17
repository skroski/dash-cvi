import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Info, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { normalizePhoneDigits, todayInSaoPaulo } from '@/hooks/useReminders';
import {
  ReminderAppointmentInput,
  ReminderConfiguration,
  ReminderDelivery,
  ReminderService,
} from '@/types/reminder';
import { ServiceBadge, formatDateBR } from './reminderUi';

interface AppointmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment?: ReminderDelivery | null;
  isDuplicate?: boolean;
  services: ReminderService[];
  configurations: ReminderConfiguration[];
  isPending: boolean;
  onSubmit: (input: ReminderAppointmentInput) => void;
}

const AUTO = 'auto';

/** Mesma escolha que o banco faz quando o agendamento chega sem regra. */
function ruleForService(configurations: ReminderConfiguration[], serviceId: number | null) {
  const active = configurations.filter((configuration) => configuration.enabled);
  return (
    active.find((configuration) => serviceId !== null && configuration.serviceIds.includes(serviceId)) ??
    active.find((configuration) => configuration.serviceIds.length === 0) ??
    null
  );
}

function reminderDate(appointmentDate: string, rule: ReminderConfiguration | null) {
  if (!appointmentDate || !rule) return null;
  const date = new Date(`${appointmentDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - rule.daysInAdvance);
  return date.toISOString().slice(0, 10);
}

const AppointmentFormDialog = ({
  open,
  onOpenChange,
  appointment,
  isDuplicate = false,
  services,
  configurations,
  isPending,
  onSubmit,
}: AppointmentFormDialogProps) => {
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [petName, setPetName] = useState('');
  const [serviceId, setServiceId] = useState<string>('');
  const [configurationId, setConfigurationId] = useState<string>(AUTO);
  const [appointmentDate, setAppointmentDate] = useState(todayInSaoPaulo(1));
  const [appointmentTime, setAppointmentTime] = useState('');
  const [description, setDescription] = useState('');
  const [appointmentStatus, setAppointmentStatus] = useState<string>('AGENDADO');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOwnerName(appointment?.ownerName ?? '');
    setPhone(appointment ? normalizePhoneDigits(appointment.phone) : '');
    setPetName(appointment?.petName ?? '');
    setServiceId(appointment?.serviceId ? String(appointment.serviceId) : '');
    setConfigurationId(appointment?.configurationId ? String(appointment.configurationId) : AUTO);
    setAppointmentStatus(appointment?.appointmentStatus ?? 'AGENDADO');

    // Se for duplicação de um atendimento que já passou, sugere amanhã por padrão
    const initialDate = appointment?.appointmentDate
      ? (isDuplicate && appointment.appointmentDate < todayInSaoPaulo()
          ? todayInSaoPaulo(1)
          : appointment.appointmentDate)
      : todayInSaoPaulo(1);
    setAppointmentDate(initialDate);

    setAppointmentTime(appointment?.appointmentTime ?? '');
    setDescription(appointment?.description ?? '');
    setSubmitted(false);
  }, [open, appointment, isDuplicate]);

  const phoneDigits = normalizePhoneDigits(phone);
  const selectedServiceId = serviceId ? Number(serviceId) : null;
  const chosenRule =
    configurationId === AUTO
      ? ruleForService(configurations, selectedServiceId)
      : configurations.find((configuration) => configuration.id === Number(configurationId)) ?? null;
  const sendDay = reminderDate(appointmentDate, chosenRule);
  const today = todayInSaoPaulo();

  const errors = {
    phone: phoneDigits.length < 10 || phoneDigits.length > 13,
    date: !/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate),
  };
  const isValid = !Object.values(errors).some(Boolean);

  const activeServices = useMemo(
    () => services.filter((service) => service.active || service.id === appointment?.serviceId),
    [services, appointment?.serviceId]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (!isValid || isPending) return;
    onSubmit({
      ownerName: ownerName.trim() || 'Tutor',
      phone: phoneDigits.length <= 11 ? `55${phoneDigits}` : phoneDigits,
      petName: petName.trim() || null,
      serviceId: selectedServiceId,
      serviceText: selectedServiceId ? activeServices.find((s) => s.id === selectedServiceId)?.name ?? null : null,
      configurationId: configurationId === AUTO ? chosenRule?.id ?? null : Number(configurationId),
      appointmentDate,
      appointmentTime: appointmentTime || null,
      description: description.trim() || null,
      appointmentStatus: isDuplicate ? 'AGENDADO' : appointmentStatus,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isDuplicate ? 'Duplicar agendamento' : appointment ? 'Editar agendamento' : 'Novo agendamento'}
          </DialogTitle>
          <DialogDescription>
            {isDuplicate
              ? 'Crie um novo agendamento a partir dos dados existentes. Altere data/horário se desejar.'
              : 'O tutor recebe o lembrete pelo WhatsApp conforme a regra escolhida.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="appointment-owner">Nome do tutor (opcional)</Label>
              <Input
                id="appointment-owner"
                value={ownerName}
                onChange={(event) => setOwnerName(event.target.value)}
                placeholder="Ex.: Carlos (opcional)"
                className="min-h-11"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appointment-phone">
                WhatsApp (com DDD) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="appointment-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                placeholder="(61) 99999-0000"
                className="min-h-11 tabular-nums"
                aria-invalid={submitted && errors.phone}
                autoComplete="off"
                required
              />
              {submitted && errors.phone && (
                <p className="text-sm text-destructive" role="alert">Informe um número com DDD válido.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="appointment-pet">Pet(s) (opcional)</Label>
              <Input
                id="appointment-pet"
                value={petName}
                onChange={(event) => setPetName(event.target.value)}
                placeholder="Ex.: Toby e Mel (opcional)"
                className="min-h-11"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appointment-service">Serviço (opcional)</Label>
              <Select
                value={serviceId || 'none'}
                onValueChange={(val) => setServiceId(val === 'none' ? '' : val)}
              >
                <SelectTrigger
                  id="appointment-service"
                  className="min-h-11"
                >
                  <SelectValue placeholder={appointment?.service ?? 'Escolha o serviço (opcional)'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">Sem serviço específico</span>
                  </SelectItem>
                  {activeServices.map((service) => (
                    <SelectItem key={service.id} value={String(service.id)}>
                      <ServiceBadge name={service.name} service={service} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="appointment-date">
                Data do atendimento <span className="text-destructive">*</span>
              </Label>
              <Input
                id="appointment-date"
                type="date"
                value={appointmentDate}
                min={appointment ? undefined : today}
                onChange={(event) => setAppointmentDate(event.target.value)}
                className="min-h-11 tabular-nums"
                aria-invalid={submitted && errors.date}
                required
              />
              {submitted && errors.date && (
                <p className="text-sm text-destructive" role="alert">Informe a data do atendimento.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appointment-time">Horário (opcional)</Label>
              <Input
                id="appointment-time"
                type="time"
                value={appointmentTime}
                onChange={(event) => setAppointmentTime(event.target.value)}
                className="min-h-11 tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appointment-rule">Regra de lembrete</Label>
            <Select value={configurationId} onValueChange={setConfigurationId}>
              <SelectTrigger id="appointment-rule" className="min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTO}>
                  Automática pelo serviço{chosenRule && configurationId === AUTO ? ` (${chosenRule.name})` : ''}
                </SelectItem>
                {configurations.map((configuration) => (
                  <SelectItem key={configuration.id} value={String(configuration.id)}>
                    {configuration.name}
                    {!configuration.enabled ? ' (pausada)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {chosenRule && sendDay
                ? sendDay < today
                  ? 'A data do lembrete já passou. Use "Enviar agora" na agenda se quiser avisar o tutor.'
                  : `O lembrete sai em ${formatDateBR(sendDay, true)}, a partir das ${chosenRule.sendTime}.`
                : 'Nenhuma regra ativa atende este serviço. Crie ou ative uma regra.'}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appointment-notes">Observação interna (opcional)</Label>
            <Textarea
              id="appointment-notes"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-16 resize-y"
              placeholder="Não vai na mensagem. Ex.: trazer exames anteriores."
            />
          </div>

          {appointment && !isDuplicate && (
            <div className="space-y-1.5">
              <Label htmlFor="appointment-status">Status do atendimento</Label>
              <Select value={appointmentStatus} onValueChange={setAppointmentStatus}>
                <SelectTrigger id="appointment-status" className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AGENDADO">Agendado (Padrão)</SelectItem>
                  <SelectItem value="CONFIRMADO">Confirmado pelo tutor</SelectItem>
                  <SelectItem value="CANCELADO">Cancelado</SelectItem>
                  <SelectItem value="REMARCAR">Remarcar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {isDuplicate ? 'Cadastrar cópia' : appointment ? 'Salvar alterações' : 'Cadastrar agendamento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentFormDialog;
