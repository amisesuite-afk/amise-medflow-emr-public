export interface InvestigationItem {
  label: string;
  urgency: 'stat' | 'urgent' | 'routine';
  rationale?: string;
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
  phase: 'immediate' | 'conservative' | 'surgical' | 'followup' | 'prophylaxis';
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
