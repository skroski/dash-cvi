import React, { useEffect, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useAtendentes } from '@/hooks/useAtendentes';
import { Atendente, CARGOS_SUGERIDOS } from '@/types/atendimento';

const SEM_DEPARTAMENTO = 'sem-departamento';

interface AtendenteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Atendente em edição; ausente = cadastro de novo atendente. */
  atendente?: Atendente | null;
}

const AtendenteFormDialog = ({ open, onOpenChange, atendente }: AtendenteFormDialogProps) => {
  const { departamentos, createAtendente, updateAtendente } = useAtendentes();

  const [nome, setNome] = useState('');
  const [cargo, setCargo] = useState('');
  const [telefone, setTelefone] = useState('');
  const [departamentoId, setDepartamentoId] = useState<string>(SEM_DEPARTAMENTO);
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    if (!open) return;
    setNome(atendente?.nome ?? '');
    setCargo(atendente?.cargo ?? '');
    setTelefone(atendente?.telefone ?? '');
    setDepartamentoId(
      atendente?.departamentoId != null ? String(atendente.departamentoId) : SEM_DEPARTAMENTO
    );
    setAtivo(atendente?.ativo ?? true);
  }, [open, atendente]);

  const isPending = createAtendente.isPending || updateAtendente.isPending;
  const canSave = nome.trim().length > 0 && cargo.trim().length > 0 && !isPending;

  const handleSave = () => {
    if (!canSave) return;
    const payload = {
      nome,
      cargo,
      telefone: telefone.trim() || null,
      departamentoId: departamentoId === SEM_DEPARTAMENTO ? null : Number(departamentoId),
    };
    if (atendente) {
      updateAtendente.mutate(
        { id: atendente.id, ...payload, ativo },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      createAtendente.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{atendente ? 'Editar atendente' : 'Novo atendente'}</DialogTitle>
          <DialogDescription>
            {atendente
              ? 'Atualize os dados do membro da equipe.'
              : 'Cadastre um novo membro da equipe e vincule a um departamento.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="atendente-nome">Nome</Label>
            <Input
              id="atendente-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do atendente"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="atendente-cargo">Cargo</Label>
            <Input
              id="atendente-cargo"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Ex.: Atendente, Veterinário..."
            />
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {CARGOS_SUGERIDOS.map((sugestao) => (
                <Badge
                  key={sugestao}
                  variant={cargo === sugestao ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setCargo(sugestao)}
                >
                  {sugestao}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="atendente-telefone">
              Telefone <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="atendente-telefone"
              type="tel"
              inputMode="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="Ex.: (11) 99999-9999"
            />
            <p className="text-xs text-muted-foreground">
              Com DDD. Recebe um WhatsApp quando um atendimento for atribuído a ele.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Departamento</Label>
            <Select value={departamentoId} onValueChange={setDepartamentoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_DEPARTAMENTO}>Sem departamento</SelectItem>
                {departamentos.map((departamento) => (
                  <SelectItem key={departamento.id} value={String(departamento.id)}>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: departamento.cor }}
                        aria-hidden="true"
                      />
                      {departamento.nome}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {atendente && (
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="atendente-ativo">Ativo</Label>
                <p className="text-xs text-muted-foreground">
                  Atendentes inativos não aparecem para novos vínculos.
                </p>
              </div>
              <Switch id="atendente-ativo" checked={ativo} onCheckedChange={setAtivo} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {atendente ? 'Salvar' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AtendenteFormDialog;
