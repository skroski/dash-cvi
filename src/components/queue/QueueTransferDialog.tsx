import { useState } from 'react';
import { ArrowRightLeft, DoorOpen, Tag, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { QueueItem, QueueRoom, QueueService } from '@/types/vetbotsModules';

interface QueueTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: QueueItem | null;
  services: QueueService[];
  rooms: QueueRoom[];
  onConfirmTransfer: (data: {
    itemId: string;
    newRoomId?: string | null;
    newServiceId?: string | null;
    reason?: string | null;
  }) => Promise<void>;
}

export default function QueueTransferDialog({
  open,
  onOpenChange,
  item,
  services,
  rooms,
  onConfirmTransfer,
}: QueueTransferDialogProps) {
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [selectedService, setSelectedService] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Inicializa com os valores atuais do item quando aberto
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && item) {
      setSelectedRoom(item.roomId || '');
      setSelectedService(item.serviceId || '');
      setReason('');
    }
    onOpenChange(isOpen);
  };

  const handleTransfer = async () => {
    if (!item) return;

    try {
      setSubmitting(true);
      await onConfirmTransfer({
        itemId: item.id,
        newRoomId: selectedRoom || null,
        newServiceId: selectedService || null,
        reason: reason.trim() || null,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  if (!item) return null;

  const currentService = services.find((s) => s.id === item.serviceId);
  const currentRoom = rooms.find((r) => r.id === item.roomId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-base">Transferir Atendimento</DialogTitle>
              <DialogDescription className="text-xs">
                Encaminhe a senha <strong className="text-foreground">{item.ticket}</strong> ({item.petName || item.tutorName}) para outra sala ou fila.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          {/* Informações atuais */}
          <div className="rounded-lg border bg-muted/30 p-2.5 text-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Fila atual:</span>
              <span className="font-semibold text-foreground">
                {currentService?.name || currentService?.nome || 'Não definida'}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Sala / Consultório atual:</span>
              <span className="font-semibold text-foreground">
                {currentRoom?.name || currentRoom?.nome || 'Sem sala'}
              </span>
            </div>
          </div>

          {/* Nova Fila / Tipo de Atendimento */}
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              Transferir para Fila / Tipo de Atendimento
            </Label>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecione a nova fila" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.name || s.nome} (Prefixo {s.prefix || s.prefixo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nova Sala / Consultório */}
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1.5">
              <DoorOpen className="h-3.5 w-3.5 text-muted-foreground" />
              Transferir para Sala / Consultório
            </Label>
            <Select value={selectedRoom} onValueChange={setSelectedRoom}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecione o consultório" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id} className="text-xs">
                    {r.name || r.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Motivo da Transferência */}
          <div className="space-y-1">
            <Label className="text-xs">Motivo da transferência (opcional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Encaminhado para exame, troca de consultório..."
              className="h-9 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleTransfer}
            disabled={submitting}
            className="gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            {submitting ? 'Transferindo...' : 'Confirmar Transferência'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
