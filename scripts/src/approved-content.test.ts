/**
 * Approved-content channel (lib/triage-engine/src/approved-content, docs/APPROVED-CONTENT-CHANNEL.md):
 *   - the shared vectors file is up to date and the web implementation gives every expected result
 *     (iOS runs the same file: ios/AmiseMedFlowTests/ApprovedContentTests.swift);
 *   - SHA-256 agrees with node:crypto; canonical JSON is a fixed point of JSON.parse;
 *   - the schema subset checker agrees with ajv (what lint:shared-content uses) on the vectors and on
 *     every repository rule file, valid and mutated;
 *   - a release built from each channel-enabled repository file is selected, and one that changes a
 *     pinned field is not;
 *   - the Swift twin lists the same channel policy and schema keywords (read from source).
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import {
  APPROVED_CONTENT_POLICY, SCHEMA_CHECK_KEYWORDS, canonicalJson, compareSemver, contentSha256, parseSemver,
  schemaProblems, selectApprovedContent, selectForChannel, sha256Hex, type ContentRelease, type JsonSchema,
} from '../../lib/triage-engine/src/approved-content';
import { REPO_ROOT } from './clinval/load';
import { APPROVED_CONTENT_VECTORS_FILE, renderApprovedContentVectors } from './gen-approved-content-vectors';

const read = (p: string) => readFileSync(join(REPO_ROOT, p), 'utf8');

interface Vectors {
  canonical: { name: string; json: string; canonical?: string; sha256?: string; error?: boolean }[];
  schema: { name: string; schema: JsonSchema; data: unknown; valid: boolean; ajv: boolean }[];
  selection: {
    contentId: string; mayChange: string[]; schema: JsonSchema; bundled: unknown;
    cases: { name: string; bundled?: unknown; releases: ContentRelease[]; expected: { source: string; version: string; rejected: { version: string; reason: string }[] } }[];
  };
}

const vectors = JSON.parse(read(APPROVED_CONTENT_VECTORS_FILE)) as Vectors;

// One compiled validator per schema (compiling is the slow part), same options as lint:shared-content.
const compiled = new Map<string, (data: unknown) => boolean>();
function ajvValid(schema: JsonSchema, data: unknown): boolean {
  const key = JSON.stringify(schema);
  let validate = compiled.get(key);
  if (!validate) {
    const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
    const fn = ajv.compile(schema as object);
    validate = (d: unknown) => fn(d) as boolean;
    compiled.set(key, validate);
  }
  return validate(data);
}

describe('shared vectors', () => {
  it('the committed vectors file matches the generator', () => {
    expect(read(APPROVED_CONTENT_VECTORS_FILE), 'run: pnpm --filter @workspace/scripts run gen:approved-content-vectors')
      .toBe(renderApprovedContentVectors());
  });

  it('canonical JSON and SHA-256', () => {
    expect(vectors.canonical.length).toBeGreaterThan(6);
    for (const c of vectors.canonical) {
      const parsed = JSON.parse(c.json);
      if (c.error) {
        expect(() => canonicalJson(parsed), c.name).toThrow();
        continue;
      }
      const text = canonicalJson(parsed);
      expect(text, c.name).toBe(c.canonical);
      expect(sha256Hex(text), c.name).toBe(c.sha256);
      expect(createHash('sha256').update(text, 'utf8').digest('hex'), c.name).toBe(c.sha256);
      // Canonical text is JSON and a fixed point.
      expect(canonicalJson(JSON.parse(text)), c.name).toBe(text);
    }
  });

  it('schema checker', () => {
    expect(vectors.schema.length).toBeGreaterThan(20);
    for (const c of vectors.schema) {
      expect(schemaProblems(c.schema, c.data).length === 0, c.name).toBe(c.valid);
      if (c.ajv) expect(ajvValid(c.schema, c.data), `${c.name} (ajv)`).toBe(c.valid);
    }
  });

  it('selection', () => {
    const s = vectors.selection;
    expect(s.cases.length).toBeGreaterThan(15);
    for (const c of s.cases) {
      const result = selectApprovedContent({
        contentId: s.contentId, bundled: c.bundled ?? s.bundled, schema: s.schema, mayChange: s.mayChange, releases: c.releases,
      });
      expect({
        source: result.source,
        version: result.version,
        rejected: result.rejected.map(r => ({ version: r.version, reason: r.reason })),
      }, c.name).toEqual(c.expected);
      if (result.source === 'release') expect(result.body, c.name).toEqual(c.releases.find(r => r.version === result.version)?.body);
      else expect(result.body, c.name).toEqual(c.bundled ?? s.bundled);
    }
  });
});

describe('SHA-256', () => {
  it('matches node:crypto on edge lengths and non-ASCII text', () => {
    const texts = ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(119), 'é😀 ', 'x'.repeat(100_000)];
    for (const t of texts) expect(sha256Hex(t)).toBe(createHash('sha256').update(t, 'utf8').digest('hex'));
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('semver', () => {
  it('parses MAJOR.MINOR.PATCH only and compares numerically', () => {
    expect(parseSemver('1.10.0')).toEqual([1, 10, 0]);
    for (const bad of ['1.0', '1.0.0-rc.1', 'v1.0.0', '01.0.0', '1.0.0 ', '', null, 1]) expect(parseSemver(bad)).toBeNull();
    expect(compareSemver(parseSemver('1.10.0')!, parseSemver('1.9.9')!)).toBeGreaterThan(0);
  });
});

describe('schema checker against ajv on the repository rule files', () => {
  const names = readdirSync(join(REPO_ROOT, 'clinical-content/rules')).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));

  it('every rule file is valid against its schema, as ajv says', { timeout: 60_000 }, () => {
    expect(names.length).toBeGreaterThan(5);
    for (const n of names) {
      const schema = JSON.parse(read(`clinical-content/schemas/${n}.schema.json`)) as JsonSchema;
      const data = JSON.parse(read(`clinical-content/rules/${n}.json`));
      expect(schemaProblems(schema, data), n).toEqual([]);
      expect(ajvValid(schema, data), n).toBe(true);
    }
  });

  it('agrees with ajv on mutated copies (missing, extra, retyped fields at every depth)', () => {
    let checked = 0;
    for (const n of names) {
      const schema = JSON.parse(read(`clinical-content/schemas/${n}.schema.json`)) as JsonSchema;
      const original = JSON.parse(read(`clinical-content/rules/${n}.json`));
      // Walk the first path of objects / arrays and mutate each level.
      const paths: (string | number)[][] = [];
      let node: unknown = original;
      const path: (string | number)[] = [];
      for (let depth = 0; depth < 6 && node !== null && typeof node === 'object'; depth++) {
        paths.push([...path]);
        if (Array.isArray(node)) { if (!node.length) break; path.push(0); node = node[0]; }
        else { const k = Object.keys(node as object).find(key => typeof (node as Record<string, unknown>)[key] === 'object') ?? Object.keys(node as object)[0]; if (k === undefined) break; path.push(k); node = (node as Record<string, unknown>)[k]; }
      }
      for (const p of paths) {
        for (const mutation of ['drop-first-key', 'add-key', 'retype', 'empty'] as const) {
          const copy = JSON.parse(JSON.stringify(original));
          let target: Record<string, unknown> | unknown[] = copy;
          for (const step of p) target = (target as Record<string | number, unknown>)[step] as Record<string, unknown>;
          if (Array.isArray(target)) {
            if (mutation === 'retype') target[0] = 42; else if (mutation === 'empty') target.length = 0; else if (mutation === 'add-key') target.push('extra'); else target.shift();
          } else {
            const keys = Object.keys(target);
            if (mutation === 'drop-first-key' && keys.length) delete target[keys[0]];
            if (mutation === 'add-key') target.zzUnexpected = 1;
            if (mutation === 'retype' && keys.length) target[keys[keys.length - 1]] = { unexpected: true };
            if (mutation === 'empty') for (const k of keys) delete target[k];
          }
          const ours = schemaProblems(schema, copy).length === 0;
          expect(ours, `${n} ${p.join('/')} ${mutation}`).toBe(ajvValid(schema, copy));
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(50);
  }, 60_000);
});

/** The rules file whose `id` is the content id (file name without ".json"). */
function fileFor(contentId: string): string {
  const name = readdirSync(join(REPO_ROOT, 'clinical-content/rules'))
    .find(f => f.endsWith('.json') && JSON.parse(read(`clinical-content/rules/${f}`)).id === contentId);
  if (!name) throw new Error(`no rules file has id ${contentId}`);
  return name.replace(/\.json$/, '');
}

describe('channel-enabled repository files', () => {
  it('every policy key is the id of a shared rules file (the registry id)', () => {
    expect(fileFor('diagnostic-reasoning-zebras')).toBe('zebra-rules');
    for (const id of Object.keys(APPROVED_CONTENT_POLICY)) expect(() => fileFor(id)).not.toThrow();
  });

  for (const contentId of Object.keys(APPROVED_CONTENT_POLICY)) {
    const file = fileFor(contentId);
    const bundled = JSON.parse(read(`clinical-content/rules/${file}.json`)) as Record<string, unknown>;
    const schema = JSON.parse(read(`clinical-content/schemas/${file}.schema.json`)) as JsonSchema;
    const bump = (v: string) => { const [a, b, c] = parseSemver(v)!; return `${a}.${b}.${c + 1}`; };

    it(`${contentId}: a patch release of the unchanged content is selected`, () => {
      const body = { ...bundled, version: bump(bundled.version as string) };
      const r: ContentRelease = { content_id: contentId, version: body.version, sha256: contentSha256(body)!, body, revoked_at: null };
      const s = selectForChannel(contentId, bundled, schema, [r]);
      expect(s.source).toBe('release');
      expect(s.release?.sha256).toBe(createHash('sha256').update(canonicalJson(body), 'utf8').digest('hex'));
    });

    it(`${contentId}: a release that changes a pinned top-level key is refused`, () => {
      const body = { ...bundled, version: bump(bundled.version as string), $schema: '../schemas/other.schema.json' };
      const r: ContentRelease = { content_id: contentId, version: body.version, sha256: contentSha256(body)!, body, revoked_at: null };
      const s = selectForChannel(contentId, bundled, schema, [r]);
      expect(s.source).toBe('bundled');
      expect(s.rejected[0]).toMatchObject({ reason: 'pinned-field-changed', detail: '/$schema' });
    });

    it(`${contentId}: a release that edits the enabled key is selected`, () => {
      const key = APPROVED_CONTENT_POLICY[contentId].mayChange[0];
      const list = bundled[key] as unknown[];
      const body = { ...bundled, version: bump(bundled.version as string), [key]: list.slice(0, list.length - 1) };
      const r: ContentRelease = { content_id: contentId, version: body.version, sha256: contentSha256(body)!, body, revoked_at: null };
      expect(selectForChannel(contentId, bundled, schema, [r]).source).toBe('release');
    });
  }

  it('supplement-catalogue: the patient paragraph cannot change through the channel', () => {
    const bundled = JSON.parse(read('clinical-content/rules/supplement-catalogue.json')) as Record<string, any>;
    const schema = JSON.parse(read('clinical-content/schemas/supplement-catalogue.schema.json')) as JsonSchema;
    const body = JSON.parse(JSON.stringify(bundled));
    body.version = '9.0.0';
    body.text.herbalPreOpPatientText = `${body.text.herbalPreOpPatientText} Changed.`;
    const r: ContentRelease = { content_id: 'supplement-catalogue', version: '9.0.0', sha256: contentSha256(body)!, body };
    const s = selectForChannel('supplement-catalogue', bundled, schema, [r]);
    expect(s.source).toBe('bundled');
    expect(s.rejected[0]).toMatchObject({ reason: 'pinned-field-changed', detail: '/text' });
  });

  it('a file the channel is not enabled for always stays bundled', () => {
    const bundled = JSON.parse(read('clinical-content/rules/exam-signs.json')) as Record<string, unknown>;
    const schema = JSON.parse(read('clinical-content/schemas/exam-signs.schema.json')) as JsonSchema;
    const body = { ...bundled, version: '99.0.0' };
    const r: ContentRelease = { content_id: 'exam-signs', version: '99.0.0', sha256: contentSha256(body)!, body };
    expect(selectForChannel('exam-signs', bundled, schema, [r]).source).toBe('bundled');
  });
});

describe('Swift twin (read from source)', () => {
  const swift = read('ios/AmiseMedFlow/Services/ApprovedContent.swift');

  it('lists the same channel policy', () => {
    const block = /static let policy: \[String: \[String\]\] = \[([\s\S]*?)\]\n/.exec(swift)?.[1] ?? '';
    const entries = [...block.matchAll(/"([a-z0-9-]+)":\s*\[([^\]]*)\]/g)]
      .map(m => [m[1], [...m[2].matchAll(/"([^"]+)"/g)].map(x => x[1])] as const);
    expect(Object.fromEntries(entries)).toEqual(
      Object.fromEntries(Object.entries(APPROVED_CONTENT_POLICY).map(([k, v]) => [k, [...v.mayChange]])),
    );
  });

  it('understands the same schema keywords', () => {
    const block = /static let supportedKeywords: Set<String> = \[([\s\S]*?)\]/.exec(swift)?.[1] ?? '';
    const keywords = [...block.matchAll(/"([^"]+)"/g)].map(m => m[1]).sort();
    expect(keywords).toEqual([...SCHEMA_CHECK_KEYWORDS]);
  });

  it('checks the release in the same order with the same reason codes', () => {
    const reasons = ['wrong-content', 'revoked', 'bad-version', 'not-newer', 'malformed', 'hash-mismatch', 'id-mismatch',
      'version-mismatch', 'schema-invalid', 'pinned-field-changed'];
    const positions = reasons.map(r => swift.indexOf(`.reject(.${r.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}`));
    expect(positions.every(p => p > 0), JSON.stringify(positions)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    for (const r of reasons) expect(swift).toContain(`"${r}"`);
  });
});
