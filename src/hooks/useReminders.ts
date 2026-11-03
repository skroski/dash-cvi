import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import {
  ReminderAiPreview,
  ReminderAppointmentInput,
  ReminderConfiguration,
  ReminderConfigurationInput,
  ReminderDelivery,
  ReminderDeliveryStatus,
  ReminderDiagnostics,
  ReminderEvent,
  ReminderEventType,
  ReminderMessage,
  ReminderService,
  ReminderServiceColor,
  ReminderSettings,
  normalizeReminderTime,
} from '@/types/reminder';
import {
  ReminderSpreadsheetImportRow,
  SpreadsheetImportResult,
} from '@/types/spreadsheet';
import { sendMenuButtons, sendText } from '@/services/uazapi';

const KEYS = {
  configurations: ['reminder-configurations'],
  services: ['reminder-services'],
  appointments: ['reminder-appointments'],
  messages: ['reminder-messages'],
  events: ['reminder-events'],
  settings: ['reminder-settings'],
  diagnostics: ['reminder-diagnostics'],
  defaultExamples: ['reminder-default-examples'],
};

const MIGRATION_HINT =
  'Aplique a migração supabase/migrations/20261013100000_lembretes_envio_supabase.sql e recarregue a página.';

export type AppointmentPeriod = 'amanha' | 'hoje' | 'proximos7' | 'futuros' | 'passados' | 'todos';
export type MessagePeriod = 'hoje' | '7dias' | '30dias' | 'todos';

// ---------------------------------------------------------------------------
// Datas no fuso de Brasília
// ---------------------------------------------------------------------------

export function todayInSaoPaulo(offsetDays = 0) {
  const base = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  if (!offsetDays) return base;
  const date = new Date(`${base}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function appointmentRange(period: AppointmentPeriod): { from?: string; to?: string } {
  switch (period) {
    case 'hoje':
      return { from: todayInSaoPaulo(), to: todayInSaoPaulo() };
    case 'amanha':
      return { from: todayInSaoPaulo(1), to: todayInSaoPaulo(1) };
    case 'proximos7':
      return { from: todayInSaoPaulo(), to: todayInSaoPaulo(7) };
    case 'futuros':
      return { from: todayInSaoPaulo() };
    case 'passados':
      return { to: todayInSaoPaulo(-1) };
    default:
      return {};
  }
}

import { inferirCategoria } from '@/lib/reminderMessage';
import type { ReminderPresetCategory } from '@/config/exampleMessagePresets';

// ---------------------------------------------------------------------------
// Mapeamento banco -> tela
// ---------------------------------------------------------------------------

function mapConfiguration(row: Tables<'lembrete_configuracoes'>): ReminderConfiguration {
  const rawCategory = (row as unknown as { categoria?: string })?.categoria;
  const inferred = inferirCategoria(
    {
      nomeTutor: '',
      pets: [],
      servicos: [],
      dataAgendada: '',
      horario: null,
      diaEnvio: '',
      clinica: '',
      categoria: rawCategory,
    },
    row.exemplos ?? []
  );

  return {
    id: row.id,
    name: row.nome,
    category: (rawCategory as ReminderPresetCategory) || inferred,
    enabled: row.ativo,
    daysInAdvance: row.dias_antecedencia,
    sendTime: normalizeReminderTime(row.horario_envio),
    timezone: row.timezone,
    messageTemplate: row.mensagem_template,
    examples: row.exemplos ?? [],
    useAi: row.usar_ia,
    aiModel: row.modelo_ia,
    aiInstructions: row.instrucoes_ia,
    serviceIds: row.servico_ids ?? [],
    intervalMinSeconds: row.intervalo_min_segundos,
    intervalMaxSeconds: row.intervalo_max_segundos,
    sendWindowHours: row.janela_envio_horas,
    onlyConfirmed: row.somente_confirmados,
    botoesConfirmacao: Boolean((row as unknown as { botoes_confirmacao?: boolean })?.botoes_confirmacao),
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
    appointmentTime: row.horario_agendado ? normalizeReminderTime(row.horario_agendado) : null,
    service: row.servico,
    serviceId: row.servico_id,
    serviceText: row.servico_texto,
    description: row.descricao,
    ownerName: row.nome_tutor,
    petName: row.nome_pet,
    phone: row.telefone,
    phoneKey: row.telefone_chave,
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
    messageId: row.mensagem_id,
    origin: row.origem as ReminderDelivery['origin'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapService(row: Tables<'lembrete_servicos'>): ReminderService {
  return {
    id: row.id,
    name: row.nome,
    messageText: row.texto_mensagem,
    color: row.cor as ReminderServiceColor,
    active: row.ativo,
    order: row.ordem,
  };
}

function mapMessage(row: Tables<'lembrete_mensagens'>): ReminderMessage {
  return {
    id: row.id,
    configurationId: row.configuracao_id,
    configurationName: row.configuracao_nome,
    trigger: row.disparo as ReminderMessage['trigger'],
    sendDay: row.dia_envio,
    phone: row.telefone,
    ownerName: row.nome_tutor,
    petNames: row.nomes_pets ?? [],
    services: row.servicos ?? [],
    appointmentDate: row.data_agendada,
    appointmentTime: row.horario_agendado ? normalizeReminderTime(row.horario_agendado) : null,
    scheduledFor: row.programado_para,
    status: row.status as ReminderMessage['status'],
    attempts: row.tentativas,
    text: row.texto,
    textSource: row.origem_texto as ReminderMessage['textSource'],
    exampleIndex: row.exemplo_indice,
    aiModel: row.modelo_ia,
    providerMessageId: row.provider_message_id,
    error: row.erro,
    sentAt: row.enviado_em,
    botoesConfirmacao: Boolean((row as unknown as { botoes_confirmacao?: boolean })?.botoes_confirmacao),
    category: (row as unknown as { categoria?: ReminderPresetCategory })?.categoria,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(row: Tables<'lembrete_eventos'>): ReminderEvent {
  return {
    id: row.id,
    messageId: row.mensagem_id,
    type: row.tipo as ReminderEventType,
    description: row.descricao,
    data: (row.dados as Record<string, unknown> | null) ?? null,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

async function fetchConfigurations() {
  const { data, error } = await supabase
    .from('lembrete_configuracoes')
    .select('*')
    .order('horario_envio')
    .order('id');
  if (error) throw error;
  return (data || []).map(mapConfiguration);
}

async function fetchServices() {
  const { data, error } = await supabase
    .from('lembrete_servicos')
    .select('*')
    .order('ordem')
    .order('nome');
  if (error) throw error;
  return (data || []).map(mapService);
}

async function fetchAppointments(period: AppointmentPeriod) {
  const range = appointmentRange(period);
  let query = supabase.from('lembrete_envios').select('*');
  if (range.from) query = query.gte('data_agendada', range.from);
  if (range.to) query = query.lte('data_agendada', range.to);
  const ascending = period !== 'passados' && period !== 'todos';
  const { data, error } = await query
    .order('data_agendada', { ascending })
    .order('horario_agendado', { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) throw error;
  return (data || []).map(mapDelivery);
}

async function fetchMessages(period: MessagePeriod) {
  let query = supabase.from('lembrete_mensagens').select('*');
  if (period === 'hoje') query = query.eq('dia_envio', todayInSaoPaulo());
  if (period === '7dias') query = query.gte('dia_envio', todayInSaoPaulo(-6));
  if (period === '30dias') query = query.gte('dia_envio', todayInSaoPaulo(-29));
  const { data, error } = await query
    .order('dia_envio', { ascending: false })
    .order('programado_para', { ascending: true })
    .limit(300);
  if (error) throw error;
  return (data || []).map(mapMessage);
}

async function fetchEvents() {
  const { data, error } = await supabase
    .from('lembrete_eventos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(150);
  if (error) throw error;
  return (data || []).map(mapEvent);
}

export async function fetchMessageById(messageId: number) {
  const { data, error } = await supabase
    .from('lembrete_mensagens')
    .select('*')
    .eq('id', messageId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMessage(data) : null;
}

export async function fetchMessageEvents(messageId: number) {
  const { data, error } = await supabase
    .from('lembrete_eventos')
    .select('*')
    .eq('mensagem_id', messageId)
    .order('created_at');
  if (error) throw error;
  return (data || []).map(mapEvent);
}

async function fetchSettings(): Promise<ReminderSettings> {
  const { data, error } = await supabase
    .from('lembrete_ajustes')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return {
    autoSend: data?.envio_automatico ?? false,
    clinicName: data?.nome_clinica ?? 'Clínica Veterinária',
    testPhone: data?.telefone_teste ?? null,
    updatedAt: data?.updated_at ?? new Date().toISOString(),
  };
}

async function fetchAllDeliveries() {
  const pageSize = 1000;
  const rows: Tables<'lembrete_envios'>[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('lembrete_envios')
      .select('*')
      .order('data_agendada', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows.map(mapDelivery);
}

async function fetchDiagnostics(): Promise<ReminderDiagnostics> {
  const [database, edge] = await Promise.all([
    supabase.rpc('lembretes_diagnostico'),
    supabase.functions
      .invoke('lembretes', { body: { acao: 'diagnostico' } })
      .catch(() => ({ data: null, error: new Error('indisponível') })),
  ]);
  if (database.error) throw database.error;
  const db = (database.data ?? {}) as Record<string, unknown>;
  const fn = (edge.error ? null : edge.data) as Record<string, boolean> | null;
  return {
    cronActive: !!db.cron_ativo,
    cronLastRun: (db.cron_ultima_execucao as string | null) ?? null,
    vaultConfigured: !!db.vault_configurado,
    pending: Number(db.fila_pendente ?? 0),
    processing: Number(db.fila_processando ?? 0),
    openai: fn ? !!fn.openai : null,
    uazapi: fn ? !!fn.uazapi : null,
    cronSecret: fn ? !!fn.cron_secret : null,
  };
}

/** Pede à edge function para processar a fila agora (sem esperar o cron). */
async function processQueueNow() {
  const { error } = await supabase.functions.invoke('lembretes', { body: { acao: 'processar' } });
  if (error) console.warn('Fila de lembretes não processada agora:', error.message);
}

function errorMessage(error: unknown, fallback: string) {
  const postgrest = error as PostgrestError | undefined;
  if (postgrest?.code === '23505') return 'Já existe um registro com esse nome.';
  if (postgrest?.code === 'P0001' || postgrest?.code === 'P0002' || postgrest?.code === '42501') {
    return postgrest.message;
  }
  if (postgrest?.code === '42P01' || postgrest?.code === 'PGRST205' || postgrest?.code === '42883') {
    return MIGRATION_HINT;
  }
  return fallback;
}

function configurationPayload(input: ReminderConfigurationInput) {
  return {
    nome: input.name.trim(),
    categoria: input.category || 'consulta',
    botoes_confirmacao: input.botoesConfirmacao ?? false,
    ativo: input.enabled,
    dias_antecedencia: input.daysInAdvance,
    horario_envio: input.sendTime,
    timezone: input.timezone,
    exemplos: input.examples.map((example) => example.trim()).filter(Boolean),
    usar_ia: input.useAi,
    modelo_ia: input.aiModel,
    instrucoes_ia: input.aiInstructions?.trim() || null,
    servico_ids: input.serviceIds,
    intervalo_min_segundos: input.intervalMinSeconds,
    intervalo_max_segundos: input.intervalMaxSeconds,
    janela_envio_horas: input.sendWindowHours,
    somente_confirmados: input.onlyConfirmed,
  };
}

export function normalizePhoneDigits(value: string) {
  return value.split('@')[0].replace(/\D/g, '');
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Só as regras. Usado fora da página (modelos rápidos do chat). */
export function useReminderConfigurations() {
  const query = useQuery({
    queryKey: KEYS.configurations,
    queryFn: fetchConfigurations,
    staleTime: 60_000,
    retry: false,
  });
  return { configurations: query.data ?? [], loading: query.isPending };
}

export function useReminderDefaultExamples() {
  return useQuery({
    queryKey: KEYS.defaultExamples,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('lembrete_exemplos_padrao');
      if (error) throw error;
      return (data ?? []) as string[];
    },
    staleTime: Infinity,
    retry: false,
  });
}

export function useReminderDiagnostics(enabled: boolean) {
  return useQuery({
    queryKey: KEYS.diagnostics,
    queryFn: fetchDiagnostics,
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

export function useReminderMessageEvents(messageId: number | null) {
  return useQuery({
    queryKey: [...KEYS.events, 'message', messageId],
    queryFn: () => fetchMessageEvents(messageId as number),
    enabled: messageId !== null,
  });
}

export function useReminders({
  appointmentPeriod = 'amanha',
  messagePeriod = 'hoje',
}: {
  appointmentPeriod?: AppointmentPeriod;
  messagePeriod?: MessagePeriod;
} = {}) {
  const queryClient = useQueryClient();

  const configurationsQuery = useQuery({
    queryKey: KEYS.configurations,
    queryFn: fetchConfigurations,
    staleTime: 30_000,
    retry: false,
  });
  const servicesQuery = useQuery({
    queryKey: KEYS.services,
    queryFn: fetchServices,
    staleTime: 60_000,
    retry: false,
  });
  const appointmentsQuery = useQuery({
    queryKey: [...KEYS.appointments, appointmentPeriod],
    queryFn: () => fetchAppointments(appointmentPeriod),
    staleTime: 15_000,
    retry: false,
  });
  const tomorrowQuery = useQuery({
    queryKey: [...KEYS.appointments, 'amanha'],
    queryFn: () => fetchAppointments('amanha'),
    staleTime: 15_000,
    retry: false,
  });
  const messagesQuery = useQuery({
    queryKey: [...KEYS.messages, messagePeriod],
    queryFn: () => fetchMessages(messagePeriod),
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: false,
  });
  const todayMessagesQuery = useQuery({
    queryKey: [...KEYS.messages, 'hoje'],
    queryFn: () => fetchMessages('hoje'),
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: false,
  });
  const eventsQuery = useQuery({
    queryKey: KEYS.events,
    queryFn: fetchEvents,
    staleTime: 10_000,
    retry: false,
  });
  const settingsQuery = useQuery({
    queryKey: KEYS.settings,
    queryFn: fetchSettings,
    staleTime: 30_000,
    retry: false,
  });

  useEffect(() => {
    const invalidate = (key: string[]) => () => queryClient.invalidateQueries({ queryKey: key });
    const channel = supabase
      .channel('lembretes-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lembrete_configuracoes' }, invalidate(KEYS.configurations))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lembrete_servicos' }, invalidate(KEYS.services))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lembrete_envios' }, invalidate(KEYS.appointments))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lembrete_mensagens' }, invalidate(KEYS.messages))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lembrete_eventos' }, invalidate(KEYS.events))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lembrete_ajustes' }, invalidate(KEYS.settings))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const refreshAll = () => {
    for (const key of Object.values(KEYS)) queryClient.invalidateQueries({ queryKey: key });
  };
  const refreshQueue = () => {
    queryClient.invalidateQueries({ queryKey: KEYS.appointments });
    queryClient.invalidateQueries({ queryKey: KEYS.messages });
    queryClient.invalidateQueries({ queryKey: KEYS.events });
  };

  // --- Regras -------------------------------------------------------------

  const createReminder = useMutation({
    mutationFn: async (input: ReminderConfigurationInput) => {
      const { error } = await supabase.from('lembrete_configuracoes').insert(configurationPayload(input));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.configurations });
      toast.success('Regra criada');
    },
    onError: (error) => {
      console.error('Erro ao criar regra de lembrete:', error);
      toast.error('Não foi possível criar a regra', {
        description: errorMessage(error, MIGRATION_HINT),
      });
    },
  });

  const updateReminder = useMutation({
    mutationFn: async ({ id, input }: { id: number; input: ReminderConfigurationInput }) => {
      const { error } = await supabase
        .from('lembrete_configuracoes')
        .update(configurationPayload(input))
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.configurations });
      toast.success('Regra atualizada');
    },
    onError: (error) => {
      console.error('Erro ao atualizar regra de lembrete:', error);
      toast.error('Não foi possível atualizar a regra', {
        description: errorMessage(error, 'Tente novamente em instantes.'),
      });
    },
  });

  const toggleReminder = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const { error } = await supabase.from('lembrete_configuracoes').update({ ativo: enabled }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.configurations });
      toast.success(variables.enabled ? 'Regra ativada' : 'Regra pausada');
    },
    onError: () => toast.error('Não foi possível alterar a regra'),
  });

  const deleteReminder = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('lembrete_configuracoes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.configurations });
      toast.success('Regra removida', { description: 'O histórico de envios foi preservado.' });
    },
    onError: () => toast.error('Não foi possível remover a regra'),
  });

  const dispatchNow = useMutation({
    mutationFn: async (configurationId: number) => {
      const { data, error } = await supabase.rpc('lembretes_disparar_agora', {
        p_configuracao_id: configurationId,
      });
      if (error) throw error;
      await processQueueNow();
      return data ?? 0;
    },
    onSuccess: (count) => {
      refreshQueue();
      toast.success(
        count > 0 ? `${count} lembrete(s) na fila` : 'Nenhum lembrete novo para programar',
        {
          description:
            count > 0
              ? 'Os envios saem um a um, com intervalo aleatório. Acompanhe na aba Mensagens.'
              : 'Todos os tutores da data alvo já estão na fila ou já receberam.',
        }
      );
    },
    onError: (error) =>
      toast.error('Não foi possível disparar agora', {
        description: errorMessage(error, 'Tente novamente em instantes.'),
      }),
  });

  const sendTest = useMutation({
    mutationFn: async ({ configurationId, phone }: { configurationId: number; phone: string }) => {
      const { error } = await supabase.rpc('lembretes_enviar_teste', {
        p_configuracao_id: configurationId,
        p_telefone: phone,
      });
      if (error) throw error;
      await processQueueNow();
    },
    onSuccess: () => {
      refreshQueue();
      toast.success('Teste enviado para a fila', {
        description: 'Em instantes a mensagem chega no WhatsApp informado.',
      });
    },
    onError: (error) =>
      toast.error('Não foi possível enviar o teste', {
        description: errorMessage(error, 'Tente novamente em instantes.'),
      }),
  });

  const previewAi = useMutation({
    mutationFn: async (input: {
      examples: string[];
      aiInstructions: string | null;
      aiModel: string;
      useAi: boolean;
      daysInAdvance: number;
      quantity?: number;
    }): Promise<ReminderAiPreview[]> => {
      const { data, error } = await supabase.functions.invoke('lembretes', {
        body: {
          acao: 'previa',
          exemplos: input.examples,
          instrucoes_ia: input.aiInstructions,
          modelo_ia: input.aiModel,
          usar_ia: input.useAi,
          quantidade: input.quantity ?? 2,
          dados: {
            diaEnvio: todayInSaoPaulo(),
            dataAgendada: todayInSaoPaulo(input.daysInAdvance),
          },
        },
      });
      if (error) throw error;
      return (data?.mensagens ?? []) as ReminderAiPreview[];
    },
    onError: (error) =>
      toast.error('Não foi possível gerar a prévia', {
        description:
          error instanceof Error && /Failed to send|not found|404/i.test(error.message)
            ? 'A edge function "lembretes" ainda não foi publicada.'
            : 'Confira a chave da OpenAI nos segredos da edge function.',
      }),
  });

  // --- Serviços ------------------------------------------------------------

  const saveService = useMutation({
    mutationFn: async (input: {
      id?: number;
      name: string;
      color: ReminderServiceColor;
      active?: boolean;
      /** undefined mantém o texto atual; null ou vazio volta a usar o nome. */
      messageText?: string | null;
    }) => {
      const payload = {
        nome: input.name.trim(),
        cor: input.color,
        ativo: input.active ?? true,
        ...(input.messageText !== undefined ? { texto_mensagem: input.messageText?.trim() || null } : {}),
      };
      const { error } = input.id
        ? await supabase.from('lembrete_servicos').update(payload).eq('id', input.id)
        : await supabase
            .from('lembrete_servicos')
            .insert({ ...payload, ordem: (servicesQuery.data?.length ?? 0) * 10 + 10 });
      if (error) throw error;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: KEYS.services });
      queryClient.invalidateQueries({ queryKey: KEYS.appointments });
      toast.success(input.id ? 'Serviço atualizado' : 'Serviço criado');
    },
    onError: (error) =>
      toast.error('Não foi possível salvar o serviço', {
        description: errorMessage(error, 'Tente novamente em instantes.'),
      }),
  });

  const deleteService = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('lembrete_servicos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.services });
      queryClient.invalidateQueries({ queryKey: KEYS.appointments });
      toast.success('Serviço removido', {
        description: 'Os agendamentos mantêm o nome do serviço, sem categoria.',
      });
    },
    onError: () => toast.error('Não foi possível remover o serviço'),
  });

  // --- Agenda --------------------------------------------------------------

  const saveAppointment = useMutation({
    mutationFn: async ({ id, input }: { id?: number; input: ReminderAppointmentInput }) => {
      const service = servicesQuery.data?.find((item) => item.id === input.serviceId);
      const payload = {
        nome_tutor: input.ownerName.trim(),
        telefone: normalizePhoneDigits(input.phone),
        nome_pet: input.petName?.trim() || null,
        // Sem categoria escolhida, mantém o serviço que veio da importação.
        ...(input.serviceId ? { servico_id: input.serviceId, servico: service?.name ?? null } : {}),
        servico_texto: input.serviceText?.trim() || null,
        configuracao_id: input.configurationId,
        data_agendada: input.appointmentDate,
        horario_agendado: input.appointmentTime || null,
        descricao: input.description?.trim() || null,
      };
      if (id) {
        const { error } = await supabase.from('lembrete_envios').update(payload).eq('id', id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from('lembrete_envios').insert({
        ...payload,
        agendamento_chave: `manual:${crypto.randomUUID()}`,
        origem: 'manual',
        status: 'pendente',
        status_agendamento: 'CONFIRMADO',
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.appointments });
      toast.success(variables.id ? 'Agendamento atualizado' : 'Agendamento cadastrado', {
        description: variables.id
          ? undefined
          : 'O lembrete será enviado automaticamente no horário da regra.',
      });
    },
    onError: (error) =>
      toast.error('Não foi possível salvar o agendamento', {
        description: errorMessage(error, MIGRATION_HINT),
      }),
  });

  const setAppointmentStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: 'cancelado' | 'pendente' }) => {
      const { error } = await supabase
        .from('lembrete_envios')
        .update({ status, erro: null, ...(status === 'pendente' ? { mensagem_id: null } : {}) })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: KEYS.appointments });
      toast.success(variables.status === 'cancelado' ? 'Agendamento cancelado' : 'Agendamento reativado', {
        description: variables.status === 'cancelado' ? 'O tutor não receberá lembrete.' : undefined,
      });
    },
    onError: () => toast.error('Não foi possível alterar o agendamento'),
  });

  const deleteAppointment = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('lembrete_envios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.appointments });
      toast.success('Agendamento excluído');
    },
    onError: () => toast.error('Não foi possível excluir o agendamento'),
  });

  const sendAppointmentNow = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.rpc('lembretes_enviar_agendamento', { p_envio_id: id });
      if (error) throw error;
      await processQueueNow();
    },
    onSuccess: () => {
      refreshQueue();
      toast.success('Lembrete a caminho', {
        description: 'A mensagem sai em instantes. Acompanhe na aba Mensagens.',
      });
    },
    onError: (error) =>
      toast.error('Não foi possível enviar agora', {
        description: errorMessage(error, 'Tente novamente em instantes.'),
      }),
  });

  const importDeliveries = useMutation({
    mutationFn: async ({
      configurationId,
      rows,
    }: {
      configurationId: number;
      rows: ReminderSpreadsheetImportRow[];
    }): Promise<SpreadsheetImportResult> => {
      const payload = rows.map((row) => ({
        configuracao_id: configurationId,
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
        status: row.deliveryStatus,
        tentativas: row.deliveryStatus === 'enviado' ? 1 : 0,
        enviado_em: row.sentAt,
        erro: row.error,
        origem: 'importacao',
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
      queryClient.invalidateQueries({ queryKey: KEYS.appointments });
      queryClient.invalidateQueries({ queryKey: KEYS.services });
    },
  });

  // --- Mensagens -----------------------------------------------------------

  const resendMessage = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.rpc('lembretes_reenviar_mensagem', { p_mensagem_id: id });
      if (error) throw error;
      await processQueueNow();
    },
    onSuccess: () => {
      refreshQueue();
      toast.success('Mensagem reenviada para a fila');
    },
    onError: (error) =>
      toast.error('Não foi possível reenviar', {
        description: errorMessage(error, 'Tente novamente em instantes.'),
      }),
  });

  const cancelMessage = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.rpc('lembretes_cancelar_mensagem', { p_mensagem_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      refreshQueue();
      toast.success('Mensagem cancelada', { description: 'Ela não será enviada.' });
    },
    onError: (error) =>
      toast.error('Não foi possível cancelar', {
        description: errorMessage(error, 'Tente novamente em instantes.'),
      }),
  });

  // Envio direto com o texto revisado. O banco reserva a mensagem antes (o
  // agendador não a envia de novo) e é avisado do resultado depois.
  const sendDirectWhatsApp = useMutation({
    mutationFn: async ({
      messageId,
      phone,
      text,
      botoesConfirmacao,
      clinicName,
    }: {
      messageId: number;
      phone: string;
      text: string;
      botoesConfirmacao?: boolean;
      clinicName?: string;
    }) => {
      const cleanPhone = phone.split('@')[0].replace(/\D/g, '');
      const { error: reserveError } = await supabase.rpc('lembretes_reservar_envio_manual', {
        p_mensagem_id: messageId,
        p_texto: text,
      });
      if (reserveError) throw reserveError;

      let response: unknown;
      try {
        if (botoesConfirmacao) {
          response = await sendMenuButtons(
            cleanPhone,
            text,
            [
              { id: 'confirmar_agendamento', text: 'Confirmar' },
              { id: 'nao_confirmar_agendamento', text: 'Não Confirmar' },
            ],
            clinicName
          );
        } else {
          response = await sendText(cleanPhone, text);
        }
      } catch (sendError) {
        // Timeout ou erro de rede: a mensagem pode ter saído. Não reenvie sem conferir.
        await supabase.rpc('lembretes_concluir_envio_manual', {
          p_mensagem_id: messageId,
          p_enviado: false,
          p_erro:
            sendError instanceof Error
              ? `${sendError.message}. Confira no WhatsApp se a mensagem chegou antes de reenviar.`
              : 'Falha no envio. Confira no WhatsApp se a mensagem chegou antes de reenviar.',
        });
        throw sendError;
      }

      const providerId =
        (response as { messageid?: string; id?: string; key?: { id?: string } } | null)?.messageid ??
        (response as { id?: string } | null)?.id ??
        (response as { key?: { id?: string } } | null)?.key?.id ??
        null;
      const { error: concludeError } = await supabase.rpc('lembretes_concluir_envio_manual', {
        p_mensagem_id: messageId,
        p_enviado: true,
        p_provider_message_id: providerId,
      });
      if (concludeError) {
        throw new Error(
          'A mensagem foi enviada, mas o painel não conseguiu registrar. Não reenvie: confira a aba Mensagens.'
        );
      }
      return response;
    },
    onSuccess: () => {
      refreshQueue();
      toast.success('Mensagem enviada pelo WhatsApp');
    },
    onError: (error) => {
      refreshQueue();
      toast.error('Não foi possível enviar pelo WhatsApp', {
        description: errorMessage(
          error,
          error instanceof Error ? error.message : 'Verifique a conexão da uazapi.'
        ),
      });
    },
  });

  // --- Ajustes -------------------------------------------------------------

  const updateSettings = useMutation({
    mutationFn: async (input: Partial<Pick<ReminderSettings, 'autoSend' | 'clinicName' | 'testPhone' | 'pausaIaMinutos'>>) => {
      const payload: Record<string, unknown> = {};
      if (input.autoSend !== undefined) payload.envio_automatico = input.autoSend;
      if (input.clinicName !== undefined) payload.nome_clinica = input.clinicName.trim();
      if (input.testPhone !== undefined) {
        payload.telefone_teste = input.testPhone ? normalizePhoneDigits(input.testPhone) : null;
      }
      if (input.pausaIaMinutos !== undefined) {
        payload.pausa_ia_minutos = input.pausaIaMinutos;
      }
      const { error } = await supabase.from('lembrete_ajustes').update(payload).eq('id', 1);
      if (error) throw error;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: KEYS.settings });
      if (input.autoSend !== undefined) {
        toast.success(input.autoSend ? 'Envio automático ligado' : 'Envio automático desligado', {
          description: input.autoSend
            ? 'Os lembretes saem sozinhos no horário de cada regra.'
            : 'Nada sai sozinho. Envios manuais e testes continuam funcionando.',
        });
      } else {
        toast.success('Ajustes salvos');
      }
    },
    onError: (error) =>
      toast.error('Não foi possível salvar os ajustes', {
        description: errorMessage(error, MIGRATION_HINT),
      }),
  });

  const configurations = useMemo(() => configurationsQuery.data ?? [], [configurationsQuery.data]);
  const services = useMemo(() => servicesQuery.data ?? [], [servicesQuery.data]);
  const appointments = useMemo(() => appointmentsQuery.data ?? [], [appointmentsQuery.data]);
  const messages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);

  const stats = useMemo(() => {
    const tomorrow = tomorrowQuery.data ?? [];
    const today = todayMessagesQuery.data ?? [];
    return {
      tomorrowAppointments: tomorrow.filter((item) => item.status !== 'cancelado').length,
      tomorrowPending: tomorrow.filter((item) => item.status === 'pendente' && !item.messageId).length,
      queued: today.filter((item) => item.status === 'pendente' || item.status === 'processando').length,
      sentToday: today.filter((item) => item.status === 'enviado' && item.trigger !== 'teste').length,
      failedToday: today.filter((item) => item.status === 'falha').length,
      nextInQueue:
        today
          .filter((item) => item.status === 'pendente')
          .map((item) => item.scheduledFor)
          .sort()[0] ?? null,
    };
  }, [tomorrowQuery.data, todayMessagesQuery.data]);

  return {
    configurations,
    services,
    appointments,
    messages,
    events: eventsQuery.data ?? [],
    settings: settingsQuery.data ?? null,
    stats,
    loading: configurationsQuery.isPending || settingsQuery.isPending,
    configurationsLoading: configurationsQuery.isPending,
    servicesLoading: servicesQuery.isPending,
    appointmentsLoading: appointmentsQuery.isPending,
    messagesLoading: messagesQuery.isPending,
    eventsLoading: eventsQuery.isPending,
    statsLoading: tomorrowQuery.isPending || todayMessagesQuery.isPending,
    setupError: !!(configurationsQuery.error || settingsQuery.error || servicesQuery.error),
    refreshAll,
    getAllDeliveries: fetchAllDeliveries,
    createReminder,
    updateReminder,
    toggleReminder,
    deleteReminder,
    dispatchNow,
    sendTest,
    previewAi,
    saveService,
    deleteService,
    saveAppointment,
    setAppointmentStatus,
    deleteAppointment,
    sendAppointmentNow,
    importDeliveries,
    resendMessage,
    cancelMessage,
    sendDirectWhatsApp,
    updateSettings,
  };
}

export type RemindersApi = ReturnType<typeof useReminders>;
