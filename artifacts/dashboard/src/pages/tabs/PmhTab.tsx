import { useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/components/ToastProvider';
import { savePMHItem, removePMHItem, savePmhNotes } from '@/lib/db';
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

export default function PmhTab() {
  const {
    patientId, encounterId,
    comorbidities, toggleComorbidity,
    pmhNotes, setPmhNotes,
  } = useAppContext();
  const { showToast } = useToast();

  // Debounce timers for notes save-on-blur
  const pmhNotesTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track notes at last save to avoid redundant calls
  const savedPmhNotes  = useRef(pmhNotes);

  // ── Chip toggle — optimistic UI + DB sync ──────────────────────────────────

  async function handleToggleComorbidity(condition: string) {
    const wasSelected = comorbidities.includes(condition);

    // 1. Optimistic update
    toggleComorbidity(condition);

    // 2. If no patient saved yet, skip DB silently
    if (!patientId) return;

    // 3. DB call
    const { error } = wasSelected
      ? await removePMHItem(patientId, condition)
      : await savePMHItem(patientId, encounterId, condition);

    if (error) {
      // Revert optimistic update
      toggleComorbidity(condition);
      showToast(`Failed to update PMH: ${error}`, 'error');
    }
  }

  // ── Notes — save on blur, debounced 1 s ───────────────────────────────────

  function scheduleSave() {
    if (!patientId) return;
    if (pmhNotesTimer.current) clearTimeout(pmhNotesTimer.current);
    pmhNotesTimer.current = setTimeout(async () => {
      if (!patientId) return;
      if (pmhNotes === savedPmhNotes.current) return;
      const { error } = await savePmhNotes(patientId, pmhNotes, '');
      if (error) {
        showToast(`Failed to save PMH notes: ${error}`, 'error');
      } else {
        savedPmhNotes.current = pmhNotes;
      }
    }, 1000);
  }

  return (
    <div className="gap-y">
      <CollapsibleCard title="Past medical history" badge={comorbidities.length || undefined}>
        <ChipGroup
          options={COMORBIDITY_OPTIONS}
          selected={comorbidities}
          onToggle={condition => void handleToggleComorbidity(condition)}
        />
        {comorbidities.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
            Selected: {comorbidities.join(', ')}
          </div>
        )}
        {!patientId && comorbidities.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)', fontStyle: 'italic' }}>
            Save the patient first to persist PMH selections to the database.
          </div>
        )}
      </CollapsibleCard>

      <CollapsibleCard title="PMH notes / additional history" defaultOpen={false}>
        <div className="fld">
          <label>Free-text PMH</label>
          <textarea
            value={pmhNotes}
            onChange={e => setPmhNotes(e.target.value)}
            onBlur={scheduleSave}
            placeholder="Any additional past medical history, relevant diagnoses, social history, or chronic conditions…"
            style={{ minHeight: 120 }}
          />
        </div>
      </CollapsibleCard>
    </div>
  );
}
