import React, { useState } from 'react';
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
      { id: 'si1', text: 'Patient has confirmed: identity, site, procedure, and consent', critical: true },
      { id: 'si2', text: 'Surgical site marked (or not applicable — endoscopy / bilateral)' },
      { id: 'si3', text: 'Anaesthesia machine and medication check complete' },
      { id: 'si4', text: 'Pulse oximeter on patient and functioning' },
      { id: 'si5', text: 'Known allergy confirmed and communicated to team', critical: true },
      { id: 'si6', text: 'Difficult airway / aspiration risk assessed and plan communicated' },
      { id: 'si7', text: 'Risk of >500 mL blood loss (7 mL/kg in children) assessed; IV access adequate' },
    ],
  },
  {
    id: 'timeout', label: 'Time Out', subtitle: 'Before skin incision / scope insertion',
    color: '#7c3aed',
    items: [
      { id: 'to1', text: 'All team members introduce name and role', critical: true },
      { id: 'to2', text: 'Surgeon, anaesthesiologist, nurse verbally confirm: patient, site, procedure', critical: true },
      { id: 'to3', text: 'Anticipated critical events reviewed:', critical: true },
      { id: 'to3a', text: '  • Surgeon: Critical steps, operative duration, anticipated blood loss' },
      { id: 'to3b', text: '  • Anaesthesia: Patient-specific concerns (allergy, airway, comorbidities)' },
      { id: 'to3c', text: '  • Nursing: Sterility confirmed, equipment available, special concerns noted' },
      { id: 'to4', text: 'Antibiotic prophylaxis given within last 60 min (or not indicated)' },
      { id: 'to5', text: 'Essential imaging displayed and reviewed' },
      { id: 'to6', text: 'DVT prophylaxis applied: TED stockings and/or LMWH (or not indicated)' },
    ],
  },
  {
    id: 'signout', label: 'Sign Out', subtitle: 'Before patient leaves theatre / endoscopy suite',
    color: '#0f766e',
    items: [
      { id: 'so1', text: 'Nurse verbally confirms procedure performed', critical: true },
      { id: 'so2', text: 'Instrument, sponge, needle count correct (or not applicable)', critical: true },
      { id: 'so3', text: 'Specimen(s) labelled, documented, and sent to pathology (or not applicable)' },
      { id: 'so4', text: 'Equipment problems identified and reported for follow-up' },
      { id: 'so5', text: 'Key post-procedure concerns reviewed: recovery, analgesia, ICU/HDU plan' },
      { id: 'so6', text: 'Surgeon, anaesthesiologist, and nurse confirm checklist complete', critical: true },
    ],
  },
];

interface ProcedureDetails {
  procedureName: string;
  procedureDate: string;
  procedureTime: string;
  theatre: string;
  site: string;
  surgeon: string;
  anaesthetist: string;
  scrubNurse: string;
  circulatingNurse: string;
}

interface PhaseState { checked: Record<string, boolean>; signedOff: boolean; signedBy: string; signedAt: string; }
type ChecklistState = Record<Phase, PhaseState>;

function emptyChecklist(): ChecklistState {
  const p: Partial<ChecklistState> = {};
  for (const ph of PHASES) p[ph.id] = { checked: {}, signedOff: false, signedBy: '', signedAt: '' };
  return p as ChecklistState;
}

function emptyProcedure(): ProcedureDetails {
  return { procedureName: '', procedureDate: '', procedureTime: '', theatre: '', site: '', surgeon: 'Dr Dawit Daniel Kabiye', anaesthetist: '', scrubNurse: '', circulatingNurse: '' };
}

const INP: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--line)',
  background: 'var(--bg)', color: 'var(--ink)',
  fontSize: 13, boxSizing: 'border-box', outline: 'none',
};

const LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 3,
  letterSpacing: '0.04em', textTransform: 'uppercase',
};

export default function WhoChecklistTab() {
  const ctx = useAppContext();
  const [state, setState] = useState<ChecklistState>(emptyChecklist);

  // Derive procedure name from visitType or procedures text
  const VISIT_TYPE_LABELS: Record<string, string> = {
    ercp:           'ERCP',
    endoscopy_ogd:  'OGD',
    endoscopy_col:  'Colonoscopy',
    day_of_surgery: '',
  };
  const todayEct = new Date().toLocaleDateString('en-CA', { timeZone: 'America/St_Lucia' }); // YYYY-MM-DD

  // Auto-populate whoProc on first render or when key fields are empty
  const proc = ctx.whoProc;
  function setProc(updater: (p: typeof ctx.whoProc) => typeof ctx.whoProc) {
    ctx.setWhoProc(updater);
  }

  // Auto-fill empty fields from context
  React.useEffect(() => {
    ctx.setWhoProc(p => {
      const autoName = p.procedureName || ctx.procedures?.split('\n')[0]?.trim() || (ctx.visitType ? (VISIT_TYPE_LABELS[ctx.visitType] || '') : '');
      const autoDate = p.procedureDate || todayEct;
      if (p.procedureName !== autoName || p.procedureDate !== autoDate) {
        return { ...p, procedureName: autoName, procedureDate: autoDate };
      }
      return p;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.visitType, ctx.procedures]);
  const [activePhase, setActivePhase] = useState<Phase>('signin');
  const [signerInputs, setSignerInputs] = useState<Record<Phase, string>>({ signin: '', timeout: '', signout: '' });

  function setField(field: keyof ProcedureDetails, value: string) {
    setProc(p => ({ ...p, [field]: value }));
  }

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

    const procRows = [
      ['Procedure', proc.procedureName || '—'],
      ['Date', proc.procedureDate || '—'],
      ['Time', proc.procedureTime || '—'],
      ['Theatre / Suite', proc.theatre || '—'],
      ['Site / Laterality', proc.site || '—'],
      ['Surgeon', proc.surgeon || '—'],
      ['Anaesthetist', proc.anaesthetist || '—'],
      ['Scrub Nurse', proc.scrubNurse || '—'],
      ['Circulating Nurse', proc.circulatingNurse || '—'],
    ].map(([k, v]) => `<tr><td style="font-weight:700;padding:3px 10px 3px 0;font-size:12px;color:#374151;white-space:nowrap">${k}</td><td style="padding:3px 0;font-size:12px;color:#1e293b">${v}</td></tr>`).join('');

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
      <style>body { font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; padding: 24px; } @media print { body { padding: 10px; } }</style>
    </head><body>
      <div style="text-align:center;margin-bottom:16px;border-bottom:2px solid #0f172a;padding-bottom:14px">
        <div style="font-size:17px;font-weight:800;letter-spacing:-0.3px">WHO Surgical Safety Checklist</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px">Amise Medical Services — General &amp; Endoscopic Surgery · Dr Dawit Daniel Kabiye, MD, DM</div>
        <div style="font-size:13px;font-weight:700;margin-top:6px">${patientMeta}</div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">Printed: ${dateStr}</div>
      </div>
      <div style="border:1px solid #e2e8f0;border-radius:7px;padding:10px 16px;margin-bottom:16px;background:#f8fafc">
        <div style="font-size:12px;font-weight:700;color:#0f172a;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em">Procedure Details</div>
        <table style="border-collapse:collapse">${procRows}</table>
      </div>
      ${phaseHtml}
      <div style="font-size:10px;color:#94a3b8;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:10px">
        Based on the WHO Surgical Safety Checklist (2009). All three phases must be completed and signed before the patient leaves theatre.
        Items marked * are critical safety checks — these must not be bypassed.
      </div>
    </body></html>`;
    printDoc(html);
  }

  const overallComplete = PHASES.every(ph => state[ph.id].signedOff);
  const procFilled = !!(proc.procedureName && proc.procedureDate);

  return (
    <div className="gap-y">
      {/* Header */}
      <div style={{ background: '#0f172a', borderRadius: 10, padding: '16px 20px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>WHO Surgical Safety Checklist</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
            Theatre / Endoscopy Suite — complete all three phases before patient leaves
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {overallComplete && (
            <span style={{ background: '#065f46', color: '#6ee7b7', borderRadius: 6, padding: '4px 12px', fontWeight: 700, fontSize: 12 }}>✓ Complete</span>
          )}
          <button type="button" onClick={handlePrint}
            style={{ padding: '6px 14px', borderRadius: 7, border: '1.5px solid #475569', background: 'transparent', color: '#cbd5e1', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            Print / PDF
          </button>
        </div>
      </div>

      {/* Procedure details */}
      <CollapsibleCard title="Procedure Details" defaultOpen>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={LABEL}>Procedure / Operation</div>
            <input style={INP} value={proc.procedureName} onChange={e => setField('procedureName', e.target.value)} placeholder="e.g. Laparoscopic appendicectomy, OGD + biopsy, ERCP + sphincterotomy…" />
          </div>
          <div>
            <div style={LABEL}>Date of Procedure</div>
            <input type="date" style={INP} value={proc.procedureDate} onChange={e => setField('procedureDate', e.target.value)} />
          </div>
          <div>
            <div style={LABEL}>Scheduled Time</div>
            <input type="time" style={INP} value={proc.procedureTime} onChange={e => setField('procedureTime', e.target.value)} />
          </div>
          <div>
            <div style={LABEL}>Theatre / Suite</div>
            <input style={INP} value={proc.theatre} onChange={e => setField('theatre', e.target.value)} placeholder="e.g. Tapion Theatre 1, Endoscopy Suite" />
          </div>
          <div>
            <div style={LABEL}>Site / Laterality</div>
            <select style={INP} value={proc.site} onChange={e => setField('site', e.target.value)}>
              <option value="">Select…</option>
              <option>Not applicable</option>
              <option>Right</option>
              <option>Left</option>
              <option>Midline / central</option>
              <option>Bilateral</option>
              <option>Per oral / per anal</option>
            </select>
          </div>
          <div>
            <div style={LABEL}>Surgeon</div>
            <input style={INP} value={proc.surgeon} onChange={e => setField('surgeon', e.target.value)} />
          </div>
          <div>
            <div style={LABEL}>Anaesthetist</div>
            <input style={INP} value={proc.anaesthetist} onChange={e => setField('anaesthetist', e.target.value)} placeholder="Name and grade" />
          </div>
          <div>
            <div style={LABEL}>Scrub / Instrument Nurse</div>
            <input style={INP} value={proc.scrubNurse} onChange={e => setField('scrubNurse', e.target.value)} />
          </div>
          <div>
            <div style={LABEL}>Circulating Nurse</div>
            <input style={INP} value={proc.circulatingNurse} onChange={e => setField('circulatingNurse', e.target.value)} />
          </div>
        </div>
        {!procFilled && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#d97706', fontWeight: 600 }}>
            ⚠ Complete procedure name and date before starting the checklist
          </div>
        )}
      </CollapsibleCard>

      {/* Phase tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {PHASES.map(ph => {
          const ps = state[ph.id];
          const total = ph.items.length;
          const done = ph.items.filter(i => ps.checked[i.id]).length;
          return (
            <button key={ph.id} type="button" onClick={() => setActivePhase(ph.id)}
              disabled={!procFilled}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 8,
                border: `2px solid ${activePhase === ph.id ? ph.color : 'var(--line)'}`,
                background: activePhase === ph.id ? ph.color : 'var(--card)',
                color: activePhase === ph.id ? '#fff' : 'var(--ink)',
                cursor: procFilled ? 'pointer' : 'not-allowed', textAlign: 'left',
                opacity: procFilled ? 1 : 0.5,
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
      {procFilled && PHASES.filter(ph => ph.id === activePhase).map(ph => {
        const ps = state[ph.id];
        const allChecked = ph.items.every(i => ps.checked[i.id]);
        return (
          <CollapsibleCard key={ph.id} title={`${ph.label} — ${ph.subtitle}`}>
            {/* Procedure context reminder */}
            <div style={{ marginBottom: 10, padding: '6px 10px', background: 'rgba(13,148,136,0.07)', border: '1px solid rgba(13,148,136,0.2)', borderRadius: 6, fontSize: 12, color: 'var(--ink)' }}>
              <strong>{proc.procedureName}</strong>
              {proc.procedureDate && <span style={{ color: 'var(--muted)', marginLeft: 8 }}>{proc.procedureDate}{proc.procedureTime ? ' · ' + proc.procedureTime : ''}</span>}
              {proc.theatre && <span style={{ color: 'var(--muted)', marginLeft: 8 }}>· {proc.theatre}</span>}
              {proc.site && proc.site !== 'Not applicable' && <span style={{ color: 'var(--muted)', marginLeft: 8 }}>· {proc.site}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ph.items.map(item => (
                <label key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: ps.signedOff ? 'default' : 'pointer', padding: '6px 8px', borderRadius: 6, background: ps.checked[item.id] ? '#f0fdf4' : 'transparent', border: `1px solid ${ps.checked[item.id] ? '#86efac' : 'var(--line)'}` }}>
                  <input
                    type="checkbox"
                    checked={!!ps.checked[item.id]}
                    onChange={() => !ps.signedOff && toggle(ph.id, item.id)}
                    disabled={ps.signedOff}
                    style={{ marginTop: 2, flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 13, color: item.critical ? 'var(--ink)' : 'var(--muted)', fontWeight: item.critical ? 600 : 400 }}>
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
                  placeholder="Signed by (name and role — e.g. Dr Smith, Consultant Surgeon)"
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
