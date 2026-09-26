/**
 * Lab feed authentication: one secret per laboratory, sent as a header. Same pattern as the
 * machine token (lib/supabase.ts requireStaffAuth / STAFF_MACHINE_TOKEN): a server-held shared
 * secret compared in constant time, never logged, never accepted in the URL.
 *
 *   LAB_FEED_SECRETS = "slulab:<secret>,otherlab:<secret>"   (":" or "=" between id and secret)
 *   Headers:  x-lab-id: slulab
 *             x-lab-feed-key: <secret>
 *
 * A lab id is 1–40 characters [a-z0-9_-]; a secret must be at least 32 characters (shorter ones
 * are ignored, with a warning at startup of the first request). Unset or empty → the feed is
 * switched off (503), so a deployment without the variable accepts nothing.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { logger } from '../logger.js';

export const LAB_ID_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
export const MIN_SECRET_LENGTH = 32;

let warned = false;

export function labFeedSecrets(env: NodeJS.ProcessEnv = process.env): Map<string, string> {
  const out = new Map<string, string>();
  const raw = env.LAB_FEED_SECRETS ?? '';
  for (const part of raw.split(',')) {
    const entry = part.trim();
    if (!entry) continue;
    const i = entry.search(/[:=]/);
    const id = i > 0 ? entry.slice(0, i).trim().toLowerCase() : '';
    const secret = i > 0 ? entry.slice(i + 1).trim() : '';
    if (!LAB_ID_RE.test(id) || secret.length < MIN_SECRET_LENGTH) {
      if (!warned) {
        warned = true;
        logger.warn('[lab-feed] LAB_FEED_SECRETS has an entry with an invalid lab id or a secret shorter than 32 characters — ignored');
      }
      continue;
    }
    out.set(id, secret);
  }
  return out;
}

function digest(s: string): Buffer {
  return createHash('sha256').update(s, 'utf8').digest();
}

/** Constant-time comparison of equal-length digests (no length leak). */
function sameSecret(provided: string, expected: string): boolean {
  return timingSafeEqual(digest(provided), digest(expected));
}

export type LabAuthResult =
  | { ok: true; labId: string }
  | { ok: false; status: 401 | 503; error: string };

const DUMMY = 'x'.repeat(MIN_SECRET_LENGTH);

export function authenticateLab(
  headers: Record<string, string | string[] | undefined>,
  env: NodeJS.ProcessEnv = process.env,
): LabAuthResult {
  const secrets = labFeedSecrets(env);
  if (secrets.size === 0) return { ok: false, status: 503, error: 'The laboratory feed is not configured' };
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const labId = one(headers['x-lab-id']).trim().toLowerCase();
  const key = one(headers['x-lab-feed-key']);
  const expected = secrets.get(labId);
  // Always compare (against a dummy when the lab id is unknown) so timing does not reveal ids.
  const match = sameSecret(key, expected ?? DUMMY) && expected !== undefined && key.length > 0;
  if (!match) return { ok: false, status: 401, error: 'Unauthorised' };
  return { ok: true, labId };
}

/** Test-only. */
export function _resetLabFeedWarning(): void {
  warned = false;
}
