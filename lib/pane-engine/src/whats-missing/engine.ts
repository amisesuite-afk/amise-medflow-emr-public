/**
 * "What's missing" — one ranked, de-duplicated list of the gaps the engines already know about.
 *
 * Signals (each from an engine that already exists; nothing new is inferred):
 *   safety    allergy status not recorded; weight under 16; pregnancy status (female 12–55) with
 *             ionising imaging, prescribing or a procedure in play; eGFR / creatinine before a
 *             renally cleared or NSAID drug or iodinated contrast; the supplements question and the
 *             anticoagulant's last dose before a procedure
 *   decision  the decision layer's missing inputs whose adverse probe flips a band
 *             (decision-probe.ts), a risk score the decision needs, the NG12 / BSG ferritin prompt,
 *             the reasoning panel's best next discriminator (while no diagnosis is confirmed)
 *   score     NEWS2 parameters not recorded, record inputs of the recommended / recorded scores
 *             (record-fill.ts), decision inputs that refine but do not flip, and the best next
 *             discriminator once a working diagnosis is confirmed
 *
 * Ranking (explainable, lexicographic):
 *   1. tier: safety (cannot prescribe or dose safely without it) → decision → score completeness;
 *   2. within safety: fixed order (weight under 16, allergy, pregnancy, renal function, anticoagulant
 *      last dose, supplements); within decision: a band flip (closest to its threshold first) → a
 *      missing risk score → ferritin → the best next discriminator; within score: the input needed
 *      by the most scores first;
 *   3. the rule file's group order.
 * De-duplication: signals sharing a group (the same field or the same test: urea for BISAP and
 * Glasgow-Blatchford, eGFR for a NSAID and for the cholecystitis decision) become one item with the
 * best tier; the other reasons are kept in `also`.
 *
 * Suggestions only: an item's action jumps to a field or adds a test as *suggested*; nothing is
 * ordered or recorded automatically. Swift twin: ios/AmiseMedFlow/Services/WhatsMissingCore.swift.
 */

import { lowerFirst } from '../decision/engine.js';
import { FILLABLE_SCORES, missingObservations, scoreRecordFill } from './record-fill.js';
import { WHATS_MISSING_RULES } from './rules.js';
import type { MissingGroupRule, MissingRules } from './rules.js';
import type {
  MissingAction, MissingTier, WhatsMissingInput, WhatsMissingItem, WhatsMissingResult,
} from './types.js';

const TIER_INDEX: Record<MissingTier, number> = { safety: 0, decision: 1, score: 2 };

// ── Text helpers (identical on iOS) ────────────────────────────────────────────────────────

function isWordChar(c: string | undefined): boolean {
  return c !== undefined && /[\p{L}\p{N}]/u.test(c);
}

/**
 * `term` in `text` at a word start (case-insensitive); a term of 4 characters or fewer must also
 * end at a word boundary ("ct" is "CT abdomen", never "act"; "tia" never "initial").
 */
export function termIn(text: string, term: string): boolean {
  const t = text.toLowerCase();
  const k = term.toLowerCase();
  if (!k) return false;
  for (let i = t.indexOf(k); i !== -1; i = t.indexOf(k, i + 1)) {
    if (isWordChar(t[i - 1]) && isWordChar(k[0])) continue;
    if (k.length <= 4 && isWordChar(t[i + k.length]) && isWordChar(k[k.length - 1])) continue;
    return true;
  }
  return false;
}

/** The terms found in any of `texts`, in the order of `terms`. */
export function termsFound(texts: string[], terms: string[]): string[] {
  return terms.filter(term => texts.some(x => termIn(x, term)));
}

/** "a", "a and b", "a, b and c". */
export function joinParts(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function capitalise(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? '');
}

// ── Signals ────────────────────────────────────────────────────────────────────────────────

interface Signal {
  group: string;
  tier: MissingTier;
  /** Order inside the tier (safety order; decision: 0 flip, 1 risk score, 2 ferritin, 3 discriminator; score: 0 gap, 1 refine, 2 discriminator after confirmation). */
  sub: number;
  /** Decision flip: distance to the threshold (smaller first). */
  secondary: number;
  parts: string[];
  why: string;
  source: string;
  /** Score-tier signals from a score: its label (merged into one "Needed for …" reason). */
  scoreLabel?: string;
  what?: string;
  action?: MissingAction;
}

function groupRule(rules: MissingRules, id: string): MissingGroupRule | undefined {
  return rules.groups.find(g => g.id === id);
}

function groupOrder(rules: MissingRules, id: string): number {
  const i = rules.groups.findIndex(g => g.id === id);
  if (i >= 0) return i;
  return id.startsWith('score:') ? rules.groups.length : rules.groups.length + 1;
}

function conceptPart(rules: MissingRules, concept: string): { group: string; part: string } | null {
  const c = rules.concepts.find(x => x.id === concept);
  return c ? { group: c.group, part: c.part } : null;
}

function scoreLabel(rules: MissingRules, key: string): string {
  return rules.scores.find(s => s.id === key)?.label ?? key;
}

function safetySignals(input: WhatsMissingInput, rules: MissingRules): Signal[] {
  const { record: r, facts } = input;
  const th = rules.thresholds;
  const tx = rules.text;
  const out: Signal[] = [];
  const s = (group: string, why: string, parts: string[] = []): Signal => ({
    group, tier: 'safety', sub: groupRule(rules, group)?.safetyOrder ?? 9, secondary: 0, parts, why, source: 'safety',
  });
  const age = r.ageYears;
  if (age !== null && age < th.weightAgeBelow && r.weightKg === null) {
    out.push(s('weight', fill(tx.weightWhy, { age: String(th.weightAgeBelow) }), ['weight']));
  }
  if (!facts.allergyStatusRecorded) out.push(s('allergy', tx.allergyWhy));
  const imaging = facts.plannedInvestigations.find(n => rules.terms.ionisingImaging.some(t => termIn(n, t))) ?? null;
  if (r.sex === 'female' && age !== null && age >= th.pregnancyAgeMin && age <= th.pregnancyAgeMax
    && !facts.pregnancyStatusRecorded && (imaging !== null || facts.plannedMedications.length > 0 || facts.procedurePlanned)) {
    const reason = imaging !== null ? fill(tx.pregnancyReasonImaging, { name: imaging.trim() })
      : facts.procedurePlanned ? tx.pregnancyReasonProcedure : tx.pregnancyReasonDrugs;
    out.push(s('pregnancy', fill(tx.pregnancyWhy, { age: String(age), reason })));
  }
  const renalKnown = r.labs.egfr !== null || r.labs.creatinine !== null;
  if (!renalKnown) {
    const drugs = termsFound([...facts.medications, ...facts.plannedMedications], rules.terms.renalDrugs);
    const contrast = facts.plannedInvestigations.some(n => rules.terms.contrast.some(t => termIn(n, t)));
    if (drugs.length) out.push(s('renal', fill(tx.renalWhyDrugs, { drugs: joinParts(drugs) }), ['egfr']));
    else if (contrast) out.push(s('renal', tx.renalWhyContrast, ['egfr']));
  }
  if (facts.procedurePlanned) {
    const anticoag = termsFound(facts.medications, rules.terms.anticoagulants);
    const notes = [facts.medicationNotes, ...facts.medications].join('\n');
    if (anticoag.length && !rules.terms.lastDose.some(t => termIn(notes, t))) {
      out.push(s('anticoag-last-dose', fill(tx.anticoagWhy, { drugs: capitalise(joinParts(anticoag)) })));
    }
    if (!facts.supplementsAsked) out.push(s('supplements', tx.supplementsWhy));
  }
  return out;
}

function conceptSignals(rules: MissingRules, concepts: string[], base: Omit<Signal, 'group' | 'parts'>): Signal[] {
  const byGroup = new Map<string, string[]>();
  for (const c of concepts) {
    const cp = conceptPart(rules, c);
    if (!cp) continue;
    const list = byGroup.get(cp.group) ?? [];
    if (!list.includes(c)) list.push(c);
    byGroup.set(cp.group, list);
  }
  return [...byGroup.entries()].map(([group, cs]) => ({ ...base, group, parts: cs }));
}

function scoreSignals(input: WhatsMissingInput, rules: MissingRules): Signal[] {
  const out: Signal[] = [];
  const r = input.record;
  const obs = missingObservations(r);
  const anyObs = obs.length < 7;
  if (anyObs && obs.length > 0) {
    out.push(...conceptSignals(rules, obs, { tier: 'score', sub: 0, secondary: 0, why: rules.text.news2PartialWhy, source: 'news2', scoreLabel: 'NEWS2' }));
  } else if (!anyObs && input.facts.acute) {
    out.push(...conceptSignals(rules, obs, { tier: 'score', sub: 0, secondary: 0, why: rules.text.news2NoneWhy, source: 'news2', scoreLabel: 'NEWS2' }));
  }
  const seen = new Set<string>(['news2']);
  for (const key of input.activeScores) {
    if (seen.has(key) || !(FILLABLE_SCORES as readonly string[]).includes(key)) continue;
    seen.add(key);
    const missing = scoreRecordFill(key, r, rules).missing;
    const label = scoreLabel(rules, key);
    out.push(...conceptSignals(rules, missing, {
      tier: 'score', sub: 0, secondary: 0, why: fill(rules.text.scoreWhy, { scores: label }), source: `score:${key}`, scoreLabel: label,
    }));
  }
  return out;
}

function decisionSignals(input: WhatsMissingInput, rules: MissingRules): Signal[] {
  const out: Signal[] = [];
  const tx = rules.text;
  const r = input.record;
  for (const g of input.decisionGaps) {
    const source = `decision:${g.decisionId}`;
    const decision = lowerFirst(g.decisionLabel);
    if (g.key.startsWith('score:')) {
      const key = g.key.slice('score:'.length);
      out.push({
        group: g.key, tier: 'decision', sub: 1, secondary: 0, parts: [], source,
        why: fill(tx.riskScoreWhy, { decision }),
        what: fill(tx.scoreWhat, { score: scoreLabel(rules, key) }),
        action: { kind: 'field', field: g.key },
      });
      continue;
    }
    const di = rules.decisionInputs.find(x => x.key === g.key);
    if (!di) continue;
    let parts: string[] = di.concept ? [di.concept] : [];
    if (g.key === 'bmi') parts = (di.concepts ?? []).filter(c => (c === 'height' ? r.heightCm : r.weightKg) === null);
    if (g.key === 'news2') {
      const obs = missingObservations(r);
      parts = obs.length ? obs : (di.concepts ?? []);
    }
    const why = g.flip
      ? fill(tx.decisionFlipWhy, {
        from: tx.bandLabels[g.flip.from] ?? g.flip.from, to: tx.bandLabels[g.flip.to] ?? g.flip.to,
        option: lowerFirst(g.flip.option), decision,
      })
      : fill(tx.decisionRefineWhy, { decision, effect: g.effect });
    out.push({
      group: di.group, tier: g.flip ? 'decision' : 'score', sub: g.flip ? 0 : 1,
      secondary: g.flip ? (g.distance ?? 1) : 0, parts, why, source,
    });
  }
  if (input.ferritinMissing) {
    out.push({ group: 'ferritin', tier: 'decision', sub: 2, secondary: 0, parts: [], why: tx.ferritinWhy, source: 'ng12' });
  }
  const d = input.discriminator;
  if (d && d.label.trim()) {
    const test = d.kind === 'lab' || d.kind === 'imaging' || d.kind === 'advanced';
    out.push({
      group: 'discriminator', tier: d.confirmed ? 'score' : 'decision', sub: d.confirmed ? 2 : 3, secondary: 0, parts: [], source: 'reasoning',
      what: fill(tx.discriminatorWhat, { label: d.label.trim() }),
      why: fill(tx.discriminatorWhy, { separates: joinParts(d.separates) }),
      action: test ? { kind: 'test', test: d.label.trim() } : { kind: 'field', field: d.kind === 'ask' ? 'history' : 'exam' },
    });
  }
  return out;
}

// ── Merge and rank ─────────────────────────────────────────────────────────────────────────

interface Ranked { item: WhatsMissingItem; key: number[] }

function signalKey(s: Signal, rules: MissingRules, scoreCount: number): number[] {
  const secondary = s.tier === 'score' && s.sub === 0 ? -scoreCount : s.secondary;
  return [TIER_INDEX[s.tier], s.sub, secondary, groupOrder(rules, s.group)];
}

function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function whatsMissing(input: WhatsMissingInput, rules: MissingRules = WHATS_MISSING_RULES): WhatsMissingResult {
  const signals = [...safetySignals(input, rules), ...decisionSignals(input, rules), ...scoreSignals(input, rules)];
  const groups: string[] = [];
  const byGroup = new Map<string, Signal[]>();
  for (const s of signals) {
    if (!byGroup.has(s.group)) { byGroup.set(s.group, []); groups.push(s.group); }
    byGroup.get(s.group)!.push(s);
  }

  const ranked: Ranked[] = groups.map(group => {
    const list = byGroup.get(group)!;
    const scoreLabels: string[] = [];
    for (const s of list) if (s.scoreLabel && !scoreLabels.includes(s.scoreLabel)) scoreLabels.push(s.scoreLabel);
    const keyed = list
      .map((s, i) => ({ s, i, key: signalKey(s, rules, scoreLabels.length) }))
      .sort((a, b) => compareKeys(a.key, b.key) || a.i - b.i);
    const best = keyed[0].s;
    const rule = groupRule(rules, group);

    // Parts: every signal's concepts, in the rule file's concept order.
    const partIds = new Set(list.flatMap(s => s.parts));
    const parts = rules.concepts.filter(c => partIds.has(c.id)).map(c => c.part);
    let what = best.what ?? rule?.what ?? group;
    if (rule?.partsWhat && parts.length) {
      what = rule.partsWhat.includes('{Parts}')
        ? fill(rule.partsWhat, { Parts: capitalise(joinParts(parts)) })
        : fill(rule.partsWhat, { parts: joinParts(parts) });
    }

    // Reasons: the score signals collapse into one "Needed for A, B" (NEWS2 keeps its own line).
    const whys: string[] = [];
    let scoreWhyAdded = false;
    const fromScores = scoreLabels.filter(l => l !== 'NEWS2');
    for (const { s } of keyed) {
      let why = s.why;
      if (s.scoreLabel && s.scoreLabel !== 'NEWS2') {
        if (scoreWhyAdded) continue;
        scoreWhyAdded = true;
        why = fill(rules.text.scoreWhy, { scores: joinParts(fromScores) });
      }
      if (!whys.includes(why)) whys.push(why);
    }
    const sources: string[] = [];
    for (const { s } of keyed) if (!sources.includes(s.source)) sources.push(s.source);

    const action: MissingAction = best.action ?? rule?.action ?? { kind: 'field', field: group };
    return {
      key: keyed[0].key,
      item: {
        id: group, tier: best.tier, what, why: whys[0], also: whys.slice(1),
        action, alt: rule?.alt ?? null, sources,
      },
    };
  });

  ranked.sort((a, b) => compareKeys(a.key, b.key));
  return { version: rules.version, topN: rules.topN, items: ranked.map(r => r.item) };
}

/** Harness lines (web.missing / ios.missing): "1. [safety] What — why". Identical on iOS. */
export function whatsMissingLines(r: WhatsMissingResult): string[] {
  return r.items.map((it, i) => `${i + 1}. [${it.tier}] ${it.what} — ${it.why}`);
}
