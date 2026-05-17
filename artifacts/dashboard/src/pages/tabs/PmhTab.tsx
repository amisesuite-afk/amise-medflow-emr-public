import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import ChipGroup from '@/components/ChipGroup';

const COMORBIDITY_OPTIONS = [
  'Type 1 diabetes', 'Type 2 diabetes', 'Hypertension', 'Ischaemic heart disease',
  'Atrial fibrillation', 'Heart failure', 'Chronic kidney disease', 'Dialysis',
  'Stroke / TIA', 'COPD / asthma', 'Active cancer', 'Prior cancer',
  'Chemotherapy / immunotherapy', 'Steroid use', 'Immunosuppressed',
  'Liver cirrhosis', 'Hepatitis B / C', 'HIV', 'Thyroid disease',
  'Peripheral vascular disease', 'DVT / PE history', 'Obesity', 'Sleep apnoea',
  'Anxiety / depression', 'Sickle cell disease',
];

const FAMILY_HISTORY_OPTIONS = [
  'Colorectal cancer', 'Breast cancer', 'Ovarian cancer', 'Gastric cancer',
  'Pancreatic cancer', 'Prostate cancer', 'Cardiovascular disease',
  'Diabetes', 'BRCA mutation', 'Lynch syndrome',
];

export default function PmhTab() {
  const {
    comorbidities, toggleComorbidity, pmhNotes, setPmhNotes,
    familyHistory, toggleFamilyHistory, familyHistoryNotes, setFamilyHistoryNotes,
  } = useAppContext();

  return (
    <div className="gap-y">
      <CollapsibleCard title="Past medical history" badge={comorbidities.length || undefined}>
        <ChipGroup options={COMORBIDITY_OPTIONS} selected={comorbidities} onToggle={toggleComorbidity} />
        {comorbidities.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
            Selected: {comorbidities.join(', ')}
          </div>
        )}
      </CollapsibleCard>

      <CollapsibleCard
        title="Family history"
        badge={familyHistory.length || undefined}
        defaultOpen={false}
      >
        <ChipGroup options={FAMILY_HISTORY_OPTIONS} selected={familyHistory} onToggle={toggleFamilyHistory} />
        <div className="fld" style={{ marginTop: 10 }}>
          <label>Family history notes</label>
          <textarea
            value={familyHistoryNotes}
            onChange={e => setFamilyHistoryNotes(e.target.value)}
            placeholder="e.g. Mother — colorectal cancer age 58; Father — type 2 diabetes…"
            style={{ minHeight: 70 }}
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="PMH notes / additional history" defaultOpen={false}>
        <div className="fld">
          <label>Free-text PMH</label>
          <textarea
            value={pmhNotes}
            onChange={e => setPmhNotes(e.target.value)}
            placeholder="Any additional past medical history, relevant diagnoses, social history, or chronic conditions…"
            style={{ minHeight: 120 }}
          />
        </div>
      </CollapsibleCard>
    </div>
  );
}
