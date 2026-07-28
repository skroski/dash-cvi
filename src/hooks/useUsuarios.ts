import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PERFIL_KEY, mapPerfil } from '@/hooks/usePerfil';
import { Papel, Perfil } from '@/types/perfil';

const USUARIOS_KEY = ['usuarios'];

const MIGRATION_HINT =
  'Verifique se a migração 20260725100000_perfis_papeis.sql foi aplicada no Supabase.';

async function fetchUsuarios(): Promise<Perfil[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('nome', { nullsFirst: false });
  if (error) throw error;
  return (data || []).map(mapPerfil);
}

/**
 * Usuários do painel. A leitura já é filtrada por RLS (gestor vê todos, os
 * demais só a si mesmos) e toda tentativa de alterar papel, vínculo ou situação
 * sem ser admin é recusada pelo banco — a interface apenas reflete isso.
 */
export function useUsuarios() {
  const queryClient = useQueryClient();

  const usuariosQuery = useQuery({
    queryKey: USUARIOS_KEY,
    queryFn: fetchUsuarios,
    staleTime: 30_000,
    retry: false,
  });

  const usuarios = useMemo(() => usuariosQuery.data || [], [usuariosQuery.data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: USUARIOS_KEY });
    queryClient.invalidateQueries({ queryKey: PERFIL_KEY });
    queryClient.invalidateQueries({ queryKey: ['auditoria'] });
  };

  const tratarErro = (error: unknown, acao: string) => {
    console.error(`Erro ao ${acao}:`, error);
    const message = (error as { message?: string })?.message ?? '';
    let description = MIGRATION_HINT;
    if (message.includes('último administrador')) {
      description = 'O sistema precisa de pelo menos um administrador ativo.';
    } else if (message.includes('Sem permissão')) {
      description = 'Apenas administradores podem alterar papel, vínculo ou situação.';
    } else if (message.includes('duplicate key')) {
      description = 'Este cadastro de atendente já está vinculado a outro login.';
    }
    toast.error(`Não foi possível ${acao}`, { description });
  };

  const atualizarPapel = useMutation({
    mutationFn: async (input: { id: string; papel: Papel }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ papel: input.papel })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Papel atualizado');
    },
    onError: (error) => tratarErro(error, 'alterar o papel'),
  });

  const atualizarAtivo = useMutation({
    mutationFn: async (input: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ ativo: input.ativo })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_data, input) => {
      invalidate();
      toast.success(input.ativo ? 'Usuário liberado' : 'Usuário desativado');
    },
    onError: (error) => tratarErro(error, 'alterar a situação'),
  });

  const atualizarVinculo = useMutation({
    mutationFn: async (input: { id: string; atendenteId: number | null }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ atendente_id: input.atendenteId })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Vínculo atualizado');
    },
    onError: (error) => tratarErro(error, 'alterar o vínculo'),
  });

  return {
    usuarios,
    loading: usuariosQuery.isPending,
    setupPendente: !!usuariosQuery.error,
    atualizarPapel,
    atualizarAtivo,
    atualizarVinculo,
  };
}
