import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import {
  AUDITORIA_PAGE_SIZE,
  AuditoriaEvento,
  AuditoriaFiltros,
} from '@/types/auditoria';

function mapEvento(row: Tables<'auditoria_eventos'>): AuditoriaEvento {
  return {
    id: row.id,
    acao: row.acao,
    entidade: row.entidade,
    entidadeId: row.entidade_id,
    atorUserId: row.ator_user_id,
    atorAtendenteId: row.ator_atendente_id,
    atorNome: row.ator_nome,
    alvoAtendenteId: row.alvo_atendente_id,
    alvoUserId: row.alvo_user_id,
    atendimentoId: row.atendimento_id,
    sessionId: row.session_id,
    dados: (row.dados as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at,
  };
}

const FILTROS_VAZIOS: AuditoriaFiltros = {
  acao: null,
  atendenteId: null,
  de: null,
  ate: null,
};

/**
 * Consulta paginada da trilha de auditoria.
 *
 * Filtros e paginação são resolvidos no banco (nunca carregando a trilha
 * inteira na tela) e o escopo de leitura já é limitado por RLS: gestor vê a
 * organização, atendente vê apenas os eventos em que é ator ou alvo.
 */
export function useAuditoria() {
  const [filtros, setFiltros] = useState<AuditoriaFiltros>(FILTROS_VAZIOS);
  const [pagina, setPagina] = useState(0);

  const query = useQuery({
    queryKey: ['auditoria', filtros, pagina],
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: false,
    queryFn: async () => {
      let request = supabase
        .from('auditoria_eventos')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(pagina * AUDITORIA_PAGE_SIZE, pagina * AUDITORIA_PAGE_SIZE + AUDITORIA_PAGE_SIZE - 1);

      if (filtros.acao) request = request.eq('acao', filtros.acao);
      if (filtros.atendenteId !== null) {
        request = request.or(
          `ator_atendente_id.eq.${filtros.atendenteId},alvo_atendente_id.eq.${filtros.atendenteId}`
        );
      }
      if (filtros.de) request = request.gte('created_at', filtros.de);
      if (filtros.ate) request = request.lte('created_at', filtros.ate);

      const { data, error, count } = await request;
      if (error) throw error;
      return { eventos: (data || []).map(mapEvento), total: count ?? 0 };
    },
  });

  const aplicarFiltros = (novos: Partial<AuditoriaFiltros>) => {
    setFiltros((atual) => ({ ...atual, ...novos }));
    setPagina(0); // um filtro novo sempre volta para a primeira página
  };

  const limparFiltros = () => {
    setFiltros(FILTROS_VAZIOS);
    setPagina(0);
  };

  const total = query.data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / AUDITORIA_PAGE_SIZE));

  return {
    eventos: query.data?.eventos ?? [],
    total,
    pagina,
    totalPaginas,
    setPagina,
    filtros,
    aplicarFiltros,
    limparFiltros,
    loading: query.isPending,
    fetching: query.isFetching,
    setupPendente: !!query.error,
  };
}
