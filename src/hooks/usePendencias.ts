import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { ClientPendencia, PendenciaStatus, PendenciaTipo } from '@/types/crm';

const TIPOS_KEY = ['pendencia-tipos'];
const PENDENCIAS_KEY = ['client-pendencias'];

const MIGRATION_HINT =
  'Verifique se a migração de pendências/tags foi aplicada no Supabase.';

function mapPendencia(row: Tables<'client_pendencias'>): ClientPendencia {
  return {
    id: row.id,
    clientId: row.client_id,
    tipoId: row.tipo_id,
    descricao: row.descricao,
    observacao: row.observacao,
    status: (row.status as PendenciaStatus) || 'pendente',
    createdAt: row.created_at,
    concluidaEm: row.concluida_em,
  };
}

async function fetchTipos(): Promise<PendenciaTipo[]> {
  const { data, error } = await supabase
    .from('pendencia_tipos')
    .select('id, nome')
    .order('nome');
  if (error) throw error;
  return data || [];
}

async function fetchPendencias(): Promise<ClientPendencia[]> {
  const { data, error } = await supabase
    .from('client_pendencias')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapPendencia);
}

export function usePendencias() {
  const queryClient = useQueryClient();

  const tiposQuery = useQuery({
    queryKey: TIPOS_KEY,
    queryFn: fetchTipos,
    staleTime: 60_000,
    retry: false,
  });

  const pendenciasQuery = useQuery({
    queryKey: PENDENCIAS_KEY,
    queryFn: fetchPendencias,
    staleTime: 30_000,
    retry: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: PENDENCIAS_KEY });
  };

  const pendencias = useMemo(() => pendenciasQuery.data || [], [pendenciasQuery.data]);

  // Pendências abertas agrupadas por cliente (usado em filtros e badges)
  const abertasPorCliente = useMemo(() => {
    const map = new Map<number, ClientPendencia[]>();
    for (const p of pendencias) {
      if (p.status !== 'pendente') continue;
      const list = map.get(p.clientId);
      if (list) {
        list.push(p);
      } else {
        map.set(p.clientId, [p]);
      }
    }
    return map;
  }, [pendencias]);

  const addPendencia = useMutation({
    mutationFn: async (input: { clientId: number; descricao: string; tipoId?: number | null }) => {
      const { error } = await supabase.from('client_pendencias').insert({
        client_id: input.clientId,
        descricao: input.descricao.trim(),
        tipo_id: input.tipoId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Pendência adicionada');
    },
    onError: (error) => {
      console.error('Erro ao adicionar pendência:', error);
      toast.error('Erro ao adicionar pendência', { description: MIGRATION_HINT });
    },
  });

  const togglePendencia = useMutation({
    mutationFn: async (pendencia: ClientPendencia) => {
      const concluir = pendencia.status === 'pendente';
      const { error } = await supabase
        .from('client_pendencias')
        .update({
          status: concluir ? 'concluida' : 'pendente',
          concluida_em: concluir ? new Date().toISOString() : null,
        })
        .eq('id', pendencia.id);
      if (error) throw error;
      return concluir;
    },
    onSuccess: (concluiu) => {
      invalidate();
      toast.success(concluiu ? 'Pendência concluída' : 'Pendência reaberta');
    },
    onError: (error) => {
      console.error('Erro ao atualizar pendência:', error);
      toast.error('Erro ao atualizar pendência');
    },
  });

  const removePendencia = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('client_pendencias').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Pendência removida');
    },
    onError: (error) => {
      console.error('Erro ao remover pendência:', error);
      toast.error('Erro ao remover pendência');
    },
  });

  const addTipo = useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase.from('pendencia_tipos').insert({ nome: nome.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIPOS_KEY });
      toast.success('Tipo de pendência adicionado');
    },
    onError: (error) => {
      console.error('Erro ao adicionar tipo de pendência:', error);
      toast.error('Erro ao adicionar tipo', {
        description:
          (error as PostgrestError)?.code === '23505'
            ? 'Já existe um tipo com esse nome.'
            : MIGRATION_HINT,
      });
    },
  });

  const renameTipo = useMutation({
    mutationFn: async (input: { id: number; nome: string }) => {
      const { error } = await supabase
        .from('pendencia_tipos')
        .update({ nome: input.nome.trim() })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIPOS_KEY });
      toast.success('Tipo de pendência atualizado');
    },
    onError: (error) => {
      console.error('Erro ao renomear tipo de pendência:', error);
      toast.error('Erro ao atualizar tipo', {
        description:
          (error as PostgrestError)?.code === '23505'
            ? 'Já existe um tipo com esse nome.'
            : undefined,
      });
    },
  });

  const removeTipo = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('pendencia_tipos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIPOS_KEY });
      // Pendências existentes mantêm a descrição; apenas o vínculo com o tipo é desfeito
      invalidate();
      toast.success('Tipo de pendência removido');
    },
    onError: (error) => {
      console.error('Erro ao remover tipo de pendência:', error);
      toast.error('Erro ao remover tipo');
    },
  });

  return {
    tipos: tiposQuery.data || [],
    tiposLoading: tiposQuery.isPending,
    pendencias,
    pendenciasLoading: pendenciasQuery.isPending,
    setupError: !!(tiposQuery.error || pendenciasQuery.error),
    abertasPorCliente,
    addPendencia,
    togglePendencia,
    removePendencia,
    addTipo,
    renameTipo,
    removeTipo,
  };
}
