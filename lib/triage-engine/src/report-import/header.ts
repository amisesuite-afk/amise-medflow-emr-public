// Patient and report identifiers from the text of an imported lab or imaging report, and the
// check that the report belongs to the chart it is being filed to. TypeScript port of
// ios/AmiseMedFlow/Services/ReportHeaderParser.swift (same labels, same date rules, same
// identity check). Pure and deterministic: no network, no AI.
//
// Dates: day/month/year is assumed (Saint Lucia convention). When both numbers are 12 or less the
// date is marked ambiguous; the identity check then reports a DOB that only matches when read as
// month/day instead of silently accepting it.

import {
  foldCaseAndDiacritics, isLetter, isNumberChar, isPunctuation, isWhitespace,
  letterCount, trimChars, trimWS,
} from './swift-compat';

/** Eastern Caribbean Time (America/St_Lucia): UTC-4, no daylight saving. */
export const ECT_OFFSET_MINUTES = -240;
export const UTC_OFFSET_MINUTES = 0;

// MARK: - Dates

export interface ReportDate {
  year: number;
  month: number;
  day: number;
  hour: number | null;
  minute: number | null;
  /** Both day and month were 12 or less and different: the order was assumed (day first). */
  dayMonthAmbiguous: boolean;
}

export function reportDate(year: number, month: number, day: number, dayMonthAmbiguous = false): ReportDate {
  return { year, month, day, hour: null, minute: null, dayMonthAmbiguous };
}

/** The same date read the other way round (month/day), when that is also a valid date. */
export function swappedDate(d: ReportDate): ReportDate | null {
  if (!d.dayMonthAmbiguous) return null;
  const s: ReportDate = { ...d, month: d.day, day: d.month, dayMonthAmbiguous: false };
  return isValidDate(s.year, s.month, s.day) ? s : null;
}

/**
 * The instant (ms since epoch) in a fixed-offset time zone; a date without a time is taken as
 * 12:00 so it stays on the same calendar day in any nearby time zone.
 */
export function reportDateInstant(d: ReportDate, offsetMinutes: number): number {
  return Date.UTC(d.year, d.month - 1, d.day, d.hour ?? 12, d.minute ?? 0) - offsetMinutes * 60_000;
}

export function sameDay(a: { year: number; month: number; day: number }, b: { year: number; month: number; day: number }): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function isValidDate(year: number, month: number, day: number): boolean {
  if (!(month >= 1 && month <= 12) || day < 1 || year < 1850 || year > 2200) return false;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= days;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const ISO_RE = /(?<!\d)(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/;
const NUMERIC_RE = /(?<!\d)(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}|\d{2})(?!\d)/;
const DAY_MONTH_NAME_RE = /(?<!\d)(\d{1,2})(?:st|nd|rd|th)?[\s\-/.]+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[\s\-/.,]+(\d{4}|\d{2})(?!\d)/i;
const MONTH_NAME_DAY_RE = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?!\d)/i;
const TIME_RE = /(?<!\d)(\d{1,2})[:.](\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?(?![\d])/i;

/** Calendar year of `nowMs` in Eastern Caribbean Time. */
function currentYear(nowMs: number): number {
  return new Date(nowMs + ECT_OFFSET_MINUTES * 60_000).getUTCFullYear();
}

function fullYear(s: string, isBirthDate: boolean, nowMs: number): number {
  const v = Number.parseInt(s, 10);
  if (!Number.isFinite(v)) return 0;
  if (s.length !== 2) return v;
  const current = currentYear(nowMs) % 100;
  if (isBirthDate) return v > current ? 1900 + v : 2000 + v;
  return 2000 + v;
}

/**
 * The first date in `text`. `isBirthDate` picks the century of a two-digit year so the date is
 * not in the future (relative to `nowMs`); other two-digit years are 20xx.
 */
export function parseReportDate(text: string, isBirthDate = false, nowMs: number = Date.now()): ReportDate | null {
  const candidates: { location: number; date: ReportDate; end: number }[] = [];

  let m = ISO_RE.exec(text);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (isValidDate(y, mo, d)) candidates.push({ location: m.index, date: reportDate(y, mo, d), end: m.index + m[0].length });
  }
  m = NUMERIC_RE.exec(text);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    const y = fullYear(m[3], isBirthDate, nowMs);
    let date: ReportDate | null = null;
    if (a > 12 && isValidDate(y, b, a)) date = reportDate(y, b, a);
    else if (b > 12 && isValidDate(y, a, b)) date = reportDate(y, a, b);          // month/day printed
    else if (isValidDate(y, b, a)) date = reportDate(y, b, a, a !== b);
    if (date) candidates.push({ location: m.index, date, end: m.index + m[0].length });
  }
  m = DAY_MONTH_NAME_RE.exec(text);
  if (m) {
    const d = Number(m[1]);
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo !== undefined) {
      const y = fullYear(m[3], isBirthDate, nowMs);
      if (isValidDate(y, mo, d)) candidates.push({ location: m.index, date: reportDate(y, mo, d), end: m.index + m[0].length });
    }
  }
  m = MONTH_NAME_DAY_RE.exec(text);
  if (m) {
    const mo = MONTHS[m[1].toLowerCase()];
    const d = Number(m[2]), y = Number(m[3]);
    if (mo !== undefined && isValidDate(y, mo, d)) {
      candidates.push({ location: m.index, date: reportDate(y, mo, d), end: m.index + m[0].length });
    }
  }

  if (candidates.length === 0) return null;
  let best = candidates[0];
  for (const c of candidates.slice(1)) if (c.location < best.location) best = c;
  const date: ReportDate = { ...best.date };

  // A time just after the date (the search window does not see past its own bounds).
  const tail = text.slice(best.end, best.end + Math.max(0, Math.min(text.length - best.end, 16)));
  const t = TIME_RE.exec(tail);
  if (t) {
    let h = Number(t[1]);
    const mi = Number(t[2]);
    if (t[3] !== undefined) {
      const ampm = t[3].toLowerCase();
      if (ampm.startsWith('p') && h < 12) h += 12;
      if (ampm.startsWith('a') && h === 12) h = 0;
    }
    if (h >= 0 && h <= 23 && mi >= 0 && mi <= 59) {
      date.hour = h;
      date.minute = mi;
    }
  }
  return date;
}

// MARK: - Header

export type ReportSex = 'male' | 'female';

export interface ReportHeader {
  /** The first patient name printed. */
  patientName: string | null;
  /** Every distinct name printed (normalised); more than one means a mixed or wrong report. */
  allPatientNames: string[];
  dateOfBirth: ReportDate | null;
  ageYears: number | null;
  sex: ReportSex | null;
  accession: string | null;
  hospitalNumber: string | null;
  collected: ReportDate | null;
  received: ReportDate | null;
  reported: ReportDate | null;
  examDate: ReportDate | null;
  examTitle: string | null;
  /** Line indices (in the parsed line array) that held header labels. */
  headerLineIndices: Set<number>;
}

export function emptyReportHeader(): ReportHeader {
  return {
    patientName: null, allPatientNames: [], dateOfBirth: null, ageYears: null, sex: null,
    accession: null, hospitalNumber: null, collected: null, received: null, reported: null,
    examDate: null, examTitle: null, headerLineIndices: new Set(),
  };
}

export type ReportHeaderField =
  | 'name' | 'dob' | 'age' | 'ageSex' | 'sex' | 'accession' | 'hospitalNumber'
  | 'collected' | 'received' | 'reported' | 'examDate' | 'genericDate' | 'exam'
  | 'ignored';        // labels that only end the previous value (doctor, address, phone, ...)

/** (regex for the label, field, separator required) — same order as the iOS table. */
const LABEL_SPECS: ReadonlyArray<[string, ReportHeaderField, boolean]> = [
  ["patient'?s?\\s+name", 'name', false],
  ['pt\\.?\\s+name', 'name', false],
  ['name\\s+of\\s+patient', 'name', false],
  ['patient', 'name', true],
  ['name', 'name', true],
  ['date\\s+of\\s+birth', 'dob', false],
  ['birth\\s*date', 'dob', false],
  ['d\\.\\s?o\\.\\s?b\\.?', 'dob', false],
  ['dob', 'dob', false],
  ['age\\s*/\\s*sex', 'ageSex', false],
  ['age\\s*/\\s*gender', 'ageSex', false],
  ['sex\\s*/\\s*age', 'ageSex', false],
  ['age', 'age', true],
  ['sex', 'sex', true],
  ['gender', 'sex', true],
  ['lab(?:oratory)?\\s*(?:no|number|ref(?:erence)?|id|#)\\.?', 'accession', false],
  ['accession\\s*(?:no|number|#)?\\.?', 'accession', false],
  ['specimen\\s*(?:no|number|id)\\.?', 'accession', false],
  ['sample\\s*(?:no|number|id)\\.?', 'accession', false],
  ['request\\s*(?:no|number|id)\\.?', 'accession', false],
  ['episode\\s*(?:no|number)\\.?', 'accession', false],
  ['order\\s*(?:no|number)\\.?', 'accession', false],
  ['study\\s*(?:no|number|id)\\.?', 'accession', false],
  ['exam(?:ination)?\\s*(?:no|number|id)\\.?', 'accession', false],
  ['report\\s*(?:no|number|id)\\.?', 'accession', false],
  ['ref(?:erence)?\\s*(?:no|number)\\.?', 'accession', false],
  ['mrn', 'hospitalNumber', true],
  ['hospital\\s*(?:no|number)\\.?', 'hospitalNumber', false],
  ['patient\\s*id', 'hospitalNumber', false],
  ['chart\\s*(?:no|number)\\.?', 'hospitalNumber', false],
  ['(?:date\\s+)?(?:of\\s+)?collect(?:ed|ion)(?:\\s+date)?(?:\\s*/\\s*time)?', 'collected', true],
  ['sample\\s+date', 'collected', true],
  ['specimen\\s+(?:date|collected)', 'collected', true],
  ['drawn', 'collected', true],
  ['(?:date\\s+)?received(?:\\s+date)?', 'received', true],
  ['(?:date\\s+)?report(?:ed)?\\s*(?:date|on)?', 'reported', true],
  ['authori[sz]ed(?:\\s+on)?', 'reported', true],
  ['(?:date\\s+)?(?:verified|validated|released|printed)(?:\\s+on)?', 'reported', true],
  ['(?:exam(?:ination)?|study|scan|procedure)\\s+date', 'examDate', true],
  ['date\\s+of\\s+(?:exam(?:ination)?|study|scan|procedure)', 'examDate', true],
  ['date', 'genericDate', true],
  ['exam(?:ination)?(?:\\s+type)?', 'exam', true],
  ['study(?:\\s+type)?', 'exam', true],
  ['procedure', 'exam', true],
  ['(?:referring|requesting|ordering)\\s+(?:doctor|physician|clinician)', 'ignored', true],
  ['(?:doctor|physician|consultant|clinician|requested\\s+by|referred\\s+by|ordered\\s+by)', 'ignored', true],
  ['(?:tel(?:ephone)?|phone|fax|e-?mail|address|location|ward|clinic|source|insurance|page)', 'ignored', true],
];

/** The label table as written (for the parity lint). */
export const HEADER_LABEL_PATTERNS: ReadonlyArray<string> = LABEL_SPECS.map(s => s[0]);

const COMPILED: ReadonlyArray<{ re: RegExp; field: ReportHeaderField }> = LABEL_SPECS.map(([pattern, field, needsSeparator]) => {
  const sep = needsSeparator ? '\\s*[:#]' : '\\s*[:#.\\-]?';
  return { re: new RegExp(`(?<![A-Za-z0-9])(?:${pattern})(?![A-Za-z])${sep}`, 'gi'), field };
});

export interface LabelHit {
  location: number;
  end: number;
  field: ReportHeaderField;
}

/** Label occurrences in one line: overlaps resolved (earliest, then longest), in order. */
export function headerLabels(line: string): LabelHit[] {
  const hits: LabelHit[] = [];
  for (const spec of COMPILED) {
    for (const m of line.matchAll(spec.re)) {
      const location = m.index ?? 0;
      hits.push({ location, end: location + m[0].length, field: spec.field });
    }
  }
  hits.sort((x, y) => (x.location !== y.location ? x.location - y.location : y.end - x.end));
  const kept: LabelHit[] = [];
  for (const h of hits) {
    const last = kept[kept.length - 1];
    if (!last || h.location >= last.end) kept.push(h);
  }
  return kept;
}

/** (field, value) pairs of one line. */
export function headerFields(line: string): { field: ReportHeaderField; value: string }[] {
  const hits = headerLabels(line);
  const out: { field: ReportHeaderField; value: string }[] = [];
  hits.forEach((h, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].location : line.length;
    if (end < h.end) return;
    const raw = line.slice(h.end, end);
    out.push({ field: h.field, value: trimChars(raw, ' \t:#-|,;') });
  });
  return out;
}

export function parseReportHeader(lines: string[], nowMs: number = Date.now()): ReportHeader {
  const h = emptyReportHeader();
  const normalisedNames: string[] = [];
  lines.forEach((line, index) => {
    const pairs = headerFields(line);
    if (pairs.length === 0) return;
    let usedLine = false;
    for (const { field, value } of pairs) {
      switch (field) {
        case 'name': {
          const name = cleanName(value);
          if (name === null) continue;
          usedLine = true;
          if (h.patientName === null) h.patientName = name;
          const key = [...nameTokens(name)].sort().join(' ');
          if (key !== '' && !normalisedNames.includes(key)) {
            normalisedNames.push(key);
            h.allPatientNames.push(name);
          }
          break;
        }
        case 'dob':
          usedLine = true;
          if (h.dateOfBirth === null) h.dateOfBirth = parseReportDate(value, true, nowMs);
          if (h.ageYears === null) h.ageYears = ageIn(value, false);
          break;
        case 'age':
          usedLine = true;
          if (h.ageYears === null) h.ageYears = ageIn(value, true);
          break;
        case 'ageSex':
          usedLine = true;
          if (h.ageYears === null) h.ageYears = ageIn(value, true);
          if (h.sex === null) h.sex = sexIn(value);
          break;
        case 'sex':
          usedLine = true;
          if (h.sex === null) h.sex = sexIn(value);
          break;
        case 'accession':
          usedLine = true;
          if (h.accession === null) h.accession = identifier(value);
          break;
        case 'hospitalNumber':
          usedLine = true;
          if (h.hospitalNumber === null) h.hospitalNumber = identifier(value);
          break;
        case 'collected':
          usedLine = true;
          if (h.collected === null) h.collected = parseReportDate(value, false, nowMs);
          break;
        case 'received':
          usedLine = true;
          if (h.received === null) h.received = parseReportDate(value, false, nowMs);
          break;
        case 'reported':
          usedLine = true;
          if (h.reported === null) h.reported = parseReportDate(value, false, nowMs);
          break;
        case 'examDate':
        case 'genericDate':
          usedLine = true;
          if (h.examDate === null) h.examDate = parseReportDate(value, false, nowMs);
          break;
        case 'exam': {
          usedLine = true;
          const title = trimWS(value);
          const len = Array.from(title).length;
          if (h.examTitle === null && len >= 2 && len <= 120) h.examTitle = title;
          break;
        }
        case 'ignored':
          usedLine = true;
          break;
      }
    }
    if (usedLine) h.headerLineIndices.add(index);
  });
  return h;
}

// MARK: Value cleaning

/** A printed name without trailing age/sex/ids; null when it does not look like a name. */
export function cleanName(raw: string): string | null {
  // "DOE, JANE F 45Y" / "DOE, JANE M/45": a sex marker just before the age is not a name.
  let s = raw.replace(/[\s/]+(?:m|f|male|female)[\s/]*(?=\d)/gi, ' ');
  const chars = Array.from(s);
  const digit = chars.findIndex(isNumberChar);
  if (digit >= 0) s = chars.slice(0, digit).join('');
  s = s.replace(/\((?:m|f|male|female)\)/gi, '');
  s = s.replace(/\s+/g, ' ');
  s = trimChars(s, ' \t:#-|,;/(');
  if (letterCount(s) < 2 || Array.from(s).length > 80) return null;
  return s;
}

const AGE_WITH_UNIT_RE = /(?<!\d)(\d{1,3})\s*(?:y|yr|yrs|year|years)\b/;
const AGE_BARE_RE = /^\s*(\d{1,3})(?!\d)(?!\s*(?:m|mo|mth|months|d|days|w|wk|weeks)\b)/;

export function ageIn(raw: string, allowBare: boolean): number | null {
  const lower = raw.toLowerCase();
  let m = AGE_WITH_UNIT_RE.exec(lower);
  if (m) {
    const v = Number(m[1]);
    if (v < 130) return v;
  }
  if (!allowBare) return null;
  m = AGE_BARE_RE.exec(lower);
  if (m) {
    const v = Number(m[1]);
    if (v < 130) return v;
  }
  return null;
}

export function sexIn(raw: string): ReportSex | null {
  const tokens = raw.toLowerCase().split(/[^\p{L}\p{M}\p{N}]/u).filter(t => t.length > 0);
  for (const t of tokens) {
    const letters = Array.from(t).filter(isLetter).join('');
    if (['m', 'male', 'man'].includes(letters)) return 'male';
    if (['f', 'female', 'woman'].includes(letters)) return 'female';
  }
  return null;
}

export function identifier(raw: string): string | null {
  const token = raw.split(/[ \t]/).filter(p => p.length > 0)[0] ?? '';
  const cleaned = trimChars(token, ':#.,;|');
  const len = Array.from(cleaned).length;
  return len >= 2 && len <= 40 ? cleaned : null;
}

// MARK: - Identity check

export type NameResult =
  | { kind: 'exact' }
  /** Same person as far as the name goes, but not identical (middle name, initial, joined names). */
  | { kind: 'compatible'; note: string }
  | { kind: 'mismatch' }
  | { kind: 'missingInReport' };

export type DOBResult =
  | 'match'
  /** Matches only if the printed date is read month/day. */
  | 'matchesOnlyIfSwapped'
  | 'mismatch'
  | 'missingInReport'
  | 'missingInChart';

/** Does the report belong to this chart? Never auto-files: it only decides whether the clinician must confirm. */
export interface ReportIdentityCheck {
  name: NameResult;
  dob: DOBResult;
  sexMismatch: boolean;
  ageMismatch: boolean;
  multipleNamesInReport: boolean;
}

/** True when name and DOB both agree and nothing else conflicts. */
export function identityIsConsistent(c: ReportIdentityCheck): boolean {
  const nameOK = c.name.kind === 'exact' || c.name.kind === 'compatible';
  return nameOK && c.dob === 'match' && !c.sexMismatch && !c.ageMismatch && !c.multipleNamesInReport;
}

/** The clinician must tick "This report belongs to …" before anything is saved. */
export function identityRequiresConfirmation(c: ReportIdentityCheck): boolean {
  return !identityIsConsistent(c);
}

/** Plain-language reasons, most important first. */
export function identityMessages(c: ReportIdentityCheck): string[] {
  const out: string[] = [];
  if (c.multipleNamesInReport) out.push('The report contains more than one patient name.');
  switch (c.name.kind) {
    case 'mismatch': out.push('The name on the report does not match this chart.'); break;
    case 'missingInReport': out.push('No patient name was found on the report.'); break;
    case 'compatible': out.push(`Name is similar but not identical (${c.name.note}).`); break;
    case 'exact': break;
  }
  switch (c.dob) {
    case 'mismatch': out.push('The date of birth on the report does not match this chart.'); break;
    case 'matchesOnlyIfSwapped': out.push("The date of birth matches only if the report's date is read month/day — check it."); break;
    case 'missingInReport': out.push('No date of birth was found on the report.'); break;
    case 'missingInChart': out.push('This chart has no date of birth to compare.'); break;
    case 'match': break;
  }
  if (c.sexMismatch) out.push('The sex on the report does not match this chart.');
  if (c.ageMismatch) out.push('The age on the report does not match this chart.');
  return out;
}

const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'mstr', 'master', 'dr', 'prof', 'rev', 'mx']);

/**
 * Lowercased, accent-free name words without titles; apostrophes joined ("O'Neil" → "oneil"),
 * hyphens and punctuation split.
 */
export function nameTokens(name: string): string[] {
  const folded = foldCaseAndDiacritics(name).split("'").join('').split('’').join('').split('`').join('');
  return folded.split(/[^\p{L}\p{M}]/u).filter(t => t.length > 0 && !TITLES.has(t));
}

function joinedPairIndex(token: string, words: string[]): number | null {
  if (words.length < 2) return null;
  for (let i = 0; i < words.length - 1; i++) if (words[i] + words[i + 1] === token) return i;
  return null;
}

export function compareNames(report: string | null, chart: string): NameResult {
  if (report === null || nameTokens(report).length === 0) return { kind: 'missingInReport' };
  const a = nameTokens(report), b = nameTokens(chart);
  if (b.length === 0) return { kind: 'mismatch' };
  const sa = new Set(a), sb = new Set(b);
  if (sa.size === sb.size && [...sa].every(x => sb.has(x))) return { kind: 'exact' };
  if (a.join('') === b.join('')) return { kind: 'compatible', note: 'spacing or hyphen differs' };
  const [small, large] = a.length <= b.length ? [a, b] : [b, a];
  if (small.length < 2) return { kind: 'mismatch' };
  const remaining = [...large];
  let fullMatches = 0;
  let usedInitial = false;
  let usedJoin = false;
  for (const token of small) {
    const i = remaining.indexOf(token);
    if (i >= 0) { remaining.splice(i, 1); fullMatches++; continue; }
    const j = joinedPairIndex(token, remaining);
    if (j !== null) { remaining.splice(j, 2); fullMatches++; usedJoin = true; continue; }
    if (Array.from(token).length === 1) {
      const k = remaining.findIndex(w => w[0] === token[0]);
      if (k >= 0) { remaining.splice(k, 1); usedInitial = true; continue; }
    }
    const k2 = remaining.findIndex(w => Array.from(w).length === 1 && token[0] === w[0]);
    if (k2 >= 0) { remaining.splice(k2, 1); usedInitial = true; continue; }
    return { kind: 'mismatch' };
  }
  if (fullMatches < 1) return { kind: 'mismatch' };
  const notes: string[] = [];
  if (remaining.length > 0) notes.push('extra name on one side');
  if (usedInitial) notes.push('initial only');
  if (usedJoin) notes.push('joined names');
  return { kind: 'compatible', note: notes.length === 0 ? 'word order' : notes.join(', ') };
}

/** Shortest name search that is allowed (QuestionnairePatientSearch.minimumNameLength). */
export const MINIMUM_NAME_SEARCH_LENGTH = 3;

/**
 * Where a patient search starts for a report: the surname as printed ("DOE, JANE" → "DOE",
 * "Mr Jane Doe" → "Doe"), or the whole name when the surname is too short to search.
 * Staff still choose the patient themselves; nothing is selected automatically.
 */
export function searchSeed(reportName: string | null): string {
  const name = reportName === null ? '' : trimWS(reportName);
  if (name === '') return '';
  let surname: string;
  const comma = name.indexOf(',');
  if (comma >= 0) surname = name.slice(0, comma);
  else {
    const parts = name.split(' ').filter(p => p.length > 0);
    surname = parts[parts.length - 1] ?? name;
  }
  const trimmed = trimChars(surname, c => isWhitespace(c) || isPunctuation(c));
  return Array.from(trimmed).length >= MINIMUM_NAME_SEARCH_LENGTH ? trimmed : name;
}

export interface CalendarDay { year: number; month: number; day: number }

/**
 * A chart DOB stored as an instant, as calendar days in each fixed-offset time zone given (a DOB
 * saved at local midnight on one device may read as the previous day in UTC).
 */
export function chartDOBDays(dobMs: number, offsetsMinutes: number[]): CalendarDay[] {
  return offsetsMinutes.map(off => {
    const d = new Date(dobMs + off * 60_000);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  });
}

/** A "YYYY-MM-DD" chart DOB (the web dashboard's format) as a calendar day; null when absent or invalid. */
export function calendarDayFromISODate(s: string | null | undefined): CalendarDay | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((s ?? '').trim());
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  return isValidDate(y, mo, d) ? { year: y, month: mo, day: d } : null;
}

/** Whole years from a birth day to `nowMs` (Eastern Caribbean calendar). */
export function ageInYears(dob: CalendarDay, nowMs: number): number {
  const now = new Date(nowMs + ECT_OFFSET_MINUTES * 60_000);
  const y = now.getUTCFullYear(), m = now.getUTCMonth() + 1, d = now.getUTCDate();
  let age = y - dob.year;
  if (m < dob.month || (m === dob.month && d < dob.day)) age--;
  return age;
}

export type ChartSex = 'male' | 'female' | 'unspecified';

/**
 * `chartDOB`: the chart's date of birth as candidate calendar days (one for a date-only DOB;
 * one per time zone for an instant, see `chartDOBDays`); null or empty = the chart has none.
 */
export function checkReportIdentity(input: {
  header: ReportHeader;
  chartName: string;
  chartDOB: CalendarDay[] | null;
  chartSex: ChartSex;
  nowMs?: number;
}): ReportIdentityCheck {
  const { header, chartName, chartSex } = input;
  const nowMs = input.nowMs ?? Date.now();
  const days = input.chartDOB && input.chartDOB.length > 0 ? input.chartDOB : null;
  const name = compareNames(header.patientName, chartName);
  let dob: DOBResult;
  const reportDOB = header.dateOfBirth;
  if (reportDOB) {
    if (days) {
      if (days.some(d => sameDay(d, reportDOB))) dob = 'match';
      else {
        const swapped = swappedDate(reportDOB);
        dob = swapped && days.some(d => sameDay(d, swapped)) ? 'matchesOnlyIfSwapped' : 'mismatch';
      }
    } else {
      dob = 'missingInChart';
    }
  } else {
    dob = 'missingInReport';
  }
  const result: ReportIdentityCheck = {
    name, dob, sexMismatch: false, ageMismatch: false,
    multipleNamesInReport: header.allPatientNames.length > 1,
  };
  if (header.sex !== null && chartSex !== 'unspecified' && header.sex !== chartSex) result.sexMismatch = true;
  if (header.ageYears !== null && days) {
    const chartAge = ageInYears(days[0], nowMs);
    if (Math.abs(chartAge - header.ageYears) > 1) result.ageMismatch = true;
  }
  return result;
}

/** "14/03/1968" (dd/MM/yyyy). */
export function formatDOB(d: CalendarDay): string {
  return `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}/${String(d.year).padStart(4, '0')}`;
}
