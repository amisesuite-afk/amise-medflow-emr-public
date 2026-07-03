import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

type Decision = 'continue' | 'hold_day_of' | 'hold_48h' | 'hold_5d' | 'dose_reduce' | 'stress_dose' | 'discontinue' | 'bridge';

interface MedEntry {
  name: string;
  decision: Decision;
  note: string;
  autoFlag: AutoFlag | null;
}

interface AutoFlag {
  decision: Decision;
  reason: string;
  severity: 'high' | 'medium' | 'low';
}

const DECISIONS: Array<{ value: Decision; label: string; color: string }> = [
  { value: 'continue',    label: 'Continue',          color: '#10b981' },
  { value: 'hold_day_of', label: 'Hold day of op',    color: '#f59e0b' },
  { value: 'hold_48h',    label: 'Hold 48h pre-op',   color: '#f59e0b' },
  { value: 'hold_5d',     label: 'Hold 5 days pre-op', color: '#ef4444' },
  { value: 'dose_reduce', label: 'Dose reduce',        color: '#6366f1' },
  { value: 'stress_dose', label: 'Stress dose needed', color: '#ef4444' },
  { value: 'bridge',      label: 'Bridge required',    color: '#ef4444' },
  { value: 'discontinue', label: 'Discontinue',        color: '#64748b' },
];

// Auto-flag rules: substring match (lowercase) → flag
const FLAG_RULES: Array<{ match: string[]; flag: AutoFlag }> = [
  {
    match: ['warfarin'],
    flag: { decision: 'hold_5d', severity: 'high', reason: 'Hold 5 days pre-op. Check INR day before. Consider LMWH bridge if high thrombotic risk (AF + CHA₂DS₂-VASc ≥ 4, mechanical valve, VTE < 3 months).' },
  },
  {
    match: ['rivaroxaban', 'xarelto', 'apixaban', 'eliquis', 'dabigatran', 'pradaxa'],
    flag: { decision: 'hold_48h', severity: 'high', reason: 'Hold 48h (2 doses) pre-op for elective surgery. Hold 4 days if CrCl < 30 or high bleeding risk.' },
  },
  {
    match: ['clopidogrel', 'ticagrelor', 'prasugrel'],
    flag: { decision: 'hold_5d', severity: 'high', reason: 'Hold 5–7 days pre-op unless bare-metal stent < 1 month or DES < 6 months — discuss with cardiologist before stopping.' },
  },
  {
    match: ['aspirin'],
    flag: { decision: 'continue', severity: 'low', reason: 'Continue aspirin unless risk of intra-operative bleeding outweighs benefit (e.g. intracranial, spinal, ophthalmology).' },
  },
  {
    match: ['metformin'],
    flag: { decision: 'hold_day_of', severity: 'medium', reason: 'Hold on day of surgery and for 48h post-op. Restart when oral intake resumed and renal function confirmed normal.' },
  },
  {
    match: ['sglt2', 'gliflozin', 'empagliflozin', 'dapagliflozin', 'canagliflozin'],
    flag: { decision: 'hold_48h', severity: 'high', reason: 'Hold 48–72h pre-op. Risk of euglycaemic DKA perioperatively. Check ketones if resumed early.' },
  },
  {
    match: ['insulin'],
    flag: { decision: 'dose_reduce', severity: 'high', reason: 'Halve long-acting insulin dose the night before. Omit short-acting insulin while fasting. Implement sliding scale / VRII if major surgery. Monitor BGL 2-hourly.' },
  },
  {
    match: ['gliclazide', 'glibenclamide', 'glipizide', 'sulfonylurea'],
    flag: { decision: 'hold_day_of', severity: 'medium', reason: 'Hold on day of surgery due to hypoglycaemia risk while fasting. Monitor BGL.' },
  },
  {
    match: ['prednisolone', 'dexamethasone', 'hydrocortisone', 'methylprednisolone', 'steroid', 'prednisone'],
    flag: { decision: 'stress_dose', severity: 'high', reason: 'Adrenal axis may be suppressed if > 5mg prednisolone / day for > 3 weeks. Give hydrocortisone 25mg IV at induction + 100mg/day for 24–72h (minor/major surgery).' },
  },
  {
    match: ['methotrexate'],
    flag: { decision: 'hold_week', severity: 'medium', reason: 'Consider omitting dose the week of surgery to reduce infection risk; continue for most elective procedures. Discuss with rheumatologist.' } as unknown as AutoFlag,
  },
  {
    match: ['nsaid', 'ibuprofen', 'diclofenac', 'naproxen', 'celecoxib', 'indomethacin'],
    flag: { decision: 'hold_5d', severity: 'medium', reason: 'Hold 5–7 days pre-op. Reversible platelet inhibition; renal protection concerns perioperatively.' },
  },
  {
    match: ['ace inhibitor', 'ramipril', 'perindopril', 'enalapril', 'lisinopril'],
    flag: { decision: 'hold_day_of', severity: 'medium', reason: 'Hold on morning of surgery. Risk of refractory intraoperative hypotension. Resume when haemodynamically stable post-op.' },
  },
  {
    match: ['arb', 'losartan', 'irbesartan', 'valsartan', 'olmesartan', 'candesartan', 'telmisartan'],
    flag: { decision: 'hold_day_of', severity: 'medium', reason: 'Hold morning of surgery. Same rationale as ACEi — refractory hypotension risk.' },
  },
  {
    match: ['lithium'],
    flag: { decision: 'hold_day_of', severity: 'high', reason: 'Hold 24h pre-op. Risk of toxicity with fluid shifts. Check level pre-op and post-op.' },
  },
  {
    match: ['ocp', 'contraceptive pill', 'hrt', 'oestrogen'],
    flag: { decision: 'hold_5d', severity: 'medium', reason: 'Hold 4–6 weeks before major surgery (VTE risk). Continue for minor/laparoscopic procedures < 30 min with early mobilisation.' },
  },
];

function autoFlagMed(name: string): AutoFlag | null {
  const lower = name.toLowerCase();
  for (const rule of FLAG_RULES) {
    if (rule.match.some(m => lower.includes(m))) return rule.flag;
  }
  return null;
}

function parseMedsFromText(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map(l => l.replace(/[\d.]+\s*(mg|g|mcg|iu|units?|ml|%)[^a-z]*/gi, '').trim())
    .filter(l => l.length > 2);
}

const decisionColor = (d: Decision) => DECISIONS.find(x => x.value === d)?.color ?? '#64748b';
const decisionLabel = (d: Decision) => DECISIONS.find(x => x.value === d)?.label ?? d;

export default function MedicationReconciliationCard() {
  const { medications, medicationsText } = useAppContext();

  const allMeds = useMemo(() => {
    const set = new Set<string>();
    medications.forEach(m => set.add(m));
    parseMedsFromText(medicationsText).forEach(m => set.add(m));
    return [...set];
  }, [medications, medicationsText]);

  const [entries, setEntries] = useState<Record<string, MedEntry>>({});
  const [notes, setNotes] = useState('');

  function getEntry(med: string): MedEntry {
    if (entries[med]) return entries[med];
    const autoFlag = autoFlagMed(med);
    return {
      name: med,
      decision: autoFlag?.decision ?? 'continue',
      note: '',
      autoFlag,
    };
  }

  function setDecision(med: string, decision: Decision) {
    setEntries(prev => ({ ...prev, [med]: { ...getEntry(med), decision } }));
  }

  function setNote(med: string, note: string) {
    setEntries(prev => ({ ...prev, [med]: { ...getEntry(med), note } }));
  }

  const flagged = allMeds.filter(m => autoFlagMed(m) !== null);
  const flagCount = flagged.length;

  if (allMeds.length === 0) {
    return (
      <CollapsibleCard title="Perioperative medication reconciliation" defaultOpen={false}>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>No medications recorded. Add medications above first.</p>
      </CollapsibleCard>
    );
  }

  return (
    <CollapsibleCard
      title="Perioperative medication reconciliation"
      badge={flagCount > 0 ? flagCount : undefined}
      defaultOpen={flagCount > 0}
    >
      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
        Review each medication and set the perioperative plan. Auto-flagged medications are highlighted.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {allMeds.map(med => {
          const entry = getEntry(med);
          const flag = entry.autoFlag;
          const borderColor = flag
            ? flag.severity === 'high' ? '#ef4444' : flag.severity === 'medium' ? '#f59e0b' : '#6366f1'
            : '#e2e8f0';

          return (
            <div
              key={med}
              style={{
                border: `1px solid ${borderColor}`,
                borderLeft: `4px solid ${borderColor}`,
                borderRadius: 8,
                padding: '10px 12px',
                background: flag ? (flag.severity === 'high' ? '#fef2f2' : flag.severity === 'medium' ? '#fffbeb' : '#f0f9ff') : '#fff',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', flex: '1 1 140px' }}>{med}</span>
                <select
                  value={entry.decision}
                  onChange={e => setDecision(med, e.target.value as Decision)}
                  style={{
                    fontSize: 12, padding: '3px 8px', borderRadius: 6,
                    border: `1px solid ${decisionColor(entry.decision)}`,
                    color: decisionColor(entry.decision),
                    background: '#fff', fontWeight: 600,
                  }}
                >
                  {DECISIONS.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              {flag && (
                <div style={{ marginTop: 6, fontSize: 11, color: flag.severity === 'high' ? '#b91c1c' : '#92400e', lineHeight: 1.5 }}>
                  {flag.reason}
                </div>
              )}

              <input
                value={entry.note}
                onChange={e => setNote(med, e.target.value)}
                placeholder="Additional notes (optional)"
                style={{
                  marginTop: 6, width: '100%', fontSize: 11, padding: '4px 8px',
                  border: '1px solid #e2e8f0', borderRadius: 5, background: 'rgba(255,255,255,0.7)',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div style={{ marginTop: 16, padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748b', marginBottom: 8 }}>
          Perioperative plan summary
        </div>
        {allMeds.map(med => {
          const e = getEntry(med);
          return (
            <div key={med} style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 3 }}>
              <span style={{ color: decisionColor(e.decision), fontWeight: 700, whiteSpace: 'nowrap', minWidth: 130 }}>
                {decisionLabel(e.decision)}
              </span>
              <span style={{ color: '#334155' }}>{med}</span>
              {e.note && <span style={{ color: '#64748b' }}>— {e.note}</span>}
            </div>
          );
        })}
        <div className="fld" style={{ marginTop: 10 }}>
          <label style={{ fontSize: 11 }}>Anaesthesia / surgical team notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Bridge anticoagulation arranged. Endocrine consulted re insulin protocol. Patient consented to hold warfarin."
            style={{ minHeight: 70, fontSize: 12 }}
          />
        </div>
      </div>
    </CollapsibleCard>
  );
}
