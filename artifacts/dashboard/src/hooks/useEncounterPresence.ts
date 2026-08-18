import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export interface PresenceParticipant {
  userId: string;
  name: string;
  role: string;
}

interface TrackedPresence {
  user_id: string;
  name: string;
  role: string;
}

/** Pure so it's directly testable without a live Realtime connection.
 * Dedupes by user_id (a user with several tabs open tracks several presence
 * entries — one per connection — and should appear once), excluding selfId
 * regardless of how many of those entries are the current user's own tabs. */
export function computeOthers(
  state: Record<string, TrackedPresence[]>,
  selfId: string,
): PresenceParticipant[] {
  const seen = new Map<string, PresenceParticipant>();
  for (const metas of Object.values(state)) {
    for (const meta of metas) {
      if (meta.user_id === selfId) continue;
      if (!seen.has(meta.user_id)) {
        seen.set(meta.user_id, { userId: meta.user_id, name: meta.name, role: meta.role });
      }
    }
  }
  return [...seen.values()];
}

/**
 * Lightweight presence-only awareness for concurrent encounter editing — no
 * locking, no version checks, just "who else has this encounter open right
 * now." Chosen over full optimistic concurrency control (see premortem
 * follow-up) as proportionate to this practice's scale: the goal is making a
 * silent, unnoticed overwrite visible, not blocking writes.
 *
 * Each browser tab/connection gets its own Supabase Presence key by design
 * (not set to the user's id) -- deliberately not deduped at the protocol
 * level, since Presence's behaviour for multiple connections sharing one key
 * is not well-defined for this use case. Instead every entry carries the
 * user's own id in its tracked payload, and this hook filters out entries
 * matching the current user client-side -- so a doctor with the same
 * encounter open in two tabs never sees themselves listed as "another
 * viewer," while a genuinely different user always is, regardless of how
 * many tabs anyone has open.
 */
export function useEncounterPresence(encounterId: string | null): { others: PresenceParticipant[] } {
  const { profile } = useAuth();
  const [others, setOthers] = useState<PresenceParticipant[]>([]);

  useEffect(() => {
    const sb = supabase;
    if (!sb || !encounterId || !profile) {
      setOthers([]);
      return;
    }
    const self = profile;

    const channel = sb.channel(`encounter-presence:${encounterId}`);

    function syncOthers() {
      setOthers(computeOthers(channel.presenceState<TrackedPresence>(), self.id));
    }

    channel.on('presence', { event: 'sync' }, syncOthers);
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') {
        void channel.track({
          user_id: self.id,
          name: self.full_name || self.email || 'Staff',
          role: self.role,
        } satisfies TrackedPresence);
      }
    });

    return () => {
      void channel.untrack();
      void sb.removeChannel(channel);
    };
  }, [encounterId, profile?.id, profile?.full_name, profile?.email, profile?.role]);

  return { others };
}
