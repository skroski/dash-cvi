import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook de invalidação em tempo real do dashboard.
 *
 * NOTA (Otimização de Egress):
 * A escuta indiscriminada de postgres_changes na tabela dados_cliente foi desativada
 * para evitar tempestades de revalidação e download contínuo de tabelas inteiras
 * a cada webhook/mensagem recebida no WhatsApp/n8n.
 * As métricas utilizam staleTime e revalidação sob demanda (troca de abas / foco).
 */
export function useRealtimeInvalidation() {
  // Desativado intencionalmente para proteção de Realtime e Database Egress.
}
