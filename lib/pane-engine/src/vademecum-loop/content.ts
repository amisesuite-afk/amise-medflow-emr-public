import findingsJson from '../../../../clinical-content/vademecum/findings.json';
import abdominalPainJson from '../../../../clinical-content/vademecum/abdominal-pain.json';
import coughBreathlessnessJson from '../../../../clinical-content/vademecum/cough-breathlessness.json';
import type { VademecumAreaFile, VademecumFindingsFile } from './types.js';

/**
 * The shared vademecum files (clinical-content/vademecum/*.json), read by iOS too
 * (VademecumContent.swift through SharedClinicalContent). lint:shared-content checks them against
 * their schemas and against the types in types.ts; lint:vademecum checks every reference.
 * Registered as `vademecum-findings`, `vademecum-abdominal-pain` and
 * `vademecum-cough-breathlessness` (clinical-content/registry.json). Phase 1: shadow only.
 */
export const VADEMECUM_FINDINGS = findingsJson as unknown as VademecumFindingsFile;
export const VADEMECUM_AREAS: readonly VademecumAreaFile[] = [
  abdominalPainJson as unknown as VademecumAreaFile,
  coughBreathlessnessJson as unknown as VademecumAreaFile,
];
export const VADEMECUM_VERSION = VADEMECUM_FINDINGS.version;
