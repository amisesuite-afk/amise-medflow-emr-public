import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

// ─── ASA ─────────────────────────────────────────────────────────────────────

const ASA_GRADES = [
  { grade: 'I',   color: '#16a34a', description: 'Normal healthy patient. No organic, physiologic, or psychiatric disturbance.' },
  { grade: 'II',  color: '#65a30d', description: 'Patient with mild systemic disease — well-controlled DM, mild hypertension, obesity (BMI < 35), social smoking, pregnancy.' },
  { grade: 'III', color: '#d97706', description: 'Patient with severe systemic disease — poorly controlled DM or HTN, COPD, morbid obesity (BMI ≥ 40), active hepatitis, alcohol dependence, implanted pacemaker, moderate reduction in EF, ESRD on dialysis, history (>3 months) of MI, CVA, TIA.' },
  { grade: 'IV',  color: '#dc2626', description: 'Patient with severe systemic disease that is a constant threat to life — recent (< 3 months) MI, CVA, TIA, ongoing cardiac ischaemia, severe valve dysfunction, sepsis, DIC, ARD.' },
  { grade: 'V',   color: '#7f1d1d', description: 'Moribund patient not expected to survive without the operation — ruptured abdominal/thoracic aneurysm, massive trauma, intracranial bleed with mass effect, ischaemic bowel with cardiac pathology.' },
  { grade: 'VI',  color: '#0f172a', description: 'Brain-dead patient for organ donation.' },
];

// ─── RCRI ─────────────────────────────────────────────────────────────────────

const RCRI_FACTORS = [
  { id: 'high_risk_surgery',   label: 'High-risk surgery',                 detail: 'Intraperitoneal, intrathoracic, or suprainguinal vascular' },
  { id: 'ihd',                 label: 'Ischaemic heart disease',           detail: 'History of MI, positive stress test, use of nitrates, current chest pain from IHD, ECG with Q waves' },
  { id: 'chf',                 label: 'Congestive heart failure',          detail: 'History of pulmonary oedema, PND, bilateral rales, S3 gallop, CXR with pulmonary vascular redistribution' },
  { id: 'cvd',                 label: 'Cerebrovascular disease',           detail: 'History of TIA or stroke' },
  { id: 'insulin_dm',          label: 'Insulin-dependent diabetes',        detail: 'Pre-operative insulin use' },
  { id: 'creatinine',          label: 'Pre-op creatinine > 177 μmol/L',   detail: 'Serum creatinine > 2.0 mg/dL' },
];

const RCRI_RISK: Record<number, { pct: string; level: string; color: string; recommendation: string }> = {
  0: { pct: '0.4%',  level: 'Very low', color: '#16a34a', recommendation: 'Standard perioperative monitoring. No additional cardiac workup required.' },
  1: { pct: '1.0%',  level: 'Low',      color: '#65a30d', recommendation: 'Proceed with surgery. Consider beta-blockade if already on it — do not start de novo.' },
  2: { pct: '2.4%',  level: 'Moderate', color: '#d97706', recommendation: 'Consider non-invasive cardiac testing if it will change management. Ensure beta-blockade continued. Discuss risk with patient.' },
};

function rcriRisk(score: number) {
  if (score <= 2) return RCRI_RISK[score];
  return { pct: '5.4%', level: 'High', color: '#dc2626', recommendation: 'Non-invasive cardiac testing recommended. Consider cardiology review. May require pre-op revascularisation if significant ischaemia found.' };
}

// ─── CAPRINI ─────────────────────────────────────────────────────────────────

const CAPRINI_1: Array<{ id: string; label: string }> = [
  { id: 'minor_surgery',        label: 'Minor surgery planned' },
  { id: 'medical_patient',      label: 'Medical patient at bed rest' },
  { id: 'varicose_veins',       label: 'Varicose veins' },
  { id: 'ibd',                  label: 'Inflammatory bowel disease' },
  { id: 'oedema',               label: 'Swelling of legs (current)' },
  { id: 'obesity',              label: 'Obesity (BMI > 25)' },
  { id: 'ami',                  label: 'Acute myocardial infarction' },
  { id: 'chf_cap',              label: 'Congestive heart failure (<1 month)' },
  { id: 'sepsis',               label: 'Sepsis (<1 month)' },
  { id: 'lung_disease',         label: 'Serious lung disease incl. pneumonia (<1 month)' },
  { id: 'oral_contraceptive',   label: 'Oral contraceptives / HRT' },
  { id: 'pregnancy',            label: 'Pregnancy or postpartum (<1 month)' },
  { id: 'unexplained_stillbirth', label: 'Unexplained or recurrent spontaneous abortion' },
  { id: 'age_41_60',            label: 'Age 41–60' },
];

const CAPRINI_2: Array<{ id: string; label: string }> = [
  { id: 'major_surgery',        label: 'Major open surgery (>45 min)' },
  { id: 'laparoscopic',         label: 'Laparoscopic surgery (>45 min)' },
  { id: 'arthroscopic',         label: 'Arthroscopic surgery' },
  { id: 'malignancy',           label: 'Malignancy (present or previous)' },
  { id: 'bed_rest_72h',         label: 'Confined to bed >72 hours' },
  { id: 'immobilising_cast',    label: 'Immobilising cast (<1 month)' },
  { id: 'central_line',         label: 'Central venous access' },
  { id: 'age_61_74',            label: 'Age 61–74' },
];

const CAPRINI_3: Array<{ id: string; label: string }> = [
  { id: 'age_over_75',          label: 'Age ≥75' },
  { id: 'hx_dvt_pe',           label: 'Personal history of DVT/PE' },
  { id: 'family_hx_thrombosis', label: 'Family history of thrombosis' },
  { id: 'positive_factor_v',   label: 'Positive factor V Leiden' },
  { id: 'positive_prothrombin', label: 'Positive prothrombin 20210A' },
  { id: 'elevated_homocysteine', label: 'Elevated serum homocysteine' },
  { id: 'heparin_hit',         label: 'Heparin-induced thrombocytopenia (HIT)' },
  { id: 'lupus_anticoag',      label: 'Elevated lupus anticoagulant' },
  { id: 'anticardiolipin',     label: 'Elevated anticardiolipin antibody' },
  { id: 'antithrombin_def',    label: 'Antithrombin III deficiency' },
  { id: 'protein_c_def',       label: 'Protein C deficiency' },
  { id: 'protein_s_def',       label: 'Protein S deficiency' },
];

const CAPRINI_5: Array<{ id: string; label: string }> = [
  { id: 'elective_hip_knee',   label: 'Elective major lower extremity arthroplasty' },
  { id: 'hip_pelvis_fx',       label: 'Hip, pelvis, or leg fracture (<1 month)' },
  { id: 'stroke',              label: 'Stroke (<1 month)' },
  { id: 'multiple_trauma',     label: 'Multiple trauma (<1 month)' },
  { id: 'acute_spinal',        label: 'Acute spinal cord injury (<1 month)' },
];

function capriniRisk(score: number): { level: string; pct: string; color: string; recommendation: string } {
  if (score === 0)    return { level: 'Very low',  pct: '<0.5%', color: '#16a34a', recommendation: 'Early ambulation only. No pharmacological prophylaxis required.' };
  if (score <= 2)     return { level: 'Low',       pct: '1.5%',  color: '#65a30d', recommendation: 'Mechanical prophylaxis (IPC / TED stockings). Consider LMWH for immobile patients.' };
  if (score <= 4)     return { level: 'Moderate',  pct: '3.0%',  color: '#d97706', recommendation: 'LMWH (e.g. enoxaparin 40mg SC od) + mechanical prophylaxis. Continue 7–10 days.' };
  return                     { level: 'High',      pct: '6.0%',  color: '#dc2626', recommendation: 'LMWH extended to 28 days post-discharge + mechanical prophylaxis. Consider IVC filter if anticoagulation contraindicated.' };
}

// ─── P-POSSUM ────────────────────────────────────────────────────────────────

interface PossumPhysiol {
  age: string; cardiacSigns: string; respHistory: string; ecg: string;
  sbp: string; pulse: string; gcs: string; hb: string; wbc: string;
  urea: string; sodium: string; potassium: string;
}
interface PossumOp {
  severity: string; multiple: string; bloodLoss: string;
  soiling: string; malignancy: string; mode: string;
}

const PHYSIOL_SCORES: Record<keyof PossumPhysiol, Array<{ label: string; score: number }>> = {
  age:          [{ label: '< 60', score: 1 }, { label: '61–70', score: 2 }, { label: '>70', score: 4 }],
  cardiacSigns: [{ label: 'None', score: 1 }, { label: 'Diuretics / antihypertensives', score: 2 }, { label: 'Peripheral oedema / warfarin / borderline cardiomegaly', score: 4 }, { label: 'Raised JVP / cardiomegaly on CXR', score: 8 }],
  respHistory:  [{ label: 'None', score: 1 }, { label: 'Dyspnoea on exertion / mild COAD', score: 2 }, { label: 'Limiting dyspnoea / moderate COAD', score: 4 }, { label: 'Dyspnoea at rest / severe COAD / fibrosing alveolitis', score: 8 }],
  ecg:          [{ label: 'Normal', score: 1 }, { label: 'AF rate 60–90', score: 2 }, { label: 'Q waves / ST changes', score: 4 }, { label: 'Any other abnormality', score: 8 }],
  sbp:          [{ label: '110–130 mmHg', score: 1 }, { label: '131–170 or 100–109', score: 2 }, { label: '≥171 or 90–99', score: 4 }, { label: '<90', score: 8 }],
  pulse:        [{ label: '50–80 bpm', score: 1 }, { label: '81–100 or 40–49', score: 2 }, { label: '101–120', score: 4 }, { label: '≥121 or <40', score: 8 }],
  gcs:          [{ label: '15', score: 1 }, { label: '12–14', score: 2 }, { label: '9–11', score: 4 }, { label: '<9', score: 8 }],
  hb:           [{ label: '13–16 g/dL (M) / 11.5–13.5 (F)', score: 1 }, { label: '10–12.9 or 16.1–17', score: 2 }, { label: '8–9.9 or 17.1–18', score: 4 }, { label: '<8 or >18', score: 8 }],
  wbc:          [{ label: '4–10 ×10⁹/L', score: 1 }, { label: '10.1–20 or 3.1–3.9', score: 2 }, { label: '>20 or ≤3', score: 4 }],
  urea:         [{ label: '≤7.5 mmol/L', score: 1 }, { label: '7.6–10', score: 2 }, { label: '10.1–15', score: 4 }, { label: '>15', score: 8 }],
  sodium:       [{ label: '≥136 mmol/L', score: 1 }, { label: '131–135', score: 2 }, { label: '126–130', score: 4 }, { label: '≤125', score: 8 }],
  potassium:    [{ label: '3.5–5.0 mmol/L', score: 1 }, { label: '3.2–3.4 or 5.1–5.3', score: 2 }, { label: '2.9–3.1 or 5.4–5.9', score: 4 }, { label: '<2.9 or ≥6.0', score: 8 }],
};

const OP_SCORES: Record<keyof PossumOp, Array<{ label: string; score: number }>> = {
  severity:   [{ label: 'Minor (skin biopsy, drain removal)', score: 1 }, { label: 'Moderate (hernia, appendicectomy)', score: 2 }, { label: 'Major (cholecystectomy, colon resection)', score: 4 }, { label: 'Major+ complex (oesophagectomy, Whipple, AAA)', score: 8 }],
  multiple:   [{ label: '1 procedure', score: 1 }, { label: '2 procedures', score: 4 }, { label: '>2 procedures', score: 8 }],
  bloodLoss:  [{ label: '<100 mL', score: 1 }, { label: '101–500 mL', score: 2 }, { label: '501–999 mL', score: 4 }, { label: '≥1000 mL', score: 8 }],
  soiling:    [{ label: 'None', score: 1 }, { label: 'Serous fluid', score: 2 }, { label: 'Localised pus', score: 4 }, { label: 'Free bowel content / pus / blood', score: 8 }],
  malignancy: [{ label: 'None', score: 1 }, { label: 'Primary only', score: 2 }, { label: 'Nodal metastases', score: 4 }, { label: 'Distant metastases', score: 8 }],
  mode:       [{ label: 'Elective', score: 1 }, { label: 'Emergency with resuscitation possible (>2h)', score: 4 }, { label: 'Emergency — immediate surgery', score: 8 }],
};

const PHYSIOL_LABELS: Record<keyof PossumPhysiol, string> = {
  age: 'Age', cardiacSigns: 'Cardiac signs', respHistory: 'Respiratory history', ecg: 'ECG',
  sbp: 'Systolic BP', pulse: 'Pulse rate', gcs: 'GCS', hb: 'Haemoglobin',
  wbc: 'White cells', urea: 'Urea', sodium: 'Sodium', potassium: 'Potassium',
};

const OP_LABELS: Record<keyof PossumOp, string> = {
  severity: 'Operative severity', multiple: 'Multiple procedures', bloodLoss: 'Total blood loss',
  soiling: 'Peritoneal soiling', malignancy: 'Malignancy', mode: 'Mode of surgery',
};

function calcPossum(ps: number, os: number) {
  const morbR = 1 / (1 + Math.exp(-(-5.91 + 0.16 * ps + 0.19 * os)));
  const mortR = 1 / (1 + Math.exp(-(-7.04 + 0.13 * ps + 0.16 * os)));
  return {
    morbidity: (morbR * 100).toFixed(1),
    mortality: (mortR * 100).toFixed(1),
  };
}

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = 'asa' | 'rcri' | 'caprini' | 'possum';

export default function PreopRiskScoringCard() {
  const { comorbidities, vitals, age } = useAppContext();
  const [tab, setTab] = useState<Tab>('asa');

  // ASA
  const [asaGrade, setAsaGrade] = useState<string>('');

  // RCRI — auto-prefill from comorbidities
  const autoRcri = useMemo(() => {
    const set = new Set(comorbidities.map(c => c.toLowerCase()));
    return {
      ihd: set.has('ischaemic heart disease') || set.has('ihd'),
      chf: set.has('heart failure'),
      cvd: set.has('stroke / tia'),
      insulin_dm: set.has('type 1 diabetes'),
      creatinine: set.has('dialysis') || set.has('chronic kidney disease'),
    };
  }, [comorbidities]);

  const [rcriFactors, setRcriFactors] = useState<Record<string, boolean>>({});
  const effectiveRcri = (id: string) => id in rcriFactors ? rcriFactors[id] : !!(autoRcri as Record<string, boolean>)[id];
  const rcriScore = RCRI_FACTORS.filter(f => effectiveRcri(f.id)).length;
  const rcriResult = rcriRisk(rcriScore);

  // Caprini
  const [caprini, setCaprini] = useState<Record<string, boolean>>({});
  const capriniScore = useMemo(() => {
    let s = 0;
    for (const f of CAPRINI_1) if (caprini[f.id]) s += 1;
    for (const f of CAPRINI_2) if (caprini[f.id]) s += 2;
    for (const f of CAPRINI_3) if (caprini[f.id]) s += 3;
    for (const f of CAPRINI_5) if (caprini[f.id]) s += 5;
    return s;
  }, [caprini]);
  const capriniResult = capriniRisk(capriniScore);

  // P-POSSUM
  const [physiol, setPhysiol] = useState<PossumPhysiol>({
    age: '', cardiacSigns: '', respHistory: '', ecg: '', sbp: '', pulse: '',
    gcs: '', hb: '', wbc: '', urea: '', sodium: '', potassium: '',
  });
  const [op, setOp] = useState<PossumOp>({
    severity: '', multiple: '', bloodLoss: '', soiling: '', malignancy: '', mode: '',
  });

  const physiolScore = useMemo(() =>
    Object.values(physiol).reduce((s, v) => s + (parseInt(v) || 0), 0), [physiol]);
  const opScore = useMemo(() =>
    Object.values(op).reduce((s, v) => s + (parseInt(v) || 0), 0), [op]);
  const possumReady = physiolScore > 0 && opScore > 0;
  const possum = possumReady ? calcPossum(physiolScore, opScore) : null;

  // Badge summary
  const summaryBadge = asaGrade || (rcriScore > 0 ? `RCRI ${rcriScore}` : undefined);

  const TAB_ITEMS: Array<{ id: Tab; label: string }> = [
    { id: 'asa',     label: 'ASA' },
    { id: 'rcri',    label: 'RCRI' },
    { id: 'caprini', label: 'VTE (Caprini)' },
    { id: 'possum',  label: 'P-POSSUM' },
  ];

  return (
    <CollapsibleCard title="Pre-operative risk scoring" badge={summaryBadge} defaultOpen={false}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
        {TAB_ITEMS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            style={{
              padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: '1px solid', transition: 'all 0.15s',
              borderColor: tab === t.id ? '#0f172a' : '#e2e8f0',
              background: tab === t.id ? '#0f172a' : '#fff',
              color: tab === t.id ? '#fff' : '#374151',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── ASA ── */}
      {tab === 'asa' && (
        <div>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
            ASA Physical Status Classification. Select the grade that best describes this patient.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ASA_GRADES.map(g => (
              <button key={g.grade} type="button"
                onClick={() => setAsaGrade(asaGrade === `ASA ${g.grade}` ? '' : `ASA ${g.grade}`)}
                style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start', textAlign: 'left',
                  padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                  border: `2px solid ${asaGrade === `ASA ${g.grade}` ? g.color : '#e2e8f0'}`,
                  background: asaGrade === `ASA ${g.grade}` ? `${g.color}12` : '#fff',
                }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: g.color, minWidth: 30 }}>
                  {g.grade}
                </span>
                <span style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{g.description}</span>
              </button>
            ))}
          </div>
          {asaGrade && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: '#f0fdf4', borderRadius: 6, fontSize: 12, color: '#15803d', fontWeight: 600 }}>
              Selected: {asaGrade} — document in operative consent and anaesthetic assessment.
            </div>
          )}
        </div>
      )}

      {/* ── RCRI ── */}
      {tab === 'rcri' && (
        <div>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
            Revised Cardiac Risk Index — estimates major adverse cardiac events (MACE) risk in non-cardiac surgery.
            Auto-prefilled from PMH where possible.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {RCRI_FACTORS.map(f => (
              <label key={f.id}
                style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer',
                  padding: '8px 10px', borderRadius: 7,
                  background: effectiveRcri(f.id) ? '#fff7ed' : '#f8fafc',
                  border: `1px solid ${effectiveRcri(f.id) ? '#fdba74' : '#e2e8f0'}`,
                }}>
                <input type="checkbox"
                  checked={effectiveRcri(f.id)}
                  onChange={e => setRcriFactors(prev => ({ ...prev, [f.id]: e.target.checked }))}
                  style={{ marginTop: 2 }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#1e293b' }}>{f.label}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{f.detail}</div>
                </div>
              </label>
            ))}
          </div>
          <div style={{
            marginTop: 14, padding: '12px 14px', borderRadius: 8,
            background: `${rcriResult.color}12`,
            border: `1px solid ${rcriResult.color}44`,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
              <span style={{ fontWeight: 800, fontSize: 20, color: rcriResult.color }}>{rcriScore}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: rcriResult.color }}>{rcriResult.level} risk — {rcriResult.pct} MACE</span>
            </div>
            <div style={{ fontSize: 12, color: '#374151' }}>{rcriResult.recommendation}</div>
          </div>
        </div>
      )}

      {/* ── CAPRINI ── */}
      {tab === 'caprini' && (
        <div>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
            Caprini VTE Risk Assessment Model. Tick all that apply. Score drives prophylaxis recommendation.
          </p>
          {([
            { points: 1, factors: CAPRINI_1 },
            { points: 2, factors: CAPRINI_2 },
            { points: 3, factors: CAPRINI_3 },
            { points: 5, factors: CAPRINI_5 },
          ] as const).map(({ points, factors }) => (
            <div key={points} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                {points} point{points > 1 ? 's' : ''} each
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {factors.map(f => {
                  const sel = !!caprini[f.id];
                  return (
                    <button key={f.id} type="button"
                      onClick={() => setCaprini(prev => ({ ...prev, [f.id]: !prev[f.id] }))}
                      style={{
                        padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                        border: `1px solid ${sel ? '#3b82f6' : '#d1d5db'}`,
                        background: sel ? '#eff6ff' : '#fff',
                        color: sel ? '#1d4ed8' : '#374151',
                        fontWeight: sel ? 600 : 400,
                      }}>
                      {sel && '✓ '}{f.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div style={{
            marginTop: 14, padding: '12px 14px', borderRadius: 8,
            background: `${capriniResult.color}12`,
            border: `1px solid ${capriniResult.color}44`,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
              <span style={{ fontWeight: 800, fontSize: 20, color: capriniResult.color }}>Score: {capriniScore}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: capriniResult.color }}>{capriniResult.level} — ~{capriniResult.pct} VTE risk</span>
            </div>
            <div style={{ fontSize: 12, color: '#374151' }}>{capriniResult.recommendation}</div>
          </div>
        </div>
      )}

      {/* ── P-POSSUM ── */}
      {tab === 'possum' && (
        <div>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
            Portsmouth P-POSSUM: predicts 30-day morbidity and mortality using 12 physiological + 6 operative variables.
            Useful for consenting patients and allocating post-op level of care.
          </p>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748b', marginBottom: 8 }}>
            Physiological score (current score: {physiolScore})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
            {(Object.keys(PHYSIOL_SCORES) as Array<keyof PossumPhysiol>).map(key => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, minWidth: 140, color: '#374151', fontWeight: 500 }}>{PHYSIOL_LABELS[key]}</span>
                <select
                  value={physiol[key]}
                  onChange={e => setPhysiol(prev => ({ ...prev, [key]: e.target.value }))}
                  style={{ flex: 1, fontSize: 11, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 5 }}>
                  <option value="">— select —</option>
                  {PHYSIOL_SCORES[key].map(o => (
                    <option key={o.score} value={o.score}>{o.label} ({o.score}pt)</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748b', marginBottom: 8 }}>
            Operative severity score (current score: {opScore})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
            {(Object.keys(OP_SCORES) as Array<keyof PossumOp>).map(key => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, minWidth: 140, color: '#374151', fontWeight: 500 }}>{OP_LABELS[key]}</span>
                <select
                  value={op[key]}
                  onChange={e => setOp(prev => ({ ...prev, [key]: e.target.value }))}
                  style={{ flex: 1, fontSize: 11, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 5 }}>
                  <option value="">— select —</option>
                  {OP_SCORES[key].map(o => (
                    <option key={o.score} value={o.score}>{o.label} ({o.score}pt)</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {possum ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ padding: '12px 14px', borderRadius: 8, background: parseFloat(possum.morbidity) > 30 ? '#fef2f2' : '#fffbeb', border: `1px solid ${parseFloat(possum.morbidity) > 30 ? '#fca5a5' : '#fde68a'}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Predicted morbidity</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: parseFloat(possum.morbidity) > 30 ? '#dc2626' : '#d97706' }}>{possum.morbidity}%</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>30-day major complications</div>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: 8, background: parseFloat(possum.mortality) > 5 ? '#fef2f2' : '#f0fdf4', border: `1px solid ${parseFloat(possum.mortality) > 5 ? '#fca5a5' : '#bbf7d0'}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Predicted mortality</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: parseFloat(possum.mortality) > 5 ? '#dc2626' : '#15803d' }}>{possum.mortality}%</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>30-day mortality</div>
              </div>
              <div style={{ gridColumn: '1/-1', fontSize: 11, color: '#6b7280', padding: '6px 10px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                P-POSSUM: physiological {physiolScore} + operative {opScore}. Use alongside clinical judgment — models predict population risk, not individual outcome.
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: 16 }}>
              Complete physiological and operative scores above to see prediction.
            </div>
          )}
        </div>
      )}

      {/* Summary footer */}
      {(asaGrade || rcriScore > 0 || capriniScore > 0 || possum) && (
        <div style={{ marginTop: 16, padding: '10px 12px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 12, color: '#374151' }}>
          <span style={{ fontWeight: 700, marginRight: 10 }}>Risk summary:</span>
          {asaGrade && <span style={{ marginRight: 12 }}>{asaGrade}</span>}
          {rcriScore > 0 && <span style={{ marginRight: 12 }}>RCRI {rcriScore} ({rcriResult.pct} MACE)</span>}
          {capriniScore > 0 && <span style={{ marginRight: 12 }}>Caprini {capriniScore} ({capriniResult.level} VTE)</span>}
          {possum && <span>P-POSSUM: morbidity {possum.morbidity}%, mortality {possum.mortality}%</span>}
        </div>
      )}
    </CollapsibleCard>
  );
}
