import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (table: string) => any };
const db = supabase as unknown as Db;

export type AgendaProfissional = {
  id: string;
  nome: string;
  cor: string;
  ativo: boolean;
  unidade?: string | null;
  titulo?: string | null;
  email?: string | null;
  convidar_por_email?: boolean;
};

export type AgendaEspecialidade = {
  id: string;
  chave: string;
  nome: string;
  duracao_padrao_minutos: number;
  duracao_retorno_minutos: number;
  ativo: boolean;
  descricao?: string | null;
  aliases?: string[];
  operacoes_permitidas?: string[];
  intervalo_slots_minutos?: number;
  campos_obrigatorios?: string[];
  instrucoes_prompt?: string | null;
  antecedencia_minima_minutos?: number;
  busca_horizonte_dias?: number;
  busca_max_dias_com_vaga?: number;
  busca_max_horarios_por_dia?: number;
  busca_apresentar_max_datas?: number;
  busca_apresentar_max_horarios?: number;
  busca_ordem?: 'proximos' | 'em_torno_da_data';
  max_pets_por_agendamento?: number;
  capacidade_simultanea?: number;
  titulo_evento_modelo?: string | null;
  descricao_evento_modelo?: string | null;
  local_evento?: string | null;
  enviar_convite_cliente?: boolean;
  mensagem_agendamento_equipe?: string | null;
  tag_id?: number | null;
};

export type AgendaCalendario = {
  id: string;
  nome: string;
  ativo: boolean;
};

export type AgendaRegra = {
  id: string;
  profissional_id: string;
  especialidade_id: string;
  calendario_id: string | null;
  ativo: boolean;
  nome_exibicao?: string | null;
  duracao_padrao_minutos?: number | null;
  duracao_retorno_minutos?: number | null;
  intervalo_slots_minutos?: number | null;
  operacoes_permitidas?: string[] | null;
  instrucoes_prompt?: string | null;
  antecedencia_minima_minutos?: number | null;
  capacidade_simultanea?: number | null;
  max_pets_por_agendamento?: number | null;
  titulo_evento_modelo?: string | null;
  descricao_evento_modelo?: string | null;
  local_evento?: string | null;
};

export type AgendaJanela = {
  id: string;
  regra_id: string;
  dia_semana: number;
  inicio: string;
  fim: string;
  ultimo_inicio: string | null;
  recorrencia?: 'semanal' | 'quinzenal';
  ancora_quinzenal?: string | null;
};

export type AgendaFeriado = {
  id: string;
  data: string;
  descricao: string | null;
  dia_inteiro: boolean;
  inicio: string | null;
  fim: string | null;
  regra_id: string | null;
};

export type AgendaTag = { id: number; nome: string };

export type AgendaServicoPreco = { id: string; nome: string; preco: number | null; tipo_agenda_id: string | null; ativo: boolean };

export type AgendaIntervalo = {
  id: string;
  regra_id: string;
  tipo: 'almoco' | 'pausa' | 'bloqueio';
  dia_semana: number | null;
  data_especifica: string | null;
  inicio: string;
  fim: string;
  ativo: boolean;
  descricao: string | null;
};

const KEY = ['agenda-configuracao'];

async function carregarConfiguracao() {
  const [profissionais, especialidades, calendarios, regras, janelas, intervalos, feriados, tags, servicos] = await Promise.all([
    db.from('agenda_profissionais').select('*').order('nome'),
    db.from('agenda_especialidades').select('*').order('nome'),
    db.from('agenda_calendarios').select('id,nome,ativo').order('nome'),
    db.from('agenda_regras').select('*').order('created_at'),
    db.from('agenda_janelas_semanais').select('*').order('dia_semana').order('inicio'),
    db.from('agenda_intervalos').select('*').order('dia_semana').order('inicio'),
    db.from('agenda_feriados').select('*').order('data'),
    db.from('tags').select('id,nome').order('nome'),
    db.from('clinica_servicos').select('id,nome,preco,tipo_agenda_id,ativo'),
  ]);

  const erro = [profissionais, especialidades, calendarios, regras, janelas, intervalos]
    .map((result) => result.error)
    .find(Boolean);
  if (erro) throw erro;

  return {
    profissionais: (profissionais.data || []) as AgendaProfissional[],
    especialidades: (especialidades.data || []) as AgendaEspecialidade[],
    calendarios: (calendarios.data || []) as AgendaCalendario[],
    regras: (regras.data || []) as AgendaRegra[],
    janelas: (janelas.data || []) as AgendaJanela[],
    intervalos: (intervalos.data || []) as AgendaIntervalo[],
    // Tabelas das migrações mais novas: se ainda não existirem, o restante da tela continua funcionando.
    feriados: (feriados.error ? [] : feriados.data || []) as AgendaFeriado[],
    tags: (tags.error ? [] : tags.data || []) as AgendaTag[],
    servicos: (servicos.error ? [] : servicos.data || []) as AgendaServicoPreco[],
    recursosNovos: !feriados.error,
  };
}

export function useAgendaConfiguracao() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: KEY, queryFn: carregarConfiguracao, staleTime: 15_000 });
  const atualizar = () => client.invalidateQueries({ queryKey: KEY });

  const criarProfissional = useMutation({
    mutationFn: async (input: Pick<AgendaProfissional, 'nome' | 'cor'>) => {
      const { error } = await db.from('agenda_profissionais').insert({
        nome: input.nome.trim(),
        cor: input.cor,
      });
      if (error) throw error;
    },
    onSuccess: atualizar,
  });

  const criarEspecialidade = useMutation({
    mutationFn: async (input: {
      chave: string;
      nome: string;
      duracaoPadrao: number;
      duracaoRetorno: number;
    }) => {
      const { error } = await db.from('agenda_especialidades').insert({
        chave: input.chave.trim().toLowerCase(),
        nome: input.nome.trim(),
        duracao_padrao_minutos: input.duracaoPadrao,
        duracao_retorno_minutos: input.duracaoRetorno,
      });
      if (error) throw error;
    },
    onSuccess: atualizar,
  });

  const criarRegra = useMutation({
    mutationFn: async (input: { profissionalId: string; especialidadeId: string; calendarioId: string }) => {
      const { error } = await db.from('agenda_regras').insert({
        profissional_id: input.profissionalId,
        especialidade_id: input.especialidadeId,
        calendario_id: input.calendarioId,
      });
      if (error) throw error;
    },
    onSuccess: atualizar,
  });

  const criarJanela = useMutation({
    mutationFn: async (input: {
      regraId: string;
      diaSemana: number;
      inicio: string;
      fim: string;
      ultimoInicio: string | null;
      recorrencia?: 'semanal' | 'quinzenal';
      ancoraQuinzenal?: string | null;
    }) => {
      const quinzenal = input.recorrencia === 'quinzenal';
      const { error } = await db.from('agenda_janelas_semanais').insert({
        regra_id: input.regraId,
        dia_semana: input.diaSemana,
        inicio: input.inicio,
        fim: input.fim,
        ultimo_inicio: input.ultimoInicio || null,
        recorrencia: quinzenal ? 'quinzenal' : 'semanal',
        ancora_quinzenal: quinzenal ? input.ancoraQuinzenal || null : null,
      });
      if (error) throw error;
    },
    onSuccess: atualizar,
  });

  const criarFeriado = useMutation({
    mutationFn: async (input: {
      data: string;
      descricao: string;
      diaInteiro: boolean;
      inicio: string | null;
      fim: string | null;
      regraId: string | null;
    }) => {
      const { error } = await db.from('agenda_feriados').insert({
        data: input.data,
        descricao: input.descricao.trim() || null,
        dia_inteiro: input.diaInteiro,
        inicio: input.diaInteiro ? null : input.inicio,
        fim: input.diaInteiro ? null : input.fim,
        regra_id: input.regraId || null,
      });
      if (error) throw error;
    },
    onSuccess: atualizar,
  });

  const criarIntervalo = useMutation({
    mutationFn: async (input: {
      regraId: string;
      tipo: AgendaIntervalo['tipo'];
      diaSemana: number | null;
      dataEspecifica: string | null;
      inicio: string;
      fim: string;
      descricao: string;
    }) => {
      const { error } = await db.from('agenda_intervalos').insert({
        regra_id: input.regraId,
        tipo: input.tipo,
        dia_semana: input.dataEspecifica ? null : input.diaSemana,
        data_especifica: input.dataEspecifica || null,
        inicio: input.inicio,
        fim: input.fim,
        descricao: input.descricao.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: atualizar,
  });

  const alternarAtivo = useMutation({
    mutationFn: async (input: { tabela: string; id: string; ativo: boolean }) => {
      const { error } = await db.from(input.tabela).update({ ativo: input.ativo }).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: atualizar,
  });

  const remover = useMutation({
    mutationFn: async (input: { tabela: string; id: string }) => {
      const { error } = await db.from(input.tabela).delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: atualizar,
  });

  const regrasComNomes = useMemo(() => {
    const data = query.data;
    if (!data) return [];
    return data.regras.map((regra) => ({
      ...regra,
      profissional: data.profissionais.find((item) => item.id === regra.profissional_id),
      especialidade: data.especialidades.find((item) => item.id === regra.especialidade_id),
      calendario: data.calendarios.find((item) => item.id === regra.calendario_id),
    }));
  }, [query.data]);

  return {
    ...query.data,
    regrasComNomes,
    loading: query.isPending,
    error: query.error,
    criarProfissional,
    criarEspecialidade,
    criarRegra,
    criarJanela,
    criarFeriado,
    criarIntervalo,
    alternarAtivo,
    remover,
  };
}

