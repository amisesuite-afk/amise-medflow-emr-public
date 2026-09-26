// Turns a reviewed lab or imaging import into platform-neutral result entries. TypeScript port of
// ios/AmiseMedFlow/Services/ReportImportBuilder.swift (the pure parts; each app writes the
// entries into its own store):
//   - each included lab row → an entry (Blood, Resulted) named so substring readers read it as
//     the right analyte, with `result` starting with the value ("106 µmol/L · ref 60-110 ·
//     converted from 1.2 mg/dL"), ordered/resulted = collection time;
//   - an imaging report → one Imaging entry with Impression and Findings, optional portal link;
//   - the PDF → a document, named without patient identifiers.
// Nothing is written until the clinician saves on the review screen.

import { analyteForKey, normaliseUnit, type NameReaders } from './catalog';
import {
  emptyReportHeader, reportDateInstant, type ReportHeader,
} from './header';
import {
  type ImagingModality, type ParsedImagingReport, imagingInvestigationName, validatePortalLink,
  type PortalLinkError,
} from './imaging-parser';
import {
  abnormalityIsAbnormal, abnormalityLabel, assessLabRow, assessmentExcludedByDefault,
  assessmentNeedsAttention, type LabRowAssessment, type LabSpecimen, type ParsedLabReport,
} from './lab-parser';
import { formatFixed, trimWS, trimWSNL } from './swift-compat';

export type ReportTextOrigin = 'pdfText' | 'ocr' | 'pasted' | 'none';

// MARK: - Existing results (duplicate check)

/** A result already in the record, as far as the duplicate check needs it. */
export interface ExistingResult {
  name: string;
  /** Only resulted entries count. */
  resulted: boolean;
  /** Resulted (or ordered) time, ms since epoch. */
  at: number;
  /** The saved result text; its first word is the value. */
  result: string;
}

/** Same test name, same first value token, same time (within a minute): already imported. */
export function isAlreadyRecorded(name: string, storedValue: string, at: number, existing: ExistingResult[]): boolean {
  const lower = name.toLowerCase();
  return existing.some(e => {
    if (!e.resulted || e.name.toLowerCase() !== lower) return false;
    if (Math.abs(e.at - at) >= 60_000) return false;
    const first = e.result.split(' ').filter(p => p.length > 0)[0];
    return first === storedValue;
  });
}

// MARK: - Lab draft

export interface LabImportRow {
  id: string;
  include: boolean;
  reportLabel: string;
  analyteKey: string | null;
  /** Saved name for an unmapped row (editable); mapped rows are saved under the catalogue name. */
  name: string;
  valueText: string;
  unit: string;
  referenceRange: string;
  flag: string;
  comment: string;
  /** Collection time, ms since epoch. */
  collectedAt: number;
  specimen: LabSpecimen;
  sourceLine: string;
}

const DIFFERENTIAL_KEYS = new Set(['neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils']);

/** The name this row is saved under. */
export function labRowSavedName(row: Pick<LabImportRow, 'analyteKey' | 'unit' | 'name'>): string {
  const an = analyteForKey(row.analyteKey);
  if (an) {
    if (DIFFERENTIAL_KEYS.has(an.key) && normaliseUnit(row.unit) === '%') return an.name + ' %';
    return an.name;
  }
  return trimWS(row.name);
}

export function labRowIsEmpty(row: LabImportRow): boolean {
  return labRowSavedName(row) === '' || trimWS(row.valueText) === '';
}

export function labRowAssessment(row: LabImportRow, readers: NameReaders, existing: ExistingResult[] = []): LabRowAssessment {
  const savedName = labRowSavedName(row);
  const a = assessLabRow({
    analyteKey: row.analyteKey, name: savedName, valueText: row.valueText, unit: row.unit,
    referenceRange: row.referenceRange, flag: row.flag, specimen: row.specimen,
  }, readers);
  if (isAlreadyRecorded(savedName, a.storedValue, row.collectedAt, existing)) {
    a.issues.push({ kind: 'alreadyInRecord' });
  }
  return a;
}

export interface LabImportDraft {
  rows: LabImportRow[];
  header: ReportHeader;
  collectedAt: number;
  reportedAt: number | null;
  accession: string;
  origin: ReportTextOrigin;
  layoutWarning: boolean;
  identityConfirmed: boolean;
  flaggedChecked: boolean;
}

let rowCounter = 0;
/** A row id unique within this page (no crypto needed: ids never leave the review screen). */
export function newRowId(): string {
  rowCounter += 1;
  return `row-${Date.now().toString(36)}-${rowCounter}`;
}

export function emptyLabImportRow(collectedAt: number): LabImportRow {
  return {
    id: newRowId(), include: true, reportLabel: '', analyteKey: null, name: '', valueText: '',
    unit: '', referenceRange: '', flag: '', comment: '', collectedAt, specimen: 'blood', sourceLine: '',
  };
}

export function makeLabImportDraft(input: {
  report: ParsedLabReport;
  origin: ReportTextOrigin;
  existing: ExistingResult[];
  nowMs: number;
  offsetMinutes: number;
  readers: NameReaders;
}): LabImportDraft {
  const { report, origin, existing, nowMs, offsetMinutes, readers } = input;
  const h = report.header;
  const when = h.collected ?? h.examDate ?? h.received ?? h.reported;
  const collected = when ? reportDateInstant(when, offsetMinutes) : nowMs;
  const rows = report.rows.map(r => {
    const row: LabImportRow = {
      id: newRowId(), include: true, reportLabel: r.reportLabel, analyteKey: r.analyteKey,
      name: r.reportLabel, valueText: r.valueText, unit: r.unit, referenceRange: r.referenceRange,
      flag: r.flag, comment: r.comment, collectedAt: collected, specimen: r.specimen, sourceLine: r.sourceLine,
    };
    row.include = !assessmentExcludedByDefault(labRowAssessment(row, readers, existing));
    return row;
  });
  return {
    rows, header: h, collectedAt: collected,
    reportedAt: h.reported ? reportDateInstant(h.reported, offsetMinutes) : null,
    accession: h.accession ?? '', origin, layoutWarning: report.layoutWarning,
    identityConfirmed: false, flaggedChecked: false,
  };
}

export function emptyLabImportDraft(nowMs: number, origin: ReportTextOrigin = 'none'): LabImportDraft {
  return {
    rows: [], header: emptyReportHeader(), collectedAt: nowMs, reportedAt: null, accession: '',
    origin, layoutWarning: false, identityConfirmed: false, flaggedChecked: false,
  };
}

/** Rows that will be saved. */
export function includedLabRows(draft: LabImportDraft): LabImportRow[] {
  return draft.rows.filter(r => r.include && !labRowIsEmpty(r));
}

/** Included rows that need the "I have checked the flagged values" tick. */
export function flaggedIncludedCount(draft: LabImportDraft, readers: NameReaders, existing: ExistingResult[]): number {
  return includedLabRows(draft).filter(r => assessmentNeedsAttention(labRowAssessment(r, readers, existing))).length;
}

// MARK: - Imaging draft

export type ImagingSourceChoice = 'tapion' | 'okeu' | 'stJudes' | 'other';

export const IMAGING_SOURCE_CHOICES: ImagingSourceChoice[] = ['tapion', 'okeu', 'stJudes', 'other'];

export function imagingSourceLabel(c: ImagingSourceChoice): string {
  switch (c) {
    case 'tapion': return 'Tapion Hospital imaging';
    case 'okeu': return 'OKEU Hospital imaging';
    case 'stJudes': return "St Jude's Hospital imaging";
    case 'other': return 'Other';
  }
}

export interface ImagingImportDraft {
  header: ReportHeader;
  modality: ImagingModality;
  examTitle: string;
  /** Exam time, ms since epoch. */
  examDate: number;
  accession: string;
  impression: string;
  findings: string;
  clinicalHistory: string;
  sourceChoice: ImagingSourceChoice;
  customSource: string;
  portalLink: string;
  origin: ReportTextOrigin;
  identityConfirmed: boolean;
  textChecked: boolean;
}

export function makeImagingImportDraft(input: {
  report: ParsedImagingReport;
  origin: ReportTextOrigin;
  sourceChoice: ImagingSourceChoice;
  customSource: string;
  nowMs: number;
  offsetMinutes: number;
}): ImagingImportDraft {
  const { report, origin, sourceChoice, customSource, nowMs, offsetMinutes } = input;
  const h = report.header;
  const when = h.examDate ?? h.collected ?? h.reported;
  const date = when ? reportDateInstant(when, offsetMinutes) : nowMs;
  let findings = report.findings;
  if (findings === '' && report.impression === '') findings = report.fullText;
  return {
    header: h, modality: report.modality ?? 'other', examTitle: report.examTitle ?? '',
    examDate: date, accession: h.accession ?? '', impression: report.impression,
    findings, clinicalHistory: report.clinicalHistory, sourceChoice, customSource,
    portalLink: '', origin, identityConfirmed: false, textChecked: false,
  };
}

export function imagingSourceName(d: Pick<ImagingImportDraft, 'sourceChoice' | 'customSource'>): string {
  const custom = trimWS(d.customSource);
  if (d.sourceChoice === 'other') return custom === '' ? 'Imaging provider' : custom;
  return imagingSourceLabel(d.sourceChoice);
}

/** null when no link was typed. */
export function validatedPortalLink(d: Pick<ImagingImportDraft, 'portalLink'>): { ok: true; url: string } | { ok: false; error: PortalLinkError } | null {
  const t = trimWSNL(d.portalLink);
  return t === '' ? null : validatePortalLink(t);
}

// MARK: - Builder (pure)

export const LAB_PROVIDER = 'Laboratory Services Ltd';

/** "(imported PDF)", "(pasted text)", "(scanned PDF, read on device)". */
export function provenance(origin: ReportTextOrigin, hasPDF: boolean): string {
  switch (origin) {
    case 'pdfText': return '(imported PDF)';
    case 'ocr': return '(scanned PDF, read on device)';
    case 'pasted': return hasPDF ? '(imported PDF, pasted text)' : '(pasted text)';
    case 'none': return hasPDF ? '(imported PDF, entered by hand)' : '(entered by hand)';
  }
}

export function labSource(origin: ReportTextOrigin, hasPDF: boolean): string {
  return `${LAB_PROVIDER} ${provenance(origin, hasPDF)}`;
}

export function imagingSource(d: Pick<ImagingImportDraft, 'sourceChoice' | 'customSource' | 'origin'>, hasPDF: boolean): string {
  return `${imagingSourceName(d)} ${provenance(d.origin, hasPDF)}`;
}

/**
 * The printed reference range; after a unit conversion it keeps the printed unit, so it is never
 * read against the converted value ("11.8 mmol/L · ref 70-99 mg/dL").
 */
export function displayedRange(row: Pick<LabImportRow, 'referenceRange' | 'unit'>, assessment: LabRowAssessment): string | null {
  const range = trimWS(row.referenceRange);
  if (range === '') return null;
  const unit = trimWS(row.unit);
  return assessment.conversionNote !== null && unit !== '' ? `${range} ${unit}` : range;
}

/** The value as saved: "11.8 mmol/L". */
export function storedValueWithUnit(assessment: LabRowAssessment): string {
  return trimWS(`${assessment.storedValue} ${assessment.storedUnit}`);
}

/** The printed flag, else High/Low/Abnormal from the range; null when neither. */
export function savedFlag(row: Pick<LabImportRow, 'flag'>, assessment: LabRowAssessment): string | null {
  const flag = trimWS(row.flag);
  if (flag !== '') return flag;
  return abnormalityIsAbnormal(assessment.abnormality) ? abnormalityLabel(assessment.abnormality) : null;
}

/**
 * The saved `result`: value first (what substring readers read), then range, flag, conversion,
 * comment and the label as printed.
 */
export function labResultText(row: LabImportRow, assessment: LabRowAssessment): string {
  const parts: string[] = [storedValueWithUnit(assessment)];
  const range = displayedRange(row, assessment);
  if (range !== null) parts.push(`ref ${range}`);
  const flag = savedFlag(row, assessment);
  if (flag !== null) parts.push(flag);
  if (assessment.conversionNote !== null) parts.push(assessment.conversionNote);
  const comment = trimWS(row.comment);
  if (comment !== '') parts.push(comment);
  const label = trimWS(row.reportLabel);
  if (label !== '' && label.toLowerCase() !== labRowSavedName(row).toLowerCase()) parts.push(`as printed: ${label}`);
  return parts.join(' · ');
}

export type ResultCategory = 'Blood' | 'Imaging' | 'Other';

/** A saved result, platform-neutral (iOS InvestigationEntry fields). */
export interface ImportedResultEntry {
  name: string;
  category: ResultCategory;
  status: 'Resulted';
  result: string;
  orderedAt: number;
  resultedAt: number;
  source: string;
  accession: string | null;
  referenceRange: string | null;
  flag: string | null;
  reportedAt: number | null;
  portalURL: string | null;
  documentId: string | null;
}

export function labEntry(input: {
  row: LabImportRow;
  readers: NameReaders;
  reportedAt: number | null;
  accession: string;
  source: string;
  documentId: string | null;
}): ImportedResultEntry {
  const { row, readers, reportedAt, accession, source, documentId } = input;
  const a = labRowAssessment(row, readers);
  const acc = trimWS(accession);
  return {
    name: labRowSavedName(row),
    category: row.specimen === 'blood' ? 'Blood' : 'Other',
    status: 'Resulted',
    result: labResultText(row, a),
    orderedAt: row.collectedAt,
    resultedAt: row.collectedAt,
    source,
    accession: acc === '' ? null : acc,
    referenceRange: displayedRange(row, a),
    flag: savedFlag(row, a),
    reportedAt,
    portalURL: null,
    documentId,
  };
}

export function labEntries(draft: LabImportDraft, readers: NameReaders, source: string, documentId: string | null): ImportedResultEntry[] {
  return includedLabRows(draft).map(row => labEntry({
    row, readers, reportedAt: draft.reportedAt, accession: draft.accession, source, documentId,
  }));
}

export function imagingResultText(d: Pick<ImagingImportDraft, 'impression' | 'findings' | 'clinicalHistory'>): string {
  const parts: string[] = [];
  const impression = trimWSNL(d.impression);
  const findings = trimWSNL(d.findings);
  const history = trimWSNL(d.clinicalHistory);
  if (impression !== '') parts.push(`Impression: ${impression}`);
  if (findings !== '') parts.push(`Findings: ${findings}`);
  if (history !== '') parts.push(`Clinical history: ${history}`);
  if (parts.length === 0) parts.push('See attached report.');
  return parts.join('\n\n');
}

export function imagingEntry(draft: ImagingImportDraft, source: string, documentId: string | null): ImportedResultEntry {
  const acc = trimWS(draft.accession);
  const link = validatedPortalLink(draft);
  return {
    name: imagingInvestigationName(draft.modality, draft.examTitle),
    category: 'Imaging',
    status: 'Resulted',
    result: imagingResultText(draft),
    orderedAt: draft.examDate,
    resultedAt: draft.examDate,
    source,
    accession: acc === '' ? null : acc,
    referenceRange: null,
    flag: null,
    reportedAt: null,
    portalURL: link && link.ok ? link.url : null,
    documentId,
  };
}

// MARK: - PDF file rules (IncomingReportStaging)

export const MAX_REPORT_PDF_BYTES = 25 * 1024 * 1024;

export type PdfRejection = { kind: 'notPDF' } | { kind: 'empty' } | { kind: 'tooLarge'; bytes: number };

export function pdfRejectionMessage(r: PdfRejection): string {
  switch (r.kind) {
    case 'notPDF': return 'Only PDF reports can be imported.';
    case 'empty': return 'The file is empty.';
    case 'tooLarge': {
      const mb = r.bytes / 1_048_576;
      return `The file is too large (${formatFixed(mb, 0)} MB; the limit is ${MAX_REPORT_PDF_BYTES / 1_048_576} MB).`;
    }
  }
}

/** A PDF starts with "%PDF-" within its first 1024 bytes. */
export function looksLikePDF(header: Uint8Array): boolean {
  const marker = [0x25, 0x50, 0x44, 0x46, 0x2d];
  const n = Math.min(header.length, 1024);
  outer: for (let i = 0; i + marker.length <= n; i++) {
    for (let j = 0; j < marker.length; j++) if (header[i + j] !== marker[j]) continue outer;
    return true;
  }
  return false;
}

function pathExtension(fileName: string): string {
  const base = fileName.split('/').pop() ?? fileName;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1) : '';
}

/** null when the file may be imported. */
export function validateReportPdf(fileName: string, byteCount: number, header: Uint8Array): PdfRejection | null {
  if (byteCount <= 0) return { kind: 'empty' };
  if (byteCount > MAX_REPORT_PDF_BYTES) return { kind: 'tooLarge', bytes: byteCount };
  const ext = pathExtension(fileName).toLowerCase();
  if (!(ext === 'pdf' || ext === '') || !looksLikePDF(header)) return { kind: 'notPDF' };
  return null;
}

/** Letters, digits, "-" and "_" only, at most 60 characters, without the extension. */
export function sanitisedDisplayName(original: string): string {
  const ext = pathExtension(original);
  const base = ext === '' ? original : original.slice(0, original.length - ext.length - 1);
  let out = '';
  for (const ch of base) {
    if (/^[A-Za-z0-9_-]$/.test(ch)) out += ch;
    else if (!out.endsWith('_')) out += '_';
  }
  out = out.replace(/^_+|_+$/g, '');
  if (out === '') out = 'report';
  return out.slice(0, 60);
}

/** PDF file name without patient identifiers: "LabResults_2026-09-12_LS-24-018832.pdf". */
export function documentFileName(prefix: string, dateMs: number, accession: string, offsetMinutes: number): string {
  const d = new Date(dateMs + offsetMinutes * 60_000);
  const ymd = `${String(d.getUTCFullYear()).padStart(4, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const suffix = trimWS(accession) === '' ? '' : `_${sanitisedDisplayName(accession)}`;
  return `${prefix}_${ymd}${suffix}.pdf`;
}
