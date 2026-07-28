
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PauseDurationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (duration: number | null) => void;
}

const PauseDurationDialog = ({ isOpen, onOpenChange, onConfirm }: PauseDurationDialogProps) => {
  const handlePause = () => {
    onConfirm(1);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Pausar o bot?</DialogTitle>
          <DialogDescription>
            Deseja pausar o bot para este contato? O bot ficará pausado até ser reativado manualmente.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handlePause}>
            Pausar bot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PauseDurationDialog;
