import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Papel, Perfil } from '@/types/perfil';

export const PERFIL_KEY = ['perfil'];

export function mapPerfil(row: Tables<'profiles'>): Perfil {
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    papel: (row.papel as Papel) || 'atendente',
    atendenteId: row.atendente_id,
    ativo: row.ativo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapPerfil(data) : null;
}

/**
 * Perfil do usuário logado — fonte de verdade de papel e vínculo com a equipe.
 *
 * Enquanto a migração `20260725100000_perfis_papeis.sql` não for aplicada, a
 * consulta falha e `setupPendente` fica true; nesse caso o painel mantém o
 * comportamento anterior (login único, atendente escolhido no header) em vez de
 * travar o acesso de quem já usa o sistema.
 */
export function usePerfil(userId: string | null) {
  const query = useQuery({
    queryKey: [...PERFIL_KEY, userId],
    queryFn: () => fetchPerfil(userId as string),
    enabled: !!userId,
    staleTime: 60_000,
    retry: false,
  });

  return {
    perfil: query.data ?? null,
    loading: !!userId && query.isPending,
    setupPendente: !!query.error,
  };
}
