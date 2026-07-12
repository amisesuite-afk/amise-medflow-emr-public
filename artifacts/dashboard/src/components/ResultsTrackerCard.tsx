import { useState, useMemo } from 'react';
import CollapsibleCard from '@/components/CollapsibleCard';

type ResultStatus = 'ordered' | 'sent_to_lab' | 'result_available' | 'reviewed' | 'actioned';
type ResultCategory = 'bloods' | 'imaging' | 'histology' | 'micro' | 'other';
type Urgency = 'routine' | 'urgent' | 'stat';

interface PendingResult {
  id: string;
  category: ResultCategory;
  name: string;
  dateOrdered: string;
  status: ResultStatus;
  urgency: Urgency;
  expectedBy: string;
  result: string;
  action: string;
}

const STATUS_FLOW: ResultStatus[] = ['ordered', 'sent_to_lab', 'result_available', 'reviewed', 'actioned'];

const STATUS_LABELS: Record<ResultStatus, string> = {
  ordered:          'Ordered',
  sent_to_lab:      'Sent to lab',
  result_available: 'Result available',
  reviewed:         'Reviewed',
  actioned:         'Actioned',
};

const STATUS_COLORS: Record<ResultStatus, { bg: string; text: string; border: string }> = {
  ordered:          { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' },
  sent_to_lab:      { bg: '#eff6ff', text: '#1d4ed8', border: '#93c5fd' },
  result_available: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  reviewed:         { bg: '#f0fdf4', text: '#15803d', border: '#86efac' },
  actioned:         { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' },
};

const URGENCY_COLORS: Record<Urgency, string> = {
  routine: '#64748b',
  urgent:  '#f59e0b',
  stat:    '#ef4444',
};

const CATEGORY_PRESETS: Record<ResultCategory, string[]> = {
  bloods: [
    'FBC', 'U&E / Creatinine', 'LFTs', 'Coagulation (INR/APTT)', 'Glucose / HbA1c',
    'Ca2+ / PO4 / Mg', 'Lipase / Amylase', 'Troponin', 'BNP / NT-proBNP',
    'Thyroid function (TFTs)', 'Tumour markers (CEA / CA19-9 / CA125 / PSA / AFP)',
    'Blood cultures', 'Cross-match / G&S', 'ESR / CRP', 'Iron studies / ferritin',
    'Vitamin B12 / folate', 'Liver screen (hepatitis B, C, ANA, ASMA)',
    'Coeliac screen', 'Haematinic screen', 'ACE level',
  ],
  imaging: [
    'CXR', 'AXR', 'Abdominal USS', 'Pelvis USS', 'CT abdomen/pelvis (± contrast)',
    'CT chest', 'CT chest/abdomen/pelvis (staging)',
    'MRI abdomen', 'MRI pelvis / rectum', 'MRI liver',
    'MRCP', 'Endoscopic USS (EUS)',
    'PET-CT', 'Nuclear medicine (bone scan)', 'Mammogram', 'Breast USS', 'Thyroid USS',
    'Neck USS', 'Doppler (DVT / arterial)', 'Echo (cardiac)',
  ],
  histology: [
    'Biopsy — colon polyp', 'Biopsy — gastric', 'Biopsy — oesophagus',
    'Biopsy — liver', 'Biopsy — lymph node', 'Biopsy — breast',
    'Biopsy — thyroid (FNA / core)', 'Biopsy — soft tissue',
    'Surgical specimen — gallbladder', 'Surgical specimen — appendix',
    'Surgical specimen — colorectal resection', 'Surgical specimen — hernia sac',
    'Sentinel lymph node', 'Wide local excision',
  ],
  micro: [
    'Wound swab (MC&S)', 'Urine MC&S', 'Sputum MC&S',
    'Blood cultures (aerobic + anaerobic)', 'Drain fluid MC&S',
    'H. pylori CLO test', 'H. pylori stool antigen', 'H. pylori serology',
    'Bile culture', 'Peritoneal fluid MC&S',
  ],
  other: [
    'Pulmonary function tests (PFTs)', 'ECG', 'Exercise stress test',
    'DEXA scan', 'Colonoscopy', 'OGD / gastroscopy',
    'Flexible sigmoidoscopy', 'ERCP', 'Capsule endoscopy',
    'Gastric emptying study', 'Ambulatory pH study',
  ],
};

const CATEGORY_LABELS: Record<ResultCategory, string> = {
  bloods: 'Blood tests', imaging: 'Imaging', histology: 'Histology/pathology',
  micro: 'Microbiology', other: 'Other investigations',
};

const CATEGORY_ICONS: Record<ResultCategory, string> = {
  bloods: '🩸', imaging: '🔬', histology: '🧬', micro: '🦠', other: '📋',
};

function today() {
  return new Date().toISOString().split('T')[0];
}

function uid() { return `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

export default function ResultsTrackerCard() {
  const [results, setResults] = useState<PendingResult[]>([]);
  const [addCat, setAddCat] = useState<ResultCategory>('bloods');
  const [addName, setAddName] = useState('');
  const [addUrgency, setAddUrgency] = useState<Urgency>('routine');
  const [addExpected, setAddExpected] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ResultStatus | 'all'>('all');

  function addResult() {
    if (!addName.trim()) return;
    const r: PendingResult = {
      id: uid(), category: addCat, name: addName.trim(),
      dateOrdered: today(), status: 'ordered',
      urgency: addUrgency, expectedBy: addExpected,
      result: '', action: '',
    };
    setResults(prev => [r, ...prev]);
    setAddName('');
    setAddExpected('');
  }

  function advanceStatus(id: string) {
    setResults(prev => prev.map(r => {
      if (r.id !== id) return r;
      const idx = STATUS_FLOW.indexOf(r.status);
      const next = STATUS_FLOW[idx + 1];
      return next ? { ...r, status: next } : r;
    }));
  }

  function updateField(id: string, field: keyof PendingResult, val: string) {
    setResults(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
  }

  function remove(id: string) {
    setResults(prev => prev.filter(r => r.id !== id));
  }

  const pending = results.filter(r => r.status !== 'actioned');
  const statCount = results.filter(r => r.urgency === 'stat' && r.status !== 'actioned').length;
  const urgentCount = results.filter(r => r.urgency === 'urgent' && r.status !== 'actioned').length;
  const availableCount = results.filter(r => r.status === 'result_available').length;

  const badge = availableCount > 0
    ? `${availableCount} result${availableCount > 1 ? 's' : ''} ready`
    : pending.length > 0 ? pending.length : undefined;

  const visible = filterStatus === 'all'
    ? results
    : results.filter(r => r.status === filterStatus);

  const grouped = useMemo(() => {
    const g: Partial<Record<ResultCategory, PendingResult[]>> = {};
    for (const r of visible) {
      if (!g[r.category]) g[r.category] = [];
      g[r.category]!.push(r);
    }
    return g;
  }, [visible]);

  return (
    <CollapsibleCard
      title="Investigation results tracker"
      badge={badge}
      defaultOpen={availableCount > 0 || statCount > 0}
    >
      {/* Alert bar */}
      {(statCount > 0 || urgentCount > 0 || availableCount > 0) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {statCount > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5' }}>
              ⚡ {statCount} STAT pending
            </span>
          )}
          {urgentCount > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: '#fffbeb', color: '#92400e', border: '1px solid #fcd34d' }}>
              ⏱ {urgentCount} urgent pending
            </span>
          )}
          {availableCount > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
              📋 {availableCount} result{availableCount > 1 ? 's' : ''} awaiting review
            </span>
          )}
        </div>
      )}

      {/* Add row */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <select value={addCat} onChange={e => { setAddCat(e.target.value as ResultCategory); setAddName(''); }}
          style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 5 }}>
          {(Object.entries(CATEGORY_LABELS) as [ResultCategory, string][]).map(([v, l]) => (
            <option key={v} value={v}>{CATEGORY_ICONS[v]} {l}</option>
          ))}
        </select>

        <select value={addName} onChange={e => setAddName(e.target.value)}
          style={{ flex: 2, minWidth: 160, fontSize: 11, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 5 }}>
          <option value="">— select investigation —</option>
          {CATEGORY_PRESETS[addCat].map(p => <option key={p} value={p}>{p}</option>)}
          <option value="__custom__">Custom…</option>
        </select>

        {addName === '__custom__' && (
          <input placeholder="Custom investigation name"
            onChange={e => setAddName(e.target.value)}
            style={{ flex: 2, fontSize: 11, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 5 }} />
        )}

        <select value={addUrgency} onChange={e => setAddUrgency(e.target.value as Urgency)}
          style={{ fontSize: 11, padding: '4px 8px', border: `1px solid ${URGENCY_COLORS[addUrgency]}`, borderRadius: 5, color: URGENCY_COLORS[addUrgency], fontWeight: 600 }}>
          <option value="routine">Routine</option>
          <option value="urgent">Urgent</option>
          <option value="stat">STAT</option>
        </select>

        <input type="date" value={addExpected} onChange={e => setAddExpected(e.target.value)}
          title="Expected by date"
          style={{ fontSize: 11, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 5 }} />

        <button type="button" onClick={addResult}
          disabled={!addName.trim() || addName === '__custom__'}
          style={{
            padding: '4px 14px', borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: '#0f172a', color: '#fff', border: 'none',
          }}>
          + Track
        </button>
      </div>

      {/* Filter tabs */}
      {results.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
          {(['all', ...STATUS_FLOW] as const).map(s => {
            const count = s === 'all' ? results.length : results.filter(r => r.status === s).length;
            return count > 0 && (
              <button key={s} type="button" onClick={() => setFilterStatus(s)}
                style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${filterStatus === s ? '#0f172a' : '#e2e8f0'}`,
                  background: filterStatus === s ? '#0f172a' : '#fff',
                  color: filterStatus === s ? '#fff' : '#374151',
                }}>
                {s === 'all' ? 'All' : STATUS_LABELS[s]} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Results list */}
      {visible.length === 0 && results.length === 0 && (
        <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
          No investigations tracked. Add above to start tracking results.
        </div>
      )}

      {(Object.entries(grouped) as [ResultCategory, PendingResult[]][]).map(([cat, items]) => (
        <div key={cat} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748b', marginBottom: 5 }}>
            {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {items.map(r => {
              const sc = STATUS_COLORS[r.status];
              const isExpanded = expandedId === r.id;
              const canAdvance = r.status !== 'actioned';
              return (
                <div key={r.id}
                  style={{ border: `1px solid ${sc.border}`, borderRadius: 7, overflow: 'hidden' }}>
                  {/* Header row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                    background: sc.bg, cursor: 'pointer',
                  }}
                    onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                    <span style={{ fontSize: 11, fontWeight: 700, flex: 1, color: '#1e293b' }}>{r.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: URGENCY_COLORS[r.urgency], textTransform: 'uppercase' }}>{r.urgency}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 12,
                      background: sc.border, color: sc.text,
                    }}>
                      {STATUS_LABELS[r.status]}
                    </span>
                    {canAdvance && (
                      <button type="button"
                        onClick={e => { e.stopPropagation(); advanceStatus(r.id); }}
                        title="Advance to next status"
                        style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 5, cursor: 'pointer',
                          border: '1px solid #0d9488', background: '#f0fdfa', color: '#0d9488', fontWeight: 700,
                        }}>
                        → Next
                      </button>
                    )}
                    <button type="button"
                      onClick={e => { e.stopPropagation(); remove(r.id); }}
                      style={{ fontSize: 13, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>
                      ×
                    </button>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{ padding: '10px 12px', borderTop: `1px solid ${sc.border}`, background: '#fff', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Status stepper */}
                      <div style={{ display: 'flex', gap: 0, overflow: 'auto' }}>
                        {STATUS_FLOW.map((s, i) => {
                          const passed = STATUS_FLOW.indexOf(r.status) >= i;
                          return (
                            <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                              <button type="button"
                                onClick={() => setResults(prev => prev.map(x => x.id === r.id ? { ...x, status: s } : x))}
                                style={{
                                  fontSize: 10, padding: '2px 8px', cursor: 'pointer', fontWeight: 600,
                                  border: `1px solid ${passed ? '#0d9488' : '#e2e8f0'}`,
                                  background: s === r.status ? '#0d9488' : passed ? '#f0fdfa' : '#f8fafc',
                                  color: s === r.status ? '#fff' : passed ? '#0d9488' : '#9ca3af',
                                  borderRadius: i === 0 ? '6px 0 0 6px' : i === STATUS_FLOW.length - 1 ? '0 6px 6px 0' : 0,
                                  borderLeft: i > 0 ? 'none' : undefined,
                                  whiteSpace: 'nowrap',
                                }}>
                                {STATUS_LABELS[s]}
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>Date ordered</div>
                          <div style={{ fontSize: 12 }}>{r.dateOrdered}</div>
                        </div>
                        {r.expectedBy && (
                          <div>
                            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>Expected by</div>
                            <div style={{ fontSize: 12, color: new Date(r.expectedBy) < new Date() && r.status === 'ordered' ? '#dc2626' : '#374151', fontWeight: new Date(r.expectedBy) < new Date() ? 600 : 400 }}>
                              {r.expectedBy}
                              {new Date(r.expectedBy) < new Date() && r.status !== 'actioned' && ' ⚠ Overdue'}
                            </div>
                          </div>
                        )}
                      </div>

                      {(r.status === 'result_available' || r.status === 'reviewed' || r.status === 'actioned') && (
                        <div>
                          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>Result summary</div>
                          <textarea value={r.result}
                            onChange={e => updateField(r.id, 'result', e.target.value)}
                            placeholder="Paste or summarise result here…"
                            style={{ width: '100%', fontSize: 11, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 5, minHeight: 50 }} />
                        </div>
                      )}

                      {(r.status === 'reviewed' || r.status === 'actioned') && (
                        <div>
                          <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 2 }}>Action taken</div>
                          <textarea value={r.action}
                            onChange={e => updateField(r.id, 'action', e.target.value)}
                            placeholder="e.g. Discussed with patient. Referral sent. Repeat in 3 months."
                            style={{ width: '100%', fontSize: 11, padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 5, minHeight: 40 }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </CollapsibleCard>
  );
}
