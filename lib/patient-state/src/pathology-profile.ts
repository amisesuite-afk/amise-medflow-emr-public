// ─── pathology-profile.ts ─────────────────────────────────────────────────────
//
// Type system for the 360° Clinical Intelligence Sphere.
//
// A PathologyProfile is the static clinical knowledge base for one diagnosis.
// Paired with an AxisScorer (which reads live PatientFactStore data), it
// produces a PatientStateVector — the patient's real-time position across
// all 13 axes of the sphere.
//
// Geometric read: the profile is the printed template; the scorer is the pin
// that places each hexagon cell on the honeycomb; the vector is the resulting
// pattern of dots.

import type { ClinicalFact, FactType } from './types.js';

// ─── Scorer function type ─────────────────────────────────────────────────────
//
// Each profile supplies 13 of these — one per axis, index-matched to profile.axes.
// AxisScorer calls them against the live fact array and stamps the axisId.

export type AxisScorerFn = (facts: ClinicalFact[]) => Omit<AxisScore, 'axisId'>;

// ─── Axes ────────────────────────────────────────────────────────────────────

export const AXIS_COUNT = 13;

export interface AxisDefinition {
  id:          number;    // 1–13
  name:        string;    // "ANATOMY"
  subtitle:    string;    // "LOCATION"
  question:    string;    // "Where?"
  color:       string;    // hex — axis line + label colour
  description: string;    // one-sentence clinical meaning
  factTypes:   FactType[];// which fact types contribute to this axis
}

export interface AxisScore {
  axisId:       number;
  score:        number;    // 0–100 current patient position
  target:       number;    // 0–100 desired/resolved state
  riskThreshold:number;    // score above which complication risk rises
  label:        string;    // "None" | "Mild" | "Moderate" | "Severe" | "Critical"
  evidence:     string[];  // human-readable fact references that drove the score
}

export type PatientStateVector = AxisScore[];

// ─── Differential diagnosis ───────────────────────────────────────────────────

export interface DifferentialDiagnosis {
  name:                  string;
  icd10:                 string;
  color:                 string;    // hex for the convergence map circle
  discriminatingFeatures:string[];  // what pushes toward THIS diagnosis
  keyFindings:           string[];  // classic presentation
  confirmationTests:     string[];
}

// ─── Biomarker pattern ────────────────────────────────────────────────────────

export interface BiomarkerPattern {
  name:       string;
  loinc:      string | null;
  snomed:     string | null;
  direction:  'up' | 'down' | 'normal';
  significance: string;
  threshold?: { value: number; unit: string };
}

// ─── Severity scoring ─────────────────────────────────────────────────────────

export interface SeverityCriterion {
  label:       string;
  points:      number;
  description: string;
  // How to detect this criterion from the fact store
  // Returns true if criterion is met
  detect?: (facts: import('./types.js').ClinicalFact[]) => boolean;
}

export interface SeverityBand {
  min:   number;
  max:   number;
  label: string;
  color: string;  // background
  text:  string;  // text colour
}

// ─── Management ───────────────────────────────────────────────────────────────

export interface ManagementStep {
  order:     number;
  icon:      string;
  label:     string;
  details:   string[];
  factTypes?: FactType[];
}

// ─── Clinical code row (Vademecum table) ────────────────────────────────────

export interface ClinicalCodeRow {
  concept:  string;
  icd10:    string | null;
  snomed:   string | null;
  loinc:    string | null;
  example:  string | null;
}

// ─── PathologyProfile ─────────────────────────────────────────────────────────

export interface PathologyProfile {
  // Identity
  icd10:    string;
  snomed:   string;
  name:     string;
  subtitle: string;
  definition: string;

  // Anatomy
  anatomyAtRisk: { label: string; color: string }[];

  // The 13 axes
  axes: AxisDefinition[];

  // DDx convergence map
  differentials: DifferentialDiagnosis[];

  // Key biomarker pattern (the "music key" for labs)
  biomarkerPattern: BiomarkerPattern[];

  // Vademecum panels
  symptoms:            string[];
  signs:               string[];
  laboratoryFindings:  string[];
  radiologyFindings:   string[];

  // Severity scoring system
  severity: {
    name:        string;
    description: string;
    criteria:    SeverityCriterion[];
    bands:       SeverityBand[];
  };

  // Management pathway
  managementSteps: ManagementStep[];

  // Clinical coding table
  clinicalCodes: ClinicalCodeRow[];

  // Uncertainty flags — gaps that trigger the uncertainty axis
  uncertaintyFlags: string[];

  // Clinical pearls
  clinicalPearls: string[];

  // Per-profile axis scoring functions (index-matched to axes[]).
  // If omitted, AxisScorer falls back to K83.1-default scoring logic.
  scorerFns?: AxisScorerFn[];
}
