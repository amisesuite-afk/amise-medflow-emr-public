import type { ClinicalFact, SyncConflict, SyncState } from './types.js';
import { PatientFactStore } from './fact-store.js';

// ─── Encryption helpers (Web Crypto AES-256-GCM) ─────────────────────────────

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encrypt(plaintext: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(passphrase, salt);
  const enc  = new TextEncoder();
  const ct   = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  // Pack: [salt(16)][iv(12)][ciphertext] → base64
  const buf = new Uint8Array(16 + 12 + ct.byteLength);
  buf.set(salt, 0);
  buf.set(iv, 16);
  buf.set(new Uint8Array(ct), 28);
  return btoa(String.fromCharCode(...buf));
}

async function decrypt(b64: string, passphrase: string): Promise<string> {
  const buf  = Uint8Array.from(atob(b64), (c: string) => c.charCodeAt(0));
  const salt = buf.slice(0, 16);
  const iv   = buf.slice(16, 28);
  const ct   = buf.slice(28);
  const key  = await deriveKey(passphrase, salt);
  const pt   = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}

// ─── Supabase row shape ───────────────────────────────────────────────────────

interface FactRow {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  fact_type: string;
  fact_value: unknown;
  status: string;
  version: number;
  source: string;
  source_fact_ids: string[];
  rule_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  verified_by: string | null;
  verified_at: string | null;
  expires_at: string | null;
  display_reason: string | null;
  metadata: Record<string, unknown>;
}

function rowToFact(row: FactRow): ClinicalFact {
  return {
    id: row.id,
    patientId: row.patient_id,
    encounterId: row.encounter_id,
    factType: row.fact_type as ClinicalFact['factType'],
    value: row.fact_value as ClinicalFact['value'],
    status: row.status as ClinicalFact['status'],
    version: row.version,
    source: row.source as ClinicalFact['source'],
    sourceFactIds: row.source_fact_ids ?? [],
    ruleId: row.rule_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    expiresAt: row.expires_at,
    displayReason: row.display_reason,
    metadata: row.metadata ?? {},
  };
}

function factToRow(f: ClinicalFact): FactRow {
  return {
    id: f.id,
    patient_id: f.patientId,
    encounter_id: f.encounterId,
    fact_type: f.factType,
    fact_value: f.value,
    status: f.status,
    version: f.version,
    source: f.source,
    source_fact_ids: f.sourceFactIds,
    rule_id: f.ruleId,
    created_by: f.createdBy,
    created_at: f.createdAt,
    updated_at: f.updatedAt,
    verified_by: f.verifiedBy,
    verified_at: f.verifiedAt,
    expires_at: f.expiresAt,
    display_reason: f.displayReason,
    metadata: f.metadata,
  };
}

// ─── SyncManager ─────────────────────────────────────────────────────────────
//
// Handles Supabase ↔ local store sync and encrypted offline cache.
// Dirty-flag approach: every local write adds the fact ID to `dirty`;
// push sends only dirty facts; pull fetches facts newer than lastSyncAt.
// Conflict resolution: last-write-wins by version number by default;
// a `onConflict` callback lets the caller apply custom logic.

type SupabaseClient = {
  from: (table: string) => {
    upsert: (rows: unknown[], opts?: unknown) => Promise<{ error: unknown }>;
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        gt: (col: string, val: string) => Promise<{ data: unknown[]; error: unknown }>;
      };
    };
  };
};

export interface SyncOptions {
  supabase: SupabaseClient;
  store: PatientFactStore;
  encryptionPassphrase?: string;
  localStorageKey?: string;
  onConflict?: (conflict: SyncConflict) => 'local_wins' | 'remote_wins';
  onStateChange?: (state: SyncState) => void;
}

export class SyncManager {
  private supabase: SupabaseClient;
  private store: PatientFactStore;
  private passphrase: string | null;
  private cacheKey: string;
  private onConflict: (c: SyncConflict) => 'local_wins' | 'remote_wins';
  private onStateChange: ((s: SyncState) => void) | null;

  private dirty = new Set<string>();
  private lastSyncAt: string | null = null;
  private conflicts: SyncConflict[] = [];
  private isOnline = navigator.onLine;
  private isSyncing = false;
  private pushQueue: Promise<void> = Promise.resolve();

  private unsubStore: (() => void) | null = null;

  constructor(opts: SyncOptions) {
    this.supabase = opts.supabase;
    this.store    = opts.store;
    this.passphrase  = opts.encryptionPassphrase ?? null;
    this.cacheKey    = opts.localStorageKey ?? 'medflow_fact_cache';
    this.onConflict  = opts.onConflict ?? (() => 'remote_wins');
    this.onStateChange = opts.onStateChange ?? null;

    // Mark facts dirty on every local write
    this.unsubStore = this.store.on('*', event => {
      if (event.factId) this.dirty.add(event.factId);
      // Persist to encrypted local cache immediately
      void this.saveLocalCache();
    });

    window.addEventListener('online',  this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  destroy() {
    this.unsubStore?.();
    window.removeEventListener('online',  this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  // ── Pull: fetch from Supabase ────────────────────────────────────────────────

  async pull(patientId: string): Promise<void> {
    this.emitState();
    try {
      this.isSyncing = true;
      this.emitState();

      const since = this.lastSyncAt ?? '1970-01-01T00:00:00Z';
      const { data, error } = await (this.supabase
        .from('clinical_facts')
        .select('*')
        .eq('patient_id', patientId)
        .gt('updated_at', since) as unknown as Promise<{ data: FactRow[]; error: unknown }>);

      if (error) throw error;

      const rows = (data ?? []) as FactRow[];
      const toLoad: ClinicalFact[] = [];

      for (const row of rows) {
        const remote = rowToFact(row);
        const local  = this.store.get(remote.id);

        if (!local) {
          toLoad.push(remote);
          continue;
        }

        if (remote.version > local.version) {
          // Conflict if local is also dirty
          if (this.dirty.has(remote.id)) {
            const c: SyncConflict = {
              factId: remote.id,
              localFact: local,
              remoteFact: remote,
              detectedAt: new Date().toISOString(),
              resolution: 'pending',
              resolvedBy: null,
              resolvedAt: null,
            };
            const decision = this.onConflict(c);
            c.resolution = decision;
            c.resolvedAt = new Date().toISOString();
            this.conflicts.push(c);

            if (decision === 'remote_wins') {
              toLoad.push(remote);
              this.dirty.delete(remote.id);
            }
          } else {
            toLoad.push(remote);
          }
        }
      }

      if (toLoad.length) this.store.loadBatch(toLoad);
      this.lastSyncAt = new Date().toISOString();
    } finally {
      this.isSyncing = false;
      this.emitState();
    }
  }

  // ── Push: send dirty facts to Supabase ──────────────────────────────────────

  async push(userId = 'system'): Promise<void> {
    if (!this.dirty.size) return;

    this.pushQueue = this.pushQueue.then(async () => {
      if (!this.isOnline) return;
      this.isSyncing = true;
      this.emitState();

      try {
        const ids = [...this.dirty];
        const rows: FactRow[] = [];
        for (const id of ids) {
          const f = this.store.get(id);
          if (f) rows.push(factToRow(f));
        }

        if (!rows.length) return;

        const { error } = await this.supabase
          .from('clinical_facts')
          .upsert(rows, { onConflict: 'id' });

        if (error) throw error;

        for (const id of ids) this.dirty.delete(id);
        this.lastSyncAt = new Date().toISOString();

        // Record sync audit
        const audit = this.store.getAuditTrail().slice(-1);
        if (audit.length) {
          // Audit push recorded via Supabase audit_log table separately
        }
      } finally {
        this.isSyncing = false;
        this.emitState();
      }
    });

    return this.pushQueue;
  }

  // ── Offline encrypted local cache ────────────────────────────────────────────

  async saveLocalCache(): Promise<void> {
    try {
      const raw = this.store.serialize();
      if (this.passphrase) {
        const encrypted = await encrypt(raw, this.passphrase);
        localStorage.setItem(this.cacheKey, encrypted);
        localStorage.setItem(this.cacheKey + '_enc', '1');
      } else {
        localStorage.setItem(this.cacheKey, raw);
        localStorage.removeItem(this.cacheKey + '_enc');
      }
      localStorage.setItem(this.cacheKey + '_syncAt', this.lastSyncAt ?? '');
    } catch {
      // Storage full or unavailable — non-fatal
    }
  }

  async loadLocalCache(sessionId?: string): Promise<boolean> {
    try {
      const raw     = localStorage.getItem(this.cacheKey);
      const isEnc   = localStorage.getItem(this.cacheKey + '_enc') === '1';
      const syncAt  = localStorage.getItem(this.cacheKey + '_syncAt');

      if (!raw) return false;

      let json = raw;
      if (isEnc) {
        if (!this.passphrase) return false;
        json = await decrypt(raw, this.passphrase);
      }

      const loaded = PatientFactStore.deserialize(json, sessionId);
      this.store.loadBatch(loaded.getAll());
      if (syncAt) this.lastSyncAt = syncAt;
      return true;
    } catch {
      return false;
    }
  }

  clearLocalCache() {
    localStorage.removeItem(this.cacheKey);
    localStorage.removeItem(this.cacheKey + '_enc');
    localStorage.removeItem(this.cacheKey + '_syncAt');
  }

  // ── Conflict management ──────────────────────────────────────────────────────

  getConflicts(): SyncConflict[] {
    return [...this.conflicts];
  }

  getPendingConflicts(): SyncConflict[] {
    return this.conflicts.filter(c => c.resolution === 'pending');
  }

  resolveConflict(
    factId: string,
    decision: 'local_wins' | 'remote_wins',
    resolvedBy: string,
  ): boolean {
    const c = this.conflicts.find(x => x.factId === factId && x.resolution === 'pending');
    if (!c) return false;
    c.resolution = decision;
    c.resolvedBy = resolvedBy;
    c.resolvedAt = new Date().toISOString();

    if (decision === 'remote_wins') {
      this.store.loadBatch([c.remoteFact]);
      this.dirty.delete(factId);
    }
    this.emitState();
    return true;
  }

  // ── State ────────────────────────────────────────────────────────────────────

  getState(): SyncState {
    return {
      lastSyncAt: this.lastSyncAt,
      pendingPushCount: this.dirty.size,
      pendingPullCount: 0,
      conflicts: [...this.conflicts],
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
    };
  }

  private emitState() {
    this.onStateChange?.(this.getState());
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.emitState();
  };

  private handleOffline = () => {
    this.isOnline = false;
    this.emitState();
  };
}
