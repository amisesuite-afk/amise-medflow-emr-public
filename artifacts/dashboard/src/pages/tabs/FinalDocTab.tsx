import { useState, useCallback } from 'react';
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
  const { sections } = parseDocSections(cleanForPrint(text));

  // ── Caribbean palette: navy · teal · terracotta — no rainbow ──
  const NAVY  = '#1a3a5c';
  const TEAL  = '#0b7e72';
  const TERRA = '#9a3412';  // terracotta — acute/complaint
  const CREAM = '#fefcf8';
  const BDR   = '#e2d9cf';

  function accentFor(title: string): string {
    if (/ASSESSMENT|MANAGEMENT|PLAN/.test(title))                    return TEAL;
    if (/COMPLAINT|VITAL|TRIAGE/.test(title))                        return TERRA;
    return NAVY;
  }

  // Build a plain key-value grid cell from one line like "Name:  Marie Joseph"
  function kvCell(line: string): string {
    const colon = line.indexOf(':');
    if (colon < 0) return `<div><div class="pv">${escHtml(line.trim())}</div></div>`;
    const lbl = line.slice(0, colon).trim();
    const val = line.slice(colon + 1).trim();
    return `<div><div class="pl">${escHtml(lbl)}</div><div class="pv">${escHtml(val) || '—'}</div></div>`;
  }

  // Demographics grid from PATIENT + ENCOUNTER sections
  const patSec  = sections.find(s => s.title === 'PATIENT');
  const encSec  = sections.find(s => s.title === 'ENCOUNTER');
  const demoLines = [
    ...(patSec  ? patSec.body.split('\n').filter(l => l.trim()) : []),
    ...(encSec  ? encSec.body.split('\n').filter(l => l.trim()) : []),
  ];
  const demoGrid = demoLines.length
    ? `<div class="ptg">${demoLines.map(kvCell).join('')}</div>`
    : '';

  // Section card renderer — uniform style, accent header only
  function sHtml(title: string, body: string): string {
    const acc = accentFor(title);
    // Render bullet lines with a coloured dot; leave prose as-is
    const bodyHtml = body.split('\n').map(line => {
      if (/^\s*[•·\-]\s/.test(line)) {
        return `<div style="display:flex;gap:6px;margin:1px 0"><span style="color:${acc};font-weight:700;flex-shrink:0">·</span><span>${escHtml(line.replace(/^\s*[•·\-]\s*/,''))}</span></div>`;
      }
      return `<div style="margin:1px 0">${escHtml(line) || '<br>'}</div>`;
    }).join('');
    return `<div style="border:1px solid ${BDR};border-radius:5px;margin-top:7px;overflow:hidden;page-break-inside:avoid"><div style="background:${acc};color:#fff;font-size:8.5px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:3px 10px">${escHtml(title)}</div><div style="background:${CREAM};font-size:10.5px;line-height:1.5;color:#111;padding:6px 10px">${bodyHtml}</div></div>`;
  }

  // Two-column layout for paired sections
  function pair2(a: string, bdy_a: string, b: string, bdy_b: string): string {
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:7px">${sHtml(a,bdy_a).replace('margin-top:7px','margin-top:0')}${sHtml(b,bdy_b).replace('margin-top:7px','margin-top:0')}</div>`;
  }

  const SKIP = new Set(['PATIENT','ENCOUNTER']);
  const PAIRS: [string,string][] = [
    ['PAST MEDICAL HISTORY','SURGICAL HISTORY'],
    ['MEDICATIONS','ALLERGIES'],
    ['FAMILY HISTORY','SOCIAL / HABITS'],
  ];
  const rendered = new Set<string>();
  let sectHtml = '';

  for (const s of sections) {
    if (SKIP.has(s.title) || rendered.has(s.title)) continue;
    const pair = PAIRS.find(p => p[0] === s.title);
    if (pair) {
      const partner = sections.find(x => x.title === pair[1]);
      if (partner && !rendered.has(partner.title)) {
        sectHtml += pair2(s.title, s.body, partner.title, partner.body);
        rendered.add(s.title); rendered.add(partner.title); continue;
      }
    }
    sectHtml += sHtml(s.title, s.body);
    rendered.add(s.title);
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Clinical Note — ${escHtml(ctx.patientName || 'Patient')}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:#111;background:#fff}.lhd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid ${NAVY};padding-bottom:8px;margin-bottom:8px}.hl{font-size:12px;font-weight:700;color:${NAVY}}.hs{font-size:10px;color:#555;margin-top:2px}.ptg{display:grid;grid-template-columns:repeat(4,1fr);gap:5px 10px;background:#f5ede0;border:1px solid #e2d9cf;border-radius:6px;padding:8px 12px;margin-bottom:2px}.pl{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#8b6a50;margin-bottom:1px}.pv{font-size:11px;font-weight:700;color:#1a1a1a}.sig{margin-top:16px;padding-top:8px;border-top:1.5px solid #ccc;display:flex;justify-content:space-between;align-items:flex-end}@page{margin:10mm 12mm;size:A4}@media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}</style>
</head><body>
<div class="lhd"><div><div class="hl">${escHtml(site.name)}</div><div class="hs">${escHtml(site.address)}</div><div class="hs">Tel: 1 (758) 720 7111 · amisesuite@gmail.com</div><div class="hs" style="color:${NAVY};margin-top:2px">${escHtml(now)}</div></div><div>${LOGO_SVG}</div></div>
${demoGrid}${sectHtml}
<div class="sig"><div><div style="border-bottom:1px solid #333;width:185px;height:20px;margin-bottom:3px"></div><div style="font-weight:700;font-size:11px">Dr. Dawit D Kabiye</div><div style="font-size:9.5px;color:#555">MD, DM · General &amp; Endoscopic Surgery</div><div style="font-size:9px;color:#888">Licence #: ............&nbsp;&nbsp;Date: ..................</div></div><div style="font-size:8.5px;color:#aaa;text-align:right">Generated ${escHtml(now)}</div></div>
</body></html>`;
}

// ── Referral letter HTML ──────────────────────────────────────────────────────

function buildReferralHtml(ctx: Ctx, referTo: string, referNotes: string): string {
  const site = SITE_INFO[ctx.currentSite] ?? SITE_INFO.rodney_bay;
  const now = ectNow();
  const ageLine = [ctx.age ? `${ctx.age} yrs` : '', ctx.sex !== 'unknown' ? ctx.sex : ''].filter(Boolean).join(', ');
  const meds = [...ctx.medications, ...(ctx.medicationsText ? [ctx.medicationsText] : [])];
  const allergy = ctx.allergies || 'NKDA';

  function sc(title: string, content: string, accent = '#1a3a5c', bdr = '#d1d9e0'): string {
    return `<div style="border:1px solid ${bdr};border-radius:5px;margin-top:9px;overflow:hidden"><div style="background:${accent};color:#fff;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:4px 10px">${escHtml(title)}</div><div style="padding:8px 10px;font-size:12px;line-height:1.6;color:#111">${content}</div></div>`;
  }

  let sectHtml = '';
  if (ctx.symptoms.length || ctx.freeText) {
    const parts: string[] = [];
    if (ctx.symptoms.length) parts.push(`<p>Presenting with: ${escHtml(ctx.symptoms.join(', '))}</p>`);
    if (ctx.freeText) parts.push(`<p style="margin-top:4px">${escHtml(ctx.freeText)}</p>`);
    if (ctx.durationDays) parts.push(`<p>Duration: ${escHtml(ctx.durationDays)} days</p>`);
    sectHtml += sc('Presenting History', parts.join(''), '#9a3412', '#fed7aa');
  }
  if (ctx.comorbidities.length || ctx.pmhNotes) {
    const parts: string[] = [];
    if (ctx.comorbidities.length) parts.push(`<ul style="margin:0 0 0 14px;padding:0">${ctx.comorbidities.map(c => `<li style="margin:2px 0">${escHtml(c)}</li>`).join('')}</ul>`);
    if (ctx.pmhNotes) parts.push(`<p style="margin-top:4px">${escHtml(ctx.pmhNotes)}</p>`);
    sectHtml += sc('Past Medical History', parts.join(''));
  }
  if (meds.length) {
    sectHtml += sc('Current Medications', `<ul style="margin:0 0 0 14px;padding:0">${meds.map(m => `<li style="margin:2px 0">${escHtml(m)}</li>`).join('')}</ul>`, '#6d28d9', '#e9d5ff');
  }
  sectHtml += sc('Allergies', `<p>${escHtml(allergy)}</p>`, '#6d28d9', '#e9d5ff');
  if (ctx.assessment || ctx.icdCodes.length) {
    const parts: string[] = [];
    if (ctx.assessment) parts.push(`<p>${escHtml(ctx.assessment)}</p>`);
    if (ctx.icdCodes.length) parts.push(`<p style="margin-top:4px;font-size:11px;color:#555">ICD-10: ${escHtml(ctx.icdCodes.join(', '))}</p>`);
    sectHtml += sc('Clinical Assessment', parts.join(''), '#065f46', '#6ee7b7');
  }
  if (referNotes) {
    sectHtml += sc('Reason for Referral', `<p>${escHtml(referNotes).replace(/\n/g, '<br>')}</p>`, '#5b21b6', '#c4b5fd');
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Referral — ${escHtml(ctx.patientName || 'Patient')}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:#111;line-height:1.6;background:#fff}.lhd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a3a5c;padding-bottom:10px;margin-bottom:12px}.hl{font-size:13px;font-weight:700;color:#1a3a5c}.hs{font-size:10.5px;color:#555;margin-top:2px}.ttl{font-size:15px;font-weight:700;text-align:center;color:#1a3a5c;letter-spacing:.5px;text-transform:uppercase;margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid #e0e4ea}.sig{margin-top:32px;padding-top:10px;border-top:1.5px solid #ccc;display:flex;justify-content:space-between;align-items:flex-end}@page{margin:14mm 16mm;size:A4}@media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}</style>
</head><body>
<div class="lhd"><div><div class="hl">${escHtml(site.name)}</div><div class="hs">${escHtml(site.address)}</div><div class="hs">Tel: 1 (758) 720 7111 · amisesuite@gmail.com</div><div class="hs" style="color:#1a3a5c;margin-top:2px">${escHtml(now)}</div></div><div>${LOGO_SVG}</div></div>
<div class="ttl">Referral Letter</div>
<p>Dear Colleague${referTo ? ` / ${escHtml(referTo)}` : ''},</p>
<p style="margin-top:8px">I am writing to refer <strong>${escHtml(ctx.patientName || 'this patient')}</strong>${ageLine ? `, ${escHtml(ageLine)},` : ''} who was seen at ${escHtml(site.name)} on ${escHtml(now)}.</p>
${sectHtml}
<p style="margin-top:14px">I would be grateful for your review and further management. Please do not hesitate to contact our office if you require further information.</p>
<p style="margin-top:8px">Kind regards,</p>
<div class="sig"><div><div style="border-bottom:1px solid #333;width:200px;height:22px;margin-bottom:3px"></div><div style="font-weight:700;font-size:12.5px">Dr. Dawit D Kabiye</div><div style="font-size:10.5px;color:#555">MD, DM · General &amp; Endoscopic Surgery</div><div style="font-size:9.5px;color:#888">${escHtml(site.name)} · 1 (758) 720 7111</div><div style="font-size:9.5px;color:#888">Licence #: ............&nbsp;&nbsp;&nbsp;&nbsp;Date: ..................</div></div><div></div></div>
</body></html>`;
}

// ── Discharge summary HTML ────────────────────────────────────────────────────

function buildDischargeHtml(ctx: Ctx, dischargeNotes: string, followUp: string, warnings: string): string {
  const site = SITE_INFO[ctx.currentSite] ?? SITE_INFO.rodney_bay;
  const now = ectNow();
  const ageLine = [ctx.age ? `${ctx.age} yrs` : '', ctx.sex !== 'unknown' ? ctx.sex : ''].filter(Boolean).join(', ');
  const meds = [...ctx.medications, ...(ctx.medicationsText ? [ctx.medicationsText] : [])];

  function sc(title: string, content: string, accent = '#1a3a5c', bg = '#fff', bdr = '#d1d9e0'): string {
    return `<div style="border:1px solid ${bdr};border-radius:5px;margin-top:8px;overflow:hidden"><div style="background:${accent};color:#fff;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;padding:4px 10px">${escHtml(title)}</div><div style="background:${bg};padding:8px 10px;font-size:12px;line-height:1.6;color:#111">${content}</div></div>`;
  }

  let sectHtml = '';
  if (ctx.assessment || ctx.icdCodes.length) {
    const parts: string[] = [];
    if (ctx.assessment) parts.push(`<p>${escHtml(ctx.assessment)}</p>`);
    if (ctx.icdCodes.length) parts.push(`<p style="font-size:11px;color:#555;margin-top:3px">ICD-10: ${escHtml(ctx.icdCodes.join(', '))}</p>`);
    sectHtml += sc('Diagnosis', parts.join(''), '#065f46', '#f0fdf4', '#bbf7d0');
  }
  if (ctx.plan || ctx.procedures) {
    const parts: string[] = [];
    if (ctx.procedures) parts.push(`<p>${escHtml(ctx.procedures)}</p>`);
    if (ctx.plan) parts.push(`<p style="margin-top:4px">${escHtml(ctx.plan).replace(/\n/g, '<br>')}</p>`);
    sectHtml += sc('Treatment / Procedures', parts.join(''), '#1a3a5c', '#eff6ff', '#bfdbfe');
  }
  if (meds.length) {
    sectHtml += sc('Medications on Discharge', `<ul style="margin:0 0 0 14px;padding:0">${meds.map(m => `<li style="margin:2px 0">${escHtml(m)}</li>`).join('')}</ul>`, '#6d28d9', '#fdf4ff', '#e9d5ff');
  }
  if (dischargeNotes) {
    sectHtml += sc('Discharge Instructions', `<p>${escHtml(dischargeNotes).replace(/\n/g, '<br>')}</p>`, '#075985', '#f0f9ff', '#bae6fd');
  }
  if (warnings) {
    sectHtml += sc('Warning Signs — Return Immediately If', `<p style="color:#b91c1c">${escHtml(warnings).replace(/\n/g, '<br>')}</p>`, '#b91c1c', '#fff5f5', '#fca5a5');
  }
  if (followUp) {
    sectHtml += sc('Follow-up Plan', `<p>${escHtml(followUp).replace(/\n/g, '<br>')}</p>`);
  }

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Discharge — ${escHtml(ctx.patientName || 'Patient')}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;line-height:1.6;background:#fff}.lhd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a3a5c;padding-bottom:10px;margin-bottom:12px}.hl{font-size:13px;font-weight:700;color:#1a3a5c}.hs{font-size:10.5px;color:#555;margin-top:2px}.ttl{font-size:15px;font-weight:700;text-align:center;color:#1a3a5c;letter-spacing:.5px;text-transform:uppercase;margin:0 0 10px;padding-bottom:8px;border-bottom:1px solid #e0e4ea}.ptg{background:#f4f6f9;border:1px solid #d8dde6;border-radius:5px;padding:10px 14px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.ptl{font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;color:#888;font-weight:700;margin-bottom:2px}.ptv{font-size:12px;font-weight:700}.pts{font-size:10.5px;color:#555;margin-top:1px}.sig{margin-top:28px;padding-top:8px;border-top:1.5px solid #ccc;display:flex;justify-content:space-between;align-items:flex-end}@page{margin:14mm 16mm;size:A4}@media print{*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}</style>
</head><body>
<div class="lhd"><div><div class="hl">${escHtml(site.name)}</div><div class="hs">${escHtml(site.address)}</div><div class="hs">Tel: 1 (758) 720 7111 · amisesuite@gmail.com</div><div class="hs" style="color:#1a3a5c;margin-top:2px">${escHtml(now)}</div></div><div>${LOGO_SVG}</div></div>
<div class="ttl">Discharge / Clinic Summary</div>
<div class="ptg"><div><div class="ptl">Patient</div><div class="ptv">${escHtml(ctx.patientName || '—')}</div>${ageLine ? `<div class="pts">${escHtml(ageLine)}</div>` : ''}${ctx.phone ? `<div class="pts">${escHtml(ctx.phone)}</div>` : ''}</div><div><div class="ptl">Clinician</div><div class="ptv">Dr. Dawit D Kabiye</div><div class="pts">MD, DM · General &amp; Endoscopic Surgery</div><div class="pts">${escHtml(now)}</div></div></div>
${sectHtml}<div class="sig"><div><div style="border-bottom:1px solid #333;width:200px;height:22px;margin-bottom:3px"></div><div style="font-weight:700;font-size:12px">Dr. Dawit D Kabiye</div><div style="font-size:10.5px;color:#555">MD, DM · General &amp; Endoscopic Surgery</div><div style="font-size:9.5px;color:#888">Licence #: ............&nbsp;&nbsp;&nbsp;&nbsp;Date: ..................</div></div><div style="font-size:9px;color:#aaa;text-align:right">Issued: ${escHtml(now)}</div></div>
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

// ── Section parser / serialiser ───────────────────────────────────────────────

interface DocSection { title: string; body: string }

function parseDocSections(text: string): { header: string; sections: DocSection[] } {
  const re = /\n([A-Z][A-Z\s\/\-\.]+)\n─{10,}/g;
  const breaks: { title: string; pos: number; bodyStart: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    breaks.push({ title: m[1].trim(), pos: m.index, bodyStart: m.index + m[0].length });
  }
  if (breaks.length === 0) return { header: text, sections: [] };
  const header = text.slice(0, breaks[0].pos).trim();
  const sections = breaks.map((b, i) => ({
    title: b.title,
    body: text.slice(b.bodyStart, i + 1 < breaks.length ? breaks[i + 1].pos : text.length).trim(),
  }));
  return { header, sections };
}

function serializeDocSections(header: string, sections: DocSection[]): string {
  const SEP = '─'.repeat(48);
  return [header, ...sections.map(s => `\n${s.title}\n${SEP}\n${s.body}`)].join('\n');
}

// ── Section colour map ────────────────────────────────────────────────────────

const SECTION_COLORS: Record<string, { bg: string; border: string; hdr: string }> = {
  'PATIENT':                          { bg: '#eff6ff', border: '#bfdbfe', hdr: '#1e40af' },
  'ENCOUNTER':                        { bg: '#eff6ff', border: '#bfdbfe', hdr: '#1e40af' },
  'PRESENTING COMPLAINT':             { bg: '#fff7ed', border: '#fed7aa', hdr: '#9a3412' },
  'VITAL SIGNS':                      { bg: '#fef2f2', border: '#fecaca', hdr: '#991b1b' },
  'TRIAGE':                           { bg: '#fef2f2', border: '#fecaca', hdr: '#991b1b' },
  'REVIEW OF SYSTEMS':                { bg: '#f0f9ff', border: '#bae6fd', hdr: '#0369a1' },
  'SCALES':                           { bg: '#f0f9ff', border: '#bae6fd', hdr: '#0369a1' },
  'PAST MEDICAL HISTORY':             { bg: '#f9fafb', border: '#e5e7eb', hdr: '#374151' },
  'SURGICAL HISTORY':                 { bg: '#f9fafb', border: '#e5e7eb', hdr: '#374151' },
  'FAMILY HISTORY':                   { bg: '#f9fafb', border: '#e5e7eb', hdr: '#374151' },
  'SOCIAL / HABITS':                  { bg: '#f9fafb', border: '#e5e7eb', hdr: '#374151' },
  'MEDICATIONS':                      { bg: '#fdf4ff', border: '#e9d5ff', hdr: '#6d28d9' },
  'ALLERGIES':                        { bg: '#fdf4ff', border: '#e9d5ff', hdr: '#6d28d9' },
  'PHYSICAL EXAMINATION':             { bg: '#f0fdf4', border: '#bbf7d0', hdr: '#166534' },
  'INVESTIGATIONS':                   { bg: '#f0f9ff', border: '#bae6fd', hdr: '#075985' },
  'RADIOLOGY':                        { bg: '#f0f9ff', border: '#bae6fd', hdr: '#075985' },
  'CLINICAL IMAGES / ATTACHMENTS':    { bg: '#fefce8', border: '#fde68a', hdr: '#854d0e' },
  'ASSESSMENT':                       { bg: '#ecfdf5', border: '#6ee7b7', hdr: '#065f46' },
  'MANAGEMENT PLAN':                  { bg: '#f5f3ff', border: '#c4b5fd', hdr: '#5b21b6' },
};
const DEF_COLOR = { bg: '#f9fafb', border: '#e5e7eb', hdr: '#374151' };

// ── SectionCard ───────────────────────────────────────────────────────────────

function SectionCard({
  title, body, onChange, defaultOpen = true,
}: { title: string; body: string; onChange: (v: string) => void; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const c = SECTION_COLORS[title] ?? DEF_COLOR;
  const hintCount = (body.match(/▸ \[/g) ?? []).length;
  const lineCount = body.split('\n').length;

  return (
    <div style={{ border: `1.5px solid ${c.border}`, borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '9px 14px',
          background: c.bg, border: 'none', cursor: 'pointer', textAlign: 'left',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: c.hdr }}>
          {title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          {hintCount > 0 && (
            <span style={{ fontSize: 9.5, color: '#b45309', background: '#fef3c7', padding: '2px 7px', borderRadius: 999, fontWeight: 700, border: '1px solid #fde68a' }}>
              {hintCount} to complete
            </span>
          )}
          <span style={{
            fontSize: 13, color: c.hdr, lineHeight: 1,
            display: 'inline-block',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform .15s',
          }}>▾</span>
        </div>
      </button>

      {/* Body */}
      {open && (
        <div style={{ background: '#fff', borderTop: `1px solid ${c.border}`, padding: '10px 14px 12px' }}>
          <textarea
            value={body}
            onChange={e => onChange(e.target.value)}
            spellCheck
            style={{
              width: '100%',
              minHeight: Math.max(72, lineCount * 22),
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif',
              fontSize: 13,
              lineHeight: 1.65,
              color: '#1a1a1a',
              border: 'none',
              outline: 'none',
              resize: 'vertical',
              background: 'transparent',
              padding: 0,
            }}
          />
          {hintCount > 0 && (
            <div style={{ marginTop: 4, fontSize: 10.5, color: '#d97706', fontStyle: 'italic' }}>
              Lines starting with ▸ [ADD:] are fill-in prompts — edit or delete before printing.
            </div>
          )}
        </div>
      )}
    </div>
  );
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

function DocSectionView({ doc, onChange }: { doc: string; onChange: (v: string) => void }) {
  const { header, sections } = parseDocSections(doc);

  const updateSection = useCallback((idx: number, body: string) => {
    const next = sections.map((s, i) => i === idx ? { ...s, body } : s);
    onChange(serializeDocSections(header, next));
  }, [header, sections, onChange]);

  if (sections.length === 0) {
    // Fallback: plain textarea if format doesn't parse
    return (
      <textarea
        value={doc}
        onChange={e => onChange(e.target.value)}
        spellCheck
        style={{
          width: '100%', flex: 1, minHeight: 'calc(100vh - 220px)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif',
          fontSize: 13, lineHeight: 1.65, color: '#1a1a1a',
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
          padding: '14px 16px', resize: 'vertical', outline: 'none',
        }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Document header (site + timestamp) */}
      <div style={{
        padding: '8px 14px 10px', marginBottom: 8,
        background: '#1a3a5c', borderRadius: 10, color: '#e0eaf5',
        fontSize: 12, lineHeight: 1.6,
      }}>
        {header.split('\n').filter(Boolean).map((line, i) => (
          <div key={i} style={{ fontWeight: i === 0 ? 700 : 400, letterSpacing: i === 0 ? '0.04em' : 0 }}>
            {line}
          </div>
        ))}
      </div>

      {/* Clinical sections */}
      {sections.map((s, i) => (
        <SectionCard
          key={s.title + i}
          title={s.title}
          body={s.body}
          onChange={v => updateSection(i, v)}
          defaultOpen={true}
        />
      ))}

      {/* Key */}
      <div style={{ marginTop: 4, fontSize: 11, color: '#9ca3af', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span><code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>▸ [ADD: …]</code> fill-in prompt — edit or delete before printing</span>
        <span><code>✓</code> result &nbsp;<code>○</code> pending &nbsp;<code>→</code> ordered</span>
      </div>
    </div>
  );
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

      {/* ── Section cards ── */}
      {hasFinal && <DocSectionView doc={finalDocument} onChange={setFinalDocument} />}

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
