// Hazards H-09 (outbound MODE gate / forbidden-content bypass) and H-10
// (blanket medication advice in automated prep messages).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkForbiddenContent } from '@workspace/triage-engine';

const g = vi.hoisted(() => ({
  gmailSend:   vi.fn(),
  gmailDraft:  vi.fn(),
  calInsert:   vi.fn(),
  calPatch:    vi.fn(),
  twilioCreate: vi.fn(),
}));

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: class { setCredentials() {} },
      JWT:    class {},
    },
    gmail:    () => ({ users: { messages: { send: g.gmailSend }, drafts: { create: g.gmailDraft } } }),
    calendar: () => ({ events: { insert: g.calInsert, patch: g.calPatch } }),
  },
}));

vi.mock('twilio', () => ({
  default: () => ({ messages: { create: g.twilioCreate } }),
}));

const { sendOrDraft } = await import('../lib/gmail.js');
const { sendSms, allPrepInstructions, getPrepInstructions, smsBody48h } = await import('../lib/sms.js');
const { sendMetaWhatsApp, sendTelnyxWhatsApp } = await import('../lib/whatsapp-send.js');
const { createEvent, updateEventDescription } = await import('../lib/calendar.js');
const { getMode, resolveEmailMode, reminderEmailMode } = await import('../lib/outbound.js');

const ENV_KEYS = [
  'MODE', 'SMS_PROVIDER', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER',
  'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'TELNYX_API_KEY',
  'GOOGLE_SERVICE_ACCOUNT_JSON', 'REMINDER_EMAIL_AUTO_SEND',
] as const;
const saved: Record<string, string | undefined> = {};
let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  vi.clearAllMocks();
  g.gmailSend.mockResolvedValue({ data: { id: 'msg-1' } });
  g.gmailDraft.mockResolvedValue({ data: { id: 'draft-1' } });
  g.calInsert.mockResolvedValue({ data: { id: 'ev-1' } });
  g.calPatch.mockResolvedValue({ data: {} });
  g.twilioCreate.mockResolvedValue({ sid: 'SM1' });
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: 'svc@test', private_key: 'k' });
  process.env.TWILIO_ACCOUNT_SID = 'ACtest';
  process.env.TWILIO_AUTH_TOKEN = 'test';
  process.env.TWILIO_FROM_NUMBER = '+17580000000';
  process.env.WHATSAPP_ACCESS_TOKEN = 'wa-test';
  process.env.WHATSAPP_PHONE_NUMBER_ID = '123';
  process.env.TELNYX_API_KEY = 'tx-test';
  delete process.env.REMINDER_EMAIL_AUTO_SEND;
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
});

afterEach(() => {
  fetchSpy.mockRestore();
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

// ── MODE resolution ───────────────────────────────────────────────────────────

describe('MODE resolution (lib/outbound.ts)', () => {
  it('fails closed to dry_run for missing or unrecognised MODE values', () => {
    delete process.env.MODE;
    expect(getMode()).toBe('dry_run');
    process.env.MODE = 'Auto';
    expect(getMode()).toBe('dry_run');
    process.env.MODE = 'live';
    expect(getMode()).toBe('dry_run');
  });

  it('a forced mode can never lift dry_run', () => {
    process.env.MODE = 'dry_run';
    expect(resolveEmailMode('auto')).toBe('dry_run');
    expect(resolveEmailMode('supervised')).toBe('dry_run');
  });

  it('ignores a malformed override (e.g. arbitrary req.body.mode)', () => {
    process.env.MODE = 'supervised';
    expect(resolveEmailMode('send-it' as never)).toBe('supervised');
  });

  it('REMINDER_EMAIL_AUTO_SEND only promotes supervised → auto, never dry_run', () => {
    process.env.MODE = 'supervised';
    expect(reminderEmailMode()).toBeUndefined();
    process.env.REMINDER_EMAIL_AUTO_SEND = 'true';
    expect(reminderEmailMode()).toBe('auto');
    process.env.MODE = 'dry_run';
    expect(reminderEmailMode()).toBeUndefined();
  });
});

// ── Email ─────────────────────────────────────────────────────────────────────

describe('sendOrDraft MODE gate', () => {
  const args = { to: 'patient@example.com', subject: 'Reminder', body: 'See you tomorrow.' };

  it('dry_run blocks even a forced auto send (the old cron.ts:85 behaviour)', async () => {
    process.env.MODE = 'dry_run';
    const r = await sendOrDraft(args, 'auto');
    expect(r.action).toBe('skipped');
    expect(g.gmailSend).not.toHaveBeenCalled();
    expect(g.gmailDraft).not.toHaveBeenCalled();
  });

  it('supervised drafts rather than sends', async () => {
    process.env.MODE = 'supervised';
    const r = await sendOrDraft(args);
    expect(r.action).toBe('drafted');
    expect(g.gmailDraft).toHaveBeenCalledTimes(1);
    expect(g.gmailSend).not.toHaveBeenCalled();
  });

  it('auto sends', async () => {
    process.env.MODE = 'auto';
    const r = await sendOrDraft(args);
    expect(r.action).toBe('sent');
    expect(g.gmailSend).toHaveBeenCalledTimes(1);
  });
});

// ── SMS ───────────────────────────────────────────────────────────────────────

describe('sendSms MODE gate', () => {
  it('dry_run blocks Twilio even when SMS_PROVIDER=twilio', async () => {
    process.env.MODE = 'dry_run';
    process.env.SMS_PROVIDER = 'twilio';
    const r = await sendSms({ to: '+17581111111', body: 'dry-run gate test 1' });
    expect(r.action).toBe('skipped');
    expect(g.twilioCreate).not.toHaveBeenCalled();
  });

  it('an unrecognised MODE fails closed', async () => {
    process.env.MODE = 'live';
    process.env.SMS_PROVIDER = 'twilio';
    const r = await sendSms({ to: '+17581111112', body: 'dry-run gate test 2' });
    expect(r.action).toBe('skipped');
    expect(g.twilioCreate).not.toHaveBeenCalled();
  });

  it('supervised sends via Twilio', async () => {
    process.env.MODE = 'supervised';
    process.env.SMS_PROVIDER = 'twilio';
    const r = await sendSms({ to: '+17581111113', body: 'supervised gate test 3', forceChannel: 'sms' });
    expect(r.action).toBe('sent');
    expect(g.twilioCreate).toHaveBeenCalledTimes(1);
  });
});

// ── WhatsApp (Meta / Telnyx) ──────────────────────────────────────────────────

describe('WhatsApp Meta / Telnyx MODE gate', () => {
  it('dry_run blocks the Meta Graph API send', async () => {
    process.env.MODE = 'dry_run';
    expect(await sendMetaWhatsApp('+17581234567', 'hello')).toBe('skipped');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('dry_run blocks the Telnyx send', async () => {
    process.env.MODE = 'dry_run';
    expect(await sendTelnyxWhatsApp('+17581234567', 'hello')).toBe('skipped');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('supervised sends via Meta and Telnyx', async () => {
    process.env.MODE = 'supervised';
    expect(await sendMetaWhatsApp('+17581234567', 'hello', { phoneNumberId: '999', apiVersion: 'v20.0' })).toBe('sent');
    expect(await sendTelnyxWhatsApp('+17581234567', 'hello')).toBe('sent');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[0][0])).toBe('https://graph.facebook.com/v20.0/999/messages');
    expect(String(fetchSpy.mock.calls[1][0])).toBe('https://api.telnyx.com/v2/messages');
  });

  it('reports failed (not silently ok) when the provider rejects', async () => {
    process.env.MODE = 'auto';
    fetchSpy.mockResolvedValueOnce(new Response('bad', { status: 400 }));
    expect(await sendMetaWhatsApp('+17581234567', 'hello')).toBe('failed');
  });
});

// ── Calendar ──────────────────────────────────────────────────────────────────

describe('calendar write MODE gate', () => {
  it('dry_run blocks createEvent (which emails the patient an invitation) and description patches', async () => {
    process.env.MODE = 'dry_run';
    const r = await createEvent({
      appointmentType: 'new_consult', location: 'rodney_bay',
      start: new Date('2026-10-01T13:00:00Z'), end: new Date('2026-10-01T13:30:00Z'),
      patientName: 'Test Patient', patientEmail: 'p@example.com',
    });
    expect(r.eventId).toBeNull();
    await updateEventDescription('cal', 'ev', 'desc');
    expect(g.calInsert).not.toHaveBeenCalled();
    expect(g.calPatch).not.toHaveBeenCalled();
  });

  it('supervised writes to the calendar', async () => {
    process.env.MODE = 'supervised';
    await updateEventDescription('cal', 'ev', 'desc');
    expect(g.calPatch).toHaveBeenCalledTimes(1);
  });
});

// ── H-10: prep templates ──────────────────────────────────────────────────────

describe('endoscopy / pre-op prep templates (H-10)', () => {
  const templates = Object.entries(allPrepInstructions());
  const MED_HOLD = /\b(do not|don'?t|stop|hold|omit|skip)\b/i;

  it('covers the procedure templates that used to carry medication-hold advice', () => {
    for (const t of ['colonoscopy', 'ogd', 'egd', 'ercp_workup', 'pre_op', 'flexi_sig']) {
      expect(getPrepInstructions(t), t).toBeTruthy();
    }
  });

  it.each(templates)('%s: no sentence pairs insulin with do not / don\'t / stop', (_name, text) => {
    const sentences = text.split(/\n|(?<=[.!?])\s+/);
    for (const s of sentences) {
      if (/insulin/i.test(s)) expect(s, s).not.toMatch(MED_HOLD);
    }
  });

  it.each(templates)('%s: gives no instruction to take, stop or hold any medicine', (_name, text) => {
    const sentences = text.split(/\n|(?<=[.!?])\s+/);
    const MEDICINE = /\b(insulin|diabetes tablets?|blood thinners?|anticoagulants?|medications?|medicines?)\b/i;
    const INSTRUCTION = /\b(do not take|don'?t take|do not stop|stop taking|hold|take (your|essential|any)|you may take)\b/i;
    for (const s of sentences) {
      if (MEDICINE.test(s)) expect(s, s).not.toMatch(INSTRUCTION);
    }
  });

  it.each(templates)('%s: passes the FORBIDDEN_PATTERNS screen', (_name, text) => {
    expect(checkForbiddenContent(text)).toEqual({ safe: true, violations: [] });
  });

  it('medication-holding templates point the patient to the clinic instead', () => {
    for (const t of ['colonoscopy', 'ogd', 'egd', 'ercp_workup', 'pre_op', 'flexi_sig']) {
      expect(getPrepInstructions(t)).toContain(
        'If you take insulin, blood thinners or diabetes medicines, please call the clinic before your procedure for instructions.',
      );
    }
  });

  it('the 48h SMS body with prep appended is also clean', () => {
    const body = smsBody48h({ day: 'Mon', date: '5 Oct', time: '09:00', location: 'Tapion', prepInstructions: getPrepInstructions('pre_op') });
    expect(body).not.toMatch(/do not take[^.]*insulin/i);
    expect(checkForbiddenContent(body).safe).toBe(true);
  });
});
