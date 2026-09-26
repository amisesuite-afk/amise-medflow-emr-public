/**
 * Approved-content channel: which copy of a shared rule file is in force — the bundled file or a
 * published, signed-off release from `public.clinical_content_releases` (Migration 98).
 * Design and safety properties: docs/APPROVED-CONTENT-CHANNEL.md. Swift twin:
 * ios/AmiseMedFlow/Services/ApprovedContent.swift; both run the shared vectors
 * ios/AmiseMedFlowTests/Resources/ApprovedContentVectors.json.
 *
 * A release replaces the bundled file only when ALL of these hold (checked in this order; the first
 * failure is the release's reason):
 *   1. `content_id` is the file asked for                                   (else 'wrong-content')
 *   2. it is not revoked (`revoked_at` empty)                                (else 'revoked')
 *   3. its `version` is MAJOR.MINOR.PATCH                                    (else 'bad-version')
 *   4. its version is strictly greater than the bundled file's              (else 'not-newer')
 *   5. its body is a JSON object that canonicalises                          (else 'malformed')
 *   6. SHA-256 of the canonical body equals the stored `sha256`              (else 'hash-mismatch')
 *   7. the body's `id` equals the content id                                 (else 'id-mismatch')
 *   8. the body's `version` equals the release's `version`                   (else 'version-mismatch')
 *   9. the body validates against the file's schema (the one in this build)  (else 'schema-invalid')
 *  10. every top-level key outside the file's `mayChange` list (plus `version` and `$comment`) is
 *      identical to the bundled file's: the channel may change the content it is enabled for, never
 *      the parts the code depends on or the patient-facing wording     (else 'pinned-field-changed')
 * Releases are tried from the highest version down; the first that passes wins (so revoking the
 * newest release falls back to the previous approved one, then to the bundled file). Otherwise the
 * bundled file is used. Nothing here throws.
 */

import { tryCanonicalJson } from './canonical-json';
import { schemaProblems, type JsonSchema } from './schema-check';
import { sha256Hex } from './sha256';

/** One row of public.clinical_content_releases (as PostgREST returns it). */
export interface ContentRelease {
  id?: string | null;
  content_id: string;
  version: string;
  sha256: string;
  body: unknown;
  schema_version?: string | null;
  published_at?: string | null;
  signoff_ref?: string | null;
  revoked_at?: string | null;
}

export type ReleaseRejectReason =
  | 'wrong-content' | 'revoked' | 'bad-version' | 'not-newer' | 'malformed' | 'hash-mismatch'
  | 'id-mismatch' | 'version-mismatch' | 'schema-invalid' | 'pinned-field-changed';

export interface RejectedRelease {
  version: string;
  reason: ReleaseRejectReason;
  /** Key path or check that failed (never a content value). */
  detail: string | null;
}

export interface ActiveRelease {
  id: string | null;
  version: string;
  sha256: string;
  publishedAt: string | null;
  signoffRef: string | null;
}

export interface ApprovedContentSelection<T = unknown> {
  contentId: string;
  source: 'bundled' | 'release';
  /** The content in force. */
  body: T;
  /** Version of the content in force. */
  version: string;
  bundledVersion: string;
  release: ActiveRelease | null;
  /** Releases tried before the one in force (or all of them, when the bundled file is in force). */
  rejected: RejectedRelease[];
}

export interface SelectInput<T> {
  /** The registry id, which is also the bundled file's `id` (not always its file name). */
  contentId: string;
  /** The bundled file (parsed). Its `version` is the floor. */
  bundled: T;
  /** The file's JSON Schema from this build (clinical-content/schemas/<name>.schema.json). */
  schema: JsonSchema;
  /** Top-level keys a release may change (see APPROVED_CONTENT_POLICY). */
  mayChange: readonly string[];
  releases: readonly ContentRelease[];
}

/** Keys every release may differ in, whatever the file. */
export const ALWAYS_MAY_CHANGE: readonly string[] = ['$comment', 'version'];

/**
 * The files the channel is enabled for, by content id (= the registry id = the file's `id`), and
 * the top-level keys a release of each may change. Everything else must stay identical to the
 * bundled file (rule 10). A file not listed here is never overridden. Twin: `ApprovedContent.policy`
 * (Swift); scripts/src/approved-content.test.ts fails when the two differ.
 *   diagnostic-reasoning-zebras (clinical-content/rules/zebra-rules.json): the rules
 *     (clinician-facing suggestions; the matcher code is unchanged).
 *   supplement-catalogue (clinical-content/rules/supplement-catalogue.json): the items
 *     (clinician-facing). The shared wording — including the surgeon-approved patient paragraph
 *     pinned by lint:patient-instructions — and the prompt ids / trigger words the code looks up
 *     stay bundled: changing them needs a build, so the CI lints run.
 */
export const APPROVED_CONTENT_POLICY: Readonly<Record<string, { mayChange: readonly string[] }>> = {
  'diagnostic-reasoning-zebras': { mayChange: ['rules'] },
  'supplement-catalogue': { mayChange: ['items'] },
};

export function channelEnabled(contentId: string): boolean {
  return Object.prototype.hasOwnProperty.call(APPROVED_CONTENT_POLICY, contentId);
}

const SEMVER = /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

/** [major, minor, patch], or null unless the text is exactly MAJOR.MINOR.PATCH (no pre-release). */
export function parseSemver(v: unknown): [number, number, number] | null {
  if (typeof v !== 'string') return null;
  const m = SEMVER.exec(v);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Negative, zero or positive as a < b, a = b, a > b (both must parse). */
export function compareSemver(a: [number, number, number], b: [number, number, number]): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** SHA-256 of the canonical JSON of a value (null when it cannot be canonicalised). */
export function contentSha256(value: unknown): string | null {
  const text = tryCanonicalJson(value);
  return text === null ? null : sha256Hex(text);
}

function checkRelease<T>(
  input: SelectInput<T>, r: ContentRelease, bundledSemver: [number, number, number] | null,
): { reason: ReleaseRejectReason; detail: string | null } | null {
  if (r.content_id !== input.contentId) return { reason: 'wrong-content', detail: null };
  if (typeof r.revoked_at === 'string' && r.revoked_at.length > 0) return { reason: 'revoked', detail: null };
  const v = parseSemver(r.version);
  if (!v) return { reason: 'bad-version', detail: null };
  if (!bundledSemver || compareSemver(v, bundledSemver) <= 0) return { reason: 'not-newer', detail: null };
  if (!isObject(r.body)) return { reason: 'malformed', detail: 'body is not an object' };
  const canonical = tryCanonicalJson(r.body);
  if (canonical === null) return { reason: 'malformed', detail: 'body cannot be canonicalised' };
  if (typeof r.sha256 !== 'string' || !SHA256_HEX.test(r.sha256) || sha256Hex(canonical) !== r.sha256) {
    return { reason: 'hash-mismatch', detail: null };
  }
  if (r.body.id !== input.contentId) return { reason: 'id-mismatch', detail: null };
  if (r.body.version !== r.version) return { reason: 'version-mismatch', detail: null };
  const problems = schemaProblems(input.schema, r.body);
  if (problems.length > 0) return { reason: 'schema-invalid', detail: problems[0] };
  const bundled = input.bundled as unknown;
  const bundledObj = isObject(bundled) ? bundled : {};
  const free = new Set([...ALWAYS_MAY_CHANGE, ...input.mayChange]);
  const keys = [...new Set([...Object.keys(bundledObj), ...Object.keys(r.body)])].sort();
  for (const k of keys) {
    if (free.has(k)) continue;
    const inB = Object.prototype.hasOwnProperty.call(bundledObj, k);
    const inR = Object.prototype.hasOwnProperty.call(r.body, k);
    if (inB !== inR) return { reason: 'pinned-field-changed', detail: `/${k}` };
    if (inB && tryCanonicalJson(bundledObj[k]) !== tryCanonicalJson(r.body[k])) {
      return { reason: 'pinned-field-changed', detail: `/${k}` };
    }
  }
  return null;
}

/** Which copy is in force (see the header for the rules). */
export function selectApprovedContent<T>(input: SelectInput<T>): ApprovedContentSelection<T> {
  const bundledVersion = isObject(input.bundled) && typeof input.bundled.version === 'string'
    ? input.bundled.version : '';
  const bundledSemver = parseSemver(bundledVersion);
  // Highest version first; unparsable versions last, in their given order.
  const ordered = input.releases
    .map((r, i) => ({ r, i, v: parseSemver(r.version) }))
    .sort((a, b) => {
      if (a.v && b.v) return compareSemver(b.v, a.v) || a.i - b.i;
      if (a.v) return -1;
      if (b.v) return 1;
      return a.i - b.i;
    });
  const rejected: RejectedRelease[] = [];
  for (const { r } of ordered) {
    const failure = checkRelease(input, r, bundledSemver);
    if (failure) {
      rejected.push({ version: typeof r.version === 'string' ? r.version : '', ...failure });
      continue;
    }
    return {
      contentId: input.contentId,
      source: 'release',
      body: r.body as T,
      version: r.version,
      bundledVersion,
      release: {
        id: r.id ?? null,
        version: r.version,
        sha256: r.sha256,
        publishedAt: r.published_at ?? null,
        signoffRef: r.signoff_ref ?? null,
      },
      rejected,
    };
  }
  return {
    contentId: input.contentId,
    source: 'bundled',
    body: input.bundled,
    version: bundledVersion,
    bundledVersion,
    release: null,
    rejected,
  };
}

/**
 * selectApprovedContent with the file's channel policy. A file the channel is not enabled for
 * always gets its bundled copy (no release is even looked at).
 */
export function selectForChannel<T>(
  contentId: string, bundled: T, schema: JsonSchema, releases: readonly ContentRelease[],
): ApprovedContentSelection<T> {
  const policy = APPROVED_CONTENT_POLICY[contentId];
  return selectApprovedContent({
    contentId, bundled, schema, mayChange: policy?.mayChange ?? [], releases: policy ? releases : [],
  });
}
