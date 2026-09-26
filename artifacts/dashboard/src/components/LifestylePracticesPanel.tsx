/**
 * Lifestyle safety prompts and evidence-graded non-drug plan suggestions (Plan step).
 *
 * Rules: @workspace/triage-engine/lifestyle-practices (practice evidence briefing, Sept 2026).
 * Nothing here changes the record by itself: prompts are dismissible, and a plan line is added
 * only when the clinician taps "Add to plan" (CLAUDE.md "Central diagnosis radiation").
 */
import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import {
  appendPlanLine, lifestylePlanSuggestions, lifestyleSafetyPrompts,
  type EvidenceGrade, type LifestylePrompt,
} from '@workspace/triage-engine/lifestyle-practices';
import { lifestyleContextFromWeb } from '@/lib/lifestyle-context-web';

const PROMPT_STYLE: Record<LifestylePrompt['grade'], { bg: string; border: string; fg: string; label: string }> = {
  warning: { bg: '#fef2f2', border: '#fca5a5', fg: '#991b1b', label: 'Safety' },
  caution: { bg: '#fffbeb', border: '#fcd34d', fg: '#92400e', label: 'Caution' },
  info:    { bg: '#f0f9ff', border: '#bae6fd', fg: '#075985', label: 'Note' },
};

const GRADE_STYLE: Record<EvidenceGrade, { bg: string; fg: string }> = {
  'Works':            { bg: '#dcfce7', fg: '#166534' },
  'Modest':           { bg: '#e0f2fe', fg: '#075985' },
  'Mixed':            { bg: '#fef3c7', fg: '#92400e' },
  'No benefit shown': { bg: '#f1f5f9', fg: '#475569' },
};

function useLifestyleContext() {
  const c = useAppContext();
  return useMemo(() => lifestyleContextFromWeb({
    lifestyle: c.lifestyleHistory, age: c.age, weightKg: c.weightKg, heightCm: c.heightCm,
    comorbidities: c.comorbidities, pmhNotes: c.pmhNotes, symptoms: c.symptoms, freeText: c.freeText,
    workingDiagnosis: c.workingDiagnosis, icdCodes: c.icdCodes, medications: c.medications,
    medicationsText: c.medicationsText, visitType: c.visitType, encounterType: c.encounterType,
  }), [c.lifestyleHistory, c.age, c.weightKg, c.heightCm, c.comorbidities, c.pmhNotes, c.symptoms,
    c.freeText, c.workingDiagnosis, c.icdCodes, c.medications, c.medicationsText, c.visitType, c.encounterType]);
}

/** Dismissed ids for the open patient (session only). */
function useDismissed(patientId: string | null) {
  const [state, setState] = useState<{ pid: string | null; ids: Set<string> }>({ pid: patientId, ids: new Set() });
  const ids = state.pid === patientId ? state.ids : new Set<string>();
  const dismiss = (id: string) => setState({ pid: patientId, ids: new Set([...ids, id]) });
  return { ids, dismiss };
}

/** The fasting / sleep safety prompts. Used on the Plan step and in the Social History card. */
export function LifestyleSafetyPrompts() {
  const { patientId } = useAppContext();
  const ctx = useLifestyleContext();
  const { ids, dismiss } = useDismissed(patientId);
  const prompts = lifestyleSafetyPrompts(ctx).filter(p => !ids.has(p.id));
  if (!prompts.length) return null;
  return (
    <div data-testid="lifestyle-safety-prompts" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
      {prompts.map(p => {
        const s = PROMPT_STYLE[p.grade];
        return (
          <div key={p.id} role={p.grade === 'warning' ? 'alert' : undefined}
            style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 6, padding: '7px 10px', fontSize: 12, color: s.fg }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 700, flexShrink: 0 }}>{s.label}:</span>
              <span style={{ flex: 1, lineHeight: 1.5 }}>{p.text}</span>
              <button type="button" className="chip" onClick={() => dismiss(p.id)} aria-label="Dismiss" title="Dismiss for this patient">✕</button>
            </div>
            <div style={{ fontSize: 10.5, opacity: 0.8, marginTop: 3 }}>Source: {p.source}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function LifestylePracticesPanel() {
  const { patientId, plan, setPlan } = useAppContext();
  const ctx = useLifestyleContext();
  const { ids, dismiss } = useDismissed(patientId);
  const suggestions = lifestylePlanSuggestions(ctx).filter(s => !ids.has(s.id));
  const prompts = lifestyleSafetyPrompts(ctx);
  if (!suggestions.length && !prompts.length) return null;

  return (
    <div data-testid="lifestyle-practices-panel" style={{ marginBottom: 12, padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        Lifestyle and non-drug options
      </div>
      <LifestyleSafetyPrompts />
      {suggestions.map(s => {
        const g = GRADE_STYLE[s.evidence];
        const added = plan.includes(s.planLine);
        return (
          <div key={s.id} data-testid={`lifestyle-suggestion-${s.id}`}
            style={{ borderTop: '1px solid #e2e8f0', padding: '7px 0', fontSize: 12, color: '#334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#0f766e', background: '#ccfbf1', border: '1px solid #99f6e4', borderRadius: 999, padding: '1px 8px' }}>
                {s.kind === 'counsel' ? 'Recorded — counsel' : 'Suggested'}
              </span>
              <strong>{s.practice}</strong>
              <span style={{ fontSize: 10.5, fontWeight: 700, background: g.bg, color: g.fg, borderRadius: 4, padding: '1px 6px' }}>
                Evidence: {s.evidence}
              </span>
              {s.alreadyUsed && s.kind === 'suggestion' && (
                <span style={{ fontSize: 10.5, color: '#64748b' }}>already practises</span>
              )}
              <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <button type="button" className="chip" disabled={added}
                  onClick={() => setPlan(appendPlanLine(plan, s.planLine))}
                  title="Adds this line to the end of the plan. Review before signing.">
                  {added ? 'In plan' : 'Add to plan'}
                </button>
                <button type="button" className="chip" onClick={() => dismiss(s.id)} aria-label={`Dismiss ${s.practice}`}>✕</button>
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>{s.reason}. {s.planLine}</div>
            <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>Source: {s.source}</div>
          </div>
        );
      })}
    </div>
  );
}
