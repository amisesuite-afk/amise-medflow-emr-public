import { Fragment, useMemo } from 'react';
import {
  LAB_ANALYTES, abnormalityIsAbnormal, abnormalityLabel, analyteForKey, assessmentNeedsAttention,
  emptyLabImportRow, flaggedIncludedCount, includedLabRows, issueIsWarning, issueMessage,
  labRowAssessment, labRowSavedName, labSource,
  type ExistingResult, type LabImportDraft, type LabImportRow, type NameReaders,
} from '@workspace/triage-engine/report-import';
import {
  formatEct, fromEctInputValue, labReviewCanSave, labSaveTitle, rowIsCritical, toEctInputValue,
} from '@/lib/report-import-save';
import { webMisreaders } from '@/lib/lab-reader-keywords';
import { useReferenceRanges } from '@/hooks/useReferenceRanges';
import type { RangeContext } from '@workspace/triage-engine/reference-ranges';

const PICKER = [...LAB_ANALYTES].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
const pickerName = (key: string, name: string) => (key === 'bun' ? 'Urea (from BUN)' : name);

const input: React.CSSProperties = { fontSize: 12, padding: '4px 6px', width: '100%', minWidth: 0 };

/**
 * Review of a parsed lab report before anything is saved: every row editable, included or
 * excluded, abnormal and critical values highlighted, flagged rows explained, unmapped rows kept.
 * Save is disabled until the identity check passes or is confirmed and any flagged rows that stay
 * ticked have been checked. The parent performs the save.
 */
export default function LabReview({
  draft, onChange, readers, existing, canSaveResults, hasPdf, identityCard, identityNeedsConfirmation,
  onViewPdf, onSave, saving, rangeContext,
}: {
  draft: LabImportDraft;
  onChange: (d: LabImportDraft) => void;
  readers: NameReaders;
  existing: ExistingResult[];
  canSaveResults: boolean;
  hasPdf: boolean;
  identityCard: React.ReactNode;
  identityNeedsConfirmation: boolean;
  onViewPdf: (() => void) | null;
  onSave: () => void;
  saving: boolean;
  /** Patient sex / age for the practice critical limits. */
  rangeContext?: RangeContext;
}) {
  const referenceRanges = useReferenceRanges();
  const included = includedLabRows(draft);
  const flaggedCount = flaggedIncludedCount(draft, readers, existing);
  const needsCheckTick = flaggedCount > 0 || draft.origin === 'ocr';
  const assessments = useMemo(
    () => new Map(draft.rows.map(r => [r.id, labRowAssessment(r, readers, existing)])),
    [draft.rows, readers, existing],
  );
  const criticalIds = new Set(included.filter(r => rowIsCritical(r, assessments.get(r.id)!, referenceRanges, rangeContext)).map(r => r.id));
  const canSave = !saving && labReviewCanSave({
    identityNeedsConfirmation, identityConfirmed: draft.identityConfirmed, canSaveResults,
    includedCount: included.length, needsCheckTick, flaggedChecked: draft.flaggedChecked, hasPdf,
  });
  const title = labSaveTitle(canSaveResults, included.length);

  const setRow = (id: string, patch: Partial<LabImportRow>) =>
    onChange({ ...draft, rows: draft.rows.map(r => (r.id === id ? { ...r, ...patch } : r)) });
  const removeRow = (id: string) => onChange({ ...draft, rows: draft.rows.filter(r => r.id !== id) });

  return (
    <div>
      {identityCard}

      {draft.layoutWarning && (
        <div style={notice('#fff7ed', '#fdba74', '#9a3412')}>
          The table layout could not be read reliably. Compare with the PDF, or add the values by hand.
        </div>
      )}
      {!canSaveResults && (
        <div style={notice('#f8fafc', '#cbd5e1', '#334155')}>
          🔒 Only a nurse or doctor can save results. You can attach the PDF to the record.
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
        <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
          Lab number
          <input value={draft.accession} onChange={e => onChange({ ...draft, accession: e.target.value })} style={{ ...input, width: 180 }} />
        </label>
        <label style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
          Collected (ECT)
          <input
            type="datetime-local"
            value={toEctInputValue(draft.collectedAt)}
            onChange={e => { const v = fromEctInputValue(e.target.value); if (v !== null) onChange({ ...draft, collectedAt: v }); }}
            style={{ ...input, width: 200 }}
          />
        </label>
        <button type="button" onClick={() => onChange({ ...draft, rows: draft.rows.map(r => ({ ...r, collectedAt: draft.collectedAt })) })} style={secondaryBtn}>
          Use this collection time for every row
        </button>
        {draft.reportedAt !== null && <span style={{ fontSize: 12, color: '#64748b' }}>Reported {formatEct(draft.reportedAt)}</span>}
        {onViewPdf && <button type="button" onClick={onViewPdf} style={secondaryBtn}>View PDF</button>}
      </div>

      {criticalIds.size > 0 && (
        <div role="alert" style={notice('#fef2f2', '#f87171', '#b91c1c', true)}>
          ⛔ Critical value in this report — review the highlighted rows.
        </div>
      )}

      <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
        Results ({included.length} of {draft.rows.length} ticked)
      </div>
      {draft.rows.length === 0 && (
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
          No results were read from the text. Add them by hand, or attach the PDF only.
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr style={{ fontSize: 11, color: '#64748b', textAlign: 'left' }}>
              <th style={th}>Save</th><th style={th}>Analyte</th><th style={th}>Value</th><th style={th}>Unit</th>
              <th style={th}>Reference</th><th style={th}>Flag</th><th style={th}>Collected</th><th style={th} aria-label="Remove" />
            </tr>
          </thead>
          <tbody>
            {draft.rows.map(row => {
              const a = assessments.get(row.id)!;
              const abnormal = abnormalityIsAbnormal(a.abnormality);
              const critical = criticalIds.has(row.id);
              const savedName = labRowSavedName(row);
              const misread = row.include ? webMisreaders(row.analyteKey, savedName) : [];
              const bg = critical ? '#fee2e2' : abnormal ? '#fff1f2' : undefined;
              return (
                <Fragment key={row.id}>
                  <tr style={{ background: bg, opacity: row.include ? 1 : 0.6 }}>
                    <td style={td}>
                      <input type="checkbox" aria-label={`Save ${savedName || 'this row'}`} checked={row.include}
                        onChange={e => setRow(row.id, { include: e.target.checked })} style={{ width: 16, height: 16 }} />
                    </td>
                    <td style={{ ...td, minWidth: 200 }}>
                      <select
                        aria-label="Saved as"
                        value={row.analyteKey ?? ''}
                        onChange={e => setRow(row.id, { analyteKey: e.target.value === '' ? null : e.target.value })}
                        style={input}
                      >
                        <option value="">Unmapped (keep the name below)</option>
                        {PICKER.map(an => <option key={an.key} value={an.key}>{pickerName(an.key, an.name)}</option>)}
                      </select>
                      {row.analyteKey === null && (
                        <input aria-label="Name" placeholder="Name" value={row.name} onChange={e => setRow(row.id, { name: e.target.value })} style={{ ...input, marginTop: 4 }} />
                      )}
                      <div style={{ marginTop: 3, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {row.analyteKey === null && <span style={pill('#fef3c7', '#92400e')}>UNMAPPED</span>}
                        {critical && <span style={pill('#dc2626', '#fff')}>CRITICAL</span>}
                      </div>
                    </td>
                    <td style={td}>
                      <input aria-label="Value" value={row.valueText} onChange={e => setRow(row.id, { valueText: e.target.value })}
                        style={{ ...input, fontWeight: abnormal ? 700 : 400, color: abnormal ? '#b91c1c' : undefined }} />
                    </td>
                    <td style={td}><input aria-label="Unit" value={row.unit} onChange={e => setRow(row.id, { unit: e.target.value })} style={input} /></td>
                    <td style={td}><input aria-label="Reference range" value={row.referenceRange} onChange={e => setRow(row.id, { referenceRange: e.target.value })} style={input} /></td>
                    <td style={{ ...td, width: 70 }}>
                      <input aria-label="Flag" value={row.flag} onChange={e => setRow(row.id, { flag: e.target.value.toUpperCase() })} style={input} />
                      {row.flag.trim() === '' && abnormal && <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c' }}>{abnormalityLabel(a.abnormality)}</div>}
                    </td>
                    <td style={{ ...td, width: 190 }}>
                      <input type="datetime-local" aria-label="Collected" value={toEctInputValue(row.collectedAt)}
                        onChange={e => { const v = fromEctInputValue(e.target.value); if (v !== null) setRow(row.id, { collectedAt: v }); }}
                        style={input} />
                    </td>
                    <td style={td}>
                      <button type="button" onClick={() => removeRow(row.id)} title="Remove this row" aria-label="Remove this row"
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}>×</button>
                    </td>
                  </tr>
                  <tr style={{ background: bg, opacity: row.include ? 1 : 0.6 }}>
                    <td />
                    <td colSpan={7} style={{ ...td, paddingTop: 0 }}>
                      {a.conversionNote !== null && (
                        <div style={note('#475569')}>Saves as {a.storedValue} {a.storedUnit} ({a.conversionNote})</div>
                      )}
                      {row.reportLabel !== '' && row.reportLabel.toLowerCase() !== savedName.toLowerCase() && (
                        <div style={note('#64748b')}>Printed as “{row.reportLabel}”</div>
                      )}
                      {a.issues.map((issue, i) => (
                        <div key={i} style={note(issueIsWarning(issue) ? '#b45309' : '#64748b')}>
                          {issueIsWarning(issue) ? '⚠ ' : 'ℹ '}{issueMessage(issue)}
                        </div>
                      ))}
                      {misread.length > 0 && row.analyteKey !== null && (
                        <div style={note('#64748b')}>
                          ℹ Saved in the report, but not added to this consultation's results: decision support would read “{savedName}” as {misread.join(', ')}.
                        </div>
                      )}
                      {row.sourceLine !== '' && (
                        <div style={{ ...note('#94a3b8'), fontFamily: 'monospace' }} title="Line in the report">{row.sourceLine}</div>
                      )}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => onChange({ ...draft, rows: [...draft.rows, emptyLabImportRow(draft.collectedAt)] })}
        style={{ ...secondaryBtn, marginTop: 8 }}
      >
        + Add a result by hand
      </button>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
        Unticked rows are not saved. Abnormal values are highlighted.
      </div>

      {canSaveResults && included.length > 0 && needsCheckTick && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <input type="checkbox" checked={draft.flaggedChecked} onChange={e => onChange({ ...draft, flaggedChecked: e.target.checked })} style={{ width: 16, height: 16 }} />
          {draft.origin === 'ocr'
            ? 'I have checked every ticked value against the PDF'
            : `I have checked the ${flaggedCount} flagged value${flaggedCount === 1 ? '' : 's'} I am saving`}
        </label>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <button type="button" onClick={onSave} disabled={!canSave} style={primaryBtn(canSave)}>
          {saving ? 'Saving…' : title}
        </button>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          Source: {labSource(draft.origin, hasPdf)}. Nothing is saved until you press {title}.
        </span>
      </div>
      {included.some(r => assessmentNeedsAttention(assessments.get(r.id)!)) && !draft.flaggedChecked && canSaveResults && (
        <div style={{ fontSize: 11, color: '#b45309', marginTop: 4 }}>Flagged rows that stay ticked need the check above.</div>
      )}
      {included.some(r => analyteForKey(r.analyteKey) === null && r.name.trim() === '') && (
        <div style={{ fontSize: 11, color: '#b45309', marginTop: 4 }}>Rows without a name are not saved.</div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: '4px 6px', borderBottom: '1px solid #e2e8f0', fontWeight: 700 };
const td: React.CSSProperties = { padding: '4px 6px', verticalAlign: 'top' };
const secondaryBtn: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontSize: 12, cursor: 'pointer',
};
const primaryBtn = (enabled: boolean): React.CSSProperties => ({
  padding: '8px 18px', borderRadius: 6, border: 'none', fontSize: 13, fontWeight: 700,
  background: enabled ? '#0d9488' : '#e2e8f0', color: enabled ? '#fff' : '#94a3b8', cursor: enabled ? 'pointer' : 'default',
});
const pill = (bg: string, color: string): React.CSSProperties => ({
  fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999, background: bg, color, letterSpacing: '.04em',
});
const note = (color: string): React.CSSProperties => ({ fontSize: 11, color, lineHeight: 1.5 });
function notice(bg: string, border: string, color: string, bold = false): React.CSSProperties {
  return { padding: '8px 12px', borderRadius: 8, background: bg, border: `1px solid ${border}`, color, fontSize: 13, fontWeight: bold ? 700 : 400, marginBottom: 10 };
}
