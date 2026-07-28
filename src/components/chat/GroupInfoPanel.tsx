import { useState } from 'react';
import { Crown, RefreshCw, Shield, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import UserAvatar from '@/components/shared/UserAvatar';
import { Conversation } from '@/types/chat';
import { useUazapiGroups } from '@/hooks/useUazapiGroups';
import { UazapiGroupParticipant } from '@/services/uazapi';

interface GroupInfoPanelProps {
  conversation: Conversation;
}

const formatParticipantPhone = (participant: UazapiGroupParticipant) => {
  const digits = participant.phone.replace(/\D/g, '');
  return digits ? `+${digits}` : participant.jid;
};

/** Painel lateral com os dados do grupo carregados da Uazapi. */
const GroupInfoPanel = ({ conversation }: GroupInfoPanelProps) => {
  const { groupsByJid, loading, error, refreshGroups } = useUazapiGroups();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const group = groupsByJid.get(conversation.sessionId);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshGroups();
      toast.success('Dados do grupo atualizados');
    } catch (err) {
      console.error('Erro ao atualizar grupos via Uazapi:', err);
      toast.error('Erro ao atualizar dados do grupo', {
        description: 'Não foi possível consultar a Uazapi. Tente novamente.',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Admins primeiro, dono do grupo no topo
  const sortedParticipants = [...(group?.participants || [])].sort((a, b) => {
    const rank = (p: UazapiGroupParticipant) => (p.isSuperAdmin ? 0 : p.isAdmin ? 1 : 2);
    return rank(a) - rank(b);
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-6 text-center">
        <UserAvatar
          src={conversation.avatar}
          name={group?.name || conversation.name}
          isGroup
          className="mx-auto mb-4 h-24 w-24"
        />
        <h2 className="text-xl font-semibold">{group?.name || conversation.name}</h2>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <Users className="h-4 w-4" aria-hidden="true" />
          {group
            ? `Grupo do WhatsApp · ${group.participantsCount} participantes`
            : 'Grupo do WhatsApp'}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 gap-1.5"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          Atualizar dados
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {group?.description && (
            <Card className="p-4">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Descrição</h3>
              <p className="whitespace-pre-wrap text-sm">{group.description}</p>
            </Card>
          )}

          <Card className="p-4">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">ID do grupo</h3>
            <p className="break-all text-xs">{conversation.sessionId}</p>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Participantes{group ? ` (${group.participantsCount})` : ''}
            </h3>

            {loading && !group && (
              <p className="text-sm text-muted-foreground">Carregando participantes...</p>
            )}

            {!loading && !group && (
              <p className="text-sm text-muted-foreground">
                {error
                  ? 'Não foi possível carregar os dados do grupo pela Uazapi.'
                  : 'Grupo não encontrado na instância conectada.'}
              </p>
            )}

            {group && sortedParticipants.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum participante retornado.</p>
            )}

            <div className="space-y-2">
              {sortedParticipants.map((participant) => (
                <div key={participant.jid} className="flex items-center gap-2.5">
                  <UserAvatar name={participant.phone} className="h-8 w-8" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {formatParticipantPhone(participant)}
                  </span>
                  {participant.isSuperAdmin ? (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <Crown className="h-3 w-3 text-warning" aria-hidden="true" />
                      Dono
                    </Badge>
                  ) : participant.isAdmin ? (
                    <Badge variant="secondary" className="gap-1 text-[10px]">
                      <Shield className="h-3 w-3 text-primary" aria-hidden="true" />
                      Admin
                    </Badge>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
};

export default GroupInfoPanel;
