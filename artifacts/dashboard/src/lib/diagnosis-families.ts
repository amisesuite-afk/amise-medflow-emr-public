/**
 * Diagnosis families and working-diagnosis label matching for the web diagnostic-reasoning adapter
 * (diagnostic-reasoning.ts), over the PANE registry. The rules are shared with iOS and live in
 * @workspace/triage-engine/diagnostic-reasoning (families.ts; vocabulary in
 * clinical-content/rules/diagnostic-reasoning-rules.json; iOS twin DiagnosticReasoningRules.swift).
 * A PANE DiseaseNode is a DiagnosisNode (id, label, icd10).
 */

import type { DiseaseNode } from '@workspace/pane-engine';
import { familyOf as sharedFamilyOf, sameFamily as sharedSameFamily } from '@workspace/triage-engine/diagnostic-reasoning';

export {
  FAMILY_COMPLICATION_MODIFIERS, labelFullyNamed, labelMatchScore, labelParts,
} from '@workspace/triage-engine/diagnostic-reasoning';

/** True when `a` and `b` are the same condition at different granularity. */
export function sameFamily(a: DiseaseNode, b: DiseaseNode): boolean {
  return sharedSameFamily(a, b);
}

/** Ids of the diseases in `diseases` that are one family with `node` (not including it). */
export function familyOf(node: DiseaseNode, diseases: DiseaseNode[]): Set<string> {
  return sharedFamilyOf(node, diseases);
}
