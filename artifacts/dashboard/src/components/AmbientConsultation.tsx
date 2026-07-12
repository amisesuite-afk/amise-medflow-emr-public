/**
 * AmbientConsultation — voice-first consultation interface.
 *
 * Primary interaction: dictate → Claude segments into SOAP → live note builds.
 * Secondary: vitals strip, photo capture, focused exam quick-entry.
 * Fallback: "Detailed entry" opens full tab mode.
 *
 * Design principle: surgeon looks at the patient, not the screen.
 * Everything here is optimised for eyes-up interaction.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { getAIProviderConfig, segmentSoapWithOllama, type SegmentedSoap } from '@/lib/ai-provider';
import { localSegmentSoap } from '@/lib/local-soap-segmenter';
import { getApiOrigin } from '@/lib/api-origin';
import VitalsStrip from './VitalsStrip';
import LiveConsultNote from './LiveConsultNote';

// ── Web Speech API types ──────────────────────────────────────────────────────

const SR_CLASS = (typeof window !== 'undefined')
  ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
  : null;
const SPEECH_SUPPORTED = !!SR_CLASS;

type SegmentSource = 'local' | 'ollama' | 'cloud';

// Fire-and-forget: log completed segmentation to call_logs for audit trail
async function persistCallLog(
  patientId: string | null | undefined,
  transcript: string,
  soap: unknown,
  source: SegmentSource,
): Promise<void> {
  if (!patientId || source === 'cloud') return; // cloud path saves server-side
  try {
    const headers = await staffAuthHeaders();
    const apiOrigin = getApiOrigin();
    const url = apiOrigin ? `${apiOrigin}/api/calls/ingest` : '/api/calls/ingest';
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({
        patient_id: patientId,
        source: 'ambient',
        direction: 'ambient',
        transcript,
        soap_segmented: soap,
      }),
    });
  } catch { /* non-fatal */ }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  visitType?: string;
  onDetailedMode: () => void;
  onFinalise: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AmbientConsultation({ visitType, onDetailedMode, onFinalise }: Props) {
  const ctx = useAppContext();

  // Voice state
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [segmenting, setSegmenting] = useState(false);
  const [pendingSoap, setPendingSoap] = useState<SegmentedSoap | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [segmentSource, setSegmentSource] = useState<SegmentSource | null>(null);
  const recogRef = useRef<SpeechRecognition | null>(null);

  // UI panels
  const [photosOpen, setPhotosOpen] = useState(false);
  const [cameraRef] = useState(() => ({ current: null as HTMLInputElement | null }));

  const stopRecording = useCallback(() => {
    recogRef.current?.stop();
    setRecording(false);
    setInterim('');
  }, []);

  const startRecording = useCallback(() => {
    if (!SR_CLASS) return;
    setPendingSoap(null);
    setLoaded(false);
    setVoiceError(null);
    setTranscript('');

    const recog = new SR_CLASS();
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
      if (e.error !== 'no-speech') setVoiceError(`Mic error: ${e.error}`);
      setRecording(false);
    };

    recog.onend = () => { setRecording(false); setInterim(''); };

    recogRef.current = recog;
    recog.start();
    setRecording(true);
  }, []);

  useEffect(() => () => { recogRef.current?.stop(); }, []);

  async function handleSegment() {
    const text = (transcript + ' ' + interim).trim();
    if (!text) return;
    stopRecording();
    setSegmenting(true);
    setVoiceError(null);
    setSegmentSource(null);

    try {
      // Tier 1: local rule-based — zero tokens, instant
      const local = localSegmentSoap(text);
      if (local.confidence >= 0.7) {
        setPendingSoap(local.segmented);
        setSegmentSource('local');
        void persistCallLog(ctx.patientId, text, local.segmented, 'local');
        return;
      }

      // Tier 2: Ollama — LAN, zero tokens
      const aiConfig = getAIProviderConfig();
      if (aiConfig.type === 'ollama') {
        try {
          const ollamaResult = await segmentSoapWithOllama(text, visitType, aiConfig);
          setPendingSoap(ollamaResult);
          setSegmentSource('ollama');
          void persistCallLog(ctx.patientId, text, ollamaResult, 'ollama');
          return;
        } catch { /* fall through to cloud */ }
      }

      // Tier 3: cloud Claude — passes patientId so voice.ts writes the call_log
      const apiOrigin = getApiOrigin();
      const url = apiOrigin ? `${apiOrigin}/api/voice/segment` : '/api/voice/segment';
      const headers = await staffAuthHeaders();
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ transcript: text, visitType, patientId: ctx.patientId ?? undefined }),
      });
      const data = await r.json() as { segmented?: SegmentedSoap; error?: string };
      if (!r.ok || !data.segmented) throw new Error(data.error ?? 'Segmentation failed');
      setPendingSoap(data.segmented);
      setSegmentSource('cloud');
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : 'Segmentation failed');
    } finally {
      setSegmenting(false);
    }
  }

  function acceptSoap() {
    if (!pendingSoap) return;
    const s = pendingSoap;

    if (s.hpi?.trim()) ctx.setHpiNotes(ctx.hpiNotes ? ctx.hpiNotes + '\n\n' + s.hpi : s.hpi);
    if (s.assessment?.trim()) ctx.setAssessment(ctx.assessment ? ctx.assessment + '\n\n' + s.assessment : s.assessment);
    if (s.plan?.trim()) ctx.setPlan(ctx.plan ? ctx.plan + '\n\n' + s.plan : s.plan);
    if (s.allergies?.trim()) ctx.setAllergies(s.allergies);

    if (s.examination) {
      const ex = s.examination;
      const next = { ...ctx.examNotes };
      const map: [string, string][] = [
        ['general', 'general'], ['cardiovascular', 'cardiovascular'],
        ['respiratory', 'respiratory'], ['abdomen', 'abdomen'],
        ['wound', 'wound'], ['breast', 'breast'],
        ['neurological', 'neurological'], ['extremities', 'extremities'],
      ];
      for (const [k, src] of map) {
        const t = ex[src]?.trim();
        if (t) next[k] = next[k] ? next[k] + ' ' + t : t;
      }
      ctx.setExamNotes(next);
      if (ex.general?.trim()) ctx.setExamGeneral(ex.general);
      if (ex.cardiovascular?.trim()) ctx.setExamCardio(ex.cardiovascular);
      if (ex.respiratory?.trim()) ctx.setExamResp(ex.respiratory);
      if (ex.abdomen?.trim()) ctx.setExamAbdomen(ex.abdomen);
    }

    if (s.pmh?.length) {
      const txt = s.pmh.join('; ');
      ctx.setFreeText(ctx.freeText ? ctx.freeText + '\nPMH (dictated): ' + txt : 'PMH (dictated): ' + txt);
    }
    if (s.unsegmented?.trim()) {
      ctx.setFreeText(ctx.freeText ? ctx.freeText + '\n\n' + s.unsegmented : s.unsegmented);
    }

    setPendingSoap(null);
    setTranscript('');
    setLoaded(true);
    setTimeout(() => setLoaded(false), 3000);
  }

  const fullTranscript = transcript + (interim ? interim : '');

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── VOICE PANEL ── */}
      <div style={{
        background: '#0a1628',
        border: `2px solid ${recording ? '#ef4444' : '#1e3a5f'}`,
        borderRadius: 12,
        padding: '16px 18px',
        transition: 'border-color 0.3s',
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
              background: recording ? '#ef4444' : segmenting ? '#f59e0b' : '#334155',
              boxShadow: recording ? '0 0 0 4px rgba(239,68,68,0.25)' : 'none',
              animation: recording ? 'ambientPulse 1.2s ease-in-out infinite' : 'none',
            }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9' }}>
              {recording ? 'Listening…' : segmenting ? 'Segmenting into SOAP…' : loaded ? '✓ Loaded to note' : 'Voice Dictation'}
            </span>
          </div>
          {fullTranscript && !recording && !segmenting && !pendingSoap && (
            <button type="button" onClick={() => { setTranscript(''); setVoiceError(null); setLoaded(false); setSegmentSource(null); }}
              style={{ background: 'none', border: 'none', color: '#475569', fontSize: 11, cursor: 'pointer' }}>
              Clear
            </button>
          )}
        </div>

        {/* Big microphone button */}
        {!recording && !pendingSoap && (
          <button
            type="button"
            onClick={startRecording}
            disabled={!SPEECH_SUPPORTED || segmenting}
            style={{
              width: '100%',
              padding: '18px',
              borderRadius: 10,
              border: 'none',
              background: loaded ? '#065f46' : '#0d9488',
              color: '#fff',
              fontSize: 17,
              fontWeight: 800,
              cursor: SPEECH_SUPPORTED ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              letterSpacing: '0.03em',
              boxShadow: '0 4px 20px rgba(13,148,136,0.3)',
              transition: 'background 0.2s',
            }}
          >
            <span style={{ fontSize: 22 }}>🎙</span>
            {SPEECH_SUPPORTED
              ? (transcript ? 'Resume dictation' : 'Start dictating')
              : 'Voice not supported in this browser'
            }
          </button>
        )}

        {/* Recording controls */}
        {recording && (
          <button
            type="button"
            onClick={() => void handleSegment()}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 10,
              border: '2px solid #ef4444',
              background: '#1a0000',
              color: '#ef4444',
              fontSize: 16,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 20 }}>⏹</span>
            Stop &amp; segment into SOAP
          </button>
        )}

        {/* Transcript preview */}
        {(fullTranscript || recording) && (
          <div style={{
            marginTop: 10,
            background: '#0d1b2e',
            border: '1px solid #1e3a5f',
            borderRadius: 8,
            padding: '10px 12px',
            maxHeight: 100,
            overflowY: 'auto',
            fontFamily: 'Georgia, serif',
            fontSize: 12,
            lineHeight: 1.7,
            color: '#e2e8f0',
          }}>
            {transcript}
            {interim && <span style={{ color: '#475569' }}>{interim}</span>}
            {recording && !fullTranscript && <span style={{ color: '#475569', fontStyle: 'italic' }}>Listening…</span>}
          </div>
        )}

        {/* SOAP preview → accept */}
        {pendingSoap && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.06em' }}>
                SOAP PREVIEW — review then accept
              </div>
              {segmentSource && (
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 9,
                  background: segmentSource === 'local' ? 'rgba(245,158,11,.2)' : segmentSource === 'ollama' ? 'rgba(16,185,129,.2)' : 'rgba(59,130,246,.15)',
                  color: segmentSource === 'local' ? '#d97706' : segmentSource === 'ollama' ? '#059669' : '#60a5fa',
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                }}>
                  {segmentSource === 'local' ? '⚡ Local' : segmentSource === 'ollama' ? '🟢 Ollama' : '🤖 Cloud'}
                </span>
              )}
            </div>
            {([
              ['HPI', pendingSoap.hpi],
              ['Assessment', pendingSoap.assessment],
              ['Plan', pendingSoap.plan],
              ['Allergies', pendingSoap.allergies],
              ...Object.entries(pendingSoap.examination ?? {}).filter(([, v]) => v?.trim()).map(([k, v]) => [`Exam — ${k}`, v]),
              ['Unsegmented', pendingSoap.unsegmented],
            ] as [string, string | undefined][]).filter(([, v]) => v?.trim()).map(([label, text]) => (
              <div key={label} style={{ background: '#0d1b2e', border: '1px solid #1e3a5f', borderRadius: 7, padding: '8px 12px' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#0d9488', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 12, lineHeight: 1.6, color: '#cbd5e1', fontFamily: 'Georgia, serif' }}>{text}</div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={acceptSoap}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8, border: 'none',
                  background: '#0d9488', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                }}
              >
                ↓ Accept &amp; load to note
              </button>
              <button
                type="button"
                onClick={() => setPendingSoap(null)}
                style={{
                  padding: '10px 14px', borderRadius: 8, border: '1px solid #1e3a5f',
                  background: 'transparent', color: '#64748b', fontSize: 12, cursor: 'pointer',
                }}
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {voiceError && (
          <div style={{ marginTop: 8, padding: '7px 10px', borderRadius: 6, background: '#1a0000', border: '1px solid #ef4444', fontSize: 11, color: '#fca5a5' }}>
            {voiceError}
          </div>
        )}
      </div>

      {/* ── VITALS STRIP ── */}
      <VitalsStrip />

      {/* ── LIVE NOTE ── */}
      <LiveConsultNote onFinalise={onFinalise} />

      {/* ── PHOTO CAPTURE ── */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setPhotosOpen(p => !p)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 16px', background: photosOpen ? '#f0fdfa' : '#fff',
            border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#374151',
          }}
        >
          <span>📷 Photos &amp; AI description</span>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{photosOpen ? '▲ hide' : '▼ show'}</span>
        </button>
        {photosOpen && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
              Tap a photo below — AI generates a medical-language description from the image.
            </div>
            {/* Minimal inline photo capture */}
            <input
              ref={el => { cameraRef.current = el; }}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                  const dataUrl = ev.target?.result as string;
                  if (dataUrl) ctx.setExamPhotos([
                    ...ctx.examPhotos,
                    { id: crypto.randomUUID(), dataUrl, mimeType: file.type, bodyRegion: 'wound', description: '', distanceCm: '', dateAdded: new Date().toISOString() },
                  ]);
                };
                reader.readAsDataURL(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              style={{
                padding: '8px 18px', borderRadius: 8, border: '1.5px solid #0d9488',
                background: '#f0fdfa', color: '#0d9488', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              📷 Capture photo
            </button>
            {ctx.examPhotos.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {ctx.examPhotos.map(p => (
                  <div key={p.id} style={{ position: 'relative', width: 72, height: 72 }}>
                    <img src={p.dataUrl} alt={p.bodyRegion} style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', border: '1.5px solid #e2e8f0' }} />
                    {p.description && (
                      <div style={{
                        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
                        borderRadius: 8, padding: 4, fontSize: 8, color: '#fff', overflow: 'hidden',
                        display: 'flex', alignItems: 'flex-end',
                      }}>
                        {p.description.slice(0, 60)}…
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── DETAILED ENTRY LINK ── */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4 }}>
        <button
          type="button"
          onClick={onDetailedMode}
          style={{
            background: 'none', border: '1px solid #e2e8f0', borderRadius: 8,
            color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          ≡ Detailed entry — PMH · Meds · ROS · Scales · Procedures
        </button>
      </div>

      <style>{`
        @keyframes ambientPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}
