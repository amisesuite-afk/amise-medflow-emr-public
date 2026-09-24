/**
 * Direct WhatsApp senders for the Meta Graph API and Telnyx.
 * (Twilio WhatsApp goes through lib/sms.ts sendSms().)
 *
 * Hazard H-09: these used to post to the provider with no MODE check, so a
 * dry_run deployment still messaged patients. Both now consult the shared
 * outbound gate first and report what actually happened.
 */
import { logger } from './logger.js';
import { outboundBlocked } from './outbound.js';

export type WhatsAppSendResult = 'sent' | 'skipped' | 'failed';

export async function sendMetaWhatsApp(
  to: string,
  text: string,
  opts: { phoneNumberId?: string; apiVersion?: string } = {},
): Promise<WhatsAppSendResult> {
  if (outboundBlocked('whatsapp_meta', { to })) return 'skipped';

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const numId = opts.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !numId) {
    logger.warn('[whatsapp/meta] WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set — cannot send');
    return 'failed';
  }
  try {
    const r = await fetch(`https://graph.facebook.com/${opts.apiVersion ?? 'v19.0'}/${numId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to.replace(/^\+/, ''),
        type: 'text',
        text: { body: text },
      }),
    });
    if (!r.ok) {
      const err = await r.text().catch(() => '');
      logger.warn({ status: r.status, err }, '[whatsapp/meta] send failed');
      return 'failed';
    }
    return 'sent';
  } catch (err) {
    logger.warn({ err }, '[whatsapp/meta] send network error');
    return 'failed';
  }
}

export async function sendTelnyxWhatsApp(to: string, text: string): Promise<WhatsAppSendResult> {
  if (outboundBlocked('whatsapp_telnyx', { to })) return 'skipped';

  const apiKey = process.env.TELNYX_API_KEY;
  const from   = process.env.TWILIO_FROM_NUMBER; // same env var, same number
  if (!apiKey || !from) {
    logger.warn('[whatsapp/telnyx] TELNYX_API_KEY or TWILIO_FROM_NUMBER not set — cannot send');
    return 'failed';
  }
  try {
    const r = await fetch('https://api.telnyx.com/v2/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: `whatsapp:${from}`, to: `whatsapp:${to}`, text }),
    });
    if (!r.ok) {
      logger.warn({ status: r.status }, '[whatsapp/telnyx] send failed');
      return 'failed';
    }
    return 'sent';
  } catch (err) {
    logger.warn({ err }, '[whatsapp/telnyx] send network error');
    return 'failed';
  }
}
