/**
 * Coded-data validation for the outcomes loop. Every value that reaches
 * prediction_snapshots / diagnosis_outcomes goes through these, on the client that builds it
 * and again on the API server that stores it (a malformed or free-text value is dropped, never
 * stored). The patterns match the CHECK constraints in Migration 94.
 */

import {
  COMMON_ACUITIES, OUTCOME_SOURCE_TYPES,
} from './types';
import type {
  ActionTaken, CommonAcuity, DiagnosisOutcomeRow, DifferentialEngine, DifferentialEntry, FinalDiagnosis,
  OutcomePlatform, OutcomeSourceType, OutcomeTrigger, PredictionSnapshot, PredictionSnapshotRow, SnapshotBand,
  SnapshotBandValue, SnapshotScore, TriageScale,
} from './types';

export const ICD10_RE = /^[A-Z][0-9][0-9A-Z](\.[0-9A-Z]{1,4})?$/;
export const DISEASE_ID_RE = /^[a-z0-9_]{1,80}$/;
export const ENCOUNTER_REF_RE = /^(web|ios):[A-Za-z0-9-]{1,64}$/;
export const CLIENT_REF_RE = /^[A-Za-z0-9:-]{1,80}$/;
/** Score keys, option / decision ids, feature ids: short machine identifiers only. */
export const KEY_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
const VERSION_RE = /^[0-9A-Za-z.+_-]{1,32}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const WEB_TRIAGE = new Set(['urgent', 'priority', 'review', 'routine']);
const IOS_TRIAGE = new Set(['emergency', 'urgent', 'priority', 'routine']);
const BANDS = new Set<SnapshotBandValue>(['observe', 'test', 'treat', 'not-for-patient', 'unknown']);
const SCORE_SOURCES = new Set(['calculator', 'record', 'autofill']);

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

/**
 * "K35.80 — Acute appendicitis" → "K35.80"; "k3580" → "K35.80"; anything that is not an ICD-10
 * code → null. Only the code survives, never the label.
 */
export function normaliseIcd10(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const head = raw.split(/\s+[—–-]\s+|\s{2,}|,|;/)[0]?.trim().toUpperCase().replace(/\s+/g, '') ?? '';
  if (!head) return null;
  const dotted = /^[A-Z][0-9][0-9A-Z][0-9A-Z]{1,4}$/.test(head) ? `${head.slice(0, 3)}.${head.slice(3)}` : head;
  return ICD10_RE.test(dotted) ? dotted : null;
}

/** ICD-10 category (first three characters): "K35.80" → "K35". */
export function icdCategory(code: string | null | undefined): string | null {
  const n = normaliseIcd10(code ?? '');
  return n ? n.slice(0, 3) : null;
}

export function normaliseDiseaseId(raw: unknown): string | null {
  return typeof raw === 'string' && DISEASE_ID_RE.test(raw) ? raw : null;
}

export function encounterRefFor(platform: OutcomePlatform, id: string): string | null {
  const ref = `${platform}:${id}`;
  return ENCOUNTER_REF_RE.test(ref) ? ref : null;
}

function probability(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.round(Math.min(1, Math.max(0, v)) * 10000) / 10000;
}

function finite(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function isoDate(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** YYYY-MM-DD, a real calendar date, not before 2000. */
export function normaliseSourceDate(v: unknown): string | null {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== v) return null;
  return v >= '2000-01-01' ? v : null;
}

function differential(v: unknown): DifferentialEntry[] {
  if (!Array.isArray(v)) return [];
  const out: DifferentialEntry[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const diseaseId = normaliseDiseaseId(r.diseaseId);
    const icd10 = normaliseIcd10(r.icd10);
    if (!diseaseId && !icd10) continue;
    out.push({ rank: out.length + 1, diseaseId, icd10, probability: probability(r.probability) });
    if (out.length === 10) break;
  }
  return out;
}

function scores(v: unknown): SnapshotScore[] {
  if (!Array.isArray(v)) return [];
  const out: SnapshotScore[] = [];
  const seen = new Set<string>();
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const value = finite(r.value);
    if (typeof r.key !== 'string' || !KEY_RE.test(r.key) || value === null || seen.has(r.key)) continue;
    seen.add(r.key);
    out.push({ key: r.key, value, source: SCORE_SOURCES.has(r.source as string) ? r.source as SnapshotScore['source'] : 'record' });
    if (out.length === 60) break;
  }
  return out;
}

function bands(v: unknown): SnapshotBand[] {
  if (!Array.isArray(v)) return [];
  const out: SnapshotBand[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.decisionId !== 'string' || !KEY_RE.test(r.decisionId)) continue;
    if (typeof r.optionId !== 'string' || !KEY_RE.test(r.optionId)) continue;
    const kind = typeof r.kind === 'string' && KEY_RE.test(r.kind) ? r.kind : 'unknown';
    const band = BANDS.has(r.band as SnapshotBandValue) ? r.band as SnapshotBandValue : 'unknown';
    out.push({ decisionId: r.decisionId, optionId: r.optionId, kind, band, probability: probability(r.probability) });
    if (out.length === 60) break;
  }
  return out;
}

function features(v: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  let n = 0;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (!KEY_RE.test(k) || typeof val !== 'boolean') continue;
    out[k] = val;
    if (++n === 200) break;
  }
  return out;
}

function versions(v: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (KEY_RE.test(k) && typeof val === 'string' && VERSION_RE.test(val)) out[k] = val;
  }
  return out;
}

function triage(level: unknown, scale: unknown): { level: string | null; scale: TriageScale | null } {
  if (scale === 'web-adaptive' && typeof level === 'string' && WEB_TRIAGE.has(level)) return { level, scale };
  if (scale === 'ios-acuity' && typeof level === 'string' && IOS_TRIAGE.has(level)) return { level, scale };
  return { level: null, scale: null };
}

export type SanitizeResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Keeps only coded values from an untrusted snapshot (the API calls this on the request body).
 * Unknown keys are dropped; a snapshot without a valid platform, reference, completion time or
 * engine version is refused.
 */
export function sanitizeSnapshot(input: unknown): SanitizeResult<PredictionSnapshot> {
  if (!input || typeof input !== 'object') return { ok: false, error: 'snapshot must be an object' };
  const s = input as Record<string, unknown>;
  const platform = s.platform === 'web' || s.platform === 'ios' ? s.platform as OutcomePlatform : null;
  if (!platform) return { ok: false, error: 'platform must be web or ios' };
  const encounterRef = typeof s.encounterRef === 'string' && ENCOUNTER_REF_RE.test(s.encounterRef)
    && s.encounterRef.startsWith(`${platform}:`) ? s.encounterRef : null;
  if (!encounterRef) return { ok: false, error: 'invalid encounterRef' };
  const completedAt = isoDate(s.completedAt);
  if (!completedAt) return { ok: false, error: 'invalid completedAt' };
  const engine = s.differentialEngine === 'pane' || s.differentialEngine === 'ios-bayes'
    ? s.differentialEngine as DifferentialEngine : null;
  if (!engine) return { ok: false, error: 'invalid differentialEngine' };
  const modelVersion = typeof s.differentialModelVersion === 'string' && VERSION_RE.test(s.differentialModelVersion)
    ? s.differentialModelVersion : null;
  if (!modelVersion) return { ok: false, error: 'invalid differentialModelVersion' };
  const t = triage(s.triageLevel, s.triageScale);
  const triggers = Array.isArray(s.outcomeTriggers)
    ? [...new Set(s.outcomeTriggers.filter((x): x is OutcomeTrigger => x === 'operation' || x === 'pathology'))]
    : [];
  const recorded = Array.isArray(s.recordedIcd10)
    ? [...new Set(s.recordedIcd10.map(normaliseIcd10).filter((x): x is string => !!x))].slice(0, 20)
    : [];
  return {
    ok: true,
    value: {
      snapshotVersion: 1,
      platform,
      encounterRef,
      completedAt,
      differentialEngine: engine,
      differentialModelVersion: modelVersion,
      modelVersions: versions(s.modelVersions),
      topDifferential: differential(s.topDifferential),
      triageLevel: t.level,
      triageScale: t.scale,
      scores: scores(s.scores),
      decisionBands: bands(s.decisionBands),
      features: features(s.features),
      workingDiseaseId: normaliseDiseaseId(s.workingDiseaseId),
      workingIcd10: normaliseIcd10(s.workingIcd10),
      recordedIcd10: recorded,
      expectsOutcome: triggers.length > 0,
      outcomeTriggers: triggers,
    },
  };
}

export function sanitizeFinalDiagnosis(input: unknown): SanitizeResult<FinalDiagnosis> {
  if (!input || typeof input !== 'object') return { ok: false, error: 'final diagnosis must be an object' };
  const s = input as Record<string, unknown>;
  const encounterRef = typeof s.encounterRef === 'string' && ENCOUNTER_REF_RE.test(s.encounterRef) ? s.encounterRef : null;
  if (!encounterRef) return { ok: false, error: 'invalid encounterRef' };
  const finalIcd10 = normaliseIcd10(s.finalIcd10);
  if (!finalIcd10) return { ok: false, error: 'a valid ICD-10 code is required' };
  const sourceType = (OUTCOME_SOURCE_TYPES as readonly string[]).includes(s.sourceType as string)
    ? s.sourceType as OutcomeSourceType : null;
  if (!sourceType) return { ok: false, error: 'invalid source type' };
  const sourceDate = normaliseSourceDate(s.sourceDate);
  if (!sourceDate) return { ok: false, error: 'invalid source date' };
  const acuity = (COMMON_ACUITIES as readonly string[]).includes(s.retrospectiveAcuity as string)
    ? s.retrospectiveAcuity as CommonAcuity : null;
  const actions: ActionTaken[] = [];
  if (Array.isArray(s.actionsTaken)) {
    const seen = new Set<string>();
    for (const raw of s.actionsTaken) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      if (typeof r.optionId !== 'string' || !KEY_RE.test(r.optionId) || typeof r.done !== 'boolean' || seen.has(r.optionId)) continue;
      seen.add(r.optionId);
      actions.push({ optionId: r.optionId, done: r.done });
      if (actions.length === 60) break;
    }
  }
  return {
    ok: true,
    value: {
      encounterRef, finalIcd10, finalDiseaseId: normaliseDiseaseId(s.finalDiseaseId), sourceType, sourceDate,
      actionsTaken: actions, retrospectiveAcuity: acuity,
      status: s.status === 'retracted' ? 'retracted' : 'confirmed',
      confirmedAt: isoDate(s.confirmedAt),
    },
  };
}

// ── Row mapping ─────────────────────────────────────────────────────────────────────────────

export function snapshotToRow(
  s: PredictionSnapshot, patientId: string, encounterId: string | null, createdBy: string | null,
): PredictionSnapshotRow {
  return {
    patient_id: patientId,
    encounter_id: isUuid(encounterId) ? encounterId : null,
    encounter_ref: s.encounterRef,
    platform: s.platform,
    completed_at: s.completedAt,
    snapshot_version: s.snapshotVersion,
    differential_engine: s.differentialEngine,
    differential_model_version: s.differentialModelVersion,
    model_versions: s.modelVersions,
    top_differential: s.topDifferential,
    triage_level: s.triageLevel,
    triage_scale: s.triageScale,
    scores: s.scores,
    decision_bands: s.decisionBands,
    features: s.features,
    working_disease_id: s.workingDiseaseId,
    working_icd10: s.workingIcd10,
    recorded_icd10: s.recordedIcd10,
    expects_outcome: s.expectsOutcome,
    outcome_triggers: s.outcomeTriggers,
    created_by: isUuid(createdBy) ? createdBy : null,
  };
}

/** A stored row back to a snapshot; the same sanitiser runs, so a bad row cannot skew a report. */
export function rowToSnapshot(row: Partial<PredictionSnapshotRow> | null | undefined): PredictionSnapshot | null {
  if (!row) return null;
  const r = sanitizeSnapshot({
    platform: row.platform, encounterRef: row.encounter_ref, completedAt: row.completed_at,
    differentialEngine: row.differential_engine, differentialModelVersion: row.differential_model_version,
    modelVersions: row.model_versions, topDifferential: row.top_differential, triageLevel: row.triage_level,
    triageScale: row.triage_scale, scores: row.scores, decisionBands: row.decision_bands, features: row.features,
    workingDiseaseId: row.working_disease_id, workingIcd10: row.working_icd10, recordedIcd10: row.recorded_icd10,
    outcomeTriggers: row.outcome_triggers,
  });
  return r.ok ? r.value : null;
}

export function outcomeToRow(
  o: FinalDiagnosis, patientId: string, encounterId: string | null, clientRef: string | null, confirmedBy: string | null,
): DiagnosisOutcomeRow {
  return {
    patient_id: patientId,
    encounter_id: isUuid(encounterId) ? encounterId : null,
    encounter_ref: o.encounterRef,
    client_ref: clientRef && CLIENT_REF_RE.test(clientRef) ? clientRef : null,
    final_icd10: o.finalIcd10,
    final_disease_id: o.finalDiseaseId,
    source_type: o.sourceType,
    source_date: o.sourceDate,
    actions_taken: o.actionsTaken,
    retrospective_acuity: o.retrospectiveAcuity,
    status: 'confirmed',
    confirmed_by: isUuid(confirmedBy) ? confirmedBy : null,
  };
}

export function rowToOutcome(row: Partial<DiagnosisOutcomeRow> | null | undefined): FinalDiagnosis | null {
  if (!row) return null;
  const r = sanitizeFinalDiagnosis({
    encounterRef: row.encounter_ref, finalIcd10: row.final_icd10, finalDiseaseId: row.final_disease_id,
    sourceType: row.source_type, sourceDate: row.source_date, actionsTaken: row.actions_taken,
    retrospectiveAcuity: row.retrospective_acuity, status: row.status, confirmedAt: row.confirmed_at,
  });
  return r.ok ? r.value : null;
}
