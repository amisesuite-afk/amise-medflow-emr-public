import type {
  EncounterState, EncounterRecord, EncounterStateEntry,
  TaskValue, FactType,
} from './types.js';
import type { PatientFactStore } from './fact-store.js';

function now(): string { return new Date().toISOString(); }

// ─── Transition table ─────────────────────────────────────────────────────────

type TransitionGuard = (store: PatientFactStore, record: EncounterRecord) => string | null;

interface Transition {
  to: EncounterState;
  guard?: TransitionGuard;
  // Tasks to create on entering `to`
  entryTasks?: Array<Partial<TaskValue> & { title: string }>;
}

const TRANSITIONS: Record<EncounterState, Transition[]> = {
  registration: [
    { to: 'intake' },
  ],
  intake: [
    { to: 'triage' },
    {
      to: 'consultation',
      guard: (_store, rec) =>
        rec.checklist['triage_complete'] ? null : 'Triage must be completed before consultation',
    },
  ],
  triage: [
    { to: 'consultation' },
    {
      to: 'procedure',
      guard: (_store, rec) =>
        rec.checklist['consent_obtained'] ? null : 'Consent must be obtained before a procedure',
    },
  ],
  consultation: [
    { to: 'investigation' },
    {
      to: 'treatment',
      guard: (store, rec) => {
        const pendingOrders = store.query({
          factType: 'investigation_order',
          status: 'pending',
          encounterId: rec.id,
        });
        return pendingOrders.length === 0 ? null : 'Pending investigations must be received before treatment';
      },
      entryTasks: [{
        title: 'Document management plan',
        category: 'documentation',
        priority: 'high',
        description: 'Ensure a complete management plan is documented before discharge',
      }],
    },
    {
      to: 'procedure',
      guard: (_store, rec) =>
        rec.checklist['consent_obtained'] ? null : 'Consent must be obtained before a procedure',
    },
    { to: 'discharge' },
  ],
  investigation: [
    { to: 'consultation' },
    {
      to: 'treatment',
      guard: (store, rec) => {
        const pending = store.query({
          factType: 'investigation_order',
          status: 'pending',
          encounterId: rec.id,
        });
        return pending.length === 0 ? null : `${pending.length} investigation(s) still pending`;
      },
    },
  ],
  treatment: [
    { to: 'procedure' },
    {
      to: 'discharge',
      entryTasks: [{
        title: 'Complete discharge summary',
        category: 'documentation',
        priority: 'high',
        description: 'Draft and sign the discharge summary including diagnoses, procedures, medications, and follow-up plan',
      }, {
        title: 'Confirm follow-up arrangements',
        category: 'follow_up',
        priority: 'high',
        description: 'Ensure a follow-up appointment or plan is in place before patient leaves',
      }],
    },
  ],
  procedure: [
    {
      to: 'treatment',
    },
    {
      to: 'discharge',
      guard: (_store, rec) =>
        rec.checklist['procedure_note_complete'] ? null : 'Procedure note must be completed before discharge',
      entryTasks: [{
        title: 'Complete discharge summary',
        category: 'documentation',
        priority: 'high',
        description: 'Draft and sign the discharge summary',
      }],
    },
  ],
  discharge: [
    {
      to: 'follow_up',
      entryTasks: [{
        title: 'Follow-up appointment',
        category: 'follow_up',
        priority: 'medium',
        description: 'Schedule and confirm follow-up appointment per discharge plan',
      }],
    },
    { to: 'closed' },
  ],
  follow_up: [
    { to: 'consultation' },
    { to: 'closed' },
  ],
  closed: [],
};

// ─── WorkflowEngine ───────────────────────────────────────────────────────────

export class WorkflowEngine {
  private record: EncounterRecord;
  private store: PatientFactStore;
  private listeners: Array<(rec: EncounterRecord) => void> = [];

  constructor(record: EncounterRecord, store: PatientFactStore) {
    this.record = { ...record };
    this.store = store;
  }

  getRecord(): EncounterRecord {
    return { ...this.record };
  }

  getState(): EncounterState {
    return this.record.state;
  }

  // Returns null on success, error string on failure
  transition(to: EncounterState, userId: string, notes?: string): string | null {
    const available = TRANSITIONS[this.record.state] ?? [];
    const t = available.find(x => x.to === to);
    if (!t) {
      return `Transition from '${this.record.state}' to '${to}' is not allowed`;
    }

    if (t.guard) {
      const err = t.guard(this.store, this.record);
      if (err) return err;
    }

    const ts = now();

    // Close out previous state
    const history = [...this.record.stateHistory];
    if (history.length) {
      history[history.length - 1] = {
        ...history[history.length - 1],
        exitedAt: ts,
      };
    }
    const newEntry: EncounterStateEntry = {
      state: to,
      enteredAt: ts,
      exitedAt: null,
      enteredBy: userId,
      notes: notes ?? null,
    };
    history.push(newEntry);

    this.record = {
      ...this.record,
      state: to,
      stateHistory: history,
      ...(to === 'closed' ? { closedAt: ts } : {}),
    };

    // Emit encounter transition event via store
    this.store.emitEncounterEvent({ type: 'encounter:transitioned', encounterId: this.record.id, userId, timestamp: ts });

    // Create entry tasks
    if (t.entryTasks?.length) {
      for (const taskDef of t.entryTasks) {
        this.store.addFact<'task'>({
          patientId: this.record.patientId,
          encounterId: this.record.id,
          factType: 'task',
          value: {
            title: taskDef.title,
            description: taskDef.description ?? '',
            category: taskDef.category ?? 'clinical',
            priority: taskDef.priority ?? 'medium',
            assignedTo: null,
            dueAt: null,
            completedAt: null,
            completedBy: null,
            completionEvidence: null,
            triggeringFactId: null,
            ruleId: 'workflow_state_entry',
            acknowledgedBy: null,
            acknowledgedAt: null,
          },
          status: 'pending',
          source: 'derived_rule',
          sourceFactIds: [],
          ruleId: 'workflow_state_entry',
          createdBy: userId,
          verifiedBy: null,
          verifiedAt: null,
          expiresAt: null,
          displayReason: `Auto-created on entering ${to} state`,
          metadata: { fromState: this.record.stateHistory[this.record.stateHistory.length - 2]?.state },
        }, userId);
      }
    }

    this.listeners.forEach(l => l(this.getRecord()));
    return null;
  }

  // Returns which states are currently reachable
  availableTransitions(): EncounterState[] {
    return (TRANSITIONS[this.record.state] ?? [])
      .filter(t => !t.guard || t.guard(this.store, this.record) === null)
      .map(t => t.to);
  }

  // Returns blocked transitions and their reasons
  blockedTransitions(): Array<{ to: EncounterState; reason: string }> {
    return (TRANSITIONS[this.record.state] ?? [])
      .flatMap(t => {
        if (!t.guard) return [];
        const reason = t.guard(this.store, this.record);
        return reason ? [{ to: t.to, reason }] : [];
      });
  }

  setChecklistItem(key: string, value: boolean) {
    this.record = {
      ...this.record,
      checklist: { ...this.record.checklist, [key]: value },
    };
  }

  on(listener: (rec: EncounterRecord) => void): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  // Serialise for persistence
  toJSON(): EncounterRecord {
    return { ...this.record };
  }

  static fromJSON(record: EncounterRecord, store: PatientFactStore): WorkflowEngine {
    return new WorkflowEngine(record, store);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function createEncounterRecord(
  params: Pick<EncounterRecord, 'patientId' | 'type' | 'site' | 'assignedTo'> & { id?: string },
  userId: string,
): EncounterRecord {
  const id = params.id ?? crypto.randomUUID();
  const ts = now();
  return {
    id,
    patientId: params.patientId,
    state: 'registration',
    type: params.type,
    site: params.site,
    startedAt: ts,
    closedAt: null,
    stateHistory: [{
      state: 'registration',
      enteredAt: ts,
      exitedAt: null,
      enteredBy: userId,
      notes: null,
    }],
    assignedTo: params.assignedTo,
    checklist: {},
  };
}

export const ENCOUNTER_STATE_LABELS: Record<EncounterState, string> = {
  registration:  'Registration',
  intake:        'Intake',
  triage:        'Triage',
  consultation:  'Consultation',
  investigation: 'Investigation',
  treatment:     'Treatment',
  procedure:     'Procedure',
  discharge:     'Discharge',
  follow_up:     'Follow-up',
  closed:        'Closed',
};

export const ENCOUNTER_STATE_ORDER: EncounterState[] = [
  'registration', 'intake', 'triage', 'consultation',
  'investigation', 'treatment', 'procedure', 'discharge', 'follow_up', 'closed',
];
