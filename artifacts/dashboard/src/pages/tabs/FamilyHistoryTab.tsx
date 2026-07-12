import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import ChipGroup from '@/components/ChipGroup';

const FAMILY_HISTORY_OPTIONS = [
  'Colorectal cancer', 'Breast cancer', 'Ovarian cancer', 'Gastric cancer',
  'Pancreatic cancer', 'Prostate cancer', 'Cardiovascular disease',
  'Diabetes', 'BRCA mutation', 'Lynch syndrome',
];

export default function FamilyHistoryTab() {
  const {
    familyHistory, toggleFamilyHistory,
    familyHistoryNotes, setFamilyHistoryNotes,
  } = useAppContext();

  return (
    <div className="gap-y">
      <CollapsibleCard title="Family history" badge={familyHistory.length || undefined}>
        <ChipGroup options={FAMILY_HISTORY_OPTIONS} selected={familyHistory} onToggle={toggleFamilyHistory} />
        <div className="fld" style={{ marginTop: 10 }}>
          <label>Family history notes</label>
          <textarea
            value={familyHistoryNotes}
            onChange={e => setFamilyHistoryNotes(e.target.value)}
            placeholder="e.g. Mother — colorectal cancer age 58; Father — type 2 diabetes; Maternal uncle — Lynch syndrome…"
            style={{ minHeight: 90 }}
          />
        </div>
        {familyHistory.some(h => ['Colorectal cancer', 'Breast cancer', 'Ovarian cancer', 'BRCA mutation', 'Lynch syndrome'].includes(h)) && (
          <p style={{ marginTop: 8, fontSize: 12, color: '#92400e' }}>
            Hereditary cancer risk identified — consider genetic counselling referral and surveillance protocol.
          </p>
        )}
      </CollapsibleCard>
    </div>
  );
}
