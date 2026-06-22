import { getRecentThreads } from '@/lib/supabase';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  let threads: Awaited<ReturnType<typeof getRecentThreads>> = [];
  try {
    threads = await getRecentThreads();
  } catch { /* Supabase unreachable — start empty */ }
  const secret  = process.env.WEBHOOK_SECRET ?? '';
  const mode    = process.env.MODE ?? 'dry_run';
  return <DashboardClient initialThreads={threads} secret={secret} mode={mode} />;
}
