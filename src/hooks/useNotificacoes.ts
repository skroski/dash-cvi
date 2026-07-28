import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { playNotificationChime } from '@/lib/notificationSound';
import { Notificacao, NotificacaoTipo } from '@/types/atendimento';

const NOTIFICACOES_KEY = ['notificacoes'];

// Ids de notificações criadas por esta aba: o toast delas já foi exibido pela
// própria mutação, então o listener realtime não deve repeti-lo.
const notificacoesLocais = new Set<number>();

export function mapNotificacao(row: Tables<'notificacoes'>): Notificacao {
  return {
    id: row.id,
    tipo: row.tipo as NotificacaoTipo,
    titulo: row.titulo,
    descricao: row.descricao,
    sessionId: row.session_id,
    atendimentoId: row.atendimento_id,
    atendenteId: row.atendente_id,
    departamentoId: row.departamento_id,
    lida: row.lida,
    createdAt: row.created_at,
  };
}

/**
 * Insere uma notificação do sistema. Usado pelas mutações de atendimento
 * (atribuição, transferência, encerramento); falhas não interrompem a ação.
 */
export async function criarNotificacao(input: {
  tipo: NotificacaoTipo;
  titulo: string;
  descricao?: string | null;
  sessionId?: string | null;
  atendimentoId?: number | null;
  atendenteId?: number | null;
  departamentoId?: number | null;
}): Promise<void> {
  const { data, error } = await supabase
    .from('notificacoes')
    .insert({
      tipo: input.tipo,
      titulo: input.titulo,
      descricao: input.descricao ?? null,
      session_id: input.sessionId ?? null,
      atendimento_id: input.atendimentoId ?? null,
      atendente_id: input.atendenteId ?? null,
      departamento_id: input.departamentoId ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Erro ao criar notificação:', error);
    return;
  }
  if (data) notificacoesLocais.add(data.id);
}

async function fetchNotificacoes(): Promise<Notificacao[]> {
  const { data, error } = await supabase
    .from('notificacoes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []).map(mapNotificacao);
}

export function useNotificacoes() {
  const queryClient = useQueryClient();

  const notificacoesQuery = useQuery({
    queryKey: NOTIFICACOES_KEY,
    queryFn: fetchNotificacoes,
    staleTime: 30_000,
    retry: false,
  });

  const notificacoes = useMemo(
    () => notificacoesQuery.data || [],
    [notificacoesQuery.data]
  );

  const naoLidas = useMemo(
    () => notificacoes.filter((n) => !n.lida).length,
    [notificacoes]
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: NOTIFICACOES_KEY });

  // Notificações em tempo real: atualiza a lista e avisa com toast quando a
  // notificação foi gerada por outra aba/usuário.
  useEffect(() => {
    const channel = supabase
      .channel(`notificacoes-realtime-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificacoes' },
        (payload) => {
          invalidate();
          const nova = mapNotificacao(payload.new as Tables<'notificacoes'>);
          if (notificacoesLocais.has(nova.id)) {
            notificacoesLocais.delete(nova.id);
            return;
          }
          playNotificationChime('system');
          toast.info(nova.titulo, {
            description: nova.descricao ?? undefined,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  const marcarLida = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error) => {
      console.error('Erro ao marcar notificação como lida:', error);
    },
  });

  const marcarTodasLidas = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('lida', false);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (error) => {
      console.error('Erro ao marcar notificações como lidas:', error);
      toast.error('Erro ao marcar notificações como lidas');
    },
  });

  return {
    notificacoes,
    naoLidas,
    loading: notificacoesQuery.isPending,
    setupError: !!notificacoesQuery.error,
    marcarLida,
    marcarTodasLidas,
  };
}
