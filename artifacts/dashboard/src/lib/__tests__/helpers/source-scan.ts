/**
 * Source-scan helpers for regression guards (no React rendering in this test suite).
 *
 * `effectBodies()` returns the text of every `useEffect(...)` call in a source file, found by
 * bracket matching, so a test can assert that no effect writes clinical content by itself
 * (UX review C2–C4: suggestions stay visible, nothing is recorded without a clinician action).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Read a file under artifacts/dashboard/src by its path relative to src/. */
export function readSrc(rel: string): string {
  return readFileSync(fileURLToPath(new URL(`../../../${rel}`, import.meta.url)), 'utf8');
}

/** Text of the call starting at `start` (the index of its opening parenthesis), bracket-matched. */
function callText(src: string, open: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); i = nl < 0 ? src.length : nl; continue; }
    if (c === '/' && src[i + 1] === '*') { const end = src.indexOf('*/', i + 2); i = end < 0 ? src.length : end + 1; continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  return src.slice(open);
}

export function effectBodies(src: string): string[] {
  const out: string[] = [];
  const re = /\buseEffect\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(callText(src, m.index + m[0].length - 1));
  return out;
}

/** Body of a named function declaration (`function name(`…`}`), or '' when absent. */
export function functionBody(src: string, name: string): string {
  const m = new RegExp(`function\\s+${name}\\s*\\(`).exec(src);
  if (!m) return '';
  const brace = src.indexOf('{', m.index);
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(brace, i + 1); }
  }
  return src.slice(brace);
}
