import type {
  ClinicalFact, FactType, FactStatus, FactSource,
  StoreEvent, StoreEventType, AuditEntry,
} from './types.js';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function now(): string {
  return new Date().toISOString();
}

type Listener = (event: StoreEvent) => void;

export interface FactQuery {
  factType?: FactType | FactType[];
  status?: FactStatus | FactStatus[];
  encounterId?: string;
  patientId?: string;
  sourceFactId?: string;
}

// ─── PatientFactStore ─────────────────────────────────────────────────────────
//
// Single source of truth for all structured clinical facts within a session.
// Facts are append-only: every update bumps the version and emits an event.
// Consumers subscribe via on() — the rules engine, sync manager, and React
// context all listen here.

export class PatientFactStore {
  private facts = new Map<string, ClinicalFact>();
  private listeners = new Map<StoreEventType | '*', Set<Listener>>();
  private auditEntries: AuditEntry[] = [];
  private sessionId: string;
  private currentUserId = 'system';

  constructor(sessionId?: string) {
    this.sessionId = sessionId ?? uuid();
  }

  // ── Identity ────────────────────────────────────────────────────────────────

  setCurrentUser(userId: string) {
    this.currentUserId = userId;
  }

  // ── Write ───────────────────────────────────────────────────────────────────

  addFact<T extends FactType>(
    params: Omit<ClinicalFact<T>, 'id' | 'version' | 'createdAt' | 'updatedAt'>,
    userId?: string,
  ): ClinicalFact<T> {
    const id = uuid();
    const ts = now();
    const fact: ClinicalFact<T> = {
      ...params,
      id,
      version: 1,
      createdAt: ts,
      updatedAt: ts,
    };
    this.facts.set(id, fact as ClinicalFact);
    this.appendAudit({
      action: 'fact_created',
      entityType: 'fact',
      entityId: id,
      previousValue: null,
      newValue: fact,
      source: this.sourceFromFactSource(params.source),
      clinicalSignificance: this.clinicalSignificance(params.factType),
      overrideJustification: null,
      userId: userId ?? this.currentUserId,
    });
    this.emit({ type: 'fact:created', factId: id, userId: userId ?? this.currentUserId, timestamp: ts });
    return fact;
  }

  updateFact<T extends FactType>(
    id: string,
    changes: Partial<Pick<ClinicalFact<T>, 'value' | 'status' | 'metadata' | 'expiresAt' | 'displayReason'>>,
    userId?: string,
  ): ClinicalFact<T> | null {
    const existing = this.facts.get(id) as ClinicalFact<T> | undefined;
    if (!existing) return null;
    const ts = now();
    const updated: ClinicalFact<T> = {
      ...existing,
      ...changes,
      version: existing.version + 1,
      updatedAt: ts,
    };
    this.facts.set(id, updated as ClinicalFact);
    this.appendAudit({
      action: 'fact_updated',
      entityType: 'fact',
      entityId: id,
      previousValue: existing,
      newValue: updated,
      source: 'ui',
      clinicalSignificance: this.clinicalSignificance(existing.factType),
      overrideJustification: null,
      userId: userId ?? this.currentUserId,
    });
    this.emit({ type: 'fact:updated', factId: id, userId: userId ?? this.currentUserId, timestamp: ts });
    return updated;
  }

  setStatus(id: string, status: FactStatus, userId?: string): ClinicalFact | null {
    const existing = this.facts.get(id);
    if (!existing) return null;
    const ts = now();
    const updated: ClinicalFact = { ...existing, status, version: existing.version + 1, updatedAt: ts };
    this.facts.set(id, updated);
    this.appendAudit({
      action: 'fact_status_changed',
      entityType: 'fact',
      entityId: id,
      previousValue: { status: existing.status },
      newValue: { status },
      source: 'ui',
      clinicalSignificance: this.clinicalSignificance(existing.factType),
      overrideJustification: null,
      userId: userId ?? this.currentUserId,
    });
    this.emit({ type: 'fact:status_changed', factId: id, userId: userId ?? this.currentUserId, timestamp: ts });
    return updated;
  }

  verifyFact(id: string, userId: string): ClinicalFact | null {
    const existing = this.facts.get(id);
    if (!existing) return null;
    const ts = now();
    const updated: ClinicalFact = {
      ...existing,
      status: 'confirmed',
      verifiedBy: userId,
      verifiedAt: ts,
      version: existing.version + 1,
      updatedAt: ts,
    };
    this.facts.set(id, updated);
    this.appendAudit({
      action: 'fact_verified',
      entityType: 'fact',
      entityId: id,
      previousValue: { verifiedBy: null },
      newValue: { verifiedBy: userId, verifiedAt: ts },
      source: 'ui',
      clinicalSignificance: 'safety_critical',
      overrideJustification: null,
      userId,
    });
    this.emit({ type: 'fact:verified', factId: id, userId, timestamp: ts });
    return updated;
  }

  // Bulk-load from Supabase or offline cache without firing rules
  loadBatch(facts: ClinicalFact[], userId = 'system') {
    for (const f of facts) {
      this.facts.set(f.id, f);
    }
    this.emit({ type: 'store:loaded', userId, timestamp: now(), payload: { count: facts.length } });
  }

  clear(userId = 'system') {
    this.facts.clear();
    this.emit({ type: 'store:cleared', userId, timestamp: now() });
  }

  // ── Read ────────────────────────────────────────────────────────────────────

  get(id: string): ClinicalFact | null {
    return this.facts.get(id) ?? null;
  }

  query(q: FactQuery = {}): ClinicalFact[] {
    const types = q.factType
      ? Array.isArray(q.factType) ? q.factType : [q.factType]
      : null;
    const statuses = q.status
      ? Array.isArray(q.status) ? q.status : [q.status]
      : null;

    return Array.from(this.facts.values()).filter(f => {
      if (types && !types.includes(f.factType)) return false;
      if (statuses && !statuses.includes(f.status)) return false;
      if (q.encounterId && f.encounterId !== q.encounterId) return false;
      if (q.patientId && f.patientId !== q.patientId) return false;
      if (q.sourceFactId && !f.sourceFactIds.includes(q.sourceFactId)) return false;
      return true;
    });
  }

  getActive(type: FactType): ClinicalFact[] {
    return this.query({ factType: type, status: ['active', 'confirmed', 'suspected'] });
  }

  getAll(): ClinicalFact[] {
    return Array.from(this.facts.values());
  }

  getUnverified(): ClinicalFact[] {
    return Array.from(this.facts.values()).filter(
      f => f.source === 'ai_extracted' || f.source === 'ai_suggested' || f.status === 'suspected',
    );
  }

  getDerivedFrom(sourceFactId: string): ClinicalFact[] {
    return Array.from(this.facts.values()).filter(f => f.sourceFactIds.includes(sourceFactId));
  }

  // ── Audit ───────────────────────────────────────────────────────────────────

  getAuditTrail(entityId?: string): AuditEntry[] {
    if (!entityId) return [...this.auditEntries];
    return this.auditEntries.filter(e => e.entityId === entityId);
  }

  // ── Serialization (offline) ──────────────────────────────────────────────────

  serialize(): string {
    return JSON.stringify({
      facts: Array.from(this.facts.entries()),
      auditEntries: this.auditEntries,
      sessionId: this.sessionId,
    });
  }

  static deserialize(json: string, sessionId?: string): PatientFactStore {
    const store = new PatientFactStore(sessionId);
    try {
      const data = JSON.parse(json) as {
        facts: [string, ClinicalFact][];
        auditEntries: AuditEntry[];
        sessionId: string;
      };
      for (const [k, v] of data.facts) store.facts.set(k, v);
      store.auditEntries = data.auditEntries ?? [];
    } catch {
      // corrupt cache — start fresh
    }
    return store;
  }

  // ── Events ───────────────────────────────────────────────────────────────────

  on(event: StoreEventType | '*', listener: Listener): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
    return () => this.listeners.get(event)?.delete(listener);
  }

  // Used by WorkflowEngine to emit encounter-level events
  emitEncounterEvent(event: StoreEvent) {
    this.emit(event);
  }

  private emit(event: StoreEvent) {
    this.listeners.get(event.type)?.forEach(l => l(event));
    this.listeners.get('*')?.forEach(l => l(event));
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private appendAudit(entry: Omit<AuditEntry, 'id' | 'timestamp' | 'sessionId'> & { userId: string }) {
    this.auditEntries.push({
      id: uuid(),
      timestamp: now(),
      sessionId: this.sessionId,
      ...entry,
    });
  }

  private sourceFromFactSource(s: FactSource): AuditEntry['source'] {
    if (s === 'lab_import') return 'import';
    if (s === 'derived_rule') return 'rules_engine';
    if (s === 'ai_extracted' || s === 'ai_suggested') return 'ai';
    return 'ui';
  }

  private clinicalSignificance(type: FactType): AuditEntry['clinicalSignificance'] {
    if (type === 'allergy' || type === 'prescription') return 'safety_critical';
    if (type === 'diagnosis' || type === 'vital' || type === 'lab_result') return 'clinical';
    return 'administrative';
  }
}
