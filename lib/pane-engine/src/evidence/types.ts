/**
 * Evidence-based examination signs and clinical decision rules (the shared files
 * clinical-content/rules/exam-signs.json and decision-rules.json, also read by iOS). Types mirror
 * clinical-content/schemas/exam-signs.schema.json and decision-rules.schema.json
 * (lint:shared-content checks them).
 */

export interface LrValue {
  point: number;
  low?: number;
  high?: number;
}

export type SignSystem =
  | 'abdomen' | 'hernia' | 'chest' | 'cardiac' | 'vascular' | 'breast' | 'thyroid' | 'neuro' | 'liver'
  | 'dehydration' | 'sepsis' | 'rectal' | 'lymph-nodes';

/** lr: own engine feature; twin: records the listed engine features (safety signs); none: display only. */
export type SignEngineMode = 'lr' | 'twin' | 'none';

export type EvidenceQuality = 'pooled meta-analysis' | 'single study' | 'expert consensus';

export interface SignTarget {
  group: string;
  /** Finding-level sign: the PANE finding feature it detects (ascites, dehydration). */
  paneFeature?: string;
  /** Reference pre-test probability of the finding, for the "moved from → to" display only. */
  pretest?: number;
}

export interface ExamSign {
  id: string;
  name: string;
  synonyms: string[];
  system: SignSystem;
  region: string;
  elicit: string;
  presentations: string[];
  target: SignTarget;
  alsoTargets?: { group: string; lrPositive: LrValue }[];
  lrPositive: LrValue | null;
  lrNegative: LrValue | null;
  negativeMeaningful: boolean;
  engine: SignEngineMode;
  supersedes: string[];
  twins?: { present?: string[]; absent?: string[] };
  applicability?: { ageMin?: number; ageMax?: number };
  source: string;
  fromMemory: boolean;
  quality: EvidenceQuality;
  note?: string;
}

export interface TargetGroup {
  label: string;
  pane: string[];
  ios: string[];
}

export interface Presentation {
  label: string;
  keywords: string[];
}

/** iOS primary examination field for a history frame (ExamRegion.swift). */
export type ExamRegionId =
  | 'abdomen' | 'chest-cardiac' | 'chest-respiratory' | 'neck' | 'breast' | 'groin' | 'oropharynx' | 'perianal'
  | 'skin' | 'wound' | 'lump' | 'scrotal' | 'urological' | 'neuro' | 'limb' | 'back' | 'general';

/** Web examination system key (ExaminationTab EXAM_SYSTEMS). */
export type ExamSystemKey =
  | 'general' | 'respiratory' | 'cardiovascular' | 'abdomen' | 'perineal' | 'anal' | 'genital' | 'neurological'
  | 'extremities' | 'breast' | 'wound' | 'skin';

/**
 * The Exam step for a history frame (history-frames classifyComplaint: the classifier the history
 * step uses), keyed by frame id or symptom type.
 */
export interface ExamFrame {
  region: ExamRegionId;
  systems: ExamSystemKey[];
  /** Keys of ExamSignsContent.presentations. */
  presentations: string[];
}

export interface ExamSignsContent {
  /** Always "exam-signs" (the registry id; the schema pins it). */
  id: string;
  version: string;
  title: string;
  updated: string;
  lastReviewed: string;
  reviewer: string;
  reference: string;
  conversion: string;
  engineModes: { lr: string; twin: string; none: string };
  absencePolicy: string;
  frames: Record<string, ExamFrame>;
  presentations: Record<string, Presentation>;
  targetGroups: Record<string, TargetGroup>;
  signs: ExamSign[];
}

export interface RuleBand {
  id: string;
  label: string;
  min?: number;
  max?: number;
  lr: LrValue | null;
  risk?: string;
}

export interface DecisionRule {
  id: string;
  name: string;
  kind: 'diagnostic' | 'prognostic';
  recordKey: string;
  target: { finding: string; pane: string[]; ios: string[]; pretest?: number };
  web: { calculator: string };
  ios: { param: string; activeScore: string } | null;
  bands: RuleBand[];
  components: { signs: string[]; paneFeatures: string[] };
  supersededBy: string[];
  appliesWhen?: { rule: string; max: number };
  negativeMeaningful: boolean;
  presentations: string[];
  source: string;
  fromMemory: boolean;
  quality: EvidenceQuality;
  note?: string;
}

export interface DecisionRulesContent {
  /** Always "decision-rules" (the registry id; the schema pins it). */
  id: string;
  version: string;
  title: string;
  updated: string;
  lastReviewed: string;
  reviewer: string;
  reference: string;
  evidencePolicy: Record<string, string>;
  rules: DecisionRule[];
}

/** A sign chip on the exam step: present, or examined and absent. Unrecorded = not examined. */
export type SignState = 'present' | 'absent';
