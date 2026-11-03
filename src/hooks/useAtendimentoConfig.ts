import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normalizarConfig } from '@/lib/configAtendimento';
import type {
  AtendimentoConfig, AtendimentoEstado, ClinicaServico, NotificacaoDestinatario,
} from '@/types/atendimentoConfig';

// types.ts é gerado do banco e ainda não conhece as tabelas novas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };
const db = supabase as unknown as Db;

const KEY = ['atendimento-config'];

export type TipoAgendaResumo = { id: string; chave: string; nome: string; ativo: boolean };

async function carregar() {
  const [config, estados, destinatarios, profissionais, departamentos, servicos, tipos] = await Promise.all([
    db.from('atendimento_config').select('*').eq('singleton', true).maybeSingle(),
    db.from('atendimento_estados').select('*').order('ordem'),
    db.from('notificacao_destinatarios').select('*').order('nome'),
    db.from('agenda_profissionais').select('id,nome,unidade').order('nome'),
    db.from('departamentos').select('id,nome').order('nome'),
    db.from('clinica_servicos').select('*').order('ordem').order('nome'),
    db.from('agenda_especialidades').select('id,chave,nome,ativo').order('nome'),
  ]);
  const erro = [config, estados, destinatarios].map((r) => r.error).find(Boolean);
  if (erro) throw erro;
  return {
    config: normalizarConfig(config.data as Partial<AtendimentoConfig> | null),
    estados: (estados.data ?? []) as AtendimentoEstado[],
    destinatarios: (destinatarios.data ?? []) as NotificacaoDestinatario[],
    profissionais: (profissionais.data ?? []) as Array<{ id: string; nome: string; unidade: string | null }>,
    departamentos: (departamentos.data ?? []) as Array<{ id: number; nome: string }>,
    // Tabelas das migrações mais novas: se ainda não existirem, a tela segue funcionando sem elas.
    servicos: (servicos.error ? [] : servicos.data ?? []) as ClinicaServico[],
    servicosDisponivel: !servicos.error,
    tipos: (tipos.error ? [] : tipos.data ?? []) as TipoAgendaResumo[],
  };
}

export function useAtendimentoConfig() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: carregar, staleTime: 15_000 });
  const atualizar = () => client.invalidateQueries({ queryKey: KEY });

  const salvarConfig = useMutation({
    mutationFn: async (input: Partial<AtendimentoConfig> & { id: string }) => {
      const { id, ...resto } = input;
      const { error } = await db.from('atendimento_config').update(resto).eq('id', id);
      if (error) throw error;
    },
    onSuccess: atualizar,
  });

  const salvarEstado = useMutation({
    mutationFn: async (input: Partial<AtendimentoEstado> & { chave: string }) => {
      const { id, padrao: _padrao, ...resto } = input as Partial<AtendimentoEstado> & { chave: string };
      const { error } = id
        ? await db.from('atendimento_estados').update(resto).eq('id', id)
        : await db.from('atendimento_estados').insert(resto);
      if (error) throw error;
    },
    onSuccess: atualizar,
  });

  const removerEstado = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('atendimento_estados').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: atualizar,
  });

  const salvarDestinatario = useMutation({
    mutationFn: async (input: Partial<NotificacaoDestinatario> & { telefone: string; nome: string }) => {
      const { id, ...resto } = input;
      const { error } = id
        ? await db.from('notificacao_destinatarios').update(resto).eq('id', id)
        : await db.from('notificacao_destinatarios').insert(resto);
      if (error) throw error;
    },
    onSuccess: atualizar,
  });

  const removerDestinatario = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('notificacao_destinatarios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: atualizar,
  });

  const salvarServico = useMutation({
    mutationFn: async (input: Partial<ClinicaServico> & { chave: string; nome: string }) => {
      const { id, ...resto } = input;
      const { error } = id
        ? await db.from('clinica_servicos').update(resto).eq('id', id)
        : await db.from('clinica_servicos').insert(resto);
      if (error) throw error;
    },
    onSuccess: atualizar,
  });

  const removerServico = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('clinica_servicos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: atualizar,
  });

  const testarClassificacao = useMutation({
    mutationFn: async (input: { texto?: string; resposta?: string; estados?: AtendimentoEstado[] }) => {
      const { data, error } = await supabase.functions.invoke('atendimento-config', {
        body: { action: 'testar_classificacao', ...input },
      });
      if (error) throw error;
      return data as {
        mensagem_cliente?: { chave: string; nome: string } | null;
        resposta_assistente?: { chave: string; nome: string } | null;
        previa_notificacao?: string;
      };
    },
  });

  return {
    ...query.data,
    loading: query.isPending,
    error: query.error,
    salvarConfig, salvarEstado, removerEstado, salvarDestinatario, removerDestinatario, testarClassificacao,
    salvarServico, removerServico,
  };
}
