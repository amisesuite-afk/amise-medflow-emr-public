/**
 * Diagnostic reasoning — platform-neutral core (deterministic; no AI, no network).
 *
 * iOS twin: ios/AmiseMedFlow/Services/DiagnosticReasoningCore.swift. The two implement the same
 * rules, thresholds and wording and are checked against the same test vectors
 * (ios/AmiseMedFlowTests/Resources/DiagnosticReasoningVectors.json, read by
 * artifacts/dashboard/src/lib/__tests__/diagnostic-reasoning-core.test.ts and
 * ios/AmiseMedFlowTests/DiagnosticReasoningTests.swift). Change both in the same commit.
 *
 * What it does (the engines supply the numbers; nothing here invents clinical weights):
 *  - explain(): for one hypothesis, the recorded findings that support it (likelihood ratio ≥ 1.5),
 *    the ones that argue against it (LR ≤ 0.67, present or documented absent), its cardinal
 *    findings that are missing (documented absent, or not recorded yet) and the recorded findings
 *    it does not explain ("doesn't fit"), each with the finding's LR and the engine's source.
 *  - expectedInformationGain() / postTest(): the same Shannon information gain as
 *    lib/pane-engine infoGain.ts (natural log), and the probabilities after a positive or negative
 *    result.
 *  - classifyProbeCost() / rankDiscriminators() / discriminatorWhy(): which question, sign or
 *    test best separates the leading diagnoses, cheapest first; CT / MRI / endoscopy only when a
 *    can't-miss diagnosis is among them.
 *  - prematureClosureAlerts(): "Doesn't fit the working diagnosis" when a recorded finding
 *    contradicts the confirmed diagnosis or favours another one, when the record now favours
 *    another diagnosis strongly, or when NEWS2 is rising.
 *  - diagnosticTimeOut(): a gentle checklist when the case is complex.
 *
 * Everything is a suggestion for the clinician; nothing is added to the record by this module.
 * Thresholds and wording are registered (clinical-content/registry.json,
 * `diagnostic-reasoning-rules`) and await the surgeon's sign-off.
 */

export const DIAGNOSTIC_REASONING_VERSION = '1.0.0';

export const REASONING_THRESHOLDS = {
  /** A present finding with LR ≥ this supports the hypothesis. */
  supportLr: 1.5,
  /** A present (or documented-absent) finding with LR ≤ this argues against it. */
  againstLr: 0.67,
  /** A finding "favours" another hypothesis when its LR there is ≥ this. */
  favourLr: 2,
  /** A hypothesis with no supporting finding of LR ≥ this is shown as "low evidence". */
  lowEvidenceLr: 2,
  /** Premature-closure alert: a finding against the working diagnosis with LR ≤ this. */
  strongContradictionLr: 0.5,
  /** Premature-closure alert: an unexplained finding favouring another diagnosis with LR ≥ this. */
  strongFavourLr: 3,
  /** Premature-closure alert: the leader is at least this many times more probable… */
  lessLikelyRatio: 3,
  /** …and at least this probable. */
  lessLikelyMinLeader: 0.2,
  /** NEWS2 rise (latest minus the lowest earlier reading) that raises an alert… */
  news2RiseMin: 2,
  /** …when the latest NEWS2 is at least this. */
  news2AlertMin: 3,
  /** Diagnostic time-out: this many recorded findings unexplained by the leading diagnoses. */
  unexplainedTimeOut: 3,
  /** Expected information gain (nats) below which a probe is not offered. */
  minGain: 0.01,
  /** At most this many premature-closure alerts. */
  maxClosureAlerts: 4,
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export type FindingStatus = 'present' | 'absent' | 'unknown';

export interface ReasoningFinding {
  id: string;
  label: string;
  status: FindingStatus;
}

/** How one hypothesis sees one finding (from the engine's own evidence). */
export interface FindingWeight {
  /** Likelihood ratio when the finding is present. */
  lrPresent: number;
  /** Likelihood ratio when the finding is absent. */
  lrAbsent: number;
  /** The hypothesis models the finding (listed in its node / candidate). */
  modelled: boolean;
  /** A cardinal finding of the hypothesis (usually present and discriminating). */
  cardinal: boolean;
  /** Where the weight comes from (citation or engine module guideline). */
  source: string;
}

export interface ReasoningHypothesis {
  id: string;
  label: string;
  /** Engine probability (0–1). */
  probability: number;
  /** A time-critical diagnosis that must not be missed. */
  cantMiss: boolean;
}

export interface ReasoningInput {
  /** Ranked (most probable first). */
  hypotheses: ReasoningHypothesis[];
  findings: ReasoningFinding[];
  /** hypothesis id → finding id → weight. A missing entry is an unmodelled finding (LR 1). */
  weights: Record<string, Record<string, FindingWeight>>;
}

export interface EvidenceLine {
  findingId: string;
  label: string;
  /** LR of the finding's recorded status for this hypothesis (LR− for absent / not recorded). */
  lr: number;
  source: string;
  /** For absent and missing findings: true when documented absent, false when not recorded. */
  documented: boolean;
  /** Another hypothesis this finding favours (its LR there ≥ favourLr), or null. */
  favours: string | null;
  favoursLr: number | null;
}

export interface Explanation {
  hypothesisId: string;
  label: string;
  probability: number;
  forFindings: EvidenceLine[];
  against: EvidenceLine[];
  missing: EvidenceLine[];
  doesntFit: EvidenceLine[];
  /** No recorded finding supports it with LR ≥ lowEvidenceLr. */
  lowEvidence: boolean;
}

const UNMODELLED: FindingWeight = { lrPresent: 1, lrAbsent: 1, modelled: false, cardinal: false, source: '' };

export function weightOf(input: ReasoningInput, hypothesisId: string, findingId: string): FindingWeight {
  return input.weights[hypothesisId]?.[findingId] ?? UNMODELLED;
}

/** The hypothesis (other than `excludeId`) in which a present finding has the highest LR ≥ favourLr. */
export function favouredBy(
  input: ReasoningInput, findingId: string, excludeId: string | null,
): { id: string; label: string; lr: number } | null {
  let best: { id: string; label: string; lr: number } | null = null;
  for (const h of input.hypotheses) {
    if (h.id === excludeId) continue;
    const lr = weightOf(input, h.id, findingId).lrPresent;
    if (lr >= REASONING_THRESHOLDS.favourLr && (best === null || lr > best.lr)) best = { id: h.id, label: h.label, lr };
  }
  return best;
}

function sortStable<T>(items: T[], cmp: (a: T, b: T) => number): T[] {
  return items.map((item, i) => ({ item, i }))
    .sort((a, b) => cmp(a.item, b.item) || a.i - b.i)
    .map(x => x.item);
}

/** For / against / missing / doesn't fit for one hypothesis. */
export function explain(input: ReasoningInput, hypothesisId: string): Explanation {
  const T = REASONING_THRESHOLDS;
  const hyp = input.hypotheses.find(h => h.id === hypothesisId);
  const forFindings: EvidenceLine[] = [];
  const against: EvidenceLine[] = [];
  const missing: EvidenceLine[] = [];
  const doesntFit: EvidenceLine[] = [];
  for (const f of input.findings) {
    const w = weightOf(input, hypothesisId, f.id);
    const line = (lr: number, documented: boolean): EvidenceLine => {
      const fav = f.status === 'present' ? favouredBy(input, f.id, hypothesisId) : null;
      return {
        findingId: f.id, label: f.label, lr, source: w.source, documented,
        favours: fav ? fav.label : null, favoursLr: fav ? fav.lr : null,
      };
    };
    if (f.status === 'present') {
      if (w.lrPresent >= T.supportLr) forFindings.push(line(w.lrPresent, true));
      else if (w.lrPresent <= T.againstLr) against.push(line(w.lrPresent, true));
      else {
        const l = line(w.lrPresent, true);
        const explainedByAnyone = input.hypotheses.some(h => weightOf(input, h.id, f.id).lrPresent >= T.supportLr);
        if (l.favours !== null || !explainedByAnyone) doesntFit.push(l);
      }
    } else if (f.status === 'absent') {
      if (w.cardinal) missing.push(line(w.lrAbsent, true));
      else if (w.lrAbsent <= T.againstLr) against.push(line(w.lrAbsent, true));
    } else if (w.cardinal) {
      missing.push(line(w.lrAbsent, false));
    }
  }
  return {
    hypothesisId,
    label: hyp?.label ?? hypothesisId,
    probability: hyp?.probability ?? 0,
    forFindings: sortStable(forFindings, (a, b) => b.lr - a.lr),
    against: sortStable(against, (a, b) => a.lr - b.lr),
    missing: sortStable(missing, (a, b) => (a.documented === b.documented ? a.lr - b.lr : a.documented ? -1 : 1)),
    doesntFit: sortStable(doesntFit, (a, b) => (b.favoursLr ?? 0) - (a.favoursLr ?? 0)),
    lowEvidence: !forFindings.some(e => e.lr >= T.lowEvidenceLr),
  };
}

/** Present findings that none of `hypothesisIds` supports (LR ≥ supportLr), in record order. */
export function unexplainedFindings(input: ReasoningInput, hypothesisIds: string[]): string[] {
  return input.findings
    .filter(f => f.status === 'present')
    .filter(f => !hypothesisIds.some(h => weightOf(input, h, f.id).lrPresent >= REASONING_THRESHOLDS.supportLr))
    .map(f => f.label);
}

// ── Information gain ──────────────────────────────────────────────────────────

/** Shannon entropy in nats (terms with p ≤ 0 are skipped), as pane-engine infoGain.ts. */
export function entropy(p: number[]): number {
  let h = 0;
  for (const x of p) if (x > 0) h -= x * Math.log(x);
  return h;
}

/**
 * Expected entropy reduction (nats) over `priors` (normalised here) from observing a finding with
 * P(present | hypothesis i) = pPositive[i]. Equal to pane-engine's informationGain on a state that
 * holds only these hypotheses.
 */
export function expectedInformationGain(priors: number[], pPositive: number[]): number {
  const total = priors.reduce((s, x) => s + x, 0);
  if (total <= 0 || priors.length !== pPositive.length) return 0;
  const q = priors.map(x => x / total);
  const pPos = q.reduce((s, x, i) => s + x * pPositive[i], 0);
  const pNeg = 1 - pPos;
  const post = (present: boolean): number[] => {
    const raw = q.map((x, i) => x * (present ? pPositive[i] : 1 - pPositive[i]));
    const t = raw.reduce((s, x) => s + x, 0);
    return t > 0 ? raw.map(x => x / t) : raw;
  };
  return entropy(q) - (pPos * entropy(post(true)) + pNeg * entropy(post(false)));
}

/**
 * Probabilities after a positive / negative result. `priors` need not sum to 1: the remainder is
 * the rest of the differential, with P(present) = residualPPositive.
 */
export function postTest(
  priors: number[], pPositive: number[], residualPPositive: number,
): { ifPositive: number[]; ifNegative: number[] } {
  const residual = Math.max(0, 1 - priors.reduce((s, x) => s + x, 0));
  const pPos = priors.reduce((s, x, i) => s + x * pPositive[i], 0) + residual * residualPPositive;
  const pNeg = 1 - pPos;
  return {
    ifPositive: priors.map((x, i) => (pPos > 0 ? (x * pPositive[i]) / pPos : 0)),
    ifNegative: priors.map((x, i) => (pNeg > 0 ? (x * (1 - pPositive[i])) / pNeg : 0)),
  };
}

// ── Probe cost ────────────────────────────────────────────────────────────────

export type ProbeKind = 'history' | 'symptom' | 'sign' | 'investigation';
export type ProbeCost = 'ask' | 'bedside' | 'lab' | 'imaging' | 'advanced';

/** Relative preference: cheap and bedside first. */
export const PROBE_COST_WEIGHT: Record<ProbeCost, number> = { ask: 1, bedside: 1, lab: 0.85, imaging: 0.6, advanced: 0.35 };

/**
 * Terms (lower case) for investigation cost tiers. A trailing "*" is a prefix (word start only);
 * otherwise the term must be a whole word or phrase. Checked in this order: advanced, imaging,
 * bedside; anything else is a laboratory test.
 */
export const PROBE_COST_TERMS: { cost: ProbeCost; terms: string[] }[] = [
  { cost: 'advanced', terms: ['ct', 'ctpa', 'cect', 'computed tomography', 'mri', 'mrcp', 'magnetic resonance', 'endoscop*',
    'ogd', 'gastroscop*', 'colonoscop*', 'sigmoidoscop*', 'ercp', 'eus', 'angiogra*', 'laparoscop*', 'biops*', 'hida',
    'scintigra*', 'lumbar puncture', 'csf', 'pet'] },
  { cost: 'imaging', terms: ['us', 'uss', 'ultrasound', 'ultrasonograph*', 'sonograph*', 'doppler', 'x-ray', 'xray',
    'radiograph*', 'cxr', 'axr', 'echocardiogra*', 'echo', 'fast', 'efast'] },
  { cost: 'bedside', terms: ['ecg', 'ekg', 'dipstick', 'urinalysis', 'urine', 'capillary', 'cbg', 'bedside', 'pregnancy test',
    'hcg', 'bhcg', 'peak flow', 'glucose', 'ketone*', 'blood gas', 'abg', 'vbg'] },
];

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && /[\p{L}\p{N}]/u.test(ch);
}

/** Term found in `text` at a word start; whole word unless the term ends with "*". */
export function hasTerm(text: string, term: string): boolean {
  const lower = text.toLowerCase();
  const prefix = term.endsWith('*');
  const t = prefix ? term.slice(0, -1) : term;
  if (!t) return false;
  for (let i = lower.indexOf(t); i !== -1; i = lower.indexOf(t, i + 1)) {
    if (isWordChar(lower[i - 1])) continue;
    if (!prefix && isWordChar(lower[i + t.length])) continue;
    return true;
  }
  return false;
}

export function classifyProbeCost(kind: ProbeKind, text: string): ProbeCost {
  if (kind === 'history' || kind === 'symptom') return 'ask';
  if (kind === 'sign') return 'bedside';
  for (const tier of PROBE_COST_TERMS) {
    if (tier.terms.some(t => hasTerm(text, t))) return tier.cost;
  }
  return 'lab';
}

export interface ProbeCandidate {
  id: string;
  label: string;
  kind: ProbeKind;
  cost: ProbeCost;
  /** Expected information gain (nats) over the hypotheses being separated. */
  gain: number;
}

export interface RankedProbe extends ProbeCandidate {
  score: number;
}

/**
 * Best discriminators: gain ≥ minGain, weighted by cost (cheap and bedside first). CT, MRI,
 * endoscopy and other advanced tests are offered only when a can't-miss diagnosis is among the
 * hypotheses being separated.
 */
export function rankDiscriminators(candidates: ProbeCandidate[], cantMissInTop: boolean, limit = 3): RankedProbe[] {
  return candidates
    .filter(c => c.gain >= REASONING_THRESHOLDS.minGain)
    .filter(c => c.cost !== 'advanced' || cantMissInTop)
    .map(c => ({ ...c, score: c.gain * PROBE_COST_WEIGHT[c.cost] }))
    .sort((a, b) => b.score - a.score || b.gain - a.gain || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .slice(0, limit);
}

export function pct(p: number): number {
  return Math.round(p * 100);
}

/** "42%", with "<1%" and ">99%" at the ends: the engine is never shown as certain. */
export function fmtPct(p: number): string {
  if (p >= 0.995) return '>99%';
  if (p < 0.005) return '<1%';
  return `${pct(p)}%`;
}

/** "elevated WBC" for "Elevated WBC"; acronyms ("CRP raised") are kept. */
export function lowerFirst(label: string): string {
  if (label.length > 1 && label[1] >= 'A' && label[1] <= 'Z') return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/** "12", "3.4", "0.25": LR for display. */
export function formatLr(lr: number): string {
  // Round half up first (Math.round / Swift .rounded()), then print: toFixed and printf could
  // break an exact tie differently.
  if (lr >= 10) return String(Math.round(lr));
  if (lr >= 1) return (Math.round(lr * 10) / 10).toFixed(1);
  return (Math.round(lr * 100) / 100).toFixed(2);
}

export interface PostTestLine {
  label: string;
  before: number;
  ifPositive: number;
  ifNegative: number;
}

/**
 * Why this probe: "If positive: A 30% → 80%, B 25% → 6%. If negative: A → 5%." (investigations);
 * "If present / If absent" for questions and signs. A is the diagnosis a positive result raises
 * most, B the one it lowers most.
 */
export function discriminatorWhy(kind: ProbeKind, lines: PostTestLine[]): string {
  if (lines.length === 0) return '';
  const pos = kind === 'investigation' ? 'positive' : 'present';
  const neg = kind === 'investigation' ? 'negative' : 'absent';
  let up = lines[0];
  let down = lines[0];
  for (const l of lines) {
    if (l.ifPositive - l.before > up.ifPositive - up.before) up = l;
    if (l.ifPositive - l.before < down.ifPositive - down.before) down = l;
  }
  let text = `If ${pos}: ${up.label} ${fmtPct(up.before)} → ${fmtPct(up.ifPositive)}`;
  if (down !== up && pct(down.ifPositive) < pct(down.before)) {
    text += `, ${down.label} ${fmtPct(down.before)} → ${fmtPct(down.ifPositive)}`;
  }
  text += `. If ${neg}: ${up.label} → ${fmtPct(up.ifNegative)}.`;
  return text;
}

// ── Premature closure ─────────────────────────────────────────────────────────

export type ClosureKind = 'contradicting-finding' | 'unexplained-finding' | 'less-likely' | 'news2-rising';

export interface ClosureAlert {
  /** Stable key for dismissal. */
  key: string;
  kind: ClosureKind;
  finding: string | null;
  favours: string | null;
  lr: number | null;
  text: string;
}

/**
 * "Doesn't fit the working diagnosis" alerts. `workingId` is the working diagnosis's hypothesis id
 * in `input` (null when the engine does not model it; then only the NEWS2 rule can fire).
 * `news2Series` is chronological (oldest first).
 */
export function prematureClosureAlerts(
  input: ReasoningInput, workingId: string | null, workingLabel: string, news2Series: number[],
): ClosureAlert[] {
  const T = REASONING_THRESHOLDS;
  if (!workingLabel.trim()) return [];
  const out: ClosureAlert[] = [];
  const working = workingId ? input.hypotheses.find(h => h.id === workingId) ?? null : null;
  if (working) {
    const ex = explain(input, working.id);
    for (const e of ex.against) {
      if (e.lr > T.strongContradictionLr) continue;
      const finding = input.findings.find(f => f.id === e.findingId)?.status === 'absent' ? `no ${lowerFirst(e.label)}` : e.label;
      out.push({
        key: `contradicting-finding:${e.findingId}`, kind: 'contradicting-finding', finding, favours: e.favours, lr: e.lr,
        text: `Doesn't fit the working diagnosis: ${finding} argues against ${working.label} (LR ${formatLr(e.lr)})`
          + (e.favours ? ` — favours ${e.favours}.` : '.'),
      });
    }
    for (const e of ex.missing) {
      if (!e.documented || e.lr > T.strongContradictionLr) continue;
      out.push({
        key: `contradicting-finding:${e.findingId}`, kind: 'contradicting-finding', finding: `no ${lowerFirst(e.label)}`, favours: null, lr: e.lr,
        text: `Doesn't fit the working diagnosis: no ${lowerFirst(e.label)}, expected in ${working.label} (LR ${formatLr(e.lr)}).`,
      });
    }
    for (const e of ex.doesntFit) {
      if (e.favours === null || e.favoursLr === null || e.favoursLr < T.strongFavourLr) continue;
      out.push({
        key: `unexplained-finding:${e.findingId}`, kind: 'unexplained-finding', finding: e.label, favours: e.favours, lr: e.favoursLr,
        text: `Doesn't fit the working diagnosis: ${e.label} is not explained by ${working.label} — favours ${e.favours} (LR ${formatLr(e.favoursLr)}).`,
      });
    }
    const leader = input.hypotheses.find(h => h.id !== working.id) ?? null;
    if (leader && leader.probability >= T.lessLikelyMinLeader && leader.probability >= T.lessLikelyRatio * working.probability) {
      out.push({
        key: `less-likely:${leader.id}`, kind: 'less-likely', finding: null, favours: leader.label, lr: null,
        text: `The record now favours ${leader.label} (${fmtPct(leader.probability)}) over ${working.label} (${fmtPct(working.probability)}).`,
      });
    }
  }
  if (news2Series.length >= 2) {
    const last = news2Series[news2Series.length - 1];
    const lowest = Math.min(...news2Series.slice(0, -1));
    if (last - lowest >= T.news2RiseMin && last >= T.news2AlertMin) {
      const alt = input.hypotheses.find(h => h.cantMiss && h.id !== workingId) ?? null;
      out.push({
        key: `news2-rising:${lowest}-${last}`, kind: 'news2-rising', finding: `NEWS2 ${lowest} → ${last}`, favours: alt ? alt.label : null, lr: null,
        text: `NEWS2 rising (${lowest} → ${last}): is ${working ? working.label : workingLabel} still the whole story?`
          + (alt ? ` Consider ${alt.label}.` : ''),
      });
    }
  }
  const seen = new Set<string>();
  return out.filter(a => (seen.has(a.key) ? false : (seen.add(a.key), true))).slice(0, T.maxClosureAlerts);
}

// ── Diagnostic time-out ───────────────────────────────────────────────────────

export const TIME_OUT_CHECKLIST: string[] = [
  'What is the worst thing this could be, and has it been excluded?',
  "Does every recorded finding fit the working diagnosis? Name the ones that don't.",
  'What was assumed rather than confirmed (referral label, earlier diagnosis, first impression)?',
  'Could there be two conditions rather than one?',
  'What result would change my mind, and has it been looked for?',
  'Would a colleague seeing this afresh agree?',
];

export const TIME_OUT_SOURCES = [
  'Croskerry P. The importance of cognitive errors in diagnosis and strategies to minimize them. Acad Med 2003;78:775-780.',
  'Ely JW, Graber ML, Croskerry P. Checklists to reduce diagnostic errors. Acad Med 2011;86:307-313.',
  'Graber ML et al. Cognitive interventions to reduce diagnostic error: a narrative review. BMJ Qual Saf 2012;21:535-557.',
];

export interface TimeOutInput {
  /** Recorded findings the leading diagnoses do not explain. */
  unexplainedFindings: string[];
  /** Earlier visits for the same complaint. */
  priorVisitsSameComplaint: number;
  /** Diagnoses recorded at those visits (empty strings allowed). */
  priorDiagnosesSameComplaint: string[];
}

export interface TimeOutResult {
  suggested: boolean;
  reasons: string[];
  checklist: string[];
}

export function diagnosticTimeOut(input: TimeOutInput): TimeOutResult {
  const reasons: string[] = [];
  const n = input.unexplainedFindings.length;
  if (n >= REASONING_THRESHOLDS.unexplainedTimeOut) {
    reasons.push(`${n} recorded findings are not explained by the leading diagnoses (${input.unexplainedFindings.slice(0, 3).join(', ')}).`);
  }
  if (input.priorVisitsSameComplaint >= 1) {
    const dx: string[] = [];
    for (const d of input.priorDiagnosesSameComplaint) {
      const t = d.trim();
      if (t && !dx.some(x => x.toLowerCase() === t.toLowerCase())) dx.push(t);
    }
    const visit = input.priorVisitsSameComplaint + 1;
    if (dx.length === 0) reasons.push(`Visit ${visit} for the same complaint without a diagnosis recorded before.`);
    else if (dx.length >= 2) reasons.push(`Visit ${visit} for the same complaint with changing diagnoses (${dx.join(', ')}).`);
  }
  return { suggested: reasons.length > 0, reasons, checklist: reasons.length > 0 ? TIME_OUT_CHECKLIST : [] };
}
