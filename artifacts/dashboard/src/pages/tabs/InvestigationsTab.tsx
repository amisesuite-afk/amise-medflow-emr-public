import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

export default function InvestigationsTab() {
  const {
    orderedInvestigations, setOrderedInvestigations,
    investigationResults, setInvestigationResults,
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
    </div>
  );
}
