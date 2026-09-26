/**
 * De-identified research export of the outcomes data.
 *
 * Removed: patient id, encounter id and reference, names, MRN, contact details (never in these
 * tables), exact dates. Kept: a random case id that is new for every export (so two exports
 * cannot be linked by it), age band at completion, sex, completion month and outcome-source
 * month, and the coded snapshot and outcome.
 *
 * Only the API server builds it (GET /api/outcomes/research-export: admin only, and refused
 * unless the audit_log row is written first). Residual risk: a rare diagnosis with an age band
 * and a month can still point to one person on a small island — the export is for research
 * under the practice's data-protection terms, not for publication (SURGEON-DECISIONS.md I2).
 */

import type { FinalDiagnosis, PredictionSnapshot } from './types';

export const RESEARCH_EXPORT_VERSION = 'deidentified-v1';

export interface ExportSource {
  snapshot: PredictionSnapshot;
  outcome: FinalDiagnosis | null;
  /** YYYY-MM-DD or null. */
  dateOfBirth: string | null;
  sex: string | null;
}

export interface ResearchCase {
  caseId: string;
  ageBand: string;
  sex: 'male' | 'female' | 'unknown';
  completedMonth: string;
  platform: PredictionSnapshot['platform'];
  differentialEngine: PredictionSnapshot['differentialEngine'];
  differentialModelVersion: string;
  modelVersions: Record<string, string>;
  topDifferential: PredictionSnapshot['topDifferential'];
  triageLevel: string | null;
  triageScale: PredictionSnapshot['triageScale'];
  scores: PredictionSnapshot['scores'];
  decisionBands: PredictionSnapshot['decisionBands'];
  features: Record<string, boolean>;
  workingDiseaseId: string | null;
  workingIcd10: string | null;
  recordedIcd10: string[];
  outcomeTriggers: PredictionSnapshot['outcomeTriggers'];
  outcome: null | {
    finalIcd10: string;
    finalDiseaseId: string | null;
    sourceType: FinalDiagnosis['sourceType'];
    sourceMonth: string;
    actionsTaken: FinalDiagnosis['actionsTaken'];
    retrospectiveAcuity: FinalDiagnosis['retrospectiveAcuity'];
  };
}

export interface ResearchExport {
  format: typeof RESEARCH_EXPORT_VERSION;
  generatedMonth: string;
  cases: ResearchCase[];
  notes: string[];
}

/** Whole years between two YYYY-MM-DD dates (completion date in America/St_Lucia). */
export function ageInYears(dateOfBirth: string | null, onDate: string): number | null {
  if (!dateOfBirth || !/^\d{4}-\d{2}-\d{2}/.test(dateOfBirth) || !/^\d{4}-\d{2}-\d{2}/.test(onDate)) return null;
  const [by, bm, bd] = dateOfBirth.slice(0, 10).split('-').map(Number);
  const [y, m, d] = onDate.slice(0, 10).split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age--;
  return age >= 0 && age < 130 ? age : null;
}

/** 0–15, 16–29, 30–44, 45–59, 60–74, 75+ (top-coded), or "unknown". */
export function ageBand(age: number | null): string {
  if (age === null) return 'unknown';
  if (age < 16) return '0-15';
  if (age < 30) return '16-29';
  if (age < 45) return '30-44';
  if (age < 60) return '45-59';
  if (age < 75) return '60-74';
  return '75+';
}

/** ISO timestamp → YYYY-MM in America/St_Lucia (UTC-4, no DST). */
export function stLuciaMonth(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'unknown';
  return new Date(t - 4 * 3_600_000).toISOString().slice(0, 7);
}

function stLuciaDate(iso: string): string {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t - 4 * 3_600_000).toISOString().slice(0, 10) : '';
}

function shuffle<T>(xs: T[], random: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Builds the export. `newId` must return a fresh random id per call (crypto.randomUUID on the
 * server); `random` shuffles the row order so it does not follow completion order.
 */
export function buildResearchExport(
  sources: ExportSource[], now: Date, newId: () => string, random: () => number = Math.random,
): ResearchExport {
  const cases: ResearchCase[] = sources.map(({ snapshot: s, outcome: o, dateOfBirth, sex }) => ({
    caseId: newId(),
    ageBand: ageBand(ageInYears(dateOfBirth, stLuciaDate(s.completedAt))),
    sex: sex === 'male' || sex === 'female' ? sex : 'unknown',
    completedMonth: stLuciaMonth(s.completedAt),
    platform: s.platform,
    differentialEngine: s.differentialEngine,
    differentialModelVersion: s.differentialModelVersion,
    modelVersions: s.modelVersions,
    topDifferential: s.topDifferential,
    triageLevel: s.triageLevel,
    triageScale: s.triageScale,
    scores: s.scores,
    decisionBands: s.decisionBands,
    features: s.features,
    workingDiseaseId: s.workingDiseaseId,
    workingIcd10: s.workingIcd10,
    recordedIcd10: s.recordedIcd10,
    outcomeTriggers: s.outcomeTriggers,
    outcome: o && o.status === 'confirmed'
      ? {
          finalIcd10: o.finalIcd10, finalDiseaseId: o.finalDiseaseId, sourceType: o.sourceType,
          sourceMonth: o.sourceDate.slice(0, 7), actionsTaken: o.actionsTaken, retrospectiveAcuity: o.retrospectiveAcuity,
        }
      : null,
  }));
  return {
    format: RESEARCH_EXPORT_VERSION,
    generatedMonth: stLuciaMonth(now.toISOString()),
    cases: shuffle(cases, random),
    notes: [
      'De-identified: no names, identifiers or exact dates; age in bands (75+ top-coded); dates as months (America/St_Lucia).',
      'Case ids are random and new in every export: they cannot be linked across exports or back to a record.',
      'A rare diagnosis with an age band and a month may still identify a person. For research under the practice\'s data-protection terms only; do not publish row-level data.',
    ],
  };
}

/** The export back to calibration input (the script can run the report from an export file). */
export function researchExportToCases(x: ResearchExport): { snapshots: PredictionSnapshot[]; outcomes: FinalDiagnosis[] } {
  const snapshots: PredictionSnapshot[] = [];
  const outcomes: FinalDiagnosis[] = [];
  for (const c of x.cases) {
    const ref = `${c.platform}:${c.caseId.replace(/[^A-Za-z0-9-]/g, '').slice(0, 64) || 'case'}`;
    snapshots.push({
      snapshotVersion: 1, platform: c.platform, encounterRef: ref, completedAt: `${c.completedMonth}-01T12:00:00.000Z`,
      differentialEngine: c.differentialEngine, differentialModelVersion: c.differentialModelVersion,
      modelVersions: c.modelVersions, topDifferential: c.topDifferential, triageLevel: c.triageLevel,
      triageScale: c.triageScale, scores: c.scores, decisionBands: c.decisionBands, features: c.features,
      workingDiseaseId: c.workingDiseaseId, workingIcd10: c.workingIcd10, recordedIcd10: c.recordedIcd10,
      expectsOutcome: c.outcomeTriggers.length > 0, outcomeTriggers: c.outcomeTriggers,
    });
    if (c.outcome) {
      outcomes.push({
        encounterRef: ref, finalIcd10: c.outcome.finalIcd10, finalDiseaseId: c.outcome.finalDiseaseId,
        sourceType: c.outcome.sourceType, sourceDate: `${c.outcome.sourceMonth}-01`, actionsTaken: c.outcome.actionsTaken,
        retrospectiveAcuity: c.outcome.retrospectiveAcuity, status: 'confirmed',
      });
    }
  }
  return { snapshots, outcomes };
}
