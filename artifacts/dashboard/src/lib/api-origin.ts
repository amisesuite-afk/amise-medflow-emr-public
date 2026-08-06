/**
 * Resolves the API origin from VITE_API_URL, sanitising values that have
 * picked up stray wrapping quotes or trailing slashes/whitespace from env
 * var entry (a one-character typo here turns every fetch() in the app into
 * a thrown SyntaxError: "The string did not match the expected pattern").
 *
 * In development, falls back to '' (same-origin) so Vite's /api proxy
 * forwards requests to the local API server.
 *
 * In production, the dashboard's vercel.json rewrites /api/:path* to the
 * Render API server, so '' (same-origin) is correct here too — requests
 * travel through Vercel's edge network to Render, eliminating CORS and
 * avoiding any hardcoded Render hostname in the browser bundle.
 *
 * If VITE_API_URL is explicitly set (e.g. for a non-Vercel deploy or a
 * self-hosted setup), that value wins over the same-origin default.
 */
export function getApiOrigin(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
  const sanitised = raw.trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '');
  if (sanitised) return sanitised;
  // Same-origin in both dev (Vite proxy) and production (Vercel rewrite).
  return '';
}
