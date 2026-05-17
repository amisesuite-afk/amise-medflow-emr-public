// @refresh reset
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ConfigIssue {
  variable: string;
  severity: 'error' | 'warning';
  message: string;
}

function validateConfig(): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  // ── URL ──
  if (!supabaseUrl) {
    issues.push({ variable: 'VITE_SUPABASE_URL', severity: 'error', message: 'Not set.' });
  } else if (!supabaseUrl.startsWith('https://')) {
    issues.push({ variable: 'VITE_SUPABASE_URL', severity: 'error', message: 'Must start with https://' });
  } else if (!supabaseUrl.match(/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i)) {
    issues.push({
      variable: 'VITE_SUPABASE_URL',
      severity: 'error',
      message: `Expected https://<ref>.supabase.co — got "${supabaseUrl.slice(0, 30)}${supabaseUrl.length > 30 ? '…' : ''}" (${supabaseUrl.length} chars)`,
    });
  }

  // ── Anon key ──
  if (!supabaseAnon) {
    issues.push({ variable: 'VITE_SUPABASE_ANON_KEY', severity: 'error', message: 'Not set.' });
  } else {
    const trimmed = supabaseAnon.trim();
    const hasQuotes    = supabaseAnon !== trimmed || /^['"]|['"]$/.test(supabaseAnon);
    const hasNewlines  = /[\r\n]/.test(supabaseAnon);
    const isJWT        = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(trimmed);
    const isNewOpaque  = trimmed.startsWith('sb_publishable_');
    const isServiceKey = trimmed.startsWith('sb_secret_') || (isJWT && trimmed.includes('"role":"service_role"'));

    if (hasQuotes || hasNewlines) {
      issues.push({ variable: 'VITE_SUPABASE_ANON_KEY', severity: 'error', message: 'Contains surrounding quotes, spaces, or line breaks — paste the raw value only.' });
    } else if (isServiceKey) {
      issues.push({ variable: 'VITE_SUPABASE_ANON_KEY', severity: 'error', message: 'Looks like a service_role key — use the anon / public key instead.' });
    } else if (isNewOpaque) {
      issues.push({
        variable: 'VITE_SUPABASE_ANON_KEY',
        severity: 'warning',
        message: `New opaque format key detected (sb_publishable_…, ${trimmed.length} chars). Using it — if sign-in fails, also try the legacy JWT key from Supabase Dashboard → Settings → API → anon public.`,
      });
    } else if (!isJWT) {
      issues.push({
        variable: 'VITE_SUPABASE_ANON_KEY',
        severity: 'error',
        message: `Unrecognised format (${trimmed.length} chars, starts with "${trimmed.slice(0, 10)}…"). Expected a JWT starting with eyJ.`,
      });
    } else if (trimmed.length < 100) {
      issues.push({
        variable: 'VITE_SUPABASE_ANON_KEY',
        severity: 'warning',
        message: `Key is ${trimmed.length} chars — JWT anon keys are typically 200+ chars. It may be truncated.`,
      });
    }
  }

  return issues;
}

export const configIssues = validateConfig();

// Log summary to console
if (configIssues.length === 0) {
  console.log('[supabase-config] ✓ URL and anon key both look valid');
} else {
  configIssues.forEach(i =>
    console.error(`[supabase-config] ${i.severity.toUpperCase()} ${i.variable}: ${i.message}`)
  );
}

// Always use the Supabase URL directly — Supabase sets permissive CORS headers
// so browser requests work without a proxy. Proxying through the dev server
// caused server-side DNS failures in the Replit environment.
const effectiveUrl: string | undefined = supabaseUrl;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnon);

// ─── Singleton client (window-persisted so HMR re-evaluations reuse it) ──────
declare global { interface Window { __supabase?: SupabaseClient } }

export function getSupabase(): SupabaseClient | null {
  if (window.__supabase) return window.__supabase;
  if (!supabaseConfigured) return null;
  // Only create the client when config looks valid to avoid SDK-level parse errors
  const hasErrors = configIssues.some(i => i.severity === 'error');
  if (hasErrors) {
    console.warn('[supabase-config] Skipping client creation due to config errors above.');
    return null;
  }
  try {
    window.__supabase = createClient(effectiveUrl!, supabaseAnon!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
    console.log('[supabase-init] client created, effectiveUrl:', effectiveUrl);
  } catch (e: unknown) {
    console.error('[supabase-init] createClient threw:', serializeError(e));
  }
  return window.__supabase ?? null;
}

export const supabase = getSupabase();

// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function serializeError(e: unknown): Record<string, unknown> {
  if (e instanceof Error) {
    return { name: e.name, message: e.message, stack: e.stack?.split('\n').slice(0, 4).join(' | ') };
  }
  if (typeof e === 'object' && e !== null) {
    try { return JSON.parse(JSON.stringify(e)); } catch { return { raw: String(e) }; }
  }
  return { raw: String(e) };
}

export async function checkSupabaseReachable(): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!effectiveUrl) return { ok: false, error: 'VITE_SUPABASE_URL not set' };
  try {
    const res = await fetch(`${effectiveUrl}/auth/v1/health`, {
      method: 'GET',
      headers: { apikey: supabaseAnon ?? '' },
    });
    return { ok: res.ok, status: res.status };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
