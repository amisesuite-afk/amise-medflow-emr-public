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
  | 'allergies' | 'surgical_history' | 'toxic_habits' | 'pmh_notes' | 'lifestyle';

/** Sections stored against the encounter (read-only once it is closed). */
export const ENCOUNTER_SAVE_SECTIONS: readonly SaveSection[] = [
  'assessment', 'plan', 'medications', 'exam', 'ros', 'procedure_data', 'trauma',
  'hpi', 'investigations', 'encounter_type', 'inpatient', 'clinical_scores',
];

/** Sections stored against the patient (standing history). */
export const PATIENT_SAVE_SECTIONS: readonly SaveSection[] = [
  'allergies', 'surgical_history', 'toxic_habits', 'pmh_notes', 'lifestyle',
];

/**
 * Sections loadEncounterData reads. The lifestyle history has its own loader (AppContext, once
 * per patient, lifestyle-history-db.ts) and is marked "not loaded" there.
 */
export const RECORD_LOAD_SECTIONS: readonly SaveSection[] = ENCOUNTER_SAVE_SECTIONS.concat(
  PATIENT_SAVE_SECTIONS.filter(s => s !== 'lifestyle'),
);

export const ALL_SAVE_SECTIONS: readonly SaveSection[] = [...ENCOUNTER_SAVE_SECTIONS, ...PATIENT_SAVE_SECTIONS];

/** Label for the "Couldn't load" notice. */
export const SAVE_SECTION_LABEL: Record<SaveSection, string> = {
  assessment: 'Assessment', plan: 'Plan', medications: 'Medicines', exam: 'Examination',
  ros: 'Review of systems', procedure_data: 'Procedure notes', trauma: 'Trauma record',
  hpi: 'History of presenting illness', investigations: 'Investigation orders',
  encounter_type: 'Encounter type', inpatient: 'Admission details',
  clinical_scores: 'Scores and labs', allergies: 'Allergies',
  surgical_history: 'Surgical history', toxic_habits: 'Habits', pmh_notes: 'PMH / family history notes',
  lifestyle: 'Lifestyle history',
};

/** Outbox / trackedSave entity types → section (for the check when a debounced save fires). */
export const ENTITY_TYPE_SECTION: Record<string, SaveSection> = {
  assessment: 'assessment', plan: 'plan', medications: 'medications', exam_findings: 'exam',
  ros_findings: 'ros', procedure_data: 'procedure_data', trauma_record: 'trauma',
  hpi_note: 'hpi', hpi_note_clear: 'hpi', investigation_orders: 'investigations',
  encounter_type: 'encounter_type', inpatient_details: 'inpatient', clinical_scores: 'clinical_scores',
  allergies: 'allergies', surgical_history: 'surgical_history', toxic_habits: 'toxic_habits',
  pmh_notes: 'pmh_notes', lifestyle_history: 'lifestyle',
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

/** Stable text of a section's value (object keys sorted), for comparing with its baseline. */
export function fingerprint(value: unknown): string {
  return JSON.stringify(value ?? null, (_k, v: unknown) => (
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v
  ));
}

/** The AppContext values a section's autosave writes. */
export interface SectionState {
  assessment: string; differentials: string; icdCodes: string[]; cptCodes: string[];
  plan: string;
  medications: string[]; medicationsText: string;
  examFindings: Record<string, string[]>; examNotes: Record<string, string>;
  rosFindings: unknown; procedureData: unknown; traumaData: unknown;
  hpiNotes: string;
  orderedInvestigations: string[];
  /** toDbEncounterType(encounterType, encounterMode). */
  dbEncounterType: string;
  inpatient: Record<string, string>;
  clinicalScores: unknown; extractedLabs: unknown;
  allergies: string;
  surgicalHistory: string[]; surgicalNotes: string; recentSurgeryDate: string;
  toxicHabits: string[];
  pmhNotes: string; familyHistoryNotes: string;
  lifestyleHistory: unknown;
}

const allergenList = (text: string) => text.split(',').map(t => t.trim()).filter(Boolean);

/** A section's value as AppContext holds it (used for the baseline taken right after a load). */
export function sectionValueFromState(section: SaveSection, s: SectionState): unknown {
  switch (section) {
    case 'assessment': return [s.assessment, s.differentials, s.icdCodes, s.cptCodes];
    case 'plan': return s.plan;
    case 'medications': return [s.medications, s.medicationsText];
    case 'exam': return [s.examFindings, s.examNotes];
    case 'ros': return s.rosFindings;
    case 'procedure_data': return s.procedureData;
    case 'trauma': return s.traumaData;
    case 'hpi': return s.hpiNotes.trim() ? s.hpiNotes : '';
    case 'investigations': return s.orderedInvestigations;
    case 'encounter_type': return s.dbEncounterType;
    case 'inpatient': return s.inpatient;
    case 'clinical_scores': return [s.clinicalScores, s.extractedLabs];
    case 'allergies': return allergenList(s.allergies);
    case 'surgical_history': return [s.surgicalHistory, s.surgicalNotes, s.recentSurgeryDate];
    case 'toxic_habits': return s.toxicHabits;
    case 'pmh_notes': return [s.pmhNotes, s.familyHistoryNotes];
    case 'lifestyle': return s.lifestyleHistory;
  }
}

/**
 * The same value read from a trackedSave descriptor payload (the shape AppContext and
 * sync-executors.ts use), so the check when a debounced save fires compares like with like.
 */
export function sectionValueFromPayload(entityType: string, p: Record<string, unknown>): unknown {
  switch (entityType) {
    case 'assessment': return [p.diagnosis, p.differentials, p.icdCodes, p.cptCodes];
    case 'plan': return p.description;
    case 'medications': return [p.chipMeds, p.freeText];
    case 'exam_findings': return [p.examFindings, p.examNotes];
    case 'ros_findings': return p.rosFindings;
    case 'procedure_data': return p.procedureData;
    case 'trauma_record': return p.traumaData;
    case 'hpi_note': return typeof p.hpiNotes === 'string' && p.hpiNotes.trim() ? p.hpiNotes : '';
    case 'hpi_note_clear': return '';
    case 'investigation_orders': return p.orderedInvestigations;
    case 'encounter_type': return p.dbType;
    case 'inpatient_details': return p.data;
    case 'clinical_scores': return [p.clinicalScores, p.extractedLabs];
    case 'allergies': return p.allergens;
    case 'surgical_history': return [p.procedures, p.notes, p.recentSurgeryDate];
    case 'toxic_habits': return p.habits;
    case 'pmh_notes': return [p.pmhNotes, p.familyHistoryNotes];
    case 'lifestyle_history': return p.lifestyle;
    default: return p;
  }
}
