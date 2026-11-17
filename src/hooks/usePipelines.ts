import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  ActivityTipo,
  CardOrigem,
  CardPrioridade,
  ChecklistItem,
  CrmPipeline,
  CrmPipelineActivity,
  CrmPipelineCard,
  CrmPipelineStage,
  PipelineCategoria,
  StageTipo,
} from '@/types/pipeline';
import {
  criarChecklistDeTextos,
  gerarEstadoInicialFallback,
  PIPELINE_TEMPLATES,
  PipelineTemplateStage,
} from '@/lib/pipelineDefaults';
import { formatMessageTime } from '@/utils/chatUtils';
import { toWhatsappNumber } from '@/lib/formatters';
import { rotuloPreviaMidia } from '@/lib/media';

const PIPELINES_QUERY_KEY = ['crm-pipelines-bundle'];
const LOCAL_STORAGE_KEY = 'vetbots-crm-pipelines-v1';
export const PIPELINE_CONTACTS_PAGE_SIZE = 40;

type SearchConversationRow =
  Database['public']['Functions']['search_conversations']['Returns'][number];

export interface ConversationContactFeedItem {
  key: string;
  sessionId: string | null;
  clientId: number | null;
  nomeContato: string;
  telefone: string | null;
  email: string | null;
  nomePet: string | null;
  racaPet: string | null;
  portePet: string | null;
  servicoInteresse: string | null;
  cpfCnpj: string | null;
  asaasCustomerId: string | null;
  clienteAtivo: boolean;
  ultimaMensagem: string | null;
  ultimoContatoEm: string;
  ultimoContatoRotulo: string;
  latestMessageId: number;
}

interface ClientExtraRow {
  id: number;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  nome_pet: string | null;
  raca_pet: string | null;
  porte_pet: string | null;
  servico: string | null;
  cpf_cnpj: string | null;
  asaas_customer_id: string | null;
  ativo: boolean | null;
  sessionid: string | null;
  created_at: string | null;
}

function parseMsgObj(message: unknown): Record<string, unknown> | null {
  if (typeof message === 'string') {
    try {
      const parsed = JSON.parse(message);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return message && typeof message === 'object' && !Array.isArray(message)
    ? (message as Record<string, unknown>)
    : null;
}

function extractStr(record: Record<string, unknown>, field: string): string {
  const val = record[field];
  return typeof val === 'string' ? val : '';
}

function extractMessageInfo(message: unknown): { lastMessage: string; senderName: string } {
  let lastMessage = '';
  const parsed = parseMsgObj(message);

  if (!parsed && typeof message === 'string') {
    lastMessage = message;
  }

  if (parsed) {
    const content = extractStr(parsed, 'content');
    const mediaUrl = extractStr(parsed, 'mediaUrl');
    const messageType = extractStr(parsed, 'type');
    const messages = parsed.messages;

    if (content) {
      lastMessage = content;
    } else if (mediaUrl) {
      lastMessage = rotuloPreviaMidia({
        type: messageType,
        mediaUrl,
        fileName: extractStr(parsed, 'fileName'),
      });
    } else if (Array.isArray(messages)) {
      const lastRec = parseMsgObj(messages.at(-1));
      lastMessage = lastRec ? extractStr(lastRec, 'content') : '';
    }
  }

  const senderName = parsed
    ? extractStr(parsed, 'chatName') ||
      extractStr(parsed, 'pushName') ||
      extractStr(parsed, 'senderName')
    : '';

  return { lastMessage: lastMessage.trim(), senderName: senderName.trim() };
}

interface LocalStoreBundle {
  pipelines: CrmPipeline[];
  stages: CrmPipelineStage[];
  cards: CrmPipelineCard[];
  activities: CrmPipelineActivity[];
}

interface QueryBundle extends LocalStoreBundle {
  modoLocal: boolean;
}

function parseChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item, idx) => ({
      id: typeof item.id === 'string' && item.id ? item.id : `chk-${idx}`,
      texto: typeof item.texto === 'string' ? item.texto : '',
      concluido: Boolean(item.concluido),
    }))
    .filter((item) => item.texto.trim().length > 0);
}

function parseChecklistPadrao(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
}

function mapPipelineRow(row: Record<string, unknown>): CrmPipeline {
  return {
    id: String(row.id),
    nome: String(row.nome || 'Pipeline'),
    descricao: typeof row.descricao === 'string' ? row.descricao : null,
    categoria: (row.categoria as PipelineCategoria) || 'atendimento',
    cor: typeof row.cor === 'string' && row.cor ? row.cor : '#0d9488',
    padrao: Boolean(row.padrao),
    ativo: row.ativo !== false,
    ordem: Number(row.ordem) || 0,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date().toISOString(),
  };
}

function mapStageRow(row: Record<string, unknown>): CrmPipelineStage {
  return {
    id: String(row.id),
    pipelineId: String(row.pipeline_id),
    nome: String(row.nome || 'Etapa'),
    descricao: typeof row.descricao === 'string' ? row.descricao : null,
    cor: typeof row.cor === 'string' && row.cor ? row.cor : '#0d9488',
    tipo: (row.tipo as StageTipo) || 'andamento',
    slaHoras: row.sla_horas !== null && row.sla_horas !== undefined ? Number(row.sla_horas) : null,
    checklistPadrao: parseChecklistPadrao(row.checklist_padrao),
    ordem: Number(row.ordem) || 0,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date().toISOString(),
  };
}

function mapCardRow(row: Record<string, unknown>): CrmPipelineCard {
  return {
    id: String(row.id),
    pipelineId: String(row.pipeline_id),
    stageId: String(row.stage_id),
    clientId: row.client_id !== null && row.client_id !== undefined ? Number(row.client_id) : null,
    sessionId: typeof row.session_id === 'string' ? row.session_id : null,
    titulo: String(row.titulo || row.nome_contato || 'Contato'),
    nomeContato: String(row.nome_contato || row.titulo || 'Contato'),
    telefone: typeof row.telefone === 'string' ? row.telefone : null,
    email: typeof row.email === 'string' ? row.email : null,
    nomePet: typeof row.nome_pet === 'string' ? row.nome_pet : null,
    especiePet: typeof row.especie_pet === 'string' ? row.especie_pet : null,
    racaPet: typeof row.raca_pet === 'string' ? row.raca_pet : null,
    portePet: typeof row.porte_pet === 'string' ? row.porte_pet : null,
    servicoInteresse: typeof row.servico_interesse === 'string' ? row.servico_interesse : null,
    valorEstimado: Number(row.valor_estimado) || 0,
    prioridade: (row.prioridade as CardPrioridade) || 'media',
    origem: (row.origem as CardOrigem) || 'whatsapp',
    campanha: typeof row.campanha === 'string' ? row.campanha : null,
    atendenteId:
      row.atendente_id !== null && row.atendente_id !== undefined ? Number(row.atendente_id) : null,
    proximaAcao: typeof row.proxima_acao === 'string' ? row.proxima_acao : null,
    proximaAcaoEm: typeof row.proxima_acao_em === 'string' ? row.proxima_acao_em : null,
    observacoes: typeof row.observacoes === 'string' ? row.observacoes : null,
    checklist: parseChecklist(row.checklist),
    tagsCustom: Array.isArray(row.tags_custom)
      ? row.tags_custom.filter((t): t is string => typeof t === 'string')
      : [],
    motivoPerda: typeof row.motivo_perda === 'string' ? row.motivo_perda : null,
    ordem: Number(row.ordem) || 0,
    movidoEm: typeof row.movido_em === 'string' ? row.movido_em : new Date().toISOString(),
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : new Date().toISOString(),
  };
}

function mapActivityRow(row: Record<string, unknown>): CrmPipelineActivity {
  return {
    id: String(row.id),
    cardId: String(row.card_id),
    tipo: (row.tipo as ActivityTipo) || 'nota',
    descricao: String(row.descricao || ''),
    deStageId: typeof row.de_stage_id === 'string' ? row.de_stage_id : null,
    paraStageId: typeof row.para_stage_id === 'string' ? row.para_stage_id : null,
    autorNome: typeof row.autor_nome === 'string' ? row.autor_nome : null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
  };
}

function loadLocalStore(): LocalStoreBundle {
  if (typeof window === 'undefined') {
    return { ...gerarEstadoInicialFallback(), activities: [] };
  }
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalStoreBundle>;
      if (Array.isArray(parsed.pipelines) && parsed.pipelines.length > 0) {
        return {
          pipelines: parsed.pipelines,
          stages: Array.isArray(parsed.stages) ? parsed.stages : [],
          cards: Array.isArray(parsed.cards) ? parsed.cards : [],
          activities: Array.isArray(parsed.activities) ? parsed.activities : [],
        };
      }
    }
  } catch {
    // Fallback to initial state
  }
  const initial: LocalStoreBundle = {
    ...gerarEstadoInicialFallback(),
    activities: [],
  };
  saveLocalStore(initial);
  return initial;
}

function saveLocalStore(bundle: LocalStoreBundle): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(bundle));
  } catch {
    // Ignore storage quota errors
  }
}

const dbAny = supabase as unknown as {
  from: (table: string) => any;
};

async function seedDefaultPipelinesInDb(): Promise<void> {
  for (let pIdx = 0; pIdx < 3; pIdx++) {
    const tpl = PIPELINE_TEMPLATES[pIdx];
    const { data: pipeRow, error: pipeErr } = await dbAny
      .from('crm_pipelines')
      .insert({
        nome: tpl.nome,
        descricao: tpl.descricao,
        categoria: tpl.categoria,
        cor: tpl.cor,
        padrao: Boolean(tpl.padrao),
        ordem: pIdx,
      })
      .select('*')
      .single();

    if (pipeErr || !pipeRow) continue;

    const stagesPayload = tpl.estagios.map((st, sIdx) => ({
      pipeline_id: pipeRow.id,
      nome: st.nome,
      descricao: st.descricao,
      cor: st.cor,
      tipo: st.tipo,
      sla_horas: st.slaHoras,
      checklist_padrao: st.checklistPadrao,
      ordem: sIdx,
    }));

    await dbAny.from('crm_pipeline_stages').insert(stagesPayload);
  }
}

async function fetchPipelinesBundle(): Promise<QueryBundle> {
  const { data: pipeRows, error: pipeErr } = await dbAny
    .from('crm_pipelines')
    .select('*')
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true });

  if (pipeErr) {
    // Se a tabela ainda não existir no Supabase, opera em modo local com os 3 pipelines padrão
    const local = loadLocalStore();
    return { ...local, modoLocal: true };
  }

  if (!pipeRows || pipeRows.length === 0) {
    await seedDefaultPipelinesInDb();
    const { data: reseeded } = await dbAny
      .from('crm_pipelines')
      .select('*')
      .eq('ativo', true)
      .order('ordem', { ascending: true });
    if (!reseeded || reseeded.length === 0) {
      const local = loadLocalStore();
      return { ...local, modoLocal: true };
    }
    return fetchPipelinesBundleAfterRows(reseeded);
  }

  return fetchPipelinesBundleAfterRows(pipeRows);
}

async function fetchPipelinesBundleAfterRows(
  pipeRows: Record<string, unknown>[]
): Promise<QueryBundle> {
  const pipelines = pipeRows.map(mapPipelineRow);
  const pipelineIds = pipelines.map((p) => p.id);

  const [stagesRes, cardsRes, activitiesRes] = await Promise.all([
    dbAny
      .from('crm_pipeline_stages')
      .select('*')
      .in('pipeline_id', pipelineIds)
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: true }),
    dbAny
      .from('crm_pipeline_cards')
      .select('*')
      .in('pipeline_id', pipelineIds)
      .order('ordem', { ascending: true })
      .order('updated_at', { ascending: false }),
    dbAny
      .from('crm_pipeline_activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(400),
  ]);

  const stages = Array.isArray(stagesRes.data) ? stagesRes.data.map(mapStageRow) : [];
  const cards = Array.isArray(cardsRes.data) ? cardsRes.data.map(mapCardRow) : [];
  const activities = Array.isArray(activitiesRes.data)
    ? activitiesRes.data.map(mapActivityRow)
    : [];

  return {
    pipelines,
    stages,
    cards,
    activities,
    modoLocal: false,
  };
}

export interface CreatePipelineInput {
  nome: string;
  descricao?: string | null;
  categoria: PipelineCategoria;
  cor: string;
  padrao?: boolean;
  estagios: PipelineTemplateStage[];
}

export interface UpdatePipelineInput {
  id: string;
  nome: string;
  descricao?: string | null;
  categoria: PipelineCategoria;
  cor: string;
  padrao?: boolean;
  estagios: Array<{
    id?: string;
    nome: string;
    descricao: string | null;
    cor: string;
    tipo: StageTipo;
    slaHoras: number | null;
    checklistPadrao: string[];
    ordem: number;
  }>;
}

export interface CreateCardInput {
  pipelineId: string;
  stageId: string;
  clientId?: number | null;
  sessionId?: string | null;
  titulo?: string;
  nomeContato: string;
  telefone?: string | null;
  email?: string | null;
  nomePet?: string | null;
  especiePet?: string | null;
  racaPet?: string | null;
  portePet?: string | null;
  servicoInteresse?: string | null;
  valorEstimado?: number;
  prioridade?: CardPrioridade;
  origem?: CardOrigem;
  campanha?: string | null;
  atendenteId?: number | null;
  proximaAcao?: string | null;
  proximaAcaoEm?: string | null;
  observacoes?: string | null;
  checklist?: ChecklistItem[];
  tagsCustom?: string[];
  criarClienteNaBase?: boolean;
  autorNome?: string | null;
}

export function usePipelines(searchTerm = '') {
  const queryClient = useQueryClient();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  // Estado do feed inteligente de clientes por ordem de contato nas conversas (1ª coluna)
  const [conversationFeed, setConversationFeed] = useState<ConversationContactFeedItem[]>([]);
  const [clientExtrasById, setClientExtrasById] = useState<Map<number, ClientExtraRow>>(new Map());
  const [loadingContactsFeed, setLoadingContactsFeed] = useState(false);
  const [loadingMoreContactsFeed, setLoadingMoreContactsFeed] = useState(false);
  const [hasMoreContactsFeed, setHasMoreContactsFeed] = useState(true);
  const [feedPage, setFeedPage] = useState(0);
  const [totalContactsFeedCount, setTotalContactsFeedCount] = useState(0);
  const feedReqIdRef = useRef(0);

  const normalizedSearch = searchTerm.trim();
  const [debouncedSearch, setDebouncedSearch] = useState(normalizedSearch);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(normalizedSearch),
      normalizedSearch ? 280 : 0
    );
    return () => window.clearTimeout(timer);
  }, [normalizedSearch]);

  const bundleQuery = useQuery({
    queryKey: PIPELINES_QUERY_KEY,
    queryFn: fetchPipelinesBundle,
    staleTime: 15_000,
    retry: false,
  });

  const pipelines = useMemo(() => bundleQuery.data?.pipelines || [], [bundleQuery.data?.pipelines]);
  const stages = useMemo(() => bundleQuery.data?.stages || [], [bundleQuery.data?.stages]);
  const cards = useMemo(() => bundleQuery.data?.cards || [], [bundleQuery.data?.cards]);
  const activities = useMemo(
    () => bundleQuery.data?.activities || [],
    [bundleQuery.data?.activities]
  );
  const modoLocal = Boolean(bundleQuery.data?.modoLocal);

  // Busca paginada dos contatos por ordem de interação nas conversas + enriquecimento dados_cliente
  const fetchContactsFeedPage = useCallback(
    async (page = 0, append = false) => {
      const reqId = ++feedReqIdRef.current;
      const offset = page * PIPELINE_CONTACTS_PAGE_SIZE;

      if (page === 0) {
        setLoadingContactsFeed(true);
      } else {
        setLoadingMoreContactsFeed(true);
      }

      try {
        const { data: convRows, error: convErr } = await supabase.rpc('search_conversations', {
          p_search: debouncedSearch || null,
          p_limit: PIPELINE_CONTACTS_PAGE_SIZE,
          p_offset: offset,
        });

        if (reqId !== feedReqIdRef.current) return;

        const rows = (!convErr && Array.isArray(convRows) ? convRows : []) as SearchConversationRow[];
        const nonGroupRows = rows.filter((r) => r.session_id && !r.session_id.includes('@g.us'));

        // Coleta IDs de clientes das conversas + cards já salvos para enriquecer com dados_cliente (ativo, cpf_cnpj, etc.)
        const clientIdsToFetch = new Set<number>();
        for (const r of nonGroupRows) {
          if (r.client_id) clientIdsToFetch.add(Number(r.client_id));
        }

        const extraMap = new Map<number, ClientExtraRow>();
        if (clientIdsToFetch.size > 0) {
          const { data: extraRows } = await supabase
            .from('dados_cliente')
            .select(
              'id, nome, telefone, email, nome_pet, raca_pet, porte_pet, servico, cpf_cnpj, asaas_customer_id, ativo, sessionid, created_at'
            )
            .in('id', Array.from(clientIdsToFetch));

          if (Array.isArray(extraRows)) {
            for (const er of extraRows as ClientExtraRow[]) {
              extraMap.set(Number(er.id), er);
            }
          }
        }

        const parsedItems: ConversationContactFeedItem[] = nonGroupRows.map((row) => {
          const cid = row.client_id !== null ? Number(row.client_id) : null;
          const extra = cid ? extraMap.get(cid) : undefined;
          const msgInfo = extractMessageInfo(row.message);
          const rawDateStr = row.message_date || extra?.created_at || new Date().toISOString();
          const parsedDate = new Date(rawDateStr);
          const validDate = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
          const rawPhone =
            row.client_phone ||
            extra?.telefone ||
            row.session_id.split('@')[0] ||
            null;

          return {
            key: row.session_id || `client-${cid}`,
            sessionId: row.session_id,
            clientId: cid,
            nomeContato:
              row.client_name ||
              extra?.nome ||
              msgInfo.senderName ||
              `Contato (${row.session_id.split('@')[0]})`,
            telefone: rawPhone,
            email: row.client_email || extra?.email || null,
            nomePet: row.pet_name || extra?.nome_pet || null,
            racaPet: row.pet_breed || extra?.raca_pet || null,
            portePet: row.pet_size || extra?.porte_pet || null,
            servicoInteresse: row.service || extra?.servico || null,
            cpfCnpj: row.cpf_cnpj || extra?.cpf_cnpj || null,
            asaasCustomerId: row.asaas_customer_id || extra?.asaas_customer_id || null,
            clienteAtivo: extra ? extra.ativo !== false : true,
            ultimaMensagem: msgInfo.lastMessage || null,
            ultimoContatoEm: validDate.toISOString(),
            ultimoContatoRotulo: formatMessageTime(validDate),
            latestMessageId: Number(row.latest_id) || validDate.getTime(),
          };
        });

        // Se na página 0 houver poucos registros em n8n_chat_histories, complementa com dados_cliente recentes
        if (page === 0 && parsedItems.length < PIPELINE_CONTACTS_PAGE_SIZE) {
          let clientQuery = supabase
            .from('dados_cliente')
            .select(
              'id, nome, telefone, email, nome_pet, raca_pet, porte_pet, servico, cpf_cnpj, asaas_customer_id, ativo, sessionid, created_at',
              { count: 'exact' }
            )
            .order('created_at', { ascending: false, nullsFirst: false })
            .order('id', { ascending: false })
            .limit(PIPELINE_CONTACTS_PAGE_SIZE);

          if (debouncedSearch) {
            const sanitized = debouncedSearch.replace(/[,()]/g, '');
            if (sanitized) {
              clientQuery = clientQuery.or(
                `nome.ilike.%${sanitized}%,email.ilike.%${sanitized}%,telefone.ilike.%${sanitized}%,nome_pet.ilike.%${sanitized}%,cpf_cnpj.ilike.%${sanitized}%`
              );
            }
          }

          const { data: fallbackClients } = await clientQuery;
          if (Array.isArray(fallbackClients)) {
            const seenClientIds = new Set(
              parsedItems.map((i) => i.clientId).filter((id): id is number => id !== null)
            );
            const seenSessions = new Set(
              parsedItems.map((i) => i.sessionId).filter((s): s is string => Boolean(s))
            );

            for (const fc of fallbackClients as ClientExtraRow[]) {
              extraMap.set(Number(fc.id), fc);
              if (seenClientIds.has(Number(fc.id))) continue;
              if (fc.sessionid && seenSessions.has(fc.sessionid)) continue;

              const cDate = fc.created_at ? new Date(fc.created_at) : new Date();
              const validCDate = Number.isNaN(cDate.getTime()) ? new Date() : cDate;
              parsedItems.push({
                key: fc.sessionid || `client-${fc.id}`,
                sessionId: fc.sessionid || toWhatsappNumber(fc.telefone) || null,
                clientId: Number(fc.id),
                nomeContato: fc.nome || `Cliente #${fc.id}`,
                telefone: fc.telefone || fc.sessionid || null,
                email: fc.email || null,
                nomePet: fc.nome_pet || null,
                racaPet: fc.raca_pet || null,
                portePet: fc.porte_pet || null,
                servicoInteresse: fc.servico || null,
                cpfCnpj: fc.cpf_cnpj || null,
                asaasCustomerId: fc.asaas_customer_id || null,
                clienteAtivo: fc.ativo !== false,
                ultimaMensagem: null,
                ultimoContatoEm: validCDate.toISOString(),
                ultimoContatoRotulo: formatMessageTime(validCDate),
                latestMessageId: Number(fc.id),
              });
            }
          }
        }

        if (reqId !== feedReqIdRef.current) return;

        const rpcTotal = rows.length > 0 ? Number(rows[0].total_count) : parsedItems.length;
        setTotalContactsFeedCount(Math.max(rpcTotal, parsedItems.length));
        setHasMoreContactsFeed(rows.length >= PIPELINE_CONTACTS_PAGE_SIZE && offset + rows.length < rpcTotal);

        setClientExtrasById((prev) => {
          const next = new Map(prev);
          for (const [k, v] of extraMap.entries()) {
            next.set(k, v);
          }
          return next;
        });

        if (append) {
          setConversationFeed((prev) => {
            const byKey = new Map(prev.map((item) => [item.key, item]));
            for (const item of parsedItems) {
              byKey.set(item.key, item);
            }
            return Array.from(byKey.values()).sort(
              (a, b) => b.latestMessageId - a.latestMessageId
            );
          });
        } else {
          setConversationFeed(
            parsedItems.sort((a, b) => b.latestMessageId - a.latestMessageId)
          );
        }
      } catch (err) {
        console.error('Erro ao buscar conversas/clientes para o pipeline:', err);
      } finally {
        if (reqId === feedReqIdRef.current) {
          setLoadingContactsFeed(false);
          setLoadingMoreContactsFeed(false);
        }
      }
    },
    [debouncedSearch]
  );

  useEffect(() => {
    setFeedPage(0);
    fetchContactsFeedPage(0, false);
  }, [fetchContactsFeedPage]);

  // Enriquece cards persistidos com dados_cliente (CPF, Asaas, ativo...) sem refazer o feed
  useEffect(() => {
    const missing = Array.from(
      new Set(
        cards
          .map((c) => c.clientId)
          .filter((id): id is number => id !== null && !clientExtrasById.has(id))
      )
    );
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('dados_cliente')
        .select(
          'id, nome, telefone, email, nome_pet, raca_pet, porte_pet, servico, cpf_cnpj, asaas_customer_id, ativo, sessionid, created_at'
        )
        .in('id', missing.slice(0, 200));
      if (cancelled || !Array.isArray(data)) return;
      setClientExtrasById((prev) => {
        const next = new Map(prev);
        for (const r of data as ClientExtraRow[]) next.set(Number(r.id), r);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [cards, clientExtrasById]);

  const loadMoreContactsFeed = useCallback(() => {
    if (loadingContactsFeed || loadingMoreContactsFeed || !hasMoreContactsFeed) return;
    const nextPage = feedPage + 1;
    setFeedPage(nextPage);
    fetchContactsFeedPage(nextPage, true);
  }, [
    loadingContactsFeed,
    loadingMoreContactsFeed,
    hasMoreContactsFeed,
    feedPage,
    fetchContactsFeedPage,
  ]);

  // Seleciona automaticamente o pipeline padrão (ou o primeiro) quando carregar
  useEffect(() => {
    if (pipelines.length === 0) return;
    if (!selectedPipelineId || !pipelines.some((p) => p.id === selectedPipelineId)) {
      const padrao = pipelines.find((p) => p.padrao) || pipelines[0];
      setSelectedPipelineId(padrao.id);
    }
  }, [pipelines, selectedPipelineId]);

  // Realtime sync com o Supabase (cards, estágios, pipelines e novas conversas)
  useEffect(() => {
    if (modoLocal) return;
    const channel = supabase
      .channel(`crm-pipelines-rt-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_pipeline_cards' },
        () => {
          queryClient.invalidateQueries({ queryKey: PIPELINES_QUERY_KEY });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_pipeline_stages' },
        () => {
          queryClient.invalidateQueries({ queryKey: PIPELINES_QUERY_KEY });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_pipelines' },
        () => {
          queryClient.invalidateQueries({ queryKey: PIPELINES_QUERY_KEY });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'n8n_chat_histories' },
        () => {
          fetchContactsFeedPage(0, false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [modoLocal, queryClient, fetchContactsFeedPage]);

  const activePipeline = useMemo(
    () => pipelines.find((p) => p.id === selectedPipelineId) || pipelines[0] || null,
    [pipelines, selectedPipelineId]
  );

  const activeStages = useMemo(
    () =>
      activePipeline
        ? stages
            .filter((s) => s.pipelineId === activePipeline.id)
            .sort((a, b) => a.ordem - b.ordem)
        : [],
    [stages, activePipeline]
  );

  // Mescla os cards persistidos no pipeline ativo com a lista de conversas na 1ª coluna (por ordem de contato)
  const activeCards = useMemo(() => {
    if (!activePipeline) return [];
    const firstStage = activeStages[0];
    const persisted = cards.filter((c) => c.pipelineId === activePipeline.id);

    // Índices rápidos do feed de conversas para enriquecer cards persistidos
    const feedByClientId = new Map<number, ConversationContactFeedItem>();
    const feedBySession = new Map<string, ConversationContactFeedItem>();
    const feedByPhone = new Map<string, ConversationContactFeedItem>();

    for (const item of conversationFeed) {
      if (item.clientId) feedByClientId.set(item.clientId, item);
      if (item.sessionId) feedBySession.set(item.sessionId, item);
      const normPhone = toWhatsappNumber(item.telefone);
      if (normPhone) feedByPhone.set(normPhone, item);
    }

    const enrichedPersisted: CrmPipelineCard[] = persisted.map((card) => {
      const normPhone = toWhatsappNumber(card.telefone);
      const matchedFeed =
        (card.clientId ? feedByClientId.get(card.clientId) : undefined) ||
        (card.sessionId ? feedBySession.get(card.sessionId) : undefined) ||
        (normPhone ? feedByPhone.get(normPhone) : undefined);
      const extraClient = card.clientId ? clientExtrasById.get(card.clientId) : undefined;

      return {
        ...card,
        email: card.email || matchedFeed?.email || extraClient?.email || null,
        nomePet: card.nomePet || matchedFeed?.nomePet || extraClient?.nome_pet || null,
        racaPet: card.racaPet || matchedFeed?.racaPet || extraClient?.raca_pet || null,
        portePet: card.portePet || matchedFeed?.portePet || extraClient?.porte_pet || null,
        servicoInteresse:
          card.servicoInteresse ||
          matchedFeed?.servicoInteresse ||
          extraClient?.servico ||
          null,
        cpfCnpj: card.cpfCnpj || matchedFeed?.cpfCnpj || extraClient?.cpf_cnpj || null,
        asaasCustomerId:
          card.asaasCustomerId ||
          matchedFeed?.asaasCustomerId ||
          extraClient?.asaas_customer_id ||
          null,
        clienteAtivo:
          extraClient !== undefined
            ? extraClient.ativo !== false
            : matchedFeed?.clienteAtivo ?? card.clienteAtivo ?? true,
        ultimaMensagem: matchedFeed?.ultimaMensagem || card.ultimaMensagem || null,
        ultimoContatoEm:
          matchedFeed?.ultimoContatoEm ||
          card.ultimoContatoEm ||
          card.movidoEm ||
          card.updatedAt,
        ultimoContatoRotulo:
          matchedFeed?.ultimoContatoRotulo ||
          card.ultimoContatoRotulo ||
          formatMessageTime(card.movidoEm || card.updatedAt),
        latestMessageId:
          matchedFeed?.latestMessageId ||
          card.latestMessageId ||
          Date.parse(card.movidoEm || card.updatedAt) ||
          0,
      };
    });

    if (!firstStage) return enrichedPersisted;

    // Descobre quais contatos já estão presentes em qualquer coluna deste pipeline
    const existingClientIds = new Set<number>();
    const existingSessions = new Set<string>();
    const existingPhones = new Set<string>();

    for (const c of enrichedPersisted) {
      if (c.clientId) existingClientIds.add(c.clientId);
      if (c.sessionId) existingSessions.add(c.sessionId);
      const normPhone = toWhatsappNumber(c.telefone);
      if (normPhone) existingPhones.add(normPhone);
    }

    const defaultChecklistFirstStage = criarChecklistDeTextos(
      firstStage.checklistPadrao || []
    );

    const virtualFirstColumnCards: CrmPipelineCard[] = [];
    conversationFeed.forEach((item, idx) => {
      if (item.clientId && existingClientIds.has(item.clientId)) return;
      if (item.sessionId && existingSessions.has(item.sessionId)) return;
      const normPhone = toWhatsappNumber(item.telefone);
      if (normPhone && existingPhones.has(normPhone)) return;

      if (item.clientId) existingClientIds.add(item.clientId);
      if (item.sessionId) existingSessions.add(item.sessionId);
      if (normPhone) existingPhones.add(normPhone);

      virtualFirstColumnCards.push({
        id: `conv-virtual::${activePipeline.id}::${item.key}`,
        pipelineId: activePipeline.id,
        stageId: firstStage.id,
        clientId: item.clientId,
        sessionId: item.sessionId,
        titulo: item.nomeContato,
        nomeContato: item.nomeContato,
        telefone: item.telefone,
        email: item.email,
        nomePet: item.nomePet,
        especiePet: null,
        racaPet: item.racaPet,
        portePet: item.portePet,
        servicoInteresse: item.servicoInteresse,
        valorEstimado: 0,
        prioridade: 'media',
        origem: 'whatsapp',
        campanha: null,
        atendenteId: null,
        proximaAcao: null,
        proximaAcaoEm: null,
        observacoes: null,
        checklist: defaultChecklistFirstStage,
        tagsCustom: [],
        motivoPerda: null,
        ordem: idx,
        movidoEm: item.ultimoContatoEm,
        createdAt: item.ultimoContatoEm,
        updatedAt: item.ultimoContatoEm,
        cpfCnpj: item.cpfCnpj,
        asaasCustomerId: item.asaasCustomerId,
        clienteAtivo: item.clienteAtivo,
        ultimaMensagem: item.ultimaMensagem,
        ultimoContatoEm: item.ultimoContatoEm,
        ultimoContatoRotulo: item.ultimoContatoRotulo,
        latestMessageId: item.latestMessageId,
        virtualFromConversation: true,
      });
    });

    return [...enrichedPersisted, ...virtualFirstColumnCards];
  }, [activePipeline, activeStages, cards, conversationFeed, clientExtrasById]);

  const stagesByPipeline = useMemo(() => {
    const map = new Map<string, CrmPipelineStage[]>();
    for (const st of stages) {
      const list = map.get(st.pipelineId) || [];
      list.push(st);
      map.set(st.pipelineId, list);
    }
    for (const [k, list] of map.entries()) {
      map.set(
        k,
        list.slice().sort((a, b) => a.ordem - b.ordem)
      );
    }
    return map;
  }, [stages]);

  const cardsByClientId = useMemo(() => {
    const map = new Map<number, CrmPipelineCard[]>();
    for (const c of cards) {
      if (!c.clientId) continue;
      const list = map.get(c.clientId) || [];
      list.push(c);
      map.set(c.clientId, list);
    }
    return map;
  }, [cards]);

  const activitiesByCardId = useMemo(() => {
    const map = new Map<string, CrmPipelineActivity[]>();
    for (const act of activities) {
      const list = map.get(act.cardId) || [];
      list.push(act);
      map.set(act.cardId, list);
    }
    return map;
  }, [activities]);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: PIPELINES_QUERY_KEY });
  }, [queryClient]);

  const createPipeline = useMutation({
    mutationFn: async (input: CreatePipelineInput): Promise<CrmPipeline> => {
      const agora = new Date().toISOString();
      if (modoLocal) {
        const local = loadLocalStore();
        const newPipe: CrmPipeline = {
          id: `local-pipe-${Date.now()}`,
          nome: input.nome.trim(),
          descricao: input.descricao?.trim() || null,
          categoria: input.categoria,
          cor: input.cor,
          padrao: Boolean(input.padrao),
          ativo: true,
          ordem: local.pipelines.length,
          createdAt: agora,
          updatedAt: agora,
        };
        if (newPipe.padrao) {
          local.pipelines.forEach((p) => {
            p.padrao = false;
          });
        }
        local.pipelines.push(newPipe);
        input.estagios.forEach((st, idx) => {
          local.stages.push({
            id: `local-stage-${Date.now()}-${idx}`,
            pipelineId: newPipe.id,
            nome: st.nome.trim(),
            descricao: st.descricao?.trim() || null,
            cor: st.cor,
            tipo: st.tipo,
            slaHoras: st.slaHoras,
            checklistPadrao: st.checklistPadrao,
            ordem: idx,
            createdAt: agora,
            updatedAt: agora,
          });
        });
        saveLocalStore(local);
        return newPipe;
      }

      if (input.padrao) {
        await dbAny.from('crm_pipelines').update({ padrao: false }).eq('padrao', true);
      }

      const { data: pipeRow, error: pipeErr } = await dbAny
        .from('crm_pipelines')
        .insert({
          nome: input.nome.trim(),
          descricao: input.descricao?.trim() || null,
          categoria: input.categoria,
          cor: input.cor,
          padrao: Boolean(input.padrao),
          ordem: pipelines.length,
        })
        .select('*')
        .single();

      if (pipeErr) throw pipeErr;

      const createdPipe = mapPipelineRow(pipeRow);
      if (input.estagios.length > 0) {
        const stagesPayload = input.estagios.map((st, idx) => ({
          pipeline_id: createdPipe.id,
          nome: st.nome.trim(),
          descricao: st.descricao?.trim() || null,
          cor: st.cor,
          tipo: st.tipo,
          sla_horas: st.slaHoras,
          checklist_padrao: st.checklistPadrao,
          ordem: idx,
        }));
        const { error: stErr } = await dbAny.from('crm_pipeline_stages').insert(stagesPayload);
        if (stErr) throw stErr;
      }

      return createdPipe;
    },
    onSuccess: (created) => {
      invalidate();
      setSelectedPipelineId(created.id);
      toast.success(`Pipeline "${created.nome}" criado com sucesso!`);
    },
    onError: () => {
      toast.error('Erro ao criar pipeline');
    },
  });

  const updatePipeline = useMutation({
    mutationFn: async (input: UpdatePipelineInput) => {
      const agora = new Date().toISOString();
      if (modoLocal) {
        const local = loadLocalStore();
        if (input.padrao) {
          local.pipelines.forEach((p) => {
            p.padrao = p.id === input.id;
          });
        }
        const pipeIdx = local.pipelines.findIndex((p) => p.id === input.id);
        if (pipeIdx >= 0) {
          local.pipelines[pipeIdx] = {
            ...local.pipelines[pipeIdx],
            nome: input.nome.trim(),
            descricao: input.descricao?.trim() || null,
            categoria: input.categoria,
            cor: input.cor,
            padrao: Boolean(input.padrao),
            updatedAt: agora,
          };
        }

        const existingStages = local.stages.filter((s) => s.pipelineId === input.id);
        const keptIds = new Set(input.estagios.map((s) => s.id).filter(Boolean));
        const fallbackStageId = input.estagios[0]?.id;

        // Remove estágios excluídos
        local.stages = local.stages.filter(
          (s) => s.pipelineId !== input.id || keptIds.has(s.id)
        );

        input.estagios.forEach((st, idx) => {
          if (st.id && existingStages.some((e) => e.id === st.id)) {
            const sIdx = local.stages.findIndex((s) => s.id === st.id);
            if (sIdx >= 0) {
              local.stages[sIdx] = {
                ...local.stages[sIdx],
                nome: st.nome.trim(),
                descricao: st.descricao?.trim() || null,
                cor: st.cor,
                tipo: st.tipo,
                slaHoras: st.slaHoras,
                checklistPadrao: st.checklistPadrao,
                ordem: idx,
                updatedAt: agora,
              };
            }
          } else {
            const newId = `local-stage-${Date.now()}-${idx}`;
            local.stages.push({
              id: newId,
              pipelineId: input.id,
              nome: st.nome.trim(),
              descricao: st.descricao?.trim() || null,
              cor: st.cor,
              tipo: st.tipo,
              slaHoras: st.slaHoras,
              checklistPadrao: st.checklistPadrao,
              ordem: idx,
              createdAt: agora,
              updatedAt: agora,
            });
          }
        });

        // Garante que cards órfãos de um estágio removido caiam no primeiro estágio do pipeline
        const currentPipeStages = local.stages
          .filter((s) => s.pipelineId === input.id)
          .sort((a, b) => a.ordem - b.ordem);
        const firstStageId = fallbackStageId || currentPipeStages[0]?.id;
        const validStageIds = new Set(currentPipeStages.map((s) => s.id));
        if (firstStageId) {
          local.cards.forEach((c) => {
            if (c.pipelineId === input.id && !validStageIds.has(c.stageId)) {
              c.stageId = firstStageId;
            }
          });
        }

        saveLocalStore(local);
        return;
      }

      if (input.padrao) {
        await dbAny
          .from('crm_pipelines')
          .update({ padrao: false })
          .neq('id', input.id);
      }

      const { error: pipeErr } = await dbAny
        .from('crm_pipelines')
        .update({
          nome: input.nome.trim(),
          descricao: input.descricao?.trim() || null,
          categoria: input.categoria,
          cor: input.cor,
          padrao: Boolean(input.padrao),
          updated_at: agora,
        })
        .eq('id', input.id);

      if (pipeErr) throw pipeErr;

      const currentStages = stages.filter((s) => s.pipelineId === input.id);
      const inputIds = new Set(input.estagios.map((s) => s.id).filter(Boolean));
      const removedStages = currentStages.filter((s) => !inputIds.has(s.id));

      // Atualiza ou insere estágios
      let firstValidStageId: string | null = null;
      for (let idx = 0; idx < input.estagios.length; idx++) {
        const st = input.estagios[idx];
        if (st.id && currentStages.some((c) => c.id === st.id)) {
          await dbAny
            .from('crm_pipeline_stages')
            .update({
              nome: st.nome.trim(),
              descricao: st.descricao?.trim() || null,
              cor: st.cor,
              tipo: st.tipo,
              sla_horas: st.slaHoras,
              checklist_padrao: st.checklistPadrao,
              ordem: idx,
              updated_at: agora,
            })
            .eq('id', st.id);
          if (!firstValidStageId) firstValidStageId = st.id;
        } else {
          const { data: inserted } = await dbAny
            .from('crm_pipeline_stages')
            .insert({
              pipeline_id: input.id,
              nome: st.nome.trim(),
              descricao: st.descricao?.trim() || null,
              cor: st.cor,
              tipo: st.tipo,
              sla_horas: st.slaHoras,
              checklist_padrao: st.checklistPadrao,
              ordem: idx,
            })
            .select('id')
            .single();
          if (!firstValidStageId && inserted?.id) {
            firstValidStageId = String(inserted.id);
          }
        }
      }

      // Se algum estágio foi removido, realoca seus cards para o 1º estágio antes de remover
      if (removedStages.length > 0 && firstValidStageId) {
        const removedIds = removedStages.map((s) => s.id);
        await dbAny
          .from('crm_pipeline_cards')
          .update({ stage_id: firstValidStageId, updated_at: agora })
          .in('stage_id', removedIds);
        await dbAny.from('crm_pipeline_stages').delete().in('id', removedIds);
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success('Pipeline e estágios atualizados!');
    },
    onError: () => {
      toast.error('Erro ao salvar configurações do pipeline');
    },
  });

  const deletePipeline = useMutation({
    mutationFn: async (pipelineId: string) => {
      if (pipelines.length <= 1) {
        throw new Error('Mantenha ao menos um pipeline ativo no sistema.');
      }
      if (modoLocal) {
        const local = loadLocalStore();
        local.pipelines = local.pipelines.filter((p) => p.id !== pipelineId);
        local.stages = local.stages.filter((s) => s.pipelineId !== pipelineId);
        local.cards = local.cards.filter((c) => c.pipelineId !== pipelineId);
        saveLocalStore(local);
        return;
      }
      const { error } = await dbAny.from('crm_pipelines').delete().eq('id', pipelineId);
      if (error) throw error;
    },
    onSuccess: (_, deletedId) => {
      if (selectedPipelineId === deletedId) {
        const next = pipelines.find((p) => p.id !== deletedId);
        setSelectedPipelineId(next?.id || null);
      }
      invalidate();
      toast.success('Pipeline removido');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Erro ao remover pipeline');
    },
  });

  const createCard = useMutation({
    mutationFn: async (input: CreateCardInput): Promise<CrmPipelineCard> => {
      const agora = new Date().toISOString();
      let resolvedClientId = input.clientId ?? null;

      // Se o usuário marcou "Salvar também na base de Clientes" e ainda não tem clientId
      if (!resolvedClientId && input.criarClienteNaBase && input.nomeContato.trim()) {
        try {
          const { data: clientData } = await supabase
            .from('dados_cliente')
            .insert({
              nome: input.nomeContato.trim(),
              telefone: input.telefone?.trim() || null,
              email: input.email?.trim() || null,
              nome_pet: input.nomePet?.trim() || null,
              raca_pet: input.racaPet?.trim() || null,
              porte_pet: input.portePet?.trim() || null,
              servico: input.servicoInteresse?.trim() || null,
              sessionid: input.sessionId?.trim() || input.telefone?.replace(/\D/g, '') || null,
            })
            .select('id')
            .single();
          if (clientData?.id) {
            resolvedClientId = clientData.id;
          }
        } catch {
          // Segue criando o card mesmo se o insert em dados_cliente falhar
        }
      }

      const stage = stages.find((s) => s.id === input.stageId);
      const checklistInicial =
        input.checklist && input.checklist.length > 0
          ? input.checklist
          : criarChecklistDeTextos(stage?.checklistPadrao || []);

      const cardsInStage = cards.filter((c) => c.stageId === input.stageId);
      const nextOrdem = cardsInStage.length;

      if (modoLocal) {
        const local = loadLocalStore();
        const newCard: CrmPipelineCard = {
          id: `local-card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          pipelineId: input.pipelineId,
          stageId: input.stageId,
          clientId: resolvedClientId,
          sessionId: input.sessionId?.trim() || null,
          titulo: (input.titulo || input.nomeContato).trim(),
          nomeContato: input.nomeContato.trim(),
          telefone: input.telefone?.trim() || null,
          email: input.email?.trim() || null,
          nomePet: input.nomePet?.trim() || null,
          especiePet: input.especiePet?.trim() || null,
          racaPet: input.racaPet?.trim() || null,
          portePet: input.portePet?.trim() || null,
          servicoInteresse: input.servicoInteresse?.trim() || null,
          valorEstimado: Number(input.valorEstimado) || 0,
          prioridade: input.prioridade || 'media',
          origem: input.origem || 'whatsapp',
          campanha: input.campanha?.trim() || null,
          atendenteId: input.atendenteId ?? null,
          proximaAcao: input.proximaAcao?.trim() || null,
          proximaAcaoEm: input.proximaAcaoEm || null,
          observacoes: input.observacoes?.trim() || null,
          checklist: checklistInicial,
          tagsCustom: input.tagsCustom || [],
          motivoPerda: null,
          ordem: nextOrdem,
          movidoEm: agora,
          createdAt: agora,
          updatedAt: agora,
        };
        local.cards.push(newCard);
        local.activities.unshift({
          id: `local-act-${Date.now()}`,
          cardId: newCard.id,
          tipo: 'criacao',
          descricao: `Adicionado na etapa "${stage?.nome || 'Inicial'}"`,
          deStageId: null,
          paraStageId: input.stageId,
          autorNome: input.autorNome || 'Equipe',
          createdAt: agora,
        });
        saveLocalStore(local);
        return newCard;
      }

      const { data: cardRow, error } = await dbAny
        .from('crm_pipeline_cards')
        .insert({
          pipeline_id: input.pipelineId,
          stage_id: input.stageId,
          client_id: resolvedClientId,
          session_id: input.sessionId?.trim() || null,
          titulo: (input.titulo || input.nomeContato).trim(),
          nome_contato: input.nomeContato.trim(),
          telefone: input.telefone?.trim() || null,
          email: input.email?.trim() || null,
          nome_pet: input.nomePet?.trim() || null,
          especie_pet: input.especiePet?.trim() || null,
          raca_pet: input.racaPet?.trim() || null,
          porte_pet: input.portePet?.trim() || null,
          servico_interesse: input.servicoInteresse?.trim() || null,
          valor_estimado: Number(input.valorEstimado) || 0,
          prioridade: input.prioridade || 'media',
          origem: input.origem || 'whatsapp',
          campanha: input.campanha?.trim() || null,
          atendente_id: input.atendenteId ?? null,
          proxima_acao: input.proximaAcao?.trim() || null,
          proxima_acao_em: input.proximaAcaoEm || null,
          observacoes: input.observacoes?.trim() || null,
          checklist: checklistInicial,
          tags_custom: input.tagsCustom || [],
          ordem: nextOrdem,
          movido_em: agora,
        })
        .select('*')
        .single();

      if (error) throw error;
      const created = mapCardRow(cardRow);

      await dbAny.from('crm_pipeline_activities').insert({
        card_id: created.id,
        tipo: 'criacao',
        descricao: `Adicionado na etapa "${stage?.nome || 'Inicial'}"`,
        para_stage_id: input.stageId,
        autor_nome: input.autorNome || 'Equipe',
      });

      return created;
    },
    onSuccess: (created) => {
      invalidate();
      toast.success(`${created.nomeContato} adicionado ao pipeline!`);
    },
    onError: () => {
      toast.error('Erro ao adicionar contato ao pipeline');
    },
  });

  const importCardsBatch = useMutation({
    mutationFn: async (input: {
      pipelineId: string;
      stageId: string;
      origem: CardOrigem;
      campanha?: string | null;
      servicoInteresse?: string | null;
      valorEstimado?: number;
      prioridade?: CardPrioridade;
      atendenteId?: number | null;
      contatos: Array<{
        clientId?: number | null;
        sessionId?: string | null;
        nomeContato: string;
        telefone?: string | null;
        email?: string | null;
        nomePet?: string | null;
        racaPet?: string | null;
        portePet?: string | null;
      }>;
    }) => {
      const stage = stages.find((s) => s.id === input.stageId);
      const checklistPadrao = criarChecklistDeTextos(stage?.checklistPadrao || []);
      const agora = new Date().toISOString();

      if (modoLocal) {
        const local = loadLocalStore();
        input.contatos.forEach((ct, idx) => {
          local.cards.push({
            id: `local-card-batch-${Date.now()}-${idx}`,
            pipelineId: input.pipelineId,
            stageId: input.stageId,
            clientId: ct.clientId ?? null,
            sessionId: ct.sessionId ?? null,
            titulo: ct.nomeContato,
            nomeContato: ct.nomeContato,
            telefone: ct.telefone ?? null,
            email: ct.email ?? null,
            nomePet: ct.nomePet ?? null,
            especiePet: null,
            racaPet: ct.racaPet ?? null,
            portePet: ct.portePet ?? null,
            servicoInteresse: input.servicoInteresse || null,
            valorEstimado: Number(input.valorEstimado) || 0,
            prioridade: input.prioridade || 'media',
            origem: input.origem,
            campanha: input.campanha || null,
            atendenteId: input.atendenteId ?? null,
            proximaAcao: null,
            proximaAcaoEm: null,
            observacoes: null,
            checklist: checklistPadrao,
            tagsCustom: [],
            motivoPerda: null,
            ordem: idx,
            movidoEm: agora,
            createdAt: agora,
            updatedAt: agora,
          });
        });
        saveLocalStore(local);
        return input.contatos.length;
      }

      const payload = input.contatos.map((ct, idx) => ({
        pipeline_id: input.pipelineId,
        stage_id: input.stageId,
        client_id: ct.clientId ?? null,
        session_id: ct.sessionId ?? null,
        titulo: ct.nomeContato,
        nome_contato: ct.nomeContato,
        telefone: ct.telefone ?? null,
        email: ct.email ?? null,
        nome_pet: ct.nomePet ?? null,
        raca_pet: ct.racaPet ?? null,
        porte_pet: ct.portePet ?? null,
        servico_interesse: input.servicoInteresse || null,
        valor_estimado: Number(input.valorEstimado) || 0,
        prioridade: input.prioridade || 'media',
        origem: input.origem,
        campanha: input.campanha || null,
        atendente_id: input.atendenteId ?? null,
        checklist: checklistPadrao,
        ordem: idx,
        movido_em: agora,
      }));

      const { error } = await dbAny.from('crm_pipeline_cards').insert(payload);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (count) => {
      invalidate();
      toast.success(`${count} ${count === 1 ? 'contato importado' : 'contatos importados'} para o pipeline!`);
    },
    onError: () => {
      toast.error('Erro ao importar contatos em lote');
    },
  });

  const moveCard = useMutation({
    mutationFn: async (input: {
      cardId: string;
      toStageId: string;
      toPipelineId?: string;
      novoIndice?: number;
      motivoPerda?: string | null;
      autorNome?: string | null;
    }) => {
      const virtual = input.cardId.startsWith('conv-virtual::')
        ? activeCards.find((c) => c.id === input.cardId)
        : undefined;
      if (virtual) {
        const agoraV = new Date().toISOString();
        const stageV = stages.find((s) => s.id === input.toStageId);
        const checklistV = criarChecklistDeTextos(stageV?.checklistPadrao || []);
        const nextOrdemV = cards.filter((c) => c.stageId === input.toStageId).length;
        if (modoLocal) {
          const local = loadLocalStore();
          local.cards.push({
            ...virtual,
            id: `local-card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            stageId: input.toStageId,
            checklist: checklistV,
            ordem: nextOrdemV,
            virtualFromConversation: undefined,
            movidoEm: agoraV,
            updatedAt: agoraV,
          });
          saveLocalStore(local);
          return { stageMudou: true, paraStageNome: stageV?.nome };
        }
        const { data: rowV, error: errV } = await dbAny
          .from('crm_pipeline_cards')
          .insert({
            pipeline_id: virtual.pipelineId,
            stage_id: input.toStageId,
            client_id: virtual.clientId,
            session_id: virtual.sessionId,
            titulo: virtual.nomeContato,
            nome_contato: virtual.nomeContato,
            telefone: virtual.telefone,
            email: virtual.email,
            nome_pet: virtual.nomePet,
            raca_pet: virtual.racaPet,
            porte_pet: virtual.portePet,
            servico_interesse: virtual.servicoInteresse,
            prioridade: 'media',
            origem: 'whatsapp',
            checklist: checklistV,
            ordem: nextOrdemV,
            movido_em: agoraV,
          })
          .select('id')
          .single();
        if (errV) throw errV;
        await dbAny.from('crm_pipeline_activities').insert({
          card_id: rowV.id,
          tipo: 'movimentacao',
          descricao: `Movido de "Conversas" para "${stageV?.nome || 'Nova etapa'}"`,
          para_stage_id: input.toStageId,
          autor_nome: input.autorNome || 'Equipe',
        });
        return { stageMudou: true, paraStageNome: stageV?.nome };
      }

      const card = cards.find((c) => c.id === input.cardId);
      if (!card) return;

      const targetPipelineId = input.toPipelineId || card.pipelineId;
      const stageMudou = card.stageId !== input.toStageId || card.pipelineId !== targetPipelineId;
      const deStage = stages.find((s) => s.id === card.stageId);
      const paraStage = stages.find((s) => s.id === input.toStageId);
      const agora = new Date().toISOString();

      // Calcula nova ordem dos cards na coluna de destino
      const destinoCards = cards
        .filter((c) => c.stageId === input.toStageId && c.id !== card.id)
        .sort((a, b) => a.ordem - b.ordem);
      const insertAt =
        input.novoIndice !== undefined
          ? Math.max(0, Math.min(input.novoIndice, destinoCards.length))
          : destinoCards.length;

      // Quando entra num estágio novo e o checklist do card está vazio, carrega o checklist padrão da nova etapa
      const checklistAtualizado =
        stageMudou &&
        card.checklist.length === 0 &&
        paraStage?.checklistPadrao &&
        paraStage.checklistPadrao.length > 0
          ? criarChecklistDeTextos(paraStage.checklistPadrao)
          : card.checklist;

      // Atualização otimista no cache do React Query
      queryClient.setQueryData<QueryBundle>(PIPELINES_QUERY_KEY, (old) => {
        if (!old) return old;
        const nextCards = old.cards.map((c) => {
          if (c.id === card.id) {
            return {
              ...c,
              pipelineId: targetPipelineId,
              stageId: input.toStageId,
              ordem: insertAt,
              checklist: checklistAtualizado,
              motivoPerda:
                input.motivoPerda !== undefined ? input.motivoPerda : c.motivoPerda,
              movidoEm: stageMudou ? agora : c.movidoEm,
              updatedAt: agora,
            };
          }
          return c;
        });
        return { ...old, cards: nextCards };
      });

      if (modoLocal) {
        const local = loadLocalStore();
        const targetList = local.cards
          .filter((c) => c.stageId === input.toStageId && c.id !== card.id)
          .sort((a, b) => a.ordem - b.ordem);

        const cIdx = local.cards.findIndex((c) => c.id === card.id);
        if (cIdx >= 0) {
          const updated: CrmPipelineCard = {
            ...local.cards[cIdx],
            pipelineId: targetPipelineId,
            stageId: input.toStageId,
            ordem: insertAt,
            checklist: checklistAtualizado,
            motivoPerda:
              input.motivoPerda !== undefined ? input.motivoPerda : local.cards[cIdx].motivoPerda,
            movidoEm: stageMudou ? agora : local.cards[cIdx].movidoEm,
            updatedAt: agora,
          };
          targetList.splice(insertAt, 0, updated);
          targetList.forEach((item, idx) => {
            item.ordem = idx;
          });
          local.cards[cIdx] = updated;
        }

        if (stageMudou) {
          local.activities.unshift({
            id: `local-act-${Date.now()}`,
            cardId: card.id,
            tipo: 'movimentacao',
            descricao: `Movido de "${deStage?.nome || 'Etapa anterior'}" para "${paraStage?.nome || 'Nova etapa'}"${
              input.motivoPerda ? ` · Motivo: ${input.motivoPerda}` : ''
            }`,
            deStageId: card.stageId,
            paraStageId: input.toStageId,
            autorNome: input.autorNome || 'Equipe',
            createdAt: agora,
          });
        }
        saveLocalStore(local);
        return { stageMudou, paraStageNome: paraStage?.nome };
      }

      const updatePayload: Record<string, unknown> = {
        pipeline_id: targetPipelineId,
        stage_id: input.toStageId,
        ordem: insertAt,
        checklist: checklistAtualizado,
        updated_at: agora,
      };
      if (stageMudou) {
        updatePayload.movido_em = agora;
      }
      if (input.motivoPerda !== undefined) {
        updatePayload.motivo_perda = input.motivoPerda;
      }

      const { error } = await dbAny
        .from('crm_pipeline_cards')
        .update(updatePayload)
        .eq('id', card.id);
      if (error) throw error;

      if (stageMudou) {
        await dbAny.from('crm_pipeline_activities').insert({
          card_id: card.id,
          tipo: 'movimentacao',
          descricao: `Movido de "${deStage?.nome || 'Etapa anterior'}" para "${paraStage?.nome || 'Nova etapa'}"${
            input.motivoPerda ? ` · Motivo: ${input.motivoPerda}` : ''
          }`,
          de_stage_id: card.stageId,
          para_stage_id: input.toStageId,
          autor_nome: input.autorNome || 'Equipe',
        });
      }

      return { stageMudou, paraStageNome: paraStage?.nome };
    },
    onSuccess: (res) => {
      invalidate();
      if (res?.stageMudou && res.paraStageNome) {
        toast.success(`Movido para ${res.paraStageNome}`);
      }
    },
    onError: () => {
      invalidate();
      toast.error('Não foi possível mover o contato');
    },
  });

  const updateCard = useMutation({
    mutationFn: async (input: {
      id: string;
      changes: Partial<
        Pick<
          CrmPipelineCard,
          | 'titulo'
          | 'nomeContato'
          | 'telefone'
          | 'email'
          | 'nomePet'
          | 'especiePet'
          | 'racaPet'
          | 'portePet'
          | 'servicoInteresse'
          | 'valorEstimado'
          | 'prioridade'
          | 'origem'
          | 'campanha'
          | 'atendenteId'
          | 'proximaAcao'
          | 'proximaAcaoEm'
          | 'observacoes'
          | 'checklist'
          | 'tagsCustom'
          | 'motivoPerda'
          | 'clientId'
          | 'sessionId'
        >
      >;
      sincronizarCliente?: boolean;
    }) => {
      const agora = new Date().toISOString();
      const current = cards.find((c) => c.id === input.id);
      if (!current) return;

      const targetClientId =
        input.changes.clientId !== undefined ? input.changes.clientId : current.clientId;

      if (input.sincronizarCliente && targetClientId) {
        try {
          await supabase
            .from('dados_cliente')
            .update({
              nome: input.changes.nomeContato ?? current.nomeContato,
              telefone: input.changes.telefone ?? current.telefone,
              email: input.changes.email ?? current.email,
              nome_pet: input.changes.nomePet ?? current.nomePet,
              raca_pet: input.changes.racaPet ?? current.racaPet,
              porte_pet: input.changes.portePet ?? current.portePet,
            })
            .eq('id', targetClientId);
        } catch {
          // Best-effort sync
        }
      }

      if (modoLocal) {
        const local = loadLocalStore();
        const idx = local.cards.findIndex((c) => c.id === input.id);
        if (idx >= 0) {
          local.cards[idx] = {
            ...local.cards[idx],
            ...input.changes,
            updatedAt: agora,
          };
          saveLocalStore(local);
        }
        return;
      }

      const dbPayload: Record<string, unknown> = { updated_at: agora };
      const c = input.changes;
      if (c.titulo !== undefined) dbPayload.titulo = c.titulo;
      if (c.nomeContato !== undefined) dbPayload.nome_contato = c.nomeContato;
      if (c.telefone !== undefined) dbPayload.telefone = c.telefone;
      if (c.email !== undefined) dbPayload.email = c.email;
      if (c.nomePet !== undefined) dbPayload.nome_pet = c.nomePet;
      if (c.especiePet !== undefined) dbPayload.especie_pet = c.especiePet;
      if (c.racaPet !== undefined) dbPayload.raca_pet = c.racaPet;
      if (c.portePet !== undefined) dbPayload.porte_pet = c.portePet;
      if (c.servicoInteresse !== undefined) dbPayload.servico_interesse = c.servicoInteresse;
      if (c.valorEstimado !== undefined) dbPayload.valor_estimado = Number(c.valorEstimado) || 0;
      if (c.prioridade !== undefined) dbPayload.prioridade = c.prioridade;
      if (c.origem !== undefined) dbPayload.origem = c.origem;
      if (c.campanha !== undefined) dbPayload.campanha = c.campanha;
      if (c.atendenteId !== undefined) dbPayload.atendente_id = c.atendenteId;
      if (c.proximaAcao !== undefined) dbPayload.proxima_acao = c.proximaAcao;
      if (c.proximaAcaoEm !== undefined) dbPayload.proxima_acao_em = c.proximaAcaoEm;
      if (c.observacoes !== undefined) dbPayload.observacoes = c.observacoes;
      if (c.checklist !== undefined) dbPayload.checklist = c.checklist;
      if (c.tagsCustom !== undefined) dbPayload.tags_custom = c.tagsCustom;
      if (c.motivoPerda !== undefined) dbPayload.motivo_perda = c.motivoPerda;
      if (c.clientId !== undefined) dbPayload.client_id = c.clientId;
      if (c.sessionId !== undefined) dbPayload.session_id = c.sessionId;

      const { error } = await dbAny
        .from('crm_pipeline_cards')
        .update(dbPayload)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
    },
    onError: () => {
      toast.error('Erro ao atualizar dados do contato');
    },
  });

  const deleteCard = useMutation({
    mutationFn: async (cardId: string) => {
      if (modoLocal) {
        const local = loadLocalStore();
        local.cards = local.cards.filter((c) => c.id !== cardId);
        local.activities = local.activities.filter((a) => a.cardId !== cardId);
        saveLocalStore(local);
        return;
      }
      const { error } = await dbAny.from('crm_pipeline_cards').delete().eq('id', cardId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Contato removido do pipeline');
    },
    onError: () => {
      toast.error('Erro ao remover contato do pipeline');
    },
  });

  const addActivity = useMutation({
    mutationFn: async (input: {
      cardId: string;
      tipo?: ActivityTipo;
      descricao: string;
      autorNome?: string | null;
    }) => {
      const agora = new Date().toISOString();
      if (modoLocal) {
        const local = loadLocalStore();
        local.activities.unshift({
          id: `local-act-${Date.now()}`,
          cardId: input.cardId,
          tipo: input.tipo || 'nota',
          descricao: input.descricao.trim(),
          deStageId: null,
          paraStageId: null,
          autorNome: input.autorNome || 'Equipe',
          createdAt: agora,
        });
        saveLocalStore(local);
        return;
      }
      const { error } = await dbAny.from('crm_pipeline_activities').insert({
        card_id: input.cardId,
        tipo: input.tipo || 'nota',
        descricao: input.descricao.trim(),
        autor_nome: input.autorNome || 'Equipe',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success('Registro adicionado ao histórico');
    },
    onError: () => {
      toast.error('Erro ao registrar atividade');
    },
  });

  return {
    pipelines,
    stages,
    cards,
    activities,
    activePipeline,
    activeStages,
    activeCards,
    selectedPipelineId: activePipeline?.id || selectedPipelineId,
    setSelectedPipelineId,
    stagesByPipeline,
    cardsByClientId,
    activitiesByCardId,
    loading: bundleQuery.isPending,
    modoLocal,
    refresh: () => {
      invalidate();
      fetchContactsFeedPage(0, false);
    },
    loadMoreContactsFeed,
    hasMoreContactsFeed,
    loadingContactsFeed,
    loadingMoreContactsFeed,
    totalContactsFeedCount,
    createPipeline,
    updatePipeline,
    deletePipeline,
    createCard,
    importCardsBatch,
    moveCard,
    updateCard,
    deleteCard,
    addActivity,
  };
}
