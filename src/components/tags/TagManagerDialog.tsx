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
import { useTags } from '@/hooks/useTags';
import { Tag, TAG_COLORS } from '@/types/crm';
import TagBadge from './TagBadge';

interface TagManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ColorSwatches = ({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}) => (
  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Escolha a cor da tag">
    {TAG_COLORS.map((color) => {
      const isSelected = value.toLowerCase() === color.toLowerCase();
      return (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={isSelected}
          aria-label={`Cor ${color}`}
          disabled={disabled}
          onClick={() => onChange(color)}
          style={{ backgroundColor: color }}
          className={cn(
            'h-6 w-6 rounded-full transition-transform focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            isSelected && 'scale-110 ring-2 ring-foreground ring-offset-2',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isSelected && (
            <Check className="mx-auto h-3.5 w-3.5 text-white drop-shadow-sm" aria-hidden="true" />
          )}
        </button>
      );
    })}
  </div>
);

export const TagManagerDialog: React.FC<TagManagerDialogProps> = ({ open, onOpenChange }) => {
  const { tags, tagsLoading, setupError, createTag, updateTag, deleteTag } = useTags();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(TAG_COLORS[0]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const handleCreate = () => {
    const nome = newName.trim();
    if (!nome) return;
    createTag.mutate(
      { nome, cor: newColor },
      {
        onSuccess: () => {
          setNewName('');
          setNewColor(TAG_COLORS[0]);
        },
      }
    );
  };

  const startEdit = (tag: Tag) => {
    setConfirmDeleteId(null);
    setEditingId(tag.id);
    setEditName(tag.nome);
    setEditColor(tag.cor);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditColor(TAG_COLORS[0]);
  };

  const handleSaveEdit = () => {
    if (editingId === null || !editName.trim()) return;
    const nome = editName.trim();
    updateTag.mutate(
      { id: editingId, nome, cor: editColor },
      {
        onSuccess: () => handleCancelEdit(),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar tags</DialogTitle>
          <DialogDescription>
            Crie, edite e remova tags reutilizáveis. Elas podem ser aplicadas a qualquer cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Nova tag
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Nome da tag (ex: VIP, Retorno, etc.)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-9"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              disabled={createTag.isPending}
            />
            <Button
              type="button"
              size="sm"
              onClick={handleCreate}
              disabled={!newName.trim() || createTag.isPending}
              className="gap-1 shrink-0"
            >
              {createTag.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Criar
            </Button>
          </div>
          <ColorSwatches
            value={newColor}
            onChange={setNewColor}
            disabled={createTag.isPending}
          />
        </div>

        <ScrollArea className="max-h-72 pr-3">
          <div className="space-y-1.5">
            {tagsLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando tags...
              </div>
            ) : setupError ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Não foi possível carregar as tags. Verifique se a migração foi aplicada no Supabase.
              </p>
            ) : tags.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma tag criada ainda.
              </p>
            ) : (
              tags.map((tag) =>
                editingId === tag.id ? (
                  <div key={tag.id} className="space-y-2 rounded-md border p-2">
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
                        disabled={!editName.trim() || updateTag.isPending}
                        aria-label="Salvar tag"
                      >
                        {updateTag.isPending ? (
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
                    key={tag.id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-card px-2 py-1.5"
                  >
                    <TagBadge tag={tag} />
                    {confirmDeleteId === tag.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Remover de todos?</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            deleteTag.mutate(tag.id);
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
                          onClick={() => startEdit(tag)}
                          aria-label={`Editar tag ${tag.nome}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmDeleteId(tag.id)}
                          aria-label={`Excluir tag ${tag.nome}`}
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

export default TagManagerDialog;
