import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

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
  return _client;
}
