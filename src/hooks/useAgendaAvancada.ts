import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => any };
const db = supabase as unknown as Db;

export type AgendaModelo = {
  id: string;
  chave: string;
  categoria: 'tipo' | 'agenda';
  nome: string;
  descricao: string | null;
  ativo: boolean;
};

export type StatusCalendario = { id: string; nome: string; ativo: boolean; origem: 'painel' | 'secret_do_ambiente' };

export type ResultadoTeste = {
  ok: boolean;
  ativa: boolean;
  profissional: string | null;
  servico: string;
  duracaoMinutos: number;
  passoMinutos: number;
  antecedenciaMinutos?: number;
  capacidadeSimultanea?: number;
  fusoHorario?: string;
  calendarioConfigurado: boolean;
  calendarioAcessivel: boolean | null;
  dias: Array<{ data: string; horarios: string[] }>;
};

const KEY = ['agenda-avancada'];

export function useAgendaAvancada() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: KEY,
    staleTime: 15_000,
    queryFn: async () => {
      const [modelos, status] = await Promise.all([
        db.from('agenda_modelos').select('id,chave,categoria,nome,descricao,ativo').eq('ativo', true).order('nome'),
        db.rpc('agenda_status_calendarios'),
      ]);
      if (modelos.error) throw modelos.error;
      return {
        modelos: (modelos.data ?? []) as AgendaModelo[],
        calendarios: (status.error ? [] : status.data ?? []) as StatusCalendario[],
      };
    },
  });
  const atualizar = () => {
    client.invalidateQueries({ queryKey: KEY });
    client.invalidateQueries({ queryKey: ['agenda-configuracao'] });
  };

  const rpc = (fn: string) => async (args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw error;
    return data as string;
  };

  return {
    ...query.data,
    loading: query.isPending,
    salvarCalendario: useMutation({
      mutationFn: rpc('agenda_salvar_calendario'),
      onSuccess: atualizar,
    }),
    aplicarModeloTipo: useMutation({ mutationFn: rpc('agenda_aplicar_modelo_tipo'), onSuccess: atualizar }),
    criarRegraDeModelo: useMutation({ mutationFn: rpc('agenda_criar_regra_de_modelo'), onSuccess: atualizar }),
    duplicarRegra: useMutation({ mutationFn: rpc('agenda_duplicar_regra'), onSuccess: atualizar }),
    atualizarTipo: useMutation({
      mutationFn: async (input: { id: string } & Record<string, unknown>) => {
        const { id, ...resto } = input;
        const { error } = await db.from('agenda_especialidades').update(resto).eq('id', id);
        if (error) throw error;
      },
      onSuccess: atualizar,
    }),
    atualizarRegra: useMutation({
      mutationFn: async (input: { id: string } & Record<string, unknown>) => {
        const { id, ...resto } = input;
        const { error } = await db.from('agenda_regras').update(resto).eq('id', id);
        if (error) throw error;
      },
      onSuccess: atualizar,
    }),
    atualizarProfissional: useMutation({
      mutationFn: async (input: { id: string; unidade?: string | null; titulo?: string | null; email?: string | null; convidar_por_email?: boolean }) => {
        const { id, ...resto } = input;
        const { error } = await db.from('agenda_profissionais').update(resto).eq('id', id);
        if (error) throw error;
      },
      onSuccess: atualizar,
    }),
    testarRegra: useMutation({
      mutationFn: async (regraId: string) => {
        const { data, error } = await supabase.functions.invoke('agenda', { body: { acao: 'testar', regraId, dias: 7 } });
        if (error) throw error;
        return data as ResultadoTeste;
      },
    }),
  };
}

export type AgendamentoAssistente = {
  id: string;
  session_id: string;
  telefone: string | null;
  tipo_nome: string;
  profissional_nome: string | null;
  inicio: string;
  fim: string;
  status: 'confirmado' | 'cancelado' | 'remarcado';
  tutor_nome: string | null;
  pet_nome: string | null;
  email: string | null;
  criado_em: string;
};

/** Agendamentos feitos pelo assistente (substitui a planilha de auditoria do n8n). */
export function useAgendamentosAssistente(limite = 100) {
  return useQuery({
    queryKey: ['agenda-agendamentos-assistente', limite],
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await db.from('agenda_agendamentos')
        .select('id,session_id,telefone,tipo_nome,profissional_nome,inicio,fim,status,tutor_nome,pet_nome,email,criado_em')
        .order('inicio', { ascending: false }).limit(limite);
      if (error) throw error;
      return (data ?? []) as AgendamentoAssistente[];
    },
  });
}
