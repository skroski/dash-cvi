import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as { rpc: (fn: string) => any };

/**
 * Nome do assistente e da empresa (configurados em Config. do atendimento) para os textos da interface.
 * Enquanto carrega, ou se a migração ainda não foi aplicada, usa expressões genéricas.
 */
export function useIdentidadeAtendimento() {
  const { data } = useQuery({
    queryKey: ['identidade-atendimento'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await db.rpc('obter_identidade_atendimento');
      if (error) return null;
      const linha = Array.isArray(data) ? data[0] : data;
      return (linha ?? null) as { nome_empresa: string; nome_assistente: string } | null;
    },
  });
  const nomeAssistente = data?.nome_assistente?.trim() || '';
  // Para frases: o nome configurado (ex.: "Balthazar") ou, sem nome configurado, "o assistente virtual" (use capitalizar() no início da frase).
  const rotuloAssistente = nomeAssistente && nomeAssistente !== 'Assistente' ? nomeAssistente : 'o assistente virtual';
  return { nomeAssistente, rotuloAssistente, nomeEmpresa: data?.nome_empresa?.trim() || '' };
}

export const capitalizar = (texto: string) => (texto ? texto[0].toUpperCase() + texto.slice(1) : texto);
