/**
 * P2 — Whisper ASR Web Worker.
 *
 * Runs @xenova/transformers inside a module worker so model loading and
 * inference never blocks the main thread.
 *
 * Message protocol (parent → worker):
 *   { type: 'load' }
 *   { type: 'transcribe', audio: Float32Array }
 *
 * Message protocol (worker → parent):
 *   { type: 'loading', progress: number }   — 0–100 during model download
 *   { type: 'ready' }
 *   { type: 'result', text: string }
 *   { type: 'error', message: string }
 */

import { pipeline, env } from '@xenova/transformers';

// Use browser cache (OPFS / Cache API) — model downloaded once, offline after that
env.allowLocalModels   = false;
env.useBrowserCache    = true;
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2/dist/';

type Transcriber = Awaited<ReturnType<typeof pipeline>>;
let transcriber: Transcriber | null = null;

async function loadModel(): Promise<Transcriber> {
  if (transcriber) return transcriber;

  transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
    quantized: true,
    progress_callback: (p: { status: string; progress?: number }) => {
      if (p.status === 'downloading' || p.status === 'loading') {
        self.postMessage({ type: 'loading', progress: Math.round(p.progress ?? 0) });
      }
    },
  });

  return transcriber;
}

self.addEventListener('message', async (e: MessageEvent<{ type: string; audio?: Float32Array }>) => {
  const { type, audio } = e.data;

  if (type === 'load') {
    try {
      await loadModel();
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err) });
    }
    return;
  }

  if (type === 'transcribe') {
    if (!audio) { self.postMessage({ type: 'error', message: 'No audio data' }); return; }
    try {
      const model = await loadModel();
      const result = await (model as (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string }>)(
        audio,
        { language: 'english', task: 'transcribe' },
      );
      self.postMessage({ type: 'result', text: result.text.trim() });
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err) });
    }
  }
});
