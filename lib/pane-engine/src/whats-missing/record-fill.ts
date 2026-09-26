/**
 * Score auto-fill from the record (web ScalesTab calculators, iOS PatientScoreAutoPopulator):
 * which calculator fields the record already answers ("from record", editable), and which record
 * inputs a score needs that are not on file (the "What's missing" score-completeness signals).
 *
 * Only the pre-fill is decided here: no score formula is computed or changed. Numeric inputs
 * (vitals, labs, age) fill both true and false; history and examination findings fill only when
 * affirmed (the platform adapters read them negation-aware), never "false".
 *
 * Swift twin: ios/AmiseMedFlow/Services/WhatsMissingCore+Fill.swift. Shared vectors:
 * ios/AmiseMedFlowTests/WhatsMissing/whats-missing-vectors.json.
 */

import { WHATS_MISSING_RULES } from './rules.js';
import type { MissingRules } from './rules.js';
import type { FilledField, FillSource, MissingRecord, ScoreFill } from './types.js';

/** Scores whose inputs this module fills or checks. */
export const FILLABLE_SCORES = [
  'news2', 'qsofa', 'alvarado', 'air', 'glasgow-blatchford', 'curb65', 'wells-pe', 'wells-dvt', 'caprini', 'rcri', 'bisap',
  'tg18-cholecystitis', 'tg18-cholangitis',
] as const;

export interface NormalisedLabs {
  wbc: number | null;
  neutrophilPct: number | null;
  crp: number | null;
  urea: number | null;
  hb: number | null;
  creatinine: number | null;
  egfr: number | null;
  bilirubin: number | null;
  albumin: number | null;
  inr: number | null;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** Units the calculators use: WBC ×10⁹/L, Hb g/dL, creatinine µmol/L, neutrophils %. */
export function normaliseLabs(r: MissingRecord, rules: MissingRules = WHATS_MISSING_RULES): NormalisedLabs {
  const l = r.labs;
  const wbc = l.wbc === null ? null : l.wbc > 100 ? round1(l.wbc / 1000) : l.wbc;
  let neutrophilPct: number | null = null;
  if (l.neutrophils !== null) {
    if (l.neutrophils > rules.thresholds.neutrophilAbsoluteMax) neutrophilPct = l.neutrophils;
    else if (wbc !== null && wbc > 0) neutrophilPct = round1((l.neutrophils / wbc) * 100);
  }
  return {
    wbc,
    neutrophilPct,
    crp: l.crp,
    urea: l.urea,
    hb: l.hb === null ? null : l.hb > 25 ? round1(l.hb / 10) : l.hb,
    creatinine: l.creatinine === null ? null : l.creatinine < 15 ? Math.round(l.creatinine * 88.4) : l.creatinine,
    egfr: l.egfr,
    bilirubin: l.bilirubin,
    albumin: l.albumin,
    inr: l.inr,
  };
}

/** BMI from height and weight (one decimal), or null. */
export function recordBmi(r: MissingRecord): number | null {
  if (r.weightKg === null || r.heightCm === null || r.heightCm < 50) return null;
  return round1(r.weightKg / ((r.heightCm / 100) ** 2));
}

class Builder {
  fields: FilledField[] = [];
  missing: string[] = [];
  set(key: string, value: boolean | number, source: FillSource): void { this.fields.push({ key, value, source }); }
  /** Only an affirmed history / finding is filled. */
  affirmed(key: string, value: boolean, source: FillSource): void { if (value) this.set(key, true, source); }
  need(concept: string): void { if (!this.missing.includes(concept)) this.missing.push(concept); }
}

function band3(v: number, cut: [number, number]): number {
  return v >= cut[1] ? 2 : v >= cut[0] ? 1 : 0;
}

/** Observation concepts not recorded, in NEWS2 chart order. */
export function missingObservations(r: MissingRecord): string[] {
  const v = r.vitals;
  const out: string[] = [];
  if (v.rr === null) out.push('rr');
  if (v.spo2 === null) out.push('spo2');
  if (v.onOxygen === null) out.push('o2');
  if (v.sbp === null) out.push('sbp');
  if (v.hr === null) out.push('hr');
  if (v.avpu === null) out.push('avpu');
  if (v.tempC === null) out.push('temp');
  return out;
}

/** The pre-filled fields and the missing record inputs of one score. */
export function scoreRecordFill(score: string, r: MissingRecord, rules: MissingRules = WHATS_MISSING_RULES): ScoreFill {
  const t = rules.thresholds;
  const labs = normaliseLabs(r, rules);
  const v = r.vitals;
  const h = r.history;
  const f = r.findings;
  const b = new Builder();
  const age = r.ageYears;

  switch (score) {
    case 'news2':
      for (const c of missingObservations(r)) b.need(c);
      break;
    case 'qsofa':
      if (v.rr === null) b.need('rr');
      if (v.sbp === null) b.need('sbp');
      if (v.avpu === null) b.need('avpu');
      break;
    case 'alvarado':
      b.affirmed('migratoryPain', f.migration, 'findings');
      b.affirmed('anorexia', f.anorexia, 'findings');
      b.affirmed('nausea', f.nausea || f.vomiting, 'findings');
      b.affirmed('rifTenderness', f.rifTenderness, 'findings');
      b.affirmed('rebound', f.rebound, 'findings');
      if (v.tempC !== null) b.set('fever', v.tempC >= t.alvaradoFeverC, 'vitals'); else b.need('temp');
      if (labs.wbc !== null) b.set('wbcAbove10', labs.wbc > t.alvaradoWbc, 'labs'); else b.need('wbc');
      if (labs.neutrophilPct !== null) b.set('leftShift', labs.neutrophilPct > t.alvaradoNeutrophilPct, 'labs'); else b.need('neutrophils');
      break;
    case 'air':
      b.affirmed('vomiting', f.vomiting, 'findings');
      b.affirmed('painRIF', f.rifPain || f.rifTenderness, 'findings');
      if (v.tempC !== null) b.set('tempAbove38point5', v.tempC >= t.airFeverC, 'vitals'); else b.need('temp');
      if (labs.neutrophilPct !== null) b.set('pmn', band3(labs.neutrophilPct, t.airPmnPct), 'labs'); else b.need('neutrophils');
      if (labs.wbc !== null) b.set('wbc', band3(labs.wbc, t.airWbc), 'labs'); else b.need('wbc');
      if (labs.crp !== null) b.set('crp', band3(labs.crp, t.airCrp), 'labs'); else b.need('crp');
      break;
    case 'glasgow-blatchford':
      if (labs.urea !== null) b.set('ureaMmol', labs.urea, 'labs'); else b.need('urea');
      if (labs.hb !== null) b.set('haemoglobin', labs.hb, 'labs'); else b.need('hb');
      if (r.sex !== 'unknown') b.set('isMale', r.sex === 'male', 'demographics');
      if (v.sbp !== null) b.set('systolicBp', v.sbp, 'vitals'); else b.need('sbp');
      if (v.hr !== null) b.set('heartRateAbove100', v.hr > t.gbsHrAbove, 'vitals'); else b.need('hr');
      b.affirmed('melaena', f.melaena, 'findings');
      b.affirmed('syncope', f.syncope, 'findings');
      b.affirmed('liverDisease', h.liverDisease, 'history');
      b.affirmed('cardiacFailure', h.chf, 'history');
      break;
    case 'curb65': {
      const confusedAvpu = v.avpu !== null && v.avpu !== 'A';
      if (confusedAvpu || f.confusion) b.set('confusion', true, confusedAvpu ? 'vitals' : 'findings');
      else if (v.avpu === 'A') b.set('confusion', false, 'vitals');
      if (labs.urea !== null) b.set('ureaMmolAbove7', labs.urea > t.curbUreaAbove, 'labs'); else b.need('urea');
      if (v.rr !== null) b.set('respiratoryRateAbove30', v.rr >= t.curbRrAtLeast, 'vitals'); else b.need('rr');
      if (v.sbp !== null) b.set('bpLow', v.sbp < t.curbSbpBelow || (v.dbp !== null && v.dbp <= t.curbDbpAtMost), 'vitals'); else b.need('sbp');
      if (age !== null) b.set('age65orAbove', age >= t.curbAgeAtLeast, 'demographics');
      break;
    }
    case 'wells-pe':
      b.affirmed('dvtSigns', f.dvtSigns, 'findings');
      if (v.hr !== null) b.set('hrAbove100', v.hr > t.wellsPeHrAbove, 'vitals'); else b.need('hr');
      b.affirmed('immobilised', h.recentSurgery4w || h.immobile, 'history');
      b.affirmed('priorDvtPe', h.priorDvt || h.priorPe, 'history');
      b.affirmed('haemoptysis', f.haemoptysis, 'findings');
      b.affirmed('cancer', h.cancer, 'history');
      break;
    case 'wells-dvt':
      b.affirmed('activeCancer', h.cancer, 'history');
      b.affirmed('bedridden3Days', h.recentSurgery12w || h.immobile, 'history');
      b.affirmed('previousDvt', h.priorDvt, 'history');
      break;
    case 'caprini': {
      if (age !== null) {
        b.set('age41_60', age >= 41 && age <= 60, 'demographics');
        b.set('age61_74', age >= 61 && age <= 74, 'demographics');
        b.set('age75plus', age >= 75, 'demographics');
      }
      const bmi = recordBmi(r);
      if (bmi !== null) b.set('bmi25', bmi > t.capriniBmiAbove, 'demographics');
      else {
        if (r.heightCm === null) b.need('height');
        if (r.weightKg === null) b.need('weight');
      }
      b.affirmed('malignancy', h.cancer, 'history');
      b.affirmed('vteHistory', h.priorDvt || h.priorPe, 'history');
      b.affirmed('chf', h.chf, 'history');
      b.affirmed('ibd', h.ibd, 'history');
      b.affirmed('varicoseVeins', h.varicoseVeins, 'history');
      b.affirmed('ocp_hrt', h.ocpHrt, 'history');
      b.affirmed('pregnancy_postpartum', h.pregnant, 'history');
      break;
    }
    case 'rcri':
      b.affirmed('ischemicHeartDisease', h.ihd, 'history');
      b.affirmed('congestiveHeartFailure', h.chf, 'history');
      b.affirmed('cerebrovascularDisease', h.cva, 'history');
      b.affirmed('insulinDependentDiabetes', h.insulin, 'history');
      if (labs.creatinine !== null) b.set('creatinineAbove177', labs.creatinine > t.rcriCreatinineAbove, 'labs');
      else b.need('creatinine');
      break;
    case 'bisap': {
      if (labs.urea !== null) b.set('bunAbove25', labs.urea > t.bisapUreaAbove, 'labs'); else b.need('urea');
      const impairedAvpu = v.avpu !== null && v.avpu !== 'A';
      if (impairedAvpu || f.confusion) b.set('impairedMentalStatus', true, impairedAvpu ? 'vitals' : 'findings');
      else if (v.avpu === 'A') b.set('impairedMentalStatus', false, 'vitals');
      else b.need('avpu');
      // SIRS: ≥ 2 of temperature, HR, RR, WBC. Filled only when the known criteria decide it.
      const crit: { met: boolean | null; concept: string }[] = [
        { met: v.tempC === null ? null : v.tempC < t.sirsTempBelow || v.tempC > t.sirsTempAbove, concept: 'temp' },
        { met: v.hr === null ? null : v.hr > t.sirsHrAbove, concept: 'hr' },
        { met: v.rr === null ? null : v.rr > t.sirsRrAbove, concept: 'rr' },
        { met: labs.wbc === null ? null : labs.wbc < t.sirsWbcBelow || labs.wbc > t.sirsWbcAbove, concept: 'wbc' },
      ];
      const met = crit.filter(c => c.met === true).length;
      const unknown = crit.filter(c => c.met === null);
      if (met >= 2) b.set('sirs', true, 'vitals');
      else if (met + unknown.length < 2) b.set('sirs', false, 'vitals');
      else for (const c of unknown) b.need(c.concept);
      if (age !== null) b.set('ageAbove60', age > t.bisapAgeAbove, 'demographics');
      b.affirmed('pleuralEffusion', r.pleuralEffusion, 'imaging');
      break;
    }
    case 'tg18-cholecystitis':
    case 'tg18-cholangitis':
      if (labs.wbc === null) b.need('wbc');
      if (labs.crp === null) b.need('crp');
      if (v.tempC === null) b.need('temp');
      if (score === 'tg18-cholangitis' && labs.bilirubin === null) b.need('bilirubin');
      if (!r.imagingReported) b.need('imaging-us');
      break;
    default:
      break;
  }
  return { score, fields: b.fields, missing: b.missing };
}

/** The filled value of one field, or undefined when the record does not answer it. */
export function filledValue(fill: ScoreFill, key: string): boolean | number | undefined {
  return fill.fields.find(x => x.key === key)?.value;
}
