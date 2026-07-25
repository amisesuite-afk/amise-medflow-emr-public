import { useState, useRef, useCallback } from 'react';

interface SpeechInputResult {
  listening: boolean;
  supported: boolean;
  error: string | null;
  clearError: () => void;
  start: (onResult: (text: string) => void) => void;
  stop: () => void;
}

export function useSpeechInput(): SpeechInputResult {
  const [listening, setListening] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);

  const supported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);

  const start = useCallback((onResult: (text: string) => void) => {
    if (!supported) return;
    setError(null);
    const SR = (window.SpeechRecognition ?? window.webkitSpeechRecognition)!;
    const rec = new SR();
    rec.lang = 'en-GB';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      onResult(e.results[0][0].transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      setListening(false);
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      const MESSAGES: Record<string, string> = {
        'not-allowed': 'Microphone access blocked — check browser or device settings.',
        'service-not-allowed': 'Speech recognition unavailable in this browser.',
        'network': 'Speech recognition requires an internet connection.',
      };
      setError(MESSAGES[e.error] ?? `Mic error: ${e.error}`);
    };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [supported]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { listening, supported, error, clearError, start, stop };
}
