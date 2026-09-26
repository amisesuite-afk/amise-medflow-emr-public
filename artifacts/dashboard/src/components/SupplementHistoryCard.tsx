/**
 * "Herbs, teas, bush remedies & supplements" — the mandatory question and what the patient takes.
 * Searchable from the supplement catalogue plus free text. Recorded entries are screened by the
 * drug-interaction alerts like drugs and feed the perioperative alerts and "ask about" prompts.
 * Patient-level: shared with iOS through patients.pathway_data_json (lib/supplement-store.ts).
 * Nothing here stops or prescribes anything — stop times are shown to the clinician, who decides.
 * Read-only for front desk: pathway_data_json is clinician-only under Migration 89 (roles.ts).
 */
import { useId, useMemo, useState, type CSSProperties } from 'react';
import CollapsibleCard from '@/components/CollapsibleCard';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { PATHWAY_DATA_READ_ONLY_NOTE, canRecordPathwayData } from '@/lib/roles';
import {
  SUPPLEMENT_DISCLOSURE_RATIONALE, SUPPLEMENT_SECTION_TITLE, isoSeconds, matchSupplements,
  perioperativeAlertText, recordedSupplementItems, searchSupplements, supplementById,
  supplementNoteLine, type SupplementHistory, type SupplementStatus,
} from '@/lib/supplement-catalogue';

const STATUS_LABEL: Record<SupplementStatus, string> = {
  not_asked: 'Not asked', none: 'None', taking: 'Takes some',
};

function newId(): string {
  try { return crypto.randomUUID(); } catch { return `s-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
}

export default function SupplementHistoryCard({ showPerioperativeAlerts = false }: { showPerioperativeAlerts?: boolean }) {
  const { supplementHistory: h, setSupplementHistory } = useAppContext();
  const { profile } = useAuth();
  const readOnly = !canRecordPathwayData(profile?.role);
  const uid = useId();
  const [query, setQuery] = useState('');
  const [details, setDetails] = useState('');
  const matches = useMemo(() => (query.trim() ? searchSupplements(query).slice(0, 6) : []), [query]);
  const recorded = useMemo(() => recordedSupplementItems(h), [h]);
  const status: SupplementStatus = h.entries.length > 0 ? 'taking' : h.status;

  function save(next: SupplementHistory) { if (!readOnly) setSupplementHistory(next); }

  function setStatus(s: SupplementStatus) {
    if (s !== 'taking' && h.entries.length > 0) return;   // "None" never discards recorded entries
    save({ ...h, status: s, askedAt: s === 'not_asked' ? null : isoSeconds() });
  }

  function add(name: string, catalogueId: string | null) {
    const clean = name.trim();
    if (!clean) return;
    save({
      status: 'taking', askedAt: isoSeconds(),
      entries: [...h.entries, { id: newId(), catalogueId, name: clean, details: details.trim() }],
    });
    setQuery('');
    setDetails('');
  }

  function remove(id: string) {
    save({ ...h, entries: h.entries.filter(e => e.id !== id) });
  }

  const pill = (active: boolean): CSSProperties => ({
    padding: '5px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
    border: active ? '1px solid #0f766e' : '1px solid #cbd5e1',
    background: active ? '#ccfbf1' : '#fff', color: active ? '#0f766e' : '#334155', fontWeight: active ? 700 : 500,
  });

  return (
    <CollapsibleCard title={SUPPLEMENT_SECTION_TITLE} badge={h.entries.length || undefined}
      badgeVariant={status === 'not_asked' ? 'warn' : 'default'}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{SUPPLEMENT_DISCLOSURE_RATIONALE}</div>
      {readOnly && (
        <div data-testid="supplements-read-only" style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 8 }}>
          {PATHWAY_DATA_READ_ONLY_NOTE}
        </div>
      )}
      <div role="radiogroup" aria-label="Asked about herbs, teas, bush remedies and supplements" style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {(['not_asked', 'none', 'taking'] as SupplementStatus[]).map(s => (
          <button key={s} type="button" role="radio" aria-checked={status === s} style={pill(status === s)}
            onClick={() => setStatus(s)} disabled={readOnly || (s !== 'taking' && h.entries.length > 0 && s !== status)}>
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {status === 'not_asked' && (
        <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309', marginBottom: 8 }}>
          Not asked yet — mandatory question.
        </div>
      )}

      {h.entries.map(e => {
        const item = supplementById(e.catalogueId) ?? matchSupplements(e.name)[0];
        return (
          <div key={e.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{e.details ? `${e.name} — ${e.details}` : e.name}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {item ? item.concern : 'Not in the catalogue — identify the plant or product.'}
              </div>
            </div>
            {!readOnly && (
              <button type="button" onClick={() => remove(e.id)} aria-label={`Remove ${e.name}`}
                style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>✕</button>
            )}
          </div>
        );
      })}

      {!readOnly && <>
      <div className="fld" style={{ marginTop: 8 }}>
        <label htmlFor={`${uid}-search`}>Search or type (garlic, turmeric, cerasee tea…)</label>
        <input id={`${uid}-search`} type="text" value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(query, matchSupplements(query)[0]?.id ?? null); } }} />
      </div>
      <div className="fld">
        <label htmlFor={`${uid}-details`}>Dose / how often (optional)</label>
        <input id={`${uid}-details`} type="text" value={details} onChange={e => setDetails(e.target.value)} />
      </div>
      {query.trim() && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          {matches.map(item => (
            <button key={item.id} type="button" onClick={() => add(item.label, item.id)}
              style={{ textAlign: 'left', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{item.label}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{item.concern}</div>
            </button>
          ))}
          <button type="button" onClick={() => add(query, matchSupplements(query)[0]?.id ?? null)}
            style={{ textAlign: 'left', padding: '6px 10px', border: '1px dashed #0f766e', borderRadius: 6, background: '#fff', color: '#0f766e', cursor: 'pointer', fontSize: 12 }}>
            + Add “{query.trim()}” as written
          </button>
        </div>
      )}
      </>}

      {showPerioperativeAlerts && recorded.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {recorded.map(item => (
            <div key={item.id} style={{ fontSize: 12, color: '#9a3412', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 6, padding: '6px 10px', marginBottom: 4 }}>
              {perioperativeAlertText(item)}
            </div>
          ))}
          <div style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic' }}>
            Decision support only — the clinician decides whether anything is stopped.
          </div>
        </div>
      )}
      <div style={{ fontSize: 11, color: '#475569', marginTop: 6 }}>Note line: {supplementNoteLine(h)}</div>
    </CollapsibleCard>
  );
}
