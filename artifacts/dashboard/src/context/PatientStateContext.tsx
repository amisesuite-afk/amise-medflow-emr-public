import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  PatientFactStore,
  RulesEngine,
  WorkflowEngine,
  createEncounterRecord,
  SyncManager,
} from '@workspace/patient-state';
import type {
  ClinicalFact, FactType, FactStatus, ActiveAlert, EncounterRecord,
  SyncState, StoreEvent,
} from '@workspace/patient-state';
import type { FactQuery } from '@workspace/patient-state';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

// ─── Context shape ────────────────────────────────────────────────────────────

interface PatientStateCtx {
  // Core store
  store: PatientFactStore;
  rulesEngine: RulesEngine;
  workflow: WorkflowEngine | null;

  // Reactive snapshot — re-renders consumers when facts change
  facts: ClinicalFact[];
  alerts: ActiveAlert[];
  criticalAlerts: ActiveAlert[];
  syncState: SyncState | null;

  // Derived helpers
  getActiveFacts: (type: FactType) => ClinicalFact[];
  getUnverifiedFacts: () => ClinicalFact[];

  // Encounter
  encounter: EncounterRecord | null;
  startEncounter: (
    params: { patientId: string; type: string; site: string; assignedTo: string | null },
    userId: string,
  ) => WorkflowEngine;
  transitionState: (to: EncounterRecord['state'], userId: string, notes?: string) => string | null;

  // Alerts
  acknowledgeAlert: (alertId: string, userId: string, overrideReason?: string) => void;

  // Sync
  pullFacts: (patientId: string) => Promise<void>;
  pushFacts: () => Promise<void>;

  // Session init
  loadPatient: (patientId: string) => Promise<void>;
  clearPatient: () => void;
}

const Ctx = createContext<PatientStateCtx | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PatientStateProvider({ children }: { children: React.ReactNode }) {
  const { session, profile } = useAuth();

  // Stable store and engine refs — these never change for the session
  const storeRef  = useRef(new PatientFactStore());
  const engineRef = useRef(new RulesEngine(storeRef.current));
  const syncRef   = useRef<SyncManager | null>(null);

  const [facts,       setFacts]       = useState<ClinicalFact[]>([]);
  const [alerts,      setAlerts]      = useState<ActiveAlert[]>([]);
  const [encounter,   setEncounter]   = useState<EncounterRecord | null>(null);
  const [syncState,   setSyncState]   = useState<SyncState | null>(null);
  const [workflow,    setWorkflow]     = useState<WorkflowEngine | null>(null);

  // Re-snapshot on any store event
  useEffect(() => {
    const store = storeRef.current;
    const unsub = store.on('*', (_event: StoreEvent) => {
      setFacts(store.getAll());
      setAlerts(engineRef.current.getAlerts());
    });
    return unsub;
  }, []);

  const userId = profile?.id ?? session?.user?.id ?? null;

  // Wire Supabase sync manager once user is available
  useEffect(() => {
    if (!userId) return;

    const mgr = new SyncManager({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase: supabase as any,
      store: storeRef.current,
      localStorageKey: `medflow_facts_${userId}`,
      onStateChange: setSyncState,
      onConflict: () => 'remote_wins',
    });

    syncRef.current = mgr;
    void mgr.loadLocalCache();

    return () => {
      mgr.destroy();
      syncRef.current = null;
    };
  }, [userId]);

  // ── Encounter ──────────────────────────────────────────────────────────────

  const startEncounter = useCallback(
    (
      params: { patientId: string; type: string; site: string; assignedTo: string | null },
      userId: string,
    ) => {
      const rec = createEncounterRecord({ ...params }, userId);
      const wf  = new WorkflowEngine(rec, storeRef.current);
      setWorkflow(wf);
      setEncounter(wf.toJSON());

      wf.on(updated => setEncounter({ ...updated }));
      return wf;
    },
    [],
  );

  const transitionState = useCallback(
    (to: EncounterRecord['state'], userId: string, notes?: string): string | null => {
      if (!workflow) return 'No active encounter';
      const err = workflow.transition(to, userId, notes);
      if (!err) setEncounter(workflow.toJSON());
      return err;
    },
    [workflow],
  );

  // ── Alerts ─────────────────────────────────────────────────────────────────

  const acknowledgeAlert = useCallback(
    (alertId: string, userId: string, overrideReason?: string) => {
      engineRef.current.acknowledgeAlert(alertId, userId, overrideReason);
      setAlerts(engineRef.current.getAlerts());
    },
    [],
  );

  // ── Patient lifecycle ──────────────────────────────────────────────────────

  const loadPatient = useCallback(async (patientId: string) => {
    storeRef.current.clear();
    if (syncRef.current) await syncRef.current.pull(patientId);
    setFacts(storeRef.current.getAll());
    setAlerts(engineRef.current.getAlerts());
  }, []);

  const clearPatient = useCallback(() => {
    storeRef.current.clear();
    engineRef.current.clearAll();
    setFacts([]);
    setAlerts([]);
    setEncounter(null);
    setWorkflow(null);
  }, []);

  // ── Sync ────────────────────────────────────────────────────────────────────

  const pullFacts = useCallback(
    async (patientId: string) => { await syncRef.current?.pull(patientId); },
    [],
  );

  const pushFacts = useCallback(
    async () => { await syncRef.current?.push(userId ?? 'system'); },
    [userId],
  );

  // ── Derived helpers ────────────────────────────────────────────────────────

  const getActiveFacts  = useCallback(
    (type: FactType) => storeRef.current.getActive(type),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facts],
  );

  const getUnverifiedFacts = useCallback(
    () => storeRef.current.getUnverified(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facts],
  );

  const criticalAlerts = useMemo(
    () => alerts.filter(a => a.severity === 'critical' && !a.acknowledgedBy),
    [alerts],
  );

  const value = useMemo<PatientStateCtx>(() => ({
    store: storeRef.current,
    rulesEngine: engineRef.current,
    workflow,
    facts,
    alerts,
    criticalAlerts,
    syncState,
    getActiveFacts,
    getUnverifiedFacts,
    encounter,
    startEncounter,
    transitionState,
    acknowledgeAlert,
    pullFacts,
    pushFacts,
    loadPatient,
    clearPatient,
  }), [
    workflow, facts, alerts, criticalAlerts, syncState, encounter,
    getActiveFacts, getUnverifiedFacts,
    startEncounter, transitionState, acknowledgeAlert,
    pullFacts, pushFacts, loadPatient, clearPatient,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePatientState(): PatientStateCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePatientState must be used inside PatientStateProvider');
  return ctx;
}
