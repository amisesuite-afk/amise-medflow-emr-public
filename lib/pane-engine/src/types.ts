export interface Feature {
  id: string;
  label: string;
  question: string;
  category: 'symptom' | 'sign' | 'history' | 'investigation';
  /**
   * P(feature present | a disease that does not model it): the background rate of the finding
   * in an undifferentiated adult outpatient / acute-referral population. A disease that does not
   * list the feature is scored at this rate, so the finding is neutral for it (likelihood ratio
   * 1 against the background) instead of counting against or for it. Defaults to
   * DEFAULT_BASE_RATE (constants.ts).
   */
  baseRate?: number;
  /**
   * false: never offered as a PANE question or "best next discriminator" (examination-sign and
   * decision-rule evidence features, recorded on the Exam step and the Scales step instead).
   */
  askable?: boolean;
}

/** Usual time course of the presentation, used to score the onset features. */
export type DiseaseCourse = 'acute' | 'subacute' | 'chronic' | 'any';

/**
 * Who the disease can occur in. A patient outside the stated range gets a prior of 0 (the
 * disease is not offered). An unknown age, sex or pregnancy status never excludes.
 */
export interface Applicability {
  sex?: 'female' | 'male';
  /** Years (fractions allowed: 0.08 ≈ 4 weeks). */
  ageMin?: number;
  ageMax?: number;
  /**
   * 'required': only in pregnancy or the puerperium (ectopic pregnancy, pre-eclampsia,
   * abruption). Excluded for male patients and outside ages 10–55; boosted when the clinician
   * marks pregnancy as possible (see PREGNANCY_POSSIBLE_MULTIPLIER).
   */
  pregnancy?: 'required';
}

export interface DiseaseNode {
  id: string;
  label: string;
  icd10: string;
  /**
   * Relative base rate in an undifferentiated adult outpatient / acute-referral population
   * (priors.ts tiers), among the patients the node applies to. initPaneState normalises.
   */
  prior: number;
  /**
   * P(feature = present | disease) for each feature.
   * Features not listed use the feature's base rate (neutral), or a value derived from the
   * disease's other features (likelihood.ts: abdominal pain from the pain sites, onset from
   * `course`).
   */
  features: Record<string, number>;
  /** Usual course; drives the acute_onset / chronic_course features when not listed. */
  course?: DiseaseCourse;
  applicability?: Applicability;
}

/** Patient context that changes priors (not features). */
export interface PatientContext {
  /** The clinician has marked pregnancy as possible (AppContext.pregnancyPossible). */
  pregnancyPossible?: boolean;
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
