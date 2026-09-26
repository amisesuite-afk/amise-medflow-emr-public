/**
 * PHI scrubbing for Sentry events and breadcrumbs (compliance G-6 / S-6).
 *
 * Mirrors the iOS reference, `ios/AmiseMedFlow/Services/CrashReporting.swift`:
 * no default PII, no request data, no user, no network/console breadcrumbs
 * with identifiers, and a `beforeSend` that strips anything that may hold PHI.
 *
 * This is a copy of `artifacts/api-server/src/lib/sentry-scrub.ts` (separate
 * deployments, no shared browser+node package for it). Keep the two in step;
 * each has a unit test that feeds it a PHI-laden fake event.
 *
 * Deliberately dependency-free (structural types only) so it can be unit
 * tested without initialising Sentry.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecord = Record<string, any>;

/** Sentry contexts that describe the runtime, never the patient. Everything else is dropped. */
const SAFE_CONTEXTS = ['os', 'browser', 'device', 'runtime', 'culture', 'app', 'cloud_resource', 'react'] as const;

/** `extra` keys that carry code structure only (React component stack). Everything else is dropped. */
const SAFE_EXTRA_KEYS = ['componentStack'] as const;

/** Breadcrumb categories dropped outright: console args and DOM selectors can hold patient data. */
const DROP_BREADCRUMB_CATEGORY = /^(console|ui\.|log$)/;

const PLACEHOLDER_BASE = 'http://scrub.invalid';

/**
 * True when a URL path segment looks like an identifier or secret rather than
 * a route word: UUIDs, numbers, invoice numbers, tokens, emails, phone numbers.
 */
function isIdentifierSegment(seg: string): boolean {
  if (!seg) return false;
  let decoded = seg;
  try { decoded = decodeURIComponent(seg); } catch { /* keep raw */ }
  if (/[@%+~=\s]/.test(seg) || /[@+\s]/.test(decoded)) return true;
  if (/^\d+$/.test(decoded)) return true;
  if (/^[0-9a-f-]{8,}$/i.test(decoded) && /\d/.test(decoded)) return true;
  if ((decoded.match(/\d/g) ?? []).length >= 4) return true;
  if (decoded.length >= 20) return true;
  if (decoded.length >= 12 && /\d/.test(decoded) && /[a-z]/i.test(decoded)) return true;
  return false;
}

/** Path only (ids replaced by `:id`), no query string or fragment. */
export function scrubPath(path: string): string {
  return path
    .split('/')
    .map(seg => (isIdentifierSegment(seg) ? ':id' : seg))
    .join('/');
}

/** A transaction name such as `GET /api/patients/:id` — keep the method, scrub the path. */
export function scrubTransaction(name: string): string {
  const m = /^([A-Z]+ )?(.*)$/s.exec(name);
  const method = m?.[1] ?? '';
  const rest = m?.[2] ?? name;
  return method + (rest.includes('://') ? scrubUrl(rest) : scrubText(scrubPath(rest.split(/[?#]/)[0])));
}

/**
 * Keep the origin and route shape of a URL; drop the query string and
 * fragment (tokens, search terms, PostgREST filters) and replace id-like path
 * segments with `:id`.
 */
export function scrubUrl(raw: string): string {
  if (typeof raw !== 'string' || !raw) return raw;
  try {
    const absolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    const u = new URL(raw, PLACEHOLDER_BASE);
    const path = scrubPath(u.pathname);
    return absolute ? `${u.protocol}//${u.host}${path}` : path;
  } catch {
    return scrubPath(raw.split(/[?#]/)[0]);
  }
}

/**
 * Redact identifiers from free text (exception messages, log messages):
 * URLs, JWTs and bearer tokens, emails, UUIDs, phone / record numbers and
 * dates, Postgres "Key (col)=(value)" details and long opaque tokens.
 * Free-text names cannot be detected reliably — which is why request bodies,
 * `extra` and console breadcrumbs are dropped rather than scrubbed.
 */
export function scrubText(text: string): string {
  if (typeof text !== 'string' || !text) return text;
  return text
    .replace(/\b(?:https?|wss?):\/\/[^\s"'<>)\]]+/gi, m => scrubUrl(m))
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
    .replace(/\bBearer\s+[\w.~+/-]+=*/gi, 'Bearer [token]')
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/\bKey \(([^)]*)\)=\([^)]*\)/g, 'Key ($1)=([redacted])')
    .replace(/\+?\d[\d\s().\/-]{5,}\d/g, '[number]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[token]');
}

function pick(obj: AnyRecord | undefined, keys: readonly string[]): AnyRecord | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const out: AnyRecord = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return Object.keys(out).length ? out : undefined;
}

/**
 * Breadcrumb scrubber (`beforeBreadcrumb`). Returns null to drop the
 * breadcrumb. Console and DOM breadcrumbs are dropped; network and navigation
 * breadcrumbs keep only method, status and a scrubbed URL.
 */
export function scrubBreadcrumb<B extends AnyRecord>(crumb: B | null | undefined): B | null {
  if (!crumb) return null;
  const category = String(crumb.category ?? '');
  if (DROP_BREADCRUMB_CATEGORY.test(category)) return null;

  const out: AnyRecord = { ...crumb };
  const data: AnyRecord | undefined = crumb.data && typeof crumb.data === 'object' ? crumb.data : undefined;

  if (category === 'fetch' || category === 'xhr' || category === 'http' || crumb.type === 'http') {
    out.data = {
      ...(data?.method ? { method: String(data.method) } : {}),
      ...(typeof data?.status_code === 'number' ? { status_code: data.status_code } : {}),
      ...(typeof data?.url === 'string' ? { url: scrubUrl(data.url) } : {}),
    };
    delete out.message;
  } else if (category === 'navigation') {
    out.data = {
      ...(typeof data?.from === 'string' ? { from: scrubUrl(data.from) } : {}),
      ...(typeof data?.to === 'string' ? { to: scrubUrl(data.to) } : {}),
    };
    delete out.message;
  } else {
    delete out.data;
    if (typeof out.message === 'string') out.message = scrubText(out.message);
  }
  return out as B;
}

function scrubStacktrace(st: AnyRecord | undefined): void {
  if (!st || !Array.isArray(st.frames)) return;
  for (const f of st.frames as AnyRecord[]) {
    delete f.vars; // local variables (includeLocalVariables) may hold patient objects
    if (typeof f.abs_path === 'string') f.abs_path = f.abs_path.split(/[?#]/)[0];
    if (typeof f.filename === 'string') f.filename = f.filename.split(/[?#]/)[0];
  }
}

/**
 * Event scrubber (`beforeSend`). Strips `request` (URL, query string, headers,
 * cookies, body), `user` (email, IP, username, id), `extra` (except the React
 * component stack), `server_name` and every context that is not a runtime
 * description; redacts identifiers from messages, exception values, tags and
 * breadcrumbs. Never throws — on an unexpected shape it drops the event
 * rather than risk sending PHI.
 */
export function scrubEvent<E extends AnyRecord>(event: E): E | null {
  try {
    const e: AnyRecord = event;

    delete e.request;
    delete e.user;
    delete e.server_name;

    const extra = pick(e.extra, SAFE_EXTRA_KEYS);
    if (extra) for (const k of Object.keys(extra)) extra[k] = typeof extra[k] === 'string' ? scrubText(extra[k]) : undefined;
    if (extra) e.extra = extra; else delete e.extra;

    const contexts = pick(e.contexts, SAFE_CONTEXTS) ?? {};
    const trace = e.contexts?.trace;
    if (trace && typeof trace === 'object') {
      contexts.trace = pick(trace, ['trace_id', 'span_id', 'parent_span_id']);
    }
    if (Object.keys(contexts).length) e.contexts = contexts; else delete e.contexts;

    if (e.tags && typeof e.tags === 'object') {
      for (const [k, v] of Object.entries(e.tags as AnyRecord)) {
        e.tags[k] = typeof v === 'string' ? scrubText(v) : v;
      }
    }

    if (typeof e.message === 'string') e.message = scrubText(e.message);
    if (e.logentry && typeof e.logentry === 'object') {
      e.logentry = { message: scrubText(String(e.logentry.message ?? '')) };
    }
    if (typeof e.transaction === 'string') e.transaction = scrubTransaction(e.transaction);

    for (const ex of (e.exception?.values ?? []) as AnyRecord[]) {
      if (typeof ex.value === 'string') ex.value = scrubText(ex.value);
      scrubStacktrace(ex.stacktrace);
      if (ex.mechanism?.data) delete ex.mechanism.data;
    }
    for (const th of (e.threads?.values ?? []) as AnyRecord[]) scrubStacktrace(th.stacktrace);

    if (Array.isArray(e.breadcrumbs)) {
      e.breadcrumbs = (e.breadcrumbs as AnyRecord[])
        .map(b => scrubBreadcrumb(b))
        .filter((b): b is AnyRecord => b !== null);
    }

    return e as E;
  } catch {
    return null;
  }
}
