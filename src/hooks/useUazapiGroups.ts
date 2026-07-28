import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listGroups, isUazapiConfigured, UazapiGroup } from '@/services/uazapi';

const GROUPS_KEY = ['uazapi-groups'];

/**
 * Grupos do WhatsApp via Uazapi, com cache compartilhado (react-query).
 * Usado para enriquecer as conversas de grupo (nome real, participantes)
 * e para o painel de informações do grupo.
 */
export function useUazapiGroups() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: GROUPS_KEY,
    queryFn: () => listGroups(),
    enabled: isUazapiConfigured(),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const groups: UazapiGroup[] = useMemo(() => query.data || [], [query.data]);

  const groupsByJid = useMemo(
    () => new Map(groups.map((group) => [group.jid, group])),
    [groups]
  );

  // Recarrega direto do WhatsApp (force=true) — usado no botão de atualizar
  const refreshGroups = async () => {
    const fresh = await listGroups(true);
    queryClient.setQueryData(GROUPS_KEY, fresh);
    return fresh;
  };

  return {
    groups,
    groupsByJid,
    loading: query.isPending && query.fetchStatus !== 'idle',
    error: query.error,
    refreshGroups,
  };
}
