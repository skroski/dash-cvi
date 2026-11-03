/**
 * Cliente para a API da Uazapi (WhatsApp).
 * Todas as chamadas passam pela Edge Function autenticada. Assim o token da
 * instância fica somente nos Supabase Secrets, jamais no navegador.
 */
import { supabase } from '@/integrations/supabase/client';

/**
 * Monta o chatid (JID) que a Uazapi usa para uma conversa a partir de um
 * telefone, de um session_id do n8n ou de um JID já pronto (grupo @g.us).
 * É a chave canônica da conversa: o `/message/find` e o catálogo de mídias no
 * Supabase precisam usar exatamente a mesma.
 */
export function buildChatId(idOrPhone: string): string {
  if (idOrPhone.includes('@')) return idOrPhone;
  const digits = idOrPhone.replace(/\D/g, '');
  return `${digits}@s.whatsapp.net`;
}

export function isUazapiConfigured(): boolean {
  // A disponibilidade real é validada no backend. Não existe mais token ou
  // URL de provedor no bundle para a interface tentar inspecionar.
  return true;
}

/** Códigos de erro da Edge Function `whatsapp` em linguagem de quem usa o painel. */
const MENSAGENS_ERRO_WHATSAPP: Record<string, string> = {
  whatsapp_not_configured: 'O WhatsApp da clínica ainda não foi configurado (UAZAPI_SERVER_URL e UAZAPI_INSTANCE_TOKEN).',
  unauthorized: 'Sua sessão não tem acesso ao WhatsApp. Entre novamente com um usuário ativo da equipe.',
  forbidden: 'Seu perfil pode enviar mensagens, mas não gerenciar a conexão do WhatsApp.',
  unsupported_operation: 'Operação de WhatsApp não permitida pelo servidor.',
  whatsapp_timeout: 'O servidor do WhatsApp demorou para responder. Tente de novo.',
  whatsapp_unavailable: 'Não foi possível falar com o servidor do WhatsApp agora.',
  whatsapp_provider_error: 'O servidor do WhatsApp recusou a operação. Confira se o número está conectado.',
};

async function uazapiRequest<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke('whatsapp', {
    body: { method, path, ...(method === 'POST' ? { body } : {}) },
  });
  if (error) {
    // Respostas não-2xx chegam como FunctionsHttpError; o código real está no corpo JSON.
    let codigo = '';
    try {
      const corpo = await (error as { context?: Response }).context?.json();
      if (corpo && typeof corpo.error === 'string') codigo = corpo.error;
    } catch {
      // Sem corpo JSON: usa a mensagem genérica abaixo.
    }
    // `codigo` continua disponível para quem precisar decidir pelo tipo de erro.
    throw Object.assign(new Error(MENSAGENS_ERRO_WHATSAPP[codigo] ?? (codigo || error.message)), { codigo });
  }
  if (data?.error) {
    const codigo = String(data.error);
    throw Object.assign(new Error(MENSAGENS_ERRO_WHATSAPP[codigo] ?? codigo), { codigo });
  }
  return data?.data as T;
}

async function uazapiPost<T>(path: string, body: unknown): Promise<T> {
  return uazapiRequest<T>('POST', path, body);
}

async function uazapiGet<T>(path: string): Promise<T> {
  return uazapiRequest<T>('GET', path);
}

// ─── Instância ───

/**
 * Telefone da instância conectada, em cache pelo tempo de vida da aba.
 * Serve para saber se somos admin de um grupo (e, com isso, se conseguimos
 * enviar mensagem num grupo restrito a admins).
 */
let instancePhoneCache: string | null | undefined;

export type UazapiConnectionStatus = {
  connected: boolean | null;
  phone: string | null;
  label: string;
  qrcode?: string | null;
  paircode?: string | null;
};

/**
 * Consulta o estado atual da instância configurada no servidor UAZ.
 */
export async function getUazapiConnectionStatus(): Promise<UazapiConnectionStatus> {
  const data = await uazapiGet<UazapiRaw>('/instance/status');
  const raw = data?.instance || data?.status || data || {};
  const candidate = raw.connected ?? raw.isConnected ?? raw.connection ?? raw.status ?? data?.connected;
  const normalized = String(candidate ?? '').toLowerCase();
  const connected = typeof candidate === 'boolean'
    ? candidate
    : ['connected', 'open', 'online', 'active', 'ready'].includes(normalized)
      ? true
      : ['disconnected', 'close', 'closed', 'offline', 'inactive', 'failed'].includes(normalized)
        ? false
        : null;
  const phoneRaw = raw.owner ?? raw.jid ?? raw.number ?? data?.owner ?? data?.jid ?? '';
  const phone = String(phoneRaw).split('@')[0].split(':')[0].replace(/\D/g, '') || null;
  if (phone) instancePhoneCache = phone;
  const qrcode = (raw.qrcode || data?.qrcode || null) as string | null;
  const paircode = (raw.paircode || data?.paircode || null) as string | null;

  return {
    connected,
    phone,
    label: typeof candidate === 'string' ? candidate : connected === true ? 'Conectado' : connected === false ? 'Desconectado' : 'Status não informado',
    qrcode,
    paircode,
  };
}

/**
 * Solicita a conexão da instância gerando novo QR Code / Pair code se desconectada.
 */
export async function connectUazapi(): Promise<UazapiConnectionStatus> {
  const data = await uazapiPost<UazapiRaw>('/instance/connect', {});
  const raw = data?.instance || data?.status || data || {};
  const connected = data?.connected === true || raw.connected === true;
  const phoneRaw = raw.owner ?? raw.jid ?? raw.number ?? data?.jid ?? '';
  const phone = String(phoneRaw).split('@')[0].split(':')[0].replace(/\D/g, '') || null;
  if (phone) instancePhoneCache = phone;
  const qrcode = (raw.qrcode || data?.qrcode || null) as string | null;
  const paircode = (raw.paircode || data?.paircode || null) as string | null;

  return {
    connected,
    phone,
    label: connected ? 'Conectado' : 'Aguardando leitura do QR Code',
    qrcode,
    paircode,
  };
}

/**
 * Desconecta a instância do WhatsApp.
 */
export async function disconnectUazapi(): Promise<void> {
  instancePhoneCache = null;
  await uazapiPost('/instance/disconnect', {});
}

export async function getInstancePhone(): Promise<string | null> {
  if (instancePhoneCache !== undefined) return instancePhoneCache;
  try {
    const data = await uazapiGet<UazapiRaw>('/instance/status');
    const raw = data?.instance?.owner || data?.status?.jid || data?.owner || '';
    const phone = String(raw).split('@')[0].split(':')[0].replace(/\D/g, '');
    // Só guarda em cache o que deu certo. Guardar a falha faria uma queda
    // momentânea do /instance/status zerar `iAmAdmin` pelo resto da sessão —
    // e o painel passaria a dizer "somente leitura" em grupo onde a clínica
    // É admin.
    if (phone) instancePhoneCache = phone;
    return phone || null;
  } catch (err) {
    console.warn('Não foi possível identificar o número da instância na Uazapi:', err);
    return null;
  }
}

// ─── Grupos ───

export interface UazapiGroupParticipant {
  jid: string;
  /**
   * Telefone real do participante, só dígitos.
   *
   * Depois da migração de LID do WhatsApp, o `JID` do participante passou a ser
   * um identificador opaco (`213992534478927@lid`) que NÃO é telefone. O número
   * de verdade vem em `PhoneNumber`. Ler o JID aqui exibia números inventados.
   */
  phone: string;
  /** Nome exibido, quando o WhatsApp devolve. */
  displayName?: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface UazapiGroup {
  jid: string;
  name: string;
  description?: string;
  ownerJid?: string;
  /** Telefone do dono do grupo (só dígitos), quando disponível. */
  ownerPhone?: string;
  participants: UazapiGroupParticipant[];
  participantsCount: number;
  /** Somente admins podem enviar mensagens ("grupo silenciado" no WhatsApp). */
  isAnnounce: boolean;
  /** Somente admins podem editar nome/foto/descrição. */
  isLocked: boolean;
  /**
   * Segundos até a mensagem sumir; 0 = desligado.
   *
   * Não use o booleano `IsEphemeral` do servidor: ele vem `true` com timer 0 em
   * vários grupos (resquício de quando a opção foi ligada e depois desligada).
   * O timer é a única informação confiável.
   */
  disappearingTimer: number;
  /** Precisa de aprovação de admin para entrar. */
  isJoinApprovalRequired: boolean;
  /** É o grupo "pai" de uma Comunidade. */
  isCommunityParent: boolean;
  /** JID da Comunidade a que este grupo pertence, quando é subgrupo. */
  linkedParentJid?: string;
  /** Criação do grupo (ISO), quando o servidor informa. */
  createdAt?: string;
  /** A instância conectada é admin deste grupo. */
  iAmAdmin: boolean;
  /** A instância conectada aparece na lista de participantes. */
  iAmParticipant: boolean;
}

/* Os servidores Uazapi variam a capitalização dos campos entre versões
   (JID/jid, Name/name/subject...), então a normalização aceita as duas. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UazapiRaw = any;

/** Extrai só os dígitos de um JID/telefone (`5511...@s.whatsapp.net` → `5511...`). */
function jidToDigits(value: unknown): string {
  return String(value || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

function normalizeParticipant(raw: UazapiRaw): UazapiGroupParticipant | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    return { jid: raw, phone: jidToDigits(raw), isAdmin: false, isSuperAdmin: false };
  }
  const jid = raw.JID || raw.jid || raw.id || '';
  if (!jid) return null;
  const isSuperAdmin = !!(raw.IsSuperAdmin ?? raw.isSuperAdmin) || raw.admin === 'superadmin';
  const isAdmin = !!(raw.IsAdmin ?? raw.isAdmin) || raw.admin === 'admin' || isSuperAdmin;
  // `PhoneNumber` primeiro: com a migração de LID, o JID deixou de ser telefone.
  const phone = jidToDigits(raw.PhoneNumber ?? raw.phoneNumber ?? raw.phone) || jidToDigits(jid);
  const displayName = String(raw.DisplayName || raw.displayName || raw.pushName || '').trim();
  return {
    jid,
    phone,
    displayName: displayName || undefined,
    isAdmin,
    isSuperAdmin,
  };
}

/** Data ISO só quando é real — o servidor usa `0001-01-01...` como "vazio". */
function normalizeGroupDate(value: unknown): string | undefined {
  const text = String(value || '');
  if (!text || text.startsWith('0001-01-01')) return undefined;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function normalizeGroup(raw: UazapiRaw, instancePhone?: string | null): UazapiGroup | null {
  if (!raw) return null;
  const jid = raw.JID || raw.jid || raw.id || '';
  if (!jid || !String(jid).includes('@g.us')) return null;

  const participantsRaw = raw.Participants || raw.participants || [];
  const participants = (Array.isArray(participantsRaw) ? participantsRaw : [])
    .map(normalizeParticipant)
    .filter((p): p is UazapiGroupParticipant => !!p);

  const me = instancePhone ? participants.find((p) => p.phone === instancePhone) : undefined;

  return {
    jid,
    name: raw.Name || raw.name || raw.subject || raw.Subject || '',
    description: raw.Topic || raw.topic || raw.description || raw.Description || undefined,
    ownerJid: raw.OwnerJID || raw.ownerJid || raw.owner || undefined,
    ownerPhone: jidToDigits(raw.OwnerPN ?? raw.ownerPn) || undefined,
    participants,
    participantsCount:
      participants.length || Number(raw.ParticipantsCount ?? raw.size ?? 0) || 0,
    isAnnounce: !!(raw.IsAnnounce ?? raw.isAnnounce ?? raw.announce),
    isLocked: !!(raw.IsLocked ?? raw.isLocked ?? raw.restrict),
    disappearingTimer: Number(raw.DisappearingTimer ?? raw.disappearingTimer ?? 0) || 0,
    isJoinApprovalRequired: !!(raw.IsJoinApprovalRequired ?? raw.isJoinApprovalRequired),
    isCommunityParent: !!(raw.IsParent ?? raw.isParent),
    linkedParentJid: raw.LinkedParentJID || raw.linkedParentJid || undefined,
    createdAt: normalizeGroupDate(raw.GroupCreated ?? raw.groupCreated ?? raw.creation),
    iAmAdmin: !!me?.isAdmin,
    iAmParticipant: !!me,
  };
}

/**
 * Limite pedido numa única chamada ao `/group/list`.
 *
 * O servidor PAGINA mesmo sem a gente pedir: sem `limit`, devolve 50 e informa
 * o total real em `pagination.totalRecords`. Ignorar isso truncava a lista em
 * silêncio — a instância da Yayá tem 120 grupos e só 50 chegavam, o que fazia
 * grupos ativos perderem nome/participantes na lista de conversas e, na aba
 * Grupos, serem confundidos com "grupos que saímos".
 */
const GROUP_FETCH_LIMIT = 1000;

/** Trava de segurança do fallback paginado. */
const GROUP_MAX_PAGES = 30;

type GroupListPage = { groups: UazapiRaw[]; totalRecords: number | null };

async function fetchGroupPage(body: Record<string, unknown>): Promise<GroupListPage> {
  const data = await uazapiPost<UazapiRaw>('/group/list', body);
  const rawGroups = Array.isArray(data) ? data : data?.groups || data?.data || [];
  const rawTotal = Array.isArray(data)
    ? NaN
    : Number(
        data?.pagination?.totalRecords ??
        data?.pagination?.total ??
        data?.totalRecords ??
        data?.total ??
        data?.totalCount ??
        data?.count
      );
  return {
    groups: Array.isArray(rawGroups) ? rawGroups : [],
    totalRecords: Number.isFinite(rawTotal) && rawTotal >= 0 ? rawTotal : null,
  };
}

/**
 * Lista TODOS os grupos dos quais a instância participa.
 *
 * Tenta buscar com limit alto e percorre todas as páginas disponíveis até obter
 * todos os registros, garantindo compatibilidade com paginações por offset ou page.
 */
export async function listGroups(force = false): Promise<UazapiGroup[]> {
  const instancePhone = await getInstancePhone();
  const groups: UazapiGroup[] = [];
  const seen = new Set<string>();

  const collect = (rawGroups: UazapiRaw[]) => {
    let added = 0;
    for (const raw of rawGroups) {
      const group = normalizeGroup(raw, instancePhone);
      if (group && !seen.has(group.jid)) {
        seen.add(group.jid);
        groups.push(group);
        added++;
      }
    }
    return added;
  };

  const first = await fetchGroupPage({
    force,
    limit: GROUP_FETCH_LIMIT,
    pageSize: GROUP_FETCH_LIMIT,
    page: 1,
    offset: 0,
  });
  collect(first.groups);
  const totalRecords = first.totalRecords;

  const shouldContinue =
    (totalRecords !== null && groups.length < totalRecords) ||
    (first.groups.length >= 20 && totalRecords === null);

  if (shouldContinue && first.groups.length > 0) {
    let offset = first.groups.length;
    let pageNum = 2;
    for (let p = 0; p < GROUP_MAX_PAGES; p++) {
      if (totalRecords !== null && groups.length >= totalRecords) break;
      const next = await fetchGroupPage({
        force: false,
        offset,
        page: pageNum,
        limit: GROUP_FETCH_LIMIT,
        pageSize: GROUP_FETCH_LIMIT,
      });
      if (next.groups.length === 0) break;
      const added = collect(next.groups);
      if (added === 0) break;
      offset += next.groups.length;
      pageNum++;
      if (totalRecords !== null && offset >= totalRecords) break;
    }
  }

  if (totalRecords !== null && groups.length < totalRecords) {
    console.warn(
      `Uazapi /group/list: recebidos ${groups.length} de ${totalRecords} grupos. A lista está incompleta.`
    );
  }

  return groups;
}

/** Detalhes de um grupo específico (participantes, admins, descrição). */
export async function getGroupInfo(groupJid: string): Promise<UazapiGroup | null> {
  const [data, instancePhone] = await Promise.all([
    uazapiPost<UazapiRaw>('/group/info', { groupjid: groupJid }),
    getInstancePhone(),
  ]);
  return normalizeGroup(data?.group || data, instancePhone);
}

/** Dados seguros de apresentação do chat (avatar), obtidos pelo proxy. */
export async function getChatDetails(number: string): Promise<{ image?: string; imagePreview?: string }> {
  return uazapiPost('/chat/details', { number, preview: true });
}

// ─── Mensagens ───

export interface UazapiChatMessage {
  id: string;
  fromMe: boolean;
  senderName?: string;
  text: string;
  /** Epoch em milissegundos. */
  timestamp: number;
  mediaType?: 'image' | 'audio' | 'video' | 'document';
  mediaUrl?: string;
  fileName?: string;
  /** MIME informado pelo servidor, quando vem. Usado no catálogo de mídias. */
  mimeType?: string;
  /** Tamanho em bytes informado pelo servidor, quando vem. */
  fileLength?: number;
}

function normalizeMessage(raw: UazapiRaw): UazapiChatMessage | null {
  if (!raw) return null;

  const id = raw.messageid || raw.messageId || raw.id || raw.key?.id || '';

  let timestamp = Number(raw.messageTimestamp ?? raw.timestamp ?? raw.t ?? 0);
  if (timestamp > 0 && timestamp < 1e12) timestamp *= 1000; // veio em segundos

  const fromMe = !!(raw.fromMe ?? raw.key?.fromMe);

  // O texto muda de campo conforme o tipo da mensagem e a versão do servidor
  let text: string = raw.text || raw.caption || raw.body || '';
  if (!text && typeof raw.content === 'string') text = raw.content;
  if (!text && raw.content && typeof raw.content === 'object') {
    const c = raw.content as Record<string, unknown>;
    text = String(c.text || c.conversation || c.caption || '');
  }

  // Suporte a mensagens do WhatsApp/Baileys/Evolution (raw.message / raw.msg)
  const msgObj = raw.message || raw.msg;
  if (!text && msgObj && typeof msgObj === 'object') {
    const m = msgObj as Record<string, unknown>;
    const ext = m.extendedTextMessage as Record<string, unknown> | undefined;
    const img = m.imageMessage as Record<string, unknown> | undefined;
    const vid = m.videoMessage as Record<string, unknown> | undefined;
    const doc = m.documentMessage as Record<string, unknown> | undefined;
    const docCap = (m.documentWithCaptionMessage as Record<string, unknown> | undefined)?.message as Record<string, unknown> | undefined;
    const eph = (m.ephemeralMessage as Record<string, unknown> | undefined)?.message as Record<string, unknown> | undefined;
    const viewOnce = (m.viewOnceMessage as Record<string, unknown> | undefined)?.message as Record<string, unknown> | undefined;
    const viewOnceV2 = (m.viewOnceMessageV2 as Record<string, unknown> | undefined)?.message as Record<string, unknown> | undefined;

    text = String(
      m.conversation ||
      ext?.text ||
      img?.caption ||
      vid?.caption ||
      doc?.caption ||
      (docCap?.documentMessage as Record<string, unknown> | undefined)?.caption ||
      eph?.conversation ||
      (eph?.extendedTextMessage as Record<string, unknown> | undefined)?.text ||
      (viewOnce?.imageMessage as Record<string, unknown> | undefined)?.caption ||
      (viewOnceV2?.imageMessage as Record<string, unknown> | undefined)?.caption ||
      ''
    );
  } else if (!text && typeof msgObj === 'string') {
    text = msgObj;
  }

  const mObj = msgObj && typeof msgObj === 'object' ? (msgObj as Record<string, unknown>) : null;

  const typeRaw = String(
    raw.messageType ||
    raw.mediaType ||
    raw.type ||
    (mObj ? Object.keys(mObj)[0] : '') ||
    ''
  ).toLowerCase();

  let mediaType: UazapiChatMessage['mediaType'];
  if (typeRaw.includes('image') || typeRaw.includes('sticker')) mediaType = 'image';
  else if (typeRaw.includes('audio') || typeRaw.includes('ptt') || typeRaw.includes('voice')) mediaType = 'audio';
  else if (typeRaw.includes('video')) mediaType = 'video';
  else if (typeRaw.includes('document')) mediaType = 'document';

  const mImg = mObj?.imageMessage as Record<string, unknown> | undefined;
  const mVid = mObj?.videoMessage as Record<string, unknown> | undefined;
  const mAud = mObj?.audioMessage as Record<string, unknown> | undefined;
  const mDoc = mObj?.documentMessage as Record<string, unknown> | undefined;
  const mStk = mObj?.stickerMessage as Record<string, unknown> | undefined;

  const mediaUrl =
    raw.fileURL ||
    raw.fileUrl ||
    raw.mediaUrl ||
    raw.url ||
    mImg?.url ||
    mVid?.url ||
    mAud?.url ||
    mDoc?.url ||
    mStk?.url ||
    (typeof raw.file === 'string' && raw.file.startsWith('http') ? raw.file : undefined);

  const senderJid: string = raw.sender || raw.participant || raw.key?.participant || '';
  const senderName =
    raw.senderName ||
    raw.pushName ||
    raw.pushname ||
    raw.notifyName ||
    raw.verifiedBizName ||
    (senderJid ? senderJid.split('@')[0].split(':')[0] : undefined);

  const fileName =
    raw.filename ||
    raw.fileName ||
    mDoc?.fileName ||
    mDoc?.title ||
    undefined;

  const mimeType =
    raw.mimetype ||
    raw.mimeType ||
    raw.mime ||
    mImg?.mimetype ||
    mVid?.mimetype ||
    mAud?.mimetype ||
    mDoc?.mimetype ||
    undefined;

  const fileLength = Number(
    raw.fileLength ??
    raw.filesize ??
    raw.fileSize ??
    mImg?.fileLength ??
    mVid?.fileLength ??
    mAud?.fileLength ??
    mDoc?.fileLength ??
    0
  );

  return {
    id: String(id),
    fromMe,
    senderName,
    text: String(text || ''),
    timestamp: timestamp || Date.now(),
    mediaType,
    mediaUrl: mediaUrl ? String(mediaUrl) : undefined,
    fileName: fileName ? String(fileName) : undefined,
    mimeType: mimeType ? String(mimeType) : undefined,
    fileLength: Number.isFinite(fileLength) && fileLength > 0 ? fileLength : undefined,
  };
}

/**
 * Busca as mensagens de um chat/grupo no banco do servidor Uazapi — cobre
 * todo o histórico que passou pela instância, não só o que o n8n gravou.
 */
export async function findChatMessages(chatid: string, limit = 200): Promise<UazapiChatMessage[]> {
  const data = await uazapiPost<UazapiRaw>('/message/find', {
    chatid,
    chatId: chatid,
    jid: chatid,
    limit,
  });
  const rawMessages = Array.isArray(data) ? data : data?.messages || data?.data || data?.result || [];
  return (Array.isArray(rawMessages) ? rawMessages : [])
    .map(normalizeMessage)
    .filter((m): m is UazapiChatMessage => !!m && (!!m.text || !!m.mediaUrl || !!m.mediaType));
}

// ─── Envio de mensagens ───

/** Envia mensagem de texto para um número ou grupo (JID @g.us). */
export async function sendText(number: string, text: string): Promise<unknown> {
  return uazapiPost('/send/text', { number, text });
}

/** Envia anexo sem deixar base URL ou token do WhatsApp expostos no front-end. */
export async function sendMedia(input: {
  number: string;
  type: string;
  file: string;
  caption?: string;
  filename?: string;
}): Promise<unknown> {
  return uazapiPost('/send/media', {
    number: input.number,
    type: input.type,
    mediatype: input.type,
    file: input.file,
    media: input.file,
    caption: input.caption || '',
    filename: input.filename,
    fileName: input.filename,
  });
}

/** Envia mensagem com botões interativos via Uazapi (/send/menu), com fallback para texto simples. */
export async function sendMenuButtons(
  number: string,
  text: string,
  buttons: Array<{ id: string; text: string }>,
  footerText?: string
): Promise<unknown> {
  const choices = buttons.map((b) => `${b.text}|${b.id}`);
  try {
    return await uazapiPost('/send/menu', {
      number,
      type: 'button',
      text,
      footerText: footerText || undefined,
      choices,
    });
  } catch (err) {
    try {
      return await uazapiPost('/send/menu', {
        number,
        type: 'button_legacy',
        text,
        footerText: footerText || undefined,
        choices,
      });
    } catch {
      // Fallback transparente para texto simples
      return await sendText(number, text);
    }
  }
}

// ─── Respostas Rápidas / Modelos do WhatsApp ───

export interface UazapiQuickReply {
  id: string;
  shortcut: string;
  title: string;
  text: string;
}

/**
 * Busca os modelos / respostas rápidas cadastrados no telefone/instância via Uazapi.
 * Endpoint nativo do WhatsApp/Uazapi: GET /quickreply/showall
 */
export async function fetchUazapiQuickReplies(): Promise<UazapiQuickReply[]> {
  if (!isUazapiConfigured()) return [];

  try {
    const data = await uazapiGet<UazapiRaw>('/quickreply/showall');
    const items = Array.isArray(data)
      ? data
      : data?.quickReplies || data?.quickreply || data?.data || [];

    if (Array.isArray(items) && items.length > 0) {
      return items
        .map((item: any, idx: number) => {
          const rawShortcut = item.shortCut || item.shortcut || item.tag || item.command || `modelo-${idx + 1}`;
          const cleanShortcut = String(rawShortcut).startsWith('/')
            ? String(rawShortcut)
            : `/${rawShortcut}`;

          const text = String(item.text || item.message || item.content || item.body || '').trim();

          // Gera um título limpo a partir do atalho ou da primeira linha do texto
          const firstLine = text.split('\n')[0].replace(/[*_~`#🐾💚❤️🐶🐈👁️‍🗨️👩🏽‍⚕️☺️👩🏻‍⚕️✨]/g, '').trim();
          const shortcutTitle = cleanShortcut.slice(1);
          const formattedShortcut = shortcutTitle.charAt(0).toUpperCase() + shortcutTitle.slice(1);

          const title = item.title || item.name || (firstLine ? firstLine.slice(0, 40) : formattedShortcut) || `Modelo WhatsApp ${idx + 1}`;

          return {
            id: String(item.id || item._id || `uazapi-${idx}`),
            shortcut: cleanShortcut,
            title,
            text,
          };
        })
        .filter((item) => !!item.text);
    }
  } catch (err) {
    console.error('Erro ao buscar respostas rápidas do WhatsApp via Uazapi (/quickreply/showall):', err);
  }

  return [];
}

