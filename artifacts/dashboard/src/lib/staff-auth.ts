import { supabase } from './supabase';

/** Try to get a valid access token, refreshing if necessary.
 *  If the first refresh attempt fails, wait 1 s and retry once. */
async function getAccessToken(): Promise<string | undefined> {
  const session = (await supabase?.auth.getSession())?.data.session;
  if (session?.access_token) return session.access_token;

  // Session missing or expired — attempt refresh
  const { data, error } = (await supabase?.auth.refreshSession()) ?? {};
  if (!error && data?.session?.access_token) return data.session.access_token;

  // First refresh failed — wait 1 s and retry once
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const { data: retryData, error: retryError } = (await supabase?.auth.refreshSession()) ?? {};
  if (!retryError && retryData?.session?.access_token) return retryData.session.access_token;

  return undefined;
}

/** Authorization header carrying the signed-in staff member's Supabase JWT,
 *  for calls to api-server routes gated by `requireStaffAuth`. */
export async function staffAuthHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
