// ─── axis-scorer.ts ───────────────────────────────────────────────────────────
//
// AxisScorer — translates live PatientFactStore data into a PatientStateVector.
//
// Given a PathologyProfile (the static clinical template) and an array of
// ClinicalFacts (the patient's live record), it scores each of the 13 axes
// on a 0–100 scale, assigns a severity label, and captures the evidence chain.
//
// Geometric read: the profile is the printed honeycomb template; the scorer
// is the pin that places each cell based on the patient's actual facts;
// the vector is the resulting pattern of dots on the radar sphere.

import type { ClinicalFact, LabResultValue, VitalValue, DiagnosisValue } from './types.js';
import type { AxisScorerFn, PathologyProfile, AxisScore, PatientStateVector } from './pathology-profile.js';

// ─── Exported helpers — available to profile files ───────────────────────────

export function latestLab(facts: ClinicalFact[], name: string): { value: number; label: string } | null {
  const hits = facts
    .filter(f => f.factType === 'lab_result' && f.status !== 'refuted')
    .filter(f => {
      const v = f.value as LabResultValue;
      return v.testName.toLowerCase().includes(name.toLowerCase());
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (!hits.length) return null;
  const v = hits[0].value as LabResultValue;
  const num = typeof v.result === 'number' ? v.result : parseFloat(String(v.result));
  return { value: num, label: `${v.testName} ${num} ${v.unit ?? ''}`.trim() };
}

export function latestVital(facts: ClinicalFact[], param: string): { value: number; label: string } | null {
  const hit = facts
    .filter(f => f.factType === 'vital' && f.status !== 'refuted')
    .filter(f => (f.value as VitalValue).parameter === param)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!hit) return null;
  const v = hit.value as VitalValue;
  return { value: v.numericValue, label: `${v.parameter} ${v.numericValue} ${v.unit ?? ''}`.trim() };
}

export function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

export function scoreLabel(score: number): string {
  if (score < 20) return 'None';
  if (score < 40) return 'Mild';
  if (score < 60) return 'Moderate';
  if (score < 80) return 'Severe';
  return 'Critical';
}

// ─── Per-axis score functions ─────────────────────────────────────────────────

function scoreAxis1_Anatomy(facts: ClinicalFact[]): Omit<AxisScore, 'axisId'> {
  const evidence: string[] = [];
  let score = 10;

  const imagingFacts = facts.filter(f =>
    (f.factType === 'imaging_result' || f.factType === 'investigation_order') &&
    f.status !== 'refuted',
  );

  if (imagingFacts.length) {
    score = 40;
    evidence.push(`${imagingFacts.length} imaging study(ies) documented`);
  }

  const cbd = latestLab(facts, 'CBD diameter') ?? latestLab(facts, 'common bile duct');
  if (cbd) {
    evidence.push(`CBD: ${cbd.label}`);
    if (cbd.value >= 8) { score = Math.max(score, 70); evidence.push('CBD dilated ≥ 8 mm'); }
    if (cbd.value >= 12) { score = Math.max(score, 90); evidence.push('CBD markedly dilated ≥ 12 mm'); }
  }

  const confirmed = imagingFacts.filter(f => f.status === 'confirmed' || f.status === 'active');
  if (confirmed.length) {
    score = Math.min(score + 20, 100);
    evidence.push('Obstruction level confirmed on imaging');
  }

  return { score: clamp(score), target: 10, riskThreshold: 60, label: scoreLabel(score), evidence };
}

function scoreAxis2_Etiology(facts: ClinicalFact[]): Omit<AxisScore, 'axisId'> {
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
      if (d.certainty === 'confirmed') score = Math.max(score, 70);
      else if (d.certainty === 'probable') score = Math.max(score, 50);
      else score = Math.max(score, 30);

      const icd = (d.icd10 ?? '').toUpperCase();
      if (icd.startsWith('C') || icd.startsWith('K83.0')) {
        score = Math.max(score, 80);
        evidence.push('Malignant or sclerosing etiology — high complexity');
      }
    });
  }

  return { score: clamp(score), target: 20, riskThreshold: 70, label: scoreLabel(score), evidence };
}

function scoreAxis3_Pathophysiology(facts: ClinicalFact[]): Omit<AxisScore, 'axisId'> {
  const evidence: string[] = [];
  let score = 0;

  const bili = latestLab(facts, 'bilirubin');
  if (bili) {
    evidence.push(bili.label);
    if (bili.value > 1.2)  score += 20;
    if (bili.value > 3)    score += 20;
    if (bili.value > 10)   score += 20;
    if (bili.value > 20)   score += 20;
  }

  const alp = latestLab(facts, 'ALP') ?? latestLab(facts, 'alkaline phosphatase');
  if (alp) {
    evidence.push(alp.label);
    if (alp.value > 120)  score += 10;
    if (alp.value > 360)  score += 10;  // 3× ULN
    if (alp.value > 600)  score += 10;
  }

  const ggt = latestLab(facts, 'GGT') ?? latestLab(facts, 'gamma');
  if (ggt) {
    evidence.push(ggt.label);
    if (ggt.value > 50) score += 5;
    if (ggt.value > 200) score += 5;
  }

  if (!bili && !alp) {
    score = 15;
    evidence.push('Liver enzymes not recorded');
  }

  return { score: clamp(score), target: 0, riskThreshold: 60, label: scoreLabel(score), evidence };
}

function scoreAxis4_ClinicalActivity(facts: ClinicalFact[]): Omit<AxisScore, 'axisId'> {
  const evidence: string[] = [];
  let sirsCount = 0;

  const temp = latestVital(facts, 'temperatureC');
  if (temp) {
    evidence.push(temp.label);
    if (temp.value > 38 || temp.value < 36) { sirsCount++; evidence.push('SIRS: temp criterion met'); }
  }

  const hr = latestVital(facts, 'heartRate');
  if (hr) {
    evidence.push(hr.label);
    if (hr.value > 90) { sirsCount++; evidence.push('SIRS: HR > 90'); }
  }

  const rr = latestVital(facts, 'respiratoryRate');
  if (rr) {
    evidence.push(rr.label);
    if (rr.value > 20) { sirsCount++; evidence.push('SIRS: RR > 20'); }
  }

  const wbc = latestLab(facts, 'WBC') ?? latestLab(facts, 'white blood cell') ?? latestLab(facts, 'leucocyte');
  if (wbc) {
    evidence.push(wbc.label);
    if (wbc.value > 12 || wbc.value < 4) { sirsCount++; evidence.push('SIRS: WBC criterion met'); }
  }

  const score = clamp(sirsCount * 25);
  if (sirsCount === 0) evidence.push('No SIRS criteria met');

  return { score, target: 0, riskThreshold: 50, label: scoreLabel(score), evidence };
}

function scoreAxis5_Obstruction(facts: ClinicalFact[]): Omit<AxisScore, 'axisId'> {
  const evidence: string[] = [];
  let score = 0;

  const bili = latestLab(facts, 'bilirubin');
  if (bili) {
    evidence.push(bili.label);
    if (bili.value > 3)   score += 25;
    if (bili.value > 10)  score += 25;
    if (bili.value > 20)  score += 25;
  }

  const alp = latestLab(facts, 'ALP') ?? latestLab(facts, 'alkaline phosphatase');
  if (alp) {
    evidence.push(alp.label);
    if (alp.value > 360)  score += 15;
    if (alp.value > 600)  score += 10;
  }

  if (!bili && !alp) {
    score = 20;
    evidence.push('Obstruction markers not available');
  }

  return { score: clamp(score), target: 0, riskThreshold: 50, label: scoreLabel(score), evidence };
}

function scoreAxis6_SystemicImpact(facts: ClinicalFact[]): Omit<AxisScore, 'axisId'> {
  const evidence: string[] = [];
  let score = 0;

  const inr = latestLab(facts, 'INR') ?? latestLab(facts, 'prothrombin');
  if (inr) {
    evidence.push(inr.label);
    if (inr.value > 1.2) score += 20;
    if (inr.value > 1.5) score += 20;
    if (inr.value > 2.0) score += 20;
  }

  const creat = latestLab(facts, 'creatinine');
  if (creat) {
    evidence.push(creat.label);
    if (creat.value > 100) score += 10;
    if (creat.value > 200) score += 20;
  }

  const albumin = latestLab(facts, 'albumin');
  if (albumin) {
    evidence.push(albumin.label);
    if (albumin.value < 35) score += 15;
    if (albumin.value < 25) score += 15;
  }

  if (!inr && !creat && !albumin) {
    score = 10;
    evidence.push('Systemic markers not recorded');
  }

  return { score: clamp(score), target: 0, riskThreshold: 40, label: scoreLabel(score), evidence };
}

function scoreAxis7_Temporal(facts: ClinicalFact[]): Omit<AxisScore, 'axisId'> {
  const evidence: string[] = [];
  let score = 30;

  const sympFacts = facts.filter(f => f.factType === 'symptom' && f.status !== 'refuted');
  if (sympFacts.length) {
    const oldest = sympFacts.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    const days = Math.floor((Date.now() - new Date(oldest.createdAt).getTime()) / 86_400_000);
    evidence.push(`Symptoms first recorded ${days}d ago`);
    if (days > 7)   { score = 50; evidence.push('> 1 week duration'); }
    if (days > 30)  { score = 70; evidence.push('> 1 month — chronic or untreated'); }
    if (days > 90)  { score = 85; evidence.push('> 3 months — likely chronic / malignant'); }
  } else {
    evidence.push('Symptom onset date not recorded');
  }

  return { score: clamp(score), target: 20, riskThreshold: 60, label: scoreLabel(score), evidence };
}

function scoreAxis8_Response(facts: ClinicalFact[]): Omit<AxisScore, 'axisId'> {
  const evidence: string[] = [];
  let score = 50;

  const biliResults = facts
    .filter(f => f.factType === 'lab_result' && f.status !== 'refuted')
    .filter(f => (f.value as LabResultValue).testName.toLowerCase().includes('bilirubin'))
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

  if (biliResults.length >= 2) {
    const first = biliResults[0].value as LabResultValue;
    const last  = biliResults[biliResults.length - 1].value as LabResultValue;
    const firstVal = typeof first.result === 'number' ? first.result : parseFloat(String(first.result));
    const lastVal  = typeof last.result  === 'number' ? last.result  : parseFloat(String(last.result));

    if (lastVal < firstVal * 0.75) {
      score = 20;
      evidence.push(`Bilirubin trending DOWN: ${firstVal} → ${lastVal} — good response`);
    } else if (lastVal > firstVal * 1.1) {
      score = 80;
      evidence.push(`Bilirubin trending UP: ${firstVal} → ${lastVal} — inadequate response`);
    } else {
      score = 50;
      evidence.push(`Bilirubin stable: ${firstVal} → ${lastVal}`);
    }
  } else {
    score = 50;
    evidence.push('Insufficient serial results to assess response');
  }

  return { score: clamp(score), target: 10, riskThreshold: 60, label: scoreLabel(score), evidence };
}

function scoreAxis9_Risk(facts: ClinicalFact[]): Omit<AxisScore, 'axisId'> {
  const evidence: string[] = [];
  let score = 20;

  const bili  = latestLab(facts, 'bilirubin');
  const inr   = latestLab(facts, 'INR');
  const creat = latestLab(facts, 'creatinine');
  const wbc   = latestLab(facts, 'WBC') ?? latestLab(facts, 'white blood');
  const temp  = latestVital(facts, 'temperatureC');
  const hr    = latestVital(facts, 'heartRate');

  // Charcot's triad: fever + jaundice + RUQ pain
  let charcotCriteria = 0;
  if (temp && (temp.value > 38 || temp.value < 36)) { charcotCriteria++; evidence.push('Fever present'); }
  if (bili && bili.value > 3) { charcotCriteria++; evidence.push('Jaundice present'); }
  const rxPain = facts.filter(f =>
    f.factType === 'symptom' && String(f.value).toLowerCase().includes('pain'),
  );
  if (rxPain.length) { charcotCriteria++; evidence.push('RUQ pain documented'); }

  if (charcotCriteria >= 2) { score += 30; evidence.push(`Charcot criteria: ${charcotCriteria}/3`); }
  if (charcotCriteria === 3) { score += 20; evidence.push('Full Charcot triad — cholangitis risk HIGH'); }

  if (inr && inr.value > 1.5)    { score += 15; evidence.push('Coagulopathy — haemorrhage risk'); }
  if (creat && creat.value > 150) { score += 10; evidence.push('Renal impairment — hepatorenal risk'); }
  if (wbc && wbc.value > 12)      { score += 10; evidence.push('Leucocytosis — sepsis risk'); }
  if (hr && hr.value > 100)       { score += 10; evidence.push('Tachycardia — systemic response'); }

  const malignantDx = facts
    .filter(f => f.factType === 'diagnosis' && f.status !== 'refuted')
    .filter(f => {
      const icd = ((f.value as DiagnosisValue).icd10 ?? '').toUpperCase();
      return icd.startsWith('C');
    });
  if (malignantDx.length) { score += 20; evidence.push('Malignant diagnosis — high risk'); }

  return { score: clamp(score), target: 10, riskThreshold: 50, label: scoreLabel(score), evidence };
}

function scoreAxis10_Diagnostic(facts: ClinicalFact[]): Omit<AxisScore, 'axisId'> {
  const evidence: string[] = [];
  let criteria = 0;

  const bili = latestLab(facts, 'bilirubin');
  if (bili && bili.value > 1.2) { criteria++; evidence.push('Hyperbilirubinemia confirmed'); }

  const alp = latestLab(facts, 'ALP') ?? latestLab(facts, 'alkaline phosphatase');
  if (alp && alp.value > 120) { criteria++; evidence.push('ALP elevated'); }

  const imaging = facts.filter(f =>
    f.factType === 'imaging_result' && f.status !== 'refuted',
  );
  if (imaging.length) { criteria++; evidence.push('Imaging obtained'); }

  const dx = facts.filter(f =>
    f.factType === 'diagnosis' &&
    (f.status === 'confirmed' || f.status === 'active'),
  );
  if (dx.length) { criteria++; evidence.push('Diagnosis confirmed'); }

  const ggt = latestLab(facts, 'GGT') ?? latestLab(facts, 'gamma');
  if (ggt && ggt.value > 50) { criteria++; evidence.push('GGT elevated — biliary source confirmed'); }

  const score = clamp(criteria * 20);
  if (!criteria) evidence.push('No diagnostic criteria documented');

  return { score, target: 90, riskThreshold: 40, label: scoreLabel(score), evidence };
}

function scoreAxis11_Prognostic(facts: ClinicalFact[]): Omit<AxisScore, 'axisId'> {
  const evidence: string[] = [];
  let score = 30;

  const malignantDx = facts
    .filter(f => f.factType === 'diagnosis' && f.status !== 'refuted')
    .filter(f => {
      const icd = ((f.value as DiagnosisValue).icd10 ?? '').toUpperCase();
      return icd.startsWith('C');
    });
  if (malignantDx.length) {
    score = 80;
    evidence.push('Malignant underlying cause — guarded prognosis');
  }

  const inr = latestLab(facts, 'INR');
  if (inr && inr.value > 1.5) {
    score = Math.max(score, 60);
    evidence.push('Coagulopathy — worsened prognosis');
  }

  const bili = latestLab(facts, 'bilirubin');
  if (bili && bili.value > 20) {
    score = Math.max(score, 70);
    evidence.push('Very high bilirubin — severe obstruction');
  }

  const sirsCount = [
    latestVital(facts, 'temperatureC'),
    latestVital(facts, 'heartRate'),
    latestVital(facts, 'respiratoryRate'),
    latestLab(facts, 'WBC'),
  ].filter(v => v !== null).length;

  if (sirsCount >= 2) {
    score = Math.max(score, 65);
    evidence.push(`SIRS present (${sirsCount} criteria) — sepsis risk`);
  }

  if (score < 40) evidence.push('Favorable: likely benign, early presentation');

  return { score: clamp(score), target: 20, riskThreshold: 60, label: scoreLabel(score), evidence };
}

function scoreAxis12_Therapeutic(facts: ClinicalFact[]): Omit<AxisScore, 'axisId'> {
  const evidence: string[] = [];

  const tasks = facts.filter(f => f.factType === 'task' && f.status !== 'refuted');
  const completed = tasks.filter(f => f.status === 'completed');
  const procedures = facts.filter(f => f.factType === 'procedure' && f.status !== 'refuted');
  const followUps = facts.filter(f => f.factType === 'follow_up' && f.status !== 'refuted');

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

  return {
    score: clamp(pct),
    target: 90,
    riskThreshold: 30,
    label: scoreLabel(pct),
    evidence,
  };
}

function scoreAxis13_Uncertainty(facts: ClinicalFact[]): Omit<AxisScore, 'axisId'> {
  const evidence: string[] = [];
  let score = 0;

  const pending = facts.filter(f => f.status === 'pending');
  if (pending.length) {
    score += pending.length * 10;
    evidence.push(`${pending.length} pending result(s) / order(s)`);
  }

  const suspected = facts.filter(f => f.status === 'suspected');
  if (suspected.length) {
    score += suspected.length * 10;
    evidence.push(`${suspected.length} unconfirmed / suspected finding(s)`);
  }

  const aiUnverified = facts.filter(f =>
    (f.source === 'ai_extracted' || f.source === 'ai_suggested') &&
    f.status !== 'confirmed',
  );
  if (aiUnverified.length) {
    score += aiUnverified.length * 8;
    evidence.push(`${aiUnverified.length} AI-generated fact(s) awaiting verification`);
  }

  const workingDx = facts.filter(f =>
    f.factType === 'diagnosis' &&
    (f.value as DiagnosisValue).certainty === 'working',
  );
  if (workingDx.length) {
    score += 15;
    evidence.push(`${workingDx.length} working diagnosis(es) — not yet confirmed`);
  }

  if (score === 0) evidence.push('No significant uncertainty gaps identified');

  return { score: clamp(score), target: 0, riskThreshold: 40, label: scoreLabel(score), evidence };
}

// ─── K83.1 default scorers (used when profile.scorerFns is absent) ────────────

const K83_1_SCORERS: AxisScorerFn[] = [
  scoreAxis1_Anatomy,
  scoreAxis2_Etiology,
  scoreAxis3_Pathophysiology,
  scoreAxis4_ClinicalActivity,
  scoreAxis5_Obstruction,
  scoreAxis6_SystemicImpact,
  scoreAxis7_Temporal,
  scoreAxis8_Response,
  scoreAxis9_Risk,
  scoreAxis10_Diagnostic,
  scoreAxis11_Prognostic,
  scoreAxis12_Therapeutic,
  scoreAxis13_Uncertainty,
];

// ─── AxisScorer ───────────────────────────────────────────────────────────────

export class AxisScorer {
  constructor(private readonly profile: PathologyProfile) {}

  score(facts: ClinicalFact[]): PatientStateVector {
    const scorers = this.profile.scorerFns ?? K83_1_SCORERS;

    return this.profile.axes.map((axis, i) => {
      const fn = scorers[i];
      const partial = fn
        ? fn(facts)
        : { score: 0, target: 0, riskThreshold: 50, label: 'None', evidence: [] };
      return { axisId: axis.id, ...partial } as AxisScore;
    });
  }

  // Convenience: overall disease burden 0–100 (mean of all axis scores)
  overallBurden(vector: PatientStateVector): number {
    if (!vector.length) return 0;
    return Math.round(vector.reduce((s, a) => s + a.score, 0) / vector.length);
  }

  // Axes above risk threshold
  atRiskAxes(vector: PatientStateVector): AxisScore[] {
    return vector.filter(a => a.score >= a.riskThreshold);
  }
}
