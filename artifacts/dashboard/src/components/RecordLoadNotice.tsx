/**
 * Autosave guard state, shown where the clinician documents (lib/autosave-guard.ts):
 *  - the record is still loading — nothing is saved until it has loaded;
 *  - "Couldn't load — retry": sections whose read failed are empty placeholders, not the record,
 *    and are not saved until a retry loads them or the clinician edits them;
 *  - the encounter is closed — read-only, nothing is saved until it is reopened.
 * Renders nothing when none applies.
 */
import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { SAVE_SECTION_LABEL } from '@/lib/autosave-guard';

export default function RecordLoadNotice({ showReadOnly, onReopen, reopening }: {
  /** Show the closed-encounter notice (the consultation; the summary has its own banner). */
  showReadOnly: boolean;
  /** The existing reopen action (Home.editEncounter). */
  onReopen?: () => void;
  reopening?: boolean;
}) {
  const { patientId, recordLoading, notLoadedSections, retryNotLoaded, encounterReadOnly } = useAppContext();
  const [retrying, setRetrying] = useState(false);
  if (!patientId) return null;

  const row: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    margin: '6px 14px', padding: '7px 12px', borderRadius: 8, fontSize: 12,
  };
  const btn: React.CSSProperties = {
    marginLeft: 'auto', padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700,
    border: 'none', cursor: 'pointer',
  };

  return (
    <>
      {recordLoading && (
        <div role="status" data-testid="record-loading" style={{ ...row, background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155' }}>
          <span>⏳</span>
          <span>Loading the record… changes are saved once it has loaded.</span>
        </div>
      )}
      {!recordLoading && notLoadedSections.length > 0 && (
        <div role="alert" data-testid="record-not-loaded" style={{ ...row, background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412' }}>
          <span>⚠</span>
          <span>
            <strong>Couldn't load:</strong> {notLoadedSections.map(s => SAVE_SECTION_LABEL[s]).join(', ')}.
            {' '}Shown empty and not saved until reloaded or edited.
          </span>
          <button
            type="button"
            disabled={retrying}
            onClick={() => { setRetrying(true); void retryNotLoaded().finally(() => setRetrying(false)); }}
            style={{ ...btn, background: '#ea580c', color: '#fff', cursor: retrying ? 'wait' : 'pointer' }}
          >
            {retrying ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}
      {showReadOnly && encounterReadOnly && (
        <div role="status" data-testid="encounter-read-only" style={{ ...row, background: '#fef3c7', border: '1px solid #f59e0b', color: '#78350f' }}>
          <span>🔒</span>
          <span><strong>This encounter is closed — read-only.</strong> Changes made here are not saved.</span>
          {onReopen && (
            <button
              type="button"
              disabled={reopening}
              onClick={onReopen}
              style={{ ...btn, background: '#f59e0b', color: '#1c1917', cursor: reopening ? 'wait' : 'pointer' }}
            >
              {reopening ? 'Reopening…' : 'Reopen to edit'}
            </button>
          )}
        </div>
      )}
    </>
  );
}
