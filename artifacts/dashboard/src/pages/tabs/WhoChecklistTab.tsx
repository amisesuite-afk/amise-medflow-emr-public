import { useState } from 'react';
import CollapsibleCard from '@/components/CollapsibleCard';
import { useAppContext } from '@/context/AppContext';
import { printDoc } from './lib/pdfExport';

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

const INP: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db',
  fontSize: 13, boxSizing: 'border-box', outline: 'none',
};

export default function WhoChecklistTab() {
  const ctx = useAppContext();
  const [state, setState] = useState<ChecklistState>(empty);
  const [activePhase, setActivePhase] = useState<Phase>('signin');
  const [signerInputs, setSignerInputs] = useState<Record<Phase, string>>({ signin: '', timeout: '', signout: '' });

  function toggle(phase: Phase, id: string) {
    setState(s => ({
      ...s,
      [phase]: { ...s[phase], checked: { ...s[phase].checked, [id]: !s[phase].checked[id] } },
    }));
  }

  function signOff(phase: Phase) {
    const signer = signerInputs[phase].trim();
    const now = new Date().toLocaleString('en-LC', { timeZone: 'America/St_Lucia', dateStyle: 'medium', timeStyle: 'short' });
    setState(s => ({
      ...s,
      [phase]: { ...s[phase], signedOff: true, signedBy: signer, signedAt: now },
    }));
  }

  function handlePrint() {
    const patientName = ctx.patientName || '—';
    const patientDob = ctx.dob || '';
    const nhi = ctx.nhiNumber || '';
    const dateStr = new Date().toLocaleDateString('en-LC', { timeZone: 'America/St_Lucia', dateStyle: 'long' });

    const patientMeta = [patientName, patientDob ? `DOB: ${patientDob}` : '', nhi ? `NHI: ${nhi}` : ''].filter(Boolean).join(' · ');

    const phaseHtml = PHASES.map(ph => {
      const ps = state[ph.id];
      const rowsHtml = ph.items.map(item => {
        const checked = ps.checked[item.id];
        return `<tr>
          <td style="width:22px;text-align:center;font-size:15px;padding:3px 6px">${checked ? '☑' : '☐'}</td>
          <td style="padding:3px 6px;font-size:12px;${item.critical ? 'font-weight:600;color:#1e293b' : 'color:#374151'}">${item.critical ? '<span style="color:#dc2626">*</span> ' : ''}${item.text}</td>
        </tr>`;
      }).join('');
      const signBlock = ps.signedOff
        ? `<div style="margin-top:8px;padding:7px 10px;background:#f0fdf4;border:1px solid #86efac;border-radius:4px;font-size:11px;color:#15803d;font-weight:600">
            ✓ Signed off — ${ps.signedAt}${ps.signedBy ? ' · ' + ps.signedBy : ''}
           </div>`
        : `<div style="margin-top:8px;padding:7px 10px;background:#fef2f2;border:1px solid #fca5a5;border-radius:4px;font-size:11px;color:#991b1b">
            ○ Not signed off
           </div>`;
      return `
        <div style="border:2px solid ${ph.color};border-radius:7px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid">
          <div style="background:${ph.color};color:#fff;padding:8px 14px;font-weight:700;font-size:13px">
            ${ph.label} — ${ph.subtitle}
          </div>
          <div style="padding:10px 12px">
            <table style="width:100%;border-collapse:collapse">${rowsHtml}</table>
            ${signBlock}
          </div>
        </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>WHO Surgical Safety Checklist — ${patientName}</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 24px; }
        @media print { body { padding: 10px; } }
      </style>
    </head><body>
      <div style="text-align:center;margin-bottom:18px;border-bottom:2px solid #0f172a;padding-bottom:14px">
        <div style="font-size:17px;font-weight:800;letter-spacing:-0.3px">WHO Surgical Safety Checklist</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px">Amise Medical Services — General &amp; Endoscopic Surgery · Dr Dawit Daniel Kabiye, MD, DM</div>
        <div style="font-size:12px;margin-top:6px">${patientMeta}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">Date: ${dateStr}</div>
      </div>
      ${phaseHtml}
      <div style="font-size:10px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:10px">
        Based on the WHO Surgical Safety Checklist (2009). All three phases must be completed and signed before the patient leaves theatre.
      </div>
    </body></html>`;

    printDoc(html);
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {overallComplete && (
            <span style={{ background: '#065f46', color: '#6ee7b7', borderRadius: 6, padding: '4px 12px', fontWeight: 700, fontSize: 12 }}>✓ Complete</span>
          )}
          <button type="button" onClick={handlePrint}
            style={{ padding: '6px 14px', borderRadius: 7, border: '1.5px solid #475569', background: 'transparent', color: '#cbd5e1', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Print
          </button>
        </div>
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
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  value={signerInputs[ph.id]}
                  onChange={e => setSignerInputs(p => ({ ...p, [ph.id]: e.target.value }))}
                  placeholder="Signed by (name and role)"
                  disabled={!allChecked}
                  style={{ ...INP, opacity: allChecked ? 1 : 0.5 }}
                />
                <button
                  type="button"
                  onClick={() => signOff(ph.id)}
                  disabled={!allChecked}
                  style={{ width: '100%', padding: '9px', borderRadius: 7, border: 'none', background: allChecked ? ph.color : '#d1d5db', color: '#fff', fontWeight: 700, fontSize: 13, cursor: allChecked ? 'pointer' : 'default' }}
                >
                  {allChecked ? `Sign off ${ph.label}` : `Complete all items to sign off`}
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 12, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 7, fontSize: 13, color: '#15803d', fontWeight: 600 }}>
                ✓ Signed off · {ps.signedAt}{ps.signedBy ? ` · ${ps.signedBy}` : ''}
              </div>
            )}
          </CollapsibleCard>
        );
      })}
    </div>
  );
}
