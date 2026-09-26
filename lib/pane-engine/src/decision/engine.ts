/**
 * Decision support engine — deterministic, evidence-cited, suggestions only.
 *
 *   1. Score → action: each recorded score's band → its guideline action (content scoreActions).
 *   2. Result → action: a resulted lab crossing a guideline threshold → its action (resultActions).
 *      (The posterior shift a result causes is computed by the platform from its own diagnosis
 *      engine's evidence path — web: PANE replay, iOS: BayesianDiagnosisEngine re-run.)
 *   3. Treatment decisions (Pauker & Kassirer, N Engl J Med 1980;302:1109): for the leading
 *      diagnoses, each option's net benefit in the diseased (B) and harm in the non-diseased (H),
 *      personalised to the patient (odds ratios on the harm, multipliers / additions on the
 *      benefit), give the thresholds
 *          treat           T   = H / (H + B)
 *          test            Tt  = ((1 − Sp)·H + R) / ((1 − Sp)·H + Se·B)
 *          test-treatment  Ttx = (Sp·H − R) / (Sp·H + (1 − Se)·B)
 *      and the band for the current probability P: Observe (P < Tt) | Test further | Treat (P ≥ Ttx).
 *      Every number is a range [low, point, high]; the band is shown at the point estimate and
 *      flagged borderline when the range reaches another band.
 *
 * Nothing here adds to the record: the UI shows suggestions and the clinician taps "Add". The
 * platform's plan-safety filter (planSafety / PlanSafetyFilter) is applied to every line shown
 * (`lineFilter`) and stays the final hard filter: an option whose plan line it withholds is
 * "not for this patient".
 *
 * Twin: ios/AmiseMedFlow/Services/BayesianDecisionEngine+Treatment*.swift. Same content JSON, same
 * vectors (ios/AmiseMedFlowTests/DecisionSupport/decision-vectors.json). Keep the arithmetic
 * order identical so both platforms produce the same numbers.
 */

import type {
  AppliedFactor, Band, DecisionContent, DecisionDef, DecisionDiagnosis, DecisionInput, DecisionPatient,
  DecisionResult, DecisionScore, DecisionSupportResult, FactorEffect, FactorId, LineFilter, Modifier,
  OptionResult, ResultActionCard, ScoreActionCard, ScoreActionSet, ScoreBand, SourceRef, TreatmentOption, Triple,
} from './types.js';

const IDENTITY: LineFilter = line => ({ text: line, withheld: false });

// ── Formatting (identical on iOS) ───────────────────────────────────────────────────────────

/** 0.953 → "95%", 0.0374 → "3.7%", 0.04 → "4%". */
export function formatPercent(p: number): string {
  const v = p * 100;
  if (v >= 10) return `${Math.round(v)}%`;
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? `${r.toFixed(0)}%` : `${r.toFixed(1)}%`;
}

/** 3 → "3", 4.5 → "4.5". */
export function formatValue(v: number): string {
  if (Number.isInteger(v)) return v.toFixed(0);
  return String(Math.round(v * 100) / 100);
}

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}
function round3t(t: Triple): Triple {
  return [round4(t[0]), round4(t[1]), round4(t[2])];
}
function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

// ── Text matching (identical on iOS) ────────────────────────────────────────────────────────

function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(/[’‘]/g, "'").replace(/[–—]/g, '-');
}

function isWordChar(c: string): boolean {
  return (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9');
}

/** The keyword occurs at a word start ("perforat" matches "perforated", not "imperforate"). */
export function keywordAt(text: string, keyword: string): boolean {
  const t = norm(text);
  const k = norm(keyword);
  if (!k) return false;
  let from = 0;
  for (;;) {
    const i = t.indexOf(k, from);
    if (i < 0) return false;
    if (i === 0 || !isWordChar(t[i - 1])) return true;
    from = i + 1;
  }
}

function normIcd(code: string | null | undefined): string {
  return (code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function diagnosisMatches(def: DecisionDef, d: DecisionDiagnosis): boolean {
  const m = def.match;
  if (m.excludeKeywords.some(k => keywordAt(d.name, k))) return false;
  if (d.id && m.diseaseIds.includes(d.id)) return true;
  const icd = normIcd(d.icd10);
  if (icd && m.icd10.some(p => icd.startsWith(normIcd(p)))) return true;
  return m.keywords.some(k => keywordAt(d.name, k));
}

// ── Sources ─────────────────────────────────────────────────────────────────────────────────

function refs(content: DecisionContent, ids: readonly string[]): SourceRef[] {
  return ids.map(id => {
    const s = content.sources[id];
    return { id, citation: s?.citation ?? id, year: s?.year ?? 0, fromMemory: s?.fromMemory ?? true };
  });
}

// ── Patient factors ─────────────────────────────────────────────────────────────────────────

function scoreValue(scores: readonly DecisionScore[], key: string): number | null {
  const s = pickScores(scores).find(x => x.key === key);
  return s ? s.value : null;
}

/** The patient's active factors (content modifiers are keyed by these). */
export function activeFactors(
  p: DecisionPatient, scores: readonly DecisionScore[], labs: DecisionInput['labs'], diagnoses: readonly DecisionDiagnosis[] = [],
): Set<FactorId> {
  const f = new Set<FactorId>();
  const age = p.ageYears;
  if (age !== null && age >= 65 && age < 80) f.add('age65to79');
  if (age !== null && age >= 80) f.add('age80plus');
  const cfs = p.cfs ?? scoreValue(scores, 'cfs');
  if (cfs !== null && cfs >= 5 && cfs <= 6) f.add('cfs5to6');
  if (cfs !== null && cfs >= 7) f.add('cfs7plus');
  const asa = p.asa ?? scoreValue(scores, 'asa');
  if (asa !== null && asa === 3) f.add('asa3');
  if (asa !== null && asa >= 4) f.add('asa4plus');
  if (p.egfr !== null && p.egfr >= 30 && p.egfr < 60) f.add('egfr30to59');
  if (p.egfr !== null && p.egfr < 30) f.add('egfrBelow30');
  if (p.anticoagulant === 'vka' || p.anticoagulant === 'doac') f.add('anticoagulated');
  if (p.anticoagulant === 'doac') f.add('doacOnly');
  if (p.antiplatelet) f.add('antiplatelet');
  const hasBled = p.hasBled ?? scoreValue(scores, 'has-bled');
  if (hasBled !== null && hasBled >= 3) f.add('hasBled3plus');
  if (p.pregnancy === 'pregnant') f.add('pregnant');
  if (p.allergyClasses.includes('penicillin')) f.add('penicillinAllergy');
  if (p.diabetes) f.add('diabetes');
  if (p.immunosuppressed) f.add('immunosuppressed');
  if (p.bmi !== null && p.bmi >= 40) f.add('bmi40plus');
  const news2 = p.news2 ?? scoreValue(scores, 'news2');
  if (news2 !== null && news2 >= 7) f.add('news2High');
  const lactate = labs.lactate ?? null;
  if ((p.sbp !== null && p.sbp < 90) || (lactate !== null && lactate >= 4)) f.add('shock');
  if (p.recentSurgeryDays !== null && p.recentSurgeryDays >= 0 && p.recentSurgeryDays <= 21) f.add('recentSurgery21d');
  if (p.appendicolith) f.add('appendicolith');
  const severe = ['glasgow-imrie', 'bisap', 'ranson'].some(k => {
    const v = scoreValue(scores, k);
    return v !== null && v >= 3;
  });
  // Severity from the scores, or named in the confirmed diagnosis ("severe", "moderately severe",
  // "necrotising", "organ failure" — revised Atlanta 2012).
  const namedSevere = diagnoses.some(d => d.confirmed && keywordAt(d.name, 'pancreatitis')
    && ['severe', 'necrotis', 'necrotiz', 'organ failure'].some(k => keywordAt(d.name, k)));
  if (severe || namedSevere) f.add('predictedSeverePancreatitis');
  if (p.mechanicalValve) f.add('mechanicalValve');
  if (p.recentVte3m) f.add('recentVte3m');
  return f;
}

// ── Scores ──────────────────────────────────────────────────────────────────────────────────

const SOURCE_RANK: Record<DecisionScore['source'], number> = { calculator: 0, record: 1, autofill: 2 };

/** One value per score: a clinician-completed calculator wins over the record, then auto-fill. */
export function pickScores(scores: readonly DecisionScore[]): DecisionScore[] {
  const out: DecisionScore[] = [];
  for (const s of scores) {
    if (!Number.isFinite(s.value)) continue;
    const i = out.findIndex(o => o.key === s.key);
    if (i < 0) out.push(s);
    else if (SOURCE_RANK[s.source] < SOURCE_RANK[out[i].source]) out[i] = s;
  }
  return out;
}

export function scoreBand(set: ScoreActionSet, score: DecisionScore): ScoreBand | null {
  for (const b of set.bands) {
    if (score.value < b.min || score.value > b.max) continue;
    if (b.requires === 'redParameter' && !score.redParameter) continue;
    return b;
  }
  return null;
}

const LEVEL_RANK: Record<string, number> = { critical: 0, high: 1, moderate: 2, low: 3 };

export function scoreActions(input: DecisionInput, content: DecisionContent, filter: LineFilter = IDENTITY): ScoreActionCard[] {
  const cards: ScoreActionCard[] = [];
  for (const s of pickScores(input.scores)) {
    const set = content.scoreActions.find(x => x.score === s.key);
    if (!set) continue;
    const b = scoreBand(set, s);
    if (!b) continue;
    const f = filter(b.action);
    cards.push({
      id: `${set.score}:${set.bands.indexOf(b)}`, score: set.score, scoreLabel: set.label,
      chip: `${set.chip} ${formatValue(s.value)}`, value: s.value, scoreSource: s.source,
      band: b.band, level: b.level, action: f.text, withheld: f.withheld, addAs: b.addAs,
      evidence: b.evidence, sources: refs(content, b.sources),
    });
  }
  return cards
    .map((c, i) => ({ c, i }))
    .sort((a, b) => (LEVEL_RANK[a.c.level] - LEVEL_RANK[b.c.level]) || (a.i - b.i))
    .map(x => x.c);
}

// ── Results ─────────────────────────────────────────────────────────────────────────────────

export function resultActions(input: DecisionInput, content: DecisionContent, filter: LineFilter = IDENTITY): ResultActionCard[] {
  const fired = new Set<string>();
  const cards: ResultActionCard[] = [];
  for (const r of content.resultActions) {
    const v = input.labs[r.analyte];
    if (v === undefined || v === null || !Number.isFinite(v)) continue;
    let lower: number | null = r.lower ?? null;
    let ulnText = '';
    if (r.ulnMultiple !== undefined) {
      const key = r.analyte as 'lipase' | 'amylase' | 'troponin';
      const local = input.uln?.[key];
      const uln = local ?? content.defaults.uln[key];
      lower = r.ulnMultiple * uln;
      ulnText = local !== undefined ? ` (ULN ${formatValue(uln)} ${r.unit})` : ` (ULN ${formatValue(uln)} ${r.unit} assumed — use the local reference range)`;
    }
    if (lower !== null && (r.strictLower ? !(v > lower) : !(v >= lower))) continue;
    if (r.upperExclusive !== undefined && !(v < r.upperExclusive)) continue;
    fired.add(r.id);
    const f = filter(r.action);
    cards.push({
      id: r.id, analyte: r.analyte, label: r.label,
      chip: `${r.analyte.charAt(0).toUpperCase()}${r.analyte.slice(1)} ${formatValue(v)} ${r.unit}`,
      value: v, unit: r.unit, thresholdText: `${r.thresholdText}${ulnText}`,
      action: f.text, withheld: f.withheld, addAs: r.addAs, level: r.level,
      diagnosisHint: r.diagnosisHint ?? null, sources: refs(content, r.sources),
    });
  }
  return cards.filter(c => {
    const rule = content.resultActions.find(r => r.id === c.id);
    return !(rule?.supersededBy && fired.has(rule.supersededBy));
  });
}

// ── Thresholds (Pauker–Kassirer) ────────────────────────────────────────────────────────────

interface Thresholds { test: number | null; treat: number }

/** Test / test-treatment thresholds; without a useful test, the treatment threshold. */
export function thresholds(b: number, h: number, test?: { sensitivity: number; specificity: number; harm: number } | null): Thresholds {
  if (b <= 0) return { test: null, treat: 1 };
  const treat = h <= 0 ? 0 : h / (h + b);
  if (!test) return { test: null, treat };
  const se = test.sensitivity;
  const sp = test.specificity;
  const r = test.harm;
  const tt = clamp(((1 - sp) * h + r) / ((1 - sp) * h + se * b), 0, 1);
  const ttx = clamp((sp * h - r) / (sp * h + (1 - se) * b), 0, 1);
  if (!(tt < ttx)) return { test: null, treat };
  return { test: tt, treat: ttx };
}

export function bandFor(p: number | null, t: Thresholds): Band {
  if (p === null) return 'unknown';
  if (t.test !== null && p < t.test) return 'observe';
  if (p >= t.treat) return 'treat';
  return t.test !== null ? 'test' : 'observe';
}

const BAND_ORDER: Band[] = ['observe', 'test', 'treat'];

/** Odds-scale adjustment of a probability. */
function applyOR(h: number, or: number): number {
  const base = clamp(h, 0, 0.99);
  if (or === 1) return base;
  const odds = base / (1 - base);
  const o2 = odds * or;
  return clamp(o2 / (1 + o2), 0, 0.99);
}

interface Personalised { benefit: Triple; harm: Triple }

function personalise(o: TreatmentOption, mods: readonly Modifier[]): Personalised {
  const or: Triple = [1, 1, 1];
  const bx: Triple = [1, 1, 1];
  const ba: Triple = [0, 0, 0];
  for (const m of mods) {
    for (let i = 0; i < 3; i++) {
      if (m.harmOR) or[i] = or[i] * m.harmOR[i];
      if (m.benefitX) bx[i] = bx[i] * m.benefitX[i];
      if (m.benefitAdd) ba[i] = ba[i] + m.benefitAdd[i];
    }
  }
  const harm: Triple = [applyOR(o.harm[0], or[0]), applyOR(o.harm[1], or[1]), applyOR(o.harm[2], or[2])];
  const dh: Triple = [harm[0] - o.harm[0], harm[1] - o.harm[1], harm[2] - o.harm[2]];
  const inD = o.harmInDiseased !== false ? 1 : 0;
  const benefit: Triple = [
    clamp(o.benefit[0] * bx[0] + ba[0] - inD * dh[2], -0.99, 0.99),
    clamp(o.benefit[1] * bx[1] + ba[1] - inD * dh[1], -0.99, 0.99),
    clamp(o.benefit[2] * bx[2] + ba[2] - inD * dh[0], -0.99, 0.99),
  ];
  return { benefit, harm };
}

function modifierApplies(m: Modifier, o: TreatmentOption): boolean {
  if (m.requiresAllergyClass && !(o.allergyClasses ?? []).includes(m.requiresAllergyClass)) return false;
  if (m.options && m.options.includes(o.id)) return true;
  if (m.kinds && m.kinds.includes(o.kind)) return true;
  return false;
}

function effectOf(m: Modifier): FactorEffect {
  if (m.exclude) return 'excluded';
  if (m.harmOR) return m.harmOR[1] >= 1 ? 'harm-up' : 'harm-down';
  if (m.benefitX) return m.benefitX[1] >= 1 ? 'benefit-up' : 'benefit-down';
  return (m.benefitAdd?.[1] ?? 0) >= 0 ? 'benefit-up' : 'benefit-down';
}

const EFFECT_WORDS: Record<FactorEffect, string> = {
  'excluded': 'excluded',
  'harm-up': 'raised the harm of',
  'harm-down': 'lowered the harm of',
  'benefit-up': 'raised the benefit of',
  'benefit-down': 'lowered the benefit of',
};

/** "Early laparoscopic cholecystectomy" → "early laparoscopic cholecystectomy"; "IV antibiotics" kept. */
export function lowerFirst(label: string): string {
  const first = label.split(' ')[0] ?? '';
  const capitals = first.split('').filter(c => c >= 'A' && c <= 'Z').length;
  if (capitals >= 2 || label.length === 0) return label;
  return label.charAt(0).toLowerCase() + label.slice(1);
}

const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI'];

/** The factor as the patient has it ("Frailty CFS 7", "eGFR 28", "Age 88"); else the content label. */
export function factorLabel(factor: FactorId, fallback: string, p: DecisionPatient, scores: readonly DecisionScore[], labs: DecisionInput['labs']): string {
  switch (factor) {
    case 'age65to79':
    case 'age80plus':
      return p.ageYears !== null ? `Age ${formatValue(Math.floor(p.ageYears))}` : fallback;
    case 'cfs5to6':
    case 'cfs7plus': {
      const v = p.cfs ?? scoreValue(scores, 'cfs');
      return v !== null ? `Frailty CFS ${formatValue(v)}` : fallback;
    }
    case 'asa3':
    case 'asa4plus': {
      const v = p.asa ?? scoreValue(scores, 'asa');
      return v !== null && Number.isInteger(v) && v >= 1 && v <= 6 ? `ASA ${ROMAN[v]}` : fallback;
    }
    case 'egfr30to59':
    case 'egfrBelow30':
      return p.egfr !== null ? `eGFR ${formatValue(Math.round(p.egfr))}` : fallback;
    case 'bmi40plus':
      return p.bmi !== null ? `BMI ${formatValue(Math.round(p.bmi))}` : fallback;
    case 'news2High': {
      const v = p.news2 ?? scoreValue(scores, 'news2');
      return v !== null ? `NEWS2 ${formatValue(v)}` : fallback;
    }
    case 'hasBled3plus': {
      const v = p.hasBled ?? scoreValue(scores, 'has-bled');
      return v !== null ? `HAS-BLED ${formatValue(v)}` : fallback;
    }
    case 'shock':
      if (p.sbp !== null && p.sbp < 90) return `Shock (SBP ${formatValue(p.sbp)})`;
      if (labs.lactate !== undefined && labs.lactate !== null) return `Shock (lactate ${formatValue(labs.lactate)})`;
      return fallback;
    default:
      return fallback;
  }
}

function joinAnd(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function netAt(p: number, b: number, h: number): number {
  return p * b - (1 - p) * h;
}

function evaluateOption(
  def: DecisionDef, o: TreatmentOption, p: number | null, active: Set<FactorId>,
  content: DecisionContent, filter: LineFilter, input: DecisionInput,
): OptionResult {
  const label = (m: Modifier) => factorLabel(m.factor, m.label, input.patient, input.scores, input.labs);
  const all = [...content.modifiers, ...def.modifiers].filter(m => modifierApplies(m, o) && active.has(m.factor));
  const excluding = all.filter(m => m.exclude);
  const numeric = all.filter(m => !m.exclude);
  const pers = personalise(o, numeric);
  const test = def.test ?? null;
  const tPoint = thresholds(pers.benefit[1], pers.harm[1], test);
  const tOpt = thresholds(pers.benefit[2], pers.harm[0], test);
  const tPess = thresholds(pers.benefit[0], pers.harm[2], test);

  const plan = filter(o.planLine);
  const observe = filter(o.observeText);
  const excludedReason = excluding.length ? excluding.map(m => `${label(m)}: ${m.reason}`).join(' ') : null;
  const withheldText = plan.withheld ? plan.text : null;

  let band: Band;
  let bandRange: Band[];
  if (excludedReason || withheldText) {
    band = 'not-for-patient';
    bandRange = ['not-for-patient'];
  } else {
    band = bandFor(p, tPoint);
    const set = new Set<Band>([bandFor(p, tPess), band, bandFor(p, tOpt)]);
    bandRange = p === null ? ['unknown'] : BAND_ORDER.filter(b => set.has(b));
  }

  const pp = p ?? 0;
  const expectedBenefit: Triple = [pp * pers.benefit[0], pp * pers.benefit[1], pp * pers.benefit[2]];
  const expectedHarm: Triple = [(1 - pp) * pers.harm[0], (1 - pp) * pers.harm[1], (1 - pp) * pers.harm[2]];
  const net: Triple = [
    netAt(pp, pers.benefit[0], pers.harm[2]),
    netAt(pp, pers.benefit[1], pers.harm[1]),
    netAt(pp, pers.benefit[2], pers.harm[0]),
  ];

  // What moved it: each numeric factor removed in turn (others kept).
  const factors: AppliedFactor[] = excluding.map(m => ({
    modifierId: m.id, factor: m.factor, label: label(m), effect: 'excluded' as FactorEffect, reason: m.reason,
    thresholdShift: 0, netShift: 0, evidence: m.evidence, sources: refs(content, m.sources),
  }));
  const shifted: AppliedFactor[] = [];
  for (const m of numeric) {
    const without = personalise(o, numeric.filter(x => x !== m));
    const tw = thresholds(without.benefit[1], without.harm[1], test);
    shifted.push({
      modifierId: m.id, factor: m.factor, label: label(m), effect: effectOf(m), reason: m.reason,
      thresholdShift: round4(tPoint.treat - tw.treat),
      netShift: round4(netAt(pp, pers.benefit[1], pers.harm[1]) - netAt(pp, without.benefit[1], without.harm[1])),
      evidence: m.evidence, sources: refs(content, m.sources),
    });
  }
  const order = shifted
    .map((f, i) => ({ f, i }))
    .sort((a, b) => (Math.abs(b.f.thresholdShift) - Math.abs(a.f.thresholdShift))
      || (Math.abs(b.f.netShift) - Math.abs(a.f.netShift)) || (a.i - b.i))
    .map(x => x.f);
  factors.push(...order);
  const topFactors = factors.slice(0, 3);

  let factorSummary: string | null = null;
  if (excluding.length) {
    factorSummary = `${joinAnd(excluding.map(m => label(m)))}: ${lowerFirst(o.label)} is not for this patient.`;
  } else if (topFactors.length) {
    const base = thresholds(o.benefit[1], o.harm[1], test);
    const groups: string[] = [];
    for (const effect of ['harm-up', 'benefit-down', 'benefit-up', 'harm-down'] as FactorEffect[]) {
      const labels = topFactors.filter(f => f.effect === effect).map(f => f.label);
      if (labels.length) groups.push(`${joinAnd(labels)} ${EFFECT_WORDS[effect]} ${lowerFirst(o.label)}`);
    }
    factorSummary = `${groups.join('; ')} (treat threshold ${formatPercent(base.treat)} → ${formatPercent(tPoint.treat)}).`;
  }

  let suggestedLine: string | null = null;
  let suggestedAddAs: OptionResult['suggestedAddAs'] = null;
  if (band === 'treat') { suggestedLine = plan.text; suggestedAddAs = o.addAs; }
  else if (band === 'test' && test) { suggestedLine = test.label; suggestedAddAs = 'test'; }
  else if (band === 'observe') { suggestedLine = observe.withheld ? null : observe.text; suggestedAddAs = observe.withheld ? null : 'plan'; }

  const sources = refs(content, o.sources);
  return {
    id: o.id, label: o.label, kind: o.kind, band, bandRange, borderline: bandRange.length > 1,
    treatThreshold: round3t([tOpt.treat, tPoint.treat, tPess.treat]),
    testThreshold: tPoint.test === null ? null : round3t([tOpt.test ?? tPoint.test, tPoint.test, tPess.test ?? tPoint.test]),
    benefit: round3t(pers.benefit), harm: round3t(pers.harm),
    expectedBenefit: round3t(expectedBenefit), expectedHarm: round3t(expectedHarm), net: round3t(net),
    rank: null, excludedReason, withheldText,
    factors, topFactors, factorSummary,
    planLine: plan.text, observeText: observe.text, suggestedLine, suggestedAddAs,
    evidence: o.evidence, lowEvidence: o.evidence === 'estimate' || o.evidence === 'low',
    fromMemory: sources.some(s => s.fromMemory), sources, note: o.note ?? null,
  };
}

// ── Decisions ───────────────────────────────────────────────────────────────────────────────

interface Selected { def: DecisionDef; p: number | null; source: DecisionResult['probabilitySource']; name: string; chip: string; label: string; confirmed: boolean }

function selectDecision(def: DecisionDef, input: DecisionInput, content: DecisionContent, factors: Set<FactorId>): Selected | null {
  const scores = pickScores(input.scores);
  const matches = input.diagnoses.filter(d => diagnosisMatches(def, d));
  const confirmed = matches.find(d => d.confirmed) ?? null;
  const engine = matches
    .filter(d => !d.confirmed && d.probability !== null)
    .reduce<DecisionDiagnosis | null>((best, d) => (!best || (d.probability ?? 0) > (best.probability ?? 0) ? d : best), null);
  const minP = content.defaults.minEngineProbability;
  // A clinician-confirmed diagnosis wins over the engine's differential (the ManagementPanel rule,
  // managementPanelSource): other leading differentials give decisions only when nothing is confirmed.
  const anyConfirmed = input.diagnoses.some(d => d.confirmed);
  const engineOk = !anyConfirmed && engine !== null && (engine.probability ?? 0) >= minP;

  if (def.type === 'diagnosis') {
    const pre = def.pretestScore ? scores.find(s => s.key === def.pretestScore) ?? null : null;
    const preSet = pre ? content.scoreActions.find(s => s.score === pre.key) ?? null : null;
    const preBand = pre && preSet ? scoreBand(preSet, pre) : null;
    if (confirmed) {
      const p = Math.max(content.defaults.confirmedFloor, confirmed.probability ?? 0);
      return { def, p, source: 'confirmed', name: confirmed.name, chip: `Confirmed: ${confirmed.name}`, label: 'P(diagnosis)', confirmed: true };
    }
    if (pre && preSet && preBand?.risk) {
      const p = preBand.risk[1];
      return {
        def, p, source: 'score', name: engine?.name ?? def.label,
        chip: `${preSet.chip} ${formatValue(pre.value)} → ${formatPercent(p)} pre-test`, label: 'Pre-test probability', confirmed: false,
      };
    }
    if (engineOk && engine) {
      const p = engine.probability ?? 0;
      return { def, p, source: 'engine', name: engine.name, chip: `P(${engine.name}) ${formatPercent(p)}`, label: 'P(diagnosis)', confirmed: false };
    }
    return null;
  }

  // Risk decisions.
  if (def.triggerScore && !scores.some(s => s.key === def.triggerScore)) return null;
  if (def.trigger === 'anticoagulatedWithProcedure'
    && !(factors.has('anticoagulated') && input.patient.procedurePlanned)) return null;
  const matched = !!confirmed || engineOk;
  if (!def.triggerScore && !def.trigger && !matched && !(def.riskScore && scores.some(s => s.key === def.riskScore))) return null;
  const name = confirmed?.name ?? engine?.name ?? def.label;
  const riskLabel = def.riskLabel ?? 'Risk';
  if (def.riskScore) {
    const s = scores.find(x => x.key === def.riskScore) ?? null;
    const set = content.scoreActions.find(x => x.score === def.riskScore) ?? null;
    const b = s && set ? scoreBand(set, s) : null;
    if (s && set && b?.risk) {
      const p = b.risk[1];
      return { def, p, source: 'risk', name, chip: `${set.chip} ${formatValue(s.value)} → ${formatPercent(p)} ${set.riskLabel ?? 'risk'}`, label: set.riskLabel ?? riskLabel, confirmed: !!confirmed };
    }
    return { def, p: null, source: 'none', name, chip: `${set?.chip ?? def.riskScore} not recorded`, label: riskLabel, confirmed: !!confirmed };
  }
  let p = def.baselineRisk ? def.baselineRisk[1] : null;
  let why = 'baseline';
  for (const rf of def.riskFactors ?? []) {
    if (factors.has(rf.factor) && (p === null || rf.risk[1] > p)) { p = rf.risk[1]; why = rf.label; }
  }
  if (p === null) return null;
  return { def, p, source: 'risk', name, chip: `${riskLabel} ${formatPercent(p)} (${why})`, label: riskLabel, confirmed: !!confirmed };
}

const MISSING_FACTORS: Record<string, FactorId[]> = {
  cfs: ['cfs5to6', 'cfs7plus'],
  asa: ['asa3', 'asa4plus'],
  egfr: ['egfr30to59', 'egfrBelow30'],
  pregnancy: ['pregnant'],
  bmi: ['bmi40plus'],
  hasBled: ['hasBled3plus'],
  news2: ['news2High', 'shock'],
};

function inputMissing(key: string, input: DecisionInput): boolean {
  const p = input.patient;
  const scores = input.scores;
  switch (key) {
    case 'cfs': return (p.cfs ?? scoreValue(scores, 'cfs')) === null && (p.ageYears === null || p.ageYears >= 65);
    case 'asa': return (p.asa ?? scoreValue(scores, 'asa')) === null;
    case 'egfr': return p.egfr === null;
    case 'pregnancy': return p.sex !== 'male' && (p.ageYears === null || (p.ageYears >= 12 && p.ageYears <= 55))
      && (p.pregnancy === 'unknown' || p.pregnancy === 'possible');
    case 'bmi': return p.bmi === null;
    case 'hasBled': return (p.hasBled ?? scoreValue(scores, 'has-bled')) === null && (p.anticoagulant === 'vka' || p.anticoagulant === 'doac');
    case 'news2': return (p.news2 ?? scoreValue(scores, 'news2')) === null && p.sbp === null;
    default: return false;
  }
}

function missingFor(def: DecisionDef, sel: Selected, input: DecisionInput, content: DecisionContent): string[] {
  const out: string[] = [];
  if (sel.p === null && def.riskScore) {
    const set = content.scoreActions.find(s => s.score === def.riskScore);
    out.push(`Calculate the ${set?.label ?? def.riskScore} score to set the risk.`);
  }
  for (const key of Object.keys(MISSING_FACTORS)) {
    if (!inputMissing(key, input)) continue;
    const factorIds = MISSING_FACTORS[key];
    const affected = def.options.filter(o => [...content.modifiers, ...def.modifiers]
      .some(m => factorIds.includes(m.factor) && modifierApplies(m, o)));
    if (!affected.length) continue;
    const info = content.missingInputs[key];
    out.push(`Record ${info?.label ?? key} to refine: ${info?.effect ?? ''} (${affected.map(o => lowerFirst(o.label)).join('; ')}).`);
  }
  return out;
}

export function evaluateDecisions(
  input: DecisionInput, content: DecisionContent, filter: LineFilter = IDENTITY,
  factors: Set<FactorId> = activeFactors(input.patient, input.scores, input.labs, input.diagnoses),
): DecisionResult[] {
  const selected: Selected[] = [];
  for (const def of content.decisions) {
    const s = selectDecision(def, input, content, factors);
    if (s) selected.push(s);
  }
  const ordered = selected
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (Number(b.s.confirmed) - Number(a.s.confirmed))
      || ((b.s.p ?? -1) - (a.s.p ?? -1)) || (a.i - b.i))
    .map(x => x.s)
    .slice(0, content.defaults.maxDecisions);

  return ordered.map(sel => {
    const def = sel.def;
    const options = def.options.map(o => evaluateOption(def, o, sel.p, factors, content, filter, input));
    if (sel.p !== null) {
      const rankable = options
        .map((o, i) => ({ o, i }))
        .filter(x => x.o.band !== 'not-for-patient')
        .sort((a, b) => (b.o.net[1] - a.o.net[1]) || (a.i - b.i));
      rankable.forEach((x, r) => { x.o.rank = r + 1; });
    }
    const sortedOptions = [...options].sort((a, b) => ((a.rank ?? 99) - (b.rank ?? 99)));
    return {
      id: def.id, label: def.label, type: def.type, diagnosisName: sel.name,
      probability: sel.p === null ? null : round4(sel.p), probabilitySource: sel.source, probabilityLabel: sel.label,
      chip: sel.chip,
      test: def.test ? { label: def.test.label, sensitivity: def.test.sensitivity, specificity: def.test.specificity, sources: refs(content, def.test.sources) } : null,
      options: sortedOptions,
      missing: missingFor(def, sel, input, content),
    };
  });
}

/** Everything the Plan-step "Decision support — clinician decides" section shows. */
export function decisionSupport(input: DecisionInput, content: DecisionContent, filter: LineFilter = IDENTITY): DecisionSupportResult {
  const factors = activeFactors(input.patient, input.scores, input.labs, input.diagnoses);
  const order = Object.keys({
    age65to79: 1, age80plus: 1, cfs5to6: 1, cfs7plus: 1, asa3: 1, asa4plus: 1, egfr30to59: 1, egfrBelow30: 1,
    anticoagulated: 1, doacOnly: 1, antiplatelet: 1, hasBled3plus: 1, pregnant: 1, penicillinAllergy: 1, diabetes: 1,
    immunosuppressed: 1, bmi40plus: 1, news2High: 1, shock: 1, recentSurgery21d: 1, appendicolith: 1,
    predictedSeverePancreatitis: 1, mechanicalValve: 1, recentVte3m: 1,
  }) as FactorId[];
  return {
    contentVersion: content.version,
    scoreActions: scoreActions(input, content, filter),
    resultActions: resultActions(input, content, filter),
    decisions: evaluateDecisions(input, content, filter, factors),
    activeFactors: order.filter(f => factors.has(f)),
  };
}

// ── Summary lines (clinical-validation harness web.decisions / ios.decisions; identical on iOS) ─

const BAND_WORD: Record<Band, string> = {
  observe: 'OBSERVE', test: 'TEST FURTHER', treat: 'TREAT', 'not-for-patient': 'NOT FOR THIS PATIENT', unknown: 'RISK NOT KNOWN',
};

/** One line per card / option / missing input, in display order. */
export interface DecisionSummaryLine {
  /** management = what is suggested; safety = an option that is not for this patient; info = a missing input. */
  kind: 'management' | 'safety' | 'info';
  text: string;
}

export function decisionSummaryLines(r: DecisionSupportResult): DecisionSummaryLine[] {
  const out: DecisionSummaryLine[] = [];
  for (const c of r.resultActions) out.push({ kind: 'management', text: `Result action — ${c.chip}: ${c.label} — ${c.action}` });
  for (const c of r.scoreActions) out.push({ kind: 'management', text: `Score action — ${c.chip}: ${c.band} — ${c.action}` });
  for (const d of r.decisions) {
    const head = `Decision ${d.label} (${d.chip}; ${d.probability === null ? 'P not known' : `P ${formatPercent(d.probability)}`})`;
    for (const o of d.options) {
      if (o.band === 'unknown') continue;
      if (o.band === 'not-for-patient') {
        out.push({ kind: 'safety', text: `${head} — not for this patient: ${o.label} — ${o.withheldText ?? o.excludedReason ?? ''}` });
        continue;
      }
      const thr = `treat threshold ${formatPercent(o.treatThreshold[1])}${o.testThreshold ? `, test threshold ${formatPercent(o.testThreshold[1])}` : ''}`;
      const tail = [thr, ...(o.borderline ? ['borderline across the evidence range'] : []), ...(o.factorSummary ? [o.factorSummary] : [])].join('; ');
      const rank = `rank ${o.rank === null ? '-' : String(o.rank)}`;
      if (o.band === 'treat') out.push({ kind: 'management', text: `${head} — ${rank}: ${o.label} — ${BAND_WORD.treat}: ${o.suggestedLine ?? o.planLine} (${tail})` });
      else if (o.band === 'test') out.push({ kind: 'management', text: `${head} — ${rank}: ${o.label} — ${BAND_WORD.test}: ${o.suggestedLine ?? ''} (${tail})` });
      else out.push({ kind: 'management', text: `${head} — ${rank}: ${BAND_WORD.observe} rather than ${lowerFirst(o.label)}: ${o.suggestedLine ?? o.observeText} (${tail})` });
    }
    for (const m of d.missing) out.push({ kind: 'info', text: `Decision ${d.label} — missing: ${m}` });
  }
  return out;
}
