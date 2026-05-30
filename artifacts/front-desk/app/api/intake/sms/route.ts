import { NextRequest, NextResponse } from 'next/server';
import { runIntakeTurn } from '@/lib/claude';
import { getOrCreateThread, updateThread, logAudit } from '@/lib/supabase';
import { sendSms, sendWhatsApp, validateTwilioSignature, formatNurseAlert } from '@/lib/twilio';

export const runtime = 'nodejs';

function twimlResponse(body: string): NextResponse {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</Message></Response>`;
  return new NextResponse(xml, { headers: { 'Content-Type': 'text/xml' } });
}

function emptyTwiml(): NextResponse {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    headers: { 'Content-Type': 'text/xml' },
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((v, k) => { params[k] = String(v); });

  const from   = params['From'] ?? '';
  const body   = (params['Body'] ?? '').trim();
  const sigHdr = req.headers.get('x-twilio-signature') ?? '';

  if (!validateTwilioSignature(req.url, params, sigHdr)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (!from || !body) return emptyTwiml();

  try {
    const thread = await getOrCreateThread(from, 'sms');
    const { reply, updatedThread, emergent } = await runIntakeTurn(thread, body);

    const merged = { ...thread, ...updatedThread };
    await updateThread(thread.id, updatedThread);
    await logAudit(thread.id, 'intake_turn', 'claude', {
      channel: 'sms',
      triage_level: merged.triage_level,
      emergent,
    });

    if (emergent) {
      await sendSms(from, reply);
      const nurseWa = process.env.NURSE_ALERT_WHATSAPP;
      if (nurseWa) await sendWhatsApp(nurseWa, formatNurseAlert(merged));
      await logAudit(thread.id, 'emergent_auto_sent', 'system', { to: from });
      return emptyTwiml();
    }

    if (merged.triage_level === 'URGENT') {
      const nurseWa = process.env.NURSE_ALERT_WHATSAPP;
      if (nurseWa) {
        setTimeout(() => {
          void sendWhatsApp(nurseWa, formatNurseAlert(merged));
        }, 2 * 60 * 1000);
      }
      return twimlResponse(
        'Thank you. Your message has been received and a member of our team will contact you shortly.',
      );
    }

    // ROUTINE / INFO — pending_approval if slots found; otherwise continue intake flow
    if (merged.status === 'pending_approval') {
      return twimlResponse(
        'Thank you. We are arranging an appointment for you and will confirm the details shortly.',
      );
    }

    return twimlResponse(reply);
  } catch (err) {
    console.error('[sms-webhook] Error:', err);
    return twimlResponse('Thank you for your message. We will be in touch shortly.');
  }
}
