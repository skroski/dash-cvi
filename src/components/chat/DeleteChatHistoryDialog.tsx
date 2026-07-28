import React from 'react';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface DeleteChatHistoryDialogProps {
  sessionId: string;
  clientName: string;
  onHistoryDeleted?: () => void;
  /** Modo controlado: quando fornecidos, o diálogo não renderiza o botão-gatilho padrão. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const DeleteChatHistoryDialog = ({
  sessionId,
  clientName,
  onHistoryDeleted,
  open,
  onOpenChange,
}: DeleteChatHistoryDialogProps) => {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const isControlled = open !== undefined;

  const handleDeleteHistory = async () => {
    try {
      setIsDeleting(true);

      const { error } = await supabase
        .from('n8n_chat_histories')
        .delete()
        .eq('session_id', sessionId);

      if (error) {
        throw error;
      }

      toast.success("Histórico excluído", { description: `O histórico de chat de ${clientName} foi excluído com sucesso.` });

      onHistoryDeleted?.();
    } catch (error) {
      console.error('Erro ao excluir histórico:', error);
      toast.error("Erro ao excluir histórico", { description: "Não foi possível excluir o histórico do chat." });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {!isControlled && (
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            aria-label={`Excluir histórico de ${clientName}`}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 size={16} />
          </Button>
        </AlertDialogTrigger>
      )}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir Histórico do Chat</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir todo o histórico de conversa de <strong>{clientName}</strong>?
            <br /><br />
            Esta ação não pode ser desfeita e todas as mensagens serão permanentemente removidas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteHistory}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Excluindo..." : "Excluir Histórico"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteChatHistoryDialog;
