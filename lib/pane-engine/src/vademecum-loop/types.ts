/**
 * Disease-centred vademecum (phase 1, shadow): types of the shared content files
 * clinical-content/vademecum/findings.json (finding dictionary + loop policy) and
 * clinical-content/vademecum/<area>.json (diseases of one presentation area). They mirror
 * clinical-content/schemas/vademecum-findings.schema.json and vademecum-area.schema.json;
 * lint:shared-content checks them field by field (and the Swift twin, VademecumContent.swift).
 *
 * Nothing in production reads these files yet: the loop runs beside PANE and the iOS engine in the
 * clinical-validation harness (`clinval:web --engine vademecum`). Plan: docs/VADEMECUM-PLAN.md.
 */

export type VademecumLevel = 'history' | 'exam' | 'score' | 'investigation';

export type FindingDimension =
  | 'site' | 'onset' | 'character' | 'radiation' | 'associated' | 'timing' | 'aggravating' | 'relieving' | 'severity' | 'course'
  | 'sputum' | 'risk-factor' | 'pmh' | 'surgical-history' | 'medication' | 'exposure' | 'context' | 'demographic'
  | 'sign' | 'vital' | 'lab' | 'imaging' | 'endoscopy' | 'ecg' | 'pathology' | 'physiology' | 'test' | 'score';

export type EntryPointKind = 'symptom' | 'sign' | 'lab' | 'imaging' | 'pathology' | 'score';

export interface VLrValue {
  point: number;
  low?: number;
  high?: number;
}

export interface VPriorTiers {
  common: number;
  frequent: number;
  uncommon: number;
  rare: number;
  veryRare: number;
}

export interface VThresholds {
  test: number;
  treat: number;
}

export interface VCriteriaFloors {
  definite: number;
  suspected: number;
  referral: number;
}

export interface VademecumPolicy {
  levels: VademecumLevel[];
  priorTiers: VPriorTiers;
  pregnancyPossibleMultiplier: number;
  defaultThresholds: VThresholds;
  cantMissThresholds: VThresholds;
  criteriaFloors: VCriteriaFloors;
  criteriaMinPosterior: number;
  definitiveLR: number;
  minLr: number;
  maxLr: number;
  conflictLowPosterior: number;
  conflictHighPosterior: number;
  criteriaBonus: number;
  minInformationGain: number;
  maxQuestions: number;
  displaySlots: number;
  cantMissSlots: number;
  note: string;
}

export interface VDimensionInfo {
  question: string;
  order: number;
}

export interface VLabSpec {
  analyte: string;
  direction: 'high' | 'low';
  multipleOfUln?: number;
  above?: number;
  below?: number;
}

export interface VDemographicSpec {
  ageMin?: number;
  ageMax?: number;
  sex?: 'male' | 'female';
}

export interface VRuleBandRef {
  rule: string;
  band: string;
}

export interface VademecumFinding {
  id: string;
  label?: string;
  chip?: string;
  synonyms: string[];
  level: VademecumLevel;
  dimension: FindingDimension;
  question?: string;
  baseRate: number;
  group?: string;
  pane?: string;
  examSign?: string;
  decisionRule?: VRuleBandRef;
  lab?: VLabSpec;
  demographic?: VDemographicSpec;
  entryPoint: 'symptom' | 'sign' | 'lab' | 'imaging' | 'pathology' | 'score' | null;
  note?: string;
}

export interface VademecumFindingsFile {
  id: string;
  version: string;
  title: string;
  updated: string;
  lastReviewed: string;
  reviewer: string;
  status: 'shadow' | 'live';
  reference: string;
  policy: VademecumPolicy;
  dimensions: Record<string, VDimensionInfo>;
  findings: VademecumFinding[];
}

export type LinkSeed = 'pane' | 'ios' | 'pane+ios' | 'exam-signs' | 'decision-rules' | 'new';

export interface VademecumLink {
  finding: string;
  lrPositive: VLrValue | null;
  lrNegative: VLrValue | null;
  negativeMeaningful: boolean;
  seed: 'pane' | 'ios' | 'pane+ios' | 'exam-signs' | 'decision-rules' | 'new';
  seedDetail: string;
  source: string;
  fromMemory: boolean;
}

export interface VFindingsByLevel {
  history: VademecumLink[];
  exam: VademecumLink[];
  score: VademecumLink[];
  investigation: VademecumLink[];
}

export type CriteriaOp = 'all' | 'any' | 'atLeast' | 'points' | 'finding' | 'rule' | 'external' | 'age' | 'sex';

export interface CriteriaNode {
  op: 'all' | 'any' | 'atLeast' | 'points' | 'finding' | 'rule' | 'external' | 'age' | 'sex';
  items?: CriteriaNode[];
  k?: number;
  min?: number;
  max?: number;
  weight?: number;
  finding?: string;
  state?: 'present' | 'absent';
  rule?: string;
  bands?: string[];
  evaluator?: string;
  fallback?: CriteriaNode[];
  sex?: 'male' | 'female';
  label?: string;
}

export type CriteriaGrade = 'definite' | 'suspected' | 'referral' | 'classification';

export interface VCriteriaLevel {
  id: string;
  label: string;
  grade: 'definite' | 'suspected' | 'referral' | 'classification';
  when: CriteriaNode;
  action?: string;
}

export interface VDiseaseCriteria {
  id: string;
  name: string;
  kind: 'diagnostic' | 'referral' | 'classification' | 'severity';
  source: string;
  fromMemory: boolean;
  levels: VCriteriaLevel[];
  note?: string;
}

export interface VPathognomonic {
  finding: string;
  lrPositive: VLrValue | null;
  definitive: boolean;
  requires?: string[];
  label: string;
  source: string;
  fromMemory: boolean;
  note?: string;
}

export interface VExclusion {
  id: string;
  finding?: string;
  state?: 'present' | 'absent';
  sex?: 'male' | 'female';
  reason: string;
  note?: string;
  source: string;
  fromMemory: boolean;
}

export interface VWorkupStep {
  id: string;
  label: string;
  when?: CriteriaNode;
  source: string;
  fromMemory: boolean;
}

export interface VIncidentalWorkup {
  trigger: string[];
  classification?: string;
  steps: VWorkupStep[];
  source: string;
  fromMemory: boolean;
  note?: string;
}

export interface VApplicability {
  sex?: 'male' | 'female';
  ageMin?: number;
  ageMax?: number;
  pregnancy?: 'required';
}

export type PrevalenceTier = 'common' | 'frequent' | 'uncommon' | 'rare' | 'veryRare';
export type Urgency = 'routine' | 'soon' | 'urgent' | 'emergency';

export interface VademecumDisease {
  id: string;
  label: string;
  icd10: string;
  pane: string | null;
  ios: string | null;
  prevalenceTier: 'common' | 'frequent' | 'uncommon' | 'rare' | 'veryRare';
  cantMiss: boolean;
  urgency: 'routine' | 'soon' | 'urgent' | 'emergency';
  course: 'acute' | 'subacute' | 'chronic' | 'any';
  applicability?: VApplicability;
  seedFromComplaint: boolean;
  decision?: string;
  findings: VFindingsByLevel;
  criteria: VDiseaseCriteria[];
  pathognomonic: VPathognomonic[];
  exclusions: VExclusion[];
  workupWhenIncidental: VIncidentalWorkup | null;
  source: string;
  signOff: 'pending' | 'signed';
  note?: string;
}

export interface VComplaints {
  frames: string[];
  keywords: string[];
}

export interface VademecumAreaFile {
  id: string;
  version: string;
  title: string;
  updated: string;
  lastReviewed: string;
  reviewer: string;
  status: 'shadow' | 'live';
  area: string;
  setting: string;
  complaints: VComplaints;
  related: string[];
  diseases: VademecumDisease[];
}
