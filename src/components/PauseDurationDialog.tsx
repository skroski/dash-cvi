import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Ban, Pause } from 'lucide-react';
import { capitalizar, useIdentidadeAtendimento } from '@/hooks/useIdentidadeAtendimento';

interface PauseDurationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (duration: number | null) => void;
  onBlock?: (phoneNumber: string) => void;
  phoneNumber?: string;
}

const PauseDurationDialog = ({
  isOpen,
  onOpenChange,
  onConfirm,
  onBlock,
  phoneNumber,
}: PauseDurationDialogProps) => {
  const { rotuloAssistente } = useIdentidadeAtendimento();
  const handlePause = () => {
    // Mantém a janela de oito horas para atendimento humano
    onConfirm(8);
  };

  const handleBlock = () => {
    if (onBlock && phoneNumber) {
      if (confirm(`Deseja realmente BLOQUEAR PERMANENTEMENTE o número ${phoneNumber}? ${capitalizar(rotuloAssistente)} nunca mais responderá mensagens deste número.`)) {
        onBlock(phoneNumber);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pause className="h-5 w-5 text-amber-500" />
            Controle do Bot para este contato
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground pt-1 leading-relaxed">
            Escolha se deseja pausar temporariamente para atendimento da equipe humana ou bloquear permanentemente (no caso de operadoras, robôs, spams ou URAs).
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-2.5">
          <div className="p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300">
            <strong>Pausar Bot (8 horas):</strong> Use quando um atendente humano for conversar com o tutor. Após 8 horas ou quando reativado, o bot volta a responder.
          </div>
          <div className="p-3 rounded-lg border bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40 text-xs text-red-800 dark:text-red-300">
            <strong>Bloquear Número (Blacklist):</strong> Use para números de operadoras (TIM, Claro), robôs ou spams. {capitalizar(rotuloAssistente)} <u>nunca mais</u> responderá e cancelará mensagens pendentes.
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>

          {onBlock && phoneNumber && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="gap-1.5 bg-red-600 hover:bg-red-700"
              onClick={handleBlock}
            >
              <Ban className="h-4 w-4" />
              Bloquear Permanentemente
            </Button>
          )}

          <Button type="button" size="sm" onClick={handlePause} className="gap-1.5">
            <Pause className="h-4 w-4" />
            Pausar (8h)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PauseDurationDialog;
