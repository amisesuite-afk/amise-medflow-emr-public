/**
 * Secret sent as `x-staff-token` on privileged server-to-server calls to the
 * api-server (e.g. POST /api/questionnaire/provision-link).
 *
 * Prefers STAFF_MACHINE_TOKEN, the dedicated machine secret. Falls back to
 * CRON_SECRET, which this header used to share, so nothing changes until the
 * new variable is set.
 *
 * Once the api-server has STAFF_MACHINE_TOKEN it accepts only that value, so
 * set the same value here (Vercel) and on the api-server (Render) together.
 * Until both match, questionnaire links are left out of booking confirmations
 * (the booking itself still succeeds). CRON_SECRET can then be removed from
 * the front-desk environment.
 *
 * Server-only: never import this from a client component.
 */
export function staffMachineToken(env: NodeJS.ProcessEnv = process.env): string | null {
  const dedicated = env.STAFF_MACHINE_TOKEN?.trim();
  if (dedicated) return dedicated;
  const cronSecret = env.CRON_SECRET?.trim();
  return cronSecret || null;
}
