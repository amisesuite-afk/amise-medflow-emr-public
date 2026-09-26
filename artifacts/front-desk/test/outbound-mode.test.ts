/**
 * Front-desk outbound MODE gate (compliance G-17 / hazard H-09).
 *
 * Every front-desk provider send — Twilio SMS, Twilio WhatsApp and the Gmail
 * confirmation email — must fail closed: an unset, empty or misspelt MODE is
 * dry_run. `supervised` and `auto` keep sending exactly as before. The Twilio
 * and Google SDKs are mocked; nothing leaves the test process.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const sdk = vi.hoisted(() => ({
  twilioCreate: vi.fn().mockResolvedValue({ sid: 'SM_test' }),
  validateRequest: vi.fn().mockReturnValue(false),
  gmailSend: vi.fn().mockResolvedValue({ data: { id: 'gm_test' } }),
}));

vi.mock('twilio', () => {
  const factory = Object.assign(
    () => ({ messages: { create: sdk.twilioCreate } }),
    { validateRequest: sdk.validateRequest },
  );
  return { default: factory };
});

vi.mock('googleapis', () => {
  class OAuth2 { setCredentials() {} }
  class JWT {}
  return {
    google: {
      auth: { OAuth2, JWT },
      gmail: () => ({ users: { messages: { send: sdk.gmailSend } } }),
      calendar: () => ({ events: { insert: vi.fn(), list: vi.fn() } }),
    },
  };
});

const { sendSms, sendWhatsApp, validateTwilioSignature } = await import('@/lib/twilio');
const { sendConfirmationEmail } = await import('@/lib/email');
const { getMode } = await import('@/lib/outbound');

const ENV_KEYS = ['MODE', 'GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REFRESH_TOKEN'] as const;
const saved: Record<string, string | undefined> = {};

function setMode(v: string | undefined) {
  if (v === undefined) delete process.env.MODE;
  else process.env.MODE = v;
}

function email() {
  return sendConfirmationEmail({
    to: 'patient@example.com',
    patientName: 'Test Patient',
    appointmentType: 'new_consult',
    slot: null,
    track: 'routine',
    isConfirmed: false,
  });
}

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  // Gmail OAuth creds present, so only the MODE gate can stop a send.
  process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'test-secret';
  process.env.GOOGLE_OAUTH_REFRESH_TOKEN = 'test-refresh';
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

const FAIL_CLOSED: Array<[string, string | undefined]> = [
  ['unset', undefined],
  ['empty', ''],
  ['explicit dry_run', 'dry_run'],
  ['upper-case DRY_RUN', 'DRY_RUN'],
  ['hyphenated dry-run', 'dry-run'],
  ['misspelt atuo', 'atuo'],
  ['upper-case AUTO', 'AUTO'],
  ['unknown live', 'live'],
  ['misspelt supervise', 'supervise'],
];

describe('front-desk MODE fails closed', () => {
  for (const [label, value] of FAIL_CLOSED) {
    it(`MODE ${label} → no SMS, WhatsApp or email leaves the server`, async () => {
      setMode(value);
      expect(getMode()).toBe('dry_run');
      await sendSms('+17580000000', 'Your appointment request has been received.');
      await sendWhatsApp('whatsapp:+17580000000', 'Your appointment request has been received.');
      const ok = await email();
      expect(sdk.twilioCreate).not.toHaveBeenCalled();
      expect(sdk.gmailSend).not.toHaveBeenCalled();
      // Dry-run email still reports success to callers (unchanged behaviour).
      expect(ok).toBe(true);
    });
  }
});

describe('front-desk supervised / auto still send', () => {
  for (const value of ['supervised', 'auto', ' auto ']) {
    it(`MODE=${JSON.stringify(value)} sends SMS, WhatsApp and email`, async () => {
      setMode(value);
      await sendSms('+17580000000', 'Your appointment request has been received.');
      await sendWhatsApp('whatsapp:+17580000000', 'Your appointment request has been received.');
      const ok = await email();
      expect(sdk.twilioCreate).toHaveBeenCalledTimes(2);
      expect(sdk.gmailSend).toHaveBeenCalledTimes(1);
      expect(ok).toBe(true);
    });
  }

  it('the forbidden-content screen still applies when sending', async () => {
    setMode('auto');
    await sendSms('+17580000000', 'Your biopsy result shows cancer');
    const body = (sdk.twilioCreate.mock.calls[0][0] as { body: string }).body;
    expect(body).toMatch(/member of our team will be in touch/);
  });
});

describe('inbound Twilio signature check does not fail open', () => {
  it('a misspelt or unset MODE still validates the signature', () => {
    for (const v of [undefined, '', 'DRY_RUN', 'atuo']) {
      setMode(v);
      expect(validateTwilioSignature('https://x/api/intake/sms', {}, 'bad')).toBe(false);
    }
    expect(sdk.validateRequest).toHaveBeenCalledTimes(4);
  });
});

describe('no front-desk sender bypasses lib/outbound.ts', () => {
  it('only lib/outbound.ts (and the inbound signature check) read process.env.MODE', () => {
    const root = fileURLToPath(new URL('../', import.meta.url));
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (['node_modules', '.next', 'test', 'public'].includes(name)) continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(name)) continue;
        const rel = relative(root, p);
        if (rel === join('lib', 'outbound.ts')) continue;
        readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
          if (!/process\.env\.MODE\b/.test(line)) return;
          if (rel === join('lib', 'twilio.ts') && /validateTwilioSignature|return true;/.test(line)) return;
          offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
