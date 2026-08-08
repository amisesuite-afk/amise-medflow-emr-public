import React, { useState, useMemo } from 'react';
import { DISEASES, getDiseaseSpecialty, getProtocol, applyModifiers, initPaneState, type PaneState } from '@workspace/pane-engine';
import IcdCodeBadge from '@/components/IcdCode';
import { ManagementPanel } from '@/components/ManagementPanel';
import { useAppContext } from '@/context/AppContext';
import { getMatrixByName } from '@/lib/cc-matrices';

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
  const {
    setActiveCcKey, setEncounterType, setProcedureData, procedureData,
    setTopSection, setActiveSection, age, sex,
    setPaneState, setIcdCodes, orderedInvestigations, setOrderedInvestigations,
  } = useAppContext();
  const [query, setQuery]       = useState('');
  const [specialty, setSpecialty] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  function launchMatrix(diseaseLabel: string, diseaseId?: string, icd10?: string) {
    const matrix = getMatrixByName(diseaseLabel);
    setActiveCcKey(matrix.id);
    setEncounterType(matrix.encounterType);
    setProcedureData({ ...procedureData, cc: [{ complaint: diseaseLabel, answers: {} }] });

    // Seed PANE to ≥85% for this disease so Assessment tab shows protocol immediately.
    if (diseaseId) {
      const parsedAge = parseInt(age, 10) || null;
      const diseases  = applyModifiers(DISEASES, parsedAge, sex);
      const fresh     = initPaneState(diseases);
      const n         = Object.keys(fresh.posteriors).length;
      const TARGET    = 0.90;
      const REST      = (1 - TARGET) / Math.max(n - 1, 1);
      const posteriors: Record<string, number> = {};
      for (const id in fresh.posteriors) {
        posteriors[id] = id === diseaseId ? TARGET : REST;
      }
      // Set iteration to MAX_QUESTIONS (8) so isConverged() returns true immediately.
      const seeded: PaneState = { posteriors, answered: {}, iteration: 8 };
      setPaneState(seeded);
    }

    // Set ICD code on the chart so CptPicker suggestions kick in.
    if (icd10) {
      setIcdCodes([icd10]);
    }

    // Pre-populate investigations from protocol (stat first, then urgent, then routine).
    if (diseaseId) {
      const protocol = getProtocol(diseaseId);
      if (protocol?.investigations.length) {
        const urgencyRank = { stat: 0, urgent: 1, routine: 2 } as const;
        const sorted = [...protocol.investigations].sort(
          (a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency],
        );
        const existing = new Set(orderedInvestigations.map((s: string) => s.toLowerCase().trim()));
        const toAdd = sorted
          .map(inv => inv.label)
          .filter(label => !existing.has(label.toLowerCase().trim()));
        if (toAdd.length) setOrderedInvestigations([...toAdd, ...orderedInvestigations]);
      }
    }

    setTopSection('consultation');
    setActiveSection(matrix.sections[0] ?? 'pmh');
  }

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
              <th style={{ padding: '8px 12px', textAlign: 'center' }}>Launch</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => {
              const spec    = getDiseaseSpecialty(d.id);
              const hasProto = getProtocol(d.id) !== null;
              const isOpen  = expanded === d.id;

              return (
                <React.Fragment key={d.id}>
                  <tr
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
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); launchMatrix(d.label, d.id, d.icd10); }}
                        style={{
                          padding: '3px 10px', borderRadius: 6, border: 'none',
                          background: '#0d9488', color: '#fff', fontSize: 11,
                          fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        Start →
                      </button>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr key={`${d.id}-proto`} style={{ background: '#0c1a2e' }}>
                      <td colSpan={6} style={{ padding: '12px 16px' }}>
                        {hasProto
                          ? <ManagementPanel diseaseId={d.id} icdCode={null} />
                          : <div style={{ color: '#6b7280', fontSize: 12, padding: '8px 0' }}>
                              No management protocol registered for this disease yet.
                            </div>
                        }
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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
