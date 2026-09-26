/**
 * Exam-step sign chips and recorded decision rules → PANE evidence (evidence-exam 1.0.0).
 *
 * The chips live in the examination record under examFindings.signs (saved with the rest of the
 * examination, autosave and outbox included), one human-readable line per examined sign:
 *   "Murphy's sign: present"   /   "No Murphy's sign (examined)"
 * so the progress note, the AI context and every text reader see what was examined. Unrecorded
 * signs are not examined: nothing is ever pre-filled as normal.
 *
 * Decision rules count when the clinician records the calculator value ("Use in decision support",
 * encounters.clinical_scores.decisionScores). The engine side is lib/pane-engine/src/evidence.
 */
import {
  EXAM_SIGNS, applyRecordedEvidence, examSign,
} from '@workspace/pane-engine';
import type { ExamSign, RecordedEvidence, SignState } from '@workspace/pane-engine';

/** examFindings key that holds the sign chips (not an examination system). */
export const EXAM_SIGNS_KEY = 'signs';

function lowerFirstWord(name: string): string {
  const first = name.split(/\s+/)[0] ?? '';
  const properOrAcronym = /['’]s$/i.test(first) || (first.length > 1 && first[1] === first[1].toUpperCase() && /[A-Z]/.test(first[1]));
  return properOrAcronym ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

/** The record line of one examined sign. */
export function signChipText(sign: ExamSign, state: SignState): string {
  return state === 'present' ? `${sign.name}: present` : `No ${lowerFirstWord(sign.name)} (examined)`;
}

const TEXT_TO_SIGN: ReadonlyMap<string, { id: string; state: SignState }> = new Map<string, { id: string; state: SignState }>(
  EXAM_SIGNS.signs.flatMap((s): [string, { id: string; state: SignState }][] => ([
    [signChipText(s, 'present').toLowerCase(), { id: s.id, state: 'present' }],
    [signChipText(s, 'absent').toLowerCase(), { id: s.id, state: 'absent' }],
  ])),
);

/** Sign id → state, from the chip lines (unknown lines are ignored). */
export function parseSignChips(chips: readonly string[] | undefined): Record<string, SignState> {
  const out: Record<string, SignState> = {};
  for (const chip of chips ?? []) {
    const hit = TEXT_TO_SIGN.get(chip.trim().toLowerCase());
    if (hit) out[hit.id] = hit.state;
  }
  return out;
}

export function examSignStates(examFindings: Record<string, string[]> | undefined): Record<string, SignState> {
  return parseSignChips(examFindings?.[EXAM_SIGNS_KEY]);
}

/** examFindings with one sign set to present / absent, or cleared (null = not examined). */
export function withSignState(
  examFindings: Record<string, string[]>, signId: string, state: SignState | null,
): Record<string, string[]> {
  const sign = examSign(signId);
  if (!sign) return examFindings;
  const current = examFindings[EXAM_SIGNS_KEY] ?? [];
  const mine = new Set([signChipText(sign, 'present'), signChipText(sign, 'absent')].map(t => t.toLowerCase()));
  const kept = current.filter(c => !mine.has(c.trim().toLowerCase()));
  const next = state ? [...kept, signChipText(sign, state)] : kept;
  return { ...examFindings, [EXAM_SIGNS_KEY]: next };
}

/** Recorded decision-rule values (decisionScores) by record key. */
export function recordedRuleValues(clinicalScores: Record<string, unknown> | null | undefined): Record<string, number> {
  const raw = clinicalScores?.decisionScores;
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const value = v && typeof v === 'object' ? (v as { value?: unknown }).value : undefined;
    if (typeof value === 'number' && Number.isFinite(value)) out[k] = value;
  }
  return out;
}

export interface EvidenceSource {
  examFindings?: Record<string, string[]> | null;
  clinicalScores?: Record<string, unknown> | null;
  age?: number | null;
}

export function recordedEvidence(src: EvidenceSource): RecordedEvidence {
  return {
    signs: examSignStates(src.examFindings ?? undefined),
    ruleValues: recordedRuleValues(src.clinicalScores),
    ageYears: src.age ?? null,
  };
}

/** Whether anything is recorded (so callers can skip the work). */
export function hasRecordedEvidence(rec: RecordedEvidence): boolean {
  return Object.keys(rec.signs).length > 0 || Object.keys(rec.ruleValues).length > 0;
}

/** The PANE features with the recorded examination signs and decision rules applied. */
export function withExamEvidence(features: Record<string, boolean>, rec: RecordedEvidence | undefined): Record<string, boolean> {
  if (!rec || !hasRecordedEvidence(rec)) return features;
  return applyRecordedEvidence(features, rec);
}
