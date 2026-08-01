import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import { downloadAsWord } from '@/pages/tabs/lib/pdfExport';

// ── Bowel prep regimen data ───────────────────────────────────────────────────

const BOWEL_PREPS = [
  {
    id: 'moviprep_split',
    label: 'Moviprep® — split dose (recommended)',
    instructions: [
      { time: '2 days before', items: ['Low-residue diet all day (see below — no fruit, vegetables, high-fibre foods)'] },
      { time: 'Day before — afternoon diet', items: ['Clear fluids only from midday onwards (water, clear broth, apple juice without pulp, black tea/coffee, jelly)'] },
      { time: 'Day before — 6:00 pm', items: ['Mix Dose 1: dissolve 1 sachet A + 1 sachet B in 1 litre of cold water', 'Drink the full 1 litre over 1 hour (finish by 7:00 pm)', 'Then drink 500 mL additional clear fluid over the next 30 minutes'] },
      { time: 'Day of procedure — 4–6 hours before', items: ['Mix Dose 2: dissolve 1 sachet A + 1 sachet B in 1 litre of cold water', 'Drink the full 1 litre over 1 hour', 'Then drink 500 mL additional clear fluid over the next 30 minutes', 'STOP ALL FLUIDS 2 hours before your appointment time'] },
    ],
  },
  {
    id: 'plenvu',
    label: 'Plenvu® — 1-litre split dose',
    instructions: [
      { time: '2 days before', items: ['Low-residue diet all day'] },
      { time: 'Day before — clear fluids from midday', items: ['Water, clear broth, apple juice, black tea/coffee, clear cordial, jelly only'] },
      { time: 'Day before — 6:00–8:00 pm (Dose 1)', items: ['Dissolve Dose 1 (sachets 1 + 2) in 500 mL cold water; stir until dissolved', 'Drink over 30 minutes', 'Immediately follow with 500 mL clear fluid over the next 30 minutes'] },
      { time: 'Day of procedure — 4–6 hours before (Dose 2)', items: ['Dissolve Dose 2 (sachets 3 + 4) in 500 mL cold water; stir until dissolved', 'Drink over 30 minutes', 'Immediately follow with 500 mL clear fluid over the next 30 minutes', 'STOP ALL FLUIDS 2 hours before your appointment time'] },
    ],
  },
  {
    id: 'picolax',
    label: 'Picolax® (sodium picosulfate) — day-before only',
    instructions: [
      { time: '2 days before', items: ['Low-residue diet all day'] },
      { time: 'Day before — 8:00 am (Sachet 1)', items: ['Dissolve 1 sachet in 150 mL water; stir for 2–3 minutes (solution may become warm)', 'Drink immediately', 'Drink at least 1.5 litres of clear fluid throughout the morning'] },
      { time: 'Day before — 2:00–4:00 pm (Sachet 2)', items: ['Dissolve 1 sachet in 150 mL water as above', 'Drink immediately', 'Drink at least 1.5 litres of clear fluid throughout the afternoon and evening', 'Stop all fluids at midnight'] },
      { time: 'Day of procedure', items: ['Nothing by mouth from midnight', 'Regular medications with a small sip of water only (see medication instructions)'] },
    ],
  },
  {
    id: 'klean_prep',
    label: 'KleanPrep® (PEG 4000) — day-before large volume',
    instructions: [
      { time: '2 days before', items: ['Low-residue diet all day'] },
      { time: 'Day before — clear fluids from midday', items: ['Clear fluids only (no solid food, no milk)'] },
      { time: 'Day before — 2:00 pm onwards', items: ['Dissolve all 4 sachets in 4 litres of water', 'Drink 250 mL (1 glass) every 15 minutes until finished', 'Keep refrigerated and drink chilled to improve palatability', 'Bowel motions should become clear/yellow by completion'] },
      { time: 'Day of procedure', items: ['Nothing by mouth from midnight', 'Regular medications with a sip of water only'] },
    ],
  },
];

const LOW_RESIDUE_ALLOWED = [
  'White bread, white rice, white pasta (no wholegrain)',
  'Eggs — boiled, scrambled, or poached',
  'Chicken or turkey (no skin, well-cooked)',
  'White fish (baked or steamed)',
  'Cheese and plain yogurt (no fruit pieces)',
  'Well-cooked peeled potatoes (no skins)',
  'Clear broth or strained soup',
  'Apple juice (no pulp), clear cordial',
  'Jelly (no fruit pieces), ice lollies',
  'Water, black tea / coffee (no milk)',
];

const LOW_RESIDUE_AVOID = [
  'All fruit and vegetables (especially raw, with skins or seeds)',
  'Red meat, processed meat, sausages',
  'Brown or wholegrain bread, cereal, oats, bran',
  'Nuts, seeds, popcorn',
  'Beans, lentils, pulses',
  'Milk, cream, milky drinks',
  'Fizzy drinks',
  'High-fibre supplements (psyllium, Metamucil)',
];

// ── Medication instruction rules ──────────────────────────────────────────────

function colonMedInstructions(medications: string[]): { drug: string; instruction: string; colour: string }[] {
  const rules: { pattern: RegExp; instruction: string; colour: string }[] = [
    { pattern: /warfarin|coumadin/i, instruction: 'HOLD — usually stopped 5 days before. Your surgeon will advise on bridging anticoagulation.', colour: '#dc2626' },
    { pattern: /rivaroxaban|xarelto|apixaban|eliquis|dabigatran|pradaxa|edoxaban/i, instruction: 'HOLD — usually stopped 48–72 hours before. Your surgeon will advise.', colour: '#dc2626' },
    { pattern: /clopidogrel|ticagrelor|brilinta|prasugrel|effient/i, instruction: 'HOLD — stop 5–7 days before unless on a coronary stent (DISCUSS with surgeon).', colour: '#dc2626' },
    { pattern: /aspirin/i, instruction: 'CONTINUE unless specifically told to stop — check with your surgeon.', colour: '#15803d' },
    { pattern: /metformin|glucophage/i, instruction: 'HOLD on the day of preparation and day of procedure — restart when eating normally.', colour: '#b45309' },
    { pattern: /insulin/i, instruction: 'REDUCE dose — do not take your usual insulin while fasting. Your surgeon will give specific instructions.', colour: '#b45309' },
    { pattern: /iron|ferrous/i, instruction: 'STOP iron tablets 5 days before — iron interferes with bowel preparation quality.', colour: '#b45309' },
    { pattern: /ibuprofen|naproxen|diclofenac|celecoxib|indomethacin|nsaid/i, instruction: 'HOLD on the day of procedure — risk of bleeding from polypectomy site.', colour: '#b45309' },
    { pattern: /lisinopril|ramipril|enalapril|perindopril|amlodipine|felodipine|metoprolol|atenolol|bisoprolol|carvedilol|losartan|valsartan|irbesartan|candesartan|amlodipine/i, instruction: 'CONTINUE as usual with a small sip of water on the morning of procedure.', colour: '#15803d' },
    { pattern: /omeprazole|lansoprazole|pantoprazole|esomeprazole|rabeprazole/i, instruction: 'CONTINUE as usual.', colour: '#15803d' },
    { pattern: /levothyroxine|thyroxine|synthroid/i, instruction: 'TAKE as usual with a small sip of water — do not skip.', colour: '#15803d' },
  ];

  const results: { drug: string; instruction: string; colour: string }[] = [];
  for (const med of medications) {
    for (const rule of rules) {
      if (rule.pattern.test(med)) {
        results.push({ drug: med, instruction: rule.instruction, colour: rule.colour });
        break;
      }
    }
  }
  return results;
}

// ── Print helpers ─────────────────────────────────────────────────────────────

function buildPrepHtml(opts: {
  type: 'colonoscopy' | 'preop';
  patientName: string; dob: string; nhiNumber: string;
  procedure: string; appointmentDate: string; appointmentTime: string;
  prep?: typeof BOWEL_PREPS[0];
  medInstructions: { drug: string; instruction: string; colour: string }[];
  allergies: string;
}) {
  const { type, patientName, dob, nhiNumber, procedure, appointmentDate, appointmentTime, prep, medInstructions, allergies } = opts;
  const practicePhone = '+1 (758) 284-0557';
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  const patientHeader = `
    <div style="border-bottom:2px solid #0d9488;padding-bottom:12px;margin-bottom:18px">
      <div style="font-size:18px;font-weight:800;color:#0d9488">Amise Medical Services</div>
      <div style="font-size:11px;color:#6b7280">Dr Dawit Daniel Kabiye, MD, DM | General &amp; Endoscopic Surgery | Saint Lucia | ${practicePhone}</div>
    </div>
    <h1 style="font-size:16px;margin:0 0 6px;color:#1e293b">${type === 'colonoscopy' ? 'Colonoscopy Preparation Instructions' : 'Pre-operative Patient Instructions'}</h1>
    <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px">
      <tr><td style="font-weight:700;width:120px;padding:3px 0;color:#374151">Patient</td><td>${patientName || '—'}</td></tr>
      ${dob ? `<tr><td style="font-weight:700;padding:3px 0;color:#374151">Date of Birth</td><td>${dob}</td></tr>` : ''}
      ${nhiNumber ? `<tr><td style="font-weight:700;padding:3px 0;color:#374151">NHI Number</td><td>${nhiNumber}</td></tr>` : ''}
      <tr><td style="font-weight:700;padding:3px 0;color:#374151">Procedure</td><td>${procedure || '—'}</td></tr>
      <tr><td style="font-weight:700;padding:3px 0;color:#374151">Appointment</td><td>${appointmentDate || '—'}${appointmentTime ? ` at ${appointmentTime}` : ''}</td></tr>
      ${allergies ? `<tr><td style="font-weight:700;padding:3px 0;color:#dc2626">⚠ Allergies</td><td style="color:#dc2626;font-weight:700">${allergies}</td></tr>` : ''}
    </table>
    <p style="font-size:11px;color:#dc2626;font-style:italic;margin-bottom:16px">These instructions have been personalised for you by your surgical team. Read carefully. If you have questions, call ${practicePhone}.</p>
  `;

  let body = '';

  if (type === 'colonoscopy' && prep) {
    body += `<h2 style="font-size:13px;color:#0d9488;border-bottom:1px solid #99f6e4;padding-bottom:4px;margin:14px 0 8px">Bowel Preparation: ${prep.label}</h2>`;
    for (const step of prep.instructions) {
      body += `<div style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:#1e3a5f;margin-bottom:4px">${step.time}</div>
        <ul style="margin:0 0 0 18px;padding:0;font-size:12px;line-height:1.7;color:#1e293b">
          ${step.items.map(i => `<li>${i}</li>`).join('')}
        </ul>
      </div>`;
    }

    body += `<h2 style="font-size:13px;color:#0d9488;border-bottom:1px solid #99f6e4;padding-bottom:4px;margin:18px 0 8px">Low-Residue Diet — Allowed Foods</h2>
    <ul style="margin:0 0 0 18px;padding:0;font-size:11px;line-height:1.7;color:#1e293b;columns:2">
      ${LOW_RESIDUE_ALLOWED.map(i => `<li>${i}</li>`).join('')}
    </ul>
    <h2 style="font-size:13px;color:#dc2626;border-bottom:1px solid #fecaca;padding-bottom:4px;margin:14px 0 8px">⚠ Foods to AVOID</h2>
    <ul style="margin:0 0 0 18px;padding:0;font-size:11px;line-height:1.7;color:#dc2626">
      ${LOW_RESIDUE_AVOID.map(i => `<li>${i}</li>`).join('')}
    </ul>`;
  }

  if (type === 'preop') {
    body += `
    <h2 style="font-size:13px;color:#0d9488;border-bottom:1px solid #99f6e4;padding-bottom:4px;margin:14px 0 8px">Fasting (NBM) Instructions</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px">
      <tr style="background:#f0fdfa"><td style="padding:6px 8px;font-weight:700;width:200px">Solid food and milk</td><td style="padding:6px 8px">Stop <strong>6 hours</strong> before your procedure time</td></tr>
      <tr><td style="padding:6px 8px;font-weight:700">Clear fluids</td><td style="padding:6px 8px">Stop <strong>2 hours</strong> before your procedure time<br><span style="font-size:11px;color:#6b7280">Clear fluids: water, black tea/coffee, apple juice without pulp, clear broth</span></td></tr>
      <tr style="background:#f0fdfa"><td style="padding:6px 8px;font-weight:700">Regular medications</td><td style="padding:6px 8px">Take with a <strong>small sip of water</strong> up to 2 hours before (see instructions below)</td></tr>
      <tr><td style="padding:6px 8px;font-weight:700;color:#dc2626">NO milk, cream, juice</td><td style="padding:6px 8px;color:#dc2626">Do not have these within 6 hours of your operation</td></tr>
    </table>

    <h2 style="font-size:13px;color:#0d9488;border-bottom:1px solid #99f6e4;padding-bottom:4px;margin:14px 0 8px">Day of Surgery — What to Bring</h2>
    <ul style="margin:0 0 0 18px;padding:0;font-size:12px;line-height:1.8;color:#1e293b">
      <li>This instruction sheet</li>
      <li>Photo ID and health / insurance card (NHI card if you have one)</li>
      <li>All current medications in their original packaging</li>
      <li>List of allergies (especially to medications)</li>
      <li>Loose, comfortable clothing (easy to put on after surgery)</li>
      <li>A responsible adult to accompany you home — you may not drive after sedation or general anaesthesia</li>
      <li>Contact phone number for your escort (we will call when you are in recovery)</li>
    </ul>
  `;
  }

  if (medInstructions.length > 0) {
    body += `<h2 style="font-size:13px;color:#0d9488;border-bottom:1px solid #99f6e4;padding-bottom:4px;margin:18px 0 8px">Your Medication Instructions</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <tr style="background:#1e293b;color:#fff"><th style="padding:6px 8px;text-align:left;font-weight:700">Medication</th><th style="padding:6px 8px;text-align:left;font-weight:700">Instruction</th></tr>
      ${medInstructions.map((m, i) => `<tr style="${i % 2 === 0 ? 'background:#f8fafc' : ''}">
        <td style="padding:6px 8px;font-weight:700;color:#1e293b">${m.drug}</td>
        <td style="padding:6px 8px;color:${m.colour};font-weight:600">${m.instruction}</td>
      </tr>`).join('')}
    </table>`;
  }

  body += `
  <div style="margin-top:24px;padding:10px 14px;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;font-size:11px;color:#92400e">
    <strong>⚠ Important:</strong> If you develop a fever, severe abdominal pain, heavy rectal bleeding, or feel very unwell, call ${practicePhone} immediately or attend the nearest emergency department. Do not take the bowel preparation if you are unwell.
  </div>
  <div style="margin-top:24px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8">
    Issued by Amise Medical Services · Dr Dawit Daniel Kabiye, MD, DM · ${now} · This document is for ${patientName || 'the named patient'} only
  </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${type === 'colonoscopy' ? 'Colonoscopy Preparation' : 'Pre-operative Instructions'} — ${patientName || 'Patient'}</title>
  <style>body{font-family:Arial,sans-serif;max-width:740px;margin:32px auto;color:#1e293b;font-size:12px;line-height:1.5}@media print{body{margin:16px}}</style>
  </head><body>${patientHeader}${body}</body></html>`;
}

// ── Component ─────────────────────────────────────────────────────────────────

type PrepMode = 'preop' | 'colonoscopy';

export default function PatientPrepCard() {
  const { patientName, dob, nhiNumber, allergies: allergyText, medications, plan, assessment } = useAppContext();
  const [mode, setMode] = useState<PrepMode>('preop');
  const [selectedPrepId, setSelectedPrepId] = useState(BOWEL_PREPS[0].id);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [procedureOverride, setProcedureOverride] = useState('');

  const procedure = procedureOverride || (
    (() => {
      for (const line of [...(plan ?? '').split('\n'), ...(assessment ?? '').split('\n')]) {
        if (/laparoscop|cholecyst|appendicect|colectomy|hernia|colonoscopy|ogd|ercp|thyroid|mastectomy|bowel|endoscopy|hemicolectomy/i.test(line)) {
          const clean = line.trim().replace(/^[-•*]\s*/, '').replace(/^(?:plan|assessment)[:\s]+/i, '');
          if (clean.length > 3 && clean.length < 100) return clean;
        }
      }
      return '';
    })()
  );

  const selectedPrep = BOWEL_PREPS.find(p => p.id === selectedPrepId) ?? BOWEL_PREPS[0];
  const medInstructions = colonMedInstructions(medications ?? []);

  function printPrep() {
    const html = buildPrepHtml({
      type: mode,
      patientName: patientName ?? '',
      dob: dob ?? '',
      nhiNumber: nhiNumber ?? '',
      procedure,
      appointmentDate,
      appointmentTime,
      prep: mode === 'colonoscopy' ? selectedPrep : undefined,
      medInstructions,
      allergies: allergyText ?? '',
    });
    const w = window.open('', '_blank');
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  }

  function downloadWord() {
    const html = buildPrepHtml({
      type: mode,
      patientName: patientName ?? '',
      dob: dob ?? '',
      nhiNumber: nhiNumber ?? '',
      procedure,
      appointmentDate,
      appointmentTime,
      prep: mode === 'colonoscopy' ? selectedPrep : undefined,
      medInstructions,
      allergies: allergyText ?? '',
    });
    const fname = `${(patientName ?? 'Patient').replace(/\s+/g, '_')}_${mode === 'colonoscopy' ? 'Colonoscopy_Prep' : 'Preop_Instructions'}_${new Date().toISOString().slice(0, 10)}`;
    downloadAsWord(html.replace(/<html[\s\S]*?<body>/, '').replace(/<\/body>[\s\S]*$/, ''), fname, mode === 'colonoscopy' ? 'Colonoscopy Preparation' : 'Pre-operative Instructions');
  }

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
    background: active ? '#0d9488' : '#f1f5f9',
    color: active ? '#fff' : '#475569',
  });

  const inp: React.CSSProperties = { fontSize: 12, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, width: '100%' };

  return (
    <CollapsibleCard title="Patient Preparation Instructions" defaultOpen={false}>
      {/* Mode switcher */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button type="button" style={tabBtnStyle(mode === 'preop')} onClick={() => setMode('preop')}>Pre-operative Prep</button>
        <button type="button" style={tabBtnStyle(mode === 'colonoscopy')} onClick={() => setMode('colonoscopy')}>Bowel Prep (Colonoscopy)</button>
      </div>

      {/* Patient auto-populated summary */}
      <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: '#0f766e', marginBottom: 4 }}>Auto-populated from patient record</div>
        <div style={{ color: '#374151' }}>
          <strong>{patientName || '— patient name —'}</strong>
          {dob ? ` · DOB: ${dob}` : ''}
          {nhiNumber ? ` · NHI: ${nhiNumber}` : ''}
          {allergyText ? <span style={{ color: '#dc2626', fontWeight: 700 }}> · ⚠ {allergyText}</span> : ''}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {BOWEL_PREPS.map(p => (
              <label key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 12, padding: '8px 12px', borderRadius: 7, border: `1.5px solid ${selectedPrepId === p.id ? '#0d9488' : '#e2e8f0'}`, background: selectedPrepId === p.id ? '#f0fdfa' : '#fafafa' }}>
                <input type="radio" name="prep" value={p.id} checked={selectedPrepId === p.id} onChange={() => setSelectedPrepId(p.id)} style={{ marginTop: 2 }} />
                <span style={{ fontWeight: selectedPrepId === p.id ? 700 : 400, color: selectedPrepId === p.id ? '#0f766e' : '#374151' }}>{p.label}</span>
              </label>
            ))}
          </div>

          {/* Prep schedule preview */}
          <div style={{ marginTop: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#1e293b', marginBottom: 8 }}>Schedule preview — {selectedPrep.label}</div>
            {selectedPrep.instructions.map((step, i) => (
              <div key={i} style={{ marginBottom: 8, display: 'flex', gap: 10 }}>
                <div style={{ minWidth: 140, fontSize: 11, fontWeight: 700, color: '#0d9488' }}>{step.time}</div>
                <ul style={{ margin: 0, padding: 0, paddingLeft: 16, fontSize: 11, color: '#374151', lineHeight: 1.6 }}>
                  {step.items.map((item, j) => <li key={j}>{item}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Medication instructions preview */}
      {medInstructions.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Medication instructions (from patient medications)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {medInstructions.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 10px', background: '#f8fafc', borderRadius: 5, border: '1px solid #e2e8f0', fontSize: 12 }}>
                <span style={{ fontWeight: 700, minWidth: 140, color: '#1e293b' }}>{m.drug}</span>
                <span style={{ color: m.colour, fontWeight: 600 }}>{m.instruction}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={printPrep}
          style={{ padding: '8px 18px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: '#0d9488', color: '#fff', border: 'none', cursor: 'pointer' }}>
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
