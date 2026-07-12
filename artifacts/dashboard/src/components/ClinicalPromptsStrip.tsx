import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { computeClinicalPrompts, type ClinicalPrompt, type FollowUpSpec } from '@/lib/clinical-inference';

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

const FOLLOW_UP_KEY = 'amise_followup_v1';

interface StoredFollowUp {
  id: string;
  promptId: string;
  label: string;
  dueDate: string;
  done: boolean;
  recurring?: boolean;
  recurringDays?: number;
  patientName?: string;
}

function addFollowUpToQueue(spec: FollowUpSpec, promptId: string, patientName?: string): void {
  try {
    const raw = localStorage.getItem(FOLLOW_UP_KEY);
    const items: StoredFollowUp[] = raw ? (JSON.parse(raw) as StoredFollowUp[]) : [];
    // Avoid duplicates per promptId per patient session
    if (items.some(i => i.promptId === promptId && !i.done)) return;
    const due = new Date();
    due.setDate(due.getDate() + spec.daysFromNow);
    items.push({
      id: `fu_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      promptId,
      label: spec.label,
      dueDate: due.toISOString().slice(0, 10),
      done: false,
      recurring: spec.recurring,
      recurringDays: spec.recurringDays,
      patientName,
    });
    localStorage.setItem(FOLLOW_UP_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

export default function ClinicalPromptsStrip() {
  const {
    age, sex, symptoms, comorbidities, familyHistory, toxicHabits,
    medications, medicationsText, pregnancyPossible,
    procedureData, orderedInvestigations, setOrderedInvestigations,
    plan, setPlan, encounterType,
    examGeneral, examAbdomen, examBreast, examCardio, examResp, examNeuro, examExtremities,
    investigationResults, radiologyRequests,
    vitals, assessment,
    patientName,
  } = useAppContext();

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const ccEntries: CCEntry[] = (procedureData['cc'] as CCEntry[] | undefined) ?? [];

  const allPrompts = useMemo(() => computeClinicalPrompts({
    age, sex, symptoms, comorbidities, familyHistory, toxicHabits,
    medications, medicationsText, pregnancyPossible, ccEntries, encounterType,
    examGeneral, examAbdomen, examBreast, examCardio, examResp, examNeuro, examExtremities,
    investigationResults,
    radiologyRequests: radiologyRequests.map(r => ({
      modality: r.modality,
      anatomicalRegion: r.anatomicalRegion,
      resultReceived: r.resultReceived,
      resultNotes: r.resultNotes,
      indication: r.indication,
    })),
    vitals,
    assessment,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [age, sex, symptoms.join(), comorbidities.join(), familyHistory.join(),
       toxicHabits.join(), medications.join(), medicationsText, pregnancyPossible,
       // eslint-disable-next-line react-hooks/exhaustive-deps
       JSON.stringify(ccEntries), encounterType,
       examGeneral, examAbdomen, examBreast, examCardio, examResp, examNeuro, examExtremities,
       // eslint-disable-next-line react-hooks/exhaustive-deps
       JSON.stringify(investigationResults),
       // eslint-disable-next-line react-hooks/exhaustive-deps
       JSON.stringify(radiologyRequests.map(r => r.resultNotes + r.resultReceived)),
       // eslint-disable-next-line react-hooks/exhaustive-deps
       JSON.stringify(vitals), assessment]);

  const activePrompts = allPrompts.filter(p => !dismissed.has(p.id) && !confirmed.has(p.id));
  const actionableCount = activePrompts.filter(p => p.urgency !== 'routine').length;
  const hasUrgent = activePrompts.some(p => p.urgency === 'urgent');
  const doneCount = allPrompts.length - activePrompts.length;

  function confirmPrompt(p: ClinicalPrompt) {
    const newInvs = [...orderedInvestigations];
    const planParts: string[] = [];

    for (const action of p.actions) {
      if (action.addToInvestigations && !newInvs.includes(action.addToInvestigations)) {
        newInvs.push(action.addToInvestigations);
      }
      if (action.addToPlan) planParts.push(action.addToPlan);
    }

    if (newInvs.length !== orderedInvestigations.length) {
      setOrderedInvestigations(newInvs);
    }
    if (planParts.length > 0) {
      const sep = plan && !plan.endsWith('\n') ? '\n' : '';
      setPlan(plan + sep + planParts.join('\n'));
    }

    if (p.followUp) {
      addFollowUpToQueue(p.followUp, p.id, patientName || undefined);
    }

    setConfirmed(s => new Set([...s, p.id]));
  }

  function toggleCard(id: string) {
    setExpandedCards(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
            const isCardExpanded = expandedCards.has(p.id);

            return (
              <div
                key={p.id}
                style={{
                  borderRadius: 8,
                  border: `1px solid ${tc.border}50`,
                  background: tc.bg,
                  overflow: 'hidden',
                }}
              >
                {/* Card header — click to expand actions */}
                <div
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '9px 12px', cursor: 'pointer',
                  }}
                  onClick={() => toggleCard(p.id)}
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
                    {p.diagnosis && (
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: tc.text, opacity: 0.7, marginBottom: 2 }}>
                        {p.diagnosis}
                      </div>
                    )}
                    <div style={{ fontSize: 12, fontWeight: 700, color: tc.text, marginBottom: 3, lineHeight: 1.35 }}>
                      {p.text}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.45 }}>
                      {p.finding !== p.text ? p.finding : p.rationale}
                    </div>
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 3 }}>
                      {p.actions.length} step{p.actions.length !== 1 ? 's' : ''} · {isCardExpanded ? 'collapse ▲' : 'expand to review ▼'}
                    </div>
                  </div>

                  {/* Dismiss */}
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setDismissed(s => new Set([...s, p.id])); }}
                    title="Surgeon dismisses this suggestion"
                    style={{
                      flexShrink: 0, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                      border: '1px solid #334155', background: 'transparent',
                      color: '#64748b', fontSize: 11, alignSelf: 'flex-start', marginTop: 1,
                    }}
                  >
                    × Not now
                  </button>
                </div>

                {/* Expanded: rationale + action cascade + confirm */}
                {isCardExpanded && (
                  <div style={{ borderTop: `1px solid ${tc.border}30`, padding: '10px 12px 12px' }}>

                    {/* Rationale */}
                    <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5, marginBottom: 10, fontStyle: 'italic' }}>
                      {p.rationale}
                    </div>

                    {/* Action cascade */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                      {p.actions.map(action => (
                        <div
                          key={action.step}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: 8,
                            padding: '6px 10px', borderRadius: 6,
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          <span style={{
                            flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
                            background: tc.border, color: '#fff',
                            fontSize: 10, fontWeight: 800,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginTop: 1,
                          }}>
                            {action.step}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.45 }}>
                              {action.text}
                            </span>
                            <div style={{ display: 'flex', gap: 4, marginTop: 3, flexWrap: 'wrap' }}>
                              {action.addToInvestigations && (
                                <span style={{
                                  fontSize: 9, fontWeight: 700, borderRadius: 4,
                                  padding: '1px 6px', background: 'rgba(15,118,110,0.25)',
                                  color: '#5eead4', border: '1px solid rgba(15,118,110,0.4)',
                                }}>
                                  + Labs: {action.addToInvestigations}
                                </span>
                              )}
                              {action.addToPlan && (
                                <span style={{
                                  fontSize: 9, fontWeight: 700, borderRadius: 4,
                                  padding: '1px 6px', background: 'rgba(99,102,241,0.2)',
                                  color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)',
                                }}>
                                  + Plan
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Follow-up notice */}
                    {p.followUp && (
                      <div style={{
                        fontSize: 10, color: '#64748b', marginBottom: 10,
                        padding: '5px 8px', borderRadius: 5,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid #1e293b',
                      }}>
                        📅 Follow-up will be queued: <strong style={{ color: '#94a3b8' }}>{p.followUp.label}</strong> in {p.followUp.daysFromNow} day{p.followUp.daysFromNow !== 1 ? 's' : ''}
                        {p.followUp.recurring ? ' (recurring)' : ''}
                      </div>
                    )}

                    {/* Confirm button */}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); confirmPrompt(p); }}
                      style={{
                        width: '100%', padding: '7px 12px', borderRadius: 6,
                        border: 'none', cursor: 'pointer',
                        background: '#0d9488', color: '#fff',
                        fontSize: 12, fontWeight: 700,
                      }}
                    >
                      ✓ Surgeon confirms — apply all {p.actions.length} step{p.actions.length !== 1 ? 's' : ''} to plan & labs
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
