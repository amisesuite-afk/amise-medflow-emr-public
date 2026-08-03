// ─── pathology-codes.ts ───────────────────────────────────────────────────────
//
// THE MUSIC KEY.
//
// Every clinical fragment references this map to know:
//   • which coding system owns its domain
//   • which short prefix to stamp on display codes
//   • which colour family to use in the UI
//
// This is the shared coordinate system — the grid origin every hexagon cell
// is placed relative to. Add a new FactType here and the whole board knows
// where to put it.

import type { FactType } from '@workspace/patient-state';

export interface CodeSystem {
  system:      string;   // formal name of the coding standard
  oid:         string;   // HL7 OID for interoperability
  prefix:      string;   // short tag shown in the UI ("DX", "LAB", etc.)
  color:       string;   // CSS hex — fragment header background
  textColor:   string;   // CSS hex — fragment header text
  borderColor: string;   // CSS hex — fragment left-border stripe
  icon:        string;   // emoji icon shown on fragment header
  label:       string;   // human-readable domain name
}

export const PATHOLOGY_CODE_MAP: Record<FactType, CodeSystem> = {
  allergy: {
    system: 'SNOMED CT', oid: '2.16.840.1.113883.6.96', prefix: 'ALG',
    color: '#fee2e2', textColor: '#991b1b', borderColor: '#ef4444',
    icon: '⚠', label: 'Allergy / Adverse Reaction',
  },
  medication: {
    system: 'RxNorm', oid: '2.16.840.1.113883.6.88', prefix: 'MED',
    color: '#eff6ff', textColor: '#1e40af', borderColor: '#3b82f6',
    icon: '💊', label: 'Medication',
  },
  prescription: {
    system: 'RxNorm', oid: '2.16.840.1.113883.6.88', prefix: 'RX',
    color: '#f0fdf4', textColor: '#166534', borderColor: '#22c55e',
    icon: '📋', label: 'Prescription',
  },
  diagnosis: {
    system: 'ICD-10-CM', oid: '2.16.840.1.113883.6.90', prefix: 'DX',
    color: '#faf5ff', textColor: '#6b21a8', borderColor: '#a855f7',
    icon: '🔬', label: 'Diagnosis',
  },
  symptom: {
    system: 'SNOMED CT', oid: '2.16.840.1.113883.6.96', prefix: 'SX',
    color: '#fff7ed', textColor: '#9a3412', borderColor: '#f97316',
    icon: '🩺', label: 'Symptom',
  },
  vital: {
    system: 'LOINC', oid: '2.16.840.1.113883.6.1', prefix: 'VIT',
    color: '#f0fdf4', textColor: '#065f46', borderColor: '#10b981',
    icon: '💓', label: 'Vital Sign',
  },
  anthropometric: {
    system: 'LOINC', oid: '2.16.840.1.113883.6.1', prefix: 'ANT',
    color: '#f0fdfa', textColor: '#134e4a', borderColor: '#14b8a6',
    icon: '📏', label: 'Anthropometric',
  },
  lab_result: {
    system: 'LOINC', oid: '2.16.840.1.113883.6.1', prefix: 'LAB',
    color: '#fffbeb', textColor: '#78350f', borderColor: '#f59e0b',
    icon: '🧪', label: 'Laboratory Result',
  },
  pathology_result: {
    system: 'SNOMED CT', oid: '2.16.840.1.113883.6.96', prefix: 'PATH',
    color: '#fdf2f8', textColor: '#831843', borderColor: '#ec4899',
    icon: '🔭', label: 'Histopathology Result',
  },
  imaging_result: {
    system: 'RadLex / DICOM', oid: '2.16.840.1.113883.6.256', prefix: 'IMG',
    color: '#f1f5f9', textColor: '#334155', borderColor: '#64748b',
    icon: '🩻', label: 'Imaging Result',
  },
  procedure: {
    system: 'CPT / ICD-9-PCS', oid: '2.16.840.1.113883.6.12', prefix: 'PRO',
    color: '#fefce8', textColor: '#854d0e', borderColor: '#eab308',
    icon: '✂', label: 'Procedure',
  },
  investigation_order: {
    system: 'LOINC', oid: '2.16.840.1.113883.6.1', prefix: 'ORD',
    color: '#f8fafc', textColor: '#475569', borderColor: '#94a3b8',
    icon: '📤', label: 'Investigation Order',
  },
  clinical_note: {
    system: 'LOINC', oid: '2.16.840.1.113883.6.1', prefix: 'NOTE',
    color: '#fafafa', textColor: '#374151', borderColor: '#9ca3af',
    icon: '📝', label: 'Clinical Note',
  },
  follow_up: {
    system: 'SNOMED CT', oid: '2.16.840.1.113883.6.96', prefix: 'FU',
    color: '#ecfdf5', textColor: '#065f46', borderColor: '#34d399',
    icon: '📅', label: 'Follow-up',
  },
  task: {
    system: 'Internal', oid: '', prefix: 'TSK',
    color: '#f5f3ff', textColor: '#5b21b6', borderColor: '#8b5cf6',
    icon: '☑', label: 'Task',
  },
  consent: {
    system: 'SNOMED CT', oid: '2.16.840.1.113883.6.96', prefix: 'CNS',
    color: '#fff1f2', textColor: '#9f1239', borderColor: '#f43f5e',
    icon: '✍', label: 'Consent',
  },
  family_history: {
    system: 'SNOMED CT', oid: '2.16.840.1.113883.6.96', prefix: 'FHX',
    color: '#f0f9ff', textColor: '#0c4a6e', borderColor: '#0ea5e9',
    icon: '👨‍👩‍👧', label: 'Family History',
  },
  social_history: {
    system: 'SNOMED CT', oid: '2.16.840.1.113883.6.96', prefix: 'SHX',
    color: '#fdf4ff', textColor: '#701a75', borderColor: '#d946ef',
    icon: '🏠', label: 'Social History',
  },
};

export function getCodeSystem(factType: FactType): CodeSystem {
  return PATHOLOGY_CODE_MAP[factType];
}

// Format a coded identifier the way it would appear in a clinical document
// e.g. "ICD-10: K35.2" or "LOINC: 8867-4"
export function formatCode(system: string, code: string | null): string | null {
  if (!code) return null;
  return `${system}: ${code}`;
}

// Severity order used to sort mixed fragment lists
export const SEVERITY_ORDER: Record<string, number> = {
  allergy:      0,
  prescription: 1,
  diagnosis:    2,
  vital:        3,
  lab_result:   4,
  imaging_result: 5,
  pathology_result: 6,
  investigation_order: 7,
  medication:   8,
  procedure:    9,
  follow_up:    10,
  task:         11,
  symptom:      12,
  consent:      13,
  clinical_note: 14,
  anthropometric: 15,
  family_history: 16,
  social_history: 17,
};
