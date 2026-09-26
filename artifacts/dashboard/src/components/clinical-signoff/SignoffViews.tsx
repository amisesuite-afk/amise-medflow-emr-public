/**
 * Clinical sign-off page — presentational pieces (no data access, so they render in unit tests).
 * The page (pages/tabs/ClinicalSignoffTab.tsx) owns state, keyboard and saving.
 */
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { DECISION_LABEL, SIGNOFF_DECISIONS } from '@/lib/clinical-signoff/types';
import type {
  CatalogueItem, ItemStatus, ProgressCounts, RuleSetProgress, SignoffDecision, SignoffRecord,
} from '@/lib/clinical-signoff/types';
import { STATUS_FILTERS, STATUS_LABEL, stLuciaDate } from '@/lib/clinical-signoff/status';
import type { StatusFilter } from '@/lib/clinical-signoff/status';
import { KEY_HINTS } from '@/lib/clinical-signoff/keyboard';
import type { ListGroup } from '@/lib/clinical-signoff/view-model';

const C = {
  ink: 'var(--ink, #0f172a)',
  muted: 'var(--muted, #64748b)',
  line: 'var(--border, #e2e8f0)',
  card: 'var(--card, #fff)',
  accent: 'var(--accent, #0f766e)',
};

const STATUS_COLOR: Record<ItemStatus, { fg: string; bg: string }> = {
  pending: { fg: '#475569', bg: '#f1f5f9' },
  approved: { fg: '#166534', bg: '#dcfce7' },
  amended: { fg: '#166534', bg: '#ecfccb' },
  rejected: { fg: '#991b1b', bg: '#fee2e2' },
  deferred: { fg: '#92400e', bg: '#fef3c7' },
  changed: { fg: '#6b21a8', bg: '#f3e8ff' },
};

const chip: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 6px', borderRadius: 4, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' };
const kbd: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 10.5, padding: '0 4px', border: `1px solid ${C.line}`, borderRadius: 3, background: '#f8fafc', color: C.ink };

export function StatusBadge({ status }: { status: ItemStatus }) {
  const c = STATUS_COLOR[status];
  return <span data-status={status} style={{ ...chip, color: c.fg, background: c.bg }}>{STATUS_LABEL[status]}</span>;
}

/** Inline **bold** and `code`; everything else as written (pre-wrap keeps tables and lists legible). */
export function ItemText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|`([^`]+)`/g;
  let last = 0;
  let k = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(m[1] !== undefined ? <strong key={k++}>{m[1]}</strong> : <code key={k++} style={{ fontSize: '0.92em', background: '#f1f5f9', padding: '0 3px', borderRadius: 3 }}>{m[2]}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, lineHeight: 1.5, color: C.ink, overflowWrap: 'anywhere' }}>{parts}</div>;
}

function Bar({ counts }: { counts: ProgressCounts }) {
  const pct = (n: number) => `${counts.total ? (n / counts.total) * 100 : 0}%`;
  return (
    <div aria-hidden style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', background: '#f1f5f9', minWidth: 60 }}>
      <div style={{ width: pct(counts.approved), background: '#16a34a' }} />
      <div style={{ width: pct(counts.changed), background: '#9333ea' }} />
      <div style={{ width: pct(counts.rejected), background: '#dc2626' }} />
      <div style={{ width: pct(counts.deferred), background: '#d97706' }} />
    </div>
  );
}

export function FilterBar({ filter, counts, onFilter }: { filter: StatusFilter; counts: Record<StatusFilter, number>; onFilter: (f: StatusFilter) => void }) {
  return (
    <div role="tablist" aria-label="Status filter" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {STATUS_FILTERS.map((f, i) => (
        <button
          key={f.id}
          role="tab"
          aria-selected={filter === f.id}
          onClick={() => onFilter(f.id)}
          title={`${f.label} (${i + 1})`}
          style={{
            ...chip, cursor: 'pointer', padding: '3px 8px', fontSize: 11.5,
            border: `1px solid ${filter === f.id ? C.accent : C.line}`,
            background: filter === f.id ? C.accent : C.card, color: filter === f.id ? '#fff' : C.ink,
          }}
        >
          {f.label} <span style={{ opacity: 0.75, fontWeight: 600 }}>{counts[f.id]}</span>
        </button>
      ))}
    </div>
  );
}

/** "treatment-decision-support 12/74 approved" rows; click to narrow the list to that rule set. */
export function RuleSetProgressList({ progress, active, onPick }: { progress: RuleSetProgress[]; active: string | null; onPick: (id: string | null) => void }) {
  return (
    <div data-testid="signoff-progress" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '2px 12px' }}>
      {progress.map(p => (
        <button
          key={p.id}
          onClick={() => onPick(active === p.id ? null : p.id)}
          aria-pressed={active === p.id}
          title={p.title}
          style={{
            display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 2, textAlign: 'left', cursor: 'pointer',
            padding: '3px 6px', borderRadius: 4, border: `1px solid ${active === p.id ? C.accent : 'transparent'}`, background: 'transparent', color: C.ink,
          }}
        >
          <span style={{ fontSize: 11.5, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.complete ? '✓ ' : ''}{p.id}
          </span>
          <span style={{ fontSize: 11.5, color: p.complete ? '#166534' : C.muted, fontWeight: 700 }}>{p.approved}/{p.total} approved</span>
          <span style={{ gridColumn: '1 / -1' }}><Bar counts={p} /></span>
        </button>
      ))}
    </div>
  );
}

export function ItemList({ groups, selectedId, onSelect }: { groups: ListGroup[]; selectedId: string | null; onSelect: (id: string) => void }) {
  if (!groups.length) return <div style={{ padding: 16, fontSize: 12.5, color: C.muted }}>No items match this filter.</div>;
  return (
    <div role="listbox" aria-label="Sign-off items" data-testid="signoff-list">
      {groups.map(g => (
        <div key={g.key}>
          <div style={{ position: 'sticky', top: 0, zIndex: 1, background: '#f8fafc', borderBottom: `1px solid ${C.line}`, padding: '5px 8px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 2 }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={g.subtitle ?? g.title}>{g.title}</span>
            <span style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>{g.counts.approved}/{g.counts.total}</span>
            <span style={{ gridColumn: '1 / -1' }}><Bar counts={g.counts} /></span>
          </div>
          {g.rows.map(({ item, status }) => {
            const sel = item.id === selectedId;
            return (
              <div
                key={`${g.key}|${item.id}`}
                role="option"
                aria-selected={sel}
                data-signoff-item={item.id}
                onClick={() => onSelect(item.id)}
                style={{
                  display: 'grid', gridTemplateColumns: '64px 1fr auto', gap: 6, alignItems: 'baseline', cursor: 'pointer',
                  padding: '4px 8px', borderBottom: '1px solid #f1f5f9', fontSize: 12,
                  background: sel ? '#e0f2fe' : 'transparent', boxShadow: sel ? `inset 2px 0 0 ${C.accent}` : undefined,
                }}
              >
                <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11, color: C.muted }}>{item.number}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.ink }} title={item.title}>{item.title}</span>
                <StatusBadge status={status} />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function DecisionHistory({ history, currentHash }: { history: SignoffRecord[]; currentHash: string }) {
  if (!history.length) return <div style={{ fontSize: 12, color: C.muted }}>No decision recorded yet.</div>;
  return (
    <ol data-testid="signoff-history" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4 }}>
      {history.map((r, i) => (
        <li key={r.id ?? `${r.decidedAt}-${i}`} style={{ fontSize: 12, color: C.ink }}>
          <strong>{DECISION_LABEL[r.decision]}</strong> — {r.reviewerName} ({r.reviewerRole}), {stLuciaDate(r.decidedAt)}
          {r.itemHash !== currentHash && <span style={{ ...chip, marginLeft: 6, color: STATUS_COLOR.changed.fg, background: STATUS_COLOR.changed.bg }}>earlier wording</span>}
          {i === 0 && <span style={{ fontSize: 11, color: C.muted }}> · current</span>}
          {r.amendment && <div style={{ color: C.ink, marginTop: 2 }}>Amendment: {r.amendment}</div>}
          {r.comment && <div style={{ color: C.muted, marginTop: 2 }}>Comment: {r.comment}</div>}
        </li>
      ))}
    </ol>
  );
}

export interface DecisionDraft {
  decision: SignoffDecision;
  amendment: string;
  comment: string;
  attested: boolean;
  reviewerName: string;
}

export interface DecisionFormRefs {
  attest?: RefObject<HTMLInputElement | null>;
  amendment?: RefObject<HTMLTextAreaElement | null>;
  comment?: RefObject<HTMLTextAreaElement | null>;
}

export function DecisionForm({
  draft, onChange, onSubmit, canRecord, readOnlyReason, saving, message, refs = {},
}: {
  draft: DecisionDraft;
  onChange: (d: DecisionDraft) => void;
  onSubmit: () => void;
  canRecord: boolean;
  readOnlyReason: string | null;
  saving: boolean;
  message: { tone: 'ok' | 'warn' | 'error'; text: string } | null;
  refs?: DecisionFormRefs;
}) {
  const set = (p: Partial<DecisionDraft>) => onChange({ ...draft, ...p });
  const field: CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: 12.5, padding: '5px 7px', border: `1px solid ${C.line}`, borderRadius: 4, fontFamily: 'inherit', color: C.ink, background: '#fff' };
  const disabled = !canRecord || saving;
  return (
    <form
      data-testid="signoff-decision-form"
      onSubmit={e => { e.preventDefault(); onSubmit(); }}
      style={{ display: 'grid', gap: 8, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}
    >
      {readOnlyReason && <div role="note" style={{ fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 4, padding: '5px 8px' }}>{readOnlyReason}</div>}
      <div role="radiogroup" aria-label="Decision" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {SIGNOFF_DECISIONS.map(d => {
          const key = { approved: 'a', approved_with_amendment: 'm', rejected: 'r', deferred: 'd' }[d];
          const on = draft.decision === d;
          return (
            <label key={d} style={{ ...chip, cursor: disabled ? 'default' : 'pointer', padding: '4px 8px', fontSize: 12, border: `1px solid ${on ? C.accent : C.line}`, background: on ? '#ecfeff' : C.card, color: C.ink }}>
              <input type="radio" name="signoff-decision" value={d} checked={on} disabled={disabled} onChange={() => set({ decision: d })} style={{ margin: 0 }} />
              {DECISION_LABEL[d]} <span style={kbd}>{key}</span>
            </label>
          );
        })}
      </div>
      {draft.decision === 'approved_with_amendment' && (
        <label style={{ display: 'grid', gap: 3, fontSize: 11.5, fontWeight: 700, color: C.muted }}>
          Amendment (required): what should change
          <textarea ref={refs.amendment} value={draft.amendment} disabled={disabled} rows={3} maxLength={4000} onChange={e => set({ amendment: e.target.value })} style={field} />
        </label>
      )}
      <label style={{ display: 'grid', gap: 3, fontSize: 11.5, fontWeight: 700, color: C.muted }}>
        Comment (optional{draft.decision === 'rejected' || draft.decision === 'deferred' ? ' — the reason helps whoever picks this up' : ''})
        <textarea ref={refs.comment} value={draft.comment} disabled={disabled} rows={2} maxLength={2000} onChange={e => set({ comment: e.target.value })} style={field} />
      </label>
      <label style={{ display: 'grid', gap: 3, fontSize: 11.5, fontWeight: 700, color: C.muted }}>
        Reviewer (name as it should appear in the registry)
        <input type="text" value={draft.reviewerName} disabled={disabled} maxLength={200} onChange={e => set({ reviewerName: e.target.value })} style={field} />
      </label>
      <label style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12.5, color: C.ink }}>
        <input ref={refs.attest} type="checkbox" checked={draft.attested} disabled={disabled} onChange={e => set({ attested: e.target.checked })} style={{ marginTop: 2 }} />
        <span>I have reviewed this item against the cited source.</span>
      </label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="submit"
          disabled={disabled || !draft.attested}
          style={{ padding: '6px 12px', borderRadius: 4, fontSize: 12, fontWeight: 800, cursor: disabled || !draft.attested ? 'not-allowed' : 'pointer', border: `1px solid ${C.accent}`, background: disabled || !draft.attested ? '#e2e8f0' : C.accent, color: disabled || !draft.attested ? C.muted : '#fff' }}
        >
          {saving ? 'Recording…' : `Record: ${DECISION_LABEL[draft.decision]}`}
        </button>
        <span style={kbd}>Ctrl+Enter</span>
        {message && (
          <span role="status" style={{ fontSize: 12, fontWeight: 600, color: message.tone === 'ok' ? '#166534' : message.tone === 'warn' ? '#92400e' : '#991b1b' }}>{message.text}</span>
        )}
      </div>
    </form>
  );
}

export function ItemDetail({
  item, status, history, repoUrl, children,
}: { item: CatalogueItem; status: ItemStatus; history: SignoffRecord[]; repoUrl: string; children?: ReactNode }) {
  const href = `${repoUrl}${item.doc}${item.anchor ? `#${item.anchor}` : ''}`;
  return (
    <div data-testid="signoff-detail" style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <code style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{item.id}</code>
        <StatusBadge status={status} />
        <a href={href} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: C.accent }}>{item.doc.split('/').pop()} ↗</a>
        <span style={{ fontSize: 11, color: C.muted, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }} title="Wording hash: a decision counts for this wording only">#{item.hash}</span>
      </div>
      {item.group && <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 700 }}>{item.group}</div>}
      <ItemText text={item.text} />
      <div style={{ fontSize: 11.5, color: C.muted }}>
        Rule sets: {item.ruleSetIds.length ? item.ruleSetIds.map(id => <code key={id} style={{ marginRight: 6 }}>{id}</code>) : 'none identified (recorded against the change log only)'}
      </div>
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 800, color: C.muted, marginBottom: 4 }}>Decision history</div>
        <DecisionHistory history={history} currentHash={item.hash} />
      </div>
      {children}
    </div>
  );
}

export function KeyHints() {
  return (
    <div aria-label="Keyboard shortcuts" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11, color: C.muted }}>
      {KEY_HINTS.map(([k, v]) => <span key={k}><span style={kbd}>{k}</span> {v}</span>)}
    </div>
  );
}
