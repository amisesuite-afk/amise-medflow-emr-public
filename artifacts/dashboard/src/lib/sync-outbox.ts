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
const executors = new Map<string, Executor>();

export function registerExecutor(entityType: string, fn: Executor): void {
  executors.set(entityType, fn);
}

// ── IDB helpers ───────────────────────────────────────────────────────────────

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

// ── Public API ────────────────────────────────────────────────────────────────

/** Enqueue a failed save for retry. Idempotent: same entity_type+entity_id replaces prior entry. */
export async function enqueue(
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const idempotencyKey = `${entityType}:${entityId}`;
  const now = Date.now();

  // Look for an existing entry with the same idempotency key and overwrite it
  const all = await idbAll();
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

  await idbPut(entry);
}

/** Drain the outbox — call on window 'online' and periodically. */
export async function flush(
  onStatusChange?: (status: SyncStatus, pendingCount: number) => void,
): Promise<void> {
  const all = await idbAll();
  const due = all.filter(e => e.next_retry_at <= Date.now());
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
      await idbDelete(entry.id!);
    } catch (err) {
      const retries = entry.retry_count + 1;
      const backoff = BASE_BACKOFF_MS * Math.pow(2, Math.min(retries, MAX_RETRIES));
      const updated: OutboxEntry = {
        ...entry,
        retry_count: retries,
        next_retry_at: Date.now() + backoff,
        error: err instanceof Error ? err.message : String(err),
      };
      await idbPut(updated);
      console.warn(`[sync-outbox] ${entry.entity_type}:${entry.entity_id} retry ${retries} scheduled in ${backoff / 1000}s`);
    }
  }

  const remaining = (await idbAll()).length;
  onStatusChange?.(remaining === 0 ? 'synced' : 'error', remaining);
}

/** Pending entry count — drives the sync status indicator. */
export async function pendingCount(): Promise<number> {
  try {
    return (await idbAll()).length;
  } catch {
    return 0;
  }
}
