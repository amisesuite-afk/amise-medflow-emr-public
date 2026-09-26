/**
 * A stored lab result (investigation_results row with `analytes`, e.g. one that arrived through
 * the laboratory feed) → this consultation's results and score inputs, in the same formats the
 * report import writes (report-import-save.ts), so What's missing, the decision layer and the
 * diagnostic reasoning read it through their existing path. Nothing here changes an engine.
 *
 * Used only on an explicit clinician tap ("Use in this consultation"), never automatically:
 * the row may belong to an earlier visit. Pure.
 *
 * Rules, as for an import:
 *   - the value is already in the catalogue app unit (converted when the result was received);
 *   - names a dashboard reader would take for ANOTHER analyte stay out of the consultation's
 *     results (lab-reader-keywords.ts), and are reported back;
 *   - score inputs only for blood rows whose unit was confirmed (extractedLabFor).
 */
import { analyteForKey, labRowAssessment, type LabImportRow, type LabSpecimen } from '@workspace/triage-engine/report-import';
import { webMisreaders } from './lab-reader-keywords';
import { extractedLabFor } from './report-import-save';

export interface StoredAnalyte {
  key?: unknown;
  name?: unknown;
  value?: unknown;
  unit?: unknown;
  ref?: unknown;
  flag?: unknown;
  specimen?: unknown;
  note?: unknown;
}

export interface SessionFromStored {
  sessionResults: Record<string, string>;
  keptOut: { name: string; readers: string[] }[];
  scoreInputs: Record<string, number>;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

/** Is this stored row from the laboratory feed (investigation_results.notes starts "lab-feed ·"). */
export function isLabFeedRow(row: { notes?: string | null }): boolean {
  return (row.notes ?? '').startsWith('lab-feed ·');
}

export function sessionFromStoredAnalytes(analytes: ReadonlyArray<StoredAnalyte> | null | undefined, collectedAtMs = 0): SessionFromStored {
  const out: SessionFromStored = { sessionResults: {}, keptOut: [], scoreInputs: {} };
  for (const a of analytes ?? []) {
    const name = str(a.name);
    const value = str(a.value);
    if (name === '' || value === '') continue;
    const key = typeof a.key === 'string' && analyteForKey(a.key) ? a.key : null;
    const specimen: LabSpecimen = a.specimen === 'urine' ? 'urine' : a.specimen === 'other' ? 'other' : 'blood';
    const unit = str(a.unit);
    const row: LabImportRow = {
      id: 'stored', include: true, reportLabel: name, analyteKey: key, name, valueText: value, unit,
      // The stored range may be in the printed unit: never re-read against the stored value.
      referenceRange: '', flag: str(a.flag), comment: '', collectedAt: collectedAtMs, specimen, sourceLine: '',
    };
    const mis = webMisreaders(key, name);
    if (mis.length > 0) out.keptOut.push({ name, readers: mis });
    else if (!(name in out.sessionResults)) {
      const parts = [`${value}${unit ? ` ${unit}` : ''}`];
      if (str(a.ref)) parts.push(`ref ${str(a.ref)}`);
      if (str(a.flag)) parts.push(str(a.flag));
      if (str(a.note)) parts.push(str(a.note));
      out.sessionResults[name] = parts.join(' · ');
    }
    const score = extractedLabFor(row, labRowAssessment(row, () => []));
    if (score && !(score.key in out.scoreInputs)) out.scoreInputs[score.key] = score.value;
  }
  return out;
}
