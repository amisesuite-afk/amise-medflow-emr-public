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

export async function sendWhatsApp(to: string, body: string): Promise<void> {
  const safe = safeBody(body);
  const mode = process.env.MODE ?? 'dry_run';

  if (mode === 'dry_run') {
    console.log(`[DRY RUN] WhatsApp → ${to}:\n${safe}\n`);
    return;
  }

  await getClient().messages.create({
    from: process.env.TWILIO_WHATSAPP_FROM!,
    to,
    body: safe,
  });
}

export async function sendSms(to: string, body: string): Promise<void> {
  const safe = safeBody(body);
  const mode = process.env.MODE ?? 'dry_run';

  if (mode === 'dry_run') {
    console.log(`[DRY RUN] SMS → ${to}:\n${safe}\n`);
    return;
  }

  await getClient().messages.create({
    from: process.env.TWILIO_FROM_NUMBER!,
    to,
    body: safe,
  });
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
  return [
    `AMISE ALERT — ${level}`,
    `Patient: ${name}`,
    `Complaint: ${complaint}`,
    `Review dashboard: ${process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://amise-front-desk.vercel.app/dashboard'}`,
  ].join('\n');
}
