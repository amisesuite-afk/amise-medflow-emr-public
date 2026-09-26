/**
 * Lab results feed — the format-independent shape both parsers (HL7 v2 ORU^R01, FHIR R4) produce.
 * Pure data: no PHI is logged from here; the route logs message ids and counts only.
 */

export type FeedFormat = 'hl7v2' | 'fhir-r4';

export type FeedSex = 'male' | 'female' | 'other' | 'unknown';

/** The patient exactly as the laboratory identified them (used for matching and reconciliation). */
export interface FeedPatientIdentity {
  /** The practice MRN (HL7 PID-3 with identifier type MR, or the only PID-3 identifier; FHIR
   *  Patient.identifier with type MR, or the only identifier). Trimmed, never altered. */
  mrn: string | null;
  familyName: string | null;
  givenName: string | null;
  /** YYYY-MM-DD */
  dob: string | null;
  sex: FeedSex | null;
}

/** One result line (HL7 OBX / FHIR Observation). */
export interface FeedObservation {
  /** LOINC code when the laboratory coded it with LOINC ("LN" / http://loinc.org). */
  loinc: string | null;
  /** The laboratory's own code, when not LOINC. */
  localCode: string | null;
  /** The printed label (OBX-3 text / Observation.code.text or display). */
  label: string;
  /** HL7 value type (NM, SN, ST, CE, CWE, TX, FT) or the FHIR value[x] kind. */
  valueType: string;
  /** Value as text, comparator included ("5.2", "<0.5", "Positive"). */
  valueText: string;
  unit: string;
  /** The laboratory's reference range as printed ("3.5-5.3", "<5"). */
  referenceRange: string;
  /** Abnormal flags as sent (HL7 table 0078 / FHIR interpretation codes): "H", "LL", "A"… */
  abnormalFlags: string[];
  /** Result status as sent (HL7 OBX-11 / FHIR Observation.status). */
  status: string | null;
  comments: string[];
  /** ISO timestamp of the observation, when given. */
  observedAt: string | null;
  /** Specimen as far as the message says ("blood", "urine", "other"); null = not stated. */
  specimen: 'blood' | 'urine' | 'other' | null;
}

export type FeedReportStatus = 'final' | 'corrected' | 'preliminary' | 'partial' | 'cancelled' | 'unknown';

/** One report (HL7 OBR group / FHIR DiagnosticReport). */
export interface FeedReport {
  /** The laboratory's report / accession id (HL7 OBR-3, else OBR-2; FHIR identifier, else id). */
  reportId: string | null;
  testName: string;
  status: FeedReportStatus;
  /** The status code as sent (for the idempotency key). */
  statusCode: string;
  collectedAt: string | null;
  reportedAt: string | null;
  performingLab: string | null;
  patient: FeedPatientIdentity;
  observations: FeedObservation[];
  comments: string[];
  specimen: 'blood' | 'urine' | 'other' | null;
}

export interface FeedMessage {
  format: FeedFormat;
  /** HL7 MSH-10 control id / FHIR Bundle.identifier.value, MessageHeader.id or Bundle.id. */
  messageId: string | null;
  sentAt: string | null;
  sendingApplication: string | null;
  sendingFacility: string | null;
  reports: FeedReport[];
}

/** A message the parser refuses. `code` is safe to log and to return (no PHI). */
export class FeedParseError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'FeedParseError';
  }
}

export const MAX_FEED_BYTES = 2 * 1024 * 1024;
export const MAX_REPORTS_PER_MESSAGE = 100;
export const MAX_OBSERVATIONS_PER_REPORT = 200;

/** "20260926083000-0400" / "202609260830" / "20260926" → ISO; null when unreadable. */
export function hl7DateTime(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})?(\d{2})?(?:\.\d+)?)?([+-]\d{4})?$/.exec(s);
  if (!m) return null;
  const [, y, mo, d, h = '00', mi = '00', se = '00', tz] = m;
  const month = Number(mo), day = Number(d), hour = Number(h), min = Number(mi), sec = Number(se);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || min > 59 || sec > 59) return null;
  // No zone: the laboratory is local (Eastern Caribbean Time, UTC-4, no DST).
  const zone = tz ? `${tz.slice(0, 3)}:${tz.slice(3)}` : '-04:00';
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${se}${zone}`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** "19700520" / "1970-05-20" → "1970-05-20"; null when not a real date. */
export function isoDateOnly(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim();
  const m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(s);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

export function feedSex(raw: string | null | undefined): FeedSex | null {
  const s = (raw ?? '').trim().toLowerCase();
  if (s === '') return null;
  if (s === 'm' || s === 'male') return 'male';
  if (s === 'f' || s === 'female') return 'female';
  if (s === 'o' || s === 'other' || s === 'a' || s === 'n') return 'other';
  return 'unknown';
}

/** Specimen from free text (test name, specimen description). */
export function specimenFromText(text: string | null | undefined): 'blood' | 'urine' | 'other' | null {
  const t = (text ?? '').toLowerCase();
  if (t === '') return null;
  if (/\burin/.test(t) || /\bmsu\b/.test(t)) return 'urine';
  if (/\b(csf|pleural|ascitic|peritoneal|synovial|drain|fluid|stool|faec|fec|sputum|swab)\b/.test(t)) return 'other';
  if (/\b(blood|serum|plasma|ser|plas|bld|wb)\b/.test(t)) return 'blood';
  return null;
}
