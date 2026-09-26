import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAuth } from '@/context/AuthContext';
import { roleIn } from '@/lib/roles';
import {
  buildBundle, bundleMarkdown, historyFor, ruleSetProgress, statusMap, stLuciaDate,
} from '@/lib/clinical-signoff/status';
import type { StatusFilter } from '@/lib/clinical-signoff/status';
import { DECISION_LABEL } from '@/lib/clinical-signoff/types';
import type { ReviewerRole, SignoffCatalogue, SignoffDecision } from '@/lib/clinical-signoff/types';
import { SAVE_STATUS_TEXT, UNAVAILABLE_TEXT, loadSignoffs, saveSignoff } from '@/lib/clinical-signoff/db';
import type { SignoffData } from '@/lib/clinical-signoff/db';
import { signoffKeyAction } from '@/lib/clinical-signoff/keyboard';
import { buildListGroups, filterCounts, flatItemIds, moveSelection } from '@/lib/clinical-signoff/view-model';
import type { Grouping } from '@/lib/clinical-signoff/view-model';
import {
  DecisionForm, FilterBar, ItemDetail, ItemList, KeyHints, RuleSetProgressList,
} from '@/components/clinical-signoff/SignoffViews';
import type { DecisionDraft } from '@/components/clinical-signoff/SignoffViews';

const wrap: CSSProperties = { padding: '12px 16px', color: 'var(--ink, #0f172a)', display: 'grid', gap: 10 };
const panel: CSSProperties = { background: 'var(--card, #fff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 8 };
const btn: CSSProperties = { padding: '5px 10px', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--border, #cbd5e1)', background: '#fff', color: '#334155' };

function newClientRef(): string {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `web:${r}`.slice(0, 80);
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

function inTextField(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') return !['checkbox', 'radio', 'button', 'submit'].includes((el as HTMLInputElement).type);
  return false;
}

/**
 * Clinical sign-off (Insights → Clinical sign-off; doctor / admin). Every "Needs sign-off" item
 * from the change logs and SURGEON-DECISIONS, with its decision history; doctor and admin record
 * approve / amend / reject / defer with an attestation. Decisions are append-only rows of
 * clinical_signoffs (Migration 95). "Export approved decisions" hands a bundle to
 * `signoff:apply`; this page never changes the repository or any engine.
 */
export default function ClinicalSignoffTab() {
  const { profile, session, loading: authLoading } = useAuth();
  const [catalogue, setCatalogue] = useState<SignoffCatalogue | null>(null);
  const [data, setData] = useState<SignoffData | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [grouping, setGrouping] = useState<Grouping>('source');
  const [ruleSet, setRuleSet] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DecisionDraft>({ decision: 'approved', amendment: '', comment: '', attested: false, reviewerName: '' });
  const [clientRef, setClientRef] = useState(newClientRef);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);
  const [showProgress, setShowProgress] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<SignoffDecision | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const attestRef = useRef<HTMLInputElement | null>(null);
  const amendRef = useRef<HTMLTextAreaElement | null>(null);
  const commentRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let live = true;
    void import('@/data/clinical-signoff-catalogue.json').then(m => { if (live) setCatalogue(m.default as unknown as SignoffCatalogue); });
    void loadSignoffs().then(d => { if (live) setData(d); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (profile?.full_name && !draft.reviewerName) setDraft(d => ({ ...d, reviewerName: profile.full_name ?? '' }));
  }, [profile?.full_name]); // eslint-disable-line react-hooks/exhaustive-deps

  const role = profile?.role;
  const reviewerRole: ReviewerRole | null = roleIn(role, 'doctor', 'admin') ? (role as ReviewerRole) : null;
  const userId = session?.user?.id ?? profile?.id ?? null;
  const records = useMemo(() => data?.records ?? [], [data]);
  const statuses = useMemo(() => (catalogue ? statusMap(catalogue, records) : new Map()), [catalogue, records]);
  const progress = useMemo(() => (catalogue ? ruleSetProgress(catalogue, statuses) : []), [catalogue, statuses]);
  const groups = useMemo(
    () => (catalogue ? buildListGroups(catalogue, statuses, { grouping, filter, query, ruleSet }) : []),
    [catalogue, statuses, grouping, filter, query, ruleSet]);
  const ids = useMemo(() => flatItemIds(groups), [groups]);
  const counts = useMemo(() => (catalogue ? filterCounts(catalogue, statuses) : { all: 0, pending: 0, approved: 0, changed: 0, rejected: 0, deferred: 0 }), [catalogue, statuses]);
  const selected = catalogue?.items.find(i => i.id === selectedId) ?? null;

  // Keep a visible selection.
  useEffect(() => {
    if (!ids.length) return;
    if (!selectedId || !ids.includes(selectedId)) setSelectedId(ids[0]);
  }, [ids, selectedId]);

  // New item → fresh form (the reviewer's name stays).
  useEffect(() => {
    setDraft(d => ({ ...d, decision: 'approved', amendment: '', comment: '', attested: false }));
    setClientRef(newClientRef());
    setMessage(null);
    if (selectedId) {
      const el = document.querySelector(`[data-signoff-item="${CSS.escape(selectedId)}"]`);
      (el as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [selectedId]);

  useEffect(() => {
    if (!pendingFocus) return;
    const target = pendingFocus === 'approved' ? attestRef.current
      : pendingFocus === 'approved_with_amendment' ? amendRef.current : commentRef.current;
    target?.focus();
    setPendingFocus(null);
  }, [pendingFocus, draft.decision]);

  const available = data?.available ?? false;
  const canRecord = !!(available && reviewerRole && userId && selected);
  const readOnlyReason = !data ? null
    : !available ? UNAVAILABLE_TEXT
    : !reviewerRole ? 'Read only: decisions are recorded by doctor or admin accounts.'
    : null;

  const submit = useCallback(async () => {
    if (!catalogue || !selected || !reviewerRole || !userId || saving) return;
    setSaving(true);
    const res = await saveSignoff({
      item: selected, catalogueHash: catalogue.catalogueHash, decision: draft.decision, amendment: draft.amendment,
      comment: draft.comment, attested: draft.attested, reviewerName: draft.reviewerName, reviewerRole, userId, clientRef,
    });
    setSaving(false);
    if (res.status === 'saved' && res.record) {
      const rec = res.record;
      setData(d => (d ? { ...d, records: [...d.records, rec] } : d));
      setFlash(`${DECISION_LABEL[rec.decision]}: ${rec.itemId} recorded.`);
      if (!res.audited) {
        // Stay on the item so the warning is seen.
        setMessage({ tone: 'warn', text: `${SAVE_STATUS_TEXT.saved} The audit-log entry could not be written; tell the practice admin.` });
        return;
      }
      const next = moveSelection(ids, selected.id, 1);
      if (next && next !== selected.id) setSelectedId(next);
      else setMessage({ tone: 'ok', text: SAVE_STATUS_TEXT.saved });
      return;
    }
    if (res.status === 'duplicate') void loadSignoffs().then(setData);
    if (res.status === 'unavailable') setData(d => (d ? { ...d, available: false } : d));
    setMessage({ tone: 'error', text: res.status === 'invalid' && res.error ? res.error : SAVE_STATUS_TEXT[res.status] });
  }, [catalogue, selected, reviewerRole, userId, saving, draft, clientRef, ids]);

  const exportBundle = useCallback(() => {
    if (!catalogue || !data) return;
    const bundle = buildBundle(catalogue, data.records, {
      userId, name: draft.reviewerName || profile?.full_name || profile?.email || 'unknown', role: role ?? null,
    });
    const stem = `clinical-signoff-${stLuciaDate(bundle.exportedAt)}`;
    download(`${stem}.json`, `${JSON.stringify(bundle, null, 2)}\n`, 'application/json');
    download(`${stem}.md`, `${bundleMarkdown(bundle, catalogue)}\n`, 'text/markdown');
  }, [catalogue, data, userId, draft.reviewerName, profile, role]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = signoffKeyAction({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, inField: inTextField(e.target) });
      if (!action) return;
      e.preventDefault();
      switch (action.type) {
        case 'move': setSelectedId(s => moveSelection(ids, s, action.delta)); break;
        case 'decide':
          if (!canRecord) break;
          setDraft(d => ({ ...d, decision: action.decision }));
          setPendingFocus(action.decision);
          break;
        case 'search': searchRef.current?.focus(); break;
        case 'filter': setFilter(action.filter); break;
        case 'toggle-group': setGrouping(g => (g === 'source' ? 'ruleSet' : 'source')); break;
        case 'export': exportBundle(); break;
        case 'submit': if (canRecord && draft.attested) void submit(); break;
        case 'blur': (e.target as HTMLElement | null)?.blur?.(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ids, canRecord, draft.attested, submit, exportBundle]);

  if (authLoading || !catalogue || !data) {
    return <div style={wrap}><div style={{ fontSize: 12.5, color: 'var(--muted, #64748b)' }}>Loading the sign-off catalogue…</div></div>;
  }

  const total = catalogue.items.length;
  const complete = progress.filter(p => p.complete).length;

  return (
    <div style={wrap} data-testid="clinical-signoff">
      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>Clinical sign-off</h2>
        <span style={{ fontSize: 12, color: 'var(--muted, #64748b)' }}>
          {counts.approved}/{total} items approved · {complete}/{progress.length} rule sets complete · catalogue {catalogue.catalogueHash}
        </span>
        <span style={{ flex: 1 }} />
        {flash && <span role="status" style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>{flash}</span>}
        <button style={btn} onClick={exportBundle} title="JSON + Markdown bundle for signoff:apply (e)">Export approved decisions</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted, #64748b)' }}>
        Nothing listed under "Needs sign-off" is approved until it is recorded here. A decision counts for the wording shown; if the
        change log is edited later the item returns as "changed since approval". Approved rule sets reach the registry only when a
        developer runs <code>signoff:apply</code> on the exported bundle.
      </div>
      {(readOnlyReason || data.error) && (
        <div role="note" style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, padding: '6px 10px' }}>
          {data.error ? `Decisions could not be loaded: ${data.error}` : readOnlyReason}
        </div>
      )}

      <div style={{ ...panel, padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: showProgress ? 6 : 0 }}>
          <button style={{ ...btn, padding: '2px 8px' }} onClick={() => setShowProgress(s => !s)} aria-expanded={showProgress}>
            {showProgress ? '▾' : '▸'} Progress by rule set
          </button>
          {ruleSet && <button style={{ ...btn, padding: '2px 8px' }} onClick={() => setRuleSet(null)}>Showing {ruleSet} only — clear</button>}
        </div>
        {showProgress && <RuleSetProgressList progress={progress} active={ruleSet} onPick={setRuleSet} />}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <FilterBar filter={filter} counts={counts} onFilter={setFilter} />
        <span style={{ flex: 1 }} />
        <div role="group" aria-label="Group by" style={{ display: 'flex', gap: 2 }}>
          {(['source', 'ruleSet'] as const).map(g => (
            <button key={g} style={{ ...btn, padding: '3px 8px', background: grouping === g ? '#e0f2fe' : '#fff' }} aria-pressed={grouping === g} onClick={() => setGrouping(g)}>
              {g === 'source' ? 'By change log' : 'By rule set'}
            </button>
          ))}
        </div>
        <input
          ref={searchRef}
          type="search"
          placeholder="Search items (/)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--border, #cbd5e1)', borderRadius: 4, width: 220 }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 2fr) minmax(360px, 3fr)', gap: 10, alignItems: 'start' }}>
        <div style={{ ...panel, maxHeight: 'calc(100vh - 290px)', minHeight: 240, overflowY: 'auto' }}>
          <ItemList groups={groups} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div style={{ ...panel, padding: 12, maxHeight: 'calc(100vh - 290px)', minHeight: 240, overflowY: 'auto' }}>
          {selected ? (
            <ItemDetail item={selected} status={statuses.get(selected.id) ?? 'pending'} history={historyFor(records, selected.id)} repoUrl={catalogue.repoUrl}>
              <DecisionForm
                draft={draft}
                onChange={setDraft}
                onSubmit={() => void submit()}
                canRecord={canRecord}
                readOnlyReason={null}
                saving={saving}
                message={message}
                refs={{ attest: attestRef, amendment: amendRef, comment: commentRef }}
              />
            </ItemDetail>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--muted, #64748b)' }}>Select an item.</div>
          )}
        </div>
      </div>
      <KeyHints />
    </div>
  );
}
