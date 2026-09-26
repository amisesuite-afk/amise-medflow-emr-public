/**
 * Shared test vectors for the approved-content channel (docs/APPROVED-CONTENT-CHANNEL.md):
 * canonical JSON + SHA-256, the JSON Schema subset checker and the release-selection rules.
 * Written to ios/AmiseMedFlowTests/Resources/ApprovedContentVectors.json and run by both
 * platforms: scripts/src/approved-content.test.ts (web, lib/triage-engine/src/approved-content)
 * and ios/AmiseMedFlowTests/ApprovedContentTests.swift (Services/ApprovedContent.swift).
 *
 * The expected results below are written by hand; only the release hashes are computed (with the
 * web implementation, cross-checked against node:crypto by the test). Regenerate after a change:
 *   pnpm --filter @workspace/scripts run gen:approved-content-vectors
 * approved-content.test.ts fails when the committed file differs from this output.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson, sha256Hex } from '../../lib/triage-engine/src/approved-content';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
export const APPROVED_CONTENT_VECTORS_FILE = 'ios/AmiseMedFlowTests/Resources/ApprovedContentVectors.json';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

// ── Canonical JSON ─────────────────────────────────────────────────────────────────────────

/** `json` is parsed by each platform's own JSON reader, then canonicalised. */
const CANONICAL_CASES: { name: string; json: string; canonical?: string; error?: true }[] = [
  {
    name: 'keys sorted by UTF-16 code units, no whitespace',
    json: '{ "b": 1, "a": 2, "B": 3, "aa": 0, "_": null }',
    canonical: '{"B":3,"_":null,"a":2,"aa":0,"b":1}',
  },
  {
    name: 'nested objects and arrays keep array order',
    json: '{\n  "z": [3, 1, 2, {"y": true, "x": false}],\n  "e": {},\n  "f": [],\n  "a": {"d": [], "c": {"b": "x"}}\n}',
    canonical: '{"a":{"c":{"b":"x"},"d":[]},"e":{},"f":[],"z":[3,1,2,{"x":false,"y":true}]}',
  },
  {
    name: 'numbers: plain decimal, shortest round-trip digits, integers without a point',
    json: '{"v":[0,-0,1,-1,1.0,1.5,0.1,0.2,100,123.456,1e-7,1.5e-7,2.5e3,-0.000123,0.30000000000000004,1234567.125,9007199254740991,-9007199254740991,5e-324]}',
    canonical: '{"v":[0,0,1,-1,1,1.5,0.1,0.2,100,123.456,0.0000001,0.00000015,2500,-0.000123,0.30000000000000004,1234567.125,9007199254740991,-9007199254740991,'
      + `0.${'0'.repeat(323)}5]}`,
  },
  {
    name: 'string escapes: only quote, backslash and control characters',
    json: '{"s":"q \\" b \\\\ s \\/ t \\t n \\n r \\r bs \\b ff \\f nul \\u0000 us \\u001f del \\u007f é 😀 \\u2028 \\u00e9"}',
    canonical: '{"s":"q \\" b \\\\ s / t \\t n \\n r \\r bs \\b ff \\f nul \\u0000 us \\u001f del \u007f é 😀   é"}',
  },
  {
    name: 'non-ASCII keys sort by UTF-16 code units, not code points',
    json: '{"～":1,"😀":2,"é":3,"z":4}',
    canonical: '{"z":4,"é":3,"😀":2,"～":1}',
  },
  {
    name: 'a realistic rule-file fragment',
    json: '{"$schema":"../schemas/x.schema.json","id":"zebra-rules","version":"1.0.1","rules":[{"id":"eoe","atLeast":null,"all":[["dysphagia","food bolus"]],"lr":2.5}]}',
    canonical: '{"$schema":"../schemas/x.schema.json","id":"zebra-rules","rules":[{"all":[["dysphagia","food bolus"]],"atLeast":null,"id":"eoe","lr":2.5}],"version":"1.0.1"}',
  },
  { name: 'integer above 2^53 − 1 is refused', json: '{"v":9007199254740992}', error: true },
  { name: 'integer far above 2^53 is refused', json: '{"v":9007199254740993}', error: true },
  { name: 'integral 1e300 is refused', json: '{"v":1e300}', error: true },
];

// ── Schema checker ────────────────────────────────────────────────────────────────────────

const SCHEMA_DEMO: Json = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'demo',
  title: 'demo',
  type: 'object',
  required: ['name', 'count', 'tags'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 2, maxLength: 5, pattern: '^[a-z]+$' },
    count: { type: 'integer', minimum: 0, maximum: 10 },
    ratio: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 1 },
    kind: { enum: ['a', 'b', null] },
    fixed: { const: { x: [1, 2] } },
    tags: { type: 'array', minItems: 1, maxItems: 3, items: { $ref: '#/$defs/tag' } },
    either: { oneOf: [{ type: 'string' }, { type: 'integer', minimum: 5 }, { type: 'number', maximum: 6 }] },
    map: {
      type: 'object',
      minProperties: 1,
      maxProperties: 2,
      propertyNames: { pattern: '^[a-z]+$' },
      patternProperties: { '^x': { type: 'boolean' } },
      additionalProperties: { type: 'string' },
    },
    nullable: { type: ['string', 'null'] },
  },
  $defs: { tag: { type: 'string', pattern: '^[a-z0-9-]+$' } },
};

const SCHEMA_CASES: { name: string; schema: Json; data: Json; valid: boolean; ajv?: false }[] = [
  { name: 'valid minimal', schema: SCHEMA_DEMO, data: { name: 'ab', count: 0, tags: ['x'] }, valid: true },
  {
    name: 'valid with every optional field',
    schema: SCHEMA_DEMO,
    data: { name: 'abcde', count: 10, ratio: 0.5, kind: null, fixed: { x: [1, 2] }, tags: ['a-1', 'b', 'c'], either: 'text', map: { xa: true, b: 'y' }, nullable: null },
    valid: true,
  },
  { name: 'missing required', schema: SCHEMA_DEMO, data: { name: 'ab', count: 0 }, valid: false },
  { name: 'additional property refused', schema: SCHEMA_DEMO, data: { name: 'ab', count: 0, tags: ['x'], extra: 1 }, valid: false },
  { name: 'wrong type', schema: SCHEMA_DEMO, data: { name: 'ab', count: '0', tags: ['x'] }, valid: false },
  { name: 'integer refuses a fraction', schema: SCHEMA_DEMO, data: { name: 'ab', count: 1.5, tags: ['x'] }, valid: false },
  { name: 'integer accepts 2.0 written as 2', schema: SCHEMA_DEMO, data: { name: 'ab', count: 2, tags: ['x'] }, valid: true },
  { name: 'minLength counts code points', schema: SCHEMA_DEMO, data: { name: 'a', count: 0, tags: ['x'] }, valid: false },
  { name: 'maxLength', schema: SCHEMA_DEMO, data: { name: 'abcdef', count: 0, tags: ['x'] }, valid: false },
  { name: 'pattern', schema: SCHEMA_DEMO, data: { name: 'aB', count: 0, tags: ['x'] }, valid: false },
  { name: 'maximum', schema: SCHEMA_DEMO, data: { name: 'ab', count: 11, tags: ['x'] }, valid: false },
  { name: 'minimum', schema: SCHEMA_DEMO, data: { name: 'ab', count: -1, tags: ['x'] }, valid: false },
  { name: 'exclusiveMinimum', schema: SCHEMA_DEMO, data: { name: 'ab', count: 0, ratio: 0, tags: ['x'] }, valid: false },
  { name: 'exclusiveMaximum', schema: SCHEMA_DEMO, data: { name: 'ab', count: 0, ratio: 1, tags: ['x'] }, valid: false },
  { name: 'enum', schema: SCHEMA_DEMO, data: { name: 'ab', count: 0, kind: 'c', tags: ['x'] }, valid: false },
  { name: 'const deep', schema: SCHEMA_DEMO, data: { name: 'ab', count: 0, fixed: { x: [2, 1] }, tags: ['x'] }, valid: false },
  { name: 'minItems', schema: SCHEMA_DEMO, data: { name: 'ab', count: 0, tags: [] }, valid: false },
  { name: 'maxItems', schema: SCHEMA_DEMO, data: { name: 'ab', count: 0, tags: ['a', 'b', 'c', 'd'] }, valid: false },
  { name: 'items through $ref', schema: SCHEMA_DEMO, data: { name: 'ab', count: 0, tags: ['UPPER'] }, valid: false },
  { name: 'oneOf: none matches', schema: SCHEMA_DEMO, data: { name: 'ab', count: 0, tags: ['x'], either: true }, valid: false },
  { name: 'oneOf: two match (5 is an integer ≥ 5 and a number ≤ 6)', schema: SCHEMA_DEMO, data: { name: 'ab', count: 0, tags: ['x'], either: 5 }, valid: false },
  { name: 'oneOf: exactly one matches', schema: SCHEMA_DEMO, data: { name: 'ab', count: 0, tags: ['x'], either: 7 }, valid: true },
  { name: 'patternProperties', schema: SCHEMA_DEMO, data: { name: 'ab', count: 0, tags: ['x'], map: { xa: 'no' } }, valid: false },
  { name: 'additionalProperties schema', schema: SCHEMA_DEMO, data: { name: 'ab', count: 0, tags: ['x'], map: { b: 1 } }, valid: false },
  { name: 'propertyNames', schema: SCHEMA_DEMO, data: { name: 'ab', count: 0, tags: ['x'], map: { B: 'y' } }, valid: false },
  { name: 'minProperties', schema: SCHEMA_DEMO, data: { name: 'ab', count: 0, tags: ['x'], map: {} }, valid: false },
  { name: 'maxProperties', schema: SCHEMA_DEMO, data: { name: 'ab', count: 0, tags: ['x'], map: { a: 'x', b: 'y', c: 'z' } }, valid: false },
  { name: 'type list', schema: SCHEMA_DEMO, data: { name: 'ab', count: 0, tags: ['x'], nullable: 3 }, valid: false },
  { name: 'unsupported keyword fails closed', schema: { type: 'string', format: 'date' }, data: '2026-09-26', valid: false, ajv: false },
  { name: 'unresolved $ref fails closed', schema: { $ref: '#/$defs/missing' }, data: 1, valid: false, ajv: false },
  { name: 'false schema', schema: { type: 'object', properties: { a: false } }, data: { a: 1 }, valid: false },
];

// ── Selection ─────────────────────────────────────────────────────────────────────────────

const CONTENT_ID = 'demo-rules';

const SELECT_SCHEMA: Json = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  required: ['id', 'version', 'rules', 'text'],
  additionalProperties: false,
  properties: {
    $schema: { type: 'string' },
    $comment: { type: 'string' },
    id: { type: 'string', pattern: '^[a-z0-9-]+$' },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    rules: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'weight'],
        additionalProperties: false,
        properties: { id: { type: 'string', pattern: '^[a-z0-9-]+$' }, weight: { type: 'number', exclusiveMinimum: 0 } },
      },
    },
    text: {
      type: 'object',
      required: ['patient'],
      additionalProperties: false,
      properties: { patient: { type: 'string', minLength: 1 } },
    },
  },
};

const BUNDLED = {
  $schema: '../schemas/demo-rules.schema.json',
  $comment: 'Bundled copy.',
  id: CONTENT_ID,
  version: '1.2.0',
  rules: [{ id: 'a', weight: 1.5 }],
  text: { patient: 'Please bring a list of your medicines.' },
};

type Body = Record<string, Json>;

function body(version: string, change: (b: Body) => void = () => {}): Body {
  const b = JSON.parse(JSON.stringify(BUNDLED)) as Body;
  b.version = version;
  (b.rules as Json[]).push({ id: `r-${version.replace(/\./g, '-')}`, weight: 0.25 });
  change(b);
  return b;
}

interface ReleaseVector {
  content_id: string;
  version: string;
  sha256: string;
  body: Json;
  revoked_at: string | null;
}

function release(version: string, opts: {
  body?: Json; contentId?: string; revoked?: boolean; sha?: (s: string) => string;
} = {}): ReleaseVector {
  const b = opts.body ?? body(version);
  const sha = sha256Hex(canonicalJson(b));
  return {
    content_id: opts.contentId ?? CONTENT_ID,
    version,
    sha256: opts.sha ? opts.sha(sha) : sha,
    body: b,
    revoked_at: opts.revoked ? '2026-09-26T12:00:00Z' : null,
  };
}

interface Expected { source: 'bundled' | 'release'; version: string; rejected: { version: string; reason: string }[] }

const SELECT_CASES: { name: string; bundled?: Json; releases: ReleaseVector[]; expected: Expected }[] = [
  { name: 'no releases: bundled', releases: [], expected: { source: 'bundled', version: '1.2.0', rejected: [] } },
  { name: 'a newer valid release is used', releases: [release('1.2.1')], expected: { source: 'release', version: '1.2.1', rejected: [] } },
  {
    name: 'highest version wins, compared as numbers (1.10.0 > 1.9.0)',
    releases: [release('1.9.0'), release('1.10.0'), release('1.2.1')],
    expected: { source: 'release', version: '1.10.0', rejected: [] },
  },
  { name: 'same version as bundled: not newer', releases: [release('1.2.0')], expected: { source: 'bundled', version: '1.2.0', rejected: [{ version: '1.2.0', reason: 'not-newer' }] } },
  { name: 'older than bundled: never a downgrade', releases: [release('1.1.9')], expected: { source: 'bundled', version: '1.2.0', rejected: [{ version: '1.1.9', reason: 'not-newer' }] } },
  {
    name: 'revoked newest falls back to the previous approved release',
    releases: [release('1.2.1'), release('1.3.0', { revoked: true })],
    expected: { source: 'release', version: '1.2.1', rejected: [{ version: '1.3.0', reason: 'revoked' }] },
  },
  {
    name: 'every release revoked: bundled',
    releases: [release('1.2.1', { revoked: true }), release('1.3.0', { revoked: true })],
    expected: { source: 'bundled', version: '1.2.0', rejected: [{ version: '1.3.0', reason: 'revoked' }, { version: '1.2.1', reason: 'revoked' }] },
  },
  {
    name: 'body changed after hashing: hash mismatch',
    releases: [{ ...release('1.2.1'), body: body('1.2.1', b => { (b.rules as Body[])[0].weight = 9; }) }],
    expected: { source: 'bundled', version: '1.2.0', rejected: [{ version: '1.2.1', reason: 'hash-mismatch' }] },
  },
  {
    name: 'upper-case hash is refused (64 lowercase hex only)',
    releases: [release('1.2.1', { sha: s => s.toUpperCase() })],
    expected: { source: 'bundled', version: '1.2.0', rejected: [{ version: '1.2.1', reason: 'hash-mismatch' }] },
  },
  {
    name: 'body id is another file: id mismatch',
    releases: [release('1.2.1', { body: body('1.2.1', b => { b.id = 'other-rules'; }) })],
    expected: { source: 'bundled', version: '1.2.0', rejected: [{ version: '1.2.1', reason: 'id-mismatch' }] },
  },
  {
    name: 'body version differs from the release version',
    releases: [release('1.3.0', { body: body('1.2.9') })],
    expected: { source: 'bundled', version: '1.2.0', rejected: [{ version: '1.3.0', reason: 'version-mismatch' }] },
  },
  {
    name: 'versions that are not MAJOR.MINOR.PATCH are refused',
    releases: [release('1.3'), release('v1.3.0'), release('1.3.0-beta'), release('01.3.0')],
    expected: {
      source: 'bundled', version: '1.2.0', rejected: [
        { version: '1.3', reason: 'bad-version' }, { version: 'v1.3.0', reason: 'bad-version' },
        { version: '1.3.0-beta', reason: 'bad-version' }, { version: '01.3.0', reason: 'bad-version' },
      ],
    },
  },
  {
    name: 'schema-invalid release is refused, a lower valid one is used',
    releases: [release('1.2.1'), release('1.2.2', { body: body('1.2.2', b => { (b.rules as Body[])[0].weight = -1; }) })],
    expected: { source: 'release', version: '1.2.1', rejected: [{ version: '1.2.2', reason: 'schema-invalid' }] },
  },
  {
    name: 'changing a pinned field (patient text) is refused',
    releases: [release('1.2.1', { body: body('1.2.1', b => { (b.text as Body).patient = 'Stop your tablets.'; }) })],
    expected: { source: 'bundled', version: '1.2.0', rejected: [{ version: '1.2.1', reason: 'pinned-field-changed' }] },
  },
  {
    name: 'dropping a pinned key ($schema) is refused',
    releases: [release('1.2.1', { body: body('1.2.1', b => { delete b.$schema; }) })],
    expected: { source: 'bundled', version: '1.2.0', rejected: [{ version: '1.2.1', reason: 'pinned-field-changed' }] },
  },
  {
    name: '$comment may change',
    releases: [release('1.2.1', { body: body('1.2.1', b => { b.$comment = 'Release 1.2.1, approved.'; }) })],
    expected: { source: 'release', version: '1.2.1', rejected: [] },
  },
  {
    name: 'a release of another file is ignored',
    releases: [release('1.2.1', { contentId: 'zebra-rules' })],
    expected: { source: 'bundled', version: '1.2.0', rejected: [{ version: '1.2.1', reason: 'wrong-content' }] },
  },
  {
    name: 'a body that is not an object is malformed',
    releases: [release('1.2.1', { body: ['not', 'an', 'object'] }), release('1.2.2', { body: 'text' })],
    expected: { source: 'bundled', version: '1.2.0', rejected: [{ version: '1.2.2', reason: 'malformed' }, { version: '1.2.1', reason: 'malformed' }] },
  },
  {
    name: 'a body with an out-of-range integer is malformed',
    releases: [{ ...release('1.2.1'), body: body('1.2.1', b => { (b.rules as Body[])[0].weight = 9007199254740992; }) }],
    expected: { source: 'bundled', version: '1.2.0', rejected: [{ version: '1.2.1', reason: 'malformed' }] },
  },
  {
    name: 'bundled file without a usable version: nothing is newer',
    bundled: { ...BUNDLED, version: 'dev' },
    releases: [release('1.2.1')],
    expected: { source: 'bundled', version: 'dev', rejected: [{ version: '1.2.1', reason: 'not-newer' }] },
  },
];

export function buildApprovedContentVectors(): unknown {
  return {
    $comment: 'Generated by scripts/src/gen-approved-content-vectors.ts — do not edit. Run by scripts/src/approved-content.test.ts (web) and ios/AmiseMedFlowTests/ApprovedContentTests.swift (iOS). docs/APPROVED-CONTENT-CHANNEL.md.',
    canonical: CANONICAL_CASES.map(c => (c.error
      ? { name: c.name, json: c.json, error: true }
      : { name: c.name, json: c.json, canonical: c.canonical, sha256: sha256Hex(c.canonical!) })),
    schema: SCHEMA_CASES.map(c => ({ name: c.name, schema: c.schema, data: c.data, valid: c.valid, ajv: c.ajv !== false })),
    selection: {
      contentId: CONTENT_ID,
      mayChange: ['rules'],
      schema: SELECT_SCHEMA,
      bundled: BUNDLED,
      cases: SELECT_CASES.map(c => ({ name: c.name, ...(c.bundled ? { bundled: c.bundled } : {}), releases: c.releases, expected: c.expected })),
    },
  };
}

export function renderApprovedContentVectors(): string {
  return `${JSON.stringify(buildApprovedContentVectors(), null, 2)}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(join(REPO_ROOT, APPROVED_CONTENT_VECTORS_FILE), renderApprovedContentVectors());
  console.log(`Wrote ${APPROVED_CONTENT_VECTORS_FILE}`);
}
