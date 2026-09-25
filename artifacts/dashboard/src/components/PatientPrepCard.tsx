import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import { downloadAsWord } from '@/pages/tabs/lib/pdfExport';
// Content, approved wording and HTML live in lib/patient-prep-sheet.ts (linted by
// lint:patient-instructions from its rendered output — hazard H-10 and the approved fasting wording).
import {
  BOWEL_PREPS, DIET_TABLE, PREP_FASTING_STANDARD, PREP_MEDICATIONS_CALL,
  buildPrepHtml, herbalPointerLine, recordedHerbalProducts,
} from '@/lib/patient-prep-sheet';

// ── Component ─────────────────────────────────────────────────────────────────

type PrepMode = 'preop' | 'colonoscopy';

export default function PatientPrepCard() {
  const { patientName, dob, nhiNumber, allergies: allergyText, medications, plan, assessment, supplementHistory } = useAppContext();
  const [mode, setMode] = useState<PrepMode>('colonoscopy');
  const [selectedPrepId, setSelectedPrepId] = useState(BOWEL_PREPS[0].id);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [procedureOverride, setProcedureOverride] = useState('');

  const procedure = procedureOverride || (() => {
    for (const line of [...(plan ?? '').split('\n'), ...(assessment ?? '').split('\n')]) {
      if (/laparoscop|cholecyst|appendicect|colectomy|hernia|colonoscopy|ogd|ercp|thyroid|mastectomy|bowel|endoscopy|hemicolectomy/i.test(line)) {
        const clean = line.trim().replace(/^[-•*]\s*/, '').replace(/^(?:plan|assessment)[:\s]+/i, '');
        if (clean.length > 3 && clean.length < 100) return clean;
      }
    }
    return '';
  })();

  const selectedPrep = BOWEL_PREPS.find(p => p.id === selectedPrepId) ?? BOWEL_PREPS[0];
  // Prescribed medicines get no per-medicine instruction (hazard H-10); recorded herbal products
  // are listed as a pointer to the approved herbal paragraph.
  const herbalProducts = recordedHerbalProducts([...(medications ?? []), ...supplementHistory.entries.map(e => e.name)]);
  const herbalPointer = herbalPointerLine(herbalProducts);

  function getOpts() {
    return {
      type: mode,
      patientName: patientName ?? '',
      dob: dob ?? '',
      nhiNumber: nhiNumber ?? '',
      procedure,
      appointmentDate,
      appointmentTime,
      prep: mode === 'colonoscopy' ? selectedPrep : undefined,
      herbalProducts,
      allergies: allergyText ?? '',
    };
  }

  function printPrep() {
    const html = buildPrepHtml(getOpts());
    const w = window.open('', '_blank');
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  }

  function downloadWord() {
    const html = buildPrepHtml(getOpts());
    const bodyOnly = html.replace(/<html[\s\S]*?<body[^>]*>/, '').replace(/<\/body>[\s\S]*$/, '');
    const fname = `${(patientName ?? 'Patient').replace(/\s+/g, '_')}_${mode === 'colonoscopy' ? 'Colonoscopy_Prep' : 'Preop_Instructions'}_${new Date().toISOString().slice(0, 10)}`;
    downloadAsWord(bodyOnly, fname, mode === 'colonoscopy' ? 'Colonoscopy Preparation Instructions' : 'Pre-operative Patient Instructions');
  }

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
    background: active ? '#1e3a5f' : '#f1f5f9',
    color: active ? '#fff' : '#475569',
  });

  const inp: React.CSSProperties = {
    fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, width: '100%',
  };

  return (
    <CollapsibleCard title="Patient Preparation Instructions" defaultOpen={false}>
      {/* Mode switcher */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button type="button" style={tabBtnStyle(mode === 'colonoscopy')} onClick={() => setMode('colonoscopy')}>
          Bowel Prep — Colonoscopy
        </button>
        <button type="button" style={tabBtnStyle(mode === 'preop')} onClick={() => setMode('preop')}>
          Pre-operative Prep
        </button>
      </div>

      {/* Auto-populated patient summary */}
      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: '#0369a1', marginBottom: 4 }}>Patient (auto-populated)</div>
        <div style={{ color: '#1e293b' }}>
          <strong>{patientName || '— patient name —'}</strong>
          {dob ? ` · DOB: ${dob}` : ''}
          {nhiNumber ? ` · NHI: ${nhiNumber}` : ''}
          {allergyText ? <span style={{ color: '#dc2626', fontWeight: 700 }}> · &#9888; {allergyText}</span> : ''}
        </div>
        {procedure && <div style={{ color: '#374151', marginTop: 2 }}>Procedure: <strong>{procedure}</strong></div>}
      </div>

      {/* Appointment details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>PROCEDURE (edit if needed)</label>
          <input value={procedureOverride || procedure} onChange={e => setProcedureOverride(e.target.value)} style={inp} placeholder="e.g. Colonoscopy ± polypectomy" />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>APPOINTMENT DATE</label>
          <input type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} style={inp} />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 3 }}>APPOINTMENT TIME</label>
          <input type="time" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} style={inp} />
        </div>
      </div>

      {/* Bowel prep selector */}
      {mode === 'colonoscopy' && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>BOWEL PREPARATION REGIMEN</label>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 12px', marginBottom: 8, fontSize: 11.5, color: '#78350f' }}>
            <strong>Magnesium Citrate — purchase 2 bottles from any local pharmacy before your prep day.</strong> Chill in the fridge for best palatability.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {BOWEL_PREPS.map(p => (
              <label key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 12, padding: '8px 12px', borderRadius: 7, border: `1.5px solid ${selectedPrepId === p.id ? '#1e3a5f' : '#e2e8f0'}`, background: selectedPrepId === p.id ? '#f0f9ff' : '#fafafa' }}>
                <input type="radio" name="prep" value={p.id} checked={selectedPrepId === p.id} onChange={() => setSelectedPrepId(p.id)} style={{ marginTop: 2 }} />
                <span style={{ fontWeight: selectedPrepId === p.id ? 700 : 400, color: selectedPrepId === p.id ? '#1e3a5f' : '#374151' }}>{p.label}</span>
              </label>
            ))}
          </div>

          {/* Schedule preview */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#1e293b', marginBottom: 8 }}>Schedule — {selectedPrep.label}</div>
            {selectedPrep.instructions.map((step, i) => (
              <div key={i} style={{ marginBottom: 8, display: 'flex', gap: 12 }}>
                <div style={{ minWidth: 160, fontSize: 11, fontWeight: 700, color: '#1e3a5f', flexShrink: 0 }}>{step.time}</div>
                <ul style={{ margin: 0, padding: 0, paddingLeft: 16, fontSize: 11, color: '#374151', lineHeight: 1.6 }}>
                  {step.items.map((item, j) => <li key={j}>{item}</li>)}
                </ul>
              </div>
            ))}
          </div>

          {/* Diet table preview */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Low-Residue Diet Guide (2 days before)
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ padding: '5px 8px', background: '#1e3a5f', color: '#fff', textAlign: 'left', width: '20%', borderRight: '1px solid #334155' }}>Category</th>
                    <th style={{ padding: '5px 8px', background: '#15803d', color: '#fff', textAlign: 'left', width: '40%', borderRight: '1px solid #166534' }}>Recommended Foods</th>
                    <th style={{ padding: '5px 8px', background: '#b91c1c', color: '#fff', textAlign: 'left', width: '40%' }}>Foods to Avoid</th>
                  </tr>
                </thead>
                <tbody>
                  {DIET_TABLE.map((row, i) => (
                    <tr key={row.category} style={{ verticalAlign: 'top', background: i % 2 === 0 ? '#f8fafc' : '#fff' }}>
                      <td style={{ padding: '5px 8px', fontWeight: 700, border: '1px solid #e2e8f0', color: '#1e3a5f', fontSize: 10.5 }}>{row.category}</td>
                      <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0' }}>
                        <ul style={{ margin: 0, padding: 0, paddingLeft: 12, color: '#166534', lineHeight: 1.55 }}>
                          {row.allowed.map((a, j) => <li key={j}>{a}</li>)}
                        </ul>
                      </td>
                      <td style={{ padding: '5px 8px', border: '1px solid #e2e8f0' }}>
                        <ul style={{ margin: 0, padding: 0, paddingLeft: 12, color: '#991b1b', lineHeight: 1.55 }}>
                          {row.avoid.map((a, j) => <li key={j}>{a}</li>)}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Pre-op mode instructions */}
      {mode === 'preop' && (
        <div style={{ marginBottom: 14, fontSize: 12, color: '#374151', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ padding: '8px 12px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6 }}>
            <strong>Fasting:</strong> {PREP_FASTING_STANDARD}
          </div>
          <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6 }}>
            <strong>What to bring:</strong> photo ID, NHI card, all medications in original packaging, loose comfortable clothing, and a responsible adult to drive you home.
          </div>
          <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6 }}>
            <strong>Remove all metal</strong> before your appointment — jewellery, piercings, watches, accessories. Metal interferes with electrocautery.
          </div>
        </div>
      )}

      {/* Medicines preview — the same text as the printed sheet */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
          Your medicines (printed on every sheet)
        </div>
        <div style={{ padding: '6px 10px', background: '#f8fafc', borderRadius: 5, border: '1px solid #e2e8f0', fontSize: 11.5, color: '#1e293b', fontWeight: 600 }}>
          {PREP_MEDICATIONS_CALL}
        </div>
        {herbalPointer && (
          <div style={{ marginTop: 4, padding: '5px 10px', background: '#fffbeb', borderRadius: 5, border: '1px solid #fde68a', fontSize: 11.5, color: '#92400e' }}>
            {herbalPointer}
          </div>
        )}
        <div style={{ marginTop: 4, fontSize: 10.5, color: '#64748b', fontStyle: 'italic' }}>
          The sheet gives no instruction for individual prescribed medicines (hazard H-10) — the clinician advises the patient directly.
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={printPrep}
          style={{ padding: '8px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: '#1e3a5f', color: '#fff', border: 'none', cursor: 'pointer' }}>
          🖨 Print Patient Instructions
        </button>
        <button type="button" onClick={downloadWord}
          style={{ padding: '8px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #2563eb', cursor: 'pointer' }}>
          📄 Word
        </button>
      </div>
    </CollapsibleCard>
  );
}
