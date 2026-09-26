/**
 * Canonical JSON for the approved-content channel (docs/APPROVED-CONTENT-CHANNEL.md §3).
 *
 * A published release of a shared rule file is stored as `jsonb`, which keeps neither key order
 * nor whitespace, so its SHA-256 is taken over a canonical text that every platform can rebuild
 * from the parsed value. Twin: ios/AmiseMedFlow/Services/ApprovedContent.swift (`canonicalJSON`);
 * shared vectors: ios/AmiseMedFlowTests/Resources/ApprovedContentVectors.json.
 *
 * Definition (both platforms, exactly):
 *   - null, true, false as written.
 *   - Objects: `{` + members joined by `,` + `}`; each member is the canonical key string, `:`,
 *     the canonical value. Keys sorted by UTF-16 code units (JavaScript's default sort; Swift
 *     `utf16.lexicographicallyPrecedes`). No whitespace anywhere.
 *   - Arrays: `[` + canonical items joined by `,` + `]`, in their order.
 *   - Strings: `"` … `"`. Escaped: `"` → `\"`, `\` → `\\`, U+0008 `\b`, U+000C `\f`, U+000A `\n`,
 *     U+000D `\r`, U+0009 `\t`; any other U+0000–U+001F as `\u00xx` (lowercase hex). Everything
 *     else, `/` and non-ASCII included, is written as itself. A lone surrogate is an error.
 *   - Numbers: finite only. An integral value must lie within ±(2^53 − 1) (larger integers are an
 *     error: the platforms would not read them alike) and is written in plain decimal digits
 *     (-0 → `0`). Any other value is written with the shortest digits that round-trip to the same
 *     IEEE-754 double (ECMAScript Number::toString, Swift `Double.description`), in plain decimal
 *     notation: never an exponent, no `+`, no leading zeros other than one before the point, no
 *     trailing zeros after it (0.1 → `0.1`, 1e-7 → `0.0000001`).
 *   - The hash is SHA-256 over the UTF-8 bytes of that text, as 64 lowercase hex digits.
 */

export class CanonicalJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CanonicalJsonError';
  }
}

const MAX_SAFE = 9007199254740991; // 2^53 − 1
const MAX_DEPTH = 64;

/** Canonical text of a parsed JSON value (throws CanonicalJsonError on anything JSON cannot hold). */
export function canonicalJson(value: unknown): string {
  const out: string[] = [];
  write(value, out, 0);
  return out.join('');
}

/** canonicalJson, or null when the value cannot be canonicalised. */
export function tryCanonicalJson(value: unknown): string | null {
  try {
    return canonicalJson(value);
  } catch {
    return null;
  }
}

function write(v: unknown, out: string[], depth: number): void {
  if (depth > MAX_DEPTH) throw new CanonicalJsonError(`nested deeper than ${MAX_DEPTH}`);
  if (v === null) { out.push('null'); return; }
  switch (typeof v) {
    case 'boolean': out.push(v ? 'true' : 'false'); return;
    case 'number': out.push(canonicalNumber(v)); return;
    case 'string': out.push(canonicalString(v)); return;
    case 'object': break;
    default: throw new CanonicalJsonError(`not a JSON value (${typeof v})`);
  }
  if (Array.isArray(v)) {
    out.push('[');
    v.forEach((item, i) => {
      if (i > 0) out.push(',');
      write(item, out, depth + 1);
    });
    out.push(']');
    return;
  }
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) throw new CanonicalJsonError('not a plain JSON object');
  const obj = v as Record<string, unknown>;
  // Default sort: UTF-16 code unit order.
  const keys = Object.keys(obj).sort();
  out.push('{');
  keys.forEach((k, i) => {
    if (obj[k] === undefined) throw new CanonicalJsonError(`undefined value at key ${JSON.stringify(k)}`);
    if (i > 0) out.push(',');
    out.push(canonicalString(k), ':');
    write(obj[k], out, depth + 1);
  });
  out.push('}');
}

/** Canonical number text (see the header). */
export function canonicalNumber(n: number): string {
  if (!Number.isFinite(n)) throw new CanonicalJsonError('non-finite number');
  if (Number.isInteger(n)) {
    if (Math.abs(n) > MAX_SAFE) throw new CanonicalJsonError('integer outside ±(2^53 − 1)');
    return n === 0 ? '0' : String(n);
  }
  return plainDecimal(String(n));
}

/**
 * Rewrites a shortest-round-trip number text (`-1.5e-7`, `1e-07`, `123.45`, `1.5e+21`) in plain
 * decimal notation. Twin: `ApprovedContent.plainDecimal` (Swift).
 */
export function plainDecimal(text: string): string {
  let s = text;
  const negative = s.startsWith('-');
  if (negative) s = s.slice(1);
  const ePos = s.search(/e/i);
  const mantissa = ePos >= 0 ? s.slice(0, ePos) : s;
  const exponent = ePos >= 0 ? parseInt(s.slice(ePos + 1), 10) : 0;
  const dot = mantissa.indexOf('.');
  const intPart = dot >= 0 ? mantissa.slice(0, dot) : mantissa;
  const fracPart = dot >= 0 ? mantissa.slice(dot + 1) : '';
  let digits = intPart + fracPart;
  let point = intPart.length + exponent;
  let lead = 0;
  while (lead < digits.length - 1 && digits[lead] === '0') lead++;
  digits = digits.slice(lead);
  point -= lead;
  let end = digits.length;
  while (end > 0 && digits[end - 1] === '0') end--;
  digits = digits.slice(0, end);
  if (digits === '') return '0';
  let body: string;
  if (point <= 0) body = `0.${'0'.repeat(-point)}${digits}`;
  else if (point >= digits.length) body = digits + '0'.repeat(point - digits.length);
  else body = `${digits.slice(0, point)}.${digits.slice(point)}`;
  return negative ? `-${body}` : body;
}

const SHORT_ESCAPES: Record<number, string> = {
  0x22: '\\"', 0x5c: '\\\\', 0x08: '\\b', 0x0c: '\\f', 0x0a: '\\n', 0x0d: '\\r', 0x09: '\\t',
};

/** Canonical string text (see the header). */
export function canonicalString(s: string): string {
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (!(d >= 0xdc00 && d <= 0xdfff)) throw new CanonicalJsonError('lone surrogate in a string');
      out += s[i] + s[i + 1];
      i++;
      continue;
    }
    if (c >= 0xdc00 && c <= 0xdfff) throw new CanonicalJsonError('lone surrogate in a string');
    const short = SHORT_ESCAPES[c];
    if (short) out += short;
    else if (c < 0x20) out += `\\u${c.toString(16).padStart(4, '0')}`;
    else out += s[i];
  }
  return `${out}"`;
}
