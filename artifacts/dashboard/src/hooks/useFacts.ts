import { useCallback, useMemo } from 'react';
import { usePatientState } from '@/context/PatientStateContext';
import type { ClinicalFact, FactType, ActiveAlert } from '@workspace/patient-state';
import type { FactQuery } from '@workspace/patient-state';

// ─── Fact query hook ──────────────────────────────────────────────────────────
// Filters the reactive `facts` snapshot without hitting the store directly.
// Re-runs only when the fact list changes.

export function useFacts(query: FactQuery = {}): ClinicalFact[] {
  const { facts, store } = usePatientState();

  // Stable filter — re-derived when `facts` changes
  return useMemo(() => {
    return store.query(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facts, query.factType, query.status, query.encounterId, query.patientId, query.sourceFactId]);
}

// ─── Active facts for a single type ──────────────────────────────────────────

export function useActiveFacts(type: FactType): ClinicalFact[] {
  const { facts, store } = usePatientState();
  return useMemo(() => store.getActive(type), [facts, type]);
}

// ─── Alert hooks ─────────────────────────────────────────────────────────────

export function useAlerts(): ActiveAlert[] {
  return usePatientState().alerts;
}

export function useCriticalAlerts(): ActiveAlert[] {
  return usePatientState().criticalAlerts;
}

export function useUnacknowledgedAlerts(): ActiveAlert[] {
  const { alerts } = usePatientState();
  return useMemo(() => alerts.filter(a => !a.acknowledgedBy), [alerts]);
}

// ─── Task hooks ───────────────────────────────────────────────────────────────

export function useActiveTasks(): ClinicalFact<'task'>[] {
  const { facts, store } = usePatientState();
  return useMemo(
    () => store.query({ factType: 'task', status: ['pending', 'active'] }) as ClinicalFact<'task'>[],
    [facts],
  );
}

export function useOverdueTasks(): ClinicalFact<'task'>[] {
  const { facts, store } = usePatientState();
  return useMemo(
    () => store.query({ factType: 'task', status: 'overdue' }) as ClinicalFact<'task'>[],
    [facts],
  );
}

// ─── Provenance hook ─────────────────────────────────────────────────────────
// Given a fact ID, returns the displayReason and the chain of source facts.

export interface ProvenanceInfo {
  fact: ClinicalFact | null;
  displayReason: string | null;
  sourceChain: ClinicalFact[];
}

export function useProvenance(factId: string): ProvenanceInfo {
  const { facts, store } = usePatientState();

  return useMemo(() => {
    const fact = store.get(factId);
    if (!fact) return { fact: null, displayReason: null, sourceChain: [] };

    const chain: ClinicalFact[] = [];
    for (const sid of fact.sourceFactIds) {
      const src = store.get(sid);
      if (src) chain.push(src);
    }
    return { fact, displayReason: fact.displayReason, sourceChain: chain };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facts, factId]);
}

// ─── Safety-critical unverified facts ─────────────────────────────────────────
// Allergies and prescriptions extracted by AI that still need clinician sign-off.

export function useUnverifiedSafetyCritical(): ClinicalFact[] {
  const { facts, store } = usePatientState();
  return useMemo(
    () =>
      store.getUnverified().filter(
        f => f.factType === 'allergy' || f.factType === 'prescription',
      ),
    [facts],
  );
}

// ─── Write helpers ────────────────────────────────────────────────────────────

export function useAddFact() {
  const { store } = usePatientState();
  return useCallback(
    <T extends FactType>(
      params: Parameters<typeof store.addFact<T>>[0],
      userId?: string,
    ) => store.addFact<T>(params, userId),
    [store],
  );
}

export function useVerifyFact() {
  const { store } = usePatientState();
  return useCallback(
    (id: string, userId: string) => store.verifyFact(id, userId),
    [store],
  );
}

export function useSetFactStatus() {
  const { store } = usePatientState();
  return useCallback(
    (id: string, status: ClinicalFact['status'], userId?: string) =>
      store.setStatus(id, status, userId),
    [store],
  );
}
