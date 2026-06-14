/**
 * Resolves the API origin from VITE_API_URL, sanitising values that have
 * picked up stray wrapping quotes or trailing slashes/whitespace from env
 * var entry (a one-character typo here turns every fetch() in the app into
 * a thrown SyntaxError: "The string did not match the expected pattern").
 * Returns '' when unset, so callers fall back to same-origin requests.
 */
export function getApiOrigin(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
  return raw.trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '');
}
