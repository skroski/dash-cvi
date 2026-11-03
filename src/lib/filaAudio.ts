// Sinal sonoro da chamada (Web Audio API): nenhum arquivo de áudio para baixar.
// Dois tons harmônicos (Ré5 e Lá5), agradáveis em sala de espera.

let contexto: AudioContext | null = null;

function obterContexto(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    const Classe =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Classe) return null;
    if (!contexto || contexto.state === 'closed') contexto = new Classe();
    if (contexto.state === 'suspended') contexto.resume().catch(() => {});
    return contexto;
  } catch (err) {
    console.warn('Web Audio API indisponível:', err);
    return null;
  }
}

function tom(ctx: AudioContext, frequencia: number, inicio: number, duracao: number, volume: number) {
  const osc = ctx.createOscillator();
  const ganho = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(frequencia, inicio);
  ganho.gain.setValueAtTime(volume, inicio);
  ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);
  osc.connect(ganho);
  ganho.connect(ctx.destination);
  osc.start(inicio);
  osc.stop(inicio + duracao);
}

/** Toca o sinal da chamada. Devolve false se o navegador não permitiu. */
export function tocarSinalFila(): boolean {
  const ctx = obterContexto();
  if (!ctx) return false;
  const t = ctx.currentTime;
  tom(ctx, 587.33, t, 0.55, 0.28); // Ré5
  tom(ctx, 880.0, t + 0.22, 0.93, 0.38); // Lá5
  return true;
}

/** Navegadores só liberam áudio depois de um toque/clique: chame isso no primeiro gesto. */
export function desbloquearAudioFila(): void {
  const ctx = obterContexto();
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
}
