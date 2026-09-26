/**
 * The website's canonical public origin.
 *
 * The site can be reached on several addresses at once — amisemedical.com,
 * amisesuite.com, their www. forms and the vercel.app deployment address
 * (docs/DOMAINS.md). Search engines should see ONE address for each page, so
 * the sitemap, robots.txt, JSON-LD, `metadataBase` and every page's
 * `<link rel="canonical">` are built from this origin, whichever domain
 * actually served the request.
 *
 * Set NEXT_PUBLIC_SITE_URL on the front-desk Vercel project (e.g.
 * `https://amisemedical.com`). It is inlined at build time, so a change needs
 * a redeploy. Unset or invalid → https://amisemedical.com.
 */

export const DEFAULT_SITE_URL = 'https://amisemedical.com';

/** Parse a site URL value into an origin (no trailing slash), or null. */
export function parseSiteUrl(value: string | undefined | null): string | null {
  // Tolerate a comma-separated list copied from PORTAL_URL: the first entry wins.
  const first = (value ?? '').split(',')[0]?.trim();
  if (!first) return null;
  try {
    const url = new URL(first);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Canonical origin, e.g. `https://amisemedical.com` (no trailing slash). */
export function siteUrl(): string {
  return parseSiteUrl(process.env.NEXT_PUBLIC_SITE_URL) ?? DEFAULT_SITE_URL;
}

/** Absolute canonical URL for a site path, e.g. `absoluteUrl('/book')`. */
export function absoluteUrl(path = '/'): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return p === '/' ? siteUrl() : `${siteUrl()}${p}`;
}
