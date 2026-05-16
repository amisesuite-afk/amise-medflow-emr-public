import { logger } from './logger.js';

export interface SmsArgs {
  to: string;
  body: string;
}

export interface SmsResult {
  action: 'sent' | 'skipped';
  providerId?: string;
}

export async function sendSms(args: SmsArgs): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER || 'dry_run';
  const mode = process.env.MODE || 'dry_run';

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
    return { action: 'sent', providerId: msg.sid };
  }

  if (provider === 'digicel') {
    logger.warn('[SMS] Digicel provider not implemented; falling back to log');
    return { action: 'skipped' };
  }

  throw new Error(`Unknown SMS_PROVIDER: ${provider}`);
}

export function smsBody48h(opts: { day: string; date: string; time: string; location: string }): string {
  return `Reminder: appt with Dr Kabiye ${opts.day} ${opts.date} ${opts.time} at ${opts.location}. Reply C to confirm, R to reschedule. Amise Medical.`;
}

export function smsBody2h(opts: { location: string }): string {
  return `Reminder: your appt with Dr Kabiye is in 2 hours at ${opts.location}. See you soon. Amise Medical.`;
}
