/**
 * "What's missing" — types. One ranked list of the inputs the engines already know are missing
 * (NEWS2 parameters, score inputs, the decision layer's missing inputs, the reasoning panel's best
 * next discriminator, the NG12 ferritin prompt, safety basics), and the score auto-fill that reads
 * the same record. Swift twin: ios/AmiseMedFlow/Services/WhatsMissingCore.swift (+Types).
 */

import type { Band } from '../decision/types.js';

export type MissingAvpu = 'A' | 'C' | 'V' | 'P' | 'U';

export type HistoryFlag =
  | 'cancer' | 'priorDvt' | 'priorPe' | 'chf' | 'ihd' | 'cva' | 'insulin' | 'liverDisease' | 'ibd'
  | 'varicoseVeins' | 'ocpHrt' | 'immobile' | 'pregnant' | 'recentSurgery4w' | 'recentSurgery12w';

export type FindingFlag =
  | 'migration' | 'anorexia' | 'nausea' | 'vomiting' | 'rifPain' | 'rifTenderness' | 'rebound' | 'melaena'
  | 'syncope' | 'haemoptysis' | 'dvtSigns' | 'confusion';

/**
 * The record, as the platform adapters read it (web AppContext, iOS Patient). Numbers are the
 * latest recorded values; null = not recorded.
 */
export interface MissingRecord {
  ageYears: number | null;
  sex: 'male' | 'female' | 'unknown';
  weightKg: number | null;
  heightCm: number | null;
  vitals: {
    hr: number | null;
    sbp: number | null;
    dbp: number | null;
    rr: number | null;
    tempC: number | null;
    spo2: number | null;
    avpu: MissingAvpu | null;
    /** Supplemental oxygen; null = not recorded. */
    onOxygen: boolean | null;
  };
  /**
   * wbc ×10⁹/L (a value above 100 is read as cells/µL); neutrophils as recorded (% when above 20,
   * else ×10⁹/L); crp mg/L; urea mmol/L; hb g/dL (a value above 25 is read as g/L); creatinine µmol/L
   * (a value below 15 is read as mg/dL); egfr mL/min; bilirubin µmol/L; albumin g/L; inr.
   */
  labs: {
    wbc: number | null;
    neutrophils: number | null;
    crp: number | null;
    urea: number | null;
    hb: number | null;
    creatinine: number | null;
    egfr: number | null;
    bilirubin: number | null;
    albumin: number | null;
    inr: number | null;
  };
  /** Any imaging report is on file. */
  imagingReported: boolean;
  /** A pleural effusion is affirmed in an imaging report. */
  pleuralEffusion: boolean;
  history: Record<HistoryFlag, boolean>;
  findings: Record<FindingFlag, boolean>;
}

export type FillSource = 'demographics' | 'vitals' | 'labs' | 'history' | 'findings' | 'imaging';

/** One calculator field pre-filled from the record ("from record", editable). */
export interface FilledField {
  key: string;
  value: boolean | number;
  source: FillSource;
}

export interface ScoreFill {
  score: string;
  fields: FilledField[];
  /** Concept ids the score needs from the record and the record does not hold. */
  missing: string[];
}

/** The platform's reading of the rest of the record (safety basics). */
export interface MissingFacts {
  /** Allergies listed, or NKDA recorded. */
  allergyStatusRecorded: boolean;
  /** Pregnant, not pregnant (test or statement), post-partum, or a pregnancy test result on file. */
  pregnancyStatusRecorded: boolean;
  /** The supplements question has an answer (none / taking). */
  supplementsAsked: boolean;
  /** Current medication names. */
  medications: string[];
  /** Medicines prescribed or planned in this visit. */
  plannedMedications: string[];
  /** Free text where a last dose would be written (medication notes, HPI, plan). */
  medicationNotes: string;
  /** Investigations ordered or suggested and not yet resulted (names). */
  plannedInvestigations: string[];
  /** An operation or procedure is planned. */
  procedurePlanned: boolean;
  /** Emergency, inpatient or post-operative setting: observations are expected. */
  acute: boolean;
}

export type DiscriminatorKind = 'ask' | 'bedside' | 'lab' | 'imaging' | 'advanced';

/** The reasoning panel's best next discriminator (first of its list). */
export interface MissingDiscriminator {
  label: string;
  kind: DiscriminatorKind;
  /** Labels of the diagnoses it separates. */
  separates: string[];
  /**
   * The clinician has confirmed a working diagnosis: the discriminator then ranks after score
   * completeness (it no longer decides the leading diagnosis; the reasoning card still shows it).
   */
  confirmed: boolean;
}

/** A decision-layer missing input, probed with an adverse value (decision-probe.ts). */
export interface DecisionGap {
  /** 'cfs' | 'asa' | 'egfr' | 'pregnancy' | 'bmi' | 'hasBled' | 'news2' | 'score:<key>'. */
  key: string;
  decisionId: string;
  decisionLabel: string;
  /** content.missingInputs[key].effect ('' for a risk score). */
  effect: string;
  /** The first option whose band changes under the probe; null when none changes. */
  flip: { option: string; from: Band; to: Band } | null;
  /** |P − treat threshold| of the flipped option (probability units); null without a flip. */
  distance: number | null;
}

export interface WhatsMissingInput {
  record: MissingRecord;
  facts: MissingFacts;
  /** Scores recommended for this patient or recorded (canonical keys), in display order. */
  activeScores: string[];
  decisionGaps: DecisionGap[];
  /** The NG12 / BSG ferritin prompt fires (microcytic anaemia, no ferritin on file). */
  ferritinMissing: boolean;
  discriminator: MissingDiscriminator | null;
}

export type MissingTier = 'safety' | 'decision' | 'score';

export interface MissingAction {
  kind: 'field' | 'test';
  /** kind 'field': weight | allergies | pregnancy | medications | supplements | vitals | history | exam | score:<key>. */
  field?: string;
  /** kind 'test': the investigation to add as suggested. */
  test?: string;
}

export interface WhatsMissingItem {
  /** Group id (de-duplication key), e.g. 'renal', 'obs', 'score:caprini', 'discriminator'. */
  id: string;
  tier: MissingTier;
  what: string;
  why: string;
  /** Other reasons merged into this item (other engines asking for the same input). */
  also: string[];
  action: MissingAction;
  alt: MissingAction | null;
  /** Which engines raised it: safety, news2, score:<key>, decision:<id>, reasoning, ng12. */
  sources: string[];
}

export interface WhatsMissingResult {
  version: string;
  /** Items shown before "more…". */
  topN: number;
  items: WhatsMissingItem[];
}
