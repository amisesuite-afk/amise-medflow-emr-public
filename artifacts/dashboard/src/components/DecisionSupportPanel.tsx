import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { DECISION_CONTENT, diagnosisMatches, formatPercent } from '@workspace/pane-engine';
import type { Band, DecisionResult, DecisionSourceRef, OptionResult } from '@workspace/pane-engine';
import { useAppContext } from '@/context/AppContext';
import { buildDecisionSupport, resultPosteriorShifts, shiftText } from '@/lib/decision-support';
import type { DecisionConsultation } from '@/lib/decision-support';
import { bestNextTest } from '@/lib/decision-support-links';
import { isImagingInvestigation, parseImagingToRequest } from '@/lib/imaging-utils';
import { orderTickedSuggestions } from '@/lib/investigation-suggestions';

interface CCEntry { complaint: string; answers: Record<string, string> }

const BAND_STYLE: Record<Band, { label: string; bg: string; fg: string }> = {
  observe:           { label: 'Observe',             bg: '#e0f2fe', fg: '#075985' },
  test:              { label: 'Test further',        bg: '#fef3c7', fg: '#92400e' },
  treat:             { label: 'Treat',               bg: '#dcfce7', fg: '#166534' },
  'not-for-patient': { label: 'Not for this patient', bg: '#fee2e2', fg: '#991b1b' },
  unknown:           { label: 'Risk not known',      bg: '#f1f5f9', fg: '#475569' },
};

const LEVEL_COLOUR: Record<string, string> = { critical: '#b91c1c', high: '#c2410c', moderate: '#a16207', low: '#0f766e' };

const chip: CSSProperties = {
  display: 'inline-block', fontSize: 10.5, fontWeight: 700, borderRadius: 999, padding: '1px 8px',
  border: '1px solid #99f6e4', background: '#ccfbf1', color: '#0f766e',
};
const small: CSSProperties = { fontSize: 11, color: '#64748b' };
const btn = (primary: boolean, disabled = false): CSSProperties => ({
  padding: '3px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
  border: primary ? 'none' : '1px solid #cbd5e1', background: disabled ? '#e2e8f0' : primary ? '#0d9488' : '#fff',
  color: disabled ? '#94a3b8' : primary ? '#fff' : '#334155',
});

function stLuciaToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/St_Lucia' });
}

function per100(t: [number, number, number]): string {
  const f = (x: number) => (Math.round(x * 1000) / 10).toString();
  return `${f(t[1])} per 100 (${f(t[0])}–${f(t[2])})`;
}

function Sources({ sources }: { sources: DecisionSourceRef[] }) {
  return (
    <details style={{ marginTop: 3 }}>
      <summary style={{ ...small, cursor: 'pointer' }}>Sources ({sources.length}) — cited from memory, awaiting surgeon sign-off</summary>
      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
        {sources.map(s => <li key={s.id} style={{ ...small, marginBottom: 2 }}>{s.citation}</li>)}
      </ul>
    </details>
  );
}

/** Observe | Test | Treat, with the patient's current probability marked. */
function ThresholdBar({ option, p }: { option: OptionResult; p: number | null }) {
  const test = option.testThreshold?.[1] ?? null;
  const treat = option.treatThreshold[1];
  const obsEnd = test ?? treat;
  const seg = (from: number, to: number, bg: string, label: string) => (
    to > from ? (
      <div title={label} style={{ position: 'absolute', left: `${from * 100}%`, width: `${(to - from) * 100}%`, top: 0, bottom: 0, background: bg }} />
    ) : null
  );
  const aria = `Observe below ${formatPercent(obsEnd)}${test !== null ? `, test further from ${formatPercent(test)}` : ''}, treat from ${formatPercent(treat)}${p !== null ? `; current ${formatPercent(p)}` : ''}`;
  return (
    <div role="img" aria-label={aria} style={{ margin: '6px 0 2px' }}>
      <div style={{ position: 'relative', height: 10, borderRadius: 5, overflow: 'hidden', background: '#f1f5f9' }}>
        {seg(0, obsEnd, '#bae6fd', 'Observe')}
        {test !== null && seg(test, treat, '#fde68a', 'Test further')}
        {seg(treat, 1, '#bbf7d0', 'Treat')}
        {/* Evidence range of the treat threshold */}
        <div style={{
          position: 'absolute', left: `${option.treatThreshold[0] * 100}%`, width: `${Math.max(0.5, (option.treatThreshold[2] - option.treatThreshold[0]) * 100)}%`,
          top: 0, bottom: 0, backgroundImage: 'repeating-linear-gradient(45deg, rgba(15,23,42,0.18) 0 2px, transparent 2px 5px)',
        }} />
        {p !== null && (
          <div style={{ position: 'absolute', left: `calc(${Math.min(1, Math.max(0, p)) * 100}% - 1px)`, top: -2, bottom: -2, width: 3, background: '#0f172a' }} />
        )}
      </div>
      <div style={{ ...small, display: 'flex', justifyContent: 'space-between' }}>
        <span>Observe &lt; {formatPercent(obsEnd)}</span>
        {test !== null && <span>Test {formatPercent(test)}–{formatPercent(treat)}</span>}
        <span>Treat ≥ {formatPercent(treat)} (range {formatPercent(option.treatThreshold[0])}–{formatPercent(option.treatThreshold[2])})</span>
      </div>
    </div>
  );
}

interface Actions {
  inPlan(line: string): boolean;
  addPlan(line: string): void;
  addTest(label: string, why: string): void;
  locked: boolean;
}

function AddButtons({ line, addAs, why, actions, onDismiss }: { line: string | null; addAs: 'plan' | 'test' | null; why: string; actions: Actions; onDismiss(): void }) {
  const added = !!line && actions.inPlan(line);
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
      {line && addAs === 'plan' && (
        <button type="button" style={btn(true, added || actions.locked)} disabled={added || actions.locked} onClick={() => actions.addPlan(line)}>
          {added ? 'In plan' : 'Add to plan'}
        </button>
      )}
      {line && addAs === 'test' && (
        <button type="button" style={btn(true, actions.locked)} disabled={actions.locked} onClick={() => actions.addTest(line, why)}>
          Add test
        </button>
      )}
      <button type="button" style={btn(false)} onClick={onDismiss}>Dismiss</button>
    </div>
  );
}

function OptionRow({ d, o, actions, onDismiss }: { d: DecisionResult; o: OptionResult; actions: Actions; onDismiss(): void }) {
  const band = BAND_STYLE[o.band];
  const next = o.band === 'test' ? bestNextTest({ diseaseId: null, name: d.diagnosisName }) : null;
  const line = o.band === 'test' && next ? next.label : o.suggestedLine;
  return (
    <div data-testid={`decision-option-${d.id}-${o.id}`} style={{ borderTop: '1px solid #e2e8f0', padding: '7px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {o.rank !== null && <span style={{ fontSize: 11, fontWeight: 800, color: '#334155' }}>#{o.rank}</span>}
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink, #0f172a)' }}>{o.label}</span>
        <span style={{ fontSize: 10.5, fontWeight: 800, borderRadius: 999, padding: '1px 8px', background: band.bg, color: band.fg }}>{band.label}</span>
        {o.borderline && <span style={{ ...small, color: '#a16207' }}>borderline: {o.bandRange.map(b => BAND_STYLE[b].label).join(' / ')} across the evidence range</span>}
        {o.lowEvidence && <span style={{ fontSize: 10, fontWeight: 700, color: '#7c2d12', background: '#ffedd5', borderRadius: 4, padding: '0 5px' }}>low evidence — estimate</span>}
      </div>
      {o.band !== 'not-for-patient' && <ThresholdBar option={o} p={d.probability} />}
      {o.band !== 'not-for-patient' && d.probability !== null && (
        <div style={small}>
          For this patient: expected benefit {per100(o.expectedBenefit)} · expected harm {per100(o.expectedHarm)}
        </div>
      )}
      {o.factorSummary && <div style={{ fontSize: 11.5, color: '#334155', marginTop: 2 }}>{o.factorSummary}</div>}
      {o.withheldText && <div style={{ fontSize: 11.5, color: '#991b1b', marginTop: 2 }}>{o.withheldText}</div>}
      {o.excludedReason && !o.factorSummary?.includes('not for this patient') && <div style={{ fontSize: 11.5, color: '#991b1b', marginTop: 2 }}>{o.excludedReason}</div>}
      {o.band === 'not-for-patient' && o.excludedReason && <div style={{ ...small, color: '#991b1b' }}>{o.excludedReason}</div>}
      {line && o.band !== 'not-for-patient' && (
        <div style={{ fontSize: 12, color: '#0f172a', marginTop: 3 }}>
          <span style={{ fontWeight: 700 }}>{o.band === 'treat' ? 'Suggested: ' : o.band === 'test' ? (next ? 'Best next test (diagnostic reasoning): ' : 'Test: ') : 'Observe: '}</span>
          {line}
        </div>
      )}
      {o.note && <div style={small}>{o.note}</div>}
      <Sources sources={o.sources} />
      {o.band !== 'not-for-patient' && o.band !== 'unknown' && (
        <AddButtons line={line} addAs={o.band === 'test' ? 'test' : o.suggestedAddAs} why={`${d.label} (decision support)`} actions={actions} onDismiss={onDismiss} />
      )}
    </div>
  );
}

/**
 * "Decision support — clinician decides": score → action, result → action and the treatment
 * decision layer for the leading diagnoses (lib/pane-engine/src/decision). Suggestions only:
 * nothing reaches the plan, the orders or a prescription without a tap. The plan-safety filter
 * is applied to every line (lib/decision-support.ts).
 *
 * `diseaseId` (ManagementPanel): only the decisions for that diagnosis, compact.
 */
export default function DecisionSupportPanel({ diseaseId, compact = false }: { diseaseId?: string | null; compact?: boolean }) {
  const app = useAppContext();
  const {
    plan, setPlan, orderedInvestigations, setOrderedInvestigations, radiologyRequests, setRadiologyRequests,
    encounterStatus, procedureData, paneState,
  } = app;
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const consultation: DecisionConsultation = {
    age: app.age, sex: app.sex, pregnancyPossible: app.pregnancyPossible, allergies: app.allergies,
    medications: app.medications, medicationsText: app.medicationsText, comorbidities: app.comorbidities,
    pmhNotes: app.pmhNotes, hpiNotes: app.hpiNotes, freeText: app.freeText, surgicalHistory: app.surgicalHistory,
    assessment: app.assessment, extractedLabs: app.extractedLabs, investigationResults: app.investigationResults,
    vitals: app.vitals, weightKg: app.weightKg, heightCm: app.heightCm, isPostOp: app.isPostOp, postOpDays: app.postOpDays,
    recentSurgeryDate: app.recentSurgeryDate, clinicalScores: app.clinicalScores, workingDiagnosis: app.workingDiagnosis,
    icdCodes: app.icdCodes, paneTop: app.paneTop,
    imagingText: app.radiologyRequests.filter(r => r.resultReceived).map(r => r.resultNotes ?? '').join('.\n'),
    today: stLuciaToday(),
  };
  const key = JSON.stringify(consultation);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const result = useMemo(() => buildDecisionSupport(consultation), [key]);
  const entries = (procedureData['cc'] as CCEntry[] | undefined) ?? [];
  const shifts = useMemo(
    () => (compact ? [] : resultPosteriorShifts({ ...consultation, ...app }, entries, paneState)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, JSON.stringify(entries), paneState, compact],
  );

  const locked = encounterStatus === 'closed';
  const actions: Actions = {
    locked,
    inPlan: line => plan.includes(line),
    addPlan: line => {
      if (locked || plan.includes(line)) return;
      setPlan(plan.trim() ? `${plan.trimEnd()}\n${line}` : line);
    },
    addTest: (label, why) => {
      if (locked) return;
      const next = orderTickedSuggestions(
        [{ label, kind: isImagingInvestigation(label) ? 'imaging' : 'lab', urgency: 'urgent', suggestedFor: [why], caveat: null }],
        { orderedInvestigations, radiologyRequests },
        s => parseImagingToRequest(s.label, s.urgency, s.suggestedFor[0]),
      );
      if (next.orderedInvestigations.length !== orderedInvestigations.length) setOrderedInvestigations(next.orderedInvestigations);
      if (next.radiologyRequests.length !== radiologyRequests.length) setRadiologyRequests(next.radiologyRequests);
    },
  };
  const dismiss = (id: string) => setDismissed(prev => new Set(prev).add(id));

  const decisions = result.decisions.filter(d => !diseaseId || decisionForDisease(d, diseaseId));
  const scoreCards = compact ? [] : result.scoreActions.filter(c => !dismissed.has(`s:${c.id}`));
  const resultCards = compact ? [] : result.resultActions.filter(c => !dismissed.has(`r:${c.id}`));
  if (!decisions.length && !scoreCards.length && !resultCards.length && !shifts.length) return null;

  return (
    <div data-testid={compact ? 'decision-support-compact' : 'decision-support-panel'}
      style={{ border: '1px dashed #0d9488', borderRadius: 10, padding: '10px 14px', background: '#f8fafc', color: '#0f172a', margin: compact ? '8px 0 4px' : 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Decision support — clinician decides
        </span>
        <span style={small}>
          Suggestions only: nothing is added, ordered or prescribed until you tap. Content {result.contentVersion} awaits surgeon sign-off.
        </span>
      </div>

      {shifts.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#334155' }}>What the results changed</div>
          {shifts.slice(0, 3).map(s => <div key={s.diseaseId} data-testid="decision-shift" style={{ fontSize: 12, color: '#0f172a' }}>{shiftText(s)}</div>)}
        </div>
      )}

      {resultCards.map(c => (
        <div key={c.id} data-testid={`decision-result-${c.id}`} style={{ borderTop: '1px solid #e2e8f0', padding: '7px 0', marginTop: 6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={chip}>{c.chip}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: LEVEL_COLOUR[c.level] }}>{c.label}</span>
            <span style={small}>{c.thresholdText}</span>
          </div>
          <div style={{ fontSize: 12, color: '#0f172a', marginTop: 3 }}>{c.action}</div>
          <Sources sources={c.sources} />
          <AddButtons line={c.withheld ? null : c.action} addAs="plan" why={c.label} actions={actions} onDismiss={() => dismiss(`r:${c.id}`)} />
        </div>
      ))}

      {scoreCards.map(c => (
        <div key={c.id} data-testid={`decision-score-${c.score}`} style={{ borderTop: '1px solid #e2e8f0', padding: '7px 0', marginTop: 6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={chip}>{c.chip}{c.scoreSource === 'record' ? ' (from the record)' : ''}</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: LEVEL_COLOUR[c.level] }}>{c.band}</span>
          </div>
          <div style={{ fontSize: 12, color: '#0f172a', marginTop: 3 }}>{c.action}</div>
          <Sources sources={c.sources} />
          <AddButtons line={c.withheld ? null : c.action} addAs="plan" why={c.scoreLabel} actions={actions} onDismiss={() => dismiss(`s:${c.id}`)} />
        </div>
      ))}

      {decisions.map(d => (
        <div key={d.id} data-testid={`decision-${d.id}`} style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{d.label}</span>
            <span style={chip}>{d.chip}</span>
            {d.probability !== null && <span style={small}>{d.probabilityLabel} {formatPercent(d.probability)}</span>}
          </div>
          {d.options.filter(o => !dismissed.has(`o:${d.id}:${o.id}`)).map(o => (
            <OptionRow key={o.id} d={d} o={o} actions={actions} onDismiss={() => dismiss(`o:${d.id}:${o.id}`)} />
          ))}
          {d.missing.length > 0 && (
            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
              {d.missing.slice(0, compact ? 2 : 5).map(m => <li key={m} style={{ ...small, color: '#92400e' }}>{m}</li>)}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

/** ManagementPanel: the decision belongs to this protocol's diagnosis (same matching as the engine). */
function decisionForDisease(d: DecisionResult, diseaseId: string): boolean {
  const def = DECISION_CONTENT.decisions.find(x => x.id === d.id);
  return !!def && diagnosisMatches(def, { name: '', id: diseaseId, probability: null, confirmed: false });
}
