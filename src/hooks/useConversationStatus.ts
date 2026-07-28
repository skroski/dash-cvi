import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import { ConversationStatus, ConversationStatusInfo } from '@/types/chat';

const STATUS_KEY = ['conversas-status'];

const MIGRATION_HINT =
  'Verifique se a migração de status de conversas foi aplicada no Supabase.';

const TOAST_POR_STATUS: Record<ConversationStatus, string> = {
  aberta: 'Conversa reaberta',
  fechada: 'Conversa fechada',
  arquivada: 'Conversa arquivada',
};

function mapStatus(row: Tables<'conversas_status'>): ConversationStatusInfo {
  return {
    sessionId: row.session_id,
    status: (row.status as ConversationStatus) || 'aberta',
    fechadaEm: row.fechada_em,
    arquivadaEm: row.arquivada_em,
    reabertaEm: row.reaberta_em,
  };
}

// Só as sessões fora do estado padrão interessam: conversa sem linha é 'aberta'
async function fetchStatuses(): Promise<ConversationStatusInfo[]> {
  const { data, error } = await supabase
    .from('conversas_status')
    .select('*')
    .neq('status', 'aberta');
  if (error) throw error;
  return (data || []).map(mapStatus);
}

/**
 * Status de ciclo de vida das conversas (aberta/fechada/arquivada).
 * Compartilhado entre lista, header e área do chat via React Query
 * (mesma queryKey em todos os pontos de uso).
 */
export function useConversationStatus() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: STATUS_KEY,
    queryFn: fetchStatuses,
    staleTime: 15_000,
    retry: false,
  });

  const statusPorSession = useMemo(
    () => new Map((statusQuery.data || []).map((s) => [s.sessionId, s])),
    [statusQuery.data]
  );

  const getStatus = useCallback(
    (sessionId: string): ConversationStatus =>
      statusPorSession.get(sessionId)?.status ?? 'aberta',
    [statusPorSession]
  );

  // Sincroniza dashboards abertos quando outro usuário fecha/arquiva/reabre.
  // Nome do canal único por instância: o hook monta em vários componentes.
  useEffect(() => {
    const channel = supabase
      .channel(`conversas-status-realtime-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversas_status' },
        () => {
          queryClient.invalidateQueries({ queryKey: STATUS_KEY });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const mudarStatus = useMutation({
    mutationFn: async (input: { sessionId: string; status: ConversationStatus }) => {
      const now = new Date().toISOString();
      const payload: TablesInsert<'conversas_status'> = {
        session_id: input.sessionId,
        status: input.status,
        updated_at: now,
        ...(input.status === 'fechada' ? { fechada_em: now } : {}),
        ...(input.status === 'arquivada' ? { arquivada_em: now } : {}),
        ...(input.status === 'aberta' ? { reaberta_em: now } : {}),
      };
      const { error } = await supabase
        .from('conversas_status')
        .upsert(payload, { onConflict: 'session_id' });
      if (error) throw error;
    },
    // Atualização otimista: a conversa retrai/expande na hora do clique
    onMutate: async ({ sessionId, status }) => {
      await queryClient.cancelQueries({ queryKey: STATUS_KEY });
      const previous = queryClient.getQueryData<ConversationStatusInfo[]>(STATUS_KEY);
      queryClient.setQueryData<ConversationStatusInfo[]>(STATUS_KEY, (old = []) => {
        const now = new Date().toISOString();
        const atual = old.find((s) => s.sessionId === sessionId);
        const rest = old.filter((s) => s.sessionId !== sessionId);
        if (status === 'aberta') return rest;
        return [
          ...rest,
          {
            sessionId,
            status,
            fechadaEm: status === 'fechada' ? now : atual?.fechadaEm ?? null,
            arquivadaEm: status === 'arquivada' ? now : atual?.arquivadaEm ?? null,
            reabertaEm: atual?.reabertaEm ?? null,
          },
        ];
      });
      return { previous };
    },
    onSuccess: (_, { status }) => {
      toast.success(TOAST_POR_STATUS[status]);
    },
    onError: (error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(STATUS_KEY, context.previous);
      }
      console.error('Erro ao atualizar status da conversa:', error);
      toast.error('Erro ao atualizar status da conversa', {
        description: MIGRATION_HINT,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_KEY });
    },
  });

  const fecharConversa = useCallback(
    (sessionId: string) => mudarStatus.mutate({ sessionId, status: 'fechada' }),
    [mudarStatus]
  );
  const arquivarConversa = useCallback(
    (sessionId: string) => mudarStatus.mutate({ sessionId, status: 'arquivada' }),
    [mudarStatus]
  );
  const reabrirConversa = useCallback(
    (sessionId: string) => mudarStatus.mutate({ sessionId, status: 'aberta' }),
    [mudarStatus]
  );

  return {
    statusPorSession,
    getStatus,
    loading: statusQuery.isPending,
    setupError: !!statusQuery.error,
    mudandoStatus: mudarStatus.isPending,
    fecharConversa,
    arquivarConversa,
    reabrirConversa,
  };
}
