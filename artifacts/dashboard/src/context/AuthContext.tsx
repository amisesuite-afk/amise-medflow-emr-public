import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured, UserProfile, UserRole } from '@/lib/supabase';

interface AuthCtx {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  configured: boolean;
  signIn(email: string, password: string): Promise<{ error: string | null }>;
  signOut(): Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession]   = useState<Session | null>(null);
  const [profile, setProfile]   = useState<UserProfile | null>(null);
  const [loading, setLoading]   = useState(true);

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
      else { setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string, email: string | null) {
    if (!supabase) return;
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, role')
      .eq('id', userId)
      .single();

    setProfile(data
      ? { id: data.id, full_name: data.full_name ?? null, role: data.role as UserRole, email }
      : { id: userId, full_name: email, role: 'front_desk', email }
    );
    setLoading(false);
  }

  async function signIn(email: string, password: string) {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  }

  return (
    <Ctx.Provider value={{ session, profile, loading, configured: supabaseConfigured, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
