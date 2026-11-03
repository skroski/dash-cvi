import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  UazapiQuickReply,
  UazapiQuickReplyInput,
  deleteQuickReply,
  isUazapiConfigured,
  listQuickReplies,
  saveQuickReply,
} from '@/services/uazapi';

const QUICK_REPLIES_KEY = ['uazapi-quick-replies'];

/** Extrai da exceção da Uazapi a frase que descreve a falha para o atendente. */
function describeError(error: unknown, fallback: string): string {
  const bruto = error instanceof Error ? error.message : String(error ?? '');
  if (!bruto) return fallback;

  const corpo = bruto.replace(/^Uazapi \S+ falhou \(\d+\):\s*/, '').trim();
  let texto = corpo;
  try {
    const json = JSON.parse(corpo);
    texto = json.error || json.message || json.detail || corpo;
  } catch {
    // Resposta em texto puro: usa como veio.
  }

  if (/Failed to fetch|NetworkError/i.test(texto)) {
    return 'Sem conexão com o servidor da Uazapi. Verifique a internet e tente de novo.';
  }
  return texto.length > 180 ? `${texto.slice(0, 180)}…` : texto || fallback;
}

/**
 * Modelos de mensagem (respostas rápidas) da instância Uazapi — os mesmos
 * cadastrados no WhatsApp Business chegam aqui com `onWhatsApp: true`.
 *
 * Não existe endpoint de ressincronização: modelos criados no celular só
 * aparecem quando o WhatsApp envia a atualização de estado, então o diálogo
 * expõe um botão de atualizar para forçar a releitura.
 */
export function useQuickReplies() {
  const queryClient = useQueryClient();
  const configured = isUazapiConfigured();

  const query = useQuery({
    queryKey: QUICK_REPLIES_KEY,
    queryFn: () => listQuickReplies(),
    enabled: configured,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const replies: UazapiQuickReply[] = useMemo(() => query.data || [], [query.data]);

  const saveReply = useMutation({
    mutationFn: async (input: UazapiQuickReplyInput) => {
      await saveQuickReply(input);
      return input;
    },
    onSuccess: async (input) => {
      // A resposta do /quickreply/edit devolve `quickReplies`, mas a
      // documentação não garante que seja a lista completa — relemos do
      // servidor em vez de arriscar apagar os outros modelos do cache.
      await queryClient.invalidateQueries({ queryKey: QUICK_REPLIES_KEY });

      toast.success(input.id ? 'Modelo atualizado' : 'Modelo criado');

      // A API não documenta se editar um modelo preserva a sincronização com o
      // WhatsApp Business — e, uma vez perdida, ela não pode ser refeita pela
      // API. Conferimos o resultado real para o atendente descobrir na hora.
      if (input.id && input.onWhatsApp) {
        const lista =
          queryClient.getQueryData<UazapiQuickReply[]>(QUICK_REPLIES_KEY) || [];
        const atual = lista.find((reply) => reply.id === input.id);

        if (atual && !atual.onWhatsApp) {
          toast.warning('Modelo saiu do WhatsApp Business', {
            description:
              'A edição foi salva, mas o modelo deixou de estar sincronizado com o app. Recrie-o para voltar a aparecer nas respostas rápidas do celular.',
            duration: 10_000,
          });
        } else if (!atual && lista.length > 0) {
          // O id pode mudar no servidor; sem encontrá-lo não dá para afirmar
          // que a sincronização continuou de pé.
          toast.warning('Confira o modelo no celular', {
            description:
              'A edição foi salva, mas não deu para confirmar se ele continua nas respostas rápidas do WhatsApp Business.',
            duration: 10_000,
          });
        }
      }
    },
    onError: (error) => {
      console.error('Erro ao salvar modelo de mensagem:', error);
      toast.error('Não foi possível salvar o modelo', {
        description: describeError(error, 'Confira os dados e tente novamente.'),
      });
    },
  });

  const removeReply = useMutation({
    mutationFn: async (reply: UazapiQuickReply) => {
      await deleteQuickReply(reply);
    },
    onSuccess: async (_data, reply) => {
      await queryClient.invalidateQueries({ queryKey: QUICK_REPLIES_KEY });
      toast.success('Modelo removido', {
        description: reply.onWhatsApp
          ? 'Confira no celular se ele também saiu das respostas rápidas do WhatsApp Business.'
          : undefined,
      });
    },
    onError: (error) => {
      console.error('Erro ao remover modelo de mensagem:', error);
      toast.error('Não foi possível remover o modelo', {
        description: describeError(error, 'Tente novamente em instantes.'),
      });
    },
  });

  return {
    replies,
    configured,
    loading: query.isPending && query.fetchStatus !== 'idle',
    error: query.error,
    refreshing: query.isFetching,
    refresh: query.refetch,
    saveReply,
    removeReply,
  };
}
