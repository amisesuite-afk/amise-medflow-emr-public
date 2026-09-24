import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

// Must match STAFF_SESSION_COOKIE in lib/staff-auth.ts (not imported here so
// this browser module doesn't pull in next/server).
const STAFF_SESSION_COOKIE = 'amise-staff-session';

let _client: SupabaseClient | null = null;

/**
 * Mirror the current access token into the `amise-staff-session` cookie.
 *
 * supabase-js keeps the session in localStorage, which neither middleware.ts
 * (page redirects) nor the /api/staff/* route handlers can see. The cookie
 * carries the access token so the server can verify it with Supabase; the
 * server never trusts the cookie's mere presence. SameSite=Strict keeps it off
 * cross-site requests.
 */
export function syncStaffSessionCookie(session: Session | null): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  if (!session?.access_token) {
    document.cookie = `${STAFF_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Strict${secure}`;
    return;
  }
  const maxAge = session.expires_at
    ? Math.max(0, session.expires_at - Math.floor(Date.now() / 1000))
    : session.expires_in ?? 3600;
  document.cookie =
    `${STAFF_SESSION_COOKIE}=${encodeURIComponent(session.access_token)}; Path=/; Max-Age=${maxAge}; SameSite=Strict${secure}`;
}

export function getStaffClient(): SupabaseClient {
  if (_client) return _client;
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  || 'https://placeholder.supabase.co';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';
  _client = createClient(url, anon, {
    auth: {
      persistSession:   true,
      autoRefreshToken: true,
      storageKey:       'amise-staff-session',
      flowType:         'implicit',
    },
  });
  // Keep the cookie in step with sign-in, token refresh and sign-out.
  _client.auth.onAuthStateChange((_event, session) => syncStaffSessionCookie(session));
  return _client;
}

/**
 * fetch() for /api/staff/* — attaches the current (auto-refreshed) access token
 * as a Bearer header, so requests keep working after the token rotates.
 */
export async function staffFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await getStaffClient().auth.getSession();
  syncStaffSessionCookie(session);
  const headers = new Headers(init.headers);
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
  return fetch(input, { ...init, headers });
}

/** Clear the local staff session and its cookie. */
export async function signOutStaff(): Promise<void> {
  try {
    await getStaffClient().auth.signOut({ scope: 'local' });
  } finally {
    syncStaffSessionCookie(null);
  }
}
