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

function weeksAgo(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 7));
}

export default function SurgicalHistoryTab() {
  const {
    surgicalHistory, toggleSurgical,
    surgicalNotes, setSurgicalNotes,
    recentSurgeryDate, setRecentSurgeryDate,
  } = useAppContext();

  const weeks = weeksAgo(recentSurgeryDate);
  const isWithin6Weeks = weeks !== null && weeks < 6;
  const isPostOpWindow = weeks !== null && weeks >= 6 && weeks < 12;

  return (
    <div className="gap-y">
      <CollapsibleCard title="Surgical history" badge={surgicalHistory.length || undefined}>
        <ChipGroup options={SURGICAL_OPTIONS} selected={surgicalHistory} onToggle={toggleSurgical} />
      </CollapsibleCard>

      <CollapsibleCard title="Surgical notes / dates" defaultOpen={false}>
        <div className="fld" style={{ marginBottom: 12 }}>
          <label>Most recent surgery date</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="date"
              value={recentSurgeryDate}
              onChange={e => setRecentSurgeryDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              style={{
                padding: '6px 10px', borderRadius: 6, border: '1px solid #374151',
                background: '#1e2330', color: '#e2e8f0', fontSize: 13, flex: 1,
              }}
            />
            {isWithin6Weeks && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                background: '#fef3c7', color: '#92400e', border: '1px solid #fbbf24',
                whiteSpace: 'nowrap',
              }}>
                🩹 {weeks}w post-op — wound exam auto-added
              </span>
            )}
            {isPostOpWindow && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999,
                background: '#f0f9ff', color: '#0369a1', border: '1px solid #7dd3fc',
                whiteSpace: 'nowrap',
              }}>
                {weeks}w post-op
              </span>
            )}
          </div>
        </div>

        <div className="fld">
          <label>Notes (procedure details, complications, anaesthetic issues…)</label>
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
