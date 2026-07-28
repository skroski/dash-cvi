import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RecentClient } from './useClientStats';

export interface DashboardSummary {
  totalClients: number;
  totalPets: number;
  newClientsThisMonth: number;
  recentClients: RecentClient[];
}

async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [totalRes, petsRes, newMonthRes, recentRes] = await Promise.all([
    supabase.from('dados_cliente').select('*', { count: 'exact', head: true }),
    supabase.from('dados_cliente').select('*', { count: 'exact', head: true }).not('nome_pet', 'is', null),
    supabase
      .from('dados_cliente')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString()),
    supabase
      .from('dados_cliente')
      .select('id, nome, telefone, nome_pet, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  if (totalRes.error) throw totalRes.error;

  const recentClients: RecentClient[] = recentRes.data?.map((client) => ({
    id: client.id,
    name: client.nome,
    phone: client.telefone,
    pets: client.nome_pet ? 1 : 0,
    lastVisit: new Date(client.created_at).toLocaleDateString('pt-BR'),
  })) || [];

  return {
    totalClients: totalRes.count || 0,
    totalPets: petsRes.count || 0,
    newClientsThisMonth: newMonthRes.count || 0,
    recentClients,
  };
}

export function useDashboardSummary() {
  const query = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: fetchDashboardSummary,
    staleTime: 60_000,
  });

  return {
    summary: query.data,
    loading: query.isPending,
    error: query.error ? 'Não foi possível carregar o resumo.' : null,
    refetch: query.refetch,
  };
}
