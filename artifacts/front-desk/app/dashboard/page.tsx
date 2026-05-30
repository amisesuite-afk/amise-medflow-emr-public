import { getRecentThreads } from '@/lib/supabase';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const threads = await getRecentThreads();
  const secret  = process.env.WEBHOOK_SECRET ?? '';
  const mode    = process.env.MODE ?? 'dry_run';
  return <DashboardClient initialThreads={threads} secret={secret} mode={mode} />;
}
