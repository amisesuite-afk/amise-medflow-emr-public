/**
 * Switching the consultation to another encounter of the SAME patient (Encounter history tab:
 * "+ New encounter" and "Load this encounter").
 *
 * AppContext holds one in-memory consultation, and its autosave effects write whatever is in
 * memory to whichever encounter id is current. Swapping only the encounter id therefore wrote the
 * previous visit's assessment, plan, HPI, medicine list and investigation orders into the new
 * encounter a few seconds later (and showed the new encounter as "closed" when the previous one
 * was). A switch now happens in this order:
 *
 *   1. flush    — debounced autosaves still pending for the current encounter are sent now,
 *                 to the current (old) encounter id captured when they were scheduled;
 *   2. invalidate — saves still in flight finish against the old encounter, but their results
 *                 (optimistic-lock versions, conflict banners) are not applied to the new one;
 *   3. reset    — every per-encounter field goes back to its empty value; the patient's standing
 *                 history (PMH, surgical history, allergies, habits, family history, demographics)
 *                 stays. Medicines are per encounter: last visit's list is offered by
 *                 VisitContinuityPanel ("Add to today's list"), never copied automatically;
 *   4. set      — the new encounter id and its status, in the same React batch as the reset, so
 *                 the first autosave the new id sees is already the clean state;
 *   5. apply    — (loading an existing encounter) its stored data, still in the same batch.
 *
 * A switch for another patient's encounter (the patient changed while the encounter was being
 * created or loaded) is refused: that encounter id must never receive this patient's notes.
 *
 * Pure (no React) so the ordering and the field classification are unit-tested
 * (src/lib/__tests__/encounter-switch.test.ts, which also checks AppContext against the lists).
 */

/** The encounter the consultation points at. Replaced by a switch, never reset to empty. */
export const ENCOUNTER_IDENTITY_FIELDS = ['encounterId', 'encounterStatus', 'encounterClosedAt'] as const;

/**
 * AppContext state that belongs to the patient, not to one visit. Kept when another encounter of
 * the same patient is opened (cleared only by clearPatient()).
 */
export const PATIENT_SCOPED_FIELDS = [
  'patientId',
  // Demographics and registration
  'patientName', 'age', 'sex', 'dob', 'phone', 'email', 'address', 'quarter', 'referredBy',
  'patientPhoto', 'occupation',
  'insuranceProvider', 'policyNumber', 'nhiNumber',
  'mrNumber', 'bloodGroup', 'nokName', 'nokRelation', 'nokTel',
  // Standing history
  'comorbidities', 'pmhNotes', 'familyHistory', 'familyHistoryNotes',
  'surgicalHistory', 'surgicalNotes', 'recentSurgeryDate',
  'allergies', 'toxicHabits', 'lifestyleHistory',
  'problems', 'recentEncounters', 'recentEncountersPatientId',
] as const;

/**
 * AppContext state that belongs to one encounter. Reset to its empty value when another
 * encounter is opened, so nothing from the previous visit is saved into the next one.
 */
export const ENCOUNTER_SCOPED_FIELDS = [
  // Presentation and HPI
  'symptoms', 'symptomDetails', 'freeText', 'durationDays', 'painScore',
  'isPostOp', 'postOpDays', 'pregnancyPossible', 'hpiNotes', 'activeCcKey', 'procedureData',
  // Today's medicine list (VisitContinuityPanel offers last visit's list, one tap to add)
  'medications', 'medicationsText', 'pendingPrescriptions',
  // Measurements and examination
  'vitals', 'weightKg', 'heightCm', 'waistCm', 'hipCm', 'muacCm',
  'examGeneral', 'examCardio', 'examResp', 'examAbdomen', 'examNeuro', 'examExtremities',
  'examBreast', 'examWound', 'examFindings', 'examNotes', 'examPhotos', 'anatomicalFindings',
  'rosFindings',
  // Investigations
  'orderedInvestigations', 'radiologyRequests', 'investigationResults', 'extractedLabs',
  'clinicalScores', 'vitalRecords', 'labRecords',
  // Assessment, diagnosis and plan
  'assessment', 'differentials', 'plan', 'followUpNotes', 'referralNotes',
  'assessmentUpdatedAt', 'planUpdatedAt', 'saveConflict',
  'icdCodes', 'cptCodes', 'confirmedDiagnoses', 'workingDiagnosis',
  'paneState', 'paneTop', 'paneConverged', 'surgicalClassifications', 'traumaData',
  // Procedures, documents and billing for this visit
  'procedures', 'billing', 'documents', 'preAuthStatus', 'finalDocument', 'progressNotes',
  'attachments', 'wounds', 'periopProcId', 'whoProc',
  // Visit type and setting
  'visitType', 'postOpDate', 'postOpReviewNum', 'preVisitStatus', 'encounterMode', 'encounterType',
  'ward', 'dateAdmission', 'dateDischarge', 'admittingSurgeon', 'referringPhysician',
  // Summary of the visit before this one (reloaded for the new encounter)
  'priorEncounterSummary',
] as const;

export type EncounterScopedField = typeof ENCOUNTER_SCOPED_FIELDS[number];
export type PatientScopedField = typeof PATIENT_SCOPED_FIELDS[number];

export interface EncounterSwitchTarget {
  /** Patient the encounter belongs to. */
  patientId: string;
  encounterId: string;
  /** Server status ('open' | 'in_progress' | 'closed' | 'cancelled'); a new encounter is 'open'. */
  status: string | null;
  closedAt: string | null;
}

export interface EncounterSwitchOps {
  /** Patient loaded in the consultation right now (read at switch time, not at call time). */
  currentPatientId(): string | null;
  /** Sends every pending debounced autosave now, to the encounter it was scheduled for. */
  flushPendingSaves(): void;
  /** In-flight saves keep their target but their results are no longer applied to state. */
  invalidateInFlightSaves(): void;
  /** Every ENCOUNTER_SCOPED_FIELDS value back to empty; patient-scoped fields untouched. */
  resetEncounterState(): void;
  setEncounter(target: EncounterSwitchTarget): void;
}

export type EncounterSwitchResult =
  | { switched: true }
  | { switched: false; reason: 'patient_changed' };

/**
 * Point the consultation at `target` (see the module comment for the order). `apply` fills in the
 * target encounter's stored data (loading an existing encounter); it runs after the reset, so
 * nothing of the previous encounter survives in fields the stored data leaves empty.
 */
export function switchEncounter(
  ops: EncounterSwitchOps,
  target: EncounterSwitchTarget,
  apply?: () => void,
): EncounterSwitchResult {
  if (ops.currentPatientId() !== target.patientId) return { switched: false, reason: 'patient_changed' };
  ops.flushPendingSaves();
  ops.invalidateInFlightSaves();
  ops.resetEncounterState();
  ops.setEncounter(target);
  apply?.();
  return { switched: true };
}
