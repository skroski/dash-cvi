import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Intervalo de heartbeat — também é o teto de segundos aceito por chamada em
// registrar_atividade() (com folga), então os dois lados precisam concordar.
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_INTERVAL_SECONDS = 120;

const isForeground = (): boolean => document.visibilityState === 'visible' && document.hasFocus();

/**
 * Mede o tempo com a aba do painel visível e em primeiro plano, e reporta em
 * blocos de até HEARTBEAT_INTERVAL_MS via RPC (registrar_atividade). O
 * intervalo só roda enquanto a aba está em primeiro plano — ao perder foco ou
 * ficar oculta, o bloco parcial é enviado e o relógio para, então nenhum
 * tempo em segundo plano é contado.
 */
export function useActivityHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let intervalId: number | null = null;
    let lastTick = Date.now();

    const flush = () => {
      const now = Date.now();
      const elapsed = Math.round((now - lastTick) / 1000);
      lastTick = now;
      if (elapsed > 0 && elapsed <= MAX_INTERVAL_SECONDS) {
        supabase.rpc('registrar_atividade', { p_segundos: elapsed }).then(({ error }) => {
          if (error) console.warn('Falha ao registrar atividade:', error);
        });
      }
    };

    const start = () => {
      if (intervalId != null) return;
      lastTick = Date.now();
      intervalId = window.setInterval(flush, HEARTBEAT_INTERVAL_MS);
    };

    const stop = () => {
      if (intervalId == null) return;
      flush();
      window.clearInterval(intervalId);
      intervalId = null;
    };

    const sync = () => {
      if (isForeground()) start();
      else stop();
    };

    sync();

    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('blur', sync);
    window.addEventListener('beforeunload', flush);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('blur', sync);
      window.removeEventListener('beforeunload', flush);
    };
  }, [enabled]);
}
