import React, { useState } from 'react';
import { ArrowRightLeft, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAtendentes } from '@/hooks/useAtendentes';
import { useAtendimentos } from '@/hooks/useAtendimentos';
import AtendimentoDialog from './AtendimentoDialog';

interface AtendimentoControlProps {
  sessionId: string;
  clientId?: number | null;
  clienteNome?: string;
}

/**
 * Botão compacto do header do chat: mostra o atendente responsável pela
 * conversa e abre o dialog de vínculo/transferência.
 */
const AtendimentoControl = ({ sessionId, clientId, clienteNome }: AtendimentoControlProps) => {
  const { atendenteById, departamentoById, setupError } = useAtendentes();
  const { atendimentoPorSession } = useAtendimentos();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (setupError) return null;

  const atendimento = atendimentoPorSession.get(sessionId);
  const atendente = atendimento?.atendenteId
    ? atendenteById.get(atendimento.atendenteId)
    : undefined;
  const departamento = atendimento?.departamentoId
    ? departamentoById.get(atendimento.departamentoId)
    : undefined;

  return (
    <>
      {atendente ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialogOpen(true)}
          className="h-8 gap-1.5 px-2"
          title={`Atendimento com ${atendente.nome}${departamento ? ` (${departamento.nome})` : ''}. Clique para transferir.`}
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: departamento?.cor ?? '#0d9488' }}
            aria-hidden="true"
          />
          <span className="max-w-[110px] truncate text-xs">{atendente.nome}</span>
          <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialogOpen(true)}
          className="h-8 gap-1.5 px-2"
          title="Vincular esta conversa a um atendente"
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span className="hidden text-xs sm:inline">Atribuir</span>
        </Button>
      )}

      <AtendimentoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sessionId={sessionId}
        clientId={clientId}
        clienteNome={clienteNome}
        atendimento={atendimento}
      />
    </>
  );
};

export default AtendimentoControl;
