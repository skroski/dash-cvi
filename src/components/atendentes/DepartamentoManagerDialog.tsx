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
import { cn } from '@/lib/utils';
import { useAtendentes } from '@/hooks/useAtendentes';
import { Departamento } from '@/types/atendimento';
import { TAG_COLORS } from '@/types/crm';

interface DepartamentoManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ColorSwatches = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (cor: string) => void;
}) => (
  <div className="flex flex-wrap gap-1.5">
    {TAG_COLORS.map((cor) => (
      <button
        key={cor}
        type="button"
        onClick={() => onChange(cor)}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded-full border transition-transform hover:scale-110',
          value === cor ? 'ring-2 ring-ring ring-offset-1 ring-offset-background' : 'border-transparent'
        )}
        style={{ backgroundColor: cor }}
        aria-label={`Cor ${cor}`}
        aria-pressed={value === cor}
      >
        {value === cor && <Check className="h-3.5 w-3.5 text-white" />}
      </button>
    ))}
  </div>
);

const DepartamentoManagerDialog = ({ open, onOpenChange }: DepartamentoManagerDialogProps) => {
  const {
    departamentos,
    loading,
    setupError,
    atendentesPorDepartamento,
    createDepartamento,
    updateDepartamento,
    deleteDepartamento,
  } = useAtendentes();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(TAG_COLORS[0]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createDepartamento.mutate(
      { nome: newName, cor: newColor },
      {
        onSuccess: () => {
          setNewName('');
          setNewColor(TAG_COLORS[0]);
        },
      }
    );
  };

  const startEdit = (departamento: Departamento) => {
    setConfirmDeleteId(null);
    setEditingId(departamento.id);
    setEditName(departamento.nome);
    setEditColor(departamento.cor);
  };

  const handleSaveEdit = () => {
    if (editingId === null || !editName.trim()) return;
    updateDepartamento.mutate(
      { id: editingId, nome: editName, cor: editColor },
      { onSuccess: () => setEditingId(null) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar departamentos</DialogTitle>
          <DialogDescription>
            Crie, edite e remova departamentos. Atendentes de um departamento removido ficam sem
            departamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-md border bg-muted/40 p-3">
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do novo departamento"
              className="h-9"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button
              size="sm"
              className="h-9 gap-1"
              onClick={handleCreate}
              disabled={!newName.trim() || createDepartamento.isPending}
            >
              {createDepartamento.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Criar
            </Button>
          </div>
          <ColorSwatches value={newColor} onChange={setNewColor} />
        </div>

        <ScrollArea className="max-h-[300px] pr-3">
          <div className="space-y-1.5">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando departamentos...
              </div>
            ) : setupError ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Não foi possível carregar os departamentos. Verifique se a migração foi aplicada no
                Supabase.
              </p>
            ) : departamentos.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum departamento criado ainda.
              </p>
            ) : (
              departamentos.map((departamento) =>
                editingId === departamento.id ? (
                  <div key={departamento.id} className="space-y-2 rounded-md border p-2">
                    <div className="flex gap-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                      />
                      <Button
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={handleSaveEdit}
                        disabled={!editName.trim() || updateDepartamento.isPending}
                        aria-label="Salvar departamento"
                      >
                        {updateDepartamento.isPending ? (
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
                    <ColorSwatches value={editColor} onChange={setEditColor} />
                  </div>
                ) : (
                  <div
                    key={departamento.id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-card px-2 py-1.5"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: departamento.cor }}
                        aria-hidden="true"
                      />
                      <span className="font-medium">{departamento.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        {atendentesPorDepartamento.get(departamento.id)?.length || 0} atendente(s)
                      </span>
                    </span>
                    {confirmDeleteId === departamento.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Remover?</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            deleteDepartamento.mutate(departamento.id);
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
                          onClick={() => startEdit(departamento)}
                          aria-label={`Editar departamento ${departamento.nome}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmDeleteId(departamento.id)}
                          aria-label={`Excluir departamento ${departamento.nome}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                )
              )
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default DepartamentoManagerDialog;
