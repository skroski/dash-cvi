// Base de conhecimento/RAG de Alta Performance com PGVector e Google Drive.
// Gerenciada no servidor com isolamento seguro de chaves OpenAI e Google APIs.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { obterOpenAiKey, segredo } from '../_shared/segredos.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_CHARS = 250_000;
const CHUNK_SIZE = 1_200;
const CHUNK_OVERLAP = 180;
const EMBEDDING_BATCH_SIZE = 64;

type DocumentoResumo = {
  id: number;
  titulo: string;
  categoria: string;
  origem: string;
  drive_id?: string | null;
  partes: number;
  total_caracteres?: number;
  criado_em?: string;
  atualizado_em?: string;
};

async function usuarioGestor(request: Request, admin: SupabaseClient) {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!bearer) return null;
  const { data, error } = await admin.auth.getUser(bearer);
  if (error || !data.user) return null;

  const { data: profile } = await admin
    .from('profiles')
    .select('papel,ativo')
    .eq('id', data.user.id)
    .maybeSingle();
  if (!profile?.ativo || !['admin', 'lider'].includes(profile.papel)) return null;
  return data.user;
}

function textoLimpo(value: unknown, limit: number): string {
  return typeof value === 'string'
    ? value.replaceAll(String.fromCharCode(0), '').trim().slice(0, limit)
    : '';
}

// Divisor semântico baseado em quebras de parágrafo e limites de frases
function dividirEmPartesInteligente(texto: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const normalizado = texto
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!normalizado) return [];
  if (normalizado.length <= chunkSize) return [normalizado];

  const paragrafos = normalizado.split(/\n\n+/);
  const partes: string[] = [];
  let bufferAtual = '';

  for (const paragrafo of paragrafos) {
    const limpo = paragrafo.trim();
    if (!limpo) continue;

    // Se o parágrafo sozinho exceder o chunk, divide por frases
    if (limpo.length > chunkSize) {
      if (bufferAtual) {
        partes.push(bufferAtual.trim());
        bufferAtual = '';
      }
      const frases = limpo.split(/(?<=[.!?])\s+/);
      let subBuffer = '';
      for (const frase of frases) {
        if ((subBuffer + ' ' + frase).length > chunkSize) {
          if (subBuffer) partes.push(subBuffer.trim());
          subBuffer = frase;
        } else {
          subBuffer = subBuffer ? `${subBuffer} ${frase}` : frase;
        }
      }
      if (subBuffer) partes.push(subBuffer.trim());
      continue;
    }

    if ((bufferAtual + '\n\n' + limpo).length > chunkSize) {
      if (bufferAtual) {
        partes.push(bufferAtual.trim());
        // Adiciona overlap pegando o final do buffer anterior
        const trechoOverlap = bufferAtual.slice(-overlap).trim();
        bufferAtual = trechoOverlap ? `${trechoOverlap}\n\n${limpo}` : limpo;
      } else {
        bufferAtual = limpo;
      }
    } else {
      bufferAtual = bufferAtual ? `${bufferAtual}\n\n${limpo}` : limpo;
    }
  }

  if (bufferAtual.trim()) {
    partes.push(bufferAtual.trim());
  }

  return partes.filter((p) => p.length >= 20);
}

// Extração de texto de arquivos enviados (PDF, DOCX, TXT, MD, CSV, JSON)
async function extrairTextoArquivo(file: File, apiKey: string): Promise<string> {
  const name = file.name.toLowerCase();
  const isTextual = file.type.startsWith('text/') || /\.(txt|md|csv|json|xml|yaml|yml)$/i.test(name);

  if (isTextual) {
    const raw = await file.text();
    return textoLimpo(raw, MAX_TEXT_CHARS);
  }

  // Para PDF ou DOCX binários: usa upload efêmero para a OpenAI extrair preservando tabelas e semântica
  const upload = new FormData();
  upload.append('purpose', 'user_data');
  upload.append('file', file, file.name);

  const fileResponse = await fetch('https://api.openai.com/v1/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: upload,
    signal: AbortSignal.timeout(60_000),
  });

  const fileData = await fileResponse.json().catch(() => null);
  if (!fileResponse.ok || !fileData?.id) {
    throw new Error('knowledge_file_upload_failed');
  }

  try {
    const model = segredo('MAIA_OPENAI_MODEL') || 'gpt-4.1-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'Você é um extrator de texto factual para base de conhecimento veterinária. Extraia todo o conteúdo do documento com fidelidade: preserve tabelas, listas, nomes de procedimentos, valores, horários e orientações. Não faça resumos, não acrescente saudações nem opine.',
          },
          {
            role: 'user',
            content: `Arquivo anexado ID: ${fileData.id}. Nome: ${file.name}. Extraia o texto na íntegra.`,
          },
        ],
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(90_000),
    });

    const completion = await response.json().catch(() => null);
    const extraido = completion?.choices?.[0]?.message?.content;
    if (!response.ok || typeof extraido !== 'string') {
      throw new Error('knowledge_text_extraction_failed');
    }
    return textoLimpo(extraido, MAX_TEXT_CHARS);
  } finally {
    await fetch(`https://api.openai.com/v1/files/${fileData.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15_000),
    }).catch(() => undefined);
  }
}

// Resolução de token do Google para acessar a API do Drive
async function resolverGoogleAccessToken(tokenFornecido?: string): Promise<string | null> {
  if (tokenFornecido && typeof tokenFornecido === 'string' && tokenFornecido.trim().length > 10) {
    return tokenFornecido.trim();
  }

  const direto = segredo('GOOGLE_DRIVE_ACCESS_TOKEN') || segredo('GOOGLE_CALENDAR_ACCESS_TOKEN');
  if (direto) return direto;

  const refreshToken = segredo('GOOGLE_DRIVE_REFRESH_TOKEN') || segredo('GOOGLE_CALENDAR_REFRESH_TOKEN');
  const clientId = segredo('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = segredo('GOOGLE_OAUTH_CLIENT_SECRET');

  if (refreshToken && clientId && clientSecret) {
    const form = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);

    if (res && res.ok) {
      const payload = await res.json().catch(() => null);
      if (typeof payload?.access_token === 'string') return payload.access_token;
    }
  }

  return null;
}

// Extrai o File ID de um link do Google Drive ou aceita o próprio ID
function extrairIdGoogleDrive(urlOuId: string): string | null {
  const entrada = urlOuId.trim();
  const fileRegex = /https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
  const docRegex = /https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/;
  const sheetRegex = /https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/;
  const openRegex = /[?&]id=([a-zA-Z0-9_-]+)/;

  const matchFile = entrada.match(fileRegex);
  if (matchFile) return matchFile[1];

  const matchDoc = entrada.match(docRegex);
  if (matchDoc) return matchDoc[1];

  const matchSheet = entrada.match(sheetRegex);
  if (matchSheet) return matchSheet[1];

  const matchOpen = entrada.match(openRegex);
  if (matchOpen) return matchOpen[1];

  if (/^[a-zA-Z0-9_-]{20,}$/.test(entrada)) {
    return entrada;
  }

  return null;
}

// Baixa e extrai conteúdo do Google Drive via Google Drive v3 API
async function obterConteudoGoogleDrive(
  fileId: string,
  googleToken: string | null,
  apiKeyOpenAI: string
): Promise<{ titulo: string; conteudo: string; mimeType: string }> {
  // 1. Obter metadados do arquivo
  let nomeArquivo = `Arquivo_Drive_${fileId}`;
  let mimeType = 'text/plain';

  if (googleToken) {
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`, {
      headers: { Authorization: `Bearer ${googleToken}` },
      signal: AbortSignal.timeout(20_000),
    });

    if (metaRes.ok) {
      const meta = await metaRes.json().catch(() => null);
      if (meta?.name) nomeArquivo = meta.name;
      if (meta?.mimeType) mimeType = meta.mimeType;
    }
  }

  // 2. Exportação direta para Google Docs ou Google Sheets
  if (mimeType === 'application/vnd.google-apps.document' || mimeType.includes('document')) {
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
    const res = await fetch(exportUrl, {
      headers: googleToken ? { Authorization: `Bearer ${googleToken}` } : {},
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) {
      const texto = await res.text();
      return { titulo: nomeArquivo, conteudo: textoLimpo(texto, MAX_TEXT_CHARS), mimeType };
    }
  }

  if (mimeType === 'application/vnd.google-apps.spreadsheet' || mimeType.includes('spreadsheet')) {
    const exportUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`;
    const res = await fetch(exportUrl, {
      headers: googleToken ? { Authorization: `Bearer ${googleToken}` } : {},
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) {
      const csv = await res.text();
      return { titulo: nomeArquivo, conteudo: textoLimpo(csv, MAX_TEXT_CHARS), mimeType };
    }
  }

  // 3. Download direto via mídia (PDF, TXT, etc.)
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const dlRes = await fetch(downloadUrl, {
    headers: googleToken ? { Authorization: `Bearer ${googleToken}` } : {},
    signal: AbortSignal.timeout(45_000),
  });

  if (!dlRes.ok) {
    // Fallback: tentar rota pública de exportação de docs/sheets caso não haja token
    const publicDocUrl = `https://docs.google.com/document/d/${fileId}/export?format=txt`;
    const pubRes = await fetch(publicDocUrl, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (pubRes && pubRes.ok) {
      const texto = await pubRes.text();
      return { titulo: nomeArquivo, conteudo: textoLimpo(texto, MAX_TEXT_CHARS), mimeType: 'text/plain' };
    }
    throw new Error('google_drive_file_download_failed');
  }

  const blob = await dlRes.blob();
  const file = new File([blob], nomeArquivo, { type: mimeType });
  const conteudo = await extrairTextoArquivo(file, apiKeyOpenAI);
  return { titulo: nomeArquivo, conteudo, mimeType };
}

// Criação de Embeddings em Lote com OpenAI text-embedding-3-small
async function criarEmbeddingsEmLote(partes: string[], apiKey: string): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (let index = 0; index < partes.length; index += EMBEDDING_BATCH_SIZE) {
    const lote = partes.slice(index, index + EMBEDDING_BATCH_SIZE);
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: lote,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(data?.data)) {
      throw new Error('knowledge_embedding_failed');
    }

    const vetoresLote = data.data
      .map((item: { embedding?: unknown }) => item.embedding)
      .filter(Array.isArray);

    embeddings.push(...vetoresLote);
  }

  if (embeddings.length !== partes.length) {
    throw new Error('knowledge_embedding_count_mismatch');
  }

  return embeddings;
}

function vetorString(embedding: number[]): string {
  return `[${embedding.map((item) => Number(item)).join(',')}]`;
}

// Lista os documentos consolidados chamando a RPC ou fazendo agrupamento de fallback
async function listarDocumentos(admin: SupabaseClient): Promise<DocumentoResumo[]> {
  const { data: rpcData, error: rpcError } = await admin.rpc('listar_documentos_resumo');
  if (!rpcError && Array.isArray(rpcData)) {
    return rpcData.map((row: any) => ({
      id: Number(row.primeiro_id || 1),
      titulo: textoLimpo(row.titulo, 240) || 'Documento sem título',
      categoria: textoLimpo(row.categoria, 100) || 'Geral',
      origem: textoLimpo(row.origem, 50) || 'upload',
      drive_id: row.drive_id || null,
      partes: Number(row.total_partes || 1),
      total_caracteres: Number(row.total_caracteres || 0),
      criado_em: row.criado_em,
      atualizado_em: row.atualizado_em,
    }));
  }

  // Fallback caso a RPC não tenha sido aplicada ainda
  const { data, error } = await admin
    .from('documents')
    .select('id,titulo,metadata,created_at')
    .order('id', { ascending: false })
    .limit(5_000);

  if (error) throw new Error('knowledge_list_failed');

  const grouped = new Map<string, DocumentoResumo>();
  for (const row of (data || []) as Array<{
    id: number;
    titulo: string | null;
    metadata: Record<string, unknown> | null;
    created_at?: string;
  }>) {
    const titulo = textoLimpo(row.titulo, 240) || 'Documento sem título';
    const current = grouped.get(titulo);
    if (current) {
      current.partes += 1;
      continue;
    }
    grouped.set(titulo, {
      id: row.id,
      titulo,
      categoria: textoLimpo(row.metadata?.categoria, 100) || 'Geral',
      origem: textoLimpo(row.metadata?.origem, 50) || 'upload',
      drive_id: (row.metadata?.drive_id as string) || null,
      partes: 1,
      criado_em: row.created_at,
    });
  }
  return Array.from(grouped.values());
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRole) return json({ error: 'service_unavailable' }, 503);

  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!(await usuarioGestor(request, admin))) return json({ error: 'unauthorized' }, 401);

  const contentType = request.headers.get('content-type') || '';
  let action = '';
  let body: Record<string, unknown> = {};
  let form: FormData | null = null;

  try {
    if (contentType.includes('multipart/form-data')) {
      form = await request.formData();
      action = textoLimpo(form.get('action'), 30);
    } else {
      body = await request.json();
      action = textoLimpo(body.action, 30);
    }
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  const apiKey = await obterOpenAiKey(admin);

  try {
    // 1. Listagem de documentos
    if (action === 'listar') {
      return json({ documents: await listarDocumentos(admin) });
    }

    // 2. Estatísticas da base RAG
    if (action === 'stats') {
      const { data, error } = await admin.rpc('obter_estatisticas_rag');
      if (!error && data) {
        return json({ stats: data });
      }
      const docs = await listarDocumentos(admin);
      const totalPartes = docs.reduce((acc, d) => acc + d.partes, 0);
      return json({
        stats: {
          total_documentos: docs.length,
          total_chunks: totalPartes,
          total_caracteres: 0,
          origens: { upload: docs.length },
          categorias: {},
        },
      });
    }

    // 3. Listagem de chunks de um documento específico
    if (action === 'listar_chunks') {
      const titulo = textoLimpo(body.titulo, 240);
      if (!titulo) return json({ error: 'title_required' }, 400);

      const { data, error } = await admin.rpc('obter_chunks_documento', { p_titulo: titulo });
      if (!error && data) {
        return json({ chunks: data });
      }

      const { data: fallbackData, error: fallbackError } = await admin
        .from('documents')
        .select('id,content,metadata,created_at')
        .eq('titulo', titulo)
        .order('id', { ascending: true })
        .limit(100);

      if (fallbackError) throw new Error('knowledge_chunks_failed');
      return json({ chunks: fallbackData || [] });
    }

    // 4. Excluir documento por título ou drive_id
    if (action === 'excluir') {
      const titulo = textoLimpo(body.titulo, 240);
      const driveId = textoLimpo(body.drive_id, 120);

      if (!titulo && !driveId) return json({ error: 'title_or_drive_id_required' }, 400);

      let deleteQuery = admin.from('documents').delete();
      if (titulo) {
        deleteQuery = deleteQuery.eq('titulo', titulo);
      } else if (driveId) {
        deleteQuery = deleteQuery.contains('metadata', { drive_id: driveId });
      }

      const { error } = await deleteQuery;
      if (error) throw new Error('knowledge_delete_failed');
      return json({ ok: true });
    }

    // 5. Limpar toda a base
    if (action === 'limpar') {
      const { error } = await admin.from('documents').delete().not('id', 'is', null);
      if (error) throw new Error('knowledge_clear_failed');
      return json({ ok: true });
    }

    // 6. Testar RAG & Respostas diretamente no frontend
    if (action === 'testar_rag') {
      const pergunta = textoLimpo(body.pergunta, 1_000);
      if (!pergunta) return json({ error: 'query_required' }, 400);
      if (!apiKey) return json({ error: 'knowledge_not_configured' }, 503);

      const tInicio = performance.now();

      // Embedding da pergunta
      const embRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: pergunta }),
        signal: AbortSignal.timeout(20_000),
      });
      const embPayload = await embRes.json().catch(() => null);
      const queryVector = embPayload?.data?.[0]?.embedding;
      if (!embRes.ok || !Array.isArray(queryVector)) {
        throw new Error('knowledge_query_embedding_failed');
      }

      const tBuscaInicio = performance.now();
      const matchCount = Number(body.match_count) || 6;
      const similarityThreshold = Number(body.similarity_threshold) || 0.25;

      const { data: matchedDocs, error: matchError } = await admin.rpc('match_documents', {
        query_embedding: vetorString(queryVector),
        match_count: matchCount,
        filter: {},
        similarity_threshold: similarityThreshold,
      });

      const tBuscaFim = performance.now();
      if (matchError) throw new Error('knowledge_search_failed');

      const fontes = (matchedDocs || []).map((item: any) => ({
        id: item.id,
        titulo: textoLimpo(item.metadata?.arquivo || item.metadata?.titulo, 240) || 'Base de conhecimento',
        categoria: textoLimpo(item.metadata?.categoria, 100) || 'Geral',
        origem: textoLimpo(item.metadata?.origem, 50) || 'upload',
        conteudo: textoLimpo(item.content, 1_800),
        similaridade: Number((item.similarity || 0).toFixed(4)),
      }));

      // Montar a resposta com OpenAI usando o contexto dos documentos
      const contextoDocumentos = fontes.length
        ? fontes.map((f: any, idx: number) => `[Fonte ${idx + 1} - ${f.titulo} (${f.categoria})]:\n${f.conteudo}`).join('\n\n---\n\n')
        : 'Nenhum documento relevante encontrado na base.';

      // Nome da empresa e modelo vêm da configuração do atendimento (nada fixo no código).
      const { data: empresaCfg } = await admin.from('atendimento_config').select('nome_empresa,modelo_ia').eq('singleton', true).maybeSingle();
      const nomeEmpresa = String(empresaCfg?.nome_empresa || '').trim() || 'a empresa';
      const model = (empresaCfg?.modelo_ia as string | null) || segredo('MAIA_OPENAI_MODEL') || 'gpt-4.1-mini';
      const tIaInicio = performance.now();

      const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: `Você é a assistente virtual de ${nomeEmpresa}. Responda à dúvida do tutor com base EXCLUSIVAMENTE nas fontes fornecidas abaixo.
Se a informação não estiver presente nas fontes, informe educadamente que não encontrou essa informação e sugira entrar em contato com a recepção.
Seja concisa, clara e cordial.

Fontes da Base de Conhecimento:
${contextoDocumentos}`,
            },
            {
              role: 'user',
              content: pergunta,
            },
          ],
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      const tIaFim = performance.now();
      const aiData = await aiRes.json().catch(() => null);
      const resposta = aiData?.choices?.[0]?.message?.content || 'Não foi possível gerar a resposta.';

      return json({
        ok: true,
        pergunta,
        resposta,
        fontes,
        tempo_total_ms: Math.round(performance.now() - tInicio),
        tempo_busca_ms: Math.round(tBuscaFim - tBuscaInicio),
        tempo_ia_ms: Math.round(tIaFim - tIaInicio),
      });
    }

    // 7. Importar arquivo do Google Drive
    if (action === 'importar_drive') {
      const urlOuId = textoLimpo(body.file_id_or_url || body.url, 500);
      const categoria = textoLimpo(body.categoria || body.category, 100) || 'Geral';
      const tokenUsuario = typeof body.google_token === 'string' ? body.google_token : undefined;

      if (!urlOuId) return json({ error: 'drive_url_or_id_required' }, 400);
      if (!apiKey) return json({ error: 'knowledge_not_configured' }, 503);

      const driveId = extrairIdGoogleDrive(urlOuId);
      if (!driveId) return json({ error: 'invalid_drive_id_format' }, 400);

      const googleToken = await resolverGoogleAccessToken(tokenUsuario);

      const { titulo, conteudo, mimeType } = await obterConteudoGoogleDrive(driveId, googleToken, apiKey);
      if (!conteudo || conteudo.length < 10) {
        return json({ error: 'drive_file_empty_or_unreadable' }, 422);
      }

      const partes = dividirEmPartesInteligente(conteudo);
      if (!partes.length) return json({ error: 'drive_file_no_chunks' }, 422);

      const embeddings = await criarEmbeddingsEmLote(partes, apiKey);

      // Substituição atômica: remove versões anteriores com mesmo drive_id ou título
      await admin.from('documents').delete().or(`titulo.eq."${titulo}",metadata->>drive_id.eq."${driveId}"`);

      const agora = new Date().toISOString();
      const rows = partes.map((content, index) => ({
        titulo,
        content,
        embedding: vetorString(embeddings[index]),
        created_at: agora,
        updated_at: agora,
        metadata: {
          categoria,
          arquivo: titulo,
          origem: 'google_drive',
          drive_id: driveId,
          mime_type: mimeType,
          parte: index + 1,
          total_partes: partes.length,
          caracteres: content.length,
        },
      }));

      const { error: insertError } = await admin.from('documents').insert(rows);
      if (insertError) throw new Error('knowledge_insert_failed');

      return json({
        ok: true,
        titulo,
        partes: rows.length,
        origem: 'google_drive',
        drive_id: driveId,
        caracteres_totais: conteudo.length,
      });
    }

    // 8. Upload direto de arquivo pelo frontend
    if (action === 'enviar' && form) {
      const file = form.get('file');
      const categoria = textoLimpo(form.get('category') || form.get('categoria'), 100) || 'Geral';

      if (!(file instanceof File)) return json({ error: 'file_required' }, 400);
      if (!file.name || file.size <= 0 || file.size > MAX_FILE_BYTES) {
        return json({ error: 'invalid_file_size' }, 400);
      }
      if (!apiKey) return json({ error: 'knowledge_not_configured' }, 503);

      const conteudo = await extrairTextoArquivo(file, apiKey);
      if (conteudo.length < 5) return json({ error: 'file_has_no_extractable_text' }, 422);

      const partes = dividirEmPartesInteligente(conteudo);
      if (!partes.length) return json({ error: 'file_has_no_extractable_text' }, 422);

      const embeddings = await criarEmbeddingsEmLote(partes, apiKey);
      const titulo = textoLimpo(file.name, 240);

      // Substituição atômica por título
      await admin.from('documents').delete().eq('titulo', titulo);

      const agora = new Date().toISOString();
      const rows = partes.map((content, index) => ({
        titulo,
        content,
        embedding: vetorString(embeddings[index]),
        created_at: agora,
        updated_at: agora,
        metadata: {
          categoria,
          arquivo: titulo,
          origem: 'upload',
          tamanho_bytes: file.size,
          parte: index + 1,
          total_partes: partes.length,
          caracteres: content.length,
        },
      }));

      const { error: insertError } = await admin.from('documents').insert(rows);
      if (insertError) throw new Error('knowledge_insert_failed');

      return json({
        ok: true,
        titulo,
        partes: rows.length,
        origem: 'upload',
        caracteres_totais: conteudo.length,
      });
    }

    return json({ error: 'unsupported_action' }, 400);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'knowledge_failed';
    console.error('knowledge_error', code);
    return json({ error: code.slice(0, 100) }, 500);
  }
});
