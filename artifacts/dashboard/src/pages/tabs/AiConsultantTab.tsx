import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import CollapsibleCard from '@/components/CollapsibleCard';
import { supabase } from '@/lib/supabase';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { errMsg } from '@/lib/err';

// ── Types ─────────────────────────────────────────────────────────────────────

type ConsultationType = 'differential_diagnosis' | 'management_plan' | 'surgical_approach' | 'investigation_workup' | 'second_opinion';

const CONSULTATION_LABELS: Record<ConsultationType, string> = {
  differential_diagnosis: 'Differential diagnosis',
  management_plan: 'Management plan',
  surgical_approach: 'Surgical approach',
  investigation_workup: 'Investigation workup',
  second_opinion: 'Second opinion',
};

interface AiRecommendation { text: string; priority?: 'high' | 'medium' | 'low'; }

interface AiConsultResponse {
  assessmentSummary: string;
  recommendations: AiRecommendation[];
  counterpoints: string[];
  guidelinesReferenced: string[];
  evidenceGrade: string;
  modelAttribution: string;
  generatedAt: string;
}

interface ConsultationRecord {
  id: string; created_at: string;
  consultation_type: ConsultationType;
  specific_question: string;
  ai_response: AiConsultResponse;
  physician_action: 'accepted' | 'modified' | 'rejected' | null;
  physician_notes: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  patient_id: string | null;
  encounter_id: string | null;
}

interface ClinicalGuideline {
  id: string; condition_icd10: string[];
  source: string; title: string;
  key_recommendations: string[];
  evidence_level: string; last_reviewed: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseIcdCode(label: string) {
  const idx = label.indexOf(' — ');
  return idx === -1 ? { code: label, description: '' } : { code: label.slice(0, idx), description: label.slice(idx + 3) };
}

function vitalsLine(v: Record<string, string>): string {
  const p: string[] = [];
  if (v.systolicBp && v.diastolicBp) p.push(`BP ${v.systolicBp}/${v.diastolicBp}`);
  if (v.heartRate) p.push(`HR ${v.heartRate}`);
  if (v.temperatureC) p.push(`Temp ${v.temperatureC}°C`);
  if (v.spo2) p.push(`SpO2 ${v.spo2}%`);
  if (v.respiratoryRate) p.push(`RR ${v.respiratoryRate}`);
  if (v.glucoseMmol) p.push(`Glucose ${v.glucoseMmol} mmol/L`);
  return p.length > 0 ? p.join(' | ') : 'No vitals recorded';
}

// ── Compact inline-style helpers ──────────────────────────────────────────────

const css = {
  banner:    { background: '#fef3c7', border: '1.5px solid #f59e0b', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#78350f', lineHeight: 1.5, marginBottom: 4 } as React.CSSProperties,
  noApi:     { background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#991b1b', textAlign: 'center' as const, marginBottom: 8 } as React.CSSProperties,
  ctxGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10, fontSize: 13 } as React.CSSProperties,
  ctxItem:   { background: '#f9fafb', borderRadius: 6, padding: '8px 10px', border: '1px solid #e5e7eb' } as React.CSSProperties,
  ctxLabel:  { fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#6b7280', marginBottom: 3 } as React.CSSProperties,
  ctxVal:    { fontSize: 13, color: '#111827', wordBreak: 'break-word' as const } as React.CSSProperties,
  primary:   { padding: '10px 22px', borderRadius: 6, border: 'none', background: '#1a3a5c', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 } as React.CSSProperties,
  respCard:  { background: '#f0f7ff', border: '1.5px solid #93c5fd', borderRadius: 8, padding: '16px 18px' } as React.CSSProperties,
  respHead:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #bfdbfe' } as React.CSSProperties,
  aiTag:     { background: '#dbeafe', color: '#1e40af', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, textTransform: 'uppercase' as const, letterSpacing: '0.06em' } as React.CSSProperties,
  secTitle:  { fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#374151', marginBottom: 6, marginTop: 14 } as React.CSSProperties,
  recRow:    { display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 0', fontSize: 13, color: '#1f2937', lineHeight: 1.5 } as React.CSSProperties,
  recNum:    { fontWeight: 700, color: '#1a3a5c', flexShrink: 0, minWidth: 20 } as React.CSSProperties,
  counter:   { background: '#fefce8', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 10px', fontSize: 13, color: '#713f12', lineHeight: 1.5 } as React.CSSProperties,
  actions:   { display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' as const, alignItems: 'center' } as React.CSSProperties,
  btnAccept: { padding: '8px 18px', borderRadius: 6, border: 'none', background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  btnModify: { padding: '8px 18px', borderRadius: 6, border: '1.5px solid #1a3a5c', background: '#fff', color: '#1a3a5c', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  btnReject: { padding: '8px 18px', borderRadius: 6, border: '1.5px solid #dc2626', background: '#fff', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as React.CSSProperties,
  histRow:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid #f3f4f6', fontSize: 13, cursor: 'pointer', userSelect: 'none' as const } as React.CSSProperties,
  glCard:    { background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '10px 12px', marginBottom: 8 } as React.CSSProperties,
  glSrc:     { fontSize: 10, fontWeight: 700, color: '#166534', textTransform: 'uppercase' as const, letterSpacing: '0.06em' } as React.CSSProperties,
  glTitle:   { fontSize: 14, fontWeight: 600, color: '#14532d', marginTop: 2, marginBottom: 4 } as React.CSSProperties,
  dim:       { opacity: 0.55, cursor: 'not-allowed' } as React.CSSProperties,
  muted:     { fontSize: 13, color: '#9ca3af', padding: '8px 0' } as React.CSSProperties,
};

function statusChip(s: string | null): React.CSSProperties {
  const base: React.CSSProperties = { fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase' };
  if (s === 'accepted') return { ...base, background: '#dcfce7', color: '#166534' };
  if (s === 'rejected') return { ...base, background: '#fee2e2', color: '#991b1b' };
  if (s === 'modified') return { ...base, background: '#e0e7ff', color: '#3730a3' };
  return { ...base, background: '#f3f4f6', color: '#6b7280' };
}

function priorityChip(p: string): React.CSSProperties {
  return { marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
    background: p === 'high' ? '#fee2e2' : p === 'medium' ? '#fef3c7' : '#f0fdf4',
    color:      p === 'high' ? '#991b1b' : p === 'medium' ? '#78350f' : '#166534' };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AiConsultantTab() {
  const {
    patientName, age, sex, dob, patientId, encounterId,
    symptoms, symptomDetails, vitals,
    examFindings, investigationResults,
    comorbidities, medications, allergies,
    assessment, icdCodes, differentials,
    plan, rosFindings, weightKg, heightCm,
  } = useAppContext();
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [consultationType, setConsultationType] = useState<ConsultationType>('differential_diagnosis');
  const [specificQuestion, setSpecificQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<AiConsultResponse | null>(null);
  const [apiAvailable, setApiAvailable] = useState(true);
  const [physicianAction, setPhysicianAction] = useState<'accepted' | 'modified' | 'rejected' | null>(null);
  const [physicianNotes, setPhysicianNotes] = useState('');
  const [showModifyInput, setShowModifyInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<ConsultationRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [guidelines, setGuidelines] = useState<ClinicalGuideline[]>([]);
  const [guidelinesLoading, setGuidelinesLoading] = useState(false);
  const [injectedGuidelineIds, setInjectedGuidelineIds] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  const parsedIcd = icdCodes.map(parseIcdCode);

  // ── Check API availability ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const origin = getApiOrigin();
        const r = await fetch(origin ? `${origin}/api/health` : '/api/health', { method: 'GET', signal: AbortSignal.timeout(5000) });
        if (!cancelled) setApiAvailable(r.ok);
      } catch { if (!cancelled) setApiAvailable(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Load guidelines when ICD codes change ─────────────────────────────────
  useEffect(() => {
    if (!supabase || parsedIcd.length === 0) { setGuidelines([]); return; }
    let cancelled = false;
    (async () => {
      setGuidelinesLoading(true);
      try {
        const { data, error } = await supabase!.from('clinical_guidelines').select('*')
          .overlaps('condition_icd10', parsedIcd.map(c => c.code));
        if (error) throw error;
        if (!cancelled) setGuidelines((data ?? []) as ClinicalGuideline[]);
      } catch (e) {
        console.warn('[AiConsultant] Guidelines load error:', errMsg(e));
        if (!cancelled) setGuidelines([]);
      } finally { if (!cancelled) setGuidelinesLoading(false); }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icdCodes.join(',')]);

  // ── Load consultation history ─────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!supabase || !encounterId) return;
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase.from('consultation_requests').select('*')
        .eq('encounter_id', encounterId).order('created_at', { ascending: false });
      if (error) throw error;
      setHistory((data ?? []) as ConsultationRecord[]);
    } catch (e) { console.warn('[AiConsultant] History load error:', errMsg(e)); }
    finally { setHistoryLoading(false); }
  }, [encounterId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ── Build patient context ─────────────────────────────────────────────────
  function buildPatientContext() {
    const pick = <V,>(src: Record<string, V>, pred: (v: V) => boolean) =>
      Object.fromEntries(Object.entries(src).filter(([, v]) => pred(v)));

    return {
      demographics: { name: patientName || 'Unknown', age: age || 'Unknown', sex: sex || 'Unknown', dob: dob || null, weightKg: weightKg || null, heightCm: heightCm || null },
      vitals: { systolicBp: vitals.systolicBp || null, diastolicBp: vitals.diastolicBp || null, heartRate: vitals.heartRate || null, temperatureC: vitals.temperatureC || null, spo2: vitals.spo2 || null, respiratoryRate: vitals.respiratoryRate || null, glucoseMmol: vitals.glucoseMmol || null },
      symptoms,
      symptomDetails: pick(symptomDetails, v => v.length > 0),
      examFindings: pick(examFindings, v => v.length > 0),
      investigations: pick(investigationResults, v => v.trim() !== ''),
      reviewOfSystems: pick(rosFindings, v => v.status !== 'not-asked'),
      assessment: assessment || null,
      differentials: differentials || null,
      medications: medications.length > 0 ? medications : [],
      allergies: allergies || null,
      comorbidities,
    };
  }

  // ── Request AI consultation ───────────────────────────────────────────────
  async function handleRequest() {
    if (loading) return;
    const apiOrigin = getApiOrigin();
    if (!apiOrigin && import.meta.env.PROD) { showToast('API server unavailable — AI consultation requires the API server.', 'error'); return; }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setAiResponse(null); setPhysicianAction(null); setPhysicianNotes(''); setShowModifyInput(false);

    try {
      const injected = guidelines.filter(g => injectedGuidelineIds.has(g.id));
      const url = apiOrigin ? `${apiOrigin}/api/ai-consult` : '/api/ai-consult';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({
          patientContext: buildPatientContext(),
          consultationType,
          specificQuestion: specificQuestion.trim() || null,
          icd10Codes: parsedIcd,
          guidelinesContext: injected.map(g => ({ source: g.source, title: g.title, keyRecommendations: g.key_recommendations, evidenceLevel: g.evidence_level })),
        }),
        signal: ctrl.signal,
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})) as { error?: string }; throw new Error(d.error ?? `HTTP ${r.status}`); }
      setAiResponse(await r.json() as AiConsultResponse);
      showToast('AI consultation received', 'success');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      showToast(errMsg(e), 'error'); setApiAvailable(false);
    } finally { setLoading(false); }
  }

  // ── Physician acknowledgement ─────────────────────────────────────────────
  async function handleAcknowledge(action: 'accepted' | 'modified' | 'rejected') {
    if (!aiResponse || !supabase) return;
    if (action === 'modified' && !showModifyInput) { setShowModifyInput(true); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('consultation_requests').insert({
        consultation_type: consultationType,
        specific_question: specificQuestion.trim() || null,
        ai_response: aiResponse,
        physician_action: action,
        physician_notes: action === 'modified' ? physicianNotes.trim() || null : null,
        acknowledged_by: profile?.full_name ?? profile?.id ?? 'Unknown',
        acknowledged_at: new Date().toISOString(),
        patient_id: patientId, encounter_id: encounterId,
      });
      if (error) throw error;
      setPhysicianAction(action);
      showToast(`Consultation ${action} and recorded`, 'success');
      loadHistory();
    } catch (e) { showToast(`Failed to save: ${errMsg(e)}`, 'error'); }
    finally { setSaving(false); }
  }

  // ── Context summary data ──────────────────────────────────────────────────
  const ctxItems: { label: string; value: string }[] = [];
  if (patientName) ctxItems.push({ label: 'Patient', value: `${patientName}${age ? `, ${age}y` : ''}${sex ? ` ${sex.charAt(0).toUpperCase()}` : ''}` });
  if (dob) ctxItems.push({ label: 'DOB', value: dob });
  if (weightKg || heightCm) ctxItems.push({ label: 'Anthropometrics', value: [weightKg ? `${weightKg} kg` : '', heightCm ? `${heightCm} cm` : ''].filter(Boolean).join(', ') });
  ctxItems.push({ label: 'Vitals', value: vitalsLine(vitals) });
  if (symptoms.length > 0) ctxItems.push({ label: 'Symptoms', value: symptoms.join(', ') });
  if (comorbidities.length > 0) ctxItems.push({ label: 'Comorbidities', value: comorbidities.join(', ') });
  if (medications.length > 0) ctxItems.push({ label: 'Medications', value: medications.join(', ') });
  if (allergies) ctxItems.push({ label: 'Allergies', value: allergies });
  const examEntries = Object.entries(examFindings).filter(([, v]) => v.length > 0);
  if (examEntries.length > 0) ctxItems.push({ label: 'Exam findings', value: examEntries.map(([r, f]) => `${r}: ${f.join(', ')}`).join('; ') });
  const investEntries = Object.entries(investigationResults).filter(([, v]) => v.trim());
  if (investEntries.length > 0) ctxItems.push({ label: 'Investigations', value: investEntries.map(([t, r]) => `${t}: ${r}`).join('; ') });
  if (assessment) ctxItems.push({ label: 'Assessment', value: assessment });
  if (differentials) ctxItems.push({ label: 'Differentials', value: differentials });
  if (icdCodes.length > 0) ctxItems.push({ label: 'ICD-10', value: icdCodes.join(', ') });
  if (plan) ctxItems.push({ label: 'Current plan', value: plan.length > 200 ? plan.slice(0, 200) + '…' : plan });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="gap-y">
      <style>{`@keyframes ai-spin{to{transform:rotate(360deg)}}`}</style>

      {/* Safety banner */}
      <div style={css.banner}>
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>{'⚠️'}</span>
        <div>
          <strong>AI Decision Support</strong> — Not a substitute for clinical judgement.
          All suggestions require physician review and acknowledgement before being recorded to the patient chart.
        </div>
      </div>

      {!apiAvailable && (
        <div style={css.noApi}>
          The AI consultant requires a connection to the API server, which is currently unavailable.
          Read-only functions (history, guidelines) may still work via Supabase.
        </div>
      )}

      {/* ── Clinical Context Summary ──────────────────────────────────────── */}
      <CollapsibleCard title="Clinical context" badge={ctxItems.length}>
        {ctxItems.length === 0
          ? <div style={css.muted}>No clinical data available. Complete intake, vitals, and examination sections first.</div>
          : <div style={css.ctxGrid}>
              {ctxItems.map(it => (
                <div key={it.label} style={css.ctxItem}>
                  <div style={css.ctxLabel}>{it.label}</div>
                  <div style={css.ctxVal}>{it.value}</div>
                </div>
              ))}
            </div>
        }
      </CollapsibleCard>

      {/* ── Consultation Request ──────────────────────────────────────────── */}
      <CollapsibleCard title="Consultation request">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="fld">
            <label>Consultation type</label>
            <select value={consultationType} onChange={e => setConsultationType(e.target.value as ConsultationType)}
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, background: '#fff' }}>
              {Object.entries(CONSULTATION_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div className="fld">
            <label>Specific question (optional)</label>
            <textarea value={specificQuestion} onChange={e => setSpecificQuestion(e.target.value)}
              placeholder="e.g., What is the best approach for this CBD stone given the patient's comorbidities?"
              style={{ minHeight: 80, resize: 'vertical' }} />
          </div>
          {injectedGuidelineIds.size > 0 && (
            <div style={{ fontSize: 12, color: '#166534', background: '#f0fdf4', borderRadius: 6, padding: '6px 10px' }}>
              {injectedGuidelineIds.size} guideline{injectedGuidelineIds.size !== 1 ? 's' : ''} will be included in the consultation context.
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="button" onClick={handleRequest} disabled={loading || !apiAvailable}
              style={{ ...css.primary, ...((loading || !apiAvailable) ? css.dim : {}) }}>
              {loading && <span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'ai-spin .7s linear infinite' }} />}
              {loading ? 'Consulting…' : 'Request AI Consultation'}
            </button>
            {!patientName && <span style={{ fontSize: 12, color: '#9ca3af' }}>Tip: Load a patient first for more accurate results.</span>}
          </div>
        </div>
      </CollapsibleCard>

      {/* ── AI Response ───────────────────────────────────────────────────── */}
      {aiResponse && (
        <CollapsibleCard title="AI consultation response">
          <div style={css.respCard}>
            <div style={css.respHead}>
              <div>
                <span style={css.aiTag}>AI-generated</span>
                {aiResponse.modelAttribution && <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>Model: {aiResponse.modelAttribution}</span>}
              </div>
              <span style={{ fontSize: 11, color: '#6b7280' }}>
                {aiResponse.generatedAt ? new Date(aiResponse.generatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Just now'}
              </span>
            </div>

            <div style={css.secTitle}>Assessment summary</div>
            <div style={{ fontSize: 14, color: '#1f2937', lineHeight: 1.6 }}>{aiResponse.assessmentSummary}</div>

            {aiResponse.recommendations.length > 0 && <>
              <div style={css.secTitle}>Recommendations</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {aiResponse.recommendations.map((rec, i) => (
                  <div key={i} style={css.recRow}>
                    <span style={css.recNum}>{i + 1}.</span>
                    <div>
                      <span>{rec.text}</span>
                      {rec.priority && <span style={priorityChip(rec.priority)}>{rec.priority}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>}

            {aiResponse.counterpoints.length > 0 && <>
              <div style={css.secTitle}>Counterpoints / Alternative approaches</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {aiResponse.counterpoints.map((cp, i) => <div key={i} style={css.counter}>{cp}</div>)}
              </div>
            </>}

            {aiResponse.guidelinesReferenced.length > 0 && <>
              <div style={css.secTitle}>Guidelines referenced</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
                {aiResponse.guidelinesReferenced.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </>}

            {aiResponse.evidenceGrade && <>
              <div style={css.secTitle}>Evidence grade</div>
              <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 6, background: '#e0e7ff', color: '#3730a3', fontSize: 13, fontWeight: 600 }}>
                {aiResponse.evidenceGrade}
              </div>
            </>}

            {/* Physician sign-off */}
            {physicianAction ? (
              <div style={{
                marginTop: 16, padding: '10px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                background: physicianAction === 'accepted' ? '#dcfce7' : physicianAction === 'rejected' ? '#fee2e2' : '#e0e7ff',
                color: physicianAction === 'accepted' ? '#166534' : physicianAction === 'rejected' ? '#991b1b' : '#3730a3',
              }}>
                Consultation {physicianAction} by {profile?.full_name ?? 'physician'}
                {physicianAction === 'modified' && physicianNotes && <div style={{ fontWeight: 400, marginTop: 4 }}>Notes: {physicianNotes}</div>}
              </div>
            ) : (
              <>
                <div style={css.actions}>
                  <button type="button" onClick={() => handleAcknowledge('accepted')} disabled={saving}
                    style={{ ...css.btnAccept, ...(saving ? css.dim : {}) }}>Accept</button>
                  <button type="button" onClick={() => handleAcknowledge('modified')} disabled={saving}
                    style={{ ...css.btnModify, ...(saving ? css.dim : {}) }}>Modify</button>
                  <button type="button" onClick={() => handleAcknowledge('rejected')} disabled={saving}
                    style={{ ...css.btnReject, ...(saving ? css.dim : {}) }}>Reject</button>
                  <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>Physician sign-off required to record</span>
                </div>
                {showModifyInput && (
                  <div style={{ marginTop: 10 }}>
                    <div className="fld">
                      <label>Modification notes</label>
                      <textarea value={physicianNotes} onChange={e => setPhysicianNotes(e.target.value)}
                        placeholder="Describe your modifications or additional clinical reasoning…"
                        style={{ minHeight: 70, resize: 'vertical' }} />
                    </div>
                    <button type="button" onClick={() => handleAcknowledge('modified')}
                      disabled={saving || !physicianNotes.trim()}
                      style={{ ...css.btnModify, marginTop: 6, ...((saving || !physicianNotes.trim()) ? css.dim : {}) }}>
                      {saving ? 'Saving…' : 'Confirm modification'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </CollapsibleCard>
      )}

      {/* ── Clinical Guidelines ───────────────────────────────────────────── */}
      <CollapsibleCard title="Clinical guidelines" badge={guidelines.length || undefined} defaultOpen={false}>
        {guidelinesLoading ? <div style={css.muted}>Loading guidelines...</div>
        : guidelines.length === 0 ? (
          <div style={css.muted}>
            {parsedIcd.length === 0
              ? 'Add ICD-10 codes in the Assessment tab to load matching guidelines.'
              : 'No matching clinical guidelines found for the current ICD-10 codes.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {guidelines.map(g => {
              const injected = injectedGuidelineIds.has(g.id);
              return (
                <div key={g.id} style={css.glCard}>
                  <div style={css.glSrc}>{g.source}</div>
                  <div style={css.glTitle}>{g.title}</div>
                  {g.evidence_level && <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Evidence level: {g.evidence_level}</div>}
                  {g.key_recommendations?.length > 0 && (
                    <ul style={{ margin: '4px 0 6px 0', paddingLeft: 16, fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                      {g.key_recommendations.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  )}
                  <button type="button" onClick={() => {
                    setInjectedGuidelineIds(prev => { const n = new Set(prev); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; });
                  }} style={{
                    padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', marginTop: 4,
                    ...(injected
                      ? { background: '#166534', color: '#fff', border: '1px solid #166534' }
                      : { background: '#fff', color: '#166534', border: '1px solid #86efac' }),
                  }}>
                    {injected ? 'Included in context' : 'Inject into consultation'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleCard>

      {/* ── Consultation History ──────────────────────────────────────────── */}
      <CollapsibleCard title="Consultation history" badge={history.length || undefined} defaultOpen={false}>
        {!encounterId ? <div style={css.muted}>Save this encounter to view consultation history.</div>
        : historyLoading ? <div style={css.muted}>Loading history...</div>
        : history.length === 0 ? <div style={css.muted}>No previous AI consultations for this encounter.</div>
        : <div>{history.map(rec => {
            const expanded = expandedHistoryId === rec.id;
            const resp = rec.ai_response;
            return (
              <div key={rec.id}>
                <div style={css.histRow} onClick={() => setExpandedHistoryId(expanded ? null : rec.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#9ca3af', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>{'▶'}</span>
                    <span style={{ fontWeight: 600, color: '#1f2937' }}>{CONSULTATION_LABELS[rec.consultation_type] ?? rec.consultation_type}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={statusChip(rec.physician_action)}>{rec.physician_action ?? 'pending'}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>
                      {new Date(rec.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                </div>
                {expanded && resp && (
                  <div style={{ padding: '12px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: 13 }}>
                    {rec.specific_question && <div style={{ marginBottom: 10 }}><strong>Question:</strong> {rec.specific_question}</div>}
                    <div style={{ marginBottom: 8 }}><strong>Assessment:</strong> {resp.assessmentSummary}</div>
                    {resp.recommendations?.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <strong>Recommendations:</strong>
                        <ol style={{ margin: '4px 0 0', paddingLeft: 18, lineHeight: 1.5 }}>
                          {resp.recommendations.map((r, i) => <li key={i}>{r.text ?? String(r)}</li>)}
                        </ol>
                      </div>
                    )}
                    {rec.physician_action === 'modified' && rec.physician_notes && (
                      <div style={{ marginTop: 6, padding: '6px 10px', background: '#e0e7ff', borderRadius: 4, color: '#3730a3' }}>
                        <strong>Physician notes:</strong> {rec.physician_notes}
                      </div>
                    )}
                    {rec.acknowledged_by && (
                      <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                        Acknowledged by {rec.acknowledged_by}
                        {rec.acknowledged_at && <> at {new Date(rec.acknowledged_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</>}
                      </div>
                    )}
                    <div style={{ marginTop: 4 }}>
                      <span style={css.aiTag}>AI-generated</span>
                      {resp.modelAttribution && <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>{resp.modelAttribution}</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}</div>
        }
      </CollapsibleCard>
    </div>
  );
}
