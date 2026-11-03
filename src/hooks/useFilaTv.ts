/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { urlPublicaFila } from '@/hooks/useFilaConfig';
import type { TvMidia, TvPainel } from '@/types/filaConfig';

const db = supabase as never as { rpc: (fn: string) => any };

const POLL_MS = 20_000;
const DEBOUNCE_MS = 250;
// Em modo "banco antigo", a cada tantas consultas tenta de novo o RPC novo (a migração pode ter sido aplicada).
const REVERIFICAR_A_CADA = 15;

type LinhaLegado = { senha: string; pet_nome: string | null; veterinario_nome: string | null; sala: string | null; status: string; chamado_em: string | null };

const funcaoAusente = (erro: { code?: string; message?: string } | null) =>
  !!erro && (erro.code === 'PGRST202' || erro.code === '42883' || /could not find the function|does not exist/i.test(erro.message ?? ''));

/**
 * Painel montado a partir do RPC ANTIGO (fila_tv_estado), para a TV não ficar em branco se o front for publicado
 * antes de aplicar a migração v2. Sem vídeos, sem recentes e com o visual padrão: é só um quebra-galho.
 */
function painelDoBancoAntigo(linhas: LinhaLegado[]): TvPainel {
  const chamados = linhas.filter((l) => l.status === 'chamado');
  const aguardando = linhas.filter((l) => l.status === 'aguardando');
  const chamada = (l: LinhaLegado) => ({
    id: `${l.senha}`, senha: l.senha, chamado_em: l.chamado_em, sala: l.sala, pet: l.pet_nome, tutor: null, veterinario: l.veterinario_nome,
  });
  return {
    config: {
      nome: 'Atendimento', subtitulo: 'Painel de Atendimento Presencial', cor_marca: '#2294aa', logo_path: null, tv_som: true,
      tv_privacidade: false, tv_layout: 'lateral', tv_video_mudo: true, tv_aviso_segundos: 12,
    },
    atual: chamados[0] ? chamada(chamados[0]) : null,
    recentes: chamados.slice(1, 5).map(chamada),
    proximos: aguardando.slice(0, 8).map((l) => ({ id: l.senha, senha: l.senha, prioridade: 'normal' as const, pet: l.pet_nome })),
    aguardando: aguardando.length,
    midias: [],
    agora: new Date().toISOString(),
  };
}

/**
 * Estado da TV. Funciona SEM login (a TV é pública): lê o RPC fila_tv_painel(), que no servidor já
 * remove nomes quando a privacidade está ligada. Atualiza na hora por Broadcast (tópico 'fila-tv',
 * sem dados pessoais) e, como rede de segurança, a cada 20 s, ao voltar a aba e ao reconectar.
 */
export function useFilaTv() {
  const [painel, setPainel] = useState<TvPainel | null>(null);
  const [offline, setOffline] = useState(false);
  const falhasSeguidas = useRef(0);
  const emVoo = useRef(false);
  const bancoAntigo = useRef(false);
  const consultas = useRef(0);

  const carregar = useCallback(async () => {
    if (emVoo.current) return;
    emVoo.current = true;
    try {
      consultas.current += 1;
      const tentarNovo = !bancoAntigo.current || consultas.current % REVERIFICAR_A_CADA === 0;
      let resultado: TvPainel | null = null;
      if (tentarNovo) {
        const { data, error } = await db.rpc('fila_tv_painel');
        if (!error) {
          bancoAntigo.current = false;
          resultado = data as TvPainel;
        } else if (!funcaoAusente(error)) {
          throw error;
        } else {
          bancoAntigo.current = true;
        }
      }
      if (!resultado) {
        const { data, error } = await db.rpc('fila_tv_estado');
        if (error) throw error;
        resultado = painelDoBancoAntigo((data ?? []) as LinhaLegado[]);
      }
      setPainel(resultado);
      falhasSeguidas.current = 0;
      setOffline(false);
    } catch (err) {
      falhasSeguidas.current += 1;
      // Uma falha isolada (Wi-Fi da TV) não pisca a faixa vermelha.
      if (falhasSeguidas.current >= 2) setOffline(true);
      console.warn('Painel da TV: falha ao atualizar', err);
    } finally {
      emVoo.current = false;
    }
  }, []);

  useEffect(() => {
    carregar();

    let adiar: number | undefined;
    const aoReceberTick = () => {
      window.clearTimeout(adiar);
      adiar = window.setTimeout(carregar, DEBOUNCE_MS);
    };

    const canal = supabase
      .channel('fila-tv')
      .on('broadcast', { event: 'tick' }, aoReceberTick)
      .subscribe((status) => {
        // Ao (re)conectar, sincroniza: pode ter havido chamada enquanto estava fora.
        if (status === 'SUBSCRIBED') carregar();
      });

    const intervalo = window.setInterval(carregar, POLL_MS);
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') carregar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('online', carregar);

    return () => {
      window.clearTimeout(adiar);
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('online', carregar);
      supabase.removeChannel(canal);
    };
  }, [carregar]);

  const midias = useMemo<TvMidia[]>(
    () =>
      (painel?.midias ?? [])
        .map((m) => ({ id: m.id, nome: m.nome, url: m.url || urlPublicaFila(m.path) || '', tamanhoBytes: m.url ? 0 : Number(m.tamanho) || 0 }))
        .filter((m) => m.url),
    [painel?.midias],
  );

  return { painel, midias, offline, carregando: painel === null };
}
