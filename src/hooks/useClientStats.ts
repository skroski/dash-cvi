import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MetricsPeriod, getPeriodStart, bucketKey, bucketLabels } from '@/lib/metricsPeriod';
import { fetchAllRows } from '@/lib/fetchAllRows';

export interface GrowthPoint {
  month: string;
  clients: number;
}

export interface PetBreed {
  name: string;
  value: number;
}

export interface RecentClient {
  id: number;
  name: string | null;
  phone: string | null;
  pets: number;
  lastVisit: string;
}

export interface ClientStats {
  totalClients: number;
  totalPets: number;
  newClientsThisMonth: number;
  monthlyGrowth: GrowthPoint[];
  petBreeds: PetBreed[];
  recentClients: RecentClient[];
}

const emptyStats: ClientStats = {
  totalClients: 0,
  totalPets: 0,
  newClientsThisMonth: 0,
  monthlyGrowth: [],
  petBreeds: [],
  recentClients: [],
};

async function fetchClientStats(period: MetricsPeriod): Promise<ClientStats> {
  const periodStart = getPeriodStart(period);

  // Contagens (head:true — sem transferir linhas)
  const [totalRes, petsRes, newMonthRes] = await Promise.all([
    supabase.from('dados_cliente').select('*', { count: 'exact', head: true }),
    supabase.from('dados_cliente').select('*', { count: 'exact', head: true }).not('nome_pet', 'is', null),
    supabase
      .from('dados_cliente')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ]);

  if (totalRes.error) throw totalRes.error;

  // Crescimento: tenta RPC no PostgreSQL; caso não esteja disponível, faz query limitada ao período
  let monthlyGrowth: GrowthPoint[] = [];
  try {
    const { data: rpcGrowth, error: rpcGrowthErr } = await (supabase.rpc as any)('get_client_growth_stats', {
      p_start_date: periodStart.toISOString(),
    });
    if (!rpcGrowthErr && Array.isArray(rpcGrowth)) {
      const buckets: Record<string, number> = {};
      bucketLabels(period).forEach((label) => {
        buckets[label] = 0;
      });
      rpcGrowth.forEach((r: any) => {
        if (r.bucket && r.bucket in buckets) {
          buckets[r.bucket] = Number(r.count) || 0;
        }
      });
      monthlyGrowth = Object.entries(buckets).map(([month, clients]) => ({
        month,
        clients,
      }));
    } else {
      throw rpcGrowthErr;
    }
  } catch {
    const createdRows = await fetchAllRows<{ created_at: string | null }>((from, to) =>
      supabase
        .from('dados_cliente')
        .select('created_at')
        .gte('created_at', periodStart.toISOString())
        .order('id', { ascending: true })
        .range(from, to)
    );

    const buckets: Record<string, number> = {};
    bucketLabels(period).forEach((label) => {
      buckets[label] = 0;
    });
    createdRows.forEach((row) => {
      if (!row.created_at) return;
      const key = bucketKey(new Date(row.created_at), period);
      if (key in buckets) buckets[key]++;
    });
    monthlyGrowth = Object.entries(buckets).map(([month, clients]) => ({
      month,
      clients,
    }));
  }

  // Raças de pets: tenta RPC no PostgreSQL (agrega em ~1 KB no banco); fallback leve limit 1000
  let petBreeds: PetBreed[] = [];
  try {
    const { data: rpcBreeds, error: rpcErr } = await (supabase.rpc as any)('get_pet_breed_stats');
    if (!rpcErr && Array.isArray(rpcBreeds)) {
      petBreeds = rpcBreeds.map((r: any) => ({ name: r.name, value: Number(r.value) || 0 }));
    } else {
      throw rpcErr;
    }
  } catch {
    const { data: fallbackPets } = await supabase
      .from('dados_cliente')
      .select('raca_pet')
      .not('raca_pet', 'is', null)
      .order('id', { ascending: false })
      .limit(1000);

    const breedCounts: Record<string, number> = {};
    (fallbackPets || []).forEach((pet) => {
      if (pet.raca_pet) {
        breedCounts[pet.raca_pet] = (breedCounts[pet.raca_pet] || 0) + 1;
      }
    });
    petBreeds = Object.entries(breedCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }

  // Clientes recentes
  const { data: recentClientsData } = await supabase
    .from('dados_cliente')
    .select('id, nome, telefone, nome_pet, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const recentClients: RecentClient[] = recentClientsData?.map((client) => ({
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
    monthlyGrowth,
    petBreeds,
    recentClients,
  };
}

export function useClientStats(period: MetricsPeriod = '30d', enabled = true) {
  const query = useQuery({
    queryKey: ['metrics', 'clients', period],
    queryFn: () => fetchClientStats(period),
    staleTime: 60_000,
    enabled,
  });

  return {
    stats: query.data ?? emptyStats,
    loading: query.isPending,
    error: query.error ? 'Não foi possível carregar as estatísticas de clientes.' : null,
    refetchStats: query.refetch,
  };
}
