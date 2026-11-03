import { FormEvent, useEffect, useState } from 'react';
import { FlaskConical, Loader2 } from 'lucide-react';
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
import { normalizePhoneDigits } from '@/hooks/useReminders';
import { ReminderConfiguration } from '@/types/reminder';
import { formatPhone } from './reminderUi';

interface TestSendDialogProps {
  rule: ReminderConfiguration | null;
  defaultPhone: string | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (phone: string) => void;
}

const TestSendDialog = ({ rule, defaultPhone, isPending, onOpenChange, onSubmit }: TestSendDialogProps) => {
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (rule) setPhone(defaultPhone ? formatPhone(defaultPhone) : '');
  }, [rule, defaultPhone]);

  const digits = normalizePhoneDigits(phone);
  const valid = digits.length >= 10 && digits.length <= 13;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (valid && !isPending) onSubmit(digits);
  };

  return (
    <Dialog open={!!rule} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar teste</DialogTitle>
          <DialogDescription>
            Manda agora um lembrete da regra “{rule?.name}” com dados fictícios (tutora Mariana, pet
            Toby), do jeito que um cliente receberia. Não conta no limite de 1 por dia.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="test-phone">WhatsApp de destino</Label>
            <Input
              id="test-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              placeholder="(61) 99999-0000"
              className="min-h-11 tabular-nums"
              aria-invalid={phone.length > 0 && !valid}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Use o seu número ou de alguém da equipe.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11 gap-1.5" disabled={!valid || isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FlaskConical className="h-4 w-4" aria-hidden="true" />
              )}
              Enviar teste
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TestSendDialog;
