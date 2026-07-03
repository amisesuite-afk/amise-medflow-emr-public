import { useState } from 'react';
import CollapsibleCard from '@/components/CollapsibleCard';

interface FluidEntry {
  id: string;
  time: string;
  direction: 'in' | 'out';
  route: string;
  type: string;
  volumeMl: number;
  notes: string;
}

const IN_ROUTES = ['IV', 'PO (oral)', 'NG tube', 'PEG', 'Intraosseous', 'Epidural', 'Blood product'];
const OUT_ROUTES = ['Urine', 'NG aspirate', 'Surgical drain', 'Chest drain', 'Stoma output', 'Vomitus', 'Wound ooze', 'Insensible loss'];
const IN_TYPES: Record<string, string[]> = {
  'IV': ['0.9% NaCl', 'Hartmann\'s / LR', '5% Dextrose', 'Dextrose-saline', 'Gelofusine', 'Albumin 4%', 'Other colloid'],
  'PO (oral)': ['Water', 'Clear fluids', 'Full diet', 'Nutritional supplement'],
  'NG tube': ['Free water', 'Enteral feed', 'Medication flush'],
  'Blood product': ['pRBC', 'FFP', 'Platelets', 'Cryoprecipitate'],
};

function uid() { return Math.random().toString(36).slice(2, 9); }
function now() { return new Date().toLocaleTimeString('en-LC', { timeZone: 'America/St_Lucia', hour: '2-digit', minute: '2-digit' }); }

export default function FluidBalanceTracker() {
  const [entries, setEntries] = useState<FluidEntry[]>([]);
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [route, setRoute] = useState('');
  const [type, setType] = useState('');
  const [volumeMl, setVolumeMl] = useState('');
  const [time, setTime] = useState(now());
  const [notes, setNotes] = useState('');

  const routes = direction === 'in' ? IN_ROUTES : OUT_ROUTES;
  const typeOptions = direction === 'in' ? (IN_TYPES[route] ?? []) : [];

  function addEntry() {
    const vol = parseFloat(volumeMl);
    if (!route || !vol || vol <= 0) return;
    setEntries(prev => [...prev, {
      id: uid(), time, direction, route,
      type: type || route, volumeMl: vol, notes,
    }]);
    setVolumeMl('');
    setNotes('');
    setTime(now());
  }

  const totalIn = entries.filter(e => e.direction === 'in').reduce((s, e) => s + e.volumeMl, 0);
  const totalOut = entries.filter(e => e.direction === 'out').reduce((s, e) => s + e.volumeMl, 0);
  const balance = totalIn - totalOut;

  const balanceColor = balance > 1000 ? '#dc2626' : balance > 500 ? '#d97706' : balance < -500 ? '#9333ea' : '#16a34a';

  return (
    <CollapsibleCard title="Fluid Balance &amp; Drain Output" defaultOpen={false}
      badge={entries.length > 0 ? `${balance >= 0 ? '+' : ''}${balance.toFixed(0)} mL` : undefined}>

      {/* Balance summary */}
      {entries.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total In</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1e40af' }}>{totalIn.toFixed(0)} <span style={{ fontSize: 12 }}>mL</span></div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Out</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#7c3aed' }}>{totalOut.toFixed(0)} <span style={{ fontSize: 12 }}>mL</span></div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Balance</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: balanceColor }}>{balance >= 0 ? '+' : ''}{balance.toFixed(0)} <span style={{ fontSize: 12 }}>mL</span></div>
          </div>
        </div>
      )}

      {/* Entry form */}
      <div style={{ padding: '12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {(['in', 'out'] as const).map(d => (
            <button key={d} type="button" onClick={() => { setDirection(d); setRoute(''); setType(''); }}
              style={{
                flex: 1, padding: '6px', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: direction === d ? (d === 'in' ? '#1e40af' : '#7c3aed') : '#f1f5f9',
                color: direction === d ? '#fff' : '#374151', border: 'none',
              }}>
              {d === 'in' ? '▼ Input' : '▲ Output'}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>
              {direction === 'in' ? 'Route' : 'Drain / Output type'}
            </label>
            <select value={route} onChange={e => { setRoute(e.target.value); setType(''); }}
              style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db' }}>
              <option value="">— select —</option>
              {routes.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {typeOptions.length > 0 && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Fluid type</label>
              <select value={type} onChange={e => setType(e.target.value)}
                style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db' }}>
                <option value="">— select —</option>
                {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Volume (mL)</label>
            <input type="number" inputMode="numeric" min={0} step={10} value={volumeMl}
              onChange={e => setVolumeMl(e.target.value)} placeholder="e.g. 500"
              style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 3 }}>Time</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
          </div>
        </div>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)…"
          style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', marginBottom: 8, boxSizing: 'border-box' }} />
        <button type="button" onClick={addEntry}
          style={{
            width: '100%', padding: '8px', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: direction === 'in' ? '#1e40af' : '#7c3aed', color: '#fff', border: 'none',
          }}>
          Add {direction === 'in' ? 'Input' : 'Output'}
        </button>
      </div>

      {/* Entry table */}
      {entries.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Time', 'Direction', 'Route / Type', 'Volume (mL)', 'Notes', ''].map(h => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 700, fontSize: 11, color: '#6b7280', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 10px', color: '#374151', whiteSpace: 'nowrap' }}>{e.time}</td>
                  <td style={{ padding: '6px 10px' }}>
                    <span style={{
                      fontWeight: 700, fontSize: 11, padding: '2px 7px', borderRadius: 10,
                      background: e.direction === 'in' ? '#dbeafe' : '#ede9fe',
                      color: e.direction === 'in' ? '#1e40af' : '#7c3aed',
                    }}>
                      {e.direction === 'in' ? 'IN' : 'OUT'}
                    </span>
                  </td>
                  <td style={{ padding: '6px 10px', color: '#374151' }}>{e.type !== e.route ? `${e.route} — ${e.type}` : e.route}</td>
                  <td style={{ padding: '6px 10px', fontWeight: 700, textAlign: 'right',
                    color: e.direction === 'in' ? '#1e40af' : '#7c3aed' }}>
                    {e.direction === 'in' ? '+' : '−'}{e.volumeMl}
                  </td>
                  <td style={{ padding: '6px 10px', color: '#6b7280' }}>{e.notes}</td>
                  <td style={{ padding: '6px 10px' }}>
                    <button type="button" onClick={() => setEntries(prev => prev.filter(x => x.id !== e.id))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 13 }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CollapsibleCard>
  );
}
