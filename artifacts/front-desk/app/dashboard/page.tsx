import { getRecentThreads, getRecentBookings, getDocumentsForReview } from '@/lib/supabase';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [threads, bookings, documents] = await Promise.all([
    getRecentThreads(),
    getRecentBookings(7),
    getDocumentsForReview(50),
  ]);
  const secret = process.env.WEBHOOK_SECRET ?? '';
  const mode   = process.env.MODE ?? 'dry_run';
  return (
    <DashboardClient
      initialThreads={threads}
      initialBookings={bookings}
      initialDocuments={documents}
      secret={secret}
      mode={mode}
    />
  );
}
