/**
 * Exam step — "High-yield signs" (evidence-exam 1.0.0). Deterministic; no AI.
 *
 * Offers the evidence-based signs for the complaint and the leading differential (clinical-content/
 * rules/exam-signs.json; the complaint is read through its history frame, the history step's own
 * classifier: lib/exam-frames.ts), highest diagnostic value first: expected information gain over the
 * current PANE differential when there is one, else the size of the likelihood ratio. Each sign is
 * a three-way choice — present / absent / not examined — with how to elicit it and its likelihood
 * ratios on tap. Nothing is pre-filled: an unmarked sign was not examined, and only an examined,
 * absent sign whose absence is meaningful lowers a diagnosis.
 *
 * Also suggests the decision rule for the complaint (Alvarado / AIR for right iliac fossa pain,
 * Wells + PERC for pleuritic chest pain, …) and opens the calculator, pre-filled from the record.
 */
import { useMemo, useState } from 'react';
import {
  DISEASES, applyModifiers, examSign, formatLrValue, informationGain, relevantRules, relevantSigns, signFeatureId, targetGroup,
  FEATURES,
} from '@workspace/pane-engine';
import type { ExamSign, PaneState, SignState } from '@workspace/pane-engine';
import { useAppContext } from '@/context/AppContext';
import { examSignStates, recordedRuleValues, withSignState } from '@/lib/exam-evidence-features';
import { complaintFrameIds } from '@/lib/exam-frames';
import { paneStateFromConsultation } from '@/lib/pane-reseed';
import { currentComplaintText } from '@/lib/visit-continuity-web';
import { ScaleCalculator } from '@/pages/tabs/ScalesTab';

const C = {
  ink: 'var(--ink, #122320)', muted: '#5a706c', line: 'rgba(15,95,118,0.18)', accent: '#0f766e',
  present: '#0b6b52', presentBg: 'rgba(16,185,129,0.12)', absent: '#475569', absentBg: 'rgba(148,163,184,0.18)',
  warn: '#a16207', warnBg: 'rgba(234,179,8,0.12)',
};

const SHOWN_FIRST = 8;
const FEATURE_IDS = new Set(FEATURES.map(f => f.id));

function restrictedGain(state: PaneState, diseaseIds: string[], featureId: string, age: number | null, sex: string, pregnancyPossible: boolean): number {
  const diseases = applyModifiers(DISEASES, age, sex, undefined, { pregnancyPossible }).filter(d => diseaseIds.includes(d.id));
  const total = diseases.reduce((s, d) => s + (state.posteriors[d.id] ?? 0), 0);
  if (total <= 0 || diseases.length < 2) return 0;
  const restricted: PaneState = {
    posteriors: Object.fromEntries(diseases.map(d => [d.id, (state.posteriors[d.id] ?? 0) / total])),
    answered: state.answered, iteration: state.iteration,
  };
  return informationGain(restricted, diseases, featureId);
}

function Choice({ label, active, fg, bg, disabled, onClick, testId }: {
  label: string; active: boolean; fg: string; bg: string; disabled: boolean; onClick: () => void; testId: string;
}) {
  return (
    <button type="button" data-testid={testId} aria-pressed={active} disabled={disabled} onClick={onClick} style={{
      padding: '2px 8px', fontSize: 11.5, fontWeight: 700, borderRadius: 4, cursor: disabled ? 'default' : 'pointer',
      border: `1px solid ${active ? fg : '#cbd5e1'}`, background: active ? bg : 'transparent', color: active ? fg : '#64748b',
    }}>{label}</button>
  );
}

function SignDetails({ sign }: { sign: ExamSign }) {
  const group = targetGroup(sign.target.group);
  return (
    <div style={{ fontSize: 11.5, color: C.ink, padding: '4px 0 2px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div><b>How:</b> {sign.elicit}</div>
      <div>
        <b>For:</b> {group?.label ?? sign.target.group} — LR+ <b>{formatLrValue(sign.lrPositive)}</b>, LR− <b>{formatLrValue(sign.lrNegative)}</b>
        {!sign.negativeMeaningful && sign.engine !== 'none' && <span style={{ color: C.warn }}> · absence is not used (LR− near 1{sign.engine === 'twin' ? ' or a red-flag sign' : ''})</span>}
        {sign.engine === 'none' && <span style={{ color: C.warn }}> · low value: documentation only</span>}
      </div>
      {sign.note && <div style={{ color: C.muted }}>{sign.note}</div>}
      <div style={{ color: C.muted, fontSize: 10.5 }}>
        {sign.quality} · {sign.source}{sign.fromMemory ? ' · value not yet verified against the source (surgeon sign-off pending)' : ''}
      </div>
    </div>
  );
}

export default function ExamSignsPanel() {
  const app = useAppContext();
  const { examFindings, setExamFindings, age, sex, pregnancyPossible, paneState, setPaneState, encounterStatus, clinicalScores } = app;
  const [openSign, setOpenSign] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [calculator, setCalculator] = useState<{ key: string; title: string } | null>(null);
  const locked = encounterStatus === 'closed';
  const ageNum = parseInt(age, 10);
  const ageYears = Number.isFinite(ageNum) ? ageNum : null;
  const states = examSignStates(examFindings);
  const recorded = recordedRuleValues(clinicalScores);

  const complaint = currentComplaintText({ procedureData: app.procedureData as Record<string, unknown>, symptoms: app.symptoms, freeText: app.freeText });
  const text = [complaint, app.hpiNotes, ...app.symptoms].filter(Boolean).join('. ');
  // The complaint's history frames (the history step's classifier): a cough offers chest signs.
  const frames = useMemo(
    () => complaintFrameIds(app.procedureData as Record<string, unknown>, complaint),
    [app.procedureData, complaint],
  );
  const differential = useMemo(() => Object.entries(paneState?.posteriors ?? {})
    .filter(([id, p]) => id !== '_other_' && p > 0).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id), [paneState]);

  const ranked = useMemo(() => {
    const list = relevantSigns({ text, frames, ageYears, differential });
    // Signs already recorded stay visible even when no longer suggested.
    for (const id of Object.keys(states)) {
      if (!list.some(r => r.sign.id === id)) {
        const sign = examSign(id);
        if (sign) list.push({ sign, reasons: ['recorded'], inDifferential: false, value: 0 });
      }
    }
    const gain = (s: ExamSign) => {
      const f = signFeatureId(s.id);
      return paneState && FEATURE_IDS.has(f) && differential.length >= 2
        ? restrictedGain(paneState, differential, f, ageYears, sex, pregnancyPossible) : 0;
    };
    return list
      .map(r => ({ ...r, gain: gain(r.sign) }))
      .sort((a, b) => Number(b.inDifferential) - Number(a.inDifferential) || b.gain - a.gain || b.value - a.value);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, frames.join(','), ageYears, differential.join(','), Object.keys(states).join(','), paneState, sex, pregnancyPossible]);

  const rules = useMemo(() => relevantRules({ text, frames, ageYears, differential }), [text, frames, ageYears, differential]);

  function setSign(id: string, state: SignState | null) {
    const next = withSignState(examFindings, id, state);
    setExamFindings(next);
    // The differential follows the new evidence at once (HpiTab.reseedPane with the new chips).
    setPaneState(paneStateFromConsultation({ ...app, examFindings: next }));
  }

  if (!ranked.length && !rules.length) return null;
  const shown = showAll ? ranked : ranked.slice(0, SHOWN_FIRST);

  return (
    <div data-testid="exam-signs-panel" style={{ border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', marginBottom: 12, background: 'rgba(15,118,110,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.accent }}>High-yield signs</span>
        <span style={{ fontSize: 11.5, color: C.muted }}>
          Most informative first for this complaint and differential. Mark only what you examined — an unmarked sign counts as not examined.
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        {shown.map(({ sign, reasons }) => {
          const state = states[sign.id] ?? null;
          const open = openSign === sign.id;
          return (
            <div key={sign.id} data-testid={`exam-sign-${sign.id}`} style={{ borderBottom: `1px dashed ${C.line}`, paddingBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setOpenSign(open ? null : sign.id)} aria-expanded={open}
                  title="How to elicit it, and its likelihood ratios"
                  style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: C.ink, textAlign: 'left' }}>
                  {open ? '▾' : '▸'} {sign.name}
                </button>
                <span style={{ fontSize: 10.5, color: C.muted }}>
                  {sign.lrPositive ? `LR+ ${formatLrValue({ point: sign.lrPositive.point })}` : 'LR not established'} · {reasons[0]}
                </span>
                {sign.engine === 'none' && <span style={{ fontSize: 10.5, color: C.warn, background: C.warnBg, borderRadius: 3, padding: '0 4px' }}>low value</span>}
                <span style={{ flex: 1 }} />
                <Choice label="Present" active={state === 'present'} fg={C.present} bg={C.presentBg} disabled={locked}
                  testId={`exam-sign-${sign.id}-present`} onClick={() => setSign(sign.id, state === 'present' ? null : 'present')} />
                <Choice label="Absent" active={state === 'absent'} fg={C.absent} bg={C.absentBg} disabled={locked}
                  testId={`exam-sign-${sign.id}-absent`} onClick={() => setSign(sign.id, state === 'absent' ? null : 'absent')} />
                <Choice label="Not examined" active={state === null} fg={C.accent} bg="rgba(15,118,110,0.08)" disabled={locked}
                  testId={`exam-sign-${sign.id}-clear`} onClick={() => setSign(sign.id, null)} />
              </div>
              {open && <SignDetails sign={sign} />}
            </div>
          );
        })}
      </div>
      {ranked.length > SHOWN_FIRST && (
        <button type="button" onClick={() => setShowAll(v => !v)} style={{ marginTop: 6, fontSize: 11.5, border: 'none', background: 'transparent', color: C.accent, cursor: 'pointer', padding: 0 }}>
          {showAll ? 'Show fewer' : `Show ${ranked.length - SHOWN_FIRST} more`}
        </button>
      )}

      {rules.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.accent, marginBottom: 4 }}>Decision rules</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {rules.map(({ rule, reasons }) => {
              const value = recorded[rule.recordKey];
              return (
                <button key={rule.id} type="button" data-testid={`exam-rule-${rule.id}`}
                  onClick={() => setCalculator({ key: rule.web.calculator, title: rule.name })}
                  title={`${reasons.join('; ')} — opens the calculator, pre-filled from the record${rule.kind === 'prognostic' ? ' (prognostic: does not change the differential)' : ''}`}
                  style={{ fontSize: 12, padding: '3px 10px', borderRadius: 14, cursor: 'pointer', border: `1px solid ${C.accent}`, background: typeof value === 'number' ? 'rgba(15,118,110,0.1)' : '#fff', color: C.accent, fontWeight: 600 }}>
                  {rule.name}{typeof value === 'number' ? ` · recorded ${value}` : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {calculator && (
        <div role="dialog" aria-modal="true" aria-label={calculator.title} data-testid="exam-rule-calculator"
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 12px', overflowY: 'auto' }}
          onClick={e => { if (e.target === e.currentTarget) setCalculator(null); }}>
          <div style={{ background: 'var(--surface, #fff)', borderRadius: 10, padding: 16, width: 'min(640px, 100%)', boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ fontSize: 14, flex: 1 }}>{calculator.title}</strong>
              <button type="button" onClick={() => setCalculator(null)} style={{ border: '1px solid #cbd5e1', borderRadius: 6, background: 'transparent', padding: '2px 10px', cursor: 'pointer' }}>Close</button>
            </div>
            <ScaleCalculator scaleKey={calculator.key} />
          </div>
        </div>
      )}
    </div>
  );
}
