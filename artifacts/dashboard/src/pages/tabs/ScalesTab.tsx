import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import {
  alvaradoScore, interpretAlvarado, type AlvaradoInputs,
  heartScore,    interpretHeart,    type HeartInputs,
  wellsPeScore,  interpretWellsPe,  type WellsPeInputs,
  wellsDvtScore, interpretWellsDvt, type WellsDvtInputs,
  abcd2Score,    interpretAbcd2,    type Abcd2Inputs,
  tg18CholangitisGrade, interpretTg18Cholangitis, type Tg18CholangitisInputs,
  asgeCbdProbability,   interpretAsgeCbd,          type AsgeCbdInputs,
  interpretWagner, WAGNER_GRADES, type WagnerGrade,
  news2Score, interpretNews2, type News2Inputs,
  curb65Score, interpretCurb65, type Curb65Inputs,
  glasgowBlatchfordScore, interpretGlasgowBlatchford, type GlasgowBlatchfordInputs,
  preRockallScore, interpretPreRockall, type PreRockallInputs,
  rcriScore, interpretRcri, type RcriInputs,
  ransonAdmissionScore, interpretRansonAdmission, type RansonAdmissionInputs,
  ppossumlPhysScore, ppossumlOpScore, interpretPpossuml,
  type PpossumlPhysInputs, type PpossumlOpInputs,
  mustScore, interpretMust, type MustInputs,
  capriniScore, interpretCaprini, type CapriniInputs,
  stopBangScore, interpretStopBang, type StopBangInputs,
  CFS_LEVELS, interpretCfs,
  ECOG_LEVELS, interpretEcog,
  PHQ9_QUESTIONS, phq9Score, interpretPhq9,
  GAD7_QUESTIONS, gad7Score, interpretGad7,
  GERDQ_QUESTIONS, GERDQ_FREQ_OPTS, gerdqScore, interpretGerdq,
  LIKERT_OPTS,
  childPughScore, interpretChildPugh, type ChildPughInputs,
  apfelScore, interpretApfel, APFEL_RISK, type ApfelInputs,
  meldScore, meldNaScore, interpretMeld,
  type ScaleResult,
} from '@/lib/clinical-scales';
import { getCdsSuggestions, type CdsContext } from '@/lib/clinical-cds';

// ── Result badge ──────────────────────────────────────────────────────────────

function ResultBadge({ result }: { result: ScaleResult }) {
  const colors: Record<string, string> = {
    green: '#d1fae5', amber: '#fef3c7', red: '#fee2e2',
  };
  const border: Record<string, string> = {
    green: '#6ee7b7', amber: '#fcd34d', red: '#fca5a5',
  };
  return (
    <div style={{
      marginTop: 12, padding: '10px 14px', borderRadius: 8,
      background: colors[result.color] ?? '#f3f4f6',
      border: `1px solid ${border[result.color] ?? '#d1d5db'}`,
    }}>
      <div style={{ fontWeight: 700, fontSize: 15 }}>{result.band}</div>
      <div style={{ fontSize: 13, marginTop: 4, color: '#374151' }}>{result.action}</div>
    </div>
  );
}

// ── Shared input helpers ──────────────────────────────────────────────────────

function Chk({ label, checked, onChange, pts }: {
  label: string; checked: boolean; onChange: () => void; pts?: number;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginBottom: 6, fontSize: 13 }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ marginTop: 2, flexShrink: 0 }} />
      <span>{label}{pts !== undefined && <span style={{ color: '#6b7280', marginLeft: 4 }}>({pts > 0 ? `+${pts}` : pts})</span>}</span>
    </label>
  );
}

function ScoreRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ marginTop: 10, fontWeight: 600, fontSize: 14 }}>
      {label}: <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}

// ── Scale card components ─────────────────────────────────────────────────────

function News2Card() {
  const [v, setV] = useState<News2Inputs>({
    respiratoryRate: 15, spo2: 98, supplementalO2: false,
    systolicBp: 120, heartRate: 75, consciousnessAvpu: 'A', temperatureC: 37.0,
  });
  const score = news2Score(v);
  const result = interpretNews2(score);
  const num = (k: keyof News2Inputs) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV(p => ({ ...p, [k]: e.target.value ? parseFloat(e.target.value) : null }));
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 };
  const lblStyle: React.CSSProperties = { fontSize: 12, color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 2 };
  const inpStyle: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 8px', fontSize: 13, width: '100%' };
  return (
    <div>
      <div style={gridStyle}>
        <label style={lblStyle}>Resp rate (/min)<input style={inpStyle} type="number" value={v.respiratoryRate ?? ''} onChange={num('respiratoryRate')} /></label>
        <label style={lblStyle}>SpO₂ (%)<input style={inpStyle} type="number" value={v.spo2 ?? ''} onChange={num('spo2')} /></label>
        <label style={lblStyle}>Systolic BP<input style={inpStyle} type="number" value={v.systolicBp ?? ''} onChange={num('systolicBp')} /></label>
        <label style={lblStyle}>Heart rate<input style={inpStyle} type="number" value={v.heartRate ?? ''} onChange={num('heartRate')} /></label>
        <label style={lblStyle}>Temp (°C)<input style={inpStyle} type="number" step="0.1" value={v.temperatureC ?? ''} onChange={num('temperatureC')} /></label>
        <label style={lblStyle}>Consciousness
          <select style={inpStyle} value={v.consciousnessAvpu} onChange={e => setV(p => ({ ...p, consciousnessAvpu: e.target.value as News2Inputs['consciousnessAvpu'] }))}>
            <option value="A">Alert</option>
            <option value="C">New confusion</option>
            <option value="V">Voice</option>
            <option value="P">Pain</option>
            <option value="U">Unresponsive</option>
          </select>
        </label>
      </div>
      <Chk label="On supplemental O₂" checked={v.supplementalO2} onChange={() => setV(p => ({ ...p, supplementalO2: !p.supplementalO2 }))} />
      <ScoreRow label="NEWS2 Score" value={score} />
      <ResultBadge result={result} />
    </div>
  );
}

function AlvaradoCard() {
  const [v, setV] = useState<AlvaradoInputs>({
    migratoryPain: false, anorexia: false, nausea: false,
    rifTenderness: false, rebound: false, fever: false,
    wbcAbove10: false, leftShift: false,
  });
  const score = alvaradoScore(v);
  const result = interpretAlvarado(score);
  const tog = (k: keyof AlvaradoInputs) => setV(p => ({ ...p, [k]: !p[k] }));
  return (
    <div>
      <Chk label="Migratory pain to RLQ" checked={v.migratoryPain} onChange={() => tog('migratoryPain')} pts={1} />
      <Chk label="Anorexia" checked={v.anorexia} onChange={() => tog('anorexia')} pts={1} />
      <Chk label="Nausea / vomiting" checked={v.nausea} onChange={() => tog('nausea')} pts={1} />
      <Chk label="Tenderness in RIF" checked={v.rifTenderness} onChange={() => tog('rifTenderness')} pts={2} />
      <Chk label="Rebound tenderness" checked={v.rebound} onChange={() => tog('rebound')} pts={1} />
      <Chk label="Fever (temperature > 37.3°C)" checked={v.fever} onChange={() => tog('fever')} pts={1} />
      <Chk label="WBC > 10,000 /µL" checked={v.wbcAbove10} onChange={() => tog('wbcAbove10')} pts={2} />
      <Chk label="Shift to left (neutrophilia / bands)" checked={v.leftShift} onChange={() => tog('leftShift')} pts={1} />
      <ScoreRow label="Alvarado Score" value={`${score}/10`} />
      <ResultBadge result={result} />
    </div>
  );
}

function HeartCard() {
  const [v, setV] = useState<HeartInputs>({
    historyScore: 1, ecgScore: 0, age: null,
    riskFactorScore: 0, troponinScore: 0,
  });
  const score = heartScore(v);
  const result = interpretHeart(score);
  const numSel = (k: keyof HeartInputs) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setV(p => ({ ...p, [k]: +e.target.value as 0 | 1 | 2 }));
  const inpStyle: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 8px', fontSize: 13, width: '100%' };
  const lblStyle: React.CSSProperties = { fontSize: 12, color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 };
  return (
    <div>
      <label style={lblStyle}>History
        <select style={inpStyle} value={v.historyScore} onChange={numSel('historyScore')}>
          <option value={2}>Highly suspicious (2)</option>
          <option value={1}>Moderately suspicious (1)</option>
          <option value={0}>Slightly suspicious (0)</option>
        </select>
      </label>
      <label style={lblStyle}>ECG
        <select style={inpStyle} value={v.ecgScore} onChange={numSel('ecgScore')}>
          <option value={2}>LBBB / significant ST changes (2)</option>
          <option value={1}>Non-specific repolarisation changes (1)</option>
          <option value={0}>Normal (0)</option>
        </select>
      </label>
      <label style={lblStyle}>Age (years) — &lt; 45 = 0, 45–64 = 1, ≥ 65 = 2
        <input style={inpStyle} type="number" value={v.age ?? ''} onChange={e => setV(p => ({ ...p, age: e.target.value ? +e.target.value : null }))} />
      </label>
      <label style={lblStyle}>Risk factors
        <select style={inpStyle} value={v.riskFactorScore} onChange={numSel('riskFactorScore')}>
          <option value={2}>Known CAD / ≥ 3 risk factors (2)</option>
          <option value={1}>1–2 risk factors (1)</option>
          <option value={0}>None known (0)</option>
        </select>
      </label>
      <label style={lblStyle}>Troponin
        <select style={inpStyle} value={v.troponinScore} onChange={numSel('troponinScore')}>
          <option value={2}>{'>'} 3× upper limit of normal (2)</option>
          <option value={1}>1–3× upper limit of normal (1)</option>
          <option value={0}>≤ upper limit of normal (0)</option>
        </select>
      </label>
      <ScoreRow label="HEART Score" value={`${score}/10`} />
      <ResultBadge result={result} />
    </div>
  );
}

function WellsPeCard() {
  const [v, setV] = useState<WellsPeInputs>({
    dvtSigns: false, altDiagnosisLessLikely: false, hrAbove100: false,
    immobilised: false, priorDvtPe: false, haemoptysis: false, cancer: false,
  });
  const score = wellsPeScore(v);
  const result = interpretWellsPe(score);
  const tog = (k: keyof WellsPeInputs) => setV(p => ({ ...p, [k]: !p[k] }));
  return (
    <div>
      <Chk label="Clinical signs / symptoms of DVT" checked={v.dvtSigns} onChange={() => tog('dvtSigns')} pts={3} />
      <Chk label="Alternative diagnosis less likely than PE" checked={v.altDiagnosisLessLikely} onChange={() => tog('altDiagnosisLessLikely')} pts={3} />
      <Chk label="Heart rate > 100 bpm" checked={v.hrAbove100} onChange={() => tog('hrAbove100')} pts={1.5} />
      <Chk label="Immobilisation or surgery in past 4 weeks" checked={v.immobilised} onChange={() => tog('immobilised')} pts={1.5} />
      <Chk label="Prior DVT or PE" checked={v.priorDvtPe} onChange={() => tog('priorDvtPe')} pts={1.5} />
      <Chk label="Haemoptysis" checked={v.haemoptysis} onChange={() => tog('haemoptysis')} pts={1} />
      <Chk label="Malignancy (treatment / palliation in past 6 months)" checked={v.cancer} onChange={() => tog('cancer')} pts={1} />
      <ScoreRow label="Wells PE Score" value={score} />
      <ResultBadge result={result} />
    </div>
  );
}

function WellsDvtCard() {
  const [v, setV] = useState<WellsDvtInputs>({
    activeCancer: false, paralysisParesis: false, bedridden3Days: false,
    localTenderness: false, entireLegSwollen: false, calfSwelling3cm: false,
    pittingOedema: false, collateralVeins: false, previousDvt: false,
    alternativeDx: false,
  });
  const score = wellsDvtScore(v);
  const result = interpretWellsDvt(score);
  const tog = (k: keyof WellsDvtInputs) => setV(p => ({ ...p, [k]: !p[k] }));
  return (
    <div>
      <Chk label="Active cancer (treatment within 6 months or palliation)" checked={v.activeCancer} onChange={() => tog('activeCancer')} pts={1} />
      <Chk label="Paralysis, paresis, or recent plaster immobilisation of leg" checked={v.paralysisParesis} onChange={() => tog('paralysisParesis')} pts={1} />
      <Chk label="Bedridden ≥ 3 days or major surgery within 12 weeks" checked={v.bedridden3Days} onChange={() => tog('bedridden3Days')} pts={1} />
      <Chk label="Localised tenderness along deep venous system" checked={v.localTenderness} onChange={() => tog('localTenderness')} pts={1} />
      <Chk label="Entire leg swollen" checked={v.entireLegSwollen} onChange={() => tog('entireLegSwollen')} pts={1} />
      <Chk label="Calf swelling > 3 cm vs contralateral side" checked={v.calfSwelling3cm} onChange={() => tog('calfSwelling3cm')} pts={1} />
      <Chk label="Pitting oedema (symptomatic leg only)" checked={v.pittingOedema} onChange={() => tog('pittingOedema')} pts={1} />
      <Chk label="Collateral superficial veins (non-varicose)" checked={v.collateralVeins} onChange={() => tog('collateralVeins')} pts={1} />
      <Chk label="Previously documented DVT" checked={v.previousDvt} onChange={() => tog('previousDvt')} pts={1} />
      <Chk label="Alternative diagnosis at least as likely" checked={v.alternativeDx} onChange={() => tog('alternativeDx')} pts={-2} />
      <ScoreRow label="Wells DVT Score" value={score} />
      <ResultBadge result={result} />
    </div>
  );
}

function Abcd2Card() {
  const [v, setV] = useState<Abcd2Inputs>({
    age: null, sbp: null, clinicalFeatureScore: 0, durationScore: 0, diabetes: false,
  });
  const score = abcd2Score(v);
  const result = interpretAbcd2(score);
  const inpStyle: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 8px', fontSize: 13, width: '100%' };
  const lblStyle: React.CSSProperties = { fontSize: 12, color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 };
  return (
    <div>
      <label style={lblStyle}>Age (years) — ≥ 60 scores 1 pt
        <input style={inpStyle} type="number" value={v.age ?? ''} onChange={e => setV(p => ({ ...p, age: e.target.value ? +e.target.value : null }))} />
      </label>
      <label style={lblStyle}>Systolic BP (mmHg) — ≥ 140 scores 1 pt
        <input style={inpStyle} type="number" value={v.sbp ?? ''} onChange={e => setV(p => ({ ...p, sbp: e.target.value ? +e.target.value : null }))} />
      </label>
      <label style={lblStyle}>Clinical features
        <select style={inpStyle} value={v.clinicalFeatureScore} onChange={e => setV(p => ({ ...p, clinicalFeatureScore: +e.target.value as 0 | 1 | 2 }))}>
          <option value={2}>Unilateral weakness (2)</option>
          <option value={1}>Speech disturbance without weakness (1)</option>
          <option value={0}>Other (0)</option>
        </select>
      </label>
      <label style={lblStyle}>Duration of symptoms
        <select style={inpStyle} value={v.durationScore} onChange={e => setV(p => ({ ...p, durationScore: +e.target.value as 0 | 1 | 2 }))}>
          <option value={2}>≥ 60 minutes (2)</option>
          <option value={1}>10–59 minutes (1)</option>
          <option value={0}>&lt; 10 minutes (0)</option>
        </select>
      </label>
      <Chk label="Diabetes mellitus" checked={v.diabetes} onChange={() => setV(p => ({ ...p, diabetes: !p.diabetes }))} pts={1} />
      <ScoreRow label="ABCD² Score" value={`${score}/7`} />
      <ResultBadge result={result} />
    </div>
  );
}

function Tg18Card() {
  const [v, setV] = useState<Tg18CholangitisInputs>({
    fever: false, wbcAbnormal: false, age: null,
    bilirubinHighGrade2: false, albuminLow: false,
    organDysfunctionCv: false, organDysfunctionCns: false, organDysfunctionResp: false,
    organDysfunctionRenal: false, organDysfunctionHepatic: false, organDysfunctionHaem: false,
  });
  const grade = tg18CholangitisGrade(v);
  const result = interpretTg18Cholangitis(grade);
  const tog = (k: keyof Tg18CholangitisInputs) => setV(p => ({ ...p, [k]: !p[k] }));
  const inpStyle: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 8px', fontSize: 13, width: '100%' };
  const lblStyle: React.CSSProperties = { fontSize: 12, color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 };
  const hdr: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginTop: 10, marginBottom: 4 };
  return (
    <div>
      <div style={hdr}>Grade I / II criteria</div>
      <Chk label="Fever / rigors (temp ≥ 38°C)" checked={v.fever} onChange={() => tog('fever')} />
      <Chk label="WBC abnormal (< 4k or > 12k)" checked={v.wbcAbnormal} onChange={() => tog('wbcAbnormal')} />
      <label style={lblStyle}>Age (years) — ≥ 75 is Grade II criterion
        <input style={inpStyle} type="number" value={v.age ?? ''} onChange={e => setV(p => ({ ...p, age: e.target.value ? +e.target.value : null }))} />
      </label>
      <Chk label="Bilirubin ≥ 85 µmol/L (Grade II criterion)" checked={v.bilirubinHighGrade2} onChange={() => tog('bilirubinHighGrade2')} />
      <Chk label="Albumin < 0.7 × LLN (Grade II criterion)" checked={v.albuminLow} onChange={() => tog('albuminLow')} />
      <div style={hdr}>Organ dysfunction — Grade III criteria</div>
      <Chk label="Cardiovascular — hypotension requiring vasopressors" checked={v.organDysfunctionCv} onChange={() => tog('organDysfunctionCv')} />
      <Chk label="CNS — altered consciousness" checked={v.organDysfunctionCns} onChange={() => tog('organDysfunctionCns')} />
      <Chk label="Respiratory — PaO₂/FiO₂ < 300" checked={v.organDysfunctionResp} onChange={() => tog('organDysfunctionResp')} />
      <Chk label="Renal — oliguria / creatinine > 177 µmol/L" checked={v.organDysfunctionRenal} onChange={() => tog('organDysfunctionRenal')} />
      <Chk label="Hepatic — PT-INR > 1.5" checked={v.organDysfunctionHepatic} onChange={() => tog('organDysfunctionHepatic')} />
      <Chk label="Haematological — platelets < 100,000" checked={v.organDysfunctionHaem} onChange={() => tog('organDysfunctionHaem')} />
      <ScoreRow label="TG18 Grade" value={grade} />
      <ResultBadge result={result} />
    </div>
  );
}

function AsgeCbdCard() {
  const [v, setV] = useState<AsgeCbdInputs>({
    cbdStoneOnUss: false, cholangitisPresent: false, bilirubin: null,
    cbdDilated: false, lftsAbnormal: false, ageAbove55: false,
  });
  const prob = asgeCbdProbability(v);
  const result = interpretAsgeCbd(prob);
  const tog = (k: keyof AsgeCbdInputs) => setV(p => ({ ...p, [k]: !p[k] }));
  const inpStyle: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 8px', fontSize: 13, width: '100%' };
  const lblStyle: React.CSSProperties = { fontSize: 12, color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 };
  const hdr: React.CSSProperties = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginTop: 10, marginBottom: 4 };
  return (
    <div>
      <div style={hdr}>Strong predictors (any = HIGH probability)</div>
      <Chk label="CBD stone visualised on USS" checked={v.cbdStoneOnUss} onChange={() => tog('cbdStoneOnUss')} />
      <Chk label="Clinical cholangitis present" checked={v.cholangitisPresent} onChange={() => tog('cholangitisPresent')} />
      <label style={lblStyle}>{'Bilirubin (µmol/L) — > 68.5 with dilated CBD = HIGH'}
        <input style={inpStyle} type="number" value={v.bilirubin ?? ''} onChange={e => setV(p => ({ ...p, bilirubin: e.target.value ? +e.target.value : null }))} />
      </label>
      <div style={hdr}>Intermediate predictors</div>
      <Chk label="Dilated CBD on USS (> 6 mm)" checked={v.cbdDilated} onChange={() => tog('cbdDilated')} />
      <Chk label="Abnormal LFTs (any elevation)" checked={v.lftsAbnormal} onChange={() => tog('lftsAbnormal')} />
      <Chk label="Age > 55" checked={v.ageAbove55} onChange={() => tog('ageAbove55')} />
      <ScoreRow label="CBD Stone Probability" value={prob} />
      <ResultBadge result={result} />
    </div>
  );
}

function WagnerCard() {
  const [grade, setGrade] = useState<WagnerGrade>(0);
  const result = interpretWagner(grade);
  const current = WAGNER_GRADES[grade];
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {WAGNER_GRADES.map(w => (
          <button key={w.grade} onClick={() => setGrade(w.grade)} style={{
            padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db',
            background: grade === w.grade ? '#1d4ed8' : '#fff',
            color: grade === w.grade ? '#fff' : '#374151',
            fontWeight: grade === w.grade ? 700 : 400, cursor: 'pointer', fontSize: 13,
          }}>
            Grade {w.grade}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 13, color: '#374151', margin: '0 0 8px' }}>{current.description}</p>
      <ResultBadge result={result} />
    </div>
  );
}

function Curb65Card() {
  const [v, setV] = useState<Curb65Inputs>({
    confusion: false, ureaMmolAbove7: false, respiratoryRateAbove30: false,
    bpLow: false, age65orAbove: false,
  });
  const score = curb65Score(v);
  const result = interpretCurb65(score);
  const tog = (k: keyof Curb65Inputs) => setV(p => ({ ...p, [k]: !p[k] }));
  return (
    <div>
      <Chk label="Confusion (new onset, AMTS ≤ 8)" checked={v.confusion} onChange={() => tog('confusion')} pts={1} />
      <Chk label="Urea > 7 mmol/L (BUN > 19 mg/dL)" checked={v.ureaMmolAbove7} onChange={() => tog('ureaMmolAbove7')} pts={1} />
      <Chk label="Respiratory rate ≥ 30/min" checked={v.respiratoryRateAbove30} onChange={() => tog('respiratoryRateAbove30')} pts={1} />
      <Chk label="Low BP (SBP < 90 or DBP ≤ 60 mmHg)" checked={v.bpLow} onChange={() => tog('bpLow')} pts={1} />
      <Chk label="Age ≥ 65 years" checked={v.age65orAbove} onChange={() => tog('age65orAbove')} pts={1} />
      <ScoreRow label="CURB-65 Score" value={`${score}/5`} />
      <ResultBadge result={result} />
    </div>
  );
}

function GlasgowBlatchfordCard() {
  const [v, setV] = useState<GlasgowBlatchfordInputs>({
    ureaMmol: null, haemoglobinMale: null, haemoglobinFemale: null,
    isMale: true, systolicBp: null, heartRateAbove100: false,
    melaena: false, syncope: false, liverDisease: false, cardiacFailure: false,
  });
  const score = glasgowBlatchfordScore(v);
  const result = interpretGlasgowBlatchford(score);
  const inpStyle: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 8px', fontSize: 13, width: '100%' };
  const lblStyle: React.CSSProperties = { fontSize: 12, color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 };
  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 };
  return (
    <div>
      <div style={grid}>
        <label style={lblStyle}>Urea (mmol/L)<input style={inpStyle} type="number" step="0.1" value={v.ureaMmol ?? ''} onChange={e => setV(p => ({ ...p, ureaMmol: e.target.value ? +e.target.value : null }))} /></label>
        <label style={lblStyle}>Systolic BP<input style={inpStyle} type="number" value={v.systolicBp ?? ''} onChange={e => setV(p => ({ ...p, systolicBp: e.target.value ? +e.target.value : null }))} /></label>
        <label style={lblStyle}>Hb — male (g/dL)<input style={inpStyle} type="number" step="0.1" value={v.haemoglobinMale ?? ''} onChange={e => setV(p => ({ ...p, haemoglobinMale: e.target.value ? +e.target.value : null }))} /></label>
        <label style={lblStyle}>Hb — female (g/dL)<input style={inpStyle} type="number" step="0.1" value={v.haemoglobinFemale ?? ''} onChange={e => setV(p => ({ ...p, haemoglobinFemale: e.target.value ? +e.target.value : null }))} /></label>
      </div>
      <label style={{ ...lblStyle, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={v.isMale} onChange={e => setV(p => ({ ...p, isMale: e.target.checked }))} />
        Male patient (use male Hb thresholds)
      </label>
      <Chk label="Heart rate > 100 bpm" checked={v.heartRateAbove100} onChange={() => setV(p => ({ ...p, heartRateAbove100: !p.heartRateAbove100 }))} pts={1} />
      <Chk label="Melaena on presentation" checked={v.melaena} onChange={() => setV(p => ({ ...p, melaena: !p.melaena }))} pts={1} />
      <Chk label="Syncope" checked={v.syncope} onChange={() => setV(p => ({ ...p, syncope: !p.syncope }))} pts={2} />
      <Chk label="Hepatic disease" checked={v.liverDisease} onChange={() => setV(p => ({ ...p, liverDisease: !p.liverDisease }))} pts={2} />
      <Chk label="Cardiac failure" checked={v.cardiacFailure} onChange={() => setV(p => ({ ...p, cardiacFailure: !p.cardiacFailure }))} pts={2} />
      <ScoreRow label="Glasgow-Blatchford Score" value={score} />
      <ResultBadge result={result} />
    </div>
  );
}

function PreRockallCard() {
  const [v, setV] = useState<PreRockallInputs>({
    age: null, haemodynamicShock: 'none', comorbidity: 'none',
  });
  const score = preRockallScore(v);
  const result = interpretPreRockall(score);
  const inpStyle: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 8px', fontSize: 13, width: '100%' };
  const lblStyle: React.CSSProperties = { fontSize: 12, color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 8 };
  return (
    <div>
      <label style={lblStyle}>Age (years) — ≥ 60 scores 1 pt, ≥ 80 scores 2 pts
        <input style={inpStyle} type="number" value={v.age ?? ''} onChange={e => setV(p => ({ ...p, age: e.target.value ? +e.target.value : null }))} />
      </label>
      <label style={lblStyle}>Haemodynamic shock
        <select style={inpStyle} value={v.haemodynamicShock} onChange={e => setV(p => ({ ...p, haemodynamicShock: e.target.value as PreRockallInputs['haemodynamicShock'] }))}>
          <option value="none">No shock — SBP ≥ 100, HR &lt; 100 (0)</option>
          <option value="tachycardia">Tachycardia — HR ≥ 100, SBP ≥ 100 (1)</option>
          <option value="hypotension">Hypotension — SBP &lt; 100 (2)</option>
        </select>
      </label>
      <label style={lblStyle}>Comorbidity
        <select style={inpStyle} value={v.comorbidity} onChange={e => setV(p => ({ ...p, comorbidity: e.target.value as PreRockallInputs['comorbidity'] }))}>
          <option value="none">None (0)</option>
          <option value="cardiac_renal">Cardiac failure / IHD / major comorbidity (2)</option>
          <option value="liver_cancer">Renal or hepatic failure / metastatic cancer (3)</option>
        </select>
      </label>
      <ScoreRow label="Pre-Rockall Score" value={score} />
      <ResultBadge result={result} />
    </div>
  );
}

function RcriCard() {
  const [v, setV] = useState<RcriInputs>({
    highRiskSurgery: false, ischemicHeartDisease: false, congestiveHeartFailure: false,
    cerebrovascularDisease: false, insulinDependentDiabetes: false, creatinineAbove177: false,
  });
  const score = rcriScore(v);
  const result = interpretRcri(score);
  const tog = (k: keyof RcriInputs) => setV(p => ({ ...p, [k]: !p[k] }));
  return (
    <div>
      <Chk label="High-risk surgery (intrathoracic / intraperitoneal / suprainguinal vascular)" checked={v.highRiskSurgery} onChange={() => tog('highRiskSurgery')} pts={1} />
      <Chk label="Ischaemic heart disease (hx of MI / positive stress / angina / nitrates / Q waves)" checked={v.ischemicHeartDisease} onChange={() => tog('ischemicHeartDisease')} pts={1} />
      <Chk label="Congestive heart failure (hx / pulmonary oedema / S3 / bilateral rales)" checked={v.congestiveHeartFailure} onChange={() => tog('congestiveHeartFailure')} pts={1} />
      <Chk label="Cerebrovascular disease (hx of TIA or stroke)" checked={v.cerebrovascularDisease} onChange={() => tog('cerebrovascularDisease')} pts={1} />
      <Chk label="Pre-operative insulin use" checked={v.insulinDependentDiabetes} onChange={() => tog('insulinDependentDiabetes')} pts={1} />
      <Chk label="Pre-operative creatinine > 177 µmol/L (2.0 mg/dL)" checked={v.creatinineAbove177} onChange={() => tog('creatinineAbove177')} pts={1} />
      <ScoreRow label="RCRI Score" value={`${score}/6`} />
      <ResultBadge result={result} />
    </div>
  );
}

function RansonCard() {
  const [v, setV] = useState<RansonAdmissionInputs>({
    age55orAbove: false, wbcAbove16: false, glucoseAbove11: false,
    ldhAbove350: false, astAbove250: false,
  });
  const score = ransonAdmissionScore(v);
  const result = interpretRansonAdmission(score);
  const tog = (k: keyof RansonAdmissionInputs) => setV(p => ({ ...p, [k]: !p[k] }));
  return (
    <div>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px' }}>
        Admission criteria (5 of 11 total — 48-hour criteria collected separately after admission)
      </p>
      <Chk label="Age ≥ 55 years" checked={v.age55orAbove} onChange={() => tog('age55orAbove')} pts={1} />
      <Chk label="WBC > 16,000 /µL" checked={v.wbcAbove16} onChange={() => tog('wbcAbove16')} pts={1} />
      <Chk label="Glucose > 11 mmol/L (200 mg/dL)" checked={v.glucoseAbove11} onChange={() => tog('glucoseAbove11')} pts={1} />
      <Chk label="LDH > 350 IU/L" checked={v.ldhAbove350} onChange={() => tog('ldhAbove350')} pts={1} />
      <Chk label="AST > 250 IU/L" checked={v.astAbove250} onChange={() => tog('astAbove250')} pts={1} />
      <ScoreRow label="Ranson Admission Score" value={`${score}/5`} />
      <ResultBadge result={result} />
    </div>
  );
}

// ── P-POSSUM card ─────────────────────────────────────────────────────────────

const PHYS_OPTS: {
  field: keyof PpossumlPhysInputs;
  label: string;
  options: { label: string; value: number }[];
}[] = [
  { field: 'age',         label: 'Age',
    options: [{label:'<60',value:1},{label:'60–69',value:2},{label:'70–79',value:4},{label:'≥80',value:8}] },
  { field: 'cardiac',     label: 'Cardiac signs',
    options: [{label:'No failure',value:1},{label:'Diuretic/digoxin/antihypertensive',value:2},{label:'Oedema / on warfarin',value:4},{label:'Raised JVP / cardiomegaly',value:8}] },
  { field: 'respiratory', label: 'Respiratory history',
    options: [{label:'No dyspnoea / mild (not limiting)',value:1},{label:'Exertional dyspnoea / mild COPD',value:2},{label:'Limiting dyspnoea / moderate COPD',value:4},{label:'Dyspnoea at rest / severe COPD',value:8}] },
  { field: 'ecg',         label: 'ECG',
    options: [{label:'Normal',value:1},{label:'AF rate 60–90',value:4},{label:'Any other abnormal change',value:8}] },
  { field: 'systolicBp',  label: 'Systolic BP (mmHg)',
    options: [{label:'110–130',value:1},{label:'131–170 or 100–109',value:2},{label:'≥171 or 90–99',value:4},{label:'<90',value:8}] },
  { field: 'pulse',       label: 'Pulse rate (bpm)',
    options: [{label:'50–80',value:1},{label:'81–100 or 40–49',value:2},{label:'101–120',value:4},{label:'≥121 or <40',value:8}] },
  { field: 'gcs',         label: 'GCS',
    options: [{label:'15 (fully alert)',value:1},{label:'12–14',value:2},{label:'9–11',value:4},{label:'≤8',value:8}] },
  { field: 'haematocrit', label: 'Haematocrit (%)',
    options: [{label:'≥36',value:1},{label:'26–35',value:2},{label:'≤25',value:4}] },
  { field: 'wbc',         label: 'WBC (×10⁹/L)',
    options: [{label:'4–10',value:1},{label:'10.1–20 or 3.1–3.9',value:2},{label:'≥20.1 or ≤3',value:4}] },
  { field: 'urea',        label: 'Urea (mmol/L)',
    options: [{label:'<7.5',value:1},{label:'7.6–10',value:2},{label:'10.1–15',value:4},{label:'>15',value:8}] },
  { field: 'sodium',      label: 'Sodium (mmol/L)',
    options: [{label:'≥136',value:1},{label:'131–135',value:2},{label:'126–130',value:4},{label:'≤125',value:8}] },
  { field: 'potassium',   label: 'Potassium (mmol/L)',
    options: [{label:'3.5–5.0',value:1},{label:'3.2–3.4 or 5.1–5.3',value:2},{label:'2.9–3.1 or 5.4–5.9',value:4},{label:'≤2.8 or ≥6.0',value:8}] },
];

const OP_OPTS: {
  field: keyof PpossumlOpInputs;
  label: string;
  options: { label: string; value: number }[];
}[] = [
  { field: 'severity',   label: 'Operative severity',
    options: [{label:'Minor (e.g. drainage, biopsy)',value:1},{label:'Moderate (e.g. appendicectomy, cholecystectomy)',value:2},{label:'Major (e.g. hemicolectomy, total hip)',value:4},{label:'Major+ (e.g. oesophagectomy, liver resection)',value:8}] },
  { field: 'procedures', label: 'Number of procedures',
    options: [{label:'1',value:1},{label:'2',value:4},{label:'>2',value:8}] },
  { field: 'bloodLoss',  label: 'Total blood loss (mL)',
    options: [{label:'<100',value:1},{label:'101–500',value:2},{label:'501–999',value:4},{label:'≥1000',value:8}] },
  { field: 'soiling',    label: 'Peritoneal soiling',
    options: [{label:'None',value:1},{label:'Minor (serous fluid)',value:2},{label:'Local pus',value:4},{label:'Free bowel content / pus / blood',value:8}] },
  { field: 'malignancy', label: 'Malignancy',
    options: [{label:'No malignancy / no node involvement',value:1},{label:'Primary only',value:2},{label:'Lymph node metastasis',value:4},{label:'Distant metastasis',value:8}] },
  { field: 'urgency',    label: 'Operative urgency',
    options: [{label:'Elective',value:1},{label:'Emergency (resuscitation possible >2h)',value:4},{label:'Emergency (resuscitation impossible)',value:8}] },
];

function PpossumlCard() {
  const [phys, setPhys] = useState<PpossumlPhysInputs>({
    age:1, cardiac:1, respiratory:1, ecg:1, systolicBp:1, pulse:1,
    gcs:1, haematocrit:1, wbc:1, urea:1, sodium:1, potassium:1,
  });
  const [op, setOp] = useState<PpossumlOpInputs>({
    severity:1, procedures:1, bloodLoss:1, soiling:1, malignancy:1, urgency:1,
  });
  const physScore = ppossumlPhysScore(phys);
  const opScore   = ppossumlOpScore(op);
  const result    = interpretPpossuml(physScore, opScore);
  const selStyle  = (active: boolean): React.CSSProperties => ({
    fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
    border: active ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
    background: active ? '#0f172a' : '#fff',
    color: active ? '#fff' : '#374151',
    whiteSpace: 'nowrap',
  });
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 10 }}>PHYSIOLOGICAL SCORE</div>
      {PHYS_OPTS.map(row => (
        <div key={row.field} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{row.label}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {row.options.map(o => (
              <button key={o.value} type="button" style={selStyle(phys[row.field] === o.value)}
                onClick={() => setPhys(p => ({ ...p, [row.field]: o.value as PpossumlPhysInputs[typeof row.field] }))}>
                {o.label} ({o.value})
              </button>
            ))}
          </div>
        </div>
      ))}
      <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginTop: 16, marginBottom: 10 }}>OPERATIVE SCORE</div>
      {OP_OPTS.map(row => (
        <div key={row.field} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{row.label}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {row.options.map(o => (
              <button key={o.value} type="button" style={selStyle(op[row.field] === o.value)}
                onClick={() => setOp(p => ({ ...p, [row.field]: o.value as PpossumlOpInputs[typeof row.field] }))}>
                {o.label} ({o.value})
              </button>
            ))}
          </div>
        </div>
      ))}
      <ScoreRow label="Physiological score" value={physScore} />
      <ScoreRow label="Operative score" value={opScore} />
      <ResultBadge result={result} />
    </div>
  );
}

// ── MUST card ─────────────────────────────────────────────────────────────────

function MustCard() {
  const [v, setV] = useState<MustInputs>({ bmiScore: 0, weightLossScore: 0, acuteDiseaseScore: 0 });
  const score  = mustScore(v);
  const result = interpretMust(score);
  const selStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 12, padding: '5px 10px', borderRadius: 5, cursor: 'pointer',
    border: active ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
    background: active ? '#0f172a' : '#fff',
    color: active ? '#fff' : '#374151',
  });
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>BMI</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([{label:'>20 (healthy/overweight)',value:0},{label:'18.5–20',value:1},{label:'<18.5 (underweight)',value:2}] as const).map(o => (
            <button key={o.value} type="button" style={selStyle(v.bmiScore===o.value)} onClick={() => setV(p=>({...p,bmiScore:o.value}))}>{o.label}</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Unintentional weight loss in past 3–6 months</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {([{label:'<5%',value:0},{label:'5–10%',value:1},{label:'>10%',value:2}] as const).map(o => (
            <button key={o.value} type="button" style={selStyle(v.weightLossScore===o.value)} onClick={() => setV(p=>({...p,weightLossScore:o.value}))}>{o.label}</button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Acutely ill — no nutritional intake for &gt;5 days?</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {([{label:'No',value:0},{label:'Yes (add 2 points)',value:2}] as const).map(o => (
            <button key={o.value} type="button" style={selStyle(v.acuteDiseaseScore===o.value)} onClick={() => setV(p=>({...p,acuteDiseaseScore:o.value}))}>{o.label}</button>
          ))}
        </div>
      </div>
      <ScoreRow label="MUST total" value={score} />
      <ResultBadge result={result} />
    </div>
  );
}

// ── Caprini VTE card ──────────────────────────────────────────────────────────

const CAPRINI_FACTORS: { field: keyof CapriniInputs; label: string; pts: number }[] = [
  // 1-point
  { field: 'age41_60',              label: 'Age 41–60',                             pts: 1 },
  { field: 'minorSurgery',          label: 'Minor surgery planned',                 pts: 1 },
  { field: 'bmi25',                 label: 'BMI >25',                               pts: 1 },
  { field: 'swollenLegs',           label: 'Swollen legs (current)',                pts: 1 },
  { field: 'varicoseVeins',         label: 'Varicose veins',                        pts: 1 },
  { field: 'pregnancy_postpartum',  label: 'Pregnancy or postpartum (<1 month)',    pts: 1 },
  { field: 'ocp_hrt',               label: 'OCP or HRT',                            pts: 1 },
  { field: 'sepsis_3m',             label: 'Sepsis in past 3 months',               pts: 1 },
  { field: 'seriousLungDisease',    label: 'Serious lung disease (pneumonia/COPD)', pts: 1 },
  { field: 'abnormalPfts',          label: 'Abnormal pulmonary function',           pts: 1 },
  { field: 'acuteMI',               label: 'Acute myocardial infarction',           pts: 1 },
  { field: 'chf',                   label: 'Congestive heart failure',              pts: 1 },
  { field: 'ibd',                   label: 'Inflammatory bowel disease',            pts: 1 },
  { field: 'conservativelyManaged', label: 'Medical patient at bed rest',           pts: 1 },
  // 2-point
  { field: 'age61_74',              label: 'Age 61–74',                             pts: 2 },
  { field: 'arthroscopy',           label: 'Arthroscopic surgery',                  pts: 2 },
  { field: 'malignancy',            label: 'Malignancy (present or previous)',      pts: 2 },
  { field: 'majorSurgery60m',       label: 'Major surgery (>45 min) in past 60 days', pts: 2 },
  { field: 'laparoscopy60m',        label: 'Laparoscopic surgery >45 min',          pts: 2 },
  { field: 'bedRest3d',             label: 'Confined to bed >72h',                  pts: 2 },
  { field: 'immobilisingCast',      label: 'Immobilising plaster cast',             pts: 2 },
  { field: 'centralVenousAccess',   label: 'Central venous access',                 pts: 2 },
  // 3-point
  { field: 'age75plus',             label: 'Age ≥75',                               pts: 3 },
  { field: 'vteHistory',            label: 'History of DVT / PE',                   pts: 3 },
  { field: 'familyHistoryVte',      label: 'Family history of VTE',                 pts: 3 },
  { field: 'factorVLeiden',         label: 'Factor V Leiden',                       pts: 3 },
  { field: 'prothrombinG20210a',    label: 'Prothrombin G20210A mutation',          pts: 3 },
  { field: 'lupusAnticoagulant',    label: 'Lupus anticoagulant',                   pts: 3 },
  { field: 'elevatedAntiphospholipid', label: 'Elevated anticardiolipin antibody',  pts: 3 },
  { field: 'homocysteine',          label: 'Elevated serum homocysteine',           pts: 3 },
  { field: 'hepInducedThrombocytopenia', label: 'HIT (heparin-induced thrombocytopenia)', pts: 3 },
  { field: 'otherCongenitalThrombophilia', label: 'Other congenital thrombophilia', pts: 3 },
  // 5-point
  { field: 'strokeUnder1m',         label: 'Stroke (<1 month)',                     pts: 5 },
  { field: 'electiveLowerExtremityArthroplasty', label: 'Elective lower limb arthroplasty', pts: 5 },
  { field: 'hipPelvicFracture',     label: 'Hip, pelvis or leg fracture',           pts: 5 },
  { field: 'acuteSpinalCordInjury', label: 'Acute spinal cord injury',              pts: 5 },
  { field: 'multipleTrauma',        label: 'Multiple trauma (<1 month)',            pts: 5 },
];

const EMPTY_CAPRINI = Object.fromEntries(
  CAPRINI_FACTORS.map(f => [f.field, false])
) as unknown as CapriniInputs;

function CapriniCard() {
  const [v, setV] = useState<CapriniInputs>(EMPTY_CAPRINI);
  const score  = capriniScore(v);
  const result = interpretCaprini(score);
  const grouped = [1, 2, 3, 5].map(pts => CAPRINI_FACTORS.filter(f => f.pts === pts));

  return (
    <div>
      {grouped.map((group, gi) => (
        <div key={gi} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>
            {group[0].pts}-POINT RISK FACTOR{group[0].pts === 1 ? '' : 'S'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 4 }}>
            {group.map(f => (
              <Chk
                key={f.field}
                label={f.label}
                pts={f.pts}
                checked={v[f.field]}
                onChange={() => setV(p => ({ ...p, [f.field]: !p[f.field] }))}
              />
            ))}
          </div>
        </div>
      ))}
      <ScoreRow label="Caprini score" value={score} />
      <ResultBadge result={result} />
    </div>
  );
}

// ── STOP-BANG Card ────────────────────────────────────────────────────────────

function StopBangCard() {
  const [v, setV] = useState<StopBangInputs>({
    snoring: false, tired: false, observed: false, pressure: false,
    bmiAbove35: false, ageAbove50: false, neckAbove40: false, genderMale: false,
  });
  const score = stopBangScore(v);
  const result = interpretStopBang(score);
  const tog = (k: keyof StopBangInputs) => setV(p => ({ ...p, [k]: !p[k] }));
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>STOP</div>
      <Chk label="Snoring — do you snore loudly (heard through closed door)?" checked={v.snoring} onChange={() => tog('snoring')} />
      <Chk label="Tired — often feel tired, fatigued, or sleepy during daytime?" checked={v.tired} onChange={() => tog('tired')} />
      <Chk label="Observed — anyone observed you stop breathing / choking in sleep?" checked={v.observed} onChange={() => tog('observed')} />
      <Chk label="Pressure — do you have or are you being treated for high blood pressure?" checked={v.pressure} onChange={() => tog('pressure')} />
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', margin: '10px 0 6px' }}>BANG</div>
      <Chk label="BMI > 35 kg/m²" checked={v.bmiAbove35} onChange={() => tog('bmiAbove35')} />
      <Chk label="Age > 50 years" checked={v.ageAbove50} onChange={() => tog('ageAbove50')} />
      <Chk label="Neck circumference > 40 cm" checked={v.neckAbove40} onChange={() => tog('neckAbove40')} />
      <Chk label="Gender = Male" checked={v.genderMale} onChange={() => tog('genderMale')} />
      <ScoreRow label="STOP-BANG Score" value={`${score}/8`} />
      <ResultBadge result={result} />
    </div>
  );
}

// ── Clinical Frailty Scale Card ───────────────────────────────────────────────

function CfsCard() {
  const [level, setLevel] = useState<number>(1);
  const result = interpretCfs(level);
  const current = CFS_LEVELS.find(l => l.level === level)!;
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {CFS_LEVELS.map(l => (
          <button key={l.level} onClick={() => setLevel(l.level)} style={{
            minWidth: 36, padding: '5px 10px', borderRadius: 6,
            border: '1px solid #d1d5db',
            background: level === l.level ? '#1d4ed8' : '#fff',
            color: level === l.level ? '#fff' : '#374151',
            fontWeight: level === l.level ? 700 : 400,
            cursor: 'pointer', fontSize: 13,
          }}>
            {l.level}
          </button>
        ))}
      </div>
      <div style={{ marginBottom: 4, fontWeight: 600, fontSize: 14 }}>CFS {level} — {current.label}</div>
      <p style={{ fontSize: 13, color: '#374151', margin: '0 0 8px' }}>{current.description}</p>
      <ResultBadge result={result} />
    </div>
  );
}

// ── ECOG Performance Status Card ──────────────────────────────────────────────

function EcogCard() {
  const [level, setLevel] = useState<number>(0);
  const result = interpretEcog(level);
  const current = ECOG_LEVELS.find(l => l.level === level)!;
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {ECOG_LEVELS.map(l => (
          <button key={l.level} onClick={() => setLevel(l.level)} style={{
            minWidth: 36, padding: '5px 10px', borderRadius: 6,
            border: '1px solid #d1d5db',
            background: level === l.level ? '#1d4ed8' : '#fff',
            color: level === l.level ? '#fff' : '#374151',
            fontWeight: level === l.level ? 700 : 400,
            cursor: 'pointer', fontSize: 13,
          }}>
            {l.level}
          </button>
        ))}
      </div>
      <div style={{ marginBottom: 4, fontWeight: 600, fontSize: 14 }}>ECOG {level} — {current.label}</div>
      <p style={{ fontSize: 13, color: '#374151', margin: '0 0 8px' }}>{current.description}</p>
      <ResultBadge result={result} />
    </div>
  );
}

// ── Shared Likert row ─────────────────────────────────────────────────────────

function LikertRow({ qNum, text, value, opts, onChange }: {
  qNum: number; text: string; value: number;
  opts: readonly string[]; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>
        <span style={{ fontWeight: 700, marginRight: 6, color: '#6b7280' }}>{qNum}.</span>{text}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {opts.map((opt, i) => (
          <button key={i} type="button" onClick={() => onChange(i)} style={{
            padding: '3px 10px', borderRadius: 12, cursor: 'pointer', fontSize: 11,
            border: value === i ? '1px solid #0d9488' : '1px solid #d1d5db',
            background: value === i ? '#0d9488' : '#f9fafb',
            color: value === i ? '#fff' : '#374151',
            fontWeight: value === i ? 600 : 400,
          }}>{opt}</button>
        ))}
      </div>
    </div>
  );
}

// ── PHQ-9 Card ────────────────────────────────────────────────────────────────

function Phq9Card() {
  const [answers, setAnswers] = useState<number[]>(Array(9).fill(0));
  const score = phq9Score(answers);
  const result = interpretPhq9(score);
  const q9Positive = answers[8] > 0;
  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
        Over the <strong>last 2 weeks</strong>, how often have you been bothered by the following problems?
      </div>
      {PHQ9_QUESTIONS.map((q, i) => (
        <LikertRow key={i} qNum={i + 1} text={q} value={answers[i]} opts={LIKERT_OPTS}
          onChange={v => setAnswers(a => a.map((x, j) => j === i ? v : x))} />
      ))}
      {q9Positive && (
        <div style={{ background: '#fff1f2', border: '1px solid #fca5a5', borderRadius: 6, padding: '8px 12px', marginBottom: 8, fontSize: 12, color: '#b91c1c', fontWeight: 600 }}>
          ⚠ Q9 positive — assess suicide risk immediately. Enquire directly about thoughts, intent, and plan.
        </div>
      )}
      <ScoreRow label="PHQ-9 Score" value={`${score}/27`} />
      <ResultBadge result={result} />
    </div>
  );
}

// ── GAD-7 Card ────────────────────────────────────────────────────────────────

function Gad7Card() {
  const [answers, setAnswers] = useState<number[]>(Array(7).fill(0));
  const score = gad7Score(answers);
  const result = interpretGad7(score);
  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
        Over the <strong>last 2 weeks</strong>, how often have you been bothered by the following problems?
      </div>
      {GAD7_QUESTIONS.map((q, i) => (
        <LikertRow key={i} qNum={i + 1} text={q} value={answers[i]} opts={LIKERT_OPTS}
          onChange={v => setAnswers(a => a.map((x, j) => j === i ? v : x))} />
      ))}
      <ScoreRow label="GAD-7 Score" value={`${score}/21`} />
      <ResultBadge result={result} />
    </div>
  );
}

// ── GERD-Q Card ───────────────────────────────────────────────────────────────

function GerdqCard() {
  const [answers, setAnswers] = useState<number[]>(Array(6).fill(0));
  const score = gerdqScore(answers);
  const result = interpretGerdq(score);
  return (
    <div>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>
        Thinking about the <strong>past week</strong>, how often did you experience the following?
      </div>
      {GERDQ_QUESTIONS.map((q, i) => (
        <div key={i}>
          <LikertRow qNum={i + 1} text={q.text} value={answers[i]} opts={GERDQ_FREQ_OPTS}
            onChange={v => setAnswers(a => a.map((x, j) => j === i ? v : x))} />
          {q.reversed && answers[i] > 0 && (
            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: -6, marginBottom: 6, paddingLeft: 18 }}>
              (Symptom reduces GORD likelihood)
            </div>
          )}
        </div>
      ))}
      <ScoreRow label="GERD-Q Score" value={`${score}/18`} />
      <ResultBadge result={result} />
    </div>
  );
}

// ── Child-Pugh Card ───────────────────────────────────────────────────────────

type CpParam = 1 | 2 | 3;
interface CpOpt { value: CpParam; label: string }

function CpRow({ label, opts, value, onChange }: { label: string; opts: CpOpt[]; value: CpParam; onChange: (v: CpParam) => void }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {opts.map(o => (
          <button key={o.value} type="button" onClick={() => onChange(o.value)} style={{
            padding: '3px 12px', borderRadius: 12, cursor: 'pointer', fontSize: 11,
            border: value === o.value ? '1px solid #0d9488' : '1px solid #d1d5db',
            background: value === o.value ? '#0d9488' : '#f9fafb',
            color: value === o.value ? '#fff' : '#374151',
            fontWeight: value === o.value ? 600 : 400,
          }}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

function ChildPughCard() {
  const [v, setV] = useState<ChildPughInputs>({
    bilirubin: 1, albumin: 1, inr: 1, ascites: 1, encephalopathy: 1,
  });
  const score = childPughScore(v);
  const result = interpretChildPugh(score);
  const set = (k: keyof ChildPughInputs) => (val: CpParam) => setV(p => ({ ...p, [k]: val }));
  return (
    <div>
      <CpRow label="Bilirubin" value={v.bilirubin} onChange={set('bilirubin')}
        opts={[{ value: 1, label: '< 34 µmol/L' }, { value: 2, label: '34–50 µmol/L' }, { value: 3, label: '> 50 µmol/L' }]} />
      <CpRow label="Albumin" value={v.albumin} onChange={set('albumin')}
        opts={[{ value: 1, label: '> 35 g/L' }, { value: 2, label: '28–35 g/L' }, { value: 3, label: '< 28 g/L' }]} />
      <CpRow label="INR" value={v.inr} onChange={set('inr')}
        opts={[{ value: 1, label: '< 1.7' }, { value: 2, label: '1.7–2.3' }, { value: 3, label: '> 2.3' }]} />
      <CpRow label="Ascites" value={v.ascites} onChange={set('ascites')}
        opts={[{ value: 1, label: 'Absent' }, { value: 2, label: 'Mild / controlled' }, { value: 3, label: 'Severe / refractory' }]} />
      <CpRow label="Hepatic encephalopathy" value={v.encephalopathy} onChange={set('encephalopathy')}
        opts={[{ value: 1, label: 'None' }, { value: 2, label: 'Grade I–II' }, { value: 3, label: 'Grade III–IV' }]} />
      <ScoreRow label="Child-Pugh score" value={`${score}/15`} />
      <ResultBadge result={result} />
    </div>
  );
}

// ── Apfel Card ────────────────────────────────────────────────────────────────

function ApfelCard() {
  const [v, setV] = useState<ApfelInputs>({
    femaleSex: false, nonSmoker: false,
    priorPonvOrMotionSickness: false, postopOpioids: false,
  });
  const score = apfelScore(v);
  const result = interpretApfel(score);
  const risk = APFEL_RISK[score];
  const tog = (k: keyof ApfelInputs) => setV(p => ({ ...p, [k]: !p[k] }));
  return (
    <div>
      <Chk label="Female sex" checked={v.femaleSex} onChange={() => tog('femaleSex')} pts={1} />
      <Chk label="Non-smoker" checked={v.nonSmoker} onChange={() => tog('nonSmoker')} pts={1} />
      <Chk label="Prior PONV or motion sickness" checked={v.priorPonvOrMotionSickness} onChange={() => tog('priorPonvOrMotionSickness')} pts={1} />
      <Chk label="Post-operative opioids anticipated" checked={v.postopOpioids} onChange={() => tog('postopOpioids')} pts={1} />
      <ScoreRow label="Apfel score" value={`${score}/4 — PONV risk ${risk?.label ?? '?'}`} />
      <ResultBadge result={result} />
    </div>
  );
}

// ── MELD Card ─────────────────────────────────────────────────────────────────

function MeldCard() {
  const [bilirubin, setBilirubin] = useState('');   // mg/dL
  const [inr, setInr] = useState('');
  const [creatinine, setCreatinine] = useState(''); // mg/dL
  const [sodium, setSodium] = useState('');          // mmol/L — for MELD-Na

  const bili = parseFloat(bilirubin);
  const inrVal = parseFloat(inr);
  const cr = parseFloat(creatinine);
  const na = parseFloat(sodium);
  const ready = !isNaN(bili) && !isNaN(inrVal) && !isNaN(cr) && bili > 0 && inrVal > 0 && cr > 0;

  const meld = ready ? meldScore(bili, inrVal, cr) : null;
  const meldNa = ready && !isNaN(na) && na > 0 ? meldNaScore(meld!, na) : null;
  const result = meld !== null ? interpretMeld(meld) : null;

  const inpStyle: React.CSSProperties = {
    border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 8px',
    fontSize: 13, width: '100%',
  };
  const lblStyle: React.CSSProperties = { fontSize: 12, color: '#6b7280', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
        <label style={lblStyle}>Bilirubin (mg/dL)
          <input style={inpStyle} type="number" min="0" step="0.1" value={bilirubin} onChange={e => setBilirubin(e.target.value)} placeholder="e.g. 1.2" />
        </label>
        <label style={lblStyle}>INR
          <input style={inpStyle} type="number" min="0" step="0.1" value={inr} onChange={e => setInr(e.target.value)} placeholder="e.g. 1.1" />
        </label>
        <label style={lblStyle}>Creatinine (mg/dL)
          <input style={inpStyle} type="number" min="0" step="0.1" value={creatinine} onChange={e => setCreatinine(e.target.value)} placeholder="e.g. 0.9" />
        </label>
        <label style={lblStyle}>Sodium (mmol/L) — for MELD-Na
          <input style={inpStyle} type="number" min="0" value={sodium} onChange={e => setSodium(e.target.value)} placeholder="e.g. 138 (optional)" />
        </label>
      </div>
      {meld !== null && (
        <>
          <ScoreRow label="MELD score" value={meld} />
          {meldNa !== null && <ScoreRow label="MELD-Na score" value={meldNa} />}
          <ResultBadge result={result!} />
        </>
      )}
      {meld === null && (
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>Enter bilirubin, INR, and creatinine to calculate.</div>
      )}
    </div>
  );
}

// ── Scale registry ────────────────────────────────────────────────────────────

const SCALE_COMPONENTS: Record<string, React.FC> = {
  news2:            News2Card,
  alvarado:         AlvaradoCard,
  heart:            HeartCard,
  wellsPe:          WellsPeCard,
  wellsDvt:         WellsDvtCard,
  abcd2:            Abcd2Card,
  tg18Cholangitis:  Tg18Card,
  asgeCbd:          AsgeCbdCard,
  wagner:           WagnerCard,
  curb65:           Curb65Card,
  glasgowBlatchford: GlasgowBlatchfordCard,
  preRockall:       PreRockallCard,
  rcri:             RcriCard,
  ranson:           RansonCard,
  ppossuml:         PpossumlCard,
  must:             MustCard,
  caprini:          CapriniCard,
  stopBang:         StopBangCard,
  cfs:              CfsCard,
  ecog:             EcogCard,
  phq9:             Phq9Card,
  gad7:             Gad7Card,
  gerdq:            GerdqCard,
  childPugh:        ChildPughCard,
  apfel:            ApfelCard,
  meld:             MeldCard,
};

const ALL_SCALE_TITLES: Record<string, string> = {
  news2:            'NEWS2 — Early Warning Score',
  alvarado:         'Alvarado Score — Appendicitis',
  heart:            'HEART Score — Chest Pain',
  wellsPe:          'Wells PE Score — Pulmonary Embolism',
  wellsDvt:         'Wells DVT Score — Deep Vein Thrombosis',
  abcd2:            'ABCD² Score — TIA Stroke Risk',
  tg18Cholangitis:  'TG18 Cholangitis Severity',
  asgeCbd:          'ASGE CBD Stone Probability',
  wagner:           'Wagner Classification — Diabetic Foot',
  curb65:           'CURB-65 — Pneumonia Severity',
  glasgowBlatchford: 'Glasgow-Blatchford — Upper GI Bleed',
  preRockall:       'Pre-endoscopy Rockall — GI Bleed Risk',
  rcri:             'RCRI — Pre-operative Cardiac Risk',
  ranson:           "Ranson's Criteria — Pancreatitis",
  ppossuml:         'P-POSSUM — Surgical Mortality / Morbidity Prediction',
  must:             'MUST — Malnutrition Universal Screening',
  caprini:          'Caprini VTE Risk Score — Thromboprophylaxis',
  stopBang:         'STOP-BANG — OSA Pre-operative Screening',
  cfs:              'Clinical Frailty Scale (CFS)',
  ecog:             'ECOG Performance Status',
  phq9:             'PHQ-9 — Depression Screening',
  gad7:             'GAD-7 — Generalised Anxiety Screening',
  gerdq:            'GERD-Q — Reflux Disease Questionnaire',
  childPugh:        'Child-Pugh Score — Liver Disease Surgical Risk',
  apfel:            'Apfel Score — PONV Risk (Pre-operative)',
  meld:             'MELD / MELD-Na — End-stage Liver Disease',
};

const URGENCY_LABELS: Record<string, { tag: string; color: string; bg: string }> = {
  urgent:   { tag: 'URGENT',   color: '#b91c1c', bg: '#fef2f2' },
  relevant: { tag: 'RELEVANT', color: '#b45309', bg: '#fffbeb' },
  consider: { tag: 'CONSIDER', color: '#1d4ed8', bg: '#eff6ff' },
};

// ── Main ScalesTab ────────────────────────────────────────────────────────────

export default function ScalesTab() {
  const ctx = useAppContext();
  const [showOthers, setShowOthers] = useState(false);

  const cdsCtx: CdsContext = useMemo(() => ({
    symptoms: ctx.symptoms,
    examFindings: ctx.examFindings,
    vitals: ctx.vitals,
    investigationResults: ctx.investigationResults,
    comorbidities: ctx.comorbidities,
    assessment: ctx.assessment,
    rosFindings: ctx.rosFindings,
    age: ctx.age,
    sex: ctx.sex,
    isPostOp: !!(ctx.procedureData as Record<string, unknown>)?.postOp,
    procedureData: ctx.procedureData as Record<string, unknown>,
  }), [ctx]);

  const suggestions = useMemo(() => getCdsSuggestions(cdsCtx), [cdsCtx]);
  const triggeredKeys = new Set(suggestions.map(s => s.scaleKey));
  const otherKeys = Object.keys(SCALE_COMPONENTS).filter(k => !triggeredKeys.has(k));

  const hasAnyClinicalData = ctx.symptoms.length > 0
    || Object.keys(ctx.examFindings).some(k => (ctx.examFindings[k] ?? []).length > 0)
    || Object.values(ctx.vitals).some(v => v && v.trim() !== '');

  return (
    <div style={{ maxWidth: 720 }}>

      {/* CDS banner */}
      {suggestions.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#ecfdf5', border: '1px solid #6ee7b7',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13,
        }}>
          <span style={{ fontSize: 18 }}>⚡</span>
          <span>
            <strong>{suggestions.length} scoring tool{suggestions.length !== 1 ? 's' : ''}</strong>
            {' '}suggested based on current clinical data — sorted by urgency
          </span>
        </div>
      )}

      {/* Suggested (triggered) tools */}
      {suggestions.map(s => {
        const ScaleComp = SCALE_COMPONENTS[s.scaleKey];
        if (!ScaleComp) return null;
        const u = URGENCY_LABELS[s.urgency] ?? URGENCY_LABELS.consider;
        return (
          <div key={s.scaleKey} style={{ marginBottom: 16, borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            {/* Urgency + category bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 14px', background: u.bg,
              borderBottom: `2px solid ${u.color}`,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 700,
                background: u.color, borderRadius: 4, padding: '2px 7px', color: '#fff',
              }}>{u.tag}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>{s.categoryTag}</span>
              {s.needsLabs && !s.labsPresent && (
                <span style={{
                  marginLeft: 'auto', fontSize: 11, fontWeight: 600,
                  color: '#92400e', background: '#fef3c7', padding: '2px 7px', borderRadius: 4,
                }}>Labs not yet entered</span>
              )}
            </div>
            {/* Trigger reason */}
            <div style={{ padding: '7px 14px', background: '#f9fafb', fontSize: 12, color: '#374151', borderBottom: '1px solid #f3f4f6' }}>
              ⚡ {s.triggerReason}
            </div>
            <CollapsibleCard title={s.title} defaultOpen>
              <ScaleComp />
            </CollapsibleCard>
          </div>
        );
      })}

      {/* Empty state */}
      {suggestions.length === 0 && !showOthers && (
        <div style={{
          textAlign: 'center', padding: '40px 24px',
          border: '1px dashed #d1d5db', borderRadius: 10,
          color: '#6b7280',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🩺</div>
          <h3 style={{ margin: '0 0 8px', color: '#374151' }}>No tools triggered yet</h3>
          <p style={{ margin: '0 0 16px', fontSize: 13 }}>
            Scoring tools surface automatically as you document symptoms, examination
            findings, and vital signs. Enter clinical data in the History, Examination,
            and Vitals tabs to see contextual suggestions appear here.
          </p>
          {!hasAnyClinicalData && (
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#9ca3af' }}>
              Start by entering the presenting complaint and vital signs.
            </p>
          )}
          <button
            onClick={() => setShowOthers(true)}
            style={{
              padding: '8px 18px', borderRadius: 6, border: '1px solid #d1d5db',
              background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}
          >
            Show all {Object.keys(SCALE_COMPONENTS).length} available tools
          </button>
        </div>
      )}

      {/* Toggle for non-triggered tools */}
      {suggestions.length > 0 && otherKeys.length > 0 && (
        <div style={{ marginTop: 8, marginBottom: 12 }}>
          <button
            onClick={() => setShowOthers(v => !v)}
            style={{
              padding: '6px 14px', borderRadius: 6, border: '1px solid #d1d5db',
              background: '#fff', cursor: 'pointer', fontSize: 13, color: '#6b7280',
            }}
          >
            {showOthers
              ? 'Hide other tools'
              : `Show other tools (${otherKeys.length} not currently triggered)`}
          </button>
        </div>
      )}

      {/* Non-triggered tools (collapsed by default) */}
      {showOthers && otherKeys.map(key => {
        const ScaleComp = SCALE_COMPONENTS[key];
        if (!ScaleComp) return null;
        return (
          <CollapsibleCard key={key} title={ALL_SCALE_TITLES[key]} defaultOpen={false}>
            <ScaleComp />
          </CollapsibleCard>
        );
      })}
    </div>
  );
}
