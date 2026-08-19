/**
 * Registers the outbox executor for every autosave entity type.
 *
 * trackedSave() in AppContext.tsx enqueues a serializable descriptor to the
 * IndexedDB outbox (sync-outbox.ts) when a save fails, so it survives a page
 * reload or browser close. When the outbox flushes on reconnect, it looks up
 * the executor registered here for the entry's entity_type and replays the
 * original db.ts call from the stored payload.
 *
 * Payload shapes are deliberately plain, JSON-safe objects — not the typed
 * db.ts input types directly — since they're read back from IndexedDB via
 * structured clone with no compile-time guarantee of shape. Each executor
 * casts and reconstructs the exact call trackedSave's caller made.
 *
 * Imported once for its module-level registerExecutor() side effects (see
 * the import in AppContext.tsx) — nothing here needs to be called directly.
 */
import { registerExecutor, type OutboxEntry } from './sync-outbox';
import {
  saveAssessment, savePlan, syncMedicationList, syncAllergyList,
  saveExamFindings, syncSurgicalHistory, syncToxicHabits, syncRosFindings,
  syncProcedureData, syncTraumaRecord, clearHpiNote, saveHpiNote,
  savePmhNotes, syncInvestigationOrders, updateEncounterType,
  saveInpatientDetails, saveClinicalScores,
} from './db';

function payloadOf<T>(entry: OutboxEntry): T {
  return entry.payload as unknown as T;
}

registerExecutor('assessment', async (entry) => {
  const p = payloadOf<Parameters<typeof saveAssessment>[0] & { expectedUpdatedAt: string | null }>(entry);
  const { error, conflict } = await saveAssessment(p, p.expectedUpdatedAt);
  if (error) throw new Error(error);
  // A conflict on replay means the row changed while this entry sat queued
  // offline — treat it as still-unresolved rather than a successful sync
  // (which would silently drop these edits from the outbox). It stays
  // queued/pending; there's no in-context UI to offer the "keep mine / load
  // theirs" choice from here the way there is for a live online save.
  if (conflict) throw new Error(`${p.encounter_id}: assessment changed on the server while offline — resolve by reopening this encounter`);
});

registerExecutor('plan', async (entry) => {
  const p = payloadOf<Parameters<typeof savePlan>[0] & { expectedUpdatedAt: string | null }>(entry);
  const { error, conflict } = await savePlan(p, p.expectedUpdatedAt);
  if (error) throw new Error(error);
  if (conflict) throw new Error(`${p.encounter_id}: plan changed on the server while offline — resolve by reopening this encounter`);
});

registerExecutor('medications', async (entry) => {
  const p = payloadOf<{ patientId: string; encounterId: string; chipMeds: string[]; freeText: string }>(entry);
  const { error } = await syncMedicationList(p.patientId, p.encounterId, p.chipMeds, p.freeText);
  if (error) throw new Error(error);
});

registerExecutor('allergies', async (entry) => {
  const p = payloadOf<{ patientId: string; allergens: string[] }>(entry);
  const { error } = await syncAllergyList(p.patientId, p.allergens);
  if (error) throw new Error(error);
});

registerExecutor('exam_findings', async (entry) => {
  const p = payloadOf<{
    examFindings: Record<string, string[]>;
    examNotes: Record<string, string>;
    patientId: string;
    encounterId: string;
  }>(entry);
  const { error } = await saveExamFindings(p.examFindings, p.examNotes, p.patientId, p.encounterId);
  if (error) throw new Error(error);
});

registerExecutor('surgical_history', async (entry) => {
  const p = payloadOf<{ patientId: string; procedures: string[]; notes: string; recentSurgeryDate: string }>(entry);
  await syncSurgicalHistory(p.patientId, p.procedures, p.notes, p.recentSurgeryDate);
});

registerExecutor('toxic_habits', async (entry) => {
  const p = payloadOf<{ patientId: string; habits: string[] }>(entry);
  await syncToxicHabits(p.patientId, p.habits);
});

registerExecutor('ros_findings', async (entry) => {
  const p = payloadOf<{
    patientId: string;
    encounterId: string;
    rosFindings: Record<string, { status: string; details: string[]; notes: string }>;
  }>(entry);
  await syncRosFindings(p.patientId, p.encounterId, p.rosFindings);
});

registerExecutor('procedure_data', async (entry) => {
  const p = payloadOf<{ patientId: string; encounterId: string; procedureData: Record<string, unknown> }>(entry);
  await syncProcedureData(p.patientId, p.encounterId, p.procedureData);
});

registerExecutor('trauma_record', async (entry) => {
  const p = payloadOf<{
    patientId: string;
    encounterId: string;
    traumaData: Parameters<typeof syncTraumaRecord>[2];
  }>(entry);
  await syncTraumaRecord(p.patientId, p.encounterId, p.traumaData);
});

registerExecutor('hpi_note_clear', async (entry) => {
  const p = payloadOf<{ encounterId: string }>(entry);
  const { error } = await clearHpiNote(p.encounterId);
  if (error) throw new Error(error);
});

registerExecutor('hpi_note', async (entry) => {
  const p = payloadOf<{ encounterId: string; patientId: string; hpiNotes: string }>(entry);
  const { error } = await saveHpiNote(p.encounterId, p.patientId, p.hpiNotes);
  if (error) throw new Error(error);
});

registerExecutor('pmh_notes', async (entry) => {
  const p = payloadOf<{ patientId: string; pmhNotes: string; familyHistoryNotes: string }>(entry);
  const { error } = await savePmhNotes(p.patientId, p.pmhNotes, p.familyHistoryNotes);
  if (error) throw new Error(error);
});

registerExecutor('investigation_orders', async (entry) => {
  const p = payloadOf<{ encounterId: string; patientId: string; orderedInvestigations: string[] }>(entry);
  const { error } = await syncInvestigationOrders(p.encounterId, p.patientId, p.orderedInvestigations);
  if (error) throw new Error(error);
});

registerExecutor('encounter_type', async (entry) => {
  const p = payloadOf<{ encounterId: string; dbType: Parameters<typeof updateEncounterType>[1] }>(entry);
  const { error } = await updateEncounterType(p.encounterId, p.dbType);
  if (error) throw new Error(error);
});

registerExecutor('inpatient_details', async (entry) => {
  const p = payloadOf<{ encounterId: string; patientId: string; data: Record<string, unknown> }>(entry);
  const { error } = await saveInpatientDetails(p.encounterId, p.patientId, p.data);
  if (error) throw new Error(error);
});

registerExecutor('clinical_scores', async (entry) => {
  const p = payloadOf<{
    encounterId: string;
    clinicalScores: Record<string, unknown>;
    extractedLabs: Record<string, number | null>;
  }>(entry);
  await saveClinicalScores(p.encounterId, p.clinicalScores, p.extractedLabs);
});
