/**
 * Inventory of what the dashboard keeps in browser storage, and the clearing
 * rules applied on sign-out (compliance G-5, hazard H-16).
 *
 * PHI-bearing — cleared on sign-out:
 *   localStorage
 *     amise-enc-v1               in-progress encounter (demographics, vitals, exam,
 *                                assessment, plan …) — AppContext.tsx
 *     amise-attachments-v1       encounter attachments (base64)       — AppContext.tsx
 *     amise-patient-photo-v1     patient photo (base64)               — AppContext.tsx
 *     amise-exam-photos-v1       exam photos (base64)                 — AppContext.tsx
 *     amise-patients-v1          today's queue / demo patient registry (name, DOB,
 *                                phone) — ReceptionistView, CheckInTab, PatientSearchTab …
 *     amise-hidden-patients-v1   patient ids hidden from search       — PatientSearchTab
 *     amise_followup_v1          follow-up reminders with patient names (LOCAL-ONLY)
 *                                — ClinicalPromptsStrip, FollowUpQueueStrip
 *     outbound_referrals_*       referral drafts not yet saved to the API (LOCAL-ONLY)
 *                                — ReferringProvidersTab
 *     sb-*-auth-token            Supabase session — removed by supabase.auth.signOut()
 *   IndexedDB
 *     amise-sync-outbox          failed autosaves awaiting replay (clinical payloads,
 *                                LOCAL-ONLY until synced) — sync-outbox.ts
 *
 * LOCAL-ONLY data exists nowhere else, so it is never cleared silently: sign-out
 * counts it first and asks for explicit confirmation (secure-sign-out.ts), and
 * the idle timeout locks the screen instead of signing out while any exists.
 *
 * Kept (not PHI):
 *   localStorage  amise_current_site, amise-top-section, amise-notification-prefs,
 *                 amise-ai-provider, amise-idle-last-activity, amise-phi-owner (cleared
 *                 with the PHI keys)
 *   sessionStorage apiDownSuppressed, amise_proto_auth, results_inbox_tab (which Results
 *                 Inbox tab to open: "feed" after the critical-result banner is clicked)
 *   IndexedDB     amise-medflow (learned narrative-term → chip mappings; not tied to a
 *                 patient — see the residual note in docs)
 *   Cache Storage the PWA's static assets and Google Fonts only — /api/* is NetworkOnly
 *                 (vite.config.ts), and Supabase requests are not runtime-cached.
 */

/** PHI caches: copies of server data or a restore cache for the open encounter. */
export const PHI_CACHE_KEYS = [
  'amise-enc-v1',
  'amise-attachments-v1',
  'amise-patient-photo-v1',
  'amise-exam-photos-v1',
  'amise-patients-v1',
  'amise-hidden-patients-v1',
] as const;

export const FOLLOW_UP_KEY = 'amise_followup_v1';
export const REFERRAL_DRAFT_PREFIX = 'outbound_referrals_';

/** Every PHI-bearing localStorage key, including the LOCAL-ONLY ones. */
export const PHI_LOCAL_KEYS = [...PHI_CACHE_KEYS, FOLLOW_UP_KEY] as const;
export const PHI_LOCAL_PREFIXES = [REFERRAL_DRAFT_PREFIX] as const;

/** Records which staff user the PHI keys above belong to (a user id, not PHI). */
export const PHI_OWNER_KEY = 'amise-phi-owner';

type KeyValueStorage = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>;

/** localStorage, or null where it is unavailable (private mode, blocked storage). */
export function browserLocalStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function allKeys(storage: KeyValueStorage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k !== null) keys.push(k);
  }
  return keys;
}

/** PHI-bearing keys currently present in `storage`. */
export function listPhiKeys(storage: KeyValueStorage): string[] {
  return allKeys(storage).filter(k =>
    (PHI_LOCAL_KEYS as readonly string[]).includes(k) ||
    PHI_LOCAL_PREFIXES.some(p => k.startsWith(p)),
  );
}

/** Remove every PHI-bearing key (and the owner marker). Returns the keys removed. */
export function clearPhiWebStorage(storage: KeyValueStorage | null = browserLocalStorage()): string[] {
  if (!storage) return [];
  const keys = listPhiKeys(storage);
  for (const k of keys) {
    try { storage.removeItem(k); } catch { /* ignore */ }
  }
  try { storage.removeItem(PHI_OWNER_KEY); } catch { /* ignore */ }
  return keys;
}

function parseArray(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * Items that exist only in this browser and would be lost by clearing:
 * open follow-up reminders and referral drafts never saved to the API.
 */
export function countLocalOnlyItems(storage: KeyValueStorage | null = browserLocalStorage()): {
  followUps: number;
  referralDrafts: number;
} {
  if (!storage) return { followUps: 0, referralDrafts: 0 };
  let followUps = 0;
  let referralDrafts = 0;
  try {
    followUps = parseArray(storage.getItem(FOLLOW_UP_KEY))
      .filter(i => !(i && typeof i === 'object' && (i as { done?: unknown }).done === true)).length;
    for (const k of allKeys(storage)) {
      if (k.startsWith(REFERRAL_DRAFT_PREFIX)) referralDrafts += parseArray(storage.getItem(k)).length;
    }
  } catch { /* ignore */ }
  return { followUps, referralDrafts };
}

/**
 * Bind the PHI keys to the signed-in staff user. If they were written under a
 * different user (the previous user's session expired, or the tab was closed
 * without signing out), clear the PHI caches — above all the in-progress
 * encounter — before the app restores anything from them, so the next user
 * never sees the previous user's encounter (H-16).
 *
 * LOCAL-ONLY items (follow-up reminders, referral drafts) are NOT cleared
 * here: they exist nowhere else and clearing them needs explicit confirmation
 * (sign-out dialog). A missing owner (data written before this check existed)
 * is adopted rather than cleared. Returns the cache keys cleared.
 */
export function bindPhiStorageToUser(userId: string, storage: KeyValueStorage | null = browserLocalStorage()): string[] {
  if (!storage || !userId) return [];
  const cleared: string[] = [];
  try {
    const owner = storage.getItem(PHI_OWNER_KEY);
    if (owner !== null && owner !== userId) {
      for (const k of PHI_CACHE_KEYS) {
        if (storage.getItem(k) !== null) {
          storage.removeItem(k);
          cleared.push(k);
        }
      }
    }
    storage.setItem(PHI_OWNER_KEY, userId);
  } catch { /* ignore */ }
  return cleared;
}
