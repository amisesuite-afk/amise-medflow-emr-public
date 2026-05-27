import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';

// ── Local types ───────────────────────────────────────────────────────────────

interface RRLocal {
  modality: string; anatomicalRegion: string; laterality: string; urgency: string;
  indication: string; clinicalQuestion: string; ctContrast: string; ctEgfr: string;
  mriProtocol: string; mriSequences: string; scopeType: string; functionalType: string;
  resultReceived: boolean; resultNotes: string;
}
interface CALocal { name: string; anatomicalArea: string; dimensions: string; description: string; }

// ── Constants ─────────────────────────────────────────────────────────────────

const SITE_INFO: Record<string, { name: string; address: string }> = {
  rodney_bay: { name: 'Rodney Bay Office', address: 'Providence Building, First Floor, Apt#3, Rodney Bay' },
  castries:   { name: 'Castries Office',   address: 'Castries, Saint Lucia' },
  tapion:     { name: 'Tapion Hospital',   address: 'Tapion, Saint Lucia' },
};
const APPT_LABELS: Record<string, string> = {
  new_consult: 'New Consultation', follow_up: 'Follow-up Consultation',
  post_op: 'Post-operative Review', ercp_workup: 'ERCP Work-up', ercp: 'ERCP Procedure',
  breast: 'Breast Clinic', telephone: 'Telephone Consultation', diabetic_foot: 'Diabetic Foot Clinic',
};

const LOGO_SVG = `<svg width="130" height="46" viewBox="0 0 150 52" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="15" cy="11" rx="6.5" ry="7.5" fill="#1a3a5c"/>
  <path d="M8.5 19 C7 28 8 37 14 41 C17.5 43 21 41 21 38 C17.5 36 14.5 31 14.5 24.5 C14.5 20.5 16.5 19.5 18.5 19 C14 17 8.5 17.5 8.5 19Z" fill="#1a3a5c"/>
  <ellipse cx="29" cy="11" rx="6.5" ry="7.5" fill="#922b21"/>
  <path d="M35.5 19 C37 28 36 37 30 41 C26.5 43 23 41 23 38 C26.5 36 29.5 31 29.5 24.5 C29.5 20.5 27.5 19.5 25.5 19 C30 17 35.5 17.5 35.5 19Z" fill="#922b21"/>
  <line x1="48" y1="6" x2="48" y2="46" stroke="#ddd" stroke-width="1"/>
  <text x="56" y="24" font-family="Arial,Helvetica,sans-serif" font-size="19" font-weight="bold" fill="#1a3a5c" letter-spacing="1.2">AMISE</text>
  <text x="56" y="37" font-family="Arial,Helvetica,sans-serif" font-size="7.5" fill="#666" letter-spacing="2.5">MEDICAL SERVICES</text>
  <text x="56" y="47" font-family="Arial,Helvetica,sans-serif" font-size="6.5" fill="#999" letter-spacing="0.5">Saint Lucia</text>
</svg>`;

const ANTHROPIC_KEY = (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined) ?? '';

// ── Helpers ───────────────────────────────────────────────────────────────────

function ectNow() {
  return new Date().toLocaleString('en-GB', { timeZone: 'America/St_Lucia' });
}
function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Marker prefix for improvement hints — stripped before printing
const HINT = '  ▸ ';
function hint(msg: string) { return `${HINT}[${msg}]`; }
const SEC = '─'.repeat(48);
function sec(title: string) { return `\n${title}\n${SEC}`; }

// Strip hint lines and blank lines produced by skipped sections
function cleanForPrint(text: string): string {
  return text
    .split('\n')
    .filter(line => !line.trimStart().startsWith('▸ ['))
    .join('\n')
    // collapse 3+ consecutive blank lines to 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── buildDocument ─────────────────────────────────────────────────────────────

type Ctx = ReturnType<typeof useAppContext>;

function buildDocument(ctx: Ctx): string {
  const now = ectNow();
  const site = SITE_INFO[ctx.currentSite] ?? SITE_INFO.rodney_bay;
  const appt = APPT_LABELS[ctx.triageResult.appointmentType] ?? ctx.triageResult.appointmentType;
  const rr = ctx.radiologyRequests as unknown as RRLocal[];
  const att = ctx.attachments as unknown as CALocal[];
  const v = ctx.vitals;

  const lines: string[] = [];

  // Header
  lines.push('AMISE MEDICAL SERVICES — ENCOUNTER RECORD');
  lines.push(`${site.name}   ·   ${now}`);
  lines.push('═'.repeat(48));

  // Patient
  lines.push(sec('PATIENT'));
  lines.push(`Name:     ${ctx.patientName  || hint('enter patient name')}`);
  const agePart = ctx.age ? `${ctx.age} yrs` : hint('age');
  const dobPart = ctx.dob ? `(${ctx.dob})` : '';
  lines.push(`Age/DOB:  ${[agePart, dobPart].filter(Boolean).join(' ')}`);
  lines.push(`Sex:      ${ctx.sex !== 'unknown' ? ctx.sex : hint('specify sex')}`);
  lines.push(`Phone:    ${ctx.phone   || hint('add phone number')}`);
  lines.push(`Address:  ${ctx.address || hint('add community / address')}`);
  if (ctx.referredBy) lines.push(`Ref by:   ${ctx.referredBy}`);

  // Encounter
  lines.push(sec('ENCOUNTER'));
  lines.push(`Type:     ${appt}`);
  lines.push(`Acuity:   ${ctx.triageResult.acuity.toUpperCase()}  (Score: ${ctx.triageResult.score})`);
  if (ctx.isPostOp) lines.push(`Post-op:  Day ${ctx.postOpDays || hint('specify day')}`);
  if (ctx.pregnancyPossible) lines.push('Pregnancy possible: Yes');

  // Presenting complaint
  lines.push(sec('PRESENTING COMPLAINT'));
  if (ctx.symptoms.length > 0) {
    lines.push(`CC:       ${ctx.symptoms.join(', ')}`);
  } else {
    lines.push(hint('enter presenting symptoms / chief complaint'));
  }
  lines.push(`Duration: ${ctx.durationDays ? ctx.durationDays + ' days' : hint('specify duration')}`);
  if (ctx.painScore) lines.push(`Pain:     ${ctx.painScore}/10`);
  if (ctx.freeText) {
    lines.push('');
    lines.push(ctx.freeText);
  } else {
    lines.push(hint('add HPI — onset, character, radiation, aggravating/relieving factors, associated symptoms'));
  }

  // PMH
  lines.push(sec('PAST MEDICAL HISTORY'));
  if (ctx.comorbidities.length > 0) {
    ctx.comorbidities.forEach(c => lines.push(`  • ${c}`));
  } else {
    lines.push('  Nil known');
  }
  if (ctx.pmhNotes) lines.push(`  ${ctx.pmhNotes}`);

  // Surgical history
  lines.push(sec('SURGICAL HISTORY'));
  if (ctx.surgicalHistory.length > 0) {
    ctx.surgicalHistory.forEach(s => lines.push(`  • ${s}`));
    if (ctx.surgicalNotes) lines.push(`  ${ctx.surgicalNotes}`);
  } else {
    lines.push('  Nil reported');
  }

  // Family history
  if (ctx.familyHistory.length > 0 || ctx.familyHistoryNotes) {
    lines.push(sec('FAMILY HISTORY'));
    ctx.familyHistory.forEach(f => lines.push(`  • ${f}`));
    if (ctx.familyHistoryNotes) lines.push(`  ${ctx.familyHistoryNotes}`);
  }

  // Social / habits
  if (ctx.toxicHabits.length > 0) {
    lines.push(sec('SOCIAL / HABITS'));
    ctx.toxicHabits.forEach(t => lines.push(`  • ${t}`));
  }

  // Medications
  lines.push(sec('MEDICATIONS'));
  if (ctx.medications.length > 0 || ctx.medicationsText) {
    ctx.medications.forEach(m => lines.push(`  • ${m}`));
    if (ctx.medicationsText) lines.push(`  ${ctx.medicationsText}`);
  } else {
    lines.push('  None reported');
  }

  // Allergies
  lines.push(sec('ALLERGIES'));
  lines.push(`  ${ctx.allergies || 'NKDA (No Known Drug Allergies)'}`);

  // Vitals
  lines.push(sec('VITAL SIGNS'));
  const bpStr   = v.systolicBp && v.diastolicBp ? `BP: ${v.systolicBp}/${v.diastolicBp} mmHg` : hint('BP');
  const hrStr   = v.heartRate ? `HR: ${v.heartRate} bpm` : hint('HR');
  const tempStr = v.temperatureC ? `Temp: ${v.temperatureC} °C` : hint('Temp');
  const rrStr   = v.respiratoryRate ? `RR: ${v.respiratoryRate}/min` : '';
  const spo2Str = v.spo2 ? `SpO₂: ${v.spo2}%` : '';
  const bslStr  = v.glucoseMmol ? `BSL: ${v.glucoseMmol} mmol/L` : '';
  lines.push(`  ${[bpStr, hrStr, tempStr].join('   ')}`);
  const row2 = [rrStr, spo2Str, bslStr].filter(Boolean).join('   ');
  if (row2) lines.push(`  ${row2}`);
  if (ctx.weightKg || ctx.heightCm) {
    const wt = ctx.weightKg ? `Wt: ${ctx.weightKg} kg` : hint('weight');
    const ht = ctx.heightCm ? `Ht: ${ctx.heightCm} cm` : hint('height');
    let bmiStr = '';
    if (ctx.weightKg && ctx.heightCm) {
      const bmi = parseFloat(ctx.weightKg) / Math.pow(parseFloat(ctx.heightCm) / 100, 2);
      if (Number.isFinite(bmi)) bmiStr = `  BMI: ${bmi.toFixed(1)}`;
    }
    lines.push(`  ${wt}   ${ht}${bmiStr}`);
  } else {
    lines.push(hint('record weight and height'));
  }

  // Examination
  lines.push(sec('PHYSICAL EXAMINATION'));
  const examFields: [string, string][] = [
    ['General', ctx.examGeneral], ['Cardiovascular', ctx.examCardio],
    ['Respiratory', ctx.examResp], ['Abdomen', ctx.examAbdomen],
    ['Neurological', ctx.examNeuro], ['Extremities', ctx.examExtremities],
    ['Breast / Local', ctx.examBreast], ['Wound', ctx.examWound],
  ];
  let hasExam = false;
  for (const [label, val] of examFields) {
    if (val) { lines.push(`  ${label}: ${val}`); hasExam = true; }
  }
  if (!hasExam) {
    lines.push(hint('complete physical examination — general, cardiovascular, respiratory, abdomen'));
    lines.push(hint('add neurological and extremity findings if relevant'));
  }

  // ROS
  const rosEntries = Object.entries(ctx.rosFindings).filter(
    ([, f]) => f.status !== 'not-asked' && (f.details.length > 0 || f.notes),
  );
  if (rosEntries.length > 0) {
    lines.push(sec('REVIEW OF SYSTEMS'));
    rosEntries.forEach(([sys, f]) => {
      const detail = f.details.join(', ');
      const note = f.notes ? (detail ? ` — ${f.notes}` : f.notes) : '';
      lines.push(`  ${sys} [${f.status}]: ${detail}${note}`);
    });
  }

  // Investigations
  lines.push(sec('INVESTIGATIONS ORDERED'));
  if (ctx.orderedInvestigations.length > 0) {
    ctx.orderedInvestigations.forEach(inv => {
      const res = ctx.investigationResults[inv];
      if (res !== undefined && res !== '') lines.push(`  ✓ ${inv}: ${res}`);
      else if (res !== undefined) lines.push(`  ○ ${inv}  [result pending]`);
      else lines.push(`  → ${inv}`);
    });
  } else {
    lines.push(hint('order investigations — FBC, U&E, LFTs, CRP, imaging'));
  }

  // Radiology
  if (rr.length > 0) {
    lines.push(sec('RADIOLOGY / IMAGING'));
    rr.forEach((r, i) => {
      const region = [r.anatomicalRegion, r.laterality].filter(Boolean).join(' ');
      lines.push(`  [${i + 1}] ${r.modality.toUpperCase()} — ${region}  (${r.urgency.toUpperCase()})`);
      if (r.indication) lines.push(`      Indication: ${r.indication}`);
      if (r.clinicalQuestion) lines.push(`      Question: ${r.clinicalQuestion}`);
      if (r.mriProtocol) lines.push(`      Protocol: ${r.mriProtocol}`);
      if (r.mriSequences) lines.push(`      Sequences: ${r.mriSequences}`);
      if (r.ctContrast && r.ctContrast !== 'none') lines.push(`      Contrast: ${r.ctContrast}${r.ctEgfr ? `  eGFR: ${r.ctEgfr}` : ''}`);
      if (r.scopeType) lines.push(`      Scope: ${r.scopeType}`);
      if (r.functionalType) lines.push(`      Study: ${r.functionalType}`);
      if (r.resultReceived) lines.push(`      ✓ Result: ${r.resultNotes || '[findings to be documented]'}`);
    });
  }

  // Assessment
  lines.push(sec('ASSESSMENT'));
  if (ctx.assessment) {
    lines.push(`Working Dx:  ${ctx.assessment}`);
  } else {
    lines.push(hint('enter working diagnosis / clinical impression'));
  }
  if (ctx.icdCodes.length > 0) {
    lines.push(`ICD-10:      ${ctx.icdCodes.join('  |  ')}`);
  } else {
    lines.push(hint('add ICD-10 code(s)'));
  }
  if (ctx.differentials) {
    lines.push('');
    lines.push('Differentials:');
    lines.push(ctx.differentials);
  } else {
    lines.push(hint('list differential diagnoses in order of probability'));
  }

  // Plan
  lines.push(sec('MANAGEMENT PLAN'));
  if (ctx.plan) {
    lines.push(ctx.plan);
  } else {
    lines.push(hint('enter numbered management steps'));
    lines.push(hint('e.g. 1. IV access + fluids  2. Analgesia  3. Imaging  4. Consult  5. Admit / Discharge'));
  }
  if (ctx.cptCodes.length > 0) lines.push(`\nCPT:  ${ctx.cptCodes.join('  |  ')}`);
  if (ctx.procedures) { lines.push(''); lines.push(`Procedures: ${ctx.procedures}`); }

  // Attachments
  if (att.length > 0) {
    lines.push(sec('CLINICAL IMAGES / ATTACHMENTS'));
    att.forEach((a, i) => {
      lines.push(`  [${i + 1}] ${a.name}${a.anatomicalArea ? ' — ' + a.anatomicalArea : ''}${a.dimensions ? ' (' + a.dimensions + ')' : ''}`);
      if (a.description) lines.push(`      ${a.description}`);
    });
  }

  lines.push('');
  lines.push(`Generated: ${now} (ECT)`);

  return lines.join('\n');
}

// ── Print HTML for clinical note ──────────────────────────────────────────────

function buildPrintHtml(text: string, ctx: Ctx): string {
  const site = SITE_INFO[ctx.currentSite] ?? SITE_INFO.rodney_bay;
  const now = ectNow();
  const clean = escHtml(cleanForPrint(text));
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Clinical Note — ${escHtml(ctx.patientName || 'Patient')}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;line-height:1.42;background:#fff;max-width:182mm;margin:0 auto;padding:14px 16px}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a3a5c;padding-bottom:10px;margin-bottom:12px}
  .hdr-l{font-size:12px;font-weight:700;color:#1a3a5c} .hdr-s{font-size:10px;color:#555;margin-top:2px}
  pre{font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.42;white-space:pre-wrap;word-break:break-word;color:#111}
  .sig{margin-top:28px;padding-top:10px;border-top:1px solid #bbb;display:flex;justify-content:space-between;align-items:flex-end}
  .sl{min-width:220px} .sl-line{border-bottom:1px solid #333;width:200px;height:22px;margin-bottom:4px}
  .sl-name{font-weight:700;font-size:12px} .sl-sub{font-size:10px;color:#555;margin-top:1px} .sl-lic{font-size:9px;color:#888;margin-top:2px}
  .sr{font-size:9px;color:#aaa;text-align:right}
  @page{margin:12mm 14mm;size:A4}
  @media print{body{max-width:100%;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="hdr">
  <div><div class="hdr-l">${escHtml(site.name)}</div>
    <div class="hdr-s">${escHtml(site.address)}</div>
    <div class="hdr-s">Tel: 1 (758) 720 7111 · amisesuite@gmail.com</div>
    <div class="hdr-s" style="color:#1a3a5c;margin-top:2px">${escHtml(now)}</div>
  </div>
  <div>${LOGO_SVG}</div>
</div>
<pre>${clean}</pre>
<div class="sig">
  <div class="sl"><div class="sl-line"></div>
    <div class="sl-name">Dr. Dawit D Kabiye</div>
    <div class="sl-sub">MD, DM · General &amp; Endoscopic Surgery</div>
    <div class="sl-lic">Licence #: ............&nbsp;&nbsp;&nbsp;&nbsp;Date: ..................</div>
  </div>
  <div class="sr">Generated ${escHtml(now)}</div>
</div>
</body></html>`;
}

// ── Referral letter HTML ──────────────────────────────────────────────────────

function buildReferralHtml(ctx: Ctx, referTo: string, referNotes: string): string {
  const site = SITE_INFO[ctx.currentSite] ?? SITE_INFO.rodney_bay;
  const now = ectNow();
  const ageLine = [ctx.age ? `${ctx.age} yrs` : '', ctx.sex !== 'unknown' ? ctx.sex : ''].filter(Boolean).join(', ');
  const meds = [...ctx.medications, ...(ctx.medicationsText ? [ctx.medicationsText] : [])];
  const allergy = ctx.allergies || 'NKDA';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Referral — ${escHtml(ctx.patientName || 'Patient')}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#111;line-height:1.6;background:#fff;max-width:175mm;margin:0 auto;padding:18px 20px}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #1a3a5c;padding-bottom:12px;margin-bottom:14px}
  .h-l{font-size:13px;font-weight:700;color:#1a3a5c} .h-s{font-size:10.5px;color:#555;margin-top:2px}
  .title{font-size:14px;font-weight:700;text-align:center;color:#1a3a5c;letter-spacing:.5px;text-transform:uppercase;margin:0 0 14px;border-bottom:1px solid #e0e4ea;padding-bottom:7px}
  .sec-hdr{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.1px;color:#1a3a5c;background:#eef1f6;padding:4px 10px;border-left:3px solid #1a3a5c;margin:12px 0 7px}
  .body-text{font-size:12.5px;line-height:1.6;color:#111}
  ul{margin:0 0 0 16px;padding:0} li{margin:2px 0;font-size:12.5px}
  .sig{margin-top:40px;padding-top:12px;border-top:1.5px solid #ccc;display:flex;justify-content:space-between;align-items:flex-end}
  .sl{min-width:230px} .sl-line{border-bottom:1px solid #333;width:210px;height:24px;margin-bottom:4px}
  .sl-name{font-weight:700;font-size:12.5px} .sl-sub{font-size:10.5px;color:#555;margin-top:1px} .sl-lic{font-size:9.5px;color:#888;margin-top:2px}
  .sr{font-size:9px;color:#aaa;text-align:right}
  @page{margin:15mm 17mm;size:A4} @media print{body{max-width:100%;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="hdr">
  <div><div class="h-l">${escHtml(site.name)}</div>
    <div class="h-s">${escHtml(site.address)}</div>
    <div class="h-s">Tel: 1 (758) 720 7111 · amisesuite@gmail.com</div>
    <div class="h-s" style="color:#1a3a5c;margin-top:2px">${escHtml(now)}</div>
  </div>
  <div>${LOGO_SVG}</div>
</div>
<div class="title">Referral Letter</div>
<div class="body-text">
  <p>Dear Colleague${referTo ? ` / ${escHtml(referTo)}` : ''},</p>
  <br>
  <p>I am writing to refer <strong>${escHtml(ctx.patientName || 'this patient')}</strong>${ageLine ? `, ${escHtml(ageLine)},` : ''} who was seen at ${escHtml(site.name)} on ${escHtml(now)}.</p>
</div>

${ctx.symptoms.length || ctx.freeText ? `<div class="sec-hdr">Presenting History</div>
<div class="body-text">
  ${ctx.symptoms.length ? `<p>Presenting with: ${escHtml(ctx.symptoms.join(', '))}</p>` : ''}
  ${ctx.freeText ? `<p style="margin-top:4px">${escHtml(ctx.freeText)}</p>` : ''}
  ${ctx.durationDays ? `<p>Duration: ${escHtml(ctx.durationDays)} days</p>` : ''}
</div>` : ''}

${ctx.comorbidities.length || ctx.pmhNotes ? `<div class="sec-hdr">Past Medical History</div>
<ul>${ctx.comorbidities.map(c => `<li>${escHtml(c)}</li>`).join('')}</ul>
${ctx.pmhNotes ? `<div class="body-text"><p>${escHtml(ctx.pmhNotes)}</p></div>` : ''}` : ''}

${meds.length ? `<div class="sec-hdr">Current Medications</div>
<ul>${meds.map(m => `<li>${escHtml(m)}</li>`).join('')}</ul>` : ''}

<div class="sec-hdr">Allergies</div>
<div class="body-text"><p>${escHtml(allergy)}</p></div>

${ctx.assessment ? `<div class="sec-hdr">Clinical Assessment</div>
<div class="body-text"><p>${escHtml(ctx.assessment)}</p>
${ctx.icdCodes.length ? `<p style="margin-top:4px;font-size:11px;color:#555">ICD-10: ${escHtml(ctx.icdCodes.join(', '))}</p>` : ''}
</div>` : ''}

${referNotes ? `<div class="sec-hdr">Reason for Referral</div>
<div class="body-text"><p>${escHtml(referNotes).replace(/\n/g, '<br>')}</p></div>` : ''}

<div class="body-text" style="margin-top:16px">
  <p>I would be grateful for your review and further management. Please do not hesitate to contact our office if you require further information.</p>
  <br><p>Kind regards,</p>
</div>
<div class="sig">
  <div class="sl"><div class="sl-line"></div>
    <div class="sl-name">Dr. Dawit D Kabiye</div>
    <div class="sl-sub">MD, DM · General &amp; Endoscopic Surgery</div>
    <div class="sl-lic">${escHtml(site.name)} · 1 (758) 720 7111</div>
    <div class="sl-lic">Licence #: ............&nbsp;&nbsp;&nbsp;&nbsp;Date: ..................</div>
  </div>
  <div class="sr"></div>
</div>
</body></html>`;
}

// ── Discharge summary HTML ────────────────────────────────────────────────────

function buildDischargeHtml(ctx: Ctx, dischargeNotes: string, followUp: string, warnings: string): string {
  const site = SITE_INFO[ctx.currentSite] ?? SITE_INFO.rodney_bay;
  const now = ectNow();
  const ageLine = [ctx.age ? `${ctx.age} yrs` : '', ctx.sex !== 'unknown' ? ctx.sex : ''].filter(Boolean).join(', ');
  const meds = [...ctx.medications, ...(ctx.medicationsText ? [ctx.medicationsText] : [])];

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Discharge — ${escHtml(ctx.patientName || 'Patient')}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#111;line-height:1.6;background:#fff;max-width:175mm;margin:0 auto;padding:18px 20px}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #1a3a5c;padding-bottom:12px;margin-bottom:14px}
  .h-l{font-size:13px;font-weight:700;color:#1a3a5c} .h-s{font-size:10.5px;color:#555;margin-top:2px}
  .title{font-size:14px;font-weight:700;text-align:center;color:#1a3a5c;letter-spacing:.5px;text-transform:uppercase;margin:0 0 14px;border-bottom:1px solid #e0e4ea;padding-bottom:7px}
  .pt-row{background:#f4f6f9;border:1px solid #d8dde6;border-radius:4px;padding:10px 14px;margin-bottom:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .pt-lbl{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:700;margin-bottom:3px}
  .pt-val{font-size:12px;font-weight:700} .pt-sub{font-size:10.5px;color:#555;margin-top:1px}
  .sec-hdr{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.1px;color:#1a3a5c;background:#eef1f6;padding:4px 10px;border-left:3px solid #1a3a5c;margin:12px 0 7px}
  .body-text{font-size:12.5px;line-height:1.6;color:#111;padding:0 2px}
  ul{margin:0 0 0 16px;padding:0} li{margin:2px 0;font-size:12.5px}
  .warn{background:#fff5f5;border:1px solid #fca5a5;border-radius:4px;padding:8px 12px;color:#b91c1c;font-size:12px}
  .sig{margin-top:40px;padding-top:12px;border-top:1.5px solid #ccc;display:flex;justify-content:space-between;align-items:flex-end}
  .sl{min-width:230px} .sl-line{border-bottom:1px solid #333;width:210px;height:24px;margin-bottom:4px}
  .sl-name{font-weight:700;font-size:12.5px} .sl-sub{font-size:10.5px;color:#555;margin-top:1px} .sl-lic{font-size:9.5px;color:#888;margin-top:2px}
  .sr{font-size:9px;color:#aaa;text-align:right}
  @page{margin:15mm 17mm;size:A4} @media print{body{max-width:100%;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="hdr">
  <div><div class="h-l">${escHtml(site.name)}</div>
    <div class="h-s">${escHtml(site.address)}</div>
    <div class="h-s">Tel: 1 (758) 720 7111 · amisesuite@gmail.com</div>
    <div class="h-s" style="color:#1a3a5c;margin-top:2px">${escHtml(now)}</div>
  </div>
  <div>${LOGO_SVG}</div>
</div>
<div class="title">Discharge / Clinic Summary</div>
<div class="pt-row">
  <div><div class="pt-lbl">Patient</div>
    <div class="pt-val">${escHtml(ctx.patientName || '—')}</div>
    ${ageLine ? `<div class="pt-sub">${escHtml(ageLine)}</div>` : ''}
    ${ctx.phone ? `<div class="pt-sub">${escHtml(ctx.phone)}</div>` : ''}
  </div>
  <div><div class="pt-lbl">Clinician</div>
    <div class="pt-val">Dr. Dawit D Kabiye</div>
    <div class="pt-sub">MD, DM · General &amp; Endoscopic Surgery</div>
    <div class="pt-sub">${escHtml(now)}</div>
  </div>
</div>

${ctx.assessment || ctx.icdCodes.length ? `<div class="sec-hdr">Diagnosis</div>
<div class="body-text">
  ${ctx.assessment ? `<p>${escHtml(ctx.assessment)}</p>` : ''}
  ${ctx.icdCodes.length ? `<p style="font-size:11px;color:#555;margin-top:3px">ICD-10: ${escHtml(ctx.icdCodes.join(', '))}</p>` : ''}
</div>` : ''}

${ctx.plan || ctx.procedures ? `<div class="sec-hdr">Treatment / Procedures</div>
<div class="body-text">
  ${ctx.procedures ? `<p>${escHtml(ctx.procedures)}</p>` : ''}
  ${ctx.plan ? `<p style="margin-top:4px">${escHtml(ctx.plan).replace(/\n/g, '<br>')}</p>` : ''}
</div>` : ''}

${meds.length ? `<div class="sec-hdr">Medications on Discharge</div>
<ul>${meds.map(m => `<li>${escHtml(m)}</li>`).join('')}</ul>` : ''}

${dischargeNotes ? `<div class="sec-hdr">Discharge Instructions</div>
<div class="body-text"><p>${escHtml(dischargeNotes).replace(/\n/g, '<br>')}</p></div>` : ''}

${warnings ? `<div class="sec-hdr">Warning Signs — Return Immediately If:</div>
<div class="warn">${escHtml(warnings).replace(/\n/g, '<br>')}</div>` : ''}

${followUp ? `<div class="sec-hdr">Follow-up</div>
<div class="body-text"><p>${escHtml(followUp).replace(/\n/g, '<br>')}</p></div>` : ''}

<div class="sig">
  <div class="sl"><div class="sl-line"></div>
    <div class="sl-name">Dr. Dawit D Kabiye</div>
    <div class="sl-sub">MD, DM · General &amp; Endoscopic Surgery</div>
    <div class="sl-lic">Licence #: ............&nbsp;&nbsp;&nbsp;&nbsp;Date: ..................</div>
  </div>
  <div class="sr">Issued: ${escHtml(now)}</div>
</div>
</body></html>`;
}

// ── Print / download helpers ──────────────────────────────────────────────────

function printHtml(html: string) {
  const win = window.open('', '_blank');
  if (win) { win.document.open(); win.document.write(html); win.document.close(); win.focus(); setTimeout(() => { try { win.print(); } catch { /* */ } }, 450); }
}

function downloadHtml(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const url = URL.createObjectURL(blob);
  if (isIOS) { window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 30_000); return; }
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

// ── AI Refine ─────────────────────────────────────────────────────────────────

const REFINE_SYSTEM =
  'You are a clinical documentation assistant for Dr. Dawit D Kabiye, MD, DM, General & Endoscopic Surgeon at Amise Medical Services, Saint Lucia. ' +
  'You will receive a structured clinical encounter record and must: ' +
  '1. Keep ALL factual clinical data exactly as stated — do not invent findings, results, or diagnoses. ' +
  '2. Replace placeholder prompts (lines beginning with ▸ [ADD:) with standard clinical language if inferable, or remove them if not. ' +
  '3. Improve medical phrasing, completeness, and structure. ' +
  '4. Preserve all section headers and the signature block. ' +
  '5. Never include fees, charges, costs, or financial information. ' +
  'Output only the refined encounter record in the same plain-text format — no markdown, no commentary.';

async function callAiRefine(text: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: REFINE_SYSTEM,
      messages: [{ role: 'user', content: `Refine the following clinical encounter record:\n\n${text}` }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `HTTP ${res.status}`);
  }
  const data = await res.json() as { content: { type: string; text: string }[] };
  return data.content.find(b => b.type === 'text')?.text ?? '';
}

// ── Component ─────────────────────────────────────────────────────────────────

const BTN_BASE: React.CSSProperties = {
  padding: '6px 13px', borderRadius: 7, fontSize: 12, fontWeight: 600,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
  whiteSpace: 'nowrap',
};
const BTN_PRIMARY: React.CSSProperties = { ...BTN_BASE, background: '#1a3a5c', color: '#fff', border: 'none' };
const BTN_GHOST: React.CSSProperties = { ...BTN_BASE, background: '#f4f6f9', color: '#1a1a1a', border: '1px solid #d1d5db' };
const BTN_ACCENT: React.CSSProperties = { ...BTN_BASE, background: 'var(--accent, #0b8278)', color: '#fff', border: 'none' };
const BTN_WARN: React.CSSProperties = { ...BTN_BASE, background: '#7c3aed', color: '#fff', border: 'none' };

function btnDisabled(base: React.CSSProperties): React.CSSProperties {
  return { ...base, opacity: 0.4, cursor: 'default' };
}

export default function FinalDocTab() {
  const ctx = useAppContext();
  const { finalDocument, setFinalDocument } = ctx;

  const [showReferral, setShowReferral] = useState(false);
  const [referTo, setReferTo] = useState('');
  const [referNotes, setReferNotes] = useState('');

  const [showDischarge, setShowDischarge] = useState(false);
  const [dischargeNotes, setDischargeNotes] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [warnings, setWarnings] = useState('');

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const site = SITE_INFO[ctx.currentSite] ?? SITE_INFO.rodney_bay;
  const patSlug = (ctx.patientName || 'patient').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const dateStr = new Date().toISOString().slice(0, 10);
  const hasFinal = !!finalDocument;

  async function handleAiRefine() {
    if (!finalDocument) return;
    if (!ANTHROPIC_KEY) {
      setShowImport(true);
      setAiError('No API key — copy the text, refine externally, then paste below.');
      return;
    }
    setAiLoading(true);
    setAiError('');
    try {
      const refined = await callAiRefine(finalDocument);
      setFinalDocument(refined);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Unknown error');
      setShowImport(true);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
        padding: '10px 0 10px', borderBottom: '1px solid #e5e7eb', marginBottom: 10,
      }}>
        <button type="button" style={BTN_PRIMARY} onClick={() => setFinalDocument(buildDocument(ctx))}>
          ↺ Populate
        </button>

        <button type="button" style={hasFinal ? BTN_GHOST : btnDisabled(BTN_GHOST)}
          disabled={!hasFinal}
          onClick={() => printHtml(buildPrintHtml(finalDocument, ctx))}>
          🖨 Print Clinical Note
        </button>

        <button type="button" style={hasFinal ? BTN_GHOST : btnDisabled(BTN_GHOST)}
          disabled={!hasFinal}
          onClick={() => downloadHtml(buildPrintHtml(finalDocument, ctx), `note-${patSlug}-${dateStr}.html`)}>
          ↓ Download
        </button>

        <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 2px' }} />

        <button type="button" style={BTN_ACCENT}
          onClick={() => setShowReferral(r => !r)}>
          📋 Referral
        </button>

        <button type="button" style={BTN_ACCENT}
          onClick={() => setShowDischarge(d => !d)}>
          📄 Discharge
        </button>

        <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 2px' }} />

        <button type="button" style={hasFinal ? BTN_WARN : btnDisabled(BTN_WARN)}
          disabled={!hasFinal || aiLoading}
          onClick={() => void handleAiRefine()}>
          {aiLoading ? '⏳ Refining…' : '✦ AI Refine'}
        </button>

        <button type="button" style={{ ...BTN_GHOST, fontSize: 11 }}
          onClick={() => setShowImport(v => !v)}>
          ⬇ Import AI text
        </button>

        <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>
          Edits auto-saved to session
        </span>
      </div>

      {/* ── AI error ── */}
      {aiError && (
        <div style={{ padding: '7px 12px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 12, color: '#b91c1c', marginBottom: 8 }}>
          ⚠ {aiError}
        </div>
      )}

      {/* ── Referral panel ── */}
      {showReferral && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '12px 14px', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', marginBottom: 2 }}>📋 Referral Letter</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="fld">
              <label style={{ fontSize: 12 }}>Refer to (name / dept)</label>
              <input type="text" value={referTo} onChange={e => setReferTo(e.target.value)}
                placeholder="Dr Smith, Gastroenterology, OKEU" style={{ fontSize: 12 }} />
            </div>
            <div className="fld">
              <label style={{ fontSize: 12 }}>Reason for referral</label>
              <input type="text" value={referNotes} onChange={e => setReferNotes(e.target.value)}
                placeholder="For further evaluation and management of…" style={{ fontSize: 12 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={BTN_ACCENT}
              onClick={() => printHtml(buildReferralHtml(ctx, referTo, referNotes))}>
              🖨 Print Referral
            </button>
            <button type="button" style={BTN_GHOST}
              onClick={() => downloadHtml(buildReferralHtml(ctx, referTo, referNotes), `referral-${patSlug}-${dateStr}.html`)}>
              ↓ Download
            </button>
            <button type="button" style={{ ...BTN_GHOST, marginLeft: 'auto' }} onClick={() => setShowReferral(false)}>× Close</button>
          </div>
        </div>
      )}

      {/* ── Discharge panel ── */}
      {showDischarge && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '12px 14px', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#075985', marginBottom: 2 }}>📄 Discharge / Clinic Summary</div>
          <div className="fld">
            <label style={{ fontSize: 12 }}>Discharge instructions</label>
            <textarea value={dischargeNotes} onChange={e => setDischargeNotes(e.target.value)}
              placeholder="Diet, activity restrictions, wound care, medications…" style={{ fontSize: 12, minHeight: 56 }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="fld">
              <label style={{ fontSize: 12 }}>Warning signs — return if…</label>
              <textarea value={warnings} onChange={e => setWarnings(e.target.value)}
                placeholder="Fever >38.5°C, increasing pain, wound breakdown…" style={{ fontSize: 12, minHeight: 50 }} />
            </div>
            <div className="fld">
              <label style={{ fontSize: 12 }}>Follow-up plan</label>
              <textarea value={followUp} onChange={e => setFollowUp(e.target.value)}
                placeholder="Review in OPD in 2 weeks…" style={{ fontSize: 12, minHeight: 50 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={BTN_ACCENT}
              onClick={() => printHtml(buildDischargeHtml(ctx, dischargeNotes, followUp, warnings))}>
              🖨 Print Discharge
            </button>
            <button type="button" style={BTN_GHOST}
              onClick={() => downloadHtml(buildDischargeHtml(ctx, dischargeNotes, followUp, warnings), `discharge-${patSlug}-${dateStr}.html`)}>
              ↓ Download
            </button>
            <button type="button" style={{ ...BTN_GHOST, marginLeft: 'auto' }} onClick={() => setShowDischarge(false)}>× Close</button>
          </div>
        </div>
      )}

      {/* ── Import AI text ── */}
      {showImport && (
        <div style={{ background: '#faf5ff', border: '1px solid #d8b4fe', borderRadius: 10, padding: '12px 14px', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#6b21a8' }}>⬇ Import AI-refined text</div>
          <div style={{ fontSize: 12, color: '#7c3aed' }}>
            Paste Claude-refined or externally edited text below, then click Import to replace the document.
          </div>
          <textarea value={importText} onChange={e => setImportText(e.target.value)}
            placeholder="Paste refined clinical note here…"
            style={{ fontSize: 12, minHeight: 100, fontFamily: 'monospace', lineHeight: 1.5 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={importText.trim() ? BTN_WARN : btnDisabled(BTN_WARN)}
              disabled={!importText.trim()}
              onClick={() => { setFinalDocument(importText.trim()); setImportText(''); setShowImport(false); setAiError(''); }}>
              ⬇ Import → Save as final document
            </button>
            <button type="button" style={BTN_GHOST} onClick={() => { setShowImport(false); setImportText(''); }}>× Cancel</button>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!hasFinal && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          flex: 1, minHeight: 260, gap: 10, color: '#9ca3af',
          border: '2px dashed #e5e7eb', borderRadius: 12, background: '#fafafa', padding: 32,
        }}>
          <span style={{ fontSize: 42 }}>📋</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#6b7280' }}>No final document yet</span>
          <span style={{ fontSize: 13, textAlign: 'center', maxWidth: 380, lineHeight: 1.7 }}>
            Click <strong style={{ color: '#1a3a5c' }}>↺ Populate</strong> to build from all encounter data.{' '}
            Lines marked <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 3 }}>▸ [ADD: …]</code> are improvement prompts — edit or delete them.
          </span>
        </div>
      )}

      {/* ── Editable note ── */}
      {hasFinal && (
        <textarea
          value={finalDocument}
          onChange={e => setFinalDocument(e.target.value)}
          spellCheck
          style={{
            width: '100%',
            flex: 1,
            minHeight: 'calc(100vh - 220px)',
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: 12.5,
            lineHeight: 1.55,
            color: '#111',
            background: '#fafafa',
            border: '1px solid #d1d5db',
            borderRadius: 10,
            padding: '14px 16px',
            resize: 'vertical',
            outline: 'none',
          }}
        />
      )}

      {/* ── Hint key ── */}
      {hasFinal && (
        <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span><code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>▸ [ADD: …]</code> — improvement prompt, edit or delete before printing</span>
          <span><code>✓</code> result received&nbsp;&nbsp;<code>○</code> pending&nbsp;&nbsp;<code>→</code> ordered</span>
        </div>
      )}

      {/* ── Referral / Discharge quick buttons when doc is empty ── */}
      {!hasFinal && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" style={BTN_ACCENT} onClick={() => setShowReferral(r => !r)}>📋 Referral (no note needed)</button>
          <button type="button" style={BTN_ACCENT} onClick={() => setShowDischarge(d => !d)}>📄 Discharge (no note needed)</button>
        </div>
      )}

    </div>
  );
}
