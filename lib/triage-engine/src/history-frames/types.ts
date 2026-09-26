/**
 * History frames — the structure of the history of presenting complaint, chosen from the chief
 * complaint (docs/clinical-validation/changes/history-by-complaint.md).
 *
 * SOCRATES is a pain history. A cough, a lump or rectal bleeding has its own standard questions,
 * so each symptom type has its own frame: dimensions (questions) and their options (chips).
 *
 * One definition drives both platforms:
 *   web  — HpiTab / ChiefComplaintStrip fields (answers keyed by the dimension's web key, read by
 *          socrates-to-features.ts);
 *   iOS  — the HPI step's builder (ios/AmiseMedFlow/Services/HistoryFrameData.swift is generated
 *          from this data: pnpm --filter @workspace/scripts run gen:history-frames). A chip stores
 *          its value in socratesSelections[key], which BayesianDiagnosisEngine reads.
 *
 * Deterministic data only. Nothing here changes an engine weight.
 */

export type SymptomType =
  | 'pain' | 'cough' | 'dyspnoea' | 'lump' | 'bleeding' | 'bowel' | 'dysphagia' | 'jaundice'
  | 'vomiting' | 'fever' | 'urinary' | 'breast' | 'neuro' | 'skin' | 'weight_loss' | 'fatigue'
  | 'palpitations' | 'syncope' | 'general';

/** Pain regions (the Site / Character / Radiation options depend on the region). */
export type PainRegion =
  | 'abdomen' | 'chest' | 'head' | 'neck' | 'back' | 'limb' | 'breast' | 'perineal' | 'joint' | 'genital';

export type Platform = 'ios' | 'web';

export interface FrameOption {
  /** Chip text (web stores it, with any parenthetical removed; iOS shows it). */
  label: string;
  /** iOS: the string stored in socratesSelections[key] (default: the label). */
  value?: string;
  /** iOS: the socratesSelections key for this chip (default: the dimension's key). */
  key?: string;
  /**
   * Platforms on which this chip feeds no diagnosis-engine feature: it is recorded in the history
   * (and the HPI text) only. lint:history-frames fails when a chip maps nowhere and is not marked,
   * and when a marked chip does map. Set from record-only.ts.
   */
  recordOnly?: Platform[];
  /**
   * Chips of the same question this one cannot coexist with ("*": all of them). Selecting it
   * clears them, and selecting one of them clears it. Set from EXCLUDES in frames.ts.
   */
  excludes?: string[];
}

export interface FrameDimension {
  /** Unique within the frame. Also the iOS socratesSelections key unless `key` is set. */
  id: string;
  title: string;
  question: string;
  /** SF Symbol for iOS. */
  icon: string;
  multiSelect: boolean;
  options: FrameOption[];
  /** iOS socratesSelections key (default: id). Several dimensions may share one key. */
  key?: string;
  /** Web answer key (default: webKeyFor(frame, dimension)). */
  webKey?: string;
}

export interface HistoryFrame {
  /** Unique id: the type, plus the region / variant ("pain.abdomen", "lump.hernia", "cough"). */
  id: string;
  type: SymptomType;
  /** Pain region or variant (lump site, bleeding site, neuro symptom, skin problem). */
  variant?: string;
  /** Short label for the frame switcher ("Pain — abdomen", "Cough"). */
  label: string;
  /** Section title: "SOCRATES" only for pain. */
  title: string;
  dimensions: FrameDimension[];
  /**
   * Dimensions shown when this symptom is not the primary one ("Also: cough"): the
   * associated-symptom chips for a secondary symptom.
   */
  secondaryDims: string[];
  /**
   * Stored values from earlier versions that are still read (old encounters, vignettes): legacy
   * value → current option label (empty: a retired value, shown as recorded). The stored value
   * itself is never rewritten (migration-free).
   */
  aliases?: { key: string; legacy: string; current: string }[];
  /** iOS DiagnosticDatabase pools whose features a chip in this frame must reach to count as mapped. */
  iosPools: string[];
  /** A complaint that selects this frame (used by the lint and the web mapping check). */
  sampleComplaint: string;
}

/** A classifier rule: complaint keywords → symptom type. */
export interface ClassifierRule {
  type: SymptomType;
  /**
   * 1: a lump or swelling (a "painful lump" is a lump); 2: every other symptom; 3: administrative
   * (follow-up, review, screening). The lowest tier present is primary, then the earliest mention,
   * then the rule order.
   */
  tier: 1 | 2 | 3;
  /** Lower-case keywords matched at a word start; a trailing * is a prefix, else a whole word. */
  keywords: string[];
  /** The rule does not apply when one of these is present (same keyword syntax). */
  unless?: string[];
}

/** Region / variant rules within a type: the earliest keyword wins; else the type's default. */
export interface VariantRule {
  variant: string;
  keywords: string[];
}

export interface FrameChoice {
  type: SymptomType;
  /** Pain region or variant; undefined for types without variants. */
  variant?: string;
  /** Frame id ("pain.abdomen", "cough"). */
  frameId: string;
  /** Frames of the other symptoms named in the complaint, earliest first. */
  secondary: string[];
  /** True when no rule matched (the default general frame). */
  fallback: boolean;
}
