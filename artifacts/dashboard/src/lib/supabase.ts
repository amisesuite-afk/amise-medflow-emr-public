// @refresh reset
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// In dev mode, route all Supabase requests through the Vite proxy (/sb-proxy)
// so they're made server-side — bypassing browser CORS restrictions entirely.
// In production the browser connects to Supabase directly (add your domain to
// Supabase → Auth → URL Configuration if CORS errors recur there).
const effectiveUrl: string | undefined = import.meta.env.DEV && supabaseUrl
  ? `${window.location.origin}/sb-proxy`
  : supabaseUrl;

// Diagnostic: log env state at module load so we can see it in the console
console.log('[supabase-init] VITE_SUPABASE_URL present:', Boolean(supabaseUrl), '| length:', supabaseUrl?.length ?? 0);
console.log('[supabase-init] VITE_SUPABASE_ANON_KEY present:', Boolean(supabaseAnon), '| length:', supabaseAnon?.length ?? 0, '| prefix:', supabaseAnon?.slice(0, 12) ?? '(none)');
console.log('[supabase-init] effectiveUrl (dev proxy):', effectiveUrl);

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnon);

// Use window-level singleton so HMR module reloads reuse the same client
declare global { interface Window { __supabase?: SupabaseClient } }

export function getSupabase(): SupabaseClient | null {
  if (window.__supabase) return window.__supabase;
  if (!supabaseConfigured) return null;
  try {
    window.__supabase = createClient(effectiveUrl!, supabaseAnon!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    console.log('[supabase-init] client created OK, url:', supabaseUrl);
  } catch (e: unknown) {
    console.error('[supabase-init] createClient threw:', serializeError(e));
  }
  return window.__supabase ?? null;
}

export const supabase = getSupabase();

export type UserRole = 'front_desk' | 'nurse' | 'doctor' | 'admin';

export const ROLE_LABELS: Record<UserRole, string> = {
  front_desk: 'Front Desk',
  nurse: 'Nurse',
  doctor: 'Doctor',
  admin: 'Admin',
};

export interface UserProfile {
  id: string;
  full_name: string | null;
  role: UserRole;
  email: string | null;
}

/** Safely serialise any error for console output */
export function serializeError(e: unknown): Record<string, unknown> {
  if (e instanceof Error) {
    return {
      name: e.name,
      message: e.message,
      stack: e.stack?.split('\n').slice(0, 4).join(' | '),
    };
  }
  if (typeof e === 'object' && e !== null) {
    try {
      return JSON.parse(JSON.stringify(e));
    } catch {
      return { raw: String(e) };
    }
  }
  return { raw: String(e) };
}

/** Run a lightweight network check against the Supabase health endpoint */
export async function checkSupabaseReachable(): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!effectiveUrl) return { ok: false, error: 'VITE_SUPABASE_URL not set' };
  try {
    const res = await fetch(`${effectiveUrl}/auth/v1/health`, {
      method: 'GET',
      headers: { apikey: supabaseAnon ?? '' },
    });
    return { ok: res.ok, status: res.status };
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    return { ok: false, error: err };
  }
}
