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
import { getAIProviderConfig, segmentSoapWithOllama, type SegmentedSoap } from '@/lib/ai-provider';
import { localSegmentSoap } from '@/lib/local-soap-segmenter';
import { getApiOrigin } from '@/lib/api-origin';

type SegmentSource = 'local' | 'ollama' | 'cloud';

const SUPPORTED = typeof window !== 'undefined' &&
  !!(window.SpeechRecognition ?? window.webkitSpeechRecognition);

interface Props {
  visitType?: string;
  onClose?: () => void;
}

type Decision = 'pending' | 'approved' | 'rejected';

export default function VoiceDictation({ visitType, onClose }: Props) {
  const ctx = useAppContext();
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [segmenting, setSegmenting] = useState(false);
  const [soap, setSoap] = useState<SegmentedSoap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [segmentSource, setSegmentSource] = useState<SegmentSource | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  // Per-section review state
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
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
    setSegmentSource(null);

    try {
      // Tier 1: local rules — zero tokens, instant
      const local = localSegmentSoap(text);
      if (local.confidence >= 0.7) {
        setSoap(local.segmented);
        setSegmentSource('local');
        return;
      }

      // Tier 2: Ollama — LAN, zero tokens
      const aiConfig = getAIProviderConfig();
      if (aiConfig.type === 'ollama') {
        try {
          const result = await segmentSoapWithOllama(text, visitType, aiConfig);
          setSoap(result);
          setSegmentSource('ollama');
          return;
        } catch { /* fall through */ }
      }

      // Tier 3: cloud — passes patientId so voice.ts writes the call_log
      const apiOrigin = getApiOrigin();
      const url = apiOrigin ? `${apiOrigin}/api/voice/segment` : '/api/voice/segment';
      const headers = await staffAuthHeaders();
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ transcript: text, visitType, patientId: ctx.patientId ?? undefined }),
      });
      const data = await r.json() as { success?: boolean; segmented?: SegmentedSoap; proposalId?: string; error?: string };
      if (!r.ok || !data.segmented) throw new Error(data.error ?? 'Segmentation failed');
      setSoap(data.segmented);
      setSegmentSource('cloud');
      if (data.proposalId) setProposalId(data.proposalId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to segment transcript');
    } finally {
      setSegmenting(false);
    }
  }

  /** Resolve the final text for a section: edited text > original > undefined */
  function resolvedText(key: string, original: string | undefined): string | undefined {
    if (decisions[key] === 'rejected') return undefined;
    if (decisions[key] === 'approved' || decisions[key] === undefined) {
      return original?.trim() || undefined;
    }
    return edits[key]?.trim() || original?.trim() || undefined;
  }

  async function fileApproved() {
    if (!soap) return;

    const get = (key: string, original: string | undefined) => resolvedText(key, original);

    const hpi = get('hpi', soap.hpi);
    if (hpi) ctx.setHpiNotes(ctx.hpiNotes ? ctx.hpiNotes + '\n\n' + hpi : hpi);

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
        const text = get(`exam_${key}`, ex[src]);
        if (text) nextNotes[key] = nextNotes[key] ? nextNotes[key] + ' ' + text : text;
      }
      ctx.setExamNotes(nextNotes);
      const g = get('exam_general', ex.general); if (g) ctx.setExamGeneral(g);
      const c = get('exam_cardiovascular', ex.cardiovascular); if (c) ctx.setExamCardio(c);
      const rp = get('exam_respiratory', ex.respiratory); if (rp) ctx.setExamResp(rp);
      const ab = get('exam_abdomen', ex.abdomen); if (ab) ctx.setExamAbdomen(ab);
    }

    const assessment = (() => {
      const raw = get('assessment', soap.assessment);
      if (!raw) return raw;
      // Strip history preamble — assessment must never start with patient history sections
      if (/^(Presenting History|Past Medical History|Surgical History|Medications?|Allergies?|History)\s*:/i.test(raw.trim())) {
        const wdIdx = raw.search(/Working Diagnosis:|Clinical Impression:|Impression:|Assessment\s*:/i);
        return wdIdx > 0 ? raw.slice(wdIdx).trim() : '';
      }
      const wdIdx = raw.search(/Working Diagnosis:|Clinical Impression:|Impression:|Assessment\s*:/i);
      return wdIdx > 10 ? raw.slice(wdIdx).trim() : raw;
    })();
    if (assessment) ctx.setAssessment(ctx.assessment ? ctx.assessment + '\n\n' + assessment : assessment);

    const plan = get('plan', soap.plan);
    if (plan) ctx.setPlan(ctx.plan ? ctx.plan + '\n\n' + plan : plan);

    const allergies = get('allergies', soap.allergies);
    if (allergies) ctx.setAllergies(allergies);

    if (soap.pmh?.length && decisions['pmh'] !== 'rejected') {
      const pmhText = soap.pmh.join('; ');
      ctx.setFreeText(ctx.freeText ? ctx.freeText + '\nPMH (dictated): ' + pmhText : 'PMH (dictated): ' + pmhText);
    }

    const unseg = get('unsegmented', soap.unsegmented);
    if (unseg) ctx.setFreeText(ctx.freeText ? ctx.freeText + '\n\n' + unseg : unseg);

    // Record clinician review in the DB (fire-and-forget — don't block UI)
    if (proposalId) {
      const approvedSections = Object.keys(decisions).filter(k => decisions[k] !== 'rejected');
      void staffAuthHeaders().then(h =>
        fetch(`/api/ai-proposals/${proposalId}/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...h },
          body: JSON.stringify({
            decision: 'approved',
            approvedContent: { sections: approvedSections, edits },
          }),
        }).catch(() => { /* non-fatal */ }),
      );
    }

    setLoaded(true);
    setTimeout(() => onClose?.(), 800);
  }

  function setDecision(key: string, d: Decision) {
    setDecisions(prev => ({ ...prev, [key]: d }));
    if (d !== 'approved') setEditingKey(null);
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
            {recording ? 'Recording…' : soap ? 'Review AI draft before filing' : 'Voice Dictation'}
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

      {/* AI draft review — per-section approve / edit / reject */}
      {soap && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              ✦ AI Draft — review before filing
            </span>
            {segmentSource && (
              <span style={{
                fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 9,
                background: segmentSource === 'local' ? 'rgba(245,158,11,.2)' : segmentSource === 'ollama' ? 'rgba(16,185,129,.2)' : 'rgba(59,130,246,.15)',
                color: segmentSource === 'local' ? '#d97706' : segmentSource === 'ollama' ? '#059669' : '#60a5fa',
                letterSpacing: '0.07em', textTransform: 'uppercase',
              }}>
                {segmentSource === 'local' ? '⚡ Local' : segmentSource === 'ollama' ? '🟢 Ollama' : '☁ Cloud'}
              </span>
            )}
          </div>

          {([
            ['hpi', 'HPI', soap.hpi],
            ['assessment', 'Assessment', soap.assessment],
            ['plan', 'Plan', soap.plan],
            ['allergies', 'Allergies', soap.allergies],
            ...Object.entries(soap.examination ?? {})
              .filter(([, v]) => v?.trim())
              .map(([k, v]) => [`exam_${k}`, `Exam — ${k}`, v]),
            ['unsegmented', 'Unsegmented', soap.unsegmented],
          ] as [string, string, string | undefined][])
            .filter(([, , v]) => v?.trim())
            .map(([key, label, text]) => {
              const dec = decisions[key] ?? 'pending';
              const isEditing = editingKey === key;
              const borderColor = dec === 'approved' ? '#059669' : dec === 'rejected' ? '#ef4444' : '#1e3a5f';
              return (
                <div key={key} style={{ background: '#0d1b2e', border: `1px solid ${borderColor}`, borderRadius: 7, padding: '8px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: dec === 'approved' ? '#34d399' : dec === 'rejected' ? '#f87171' : '#0d9488', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      {label}
                      {dec === 'approved' && ' ✓'}
                      {dec === 'rejected' && ' ✕'}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button"
                        onClick={() => setDecision(key, dec === 'approved' ? 'pending' : 'approved')}
                        style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                          background: dec === 'approved' ? '#059669' : 'rgba(5,150,105,0.15)', color: dec === 'approved' ? '#fff' : '#34d399', fontWeight: 700 }}>
                        ✓ Approve
                      </button>
                      <button type="button"
                        onClick={() => { setEditingKey(isEditing ? null : key); if (!isEditing) setEdits(prev => ({ ...prev, [key]: edits[key] ?? (text ?? '') })); }}
                        style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                          background: isEditing ? '#92400e' : 'rgba(245,158,11,0.15)', color: isEditing ? '#fde68a' : '#fbbf24', fontWeight: 700 }}>
                        ✎ Edit
                      </button>
                      <button type="button"
                        onClick={() => setDecision(key, dec === 'rejected' ? 'pending' : 'rejected')}
                        style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
                          background: dec === 'rejected' ? '#991b1b' : 'rgba(239,68,68,0.15)', color: dec === 'rejected' ? '#fff' : '#f87171', fontWeight: 700 }}>
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                  {isEditing ? (
                    <textarea
                      value={edits[key] ?? (text ?? '')}
                      onChange={e => setEdits(prev => ({ ...prev, [key]: e.target.value }))}
                      onBlur={() => { setEditingKey(null); setDecisions(prev => ({ ...prev, [key]: 'approved' })); }}
                      rows={4}
                      style={{ width: '100%', background: '#0a1628', border: '1px solid #fbbf24', borderRadius: 5,
                        color: '#fde68a', fontSize: 12, fontFamily: 'Georgia, serif', lineHeight: 1.6, padding: '6px 8px',
                        boxSizing: 'border-box', resize: 'vertical', outline: 'none' }}
                      autoFocus
                    />
                  ) : (
                    <div style={{ fontFamily: 'Georgia, serif', fontSize: 12, lineHeight: 1.6,
                      color: dec === 'rejected' ? '#475569' : '#cbd5e1',
                      textDecoration: dec === 'rejected' ? 'line-through' : 'none' }}>
                      {edits[key] ?? text}
                    </div>
                  )}
                </div>
              );
            })}
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

        {soap && !loaded && (() => {
          const approvedCount = Object.values(decisions).filter(d => d === 'approved').length +
            // sections with edits saved count as approved
            Object.keys(edits).filter(k => edits[k]?.trim() && decisions[k] !== 'rejected').length;
          return (
            <button
              type="button"
              onClick={() => void fileApproved()}
              disabled={approvedCount === 0}
              title={approvedCount === 0 ? 'Approve at least one section before filing' : undefined}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none',
                cursor: approvedCount === 0 ? 'not-allowed' : 'pointer',
                background: approvedCount > 0 ? '#0d9488' : '#1e3a5f',
                color: approvedCount > 0 ? '#fff' : '#475569',
                fontSize: 13, fontWeight: 800, opacity: approvedCount === 0 ? 0.6 : 1,
              }}
            >
              ↓ File {approvedCount > 0 ? `${approvedCount} approved` : 'approved sections'}
            </button>
          );
        })()}

        {loaded && (
          <div style={{ padding: '8px 14px', borderRadius: 8, background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 700 }}>
            ✓ Loaded
          </div>
        )}

        {transcript && (
          <button
            type="button"
            onClick={() => { setTranscript(''); setSoap(null); setLoaded(false); setError(null); setSegmentSource(null); setDecisions({}); setEdits({}); setEditingKey(null); setProposalId(null); }}
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
