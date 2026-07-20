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

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useAppContext, type Section } from '@/context/AppContext';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { getAIProviderConfig, segmentSoapWithOllama, type SegmentedSoap } from '@/lib/ai-provider';
import { localSegmentSoap } from '@/lib/local-soap-segmenter';
import { getApiOrigin } from '@/lib/api-origin';
import { getMatrix } from '@/lib/cc-matrices';
import { DISEASES, initPaneState, updatePosterior, topDiagnoses, applyModifiers, getProtocol } from '@workspace/pane-engine';
import { extractFeaturesFromTranscript, detectPathognomonic, type PathognomicMatch } from '@/lib/transcript-dx-mapper';
import { computeReminders } from '@/lib/safety-engine';

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
    vitals, setActiveSection,
    examNotes, assessment, setAssessment, plan, setPlan,
    orderedInvestigations, radiologyRequests,
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
  const [cameraRef] = useState(() => ({ current: null as HTMLInputElement | null }));

  // DX engine
  const [pathognomicAlerts, setPathognomicAlerts] = useState<PathognomicMatch[]>([]);
  const [dxUpdatedAt, setDxUpdatedAt] = useState<number | null>(null);

  // Derive CC context
  const ccMatrix = activeCcKey ? getMatrix(activeCcKey) : null;
  const ccLabel  = ccMatrix?.name ?? (symptoms.length > 0 ? symptoms.slice(0, 2).join(', ') : null);

  // Vitals: only surface abnormal values
  const vitalFlags = abnormalVitals(vitals as Record<string, string>);

  // Passive safety reminders — recomputed whenever relevant state changes
  const safetyReminders = useMemo(() => computeReminders({
    activeCcKey,
    symptoms,
    hpiNotes,
    examNotes,
    assessment,
    plan,
    orderedInvestigations,
    radiologyRequests: radiologyRequests as object[],
  }), [activeCcKey, symptoms, hpiNotes, examNotes, assessment, plan, orderedInvestigations, radiologyRequests]);

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

  // Auto-start mic when consultation mounts with a fresh patient (no prior HPI)
  useEffect(() => {
    if (!SPEECH_SUPPORTED) return;
    if (hpiNotes.trim()) return; // don't auto-start if patient already has documented history
    setMicOpen(true);
    startRecording();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* ── HPI card — primary workspace, fills available height ── */}
      <div style={{
        borderRadius: 10, border: '1px solid #334155', background: '#111827',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 10px', borderBottom: '1px solid #1a2535',
        }}>
          {/* Mic toggle */}
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
              background: recording ? '#dc2626' : micOpen ? '#0d9488' : 'rgba(13,148,136,0.14)',
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
          <button
            type="button" onClick={() => goToSection('hpi')}
            style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, border: '1px solid #1e293b', background: 'transparent', color: '#475569', cursor: 'pointer' }}
            title="Open full HPI editor"
          >Full ↗</button>
          <span style={{ flex: 1 }} />
          {/* Inline DX hint */}
          {ctx.paneTop[0] && ctx.paneTop[0].probability > 0.3 && (
            <span style={{ fontSize: 10, color: '#475569', whiteSpace: 'nowrap' }}>
              📍 {ctx.paneTop[0].disease.label} {Math.round(ctx.paneTop[0].probability * 100)}%
            </span>
          )}
          {/* Abnormal vitals */}
          {vitalFlags.length > 0 && (
            <button
              type="button" onClick={() => goToSection('monitoring')}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 5, border: 'none', cursor: 'pointer', background: '#7f1d1d', color: '#fca5a5', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}
              title="Abnormal vitals"
            >⚠ {vitalFlags.join(' · ')}</button>
          )}
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
            display: 'block', width: '100%', minHeight: '50vh',
            padding: '12px', border: 'none', resize: 'vertical',
            background: 'transparent', color: '#f1f5f9',
            fontSize: 13, lineHeight: 1.7, fontFamily: 'Georgia, serif',
            outline: 'none', boxSizing: 'border-box',
          }}
        />

        {/* Mic expansion panel */}
        {micOpen && (
          <div style={{
            borderTop: `1px solid ${recording ? 'rgba(220,38,38,0.4)' : '#334155'}`,
            padding: '8px 12px',
            background: recording ? 'rgba(220,38,38,0.05)' : 'rgba(13,148,136,0.04)',
          }}>
            {(fullTranscript || recording) && (
              <div style={{ fontSize: 12, lineHeight: 1.6, color: '#94a3b8', fontFamily: 'Georgia, serif', maxHeight: 72, overflowY: 'auto', marginBottom: pendingSoap ? 8 : 0 }}>
                {transcript}
                {interim && <span style={{ color: '#475569' }}>{interim}</span>}
                {recording && !fullTranscript && <span style={{ color: '#475569', fontStyle: 'italic' }}>Listening…</span>}
              </div>
            )}
            {!pendingSoap && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {!recording && transcript && !segmenting && (
                  <button type="button" onClick={() => void handleSegment()} style={{ padding: '5px 14px', borderRadius: 6, border: 'none', background: '#0d9488', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                    Analyse →
                  </button>
                )}
                {!recording && (
                  <button type="button" onClick={() => { setTranscript(''); setVoiceError(null); setMicOpen(false); }} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, border: '1px solid #334155', background: 'transparent', color: '#64748b', cursor: 'pointer' }}>
                    Close
                  </button>
                )}
                {segmenting && <span style={{ fontSize: 11, color: '#f59e0b' }}>Analysing…</span>}
              </div>
            )}
            {voiceError && <div style={{ marginTop: 6, fontSize: 11, color: '#fca5a5', padding: '4px 8px', borderRadius: 5, background: 'rgba(220,38,38,0.1)' }}>{voiceError}</div>}
          </div>
        )}
      </div>

      {/* ── SOAP preview ── */}
      {pendingSoap && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', borderRadius: 10, border: '1px solid #334155', background: '#111827' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b', letterSpacing: '0.06em' }}>
            PREVIEW — review then accept
            {segmentSource && (
              <span style={{ marginLeft: 8, fontSize: 9, padding: '1px 6px', borderRadius: 8, background: segmentSource === 'cloud' ? 'rgba(59,130,246,.2)' : 'rgba(16,185,129,.2)', color: segmentSource === 'cloud' ? '#60a5fa' : '#059669' }}>
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
            <div key={label} style={{ background: '#1e293b', borderRadius: 6, padding: '6px 10px', border: '1px solid #334155' }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#0d9488', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 12, lineHeight: 1.5, color: '#cbd5e1', fontFamily: 'Georgia, serif' }}>{text}</div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={acceptSoap} style={{ flex: 1, padding: '7px', borderRadius: 7, border: 'none', background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              ↓ Accept
            </button>
            <button type="button" onClick={() => { setPendingSoap(null); setTranscript(''); }} style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #334155', background: 'transparent', color: '#64748b', fontSize: 12, cursor: 'pointer' }}>
              Discard
            </button>
          </div>
        </div>
      )}

      {/* ── Pathognomic alerts ── */}
      {pathognomicAlerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {pathognomicAlerts.map(a => (
            <div key={a.diseaseId} style={{ background: a.specificity === 'definitive' ? '#fef2f2' : '#fffbeb', border: `1px solid ${a.specificity === 'definitive' ? '#fca5a5' : '#fde68a'}`, borderRadius: 7, padding: '5px 10px', fontSize: 12, color: a.specificity === 'definitive' ? '#991b1b' : '#92400e', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontWeight: 800 }}>{a.specificity === 'definitive' ? '⚠ Pathognomonic:' : '◈ Strong indicator:'}</span>
              {a.diseaseLabel}
              <span style={{ opacity: 0.6, fontStyle: 'italic' }}>— {a.finding}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Safety flag chips — urgent only, compact ── */}
      {safetyReminders.filter(r => r.urgency === 'flag').length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {safetyReminders.filter(r => r.urgency === 'flag').map(r => (
            <button
              key={r.id} type="button" onClick={() => goToSection(r.section)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 20, border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.06)', color: '#d97706', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              ◈ {r.text}
            </button>
          ))}
        </div>
      )}

      {/* ── Assessment + Plan quick-entry ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {([
          ['Assessment', assessment, setAssessment, 'Provisional diagnosis…', '#0d9488'],
          ['Plan', plan, setPlan, 'Management plan…', '#475569'],
        ] as [string, string, (v: string) => void, string, string][]).map(([label, value, setter, placeholder, labelColor]) => (
          <div key={label} style={{ background: '#111827', borderRadius: 8, border: '1px solid #334155', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '5px 10px', fontSize: 9, fontWeight: 800, letterSpacing: '.1em', color: labelColor, textTransform: 'uppercase', borderBottom: '1px solid #1a2535', flexShrink: 0 }}>
              {label}
            </div>
            <textarea
              value={value}
              onChange={e => setter(e.target.value)}
              placeholder={placeholder}
              style={{ display: 'block', width: '100%', minHeight: 72, padding: '8px 10px', border: 'none', background: 'transparent', color: '#f1f5f9', fontSize: 12, lineHeight: 1.6, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>
        ))}
      </div>

      {/* ── Photos + Summary row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 7, border: '1px solid #334155', background: '#1e293b', color: '#64748b', fontSize: 12, cursor: 'pointer' }}
          title="Add photo"
        >📷{ctx.examPhotos.length > 0 ? ` ${ctx.examPhotos.length}` : ''}</button>
        {ctx.examPhotos.map(p => (
          <div key={p.id} style={{ width: 44, height: 44, flexShrink: 0 }}>
            <img src={p.dataUrl} alt={p.bodyRegion} style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover', border: '1.5px solid #334155' }} />
          </div>
        ))}
        <span style={{ flex: 1 }} />
        <button
          type="button" onClick={onFinalise}
          style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: '2px solid #0d9488', background: '#0d9488', color: '#fff' }}
        >📋 Summary</button>
      </div>

      <style>{`
        @keyframes ambPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
