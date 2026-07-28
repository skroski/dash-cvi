import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import {
  Atendimento,
  AtendimentoStatus,
  AtendimentoTransferencia,
} from '@/types/atendimento';
import { isUazapiConfigured, sendText } from '@/services/uazapi';
import { toWhatsappNumber } from '@/lib/formatters';
import { criarNotificacao } from './useNotificacoes';

const ATENDIMENTOS_KEY = ['atendimentos'];
const TRANSFERENCIAS_KEY = ['atendimento-transferencias'];

const MIGRATION_HINT =
  'Verifique se a migração de atendentes/departamentos foi aplicada no Supabase.';

/**
 * Notifica o atendente responsável via WhatsApp (Uazapi). Best-effort: sem
 * telefone ou sem Uazapi configurada, apenas ignora; falhas de envio não
 * interrompem a atribuição/transferência (a notificação interna já foi criada).
 */
async function notificarAtendenteWhatsapp(input: {
  telefone: string | null | undefined;
  titulo: string;
  linhas: (string | null | undefined)[];
}): Promise<void> {
  const numero = toWhatsappNumber(input.telefone);
  if (!numero || !isUazapiConfigured()) return;

  const corpo = [`*${input.titulo}*`, ...input.linhas.filter(Boolean)].join('\n');
  try {
    await sendText(numero, corpo);
  } catch (error) {
    console.error('Erro ao notificar atendente via WhatsApp:', error);
  }
}

function mapAtendimento(row: Tables<'atendimentos'>): Atendimento {
  return {
    id: row.id,
    sessionId: row.session_id,
    clientId: row.client_id,
    atendenteId: row.atendente_id,
    departamentoId: row.departamento_id,
    status: (row.status as AtendimentoStatus) || 'aberto',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    encerradoEm: row.encerrado_em,
  };
}

function mapTransferencia(
  row: Tables<'atendimento_transferencias'>
): AtendimentoTransferencia {
  return {
    id: row.id,
    atendimentoId: row.atendimento_id,
    deAtendenteId: row.de_atendente_id,
    paraAtendenteId: row.para_atendente_id,
    deDepartamentoId: row.de_departamento_id,
    paraDepartamentoId: row.para_departamento_id,
    motivo: row.motivo,
    createdAt: row.created_at,
  };
}

async function fetchAtendimentosAbertos(): Promise<Atendimento[]> {
  const { data, error } = await supabase
    .from('atendimentos')
    .select('*')
    .eq('status', 'aberto')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapAtendimento);
}

async function fetchTransferencias(): Promise<AtendimentoTransferencia[]> {
  const { data, error } = await supabase
    .from('atendimento_transferencias')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data || []).map(mapTransferencia);
}

export function useAtendimentos() {
  const queryClient = useQueryClient();

  const atendimentosQuery = useQuery({
    queryKey: ATENDIMENTOS_KEY,
    queryFn: fetchAtendimentosAbertos,
    staleTime: 15_000,
    retry: false,
  });

  const transferenciasQuery = useQuery({
    queryKey: TRANSFERENCIAS_KEY,
    queryFn: fetchTransferencias,
    staleTime: 30_000,
    retry: false,
  });

  const atendimentos = useMemo(
    () => atendimentosQuery.data || [],
    [atendimentosQuery.data]
  );
  const transferencias = useMemo(
    () => transferenciasQuery.data || [],
    [transferenciasQuery.data]
  );

  // Atendimento aberto de cada conversa (usado no header do chat)
  const atendimentoPorSession = useMemo(
    () => new Map(atendimentos.map((a) => [a.sessionId, a])),
    [atendimentos]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ATENDIMENTOS_KEY });
    queryClient.invalidateQueries({ queryKey: TRANSFERENCIAS_KEY });
    queryClient.invalidateQueries({ queryKey: ['notificacoes'] });
  };

  // Mantém os dashboards abertos em sincronia quando outro usuário
  // vincula/transfere/encerra um atendimento. Nome do canal é único por
  // instância: o hook é montado em mais de um componente ao mesmo tempo.
  useEffect(() => {
    const channel = supabase
      .channel(`atendimentos-realtime-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'atendimentos' },
        () => {
          queryClient.invalidateQueries({ queryKey: ATENDIMENTOS_KEY });
          queryClient.invalidateQueries({ queryKey: TRANSFERENCIAS_KEY });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const vincular = useMutation({
    mutationFn: async (input: {
      sessionId: string;
      clientId?: number | null;
      clienteNome?: string;
      atendenteId: number;
      atendenteNome: string;
      atendenteTelefone?: string | null;
      departamentoId: number | null;
      departamentoNome?: string;
      mensagemAdicional?: string;
    }) => {
      // Se a conversa já tem atendimento aberto, apenas atualiza o vínculo
      const { data: existente, error: buscaError } = await supabase
        .from('atendimentos')
        .select('id')
        .eq('session_id', input.sessionId)
        .eq('status', 'aberto')
        .maybeSingle();
      if (buscaError) throw buscaError;

      let atendimentoId: number;
      if (existente) {
        const { error } = await supabase
          .from('atendimentos')
          .update({
            atendente_id: input.atendenteId,
            departamento_id: input.departamentoId,
            client_id: input.clientId ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existente.id);
        if (error) throw error;
        atendimentoId = existente.id;
      } else {
        const { data, error } = await supabase
          .from('atendimentos')
          .insert({
            session_id: input.sessionId,
            client_id: input.clientId ?? null,
            atendente_id: input.atendenteId,
            departamento_id: input.departamentoId,
          })
          .select('id')
          .single();
        if (error) throw error;
        atendimentoId = data.id;
      }

      const mensagem = input.mensagemAdicional?.trim();

      await criarNotificacao({
        tipo: 'atribuicao',
        titulo: `Atendimento atribuído a ${input.atendenteNome}`,
        descricao: [
          input.clienteNome ? `Cliente: ${input.clienteNome}` : null,
          input.departamentoNome ? `Departamento: ${input.departamentoNome}` : null,
          mensagem ? `Mensagem: ${mensagem}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        sessionId: input.sessionId,
        atendimentoId,
        atendenteId: input.atendenteId,
        departamentoId: input.departamentoId,
      });

      await notificarAtendenteWhatsapp({
        telefone: input.atendenteTelefone,
        titulo: '🔔 Novo atendimento atribuído a você',
        linhas: [
          input.clienteNome ? `Cliente: ${input.clienteNome}` : null,
          input.departamentoNome ? `Departamento: ${input.departamentoNome}` : null,
          mensagem ? `\n${mensagem}` : null,
        ],
      });
    },
    onSuccess: (_, input) => {
      invalidate();
      toast.success(`Atendimento atribuído a ${input.atendenteNome}`);
    },
    onError: (error) => {
      console.error('Erro ao vincular atendimento:', error);
      toast.error('Erro ao vincular atendimento', { description: MIGRATION_HINT });
    },
  });

  const transferir = useMutation({
    mutationFn: async (input: {
      atendimento: Atendimento;
      clienteNome?: string;
      paraAtendenteId: number;
      paraAtendenteNome: string;
      paraAtendenteTelefone?: string | null;
      paraDepartamentoId: number | null;
      paraDepartamentoNome?: string;
      deAtendenteNome?: string;
      motivo?: string;
    }) => {
      const { atendimento } = input;

      const { error: updateError } = await supabase
        .from('atendimentos')
        .update({
          atendente_id: input.paraAtendenteId,
          departamento_id: input.paraDepartamentoId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', atendimento.id);
      if (updateError) throw updateError;

      const { error: transferenciaError } = await supabase
        .from('atendimento_transferencias')
        .insert({
          atendimento_id: atendimento.id,
          de_atendente_id: atendimento.atendenteId,
          para_atendente_id: input.paraAtendenteId,
          de_departamento_id: atendimento.departamentoId,
          para_departamento_id: input.paraDepartamentoId,
          motivo: input.motivo?.trim() || null,
        });
      if (transferenciaError) throw transferenciaError;

      const motivo = input.motivo?.trim();

      await criarNotificacao({
        tipo: 'transferencia',
        titulo: `Atendimento transferido para ${input.paraAtendenteNome}`,
        descricao: [
          input.clienteNome ? `Cliente: ${input.clienteNome}` : null,
          input.deAtendenteNome ? `De: ${input.deAtendenteNome}` : null,
          input.paraDepartamentoNome
            ? `Departamento: ${input.paraDepartamentoNome}`
            : null,
          motivo ? `Motivo: ${motivo}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        sessionId: atendimento.sessionId,
        atendimentoId: atendimento.id,
        atendenteId: input.paraAtendenteId,
        departamentoId: input.paraDepartamentoId,
      });

      await notificarAtendenteWhatsapp({
        telefone: input.paraAtendenteTelefone,
        titulo: '🔄 Atendimento transferido para você',
        linhas: [
          input.clienteNome ? `Cliente: ${input.clienteNome}` : null,
          input.deAtendenteNome ? `De: ${input.deAtendenteNome}` : null,
          input.paraDepartamentoNome
            ? `Departamento: ${input.paraDepartamentoNome}`
            : null,
          motivo ? `\n${motivo}` : null,
        ],
      });
    },
    onSuccess: (_, input) => {
      invalidate();
      toast.success(`Atendimento transferido para ${input.paraAtendenteNome}`);
    },
    onError: (error) => {
      console.error('Erro ao transferir atendimento:', error);
      toast.error('Erro ao transferir atendimento', { description: MIGRATION_HINT });
    },
  });

  const encerrar = useMutation({
    mutationFn: async (input: {
      atendimento: Atendimento;
      clienteNome?: string;
      atendenteNome?: string;
    }) => {
      const { atendimento } = input;
      const { error } = await supabase
        .from('atendimentos')
        .update({
          status: 'encerrado',
          encerrado_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', atendimento.id);
      if (error) throw error;

      await criarNotificacao({
        tipo: 'encerramento',
        titulo: 'Atendimento encerrado',
        descricao: [
          input.clienteNome ? `Cliente: ${input.clienteNome}` : null,
          input.atendenteNome ? `Atendente: ${input.atendenteNome}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        sessionId: atendimento.sessionId,
        atendimentoId: atendimento.id,
        atendenteId: atendimento.atendenteId,
        departamentoId: atendimento.departamentoId,
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success('Atendimento encerrado');
    },
    onError: (error) => {
      console.error('Erro ao encerrar atendimento:', error);
      toast.error('Erro ao encerrar atendimento');
    },
  });

  return {
    atendimentos,
    transferencias,
    loading: atendimentosQuery.isPending,
    setupError: !!atendimentosQuery.error,
    atendimentoPorSession,
    vincular,
    transferir,
    encerrar,
  };
}
