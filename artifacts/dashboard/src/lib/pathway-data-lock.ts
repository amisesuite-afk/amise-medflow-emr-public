/**
 * Serialises read-modify-write saves of `patients.pathway_data_json` per patient.
 *
 * Supplements (`supplement-store.ts`) and lifestyle history (`lifestyle-history-db.ts`) each keep
 * their own key in the same JSON blob and save by reading the blob, replacing their key and writing
 * it back. Two debounced saves for the same patient running at once could otherwise each read the
 * old blob, and the second write would drop the first one's key.
 */
const chains = new Map<string, Promise<unknown>>();

export function withPathwayDataLock<T>(patientId: string, fn: () => Promise<T>): Promise<T> {
  const previous = chains.get(patientId) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  const tail = run.catch(() => undefined);
  chains.set(patientId, tail);
  void tail.then(() => { if (chains.get(patientId) === tail) chains.delete(patientId); });
  return run;
}
