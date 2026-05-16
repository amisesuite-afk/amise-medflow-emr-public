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
  const { comorbidities, toggleComorbidity, pmhNotes, setPmhNotes } = useAppContext();

  return (
    <div className="gap-y">
      <CollapsibleCard title="Past medical history" badge={comorbidities.length || undefined}>
        <ChipGroup options={COMORBIDITY_OPTIONS} selected={comorbidities} onToggle={toggleComorbidity} />
      </CollapsibleCard>

      <CollapsibleCard title="Family history" defaultOpen={false}>
        <ChipGroup options={FAMILY_HISTORY_OPTIONS} selected={[]} onToggle={() => {}} />
        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Family history chips are for documentation only and do not feed into the triage score in this build.</p>
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
