import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import ChipGroup from '@/components/ChipGroup';

const TOXIC_OPTIONS = [
  'Current smoker', 'Ex-smoker (< 10 years)', 'Ex-smoker (> 10 years)',
  'Heavy alcohol use (> 14 units/wk)', 'Moderate alcohol (7–14 units/wk)', 'Social / occasional alcohol',
  'Vaping / e-cigarette', 'Cannabis use',
  'Recreational drug use (unspecified)', 'Cocaine / crack cocaine',
  'Opioid misuse', 'Intravenous drug use (IVDU)',
  'Khat use', 'Betel nut chewing',
  'High caffeine intake', 'No toxic habits',
];

export default function ToxicHabitsTab() {
  const { toxicHabits, toggleToxicHabit, occupation, setOccupation } = useAppContext();

  return (
    <div className="gap-y">
      <CollapsibleCard title="Occupation" badge={occupation.trim() ? '✓' : undefined}>
        <div className="fld">
          <label>Occupation / employment</label>
          <input
            type="text"
            value={occupation}
            onChange={e => setOccupation(e.target.value)}
            placeholder="e.g. Nurse, retired teacher, manual labourer, self-employed…"
          />
        </div>
        <p style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
          Relevant to occupational exposures, physical demands, and sick-leave planning.
        </p>
      </CollapsibleCard>

      <CollapsibleCard title="Substance use / toxic habits" badge={toxicHabits.length || undefined}>
        <ChipGroup options={TOXIC_OPTIONS} selected={toxicHabits} onToggle={toggleToxicHabit} />
        {toxicHabits.includes('Current smoker') && (
          <p style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
            Document pack-year history and offer smoking cessation advice (pre-op if applicable).
          </p>
        )}
        {toxicHabits.some(h => h.includes('alcohol')) && (
          <p style={{ marginTop: 8, fontSize: 12, color: '#92400e' }}>
            Heavy alcohol use: consider CAGE / AUDIT score, liver function, and peri-operative alcohol cessation counselling.
          </p>
        )}
        {toxicHabits.includes('Intravenous drug use (IVDU)') && (
          <p style={{ marginTop: 8, fontSize: 12, color: '#7c3aed' }}>
            IVDU: check BBV status (HIV, HBV, HCV), venous access assessment, harm-reduction referral.
          </p>
        )}
      </CollapsibleCard>
    </div>
  );
}
