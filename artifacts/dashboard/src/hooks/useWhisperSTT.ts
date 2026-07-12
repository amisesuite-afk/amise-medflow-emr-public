/**
 * P2 — Whisper speech-to-text hook.
 *
 * Works in any browser that supports MediaRecorder (Chrome, Firefox, Safari 15+).
 * Loads Whisper-tiny.en (~40 MB) into browser cache on first use; offline after that.
 *
 * Strategy in NarrativeInput:
 *   • Chrome / Edge → use native Web Speech API (instant, no download).
 *   • Other browsers → show "Load voice model" button → useWhisperSTT.
 *   • Either path appends transcript to the textarea.
 */

import { useCallback, useRef, useState } from 'react';

export type WhisperStatus = 'idle' | 'loading' | 'ready' | 'recording' | 'transcribing' | 'error';

export interface UseWhisperSTTResult {
  status:   WhisperStatus;
  progress: number;             // 0–100 during model download
  supported: boolean;
  load:   () => Promise<void>;
  start:  (onResult: (text: string) => void) => Promise<void>;
  stop:   () => void;
}

export function useWhisperSTT(): UseWhisperSTTResult {
  const [status,   setStatus]   = useState<WhisperStatus>('idle');
  const [progress, setProgress] = useState(0);

  const supported = typeof window !== 'undefined' && !!window.MediaRecorder;

  const workerRef   = useRef<Worker | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const onResultRef = useRef<((text: string) => void) | null>(null);

  function getWorker(): Worker {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL('../workers/asr-worker.ts', import.meta.url),
        { type: 'module' },
      );
    }
    return workerRef.current;
  }

  const load = useCallback(async () => {
    if (status === 'ready' || status === 'loading') return;
    setStatus('loading');
    setProgress(0);

    return new Promise<void>((resolve, reject) => {
      const worker = getWorker();
      worker.onmessage = (e: MessageEvent<{ type: string; progress?: number; message?: string }>) => {
        if (e.data.type === 'loading') setProgress(e.data.progress ?? 0);
        if (e.data.type === 'ready')   { setStatus('ready'); resolve(); }
        if (e.data.type === 'error')   { setStatus('error'); reject(new Error(e.data.message)); }
      };
      worker.postMessage({ type: 'load' });
    });
  }, [status]);

  const start = useCallback(async (onResult: (text: string) => void) => {
    if (status === 'idle') await load();
    if (status === 'error') return;

    onResultRef.current = onResult;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    streamRef.current = stream;

    // Prefer webm/opus; fall back to default
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : undefined;

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      // Stop mic tracks
      streamRef.current?.getTracks().forEach(t => t.stop());

      setStatus('transcribing');
      try {
        const blob    = new Blob(chunksRef.current, { type: recorder.mimeType });
        const ab      = await blob.arrayBuffer();
        const audioCtx = new AudioContext();
        const audioBuf = await audioCtx.decodeAudioData(ab);

        // Resample to 16 kHz mono (what Whisper expects)
        const targetRate  = 16_000;
        const offCtx      = new OfflineAudioContext(1, Math.ceil(audioBuf.duration * targetRate), targetRate);
        const src         = offCtx.createBufferSource();
        src.buffer        = audioBuf;
        src.connect(offCtx.destination);
        src.start();
        const resampled   = await offCtx.startRendering();
        const float32     = resampled.getChannelData(0);

        const worker = getWorker();
        worker.onmessage = (e: MessageEvent<{ type: string; text?: string; message?: string }>) => {
          if (e.data.type === 'result') {
            setStatus('ready');
            onResultRef.current?.(e.data.text ?? '');
          }
          if (e.data.type === 'error') {
            setStatus('ready');
          }
        };
        // Transfer the buffer ownership to the worker for zero-copy
        worker.postMessage({ type: 'transcribe', audio: float32 }, [float32.buffer]);
      } catch {
        setStatus('ready');
      }
    };

    recorderRef.current = recorder;
    recorder.start();
    setStatus('recording');
  }, [status, load]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  return { status, progress, supported, load, start, stop };
}
