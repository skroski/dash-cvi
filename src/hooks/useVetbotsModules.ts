/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { fetchAllRows } from '@/lib/fetchAllRows';
import type { ChatCategory, QueueItem, QueueOrigin, QueuePriority, QueueRoom, QueueService, WebConversation, WebMessage } from '@/types/vetbotsModules';

// Tipos gerados pelo Supabase são atualizados no próximo `supabase gen types`.
// O cast mantém esta migração utilizável antes desse passo no CI/local.
const db = supabase as never as { from: (table: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => any; channel: typeof supabase.channel; removeChannel: typeof supabase.removeChannel };

const mapConversation = (r: any): WebConversation => ({ id:r.id, code:r.codigo, sessionId:r.session_id, tutorName:r.nome_tutor, petName:r.nome_pet, phone:r.telefone, status:r.status, categoryId:r.categoria_id, updatedAt:r.updated_at, createdAt:r.created_at });
const mapMessage = (r: any): WebMessage => ({ id:r.id, conversationId:r.conversa_id, content:r.conteudo, direction:r.direcao, categoryId:r.categoria_id, optionKey:r.opcao_chave, createdAt:r.created_at });
const mapService = (r: any): QueueService => ({ id: r.id, name: r.nome ?? r.name ?? '', prefix: r.prefixo ?? r.prefix ?? 'A', active: r.ativo ?? r.active ?? true, order: r.ordem ?? r.order ?? 0, nome: r.nome, prefixo: r.prefixo, ativo: r.ativo });
const mapRoom = (r: any): QueueRoom => ({ id: r.id, name: r.nome ?? r.name ?? '', active: r.ativa ?? r.active ?? true, nome: r.nome, ativa: r.ativa });
const mapItem = (r: any): QueueItem => ({
  id: r.id,
  ticket: r.senha,
  serviceId: r.servico_id,
  roomId: r.sala_id,
  tutorName: r.tutor_nome,
  petName: r.pet_nome,
  veterinarianName: r.veterinario_nome,
  priority: r.prioridade,
  status: r.status,
  arrivedAt: r.chegada_em,
  calledAt: r.chamado_em,
  startedAt: r.iniciado_em,
  finishedAt: r.finalizado_em,
  clienteId: r.cliente_id,
  petId: r.pet_id,
  motivoResumido: r.motivo_resumido,
  chamadoPor: r.chamado_por,
  iniciadoPor: r.iniciado_por,
  finalizadoPor: r.finalizado_por,
  ausenteEm: r.ausente_em,
  ausentePor: r.ausente_por,
  canceladoEm: r.cancelado_em,
  canceladoPor: r.cancelado_por,
  historicoTransferencias: r.historico_transferencias || [],
  phone: r.telefone ?? null,
  origin: r.origem ?? 'balcao',
  cycle: r.ciclo,
  notices: r.avisos || {},
});

export function useWebChat() {
  const client = useQueryClient(); const { user } = useAuth();
  const categories = useQuery({ queryKey:['web-chat-categories'], queryFn: async () => { const {data,error}=await db.from('chat_web_categorias').select('*').eq('ativo',true).order('ordem'); if(error) throw error; return (data||[]) as ChatCategory[]; } });
  const conversations = useQuery({ queryKey:['web-chat-conversations'], queryFn: async () => { const {data,error}=await db.from('chat_web_conversas').select('*').order('updated_at',{ascending:false}); if(error) throw error; return (data||[]).map(mapConversation); } });
  useEffect(() => { const c=db.channel('chat-web-dashboard').on('postgres_changes',{event:'*',schema:'public',table:'chat_web_conversas'},()=>client.invalidateQueries({queryKey:['web-chat-conversations']})).on('postgres_changes',{event:'*',schema:'public',table:'chat_web_mensagens'},()=>client.invalidateQueries({queryKey:['web-chat-messages']})).subscribe(); return ()=>{db.removeChannel(c)}; },[client]);
  const createConversation = useMutation({ mutationFn: async (input:{tutorName:string;petName?:string;phone?:string}) => { const {data,error}=await db.from('chat_web_conversas').insert({nome_tutor:input.tutorName,nome_pet:input.petName||null,telefone:input.phone||null,created_by:user?.id}).select().single(); if(error) throw error; return mapConversation(data); }, onSuccess:()=>client.invalidateQueries({queryKey:['web-chat-conversations']}) });
  const sendMessage = useMutation({ mutationFn: async (input:{conversationId:string;content:string;categoryId?:string|null;optionKey?:string|null}) => { const {error}=await db.from('chat_web_mensagens').insert({conversa_id:input.conversationId,conteudo:input.content.trim(),direcao:'enviada',categoria_id:input.categoryId||null,opcao_chave:input.optionKey||null,enviado_por:user?.id}); if(error) throw error; const update=await db.from('chat_web_conversas').update({updated_at:new Date().toISOString()}).eq('id',input.conversationId); if(update.error) throw update.error; }, onSuccess:(_,v)=>client.invalidateQueries({queryKey:['web-chat-messages',v.conversationId]}) });
  return {categories,conversations,createConversation,sendMessage};
}

export function useWebChatMessages(conversationId: string | null) {
  return useQuery({ queryKey:['web-chat-messages',conversationId], enabled:!!conversationId, queryFn: async () => { const {data,error}=await db.from('chat_web_mensagens').select('*').eq('conversa_id',conversationId).order('created_at'); if(error) throw error; return (data||[]).map(mapMessage); } });
}

export function useQueue() {
  const client=useQueryClient(); const {user}=useAuth();
  const services=useQuery({queryKey:['queue-services'],queryFn:async()=>{const {data,error}=await db.from('fila_servicos').select('*').order('ordem');if(error)throw error;return (data||[]).map(mapService)}});
  const rooms=useQuery({queryKey:['queue-rooms'],queryFn:async()=>{const {data,error}=await db.from('fila_salas').select('*').order('nome');if(error)throw error;return (data||[]).map(mapRoom)}});
  // Ativos + últimos 30 dias (as métricas usam esse intervalo). Sem filtro, a lista cresce para sempre e o
  // PostgREST corta em 1000 linhas SEM erro: com a tabela cheia, a fila de hoje sumiria da tela.
  const items=useQuery({queryKey:['queue-items'],queryFn:async()=>{
    const corte=new Date(Date.now()-30*86400000).toISOString();
    // Duas consultas simples (sem montar filtro em texto) e junta por id: os ativos de dias anteriores também entram.
    const [ativos,recentes]=await Promise.all([
      fetchAllRows<any>((from,to)=>db.from('fila_itens').select('*').in('status',['aguardando','chamado','em_atendimento']).order('chegada_em').order('id').range(from,to)),
      fetchAllRows<any>((from,to)=>db.from('fila_itens').select('*').gte('chegada_em',corte).order('chegada_em').order('id').range(from,to)),
    ]);
    const porId=new Map<string,any>();
    for(const linha of [...ativos,...recentes]) porId.set(linha.id,linha);
    return [...porId.values()].sort((a,b)=>String(a.chegada_em).localeCompare(String(b.chegada_em))).map(mapItem);
  }});
  useEffect(()=>{const c=db.channel('queue-dashboard').on('postgres_changes',{event:'*',schema:'public',table:'fila_itens'},()=>client.invalidateQueries({queryKey:['queue-items']})).on('postgres_changes',{event:'*',schema:'public',table:'fila_servicos'},()=>client.invalidateQueries({queryKey:['queue-services']})).on('postgres_changes',{event:'*',schema:'public',table:'fila_salas'},()=>client.invalidateQueries({queryKey:['queue-rooms']})).subscribe();return()=>{db.removeChannel(c)}},[client]);
  const createItem = useMutation({
    mutationFn: async (input: {
      serviceId: string;
      tutorName: string;
      petName?: string;
      veterinarianName?: string;
      priority: QueuePriority;
      clienteId?: number | null;
      petId?: string | null;
      motivoResumido?: string | null;
      roomId?: string | null;
      phone?: string | null;
      origin?: QueueOrigin;
    }) => {
      try {
        const { data, error } = await db.rpc('adicionar_item_fila', {
          p_servico_id: input.serviceId,
          p_tutor_nome: input.tutorName,
          p_pet_nome: input.petName || null,
          p_veterinario_nome: input.veterinarianName || null,
          p_prioridade: input.priority,
          p_cliente_id: input.clienteId || null,
          p_pet_id: input.petId || null,
          p_motivo_resumido: input.motivoResumido || null,
          p_sala_id: input.roomId || null,
          p_telefone: input.phone || null,
          p_origem: input.origin || 'balcao',
        });
        if (error) throw error;
        return mapItem(data);
      } catch (err: any) {
        // Fallback gracioso para a versão de 5 parâmetros
        if (err?.message?.includes('adicionar_item_fila') || err?.code === 'PGRST202') {
          const { data: fbData, error: fbErr } = await db.rpc('adicionar_item_fila', {
            p_servico_id: input.serviceId,
            p_tutor_nome: input.tutorName,
            p_pet_nome: input.petName || null,
            p_veterinario_nome: input.veterinarianName || null,
            p_prioridade: input.priority,
          });
          if (fbErr) throw fbErr;
          return mapItem(fbData);
        }
        throw err;
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['queue-items'] }),
  });

  const act = useMutation({
    mutationFn: async (input: {
      id: string;
      action: string;
      roomId?: string | null;
      serviceId?: string | null;
      reason?: string | null;
    }) => {
      try {
        const { error } = await db.rpc('alterar_status_fila', {
          p_item_id: input.id,
          p_acao: input.action,
          p_sala_id: input.roomId || null,
          p_novo_servico_id: input.serviceId || null,
          p_motivo: input.reason || null,
        });
        if (error) throw error;
      } catch (err: any) {
        // Fallback para versão de 3 parâmetros
        if (err?.message?.includes('alterar_status_fila') || err?.code === 'PGRST202') {
          const { error: fbErr } = await db.rpc('alterar_status_fila', {
            p_item_id: input.id,
            p_acao: input.action,
            p_sala_id: input.roomId || null,
          });
          if (fbErr) throw fbErr;
          return;
        }
        throw err;
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['queue-items'] }),
  });

  const createService = useMutation({
    mutationFn: async (input: { name: string; prefix: string; order?: number }) => {
      const { data, error } = await db
        .from('fila_servicos')
        .insert({
          nome: input.name.trim(),
          prefixo: input.prefix.trim().toUpperCase(),
          ordem: input.order ?? 0,
          ativo: true,
        })
        .select()
        .single();
      if (error) {
        const { data: rpcData, error: rpcError } = await db.rpc('salvar_servico_fila', {
          p_nome: input.name.trim(),
          p_prefixo: input.prefix.trim().toUpperCase(),
          p_ordem: input.order ?? 0,
        });
        if (rpcError) throw error;
        return mapService(rpcData);
      }
      return mapService(data);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['queue-services'] }),
  });

  const updateService = useMutation({
    mutationFn: async (input: {
      id: string;
      name: string;
      prefix: string;
      order?: number;
      active?: boolean;
    }) => {
      const { data, error } = await db
        .from('fila_servicos')
        .update({
          nome: input.name.trim(),
          prefixo: input.prefix.trim().toUpperCase(),
          ordem: input.order ?? 0,
          ativo: input.active ?? true,
        })
        .eq('id', input.id)
        .select()
        .single();
      if (error) {
        const { data: rpcData, error: rpcError } = await db.rpc('salvar_servico_fila', {
          p_nome: input.name.trim(),
          p_prefixo: input.prefix.trim().toUpperCase(),
          p_ordem: input.order ?? 0,
          p_id: input.id,
        });
        if (rpcError) throw error;
        return mapService(rpcData);
      }
      return mapService(data);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['queue-services'] }),
  });

  const toggleService = useMutation({
    mutationFn: async (input: { id: string; active: boolean }) => {
      const { error } = await db.from('fila_servicos').update({ ativo: input.active }).eq('id', input.id);
      if (error) {
        const { error: rpcError } = await db.rpc('alternar_servico_fila', {
          p_id: input.id,
          p_ativo: input.active,
        });
        if (rpcError) throw error;
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['queue-services'] }),
  });

  const deleteService = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('fila_servicos').delete().eq('id', id);
      if (error) {
        const { error: rpcError } = await db.rpc('excluir_servico_fila', { p_id: id });
        if (rpcError) throw error;
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['queue-services'] }),
  });

  const createRoom = useMutation({
    mutationFn: async (input: { name: string }) => {
      const { data, error } = await db
        .from('fila_salas').insert({ nome: input.name.trim(), ativa: true }).select().single();
      if (error) {
        const { data: rpcData, error: rpcError } = await db.rpc('salvar_sala_fila', {
          p_nome: input.name.trim(),
          p_ativa: true,
        });
        if (rpcError) throw error;
        return mapRoom(rpcData);
      }
      return mapRoom(data);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['queue-rooms'] }),
  });

  const updateRoom = useMutation({
    mutationFn: async (input: { id: string; name: string; active?: boolean }) => {
      const { data, error } = await db
        .from('fila_salas')
        .update({ nome: input.name.trim(), ativa: input.active ?? true })
        .eq('id', input.id)
        .select()
        .single();
      if (error) {
        const { data: rpcData, error: rpcError } = await db.rpc('salvar_sala_fila', {
          p_nome: input.name.trim(),
          p_ativa: input.active ?? true,
          p_id: input.id,
        });
        if (rpcError) throw error;
        return mapRoom(rpcData);
      }
      return mapRoom(data);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['queue-rooms'] }),
  });

  const toggleRoom = useMutation({
    mutationFn: async (input: { id: string; active: boolean }) => {
      const { error } = await db.from('fila_salas').update({ ativa: input.active }).eq('id', input.id);
      if (error) {
        const { error: rpcError } = await db.rpc('alternar_sala_fila', {
          p_id: input.id,
          p_ativa: input.active,
        });
        if (rpcError) throw error;
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['queue-rooms'] }),
  });

  const deleteRoom = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('fila_salas').delete().eq('id', id);
      if (error) {
        const { error: rpcError } = await db.rpc('excluir_sala_fila', { p_id: id });
        if (rpcError) throw error;
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['queue-rooms'] }),
  });

  const changeRoom = useMutation({
    mutationFn: async (input: { itemId: string; roomId: string }) => {
      // Só o RPC altera a senha (a RLS não permite UPDATE direto) e ele registra a transferência.
      const { error } = await db.rpc('alterar_status_fila', {
        p_item_id: input.itemId,
        p_acao: 'transferir',
        p_sala_id: input.roomId,
      });
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['queue-items'] }),
  });

  const transferItem = useMutation({
    mutationFn: async (input: {
      itemId: string;
      newRoomId?: string | null;
      newServiceId?: string | null;
      reason?: string | null;
    }) => {
      try {
        const { error } = await db.rpc('alterar_status_fila', {
          p_item_id: input.itemId,
          p_acao: 'transferir',
          p_sala_id: input.newRoomId || null,
          p_novo_servico_id: input.newServiceId || null,
          p_motivo: input.reason || null,
        });
        if (error) throw error;
      } catch (err: any) {
        // Fallback direto via update preservando chegada
        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        if (input.newRoomId) updates.sala_id = input.newRoomId;
        if (input.newServiceId) updates.servico_id = input.newServiceId;
        const { error: updErr } = await db.from('fila_itens').update(updates).eq('id', input.itemId);
        if (updErr) throw err;
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['queue-items'] }),
  });

  return {
    services,
    rooms,
    items,
    createItem,
    act,
    createService,
    updateService,
    toggleService,
    deleteService,
    createRoom,
    updateRoom,
    toggleRoom,
    deleteRoom,
    changeRoom,
    transferItem,
  };
}

export function useMyPrompt(enabled:boolean) {
  const client=useQueryClient(); const {user}=useAuth();
  const prompt=useQuery({queryKey:['my-prompt'],enabled,queryFn:async()=>{const {data,error}=await db.from('meu_prompt_versoes').select('*').order('versao',{ascending:false});if(error)throw error;return data||[]}});
  const save=useMutation({mutationFn:async(content:string)=>{const current=prompt.data?.[0]?.versao||0;const {error}=await db.from('meu_prompt_versoes').insert({conteudo:content,versao:current+1,criado_por:user?.id});if(error)throw error},onSuccess:()=>client.invalidateQueries({queryKey:['my-prompt']})});
  return {prompt,save};
}
