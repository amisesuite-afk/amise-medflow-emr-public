/**
 * Writes the shared "What's missing" test vectors:
 *   ios/AmiseMedFlowTests/WhatsMissing/whats-missing-vectors.json
 *
 * Inputs are defined here; expected outputs are what the web core (lib/pane-engine/src/whats-missing)
 * produces, reviewed by hand when generated. lib/pane-engine/src/__tests__/whats-missing.test.ts and
 * the iOS twin (ios/AmiseMedFlowTests/WhatsMissingTests.swift) assert the same values:
 *   fill   — score auto-fill from the record (record-fill.ts / WhatsMissingCore+Fill.swift)
 *   probe  — decision-layer missing inputs probed (decision-probe.ts / WhatsMissingCore+Probe.swift)
 *   rank   — the ranked, de-duplicated list (engine.ts / WhatsMissingCore.swift)
 *   terms  — the word-start term matcher and the part joiner
 *
 * The rules come from the shared file clinical-content/rules/whats-missing-rules.json (read by the web
 * core through WHATS_MISSING_RULES and by iOS through SharedClinicalContent).
 *
 * Regenerate after a deliberate rule change (version bump in clinical-content/rules/whats-missing-rules.json):
 *   pnpm --filter @workspace/scripts run gen:whats-missing-vectors
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WHATS_MISSING_VERSION, decisionGaps, joinParts, scoreRecordFill, termIn, whatsMissing,
} from '../../lib/pane-engine/src/index';
import type {
  DecisionGap, DecisionInput, DecisionPatient, MissingFacts, MissingRecord, WhatsMissingInput,
} from '../../lib/pane-engine/src/index';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
export const WM_VECTORS_FILE = join(REPO_ROOT, 'ios/AmiseMedFlowTests/WhatsMissing/whats-missing-vectors.json');

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

export function emptyRecord(): MissingRecord {
  return {
    ageYears: null, sex: 'unknown', weightKg: null, heightCm: null,
    vitals: { hr: null, sbp: null, dbp: null, rr: null, tempC: null, spo2: null, avpu: null, onOxygen: null },
    labs: { wbc: null, neutrophils: null, crp: null, urea: null, hb: null, creatinine: null, egfr: null, bilirubin: null, albumin: null, inr: null },
    imagingReported: false, pleuralEffusion: false,
    history: {
      cancer: false, priorDvt: false, priorPe: false, chf: false, ihd: false, cva: false, insulin: false, liverDisease: false,
      ibd: false, varicoseVeins: false, ocpHrt: false, immobile: false, pregnant: false, recentSurgery4w: false, recentSurgery12w: false,
    },
    findings: {
      migration: false, anorexia: false, nausea: false, vomiting: false, rifPain: false, rifTenderness: false, rebound: false,
      melaena: false, syncope: false, haemoptysis: false, dvtSigns: false, confusion: false,
    },
  };
}

function rec(p: DeepPartial<MissingRecord>): MissingRecord {
  const e = emptyRecord();
  return {
    ...e, ...p,
    vitals: { ...e.vitals, ...(p.vitals ?? {}) },
    labs: { ...e.labs, ...(p.labs ?? {}) },
    history: { ...e.history, ...(p.history ?? {}) },
    findings: { ...e.findings, ...(p.findings ?? {}) },
  } as MissingRecord;
}

const FULL_VITALS = { hr: 88, sbp: 128, dbp: 76, rr: 16, tempC: 36.9, spo2: 98, avpu: 'A' as const, onOxygen: false };

export function emptyFacts(): MissingFacts {
  return {
    allergyStatusRecorded: true, pregnancyStatusRecorded: false, supplementsAsked: true, medications: [], plannedMedications: [],
    medicationNotes: '', plannedInvestigations: [], procedurePlanned: false, acute: false,
  };
}

function inp(record: MissingRecord, facts: Partial<MissingFacts> = {}, rest: Partial<Omit<WhatsMissingInput, 'record' | 'facts'>> = {}): WhatsMissingInput {
  return { record, facts: { ...emptyFacts(), ...facts }, activeScores: [], decisionGaps: [], ferritinMissing: false, discriminator: null, ...rest };
}

// ── fill ────────────────────────────────────────────────────────────────────────────────────

const FILL: { id: string; score: string; record: MissingRecord }[] = [
  { id: 'alvarado-empty', score: 'alvarado', record: rec({ ageYears: 22, sex: 'male' }) },
  { id: 'alvarado-full', score: 'alvarado', record: rec({ ageYears: 22, sex: 'male', vitals: { tempC: 37.8 }, labs: { wbc: 14.2, neutrophils: 82 }, findings: { migration: true, nausea: true, rifTenderness: true, rebound: true } }) },
  { id: 'alvarado-absolute-neutrophils', score: 'alvarado', record: rec({ vitals: { tempC: 37.2 }, labs: { wbc: 12000, neutrophils: 9.6 } }) },
  { id: 'air-labs', score: 'air', record: rec({ vitals: { tempC: 38.6 }, labs: { wbc: 16.1, neutrophils: 86, crp: 62 }, findings: { vomiting: true, rifPain: true } }) },
  { id: 'air-mid-bands', score: 'air', record: rec({ vitals: { tempC: 38.0 }, labs: { wbc: 11, neutrophils: 72, crp: 20 } }) },
  { id: 'air-missing', score: 'air', record: rec({ findings: { rifTenderness: true } }) },
  { id: 'gbs-full', score: 'glasgow-blatchford', record: rec({ sex: 'male', vitals: { sbp: 96, hr: 112 }, labs: { urea: 11.2, hb: 98 }, findings: { melaena: true }, history: { liverDisease: true } }) },
  { id: 'gbs-missing-labs', score: 'glasgow-blatchford', record: rec({ sex: 'female', vitals: { sbp: 120, hr: 80 } }) },
  { id: 'curb65-avpu-confused', score: 'curb65', record: rec({ ageYears: 78, vitals: { rr: 32, sbp: 100, dbp: 58, avpu: 'C' }, labs: { urea: 9 } }) },
  { id: 'curb65-missing', score: 'curb65', record: rec({ ageYears: 50 }) },
  { id: 'wells-pe', score: 'wells-pe', record: rec({ vitals: { hr: 118 }, history: { recentSurgery4w: true, cancer: true }, findings: { haemoptysis: true } }) },
  { id: 'wells-pe-no-hr', score: 'wells-pe', record: rec({ history: { priorPe: true } }) },
  { id: 'wells-dvt', score: 'wells-dvt', record: rec({ history: { cancer: true, immobile: true, priorDvt: true } }) },
  { id: 'caprini-bmi', score: 'caprini', record: rec({ ageYears: 67, weightKg: 96, heightCm: 170, history: { varicoseVeins: true, ocpHrt: true } }) },
  { id: 'caprini-no-height', score: 'caprini', record: rec({ ageYears: 45, weightKg: 70 }) },
  { id: 'rcri-creatinine-mgdl', score: 'rcri', record: rec({ labs: { creatinine: 2.4 }, history: { ihd: true, insulin: true } }) },
  { id: 'rcri-missing', score: 'rcri', record: rec({ history: { cva: true } }) },
  { id: 'bisap-sirs-met', score: 'bisap', record: rec({ ageYears: 64, vitals: { tempC: 38.4, hr: 104, avpu: 'A' }, labs: { urea: 10.1 }, pleuralEffusion: true }) },
  { id: 'bisap-sirs-undecided', score: 'bisap', record: rec({ ageYears: 40, vitals: { hr: 96 } }) },
  { id: 'bisap-sirs-not-met', score: 'bisap', record: rec({ ageYears: 40, vitals: { tempC: 37, hr: 80, rr: 14, avpu: 'V' }, labs: { urea: 5 } }) },
  { id: 'tg18-cholecystitis-missing', score: 'tg18-cholecystitis', record: rec({ vitals: { tempC: 38.2 } }) },
  { id: 'tg18-cholangitis-missing', score: 'tg18-cholangitis', record: rec({ labs: { wbc: 15 }, imagingReported: true }) },
  { id: 'news2-partial', score: 'news2', record: rec({ vitals: { hr: 100, sbp: 110, tempC: 37.9 } }) },
  { id: 'qsofa-partial', score: 'qsofa', record: rec({ vitals: { sbp: 95 } }) },
];

// ── probe ───────────────────────────────────────────────────────────────────────────────────

const FIT: DecisionPatient = {
  ageYears: 45, sex: 'female', cfs: null, asa: null, egfr: null, bmi: null, news2: null, sbp: null,
  anticoagulant: 'none', antiplatelet: false, hasBled: null, pregnancy: 'not-pregnant', allergyClasses: [],
  diabetes: false, immunosuppressed: false, recentSurgeryDays: null, procedurePlanned: false,
  appendicolith: false, mechanicalValve: false, recentVte3m: false,
};

const PROBE: { id: string; description: string; input: DecisionInput }[] = [
  { id: 'chole-78-nothing-recorded', description: '78-year-old, confirmed cholecystitis, no CFS / ASA / eGFR / BMI / NEWS2: probes flip early laparoscopic cholecystectomy.',
    input: { patient: { ...FIT, ageYears: 78 }, diagnoses: [{ name: 'Acute cholecystitis', id: 'cholecystitis', icd10: 'K81.0', probability: 0.62, confirmed: true }], scores: [], labs: {} } },
  { id: 'chole-45-fit-recorded', description: 'Fit 45-year-old with everything recorded: no gaps.',
    input: { patient: { ...FIT, asa: 1, egfr: 95, bmi: 26, news2: 1, sbp: 128 }, diagnoses: [{ name: 'Acute cholecystitis', id: 'cholecystitis', icd10: 'K81.0', probability: 0.62, confirmed: true }], scores: [], labs: {} } },
  { id: 'appendicitis-woman-30-pregnancy-unknown', description: 'Woman 30, confirmed appendicitis, pregnancy unknown.',
    input: { patient: { ...FIT, ageYears: 30, pregnancy: 'unknown', asa: 1, egfr: 110, bmi: 24, news2: 2, sbp: 120 }, diagnoses: [{ name: 'Acute appendicitis', id: 'appendicitis', icd10: 'K35.80', probability: 0.7, confirmed: true }], scores: [], labs: {} } },
  { id: 'ugib-no-gbs', description: 'Upper GI bleed confirmed, no Glasgow-Blatchford: risk score gap.',
    input: { patient: { ...FIT, ageYears: 60, sex: 'male', egfr: 80, news2: 3, sbp: 118 }, diagnoses: [{ name: 'Upper GI bleed', id: 'upper_gi_bleed', icd10: 'K92.2', probability: 0.8, confirmed: true }], scores: [], labs: {} } },
  { id: 'hernia-82', description: 'Inguinal hernia, 82-year-old, no frailty recorded.',
    input: { patient: { ...FIT, ageYears: 82, sex: 'male', egfr: 70, news2: 0, sbp: 140, bmi: 25 }, diagnoses: [{ name: 'Inguinal hernia', id: 'inguinal_hernia', icd10: 'K40.90', probability: 0.9, confirmed: true }], scores: [], labs: {} } },
];

// ── rank ────────────────────────────────────────────────────────────────────────────────────

const flipGap = (key: string, decisionId: string, decisionLabel: string, option: string, from: 'treat' | 'observe' | 'test', to: 'treat' | 'observe' | 'test', distance: number): DecisionGap =>
  ({ key, decisionId, decisionLabel, effect: '', flip: { option, from, to }, distance });

const RANK: { id: string; description: string; input: WhatsMissingInput }[] = [
  { id: 'nothing-missing', description: 'Adult, allergies recorded, full observations, nothing planned: empty list.',
    input: inp(rec({ ageYears: 40, sex: 'male', vitals: FULL_VITALS })) },
  { id: 'child-no-weight', description: 'Child 6 without weight or allergy status: weight first, then allergy.',
    input: inp(rec({ ageYears: 6, sex: 'male', vitals: { hr: 110, tempC: 38.1 } }), { allergyStatusRecorded: false, plannedMedications: ['Paracetamol'] }) },
  { id: 'woman-30-ct-planned', description: 'Woman 30 with CT abdomen planned, pregnancy not recorded: pregnancy status first.',
    input: inp(rec({ ageYears: 30, sex: 'female', vitals: FULL_VITALS }), { plannedInvestigations: ['CT abdomen and pelvis with contrast'] }) },
  { id: 'woman-60-ct-planned', description: 'Woman 60: outside 12–55, no pregnancy item; contrast CT without eGFR → renal function.',
    input: inp(rec({ ageYears: 60, sex: 'female', vitals: FULL_VITALS }), { plannedInvestigations: ['CT abdomen and pelvis with contrast'] }) },
  { id: 'nsaid-no-egfr', description: 'Ibuprofen planned without eGFR: renal function (safety) merges with BISAP urea.',
    input: inp(rec({ ageYears: 50, sex: 'male', vitals: FULL_VITALS }), { plannedMedications: ['Ibuprofen 400 mg TDS'] }, { activeScores: ['bisap'] }) },
  { id: 'cholecystitis-no-wbc', description: 'Cholecystitis, TG18 recommended, no WBC / CRP / imaging: FBC first (needed by the most scores).',
    input: inp(rec({ ageYears: 45, sex: 'male', vitals: FULL_VITALS }), {}, { activeScores: ['tg18-cholecystitis', 'alvarado'] }) },
  { id: 'news2-partial-with-curb', description: 'Partial observations plus CURB-65 needing RR and urea: one observations item.',
    input: inp(rec({ ageYears: 70, sex: 'male', vitals: { hr: 104, sbp: 100, tempC: 38.3 } }), {}, { activeScores: ['curb65'] }) },
  { id: 'no-obs-acute', description: 'Emergency, no observations: whole NEWS2 set.',
    input: inp(rec({ ageYears: 35, sex: 'male' }), { acute: true }) },
  { id: 'no-obs-clinic', description: 'Clinic, no observations and no score needing them: nothing.',
    input: inp(rec({ ageYears: 35, sex: 'male' })) },
  { id: 'procedure-anticoag', description: 'Procedure on warfarin, supplements not asked, no last dose: anticoagulant then supplements.',
    input: inp(rec({ ageYears: 70, sex: 'male', vitals: FULL_VITALS, labs: { egfr: 60 } }), { procedurePlanned: true, supplementsAsked: false, medications: ['Warfarin 3 mg OD'], pregnancyStatusRecorded: true }) },
  { id: 'procedure-anticoag-last-dose', description: 'Last dose documented: no anticoagulant item.',
    input: inp(rec({ ageYears: 70, sex: 'male', vitals: FULL_VITALS, labs: { egfr: 60 } }), { procedurePlanned: true, medications: ['Apixaban 5 mg BD'], medicationNotes: 'Apixaban last dose 08:00 yesterday' }) },
  { id: 'decision-flip-and-score', description: 'A decision flip ranks above score completeness; eGFR flip merges into the renal item.',
    input: inp(rec({ ageYears: 78, sex: 'female', vitals: FULL_VITALS }), { pregnancyStatusRecorded: true }, {
      activeScores: ['tg18-cholecystitis'],
      decisionGaps: [
        flipGap('cfs', 'cholecystitis', 'Acute cholecystitis', 'Early laparoscopic cholecystectomy', 'treat', 'observe', 0.21),
        flipGap('egfr', 'cholecystitis', 'Acute cholecystitis', 'Early laparoscopic cholecystectomy', 'treat', 'test', 0.08),
        { key: 'asa', decisionId: 'cholecystitis', decisionLabel: 'Acute cholecystitis', effect: 'ASA III-IV raises operative harm', flip: null, distance: null },
      ],
    }) },
  { id: 'risk-score-gap', description: 'Decision needs a risk score (Glasgow-Blatchford) and the reasoning discriminator is a lab.',
    input: inp(rec({ ageYears: 60, sex: 'male', vitals: FULL_VITALS, labs: { urea: 7, hb: 11 } }), {}, {
      decisionGaps: [{ key: 'score:glasgow-blatchford', decisionId: 'upper-gi-bleed', decisionLabel: 'Upper GI bleeding', effect: '', flip: null, distance: null }],
      discriminator: { label: 'Serum lipase', kind: 'lab', separates: ['Acute pancreatitis', 'Peptic ulcer disease', 'Biliary colic'], confirmed: false },
    }) },
  { id: 'ferritin', description: 'NG12 ferritin prompt and an "ask" discriminator.',
    input: inp(rec({ ageYears: 66, sex: 'female', vitals: FULL_VITALS, labs: { hb: 9.8 } }), { pregnancyStatusRecorded: true }, {
      ferritinMissing: true,
      discriminator: { label: 'Change in bowel habit', kind: 'ask', separates: ['Colorectal cancer', 'Iron deficiency anaemia'], confirmed: false },
    }) },
  { id: 'pregnancy-merge', description: 'Pregnancy from safety (procedure) and from the decision layer: one item, safety tier.',
    input: inp(rec({ ageYears: 30, sex: 'female', vitals: FULL_VITALS, labs: { egfr: 100 } }), { procedurePlanned: true }, {
      decisionGaps: [flipGap('pregnancy', 'appendicitis', 'Appendicitis', 'Appendicectomy', 'treat', 'test', 0.3)],
    }) },
  { id: 'discriminator-after-confirmation', description: 'Confirmed diagnosis: the discriminator ranks after score completeness.',
    input: inp(rec({ ageYears: 50, sex: 'male', vitals: FULL_VITALS }), {}, {
      activeScores: ['tg18-cholecystitis'],
      discriminator: { label: 'Episodic / intermittent pain', kind: 'ask', separates: ['Acute cholecystitis', 'Biliary colic'], confirmed: true },
    }) },
  { id: 'bmi-refine', description: 'BMI missing without a flip: score tier, height and weight.',
    input: inp(rec({ ageYears: 50, sex: 'male', vitals: FULL_VITALS }), {}, {
      activeScores: ['caprini'],
      decisionGaps: [{ key: 'bmi', decisionId: 'inguinal-hernia', decisionLabel: 'Elective inguinal hernia repair', effect: 'BMI 40 or more raises operative harm', flip: null, distance: null }],
    }) },
  { id: 'many-items', description: 'More than five items: ranked order across tiers.',
    input: inp(rec({ ageYears: 14, sex: 'female', vitals: { hr: 120 } }), {
      allergyStatusRecorded: false, supplementsAsked: false, procedurePlanned: true, plannedMedications: ['Ibuprofen'],
      plannedInvestigations: ['CT abdomen'], medications: [],
    }, { activeScores: ['alvarado', 'air'], ferritinMissing: false,
      discriminator: { label: 'Ultrasound abdomen', kind: 'imaging', separates: ['Acute appendicitis', 'Ovarian torsion'], confirmed: false } }) },
];

const TERMS: { text: string; term: string }[] = [
  { text: 'CT abdomen', term: 'ct' }, { text: 'Acute abdomen', term: 'ct' }, { text: 'Initial TIA 2019', term: 'tia' },
  { text: 'Initial assessment', term: 'tia' }, { text: 'Ibuprofen 400mg', term: 'ibuprofen' }, { text: 'NSAIDs regularly', term: 'nsaid' },
  { text: 'enoxaparin 40 mg', term: 'heparin' }, { text: 'CTPA tomorrow', term: 'ctpa' }, { text: 'x-ray chest', term: 'x-ray' },
];
const PARTS: string[][] = [[], ['a'], ['a', 'b'], ['RR', 'SpO₂', 'temperature']];

export function buildWhatsMissingVectors() {
  return {
    version: WHATS_MISSING_VERSION,
    fill: FILL.map(v => ({ ...v, expected: scoreRecordFill(v.score, v.record) })),
    probe: PROBE.map(v => ({ ...v, expected: decisionGaps(v.input) })),
    rank: RANK.map(v => ({ ...v, expected: whatsMissing(v.input) })),
    terms: TERMS.map(v => ({ ...v, expected: termIn(v.text, v.term) })),
    parts: PARTS.map(p => ({ parts: p, expected: joinParts(p) })),
  };
}

if (process.argv[1] && process.argv[1].endsWith('gen-whats-missing-vectors.ts')) {
  mkdirSync(dirname(WM_VECTORS_FILE), { recursive: true });
  writeFileSync(WM_VECTORS_FILE, `${JSON.stringify(buildWhatsMissingVectors(), null, 2)}\n`);
  console.log(`Wrote ${WM_VECTORS_FILE}`);
}
