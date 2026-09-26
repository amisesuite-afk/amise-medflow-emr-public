/**
 * A small JSON Schema (draft 2020-12) checker for the approved-content channel: the subset of
 * keywords that clinical-content/schemas/*.schema.json use, and nothing else.
 *
 * Why not ajv (what lint:shared-content uses): ajv compiles schemas with `new Function`, which a
 * strict Content-Security-Policy refuses, and iOS has no ajv. This checker is interpreted, runs the
 * same in the browser, Node and (as its Swift twin, ApprovedContent.swift `SchemaCheck`) on iOS,
 * and is pinned to ajv on every repository rule file and on the shared vectors by
 * scripts/src/approved-content.test.ts.
 *
 * Fail-closed: a schema keyword it does not implement is reported as a problem, so a schema that
 * starts using a new keyword makes every release of that file "schema-invalid" (the bundled copy
 * stays in use) until the checker learns it — never a silent pass.
 *
 * Supported: type (string or list), enum, const, properties, required, additionalProperties
 * (boolean or schema), patternProperties, propertyNames, minProperties, maxProperties, items
 * (a schema), minItems, maxItems, minLength, maxLength (Unicode code points), pattern (unanchored
 * search, JavaScript `u` flag / ICU), minimum, maximum, exclusiveMinimum, exclusiveMaximum (numbers),
 * oneOf, anyOf, allOf, $ref (local "#/…" JSON pointer), and the annotations $schema, $id, $comment,
 * $defs, title, description, default, examples. Boolean schemas (true / false) are accepted.
 */

export type JsonSchema = boolean | { [keyword: string]: unknown };

const ANNOTATIONS = new Set(['$schema', '$id', '$comment', '$defs', 'title', 'description', 'default', 'examples']);
const KEYWORDS = new Set([
  'type', 'enum', 'const', 'properties', 'required', 'additionalProperties', 'patternProperties',
  'propertyNames', 'minProperties', 'maxProperties', 'items', 'minItems', 'maxItems', 'minLength',
  'maxLength', 'pattern', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'oneOf',
  'anyOf', 'allOf', '$ref',
]);

/** Every keyword the checker understands (annotations included). The Swift twin lists the same. */
export const SCHEMA_CHECK_KEYWORDS: readonly string[] = [...ANNOTATIONS, ...KEYWORDS].sort();

const MAX_PROBLEMS = 20;
const MAX_DEPTH = 256;

interface Ctx {
  root: JsonSchema;
  problems: string[];
  regexCache: Map<string, RegExp | null>;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Structural equality of two parsed JSON values (numbers by value). */
export function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((x, i) => jsonEqual(x, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    return ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && jsonEqual(a[k], b[k]));
  }
  return false;
}

function typeMatches(type: string, v: unknown): boolean {
  switch (type) {
    case 'null': return v === null;
    case 'boolean': return typeof v === 'boolean';
    case 'object': return isObject(v);
    case 'array': return Array.isArray(v);
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'integer': return typeof v === 'number' && Number.isInteger(v);
    case 'string': return typeof v === 'string';
    default: return false;
  }
}

function codePoints(s: string): number {
  let n = 0;
  for (const _ of s) n++;
  return n;
}

function resolveRef(ctx: Ctx, ref: string): JsonSchema | undefined {
  if (ref === '#') return ctx.root;
  if (!ref.startsWith('#/')) return undefined;
  let node: unknown = ctx.root;
  for (const raw of ref.slice(2).split('/')) {
    const part = decodeURIComponent(raw).replace(/~1/g, '/').replace(/~0/g, '~');
    node = isObject(node) ? node[part] : undefined;
    if (node === undefined) return undefined;
  }
  return typeof node === 'boolean' || isObject(node) ? (node as JsonSchema) : undefined;
}

function regex(ctx: Ctx, pattern: string): RegExp | null {
  if (!ctx.regexCache.has(pattern)) {
    let re: RegExp | null = null;
    try { re = new RegExp(pattern, 'u'); } catch { re = null; }
    ctx.regexCache.set(pattern, re);
  }
  return ctx.regexCache.get(pattern) ?? null;
}

function add(ctx: Ctx, path: string, message: string): void {
  if (ctx.problems.length < MAX_PROBLEMS) ctx.problems.push(`${path || '/'}: ${message}`);
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** True when `data` is valid against `schema` (problems collected in a throw-away context). */
function passes(ctx: Ctx, schema: JsonSchema, data: unknown, path: string, depth: number): boolean {
  const sub: Ctx = { root: ctx.root, problems: [], regexCache: ctx.regexCache };
  check(sub, schema, data, path, depth);
  return sub.problems.length === 0;
}

function check(ctx: Ctx, schema: JsonSchema, data: unknown, path: string, depth: number): void {
  if (ctx.problems.length >= MAX_PROBLEMS) return;
  if (depth > MAX_DEPTH) { add(ctx, path, 'schema nested too deeply'); return; }
  if (schema === true) return;
  if (schema === false) { add(ctx, path, 'not allowed (false schema)'); return; }
  if (!isObject(schema)) { add(ctx, path, 'schema is not an object'); return; }

  for (const k of Object.keys(schema)) {
    if (!ANNOTATIONS.has(k) && !KEYWORDS.has(k)) add(ctx, path, `unsupported schema keyword "${k}"`);
  }

  if (schema.$ref !== undefined) {
    const target = typeof schema.$ref === 'string' ? resolveRef(ctx, schema.$ref) : undefined;
    if (target === undefined) add(ctx, path, `unresolved $ref ${String(schema.$ref)}`);
    else check(ctx, target, data, path, depth + 1);
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some(t => typeof t === 'string' && typeMatches(t, data))) {
      add(ctx, path, `expected ${types.join(' or ')}`);
      return;
    }
  }
  if (schema.enum !== undefined) {
    if (!Array.isArray(schema.enum) || !schema.enum.some(e => jsonEqual(e, data))) add(ctx, path, 'not one of the allowed values');
  }
  if (schema.const !== undefined && !jsonEqual(schema.const, data)) add(ctx, path, 'not the required constant');

  if (typeof data === 'string') {
    const len = codePoints(data);
    const minL = num(schema.minLength), maxL = num(schema.maxLength);
    if (minL !== null && len < minL) add(ctx, path, `shorter than ${minL}`);
    if (maxL !== null && len > maxL) add(ctx, path, `longer than ${maxL}`);
    if (schema.pattern !== undefined) {
      const re = typeof schema.pattern === 'string' ? regex(ctx, schema.pattern) : null;
      if (!re) add(ctx, path, 'invalid pattern in schema');
      else if (!re.test(data)) add(ctx, path, 'does not match the pattern');
    }
  }

  if (typeof data === 'number') {
    const min = num(schema.minimum), max = num(schema.maximum);
    const xmin = num(schema.exclusiveMinimum), xmax = num(schema.exclusiveMaximum);
    if (min !== null && data < min) add(ctx, path, `below ${min}`);
    if (max !== null && data > max) add(ctx, path, `above ${max}`);
    if (xmin !== null && data <= xmin) add(ctx, path, `not above ${xmin}`);
    if (xmax !== null && data >= xmax) add(ctx, path, `not below ${xmax}`);
  }

  if (Array.isArray(data)) {
    const minI = num(schema.minItems), maxI = num(schema.maxItems);
    if (minI !== null && data.length < minI) add(ctx, path, `fewer than ${minI} items`);
    if (maxI !== null && data.length > maxI) add(ctx, path, `more than ${maxI} items`);
    if (schema.items !== undefined) {
      const items = schema.items;
      if (typeof items !== 'boolean' && !isObject(items)) add(ctx, path, 'unsupported "items" form');
      else data.forEach((item, i) => check(ctx, items as JsonSchema, item, `${path}/${i}`, depth + 1));
    }
  }

  if (isObject(data)) {
    const keys = Object.keys(data);
    const minP = num(schema.minProperties), maxP = num(schema.maxProperties);
    if (minP !== null && keys.length < minP) add(ctx, path, `fewer than ${minP} properties`);
    if (maxP !== null && keys.length > maxP) add(ctx, path, `more than ${maxP} properties`);
    if (Array.isArray(schema.required)) {
      for (const r of schema.required) {
        if (typeof r === 'string' && !Object.prototype.hasOwnProperty.call(data, r)) add(ctx, path, `missing "${r}"`);
      }
    }
    const props = isObject(schema.properties) ? schema.properties : {};
    const patternProps = isObject(schema.patternProperties) ? schema.patternProperties : {};
    for (const k of keys) {
      const childPath = `${path}/${k.replace(/~/g, '~0').replace(/\//g, '~1')}`;
      let matched = false;
      if (Object.prototype.hasOwnProperty.call(props, k)) {
        matched = true;
        check(ctx, props[k] as JsonSchema, data[k], childPath, depth + 1);
      }
      for (const [p, sub] of Object.entries(patternProps)) {
        const re = regex(ctx, p);
        if (!re) { add(ctx, path, 'invalid patternProperties pattern'); continue; }
        if (re.test(k)) {
          matched = true;
          check(ctx, sub as JsonSchema, data[k], childPath, depth + 1);
        }
      }
      if (!matched && schema.additionalProperties !== undefined) {
        check(ctx, schema.additionalProperties as JsonSchema, data[k], childPath, depth + 1);
      }
      if (schema.propertyNames !== undefined) {
        check(ctx, schema.propertyNames as JsonSchema, k, childPath, depth + 1);
      }
    }
  }

  if (schema.allOf !== undefined) {
    if (!Array.isArray(schema.allOf)) add(ctx, path, 'allOf is not a list');
    else for (const s of schema.allOf) check(ctx, s as JsonSchema, data, path, depth + 1);
  }
  if (schema.anyOf !== undefined) {
    if (!Array.isArray(schema.anyOf) || !schema.anyOf.some(s => passes(ctx, s as JsonSchema, data, path, depth + 1))) {
      add(ctx, path, 'matches none of anyOf');
    }
  }
  if (schema.oneOf !== undefined) {
    const n = Array.isArray(schema.oneOf)
      ? schema.oneOf.filter(s => passes(ctx, s as JsonSchema, data, path, depth + 1)).length
      : 0;
    if (n !== 1) add(ctx, path, n === 0 ? 'matches none of oneOf' : 'matches more than one of oneOf');
  }
}

/**
 * Problems found checking `data` against `schema` (empty = valid). At most 20, each
 * "<JSON pointer>: <what>" — key paths and rule names only, never a value.
 */
export function schemaProblems(schema: JsonSchema, data: unknown): string[] {
  const ctx: Ctx = { root: schema, problems: [], regexCache: new Map() };
  check(ctx, schema, data, '', 0);
  return ctx.problems;
}
