import React, { useState } from 'react';
import { GitCommit, Sparkles } from 'lucide-react';
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

interface PromptCommitModalProps {
  isOpen: boolean;
  onClose: () => void;
  versaoAtual: number;
  totalRegrasAtivas: number;
  totalRegrasModificadas?: number;
  onConfirm: (descricao: string) => Promise<void>;
  isSaving: boolean;
}

export const PromptCommitModal: React.FC<PromptCommitModalProps> = ({
  isOpen,
  onClose,
  versaoAtual,
  totalRegrasAtivas,
  onConfirm,
  isSaving,
}) => {
  const [descricao, setDescricao] = useState('');

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm(descricao.trim());
    setDescricao('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <GitCommit className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-semibold">
              Salvar Nova Versão (v{versaoAtual + 1})
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Esta ação compila todas as regras ativas e gera uma nova versão auditável no histórico. O
            assistente passa a utilizar esta versão imediatamente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleConfirm} className="space-y-4 py-2">
          <div className="p-3 rounded-lg border bg-muted/30 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Regras ativas que irão para o assistente:</span>
            <Badge variant="secondary" className="font-semibold">
              {totalRegrasAtivas} regras incluídas
            </Badge>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="commit-desc" className="text-xs font-semibold">
              O que você alterou nesta versão? <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="commit-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Adicionei regra sobre vacina de giárdia e ajustei horário"
              className="text-sm"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Se deixar em branco, o sistema gerará uma descrição automática da alteração.
            </p>
          </div>

          <DialogFooter className="pt-2 flex items-center justify-end gap-2">
            <Button variant="outline" type="button" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} className="gap-1.5">
              <Sparkles className="h-4 w-4" />
              {isSaving ? 'Salvando...' : `Salvar e Ativar v${versaoAtual + 1}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
