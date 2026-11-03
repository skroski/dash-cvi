/**
 * Provedor progressivo de narração por voz (Fish Audio MP3 + fallback nativo SpeechSynthesis PT-BR).
 * Zero dependências externas no bundle, com áudio de alta fidelidade e fallback gracioso.
 */

function cleanHtmlToText(html: string): string {
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, ' ');
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return (temp.textContent || temp.innerText || '').replace(/\s+/g, ' ').trim();
}

class SpeechNarrationProvider {
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private isMuted: boolean = false;
  private activeVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.initVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.initVoices();
      };
    }
  }

  private initVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    const ptVoices = voices.filter(
      (v) => v.lang.toLowerCase().startsWith('pt-br') || v.lang.toLowerCase().startsWith('pt')
    );
    this.activeVoice =
      ptVoices.find(
        (v) =>
          !v.localService ||
          v.name.toLowerCase().includes('natural') ||
          v.name.toLowerCase().includes('google')
      ) ||
      ptVoices[0] ||
      null;
  }

  public isSupported(): boolean {
    return typeof window !== 'undefined';
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (muted) {
      this.stop();
    }
  }

  public isSpeaking(): boolean {
    if (this.currentAudio && !this.currentAudio.paused && !this.currentAudio.ended) {
      return true;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return window.speechSynthesis.speaking;
    }
    return false;
  }

  public speak(
    content: string,
    options?: {
      tourId?: string;
      stepId?: string;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: () => void;
    }
  ): void {
    if (this.isMuted) {
      options?.onEnd?.();
      return;
    }

    this.stop();

    const plainText = cleanHtmlToText(content).trim();
    if (!plainText) {
      options?.onEnd?.();
      return;
    }

    // 1. Tenta carregar o áudio pré-renderizado do Fish Audio se houver tourId e stepId
    if (options?.tourId && options?.stepId) {
      const audioUrl = `/audio/tours/${options.tourId}/${options.stepId}.mp3`;
      const audio = new Audio(audioUrl);

      audio.onplay = () => {
        options?.onStart?.();
      };

      audio.onended = () => {
        this.currentAudio = null;
        options?.onEnd?.();
      };

      audio.onerror = () => {
        // Fallback imediato para síntese nativa do navegador se o arquivo MP3 não existir
        this.currentAudio = null;
        this.speakNative(plainText, options);
      };

      this.currentAudio = audio;
      audio.play().catch(() => {
        this.currentAudio = null;
        this.speakNative(plainText, options);
      });
      return;
    }

    // 2. Se não houver arquivo específico, roda a síntese nativa
    this.speakNative(plainText, options);
  }

  private speakNative(
    text: string,
    options?: {
      onStart?: () => void;
      onEnd?: () => void;
      onError?: () => void;
    }
  ): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      options?.onEnd?.();
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      if (this.activeVoice) {
        utterance.voice = this.activeVoice;
      }

      utterance.onstart = () => {
        options?.onStart?.();
      };

      utterance.onend = () => {
        this.currentUtterance = null;
        options?.onEnd?.();
      };

      utterance.onerror = () => {
        this.currentUtterance = null;
        options?.onError?.();
      };

      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch {
      options?.onError?.();
    }
  }

  public stop(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.currentUtterance = null;
  }
}

export const speechProvider = new SpeechNarrationProvider();
