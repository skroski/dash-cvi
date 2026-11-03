import { useCallback, useEffect, useRef, useState } from 'react';
import type { TvMidia } from '@/types/filaConfig';

const CACHE_VIDEOS = 'fila-tv-videos-v1';
// Vídeos pequenos ficam guardados no aparelho: a partir da 2ª volta da playlist não gastam tráfego.
const LIMITE_CACHE_BYTES = 100 * 1024 * 1024;

/** Fonte do vídeo: do cache do aparelho se já estiver lá; senão direto da URL (e aquece o cache em segundo plano). */
async function resolverFonte(midia: TvMidia): Promise<{ src: string; revogar?: () => void }> {
  const cacheavel = typeof caches !== 'undefined' && midia.tamanhoBytes && midia.tamanhoBytes <= LIMITE_CACHE_BYTES;
  if (!cacheavel) return { src: midia.url };
  try {
    const cache = await caches.open(CACHE_VIDEOS);
    const guardado = await cache.match(midia.url);
    if (guardado) {
      const objeto = URL.createObjectURL(await guardado.blob());
      return { src: objeto, revogar: () => URL.revokeObjectURL(objeto) };
    }
    cache.add(midia.url).catch(() => {});
  } catch {
    /* sem Cache API (navegador da TV): toca direto */
  }
  return { src: midia.url };
}

/** Remove do cache do aparelho os vídeos que saíram da playlist. */
async function limparCache(urlsAtuais: string[]) {
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(CACHE_VIDEOS);
    for (const requisicao of await cache.keys()) {
      if (!urlsAtuais.includes(requisicao.url)) await cache.delete(requisicao);
    }
  } catch {
    /* melhor esforço */
  }
}

/**
 * Playlist de vídeos da TV: toca em sequência e volta ao início (loop infinito).
 * Começa mudo (navegadores só liberam autoplay sem som); se um vídeo falhar, pula para o próximo.
 */
export default function TvVideo({
  playlist,
  muted,
  duck,
  className = '',
  fit = 'contain',
}: {
  playlist: TvMidia[];
  muted: boolean;
  /** Abaixa o volume durante o aviso de chamada */
  duck: boolean;
  className?: string;
  fit?: 'contain' | 'cover';
}) {
  const [indice, setIndice] = useState(0);
  const [fonte, setFonte] = useState<string | null>(null);
  const [pausado, setPausado] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const errosSeguidos = useRef(0);

  const atual = playlist.length ? playlist[indice % playlist.length] : null;
  const chavePlaylist = playlist.map((m) => m.url).join('|');

  // Playlist encolheu (vídeo desativado/excluído): garante um índice válido.
  useEffect(() => {
    if (indice >= playlist.length) setIndice(0);
  }, [playlist.length, indice]);

  useEffect(() => {
    limparCache(chavePlaylist ? chavePlaylist.split('|').map((u) => new URL(u, window.location.href).href) : []);
  }, [chavePlaylist]);

  // Resolve a fonte do vídeo atual (cache do aparelho ou rede).
  useEffect(() => {
    if (!atual) {
      setFonte(null);
      return;
    }
    let cancelado = false;
    let revogar: (() => void) | undefined;
    resolverFonte(atual).then((resolvida) => {
      if (cancelado) return resolvida.revogar?.();
      revogar = resolvida.revogar;
      setFonte(resolvida.src);
    });
    return () => {
      cancelado = true;
      revogar?.();
      setFonte(null);
    };
  }, [atual?.id, atual?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  const proximo = useCallback(() => setIndice((i) => (playlist.length ? (i + 1) % playlist.length : 0)), [playlist.length]);

  const aoFalhar = () => {
    errosSeguidos.current += 1;
    if (errosSeguidos.current >= playlist.length) {
      // Nenhum vídeo toca (formato/codec não suportado pela TV): espera e tenta de novo.
      errosSeguidos.current = 0;
      setPausado(true);
      window.setTimeout(() => {
        setPausado(false);
        proximo();
      }, 30_000);
      return;
    }
    proximo();
  };

  useEffect(() => {
    const video = ref.current;
    if (video) video.volume = duck ? 0.12 : 1;
  }, [duck, fonte]);

  const aoCarregar = () => {
    const video = ref.current;
    if (!video) return;
    video.muted = muted;
    video.play().catch(() => {
      // Sem permissão para tocar com som: cai para mudo em vez de travar.
      video.muted = true;
      video.play().catch(() => {});
    });
  };

  if (!atual) return null;

  if (pausado) {
    return (
      <div className={`${className} flex items-center justify-center bg-black text-sm text-white/60`}>
        Não foi possível reproduzir os vídeos. Use MP4 (H.264/AAC).
      </div>
    );
  }

  if (!fonte) return <div className={`${className} bg-black`} />;

  return (
    <video
      key={`${atual.id}-${fonte}`}
      ref={ref}
      src={fonte}
      className={`${className} bg-black ${fit === 'cover' ? 'object-cover' : 'object-contain'}`}
      autoPlay
      muted={muted}
      playsInline
      preload="auto"
      loop={playlist.length === 1}
      onLoadedData={aoCarregar}
      onPlaying={() => {
        errosSeguidos.current = 0;
      }}
      onEnded={proximo}
      onError={aoFalhar}
    />
  );
}
