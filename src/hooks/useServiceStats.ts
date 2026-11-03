import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';

export interface ServiceData {
  servico: string;
  name: string;
  value: number;
}

/**
 * Normaliza o nome do serviço para Title Case e remove espaços extras.
 */
function normalizeServiceName(raw: string): string {
  const cleaned = raw.trim();
  if (!cleaned) return '';

  const lower = cleaned.toLowerCase();
  if (
    [
      '-',
      'n/a',
      'nao informado',
      'não informado',
      'none',
      'nenhum',
      'null',
      'undefined',
    ].includes(lower)
  ) {
    return '';
  }

  // Preposições mantidas em minúsculo
  const prepositions = new Set(['e', 'de', 'da', 'do', 'em', 'com', 'para', 'a', 'o']);

  const words = cleaned.split(/\s+/);
  const formatted = words
    .map((w, idx) => {
      const l = w.toLowerCase();
      if (idx > 0 && prepositions.has(l)) {
        return l;
      }
      return l.charAt(0).toUpperCase() + l.slice(1);
    })
    .join(' ');

  return formatted;
}

/**
 * Extrai e normaliza serviços de uma string de texto.
 * Separa por vírgulas, barras e ponto-e-vírgula quando houver múltiplos serviços.
 */
function extractServices(raw?: string | null): string[] {
  if (!raw || typeof raw !== 'string') return [];

  const parts = raw.split(/[,;\/]/);
  const results: string[] = [];

  for (const part of parts) {
    const norm = normalizeServiceName(part);
    if (norm) {
      results.push(norm);
    }
  }

  return results;
}

async function fetchServiceStats(): Promise<ServiceData[]> {
  const serviceCounts: Record<string, number> = {};

  // 1. Busca serviços cadastrados em dados_cliente (paginado — a tabela já
  // passou das 1000 linhas que o PostgREST devolve por padrão)
  const clientData = await fetchAllRows<{ servico: string | null }>((from, to) =>
    supabase
      .from('dados_cliente')
      .select('servico')
      .not('servico', 'is', null)
      .order('id', { ascending: true })
      .range(from, to)
  );

  clientData.forEach((item) => {
    const services = extractServices(item.servico);
    services.forEach((s) => {
      serviceCounts[s] = (serviceCounts[s] || 0) + 1;
    });
  });

  // 2. Agrega histórico de serviços dos lembretes enviados (se acessível)
  try {
    const reminderData = await fetchAllRows<{ servico: string | null }>((from, to) =>
      supabase
        .from('lembrete_envios')
        .select('servico')
        .not('servico', 'is', null)
        .order('id', { ascending: true })
        .range(from, to)
    );

    reminderData.forEach((item) => {
      const services = extractServices(item.servico);
      services.forEach((s) => {
        serviceCounts[s] = (serviceCounts[s] || 0) + 1;
      });
    });
  } catch (err) {
    console.warn('Tabela lembrete_envios não consultada:', err);
  }

  return Object.entries(serviceCounts)
    .map(([servico, value]) => ({ servico, name: servico, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
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

