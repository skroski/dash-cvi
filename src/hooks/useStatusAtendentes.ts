import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import {
  STATUS_META,
  StatusAtendente,
  StatusHistorico,
  StatusOperacional,
} from '@/types/perfil';

const STATUS_KEY = ['atendente-status'];
const STATUS_HISTORICO_KEY = ['atendente-status-historico'];

const MIGRATION_HINT =
  'Verifique se a migração 20260725120000_status_operacional.sql foi aplicada no Supabase.';

function mapStatus(row: Tables<'atendente_status'>): StatusAtendente {
  return {
    atendenteId: row.atendente_id,
    status: row.status as StatusOperacional,
    motivo: row.motivo,
    previsaoRetorno: row.previsao_retorno,
    alteradoEm: row.alterado_em,
    alteradoPor: row.alterado_por,
  };
}

function mapHistorico(row: Tables<'atendente_status_historico'>): StatusHistorico {
  return {
    id: row.id,
    atendenteId: row.atendente_id,
    statusAnterior: row.status_anterior as StatusOperacional | null,
    status: row.status as StatusOperacional,
    motivo: row.motivo,
    alteradoPor: row.alterado_por,
    iniciadoEm: row.iniciado_em,
    encerradoEm: row.encerrado_em,
  };
}

async function fetchStatus(): Promise<StatusAtendente[]> {
  const { data, error } = await supabase.from('atendente_status').select('*');
  if (error) throw error;
  return (data || []).map(mapStatus);
}

export interface DefinirStatusInput {
  atendenteId: number;
  status: StatusOperacional;
  motivo?: string | null;
  previsaoRetorno?: string | null;
}

/**
 * Status operacional da equipe. A escrita passa obrigatoriamente pela função
 * `definir_status_atendente` do banco, que valida a permissão a partir do
 * usuário autenticado e grava status atual, histórico e auditoria na mesma
 * transação — as tabelas não têm policy de escrita direta.
 */
export function useStatusAtendentes() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: STATUS_KEY,
    queryFn: fetchStatus,
    staleTime: 15_000,
    retry: false,
  });

  const statusList = useMemo(() => statusQuery.data || [], [statusQuery.data]);

  const statusPorAtendente = useMemo(
    () => new Map(statusList.map((s) => [s.atendenteId, s])),
    [statusList]
  );

  // O líder vê a equipe mudar de status ao vivo. Canal com sufixo aleatório
  // porque o hook pode estar montado em mais de um componente ao mesmo tempo.
  useEffect(() => {
    const channel = supabase
      .channel(`atendente-status-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'atendente_status' },
        () => {
          queryClient.invalidateQueries({ queryKey: STATUS_KEY });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const definirStatus = useMutation({
    mutationFn: async (input: DefinirStatusInput) => {
      const { data, error } = await supabase.rpc('definir_status_atendente', {
        p_atendente_id: input.atendenteId,
        p_status: input.status,
        p_motivo: input.motivo ?? null,
        p_previsao_retorno: input.previsaoRetorno ?? null,
      });
      if (error) throw error;
      return data;
    },
    // Atualização otimista: a UI responde na hora, mas o estado anterior é
    // restaurado se o servidor recusar (status inválido, atendente inativo,
    // falta de permissão).
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: STATUS_KEY });
      const anterior = queryClient.getQueryData<StatusAtendente[]>(STATUS_KEY);

      queryClient.setQueryData<StatusAtendente[]>(STATUS_KEY, (atual) => {
        const lista = atual ? [...atual] : [];
        const idx = lista.findIndex((s) => s.atendenteId === input.atendenteId);
        const otimista: StatusAtendente = {
          atendenteId: input.atendenteId,
          status: input.status,
          motivo: input.motivo ?? null,
          previsaoRetorno: input.previsaoRetorno ?? null,
          alteradoEm: new Date().toISOString(),
          alteradoPor: null,
        };
        if (idx >= 0) lista[idx] = otimista;
        else lista.push(otimista);
        return lista;
      });

      return { anterior };
    },
    onError: (error, _input, context) => {
      if (context?.anterior) {
        queryClient.setQueryData(STATUS_KEY, context.anterior);
      }
      console.error('Erro ao alterar status:', error);
      const message = (error as { message?: string })?.message ?? '';
      toast.error('Não foi possível alterar o status', {
        description: message.includes('permissão')
          ? 'Você só pode alterar o seu próprio status.'
          : MIGRATION_HINT,
      });
    },
    onSuccess: (_data, input) => {
      toast.success(`Status alterado para ${STATUS_META[input.status].label}`);
      queryClient.invalidateQueries({ queryKey: STATUS_HISTORICO_KEY });
      queryClient.invalidateQueries({ queryKey: ['auditoria'] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_KEY });
    },
  });

  return {
    statusList,
    statusPorAtendente,
    loading: statusQuery.isPending,
    setupPendente: !!statusQuery.error,
    definirStatus,
  };
}

/** Histórico de status de um atendente (usado no painel de equipe). */
export function useStatusHistorico(atendenteId: number | null, limite = 20) {
  const query = useQuery({
    queryKey: [...STATUS_HISTORICO_KEY, atendenteId, limite],
    queryFn: async (): Promise<StatusHistorico[]> => {
      const { data, error } = await supabase
        .from('atendente_status_historico')
        .select('*')
        .eq('atendente_id', atendenteId as number)
        .order('iniciado_em', { ascending: false })
        .limit(limite);
      if (error) throw error;
      return (data || []).map(mapHistorico);
    },
    enabled: atendenteId !== null,
    staleTime: 30_000,
    retry: false,
  });

  return {
    historico: query.data || [],
    loading: query.isPending,
  };
}
