import { useAppContext } from '@/context/AppContext';
import { useEncounterPresence } from '@/hooks/useEncounterPresence';
import { ROLE_LABELS, type UserRole } from '@/lib/supabase';

/** Presence-only awareness banner — shows who else currently has this
 * encounter open, so a silent, unnoticed overwrite (last-write-wins on
 * autosave) becomes a visible, avoidable one instead. No locking, no
 * version checks — see the useEncounterPresence hook for why this was
 * chosen over full optimistic concurrency control. */
export default function EncounterPresenceBanner() {
  const { topSection, encounterId } = useAppContext();
  const { others } = useEncounterPresence(topSection === 'consultation' ? encounterId : null);

  if (topSection !== 'consultation' || others.length === 0) return null;

  const names = others.map(o => {
    const roleLabel = ROLE_LABELS[o.role as UserRole] ?? o.role;
    return `${o.name} (${roleLabel})`;
  });

  const text = names.length === 1
    ? `${names[0]} is also viewing this encounter`
    : `${names.length} other staff are also viewing this encounter: ${names.join(', ')}`;

  return (
    <div style={{
      margin: '0 0 12px', padding: '8px 14px', borderRadius: 8,
      background: '#eff6ff', border: '1px solid #bfdbfe',
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 12.5, color: '#1e40af',
    }}>
      <span style={{ fontSize: 14 }}>👀</span>
      <span>{text}</span>
    </div>
  );
}
