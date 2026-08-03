// ─── K81-0.ts — Acute Cholecystitis ──────────────────────────────────────────
//
// 360° Clinical Intelligence Profile
// ICD-10: K81.0 | SNOMED CT: 65275009
// Severity: Tokyo Guidelines TG18
//
// Completes the acute biliary triad alongside K83.1 (Obstructive Jaundice).
// The critical view of safety (CVS) is the surgical goal;
// the Tokyo Grade is the clinical compass.
//
// "ONE PATIENT · ONE RECORD · MANY FRAGMENTS · ONE LANGUAGE · LIMITLESS CLARITY"

import type { ClinicalFact, LabResultValue, VitalValue, DiagnosisValue } from '../types.js';
import type { PathologyProfile, AxisScorerFn } from '../pathology-profile.js';
import { latestLab, latestVital, clamp, scoreLabel } from '../axis-scorer.js';

// ─── Detect helpers (used inside BISAP/Tokyo criterion detect() functions) ────

function lab(facts: ClinicalFact[], name: string): number | null {
  const hits = facts
    .filter(f => f.factType === 'lab_result' && f.status !== 'refuted')
    .filter(f => (f.value as LabResultValue).testName.toLowerCase().includes(name.toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (!hits.length) return null;
  const v = hits[0].value as LabResultValue;
  return typeof v.result === 'number' ? v.result : parseFloat(String(v.result));
}

function vital(facts: ClinicalFact[], param: string): number | null {
  const hit = facts
    .filter(f => f.factType === 'vital' && f.status !== 'refuted')
    .filter(f => (f.value as VitalValue).parameter === param)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return hit ? (hit.value as VitalValue).numericValue : null;
}

// ─── K81.0 Axis scorer functions (13, index-matched to profile.axes) ─────────

const score1_Anatomy: AxisScorerFn = (facts) => {
  const evidence: string[] = [];
  let score = 10;

  const imaging = facts.filter(f =>
    (f.factType === 'imaging_result' || f.factType === 'investigation_order') &&
    f.status !== 'refuted',
  );
  if (imaging.length) { score = 40; evidence.push(`${imaging.length} imaging study(ies) documented`); }

  const confirmed = imaging.filter(f => f.status === 'confirmed' || f.status === 'active');
  if (confirmed.length) { score = Math.max(score, 70); evidence.push('Cholecystitis confirmed on imaging'); }

  const wallThick = latestLab(facts, 'GB wall') ?? latestLab(facts, 'gallbladder wall');
  if (wallThick) {
    evidence.push(wallThick.label);
    if (wallThick.value >= 4)  { score = Math.max(score, 80); evidence.push('GB wall ≥ 4 mm (TG18 C criterion)'); }
    if (wallThick.value >= 7)  { score = Math.max(score, 95); evidence.push('GB wall ≥ 7 mm — severe thickening'); }
  }

  return { score: clamp(score), target: 10, riskThreshold: 60, label: scoreLabel(score), evidence };
};

const score2_Etiology: AxisScorerFn = (facts) => {
  const evidence: string[] = [];
  let score = 20;

  const dx = facts
    .filter(f => f.factType === 'diagnosis' && f.status !== 'refuted')
    .map(f => f.value as DiagnosisValue);

  if (!dx.length) {
    score = 30;
    evidence.push('No confirmed diagnosis — etiology undetermined');
  } else {
    dx.forEach(d => {
      evidence.push(`Dx: ${d.name} (${d.certainty})`);
      if (d.certainty === 'confirmed') score = Math.max(score, 65);
      else if (d.certainty === 'probable') score = Math.max(score, 45);
      else score = Math.max(score, 30);
      // Acalculous cholecystitis and gangrenous carry higher mortality
      const name = d.name.toLowerCase();
      if (name.includes('acalculous') || name.includes('gangrenous') || name.includes('empyema')) {
        score = Math.max(score, 80);
        evidence.push('High-risk variant (acalculous/gangrenous/empyema)');
      }
    });
  }

  return { score: clamp(score), target: 20, riskThreshold: 70, label: scoreLabel(score), evidence };
};

const score3_Inflammation: AxisScorerFn = (facts) => {
  const evidence: string[] = [];
  let score = 0;

  const wbc = latestLab(facts, 'WBC') ?? latestLab(facts, 'white blood cell') ?? latestLab(facts, 'leucocyte');
  if (wbc) {
    evidence.push(wbc.label);
    if (wbc.value > 10)  score += 25;   // TG18 B criterion
    if (wbc.value > 15)  score += 15;
    if (wbc.value > 18)  score += 15;   // TG18 Grade II marker
    if (wbc.value > 25)  score += 15;
  }

  const crp = latestLab(facts, 'CRP') ?? latestLab(facts, 'C-reactive');
  if (crp) {
    evidence.push(crp.label);
    if (crp.value > 30)  score += 20;   // TG18 B criterion (> 3 mg/dL = 30 mg/L)
    if (crp.value > 100) score += 10;
    if (crp.value > 150) score += 10;
  }

  if (!wbc && !crp) { score = 15; evidence.push('Inflammatory markers not recorded'); }

  return { score: clamp(score), target: 0, riskThreshold: 40, label: scoreLabel(score), evidence };
};

const score4_SystemicResponse: AxisScorerFn = (facts) => {
  const evidence: string[] = [];
  let sirsCount = 0;

  const temp = latestVital(facts, 'temperatureC');
  if (temp) {
    evidence.push(temp.label);
    if (temp.value > 38 || temp.value < 36) { sirsCount++; evidence.push('SIRS: fever / hypothermia'); }
  }

  const hr = latestVital(facts, 'heartRate');
  if (hr) {
    evidence.push(hr.label);
    if (hr.value > 90) { sirsCount++; evidence.push('SIRS: tachycardia > 90'); }
  }

  const rr = latestVital(facts, 'respiratoryRate');
  if (rr) {
    evidence.push(rr.label);
    if (rr.value > 20) { sirsCount++; evidence.push('SIRS: tachypnoea > 20'); }
  }

  const wbc = latestLab(facts, 'WBC') ?? latestLab(facts, 'white blood cell');
  if (wbc) {
    if (wbc.value > 12 || wbc.value < 4) { sirsCount++; evidence.push('SIRS: WBC criterion'); }
  }

  const score = clamp(sirsCount * 25);
  if (sirsCount === 0) evidence.push('No SIRS criteria met');

  return { score, target: 0, riskThreshold: 50, label: scoreLabel(score), evidence };
};

const score5_TokyoGrade: AxisScorerFn = (facts) => {
  const evidence: string[] = [];

  const tempVal  = vital(facts, 'temperatureC');
  const hrVal    = vital(facts, 'heartRate');
  const sbpVal   = vital(facts, 'systolicBp');
  const spo2Val  = vital(facts, 'spo2');
  const wbcVal   = lab(facts, 'WBC') ?? lab(facts, 'white blood cell');
  const crpVal   = lab(facts, 'CRP') ?? lab(facts, 'C-reactive');
  const creatVal = lab(facts, 'creatinine');
  const biliVal  = lab(facts, 'bilirubin');
  const inrVal   = lab(facts, 'INR');
  const platVal  = lab(facts, 'platelet');

  // Tokyo Grade III — any organ dysfunction
  const gradeIIICriteria: string[] = [];
  if (sbpVal !== null && sbpVal < 90) gradeIIICriteria.push('Hypotension (SBP < 90)');
  if (spo2Val !== null && spo2Val < 95) gradeIIICriteria.push('Respiratory: SpO2 < 95%');
  if (creatVal !== null && creatVal > 177) gradeIIICriteria.push('Renal: creatinine > 177 μmol/L');
  if (biliVal !== null && biliVal > 34) gradeIIICriteria.push('Hepatic: bilirubin > 34 μmol/L');
  if (inrVal !== null && inrVal > 1.5) gradeIIICriteria.push('Coagulopathy: INR > 1.5');
  if (platVal !== null && platVal < 100) gradeIIICriteria.push('Haematological: platelets < 100');

  if (gradeIIICriteria.length > 0) {
    gradeIIICriteria.forEach(c => evidence.push(`Grade III — ${c}`));
    return { score: 90, target: 0, riskThreshold: 70, label: 'Critical', evidence };
  }

  // Tokyo Grade II — moderate
  const gradeIICriteria: string[] = [];
  if (wbcVal !== null && wbcVal > 18) gradeIICriteria.push('WBC > 18,000');
  if (crpVal !== null && crpVal > 100) gradeIICriteria.push('CRP > 100 mg/L — marked inflammation');

  // Duration > 72h would be Grade II — approximated from symptom onset date
  const sympFacts = facts.filter(f => f.factType === 'symptom' && f.status !== 'refuted');
  if (sympFacts.length) {
    const oldest = sympFacts.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    const hours = (Date.now() - new Date(oldest.createdAt).getTime()) / 3_600_000;
    if (hours > 72) gradeIICriteria.push(`Duration > 72h (≈${Math.round(hours)}h recorded)`);
  }

  if (gradeIICriteria.length > 0) {
    gradeIICriteria.forEach(c => evidence.push(`Grade II — ${c}`));
    return { score: 60, target: 0, riskThreshold: 50, label: 'Severe', evidence };
  }

  // Tokyo Grade I — mild, meets A or B criteria
  const gradeI: string[] = [];
  if (tempVal !== null && tempVal > 38) gradeI.push('Fever > 38°C (B criterion)');
  if (wbcVal !== null && wbcVal > 10)  gradeI.push('WBC > 10,000 (B criterion)');
  if (crpVal !== null && crpVal > 30)  gradeI.push('CRP > 30 mg/L (B criterion)');

  if (gradeI.length > 0) {
    gradeI.forEach(c => evidence.push(`Grade I — ${c}`));
    return { score: 30, target: 0, riskThreshold: 50, label: 'Mild', evidence };
  }

  evidence.push('Insufficient criteria to grade — more data needed');
  return { score: 15, target: 0, riskThreshold: 50, label: 'None', evidence };
};

const score6_LocalComplication: AxisScorerFn = (facts) => {
  const evidence: string[] = [];
  let score = 0;

  const dx = facts
    .filter(f => f.factType === 'diagnosis' && f.status !== 'refuted')
    .map(f => f.value as DiagnosisValue);

  dx.forEach(d => {
    const name = d.name.toLowerCase();
    if (name.includes('empyema'))      { score += 40; evidence.push('Empyema of gallbladder'); }
    if (name.includes('gangrenous') || name.includes('gangrene')) {
      score += 55; evidence.push('Gangrenous cholecystitis — surgical emergency');
    }
    if (name.includes('perforat'))     { score += 70; evidence.push('GB perforation — peritonitis risk'); }
    if (name.includes('abscess'))      { score += 45; evidence.push('Pericholecystic abscess'); }
    if (name.includes('emphysematous')){ score += 75; evidence.push('Emphysematous cholecystitis — gas-forming'); }
  });

  const imaging = facts.filter(f => f.factType === 'imaging_result' && f.status !== 'refuted');
  if (!imaging.length && score === 0) {
    score = 10;
    evidence.push('Local complication status unknown — CT not yet performed');
  }

  if (score === 0) evidence.push('No local complications identified on imaging');

  return { score: clamp(score), target: 0, riskThreshold: 50, label: scoreLabel(score), evidence };
};

const score7_SystemicImpact: AxisScorerFn = (facts) => {
  const evidence: string[] = [];
  let score = 0;

  const creat = latestLab(facts, 'creatinine');
  if (creat) {
    evidence.push(creat.label);
    if (creat.value > 100) score += 15;
    if (creat.value > 177) { score += 25; evidence.push('Tokyo III: renal dysfunction'); }
  }

  const bili = latestLab(facts, 'bilirubin');
  if (bili) {
    evidence.push(bili.label);
    if (bili.value > 17) score += 10;
    if (bili.value > 34) { score += 20; evidence.push('Tokyo III: hepatic dysfunction'); }
  }

  const inr = latestLab(facts, 'INR');
  if (inr) {
    evidence.push(inr.label);
    if (inr.value > 1.2) score += 10;
    if (inr.value > 1.5) { score += 20; evidence.push('Coagulopathy — Tokyo III criterion'); }
  }

  const sbp = latestVital(facts, 'systolicBp');
  if (sbp) {
    evidence.push(sbp.label);
    if (sbp.value < 100) score += 15;
    if (sbp.value < 90)  { score += 20; evidence.push('Hypotension — Tokyo III: cardiovascular'); }
  }

  if (!creat && !bili && !inr && !sbp) {
    score = 10;
    evidence.push('Organ function markers not recorded');
  }

  return { score: clamp(score), target: 0, riskThreshold: 40, label: scoreLabel(score), evidence };
};

const score8_Temporal: AxisScorerFn = (facts) => {
  const evidence: string[] = [];
  let score = 20;

  const sympFacts = facts.filter(f => f.factType === 'symptom' && f.status !== 'refuted');
  if (sympFacts.length) {
    const oldest = sympFacts.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    const hours = (Date.now() - new Date(oldest.createdAt).getTime()) / 3_600_000;
    evidence.push(`Symptoms first recorded ≈ ${Math.round(hours)}h ago`);
    if (hours > 24)  { score = 40; evidence.push('> 24h — early cholecystitis window closing'); }
    if (hours > 72)  { score = 65; evidence.push('> 72h — Tokyo Grade II temporal criterion met'); }
    if (hours > 168) { score = 80; evidence.push('> 1 week — risk of gangrenous change increases'); }
  } else {
    evidence.push('Symptom onset time not recorded');
  }

  return { score: clamp(score), target: 10, riskThreshold: 55, label: scoreLabel(score), evidence };
};

const score9_Response: AxisScorerFn = (facts) => {
  const evidence: string[] = [];

  const wbcResults = facts
    .filter(f => f.factType === 'lab_result' && f.status !== 'refuted')
    .filter(f => {
      const name = (f.value as LabResultValue).testName.toLowerCase();
      return name.includes('wbc') || name.includes('white blood') || name.includes('leucocyte');
    })
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

  if (wbcResults.length >= 2) {
    const first = wbcResults[0].value as LabResultValue;
    const last  = wbcResults[wbcResults.length - 1].value as LabResultValue;
    const f0 = typeof first.result === 'number' ? first.result : parseFloat(String(first.result));
    const f1 = typeof last.result  === 'number' ? last.result  : parseFloat(String(last.result));

    if (f1 < f0 * 0.8) {
      evidence.push(`WBC falling: ${f0} → ${f1} — responding to treatment`);
      return { score: 20, target: 10, riskThreshold: 50, label: 'None', evidence };
    }
    if (f1 > f0 * 1.1) {
      evidence.push(`WBC rising: ${f0} → ${f1} — not responding, reassess`);
      return { score: 75, target: 10, riskThreshold: 50, label: 'Severe', evidence };
    }
    evidence.push(`WBC stable: ${f0} → ${f1}`);
    return { score: 45, target: 10, riskThreshold: 50, label: 'Moderate', evidence };
  }

  evidence.push('Insufficient serial WBC results to assess response');
  return { score: 50, target: 10, riskThreshold: 50, label: 'Moderate', evidence };
};

const score10_SurgicalRisk: AxisScorerFn = (facts) => {
  const evidence: string[] = [];
  let score = 20;

  // Age proxy — look for anthropometric or demographic facts
  // In absence of DOB, use comorbidities as a proxy
  const comorbidities = facts.filter(f => {
    if (f.factType !== 'diagnosis' || f.status === 'refuted') return false;
    const icd = ((f.value as DiagnosisValue).icd10 ?? '').toUpperCase();
    return icd.startsWith('I') || icd.startsWith('E') || icd.startsWith('J44') || icd.startsWith('N');
  });

  if (comorbidities.length >= 1) {
    score += comorbidities.length * 10;
    evidence.push(`${comorbidities.length} significant comorbidity(ies) (cardiac/metabolic/pulmonary/renal)`);
  }

  // Haemodynamic instability
  const sbp = latestVital(facts, 'systolicBp');
  if (sbp) {
    if (sbp.value < 100) { score += 20; evidence.push('Haemodynamic instability — increased operative risk'); }
    if (sbp.value < 90)  { score += 20; evidence.push('Hypotension — emergency procedure risk'); }
  }

  // Severe inflammation = harder laparoscopic dissection
  const wbc = latestLab(facts, 'WBC') ?? latestLab(facts, 'white blood cell');
  if (wbc && wbc.value > 18) { score += 10; evidence.push('Severe leucocytosis — difficult tissue planes'); }

  if (score <= 20) evidence.push('No major surgical risk factors identified');

  return { score: clamp(score), target: 20, riskThreshold: 55, label: scoreLabel(score), evidence };
};

const score11_DiagnosticConfidence: AxisScorerFn = (facts) => {
  const evidence: string[] = [];
  let criteria = 0;

  // TG18 A criteria — local signs
  const murphySign = facts.filter(f =>
    f.factType === 'symptom' &&
    String(f.value).toLowerCase().includes('murphy'),
  );
  if (murphySign.length) { criteria++; evidence.push('TG18-A: Murphy\'s sign documented'); }

  // TG18 B criteria — systemic signs
  const temp = latestVital(facts, 'temperatureC');
  if (temp && temp.value > 38) { criteria++; evidence.push('TG18-B: Fever > 38°C'); }

  const wbc = latestLab(facts, 'WBC') ?? latestLab(facts, 'white blood cell');
  if (wbc && wbc.value > 10) { criteria++; evidence.push('TG18-B: WBC > 10,000/μL'); }

  const crp = latestLab(facts, 'CRP') ?? latestLab(facts, 'C-reactive');
  if (crp && crp.value > 30) { criteria++; evidence.push('TG18-B: CRP > 30 mg/L'); }

  // TG18 C criteria — imaging confirmation
  const imaging = facts.filter(f => f.factType === 'imaging_result' && f.status !== 'refuted');
  if (imaging.length) { criteria++; evidence.push('TG18-C: Imaging obtained'); }
  const confirmedImaging = imaging.filter(f => f.status === 'confirmed' || f.status === 'active');
  if (confirmedImaging.length) { criteria++; evidence.push('TG18-C: Imaging confirms cholecystitis'); }

  const score = clamp(criteria * 15);
  if (!criteria) evidence.push('No TG18 diagnostic criteria documented');

  return { score, target: 90, riskThreshold: 35, label: scoreLabel(score), evidence };
};

const score12_Therapeutic: AxisScorerFn = (facts) => {
  const evidence: string[] = [];

  const tasks = facts.filter(f => f.factType === 'task' && f.status !== 'refuted');
  const completed = tasks.filter(f => f.status === 'completed');
  const procedures = facts.filter(f => f.factType === 'procedure' && f.status !== 'refuted');
  const followUps  = facts.filter(f => f.factType === 'follow_up' && f.status !== 'refuted');

  const total = tasks.length + procedures.length + followUps.length;
  const done  = completed.length + procedures.filter(f => f.status === 'completed').length;

  if (total === 0) {
    evidence.push('No management steps documented');
    return { score: 10, target: 90, riskThreshold: 30, label: scoreLabel(10), evidence };
  }

  const pct = Math.round((done / total) * 100);
  evidence.push(`${done}/${total} management steps completed`);
  if (procedures.length) evidence.push(`${procedures.length} procedure(s) recorded`);
  if (followUps.length)  evidence.push(`${followUps.length} follow-up(s) planned`);

  return { score: clamp(pct), target: 90, riskThreshold: 30, label: scoreLabel(pct), evidence };
};

const score13_Uncertainty: AxisScorerFn = (facts) => {
  const evidence: string[] = [];
  let score = 0;

  const pending = facts.filter(f => f.status === 'pending');
  if (pending.length) { score += pending.length * 10; evidence.push(`${pending.length} pending result(s)`); }

  const suspected = facts.filter(f => f.status === 'suspected');
  if (suspected.length) { score += suspected.length * 10; evidence.push(`${suspected.length} suspected finding(s)`); }

  const aiUnverified = facts.filter(f =>
    (f.source === 'ai_extracted' || f.source === 'ai_suggested') && f.status !== 'confirmed',
  );
  if (aiUnverified.length) { score += aiUnverified.length * 8; evidence.push(`${aiUnverified.length} AI fact(s) unverified`); }

  const workingDx = facts.filter(f =>
    f.factType === 'diagnosis' && (f.value as DiagnosisValue).certainty === 'working',
  );
  if (workingDx.length) { score += 15; evidence.push(`${workingDx.length} working diagnosis(es) unconfirmed`); }

  if (score === 0) evidence.push('No significant uncertainty gaps identified');

  return { score: clamp(score), target: 0, riskThreshold: 40, label: scoreLabel(score), evidence };
};

// ─── Profile ──────────────────────────────────────────────────────────────────

export const K81_0: PathologyProfile = {
  icd10:    'K81.0',
  snomed:   '65275009',
  name:     'Acute Cholecystitis',
  subtitle: '360° Clinical Intelligence Model — Tokyo Guidelines TG18',
  definition:
    'Acute inflammation of the gallbladder, most commonly due to obstruction of the cystic duct by gallstones, leading to distension, ischaemia, and bacterial superinfection.',

  anatomyAtRisk: [
    { label: 'Gallbladder body',         color: '#60a5fa' },
    { label: "GB neck / Hartmann's",     color: '#34d399' },
    { label: 'Cystic duct',              color: '#a78bfa' },
    { label: 'Common hepatic duct',      color: '#fb923c' },
    { label: 'Liver bed (segments IV/V)', color: '#f87171' },
    { label: 'Hepatoduodenal ligament',  color: '#fbbf24' },
  ],

  // ── 13 Axes ─────────────────────────────────────────────────────────────────

  axes: [
    {
      id: 1, name: 'ANATOMY', subtitle: 'LOCATION', question: 'Where?',
      color: '#60a5fa',
      description: 'Gallbladder wall, pericholecystic space, and CBD: imaging-confirmed anatomy of disease.',
      factTypes: ['imaging_result', 'investigation_order'],
    },
    {
      id: 2, name: 'ETIOLOGY', subtitle: 'CAUSE', question: 'Why?',
      color: '#34d399',
      description: 'Calculous (gallstones) vs acalculous, empyema, Mirizzi syndrome, or tumour compression.',
      factTypes: ['diagnosis', 'imaging_result', 'pathology_result'],
    },
    {
      id: 3, name: 'INFLAMMATION', subtitle: 'SEVERITY', question: 'How inflamed?',
      color: '#a78bfa',
      description: 'WBC and CRP elevation reflecting the histological degree of gallbladder wall inflammation.',
      factTypes: ['lab_result'],
    },
    {
      id: 4, name: 'SYSTEMIC RESPONSE', subtitle: 'SIRS', question: 'Is the body reacting?',
      color: '#f87171',
      description: 'SIRS criteria: fever, tachycardia, tachypnoea, WBC count — quantifying systemic response.',
      factTypes: ['vital', 'lab_result'],
    },
    {
      id: 5, name: 'TOKYO GRADE', subtitle: 'TG18 SEVERITY', question: 'Grade I / II / III?',
      color: '#fb923c',
      description: 'Tokyo Guidelines 2018 severity grade: I (mild), II (moderate), III (organ dysfunction).',
      factTypes: ['lab_result', 'vital', 'symptom'],
    },
    {
      id: 6, name: 'LOCAL COMPLICATION', subtitle: 'GANGRENE/PERF', question: 'Any local emergency?',
      color: '#fbbf24',
      description: 'Empyema, gangrenous cholecystitis, GB perforation, or pericholecystic abscess.',
      factTypes: ['imaging_result', 'diagnosis'],
    },
    {
      id: 7, name: 'SYSTEMIC IMPACT', subtitle: 'ORGAN FUNCTION', question: 'What organs are affected?',
      color: '#f97316',
      description: 'Renal, hepatic, cardiovascular, and haematological dysfunction — Tokyo Grade III markers.',
      factTypes: ['lab_result', 'vital'],
    },
    {
      id: 8, name: 'TEMPORAL', subtitle: 'TIME COURSE', question: 'When did this start?',
      color: '#4ade80',
      description: 'Duration of symptoms — > 72h is a Tokyo Grade II criterion and alters surgical timing.',
      factTypes: ['symptom', 'diagnosis'],
    },
    {
      id: 9, name: 'RESPONSE', subtitle: 'TREATMENT TREND', question: 'Is it responding?',
      color: '#22d3ee',
      description: 'Serial WBC and temperature trend after antibiotics and NBM — guides surgery timing.',
      factTypes: ['lab_result', 'vital', 'task'],
    },
    {
      id: 10, name: 'SURGICAL RISK', subtitle: 'OPERATIVE FITNESS', question: 'How safe is surgery?',
      color: '#f472b6',
      description: 'ASA grade proxied from comorbidities, haemodynamic stability, and inflammation severity.',
      factTypes: ['diagnosis', 'vital', 'lab_result'],
    },
    {
      id: 11, name: 'DIAGNOSTIC', subtitle: 'TG18 CRITERIA', question: 'How certain are we?',
      color: '#818cf8',
      description: 'TG18 A (local signs) + B (systemic signs) + C (imaging) criteria satisfied.',
      factTypes: ['lab_result', 'imaging_result', 'diagnosis', 'vital'],
    },
    {
      id: 12, name: 'THERAPEUTIC', subtitle: 'MANAGEMENT PATH', question: 'What has been done?',
      color: '#2dd4bf',
      description: 'Completeness of the pathway: resuscitation → imaging → grade → operate/drain → monitor.',
      factTypes: ['task', 'procedure', 'investigation_order', 'follow_up'],
    },
    {
      id: 13, name: 'UNCERTAINTY', subtitle: 'UNKNOWN / GAPS', question: "What don't we know?",
      color: '#94a3b8',
      description: 'Pending imaging, unverified AI facts, unconfirmed grade, calculous vs acalculous unclear.',
      factTypes: ['investigation_order', 'diagnosis', 'task'],
    },
  ],

  // ── DDx Convergence Map ──────────────────────────────────────────────────────

  differentials: [
    {
      name: 'Choledocholithiasis',
      icd10: 'K80.5',
      color: '#fb923c',
      discriminatingFeatures: [
        'Jaundice (conjugated) + RUQ pain',
        'ALP / GGT markedly elevated',
        'CBD dilated on USS (> 8 mm)',
        'Bilirubin > 34 μmol/L',
      ],
      keyFindings: [
        'USS / MRCP: stone in CBD',
        'Responds to ERCP stone extraction',
        'Charcot triad if cholangitis overlaps',
      ],
      confirmationTests: ['USS', 'MRCP', 'EUS', 'ERCP'],
    },
    {
      name: 'Acute Pancreatitis',
      icd10: 'K85.9',
      color: '#f87171',
      discriminatingFeatures: [
        'Epigastric pain radiating to back',
        'Lipase / amylase > 3× ULN',
        'Nausea and vomiting prominent',
        'No Murphy\'s sign',
      ],
      keyFindings: [
        'Lipase markedly elevated',
        'CT: peripancreatic fat stranding',
        'MRCP: pancreatic duct / stones',
      ],
      confirmationTests: ['Lipase', 'CT abdomen', 'MRCP', 'LFTs'],
    },
    {
      name: 'Peptic Ulcer / Perforation',
      icd10: 'K27.1',
      color: '#a78bfa',
      discriminatingFeatures: [
        'Epigastric pain, sudden onset (perforation)',
        'Board-like rigid abdomen',
        'Free air on erect CXR',
        'No fever early',
      ],
      keyFindings: [
        'Erect CXR: pneumoperitoneum (perforation)',
        'OGD: ulcer crater',
        'No cholecystitis on USS',
      ],
      confirmationTests: ['Erect CXR', 'CT abdomen', 'OGD'],
    },
    {
      name: 'Hepatic Abscess',
      icd10: 'K75.0',
      color: '#34d399',
      discriminatingFeatures: [
        'Insidious onset, high swinging fever',
        'Tender hepatomegaly',
        'RUQ pain — no Murphy\'s sign',
        'Travel history (amoebic)',
      ],
      keyFindings: [
        'USS / CT: intrahepatic collection',
        'Serology: Entamoeba histolytica',
        'Percutaneous aspiration: pus',
      ],
      confirmationTests: ['USS', 'CT', 'Serology', 'Blood cultures'],
    },
    {
      name: 'Right Lower Lobe Pneumonia',
      icd10: 'J18.9',
      color: '#60a5fa',
      discriminatingFeatures: [
        'Cough, productive sputum',
        'Pleuritic chest pain',
        'Dullness to percussion',
        'Referred RUQ pain via phrenic nerve',
      ],
      keyFindings: [
        'CXR: right lower lobe consolidation',
        'SpO2 reduced',
        'Normal USS gallbladder',
      ],
      confirmationTests: ['CXR', 'SpO2', 'USS', 'Sputum culture'],
    },
    {
      name: 'Acute Appendicitis',
      icd10: 'K35.2',
      color: '#fbbf24',
      discriminatingFeatures: [
        'RLQ migration of pain (McBurney)',
        'Rovsing\'s sign positive',
        'Anorexia prominent',
        'Atypical RUQ in pregnancy / sub-hepatic appendix',
      ],
      keyFindings: [
        'CT abdomen: appendix > 6 mm + fat stranding',
        'USS (paediatric): non-compressible appendix',
        'No cholecystitis features',
      ],
      confirmationTests: ['CT abdomen', 'USS', 'Alvarado score', 'CRP / WBC'],
    },
  ],

  // ── Biomarker Pattern ────────────────────────────────────────────────────────

  biomarkerPattern: [
    { name: 'WBC',          loinc: '6690-2',  snomed: null,      direction: 'up',    significance: 'Primary TG18-B criterion; > 10,000/μL diagnostic, > 18,000 Grade II marker', threshold: { value: 10, unit: '× 10⁹/L' } },
    { name: 'CRP',          loinc: '1988-5',  snomed: null,      direction: 'up',    significance: 'TG18-B criterion > 3 mg/dL (30 mg/L); most sensitive Grade II marker', threshold: { value: 30, unit: 'mg/L' } },
    { name: 'Total Bilirubin', loinc: '1975-2', snomed: '57162004', direction: 'up',  significance: 'Mildly elevated — if > 34 μmol/L, suspect CBD stone (Mirizzi / choledocholithiasis)' },
    { name: 'ALP / GGT',    loinc: '6768-6',  snomed: '305085006', direction: 'up',  significance: 'Mildly elevated in cholecystitis; marked elevation suggests CBD involvement' },
    { name: 'Lipase',       loinc: '3040-3',  snomed: null,      direction: 'up',    significance: 'Elevated if gallstone pancreatitis overlap (Gallstone pancreatitis must be excluded)' },
    { name: 'Lactate',      loinc: '2524-7',  snomed: null,      direction: 'up',    significance: 'Elevated in Grade III sepsis — mandates ICU care before cholecystectomy' },
    { name: 'Creatinine',   loinc: '2160-0',  snomed: null,      direction: 'up',    significance: 'Tokyo Grade III renal criterion if > 177 μmol/L (2 mg/dL)' },
    { name: 'PT / INR',     loinc: '34714-6', snomed: '165581004', direction: 'up',  significance: 'Tokyo Grade III haematological criterion if INR > 1.5; also affects anaesthetic risk' },
  ],

  // ── Clinical Presentation ────────────────────────────────────────────────────

  symptoms: [
    'Right upper quadrant pain (constant, colicky onset)',
    'Nausea and vomiting',
    'Anorexia',
    'Fever and rigors',
    'Referred right shoulder tip pain (phrenic nerve irritation)',
    'Jaundice (if Mirizzi syndrome or CBD stone coexists)',
    'Previous biliary colic episodes (intermittent, meal-related)',
    'Abdominal bloating and indigestion (chronic gallstone disease)',
  ],

  signs: [
    "Murphy's sign positive (inspiratory arrest on deep palpation RUQ)",
    'Fever > 38°C',
    'Right upper quadrant tenderness and guarding',
    'Palpable gallbladder (empyema / mucocoele)',
    "Boas' sign (right scapular tip hyperaesthesia)",
    'Peritonism if perforation (board-like rigidity)',
    'Icterus if CBD involvement',
    'Tachycardia',
  ],

  laboratoryFindings: [
    'Leucocytosis WBC > 10,000/μL (TG18 B criterion)',
    'CRP elevated > 30 mg/L (TG18 B criterion — most sensitive for Grade II)',
    'ALP / GGT mildly elevated (biliary source)',
    'Mildly elevated total bilirubin (< 34 μmol/L); > 34 = CBD involvement',
    'Elevated lipase if gallstone pancreatitis overlap',
    'Lactate elevated in Grade III (sepsis)',
    'Haemoconcentration (raised haematocrit — dehydration)',
    'Coagulopathy (INR > 1.5) in Grade III hepatic or haematological dysfunction',
  ],

  radiologyFindings: [
    'USS: GB wall thickening > 4 mm (most specific TG18-C criterion)',
    'USS: Positive sonographic Murphy\'s sign',
    'USS: Pericholecystic fluid',
    'USS: Distended gallbladder (> 5 cm transverse diameter)',
    'USS: Gallstones (calculous cholecystitis)',
    'CT: Pericholecystic fat stranding',
    'CT: Gas in GB wall (emphysematous cholecystitis — surgical emergency)',
    'HIDA scan: Non-visualisation of gallbladder (acalculous cholecystitis gold standard)',
  ],

  // ── Tokyo Guidelines Severity Scoring (TG18) ─────────────────────────────────

  severity: {
    name: 'Tokyo Guidelines TG18',
    description:
      'International consensus severity grading (TG18): Grade I = mild, Grade II = moderate, Grade III = severe with organ dysfunction. Grade determines surgical timing.',
    criteria: [
      {
        label: 'Fever > 38°C',
        points: 1,
        description: 'TG18 B criterion — systemic sign of infection',
        detect: (facts) => {
          const t = vital(facts, 'temperatureC');
          return t !== null && t > 38;
        },
      },
      {
        label: 'WBC > 10,000 /μL',
        points: 1,
        description: 'TG18 B criterion — leucocytosis indicating infection',
        detect: (facts) => {
          const w = lab(facts, 'WBC') ?? lab(facts, 'white blood cell') ?? lab(facts, 'leucocyte');
          return w !== null && w > 10;
        },
      },
      {
        label: 'CRP > 30 mg/L',
        points: 1,
        description: 'TG18 B criterion — best single Grade II predictor',
        detect: (facts) => {
          const c = lab(facts, 'CRP') ?? lab(facts, 'C-reactive');
          return c !== null && c > 30;
        },
      },
      {
        label: 'Imaging confirms cholecystitis',
        points: 1,
        description: 'TG18 C criterion — GB wall > 4 mm, pericholecystic fluid, or sonographic Murphy\'s',
        detect: (facts) =>
          facts.some(f =>
            f.factType === 'imaging_result' &&
            (f.status === 'confirmed' || f.status === 'active'),
          ),
      },
      {
        label: 'WBC > 18,000 /μL',
        points: 2,
        description: 'Tokyo Grade II marker — severe leucocytosis indicating marked infection',
        detect: (facts) => {
          const w = lab(facts, 'WBC') ?? lab(facts, 'white blood cell');
          return w !== null && w > 18;
        },
      },
      {
        label: 'Duration > 72 hours',
        points: 1,
        description: 'Tokyo Grade II criterion — prolonged inflammation increases complication risk',
        detect: (facts) => {
          const sympFacts = facts.filter(f => f.factType === 'symptom' && f.status !== 'refuted');
          if (!sympFacts.length) return false;
          const oldest = sympFacts.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
          const hours = (Date.now() - new Date(oldest.createdAt).getTime()) / 3_600_000;
          return hours > 72;
        },
      },
      {
        label: 'Organ dysfunction (renal: creatinine > 177 μmol/L)',
        points: 2,
        description: 'Tokyo Grade III — any one organ dysfunction = Grade III, mandates biliary drainage',
        detect: (facts) => {
          const c = lab(facts, 'creatinine');
          return c !== null && c > 177;
        },
      },
      {
        label: 'Organ dysfunction (hepatic: bilirubin > 34 μmol/L)',
        points: 1,
        description: 'Tokyo Grade III hepatic criterion — also consider CBD stone if bilirubin elevated',
        detect: (facts) => {
          const b = lab(facts, 'bilirubin');
          return b !== null && b > 34;
        },
      },
    ],
    bands: [
      { min: 0, max: 2,  label: 'Grade I — Mild',     color: '#f0fdf4', text: '#166534' },
      { min: 3, max: 5,  label: 'Grade II — Moderate', color: '#fffbeb', text: '#92400e' },
      { min: 6, max: 9,  label: 'Grade III — Severe',  color: '#fee2e2', text: '#991b1b' },
    ],
  },

  // ── Management Pathway ───────────────────────────────────────────────────────

  managementSteps: [
    {
      order: 1, icon: '💧', label: 'Resuscitate',
      details: [
        'IV access × 2 large bore',
        'IV crystalloid (Hartmann\'s) — guided by fluid status',
        'NBM (nil by mouth)',
        'IV analgesia: morphine / ketorolac; anti-emetic',
        'IV antibiotics: cefuroxime 1.5 g TDS ± metronidazole 500 mg TDS (Grade II/III)',
        'Urinary catheter + urine output monitoring if Grade III',
        'Blood: FBC, LFTs, lipase, CRP, lactate, coagulation, G&S',
      ],
      factTypes: ['task', 'medication', 'prescription'],
    },
    {
      order: 2, icon: '📷', label: 'Diagnose',
      details: [
        'Bedside USS: GB wall thickness, Murphy\'s, stones, pericholecystic fluid, CBD diameter',
        'If USS equivocal: CT abdomen + pelvis with contrast',
        'HIDA scan if acalculous cholecystitis suspected (ICU patient)',
        'Apply TG18 diagnostic criteria (A + B + C)',
      ],
      factTypes: ['imaging_result', 'investigation_order'],
    },
    {
      order: 3, icon: '📊', label: 'Grade',
      details: [
        'Apply Tokyo Guidelines TG18 Grade I / II / III',
        'Grade I: No organ dysfunction, mild local inflammation',
        'Grade II: WBC > 18,000 OR CRP > 100 OR duration > 72h',
        'Grade III: Any organ dysfunction (renal/hepatic/cardiovascular/haematological)',
        'Document grade and timing decision in clinical note',
      ],
      factTypes: ['diagnosis', 'lab_result'],
    },
    {
      order: 4, icon: '🔪', label: 'Operate / Drain',
      details: [
        'Grade I/II: Early laparoscopic cholecystectomy within 72h (ACDC/CHOCOLATE trial evidence)',
        'Grade III: Percutaneous cholecystostomy (drainage) → resuscitate → delayed cholecystectomy',
        'Achieve Critical View of Safety (CVS) before dividing cystic duct and artery',
        'Intraoperative cholangiogram if CBD > 8 mm on USS',
        'Convert to open if unsafe — no shame in conversion, CVS cannot be achieved',
      ],
      factTypes: ['procedure', 'task'],
    },
    {
      order: 5, icon: '👁', label: 'Monitor',
      details: [
        'Serial WBC and CRP — rising at 48h mandates reassessment',
        'Monitor drain output (cholecystostomy) — colour, volume, bile leak signs',
        'LFTs 24–48h post-op',
        'Discharge criteria: afebrile, WBC normalising, tolerating oral intake',
        'Outpatient follow-up: USS ± MRCP if CBD involvement not excluded',
      ],
      factTypes: ['lab_result', 'vital', 'follow_up'],
    },
  ],

  // ── Clinical Code Mapping ────────────────────────────────────────────────────

  clinicalCodes: [
    { concept: 'Acute cholecystitis',            icd10: 'K81.0', snomed: '65275009',  loinc: null,      example: 'Acute inflammation of GB' },
    { concept: 'Calculous acute cholecystitis',  icd10: 'K80.00', snomed: '235919008', loinc: null,     example: 'GB stones + acute cholecystitis' },
    { concept: 'Acalculous cholecystitis',       icd10: 'K81.0', snomed: '79740007',  loinc: null,      example: 'No gallstones, ICU patient' },
    { concept: 'Empyema of gallbladder',         icd10: 'K81.0', snomed: '39621005',  loinc: null,      example: 'Suppurative cholecystitis' },
    { concept: 'Gangrenous cholecystitis',       icd10: 'K81.0', snomed: '34508002',  loinc: null,      example: 'Full-thickness wall necrosis' },
    { concept: 'GB perforation',                 icd10: 'K82.2', snomed: '27355004',  loinc: null,      example: 'Free bile peritoneum' },
    { concept: 'WBC count',                      icd10: null,    snomed: null,         loinc: '6690-2',  example: '14.5 × 10⁹/L' },
    { concept: 'C-reactive protein',             icd10: null,    snomed: null,         loinc: '1988-5',  example: '85 mg/L' },
  ],

  // ── Uncertainty Flags ────────────────────────────────────────────────────────

  uncertaintyFlags: [
    'Calculous vs acalculous not confirmed — USS pending',
    'CBD involvement not excluded (bilirubin mildly elevated — MRCP not yet performed)',
    'Grade II vs Grade III distinction requires serial organ function monitoring',
    'Gangrenous / perforated GB cannot be excluded without CT if USS equivocal',
    'Operative fitness not formally assessed (ASA grade, cardiopulmonary reserve)',
    'Mirizzi syndrome not excluded (extrinsic CBD compression from GB neck stone)',
    'Gallstone pancreatitis overlap not assessed — lipase not yet recorded',
  ],

  // ── Clinical Pearls ──────────────────────────────────────────────────────────

  clinicalPearls: [
    "Murphy's sign has 65% sensitivity and 87% specificity — USS sonographic Murphy's sign is more reliable than clinical examination",
    "Acalculous cholecystitis accounts for 5–10% of cases but carries 30–50% mortality — always consider in ICU/post-op patients",
    "Tokyo Grade III mandates biliary decompression (percutaneous cholecystostomy) BEFORE cholecystectomy — never rush to theatre in septic shock",
    "Early cholecystectomy (< 72h) for Grade I–II is superior to delayed interval cholecystectomy — ACDC and CHOCOLATE RCT evidence",
    "Gas in the GB wall (emphysematous cholecystitis) is a surgical emergency — Clostridium infection, mortality 15–25%",
    "Achieve the Critical View of Safety (CVS): two structures only entering the GB, lower third of GB free of fat and fibrosis — primary prevention of bile duct injury",
    "CBD diameter > 8 mm on USS mandates MRCP to exclude Mirizzi syndrome or choledocholithiasis before cholecystectomy",
    "Percutaneous cholecystostomy converts an emergency Grade III case into a semi-elective interval cholecystectomy 6 weeks later",
    "Boas' sign (right scapular tip pain) reflects diaphragmatic irritation — present in 15–30% of acute cholecystitis cases",
    "Ceftriaxone alone covers Grade I; add metronidazole for anaerobic coverage (Bacteroides fragilis) in Grade II/III",
  ],

  // ── Per-profile scorer functions ─────────────────────────────────────────────
  scorerFns: [
    score1_Anatomy,
    score2_Etiology,
    score3_Inflammation,
    score4_SystemicResponse,
    score5_TokyoGrade,
    score6_LocalComplication,
    score7_SystemicImpact,
    score8_Temporal,
    score9_Response,
    score10_SurgicalRisk,
    score11_DiagnosticConfidence,
    score12_Therapeutic,
    score13_Uncertainty,
  ],
};
