/**
 * Drift check: the iOS negation matcher tests (ios/AmiseMedFlowTests/NegationMatcherTests.swift)
 * must assert the same phrases, terms and expected results, in the same order, as the web tests
 * (artifacts/dashboard/src/lib/__tests__/negation.test.ts). The two matchers
 * (lib/triage-engine/src/negation.ts, ios/AmiseMedFlow/Services/NegationMatcher.swift) are twins;
 * the Swift side cannot run on Linux CI, so this keeps at least their vectors identical.
 *
 * Only assertions written with literal strings are compared. The Swift file's section after
 * "MARK: - iOS-only" is not part of the comparison.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WEB_TESTS = join(REPO_ROOT, 'artifacts/dashboard/src/lib/__tests__/negation.test.ts');
const IOS_TESTS = join(REPO_ROOT, 'ios/AmiseMedFlowTests/NegationMatcherTests.swift');

type Vector =
  | { kind: 'list'; name: string; pairs: Array<[string, string]>; expected?: boolean }
  | { kind: 'contains'; text: string; term: string; wholeWord: boolean; expected: boolean }
  | { kind: 'regex'; pattern: string; text: string; expected: boolean }
  | { kind: 'any'; text: string; terms: string[]; expected: boolean };

const LIT = String.raw`'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"`;

function unquote(lit: string): string {
  return lit.slice(1, -1).replace(/\\(.)/g, '$1');
}

function literals(list: string): string[] {
  return [...list.matchAll(new RegExp(LIT, 'g'))].map(m => unquote(m[0]));
}

/** Vectors in file order. `listRe` finds a pair list, `pairRe` a pair in it. */
function parse(src: string, res: {
  list: RegExp; pair: RegExp; contains: RegExp; regex: RegExp; any: RegExp; listUse: RegExp;
}): Vector[] {
  type Hit = { at: number; v: Vector | { kind: 'use'; expected: boolean } };
  const hits: Hit[] = [];
  for (const m of src.matchAll(res.list)) {
    const pairs = [...m[2].matchAll(res.pair)].map(p => [unquote(p[1]), unquote(p[2])] as [string, string]);
    hits.push({ at: m.index!, v: { kind: 'list', name: m[1], pairs } });
  }
  for (const m of src.matchAll(res.contains)) {
    const g = m.groups!;
    hits.push({ at: m.index!, v: { kind: 'contains', text: unquote(g.text), term: unquote(g.term), wholeWord: !!g.whole, expected: g.exp === 'true' || g.exp === 'True' } });
  }
  for (const m of src.matchAll(res.regex)) {
    const g = m.groups!;
    hits.push({ at: m.index!, v: { kind: 'regex', pattern: g.pattern, text: unquote(g.text), expected: g.exp === 'true' || g.exp === 'True' } });
  }
  for (const m of src.matchAll(res.any)) {
    const g = m.groups!;
    hits.push({ at: m.index!, v: { kind: 'any', text: unquote(g.text), terms: literals(g.terms), expected: g.exp === 'true' || g.exp === 'True' } });
  }
  for (const m of src.matchAll(res.listUse)) {
    const g = m.groups!;
    hits.push({ at: m.index!, v: { kind: 'use', expected: g.exp === 'true' || g.exp === 'True' } });
  }
  hits.sort((a, b) => a.at - b.at);
  const out: Vector[] = [];
  for (const h of hits) {
    if (h.v.kind === 'use') {
      const list = [...out].reverse().find(v => v.kind === 'list' && v.expected === undefined);
      if (list && list.kind === 'list') list.expected = h.v.expected;
      continue;
    }
    out.push(h.v);
  }
  // List names differ between the files (cases/kept vs negatedCases/…); compare content only.
  return out.map(v => (v.kind === 'list' ? { ...v, name: '' } : v));
}

function webVectors(): Vector[] {
  const src = readFileSync(WEB_TESTS, 'utf8');
  return parse(src, {
    list: /const (\w+): Array<\[string, string\]> = \[([\s\S]*?)\n\s*\];/g,
    pair: new RegExp(String.raw`\[\s*(${LIT})\s*,\s*(${LIT})\s*\]`, 'g'),
    contains: new RegExp(String.raw`expect\(containsAffirmed\((?<text>${LIT}), (?<term>${LIT})(?<whole>, \{ wholeWord: true \})?\)\)\.toBe\((?<exp>true|false)\)`, 'g'),
    regex: new RegExp(String.raw`expect\(testAffirmed\(\/(?<pattern>(?:[^/\\\n]|\\.)+)\/\w*, (?<text>${LIT})\)\)\.toBe\((?<exp>true|false)\)`, 'g'),
    any: new RegExp(String.raw`expect\(containsAnyAffirmed\((?<text>${LIT}), \[(?<terms>(?:${LIT})(?:, (?:${LIT}))*)\]\)\)\.toBe\((?<exp>true|false)\)`, 'g'),
    listUse: /expect\(containsAffirmed\(text, term\)\)\.toBe\((?<exp>true|false)\)/g,
  });
}

function iosVectors(): Vector[] {
  const full = readFileSync(IOS_TESTS, 'utf8');
  const cut = full.indexOf('MARK: - iOS-only');
  const src = cut >= 0 ? full.slice(0, cut) : full;
  return parse(src, {
    list: /static let (\w+): \[\(String, String\)\] = \[([\s\S]*?)\n\s*\]/g,
    pair: new RegExp(String.raw`\(\s*(${LIT})\s*,\s*(${LIT})\s*\)`, 'g'),
    contains: new RegExp(String.raw`XCTAssert(?<exp>True|False)\(affirmed(?<whole>Whole)?\((?<text>${LIT}), (?<term>${LIT})\)`, 'g'),
    regex: new RegExp(String.raw`XCTAssert(?<exp>True|False)\(NegationMatcher\.testAffirmed\(#"(?<pattern>.*?)"#, (?<text>${LIT})\)\)`, 'g'),
    any: new RegExp(String.raw`XCTAssert(?<exp>True|False)\(NegationMatcher\.containsAnyAffirmed\((?<text>${LIT}), \[(?<terms>(?:${LIT})(?:, (?:${LIT}))*)\]\)\)`, 'g'),
    listUse: /XCTAssert(?<exp>True|False)\(affirmed\(text, term\)/g,
  });
}

describe('negation matcher: web and iOS test vectors are twins', () => {
  it('parses a meaningful number of vectors from both files', () => {
    const web = webVectors();
    const listPairs = web.filter(v => v.kind === 'list').reduce((n, v) => n + (v.kind === 'list' ? v.pairs.length : 0), 0);
    expect(listPairs).toBeGreaterThanOrEqual(60);
    expect(web.filter(v => v.kind === 'contains').length).toBeGreaterThanOrEqual(20);
    expect(web.filter(v => v.kind === 'regex').length).toBe(3);
    expect(web.every(v => v.kind !== 'list' || v.expected !== undefined)).toBe(true);
  });

  it('asserts the same phrases, terms and results in the same order', () => {
    expect(iosVectors()).toEqual(webVectors());
  });
});
