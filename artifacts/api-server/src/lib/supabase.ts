import { timingSafeEqual } from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger.js';

let _client: SupabaseClient | null = null;

export function sb(): SupabaseClient {
  if (_client) return _client;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  _client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  return _client;
}

export function getSupabaseAdmin(): SupabaseClient {
  return sb();
}

/**
 * Roles that count as staff. Mirrors the `user_profiles.role` CHECK constraint
 * and the `auth_role() in (...)` predicate used by the staff-only RLS policies
 * (supabase-staff-only-rls-migration.sql).
 */
export const STAFF_ROLES = ['front_desk', 'nurse', 'doctor', 'admin'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export interface StaffIdentity {
  userId: string;
  email: string | null;
  role: StaffRole;
}

export type StaffTokenResult =
  | { ok: true; staff: StaffIdentity }
  | { ok: false; status: 401 | 403 | 503; error: string };

function isStaffRole(role: unknown): role is StaffRole {
  return typeof role === 'string' && (STAFF_ROLES as readonly string[]).includes(role);
}

/** Constant-time string comparison (length mismatch returns early; only length leaks). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Validate a Supabase access token AND require a staff profile.
 *
 * Patient-portal users are Supabase Auth users in the same project, so a valid
 * JWT alone does not make the caller staff. A caller is staff only when
 * `user_profiles` has a row for them with a role in STAFF_ROLES. A user with no
 * profile row (a portal patient) gets 403, not 401: they are authenticated, but
 * not allowed. A profile-lookup failure fails closed (503).
 */
export async function verifyStaffToken(jwt: string | null | undefined): Promise<StaffTokenResult> {
  if (!jwt) return { ok: false, status: 401, error: 'Unauthorised — provide x-staff-token or a valid Bearer token' };

  let user: { id: string; email?: string | null } | null = null;
  try {
    const { data, error } = await sb().auth.getUser(jwt);
    if (!error && data?.user) user = data.user;
  } catch (err) {
    logger.warn({ err }, '[auth] token verification threw');
  }
  if (!user) return { ok: false, status: 401, error: 'Unauthorised — invalid or expired session' };

  let role: unknown = null;
  try {
    const { data, error } = await sb()
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (error) {
      logger.error({ err: error, userId: user.id }, '[auth] staff profile lookup failed');
      return { ok: false, status: 503, error: 'Could not verify staff role — please try again' };
    }
    role = (data as { role?: unknown } | null)?.role ?? null;
  } catch (err) {
    logger.error({ err, userId: user.id }, '[auth] staff profile lookup threw');
    return { ok: false, status: 503, error: 'Could not verify staff role — please try again' };
  }

  if (!isStaffRole(role)) {
    return { ok: false, status: 403, error: 'Forbidden — this endpoint requires a staff account' };
  }
  return { ok: true, staff: { userId: user.id, email: user.email ?? null, role } };
}

let warnedCronSecretFallback = false;

/** Test-only: forget that the CRON_SECRET fallback warning was logged. */
export function _resetStaffMachineTokenWarning(): void {
  warnedCronSecretFallback = false;
}

/**
 * The secret accepted in `x-staff-token`.
 *
 * `STAFF_MACHINE_TOKEN` when set: then it is the only value accepted, and
 * CRON_SECRET no longer opens staff routes. Unset (or blank), it falls back to
 * `CRON_SECRET`, which this header used to share, so a deploy that has not set
 * the new variable yet keeps working. The fallback logs a warning once per
 * process. Returns null when neither is set (machine path disabled).
 */
export function staffMachineToken(): string | null {
  const dedicated = process.env.STAFF_MACHINE_TOKEN?.trim();
  if (dedicated) return dedicated;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return null;
  if (!warnedCronSecretFallback) {
    warnedCronSecretFallback = true;
    logger.warn(
      '[auth] STAFF_MACHINE_TOKEN is not set — x-staff-token falls back to CRON_SECRET. ' +
        'Set STAFF_MACHINE_TOKEN on the api-server and every caller (front-desk) so the two secrets are separate.',
    );
  }
  return cronSecret;
}

/**
 * Gate for staff-only routes. Accepts either:
 *  - x-staff-token: <STAFF_MACHINE_TOKEN> (machine-to-machine shared secret,
 *    e.g. front-desk → api-server questionnaire provisioning; falls back to
 *    CRON_SECRET while STAFF_MACHINE_TOKEN is unset — see staffMachineToken();
 *    compared in constant time)
 *  - Authorization: Bearer <supabase-jwt> belonging to a user with a staff
 *    `user_profiles` row (front_desk / nurse / doctor / admin)
 *
 * On success with a JWT, the verified identity is cached on `req.staffUser`.
 */
export async function requireStaffAuth(req: any, res: any): Promise<boolean> {
  const staffToken = req.headers['x-staff-token'];
  if (typeof staffToken === 'string' && staffToken.length > 0) {
    const expected = staffMachineToken();
    if (expected && safeEqual(staffToken, expected)) return true;
  }

  const authHeader: string | undefined = req.headers.authorization;
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  const result = await verifyStaffToken(jwt);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return false;
  }
  req.staffUser = result.staff;
  return true;
}

/** Extract the authenticated staff user's UUID from the request JWT. Returns null for cron/service calls. */
export async function getStaffUserId(req: any): Promise<string | null> {
  if (req.staffUser?.userId) return req.staffUser.userId as string;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const jwt = authHeader.slice(7);
    const { data, error } = await sb().auth.getUser(jwt);
    if (!error && data?.user?.id) return data.user.id;
  }
  return null;
}

export function requireCronSecret(req: any, res: any): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    logger.warn('[cron] CRON_SECRET not set — rejecting request');
    res.status(503).json({ error: 'CRON_SECRET not configured' });
    return false;
  }
  // Header-only: never accept the secret as a query parameter because URL
  // query strings appear in access logs, proxy logs, and browser history.
  const provided = req.headers['x-cron-secret'];
  if (provided !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export type AuditAction =
  | 'classify' | 'triage' | 'draft' | 'send' | 'book' | 'notify'
  | 'remind' | 'escalate' | 'error' | 'skip'
  | 'portal_invite_sent' | 'extract' | 'change_request' | 'auto_cancel'
  | 'lab_alert_sent' | 'sign' | 'amend' | 'create' | 'resolve'
  | 'review' | 'reconcile' | 'dismiss' | 'update' | 'retire';

export async function audit(args: {
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  patientId?: string;
  userId?: string;
  userEmail?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const recordId  = args.entityId  && uuidRe.test(args.entityId)  ? args.entityId  : null;
    const patientId = args.patientId && uuidRe.test(args.patientId) ? args.patientId : null;
    const userId    = args.userId    && uuidRe.test(args.userId)    ? args.userId    : null;
    await sb().from('audit_log').insert({
      action:        args.action,
      resource_type: args.entityType ?? null,
      resource_id:   recordId,
      patient_id:    patientId,
      user_id:       userId,
      user_email:    args.userEmail ?? null,
      details:       args.payload ? { payload: args.payload } : null,
      mode:          process.env.MODE ?? null,
    });
  } catch (err) {
    logger.error({ err }, '[audit] failed');
  }
}

export async function upsertPatient(args: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
}): Promise<string> {
  const { data, error } = await sb()
    .from('patients')
    .upsert({
      email: args.email,
      first_name: args.firstName,
      last_name: args.lastName,
      phone: args.phone,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}
