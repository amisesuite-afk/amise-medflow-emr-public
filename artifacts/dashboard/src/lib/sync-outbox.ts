/**
 * IndexedDB-backed sync outbox for clinical autosave operations.
 *
 * Replaces the in-memory offlineQueue (which was lost on page reload).
 * Each failed save is serialized to IndexedDB and retried with exponential
 * back-off.  On reconnect the queue is drained in order of insertion.
 *
 * The outbox does NOT store closures — only serializable descriptors
 * (entity_type, entity_id, payload).  The actual write is performed by
 * the caller-supplied executor registered per entity_type.
 */

export type SyncStatus = 'synced' | 'pending' | 'retrying' | 'conflict' | 'error';

export interface OutboxEntry {
  id?: number;           // IDB auto-increment key
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
  idempotency_key: string;  // entity_type + entity_id + epoch — deduplicates retries
  retry_count: number;
  next_retry_at: number;    // ms epoch
  created_at: number;       // ms epoch
  error?: string;
}

const DB_NAME    = 'amise-sync-outbox';
const DB_VERSION = 1;
const STORE      = 'outbox';

// Max retries before an entry is moved to 'failed' state and reported to UI
const MAX_RETRIES = 5;
// Base back-off in ms (doubles each retry: 2s, 4s, 8s, 16s, 32s)
const BASE_BACKOFF_MS = 2_000;

// Executor registry: callers register handlers per entity_type
type Executor = (entry: OutboxEntry) => Promise<void>;

// ── Permanent refusals ────────────────────────────────────────────────────────
// A write the server refuses for this user's ROLE (Postgres 42501 / permission denied, e.g.
// Migration 89's front-desk column guard on patients.pathway_data_json) will never succeed on
// retry. An executor signals it by throwing OutboxRefusalError: flush() then drops the entry
// instead of retrying it forever, logs it (entity type and id only, no payload), and tells the
// refusal listeners so the UI can show a one-line notice. Same idea as the iOS sync refusals
// (SyncService+Refusals.swift: a 42501 marks the record refused and the sync carries on).

export class OutboxRefusalError extends Error {
  readonly refused = true;
  constructor(message: string) {
    super(message);
    this.name = 'OutboxRefusalError';
  }
}

/** True for a database refusal on permission grounds (42501 / permission denied / RLS). */
export function isPermissionRefusal(
  err: { code?: string | null; message?: string | null } | string | null | undefined,
): boolean {
  if (!err) return false;
  const code = typeof err === 'string' ? '' : (err.code ?? '');
  const message = (typeof err === 'string' ? err : err.message) ?? '';
  return code === '42501' || /permission denied|row-level security|may only change/i.test(message);
}

export function isOutboxRefusal(err: unknown): boolean {
  return err instanceof OutboxRefusalError
    || (typeof err === 'object' && err !== null && (err as { refused?: unknown }).refused === true);
}

export interface OutboxRefusal { entityType: string; message: string }
type RefusalListener = (r: OutboxRefusal) => void;
const refusalListeners = new Set<RefusalListener>();

/** Subscribe to permanent refusals (dropped outbox entries, refused live saves). Returns an unsubscribe. */
export function onOutboxRefusal(fn: RefusalListener): () => void {
  refusalListeners.add(fn);
  return () => { refusalListeners.delete(fn); };
}

/** Tell the refusal listeners. Also used by trackedSave() for a live save refused the same way. */
export function reportRefusal(entityType: string, message: string): void {
  for (const fn of refusalListeners) {
    try { fn({ entityType, message }); } catch { /* a listener must not break the flush */ }
  }
}

/** Refusals for these entity types are permanent: never queued, and dropped if already queued. */
export const REFUSAL_IS_PERMANENT = new Set(['supplements', 'lifestyle_history']);

/** trackedSave(): a failed save that must not be queued (a permanent refusal for its entity type). */
export function isPermanentRefusal(entityType: string | undefined, err: unknown): boolean {
  return !!entityType && REFUSAL_IS_PERMANENT.has(entityType) && isOutboxRefusal(err);
}

const REFUSAL_LABELS: Record<string, string> = {
  supplements: 'herbs, teas & supplements history',
  lifestyle_history: 'fasting, therapies & sleep history',
};

/** The one-line notice for a refusal (no patient data). */
export function describeRefusal(r: Pick<OutboxRefusal, 'entityType'>): string {
  const what = REFUSAL_LABELS[r.entityType] ?? 'change';
  return `Not saved: ${what} — recorded by nurse or doctor (your role cannot change it).`;
}
const executors = new Map<string, Executor>();

export function registerExecutor(entityType: string, fn: Executor): void {
  executors.set(entityType, fn);
}

// ── IDB helpers ───────────────────────────────────────────────────────────────

// The queue's storage. IndexedDB in the app; tests swap in an in-memory store.
export interface OutboxStore {
  all(): Promise<OutboxEntry[]>;
  put(entry: OutboxEntry): Promise<void>;
  delete(id: number): Promise<void>;
}

let _db: IDBDatabase | null = null;

async function openDb(): Promise<IDBDatabase> {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('next_retry_at', 'next_retry_at', { unique: false });
        store.createIndex('idempotency_key', 'idempotency_key', { unique: true });
      }
    };
    req.onsuccess = (e) => { _db = (e.target as IDBOpenDBRequest).result; resolve(_db); };
    req.onerror   = () => reject(req.error);
  });
}

async function idbAll(): Promise<OutboxEntry[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req   = store.getAll();
    req.onsuccess = () => resolve(req.result as OutboxEntry[]);
    req.onerror   = () => reject(req.error);
  });
}

async function idbPut(entry: OutboxEntry): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req   = store.put(entry);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function idbDelete(id: number): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const req   = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

const idbStore: OutboxStore = { all: idbAll, put: idbPut, delete: idbDelete };
let store: OutboxStore = idbStore;

/** Tests only: replace the IndexedDB store (null restores it). */
export function __setOutboxStoreForTests(s: OutboxStore | null): void {
  store = s ?? idbStore;
}

// ── Public API ────────────────────────────────────────────────────────────────

// In-flight enqueue() calls. trackedSave() fires enqueue() without awaiting it,
// so sign-out waits on these before counting what is still unsynced.
const inflight = new Set<Promise<void>>();

/** Resolves once every enqueue() started so far has finished (success or failure). */
export async function whenEnqueuesSettled(): Promise<void> {
  await Promise.allSettled([...inflight]);
}

/** Enqueue a failed save for retry. Idempotent: same entity_type+entity_id replaces prior entry. */
export function enqueue(
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const p = enqueueInner(entityType, entityId, payload);
  inflight.add(p);
  void p.finally(() => inflight.delete(p)).catch(() => {});
  return p;
}

async function enqueueInner(
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const idempotencyKey = `${entityType}:${entityId}`;
  const now = Date.now();

  // Look for an existing entry with the same idempotency key and overwrite it
  const all = await store.all();
  const existing = all.find(e => e.idempotency_key === idempotencyKey);

  const entry: OutboxEntry = {
    ...(existing ?? {}),
    entity_type:    entityType,
    entity_id:      entityId,
    payload,
    idempotency_key: idempotencyKey,
    retry_count:    existing?.retry_count ?? 0,
    next_retry_at:  now,                // retry immediately on reconnect
    created_at:     existing?.created_at ?? now,
  };

  await store.put(entry);
}

/** Drain the outbox — call on window 'online' and periodically. */
export async function flush(
  onStatusChange?: (status: SyncStatus, pendingCount: number) => void,
  /** ignoreBackoff: retry every entry now (used before sign-out), not just those due. */
  opts: { ignoreBackoff?: boolean } = {},
): Promise<void> {
  const all = await store.all();
  const due = opts.ignoreBackoff ? all : all.filter(e => e.next_retry_at <= Date.now());
  if (!due.length) return;

  onStatusChange?.('retrying', due.length);

  for (const entry of due) {
    const executor = executors.get(entry.entity_type);
    if (!executor) {
      // No executor registered — skip silently (will retry next flush)
      continue;
    }
    try {
      await executor(entry);
      await store.delete(entry.id!);
    } catch (err) {
      if (isOutboxRefusal(err)) {
        // Permanent: retrying can never succeed for this user's role. Drop it and say so.
        await store.delete(entry.id!);
        console.warn(`[sync-outbox] ${entry.entity_type}:${entry.entity_id} refused by the server (permission) — dropped, not retried`);
        reportRefusal(entry.entity_type, err instanceof Error ? err.message : String(err));
        continue;
      }
      const retries = entry.retry_count + 1;
      const backoff = BASE_BACKOFF_MS * Math.pow(2, Math.min(retries, MAX_RETRIES));
      const updated: OutboxEntry = {
        ...entry,
        retry_count: retries,
        next_retry_at: Date.now() + backoff,
        error: err instanceof Error ? err.message : String(err),
      };
      await store.put(updated);
      console.warn(`[sync-outbox] ${entry.entity_type}:${entry.entity_id} retry ${retries} scheduled in ${backoff / 1000}s`);
    }
  }

  const remaining = (await store.all()).length;
  onStatusChange?.(remaining === 0 ? 'synced' : 'error', remaining);
}

/** Pending entry count — drives the sync status indicator. */
export async function pendingCount(): Promise<number> {
  try {
    return (await store.all()).length;
  } catch {
    return 0;
  }
}

/** Entity types of the pending entries (for the unsynced-changes warning). No payloads. */
export async function pendingEntityTypes(): Promise<string[]> {
  try {
    return (await store.all()).map(e => e.entity_type);
  } catch {
    return [];
  }
}

/**
 * Delete every queued entry (they hold clinical payloads — PHI). Only called
 * on sign-out, and only when the outbox is already empty or the user has
 * explicitly confirmed discarding the pending changes (secure-sign-out.ts).
 * Clears the store rather than deleting the database so it works while other
 * tabs hold the database open.
 */
export async function clearOutbox(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}
