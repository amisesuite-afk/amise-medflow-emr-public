export type InvCategory =
  | 'bloods'
  | 'bedside'
  | 'imaging-uss'
  | 'imaging-xr'
  | 'imaging-ct'
  | 'imaging-mri'
  | 'endoscopy'
  | 'microbiology'
  | 'other';

/**
 * A condition under which a step or medication applies to this patient. Protocol content that is
 * only right for some patients (a pregnancy branch, a penicillin-allergy alternative, an adult-only
 * template) carries one of these; `adaptProtocolForPatient()` (planSafety.ts) shows it only when the
 * condition holds. Consumers that show the raw protocol (dictionary, reference views) show every
 * branch, each labelled in its own text.
 */
export type PatientCondition =
  | 'pregnant'
  | 'not-pregnant'
  | 'penicillin-allergy'
  | 'no-penicillin-allergy'
  | 'under-16'
  | 'adult';

export interface InvestigationItem {
  label: string;
  urgency: 'stat' | 'urgent' | 'routine';
  rationale?: string;
  /** Tier 1 = bloods / bedside; Tier 2 = USS / plain XR; Tier 3 = CT / MRI / endoscopy */
  tier?: 1 | 2 | 3;
  category?: InvCategory;
  /** Approximate Bayesian positive likelihood ratio for primary diagnostic question */
  lrPos?: number;
  /** Clinical condition under which this investigation should be ordered */
  conditional?: string;
  /** Only for patients meeting this condition (see PatientCondition). */
  onlyIf?: PatientCondition;
}

export interface ManagementStep {
  phase: 'immediate' | 'conservative' | 'surgical' | 'followup';
  step: string;
  /** Only for patients meeting this condition (see PatientCondition). */
  onlyIf?: PatientCondition;
}

export interface ProtocolMedication {
  drugName: string;
  dose: string;
  frequency: string;
  route: string;
  duration?: string;
  indication: string;
  phase: 'immediate' | 'conservative' | 'surgical' | 'followup' | 'prophylaxis' | 'maintenance' | 'discharge';
  /** When multiple drug options exist for the same indication (e.g. first-line vs alternative) */
  alternativeTo?: string;
  /** Only for patients meeting this condition (see PatientCondition). */
  onlyIf?: PatientCondition;
}

/**
 * What kind of care a protocol describes. Drives the patient-safety adaptation in planSafety.ts:
 * operative plans get a VTE prophylaxis line and peri-procedural medicine advice; emergency
 * protocols get the outpatient-clinic transfer wording; bleeding protocols get anticoagulant
 * reversal advice instead of elective interruption/bridging.
 */
export type ProtocolKind =
  | 'surgical'          // default — operative / procedural surgical condition
  | 'procedure'         // planned procedure (pre-operative assessment, polypectomy / endoscopy)
  | 'medical'           // non-operative medical condition managed in clinic
  | 'emergency'         // medical / obstetric / paediatric emergency: recognise, first actions, redirect
  | 'bleeding';         // active haemorrhage (GI bleed, haemorrhage after trauma, head injury on anticoagulants)

export interface ManagementProtocol {
  diseaseId: string;
  /** ICD-10 prefix(es) for lookup via ICD picker (prefix match, dots ignored, longest prefix wins). */
  icd10Prefixes: string[];
  /** Disease display label shown in the ManagementPanel header. */
  label: string;
  /** 2–3 clinically memorable pearls. */
  keyPoints: string[];
  /** Triggers for urgent escalation. */
  redFlags: string[];
  investigations: InvestigationItem[];
  management: ManagementStep[];
  medications?: ProtocolMedication[];
  referral?: string;
  /** See ProtocolKind. Unset = 'surgical'. */
  kind?: ProtocolKind;
  /**
   * Doses in this protocol are already age-banded or weight-based by the cited guideline (for
   * example the Resuscitation Council UK anaphylaxis doses), so the under-16 filter must not
   * replace them.
   */
  paediatricDosing?: boolean;
  /** Pregnancy is the condition itself (ectopic, pre-eclampsia): skip the pregnancy drug filter. */
  pregnancySpecific?: boolean;
  /** Cancer operation — NICE NG89 extended (28-day) VTE prophylaxis applies. */
  cancer?: boolean;
  /**
   * Allergy alternatives, by allergy class id (planSafety.ts ALLERGY_CLASSES), shown when a step
   * or medication is withheld because of a recorded allergy.
   */
  allergyAlternatives?: Partial<Record<string, string>>;
  /** Named guidelines this protocol's content follows (name + year). */
  guidelines?: string[];
}
