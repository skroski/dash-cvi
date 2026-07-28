import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PostgrestError } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Conversation } from '@/types/chat';
import {
  ScheduledMessage,
  ScheduledMessageInput,
  ScheduledMessageSender,
  ScheduledMessageStatus,
  SCHEDULED_MESSAGE_TIMEZONE,
} from '@/types/scheduledMessage';

const MIGRATION_HINT =
  'Aplique a migração supabase/migrations/20260716150000_mensagens_agendadas.sql e recarregue a página.';

const queryKey = (sessionId?: string) => ['scheduled-messages', sessionId || 'none'];

function mapScheduledMessage(
  row: Tables<'mensagens_agendadas'>
): ScheduledMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    clientId: row.client_id,
    ownerName: row.nome_tutor,
    phone: row.telefone,
    message: row.mensagem,
    scheduledFor: row.programado_para,
    timezone: row.timezone,
    sender: row.remetente as ScheduledMessageSender,
    status: row.status as ScheduledMessageStatus,
    attempts: row.tentativas,
    providerMessageId: row.provider_message_id,
    error: row.erro,
    sentAt: row.enviado_em,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchScheduledMessages(sessionId: string) {
  const { data, error } = await supabase
    .from('mensagens_agendadas')
    .select('*')
    .eq('session_id', sessionId)
    .order('programado_para', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapScheduledMessage);
}

export function useScheduledMessages(conversation?: Conversation) {
  const queryClient = useQueryClient();
  const sessionId = conversation?.sessionId;
  const enabled = Boolean(sessionId && !conversation?.isGroup);

  const messagesQuery = useQuery({
    queryKey: queryKey(sessionId),
    queryFn: () => fetchScheduledMessages(sessionId as string),
    enabled,
    staleTime: 15_000,
    retry: false,
  });

  useEffect(() => {
    if (!sessionId || !enabled) return;

    const channel = supabase
      .channel(`mensagens-agendadas-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mensagens_agendadas',
          filter: `session_id=eq.${sessionId}`,
        },
        () => queryClient.invalidateQueries({ queryKey: queryKey(sessionId) })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient, sessionId]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKey(sessionId) });

  const createMessage = useMutation({
    mutationFn: async (input: ScheduledMessageInput) => {
      if (!conversation || !sessionId) {
        throw new Error('Nenhuma conversa selecionada.');
      }

      const { error } = await supabase.from('mensagens_agendadas').insert({
        session_id: sessionId,
        client_id: conversation.clientData?.id ?? null,
        nome_tutor: conversation.name,
        telefone: conversation.phone,
        mensagem: input.message.trim(),
        programado_para: input.scheduledFor,
        timezone: SCHEDULED_MESSAGE_TIMEZONE,
        remetente: input.sender,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Mensagem agendada', {
        description: 'O envio aparecerá nesta conversa na data e hora escolhidas.',
      });
    },
    onError: (error) => {
      console.error('Erro ao agendar mensagem:', error);
      toast.error('Não foi possível agendar a mensagem', {
        description:
          (error as PostgrestError)?.code === '42P01'
            ? MIGRATION_HINT
            : 'Confira os dados e tente novamente.',
      });
    },
  });

  const updateMessage = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: number;
      input: ScheduledMessageInput;
    }) => {
      const { data, error } = await supabase
        .from('mensagens_agendadas')
        .update({
          mensagem: input.message.trim(),
          programado_para: input.scheduledFor,
          remetente: input.sender,
          status: 'pendente',
          tentativas: 0,
          erro: null,
          enviado_em: null,
          provider_message_id: null,
        })
        .eq('id', id)
        .in('status', ['pendente', 'falha'])
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error('Esta mensagem já está sendo processada ou foi enviada.');
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success('Agendamento atualizado');
    },
    onError: (error) => {
      console.error('Erro ao atualizar mensagem agendada:', error);
      toast.error('Não foi possível atualizar o agendamento', {
        description:
          error instanceof Error
            ? error.message
            : 'Atualize a lista e tente novamente.',
      });
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('mensagens_agendadas')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Mensagem agendada removida');
    },
    onError: (error) => {
      console.error('Erro ao remover mensagem agendada:', error);
      toast.error('Não foi possível remover a mensagem agendada');
    },
  });

  const messages = useMemo(() => {
    const activeStatuses: ScheduledMessageStatus[] = [
      'pendente',
      'processando',
      'falha',
    ];

    return [...(messagesQuery.data || [])].sort((a, b) => {
      const aIsActive = activeStatuses.includes(a.status);
      const bIsActive = activeStatuses.includes(b.status);
      if (aIsActive !== bIsActive) return aIsActive ? -1 : 1;

      const dateA = new Date(a.scheduledFor).getTime();
      const dateB = new Date(b.scheduledFor).getTime();
      return aIsActive ? dateA - dateB : dateB - dateA;
    });
  }, [messagesQuery.data]);
  const pendingCount = useMemo(
    () => messages.filter((message) => message.status === 'pendente').length,
    [messages]
  );

  return {
    messages,
    pendingCount,
    loading: messagesQuery.isPending && enabled,
    setupError: Boolean(messagesQuery.error),
    createMessage,
    updateMessage,
    deleteMessage,
    refresh: messagesQuery.refetch,
  };
}
