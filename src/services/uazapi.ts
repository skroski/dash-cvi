/**
 * Cliente para a API da Uazapi (WhatsApp).
 * Usa o servidor/token configurados em env.ts (com overrides do
 * ConfigurationManager via localStorage).
 */
import { getActiveConfig } from '@/config/env';

function getUazapiConfig() {
  const config = getActiveConfig();
  return {
    baseUrl: (config.UAZAPI_SERVER_URL || '').replace(/\/$/, ''),
    token: config.UAZAPI_INSTANCE_TOKEN || '',
  };
}

export function isUazapiConfigured(): boolean {
  const { baseUrl, token } = getUazapiConfig();
  return !!baseUrl && !!token;
}

async function uazapiPost<T>(path: string, body: unknown): Promise<T> {
  const { baseUrl, token } = getUazapiConfig();
  if (!baseUrl || !token) {
    throw new Error('Uazapi não configurada: defina o servidor e o token da instância.');
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      token,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Uazapi ${path} falhou (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<T>;
}

// ─── Grupos ───

export interface UazapiGroupParticipant {
  jid: string;
  /** Número extraído do JID (sem sufixo @s.whatsapp.net). */
  phone: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface UazapiGroup {
  jid: string;
  name: string;
  description?: string;
  ownerJid?: string;
  participants: UazapiGroupParticipant[];
  participantsCount: number;
}

/* Os servidores Uazapi variam a capitalização dos campos entre versões
   (JID/jid, Name/name/subject...), então a normalização aceita as duas. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UazapiRaw = any;

function normalizeParticipant(raw: UazapiRaw): UazapiGroupParticipant | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    return { jid: raw, phone: raw.split('@')[0], isAdmin: false, isSuperAdmin: false };
  }
  const jid = raw.JID || raw.jid || raw.id || '';
  if (!jid) return null;
  const isSuperAdmin = !!(raw.IsSuperAdmin ?? raw.isSuperAdmin) || raw.admin === 'superadmin';
  const isAdmin = !!(raw.IsAdmin ?? raw.isAdmin) || raw.admin === 'admin' || isSuperAdmin;
  return {
    jid,
    phone: String(jid).split('@')[0].split(':')[0],
    isAdmin,
    isSuperAdmin,
  };
}

function normalizeGroup(raw: UazapiRaw): UazapiGroup | null {
  if (!raw) return null;
  const jid = raw.JID || raw.jid || raw.id || '';
  if (!jid || !String(jid).includes('@g.us')) return null;

  const participantsRaw = raw.Participants || raw.participants || [];
  const participants = (Array.isArray(participantsRaw) ? participantsRaw : [])
    .map(normalizeParticipant)
    .filter((p): p is UazapiGroupParticipant => !!p);

  return {
    jid,
    name: raw.Name || raw.name || raw.subject || raw.Subject || '',
    description: raw.Topic || raw.topic || raw.description || raw.Description || undefined,
    ownerJid: raw.OwnerJID || raw.ownerJid || raw.owner || undefined,
    participants,
    participantsCount:
      participants.length || Number(raw.ParticipantsCount ?? raw.size ?? 0) || 0,
  };
}

/** Lista todos os grupos dos quais a instância participa. */
export async function listGroups(force = false): Promise<UazapiGroup[]> {
  const data = await uazapiPost<UazapiRaw>('/group/list', { force });
  const rawGroups = Array.isArray(data) ? data : data?.groups || data?.data || [];
  return (Array.isArray(rawGroups) ? rawGroups : [])
    .map(normalizeGroup)
    .filter((g): g is UazapiGroup => !!g);
}

/** Detalhes de um grupo específico (participantes, admins, descrição). */
export async function getGroupInfo(groupJid: string): Promise<UazapiGroup | null> {
  const data = await uazapiPost<UazapiRaw>('/group/info', { groupjid: groupJid });
  return normalizeGroup(data?.group || data);
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
    text = raw.content.text || raw.content.conversation || raw.content.caption || '';
  }

  const typeRaw = String(raw.messageType || raw.mediaType || raw.type || '').toLowerCase();
  let mediaType: UazapiChatMessage['mediaType'];
  if (typeRaw.includes('image') || typeRaw.includes('sticker')) mediaType = 'image';
  else if (typeRaw.includes('audio') || typeRaw.includes('ptt')) mediaType = 'audio';
  else if (typeRaw.includes('video')) mediaType = 'video';
  else if (typeRaw.includes('document')) mediaType = 'document';

  const mediaUrl =
    raw.fileURL ||
    raw.fileUrl ||
    raw.mediaUrl ||
    raw.url ||
    (typeof raw.file === 'string' && raw.file.startsWith('http') ? raw.file : undefined);

  const senderJid: string = raw.sender || raw.participant || raw.key?.participant || '';
  const senderName =
    raw.senderName ||
    raw.pushName ||
    raw.pushname ||
    raw.notifyName ||
    (senderJid ? senderJid.split('@')[0].split(':')[0] : undefined);

  return {
    id: String(id),
    fromMe,
    senderName,
    text: String(text || ''),
    timestamp: timestamp || Date.now(),
    mediaType,
    mediaUrl: mediaUrl ? String(mediaUrl) : undefined,
    fileName: raw.filename || raw.fileName || undefined,
  };
}

/**
 * Busca as mensagens de um chat/grupo no banco do servidor Uazapi — cobre
 * todo o histórico que passou pela instância, não só o que o n8n gravou.
 */
export async function findChatMessages(chatid: string, limit = 200): Promise<UazapiChatMessage[]> {
  const data = await uazapiPost<UazapiRaw>('/message/find', { chatid, limit });
  const rawMessages = Array.isArray(data) ? data : data?.messages || data?.data || [];
  return (Array.isArray(rawMessages) ? rawMessages : [])
    .map(normalizeMessage)
    .filter((m): m is UazapiChatMessage => !!m && (!!m.text || !!m.mediaUrl));
}

// ─── Envio de mensagens ───

/** Envia mensagem de texto para um número ou grupo (JID @g.us). */
export async function sendText(number: string, text: string): Promise<unknown> {
  return uazapiPost('/send/text', { number, text });
}
