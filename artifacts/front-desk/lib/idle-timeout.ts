/**
 * Idle timeout logic (compliance G-4). Timer-free and DOM-free so it can be
 * unit tested; the component drives `tick()` from an interval and feeds
 * `activity()` from input events.
 *
 * - Timeout: `VITE_IDLE_TIMEOUT_MINUTES` (dashboard) /
 *   `NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES` (front-desk staff pages), default 15,
 *   clamped to 2–120. Unset, empty, zero, negative or non-numeric → 15: the
 *   timeout cannot be switched off by configuration.
 * - A 60-second warning precedes the timeout. While it shows, ordinary
 *   activity does not dismiss it — only "Stay signed in" does, so a mouse
 *   nudged by someone passing does not keep a session alive.
 * - Idleness is measured on the wall clock (not setTimeout durations), so a
 *   throttled background tab or a sleeping laptop still times out on time.
 * - Activity is shared across tabs of the same app through a non-PHI
 *   timestamp in localStorage, so working in one tab keeps the others alive.
 *
 * This is a copy of `artifacts/dashboard/src/lib/idle-timeout.ts` (separate
 * deployments); a dashboard test fails if the two drift.
 */

export const DEFAULT_IDLE_TIMEOUT_MINUTES = 15;
export const MIN_IDLE_TIMEOUT_MINUTES = 2;
export const MAX_IDLE_TIMEOUT_MINUTES = 120;
export const IDLE_WARNING_MS = 60_000;
/** localStorage key holding the last activity time (ms epoch) — not PHI. */
export const SHARED_ACTIVITY_KEY = 'amise-idle-last-activity';
/** Activity writes to the shared key are throttled to one per this many ms. */
const SHARED_WRITE_THROTTLE_MS = 5_000;

export function parseIdleTimeoutMinutes(raw: unknown): number {
  const text = raw === undefined || raw === null ? '' : String(raw).trim();
  const n = Number(text);
  if (text === '' || !Number.isFinite(n) || n <= 0) return DEFAULT_IDLE_TIMEOUT_MINUTES;
  return Math.min(MAX_IDLE_TIMEOUT_MINUTES, Math.max(MIN_IDLE_TIMEOUT_MINUTES, n));
}

export type IdlePhase = 'active' | 'warning' | 'expired';

export interface IdleControllerOptions {
  timeoutMs: number;
  warningMs?: number;
  now?: () => number;
  /** Last activity recorded by any tab (ms epoch), or null. */
  readSharedActivity?: () => number | null;
  writeSharedActivity?: (t: number) => void;
  /** Called on every phase change, and on every tick while warning (for the countdown). */
  onChange: (phase: IdlePhase, remainingMs: number) => void;
}

export interface IdleController {
  /** Call on user input. Ignored once the warning is showing. */
  activity(): void;
  /** The "Stay signed in" button (or a successful unlock): dismisses the warning / expiry and restarts the clock. */
  staySignedIn(): void;
  /** Re-evaluate; call from an interval (about once a second). */
  tick(): void;
  phase(): IdlePhase;
}

export function createIdleController(opts: IdleControllerOptions): IdleController {
  const now = opts.now ?? (() => Date.now());
  const warningMs = Math.min(opts.warningMs ?? IDLE_WARNING_MS, opts.timeoutMs);
  let last = now();
  let lastSharedWrite = 0;
  let phase: IdlePhase = 'active';

  const writeShared = (t: number) => {
    lastSharedWrite = t;
    try { opts.writeSharedActivity?.(t); } catch { /* ignore */ }
  };
  const setPhase = (next: IdlePhase, remaining: number) => {
    const changed = next !== phase;
    phase = next;
    if (changed || next === 'warning') opts.onChange(next, Math.max(0, remaining));
  };

  writeShared(last);

  return {
    activity() {
      if (phase !== 'active') return;
      last = now();
      if (last - lastSharedWrite >= SHARED_WRITE_THROTTLE_MS) writeShared(last);
    },
    staySignedIn() {
      last = now();
      writeShared(last);
      setPhase('active', opts.timeoutMs);
    },
    tick() {
      if (phase === 'expired') return;
      let shared: number | null = null;
      try { shared = opts.readSharedActivity?.() ?? null; } catch { shared = null; }
      // Another tab was used more recently (or pressed "Stay signed in" there).
      if (shared !== null && Number.isFinite(shared) && shared > last && shared <= now()) last = shared;
      const remaining = opts.timeoutMs - (now() - last);
      if (remaining <= 0) setPhase('expired', 0);
      else if (remaining <= warningMs) setPhase('warning', remaining);
      else setPhase('active', remaining);
    },
    phase: () => phase,
  };
}
