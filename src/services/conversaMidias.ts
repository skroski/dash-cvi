/**
 * Catálogo e cópia permanente dos arquivos trocados nas conversas.
 *
 * A Uazapi é a dona da URL que o chat renderiza, mas ela é volátil: depende do
 * servidor da instância continuar no ar, do token continuar válido e da
 * retenção do provedor. Tudo aqui monta uma segunda via no Supabase — uma
 * linha em `conversa_midias` com os metadados e, quando possível, os bytes no
 * bucket privado `conversa-midias`.
 *
 * REGRA DE OURO deste módulo: nada aqui pode derrubar o chat. Toda função
 * engole o próprio erro e devolve vazio/no-op. O painel funciona hoje sem
 * nenhuma dessas tabelas, e precisa continuar funcionando se a migração
 * 20260814120000_conversa_midias.sql ainda não tiver rodado no SQL Editor.
 */
import { supabase } from '@/integrations/supabase/client';
import { ChatMessage } from '@/types/chat';
import { inferMediaKind } from '@/lib/media';
import type { UazapiChatMessage } from '@/services/uazapi';

const BUCKET = 'conversa-midias';

/** Validade das URLs assinadas. Cobre um turno inteiro sem virar link eterno. */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 12;

/**
 * Teto de linhas lidas por conversa. É catálogo de anexos, não de mensagens:
 * fica muito abaixo do limite de 1000 linhas do PostgREST (ver fetchAllRows),
 * então uma página basta.
 */
const MAX_MIDIAS_POR_CONVERSA = 300;

export type DirecaoMidia = 'enviada' | 'recebida';
export type TipoMidia = 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'outro';

interface MidiaRow {
  message_id: string;
  direcao: string;
  tipo: string;
  nome_arquivo: string | null;
  mime_type: string | null;
  legenda: string | null;
  uazapi_url: string | null;
  storage_path: string | null;
  ocorrido_em: string;
}

/** Chaves do Storage aceitam um conjunto restrito de caracteres; JID tem '@'. */
const sanitizeKey = (valor: string): string =>
  valor.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'sem_id';

const somenteDigitos = (valor?: string | null): string | null => {
  const digitos = (valor || '').replace(/\D/g, '');
  return digitos || null;
};

/** Grupos não têm telefone de cliente — o JID @g.us não é um número. */
const telefoneDaSessao = (sessionId: string, telefone?: string | null): string | null =>
  sessionId.includes('@g.us') ? null : somenteDigitos(telefone || sessionId);

const tipoDoArquivo = (mime: string): TipoMidia => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  return 'document';
};

const buildStoragePath = (sessionId: string, messageId: string, nomeArquivo: string): string => {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  return `${sanitizeKey(sessionId)}/${ano}-${mes}/${sanitizeKey(messageId)}-${sanitizeKey(nomeArquivo)}`;
};

/**
 * Extrai o id da mensagem da resposta de envio da Uazapi. O formato varia entre
 * versões do servidor, e algumas nem devolvem id — daí o retorno opcional.
 * Ter o id real é o que evita duas linhas no catálogo para o mesmo arquivo
 * quando a indexação do `/message/find` passar por ele depois.
 */
export function extrairMessageId(resposta: unknown): string | undefined {
  if (!resposta || typeof resposta !== 'object') return undefined;
  const r = resposta as Record<string, unknown>;
  const candidatos = [
    r.messageid,
    r.messageId,
    r.id,
    (r.key as Record<string, unknown> | undefined)?.id,
    (r.message as Record<string, unknown> | undefined)?.messageid,
    (r.message as Record<string, unknown> | undefined)?.id,
  ];
  const encontrado = candidatos.find((c) => typeof c === 'string' && c.length > 0);
  return encontrado ? String(encontrado) : undefined;
}

interface RegistrarMidiaEnviadaParams {
  sessionId: string;
  telefone?: string | null;
  /** O arquivo original — nunca o base64 montado para a Uazapi. */
  arquivo: File | Blob;
  nomeArquivo: string;
  tipo: TipoMidia;
  legenda?: string;
  /** Id devolvido pela Uazapi no envio, quando houver. */
  messageId?: string;
  /** Atendente que assinou a mensagem no painel. */
  atendenteNome?: string | null;
}

/**
 * Guarda o arquivo que acabou de sair do painel: bytes no bucket + linha no
 * catálogo. Roda depois do envio para a Uazapi e nunca o bloqueia — se falhar,
 * a mensagem já foi entregue ao cliente e só o arquivamento se perde.
 */
export async function registrarMidiaEnviada({
  sessionId,
  telefone,
  arquivo,
  nomeArquivo,
  tipo,
  legenda,
  messageId,
  atendenteNome,
}: RegistrarMidiaEnviadaParams): Promise<void> {
  try {
    // Sem id da Uazapi, um id local mantém a coluna NOT NULL e o upsert da
    // indexação idempotente.
    const idMensagem = messageId || `local:${crypto.randomUUID()}`;
    const caminho = buildStoragePath(sessionId, idMensagem, nomeArquivo);
    const contentType = arquivo.type || 'application/octet-stream';

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(caminho, arquivo, { contentType, upsert: false });

    // Objeto já existente é sucesso para o nosso fim (mesmo arquivo, mesma
    // chave); qualquer outra falha ainda merece a linha no catálogo, só que
    // sem storage_path — a edge function de arquivamento pega depois.
    const jaExistia = !!uploadError && /exists/i.test(uploadError.message || '');
    const arquivou = !uploadError || jaExistia;
    if (uploadError && !jaExistia) {
      console.warn('Falha ao guardar o arquivo enviado no Storage:', uploadError.message);
    }

    const { data: auth } = await supabase.auth.getUser();

    const { error: insertError } = await supabase.from('conversa_midias').insert({
      session_id: sessionId,
      telefone: telefoneDaSessao(sessionId, telefone),
      message_id: idMensagem,
      direcao: 'enviada',
      tipo,
      nome_arquivo: nomeArquivo,
      mime_type: contentType,
      tamanho_bytes: arquivo.size,
      legenda: legenda || null,
      storage_path: arquivou ? caminho : null,
      arquivada_em: arquivou ? new Date().toISOString() : null,
      enviada_por_user_id: auth?.user?.id ?? null,
      enviada_por_nome: atendenteNome || null,
      ocorrido_em: new Date().toISOString(),
    });

    if (insertError) {
      console.warn('Falha ao catalogar o arquivo enviado:', insertError.message);
    }
  } catch (err) {
    console.warn('Falha inesperada ao arquivar o arquivo enviado:', err);
  }
}

/**
 * Cataloga as mídias que a Uazapi devolveu para a conversa. Idempotente pelo
 * par (session_id, message_id), então pode rodar a cada abertura de conversa.
 *
 * NÃO deve ser chamada no polling: são até 200 mensagens por chamada e o
 * polling roda a cada 15s por conversa aberta.
 *
 * @returns quantas mídias ainda não têm cópia dos bytes no Storage.
 */
export async function indexarMidiasDaConversa(
  sessionId: string,
  telefone: string | null | undefined,
  mensagens: UazapiChatMessage[],
): Promise<number> {
  const comMidia = mensagens.filter((m) => !!m.mediaUrl && !!m.id);
  if (comMidia.length === 0) return 0;

  try {
    const linhas = comMidia.map((m) => ({
      session_id: sessionId,
      telefone: telefoneDaSessao(sessionId, telefone),
      message_id: m.id,
      direcao: (m.fromMe ? 'enviada' : 'recebida') satisfies DirecaoMidia,
      tipo: (m.mediaType || 'outro') satisfies TipoMidia,
      nome_arquivo: m.fileName || null,
      mime_type: m.mimeType || null,
      tamanho_bytes: m.fileLength ?? null,
      legenda: m.text || null,
      uazapi_url: m.mediaUrl || null,
      ocorrido_em: new Date(m.timestamp).toISOString(),
    }));

    // ignoreDuplicates: a linha que já existe pode ter storage_path preenchido
    // pelo arquivamento — reescrevê-la com os dados crus da Uazapi apagaria a
    // referência da cópia permanente.
    const { error } = await supabase
      .from('conversa_midias')
      .upsert(linhas, { onConflict: 'session_id,message_id', ignoreDuplicates: true });

    if (error) {
      console.warn('Falha ao catalogar as mídias da conversa:', error.message);
      return 0;
    }

    const { count, error: countError } = await supabase
      .from('conversa_midias')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .is('storage_path', null)
      .not('uazapi_url', 'is', null);

    if (countError) return 0;
    return count ?? 0;
  } catch (err) {
    console.warn('Falha inesperada ao catalogar as mídias da conversa:', err);
    return 0;
  }
}

/**
 * Cataloga a mídia que veio do histórico do n8n (`n8n_chat_histories`).
 *
 * POR QUE EXISTE ALÉM DE `indexarMidiasDaConversa`: aquela depende do
 * `/message/find` da Uazapi devolver a URL do arquivo. Quando não devolve — e
 * é justamente o caso do arquivo que o cliente manda —, o histórico do n8n é a
 * ÚNICA origem que registra o anexo. Sem isto, esses arquivos não entram no
 * catálogo nunca.
 *
 * Idempotente pelo `messageId` (`n8n:<id da linha>`), então roda a cada
 * abertura de conversa sem duplicar.
 */
export async function indexarMidiasDoHistorico(
  sessionId: string,
  telefone: string | null | undefined,
  mensagens: ChatMessage[],
): Promise<number> {
  const comMidia = mensagens.filter(
    (m) =>
      !!m.messageId &&
      // Só URL http(s) vira ponteiro no catálogo: `data:` traz o base64 inteiro
      // e `blob:` só existe na aba que o criou — nenhum dos dois é arquivável.
      typeof m.mediaUrl === 'string' &&
      /^https?:\/\//i.test(m.mediaUrl),
  );
  if (comMidia.length === 0) return 0;

  try {
    const linhas = comMidia.map((m) => ({
      session_id: sessionId,
      telefone: telefoneDaSessao(sessionId, telefone),
      message_id: m.messageId as string,
      // 'user' aparece no formato antigo do n8n; 'human', no atual.
      direcao: (['human', 'user'].includes(m.role) || m.type === 'human'
        ? 'recebida'
        : 'enviada') satisfies DirecaoMidia,
      tipo: (inferMediaKind(m) || 'outro') satisfies TipoMidia,
      nome_arquivo: m.fileName || null,
      legenda: m.content || null,
      uazapi_url: m.mediaUrl || null,
      ocorrido_em: m.timestamp,
    }));

    const { error } = await supabase
      .from('conversa_midias')
      .upsert(linhas, { onConflict: 'session_id,message_id', ignoreDuplicates: true });

    if (error) {
      console.warn('Falha ao catalogar as mídias do histórico:', error.message);
      return 0;
    }
    return linhas.length;
  } catch (err) {
    console.warn('Falha inesperada ao catalogar as mídias do histórico:', err);
    return 0;
  }
}

/**
 * Mídias da conversa que já têm cópia no Storage, prontas para exibir.
 *
 * Serve de rede de segurança no chat: um arquivo enviado pelo painel aparece
 * aqui mesmo antes (ou sem) a Uazapi devolvê-lo no `/message/find`, então ele
 * sobrevive ao F5. As URLs são assinadas — o bucket é privado.
 */
export async function listarMidiasArquivadas(sessionId: string): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase
      .from('conversa_midias')
      .select('message_id, direcao, tipo, nome_arquivo, mime_type, legenda, uazapi_url, storage_path, ocorrido_em')
      .eq('session_id', sessionId)
      .not('storage_path', 'is', null)
      .order('ocorrido_em', { ascending: false })
      .limit(MAX_MIDIAS_POR_CONVERSA);

    if (error) {
      // Caso mais provável: a migração ainda não rodou. Degrada para vazio.
      console.warn('Catálogo de mídias indisponível:', error.message);
      return [];
    }

    const linhas = (data || []) as MidiaRow[];
    const caminhos = linhas.map((l) => l.storage_path).filter((p): p is string => !!p);
    if (caminhos.length === 0) return [];

    const { data: assinadas, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(caminhos, SIGNED_URL_TTL_SECONDS);

    if (signError) {
      console.warn('Falha ao assinar as URLs das mídias arquivadas:', signError.message);
      return [];
    }

    const urlPorCaminho = new Map<string, string>();
    (assinadas || []).forEach((item) => {
      if (item.path && item.signedUrl) urlPorCaminho.set(item.path, item.signedUrl);
    });

    return linhas
      .map((linha): ChatMessage | null => {
        const url = linha.storage_path ? urlPorCaminho.get(linha.storage_path) : undefined;
        if (!url) return null;
        return {
          role: linha.direcao === 'enviada' ? 'assistant' : 'human',
          content: linha.legenda || '',
          timestamp: linha.ocorrido_em,
          type: linha.tipo,
          mediaUrl: url,
          fileName: linha.nome_arquivo || undefined,
          messageId: linha.message_id,
          origem: 'catalogo',
        };
      })
      .filter((m): m is ChatMessage => !!m);
  } catch (err) {
    console.warn('Falha inesperada ao ler o catálogo de mídias:', err);
    return [];
  }
}

/**
 * Pede à edge function que copie para o Storage os bytes das mídias que hoje
 * só existem no servidor da Uazapi. O navegador não faz esse download direto
 * (o host de arquivos da Uazapi bloqueia por CORS), então a cópia é sempre
 * server-side.
 *
 * Silenciosa por completo: se a função não estiver publicada, o painel segue
 * exibindo a URL da Uazapi como sempre fez.
 */
export async function solicitarArquivamento(_sessionId: string): Promise<void> {
  // Desativado temporariamente para evitar erros de CORS no console enquanto a função não é deployada no Supabase.
  // Para reativar, execute 'supabase functions deploy arquivar-midias' e descomente o bloco abaixo:
  /*
  try {
    await supabase.functions.invoke('arquivar-midias', { body: { sessionId: _sessionId } });
  } catch {
    // função não publicada ou indisponível
  }
  */
}
