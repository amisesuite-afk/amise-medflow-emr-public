import { logger } from './logger.js';

export interface SmsArgs {
  to: string;
  body: string;
}

export interface SmsResult {
  action: 'sent' | 'skipped';
  providerId?: string;
}

// Process-level dedup — prevents identical (to + body) sends within 60 seconds.
// Resets on process restart; prevents double-submit acks and rapid webhook replays
// without blocking legitimate reminder sequences which differ in body or timing.
const recentSends = new Map<string, number>();
const SMS_DEDUP_MS = 60_000;

export async function sendSms(args: SmsArgs): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER || 'dry_run';
  const mode = process.env.MODE || 'dry_run';

  // Dedup key = to + first 40 chars of body (enough to distinguish message types)
  const dedupKey = `${args.to}:${args.body.slice(0, 40)}`;
  const now = Date.now();
  const lastSent = recentSends.get(dedupKey);
  if (lastSent && now - lastSent < SMS_DEDUP_MS) {
    logger.info({ to: args.to }, '[SMS] duplicate suppressed (cooldown)');
    return { action: 'skipped' };
  }

  if (provider === 'dry_run' || mode === 'dry_run') {
    logger.info({ to: args.to }, '[SMS dry-run]');
    return { action: 'skipped' };
  }

  if (provider === 'twilio') {
    const { default: twilio } = await import('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
    const msg = await client.messages.create({
      from: process.env.TWILIO_FROM_NUMBER!,
      to: args.to,
      body: args.body,
    });
    recentSends.set(dedupKey, now);
    return { action: 'sent', providerId: msg.sid };
  }

  if (provider === 'digicel') {
    logger.warn('[SMS] Digicel provider not implemented; falling back to log');
    return { action: 'skipped' };
  }

  throw new Error(`Unknown SMS_PROVIDER: ${provider}`);
}

// Procedure types that require preparation instructions
const PREP_INSTRUCTIONS: Record<string, string> = {
  colonoscopy:
    'PREP REQUIRED: Clear fluids only the day before (no solid food). Take your prescribed bowel prep solution as directed. Nothing by mouth from midnight. Arrange a driver — you cannot drive after sedation.',
  ogd:
    'PREP REQUIRED: Nothing to eat or drink from midnight before your gastroscopy. You may take essential medications with a small sip of water. Arrange a driver home.',
  egd:
    'PREP REQUIRED: Nothing to eat or drink from midnight before your gastroscopy. You may take essential medications with a small sip of water. Arrange a driver home.',
  ercp_workup:
    'PREP REQUIRED: Nothing to eat or drink from midnight. Stop blood thinners as advised by your doctor. Arrange a driver — you cannot drive after sedation.',
  pre_op:
    'PRE-OP INSTRUCTIONS: Nothing to eat or drink from midnight. Continue essential medications with a small sip of water unless advised otherwise. Bring your medication list.',
  flexi_sig:
    'PREP REQUIRED: Follow your bowel prep instructions. Clear fluids only on the morning of the procedure. Arrange a driver home.',
};

export function getPrepInstructions(appointmentType: string): string | null {
  return PREP_INSTRUCTIONS[appointmentType.toLowerCase()] ?? null;
}

export function requiresPrep(appointmentType: string): boolean {
  return appointmentType.toLowerCase() in PREP_INSTRUCTIONS;
}

export function smsBodyBookingAck(opts: { firstName: string; appointmentType: string; phone: string }): string {
  const typeLabel = opts.appointmentType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `Hi ${opts.firstName}, we've received your ${typeLabel} request at Amise Medical Services. Our team will confirm your appointment shortly. Questions? Call ${opts.phone}. – Amise Medical`;
}

export function smsBodyStaffNewBooking(opts: {
  patientName: string;
  appointmentType: string;
  preferredSlot: string | null;
  patientPhone: string | null;
  bookingId: string;
}): string {
  const typeLabel = opts.appointmentType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const slot = opts.preferredSlot ? ` — preferred: ${opts.preferredSlot}` : '';
  const phone = opts.patientPhone ? ` Ph: ${opts.patientPhone}` : '';
  return `NEW BOOKING [${opts.bookingId.slice(0, 8)}]: ${opts.patientName} — ${typeLabel}${slot}.${phone} Action in the Amise dashboard.`;
}

export function smsBodyStaffEscalation(opts: {
  patientName: string;
  appointmentType: string;
  hoursWaiting: number;
  bookingId: string;
  patientPhone: string | null;
}): string {
  const typeLabel = opts.appointmentType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const phone = opts.patientPhone ? ` Ph: ${opts.patientPhone}` : '';
  return `UNACTIONED BOOKING [${opts.bookingId.slice(0, 8)}] ${opts.hoursWaiting}h: ${opts.patientName} — ${typeLabel}.${phone} Please confirm or contact patient.`;
}

export function smsBody48h(opts: { day: string; date: string; time: string; location: string; prepInstructions?: string | null }): string {
  const base = `Reminder: appt with Dr Kabiye ${opts.day} ${opts.date} ${opts.time} at ${opts.location}. Reply C to confirm, R to reschedule. Amise Medical.`;
  if (opts.prepInstructions) {
    return `${base}\n\n${opts.prepInstructions}`;
  }
  return base;
}

export function smsBody2h(opts: { location: string }): string {
  return `Reminder: your appt with Dr Kabiye is in 2 hours at ${opts.location}. See you soon. Amise Medical.`;
}

export function smsBodyIntakeReminder(opts: { firstName: string; portalOrigin: string }): string {
  return `Hi ${opts.firstName}, before your visit with Dr Kabiye please take 2 mins to complete your pre-visit questionnaire: ${opts.portalOrigin}/patient/intake — it helps us prepare for your appointment. Amise Medical.`;
}

export function smsBodyPostVisit(opts: { firstName: string }): string {
  return `Hi ${opts.firstName}, we hope your visit with Dr Kabiye went well yesterday. If you have any concerns about your recovery, please call us on 758-284-0557. For a medical emergency, call 911 or go to the nearest ED. – Amise Medical`;
}

export function smsBodyStaffChangeRequest(opts: {
  patientName: string;
  appointmentType: string;
  changeType: 'reschedule' | 'cancel';
  appointmentDate: string;
  patientPhone: string | null;
  requestId: string;
}): string {
  const typeLabel = opts.appointmentType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const action = opts.changeType === 'cancel' ? 'CANCEL REQUEST' : 'RESCHEDULE REQUEST';
  const phone = opts.patientPhone ? ` Ph: ${opts.patientPhone}` : '';
  return `${action} [${opts.requestId.slice(0, 8)}]: ${opts.patientName} — ${typeLabel} on ${opts.appointmentDate}.${phone} Please contact patient to confirm.`;
}
