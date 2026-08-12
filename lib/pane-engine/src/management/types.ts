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
}

export interface ManagementStep {
  phase: 'immediate' | 'conservative' | 'surgical' | 'followup';
  step: string;
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
}

export interface ManagementProtocol {
  diseaseId: string;
  /** ICD-10 prefix(es) for lookup via ICD picker (startsWith match). */
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
}
