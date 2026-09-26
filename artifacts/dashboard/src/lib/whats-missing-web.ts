/**
 * "What's missing" — the dashboard adapter: reads the consultation (AppContext fields) into the
 * shared core's input (lib/pane-engine/src/whats-missing), and the score auto-fill record the
 * Scales-step calculators pre-fill from.
 *
 * Every signal comes from an engine that already exists: NEWS2 parameters, the score inputs of the
 * scores getCdsSuggestions recommends (or the clinician recorded), the decision layer's missing
 * inputs (probed: decision-probe.ts), the reasoning panel's best next discriminator
 * (paneDiscriminators, as DiagnosticReasoningPanel), the NG12 / BSG ferritin prompt
 * (computePreventivePrompts) and the safety basics.
 *
 * Pure and deterministic (no '@/' imports: the clinval web runner calls it). Nothing here writes
 * to the record. iOS twin: ios/AmiseMedFlow/Services/WhatsMissingPatient.swift.
 */

import {
  DISEASES, WHATS_MISSING_RULES, applyModifiers, decisionGaps, pregnancyFor, termIn, termsFound, whatsMissing,
} from '@workspace/pane-engine';
import type {
  DiseaseNode, FindingFlag, HistoryFlag, MissingAvpu, MissingDiscriminator, MissingFacts, MissingRecord, PaneState,
  WhatsMissingInput, WhatsMissingResult,
} from '@workspace/pane-engine';
import { containsAnyAffirmed, joinClauses } from '@workspace/triage-engine';
import { getCdsSuggestions } from './clinical-cds';
import type { CdsContext } from './clinical-cds';
import type { InferenceInput } from './clinical-inference';
import { decisionInput, planSafetyLineFilter, recordedDecisionScores } from './decision-support';
import type { DecisionConsultation } from './decision-support';
import { paneDiscriminators, resolveWorkingNode } from './diagnostic-reasoning';
import { allergyStatus } from './allergy-status';
import { planPatientContext, splitList } from './plan-builder';
import { computePreventivePrompts } from './preventive-screening-prompts';

/** CDS scale keys → canonical score keys (the clinval runner's WEB_SCALE_TO_CANONICAL subset). */
export const CDS_TO_SCORE: Record<string, string> = {
  alvarado: 'alvarado', glasgowBlatchford: 'glasgow-blatchford', curb65: 'curb65', wellsPe: 'wells-pe', wellsDvt: 'wells-dvt',
  caprini: 'caprini', rcri: 'rcri', bisap: 'bisap', tg18Cholecystitis: 'tg18-cholecystitis', tg18Cholangitis: 'tg18-cholangitis',
  news2: 'news2', qsofa: 'qsofa',
};

/** The consultation fields the strip reads (AppContext names; all optional for the harness). */
export interface MissingConsultation extends DecisionConsultation {
  plan?: string;
  symptoms?: string[];
  examGeneral?: string; examAbdomen?: string; examCardio?: string; examResp?: string; examNeuro?: string;
  examExtremities?: string; examBreast?: string; examWound?: string;
  examFindings?: Record<string, string[]>;
  rosFindings?: Record<string, { status: string; details: string[] }>;
  procedureData?: Record<string, unknown>;
  familyHistory?: string[];
  toxicHabits?: string[];
  surgicalNotes?: string;
  vitalRecords?: { timestamp: string; weight?: string }[];
  labRecords?: { tests: { name: string; value: string }[] }[];
  orderedInvestigations?: string[];
  radiologyRequests?: { modality: string; anatomicalRegion: string; resultReceived: boolean; resultNotes: string; indication?: string }[];
  pendingPrescriptions?: { drugName: string }[];
  supplementHistory?: { status: string };
  visitType?: string;
  encounterType?: string;
  encounterMode?: string;
}

// ── Lab values ──────────────────────────────────────────────────────────────────────────────

const LAB_NAMES: Record<keyof MissingRecord['labs'], { names: string[]; exclude: string[] }> = {
  wbc: { names: ['wbc', 'wcc', 'white cell count', 'white blood cell', 'white blood cells', 'white cells', 'leucocytes', 'leukocytes', 'total white'], exclude: ['urine'] },
  neutrophils: { names: ['neutrophil', 'neutrophils', 'neut', 'pmn', 'polymorphs'], exclude: ['urine', 'ratio'] },
  crp: { names: ['crp', 'c-reactive protein', 'c reactive protein'], exclude: [] },
  urea: { names: ['urea', 'bun', 'blood urea'], exclude: ['electrolyte', 'urine', 'ratio', 'u&e'] },
  hb: { names: ['haemoglobin', 'hemoglobin', 'hb', 'hgb'], exclude: ['a1c', 'glycated', 'mean', 'urine', 'electrophoresis'] },
  creatinine: { names: ['creatinine', 'creat'], exclude: ['ratio', 'clearance', 'urine', 'kinase'] },
  egfr: { names: ['egfr', 'gfr', 'estimated gfr'], exclude: [] },
  bilirubin: { names: ['bilirubin', 'bili', 'total bilirubin'], exclude: ['direct', 'conjugated', 'urine'] },
  albumin: { names: ['albumin'], exclude: ['ratio', 'urine', 'creatinine'] },
  inr: { names: ['inr', 'pt/inr', 'pt-inr'], exclude: [] },
};

const EXTRACTED_KEY: Record<keyof MissingRecord['labs'], string | null> = {
  wbc: 'wbc', neutrophils: 'neutrophils', crp: 'crp', urea: 'urea', hb: 'haemoglobin', creatinine: 'creatinine', egfr: 'egfr',
  bilirubin: 'bilirubin_total', albumin: 'albumin', inr: 'inr',
};

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || (typeof v === 'string' && !v.trim())) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function firstNumber(value: string): number | null {
  const m = /-?\d+(?:\.\d+)?/.exec(value ?? '');
  return m ? num(m[0]) : null;
}

function nameIs(name: string, key: keyof MissingRecord['labs']): boolean {
  const def = LAB_NAMES[key];
  return def.names.some(n => termIn(name, n)) && !def.exclude.some(x => name.toLowerCase().includes(x));
}

/** A lab value: extractedLabs, then the results by name, then the lab records (latest first). */
export function webLab(c: MissingConsultation, key: keyof MissingRecord['labs']): number | null {
  const x = EXTRACTED_KEY[key];
  const extracted = x ? c.extractedLabs?.[x] : null;
  if (typeof extracted === 'number' && Number.isFinite(extracted)) return extracted;
  for (const [name, value] of Object.entries(c.investigationResults ?? {})) {
    if (nameIs(name, key)) {
      const n = firstNumber(value);
      if (n !== null) return n;
    }
  }
  for (const r of [...(c.labRecords ?? [])].reverse()) {
    for (const t of r.tests) if (nameIs(t.name, key)) { const n = firstNumber(t.value); if (n !== null) return n; }
  }
  return null;
}

// ── Record ──────────────────────────────────────────────────────────────────────────────────

const IMAGING_NAME = /\b(ultrasound|uss?|ct|ctpa|mri|mrcp|x-?ray|cxr|axr|scan|radiograph|imaging|doppler)\b/i;

function matchOpts(term: string) {
  return term.length <= 4 ? { wholeWord: true } : { wordStart: true };
}

/** Negation-aware: any term affirmed in `text` (≤ 4 characters whole word, else word start). */
export function affirmedTerm(text: string, terms: string[]): boolean {
  return terms.some(t => containsAnyAffirmed(text, [t], matchOpts(t)));
}

function daysSince(dateIso: string | null | undefined, today: string | undefined): number | null {
  if (!dateIso || !today) return null;
  const a = Date.parse(`${dateIso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86_400_000) : null;
}

function imagingTexts(c: MissingConsultation): string[] {
  const out = (c.radiologyRequests ?? []).filter(r => r.resultReceived && r.resultNotes.trim()).map(r => r.resultNotes);
  for (const [name, value] of Object.entries(c.investigationResults ?? {})) if (IMAGING_NAME.test(name) && value.trim()) out.push(value);
  if (c.imagingText?.trim()) out.push(c.imagingText);
  return out;
}

export function historyText(c: MissingConsultation): string {
  return joinClauses([...(c.comorbidities ?? []), c.pmhNotes ?? '', ...(c.surgicalHistory ?? []), c.surgicalNotes ?? '']);
}

export function findingsText(c: MissingConsultation): string {
  return joinClauses([
    c.freeText ?? '', c.hpiNotes ?? '', ...(c.symptoms ?? []),
    c.examGeneral ?? '', c.examAbdomen ?? '', c.examCardio ?? '', c.examResp ?? '', c.examNeuro ?? '', c.examExtremities ?? '',
    ...Object.values(c.examFindings ?? {}).flat(),
  ]);
}

function medicationList(c: MissingConsultation): string[] {
  return [...(c.medications ?? []), ...splitList(c.medicationsText)];
}

/** The record the score auto-fill and the strip read. */
export function missingRecordFromConsultation(c: MissingConsultation): MissingRecord {
  const R = WHATS_MISSING_RULES;
  const v = c.vitals ?? {};
  const avpuRaw = (v.avpu ?? '').trim().toUpperCase();
  const avpu = (['A', 'C', 'V', 'P', 'U'].includes(avpuRaw) ? avpuRaw : null) as MissingAvpu | null;
  const history = historyText(c);
  const findings = findingsText(c);
  const meds = medicationList(c);
  const lastWeight = [...(c.vitalRecords ?? [])].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)).map(r => num(r.weight)).find(w => w !== null) ?? null;
  const sexRaw = (c.sex ?? '').toLowerCase();
  const pod = num(c.postOpDays);
  const since = c.isPostOp && pod !== null ? pod : daysSince(c.recentSurgeryDate, c.today);
  const hist = (key: string) => affirmedTerm(history, R.terms.history[key] ?? []);
  const flags: Record<HistoryFlag, boolean> = {
    cancer: hist('cancer'),
    priorDvt: hist('priorDvt'),
    priorPe: hist('priorPe'),
    chf: hist('chf'),
    ihd: hist('ihd'),
    cva: hist('cva'),
    insulin: termsFound(meds, R.terms.insulinDrugs).length > 0 || hist('insulinDependent'),
    liverDisease: hist('liverDisease'),
    ibd: hist('ibd'),
    varicoseVeins: hist('varicoseVeins'),
    ocpHrt: hist('ocpHrt') || termsFound(meds, R.terms.history.ocpHrt ?? []).length > 0,
    immobile: hist('immobile') || affirmedTerm(joinClauses([c.hpiNotes ?? '']), R.terms.history.immobile ?? []),
    pregnant: pregnancyFor(planPatientContext(c)).status === 'pregnant',
    recentSurgery4w: since !== null && since >= 0 && since <= 28,
    recentSurgery12w: since !== null && since >= 0 && since <= 84,
  };
  const finding = {} as Record<FindingFlag, boolean>;
  for (const [key, terms] of Object.entries(R.terms.findings)) finding[key as FindingFlag] = affirmedTerm(findings, terms);
  const imaging = imagingTexts(c);
  const labs = {} as MissingRecord['labs'];
  for (const key of Object.keys(LAB_NAMES) as (keyof MissingRecord['labs'])[]) labs[key] = webLab(c, key);
  // extractedLabs holds haemoglobin in g/L; the core reads a value above 25 as g/L.
  return {
    ageYears: num(c.age ?? null),
    sex: sexRaw === 'male' ? 'male' : sexRaw === 'female' ? 'female' : 'unknown',
    weightKg: num(c.weightKg) ?? lastWeight,
    heightCm: num(c.heightCm),
    vitals: {
      hr: num(v.heartRate), sbp: num(v.systolicBp), dbp: num(v.diastolicBp), rr: num(v.respiratoryRate),
      tempC: num(v.temperatureC), spo2: num(v.spo2), avpu,
      onOxygen: v.onSupplementalO2 === 'o2' ? true : v.onSupplementalO2 === 'air' ? false : null,
    },
    labs,
    imagingReported: imaging.length > 0,
    pleuralEffusion: imaging.some(t => affirmedTerm(t, R.terms.pleuralEffusion)),
    history: flags,
    findings: finding,
  };
}

// ── Facts ───────────────────────────────────────────────────────────────────────────────────

const PROCEDURE_VISIT_TYPES = new Set(['pre_op', 'day_of_surgery', 'ercp', 'endoscopy_ogd', 'endoscopy_col']);
const PROCEDURE_ENCOUNTER_TYPES = new Set(['endoscopy', 'office_procedure']);
const PREGNANCY_RESULT = /\b(pregnancy|b-?hcg|β-?hcg|beta-?hcg|hcg)\b/i;
const NOT_OF_CHILDBEARING = ['post-menopausal', 'postmenopausal', 'hysterectomy'];

export function missingFactsFromConsultation(c: MissingConsultation, procedurePlanned: boolean): MissingFacts {
  const R = WHATS_MISSING_RULES;
  const preg = pregnancyFor(planPatientContext(c)).status;
  const resultNames = Object.entries(c.investigationResults ?? {}).filter(([, v]) => v.trim()).map(([n]) => n);
  const planned = [
    ...(c.pendingPrescriptions ?? []).map(p => p.drugName),
    // A renally cleared drug or anticoagulant written into the plan counts as planned.
    ...termsFound([c.plan ?? ''], [...R.terms.renalDrugs, ...R.terms.anticoagulants]),
  ];
  const resulted = new Set(Object.keys(c.investigationResults ?? {}).map(n => n.toLowerCase()));
  const investigations = [
    ...(c.orderedInvestigations ?? []).filter(n => !resulted.has(n.toLowerCase())),
    ...(c.radiologyRequests ?? []).filter(r => !r.resultReceived).map(r => `${r.modality} ${r.anatomicalRegion}`.trim()),
  ];
  return {
    allergyStatusRecorded: allergyStatus(Array.isArray(c.allergies) ? c.allergies.join(', ') : c.allergies).kind !== 'not_recorded',
    pregnancyStatusRecorded: preg === 'pregnant' || preg === 'not-pregnant' || preg === 'postpartum'
      || resultNames.some(n => PREGNANCY_RESULT.test(n))
      || affirmedTerm(historyText(c), NOT_OF_CHILDBEARING),
    supplementsAsked: (c.supplementHistory?.status ?? 'not_asked') !== 'not_asked',
    medications: medicationList(c),
    plannedMedications: planned,
    medicationNotes: joinClauses([c.medicationsText ?? '', c.hpiNotes ?? '', c.plan ?? '', c.pmhNotes ?? '']),
    plannedInvestigations: investigations,
    procedurePlanned,
    acute: c.encounterType === 'major_emergency' || c.encounterMode === 'inpatient' || !!c.isPostOp,
  };
}

// ── Engines ─────────────────────────────────────────────────────────────────────────────────

/** Recommended (getCdsSuggestions) and recorded scores, canonical keys. */
export function activeScores(c: MissingConsultation): string[] {
  const ctx: CdsContext = {
    symptoms: c.symptoms ?? [], examFindings: c.examFindings ?? {}, vitals: (c.vitals ?? {}) as Record<string, string>,
    investigationResults: c.investigationResults ?? {}, comorbidities: c.comorbidities ?? [], assessment: c.assessment ?? '',
    rosFindings: c.rosFindings ?? {}, age: c.age === null || c.age === undefined ? '' : String(c.age), sex: c.sex ?? '',
    isPostOp: !!c.isPostOp, procedureData: c.procedureData ?? {},
    workingDiagnosis: c.workingDiagnosis ? { diseaseId: c.workingDiagnosis.diseaseId, source: 'clinician', locked: c.workingDiagnosis.locked } : undefined,
  };
  const out: string[] = [];
  for (const s of getCdsSuggestions(ctx)) {
    const key = CDS_TO_SCORE[s.scaleKey];
    if (key && !out.includes(key)) out.push(key);
  }
  for (const key of Object.keys(recordedDecisionScores(c.clinicalScores))) if (!out.includes(key)) out.push(key);
  return out;
}

/** The NG12 / BSG ferritin prompt (computePreventivePrompts, as the clinical prompt strip builds it). */
export function ferritinPromptFires(c: MissingConsultation): boolean {
  const input: InferenceInput = {
    age: c.age === null || c.age === undefined ? '' : String(c.age), sex: c.sex ?? '', symptoms: c.symptoms ?? [],
    comorbidities: c.comorbidities ?? [], familyHistory: c.familyHistory ?? [], toxicHabits: c.toxicHabits ?? [],
    medications: c.medications ?? [], medicationsText: c.medicationsText ?? '', pregnancyPossible: !!c.pregnancyPossible,
    ccEntries: ((c.procedureData?.cc as { complaint: string; answers: Record<string, string> }[] | undefined) ?? []),
    encounterType: c.encounterType ?? '', examGeneral: c.examGeneral ?? '', examAbdomen: c.examAbdomen ?? '',
    examBreast: c.examBreast ?? '', examCardio: c.examCardio ?? '', examResp: c.examResp ?? '', examNeuro: c.examNeuro ?? '',
    examExtremities: c.examExtremities ?? '', investigationResults: c.investigationResults ?? {},
    radiologyRequests: (c.radiologyRequests ?? []).map(r => ({ ...r, indication: r.indication ?? '' })),
    vitals: (c.vitals ?? {}) as Record<string, string>, assessment: c.assessment ?? '', historyText: c.hpiNotes ?? '',
    surgicalHistory: c.surgicalHistory ?? [],
  };
  return computePreventivePrompts(input).some(p => p.id === 'anaemia_ferritin_check');
}

/** The reasoning panel's best next discriminator (DiagnosticReasoningPanel's first discriminator). */
export function bestDiscriminator(c: MissingConsultation, state: PaneState | null | undefined): MissingDiscriminator | null {
  if (!state || Object.keys(state.answered ?? {}).length === 0) return null;
  const diseases: DiseaseNode[] = applyModifiers(DISEASES, num(c.age ?? null), c.sex ?? 'unknown', undefined, { pregnancyPossible: !!c.pregnancyPossible });
  const ranked = diseases
    .filter(d => d.id !== '_other_' && (state.posteriors[d.id] ?? 0) > 0)
    .sort((a, b) => (state.posteriors[b.id] ?? 0) - (state.posteriors[a.id] ?? 0));
  const top = ranked.slice(0, 3);
  const wd = c.workingDiagnosis?.locked ? c.workingDiagnosis : null;
  const working = wd ? resolveWorkingNode(diseases, {
    diseaseId: wd.diseaseId, icdCode: wd.icdCode, label: wd.diseaseLabel || wd.icdCode || 'Working diagnosis',
  }, state) : null;
  const nodes = working && !top.some(d => d.id === working.id) ? [...top.slice(0, 2), working] : top;
  const first = paneDiscriminators(state, diseases, nodes, 1)[0];
  if (!first) return null;
  return { label: first.probe.label, kind: first.probe.cost, separates: first.separates };
}

export interface MissingOptions {
  paneState?: PaneState | null;
  /** Precomputed recommended / recorded scores (the Scales step's list). */
  activeScores?: string[];
}

/** Everything the strip needs, from the consultation. */
export function whatsMissingInput(c: MissingConsultation, opts: MissingOptions = {}): WhatsMissingInput {
  const decision = decisionInput(c);
  const procedurePlanned = decision.patient.procedurePlanned
    || PROCEDURE_VISIT_TYPES.has(c.visitType ?? '') || PROCEDURE_ENCOUNTER_TYPES.has(c.encounterType ?? '')
    || (c.symptoms ?? []).includes('Pre-operative visit');
  return {
    record: missingRecordFromConsultation(c),
    facts: missingFactsFromConsultation(c, procedurePlanned),
    activeScores: opts.activeScores ?? activeScores(c),
    decisionGaps: decisionGaps(decision, planSafetyLineFilter(planPatientContext(c))),
    ferritinMissing: ferritinPromptFires(c),
    discriminator: bestDiscriminator(c, opts.paneState),
  };
}

export function buildWhatsMissing(c: MissingConsultation, opts: MissingOptions = {}): WhatsMissingResult {
  return whatsMissing(whatsMissingInput(c, opts));
}
