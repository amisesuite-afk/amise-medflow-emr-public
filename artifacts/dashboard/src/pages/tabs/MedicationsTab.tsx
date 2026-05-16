import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import ChipGroup from '@/components/ChipGroup';

const MEDICATION_OPTIONS = [
  'Aspirin', 'Clopidogrel', 'Ticagrelor', 'Prasugrel',
  'Warfarin', 'Rivaroxaban / Xarelto', 'Apixaban / Eliquis', 'Dabigatran / Pradaxa',
  'Heparin (IV)', 'Enoxaparin / Clexane',
  'Insulin (any)', 'Metformin', 'Gliclazide / Diamicron', 'Glibenclamide',
  'SGLT2 inhibitor (gliflozin)', 'DPP-4 inhibitor (gliptin)',
  'ACE inhibitor', 'ARB', 'Beta-blocker', 'Calcium channel blocker',
  'Statin', 'Furosemide / diuretic',
  'NSAIDs / ibuprofen / diclofenac', 'Prednisolone / steroids',
  'Methotrexate', 'Azathioprine', 'Mycophenolate',
  'Chemotherapy agent', 'Immunotherapy / checkpoint inhibitor',
  'PPI / omeprazole', 'H2 blocker',
  'OCP / contraceptive pill', 'HRT / oestrogen',
  'Antidepressant (SSRI/SNRI)', 'Antipsychotic',
  'Antibiotics (current)', 'Antifungals',
  'Herbal / traditional medicine',
];

export default function MedicationsTab() {
  const { medications, toggleMedication, medicationsText, setMedicationsText } = useAppContext();

  return (
    <div className="gap-y">
      <CollapsibleCard title="Current medications" badge={medications.length || undefined}>
        <ChipGroup options={MEDICATION_OPTIONS} selected={medications} onToggle={toggleMedication} />
      </CollapsibleCard>

      <CollapsibleCard title="Full medication list (free text)" defaultOpen={false}>
        <div className="fld">
          <label>Enter additional medications, doses, or frequencies</label>
          <textarea
            value={medicationsText}
            onChange={e => setMedicationsText(e.target.value)}
            placeholder="e.g. Metformin 500mg BD, Ramipril 5mg OD, Atorvastatin 40mg ON…"
            style={{ minHeight: 120 }}
          />
        </div>
      </CollapsibleCard>
    </div>
  );
}
