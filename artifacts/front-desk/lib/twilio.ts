import twilio from 'twilio';
import type { ConversationThread } from '@/types';
import { FORBIDDEN_PATTERNS } from './constants';

let _client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!_client) {
    _client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!,
    );
  }
  return _client;
}

export function checkForbidden(text: string): boolean {
  return FORBIDDEN_PATTERNS.some(p => p.test(text));
}

function safeBody(text: string): string {
  if (checkForbidden(text)) {
    console.warn('[SAFETY] Forbidden pattern in outbound message — replaced with safe fallback');
    return 'Thank you for your message. A member of our team will be in touch with you shortly.';
  }
  return text;
}

// sendWhatsApp/sendSms are called from 7 routes. Some (nurse/approve) rely
// on a thrown error to know the patient was never actually notified, so
// this still throws — swallowing here unconditionally would make that route
// silently report success on a failed send. What was missing was structured
// logging before the throw (an uncaught Twilio error previously surfaced as
// a bare stack trace with no `to`/channel context) — added below. Call
// sites where the send is genuinely best-effort (a booking already
// succeeded regardless of whether its confirmation text arrives) are
// responsible for their own local try/catch, same as booking/create's and
// referral/create's nurse-alert sends already do.
export async function sendWhatsApp(to: string, body: string): Promise<void> {
  const safe = safeBody(body);
  const mode = process.env.MODE ?? 'dry_run';

  if (mode === 'dry_run') {
    console.log(`[DRY RUN] WhatsApp → ${to}:\n${safe}\n`);
    return;
  }

  try {
    await getClient().messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM!,
      to,
      body: safe,
    });
  } catch (err) {
    console.error('[twilio] sendWhatsApp failed:', { to, err: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export async function sendSms(to: string, body: string): Promise<void> {
  const safe = safeBody(body);
  const mode = process.env.MODE ?? 'dry_run';

  if (mode === 'dry_run') {
    console.log(`[DRY RUN] SMS → ${to}:\n${safe}\n`);
    return;
  }

  try {
    await getClient().messages.create({
      from: process.env.TWILIO_FROM_NUMBER!,
      to,
      body: safe,
    });
  } catch (err) {
    console.error('[twilio] sendSms failed:', { to, err: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  if (process.env.MODE === 'dry_run') return true;
  return twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN!,
    signature,
    url,
    params,
  );
}

export function formatNurseAlert(thread: ConversationThread): string {
  const level = thread.triage_level;
  const name = thread.patient_name ?? 'Unknown patient';
  const complaint = thread.chief_complaint ?? 'Not specified';
  const lines = [
    `AMISE ALERT — ${level}`,
    `Patient: ${name}`,
    `Complaint: ${complaint}`,
  ];
  if (process.env.NEXT_PUBLIC_DASHBOARD_URL) {
    lines.push(`Review dashboard: ${process.env.NEXT_PUBLIC_DASHBOARD_URL}`);
  }
  return lines.join('\n');
}
