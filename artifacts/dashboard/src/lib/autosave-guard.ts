/**
 * When may AppContext autosave a section of the record?
 *
 * Two hazards this closes (both write the WRONG content into the right record):
 *
 *  1. A read that failed became an empty value, and autosave then wrote that empty value back —
 *     e.g. a failed `medications` read gave an empty list and `sync_medications_list` replaced the
 *     encounter's list with nothing; a failed `investigation_results` read deleted ordered tests.
 *     Also the window while a patient is being loaded (PatientSearchTab set the ids first and
 *     filled in the data seconds later): autosave saw empty state against the real ids.
 *  2. Autosave wrote into a closed (signed) encounter — loading a closed encounter re-saved it.
 *
 * Rules:
 *  - While a record is loading (`hydrating`), nothing is autosaved.
 *  - Encounter sections of a closed or cancelled encounter are never autosaved (read-only until it
 *    is reopened with the existing Reopen action, which sets the status back to open).
 *  - After a load, each loaded section has a baseline (its value as loaded). A section whose value
 *    still equals its baseline is not written: nothing changed, and for a section whose read
 *    FAILED ("not loaded") the value is not the record's content at all. The first change after
 *    the load is the clinician's edit: the section is written from then on (for a not-loaded
 *    section, the clinician has been shown "Couldn't load — retry" and chose to edit anyway).
 *  - A successful retry replaces a not-loaded section's baseline with the loaded value.
 *
 * Pure (no React) so it is unit-tested (src/lib/__tests__/autosave-guard.test.ts); AppContext
 * keeps one guard in a ref and calls checkAutosave() both when a save is scheduled and when it
 * fires.
 */

/** One autosave effect in AppContext (and one outbox entity family). */
export type SaveSection =
  | 'assessment' | 'plan' | 'medications' | 'exam' | 'ros' | 'procedure_data' | 'trauma'
  | 'hpi' | 'investigations' | 'encounter_type' | 'inpatient' | 'clinical_scores'
  | 'allergies' | 'surgical_history' | 'toxic_habits' | 'pmh_notes';

/** Sections stored against the encounter (read-only once it is closed). */
export const ENCOUNTER_SAVE_SECTIONS: readonly SaveSection[] = [
  'assessment', 'plan', 'medications', 'exam', 'ros', 'procedure_data', 'trauma',
  'hpi', 'investigations', 'encounter_type', 'inpatient', 'clinical_scores',
];

/** Sections stored against the patient (standing history). */
export const PATIENT_SAVE_SECTIONS: readonly SaveSection[] = [
  'allergies', 'surgical_history', 'toxic_habits', 'pmh_notes',
];

export const ALL_SAVE_SECTIONS: readonly SaveSection[] = [...ENCOUNTER_SAVE_SECTIONS, ...PATIENT_SAVE_SECTIONS];

/** Label for the "Couldn't load" notice. */
export const SAVE_SECTION_LABEL: Record<SaveSection, string> = {
  assessment: 'Assessment', plan: 'Plan', medications: 'Medicines', exam: 'Examination',
  ros: 'Review of systems', procedure_data: 'Procedure notes', trauma: 'Trauma record',
  hpi: 'History of presenting illness', investigations: 'Investigation orders',
  encounter_type: 'Encounter type', inpatient: 'Admission details',
  clinical_scores: 'Scores and labs', allergies: 'Allergies',
  surgical_history: 'Surgical history', toxic_habits: 'Habits', pmh_notes: 'PMH / family history notes',
};

/** Outbox / trackedSave entity types → section (for the check when a debounced save fires). */
export const ENTITY_TYPE_SECTION: Record<string, SaveSection> = {
  assessment: 'assessment', plan: 'plan', medications: 'medications', exam_findings: 'exam',
  ros_findings: 'ros', procedure_data: 'procedure_data', trauma_record: 'trauma',
  hpi_note: 'hpi', hpi_note_clear: 'hpi', investigation_orders: 'investigations',
  encounter_type: 'encounter_type', inpatient_details: 'inpatient', clinical_scores: 'clinical_scores',
  allergies: 'allergies', surgical_history: 'surgical_history', toxic_habits: 'toxic_habits',
  pmh_notes: 'pmh_notes',
};

export function isEncounterSection(section: SaveSection): boolean {
  return ENCOUNTER_SAVE_SECTIONS.includes(section);
}

/** Closed and cancelled encounters are read-only; open / in_progress / unknown are writable. */
export function isReadOnlyEncounterStatus(status: string | null | undefined): boolean {
  return status === 'closed' || status === 'cancelled';
}

export interface AutosaveGuard {
  /** A record load is in progress: nothing is autosaved. */
  hydrating: boolean;
  /** Incremented by every beginLoad()/reset(); a finish for an older load is ignored. */
  loadToken: number;
  /** Value of each loaded section as loaded (fingerprint), until it is first changed. */
  baseline: Partial<Record<SaveSection, string>>;
  /** Sections whose read failed — shown as "Couldn't load — retry". */
  notLoaded: Set<SaveSection>;
}

export function createAutosaveGuard(): AutosaveGuard {
  return { hydrating: false, loadToken: 0, baseline: {}, notLoaded: new Set() };
}

/** Forget everything (patient cleared). Any load still running is abandoned. */
export function resetGuard(g: AutosaveGuard): void {
  g.hydrating = false;
  g.loadToken++;
  g.baseline = {};
  g.notLoaded = new Set();
}

/** Forget baselines and failures for some sections (e.g. the encounter sections of a new encounter). */
export function clearSections(g: AutosaveGuard, sections: readonly SaveSection[]): void {
  for (const s of sections) { delete g.baseline[s]; g.notLoaded.delete(s); }
}

/** A record load starts: autosave pauses. Returns the token to pass to finishLoad(). */
export function beginLoad(g: AutosaveGuard): number {
  g.hydrating = true;
  return ++g.loadToken;
}

/**
 * The load `token` finished and its data is in state. `fingerprints` are the loaded sections'
 * values as now in state; `failed` are the sections whose read failed (their state was left as
 * it was). Returns false (and changes nothing) for a stale token.
 */
export function finishLoad(
  g: AutosaveGuard,
  token: number,
  loaded: readonly SaveSection[],
  failed: readonly SaveSection[],
  fingerprints: Partial<Record<SaveSection, string>>,
): boolean {
  if (token !== g.loadToken) return false;
  g.hydrating = false;
  const failedSet = new Set(failed);
  for (const s of loaded) {
    const fp = fingerprints[s];
    if (fp !== undefined) g.baseline[s] = fp;
    if (failedSet.has(s)) g.notLoaded.add(s);
    else g.notLoaded.delete(s);
  }
  return true;
}

export type AutosaveDecision =
  | { allow: true; unblocked: boolean }
  | { allow: false; reason: 'hydrating' | 'read_only' | 'unchanged_since_load' | 'not_loaded' };

/**
 * May `section`, now with value `fingerprint`, be written? `readOnly` is true when the write
 * targets a closed / cancelled encounter (encounter sections only). A value that differs from the
 * section's baseline is the clinician's edit: the baseline (and any "not loaded" mark) is dropped
 * and `unblocked` is true.
 */
export function checkAutosave(
  g: AutosaveGuard,
  input: { section: SaveSection; fingerprint: string; readOnly: boolean },
): AutosaveDecision {
  if (g.hydrating) return { allow: false, reason: 'hydrating' };
  if (input.readOnly && isEncounterSection(input.section)) return { allow: false, reason: 'read_only' };
  const base = g.baseline[input.section];
  if (base !== undefined) {
    if (base === input.fingerprint) {
      return { allow: false, reason: g.notLoaded.has(input.section) ? 'not_loaded' : 'unchanged_since_load' };
    }
    delete g.baseline[input.section];
    const wasNotLoaded = g.notLoaded.delete(input.section);
    return { allow: true, unblocked: wasNotLoaded };
  }
  return { allow: true, unblocked: false };
}

/** Stable text of a section's value, for comparing with its baseline. */
export function fingerprint(value: unknown): string {
  return JSON.stringify(value ?? null);
}
