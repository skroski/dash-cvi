import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { ClientTag, Tag } from '@/types/crm';

const TAGS_KEY = ['tags'];
const CLIENT_TAGS_KEY = ['client-tags'];

const MIGRATION_HINT =
  'Verifique se a migração de pendências/tags foi aplicada no Supabase.';

async function fetchTags(): Promise<Tag[]> {
  const { data, error } = await supabase.from('tags').select('id, nome, cor').order('nome');
  if (error) throw error;
  return data || [];
}

async function fetchClientTags(): Promise<ClientTag[]> {
  const { data, error } = await supabase.from('client_tags').select('id, client_id, tag_id');
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    clientId: row.client_id,
    tagId: row.tag_id,
  }));
}

export function useTags() {
  const queryClient = useQueryClient();

  const tagsQuery = useQuery({
    queryKey: TAGS_KEY,
    queryFn: fetchTags,
    staleTime: 60_000,
    retry: false,
  });

  const clientTagsQuery = useQuery({
    queryKey: CLIENT_TAGS_KEY,
    queryFn: fetchClientTags,
    staleTime: 30_000,
    retry: false,
  });

  const tags = useMemo(() => tagsQuery.data || [], [tagsQuery.data]);
  const clientTags = useMemo(() => clientTagsQuery.data || [], [clientTagsQuery.data]);

  // Tags de cada cliente (usado em badges e filtros)
  const tagsPorCliente = useMemo(() => {
    const tagById = new Map(tags.map((tag) => [tag.id, tag]));
    const map = new Map<number, Tag[]>();
    for (const link of clientTags) {
      const tag = tagById.get(link.tagId);
      if (!tag) continue;
      const list = map.get(link.clientId);
      if (list) {
        list.push(tag);
      } else {
        map.set(link.clientId, [tag]);
      }
    }
    return map;
  }, [tags, clientTags]);

  const invalidateTags = () => queryClient.invalidateQueries({ queryKey: TAGS_KEY });
  const invalidateClientTags = () => queryClient.invalidateQueries({ queryKey: CLIENT_TAGS_KEY });

  const createTag = useMutation({
    mutationFn: async (input: { nome: string; cor: string }) => {
      const { data, error } = await supabase
        .from('tags')
        .insert({ nome: input.nome.trim(), cor: input.cor })
        .select('id, nome, cor')
        .single();
      if (error) throw error;
      return data as Tag;
    },
    onSuccess: () => {
      invalidateTags();
      toast.success('Tag criada');
    },
    onError: (error) => {
      console.error('Erro ao criar tag:', error);
      toast.error('Erro ao criar tag', {
        description:
          (error as PostgrestError)?.code === '23505'
            ? 'Já existe uma tag com esse nome.'
            : MIGRATION_HINT,
      });
    },
  });

  const updateTag = useMutation({
    mutationFn: async (input: { id: number; nome: string; cor: string }) => {
      const { error } = await supabase
        .from('tags')
        .update({ nome: input.nome.trim(), cor: input.cor })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateTags();
      toast.success('Tag atualizada');
    },
    onError: (error) => {
      console.error('Erro ao atualizar tag:', error);
      toast.error('Erro ao atualizar tag', {
        description:
          (error as PostgrestError)?.code === '23505'
            ? 'Já existe uma tag com esse nome.'
            : undefined,
      });
    },
  });

  const deleteTag = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('tags').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateTags();
      invalidateClientTags();
      toast.success('Tag removida', { description: 'A tag foi removida de todos os clientes.' });
    },
    onError: (error) => {
      console.error('Erro ao remover tag:', error);
      toast.error('Erro ao remover tag');
    },
  });

  const assignTag = useMutation({
    mutationFn: async (input: { clientId: number; tagId: number }) => {
      const { error } = await supabase
        .from('client_tags')
        .insert({ client_id: input.clientId, tag_id: input.tagId });
      // 23505 = vínculo já existe; tratar como sucesso silencioso
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: () => {
      invalidateClientTags();
    },
    onError: (error) => {
      console.error('Erro ao aplicar tag:', error);
      toast.error('Erro ao aplicar tag', { description: MIGRATION_HINT });
    },
  });

  const unassignTag = useMutation({
    mutationFn: async (input: { clientId: number; tagId: number }) => {
      const { error } = await supabase
        .from('client_tags')
        .delete()
        .eq('client_id', input.clientId)
        .eq('tag_id', input.tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateClientTags();
    },
    onError: (error) => {
      console.error('Erro ao remover tag do cliente:', error);
      toast.error('Erro ao remover tag do cliente');
    },
  });

  return {
    tags,
    tagsLoading: tagsQuery.isPending,
    setupError: !!(tagsQuery.error || clientTagsQuery.error),
    tagsPorCliente,
    createTag,
    updateTag,
    deleteTag,
    assignTag,
    unassignTag,
  };
}
