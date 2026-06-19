import { useState, useMemo } from 'react';
import { DISEASES, getDiseaseSpecialty, getProtocol } from '@workspace/pane-engine';
import IcdCodeBadge from '@/components/IcdCode';
import { ManagementPanel } from '@/components/ManagementPanel';

const SPECIALTY_LABELS: Record<string, string> = {
  general_surgery: 'General Surgery',
  hepatobiliary:   'Hepatobiliary',
  colorectal:      'Colorectal',
  hernia:          'Hernia & Abdominal Wall',
  breast:          'Breast',
  endocrine:       'Endocrine / Neck',
  vascular:        'Vascular',
  gynaecology:     'Gynaecology',
  trauma:          'Trauma & Burns',
  catchall:        'Other',
};

const SPECIALTIES = Array.from(
  new Set(DISEASES.map(d => getDiseaseSpecialty(d.id)))
).sort();

export default function DictionaryTab() {
  const [query, setQuery]       = useState('');
  const [specialty, setSpecialty] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return DISEASES.filter(d => {
      const matchSpec = !specialty || getDiseaseSpecialty(d.id) === specialty;
      const matchQ    = !q || d.label.toLowerCase().includes(q) || d.icd10.toLowerCase().includes(q);
      return matchSpec && matchQ;
    });
  }, [query, specialty]);

  return (
    <div style={{ padding: '16px 20px', maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0f766e', marginBottom: 4 }}>
          Disease Dictionary
        </div>
        <div style={{ fontSize: 12, color: '#6b7280' }}>
          {DISEASES.length} diseases registered across {SPECIALTIES.length} specialties. Click a row to view its management protocol.
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or ICD-10…"
          style={{
            flex: 1, minWidth: 200, padding: '6px 10px',
            border: '1px solid #d1d5db', borderRadius: 6,
            fontSize: 13, background: 'var(--surface, #1e2330)', color: 'var(--text, #e2e8f0)',
          }}
        />
        <select
          value={specialty}
          onChange={e => setSpecialty(e.target.value)}
          style={{
            padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6,
            fontSize: 13, background: 'var(--surface, #1e2330)', color: 'var(--text, #e2e8f0)',
          }}
        >
          <option value="">All specialties</option>
          {SPECIALTIES.map(s => (
            <option key={s} value={s}>{SPECIALTY_LABELS[s] ?? s}</option>
          ))}
        </select>
        <span style={{ alignSelf: 'center', fontSize: 12, color: '#6b7280' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{ border: '1px solid #374151', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#111827', color: '#9ca3af', textTransform: 'uppercase', fontSize: 10, letterSpacing: '0.06em' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Disease</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>ICD-10</th>
              <th style={{ padding: '8px 12px', textAlign: 'left' }}>Specialty</th>
              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Prior</th>
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Protocol</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => {
              const spec    = getDiseaseSpecialty(d.id);
              const hasProto = getProtocol(d.id) !== null;
              const isOpen  = expanded === d.id;

              return (
                <>
                  <tr
                    key={d.id}
                    onClick={() => setExpanded(isOpen ? null : d.id)}
                    style={{
                      background: i % 2 === 0 ? '#0f172a' : '#1e293b',
                      cursor: 'pointer',
                      borderBottom: isOpen ? '2px solid #0d9488' : '1px solid #1f2937',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#164e63'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? '#0f172a' : '#1e293b'; }}
                  >
                    <td style={{ padding: '8px 12px', color: '#e2e8f0', fontWeight: 500 }}>{d.label}</td>
                    <td style={{ padding: '8px 12px' }}><IcdCodeBadge code={d.icd10} /></td>
                    <td style={{ padding: '8px 12px', color: '#a3e7df' }}>{SPECIALTY_LABELS[spec] ?? spec}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#94a3b8' }}>
                      {(d.prior * 100).toFixed(2)}%
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {hasProto
                        ? <span style={{ color: '#34d399', fontWeight: 700 }}>✓</span>
                        : <span style={{ color: '#4b5563' }}>—</span>
                      }
                    </td>
                  </tr>

                  {isOpen && (
                    <tr key={`${d.id}-proto`} style={{ background: '#0c1a2e' }}>
                      <td colSpan={5} style={{ padding: '12px 16px' }}>
                        {hasProto
                          ? <ManagementPanel diseaseId={d.id} icdCode={null} />
                          : <div style={{ color: '#6b7280', fontSize: 12, padding: '8px 0' }}>
                              No management protocol registered for this disease yet.
                            </div>
                        }
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
            No diseases match your search.
          </div>
        )}
      </div>
    </div>
  );
}
