import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { usePendencias } from '@/hooks/usePendencias';
import { PendenciaTipo } from '@/types/crm';

interface PendenciaTiposDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PendenciaTiposDialog = ({ open, onOpenChange }: PendenciaTiposDialogProps) => {
  const { tipos, tiposLoading, setupError, addTipo, renameTipo, removeTipo } = usePendencias();

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handleAdd = () => {
    if (!newName.trim()) return;
    addTipo.mutate(newName, { onSuccess: () => setNewName('') });
  };

  const startEdit = (tipo: PendenciaTipo) => {
    setConfirmDeleteId(null);
    setEditingId(tipo.id);
    setEditName(tipo.nome);
  };

  const handleSaveEdit = () => {
    if (editingId === null || !editName.trim()) return;
    renameTipo.mutate({ id: editingId, nome: editName }, { onSuccess: () => setEditingId(null) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cadastro de pendências</DialogTitle>
          <DialogDescription>
            Lista de pendências disponíveis para vincular aos clientes (ex.: hemograma, vacina).
            Remover um tipo não apaga as pendências já lançadas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nova pendência (ex.: Hemograma)"
            className="h-9"
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button
            size="sm"
            className="h-9 gap-1"
            onClick={handleAdd}
            disabled={!newName.trim() || addTipo.isPending}
          >
            {addTipo.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Incluir
          </Button>
        </div>

        <ScrollArea className="max-h-[320px] pr-3">
          <div className="space-y-1.5">
            {tiposLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando lista...
              </div>
            ) : setupError ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Não foi possível carregar a lista. Verifique se a migração foi aplicada no Supabase.
              </p>
            ) : tipos.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum tipo cadastrado ainda.
              </p>
            ) : (
              tipos.map((tipo) => (
                <div
                  key={tipo.id}
                  className="flex items-center justify-between gap-2 rounded-md border bg-card px-2 py-1.5"
                >
                  {editingId === tipo.id ? (
                    <>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                      />
                      <div className="flex items-center gap-0.5">
                        <Button
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={handleSaveEdit}
                          disabled={!editName.trim() || renameTipo.isPending}
                          aria-label="Salvar tipo"
                        >
                          {renameTipo.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 shrink-0"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancelar edição"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="truncate text-sm">{tipo.nome}</span>
                      {confirmDeleteId === tipo.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">Remover?</span>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2 text-xs"
                            onClick={() => {
                              removeTipo.mutate(tipo.id);
                              setConfirmDeleteId(null);
                            }}
                          >
                            Sim
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => setConfirmDeleteId(null)}
                          >
                            Não
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => startEdit(tipo)}
                            aria-label={`Editar ${tipo.nome}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setConfirmDeleteId(tipo.id)}
                            aria-label={`Excluir ${tipo.nome}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default PendenciaTiposDialog;
