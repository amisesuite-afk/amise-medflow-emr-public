import { useSyncExternalStore } from 'react';
import { approvedContentRevision, subscribeApprovedContent } from '@/lib/approved-content-store';

/**
 * A number that changes when the approved-content register changes (a verified release was loaded
 * or dropped; docs/APPROVED-CONTENT-CHANNEL.md). Add it to the dependencies of a memo that reads
 * shared rule content, so the content in force is used once it has loaded.
 */
export function useApprovedContentRevision(): number {
  return useSyncExternalStore(subscribeApprovedContent, approvedContentRevision, approvedContentRevision);
}
