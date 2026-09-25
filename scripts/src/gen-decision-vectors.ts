/**
 * Writes the shared decision-support test vectors:
 *   ios/AmiseMedFlowTests/DecisionSupport/decision-vectors.json
 *
 * The inputs below are the vectors; the expected outputs are what the web engine
 * (lib/pane-engine/src/decision) produces for them, reviewed by hand when generated. Both
 * lib/pane-engine/src/__tests__/decision.test.ts and the iOS twin
 * (ios/AmiseMedFlowTests/TreatmentDecisionTests.swift) assert the same expected values, so a change
 * to either engine that moves a band, a threshold or a ranking fails on that platform.
 *
 * Regenerate after a deliberate content change (version bump in treatment-decisions.json):
 *   pnpm --filter @workspace/scripts run gen:decision-vectors
 * and review the diff before committing.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DECISION_CONTENT, decisionSupport } from '../../lib/pane-engine/src/index';
import type {
  DecisionDiagnosis, DecisionInput, DecisionPatient, DecisionScore, DecisionSupportResult,
} from '../../lib/pane-engine/src/index';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
export const VECTORS_FILE = join(REPO_ROOT, 'ios/AmiseMedFlowTests/DecisionSupport/decision-vectors.json');

const FIT: DecisionPatient = {
  ageYears: 45, sex: 'female', cfs: null, asa: null, egfr: null, bmi: null, news2: null, sbp: null,
  anticoagulant: 'none', antiplatelet: false, hasBled: null, pregnancy: 'not-pregnant', allergyClasses: [],
  diabetes: false, immunosuppressed: false, recentSurgeryDays: null, procedurePlanned: false,
  appendicolith: false, mechanicalValve: false, recentVte3m: false,
};

function dx(name: string, id: string | null, icd10: string | null, probability: number | null, confirmed: boolean): DecisionDiagnosis {
  return { name, id, icd10, probability, confirmed };
}
function sc(key: string, value: number, extra: Partial<DecisionScore> = {}): DecisionScore {
  return { key, value, source: 'calculator', ...extra };
}

interface VectorDef { id: string; description: string; input: DecisionInput }

const CHOLE = dx('Acute cholecystitis', 'cholecystitis', 'K81.0', 0.62, true);

export const VECTOR_DEFS: VectorDef[] = [
  { id: 'chole-fit-confirmed', description: 'Fit 45-year-old, confirmed acute cholecystitis: early laparoscopic cholecystectomy ranks first.',
    input: { patient: { ...FIT, asa: 1, egfr: 95, bmi: 26, news2: 1, sbp: 128 }, diagnoses: [CHOLE], scores: [], labs: {} } },
  { id: 'chole-frail-88', description: 'Frail 88-year-old (CFS 7, ASA IV, eGFR 28): drainage over early laparoscopic cholecystectomy.',
    input: { patient: { ...FIT, ageYears: 88, cfs: 7, asa: 4, egfr: 28, bmi: 22, news2: 3, sbp: 118 }, diagnoses: [CHOLE], scores: [], labs: {} } },
  { id: 'chole-unconfirmed-40', description: 'Cholecystitis 40% (engine), not confirmed: test further (ultrasound).',
    input: { patient: { ...FIT, asa: 1, egfr: 95, bmi: 26, news2: 1, sbp: 128 },
      diagnoses: [dx('Acute cholecystitis', 'cholecystitis', 'K81.0', 0.4, false), dx('Biliary colic', 'biliary_colic', 'K80.20', 0.3, false)], scores: [], labs: {} } },
  { id: 'chole-engine-below-min', description: 'Cholecystitis at 6% (below the 10% floor) is not a leading diagnosis: no decision.',
    input: { patient: FIT, diagnoses: [dx('Acute cholecystitis', 'cholecystitis', null, 0.06, false)], scores: [], labs: {} } },
  { id: 'appendicitis-fit', description: 'Fit adult, confirmed appendicitis: appendicectomy ranks above antibiotics-first.',
    input: { patient: { ...FIT, ageYears: 30, sex: 'male', asa: 1, egfr: 110, bmi: 24, news2: 2, sbp: 124 },
      diagnoses: [dx('Acute appendicitis', 'appendicitis', 'K35.80', 0.7, true)], scores: [sc('alvarado', 8)], labs: {} } },
  { id: 'appendicitis-pregnant', description: 'Pregnant 28 weeks: antibiotics-first benefit lowered, operative harm raised.',
    input: { patient: { ...FIT, ageYears: 29, pregnancy: 'pregnant', asa: 1, egfr: 120, bmi: 27, news2: 2, sbp: 110 },
      diagnoses: [dx('Acute appendicitis', 'appendicitis', 'K35.80', 0.7, true)], scores: [], labs: {} } },
  { id: 'appendicitis-appendicolith', description: 'Appendicolith on CT lowers the antibiotics-first benefit.',
    input: { patient: { ...FIT, ageYears: 35, sex: 'male', appendicolith: true, asa: 1, egfr: 100, bmi: 25, news2: 1, sbp: 130 },
      diagnoses: [dx('Acute appendicitis', 'appendicitis', 'K35.80', 0.8, true)], scores: [], labs: {} } },
  { id: 'diverticulitis-fit', description: 'Fit adult, uncomplicated diverticulitis: observe (no routine antibiotics, outpatient).',
    input: { patient: { ...FIT, ageYears: 52, news2: 1, sbp: 132 }, diagnoses: [dx('Acute uncomplicated diverticulitis', 'diverticulitis', 'K57.32', 0.8, true)], scores: [], labs: {} } },
  { id: 'diverticulitis-immunosuppressed-penicillin', description: 'Immunosuppressed and penicillin-allergic: antibiotics now indicated (non-penicillin regimen), admission favoured.',
    input: { patient: { ...FIT, ageYears: 60, immunosuppressed: true, allergyClasses: ['penicillin'], news2: 2, sbp: 124 },
      diagnoses: [dx('Acute diverticulitis', 'diverticulitis', 'K57.32', 0.8, true)], scores: [], labs: {} } },
  { id: 'pe-wells-unlikely', description: 'Wells PE 3 (unlikely): pre-test 12%, test further; no thrombolysis.',
    input: { patient: { ...FIT, egfr: 90, news2: 2, sbp: 126, hasBled: 0 }, diagnoses: [], scores: [sc('wells-pe', 3)], labs: {} } },
  { id: 'pe-shock-recent-surgery', description: 'Confirmed PE with shock 5 days after surgery: thrombolysis not for this patient (ESC 2019), anticoagulation harm raised.',
    input: { patient: { ...FIT, ageYears: 62, sbp: 82, recentSurgeryDays: 5, egfr: 70, hasBled: 1 },
      diagnoses: [dx('Pulmonary embolism', 'pulmonary_embolism', 'I26.99', 0.8, true)], scores: [sc('wells-pe', 7.5)], labs: {} } },
  { id: 'pe-shock-anticoagulated-egfr25', description: 'Confirmed PE with shock on warfarin + aspirin, eGFR 25: thrombolysis stays a treat option with raised harm; anticoagulation harm raised.',
    input: { patient: { ...FIT, ageYears: 70, sex: 'male', sbp: 84, anticoagulant: 'vka', antiplatelet: true, egfr: 25, hasBled: 3 },
      diagnoses: [dx('Pulmonary embolism', 'pulmonary_embolism', 'I26.99', 0.9, true)], scores: [], labs: { lactate: 3.1 } } },
  { id: 'vte-caprini-1', description: 'Caprini 1: mechanical prophylaxis; LMWH observe.',
    input: { patient: { ...FIT, egfr: 90 }, diagnoses: [], scores: [sc('caprini', 1)], labs: {} } },
  { id: 'vte-caprini-6', description: 'Caprini 6: LMWH with mechanical prophylaxis ranks first.',
    input: { patient: { ...FIT, egfr: 90 }, diagnoses: [], scores: [sc('caprini', 6)], labs: {} } },
  { id: 'vte-caprini-6-anticoagulated', description: 'Caprini 6 on a DOAC: prophylactic LMWH not for this patient.',
    input: { patient: { ...FIT, anticoagulant: 'doac', egfr: 90, hasBled: 2 }, diagnoses: [], scores: [sc('caprini', 6)], labs: {} } },
  { id: 'ugib-gbs-1', description: 'Glasgow-Blatchford 1: outpatient management (observe).',
    input: { patient: { ...FIT, news2: 0, sbp: 130 }, diagnoses: [dx('Upper GI bleed', 'upper_gi_bleed', 'K92.2', 0.6, false)], scores: [sc('glasgow-blatchford', 1)], labs: {} } },
  { id: 'ugib-gbs-13-shock', description: 'Glasgow-Blatchford 13 with shock: admit, endoscopy within 12 h after resuscitation.',
    input: { patient: { ...FIT, ageYears: 71, sex: 'male', sbp: 86, news2: 8 }, diagnoses: [dx('Upper GI bleed', 'upper_gi_bleed', 'K92.2', 0.9, true)],
      scores: [sc('glasgow-blatchford', 13), sc('rockall', 6)], labs: { haemoglobin: 64 } } },
  { id: 'ugib-no-gbs', description: 'Upper GI bleed without a Glasgow-Blatchford score: risk unknown, calculate the score.',
    input: { patient: { ...FIT, news2: 2, sbp: 118 }, diagnoses: [dx('Upper GI bleed', 'upper_gi_bleed', 'K92.2', 0.5, false)], scores: [], labs: {} } },
  { id: 'sepsis-no-shock', description: 'Possible sepsis 30%, no shock: observe (rapid assessment, antibiotics within 3 h if concern persists).',
    input: { patient: { ...FIT, news2: 4, sbp: 112 }, diagnoses: [dx('Sepsis', 'sepsis', 'A41.9', 0.3, false)], scores: [sc('qsofa', 1)], labs: {} } },
  { id: 'sepsis-shock-lactate', description: 'Possible sepsis 30% with lactate 5: antibiotics within 1 h (treat); lactate result action.',
    input: { patient: { ...FIT, news2: 7, sbp: 96 }, diagnoses: [dx('Sepsis', 'sepsis', 'A41.9', 0.3, false)], scores: [sc('qsofa', 2)], labs: { lactate: 5 } } },
  { id: 'bridging-warfarin-af', description: 'Warfarin for AF before surgery: no bridging (BRIDGE).',
    input: { patient: { ...FIT, ageYears: 72, anticoagulant: 'vka', procedurePlanned: true, egfr: 65, hasBled: 2 }, diagnoses: [], scores: [], labs: {} } },
  { id: 'bridging-mechanical-valve', description: 'Warfarin with a mechanical valve before surgery: bridging (borderline).',
    input: { patient: { ...FIT, ageYears: 58, anticoagulant: 'vka', procedurePlanned: true, mechanicalValve: true, egfr: 80, hasBled: 1 }, diagnoses: [], scores: [], labs: {} } },
  { id: 'bridging-doac', description: 'DOAC before surgery: bridging not for this patient (PAUSE).',
    input: { patient: { ...FIT, ageYears: 68, anticoagulant: 'doac', procedurePlanned: true, egfr: 70, hasBled: 1 }, diagnoses: [], scores: [], labs: {} } },
  { id: 'laparotomy-frail-egfr28', description: 'Perforated ulcer, age 84, CFS 6, eGFR 28: laparotomy harm raised, borderline.',
    input: { patient: { ...FIT, ageYears: 84, sex: 'male', cfs: 6, egfr: 28, asa: 3, bmi: 24, news2: 6, sbp: 104 },
      diagnoses: [dx('Perforated peptic ulcer', 'perforated_peptic_ulcer', 'K27.5', 0.85, true)], scores: [], labs: {} } },
  { id: 'pancreatitis-severe-lipase', description: 'Gallstone pancreatitis, Glasgow-Imrie 4, lipase 1450: same-admission cholecystectomy deferred; lipase result action.',
    input: { patient: { ...FIT, asa: 2, egfr: 85, bmi: 31, news2: 3, sbp: 122 },
      diagnoses: [dx('Acute gallstone pancreatitis', 'pancreatitis', 'K85.1', 0.9, true)], scores: [sc('glasgow-imrie', 4)], labs: { lipase: 1450 } } },
  { id: 'pancreatitis-mild', description: 'Mild gallstone pancreatitis: same-admission cholecystectomy (PONCHO).',
    input: { patient: { ...FIT, asa: 2, egfr: 85, bmi: 31, news2: 1, sbp: 122 },
      diagnoses: [dx('Acute gallstone pancreatitis', 'pancreatitis', 'K85.1', 0.9, true)], scores: [sc('glasgow-imrie', 1)], labs: { lipase: 900 } } },
  { id: 'hernia-fit', description: 'Fit 50-year-old man, inguinal hernia: repair.',
    input: { patient: { ...FIT, ageYears: 50, sex: 'male', asa: 1, egfr: 95, bmi: 25, news2: 0, sbp: 130 },
      diagnoses: [dx('Inguinal hernia', 'inguinal_hernia', 'K40.90', 0.9, true)], scores: [], labs: {} } },
  { id: 'hernia-frail', description: 'Frail 86-year-old man (CFS 7): watchful waiting.',
    input: { patient: { ...FIT, ageYears: 86, sex: 'male', cfs: 7, asa: 3, egfr: 50, bmi: 23, news2: 1, sbp: 140 },
      diagnoses: [dx('Inguinal hernia', 'inguinal_hernia', 'K40.90', 0.9, true)], scores: [], labs: {} } },
  { id: 'scores-and-results', description: 'Score and result actions only: CURB-65 3, NEWS2 single red parameter, K 6.8, Hb 65, troponin 40, amylase superseded by lipase.',
    input: { patient: FIT, diagnoses: [],
      scores: [sc('news2', 3, { source: 'record', redParameter: true }), sc('curb65', 3), sc('lrinec', 9), sc('tg18-cholangitis', 2), sc('unknown-score', 4)],
      labs: { potassium: 6.8, haemoglobin: 65, troponin: 40, amylase: 900, lipase: 400 } } },
  { id: 'scores-local-uln', description: 'Local ULN: lipase 400 with ULN 160 is below 3 x ULN; troponin 40 with URL 50 is not raised.',
    input: { patient: FIT, diagnoses: [], scores: [sc('wells-dvt', 2), sc('rcri', 2), sc('caprini', 3, { source: 'record' }), sc('caprini', 0, { source: 'autofill' })],
      labs: { lipase: 400, troponin: 40, lactate: 2.5, potassium: 6.1 }, uln: { lipase: 160, troponin: 50 } } },
];

/** The fields both platforms compare (numbers to 4 dp, strings exactly). */
export function expectedOf(r: DecisionSupportResult) {
  return {
    activeFactors: r.activeFactors,
    scoreActions: r.scoreActions.map(s => ({ id: s.id, chip: s.chip, band: s.band, level: s.level, addAs: s.addAs })),
    resultActions: r.resultActions.map(s => ({ id: s.id, chip: s.chip, thresholdText: s.thresholdText })),
    decisions: r.decisions.map(d => ({
      id: d.id, probability: d.probability, probabilitySource: d.probabilitySource, chip: d.chip,
      missing: d.missing,
      options: d.options.map(o => ({
        id: o.id, band: o.band, bandRange: o.bandRange, rank: o.rank,
        treatThreshold: o.treatThreshold, testThreshold: o.testThreshold,
        benefit: o.benefit, harm: o.harm, net: o.net,
        topFactors: o.topFactors.map(f => f.modifierId), factorSummary: o.factorSummary,
        excluded: o.excludedReason !== null,
      })),
    })),
  };
}

export function buildVectors() {
  return {
    $comment: 'Shared decision-support vectors (web: lib/pane-engine/src/__tests__/decision.test.ts; iOS: ios/AmiseMedFlowTests/TreatmentDecisionTests.swift). Generated by scripts/src/gen-decision-vectors.ts — regenerate only after a deliberate content change and review the diff.',
    schemaVersion: 1,
    contentVersion: DECISION_CONTENT.version,
    vectors: VECTOR_DEFS.map(v => ({ id: v.id, description: v.description, input: v.input, expected: expectedOf(decisionSupport(v.input, DECISION_CONTENT)) })),
  };
}

if (process.argv[1] && process.argv[1].endsWith('gen-decision-vectors.ts')) {
  writeFileSync(VECTORS_FILE, `${JSON.stringify(buildVectors(), null, 2)}\n`);
  console.log(`wrote ${VECTORS_FILE} (${VECTOR_DEFS.length} vectors)`);
}
