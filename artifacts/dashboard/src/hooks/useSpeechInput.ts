import { useState, useRef, useCallback } from 'react';

interface SpeechInputResult {
  listening: boolean;
  supported: boolean;
  start: (onResult: (text: string) => void) => void;
  stop: () => void;
}

export function useSpeechInput(): SpeechInputResult {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  const supported = typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const start = useCallback((onResult: (text: string) => void) => {
    if (!supported) return;
    const SR = ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) as any;
    const rec = new SR();
    rec.lang = 'en-GB';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const transcript: string = e.results[0][0].transcript;
      onResult(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, [supported]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}
