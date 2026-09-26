/**
 * Premature-closure rules the platform adapters share (web PANE adapter, iOS Bayesian adapter):
 * the core's alerts (core.ts prematureClosureAlerts) filtered by
 *  - DIAGNOSIS FAMILIES: a diagnosis of the working diagnosis's family (families.ts) is compatible,
 *    never the leader of "the record favours X", and a finding that favours one of them does not
 *    alert;
 *  - CONTRADICTION THRESHOLD: a single contradicting finding alerts only at LR ≤
 *    `closure.contradictionMaxLr` (0.2: moderate or strong evidence against; Jaeschke, Guyatt &
 *    Sackett, JAMA 1994); the core itself flags LR ≤ 0.33;
 *  - ALREADY NAMED: no "the record favours X" when the working-diagnosis text names X;
 *  - TWO CONDITIONS: no "the record favours X" when X shares no evidence with a working diagnosis
 *    that has support of its own (competesForEvidence).
 * The NEWS2 alert is unchanged. Rules and thresholds: clinical-content/rules/diagnostic-reasoning-rules.json.
 * iOS twin: DiagnosticReasoningRules.swift (`DiagnosticReasoning.adapterClosureAlerts`), shared
 * vectors DiagnosticReasoningVectors.json (`adapterClosure`, `competes`).
 */

import { prematureClosureAlerts, REASONING_THRESHOLDS } from './core';
import type { ClosureAlert, ReasoningInput } from './core';
import { labelFullyNamed } from './families';
import { REASONING_RULES } from './reasoning-rules';

/** Contradicting-finding alerts only at LR ≤ this (diagnostic-reasoning-rules `closure.contradictionMaxLr`). */
export const CONTRADICTION_MAX_LR: number = REASONING_RULES.closure.contradictionMaxLr;

/**
 * Maps a finding id to its evidence group: two findings in one group are the same evidence. The
 * default is the finding itself. iOS puts every "presenting complaint" feature in one group, since
 * each database candidate words the complaint its own way.
 */
export type EvidenceGroup = (findingId: string) => string;

const byId: EvidenceGroup = id => id;

/**
 * True when the leader and the working diagnosis compete for the same evidence: the working
 * diagnosis has no support of its own (no present finding with LR ≥ favourLr), or a present
 * finding (of one evidence group) supports both (LR ≥ supportLr in each). When they share nothing,
 * the record shows a second condition beside a supported working diagnosis ("reducible inguinal
 * hernia" in new atrial fibrillation, an incidental ureteric stone beside an adrenal
 * incidentaloma): no "the record favours X" alert; X stays in the differential and "doesn't fit".
 */
export function competesForEvidence(input: ReasoningInput, leaderId: string, workingId: string, group: EvidenceGroup = byId): boolean {
  const T = REASONING_THRESHOLDS;
  const present = input.findings.filter(f => f.status === 'present');
  const lr = (h: string, f: string) => input.weights[h]?.[f]?.lrPresent ?? 1;
  if (!present.some(f => lr(workingId, f.id) >= T.favourLr)) return true;
  const workingGroups = new Set(present.filter(f => lr(workingId, f.id) >= T.supportLr).map(f => group(f.id)));
  return present.some(f => lr(leaderId, f.id) >= T.supportLr && workingGroups.has(group(f.id)));
}

/**
 * True when the working-diagnosis text already names `label` (one of its alternatives, every
 * word found): "Blunt abdominal trauma in pregnancy — suspected placental abruption" names
 * "Placental Abruption".
 */
export function namedInDiagnosis(label: string, workingText: string): boolean {
  return labelFullyNamed(label, workingText);
}

/** A syndrome or state that accompanies other diagnoses, by name (iOS: no PANE ids). */
export function isCoexistingName(name: string): boolean {
  const n = name.toLowerCase();
  return REASONING_RULES.coexisting.nameTerms.some(t => n.includes(t));
}

export interface AdapterClosureOptions {
  /** The working diagnosis's hypothesis id in `input`, or null when the engine does not model it. */
  workingId: string | null;
  /** The clinician's working-diagnosis text. */
  workingText: string;
  /** Hypothesis ids of the working diagnosis's family (families.ts); never the leader. */
  familyIds: ReadonlySet<string>;
  /** Chronological NEWS2 totals (oldest first). */
  news2Series: number[];
  /** Evidence groups for the two-conditions rule (default: each finding is its own). */
  evidenceGroup?: EvidenceGroup;
}

/** "Doesn't fit the working diagnosis" alerts with the shared adapter rules (see the header). */
export function adapterClosureAlerts(input: ReasoningInput, opts: AdapterClosureOptions): ClosureAlert[] {
  const T = REASONING_THRESHOLDS;
  const { workingId, workingText, familyIds } = opts;
  const familyLabels = new Set(input.hypotheses.filter(h => familyIds.has(h.id)).map(h => h.label));
  const closureInput: ReasoningInput = {
    ...input,
    hypotheses: input.hypotheses.map(h => (familyIds.has(h.id) ? { ...h, coexists: true } : h)),
  };
  const working = workingId ? input.hypotheses.find(h => h.id === workingId) ?? null : null;
  const label = working?.label ?? workingText;
  // Only moderate or strong contradicting evidence alerts (LR <= CONTRADICTION_MAX_LR).
  const findingAlerts = prematureClosureAlerts(closureInput, workingId, label, []).filter(a => {
    if (a.kind === 'contradicting-finding') {
      return a.lr !== null && a.lr <= CONTRADICTION_MAX_LR && !(a.favours && familyLabels.has(a.favours));
    }
    if (a.kind === 'less-likely' && workingId) {
      const leaderId = a.key.slice('less-likely:'.length);
      const leader = input.hypotheses.find(h => h.id === leaderId);
      // The clinician already named it ("… — suspected placental abruption"): not premature closure.
      if (leader && namedInDiagnosis(leader.label, workingText)) return false;
      return competesForEvidence(input, leaderId, workingId, opts.evidenceGroup);
    }
    return true;
  });
  const news2Alerts = prematureClosureAlerts(input, workingId, label, opts.news2Series).filter(a => a.kind === 'news2-rising');
  return [...findingAlerts, ...news2Alerts].slice(0, T.maxClosureAlerts);
}
