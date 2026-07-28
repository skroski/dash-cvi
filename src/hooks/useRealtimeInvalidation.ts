import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Invalida as queries de métricas/resumo quando há mudanças em dados_cliente.
 * Substitui o antigo useDashboardRealtime, que atualizava estado descartado.
 */
export function useRealtimeInvalidation() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-invalidation')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'dados_cliente' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['metrics'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
