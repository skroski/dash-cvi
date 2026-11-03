// Supabase Edge Function: arquivar-midias
//
// Copia para o bucket privado `conversa-midias` os bytes dos arquivos que hoje
// só existem no servidor da Uazapi.
//
// POR QUE SERVER-SIDE: o navegador não consegue baixar a `fileURL` da Uazapi
// (o host de arquivos dela não libera CORS), e mesmo que liberasse, cada painel
// aberto refaria o mesmo download. Aqui a cópia acontece uma vez, com
// service_role, perto do Storage.
//
// ENTRADA:  POST { "sessionId": "5511999999999@s.whatsapp.net" }
//           Sem sessionId, processa a fila global (útil para um cron).
// SAÍDA:    { arquivadas, falhas, restantes }
//
// DEPLOY:   supabase functions deploy arquivar-midias
// SEGREDOS: supabase secrets set UAZAPI_INSTANCE_TOKEN=<token>
//           (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm do runtime)
//
// A função exige JWT válido (padrão do runtime): quem chama é o painel logado.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { segredo } from '../_shared/segredos.ts';

const BUCKET = 'conversa-midias';

// Teto por invocação: mantém a execução dentro do tempo da edge function.
// A fila drena ao longo das próximas aberturas de conversa.
const MAX_POR_EXECUCAO = 15;

// Acima disso o objeto não cabe no bucket (limite de 20MB na migração).
const MAX_BYTES = 20 * 1024 * 1024;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/** Chaves do Storage aceitam um conjunto restrito de caracteres; JID tem '@'. */
const sanitizeKey = (valor: string): string =>
  valor.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'sem_id';

/** Extensão a partir do MIME, para o arquivo abrir no sistema operacional. */
const extensaoPorMime = (mime: string): string => {
  const mapa: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/webm': '.webm',
    'video/mp4': '.mp4',
    'application/pdf': '.pdf',
  };
  return mapa[mime.split(';')[0].trim()] || '';
};

interface MidiaPendente {
  id: number;
  session_id: string;
  message_id: string;
  tipo: string;
  nome_arquivo: string | null;
  mime_type: string | null;
  uazapi_url: string;
  ocorrido_em: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Runtime sem SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  const uazapiToken = segredo('UAZAPI_INSTANCE_TOKEN') || '';
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let sessionId: string | undefined;
  try {
    const body = await req.json();
    sessionId = typeof body?.sessionId === 'string' ? body.sessionId : undefined;
  } catch {
    // Sem corpo: processa a fila global.
  }

  // Fila: mais antigas primeiro, para que o histórico em risco de expirar no
  // provedor seja o primeiro a ganhar cópia.
  let query = supabase
    .from('conversa_midias')
    .select('id, session_id, message_id, tipo, nome_arquivo, mime_type, uazapi_url, ocorrido_em')
    .is('storage_path', null)
    .not('uazapi_url', 'is', null)
    .order('ocorrido_em', { ascending: true })
    .limit(MAX_POR_EXECUCAO);

  if (sessionId) query = query.eq('session_id', sessionId);

  const { data, error } = await query;
  if (error) {
    return json({ error: `Falha ao ler a fila: ${error.message}` }, 500);
  }

  const pendentes = (data || []) as MidiaPendente[];
  let arquivadas = 0;
  let falhas = 0;

  for (const midia of pendentes) {
    try {
      const resposta = await fetch(midia.uazapi_url, {
        headers: uazapiToken ? { token: uazapiToken } : {},
      });
      if (!resposta.ok) {
        // 404/403 aqui costuma significar que o provedor já expirou o arquivo:
        // não há o que copiar, e a linha do catálogo continua como registro de
        // que a mídia existiu.
        console.warn(`Download falhou (${resposta.status}) para midia ${midia.id}`);
        falhas++;
        continue;
      }

      const bytes = new Uint8Array(await resposta.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
        console.warn(`Tamanho fora do aceito (${bytes.byteLength}) na midia ${midia.id}`);
        falhas++;
        continue;
      }

      const contentType =
        resposta.headers.get('content-type') || midia.mime_type || 'application/octet-stream';
      const nome = midia.nome_arquivo || `${midia.tipo}${extensaoPorMime(contentType)}`;
      const ocorrido = new Date(midia.ocorrido_em);
      const pasta = `${ocorrido.getUTCFullYear()}-${String(ocorrido.getUTCMonth() + 1).padStart(2, '0')}`;
      const caminho = `${sanitizeKey(midia.session_id)}/${pasta}/${sanitizeKey(midia.message_id)}-${sanitizeKey(nome)}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(caminho, bytes, { contentType, upsert: true });

      if (uploadError) {
        console.warn(`Upload falhou na midia ${midia.id}: ${uploadError.message}`);
        falhas++;
        continue;
      }

      const { error: updateError } = await supabase
        .from('conversa_midias')
        .update({
          storage_path: caminho,
          arquivada_em: new Date().toISOString(),
          mime_type: midia.mime_type || contentType,
          tamanho_bytes: bytes.byteLength,
          nome_arquivo: nome,
        })
        .eq('id', midia.id);

      if (updateError) {
        console.warn(`Catálogo não atualizado na midia ${midia.id}: ${updateError.message}`);
        falhas++;
        continue;
      }

      arquivadas++;
    } catch (err) {
      console.warn(`Erro inesperado na midia ${midia.id}:`, err);
      falhas++;
    }
  }

  // `restantes` só é exato quando havia mais que MAX_POR_EXECUCAO na fila.
  return json({
    arquivadas,
    falhas,
    restantes: pendentes.length === MAX_POR_EXECUCAO ? 'mais' : 0,
  });
});
