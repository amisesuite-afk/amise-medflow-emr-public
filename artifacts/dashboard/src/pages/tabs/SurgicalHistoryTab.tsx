import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import ChipGroup from '@/components/ChipGroup';

const SURGICAL_OPTIONS = [
  'Laparoscopic cholecystectomy', 'Open cholecystectomy', 'ERCP',
  'Appendicectomy', 'Right hemicolectomy', 'Left hemicolectomy',
  'Anterior resection', 'Hartmann\'s procedure', 'Loop ileostomy',
  'Inguinal hernia repair', 'Umbilical hernia repair', 'Incisional hernia repair',
  'C-section', 'Hysterectomy', 'Oophorectomy',
  'Breast lumpectomy', 'Mastectomy', 'Sentinel node biopsy',
  'Upper GI endoscopy', 'Colonoscopy', 'Gastroscopy',
  'Laparotomy', 'Pancreatectomy / Whipple\'s', 'Liver resection',
  'Bowel resection', 'Splenectomy', 'Thyroidectomy',
  'Amputation', 'Vascular bypass', 'Angioplasty / stent',
  'Debridement', 'Wound VAC', 'Perforated ulcer repair',
];

export default function SurgicalHistoryTab() {
  const { surgicalHistory, toggleSurgical, surgicalNotes, setSurgicalNotes } = useAppContext();

  return (
    <div className="gap-y">
      <CollapsibleCard title="Surgical history" badge={surgicalHistory.length || undefined}>
        <ChipGroup options={SURGICAL_OPTIONS} selected={surgicalHistory} onToggle={toggleSurgical} />
      </CollapsibleCard>

      <CollapsibleCard title="Surgical notes / dates" defaultOpen={false}>
        <div className="fld">
          <label>Notes (procedure dates, complications, anaesthetic issues…)</label>
          <textarea
            value={surgicalNotes}
            onChange={e => setSurgicalNotes(e.target.value)}
            placeholder="e.g. Lap chole 12 Mar 2024 — uncomplicated. Known difficult airway."
            style={{ minHeight: 120 }}
          />
        </div>
      </CollapsibleCard>
    </div>
  );
}
