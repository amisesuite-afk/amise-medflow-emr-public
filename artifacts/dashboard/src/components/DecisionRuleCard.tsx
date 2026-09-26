/**
 * Decision-rule calculators added for evidence-exam 1.0.0 (lib/decision-rule-scores.ts): AIR,
 * PERC, Ottawa ankle / knee, Canadian CT head, NEXUS, Canadian C-spine, Centor/McIsaac, STONE,
 * LRINEC, San Francisco syncope rule, Canadian syncope risk score. Shown on the Scales step with
 * the other calculators and opened from the Exam step's "Decision rules" row.
 *
 * Items the record shows are pre-ticked and marked "from record"; nothing is assumed normal. The
 * result shows the band with its likelihood ratio or risk; "Use in decision support" records the
 * value (clinical_scores.decisionScores), which is what makes a diagnostic rule PANE evidence.
 */
import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import RecordScoreButton from '@/components/RecordScoreButton';
import { RULE_SPECS, ruleOutcome, ruleRecord } from '@/lib/decision-rule-scores';
import type { RuleItem, RuleSpec, RuleValues } from '@/lib/decision-rule-scores';
import { examSignStates } from '@/lib/exam-evidence-features';
import { labFromResults } from '@/lib/decision-support';
import { paneContextFromConsultation } from '@/lib/socrates-to-features';

function useRuleRecord() {
  const app = useAppContext();
  return useMemo(() => {
    const x = app.extractedLabs ?? {};
    const lab = (k: 'wbc' | 'crp' | 'haemoglobin' | 'sodium' | 'creatinine' | 'glucose') => {
      const v = x[k];
      return typeof v === 'number' && Number.isFinite(v) ? v : labFromResults(app.investigationResults, k);
    };
    const ctx = paneContextFromConsultation(app);
    const text = [...(ctx.narrative ?? []), ...app.symptoms, ...app.comorbidities, ...app.medications,
      ...Object.entries(app.investigationResults ?? {}).map(([k, v]) => `${k}: ${v}`)].join('.\n');
    return ruleRecord({
      age: app.age, sex: app.sex, vitals: app.vitals,
      labs: { wbc: lab('wbc'), crp: lab('crp'), haemoglobin: lab('haemoglobin'), sodium: lab('sodium'), creatinine: lab('creatinine'), glucose: lab('glucose') },
      text, signs: examSignStates(app.examFindings),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app.age, app.sex, app.vitals, app.extractedLabs, app.investigationResults, app.symptoms, app.comorbidities, app.medications,
    app.examFindings, app.hpiNotes, app.freeText]);
}

function FromRecord() {
  return (
    <span title="Pre-filled from the record — editable" style={{
      marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#0f766e', background: 'rgba(15,118,110,0.08)',
      border: '1px solid rgba(15,118,110,0.25)', borderRadius: 3, padding: '0 4px', whiteSpace: 'nowrap',
    }}>from record</span>
  );
}

function ItemRow({ item, values, fromRecord, onChange }: {
  item: RuleItem; values: RuleValues; fromRecord: boolean; onChange: (v: boolean | string) => void;
}) {
  if (item.kind === 'check') {
    return (
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, marginBottom: 6, cursor: 'pointer' }}>
        <input type="checkbox" checked={values[item.key] === true} onChange={e => onChange(e.target.checked)} style={{ marginTop: 2 }} />
        <span>{item.label} <span style={{ color: '#6b7280' }}>({item.points > 0 ? `+${item.points}` : item.points})</span>{fromRecord && <FromRecord />}</span>
      </label>
    );
  }
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
      <span>{item.label}{fromRecord && <FromRecord />}</span>
      <select value={typeof values[item.key] === 'string' ? String(values[item.key]) : ''} onChange={e => onChange(e.target.value)}
        style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 8px', fontSize: 13 }}>
        <option value="">Not recorded (0)</option>
        {item.options.map(o => <option key={o.value} value={o.value}>{o.label} ({o.points > 0 ? `+${o.points}` : o.points})</option>)}
      </select>
    </label>
  );
}

export function DecisionRuleCard({ spec }: { spec: RuleSpec }) {
  const record = useRuleRecord();
  const prefilled = useMemo(() => spec.prefill(record), [spec, record]);
  const [values, setValues] = useState<RuleValues>(() => prefilled);
  const outcome = ruleOutcome(spec, values);
  if (!outcome) return null;
  const { rule, value, band, summary } = outcome;
  const colour = !band?.lr ? '#f3f4f6' : band.lr.point >= 2 ? '#fee2e2' : band.lr.point <= 0.5 ? '#d1fae5' : '#fef3c7';
  return (
    <div data-testid={`rule-card-${rule.id}`}>
      <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>{spec.applies}</div>
      {spec.items.map(item => (
        <ItemRow key={item.key} item={item} values={values} fromRecord={item.key in prefilled && values[item.key] === prefilled[item.key]}
          onChange={v => setValues(p => ({ ...p, [item.key]: v }))} />
      ))}
      <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: colour, border: '1px solid #e5e7eb' }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{rule.name}: {value}</div>
        <div style={{ fontSize: 13, marginTop: 4, color: '#374151' }}>{summary}</div>
        {rule.note && <div style={{ fontSize: 11.5, marginTop: 4, color: '#6b7280' }}>{rule.note}</div>}
        <div style={{ fontSize: 10.5, marginTop: 4, color: '#6b7280' }}>
          {rule.source}{rule.fromMemory ? ' — values awaiting verification and the surgeon’s sign-off' : ''}
        </div>
        <RecordScoreButton scoreKey={rule.recordKey} value={value} />
      </div>
    </div>
  );
}

/** One component per new rule, for the Scales-step registry (keyed by decision-rules.json web.calculator). */
export const DECISION_RULE_CARDS: Record<string, React.FC> = Object.fromEntries(
  Object.values(RULE_SPECS).map(spec => {
    const Card: React.FC = () => <DecisionRuleCard spec={spec} />;
    Card.displayName = `DecisionRuleCard(${spec.scaleKey})`;
    return [spec.scaleKey, Card];
  }),
);

export const DECISION_RULE_TITLES: Record<string, string> = Object.fromEntries(
  Object.values(RULE_SPECS).map(spec => [spec.scaleKey, spec.title]),
);
