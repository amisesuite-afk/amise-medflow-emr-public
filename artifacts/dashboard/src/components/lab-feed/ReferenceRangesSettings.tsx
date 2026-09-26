import { useMemo, useState } from 'react';
import {
  DEFAULT_RANGE_SOURCE, DEFAULT_REFERENCE_RANGES, catalogueUnitFor, rangeAnalyteNames, rangeText,
  referenceRangeProblems, rowToReferenceRange, type ReferenceRange,
} from '@workspace/triage-engine/reference-ranges';
import { useReferenceRangeData } from '@/hooks/useReferenceRanges';
import {
  createReferenceRange, retireReferenceRange, updateReferenceRange, type RangeInput, type StoredRangeRow,
} from '@/lib/reference-ranges-store';

/**
 * Settings → Reference ranges (admin). The practice's laboratory ranges, read by every range /
 * ULN / critical-limit consumer (lib/triage-engine/src/reference-ranges.ts): lab-feed flags, the
 * report-import critical flag, the decision layer's "× ULN" rules, TG18 cholangitis, tumour
 * markers, Light's criteria. Built-in defaults apply until a practice range replaces them.
 * Every change goes through the API (admin only) and is audit-logged with before / after values.
 */

const cell: React.CSSProperties = { padding: '6px 8px', borderTop: '1px solid #e2e8f0', fontSize: 12, verticalAlign: 'top' };
const small: React.CSSProperties = { fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' };
const field: React.CSSProperties = { fontSize: 12, padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: 5, width: '100%', boxSizing: 'border-box' };

function ectToday(): string {
  return new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10);
}

const fmt = (n: number | null) => (n === null ? '' : String(n));
const age = (r: ReferenceRange) => (r.ageMinYears === null && r.ageMaxYears === null ? 'all ages'
  : r.ageMaxYears === null ? `${r.ageMinYears}+` : `${r.ageMinYears ?? 0}–<${r.ageMaxYears}`);
const critical = (r: ReferenceRange) => [r.criticalLow !== null ? `< ${r.criticalLow}` : '', r.criticalHigh !== null ? `> ${r.criticalHigh}` : '']
  .filter(Boolean).join(' or ');

interface Draft { id: string | null; values: Record<keyof RangeInput, string> }

function draftFrom(r: ReferenceRange, id: string | null, asNew: boolean): Draft {
  return {
    id,
    values: {
      analyte: r.analyte, unit: r.unit, sex: r.sex,
      ageMinYears: fmt(r.ageMinYears), ageMaxYears: fmt(r.ageMaxYears),
      lower: fmt(r.lower), upper: fmt(r.upper), criticalLow: fmt(r.criticalLow), criticalHigh: fmt(r.criticalHigh),
      labSource: asNew ? '' : r.labSource, effectiveFrom: asNew ? ectToday() : r.effectiveFrom,
    },
  };
}

function toInput(v: Draft['values']): RangeInput {
  const n = (s: string) => (s.trim() === '' ? null : Number(s));
  return {
    analyte: v.analyte, unit: v.unit.trim(), sex: v.sex as RangeInput['sex'],
    ageMinYears: n(v.ageMinYears), ageMaxYears: n(v.ageMaxYears),
    lower: n(v.lower), upper: n(v.upper), criticalLow: n(v.criticalLow), criticalHigh: n(v.criticalHigh),
    labSource: v.labSource.trim(), effectiveFrom: v.effectiveFrom.trim(),
  };
}

function RangeForm({ draft, onCancel, onSaved }: { draft: Draft; onCancel: () => void; onSaved: () => void }) {
  const [v, setV] = useState(draft.values);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = toInput(v);
  const problems = referenceRangeProblems(input);
  if (input.labSource === DEFAULT_RANGE_SOURCE) problems.push('Enter your laboratory, not the default text');
  const fixedUnit = catalogueUnitFor(v.analyte);
  const set = (k: keyof RangeInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV(p => ({ ...p, [k]: e.target.value }));

  async function save() {
    setBusy(true); setErr(null);
    const r = draft.id ? await updateReferenceRange(draft.id, input) : await createReferenceRange(input);
    setBusy(false);
    if (r.ok) onSaved(); else setErr(r.error);
  }

  const lbl = (text: string, el: React.ReactNode) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, fontWeight: 600, color: '#64748b' }}>{text}{el}</label>
  );
  return (
    <div style={{ padding: 12, background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {lbl('Analyte', draft.id
          ? <input style={field} value={v.analyte} disabled />
          : <select style={field} value={v.analyte} onChange={e => {
            const name = e.target.value;
            setV(p => ({ ...p, analyte: name, unit: catalogueUnitFor(name) ?? p.unit }));
          }}>{rangeAnalyteNames().map(n => <option key={n} value={n}>{n}</option>)}</select>)}
        {lbl('Unit', <input style={field} value={v.unit} onChange={set('unit')} disabled={fixedUnit !== null} title={fixedUnit !== null ? 'The unit the app stores this analyte in' : ''} />)}
        {lbl('Sex', <select style={field} value={v.sex} onChange={set('sex')}><option value="any">any</option><option value="male">male</option><option value="female">female</option></select>)}
        {lbl('Effective from', <input style={field} type="date" value={v.effectiveFrom} onChange={set('effectiveFrom')} />)}
        {lbl('Age from (years)', <input style={field} inputMode="decimal" value={v.ageMinYears} onChange={set('ageMinYears')} />)}
        {lbl('Age below (years)', <input style={field} inputMode="decimal" value={v.ageMaxYears} onChange={set('ageMaxYears')} placeholder="no limit" />)}
        {lbl('Lower', <input style={field} inputMode="decimal" value={v.lower} onChange={set('lower')} />)}
        {lbl('Upper', <input style={field} inputMode="decimal" value={v.upper} onChange={set('upper')} />)}
        {lbl('Critical low (below)', <input style={field} inputMode="decimal" value={v.criticalLow} onChange={set('criticalLow')} />)}
        {lbl('Critical high (above)', <input style={field} inputMode="decimal" value={v.criticalHigh} onChange={set('criticalHigh')} />)}
        <div style={{ gridColumn: 'span 2' }}>{lbl('Laboratory (source of the range)', <input style={field} value={v.labSource} onChange={set('labSource')} placeholder="e.g. Laboratory Services Ltd, 2026 handbook" />)}</div>
      </div>
      {problems.length > 0 && <div style={{ fontSize: 11, color: '#b45309', marginTop: 6 }}>{problems.join(' · ')}</div>}
      {err && <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 6 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button type="button" style={{ ...small, background: '#0f172a', color: '#fff', border: 'none' }} disabled={busy || problems.length > 0} onClick={() => void save()}>
          {busy ? 'Saving…' : draft.id ? 'Save change' : 'Save range'}
        </button>
        <button type="button" style={small} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function ReferenceRangesSettings() {
  const data = useReferenceRangeData();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const live = useMemo(() => data.rows
    .filter(r => !r.is_default && !r.retired_at)
    .map(r => ({ row: r, range: rowToReferenceRange(r) }))
    .filter((x): x is { row: StoredRangeRow; range: ReferenceRange } => x.range !== null), [data.rows]);

  async function retire(id: string) {
    if (!window.confirm('Retire this range? Results from now on use the next matching range, or the default.')) return;
    const r = await retireReferenceRange(id);
    if (!r.ok) setErr(r.error);
  }

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted, #64748b)', marginBottom: 12 }}>
        Laboratory reference ranges
      </div>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', fontSize: 12, color: '#475569' }}>
          Used for abnormal and critical flags on laboratory results, the decision layer's "× upper limit of normal" rules and the
          derived scores. Rows marked <i>default</i> are placeholders — replace them with your laboratory's ranges. A practice range
          applies from its effective date to patients of its sex and age; every change is audit-logged.
          {!data.available && data.loaded && (
            <div style={{ marginTop: 6, color: '#b45309' }}>Editing is available after the database update (Migration 96). The built-in defaults are in use.</div>
          )}
          {data.error && <div style={{ marginTop: 6, color: '#b91c1c' }}>{data.error}</div>}
          {err && <div style={{ marginTop: 6, color: '#b91c1c' }}>{err}</div>}
        </div>
        {draft && !draft.id && <RangeForm draft={draft} onCancel={() => setDraft(null)} onSaved={() => setDraft(null)} />}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', textAlign: 'left', fontSize: 11, color: '#64748b' }}>
              <th style={cell}>Analyte</th><th style={cell}>Sex · age</th><th style={cell}>Normal range</th>
              <th style={cell}>Critical</th><th style={cell}>Source · from</th><th style={cell} />
            </tr>
          </thead>
          <tbody>
            {live.map(({ row, range }) => (
              <tr key={row.id}>
                <td style={cell}><b>{range.analyte}</b></td>
                <td style={cell}>{range.sex} · {age(range)}</td>
                <td style={cell}>{rangeText(range) || '—'}</td>
                <td style={cell}>{critical(range) || '—'}</td>
                <td style={cell}>{range.labSource} · {range.effectiveFrom}</td>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                  <button type="button" style={small} disabled={!data.available} onClick={() => setDraft(draftFrom(range, row.id, false))}>Edit</button>{' '}
                  <button type="button" style={small} disabled={!data.available} onClick={() => void retire(row.id)}>Retire</button>
                </td>
              </tr>
            ))}
            {draft?.id && (
              <tr><td colSpan={6} style={{ padding: 0 }}><RangeForm draft={draft} onCancel={() => setDraft(null)} onSaved={() => setDraft(null)} /></td></tr>
            )}
            {DEFAULT_REFERENCE_RANGES.map((range, i) => (
              <tr key={`d${i}`} style={{ color: '#64748b' }}>
                <td style={cell}>{range.analyte} <span style={{ fontSize: 10, color: '#b45309' }}>default</span></td>
                <td style={cell}>{range.sex} · {age(range)}</td>
                <td style={cell}>{rangeText(range) || '—'}</td>
                <td style={cell}>{critical(range) || '—'}</td>
                <td style={cell}>{DEFAULT_RANGE_SOURCE}</td>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                  <button type="button" style={small} disabled={!data.available} onClick={() => setDraft(draftFrom(range, null, true))}>Replace…</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '8px 12px', borderTop: '1px solid #e2e8f0' }}>
          <button
            type="button" style={small} disabled={!data.available}
            onClick={() => setDraft(draftFrom({ ...DEFAULT_REFERENCE_RANGES[0], analyte: 'Ferritin', unit: '', lower: null, upper: null, criticalLow: null, criticalHigh: null }, null, true))}
          >
            Add a range for another analyte…
          </button>
        </div>
      </div>
    </div>
  );
}
