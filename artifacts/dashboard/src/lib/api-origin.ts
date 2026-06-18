/**
 * Resolves the API origin from VITE_API_URL, sanitising values that have
 * picked up stray wrapping quotes or trailing slashes/whitespace from env
 * var entry (a one-character typo here turns every fetch() in the app into
 * a thrown SyntaxError: "The string did not match the expected pattern").
 *
 * Falls back to '' (same-origin) in dev, where Vite proxies /api to the
 * local API server. In production the dashboard is a static SPA with a
 * catch-all rewrite to index.html, so a same-origin /api request would
 * return the HTML shell instead of JSON — fall back to the deployed API
 * origin instead.
 */
export function getApiOrigin(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
  const sanitised = raw.trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '');
  if (sanitised) return sanitised;
  return import.meta.env.DEV ? '' : 'https://amise-medflow-api.onrender.com';
}
