import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PostgrestError } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import {
  SatisfactionConfiguration,
  SatisfactionConfigurationInput,
  SatisfactionDelivery,
  SatisfactionDeliveryStatus,
  SatisfactionResponse,
} from '@/types/satisfaction';
import {
  SatisfactionSpreadsheetImportRow,
  SpreadsheetImportResult,
} from '@/types/spreadsheet';

const CONFIGURATIONS_KEY = ['satisfaction-configurations'];
const DELIVERIES_KEY = ['satisfaction-deliveries'];
const RESPONSES_KEY = ['satisfaction-responses'];
const MIGRATION_HINT =
  'Aplique a migração supabase/migrations/20260716130000_pesquisas_satisfacao.sql e recarregue a página.';

function mapConfiguration(
  row: Tables<'pesquisa_satisfacao_configuracoes'>
): SatisfactionConfiguration {
  return {
    id: row.id,
    name: row.nome,
    enabled: row.ativo,
    googleFormId: row.google_form_id,
    googleFormUrl: row.google_form_url,
    googleTokenEntryId: row.google_token_entry_id,
    messageTemplate: row.mensagem_template,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDelivery(
  row: Tables<'pesquisa_satisfacao_envios'>
): SatisfactionDelivery {
  return {
    id: row.id,
    configurationId: row.configuracao_id,
    configurationName: row.configuracao_nome,
    clientId: row.client_id,
    appointmentKey: row.agendamento_chave,
    appointmentDate: row.data_agendada,
    appointmentTime: row.horario_agendado,
    service: row.servico,
    petName: row.nome_pet,
    ownerName: row.nome_tutor,
    phone: row.telefone,
    normalizedPhone: row.telefone_normalizado,
    email: row.email,
    status: row.status as SatisfactionDeliveryStatus,
    trackingToken: row.tracking_token,
    surveyLink: row.link_pesquisa,
    providerMessageId: row.provider_message_id,
    error: row.erro,
    sentAt: row.enviado_em,
    registeredAt: row.cadastrado_em,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapResponse(
  row: Tables<'pesquisa_satisfacao_respostas'>
): SatisfactionResponse {
  const answers =
    row.respostas && !Array.isArray(row.respostas) && typeof row.respostas === 'object'
      ? (row.respostas as Record<string, unknown>)
      : {};

  return {
    id: row.id,
    deliveryId: row.envio_id,
    configurationId: row.configuracao_id,
    googleResponseId: row.google_response_id,
    submittedAt: row.submitted_at,
    rating: row.nota,
    nps: row.nps,
    comment: row.comentario,
    email: row.email,
    phone: row.telefone,
    answers,
    createdAt: row.created_at,
  };
}

function configurationPayload(input: SatisfactionConfigurationInput) {
  return {
    nome: input.name.trim(),
    ativo: input.enabled,
    google_form_id: input.googleFormId.trim(),
    google_form_url: input.googleFormUrl.trim(),
    google_token_entry_id: input.googleTokenEntryId.trim().replace(/^entry\./, ''),
    mensagem_template: input.messageTemplate.trim(),
  };
}

function importedEventTime(date: string, time: string | null) {
  return new Date(`${date}T${time ?? '12:00'}:00-03:00`).toISOString();
}

function buildSurveyLink(
  configuration: SatisfactionConfiguration,
  trackingToken: string
) {
  const separator = configuration.googleFormUrl.includes('?') ? '&' : '?';
  return `${configuration.googleFormUrl}${separator}usp=pp_url&entry.${configuration.googleTokenEntryId}=${trackingToken}`;
}

async function fetchConfigurations() {
  const { data, error } = await supabase
    .from('pesquisa_satisfacao_configuracoes')
    .select('*')
    .order('nome');
  if (error) throw error;
  return (data || []).map(mapConfiguration);
}

async function fetchDeliveries() {
  const { data, error } = await supabase
    .from('pesquisa_satisfacao_envios')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data || []).map(mapDelivery);
}

async function fetchResponses() {
  const { data, error } = await supabase
    .from('pesquisa_satisfacao_respostas')
    .select('*')
    .order('submitted_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data || []).map(mapResponse);
}

async function fetchAllSurveyData() {
  const pageSize = 1000;
  const deliveryRows: Tables<'pesquisa_satisfacao_envios'>[] = [];
  const responseRows: Tables<'pesquisa_satisfacao_respostas'>[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('pesquisa_satisfacao_envios')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    deliveryRows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('pesquisa_satisfacao_respostas')
      .select('*')
      .order('submitted_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    responseRows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return {
    deliveries: deliveryRows.map(mapDelivery),
    responses: responseRows.map(mapResponse),
  };
}

export function useSatisfactionSurveys() {
  const queryClient = useQueryClient();

  const configurationsQuery = useQuery({
    queryKey: CONFIGURATIONS_KEY,
    queryFn: fetchConfigurations,
    staleTime: 30_000,
    retry: false,
  });
  const deliveriesQuery = useQuery({
    queryKey: DELIVERIES_KEY,
    queryFn: fetchDeliveries,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });
  const responsesQuery = useQuery({
    queryKey: RESPONSES_KEY,
    queryFn: fetchResponses,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });

  useEffect(() => {
    const channel = supabase
      .channel('pesquisas-satisfacao-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pesquisa_satisfacao_configuracoes',
        },
        () => queryClient.invalidateQueries({ queryKey: CONFIGURATIONS_KEY })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pesquisa_satisfacao_envios' },
        () => queryClient.invalidateQueries({ queryKey: DELIVERIES_KEY })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pesquisa_satisfacao_respostas' },
        () => queryClient.invalidateQueries({ queryKey: RESPONSES_KEY })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const invalidateAll = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: CONFIGURATIONS_KEY }),
      queryClient.invalidateQueries({ queryKey: DELIVERIES_KEY }),
      queryClient.invalidateQueries({ queryKey: RESPONSES_KEY }),
    ]);

  const saveConfiguration = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id?: number;
      input: SatisfactionConfigurationInput;
    }) => {
      if (id) {
        const { error } = await supabase
          .from('pesquisa_satisfacao_configuracoes')
          .update(configurationPayload(input))
          .eq('id', id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from('pesquisa_satisfacao_configuracoes')
        .insert(configurationPayload(input));
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: CONFIGURATIONS_KEY });
      toast.success(variables.id ? 'Campanha atualizada' : 'Campanha criada', {
        description: 'A configuração já está disponível para o fluxo do n8n.',
      });
    },
    onError: (error) => {
      console.error('Erro ao salvar pesquisa de satisfação:', error);
      toast.error('Não foi possível salvar a campanha', {
        description:
          (error as PostgrestError)?.code === '23505'
            ? 'Já existe uma campanha com esse nome.'
            : MIGRATION_HINT,
      });
    },
  });

  const toggleConfiguration = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const { error } = await supabase
        .from('pesquisa_satisfacao_configuracoes')
        .update({ ativo: enabled })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: CONFIGURATIONS_KEY });
      toast.success(variables.enabled ? 'Campanha ativada' : 'Campanha pausada');
    },
    onError: (error) => {
      console.error('Erro ao alterar campanha:', error);
      toast.error('Não foi possível alterar a campanha');
    },
  });

  const updateDeliveryStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: number;
      status: SatisfactionDeliveryStatus;
    }) => {
      const now = new Date().toISOString();
      const payload: {
        status: SatisfactionDeliveryStatus;
        enviado_em?: string | null;
        cadastrado_em?: string | null;
        erro?: string | null;
      } = { status };

      if (status === 'enviado') {
        payload.enviado_em = now;
        payload.cadastrado_em = null;
        payload.erro = null;
      } else if (status === 'cadastrado') {
        payload.cadastrado_em = now;
        payload.erro = null;
      } else if (status === 'pendente') {
        payload.enviado_em = null;
        payload.cadastrado_em = null;
        payload.erro = null;
      }

      const { error } = await supabase
        .from('pesquisa_satisfacao_envios')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: DELIVERIES_KEY });
      toast.success(
        variables.status === 'cadastrado'
          ? 'Tutor marcado como cadastrado'
          : 'Status atualizado'
      );
    },
    onError: (error) => {
      console.error('Erro ao atualizar status:', error);
      toast.error('Não foi possível atualizar o status');
    },
  });

  const importDeliveries = useMutation({
    mutationFn: async ({
      configurationId,
      rows,
    }: {
      configurationId: number;
      rows: SatisfactionSpreadsheetImportRow[];
    }): Promise<SpreadsheetImportResult> => {
      const configuration = configurationsQuery.data?.find(
        (item) => item.id === configurationId
      );
      if (!configuration) throw new Error('Campanha de satisfação não encontrada.');

      const importRows = rows.map((row) => {
        const trackingToken = crypto.randomUUID();
        const fallbackTime = importedEventTime(
          row.appointmentDate,
          row.appointmentTime
        );
        const hasResponse =
          row.rating !== null || row.nps !== null || Boolean(row.comment?.trim());
        const status = hasResponse ? 'cadastrado' : row.status;
        return {
          source: row,
          payload: {
            configuracao_id: configuration.id,
            configuracao_nome: configuration.name,
            agendamento_chave: `planilha:${row.appointmentDate}:${row.phone}`,
            data_agendada: row.appointmentDate,
            horario_agendado: row.appointmentTime,
            nome_tutor: row.ownerName,
            telefone: row.phone,
            email: row.email,
            status,
            tracking_token: trackingToken,
            link_pesquisa: buildSurveyLink(configuration, trackingToken),
            enviado_em:
              ['enviado', 'cadastrado'].includes(status)
                ? row.sentAt ?? fallbackTime
                : null,
            cadastrado_em:
              status === 'cadastrado'
                ? row.registeredAt ?? row.sentAt ?? fallbackTime
                : null,
          },
        };
      });

      const insertedRows: Array<{ id: number; telefone_normalizado: string }> = [];
      for (let index = 0; index < importRows.length; index += 500) {
        const { data, error } = await supabase
          .from('pesquisa_satisfacao_envios')
          .upsert(
            importRows.slice(index, index + 500).map((row) => row.payload),
            {
              onConflict: 'configuracao_id,telefone_normalizado',
              ignoreDuplicates: true,
            }
          )
          .select('id, telefone_normalizado');
        if (error) throw error;
        insertedRows.push(...(data ?? []));
      }

      const insertedByPhone = new Map(
        insertedRows.map((row) => [row.telefone_normalizado, row.id])
      );
      const responsePayload = importRows.flatMap(({ source }) => {
        const deliveryId = insertedByPhone.get(source.phone);
        const hasResponse =
          source.rating !== null ||
          source.nps !== null ||
          Boolean(source.comment?.trim());
        if (!deliveryId || !hasResponse) return [];
        return [
          {
            envio_id: deliveryId,
            configuracao_id: configuration.id,
            submitted_at:
              source.registeredAt ??
              source.sentAt ??
              importedEventTime(source.appointmentDate, source.appointmentTime),
            nota: source.rating,
            nps: source.nps,
            comentario: source.comment,
            email: source.email,
            telefone: source.phone,
            respostas: { origem: 'importacao_planilha' },
          },
        ];
      });

      if (responsePayload.length > 0) {
        for (let index = 0; index < responsePayload.length; index += 500) {
          const { error: responseError } = await supabase
            .from('pesquisa_satisfacao_respostas')
            .upsert(responsePayload.slice(index, index + 500), {
              onConflict: 'envio_id',
            });
          if (responseError) throw responseError;
        }
      }

      const imported = insertedRows.length;
      return {
        imported,
        ignored: rows.length - imported,
        responsesImported: responsePayload.length,
      };
    },
    onSuccess: () => {
      invalidateAll();
    },
  });

  const setupError = useMemo(() => {
    const error =
      configurationsQuery.error || deliveriesQuery.error || responsesQuery.error;
    if (!error) return null;
    const postgrestError = error as PostgrestError;
    return ['42P01', 'PGRST205'].includes(postgrestError.code ?? '')
      ? MIGRATION_HINT
      : postgrestError.message;
  }, [configurationsQuery.error, deliveriesQuery.error, responsesQuery.error]);

  return {
    configurations: configurationsQuery.data || [],
    deliveries: deliveriesQuery.data || [],
    responses: responsesQuery.data || [],
    loading:
      configurationsQuery.isLoading ||
      deliveriesQuery.isLoading ||
      responsesQuery.isLoading,
    setupError,
    saveConfiguration,
    toggleConfiguration,
    updateDeliveryStatus,
    importDeliveries,
    getAllSurveyData: fetchAllSurveyData,
    refresh: invalidateAll,
  };
}
