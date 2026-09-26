/**
 * "What's missing" — one compact strip under the patient header in the consultation: the gaps the
 * engines already know about, ranked by impact (safety → decision → score completeness), top 5
 * with "more…". Each item says what is missing, why in one line, and offers one tap: go to the
 * field, or add the test as a suggested order. Nothing is ordered or recorded automatically.
 *
 * Logic: lib/whats-missing-web.ts → @workspace/pane-engine whatsMissing (shared with iOS
 * WhatsMissingRow). Keyboard: Alt+M collapses / expands; every button is focusable; "×"
 * dismisses an item for this session (kept in memory for the encounter, never stored).
 */
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { MissingAction, WhatsMissingItem } from '@workspace/pane-engine';
import { useAppContext } from '@/context/AppContext';
import type { Section } from '@/context/AppContext';
import { buildWhatsMissing } from '@/lib/whats-missing-web';
import type { MissingConsultation } from '@/lib/whats-missing-web';
import { missingConsultationFromApp } from '@/lib/whats-missing-app';
import { isImagingInvestigation, parseImagingToRequest } from '@/lib/imaging-utils';
import { orderTickedSuggestions } from '@/lib/investigation-suggestions';

const C = {
  ink: 'var(--ink, #122320)',
  muted: '#5a706c',
  line: 'rgba(15,95,118,0.16)',
  bg: 'rgba(240,247,246,0.9)',
  accent: '#0f766e',
  safety: '#b91c1c',
  decision: '#a16207',
  score: '#64748b',
};

const TIER_LABEL: Record<WhatsMissingItem['tier'], string> = { safety: 'Safety', decision: 'Decision', score: 'Score' };

/** Where a field action goes (the consultation step that records it). */
const FIELD_SECTION: Record<string, Section> = {
  weight: 'examination', vitals: 'examination', exam: 'examination',
  allergies: 'allergies', pregnancy: 'hpi', history: 'hpi',
  medications: 'medications', supplements: 'medications',
};

const FIELD_LABEL: Record<string, string> = {
  weight: 'Record weight', vitals: 'Record observations', exam: 'Go to examination', allergies: 'Record allergies',
  pregnancy: 'Record pregnancy status', history: 'Ask in history', medications: 'Record last dose', supplements: 'Ask about supplements',
};

function sectionFor(action: MissingAction): Section | null {
  if (action.kind !== 'field' || !action.field) return null;
  if (action.field.startsWith('score:')) return 'scales';
  return FIELD_SECTION[action.field] ?? null;
}

function actionLabel(action: MissingAction): string {
  if (action.kind === 'test') return 'Add test';
  const f = action.field ?? '';
  if (f.startsWith('score:')) return 'Open score';
  return FIELD_LABEL[f] ?? 'Go to field';
}

function btn(primary: boolean, disabled = false): CSSProperties {
  return {
    padding: '2px 8px', borderRadius: 4, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.55 : 1,
    border: primary ? `1px solid ${C.accent}` : '1px solid #94a3b8',
    background: primary ? C.accent : 'transparent', color: primary ? '#fff' : '#334155',
  };
}

export default function WhatsMissingStrip() {
  const app = useAppContext();
  const {
    encounterId, encounterStatus, paneState, setActiveSection,
    orderedInvestigations, setOrderedInvestigations, radiologyRequests, setRadiologyRequests,
  } = app;
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());

  // A new encounter starts with nothing dismissed.
  useEffect(() => { setDismissed(new Set()); setAdded(new Set()); setShowAll(false); }, [encounterId]);

  // Alt+M collapses / expands the strip (keyboard-first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'm' || e.key === 'M' || e.code === 'KeyM')) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const consultation: MissingConsultation = missingConsultationFromApp(app);
  const key = JSON.stringify(consultation);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const result = useMemo(() => buildWhatsMissing(consultation, { paneState }), [key, paneState]);

  const items = result.items.filter(i => !dismissed.has(i.id));
  if (!items.length) return null;
  const locked = encounterStatus === 'closed';
  const shown = showAll ? items : items.slice(0, result.topN);
  const hidden = items.length - shown.length;

  function run(item: WhatsMissingItem, action: MissingAction) {
    if (action.kind === 'test' && action.test) {
      if (locked) return;
      const next = orderTickedSuggestions(
        [{ label: action.test, kind: isImagingInvestigation(action.test) ? 'imaging' : 'lab', urgency: 'routine', suggestedFor: [`${item.what} (what's missing)`], caveat: null }],
        { orderedInvestigations, radiologyRequests },
        s => parseImagingToRequest(s.label, s.urgency, s.suggestedFor[0]),
      );
      if (next.orderedInvestigations.length !== orderedInvestigations.length) setOrderedInvestigations(next.orderedInvestigations);
      if (next.radiologyRequests.length !== radiologyRequests.length) setRadiologyRequests(next.radiologyRequests);
      setAdded(prev => new Set(prev).add(item.id));
      return;
    }
    const section = sectionFor(action);
    if (section) setActiveSection(section);
  }

  return (
    <section
      aria-label="What's missing"
      data-testid="whats-missing-strip"
      style={{ margin: '4px 14px 8px', border: `1px solid ${C.line}`, borderRadius: 8, background: C.bg, fontSize: 12, color: C.ink }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px' }}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          title="Alt+M"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.accent, fontWeight: 800, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}
        >
          {open ? '▾' : '▸'} What's missing <span style={{ fontWeight: 600, color: C.muted, letterSpacing: 0 }}>({items.length})</span>
        </button>
        {!open && (
          <span style={{ color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {items[0].what}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ color: C.muted, fontSize: 10.5 }} title="Ranked: safety first, then what could change the decision, then score completeness. Suggestions only.">
          ranked by impact · suggestions only
        </span>
      </div>
      {open && (
        <ol style={{ listStyle: 'none', margin: 0, padding: '0 10px 6px' }}>
          {shown.map((item, i) => {
            const colour = C[item.tier];
            const primaryDone = item.action.kind === 'test' && added.has(item.id);
            return (
              <li
                key={item.id}
                data-testid="whats-missing-item"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', borderTop: i ? `1px solid ${C.line}` : 'none', minWidth: 0 }}
              >
                <span aria-hidden style={{ width: 6, height: 6, borderRadius: 3, background: colour, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: colour, width: 52, flexShrink: 0 }}>{TIER_LABEL[item.tier]}</span>
                <span style={{ fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{item.what}</span>
                <span
                  title={[item.why, ...item.also].join('\n')}
                  style={{ color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}
                >
                  {item.why}{item.also.length ? ` (+${item.also.length})` : ''}
                </span>
                <button
                  type="button"
                  style={btn(true, primaryDone || (locked && item.action.kind === 'test'))}
                  disabled={primaryDone || (locked && item.action.kind === 'test')}
                  onClick={() => run(item, item.action)}
                  title={item.action.kind === 'test' ? `Adds ${item.action.test} as a suggested order — not ordered until you confirm it` : undefined}
                >
                  {primaryDone ? 'Suggested ✓' : actionLabel(item.action)}
                </button>
                {item.alt && (
                  <button type="button" style={btn(false)} onClick={() => run(item, item.alt!)}>{actionLabel(item.alt)}</button>
                )}
                <button
                  type="button"
                  aria-label={`Dismiss: ${item.what}`}
                  title="Dismiss for this session"
                  onClick={() => setDismissed(prev => new Set(prev).add(item.id))}
                  style={{ ...btn(false), border: 'none', padding: '2px 6px', color: C.muted }}
                >
                  ×
                </button>
              </li>
            );
          })}
          {(hidden > 0 || showAll) && items.length > result.topN && (
            <li style={{ paddingTop: 2 }}>
              <button type="button" style={{ ...btn(false), border: 'none', color: C.accent, padding: 0 }} onClick={() => setShowAll(s => !s)}>
                {showAll ? `Show top ${result.topN}` : `more… (${hidden})`}
              </button>
            </li>
          )}
        </ol>
      )}
    </section>
  );
}
