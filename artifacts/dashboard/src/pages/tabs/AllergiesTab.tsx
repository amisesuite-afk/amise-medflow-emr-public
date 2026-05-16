import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import ChipGroup from '@/components/ChipGroup';

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

  return (
    <div className="gap-y">
      <CollapsibleCard title="Allergies" badge={selected.length || undefined} badgeVariant={selected.length ? 'warn' : 'default'}>
        <ChipGroup options={ALLERGY_CHIPS} selected={selected} onToggle={toggleChip} />
      </CollapsibleCard>

      <CollapsibleCard title="Additional allergies / reactions" defaultOpen={false}>
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
