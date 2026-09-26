import { decisionRule, examSign } from '../evidence/catalogue.js';
import {
  applies, criteriaFindings, demographicAnswers, evalCriteria, findingLabel,
} from './model.js';
import type { CriteriaContext, LoadedDisease, PatientInfo, Tri, Vademecum } from './model.js';
import type { CriteriaGrade, VademecumLevel, VCriteriaLevel } from './types.js';

/**
 * The hypothetico-deductive loop (phase 1, shadow).
 *
 *   1. The chief complaint, or any recorded entry-point finding (a symptom, sign, laboratory,
 *      imaging, pathology or score result), brings up the candidate diseases, together with the
 *      can't-miss diseases of the same areas.
 *   2. Each candidate's whole profile is recalled from the vademecum.
 *   3. The next question is the unanswered finding with the largest expected information gain
 *      over the candidates at the current level (history → exam → score → investigation), with a
 *      bonus for an item that would complete or refute a leading candidate's diagnostic criteria.
 *   4. Every answer recomputes the posterior (likelihood ratios; a decision rule supersedes its
 *      components; correlated findings of one group count once).
 *   5. It stops when the leading diagnosis reaches its treat threshold while no other can't-miss
 *      candidate is still at or above its test threshold, or when no remaining
 *      question can move the leading or a can't-miss diagnosis across a test or treat threshold
 *      (thresholds from the decision layer, lib/pane-engine/src/decision).
 *
 * The hybrid layer: met diagnostic criteria set a posterior floor (definite / suspected), when the
 * Bayesian posterior is at least the plausibility gate (criteriaMinPosterior; below it the met
 * criteria are a conflict: a reading error or a finding that does not fit); met referral criteria
 * (NG12) set the test decision without moving the rank; a pathognomonic finding is a very strong likelihood ratio shown as a confirmatory
 * finding (never an automatic diagnosis), a hard exclusion drops the diagnosis with its reason
 * (the clinician can override), and a conflict between the criteria and the Bayesian posterior is
 * reported. `hybrid: false` runs the Bayesian layer alone (for the shadow comparison).
 *
 * Deterministic; nothing is recorded, ordered or diagnosed: the output is a ranked list, the next
 * question and the reasons, for the clinician.
 */

export type Band = 'observe' | 'test' | 'treat';

export interface LoopInput {
  patient: PatientInfo;
  /** Findings recorded so far: true present, false documented absent. */
  answers: Record<string, boolean>;
  /** Results of external criteria evaluators (e.g. the TG18 auto-fill, NG12 screening), by id. */
  externals?: Record<string, boolean>;
  /** Exclusion ids the clinician has overridden. */
  overrides?: string[];
  /** false: the Bayesian layer alone (no criteria floors, exclusions or confirmatory weighting). */
  hybrid?: boolean;
}

export interface CriteriaLevelStatus {
  id: string;
  label: string;
  grade: CriteriaGrade;
  status: Tri;
}

export interface CriteriaStatus {
  criteriaId: string;
  name: string;
  kind: string;
  source: string;
  fromMemory: boolean;
  levels: CriteriaLevelStatus[];
}

export interface Contribution {
  finding: string;
  label: string;
  factor: number;
  kind: 'present' | 'absent' | 'rule' | 'pathognomonic';
}

export interface DiseaseResult {
  id: string;
  label: string;
  icd10: string;
  pane: string | null;
  area: string;
  cantMiss: boolean;
  urgency: string;
  /** Bayesian posterior over the candidates. */
  probability: number;
  /**
   * Floor from met definite / suspected criteria (0 when none, in Bayesian-only mode, or when the
   * posterior is below the policy's criteriaMinPosterior: then the criteria are a conflict instead).
   */
  floor: number;
  /** max(probability, floor): what ranks and stops. */
  effective: number;
  /** Floor from met referral criteria (NG12): sets the test decision (band) only, never the rank. */
  referralFloor: number;
  band: Band;
  thresholds: { test: number; treat: number; source: string };
  criteria: CriteriaStatus[];
  /** "Meets TG18 definite criteria (source)". */
  criteriaLabels: string[];
  /** "Confirmatory finding: …" / "Refuting finding: …". */
  confirmatory: string[];
  contributions: Contribution[];
}

export interface Exclusion {
  diseaseId: string;
  label: string;
  exclusionId: string;
  reason: string;
  note?: string;
  source: string;
}

export interface Conflict {
  diseaseId: string;
  kind: 'criteria-met-low-posterior' | 'high-posterior-criteria-refuted';
  detail: string;
}

export interface FinalDiagnosisPrompt {
  /** For the outcomes loop (lib/triage-engine/src/outcomes FinalDiagnosis): prompt, never written. */
  finalDiseaseId: string;
  finalIcd10: string;
  sourceType: 'histology';
  finding: string;
  label: string;
}

export interface IncidentalWorkupOutput {
  diseaseId: string;
  label: string;
  trigger: string[];
  classification: { criteriaId: string; name: string; met: string[] } | null;
  steps: { id: string; label: string; applies: Tri; source: string; fromMemory: boolean }[];
}

export interface Evaluation {
  ranked: DiseaseResult[];
  /** The shown list: top places by effective probability, the last `cantMissSlots` held for can't-miss diagnoses. */
  display: DiseaseResult[];
  excluded: Exclusion[];
  conflicts: Conflict[];
  finalDiagnosisPrompts: FinalDiagnosisPrompt[];
  incidental: IncidentalWorkupOutput[];
  answers: Record<string, boolean>;
}

const LN_EPS = 1e-300;

interface DiseaseScore {
  logW: number;
  contributions: Contribution[];
  confirmatory: string[];
}

/**
 * decision-rules.json policy between rules: a rule superseded by another recorded rule is not
 * applied (AIR supersedes Alvarado), and a rule valid only below another rule's cut-off is not
 * applied above it (PERC only with Wells PE 4 or less).
 */
function ruleApplies(v: Vademecum, ruleId: string, answers: Record<string, boolean>): boolean {
  const rule = decisionRule(ruleId);
  if (!rule) return false;
  if (rule.supersededBy.some(r => (v.ruleBands.get(r) ?? []).some(b => answers[b] === true))) return false;
  if (rule.appliesWhen) {
    const other = decisionRule(rule.appliesWhen.rule);
    const recorded = other?.bands.find(b => answers[`rule.${other.id}.${b.id}`] === true);
    if (recorded && recorded.min !== undefined && recorded.min > rule.appliesWhen.max) return false;
  }
  return true;
}

function clampLr(v: Vademecum, lr: number): number {
  return Math.min(v.policy.maxLr, Math.max(v.policy.minLr, lr));
}

function tierPrior(v: Vademecum, d: LoadedDisease, p: PatientInfo): number {
  let prior = v.policy.priorTiers[d.disease.prevalenceTier];
  if (d.disease.applicability?.pregnancy === 'required' && p.pregnancyPossible) prior *= v.policy.pregnancyPossibleMultiplier;
  return prior;
}

/** Log weight of one disease given the answers (prior × likelihood ratios, with the grouping rules). */
export function scoreDisease(v: Vademecum, d: LoadedDisease, answers: Record<string, boolean>, p: PatientInfo, hybrid: boolean): DiseaseScore {
  const contributions: Contribution[] = [];
  const confirmatory: string[] = [];
  let logW = Math.log(Math.max(LN_EPS, tierPrior(v, d, p)));
  const consumed = new Set<string>();

  // A recorded decision-rule band supersedes its component findings for the rule's targets:
  // component signs are neutral; a positive band counts as max(components, band); a band below 1
  // is applied in full with the components.
  for (const [findingId, link] of d.links) {
    if (link.level !== 'score' || answers[findingId] !== true || link.lrPositive === null) continue;
    const f = v.findings.get(findingId);
    const rule = f?.decisionRule ? decisionRule(f.decisionRule.rule) : undefined;
    if (rule && !ruleApplies(v, rule.id, answers)) { consumed.add(findingId); continue; }
    let componentRatio = 1;
    if (rule) {
      const componentFindings = [...v.findings.values()].filter(x =>
        (x.examSign && rule.components.signs.includes(x.examSign)) || (x.pane && rule.components.paneFeatures.includes(x.pane)));
      for (const cf of componentFindings) {
        consumed.add(cf.id);
        if (cf.examSign) continue;
        const cl = d.links.get(cf.id);
        if (!cl || answers[cf.id] === undefined) continue;
        if (answers[cf.id] && cl.lrPositive !== null) componentRatio *= clampLr(v, cl.lrPositive);
        else if (!answers[cf.id] && cl.negativeMeaningful && cl.lrNegative !== null) componentRatio *= clampLr(v, cl.lrNegative);
      }
    }
    const lr = clampLr(v, link.lrPositive);
    const factor = lr > 1 ? Math.max(componentRatio, lr) : lr * componentRatio;
    consumed.add(findingId);
    logW += Math.log(factor);
    contributions.push({ finding: findingId, label: findingLabel(v, findingId), factor, kind: 'rule' });
  }

  // Pathognomonic (confirmatory or refuting) findings. When the finding is also a link of the
  // disease's profile, it counts once, at the stronger of the two ratios (a cited confirmatory
  // ratio never weakens the profile's own).
  for (const pg of d.disease.pathognomonic) {
    if (answers[pg.finding] !== true) continue;
    if ((pg.requires ?? []).some(r => answers[r] !== true)) continue;
    let factor: number | null = null;
    if (hybrid) factor = pg.definitive ? v.policy.definitiveLR : pg.lrPositive?.point ?? null;
    else if (pg.lrPositive) factor = clampLr(v, pg.lrPositive.point);
    const own = d.links.get(pg.finding)?.lrPositive;
    if (own !== null && own !== undefined && (factor === null || (factor >= 1 && own > factor))) factor = factor === null ? clampLr(v, own) : Math.max(factor, clampLr(v, own));
    if (factor === null) continue;
    consumed.add(pg.finding);
    logW += Math.log(factor);
    contributions.push({ finding: pg.finding, label: pg.label, factor, kind: 'pathognomonic' });
    if (hybrid) confirmatory.push(`${factor < 1 ? 'Refuting' : 'Confirmatory'} finding: ${pg.label}`);
  }

  // Ordinary links; findings of one correlation group count once each way (strongest ratio).
  const groups = new Map<string, { pos: number; neg: number; ids: string[] }>();
  for (const [findingId, link] of d.links) {
    if (consumed.has(findingId)) continue;
    const a = answers[findingId];
    if (a === undefined) continue;
    let factor = 1;
    if (a && link.lrPositive !== null) factor = clampLr(v, link.lrPositive);
    else if (!a && link.negativeMeaningful && link.lrNegative !== null) factor = clampLr(v, link.lrNegative);
    if (factor === 1) continue;
    if (link.group) {
      const g = groups.get(link.group) ?? { pos: 1, neg: 1, ids: [] };
      if (factor > 1) g.pos = Math.max(g.pos, factor); else g.neg = Math.min(g.neg, factor);
      g.ids.push(findingId);
      groups.set(link.group, g);
      continue;
    }
    logW += Math.log(factor);
    contributions.push({ finding: findingId, label: findingLabel(v, findingId), factor, kind: a ? 'present' : 'absent' });
  }
  for (const [group, g] of groups) {
    const factor = g.pos * g.neg;
    if (factor === 1) continue;
    logW += Math.log(factor);
    contributions.push({ finding: g.ids.join('+'), label: `${group}: ${g.ids.map(id => findingLabel(v, id)).join(', ')}`, factor, kind: 'present' });
  }
  return { logW, contributions, confirmatory };
}

function excludedBy(v: Vademecum, d: LoadedDisease, answers: Record<string, boolean>, p: PatientInfo, overrides: Set<string>): Exclusion | null {
  for (const e of d.disease.exclusions) {
    if (overrides.has(e.id)) continue;
    let hit = false;
    if (e.sex) hit = p.sex === e.sex;
    else if (e.finding) {
      const a = answers[e.finding];
      hit = a !== undefined && (e.state === 'absent' ? !a : a);
    }
    if (hit) return { diseaseId: d.disease.id, label: d.disease.label, exclusionId: e.id, reason: e.reason, note: e.note, source: e.source };
  }
  return null;
}

function floorFor(v: Vademecum, grade: CriteriaGrade): number {
  return grade === 'classification' ? 0 : v.policy.criteriaFloors[grade];
}

/** The rank floor that applies at this posterior (definite / suspected only; gated by criteriaMinPosterior). */
function gatedFloor(v: Vademecum, diagnosticFloor: number, probability: number): number {
  return probability >= v.policy.criteriaMinPosterior ? diagnosticFloor : 0;
}

function criteriaContext(v: Vademecum, input: LoopInput, answers: Record<string, boolean>): CriteriaContext {
  return { answers, patient: input.patient, externals: input.externals ?? {}, ruleBands: v.ruleBands, findings: v.findings };
}

export function bandFor(p: number, t: { test: number; treat: number }): Band {
  if (p >= t.treat) return 'treat';
  return p >= t.test ? 'test' : 'observe';
}

/** Evaluate a candidate set: posteriors, criteria, floors, exclusions, conflicts. */
export function evaluate(v: Vademecum, candidateIds: readonly string[], input: LoopInput): Evaluation {
  const hybrid = input.hybrid !== false;
  const answers = { ...demographicAnswers(v, input.patient), ...input.answers };
  const overrides = new Set(input.overrides ?? []);
  const excluded: Exclusion[] = [];
  const scored: { d: LoadedDisease; s: DiseaseScore }[] = [];
  for (const id of candidateIds) {
    const d = v.diseases.get(id);
    if (!d || !applies(d.disease, input.patient)) continue;
    if (hybrid) {
      const ex = excludedBy(v, d, answers, input.patient, overrides);
      if (ex) { excluded.push(ex); continue; }
    }
    scored.push({ d, s: scoreDisease(v, d, answers, input.patient, hybrid) });
  }
  const maxLog = Math.max(...scored.map(x => x.s.logW));
  const weights = scored.map(x => Math.exp(x.s.logW - maxLog));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const ctx = criteriaContext(v, input, answers);
  const conflicts: Conflict[] = [];
  const ranked: DiseaseResult[] = scored.map(({ d, s }, i) => {
    const probability = weights[i]! / total;
    const criteria: CriteriaStatus[] = d.disease.criteria.map(c => ({
      criteriaId: c.id, name: c.name, kind: c.kind, source: c.source, fromMemory: c.fromMemory,
      levels: c.levels.map(l => ({ id: l.id, label: l.label, grade: l.grade, status: evalCriteria(l.when, ctx) })),
    }));
    let diagnosticFloor = 0;
    let referralFloor = 0;
    const criteriaLabels: string[] = [];
    if (hybrid) {
      for (const c of criteria) {
        const met = c.levels.filter(l => l.status === true);
        for (const l of met) {
          if (l.grade === 'referral') referralFloor = Math.max(referralFloor, floorFor(v, l.grade));
          else diagnosticFloor = Math.max(diagnosticFloor, floorFor(v, l.grade));
        }
        // The highest met level names it ("Meets TG18 definite criteria").
        const top = met.sort((a, b) => floorFor(v, b.grade) - floorFor(v, a.grade))[0];
        if (top) criteriaLabels.push(`Meets ${c.name}: ${top.label} (${c.source})`);
      }
    }
    const floor = gatedFloor(v, diagnosticFloor, probability);
    const effective = Math.max(probability, floor);
    const band = bandFor(Math.max(effective, referralFloor), d.thresholds);
    if (hybrid) {
      const metDiagnostic = diagnosticFloor > 0;
      if (metDiagnostic && probability < v.policy.conflictLowPosterior) {
        const gated = floor === 0 ? ' (floor not applied: below the plausibility gate)' : '';
        conflicts.push({
          diseaseId: d.disease.id, kind: 'criteria-met-low-posterior',
          detail: `${d.disease.label}: ${criteriaLabels.join('; ')}, but the Bayesian posterior is ${(probability * 100).toFixed(1)}%${gated}.`,
        });
      }
      const refuted = criteria.filter(c => c.kind === 'diagnostic' && c.levels.length > 0 && c.levels.every(l => l.status === false));
      if (probability >= v.policy.conflictHighPosterior && refuted.length) {
        conflicts.push({
          diseaseId: d.disease.id, kind: 'high-posterior-criteria-refuted',
          detail: `${d.disease.label}: posterior ${(probability * 100).toFixed(0)}% but ${refuted.map(c => c.name).join(', ')} not met.`,
        });
      }
    }
    return {
      id: d.disease.id, label: d.disease.label, icd10: d.disease.icd10, pane: d.disease.pane, area: d.area,
      cantMiss: d.disease.cantMiss, urgency: d.disease.urgency, probability, floor, effective, referralFloor, band,
      thresholds: { ...d.thresholds, source: d.thresholdSource }, criteria, criteriaLabels,
      confirmatory: s.confirmatory, contributions: s.contributions,
    };
  });
  ranked.sort((a, b) => (b.effective - a.effective) || (b.probability - a.probability) || a.id.localeCompare(b.id));
  return {
    ranked, display: displayList(v, ranked), excluded, conflicts,
    finalDiagnosisPrompts: hybrid ? finalDiagnosisPrompts(v, ranked, answers) : [],
    incidental: incidentalWorkups(v, ranked, ctx), answers,
  };
}

/** Top places by effective probability; the last `cantMissSlots` held for can't-miss diagnoses not already shown. */
export function displayList(v: Vademecum, ranked: readonly DiseaseResult[]): DiseaseResult[] {
  const slots = v.policy.displaySlots;
  const held = Math.min(v.policy.cantMissSlots, slots);
  const shown = ranked.slice(0, slots - held);
  for (const r of ranked) {
    if (shown.length >= slots) break;
    if (!shown.includes(r) && r.cantMiss) shown.push(r);
  }
  for (const r of ranked) {
    if (shown.length >= slots) break;
    if (!shown.includes(r)) shown.push(r);
  }
  return shown;
}

function finalDiagnosisPrompts(v: Vademecum, ranked: readonly DiseaseResult[], answers: Record<string, boolean>): FinalDiagnosisPrompt[] {
  const out: FinalDiagnosisPrompt[] = [];
  for (const r of ranked) {
    const d = v.diseases.get(r.id)!;
    for (const pg of d.disease.pathognomonic) {
      if (!pg.definitive || answers[pg.finding] !== true) continue;
      if (v.findings.get(pg.finding)?.dimension !== 'pathology') continue;
      out.push({ finalDiseaseId: r.pane ?? r.id, finalIcd10: r.icd10, sourceType: 'histology', finding: pg.finding, label: pg.label });
    }
  }
  return out;
}

function incidentalWorkups(v: Vademecum, ranked: readonly DiseaseResult[], ctx: CriteriaContext): IncidentalWorkupOutput[] {
  const out: IncidentalWorkupOutput[] = [];
  for (const r of ranked) {
    const d = v.diseases.get(r.id)!.disease;
    const w = d.workupWhenIncidental;
    if (!w || !w.trigger.some(t => ctx.answers[t] === true)) continue;
    const cls = w.classification ? d.criteria.find(c => c.id === w.classification) : undefined;
    out.push({
      diseaseId: d.id, label: d.label, trigger: w.trigger.filter(t => ctx.answers[t] === true),
      classification: cls ? { criteriaId: cls.id, name: cls.name, met: cls.levels.filter(l => evalCriteria(l.when, ctx) === true).map(l => l.label) } : null,
      steps: w.steps.map(s => ({ id: s.id, label: s.label, applies: s.when ? evalCriteria(s.when, ctx) : true, source: s.source, fromMemory: s.fromMemory })),
    });
  }
  return out;
}

// ── Candidate set (complaint or any entry point) ─────────────────────────────────────────────────

export interface SeedInput {
  complaint?: string;
  /** History frames of the complaint (lib/triage-engine/src/history-frames classifyComplaint). */
  frames?: string[];
  /** Recorded findings that can start a case (entryPoint set): lab, imaging, pathology, sign … */
  entryFindings?: string[];
  patient: PatientInfo;
}

export interface CandidateSet {
  ids: string[];
  areas: string[];
  /** Why each disease is a candidate ("complaint", "can't-miss", or the entry finding). */
  seededBy: Record<string, string[]>;
}

function wordStartMatch(text: string, keyword: string): boolean {
  const esc = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${esc}`).test(text.toLowerCase());
}

/** Areas the complaint names (keywords at word starts, or its history frame). */
export function complaintAreas(v: Vademecum, complaint: string, frames: readonly string[] = []): string[] {
  return v.areas
    .filter(a => a.complaints.keywords.some(k => wordStartMatch(complaint, k)) || a.complaints.frames.some(f => frames.includes(f)))
    .map(a => a.area);
}

export function seedCandidates(v: Vademecum, input: SeedInput): CandidateSet {
  const seededBy: Record<string, string[]> = {};
  const add = (id: string, why: string) => { (seededBy[id] ??= []).includes(why) || seededBy[id]!.push(why); };
  const areas = new Set<string>(input.complaint ? complaintAreas(v, input.complaint, input.frames ?? []) : []);
  for (const areaId of areas) {
    const area = v.areas.find(a => a.area === areaId)!;
    for (const d of area.diseases) if (d.seedFromComplaint) add(d.id, 'complaint');
    for (const id of area.related) if (v.diseases.has(id)) add(id, 'complaint (related)');
  }
  // Entry points (a sign, laboratory, imaging, pathology or score result recorded first): every
  // disease whose profile names the finding as evidence for it — its can't-miss diseases come in
  // the same way, since their profiles name it too (reverse index).
  for (const f of input.entryFindings ?? []) {
    const finding = v.findings.get(f);
    if (!finding || finding.entryPoint === null) continue;
    for (const id of v.reverse.get(f) ?? []) {
      const d = v.diseases.get(id)!;
      const link = d.links.get(f);
      const supports = (link && (link.lrPositive ?? 1) > 1)
        || d.disease.pathognomonic.some(p => p.finding === f && (p.definitive || (p.lrPositive?.point ?? 1) > 1))
        || (d.disease.workupWhenIncidental?.trigger ?? []).includes(f)
        || d.disease.criteria.some(c => c.levels.some(l => criteriaFindings(l.when).has(f)));
      if (!supports) continue;
      add(id, d.disease.cantMiss ? `entry: ${f} (can't-miss)` : `entry: ${f}`);
      areas.add(d.area);
    }
  }
  let ids = Object.keys(seededBy);
  if (!ids.length) {
    for (const d of v.diseases.values()) if (d.disease.seedFromComplaint) add(d.disease.id, 'no complaint match: every area');
    ids = Object.keys(seededBy);
  }
  return {
    ids: ids.filter(id => applies(v.diseases.get(id)!.disease, input.patient)).sort(),
    areas: [...areas].sort(), seededBy,
  };
}

// ── Next question: expected information gain, criteria bonus, threshold stopping ─────────────────

export interface Question {
  kind: 'finding' | 'rule';
  /** The finding id, or the rule id (a score question: its bands are the answers). */
  id: string;
  level: VademecumLevel;
  label: string;
  informationGain: number;
  criteriaBonus: number;
  /** Why the criteria bonus applies ("1 more Atlanta criterion: lipase ≥ 3 × ULN"). */
  reasons: string[];
  /** An answer could move the leading or a can't-miss diagnosis across a threshold. */
  changesBand: boolean;
}

function entropy(ps: Iterable<number>): number {
  let h = 0;
  for (const p of ps) if (p > 0) h -= p * Math.log(p);
  return h;
}

/**
 * The part of an evaluation the question picker needs, recomputed incrementally: only the diseases
 * whose profile names a changed finding are rescored (reverse index).
 */
interface Core {
  logW: Map<string, number>;
  /** Definite / suspected floor before the plausibility gate. */
  floor: Map<string, number>;
  /** Referral floor (band only). */
  referral: Map<string, number>;
}

interface CoreView {
  probability: Map<string, number>;
  effective: Map<string, number>;
  /** max(effective, referral floor): what the band reads. */
  banded: Map<string, number>;
  leader: string | null;
}

function diseaseFloors(v: Vademecum, d: LoadedDisease, ctx: CriteriaContext): { diagnostic: number; referral: number } {
  let diagnostic = 0;
  let referral = 0;
  for (const c of d.disease.criteria) {
    for (const l of c.levels) {
      if (l.grade === 'classification' || evalCriteria(l.when, ctx) !== true) continue;
      if (l.grade === 'referral') referral = Math.max(referral, floorFor(v, l.grade));
      else diagnostic = Math.max(diagnostic, floorFor(v, l.grade));
    }
  }
  return { diagnostic, referral };
}

function coreEntry(v: Vademecum, d: LoadedDisease, input: LoopInput, answers: Record<string, boolean>, core: Core): void {
  const hybrid = input.hybrid !== false;
  if (hybrid && excludedBy(v, d, answers, input.patient, new Set(input.overrides ?? []))) {
    core.logW.delete(d.disease.id);
    core.floor.delete(d.disease.id);
    core.referral.delete(d.disease.id);
    return;
  }
  core.logW.set(d.disease.id, scoreDisease(v, d, answers, input.patient, hybrid).logW);
  const floors = hybrid ? diseaseFloors(v, d, criteriaContext(v, input, answers)) : { diagnostic: 0, referral: 0 };
  core.floor.set(d.disease.id, floors.diagnostic);
  core.referral.set(d.disease.id, floors.referral);
}

function coreOf(v: Vademecum, candidates: readonly string[], input: LoopInput, answers: Record<string, boolean>): Core {
  const core: Core = { logW: new Map(), floor: new Map(), referral: new Map() };
  for (const id of candidates) {
    const d = v.diseases.get(id);
    if (d && applies(d.disease, input.patient)) coreEntry(v, d, input, answers, core);
  }
  return core;
}

function coreWith(v: Vademecum, base: Core, candidates: readonly string[], input: LoopInput, answers: Record<string, boolean>, changed: readonly string[]): Core {
  const core: Core = { logW: new Map(base.logW), floor: new Map(base.floor), referral: new Map(base.referral) };
  const touched = new Set<string>();
  for (const f of changed) for (const id of v.reverse.get(f) ?? []) touched.add(id);
  const live = new Set(candidates);
  for (const id of touched) {
    const d = v.diseases.get(id);
    if (d && live.has(id) && applies(d.disease, input.patient)) coreEntry(v, d, input, answers, core);
  }
  return core;
}

function viewOf(v: Vademecum, core: Core): CoreView {
  const max = Math.max(...core.logW.values());
  let total = 0;
  const w = new Map<string, number>();
  for (const [id, l] of core.logW) { const x = Math.exp(l - max); w.set(id, x); total += x; }
  const probability = new Map<string, number>();
  const effective = new Map<string, number>();
  const banded = new Map<string, number>();
  let leader: string | null = null;
  for (const [id, x] of w) {
    const p = x / (total || 1);
    probability.set(id, p);
    const e = Math.max(p, gatedFloor(v, core.floor.get(id) ?? 0, p));
    effective.set(id, e);
    banded.set(id, Math.max(e, core.referral.get(id) ?? 0));
    if (leader === null || e > effective.get(leader)! || (e === effective.get(leader)! && id < leader)) leader = id;
  }
  return { probability, effective, banded, leader };
}

/** P(finding present | disease) for the predictive distribution: LR+ × the finding's base rate. */
function presentProbability(v: Vademecum, d: LoadedDisease, findingId: string): number {
  const f = v.findings.get(findingId)!;
  const pg = d.disease.pathognomonic.find(p => p.finding === findingId);
  if (pg?.definitive) return 0.9;
  const lr = Math.max(pg?.lrPositive?.point ?? 0, d.links.get(findingId)?.lrPositive ?? 0) || 1;
  return Math.min(0.99, Math.max(0.001, lr * f.baseRate));
}

/**
 * True when the answer moves the leading diagnosis, or a can't-miss candidate, across a test or
 * treat threshold (or drops it), or a new leader above its test threshold takes over.
 */
/** Leader marker in `bandMoves`: the leading diagnosis changes to one at or above its test band. */
const LEADER_MOVE = '@leader';

/**
 * Which diagnoses an answer would move across a threshold: the leader or a can't-miss candidate
 * whose band changes, and LEADER_MOVE when another diagnosis would lead at test or treat.
 */
function bandMoves(v: Vademecum, before: CoreView, after: CoreView): string[] {
  if (!before.leader) return [];
  const band = (view: CoreView, id: string): Band | null => {
    const e = view.banded.get(id);
    return e === undefined ? null : bandFor(e, v.diseases.get(id)!.thresholds);
  };
  const moves: string[] = [];
  if (after.leader && after.leader !== before.leader && band(after, after.leader) !== 'observe') moves.push(LEADER_MOVE);
  for (const id of before.banded.keys()) {
    if (id !== before.leader && !v.diseases.get(id)!.disease.cantMiss) continue;
    if (band(before, id) !== band(after, id)) moves.push(id);
  }
  return moves;
}

/** Unanswered questions at a level that bear on the candidates. */
export function questionsAt(v: Vademecum, candidates: readonly string[], level: VademecumLevel, answers: Record<string, boolean>, asked: ReadonlySet<string>): { kind: 'finding' | 'rule'; id: string }[] {
  const out = new Map<string, { kind: 'finding' | 'rule'; id: string }>();
  for (const id of candidates) {
    const d = v.diseases.get(id);
    if (!d) continue;
    const ids = new Set([...d.links.keys(), ...d.mentions]);
    for (const fid of ids) {
      const f = v.findings.get(fid);
      if (!f || f.level !== level || f.demographic) continue;
      // The free-text twin of an examination sign is read from the record, not asked: the sign chip is.
      if (f.group && v.signGroups.has(f.group) && !f.examSign) continue;
      if (f.decisionRule) {
        const rid = f.decisionRule.rule;
        const bands = v.ruleBands.get(rid) ?? [];
        if (asked.has(`rule:${rid}`) || bands.some(b => answers[b] !== undefined)) continue;
        out.set(`rule:${rid}`, { kind: 'rule', id: rid });
        continue;
      }
      if (answers[fid] !== undefined || asked.has(fid)) continue;
      const link = d.links.get(fid);
      const informative = (link && (link.lrPositive !== null && link.lrPositive !== 1 || (link.negativeMeaningful && link.lrNegative !== null)))
        || d.mentions.has(fid);
      if (informative) out.set(fid, { kind: 'finding', id: fid });
    }
  }
  return [...out.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function criteriaReasons(v: Vademecum, ev: Evaluation, input: LoopInput, findingId: string): { bonus: number; reasons: string[] } {
  if (input.hybrid === false) return { bonus: 0, reasons: [] };
  let bonus = 0;
  const reasons: string[] = [];
  for (const r of ev.ranked.slice(0, 3)) {
    const d = v.diseases.get(r.id)!;
    for (const c of d.disease.criteria) {
      for (const level of c.levels) {
        if (level.grade === 'classification' || !criteriaFindings(level.when).has(findingId)) continue;
        const base = criteriaContext(v, input, ev.answers);
        if (evalCriteria(level.when, base) !== null) continue;
        const ifPresent = evalCriteria(level.when, { ...base, answers: { ...ev.answers, [findingId]: true } });
        const ifAbsent = evalCriteria(level.when, { ...base, answers: { ...ev.answers, [findingId]: false } });
        if (ifPresent === null && ifAbsent === null) continue;
        bonus += v.policy.criteriaBonus * r.effective;
        const label = criteriaItemLabel(level, findingId) ?? findingLabel(v, findingId);
        reasons.push(ifPresent === true
          ? `1 more ${c.name} item (${level.label}, ${r.label}): ${label}`
          : `${c.name} item (${level.label}, ${r.label}): ${label}`);
      }
    }
  }
  return { bonus, reasons };
}

function criteriaItemLabel(level: VCriteriaLevel, findingId: string): string | undefined {
  const walk = (n: typeof level.when): string | undefined => {
    if (n.finding === findingId && n.label) return n.label;
    for (const c of [...(n.items ?? []), ...(n.fallback ?? [])]) {
      const r = walk(c);
      if (r) return r;
    }
    return undefined;
  };
  return walk(level.when);
}

interface GainContext {
  candidates: readonly string[];
  input: LoopInput;
  answers: Record<string, boolean>;
  core: Core;
  view: CoreView;
}

function gainContext(v: Vademecum, candidates: readonly string[], input: LoopInput, answers: Record<string, boolean>): GainContext {
  const core = coreOf(v, candidates, input, answers);
  return { candidates, input, answers, core, view: viewOf(v, core) };
}

/** Expected information gain (nats) of one question over the candidates' Bayesian posterior. */
function questionGainIn(v: Vademecum, g: GainContext, q: { kind: 'finding' | 'rule'; id: string }): { gain: number; changesBand: boolean; moves: string[] } {
  const h0 = entropy(g.view.probability.values());
  const outcomes: { p: number; answers: Record<string, boolean>; changed: string[] }[] = [];
  if (q.kind === 'finding') {
    let pPresent = 0;
    for (const [id, p] of g.view.probability) pPresent += p * presentProbability(v, v.diseases.get(id)!, q.id);
    pPresent = Math.min(0.999, Math.max(0.001, pPresent));
    outcomes.push({ p: pPresent, answers: { ...g.answers, [q.id]: true }, changed: [q.id] });
    outcomes.push({ p: 1 - pPresent, answers: { ...g.answers, [q.id]: false }, changed: [q.id] });
  } else {
    const bands = v.ruleBands.get(q.id) ?? [];
    if (!bands.length) return { gain: 0, changesBand: false, moves: [] };
    const w = 1 / bands.length;
    const pb = bands.map(b => {
      let p = 0;
      for (const [id, pd] of g.view.probability) {
        const d = v.diseases.get(id)!;
        const norm = bands.reduce((a, x) => a + (d.links.get(x)?.lrPositive ?? 1) * w, 0) || 1;
        p += pd * ((d.links.get(b)?.lrPositive ?? 1) * w) / norm;
      }
      return p;
    });
    bands.forEach((b, i) => outcomes.push({
      p: pb[i]!, answers: { ...g.answers, ...Object.fromEntries(bands.map(x => [x, x === b])) }, changed: bands,
    }));
  }
  let expected = 0;
  const moves = new Set<string>();
  for (const o of outcomes) {
    if (o.p <= 0) continue;
    const after = viewOf(v, coreWith(v, g.core, g.candidates, g.input, o.answers, o.changed));
    expected += o.p * entropy(after.probability.values());
    for (const id of bandMoves(v, g.view, after)) moves.add(id);
  }
  return { gain: Math.max(0, h0 - expected), changesBand: moves.size > 0, moves: [...moves] };
}

/** Expected information gain (nats) of one question, and whether an answer could cross a threshold. */
export function questionGain(
  v: Vademecum, candidates: readonly string[], input: LoopInput, q: { kind: 'finding' | 'rule'; id: string },
): { gain: number; changesBand: boolean } {
  const answers = { ...demographicAnswers(v, input.patient), ...input.answers };
  const { gain, changesBand } = questionGainIn(v, gainContext(v, candidates, input, answers), q);
  return { gain, changesBand };
}

/** The best question at a level (information gain + criteria bonus), or null when none is worth asking. */
export function bestQuestion(
  v: Vademecum, candidates: readonly string[], input: LoopInput, level: VademecumLevel, asked: ReadonlySet<string> = new Set(),
  ev: Evaluation = evaluate(v, candidates, input),
  inPlay?: ReadonlySet<string>,
): Question | null {
  const live = ev.ranked.map(r => r.id);
  const g = gainContext(v, live, input, ev.answers);
  let best: Question | null = null;
  for (const q of questionsAt(v, live, level, ev.answers, asked)) {
    const { gain, moves } = questionGainIn(v, g, q);
    // With `inPlay` (the loop): only a change of leader or a band move of a diagnosis in play counts.
    // A question that could only lift an unsuspected can't-miss diagnosis from observe, or nudge one
    // whose deciding test comes at a later level, does not hold this level.
    const changesBand = inPlay ? moves.some(id => id === LEADER_MOVE || inPlay.has(id)) : moves.length > 0;
    const { bonus, reasons } = q.kind === 'finding' ? criteriaReasons(v, ev, input, q.id) : { bonus: 0, reasons: [] };
    const label = q.kind === 'rule' ? (decisionRule(q.id)?.name ?? q.id) : findingLabel(v, q.id);
    const cand: Question = { kind: q.kind, id: q.id, level, label, informationGain: gain, criteriaBonus: bonus, reasons, changesBand };
    const score = (x: Question) => (x.changesBand ? 1000 : 0) + x.informationGain + x.criteriaBonus;
    if (!best || score(cand) > score(best)) best = cand;
  }
  if (!best) return null;
  if (!best.changesBand && best.informationGain + best.criteriaBonus < v.policy.minInformationGain) return null;
  return best;
}

export type StopReason = 'treat-threshold' | 'treat-threshold-workup' | 'no-threshold-change' | 'question-cap' | 'no-candidates';

/** A can't-miss diagnosis left open at the stop, with the tests that would settle it. */
export interface PendingWorkup {
  diseaseId: string;
  label: string;
  /** Deciding findings (investigation / score level) the record does not hold yet. */
  tests: { id: string; label: string; level: VademecumLevel }[];
}

/**
 * Questions per level before the loop moves on (engineering default, for sign-off with the other
 * loop numbers): a clinician takes a focused history, examines, scores, then investigates, instead of
 * asking every history question that could nudge an unlikely diagnosis. The overall cap
 * (policy.maxQuestions) still applies; investigations have no own budget.
 */
export const LEVEL_QUESTION_BUDGET: Partial<Record<VademecumLevel, number>> = { history: 8, exam: 5, score: 3 };

/** Likelihood ratios strong enough for an investigation to decide a diagnosis on its own. */
const DECIDING_LR_POSITIVE = 10;
const DECIDING_LR_NEGATIVE = 0.1;

/**
 * The findings that decide a diagnosis: those its criteria and confirmatory (pathognomonic) entries
 * name, and its links strong enough to settle it alone (LR+ >= 10 or LR- <= 0.1), each with its level.
 */
export function decidingFindings(v: Vademecum, diseaseId: string): { id: string; level: VademecumLevel }[] {
  const d = v.diseases.get(diseaseId);
  if (!d) return [];
  const ids = new Set<string>();
  for (const c of d.disease.criteria) for (const l of c.levels) criteriaFindings(l.when, ids);
  for (const p of d.disease.pathognomonic) { ids.add(p.finding); for (const r of p.requires ?? []) ids.add(r); }
  for (const [fid, link] of d.links) {
    if ((link.lrPositive ?? 1) >= DECIDING_LR_POSITIVE || (link.lrNegative !== null && link.lrNegative <= DECIDING_LR_NEGATIVE)) ids.add(fid);
  }
  const out: { id: string; level: VademecumLevel }[] = [];
  for (const id of ids) {
    const f = v.findings.get(id);
    if (f && !f.demographic) out.push({ id, level: f.level });
  }
  return out;
}

/**
 * Can't-miss candidates (not the leader) still at or above their test band whose deciding tests all
 * sit at a later level than `level` and are not yet answered: history or examination questions that
 * could only nudge them do not hold the loop at `level`, because the test decides them.
 */
/**
 * The diagnoses whose band moves hold the loop at `level`: the leader, and the can't-miss candidates
 * already at or above their test band that are not waiting on a later-level deciding test.
 */
export function inPlayAt(v: Vademecum, ev: Evaluation, level: VademecumLevel): Set<string> {
  const deferred = deferredCantMiss(v, ev, level, ev.answers);
  const out = new Set<string>();
  const leader = ev.ranked[0];
  if (leader) out.add(leader.id);
  for (const r of ev.ranked) if (r.cantMiss && r.band !== 'observe' && !deferred.has(r.id)) out.add(r.id);
  return out;
}

export function deferredCantMiss(v: Vademecum, ev: Evaluation, level: VademecumLevel, answers: Record<string, boolean>): Set<string> {
  const levels = v.policy.levels;
  const li = levels.indexOf(level);
  const out = new Set<string>();
  const leader = ev.ranked[0];
  for (const r of ev.ranked) {
    if (r === leader || !r.cantMiss || r.band === 'observe') continue;
    const later = decidingFindings(v, r.id).filter(f => levels.indexOf(f.level) > li && answers[f.id] === undefined);
    const current = decidingFindings(v, r.id).filter(f => levels.indexOf(f.level) <= li && answers[f.id] === undefined);
    if (later.length && !current.length) out.add(r.id);
  }
  return out;
}

export interface LoopStep {
  question: Question;
  answer: boolean | string | null;
  leaderAfter: string | null;
}

export interface LoopRun {
  candidates: CandidateSet;
  steps: LoopStep[];
  stop: StopReason;
  final: Evaluation;
  /** 'treat-threshold-workup': the can't-miss diagnoses left open and the tests that would settle them. */
  pendingWorkup?: PendingWorkup[];
  /** The level the loop stopped at. */
  level: VademecumLevel;
}

/**
 * One simulated consultation: from the seeded candidates, ask the best question level by level,
 * take the answer from `oracle` (true / false, a band id for a rule, or undefined = not known:
 * the question still counts), and stop at the thresholds. Used by the shadow comparison.
 */
export function runLoop(
  v: Vademecum, candidates: CandidateSet, start: LoopInput,
  oracle: (q: { kind: 'finding' | 'rule'; id: string }) => boolean | string | undefined,
): LoopRun {
  const answers = { ...start.answers };
  const asked = new Set<string>();
  const steps: LoopStep[] = [];
  const levels = v.policy.levels;
  let li = 0;
  const input = (): LoopInput => ({ ...start, answers });
  if (!candidates.ids.length) return { candidates, steps, stop: 'no-candidates', final: evaluate(v, [], input()), level: levels[0]! };
  while (true) {
    const ev = evaluate(v, candidates.ids, input());
    const leader = ev.ranked[0];
    // Treat threshold reached, and no other can't-miss candidate is still at or above its test
    // threshold (a leader at "treat" does not end the work-up of a can't-miss alternative).
    const open = ev.ranked.filter(r => r !== leader && r.cantMiss && r.band !== 'observe');
    if (leader && leader.effective >= leader.thresholds.treat) {
      if (!open.length) return { candidates, steps, stop: 'treat-threshold', final: ev, level: levels[li]! };
      // Every open can't-miss diagnosis waits only on a deciding test that was asked and is not in the
      // record: stop and name the tests to order, instead of asking more history that cannot settle it.
      const pending = open.map(r => ({
        r,
        tests: decidingFindings(v, r.id).filter(f => answers[f.id] === undefined && levels.indexOf(f.level) >= levels.indexOf('score')),
      }));
      const wasAsked = (id: string) => {
        const rule = v.findings.get(id)?.decisionRule?.rule;
        return asked.has(id) || (rule !== undefined && asked.has(`rule:${rule}`));
      };
      if (pending.every(p => p.tests.length > 0 && p.tests.every(t => wasAsked(t.id)))) {
        return {
          candidates, steps, stop: 'treat-threshold-workup', final: ev, level: levels[li]!,
          pendingWorkup: pending.map(p => ({
            diseaseId: p.r.id, label: p.r.label,
            tests: p.tests.map(t => ({ id: t.id, label: findingLabel(v, t.id), level: t.level })),
          })),
        };
      }
    }
    if (steps.length >= v.policy.maxQuestions) return { candidates, steps, stop: 'question-cap', final: ev, level: levels[li]! };
    let q: Question | null = null;
    while (li < levels.length) {
      const level = levels[li]!;
      const budget = LEVEL_QUESTION_BUDGET[level];
      const askedHere = steps.filter(st => st.question.level === level).length;
      if (budget === undefined || askedHere < budget) {
        q = bestQuestion(v, candidates.ids, input(), level, asked, ev, inPlayAt(v, ev, level));
        if (q?.changesBand) break;
      }
      q = null;
      li++;
    }
    if (!q) return { candidates, steps, stop: 'no-threshold-change', final: ev, level: levels[Math.min(li, levels.length - 1)]! };
    const answer = oracle(q);
    if (q.kind === 'rule') {
      asked.add(`rule:${q.id}`);
      const bands = v.ruleBands.get(q.id) ?? [];
      if (typeof answer === 'string') for (const b of bands) answers[b] = b === answer;
    } else {
      asked.add(q.id);
      if (typeof answer === 'boolean') answers[q.id] = answer;
    }
    const after = evaluate(v, candidates.ids, input());
    steps.push({ question: q, answer: answer ?? null, leaderAfter: after.ranked[0]?.id ?? null });
  }
}

/** The examination sign behind a finding, if it references one (generators). */
export function signFor(v: Vademecum, findingId: string) {
  const f = v.findings.get(findingId);
  return f?.examSign ? examSign(f.examSign) : undefined;
}
