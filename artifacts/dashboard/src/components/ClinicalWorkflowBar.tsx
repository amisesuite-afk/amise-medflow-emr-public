import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAppContext, type Section } from '@/context/AppContext';
import { getMatrix } from '@/lib/cc-matrices';
import { computeSectionDone, SECTION_LABELS } from '@/lib/workflow-completion';
import { countedSteps, groupByPhase, phaseDone, workflowSteps } from '@/lib/consult-steps';


const SECTION_ICONS: Partial<Record<Section, string>> = {
  triage: '⚡', hpi: '📝', pmh: '🏥', surgical: '⚕️',
  medications: '💊', allergies: '⚠️', family_hx: '👨‍👩‍👧', toxic: '🚬',
  ros: '📋', examination: '🩺', wounds: '🩹',
  investigations: '🧪', blood_gas: '💨', radiology: '📡', attachments: '📎',
  assessment: '🎯', scales: '📊', plan: '📄', procedures: '✂️',
  prescriptions: '💊', dosing: '💉', fluid_nutrition: '💧',
  referring_providers: '↗', progress: '📒', monitoring: '📊', tasks: '✓',
};

const LABEL = (s: Section) => (s === 'scales' ? 'Scores' : SECTION_LABELS[s] ?? s);

interface Props {
  /** Sections this user may open (the consultation tab list); others are not shown as pills. */
  allowed?: ReadonlySet<Section>;
  /** Left of the header row (← previous step). */
  leading?: ReactNode;
  /** Right of the header row (Tools, Dictate, Ambient, Next, Summary). */
  actions?: ReactNode;
}

/**
 * The one consultation navigation bar for a chief-complaint pathway (UX review M6):
 * header row = pathway name, n/N done, progress, and the actions that used to be a separate row;
 * pill row = the steps, grouped under their phase (History · Exam · Investigations · Assessment ·
 * Plan) — the separate phase breadcrumb is gone. Scores is a step (it used to disappear once a
 * complaint was chosen); Notes / Monitor / Tasks are in the Tools menu. Sticky, solid background,
 * ≥44 px pills on touch screens, arrows when steps are scrolled out of view.
 */
export default function ClinicalWorkflowBar({ allowed, leading, actions }: Props) {
  const ctx = useAppContext();
  const { activeCcKey, activeSection, setActiveSection } = ctx;

  // ✓ only for content the clinician recorded — suggestions never count (lib/workflow-completion.ts).
  // Computed before the early return so the hook order is stable.
  const done = useMemo(() => computeSectionDone(ctx), [ctx]);

  const matrix = activeCcKey ? getMatrix(activeCcKey) : undefined;
  const steps = useMemo(
    () => (matrix ? workflowSteps(matrix.sections).filter(s => !allowed || allowed.has(s)) : []),
    [matrix, allowed],
  );

  const rowRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const sync = () => {
      setCanLeft(row.scrollLeft > 1);
      setCanRight(row.scrollLeft + row.clientWidth < row.scrollWidth - 1);
    };
    sync();
    row.addEventListener('scroll', sync, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
    ro?.observe(row);
    return () => { row.removeEventListener('scroll', sync); ro?.disconnect(); };
  }, [steps]);
  // Keep the active step in view.
  useEffect(() => {
    const row = rowRef.current;
    const el = row?.querySelector<HTMLElement>(`[data-step="${activeSection}"]`);
    if (!row || !el) return;
    const target = el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2;
    row.scrollLeft = Math.max(0, Math.min(target, row.scrollWidth - row.clientWidth));
  }, [activeSection, steps]);

  if (!matrix) {
    // No pathway template: keep the actions (they must never disappear with the bar).
    return (leading || actions) ? (
      <div className="wf-bar">
        <div className="wf-head">{leading}<div className="wf-actions">{actions}</div></div>
      </div>
    ) : null;
  }

  const counted = countedSteps(steps);
  const completedCount = counted.filter(s => done[s]).length;
  const totalCount = counted.length;
  const groups = groupByPhase(steps);
  const hiddenRight = canRight ? steps.filter(s => {
    const row = rowRef.current;
    const el = row?.querySelector<HTMLElement>(`[data-step="${s}"]`);
    return !!row && !!el && el.offsetLeft + el.offsetWidth > row.scrollLeft + row.clientWidth;
  }).length : 0;

  return (
    <div className="wf-bar" data-testid="clinical-workflow-bar">
      {/* Header row: pathway, progress, actions */}
      <div className="wf-head">
        {leading}
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#475569' }}>
          {matrix.icon} {matrix.name}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: completedCount === totalCount ? '#15803d' : '#0b8278',
          background: completedCount === totalCount ? '#f0fdf4' : '#f0fdfa',
          padding: '1px 8px', borderRadius: 10,
        }}>
          {completedCount}/{totalCount} documented
        </span>
        <div aria-hidden="true" style={{ flex: '1 1 60px', maxWidth: 120, height: 3, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden', minWidth: 0 }}>
          <div style={{
            height: '100%',
            width: `${totalCount ? Math.round((completedCount / totalCount) * 100) : 0}%`,
            background: completedCount === totalCount ? '#16a34a' : '#0b8278',
            borderRadius: 4, transition: 'width .3s ease',
          }} />
        </div>
        {/* The actions wrap together, right-aligned, when the row is too narrow (iPad portrait). */}
        <div className="wf-actions">{actions}</div>
      </div>

      {/* Step pills, grouped by phase */}
      <div className="wf-steps-wrap">
        {canLeft && (
          <button type="button" className="wf-scroll wf-scroll--left" aria-label="Show earlier steps"
            onClick={() => { const r = rowRef.current; if (r) r.scrollLeft -= 200; }}>‹</button>
        )}
        <div ref={rowRef} className="wf-steps" role="tablist" aria-label="Consultation steps">
          {groups.map(group => {
            const groupDone = phaseDone(group, done);
            return (
              <div key={`${group.phase}-${group.steps[0]}`} className="wf-group" role="group" aria-label={group.label}>
                <span className="wf-phase" aria-hidden="true">
                  {groupDone ? '✓ ' : ''}{group.label}
                </span>
                {group.steps.map(section => {
                  const isActive = section === activeSection;
                  const isDone = !!done[section];
                  const idx = steps.indexOf(section);
                  return (
                    <button
                      key={section}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      data-step={section}
                      onClick={() => setActiveSection(section)}
                      title={LABEL(section)}
                      className={`wf-pill${isActive ? ' wf-pill--active' : isDone ? ' wf-pill--done' : ''}`}
                    >
                      {isDone && !isActive && <span style={{ fontSize: 10, lineHeight: 1 }}>✓</span>}
                      {!isDone && !isActive && <span className="wf-pill__n">{idx + 1}</span>}
                      {isActive && <span style={{ fontSize: 11, lineHeight: 1 }}>{SECTION_ICONS[section] ?? '●'}</span>}
                      <span>{LABEL(section)}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        {canRight && (
          <button type="button" className="wf-scroll wf-scroll--right" aria-label={`Show ${hiddenRight || 'more'} more steps`}
            onClick={() => { const r = rowRef.current; if (r) r.scrollLeft += 200; }}>
            {hiddenRight > 0 ? `+${hiddenRight} ›` : '›'}
          </button>
        )}
      </div>
    </div>
  );
}
