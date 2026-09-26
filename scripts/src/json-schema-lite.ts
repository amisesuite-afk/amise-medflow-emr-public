/**
 * A small JSON Schema (2020-12 subset) validator for the clinical-content rule files, so a schema
 * check runs without a schema library in the workspace. Supports: type (incl. arrays of types and
 * "integer"), const, enum, required, properties, additionalProperties (false or a schema),
 * items, minItems, minLength, pattern, minimum / maximum / exclusiveMinimum / exclusiveMaximum,
 * oneOf, anyOf, allOf and local $ref ("#/$defs/…"). Unknown keywords are ignored (description,
 * title, $id, $schema). Easy to replace with a full validator when the shared-content check lands.
 */
type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type Schema = { [k: string]: unknown };

function typeOf(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
  return typeof v;
}

function typeMatches(v: unknown, t: string): boolean {
  const actual = typeOf(v);
  return actual === t || (t === 'number' && actual === 'integer');
}

export function validate(root: Schema, value: unknown): string[] {
  const errors: string[] = [];
  const resolve = (ref: string): Schema => {
    if (!ref.startsWith('#/')) throw new Error(`unsupported $ref ${ref}`);
    let node: unknown = root;
    for (const part of ref.slice(2).split('/')) node = (node as Record<string, unknown>)[part];
    if (!node) throw new Error(`unresolved $ref ${ref}`);
    return node as Schema;
  };
  const check = (schema: Schema, v: unknown, path: string): boolean => {
    const before = errors.length;
    const fail = (msg: string) => errors.push(`${path || '(root)'}: ${msg}`);
    if (typeof schema.$ref === 'string') check(resolve(schema.$ref), v, path);
    if (schema.type !== undefined) {
      const types = Array.isArray(schema.type) ? schema.type as string[] : [schema.type as string];
      if (!types.some(t => typeMatches(v, t))) { fail(`expected ${types.join('|')}, got ${typeOf(v)}`); return false; }
    }
    if ('const' in schema && JSON.stringify(schema.const) !== JSON.stringify(v)) fail(`must be ${JSON.stringify(schema.const)}`);
    if (Array.isArray(schema.enum) && !schema.enum.some(e => JSON.stringify(e) === JSON.stringify(v))) fail(`not one of ${JSON.stringify(schema.enum)}`);
    if (typeof v === 'string') {
      if (typeof schema.minLength === 'number' && v.length < schema.minLength) fail(`shorter than ${schema.minLength}`);
      if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern, 'u').test(v)) fail(`does not match /${schema.pattern}/`);
    }
    if (typeof v === 'number') {
      if (typeof schema.minimum === 'number' && v < schema.minimum) fail(`below ${schema.minimum}`);
      if (typeof schema.maximum === 'number' && v > schema.maximum) fail(`above ${schema.maximum}`);
      if (typeof schema.exclusiveMinimum === 'number' && v <= schema.exclusiveMinimum) fail(`not above ${schema.exclusiveMinimum}`);
      if (typeof schema.exclusiveMaximum === 'number' && v >= schema.exclusiveMaximum) fail(`not below ${schema.exclusiveMaximum}`);
    }
    if (Array.isArray(v)) {
      if (typeof schema.minItems === 'number' && v.length < schema.minItems) fail(`fewer than ${schema.minItems} items`);
      if (schema.items && typeof schema.items === 'object') v.forEach((x, i) => check(schema.items as Schema, x, `${path}[${i}]`));
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const obj = v as Record<string, unknown>;
      for (const k of (schema.required as string[] | undefined) ?? []) if (!(k in obj)) fail(`missing "${k}"`);
      const props = (schema.properties ?? {}) as Record<string, Schema>;
      for (const [k, x] of Object.entries(obj)) {
        if (props[k]) check(props[k], x, `${path}.${k}`);
        else if (schema.additionalProperties === false) fail(`unexpected property "${k}"`);
        else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
          check(schema.additionalProperties as Schema, x, `${path}.${k}`);
        }
      }
    }
    const sub = (list: unknown) => (Array.isArray(list) ? list as Schema[] : []);
    for (const s of sub(schema.allOf)) check(s, v, path);
    const trial = (s: Schema) => {
      const saved = errors.length;
      const ok = check(s, v, path);
      errors.length = saved;
      return ok;
    };
    if (schema.oneOf && sub(schema.oneOf).filter(trial).length !== 1) fail('must match exactly one oneOf branch');
    if (schema.anyOf && !sub(schema.anyOf).some(trial)) fail('must match an anyOf branch');
    return errors.length === before;
  };
  check(root, value as Json, '');
  return errors;
}
