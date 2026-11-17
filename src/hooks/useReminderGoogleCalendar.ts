import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { GoogleCalendarConfig, GoogleCalendarDiagnostics, GoogleCalendarItem } from '@/types/reminder';

const KEYS = {
  config: ['google-calendar-config'],
  diagnostics: ['google-calendar-diagnostics'],
};

export function useReminderGoogleCalendar(autoCheck = false) {
  const queryClient = useQueryClient();

  // 1. Busca configuração salva no banco
  const configQuery = useQuery({
    queryKey: KEYS.config,
    queryFn: async (): Promise<GoogleCalendarConfig | null> => {
      const { data, error } = await supabase
        .from('google_calendar_config' as any)
        .select('*')
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('[useReminderGoogleCalendar] Erro ao carregar config:', error.message);
        return null;
      }

      if (!data) return null;

      const row = data as any;
      const agora = Date.now();
      const expira = row.canal_expira_em ? new Date(row.canal_expira_em).getTime() : 0;
      const diasRestantes = expira > agora ? Math.round((expira - agora) / (1000 * 60 * 60 * 24)) : 0;

      const rawAgendas = Array.isArray(row.agendas) ? row.agendas : [];
      const agendas: GoogleCalendarItem[] =
        rawAgendas.length > 0
          ? rawAgendas
          : (row.calendar_id
              ? [{ id: row.calendar_id, nome: 'Agenda Principal' }]
              : []);

      return {
        id: row.id,
        calendarId: row.calendar_id,
        calendarIds: row.calendar_ids || agendas.map((a) => a.id),
        agendas,
        ativo: row.ativo,
        canalId: row.canal_id,
        canalExpiraEm: row.canal_expira_em,
        diasRestantes,
        syncTokenConfigurado: Boolean(row.sync_token),
        ultimoSyncEm: row.ultimo_sync_em,
        ultimoSyncSucesso: row.ultimo_sync_sucesso,
        ultimoErro: row.ultimo_erro,
        sincronizarNovosEventos: row.sincronizar_novos_eventos,
        configuracaoPadraoId: row.configuracao_padrao_id,
      };
    },
  });

  // 2. Diagnóstico ao vivo via Edge Function
  const diagnosticsQuery = useQuery({
    queryKey: KEYS.diagnostics,
    enabled: autoCheck,
    queryFn: async (): Promise<GoogleCalendarDiagnostics> => {
      const res = await supabase.functions.invoke('sync-google-calendar', {
        body: { acao: 'diagnostico' },
      });
      if (res.error) throw res.error;
      return res.data;
    },
  });

  // 3. Atualizar configurações locais
  const updateConfig = useMutation({
    mutationFn: async (input: {
      calendarId?: string;
      calendarIds?: string[];
      agendas?: GoogleCalendarItem[];
      configuracaoPadraoId?: number | null;
    }) => {
      const payload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (input.calendarId !== undefined) payload.calendar_id = input.calendarId.trim();
      if (input.calendarIds !== undefined) payload.calendar_ids = input.calendarIds;
      if (input.agendas !== undefined) {
        payload.agendas = input.agendas;
        payload.calendar_ids = input.agendas.map((a) => a.id.trim());
        if (input.agendas.length > 0) {
          payload.calendar_id = input.agendas[0].id.trim();
        }
      }
      if (input.configuracaoPadraoId !== undefined) payload.configuracao_padrao_id = input.configuracaoPadraoId;

      const { error } = await supabase
        .from('google_calendar_config' as any)
        .update(payload)
        .eq('id', 1);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.config });
      toast.success('Configurações do Google Calendar salvas');
    },
    onError: (err: any) => {
      toast.error(`Erro ao salvar: ${err?.message || 'Falha ao atualizar'}`);
    },
  });

  // 4. Assinar ou renovar o canal de Webhook (events.watch)
  const assinarCanal = useMutation({
    mutationFn: async (calendarId?: string) => {
      const res = await supabase.functions.invoke('sync-google-calendar', {
        body: { acao: 'assinar_canal', calendarId },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: KEYS.config });
      queryClient.invalidateQueries({ queryKey: KEYS.diagnostics });
      toast.success('Canal de Webhook registrado no Google Agenda com sucesso!', {
        description: data?.expiraEm ? `Expira em: ${new Date(data.expiraEm).toLocaleDateString('pt-BR')}` : undefined,
      });
    },
    onError: (err: any) => {
      toast.error('Não foi possível ativar o Webhook do Google', {
        description: err?.message || 'Verifique as credenciais da Service Account e permissões da agenda.',
      });
    },
  });

  // 5. Parar o canal
  const pararCanal = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('sync-google-calendar', {
        body: { acao: 'parar_canal' },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.config });
      queryClient.invalidateQueries({ queryKey: KEYS.diagnostics });
      toast.success('Canal de Webhook desativado');
    },
    onError: (err: any) => {
      toast.error('Erro ao parar canal', { description: err?.message });
    },
  });

  // 6. Sincronizar evento de agendamento individual
  const sincronizarAgendamento = useMutation({
    mutationFn: async (envioId: number) => {
      const res = await supabase.functions.invoke('sync-google-calendar', {
        body: { acao: 'sincronizar_agendamento', envioId },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminder-appointments'] });
    },
    onError: (err: any) => {
      console.warn('[useReminderGoogleCalendar] Erro ao sincronizar agendamento:', err);
    },
  });

  // 7. Sincronizar todos os agendamentos pendentes
  const sincronizarTodos = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('sync-google-calendar', {
        body: { acao: 'sincronizar_todos' },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reminder-appointments'] });
      toast.success(`${data?.total || 0} agendamento(s) enviado(s) para a Google Agenda`);
    },
    onError: (err: any) => {
      toast.error('Erro ao sincronizar todos', { description: err?.message });
    },
  });

  // 8. Puxar eventos da Google Agenda
  const puxarDoGoogle = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('sync-google-calendar', {
        body: { acao: 'puxar_do_google' },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reminder-appointments'] });
      queryClient.invalidateQueries({ queryKey: ['reminder-messages'] });
      queryClient.invalidateQueries({ queryKey: ['reminder-events'] });
      queryClient.invalidateQueries({ queryKey: KEYS.config });
      queryClient.invalidateQueries({ queryKey: KEYS.diagnostics });

      toast.success('Google Agenda sincronizada com sucesso!', {
        description: `${data?.salvosOuAtualizados ?? 0} agendamento(s) verificado(s).`,
      });
    },
    onError: (err: any) => {
      toast.error('Não foi possível sincronizar com o Google Agenda', {
        description: err?.message || 'Verifique as permissões da agenda.',
      });
    },
  });

  return {
    config: configQuery.data,
    configLoading: configQuery.isLoading,
    diagnostics: diagnosticsQuery.data,
    diagnosticsLoading: diagnosticsQuery.isFetching,
    refetchDiagnostics: diagnosticsQuery.refetch,
    updateConfig,
    assinarCanal,
    pararCanal,
    sincronizarAgendamento,
    sincronizarTodos,
    puxarDoGoogle,
  };
}
