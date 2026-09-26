/**
 * Lab feed → the investigation_results row the report import writes (multi-analyte `analytes`),
 * with abnormal / critical flags from the practice reference ranges.
 *
 * Mapping: LOINC first (loinc.ts), else the printed label through the catalogue's names and
 * synonyms. When LOINC and label point to different analytes neither is trusted (unmapped: the
 * value is kept under its printed label and no score reads it). Units go through the catalogue's
 * conversion rules (report-import `labRowAssessment`): an exact factor converts, an ambiguous or
 * unexpected unit is never converted and the result is flagged.
 *
 * Flags never downgrade the laboratory: abnormal = practice range says low/high OR the lab
 * flagged it abnormal; critical = practice critical limit OR the lab's critical flag (HH, LL, AA).
 */
import {
  abnormalityIsAbnormal, analyteForKey, displayedRange, labAbnormality, labRowAssessment, labRowSavedName,
  matchAnalyte, numberFromValueText,
  type LabImportRow, type LabRowIssue, type LabSpecimen,
} from '@workspace/triage-engine/report-import';
import {
  ageInYears, classifyAnalyte, type ReferenceRange,
} from '@workspace/triage-engine/reference-ranges';
import { analyteKeyForLoinc } from './loinc.js';
import type { FeedObservation, FeedReport } from './types.js';

/** Label words that may follow an analyte name without changing what it is. */
const HARMLESS_WORDS = new Set([
  'serum', 'plasma', 'blood', 'whole', 'venous', 'level', 'levels', 'total', 'conc', 'concentration',
  's', 'p', 'b', 'ser', 'plas', 'bld', 'wb', 'hs', 'high', 'sensitivity', 'sensitive', 'enzymatic', 'jaffe',
  'ifcc', 'ngsp', 'dcct', 'calculated', 'calc', 'auto', 'automated', 'count', 'abs', 'absolute', 'test',
  'result', 'value', 'random', 'cardiac', 'estimated', 'ckd', 'epi', 'mdrd', '2021', 'feu', 'lab',
  'x10', '9', 'l', 'ul', 'mmol', 'umol', 'mg', 'dl', 'g', 'u', 'iu', 'ng', 'ml', 'fasting', 'first',
]);

/** Families where the label is the generic name and the code the specific one. */
const COMPATIBLE: ReadonlyArray<[string, string]> = [
  ['troponin', 'troponinI'], ['troponin', 'troponinT'],
];

export interface ResolvedAnalyte {
  key: string | null;
  /** Why the analyte was not mapped, when it was not. */
  note: string | null;
}

/** The catalogue analyte a printed label names, with its qualifiers; null when not certain. */
export function analyteFromLabel(label: string, specimen: LabSpecimen): string | null {
  const m = matchAnalyte(label.trim());
  if (!m) return null;
  const rest = m.rest.toLowerCase();
  let key = m.key;
  const an = analyteForKey(key);
  if (an) {
    for (const remap of an.qualifierRemaps) {
      if (rest.includes(remap.word)) { key = remap.key; break; }
    }
  }
  if (/urin/.test(rest) || specimen !== 'blood') return null;
  const words = rest.split(/[^a-z0-9]+/).filter(Boolean);
  const remapWords = new Set((an?.qualifierRemaps ?? []).flatMap(r => r.word.split(/[^a-z0-9]+/)));
  if (words.some(w => !HARMLESS_WORDS.has(w) && !remapWords.has(w))) return null;
  return key;
}

export function resolveAnalyte(obs: Pick<FeedObservation, 'loinc' | 'label'>, specimen: LabSpecimen): ResolvedAnalyte {
  if (specimen !== 'blood') return { key: null, note: specimen === 'urine' ? 'Urine result: saved separately from the blood value.' : null };
  const byCode = analyteKeyForLoinc(obs.loinc);
  const byLabel = analyteFromLabel(obs.label, specimen);
  if (byCode && byLabel && byCode !== byLabel
      && !COMPATIBLE.some(([g, s]) => (byLabel === g && byCode === s) || (byLabel === s && byCode === g))) {
    return { key: null, note: `LOINC ${obs.loinc} and the label “${obs.label}” name different tests: not mapped.` };
  }
  return { key: byCode ?? byLabel, note: null };
}

/** Lab flags that mean "critical" (HL7 table 0078 / FHIR ObservationInterpretation). */
const CRITICAL_FLAGS = new Set(['HH', 'LL', 'AA', 'C', 'CRIT', 'CRITICAL', 'PANIC']);

function labFlag(flags: string[]): string {
  // The strongest flag first: a critical flag, then H/L, then A.
  const order = ['HH', 'LL', 'AA', 'H', 'L', 'HU', 'LU', 'A', '<', '>', 'N'];
  for (const f of order) if (flags.includes(f)) return f === 'HU' ? 'H' : f === 'LU' ? 'L' : f;
  return flags[0] ?? '';
}

export interface FeedAnalyte {
  /** Catalogue key; null when unmapped. */
  key: string | null;
  name: string;
  value: string;
  unit: string;
  ref: string;
  abnormal: boolean;
  critical: boolean;
  flag: string;
  specimen: string;
  note?: string;
  printed_as?: string;
  comment?: string;
  loinc?: string;
  /** The laboratory's own flag, as sent. */
  lab_flag?: string;
  /** The range the practice flags were computed from ("135–145 mmol/L · default"). */
  practice_range?: string;
  /** Unit / value problems (report-import issue kinds) for the reviewer. */
  issues?: string[];
}

export interface PatientContext {
  sex: string | null;
  dateOfBirth: string | null;
}

const UNIT_ISSUES = new Set<LabRowIssue['kind']>(['unitMissing', 'unitAmbiguous', 'unitUnexpected', 'nonNumeric', 'implausible']);

export function normaliseObservation(
  obs: FeedObservation,
  reportSpecimen: FeedReport['specimen'],
  collectedAt: string | null,
  practice: ReadonlyArray<ReferenceRange>,
  patient: PatientContext,
): FeedAnalyte {
  const specimen: LabSpecimen = (obs.specimen ?? reportSpecimen ?? 'blood') as LabSpecimen;
  const resolved = resolveAnalyte(obs, specimen);
  const labelled = specimen === 'urine' && !/urin/i.test(obs.label) ? `Urine ${obs.label}` : obs.label;
  const flag = labFlag(obs.abnormalFlags);
  const row: LabImportRow = {
    id: 'feed', include: true, reportLabel: obs.label, analyteKey: resolved.key, name: labelled,
    valueText: obs.valueText, unit: obs.unit, referenceRange: obs.referenceRange,
    flag: flag === 'N' ? '' : flag, comment: obs.comments.join(' '),
    collectedAt: Date.parse(obs.observedAt ?? collectedAt ?? '') || 0, specimen, sourceLine: '',
  };
  const a = labRowAssessment(row, () => []);
  const name = labRowSavedName(row);
  // The collection date in Eastern Caribbean Time (UTC-4), else today: age and effective date.
  const when = Date.parse(obs.observedAt ?? collectedAt ?? '');
  const onDate = new Date((Number.isFinite(when) ? when : Date.now()) - 4 * 3600_000).toISOString().slice(0, 10);
  const ctx = { sex: patient.sex, ageYears: ageInYears(patient.dateOfBirth, onDate), onDate };

  // The laboratory's own verdict (its flag, else its printed range).
  const labAbnormal = abnormalityIsAbnormal(labAbnormality(numberFromValueText(obs.valueText)?.value ?? null, obs.referenceRange, flag))
    || obs.abnormalFlags.some(f => f !== 'N' && f !== '');
  const labCritical = obs.abnormalFlags.some(f => CRITICAL_FLAGS.has(f));

  // The practice's verdict, only when the value was confirmed in a comparable unit.
  let practiceFlag: 'low' | 'high' | null = null;
  let practiceCritical = false;
  let practiceRange = '';
  const n = numberFromValueText(a.storedValue);
  const unitProblem = a.issues.some(i => UNIT_ISSUES.has(i.kind));
  if (n !== null && !unitProblem) {
    const c = classifyAnalyte(practice, name, n.value, a.storedUnit, ctx);
    if (c.range) {
      practiceFlag = c.flag === 'low' || c.flag === 'high' ? c.flag : null;
      practiceCritical = c.critical !== null;
      practiceRange = `${c.rangeText}${c.range.isDefault ? ' · default' : ` · ${c.range.labSource}`}`;
    }
  }
  const critical = labCritical || practiceCritical;
  const shownLabFlag = flag === 'N' ? '' : flag;
  const out: FeedAnalyte = {
    key: resolved.key,
    name,
    value: a.storedValue,
    unit: a.storedUnit,
    ref: displayedRange(row, a) ?? '',
    abnormal: labAbnormal || practiceFlag !== null || critical,
    critical,
    flag: shownLabFlag || (practiceCritical ? 'Critical' : practiceFlag === 'high' ? 'High' : practiceFlag === 'low' ? 'Low' : ''),
    specimen,
  };
  const notes = [a.conversionNote, resolved.note].filter((x): x is string => !!x);
  if (notes.length) out.note = notes.join(' · ');
  if (obs.label.trim().toLowerCase() !== name.toLowerCase()) out.printed_as = obs.label.trim();
  if (obs.comments.length) out.comment = obs.comments.join(' ').slice(0, 1000);
  if (obs.loinc) out.loinc = obs.loinc;
  if (obs.abnormalFlags.length) out.lab_flag = obs.abnormalFlags.join(',');
  if (practiceRange) out.practice_range = practiceRange;
  const issues = a.issues.filter(i => i.kind !== 'unmapped').map(i => i.kind);
  if (issues.length) out.issues = issues;
  return out;
}

const HAEMATOLOGY_KEYS = new Set([
  'wbc', 'haemoglobin', 'platelets', 'neutrophils', 'lymphocytes', 'monocytes', 'eosinophils',
  'basophils', 'haematocrit', 'rbc', 'mcv', 'mch', 'mchc', 'rdw', 'esr', 'inr', 'pt', 'aptt',
  'fibrinogen', 'dDimer',
]);
const CARDIAC_KEYS = new Set(['troponinI', 'troponinT', 'troponin', 'ck']);

type TestCategory = 'haematology' | 'biochemistry' | 'cardiac' | 'urine' | 'other';

export function testCategory(analytes: FeedAnalyte[]): TestCategory {
  if (analytes.length > 0 && analytes.every(x => x.specimen === 'urine')) return 'urine';
  if (analytes.some(x => x.specimen !== 'blood')) return 'other';
  const keys = analytes.map(x => x.key);
  if (keys.length === 0 || keys.some(k => k === null)) return 'other';
  if (keys.every(k => HAEMATOLOGY_KEYS.has(k!))) return 'haematology';
  if (keys.every(k => CARDIAC_KEYS.has(k!))) return 'cardiac';
  if (keys.every(k => !HAEMATOLOGY_KEYS.has(k!))) return 'biochemistry';
  return 'other';
}

export const LAB_FEED_SOURCE = 'lab-feed';
export const LAB_FEED_STATUS_TEXT = 'Received — awaiting clinician review';

export interface InvestigationResultFeedInsert {
  patient_id: string;
  encounter_id: null;
  test_name: string;
  test_category: TestCategory;
  specimen_type: string;
  collected_at: string | null;
  received_at: string;
  reported_at: string | null;
  performing_lab: string | null;
  analytes: FeedAnalyte[];
  is_abnormal: boolean;
  is_critical: boolean;
  status: 'resulted';
  notes: string;
  source: typeof LAB_FEED_SOURCE;
  lab_feed_message_id: string;
  lab_report_ref: string;
}

/** The investigation_results row for a matched report (status 'resulted' = awaiting review). */
export function buildResultRow(args: {
  report: Pick<FeedReport, 'testName' | 'status' | 'collectedAt' | 'reportedAt' | 'performingLab' | 'specimen' | 'comments' | 'reportId'> & {
    observations: FeedObservation[];
  };
  patientId: string;
  patient: PatientContext;
  practice: ReadonlyArray<ReferenceRange>;
  labId: string;
  messageRowId: string;
  reportRef: string;
  receivedAt: string;
}): InvestigationResultFeedInsert {
  const { report } = args;
  const analytes = report.observations.map(o => normaliseObservation(o, report.specimen, report.collectedAt, args.practice, args.patient));
  const specimens = [...new Set(analytes.map(x => x.specimen))];
  const statusNote = report.status === 'corrected' ? 'Corrected report' : report.status === 'preliminary' ? 'Preliminary report'
    : report.status === 'partial' ? 'Partial report' : '';
  return {
    patient_id: args.patientId,
    encounter_id: null,
    test_name: report.testName.slice(0, 200),
    test_category: testCategory(analytes),
    specimen_type: specimens.length === 1 ? specimens[0] : specimens.length === 0 ? 'blood' : 'mixed',
    collected_at: report.collectedAt,
    received_at: args.receivedAt,
    reported_at: report.reportedAt,
    performing_lab: report.performingLab,
    analytes,
    is_abnormal: analytes.some(x => x.abnormal),
    is_critical: analytes.some(x => x.critical),
    status: 'resulted',
    notes: [
      `${LAB_FEED_SOURCE} · ${args.labId}`,
      report.reportId ? `Report ${report.reportId}` : '',
      statusNote,
      LAB_FEED_STATUS_TEXT,
      ...report.comments.map(c => c.slice(0, 500)),
    ].filter(Boolean).join(' · ').slice(0, 4000),
    source: LAB_FEED_SOURCE,
    lab_feed_message_id: args.messageRowId,
    lab_report_ref: args.reportRef,
  };
}
