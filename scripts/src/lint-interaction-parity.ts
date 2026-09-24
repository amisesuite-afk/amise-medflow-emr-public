/**
 * Drug-interaction parity lint (hazard H-07): the web and iOS interaction screens must raise
 * the same alerts.
 *
 * Parses both engines from SOURCE (no Swift toolchain needed):
 *   web  artifacts/dashboard/src/lib/drug-interactions.ts  (INTERACTIONS)
 *        artifacts/dashboard/src/lib/drug-classes.ts       (DRUG_TERMS)
 *   iOS  ios/AmiseMedFlow/Services/DrugInteractionService.swift (rules)
 *        ios/AmiseMedFlow/Services/DrugClasses.swift            (terms)
 *
 * Fails when:
 *  1. Vocabulary: a term is defined on one platform only, its kind (class / drug) differs, or
 *     its member list differs (each member = "generic|synonym|Brand…", compared after
 *     trimming and lowercasing; member order does not matter).
 *  2. Rules: a rule pair (terms lowercased, order-insensitive) exists on one platform and the
 *     other platform cannot raise it. "Can raise" = the same pair, OR a broader rule whose
 *     terms contain it (every member generic of each term is a member generic of the covering
 *     term; e.g. web tramadol + sertraline is raised on iOS by tramadol + ssri). A same-term
 *     covering rule (qt prolonging + qt prolonging) only covers two different drugs.
 *  3. Grade: the same pair has a different severity on each platform, unless it is on
 *     GRADE_ALLOWLIST (reported, not failed). An allow-list entry that no longer matches a real
 *     difference also fails, so the list cannot go stale.
 *
 * Wording is not compared: the original iOS rules have their own (longer) wording. The tests
 * on each platform pin the wording of the rules ported for parity.
 *
 * As a parser self-check, the TS side is also imported and compared with what was parsed.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INTERACTIONS } from '../../artifacts/dashboard/src/lib/drug-interactions';
import { DRUG_TERMS } from '../../artifacts/dashboard/src/lib/drug-classes';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

const FILES = {
  webRules: 'artifacts/dashboard/src/lib/drug-interactions.ts',
  webTerms: 'artifacts/dashboard/src/lib/drug-classes.ts',
  iosRules: 'ios/AmiseMedFlow/Services/DrugInteractionService.swift',
  iosTerms: 'ios/AmiseMedFlow/Services/DrugClasses.swift',
};

/** Known grade differences awaiting a clinical decision. Reported, never failed. */
const GRADE_ALLOWLIST: { pair: [string, string]; web: string; ios: string; note: string }[] = [
  {
    pair: ['opioid', 'benzodiazepine'], web: 'contraindicated', ios: 'major',
    note: 'pending surgeon decision',
  },
];

// ── Tokeniser (TS and Swift literal subset) ─────────────────────────────────────

type Tok = { t: 'str' | 'id' | 'num' | 'p'; v: string };

function tokenise(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      let v = '';
      while (j < n && src[j] !== c) {
        if (src[j] === '\\') { v += src[j + 1] ?? ''; j += 2; continue; }
        v += src[j++];
      }
      out.push({ t: 'str', v });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i + 1;
      while (j < n && /[0-9A-Za-z_.]/.test(src[j])) j++;
      out.push({ t: 'num', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (src.startsWith('...', i)) { out.push({ t: 'p', v: '...' }); i += 3; continue; }
    out.push({ t: 'p', v: c });
    i++;
  }
  return out;
}

// ── Evaluator for the literal subset the rule/term tables use ───────────────────

type Val =
  | { k: 'str'; v: string }
  | { k: 'arr'; v: Val[] }
  | { k: 'obj'; v: Map<string, Val> }          // TS object / Swift dictionary / Swift call args
  | { k: 'enum'; v: string }                    // Swift `.major`, `.drugClass`
  | { k: 'other' };

class Source {
  private toks: Tok[];
  private decls = new Map<string, number>();
  private cache = new Map<string, Val>();

  constructor(readonly file: string) {
    this.toks = tokenise(readFileSync(join(REPO_ROOT, file), 'utf8'));
    // `const NAME … =` (TS) / `let NAME … =` (Swift). First declaration of a name wins.
    for (let i = 0; i < this.toks.length - 1; i++) {
      const tk = this.toks[i];
      if (tk.t !== 'id' || (tk.v !== 'const' && tk.v !== 'let')) continue;
      const name = this.toks[i + 1];
      if (name.t !== 'id' || this.decls.has(name.v)) continue;
      let j = i + 2;
      let depth = 0;
      for (; j < this.toks.length; j++) {
        const v = this.toks[j].v;
        if (this.toks[j].t !== 'p') continue;
        if ('([{<'.includes(v)) depth++;
        else if (')]}>'.includes(v)) depth--;
        else if (v === '=' && depth === 0) break;
        else if (v === ';' && depth === 0) { j = -1; break; }
      }
      if (j > 0 && j < this.toks.length) this.decls.set(name.v, j + 1);
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
    const near = this.toks.slice(i, i + 8).map(t => t.v).join(' ');
    throw new Error(`${this.file}: ${msg} near "${near}"`);
  }

  /** expr := primary ('+' primary)*   — Swift array/string concatenation. */
  private expr(i: number): [Val, number] {
    let [v, j] = this.primary(i);
    while (this.toks[j]?.v === '+') {
      const [w, k] = this.primary(j + 1);
      if (v.k === 'arr' && w.k === 'arr') v = { k: 'arr', v: [...v.v, ...w.v] };
      else if (v.k === 'str' && w.k === 'str') v = { k: 'str', v: v.v + w.v };
      else v = { k: 'other' };
      j = k;
    }
    return [v, j];
  }

  private primary(i: number): [Val, number] {
    const tk = this.toks[i];
    if (!tk) return this.fail(i, 'unexpected end of file');
    if (tk.t === 'str') return [{ k: 'str', v: tk.v }, i + 1];
    if (tk.t === 'num') return [{ k: 'other' }, i + 1];
    if (tk.v === '[') return this.list(i + 1, ']');
    if (tk.v === '{') return this.object(i + 1);
    if (tk.v === '.' && this.toks[i + 1]?.t === 'id') {
      // Swift `.major` (enum case) or `.init(…)` (call).
      if (this.toks[i + 2]?.v === '(') return this.call(i + 3);
      return [{ k: 'enum', v: this.toks[i + 1].v }, i + 2];
    }
    if (tk.t === 'id') {
      if (this.toks[i + 1]?.v === '(') return this.call(i + 2);   // Swift `DrugTermDef(…)`
      return [this.value(tk.v), i + 1];
    }
    return this.fail(i, `unexpected token "${tk.v}"`);
  }

  /** `[a, b, ...c]` array, or Swift `["k": v, …]` dictionary. */
  private list(i: number, close: string): [Val, number] {
    const arr: Val[] = [];
    const dict = new Map<string, Val>();
    let isDict = false;
    let j = i;
    while (this.toks[j]?.v !== close) {
      if (this.toks[j]?.v === '...') {
        const [v, k] = this.expr(j + 1);
        if (v.k !== 'arr') return this.fail(j, 'spread of a non-array');
        arr.push(...v.v);
        j = k;
      } else {
        const [v, k] = this.expr(j);
        if (this.toks[k]?.v === ':') {
          if (v.k !== 'str') return this.fail(j, 'dictionary key is not a string');
          isDict = true;
          const [w, m] = this.expr(k + 1);
          dict.set(v.v, w);
          j = m;
        } else {
          arr.push(v);
          j = k;
        }
      }
      if (this.toks[j]?.v === ',') j++;
      else if (this.toks[j]?.v !== close) this.fail(j, `expected "," or "${close}"`);
    }
    return [isDict ? { k: 'obj', v: dict } : { k: 'arr', v: arr }, j + 1];
  }

  /** TS `{ key: value, 'key': value }`. */
  private object(i: number): [Val, number] {
    const map = new Map<string, Val>();
    let j = i;
    while (this.toks[j]?.v !== '}') {
      const key = this.toks[j];
      if ((key.t !== 'id' && key.t !== 'str') || this.toks[j + 1]?.v !== ':') this.fail(j, 'expected "key:"');
      const [v, k] = this.expr(j + 2);
      map.set(key.v, v);
      j = k;
      if (this.toks[j]?.v === ',') j++;
      else if (this.toks[j]?.v !== '}') this.fail(j, 'expected "," or "}"');
    }
    return [{ k: 'obj', v: map }, j + 1];
  }

  /** Swift call arguments `label: value, …` (after the opening paren). */
  private call(i: number): [Val, number] {
    const map = new Map<string, Val>();
    let j = i;
    let pos = 0;
    while (this.toks[j]?.v !== ')') {
      let label = `_${pos++}`;
      if (this.toks[j]?.t === 'id' && this.toks[j + 1]?.v === ':') { label = this.toks[j].v; j += 2; }
      const [v, k] = this.expr(j);
      map.set(label, v);
      j = k;
      if (this.toks[j]?.v === ',') j++;
      else if (this.toks[j]?.v !== ')') this.fail(j, 'expected "," or ")"');
    }
    return [{ k: 'obj', v: map }, j + 1];
  }
}

// ── Normalised model ─────────────────────────────────────────────────────────────

interface Term { kind: 'class' | 'drug'; members: string[] }
interface Rule { a: string; b: string; severity: string; effect: string }
interface Platform { name: 'web' | 'iOS'; terms: Map<string, Term>; rules: Rule[] }

const str = (v: Val | undefined, what: string): string => {
  if (v?.k !== 'str') throw new Error(`${what}: expected a string`);
  return v.v;
};
const obj = (v: Val | undefined, what: string): Map<string, Val> => {
  if (v?.k !== 'obj') throw new Error(`${what}: expected an object/call`);
  return v.v;
};
const arr = (v: Val | undefined, what: string): Val[] => {
  if (v?.k !== 'arr') throw new Error(`${what}: expected an array`);
  return v.v;
};

const normMember = (m: string) => m.split('|').map(s => s.trim().toLowerCase()).filter(Boolean).join('|');
const generic = (m: string) => normMember(m).split('|')[0];

function termsFrom(entries: Map<string, Val>, file: string, kindOf: (v: Val | undefined) => string): Map<string, Term> {
  const out = new Map<string, Term>();
  for (const [key, def] of entries) {
    const d = obj(def, `${file} term "${key}"`);
    const kind = kindOf(d.get('kind'));
    if (kind !== 'class' && kind !== 'drug') throw new Error(`${file} term "${key}": unknown kind "${kind}"`);
    const members = arr(d.get('members'), `${file} term "${key}" members`).map(m => str(m, `${file} term "${key}" member`));
    out.set(key.toLowerCase(), { kind, members });
  }
  return out;
}

function parseWeb(): Platform {
  const terms = new Source(FILES.webTerms);
  const rules = new Source(FILES.webRules);
  return {
    name: 'web',
    terms: termsFrom(obj(terms.value('DRUG_TERMS'), 'DRUG_TERMS'), FILES.webTerms, v => str(v, 'kind')),
    rules: arr(rules.value('INTERACTIONS'), 'INTERACTIONS').map((r, i) => {
      const o = obj(r, `INTERACTIONS[${i}]`);
      const [a, b] = arr(o.get('drugs'), `INTERACTIONS[${i}].drugs`).map(d => str(d, 'drug').toLowerCase());
      return { a, b, severity: str(o.get('severity'), 'severity').toLowerCase(), effect: str(o.get('effect'), 'effect') };
    }),
  };
}

function parseIOS(): Platform {
  const terms = new Source(FILES.iosTerms);
  const rules = new Source(FILES.iosRules);
  const swiftKind = (v: Val | undefined) => {
    if (v?.k !== 'enum') throw new Error(`${FILES.iosTerms}: kind is not an enum case`);
    return v.v === 'drugClass' ? 'class' : v.v;
  };
  return {
    name: 'iOS',
    terms: termsFrom(obj(terms.value('terms'), 'terms'), FILES.iosTerms, swiftKind),
    rules: arr(rules.value('rules'), 'rules').map((r, i) => {
      const o = obj(r, `rules[${i}]`);
      const sev = o.get('severity');
      if (sev?.k !== 'enum') throw new Error(`rules[${i}]: severity is not an enum case`);
      return {
        a: str(o.get('drug1Pattern'), 'drug1Pattern').toLowerCase(),
        b: str(o.get('drug2Pattern'), 'drug2Pattern').toLowerCase(),
        severity: sev.v.toLowerCase(),
        effect: str(o.get('clinicalEffect'), 'clinicalEffect'),
      };
    }),
  };
}

// ── Checks ───────────────────────────────────────────────────────────────────────

const pairKey = (a: string, b: string) => [a, b].sort().join(' + ');

function generics(p: Platform, term: string): Set<string> {
  return new Set((p.terms.get(term)?.members ?? []).map(generic));
}
const subset = (x: Set<string>, y: Set<string>) => x.size > 0 && [...x].every(g => y.has(g));

/** A rule on the other platform that raises (a, b), or undefined. */
function coveringRule(from: Platform, a: string, b: string, other: Platform): Rule | undefined {
  const ga = generics(from, a);
  const gb = generics(from, b);
  const sameDrug = ga.size === 1 && gb.size === 1 && [...ga][0] === [...gb][0];
  return other.rules.find(r => {
    const gc = generics(other, r.a);
    const gd = generics(other, r.b);
    if (r.a === r.b && sameDrug) return false;   // QT + QT needs two different drugs
    return (subset(ga, gc) && subset(gb, gd)) || (subset(ga, gd) && subset(gb, gc));
  });
}

function main(): number {
  const web = parseWeb();
  const ios = parseIOS();
  const errors: string[] = [];
  const notes: string[] = [];

  // Parser self-check against the real TS module.
  if (web.rules.length !== INTERACTIONS.length) {
    errors.push(`parser self-check: parsed ${web.rules.length} web rules, module has ${INTERACTIONS.length}`);
  } else {
    INTERACTIONS.forEach((r, i) => {
      const p = web.rules[i];
      if (p.a !== r.drugs[0] || p.b !== r.drugs[1] || p.severity !== r.severity || p.effect !== r.effect) {
        errors.push(`parser self-check: web rule ${i} parsed as ${p.a} + ${p.b} (${p.severity})`);
      }
    });
  }
  for (const [key, def] of Object.entries(DRUG_TERMS)) {
    const p = web.terms.get(key);
    if (!p || p.kind !== def.kind || p.members.join('\n') !== def.members.join('\n')) {
      errors.push(`parser self-check: web term "${key}" parsed differently from the module`);
    }
  }
  if (web.terms.size !== Object.keys(DRUG_TERMS).length) errors.push('parser self-check: web term count differs');
  if (ios.rules.length === 0 || ios.terms.size === 0) errors.push('parser self-check: no iOS rules or terms parsed');

  // 1. Vocabulary.
  for (const [p, q] of [[web, ios], [ios, web]] as const) {
    for (const r of p.rules) {
      for (const t of [r.a, r.b]) {
        if (!p.terms.has(t)) errors.push(`${p.name}: rule ${r.a} + ${r.b} uses unmapped term "${t}"`);
      }
    }
    for (const t of p.terms.keys()) {
      if (!q.terms.has(t)) errors.push(`term "${t}" is defined on ${p.name} only — add it to ${q.name} with the same members`);
    }
  }
  for (const [t, w] of web.terms) {
    const i = ios.terms.get(t);
    if (!i) continue;
    if (w.kind !== i.kind) errors.push(`term "${t}": kind is ${w.kind} on web, ${i.kind} on iOS`);
    const wm = new Set(w.members.map(normMember));
    const im = new Set(i.members.map(normMember));
    const onlyWeb = [...wm].filter(m => !im.has(m));
    const onlyIOS = [...im].filter(m => !wm.has(m));
    if (onlyWeb.length || onlyIOS.length) {
      errors.push(`term "${t}": member lists differ` +
        (onlyWeb.length ? `\n      web only: ${onlyWeb.join(', ')}` : '') +
        (onlyIOS.length ? `\n      iOS only: ${onlyIOS.join(', ')}` : ''));
    }
  }

  // 2. Rule pairs, 3. grades.
  const byPair = (p: Platform) => {
    const m = new Map<string, Rule[]>();
    for (const r of p.rules) m.set(pairKey(r.a, r.b), [...(m.get(pairKey(r.a, r.b)) ?? []), r]);
    return m;
  };
  const webPairs = byPair(web);
  const iosPairs = byPair(ios);
  const usedAllow = new Set<number>();

  for (const [p, pp, q, qp] of [[web, webPairs, ios, iosPairs], [ios, iosPairs, web, webPairs]] as const) {
    for (const [key, rules] of pp) {
      if (qp.has(key)) continue;
      const r = rules[0];
      const cover = coveringRule(p, r.a, r.b, q);
      if (cover) notes.push(`${p.name} ${key} — raised on ${q.name} by ${cover.a} + ${cover.b}`);
      else errors.push(`rule ${key} (${r.severity}) exists on ${p.name} only — ${q.name} cannot raise it`);
    }
  }

  for (const [key, wr] of webPairs) {
    const ir = iosPairs.get(key);
    if (!ir) continue;
    const wSev = [...new Set(wr.map(r => r.severity))].sort().join('/');
    const iSev = [...new Set(ir.map(r => r.severity))].sort().join('/');
    if (wSev === iSev) continue;
    const idx = GRADE_ALLOWLIST.findIndex(g =>
      pairKey(...g.pair) === key && g.web === wSev && g.ios === iSev);
    if (idx >= 0) {
      usedAllow.add(idx);
      notes.push(`GRADE ${key}: web ${wSev}, iOS ${iSev} — allow-listed, ${GRADE_ALLOWLIST[idx].note}`);
    } else {
      errors.push(`grade differs for ${key}: web ${wSev}, iOS ${iSev}`);
    }
  }
  GRADE_ALLOWLIST.forEach((g, i) => {
    if (!usedAllow.has(i)) {
      errors.push(`GRADE_ALLOWLIST entry ${pairKey(...g.pair)} (web ${g.web}, iOS ${g.ios}) no longer matches — remove it`);
    }
  });

  // Report.
  console.log(`Interaction parity: web ${web.rules.length} rules / ${web.terms.size} terms, ` +
    `iOS ${ios.rules.length} rules / ${ios.terms.size} terms.`);
  if (notes.length) {
    console.log('\nCovered by a broader rule, or allow-listed:');
    for (const n of notes.sort()) console.log(`  - ${n}`);
  }
  if (errors.length) {
    console.error(`\n✗ ${errors.length} parity problem(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    console.error('\nFix by adding the missing rule / term / member on the other platform (same grade and wording),' +
      ' or, for a grade difference awaiting clinical review, by adding it to GRADE_ALLOWLIST in this script.');
    return 1;
  }
  console.log('\n✓ Every rule pair and term is shared between web and iOS.');
  return 0;
}

process.exit(main());
