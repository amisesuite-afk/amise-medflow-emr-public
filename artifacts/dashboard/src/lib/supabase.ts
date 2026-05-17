import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnon);

let _client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  if (!supabaseConfigured) return null;
  _client = createClient(supabaseUrl!, supabaseAnon!);
  return _client;
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
