/**
 * Clinical validation — grading rules.
 *
 * MIRRORED IN SWIFT: ios/AmiseMedFlowTests/ClinicalValidation/ClinValGrader.swift. Any change to
 * normalisation, matching, defaults or verdicts must be made in both files in the same commit, or
 * the two platforms will grade the same vignette differently. The rules are documented in
 * docs/clinical-validation/README.md ("Grading").
 */

import type {
  ClinvalResult, DxExpectation, EngineOutputs, EqualsExpectation, ExpectationBase, ExpectationKind, ExpectationResult,
  ExpectationStatus, Level, LevelExpectation, Platform, PlatformFlag, ResultSummary,
  ScoreRecommendedExpectation, ScoreValueExpectation,
  SourcedText, TextExpectation, Vignette,
} from './types';
import { LEVELS } from './types';

export const PRIMARY_DX_SOURCE: Record<Platform, string> = { ios: 'ios.bayes', web: 'web.pane' };
export const DEFAULT_TOP_K = 3;

// ── Normalisation and matching ───────────────────────────────────────────────

export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when ANY alternative matches. `icd` is only used by 'icd:' alternatives. */
export function matchesAny(text: string, alternatives: string[], icd?: string): boolean {
  const t = normalise(text);
  for (const alt of alternatives) {
    if (alt.startsWith('re:')) {
      if (new RegExp(alt.slice(3), 'i').test(t)) return true;
    } else if (alt.startsWith('icd:')) {
      if (icd && icd.toUpperCase().startsWith(alt.slice(4).toUpperCase())) return true;
    } else if (t.includes(normalise(alt))) {
      return true;
    }
  }
  return false;
}

export function counts(text: string, match: string[], unless?: string[], icd?: string): boolean {
  if (!matchesAny(text, match, icd)) return false;
  return !(unless && unless.length && matchesAny(text, unless, icd));
}

export function flagFor(flag: PlatformFlag | undefined, platform: Platform): boolean {
  if (flag === undefined || flag === false) return false;
  if (flag === true) return true;
  return flag.includes(platform);
}

export function levelIndex(level: Level): number {
  return LEVELS.indexOf(level);
}

function sourceAllowed(source: string, prefixes: string[] | undefined): boolean {
  return !prefixes || prefixes.length === 0 || prefixes.some(p => source.startsWith(p));
}

/** Up to ~160 characters of `text` around the first alternative that matches (display only). */
export function snippet(text: string, alternatives: string[]): string {
  const t = normalise(text);
  let at = -1;
  let len = 0;
  for (const alt of alternatives) {
    if (alt.startsWith('icd:')) continue;
    if (alt.startsWith('re:')) {
      const m = new RegExp(alt.slice(3), 'i').exec(t);
      if (m) { at = m.index; len = m[0].length; break; }
    } else {
      const i = t.indexOf(normalise(alt));
      if (i >= 0) { at = i; len = normalise(alt).length; break; }
    }
  }
  if (at < 0) return t.length > 160 ? `${t.slice(0, 157)}...` : t;
  const start = Math.max(0, at - 60);
  const end = Math.min(t.length, at + len + 80);
  return `${start > 0 ? '...' : ''}${t.slice(start, end)}${end < t.length ? '...' : ''}`;
}

function shortList(items: string[], max = 6): string {
  const shown = items.slice(0, max).map(s => (s.length > 90 ? `${s.slice(0, 87)}...` : s));
  return shown.join(' | ') + (items.length > max ? ` | (+${items.length - max} more)` : '');
}

// ── Grading ──────────────────────────────────────────────────────────────────

interface Verdict { status: ExpectationStatus; detail: string }

function gradeDx(exp: DxExpectation, kind: ExpectationKind, out: EngineOutputs, platform: Platform): Verdict {
  const source = exp.source ?? PRIMARY_DX_SOURCE[platform];
  const list = out.differentials[source];
  if (!list) return { status: 'na', detail: `differential source ${source} not produced on ${platform}` };
  const k = exp.k ?? (kind === 'mustRankTopK' ? DEFAULT_TOP_K : list.length);
  const itemText = (d: { name: string; id?: string }) => `${d.name} [${d.id ?? ''}]`;
  const hit = list.find(d => d.rank <= k && counts(itemText(d), exp.match, exp.unless, d.icd10));
  const elsewhere = Object.entries(out.differentials)
    .filter(([s]) => s !== source)
    .map(([s, l]) => {
      const h = l.find(d => counts(itemText(d), exp.match, exp.unless, d.icd10));
      return h ? `${s}#${h.rank}` : null;
    })
    .filter((x): x is string => x !== null);
  const also = elsewhere.length ? `; also in ${elsewhere.join(', ')}` : '';
  if (hit) return { status: 'pass', detail: `'${hit.name}' at rank ${hit.rank} of ${source} (k=${k})${also}` };
  const names = list.map(d => `${d.rank}. ${d.name}`);
  return {
    status: 'fail',
    detail: `not in top ${k} of ${source}: ${list.length ? shortList(names, k + 2) : '(empty list)'}${also}`,
  };
}

function textItems(kind: 'alarms' | 'redFlags' | 'investigations' | 'management', out: EngineOutputs): SourcedText[] {
  if (kind === 'alarms') return out.alarms.map(a => ({ source: a.source, text: `${a.title} — ${a.detail}` }));
  if (kind === 'redFlags') {
    return [...out.redFlags, ...out.alarms.map(a => ({ source: a.source, text: `${a.title} — ${a.detail}` }))];
  }
  return out[kind];
}

function gradeText(
  exp: TextExpectation, mode: 'include' | 'exclude',
  kind: 'alarms' | 'redFlags' | 'investigations' | 'management',
  out: EngineOutputs, platform: Platform,
): Verdict {
  if (exp.sources && exp.sources.length && !exp.sources.some(s => s.startsWith(`${platform}.`))) {
    return { status: 'na', detail: `sources ${exp.sources.join(', ')} are not ${platform} sources` };
  }
  const items = textItems(kind, out).filter(i => sourceAllowed(i.source, exp.sources));
  const hits = items.filter(i => counts(i.text, exp.match, exp.unless));
  const label = kind === 'alarms' ? 'alarm' : kind === 'redFlags' ? 'red flag' : kind === 'investigations' ? 'investigation' : 'management item';
  if (mode === 'include') {
    if (hits.length) return { status: 'pass', detail: `${label} found in ${hits[0].source}: "${snippet(hits[0].text, exp.match)}"` };
    return {
      status: 'fail',
      detail: items.length
        ? `no ${label} matched among ${items.length} (${[...new Set(items.map(i => i.source))].join(', ')})`
        : `no ${label} output${exp.sources ? ` from ${exp.sources.join(', ')}` : ''} on ${platform}`,
    };
  }
  if (hits.length) {
    return { status: 'fail', detail: `forbidden ${label} present in ${hits[0].source}: "${snippet(hits[0].text, exp.match)}"${hits.length > 1 ? ` (+${hits.length - 1} more)` : ''}` };
  }
  return { status: 'pass', detail: `none of ${items.length} ${label}s matched` };
}

function gradeScoreValue(exp: ScoreValueExpectation, out: EngineOutputs, platform: Platform): Verdict {
  const items = out.scoreValues.filter(s => s.score === exp.score && s.mode === exp.mode);
  if (!items.length) return { status: 'na', detail: `no ${exp.mode} for ${exp.score} on ${platform}` };
  const want = [
    exp.equals !== undefined ? `= ${exp.equals}` : null,
    exp.min !== undefined ? `≥ ${exp.min}` : null,
    exp.max !== undefined ? `≤ ${exp.max}` : null,
  ].filter(Boolean).join(', ');
  const bad: string[] = [];
  const all: string[] = [];
  for (const it of items) {
    const v = it.value;
    all.push(`${it.source}=${v === null ? 'null' : v}${it.label ? ` (${it.label.slice(0, 60)})` : ''}`);
    const ok = v !== null
      && (exp.equals === undefined || Math.abs(v - exp.equals) < 1e-6)
      && (exp.min === undefined || v >= exp.min - 1e-6)
      && (exp.max === undefined || v <= exp.max + 1e-6);
    if (!ok) bad.push(it.source);
  }
  return bad.length
    ? { status: 'fail', detail: `expected ${want}; got ${all.join('; ')}` }
    : { status: 'pass', detail: `${want}: ${all.join('; ')}` };
}

function defaultPlatforms(kind: ExpectationKind): Platform[] {
  if (kind === 'pathway') return ['ios'];
  if (kind === 'dxVariant') return ['web'];
  return ['ios', 'web'];
}

function result(
  exp: ExpectationBase, kind: ExpectationKind, platform: Platform, verdict: Verdict,
): ExpectationResult {
  const knownGap = flagFor(exp.knownGap, platform);
  const unverified = flagFor(exp.unverified, platform);
  const detail = verdict.status === 'fail' && knownGap && exp.knownGapNote
    ? `${verdict.detail} [known gap: ${exp.knownGapNote}]`
    : verdict.detail;
  return {
    id: exp.id,
    kind,
    severity: exp.severity,
    status: verdict.status,
    detail,
    knownGap,
    unverified,
    blocking: exp.severity === 'critical' && verdict.status === 'fail' && !knownGap && !unverified,
    gapResolved: verdict.status === 'pass' && (knownGap || unverified),
    guidelineRefs: exp.guidelineRefs ?? [],
    note: exp.note,
    proposedFix: exp.proposedFix,
  };
}

/** Every expectation of the vignette as [kind, expectation] pairs, in report order. */
export function listExpectations(v: Vignette): [ExpectationKind, ExpectationBase][] {
  const e = v.expected;
  const out: [ExpectationKind, ExpectationBase][] = [];
  for (const x of e.differential?.mustRankTopK ?? []) out.push(['mustRankTopK', x]);
  for (const x of e.differential?.mustNotMiss ?? []) out.push(['mustNotMiss', x]);
  if (e.safety?.emergencyLevel) out.push(['emergencyLevel', e.safety.emergencyLevel]);
  for (const x of e.safety?.mustAlarm ?? []) out.push(['mustAlarm', x]);
  for (const x of e.safety?.mustNotAlarm ?? []) out.push(['mustNotAlarm', x]);
  for (const x of e.safety?.redFlags ?? []) out.push(['redFlags', x]);
  for (const x of e.scores?.recommended ?? []) out.push(['scoreRecommended', x]);
  for (const x of e.scores?.values ?? []) out.push(['scoreValue', x]);
  for (const x of e.investigations?.mustInclude ?? []) out.push(['investigationInclude', x]);
  for (const x of e.investigations?.mustExclude ?? []) out.push(['investigationExclude', x]);
  for (const x of e.management?.mustInclude ?? []) out.push(['managementInclude', x]);
  for (const x of e.management?.mustExclude ?? []) out.push(['managementExclude', x]);
  if (e.pathway) out.push(['pathway', e.pathway]);
  if (e.dxVariant) out.push(['dxVariant', e.dxVariant]);
  return out;
}

export function gradeVignette(v: Vignette, out: EngineOutputs, platform: Platform): ExpectationResult[] {
  const results: ExpectationResult[] = [];
  for (const [kind, exp] of listExpectations(v)) {
    const platforms = exp.platforms ?? defaultPlatforms(kind);
    if (!platforms.includes(platform)) {
      results.push(result(exp, kind, platform, { status: 'na', detail: `not applicable to ${platform}` }));
      continue;
    }
    let verdict: Verdict;
    switch (kind) {
      case 'mustRankTopK':
      case 'mustNotMiss':
        verdict = gradeDx(exp as DxExpectation, kind, out, platform);
        break;
      case 'emergencyLevel': {
        const le = exp as LevelExpectation;
        if (!out.emergencyLevel) { verdict = { status: 'na', detail: `no emergency level on ${platform}` }; break; }
        const got = out.emergencyLevel.level;
        if (got === null) { verdict = { status: 'fail', detail: `level not determined (${out.emergencyLevel.raw})` }; break; }
        const okLow = !le.atLeast || levelIndex(got) >= levelIndex(le.atLeast);
        const okHigh = !le.atMost || levelIndex(got) <= levelIndex(le.atMost);
        const want = [le.atLeast ? `≥ ${le.atLeast}` : null, le.atMost ? `≤ ${le.atMost}` : null].filter(Boolean).join(', ');
        verdict = {
          status: okLow && okHigh ? 'pass' : 'fail',
          detail: `${out.emergencyLevel.source}: ${got} (${out.emergencyLevel.raw}); expected ${want}`,
        };
        break;
      }
      case 'mustAlarm': verdict = gradeText(exp as TextExpectation, 'include', 'alarms', out, platform); break;
      case 'mustNotAlarm': verdict = gradeText(exp as TextExpectation, 'exclude', 'alarms', out, platform); break;
      case 'redFlags': verdict = gradeText(exp as TextExpectation, 'include', 'redFlags', out, platform); break;
      case 'scoreRecommended': {
        const key = (exp as ScoreRecommendedExpectation).score;
        const hit = out.recommendedScores.find(r => r.score === key);
        const all = [...new Set(out.recommendedScores.map(r => r.score))];
        verdict = hit
          ? { status: 'pass', detail: `${key} recommended by ${hit.source}` }
          : { status: 'fail', detail: `${key} not recommended; recommended: ${all.length ? all.join(', ') : '(none)'}` };
        break;
      }
      case 'scoreValue': verdict = gradeScoreValue(exp as ScoreValueExpectation, out, platform); break;
      case 'investigationInclude': verdict = gradeText(exp as TextExpectation, 'include', 'investigations', out, platform); break;
      case 'investigationExclude': verdict = gradeText(exp as TextExpectation, 'exclude', 'investigations', out, platform); break;
      case 'managementInclude': verdict = gradeText(exp as TextExpectation, 'include', 'management', out, platform); break;
      case 'managementExclude': verdict = gradeText(exp as TextExpectation, 'exclude', 'management', out, platform); break;
      case 'pathway': {
        const want = (exp as EqualsExpectation).equals;
        verdict = !out.pathway
          ? { status: 'na', detail: `no consultation pathway on ${platform}` }
          : { status: out.pathway.value === want ? 'pass' : 'fail', detail: `recommended ${out.pathway.value} (${out.pathway.reasons.join('; ')}); expected ${want}` };
        break;
      }
      case 'dxVariant': {
        const want = (exp as EqualsExpectation).equals;
        verdict = !out.dxVariant
          ? { status: 'na', detail: `no dx-variant engine on ${platform}` }
          : {
            status: out.dxVariant.value === want ? 'pass' : 'fail',
            detail: `detected ${out.dxVariant.value ?? '(none)'} in group ${out.dxVariant.group ?? '(none)'}; expected ${want}`,
          };
        break;
      }
    }
    results.push(result(exp, kind, platform, verdict));
  }
  return results;
}

export function summarise(results: ExpectationResult[]): ResultSummary {
  const s: ResultSummary = {
    total: results.length, pass: 0, fail: 0, na: 0, criticalFail: 0, qualityFail: 0,
    blocking: 0, knownGapFail: 0, unverifiedFail: 0, gapResolved: 0,
  };
  for (const r of results) {
    s[r.status] += 1;
    if (r.status === 'fail') {
      if (r.severity === 'critical') s.criticalFail += 1; else s.qualityFail += 1;
      if (r.knownGap) s.knownGapFail += 1;
      else if (r.unverified) s.unverifiedFail += 1;
    }
    if (r.blocking) s.blocking += 1;
    if (r.gapResolved) s.gapResolved += 1;
  }
  return s;
}

export function addSummaries(list: ResultSummary[]): ResultSummary {
  const t: ResultSummary = {
    total: 0, pass: 0, fail: 0, na: 0, criticalFail: 0, qualityFail: 0,
    blocking: 0, knownGapFail: 0, unverifiedFail: 0, gapResolved: 0,
  };
  for (const s of list) for (const k of Object.keys(t) as (keyof ResultSummary)[]) t[k] += s[k];
  return t;
}

export function buildResult(v: Vignette, platform: Platform, outputs: EngineOutputs, generatedAt: string): ClinvalResult {
  const expectations = gradeVignette(v, outputs, platform);
  return {
    type: 'clinval-result',
    schemaVersion: 1,
    platform,
    vignetteId: v.id,
    condition: v.condition,
    category: v.category,
    permutationOf: v.permutationOf,
    permutationLabel: v.permutationLabel,
    generatedAt,
    outputs,
    expectations,
    summary: summarise(expectations),
  };
}
