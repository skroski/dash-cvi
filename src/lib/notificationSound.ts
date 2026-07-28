/**
 * Som e preferências de notificação do dashboard.
 *
 * O sinal sonoro é gerado via Web Audio API (sem depender de arquivos de
 * áudio) e as preferências ficam em localStorage, compartilhadas entre os
 * componentes através de useNotificationSettings (useSyncExternalStore).
 */

const STORAGE_KEY = 'vetbots-notification-settings';
const SETTINGS_EVENT = 'vetbots:notification-settings';

export interface NotificationSettings {
  /** Sinal sonoro ao receber novas mensagens/notificações. */
  soundEnabled: boolean;
  /** Notificações nativas do navegador quando a aba está em segundo plano. */
  browserEnabled: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  soundEnabled: true,
  browserEnabled: false,
};

let cached: NotificationSettings | null = null;

export function getNotificationSettings(): NotificationSettings {
  if (cached) return cached;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    cached = saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
  } catch {
    cached = { ...DEFAULT_SETTINGS };
  }
  return cached;
}

export function updateNotificationSettings(patch: Partial<NotificationSettings>) {
  cached = { ...getNotificationSettings(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // modo privado/quota: mantém a preferência apenas em memória
  }
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

export function subscribeNotificationSettings(callback: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cached = null; // outra aba alterou: recarrega do localStorage
      callback();
    }
  };
  window.addEventListener(SETTINGS_EVENT, callback);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(SETTINGS_EVENT, callback);
    window.removeEventListener('storage', onStorage);
  };
}

// ─── Sinal sonoro ───

let audioContext: AudioContext | null = null;
let lastChimeAt = 0;
// Evita rajada de bipes quando várias mensagens chegam de uma vez
const MIN_CHIME_INTERVAL_MS = 1500;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioContext) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioContext = new Ctor();
    }
    if (audioContext.state === 'suspended') {
      // Política de autoplay: só desbloqueia após interação do usuário
      void audioContext.resume().catch(() => undefined);
    }
    return audioContext;
  } catch {
    return null;
  }
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  peakGain: number
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(peakGain, startAt + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.05);
}

export type ChimeKind = 'message' | 'system';

/** Toca o sinal sonoro de notificação, respeitando a preferência de mudo. */
export function playNotificationChime(kind: ChimeKind = 'message') {
  if (!getNotificationSettings().soundEnabled) return;

  const now = Date.now();
  if (now - lastChimeAt < MIN_CHIME_INTERVAL_MS) return;
  lastChimeAt = now;

  const ctx = getAudioContext();
  if (!ctx) return;

  const t = ctx.currentTime;
  if (kind === 'message') {
    // Dois toques ascendentes, estilo mensageiro
    playTone(ctx, 830, t, 0.18, 0.12);
    playTone(ctx, 1244, t + 0.12, 0.22, 0.12);
  } else {
    // Toque único, mais discreto, para avisos do sistema
    playTone(ctx, 988, t, 0.2, 0.08);
  }
}

/** Toca o som ignorando o intervalo mínimo — usado como confirmação ao reativar. */
export function previewNotificationChime() {
  lastChimeAt = 0;
  playNotificationChime('message');
}
