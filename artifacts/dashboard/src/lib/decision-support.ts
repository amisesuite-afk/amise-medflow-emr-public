/**
 * Decision support — the dashboard side of the pane-engine decision layer
 * (lib/pane-engine/src/decision): builds the engine input from the consultation (AppContext
 * fields), applies the plan-safety filter as the final hard filter, and computes how the resulted
 * investigations moved the PANE posterior (before → after, and which result moved it most).
 *
 * Pure and deterministic (no AI, no network, no '@/' imports: the clinval web runner calls it).
 * Nothing here writes to the record: the Plan-step panel shows suggestions and the clinician taps
 * "Add to plan" / "Add test" / "Dismiss" (CLAUDE.md → Central diagnosis radiation).
 */

import {
  DECISION_CONTENT, DISEASES, FEATURES, adaptPlanText, allergyProfile, applyModifiers, decisionSupport, formatPercent,
  initPaneState, pregnancyFor, procedureFor, updatePosterior,
} from '@workspace/pane-engine';
import type {
  DecisionDiagnosis, DecisionInput, DecisionLabs, DecisionPatient, DecisionScore, DecisionSupportResult,
  DiseaseNode, LineFilter, ManagementProtocol, PaneState, PlanPatientContext,
} from '@workspace/pane-engine';
import { evaluateNews2, testAffirmed } from '@workspace/triage-engine';
import type { News2Avpu } from '@workspace/triage-engine';
import { ALIAS_INDEX } from '@workspace/triage-engine/report-import';
import { qSofaScore } from './clinical-scales';
import { planPatientContext } from './plan-builder';
import type { PlanContextSource } from './plan-builder';
import { extractFeaturesFromSocrates, paneContextFromConsultation } from './socrates-to-features';
import type { ConsultationSnapshot } from './socrates-to-features';

/** The consultation fields decision support reads (AppContext names). */
export interface DecisionConsultation extends PlanContextSource {
  extractedLabs?: Record<string, number | null> | null;
  investigationResults?: Record<string, string>;
  vitals?: Partial<Record<string, string>>;
  weightKg?: string | null;
  heightCm?: string | null;
  isPostOp?: boolean;
  postOpDays?: string | null;
  /** YYYY-MM-DD of the most recent operation. */
  recentSurgeryDate?: string | null;
  clinicalScores?: Record<string, unknown> | null;
  workingDiagnosis?: { diseaseId: string | null; icdCode: string | null; locked: boolean; diseaseLabel?: string; confidence?: number } | null;
  icdCodes?: string[];
  paneTop?: { disease: { id: string; label: string; icd10?: string }; probability: number }[];
  /** Radiology result text (reports received). */
  imagingText?: string | null;
  /** SpO₂ Scale 2 (clinician opt-in on the patient record). */
  news2Scale2?: boolean;
  /** Today's date (YYYY-MM-DD, America/St_Lucia) for the days since surgery. */
  today?: string;
}

// ── Recorded scores (ScalesTab "Use in decision support") ───────────────────────────────────

export const DECISION_SCORES_KEY = 'decisionScores';

export interface RecordedDecisionScore { value: number; at: string; redParameter?: boolean }

/** The scores the clinician recorded for decision support (encounters.clinical_scores). */
export function recordedDecisionScores(clinicalScores: Record<string, unknown> | null | undefined): Record<string, RecordedDecisionScore> {
  const raw = clinicalScores?.[DECISION_SCORES_KEY];
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, RecordedDecisionScore> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v && typeof v === 'object' && typeof (v as RecordedDecisionScore).value === 'number' && Number.isFinite((v as RecordedDecisionScore).value)) {
      const r = v as RecordedDecisionScore;
      out[k] = { value: r.value, at: typeof r.at === 'string' ? r.at : '', redParameter: r.redParameter === true };
    }
  }
  return out;
}

/** clinicalScores with one decision-support score recorded (explicit clinician tap). */
export function withRecordedScore(
  clinicalScores: Record<string, unknown> | null | undefined, key: string, value: number, at: string, redParameter = false,
): Record<string, unknown> {
  const current = recordedDecisionScores(clinicalScores);
  return {
    ...(clinicalScores ?? {}),
    [DECISION_SCORES_KEY]: { ...current, [key]: redParameter ? { value, at, redParameter } : { value, at } },
  };
}

// ── Patient ─────────────────────────────────────────────────────────────────────────────────

const VKA = ['warfarin', 'acenocoumarol', 'phenindione'];
const DOACS = ['apixaban', 'rivaroxaban', 'edoxaban', 'dabigatran'];
const ANTIPLATELETS = ['clopidogrel', 'prasugrel', 'ticagrelor', 'aspirin'];
const IMMUNOSUPPRESSANTS = [
  'tacrolimus', 'ciclosporin', 'cyclosporine', 'mycophenolate', 'azathioprine', 'methotrexate', 'sirolimus',
  'adalimumab', 'infliximab', 'etanercept', 'vedolizumab', 'ustekinumab', 'tocilizumab', 'rituximab',
  'cyclophosphamide', 'chemotherapy', 'capecitabine', 'oxaliplatin', 'fluorouracil',
  'prednisolone', 'prednisone', 'dexamethasone', 'methylprednisolone', 'hydrocortisone',
];

function wordIn(text: string, term: string): boolean {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${esc}(?=$|[^a-z0-9])`, 'i').test(text);
}

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || (typeof v === 'string' && !v.trim())) return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/** Numeric result by catalogue analyte (exact alias of the result name, first number of its value). */
export function labFromResults(results: Record<string, string> | undefined, key: string): number | null {
  for (const [name, value] of Object.entries(results ?? {})) {
    const n = name.toLowerCase().trim();
    if (!ALIAS_INDEX.some(a => a.key === key && a.alias === n)) continue;
    const m = /-?\d+(?:\.\d+)?/.exec(value ?? '');
    if (m) {
      const v = parseFloat(m[0]);
      if (Number.isFinite(v)) return v;
    }
  }
  return null;
}

const STUB_PROTOCOL: ManagementProtocol = {
  diseaseId: 'decision-support', icd10Prefixes: [], label: 'Decision support', keyPoints: [], redFlags: [],
  investigations: [], management: [], kind: 'medical',
};

function daysBetween(fromIso: string, toIso: string): number | null {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

const RECENT_VTE = /\b(?:recent|last (?:month|week))\b[^.;]{0,30}\b(?:dvt|pe|pulmonary embol\w*|vte|venous thrombo\w*)\b|\b(?:dvt|pe|pulmonary embol\w*|vte|deep vein thrombosis)\b[^.;]{0,30}\b(?:\d{1,2}\s*(?:days?|weeks?)|[12]\s*months?)\s+ago\b/i;
const MECHANICAL_VALVE = /\bmechanical\s+(?:heart\s+|mitral\s+|aortic\s+)?valve|\bmechanical\s+(?:mvr|avr)\b|\bmetallic valve/i;
const DIABETES = /\b(diabet\w*|t1dm|t2dm|iddm|niddm)\b/i;
const IMMUNO_TEXT = /\b(transplant\w*|hiv|aids|chemotherapy|neutropeni\w*|immunosuppress\w*|immunocompromis\w*)\b/i;

export function decisionPatient(c: DecisionConsultation, scores: DecisionScore[]): DecisionPatient {
  const ctx: PlanPatientContext = planPatientContext(c);
  const meds = (ctx.medications ?? []).join(' ; ').toLowerCase();
  const history = [...(ctx.comorbidities ?? []), ctx.freeText ?? ''].join(' ; ');
  const vka = VKA.some(d => wordIn(meds, d));
  const doac = DOACS.some(d => wordIn(meds, d));
  const preg = pregnancyFor(ctx).status;
  const score = (k: string) => scores.find(s => s.key === k)?.value ?? null;
  const w = num(c.weightKg);
  const h = num(c.heightCm);
  const bmi = w && h && h >= 50 ? Math.round((w / ((h / 100) ** 2)) * 10) / 10 : null;
  let recentSurgeryDays: number | null = null;
  const pod = num(c.postOpDays);
  if (c.isPostOp && pod !== null) recentSurgeryDays = pod;
  else if (c.recentSurgeryDate && c.today) recentSurgeryDays = daysBetween(c.recentSurgeryDate, c.today);
  const resultText = [...Object.values(c.investigationResults ?? {}), c.imagingText ?? ''].join('.\n');
  const sex = (c.sex ?? '').toLowerCase();
  return {
    ageYears: ctx.ageYears ?? null,
    sex: sex === 'male' ? 'male' : sex === 'female' ? 'female' : 'unknown',
    cfs: score('cfs'),
    asa: score('asa'),
    egfr: ctx.egfr ?? labFromResults(c.investigationResults, 'egfr'),
    bmi,
    news2: score('news2'),
    sbp: num(c.vitals?.systolicBp),
    anticoagulant: vka ? 'vka' : doac ? 'doac' : 'none',
    antiplatelet: ANTIPLATELETS.some(d => wordIn(meds, d)),
    hasBled: score('has-bled'),
    pregnancy: preg === 'pregnant' ? 'pregnant' : preg === 'possible' ? 'possible' : preg === 'unknown' ? 'unknown' : 'not-pregnant',
    allergyClasses: allergyProfile(ctx.allergies).classes.map(cl => cl.id),
    diabetes: DIABETES.test(history) || /\b(insulin|metformin|gliclazide|sglt2|empagliflozin|dapagliflozin)\b/.test(meds),
    immunosuppressed: IMMUNOSUPPRESSANTS.some(d => wordIn(meds, d)) || IMMUNO_TEXT.test(history),
    recentSurgeryDays,
    procedurePlanned: procedureFor(STUB_PROTOCOL, ctx, false) !== 'none',
    appendicolith: testAffirmed(/\b(appendicolith|faecolith|fecalith)\b/i, resultText),
    mechanicalValve: MECHANICAL_VALVE.test(history),
    recentVte3m: RECENT_VTE.test(history),
  };
}

// ── Scores and labs ─────────────────────────────────────────────────────────────────────────

/** Recorded calculator scores plus NEWS2 / qSOFA computed from the recorded vitals. */
export function decisionScores(c: DecisionConsultation): DecisionScore[] {
  const out: DecisionScore[] = [];
  for (const [key, r] of Object.entries(recordedDecisionScores(c.clinicalScores))) {
    out.push({ key, value: r.value, source: 'calculator', ...(r.redParameter ? { redParameter: true } : {}) });
  }
  const v = c.vitals ?? {};
  const rr = num(v.respiratoryRate);
  const sbp = num(v.systolicBp);
  const avpuRaw = (v.avpu ?? '').toUpperCase();
  const avpu = (['A', 'C', 'V', 'P', 'U'].includes(avpuRaw) ? avpuRaw : null) as News2Avpu | null;
  const o2 = v.onSupplementalO2 === 'o2' ? true : v.onSupplementalO2 === 'air' ? false : null;
  const recorded = [rr, num(v.spo2), sbp, num(v.heartRate), num(v.temperatureC)].filter(x => x !== null).length;
  if (recorded >= 4) {
    const e = evaluateNews2({
      respiratoryRate: rr, spo2: num(v.spo2), onOxygen: o2, useSpO2Scale2: c.news2Scale2 === true,
      systolicBP: sbp, heartRate: num(v.heartRate), temperatureCelsius: num(v.temperatureC), avpu,
    });
    out.push({ key: 'news2', value: e.total, source: 'record', ...(e.hasSingleParameterScore3 ? { redParameter: true } : {}) });
  }
  if (rr !== null && sbp !== null) {
    out.push({ key: 'qsofa', value: qSofaScore(avpu !== null && avpu !== 'A', rr, sbp), source: 'record' });
  }
  return out;
}

export function decisionLabs(c: DecisionConsultation): DecisionLabs {
  const x = c.extractedLabs ?? {};
  const pick = (key: string): number | null => {
    const v = x[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : labFromResults(c.investigationResults, key);
  };
  const labs: DecisionLabs = {};
  const set = (k: keyof DecisionLabs, v: number | null) => { if (v !== null) labs[k] = v; };
  set('lipase', pick('lipase'));
  set('amylase', pick('amylase'));
  set('potassium', pick('potassium'));
  set('lactate', pick('lactate'));
  set('troponin', pick('troponin') ?? pick('troponinT') ?? pick('troponinI'));
  // Haemoglobin: extractedLabs holds g/L; a result written in g/dL (≤ 25) is converted.
  const hb = pick('haemoglobin');
  set('haemoglobin', hb === null ? null : hb <= 25 ? Math.round(hb * 100) / 10 : hb);
  return labs;
}

// ── Diagnoses ───────────────────────────────────────────────────────────────────────────────

export function decisionDiagnoses(c: DecisionConsultation): DecisionDiagnosis[] {
  const out: DecisionDiagnosis[] = [];
  const wd = c.workingDiagnosis;
  const paneP = (id: string | null) => c.paneTop?.find(r => r.disease.id === id)?.probability ?? null;
  if (wd?.locked) {
    const node = wd.diseaseId ? DISEASES.find(d => d.id === wd.diseaseId) : undefined;
    out.push({
      name: wd.diseaseLabel || node?.label || wd.icdCode || 'Working diagnosis', id: wd.diseaseId, icd10: wd.icdCode,
      probability: paneP(wd.diseaseId) ?? (typeof wd.confidence === 'number' ? wd.confidence : null), confirmed: true,
    });
  }
  for (const raw of c.icdCodes ?? []) {
    const [code, label] = raw.split(' — ');
    out.push({ name: (label ?? code).trim(), id: null, icd10: code.trim(), probability: null, confirmed: true });
  }
  for (const r of c.paneTop ?? []) {
    out.push({ name: r.disease.label, id: r.disease.id, icd10: r.disease.icd10 ?? null, probability: r.probability, confirmed: false });
  }
  return out;
}

// ── Final filter ────────────────────────────────────────────────────────────────────────────

/** planSafety's line filter (allergy class, pregnancy, renal, paediatric) as the final hard filter. */
export function planSafetyLineFilter(ctx: PlanPatientContext): LineFilter {
  return (line: string) => {
    const text = adaptPlanText(line, STUB_PROTOCOL, ctx);
    return { text, withheld: text !== line && /\bwithheld\b/.test(text) && text.includes('⚠') };
  };
}

export function decisionInput(c: DecisionConsultation): DecisionInput {
  const scores = decisionScores(c);
  return { patient: decisionPatient(c, scores), diagnoses: decisionDiagnoses(c), scores, labs: decisionLabs(c) };
}

export function buildDecisionSupport(c: DecisionConsultation): DecisionSupportResult {
  return decisionSupport(decisionInput(c), DECISION_CONTENT, planSafetyLineFilter(planPatientContext(c)));
}

// ── Results → posterior (PANE evidence path) ────────────────────────────────────────────────

export interface PosteriorShift {
  diseaseId: string;
  name: string;
  before: number;
  after: number;
  /** Results in order of how much each moved this diagnosis (leave-one-out). */
  movedBy: { result: string; delta: number }[];
}

type FeatureMap = Record<string, boolean>;

function featuresFor(entries: { complaint: string; answers: Record<string, string> }[], snapshot: Partial<ConsultationSnapshot>): FeatureMap {
  const ctx = paneContextFromConsultation(snapshot);
  const list = entries.length ? entries : [{ complaint: '', answers: {} }];
  const out: FeatureMap = {};
  for (const e of list) Object.assign(out, extractFeaturesFromSocrates(e.complaint, e.answers, ctx));
  return out;
}

const FEATURE_IDS = new Set(FEATURES.map(f => f.id));

/** HpiTab.reseedPane: features the model does not know are not applied. */
function replay(diseases: DiseaseNode[], answered: FeatureMap): PaneState {
  let s = initPaneState(diseases);
  for (const [f, v] of Object.entries(answered)) if (FEATURE_IDS.has(f)) s = updatePosterior(s, diseases, f, v);
  return s;
}

/**
 * How the resulted investigations moved the PANE posterior. `state` is the posterior the
 * dashboard shows (AppContext paneState: every applied feature, including PANE Q&A answers); the
 * "before" posterior replays the same features without those that only the results supplied.
 * Leave-one-out per result names the result that moved each diagnosis most.
 */
export function resultPosteriorShifts(
  c: DecisionConsultation & Partial<ConsultationSnapshot>,
  entries: { complaint: string; answers: Record<string, string> }[],
  state: PaneState | null,
  opts: { top?: number; minDelta?: number } = {},
): PosteriorShift[] {
  const results = Object.entries(c.investigationResults ?? {}).filter(([, v]) => v && v.trim());
  if (!results.length) return [];
  const snapshot: Partial<ConsultationSnapshot> = { ...c, investigationResults: c.investigationResults ?? {} } as Partial<ConsultationSnapshot>;
  const withResults = featuresFor(entries, snapshot);
  const without = featuresFor(entries, { ...snapshot, investigationResults: {} });
  const resultOnly = Object.keys(withResults).filter(k => without[k] !== withResults[k]);
  if (!resultOnly.length) return [];
  const age = num(c.age ?? null);
  const diseases = applyModifiers(DISEASES, age, c.sex ?? 'unknown', undefined, { pregnancyPossible: !!c.pregnancyPossible });
  const answeredAfter: FeatureMap = state ? { ...state.answered } : { ...withResults };
  const after = state ?? replay(diseases, answeredAfter);
  const strip = (keys: string[]) => Object.fromEntries(Object.entries(answeredAfter).filter(([k]) => !keys.includes(k)));
  const before = replay(diseases, strip(resultOnly));
  // Per result: the features only that result supplies.
  const perResult = results.map(([name, value]) => {
    const f = featuresFor(entries, { ...snapshot, investigationResults: { [name]: value } });
    const own = resultOnly.filter(k => f[k] === withResults[k] && without[k] !== f[k]);
    return { name, value, own };
  });
  const ids = new Set<string>();
  const topIds = (s: PaneState) => Object.entries(s.posteriors).filter(([id]) => id !== '_other_')
    .sort((a, b) => b[1] - a[1]).slice(0, opts.top ?? 3).map(([id]) => id);
  for (const id of [...topIds(after), ...topIds(before)]) ids.add(id);
  const minDelta = opts.minDelta ?? 0.02;
  const out: PosteriorShift[] = [];
  for (const id of ids) {
    const a = after.posteriors[id] ?? 0;
    const b = before.posteriors[id] ?? 0;
    if (Math.abs(a - b) < minDelta) continue;
    const movedBy = perResult
      .filter(r => r.own.length)
      .map(r => {
        const loo = replay(diseases, strip(r.own)).posteriors[id] ?? 0;
        return { result: `${r.name}: ${r.value}`, delta: Math.round((a - loo) * 10000) / 10000 };
      })
      .filter(m => Math.abs(m.delta) >= 0.005)
      .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
    const node = diseases.find(d => d.id === id);
    out.push({ diseaseId: id, name: node?.label ?? id, before: Math.round(b * 10000) / 10000, after: Math.round(a * 10000) / 10000, movedBy });
  }
  return out.sort((x, y) => Math.abs(y.after - y.before) - Math.abs(x.after - x.before));
}

/** "P(Acute pancreatitis) 22% → 81% — moved most by Lipase: 1450 U/L". */
export function shiftText(s: PosteriorShift): string {
  const by = s.movedBy[0] ? ` — moved most by ${s.movedBy[0].result}` : '';
  return `P(${s.name}) ${formatPercent(s.before)} → ${formatPercent(s.after)}${by}`;
}
