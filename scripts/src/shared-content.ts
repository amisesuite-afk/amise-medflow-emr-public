/**
 * Shared clinical content: one rule and content library for web and iOS.
 *
 * clinical-content/rules/<name>.json is the single source of a clinical rule set that both
 * platforms read: the web imports the JSON (resolveJsonModule), iOS bundles the folder as a
 * folder reference ("rules", ios/project.yml) and decodes it with Codable structs
 * (SharedClinicalContent.swift). Each file has a JSON Schema, clinical-content/schemas/<name>.schema.json.
 * The disease-centred vademecum (phase 1, shadow) follows the same pattern in
 * clinical-content/vademecum/<name>.json (folder reference "vademecum"); its area files share one
 * schema (vademecum-area), so an entry can name its schema.
 *
 * This module holds the checks run by `lint:shared-content` (lint-shared-content.ts) and unit-tested
 * in shared-content.test.ts:
 *   - every rules file has a schema (and every schema a rules file), and validates against it;
 *   - the file's `id` is a registry entry that lists the file, with a json-key version stamp on it;
 *   - regular-expression lists compile;
 *   - the Swift Codable structs and the TypeScript interfaces that read a file agree with its
 *     schema: every field is a schema property and every schema property is read (or listed as
 *     ignored), a non-optional field is required, and the basic types, nullability and string-enum
 *     values match. Same spirit as diagnostic-database-schema.ts: the Swift code cannot be compiled
 *     here, so the structs are read from the source.
 *   - the iOS loader lists every file and project.yml bundles the folder;
 *   - a retired platform copy has not come back.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';

// ── Configuration ────────────────────────────────────────────────────────────────────────────

export const RULES_DIR = 'clinical-content/rules';
export const VADEMECUM_DIR = 'clinical-content/vademecum';
export const SCHEMAS_DIR = 'clinical-content/schemas';
export const REGISTRY_FILE = 'clinical-content/registry.json';
export const IOS_LOADER = 'ios/AmiseMedFlow/Services/SharedClinicalContent.swift';
export const IOS_PROJECT = 'ios/project.yml';
/** The folder reference in ios/project.yml (relative to ios/) and its name in the app bundle. */
export const IOS_FOLDER_PATH = '../clinical-content/rules';

/** Content folders: where the files are, their iOS folder reference, and the key prefix used here. */
export const CONTENT_DIRS = [
  { key: 'rules', dir: RULES_DIR, iosFolder: IOS_FOLDER_PATH, prefix: '' },
  { key: 'vademecum', dir: VADEMECUM_DIR, iosFolder: '../clinical-content/vademecum', prefix: 'vademecum/' },
] as const;
export type ContentDirKey = (typeof CONTENT_DIRS)[number]['key'];

/** How one platform reads one rules file: a root type, the source files its types live in. */
export interface TypeMapping {
  /** Repo-relative source files searched for the root type and every type it names. */
  files: string[];
  /** Root type (a Swift struct, possibly qualified "Outer.Inner", or a TypeScript interface). */
  root: string;
  /** Schema properties this platform does not read, as JSON pointers into the data ("/id"). */
  ignore: string[];
  /**
   * Swift only: types decoded by hand (`init(from:)`) from another JSON shape, by simple type name,
   * with the JSON type the schema must give them (e.g. `Triple` from a [low, point, high] array).
   */
  customDecoded?: Record<string, string>;
}

export interface SharedContentFile {
  /** File name without ".json" (clinical-content/<dir>/<name>.json). */
  name: string;
  /** Content folder (default 'rules'). */
  dir?: ContentDirKey;
  /** Schema name (clinical-content/schemas/<schema>.schema.json) when it is not the file name. */
  schema?: string;
  /** JSON pointers (into the data) of arrays of regular expressions (ICU and JavaScript). */
  regexLists: string[];
  swift: TypeMapping;
  ts: TypeMapping;
}

const HEADER_IGNORE = ['/$schema', '/$comment', '/id'];

export const SHARED_CONTENT: SharedContentFile[] = [
  {
    name: 'zebra-rules',
    regexLists: [],
    swift: { files: ['ios/AmiseMedFlow/Services/ZebraCheck.swift'], root: 'ZebraCheck.RuleFile', ignore: HEADER_IGNORE },
    ts: { files: ['lib/triage-engine/src/diagnostic-reasoning/zebra-rules.ts'], root: 'ZebraRuleFile', ignore: ['/$schema', '/$comment'] },
  },
  {
    name: 'supplement-catalogue',
    regexLists: [],
    swift: { files: ['ios/AmiseMedFlow/Services/SupplementCatalogue.swift'], root: 'SupplementCatalogue.Content', ignore: HEADER_IGNORE },
    ts: { files: ['artifacts/dashboard/src/lib/supplement-catalogue.ts'], root: 'SupplementCatalogueContent', ignore: ['/$schema', '/$comment'] },
  },
  {
    name: 'lifestyle-practices',
    regexLists: ['/patterns/diabetes', '/patterns/insulin', '/patterns/sulfonylurea', '/patterns/depression'],
    swift: { files: ['ios/AmiseMedFlow/Services/LifestylePractices.swift'], root: 'LifestylePractices.Content', ignore: HEADER_IGNORE },
    ts: { files: ['lib/triage-engine/src/lifestyle-practices.ts'], root: 'LifestyleContent', ignore: ['/$schema', '/$comment'] },
  },
  // Diagnostic-reasoning rules. iOS compiles the core `thresholds` into DiagnosticReasoningCore.swift
  // (pinned to this file by diagnostic-reasoning-parity.test.ts) and matches coexisting states by
  // name (`nameTerms`), not by PANE id.
  {
    name: 'diagnostic-reasoning-rules',
    regexLists: [],
    swift: { files: ['ios/AmiseMedFlow/Services/DiagnosticReasoningRules.swift'], root: 'DiagnosticReasoningRules.RuleFile', ignore: [
      ...HEADER_IGNORE, '/thresholds', '/coexisting/paneIds',
    ] },
    ts: { files: ['lib/triage-engine/src/diagnostic-reasoning/reasoning-rules.ts'], root: 'ReasoningRuleFile', ignore: ['/$schema', '/$comment'] },
  },
  // Evidence-exam catalogues. iOS ignores the review header and prose (shown on the web and in the
  // change log), the PANE target ids (`pane`), `alsoTargets` / `supersedes` / `twins` (web mapper
  // only: on iOS the secondary targets and superseded twins are already in DiagnosticDatabase.json,
  // gen-exam-evidence-db.ts), the web examination systems of a frame and the web calculator key.
  {
    name: 'exam-signs',
    regexLists: [],
    swift: { files: ['ios/AmiseMedFlow/Services/ExamEvidenceCatalogue.swift'], root: 'ExamEvidenceCatalogue.SignsFile', ignore: [
      ...HEADER_IGNORE, '/title', '/updated', '/lastReviewed', '/reviewer', '/reference', '/conversion', '/engineModes',
      '/absencePolicy', '/frames/*/systems', '/targetGroups/*/pane', '/signs/*/alsoTargets', '/signs/*/supersedes', '/signs/*/twins',
    ] },
    ts: { files: ['lib/pane-engine/src/evidence/types.ts'], root: 'ExamSignsContent', ignore: ['/$schema', '/$comment'] },
  },
  {
    name: 'decision-rules',
    regexLists: [],
    swift: { files: ['ios/AmiseMedFlow/Services/ExamEvidenceCatalogue.swift'], root: 'ExamEvidenceCatalogue.RulesFile', ignore: [
      ...HEADER_IGNORE, '/title', '/updated', '/lastReviewed', '/reviewer', '/reference', '/evidencePolicy',
      '/rules/*/target/pane', '/rules/*/target/ios', '/rules/*/web',
    ] },
    ts: { files: ['lib/pane-engine/src/evidence/types.ts'], root: 'DecisionRulesContent', ignore: ['/$schema', '/$comment'] },
  },
  // Disease-centred vademecum, phase 1 (shadow; docs/VADEMECUM-PLAN.md). The web loop
  // (lib/pane-engine/src/vademecum-loop) reads every field; iOS only decodes the files in phase 1
  // and skips the review header and prose.
  {
    name: 'findings', dir: 'vademecum', schema: 'vademecum-findings',
    regexLists: [],
    swift: { files: ['ios/AmiseMedFlow/Services/VademecumContent.swift'], root: 'VademecumContent.FindingsFile', ignore: [
      ...HEADER_IGNORE, '/title', '/updated', '/lastReviewed', '/reviewer', '/reference',
    ] },
    ts: { files: ['lib/pane-engine/src/vademecum-loop/types.ts'], root: 'VademecumFindingsFile', ignore: ['/$schema', '/$comment'] },
  },
  ...(['abdominal-pain', 'cough-breathlessness'] as const).map((name): SharedContentFile => ({
    name, dir: 'vademecum', schema: 'vademecum-area',
    regexLists: [],
    swift: { files: ['ios/AmiseMedFlow/Services/VademecumContent.swift'], root: 'VademecumContent.AreaFile', ignore: [
      ...HEADER_IGNORE, '/title', '/updated', '/lastReviewed', '/reviewer',
    ] },
    ts: { files: ['lib/pane-engine/src/vademecum-loop/types.ts'], root: 'VademecumAreaFile', ignore: ['/$schema', '/$comment'] },
  })),
  // Decision support (score / result actions, treatment options, modifiers). Every field is read on
  // both platforms; `Triple` is decoded by hand on iOS from its [low, point, high] array.
  {
    name: 'treatment-decisions',
    regexLists: [],
    swift: {
      files: ['ios/AmiseMedFlow/Services/TreatmentDecisionContent.swift'], root: 'TreatmentDecisions.Content', ignore: HEADER_IGNORE,
      customDecoded: { Triple: 'array' },
    },
    ts: { files: ['lib/pane-engine/src/decision/types.ts'], root: 'DecisionContent', ignore: HEADER_IGNORE },
  },
];

/** Key of a configured file in the problem list and `checked` ("zebra-rules", "vademecum/findings"). */
export function contentKey(f: { name: string; dir?: ContentDirKey }): string {
  return `${CONTENT_DIRS.find(d => d.key === (f.dir ?? 'rules'))!.prefix}${f.name}`;
}

/** Platform copies replaced by a shared file: they must not come back. */
export const RETIRED_COPIES = [
  'ios/AmiseMedFlow/Resources/ZebraRules.json',
  'ios/AmiseMedFlow/Resources/ExamSigns.json',
  'ios/AmiseMedFlow/Resources/DecisionRules.json',
  'lib/pane-engine/src/evidence/exam-signs.json',
  'lib/pane-engine/src/evidence/decision-rules.json',
  'ios/AmiseMedFlow/Resources/TreatmentDecisions.json',
  'lib/pane-engine/src/decision/treatment-decisions.json',
];

// ── JSON Schema helpers ──────────────────────────────────────────────────────────────────────

export type Schema = Record<string, unknown>;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Follows local `$ref`s ("#/$defs/x") until the node has none. */
export function deref(root: Schema, node: unknown): Schema {
  let n = node;
  for (let i = 0; i < 20 && isObj(n) && typeof n.$ref === 'string'; i++) {
    const ref = n.$ref as string;
    if (!ref.startsWith('#/')) throw new Error(`only local $refs are supported: ${ref}`);
    let target: unknown = root;
    for (const part of ref.slice(2).split('/')) target = isObj(target) ? target[part.replace(/~1/g, '/').replace(/~0/g, '~')] : undefined;
    if (target === undefined) throw new Error(`unresolved $ref ${ref}`);
    n = target;
  }
  return isObj(n) ? n : {};
}

function typeOfValue(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

/** JSON types a schema node allows ("integer" is kept apart from "number"). */
export function jsonTypes(root: Schema, node: unknown): Set<string> {
  const n = deref(root, node);
  const out = new Set<string>();
  const add = (s: Set<string>, into: Set<string>) => s.forEach(t => into.add(t));
  if (typeof n.type === 'string') out.add(n.type);
  if (Array.isArray(n.type)) n.type.forEach(t => out.add(String(t)));
  const narrow = (s: Set<string>) => {
    if (out.size === 0) { add(s, out); return; }
    for (const t of [...out]) if (!s.has(t) && !(t === 'number' && s.has('integer'))) out.delete(t);
  };
  if ('const' in n) narrow(new Set([typeOfValue(n.const)]));
  if (Array.isArray(n.enum)) narrow(new Set(n.enum.map(typeOfValue)));
  for (const key of ['oneOf', 'anyOf'] as const) {
    const branches = n[key];
    if (!Array.isArray(branches)) continue;
    const union = new Set<string>();
    for (const b of branches) add(jsonTypes(root, b), union);
    if (union.size) narrow(union);
  }
  return out;
}

/** Enumerated values of a node (enum / const, or the union of its oneOf / anyOf branches). */
function enumValues(root: Schema, node: unknown): unknown[] | null {
  const n = deref(root, node);
  if (Array.isArray(n.enum)) return n.enum;
  if ('const' in n) return [n.const];
  for (const key of ['oneOf', 'anyOf'] as const) {
    const branches = n[key];
    if (!Array.isArray(branches)) continue;
    const vals: unknown[] = [];
    for (const b of branches) {
      const v = enumValues(root, b);
      if (!v) return null;
      vals.push(...v);
    }
    return vals;
  }
  return null;
}

interface ObjectShape {
  props: Map<string, unknown>;
  required: Set<string>;
  /** Value schemas of a map-like object (additionalProperties / patternProperties). */
  values: unknown[];
}

function objectShape(root: Schema, node: unknown): ObjectShape | null {
  const n = deref(root, node);
  if (!jsonTypes(root, n).has('object')) return null;
  let obj: Schema = n;
  if (!isObj(n.properties) && !isObj(n.patternProperties) && !isObj(n.additionalProperties)) {
    // A nullable object written as oneOf [null, {$ref}]: use the object branch.
    for (const key of ['oneOf', 'anyOf'] as const) {
      const branch = Array.isArray(n[key]) ? (n[key] as unknown[]).map(b => deref(root, b)).find(b => jsonTypes(root, b).has('object')) : undefined;
      if (branch) obj = branch;
    }
  }
  const props = new Map<string, unknown>(Object.entries(isObj(obj.properties) ? obj.properties : {}));
  const required = new Set(Array.isArray(obj.required) ? obj.required.map(String) : []);
  const values: unknown[] = [];
  if (isObj(obj.additionalProperties)) values.push(obj.additionalProperties);
  if (isObj(obj.patternProperties)) values.push(...Object.values(obj.patternProperties));
  return { props, required, values };
}

function arrayItems(root: Schema, node: unknown): unknown | null {
  const n = deref(root, node);
  if (isObj(n.items)) return n.items;
  for (const key of ['oneOf', 'anyOf'] as const) {
    const branch = Array.isArray(n[key]) ? (n[key] as unknown[]).map(b => deref(root, b)).find(b => isObj(b.items)) : undefined;
    if (branch) return branch.items;
  }
  return null;
}

// ── Source parsing (Swift and TypeScript) ────────────────────────────────────────────────────

/** Removes // and /* *\/ comments, keeping string literals (for brace matching and field parsing). */
export function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const c = src[i]!;
    const d = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') { out += d ?? ''; i += 2; continue; }
      if (c === quote || (quote !== '`' && c === '\n')) quote = null;
      i++;
      continue;
    }
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { const end = src.indexOf('*/', i + 2); i = end < 0 ? src.length : end + 2; continue; }
    if (c === '"' || c === "'" || c === '`') quote = c;
    out += c;
    i++;
  }
  return out;
}

/** The text between the braces that open at or after `from` (exclusive), or null. */
function braceBody(src: string, from: number): string | null {
  const open = src.indexOf('{', from);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open + 1, i);
  }
  return null;
}

/** Splits a declaration body into its top-level statements (on newlines and ';' at depth 0). */
function topLevelStatements(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const c of body) {
    if ('{[(<'.includes(c)) depth++;
    if ('}])>'.includes(c)) depth = Math.max(0, depth - 1);
    if ((c === '\n' || c === ';') && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export interface Field { name: string; type: string; optional: boolean }

export interface SwiftTypes {
  structs: Map<string, { fields: Field[]; problem?: string }>;
  stringEnums: Map<string, string[]>;
}

/** Stored properties of every struct, and the raw values of every String enum, in the sources. */
export function parseSwift(sources: string[]): SwiftTypes {
  const structs = new Map<string, { fields: Field[]; problem?: string }>();
  const stringEnums = new Map<string, string[]>();
  for (const raw of sources) {
    const src = stripComments(raw);
    for (const m of src.matchAll(/\bstruct\s+(\w+)\b[^{]*/g)) {
      const body = braceBody(src, m.index!);
      if (body === null) continue;
      const fields: Field[] = [];
      let problem: string | undefined;
      if (!/\b(Codable|Decodable)\b/.test(m[0])) problem = 'is not Codable / Decodable';
      if (/\benum\s+CodingKeys\b|\binit\s*\(\s*from\s+decoder\b/.test(body)) {
        problem = 'declares CodingKeys or init(from:): not supported by this check';
      }
      let depth = 0;
      for (const line of body.split('\n')) {
        const atTop = depth === 0;
        for (const c of line) { if (c === '{') depth++; else if (c === '}') depth--; }
        if (!atTop) continue;
        const f = /^\s*(?:(?:public|private|fileprivate|internal)\s+)?(let|var)\s+(\w+)\s*:\s*([^={]+?)\s*(=.*)?$/.exec(line);
        if (!f || /\bstatic\b/.test(line)) continue;
        if (f[1] === 'let' && f[4]) continue; // a let with a value is not decoded
        const type = f[3]!.trim();
        const optional = type.endsWith('?');
        fields.push({ name: f[2]!, type: optional ? type.slice(0, -1) : type, optional });
      }
      structs.set(m[1]!, { fields, problem });
    }
    for (const m of src.matchAll(/\benum\s+(\w+)\s*:\s*String\b[^{]*/g)) {
      const body = braceBody(src, m.index!);
      if (body === null) continue;
      const values: string[] = [];
      let depth = 0;
      for (const line of body.split('\n')) {
        const atTop = depth === 0;
        for (const c of line) { if (c === '{') depth++; else if (c === '}') depth--; }
        if (!atTop) continue;
        const c = /^\s*case\s+(.+)$/.exec(line);
        if (!c) continue;
        for (const part of c[1]!.split(',')) {
          const p = /^\s*`?(\w+)`?\s*(?:=\s*"((?:[^"\\]|\\.)*)")?\s*$/.exec(part);
          if (p) values.push(p[2] !== undefined ? p[2].replace(/\\"/g, '"') : p[1]!);
        }
      }
      stringEnums.set(m[1]!, values);
    }
  }
  return { structs, stringEnums };
}

export interface TsTypes {
  interfaces: Map<string, Field[]>;
  aliases: Map<string, string>;
}

function parseTsMembers(body: string): Field[] {
  const fields: Field[] = [];
  for (const st of topLevelStatements(body)) {
    const f = /^(?:readonly\s+)?(['"]?[\w$-]+['"]?)(\?)?\s*:\s*([\s\S]+?),?$/.exec(st);
    if (!f) continue;
    fields.push({ name: f[1]!.replace(/['"]/g, ''), type: f[3]!.trim(), optional: f[2] === '?' });
  }
  return fields;
}

/** Interfaces and type aliases of the sources. */
export function parseTs(sources: string[]): TsTypes {
  const interfaces = new Map<string, Field[]>();
  const aliases = new Map<string, string>();
  for (const raw of sources) {
    const src = stripComments(raw);
    for (const m of src.matchAll(/\binterface\s+(\w+)\b[^{]*/g)) {
      const body = braceBody(src, m.index!);
      if (body !== null) interfaces.set(m[1]!, parseTsMembers(body));
    }
    for (const m of src.matchAll(/\btype\s+(\w+)\s*=\s*([^;]+);/g)) aliases.set(m[1]!, m[2]!.trim());
  }
  return { interfaces, aliases };
}

// ── Type ↔ schema comparison ─────────────────────────────────────────────────────────────────

const within = (types: Set<string>, allowed: string[]) => types.size > 0 && [...types].every(t => allowed.includes(t));

/** Splits "A | B | null" at top level. */
function tsUnion(type: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const c of type) {
    if ('{[(<'.includes(c)) depth++;
    if ('}])>'.includes(c)) depth--;
    if (c === '|' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  parts.push(cur.trim());
  return parts.filter(Boolean);
}

type Checker = (where: string, type: string, nullable: boolean, node: unknown, problems: string[]) => void;

function compareFields(
  root: Schema, where: string, fields: Field[], node: unknown, ignore: Set<string>, pointer: string,
  check: Checker, problems: string[],
): void {
  const shape = objectShape(root, node);
  if (!shape) { problems.push(`${where}: the schema node is not an object`); return; }
  const names = new Set(fields.map(f => f.name));
  for (const f of fields) {
    const prop = shape.props.get(f.name);
    if (prop === undefined) { problems.push(`${where}.${f.name}: not a property in the schema`); continue; }
    if (!f.optional && !shape.required.has(f.name)) {
      problems.push(`${where}.${f.name}: non-optional here, but not required by the schema`);
    }
    check(`${where}.${f.name}`, f.type, f.optional, prop, problems);
  }
  for (const p of shape.props.keys()) {
    if (!names.has(p) && !ignore.has(`${pointer}/${p}`)) {
      problems.push(`${where}: schema property "${p}" is not read (add the field, or list ${pointer}/${p} as ignored)`);
    }
  }
}

/** Problems between a Swift Codable root struct and a schema node (empty = consistent). */
export function compareSwift(
  root: Schema, types: SwiftTypes, rootType: string, ignore: string[], node: unknown = root,
  customDecoded: Record<string, string> = {},
): string[] {
  const problems: string[] = [];
  const ignored = new Set(ignore);
  const visiting = new Set<string>();

  const checkStruct = (where: string, name: string, n: unknown, pointer: string) => {
    const s = types.structs.get(name);
    if (!s) { problems.push(`${where}: struct ${name} not found`); return; }
    if (s.problem) { problems.push(`${where}: struct ${name} ${s.problem}`); return; }
    if (visiting.has(name)) return;
    visiting.add(name);
    compareFields(root, where, s.fields, n, ignored, pointer, (w, t, opt, prop, out) => check(w, t, opt, prop, out, `${pointer}/${w.split('.').pop()}`), problems);
    visiting.delete(name);
  };

  const check = (where: string, type: string, optional: boolean, n: unknown, out: string[], pointer: string): void => {
    const types_ = jsonTypes(root, n);
    const nonNull = new Set([...types_].filter(t => t !== 'null'));
    if (types_.has('null') && !optional) out.push(`${where}: the schema allows null but the Swift type ${type} is not optional`);
    const t = type.replace(/\s+/g, '');
    const dict = /^\[String:(.+)\]$/.exec(t);
    const arr = !dict && /^\[(.+)\]$/.exec(t);
    if (dict) {
      if (!within(nonNull, ['object'])) { out.push(`${where}: Swift ${type} but the schema says ${[...types_].join('|')}`); return; }
      const shape = objectShape(root, n);
      if (!shape || shape.values.length === 0) { out.push(`${where}: Swift ${type} needs additionalProperties or patternProperties in the schema`); return; }
      for (const v of shape.values) check(`${where}[key]`, dict[1]!, false, v, out, `${pointer}/*`);
      return;
    }
    if (arr) {
      if (!within(nonNull, ['array'])) { out.push(`${where}: Swift ${type} but the schema says ${[...types_].join('|')}`); return; }
      const items = arrayItems(root, n);
      if (!items) { out.push(`${where}: Swift ${type} but the schema has no items`); return; }
      check(`${where}[]`, arr[1]!, false, items, out, `${pointer}/*`);
      return;
    }
    const scalar: Record<string, string[]> = { String: ['string'], Int: ['integer'], Double: ['number', 'integer'], Bool: ['boolean'] };
    if (scalar[t]) {
      if (!within(nonNull, scalar[t]!)) out.push(`${where}: Swift ${type} but the schema says ${[...types_].join('|') || 'any'}`);
      return;
    }
    const simple = t.split('.').pop()!;
    const custom = customDecoded[simple];
    if (custom) {
      if (!within(nonNull, [custom])) out.push(`${where}: Swift ${type} is decoded by hand from a JSON ${custom}, but the schema says ${[...types_].join('|') || 'any'}`);
      return;
    }
    const rawValues = types.stringEnums.get(simple);
    if (rawValues) {
      if (!within(nonNull, ['string'])) { out.push(`${where}: Swift String enum ${type} but the schema says ${[...types_].join('|')}`); return; }
      const vals = enumValues(root, n)?.filter(v => v !== null).map(String);
      if (!vals) { out.push(`${where}: Swift enum ${type} needs an enum in the schema`); return; }
      const a = [...rawValues].sort().join(', ');
      const b = [...vals].sort().join(', ');
      if (a !== b) out.push(`${where}: Swift enum ${type} raw values [${a}] differ from the schema enum [${b}]`);
      return;
    }
    if (!within(nonNull, ['object'])) { out.push(`${where}: Swift ${type} but the schema says ${[...types_].join('|')}`); return; }
    checkStruct(where, simple, n, pointer);
  };

  checkStruct(rootType, rootType.split('.').pop()!, node, '');
  return problems;
}

/** Problems between a TypeScript root interface and a schema node (empty = consistent). */
export function compareTs(root: Schema, types: TsTypes, rootType: string, ignore: string[], node: unknown = root): string[] {
  const problems: string[] = [];
  const ignored = new Set(ignore);
  // A recursive interface (a criteria tree) is checked once on each path.
  const visiting = new Set<string>();

  const checkFields = (where: string, fields: Field[], n: unknown, pointer: string) => {
    compareFields(root, where, fields, n, ignored, pointer, (w, t, opt, prop, out) => check(w, t, opt, prop, out, `${pointer}/${w.split('.').pop()}`), problems);
  };

  const check = (where: string, type: string, _optional: boolean, n: unknown, out: string[], pointer: string): void => {
    const types_ = jsonTypes(root, n);
    const parts = tsUnion(type);
    const hasNull = parts.includes('null');
    const rest = parts.filter(p => p !== 'null' && p !== 'undefined');
    if (types_.has('null') && !hasNull) out.push(`${where}: the schema allows null but the TypeScript type ${type} does not`);
    if (hasNull && !types_.has('null')) out.push(`${where}: TypeScript ${type} allows null but the schema does not`);
    const nonNull = new Set([...types_].filter(t => t !== 'null'));
    if (rest.length >= 1 && rest.every(p => /^'[^']*'$/.test(p))) {
      const vals = enumValues(root, n)?.filter(v => v !== null).map(String);
      const a = rest.map(p => p.slice(1, -1)).sort().join(', ');
      if (!vals || [...vals].sort().join(', ') !== a) out.push(`${where}: TypeScript literals [${a}] differ from the schema enum [${(vals ?? []).sort().join(', ')}]`);
      return;
    }
    if (rest.length !== 1) { out.push(`${where}: unsupported TypeScript type ${type}`); return; }
    const t = rest[0]!.replace(/^Readonly<(.+)>$/, '$1');
    const record = /^Record<string,\s*([\s\S]+)>$/.exec(t);
    const arr = /^([\s\S]+)\[\]$/.exec(t) ?? /^Array<([\s\S]+)>$/.exec(t);
    if (record) {
      if (!within(nonNull, ['object'])) { out.push(`${where}: TypeScript ${type} but the schema says ${[...types_].join('|')}`); return; }
      const shape = objectShape(root, n);
      if (!shape || shape.values.length === 0) { out.push(`${where}: TypeScript ${type} needs additionalProperties or patternProperties in the schema`); return; }
      for (const v of shape.values) check(`${where}[key]`, record[1]!, false, v, out, `${pointer}/*`);
      return;
    }
    if (arr) {
      if (!within(nonNull, ['array'])) { out.push(`${where}: TypeScript ${type} but the schema says ${[...types_].join('|')}`); return; }
      const items = arrayItems(root, n);
      if (!items) { out.push(`${where}: TypeScript ${type} but the schema has no items`); return; }
      check(`${where}[]`, arr[1]!, false, items, out, `${pointer}/*`);
      return;
    }
    const tuple = /^\[([\s\S]*)\]$/.exec(t);
    if (tuple) {
      // A fixed-length tuple ([number, number, number]): an array of exactly that many items.
      if (!within(nonNull, ['array'])) { out.push(`${where}: TypeScript tuple ${type} but the schema says ${[...types_].join('|')}`); return; }
      const elems = tsUnion(tuple[1]!.replace(/,/g, '|'));
      const a = deref(root, n);
      if (a.minItems !== elems.length || a.maxItems !== elems.length) {
        out.push(`${where}: TypeScript tuple of ${elems.length} but the schema does not fix minItems / maxItems at ${elems.length}`);
      }
      const prefix = Array.isArray(a.prefixItems) ? a.prefixItems : null;
      const items = arrayItems(root, n);
      elems.forEach((e, i) => {
        const itemNode = prefix ? prefix[i] : items;
        if (itemNode === undefined || itemNode === null) { out.push(`${where}[${i}]: the schema has no item schema`); return; }
        check(`${where}[${i}]`, e, false, itemNode, out, `${pointer}/*`);
      });
      return;
    }
    const scalar: Record<string, string[]> = { string: ['string'], number: ['number', 'integer'], boolean: ['boolean'] };
    if (scalar[t]) {
      if (!within(nonNull, scalar[t]!)) out.push(`${where}: TypeScript ${type} but the schema says ${[...types_].join('|') || 'any'}`);
      return;
    }
    if (t.startsWith('{')) {
      if (!within(nonNull, ['object'])) { out.push(`${where}: TypeScript ${type} but the schema says ${[...types_].join('|')}`); return; }
      checkFields(where, parseTsMembers(t.slice(1, -1)), n, pointer);
      return;
    }
    const alias = types.aliases.get(t);
    if (alias) { check(where, alias, _optional, n, out, pointer); return; }
    const fields = types.interfaces.get(t);
    if (!fields) { out.push(`${where}: TypeScript type ${t} not found`); return; }
    if (!within(nonNull, ['object'])) { out.push(`${where}: TypeScript ${t} but the schema says ${[...types_].join('|')}`); return; }
    if (visiting.has(t)) return;
    visiting.add(t);
    checkFields(where, fields, n, pointer);
    visiting.delete(t);
  };

  const fields = types.interfaces.get(rootType);
  if (!fields) return [`${rootType}: interface not found`];
  checkFields(rootType, fields, node, '');
  return problems;
}

// ── Whole-library check ──────────────────────────────────────────────────────────────────────

function getPointer(data: unknown, pointer: string): unknown {
  let v: unknown = data;
  for (const part of pointer.split('/').slice(1)) v = isObj(v) ? v[part] : Array.isArray(v) ? v[Number(part)] : undefined;
  return v;
}

export interface RegistryEntry {
  id: string;
  files: string[];
  contentVersion: string;
  versionStamp?: { file: string; type: string; key?: string };
}

/** Every problem with the shared content library (empty = OK). */
export function checkSharedContent(repoRoot: string): { problems: string[]; checked: string[] } {
  const problems: string[] = [];
  const read = (p: string) => readFileSync(join(repoRoot, p), 'utf8');
  const exists = (p: string) => existsSync(join(repoRoot, p));

  // Every content file, keyed "<prefix><name>" (a rules file keeps its bare name).
  const files: { key: string; name: string; dir: (typeof CONTENT_DIRS)[number] }[] = [];
  for (const d of CONTENT_DIRS) {
    if (!exists(d.dir)) continue;
    for (const f of readdirSync(join(repoRoot, d.dir)).filter(x => x.endsWith('.json'))) {
      files.push({ key: `${d.prefix}${f.slice(0, -5)}`, name: f.slice(0, -5), dir: d });
    }
  }
  files.sort((a, b) => a.key.localeCompare(b.key));
  const rules = files.map(f => f.key);
  const configured = new Map(SHARED_CONTENT.map(c => [contentKey(c), c]));
  const schemaOf = (f: { key: string; name: string }) => configured.get(f.key)?.schema ?? f.name;
  const schemas = exists(SCHEMAS_DIR) ? readdirSync(join(repoRoot, SCHEMAS_DIR)).filter(f => f.endsWith('.schema.json')).map(f => f.slice(0, -12)).sort() : [];
  const usedSchemas = new Set(files.map(schemaOf));
  for (const s of schemas) {
    if (!usedSchemas.has(s)) problems.push(`${SCHEMAS_DIR}/${s}.schema.json has no content file (${RULES_DIR}/${s}.json, or a SHARED_CONTENT entry naming the schema)`);
  }
  for (const [key, c] of configured) {
    const d = CONTENT_DIRS.find(x => x.key === (c.dir ?? 'rules'))!;
    if (!rules.includes(key)) problems.push(`${d.dir}/${c.name}.json is missing (listed in SHARED_CONTENT)`);
  }

  let registry: RegistryEntry[] = [];
  try {
    registry = (JSON.parse(read(REGISTRY_FILE)) as { ruleSets: RegistryEntry[] }).ruleSets;
  } catch (e) {
    problems.push(`${REGISTRY_FILE}: ${(e as Error).message}`);
  }

  const loader = exists(IOS_LOADER) ? read(IOS_LOADER) : '';
  if (!loader) problems.push(`${IOS_LOADER} is missing`);
  const project = exists(IOS_PROJECT) ? read(IOS_PROJECT) : '';
  for (const d of CONTENT_DIRS) {
    if (d.key !== 'rules' && !files.some(f => f.dir.key === d.key)) continue;
    const folderRef = new RegExp(`-\\s*path:\\s*${d.iosFolder.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\\s*\\n\\s*type:\\s*folder\\s*\\n\\s*buildPhase:\\s*resources`);
    if (!folderRef.test(project)) {
      problems.push(`${IOS_PROJECT}: the app target must bundle "${d.iosFolder}" as a folder reference (type: folder, buildPhase: resources)`);
    }
  }

  for (const retired of RETIRED_COPIES) {
    if (exists(retired)) problems.push(`${retired} is a retired platform copy: delete it (the shared file is the only source)`);
  }

  for (const content of files) {
    const { name, key } = content;
    const schemaName = schemaOf(content);
    const file = `${content.dir.dir}/${name}.json`;
    const schemaFile = `${SCHEMAS_DIR}/${schemaName}.schema.json`;
    if (!schemas.includes(schemaName)) { problems.push(`${file} has no schema ${schemaFile}`); continue; }
    let data: Record<string, unknown>;
    let schema: Schema;
    try { data = JSON.parse(read(file)) as Record<string, unknown>; } catch (e) { problems.push(`${file}: not valid JSON (${(e as Error).message})`); continue; }
    try { schema = JSON.parse(read(schemaFile)) as Schema; } catch (e) { problems.push(`${schemaFile}: not valid JSON (${(e as Error).message})`); continue; }

    // 1. Schema validation.
    try {
      // strictRequired off: map-like objects list their required keys with patternProperties.
      const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
      const validate = ajv.compile(schema);
      if (!validate(data)) {
        for (const err of validate.errors ?? []) problems.push(`${file}${err.instancePath || '/'}: ${err.message ?? 'invalid'}${err.params ? ` ${JSON.stringify(err.params)}` : ''}`);
      }
    } catch (e) {
      problems.push(`${schemaFile}: not a usable JSON Schema (${(e as Error).message})`);
      continue;
    }
    if (data.$schema !== `../schemas/${schemaName}.schema.json`) problems.push(`${file}: "$schema" must be "../schemas/${schemaName}.schema.json"`);

    // 2. Registry: the id names an entry that lists the file and stamps its version from it.
    const entry = registry.find(r => r.id === data.id);
    if (!entry) problems.push(`${file}: id "${String(data.id)}" is not a rule set in ${REGISTRY_FILE}`);
    else {
      if (!entry.files.includes(file)) problems.push(`${REGISTRY_FILE} ${entry.id}: files must list ${file}`);
      const stamp = entry.versionStamp;
      if (!stamp || stamp.file !== file || stamp.type !== 'json-key' || stamp.key !== 'version') {
        problems.push(`${REGISTRY_FILE} ${entry.id}: versionStamp must be { "file": "${file}", "type": "json-key", "key": "version" }`);
      }
      if (entry.contentVersion !== data.version) problems.push(`${REGISTRY_FILE} ${entry.id}: contentVersion ${entry.contentVersion} but ${file} says ${String(data.version)}`);
    }

    // 3. The iOS loader lists the file.
    if (loader && !new RegExp(`case\\s+\\w+\\s*=\\s*"${name}"`).test(loader)) {
      problems.push(`${IOS_LOADER}: SharedClinicalContent.File has no case for "${name}" (Settings → Diagnostics would not show it)`);
    }

    const cfg = configured.get(key);
    if (!cfg) { problems.push(`${file}: not listed in SHARED_CONTENT (scripts/src/shared-content.ts): add how each platform reads it`); continue; }

    // 4. Regular expressions compile.
    for (const p of cfg.regexLists) {
      const list = getPointer(data, p);
      if (!Array.isArray(list)) { problems.push(`${file}${p}: expected a list of regular expressions`); continue; }
      for (const r of list) {
        try { new RegExp(String(r), 'i'); } catch (e) { problems.push(`${file}${p}: "${String(r)}" does not compile (${(e as Error).message})`); }
      }
    }

    // 5. Swift Codable structs and TypeScript interfaces agree with the schema.
    for (const [platform, m, compare] of [
      ['Swift', cfg.swift, (s: string[]) => compareSwift(schema, parseSwift(s), cfg.swift.root, cfg.swift.ignore, schema, cfg.swift.customDecoded)],
      ['TypeScript', cfg.ts, (s: string[]) => compareTs(schema, parseTs(s), cfg.ts.root, cfg.ts.ignore)],
    ] as const) {
      const missing = m.files.filter(f => !exists(f));
      if (missing.length) { problems.push(`${file}: ${platform} source ${missing.join(', ')} not found`); continue; }
      for (const p of compare(m.files.map(read))) problems.push(`${file} ↔ ${platform} ${p}`);
    }
  }
  return { problems, checked: rules };
}
