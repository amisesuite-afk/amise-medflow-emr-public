import { decisionRuleByRecordKey, ruleBandFor } from '../evidence/catalogue.js';
import type { Vademecum } from './model.js';
import type { FindingDimension, VademecumLevel } from './types.js';

/**
 * Readers that turn what is recorded into vademecum findings (present / documented absent). They
 * take the platform's existing deterministic helpers as arguments, so the loop stays free of
 * platform code: the reference ranges (@workspace/triage-engine/reference-ranges) flag a
 * structured result, and the negation rule (lib/triage-engine/src/negation.ts) reads free text
 * and report text. No AI, no OCR.
 */

/** One structured result (lab feed, report import: investigation_results analytes). */
export interface AnalyteResult {
  /** Catalogue saved name ("ALP", "Lipase", "D-dimer"). */
  analyte: string;
  value: number | null;
  unit?: string | null;
  /** The laboratory's own flag, when it sent one (never downgraded). */
  labFlag?: 'high' | 'low' | 'normal' | null;
}

export interface LabClassification {
  flag: 'low' | 'high' | 'normal' | 'unknown';
  /** Upper limit of normal in the result's unit (practice range, else the default), or null. */
  uln: number | null;
}

/** Reference-range classification of one value (e.g. triage-engine classifyAnalyte + upperLimitOfNormal). */
export type LabClassifier = (analyte: string, value: number, unit: string | null) => LabClassification;

/** Laboratory findings from structured results. A measured value that misses the threshold is recorded absent. */
export function findingsFromLabs(v: Vademecum, results: readonly AnalyteResult[], classify: LabClassifier): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const f of v.findings.values()) {
    const spec = f.lab;
    if (!spec) continue;
    const r = results.find(x => x.analyte.toLowerCase() === spec.analyte.toLowerCase() && x.value !== null && Number.isFinite(x.value));
    if (!r || r.value === null) continue;
    const c = classify(r.analyte, r.value, r.unit ?? null);
    let present: boolean | null = null;
    if (spec.direction === 'high') {
      if (spec.multipleOfUln !== undefined) present = c.uln === null ? null : r.value >= spec.multipleOfUln * c.uln;
      else if (spec.above !== undefined) present = r.value >= spec.above;
      else present = c.flag === 'unknown' && !r.labFlag ? null : (c.flag === 'high' || r.labFlag === 'high');
    } else {
      if (spec.below !== undefined) present = r.value < spec.below;
      else present = c.flag === 'unknown' && !r.labFlag ? null : (c.flag === 'low' || r.labFlag === 'low');
    }
    if (present !== null) out[f.id] = present;
  }
  return out;
}

/** 'affirmed' when the term is recorded as present, 'negated' when recorded as absent, else null. */
export type TextMatcher = (text: string, term: string) => 'affirmed' | 'negated' | null;

/**
 * Findings whose synonyms appear in free text (history, examination, a report), negation-aware.
 * Limited to the given levels / dimensions (e.g. only imaging findings from an imaging report).
 */
export function findingsFromText(
  v: Vademecum, text: string, match: TextMatcher,
  only: { levels?: VademecumLevel[]; dimensions?: FindingDimension[]; skip?: ReadonlySet<string> } = {},
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!text.trim()) return out;
  for (const f of v.findings.values()) {
    if (f.demographic || !f.synonyms.length || only.skip?.has(f.id)) continue;
    if (only.levels && !only.levels.includes(f.level)) continue;
    if (only.dimensions && !only.dimensions.includes(f.dimension)) continue;
    let affirmed = false;
    let negated = false;
    for (const s of f.synonyms) {
      const m = match(text, s);
      if (m === 'affirmed') affirmed = true;
      else if (m === 'negated') negated = true;
    }
    if (affirmed) out[f.id] = true;
    else if (negated) out[f.id] = false;
  }
  return out;
}

/** Findings from an imaging, endoscopy or pathology report (its own dimensions only). */
export function findingsFromReport(v: Vademecum, report: string, kind: 'imaging' | 'endoscopy' | 'pathology', match: TextMatcher): Record<string, boolean> {
  return findingsFromText(v, report, match, { levels: ['investigation'], dimensions: [kind] });
}

/** Findings from PANE features (the web mapper's output), through each finding's `pane` id. */
export function findingsFromPane(v: Vademecum, features: Record<string, boolean>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const f of v.findings.values()) {
    if (f.pane && features[f.pane] !== undefined) out[f.id] = features[f.pane]!;
  }
  return out;
}

/** Findings from the Exam-step sign chips (present / examined and absent). */
export function findingsFromExamSigns(v: Vademecum, signs: Record<string, 'present' | 'absent'>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const f of v.findings.values()) {
    if (f.examSign && signs[f.examSign]) out[f.id] = signs[f.examSign] === 'present';
  }
  return out;
}

/**
 * Decision-rule band findings from recorded calculator results ("Use in decision support"), by
 * record key: the band the value falls in is present, the rule's other bands absent.
 */
export function findingsFromScores(v: Vademecum, recorded: Record<string, number>): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(recorded)) {
    const rule = decisionRuleByRecordKey(key);
    if (!rule) continue;
    const band = ruleBandFor(rule, value);
    if (!band) continue;
    for (const id of v.ruleBands.get(rule.id) ?? []) out[id] = id === `rule.${rule.id}.${band.id}`;
  }
  return out;
}

/** Recorded findings that can start a case (entry points), for seeding the candidates. */
export function entryPointFindings(v: Vademecum, answers: Record<string, boolean>, kinds?: readonly string[]): string[] {
  return Object.entries(answers)
    .filter(([id, present]) => present && v.findings.get(id)?.entryPoint && (!kinds || kinds.includes(v.findings.get(id)!.entryPoint!)))
    .map(([id]) => id)
    .sort();
}
