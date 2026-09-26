import {
  formatDOB, identityIsConsistent, identityMessages, identityRequiresConfirmation,
  type CalendarDay, type ReportHeader, type ReportIdentityCheck,
} from '@workspace/triage-engine/report-import';

const sexLabel = (s: string | null | undefined) => (s === 'male' ? 'M' : s === 'female' ? 'F' : '—');

/**
 * Identity check against the open chart. When anything conflicts or is missing: a prominent
 * warning and an explicit "This report belongs to …" confirmation; the caller keeps Save disabled
 * until it is ticked. Nothing is ever filed to another patient automatically.
 */
export default function IdentityCard({
  check, header, chartName, chartDOB, chartSex, confirmed, onConfirmedChange,
}: {
  check: ReportIdentityCheck;
  header: ReportHeader;
  chartName: string;
  chartDOB: CalendarDay | null;
  chartSex: string;
  confirmed: boolean;
  onConfirmedChange: (v: boolean) => void;
}) {
  const ok = identityIsConsistent(check);
  const needs = identityRequiresConfirmation(check);
  const reportDOB = header.dateOfBirth
    ? formatDOB(header.dateOfBirth)
    : header.ageYears !== null ? `age ${header.ageYears}` : 'no DOB';
  const cell: React.CSSProperties = { fontSize: 12, padding: '2px 10px 2px 0' };
  return (
    <div
      role={ok ? 'status' : 'alert'}
      style={{
        padding: 12, borderRadius: 10, marginBottom: 12,
        background: ok ? '#ecfdf5' : '#fef2f2',
        border: `1px solid ${ok ? '#6ee7b7' : '#fca5a5'}`,
      }}
    >
      {ok ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#047857' }}>✓ Name and date of birth match this chart</div>
          {check.name.kind === 'compatible' && (
            <div style={{ fontSize: 12, color: '#475569' }}>Name is similar but not identical ({check.name.note}).</div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#b91c1c' }}>⚠ Check the patient before saving</div>
          <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
            {identityMessages(check).map(m => <li key={m} style={{ fontSize: 13, color: '#7f1d1d' }}>{m}</li>)}
          </ul>
        </>
      )}
      <table style={{ marginTop: 8, borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <th scope="row" style={{ ...cell, textAlign: 'left', color: '#64748b' }}>Report</th>
            <td style={cell}>{header.patientName ?? 'no name'}</td>
            <td style={cell}>{reportDOB}</td>
            <td style={cell}>{sexLabel(header.sex)}</td>
          </tr>
          <tr>
            <th scope="row" style={{ ...cell, textAlign: 'left', color: '#64748b' }}>Chart</th>
            <td style={cell}>{chartName || '—'}</td>
            <td style={cell}>{chartDOB ? formatDOB(chartDOB) : 'no DOB'}</td>
            <td style={cell}>{sexLabel(chartSex)}</td>
          </tr>
        </tbody>
      </table>
      {needs && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, fontWeight: 700, color: '#7f1d1d', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => onConfirmedChange(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          This report belongs to {chartName || 'this patient'}
        </label>
      )}
    </div>
  );
}
