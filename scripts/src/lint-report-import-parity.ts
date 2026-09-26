/**
 * Lab report import parity lint: the web (TypeScript) and iOS (Swift) report importers must read
 * a lab report the same way, so the analyte catalogue must be identical on both platforms.
 *
 * Parses the iOS catalogue from SOURCE (no Swift toolchain needed):
 *   iOS  ios/AmiseMedFlow/Services/LabAnalyteCatalog.swift
 *        (LabUnits.replacements / synonyms / known, LabAnalyteCatalog.scoreAnalytes /
 *         otherAnalytes, LabScoreKeywords.groups)
 * and compares it with the TypeScript port, imported directly:
 *   web  lib/triage-engine/src/report-import/catalog.ts
 *
 * Fails when, for any analyte (matched by key):
 *   - it exists on one platform only, or sits in a different list (score / other) or position;
 *   - the saved name, the aliases (synonyms, in order), the app unit or the unit aliases differ;
 *   - a conversion (unit → factor) or an ambiguous unit (unit → reason) differs;
 *   - unitRequired, the plausible range, the misread rule, decimals or the qualifier remaps differ.
 * and when the unit spellings (replacement steps, synonyms, known units) or the iOS score keyword
 * groups differ. Defaults of the Swift `a(…)` helper are read from its signature, so a changed
 * default is caught too.
 *
 * The parser and the unit/analyte rules are also covered by the ported iOS test vectors in
 * artifacts/dashboard/src/lib/__tests__/report-import-parity.test.ts.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  IOS_SCORE_KEYWORD_GROUPS, KNOWN_UNITS, OTHER_ANALYTES, SCORE_ANALYTES, UNIT_REPLACEMENTS,
  UNIT_SYNONYMS, type LabAnalyte,
} from '../../lib/triage-engine/src/report-import/catalog';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const SWIFT_FILE = 'ios/AmiseMedFlow/Services/LabAnalyteCatalog.swift';
const TS_FILE = 'lib/triage-engine/src/report-import/catalog.ts';

// ── Swift tokeniser (literal subset used by the catalogue) ───────────────────────

type Tok = { t: 'str' | 'id' | 'num' | 'p'; v: string; pos: number };

function decodeSwiftEscape(src: string, j: number): [string, number] {
  const c = src[j + 1];
  if (c === 'u' && src[j + 2] === '{') {
    const end = src.indexOf('}', j + 3);
    return [String.fromCodePoint(parseInt(src.slice(j + 3, end), 16)), end + 1];
  }
  const simple: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0', '"': '"', "'": "'", '\\': '\\' };
  return [simple[c] ?? c, j + 2];
}

function tokenise(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '#' && src[i + 1] === '"') {
      // Raw string #"…"# (no escapes).
      const e = src.indexOf('"#', i + 2);
      out.push({ t: 'str', v: src.slice(i + 2, e), pos: i });
      i = e + 2;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let v = '';
      while (j < n && src[j] !== '"') {
        if (src[j] === '\\') { const [ch, k] = decodeSwiftEscape(src, j); v += ch; j = k; continue; }
        v += src[j++];
      }
      out.push({ t: 'str', v, pos: i });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j), pos: i });
      i = j;
      continue;
    }
    if (/[0-9]/.test(c)) {
      const m = /^[0-9][0-9_]*(?:\.[0-9][0-9_]*)?(?:[eE][+-]?[0-9]+)?/.exec(src.slice(i))!;
      out.push({ t: 'num', v: m[0].replace(/_/g, ''), pos: i });
      i += m[0].length;
      continue;
    }
    if (src.startsWith('...', i)) { out.push({ t: 'p', v: '...', pos: i }); i += 3; continue; }
    if (src.startsWith('..<', i)) { out.push({ t: 'p', v: '..<', pos: i }); i += 3; continue; }
    if (src.startsWith('->', i)) { out.push({ t: 'p', v: '->', pos: i }); i += 2; continue; }
    out.push({ t: 'p', v: c, pos: i });
    i++;
  }
  return out;
}

// ── Evaluator ────────────────────────────────────────────────────────────────────

type Val =
  | { k: 'str'; v: string }
  | { k: 'num'; v: number }
  | { k: 'bool'; v: boolean }
  | { k: 'nil' }
  | { k: 'arr'; v: Val[] }                          // array or tuple
  | { k: 'dict'; v: Map<string, Val> }
  | { k: 'range'; lo: number; hi: number }
  | { k: 'call'; fn: string; pos: Val[]; named: Map<string, Val> };

class SwiftSource {
  private toks: Tok[];
  private decls = new Map<string, number>();
  private cache = new Map<string, Val>();

  constructor(readonly file: string, readonly src: string) {
    this.toks = tokenise(src);
    // `let NAME … =` — first declaration of each name wins.
    for (let i = 0; i < this.toks.length - 1; i++) {
      const tk = this.toks[i];
      if (tk.t !== 'id' || tk.v !== 'let') continue;
      const name = this.toks[i + 1];
      if (name.t !== 'id' || this.decls.has(name.v)) continue;
      let depth = 0;
      for (let j = i + 2; j < this.toks.length; j++) {
        const v = this.toks[j];
        if (v.t !== 'p') continue;
        if ('([{'.includes(v.v)) depth++;
        else if (')]}'.includes(v.v)) depth--;
        else if (v.v === '=' && depth === 0) { this.decls.set(name.v, j + 1); break; }
        if (depth < 0) break;
      }
    }
  }

  value(name: string): Val {
    const hit = this.cache.get(name);
    if (hit) return hit;
    const at = this.decls.get(name);
    if (at === undefined) throw new Error(`${this.file}: no declaration of "${name}"`);
    const [v] = this.expr(at);
    this.cache.set(name, v);
    return v;
  }

  private fail(i: number, msg: string): never {
    const near = this.toks.slice(i, i + 10).map(t => t.v).join(' ');
    throw new Error(`${this.file}: ${msg} near "${near}"`);
  }

  private expr(i: number): [Val, number] {
    const [v, j] = this.primary(i);
    if (this.toks[j]?.v === '...') {
      const [w, k] = this.primary(j + 1);
      if (v.k !== 'num' || w.k !== 'num') this.fail(j, 'range bounds must be numbers');
      return [{ k: 'range', lo: v.v, hi: w.v }, k];
    }
    return [v, j];
  }

  private primary(i: number): [Val, number] {
    const tk = this.toks[i];
    if (!tk) return this.fail(i, 'unexpected end of file');
    if (tk.t === 'str') return [{ k: 'str', v: tk.v }, i + 1];
    if (tk.t === 'num') return [{ k: 'num', v: Number(tk.v) }, i + 1];
    if (tk.v === '-' && this.toks[i + 1]?.t === 'num') return [{ k: 'num', v: -Number(this.toks[i + 1].v) }, i + 2];
    if (tk.v === '[') return this.list(i + 1);
    if (tk.v === '(') return this.tuple(i + 1);
    if (tk.t === 'id') {
      if (tk.v === 'nil') return [{ k: 'nil' }, i + 1];
      if (tk.v === 'true' || tk.v === 'false') return [{ k: 'bool', v: tk.v === 'true' }, i + 1];
      if (this.toks[i + 1]?.v === '(') return this.call(tk.v, i + 2);
      return [this.value(tk.v), i + 1];
    }
    return this.fail(i, `unexpected token "${tk.v}"`);
  }

  /** `[a, b]`, `[]`, `["k": v]`, `[:]`. */
  private list(i: number): [Val, number] {
    if (this.toks[i]?.v === ':' && this.toks[i + 1]?.v === ']') return [{ k: 'dict', v: new Map() }, i + 2];
    const arr: Val[] = [];
    const dict = new Map<string, Val>();
    let isDict = false;
    let j = i;
    while (this.toks[j]?.v !== ']') {
      const [v, k] = this.expr(j);
      if (this.toks[k]?.v === ':') {
        if (v.k !== 'str') this.fail(j, 'dictionary key is not a string');
        isDict = true;
        const [w, m] = this.expr(k + 1);
        if (dict.has(v.v)) this.fail(j, `duplicate dictionary key "${v.v}"`);
        dict.set(v.v, w);
        j = m;
      } else {
        arr.push(v);
        j = k;
      }
      if (this.toks[j]?.v === ',') j++;
      else if (this.toks[j]?.v !== ']') this.fail(j, 'expected "," or "]"');
    }
    return [isDict ? { k: 'dict', v: dict } : { k: 'arr', v: arr }, j + 1];
  }

  /** `(a, b)` tuple (labels `word:` inside a tuple are skipped). */
  private tuple(i: number): [Val, number] {
    const arr: Val[] = [];
    let j = i;
    while (this.toks[j]?.v !== ')') {
      if (this.toks[j]?.t === 'id' && this.toks[j + 1]?.v === ':') j += 2;
      const [v, k] = this.expr(j);
      arr.push(v);
      j = k;
      if (this.toks[j]?.v === ',') j++;
      else if (this.toks[j]?.v !== ')') this.fail(j, 'expected "," or ")"');
    }
    return [{ k: 'arr', v: arr }, j + 1];
  }

  /** Call arguments after `(`: positional and `label: value`. */
  private call(fn: string, i: number): [Val, number] {
    const pos: Val[] = [];
    const named = new Map<string, Val>();
    let j = i;
    while (this.toks[j]?.v !== ')') {
      if (this.toks[j]?.t === 'id' && this.toks[j + 1]?.v === ':') {
        const label = this.toks[j].v;
        const [v, k] = this.expr(j + 2);
        named.set(label, v);
        j = k;
      } else {
        const [v, k] = this.expr(j);
        pos.push(v);
        j = k;
      }
      if (this.toks[j]?.v === ',') j++;
      else if (this.toks[j]?.v !== ')') this.fail(j, 'expected "," or ")"');
    }
    return [{ k: 'call', fn, pos, named }, j + 1];
  }
}

// ── Val → plain data ────────────────────────────────────────────────────────────

const str = (v: Val | undefined, what: string): string => {
  if (v?.k !== 'str') throw new Error(`${what}: expected a string`);
  return v.v;
};
const num = (v: Val | undefined, what: string): number => {
  if (v?.k !== 'num') throw new Error(`${what}: expected a number`);
  return v.v;
};
const strArr = (v: Val | undefined, what: string): string[] => {
  if (v?.k !== 'arr') throw new Error(`${what}: expected an array`);
  return v.v.map((x, i) => str(x, `${what}[${i}]`));
};
const dictOf = <T>(v: Val | undefined, what: string, f: (x: Val, w: string) => T): Record<string, T> => {
  if (v?.k !== 'dict') throw new Error(`${what}: expected a dictionary`);
  const out: Record<string, T> = {};
  for (const [k, x] of v.v) out[k] = f(x, `${what}["${k}"]`);
  return out;
};

type Plain = Omit<LabAnalyte, 'qualifierRemaps' | 'plausible'> & {
  plausible: [number, number] | null;
  qualifierRemaps: { word: string; key: string }[];
};

function plainTs(a: LabAnalyte): Plain {
  return {
    ...a,
    plausible: a.plausible ? [a.plausible[0], a.plausible[1]] : null,
    qualifierRemaps: a.qualifierRemaps.map(r => ({ word: r.word, key: r.key })),
  };
}

/** Defaults of `private static func a(…)` read from its signature. */
function swiftDefaults(src: string): { decimals: number; unitRequired: boolean } {
  const sig = /private\s+static\s+func\s+a\(([\s\S]*?)\)\s*->\s*LabAnalyte/.exec(src);
  if (!sig) throw new Error(`${SWIFT_FILE}: cannot find the a(…) helper signature`);
  const param = (label: string): string | null => {
    const m = new RegExp(`(?:^|[\\s,(])${label}:\\s*[^=]+?\\s*=\\s*(\\[\\]|\\[:\\]|nil|true|false|\\d+)`).exec(sig[1]);
    return m ? m[1] : null;
  };
  const dec = param('decimals');
  const req = param('unitRequired');
  if (dec === null || (req !== 'true' && req !== 'false')) throw new Error(`${SWIFT_FILE}: cannot read the defaults of a(…)`);
  for (const [label, expected] of [
    ['unit', 'nil'], ['unitAliases', '[]'], ['conversions', '[:]'], ['ambiguous', '[:]'],
    ['plausible', 'nil'], ['misread', 'nil'], ['remaps', '[]'],
  ]) {
    if (param(label) !== expected) throw new Error(`${SWIFT_FILE}: default of a(${label}:) is not ${expected} (update this lint and the TS port)`);
  }
  return { decimals: Number(dec), unitRequired: req === 'true' };
}

function swiftAnalyte(v: Val, defaults: { decimals: number; unitRequired: boolean }, where: string): Plain {
  if (v.k !== 'call' || v.fn !== 'a') throw new Error(`${where}: expected an a(…) entry`);
  const key = str(v.pos[0], `${where} key`);
  const w = `${where} ${key}`;
  const known = new Set(['unit', 'unitAliases', 'conversions', 'ambiguous', 'unitRequired', 'plausible', 'misread', 'decimals', 'remaps']);
  for (const label of v.named.keys()) if (!known.has(label)) throw new Error(`${w}: unknown argument "${label}:" (update this lint)`);
  const n = v.named;
  const misread = n.get('misread');
  let misreadPlain: Plain['misread'] = null;
  if (misread && misread.k !== 'nil') {
    if (misread.k !== 'call' || misread.fn !== 'LabMisreadRule') throw new Error(`${w}: misread must be LabMisreadRule(…)`);
    const b = misread.named.get('below'), a = misread.named.get('above');
    misreadPlain = {
      below: !b || b.k === 'nil' ? null : num(b, `${w} misread.below`),
      above: !a || a.k === 'nil' ? null : num(a, `${w} misread.above`),
      message: str(misread.named.get('message'), `${w} misread.message`),
    };
  }
  const plausible = n.get('plausible');
  if (plausible && plausible.k !== 'range' && plausible.k !== 'nil') throw new Error(`${w}: plausible must be lo...hi`);
  const remaps = n.get('remaps');
  const remapsPlain = !remaps ? [] : (() => {
    if (remaps.k !== 'arr') throw new Error(`${w}: remaps must be an array`);
    return remaps.v.map((t, i) => {
      if (t.k !== 'arr' || t.v.length !== 2) throw new Error(`${w}: remaps[${i}] must be (word, key)`);
      return { word: str(t.v[0], `${w} remap word`), key: str(t.v[1], `${w} remap key`) };
    });
  })();
  const unit = n.get('unit');
  const req = n.get('unitRequired');
  return {
    key,
    name: str(v.pos[1], `${w} name`),
    aliases: strArr(v.pos[2], `${w} aliases`),
    appUnit: !unit || unit.k === 'nil' ? null : str(unit, `${w} unit`),
    unitAliases: n.has('unitAliases') ? strArr(n.get('unitAliases'), `${w} unitAliases`) : [],
    conversions: n.has('conversions') ? dictOf(n.get('conversions'), `${w} conversions`, num) : {},
    ambiguousUnits: n.has('ambiguous') ? dictOf(n.get('ambiguous'), `${w} ambiguous`, str) : {},
    unitRequired: req ? (req.k === 'bool' ? req.v : (() => { throw new Error(`${w}: unitRequired must be a Bool`); })()) : defaults.unitRequired,
    plausible: plausible && plausible.k === 'range' ? [plausible.lo, plausible.hi] : null,
    misread: misreadPlain,
    decimals: n.has('decimals') ? num(n.get('decimals'), `${w} decimals`) : defaults.decimals,
    qualifierRemaps: remapsPlain,
  };
}

// ── Comparison ──────────────────────────────────────────────────────────────────

const failures: string[] = [];
const fail = (msg: string) => failures.push(msg);

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function compareRecord<T>(what: string, ios: Record<string, T>, web: Record<string, T>) {
  const keys = new Set([...Object.keys(ios), ...Object.keys(web)]);
  for (const k of [...keys].sort()) {
    if (!(k in ios)) fail(`${what}: "${k}" only on web (${JSON.stringify(web[k])})`);
    else if (!(k in web)) fail(`${what}: "${k}" only on iOS (${JSON.stringify(ios[k])})`);
    else if (!sameJson(ios[k], web[k])) fail(`${what}: "${k}" iOS ${JSON.stringify(ios[k])} vs web ${JSON.stringify(web[k])}`);
  }
}

function compareAnalyteLists(list: string, ios: Plain[], web: Plain[]) {
  const iosKeys = ios.map(a => a.key), webKeys = web.map(a => a.key);
  for (const k of iosKeys) if (!webKeys.includes(k)) fail(`${list}: analyte "${k}" only on iOS`);
  for (const k of webKeys) if (!iosKeys.includes(k)) fail(`${list}: analyte "${k}" only on web`);
  const common = iosKeys.filter(k => webKeys.includes(k));
  const webCommon = webKeys.filter(k => iosKeys.includes(k));
  if (!sameJson(common, webCommon)) fail(`${list}: analyte order differs (iOS ${common.join(', ')} | web ${webCommon.join(', ')})`);
  for (const k of common) {
    const a = ios.find(x => x.key === k)!, b = web.find(x => x.key === k)!;
    const w = `${list} "${k}"`;
    if (a.name !== b.name) fail(`${w}: saved name iOS "${a.name}" vs web "${b.name}"`);
    if (!sameJson(a.aliases, b.aliases)) {
      const onlyIos = a.aliases.filter(x => !b.aliases.includes(x));
      const onlyWeb = b.aliases.filter(x => !a.aliases.includes(x));
      fail(`${w}: synonyms differ${onlyIos.length ? ` — iOS only: ${onlyIos.join(', ')}` : ''}${onlyWeb.length ? ` — web only: ${onlyWeb.join(', ')}` : ''}${!onlyIos.length && !onlyWeb.length ? ' (order)' : ''}`);
    }
    if (a.appUnit !== b.appUnit) fail(`${w}: app unit iOS ${JSON.stringify(a.appUnit)} vs web ${JSON.stringify(b.appUnit)}`);
    if (!sameJson(a.unitAliases, b.unitAliases)) fail(`${w}: unit aliases iOS ${JSON.stringify(a.unitAliases)} vs web ${JSON.stringify(b.unitAliases)}`);
    compareRecord(`${w} conversion factor`, a.conversions, b.conversions);
    compareRecord(`${w} ambiguous unit`, a.ambiguousUnits, b.ambiguousUnits);
    if (a.unitRequired !== b.unitRequired) fail(`${w}: unitRequired iOS ${a.unitRequired} vs web ${b.unitRequired}`);
    if (!sameJson(a.plausible, b.plausible)) fail(`${w}: plausible range iOS ${JSON.stringify(a.plausible)} vs web ${JSON.stringify(b.plausible)}`);
    if (!sameJson(a.misread, b.misread)) fail(`${w}: misread rule iOS ${JSON.stringify(a.misread)} vs web ${JSON.stringify(b.misread)}`);
    if (a.decimals !== b.decimals) fail(`${w}: decimals iOS ${a.decimals} vs web ${b.decimals}`);
    if (!sameJson(a.qualifierRemaps, b.qualifierRemaps)) fail(`${w}: qualifier remaps iOS ${JSON.stringify(a.qualifierRemaps)} vs web ${JSON.stringify(b.qualifierRemaps)}`);
  }
}

function main() {
  const src = readFileSync(join(REPO_ROOT, SWIFT_FILE), 'utf8');
  const swift = new SwiftSource(SWIFT_FILE, src);
  const defaults = swiftDefaults(src);

  const iosList = (name: string): Plain[] => {
    const v = swift.value(name);
    if (v.k !== 'arr') throw new Error(`${SWIFT_FILE}: ${name} is not an array`);
    return v.v.map((x, i) => swiftAnalyte(x, defaults, `${name}[${i}]`));
  };
  const iosScore = iosList('scoreAnalytes');
  const iosOther = iosList('otherAnalytes');
  compareAnalyteLists('score analytes', iosScore, SCORE_ANALYTES.map(plainTs));
  compareAnalyteLists('other analytes', iosOther, OTHER_ANALYTES.map(plainTs));

  // Unit spellings.
  const repl = swift.value('replacements');
  if (repl.k !== 'arr') throw new Error(`${SWIFT_FILE}: replacements is not an array`);
  const iosRepl = repl.v.map((t, i) => {
    if (t.k !== 'arr' || t.v.length !== 2) throw new Error(`${SWIFT_FILE}: replacements[${i}] is not a pair`);
    return [str(t.v[0], 'replacement'), str(t.v[1], 'replacement')];
  });
  if (!sameJson(iosRepl, UNIT_REPLACEMENTS.map(([a, b]) => [a, b]))) {
    fail(`unit replacement steps differ: iOS ${JSON.stringify(iosRepl)} vs web ${JSON.stringify(UNIT_REPLACEMENTS)}`);
  }
  compareRecord('unit synonym', dictOf(swift.value('synonyms'), 'synonyms', str), { ...UNIT_SYNONYMS });
  const iosKnown = strArr(swift.value('known'), 'known');
  const webKnown = [...KNOWN_UNITS];
  for (const u of iosKnown) if (!KNOWN_UNITS.has(u)) fail(`known unit "${u}" only on iOS`);
  for (const u of webKnown) if (!iosKnown.includes(u)) fail(`known unit "${u}" only on web`);

  // iOS score keyword groups (ported for the parity tests).
  const groups = swift.value('groups');
  if (groups.k !== 'arr') throw new Error(`${SWIFT_FILE}: LabScoreKeywords.groups is not an array`);
  const iosGroups = groups.v.map((t, i) => {
    if (t.k !== 'arr' || t.v.length !== 2) throw new Error(`${SWIFT_FILE}: groups[${i}] is not (key, keywords)`);
    return { key: str(t.v[0], 'group key'), keywords: strArr(t.v[1], 'group keywords') };
  });
  if (!sameJson(iosGroups, IOS_SCORE_KEYWORD_GROUPS)) {
    fail(`score keyword groups differ: iOS ${JSON.stringify(iosGroups)} vs web ${JSON.stringify(IOS_SCORE_KEYWORD_GROUPS)}`);
  }

  const total = iosScore.length + iosOther.length;
  if (failures.length > 0) {
    console.error(`✗ Lab report import parity: ${failures.length} difference(s) between ${SWIFT_FILE} and ${TS_FILE}:\n`);
    for (const f of failures) console.error(`  - ${f}`);
    console.error('\nChange both platforms together (same names, synonyms, units and factors), in the same PR.');
    process.exit(1);
  }
  const conversions = [...iosScore, ...iosOther].reduce((n, a) => n + Object.keys(a.conversions).length, 0);
  console.log(`✓ Lab report import parity: ${total} analytes (${iosScore.length} score, ${iosOther.length} other), `
    + `${conversions} conversion factors, ${Object.keys(UNIT_SYNONYMS).length} unit synonyms and `
    + `${KNOWN_UNITS.size} known units identical on web and iOS.`);
}

main();
