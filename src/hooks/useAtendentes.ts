import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Atendente, Departamento } from '@/types/atendimento';

const DEPARTAMENTOS_KEY = ['departamentos'];
const ATENDENTES_KEY = ['atendentes'];

const MIGRATION_HINT =
  'Verifique se a migração de atendentes/departamentos foi aplicada no Supabase.';

function mapAtendente(row: Tables<'atendentes'>): Atendente {
  return {
    id: row.id,
    nome: row.nome,
    cargo: row.cargo,
    telefone: row.telefone,
    departamentoId: row.departamento_id,
    ativo: row.ativo,
  };
}

async function fetchDepartamentos(): Promise<Departamento[]> {
  const { data, error } = await supabase
    .from('departamentos')
    .select('id, nome, cor')
    .order('nome');
  if (error) throw error;
  return data || [];
}

async function fetchAtendentes(): Promise<Atendente[]> {
  const { data, error } = await supabase.from('atendentes').select('*').order('nome');
  if (error) throw error;
  return (data || []).map(mapAtendente);
}

export function useAtendentes() {
  const queryClient = useQueryClient();

  const departamentosQuery = useQuery({
    queryKey: DEPARTAMENTOS_KEY,
    queryFn: fetchDepartamentos,
    staleTime: 60_000,
    retry: false,
  });

  const atendentesQuery = useQuery({
    queryKey: ATENDENTES_KEY,
    queryFn: fetchAtendentes,
    staleTime: 60_000,
    retry: false,
  });

  const departamentos = useMemo(
    () => departamentosQuery.data || [],
    [departamentosQuery.data]
  );
  const atendentes = useMemo(() => atendentesQuery.data || [], [atendentesQuery.data]);

  const departamentoById = useMemo(
    () => new Map(departamentos.map((dep) => [dep.id, dep])),
    [departamentos]
  );
  const atendenteById = useMemo(
    () => new Map(atendentes.map((a) => [a.id, a])),
    [atendentes]
  );

  // Atendentes agrupados por departamento (null = sem departamento)
  const atendentesPorDepartamento = useMemo(() => {
    const map = new Map<number | null, Atendente[]>();
    for (const atendente of atendentes) {
      const list = map.get(atendente.departamentoId);
      if (list) {
        list.push(atendente);
      } else {
        map.set(atendente.departamentoId, [atendente]);
      }
    }
    return map;
  }, [atendentes]);

  const invalidateDepartamentos = () =>
    queryClient.invalidateQueries({ queryKey: DEPARTAMENTOS_KEY });
  const invalidateAtendentes = () =>
    queryClient.invalidateQueries({ queryKey: ATENDENTES_KEY });

  const createDepartamento = useMutation({
    mutationFn: async (input: { nome: string; cor: string }) => {
      const { error } = await supabase
        .from('departamentos')
        .insert({ nome: input.nome.trim(), cor: input.cor });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateDepartamentos();
      toast.success('Departamento criado');
    },
    onError: (error) => {
      console.error('Erro ao criar departamento:', error);
      toast.error('Erro ao criar departamento', {
        description:
          (error as PostgrestError)?.code === '23505'
            ? 'Já existe um departamento com esse nome.'
            : MIGRATION_HINT,
      });
    },
  });

  const updateDepartamento = useMutation({
    mutationFn: async (input: { id: number; nome: string; cor: string }) => {
      const { error } = await supabase
        .from('departamentos')
        .update({ nome: input.nome.trim(), cor: input.cor })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateDepartamentos();
      toast.success('Departamento atualizado');
    },
    onError: (error) => {
      console.error('Erro ao atualizar departamento:', error);
      toast.error('Erro ao atualizar departamento', {
        description:
          (error as PostgrestError)?.code === '23505'
            ? 'Já existe um departamento com esse nome.'
            : undefined,
      });
    },
  });

  const deleteDepartamento = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('departamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateDepartamentos();
      // Atendentes do departamento removido ficam "sem departamento"
      invalidateAtendentes();
      toast.success('Departamento removido');
    },
    onError: (error) => {
      console.error('Erro ao remover departamento:', error);
      toast.error('Erro ao remover departamento');
    },
  });

  const createAtendente = useMutation({
    mutationFn: async (input: {
      nome: string;
      cargo: string;
      telefone: string | null;
      departamentoId: number | null;
    }) => {
      const { error } = await supabase.from('atendentes').insert({
        nome: input.nome.trim(),
        cargo: input.cargo.trim(),
        telefone: input.telefone?.trim() || null,
        departamento_id: input.departamentoId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAtendentes();
      toast.success('Atendente adicionado');
    },
    onError: (error) => {
      console.error('Erro ao adicionar atendente:', error);
      toast.error('Erro ao adicionar atendente', {
        description:
          (error as PostgrestError)?.code === '23505'
            ? 'Já existe um atendente com esse nome.'
            : MIGRATION_HINT,
      });
    },
  });

  const updateAtendente = useMutation({
    mutationFn: async (input: {
      id: number;
      nome: string;
      cargo: string;
      telefone: string | null;
      departamentoId: number | null;
      ativo: boolean;
    }) => {
      const { error } = await supabase
        .from('atendentes')
        .update({
          nome: input.nome.trim(),
          cargo: input.cargo.trim(),
          telefone: input.telefone?.trim() || null,
          departamento_id: input.departamentoId,
          ativo: input.ativo,
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAtendentes();
      toast.success('Atendente atualizado');
    },
    onError: (error) => {
      console.error('Erro ao atualizar atendente:', error);
      const pgError = error as PostgrestError;
      let description: string | undefined;
      if (pgError?.code === '23505') {
        description = 'Já existe um atendente com esse nome.';
      } else if (pgError?.code === 'PGRST204' || pgError?.message?.includes('telefone')) {
        description = 'Coluna "telefone" não existe no Supabase. Execute a migração 20260719120000_atendente_telefone.sql no SQL Editor.';
      }
      toast.error('Erro ao atualizar atendente', { description });
    },
  });

  const deleteAtendente = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('atendentes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAtendentes();
      toast.success('Atendente removido');
    },
    onError: (error) => {
      console.error('Erro ao remover atendente:', error);
      toast.error('Erro ao remover atendente');
    },
  });

  return {
    departamentos,
    atendentes,
    loading: departamentosQuery.isPending || atendentesQuery.isPending,
    setupError: !!(departamentosQuery.error || atendentesQuery.error),
    departamentoById,
    atendenteById,
    atendentesPorDepartamento,
    createDepartamento,
    updateDepartamento,
    deleteDepartamento,
    createAtendente,
    updateAtendente,
    deleteAtendente,
  };
}
