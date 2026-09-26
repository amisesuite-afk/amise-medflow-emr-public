// Deterministic parser for the text of an imaging report (Tapion Hospital imaging; OKEU or
// St Jude's the same way). TypeScript port of ios/AmiseMedFlow/Services/ImagingReportParser.swift.
// No structured values: it finds the patient header, accession/study number, exam date,
// modality and examination title, and splits the narrative into Findings and
// Impression/Conclusion. Images (DICOM) are never imported: they stay in the hospital portal.
//
// Also here: which kind of report a text is (lab or imaging), and the portal-link check (a pasted
// address is only ever opened in a new browser tab; never fetched, and never stored when it
// carries credentials).

import { parseReportHeader, type ReportHeader } from './header';
import { parseLabReport, splitReportLines } from './lab-parser';
import { letterCount, trimChars, trimWS, trimWSNL } from './swift-compat';

// MARK: - Modality

export type ImagingModality =
  | 'ultrasound' | 'ct' | 'mri' | 'xray' | 'fluoroscopy' | 'mammography' | 'nuclear' | 'pet' | 'dexa' | 'other';

export const IMAGING_MODALITIES: ImagingModality[] = [
  'ultrasound', 'ct', 'mri', 'xray', 'fluoroscopy', 'mammography', 'nuclear', 'pet', 'dexa', 'other',
];

/** Short label used in the saved investigation name ("US Abdomen", "CT Abdomen/Pelvis"). */
export function modalityShortLabel(m: ImagingModality): string {
  switch (m) {
    case 'ultrasound': return 'US';
    case 'ct': return 'CT';
    case 'mri': return 'MRI';
    case 'xray': return 'X-ray';
    case 'fluoroscopy': return 'Fluoroscopy';
    case 'mammography': return 'Mammography';
    case 'nuclear': return 'Nuclear medicine';
    case 'pet': return 'PET-CT';
    case 'dexa': return 'DEXA';
    case 'other': return 'Imaging';
  }
}

export function modalityDisplayName(m: ImagingModality): string {
  switch (m) {
    case 'ultrasound': return 'Ultrasound';
    case 'ct': return 'CT';
    case 'mri': return 'MRI / MRCP';
    case 'xray': return 'X-ray';
    case 'fluoroscopy': return 'Fluoroscopy / contrast study';
    case 'mammography': return 'Mammography';
    case 'nuclear': return 'Nuclear medicine';
    case 'pet': return 'PET-CT';
    case 'dexa': return 'DEXA';
    case 'other': return 'Other imaging';
  }
}

/**
 * (regex, modality) in priority order: the more specific test first. Short abbreviations that are
 * also ordinary words or titles ("US", "CT", "PET", "MR") only count in capitals.
 */
const MODALITY_PATTERNS: ReadonlyArray<[RegExp, ImagingModality]> = [
  [/\bPET(?:\s*[-/]?\s*CT)?\b/, 'pet'],
  [/positron\s+emission/i, 'pet'],
  [/mammo(?:gram|graphy)?\b|\btomosynthesis/i, 'mammography'],
  [/\bdexa\b|\bdxa\b|bone\s+densitometry/i, 'dexa'],
  [/\bmrcp\b|\bmri\b|\bmra\b|magnetic\s+resonance/i, 'mri'],
  [/\bMR\b/, 'mri'],
  [/\bCTA?\b|\bCECT\b|\bHRCT\b/, 'ct'],
  [/computed\s+tomography|\bcat\s+scan|\bct\s*-?\s*(?:scan|angiogra|abdomen|chest|head|brain|thorax|pelvis|urogra|colonogra|kub)/i, 'ct'],
  [/\bUSG?\b/, 'ultrasound'],
  [/ultraso(?:und|nography)|sonograph|\bdoppler\b|\beus\b|echograph|duplex/i, 'ultrasound'],
  [/fluoroscop|barium|(?:contrast|water-?soluble|gastrografin)\s+(?:swallow|meal|enema|study|follow)|cholangiogra(?:m|phy)|\bivu\b|urethrogra|fistulogra|sinogra|\bhsg\b/i, 'fluoroscopy'],
  [/scintigra|nuclear\s+medicine|\bhida\b|\bmibg\b|\bspect\b|isotope|bone\s+scan|\bmag3\b|\bdmsa\b/i, 'nuclear'],
  [/x-?ray|radiograph|\bcxr\b|\baxr\b|plain\s+film|\bkub\b|chest\s+(?:pa|ap)\b/i, 'xray'],
];

/** The modality named in `text`, if any. */
export function detectModality(text: string): ImagingModality | null {
  for (const [re, modality] of MODALITY_PATTERNS) if (re.test(text)) return modality;
  return null;
}

// MARK: - Parsed report

export interface ParsedImagingReport {
  header: ReportHeader;
  modality: ImagingModality | null;
  examTitle: string | null;
  clinicalHistory: string;
  technique: string;
  comparison: string;
  findings: string;
  impression: string;
  fullText: string;
}

export type ImagingSection = 'findings' | 'impression' | 'clinical' | 'technique' | 'comparison' | 'signature';

const HEADING_WORDS: ReadonlyArray<{ words: string[]; section: ImagingSection }> = [
  { words: ['final impression', 'impression', 'impressions', 'conclusion', 'conclusions', 'opinion',
    'summary', 'diagnosis', 'interpretation', "radiologist's impression",
    'radiologist impression', 'comment', 'comments'], section: 'impression' },
  { words: ['findings', 'finding', 'report', 'results', 'result', 'observations', 'description',
    'details'], section: 'findings' },
  { words: ['clinical history', 'clinical information', 'clinical details', 'clinical indication',
    'clinical data', 'clinical notes', 'clinical', 'indication', 'indications', 'history',
    'reason for exam', 'reason for study', 'reason for examination', 'reason for referral',
    'referral reason'], section: 'clinical' },
  { words: ['technique', 'protocol', 'method', 'procedure details', 'procedure'], section: 'technique' },
  { words: ['comparison', 'comparisons', 'prior studies', 'previous studies', 'prior', 'previous'], section: 'comparison' },
  { words: ['reported by', 'dictated by', 'electronically signed by', 'electronically signed',
    'signed by', 'verified by', 'transcribed by', 'radiologist', 'consultant radiologist',
    'reporting radiologist'], section: 'signature' },
];

/** (section, text after the heading on the same line) when `line` starts with a heading. */
export function imagingHeading(line: string): { section: ImagingSection; rest: string } | null {
  const trimmed = trimWS(line);
  const lower = trimmed.toLowerCase();
  let best: { section: ImagingSection; text: string; len: number } | null = null;
  for (const group of HEADING_WORDS) {
    for (const w of group.words) {
      if (!lower.startsWith(w)) continue;
      const after = trimmed.slice(w.length);
      const rest = trimWS(after);
      // Heading alone on its line, or followed by ":" / "-". A signature line ends the report
      // text with or without a colon.
      const isAlone = rest === '' || rest === ':' || rest === '-';
      const hasSeparator = after[0] === ':' || rest.startsWith(':') || rest.startsWith('- ');
      const isSignature = group.section === 'signature' && (after[0] === ' ' || isAlone || hasSeparator);
      if (!(isAlone || hasSeparator || isSignature)) continue;
      if (best === null || w.length > best.len) {
        const text = rest.replace(/^[:\- ]+/, '');
        best = { section: group.section, text, len: w.length };
      }
    }
  }
  return best ? { section: best.section, rest: best.text } : null;
}

const PAGE_LINE_RE = /^page\s+\d+(\s+of\s+\d+)?$/i;

export function parseImagingReport(text: string, nowMs: number = Date.now()): ParsedImagingReport {
  const lines = splitReportLines(text).map(l => l.text);
  const header = parseReportHeader(lines, nowMs);

  const buckets = new Map<ImagingSection, string[]>();
  const push = (s: ImagingSection, l: string) => { const b = buckets.get(s) ?? []; b.push(l); buckets.set(s, b); };
  let current: ImagingSection | null = null;
  const preamble: string[] = [];
  let examTitle = header.examTitle;

  lines.forEach((line, i) => {
    if (PAGE_LINE_RE.test(line)) return;
    const h = imagingHeading(line);
    if (h) {
      current = h.section;
      if (h.rest !== '') push(h.section, h.rest);
      return;
    }
    if (header.headerLineIndices.has(i)) return;
    if (line === '') {
      if (current !== null) push(current, '');
      return;
    }
    if (current !== null) push(current, line);
    else preamble.push(line);
  });

  // Title: the labelled exam, else the first early line that names a modality.
  if (examTitle === null) {
    examTitle = preamble.slice(0, 20).find(l =>
      detectModality(l) !== null && Array.from(l).length <= 100 && letterCount(l) >= 2) ?? null;
  }
  const titleText = examTitle ?? '';
  const modality = detectModality(titleText) ?? detectModality(preamble.slice(0, 25).join(' '));

  const sectionText = (s: ImagingSection) => joinParagraphs(buckets.get(s) ?? []);
  let findings = sectionText('findings');
  // No headings at all: the body is the findings.
  if (buckets.size === 0) findings = joinParagraphs(preamble.filter(l => l !== examTitle));

  return {
    header,
    modality,
    examTitle: examTitle === null ? null : cleanImagingTitle(examTitle),
    clinicalHistory: sectionText('clinical'),
    technique: sectionText('technique'),
    comparison: sectionText('comparison'),
    findings,
    impression: sectionText('impression'),
    fullText: trimWSNL(text),
  };
}

/** Lines joined into paragraphs (blank line = paragraph break), trimmed. */
export function joinParagraphs(lines: string[]): string {
  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const l of lines) {
    if (l === '') {
      if (current.length > 0) { paragraphs.push(current.join(' ')); current = []; }
    } else if (l.startsWith('-') || l.startsWith('•') || /^\d+[.)]\s/.test(l)) {
      if (current.length > 0) paragraphs.push(current.join(' '));
      current = [l];
    } else {
      current.push(l);
    }
  }
  if (current.length > 0) paragraphs.push(current.join(' '));
  return trimWSNL(paragraphs.join('\n'));
}

export function cleanImagingTitle(raw: string): string {
  const t = trimChars(raw, ' :-');
  const chars = Array.from(t);
  return chars.length > 100 ? chars.slice(0, 100).join('') : t;
}

/** The saved investigation name: "<modality> <exam>", without repeating the modality. */
export function imagingInvestigationName(modality: ImagingModality, exam: string): string {
  const e = trimWS(exam);
  if (e === '') return modalityShortLabel(modality) + ' report';
  if (detectModality(e) === modality) return e;
  return modalityShortLabel(modality) + ' ' + e;
}

// MARK: - Which kind of report

export type ReportKind = 'lab' | 'imaging';

/**
 * Imaging when the text has imaging headings (Findings / Impression / Conclusion) or names a
 * modality and has few lab rows; lab otherwise.
 */
export function guessReportKind(text: string, nowMs: number = Date.now()): ReportKind {
  const lines = splitReportLines(text).map(l => l.text);
  const headings = lines.map(l => imagingHeading(l)?.section).filter((s): s is ImagingSection => s !== undefined);
  const imagingHeadings = headings.filter(s => s === 'impression' || s === 'findings' || s === 'technique').length;
  const modality = detectModality(lines.slice(0, 30).join(' ')) !== null;
  const labRows = parseLabReport(text, nowMs).rows.filter(r => r.analyteKey !== null).length;
  let imagingScore = imagingHeadings * 2 + (modality ? 2 : 0);
  if (lines.some(l => l.toLowerCase().includes('radiolog'))) imagingScore += 1;
  if (labRows >= 3 && labRows * 2 >= imagingScore) return 'lab';
  if (imagingScore >= 3) return 'imaging';
  return labRows > 0 ? 'lab' : (imagingScore > 0 ? 'imaging' : 'lab');
}

// MARK: - Portal link

export type PortalLinkError = 'notALink' | 'notWeb' | 'containsCredentials';

export function portalLinkErrorMessage(e: PortalLinkError): string {
  switch (e) {
    case 'notALink': return 'This is not a web address.';
    case 'notWeb': return 'Only http(s) portal addresses can be saved.';
    case 'containsCredentials':
      return "This address contains a login or access token. Paste the study's address without it — MedFlow never stores portal credentials.";
  }
}

const CREDENTIAL_NAMES = new Set([
  'token', 'access_token', 'id_token', 'auth', 'authtoken', 'auth_token', 'session',
  'sessionid', 'session_id', 'sid', 'jsessionid', 'password', 'pass', 'pwd', 'passwd',
  'key', 'apikey', 'api_key', 'secret', 'sig', 'signature', 'jwt', 'otp', 'code', 'ticket',
  'user', 'username', 'login',
]);

function queryNames(query: string): string[] {
  const q = query.startsWith('?') ? query.slice(1) : query;
  if (q === '') return [];
  return q.split('&').filter(p => p !== '').map(p => {
    const name = p.split('=')[0];
    try { return decodeURIComponent(name.replace(/\+/g, ' ')).toLowerCase(); } catch { return name.toLowerCase(); }
  });
}

/**
 * A pasted portal address, checked: http(s), a host, no user:password@ and no credential-like
 * query or fragment parameters. Never fetched. Returns the address as pasted (trimmed).
 */
export function validatePortalLink(raw: string): { ok: true; url: string } | { ok: false; error: PortalLinkError } {
  const trimmed = trimWSNL(raw);
  if (trimmed === '' || trimmed.includes(' ')) return { ok: false, error: 'notALink' };
  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(trimmed);
  if (!scheme || /[\s<>"{}|\\^`]/.test(trimmed)) return { ok: false, error: 'notALink' };
  const s = scheme[1].toLowerCase();
  if (s !== 'https' && s !== 'http') return { ok: false, error: 'notWeb' };
  const afterScheme = trimmed.slice(scheme[0].length);
  if (!afterScheme.startsWith('//')) return { ok: false, error: 'notALink' };
  const rest = afterScheme.slice(2);
  const authorityEnd = rest.search(/[/?#]/);
  const authority = authorityEnd < 0 ? rest : rest.slice(0, authorityEnd);
  const at = authority.lastIndexOf('@');
  const hostPort = at >= 0 ? authority.slice(at + 1) : authority;
  const host = hostPort.startsWith('[') ? hostPort.slice(0, hostPort.indexOf(']') + 1) : hostPort.split(':')[0];
  if (host === '') return { ok: false, error: 'notALink' };
  if (at >= 0) return { ok: false, error: 'containsCredentials' };
  const tail = authorityEnd < 0 ? '' : rest.slice(authorityEnd);
  const hashAt = tail.indexOf('#');
  const beforeHash = hashAt < 0 ? tail : tail.slice(0, hashAt);
  const fragment = hashAt < 0 ? '' : tail.slice(hashAt + 1);
  const queryAt = beforeHash.indexOf('?');
  const query = queryAt < 0 ? '' : beforeHash.slice(queryAt + 1);
  const names = [...queryNames(query), ...queryNames(fragment)];
  if (names.some(n => CREDENTIAL_NAMES.has(n) || n.endsWith('token') || n.endsWith('password'))) {
    return { ok: false, error: 'containsCredentials' };
  }
  return { ok: true, url: trimmed };
}
