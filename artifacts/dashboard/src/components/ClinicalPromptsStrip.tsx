import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { computeClinicalPrompts, type ClinicalPrompt } from '@/lib/clinical-inference';

interface CCEntry { complaint: string; answers: Record<string, string> }

const TYPE_COLORS: Record<ClinicalPrompt['type'], { border: string; bg: string; text: string }> = {
  safety:       { border: '#dc2626', bg: 'rgba(127,29,29,0.25)',  text: '#fca5a5' },
  investigation:{ border: '#d97706', bg: 'rgba(66,32,6,0.3)',    text: '#fbbf24' },
  preventative: { border: '#3b82f6', bg: 'rgba(30,58,138,0.25)', text: '#93c5fd' },
};

const URGENCY_BADGE: Record<ClinicalPrompt['urgency'], { bg: string; text: string; label: string }> = {
  urgent:   { bg: '#7f1d1d', text: '#fca5a5', label: 'URGENT'   },
  priority: { bg: '#431407', text: '#fb923c', label: 'PRIORITY' },
  routine:  { bg: '#172554', text: '#93c5fd', label: 'ROUTINE'  },
};

export default function ClinicalPromptsStrip() {
  const {
    age, sex, symptoms, comorbidities, familyHistory, toxicHabits,
    medications, medicationsText, pregnancyPossible,
    procedureData, orderedInvestigations, setOrderedInvestigations,
    plan, setPlan, encounterType,
  } = useAppContext();

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded]   = useState(true);

  const ccEntries: CCEntry[] = (procedureData['cc'] as CCEntry[] | undefined) ?? [];

  const allPrompts = useMemo(() => computeClinicalPrompts({
    age, sex, symptoms, comorbidities, familyHistory, toxicHabits,
    medications, medicationsText, pregnancyPossible, ccEntries, encounterType,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [age, sex, symptoms.join(), comorbidities.join(), familyHistory.join(),
       toxicHabits.join(), medications.join(), medicationsText, pregnancyPossible,
       // eslint-disable-next-line react-hooks/exhaustive-deps
       JSON.stringify(ccEntries), encounterType]);

  const activePrompts = allPrompts.filter(p => !dismissed.has(p.id) && !confirmed.has(p.id));
  const actionableCount = activePrompts.filter(p => p.urgency !== 'routine').length;
  const hasUrgent  = activePrompts.some(p => p.urgency === 'urgent');
  const doneCount  = allPrompts.length - activePrompts.length;

  function confirmPrompt(p: ClinicalPrompt) {
    if (p.addToInvestigations && !orderedInvestigations.includes(p.addToInvestigations)) {
      setOrderedInvestigations([...orderedInvestigations, p.addToInvestigations]);
    }
    if (p.addToPlan) {
      const sep = plan && !plan.endsWith('\n') ? '\n' : '';
      setPlan(plan + sep + p.addToPlan);
    }
    setConfirmed(s => new Set([...s, p.id]));
  }

  if (allPrompts.length === 0) return null;

  return (
    <div style={{
      borderRadius: 10, marginBottom: 8, overflow: 'hidden',
      border: `1px solid ${hasUrgent ? '#7f1d1d' : actionableCount > 0 ? '#431407' : '#1e293b'}`,
      background: '#0f172a',
    }}>

      {/* ── Header ── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px',
          borderBottom: expanded && activePrompts.length > 0 ? '1px solid #1e293b' : 'none',
          cursor: 'pointer', userSelect: 'none',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ fontSize: 14 }}>🧠</span>
        <span style={{
          fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
          color: hasUrgent ? '#fca5a5' : actionableCount > 0 ? '#fb923c' : '#475569',
        }}>
          Clinical Prompts
        </span>

        {actionableCount > 0 && (
          <span style={{
            fontSize: 9, fontWeight: 800, borderRadius: 10, padding: '1px 7px',
            background: hasUrgent ? '#7f1d1d' : '#431407',
            color: hasUrgent ? '#fca5a5' : '#fb923c',
          }}>
            {actionableCount} action{actionableCount !== 1 ? 's' : ''}
          </span>
        )}

        <span style={{ fontSize: 10, color: '#475569' }}>
          {doneCount}/{allPrompts.length} reviewed
        </span>

        {activePrompts.length === 0 && doneCount > 0
          ? <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, marginLeft: 'auto' }}>✓ All reviewed</span>
          : <span style={{ fontSize: 11, color: '#64748b', marginLeft: 'auto' }}>{expanded ? '▲' : '▼'}</span>
        }
      </div>

      {/* ── Prompt cards ── */}
      {expanded && activePrompts.length > 0 && (
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {activePrompts.map(p => {
            const tc = TYPE_COLORS[p.type];
            const ub = URGENCY_BADGE[p.urgency];
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '9px 12px', borderRadius: 8,
                  border: `1px solid ${tc.border}50`,
                  background: tc.bg,
                }}
              >
                {/* Icon + urgency badge */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 1, minWidth: 38 }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{p.icon}</span>
                  <span style={{
                    fontSize: 7, fontWeight: 800, letterSpacing: '0.04em',
                    background: ub.bg, color: ub.text, borderRadius: 3, padding: '1px 4px', textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}>
                    {ub.label}
                  </span>
                </div>

                {/* Text content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: tc.text, marginBottom: 3, lineHeight: 1.35 }}>
                    {p.text}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.45 }}>
                    {p.rationale}
                  </div>
                </div>

                {/* Action buttons — surgeon confirms or dismisses */}
                <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', marginTop: 1 }}>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); confirmPrompt(p); }}
                    title={p.addToInvestigations
                      ? `Surgeon confirms: add "${p.addToInvestigations}" to ordered investigations`
                      : 'Surgeon confirms: add to plan'}
                    style={{
                      padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: '#0d9488', color: '#fff', fontSize: 11, fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ✓ {p.addToInvestigations ? 'Add to Labs' : 'Add to Plan'}
                  </button>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setDismissed(s => new Set([...s, p.id])); }}
                    title="Surgeon dismisses this suggestion"
                    style={{
                      padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                      border: '1px solid #334155', background: 'transparent',
                      color: '#64748b', fontSize: 11,
                    }}
                  >
                    Not now ×
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
