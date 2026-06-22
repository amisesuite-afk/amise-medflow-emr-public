import { supabase } from './supabase';

/** Authorization header carrying the signed-in staff member's Supabase JWT,
 *  for calls to api-server routes gated by `requireStaffAuth`. */
export async function staffAuthHeaders(): Promise<HeadersInit> {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
