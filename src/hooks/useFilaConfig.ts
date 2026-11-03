/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ENV_DEFAULTS } from '@/config/env';
import { FILA_CONFIG_PADRAO, type FilaConfig, type FilaMidia } from '@/types/filaConfig';

// Tipos gerados pelo Supabase só conhecem fila_config/fila_midias depois de `supabase gen types`.
const db = supabase as never as { from: (table: string) => any };

export const BUCKET_FILA = 'fila-midias';
export const LIMITE_VIDEO_MB = 500;
const LIMITE_LOGO_MB = 5;
const TIPOS_VIDEO = ['video/mp4', 'video/webm'];
const TIPOS_LOGO = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

/** URL pública de um arquivo do bucket da fila (a TV não tem login, então o bucket é de leitura pública). */
export function urlPublicaFila(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(BUCKET_FILA).getPublicUrl(path).data.publicUrl;
}

// camelCase (front) <-> snake_case (banco)
const CAMPOS: Record<keyof FilaConfig, string> = {
  nomeExibicao: 'nome_exibicao',
  subtitulo: 'subtitulo',
  corMarca: 'cor_marca',
  logoPath: 'logo_path',
  tvSom: 'tv_som',
  tvPrivacidade: 'tv_privacidade',
  tvLayout: 'tv_layout',
  tvVideoMudo: 'tv_video_mudo',
  tvAvisoSegundos: 'tv_aviso_segundos',
  tvMostrarTutor: 'tv_mostrar_tutor',
  cupomLarguraMm: 'cupom_largura_mm',
  cupomRodape: 'cupom_rodape',
  cupomLogo: 'cupom_logo',
  numeracaoDiaria: 'numeracao_diaria',
  fusoHorario: 'fuso_horario',
  totemPedeTelefone: 'totem_pede_telefone',
  whatsappAtivo: 'whatsapp_ativo',
  wppSomenteConhecidos: 'wpp_somente_conhecidos',
  wppAvisarEmissao: 'wpp_avisar_emissao',
  wppAvisarProximo: 'wpp_avisar_proximo',
  wppAvisarChamada: 'wpp_avisar_chamada',
  wppAvisarAusente: 'wpp_avisar_ausente',
  wppMsgEmissao: 'wpp_msg_emissao',
  wppMsgProximo: 'wpp_msg_proximo',
  wppMsgChamada: 'wpp_msg_chamada',
  wppMsgAusente: 'wpp_msg_ausente',
};

function mapConfig(linha: Record<string, any>): FilaConfig {
  const config: Record<string, unknown> = { ...FILA_CONFIG_PADRAO };
  for (const [camel, snake] of Object.entries(CAMPOS)) {
    if (linha[snake] !== undefined) config[camel] = linha[snake];
  }
  return config as unknown as FilaConfig;
}

function paraLinha(parcial: Partial<FilaConfig>): Record<string, unknown> {
  const linha: Record<string, unknown> = {};
  for (const [camel, valor] of Object.entries(parcial)) {
    const snake = CAMPOS[camel as keyof FilaConfig];
    if (snake) linha[snake] = valor;
  }
  return linha;
}

const mapMidia = (r: any): FilaMidia => ({
  id: r.id,
  nome: r.nome,
  arquivoPath: r.arquivo_path,
  urlExterna: r.url_externa,
  tamanhoBytes: Number(r.tamanho_bytes ?? 0),
  ordem: r.ordem,
  ativo: r.ativo,
});

export function urlDaMidia(m: Pick<FilaMidia, 'arquivoPath' | 'urlExterna'>): string | null {
  return m.urlExterna || urlPublicaFila(m.arquivoPath);
}

/** Configuração da fila (marca, TV, cupom, numeração e WhatsApp). Só gestor altera. */
export function useFilaConfig() {
  const client = useQueryClient();

  const query = useQuery({
    queryKey: ['fila-config'],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await db.from('fila_config').select('*').eq('singleton', true).maybeSingle();
      if (error) throw error;
      return data ? mapConfig(data) : FILA_CONFIG_PADRAO;
    },
  });

  const atualizar = useMutation({
    mutationFn: async (parcial: Partial<FilaConfig>) => {
      const { data, error } = await db
        .from('fila_config')
        .update(paraLinha(parcial))
        .eq('singleton', true)
        .select('id');
      if (error) throw error;
      // RLS devolve 0 linhas (sem erro) quando quem salva não é gestor.
      if (!data?.length) throw new Error('Sem permissão para alterar a configuração da fila.');
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['fila-config'] }),
  });

  const logoUrl = useMemo(() => urlPublicaFila(query.data?.logoPath), [query.data?.logoPath]);

  return { config: query.data ?? FILA_CONFIG_PADRAO, logoUrl, isLoading: query.isLoading, error: query.error, atualizar };
}

/** Envio com barra de progresso (o supabase-js não informa progresso de upload). */
async function enviarArquivo(path: string, file: File, onProgress?: (percentual: number) => void): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Entre novamente.');

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${ENV_DEFAULTS.SUPABASE_URL}/storage/v1/object/${BUCKET_FILA}/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', ENV_DEFAULTS.SUPABASE_ANON_KEY);
    xhr.setRequestHeader('x-upsert', 'false');
    // Nome do arquivo é único e nunca muda: pode ficar um ano no cache do navegador/CDN (economiza tráfego).
    xhr.setRequestHeader('cache-control', 'max-age=31536000');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let mensagem = 'Falha no envio do arquivo.';
      try {
        const corpo = JSON.parse(xhr.responseText);
        if (/exceeded the maximum allowed size|Payload too large/i.test(corpo.message || corpo.error || '')) {
          mensagem = 'Arquivo maior que o limite do Storage do projeto. Reduza o vídeo ou use uma URL externa.';
        } else if (xhr.status === 403 || xhr.status === 401) {
          mensagem = 'Sem permissão para enviar arquivos (só gestores).';
        } else if (corpo.message) {
          mensagem = String(corpo.message);
        }
      } catch {
        /* corpo não era JSON */
      }
      reject(new Error(mensagem));
    };
    xhr.onerror = () => reject(new Error('Sem conexão durante o envio.'));
    xhr.send(file);
  });
}

const extensao = (arquivo: File) => (arquivo.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
const nomeSemExtensao = (arquivo: File) => arquivo.name.replace(/\.[^.]+$/, '').slice(0, 120) || 'Vídeo';

/** Playlist de vídeos da TV e logotipo (gestor). */
export function useFilaMidias() {
  const client = useQueryClient();

  const query = useQuery({
    queryKey: ['fila-midias'],
    queryFn: async () => {
      const { data, error } = await db.from('fila_midias').select('*').order('ordem').order('created_at');
      if (error) throw error;
      return (data || []).map(mapMidia) as FilaMidia[];
    },
  });

  const invalidar = () => client.invalidateQueries({ queryKey: ['fila-midias'] });
  const midias = query.data ?? [];

  const enviarVideo = useMutation({
    mutationFn: async (input: { arquivo: File; onProgress?: (percentual: number) => void }) => {
      const { arquivo } = input;
      if (!TIPOS_VIDEO.includes(arquivo.type)) throw new Error(`"${arquivo.name}": use MP4 (H.264/AAC) ou WebM.`);
      if (arquivo.size > LIMITE_VIDEO_MB * 1024 * 1024) throw new Error(`"${arquivo.name}" passa de ${LIMITE_VIDEO_MB} MB.`);
      const path = `videos/${crypto.randomUUID()}.${extensao(arquivo)}`;
      await enviarArquivo(path, arquivo, input.onProgress);
      const { error } = await db.from('fila_midias').insert({
        nome: nomeSemExtensao(arquivo),
        arquivo_path: path,
        tamanho_bytes: arquivo.size,
        ordem: (midias.reduce((maior, m) => Math.max(maior, m.ordem), 0) || 0) + 1,
      });
      if (error) {
        await supabase.storage.from(BUCKET_FILA).remove([path]);
        throw error;
      }
    },
    onSuccess: invalidar,
  });

  const adicionarUrl = useMutation({
    mutationFn: async (input: { nome: string; url: string }) => {
      if (!/^https?:\/\//i.test(input.url)) throw new Error('A URL precisa começar com http:// ou https://');
      const { error } = await db.from('fila_midias').insert({
        nome: input.nome.trim() || 'Vídeo externo',
        url_externa: input.url.trim(),
        ordem: (midias.reduce((maior, m) => Math.max(maior, m.ordem), 0) || 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  const alternar = useMutation({
    mutationFn: async (input: { id: string; ativo: boolean }) => {
      const { error } = await db.from('fila_midias').update({ ativo: input.ativo }).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  const renomear = useMutation({
    mutationFn: async (input: { id: string; nome: string }) => {
      const nome = input.nome.trim();
      if (!nome) throw new Error('Informe um nome.');
      const { error } = await db.from('fila_midias').update({ nome }).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  const mover = useMutation({
    mutationFn: async (input: { id: string; direcao: -1 | 1 }) => {
      const indice = midias.findIndex((m) => m.id === input.id);
      const vizinho = midias[indice + input.direcao];
      if (indice < 0 || !vizinho) return;
      const atual = midias[indice];
      // Reatribui as posições de toda a lista: evita empate quando duas mídias têm a mesma ordem.
      const nova = midias.map((m) => m.id);
      nova[indice] = vizinho.id;
      nova[indice + input.direcao] = atual.id;
      const resultados = await Promise.all(
        nova.map((id, posicao) => db.from('fila_midias').update({ ordem: posicao + 1 }).eq('id', id)),
      );
      const falha = resultados.find((r: any) => r.error);
      if (falha) throw falha.error;
    },
    onSuccess: invalidar,
  });

  const remover = useMutation({
    mutationFn: async (midia: FilaMidia) => {
      const { error } = await db.from('fila_midias').delete().eq('id', midia.id);
      if (error) throw error;
      if (midia.arquivoPath) await supabase.storage.from(BUCKET_FILA).remove([midia.arquivoPath]);
    },
    onSuccess: invalidar,
  });

  return { midias, isLoading: query.isLoading, enviarVideo, adicionarUrl, alternar, renomear, mover, remover };
}

/** Envia o logotipo e devolve o caminho no bucket (o chamador grava em fila_config.logo_path). */
export async function enviarLogoFila(arquivo: File): Promise<string> {
  if (!TIPOS_LOGO.includes(arquivo.type)) throw new Error('Use PNG, JPG, WebP ou SVG.');
  if (arquivo.size > LIMITE_LOGO_MB * 1024 * 1024) throw new Error(`O logotipo passa de ${LIMITE_LOGO_MB} MB.`);
  const path = `marca/logo-${Date.now()}.${extensao(arquivo)}`;
  await enviarArquivo(path, arquivo);
  return path;
}

export async function removerArquivoFila(path: string | null | undefined): Promise<void> {
  if (path) await supabase.storage.from(BUCKET_FILA).remove([path]);
}
