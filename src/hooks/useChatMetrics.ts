import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MetricsPeriod, getPeriodStart, bucketKey, bucketLabels } from '@/lib/metricsPeriod';

export interface HourlyVolume {
  hour: string;
  messages: number;
}

export interface WeekdayVolume {
  day: string;
  conversations: number;
}

export interface IdleClient {
  sessionId: string;
  name: string;
  phone: string;
  lastMessageTime: Date;
  idleMinutes: number;
}

export interface BotResponsePoint {
  day: string;
  avgSeconds: number;
}

export interface ConversationSizeBucket {
  range: string;
  count: number;
}

export interface BotVsHuman {
  name: string;
  value: number;
}

export interface NewChatMonthly {
  month: string;
  chats: number;
}

export interface ChatKPIs {
  totalConversations: number;
  activeTodayConversations: number;
  idleClientsOver24h: number;
  idleClientsOver1h: number;
}

export interface ChatMetrics {
  kpis: ChatKPIs;
  hourlyVolume: HourlyVolume[];
  weekdayVolume: WeekdayVolume[];
  idleClients: IdleClient[];
  botResponseTime: BotResponsePoint[];
  conversationSizes: ConversationSizeBucket[];
  botVsHuman: BotVsHuman[];
  newChatsMonthly: NewChatMonthly[];
}

const emptyMetrics: ChatMetrics = {
  kpis: {
    totalConversations: 0,
    activeTodayConversations: 0,
    idleClientsOver24h: 0,
    idleClientsOver1h: 0,
  },
  hourlyVolume: Array.from({ length: 24 }, (_, i) => ({
    hour: `${String(i).padStart(2, '0')}h`,
    messages: 0,
  })),
  weekdayVolume: [
    { day: 'Dom', conversations: 0 },
    { day: 'Seg', conversations: 0 },
    { day: 'Ter', conversations: 0 },
    { day: 'Qua', conversations: 0 },
    { day: 'Qui', conversations: 0 },
    { day: 'Sex', conversations: 0 },
    { day: 'Sáb', conversations: 0 },
  ],
  idleClients: [],
  botResponseTime: [],
  conversationSizes: [
    { range: '1–5', count: 0 },
    { range: '6–15', count: 0 },
    { range: '16–30', count: 0 },
    { range: '31+', count: 0 },
  ],
  botVsHuman: [
    { name: 'Bot (IA)', value: 0 },
    { name: 'Cliente', value: 0 },
  ],
  newChatsMonthly: [],
};

/** Extract the best available timestamp from a chat history row */
function getRecordDate(row: { hora?: string | null; data?: string | null }): Date | null {
  const raw = (row as any).hora || row.data;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/** Extract message type string from the JSON message field */
function getMessageType(message: any): 'human' | 'ai' | 'unknown' {
  if (!message) return 'unknown';
  if (typeof message === 'string') {
    try {
      const parsed = JSON.parse(message);
      return parsed?.type === 'human' ? 'human' : parsed?.type === 'ai' ? 'ai' : 'unknown';
    } catch {
      return 'unknown';
    }
  }
  if (typeof message === 'object') {
    if (message.type === 'human') return 'human';
    if (message.type === 'ai') return 'ai';
    // Some formats nest messages array
    if (Array.isArray(message.messages) && message.messages.length > 0) {
      const last = message.messages[message.messages.length - 1];
      return last?.type === 'human' ? 'human' : last?.type === 'ai' ? 'ai' : 'unknown';
    }
  }
  return 'unknown';
}

async function fetchChatMetrics(period: MetricsPeriod): Promise<ChatMetrics> {
  const periodStart = getPeriodStart(period);

  // ── Busca limitada ao período selecionado (evita varrer a tabela inteira) ──
  const { data: allRows, error: rowsError } = await supabase
    .from('n8n_chat_histories')
    .select('id, session_id, message, data')
    .gte('data', periodStart.toISOString())
    .order('id', { ascending: true });

  if (rowsError) throw rowsError;

  const rows = (allRows as any[]) ?? [];

  // ── Fetch client data keyed by sessionid ──
  const { data: clientsData } = await supabase
    .from('dados_cliente')
    .select('sessionid, nome, telefone');

  const clientMap: Record<string, { nome: string | null; telefone: string | null }> = {};
  (clientsData ?? []).forEach((c: any) => {
    if (c.sessionid) clientMap[c.sessionid] = { nome: c.nome, telefone: c.telefone };
  });

  // ── Build derived structures ──
  const hourBuckets = new Array(24).fill(0);
  const weekdayBuckets = new Array(7).fill(0);
  const sessionMsgCount: Record<string, number> = {};
  const sessionLastMsg: Record<string, { date: Date; type: 'human' | 'ai' | 'unknown' }> = {};
  const sessionFirstMsg: Record<string, Date> = {};
  let botMessages = 0;
  let humanMessages = 0;

  // For bot response time: collect (humanTime, nextAiTime) pairs keyed by session
  const sessionMsgsList: Record<string, Array<{ date: Date; type: 'human' | 'ai' | 'unknown' }>> = {};

  for (const row of rows) {
    const date = getRecordDate(row);
    const type = getMessageType(row.message);
    const sid = row.session_id as string;

    if (date) {
      hourBuckets[date.getHours()]++;
      weekdayBuckets[date.getDay()]++;

      if (!sessionFirstMsg[sid] || date < sessionFirstMsg[sid]) {
        sessionFirstMsg[sid] = date;
      }

      if (!sessionLastMsg[sid] || date > sessionLastMsg[sid].date) {
        sessionLastMsg[sid] = { date, type };
      }

      if (!sessionMsgsList[sid]) sessionMsgsList[sid] = [];
      sessionMsgsList[sid].push({ date, type });
    }

    sessionMsgCount[sid] = (sessionMsgCount[sid] ?? 0) + 1;

    if (type === 'ai') botMessages++;
    else if (type === 'human') humanMessages++;
  }

  // ── KPIs ──
  const totalConversations = Object.keys(sessionMsgCount).length;

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let activeTodayConversations = 0;
  const idleClientsList: IdleClient[] = [];

  for (const [sid, info] of Object.entries(sessionLastMsg)) {
    const idleMs = Date.now() - info.date.getTime();
    const idleMinutes = Math.floor(idleMs / 60000);

    if (info.date >= todayStart) {
      activeTodayConversations++;
    }

    // Clients where last message is from human (no bot reply yet) and idle
    if (info.type === 'human') {
      const client = clientMap[sid];
      idleClientsList.push({
        sessionId: sid,
        name: client?.nome ?? 'Desconhecido',
        phone: client?.telefone ?? sid,
        lastMessageTime: info.date,
        idleMinutes,
      });
    }
  }

  const idleOver24h = idleClientsList.filter(c => c.idleMinutes >= 24 * 60).length;
  const idleOver1h = idleClientsList.filter(c => c.idleMinutes >= 60).length;

  idleClientsList.sort((a, b) => b.idleMinutes - a.idleMinutes);

  // ── Bot Response Time (últimos 7 dias) ──
  const dayLabels: string[] = [];
  const responseSumByDay: Record<string, number[]> = {};

  for (let d = 6; d >= 0; d--) {
    const dayDate = new Date();
    dayDate.setDate(dayDate.getDate() - d);
    const label = dayDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
    dayLabels.push(label);
    responseSumByDay[label] = [];
  }

  for (const [, msgs] of Object.entries(sessionMsgsList)) {
    const sorted = [...msgs].sort((a, b) => a.date.getTime() - b.date.getTime());
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].type === 'human' && sorted[i + 1].type === 'ai') {
        const diffSec = (sorted[i + 1].date.getTime() - sorted[i].date.getTime()) / 1000;
        if (diffSec > 0 && diffSec < 300) { // max 5min to be a meaningful pair
          const dayDate = sorted[i].date;
          const label = dayDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' });
          if (responseSumByDay[label]) {
            responseSumByDay[label].push(diffSec);
          }
        }
      }
    }
  }

  const botResponseTime: BotResponsePoint[] = dayLabels.map(day => {
    const arr = responseSumByDay[day] ?? [];
    const avg = arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return { day, avgSeconds: Math.round(avg) };
  });

  // ── Conversation Size Buckets ──
  const sizeBuckets = { '1–5': 0, '6–15': 0, '16–30': 0, '31+': 0 };
  for (const count of Object.values(sessionMsgCount)) {
    if (count <= 5) sizeBuckets['1–5']++;
    else if (count <= 15) sizeBuckets['6–15']++;
    else if (count <= 30) sizeBuckets['16–30']++;
    else sizeBuckets['31+']++;
  }

  // ── Novos chats por bucket do período ──
  const chatBuckets: Record<string, number> = {};
  bucketLabels(period).forEach((label) => {
    chatBuckets[label] = 0;
  });

  for (const [, firstDate] of Object.entries(sessionFirstMsg)) {
    const key = bucketKey(firstDate, period);
    if (key in chatBuckets) {
      chatBuckets[key]++;
    }
  }

  const newChatsMonthly: NewChatMonthly[] = Object.entries(chatBuckets).map(([month, chats]) => ({
    month,
    chats,
  }));

  return {
    kpis: {
      totalConversations,
      activeTodayConversations,
      idleClientsOver24h: idleOver24h,
      idleClientsOver1h: idleOver1h,
    },
    hourlyVolume: hourBuckets.map((messages, i) => ({
      hour: `${String(i).padStart(2, '0')}h`,
      messages,
    })),
    weekdayVolume: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, i) => ({
      day,
      conversations: weekdayBuckets[i],
    })),
    idleClients: idleClientsList.slice(0, 20),
    botResponseTime,
    conversationSizes: Object.entries(sizeBuckets).map(([range, count]) => ({ range, count })),
    botVsHuman: [
      { name: 'Bot (IA)', value: botMessages },
      { name: 'Cliente', value: humanMessages },
    ],
    newChatsMonthly,
  };
}

export function useChatMetrics(period: MetricsPeriod = '30d', enabled = true) {
  const query = useQuery({
    queryKey: ['metrics', 'chats', period],
    queryFn: () => fetchChatMetrics(period),
    staleTime: 60_000,
    enabled,
  });

  return {
    metrics: query.data ?? emptyMetrics,
    loading: query.isPending && enabled,
    error: query.error ? 'Não foi possível carregar as métricas de conversas.' : null,
    fetchChatMetrics: query.refetch,
  };
}
