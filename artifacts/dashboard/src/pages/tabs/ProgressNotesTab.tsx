import { useState, useMemo } from 'react';
import { useAppContext, type ProgressNote } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import { saveClinicalNote } from '@/lib/db';
import CollapsibleCard from '@/components/CollapsibleCard';
import { printDoc, saveBlobAsPDF } from './lib/pdfExport';
import { escH as escHDoc, T, AMISE_LOGO_SVG } from './lib/docTemplate';

// ── Symptom chips (follow-up / post-op focused) ──────────────────────────────
const FU_SYMPTOMS = [
  'Well / No complaints', 'Wound pain', 'Wound discharge', 'Fever',
  'Nausea', 'Vomiting', 'Constipation', 'Diarrhoea', 'Bloating',
  'Poor appetite', 'Shortness of breath', 'Chest pain', 'Palpitations',
  'Urinary symptoms', 'Lower limb swelling', 'Fatigue',
  'Bleeding / PR bleeding', 'Shoulder tip pain', 'Reflux / heartburn',
];

// ── Examination chips by system ──────────────────────────────────────────────
const EXAM_CHIPS: Record<string, string[]> = {
  general: [
    'Alert & oriented ×3', 'Comfortable at rest', 'In mild distress', 'In severe distress',
    'Afebrile', 'Febrile', 'Well-nourished', 'Cachectic', 'Pale', 'Jaundiced', 'Well-hydrated',
  ],
  cvs: [
    'Regular rate and rhythm', 'S1 S2 present', 'No murmur', 'Murmur present',
    'Tachycardic', 'Bradycardic', 'No peripheral oedema', 'Peripheral oedema +',
    'Cap refill < 2 s', 'Peripheral pulses intact',
  ],
  rs: [
    'Bilateral air entry', 'Clear to auscultation', 'No wheeze', 'Wheeze',
    'Basal crackles L', 'Basal crackles R', 'Reduced air entry L', 'Reduced air entry R',
    'SpO₂ adequate on air', 'Tachypnoeic', 'Using accessory muscles',
  ],
  abdomen: [
    'Soft', 'Non-tender', 'Tender RUQ', 'Tender epigastrium', 'Tender RIF',
    'Diffuse tenderness', 'Guarding', 'Rebound tenderness', 'Distended',
    'Bowel sounds present', 'Bowel sounds absent', 'No organomegaly',
    'Wound intact', 'Drain in situ', 'Stoma pink and viable',
  ],
  wound: [
    'Clean', 'Dry', 'Intact', 'Healing well', 'Erythema', 'Warmth',
    'Serous discharge', 'Purulent discharge', 'Haematoma', 'Dehiscence',
    'Sutures intact', 'Staples intact', 'Dressing changed', 'VAC in situ',
  ],
  limbs: [
    'No oedema', 'Pitting oedema +', 'Pitting oedema ++', 'No calf tenderness',
    'Calf tenderness R', 'Calf tenderness L', 'Peripheral pulses intact',
    'Reduced pedal pulses', 'DVT excluded clinically', 'Neurovascular intact',
  ],
};

// ── Management template library (25 templates) ───────────────────────────────
const MGMT_TEMPLATES: { label: string; plan: string }[] = [
  {
    label: 'Post-OGD (Upper Endoscopy)',
    plan: `MONITORING\n- Vitals q1h × 4 h; observe for bleeding, perforation, respiratory depression.\n- Maintain IV access; keep NBM until gag reflex fully recovered.\n\nMEDICATIONS\n- Resume home medications after 2 h if tolerating fluids.\n- Pantoprazole 40 mg IV BD if erosions or ulcers noted.\n\nDIET\n- Clear fluids → soft diet at 2 h if no complications.\n\nFOLLOW-UP\n- Biopsy results in 5–7 business days.\n- Review in surgical OPD in 2 weeks with report.`,
  },
  {
    label: 'Post-Colonoscopy',
    plan: `MONITORING\n- Vitals q1h × 4 h; observe for PR bleeding, abdominal pain, fever.\n- Maintain IV access; observe for post-polypectomy syndrome.\n\nMEDICATIONS\n- Resume home medications after 2 h.\n- If polypectomy done: avoid NSAIDs / anticoagulants × 7 days.\n\nDIET\n- Normal diet after recovery from sedation (2–4 h).\n\nFOLLOW-UP\n- Histology results in 5–7 business days; next colonoscopy per result.`,
  },
  {
    label: 'Post-ERCP — Day 1',
    plan: `MONITORING\n- Vitals q4h; strict NBM; serum amylase at 4 h and 24 h.\n- Strict fluid balance; IDC in situ.\n\nMEDICATIONS\n- IV fluids: compound sodium lactate 125 mL/h × 24 h.\n- Analgesia: paracetamol 1 g IV q6h ± ketorolac 15 mg IV q8h.\n- Antibiotics if cholangitis: piperacillin-tazobactam 4.5 g IV q8h.\n- Pantoprazole 40 mg IV BD.\n\nDIET\n- NBM until amylase < 3× ULN; then clear fluids, advance as tolerated.\n\nINVESTIGATIONS\n- FBC, UEC, LFTs, amylase at 4 h and 24 h.`,
  },
  {
    label: 'Post-ERCP — Day 2–3',
    plan: `MONITORING\n- Vitals q6h; resume diet if amylase < 3× ULN.\n- Monitor for sepsis or perforation signs.\n\nMEDICATIONS\n- Switch to oral antibiotics if clinically improved.\n- Paracetamol 1 g q6h PO; pantoprazole 40 mg PO BD.\n\nDIET\n- Soft diet → regular diet as tolerated.\n\nFOLLOW-UP\n- Repeat LFTs pre-discharge; target downtrending bilirubin.\n- Surgical OPD in 2 weeks.`,
  },
  {
    label: 'Post-Laparoscopic Cholecystectomy — Day 1',
    plan: `MONITORING\n- Vitals q4h; early mobilisation.\n- Wound sites check; drain output < 50 mL/24 h before removal.\n- Monitor shoulder tip pain.\n\nMEDICATIONS\n- Paracetamol 1 g q6h + ketorolac 15–30 mg q8h × 48 h.\n- Enoxaparin 40 mg SC OD (DVT prophylaxis).\n- Pantoprazole 40 mg PO BD.\n\nDIET\n- Clear fluids → light diet as tolerated; avoid fatty meals × 4–6 weeks.\n\nINVESTIGATIONS\n- FBC, UEC, LFTs Day 1 post-op.`,
  },
  {
    label: 'Post-Laparoscopic Cholecystectomy — Discharge',
    plan: `MEDICATIONS\n- Paracetamol 1 g q6h × 5 days.\n- Ibuprofen 400 mg TDS with food × 3 days (if no renal impairment).\n- Pantoprazole 40 mg OD × 4 weeks.\n\nWOUND CARE\n- Port sites clean and dry × 48 h; clips/sutures removed in OPD or GP at 7–10 days.\n\nACTIVITY\n- Light activity in 1–2 weeks; driving in 2 weeks; heavy lifting after 4 weeks.\n\nDIET\n- Low-fat diet × 4–6 weeks; introduce fatty foods gradually.\n\nFOLLOW-UP\n- OPD in 2 weeks with histology result.`,
  },
  {
    label: 'Post-Appendectomy',
    plan: `MONITORING\n- Vitals q4h; wound check at 24 h; drain output if drain in situ.\n\nMEDICATIONS\n- Cefuroxime 1.5 g IV q8h + metronidazole 500 mg IV q8h × 24 h (switch to oral if uncomplicated).\n- Paracetamol 1 g q6h ± ketorolac q8h; LMWH prophylaxis.\n\nDIET\n- Clear fluids → light diet; full diet once bowel sounds present.\n\nFOLLOW-UP\n- Histology result 5–7 days; OPD in 2 weeks.`,
  },
  {
    label: 'Post-Open Hernia Repair',
    plan: `MONITORING\n- Vitals q4h; scrotal haematoma and urinary retention watch.\n\nMEDICATIONS\n- Paracetamol + ibuprofen alternating q4h.\n- LMWH if BMI > 30.\n\nWOUND CARE\n- Scrotal support; ice pack × 24 h; wound dry × 48 h.\n\nACTIVITY\n- Ambulate same day; avoid heavy lifting × 6 weeks; driving after 2 weeks.\n\nFOLLOW-UP\n- OPD in 2 weeks.`,
  },
  {
    label: 'Post-Laparoscopic Hernia Repair (TEP/TAPP)',
    plan: `MONITORING\n- Trocar site inspection; urinary retention check.\n\nMEDICATIONS\n- Paracetamol + NSAID; LMWH if indicated.\n\nWOUND CARE\n- Port sites dry × 48 h; dressings off at 48 h.\n\nACTIVITY\n- Return to work in 1 week (desk), 4 weeks (manual); no heavy lifting × 4 weeks.\n\nFOLLOW-UP\n- OPD in 2 weeks.`,
  },
  {
    label: 'Post-Bowel Resection / Anastomosis — Day 1',
    plan: `MONITORING\n- Vitals q2h; strict fluid balance; IDC.\n- Drain character: feculent = anastomotic leak → urgent surgical review.\n- Watch for: fever, tachycardia, peritonism.\n\nMEDICATIONS\n- IV fluids per haemodynamic assessment.\n- Broad-spectrum antibiotics × 5–7 days.\n- PCA or epidural analgesia; PPI; anti-emetics; LMWH.\n\nDIET\n- NBM; ERAS sips at 24–48 h if no ileus.\n\nINVESTIGATIONS\n- FBC, UEC, CRP daily × 3 days.\n\nFOLLOW-UP\n- Stoma nurse if defunctioning stoma; oncology for malignant resections.`,
  },
  {
    label: 'Post-Thyroidectomy',
    plan: `MONITORING\n- Vitals q2h × 12 h; haematoma and airway watch.\n- Serum calcium at 6 h, 12 h, 24 h; voice assessment.\n\nMEDICATIONS\n- Calcium carbonate 1500 mg TDS + calcitriol (prophylaxis).\n- Levothyroxine 50–100 mcg OD if total thyroidectomy.\n- Paracetamol ± NSAID for analgesia.\n\nWOUND CARE\n- Drain output hourly × 4 h then q4h.\n\nFOLLOW-UP\n- Histology 5–7 days; TFTs and endocrinology in 6 weeks.`,
  },
  {
    label: 'Post-Breast Surgery (Lumpectomy / Mastectomy)',
    plan: `MONITORING\n- Vitals q4h; seroma and haematoma check.\n- Drain out when < 30 mL/24 h.\n\nMEDICATIONS\n- Paracetamol + NSAID; co-amoxiclav 625 mg TDS × 5 days; LMWH.\n\nACTIVITY\n- Shoulder physio from Day 1 (lumpectomy) / Day 2 (mastectomy).\n- Arm precautions if axillary clearance done.\n\nFOLLOW-UP\n- Histology + receptor results 7–10 days; oncology MDT discussion.`,
  },
  {
    label: 'Post-Haemorrhoidectomy',
    plan: `MONITORING\n- Pain assessment q4h; urinary retention check; first bowel action by Day 2–3.\n\nMEDICATIONS\n- Paracetamol 1 g q6h + NSAID + opioid PRN.\n- Lactulose 20 mL BD + ispaghula husk BD.\n- Topical lignocaine gel to wound.\n- Metronidazole 400 mg TDS × 7 days.\n\nHYGIENE\n- Sitz baths ×3/day; soft toilet tissue.\n\nFOLLOW-UP\n- OPD in 2 weeks; 6–8 weeks recovery for heavy labour.`,
  },
  {
    label: 'Post-Proctoscopy / Sigmoidoscopy',
    plan: `MONITORING\n- Observe 1 h; check for PR bleeding.\n\nMEDICATIONS\n- Post-banding: avoid NSAIDs/anticoagulants × 7 days; paracetamol only.\n\nDIET\n- Normal diet resumed immediately.\n\nFOLLOW-UP\n- Histology 5–7 days if biopsies taken; OPD in 2–4 weeks.`,
  },
  {
    label: 'Acute Cholecystitis — Conservative',
    plan: `MONITORING\n- Vitals q4h; strict fluid balance; CRP and WBC at 48 h.\n\nMEDICATIONS\n- IV fluids: compound sodium lactate at maintenance.\n- IV antibiotics: piperacillin-tazobactam 4.5 g q8h.\n- Analgesia: paracetamol + ketorolac q8h ± opioid.\n\nINVESTIGATIONS\n- FBC, UEC, LFTs, CRP, amylase; MRCP if CBD stone suspected.\n\nPLAN\n- Interval laparoscopic cholecystectomy 6–8 weeks (or early if improving at 72 h).`,
  },
  {
    label: 'Acute Pancreatitis — Mild/Moderate',
    plan: `MONITORING\n- Vitals q2h; strict fluid balance; IDC if oliguria.\n- Ranson at admission and 48 h; CT abdomen at 72 h if severe.\n\nMEDICATIONS\n- Aggressive IV fluids: compound sodium lactate 250–500 mL/h × 4 h then 125 mL/h.\n- Analgesia: paracetamol + opioid titration.\n- Ondansetron 4 mg IV q8h; pantoprazole 40 mg IV BD.\n- NBM × 24–48 h; NG enteral feeding if not tolerating.\n\nINVESTIGATIONS\n- FBC, UEC, LFTs, amylase, lipase, glucose, Ca²⁺, CRP.\n\nPLAN\n- Treat cause: ERCP if gallstone; abstinence if alcoholic.`,
  },
  {
    label: 'Bowel Obstruction — Conservative',
    plan: `MONITORING\n- Vitals q2h; IDC; NG tube output; abdominal exam q4h.\n- Peritonism = emergency surgery; AXR at 12 h if not improving.\n\nMEDICATIONS\n- IV fluids 1–2 L bolus then 125 mL/h; replace NG losses 1:1.\n- Morphine 2.5–5 mg IV q4h PRN (do not withhold).\n- Antibiotics if strangulation / contamination suspected.\n\nINVESTIGATIONS\n- AXR; CT abdomen/pelvis (oral + IV contrast); FBC, UEC, lactate.\n\nPLAN\n- Trial conservative × 24–48 h; surgery if: closed-loop, strangulation, fails to resolve.`,
  },
  {
    label: 'Wound Infection / SSI',
    plan: `MONITORING\n- Wound inspection daily; wound swab C&S; temperature chart.\n\nMEDICATIONS\n- Superficial SSI: wound opening + irrigation; co-amoxiclav 625 mg TDS oral.\n- Deep / organ space: IV antibiotics + surgical exploration.\n- Antimicrobial dressings: AQUACEL Ag or povidone-iodine.\n\nWOUND CARE\n- Daily dressings; wound VAC if large cavity.\n- Secondary closure at 5–7 days once clean.\n\nFOLLOW-UP\n- OPD wound review in 1 week.`,
  },
  {
    label: 'Diabetic Foot — Wound Management',
    plan: `MONITORING\n- Daily wound inspection with photography; pedal pulses; ABPI.\n- Blood glucose TDS; HbA1c target < 7.5%.\n\nMEDICATIONS\n- IV antibiotics: piperacillin-tazobactam or meropenem if deep/osteomyelitis.\n- Insulin optimisation; statin + antiplatelet if PAD.\n\nWOUND CARE\n- Off-loading: total contact cast or surgical shoe.\n- AQUACEL Ag / PHMB dressings; debridement at dressing change.\n- Podiatry referral.\n\nINVESTIGATIONS\n- Blood culture; wound swab; foot X-ray; MRI if osteomyelitis suspected.`,
  },
  {
    label: 'Post-op Ileus',
    plan: `MONITORING\n- Bowel sounds assessment; abdominal girth; NG drainage.\n- CT if mechanical obstruction suspected (> 5 days).\n\nMEDICATIONS\n- NBM; IV fluids at maintenance; correct hypokalaemia (target K ≥ 4.0).\n- Avoid opioids; switch to paracetamol + NSAID.\n- Bisacodyl 10 mg PR BD; metoclopramide 10 mg IV q8h PRN.\n\nACTIVITY\n- Early mobilisation BD — key intervention.\n\nFOLLOW-UP\n- Reassess in 24 h; surgery if mechanical cause identified.`,
  },
  {
    label: 'Perforated Peptic Ulcer — Post-op',
    plan: `MONITORING\n- Vitals q2h; strict fluid balance; IDC; NG tube; drain output.\n- Feculent drain = anastomotic breakdown → urgent surgical review.\n\nMEDICATIONS\n- Piperacillin-tazobactam 4.5 g IV q8h × 5 days.\n- Omeprazole 40 mg IV BD → oral when tolerating.\n- PCA analgesia; LMWH prophylaxis.\n- H. pylori eradication once oral intake established.\n\nINVESTIGATIONS\n- FBC, UEC, CRP Day 1, 3, 5; H. pylori serology.\n\nFOLLOW-UP\n- OPD in 4 weeks; upper GI endoscopy in 8 weeks to confirm healing.`,
  },
  {
    label: 'Outpatient — 2-Week Follow-up',
    plan: `REVIEW\n- Wound inspection; suture/clip removal if not done.\n- Check: SSI, seroma, haematoma, DVT.\n- Histology / biopsy results review.\n\nSYMPTOMS\n- Pain controlled; returning to baseline activity.\n- Bowel habit normalised; no PR bleeding.\n\nPLAN\n- Cease antibiotics if course complete; continue PPI if indicated.\n- Refer oncology / MDT if indicated.\n- Next review in 4–6 weeks OR discharge to GP if uncomplicated.`,
  },
  {
    label: 'Outpatient — 6-Week Follow-up',
    plan: `REVIEW\n- Return to full activity; fitness for work assessment.\n- Chronic wound issues, mesh complications, recurrence check.\n- Post-thyroidectomy: TFTs; post-breast: hormone receptor results.\n\nINVESTIGATIONS\n- Repeat LFTs / tumour markers if indicated.\n- Interval CT or surveillance endoscopy per protocol.\n\nPLAN\n- Discharge to GP with referral letter, OR onward specialist / oncology referral.`,
  },
  {
    label: 'Stoma Follow-up',
    plan: `REVIEW\n- Stoma viability: colour, mucosa; check retraction, prolapse, parastomal hernia.\n- Appliance fitting; peristomal skin condition.\n- Output: consistency, volume; dietary adjustment.\n\nEDUCATION\n- Confirm patient independence with appliance; stoma nurse ongoing support.\n- Hydration advice; avoid gas-forming foods.\n\nINVESTIGATIONS\n- Electrolytes if high-output ileostomy.\n\nPLAN\n- Stoma reversal timeline if appropriate; oncology follow-up if malignancy.`,
  },
  {
    label: 'Oncology Follow-up',
    plan: `REVIEW\n- ECOG performance status; weight; symptom burden; treatment toxicity.\n- Wound / port site if applicable.\n\nINVESTIGATIONS\n- Tumour markers: CEA, CA 19-9, CA 125 as appropriate.\n- Interval CT / MRI / PET for staging; FBC, UEC, LFTs if on systemic therapy.\n\nPLAN\n- MDT review if recurrence or progression.\n- Palliative care referral if indicated.\n- Next scan / review date: ___\n- Psychosocial support offered.`,
  },
];

const VITALS_FIELDS = [
  { key: 'bp',     label: 'BP (mmHg)',  placeholder: '120/80' },
  { key: 'hr',     label: 'HR (bpm)',   placeholder: '72' },
  { key: 'temp',   label: 'Temp (°C)', placeholder: '37.2' },
  { key: 'spo2',   label: 'SpO₂ (%)',  placeholder: '98' },
  { key: 'rr',     label: 'RR (/min)', placeholder: '14' },
  { key: 'weight', label: 'Weight (kg)', placeholder: '70' },
];

const INTERVALS_IP = ['Admission', 'Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7', 'Day 10', 'Day 14', 'Pre-discharge'];
const INTERVALS_OP = ['Day of Procedure', '1 Week', '2 Weeks', '3 Weeks', '1 Month', '6 Weeks', '2 Months', '3 Months', '6 Months', 'Annual', 'PRN / Unscheduled'];

// ── PDF builder for a single note ─────────────────────────────────────────────
function buildNoteHtml(note: ProgressNote, patientName: string, siteName: string): string {
  const esc = escHDoc;
  const row = (label: string, val: string) =>
    val ? `<tr><td style="font-size:10px;font-weight:700;color:${T.mute};padding:3px 8px 3px 0;width:130px;vertical-align:top">${esc(label)}</td><td style="font-size:11px;color:${T.ink};padding:3px 0;white-space:pre-wrap">${esc(val)}</td></tr>` : '';

  const vtRow = Object.entries(note.vitals)
    .filter(([, v]) => v)
    .map(([k, v]) => `<span style="margin-right:12px;font-size:11px"><strong>${esc(k.toUpperCase())}</strong> ${esc(v ?? '')}</span>`)
    .join('');

  const examRows = [
    ['General', note.examGeneral], ['CVS', note.examCvs], ['RS', note.examRs],
    ['Abdomen', note.examAbdomen], ['Wound / Surgical site', note.examWound],
    ['Limbs', note.examLimbs], ['Other', note.examOther],
  ].filter(([, v]) => v).map(([l, v]) => row(l, v)).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#fff;color:${T.ink}}
  .page{width:754px;margin:0 auto;padding:32px 40px}
  h1{font-size:15px;font-weight:800;color:${T.navy};margin:0 0 2px}
  h2{font-size:12px;font-weight:700;color:${T.navy};margin:14px 0 6px;text-transform:uppercase;letter-spacing:0.07em;border-bottom:1px solid #e5e7eb;padding-bottom:3px}
  table{border-collapse:collapse;width:100%}
  .chip{display:inline-block;background:${T.navy}18;color:${T.navy};border-radius:9px;padding:1px 7px;font-size:10px;font-weight:600;margin-right:4px}
</style>
</head><body><div class="page">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid ${T.gold};padding-bottom:10px;margin-bottom:14px">
    <div>
      <h1>${esc(patientName || 'Patient')} — ${esc(note.type)}</h1>
      <div style="font-size:10.5px;color:${T.mute};margin-top:2px">${esc(siteName)} · ${esc(note.date)} · ${esc(note.author)}${note.interval ? ` · <strong>${esc(note.interval)}</strong>` : ''}</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
      ${AMISE_LOGO_SVG}
      <span class="chip">${esc(note.type)}</span>
    </div>
  </div>

  ${note.chiefComplaint || note.symptoms.length || note.intervalHistory ? `
  <h2>S — Subjective</h2>
  <table>${[
    ['Chief Complaint', note.chiefComplaint],
    ['Symptoms', note.symptoms.join(', ')],
    ['Interval History', note.intervalHistory],
  ].filter(([, v]) => v).map(([l, v]) => row(l, v)).join('')}</table>` : ''}

  ${vtRow || examRows ? `
  <h2>O — Objective</h2>
  ${vtRow ? `<div style="margin-bottom:8px;padding:6px 10px;background:#f8fafc;border-radius:6px">${vtRow}</div>` : ''}
  ${examRows ? `<table>${examRows}</table>` : ''}` : ''}

  ${note.assessment ? `
  <h2>A — Assessment</h2>
  <div style="font-size:11px;white-space:pre-wrap">${esc(note.assessment)}</div>` : ''}

  ${note.plan ? `
  <h2>P — Plan</h2>
  <div style="font-size:11px;white-space:pre-wrap">${esc(note.plan)}</div>` : ''}

  <div style="margin-top:24px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:9.5px;color:${T.mute}">
    Amise Medical Services, Saint Lucia · ${esc(note.date)} · Clinician: ${esc(note.author)}
  </div>
</div></body></html>`;
}

// ── Chip toggle helper ────────────────────────────────────────────────────────
function toggleChip(current: string[], chip: string): string[] {
  return current.includes(chip) ? current.filter(c => c !== chip) : [...current, chip];
}

// ── Exam section component ────────────────────────────────────────────────────
function ExamSection({ systemKey, label, chips, selected, onToggle, note, onNote }: {
  systemKey: string; label: string; chips: string[];
  selected: string[]; onToggle: (chip: string) => void;
  note: string; onNote: (v: string) => void;
}) {
  const C = { teal: '#1F7A8C', muted: '#6B7280' };
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 6 }}>
        {chips.map(chip => {
          const on = selected.includes(chip);
          return (
            <button key={chip} type="button" onClick={() => onToggle(chip)}
              style={{ padding: '3px 10px', borderRadius: 14, fontSize: 12, cursor: 'pointer', fontWeight: on ? 700 : 400, transition: 'all 0.1s', border: `1px solid ${on ? C.teal : '#d1d5db'}`, background: on ? C.teal : '#f9fafb', color: on ? '#fff' : '#374151' }}>
              {chip}
            </button>
          );
        })}
      </div>
      <textarea value={note} onChange={e => onNote(e.target.value)}
        placeholder={`Additional ${label.toLowerCase()} findings…`}
        style={{ width: '100%', fontSize: 12, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, resize: 'vertical', minHeight: 44, boxSizing: 'border-box' }}
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ProgressNotesTab() {
  const ctx = useAppContext();
  const { profile } = useAuth();
  const { showToast } = useToast();

  const C = { navy: '#0B2545', teal: '#1F7A8C', gold: '#C8A24B', muted: '#6B7280', terra: '#9B5E3A' };
  const INP: React.CSSProperties = { width: '100%', padding: '6px 9px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' };
  const BTN: React.CSSProperties = { padding: '7px 16px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 };

  // ── Form state ──────────────────────────────────────────────────────────────
  const [noteType, setNoteType] = useState<'SOAP' | 'Ward Round' | 'Follow-up'>('SOAP');
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [author, setAuthor] = useState(profile?.full_name ?? 'Dr. Dawit D Kabiye');
  const [saving, setSaving] = useState(false);
  const [interval, setInterval] = useState('');

  // S — Subjective
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [intervalHistory, setIntervalHistory] = useState('');

  // O — Objective
  const [vitals, setVitals] = useState<Record<string, string>>({});

  function pullLatestVitals() {
    const latest = ctx.vitalRecords.at(-1);
    if (!latest) return;
    setVitals({
      bp: latest.sbp ? (latest.dbp ? `${latest.sbp}/${latest.dbp}` : latest.sbp) : '',
      hr: latest.hr ?? '', temp: latest.temp ?? '', spo2: latest.spo2 ?? '',
      rr: latest.rr ?? '', weight: latest.weight ?? '',
    });
  }
  const [examChips, setExamChips] = useState<Record<string, string[]>>({
    general: [], cvs: [], rs: [], abdomen: [], wound: [], limbs: [],
  });
  const [examNotes, setExamNotes] = useState<Record<string, string>>({
    general: '', cvs: '', rs: '', abdomen: '', wound: '', limbs: '', other: '',
  });

  // A — Assessment
  const [assessment, setAssessment] = useState('');

  // P — Plan
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [plan, setPlan] = useState('');

  const [expandedNote, setExpandedNote] = useState<string | null>(null);

  // Auto-compute post-op day
  const postOpDay = useMemo(() => {
    if (!ctx.dateAdmission || !date) return null;
    const days = Math.round((new Date(date).getTime() - new Date(ctx.dateAdmission).getTime()) / 86_400_000);
    return days >= 0 ? days : null;
  }, [ctx.dateAdmission, date]);

  const intervals = ctx.encounterMode === 'inpatient' ? INTERVALS_IP : INTERVALS_OP;

  function handleExamChipToggle(sys: string, chip: string) {
    setExamChips(prev => ({ ...prev, [sys]: toggleChip(prev[sys] ?? [], chip) }));
  }

  function buildExamText(sys: string): string {
    const chips = examChips[sys] ?? [];
    const note = examNotes[sys] ?? '';
    return [chips.join('. '), note.trim()].filter(Boolean).join('. ');
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const intervalLabel = interval || (postOpDay !== null ? `Post-op Day ${postOpDay}` : '');
      const note: ProgressNote = {
        id: crypto.randomUUID(),
        date, author, type: noteType, interval: intervalLabel,
        chiefComplaint,
        symptoms: selectedSymptoms,
        intervalHistory,
        vitals,
        examGeneral: buildExamText('general'),
        examCvs:     buildExamText('cvs'),
        examRs:      buildExamText('rs'),
        examAbdomen: buildExamText('abdomen'),
        examWound:   buildExamText('wound'),
        examLimbs:   buildExamText('limbs'),
        examOther:   examNotes.other ?? '',
        assessment,
        plan,
      };
      ctx.setProgressNotes([note, ...ctx.progressNotes]);

      if (ctx.patientId && ctx.encounterId) {
        const { error } = await saveClinicalNote(note, ctx.patientId, ctx.encounterId);
        if (error) {
          console.error('[progress-notes] save failed:', error);
          showToast(`Save failed: ${error}`, 'error');
          return;
        }
      }

      // Reset form
      setChiefComplaint(''); setSelectedSymptoms([]); setIntervalHistory('');
      setVitals({});
      setExamChips({ general: [], cvs: [], rs: [], abdomen: [], wound: [], limbs: [] });
      setExamNotes({ general: '', cvs: '', rs: '', abdomen: '', wound: '', limbs: '', other: '' });
      setAssessment(''); setPlan(''); setSelectedTemplate(''); setInterval('');
      setDate(today);
    } finally {
      setSaving(false);
    }
  }

  const siteLabels: Record<string, string> = { rodney_bay: 'Rodney Bay', castries: 'Castries', tapion: 'Tapion Hospital' };
  const siteName = siteLabels[ctx.currentSite] ?? 'Amise Medical';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Header */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: `2px solid ${C.teal}`, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: C.navy, flex: 1 }}>
          Progress Notes {ctx.encounterMode === 'inpatient' ? '(Inpatient / Ward)' : '(Outpatient)'}
        </span>
        <span style={{ fontSize: 12, color: C.muted }}>{ctx.progressNotes.length} note{ctx.progressNotes.length !== 1 ? 's' : ''} saved</span>
      </div>

      {/* Saved notes */}
      {ctx.progressNotes.length > 0 && (
        <CollapsibleCard title={`Saved Notes (${ctx.progressNotes.length})`} defaultOpen>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ctx.progressNotes.map(note => {
              const expanded = expandedNote === note.id;
              return (
                <div key={note.id} style={{ border: `1.5px solid #d6cfc8`, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ background: C.teal + '18', padding: '7px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setExpandedNote(expanded ? null : note.id)}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.teal }}>{note.type}</span>
                      {note.interval && <span style={{ fontSize: 11, background: C.teal + '30', color: C.teal, borderRadius: 9, padding: '1px 7px', fontWeight: 700 }}>{note.interval}</span>}
                      <span style={{ fontSize: 11, color: C.muted }}>{note.date} · {note.author}</span>
                      {note.chiefComplaint && <span style={{ fontSize: 11, color: '#374151' }}>— {note.chiefComplaint}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button type="button"
                        onClick={e => { e.stopPropagation(); printDoc(buildNoteHtml(note, ctx.patientName, siteName)); }}
                        style={{ ...BTN, padding: '3px 9px', fontSize: 11, background: C.navy, color: '#fff' }}>🖨</button>
                      <button type="button"
                        onClick={e => { e.stopPropagation(); void saveBlobAsPDF(buildNoteHtml(note, ctx.patientName, siteName), `Note_${note.date}_${note.type.replace(' ', '')}.pdf`); }}
                        style={{ ...BTN, padding: '3px 9px', fontSize: 11, background: C.teal, color: '#fff' }}>↓</button>
                      <button type="button"
                        onClick={e => { e.stopPropagation(); ctx.setProgressNotes(ctx.progressNotes.filter(n => n.id !== note.id)); }}
                        style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
                      <span style={{ color: C.muted, fontSize: 12 }}>{expanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {expanded && (
                    <div style={{ padding: '10px 14px', fontSize: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                      {[
                        ['Chief complaint', note.chiefComplaint],
                        ['Symptoms', note.symptoms.join(', ')],
                        ['Interval history', note.intervalHistory],
                        ['Vitals', Object.entries(note.vitals).filter(([,v]) => v).map(([k,v]) => `${k.toUpperCase()} ${v}`).join(' · ')],
                        ['General', note.examGeneral],
                        ['CVS', note.examCvs],
                        ['RS', note.examRs],
                        ['Abdomen', note.examAbdomen],
                        ['Wound', note.examWound],
                        ['Limbs', note.examLimbs],
                        ['Other', note.examOther],
                        ['Assessment', note.assessment],
                        ['Plan', note.plan],
                      ].filter(([, v]) => v).map(([label, val]) => (
                        <div key={label} style={{ gridColumn: (val ?? '').length > 80 ? '1 / -1' : undefined }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
                          <div style={{ color: '#1a1a1a', whiteSpace: 'pre-wrap' }}>{val}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleCard>
      )}

      {/* New note form */}
      <CollapsibleCard title="Add New Note" defaultOpen>

        {/* Type + meta */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          {(['SOAP', 'Ward Round', 'Follow-up'] as const).map(t => (
            <button key={t} type="button" onClick={() => setNoteType(t)}
              style={{ padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1.5px solid ${noteType === t ? C.teal : '#d1d5db'}`, background: noteType === t ? C.teal : '#fff', color: noteType === t ? '#fff' : C.muted }}>
              {t}
            </button>
          ))}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 300 }}>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...INP, width: 140 }} />
            <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="Author / Clinician" style={{ ...INP, flex: 1, minWidth: 160 }} />
            <select value={interval} onChange={e => setInterval(e.target.value)}
              style={{ ...INP, width: 160, background: '#fff' }}>
              <option value="">Encounter interval…</option>
              {intervals.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          {postOpDay !== null && !interval && (
            <span style={{ fontSize: 11, color: C.teal, fontWeight: 700 }}>Post-op Day {postOpDay} (auto)</span>
          )}
        </div>

        {/* S — Subjective */}
        <div style={{ background: '#f0f9ff', border: `1px solid #bae6fd`, borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0369a1', marginBottom: 8 }}>S — Subjective</div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>Chief Complaint</label>
            <input value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} placeholder="e.g. Wound pain, feels feverish…" style={INP} />
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 5 }}>Symptoms</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {FU_SYMPTOMS.map(s => {
                const on = selectedSymptoms.includes(s);
                return (
                  <button key={s} type="button" onClick={() => setSelectedSymptoms(p => toggleChip(p, s))}
                    style={{ padding: '3px 10px', borderRadius: 14, fontSize: 12, cursor: 'pointer', fontWeight: on ? 700 : 400, border: `1px solid ${on ? '#0369a1' : '#d1d5db'}`, background: on ? '#0369a1' : '#f0f9ff', color: on ? '#fff' : '#374151' }}>
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>Interval History</label>
            <textarea value={intervalHistory} onChange={e => setIntervalHistory(e.target.value)}
              placeholder="Since last review: tolerating diet, pain improving, wound healing…"
              style={{ ...INP, minHeight: 60, resize: 'vertical' }} />
          </div>
        </div>

        {/* O — Objective */}
        <div style={{ background: '#f0fdf4', border: `1px solid #bbf7d0`, borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#166534', flex: 1 }}>O — Objective</div>
            {ctx.vitalRecords.length > 0 && (
              <button type="button" onClick={pullLatestVitals}
                style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid #86efac', background: '#f0fdf4', color: '#166534' }}>
                ↓ Pull latest vitals ({ctx.vitalRecords.at(-1)?.timestamp.slice(11, 16)})
              </button>
            )}
          </div>

          {/* Vitals grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px 12px', marginBottom: 12 }}>
            {VITALS_FIELDS.map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 3 }}>{f.label}</label>
                <input value={vitals[f.key] ?? ''} onChange={e => setVitals(v => ({ ...v, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} style={{ ...INP, fontSize: 12 }} />
              </div>
            ))}
          </div>

          {/* Examination by system */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            {(['general', 'cvs', 'rs', 'abdomen', 'wound', 'limbs'] as const).map(sys => {
              const labels: Record<string, string> = { general: 'General', cvs: 'CVS', rs: 'Respiratory', abdomen: 'Abdomen / Surgical', wound: 'Wound / Surgical Site', limbs: 'Limbs / Extremities' };
              return (
                <ExamSection key={sys} systemKey={sys} label={labels[sys]} chips={EXAM_CHIPS[sys]}
                  selected={examChips[sys] ?? []} onToggle={chip => handleExamChipToggle(sys, chip)}
                  note={examNotes[sys] ?? ''} onNote={v => setExamNotes(p => ({ ...p, [sys]: v }))}
                />
              );
            })}
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Other</label>
            <textarea value={examNotes.other ?? ''} onChange={e => setExamNotes(p => ({ ...p, other: e.target.value }))}
              placeholder="Any other examination findings…"
              style={{ ...INP, minHeight: 44, resize: 'vertical' }} />
          </div>
        </div>

        {/* A — Assessment */}
        <div style={{ background: '#fffbeb', border: `1px solid #fde68a`, borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#92400e', marginBottom: 8 }}>A — Assessment</div>
          {postOpDay !== null && (
            <div style={{ fontSize: 11, color: '#92400e', marginBottom: 6, fontWeight: 600 }}>
              Post-operative Day {postOpDay} {ctx.patientName ? `— ${ctx.patientName}` : ''}
            </div>
          )}
          <textarea value={assessment} onChange={e => setAssessment(e.target.value)}
            placeholder="Clinical assessment: post-op day, diagnosis, progress, concerns…"
            style={{ ...INP, minHeight: 80, resize: 'vertical' }} />
        </div>

        {/* P — Plan */}
        <div style={{ background: '#fdf4ff', border: `1px solid #e9d5ff`, borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#6b21a8', marginBottom: 8 }}>P — Plan</div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, display: 'block', marginBottom: 4 }}>Management Template</label>
            <select value={selectedTemplate}
              onChange={e => {
                setSelectedTemplate(e.target.value);
                const tpl = MGMT_TEMPLATES.find(t => t.label === e.target.value);
                if (tpl) setPlan(tpl.plan);
              }}
              style={{ ...INP, background: '#fff' }}>
              <option value="">Select template…</option>
              {MGMT_TEMPLATES.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
            </select>
          </div>
          <textarea value={plan} onChange={e => setPlan(e.target.value)}
            placeholder="Management plan: monitoring, medications, diet, activity, investigations, follow-up…"
            style={{ ...INP, minHeight: 120, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => void handleSave()} disabled={saving}
            style={{ ...BTN, background: saving ? '#9ca3af' : C.teal, color: '#fff', fontSize: 13, padding: '9px 20px', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : '+ Save Note'}
          </button>
        </div>
      </CollapsibleCard>
    </div>
  );
}
