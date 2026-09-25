// Deterministic parser for the text of a lab result report (Laboratory Services Ltd PDF text or
// pasted text). TypeScript port of ios/AmiseMedFlow/Services/LabReportParser.swift: same layouts,
// same row rules, same unit assessment. No network, no AI.
//
// Output: header (name, DOB/age, sex, lab number, collection/report dates) and result rows
// (analyte, value, unit, reference range, H/L flag). Lines it cannot read as a result are
// ignored; lines it can read but does not recognise become unmapped rows (never dropped). Every
// row is shown to the clinician, editable, before anything is saved; nothing here writes.

import {
  ALIAS_INDEX, KNOWN_UNITS, analyteForKey, misreadApplies, normaliseUnit, type NameReaders,
} from './catalog';
import { parseReportHeader, type ReportHeader } from './header';
import { containsNumber, formatFixed, isLetter, letterCount, splitSpaces, trimChars, trimWS } from './swift-compat';

// MARK: - Rows

export type LabSpecimen = 'blood' | 'urine' | 'other';

export interface ParsedLabRow {
  /** The analyte text as printed. */
  reportLabel: string;
  /** Catalogue key; null = unmapped. */
  analyteKey: string | null;
  /** The value as printed ("13.5", "<5", "Negative"). */
  valueText: string;
  unit: string;
  referenceRange: string;
  flag: string;
  /** Other words on the line ("fasting", "(Na)", method names). */
  comment: string;
  section: string | null;
  specimen: LabSpecimen;
  page: number;
  sourceLine: string;
}

export interface ParsedLabReport {
  header: ReportHeader;
  rows: ParsedLabRow[];
  pageCount: number;
  /** The table layout looked column-by-column, which cannot be paired reliably. */
  layoutWarning: boolean;
}

export interface ReportLine {
  text: string;
  page: number;
}

// MARK: - Lines

/** Lines with whitespace collapsed and dashes folded; a form feed starts a new page. */
export function splitReportLines(text: string): ReportLine[] {
  const out: ReportLine[] = [];
  let page = 0;
  const unified = text
    .split('\r\n').join('\n')
    .split('\r').join('\n')
    .split('\u2028').join('\n')
    .split('\u000C').join('\n\u000C\n');
  for (const raw of unified.split('\n')) {
    if (raw === '\u000C') { page++; continue; }
    let s = raw;
    for (const dash of ['–', '—', '−', '‐']) s = s.split(dash).join('-');
    s = s.split('\u00A0').join(' ').split('\t').join(' ').split('|').join(' ');
    s = trimWS(s.replace(/\s+/g, ' '));
    out.push({ text: s, page });
  }
  return out;
}

const COLUMN_WORDS = new Set([
  'test', 'tests', 'result', 'results', 'units', 'unit', 'flag', 'flags', 'reference',
  'range', 'ranges', 'ref', 'interval', 'investigation', 'parameter', 'analyte', 'value',
  'normal', 'biological', 'specimen', 'method',
]);

export function isColumnHeader(line: string): boolean {
  const words = line.toLowerCase().split(/[^\p{L}\p{M}]/u).filter(w => w.length > 0);
  if (words.length === 0 || containsNumber(line)) return false;
  return words.filter(w => COLUMN_WORDS.has(w)).length >= 2;
}

/** A section heading: a short line without digits, in capitals or ending with ":". */
export function sectionTitle(line: string): string | null {
  if (line === '' || containsNumber(line) || isBareAnalyteLabel(line)) return null;
  const words = splitSpaces(line);
  const letters = Array.from(line).filter(isLetter).join('');
  if (!(words.length >= 1 && words.length <= 6) || Array.from(letters).length < 3) return null;
  const isCaps = letters === letters.toUpperCase();
  if (!isCaps && !line.endsWith(':')) return null;
  return trimChars(line, ' :');
}

const BLOOD_SECTION_WORDS = [
  'haematolog', 'hematolog', 'biochem', 'chemistry', 'blood', 'serum', 'plasma', 'profile',
  'function', 'count', 'coagulation', 'clotting', 'lipid', 'renal', 'kidney', 'liver',
  'thyroid', 'electrolyte', 'marker', 'immunolog', 'serolog', 'endocrin', 'hormone',
  'cardiac', 'pancrea', 'iron', 'vitamin', 'diabet', 'glucose', 'u&e', 'fbc', 'cbc', 'lft',
];

/**
 * Specimen for rows under a new heading. A sub-heading inside a urine section keeps the urine
 * specimen; only a recognisable blood-section heading leaves it.
 */
export function specimenForSection(section: string, current: LabSpecimen = 'blood'): LabSpecimen {
  const s = section.toLowerCase();
  if (s.includes('urin')) return 'urine';
  for (const word of ['stool', 'faec', 'fec', 'csf', 'fluid', 'sputum', 'swab', 'semen']) {
    if (s.includes(word)) return 'other';
  }
  if (current !== 'blood' && !BLOOD_SECTION_WORDS.some(w => s.includes(w))) return current;
  return 'blood';
}

// MARK: - Analyte labels

const BOUNDARY = new Set([' ', ':', '(', '[', ',', '=', '#', '-', '.', '*']);
const SPECIMEN_PREFIXES = ['serum ', 's. ', 's-', 'plasma ', 'p. ', 'p-', 'whole blood ', 'blood '];

export interface AnalyteMatch {
  key: string;
  label: string;
  rest: string;
  alias: string;
}

/** The catalogue analyte printed at the start of `text`: key, label as printed, the rest. */
export function matchAnalyte(text: string): AnalyteMatch | null {
  const candidates = [text];
  const lowerText = text.toLowerCase();
  for (const prefix of SPECIMEN_PREFIXES) {
    if (lowerText.startsWith(prefix)) candidates.push(text.slice(prefix.length));
  }
  for (let n = 0; n < candidates.length; n++) {
    const candidate = candidates[n];
    for (const { alias, key } of ALIAS_INDEX) {
      if (candidate.length < alias.length) continue;
      if (candidate.slice(0, alias.length).toLowerCase() !== alias) continue;
      const upper = alias.length;
      if (upper < candidate.length && !BOUNDARY.has(candidate[upper])) continue;
      const prefixLength = n === 0 ? 0 : text.length - candidate.length;
      return { key, label: text.slice(0, prefixLength + upper), rest: candidate.slice(upper), alias };
    }
  }
  return null;
}

export function isBareAnalyteLabel(line: string): boolean {
  const m = matchAnalyte(line);
  if (!m) return false;
  return trimChars(m.rest, ' :-=*') === '';
}

// MARK: - Tokens

const NUMBER_TOKEN_RE = /^(<=|>=|<|>|≤|≥)?=?(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|-?\.\d+)(\*{1,2}|[HhLl]{1,2}|\([HhLl]\)|↑|↓)?$/;

/** A value token: number text with any comparator, and an attached flag. */
export function valueToken(token: string): { value: string; flag: string } | null {
  const m = NUMBER_TOKEN_RE.exec(token);
  if (!m) return null;
  const comparator = m[1] ?? '';
  const flag = m[3] !== undefined ? trimChars(m[3], '()') : '';
  return { value: comparator + m[2], flag: flag.toUpperCase() };
}

const COMPARATORS = new Set(['<', '>', '<=', '>=', '≤', '≥']);

const FLAG_WORDS = new Set([
  'H', 'L', 'HH', 'LL', 'HI', 'LO', 'HIGH', 'LOW', 'A', 'ABN', 'ABNORMAL', 'C', 'CRIT',
  'CRITICAL', '*', '**', '↑', '↓', 'N', 'NORMAL', '!', '+',
]);

export function flagToken(token: string): string | null {
  const t = trimChars(token, '()[]').toUpperCase();
  return FLAG_WORDS.has(t) ? t : null;
}

const QUALITATIVE_SINGLE = new Set([
  'negative', 'positive', 'reactive', 'non-reactive', 'nonreactive', 'detected', 'nil',
  'trace', 'absent', 'present', 'pending', 'clear', 'cloudy', 'turbid', 'yellow', 'straw',
  'amber', 'few', 'moderate', 'many', 'occasional', 'rare', 'neg', 'pos', '+', '++',
  '+++', '++++',
]);
const QUALITATIVE_PAIRS = new Set(['not detected', 'non reactive', 'see comment', 'to follow', 'not seen']);

const GENERIC_UNIT_RE = /^[A-Za-zµμ%]{1,6}\/[A-Za-z0-9.µμ]{1,8}$/;

export function isUnitToken(token: string): boolean {
  const t = trimChars(token, '()[],;');
  if (t === '') return false;
  if (t.toLowerCase() === 'ratio') return true;
  if (KNOWN_UNITS.has(normaliseUnit(t))) return true;
  return GENERIC_UNIT_RE.test(t);
}

const DIGIT_UNIT_RES: RegExp[] = [
  /(?<![\d.])(?:(?:x|×)\s*)?10\s*(?:\^|\*|e|E)?\s*(?:12|9|6|3|¹²|⁹|⁶|³)\s*\/\s*(?:l|ul|µl|μl|mm3|mm³|cumm)(?![A-Za-z])/i,
  /ml\s*\/\s*min\s*\/\s*1\.73\s*(?:m\s*(?:2|²|\^2)?)?/i,
  /mm\s*\/\s*1st\s*h(?:ou)?r?/i,
];

const TWO_SIDED_RANGE_RE = /[([]?\s*([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(?:-|to)\s*([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*[)\]]?/i;
const ONE_SIDED_RANGE_RE = /[([]?\s*(<=|>=|<|>|≤|≥|up\s+to|less\s+than|greater\s+than)\s*(\d+(?:\.\d+)?)\s*[)\]]?/i;
const LEADING_RANGE_RE = /^\s*[([]?\s*\d+(?:\.\d+)?\s*(?:-|to)\s*\d+(?:\.\d+)?\s*[)\]]?(?=\s+[<>]?\d)/i;
const GLUED_UNIT_RE = /^([<>]?\d+(?:\.\d+)?)([A-Za-zµμ%/][A-Za-z0-9/µμ%.^]*)$/;

/** "138mmol/L" → ["138", "mmol/L"]; anything else unchanged. */
export function splitGluedUnit(token: string): string[] {
  const m = GLUED_UNIT_RE.exec(token);
  if (!m) return [token];
  return isUnitToken(m[2]) ? [m[1], m[2]] : [token];
}

/** Removes the first match of `re` from `box.s` (replaced by a space) and returns it trimmed. */
function extract(re: RegExp, box: { s: string }): string | null {
  const m = re.exec(box.s);
  if (!m) return null;
  box.s = box.s.slice(0, m.index) + ' ' + box.s.slice(m.index + m[0].length);
  return trimWS(m[0]);
}

// MARK: - Tail (everything after the analyte label)

export interface LabTail {
  value: string;
  unit: string;
  range: string;
  flag: string;
  comment: string[];
  /** Text of a second result printed on the same line. */
  remainder: string | null;
}

/** Value, unit, range and flag from the text after the label; null when there is no value. */
export function parseTail(text: string, allowQualitative: boolean): LabTail | null {
  const box = { s: ' ' + text + ' ' };
  let unit = '';
  let comment: string[] = [];
  let leadingRange = '';

  // Units that contain digits come out first, so their digits are not read as a value/range.
  for (const re of DIGIT_UNIT_RES) {
    if (unit === '') {
      const u = extract(re, box);
      if (u !== null) unit = u;
    }
  }

  // A reference range printed before the value ("Hb 12.0 - 16.0 11.2 g/dL").
  const lr = extract(LEADING_RANGE_RE, box);
  if (lr !== null) leadingRange = lr;

  let tokens = splitSpaces(box.s).flatMap(splitGluedUnit);
  // Leading separators ("Sodium: 138", "Urea = 5.1", "K - 4.2").
  while (tokens.length > 0 && [':', '=', '-', ':-'].includes(tokens[0])) tokens.shift();
  if (tokens.length > 0 && (tokens[0].startsWith(':') || tokens[0].startsWith('='))) {
    tokens[0] = tokens[0].replace(/^[:=]+/, '');
    if (tokens[0] === '') tokens.shift();
  }

  // Find the value within the first few tokens.
  let value: string | null = null;
  let flag = '';
  let idx = 0;
  while (idx < tokens.length && idx < 7) {
    const t = tokens[idx];
    if (COMPARATORS.has(t) && idx + 1 < tokens.length) {
      const v = valueToken(tokens[idx + 1]);
      if (v) { value = t + v.value; flag = v.flag; idx += 2; break; }
    }
    const v = valueToken(t);
    if (v) { value = v.value; flag = v.flag; idx += 1; break; }
    if (allowQualitative) {
      if (idx + 1 < tokens.length && QUALITATIVE_PAIRS.has((t + ' ' + tokens[idx + 1]).toLowerCase())) {
        value = t + ' ' + tokens[idx + 1]; idx += 2; break;
      }
      if (QUALITATIVE_SINGLE.has(t.toLowerCase())) { value = t; idx += 1; break; }
    }
    if (unit === '' && isUnitToken(t)) { unit = t; idx += 1; continue; }
    comment.push(t);
    idx += 1;
  }
  if (value === null) return null;

  let after = tokens.slice(idx);

  // A second result on the same line ("Sodium 138 mmol/L Potassium 4.2 mmol/L").
  let remainder: string | null = null;
  if (after.length >= 2) {
    for (let j = 0; j < after.length; j++) {
      const candidate = after.slice(j).join(' ');
      const m = matchAnalyte(candidate);
      if (!m) continue;
      const restTokens = splitSpaces(m.rest);
      const nextIsNumber = restTokens.length > 0 && valueToken(trimChars(restTokens[0], ':=')) !== null;
      const hasNumber = restTokens.slice(0, 4).some(x => valueToken(x) !== null);
      if ((m.alias.length >= 3 && hasNumber) || nextIsNumber) {
        remainder = candidate;
        after = after.slice(0, j);
        break;
      }
    }
  }

  const restBox = { s: ' ' + after.join(' ') + ' ' };
  let range = leadingRange;
  const two = extract(TWO_SIDED_RANGE_RE, restBox);
  if (two !== null) range = two;
  else {
    const one = extract(ONE_SIDED_RANGE_RE, restBox);
    if (one !== null) range = one;
  }
  const leftovers = splitSpaces(restBox.s);

  // Units: two tokens together first ("mg/L FEU", "mL/min/1.73 m2"), then single tokens.
  if (unit === '') {
    for (let k = 0; k < Math.max(0, leftovers.length - 1); k++) {
      const pair = leftovers[k] + leftovers[k + 1];
      if (KNOWN_UNITS.has(normaliseUnit(pair))
        && (!KNOWN_UNITS.has(normaliseUnit(leftovers[k])) || leftovers[k + 1].toUpperCase() === 'FEU')) {
        unit = leftovers[k] + ' ' + leftovers[k + 1];
        leftovers.splice(k, 2);
        break;
      }
    }
  }
  const kept: string[] = [];
  for (const t of leftovers) {
    if (unit === '' && isUnitToken(t)) { unit = t; continue; }
    if (!unit.toUpperCase().endsWith('FEU') && t.toUpperCase() === 'FEU' && unit !== '') {
      unit += ' FEU'; continue;
    }
    if (flag === '') {
      const f = flagToken(t);
      if (f !== null) { flag = f; continue; }
    }
    kept.push(t);
  }
  comment = comment.concat(kept);

  // A range printed before the value ends up in the comment.
  if (range === '' && comment.length > 0) {
    const c = { s: ' ' + comment.join(' ') + ' ' };
    let found = extract(TWO_SIDED_RANGE_RE, c);
    if (found === null) found = extract(ONE_SIDED_RANGE_RE, c);
    if (found !== null) {
      range = found;
      comment = splitSpaces(c.s);
    }
  }

  comment = comment
    .map(x => trimChars(x, ':='))
    .filter(x => x !== '' && x !== '-');

  return {
    value,
    unit: trimChars(unit, '()[],;'),
    range: trimChars(range, '()[] '),
    flag,
    comment,
    remainder,
  };
}

/** A line holding only a unit, a range and/or a flag (one-cell-per-line layouts). */
export function isTailOnly(line: string): boolean {
  if (line === '') return false;
  const box = { s: ' ' + line + ' ' };
  let took = false;
  for (const re of DIGIT_UNIT_RES) {
    if (extract(re, box) !== null) took = true;
  }
  if (extract(TWO_SIDED_RANGE_RE, box) !== null) took = true;
  else if (extract(ONE_SIDED_RANGE_RE, box) !== null) took = true;
  for (const t of splitSpaces(box.s)) {
    if (isUnitToken(t) || flagToken(t) !== null) { took = true; continue; }
    return false;
  }
  return took;
}

// MARK: - One line

export function parseLabLine(line: string, section: string | null, specimen: LabSpecimen, page: number): ParsedLabRow[] {
  const rows: ParsedLabRow[] = [];
  let remaining: string | null = line;
  let guardCount = 0;
  while (remaining !== null && remaining !== '' && guardCount < 6) {
    guardCount++;
    const parsed = parseOne(remaining, section, specimen, page, line);
    if (!parsed) break;
    rows.push(parsed.row);
    remaining = parsed.remainder;
  }
  return rows;
}

function parseOne(text: string, section: string | null, specimen: LabSpecimen, page: number,
  sourceLine: string): { row: ParsedLabRow; remainder: string | null } | null {
  const m = matchAnalyte(text);
  const tail = m ? parseTail(m.rest, true) : null;
  if (m && tail) {
    let key: string | null = m.key;
    let rowSpecimen = specimen;
    const commentText = tail.comment.join(' ').toLowerCase();
    const analyte = analyteForKey(m.key);
    if (analyte) {
      for (const remap of analyte.qualifierRemaps) {
        if (commentText.includes(remap.word)) { key = remap.key; break; }
      }
    }
    if (commentText.includes('urin')) rowSpecimen = 'urine';
    let label = trimChars(m.label, ' :=-');
    if (rowSpecimen !== 'blood') {
      // Same analyte in urine (or another fluid) is a different test: never file it under the
      // blood name the scores read.
      key = null;
      if (rowSpecimen === 'urine' && !label.toLowerCase().includes('urin')) label = 'Urine ' + label;
    }
    return {
      row: {
        reportLabel: label, analyteKey: key, valueText: tail.value, unit: tail.unit,
        referenceRange: tail.range, flag: tail.flag, comment: tail.comment.join(' '),
        section, specimen: rowSpecimen, page, sourceLine,
      },
      remainder: tail.remainder,
    };
  }
  return parseGeneric(text, section, specimen, page, sourceLine);
}

/**
 * An unrecognised analyte: label = the words before the value. Kept only when the line looks
 * like a result (a unit, range or flag with a number; or a short label with a word result).
 */
function parseGeneric(text: string, section: string | null, specimen: LabSpecimen, page: number,
  sourceLine: string): { row: ParsedLabRow; remainder: string | null } | null {
  const tokens = splitSpaces(text);
  const first = tokens[0];
  if (first === undefined) return null;
  const firstChar = Array.from(first)[0];
  if (firstChar === undefined || !isLetter(firstChar)) return null;
  let k = 1;
  while (k < tokens.length && k <= 8) {
    const t = tokens[k];
    if (valueToken(t) !== null || COMPARATORS.has(t)
      || QUALITATIVE_SINGLE.has(t.toLowerCase())
      || (k + 1 < tokens.length && QUALITATIVE_PAIRS.has((t + ' ' + tokens[k + 1]).toLowerCase()))) {
      break;
    }
    k++;
  }
  if (!(k < tokens.length && k <= 8)) return null;
  const label = trimChars(tokens.slice(0, k).join(' '), ' :=-');
  if (letterCount(label) < 2 || Array.from(label).length > 60) return null;
  const tail = parseTail(tokens.slice(k).join(' '), true);
  if (!tail) return null;
  const numeric = valueToken(tail.value) !== null;
  if (numeric) {
    if (tail.unit === '' && tail.range === '' && tail.flag === '') return null;
  } else if (!(k <= 6 && tokens.length <= 10)) {
    return null;
  }
  let saved = label;
  if (specimen === 'urine' && !label.toLowerCase().includes('urin')) saved = 'Urine ' + label;
  return {
    row: {
      reportLabel: saved, analyteKey: null, valueText: tail.value, unit: tail.unit,
      referenceRange: tail.range, flag: tail.flag, comment: tail.comment.join(' '),
      section, specimen, page, sourceLine,
    },
    remainder: tail.remainder,
  };
}

/** Drops repeats of the same result (a header table printed again on page 2). */
export function deduplicateRows(rows: ParsedLabRow[]): ParsedLabRow[] {
  const seen = new Set<string>();
  const out: ParsedLabRow[] = [];
  for (const r of rows) {
    const key = [r.analyteKey ?? r.reportLabel.toLowerCase(), r.valueText, r.unit.toLowerCase(), r.specimen].join('\u001F');
    if (!seen.has(key)) { seen.add(key); out.push(r); }
  }
  return out;
}

// MARK: - Report

export function parseLabReport(text: string, nowMs: number = Date.now()): ParsedLabReport {
  const lines = splitReportLines(text);
  const header = parseReportHeader(lines.map(l => l.text), nowMs);
  let rows: ParsedLabRow[] = [];
  let section: string | null = null;
  let specimen: LabSpecimen = 'blood';
  let bareLabelRun = 0;
  let layoutWarning = false;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (header.headerLineIndices.has(i) || isColumnHeader(line.text) || line.text === '') {
      i++; continue;
    }

    // One cell per line: an analyte label alone, then its value/unit/range lines.
    if (isBareAnalyteLabel(line.text)) {
      bareLabelRun++;
      if (bareLabelRun >= 3) layoutWarning = true;
      const previousWasBare = i > 0 && isBareAnalyteLabel(lines[i - 1].text);
      if (previousWasBare) { i++; continue; }           // column-by-column: never pair by position
      let joined = line.text;
      let j = i + 1;
      let found = false;
      while (j < lines.length && j <= i + 4) {
        const next = lines[j].text;
        if (header.headerLineIndices.has(j) || isBareAnalyteLabel(next) || sectionTitle(next) !== null || next === '') break;
        joined += ' ' + next;
        j++;
        const m = matchAnalyte(joined);
        if (m && parseTail(m.rest, true) !== null) { found = true; break; }
      }
      if (found) {
        while (j < lines.length && j <= i + 7 && isTailOnly(lines[j].text)) {
          joined += ' ' + lines[j].text;
          j++;
        }
        rows = rows.concat(parseLabLine(joined, section, specimen, line.page));
        bareLabelRun = 0;
        i = j;
      } else {
        i++;
      }
      continue;
    }
    bareLabelRun = 0;

    const title = sectionTitle(line.text);
    if (title !== null) {
      section = title;
      specimen = specimenForSection(title, specimen);
      i++; continue;
    }

    rows = rows.concat(parseLabLine(line.text, section, specimen, line.page));
    i++;
  }

  const maxPage = lines.reduce((mx, l) => Math.max(mx, l.page), 0);
  return { header, rows: deduplicateRows(rows), pageCount: maxPage + 1, layoutWarning };
}

// MARK: - Assessment of one (possibly edited) row

export type LabAbnormality = 'normal' | 'high' | 'low' | 'abnormal' | 'unknown';

export function abnormalityIsAbnormal(a: LabAbnormality): boolean {
  return a === 'high' || a === 'low' || a === 'abnormal';
}

export function abnormalityLabel(a: LabAbnormality): string {
  switch (a) {
    case 'high': return 'High';
    case 'low': return 'Low';
    case 'abnormal': return 'Abnormal';
    case 'normal': return 'Normal';
    case 'unknown': return '';
  }
}

export type LabRowIssue =
  | { kind: 'unmapped' }
  | { kind: 'readAsOther'; readers: string[] }
  | { kind: 'nonNumeric' }
  | { kind: 'unitMissing'; expected: string }
  | { kind: 'unitAmbiguous'; reason: string }
  | { kind: 'unitUnexpected'; unit: string; expected: string }
  | { kind: 'implausible'; name: string }
  | { kind: 'censored'; reading: string }
  | { kind: 'negative' }
  | { kind: 'scoreMisread'; message: string }
  | { kind: 'urine' }
  | { kind: 'alreadyInRecord' };

export function issueMessage(issue: LabRowIssue): string {
  switch (issue.kind) {
    case 'unmapped': return 'Not recognised: saved under the name shown; no score reads it.';
    case 'readAsOther': return `Scores would read this name as ${issue.readers.join(', ')}. Rename it or leave it unticked.`;
    case 'nonNumeric': return 'No number to save for this analyte.';
    case 'unitMissing': return `No unit printed. Check it and type the unit (the app expects ${issue.expected}).`;
    case 'unitAmbiguous': return `${issue.reason}. Not converted — check the value.`;
    case 'unitUnexpected': return `Unit “${issue.unit}” is not one this analyte is reported in (expected ${issue.expected}). Not converted.`;
    case 'implausible': return `Value is outside any possible range for ${issue.name}. Check the PDF.`;
    case 'censored': return `Reported beyond the lab's limit; scores will read ${issue.reading}.`;
    case 'negative': return 'Negative value: scores read numbers without their minus sign.';
    case 'scoreMisread': return issue.message;
    case 'urine': return 'Urine result: saved separately from the blood value.';
    case 'alreadyInRecord': return 'Already in the record (same test, value and time).';
  }
}

/** The row starts unticked. */
export function issueExcludesByDefault(issue: LabRowIssue): boolean {
  switch (issue.kind) {
    case 'readAsOther': case 'nonNumeric': case 'unitMissing': case 'unitAmbiguous':
    case 'unitUnexpected': case 'implausible': case 'alreadyInRecord':
      return true;
    default:
      return false;
  }
}

/** Needs the clinician's attention before saving ("I have checked the flagged values"). */
export function issueIsWarning(issue: LabRowIssue): boolean {
  return !(issue.kind === 'unmapped' || issue.kind === 'urine' || issue.kind === 'censored');
}

export function sameIssue(a: LabRowIssue, b: LabRowIssue): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export interface LabRowAssessment {
  /** The printed number, if any. */
  number: number | null;
  censor: string | null;
  /** Value text to save (converted, or as printed). */
  storedValue: string;
  /** Unit to save. */
  storedUnit: string;
  /** "converted from 1.2 mg/dL" */
  conversionNote: string | null;
  abnormality: LabAbnormality;
  issues: LabRowIssue[];
}

export const assessmentExcludedByDefault = (a: LabRowAssessment): boolean => a.issues.some(issueExcludesByDefault);
export const assessmentNeedsAttention = (a: LabRowAssessment): boolean => a.issues.some(issueIsWarning);

const ROW_NUMBER_RE = /^\s*(<=|>=|<|>|≤|≥)?\s*=?\s*(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|-?\.\d+)\s*$/;

/** The number in a value text ("13.5", "<5", "1,234"); null for words. */
export function numberFromValueText(valueText: string): { value: number; censor: string | null } | null {
  const m = ROW_NUMBER_RE.exec(valueText);
  if (!m) return null;
  const censor = m[1] ?? null;
  const v = Number(m[2].split(',').join(''));
  if (!Number.isFinite(v)) return null;
  return { value: v, censor };
}

export function formatLabValue(v: number, decimals: number): string {
  return formatFixed(v, decimals);
}

export interface LabRowInput {
  analyteKey: string | null;
  name: string;
  valueText: string;
  unit: string;
  referenceRange: string;
  flag: string;
  specimen: LabSpecimen;
}

/**
 * `readers` says what else would read an unmapped row's name as a number (iOS: score keyword
 * groups and LabPanel; web: the dashboard's CDS/score readers).
 */
export function assessLabRow(input: LabRowInput, readers: NameReaders): LabRowAssessment {
  const { analyteKey, name, valueText, unit, referenceRange, flag, specimen } = input;
  const issues: LabRowIssue[] = [];
  const parsed = numberFromValueText(valueText);
  const printedUnit = trimWS(unit);
  // "7,800" is saved as "7800": readers stop at a comma or read it as a decimal point.
  let storedValue = trimWS(valueText);
  if (parsed !== null) storedValue = storedValue.split(',').join('');
  let storedUnit = printedUnit;
  let conversionNote: string | null = null;

  const analyte = analyteForKey(analyteKey);
  if (analyte) {
    if (parsed !== null) {
      let appValue: number | null = null;
      if (analyte.appUnit !== null) {
        const appUnit = analyte.appUnit;
        const u = normaliseUnit(printedUnit);
        if (printedUnit === '' || u === '') {
          if (analyte.unitAliases.includes('') || !analyte.unitRequired) appValue = parsed.value;
          else issues.push({ kind: 'unitMissing', expected: appUnit });
        } else if (analyte.unitAliases.includes(u)) {
          appValue = parsed.value;
        } else if (Object.prototype.hasOwnProperty.call(analyte.conversions, u)) {
          const converted = parsed.value * analyte.conversions[u];
          appValue = converted;
          storedValue = (parsed.censor ?? '') + formatLabValue(converted, analyte.decimals);
          storedUnit = appUnit;
          conversionNote = `converted from ${trimWS(valueText)} ${printedUnit}`;
        } else if (Object.prototype.hasOwnProperty.call(analyte.ambiguousUnits, u)) {
          issues.push({ kind: 'unitAmbiguous', reason: analyte.ambiguousUnits[u] });
        } else {
          issues.push({ kind: 'unitUnexpected', unit: printedUnit, expected: appUnit });
        }
      } else {
        appValue = parsed.value;
      }
      if (appValue !== null) {
        const p = analyte.plausible;
        if (parsed.censor === null && p !== null && !(appValue >= p[0] && appValue <= p[1])) {
          issues.push({ kind: 'implausible', name: analyte.name });
        }
        if (analyte.misread && misreadApplies(analyte.misread, appValue)) {
          issues.push({ kind: 'scoreMisread', message: analyte.misread.message });
        }
      }
      if (parsed.censor !== null) {
        issues.push({ kind: 'censored', reading: trimChars(storedValue, '<>=≤≥ ') });
      }
      if (parsed.value < 0) issues.push({ kind: 'negative' });
    } else {
      issues.push({ kind: 'nonNumeric' });
    }
  } else {
    issues.push({ kind: 'unmapped' });
    const who = readers(name);
    if (who.length > 0) issues.push({ kind: 'readAsOther', readers: who });
    if (parsed !== null && parsed.value < 0 && who.length > 0) issues.push({ kind: 'negative' });
  }
  if (specimen === 'urine') issues.push({ kind: 'urine' });

  return {
    number: parsed?.value ?? null,
    censor: parsed?.censor ?? null,
    storedValue, storedUnit, conversionNote,
    abnormality: labAbnormality(parsed?.value ?? null, referenceRange, flag),
    issues,
  };
}

const RANGE_TWO_RE = /([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)\s*(?:-|to)\s*([+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)/i;
const RANGE_ONE_RE = /(<=|>=|<|>|≤|≥|up\s+to|less\s+than|greater\s+than)\s*(\d+(?:\.\d+)?)/i;

/** From the printed flag first, else by comparing the printed value with the printed range. */
export function labAbnormality(value: number | null, range: string, flag: string): LabAbnormality {
  const f = trimChars(flag, '()[] ').toUpperCase();
  switch (f) {
    case 'H': case 'HH': case 'HI': case 'HIGH': case '↑': return 'high';
    case 'L': case 'LL': case 'LO': case 'LOW': case '↓': return 'low';
    case 'A': case 'ABN': case 'ABNORMAL': case '*': case '**': case 'C': case 'CRIT': case 'CRITICAL': case '!': case '+':
      return 'abnormal';
    case 'N': case 'NORMAL': return 'normal';
    default: break;
  }
  if (value === null) return 'unknown';
  const rangeNumber = (s: string): number | null => {
    const n = Number(s.split(',').join('').split('+').join(''));
    return Number.isFinite(n) && s.trim() !== '' ? n : null;
  };
  const two = RANGE_TWO_RE.exec(range);
  if (two) {
    const lo = rangeNumber(two[1]);
    const hi = rangeNumber(two[2]);
    if (lo !== null && hi !== null && lo <= hi) {
      if (value < lo) return 'low';
      if (value > hi) return 'high';
      return 'normal';
    }
  }
  const one = RANGE_ONE_RE.exec(range);
  if (one) {
    const limit = rangeNumber(one[2]);
    if (limit !== null) {
      const op = one[1].toLowerCase();
      if (op.startsWith('<') || op === '≤' || op.startsWith('up') || op.startsWith('less')) {
        return value > limit ? 'high' : 'normal';
      }
      return value < limit ? 'low' : 'normal';
    }
  }
  return 'unknown';
}
