/**
 * P3 — IndexedDB learning store.
 *
 * Every time a cloud or Ollama parse returns chips that the local engine
 * missed, those (term → chipMatch) pairs are written here.  On the next
 * encounter the local engine reads them back and matches without any
 * network call.
 *
 * The learned terms are also periodically exportable for cross-device
 * sync via Supabase (Phase 3b, not yet implemented).
 */

const DB_NAME    = 'amise-medflow';
const STORE_NAME = 'learned_terms';
const DB_VERSION = 1;

export interface LearnedTerm {
  id?: number;
  term: string;        // normalised source phrase (from narrative)
  chipMatch: string;   // exact chip label it maps to
  section: string;     // 'pmh' | 'medications' | 'allergies'
  useCount: number;
  lastSeen: string;    // ISO date string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('termSection', ['term', 'section'], { unique: true });
        store.createIndex('section', 'section', { unique: false });
      }
    };

    req.onsuccess  = () => resolve(req.result);
    req.onerror    = () => reject(req.error);
  });
}

export async function saveLearnedTerm(term: Omit<LearnedTerm, 'id'>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const idx   = store.index('termSection');
    const getReq = idx.get([term.term, term.section]);

    getReq.onsuccess = () => {
      const existing = getReq.result as LearnedTerm | undefined;
      if (existing) {
        store.put({ ...existing, useCount: existing.useCount + 1, lastSeen: term.lastSeen });
      } else {
        store.add(term);
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function getLearnedTerms(section?: string): Promise<LearnedTerm[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = section
      ? store.index('section').getAll(section)
      : store.getAll();

    req.onsuccess = () => resolve((req.result ?? []) as LearnedTerm[]);
    req.onerror   = () => reject(req.error);
  });
}

export async function deleteLearnedTerm(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function getAllLearnedTerms(): Promise<LearnedTerm[]> {
  return getLearnedTerms();
}
