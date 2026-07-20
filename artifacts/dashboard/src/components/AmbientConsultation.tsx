/**
 * AmbientConsultation — phase-based surgical consultation workspace.
 * Phases: history → exam → assessment → plan
 * Shortcuts open inline drawers; never navigate away from the consultation.
 * Light canvas, teal accents, no dark content blocks.
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
  if (Number.isFinite(sbp))  { if (sbp > 160)  flags.push(`SBP ${Math.round(sbp)}`);  if (sbp < 90)  flags.push(`SBP ${Math.round(sbp)}↓`); }
  if (Number.isFinite(dbp))  { if (dbp > 100)  flags.push(`DBP ${Math.round(dbp)}`); }
  if (Number.isFinite(hr))   { if (hr  > 100)  flags.push(`HR ${Math.round(hr)}↑`);   if (hr  < 50)  flags.push(`HR ${Math.round(hr)}↓`); }
  if (Number.isFinite(rr))   { if (rr  > 20)   flags.push(`RR ${Math.round(rr)}↑`);   if (rr  < 10)  flags.push(`RR ${Math.round(rr)}↓`); }
  if (Number.isFinite(spo2)) { if (spo2 < 94)  flags.push(`SpO₂ ${Math.round(spo2)}%↓`); }
  if (Number.isFinite(temp)) { if (temp > 38.5) flags.push(`T ${temp.toFixed(1)}°C`);  if (temp < 36.0) flags.push(`T ${temp.toFixed(1)}°C↓`); }
  return flags;
}

// ── Persist call log ───────────────────────────────────────────────────────────
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

// ── Phase type ─────────────────────────────────────────────────────────────────
type ConsultPhase = 'history' | 'exam' | 'assessment' | 'plan';

// ── Clinical shortcut definitions ──────────────────────────────────────────────
const HISTORY_SHORTCUTS: { section: Section; icon: string; label: string }[] = [
  { section: 'pmh',            icon: '📋', label: 'PMH'         },
  { section: 'surgical',       icon: '🔪', label: 'Surgical Hx' },
  { section: 'medications',    icon: '💊', label: 'Medications'  },
  { section: 'allergies',      icon: '⚠️', label: 'Allergies'    },
  { section: 'examination',    icon: '🩺', label: 'Quick Exam'   },
  { section: 'investigations', icon: '🧪', label: 'Labs'         },
  { section: 'radiology',      icon: '🩻', label: 'Imaging'      },
];

const COMMON_CONDITIONS = [
  'Hypertension', 'T2DM', 'T1DM', 'IHD', 'Atrial fibrillation',
  'GORD', 'COPD', 'Asthma', 'CKD', 'Hypothyroid',
  'Hyperlipidaemia', 'IBD', 'Stroke/TIA', 'Obesity', 'Cancer',
];

const COMMON_SURGERY = [
  'Appendicectomy', 'Cholecystectomy', 'Hernia repair',
  'Bowel resection', 'Caesarean section', 'Hysterectomy',
  'Thyroidectomy', 'Mastectomy', 'Gastric bypass', 'ERCP',
  'Laparoscopy', 'Other abdominal surgery',
];

const COMMON_ALLERGENS = [
  'Penicillin', 'Amoxicillin', 'Sulfonamides', 'Cephalosporins',
  'NSAIDs', 'Aspirin', 'Codeine', 'Morphine', 'IV contrast', 'Latex',
];

const COMMON_LABS = [
  'FBC', 'U&E', 'LFT', 'CRP', 'Coags', 'Lipase', 'Amylase',
  'GXM', 'HbA1c', 'TSH', 'Blood cultures', 'CA-125', 'CEA',
];

const COMMON_IMAGING = [
  'CT Abdomen/Pelvis', 'USS Abdomen', 'CXR', 'AXR',
  'CT Chest', 'MRI Abdomen', 'USS Liver/Biliary', 'ERCP',
  'Mammogram', 'USS Breast', 'CT Chest/Abdo/Pelvis',
];

// ── Shared drawer styles ───────────────────────────────────────────────────────
const drawerStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const chipBtn = (active: boolean): React.CSSProperties => ({
  padding: '5px 11px',
  borderRadius: 16,
  fontSize: 12,
  fontWeight: active ? 700 : 500,
  cursor: 'pointer',
  border: `1.5px solid ${active ? '#0d9488' : 'var(--line)'}`,
  background: active ? '#0d9488' : 'var(--card)',
  color: active ? '#fff' : 'var(--ink)',
  transition: 'all 0.12s',
  minHeight: 32,
});

const drawerTextarea: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 7,
  border: '1px solid var(--line)',
  background: 'var(--card)',
  color: 'var(--ink)',
  fontSize: 13,
  lineHeight: 1.6,
  fontFamily: 'Georgia, serif',
  outline: 'none',
  resize: 'vertical' as const,
  boxSizing: 'border-box' as const,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: 'var(--muted)',
};

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
    allergies: allergyText, setAllergies,
    examNotes, setExamNotes,
    examGeneral, setExamGeneral,
    examCardio, setExamCardio,
    examResp, setExamResp,
    examAbdomen, setExamAbdomen,
    examNeuro: _examNeuro, setExamNeuro: _setExamNeuro,
    examExtremities, setExamExtremities,
    examWound, setExamWound,
    assessment, plan,
    orderedInvestigations, setOrderedInvestigations,
    radiologyRequests, setRadiologyRequests,
    comorbidities, setComorbidities,
    pmhNotes, setPmhNotes,
    surgicalHistory, setSurgicalHistory,
    surgicalNotes, setSurgicalNotes,
    medications, setMedications,
    medicationsText, setMedicationsText,
  } = ctx;

  // ── Phase & drawer state ───────────────────────────────────────────────────
  const [consultPhase, setConsultPhase] = useState<ConsultPhase>('history');
  const [activeDrawer, setActiveDrawer] = useState<Section | null>(null);
  const [dismissedPrompts, setDismissedPrompts] = useState<string[]>([]);
  const [hpiCollapsed, setHpiCollapsed] = useState(false);
  const [assessAccordion, setAssessAccordion] = useState(false);

  // ── Voice state ────────────────────────────────────────────────────────────
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

  // ── Photo state ────────────────────────────────────────────────────────────
  const [cameraRef] = useState(() => ({ current: null as HTMLInputElement | null }));

  // ── DX engine state ────────────────────────────────────────────────────────
  const [pathognomicAlerts, setPathognomicAlerts] = useState<PathognomicMatch[]>([]);
  const [dxUpdatedAt, setDxUpdatedAt] = useState<number | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const ccMatrix  = activeCcKey ? getMatrix(activeCcKey) : null;
  const ccLabel   = ccMatrix?.name ?? (symptoms.length > 0 ? symptoms.slice(0, 2).join(', ') : null);
  const vitalFlags = abnormalVitals(vitals as Record<string, string>);

  const safetyReminders = useMemo(() => computeReminders({
    activeCcKey, symptoms, hpiNotes, examNotes, assessment, plan,
    orderedInvestigations,
    radiologyRequests: radiologyRequests as object[],
  }), [activeCcKey, symptoms, hpiNotes, examNotes, assessment, plan, orderedInvestigations, radiologyRequests]);

  const activeReminder = safetyReminders.find(r => !dismissedPrompts.includes(r.id)) ?? null;

  // Section completion dots
  const sectionDone: Partial<Record<Section, boolean>> = {
    pmh:            comorbidities.length > 0 || !!pmhNotes.trim(),
    surgical:       surgicalHistory.length > 0 || !!surgicalNotes.trim(),
    medications:    medications.length > 0 || !!medicationsText.trim(),
    allergies:      !!allergyText.trim(),
    examination:    !!(examGeneral || examAbdomen || examCardio || examResp),
    investigations: orderedInvestigations.length > 0,
    radiology:      radiologyRequests.length > 0,
  };

  // ── Voice helpers ──────────────────────────────────────────────────────────
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

  // Auto-start mic on fresh consultation
  useEffect(() => {
    if (!SPEECH_SUPPORTED || hpiNotes.trim()) return;
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
    if (s.assessment?.trim()) ctx.setAssessment(assessment ? assessment + '\n\n' + s.assessment : s.assessment);
    if (s.plan?.trim()) ctx.setPlan(plan ? plan + '\n\n' + s.plan : s.plan);
    if (s.allergies?.trim()) setAllergies(s.allergies);
    if (s.examination) {
      const ex = s.examination;
      const next = { ...examNotes };
      const map: [string, string][] = [
        ['general','general'],['cardiovascular','cardiovascular'],
        ['respiratory','respiratory'],['abdomen','abdomen'],
        ['wound','wound'],['breast','breast'],
        ['neurological','neurological'],['extremities','extremities'],
      ];
      for (const [k, src] of map) {
        const t = ex[src]?.trim();
        if (t) next[k] = next[k] ? next[k] + ' ' + t : t;
      }
      setExamNotes(next);
      if (ex.general?.trim())        setExamGeneral(ex.general);
      if (ex.cardiovascular?.trim()) setExamCardio(ex.cardiovascular);
      if (ex.respiratory?.trim())    setExamResp(ex.respiratory);
      if (ex.abdomen?.trim())        setExamAbdomen(ex.abdomen);
    }
    if (s.pmh?.length) {
      const txt = s.pmh.join('; ');
      ctx.setFreeText(ctx.freeText ? ctx.freeText + '\nPMH (dictated): ' + txt : 'PMH (dictated): ' + txt);
    }
    if (s.unsegmented?.trim()) {
      ctx.setFreeText(ctx.freeText ? ctx.freeText + '\n\n' + s.unsegmented : s.unsegmented);
    }
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

  // ── Phase transitions ──────────────────────────────────────────────────────
  function enterExam() {
    setConsultPhase('exam');
    setActiveDrawer(null);
  }

  function enterAssessment() {
    const parts: string[] = [];
    if (ccLabel) parts.push(`Chief Complaint: ${ccLabel}`);
    if (visitType) parts.push(`\nVisit Type: ${visitType.replace(/_/g, ' ')}`);
    if (hpiNotes.trim()) parts.push(`\n\nPresenting History:\n${hpiNotes.trim()}`);
    const pmhStr = comorbidities.filter(c => c !== 'NKPMH').join(', ') || pmhNotes.trim();
    if (pmhStr) parts.push(`\n\nPast Medical History: ${pmhStr}`);
    const surgStr = surgicalHistory.filter(s => s !== 'No prior surgery').join(', ') || surgicalNotes.trim();
    if (surgStr) parts.push(`\n\nSurgical History: ${surgStr}`);
    else if (surgicalHistory.includes('No prior surgery')) parts.push('\n\nSurgical History: No prior surgery');
    const medsStr = medications.filter(m => m !== 'None').join(', ') || medicationsText.trim();
    if (medsStr) parts.push(`\n\nMedications: ${medsStr}`);
    else if (medications.includes('None')) parts.push('\n\nMedications: None');
    if (allergyText) parts.push(`\n\nAllergies: ${allergyText}`);
    const examParts: string[] = [];
    if (examGeneral)    examParts.push(`  General: ${examGeneral}`);
    if (examAbdomen)    examParts.push(`  Abdomen: ${examAbdomen}`);
    if (examCardio)     examParts.push(`  CVS: ${examCardio}`);
    if (examResp)       examParts.push(`  Resp: ${examResp}`);
    if (examExtremities) examParts.push(`  Extremities: ${examExtremities}`);
    if (examWound)      examParts.push(`  Wound: ${examWound}`);
    if (examParts.length) parts.push(`\n\nExamination:\n${examParts.join('\n')}`);
    if (orderedInvestigations.length) parts.push(`\n\nInvestigations ordered: ${orderedInvestigations.join(', ')}`);
    if (radiologyRequests.length) {
      const imgStr = radiologyRequests.map(r => `${r.modality} ${r.anatomicalRegion}`).join(', ');
      parts.push(`\n\nImaging ordered: ${imgStr}`);
    }
    parts.push('\n\n' + '─'.repeat(40) + '\n\nWorking Diagnosis:\n\nDifferential Diagnoses:\n1. \n2. \n3. \n\nKey Concerns / Red Flags:\n\nMissing Information:');
    const draft = parts.join('');
    if (!assessment.trim()) ctx.setAssessment(draft);
    setConsultPhase('assessment');
    setActiveDrawer(null);
  }

  function enterPlan() {
    if (!plan.trim()) {
      ctx.setPlan(
        'Management Plan\n\n' +
        '1. Investigations:\n   \n\n' +
        '2. Imaging:\n   \n\n' +
        '3. Procedures / Referrals:\n   \n\n' +
        '4. Medications:\n   \n\n' +
        '5. Follow-up:\n   \n\n' +
        '6. Safety-net / Patient instructions:\n   \n',
      );
    }
    setConsultPhase('plan');
  }

  const fullTranscript = transcript + (interim ? interim : '');

  // ── Dictate button handler ─────────────────────────────────────────────────
  function handleDictateClick() {
    if (!micOpen) {
      setMicOpen(true);
      if (!recording && !pendingSoap) startRecording();
    } else if (recording) {
      void handleSegment();
    } else {
      setMicOpen(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  // Phase indicator bar
  const phases: { key: ConsultPhase; label: string }[] = [
    { key: 'history',    label: 'History'    },
    { key: 'exam',       label: 'Exam'       },
    { key: 'assessment', label: 'Assessment' },
    { key: 'plan',       label: 'Plan'       },
  ];
  const phaseIdx = phases.findIndex(p => p.key === consultPhase);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Phase breadcrumb ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
        {phases.map((p, i) => {
          const done = i < phaseIdx;
          const active = i === phaseIdx;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                if (done) setConsultPhase(p.key);
              }}
              disabled={i > phaseIdx}
              title={done ? `Return to ${p.label}` : active ? `Current phase: ${p.label}` : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 12px', border: 'none', cursor: done ? 'pointer' : 'default',
                fontSize: 11, fontWeight: active ? 800 : done ? 600 : 500,
                background: 'transparent',
                color: active ? '#0d9488' : done ? 'var(--ink)' : 'var(--muted)',
                opacity: i > phaseIdx ? 0.45 : 1,
                transition: 'all 0.12s',
              }}
            >
              {done && <span style={{ fontSize: 10, color: '#0d9488' }}>✓</span>}
              {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0d9488', display: 'inline-block', flexShrink: 0 }} />}
              {p.label}
              {i < phases.length - 1 && (
                <span style={{ marginLeft: 6, color: 'var(--muted)', opacity: 0.4 }}>›</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Abnormal vitals alert ── */}
      {vitalFlags.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', borderRadius: 8,
          background: '#fef2f2', border: '1px solid #fca5a5',
        }}>
          <span style={{ fontSize: 15, flexShrink: 0 }}>⚠</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>Abnormal vitals:</span>
          <span style={{ fontSize: 12, color: '#dc2626' }}>{vitalFlags.join(' · ')}</span>
        </div>
      )}

      {/* ════════════════════════════════════════
          HISTORY PHASE
      ════════════════════════════════════════ */}
      {consultPhase === 'history' && (
        <>
          {/* ── HPI card ── */}
          <div style={{
            borderRadius: 10,
            border: '1px solid var(--line)',
            background: 'var(--card)',
            overflow: 'hidden',
          }}>
            {/* Label + controls */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px 0',
            }}>
              <span style={sectionLabel}>
                {ccLabel ? `${ccLabel} — Presenting History` : 'Presenting History'}
              </span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleDictateClick}
                  disabled={!SPEECH_SUPPORTED && !micOpen}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px', borderRadius: 7, border: 'none',
                    cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    background: recording ? '#dc2626' : micOpen ? '#0d9488' : 'rgba(13,148,136,0.1)',
                    color: recording ? '#fff' : micOpen ? '#fff' : '#0d9488',
                    transition: 'all 0.15s',
                  }}
                  title={recording ? 'Stop & analyse' : micOpen ? 'Close mic' : 'Dictate HPI'}
                >
                  <span style={{
                    display: 'inline-block', width: 7, height: 7,
                    borderRadius: '50%', flexShrink: 0,
                    background: recording ? '#fff' : 'currentColor',
                    animation: recording ? 'ambPulse 1s ease-in-out infinite' : 'none',
                  }} />
                  {recording ? 'Stop' : segmenting ? 'Analysing…' : accepted ? '✓ Loaded' : '🎙 Dictate'}
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveSection('hpi'); onDetailedMode(); }}
                  style={{
                    padding: '4px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    border: '1px solid var(--line)', background: 'transparent',
                    color: 'var(--muted)', cursor: 'pointer',
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
                  ? `Presenting history of ${ccLabel}. Dictate or type directly.`
                  : 'Presenting history — tap 🎙 Dictate to start, or type directly.'
              }
              style={{
                display: 'block', width: '100%', minHeight: 160,
                padding: '12px 14px', border: 'none', resize: 'vertical',
                background: 'transparent', color: 'var(--ink)',
                fontSize: 15, lineHeight: 1.75, fontFamily: 'Georgia, serif',
                outline: 'none', boxSizing: 'border-box',
              }}
            />

            {/* Mic expansion panel */}
            {micOpen && (
              <div style={{
                borderTop: `1px solid ${recording ? 'rgba(220,38,38,0.3)' : 'var(--line)'}`,
                padding: '10px 14px',
                background: recording ? 'rgba(220,38,38,0.03)' : 'rgba(13,148,136,0.03)',
              }}>
                {/* Transcript preview */}
                {(fullTranscript || recording) && (
                  <div style={{
                    fontSize: 13, lineHeight: 1.6, color: 'var(--muted)',
                    fontFamily: 'Georgia, serif', maxHeight: 80, overflowY: 'auto',
                    marginBottom: pendingSoap ? 10 : 0,
                  }}>
                    {transcript}
                    {interim && <span style={{ color: 'var(--ink)', opacity: 0.5 }}>{interim}</span>}
                    {recording && !fullTranscript && (
                      <span style={{ fontStyle: 'italic' }}>Listening…</span>
                    )}
                  </div>
                )}

                {/* SOAP preview */}
                {pendingSoap && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#d97706', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                      PREVIEW — review then accept
                      {segmentSource && (
                        <span style={{
                          fontSize: 9, padding: '1px 6px', borderRadius: 8,
                          background: segmentSource === 'cloud' ? 'rgba(59,130,246,.15)' : 'rgba(16,185,129,.15)',
                          color: segmentSource === 'cloud' ? '#2563eb' : '#059669',
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
                        background: 'var(--bg)', borderRadius: 7, padding: '8px 11px',
                        border: '1px solid var(--line)',
                      }}>
                        <div style={{ ...sectionLabel, marginBottom: 3 }}>{label}</div>
                        <div style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--ink)', fontFamily: 'Georgia, serif' }}>{text}</div>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" onClick={acceptSoap}
                        style={{ flex: 1, padding: '8px', borderRadius: 7, border: 'none',
                          background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                        ↓ Accept
                      </button>
                      <button type="button" onClick={() => { setPendingSoap(null); setTranscript(''); }}
                        style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid var(--line)',
                          background: 'transparent', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>
                        Discard
                      </button>
                    </div>
                  </div>
                )}

                {/* Controls row */}
                {!pendingSoap && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {!recording && transcript && !segmenting && (
                      <button type="button" onClick={() => void handleSegment()}
                        style={{ padding: '5px 14px', borderRadius: 6, border: 'none',
                          background: '#0d9488', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Analyse transcript →
                      </button>
                    )}
                    {!recording && (
                      <button type="button" onClick={() => { setTranscript(''); setVoiceError(null); setMicOpen(false); }}
                        style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                          border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }}>
                        Close
                      </button>
                    )}
                    {segmenting && <span style={{ fontSize: 11, color: '#d97706' }}>Analysing…</span>}
                  </div>
                )}

                {voiceError && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#dc2626', padding: '4px 8px',
                    borderRadius: 5, background: '#fef2f2', border: '1px solid #fca5a5' }}>
                    {voiceError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Clinical shortcut bar ── */}
          <div>
            <div style={{ ...sectionLabel, marginBottom: 7 }}>Clinical History</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {HISTORY_SHORTCUTS.map(({ section, icon, label }) => {
                const done = !!sectionDone[section as keyof typeof sectionDone];
                const isActive = activeDrawer === section;
                return (
                  <button
                    key={section}
                    type="button"
                    onClick={() => setActiveDrawer(d => d === section ? null : section)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '8px 14px', borderRadius: 20, cursor: 'pointer',
                      fontSize: 13, fontWeight: 600,
                      minHeight: 44, position: 'relative',
                      border: `1.5px solid ${isActive ? '#0d9488' : done ? '#0d9488' : 'var(--line)'}`,
                      background: isActive ? '#0d9488' : done ? 'rgba(13,148,136,0.08)' : 'var(--card)',
                      color: isActive ? '#fff' : done ? '#0d9488' : 'var(--ink)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {done && !isActive && (
                      <span style={{
                        position: 'absolute', top: 5, right: 5,
                        width: 7, height: 7, borderRadius: '50%', background: '#0d9488',
                      }} />
                    )}
                    <span style={{ fontSize: 15 }}>{icon}</span>
                    {label}
                  </button>
                );
              })}
              {/* Photos shortcut */}
              <button
                type="button"
                onClick={() => setActiveDrawer(d => d === 'attachments' ? null : 'attachments')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '8px 14px', borderRadius: 20, cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, minHeight: 44,
                  border: `1.5px solid ${activeDrawer === 'attachments' ? '#0d9488' : ctx.examPhotos.length > 0 ? '#0d9488' : 'var(--line)'}`,
                  background: activeDrawer === 'attachments' ? '#0d9488' : ctx.examPhotos.length > 0 ? 'rgba(13,148,136,0.08)' : 'var(--card)',
                  color: activeDrawer === 'attachments' ? '#fff' : ctx.examPhotos.length > 0 ? '#0d9488' : 'var(--ink)',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 15 }}>📷</span>
                Photos{ctx.examPhotos.length > 0 ? ` (${ctx.examPhotos.length})` : ''}
              </button>
            </div>
          </div>

          {/* ── Inline drawers ── */}
          {activeDrawer === 'pmh' && (
            <div style={drawerStyle}>
              <div style={{ ...sectionLabel }}>Past Medical History</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {COMMON_CONDITIONS.map(c => {
                  const on = comorbidities.includes(c);
                  return (
                    <button key={c} type="button"
                      onClick={() => setComorbidities(on ? comorbidities.filter(x => x !== c) : [...comorbidities, c])}
                      style={chipBtn(on)}>
                      {on ? '✓ ' : ''}{c}
                    </button>
                  );
                })}
                {comorbidities.length > 0 && (
                  <button type="button" onClick={() => setComorbidities([])} style={chipBtn(false)}>
                    Clear all
                  </button>
                )}
              </div>
              <textarea value={pmhNotes} onChange={e => setPmhNotes(e.target.value)}
                placeholder="Additional conditions, relevant detail (e.g. year of diagnosis, control status)…"
                style={drawerTextarea} rows={2} />
            </div>
          )}

          {activeDrawer === 'surgical' && (
            <div style={drawerStyle}>
              <div style={sectionLabel}>Surgical History</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {['No prior surgery', ...COMMON_SURGERY].map(s => {
                  const on = surgicalHistory.includes(s);
                  return (
                    <button key={s} type="button"
                      onClick={() => setSurgicalHistory(on ? surgicalHistory.filter(x => x !== s) : [...surgicalHistory, s])}
                      style={chipBtn(on)}>
                      {on ? '✓ ' : ''}{s}
                    </button>
                  );
                })}
              </div>
              <textarea value={surgicalNotes} onChange={e => setSurgicalNotes(e.target.value)}
                placeholder="Other procedures, dates, complications…"
                style={drawerTextarea} rows={2} />
            </div>
          )}

          {activeDrawer === 'medications' && (
            <div style={drawerStyle}>
              <div style={sectionLabel}>Current Medications</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={() => setMedications(medications.includes('None') ? [] : ['None'])}
                  style={chipBtn(medications.includes('None'))}>
                  {medications.includes('None') ? '✓ ' : ''}None
                </button>
              </div>
              <textarea
                value={medicationsText}
                onChange={e => {
                  setMedicationsText(e.target.value);
                  setMedications(e.target.value ? e.target.value.split('\n').map(s => s.trim()).filter(Boolean) : []);
                }}
                placeholder={'One per line:\nAmlodipine 5 mg OD\nMetformin 500 mg BD\nAtorvastatin 20 mg ON'}
                style={drawerTextarea} rows={5} />
            </div>
          )}

          {activeDrawer === 'allergies' && (
            <div style={drawerStyle}>
              <div style={sectionLabel}>Drug Allergies</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                <button type="button" onClick={() => setAllergies('NKDA')} style={chipBtn(allergyText === 'NKDA')}>
                  {allergyText === 'NKDA' ? '✓ ' : ''}NKDA
                </button>
                {COMMON_ALLERGENS.map(a => {
                  const on = allergyText.includes(a);
                  return (
                    <button key={a} type="button"
                      onClick={() => {
                        if (allergyText === 'NKDA') { setAllergies(a); return; }
                        const curr = allergyText.split(',').map(s => s.trim()).filter(Boolean);
                        setAllergies(on ? curr.filter(x => x !== a).join(', ') : [...curr, a].join(', '));
                      }}
                      style={chipBtn(on)}>
                      {on ? '✓ ' : ''}{a}
                    </button>
                  );
                })}
              </div>
              <input
                value={allergyText === 'NKDA' ? '' : allergyText}
                onChange={e => setAllergies(e.target.value)}
                placeholder="Other allergen / reaction detail…"
                style={{ ...drawerTextarea, resize: undefined }}
              />
            </div>
          )}

          {activeDrawer === 'examination' && (
            <div style={drawerStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={sectionLabel}>Quick Examination Notes</span>
                <button type="button" onClick={enterExam}
                  style={{ fontSize: 11, color: '#0d9488', border: '1px solid rgba(13,148,136,0.3)',
                    background: 'rgba(13,148,136,0.06)', padding: '3px 9px', borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
                  Full Exam phase →
                </button>
              </div>
              {([
                ['General', examGeneral, setExamGeneral],
                ['Abdomen', examAbdomen, setExamAbdomen],
                ['CVS', examCardio, setExamCardio],
                ['Resp', examResp, setExamResp],
                ['Extremities', examExtremities, setExamExtremities],
                ['Wound', examWound, setExamWound],
              ] as [string, string, (v: string) => void][]).map(([label, value, setter]) => (
                <div key={label}>
                  <div style={{ ...sectionLabel, marginBottom: 3 }}>{label}</div>
                  <textarea value={value} onChange={e => setter(e.target.value)}
                    placeholder={`${label}…`} rows={2}
                    style={drawerTextarea} />
                </div>
              ))}
            </div>
          )}

          {activeDrawer === 'investigations' && (
            <div style={drawerStyle}>
              <div style={sectionLabel}>Blood Tests / Labs</div>
              {orderedInvestigations.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {orderedInvestigations.map(inv => (
                    <span key={inv} style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 14, fontSize: 12, fontWeight: 600,
                      background: 'rgba(13,148,136,0.1)', color: '#0d9488', border: '1px solid rgba(13,148,136,0.3)',
                    }}>
                      {inv}
                      <button type="button" onClick={() => setOrderedInvestigations(orderedInvestigations.filter(x => x !== inv))}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#0d9488', padding: '0 0 0 2px', fontSize: 12, lineHeight: 1 }}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ ...sectionLabel, marginTop: 2 }}>Add common:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {COMMON_LABS.filter(l => !orderedInvestigations.includes(l)).map(lab => (
                  <button key={lab} type="button"
                    onClick={() => setOrderedInvestigations([...orderedInvestigations, lab])}
                    style={chipBtn(false)}>
                    + {lab}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeDrawer === 'radiology' && (
            <div style={drawerStyle}>
              <div style={sectionLabel}>Imaging Requests</div>
              {radiologyRequests.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {radiologyRequests.map(r => (
                    <span key={r.id} style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 10px', borderRadius: 14, fontSize: 12, fontWeight: 600,
                      background: 'rgba(13,148,136,0.1)', color: '#0d9488', border: '1px solid rgba(13,148,136,0.3)',
                    }}>
                      {r.modality} {r.anatomicalRegion}
                      <button type="button" onClick={() => setRadiologyRequests(radiologyRequests.filter(x => x.id !== r.id))}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#0d9488', padding: '0 0 0 2px', fontSize: 12, lineHeight: 1 }}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ ...sectionLabel, marginTop: 2 }}>Add:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {COMMON_IMAGING.filter(img => !radiologyRequests.some(r => `${r.modality} ${r.anatomicalRegion}` === img)).map(img => {
                  const [modality, ...rest] = img.split(' ');
                  return (
                    <button key={img} type="button"
                      onClick={() => setRadiologyRequests([...radiologyRequests, {
                        id: crypto.randomUUID(), modality: modality ?? img,
                        anatomicalRegion: rest.join(' '), laterality: '', urgency: 'routine',
                        indication: ccLabel ?? '', clinicalQuestion: '', ctContrast: '',
                        ctEgfr: '', mriProtocol: '', scopeType: '', functionalType: '',
                        resultReceived: false, resultNotes: '',
                      }])}
                      style={chipBtn(false)}>
                      + {img}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Photos drawer */}
          {activeDrawer === 'attachments' && (
            <div style={drawerStyle}>
              <div style={sectionLabel}>Clinical Photos</div>
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
              <button type="button" onClick={() => cameraRef.current?.click()}
                style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #0d9488',
                  background: 'rgba(13,148,136,0.06)', color: '#0d9488', fontSize: 13, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}>
                📷 Capture photo
              </button>
              {ctx.examPhotos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ctx.examPhotos.map(p => (
                    <div key={p.id} style={{ position: 'relative', width: 72, height: 72 }}>
                      <img src={p.dataUrl} alt={p.bodyRegion}
                        style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', border: '1.5px solid var(--line)' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── AI quiet prompt — one at a time ── */}
          {activeReminder && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 12px', borderRadius: 8,
              border: `1px solid ${activeReminder.urgency === 'flag' ? 'rgba(217,119,6,0.35)' : 'var(--line)'}`,
              background: activeReminder.urgency === 'flag' ? 'rgba(217,119,6,0.05)' : 'var(--card)',
            }}>
              <span style={{ fontSize: 14, color: activeReminder.urgency === 'flag' ? '#d97706' : 'var(--muted)', flexShrink: 0 }}>
                {activeReminder.urgency === 'flag' ? '◈' : '○'}
              </span>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)' }}>{activeReminder.text}</span>
              <button
                type="button"
                onClick={() => setDismissedPrompts(p => [...p, activeReminder.id])}
                style={{ border: 'none', background: 'none', cursor: 'pointer',
                  color: 'var(--muted)', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
                title="Dismiss"
              >✕</button>
            </div>
          )}

          {/* ── Live DX differential ── */}
          {(pathognomicAlerts.length > 0 || (dxUpdatedAt && ctx.paneTop.length > 0)) && (
            <div style={{
              borderRadius: 9, border: '1px solid var(--line)',
              background: 'var(--card)', padding: '10px 14px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={sectionLabel}>Differential (from transcript)</div>
              {pathognomicAlerts.map(a => (
                <div key={a.diseaseId} style={{
                  background: a.specificity === 'definitive' ? '#fef2f2' : '#fffbeb',
                  border: `1px solid ${a.specificity === 'definitive' ? '#fca5a5' : '#fde68a'}`,
                  borderRadius: 7, padding: '5px 10px', fontSize: 12,
                  color: a.specificity === 'definitive' ? '#991b1b' : '#92400e',
                  display: 'flex', gap: 6, alignItems: 'center',
                }}>
                  <span style={{ fontWeight: 800 }}>{a.specificity === 'definitive' ? '⚠ Pathognomonic:' : '◈ Strong indicator:'}</span>
                  {a.diseaseLabel}
                  <span style={{ opacity: 0.6, fontStyle: 'italic' }}>— {a.finding}</span>
                </div>
              ))}
              {ctx.paneTop.slice(0, 3).map(r => (
                <div key={r.disease.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 20, background: 'var(--bg)', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${Math.round(r.probability * 100)}%`,
                      background: r.probability > 0.5 ? '#0d9488' : r.probability > 0.25 ? '#d97706' : '#94a3b8',
                      borderRadius: 5, transition: 'width 0.4s ease',
                    }} />
                    <span style={{
                      position: 'absolute', left: 8, top: 0, bottom: 0,
                      display: 'flex', alignItems: 'center',
                      fontSize: 11, fontWeight: 600,
                      color: r.probability > 0.5 ? '#fff' : 'var(--ink)',
                    }}>
                      {r.disease.label}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, minWidth: 34, color: 'var(--muted)', textAlign: 'right' }}>
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
                  <div style={{ marginTop: 2, fontSize: 11, color: 'var(--ink)' }}>
                    <div style={{ ...sectionLabel, color: '#0d9488', marginBottom: 4 }}>
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

          {/* ── Phase actions ── */}
          <div style={{
            display: 'flex', gap: 8, justifyContent: 'flex-end',
            paddingTop: 6, borderTop: '1px solid var(--line)',
          }}>
            <button type="button" onClick={enterExam}
              style={{
                padding: '10px 18px', borderRadius: 8,
                border: '1px solid var(--line)', background: 'var(--card)',
                color: 'var(--ink)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
              🩺 Examination →
            </button>
            <button type="button" onClick={enterAssessment}
              style={{
                padding: '10px 20px', borderRadius: 8, border: 'none',
                background: '#0d9488', color: '#fff',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}>
              Continue to Assessment →
            </button>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════
          EXAM PHASE
      ════════════════════════════════════════ */}
      {consultPhase === 'exam' && (
        <>
          {/* HPI accordion */}
          <div style={{ borderRadius: 9, border: '1px solid var(--line)', background: 'var(--card)', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setHpiCollapsed(c => !c)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '10px 14px',
                border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: 'var(--ink)',
              }}
            >
              <span>
                📝 HPI — {hpiNotes.trim()
                  ? hpiNotes.trim().slice(0, 70) + (hpiNotes.trim().length > 70 ? '…' : '')
                  : 'Not documented'}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>{hpiCollapsed ? '▼' : '▲'}</span>
            </button>
            {!hpiCollapsed && (
              <textarea
                value={hpiNotes}
                onChange={e => setHpiNotes(e.target.value)}
                style={{
                  display: 'block', width: '100%', padding: '0 14px 12px',
                  border: 'none', background: 'transparent', color: 'var(--ink)',
                  fontSize: 14, lineHeight: 1.7, fontFamily: 'Georgia, serif',
                  outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                  minHeight: 80,
                }}
              />
            )}
          </div>

          {/* Examination workspace */}
          <div style={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', overflow: 'hidden' }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px 8px',
              borderBottom: '1px solid var(--line)',
            }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>🩺 Examination</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button type="button" onClick={handleDictateClick}
                  disabled={!SPEECH_SUPPORTED && !micOpen}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px', borderRadius: 7, border: 'none',
                    cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    background: recording ? '#dc2626' : micOpen ? '#0d9488' : 'rgba(13,148,136,0.1)',
                    color: recording ? '#fff' : micOpen ? '#fff' : '#0d9488',
                  }}>
                  <span style={{
                    display: 'inline-block', width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                    background: recording ? '#fff' : 'currentColor',
                    animation: recording ? 'ambPulse 1s ease-in-out infinite' : 'none',
                  }} />
                  {recording ? 'Stop' : '🎙 Dictate'}
                </button>
                <button type="button" onClick={() => { setActiveSection('examination'); onDetailedMode(); }}
                  style={{ fontSize: 11, color: 'var(--muted)', border: '1px solid var(--line)',
                    background: 'none', padding: '4px 9px', borderRadius: 5, cursor: 'pointer' }}>
                  Full Exam ↗
                </button>
              </div>
            </div>

            {/* Exam dictation transcript (shown in exam phase) */}
            {micOpen && fullTranscript && (
              <div style={{
                padding: '8px 14px', borderBottom: '1px solid var(--line)',
                background: recording ? 'rgba(220,38,38,0.03)' : 'rgba(13,148,136,0.03)',
                fontSize: 13, color: 'var(--muted)', fontFamily: 'Georgia, serif', lineHeight: 1.6,
              }}>
                {transcript}
                {interim && <span style={{ opacity: 0.5 }}>{interim}</span>}
                {recording && !fullTranscript && <span style={{ fontStyle: 'italic' }}>Listening…</span>}
              </div>
            )}
            {pendingSoap && (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#d97706', letterSpacing: '0.06em' }}>
                  PREVIEW — review then accept
                </div>
                {([
                  ['HPI', pendingSoap.hpi],
                  ...Object.entries(pendingSoap.examination ?? {}).filter(([, v]) => v?.trim()).map(([k, v]) => [`Exam — ${k}`, v]),
                ] as [string, string | undefined][]).filter(([, v]) => v?.trim()).map(([label, text]) => (
                  <div key={label} style={{ background: 'var(--bg)', borderRadius: 7, padding: '7px 10px', border: '1px solid var(--line)' }}>
                    <div style={{ ...sectionLabel, marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--ink)', fontFamily: 'Georgia, serif' }}>{text}</div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={acceptSoap}
                    style={{ flex: 1, padding: '7px', borderRadius: 7, border: 'none', background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                    ↓ Accept
                  </button>
                  <button type="button" onClick={() => { setPendingSoap(null); setTranscript(''); }}
                    style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>
                    Discard
                  </button>
                </div>
              </div>
            )}

            {/* Exam region textareas */}
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                ['General', examGeneral, setExamGeneral],
                ['Abdomen', examAbdomen, setExamAbdomen],
                ['CVS', examCardio, setExamCardio],
                ['Respiratory', examResp, setExamResp],
                ['Extremities', examExtremities, setExamExtremities],
                ['Wound', examWound, setExamWound],
              ] as [string, string, (v: string) => void][]).map(([label, value, setter]) => (
                <div key={label}>
                  <div style={{ ...sectionLabel, marginBottom: 4 }}>{label}</div>
                  <textarea
                    value={value}
                    onChange={e => setter(e.target.value)}
                    placeholder={label === 'General' ? 'e.g. Alert and oriented, comfortable at rest, no pallor…' : `${label}…`}
                    rows={2}
                    style={drawerTextarea}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Phase nav */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setConsultPhase('history')}
              style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--line)',
                background: 'var(--card)', color: 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              ← History
            </button>
            <button type="button" onClick={enterAssessment}
              style={{ flex: 1, padding: '10px 18px', borderRadius: 8, border: 'none',
                background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Continue to Assessment →
            </button>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════
          ASSESSMENT PHASE
      ════════════════════════════════════════ */}
      {consultPhase === 'assessment' && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 12px', borderRadius: 7,
            background: 'rgba(13,148,136,0.06)', border: '1px solid rgba(13,148,136,0.2)',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0d9488', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Assessment
            </span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              — Draft pre-populated from collected data. Review and edit before finalising.
            </span>
          </div>

          {/* DX differential — at top of assessment */}
          {ctx.paneTop.length > 0 && (
            <div style={{ borderRadius: 9, border: '1px solid var(--line)', background: 'var(--card)', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={sectionLabel}>Probabilistic Differential (AI)</div>
              {ctx.paneTop.slice(0, 4).map(r => (
                <div key={r.disease.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 20, background: 'var(--bg)', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round(r.probability * 100)}%`,
                      background: r.probability > 0.5 ? '#0d9488' : r.probability > 0.25 ? '#d97706' : '#94a3b8', borderRadius: 5 }} />
                    <span style={{ position: 'absolute', left: 8, top: 0, bottom: 0, display: 'flex', alignItems: 'center',
                      fontSize: 11, fontWeight: 600, color: r.probability > 0.5 ? '#fff' : 'var(--ink)' }}>
                      {r.disease.label}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, minWidth: 34, color: 'var(--muted)', textAlign: 'right' }}>
                    {Math.round(r.probability * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          <div style={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px 0' }}>
              <div style={sectionLabel}>Clinical Assessment</div>
            </div>
            <textarea
              value={assessment}
              onChange={e => ctx.setAssessment(e.target.value)}
              placeholder="Clinical assessment — working diagnosis, differentials, key concerns, missing information…"
              style={{
                display: 'block', width: '100%', minHeight: 280,
                padding: '10px 14px', border: 'none', background: 'transparent',
                color: 'var(--ink)', fontSize: 14, lineHeight: 1.75,
                fontFamily: 'Georgia, serif', outline: 'none',
                resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setConsultPhase('exam')}
              style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--line)',
                background: 'var(--card)', color: 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              ← Exam
            </button>
            <button type="button" onClick={enterPlan}
              style={{ flex: 1, padding: '10px 18px', borderRadius: 8, border: 'none',
                background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Continue to Plan →
            </button>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════
          PLAN PHASE
      ════════════════════════════════════════ */}
      {consultPhase === 'plan' && (
        <>
          {/* Assessment accordion */}
          <div style={{ borderRadius: 9, border: '1px solid var(--line)', background: 'var(--card)', overflow: 'hidden' }}>
            <button type="button" onClick={() => setAssessAccordion(a => !a)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              <span>🎯 Assessment</span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>{assessAccordion ? '▲' : '▼'}</span>
            </button>
            {assessAccordion && (
              <div style={{ padding: '0 14px 12px', fontSize: 13, color: 'var(--ink)',
                lineHeight: 1.7, fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                {assessment || 'No assessment entered.'}
              </div>
            )}
          </div>

          <div style={{ borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px 0' }}>
              <div style={sectionLabel}>Management Plan</div>
            </div>
            <textarea
              value={plan}
              onChange={e => ctx.setPlan(e.target.value)}
              placeholder="Management plan — investigations, procedures, referrals, medications, follow-up, safety-net…"
              style={{
                display: 'block', width: '100%', minHeight: 280,
                padding: '10px 14px', border: 'none', background: 'transparent',
                color: 'var(--ink)', fontSize: 14, lineHeight: 1.75,
                fontFamily: 'Georgia, serif', outline: 'none',
                resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => setConsultPhase('assessment')}
              style={{ padding: '10px 16px', borderRadius: 8, border: '1px solid var(--line)',
                background: 'var(--card)', color: 'var(--muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              ← Assessment
            </button>
            <button type="button" onClick={onFinalise}
              style={{ flex: 1, padding: '10px 20px', borderRadius: 8, border: '2px solid #0d9488',
                background: '#0d9488', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
              📋 Complete & Summary
            </button>
          </div>
        </>
      )}

      <style>{`
        @keyframes ambPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
