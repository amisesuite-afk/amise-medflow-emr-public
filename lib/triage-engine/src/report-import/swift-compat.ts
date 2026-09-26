// Small helpers that reproduce the Foundation / Swift String behaviour the iOS report parsers
// rely on, so the TypeScript port gives the same answers (LabReportParser.swift and friends).
// Pure: no DOM, no network.

/** CharacterSet.whitespaces: tab and Unicode Zs. */
export function isWhitespace(c: string): boolean {
  return c === '\t' || /^\p{Zs}$/u.test(c);
}

/** CharacterSet.whitespacesAndNewlines: Z*, U+000A–U+000D, U+0085. */
export function isWhitespaceOrNewline(c: string): boolean {
  return isWhitespace(c) || /^[\n\u000B\u000C\r\u0085\u2028\u2029]$/.test(c);
}

/** Character.isLetter (Alphabetic). */
export function isLetter(c: string): boolean {
  return /^\p{Alphabetic}$/u.test(c);
}

/** Character.isNumber (any Unicode number: digits, superscripts, fractions). */
export function isNumberChar(c: string): boolean {
  return /^\p{N}$/u.test(c);
}

/** CharacterSet.punctuationCharacters (P*). */
export function isPunctuation(c: string): boolean {
  return /^\p{P}$/u.test(c);
}

/** String.trimmingCharacters(in:) with a predicate or a literal character list. */
export function trimChars(s: string, set: string | ((c: string) => boolean)): string {
  const test = typeof set === 'string' ? (c: string) => set.includes(c) : set;
  const chars = Array.from(s);
  let start = 0;
  let end = chars.length;
  while (start < end && test(chars[start])) start++;
  while (end > start && test(chars[end - 1])) end--;
  return chars.slice(start, end).join('');
}

export const trimWS = (s: string): string => trimChars(s, isWhitespace);
export const trimWSNL = (s: string): string => trimChars(s, isWhitespaceOrNewline);

/** `split(separator: " ")` (empty pieces omitted). */
export function splitSpaces(s: string): string[] {
  return s.split(' ').filter(p => p.length > 0);
}

/** Count of letters in a string (`s.filter(\.isLetter).count`). */
export function letterCount(s: string): number {
  let n = 0;
  for (const c of s) if (isLetter(c)) n++;
  return n;
}

/** `s.contains(where: \.isNumber)`. */
export function containsNumber(s: string): boolean {
  for (const c of s) if (isNumberChar(c)) return true;
  return false;
}

/**
 * `String(format: "%.Nf", v)`: the exact binary value rounded to N decimals, ties to even
 * (what Apple's printf does). `Number.toFixed` rounds ties up, so it is not used directly.
 */
export function formatFixed(v: number, decimals: number): string {
  const d = Math.max(0, Math.min(decimals, 4));
  if (Number.isNaN(v)) return 'nan';
  if (!Number.isFinite(v)) return v > 0 ? 'inf' : '-inf';
  const negative = v < 0 || Object.is(v, -0);
  const a = Math.abs(v);
  // toFixed(100) is the exact decimal expansion for every value this code formats.
  const exact = a.toFixed(100);
  const [intPart, frac] = exact.split('.');
  const kept = intPart + frac.slice(0, d);
  const rest = frac.slice(d);
  let roundUp: boolean;
  if (rest[0] > '5') roundUp = true;
  else if (rest[0] < '5') roundUp = false;
  else if (/[1-9]/.test(rest.slice(1))) roundUp = true;
  else roundUp = (Number(kept[kept.length - 1]) % 2) === 1;
  let digits = (BigInt(kept) + (roundUp ? 1n : 0n)).toString();
  if (digits.length < d + 1) digits = digits.padStart(d + 1, '0');
  const out = d === 0 ? digits : `${digits.slice(0, digits.length - d)}.${digits.slice(digits.length - d)}`;
  return negative ? `-${out}` : out;
}

/** Lowercased, accents removed (`folding(options: [.caseInsensitive, .diacriticInsensitive])`). */
export function foldCaseAndDiacritics(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}
