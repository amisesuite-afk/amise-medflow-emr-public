/**
 * content:publish — prepare the publication of a signed-off shared rule file through the
 * approved-content channel (docs/APPROVED-CONTENT-CHANNEL.md, Migration 98).
 *
 *   pnpm --filter @workspace/scripts run content:publish -- <content-id> --signoff-ref "<text>" \
 *       (--publisher-email <doctor/admin email> | --published-by <auth user uuid>) [--confirm]
 *
 * <content-id> is the registry id, which is also the file's `id` (diagnostic-reasoning-zebras for
 * clinical-content/rules/zebra-rules.json; supplement-catalogue).
 *
 * Reads that rules file from the repository (the merged, CI-checked file),
 * checks it, computes the SHA-256 of its canonical JSON and PRINTS the SQL insert for an admin to
 * review and run in the Supabase SQL editor. Nothing is sent anywhere by default.
 *
 * Only with --confirm AND SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment (and
 * --published-by, a doctor / admin user id) does it insert the row itself, through the REST API.
 * The key is never printed. Never run automatically (no CI job calls it).
 *
 * Refuses (exit 1, nothing printed but the reasons) when:
 *   - --signoff-ref is missing or shorter than 3 characters (what approved it: clinical_signoffs
 *     item ids / the export bundle / the SURGEON-DECISIONS section-I record);
 *   - no publisher is named (every release is attributable);
 *   - the channel is not enabled for the file (APPROVED_CONTENT_POLICY);
 *   - the file's `id` / `version` are wrong, it does not validate against its schema (ajv and the
 *     clients' own checker), or it cannot be canonicalised;
 *   - its registry entry is missing, its contentVersion differs from the file, or it records no
 *     clinical review (`lastReviewed` must be a date and `reviewer` named: set only by
 *     `signoff:apply` from recorded decisions). This script never writes the registry.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import {
  APPROVED_CONTENT_POLICY, canonicalJson, parseSemver, schemaProblems, sha256Hex, type JsonSchema,
} from '../../lib/triage-engine/src/approved-content';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

export interface PreparedRelease {
  contentId: string;
  version: string;
  sha256: string;
  body: Record<string, unknown>;
  schemaVersion: string;
  signoffRef: string;
}

/** The release row for a body (hash over its canonical JSON). Throws when it cannot be canonicalised. */
export function buildRelease(opts: {
  contentId: string; body: Record<string, unknown>; signoffRef: string; fileName?: string;
}): PreparedRelease {
  return {
    contentId: opts.contentId,
    version: String(opts.body.version),
    sha256: sha256Hex(canonicalJson(opts.body)),
    body: opts.body,
    schemaVersion: `clinical-content/schemas/${opts.fileName ?? opts.contentId}.schema.json`,
    signoffRef: opts.signoffRef.trim(),
  };
}

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

function dollarQuote(text: string): string {
  let tag = 'body';
  for (let i = 1; text.includes(`$${tag}$`); i++) tag = `body${i}`;
  return `$${tag}$${text}$${tag}$`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The INSERT an admin runs in the SQL editor. The publisher must be a doctor or admin in
 * user_profiles; otherwise no row is inserted (and RETURNING shows nothing).
 */
export function releaseInsertSql(r: PreparedRelease, who: { publishedBy?: string; publisherEmail?: string }): string {
  let from: string;
  if (who.publishedBy) {
    if (!UUID.test(who.publishedBy)) throw new Error('--published-by must be a user id (uuid)');
    from = `from public.user_profiles up where up.id = ${lit(who.publishedBy.toLowerCase())} and up.role in ('doctor', 'admin')`;
  } else if (who.publisherEmail) {
    from = `from public.user_profiles up join auth.users u on u.id = up.id
where lower(u.email) = lower(${lit(who.publisherEmail)}) and up.role in ('doctor', 'admin')`;
  } else {
    throw new Error('name the publisher: --publisher-email or --published-by');
  }
  return `-- Approved-content channel (Migration 98): publish ${r.contentId} ${r.version}
-- sha256 ${r.sha256} (canonical JSON of the body; every client re-checks it)
-- Sign-off: ${r.signoffRef.replace(/\n/g, ' ')}
-- Review, then run once in Supabase → SQL Editor. Expect one row back; no row = publisher is not a doctor/admin.
insert into public.clinical_content_releases
  (content_id, version, sha256, body, schema_version, published_by, signoff_ref)
select ${lit(r.contentId)}, ${lit(r.version)}, ${lit(r.sha256)},
       ${dollarQuote(JSON.stringify(r.body))}::jsonb,
       ${lit(r.schemaVersion)}, up.id, ${lit(r.signoffRef)}
${from}
returning id, content_id, version, sha256, published_at;
`;
}

interface RegistryEntry {
  id: string;
  contentVersion?: string;
  lastReviewed?: string;
  reviewer?: string;
  nextReviewDue?: string;
  versionStamp?: { file?: string; type?: string; key?: string };
}

export interface PublishCheck {
  problems: string[];
  warnings: string[];
  release: PreparedRelease | null;
}

/**
 * The rules file of a content id: the registry entry's json-key version-stamp file (the content id
 * is the registry id and the file's `id`: "diagnostic-reasoning-zebras" → zebra-rules.json), or a
 * file named after it. Returns the file name without ".json".
 */
export function rulesFileFor(contentId: string, root = REPO_ROOT): string | null {
  const registry = JSON.parse(readFileSync(join(root, 'clinical-content/registry.json'), 'utf8')) as { ruleSets: RegistryEntry[] };
  const stamp = registry.ruleSets.find(e => e.id === contentId)?.versionStamp?.file ?? '';
  const m = /^clinical-content\/rules\/([a-z0-9-]+)\.json$/.exec(stamp);
  if (m) return m[1];
  return existsSync(join(root, 'clinical-content/rules', `${contentId}.json`)) ? contentId : null;
}

/** Every reason the file may not be published (empty problems = publishable). */
export function checkPublishable(contentId: string, signoffRef: string | undefined, root = REPO_ROOT, today = new Date()): PublishCheck {
  const problems: string[] = [];
  const warnings: string[] = [];
  if (!/^[a-z0-9-]{1,80}$/.test(contentId)) return { problems: [`"${contentId}" is not a content id`], warnings, release: null };
  if (!signoffRef || signoffRef.trim().length < 3 || signoffRef.trim().length > 1000) {
    problems.push('--signoff-ref is required (3–1000 characters): the clinical_signoffs item ids / export bundle / SURGEON-DECISIONS section-I record that approved this version');
  }
  if (!Object.prototype.hasOwnProperty.call(APPROVED_CONTENT_POLICY, contentId)) {
    problems.push(`the approved-content channel is not enabled for "${contentId}" (content ids: ${Object.keys(APPROVED_CONTENT_POLICY).join(', ')}); a release would never be used`);
  }
  const fileName = rulesFileFor(contentId, root);
  if (!fileName) {
    problems.push(`no clinical-content/rules file has the content id "${contentId}" (use the registry id, e.g. diagnostic-reasoning-zebras for zebra-rules.json)`);
    return { problems, warnings, release: null };
  }
  let body: Record<string, unknown>;
  let schema: JsonSchema;
  try {
    body = JSON.parse(readFileSync(join(root, 'clinical-content/rules', `${fileName}.json`), 'utf8'));
    schema = JSON.parse(readFileSync(join(root, 'clinical-content/schemas', `${fileName}.schema.json`), 'utf8'));
  } catch (e) {
    problems.push(`cannot read clinical-content/rules/${fileName}.json or its schema: ${(e as Error).message}`);
    return { problems, warnings, release: null };
  }
  if (body.id !== contentId) problems.push(`clinical-content/rules/${fileName}.json has "id" ${JSON.stringify(body.id)}, not "${contentId}"`);
  const version = typeof body.version === 'string' ? body.version : '';
  if (!parseSemver(version)) problems.push(`the file's "version" ${JSON.stringify(body.version)} is not MAJOR.MINOR.PATCH`);
  const ours = schemaProblems(schema, body);
  if (ours.length) problems.push(`does not validate against its schema: ${ours.slice(0, 3).join('; ')}`);
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false, allowUnionTypes: true });
  if (!ajv.validate(schema as object, body)) problems.push(`ajv: ${ajv.errorsText(ajv.errors).slice(0, 300)}`);

  const registry = JSON.parse(readFileSync(join(root, 'clinical-content/registry.json'), 'utf8')) as { ruleSets: RegistryEntry[] };
  const entry = registry.ruleSets.find(e => e.id === contentId);
  if (!entry) {
    problems.push(`no registry entry has the id "${contentId}"`);
  } else {
    if (entry.contentVersion !== version) problems.push(`registry ${entry.id} contentVersion ${entry.contentVersion} ≠ file version ${version}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.lastReviewed ?? '') || !entry.reviewer || entry.reviewer === 'unknown') {
      problems.push(`registry ${entry.id} records no clinical review (lastReviewed "${entry.lastReviewed}", reviewer "${entry.reviewer}"). `
        + 'Record the sign-off decisions (Insights → Clinical sign-off) and run signoff:apply first; this script never sets lastReviewed.');
    }
    if (entry.nextReviewDue && /^\d{4}-\d{2}-\d{2}$/.test(entry.nextReviewDue) && entry.nextReviewDue < today.toISOString().slice(0, 10)) {
      warnings.push(`registry ${entry.id} review is overdue (nextReviewDue ${entry.nextReviewDue})`);
    }
  }

  let release: PreparedRelease | null = null;
  try {
    release = buildRelease({ contentId, body, signoffRef: signoffRef ?? '', fileName });
  } catch (e) {
    problems.push(`cannot be canonicalised: ${(e as Error).message}`);
  }
  return { problems, warnings, release: problems.length ? null : release };
}

function arg(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function insertViaRest(r: PreparedRelease, publishedBy: string): Promise<void> {
  const url = process.env.SUPABASE_URL!.replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  const who = await fetch(`${url}/rest/v1/user_profiles?id=eq.${encodeURIComponent(publishedBy)}&select=role`, { headers });
  const roles = (await who.json().catch(() => [])) as { role?: string }[];
  if (!who.ok || !roles.some(p => p.role === 'doctor' || p.role === 'admin')) {
    throw new Error(`publisher ${publishedBy} is not a doctor or admin in user_profiles (HTTP ${who.status})`);
  }
  const res = await fetch(`${url}/rest/v1/clinical_content_releases`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      content_id: r.contentId, version: r.version, sha256: r.sha256, body: r.body,
      schema_version: r.schemaVersion, published_by: publishedBy, signoff_ref: r.signoffRef,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`insert refused (HTTP ${res.status}): ${text.slice(0, 300)}`);
  const row = (JSON.parse(text) as { id: string; published_at: string }[])[0];
  console.log(`Published ${r.contentId} ${r.version} (id ${row?.id}, ${row?.published_at}, sha256 ${r.sha256}).`);
}

const VALUE_OPTIONS = new Set(['--signoff-ref', '--publisher-email', '--published-by']);

/** The first argument that is neither an option nor an option's value. */
export function positionalArg(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    if (VALUE_OPTIONS.has(argv[i])) { i++; continue; }
    if (!argv[i].startsWith('--')) return argv[i];
  }
  return undefined;
}

async function main(argv: string[]): Promise<number> {
  const contentId = positionalArg(argv);
  if (!contentId) {
    console.error('Usage: content:publish -- <content-id> --signoff-ref "<text>" (--publisher-email <email> | --published-by <uuid>) [--confirm]');
    return 1;
  }
  const signoffRef = arg(argv, '--signoff-ref');
  const publisherEmail = arg(argv, '--publisher-email');
  const publishedBy = arg(argv, '--published-by');
  const check = checkPublishable(contentId, signoffRef);
  if (!publisherEmail && !publishedBy) check.problems.push('name the publisher: --publisher-email <doctor/admin email> or --published-by <auth user uuid>');
  for (const w of check.warnings) console.warn(`warning: ${w}`);
  if (check.problems.length || !check.release) {
    console.error(`Not publishable — ${contentId}:`);
    for (const p of check.problems) console.error(`  ✗ ${p}`);
    return 1;
  }
  const release = check.release;
  if (argv.includes('--confirm')) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('--confirm needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment; nothing was sent.');
      return 1;
    }
    if (!publishedBy) {
      console.error('--confirm needs --published-by <doctor/admin user id>; nothing was sent.');
      return 1;
    }
    await insertViaRest(release, publishedBy);
    return 0;
  }
  process.stdout.write(releaseInsertSql(release, { publishedBy, publisherEmail }));
  console.error(`\nPrinted only (no --confirm): nothing was sent. ${contentId} ${release.version}, sha256 ${release.sha256}.`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then(code => process.exit(code), e => { console.error((e as Error).message); process.exit(1); });
}
