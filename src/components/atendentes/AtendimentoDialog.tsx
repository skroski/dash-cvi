import React, { useEffect, useMemo, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ArrowRightLeft,
  CheckCircle2,
  Loader2,
  MessageSquarePlus,
  Phone,
  UserPlus,
} from 'lucide-react';
import { useAtendentes } from '@/hooks/useAtendentes';
import { useAtendimentos } from '@/hooks/useAtendimentos';
import { Atendimento } from '@/types/atendimento';

interface AtendimentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  clientId?: number | null;
  clienteNome?: string;
  /** Atendimento aberto da conversa; ausente = novo vínculo. */
  atendimento?: Atendimento | null;
}

const AtendimentoDialog = ({
  open,
  onOpenChange,
  sessionId,
  clientId,
  clienteNome,
  atendimento,
}: AtendimentoDialogProps) => {
  const { departamentos, atendentes, atendenteById, departamentoById, setupError } =
    useAtendentes();
  const { vincular, transferir, encerrar } = useAtendimentos();

  const [atendenteSelecionado, setAtendenteSelecionado] = useState<string>('');
  const [motivo, setMotivo] = useState('');
  const [mensagemAdicional, setMensagemAdicional] = useState('');
  const [mensagemPopoverAberto, setMensagemPopoverAberto] = useState(false);

  const isTransferencia = !!atendimento?.atendenteId;

  useEffect(() => {
    if (!open) return;
    setAtendenteSelecionado('');
    setMotivo('');
    setMensagemAdicional('');
    setMensagemPopoverAberto(false);
  }, [open]);

  const atendenteEscolhido = atendenteSelecionado
    ? atendenteById.get(Number(atendenteSelecionado))
    : undefined;

  const atendenteAtual = atendimento?.atendenteId
    ? atendenteById.get(atendimento.atendenteId)
    : undefined;
  const departamentoAtual = atendimento?.departamentoId
    ? departamentoById.get(atendimento.departamentoId)
    : undefined;

  // Atendentes ativos agrupados por departamento para o select
  const grupos = useMemo(() => {
    const ativos = atendentes.filter((a) => a.ativo);
    const comDepartamento = departamentos.map((departamento) => ({
      departamento,
      atendentes: ativos.filter((a) => a.departamentoId === departamento.id),
    }));
    const semDepartamento = ativos.filter((a) => a.departamentoId === null);
    return { comDepartamento, semDepartamento };
  }, [atendentes, departamentos]);

  const isPending = vincular.isPending || transferir.isPending || encerrar.isPending;

  const handleConfirmar = () => {
    const atendente = atendenteById.get(Number(atendenteSelecionado));
    if (!atendente) return;
    const departamento =
      atendente.departamentoId != null
        ? departamentoById.get(atendente.departamentoId)
        : undefined;

    if (isTransferencia && atendimento) {
      transferir.mutate(
        {
          atendimento,
          clienteNome,
          paraAtendenteId: atendente.id,
          paraAtendenteNome: atendente.nome,
          paraAtendenteTelefone: atendente.telefone,
          paraDepartamentoId: atendente.departamentoId,
          paraDepartamentoNome: departamento?.nome,
          deAtendenteNome: atendenteAtual?.nome,
          motivo,
        },
        { onSuccess: () => onOpenChange(false) }
      );
    } else {
      vincular.mutate(
        {
          sessionId,
          clientId,
          clienteNome,
          atendenteId: atendente.id,
          atendenteNome: atendente.nome,
          atendenteTelefone: atendente.telefone,
          departamentoId: atendente.departamentoId,
          departamentoNome: departamento?.nome,
          mensagemAdicional,
        },
        { onSuccess: () => onOpenChange(false) }
      );
    }
  };

  const handleEncerrar = () => {
    if (!atendimento) return;
    encerrar.mutate(
      {
        atendimento,
        clienteNome,
        atendenteNome: atendenteAtual?.nome,
      },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isTransferencia ? 'Transferir atendimento' : 'Vincular atendimento'}
          </DialogTitle>
          <DialogDescription>
            {clienteNome ? `Conversa de ${clienteNome}. ` : ''}
            {isTransferencia
              ? 'Escolha o novo atendente responsável. A equipe será notificada.'
              : 'Escolha o atendente responsável por esta conversa. A equipe será notificada.'}
          </DialogDescription>
        </DialogHeader>

        {setupError ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Não foi possível carregar a equipe. Verifique se a migração de
            atendentes/departamentos foi aplicada no Supabase.
          </p>
        ) : (
          <div className="space-y-4">
            {isTransferencia && atendenteAtual && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="text-xs text-muted-foreground">Atualmente com</p>
                <p className="flex items-center gap-2 font-medium">
                  {departamentoAtual && (
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: departamentoAtual.cor }}
                      aria-hidden="true"
                    />
                  )}
                  {atendenteAtual.nome}
                  <span className="font-normal text-muted-foreground">
                    {atendenteAtual.cargo}
                    {departamentoAtual ? ` · ${departamentoAtual.nome}` : ''}
                  </span>
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{isTransferencia ? 'Transferir para' : 'Atendente responsável'}</Label>
              <Select value={atendenteSelecionado} onValueChange={setAtendenteSelecionado}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o atendente" />
                </SelectTrigger>
                <SelectContent>
                  {grupos.comDepartamento.map(({ departamento, atendentes: lista }) =>
                    lista.length > 0 ? (
                      <SelectGroup key={departamento.id}>
                        <SelectLabel className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: departamento.cor }}
                            aria-hidden="true"
                          />
                          {departamento.nome}
                        </SelectLabel>
                        {lista.map((a) => (
                          <SelectItem
                            key={a.id}
                            value={String(a.id)}
                            disabled={a.id === atendimento?.atendenteId}
                          >
                            {a.nome}
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              {a.cargo}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ) : null
                  )}
                  {grupos.semDepartamento.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Sem departamento</SelectLabel>
                      {grupos.semDepartamento.map((a) => (
                        <SelectItem
                          key={a.id}
                          value={String(a.id)}
                          disabled={a.id === atendimento?.atendenteId}
                        >
                          {a.nome}
                          <span className="ml-1.5 text-xs text-muted-foreground">{a.cargo}</span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>

            {atendenteEscolhido && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {atendenteEscolhido.telefone
                  ? `Receberá um WhatsApp em ${atendenteEscolhido.telefone}.`
                  : 'Sem telefone cadastrado — receberá apenas a notificação interna.'}
              </p>
            )}

            {!isTransferencia && (
              <div className="flex flex-wrap items-center gap-2">
                <Popover open={mensagemPopoverAberto} onOpenChange={setMensagemPopoverAberto}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <MessageSquarePlus className="h-4 w-4" />
                      {mensagemAdicional.trim() ? 'Editar mensagem' : 'Mensagem adicional'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-80 space-y-2">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Mensagem para o atendente</p>
                      <p className="text-xs text-muted-foreground">
                        Enviada junto com as informações da atribuição
                        {atendenteEscolhido?.telefone ? ' no WhatsApp.' : '.'}
                      </p>
                    </div>
                    <Textarea
                      value={mensagemAdicional}
                      onChange={(e) => setMensagemAdicional(e.target.value)}
                      placeholder="Ex.: cliente aguardando retorno urgente"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex justify-end">
                      <Button size="sm" onClick={() => setMensagemPopoverAberto(false)}>
                        Pronto
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                {mensagemAdicional.trim() && (
                  <span
                    className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
                    title={mensagemAdicional}
                  >
                    “{mensagemAdicional.trim()}”
                  </span>
                )}
              </div>
            )}

            {isTransferencia && (
              <div className="space-y-1.5">
                <Label htmlFor="transferencia-motivo">Motivo (opcional)</Label>
                <Textarea
                  id="transferencia-motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex.: cliente precisa de avaliação clínica"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Incluído na notificação e no WhatsApp do novo atendente.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {isTransferencia ? (
            <Button
              variant="outline"
              onClick={handleEncerrar}
              disabled={isPending}
              className="gap-1.5"
            >
              {encerrar.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Encerrar atendimento
            </Button>
          ) : (
            <span />
          )}
          <Button
            onClick={handleConfirmar}
            disabled={!atendenteSelecionado || isPending}
            className="gap-1.5"
          >
            {vincular.isPending || transferir.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isTransferencia ? (
              <ArrowRightLeft className="h-4 w-4" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {isTransferencia ? 'Transferir' : 'Vincular'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AtendimentoDialog;
