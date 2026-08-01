import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import { downloadAsWord } from '@/pages/tabs/lib/pdfExport';

// ── Practice details ──────────────────────────────────────────────────────────

const PRACTICE = {
  name: 'AMISE MEDICAL SERVICES',
  doctor: 'Dr Dawit Daniel Kabiye, MD, DM — General & Endoscopic Surgery',
  poBox: 'P.O. BOX RB 2449',
  email: 'amisesuite@gmail.com',
  locations: [
    { label: 'Tapion Hospital, Tapion', tel: '(758) 459-2227 / 284-0557' },
    { label: 'Providence Commercial Centre, Rodney Bay', tel: '(758) 452-9557 / 720-7111' },
  ],
};

// ── Bowel prep regimens ───────────────────────────────────────────────────────

const BOWEL_PREPS = [
  {
    id: 'mag_citrate_eve',
    label: 'Magnesium Citrate — evening before (morning appointments)',
    note: 'Purchase 2 bottles of magnesium citrate from any local pharmacy before your prep day. Chill in the fridge — it is more palatable cold.',
    instructions: [
      {
        time: '2 days before procedure',
        items: ['Follow the low-residue diet all day (see diet table below)'],
      },
      {
        time: 'Day before — morning & lunch',
        items: [
          'Light low-residue meals only (e.g. white toast, white rice, boiled egg, white pasta)',
          'Avoid all fruit, all vegetables, and any high-fibre foods',
        ],
      },
      {
        time: 'Day before — midday onwards',
        items: [
          'Clear fluids ONLY from midday: water, clear broth, apple juice (no pulp), black tea or coffee (no milk), clear soft drinks, jelly / Jell-O',
          'NO milk, cream, juice with pulp, or solid food from midday onwards',
        ],
      },
      {
        time: 'Day before — 4:00 pm',
        items: [
          'Drink the first bottle of magnesium citrate (remove from fridge and drink chilled)',
          'Follow immediately with at least 2 large glasses (500 mL) of clear water',
          'Continue drinking clear fluids throughout the afternoon',
        ],
      },
      {
        time: 'Day before — 8:00 pm',
        items: [
          'Drink the second bottle of magnesium citrate',
          'Follow with at least 2 large glasses (500 mL) of clear water',
          'Continue clear fluids until midnight — then NOTHING by mouth',
        ],
      },
      {
        time: 'Morning of procedure — NOTHING by mouth',
        items: [
          'No food or drink of any kind',
          'If you are on blood pressure medication: take your tablets at 7:00 am with a small sip of water ONLY — do not eat or drink anything else',
        ],
      },
    ],
  },
  {
    id: 'mag_citrate_split',
    label: 'Magnesium Citrate — split dose (afternoon appointments)',
    note: 'Purchase 2 bottles of magnesium citrate from any local pharmacy. Chill in the fridge before use.',
    instructions: [
      {
        time: '2 days before procedure',
        items: ['Follow the low-residue diet all day (see diet table below)'],
      },
      {
        time: 'Day before — daytime',
        items: [
          'Low-residue diet all day (see diet table)',
          'Clear fluids ONLY from 6:00 pm: water, clear broth, apple juice (no pulp), black tea or coffee, jelly',
        ],
      },
      {
        time: 'Day before — 8:00 pm',
        items: [
          'Drink the first bottle of magnesium citrate (chilled)',
          'Follow with 2 large glasses (500 mL) of clear water',
          'Continue clear fluids until midnight — then nothing by mouth until morning',
        ],
      },
      {
        time: 'Morning of procedure — 5 hours before your appointment',
        items: [
          'Drink the second bottle of magnesium citrate',
          'Follow with 2 large glasses (500 mL) of clear water',
          'STOP ALL FLUIDS 2 hours before your scheduled appointment time',
        ],
      },
      {
        time: 'Blood pressure medication',
        items: [
          'If hypertensive: take your BP tablets at 7:00 am with a small sip of water only',
        ],
      },
    ],
  },
];

// ── Low-residue diet table — matches Amise Medical Services official document ─

const DIET_TABLE = [
  {
    category: 'Grains',
    allowed: [
      'White bread, rolls, biscuits, croissants, melba toast',
      'Waffles, french toast, pancakes',
      'White rice, noodles, pasta, macaroni, peeled and cooked potatoes',
      'Cooked cereals, farina',
      'Cold cereals, puffed rice, cornflakes',
    ],
    avoid: [
      'Bread with nuts, seeds, or fruits',
      'Whole wheat, pumpernickel, rye, and corn bread',
      'Potatoes with skin, brown or wild rice, and buckwheat',
    ],
  },
  {
    category: 'Vegetables',
    allowed: ['None'],
    avoid: ['All vegetables'],
  },
  {
    category: 'Fruits',
    allowed: ['Strained fruit juice', 'Melons'],
    avoid: [
      'Prunes and prune juice',
      'Raw or dried fruit',
      'All berries, figs, dates & raisins',
      'Bananas',
      'Mangoes',
    ],
  },
  {
    category: 'Dairy',
    allowed: ['Milk (plain or flavoured)', 'Yogurt, custard, ice cream', 'Cheese and cottage cheese'],
    avoid: ['Yogurts with nuts or seeds'],
  },
  {
    category: 'Meats & other proteins',
    allowed: [
      'Ground, well cooked tender beef, lamb, ham, veal, pork, fish, poultry',
      'Peanut butter without nuts',
    ],
    avoid: [
      'Tough, fibrous meats with gristle',
      'Dry beans, peas and lentils',
      'Peanut butter with nuts',
      'Tofu',
    ],
  },
  {
    category: 'Snacks, Condiments & Drinks',
    allowed: [
      'Margarine, butter, oils, mayonnaise, sour cream and salad dressing',
      'Plain gravies',
      'Sugar, clear jellies, honey and syrup',
      'Spices, cooked herbs, broth and soups made without vegetables',
      'Coffee, tea & carbonated drinks',
      'Gelatin, plain puddings, sherbet, popsicles',
      'Hard candy or pretzels',
      'Ketchup, mustard',
    ],
    avoid: [
      'Nuts, seeds, coconuts',
      'Jam, marmalade and preserves',
      'Pickles, olives, relish and horseradish',
      'Sauerkraut',
      'All desserts containing nuts and seeds, dried fruits, coconuts, or anything made from whole grains or bran',
      'Candy made of nuts and seeds',
      'Popcorn',
    ],
  },
];

// ── Medication rules ──────────────────────────────────────────────────────────

function colonMedInstructions(medications: string[]): { drug: string; instruction: string; colour: string }[] {
  const rules: { pattern: RegExp; instruction: string; colour: string }[] = [
    // Blood thinners — stop 5 days before (practice policy per patient instructions)
    { pattern: /warfarin|coumadin/i,         instruction: 'STOP 5 days before your procedure. Your surgeon will advise on bridging if needed.', colour: '#dc2626' },
    { pattern: /rivaroxaban|xarelto|apixaban|eliquis|dabigatran|pradaxa|edoxaban/i, instruction: 'STOP 48–72 hours before (or as directed by your surgeon).', colour: '#dc2626' },
    { pattern: /clopidogrel|plavix|ticagrelor|brilinta|prasugrel|effient/i, instruction: 'STOP 5 days before. If on a coronary stent, discuss with your surgeon first.', colour: '#dc2626' },
    { pattern: /aspirin/i,                    instruction: 'STOP 5 days before your procedure (blood thinner — increases polypectomy bleeding risk).', colour: '#dc2626' },
    // Vitamins / supplements — stop 3 days before
    { pattern: /iron|ferrous|feramax/i,       instruction: 'STOP 3 days before — iron interferes with bowel preparation quality.', colour: '#b45309' },
    { pattern: /vitamin|supplement|multivit/i, instruction: 'STOP 3 days before your procedure.', colour: '#b45309' },
    { pattern: /turmeric|ginger|cinnamon/i,   instruction: 'STOP 5 days before — natural blood-thinning effect.', colour: '#b45309' },
    // Diabetic agents
    { pattern: /metformin|glucophage/i,       instruction: 'HOLD on the day of preparation and day of procedure — restart once eating normally.', colour: '#b45309' },
    { pattern: /insulin/i,                    instruction: 'REDUCE dose while fasting — do not take usual insulin dose when not eating. Surgeon will advise.', colour: '#b45309' },
    // NSAIDs
    { pattern: /ibuprofen|naproxen|diclofenac|celecoxib|indomethacin/i, instruction: 'HOLD on the day of procedure — increases bleeding risk.', colour: '#b45309' },
    // Blood pressure medications — continue at 7 am
    { pattern: /amlodipine|nifedipine|felodipine|lisinopril|ramipril|enalapril|perindopril|losartan|valsartan|irbesartan|candesartan|metoprolol|atenolol|bisoprolol|carvedilol|hydralazine|hydrochlorothiazide|furosemide|spironolactone/i, instruction: 'CONTINUE — take at 7:00 am on the morning of your procedure with a small sip of water only.', colour: '#15803d' },
    // Other continue
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

// ── HTML generation ───────────────────────────────────────────────────────────

const PRACTICE_HEADER_HTML = `
  <div style="display:flex;align-items:flex-start;gap:12px;border-bottom:2px solid #b91c1c;padding-bottom:10px;margin-bottom:14px">
    <div style="flex:1">
      <div style="font-size:17px;font-weight:800;color:#b91c1c;letter-spacing:0.01em">${PRACTICE.name}</div>
      <div style="font-size:10px;color:#374151;margin-top:2px">${PRACTICE.poBox} &nbsp;|&nbsp; Email: ${PRACTICE.email}</div>
      <div style="font-size:10px;color:#374151;margin-top:1px">
        ${PRACTICE.locations.map(l => `${l.label} &mdash; Tel: ${l.tel}`).join('&nbsp;&nbsp;&nbsp;')}
      </div>
    </div>
  </div>`;

function buildDietTableHtml(): string {
  return `
  <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:6px">
    <thead>
      <tr>
        <th style="padding:6px 8px;background:#1e3a5f;color:#fff;font-weight:700;text-align:left;width:22%">Category</th>
        <th style="padding:6px 8px;background:#15803d;color:#fff;font-weight:700;text-align:left;width:39%">Recommended Foods</th>
        <th style="padding:6px 8px;background:#b91c1c;color:#fff;font-weight:700;text-align:left;width:39%">Foods to Avoid</th>
      </tr>
    </thead>
    <tbody>
      ${DIET_TABLE.map((row, i) => `
        <tr style="vertical-align:top;background:${i % 2 === 0 ? '#f8fafc' : '#fff'}">
          <td style="padding:6px 8px;font-weight:700;border:1px solid #e2e8f0;color:#1e3a5f">${row.category}</td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;color:#166534">
            <ul style="margin:0;padding-left:14px;line-height:1.6">${row.allowed.map(a => `<li>${a}</li>`).join('')}</ul>
          </td>
          <td style="padding:6px 8px;border:1px solid #e2e8f0;color:#991b1b">
            <ul style="margin:0;padding-left:14px;line-height:1.6">${row.avoid.map(a => `<li>${a}</li>`).join('')}</ul>
          </td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

function buildPrepHtml(opts: {
  type: 'colonoscopy' | 'preop';
  patientName: string; dob: string; nhiNumber: string;
  procedure: string; appointmentDate: string; appointmentTime: string;
  prep?: typeof BOWEL_PREPS[0];
  medInstructions: { drug: string; instruction: string; colour: string }[];
  allergies: string;
}): string {
  const { type, patientName, dob, nhiNumber, procedure, appointmentDate, appointmentTime, prep, medInstructions, allergies } = opts;
  const issued = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  const patientTable = `
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px">
      <tr><td style="font-weight:700;width:130px;padding:3px 0;color:#374151">Patient</td><td style="font-weight:600">${patientName || '—'}</td></tr>
      ${dob ? `<tr><td style="font-weight:700;padding:3px 0;color:#374151">Date of Birth</td><td>${dob}</td></tr>` : ''}
      ${nhiNumber ? `<tr><td style="font-weight:700;padding:3px 0;color:#374151">NHI Number</td><td>${nhiNumber}</td></tr>` : ''}
      <tr><td style="font-weight:700;padding:3px 0;color:#374151">Procedure</td><td>${procedure || '—'}</td></tr>
      <tr><td style="font-weight:700;padding:3px 0;color:#374151">Appointment</td><td>${appointmentDate || '—'}${appointmentTime ? ` at ${appointmentTime}` : ''}</td></tr>
      ${allergies ? `<tr><td style="font-weight:700;padding:3px 0;color:#dc2626">&#9888; Allergies</td><td style="color:#dc2626;font-weight:700">${allergies}</td></tr>` : ''}
    </table>`;

  let body = PRACTICE_HEADER_HTML;
  body += `<h1 style="font-size:15px;margin:0 0 10px;color:#1e293b">${type === 'colonoscopy' ? 'Colonoscopy Preparation Instructions' : 'Pre-operative Patient Instructions'}</h1>`;
  body += patientTable;

  if (type === 'colonoscopy' && prep) {
    body += `
    <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:6px;padding:10px 12px;margin-bottom:14px;font-size:11.5px;color:#78350f">
      <strong>&#128Shopping: Before you start —</strong> ${prep.note}
    </div>`;

    body += `<h2 style="font-size:13px;color:#1e3a5f;border-bottom:1.5px solid #1e3a5f;padding-bottom:4px;margin:14px 0 8px">${prep.label}</h2>`;
    for (const step of prep.instructions) {
      body += `<div style="margin-bottom:11px">
        <div style="font-size:11.5px;font-weight:700;color:#1e3a5f;margin-bottom:3px">${step.time}</div>
        <ul style="margin:0 0 0 18px;padding:0;font-size:11.5px;line-height:1.7;color:#1e293b">
          ${step.items.map(i => `<li>${i}</li>`).join('')}
        </ul>
      </div>`;
    }

    body += `
    <h2 style="font-size:13px;color:#1e3a5f;border-bottom:1.5px solid #1e3a5f;padding-bottom:4px;margin:18px 0 8px">Low-Residue Diet Guide</h2>
    <p style="font-size:11px;color:#374151;margin-bottom:8px">Follow this diet for the <strong>2 days before your preparation day</strong>. On the day of preparation, follow clear fluids only from midday (as above).</p>
    ${buildDietTableHtml()}`;

    body += `
    <h2 style="font-size:13px;color:#1e3a5f;border-bottom:1.5px solid #1e3a5f;padding-bottom:4px;margin:16px 0 8px">During the Preparation</h2>
    <ul style="margin:0 0 0 18px;padding:0;font-size:11.5px;line-height:1.8;color:#1e293b">
      <li><strong>During bowel movements — do NOT wipe.</strong> Gently dab or rinse with water to prevent irritation or burning.</li>
      <li>Stay close to a bathroom once you have taken the preparation.</li>
      <li>Keep well hydrated with clear fluids throughout the preparation day.</li>
    </ul>`;
  }

  if (type === 'preop') {
    body += `
    <h2 style="font-size:13px;color:#1e3a5f;border-bottom:1.5px solid #1e3a5f;padding-bottom:4px;margin:14px 0 8px">Fasting (NBM) Instructions</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:8px">
      <tr style="background:#f0fdfa"><td style="padding:6px 10px;font-weight:700;width:200px;border:1px solid #e2e8f0">Solid food and milk</td><td style="padding:6px 10px;border:1px solid #e2e8f0">Nothing to eat or drink from <strong>midnight the night before</strong></td></tr>
      <tr><td style="padding:6px 10px;font-weight:700;border:1px solid #e2e8f0">Clear fluids</td><td style="padding:6px 10px;border:1px solid #e2e8f0">Stop <strong>2 hours</strong> before your scheduled time<br><span style="font-size:10px;color:#6b7280">Water, black tea/coffee, apple juice without pulp, clear broth only</span></td></tr>
      <tr style="background:#f0fdfa"><td style="padding:6px 10px;font-weight:700;border:1px solid #e2e8f0">Blood pressure tablets</td><td style="padding:6px 10px;border:1px solid #e2e8f0">Take at <strong>7:00 am</strong> with a small sip of water only</td></tr>
      <tr><td style="padding:6px 10px;font-weight:700;color:#dc2626;border:1px solid #e2e8f0">Do NOT have milk or juice</td><td style="padding:6px 10px;color:#dc2626;border:1px solid #e2e8f0">These are not clear fluids — avoid within 6 hours of your procedure</td></tr>
    </table>

    <h2 style="font-size:13px;color:#1e3a5f;border-bottom:1.5px solid #1e3a5f;padding-bottom:4px;margin:14px 0 8px">What to Bring on the Day</h2>
    <ul style="margin:0 0 0 18px;padding:0;font-size:11.5px;line-height:1.8;color:#1e293b">
      <li>This instruction sheet</li>
      <li>Photo ID and health / insurance card (NHI card if you have one)</li>
      <li>All current medications in their original packaging</li>
      <li>Loose, comfortable clothing that is easy to put on after your procedure</li>
      <li><strong>A responsible adult to take you home</strong> — you cannot drive after sedation or general anaesthesia</li>
      <li>Contact phone number for your escort (we will call when you are in recovery)</li>
    </ul>`;
  }

  if (medInstructions.length > 0) {
    body += `
    <h2 style="font-size:13px;color:#1e3a5f;border-bottom:1.5px solid #1e3a5f;padding-bottom:4px;margin:18px 0 8px">Your Medication Instructions</h2>
    <table style="width:100%;border-collapse:collapse;font-size:11.5px">
      <tr style="background:#1e293b;color:#fff">
        <th style="padding:6px 8px;text-align:left;font-weight:700;width:30%">Medication</th>
        <th style="padding:6px 8px;text-align:left;font-weight:700">Instruction</th>
      </tr>
      ${medInstructions.map((m, i) => `<tr style="${i % 2 === 0 ? 'background:#f8fafc' : ''}">
        <td style="padding:6px 8px;font-weight:700;color:#1e293b;border-bottom:1px solid #e2e8f0">${m.drug}</td>
        <td style="padding:6px 8px;color:${m.colour};font-weight:600;border-bottom:1px solid #e2e8f0">${m.instruction}</td>
      </tr>`).join('')}
    </table>`;
  }

  // Special instructions always shown for colonoscopy
  if (type === 'colonoscopy') {
    body += `
    <h2 style="font-size:13px;color:#1e3a5f;border-bottom:1.5px solid #1e3a5f;padding-bottom:4px;margin:18px 0 8px">Additional Important Instructions</h2>
    <ul style="margin:0 0 0 18px;padding:0;font-size:11.5px;line-height:1.9;color:#1e293b">
      <li><strong>Remove all metal items</strong> before your appointment — jewellery, piercings, watches, and accessories. Metal can interfere with electrocautery during the procedure.</li>
      <li><strong>Arrange a responsible adult to drive you home</strong> — you cannot drive after sedation. Please make these arrangements before your procedure day.</li>
      <li><strong>Blood thinners:</strong> stop aspirin, warfarin, plavix, and supplements such as turmeric, ginger, and cinnamon <strong>5 days before</strong>.</li>
      <li><strong>Vitamins and iron tablets / supplements:</strong> stop <strong>3 days before</strong> your procedure.</li>
      <li><strong>Blood pressure medication:</strong> if you are hypertensive, take your medication at <strong>7:00 am on the morning of your procedure</strong> with a small sip of water.</li>
    </ul>`;
  }

  body += `
  <div style="margin-top:20px;padding:10px 12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:6px;font-size:11px;color:#991b1b">
    <strong>&#9888; Emergency:</strong> If you develop a fever, severe abdominal pain, heavy rectal bleeding, or feel very unwell, call our office or attend the nearest emergency department immediately. Do not take the preparation if you are unwell — call us first.
  </div>
  <div style="margin-top:16px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;line-height:1.6">
    Issued by Amise Medical Services &middot; Dr Dawit Daniel Kabiye, MD, DM &middot; ${issued}<br>
    This document is for <strong>${patientName || 'the named patient'}</strong> only. If you have any questions, call (758) 459-2227 / 284-0557 (Tapion) or (758) 452-9557 / 720-7111 (Rodney Bay).
  </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>${type === 'colonoscopy' ? 'Colonoscopy Preparation' : 'Pre-operative Instructions'} — ${patientName || 'Patient'}</title>
  <style>body{font-family:Arial,Helvetica,sans-serif;max-width:780px;margin:32px auto;color:#1e293b;font-size:12px;line-height:1.5}@media print{body{margin:16px;max-width:100%}}</style>
  </head><body>${body}</body></html>`;
}

// ── Component ─────────────────────────────────────────────────────────────────

type PrepMode = 'preop' | 'colonoscopy';

export default function PatientPrepCard() {
  const { patientName, dob, nhiNumber, allergies: allergyText, medications, plan, assessment } = useAppContext();
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
  const medInstructions = colonMedInstructions(medications ?? []);

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
      medInstructions,
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
            <strong>NBM from midnight</strong> — no food or drink from midnight the night before. Clear fluids stop 2 hours before. Blood pressure medication at 7:00 am with a sip of water only.
          </div>
          <div style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6 }}>
            <strong>What to bring:</strong> photo ID, NHI card, all medications in original packaging, loose comfortable clothing, and a responsible adult to drive you home.
          </div>
          <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6 }}>
            <strong>Remove all metal</strong> before your appointment — jewellery, piercings, watches, accessories. Metal interferes with electrocautery.
          </div>
        </div>
      )}

      {/* Medication instructions preview */}
      {medInstructions.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            Medication Instructions (from patient record)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {medInstructions.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 10px', background: '#f8fafc', borderRadius: 5, border: '1px solid #e2e8f0', fontSize: 11.5 }}>
                <span style={{ fontWeight: 700, minWidth: 140, color: '#1e293b', flexShrink: 0 }}>{m.drug}</span>
                <span style={{ color: m.colour, fontWeight: 600 }}>{m.instruction}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
