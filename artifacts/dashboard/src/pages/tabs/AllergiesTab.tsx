import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import ChipGroup from '@/components/ChipGroup';
import NarrativeInput from '@/components/NarrativeInput';
import { allergyStatus } from '@/lib/allergy-status';

const ALLERGY_CHIPS = [
  'Penicillin / amoxicillin', 'Cephalosporins', 'Sulfonamides / Bactrim',
  'NSAIDs / aspirin', 'Codeine / opioids', 'Morphine',
  'Contrast dye / iodine', 'Latex', 'Nickel',
  'Nuts / peanuts', 'Shellfish', 'Eggs',
  'Chlorhexidine', 'Adhesives / plasters', 'No known allergies',
];

export default function AllergiesTab() {
  const { allergies, setAllergies } = useAppContext();
  const selected = allergies ? allergies.split(',').map(s => s.trim()).filter(Boolean) : [];

  function toggleChip(v: string) {
    const cur = allergies ? allergies.split(',').map(s => s.trim()).filter(Boolean) : [];
    const next = cur.includes(v) ? cur.filter(s => s !== v) : [...cur, v];
    setAllergies(next.join(', '));
  }

  function handleAllergiesParsed(data: Record<string, unknown>) {
    const allergiesStr = data.allergies as string | undefined;
    if (allergiesStr) setAllergies(allergiesStr);
  }

  const status = allergyStatus(allergies);

  return (
    <div className="gap-y">
      {/* Allergy status — an empty field is "not recorded", never NKDA. */}
      <div
        data-testid="allergy-status"
        style={{
          padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          ...(status.kind === 'not_recorded'
            ? { background: '#fffbeb', border: '1px solid #fcd34d', color: '#92400e' }
            : status.kind === 'nkda'
              ? { background: '#f0fdf4', border: '1px solid #86efac', color: '#166534' }
              : { background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b' }),
        }}
      >
        {status.kind === 'not_recorded' && 'Allergies: not recorded — record allergies, or tap "No known allergies" once you have asked.'}
        {status.kind === 'nkda' && 'No known drug allergies (NKDA) — recorded.'}
        {status.kind === 'recorded' && (status.conflictsWithNkda
          ? `⚠ "No known allergies" is marked but allergies are also recorded (${status.allergies.join(', ')}). Remove one to reconcile.`
          : `⚠ Allergies recorded: ${status.allergies.join(', ')}`)}
      </div>

      <NarrativeInput
        section="allergies"
        placeholder="Dictate or paste allergy history — e.g. 'Allergic to penicillin, developed anaphylaxis in 2015. Also intolerant to NSAIDs — causes GI bleeding. Contrast dye — urticaria. No other known allergies.'"
        onParsed={handleAllergiesParsed}
        label="Dictate allergies — AI will extract and format the allergy record"
        minHeight={80}
      />

      <CollapsibleCard title="Allergies" badge={selected.length || undefined} badgeVariant={selected.length ? 'warn' : 'default'}>
        <ChipGroup options={ALLERGY_CHIPS} selected={selected} onToggle={toggleChip} />
      </CollapsibleCard>

      <CollapsibleCard title="Additional allergies / reactions" defaultOpen>
        <div className="fld">
          <label>Comma-separated list of allergens and reactions</label>
          <textarea
            value={allergies}
            onChange={e => setAllergies(e.target.value)}
            placeholder="e.g. Penicillin (rash), Contrast dye (anaphylaxis), Latex (urticaria)…"
            style={{ minHeight: 80 }}
          />
        </div>
      </CollapsibleCard>
    </div>
  );
}
