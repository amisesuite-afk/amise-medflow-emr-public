/**
 * Real-outcomes loop — shared types (web, API server, scripts).
 *
 * A prediction snapshot is what the engines said when an encounter was completed; a final
 * diagnosis is what the clinician confirmed later (histology, operative findings, discharge
 * summary, follow-up). Both hold coded data only: disease ids, ICD-10 codes, numbers, version
 * stamps and fixed value lists. No free text, no names, no dates of birth.
 *
 * Storage: public.prediction_snapshots / public.diagnosis_outcomes (Migration 94,
 * supabase-outcomes-calibration-migration.sql). iOS keeps the same JSON shape on the device
 * (Encounter.predictionSnapshotJson / finalDiagnosisJson, OutcomeSnapshot.swift).
 *
 * Nothing here changes an engine: the calibration report and the proposed adjustments are for
 * the surgeon's review (docs/CLINICAL-CONTENT-UPGRADES.md §4.6).
 */

export type OutcomePlatform = 'web' | 'ios';
export type DifferentialEngine = 'pane' | 'ios-bayes';
export type TriageScale = 'web-adaptive' | 'ios-acuity';

export const OUTCOME_SOURCE_TYPES = [
  'histology', 'report_import', 'operative_findings', 'operative_note', 'discharge_summary', 'follow_up', 'other',
] as const;
export type OutcomeSourceType = (typeof OUTCOME_SOURCE_TYPES)[number];

export const OUTCOME_SOURCE_LABELS: Record<OutcomeSourceType, string> = {
  histology: 'Histology',
  report_import: 'Imported report (lab / imaging)',
  operative_findings: 'Operative findings',
  operative_note: 'Operative note',
  discharge_summary: 'Discharge summary',
  follow_up: 'Follow-up visit',
  other: 'Other',
};

/** Common urgency scale for triage validation (retrospective reference standard). */
export const COMMON_ACUITIES = ['emergency', 'urgent', 'soon', 'routine'] as const;
export type CommonAcuity = (typeof COMMON_ACUITIES)[number];

export type OutcomeTrigger = 'operation' | 'pathology';
export type SnapshotBandValue = 'observe' | 'test' | 'treat' | 'not-for-patient' | 'unknown';
export type SnapshotScoreSource = 'calculator' | 'record' | 'autofill';

export interface DifferentialEntry {
  rank: number;
  /** PANE disease id (web); null on iOS. */
  diseaseId: string | null;
  icd10: string | null;
  /** 0–1 (iOS display percentages divided by 100); null when the engine gave none. */
  probability: number | null;
}

export interface SnapshotScore {
  key: string;
  value: number;
  source: SnapshotScoreSource;
}

export interface SnapshotBand {
  decisionId: string;
  optionId: string;
  kind: string;
  band: SnapshotBandValue;
  /** Probability the decision layer used, 0–1. */
  probability: number | null;
}

export interface PredictionSnapshot {
  snapshotVersion: 1;
  platform: OutcomePlatform;
  /** 'web:<encounters.id>' or 'ios:<Encounter.syncCode>'. */
  encounterRef: string;
  /** ISO timestamp of completion. */
  completedAt: string;
  differentialEngine: DifferentialEngine;
  differentialModelVersion: string;
  /** Every version stamp in force: { pane: '1.0.1', rules: '1.4.0', decision: '…', … }. */
  modelVersions: Record<string, string>;
  topDifferential: DifferentialEntry[];
  triageLevel: string | null;
  triageScale: TriageScale | null;
  scores: SnapshotScore[];
  decisionBands: SnapshotBand[];
  /** Feature ids the engine used (true = present, false = recorded absent). */
  features: Record<string, boolean>;
  workingDiseaseId: string | null;
  workingIcd10: string | null;
  /** ICD-10 codes the clinician recorded (codes only). */
  recordedIcd10: string[];
  /** A final diagnosis is expected later (an operation or pathology). */
  expectsOutcome: boolean;
  outcomeTriggers: OutcomeTrigger[];
}

export interface ActionTaken {
  optionId: string;
  done: boolean;
}

export interface FinalDiagnosis {
  encounterRef: string;
  finalIcd10: string;
  finalDiseaseId: string | null;
  sourceType: OutcomeSourceType;
  /** YYYY-MM-DD. */
  sourceDate: string;
  actionsTaken: ActionTaken[];
  retrospectiveAcuity: CommonAcuity | null;
  status: 'confirmed' | 'retracted';
  /** ISO timestamp (confirmed_at). */
  confirmedAt?: string | null;
}

/** One snapshot joined to its confirmed final diagnosis. */
export interface OutcomeCase {
  snapshot: PredictionSnapshot;
  outcome: FinalDiagnosis;
}

// ── Database rows (Migration 94 column names) ───────────────────────────────────────────────

export interface PredictionSnapshotRow {
  id?: string;
  patient_id: string;
  encounter_id: string | null;
  encounter_ref: string;
  platform: OutcomePlatform;
  completed_at: string;
  snapshot_version: number;
  differential_engine: DifferentialEngine;
  differential_model_version: string;
  model_versions: Record<string, string>;
  top_differential: DifferentialEntry[];
  triage_level: string | null;
  triage_scale: TriageScale | null;
  scores: SnapshotScore[];
  decision_bands: SnapshotBand[];
  features: Record<string, boolean>;
  working_disease_id: string | null;
  working_icd10: string | null;
  recorded_icd10: string[];
  expects_outcome: boolean;
  outcome_triggers: OutcomeTrigger[];
  created_by?: string | null;
  created_at?: string;
}

export interface DiagnosisOutcomeRow {
  id?: string;
  patient_id: string;
  encounter_id: string | null;
  encounter_ref: string;
  client_ref: string | null;
  final_icd10: string;
  final_disease_id: string | null;
  source_type: OutcomeSourceType;
  source_date: string;
  actions_taken: ActionTaken[];
  retrospective_acuity: CommonAcuity | null;
  status: 'confirmed' | 'retracted';
  confirmed_by?: string | null;
  confirmed_at?: string;
  retracted_by?: string | null;
  retracted_at?: string | null;
  created_at?: string;
  updated_at?: string;
}
