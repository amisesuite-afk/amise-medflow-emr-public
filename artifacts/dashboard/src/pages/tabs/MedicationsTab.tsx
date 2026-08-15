import { useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import ChipGroup from '@/components/ChipGroup';
import NarrativeInput from '@/components/NarrativeInput';
import DrugInteractionAlert from '@/components/DrugInteractionAlert';
import AllergyMedAlert from '@/components/AllergyMedAlert';
import AiInteractionCheck from '@/components/AiInteractionCheck';
import MedicationReconciliationCard from '@/components/MedicationReconciliationCard';

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
  const { medications, toggleMedication, medicationsText, setMedicationsText, allergies } = useAppContext();

  function handleMedsParsed(data: Record<string, unknown>) {
    const matched = (data.matched as string[] | undefined) ?? [];
    const medText = data.medicationsText as string | undefined;
    matched.forEach(med => {
      if (!medications.includes(med)) toggleMedication(med);
    });
    if (medText) setMedicationsText(medText);
  }

  const aiCheckDrugs = useMemo(() => [
    ...medications.map(m => ({ drugName: m })),
    ...medicationsText.split(/[\n,;]+/).map(m => m.trim()).filter(Boolean).map(m => ({ drugName: m })),
  ], [medications, medicationsText]);

  return (
    <div className="gap-y">
      <NarrativeInput
        section="medications"
        chipOptions={MEDICATION_OPTIONS}
        placeholder="Dictate or paste the full medication list as given or previously documented — e.g. 'Ramipril 10mg once daily, Metformin 850mg twice daily, Aspirin 75mg once daily, Atorvastatin 40mg at night, Levothyroxine 50 micrograms once daily…'"
        onParsed={handleMedsParsed}
        label="Dictate medications — AI will select categories and populate the list"
        minHeight={100}
      />

      <AllergyMedAlert allergies={allergies} medications={medications} medicationsText={medicationsText} />
      <DrugInteractionAlert medications={medications} medicationsText={medicationsText} />
      <AiInteractionCheck drugs={aiCheckDrugs} />
      <CollapsibleCard title="Current medications" badge={medications.length || undefined}>
        <ChipGroup options={MEDICATION_OPTIONS} selected={medications} onToggle={toggleMedication} />
      </CollapsibleCard>

      <CollapsibleCard title="Full medication list (free text)" defaultOpen>
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
      <MedicationReconciliationCard />
    </div>
  );
}
