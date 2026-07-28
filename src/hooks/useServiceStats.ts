import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ServiceData {
  name: string;
  value: number;
}

async function fetchServiceStats(): Promise<ServiceData[]> {
  const { data, error } = await supabase
    .from('dados_cliente')
    .select('servico')
    .not('servico', 'is', null);

  if (error) throw error;

  const serviceCounts: Record<string, number> = {};
  data.forEach((item) => {
    if (item.servico) {
      serviceCounts[item.servico] = (serviceCounts[item.servico] || 0) + 1;
    }
  });

  return Object.entries(serviceCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function useServiceStats(enabled = true) {
  const query = useQuery({
    queryKey: ['metrics', 'services'],
    queryFn: fetchServiceStats,
    staleTime: 60_000,
    enabled,
  });

  return {
    services: query.data ?? [],
    loading: query.isPending,
    error: query.error ? 'Não foi possível carregar os dados de serviços.' : null,
    fetchServices: query.refetch,
  };
}
