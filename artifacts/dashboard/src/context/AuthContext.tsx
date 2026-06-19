// @refresh reset
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured, configIssues, UserProfile, UserRole, SiteCode, serializeError } from '@/lib/supabase';

export const DEMO_MODE = false;
export const DEMO_PROFILE: UserProfile = {
  id: 'demo',
  full_name: 'Dr Demo',
  role: 'doctor' as UserRole,
  email: 'demo@localhost',
  default_site: 'rodney_bay' as SiteCode,
};

interface AuthCtx {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  profileError: string | null;
  configured: boolean;
  sessionExpired: boolean;
  signIn(email: string, password: string): Promise<{ error: string | null; detail?: string }>;
  signOut(): Promise<void>;
}

// Persist the context object on window so HMR module re-evaluations reuse
// the same reference — prevents "useAuth must be inside AuthProvider" crashes.
declare global { interface Window { __authCtx?: React.Context<AuthCtx | null> } }
const Ctx: React.Context<AuthCtx | null> =
  window.__authCtx ?? (window.__authCtx = createContext<AuthCtx | null>(null));

function friendlyError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes('load failed') || msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('network request failed')) {
    return 'Network error — could not reach Supabase. Check CORS settings or internet connection.';
  }
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return 'Incorrect email or password.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Please confirm your email address before signing in.';
  }
  if (msg.includes('too many requests')) {
    return 'Too many sign-in attempts. Please wait a moment and try again.';
  }
  return raw;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession]           = useState<Session | null>(null);
  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [loading, setLoading]           = useState(!DEMO_MODE);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (DEMO_MODE) return;

    if (!supabase) {
      console.warn('[auth] Supabase client is null — not configured');
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (error) console.error('[auth] getSession error:', serializeError(error));
      setSession(s);
      if (s) fetchProfile(s.user.id, s.user.email ?? null);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, s) => {
      const hadSession = !!session || !!profile;
      setSession(s);
      if (s) {
        setSessionExpired(false);
        fetchProfile(s.user.id, s.user.email ?? null);
      } else {
        if (hadSession) setSessionExpired(true);
        setProfile(null); setProfileError(null); setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string, email: string | null) {
    if (!supabase) return;
    setProfileError(null);

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, role, default_site')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        const detail = `code=${error.code} msg="${error.message}" hint="${error.hint}" details="${error.details}"`;
        console.error('[auth] profile fetch error:', detail);
        setProfileError(`Profile query failed — ${detail}`);
        setProfile({ id: userId, full_name: email, role: 'front_desk', email });
        setLoading(false);
        return;
      }

      if (!data) {
        console.warn('[auth] no profile row found — attempting upsert');
        const { data: created, error: insertErr } = await supabase
          .from('user_profiles')
          .upsert({ id: userId, full_name: email, role: 'front_desk' }, { onConflict: 'id' })
          .select('id, full_name, role, default_site')
          .maybeSingle();

        if (insertErr) {
          const detail = `code=${insertErr.code} msg="${insertErr.message}"`;
          console.error('[auth] profile upsert error:', detail);
          setProfileError(`Profile create failed — ${detail}`);
          setProfile({ id: userId, full_name: email, role: 'front_desk', email });
        } else {
          setProfile(
            created
              ? { id: created.id, full_name: created.full_name ?? email, role: created.role as UserRole, email, default_site: (created.default_site as SiteCode | null) ?? undefined }
              : { id: userId, full_name: email, role: 'front_desk', email }
          );
        }
      } else {
        setProfile({ id: data.id, full_name: data.full_name ?? email, role: data.role as UserRole, email, default_site: (data.default_site as SiteCode | null) ?? undefined });
      }
    } catch (e: unknown) {
      const detail = JSON.stringify(serializeError(e));
      console.error('[auth] fetchProfile threw unexpectedly:', detail);
      setProfileError(`Unexpected profile error — ${detail}`);
      setProfile({ id: userId, full_name: email, role: 'front_desk', email });
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string): Promise<{ error: string | null; detail?: string }> {
    if (DEMO_MODE) {
      const validRoles: UserRole[] = ['front_desk', 'nurse', 'doctor', 'admin'];
      const role: UserRole = validRoles.includes(email as UserRole) ? (email as UserRole) : 'doctor';
      setProfile({ ...DEMO_PROFILE, role });
      return { error: null };
    }
    if (!supabase) {
      if (configIssues.length > 0) {
        const first = configIssues[0];
        return { error: `${first.variable}: ${first.message}` };
      }
      return { error: 'Supabase client not initialised — check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
    }
    try {
      setSessionExpired(false);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const detail = `name="${error.name}" status=${error.status} msg="${error.message}"`;
        console.error('[auth] signInWithPassword error:', detail, serializeError(error));
        return { error: friendlyError(error.message), detail };
      }
      return { error: null };
    } catch (e: unknown) {
      const ser = serializeError(e);
      const detail = JSON.stringify(ser);
      console.error('[auth] signInWithPassword threw:', detail);
      return { error: friendlyError(ser.message as string ?? detail), detail };
    }
  }

  async function signOut() {
    if (DEMO_MODE) return;
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  return (
    <Ctx.Provider value={{ session, profile, loading, profileError, configured: DEMO_MODE ? true : supabaseConfigured, sessionExpired, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
