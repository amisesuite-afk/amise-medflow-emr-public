/**
 * Where a reviewed lab / imaging import is written on the web, in the formats the dashboard's own
 * readers already use. Pure: builds the payloads; `ReportImportPanel` performs the writes (only
 * after the clinician taps Save).
 *
 * Lab report →
 *   1. one `investigation_results` row (status 'resulted', multi-analyte `analytes` JSONB — the
 *      same shape `saveLabPanel()` writes and the Results inbox renders), linked to the PDF
 *      document, with collection / report time, lab number and provenance. This is the durable
 *      record (Migration 1 table; no schema change).
 *   2. this consultation's `investigationResults` (name → "value unit · ref …"), read by CDS,
 *      clinical prompts, the critical-result banner and the lab interpretation panel. Names that
 *      those substring readers would read as ANOTHER analyte are left out (still in the report).
 *   3. this encounter's `extractedLabs` (the scores' numeric inputs, ClinicalScoresPanel /
 *      clinical-scores.ts), converted to the units that module documents (Hb g/L, …), only for
 *      rows whose unit was confirmed; persisted by the existing clinical_scores autosave
 *      (trackedSave descriptor + outbox executor already in place).
 * Imaging report → one `imaging_orders` row (status 'reported', report_text = Impression /
 *   Findings / Clinical history), linked to the PDF.
 */
import {
  ECT_OFFSET_MINUTES, analyteForKey, displayedRange, imagingInvestigationName, imagingResultText,
  includedLabRows, labRowAssessment, labRowSavedName, normaliseUnit, numberFromValueText, savedFlag,
  storedValueWithUnit, validatedPortalLink, abnormalityIsAbnormal, type ExistingResult,
  type ImagingImportDraft, type ImagingModality, type LabImportDraft, type LabImportRow,
  type LabRowAssessment, type NameReaders,
} from '@workspace/triage-engine/report-import';
import { webMisreaders } from './lab-reader-keywords';
import { hasRole } from './roles';
import type { UserRole } from './supabase';

// ── Critical values (iOS LabPanel.hasCriticalValues thresholds, app units) ──────────────────

const TROPONIN_KEYS = new Set(['troponinI', 'troponinT', 'troponin']);

/** A value in the app unit that meets a pre-operative critical threshold (same as iOS). */
export function isCriticalLabValue(analyteKey: string | null, value: number): boolean {
  switch (analyteKey) {
    case 'haemoglobin': return value < 8.0;
    case 'platelets': return value < 50;
    case 'creatinine': return value > 300;
    case 'inr': return value > 2.5;
    case 'sodium': return value < 120 || value > 155;
    case 'potassium': return value < 2.5 || value > 6.0;
    case 'lactate': return value >= 4.0;
    case 'glucose': return value < 3.0 || value > 20.0;
    case 'calcium': return value < 1.75 || value > 3.0;
    default: return analyteKey !== null && TROPONIN_KEYS.has(analyteKey) && value > 52;
  }
}

const CRITICAL_FLAGS = new Set(['C', 'CRIT', 'CRITICAL']);

/** The row's saved value is critical (threshold on the stored value, or a printed critical flag). */
export function rowIsCritical(row: LabImportRow, a: LabRowAssessment): boolean {
  if (CRITICAL_FLAGS.has(row.flag.trim().toUpperCase())) return true;
  const n = numberFromValueText(a.storedValue);
  return n !== null && isCriticalLabValue(row.analyteKey, n.value);
}

// ── Score inputs (extractedLabs) ────────────────────────────────────────────────────────────

/**
 * Catalogue analyte → ExtractedLabs key (clinical-scores.ts), with the factor from the
 * catalogue's app unit to the unit that module documents. `requireUnit`: for analytes stored as
 * reported, the printed (normalised) unit that must be present.
 */
const EXTRACTED_LAB_MAP: Record<string, { key: string; factor: number; requireUnit?: string }> = {
  wbc: { key: 'wbc', factor: 1 },
  haemoglobin: { key: 'haemoglobin', factor: 10 },     // g/dL → g/L (ExtractedLabs.haemoglobin is g/L)
  platelets: { key: 'platelets', factor: 1 },
  inr: { key: 'inr', factor: 1 },
  crp: { key: 'crp', factor: 1 },
  bilirubin: { key: 'bilirubin_total', factor: 1 },
  bilirubinDirect: { key: 'bilirubin_direct', factor: 1, requireUnit: 'umol/l' },
  alp: { key: 'alp', factor: 1 },
  ggt: { key: 'ggt', factor: 1, requireUnit: 'u/l' },
  ast: { key: 'ast', factor: 1 },
  alt: { key: 'alt', factor: 1 },
  albumin: { key: 'albumin', factor: 1 },
  sodium: { key: 'sodium', factor: 1 },
  potassium: { key: 'potassium', factor: 1 },
  urea: { key: 'urea', factor: 1 },
  bun: { key: 'urea', factor: 1 },
  creatinine: { key: 'creatinine', factor: 1 },
  egfr: { key: 'egfr', factor: 1 },
  glucose: { key: 'glucose', factor: 1 },
  amylase: { key: 'amylase', factor: 1 },
  lipase: { key: 'lipase', factor: 1 },
  ldh: { key: 'ldh', factor: 1 },
  calcium: { key: 'calcium', factor: 1 },
  // Not mapped: HbA1c (ExtractedLabs expects IFCC mmol/mol; % → mmol/mol has no exact factor),
  // haematocrit, tumour markers (no score reads them from here).
};

const UNIT_ISSUES = new Set(['unitMissing', 'unitAmbiguous', 'unitUnexpected', 'nonNumeric', 'implausible']);

/** The ExtractedLabs entry for a row, or null when the row must not feed the scores. */
export function extractedLabFor(row: LabImportRow, a: LabRowAssessment): { key: string; value: number } | null {
  if (row.specimen !== 'blood' || row.analyteKey === null) return null;
  const map = EXTRACTED_LAB_MAP[row.analyteKey];
  if (!map) return null;
  if (a.issues.some(i => UNIT_ISSUES.has(i.kind))) return null;
  if (map.requireUnit !== undefined && normaliseUnit(row.unit) !== map.requireUnit) return null;
  const n = numberFromValueText(a.storedValue);
  if (n === null || n.value < 0) return null;
  const value = Math.round(n.value * map.factor * 10_000) / 10_000;
  return { key: map.key, value };
}

// ── Lab report ──────────────────────────────────────────────────────────────────────────────

export interface ImportedAnalyte {
  name: string;
  value: string;
  unit: string;
  ref: string;
  abnormal: boolean;
  critical: boolean;
  flag: string;
  specimen: string;
  /** "converted from 212 mg/dL" */
  note?: string;
  /** The label as printed, when it differs from the saved name. */
  printed_as?: string;
  comment?: string;
}

export interface InvestigationResultInsert {
  patient_id: string;
  encounter_id: string | null;
  test_name: string;
  test_category: 'haematology' | 'biochemistry' | 'urine' | 'other';
  specimen_type: string;
  collected_at: string;
  reported_at: string | null;
  performing_lab: string;
  analytes: ImportedAnalyte[];
  is_abnormal: boolean;
  is_critical: boolean;
  status: 'resulted';
  linked_document_id: string | null;
  notes: string;
}

export interface LabImportSave {
  row: InvestigationResultInsert;
  /** name → "value unit · ref …" for this consultation's investigationResults. */
  sessionResults: Record<string, string>;
  /** Kept out of the consultation's results because a reader would take them for another analyte. */
  keptOutOfSession: { name: string; readers: string[] }[];
  /** ExtractedLabs keys → numbers (score units). */
  scoreInputs: Record<string, number>;
  count: number;
}

const HAEMATOLOGY_KEYS = new Set([
  'wbc', 'haemoglobin', 'platelets', 'neutrophils', 'lymphocytes', 'monocytes', 'eosinophils',
  'basophils', 'haematocrit', 'rbc', 'mcv', 'mch', 'mchc', 'rdw', 'esr', 'inr', 'pt', 'aptt',
  'fibrinogen', 'dDimer',
]);

function categoryFor(rows: LabImportRow[]): InvestigationResultInsert['test_category'] {
  if (rows.length > 0 && rows.every(r => r.specimen === 'urine')) return 'urine';
  if (rows.some(r => r.specimen !== 'blood')) return 'other';
  const keyed = rows.map(r => r.analyteKey);
  if (keyed.length > 0 && keyed.every(k => k !== null && HAEMATOLOGY_KEYS.has(k))) return 'haematology';
  if (keyed.length > 0 && keyed.every(k => k !== null && !HAEMATOLOGY_KEYS.has(k))) return 'biochemistry';
  return 'other';
}

/** Value text for the consultation's results: what the readers read first, no free text. */
export function sessionValueText(row: LabImportRow, a: LabRowAssessment): string {
  const parts = [storedValueWithUnit(a)];
  const range = displayedRange(row, a);
  if (range !== null) parts.push(`ref ${range}`);
  const flag = savedFlag(row, a);
  if (flag !== null) parts.push(flag);
  if (a.conversionNote !== null) parts.push(a.conversionNote);
  return parts.join(' · ');
}

export function buildLabImportSave(input: {
  draft: LabImportDraft;
  readers: NameReaders;
  patientId: string;
  encounterId: string | null;
  source: string;
  documentId: string | null;
}): LabImportSave {
  const { draft, readers, patientId, encounterId, source, documentId } = input;
  const rows = includedLabRows(draft);
  const analytes: ImportedAnalyte[] = [];
  const sessionResults: Record<string, string> = {};
  const keptOutOfSession: { name: string; readers: string[] }[] = [];
  const scoreInputs: Record<string, number> = {};
  let anyAbnormal = false;
  let anyCritical = false;

  for (const row of rows) {
    const a = labRowAssessment(row, readers);
    const name = labRowSavedName(row);
    const flag = savedFlag(row, a);
    const critical = rowIsCritical(row, a);
    const abnormal = abnormalityIsAbnormal(a.abnormality) || critical;
    anyAbnormal ||= abnormal;
    anyCritical ||= critical;
    const analyte: ImportedAnalyte = {
      name,
      value: a.storedValue,
      unit: a.storedUnit,
      ref: displayedRange(row, a) ?? '',
      abnormal,
      critical,
      flag: flag ?? '',
      specimen: row.specimen,
    };
    if (a.conversionNote !== null) analyte.note = a.conversionNote;
    const label = row.reportLabel.trim();
    if (label !== '' && label.toLowerCase() !== name.toLowerCase()) analyte.printed_as = label;
    if (row.comment.trim() !== '') analyte.comment = row.comment.trim();
    analytes.push(analyte);

    const mis = webMisreaders(row.analyteKey, name);
    if (mis.length > 0) keptOutOfSession.push({ name, readers: mis });
    else if (!(name in sessionResults)) sessionResults[name] = sessionValueText(row, a);

    const score = extractedLabFor(row, a);
    if (score && !(score.key in scoreInputs)) scoreInputs[score.key] = score.value;
  }

  const accession = draft.accession.trim();
  const collected = rows[0]?.collectedAt ?? draft.collectedAt;
  const specimens = [...new Set(rows.map(r => r.specimen))];
  return {
    row: {
      patient_id: patientId,
      encounter_id: encounterId,
      test_name: accession ? `Lab report ${accession}` : 'Lab report',
      test_category: categoryFor(rows),
      specimen_type: specimens.length === 1 ? specimens[0] : 'mixed',
      collected_at: new Date(collected).toISOString(),
      reported_at: draft.reportedAt !== null ? new Date(draft.reportedAt).toISOString() : null,
      performing_lab: 'Laboratory Services Ltd',
      analytes,
      is_abnormal: anyAbnormal,
      is_critical: anyCritical,
      status: 'resulted',
      linked_document_id: documentId,
      notes: [source, accession ? `Lab No ${accession}` : ''].filter(Boolean).join(' · '),
    },
    sessionResults,
    keptOutOfSession,
    scoreInputs,
    count: rows.length,
  };
}

/** Previously imported analytes of this patient, for the "already in the record" check. */
export function existingFromInvestigationRows(rows: Array<{
  status: string; collected_at: string | null; reported_at: string | null; created_at: string;
  analytes: Array<{ name?: unknown; value?: unknown; unit?: unknown }> | null;
}>): ExistingResult[] {
  const out: ExistingResult[] = [];
  for (const r of rows) {
    if (!Array.isArray(r.analytes)) continue;
    const at = Date.parse(r.collected_at ?? r.reported_at ?? r.created_at);
    if (!Number.isFinite(at)) continue;
    const resulted = r.status === 'resulted' || r.status === 'reviewed' || r.status === 'amended';
    for (const an of r.analytes) {
      if (typeof an?.name !== 'string' || typeof an.value !== 'string') continue;
      out.push({ name: an.name, resulted, at, result: `${an.value} ${typeof an.unit === 'string' ? an.unit : ''}`.trim() });
    }
  }
  return out;
}

// ── Imaging report ──────────────────────────────────────────────────────────────────────────

type OrderType = 'xray' | 'ultrasound' | 'ct' | 'mri' | 'pet' | 'mammogram' | 'dexa' | 'other';

/** imaging_orders.order_type (CHECK constraint values) for a modality. */
export function orderTypeFor(m: ImagingModality): OrderType {
  switch (m) {
    case 'xray': return 'xray';
    case 'ultrasound': return 'ultrasound';
    case 'ct': return 'ct';
    case 'mri': return 'mri';
    case 'pet': return 'pet';
    case 'mammography': return 'mammogram';
    case 'dexa': return 'dexa';
    default: return 'other';
  }
}

export interface ImagingOrderInsert {
  patient_id: string;
  encounter_id: string | null;
  order_type: OrderType;
  body_area: string;
  clinical_indication: string;
  status: 'reported';
  ordered_at: string;
  performed_at: string;
  performing_facility: string;
  report_received_at: string;
  report_text: string;
  linked_document_id: string | null;
  notes: string;
}

export function buildImagingImportSave(input: {
  draft: ImagingImportDraft;
  patientId: string;
  encounterId: string | null;
  source: string;
  sourceName: string;
  documentId: string | null;
  nowMs: number;
}): ImagingOrderInsert {
  const { draft, patientId, encounterId, source, sourceName, documentId, nowMs } = input;
  const name = imagingInvestigationName(draft.modality, draft.examTitle);
  const link = validatedPortalLink(draft);
  const accession = draft.accession.trim();
  const history = draft.clinicalHistory.trim();
  const exam = new Date(draft.examDate).toISOString();
  return {
    patient_id: patientId,
    encounter_id: encounterId,
    order_type: orderTypeFor(draft.modality),
    body_area: name,
    clinical_indication: history !== '' ? history : 'Imported report',
    status: 'reported',
    ordered_at: exam,
    performed_at: exam,
    performing_facility: sourceName,
    report_received_at: new Date(nowMs).toISOString(),
    report_text: imagingResultText(draft),
    linked_document_id: documentId,
    notes: [
      source,
      accession ? `Accession ${accession}` : '',
      link && link.ok ? `Portal: ${link.url}` : '',
    ].filter(Boolean).join(' · '),
  };
}

// ── Review rules (same as the iOS review screens) ───────────────────────────────────────────

/** Only a nurse, doctor or admin saves results; front desk may attach the PDF only. */
export function canSaveReportResults(role: UserRole | null | undefined): boolean {
  return hasRole(role, 'nurse');
}

export function labReviewCanSave(s: {
  identityNeedsConfirmation: boolean;
  identityConfirmed: boolean;
  canSaveResults: boolean;
  includedCount: number;
  needsCheckTick: boolean;
  flaggedChecked: boolean;
  hasPdf: boolean;
}): boolean {
  if (s.identityNeedsConfirmation && !s.identityConfirmed) return false;
  if (s.canSaveResults) {
    if (s.includedCount > 0 && s.needsCheckTick && !s.flaggedChecked) return false;
    return s.includedCount > 0 || s.hasPdf;
  }
  return s.hasPdf;
}

export function labSaveTitle(canSaveResults: boolean, includedCount: number): string {
  if (!canSaveResults || includedCount === 0) return 'Attach PDF';
  return includedCount === 1 ? 'Save 1 result' : `Save ${includedCount} results`;
}

export function imagingReviewCanSave(s: {
  identityNeedsConfirmation: boolean;
  identityConfirmed: boolean;
  canSaveReport: boolean;
  portalLinkInvalid: boolean;
  hasContent: boolean;
  hasPdf: boolean;
}): boolean {
  if (s.identityNeedsConfirmation && !s.identityConfirmed) return false;
  if (!s.canSaveReport) return s.hasPdf;
  if (s.portalLinkInvalid) return false;
  return s.hasContent || s.hasPdf;
}

export function imagingSaveTitle(canSaveReport: boolean): string {
  return canSaveReport ? 'Save imaging report' : 'Attach PDF';
}

// ── Dates on the review screen (Eastern Caribbean Time) ─────────────────────────────────────

/** ECT offset used for every date on the review screen. */
export const REPORT_IMPORT_OFFSET_MINUTES = ECT_OFFSET_MINUTES;

/** ms → "YYYY-MM-DDTHH:mm" for an <input type="datetime-local">, in ECT. */
export function toEctInputValue(ms: number): string {
  return new Date(ms + ECT_OFFSET_MINUTES * 60_000).toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" (ECT) → ms; null when incomplete. */
export function fromEctInputValue(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - ECT_OFFSET_MINUTES * 60_000;
}

/** "12 Sep 2026, 08:40" in ECT. */
export function formatEct(ms: number): string {
  const d = new Date(ms + ECT_OFFSET_MINUTES * 60_000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** `analyteForKey` re-exported for the review table. */
export { analyteForKey };
