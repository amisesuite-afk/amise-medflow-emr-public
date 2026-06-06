'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getPatientClient } from '@/lib/patient-supabase';

const TEAL = '#0d9488';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'https://amise-medflow-api.onrender.com';

// ── Types ─────────────────────────────────────────────────────────────────────

type VisitType = 'surgical' | 'endoscopy' | 'followup' | 'unsure';
type Step = 0 | 1 | 2 | 3 | 4 | 'bailout' | 'done';

interface Step3Answers {
  // Gallbladder
  fattyFoodWorse?: boolean;
  painRadiates?: boolean;
  fever?: boolean;
  jaundice?: boolean;
  // Gastric / ulcer
  burningHungry?: boolean;
  wakesAtNight?: boolean;
  blackBlood?: boolean;
  nsaids?: boolean;
  // Rectal bleeding
  bloodColour?: 'bright' | 'dark';
  bloodLocation?: 'paper' | 'bowl';
  bowelChange?: boolean;
  familyHistoryCancer?: boolean;
  // Dysphagia
  dysphagiaDuration?: string;
  weightLossDue?: boolean;
  regurgitation?: boolean;
  // Hernia
  reducible?: 'yes' | 'no' | 'sometimes';
  stuck?: boolean;
  // Screening
  lastScope?: 'never' | '1-5yr' | 'over5yr';
  familyHistoryColon?: boolean;
  // General
  severity?: number;
  durationDays?: string;
}

// ── Branching data ────────────────────────────────────────────────────────────

const SURGICAL_COMPLAINTS = [
  { value: 'abdominal-pain',   label: 'Abdominal pain',            icon: '🫁' },
  { value: 'lump',             label: 'Lump or swelling',          icon: '🔵' },
  { value: 'hernia',           label: 'Hernia',                    icon: '🔺' },
  { value: 'bowel-change',     label: 'Change in bowel habits',    icon: '🔄' },
  { value: 'rectal-bleeding',  label: 'Rectal bleeding',           icon: '🔴' },
  { value: 'weight-loss',      label: 'Unexplained weight loss',   icon: '⚖️' },
  { value: 'other',            label: 'Something else',            icon: '💬' },
];

const ENDOSCOPY_COMPLAINTS = [
  { value: 'heartburn',        label: 'Heartburn / acid reflux',   icon: '🔥' },
  { value: 'swallowing',       label: 'Difficulty swallowing',     icon: '🤐' },
  { value: 'stomach-pain',     label: 'Stomach pain / possible ulcer', icon: '🌀' },
  { value: 'screening',        label: 'Colonoscopy screening',     icon: '🔬' },
  { value: 'rectal-bleeding',  label: 'Rectal bleeding',           icon: '🔴' },
  { value: 'other',            label: 'Something else',            icon: '💬' },
];

const ABDOMEN_LOCATIONS = [
  { value: 'upper-right',  label: 'Upper right (below ribs)',    track: 'gallbladder' },
  { value: 'upper-centre', label: 'Upper centre / left (stomach area)', track: 'gastric' },
  { value: 'lower-right',  label: 'Lower right',                 track: 'appendix' },
  { value: 'periumbilical',label: 'Around the belly button',     track: 'periumbilical' },
  { value: 'diffuse',      label: 'All over / moves around',     track: 'diffuse' },
];

const LUMP_LOCATIONS = [
  { value: 'groin',    label: 'Groin / inner thigh',  track: 'groin-lump' },
  { value: 'abdomen',  label: 'Abdomen / belly',      track: 'abdominal-lump' },
  { value: 'neck',     label: 'Neck / throat',        track: 'neck-lump' },
  { value: 'other',    label: 'Other location',       track: 'other-lump' },
];

const HERNIA_TYPES = [
  { value: 'inguinal',    label: 'Groin (inguinal)',           track: 'inguinal-hernia' },
  { value: 'umbilical',   label: 'Belly button (umbilical)',   track: 'umbilical-hernia' },
  { value: 'incisional',  label: 'Old scar / previous surgery site', track: 'incisional-hernia' },
  { value: 'unsure',      label: 'Not sure',                  track: 'hernia-unsure' },
];

const BOWEL_CHANGES = [
  { value: 'looser',    label: 'More frequent / looser stools', track: 'diarrhoea' },
  { value: 'harder',    label: 'Less frequent / harder stools', track: 'constipation' },
  { value: 'alternating', label: 'Alternating diarrhoea and constipation', track: 'ibs-like' },
  { value: 'ribbon',    label: 'Ribbon-thin or pencil-thin stools', track: 'mass-effect' },
];

const GERD_FREQUENCY = [
  { value: 'mild',    label: 'Occasional (1–2 times per week)', track: 'mild-gerd' },
  { value: 'moderate',label: 'Several times per week',          track: 'gerd' },
  { value: 'daily',   label: 'Daily or constant',               track: 'severe-gerd' },
];

const DYSPHAGIA_TYPE = [
  { value: 'solids-only', label: 'Difficulty with solids, OK with liquids', track: 'mechanical-dysphagia' },
  { value: 'both',        label: 'Difficulty with both solids and liquids',  track: 'severe-dysphagia' },
  { value: 'pain',        label: 'Painful swallowing',                       track: 'odynophagia' },
];

const SCOPE_HISTORY = [
  { value: 'never',  label: 'Never had a colonoscopy',       track: 'routine-screening' },
  { value: '1-5yr',  label: 'Had one 1–5 years ago',         track: 'surveillance' },
  { value: 'over5yr',label: 'More than 5 years ago',         track: 'overdue-screening' },
];

function getStep2Options(complaint: string) {
  switch (complaint) {
    case 'abdominal-pain': return { title: 'Where is the pain?', options: ABDOMEN_LOCATIONS, hint: 'Point to the area that bothers you most.' };
    case 'lump':           return { title: 'Where is the lump?', options: LUMP_LOCATIONS, hint: 'Select the location closest to where you feel it.' };
    case 'hernia':         return { title: 'Which type of hernia?', options: HERNIA_TYPES, hint: 'Select the one that best describes it, or "Not sure".' };
    case 'bowel-change':   return { title: 'What kind of change?', options: BOWEL_CHANGES, hint: 'Describe how your bowel habits have changed.' };
    case 'heartburn':      return { title: 'How often does it happen?', options: GERD_FREQUENCY, hint: 'Choose the option that best describes your experience.' };
    case 'swallowing':     return { title: 'What type of difficulty?', options: DYSPHAGIA_TYPE, hint: '' };
    case 'screening':      return { title: 'Last colonoscopy?', options: SCOPE_HISTORY, hint: '' };
    default: return null;
  }
}

function complaintsForVisitType(vt: VisitType) {
  if (vt === 'surgical') return SURGICAL_COMPLAINTS;
  if (vt === 'endoscopy') return ENDOSCOPY_COMPLAINTS;
  return [];
}

function needsStep2(complaint: string): boolean {
  return ['abdominal-pain','lump','hernia','bowel-change','heartburn','swallowing','screening'].includes(complaint);
}

function computeComplexityScore(
  visitType: string,
  symptoms: string[],
  durationDays: number | null,
  severity: number | null,
  priorTreatment: string,
  isReferral: boolean,
  complaintTrack: string,
): number {
  let s = 0;
  if (symptoms.length > 3) s += 2;
  if (durationDays && durationDays >= 90) s += 2;
  if (severity && severity >= 7) s += 2;
  const hasWeightLoss = symptoms.some(x => x.toLowerCase().includes('weight'));
  const hasRectalBleeding = symptoms.some(x => x.toLowerCase().includes('bleed'));
  const hasBowelChange = symptoms.some(x => x.toLowerCase().includes('bowel'));
  const hasJaundice = symptoms.some(x => x.toLowerCase().includes('jaundice'));
  if ((hasWeightLoss && hasRectalBleeding) || (hasWeightLoss && hasBowelChange)) s += 3;
  if (hasJaundice) s += 2;
  if (['mechanical-dysphagia','severe-dysphagia','mass-effect'].includes(complaintTrack)) s += 3;
  if (priorTreatment.trim()) s += 2;
  if (isReferral) s += 1;
  if (visitType === 'unsure') s += 3;
  return Math.min(s, 15);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Block({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 22px', marginBottom: 14 }}>
      {children}
    </div>
  );
}

function ChoiceGrid({ options, selected, onSelect }: {
  options: { value: string; label: string; track?: string; icon?: string }[];
  selected: string;
  onSelect: (v: string, track?: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {options.map(o => {
        const active = selected === o.value;
        return (
          <button key={o.value} type="button" onClick={() => onSelect(o.value, o.track)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 16px', borderRadius: 10,
              border: active ? `2px solid ${TEAL}` : '1px solid #e2e8f0',
              background: active ? `${TEAL}12` : '#fafafa',
              color: active ? '#0f766e' : '#374151',
              fontSize: 15, fontWeight: active ? 700 : 400,
              textAlign: 'left', cursor: 'pointer',
            }}>
            {o.icon && <span style={{ fontSize: 18 }}>{o.icon}</span>}
            {o.label}
            {active && <span style={{ marginLeft: 'auto', fontSize: 16 }}>✓</span>}
          </button>
        );
      })}
    </div>
  );
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
      {[{ l: 'Yes', v: true }, { l: 'No', v: false }].map(({ l, v }) => {
        const active = value === v;
        return (
          <button key={l} type="button" onClick={() => onChange(v)}
            style={{
              flex: 1, padding: '11px', borderRadius: 8,
              border: active ? `2px solid ${TEAL}` : '1px solid #e2e8f0',
              background: active ? `${TEAL}15` : '#fff',
              color: active ? TEAL : '#64748b',
              fontSize: 14, fontWeight: active ? 700 : 400, cursor: 'pointer',
            }}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

function SeverityPicker({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
        const active = value === n;
        const clr = n <= 3 ? '#065f46' : n <= 6 ? '#92400e' : '#991b1b';
        const bg  = n <= 3 ? '#d1fae5' : n <= 6 ? '#fef3c7' : '#fee2e2';
        return (
          <button key={n} type="button" onClick={() => onChange(n)}
            style={{
              width: 38, height: 38, borderRadius: 8,
              border: active ? `2px solid ${clr}` : '1px solid #e2e8f0',
              background: active ? bg : '#f8fafc',
              color: active ? clr : '#64748b',
              fontSize: 14, fontWeight: active ? 800 : 400, cursor: 'pointer',
            }}>
            {n}
          </button>
        );
      })}
    </div>
  );
}

function ProgressDots({ step }: { step: Step }) {
  const steps: Step[] = [0, 1, 2, 3, 4];
  const idx = typeof step === 'number' ? steps.indexOf(step) : -1;
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
      {steps.map((s, i) => (
        <div key={i} style={{
          width: i === idx ? 20 : 8, height: 8, borderRadius: 4,
          background: i < idx ? TEAL : i === idx ? TEAL : '#e2e8f0',
          transition: 'all 0.2s',
        }} />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function IntakePage() {
  const router = useRouter();
  const sb = getPatientClient();

  const [patientId, setPatientId]     = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [step, setStep]               = useState<Step>(0);
  const [priorIntakes, setPriorIntakes] = useState<{ id: string; submitted_at: string; chief_complaint: string | null }[]>([]);

  // Step 0
  const [visitType, setVisitType]     = useState<VisitType | ''>('');

  // Step 1
  const [complaint, setComplaint]     = useState('');
  const [unsureText, setUnsureText]   = useState('');

  // Step 2
  const [specifics, setSpecifics]     = useState('');
  const [complaintTrack, setTrack]    = useState('');

  // Step 3
  const [s3, setS3]                   = useState<Step3Answers>({});
  const setS3Field = useCallback(<K extends keyof Step3Answers>(k: K, v: Step3Answers[K]) => {
    setS3(prev => ({ ...prev, [k]: v }));
  }, []);

  // Step 4 — universal
  const [currentMeds, setCurrentMeds]       = useState('');
  const [allergies, setAllergies]           = useState('');
  const [isReferral, setIsReferral]         = useState<boolean | null>(null);
  const [referralDoc, setReferralDoc]       = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Bail-out
  const [bailName, setBailName]             = useState('');
  const [bailPhone, setBailPhone]           = useState('');

  // Auth
  useEffect(() => {
    void (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/patient/login'); return; }

      const { data: pat } = await sb.from('patients').select('id, full_name').single();
      if (!pat) { setLoading(false); return; }
      setPatientId(pat.id);
      setBailName(pat.full_name ?? '');

      const { data: intakes } = await sb
        .from('patient_intake')
        .select('id, submitted_at, chief_complaint')
        .eq('patient_id', pat.id)
        .order('submitted_at', { ascending: false })
        .limit(3);
      setPriorIntakes(intakes ?? []);
      setLoading(false);
    })();
  }, [router, sb]);

  // ── Navigation ───────────────────────────────────────────────────────────────

  function handleVisitType(vt: VisitType) {
    setVisitType(vt);
    if (vt === 'followup') setStep(4);
    else if (vt === 'unsure') { setTrack('unsure'); setStep(1); }
    else setStep(1);
  }

  function handleComplaint(val: string, track?: string) {
    setComplaint(val);
    if (!needsStep2(val)) {
      setTrack(track ?? val);
      setStep(3);
    } else {
      setStep(2);
    }
  }

  function handleSpecifics(val: string, track?: string) {
    setSpecifics(val);
    setTrack(track ?? val);
    setStep(3);
  }

  function goBack() {
    if (step === 1) setStep(0);
    else if (step === 2) setStep(1);
    else if (step === 3) needsStep2(complaint) ? setStep(2) : setStep(1);
    else if (step === 4) {
      if (visitType === 'followup') setStep(0);
      else if (visitType === 'unsure') setStep(1);
      else setStep(3);
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!patientId || submitting) return;
    setSubmitting(true);

    const symptomsList: string[] = [];
    if (s3.jaundice) symptomsList.push('Jaundice');
    if (s3.fever) symptomsList.push('Fever');
    if (s3.blackBlood) symptomsList.push('Blood in stool');
    if (complaint === 'rectal-bleeding') symptomsList.push('Rectal bleeding');
    if (complaint === 'weight-loss') symptomsList.push('Unexplained weight loss');
    if (complaint === 'bowel-change') symptomsList.push('Change in bowel habits');
    if (s3.bowelChange) symptomsList.push('Change in bowel habits');
    if (s3.weightLossDue) symptomsList.push('Weight loss (dysphagia-related)');

    const durationDays = s3.durationDays ? parseInt(s3.durationDays) : null;
    const complexity = computeComplexityScore(
      visitType,
      symptomsList,
      durationDays,
      s3.severity ?? null,
      currentMeds,
      isReferral === true,
      complaintTrack,
    );

    const chiefComplaint =
      visitType === 'unsure' ? unsureText.trim() :
      visitType === 'followup' ? 'Follow-up visit' :
      SURGICAL_COMPLAINTS.find(c => c.value === complaint)?.label
      ?? ENDOSCOPY_COMPLAINTS.find(c => c.value === complaint)?.label
      ?? complaint;

    const referralReason = isReferral === true
      ? (referralDoc.trim() ? `Referred by: ${referralDoc.trim()}` : 'Yes — referring doctor not specified')
      : isReferral === false ? 'Self-referred' : null;

    // Flatten Step 3 answers into additional notes
    const step3Notes = Object.entries(s3)
      .filter(([k]) => !['severity','durationDays'].includes(k))
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join('; ');

    const { data: insertData, error } = await sb
      .from('patient_intake')
      .insert({
        patient_id:      patientId,
        visit_type:      visitType || null,
        complaint_track: complaintTrack || null,
        complexity_score: complexity,
        chief_complaint: chiefComplaint || null,
        symptoms:        symptomsList.length > 0 ? symptomsList : null,
        duration_days:   durationDays,
        severity:        s3.severity ?? null,
        prior_treatment: null,
        current_meds:    currentMeds.trim() || null,
        allergies_note:  allergies.trim() || null,
        referral_reason: referralReason,
        additional_notes: [
          step3Notes,
          specifics ? `Location/specifics: ${specifics}` : '',
          additionalNotes.trim(),
        ].filter(Boolean).join('\n') || null,
      })
      .select('id')
      .single();

    setSubmitting(false);

    if (error || !insertData) {
      alert('Could not submit. Please check your connection and try again.');
      return;
    }

    // Fire-and-forget AI summary generation
    fetch(`${API}/api/patient/intake-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intake_id: insertData.id }),
    }).catch(() => { /* non-fatal */ });

    setStep('done');
  }

  async function handleBailout() {
    if (!patientId || submitting) return;
    setSubmitting(true);

    const { data: insertData } = await sb
      .from('patient_intake')
      .insert({
        patient_id:       patientId,
        visit_type:       visitType || 'unsure',
        complaint_track:  'minimal',
        complexity_score: 0,
        chief_complaint:  bailName ? `Minimal intake — ${bailName}` : 'Minimal intake',
        additional_notes: bailPhone ? `Patient prefers call at: ${bailPhone}` : 'Patient preferred to discuss with doctor',
      })
      .select('id')
      .single();

    setSubmitting(false);

    if (insertData) {
      fetch(`${API}/api/patient/intake-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intake_id: insertData.id }),
      }).catch(() => { /* non-fatal */ });
    }

    setStep('done');
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  const qlabel: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: '#1e293b', display: 'block', marginBottom: 6 };
  const hint: React.CSSProperties   = { fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 10 };
  const textarea: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, color: '#1e293b', boxSizing: 'border-box', resize: 'vertical', minHeight: 72, fontFamily: 'inherit' };
  const input: React.CSSProperties    = { width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, color: '#1e293b', boxSizing: 'border-box', fontFamily: 'inherit' };
  const sel: React.CSSProperties      = { width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, color: '#1e293b', boxSizing: 'border-box', cursor: 'pointer', background: '#fff' };

  function BailOutLink() {
    return (
      <button type="button" onClick={() => setStep('bailout')}
        style={{ width: '100%', marginTop: 20, padding: '12px', borderRadius: 8, border: '1px dashed #cbd5e1', background: 'transparent', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>
        I'd rather discuss this with the doctor →
      </button>
    );
  }

  function NextBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
    return (
      <button type="button" onClick={onClick} disabled={disabled}
        style={{ width: '100%', marginTop: 16, padding: '14px', borderRadius: 9, border: 'none', background: disabled ? '#e2e8f0' : TEAL, color: disabled ? '#94a3b8' : '#fff', fontSize: 15, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer' }}>
        {label}
      </button>
    );
  }

  function BackBtn() {
    return (
      <button type="button" onClick={goBack}
        style={{ background: 'none', border: 'none', color: TEAL, fontSize: 20, cursor: 'pointer', padding: 0, marginRight: 12 }} aria-label="Back">←</button>
    );
  }

  if (loading) return <div style={{ textAlign: 'center', paddingTop: 64, color: '#94a3b8', fontSize: 14 }}>Loading…</div>;

  // ── Screens ───────────────────────────────────────────────────────────────────

  if (step === 'done') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '40px 28px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800, color: '#1e293b' }}>Thank you!</h2>
          <p style={{ margin: '0 0 28px', fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
            Your pre-visit form has been submitted. Our team will review it before your consultation.
          </p>
          <button type="button" onClick={() => router.push('/patient')}
            style={{ padding: '13px 28px', background: TEAL, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            Back to portal
          </button>
        </div>
        {priorIntakes.length > 0 && (
          <div style={{ marginTop: 32, textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Previous submissions</p>
            {priorIntakes.map(i => (
              <div key={i.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px', marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(i.submitted_at).toLocaleDateString('en-LC', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>{i.chief_complaint ?? 'No complaint recorded'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (step === 'bailout') {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <button type="button" onClick={() => setStep(4)} style={{ background: 'none', border: 'none', color: TEAL, fontSize: 20, cursor: 'pointer', padding: 0, marginRight: 12 }}>←</button>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#1e293b' }}>Just book my appointment</h1>
        </div>
        <Block>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20, lineHeight: 1.6 }}>
            No problem. Leave your preferred contact details and we will reach out to schedule your visit.
          </p>
          <label style={qlabel}>Your name</label>
          <input style={input} value={bailName} onChange={e => setBailName(e.target.value)} placeholder="Full name" />
          <label style={{ ...qlabel, marginTop: 14 }}>Best phone number to reach you</label>
          <input style={input} value={bailPhone} onChange={e => setBailPhone(e.target.value)} placeholder="+1 758…" type="tel" />
        </Block>
        <button type="button" onClick={() => void handleBailout()} disabled={submitting || !bailName.trim()}
          style={{ width: '100%', padding: '14px', borderRadius: 9, border: 'none', background: !bailName.trim() ? '#e2e8f0' : TEAL, color: !bailName.trim() ? '#94a3b8' : '#fff', fontSize: 15, fontWeight: 700, cursor: !bailName.trim() ? 'not-allowed' : 'pointer' }}>
          {submitting ? 'Saving…' : 'Submit — we will contact you'}
        </button>
      </div>
    );
  }

  // ── Step 0 — Visit type ───────────────────────────────────────────────────────

  if (step === 0) {
    const visitCards = [
      { value: 'surgical',  label: 'Surgical Consultation', sub: 'Abdominal, hernia, lump, bowel, weight loss', icon: '🔪' },
      { value: 'endoscopy', label: 'Endoscopy / Scope',     sub: 'Colonoscopy, gastroscopy, heartburn, swallowing', icon: '🔬' },
      { value: 'followup',  label: 'Follow-up visit',       sub: 'Returning for results or post-op review', icon: '📋' },
      { value: 'unsure',    label: 'Not sure',              sub: 'Describe your concern and we will guide you', icon: '💬' },
    ];
    return (
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: '#1e293b', marginBottom: 4 }}>Pre-Visit Form</h1>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 28, lineHeight: 1.6 }}>
          Answer a few short questions so Dr Kabiye can prepare for your visit. You can stop at any time and just come in.
        </p>
        <ProgressDots step={0} />
        <p style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>Why are you coming in?</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visitCards.map(c => (
            <button key={c.value} type="button" onClick={() => handleVisitType(c.value as VisitType)}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 28, flexShrink: 0 }}>{c.icon}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{c.label}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{c.sub}</div>
              </div>
              <span style={{ marginLeft: 'auto', color: '#cbd5e1', fontSize: 18, flexShrink: 0 }}>›</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setStep('bailout')}
          style={{ width: '100%', marginTop: 16, padding: '12px', borderRadius: 8, border: '1px dashed #cbd5e1', background: 'transparent', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>
          Skip — I'd rather just come in →
        </button>
      </div>
    );
  }

  // ── Step 1 — Chief complaint ──────────────────────────────────────────────────

  if (step === 1) {
    // "Unsure" path — free text
    if (visitType === 'unsure') {
      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <BackBtn /><h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#1e293b' }}>Describe your concern</h1>
          </div>
          <ProgressDots step={1} />
          <Block>
            <label style={qlabel}>What is bothering you?</label>
            <span style={hint}>Describe it in your own words — as much or as little as you like.</span>
            <textarea style={textarea} rows={4} value={unsureText} onChange={e => setUnsureText(e.target.value)} placeholder="e.g. I've had pain in my stomach for a few months and two other doctors haven't found the cause…" />
          </Block>
          <NextBtn label="Continue →" onClick={() => setStep(4)} disabled={!unsureText.trim()} />
          <BailOutLink />
        </div>
      );
    }

    const complaints = complaintsForVisitType(visitType as VisitType);
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <BackBtn />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#1e293b' }}>
            {visitType === 'surgical' ? 'What is your main concern?' : 'What brings you in?'}
          </h1>
        </div>
        <ProgressDots step={1} />
        <Block>
          <ChoiceGrid options={complaints} selected={complaint} onSelect={handleComplaint} />
        </Block>
        {complaint === 'other' && (
          <Block>
            <label style={qlabel}>Please describe briefly</label>
            <textarea style={textarea} rows={3} value={unsureText} onChange={e => setUnsureText(e.target.value)} placeholder="Describe your main concern…" />
            <NextBtn label="Continue →" onClick={() => { setTrack('other'); setStep(3); }} disabled={!unsureText.trim()} />
          </Block>
        )}
        <BailOutLink />
      </div>
    );
  }

  // ── Step 2 — Location / specifics ────────────────────────────────────────────

  if (step === 2) {
    const step2 = getStep2Options(complaint);
    if (!step2) { setStep(3); return null; }
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <BackBtn /><h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#1e293b' }}>{step2.title}</h1>
        </div>
        <ProgressDots step={2} />
        {step2.hint && <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{step2.hint}</p>}
        <Block>
          <ChoiceGrid options={step2.options} selected={specifics} onSelect={handleSpecifics} />
        </Block>
        <BailOutLink />
      </div>
    );
  }

  // ── Step 3 — Targeted questions ───────────────────────────────────────────────

  if (step === 3) {
    const isGallbladder   = complaintTrack === 'gallbladder';
    const isGastric       = ['gastric','peptic-ulcer','stomach-pain'].includes(complaintTrack);
    const isRectalBleeding = ['rectal-bleeding','lower-gi-bleeding','endo-rectal-bleeding'].includes(complaintTrack) || complaint === 'rectal-bleeding';
    const isDysphagia     = ['mechanical-dysphagia','severe-dysphagia','odynophagia','swallowing'].includes(complaintTrack);
    const isHernia        = complaintTrack.includes('hernia');
    const isScreening     = complaintTrack.includes('screening') || complaintTrack === 'surveillance' || complaint === 'screening';
    const isWeightLoss    = complaint === 'weight-loss' || complaintTrack === 'weight-loss';
    const isAppendix      = complaintTrack === 'appendix';
    const isBowel         = ['diarrhoea','constipation','ibs-like','mass-effect','bowel-change'].includes(complaintTrack);
    const isFollowup      = visitType === 'followup';

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <BackBtn /><h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#1e293b' }}>A few more details</h1>
        </div>
        <ProgressDots step={3} />
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>These help Dr Kabiye prepare before you arrive.</p>

        {/* Severity — shown for pain-based tracks */}
        {!isFollowup && !isScreening && (
          <Block>
            <span style={qlabel}>How severe is your discomfort?</span>
            <span style={hint}>1 = very mild · 10 = worst imaginable</span>
            <SeverityPicker value={s3.severity ?? null} onChange={v => setS3Field('severity', v)} />
          </Block>
        )}

        {/* Duration */}
        {!isFollowup && (
          <Block>
            <label style={qlabel} htmlFor="dur">How long have you had this?</label>
            <select id="dur" style={sel} value={s3.durationDays ?? ''} onChange={e => setS3Field('durationDays', e.target.value)}>
              <option value="">Select…</option>
              <option value="1">Less than 1 week</option>
              <option value="7">1–2 weeks</option>
              <option value="14">2–4 weeks</option>
              <option value="30">1–3 months</option>
              <option value="90">3–6 months</option>
              <option value="180">More than 6 months</option>
            </select>
          </Block>
        )}

        {/* Gallbladder-specific */}
        {isGallbladder && (
          <>
            <Block>
              <span style={qlabel}>Is the pain worse after eating fatty or greasy food?</span>
              <YesNo value={s3.fattyFoodWorse ?? null} onChange={v => setS3Field('fattyFoodWorse', v)} />
            </Block>
            <Block>
              <span style={qlabel}>Does the pain spread to your back or right shoulder?</span>
              <YesNo value={s3.painRadiates ?? null} onChange={v => setS3Field('painRadiates', v)} />
            </Block>
            <Block>
              <span style={qlabel}>Have you had fever, chills, or shivering?</span>
              <YesNo value={s3.fever ?? null} onChange={v => setS3Field('fever', v)} />
            </Block>
            <Block>
              <span style={qlabel}>Have you noticed yellowing of your eyes or skin?</span>
              <YesNo value={s3.jaundice ?? null} onChange={v => setS3Field('jaundice', v)} />
            </Block>
          </>
        )}

        {/* Appendix-specific */}
        {isAppendix && (
          <>
            <Block>
              <span style={qlabel}>Have you had fever, chills, or shivering?</span>
              <YesNo value={s3.fever ?? null} onChange={v => setS3Field('fever', v)} />
            </Block>
            <Block>
              <span style={qlabel}>Have you had any nausea or vomiting?</span>
              <YesNo value={s3.blackBlood ?? null} onChange={v => setS3Field('blackBlood', v)} />
            </Block>
          </>
        )}

        {/* Gastric / ulcer */}
        {isGastric && (
          <>
            <Block>
              <span style={qlabel}>Is the pain a burning feeling when your stomach is empty or before meals?</span>
              <YesNo value={s3.burningHungry ?? null} onChange={v => setS3Field('burningHungry', v)} />
            </Block>
            <Block>
              <span style={qlabel}>Does it wake you at night?</span>
              <YesNo value={s3.wakesAtNight ?? null} onChange={v => setS3Field('wakesAtNight', v)} />
            </Block>
            <Block>
              <span style={qlabel}>Have you noticed blood in your vomit or black / tarry stools?</span>
              <YesNo value={s3.blackBlood ?? null} onChange={v => setS3Field('blackBlood', v)} />
            </Block>
            <Block>
              <span style={qlabel}>Do you regularly take aspirin, ibuprofen, or other anti-inflammatory tablets?</span>
              <YesNo value={s3.nsaids ?? null} onChange={v => setS3Field('nsaids', v)} />
            </Block>
          </>
        )}

        {/* Rectal bleeding */}
        {isRectalBleeding && (
          <>
            <Block>
              <span style={qlabel}>What colour is the blood?</span>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                {[{ v: 'bright', l: 'Bright red' }, { v: 'dark', l: 'Dark / black / tarry' }].map(({ v, l }) => (
                  <button key={v} type="button" onClick={() => setS3Field('bloodColour', v as 'bright' | 'dark')}
                    style={{ flex: 1, padding: '11px', borderRadius: 8, border: s3.bloodColour === v ? `2px solid ${TEAL}` : '1px solid #e2e8f0', background: s3.bloodColour === v ? `${TEAL}15` : '#fff', color: s3.bloodColour === v ? TEAL : '#64748b', fontSize: 14, fontWeight: s3.bloodColour === v ? 700 : 400, cursor: 'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
            </Block>
            <Block>
              <span style={qlabel}>Have your bowel habits changed recently?</span>
              <YesNo value={s3.bowelChange ?? null} onChange={v => setS3Field('bowelChange', v)} />
            </Block>
            <Block>
              <span style={qlabel}>Does anyone in your family have a history of bowel or colon cancer?</span>
              <YesNo value={s3.familyHistoryCancer ?? null} onChange={v => setS3Field('familyHistoryCancer', v)} />
            </Block>
          </>
        )}

        {/* Dysphagia */}
        {isDysphagia && (
          <>
            <Block>
              <span style={qlabel}>Are you losing weight because eating has become difficult?</span>
              <YesNo value={s3.weightLossDue ?? null} onChange={v => setS3Field('weightLossDue', v)} />
            </Block>
            <Block>
              <span style={qlabel}>Do you sometimes regurgitate undigested food?</span>
              <YesNo value={s3.regurgitation ?? null} onChange={v => setS3Field('regurgitation', v)} />
            </Block>
          </>
        )}

        {/* Hernia */}
        {isHernia && (
          <>
            <Block>
              <span style={qlabel}>Can you push the hernia back in?</span>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {[{ v: 'yes', l: 'Yes' }, { v: 'sometimes', l: 'Sometimes' }, { v: 'no', l: 'No' }].map(({ v, l }) => (
                  <button key={v} type="button" onClick={() => setS3Field('reducible', v as 'yes' | 'no' | 'sometimes')}
                    style={{ flex: 1, padding: '11px', borderRadius: 8, border: s3.reducible === v ? `2px solid ${TEAL}` : '1px solid #e2e8f0', background: s3.reducible === v ? `${TEAL}15` : '#fff', color: s3.reducible === v ? TEAL : '#64748b', fontSize: 14, fontWeight: s3.reducible === v ? 700 : 400, cursor: 'pointer' }}>
                    {l}
                  </button>
                ))}
              </div>
            </Block>
            <Block>
              <span style={qlabel}>Has it ever been stuck out and you could not push it back in?</span>
              <YesNo value={s3.stuck ?? null} onChange={v => setS3Field('stuck', v)} />
            </Block>
          </>
        )}

        {/* Screening */}
        {isScreening && (
          <>
            <Block>
              <span style={qlabel}>Does anyone in your family have a history of colon cancer or polyps?</span>
              <YesNo value={s3.familyHistoryColon ?? null} onChange={v => setS3Field('familyHistoryColon', v)} />
            </Block>
          </>
        )}

        {/* Weight loss */}
        {isWeightLoss && (
          <>
            <Block>
              <span style={qlabel}>Have you also had a change in your appetite?</span>
              <YesNo value={s3.burningHungry ?? null} onChange={v => setS3Field('burningHungry', v)} />
            </Block>
            <Block>
              <span style={qlabel}>Have you noticed any bowel changes alongside the weight loss?</span>
              <YesNo value={s3.bowelChange ?? null} onChange={v => setS3Field('bowelChange', v)} />
            </Block>
          </>
        )}

        {/* Bowel habit change */}
        {isBowel && !isRectalBleeding && (
          <>
            <Block>
              <span style={qlabel}>Have you noticed any blood in your stool?</span>
              <YesNo value={s3.blackBlood ?? null} onChange={v => setS3Field('blackBlood', v)} />
            </Block>
            <Block>
              <span style={qlabel}>Does anyone in your family have a history of bowel cancer?</span>
              <YesNo value={s3.familyHistoryCancer ?? null} onChange={v => setS3Field('familyHistoryCancer', v)} />
            </Block>
          </>
        )}

        <NextBtn label="Continue →" onClick={() => setStep(4)} />
        <BailOutLink />
      </div>
    );
  }

  // ── Step 4 — Universal ────────────────────────────────────────────────────────

  if (step === 4) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          {visitType !== 'followup' && <BackBtn />}
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#1e293b' }}>Almost done</h1>
        </div>
        <ProgressDots step={4} />
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Last section — all fields optional.</p>

        <Block>
          <label style={qlabel} htmlFor="meds">Current medications</label>
          <span style={hint}>List any tablets, injections, or supplements you are currently taking.</span>
          <textarea id="meds" style={textarea} rows={2} value={currentMeds} onChange={e => setCurrentMeds(e.target.value)} placeholder="e.g. metformin 500mg, lisinopril…" />
        </Block>

        <Block>
          <label style={qlabel} htmlFor="allergy">Known allergies</label>
          <input id="allergy" style={input} value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="e.g. penicillin, ibuprofen, latex, none known" />
        </Block>

        <Block>
          <span style={qlabel}>Were you referred by another doctor?</span>
          <YesNo value={isReferral} onChange={setIsReferral} />
          {isReferral === true && (
            <div style={{ marginTop: 12 }}>
              <label style={{ ...qlabel, fontSize: 13 }}>Referring doctor or facility</label>
              <input style={input} value={referralDoc} onChange={e => setReferralDoc(e.target.value)} placeholder="e.g. Dr. Pierre, Victoria Hospital" />
            </div>
          )}
        </Block>

        <Block>
          <label style={qlabel} htmlFor="extra">Anything else you would like the team to know?</label>
          <textarea id="extra" style={textarea} rows={2} value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)} placeholder="Optional — any additional context that may help us prepare for your visit." />
        </Block>

        <button type="button" onClick={() => void handleSubmit()} disabled={submitting}
          style={{ width: '100%', padding: '15px', background: submitting ? '#99f6e4' : TEAL, color: submitting ? '#0f766e' : '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: submitting ? 'default' : 'pointer' }}>
          {submitting ? 'Submitting…' : 'Submit pre-visit form ✓'}
        </button>

        <button type="button" onClick={() => setStep('bailout')}
          style={{ width: '100%', marginTop: 10, padding: '12px', borderRadius: 8, border: '1px dashed #cbd5e1', background: 'transparent', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>
          I'd rather just come in →
        </button>
      </div>
    );
  }

  return null;
}
