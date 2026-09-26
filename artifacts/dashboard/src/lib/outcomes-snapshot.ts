/**
 * Outcomes loop — the web prediction snapshot taken when an encounter is completed (the
 * sign-off dialog's "Sign & close encounter"). Sent with POST /api/visit/complete and stored in
 * prediction_snapshots (Migration 94) by the API server, which sanitises it again.
 *
 * What it holds (coded data only — disease ids, ICD-10 codes, numbers, version stamps):
 *   - the PANE top differential (up to 5) with posterior probabilities, and the PANE feature ids
 *     answered (for likelihood proposals);
 *   - the adaptive-triage level;
 *   - the decision-support scores (recorded calculators, NEWS2 / qSOFA from the vitals);
 *   - the decision layer's band for every option (observe / test / treat / not for patient);
 *   - the clinician's working diagnosis (PANE id, ICD-10) and recorded ICD-10 codes;
 *   - the model and rule versions;
 *   - whether a final diagnosis is expected later: an operation (CPT code, procedure name or
 *     peri-operative procedure recorded) or pathology (a biopsy / histology / cytology request).
 *     Only the yes/no flags are kept, never the text they were read from.
 *
 * Pure and deterministic (no '@/' imports; tested in __tests__/outcomes-snapshot.test.ts).
 * It reads the engines' outputs and never changes them.
 */

import {
  DECISION_CONTENT_VERSION, DISEASES, FEATURES, MANAGEMENT_PROTOCOLS_VERSION, PANE_MODEL_VERSION, PLAN_SAFETY_VERSION,
  topDiagnoses,
} from '@workspace/pane-engine';
import type { DecisionScore, DecisionSupportResult, PaneState } from '@workspace/pane-engine';
import { EMERGENCY_RULES_VERSION, RULES_VERSION } from '@workspace/triage-engine';
import { DIAGNOSTIC_REASONING_VERSION } from '@workspace/triage-engine/diagnostic-reasoning';
import { encounterRefFor, normaliseDiseaseId, normaliseIcd10, sanitizeSnapshot } from '@workspace/triage-engine/outcomes';
import type { OutcomeTrigger, PredictionSnapshot, SnapshotBand } from '@workspace/triage-engine/outcomes';

export const OUTCOME_SNAPSHOT_TOP_N = 5;

export interface WebSnapshotInput {
  encounterId: string;
  /** ISO timestamp. */
  completedAt: string;
  paneTop: { disease: { id: string; icd10?: string }; probability: number }[];
  paneState: PaneState | null;
  /** AdaptiveTriageResult.acuity. */
  triageAcuity: string | null;
  decision: DecisionSupportResult | null;
  decisionScores: DecisionScore[];
  workingDiagnosis: { diseaseId: string | null; icdCode: string | null; locked?: boolean } | null;
  /** "K35.80 — Acute appendicitis" entries (only the code is kept). */
  icdCodes: string[];
  cptCodes: string[];
  procedureName?: string | null;
  periopProcId?: string | null;
  /** Assessment "procedures" field. */
  procedures?: string | null;
  orderedInvestigations: string[];
  radiologyStudies?: string[];
}

const FEATURE_IDS = new Set(FEATURES.map(f => f.id));
const PATHOLOGY_RE = /\b(biops(?:y|ies)|histolog\w*|histopath\w*|cytolog\w*|fna|fine[- ]needle|frozen section|core needle)\b/i;

export function outcomeTriggers(input: Pick<WebSnapshotInput, 'cptCodes' | 'procedureName' | 'periopProcId' | 'procedures' | 'orderedInvestigations' | 'radiologyStudies'>): OutcomeTrigger[] {
  const out: OutcomeTrigger[] = [];
  const operation = input.cptCodes.some(c => c.trim())
    || !!input.procedureName?.trim() || !!input.periopProcId?.trim() || !!input.procedures?.trim();
  if (operation) out.push('operation');
  const tests = [...input.orderedInvestigations, ...(input.radiologyStudies ?? [])];
  if (tests.some(t => PATHOLOGY_RE.test(t))) out.push('pathology');
  return out;
}

function leading(input: WebSnapshotInput): { diseaseId: string; icd10: string | null; probability: number }[] {
  const live = input.paneTop.filter(r => typeof r?.disease?.id === 'string');
  if (live.length > 0) {
    return live.slice(0, OUTCOME_SNAPSHOT_TOP_N).map(r => ({ diseaseId: r.disease.id, icd10: r.disease.icd10 ?? null, probability: r.probability }));
  }
  if (input.paneState && Object.keys(input.paneState.posteriors ?? {}).length > 0) {
    return topDiagnoses(input.paneState, DISEASES, OUTCOME_SNAPSHOT_TOP_N)
      .map(r => ({ diseaseId: r.disease.id, icd10: r.disease.icd10 ?? null, probability: r.probability }));
  }
  return [];
}

function bands(decision: DecisionSupportResult | null): SnapshotBand[] {
  if (!decision) return [];
  const out: SnapshotBand[] = [];
  for (const d of decision.decisions) {
    for (const o of d.options) {
      out.push({ decisionId: d.id, optionId: o.id, kind: o.kind, band: o.band, probability: d.probability });
    }
  }
  return out;
}

function features(state: PaneState | null): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const [id, v] of Object.entries(state?.answered ?? {})) {
    if (FEATURE_IDS.has(id) && typeof v === 'boolean') out[id] = v;
  }
  return out;
}

export function webModelVersions(): Record<string, string> {
  return {
    pane: PANE_MODEL_VERSION,
    rules: RULES_VERSION,
    emergency: EMERGENCY_RULES_VERSION,
    decision: DECISION_CONTENT_VERSION,
    management: MANAGEMENT_PROTOCOLS_VERSION,
    planSafety: PLAN_SAFETY_VERSION,
    reasoning: DIAGNOSTIC_REASONING_VERSION,
  };
}

/** The snapshot for a completed web encounter, or null when the encounter id is not usable. */
export function buildWebPredictionSnapshot(input: WebSnapshotInput): PredictionSnapshot | null {
  const encounterRef = encounterRefFor('web', input.encounterId);
  if (!encounterRef) return null;
  const triggers = outcomeTriggers(input);
  const wd = input.workingDiagnosis;
  const result = sanitizeSnapshot({
    platform: 'web',
    encounterRef,
    completedAt: input.completedAt,
    differentialEngine: 'pane',
    differentialModelVersion: PANE_MODEL_VERSION,
    modelVersions: webModelVersions(),
    topDifferential: leading(input).map((r, i) => ({ rank: i + 1, ...r })),
    triageLevel: input.triageAcuity,
    triageScale: input.triageAcuity ? 'web-adaptive' : null,
    scores: input.decisionScores.map(s => ({ key: s.key, value: s.value, source: s.source })),
    decisionBands: bands(input.decision),
    features: features(input.paneState),
    // Only a clinician-confirmed working diagnosis counts as "the clinician's".
    workingDiseaseId: wd?.locked ? normaliseDiseaseId(wd.diseaseId) : null,
    workingIcd10: wd?.locked ? normaliseIcd10(wd.icdCode) : null,
    recordedIcd10: input.icdCodes,
    outcomeTriggers: triggers,
  });
  return result.ok ? result.value : null;
}
