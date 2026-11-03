import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  type ProntuarioIaState,
  type ProntuarioIaResult,
  type ProntuarioAnexo,
  type ProntuarioIaPorts,
  type DraftWatcher,
  type DraftRow,
  type ProntuarioStorage,
  MEDICAL_FILES_SIGNED_TTL,
  createProntuarioIaController,
} from '@/lib/prontuarioIaCore';
import {
  createDefaultSupabasePorts,
  type ProntuarioIaConfigRow,
} from '@/services/prontuarioIaAdapters';

function getSupportedMimeType(): { mimeType: string; ext: string } {
  const candidates = [
    { mimeType: 'audio/webm;codecs=opus', ext: 'webm' },
    { mimeType: 'audio/webm', ext: 'webm' },
    { mimeType: 'audio/ogg;codecs=opus', ext: 'ogg' },
    { mimeType: 'audio/mp4', ext: 'm4a' },
    { mimeType: 'audio/aac', ext: 'aac' },
  ];
  if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
    for (const c of candidates) {
      if (MediaRecorder.isTypeSupported(c.mimeType)) {
        return c;
      }
    }
  }
  return { mimeType: 'audio/webm', ext: 'webm' };
}

/**
 * Hook `useDraftWatcher(draftId)` (Seção 9.4):
 * Assina no mount, cancela no unmount e executa leitura imediata na abertura.
 */
export function useDraftWatcher(
  draftId: string | null | undefined,
  watcher: DraftWatcher,
  onRow: (row: DraftRow) => void
): void {
  const onRowRef = useRef(onRow);
  onRowRef.current = onRow;

  useEffect(() => {
    if (!draftId) return undefined;
    const sub = watcher.watch(draftId);
    const unsub = sub.subscribe((row) => {
      onRowRef.current(row);
    });
    return () => {
      unsub();
      sub.stop();
    };
  }, [draftId, watcher]);
}

/**
 * Hook `useAnexos(recordId)` (Seção 9.4):
 * Lista de anexos + geração de `signedUrl(path)` sob demanda com cache curto.
 */
export function useAnexos(
  recordId: string | null | undefined,
  anexos: ProntuarioAnexo[] | null | undefined,
  storage?: ProntuarioStorage
) {
  const cacheRef = useRef<Map<string, { url: string; expiresAt: number }>>(new Map());
  const defaultStorage = useMemo(
    () => storage ?? createDefaultSupabasePorts().ports.storage,
    [storage]
  );

  useEffect(() => {
    cacheRef.current.clear();
  }, [recordId]);

  const getSignedUrl = useCallback(
    async (pathOrUrl: string): Promise<string> => {
      if (/^https?:\/\//i.test(pathOrUrl)) {
        return pathOrUrl;
      }
      const now = Date.now();
      const cached = cacheRef.current.get(pathOrUrl);
      if (cached && cached.expiresAt > now) {
        return cached.url;
      }
      const signed = await defaultStorage.signedUrl(pathOrUrl, MEDICAL_FILES_SIGNED_TTL);
      // Cache curto de 10 min (menor que o TTL de 15 min)
      cacheRef.current.set(pathOrUrl, {
        url: signed,
        expiresAt: now + 10 * 60 * 1000,
      });
      return signed;
    },
    [defaultStorage]
  );

  return {
    anexos: Array.isArray(anexos) ? anexos : [],
    getSignedUrl,
  };
}

export interface UseProntuarioIaOptions {
  ports?: ProntuarioIaPorts;
  config?: Partial<ProntuarioIaConfigRow> | null;
  recordId?: string | null;
  onCommitted?: () => void;
}

/**
 * Hook principal `useProntuarioIa(petId)` (Seção 9.4):
 * Retorna `{ state, startRecording, stopRecording, confirm, discard, retry, ... }`
 * e garante limpeza total de timers, stream de microfone e canal Realtime no unmount (T12).
 */
export function useProntuarioIa(petId: string | null, options?: UseProntuarioIaOptions) {
  const defaultBundle = useMemo(() => createDefaultSupabasePorts(), []);
  const activePorts = options?.ports ?? defaultBundle.ports;

  useEffect(() => {
    if (options?.config && !options?.ports) {
      defaultBundle.settings.setConfig(options.config);
    }
  }, [options?.config, options?.ports, defaultBundle]);

  const controllerRef = useRef<ReturnType<typeof createProntuarioIaController> | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createProntuarioIaController(activePorts);
  }

  const [state, setState] = useState<ProntuarioIaState>(() => controllerRef.current!.getState());
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mimeInfoRef = useRef<{ mimeType: string; ext: string }>({
    mimeType: 'audio/webm',
    ext: 'webm',
  });
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCommittedRef = useRef(options?.onCommitted);
  onCommittedRef.current = options?.onCommitted;

  const stopRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current !== null) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const teardownMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  // Re-cria o controller se as portas mudarem e limpa tudo no unmount (T12)
  useEffect(() => {
    const ctrl = createProntuarioIaController(activePorts);
    controllerRef.current = ctrl;
    setState(ctrl.getState());

    const unsubscribe = ctrl.subscribe((nextState) => {
      setState(nextState);
      if (nextState.kind === 'committed') {
        onCommittedRef.current?.();
      }
    });

    return () => {
      unsubscribe();
      ctrl.dispose();
      stopRecordingTimer();
      teardownMediaStream();
    };
  }, [activePorts, stopRecordingTimer, teardownMediaStream]);

  // Reseta estado se trocar de pet
  useEffect(() => {
    controllerRef.current?.reset();
    setRecordingError(null);
  }, [petId]);

  const startRecording = useCallback(async () => {
    if (!petId) {
      setRecordingError('Selecione um paciente antes de gravar a consulta.');
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setRecordingError('Gravação de áudio não suportada neste navegador. Envie o arquivo de áudio manualmente.');
      return;
    }

    try {
      setRecordingError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      mimeInfoRef.current = getSupportedMimeType();

      const recorder = new MediaRecorder(stream, {
        mimeType: mimeInfoRef.current.mimeType,
      });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      stopRecordingTimer();
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch {
      teardownMediaStream();
      stopRecordingTimer();
      setIsRecording(false);
      setRecordingError(
        'Não foi possível acessar o microfone. Verifique a permissão do navegador ou envie o áudio manualmente.'
      );
    }
  }, [petId, stopRecordingTimer, teardownMediaStream]);

  const stopRecording = useCallback(async (): Promise<void> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || !isRecording || !petId) return;

    const audioFile = await new Promise<File>((resolve, reject) => {
      recorder.onstop = () => {
        const { mimeType, ext } = mimeInfoRef.current;
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        teardownMediaStream();
        stopRecordingTimer();
        setIsRecording(false);

        if (blob.size === 0) {
          reject(new Error('Gravação vazia.'));
          return;
        }
        resolve(new File([blob], `consulta_${Date.now()}.${ext}`, { type: mimeType }));
      };
      recorder.stop();
    });

    await controllerRef.current?.processAudio(petId, audioFile, audioFile.name);
  }, [isRecording, petId, stopRecordingTimer, teardownMediaStream]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && isRecording) {
      recorder.onstop = () => teardownMediaStream();
      recorder.stop();
    } else {
      teardownMediaStream();
    }
    stopRecordingTimer();
    setIsRecording(false);
    setRecordingDuration(0);
  }, [isRecording, stopRecordingTimer, teardownMediaStream]);

  const processAudioFile = useCallback(
    async (file: File) => {
      if (!petId) return;
      setRecordingError(null);
      await controllerRef.current?.processAudio(petId, file, file.name);
    },
    [petId]
  );

  const confirm = useCallback(
    async (edited: ProntuarioIaResult, explicitRecordId?: string | null) => {
      if (!petId) return;
      const rid =
        explicitRecordId ||
        options?.recordId ||
        controllerRef.current?.getRecordId();

      if (!rid) {
        const ensured = await activePorts.repository.ensureActiveRecord(petId);
        await controllerRef.current?.confirm(petId, ensured.id, edited);
        return;
      }

      await controllerRef.current?.confirm(petId, rid, edited);
    },
    [petId, options?.recordId, activePorts.repository]
  );

  const discard = useCallback(() => {
    setRecordingError(null);
    controllerRef.current?.reset();
  }, []);

  const retry = useCallback(async () => {
    setRecordingError(null);
    await controllerRef.current?.retryLastAudio();
  }, []);

  const uploadManualAttachment = useCallback(
    async (file: File, explicitRecordId?: string | null): Promise<ProntuarioAnexo> => {
      if (!petId) throw new Error('Selecione um pet antes de anexar arquivos.');
      let rid =
        explicitRecordId ||
        options?.recordId ||
        controllerRef.current?.getRecordId();

      if (!rid) {
        const ensured = await activePorts.repository.ensureActiveRecord(petId);
        rid = ensured.id;
      }
      return controllerRef.current!.uploadManualAttachment(petId, rid, file, file.name);
    },
    [petId, options?.recordId, activePorts.repository]
  );

  return {
    state,
    isRecording,
    recordingDuration,
    recordingError,
    recordId: options?.recordId || controllerRef.current?.getRecordId() || null,
    hasRetryAudio: Boolean(controllerRef.current?.getLastAudio()),
    startRecording,
    stopRecording,
    cancelRecording,
    processAudioFile,
    confirm,
    discard,
    retry,
    reset: discard,
    uploadManualAttachment,
    ports: activePorts,
  };
}
