/**
 * Descoberta do tipo de mídia de uma mensagem.
 *
 * POR QUE ISSO PRECISA EXISTIR: o campo `type` de ChatMessage é sobrecarregado.
 * Dependendo da origem ele vale 'image'/'audio'/'document' (mídia), 'human'/'ai'
 * (papel de quem falou, formato antigo do n8n) ou 'imageMessage'/'ptt'
 * (vocabulário cru da Uazapi). E a URL hospedada pela Uazapi normalmente NÃO
 * tem extensão no caminho. Confiar só no `type` faz uma foto do cliente ser
 * renderizada como card de PDF.
 *
 * A mesma função alimenta a renderização e a deduplicação de mídia entre as
 * fontes (Supabase, Uazapi, catálogo) — por isso ela mora fora do componente.
 */

export type MediaKind = 'image' | 'audio' | 'video' | 'document';

const KIND_POR_EXTENSAO: Record<string, MediaKind> = {
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image',
  bmp: 'image', heic: 'image', heif: 'image', svg: 'image', tiff: 'image',

  mp3: 'audio', ogg: 'audio', oga: 'audio', opus: 'audio', wav: 'audio',
  m4a: 'audio', aac: 'audio', amr: 'audio',
  // .webm é ambíguo, mas o gravador de voz do próprio painel produz webm de
  // áudio — é de longe o caso mais comum aqui.
  webm: 'audio',

  mp4: 'video', mov: 'video', avi: 'video', mkv: 'video', '3gp': 'video', m4v: 'video',

  pdf: 'document', doc: 'document', docx: 'document', xls: 'document',
  xlsx: 'document', ppt: 'document', pptx: 'document', csv: 'document',
  txt: 'document', rtf: 'document', zip: 'document', rar: 'document',
};

/**
 * Converte o `type` cru para um tipo de mídia. Devolve undefined para valores
 * que não são mídia ('human', 'ai', 'text') — é isso que impede o marcador de
 * papel de ser confundido com um formato de arquivo.
 */
export function normalizeMediaType(raw?: string | null): MediaKind | undefined {
  const t = String(raw || '').toLowerCase();
  if (!t) return undefined;
  if (t.includes('image') || t.includes('sticker') || t.includes('photo')) return 'image';
  if (t.includes('audio') || t.includes('ptt') || t.includes('voice')) return 'audio';
  if (t.includes('video')) return 'video';
  if (t.includes('document') || t.includes('pdf') || t.includes('file')) return 'document';
  return undefined;
}

function kindPorMime(mime?: string | null): MediaKind | undefined {
  const m = String(mime || '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('application/') || m.startsWith('text/')) return 'document';
  return undefined;
}

/** Extensão (sem ponto, minúscula) de um nome de arquivo ou caminho de URL. */
export function extensaoDe(valor?: string | null): string | undefined {
  const limpo = String(valor || '').split(/[?#]/)[0];
  const match = limpo.match(/\.([a-z0-9]{2,5})$/i);
  return match ? match[1].toLowerCase() : undefined;
}

function caminhoDaUrl(url: string): string {
  try {
    return new URL(url, 'https://local.invalid').pathname;
  } catch {
    return url;
  }
}

export interface MidiaIdentificavel {
  type?: string;
  mediaUrl?: string;
  fileName?: string;
}

/**
 * Melhor palpite do tipo de mídia da mensagem, na ordem em que cada pista é
 * confiável: `type` (só quando é mesmo de mídia) → extensão do nome do arquivo
 * → extensão no caminho da URL → mime de um data: URI.
 *
 * Devolve undefined quando nada identifica — quem renderiza é que decide o
 * fallback, e assim não se afirma "PDF" para um arquivo desconhecido.
 */
export function inferMediaKind(msg: MidiaIdentificavel): MediaKind | undefined {
  const porTipo = normalizeMediaType(msg.type);
  if (porTipo) return porTipo;

  const porNome = KIND_POR_EXTENSAO[extensaoDe(msg.fileName) || ''];
  if (porNome) return porNome;

  const url = msg.mediaUrl || '';
  if (!url) return undefined;

  if (url.startsWith('data:')) {
    return kindPorMime(url.slice(5).split(/[;,]/)[0]);
  }

  return KIND_POR_EXTENSAO[extensaoDe(caminhoDaUrl(url)) || ''];
}

/** Prévia de uma linha para a lista de conversas e para as notificações. */
export function rotuloPreviaMidia(msg: MidiaIdentificavel): string {
  switch (inferMediaKind(msg)) {
    case 'image': return '📷 Imagem';
    case 'audio': return '🎵 Áudio';
    case 'video': return '🎥 Vídeo';
    default: return '📄 Documento';
  }
}

/** Rótulo curto do formato para o card de arquivo. */
export function rotuloDoFormato(msg: MidiaIdentificavel): string {
  const ext = extensaoDe(msg.fileName) || extensaoDe(caminhoDaUrl(msg.mediaUrl || ''));
  if (ext) return ext.toUpperCase();

  switch (inferMediaKind(msg)) {
    case 'image': return 'Imagem';
    case 'audio': return 'Áudio';
    case 'video': return 'Vídeo';
    default: return 'Arquivo';
  }
}
