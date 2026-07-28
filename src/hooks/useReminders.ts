import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import {
  ReminderConfiguration,
  ReminderConfigurationInput,
  ReminderDelivery,
  ReminderDeliveryStatus,
  normalizeReminderTime,
} from '@/types/reminder';
import {
  ReminderSpreadsheetImportRow,
  SpreadsheetImportResult,
} from '@/types/spreadsheet';

const REMINDER_CONFIGURATIONS_KEY = ['reminder-configurations'];
const REMINDER_DELIVERIES_KEY = ['reminder-deliveries'];
const MIGRATION_HINT =
  'Aplique a migração supabase/migrations/20260716100000_lembretes.sql e recarregue a página.';

function mapConfiguration(row: Tables<'lembrete_configuracoes'>): ReminderConfiguration {
  return {
    id: row.id,
    name: row.nome,
    enabled: row.ativo,
    daysInAdvance: 1,
    sendTime: normalizeReminderTime(row.horario_envio),
    timezone: row.timezone,
    messageTemplate: row.mensagem_template,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDelivery(row: Tables<'lembrete_envios'>): ReminderDelivery {
  return {
    id: row.id,
    configurationId: row.configuracao_id,
    configurationName: row.configuracao_nome,
    appointmentKey: row.agendamento_chave,
    appointmentDate: row.data_agendada,
    appointmentTime: row.horario_agendado
      ? normalizeReminderTime(row.horario_agendado)
      : null,
    service: row.servico,
    description: row.descricao,
    ownerName: row.nome_tutor,
    petName: row.nome_pet,
    phone: row.telefone,
    email: row.email,
    petSize: row.porte,
    price: row.preco,
    appointmentStatus: row.status_agendamento,
    scheduledFor: row.programado_para,
    status: row.status as ReminderDeliveryStatus,
    attempts: row.tentativas,
    providerMessageId: row.provider_message_id,
    error: row.erro,
    sentAt: row.enviado_em,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchConfigurations() {
  const { data, error } = await supabase
    .from('lembrete_configuracoes')
    .select('*')
    .order('horario_envio');
  if (error) throw error;
  return (data || []).map(mapConfiguration);
}

async function fetchDeliveries() {
  const { data, error } = await supabase
    .from('lembrete_envios')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data || []).map(mapDelivery);
}

async function fetchAllDeliveries() {
  const pageSize = 1000;
  const rows: Tables<'lembrete_envios'>[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('lembrete_envios')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows.map(mapDelivery);
}

function configurationPayload(input: ReminderConfigurationInput) {
  return {
    nome: input.name.trim(),
    ativo: input.enabled,
    dias_antecedencia: 1,
    horario_envio: input.sendTime,
    timezone: input.timezone,
    mensagem_template: input.messageTemplate.trim(),
  };
}

function reminderScheduledFor(appointmentDate: string, sendTime: string) {
  const previousDay = new Date(`${appointmentDate}T12:00:00Z`);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  const date = previousDay.toISOString().slice(0, 10);
  return new Date(`${date}T${sendTime}:00-03:00`).toISOString();
}

export function useReminders() {
  const queryClient = useQueryClient();

  const configurationsQuery = useQuery({
    queryKey: REMINDER_CONFIGURATIONS_KEY,
    queryFn: fetchConfigurations,
    staleTime: 30_000,
    retry: false,
  });

  const deliveriesQuery = useQuery({
    queryKey: REMINDER_DELIVERIES_KEY,
    queryFn: fetchDeliveries,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });

  useEffect(() => {
    const channel = supabase
      .channel('lembretes-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lembrete_configuracoes' },
        () => queryClient.invalidateQueries({ queryKey: REMINDER_CONFIGURATIONS_KEY })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lembrete_envios' },
        () => queryClient.invalidateQueries({ queryKey: REMINDER_DELIVERIES_KEY })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const invalidateConfigurations = () =>
    queryClient.invalidateQueries({ queryKey: REMINDER_CONFIGURATIONS_KEY });

  const createReminder = useMutation({
    mutationFn: async (input: ReminderConfigurationInput) => {
      const { error } = await supabase
        .from('lembrete_configuracoes')
        .insert(configurationPayload(input));
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateConfigurations();
      toast.success('Lembrete criado', {
        description: 'O n8n poderá usar esta regra no próximo ciclo de verificação.',
      });
    },
    onError: (error) => {
      console.error('Erro ao criar lembrete:', error);
      toast.error('Não foi possível criar o lembrete', {
        description:
          (error as PostgrestError)?.code === '23505'
            ? 'Já existe um lembrete com esse nome.'
            : MIGRATION_HINT,
      });
    },
  });

  const updateReminder = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: number;
      input: ReminderConfigurationInput;
    }) => {
      const { error } = await supabase
        .from('lembrete_configuracoes')
        .update(configurationPayload(input))
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateConfigurations();
      toast.success('Lembrete atualizado');
    },
    onError: (error) => {
      console.error('Erro ao atualizar lembrete:', error);
      toast.error('Não foi possível atualizar o lembrete', {
        description:
          (error as PostgrestError)?.code === '23505'
            ? 'Já existe um lembrete com esse nome.'
            : undefined,
      });
    },
  });

  const toggleReminder = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const { error } = await supabase
        .from('lembrete_configuracoes')
        .update({ ativo: enabled })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      invalidateConfigurations();
      toast.success(variables.enabled ? 'Lembrete ativado' : 'Lembrete pausado');
    },
    onError: (error) => {
      console.error('Erro ao alterar status do lembrete:', error);
      toast.error('Não foi possível alterar o status do lembrete');
    },
  });

  const deleteReminder = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('lembrete_configuracoes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateConfigurations();
      toast.success('Lembrete removido', {
        description: 'O histórico de envios foi preservado.',
      });
    },
    onError: (error) => {
      console.error('Erro ao remover lembrete:', error);
      toast.error('Não foi possível remover o lembrete');
    },
  });

  const importDeliveries = useMutation({
    mutationFn: async ({
      configurationId,
      rows,
    }: {
      configurationId: number;
      rows: ReminderSpreadsheetImportRow[];
    }): Promise<SpreadsheetImportResult> => {
      const configuration = configurationsQuery.data?.find(
        (item) => item.id === configurationId
      );
      if (!configuration) throw new Error('Regra de lembrete não encontrada.');

      const payload = rows.map((row) => ({
        configuracao_id: configuration.id,
        configuracao_nome: configuration.name,
        agendamento_chave: `planilha:${row.importKey}`,
        data_agendada: row.appointmentDate,
        horario_agendado: row.appointmentTime,
        servico: row.service,
        descricao: row.description,
        nome_tutor: row.ownerName,
        nome_pet: row.petName,
        telefone: row.phone,
        email: row.email,
        porte: row.petSize,
        preco: row.price,
        status_agendamento: row.appointmentStatus,
        programado_para: reminderScheduledFor(
          row.appointmentDate,
          configuration.sendTime
        ),
        status: row.deliveryStatus,
        tentativas: row.deliveryStatus === 'enviado' ? 1 : 0,
        enviado_em: row.sentAt,
        erro: row.error,
      }));

      let imported = 0;
      for (let index = 0; index < payload.length; index += 500) {
        const { data, error } = await supabase
          .from('lembrete_envios')
          .upsert(payload.slice(index, index + 500), {
            onConflict: 'configuracao_id,agendamento_chave,data_agendada',
            ignoreDuplicates: true,
          })
          .select('id');
        if (error) throw error;
        imported += data?.length ?? 0;
      }

      return { imported, ignored: rows.length - imported };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REMINDER_DELIVERIES_KEY });
    },
  });

  const configurations = useMemo(
    () => configurationsQuery.data || [],
    [configurationsQuery.data]
  );
  const deliveries = useMemo(
    () => deliveriesQuery.data || [],
    [deliveriesQuery.data]
  );

  return {
    configurations,
    deliveries,
    loading: configurationsQuery.isPending || deliveriesQuery.isPending,
    configurationsLoading: configurationsQuery.isPending,
    deliveriesLoading: deliveriesQuery.isPending,
    setupError: !!(configurationsQuery.error || deliveriesQuery.error),
    createReminder,
    updateReminder,
    toggleReminder,
    deleteReminder,
    importDeliveries,
    getAllDeliveries: fetchAllDeliveries,
    refreshDeliveries: deliveriesQuery.refetch,
  };
}
