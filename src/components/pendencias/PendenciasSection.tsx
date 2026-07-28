import React, { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ClipboardList, Plus, Settings2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePendencias } from '@/hooks/usePendencias';
import PendenciaTiposDialog from './PendenciaTiposDialog';

interface PendenciasSectionProps {
  clientId?: number | null;
  className?: string;
}

const PendenciasSection = ({ clientId, className }: PendenciasSectionProps) => {
  const {
    tipos,
    pendencias,
    pendenciasLoading,
    setupError,
    addPendencia,
    togglePendencia,
    removePendencia,
  } = usePendencias();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [tiposDialogOpen, setTiposDialogOpen] = useState(false);
  const [search, setSearch] = useState('');

  const clientPendencias = useMemo(
    () => (clientId ? pendencias.filter((p) => p.clientId === clientId) : []),
    [pendencias, clientId]
  );
  const abertas = clientPendencias.filter((p) => p.status === 'pendente');
  const concluidas = clientPendencias.filter((p) => p.status === 'concluida');

  if (!clientId) {
    return (
      <div className={cn('rounded-md border border-dashed p-4 text-center', className)}>
        <p className="text-sm text-muted-foreground">
          Cliente sem cadastro — cadastre o cliente para registrar pendências.
        </p>
      </div>
    );
  }

  const handleAddFromTipo = (tipoId: number, nome: string) => {
    addPendencia.mutate({ clientId, descricao: nome, tipoId });
    setPickerOpen(false);
    setSearch('');
  };

  const handleAddCustom = () => {
    const descricao = search.trim();
    if (!descricao) return;
    addPendencia.mutate({ clientId, descricao });
    setPickerOpen(false);
    setSearch('');
  };

  const exactMatch = tipos.some((t) => t.nome.toLowerCase() === search.trim().toLowerCase());

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Pendências</h3>
          {abertas.length > 0 && (
            <Badge className="bg-warning px-1.5 text-warning-foreground tabular-nums">
              {abertas.length}
            </Badge>
          )}
        </div>

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 gap-1 border-dashed px-2 text-xs">
              <Plus className="h-3 w-3" />
              Adicionar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="end">
            <Command>
              <CommandInput
                placeholder="Buscar ou digitar pendência..."
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                <CommandEmpty>Nenhum tipo encontrado.</CommandEmpty>
                <CommandGroup heading="Lista cadastrada">
                  {tipos.map((tipo) => (
                    <CommandItem
                      key={tipo.id}
                      value={tipo.nome}
                      onSelect={() => handleAddFromTipo(tipo.id, tipo.nome)}
                    >
                      {tipo.nome}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {search.trim() && !exactMatch && (
                  <>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandItem
                        value={`adicionar-${search}`}
                        onSelect={handleAddCustom}
                        className="gap-2 text-primary"
                      >
                        <Plus className="h-4 w-4" />
                        Adicionar "{search.trim()}"
                      </CommandItem>
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
            <div className="border-t p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-xs text-muted-foreground"
                onClick={() => {
                  setPickerOpen(false);
                  setTiposDialogOpen(true);
                }}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Gerenciar lista de pendências
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {setupError ? (
        <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
          Não foi possível carregar as pendências. Verifique se a migração foi aplicada no Supabase.
        </p>
      ) : pendenciasLoading ? (
        <p className="p-2 text-center text-xs text-muted-foreground">Carregando pendências...</p>
      ) : clientPendencias.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          <ClipboardList className="h-4 w-4" />
          Nenhuma pendência para este cliente.
        </div>
      ) : (
        <div className="space-y-1.5">
          {[...abertas, ...concluidas].map((pendencia) => {
            const concluida = pendencia.status === 'concluida';
            return (
              <div
                key={pendencia.id}
                className={cn(
                  'group flex items-center gap-2 rounded-md border px-2 py-1.5',
                  concluida ? 'bg-muted/40' : 'border-warning/40 bg-warning/5'
                )}
              >
                <Checkbox
                  checked={concluida}
                  onCheckedChange={() => togglePendencia.mutate(pendencia)}
                  aria-label={
                    concluida
                      ? `Reabrir pendência ${pendencia.descricao}`
                      : `Concluir pendência ${pendencia.descricao}`
                  }
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'truncate text-sm',
                      concluida && 'text-muted-foreground line-through'
                    )}
                  >
                    {pendencia.descricao}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {concluida && pendencia.concluidaEm
                      ? `Concluída em ${new Date(pendencia.concluidaEm).toLocaleDateString('pt-BR')}`
                      : `Criada em ${new Date(pendencia.createdAt).toLocaleDateString('pt-BR')}`}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={() => removePendencia.mutate(pendencia.id)}
                  aria-label={`Excluir pendência ${pendencia.descricao}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <PendenciaTiposDialog open={tiposDialogOpen} onOpenChange={setTiposDialogOpen} />
    </div>
  );
};

export default PendenciasSection;
