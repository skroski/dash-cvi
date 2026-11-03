import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert } from '@/integrations/supabase/types';
import { ConversationStatus, ConversationStatusInfo } from '@/types/chat';

const STATUS_KEY = ['conversas-status'];

const STATUS_ERROR_DESCRIPTION =
  'O estado anterior foi mantido. Verifique sua conexão e tente novamente.';

const TOAST_POR_STATUS: Record<ConversationStatus, string> = {
  aberta: 'Conversa reaberta',
  fechada: 'Conversa fechada',
  arquivada: 'Conversa arquivada',
};

interface StatusChangeCallbacks {
  onSuccess?: () => void;
  onError?: () => void;
}

// Só as colunas que a UI consome — a busca paginada não traz a linha inteira
type StatusRow = Pick<
  Tables<'conversas_status'>,
  'session_id' | 'status' | 'fechada_em' | 'arquivada_em' | 'reaberta_em'
>;

const STATUS_COLUMNS = 'session_id,status,fechada_em,arquivada_em,reaberta_em';

function mapStatus(row: StatusRow): ConversationStatusInfo {
  return {
    sessionId: row.session_id,
    status: (row.status as ConversationStatus) || 'aberta',
    fechadaEm: row.fechada_em,
    arquivadaEm: row.arquivada_em,
    reabertaEm: row.reaberta_em,
  };
}

function mergeStatus(
  current: ConversationStatusInfo[] = [],
  next: ConversationStatusInfo | null,
  sessionId: string
): ConversationStatusInfo[] {
  const existing = current.find((status) => status.sessionId === sessionId);

  if (!next || next.status === 'aberta') {
    return existing
      ? current.filter((status) => status.sessionId !== sessionId)
      : current;
  }

  if (
    existing?.status === next.status &&
    existing.fechadaEm === next.fechadaEm &&
    existing.arquivadaEm === next.arquivadaEm &&
    existing.reabertaEm === next.reabertaEm
  ) {
    return current;
  }

  return [
    ...current.filter((status) => status.sessionId !== sessionId),
    next,
  ];
}

// O PostgREST corta a resposta em 1000 linhas (db-max-rows), então a busca é
// paginada: sem isso as sessões além do limite voltam a aparecer como 'aberta'.
// A ordenação explícita é obrigatória — sem ORDER BY as páginas se sobrepõem ou
// pulam linhas conforme a tabela é atualizada.
const STATUS_PAGE_SIZE = 1000;

// Só as sessões fora do estado padrão interessam: conversa sem linha é 'aberta'
async function fetchStatuses(): Promise<ConversationStatusInfo[]> {
  const rows: StatusRow[] = [];
  let total = Infinity;
  let from = 0;

  while (from < total) {
    const { data, error, count } = await supabase
      .from('conversas_status')
      .select(STATUS_COLUMNS, { count: 'exact' })
      .neq('status', 'aberta')
      .order('session_id', { ascending: true })
      .range(from, from + STATUS_PAGE_SIZE - 1);
    if (error) throw error;

    const page = data || [];
    if (count !== null) total = count;
    rows.push(...page);
    // Avança pelo que o servidor realmente devolveu: se o teto dele for menor
    // que STATUS_PAGE_SIZE, pular de página em página deixaria linhas para trás
    if (page.length === 0) break;
    from += page.length;
  }

  return rows.map(mapStatus);
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
    staleTime: 10_000,
    refetchOnWindowFocus: true,
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
      const { data, error } = await supabase
        .from('conversas_status')
        .upsert(payload, { onConflict: 'session_id' })
        .select(STATUS_COLUMNS)
        .single();
      if (error) throw error;
      return mapStatus(data);
    },
    // Atualização otimista: a conversa retrai/expande na hora do clique
    onMutate: async ({ sessionId, status }) => {
      await queryClient.cancelQueries({ queryKey: STATUS_KEY });
      const previous = queryClient.getQueryData<ConversationStatusInfo[]>(STATUS_KEY);
      const previousStatus = previous?.find((item) => item.sessionId === sessionId) ?? null;
      queryClient.setQueryData<ConversationStatusInfo[]>(STATUS_KEY, (old = []) => {
        const now = new Date().toISOString();
        const atual = old.find((s) => s.sessionId === sessionId);
        const optimisticStatus = status === 'aberta'
          ? null
          : {
            sessionId,
            status,
            fechadaEm: status === 'fechada' ? now : atual?.fechadaEm ?? null,
            arquivadaEm: status === 'arquivada' ? now : atual?.arquivadaEm ?? null,
            reabertaEm: atual?.reabertaEm ?? null,
          };

        return mergeStatus(old, optimisticStatus, sessionId);
      });
      return { hadCachedStatuses: previous !== undefined, previousStatus };
    },
    onSuccess: (confirmedStatus, { sessionId, status }, context) => {
      queryClient.setQueryData<ConversationStatusInfo[]>(STATUS_KEY, (current = []) =>
        mergeStatus(current, confirmedStatus, sessionId)
      );
      if (!context?.hadCachedStatuses) {
        queryClient.invalidateQueries({ queryKey: STATUS_KEY });
      }
      toast.success(TOAST_POR_STATUS[status]);
    },
    onError: (error, { sessionId }, context) => {
      queryClient.setQueryData<ConversationStatusInfo[]>(STATUS_KEY, (current = []) =>
        mergeStatus(current, context?.previousStatus ?? null, sessionId)
      );
      if (!context?.hadCachedStatuses) {
        queryClient.invalidateQueries({ queryKey: STATUS_KEY });
      }
      console.error('Erro ao atualizar status da conversa:', error);
      toast.error('Erro ao atualizar status da conversa', {
        description: STATUS_ERROR_DESCRIPTION,
      });
    },
  });

  const alterarStatus = useCallback(
    (
      sessionId: string,
      status: ConversationStatus,
      callbacks?: StatusChangeCallbacks
    ) => mudarStatus.mutate(
      { sessionId, status },
      {
        onSuccess: () => callbacks?.onSuccess?.(),
        onError: () => callbacks?.onError?.(),
      }
    ),
    [mudarStatus]
  );

  const fecharConversa = useCallback(
    (sessionId: string, callbacks?: StatusChangeCallbacks) =>
      alterarStatus(sessionId, 'fechada', callbacks),
    [alterarStatus]
  );
  const arquivarConversa = useCallback(
    (sessionId: string, callbacks?: StatusChangeCallbacks) =>
      alterarStatus(sessionId, 'arquivada', callbacks),
    [alterarStatus]
  );
  const reabrirConversa = useCallback(
    (sessionId: string, callbacks?: StatusChangeCallbacks) =>
      alterarStatus(sessionId, 'aberta', callbacks),
    [alterarStatus]
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

/**
 * Mantém o cache de status sincronizado em tempo real com uma única assinatura
 * na tela de conversas. O payload atualiza o cache diretamente, sem refazer a
 * consulta completa a cada mudança.
 */
export function useConversationStatusRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('conversas-status-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversas_status' },
        (payload) => {
          const rawRow = payload.eventType === 'DELETE' ? payload.old : payload.new;
          const sessionId = typeof rawRow?.session_id === 'string'
            ? rawRow.session_id
            : null;

          if (!sessionId) {
            queryClient.invalidateQueries({ queryKey: STATUS_KEY });
            return;
          }

          const nextStatus = payload.eventType === 'DELETE'
            ? null
            : mapStatus(rawRow as StatusRow);

          queryClient.setQueryData<ConversationStatusInfo[]>(STATUS_KEY, (current = []) =>
            mergeStatus(current, nextStatus, sessionId)
          );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Revalida os status para garantir sincronia após reconexão ou desbloqueio de tela
          queryClient.invalidateQueries({ queryKey: STATUS_KEY });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
