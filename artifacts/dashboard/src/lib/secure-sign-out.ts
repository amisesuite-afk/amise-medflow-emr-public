/**
 * Sign-out preparation and clean-up (compliance G-4 / G-5, hazards H-13 / H-16).
 *
 * Before any sign-out (manual or idle):
 *   1. run the registered before-sign-out hooks (AppContext flushes its
 *      debounced autosaves, so an edit typed seconds ago is saved or queued);
 *   2. wait for in-flight outbox enqueues;
 *   3. try to drain the IndexedDB outbox now, ignoring back-off;
 *   4. count what would still be lost: pending outbox entries plus LOCAL-ONLY
 *      localStorage items (open follow-up reminders, referral drafts).
 * If that count is non-zero, sign-out needs an explicit "discard" from the
 * user (manual), or does not happen at all (idle — the screen locks instead).
 * Clinical edits are never destroyed silently.
 *
 * After sign-out: every PHI-bearing localStorage key and the outbox are cleared
 * (phi-storage.ts has the inventory). Non-PHI preferences are kept.
 */
import { clearPhiWebStorage, countLocalOnlyItems, browserLocalStorage } from './phi-storage';

export interface UnsyncedSummary {
  /** Failed autosaves still queued in the IndexedDB outbox. */
  outbox: number;
  /** Open follow-up reminders stored only in this browser. */
  followUps: number;
  /** Referral drafts stored only in this browser. */
  referralDrafts: number;
  total: number;
  /** Entity types of the queued outbox entries (e.g. "assessment", "plan"). */
  outboxTypes: string[];
}

export interface SignOutDeps {
  flushOutbox(): Promise<void>;
  pendingOutbox(): Promise<number>;
  pendingOutboxTypes?(): Promise<string[]>;
  whenEnqueuesSettled?(): Promise<void>;
  clearOutbox(): Promise<void>;
  storage?: Parameters<typeof clearPhiWebStorage>[0];
}

type Hook = () => void | Promise<void>;
const hooks = new Set<Hook>();

/** Register work that must run before sign-out (returns an unregister function). */
export function registerBeforeSignOut(fn: Hook): () => void {
  hooks.add(fn);
  return () => { hooks.delete(fn); };
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise(resolve => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(fallback); });
  });
}

/**
 * Save what can be saved, then report what would still be lost.
 * Never throws; each step is time-boxed so a dead backend cannot hang sign-out.
 */
export async function prepareSignOut(
  deps: SignOutDeps,
  opts: { hookTimeoutMs?: number; flushTimeoutMs?: number } = {},
): Promise<UnsyncedSummary> {
  const hookTimeoutMs  = opts.hookTimeoutMs  ?? 8_000;
  const flushTimeoutMs = opts.flushTimeoutMs ?? 10_000;

  await withTimeout(
    Promise.allSettled([...hooks].map(h => Promise.resolve().then(h))).then(() => undefined),
    hookTimeoutMs, undefined,
  );
  if (deps.whenEnqueuesSettled) await withTimeout(deps.whenEnqueuesSettled(), hookTimeoutMs, undefined);
  await withTimeout(deps.flushOutbox().catch(() => undefined), flushTimeoutMs, undefined);

  // If the count itself fails, assume there IS unsynced data (fail safe).
  const outbox = await withTimeout(deps.pendingOutbox(), 5_000, -1);
  const outboxCount = outbox < 0 ? 1 : outbox;
  const outboxTypes = outboxCount > 0 && deps.pendingOutboxTypes
    ? await withTimeout(deps.pendingOutboxTypes(), 5_000, [] as string[])
    : [];
  const local = countLocalOnlyItems(deps.storage === undefined ? browserLocalStorage() : deps.storage);
  return {
    outbox: outboxCount,
    followUps: local.followUps,
    referralDrafts: local.referralDrafts,
    total: outboxCount + local.followUps + local.referralDrafts,
    outboxTypes: [...new Set(outboxTypes)],
  };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "3 unsaved changes and 1 follow-up reminder stored only in this browser" */
export function describeUnsynced(s: UnsyncedSummary): string {
  const parts: string[] = [];
  if (s.outbox) parts.push(plural(s.outbox, 'unsaved change', 'unsaved changes'));
  if (s.followUps) parts.push(plural(s.followUps, 'follow-up reminder', 'follow-up reminders') + ' stored only in this browser');
  if (s.referralDrafts) parts.push(plural(s.referralDrafts, 'referral draft', 'referral drafts') + ' stored only in this browser');
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** The confirmation question shown before discarding: "N unsaved changes will be lost — stay signed in to sync?" */
export function unsyncedQuestion(s: UnsyncedSummary): string {
  return `${describeUnsynced(s)} will be lost — stay signed in to sync?`;
}

/**
 * Clear PHI after the Supabase session has been ended. Call only when
 * prepareSignOut() found nothing unsynced, or the user explicitly chose to
 * discard it.
 */
export async function clearPhiAfterSignOut(deps: SignOutDeps): Promise<{ keys: string[]; outboxCleared: boolean }> {
  const keys = clearPhiWebStorage(deps.storage === undefined ? browserLocalStorage() : deps.storage);
  let outboxCleared = false;
  try {
    await deps.clearOutbox();
    outboxCleared = true;
  } catch { /* IndexedDB unavailable — nothing stored there */ }
  return { keys, outboxCleared };
}

export type SignOutReason = 'manual' | 'idle';
export type SignOutOutcome =
  | { status: 'signed_out' }
  /** The user chose "Stay signed in" in the unsynced-changes dialog. */
  | { status: 'cancelled' }
  /** Idle sign-out refused: unsynced data exists and nobody is there to confirm. */
  | { status: 'blocked'; summary: UnsyncedSummary };

/**
 * The whole sign-out decision, UI-agnostic (AuthContext supplies the pieces):
 *   prepare → (unsynced? idle: blocked | manual: ask) → end session → clear PHI.
 * PHI is cleared only after the session has ended, and unsynced data only
 * after an explicit discard.
 */
export async function runSecureSignOut(args: {
  reason: SignOutReason;
  deps: SignOutDeps;
  /** Ask the user; resolve true to discard and sign out, false to stay. */
  confirmDiscard(summary: UnsyncedSummary): Promise<boolean>;
  endSession(): Promise<void>;
  onPrepareStart?(): void;
  onPrepareEnd?(): void;
}): Promise<SignOutOutcome> {
  args.onPrepareStart?.();
  let summary: UnsyncedSummary;
  try {
    summary = await prepareSignOut(args.deps);
  } finally {
    args.onPrepareEnd?.();
  }
  if (summary.total > 0) {
    if (args.reason === 'idle') return { status: 'blocked', summary };
    if (!(await args.confirmDiscard(summary))) return { status: 'cancelled' };
  }
  await args.endSession().catch(e => console.error('[sign-out] ending the session failed:', e));
  await clearPhiAfterSignOut(args.deps);
  return { status: 'signed_out' };
}
