/**
 * AmbientConsultation — surgical consultation cockpit.
 *
 * Design principles:
 *  - CC + HPI are the primary real estate. Everything else is secondary.
 *  - Mic is compact and inline — not a billboard.
 *  - Vitals are pre-consult. Hidden unless abnormal; if abnormal, flagged top-right.
 *  - SOAP lives in the final document (SummaryTab), not here.
 *  - Section navigation is prominent above the fold, not buried.
 *  - Bayesian DX engine updates live from dictation.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppContext, type Section } from '@/context/AppContext';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { getAIProviderConfig, segmentSoapWithOllama, type SegmentedSoap } from '@/lib/ai-provider';
import { localSegmentSoap } from '@/lib/local-soap-segmenter';
import { getApiOrigin } from '@/lib/api-origin';
import { getMatrix } from '@/lib/cc-matrices';
import { DISEASES, initPaneState, updatePosterior, topDiagnoses, applyModifiers, getProtocol } from '@workspace/pane-engine';
import { extractFeaturesFromTranscript, detectPathognomonic, type PathognomicMatch } from '@/lib/transcript-dx-mapper';

// ── Web Speech API ─────────────────────────────────────────────────────────────

const SR_CLASS = (typeof window !== 'undefined')
  ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
  : null;
const SPEECH_SUPPORTED = !!SR_CLASS;

// ── Abnormal vitals detection ──────────────────────────────────────────────────

function abnormalVitals(vitals: Record<string, string>): string[] {
  const flags: string[] = [];
  const sbp  = parseFloat(vitals.systolicBp);
  const dbp  = parseFloat(vitals.diastolicBp);
  const hr   = parseFloat(vitals.heartRate);
  const rr   = parseFloat(vitals.respiratoryRate);
  const spo2 = parseFloat(vitals.spo2);
  const temp = parseFloat(vitals.temperatureC);

  if (Number.isFinite(sbp))  { if (sbp  > 160) flags.push(`SBP ${Math.round(sbp)}`);  if (sbp  < 90)  flags.push(`SBP ${Math.round(sbp)}↓`); }
  if (Number.isFinite(dbp))  { if (dbp  > 100) flags.push(`DBP ${Math.round(dbp)}`); }
  if (Number.isFinite(hr))   { if (hr   > 100) flags.push(`HR ${Math.round(hr)}↑`);   if (hr   < 50)  flags.push(`HR ${Math.round(hr)}↓`); }
  if (Number.isFinite(rr))   { if (rr   > 20)  flags.push(`RR ${Math.round(rr)}↑`);   if (rr   < 10)  flags.push(`RR ${Math.round(rr)}↓`); }
  if (Number.isFinite(spo2)) { if (spo2 < 94)  flags.push(`SpO₂ ${Math.round(spo2)}%↓`); }
  if (Number.isFinite(temp)) { if (temp > 38.5) flags.push(`T ${temp.toFixed(1)}°C`); if (temp < 36.0) flags.push(`T ${temp.toFixed(1)}°C↓`); }

  return flags;
}

// ── Section navigation map ─────────────────────────────────────────────────────
// Ordered for surgical outpatient consultation. Sections after 'hpi' only.

const SECTION_NAV: Partial<Record<Section, { label: string; icon: string }>> = {
  pmh:           { label: 'PMH',         icon: '📋' },
  surgical:      { label: 'Surgical Hx', icon: '🔪' },
  medications:   { label: 'Medications', icon: '💊' },
  allergies:     { label: 'Allergies',   icon: '⚠️' },
  family_hx:     { label: 'Family Hx',  icon: '🧬' },
  ros:           { label: 'Systems',     icon: '🔍' },
  examination:   { label: 'Exam',        icon: '🩺' },
  investigations:{ label: 'Labs',        icon: '🧪' },
  radiology:     { label: 'Imaging',     icon: '📡' },
  attachments:   { label: 'Reports',     icon: '📎' },
  assessment:    { label: 'Assessment',  icon: '🎯' },
  plan:          { label: 'Plan',        icon: '📝' },
  procedures:    { label: 'Procedure',   icon: '⚕️' },
  prescriptions: { label: 'Rx',          icon: '💉' },
};

// Fallback order when no CC matrix is active
const DEFAULT_NAV_ORDER: Section[] = [
  'pmh', 'surgical', 'medications', 'allergies',
  'examination', 'investigations', 'radiology',
  'assessment', 'plan',
];

type SegmentSource = 'local' | 'ollama' | 'cloud';

async function persistCallLog(
  patientId: string | null | undefined,
  transcript: string,
  soap: unknown,
  source: SegmentSource,
): Promise<void> {
  if (!patientId || source === 'cloud') return;
  try {
    const headers = await staffAuthHeaders();
    const apiOrigin = getApiOrigin();
    const url = apiOrigin ? `${apiOrigin}/api/calls/ingest` : '/api/calls/ingest';
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ patient_id: patientId, source: 'ambient', direction: 'ambient', transcript, soap_segmented: soap }),
    });
  } catch { /* non-fatal */ }
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  visitType?: string;
  onDetailedMode: () => void;
  onFinalise: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AmbientConsultation({ visitType, onDetailedMode, onFinalise }: Props) {
  const ctx = useAppContext();
  const {
    activeCcKey, symptoms, hpiNotes, setHpiNotes,
    vitals, setActiveSection, patientName, age, sex,
    allergies: allergyText,
  } = ctx;

  // Voice state
  const [micOpen, setMicOpen]         = useState(false);
  const [recording, setRecording]     = useState(false);
  const [transcript, setTranscript]   = useState('');
  const [interim, setInterim]         = useState('');
  const [segmenting, setSegmenting]   = useState(false);
  const [pendingSoap, setPendingSoap] = useState<SegmentedSoap | null>(null);
  const [voiceError, setVoiceError]   = useState<string | null>(null);
  const [accepted, setAccepted]       = useState(false);
  const [segmentSource, setSegmentSource] = useState<SegmentSource | null>(null);
  const recogRef = useRef<SpeechRecognition | null>(null);

  // Photo state
  const [photosOpen, setPhotosOpen]   = useState(false);
  const [cameraRef] = useState(() => ({ current: null as HTMLInputElement | null }));

  // DX engine
  const [pathognomicAlerts, setPathognomicAlerts] = useState<PathognomicMatch[]>([]);
  const [dxUpdatedAt, setDxUpdatedAt] = useState<number | null>(null);

  // Derive CC context
  const ccMatrix = activeCcKey ? getMatrix(activeCcKey) : null;
  const ccLabel  = ccMatrix?.name ?? (symptoms.length > 0 ? symptoms.slice(0, 2).join(', ') : null);

  // Vitals: only surface abnormal values
  const vitalFlags = abnormalVitals(vitals as Record<string, string>);

  // Build ordered section nav from CC matrix or default
  const navSections: Section[] = ccMatrix
    ? (ccMatrix.sections.filter(s => s !== 'hpi' && s in SECTION_NAV) as Section[])
    : DEFAULT_NAV_ORDER;

  // ── Voice helpers ────────────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    recogRef.current?.stop();
    setRecording(false);
    setInterim('');
  }, []);

  const startRecording = useCallback(() => {
    if (!SR_CLASS) return;
    setPendingSoap(null);
    setAccepted(false);
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
      const local = localSegmentSoap(text);
      if (local.confidence >= 0.7) {
        setPendingSoap(local.segmented);
        setSegmentSource('local');
        void persistCallLog(ctx.patientId, text, local.segmented, 'local');
        return;
      }

      const aiConfig = getAIProviderConfig();
      if (aiConfig.type === 'ollama') {
        try {
          const r = await segmentSoapWithOllama(text, visitType, aiConfig);
          setPendingSoap(r);
          setSegmentSource('ollama');
          void persistCallLog(ctx.patientId, text, r, 'ollama');
          return;
        } catch { /* fall through */ }
      }

      const apiOrigin = getApiOrigin();
      const url = apiOrigin ? `${apiOrigin}/api/voice/segment` : '/api/voice/segment';
      const headers = await staffAuthHeaders();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ transcript: text, visitType, patientId: ctx.patientId ?? undefined }),
      });
      const data = await res.json() as { segmented?: SegmentedSoap; error?: string };
      if (!res.ok || !data.segmented) throw new Error(data.error ?? 'Segmentation failed');
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

    if (s.hpi?.trim()) setHpiNotes(hpiNotes ? hpiNotes + '\n\n' + s.hpi : s.hpi);
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
      if (ex.general?.trim())       ctx.setExamGeneral(ex.general);
      if (ex.cardiovascular?.trim()) ctx.setExamCardio(ex.cardiovascular);
      if (ex.respiratory?.trim())    ctx.setExamResp(ex.respiratory);
      if (ex.abdomen?.trim())        ctx.setExamAbdomen(ex.abdomen);
    }
    if (s.pmh?.length) {
      const txt = s.pmh.join('; ');
      ctx.setFreeText(ctx.freeText ? ctx.freeText + '\nPMH (dictated): ' + txt : 'PMH (dictated): ' + txt);
    }
    if (s.unsegmented?.trim()) {
      ctx.setFreeText(ctx.freeText ? ctx.freeText + '\n\n' + s.unsegmented : s.unsegmented);
    }

    // Bayesian DX update from transcript
    void (async () => {
      const fullText = transcript;
      if (!fullText.trim()) return;
      const patho = detectPathognomonic(fullText);
      if (patho.length) setPathognomicAlerts(patho);
      const observed = extractFeaturesFromTranscript(fullText);
      if (!observed.length) return;
      const ageN = ctx.age ? parseInt(ctx.age, 10) : null;
      const modDiseases = applyModifiers(DISEASES, ageN, ctx.sex);
      let state = ctx.paneState ?? initPaneState(modDiseases);
      for (const { featureId, observed: obs } of observed) state = updatePosterior(state, modDiseases, featureId, obs);
      const top = topDiagnoses(state, modDiseases, 8);
      ctx.setPaneState(state);
      ctx.setPaneTop(top);
      setDxUpdatedAt(Date.now());
    })();

    setPendingSoap(null);
    setTranscript('');
    setAccepted(true);
    setTimeout(() => setAccepted(false), 3000);
  }

  function goToSection(s: Section) {
    setActiveSection(s);
    onDetailedMode();
  }

  const fullTranscript = transcript + (interim ? interim : '');

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── CC / patient context bar ─── */}
      {(ccLabel || vitalFlags.length > 0) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 12px', borderRadius: 8,
          background: 'var(--surface, #1e293b)',
          border: '1px solid var(--line, #334155)',
          gap: 8, flexWrap: 'nowrap', overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
            {ccLabel && (
              <span style={{
                fontSize: 13, fontWeight: 700, color: 'var(--ink, #f1f5f9)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {ccLabel}
              </span>
            )}
            {visitType && (
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                color: '#0d9488', background: 'rgba(13,148,136,0.12)',
                border: '1px solid rgba(13,148,136,0.3)',
                borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                {visitType.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          {/* Abnormal vitals badge — only shown if triggered */}
          {vitalFlags.length > 0 && (
            <button
              type="button"
              onClick={() => goToSection('monitoring')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 9px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: '#7f1d1d', color: '#fca5a5',
                fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
              }}
              title="Abnormal vitals — tap to review"
            >
              ⚠ {vitalFlags.join(' · ')}
            </button>
          )}
        </div>
      )}

      {/* ── Presenting History — primary field ─── */}
      <div style={{
        borderRadius: 10,
        border: '1px solid var(--line, #334155)',
        background: 'var(--card, #111827)',
        overflow: 'hidden',
      }}>
        {/* Label row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px 0',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: '#64748b',
          }}>
            Presenting History
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* Inline mic toggle */}
            <button
              type="button"
              onClick={() => {
                if (!micOpen) { setMicOpen(true); if (!recording && !pendingSoap) startRecording(); }
                else if (recording) void handleSegment();
                else setMicOpen(false);
              }}
              disabled={!SPEECH_SUPPORTED && !micOpen}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 700,
                background: recording ? '#dc2626' : micOpen ? '#0d9488' : 'rgba(13,148,136,0.12)',
                color: recording ? '#fff' : micOpen ? '#fff' : '#0d9488',
                transition: 'all 0.15s',
              }}
              title={recording ? 'Stop & analyse' : micOpen ? 'Close mic' : 'Dictate HPI'}
            >
              <span style={{
                display: 'inline-block', width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: recording ? '#fff' : 'currentColor',
                animation: recording ? 'ambPulse 1s ease-in-out infinite' : 'none',
              }} />
              {recording ? 'Stop' : segmenting ? 'Analysing…' : accepted ? '✓ Loaded' : '🎙 Dictate'}
            </button>
            {/* Go to full HPI tab */}
            <button
              type="button"
              onClick={() => goToSection('hpi')}
              style={{
                padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                border: '1px solid var(--line, #334155)', background: 'transparent',
                color: '#64748b', cursor: 'pointer',
              }}
              title="Open full HPI editor"
            >
              Full HPI ↗
            </button>
          </div>
        </div>

        {/* HPI textarea */}
        <textarea
          value={hpiNotes}
          onChange={e => setHpiNotes(e.target.value)}
          placeholder={
            ccLabel
              ? `Presenting history — ${ccLabel}. Dictate or type directly.`
              : 'Presenting history — tap 🎙 Dictate to start, or type directly.'
          }
          style={{
            display: 'block', width: '100%', minHeight: 130,
            padding: '10px 12px', border: 'none', resize: 'vertical',
            background: 'transparent', color: 'var(--ink, #f1f5f9)',
            fontSize: 13, lineHeight: 1.7, fontFamily: 'Georgia, serif',
            outline: 'none', boxSizing: 'border-box',
          }}
        />

        {/* Mic expansion panel — only when open */}
        {micOpen && (
          <div style={{
            borderTop: `1px solid ${recording ? 'rgba(220,38,38,0.4)' : 'var(--line, #334155)'}`,
            padding: '8px 12px',
            background: recording ? 'rgba(220,38,38,0.05)' : 'rgba(13,148,136,0.04)',
          }}>
            {/* Transcript rolling preview */}
            {(fullTranscript || recording) && (
              <div style={{
                fontSize: 12, lineHeight: 1.6, color: '#94a3b8',
                fontFamily: 'Georgia, serif', maxHeight: 72, overflowY: 'auto',
                marginBottom: pendingSoap ? 8 : 0,
              }}>
                {transcript}
                {interim && <span style={{ color: '#475569' }}>{interim}</span>}
                {recording && !fullTranscript && (
                  <span style={{ color: '#475569', fontStyle: 'italic' }}>Listening…</span>
                )}
              </div>
            )}

            {/* SOAP preview — after stop & segment */}
            {pendingSoap && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.06em' }}>
                  PREVIEW — review then accept
                  {segmentSource && (
                    <span style={{
                      marginLeft: 8, fontSize: 9, padding: '1px 6px', borderRadius: 8,
                      background: segmentSource === 'cloud' ? 'rgba(59,130,246,.2)' : 'rgba(16,185,129,.2)',
                      color: segmentSource === 'cloud' ? '#60a5fa' : '#059669',
                    }}>
                      {segmentSource === 'local' ? '⚡ Local' : segmentSource === 'ollama' ? '🟢 Ollama' : '🤖 Cloud'}
                    </span>
                  )}
                </div>
                {([
                  ['HPI', pendingSoap.hpi],
                  ['Assessment', pendingSoap.assessment],
                  ['Plan', pendingSoap.plan],
                  ...Object.entries(pendingSoap.examination ?? {}).filter(([, v]) => v?.trim()).map(([k, v]) => [`Exam — ${k}`, v]),
                ] as [string, string | undefined][]).filter(([, v]) => v?.trim()).map(([label, text]) => (
                  <div key={label} style={{
                    background: 'var(--surface, #1e293b)', borderRadius: 6, padding: '6px 10px',
                    border: '1px solid var(--line, #334155)',
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#0d9488', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 12, lineHeight: 1.5, color: '#cbd5e1', fontFamily: 'Georgia, serif' }}>{text}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                  <button
                    type="button" onClick={acceptSoap}
                    style={{
                      flex: 1, padding: '7px', borderRadius: 7, border: 'none',
                      background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    }}
                  >
                    ↓ Accept
                  </button>
                  <button
                    type="button" onClick={() => { setPendingSoap(null); setTranscript(''); }}
                    style={{
                      padding: '7px 14px', borderRadius: 7, border: '1px solid var(--line, #334155)',
                      background: 'transparent', color: '#64748b', fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}

            {/* Controls row */}
            {!pendingSoap && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {!recording && transcript && !segmenting && (
                  <button
                    type="button" onClick={() => void handleSegment()}
                    style={{
                      padding: '5px 14px', borderRadius: 6, border: 'none',
                      background: '#0d9488', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Analyse transcript →
                  </button>
                )}
                {!recording && (
                  <button
                    type="button" onClick={() => { setTranscript(''); setVoiceError(null); setMicOpen(false); }}
                    style={{
                      padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      border: '1px solid var(--line, #334155)', background: 'transparent', color: '#64748b', cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                )}
                {segmenting && (
                  <span style={{ fontSize: 11, color: '#f59e0b' }}>Analysing…</span>
                )}
              </div>
            )}

            {voiceError && (
              <div style={{ marginTop: 6, fontSize: 11, color: '#fca5a5', padding: '4px 8px', borderRadius: 5, background: 'rgba(220,38,38,0.1)' }}>
                {voiceError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Algorithm section navigation ─── */}
      {navSections.length > 0 && (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#64748b', marginBottom: 6,
          }}>
            Continue with
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {navSections.map(s => {
              const nav = SECTION_NAV[s];
              if (!nav) return null;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => goToSection(s)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                    border: '1.5px solid var(--line, #334155)',
                    background: 'var(--surface, #1e293b)',
                    color: 'var(--ink, #e2e8f0)',
                    fontSize: 12, fontWeight: 600,
                    transition: 'border-color 0.12s, background 0.12s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#0d9488';
                    (e.currentTarget as HTMLButtonElement).style.color = '#0d9488';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line, #334155)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--ink, #e2e8f0)';
                  }}
                >
                  {nav.icon} {nav.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Footer bar: photos + summary ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setPhotosOpen(p => !p)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 8,
            border: '1px solid var(--line, #334155)',
            background: 'var(--surface, #1e293b)',
            color: photosOpen ? '#0d9488' : '#64748b',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          📷 Photos {ctx.examPhotos.length > 0 ? `(${ctx.examPhotos.length})` : ''}
        </button>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => goToSection('examination')}
          style={{
            padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            border: '1px solid rgba(13,148,136,0.4)', background: 'rgba(13,148,136,0.08)', color: '#0d9488',
          }}
        >
          🩺 Exam →
        </button>
        <button
          type="button"
          onClick={onFinalise}
          style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer',
            border: '2px solid #0d9488', background: '#0d9488', color: '#fff',
          }}
        >
          📋 Summary
        </button>
      </div>

      {/* Photos panel */}
      {photosOpen && (
        <div style={{ padding: '10px 12px', borderRadius: 10, border: '1px solid var(--line, #334155)', background: 'var(--surface, #1e293b)' }}>
          <input
            ref={el => { cameraRef.current = el; }}
            type="file" accept="image/*" capture="environment"
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
            type="button" onClick={() => cameraRef.current?.click()}
            style={{ padding: '7px 14px', borderRadius: 7, border: '1.5px solid #0d9488', background: '#f0fdfa', color: '#0d9488', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            📷 Capture photo
          </button>
          {ctx.examPhotos.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {ctx.examPhotos.map(p => (
                <div key={p.id} style={{ position: 'relative', width: 68, height: 68 }}>
                  <img src={p.dataUrl} alt={p.bodyRegion} style={{ width: 68, height: 68, borderRadius: 7, objectFit: 'cover', border: '1.5px solid #e2e8f0' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Live DX from transcript ─── */}
      {(pathognomicAlerts.length > 0 || (dxUpdatedAt && ctx.paneTop.length > 0)) && (
        <div style={{ borderTop: '1px solid var(--line, #334155)', paddingTop: 10 }}>
          {pathognomicAlerts.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {pathognomicAlerts.map(a => (
                <div key={a.diseaseId} style={{
                  background: a.specificity === 'definitive' ? '#fef2f2' : '#fffbeb',
                  border: `1px solid ${a.specificity === 'definitive' ? '#fca5a5' : '#fde68a'}`,
                  borderRadius: 7, padding: '5px 10px', marginBottom: 4,
                  fontSize: 12, color: a.specificity === 'definitive' ? '#991b1b' : '#92400e',
                  display: 'flex', gap: 6, alignItems: 'center',
                }}>
                  <span style={{ fontWeight: 800 }}>{a.specificity === 'definitive' ? '⚠ Pathognomonic:' : '◈ Strong indicator:'}</span>
                  {a.diseaseLabel}
                  <span style={{ opacity: 0.6, fontStyle: 'italic' }}>— {a.finding}</span>
                </div>
              ))}
            </div>
          )}
          {ctx.paneTop.length > 0 && (
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', color: '#64748b', marginBottom: 6, textTransform: 'uppercase' }}>
                Differential (from transcript)
              </div>
              {ctx.paneTop.slice(0, 3).map(r => (
                <div key={r.disease.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ flex: 1, height: 18, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${Math.round(r.probability * 100)}%`,
                      background: r.probability > 0.5 ? '#0d9488' : r.probability > 0.25 ? '#f59e0b' : '#94a3b8',
                      borderRadius: 4,
                    }} />
                    <span style={{ position: 'absolute', left: 6, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 11, fontWeight: 600, color: r.probability > 0.5 ? '#fff' : '#0f172a' }}>
                      {r.disease.label}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, minWidth: 34, color: '#64748b', textAlign: 'right' }}>
                    {Math.round(r.probability * 100)}%
                  </span>
                </div>
              ))}
              {(() => {
                const top1 = ctx.paneTop[0];
                if (!top1 || top1.probability < 0.3) return null;
                const proto = getProtocol(top1.disease.id);
                if (!proto) return null;
                const statInvx = proto.investigations.filter(i => i.urgency === 'stat' || i.urgency === 'urgent').slice(0, 3);
                if (!statInvx.length) return null;
                return (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#334155' }}>
                    <div style={{ fontWeight: 700, fontSize: 10, letterSpacing: '.08em', color: '#0d9488', textTransform: 'uppercase', marginBottom: 4 }}>
                      If {top1.disease.label}
                    </div>
                    {statInvx.map(i => (
                      <div key={i.label} style={{ display: 'flex', gap: 5, marginBottom: 2 }}>
                        <span style={{ color: i.urgency === 'stat' ? '#dc2626' : '#d97706', fontWeight: 700 }}>{i.urgency.toUpperCase()}</span>
                        <span>{i.label}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes ambPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
