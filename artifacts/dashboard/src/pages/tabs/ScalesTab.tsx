import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import {
  alvaradoScore, interpretAlvarado, type AlvaradoInputs,
  heartScore,    interpretHeart,    type HeartInputs,
  wellsPeScore,  interpretWellsPe,  type WellsPeInputs,
  abcd2Score,    interpretAbcd2,    type Abcd2Inputs,
  tg18CholangitisGrade, interpretTg18Cholangitis, type Tg18CholangitisInputs,
  asgeCbdProbability,   interpretAsgeCbd,          type AsgeCbdInputs,
  type ScaleResult,
} from '@/lib/clinical-scales';

function ResultBadge({ result }: { result: ScaleResult }) {
  return (
    <div className={`scale-result scale-result--${result.color}`}>
      <div className="scale-result__band">{result.band}</div>
      <div className="scale-result__desc">{result.description}</div>
      <div className="scale-result__action">→ {result.action}</div>
      <div className="scale-result__evidence">{result.evidence}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange, sub }: {
  label: string; checked: boolean; onChange(v: boolean): void; sub?: string;
}) {
  return (
    <label className="scale-toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="scale-toggle__label">{label}</span>
      {sub && <span className="scale-toggle__sub">{sub}</span>}
    </label>
  );
}

function NumInput({ label, value, onChange, unit, min, max, placeholder }: {
  label: string; value: string; onChange(v: string): void;
  unit?: string; min?: number; max?: number; placeholder?: string;
}) {
  return (
    <div className="scale-field">
      <label className="scale-field__label">{label}{unit && <span className="scale-field__unit">{unit}</span>}</label>
      <input
        className="scale-field__input"
        type="number"
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        min={min}
        max={max}
        placeholder={placeholder ?? '—'}
      />
    </div>
  );
}

function SelectInput({ label, value, onChange, options }: {
  label: string; value: string; onChange(v: string): void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="scale-field">
      <label className="scale-field__label">{label}</label>
      <select className="scale-field__input" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Alvarado ────────────────────────────────────────────────────────────────

function AlvaradoCard() {
  const { symptoms, vitals } = useAppContext();
  const autoFever = vitals.temperatureC ? parseFloat(vitals.temperatureC) > 37.3 : false;

  const [inputs, setInputs] = useState<AlvaradoInputs>({
    migratoryPain: false,
    anorexia: symptoms.includes('anorexia'),
    nausea: symptoms.includes('vomiting') || symptoms.includes('nausea'),
    rifTenderness: false,
    rebound: false,
    fever: autoFever,
    wbcAbove10: false,
    leftShift: false,
  });

  const upd = (k: keyof AlvaradoInputs) => (v: boolean) =>
    setInputs(c => ({ ...c, [k]: v }));

  const score = useMemo(() => alvaradoScore(inputs), [inputs]);
  const result = useMemo(() => interpretAlvarado(score), [score]);

  return (
    <CollapsibleCard
      title="Alvarado Score — Appendicitis"
      badge={score > 0 ? String(score) + ' / 10' : undefined}
      badgeVariant={result.color === 'red' ? 'danger' : result.color === 'amber' ? 'warn' : 'default'}
    >
      <div className="scale-grid">
        <Toggle label="Migratory pain to RIF" checked={inputs.migratoryPain} onChange={upd('migratoryPain')} sub="1 pt" />
        <Toggle label="Anorexia" checked={inputs.anorexia} onChange={upd('anorexia')} sub="1 pt" />
        <Toggle label="Nausea / vomiting" checked={inputs.nausea} onChange={upd('nausea')} sub="1 pt" />
        <Toggle label="RIF tenderness" checked={inputs.rifTenderness} onChange={upd('rifTenderness')} sub="2 pts" />
        <Toggle label="Rebound tenderness" checked={inputs.rebound} onChange={upd('rebound')} sub="1 pt" />
        <Toggle label={`Fever > 37.3°C${autoFever ? ' ✓ auto' : ''}`} checked={inputs.fever} onChange={upd('fever')} sub="1 pt" />
        <Toggle label="WBC > 10,000" checked={inputs.wbcAbove10} onChange={upd('wbcAbove10')} sub="2 pts (lab required)" />
        <Toggle label="Neutrophilia / left shift" checked={inputs.leftShift} onChange={upd('leftShift')} sub="1 pt (lab required)" />
      </div>
      <ResultBadge result={result} />
    </CollapsibleCard>
  );
}

// ─── HEART Score ─────────────────────────────────────────────────────────────

function HeartCard() {
  const { age } = useAppContext();
  const ageNum = age ? parseInt(age) : null;

  const [historyScore, setHistoryScore] = useState('0');
  const [ecgScore, setEcgScore] = useState('0');
  const [rfScore, setRfScore] = useState('0');
  const [tropoScore, setTropoScore] = useState('0');

  const inputs: HeartInputs = {
    historyScore: parseInt(historyScore) as 0 | 1 | 2,
    ecgScore: parseInt(ecgScore) as 0 | 1 | 2,
    age: ageNum,
    riskFactorScore: parseInt(rfScore) as 0 | 1 | 2,
    troponinScore: parseInt(tropoScore) as 0 | 1 | 2,
  };

  const score = useMemo(() => heartScore(inputs), [inputs]);
  const result = useMemo(() => interpretHeart(score), [score]);

  return (
    <CollapsibleCard
      title="HEART Score — Chest Pain MACE Risk"
      badge={score > 0 ? String(score) + ' / 10' : undefined}
      badgeVariant={result.color === 'red' ? 'danger' : result.color === 'amber' ? 'warn' : 'default'}
    >
      <div className="scale-grid">
        <SelectInput label="History character" value={historyScore} onChange={setHistoryScore} options={[
          { value: '0', label: '0 — Slightly suspicious' },
          { value: '1', label: '1 — Moderately suspicious' },
          { value: '2', label: '2 — Highly suspicious (classic ACS)' },
        ]} />
        <SelectInput label="ECG" value={ecgScore} onChange={setEcgScore} options={[
          { value: '0', label: '0 — Normal' },
          { value: '1', label: '1 — Non-specific repolarisation changes' },
          { value: '2', label: '2 — Significant ST deviation / LBBB' },
        ]} />
        <div className="scale-field">
          <label className="scale-field__label">Age <span className="scale-field__unit">{ageNum ? `(auto: ${ageNum} yrs)` : '—'}</span></label>
          <input className="scale-field__input" readOnly value={
            ageNum == null ? '—' : ageNum < 45 ? '0 — < 45 years' : ageNum < 65 ? '1 — 45–64 years' : '2 — ≥ 65 years'
          } />
        </div>
        <SelectInput label="Risk factors / known CAD" value={rfScore} onChange={setRfScore} options={[
          { value: '0', label: '0 — No known risk factors' },
          { value: '1', label: '1 — 1–2 risk factors or BMI > 30' },
          { value: '2', label: '2 — Known CAD / ≥ 3 risk factors / DM' },
        ]} />
        <SelectInput label="Troponin" value={tropoScore} onChange={setTropoScore} options={[
          { value: '0', label: '0 — ≤ normal limit' },
          { value: '1', label: '1 — 1–3× upper limit of normal' },
          { value: '2', label: '2 — > 3× upper limit of normal' },
        ]} />
      </div>
      <ResultBadge result={result} />
    </CollapsibleCard>
  );
}

// ─── Wells PE ────────────────────────────────────────────────────────────────

function WellsPeCard() {
  const { vitals, surgicalHistory, comorbidities } = useAppContext();
  const autoHrHigh = vitals.heartRate ? parseFloat(vitals.heartRate) > 100 : false;
  const autoCancer = comorbidities.some(c => /cancer|tumour|tumor|malignancy/i.test(c));
  const autoRecentSurgery = surgicalHistory.length > 0;

  const [inputs, setInputs] = useState<WellsPeInputs>({
    dvtSigns: false,
    altDiagnosisLessLikely: false,
    hrAbove100: autoHrHigh,
    immobilised: autoRecentSurgery,
    priorDvtPe: false,
    haemoptysis: false,
    cancer: autoCancer,
  });

  const upd = (k: keyof WellsPeInputs) => (v: boolean) =>
    setInputs(c => ({ ...c, [k]: v }));

  const score = useMemo(() => wellsPeScore(inputs), [inputs]);
  const result = useMemo(() => interpretWellsPe(score), [score]);

  return (
    <CollapsibleCard
      title="Wells Score — Pulmonary Embolism"
      badge={score > 0 ? String(score) + ' pts' : undefined}
      badgeVariant={result.color === 'red' ? 'danger' : result.color === 'amber' ? 'warn' : 'default'}
    >
      <div className="scale-grid">
        <Toggle label="Clinical signs of DVT" checked={inputs.dvtSigns} onChange={upd('dvtSigns')} sub="3 pts" />
        <Toggle label="Alternative diagnosis less likely than PE" checked={inputs.altDiagnosisLessLikely} onChange={upd('altDiagnosisLessLikely')} sub="3 pts" />
        <Toggle label={`HR > 100 bpm${autoHrHigh ? ' ✓ auto' : ''}`} checked={inputs.hrAbove100} onChange={upd('hrAbove100')} sub="1.5 pts" />
        <Toggle label={`Immobilised / surgery in past 4 weeks${autoRecentSurgery ? ' ✓ surgical Hx' : ''}`} checked={inputs.immobilised} onChange={upd('immobilised')} sub="1.5 pts" />
        <Toggle label="Prior DVT / PE" checked={inputs.priorDvtPe} onChange={upd('priorDvtPe')} sub="1.5 pts" />
        <Toggle label="Haemoptysis" checked={inputs.haemoptysis} onChange={upd('haemoptysis')} sub="1 pt" />
        <Toggle label={`Active cancer${autoCancer ? ' ✓ auto' : ''}`} checked={inputs.cancer} onChange={upd('cancer')} sub="1 pt" />
      </div>
      <ResultBadge result={result} />
    </CollapsibleCard>
  );
}

// ─── ABCD2 ───────────────────────────────────────────────────────────────────

function Abcd2Card() {
  const { age, vitals, comorbidities } = useAppContext();
  const ageNum = age ? parseInt(age) : null;
  const autoBp = vitals.systolicBp ? parseFloat(vitals.systolicBp) >= 140 : false;
  const autoDiabetes = comorbidities.some(c => /diabetes|diabetic/i.test(c));

  const [clinScore, setClinScore] = useState('0');
  const [durScore, setDurScore] = useState('0');
  const [diabetes, setDiabetes] = useState(autoDiabetes);

  const inputs: Abcd2Inputs = {
    age: ageNum,
    sbp: vitals.systolicBp ? parseFloat(vitals.systolicBp) : null,
    clinicalFeatureScore: parseInt(clinScore) as 0 | 1 | 2,
    durationScore: parseInt(durScore) as 0 | 1 | 2,
    diabetes,
  };

  const score = useMemo(() => abcd2Score(inputs), [inputs]);
  const result = useMemo(() => interpretAbcd2(score), [score]);

  return (
    <CollapsibleCard
      title="ABCD2 Score — TIA Stroke Risk"
      badge={score > 0 ? String(score) + ' / 7' : undefined}
      badgeVariant={result.color === 'red' ? 'danger' : result.color === 'amber' ? 'warn' : 'default'}
    >
      <div className="scale-grid">
        <div className="scale-field">
          <label className="scale-field__label">Age ≥ 60 <span className="scale-field__unit">{ageNum ? `(auto: ${ageNum} yrs)` : '—'}</span></label>
          <input className="scale-field__input" readOnly value={ageNum != null ? (ageNum >= 60 ? '1 pt — Yes' : '0 pt — No') : '—'} />
        </div>
        <div className="scale-field">
          <label className="scale-field__label">SBP ≥ 140 mmHg <span className="scale-field__unit">{autoBp ? '✓ auto' : '—'}</span></label>
          <input className="scale-field__input" readOnly value={vitals.systolicBp ? (autoBp ? '1 pt — Yes' : '0 pt — No') : '—'} />
        </div>
        <SelectInput label="Clinical features" value={clinScore} onChange={setClinScore} options={[
          { value: '0', label: '0 — Other (vertigo, sensory loss, etc.)' },
          { value: '1', label: '1 — Speech disturbance without weakness' },
          { value: '2', label: '2 — Unilateral weakness' },
        ]} />
        <SelectInput label="Episode duration" value={durScore} onChange={setDurScore} options={[
          { value: '0', label: '0 — < 10 minutes' },
          { value: '1', label: '1 — 10–59 minutes' },
          { value: '2', label: '2 — ≥ 60 minutes' },
        ]} />
        <Toggle label={`Diabetes${autoDiabetes ? ' ✓ auto' : ''}`} checked={diabetes} onChange={setDiabetes} sub="1 pt" />
      </div>
      <ResultBadge result={result} />
    </CollapsibleCard>
  );
}

// ─── TG18 Cholangitis ─────────────────────────────────────────────────────────

function Tg18CholangitisCard() {
  const { vitals, age } = useAppContext();
  const autoFever = vitals.temperatureC ? parseFloat(vitals.temperatureC) >= 38 : false;
  const ageNum = age ? parseInt(age) : null;

  const [inputs, setInputs] = useState<Tg18CholangitisInputs>({
    fever: autoFever,
    wbcAbnormal: false,
    age: ageNum,
    bilirubinHighGrade2: false,
    albuminLow: false,
    organDysfunctionCv: false,
    organDysfunctionCns: false,
    organDysfunctionResp: false,
    organDysfunctionRenal: false,
    organDysfunctionHepatic: false,
    organDysfunctionHaem: false,
  });

  const upd = (k: keyof Tg18CholangitisInputs) => (v: boolean) =>
    setInputs(c => ({ ...c, [k]: v }));

  const grade = useMemo(() => tg18CholangitisGrade(inputs), [inputs]);
  const result = useMemo(() => interpretTg18Cholangitis(grade), [grade]);

  return (
    <CollapsibleCard
      title="TG18 — Cholangitis Severity"
      badge={grade ? `Grade ${grade}` : undefined}
      badgeVariant={grade === 'III' ? 'danger' : grade === 'II' ? 'warn' : 'default'}
    >
      <div className="scale-section-head">Grade II criteria (any = moderate)</div>
      <div className="scale-grid">
        <Toggle label={`Fever ≥ 38°C${autoFever ? ' ✓ auto' : ''}`} checked={inputs.fever} onChange={upd('fever')} />
        <Toggle label="WBC abnormal (< 4k or > 12k)" checked={inputs.wbcAbnormal} onChange={upd('wbcAbnormal')} />
        <Toggle label={`Age ≥ 75 years${ageNum != null && ageNum >= 75 ? ' ✓ auto' : ''}`} checked={(ageNum ?? 0) >= 75} onChange={() => {}} />
        <Toggle label="Bilirubin ≥ 85 µmol/L (5 mg/dL)" checked={inputs.bilirubinHighGrade2} onChange={upd('bilirubinHighGrade2')} />
        <Toggle label="Albumin < 0.7× lower limit of normal" checked={inputs.albuminLow} onChange={upd('albuminLow')} />
      </div>
      <div className="scale-section-head scale-section-head--danger">Grade III criteria — organ dysfunction (any = severe)</div>
      <div className="scale-grid">
        <Toggle label="CV — hypotension requiring vasopressors" checked={inputs.organDysfunctionCv} onChange={upd('organDysfunctionCv')} />
        <Toggle label="CNS — altered consciousness" checked={inputs.organDysfunctionCns} onChange={upd('organDysfunctionCns')} />
        <Toggle label="Respiratory — PaO₂/FiO₂ < 300" checked={inputs.organDysfunctionResp} onChange={upd('organDysfunctionResp')} />
        <Toggle label="Renal — oliguria / Cr > 177 µmol/L" checked={inputs.organDysfunctionRenal} onChange={upd('organDysfunctionRenal')} />
        <Toggle label="Hepatic — PT-INR > 1.5" checked={inputs.organDysfunctionHepatic} onChange={upd('organDysfunctionHepatic')} />
        <Toggle label="Haematological — Platelets < 100k" checked={inputs.organDysfunctionHaem} onChange={upd('organDysfunctionHaem')} />
      </div>
      <ResultBadge result={result} />
    </CollapsibleCard>
  );
}

// ─── ASGE CBD ────────────────────────────────────────────────────────────────

function AsgeCbdCard() {
  const { age, symptoms } = useAppContext();
  const ageNum = age ? parseInt(age) : null;
  const autoAge55 = (ageNum ?? 0) >= 55;
  const autoCholangitis = symptoms.includes('jaundice') && symptoms.includes('fever after surgery');

  const [inputs, setInputs] = useState<AsgeCbdInputs>({
    cbdStoneOnUss: false,
    cholangitisPresent: autoCholangitis,
    bilirubin: null,
    cbdDilated: false,
    lftsAbnormal: false,
    ageAbove55: autoAge55,
  });
  const [bilirubinStr, setBilirubinStr] = useState('');

  const upd = (k: keyof AsgeCbdInputs) => (v: boolean) =>
    setInputs(c => ({ ...c, [k]: v }));

  const prob = useMemo(
    () => asgeCbdProbability({ ...inputs, bilirubin: bilirubinStr ? parseFloat(bilirubinStr) : null }),
    [inputs, bilirubinStr],
  );
  const result = useMemo(() => interpretAsgeCbd(prob), [prob]);

  return (
    <CollapsibleCard
      title="ASGE — CBD Stone Probability"
      badge={prob}
      badgeVariant={prob === 'HIGH' ? 'danger' : prob === 'INTERMEDIATE' ? 'warn' : 'default'}
    >
      <div className="scale-section-head">Strong predictors</div>
      <div className="scale-grid">
        <Toggle label="CBD stone visible on USS" checked={inputs.cbdStoneOnUss} onChange={upd('cbdStoneOnUss')} />
        <Toggle label={`Cholangitis present${autoCholangitis ? ' ✓ auto' : ''}`} checked={inputs.cholangitisPresent} onChange={upd('cholangitisPresent')} />
      </div>
      <div className="scale-section-head">Intermediate predictors</div>
      <div className="scale-grid">
        <NumInput label="Bilirubin" unit="µmol/L" value={bilirubinStr} onChange={setBilirubinStr} min={0} max={600} placeholder="e.g. 120" />
        <Toggle label="CBD diameter > 6 mm on USS" checked={inputs.cbdDilated} onChange={upd('cbdDilated')} />
        <Toggle label="Abnormal LFTs (any)" checked={inputs.lftsAbnormal} onChange={upd('lftsAbnormal')} />
        <Toggle label={`Age > 55 years${autoAge55 ? ' ✓ auto' : ''}`} checked={inputs.ageAbove55} onChange={upd('ageAbove55')} />
      </div>
      <ResultBadge result={result} />
    </CollapsibleCard>
  );
}

// ─── Main tab ────────────────────────────────────────────────────────────────

export default function ScalesTab() {
  const { symptoms } = useAppContext();

  const hasBiliary = symptoms.some(s => ['jaundice', 'dark urine', 'pale stool', 'abdominal pain'].includes(s));
  const hasChestPain = symptoms.includes('chest pain');
  const hasSob = symptoms.includes('shortness of breath');
  const hasAbdPain = symptoms.includes('abdominal pain');

  return (
    <div className="gap-y">
      <div className="scales-intro">
        <strong>Clinical Decision Tools</strong> — Deterministic scoring; no AI. Items are auto-populated where intake data is available. Enter lab results below to complete scores.
      </div>

      {/* Show most relevant scales first based on symptoms */}
      {hasBiliary && <Tg18CholangitisCard />}
      {hasBiliary && <AsgeCbdCard />}
      {hasAbdPain && !hasBiliary && <AlvaradoCard />}
      {hasChestPain && <HeartCard />}
      {(hasChestPain || hasSob) && <WellsPeCard />}

      {/* Always show all */}
      {!hasAbdPain && !hasBiliary && <AlvaradoCard />}
      {!hasChestPain && <HeartCard />}
      {!hasChestPain && !hasSob && <WellsPeCard />}
      {!hasBiliary && <Tg18CholangitisCard />}
      {!hasBiliary && <AsgeCbdCard />}
      <Abcd2Card />
    </div>
  );
}
