/**
 * Gmail-based email sender for patient appointment confirmations.
 * Uses the same Google credentials as calendar.ts.
 * Sends HTML emails with full procedure-specific patient instructions.
 */
import { google } from 'googleapis';
import { getInstructions, type ProcedureInstructions } from '@/lib/instructions';
import { LOCATION_LABELS } from '@/lib/calendar';
import type { BookingTrack } from '@/lib/scheduling';

const GMAIL_FROM = process.env.GMAIL_USER ?? 'noreply@amisemedicalservices.com';
const GMAIL_FROM_NAME = 'Amise Medical Services';

function getGmailAuth() {
  if (
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
    process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  ) {
    const oauth = new google.auth.OAuth2(
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      'urn:ietf:wg:oauth:2.0:oob',
    );
    oauth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
    return oauth;
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) as {
      client_email: string;
      private_key: string;
    };
    return new google.auth.JWT({
      email:   creds.client_email,
      key:     creds.private_key,
      scopes:  ['https://www.googleapis.com/auth/gmail.send'],
      subject: GMAIL_FROM,
    });
  }
  return null;
}

function listItems(items: string[]): string {
  return items
    .map(item => `<li style="margin-bottom:6px;line-height:1.55;">${escHtml(item)}</li>`)
    .join('');
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function section(title: string, colour: string, items: string[]): string {
  return `
  <tr><td style="padding:0 0 20px;">
    <div style="background:#1e293b;border-left:4px solid ${colour};border-radius:6px;padding:16px 20px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:${colour};margin-bottom:10px;">${escHtml(title)}</div>
      <ul style="margin:0;padding-left:20px;color:#cbd5e1;font-size:14px;">${listItems(items)}</ul>
    </div>
  </td></tr>`;
}

function buildEmailHtml(opts: {
  patientName: string;
  appointmentType: string;
  slot: { display: string; location: string } | null;
  isConfirmed: boolean;
  track: BookingTrack;
}): string {
  const { patientName, appointmentType, slot, isConfirmed, track } = opts;
  const firstName = patientName.split(' ')[0];
  const inst: ProcedureInstructions = getInstructions(appointmentType);
  const locLabel = slot ? (LOCATION_LABELS[slot.location] ?? slot.location) : inst.location;

  const statusColour = isConfirmed ? '#10b981' : '#f59e0b';
  const statusText   = isConfirmed ? 'Appointment Confirmed' : 'Request Received';
  const statusSubtitle = isConfirmed
    ? `Your appointment with Dr Kabiye has been confirmed.`
    : track === 'referral'
      ? `Your referral appointment request has been received. A member of our team will confirm your appointment within 24 hours.`
      : `Your appointment request has been received. A member of our team will contact you shortly to confirm.`;

  const apptBlock = slot ? `
  <tr><td style="padding:0 0 20px;">
    <div style="background:#0d9488;border-radius:8px;padding:20px 24px;text-align:center;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#99f6e4;margin-bottom:8px;">Appointment Details</div>
      <div style="font-size:20px;font-weight:800;color:#ffffff;margin-bottom:6px;">${escHtml(slot.display)}</div>
      <div style="font-size:14px;color:#ccfbf1;">${escHtml(locLabel)}</div>
      <div style="font-size:13px;color:#99f6e4;margin-top:6px;">${escHtml(inst.displayName)} · ${escHtml(inst.duration)}</div>
    </div>
  </td></tr>` : `
  <tr><td style="padding:0 0 20px;">
    <div style="background:#1e293b;border-radius:8px;padding:16px 20px;">
      <div style="font-size:13px;color:#94a3b8;line-height:1.5;">${escHtml(statusSubtitle)}</div>
    </div>
  </td></tr>`;

  const beforeSection  = section('Before Your Appointment', '#0d9488', inst.beforeVisit);
  const onTheDaySection = section('On the Day', '#6366f1', inst.onTheDay);
  const bringSection   = section('What to Bring', '#f59e0b', inst.whatToBring);
  const afterSection   = inst.afterCare ? section('After Your Appointment', '#3b82f6', inst.afterCare) : '';
  const urgentSection  = section('When to Seek Immediate Help', '#ef4444', inst.urgentSigns);
  const notesBlock     = inst.notes ? `
  <tr><td style="padding:0 0 20px;">
    <div style="background:#1e293b;border-radius:6px;padding:14px 18px;font-size:13px;color:#94a3b8;line-height:1.55;font-style:italic;">
      ${escHtml(inst.notes)}
    </div>
  </td></tr>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escHtml(statusText)} — Amise Medical Services</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,-apple-system,sans-serif;color:#e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

        <!-- Header -->
        <tr><td style="padding:0 0 24px;text-align:center;">
          <div style="font-size:11px;font-weight:700;color:#0d9488;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">
            Amise Medical Services · Saint Lucia
          </div>
          <h1 style="margin:0;font-size:22px;font-weight:800;color:${statusColour};">
            ${escHtml(statusText)}
          </h1>
          <p style="margin:6px 0 0;font-size:14px;color:#64748b;">
            Dr Dawit Daniel Kabiye, MD, DM — General &amp; Endoscopic Surgery
          </p>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:0 0 20px;">
          <p style="margin:0;font-size:15px;color:#cbd5e1;line-height:1.6;">
            Good day ${escHtml(firstName)},<br><br>
            ${escHtml(statusSubtitle)}
          </p>
        </td></tr>

        <!-- Appointment block -->
        ${apptBlock}

        <!-- Instructions header -->
        <tr><td style="padding:0 0 16px;">
          <div style="font-size:13px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;">
            Your ${escHtml(inst.displayName)} — Patient Information
          </div>
        </td></tr>

        ${beforeSection}
        ${onTheDaySection}
        ${bringSection}
        ${afterSection}
        ${notesBlock}
        ${urgentSection}

        <!-- Contact -->
        <tr><td style="padding:0 0 24px;">
          <div style="background:#1e293b;border-radius:8px;padding:16px 20px;text-align:center;">
            <div style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Questions?</div>
            <div style="font-size:14px;color:#cbd5e1;">
              Tapion Hospital: <strong style="color:#0d9488;">459-2227 / 284-0557</strong>
            </div>
            <div style="font-size:13px;color:#64748b;margin-top:4px;">
              Rodney Bay (Providence Building) &nbsp;·&nbsp; Castries
            </div>
          </div>
        </td></tr>

        <!-- Disclaimer -->
        <tr><td style="padding:0;border-top:1px solid #1e293b;">
          <p style="margin:16px 0 0;font-size:11px;color:#374151;text-align:center;line-height:1.6;">
            This email is for administrative scheduling purposes only. It does not constitute medical advice, a diagnosis, or clinical triage.
            If you believe you are experiencing a medical emergency, call 911 or go immediately to the nearest emergency department.
            Do not reply to this email.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildMimeMessage(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): string {
  const boundary = `----=_Part_${Date.now()}`;
  const lines = [
    `From: ${GMAIL_FROM_NAME} <${GMAIL_FROM}>`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    opts.text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    opts.html,
    '',
    `--${boundary}--`,
  ];
  return lines.join('\r\n');
}

export async function sendConfirmationEmail(opts: {
  to: string;
  patientName: string;
  appointmentType: string;
  slot: { display: string; location: string } | null;
  track: BookingTrack;
  isConfirmed: boolean;
}): Promise<boolean> {
  if (process.env.MODE === 'dry_run') {
    console.log(`[email dry_run] Would send to ${opts.to} — ${opts.patientName} / ${opts.appointmentType}`);
    return true;
  }

  const auth = getGmailAuth();
  if (!auth) {
    console.warn('[email] No Google credentials configured — email not sent');
    return false;
  }

  const inst = getInstructions(opts.appointmentType);
  const statusText = opts.isConfirmed ? 'Appointment Confirmed' : 'Appointment Request Received';
  const subject = opts.slot
    ? `${statusText}: ${inst.displayName} — ${opts.slot.display}`
    : `${statusText}: ${inst.displayName}`;

  const html = buildEmailHtml(opts);

  // Plain-text fallback
  const firstName = opts.patientName.split(' ')[0];
  const locLabel  = opts.slot ? (LOCATION_LABELS[opts.slot.location] ?? opts.slot.location) : inst.location;
  const text = [
    `Good day ${firstName},`,
    '',
    opts.isConfirmed
      ? `Your appointment with Dr Kabiye has been confirmed.`
      : `Your appointment request has been received.`,
    '',
    ...(opts.slot ? [
      `Date & time: ${opts.slot.display}`,
      `Location: ${locLabel}`,
      `Procedure: ${inst.displayName} (${inst.duration})`,
      '',
    ] : []),
    'BEFORE YOUR APPOINTMENT',
    ...inst.beforeVisit.map(s => `• ${s}`),
    '',
    'ON THE DAY',
    ...inst.onTheDay.map(s => `• ${s}`),
    '',
    'WHAT TO BRING',
    ...inst.whatToBring.map(s => `• ${s}`),
    '',
    ...(inst.afterCare ? [
      'AFTER YOUR APPOINTMENT',
      ...inst.afterCare.map(s => `• ${s}`),
      '',
    ] : []),
    'WHEN TO SEEK IMMEDIATE HELP',
    ...inst.urgentSigns.map(s => `• ${s}`),
    '',
    'Questions? Call 459-2227 / 284-0557',
    '',
    'Front Desk, Amise Medical Services',
    '',
    '— Administrative scheduling only. Not medical advice. —',
  ].join('\n');

  try {
    const gmail = google.gmail({ version: 'v1', auth });
    const raw = Buffer.from(buildMimeMessage({ to: opts.to, subject, html, text }))
      .toString('base64url');
    await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
    return true;
  } catch (err) {
    console.error('[email] Send failed:', err);
    return false;
  }
}
