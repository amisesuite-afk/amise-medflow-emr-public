import { describe, it, expect } from 'vitest';
import { staffMachineToken } from '@/lib/machine-auth';

const env = (vars: Record<string, string | undefined>) => vars as NodeJS.ProcessEnv;

describe('staffMachineToken (x-staff-token sent to the api-server)', () => {
  it('sends STAFF_MACHINE_TOKEN when set, never CRON_SECRET', () => {
    expect(staffMachineToken(env({ STAFF_MACHINE_TOKEN: 'machine', CRON_SECRET: 'cron' }))).toBe('machine');
  });

  it('falls back to CRON_SECRET while STAFF_MACHINE_TOKEN is unset', () => {
    expect(staffMachineToken(env({ CRON_SECRET: 'cron' }))).toBe('cron');
  });

  it('treats a blank STAFF_MACHINE_TOKEN as unset', () => {
    expect(staffMachineToken(env({ STAFF_MACHINE_TOKEN: '  ', CRON_SECRET: 'cron' }))).toBe('cron');
  });

  it('returns null when neither is set (provisioning is skipped)', () => {
    expect(staffMachineToken(env({}))).toBeNull();
    expect(staffMachineToken(env({ CRON_SECRET: '' }))).toBeNull();
  });
});
