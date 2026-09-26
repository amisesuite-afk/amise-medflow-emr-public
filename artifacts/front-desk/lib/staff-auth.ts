import { NextResponse, type NextRequest } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

// Server-side staff gate for /api/staff/* route handlers.
//
// Those routes use the service-role client (RLS bypassed), so this check is the
// only thing standing between a caller and patient data. middleware.ts only
// checks that a session cookie is *present* (cheap redirect for page routes);
// it cannot tell a real staff session from a forged cookie or from a
// patient-portal session in the same Supabase project. Every /api/staff/*
// handler must call requireStaff() first.

export const STAFF_ROLES = ['front_desk', 'nurse', 'doctor', 'admin'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** Cookie the staff portal writes with the current Supabase access token (see lib/staff-supabase.ts). */
export const STAFF_SESSION_COOKIE = 'amise-staff-session';

export interface StaffIdentity {
  userId: string;
  email: string | null;
  role: StaffRole;
}

export type StaffAuthResult =
  | { ok: true; staff: StaffIdentity }
  | { ok: false; status: 401 | 403 | 503; error: string };

/** The subset of the Supabase client this module needs (keeps it testable). */
export interface StaffAuthClient {
  auth: {
    getUser(jwt: string): Promise<{ data: { user: { id: string; email?: string | null } | null }; error: unknown }>;
  };
  from(table: string): {
    select(cols: string): {
      eq(col: string, value: string): {
        maybeSingle(): PromiseLike<{ data: { role?: unknown } | null; error: unknown }>;
      };
    };
  };
}

// header.payload.signature, base64url segments. Anything else is rejected
// without a network round-trip.
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function isStaffRole(role: unknown): role is StaffRole {
  return typeof role === 'string' && (STAFF_ROLES as readonly string[]).includes(role);
}

/** Bearer header first (preferred), then the staff session cookie. */
export function extractStaffToken(req: Pick<NextRequest, 'headers' | 'cookies'>): string | null {
  const header = req.headers.get('authorization');
  if (header && /^bearer\s+/i.test(header)) {
    const token = header.replace(/^bearer\s+/i, '').trim();
    if (token) return token;
  }
  const cookie = req.cookies.get(STAFF_SESSION_COOKIE)?.value;
  if (cookie) {
    let value = cookie.trim();
    try { value = decodeURIComponent(value); } catch { /* keep raw */ }
    if (value) return value;
  }
  return null;
}

export async function verifyStaffToken(
  token: string | null,
  client: StaffAuthClient,
): Promise<StaffAuthResult> {
  if (!token || !JWT_SHAPE.test(token)) {
    return { ok: false, status: 401, error: 'Unauthorised — staff sign-in required.' };
  }

  let user: { id: string; email?: string | null } | null = null;
  try {
    const { data, error } = await client.auth.getUser(token);
    if (!error && data?.user) user = data.user;
  } catch (err) {
    console.error('[staff-auth] token verification threw', err);
  }
  if (!user) return { ok: false, status: 401, error: 'Unauthorised — invalid or expired session.' };

  try {
    const { data, error } = await client
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (error) {
      console.error('[staff-auth] staff profile lookup failed', error);
      return { ok: false, status: 503, error: 'Could not verify staff role — please try again.' };
    }
    const role = data?.role;
    if (!isStaffRole(role)) {
      return { ok: false, status: 403, error: 'Forbidden — a staff account is required.' };
    }
    return { ok: true, staff: { userId: user.id, email: user.email ?? null, role } };
  } catch (err) {
    console.error('[staff-auth] staff profile lookup threw', err);
    return { ok: false, status: 503, error: 'Could not verify staff role — please try again.' };
  }
}

/**
 * Validate the caller's Supabase session and require a staff `user_profiles`
 * role. Returns either the verified identity or a ready-to-return error
 * response (401 no/invalid session, 403 authenticated but not staff, 503 role
 * lookup failed).
 */
export async function requireStaff(
  req: Pick<NextRequest, 'headers' | 'cookies'>,
  client: StaffAuthClient = getServiceClient() as unknown as StaffAuthClient,
): Promise<{ staff: StaffIdentity; response?: undefined } | { staff?: undefined; response: NextResponse }> {
  const result = await verifyStaffToken(extractStaffToken(req), client);
  if (!result.ok) {
    return { response: NextResponse.json({ error: result.error }, { status: result.status }) };
  }
  return { staff: result.staff };
}
