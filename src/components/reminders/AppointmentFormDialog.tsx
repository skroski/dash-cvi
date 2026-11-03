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
  services,
  configurations,
  isPending,
  onSubmit,
}: AppointmentFormDialogProps) => {
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [petName, setPetName] = useState('');
  const [serviceId, setServiceId] = useState<string>('');
  const [serviceText, setServiceText] = useState('');
  const [configurationId, setConfigurationId] = useState<string>(AUTO);
  const [appointmentDate, setAppointmentDate] = useState(todayInSaoPaulo(1));
  const [appointmentTime, setAppointmentTime] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOwnerName(appointment?.ownerName ?? '');
    setPhone(appointment ? normalizePhoneDigits(appointment.phone) : '');
    setPetName(appointment?.petName ?? '');
    setServiceId(appointment?.serviceId ? String(appointment.serviceId) : '');
    setServiceText(appointment?.serviceText ?? '');
    setConfigurationId(appointment?.configurationId ? String(appointment.configurationId) : AUTO);
    setAppointmentDate(appointment?.appointmentDate ?? todayInSaoPaulo(1));
    setAppointmentTime(appointment?.appointmentTime ?? '');
    setDescription(appointment?.description ?? '');
    setSubmitted(false);
  }, [open, appointment]);

  const phoneDigits = normalizePhoneDigits(phone);
  const selectedServiceId = serviceId ? Number(serviceId) : null;
  const chosenRule =
    configurationId === AUTO
      ? ruleForService(configurations, selectedServiceId)
      : configurations.find((configuration) => configuration.id === Number(configurationId)) ?? null;
  const sendDay = reminderDate(appointmentDate, chosenRule);
  const today = todayInSaoPaulo();

  const errors = {
    ownerName: ownerName.trim().length === 0,
    phone: phoneDigits.length < 10 || phoneDigits.length > 13,
    service: !serviceId && !appointment?.service,
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
      ownerName,
      phone: phoneDigits.length <= 11 ? `55${phoneDigits}` : phoneDigits,
      petName: petName.trim() || null,
      serviceId: selectedServiceId,
      serviceText: serviceText.trim() || null,
      configurationId: configurationId === AUTO ? chosenRule?.id ?? null : Number(configurationId),
      appointmentDate,
      appointmentTime: appointmentTime || null,
      description: description.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{appointment ? 'Editar agendamento' : 'Novo agendamento'}</DialogTitle>
          <DialogDescription>
            O tutor recebe o lembrete pelo WhatsApp conforme a regra escolhida.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="appointment-owner">Nome do tutor</Label>
              <Input
                id="appointment-owner"
                value={ownerName}
                onChange={(event) => setOwnerName(event.target.value)}
                className="min-h-11"
                aria-invalid={submitted && errors.ownerName}
                autoComplete="off"
              />
              {submitted && errors.ownerName && (
                <p className="text-sm text-destructive" role="alert">Informe o nome do tutor.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appointment-phone">WhatsApp (com DDD)</Label>
              <Input
                id="appointment-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                placeholder="(61) 99999-0000"
                className="min-h-11 tabular-nums"
                aria-invalid={submitted && errors.phone}
                autoComplete="off"
              />
              {submitted && errors.phone && (
                <p className="text-sm text-destructive" role="alert">Informe um número com DDD.</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="appointment-pet">Pet(s)</Label>
              <Input
                id="appointment-pet"
                value={petName}
                onChange={(event) => setPetName(event.target.value)}
                placeholder="Ex.: Toby e Mel"
                className="min-h-11"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appointment-service">Serviço</Label>
              <Select
                value={serviceId}
                onValueChange={(value) => {
                  setServiceId(value);
                  // O texto próprio era da categoria anterior.
                  setServiceText('');
                }}
              >
                <SelectTrigger
                  id="appointment-service"
                  className="min-h-11"
                  aria-invalid={submitted && errors.service}
                >
                  <SelectValue placeholder={appointment?.service ?? 'Escolha o serviço'} />
                </SelectTrigger>
                <SelectContent>
                  {activeServices.map((service) => (
                    <SelectItem key={service.id} value={String(service.id)}>
                      <ServiceBadge name={service.name} service={service} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {submitted && errors.service && (
                <p className="text-sm text-destructive" role="alert">Escolha o serviço.</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="appointment-service-text">Como o serviço aparece na mensagem (opcional)</Label>
            <Input
              id="appointment-service-text"
              value={serviceText}
              onChange={(event) => setServiceText(event.target.value)}
              placeholder={
                activeServices.find((service) => service.id === selectedServiceId)?.messageText ??
                activeServices.find((service) => service.id === selectedServiceId)?.name ??
                appointment?.service ??
                'Ex.: consulta veterinária'
              }
              className="min-h-11"
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">
              Em branco: usa o texto da categoria. Escreva como na frase: "Hoje é dia de{' '}
              {serviceText.trim() ||
                activeServices.find((service) => service.id === selectedServiceId)?.messageText ||
                activeServices.find((service) => service.id === selectedServiceId)?.name ||
                'consulta veterinária'}
              ."
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="appointment-date">Data do atendimento</Label>
              <Input
                id="appointment-date"
                type="date"
                value={appointmentDate}
                min={appointment ? undefined : today}
                onChange={(event) => setAppointmentDate(event.target.value)}
                className="min-h-11 tabular-nums"
                aria-invalid={submitted && errors.date}
              />
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

          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {appointment ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentFormDialog;
