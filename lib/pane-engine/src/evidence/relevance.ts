import { DECISION_RULES, EXAM_SIGNS, targetGroup } from './catalogue.js';
import { signApplies } from './features.js';
import type { DecisionRule, ExamFrame, ExamSign, ExamSystemKey } from './types.js';

/**
 * Which signs and rules the Exam step offers: those of the complaint's presentations and those
 * whose target is in the current differential. The presentations come from the complaint's history
 * frames (the history step's classifier, @workspace/triage-engine/history-frames: the caller passes
 * the frame ids) through exam-signs.json "frames", plus the presentations whose keywords name a
 * site, mechanism or condition the frame does not distinguish (right upper quadrant, an ankle
 * injury). Pure; ranking by information gain is done by the caller when a posterior exists.
 */
export interface RelevanceContext {
  /** Complaint, history and symptom chips as one text. */
  text: string;
  /** History frame ids of the complaint(s), primary first ("cough", "pain.abdomen", "lump.hernia"). */
  frames?: string[];
  ageYears?: number | null;
  /** PANE disease ids of the current differential, most likely first. */
  differential?: string[];
}

function wordStart(text: string, keyword: string): boolean {
  const k = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${k}`).test(text);
}

/** The Exam step for a history frame id: the frame's own entry, else its symptom type's, else "general". */
export function examFrame(frameId: string): ExamFrame {
  const f = EXAM_SIGNS.frames;
  return f[frameId] ?? f[frameId.split('.')[0] ?? ''] ?? f.general ?? { region: 'general', systems: [], presentations: [] };
}

/** Web examination systems to show for the complaint's history frames. */
export function examSystemsFor(frameIds: string[]): Set<ExamSystemKey> {
  return new Set(frameIds.flatMap(id => examFrame(id).systems));
}

/** Presentation tags of the history frames plus those whose keywords occur (at a word start) in `text`. */
export function presentationsFor(ctx: Pick<RelevanceContext, 'text' | 'frames'>): Set<string> {
  const out = presentationsIn(ctx.text);
  for (const id of ctx.frames ?? []) for (const t of examFrame(id).presentations) out.add(t);
  return out;
}

/** Presentation tags whose keywords occur (at a word start) in `text`. */
export function presentationsIn(text: string): Set<string> {
  const lower = text.toLowerCase();
  const out = new Set<string>();
  for (const [tag, p] of Object.entries(EXAM_SIGNS.presentations)) {
    if (p.keywords.some(k => wordStart(lower, k))) out.add(tag);
  }
  return out;
}

/**
 * Diagnostic value used for ordering when no posterior is available: the larger of |ln LR+| and,
 * when absence is meaningful, |ln LR-|. Low-value and documentation-only signs score 0.
 */
export function signDiagnosticValue(sign: ExamSign): number {
  if (sign.engine === 'none' || !sign.lrPositive) return 0;
  const pos = Math.abs(Math.log(sign.lrPositive.point));
  const neg = sign.negativeMeaningful && sign.lrNegative ? Math.abs(Math.log(sign.lrNegative.point)) : 0;
  return Math.max(pos, neg);
}

export interface RelevantSign {
  sign: ExamSign;
  /** Why it is offered ("Right upper quadrant pain", "Acute Cholecystitis in the differential"). */
  reasons: string[];
  /** 1 when a target is in the differential's top 3 (offered first). */
  inDifferential: boolean;
  value: number;
}

export function relevantSigns(ctx: RelevanceContext): RelevantSign[] {
  const tags = presentationsFor(ctx);
  const top = new Set((ctx.differential ?? []).slice(0, 3));
  const out: RelevantSign[] = [];
  for (const sign of EXAM_SIGNS.signs) {
    if (!signApplies(sign, ctx.ageYears)) continue;
    const reasons = sign.presentations.filter(t => tags.has(t)).map(t => EXAM_SIGNS.presentations[t]?.label ?? t);
    const groups = [sign.target.group, ...(sign.alsoTargets ?? []).map(t => t.group)];
    const inDiff = groups.some(g => (targetGroup(g)?.pane ?? []).some(id => top.has(id)));
    if (inDiff) reasons.push(`${targetGroup(sign.target.group)?.label ?? sign.target.group} in the differential`);
    if (!reasons.length) continue;
    out.push({ sign, reasons, inDifferential: inDiff, value: signDiagnosticValue(sign) });
  }
  return out.sort((a, b) => Number(b.inDifferential) - Number(a.inDifferential) || b.value - a.value);
}

export interface RelevantRule {
  rule: DecisionRule;
  reasons: string[];
}

export function relevantRules(ctx: RelevanceContext): RelevantRule[] {
  const tags = presentationsFor(ctx);
  const top = new Set((ctx.differential ?? []).slice(0, 3));
  const out: RelevantRule[] = [];
  for (const rule of DECISION_RULES.rules) {
    const reasons = rule.presentations.filter(t => tags.has(t)).map(t => EXAM_SIGNS.presentations[t]?.label ?? t);
    if (rule.target.pane.some(id => top.has(id))) reasons.push(`${rule.target.finding} in the differential`);
    if (reasons.length) out.push({ rule, reasons });
  }
  // Diagnostic rules first (they change the differential), then prognostic ones.
  return out.sort((a, b) => Number(a.rule.kind !== 'diagnostic') - Number(b.rule.kind !== 'diagnostic'));
}
