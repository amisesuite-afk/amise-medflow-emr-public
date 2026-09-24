/**
 * Outbound safety gate — the single source of truth for whether the api-server
 * may contact anyone outside the building (email, SMS, WhatsApp, calendar
 * invitations / writes), and for screening AI-drafted patient-facing text.
 *
 * Hazard log H-09: several send paths used to decide this for themselves, and
 * some (the 24h reminder email, Meta/Telnyx WhatsApp) ignored MODE entirely.
 * Every provider call must now consult `outboundBlocked()` first.
 *
 * MODE semantics (env `MODE`, default `dry_run`):
 *   dry_run    — nothing leaves the server. No caller-supplied override can lift this.
 *   supervised — patient-facing AI email becomes a Gmail draft for staff review;
 *                static/staff-approved SMS, WhatsApp and calendar writes proceed.
 *   auto       — sends (boot additionally requires CONFIRM_AUTO_MODE=true).
 * Any unrecognised value is treated as dry_run (fail closed).
 */
import { checkForbiddenContent } from '@workspace/triage-engine';
import { logger } from './logger.js';

export type Mode = 'dry_run' | 'supervised' | 'auto';

export type OutboundChannel =
  | 'email'
  | 'sms'
  | 'whatsapp_twilio'
  | 'whatsapp_meta'
  | 'whatsapp_telnyx'
  | 'calendar';

const VALID_MODES: readonly Mode[] = ['dry_run', 'supervised', 'auto'];

/** The effective process-wide MODE. Unknown / misspelt values fail closed to dry_run. */
export function getMode(): Mode {
  const raw = (process.env.MODE ?? 'dry_run').trim();
  return (VALID_MODES as readonly string[]).includes(raw) ? (raw as Mode) : 'dry_run';
}

/**
 * True when the MODE gate forbids an outbound action. Callers must return
 * early (and report `skipped`) when this is true. Logs the suppressed action.
 */
export function outboundBlocked(channel: OutboundChannel, meta: Record<string, unknown> = {}): boolean {
  if (getMode() !== 'dry_run') return false;
  logger.info({ channel, ...meta }, `[outbound dry-run] ${channel} suppressed (MODE=dry_run)`);
  return true;
}

/**
 * Resolve the mode used for a Gmail send. A caller may pass `force` to make a
 * specific message stricter ('supervised' → draft only) or, for staff-internal
 * alerts, to send without drafting when MODE=supervised — but `force` can never
 * lift MODE=dry_run.
 */
export function resolveEmailMode(force?: Mode): Mode {
  const envMode = getMode();
  if (envMode === 'dry_run') return 'dry_run';
  // A malformed override (e.g. an arbitrary req.body.mode string) is ignored.
  if (force && (VALID_MODES as readonly string[]).includes(force)) return force;
  return envMode;
}

/**
 * Mode for the patient-facing 24h reminder email (cron /api/cron/reminders).
 * By default it follows MODE like any other patient email (supervised → Gmail
 * draft). REMINDER_EMAIL_AUTO_SEND=true lets it send directly under
 * MODE=supervised — an explicit, practice-owner opt-in for the roadmap's
 * "reminders sent automatically" behaviour. It never overrides dry_run, and the
 * body is still screened by screenOutboundText() first.
 */
export function reminderEmailMode(): Mode | undefined {
  if (getMode() === 'supervised' && process.env.REMINDER_EMAIL_AUTO_SEND === 'true') return 'auto';
  return undefined;
}

/**
 * FORBIDDEN_PATTERNS screen for automated patient-facing text (fees, diagnoses,
 * drug doses, results, medication-hold instructions). Content that fails must
 * be quarantined for human review, never sent.
 */
export function screenOutboundText(...parts: string[]): { safe: boolean; violations: string[] } {
  return checkForbiddenContent(parts.join('\n'));
}
