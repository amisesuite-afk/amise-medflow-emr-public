/**
 * VoiceDictation — ambient voice capture during consultation.
 *
 * Uses the Web Speech API (SpeechRecognition) for real-time transcription,
 * then sends the accumulated transcript to /api/voice/segment which uses
 * Claude to split it into SOAP sections and returns structured data
 * ready to load into AppContext.
 *
 * Design principle: surgeon looks at the patient, not the screen.
 * The interface is deliberately minimal — one button to start/stop,
 * live transcript preview, one button to load into the EMR.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { staffAuthHeaders } from '@/lib/staff-auth';

interface SegmentedSoap {
  hpi?: string;
  examination?: Record<string, string>;
  assessment?: string;
  plan?: string;
  pmh?: string[];
  allergies?: string;
  unsegmented?: string;
}

const SUPPORTED = typeof window !== 'undefined' &&
  !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);

interface Props {
  visitType?: string;
  onClose?: () => void;
}

export default function VoiceDictation({ visitType, onClose }: Props) {
  const ctx = useAppContext();
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [segmenting, setSegmenting] = useState(false);
  const [soap, setSoap] = useState<SegmentedSoap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const recogRef = useRef<SpeechRecognition | null>(null);

  const stopRecording = useCallback(() => {
    recogRef.current?.stop();
    setRecording(false);
    setInterim('');
  }, []);

  const startRecording = useCallback(() => {
    if (!SUPPORTED) return;
    setSoap(null);
    setLoaded(false);
    setError(null);

    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition!;
    const recog = new SR();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-GB';

    recog.onresult = (e: SpeechRecognitionEvent) => {
      let fin = '';
      let int = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript + ' ';
        else int += e.results[i][0].transcript;
      }
      if (fin) setTranscript(prev => prev + fin);
      setInterim(int);
    };

    recog.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error !== 'no-speech') setError(`Microphone error: ${e.error}`);
      setRecording(false);
    };

    recog.onend = () => {
      setRecording(false);
      setInterim('');
    };

    recogRef.current = recog;
    recog.start();
    setRecording(true);
  }, []);

  // Stop on unmount
  useEffect(() => () => { recogRef.current?.stop(); }, []);

  async function segment() {
    const text = transcript.trim();
    if (!text) return;
    setSegmenting(true);
    setError(null);
    try {
      const headers = await staffAuthHeaders();
      const r = await fetch('/api/voice/segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ transcript: text, visitType }),
      });
      const data = await r.json() as { success?: boolean; segmented?: SegmentedSoap; error?: string };
      if (!r.ok || !data.segmented) throw new Error(data.error ?? 'Segmentation failed');
      setSoap(data.segmented);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to segment transcript');
    } finally {
      setSegmenting(false);
    }
  }

  function loadToEMR() {
    if (!soap) return;

    if (soap.hpi?.trim()) {
      ctx.setHpiNotes(ctx.hpiNotes ? ctx.hpiNotes + '\n\n' + soap.hpi : soap.hpi);
    }

    if (soap.examination) {
      const ex = soap.examination;
      const nextNotes = { ...ctx.examNotes };
      const fields: [string, keyof typeof ex][] = [
        ['general', 'general'], ['cardiovascular', 'cardiovascular'],
        ['respiratory', 'respiratory'], ['abdomen', 'abdomen'],
        ['wound', 'wound'], ['breast', 'breast'],
        ['neurological', 'neurological'], ['extremities', 'extremities'],
      ];
      for (const [key, src] of fields) {
        const text = ex[src]?.trim();
        if (text) nextNotes[key] = nextNotes[key] ? nextNotes[key] + ' ' + text : text;
      }
      ctx.setExamNotes(nextNotes);
      if (ex.general?.trim()) ctx.setExamGeneral(ex.general);
      if (ex.cardiovascular?.trim()) ctx.setExamCardio(ex.cardiovascular);
      if (ex.respiratory?.trim()) ctx.setExamResp(ex.respiratory);
      if (ex.abdomen?.trim()) ctx.setExamAbdomen(ex.abdomen);
    }

    if (soap.assessment?.trim()) {
      ctx.setAssessment(ctx.assessment ? ctx.assessment + '\n\n' + soap.assessment : soap.assessment);
    }

    if (soap.plan?.trim()) {
      ctx.setPlan(ctx.plan ? ctx.plan + '\n\n' + soap.plan : soap.plan);
    }

    if (soap.allergies?.trim()) {
      ctx.setAllergies(soap.allergies);
    }

    if (soap.pmh && soap.pmh.length > 0) {
      // Append to free text rather than risk overwriting structured PMH
      const pmhText = soap.pmh.join('; ');
      ctx.setFreeText(ctx.freeText ? ctx.freeText + '\nPMH (dictated): ' + pmhText : 'PMH (dictated): ' + pmhText);
    }

    if (soap.unsegmented?.trim()) {
      ctx.setFreeText(ctx.freeText ? ctx.freeText + '\n\n' + soap.unsegmented : soap.unsegmented);
    }

    setLoaded(true);
    setTimeout(() => onClose?.(), 800);
  }

  const fullTranscript = transcript + (interim ? interim : '');

  if (!SUPPORTED) {
    return (
      <div style={{ padding: 16, background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, fontSize: 13 }}>
        <strong>Voice dictation not supported</strong> in this browser.
        Use Chrome or Safari on a device with a microphone.
      </div>
    );
  }

  return (
    <div style={{
      background: '#0a1628', border: '2px solid #0d9488', borderRadius: 14,
      padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            background: recording ? '#ef4444' : '#475569',
            boxShadow: recording ? '0 0 0 4px rgba(239,68,68,0.25)' : 'none',
            animation: recording ? 'pulse 1.2s ease-in-out infinite' : 'none',
          }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>
            {recording ? 'Recording…' : soap ? 'Dictation ready to load' : 'Voice Dictation'}
          </span>
        </div>
        {onClose && (
          <button type="button" onClick={() => { stopRecording(); onClose(); }}
            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>
            ×
          </button>
        )}
      </div>

      {/* Transcript area */}
      {(fullTranscript || recording) && (
        <div style={{
          background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 8,
          padding: '12px 14px', minHeight: 80, maxHeight: 200, overflowY: 'auto',
          fontFamily: 'Georgia, serif', fontSize: 13, lineHeight: 1.7, color: '#e2e8f0',
          position: 'relative',
        }}>
          {transcript}
          {interim && <span style={{ color: '#64748b' }}>{interim}</span>}
          {recording && !fullTranscript && (
            <span style={{ color: '#475569', fontStyle: 'italic' }}>Listening…</span>
          )}
        </div>
      )}

      {/* Segmented SOAP preview */}
      {soap && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {([
            ['HPI', soap.hpi],
            ['Assessment', soap.assessment],
            ['Plan', soap.plan],
            ['Allergies', soap.allergies],
            ...Object.entries(soap.examination ?? {}).filter(([, v]) => v?.trim()).map(([k, v]) => [`Exam — ${k}`, v]),
            ['Unsegmented', soap.unsegmented],
          ] as [string, string | undefined][]).filter(([, v]) => v?.trim()).map(([label, text]) => (
            <div key={label} style={{ background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 7, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#0d9488', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                {label}
              </div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 12, lineHeight: 1.6, color: '#cbd5e1' }}>
                {text}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ background: '#1a0000', border: '1px solid #ef4444', borderRadius: 7, padding: '8px 12px', fontSize: 12, color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!recording ? (
          <button
            type="button"
            onClick={startRecording}
            disabled={segmenting}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            🎙 {transcript ? 'Resume' : 'Start dictation'}
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            style={{
              padding: '8px 18px', borderRadius: 8, border: '2px solid #ef4444',
              background: '#1a0000', color: '#ef4444', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            ⏹ Stop
          </button>
        )}

        {transcript && !recording && !soap && (
          <button
            type="button"
            onClick={() => void segment()}
            disabled={segmenting}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none', cursor: segmenting ? 'wait' : 'pointer',
              background: '#1e3a8a', color: '#93c5fd', fontSize: 13, fontWeight: 700,
            }}
          >
            {segmenting ? '✦ Segmenting…' : '✦ Segment into SOAP'}
          </button>
        )}

        {soap && !loaded && (
          <button
            type="button"
            onClick={loadToEMR}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 800,
            }}
          >
            ↓ Load into EMR
          </button>
        )}

        {loaded && (
          <div style={{ padding: '8px 14px', borderRadius: 8, background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 700 }}>
            ✓ Loaded
          </div>
        )}

        {transcript && (
          <button
            type="button"
            onClick={() => { setTranscript(''); setSoap(null); setLoaded(false); setError(null); }}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid #1e3a5f',
              background: 'transparent', color: '#64748b', fontSize: 12, cursor: 'pointer',
            }}
          >
            Clear
          </button>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
