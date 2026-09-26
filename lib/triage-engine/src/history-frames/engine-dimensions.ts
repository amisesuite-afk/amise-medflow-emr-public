/**
 * What a chip's question (its iOS socratesSelections key) means to the iOS diagnosis engine.
 *
 * Every chip is stored under the key of the question it was chosen under (history frames, the
 * specialty "Quick Clinical Flags" early forms, the text parser's augments). The engine used to read
 * every chip's text alike, whatever the question: a "Coughing" chip chosen under "What makes it
 * worse?" counted as a cough, and an early-form chip under "exam", "pmh", "pshx", "social" or "inv"
 * never reached the examination, history or results features it was written for
 * (docs/clinical-validation/changes/followups-history.md).
 *
 *  - LABEL: in the text the "finding" features read (BayesianDiagnosisEngine.score findingText), a
 *    chip carries its question: "aggravating: Coughing", "associated: Fever", "radiation: Back". A
 *    cough mention after an aggravating / relieving label is the manoeuvre, not the symptom
 *    (cough-mention.ts); a "radiat…&back" finding now sees a radiation chip "Back". Labels were
 *    checked against every DiagnosticDatabase.json term (only "radiat" matches a label).
 *  - RECORD: chips under these keys are also read as that part of the record, so the engine's own
 *    features for it fire: "exam" chips as examination text, "pmh" / "history" chips as past history
 *    (and "history" also as social history: smoking), "pshx" as past surgery, "social" as social
 *    history, "inv" as a result line.
 *
 * Keys not listed (custom specialist keys such as "lucid_interval") keep their text as stored: their
 * own feature reads them by key. Stored values are unchanged (no migration); the Swift twin is
 * generated into HistoryFrameData.swift (chipLabels, chipRecordFields).
 */

export type RecordField = 'exam' | 'pmh' | 'pshx' | 'social' | 'inv';

export interface ChipEngineDimension {
  /** Written before the chip in the finding text: "<label>: <chip>". */
  label: string;
  /** Record fields the chip is also read as. */
  record?: RecordField[];
}

export const CHIP_ENGINE_DIMENSIONS: Record<string, ChipEngineDimension> = {
  onset: { label: 'onset' },
  site: { label: 'site' },
  character: { label: 'character' },
  radiation: { label: 'radiation' },
  associations: { label: 'associated' },
  timing: { label: 'timing' },
  exacerbating: { label: 'aggravating' },
  aggravating: { label: 'aggravating' },
  relieving: { label: 'relieving' },
  severity: { label: 'severity' },
  history: { label: 'history', record: ['pmh', 'social'] },
  exam: { label: 'examination', record: ['exam'] },
  pmh: { label: 'past history', record: ['pmh'] },
  pshx: { label: 'operative history', record: ['pshx'] },
  social: { label: 'social history', record: ['social'] },
  inv: { label: 'result', record: ['inv'] },
};

/** A chip as the finding features read it: "aggravating: Coughing" (unlisted keys: the value). */
export function chipFindingText(key: string, value: string): string {
  const d = CHIP_ENGINE_DIMENSIONS[key];
  return d ? `${d.label}: ${value}` : value;
}

/** Chip values read as `field` of the record (sorted by key, then value). */
export function chipRecordValues(selections: Record<string, Iterable<string>>, field: RecordField): string[] {
  const out: string[] = [];
  for (const key of Object.keys(selections).sort()) {
    if (!CHIP_ENGINE_DIMENSIONS[key]?.record?.includes(field)) continue;
    out.push(...[...selections[key]!].sort());
  }
  return out;
}
