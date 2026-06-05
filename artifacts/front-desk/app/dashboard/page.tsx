import { getRecentThreads, getRecentBookings } from '@/lib/supabase';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [threads, bookings] = await Promise.all([
    getRecentThreads(),
    getRecentBookings(7),
  ]);
  const secret = process.env.WEBHOOK_SECRET ?? '';
  const mode   = process.env.MODE ?? 'dry_run';
  return <DashboardClient initialThreads={threads} initialBookings={bookings} secret={secret} mode={mode} />;
}
