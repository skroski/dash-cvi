import { useState, useMemo } from 'react';
import {
  Calendar,
  CalendarDays,
  CalendarClock,
  Clock,
  Loader2,
  Send,
  ShieldCheck,
  Users,
} from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ReminderConfiguration,
  ReminderDelivery,
} from '@/types/reminder';
import {
  proximaSegundaFeiraInSaoPaulo,
  todayInSaoPaulo,
} from '@/hooks/useReminders';
import { formatDateBR } from './reminderUi';
import { cn } from '@/lib/utils';

interface DispatchRemindersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDispatch: (targetDate: string, configurationId?: number) => void;
  isPending: boolean;
  appointments: ReminderDelivery[];
  configurations: ReminderConfiguration[];
  initialDate?: string;
  initialConfigId?: number;
}

export function DispatchRemindersDialog({
  open,
  onOpenChange,
  onDispatch,
  isPending,
  appointments,
  configurations,
  initialDate,
  initialConfigId,
}: DispatchRemindersDialogProps) {
  const today = todayInSaoPaulo();
  const tomorrow = todayInSaoPaulo(1);
  const monday = proximaSegundaFeiraInSaoPaulo();

  // Tipo de seleção rápida ou personalizada
  const [optionType, setOptionType] = useState<'amanha' | 'segunda' | 'hoje' | 'personalizado'>(
    initialDate === monday
      ? 'segunda'
      : initialDate === today
      ? 'hoje'
      : initialDate && initialDate !== tomorrow
      ? 'personalizado'
      : 'amanha'
  );
  const [customDate, setCustomDate] = useState(initialDate || monday);
  const [selectedConfigId, setSelectedConfigId] = useState<string>(
    initialConfigId ? String(initialConfigId) : 'todas'
  );

  // Data alvo final calculada
  const targetDate = useMemo(() => {
    switch (optionType) {
      case 'amanha':
        return tomorrow;
      case 'segunda':
        return monday;
      case 'hoje':
        return today;
      case 'personalizado':
        return customDate || tomorrow;
      default:
        return tomorrow;
    }
  }, [optionType, tomorrow, monday, today, customDate]);

  // Contagem de agendamentos e tutores únicos para a data alvo
  const targetSummary = useMemo(() => {
    const apps = appointments.filter((app) => {
      if (app.appointmentDate !== targetDate) return false;
      if (app.status === 'cancelado') return false;
      if (selectedConfigId !== 'todas' && app.configurationId !== Number(selectedConfigId)) {
        return false;
      }
      return true;
    });

    const tutoresUnicos = new Set(
      apps.filter((a) => a.phoneKey).map((a) => a.phoneKey)
    );

    const pendentes = apps.filter((a) => a.status === 'pendente' && !a.messageId);

    return {
      total: apps.length,
      tutores: tutoresUnicos.size,
      pendentes: pendentes.length,
    };
  }, [appointments, targetDate, selectedConfigId]);

  const handleConfirm = () => {
    if (!targetDate) return;
    const configId = selectedConfigId === 'todas' ? undefined : Number(selectedConfigId);
    onDispatch(targetDate, configId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Disparar Lembretes Agora</DialogTitle>
              <DialogDescription>
                Escolha o dia dos atendimentos para enfileirar e enviar pelo WhatsApp hoje.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Opções de Data Alvo */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">
              Qual dia de atendimentos você quer enviar?
            </Label>
            <RadioGroup
              value={optionType}
              onValueChange={(val) => setOptionType(val as any)}
              className="grid gap-2"
            >
              {/* Opção Amanhã */}
              <label
                className={cn(
                  'flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-all',
                  optionType === 'amanha'
                    ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="amanha" id="opt-amanha" />
                  <div>
                    <p className="text-sm font-medium">Amanhã</p>
                    <p className="text-xs text-muted-foreground">{formatDateBR(tomorrow, true)}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {appointments.filter((a) => a.appointmentDate === tomorrow && a.status !== 'cancelado').length} agendamento(s)
                </Badge>
              </label>

              {/* Opção Segunda-feira */}
              <label
                className={cn(
                  'flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-all',
                  optionType === 'segunda'
                    ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="segunda" id="opt-segunda" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium">Segunda-feira</p>
                      <Badge variant="outline" className="border-sky-500/30 text-sky-600 dark:text-sky-400 text-[10px] py-0 h-4">
                        Próxima
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDateBR(monday, true)}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {appointments.filter((a) => a.appointmentDate === monday && a.status !== 'cancelado').length} agendamento(s)
                </Badge>
              </label>

              {/* Opção Hoje */}
              <label
                className={cn(
                  'flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-all',
                  optionType === 'hoje'
                    ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="hoje" id="opt-hoje" />
                  <div>
                    <p className="text-sm font-medium">Hoje</p>
                    <p className="text-xs text-muted-foreground">{formatDateBR(today, true)}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {appointments.filter((a) => a.appointmentDate === today && a.status !== 'cancelado').length} agendamento(s)
                </Badge>
              </label>

              {/* Opção Outro dia digitado / selecionado */}
              <label
                className={cn(
                  'flex flex-col gap-2 rounded-lg border p-3 cursor-pointer transition-all',
                  optionType === 'personalizado'
                    ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="personalizado" id="opt-personalizado" />
                    <p className="text-sm font-medium">Outro dia (digitar ou selecionar)</p>
                  </div>
                  {optionType === 'personalizado' && customDate && (
                    <Badge variant="secondary" className="text-xs">
                      {appointments.filter((a) => a.appointmentDate === customDate && a.status !== 'cancelado').length} agendamento(s)
                    </Badge>
                  )}
                </div>

                {optionType === 'personalizado' && (
                  <div className="mt-1 flex items-center gap-2 pl-7">
                    <Input
                      type="date"
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="h-9 w-full font-mono text-sm"
                      autoFocus
                    />
                  </div>
                )}
              </label>
            </RadioGroup>
          </div>

          {/* Seleção de Regra (Opcional) */}
          {configurations.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Regra de lembrete:</Label>
              <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as regras ativas</SelectItem>
                  {configurations.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} ({c.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Resumo da Ação e Anti-Duplicação */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between font-medium text-foreground">
              <span>Data dos atendimentos:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {formatDateBR(targetDate, true)}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Atendimentos encontrados:</span>
              <span className="font-medium text-foreground">{targetSummary.total}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Tutores a notificar (1 msg por tutor):</span>
              <span className="font-medium text-foreground">{targetSummary.tutores}</span>
            </div>

            <div className="pt-2 border-t border-border/50 flex items-start gap-1.5 text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Garantia anti-duplicação:</strong> tutores com múltiplos pets/exames recebem apenas 1 mensagem citando todos. Tutores que já receberam mensagem hoje não serão incomodados novamente.
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || !targetDate}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Disparar Agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DispatchRemindersDialog;

