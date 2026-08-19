import { useAppContext } from '@/context/AppContext';

// Surfaces the outcome of saveAssessment/savePlan's optimistic-locking check
// (see db.ts) — shown when this session's last-known version of the
// assessment or plan no longer matches what's actually on the server,
// meaning another save (another staff member, or this doctor in another
// tab) landed first. The doctor's own unsaved edits are never silently
// discarded — both actions are explicit.
export default function SaveConflictBanner() {
  const { saveConflict, keepMySaveConflict, loadLatestSaveConflict } = useAppContext();

  if (!saveConflict) return null;

  const label = saveConflict.field === 'assessment' ? 'Assessment' : 'Plan';

  return (
    <div style={{
      margin: '0 0 12px', padding: '10px 14px', borderRadius: 8,
      background: '#fffbeb', border: '1px solid #fde68a',
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      fontSize: 12.5, color: '#92400e',
    }}>
      <span style={{ fontSize: 16 }}>⚠️</span>
      <span style={{ flex: '1 1 240px' }}>
        {label} was updated by someone else since you last loaded it — your latest edits here haven't been saved.
      </span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={loadLatestSaveConflict}
          style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
            background: '#fff', color: '#92400e', border: '1px solid #fbbf24',
          }}
        >
          Load their latest
        </button>
        <button
          type="button"
          onClick={keepMySaveConflict}
          style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
            background: '#92400e', color: '#fff', border: '1px solid #92400e',
          }}
        >
          Keep my edits
        </button>
      </div>
    </div>
  );
}
