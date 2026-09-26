/**
 * History-frame audit (lint:history-frames and history-frames.test.ts).
 *
 * For every chief complaint on both platforms (history-frames-corpus.ts) and every chip of every
 * frame (lib/triage-engine/src/history-frames) it checks:
 *   - the frame chosen is the expected symptom type (shared vectors,
 *     ios/AmiseMedFlowTests/Resources/HistoryFrameVectors.json);
 *   - site options belong to the complaint's region (no abdominal sites for a cough), and only a
 *     pain frame asks about radiation;
 *   - every chip reaches a diagnosis-engine feature, or is marked record-only:
 *       iOS — a DiagnosticDatabase.json feature in the frame's pools, simulated the way
 *             BayesianDiagnosisEngine.score() reads socratesSelections;
 *       web — a pane-engine feature from extractFeaturesFromSocrates (socrates-to-features.ts);
 *   - no duplicate or contradictory chips;
 *   - the Swift twin (HistoryFrameData.swift) is current, and the vignettes' SOCRATES values are
 *     real chip values.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  HISTORY_FRAMES, classifyComplaint, dimensionKey, optionKey, optionValue, resolveFrame, webKeyFor, webStoredLabel,
} from '../../lib/triage-engine/src/history-frames/index';
import type { FrameDimension, FrameOption, HistoryFrame } from '../../lib/triage-engine/src/history-frames/index';
import { FEATURES } from '../../lib/pane-engine/src/index';
import {
  FRAME_KEY_RULES, FRAME_PAIN_KEYS, extractFeaturesFromSocrates,
} from '../../artifacts/dashboard/src/lib/socrates-to-features';
import { SYMPTOM_BRANCHES } from '../../artifacts/dashboard/src/lib/symptom-branches';
import { ROOT, corpus } from './history-frames-corpus';
import type { CorpusEntry } from './history-frames-corpus';
import { SWIFT_DATA_PATH, generateSwift } from './history-frames-generate';

export const VECTORS_PATH = join(ROOT, 'ios/AmiseMedFlowTests/Resources/HistoryFrameVectors.json');

// ── iOS DiagnosticDatabase simulation ───────────────────────────────────────────

interface DbFeature { key: string; value: string; logLR: number }
interface DbCandidate { name: string; features: DbFeature[] }
interface Db { pools: Record<string, { candidates: DbCandidate[] }> }

let dbCache: Db | null = null;
function db(): Db {
  dbCache ??= JSON.parse(readFileSync(join(ROOT, 'ios/AmiseMedFlow/Resources/DiagnosticDatabase.json'), 'utf8')) as Db;
  return dbCache;
}

/** Feature keys score() reads from socratesSelections by key. */
const SOCRATES_KEYS = new Set(['onset', 'site', 'character', 'radiation', 'associations', 'timing', 'exacerbating',
  'relieving', 'severity']);

let explicitKeysCache: Set<string> | null = null;
/** Keys with their own case in score()'s scoring switch (they read other record fields). */
function explicitKeys(): Set<string> {
  if (explicitKeysCache) return explicitKeysCache;
  const src = readFileSync(join(ROOT, 'ios/AmiseMedFlow/Services/BayesianDiagnosisEngine+Scoring.swift'), 'utf8');
  const start = src.indexOf('for f in c.features {\n                var triggered');
  const end = src.indexOf('default:\n                    // Pass 1: SOCRATES dict lookup', start);
  if (start < 0 || end < 0) throw new Error('BayesianDiagnosisEngine+Scoring.swift: scoring switch not found');
  const keys = new Set<string>();
  for (const m of src.slice(start, end).matchAll(/case\s+((?:"[^"]+"\s*,?\s*)+):/g)) {
    for (const k of m[1]!.matchAll(/"([^"]+)"/g)) keys.add(k[1]!);
  }
  explicitKeysCache = keys;
  return keys;
}

const NEG = /^(no|not|non|never|without)\b/;

/** Word-start substring (NegationMatcher wordStart), affirmed (a leading "No …" chip negates). */
function wordStart(text: string, term: string): boolean {
  if (NEG.test(text)) return false;
  let from = 0;
  for (;;) {
    const i = text.indexOf(term, from);
    if (i < 0) return false;
    if (i === 0 || !/[a-z0-9]/.test(text[i - 1]!) || !/[a-z0-9]/.test(term[0] ?? '')) return true;
    from = i + 1;
  }
}
function affirmed(text: string, term: string): boolean {
  return !NEG.test(text) && text.includes(term);
}
let stemsCache: Set<string> | null = null;
/** FeatureTerm.stems (BayesianDiagnosisEngine+FeatureTerms.swift): short terms matched at a word start. */
export function featureTermStems(): Set<string> {
  if (stemsCache) return stemsCache;
  const src = readFileSync(join(ROOT, 'ios/AmiseMedFlow/Services/BayesianDiagnosisEngine+FeatureTerms.swift'), 'utf8');
  const m = /static let stems: Set<String> = \[([^\]]*)\]/.exec(src);
  if (!m) throw new Error('BayesianDiagnosisEngine+FeatureTerms.swift: FeatureTerm.stems not found');
  stemsCache = new Set([...m[1]!.matchAll(/"([^"]+)"/g)].map(x => x[1]!));
  return stemsCache;
}
/**
 * A database term in chip text, as BayesianDiagnosisEngine.termAffirmed matches it: at a word start,
 * except that a term of four letters or digits or fewer (not a FeatureTerm stem) must be a whole
 * word, with a plural "s"/"es" ("sti" is not in "still", "burn" not in "burning").
 */
function termAffirmed(text: string, term: string): boolean {
  if (!/^[a-z0-9]{1,4}$/.test(term) || featureTermStems().has(term)) return wordStart(text, term);
  if (NEG.test(text)) return false;
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const plural = !/[a-z]$/.test(term) ? '' : term.length <= 3 ? 's?' : '(s|es)?';
  return new RegExp(`(^|[^a-z0-9])${esc}${plural}($|[^a-z0-9])`).test(text);
}
function anyAlternative(spec: string, text: string): boolean {
  return spec.toLowerCase().split('|').some(alt => {
    const terms = alt.split('&').filter(Boolean);
    return terms.length > 0 && terms.every(t => termAffirmed(text, t));
  });
}
const KEY_STOP = new Set(['pain', 'sign', 'test', 'with', 'type', 'form', 'and', 'the', 'for', 'from', 'that', 'this',
  'into', 'also', 'show', 'seen', 'find', 'rate', 'does', 'have', 'been', 'true', 'false', 'over', 'under', 'each',
  'both', 'when', 'more', 'less']);

/** Would a chip (socratesSelections[key] ∋ value, nothing else in the record) fire feature f? */
export function iosFires(f: DbFeature, key: string, value: string): boolean {
  const v = value.toLowerCase();
  const fv = f.value.toLowerCase();
  const fvs = fv.replace(/_/g, ' ');
  if (SOCRATES_KEYS.has(f.key)) return key === f.key && v.includes(fv);
  switch (f.key) {
    case 'associated': {
      const words = fv.split(' ').filter(w => w.length >= 4);
      return words.length ? words.every(w => affirmed(v, w)) : affirmed(v, fv);
    }
    case 'socrates_character': return key === 'character' && v.includes(fv);
    case 'socrates_timing': case 'duration': case 'socrates_duration':
      return (key === 'timing' || key === 'duration') && v.includes(fvs);
    case 'socrates_site': return key === 'site' && v.includes(fv);
    case 'aggravating': return (key === 'exacerbating' || key === 'aggravating') && v.includes(fvs);
    case 'pain': return (key === 'character' || key === 'severity') && v.includes(fvs);
    case 'finding': return anyAlternative(f.value, v);
    case 'fever': return key === 'associations' && v.includes('fever');
    case 'weight_loss': return ['weight loss', 'losing weight', 'cachexia', 'unintentional weight'].some(t => affirmed(v, t));
    case 'headache': {
      const toks = fvs.split(' ').filter(w => w.length >= 4);
      return toks.length ? toks.every(t => affirmed(v, t)) : affirmed(v, 'headache') || affirmed(v, fvs);
    }
    case 'haemodynamic_instability': return key === 'associations' && (v.includes('hypotension') || v.includes('tachycardia'));
    case 'bp': return key === 'associations' && v.includes('hyperten');
    default: break;
  }
  if (explicitKeys().has(f.key)) return false;
  // score() default: a custom key stored in socratesSelections, else the words of a singleton key.
  if (key === f.key) return v.includes(fv);
  const groups = f.key.toLowerCase().split('_or_')
    .map(g => g.replace(/_/g, ' ').split(' ').filter(w => w.length >= 4 && !KEY_STOP.has(w)))
    .filter(g => g.length > 0);
  if (!groups.length) return false;
  if (['absent', 'false', 'no', 'negative', 'none', 'normal'].includes(fv)) return false;
  return groups.some(g => g.every(w => affirmed(v, w)));
}

export interface IosHit { pool: string; candidate: string; key: string; value: string; logLR: number }

export function iosHits(frame: HistoryFrame, key: string, value: string): IosHit[] {
  const pools = frame.iosPools.includes('*') ? Object.keys(db().pools) : frame.iosPools;
  const hits: IosHit[] = [];
  for (const pool of pools) {
    for (const c of db().pools[pool]?.candidates ?? []) {
      for (const f of c.features) {
        if (f.logLR !== 0 && iosFires(f, key, value)) {
          hits.push({ pool, candidate: c.name, key: f.key, value: f.value, logLR: f.logLR });
        }
      }
    }
  }
  return hits;
}

// ── Web (pane-engine) ───────────────────────────────────────────────────────────

const PANE_IDS = new Set(FEATURES.map(f => f.id));

function paneFeatures(cc: string, answers: Record<string, string>): Set<string> {
  const out = extractFeaturesFromSocrates(cc, answers);
  return new Set(Object.entries(out).filter(([id, present]) => present && PANE_IDS.has(id)).map(([id]) => id));
}

/**
 * Pane features a chip adds when answered: with the frame's complaint as context (rules that need
 * it, e.g. breast context), with no complaint (a feature the complaint also asserts still counts),
 * and with a chronic duration answered (a "Progressive" course only counts over weeks to months).
 */
export function webHits(frame: HistoryFrame, dim: FrameDimension, opt: FrameOption): string[] {
  const key = webKeyFor(dim);
  const value = webStoredLabel(opt.label);
  const found = new Set<string>();
  const contexts: [string, Record<string, string>][] = [
    [frame.sampleComplaint, {}], ['', {}], [frame.sampleComplaint, { duration: 'Over 6 months' }],
  ];
  for (const [cc, extra] of contexts) {
    if (key in extra) continue;
    const base = paneFeatures(cc, extra);
    for (const f of paneFeatures(cc, { ...extra, [key]: value })) if (!base.has(f)) found.add(f);
  }
  return [...found].sort();
}

// ── Checks ──────────────────────────────────────────────────────────────────────

export interface ChipAudit {
  frame: string; dim: string; label: string; iosKey: string; iosValue: string; webKey: string;
  ios: IosHit[]; web: string[]; recordOnly: string[];
}

export function auditChips(): ChipAudit[] {
  const out: ChipAudit[] = [];
  for (const frame of HISTORY_FRAMES) {
    for (const dim of frame.dimensions) {
      for (const opt of dim.options) {
        out.push({
          frame: frame.id, dim: dim.id, label: opt.label, iosKey: optionKey(dim, opt), iosValue: optionValue(opt),
          webKey: webKeyFor(dim), ios: iosHits(frame, optionKey(dim, opt), optionValue(opt)),
          web: webHits(frame, dim, opt), recordOnly: opt.recordOnly ?? [],
        });
      }
    }
  }
  return out;
}

/** Abdominal site vocabulary: only an abdominal frame (or the chest frame's Epigastric) may offer it. */
const ABDOMINAL_SITES = new Set(['RUQ', 'LUQ', 'RLQ', 'LLQ', 'Epigastric', 'Periumbilical', 'Suprapubic', 'Loin',
  'Right flank', 'Left flank', 'Right side', 'Left side', 'Diffuse']);
const ABDOMINAL_FRAMES = new Set(['pain.abdomen', 'lump.abdominal']);
/**
 * Pairs that cannot both be true: never both selectable in one multi-select question (a single-select
 * question, or an EXCLUDES link in frames.ts, keeps them apart).
 */
export const CONTRADICTIONS: [string, string][] = [
  ['Dry cough', 'Productive cough'], ['Sudden', 'Gradual'], ['Constant', 'Intermittent'], ['Constant', 'Episodic'],
  ['Painless', 'Tender'], ['Tender', 'Non-tender'], ['Reducible', 'Irreducible'], ['Mobile', 'Fixed'],
  ['Transilluminates', 'Does not transilluminate'], ['Can get above it', 'Cannot get above it'],
  ['Visible haematuria', 'Non-visible haematuria'], ['Unintentional', 'Intentional'], ['Pigmented', 'Non-pigmented'],
  ['Raised', 'Flat'], ['Pitting oedema', 'Non-pitting'], ['No radiation', 'Back'], ['Rapid growth', 'Stable'],
  ['Painless haematuria', 'Loin pain'], ['Stops by itself', 'Nothing'], ['Nothing', 'Rest'],
  ['Rapid full recovery', 'Prolonged confusion'], ['No skin change', 'Redness'],
];

export interface Problem { check: string; where: string; detail: string }

/** One label in two questions of a frame is fine for these pairs (different facts). */
const CROSS_DIM_OK: [string, string][] = [
  ['site', 'radiation'], ['associations', 'relieving'], ['exacerbating', 'relieving'],
];
function crossDimOk(a: string, b: string): boolean {
  return CROSS_DIM_OK.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}
function excluded(dim: FrameDimension, a: string, b: string): boolean {
  const oa = dim.options.find(o => o.label === a);
  const ob = dim.options.find(o => o.label === b);
  const ex = (o: FrameOption | undefined, other: string) => !!o?.excludes && (o.excludes.includes('*') || o.excludes.includes(other));
  return ex(oa, b) || ex(ob, a);
}
/** Web answer keys the SOCRATES pain rules read (socrates-to-features.ts KEY_RULES and head checks). */
const PAIN_WEB_KEYS = new Set(['onset', 'duration', 'site', 'character', 'radiation', 'assoc', 'pattern', 'timing',
  'triggers', 'relief', 'severity']);

export function checkFrameStructure(): Problem[] {
  const problems: Problem[] = [];
  const ids = new Set<string>();
  for (const frame of HISTORY_FRAMES) {
    if (ids.has(frame.id)) problems.push({ check: 'duplicate-frame', where: frame.id, detail: 'frame id used twice' });
    ids.add(frame.id);
    if (frame.type === 'pain' && frame.title !== 'SOCRATES') {
      problems.push({ check: 'socrates-label', where: frame.id, detail: 'a pain frame is titled SOCRATES' });
    }
    if (frame.type !== 'pain' && /socrates/i.test(frame.title)) {
      problems.push({ check: 'socrates-label', where: frame.id, detail: 'SOCRATES is the label for pain only' });
    }
    const dimIds = new Set<string>();
    const labelsInFrame = new Map<string, string>();
    const storedInFrame = new Map<string, string>();
    for (const dim of frame.dimensions) {
      const where = `${frame.id} › ${dim.id}`;
      if (dimIds.has(dim.id)) problems.push({ check: 'duplicate-dimension', where, detail: 'dimension id used twice' });
      dimIds.add(dim.id);
      if (dim.id === 'radiation' && frame.type !== 'pain') {
        problems.push({ check: 'radiation-not-pain', where, detail: 'only a pain history asks about radiation' });
      }
      const inDim = new Set<string>();
      const webInDim = new Set<string>();
      for (const opt of dim.options) {
        const w = `${where} › ${opt.label}`;
        if (/[,·→]/.test(opt.label)) problems.push({ check: 'label-chars', where: w, detail: 'no comma, · or → in a label (web answers are comma-joined)' });
        if (inDim.has(opt.label)) problems.push({ check: 'duplicate-chip', where: w, detail: 'label twice in one question' });
        const webLabel = webStoredLabel(opt.label);
        if (webInDim.has(webLabel)) problems.push({ check: 'duplicate-chip', where: w, detail: `the web stores "${webLabel}" for two chips of this question (parenthetical removed)` });
        webInDim.add(webLabel);
        inDim.add(opt.label);
        const prev = labelsInFrame.get(opt.label);
        if (prev && prev !== dim.id && !crossDimOk(prev, dim.id)) {
          problems.push({ check: 'duplicate-chip', where: w, detail: `label also in "${prev}"` });
        }
        labelsInFrame.set(opt.label, dim.id);
        const stored = `${optionKey(dim, opt)}=${optionValue(opt)}`;
        const prevS = storedInFrame.get(stored);
        if (prevS && prevS !== `${dim.id}/${opt.label}`) problems.push({ check: 'duplicate-chip', where: w, detail: `stores the same value as ${prevS}` });
        storedInFrame.set(stored, `${dim.id}/${opt.label}`);
        if (dim.id === 'site' && ABDOMINAL_SITES.has(opt.label) && !ABDOMINAL_FRAMES.has(frame.id)
          && !(frame.id === 'pain.chest' && opt.label === 'Epigastric')) {
          problems.push({ check: 'site-region', where: w, detail: 'abdominal site outside an abdominal frame' });
        }
        if (webStoredLabel(opt.label) === '') problems.push({ check: 'label-chars', where: w, detail: 'label is only a parenthetical' });
      }
      if (dim.multiSelect) {
        for (const [a, b] of CONTRADICTIONS) {
          if (inDim.has(a) && inDim.has(b) && !excluded(dim, a, b)) {
            problems.push({ check: 'contradiction', where, detail: `"${a}" and "${b}" both selectable in one multi-select question` });
          }
        }
      }
      const wk = webKeyFor(dim);
      if (frame.type === 'pain') {
        if (!PAIN_WEB_KEYS.has(wk) && !FRAME_PAIN_KEYS.has(wk)) {
          problems.push({ check: 'web-key', where, detail: `pain web key "${wk}" is read by no rule` });
        }
      } else if (wk !== 'onset' && wk !== 'duration' && !(wk in FRAME_KEY_RULES)) {
        problems.push({ check: 'web-key', where, detail: `web key "${wk}" must have an entry in FRAME_KEY_RULES (a pain key would give pain features)` });
      }
    }
    for (const s of frame.secondaryDims) {
      if (!dimIds.has(s)) problems.push({ check: 'secondary-dim', where: frame.id, detail: `secondaryDims names unknown dimension ${s}` });
    }
    for (const a of frame.aliases ?? []) {
      if (a.current && !frame.dimensions.some(dm => dm.options.some(o => o.label === a.current))) {
        problems.push({ check: 'alias', where: frame.id, detail: `alias ${a.legacy} → ${a.current}: no such option` });
      }
    }
    if (!frame.iosPools.includes('*')) {
      for (const p of frame.iosPools) {
        if (!db().pools[p]) problems.push({ check: 'ios-pool', where: frame.id, detail: `unknown DiagnosticDatabase pool ${p}` });
      }
    }
    for (const other of HISTORY_FRAMES) {
      if (other.type === frame.type) continue;
      const keys = new Set(frame.dimensions.map(webKeyFor));
      for (const id of other.secondaryDims) {
        const sd = other.dimensions.find(x => x.id === id);
        if (sd && keys.has(webKeyFor(sd))) {
          problems.push({ check: 'secondary-dim', where: `${other.id} › ${id}`, detail: `web key "${webKeyFor(sd)}" is also a question of ${frame.id} (secondary questions must not collide)` });
        }
      }
    }
    const choice = classifyComplaint(frame.sampleComplaint);
    if (choice.frameId !== frame.id) {
      problems.push({ check: 'sample-complaint', where: frame.id, detail: `sampleComplaint "${frame.sampleComplaint}" selects ${choice.frameId}` });
    }
  }
  return problems;
}

export function checkChipMapping(chips = auditChips()): Problem[] {
  const problems: Problem[] = [];
  for (const [key, rules] of Object.entries(FRAME_KEY_RULES)) {
    for (const rule of rules) {
      for (const f of rule.features) {
        if (!PANE_IDS.has(f)) problems.push({ check: 'web-rule-feature', where: `FRAME_KEY_RULES.${key}`, detail: `unknown pane feature ${f}` });
      }
    }
  }
  for (const c of chips) {
    const where = `${c.frame} › ${c.dim} › ${c.label}`;
    for (const [platform, mapped] of [['ios', c.ios.length > 0], ['web', c.web.length > 0]] as const) {
      const marked = c.recordOnly.includes(platform);
      if (!mapped && !marked) problems.push({ check: 'unmapped-chip', where, detail: `${platform}: feeds no engine feature and is not marked recordOnly` });
      if (mapped && marked) {
        const hit = platform === 'ios' ? c.ios.slice(0, 2).map(h => `${h.pool}:${h.key}=${h.value}`).join('; ') : c.web.join(', ');
        problems.push({ check: 'record-only-maps', where, detail: `${platform}: marked recordOnly but reaches ${hit}` });
      }
    }
  }
  return problems;
}

// ── Vectors: complaint → expected frame ────────────────────────────────────────

export interface FrameVector { complaint: string; system?: string; source: string; expectedFrame: string; secondary?: string[] }

export function loadVectors(): FrameVector[] {
  let text: string;
  try { text = readFileSync(VECTORS_PATH, 'utf8'); } catch { return []; }
  return (JSON.parse(text) as { vectors: FrameVector[] }).vectors;
}

export function checkVectors(entries: CorpusEntry[] = corpus(), vectors: FrameVector[] = loadVectors()): Problem[] {
  const problems: Problem[] = [];
  const byKey = new Map(vectors.map(v => [`${v.complaint}|${v.system ?? ''}`, v]));
  for (const e of entries) {
    const v = byKey.get(`${e.complaint}|${e.system ?? ''}`);
    if (!v) {
      problems.push({ check: 'vector-missing', where: `${e.source} "${e.complaint}"`, detail: 'no expected frame in HistoryFrameVectors.json (add one: gen:history-frames -- --vectors prints the current choice)' });
    }
  }
  for (const v of vectors) {
    const got = classifyComplaint(v.complaint, v.system);
    if (got.frameId !== v.expectedFrame) {
      problems.push({ check: 'frame-type', where: `"${v.complaint}"${v.system ? ` (${v.system})` : ''}`, detail: `expected ${v.expectedFrame}, got ${got.frameId}` });
    }
    if (v.secondary && JSON.stringify(got.secondary) !== JSON.stringify(v.secondary)) {
      problems.push({ check: 'frame-secondary', where: `"${v.complaint}"`, detail: `expected secondary ${v.secondary.join(', ') || '(none)'}, got ${got.secondary.join(', ') || '(none)'}` });
    }
    // Site options belong to the complaint's region.
    const resolved = resolveFrame(v.complaint, v.system);
    const site = resolved.dimensions.find(dm => dm.id === 'site' && !dm.secondary);
    if (site && !ABDOMINAL_FRAMES.has(resolved.frame.id)) {
      const bad = site.options.filter(o => ABDOMINAL_SITES.has(o.label) && !(resolved.frame.id === 'pain.chest' && o.label === 'Epigastric'));
      if (bad.length) problems.push({ check: 'site-region', where: `"${v.complaint}"`, detail: `abdominal sites ${bad.map(o => o.label).join(', ')}` });
    }
    if (resolved.frame.type !== 'pain' && resolved.dimensions.some(dm => !dm.secondary && dm.id === 'radiation')) {
      problems.push({ check: 'radiation-not-pain', where: `"${v.complaint}"`, detail: 'radiation offered for a non-pain complaint' });
    }
  }
  return problems;
}

// ── Swift twin ─────────────────────────────────────────────────────────────────

/** Parses the generated Swift (labels, values, keys per frame) and compares it with the TypeScript. */
export function checkSwiftTwin(): Problem[] {
  const problems: Problem[] = [];
  let swift = '';
  try { swift = readFileSync(SWIFT_DATA_PATH, 'utf8'); } catch {
    return [{ check: 'swift-twin', where: 'HistoryFrameData.swift', detail: 'missing: run gen:history-frames' }];
  }
  if (swift !== generateSwift()) {
    problems.push({ check: 'swift-twin', where: 'HistoryFrameData.swift', detail: 'out of date: run pnpm --filter @workspace/scripts run gen:history-frames' });
  }
  const parsed = new Map<string, string[]>();
  let current = '';
  for (const line of swift.split('\n')) {
    const f = /^\s+id: "([^"]+)", type: "/.exec(line);
    if (f) { current = f[1]!; parsed.set(current, []); continue; }
    const o = /HistoryOptionSpec\(label: "((?:[^"\\]|\\.)*)", value: "((?:[^"\\]|\\.)*)", key: "([^"]+)"/.exec(line);
    if (o && current) parsed.get(current)!.push(`${o[3]}=${o[2]} (${o[1]})`);
  }
  for (const frame of HISTORY_FRAMES) {
    const want = frame.dimensions.flatMap(dm => dm.options.map(op => `${optionKey(dm, op)}=${optionValue(op)} (${op.label})`));
    const got = parsed.get(frame.id);
    if (!got) { problems.push({ check: 'swift-twin', where: frame.id, detail: 'frame missing from HistoryFrameData.swift' }); continue; }
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      problems.push({ check: 'swift-twin', where: frame.id, detail: 'chips differ from the TypeScript' });
    }
  }
  return problems;
}

// ── Vignettes ──────────────────────────────────────────────────────────────────

/** Every value a chip stores, per iOS key (current options, aliases and the specialty early-form chips). */
export function knownIosValues(): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const add = (k: string, v: string) => { if (!m.has(k)) m.set(k, new Set()); m.get(k)!.add(v); };
  for (const f of HISTORY_FRAMES) {
    for (const dm of f.dimensions) for (const op of dm.options) add(optionKey(dm, op), optionValue(op));
    for (const a of f.aliases ?? []) add(a.key, a.legacy);
  }
  // Quick Clinical Flags (EFChip dimId/value), which store into the same selections.
  const dir = join(ROOT, 'ios/AmiseMedFlow/Views/Consultation');
  for (const file of readdirSync(dir).filter(n => /EarlyForms|SpecialtyForms/.test(n))) {
    const src = readFileSync(join(dir, file), 'utf8');
    for (const x of src.matchAll(/EFChip\(label:\s*"[^"]*",\s*dimId:\s*"([^"]+)",\s*value:\s*"([^"]*)"/g)) add(x[1]!, x[2]!);
  }
  return m;
}

export function checkVignettes(): Problem[] {
  const problems: Problem[] = [];
  const known = knownIosValues();
  const dir = join(ROOT, 'ios/AmiseMedFlowTests/ClinicalValidation/Vignettes');
  for (const file of readdirSync(dir).filter(n => n.endsWith('.json')).sort()) {
    const v = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    const inputs = v.inputs ?? {};
    const sets: Record<string, string[]>[] = [inputs.socrates ?? {}, inputs.platform?.ios?.socratesSelections ?? {}];
    for (const s of sets) {
      for (const [k, vals] of Object.entries(s)) {
        for (const val of vals ?? []) {
          if (!known.get(k)?.has(val)) problems.push({ check: 'vignette-ios-chip', where: file, detail: `${k}: "${val}" is not a chip value` });
        }
      }
    }
    const details: Record<string, string[]> = inputs.platform?.web?.symptomDetails ?? {};
    for (const [sym, vals] of Object.entries(details)) {
      const branches = SYMPTOM_BRANCHES[sym] ?? SYMPTOM_BRANCHES[sym.toLowerCase()];
      if (!branches) { problems.push({ check: 'vignette-web-chip', where: file, detail: `symptomDetails "${sym}" has no SmartSymptomPicker branch` }); continue; }
      const opts = new Set(branches.flatMap(b => b.options));
      for (const val of vals) if (!opts.has(val)) problems.push({ check: 'vignette-web-chip', where: file, detail: `${sym}: "${val}" is not a SmartSymptomPicker option` });
    }
  }
  return problems;
}

export function runAudit(): { problems: Problem[]; chips: ChipAudit[] } {
  const chips = auditChips();
  const problems = [
    ...checkFrameStructure(), ...checkChipMapping(chips), ...checkVectors(), ...checkSwiftTwin(), ...checkVignettes(),
  ];
  return { problems, chips };
}
