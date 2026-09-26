/**
 * Compliance G-4: idle auto sign-out on the front-desk staff pages.
 * The controller is shared code with the dashboard (a dashboard test checks
 * the copies match); this covers the front-desk wiring.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createIdleController, parseIdleTimeoutMinutes, type IdlePhase } from '@/lib/idle-timeout';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

describe('front-desk staff idle timeout', () => {
  it('default 15 minutes; env value clamped 2–120; cannot be disabled', () => {
    expect(parseIdleTimeoutMinutes(undefined)).toBe(15);
    expect(parseIdleTimeoutMinutes('0')).toBe(15);
    expect(parseIdleTimeoutMinutes('20')).toBe(20);
    expect(parseIdleTimeoutMinutes('999')).toBe(120);
  });

  it('warns at 14 minutes and expires at 15 unless "Stay signed in" is pressed', () => {
    let t = 0;
    const seen: IdlePhase[] = [];
    const c = createIdleController({ timeoutMs: 15 * 60_000, now: () => t, onChange: p => seen.push(p) });
    t = 14 * 60_000; c.tick();
    expect(c.phase()).toBe('warning');
    c.staySignedIn();
    t += 14 * 60_000 + 59_000; c.tick();
    expect(c.phase()).toBe('warning');
    t += 1_000; c.tick();
    expect(c.phase()).toBe('expired');
    expect(seen).toEqual(['warning', 'active', 'warning', 'expired']);
  });

  it('is mounted on every staff page, reads NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES and signs out properly', () => {
    expect(read('app/staff/layout.tsx')).toMatch(/<StaffIdleTimeout \/>/);
    const comp = read('app/staff/StaffIdleTimeout.tsx');
    // Literal reference, so Next inlines the value into the client bundle.
    expect(comp).toContain('process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES');
    expect(comp).toContain('signOutStaff()');
    expect(comp).toContain("window.location.replace('/staff/login?reason=idle')");
    expect(comp).toMatch(/!pathname\.startsWith\('\/staff\/login'\)/);
  });

  it('the staff login form really calls submit() (onSubmit={void submit} passed undefined)', () => {
    const login = read('app/staff/login/page.tsx');
    expect(login).not.toMatch(/on[A-Z]\w*=\{void \w+\}/);
    expect(login).toContain('onSubmit={e => void submit(e)}');
  });
});
