import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

interface CheckItem {
  id: string;
  label: string;
  detail?: string;
  critical: boolean;
  signed: boolean;
  note: string;
  signedBy: string;
  signedAt: string;
}

function makeItem(id: string, label: string, detail: string, critical = false): CheckItem {
  return { id, label, detail, critical, signed: false, note: '', signedBy: '', signedAt: '' };
}

const PATIENT_ITEMS: CheckItem[] = [
  makeItem('consent_signed',   'Signed consent form present in notes',          'Confirm the consent form is signed, dated, and witnessed. Procedure name must match operative list.', true),
  makeItem('id_verified',      'Patient identity verified (2 identifiers)',      'Name + DOB confirmed verbally and against wristband. Match to consent and operative list.', true),
  makeItem('site_marked',      'Operation site marked (if applicable)',          'Surgeon has marked operative site in the presence of the patient. Mark visible through drapes.', true),
  makeItem('allergies_checked','Allergies confirmed and documented',             'NKDA or specific allergies confirmed. Alert band on wristband if applicable.', true),
  makeItem('fasting_confirmed','Fasting status confirmed',                       'Minimum 6h food, 2h clear fluids. If non-fasted: discuss with anaesthetist.', true),
  makeItem('pre_meds_given',   'Pre-operative medications given',                'Confirm patient took regular morning medications as per anaesthetist plan. Verify omissions (metformin, ACEi, anticoagulants).'),
  makeItem('iv_access',        'IV access secured',                              'Patent IV cannula. Size adequate for procedure (≥18G for major surgery). Flush confirmed.', true),
  makeItem('blood_group',      'Blood group and cross-match (if ordered)',       'Confirm sample sent. Units available for major procedures. G&S verified if requested.'),
  makeItem('pregnancy_test',   'Pregnancy test (if applicable)',                 'For women of childbearing age: urine or serum beta-hCG result documented and reviewed.'),
  makeItem('valuables_removed','Valuables removed / prosthetics noted',          'Jewellery, hearing aids, contact lenses, dentures, nail polish removed. Prosthetic limbs documented.'),
  makeItem('gown_stocking',    'Surgical gown and TED stockings applied',        'Patient in gown. TED stockings applied if ordered. Sequential compression device (IPC) to theatre if ordered.'),
  makeItem('pmh_reviewed',     'PMH, medications, and relevant comorbidities reviewed', 'Anaesthetist and surgeon aware of key comorbidities (cardiac, respiratory, renal, DM, anticoagulation).'),
  makeItem('investigations_ok','Pre-op investigations reviewed',                 'ECG, bloods, CXR (if ordered) reviewed. Abnormal results communicated to anaesthetist and surgeon.', true),
  makeItem('vte_plan',         'VTE prophylaxis plan confirmed',                 'LMWH prescribed / given. TED stockings applied. IPC device available in theatre.'),
  makeItem('antibiotic_timing','Prophylactic antibiotics prescribed and timed',  'First dose due within 60 min of incision. Confirm drug, dose, timing, allergies.', true),
];

const THEATRE_ITEMS: CheckItem[] = [
  makeItem('anaesthetist_ready',   'Anaesthetist present and equipment checked', 'Anaesthetic machine checked. Emergency equipment available.', true),
  makeItem('correct_position',     'Correct patient position confirmed',         'Position matches operative plan. Pressure points padded. Arms secured safely.', true),
  makeItem('diathermy_safe',       'Diathermy / electrosurgery set up safely',   'Patient plate positioned correctly. Neutral electrode on dry, non-bony area. Device tested.'),
  makeItem('imaging_displayed',    'Relevant imaging displayed',                 'Radiographs, CT, MRI displayed in theatre as needed.'),
  makeItem('scrub_team_ready',     'Scrub team briefed',                         'Team briefed on procedure, special equipment, implants, anticipated difficulties.'),
  makeItem('timeout_complete',     'WHO Time Out completed',                     'Team pause completed: patient, procedure, site, consent, antibiotic timing, anticipated duration and blood loss.', true),
  makeItem('specimen_labels',      'Specimen containers and labels prepared',    'Labels match patient ID. Histology forms filled. Relevant containers for intraoperative specimens ready.'),
];

const RECOVERY_ITEMS: CheckItem[] = [
  makeItem('handover_given',    'Verbal handover to recovery nurse',         'Procedure performed, anaesthesia type, blood loss, drains, post-op plan, analgesia, observations required.', true),
  makeItem('op_note_complete',  'Operative note written / dictated',         'Operative note in medical record before patient leaves recovery.', true),
  makeItem('prescriptions_done','Post-op prescriptions written',             'Analgesia, antiemetics, DVT prophylaxis, antibiotic continuation, IV fluids, wound care.', true),
  makeItem('drain_documented',  'Drain output and management plan documented','Drain type, site, starting output documented. Instructions for nurse re: drain management.'),
  makeItem('specimen_sent',     'Specimens sent to pathology',               'All specimens labelled, in appropriate container, request form completed.'),
  makeItem('patient_stable',    'Patient haemodynamically stable for ward',   'Airway maintained, SpO2 >94%, pain controlled, no active bleeding, urine output adequate.', true),
  makeItem('family_informed',   'Relative / next of kin informed',           'Outcome discussed with patient\'s nominated contact.'),
];

interface Phase {
  id: string;
  label: string;
  items: CheckItem[];
  signedOff: boolean;
  signedAt: string;
  signedBy: string;
}

export default function PreopDayChecklist() {
  const { patientName, dob, assessment, plan } = useAppContext();

  const [phases, setPhases] = useState<Phase[]>([
    { id: 'patient',  label: 'Pre-operative (ward / admission)', items: PATIENT_ITEMS.map(i => ({ ...i })), signedOff: false, signedAt: '', signedBy: '' },
    { id: 'theatre',  label: 'Theatre (before induction)',       items: THEATRE_ITEMS.map(i => ({ ...i })), signedOff: false, signedAt: '', signedBy: '' },
    { id: 'recovery', label: 'Post-operative (recovery)',        items: RECOVERY_ITEMS.map(i => ({ ...i })), signedOff: false, signedAt: '', signedBy: '' },
  ]);

  const [activePhase, setActivePhase] = useState(0);
  const [signerName, setSignerName] = useState('Dr Dawit Daniel Kabiye');

  function toggleItem(phaseIdx: number, itemId: string) {
    setPhases(prev => prev.map((p, pi) => {
      if (pi !== phaseIdx) return p;
      return {
        ...p,
        items: p.items.map(item => {
          if (item.id !== itemId) return item;
          const now = new Date().toLocaleTimeString('en-LC', { timeZone: 'America/St_Lucia', hour: '2-digit', minute: '2-digit' });
          return item.signed
            ? { ...item, signed: false, signedBy: '', signedAt: '' }
            : { ...item, signed: true, signedBy: signerName, signedAt: now };
        }),
      };
    }));
  }

  function updateNote(phaseIdx: number, itemId: string, note: string) {
    setPhases(prev => prev.map((p, pi) => {
      if (pi !== phaseIdx) return p;
      return { ...p, items: p.items.map(item => item.id === itemId ? { ...item, note } : item) };
    }));
  }

  function signOffPhase(phaseIdx: number) {
    const phase = phases[phaseIdx];
    const critical = phase.items.filter(i => i.critical && !i.signed);
    if (critical.length > 0) {
      alert(`Cannot sign off: ${critical.length} critical item${critical.length > 1 ? 's' : ''} not completed:\n${critical.map(i => `• ${i.label}`).join('\n')}`);
      return;
    }
    const now = new Date().toLocaleString('en-LC', { timeZone: 'America/St_Lucia', dateStyle: 'short', timeStyle: 'short' });
    setPhases(prev => prev.map((p, pi) => pi === phaseIdx ? { ...p, signedOff: true, signedAt: now, signedBy: signerName } : p));
  }

  const totalItems = phases.reduce((s, p) => s + p.items.length, 0);
  const completedItems = phases.reduce((s, p) => s + p.items.filter(i => i.signed).length, 0);
  const criticalUnchecked = phases.reduce((s, p) => s + p.items.filter(i => i.critical && !i.signed).length, 0);
  const badge = criticalUnchecked > 0 ? `${criticalUnchecked} critical` : completedItems > 0 ? `${completedItems}/${totalItems}` : undefined;

  return (
    <CollapsibleCard
      title="Pre-operative day checklist"
      badge={badge}
      defaultOpen={false}
    >
      {/* Patient header */}
      {(patientName || dob) && (
        <div style={{ padding: '7px 12px', background: '#f1f5f9', borderRadius: 6, marginBottom: 12, fontSize: 12, display: 'flex', gap: 16 }}>
          {patientName && <span><strong>Patient:</strong> {patientName}</span>}
          {dob && <span><strong>DOB:</strong> {dob}</span>}
          {assessment && <span><strong>Procedure:</strong> {assessment.split('\n')[0].slice(0, 80)}</span>}
        </div>
      )}

      {/* Signer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>Signing as:</label>
        <input value={signerName} onChange={e => setSignerName(e.target.value)}
          style={{ flex: 1, fontSize: 12, padding: '5px 10px', border: '1px solid #d1d5db', borderRadius: 6 }} />
      </div>

      {/* Phase selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
        {phases.map((p, i) => {
          const done = p.items.filter(x => x.signed).length;
          const crit = p.items.filter(x => x.critical && !x.signed).length;
          return (
            <button key={p.id} type="button" onClick={() => setActivePhase(i)}
              style={{
                padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${activePhase === i ? '#0f172a' : crit > 0 ? '#fca5a5' : '#e2e8f0'}`,
                background: activePhase === i ? '#0f172a' : p.signedOff ? '#f0fdf4' : '#fff',
                color: activePhase === i ? '#fff' : p.signedOff ? '#15803d' : '#374151',
              }}>
              {p.signedOff ? '✓ ' : crit > 0 ? '⚠ ' : ''}{p.label}
              <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.8 }}>({done}/{p.items.length})</span>
            </button>
          );
        })}
      </div>

      {/* Active phase items */}
      {phases[activePhase] && (() => {
        const phase = phases[activePhase];
        return (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {phase.items.map(item => (
                <div key={item.id}
                  style={{
                    border: `1px solid ${item.signed ? '#86efac' : item.critical ? '#fca5a5' : '#e2e8f0'}`,
                    borderLeft: `4px solid ${item.signed ? '#16a34a' : item.critical ? '#ef4444' : '#d1d5db'}`,
                    borderRadius: 7, overflow: 'hidden',
                  }}>
                  <label style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer',
                    padding: '9px 12px',
                    background: item.signed ? '#f0fdf4' : item.critical ? '#fef2f2' : '#fff',
                  }}>
                    <input type="checkbox" checked={item.signed}
                      onChange={() => toggleItem(activePhase, item.id)}
                      style={{ marginTop: 2, width: 15, height: 15, accentColor: '#16a34a', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{item.label}</span>
                        {item.critical && !item.signed && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '1px 6px', borderRadius: 10 }}>CRITICAL</span>
                        )}
                        {item.signed && item.signedAt && (
                          <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>✓ {item.signedBy} {item.signedAt}</span>
                        )}
                      </div>
                      {item.detail && (
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, lineHeight: 1.4 }}>{item.detail}</div>
                      )}
                    </div>
                  </label>
                  {/* Note field — always shown, collapses visually */}
                  <div style={{ padding: '0 12px 8px', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      value={item.note}
                      onChange={e => updateNote(activePhase, item.id, e.target.value)}
                      placeholder="Note / deviation…"
                      style={{ flex: 1, fontSize: 11, padding: '3px 8px', border: '1px solid #e2e8f0', borderRadius: 4 }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Sign off button */}
            {!phase.signedOff ? (
              <button type="button" onClick={() => signOffPhase(activePhase)}
                style={{
                  marginTop: 14, width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: '#0f172a', color: '#fff', border: 'none', cursor: 'pointer',
                }}>
                Sign off — {phase.label}
              </button>
            ) : (
              <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', fontSize: 13, fontWeight: 600, color: '#15803d' }}>
                ✓ Phase signed off by {phase.signedBy} at {phase.signedAt}
              </div>
            )}
          </div>
        );
      })()}

      {/* Overall progress */}
      <div style={{ marginTop: 14, padding: '8px 12px', background: '#f8fafc', borderRadius: 7, border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12, fontWeight: 600 }}>
          <span>Overall progress</span>
          <span style={{ color: completedItems === totalItems ? '#16a34a' : '#374151' }}>{completedItems}/{totalItems}</span>
        </div>
        <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(completedItems / totalItems) * 100}%`, background: criticalUnchecked > 0 ? '#f59e0b' : '#16a34a', borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        {criticalUnchecked > 0 && (
          <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginTop: 5 }}>
            ⚠ {criticalUnchecked} critical item{criticalUnchecked > 1 ? 's' : ''} not yet completed
          </div>
        )}
        {phases.every(p => p.signedOff) && (
          <div style={{ fontSize: 12, color: '#15803d', fontWeight: 700, marginTop: 5 }}>
            ✓ All phases complete — cleared for theatre
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
}
