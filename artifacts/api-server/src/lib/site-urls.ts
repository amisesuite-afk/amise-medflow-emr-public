/**
 * Site origins — one place that reads PORTAL_URL / DASHBOARD_URL / FRONTEND_URL.
 *
 * The public website (front-desk) can be served from several domains at once
 * (amisemedical.com, amisesuite.com, their www. forms and the vercel.app
 * address). PORTAL_URL and DASHBOARD_URL therefore accept a comma-separated
 * list:
 *
 *   PORTAL_URL=https://amisemedical.com,https://www.amisemedical.com,https://amisesuite.com
 *
 * - CORS allows every listed origin (`corsAllowedOrigins`).
 * - Links sent to patients (SMS, WhatsApp, email, portal invites) use the
 *   FIRST PORTAL_URL entry only (`patientSiteBaseUrl`), so list the primary
 *   domain first.
 *
 * A single value behaves exactly as before.
 */

/** Fallback when neither PORTAL_URL nor FRONTEND_URL is set. */
export const DEFAULT_PORTAL_ORIGIN = 'https://front-desk-amisesuite-afks-projects.vercel.app';

/**
 * Split a comma-separated env value into origins. Entries are trimmed, a
 * trailing slash is dropped and anything that is not an absolute http(s) URL
 * is ignored. A path on an entry (e.g. the old `…/patient` form) is reduced to
 * the origin, because a CORS Origin header never carries a path.
 */
export function parseOriginList(value: string | undefined | null): string[] {
  if (!value) return [];
  const out: string[] = [];
  for (const raw of value.split(',')) {
    const entry = raw.trim();
    if (!entry) continue;
    try {
      const url = new URL(entry);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
      if (!out.includes(url.origin)) out.push(url.origin);
    } catch {
      // Not a URL — ignore rather than let one typo break every origin.
    }
  }
  return out;
}

type Env = Record<string, string | undefined>;

/** Every origin the API accepts cross-origin requests from (exact matches). */
export function corsAllowedOrigins(env: Env = process.env, isDev = env.NODE_ENV !== 'production'): string[] {
  const list = [
    ...parseOriginList(env.PORTAL_URL),
    ...parseOriginList(env.DASHBOARD_URL),
    ...(isDev ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'] : []),
  ];
  return [...new Set(list)];
}

/**
 * Origin used to build links sent to patients: the first PORTAL_URL entry,
 * then the first FRONTEND_URL entry, then the vercel.app default. No
 * trailing slash — append paths such as `/patient/request`.
 */
export function patientSiteBaseUrl(env: Env = process.env): string {
  return parseOriginList(env.PORTAL_URL)[0]
    ?? parseOriginList(env.FRONTEND_URL)[0]
    ?? DEFAULT_PORTAL_ORIGIN;
}
