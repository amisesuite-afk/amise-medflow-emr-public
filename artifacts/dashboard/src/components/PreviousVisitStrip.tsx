import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';

const TYPE_LABELS: Record<string, string> = {
  quick_consult:    'Quick Review',
  surgical_consult: 'Surgical Consult',
  office_procedure: 'Office Procedure',
  endoscopy:        'Endoscopy',
  major_emergency:  'Emergency',
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PreviousVisitStrip() {
  const { patientId, encounterId, recentEncounters } = useAppContext();
  const encounters = recentEncounters.filter(r => r.id !== encounterId);
  const [expanded, setExpanded] = useState(false);

  if (!patientId || encounters.length === 0) return null;

  const latest = encounters[0];

  return (
    <div style={{
      marginBottom: 8,
      border: '1px solid #fcd34d',
      borderRadius: 10,
      overflow: 'hidden',
      background: '#fffbeb',
    }}>
      {/* Header strip — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 14 }}>📅</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          PREV VISITS
        </span>
        <span style={{ fontSize: 11, color: '#b45309', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 20, padding: '1px 8px', fontWeight: 700 }}>
          {encounters.length}
        </span>
        {!expanded && (
          <span style={{ fontSize: 12, color: '#78350f', marginLeft: 4 }}>
            {fmt(latest.createdAt)} · {TYPE_LABELS[latest.encounterType] ?? latest.encounterType}
            {latest.chiefComplaint ? ` · ${latest.chiefComplaint}` : ''}
            {latest.diagnosis ? ` — ${latest.diagnosis}` : ''}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#92400e', fontWeight: 700 }}>
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* Expanded list — reference only */}
      {expanded && (
        <div style={{ borderTop: '1px solid #fcd34d', padding: '8px 12px 10px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Reference only — does not modify current encounter
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {encounters.map(enc => (
                <div key={enc.id} style={{
                  background: '#fff',
                  border: '1px solid #fde68a',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, color: '#78350f' }}>{fmt(enc.createdAt)}</span>
                    <span style={{ fontSize: 10, color: '#fff', background: '#d97706', borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                      {TYPE_LABELS[enc.encounterType] ?? enc.encounterType}
                    </span>
                    {enc.site && (
                      <span style={{ fontSize: 10, color: '#92400e' }}>{enc.site}</span>
                    )}
                    <span style={{
                      marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                      color: enc.status === 'open' ? '#dc2626' : '#6b7280',
                    }}>
                      {enc.status}
                    </span>
                  </div>
                  {enc.chiefComplaint && (
                    <div style={{ color: '#374151', marginBottom: 2 }}>
                      <span style={{ fontWeight: 600, color: '#78350f' }}>CC:</span> {enc.chiefComplaint}
                    </div>
                  )}
                  {enc.diagnosis && (
                    <div style={{ color: '#374151' }}>
                      <span style={{ fontWeight: 600, color: '#78350f' }}>Dx:</span> {enc.diagnosis}
                      {enc.icd10Code ? ` (${enc.icd10Code})` : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
        </div>
      )}
    </div>
  );
}
