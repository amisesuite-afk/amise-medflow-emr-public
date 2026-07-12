import { useState } from 'react';
import CollapsibleCard from '@/components/CollapsibleCard';

interface CheckItem { id: string; text: string; critical?: boolean; }
type Phase = 'signin' | 'timeout' | 'signout';

const PHASES: { id: Phase; label: string; subtitle: string; color: string; items: CheckItem[] }[] = [
  {
    id: 'signin', label: 'Sign In', subtitle: 'Before anaesthesia induction',
    color: '#1d4ed8',
    items: [
      { id: 'si1', text: 'Patient has confirmed: identity, site, procedure, consent', critical: true },
      { id: 'si2', text: 'Surgical site marked (or not applicable)' },
      { id: 'si3', text: 'Anaesthesia machine and medication check complete' },
      { id: 'si4', text: 'Pulse oximeter on patient and functioning' },
      { id: 'si5', text: 'Known allergy?', critical: true },
      { id: 'si6', text: 'Difficult airway / aspiration risk assessed?' },
      { id: 'si7', text: 'Risk of >500 mL blood loss (7 mL/kg in children) assessed?' },
    ],
  },
  {
    id: 'timeout', label: 'Time Out', subtitle: 'Before skin incision',
    color: '#7c3aed',
    items: [
      { id: 'to1', text: 'All team members introduce name and role' },
      { id: 'to2', text: 'Surgeon, anaesthesiologist, nurse verbally confirm patient, site, procedure', critical: true },
      { id: 'to3', text: 'Anticipated critical events reviewed:', critical: true },
      { id: 'to3a', text: '  • Surgeon: Critical steps, operative duration, anticipated blood loss' },
      { id: 'to3b', text: '  • Anaesthesia: Patient-specific concerns' },
      { id: 'to3c', text: '  • Nursing: Sterility, equipment, special concerns' },
      { id: 'to4', text: 'Antibiotic prophylaxis given within last 60 min?' },
      { id: 'to5', text: 'Essential imaging displayed?' },
      { id: 'to6', text: 'DVT prophylaxis applied (TED stockings / LMWH)?' },
    ],
  },
  {
    id: 'signout', label: 'Sign Out', subtitle: 'Before patient leaves operating theatre',
    color: '#0f766e',
    items: [
      { id: 'so1', text: 'Nurse verbally confirms procedure performed', critical: true },
      { id: 'so2', text: 'Instrument, sponge, needle count correct (or not applicable)', critical: true },
      { id: 'so3', text: 'Specimen(s) labelled and sent to pathology (or not applicable)' },
      { id: 'so4', text: 'Equipment problems to address?' },
      { id: 'so5', text: 'Key post-op concerns reviewed (recovery, analgesia, ICU/HDU)' },
      { id: 'so6', text: 'Surgeon, anaesthesiologist, nurse sign checklist' },
    ],
  },
];

interface PhaseState { checked: Record<string, boolean>; signedOff: boolean; signedBy: string; signedAt: string; }
type ChecklistState = Record<Phase, PhaseState>;

function empty(): ChecklistState {
  const p: Partial<ChecklistState> = {};
  for (const ph of PHASES) p[ph.id] = { checked: {}, signedOff: false, signedBy: '', signedAt: '' };
  return p as ChecklistState;
}

export default function WhoChecklistTab() {
  const [state, setState] = useState<ChecklistState>(empty);
  const [activePhase, setActivePhase] = useState<Phase>('signin');

  function toggle(phase: Phase, id: string) {
    setState(s => ({
      ...s,
      [phase]: { ...s[phase], checked: { ...s[phase].checked, [id]: !s[phase].checked[id] } },
    }));
  }

  function signOff(phase: Phase) {
    const now = new Date().toLocaleString('en-LC', { timeZone: 'America/St_Lucia', dateStyle: 'medium', timeStyle: 'short' });
    setState(s => ({
      ...s,
      [phase]: { ...s[phase], signedOff: true, signedAt: now },
    }));
  }

  const overallComplete = PHASES.every(ph => state[ph.id].signedOff);

  return (
    <div className="gap-y">
      {/* Header */}
      <div style={{ background: '#0f172a', borderRadius: 10, padding: '16px 20px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>WHO Surgical Safety Checklist</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Based on WHO 2009 Guidelines — all three phases must be completed</div>
        </div>
        {overallComplete && (
          <span style={{ background: '#065f46', color: '#6ee7b7', borderRadius: 6, padding: '4px 12px', fontWeight: 700, fontSize: 12 }}>✓ Complete</span>
        )}
      </div>

      {/* Phase tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {PHASES.map(ph => {
          const ps = state[ph.id];
          const total = ph.items.length;
          const done = ph.items.filter(i => ps.checked[i.id]).length;
          return (
            <button key={ph.id} type="button" onClick={() => setActivePhase(ph.id)}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 8, border: `2px solid ${activePhase === ph.id ? ph.color : '#e2e8f0'}`,
                background: activePhase === ph.id ? ph.color : '#fff', color: activePhase === ph.id ? '#fff' : '#334155',
                cursor: 'pointer', textAlign: 'left',
              }}>
              <div style={{ fontWeight: 700, fontSize: 12 }}>{ph.label}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{ph.subtitle}</div>
              <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600 }}>
                {ps.signedOff ? '✓ Signed off' : `${done}/${total} items`}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active phase */}
      {PHASES.filter(ph => ph.id === activePhase).map(ph => {
        const ps = state[ph.id];
        const allChecked = ph.items.every(i => ps.checked[i.id]);
        return (
          <CollapsibleCard key={ph.id} title={`${ph.label} — ${ph.subtitle}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ph.items.map(item => (
                <label key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: ps.signedOff ? 'default' : 'pointer', padding: '6px 8px', borderRadius: 6, background: ps.checked[item.id] ? '#f0fdf4' : 'transparent', border: `1px solid ${ps.checked[item.id] ? '#86efac' : '#f1f5f9'}` }}>
                  <input
                    type="checkbox"
                    checked={!!ps.checked[item.id]}
                    onChange={() => !ps.signedOff && toggle(ph.id, item.id)}
                    disabled={ps.signedOff}
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 13, color: item.critical ? '#1e293b' : '#475569', fontWeight: item.critical ? 600 : 400 }}>
                    {item.critical && <span style={{ color: '#ef4444', marginRight: 4 }}>*</span>}
                    {item.text}
                  </span>
                </label>
              ))}
            </div>

            {!ps.signedOff ? (
              <button
                type="button"
                onClick={() => signOff(ph.id)}
                disabled={!allChecked}
                style={{ marginTop: 12, width: '100%', padding: '9px', borderRadius: 7, border: 'none', background: allChecked ? ph.color : '#d1d5db', color: '#fff', fontWeight: 700, fontSize: 13, cursor: allChecked ? 'pointer' : 'default' }}
              >
                {allChecked ? `Sign off ${ph.label}` : `Complete all items to sign off`}
              </button>
            ) : (
              <div style={{ marginTop: 12, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 7, fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                ✓ Signed off · {ps.signedAt}
              </div>
            )}
          </CollapsibleCard>
        );
      })}
    </div>
  );
}
