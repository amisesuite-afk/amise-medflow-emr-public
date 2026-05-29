export interface Feature {
  id: string;
  label: string;
  question: string;
  category: 'symptom' | 'sign' | 'history' | 'investigation';
}

export interface DiseaseNode {
  id: string;
  label: string;
  icd10: string;
  /** Base rate in surgical OPD population [0, 1] */
  prior: number;
  /**
   * P(feature = present | disease) for each feature.
   * Features not listed default to DEFAULT_SENSITIVITY in the engine.
   */
  features: Record<string, number>;
}

export interface PaneState {
  /** disease_id → P(disease | observed evidence so far) */
  posteriors: Record<string, number>;
  /** feature_id → true (present) | false (absent) */
  answered: Record<string, boolean>;
  /** Number of questions answered so far */
  iteration: number;
}

export interface RankedDiagnosis {
  disease: DiseaseNode;
  probability: number;
}
