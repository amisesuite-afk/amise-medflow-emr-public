import { decisionRule, examSign } from '../evidence/catalogue.js';
import { evaluate, questionGain, questionsAt } from './loop.js';
import type { Evaluation, LoopInput } from './loop.js';
import { findingLabel } from './model.js';
import type { Vademecum } from './model.js';
import type { FindingDimension } from './types.js';

/**
 * Generators: what the consultation asks, offers and suggests next, derived from the vademecum for
 * the current candidates. Every chip is a vademecum finding, so it maps to the engine by
 * construction (no hand-written chip → feature mapping). Phase 1: shadow only; the production UI
 * still uses the history frames, the Exam-step sign list and the protocol investigations.
 */

export interface GeneratedChip {
  finding: string;
  chip: string;
  informationGain: number;
}

export interface GeneratedQuestion {
  dimension: FindingDimension;
  question: string;
  order: number;
  chips: GeneratedChip[];
}

export interface GeneratedSign {
  finding: string;
  /** clinical-content/rules/exam-signs.json id, when the finding references one. */
  examSign: string | null;
  label: string;
  informationGain: number;
}

export interface GeneratedInvestigation {
  /** A finding id, or a decision rule id (kind 'rule'). */
  id: string;
  kind: 'finding' | 'rule';
  label: string;
  informationGain: number;
  /** A confirmatory (pathognomonic) finding of a current candidate. */
  confirmatory: boolean;
}

/** A chip whose answer would change nothing (expected gain below this, in nats) is not offered. */
export const MIN_CHIP_GAIN = 1e-4;

function live(ev: Evaluation): string[] {
  return ev.ranked.map(r => r.id);
}

/** (i) History questions and chips for the current candidates, grouped by dimension (SOCRATES order). */
export function generateHistoryQuestions(v: Vademecum, candidates: readonly string[], input: LoopInput, maxChips = 12): GeneratedQuestion[] {
  const ev = evaluate(v, candidates, input);
  const ids = live(ev);
  const byDim = new Map<FindingDimension, GeneratedChip[]>();
  for (const q of questionsAt(v, ids, 'history', ev.answers, new Set())) {
    if (q.kind !== 'finding') continue;
    const f = v.findings.get(q.id)!;
    const { gain } = questionGain(v, ids, input, q);
    if (gain < MIN_CHIP_GAIN) continue;
    const list = byDim.get(f.dimension) ?? [];
    list.push({ finding: f.id, chip: f.chip ?? f.label ?? f.id, informationGain: gain });
    byDim.set(f.dimension, list);
  }
  return [...byDim.entries()]
    .map(([dimension, chips]) => ({
      dimension,
      question: v.dimensions[dimension]?.question ?? dimension,
      order: v.dimensions[dimension]?.order ?? 99,
      chips: chips.sort((a, b) => b.informationGain - a.informationGain || a.chip.localeCompare(b.chip)).slice(0, maxChips),
    }))
    .sort((a, b) => a.order - b.order);
}

/** (ii) Examination signs to offer, most discriminating first. */
export function generateExamSigns(v: Vademecum, candidates: readonly string[], input: LoopInput, max = 10): GeneratedSign[] {
  const ev = evaluate(v, candidates, input);
  const ids = live(ev);
  return questionsAt(v, ids, 'exam', ev.answers, new Set())
    .filter(q => q.kind === 'finding')
    .map(q => {
      const f = v.findings.get(q.id)!;
      return {
        finding: f.id, examSign: f.examSign ?? null,
        label: f.examSign ? (examSign(f.examSign)?.name ?? findingLabel(v, f.id)) : findingLabel(v, f.id),
        informationGain: questionGain(v, ids, input, q).gain,
      };
    })
    .sort((a, b) => b.informationGain - a.informationGain || a.label.localeCompare(b.label))
    .slice(0, max);
}

/** (iii) Investigations (and scores) to suggest, most discriminating first. Nothing is ordered. */
export function generateInvestigations(v: Vademecum, candidates: readonly string[], input: LoopInput, max = 10): GeneratedInvestigation[] {
  const ev = evaluate(v, candidates, input);
  const ids = live(ev);
  const confirmatory = new Set(ids.flatMap(id => v.diseases.get(id)!.disease.pathognomonic.map(p => p.finding)));
  const items = [...questionsAt(v, ids, 'score', ev.answers, new Set()), ...questionsAt(v, ids, 'investigation', ev.answers, new Set())];
  return items
    .map(q => ({
      id: q.id, kind: q.kind,
      label: q.kind === 'rule' ? (decisionRule(q.id)?.name ?? q.id) : findingLabel(v, q.id),
      informationGain: questionGain(v, ids, input, q).gain,
      confirmatory: q.kind === 'finding' && confirmatory.has(q.id),
    }))
    .sort((a, b) => b.informationGain - a.informationGain || a.label.localeCompare(b.label))
    .slice(0, max);
}
