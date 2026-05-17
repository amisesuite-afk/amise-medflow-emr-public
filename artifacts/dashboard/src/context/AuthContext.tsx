import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured, UserProfile, UserRole } from '@/lib/supabase';

interface AuthCtx {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  profileError: string | null;
  configured: boolean;
  signIn(email: string, password: string): Promise<{ error: string | null }>;
  signOut(): Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

function friendlyError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes('load failed') || msg.includes('failed to fetch') || msg.includes('networkerror')) {
    return 'Could not reach the authentication server. Check your internet connection and try again.';
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
  const [session, setSession]       = useState<Session | null>(null);
  const [profile, setProfile]       = useState<UserProfile | null>(null);
  const [loading, setLoading]       = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) fetchProfile(s.user.id, s.user.email ?? null);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      if (s) fetchProfile(s.user.id, s.user.email ?? null);
      else { setProfile(null); setProfileError(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string, email: string | null) {
    if (!supabase) return;
    setProfileError(null);

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, full_name, role')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        // Surface the real error; fall back to a safe default so the user can still access the app
        console.error('[auth] profile fetch error:', error.code, error.message);
        setProfileError(`Profile load error (${error.code}): ${error.message}`);
        setProfile({ id: userId, full_name: email, role: 'front_desk', email });
        setLoading(false);
        return;
      }

      if (!data) {
        // No profile row — create one automatically with a safe default role
        const { data: created, error: insertErr } = await supabase
          .from('user_profiles')
          .upsert({ id: userId, full_name: email, role: 'front_desk' }, { onConflict: 'id' })
          .select('id, full_name, role')
          .maybeSingle();

        if (insertErr) {
          console.error('[auth] profile create error:', insertErr.code, insertErr.message);
          setProfileError(`Could not create profile (${insertErr.code}): ${insertErr.message}. Contact your administrator.`);
          // Still allow access with an in-memory profile
          setProfile({ id: userId, full_name: email, role: 'front_desk', email });
        } else {
          setProfile(
            created
              ? { id: created.id, full_name: created.full_name ?? email, role: created.role as UserRole, email }
              : { id: userId, full_name: email, role: 'front_desk', email }
          );
        }
      } else {
        setProfile({ id: data.id, full_name: data.full_name ?? email, role: data.role as UserRole, email });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[auth] unexpected profile error:', msg);
      setProfileError(`Unexpected error loading profile: ${friendlyError(msg)}`);
      setProfile({ id: userId, full_name: email, role: 'front_desk', email });
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    if (!supabase) return { error: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.' };
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: friendlyError(error.message) };
      return { error: null };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { error: friendlyError(msg) };
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  return (
    <Ctx.Provider value={{ session, profile, loading, profileError, configured: supabaseConfigured, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
