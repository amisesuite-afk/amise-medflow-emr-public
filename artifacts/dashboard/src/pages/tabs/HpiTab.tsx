import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import SmartTextarea from '@/components/SmartTextarea';

const SOCRATES_PROMPTS = [
  { label: 'Site', hint: 'Where is the problem? Any radiation?' },
  { label: 'Onset', hint: 'When did it start? Sudden or gradual?' },
  { label: 'Character', hint: 'Nature of symptom — dull, sharp, colicky, pressure…' },
  { label: 'Radiation', hint: 'Does it spread anywhere?' },
  { label: 'Associations', hint: 'Other symptoms? Nausea, fever, weight loss, bleeding…' },
  { label: 'Timing', hint: 'Constant or intermittent? Frequency? Getting worse?' },
  { label: 'Exacerbating / relieving', hint: 'What makes it better or worse?' },
  { label: 'Severity', hint: 'Impact on daily life. Previous episodes or treatments.' },
];

export default function HpiTab() {
  const { hpiNotes, setHpiNotes, freeText, durationDays } = useAppContext();

  return (
    <div className="gap-y">
      <CollapsibleCard title="History of present illness" badge={hpiNotes.trim() ? '✓' : undefined}>
        <div className="fld">
          <label>HPI narrative</label>
          <SmartTextarea
            value={hpiNotes}
            onChange={setHpiNotes}
            placeholder={
              'Document the presenting illness in the patient\'s own words and the clinician\'s synthesis.\n\n' +
              'SOCRATES — Site · Onset · Character · Radiation · Associations · Timing · Exacerbating/Relieving · Severity\n\n' +
              'Tip: type .hpi or .hpiabd to expand a template'
            }
            style={{ minHeight: 180, width: '100%' }}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            SOCRATES prompts
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
            {SOCRATES_PROMPTS.map(p => (
              <div key={p.label} style={{ fontSize: 12, color: 'var(--muted)' }}>
                <span style={{ fontWeight: 600, color: 'var(--fg)' }}>{p.label}:</span> {p.hint}
              </div>
            ))}
          </div>
        </div>
      </CollapsibleCard>

      {(freeText.trim() || durationDays) && (
        <CollapsibleCard title="Pre-visit complaint summary" defaultOpen={false}>
          {durationDays && (
            <div style={{ fontSize: 13, marginBottom: 6 }}>
              <span style={{ fontWeight: 600 }}>Duration:</span> {durationDays} days
            </div>
          )}
          {freeText.trim() && (
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', color: 'var(--fg)' }}>{freeText}</div>
          )}
          <p style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
            Patient-entered complaint from triage/intake — incorporate above into the HPI narrative.
          </p>
        </CollapsibleCard>
      )}
    </div>
  );
}
