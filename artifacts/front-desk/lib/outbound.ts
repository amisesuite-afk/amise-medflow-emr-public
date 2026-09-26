/**
 * Outbound MODE gate for the front-desk app (Next.js API routes on Vercel).
 *
 * Mirrors `artifacts/api-server/src/lib/outbound.ts` — same `MODE` variable and
 * the same fail-closed semantics — but lives here because front-desk is a
 * separate deployment that cannot import from the api-server package.
 *
 * Compliance G-17 / hazard H-09: front-desk used to decide this per sender, and
 * `sendConfirmationEmail()` sent unless MODE was *exactly* `dry_run`, while the
 * Twilio senders sent on any misspelt value. An unset or misspelt MODE on the
 * front-desk Vercel project therefore contacted patients.
 *
 * MODE semantics (env `MODE`, read per call, default `dry_run`):
 *   dry_run    — nothing leaves the server (email, SMS, WhatsApp).
 *   supervised — sends (front-desk sends only static or nurse-approved text).
 *   auto       — sends.
 * Any unrecognised value (unset, empty, `DRY_RUN`, `live`, `atuo` …) is treated
 * as dry_run (fail closed). Surrounding whitespace is ignored, as in the api-server.
 *
 * Every provider send in front-desk (`lib/twilio.ts` sendSms/sendWhatsApp,
 * `lib/email.ts` sendConfirmationEmail) must consult `outboundBlocked()` first.
 * `test/outbound-mode.test.ts` checks the behaviour and that no other file in
 * front-desk reads `process.env.MODE` for a send decision.
 */

export type Mode = 'dry_run' | 'supervised' | 'auto';

export type OutboundChannel = 'email' | 'sms' | 'whatsapp';

const VALID_MODES: readonly Mode[] = ['dry_run', 'supervised', 'auto'];

/** The effective MODE. Unknown / misspelt / unset values fail closed to dry_run. */
export function getMode(): Mode {
  const raw = (process.env.MODE ?? 'dry_run').trim();
  return (VALID_MODES as readonly string[]).includes(raw) ? (raw as Mode) : 'dry_run';
}

/** True when the MODE gate forbids an outbound send. Callers must return early. */
export function outboundBlocked(channel: OutboundChannel): boolean {
  if (getMode() !== 'dry_run') return false;
  const raw = process.env.MODE;
  if (raw !== undefined && raw.trim() !== 'dry_run') {
    // Make a misconfiguration visible rather than silently suppressing sends.
    console.warn(`[outbound] MODE=${JSON.stringify(raw)} is not dry_run|supervised|auto — treated as dry_run; ${channel} suppressed`);
  }
  return true;
}
