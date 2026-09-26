/**
 * Diagnostic-reasoning rules shared by web and iOS: clinical-content/rules/diagnostic-reasoning-rules.json
 * (schema clinical-content/schemas/diagnostic-reasoning-rules.schema.json; rule set
 * `diagnostic-reasoning-rules`, version DIAGNOSTIC_REASONING_VERSION). UNREVIEWED: needs the
 * surgeon's sign-off (docs/clinical-validation/changes/diagnostic-reasoning.md).
 *
 * iOS reads the same file (DiagnosticReasoningRules.swift, bundled folder "rules"); the core
 * thresholds are compiled into DiagnosticReasoningCore.swift and pinned to this file by
 * scripts/src/diagnostic-reasoning-parity.test.ts. Change the JSON, not a platform copy;
 * `lint:shared-content` validates it and checks these types and the Swift Codable structs.
 */

import rawRules from '../../../../clinical-content/rules/diagnostic-reasoning-rules.json';

export interface ReasoningThresholds {
  /** A present finding with LR ≥ this supports the hypothesis. */
  supportLr: number;
  /** A present (or documented-absent) finding with LR ≤ this argues against it. */
  againstLr: number;
  /** A finding "favours" another hypothesis when its LR there is ≥ this. */
  favourLr: number;
  /** A hypothesis with no supporting finding of LR ≥ this is shown as "low evidence". */
  lowEvidenceLr: number;
  /** Premature-closure alert: a finding against the working diagnosis with LR ≤ this. */
  strongContradictionLr: number;
  /** Premature-closure alert: the finding that drives the leader has an LR ratio ≥ this (leader / working). */
  strongFavourLr: number;
  /** Premature-closure alert: the leader is at least this many times more probable… */
  lessLikelyRatio: number;
  /** …and at least this probable. */
  lessLikelyMinLeader: number;
  /** NEWS2 rise (latest minus the lowest earlier reading) that raises an alert… */
  news2RiseMin: number;
  /** …when the latest NEWS2 is at least this (RCP NEWS2: 5 = urgent ward-based response). */
  news2AlertMin: number;
  /** Diagnostic time-out: this many recorded findings unexplained by the leading diagnoses. */
  unexplainedTimeOut: number;
  /** Expected information gain (nats) below which a probe is not offered. */
  minGain: number;
  /** At most this many premature-closure alerts. */
  maxClosureAlerts: number;
}

export interface ReasoningClosureRules {
  /** A single contradicting finding alerts only at LR ≤ this (moderate or strong evidence against). */
  contradictionMaxLr: number;
  contradictionSource: string;
}

export interface WorkingDiagnosisRules {
  labelMatchMin: number;
  labelMatchMinAlone: number;
  labelMatchMargin: number;
  neutralWords: string[];
  opposites: Record<string, string>;
}

export interface DiagnosisFamilyRules {
  complicationModifiers: string[];
  genericTailWords: string[];
  synonyms: Record<string, string>;
  injuryChapter: string;
}

export interface CoexistingRules {
  paneIds: string[];
  nameTerms: string[];
}

/** clinical-content/rules/diagnostic-reasoning-rules.json (checked against its schema by lint:shared-content). */
export interface ReasoningRuleFile {
  id: string;
  version: string;
  thresholds: ReasoningThresholds;
  closure: ReasoningClosureRules;
  workingDiagnosis: WorkingDiagnosisRules;
  families: DiagnosisFamilyRules;
  coexisting: CoexistingRules;
}

export const REASONING_RULES = rawRules as ReasoningRuleFile;

/** Version of the shared reasoning rules (core + adapter rules); iOS DiagnosticReasoning.version. */
export const DIAGNOSTIC_REASONING_VERSION: string = REASONING_RULES.version;
