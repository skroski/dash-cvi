/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import type { VariavelPrompt } from '@/lib/promptVariaveis';
import type { CategoriaRegra, PromptCompilado, PromptPrevia, PromptRegra, PromptVersao } from '@/types/promptRegras';

const db = supabase as never as {
  from: (table: string) => any;
  rpc: (fn: string, args?: Record<string, unknown>) => any;
};

/**
 * Regras modulares do prompt. O texto compilado e as versões são geradas NO BANCO
 * (obter_prompt_compilado / prompt_salvar_versao): o navegador não monta mais o prompt.
 */
export function usePromptRegras(enabled = true) {
  const client = useQueryClient();
  const { user } = useAuth();

  const regrasQuery = useQuery({
    queryKey: ['prompt-regras'],
    enabled,
    queryFn: async (): Promise<PromptRegra[]> => {
      const { data, error } = await db
        .from('prompt_regras')
        .select('*')
        .order('ordem', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) {
        // Se a tabela ainda não foi criada, retorna vazio amigavelmente
        console.warn('Erro ao carregar prompt_regras:', error);
        return [];
      }
      return data || [];
    },
  });

  const versoesQuery = useQuery({
    queryKey: ['prompt-versoes'],
    enabled,
    queryFn: async (): Promise<PromptVersao[]> => {
      const { data, error } = await db.from('meu_prompt_versoes').select('*').order('versao', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Registro das variáveis {{...}} aceitas (fonte única, também usada para validar ao salvar).
  const variaveisQuery = useQuery({
    queryKey: ['prompt-variaveis-registro'],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<VariavelPrompt[]> => {
      const { data, error } = await db.from('prompt_variaveis').select('*').order('grupo').order('nome');
      if (error) {
        console.warn('Erro ao carregar prompt_variaveis:', error);
        return [];
      }
      return data || [];
    },
  });

  // Texto compilado das regras ATIVAS, com os marcadores {{...}} (o que é salvo em cada versão).
  const compiladoQuery = useQuery({
    queryKey: ['prompt-compilado', regrasQuery.dataUpdatedAt],
    enabled: enabled && regrasQuery.isSuccess,
    queryFn: async (): Promise<PromptCompilado | null> => {
      const { data, error } = await db.rpc('obter_prompt_compilado');
      if (error) {
        console.warn('Erro ao compilar o prompt:', error);
        return null;
      }
      const linha = Array.isArray(data) ? data[0] : data;
      return linha ?? null;
    },
  });

  const invalidarRegras = () => {
    client.invalidateQueries({ queryKey: ['prompt-regras'] });
    client.invalidateQueries({ queryKey: ['prompt-compilado'] });
  };

  const toggleRegra = useMutation({
    mutationFn: async ({ id, ativa }: { id: string; ativa: boolean }) => {
      const { error } = await db
        .from('prompt_regras')
        .update({ ativa, updated_at: new Date().toISOString(), atualizado_por: user?.id })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidarRegras,
  });

  const createRegra = useMutation({
    mutationFn: async (nova: { titulo: string; categoria: CategoriaRegra; conteudo: string }) => {
      const codigo = `regra_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const maxOrdem = (regrasQuery.data || []).reduce((acc, r) => Math.max(acc, r.ordem || 0), 100);
      const { error } = await db.from('prompt_regras').insert({
        codigo,
        titulo: nova.titulo.trim(),
        categoria: nova.categoria,
        conteudo: nova.conteudo.trim(),
        padrao: false,
        ativa: true,
        ordem: maxOrdem + 10,
        criado_por: user?.id,
        atualizado_por: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: invalidarRegras,
  });

  const updateRegra = useMutation({
    mutationFn: async (regra: { id: string; titulo: string; categoria: CategoriaRegra; conteudo: string; ordem?: number }) => {
      const valores: Record<string, unknown> = {
        titulo: regra.titulo.trim(),
        categoria: regra.categoria,
        conteudo: regra.conteudo.trim(),
        updated_at: new Date().toISOString(),
        atualizado_por: user?.id,
      };
      if (regra.ordem !== undefined) valores.ordem = regra.ordem;
      const { error } = await db.from('prompt_regras').update(valores).eq('id', regra.id);
      if (error) throw error;
    },
    onSuccess: invalidarRegras,
  });

  const deleteRegra = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('prompt_regras').delete().eq('id', id).eq('padrao', false);
      if (error) throw error;
    },
    onSuccess: invalidarRegras,
  });

  // Salvar nova versão (commit): o banco compila as regras ativas e grava a versão.
  const saveVersion = useMutation({
    mutationFn: async ({ descricao }: { descricao?: string }) => {
      const { error } = await db.rpc('prompt_salvar_versao', { p_descricao: descricao?.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['prompt-versoes'] });
      client.invalidateQueries({ queryKey: ['my-prompt'] });
    },
  });

  // Restaurar versão anterior (rollback): devolve as regras ao estado da versão e registra uma nova.
  const rollbackVersion = useMutation({
    mutationFn: async (versaoAlvo: PromptVersao) => {
      const { error } = await db.rpc('prompt_reverter_versao', { p_versao: versaoAlvo.versao });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarRegras();
      client.invalidateQueries({ queryKey: ['prompt-versoes'] });
      client.invalidateQueries({ queryKey: ['my-prompt'] });
    },
  });

  // Prévia: o prompt como o assistente o recebe agora (data, hora, empresa, serviços e horários preenchidos).
  const previa = useMutation({
    mutationFn: async (modelo?: string): Promise<PromptPrevia> => {
      const { data, error } = await supabase.functions.invoke('atendimento-config', {
        body: { action: 'previa_prompt', ...(modelo ? { modelo } : {}) },
      });
      if (error) throw error;
      return data as PromptPrevia;
    },
  });

  return {
    regras: regrasQuery.data || [],
    isLoadingRegras: regrasQuery.isLoading,
    versoes: versoesQuery.data || [],
    isLoadingVersoes: versoesQuery.isLoading,
    variaveis: variaveisQuery.data || [],
    isLoadingVariaveis: variaveisQuery.isLoading,
    compilado: compiladoQuery.data ?? null,
    toggleRegra,
    createRegra,
    updateRegra,
    deleteRegra,
    saveVersion,
    rollbackVersion,
    previa,
  };
}
