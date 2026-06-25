import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext, type Section } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import CollapsibleCard from '@/components/CollapsibleCard';
import { supabase } from '@/lib/supabase';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { errMsg } from '@/lib/err';

// ── Types ─────────────────────────────────────────────────────────────────────

type ConsultationType =
  | 'differential_diagnosis' | 'management_plan' | 'surgical_approach'
  | 'investigation_workup' | 'second_opinion';

const CONSULTATION_LABELS: Record<ConsultationType, string> = {
  differential_diagnosis: 'Differential diagnosis',
  management_plan: 'Management plan',
  surgical_approach: 'Surgical approach',
  investigation_workup: 'Investigation workup',
  second_opinion: 'Second opinion',
};

interface AiRecommendation { text: string; priority?: 'high' | 'medium' | 'low'; evidence?: string; }

interface StaffDirective {
  id: string;
  text: string;
  urgency: 'routine' | 'urgent' | 'stat';
  target: 'front_desk' | 'nurse' | 'lab' | 'radiology';
  sent: boolean;
}

interface SuggestedLab { name: string; reason: string; added: boolean; }
interface SuggestedImaging { modality: string; region: string; indication: string; urgency: string; added: boolean; }
interface PrepItem { text: string; checked: boolean; }

interface AiConsultResponse {
  assessmentSummary: string;
  recommendations: AiRecommendation[];
  counterpoints: Array<{ text: string; rationale?: string }>;
  guidelinesReferenced: Array<{ source: string; recommendation: string; grade?: string }>;
  redFlags: string[];
  suggestedInvestigations: string[];
  suggestedFollowUp: string;
  confidenceLevel: string;
  reasoning: string;
}

interface ClinicalGuideline {
  id: string; condition_icd10: string[];
  guideline_source: string; title: string; summary: string;
  key_recommendations: Array<{ text: string; grade: string }>;
  evidence_grade: string;
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
  if (v.temperatureC) p.push(`T ${v.temperatureC}°C`);
  if (v.spo2) p.push(`SpO₂ ${v.spo2}%`);
  if (v.respiratoryRate) p.push(`RR ${v.respiratoryRate}`);
  return p.join(' · ') || '—';
}

function uid() { return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

// Pre-filled lab panels by clinical context
function suggestLabs(symptoms: string[], icdCodes: string[], comorbidities: string[]): SuggestedLab[] {
  const labs: SuggestedLab[] = [];
  const s = symptoms.map(x => x.toLowerCase());
  const c = comorbidities.map(x => x.toLowerCase());
  const codes = icdCodes.map(x => x.toUpperCase());

  labs.push({ name: 'Full Blood Count (FBC)', reason: 'Baseline haematology', added: false });

  if (s.some(x => x.includes('abdominal pain') || x.includes('nausea'))) {
    labs.push({ name: 'Liver Function Tests (LFTs)', reason: 'Abdominal pain workup', added: false });
    labs.push({ name: 'Amylase', reason: 'Rule out pancreatitis', added: false });
    labs.push({ name: 'Lipase', reason: 'Rule out pancreatitis', added: false });
  }
  if (s.some(x => x.includes('jaundice'))) {
    labs.push({ name: 'Liver Function Tests (LFTs)', reason: 'Jaundice workup', added: false });
    labs.push({ name: 'Prothrombin Time (PT/INR)', reason: 'Coagulopathy screen', added: false });
    labs.push({ name: 'Blood Group & Type', reason: 'Pre-ERCP', added: false });
  }
  if (s.some(x => x.includes('rectal bleeding') || x.includes('melaena') || x.includes('black stool'))) {
    labs.push({ name: 'Full Blood Count (FBC)', reason: 'Assess anaemia', added: false });
    labs.push({ name: 'Blood Group & Type', reason: 'Crossmatch if acute', added: false });
    labs.push({ name: 'Prothrombin Time (PT/INR)', reason: 'Coagulopathy', added: false });
    labs.push({ name: 'CEA', reason: 'Colorectal marker', added: false });
  }
  if (s.some(x => x.includes('breast lump'))) {
    labs.push({ name: 'CA-125 (F)', reason: 'Tumour marker panel', added: false });
  }
  if (s.some(x => x.includes('thyroid') || x.includes('neck lump'))) {
    labs.push({ name: 'TSH', reason: 'Thyroid function', added: false });
    labs.push({ name: 'Free T4', reason: 'Thyroid function', added: false });
    labs.push({ name: 'Calcium', reason: 'Parathyroid screen', added: false });
  }
  if (c.some(x => x.includes('diabetes'))) {
    labs.push({ name: 'HbA1c', reason: 'Diabetic control', added: false });
    labs.push({ name: 'Creatinine + eGFR', reason: 'Renal function', added: false });
  }
  if (codes.some(x => x.startsWith('K80') || x.startsWith('K83'))) {
    labs.push({ name: 'Liver Function Tests (LFTs)', reason: 'Biliary pathology', added: false });
    labs.push({ name: 'CRP', reason: 'Inflammatory marker', added: false });
    labs.push({ name: 'Blood Culture ×2', reason: 'If cholangitis suspected', added: false });
  }

  // Pre-op baseline
  if (s.some(x => x.includes('pre-operative') || x.includes('pre-op'))) {
    labs.push({ name: 'Urea & Electrolytes (U&E)', reason: 'Pre-op baseline', added: false });
    labs.push({ name: 'Creatinine + eGFR', reason: 'Pre-op renal', added: false });
    labs.push({ name: 'Blood Group & Type', reason: 'Pre-op crossmatch', added: false });
    labs.push({ name: 'HBsAg (Hepatitis B)', reason: 'Pre-op screen', added: false });
    labs.push({ name: 'HIV Combo (4th gen)', reason: 'Pre-op screen', added: false });
    labs.push({ name: 'Prothrombin Time (PT/INR)', reason: 'Pre-op coags', added: false });
    labs.push({ name: 'Fasting Glucose', reason: 'Pre-op metabolic', added: false });
  }

  // Deduplicate
  const seen = new Set<string>();
  return labs.filter(l => { if (seen.has(l.name)) return false; seen.add(l.name); return true; });
}

function suggestImaging(symptoms: string[], icdCodes: string[]): SuggestedImaging[] {
  const imgs: SuggestedImaging[] = [];
  const s = symptoms.map(x => x.toLowerCase());
  const codes = icdCodes.map(x => x.toUpperCase());

  if (s.some(x => x.includes('abdominal pain'))) {
    imgs.push({ modality: 'Ultrasound', region: 'Abdomen', indication: 'Abdominal pain — assess gallbladder, liver, kidneys', urgency: 'routine', added: false });
  }
  if (s.some(x => x.includes('jaundice'))) {
    imgs.push({ modality: 'Ultrasound', region: 'Abdomen', indication: 'Jaundice — assess biliary tree dilatation', urgency: 'urgent', added: false });
    imgs.push({ modality: 'MRI', region: 'Abdomen', indication: 'MRCP — CBD stone assessment', urgency: 'urgent', added: false });
  }
  if (s.some(x => x.includes('breast lump'))) {
    imgs.push({ modality: 'Ultrasound', region: 'Breast', indication: 'Palpable breast lump — triple assessment', urgency: 'routine', added: false });
  }
  if (s.some(x => x.includes('rectal bleeding') || x.includes('change in bowel'))) {
    imgs.push({ modality: 'Scope', region: 'Colon', indication: 'Colonoscopy — colorectal assessment', urgency: 'routine', added: false });
  }
  if (s.some(x => x.includes('dysphagia'))) {
    imgs.push({ modality: 'Scope', region: 'Upper GI', indication: 'OGD — dysphagia assessment', urgency: 'urgent', added: false });
  }
  if (s.some(x => x.includes('thyroid') || x.includes('neck lump'))) {
    imgs.push({ modality: 'Ultrasound', region: 'Thyroid', indication: 'Thyroid nodule assessment + TIRADS', urgency: 'routine', added: false });
  }
  if (codes.some(x => x.startsWith('C18') || x.startsWith('C19') || x.startsWith('C20'))) {
    imgs.push({ modality: 'CT', region: 'Abdomen & Pelvis (TAP)', indication: 'Staging CT — colorectal cancer', urgency: 'urgent', added: false });
    imgs.push({ modality: 'CT', region: 'Chest', indication: 'Staging — pulmonary metastases', urgency: 'urgent', added: false });
  }
  if (s.some(x => x.includes('pre-operative') || x.includes('pre-op'))) {
    imgs.push({ modality: 'XRay', region: 'Chest', indication: 'Pre-operative chest X-ray', urgency: 'routine', added: false });
  }
  return imgs;
}

function suggestProcedurePrep(symptoms: string[], icdCodes: string[]): PrepItem[] {
  const items: PrepItem[] = [];
  const s = symptoms.map(x => x.toLowerCase());
  const codes = icdCodes.map(x => x.toUpperCase());
  const isEndoscopy = s.some(x => x.includes('colonoscopy') || x.includes('endoscopy') || x.includes('ercp') || x.includes('ogd'));
  const isPreOp = s.some(x => x.includes('pre-operative') || x.includes('pre-op'));

  if (isEndoscopy || codes.some(x => x.startsWith('K'))) {
    items.push({ text: 'Bowel prep instructions sent to patient', checked: false });
    items.push({ text: 'Consent form signed', checked: false });
    items.push({ text: 'Bloods reviewed (FBC, U&E, coags)', checked: false });
    items.push({ text: 'Fasting confirmed (6h solids, 2h clear fluids)', checked: false });
    items.push({ text: 'Blood thinners held per protocol', checked: false });
    items.push({ text: 'Escort arranged for discharge', checked: false });
    items.push({ text: 'Allergies verified and documented', checked: false });
    items.push({ text: 'IV access secured', checked: false });
  }
  if (isPreOp) {
    items.push({ text: 'Anaesthetic review completed', checked: false });
    items.push({ text: 'Consent form signed', checked: false });
    items.push({ text: 'Pre-op bloods reviewed', checked: false });
    items.push({ text: 'ECG reviewed (if > 50 or cardiac risk)', checked: false });
    items.push({ text: 'Chest X-ray reviewed', checked: false });
    items.push({ text: 'VTE risk assessment completed', checked: false });
    items.push({ text: 'DVT prophylaxis prescribed', checked: false });
    items.push({ text: 'Fasting status confirmed', checked: false });
    items.push({ text: 'Surgical site marked', checked: false });
    items.push({ text: 'Blood products available if needed', checked: false });
  }
  return items;
}

function buildStaffDirectives(
  symptoms: string[], assessment: string, icdCodes: string[],
  suggestedLabs: SuggestedLab[], suggestedImgs: SuggestedImaging[],
  patientName: string,
): StaffDirective[] {
  const dirs: StaffDirective[] = [];
  const s = symptoms.map(x => x.toLowerCase());
  const name = patientName.split(' ')[0] || 'Patient';

  if (suggestedLabs.length > 0) {
    const labNames = suggestedLabs.slice(0, 4).map(l => l.name).join(', ');
    dirs.push({
      id: uid(), urgency: 'routine', target: 'front_desk', sent: false,
      text: `Order bloods for ${name}: ${labNames}`,
    });
  }
  if (suggestedImgs.length > 0) {
    suggestedImgs.forEach(img => {
      dirs.push({
        id: uid(), urgency: img.urgency === 'urgent' ? 'urgent' : 'routine',
        target: 'front_desk', sent: false,
        text: `Book ${img.modality} ${img.region} for ${name} — ${img.indication.split('—')[0].trim()}`,
      });
    });
  }
  if (s.some(x => x.includes('follow-up'))) {
    dirs.push({
      id: uid(), urgency: 'routine', target: 'front_desk', sent: false,
      text: `Schedule follow-up for ${name} in 2 weeks`,
    });
  }
  if (s.some(x => x.includes('pre-operative') || x.includes('pre-op'))) {
    dirs.push({
      id: uid(), urgency: 'urgent', target: 'front_desk', sent: false,
      text: `Confirm theatre date for ${name} and send prep instructions`,
    });
    dirs.push({
      id: uid(), urgency: 'routine', target: 'nurse', sent: false,
      text: `Pre-op checklist for ${name} — ensure consent, bloods, anaesthetic review`,
    });
  }
  if (s.some(x => x.includes('urgent') || x.includes('emergency'))) {
    dirs.push({
      id: uid(), urgency: 'stat', target: 'front_desk', sent: false,
      text: `Priority: Move ${name} to next available urgent slot`,
    });
  }
  if (assessment && (assessment.toLowerCase().includes('cancer') || assessment.toLowerCase().includes('malignant'))) {
    dirs.push({
      id: uid(), urgency: 'urgent', target: 'front_desk', sent: false,
      text: `Expedite referral pathway for ${name} — suspected malignancy`,
    });
  }
  return dirs;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  banner:     { background: '#fef3c7', border: '1.5px solid #f59e0b', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#78350f', lineHeight: 1.4 } as React.CSSProperties,
  noApi:      { background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#991b1b', textAlign: 'center' as const } as React.CSSProperties,
  chip:       { padding: '5px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.15s' } as React.CSSProperties,
  chipActive: { background: '#1a3a5c', color: '#fff', border: '1.5px solid #1a3a5c' } as React.CSSProperties,
  chipOff:    { background: '#f9fafb', color: '#374151', border: '1px solid #d1d5db' } as React.CSSProperties,
  chipAdded:  { background: '#dcfce7', color: '#166534', border: '1px solid #86efac', cursor: 'default' } as React.CSSProperties,
  section:    { fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#6b7280', marginBottom: 6, marginTop: 10 } as React.CSSProperties,
  row:        { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13, borderBottom: '1px solid #f3f4f6' } as React.CSSProperties,
  btn:        { padding: '7px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 } as React.CSSProperties,
  btnPri:     { background: '#1a3a5c', color: '#fff' } as React.CSSProperties,
  btnGreen:   { background: '#16a34a', color: '#fff' } as React.CSSProperties,
  btnGhost:   { background: '#f4f6f9', color: '#1a1a1a', border: '1px solid #d1d5db' } as React.CSSProperties,
  btnDanger:  { background: '#dc2626', color: '#fff' } as React.CSSProperties,
  dim:        { opacity: 0.4, cursor: 'default' } as React.CSSProperties,
  urgStat:    { background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' } as React.CSSProperties,
  urgUrgent:  { background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' } as React.CSSProperties,
  urgRoutine: { background: '#f0fdf4', color: '#166534', border: '1px solid #86efac' } as React.CSSProperties,
  muted:      { fontSize: 12, color: '#9ca3af', padding: '6px 0' } as React.CSSProperties,
  ctxGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8, fontSize: 12 } as React.CSSProperties,
  ctxItem:    { background: '#f9fafb', borderRadius: 5, padding: '6px 8px', border: '1px solid #e5e7eb' } as React.CSSProperties,
  ctxLabel:   { fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, color: '#9ca3af', marginBottom: 2 } as React.CSSProperties,
  aiTag:      { background: '#dbeafe', color: '#1e40af', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999, textTransform: 'uppercase' as const } as React.CSSProperties,
  respCard:   { background: '#f0f7ff', border: '1.5px solid #93c5fd', borderRadius: 8, padding: '14px 16px' } as React.CSSProperties,
  glCard:     { background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '8px 10px', marginBottom: 6 } as React.CSSProperties,
};

const urgStyle = (u: string) => u === 'stat' ? S.urgStat : u === 'urgent' ? S.urgUrgent : S.urgRoutine;

// ── Component ─────────────────────────────────────────────────────────────────

export default function AiConsultantTab() {
  const ctx = useAppContext();
  const {
    patientName, age, sex, dob, patientId, encounterId,
    symptoms, symptomDetails, vitals,
    examFindings, investigationResults,
    comorbidities, medications, allergies,
    assessment, icdCodes, differentials,
    rosFindings, weightKg, heightCm, plan,
    orderedInvestigations, setOrderedInvestigations,
    setTopSection, setActiveSection,
  } = ctx;
  const { profile } = useAuth();
  const { showToast } = useToast();

  // State
  const [consultationType, setConsultationType] = useState<ConsultationType>('management_plan');
  const [specificQuestion, setSpecificQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<AiConsultResponse | null>(null);
  const [apiAvailable, setApiAvailable] = useState(true);
  const [physicianAction, setPhysicianAction] = useState<'accepted' | 'modified' | 'rejected' | null>(null);

  // Action panels
  const [staffDirectives, setStaffDirectives] = useState<StaffDirective[]>([]);
  const [suggestedLabsList, setSuggestedLabsList] = useState<SuggestedLab[]>([]);
  const [suggestedImagingList, setSuggestedImagingList] = useState<SuggestedImaging[]>([]);
  const [prepItems, setPrepItems] = useState<PrepItem[]>([]);

  // Guidelines
  const [guidelines, setGuidelines] = useState<ClinicalGuideline[]>([]);
  const [injectedIds, setInjectedIds] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  const parsedIcd = icdCodes.map(parseIcdCode);
  const icdCodeStrings = parsedIcd.map(c => c.code);

  // ── Auto-generate action suggestions on clinical data change ──
  useEffect(() => {
    setSuggestedLabsList(suggestLabs(symptoms, icdCodeStrings, comorbidities));
    setSuggestedImagingList(suggestImaging(symptoms, icdCodeStrings));
    setPrepItems(suggestProcedurePrep(symptoms, icdCodeStrings));
    setStaffDirectives(
      buildStaffDirectives(symptoms, assessment, icdCodeStrings, suggestLabs(symptoms, icdCodeStrings, comorbidities), suggestImaging(symptoms, icdCodeStrings), patientName),
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symptoms.join(','), icdCodes.join(','), comorbidities.join(','), assessment, patientName]);

  // ── API health check ──
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const o = getApiOrigin();
        const r = await fetch(o ? `${o}/api/healthz` : '/api/healthz', { signal: AbortSignal.timeout(4000) });
        if (!off) setApiAvailable(r.ok);
      } catch { if (!off) setApiAvailable(false); }
    })();
    return () => { off = true; };
  }, []);

  // ── Load guidelines ──
  useEffect(() => {
    if (!supabase || parsedIcd.length === 0) { setGuidelines([]); return; }
    let off = false;
    (async () => {
      try {
        const { data } = await supabase.from('clinical_guidelines').select('*')
          .overlaps('condition_icd10', icdCodeStrings);
        if (!off) setGuidelines((data ?? []) as ClinicalGuideline[]);
      } catch { if (!off) setGuidelines([]); }
    })();
    return () => { off = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [icdCodes.join(',')]);

  // ── Build context ──
  function buildCtx() {
    return {
      demographics: { name: patientName || 'Unknown', age: age || '?', sex: sex || '?', dob },
      vitals, symptoms, symptomDetails,
      examFindings: Object.fromEntries(Object.entries(examFindings).filter(([, v]) => v.length > 0)),
      investigations: Object.fromEntries(Object.entries(investigationResults).filter(([, v]) => v.trim())),
      reviewOfSystems: Object.fromEntries(Object.entries(rosFindings).filter(([, v]) => v.status !== 'not-asked')),
      assessment, differentials, medications, allergies, comorbidities,
    };
  }

  // ── AI request ──
  async function handleRequest() {
    if (loading) return;
    const origin = getApiOrigin();
    if (!origin && import.meta.env.PROD) { showToast('API server unavailable', 'error'); return; }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true); setAiResponse(null); setPhysicianAction(null);
    try {
      const injected = guidelines.filter(g => injectedIds.has(g.id));
      const url = origin ? `${origin}/api/ai-consult` : '/api/ai-consult';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({
          patientContext: buildCtx(), consultationType,
          specificQuestion: specificQuestion.trim() || null,
          icd10Codes: parsedIcd,
          guidelinesContext: injected.map(g => ({
            title: g.title, guideline_source: g.guideline_source,
            summary: g.summary, key_recommendations: g.key_recommendations,
          })),
          patientId, encounterId,
        }),
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const resp = (data.consultation ?? data) as AiConsultResponse;
      setAiResponse(resp);

      // Auto-add AI-suggested labs to suggestions
      if (resp.suggestedInvestigations?.length) {
        const newLabs = resp.suggestedInvestigations
          .filter(name => !suggestedLabsList.some(l => l.name === name))
          .map(name => ({ name, reason: 'AI recommended', added: false }));
        if (newLabs.length) setSuggestedLabsList(prev => [...prev, ...newLabs]);
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      showToast(errMsg(e), 'error');
    } finally { setLoading(false); }
  }

  // ── Actions ──
  function addLabToOrder(idx: number) {
    const lab = suggestedLabsList[idx];
    if (!lab || lab.added) return;
    if (!orderedInvestigations.includes(lab.name)) {
      setOrderedInvestigations([...orderedInvestigations, lab.name]);
    }
    setSuggestedLabsList(prev => prev.map((l, i) => i === idx ? { ...l, added: true } : l));
    showToast(`Added ${lab.name} to lab orders`, 'success');
  }

  function addAllLabs() {
    const toAdd = suggestedLabsList.filter(l => !l.added).map(l => l.name);
    const newOrders = [...orderedInvestigations, ...toAdd.filter(n => !orderedInvestigations.includes(n))];
    setOrderedInvestigations(newOrders);
    setSuggestedLabsList(prev => prev.map(l => ({ ...l, added: true })));
    showToast(`Added ${toAdd.length} labs to orders`, 'success');
  }

  function markDirectiveSent(id: string) {
    setStaffDirectives(prev => prev.map(d => d.id === id ? { ...d, sent: true } : d));
    showToast('Directive marked as sent', 'success');
  }

  function togglePrep(idx: number) {
    setPrepItems(prev => prev.map((p, i) => i === idx ? { ...p, checked: !p.checked } : p));
  }

  function navTo(top: string, section: string) {
    setTopSection(top as any);
    setActiveSection(section as Section);
  }

  // ── Context items (compact) ──
  const ctxItems: { label: string; value: string }[] = [];
  if (patientName) ctxItems.push({ label: 'Patient', value: `${patientName}${age ? `, ${age}y` : ''}${sex ? ` ${sex[0].toUpperCase()}` : ''}` });
  ctxItems.push({ label: 'Vitals', value: vitalsLine(vitals) });
  if (symptoms.length) ctxItems.push({ label: 'CC', value: symptoms.join(', ') });
  if (comorbidities.length) ctxItems.push({ label: 'PMH', value: comorbidities.join(', ') });
  if (medications.length) ctxItems.push({ label: 'Meds', value: typeof medications[0] === 'string' ? medications.join(', ') : String(medications.length) + ' active' });
  if (assessment) ctxItems.push({ label: 'Assess', value: assessment.length > 120 ? assessment.slice(0, 120) + '…' : assessment });
  if (icdCodes.length) ctxItems.push({ label: 'ICD-10', value: icdCodes.join(', ') });

  const pendingDirectives = staffDirectives.filter(d => !d.sent).length;
  const pendingLabs = suggestedLabsList.filter(l => !l.added).length;
  const pendingPrep = prepItems.filter(p => !p.checked).length;

  // ── Render ──
  return (
    <div className="gap-y">
      <style>{`@keyframes ai-spin{to{transform:rotate(360deg)}}`}</style>

      {/* Safety banner — compact */}
      <div style={S.banner}>
        <span style={{ fontSize: 15 }}>{'⚕️'}</span>
        <span><strong>Consultant AI Aid</strong> — Decision support. All actions require your approval.</span>
      </div>

      {!apiAvailable && <div style={S.noApi}>API server unavailable — AI consultation offline. Pre-filled orders still work.</div>}

      {/* ── STAFF DIRECTIVES ─────────────────────────────────────── */}
      {staffDirectives.length > 0 && (
        <CollapsibleCard title="Staff directives" badge={pendingDirectives || undefined}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {staffDirectives.map(d => (
              <div key={d.id} style={{
                ...S.row, opacity: d.sent ? 0.5 : 1,
                background: d.sent ? '#f9fafb' : undefined,
              }}>
                <span style={{ ...S.chip, ...urgStyle(d.urgency), fontSize: 9, padding: '2px 6px', cursor: 'default' }}>
                  {d.urgency.toUpperCase()}
                </span>
                <span style={{ fontSize: 9, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', minWidth: 60 }}>
                  {d.target.replace('_', ' ')}
                </span>
                <span style={{ flex: 1, fontSize: 13 }}>{d.text}</span>
                {d.sent ? (
                  <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Sent</span>
                ) : (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button type="button" style={{ ...S.btn, ...S.btnGreen, padding: '4px 10px', fontSize: 11 }}
                      onClick={() => markDirectiveSent(d.id)}>
                      Send
                    </button>
                    <button type="button" style={{ ...S.btn, ...S.btnGhost, padding: '4px 8px', fontSize: 11 }}
                      onClick={() => setStaffDirectives(prev => prev.filter(x => x.id !== d.id))}>
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleCard>
      )}

      {/* ── PRE-FILLED LAB ORDERS ────────────────────────────────── */}
      {suggestedLabsList.length > 0 && (
        <CollapsibleCard title="Suggested lab orders" badge={pendingLabs || undefined}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {suggestedLabsList.map((lab, i) => (
              <button key={i} type="button" onClick={() => addLabToOrder(i)}
                title={lab.reason}
                style={{ ...S.chip, ...(lab.added ? S.chipAdded : S.chipOff) }}>
                {lab.added ? '✓' : '+'} {lab.name}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {pendingLabs > 0 && (
              <button type="button" onClick={addAllLabs} style={{ ...S.btn, ...S.btnPri, fontSize: 11 }}>
                Add all {pendingLabs} to orders
              </button>
            )}
            <button type="button" onClick={() => navTo('consultation', 'investigations')}
              style={{ ...S.btn, ...S.btnGhost, fontSize: 11 }}>
              Open Labs tab →
            </button>
          </div>
        </CollapsibleCard>
      )}

      {/* ── SUGGESTED IMAGING ────────────────────────────────────── */}
      {suggestedImagingList.length > 0 && (
        <CollapsibleCard title="Suggested imaging" badge={suggestedImagingList.filter(x => !x.added).length || undefined}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {suggestedImagingList.map((img, i) => (
              <div key={i} style={{ ...S.row, opacity: img.added ? 0.5 : 1 }}>
                <span style={{ ...S.chip, ...urgStyle(img.urgency), fontSize: 9, padding: '2px 6px', cursor: 'default' }}>
                  {img.modality}
                </span>
                <span style={{ flex: 1, fontSize: 13 }}>
                  <strong>{img.region}</strong> — {img.indication}
                </span>
                {img.added ? (
                  <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Added</span>
                ) : (
                  <button type="button" onClick={() => {
                    setSuggestedImagingList(prev => prev.map((x, j) => j === i ? { ...x, added: true } : x));
                    navTo('consultation', 'radiology');
                    showToast(`Navigate to Radiology to complete ${img.modality} ${img.region} order`, 'info');
                  }} style={{ ...S.btn, ...S.btnPri, padding: '4px 10px', fontSize: 11 }}>
                    Add →
                  </button>
                )}
              </div>
            ))}
          </div>
        </CollapsibleCard>
      )}

      {/* ── PROCEDURE PREP CHECKLIST ─────────────────────────────── */}
      {prepItems.length > 0 && (
        <CollapsibleCard title="Procedure prep checklist" badge={pendingPrep || undefined}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {prepItems.map((item, i) => (
              <label key={i} style={{
                ...S.row, cursor: 'pointer', fontSize: 13,
                textDecoration: item.checked ? 'line-through' : 'none',
                color: item.checked ? '#9ca3af' : '#1f2937',
              }}>
                <input type="checkbox" checked={item.checked} onChange={() => togglePrep(i)}
                  style={{ width: 16, height: 16, accentColor: '#16a34a', cursor: 'pointer' }} />
                {item.text}
              </label>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
            {pendingPrep === 0 ? 'All items checked — patient ready.' : `${pendingPrep} item${pendingPrep !== 1 ? 's' : ''} remaining`}
          </div>
        </CollapsibleCard>
      )}

      {/* ── CLINICAL CONTEXT (collapsed) ─────────────────────────── */}
      <CollapsibleCard title="Clinical context" badge={ctxItems.length} defaultOpen={false}>
        <div style={S.ctxGrid}>
          {ctxItems.map(it => (
            <div key={it.label} style={S.ctxItem}>
              <div style={S.ctxLabel}>{it.label}</div>
              <div style={{ fontSize: 12, color: '#111827' }}>{it.value}</div>
            </div>
          ))}
        </div>
      </CollapsibleCard>

      {/* ── AI CONSULTATION ──────────────────────────────────────── */}
      <CollapsibleCard title="AI consultation">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {(Object.entries(CONSULTATION_LABELS) as [ConsultationType, string][]).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setConsultationType(k)}
              style={{ ...S.chip, ...(consultationType === k ? S.chipActive : S.chipOff) }}>
              {l}
            </button>
          ))}
        </div>
        <div className="fld" style={{ marginBottom: 8 }}>
          <input type="text" value={specificQuestion} onChange={e => setSpecificQuestion(e.target.value)}
            placeholder="Specific question (optional)…"
            onKeyDown={e => { if (e.key === 'Enter') handleRequest(); }}
            style={{ fontSize: 13 }} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={handleRequest} disabled={loading || !apiAvailable}
            style={{ ...S.btn, ...S.btnPri, ...((loading || !apiAvailable) ? S.dim : {}) }}>
            {loading && <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'ai-spin .6s linear infinite' }} />}
            {loading ? 'Consulting…' : 'Consult'}
          </button>
          {injectedIds.size > 0 && (
            <span style={{ fontSize: 11, color: '#166534' }}>{injectedIds.size} guideline{injectedIds.size !== 1 ? 's' : ''} injected</span>
          )}
        </div>
      </CollapsibleCard>

      {/* ── AI RESPONSE ──────────────────────────────────────────── */}
      {aiResponse && (
        <CollapsibleCard title="AI response">
          <div style={S.respCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={S.aiTag}>AI-generated</span>
              {aiResponse.confidenceLevel && (
                <span style={{ fontSize: 11, color: '#6b7280' }}>Confidence: {aiResponse.confidenceLevel}</span>
              )}
            </div>

            {/* Assessment */}
            <div style={{ fontSize: 13, color: '#1f2937', lineHeight: 1.6, marginBottom: 10 }}>
              {aiResponse.assessmentSummary}
            </div>

            {/* Red flags */}
            {aiResponse.redFlags?.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '8px 10px', marginBottom: 8 }}>
                <div style={{ ...S.section, color: '#991b1b', marginTop: 0 }}>Red flags</div>
                {aiResponse.redFlags.map((f, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#991b1b', padding: '2px 0' }}>• {f}</div>
                ))}
              </div>
            )}

            {/* Recommendations — compact numbered list */}
            {aiResponse.recommendations?.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={S.section}>Recommendations</div>
                {aiResponse.recommendations.map((rec, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, fontSize: 13, padding: '3px 0', color: '#1f2937' }}>
                    <span style={{ fontWeight: 700, color: '#1a3a5c', minWidth: 18 }}>{i + 1}.</span>
                    <span>{rec.text}</span>
                    {rec.priority && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 999, marginLeft: 4,
                        background: rec.priority === 'high' ? '#fee2e2' : rec.priority === 'medium' ? '#fef3c7' : '#f0fdf4',
                        color: rec.priority === 'high' ? '#991b1b' : rec.priority === 'medium' ? '#78350f' : '#166534',
                      }}>{rec.priority}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Counterpoints */}
            {aiResponse.counterpoints?.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={S.section}>Counterpoints</div>
                {aiResponse.counterpoints.map((cp, i) => (
                  <div key={i} style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 5, padding: '6px 8px', fontSize: 12, color: '#713f12', marginBottom: 4 }}>
                    {typeof cp === 'string' ? cp : cp.text}
                    {typeof cp !== 'string' && cp.rationale && (
                      <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>↳ {cp.rationale}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Guidelines referenced */}
            {aiResponse.guidelinesReferenced?.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={S.section}>Guidelines cited</div>
                {aiResponse.guidelinesReferenced.map((g, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#374151', padding: '2px 0' }}>
                    {typeof g === 'string' ? g : (
                      <><strong>{g.source}</strong>: {g.recommendation} {g.grade && <span style={{ fontSize: 10, color: '#6b7280' }}>[{g.grade}]</span>}</>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Follow-up suggestion */}
            {aiResponse.suggestedFollowUp && (
              <div style={{ fontSize: 12, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 5, padding: '6px 8px', marginBottom: 8 }}>
                <strong>Follow-up:</strong> {aiResponse.suggestedFollowUp}
              </div>
            )}

            {/* Physician action */}
            {physicianAction ? (
              <div style={{
                marginTop: 10, padding: '8px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                background: physicianAction === 'accepted' ? '#dcfce7' : physicianAction === 'rejected' ? '#fee2e2' : '#e0e7ff',
                color: physicianAction === 'accepted' ? '#166534' : physicianAction === 'rejected' ? '#991b1b' : '#3730a3',
              }}>
                {physicianAction.charAt(0).toUpperCase() + physicianAction.slice(1)} by {profile?.full_name ?? 'physician'}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" style={{ ...S.btn, ...S.btnGreen }} onClick={() => { setPhysicianAction('accepted'); showToast('Consultation accepted', 'success'); }}>Accept</button>
                <button type="button" style={{ ...S.btn, ...S.btnGhost }} onClick={() => { setPhysicianAction('modified'); showToast('Consultation noted with modifications', 'info'); }}>Modify</button>
                <button type="button" style={{ ...S.btn, background: '#fff', color: '#dc2626', border: '1px solid #fca5a5' }} onClick={() => { setPhysicianAction('rejected'); showToast('Consultation rejected', 'info'); }}>Reject</button>
              </div>
            )}
          </div>
        </CollapsibleCard>
      )}

      {/* ── GUIDELINES ───────────────────────────────────────────── */}
      {guidelines.length > 0 && (
        <CollapsibleCard title="Guidelines" badge={guidelines.length} defaultOpen={false}>
          {guidelines.map(g => {
            const on = injectedIds.has(g.id);
            return (
              <div key={g.id} style={S.glCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>{g.guideline_source}</span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#14532d', marginTop: 1 }}>{g.title}</div>
                  </div>
                  <button type="button" onClick={() => {
                    setInjectedIds(prev => { const n = new Set(prev); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n; });
                  }} style={{
                    ...S.chip, fontSize: 10, padding: '3px 8px',
                    ...(on ? { background: '#166534', color: '#fff', border: '1px solid #166534' }
                           : { background: '#fff', color: '#166534', border: '1px solid #86efac' }),
                  }}>
                    {on ? 'Injected' : 'Inject'}
                  </button>
                </div>
                {g.key_recommendations?.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    {g.key_recommendations.slice(0, 3).map((r, i) => (
                      <div key={i} style={{ fontSize: 11, color: '#374151', padding: '1px 0' }}>
                        • {typeof r === 'string' ? r : r.text}
                        {typeof r !== 'string' && r.grade && <span style={{ fontSize: 9, color: '#6b7280' }}> [{r.grade}]</span>}
                      </div>
                    ))}
                    {g.key_recommendations.length > 3 && (
                      <div style={{ fontSize: 10, color: '#9ca3af' }}>+{g.key_recommendations.length - 3} more</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CollapsibleCard>
      )}
    </div>
  );
}
