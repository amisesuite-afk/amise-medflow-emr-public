import { decisionRule, engineBands, examSign, targetGroup } from '../evidence/catalogue.js';
import { DECISION_CONTENT, thresholds as decisionThresholds } from '../decision/index.js';
import type { DecisionDef } from '../decision/index.js';
import { VADEMECUM_AREAS, VADEMECUM_FINDINGS } from './content.js';
import type {
  CriteriaNode, VademecumAreaFile, VademecumDisease, VademecumFinding, VademecumFindingsFile, VademecumLevel,
  VademecumLink, VademecumPolicy, VThresholds,
} from './types.js';

/**
 * The vademecum as the loop uses it: indexes over the shared files, each disease's finding links
 * with their likelihood ratios resolved (a link that references an examination sign or a decision
 * rule takes its ratios from clinical-content/rules, never a copy), the reverse index (finding →
 * diseases, for any entry point), and the test / treat thresholds of each disease.
 */

export interface PatientInfo {
  /** Years; null when unknown (never excludes). */
  age: number | null;
  sex: 'male' | 'female' | 'unknown';
  /** The clinician marked pregnancy as possible (pregnancy-only diseases get the policy multiplier). */
  pregnancyPossible?: boolean;
}

/** A link with its likelihood ratios resolved. */
export interface ResolvedLink {
  finding: string;
  level: VademecumLevel;
  /** Applied when the finding is present (1 = neutral). */
  lrPositive: number | null;
  /** Applied when the finding is documented absent and the absence is meaningful. */
  lrNegative: number | null;
  negativeMeaningful: boolean;
  group?: string;
  seed: VademecumLink['seed'];
}

export interface LoadedDisease {
  disease: VademecumDisease;
  area: string;
  links: Map<string, ResolvedLink>;
  /** Findings of this disease's criteria, pathognomonic entries, exclusions and incidental triggers. */
  mentions: Set<string>;
  thresholds: VThresholds;
  thresholdSource: string;
}

export interface Vademecum {
  findings: Map<string, VademecumFinding>;
  diseases: Map<string, LoadedDisease>;
  areas: readonly VademecumAreaFile[];
  policy: VademecumPolicy;
  dimensions: VademecumFindingsFile['dimensions'];
  /** finding → the diseases whose profile names it (links, criteria, pathognomonic, triggers). */
  reverse: Map<string, string[]>;
  /** rule id → its band finding ids. */
  ruleBands: Map<string, string[]>;
  /** Correlation groups that hold an examination-sign finding (their free-text twins are not asked). */
  signGroups: Set<string>;
  version: string;
}

const LEVELS: VademecumLevel[] = ['history', 'exam', 'score', 'investigation'];

/** The resolved ratios of an examination-sign reference for a disease, or null when the sign does not apply to it. */
function examSignRatios(signId: string, disease: VademecumDisease): { pos: number; neg: number | null } | null {
  const sign = examSign(signId);
  if (!sign || sign.engine !== 'lr' || !sign.lrPositive || !sign.lrNegative || !disease.pane) return null;
  if ((targetGroup(sign.target.group)?.pane ?? []).includes(disease.pane)) {
    return { pos: sign.lrPositive.point, neg: sign.negativeMeaningful ? sign.lrNegative.point : null };
  }
  for (const extra of sign.alsoTargets ?? []) {
    if ((targetGroup(extra.group)?.pane ?? []).includes(disease.pane)) return { pos: extra.lrPositive.point, neg: null };
  }
  return null;
}

/** The likelihood ratio of a decision-rule band for a disease (a target of a diagnostic rule), or null. */
function ruleBandRatio(ruleId: string, bandId: string, disease: VademecumDisease): number | null {
  const rule = decisionRule(ruleId);
  if (!rule || !disease.pane || !rule.target.pane.includes(disease.pane)) return null;
  const band = engineBands(rule).find(b => b.id === bandId);
  return band?.lr ? band.lr.point : null;
}

export function resolveLink(link: VademecumLink, finding: VademecumFinding, disease: VademecumDisease): ResolvedLink {
  let pos = link.lrPositive?.point ?? null;
  let neg = link.lrNegative?.point ?? null;
  if (link.seed === 'exam-signs' && finding.examSign) {
    const r = examSignRatios(finding.examSign, disease);
    pos = r?.pos ?? null;
    neg = r?.neg ?? null;
  } else if (link.seed === 'decision-rules' && finding.decisionRule) {
    pos = ruleBandRatio(finding.decisionRule.rule, finding.decisionRule.band, disease);
    neg = null;
  }
  return {
    finding: link.finding, level: finding.level, lrPositive: pos, lrNegative: neg,
    negativeMeaningful: link.negativeMeaningful && neg !== null, group: finding.group, seed: link.seed,
  };
}

/** Findings a criteria tree names. */
export function criteriaFindings(node: CriteriaNode, out: Set<string> = new Set()): Set<string> {
  if (node.finding) out.add(node.finding);
  for (const c of node.items ?? []) criteriaFindings(c, out);
  for (const c of node.fallback ?? []) criteriaFindings(c, out);
  return out;
}

/**
 * The decision-layer definition named by the disease (treatment-decisions.json `decision`), if
 * any. Only an explicit link: some decisions are about a later step (cholecystectomy timing after
 * gallstone pancreatitis, emergency laparotomy) and their thresholds are not diagnostic stops.
 */
export function decisionFor(disease: VademecumDisease): DecisionDef | undefined {
  return disease.decision ? DECISION_CONTENT.decisions.find(d => d.id === disease.decision) : undefined;
}

/**
 * Test / treat thresholds (Pauker–Kassirer) from the decision layer: the option with the largest
 * expected net value and the decision's test; else the policy defaults (lower test threshold for
 * a can't-miss disease).
 */
export function diseaseThresholds(disease: VademecumDisease, policy: VademecumPolicy): { t: VThresholds; source: string } {
  const def = decisionFor(disease);
  if (def && def.type === 'diagnosis' && def.options.length) {
    const best = [...def.options].sort((a, b) => (b.benefit[1] - b.harm[1]) - (a.benefit[1] - a.harm[1]))[0]!;
    const t = decisionThresholds(best.benefit[1], best.harm[1], def.test ?? null);
    if (best.benefit[1] > 0 && t.treat < 1) {
      const fallback = disease.cantMiss ? policy.cantMissThresholds : policy.defaultThresholds;
      return { t: { test: t.test ?? Math.min(fallback.test, t.treat / 2), treat: t.treat }, source: `decision layer: ${def.id} / ${best.id}` };
    }
  }
  return disease.cantMiss
    ? { t: policy.cantMissThresholds, source: 'policy: can\'t-miss default' }
    : { t: policy.defaultThresholds, source: 'policy: default' };
}

export function loadVademecum(
  dictionary: VademecumFindingsFile = VADEMECUM_FINDINGS,
  areas: readonly VademecumAreaFile[] = VADEMECUM_AREAS,
): Vademecum {
  const findings = new Map(dictionary.findings.map(f => [f.id, f]));
  const diseases = new Map<string, LoadedDisease>();
  const reverse = new Map<string, string[]>();
  const ruleBands = new Map<string, string[]>();
  for (const f of dictionary.findings) {
    if (!f.decisionRule) continue;
    const list = ruleBands.get(f.decisionRule.rule) ?? [];
    list.push(f.id);
    ruleBands.set(f.decisionRule.rule, list);
  }
  for (const area of areas) {
    for (const disease of area.diseases) {
      const links = new Map<string, ResolvedLink>();
      for (const level of LEVELS) {
        for (const link of disease.findings[level]) {
          const finding = findings.get(link.finding);
          if (!finding) continue;
          links.set(link.finding, resolveLink(link, finding, disease));
        }
      }
      const mentions = new Set<string>();
      for (const c of disease.criteria) for (const l of c.levels) criteriaFindings(l.when, mentions);
      for (const p of disease.pathognomonic) { mentions.add(p.finding); for (const r of p.requires ?? []) mentions.add(r); }
      for (const e of disease.exclusions) if (e.finding) mentions.add(e.finding);
      for (const t of disease.workupWhenIncidental?.trigger ?? []) mentions.add(t);
      const th = diseaseThresholds(disease, dictionary.policy);
      diseases.set(disease.id, { disease, area: area.area, links, mentions, thresholds: th.t, thresholdSource: th.source });
      for (const id of new Set([...links.keys(), ...mentions])) {
        const list = reverse.get(id) ?? [];
        list.push(disease.id);
        reverse.set(id, list);
      }
    }
  }
  const signGroups = new Set(dictionary.findings.filter(f => f.examSign && f.group).map(f => f.group!));
  return {
    findings, diseases, areas, policy: dictionary.policy, dimensions: dictionary.dimensions, reverse, ruleBands, signGroups,
    version: dictionary.version,
  };
}

let cached: Vademecum | null = null;
/** The bundled vademecum (loaded once). */
export function bundledVademecum(): Vademecum {
  cached ??= loadVademecum();
  return cached;
}

// ── Patient and applicability ────────────────────────────────────────────────────────────────

/** false when the patient is outside the disease's applicability (unknown age / sex never excludes). */
export function applies(disease: VademecumDisease, p: PatientInfo): boolean {
  const app = disease.applicability;
  if (!app) return true;
  if (app.sex && p.sex !== 'unknown' && p.sex !== app.sex) return false;
  if (p.age !== null) {
    if (app.ageMin !== undefined && p.age < app.ageMin) return false;
    if (app.ageMax !== undefined && p.age > app.ageMax) return false;
  }
  if (app.pregnancy === 'required') {
    if (p.sex === 'male') return false;
    if (p.age !== null && (p.age < 10 || p.age > 55)) return false;
  }
  return true;
}

/** Demographic findings answered from the patient (never asked). */
export function demographicAnswers(v: Vademecum, p: PatientInfo): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const f of v.findings.values()) {
    const d = f.demographic;
    if (!d) continue;
    const needsAge = d.ageMin !== undefined || d.ageMax !== undefined;
    if (needsAge && p.age === null) continue;
    if (d.sex && p.sex === 'unknown') continue;
    let ok = true;
    if (d.ageMin !== undefined && p.age! < d.ageMin) ok = false;
    if (d.ageMax !== undefined && p.age! > d.ageMax) ok = false;
    if (d.sex && p.sex !== d.sex) ok = false;
    out[f.id] = ok;
  }
  return out;
}

// ── Criteria logic (three-valued: true, false, unknown) ────────────────────────────────────────

export type Tri = boolean | null;

export interface CriteriaContext {
  answers: Record<string, boolean>;
  patient: PatientInfo;
  /** Results of external evaluators (existing deterministic implementations), by evaluator id. */
  externals: Record<string, boolean>;
  ruleBands: Map<string, string[]>;
  findings: Map<string, VademecumFinding>;
}

export function evalCriteria(node: CriteriaNode, ctx: CriteriaContext): Tri {
  switch (node.op) {
    case 'finding': {
      const a = node.finding ? ctx.answers[node.finding] : undefined;
      if (a === undefined) return null;
      return node.state === 'absent' ? !a : a;
    }
    case 'all': {
      const r = (node.items ?? []).map(n => evalCriteria(n, ctx));
      if (r.some(x => x === false)) return false;
      return r.every(x => x === true) ? true : null;
    }
    case 'any': {
      const r = (node.items ?? []).map(n => evalCriteria(n, ctx));
      if (r.some(x => x === true)) return true;
      return r.every(x => x === false) ? false : null;
    }
    case 'atLeast': {
      const r = (node.items ?? []).map(n => evalCriteria(n, ctx));
      const t = r.filter(x => x === true).length;
      const u = r.filter(x => x === null).length;
      const k = node.k ?? 1;
      if (t >= k) return true;
      return t + u < k ? false : null;
    }
    case 'points': {
      let sum = 0;
      let possible = 0;
      for (const child of node.items ?? []) {
        const w = child.weight ?? 1;
        const r = evalCriteria(child, ctx);
        if (r === true) sum += w;
        else if (r === null && w > 0) possible += w;
      }
      const min = node.min ?? 1;
      if (sum >= min) return true;
      return sum + possible < min ? false : null;
    }
    case 'rule': {
      const bands = ctx.ruleBands.get(node.rule ?? '') ?? [];
      const recorded = bands.filter(b => ctx.answers[b] === true);
      if (!recorded.length) return null;
      const wanted = new Set((node.bands ?? []).map(b => `rule.${node.rule}.${b}`));
      return recorded.some(b => wanted.has(b));
    }
    case 'external': {
      const r = node.evaluator ? ctx.externals[node.evaluator] : undefined;
      if (r !== undefined) return r;
      if (!node.fallback?.length) return null;
      return evalCriteria({ op: 'all', items: node.fallback }, ctx);
    }
    case 'age': {
      if (ctx.patient.age === null) return null;
      if (node.min !== undefined && ctx.patient.age < node.min) return false;
      if (node.max !== undefined && ctx.patient.age > node.max) return false;
      return true;
    }
    case 'sex':
      return ctx.patient.sex === 'unknown' ? null : ctx.patient.sex === node.sex;
    default:
      return null;
  }
}

/** The label of a finding (its own, else its examination sign or rule band name). */
export function findingLabel(v: Vademecum, id: string): string {
  const f = v.findings.get(id);
  if (!f) return id;
  if (f.label) return f.label;
  if (f.examSign) return examSign(f.examSign)?.name ?? id;
  if (f.decisionRule) {
    const rule = decisionRule(f.decisionRule.rule);
    const band = rule?.bands.find(b => b.id === f.decisionRule!.band);
    return rule ? `${rule.name}: ${band?.label ?? f.decisionRule.band}` : id;
  }
  return id;
}
