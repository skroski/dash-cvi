import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, CircleDashed, Loader2, RefreshCw, XCircle } from 'lucide-react';
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
import { useReminderDiagnostics } from '@/hooks/useReminders';
import { cn } from '@/lib/utils';
import { ReminderSettings } from '@/types/reminder';
import { formatDateTime, formatPhone } from './reminderUi';

interface ReminderSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ReminderSettings | null;
  isPending: boolean;
  onSubmit: (input: { clinicName: string; testPhone: string | null; pausaIaMinutos?: number }) => void;
}

const CheckItem = ({
  ok,
  label,
  help,
}: {
  ok: boolean | null;
  label: string;
  help: string;
}) => {
  const Icon = ok === null ? CircleDashed : ok ? CheckCircle2 : XCircle;
  return (
    <li className="flex items-start gap-2">
      <Icon
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          ok === null ? 'text-muted-foreground' : ok ? 'text-success' : 'text-destructive'
        )}
        aria-label={ok === null ? 'Não verificado' : ok ? 'OK' : 'Pendente'}
      />
      <div>
        <p className="text-sm font-medium">{label}</p>
        {!ok && <p className="text-xs text-muted-foreground">{help}</p>}
      </div>
    </li>
  );
};

const ReminderSettingsDialog = ({
  open,
  onOpenChange,
  settings,
  isPending,
  onSubmit,
}: ReminderSettingsDialogProps) => {
  const [clinicName, setClinicName] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [pausaIaMinutos, setPausaIaMinutos] = useState<number>(1.5);
  const diagnostics = useReminderDiagnostics(open);

  useEffect(() => {
    if (!open) return;
    setClinicName(settings?.clinicName ?? 'C.V.I. - Centro Veterinário Integrado');
    setTestPhone(settings?.testPhone ? formatPhone(settings.testPhone) : '');
    setPausaIaMinutos(settings?.pausaIaMinutos ?? 1.5);
  }, [open, settings]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clinicName.trim()) return;
    onSubmit({
      clinicName,
      testPhone: testPhone.trim() || null,
      pausaIaMinutos: Number(pausaIaMinutos) || 1.5,
    });
  };

  const data = diagnostics.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajustes dos lembretes</DialogTitle>
          <DialogDescription>
            Dados usados nas mensagens e situação da integração com WhatsApp e IA.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="settings-clinic">Nome da clínica nas mensagens</Label>
            <Input
              id="settings-clinic"
              value={clinicName}
              onChange={(event) => setClinicName(event.target.value)}
              className="min-h-11"
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">Preenche a variável {'{{clinica}}'}.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-phone">WhatsApp para testes</Label>
            <Input
              id="settings-phone"
              value={testPhone}
              onChange={(event) => setTestPhone(event.target.value)}
              inputMode="tel"
              placeholder="(61) 99999-0000"
              className="min-h-11 tabular-nums"
            />
            <p className="text-xs text-muted-foreground">
              Número sugerido no botão "Enviar teste". Use um número da equipe, nunca de cliente.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-pausa-ia">Pausa do bot/IA após envio interativo (minutos)</Label>
            <Input
              id="settings-pausa-ia"
              type="number"
              step="0.5"
              min="0"
              max="120"
              value={pausaIaMinutos}
              onChange={(event) => setPausaIaMinutos(Number(event.target.value))}
              className="min-h-11 tabular-nums"
            />
            <p className="text-xs text-muted-foreground">
              Tempo em minutos em que a IA fica bloqueada no Redis para o número após receber botões de confirmação (padrão: 1.5 minutos = 90 segundos).
            </p>
          </div>

          <section className="rounded-md border p-3" aria-label="Situação da integração">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Situação da integração</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => diagnostics.refetch()}
                aria-label="Verificar de novo"
              >
                <RefreshCw className={cn('h-4 w-4', diagnostics.isFetching && 'animate-spin')} />
              </Button>
            </div>
            {diagnostics.isError ? (
              <p className="text-sm text-destructive">
                Não foi possível verificar. A migração de lembretes foi aplicada?
              </p>
            ) : (
              <ul className="space-y-2.5">
                <CheckItem
                  ok={data ? data.uazapi : null}
                  label="WhatsApp (uazapi) configurado"
                  help="Cadastre UAZAPI_SERVER_URL e UAZAPI_INSTANCE_TOKEN nos segredos da edge function."
                />
                <CheckItem
                  ok={data ? data.openai : null}
                  label="IA (OpenAI) configurada"
                  help="Cadastre OPENAI_API_KEY. Sem ela, as mensagens usam as frases de exemplo."
                />
                <CheckItem
                  ok={data ? data.vaultConfigured && !!data.cronSecret : null}
                  label="Segredo do agendador"
                  help="Cadastre LEMBRETES_CRON_SECRET na edge function e o mesmo valor no Vault."
                />
                <CheckItem
                  ok={data ? data.cronActive : null}
                  label="Agendador ativo (a cada minuto)"
                  help="Rode supabase/scripts/lembretes_ativar_cron.sql no SQL Editor."
                />
              </ul>
            )}
            {data && (
              <p className="mt-3 text-xs text-muted-foreground">
                Última execução do agendador: {data.cronLastRun ? formatDateTime(data.cronLastRun) : 'nunca'} ·
                Fila: {data.pending} aguardando, {data.processing} enviando.
              </p>
            )}
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button type="submit" className="min-h-11" disabled={isPending || !clinicName.trim()}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReminderSettingsDialog;
