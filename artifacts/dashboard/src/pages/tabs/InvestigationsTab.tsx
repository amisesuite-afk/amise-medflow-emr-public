import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import { getActivePathways } from '@/lib/clinical-pathways';

function filterBySex(lab: string, sex: string): boolean {
  if (lab.includes('(M)') && sex === 'female') return false;
  if (lab.includes('(F)') && sex === 'male')   return false;
  return true;
}

function cleanLabel(lab: string): string {
  return lab.replace(/\s*\([MF]\)/g, '').trim();
}

// ── Laboratory Services Ltd — Saint Lucia ─────────────────────────────────────
const LSL_CATALOGUE: { category: string; tests: string[] }[] = [
  {
    category: 'Haematology',
    tests: [
      'Full Blood Count (FBC)', 'Peripheral Blood Film', 'Reticulocyte Count',
      'ESR', 'D-Dimer', 'Prothrombin Time (PT/INR)', 'APTT',
      'Blood Group & Type', 'Crossmatch',
    ],
  },
  {
    category: 'Biochemistry',
    tests: [
      'Urea & Electrolytes (U&E)', 'Creatinine + eGFR', 'Liver Function Tests (LFTs)',
      'Amylase', 'Lipase', 'Lipid Profile', 'HbA1c',
      'Fasting Glucose', 'Random Glucose', 'Uric Acid',
      'Calcium', 'Magnesium', 'Phosphate',
      'Ferritin', 'Serum Iron / TIBC', 'Vitamin B12', 'Folate',
      'TSH', 'Free T4', 'CRP', 'Albumin', 'Troponin I', 'BNP',
    ],
  },
  {
    category: 'Tumour Markers',
    tests: ['PSA (M)', 'CA-125 (F)', 'CEA', 'AFP', 'CA 19-9'],
  },
  {
    category: 'Microbiology',
    tests: [
      'Blood Culture ×2', 'Urine MCS', 'Wound Swab MCS',
      'Stool MCS', 'Throat Swab MCS', 'Sputum MCS', 'High Vaginal Swab (F)',
    ],
  },
  {
    category: 'Serology',
    tests: [
      'HBsAg (Hepatitis B)', 'Hepatitis C Antibody', 'HIV Combo (4th gen)',
      'Syphilis (RPR)', 'H. pylori Antigen',
    ],
  },
  {
    category: 'Urine',
    tests: [
      'Urine Dipstick + Microscopy', 'Urine Pregnancy Test (F)',
      '24-hr Urine Protein', 'Urine Albumin:Creatinine Ratio',
    ],
  },
];

function LslPanel({
  sex, orderedInvestigations, setOrderedInvestigations,
}: {
  sex: string;
  orderedInvestigations: string[];
  setOrderedInvestigations: (v: string[]) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const categories = LSL_CATALOGUE.map(g => g.category);
  const shown = activeCategory
    ? LSL_CATALOGUE.filter(g => g.category === activeCategory)
    : LSL_CATALOGUE;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Category filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        <button type="button" onClick={() => setActiveCategory(null)} style={{
          padding: '4px 11px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
          border: activeCategory === null ? '1.5px solid #1a3a5c' : '1px solid #d1d5db',
          background: activeCategory === null ? '#1a3a5c' : '#f9fafb',
          color: activeCategory === null ? '#fff' : '#374151',
          fontWeight: activeCategory === null ? 700 : 400,
        }}>All</button>
        {categories.map(cat => (
          <button key={cat} type="button" onClick={() => setActiveCategory(cat === activeCategory ? null : cat)} style={{
            padding: '4px 11px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
            border: activeCategory === cat ? '1.5px solid #1a3a5c' : '1px solid #d1d5db',
            background: activeCategory === cat ? '#1a3a5c' : '#f9fafb',
            color: activeCategory === cat ? '#fff' : '#374151',
            fontWeight: activeCategory === cat ? 700 : 400,
          }}>{cat}</button>
        ))}
      </div>

      {/* Test grid by category */}
      {shown.map(group => {
        const available = group.tests.filter(t =>
          filterBySex(t, sex) && !orderedInvestigations.includes(cleanLabel(t))
        );
        if (available.length === 0) return null;
        return (
          <div key={group.category}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#6b7280', marginBottom: 5 }}>
              {group.category}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {available.map(test => {
                const label = cleanLabel(test);
                return (
                  <button key={test} type="button"
                    onClick={() => {
                      if (!orderedInvestigations.includes(label))
                        setOrderedInvestigations([...orderedInvestigations, label]);
                    }}
                    style={{
                      padding: '5px 12px', borderRadius: 999, fontSize: 12,
                      border: '1px solid #c7d2fe', background: '#eef2ff',
                      color: '#3730a3', cursor: 'pointer', fontWeight: 500,
                    }}
                  >+ {label}</button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
        Laboratory Services Ltd · Tapion, Saint Lucia · Tel: (758) 459-2000
      </div>
    </div>
  );
}

export default function InvestigationsTab() {
  const {
    orderedInvestigations, setOrderedInvestigations,
    investigationResults, setInvestigationResults,
    symptoms, symptomDetails, sex,
  } = useAppContext();

  const [manualInput, setManualInput] = useState('');

  function addManual() {
    const trimmed = manualInput.trim();
    if (!trimmed || orderedInvestigations.includes(trimmed)) return;
    setOrderedInvestigations([...orderedInvestigations, trimmed]);
    setManualInput('');
  }

  function removeInvestigation(item: string) {
    setOrderedInvestigations(orderedInvestigations.filter(i => i !== item));
    // Also remove result if present
    if (investigationResults[item] !== undefined) {
      const next = { ...investigationResults };
      delete next[item];
      setInvestigationResults(next);
    }
  }

  function toggleResultReceived(item: string) {
    if (investigationResults[item] !== undefined) {
      // Remove result entry (uncheck)
      const next = { ...investigationResults };
      delete next[item];
      setInvestigationResults(next);
    } else {
      setInvestigationResults({ ...investigationResults, [item]: '' });
    }
  }

  function setResult(item: string, value: string) {
    setInvestigationResults({ ...investigationResults, [item]: value });
  }

  const resultReceivedCount = Object.keys(investigationResults).length;

  return (
    <div className="gap-y">
      <CollapsibleCard
        title="Ordered investigations"
        badge={orderedInvestigations.length > 0
          ? `${orderedInvestigations.length} ordered · ${resultReceivedCount} results`
          : undefined}
      >
        {orderedInvestigations.length === 0 && (
          <div style={{ color: '#9ca3af', fontSize: 13, marginBottom: 12 }}>
            No investigations ordered yet. Add from clinical pathway suggestions or enter below.
          </div>
        )}

        {orderedInvestigations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {orderedInvestigations.map(item => {
              const hasResult = investigationResults[item] !== undefined;
              return (
                <div
                  key={item}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: '8px 12px',
                    background: hasResult ? '#f0fdf4' : '#fafafa',
                    borderColor: hasResult ? '#86efac' : '#e5e7eb',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      id={`inv-${item}`}
                      checked={hasResult}
                      onChange={() => toggleResultReceived(item)}
                      style={{ width: 15, height: 15, cursor: 'pointer' }}
                    />
                    <label
                      htmlFor={`inv-${item}`}
                      style={{
                        flex: 1,
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: 'pointer',
                        textDecoration: hasResult ? 'line-through' : 'none',
                        color: hasResult ? '#16a34a' : '#111827',
                      }}
                    >
                      {item}
                    </label>
                    {hasResult && (
                      <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Result received</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeInvestigation(item)}
                      title="Remove"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#9ca3af',
                        cursor: 'pointer',
                        fontSize: 16,
                        lineHeight: 1,
                        padding: '0 2px',
                      }}
                    >
                      ×
                    </button>
                  </div>

                  {hasResult && (
                    <div style={{ marginTop: 6 }}>
                      <input
                        type="text"
                        value={investigationResults[item] ?? ''}
                        onChange={e => setResult(item, e.target.value)}
                        placeholder={`Enter result for ${item}…`}
                        style={{
                          width: '100%',
                          fontSize: 13,
                          padding: '4px 8px',
                          border: '1px solid #86efac',
                          borderRadius: 6,
                          background: '#fff',
                          outline: 'none',
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Manual add */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addManual()}
            placeholder="Add investigation manually (e.g. Serum amylase)…"
            style={{ flex: 1, fontSize: 13 }}
          />
          <button
            type="button"
            onClick={addManual}
            disabled={!manualInput.trim()}
            style={{
              padding: '6px 14px',
              background: manualInput.trim() ? '#0d9488' : '#e5e7eb',
              color: manualInput.trim() ? '#fff' : '#9ca3af',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              cursor: manualInput.trim() ? 'pointer' : 'default',
              fontWeight: 500,
            }}
          >
            + Add
          </button>
        </div>
      </CollapsibleCard>

      {/* Clinical pathway suggestions — sex-filtered */}
      {(() => {
        const pathways = getActivePathways(symptoms, symptomDetails);
        if (pathways.length === 0) return null;

        const allLabs = [...new Set(pathways.flatMap(p => p.labsImaging))];
        const filtered = allLabs.filter(lab => filterBySex(lab, sex));
        const available = filtered.filter(lab => !orderedInvestigations.includes(cleanLabel(lab)));

        if (available.length === 0) return null;

        return (
          <CollapsibleCard title={`Pathway suggestions — ${available.length} available`}>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
              Based on active clinical pathways. Tap to add to the ordered list.
              {sex === 'female' && <span style={{ color: '#be185d', marginLeft: 6 }}>♀ PSA excluded</span>}
              {sex === 'male'   && <span style={{ color: '#1d4ed8', marginLeft: 6 }}>♂ CA-125 excluded</span>}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {available.map(lab => {
                const label = cleanLabel(lab);
                return (
                  <button
                    key={lab}
                    type="button"
                    onClick={() => {
                      if (!orderedInvestigations.includes(label)) {
                        setOrderedInvestigations([...orderedInvestigations, label]);
                      }
                    }}
                    style={{
                      padding: '5px 11px',
                      borderRadius: 999,
                      border: '1px solid #d1d5db',
                      background: '#f9fafb',
                      color: '#374151',
                      fontSize: 12,
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    + {label}
                  </button>
                );
              })}
            </div>
          </CollapsibleCard>
        );
      })()}

      {/* Laboratory Services Ltd catalogue */}
      <CollapsibleCard title="Laboratory Services Ltd — Order Tests" defaultOpen={false}>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
          Tap any test to add it to the ordered list. Filtered by patient sex.
        </p>
        <LslPanel
          sex={sex}
          orderedInvestigations={orderedInvestigations}
          setOrderedInvestigations={setOrderedInvestigations}
        />
      </CollapsibleCard>
    </div>
  );
}
