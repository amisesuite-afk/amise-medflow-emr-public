/**
 * Proposed model adjustments from local outcomes (empirical Bayes, shrunk towards the current
 * values). For the surgeon's review only: the output is a reviewable diff (JSON + Markdown).
 * NOTHING HERE IS EVER APPLIED AUTOMATICALLY (docs/CLINICAL-CONTENT-UPGRADES.md §4.6).
 *
 * Priors (Dirichlet → Beta marginal). With the current prior shares p_d (the model's relative
 * base rates normalised over its diseases) as the Dirichlet mean and a concentration α, the
 * posterior share of disease d after n_d of N confirmed cases is
 *     (α·p_d + n_d) / (α + N),   marginally Beta(α·p_d + n_d, α·(1 − p_d) + N − n_d).
 * A proposal is made only when n_d ≥ the minimum count, the 95% credible interval excludes the
 * current share, and the proposed tier differs from the current tier.
 *
 * Likelihoods (Beta). For P(feature present | disease) = θ (the model's value), with κ pseudo-
 * cases: after k present in m recorded cases with that final diagnosis, the posterior is
 * Beta(κ·θ + k, κ·(1 − θ) + m − k). A proposal is made only when m ≥ the minimum count, the
 * 95% interval excludes θ and the change is at least `minLikelihoodChange`.
 *
 * Caveats written into every output: verified diagnoses over-represent operated cases; a
 * feature is recorded only when it was asked, so absent answers are not missing at random.
 */

import { betaInterval, round } from './stats';
import type { Interval } from './stats';
import type { OutcomeCase } from './types';

export interface ShrinkageModel {
  engine: string;
  modelVersion: string;
  /** Raw prior per disease id (the model's own scale). */
  priors: Record<string, number>;
  /** Named tiers on the raw scale ({ common: 0.03, … }); a proposal names the nearest tier. */
  tiers?: Record<string, number>;
  /** P(feature present | disease) the model uses now (derived or explicit). */
  likelihood(diseaseId: string, featureId: string): number | null;
  /** Background rate of the feature, to express a likelihood as an LR against the background. */
  baseRate?(featureId: string): number | null;
  /** Map an ICD-10 code to a disease id when the final diagnosis carries no id. */
  diseaseForIcd?(icd10: string): string | null;
}

export interface ShrinkageOptions {
  /** Dirichlet concentration for the priors (pseudo-cases). */
  priorConcentration: number;
  /** Beta pseudo-cases for each likelihood. */
  likelihoodPseudoCases: number;
  minCasesPrior: number;
  minCasesLikelihood: number;
  /** Smallest absolute change of a likelihood worth proposing. */
  minLikelihoodChange: number;
}

/** Defaults recorded for sign-off in SURGEON-DECISIONS.md I2. */
export const DEFAULT_SHRINKAGE_OPTIONS: ShrinkageOptions = {
  priorConcentration: 200,
  likelihoodPseudoCases: 20,
  minCasesPrior: 10,
  minCasesLikelihood: 20,
  minLikelihoodChange: 0.1,
};

export interface PriorProposal {
  diseaseId: string;
  cases: number;
  totalCases: number;
  currentPrior: number;
  currentTier: string | null;
  currentShare: number;
  observedShare: number;
  proposedShare: number;
  shareInterval: Interval;
  proposedPrior: number;
  priorInterval: Interval;
  proposedTier: string | null;
  /** The proposed prior lies beyond the tier scale (more than 1.5× the highest or below the lowest ÷ 1.5). */
  beyondTiers: 'above' | 'below' | null;
}

export interface LikelihoodProposal {
  diseaseId: string;
  featureId: string;
  present: number;
  recorded: number;
  current: number;
  observed: number;
  proposed: number;
  interval: Interval;
  currentLrVsBackground: number | null;
  proposedLrVsBackground: number | null;
}

export interface ProposalSet {
  status: 'PROPOSAL — not applied; requires the surgeon\'s sign-off';
  generatedAt: string;
  engine: string;
  modelVersion: string;
  casesUsed: number;
  options: ShrinkageOptions;
  priors: PriorProposal[];
  likelihoods: LikelihoodProposal[];
  caveats: string[];
}

function nearestTier(value: number, tiers: Record<string, number> | undefined): string | null {
  if (!tiers) return null;
  let best: string | null = null;
  let bestD = Infinity;
  for (const [name, v] of Object.entries(tiers)) {
    if (v <= 0 || value <= 0) continue;
    const d = Math.abs(Math.log(value) - Math.log(v));
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
}

function beyond(value: number, tiers: Record<string, number> | undefined): 'above' | 'below' | null {
  const vals = Object.values(tiers ?? {}).filter(v => v > 0);
  if (!vals.length) return null;
  if (value > Math.max(...vals) * 1.5) return 'above';
  if (value < Math.min(...vals) / 1.5) return 'below';
  return null;
}

function finalDiseaseId(c: OutcomeCase, model: ShrinkageModel): string | null {
  const id = c.outcome.finalDiseaseId ?? model.diseaseForIcd?.(c.outcome.finalIcd10) ?? null;
  return id && id in model.priors ? id : null;
}

export function proposeAdjustments(
  cases: OutcomeCase[], model: ShrinkageModel, opts: Partial<ShrinkageOptions> & { now: Date },
): ProposalSet {
  const o: ShrinkageOptions = { ...DEFAULT_SHRINKAGE_OPTIONS };
  for (const k of Object.keys(DEFAULT_SHRINKAGE_OPTIONS) as (keyof ShrinkageOptions)[]) {
    const v = opts[k];
    if (typeof v === 'number' && Number.isFinite(v)) o[k] = v;
  }
  const usable = cases
    .map(c => ({ c, d: finalDiseaseId(c, model) }))
    .filter((x): x is { c: OutcomeCase; d: string } => x.d !== null);
  const N = usable.length;

  // ── Priors ──
  const sumPrior = Object.values(model.priors).reduce((a, b) => a + b, 0);
  const counts = new Map<string, number>();
  for (const { d } of usable) counts.set(d, (counts.get(d) ?? 0) + 1);
  const priors: PriorProposal[] = [];
  if (sumPrior > 0 && N > 0) {
    for (const [d, n] of [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
      if (n < o.minCasesPrior) continue;
      const current = model.priors[d];
      const share = current / sumPrior;
      const a = o.priorConcentration * share + n;
      const b = o.priorConcentration * (1 - share) + (N - n);
      const proposedShare = a / (a + b);
      const ci = betaInterval(a, b);
      if (share >= ci.low && share <= ci.high) continue;
      const proposedPrior = proposedShare * sumPrior;
      const currentTier = nearestTier(current, model.tiers);
      const proposedTier = nearestTier(proposedPrior, model.tiers);
      if (model.tiers && currentTier === proposedTier) continue;
      priors.push({
        diseaseId: d, cases: n, totalCases: N,
        currentPrior: current, currentTier, currentShare: round(share, 6), observedShare: round(n / N, 6),
        proposedShare: round(proposedShare, 6), shareInterval: { low: round(ci.low, 6), high: round(ci.high, 6) },
        proposedPrior: round(proposedPrior, 6),
        priorInterval: { low: round(ci.low * sumPrior, 6), high: round(ci.high * sumPrior, 6) },
        proposedTier,
        beyondTiers: beyond(proposedPrior, model.tiers),
      });
    }
  }

  // ── Likelihoods ──
  const cells = new Map<string, { d: string; f: string; k: number; m: number }>();
  for (const { c, d } of usable) {
    for (const [f, present] of Object.entries(c.snapshot.features)) {
      const key = `${d}|${f}`;
      let cell = cells.get(key);
      if (!cell) { cell = { d, f, k: 0, m: 0 }; cells.set(key, cell); }
      cell.m++;
      if (present) cell.k++;
    }
  }
  const likelihoods: LikelihoodProposal[] = [];
  for (const cell of [...cells.values()].sort((a, b) => b.m - a.m || a.d.localeCompare(b.d) || a.f.localeCompare(b.f))) {
    if (cell.m < o.minCasesLikelihood) continue;
    const theta = model.likelihood(cell.d, cell.f);
    if (theta === null || !(theta > 0 && theta < 1)) continue;
    const a = o.likelihoodPseudoCases * theta + cell.k;
    const b = o.likelihoodPseudoCases * (1 - theta) + (cell.m - cell.k);
    const proposed = a / (a + b);
    const ci = betaInterval(a, b);
    if (theta >= ci.low && theta <= ci.high) continue;
    if (Math.abs(proposed - theta) < o.minLikelihoodChange) continue;
    const bg = model.baseRate?.(cell.f) ?? null;
    likelihoods.push({
      diseaseId: cell.d, featureId: cell.f, present: cell.k, recorded: cell.m,
      current: round(theta), observed: round(cell.k / cell.m), proposed: round(proposed),
      interval: { low: round(ci.low), high: round(ci.high) },
      currentLrVsBackground: bg ? round(theta / bg, 2) : null,
      proposedLrVsBackground: bg ? round(proposed / bg, 2) : null,
    });
  }

  return {
    status: 'PROPOSAL — not applied; requires the surgeon\'s sign-off',
    generatedAt: opts.now.toISOString(),
    engine: model.engine,
    modelVersion: model.modelVersion,
    casesUsed: N,
    options: o,
    priors,
    likelihoods,
    caveats: [
      'Built only from clinician-confirmed final diagnoses: operated and biopsied cases are over-represented (verification bias), so prior shares describe this sample, not every presentation.',
      'A feature is recorded only when it was asked or found; "absent" answers are not missing at random.',
      'Shrunk towards the current value; small samples change little. Intervals are 95% equal-tailed credible intervals.',
      'Applying any line is a content change: new model version, registry changelog entry, vignette A/B run (clinval) and the surgeon\'s sign-off (docs/CLINICAL-CONTENT-UPGRADES.md §3, §4.6).',
    ],
  };
}

/** The proposals as a review diff ("-" current, "+" proposed) with counts and intervals. */
export function proposalsMarkdown(p: ProposalSet): string {
  const out: string[] = [];
  out.push(`# Proposed adjustments — ${p.engine} ${p.modelVersion}`, '');
  out.push(`**${p.status}.** Generated ${p.generatedAt} from ${p.casesUsed} confirmed cases.`, '');
  out.push(`Settings: prior concentration ${p.options.priorConcentration}, likelihood pseudo-cases ${p.options.likelihoodPseudoCases}, minimum ${p.options.minCasesPrior} cases per prior and ${p.options.minCasesLikelihood} per likelihood, minimum likelihood change ${p.options.minLikelihoodChange}.`, '');
  for (const c of p.caveats) out.push(`- ${c}`);
  out.push('', '## Prior tiers', '');
  if (p.priors.length === 0) out.push('No proposal: no disease reached the minimum count with a credible change of tier.');
  else {
    out.push('```diff');
    for (const x of p.priors) {
      out.push(`- ${x.diseaseId}.prior = ${x.currentPrior}${x.currentTier ? ` (${x.currentTier})` : ''}   share ${x.currentShare}`);
      out.push(`+ ${x.diseaseId}.prior = ${x.proposedPrior}${x.proposedTier ? ` (${x.proposedTier})` : ''}   share ${x.proposedShare} [95% CrI ${x.shareInterval.low}–${x.shareInterval.high}]; observed ${x.cases}/${x.totalCases} = ${x.observedShare}${x.beyondTiers ? `; ${x.beyondTiers} the tier scale — check the sample (verification bias) before any change` : ''}`);
    }
    out.push('```');
  }
  out.push('', '## Likelihoods P(feature | disease)', '');
  if (p.likelihoods.length === 0) out.push('No proposal: no disease–feature pair reached the minimum count with a credible change.');
  else {
    out.push('```diff');
    for (const x of p.likelihoods) {
      out.push(`- ${x.diseaseId}.features.${x.featureId} = ${x.current}${x.currentLrVsBackground !== null ? `   (LR vs background ${x.currentLrVsBackground})` : ''}`);
      out.push(`+ ${x.diseaseId}.features.${x.featureId} = ${x.proposed} [95% CrI ${x.interval.low}–${x.interval.high}]; observed ${x.present}/${x.recorded} = ${x.observed}${x.proposedLrVsBackground !== null ? `   (LR vs background ${x.proposedLrVsBackground})` : ''}`);
    }
    out.push('```');
  }
  out.push('', '## Sign-off', '', '| Line | Approve / reject | Reviewer | Date |', '|---|---|---|---|');
  for (const x of p.priors) out.push(`| ${x.diseaseId}.prior | | | |`);
  for (const x of p.likelihoods) out.push(`| ${x.diseaseId}.features.${x.featureId} | | | |`);
  return out.join('\n') + '\n';
}
