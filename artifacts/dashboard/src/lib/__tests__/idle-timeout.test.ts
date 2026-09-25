/**
 * Compliance G-4: idle auto sign-out. Drives the timer-free controller with a
 * fake clock.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  createIdleController, parseIdleTimeoutMinutes, DEFAULT_IDLE_TIMEOUT_MINUTES, IDLE_WARNING_MS,
  type IdlePhase,
} from '@/lib/idle-timeout';

const MIN = 60_000;

function rig(timeoutMin = 15) {
  let t = 1_700_000_000_000;
  let shared: number | null = null;
  const changes: Array<[IdlePhase, number]> = [];
  const ctrl = createIdleController({
    timeoutMs: timeoutMin * MIN,
    now: () => t,
    readSharedActivity: () => shared,
    writeSharedActivity: v => { shared = v; },
    onChange: (p, r) => changes.push([p, r]),
  });
  return {
    ctrl, changes,
    advance(ms: number) { t += ms; ctrl.tick(); },
    otherTabActivity(ms = 0) { shared = t + ms; },
    get shared() { return shared; },
  };
}

describe('parseIdleTimeoutMinutes', () => {
  it('defaults to 15 and cannot be switched off', () => {
    for (const v of [undefined, null, '', '  ', 'abc', '0', '-5', 'NaN', 'Infinity']) {
      expect(parseIdleTimeoutMinutes(v), String(v)).toBe(DEFAULT_IDLE_TIMEOUT_MINUTES);
    }
  });
  it('accepts a configured value, clamped to 2–120', () => {
    expect(parseIdleTimeoutMinutes('10')).toBe(10);
    expect(parseIdleTimeoutMinutes(' 30 ')).toBe(30);
    expect(parseIdleTimeoutMinutes('1')).toBe(2);
    expect(parseIdleTimeoutMinutes('600')).toBe(120);
  });
});

describe('idle controller', () => {
  it('warns 60 s before the timeout, then expires', () => {
    const r = rig(15);
    r.advance(13 * MIN);
    expect(r.ctrl.phase()).toBe('active');
    r.advance(1 * MIN); // 14:00 idle → 60 s left
    expect(r.ctrl.phase()).toBe('warning');
    expect(r.changes.at(-1)).toEqual(['warning', IDLE_WARNING_MS]);
    r.advance(30_000);
    expect(r.changes.at(-1)).toEqual(['warning', 30_000]); // countdown updates each tick
    r.advance(30_000);
    expect(r.ctrl.phase()).toBe('expired');
    expect(r.changes.at(-1)).toEqual(['expired', 0]);
  });

  it('activity before the warning restarts the clock', () => {
    const r = rig(15);
    r.advance(10 * MIN);
    r.ctrl.activity();
    r.advance(10 * MIN);
    expect(r.ctrl.phase()).toBe('active');
    r.advance(5 * MIN);
    expect(r.ctrl.phase()).toBe('expired');
  });

  it('only "Stay signed in" dismisses the warning — stray activity does not', () => {
    const r = rig(15);
    r.advance(14 * MIN + 10_000);
    expect(r.ctrl.phase()).toBe('warning');
    r.ctrl.activity();
    r.advance(1_000);
    expect(r.ctrl.phase()).toBe('warning');
    r.ctrl.staySignedIn();
    expect(r.ctrl.phase()).toBe('active');
    r.advance(10 * MIN);
    expect(r.ctrl.phase()).toBe('active');
  });

  it('uses the wall clock: a throttled/suspended tab expires on its first tick back', () => {
    const r = rig(15);
    r.advance(3 * 60 * MIN); // laptop asleep for 3 h, no ticks in between
    expect(r.ctrl.phase()).toBe('expired');
  });

  it('activity in another tab keeps this tab alive', () => {
    const r = rig(15);
    r.advance(12 * MIN);
    r.otherTabActivity();
    r.advance(12 * MIN);
    expect(r.ctrl.phase()).toBe('active');
    r.advance(3 * MIN);
    expect(r.ctrl.phase()).toBe('expired');
  });

  it('"Stay signed in" in another tab dismisses this tab\'s warning', () => {
    const r = rig(15);
    r.advance(14 * MIN + 30_000);
    expect(r.ctrl.phase()).toBe('warning');
    r.otherTabActivity();
    r.advance(1_000);
    expect(r.ctrl.phase()).toBe('active');
  });

  it('ignores a shared timestamp from the future (clock skew / tampering)', () => {
    const r = rig(15);
    r.otherTabActivity(24 * 60 * MIN);
    r.advance(15 * MIN);
    expect(r.ctrl.phase()).toBe('expired');
  });

  it('expiry is terminal until an explicit restart (unlock)', () => {
    const r = rig(2);
    r.advance(2 * MIN);
    expect(r.ctrl.phase()).toBe('expired');
    r.ctrl.activity();
    r.otherTabActivity();
    r.advance(1_000);
    expect(r.ctrl.phase()).toBe('expired');
    r.ctrl.staySignedIn();
    expect(r.ctrl.phase()).toBe('active');
  });

  it('throttles writes of the shared activity timestamp', () => {
    const r = rig(15);
    const first = r.shared;
    r.advance(1_000);
    r.ctrl.activity();
    expect(r.shared).toBe(first);
    r.advance(5_000);
    r.ctrl.activity();
    expect(r.shared).not.toBe(first);
  });
});

describe('front-desk copy', () => {
  it('artifacts/front-desk/lib/idle-timeout.ts is the same code as the dashboard copy', () => {
    const strip = (s: string) => s.replace(/^\/\*\*[\s\S]*?\*\/\n/, '');
    const here = readFileSync(fileURLToPath(new URL('../idle-timeout.ts', import.meta.url)), 'utf8');
    const fd = readFileSync(fileURLToPath(new URL('../../../../front-desk/lib/idle-timeout.ts', import.meta.url)), 'utf8');
    expect(strip(fd)).toBe(strip(here));
  });
});
