import { useState, useCallback } from 'react';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { useAppContext } from '@/context/AppContext';
import { closeEncounter } from '@/lib/db';
import {
  wrapDoc, masthead, metaGrid, sec as docSec, kvTable, bulList, inlineText, callout, footer, signoff, escH, AMISE_LOGO_SVG,
} from './lib/docTemplate';
import { printDoc, saveBlobAsPDF, downloadAsWord } from './lib/pdfExport';

// ── Local types ───────────────────────────────────────────────────────────────

interface RRLocal {
  modality: string; anatomicalRegion: string; laterality: string; urgency: string;
  indication: string; clinicalQuestion: string; ctContrast: string; ctEgfr: string;
  mriProtocol: string; mriSequences: string; scopeType: string; functionalType: string;
  resultReceived: boolean; resultNotes: string;
}
interface CALocal { name: string; anatomicalArea: string; dimensions: string; description: string; }
interface DischargeMed { drug: string; dose: string; route: string; frequency: string; duration: string; }
interface DischargePrintState {
  condition: string; meds: DischargeMed[]; diet: string; activity: string;
  wound: string; followup: string; redFlags: string[]; warnings: string; draft: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SITE_INFO: Record<string, { name: string; address: string; phone: string }> = {
  rodney_bay: { name: 'Rodney Bay Office', address: 'Providence Building, First Floor, Apt#3, Rodney Bay', phone: '1 (758) 720 7111' },
  tapion:     { name: 'Tapion Hospital',   address: 'Tapion, Saint Lucia', phone: '1 (758) 459 2227 / 1 (758) 284 0557' },
};
const APPT_LABELS: Record<string, string> = {
  new_consult: 'New Consultation', follow_up: 'Follow-up Consultation',
  post_op: 'Post-operative Review', ercp_workup: 'ERCP Work-up', ercp: 'ERCP Procedure',
  breast: 'Breast Clinic', telephone: 'Telephone Consultation', diabetic_foot: 'Diabetic Foot Clinic',
};


// ── Helpers ───────────────────────────────────────────────────────────────────

function ectNow() {
  return new Date().toLocaleString('en-GB', { timeZone: 'America/St_Lucia' });
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
  // Prefer structured CC entries from SOCRATES wizard; fall back to intake symptoms
  const ccEntries = (ctx.procedureData['cc'] as Array<{ complaint: string; answers: Record<string, string> }> | undefined) ?? [];
  const ccNames = ccEntries.length > 0
    ? ccEntries.map(e => e.complaint)
    : ctx.symptoms;
  if (ccNames.length > 0) {
    lines.push(`CC:       ${ccNames.join(' / ')}`);
  } else {
    lines.push(hint('enter presenting symptoms / chief complaint'));
  }
  lines.push(`Duration: ${ctx.durationDays ? ctx.durationDays + ' days' : hint('specify duration')}`);
  if (ctx.painScore) lines.push(`Pain:     ${ctx.painScore}/10`);

  // HPI narrative — prefer the live SOCRATES-generated prose from HpiTab
  const hpi = ctx.hpiNotes?.trim() || ctx.freeText?.trim();
  if (hpi) {
    lines.push('');
    lines.push(hpi);
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

  // Assessment
  lines.push(sec('ASSESSMENT'));
  let extractedDiffs = '';
  if (ctx.assessment) {
    let assessBody = ctx.assessment;
    // Jump to the first real assessment marker — strips any history context
    // that voice/AI echoed before the clinical impression.
    const wdIdx = assessBody.search(/Working Diagnosis:|Clinical Impression:|Impression:/i);
    if (wdIdx > 10) assessBody = assessBody.slice(wdIdx).trimStart();
    // Pull out any "Ranked differentials:" block — belongs in the Differentials section.
    const diffMatch = assessBody.match(/\n*Ranked differentials?:[\s\S]*/i);
    if (diffMatch && diffMatch.index !== undefined) {
      extractedDiffs = assessBody.slice(diffMatch.index).replace(/\n*Ranked differentials?:\s*/i, '').trim();
      assessBody = assessBody.slice(0, diffMatch.index).trimEnd();
    }
    lines.push(assessBody);
  } else {
    lines.push(hint('enter working diagnosis / clinical impression'));
  }
  if (ctx.icdCodes.length > 0) {
    lines.push(`ICD-10:      ${ctx.icdCodes.join('  |  ')}`);
  } else {
    lines.push(hint('add ICD-10 code(s)'));
  }
  const diffsToShow = ctx.differentials || extractedDiffs;
  if (diffsToShow) {
    lines.push('');
    lines.push('Differentials:');
    lines.push(diffsToShow);
  } else {
    lines.push(hint('list differential diagnoses in order of probability'));
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

  // Plan — keep the header diagnosis consistent with the assessment's working diagnosis.
  lines.push(sec('MANAGEMENT PLAN'));
  if (ctx.plan) {
    let planBody = ctx.plan;
    // Extract working diagnosis label (strip the ⚠ AI suggestion suffix if present).
    const wdLabel = ctx.assessment?.match(/Working Diagnosis:\s*([^⚠\n]+)/i)?.[1]?.trim();
    if (wdLabel) {
      planBody = planBody.replace(/^(Management Plan\s*(?:—|-)\s*)[^\n]*/m, `$1${wdLabel}`);
    }
    lines.push(planBody);
  } else {
    lines.push(hint('enter numbered management steps'));
    lines.push(hint('e.g. 1. IV access + fluids  2. Analgesia  3. Imaging  4. Consult  5. Admit / Discharge'));
    lines.push(hint('outpatient e.g. 1. Labs: FBC, U&E, LFTs  2. X-ray / imaging if indicated  3. Follow-up review in 2 weeks  4. Recommendations / lifestyle advice'));
  }
  if (ctx.cptCodes.length > 0) lines.push(`\nCPT:  ${ctx.cptCodes.join('  |  ')}`);
  if (ctx.procedures) { lines.push(''); lines.push(`Procedures: ${ctx.procedures}`); }

  // Exam photos
  if (ctx.examPhotos.length > 0) {
    lines.push(sec('CLINICAL PHOTOGRAPHS'));
    ctx.examPhotos.forEach((p, i) => {
      lines.push(`  [${i + 1}] ${p.bodyRegion}  (${p.distanceCm} cm)`);
      if (p.description) lines.push(`      ${p.description}`);
      lines.push(`      ${new Date(p.dateAdded).toLocaleString('en-GB', { timeZone: 'America/St_Lucia', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
    });
  }

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

  // Patient / Encounter → meta grid (two-column, no borders)
  const patSec = sections.find(s => s.title === 'PATIENT');
  const encSec = sections.find(s => s.title === 'ENCOUNTER');
  function parseKV(body: string): [string, string][] {
    return body.split('\n').filter(l => l.includes(':')).map(l => {
      const c = l.indexOf(':');
      return [l.slice(0, c).trim(), l.slice(c + 1).trim()] as [string, string];
    });
  }
  const metaFields = [
    ...(patSec ? parseKV(patSec.body) : []),
    ...(encSec ? parseKV(encSec.body) : []),
  ];
  const meta = metaFields.length
    ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-bottom:12px">${
        metaFields.filter(([, v]) => v).map(([l, v]) =>
          `<div><span style="font-size:10px;font-weight:700;color:#0B2545">${escH(l)}</span><br><span style="font-size:10.5px;color:#1A1A1A">${escH(v)}</span></div>`
        ).join('')
      }</div>`
    : '';

  // Section body → HTML (bullets + prose, no coloured backgrounds)
  function bodyHtml(body: string): string { return inlineText(body); }

  // Side-by-side pair
  const PAIRS: [string, string][] = [
    ['PAST MEDICAL HISTORY', 'SURGICAL HISTORY'],
    ['MEDICATIONS', 'ALLERGIES'],
    ['FAMILY HISTORY', 'SOCIAL / HABITS'],
  ];
  const SKIP = new Set(['PATIENT', 'ENCOUNTER']);
  const rendered = new Set<string>();
  let sectHtml = '';

  for (const s of sections) {
    if (SKIP.has(s.title) || rendered.has(s.title)) continue;
    const pair = PAIRS.find(p => p[0] === s.title);
    if (pair) {
      const partner = sections.find(x => x.title === pair[1]);
      if (partner && !rendered.has(partner.title)) {
        sectHtml += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 20px">
          ${docSec(s.title, bodyHtml(s.body))}${docSec(partner.title, bodyHtml(partner.body))}</div>`;
        rendered.add(s.title); rendered.add(partner.title); continue;
      }
    }
    sectHtml += docSec(s.title, bodyHtml(s.body));
    rendered.add(s.title);
  }

  const body =
    masthead('Encounter Record', site.name, site.address, site.phone, now, AMISE_LOGO_SVG) +
    meta + sectHtml +
    signoff('Dr Dawit Daniel Kabiye, MD, DM', 'General & Endoscopic Surgery · Amise Medical Services', 'Licence #: ............   Date: ..................') +
    footer('Prepared from the clinical encounter data entered at time of consultation. Verify all details before issuing.');

  return wrapDoc(`Clinical Note — ${ctx.patientName || 'Patient'}`, body);
}

// ── Referral letter HTML ──────────────────────────────────────────────────────

function buildReferralHtml(ctx: Ctx, referTo: string, referNotes: string): string {
  const site = SITE_INFO[ctx.currentSite] ?? SITE_INFO.rodney_bay;
  const now = ectNow();
  const ageLine = [ctx.age ? `${ctx.age} yrs` : '', ctx.sex !== 'unknown' ? ctx.sex : ''].filter(Boolean).join(', ');
  const meds = [...ctx.medications, ...(ctx.medicationsText ? [ctx.medicationsText] : [])];
  const allergy = ctx.allergies || 'NKDA (No Known Drug Allergies)';

  const patientRef = [ctx.dob ? `DOB: ${ctx.dob}` : '', ctx.nhiNumber ? `NHI: ${ctx.nhiNumber}` : ''].filter(Boolean).join(' · ');
  const meta = metaGrid([
    { label: 'Patient',   value: ctx.patientName || '—', sub: [ageLine, patientRef].filter(Boolean).join(' · ') || undefined },
    { label: 'Address',   value: ctx.address || '' },
    { label: 'Referring to', value: referTo || 'Specialist Colleague' },
    { label: 'Date',      value: now },
  ]);

  let sectHtml = '';
  if (ctx.symptoms.length || ctx.freeText) {
    const parts: string[] = [];
    if (ctx.symptoms.length) parts.push(`<p>Presenting complaint: ${escH(ctx.symptoms.join(', '))}</p>`);
    if (ctx.durationDays) parts.push(`<p>Duration: ${escH(ctx.durationDays)} days</p>`);
    if (ctx.freeText) parts.push(`<div style="margin-top:4px">${inlineText(ctx.freeText)}</div>`);
    sectHtml += docSec('Presenting history', parts.join(''));
  }
  if (ctx.comorbidities.length || ctx.pmhNotes) {
    const parts: string[] = [];
    if (ctx.comorbidities.length) parts.push(bulList(ctx.comorbidities));
    if (ctx.pmhNotes) parts.push(`<p style="margin-top:3px">${escH(ctx.pmhNotes)}</p>`);
    sectHtml += docSec('Past medical history', parts.join(''));
  }
  if (meds.length) sectHtml += docSec('Current medications', bulList(meds));
  sectHtml += docSec('Allergies', `<p>${escH(allergy)}</p>`);
  if (ctx.assessment || ctx.icdCodes.length) {
    const parts: string[] = [];
    if (ctx.assessment) parts.push(`<p>${escH(ctx.assessment)}</p>`);
    if (ctx.icdCodes.length) parts.push(`<p style="margin-top:3px;color:#6B7280;font-size:10px">ICD-10: ${escH(ctx.icdCodes.join(', '))}</p>`);
    sectHtml += docSec('Clinical assessment', parts.join(''));
  }
  if (referNotes) sectHtml += docSec('Reason for referral', inlineText(referNotes));

  const salutation = `<p style="margin:10px 0 4px">Dear Colleague${referTo ? ` / ${escH(referTo)}` : ''},</p>
<p>I am grateful for your review of <strong>${escH(ctx.patientName || 'this patient')}</strong>${ageLine ? `, ${escH(ageLine)},` : ''} who attended ${escH(site.name)} on ${escH(now)}.</p>`;
  const closing = `<p style="margin-top:14px">I would be grateful for your review and further management. Please do not hesitate to contact our rooms if further information is required.</p>
<p style="margin-top:6px">Kind regards,</p>`;

  const body =
    masthead('Referral Letter', site.name, site.address, site.phone, now, AMISE_LOGO_SVG) +
    meta + salutation + sectHtml + closing +
    signoff('Dr Dawit Daniel Kabiye, MD, DM', 'General & Endoscopic Surgery · Amise Medical Services', `${escH(site.name)} · ${site.phone}`) +
    footer('Prepared at time of consultation. Please verify clinical details before acting on this referral.');

  return wrapDoc(`Referral — ${ctx.patientName || 'Patient'}`, body);
}

// ── Discharge summary HTML ────────────────────────────────────────────────────

function medTableHtml(meds: DischargeMed[]): string {
  const hdr = ['Drug', 'Dose', 'Route', 'Frequency', 'Duration']
    .map(h => `<th style="text-align:left;padding:3px 8px;font-weight:700;color:#0B2545;font-size:10px">${h}</th>`)
    .join('');
  const rows = meds.map(m =>
    `<tr style="border-top:0.5pt solid #E5E7EB">` +
    [m.drug, m.dose, m.route, m.frequency, m.duration]
      .map(v => `<td style="padding:3px 8px;font-size:10.5px">${escH(v)}</td>`)
      .join('') +
    `</tr>`
  ).join('');
  return `<table style="width:100%;border-collapse:collapse;margin:4px 0"><thead><tr style="background:#f0f4f8">${hdr}</tr></thead><tbody>${rows}</tbody></table>`;
}

function buildDischargeHtml(ctx: Ctx, state: DischargePrintState): string {
  const site = SITE_INFO[ctx.currentSite] ?? SITE_INFO.rodney_bay;
  const now = ectNow();
  const ageLine = [ctx.age ? `${ctx.age} yrs` : '', ctx.sex !== 'unknown' ? ctx.sex : ''].filter(Boolean).join(', ');
  const preMeds = [...ctx.medications, ...(ctx.medicationsText ? [ctx.medicationsText] : [])];
  const allFlags = [...state.redFlags, ...(state.warnings ? [state.warnings] : [])];

  const dischPatientRef = [ageLine, ctx.dob ? `DOB: ${ctx.dob}` : '', ctx.nhiNumber ? `NHI: ${ctx.nhiNumber}` : ''].filter(Boolean).join(' · ');
  const meta = metaGrid([
    { label: 'Patient',   value: ctx.patientName || '—', sub: dischPatientRef || undefined },
    { label: 'Contact',   value: ctx.phone || '' },
    { label: 'Clinician', value: 'Dr Dawit Daniel Kabiye, MD, DM', sub: 'General & Endoscopic Surgery' },
    { label: 'Date',      value: now },
  ]);

  const medsSection = state.meds.length > 0
    ? docSec('Medications on discharge', medTableHtml(state.meds))
    : preMeds.length > 0 ? docSec('Medications on discharge', bulList(preMeds)) : '';

  const flagsSection = allFlags.length > 0
    ? callout('Return immediately if any of the following occur', bulList(allFlags))
    : '';

  // When AI draft exists it is the primary narrative body
  if (state.draft) {
    const body =
      masthead('Discharge Summary', site.name, site.address, site.phone, now, AMISE_LOGO_SVG) +
      meta +
      `<div style="white-space:pre-wrap;font-size:10.5px;line-height:1.65;color:#1A1A1A;margin-bottom:12px">${escH(state.draft)}</div>` +
      medsSection + flagsSection +
      signoff('Dr Dawit Daniel Kabiye, MD, DM', 'General & Endoscopic Surgery · Amise Medical Services', 'Licence #: ............   Date: ..................') +
      footer('AI-assisted draft reviewed and approved by the discharging clinician. Please keep this summary for your records.');
    return wrapDoc(`Discharge — ${ctx.patientName || 'Patient'}`, body);
  }

  // Structured rendering when no AI draft
  let sectHtml = '';
  if (ctx.assessment || ctx.icdCodes.length) {
    const parts: string[] = [];
    if (ctx.assessment) parts.push(`<p>${escH(ctx.assessment)}</p>`);
    if (ctx.icdCodes.length) parts.push(`<p style="margin-top:3px;color:#6B7280;font-size:10px">ICD-10: ${escH(ctx.icdCodes.join(', '))}</p>`);
    sectHtml += docSec('Diagnosis', parts.join(''));
  }
  if (ctx.procedures) sectHtml += docSec('Procedure performed', `<p>${escH(ctx.procedures)}</p>`);
  if (state.condition) sectHtml += docSec('Condition on discharge', `<p>${escH(state.condition)}</p>`);
  sectHtml += medsSection;
  const instrParts: string[] = [];
  if (state.wound) instrParts.push(`<p style="margin:3px 0"><strong>Wound care:</strong> ${escH(state.wound)}</p>`);
  if (state.diet) instrParts.push(`<p style="margin:3px 0"><strong>Diet:</strong> ${escH(state.diet)}</p>`);
  if (state.activity) instrParts.push(`<p style="margin:3px 0"><strong>Activity:</strong> ${escH(state.activity)}</p>`);
  if (instrParts.length) sectHtml += docSec('Discharge instructions', instrParts.join(''));
  if (state.followup) sectHtml += docSec('Follow-up plan', inlineText(state.followup));
  sectHtml += flagsSection;

  const body =
    masthead('Discharge / Clinic Summary', site.name, site.address, site.phone, now, AMISE_LOGO_SVG) +
    meta + sectHtml +
    signoff('Dr Dawit Daniel Kabiye, MD, DM', 'General & Endoscopic Surgery · Amise Medical Services', 'Licence #: ............   Date: ..................') +
    footer('Please keep this summary for your records. Contact our office if you have questions about your care.');

  return wrapDoc(`Discharge — ${ctx.patientName || 'Patient'}`, body);
}

// ── Word body builders ────────────────────────────────────────────────────────

function h(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function wordMeta(rows: [string, string][]): string {
  return `<table style="width:100%;border-collapse:collapse;margin-bottom:12pt">${
    rows.filter(([,v]) => v).map(([l,v]) =>
      `<tr><td style="font-weight:700;color:#0B2545;width:30%;font-size:10pt;padding:2pt 6pt 2pt 0;vertical-align:top;white-space:nowrap">${h(l)}</td><td style="font-size:10.5pt;padding:2pt 0">${h(v)}</td></tr>`
    ).join('')
  }</table>`;
}
function wordHdr(title: string): string {
  return `<h3 style="font-size:10pt;font-weight:700;color:#0B2545;border-bottom:.75pt solid #C8A24B;padding-bottom:3pt;margin:12pt 0 5pt">${h(title)}</h3>`;
}
function wordBulList(items: string[]): string {
  return items.filter(Boolean).map(i => `<p style="margin:2pt 0;font-size:10.5pt;padding-left:12pt">• ${h(i)}</p>`).join('');
}
function wordSig(): string {
  return `<div style="margin-top:36pt"><p style="margin:0;font-weight:700;font-size:11pt">Dr Dawit Daniel Kabiye, MD, DM</p>
<p style="margin:0;font-size:10pt;color:#374151">General &amp; Endoscopic Surgery · Amise Medical Services</p>
<br><div style="border-bottom:1pt solid #333;width:220pt;height:20pt"></div>
<p style="margin:2pt 0;font-size:9pt;color:#6B7280">Licence #: ............&nbsp;&nbsp;&nbsp;Date: ..................</p></div>`;
}

function buildNoteWordBody(text: string, ctx: Ctx): string {
  const site = SITE_INFO[ctx.currentSite] ?? SITE_INFO.rodney_bay;
  const now = ectNow();
  const cleaned = cleanForPrint(text);
  const patLine = [ctx.patientName || '—', ctx.age ? `${ctx.age} yrs` : '', ctx.sex !== 'unknown' ? ctx.sex : '', ctx.dob ? `DOB: ${ctx.dob}` : '', ctx.nhiNumber ? `NHI: ${ctx.nhiNumber}` : ''].filter(Boolean).join(' · ');
  return `<h1 style="font-size:14pt;font-weight:700;color:#0B2545;margin:0 0 2pt">Clinical Encounter Note</h1>
<h2 style="font-size:10pt;color:#374151;font-weight:400;margin:0 0 10pt">Amise Medical Services · ${h(site.name)}</h2>
${wordMeta([['Patient', patLine], ['Contact', ctx.phone || ''], ['Date', now], ['Clinician', 'Dr Dawit Daniel Kabiye, MD, DM · General & Endoscopic Surgery']])}
<p style="white-space:pre-wrap;font-family:Arial;font-size:10.5pt;line-height:1.6;color:#1A1A1A">${h(cleaned)}</p>
${wordSig()}
<p style="margin-top:28pt;border-top:.5pt solid #0B2545;padding-top:4pt;font-size:8pt;color:#6B7280;font-style:italic">Prepared from clinical encounter data entered at time of consultation. Verify all details before issuing.</p>`;
}

function buildReferralWordBody(ctx: Ctx, referTo: string, referNotes: string): string {
  const site = SITE_INFO[ctx.currentSite] ?? SITE_INFO.rodney_bay;
  const now = ectNow();
  const ageLine = [ctx.age ? `${ctx.age} yrs` : '', ctx.sex !== 'unknown' ? ctx.sex : ''].filter(Boolean).join(', ');
  const patLine = [ctx.patientName || '—', ageLine, ctx.dob ? `DOB: ${ctx.dob}` : '', ctx.nhiNumber ? `NHI: ${ctx.nhiNumber}` : ''].filter(Boolean).join(' · ');
  const meds = [...ctx.medications, ...(ctx.medicationsText ? [ctx.medicationsText] : [])];
  const allergy = ctx.allergies || 'NKDA (No Known Drug Allergies)';
  let body = `<h1 style="font-size:14pt;font-weight:700;color:#0B2545;margin:0 0 2pt">Referral Letter</h1>
<h2 style="font-size:10pt;color:#374151;font-weight:400;margin:0 0 10pt">Amise Medical Services · ${h(site.name)}</h2>
${wordMeta([['Patient', patLine], ['Address', ctx.address || ''], ['Referring to', referTo || 'Specialist Colleague'], ['Date', now]])}
<p style="margin:8pt 0 4pt;font-size:10.5pt">Dear Colleague${referTo ? ` / ${h(referTo)}` : ''},</p>
<p style="margin:0 0 8pt;font-size:10.5pt">I am grateful for your review of <strong>${h(ctx.patientName || 'this patient')}</strong>${ageLine ? `, ${h(ageLine)},` : ''} who attended ${h(site.name)} on ${h(now)}.</p>`;
  if (ctx.symptoms.length || ctx.freeText) {
    body += wordHdr('Presenting History');
    if (ctx.symptoms.length) body += `<p style="font-size:10.5pt;margin:2pt 0">CC: ${h(ctx.symptoms.join(', '))}${ctx.durationDays ? ` (${ctx.durationDays} days)` : ''}</p>`;
    if (ctx.freeText) body += `<p style="font-size:10.5pt;margin:4pt 0;white-space:pre-wrap">${h(ctx.freeText)}</p>`;
  }
  if (ctx.comorbidities.length || ctx.pmhNotes) {
    body += wordHdr('Past Medical History');
    body += wordBulList(ctx.comorbidities);
    if (ctx.pmhNotes) body += `<p style="font-size:10.5pt;margin:2pt 0">${h(ctx.pmhNotes)}</p>`;
  }
  if (meds.length) { body += wordHdr('Current Medications'); body += wordBulList(meds); }
  body += wordHdr('Allergies');
  body += `<p style="font-size:10.5pt;margin:2pt 0;color:#dc2626;font-weight:600">${h(allergy)}</p>`;
  if (ctx.assessment) { body += wordHdr('Clinical Assessment'); body += `<p style="font-size:10.5pt;margin:2pt 0">${h(ctx.assessment)}</p>`; }
  if (referNotes) { body += wordHdr('Reason for Referral'); body += `<p style="font-size:10.5pt;margin:2pt 0;white-space:pre-wrap">${h(referNotes)}</p>`; }
  body += `<p style="margin-top:12pt;font-size:10.5pt">I would be grateful for your review and further management. Please do not hesitate to contact our rooms if further information is required.</p>`;
  body += wordSig();
  body += `<p style="margin-top:28pt;border-top:.5pt solid #0B2545;padding-top:4pt;font-size:8pt;color:#6B7280;font-style:italic">Prepared at time of consultation. Please verify clinical details before acting on this referral.</p>`;
  return body;
}

function buildDischargeWordBody(ctx: Ctx, state: DischargePrintState): string {
  const site = SITE_INFO[ctx.currentSite] ?? SITE_INFO.rodney_bay;
  const now = ectNow();
  const ageLine = [ctx.age ? `${ctx.age} yrs` : '', ctx.sex !== 'unknown' ? ctx.sex : ''].filter(Boolean).join(', ');
  const patLine = [ctx.patientName || '—', ageLine, ctx.dob ? `DOB: ${ctx.dob}` : '', ctx.nhiNumber ? `NHI: ${ctx.nhiNumber}` : ''].filter(Boolean).join(' · ');
  const allFlags = [...state.redFlags, ...(state.warnings ? [state.warnings] : [])];
  let body = `<h1 style="font-size:14pt;font-weight:700;color:#0B2545;margin:0 0 2pt">Discharge Summary</h1>
<h2 style="font-size:10pt;color:#374151;font-weight:400;margin:0 0 10pt">Amise Medical Services · ${h(site.name)}</h2>
${wordMeta([['Patient', patLine], ['Contact', ctx.phone || ''], ['Clinician', 'Dr Dawit Daniel Kabiye, MD, DM'], ['Date', now]])}`;
  if (state.draft) {
    body += `<p style="white-space:pre-wrap;font-size:10.5pt;line-height:1.6;margin-top:8pt">${h(state.draft)}</p>`;
  } else {
    if (ctx.assessment) { body += wordHdr('Diagnosis'); body += `<p style="font-size:10.5pt;margin:2pt 0">${h(ctx.assessment)}${ctx.icdCodes.length ? ` (${ctx.icdCodes.join(', ')})` : ''}</p>`; }
    if (ctx.procedures) { body += wordHdr('Procedure Performed'); body += `<p style="font-size:10.5pt;margin:2pt 0">${h(ctx.procedures)}</p>`; }
    if (state.condition) { body += wordHdr('Condition on Discharge'); body += `<p style="font-size:10.5pt;margin:2pt 0">${h(state.condition)}</p>`; }
  }
  if (state.meds.length > 0) {
    body += wordHdr('Medications on Discharge');
    body += `<table style="width:100%;border-collapse:collapse;font-size:10pt"><tr style="background:#f0f4f8">${['Drug','Dose','Route','Frequency','Duration'].map(h2=>`<th style="text-align:left;padding:3pt 6pt;font-weight:700;color:#0B2545">${h2}</th>`).join('')}</tr>`;
    body += state.meds.map(m=>`<tr style="border-top:.5pt solid #E5E7EB">${[m.drug,m.dose,m.route,m.frequency,m.duration].map(v=>`<td style="padding:3pt 6pt">${h(v)}</td>`).join('')}</tr>`).join('');
    body += `</table>`;
  }
  const instrParts: string[] = [];
  if (state.wound) instrParts.push(`Wound care: ${state.wound}`);
  if (state.diet) instrParts.push(`Diet: ${state.diet}`);
  if (state.activity) instrParts.push(`Activity: ${state.activity}`);
  if (instrParts.length) { body += wordHdr('Discharge Instructions'); instrParts.forEach(p => { body += `<p style="font-size:10.5pt;margin:2pt 0">${h(p)}</p>`; }); }
  if (state.followup) { body += wordHdr('Follow-up Plan'); body += `<p style="font-size:10.5pt;margin:2pt 0;white-space:pre-wrap">${h(state.followup)}</p>`; }
  if (allFlags.length) {
    body += `<div style="margin-top:10pt;border:1pt solid #fca5a5;padding:8pt;border-radius:4pt"><p style="font-weight:700;color:#991b1b;font-size:10pt;margin:0 0 4pt">⚠ Return Immediately If:</p>${wordBulList(allFlags)}</div>`;
  }
  body += wordSig();
  body += `<p style="margin-top:28pt;border-top:.5pt solid #0B2545;padding-top:4pt;font-size:8pt;color:#6B7280;font-style:italic">Please keep this summary for your records. Contact our office if you have questions about your care.</p>`;
  return body;
}

// printHtml / downloadHtml → now provided by pdfExport (printDoc / saveBlobAsPDF)

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
  const [dischargeCondition, setDischargeCondition] = useState('Good');
  const [dischargeMeds, setDischargeMeds] = useState<DischargeMed[]>([]);
  const [dischargeWound, setDischargeWound] = useState('');
  const [dischargeDiet, setDischargeDiet] = useState<string[]>([]);
  const [dischargeDietNotes, setDischargeDietNotes] = useState('');
  const [dischargeActivity, setDischargeActivity] = useState<string[]>([]);
  const [dischargeActivityNotes, setDischargeActivityNotes] = useState('');
  const [dischargeFollowup, setDischargeFollowup] = useState('');
  const [dischargeRedFlags, setDischargeRedFlags] = useState<string[]>([]);
  const [dischargeWarnings, setDischargeWarnings] = useState('');
  const [dischargeDraft, setDischargeDraft] = useState('');
  const [dischargeDraftLoading, setDischargeDraftLoading] = useState(false);
  const [dischargeDraftError, setDischargeDraftError] = useState('');
  const [dischargeDraftEditing, setDischargeDraftEditing] = useState(false);
  const [dischargeDraftEditText, setDischargeDraftEditText] = useState('');

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const [docFormat, setDocFormat] = useState<'note' | 'referral' | 'discharge'>('note');

  const [closing, setClosing] = useState(false);
  const [closeMsg, setCloseMsg] = useState('');

  async function handleCloseEncounter() {
    if (!ctx.encounterId) return;
    if (!window.confirm(
      `Close this encounter for ${ctx.patientName || 'this patient'}?\n\n` +
      'The encounter will be marked closed and locked for further edits. ' +
      'All saved data remains in the record.',
    )) return;
    setClosing(true);
    setCloseMsg('');
    const { error } = await closeEncounter(ctx.encounterId);
    setClosing(false);
    if (error) {
      setCloseMsg(`Error: ${error}`);
    } else {
      setCloseMsg('Encounter closed.');
      ctx.setEncounterId(null);
    }
  }

  const site = SITE_INFO[ctx.currentSite] ?? SITE_INFO.rodney_bay;
  const patSlug = (ctx.patientName || 'patient').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const dateStr = new Date().toISOString().slice(0, 10);
  const dischargePrintState: DischargePrintState = {
    condition: dischargeCondition,
    meds: dischargeMeds,
    diet: [...dischargeDiet, ...(dischargeDietNotes ? [dischargeDietNotes] : [])].join('; '),
    activity: [...dischargeActivity, ...(dischargeActivityNotes ? [dischargeActivityNotes] : [])].join('; '),
    wound: dischargeWound,
    followup: dischargeFollowup,
    redFlags: dischargeRedFlags,
    warnings: dischargeWarnings,
    draft: dischargeDraft,
  };

  const hasFinal = !!finalDocument;

  async function handleAiRefine() {
    if (!finalDocument) return;
    setAiLoading(true);
    setAiError('');
    try {
      const apiOrigin = getApiOrigin();
      const base = apiOrigin || (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
      const res = await fetch(`${base}/api/ai/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ text: finalDocument }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { refined: string };
      setFinalDocument(data.refined);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Unknown error');
      setShowImport(true);
    } finally {
      setAiLoading(false);
    }
  }

  async function generateDischargeDraft() {
    setDischargeDraftLoading(true);
    setDischargeDraftError('');
    try {
      const apiOrigin = getApiOrigin();
      const base = apiOrigin || (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
      const res = await fetch(`${base}/api/ai/discharge-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({
          type: ctx.encounterMode === 'inpatient' ? 'inpatient' : 'outpatient',
          patientName: ctx.patientName || undefined,
          patientAge: ctx.age || undefined,
          patientSex: ctx.sex !== 'unknown' ? ctx.sex : undefined,
          mrNumber: ctx.mrNumber || undefined,
          dateAdmission: ctx.dateAdmission || undefined,
          dateDischarge: ctx.dateDischarge || undefined,
          ward: ctx.ward || undefined,
          admittingSurgeon: ctx.admittingSurgeon || undefined,
          diagnosis: ctx.assessment,
          icdCodes: ctx.icdCodes.length ? ctx.icdCodes : undefined,
          procedurePerformed: ctx.procedures || undefined,
          conditionOnDischarge: dischargeCondition || undefined,
          dischargeMedications: dischargeMeds.filter(m => m.drug),
          preAdmissionMedications: [...ctx.medications, ...(ctx.medicationsText ? [ctx.medicationsText] : [])].join('; ') || undefined,
          allergies: ctx.allergies || undefined,
          woundCare: dischargeWound || undefined,
          dietInstructions: [...dischargeDiet, ...(dischargeDietNotes ? [dischargeDietNotes] : [])].filter(Boolean).join('; ') || undefined,
          activityRestrictions: [...dischargeActivity, ...(dischargeActivityNotes ? [dischargeActivityNotes] : [])].filter(Boolean).join('; ') || undefined,
          followUpPlan: dischargeFollowup || undefined,
          redFlags: dischargeRedFlags.length ? dischargeRedFlags : undefined,
          additionalWarnings: dischargeWarnings || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { success: boolean; summary: string };
      setDischargeDraft(data.summary);
    } catch (e) {
      setDischargeDraftError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setDischargeDraftLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
        padding: '10px 0 10px', borderBottom: '1px solid #e5e7eb', marginBottom: 10,
      }}>
        {/* Format selector + populate */}
        <select
          value={docFormat}
          onChange={e => setDocFormat(e.target.value as 'note' | 'referral' | 'discharge')}
          style={{
            padding: '5px 8px', borderRadius: 7, fontSize: 12, fontWeight: 600,
            border: '1px solid #d1d5db', background: '#f9fafb', cursor: 'pointer',
            color: '#1a3a5c',
          }}
        >
          <option value="note">Clinical Note</option>
          <option value="referral">Referral Letter</option>
          <option value="discharge">Discharge Summary</option>
        </select>

        <button type="button" style={BTN_PRIMARY} onClick={() => {
          if (docFormat === 'note') {
            setFinalDocument(buildDocument(ctx));
          } else if (docFormat === 'referral') {
            setShowReferral(true);
          } else {
            setShowDischarge(true);
          }
        }}>
          ↺ Generate
        </button>

        <button type="button" style={hasFinal ? { ...BTN_PRIMARY, background: '#0b8278' } : btnDisabled({ ...BTN_PRIMARY, background: '#0b8278' })}
          disabled={!hasFinal}
          onClick={() => void saveBlobAsPDF(buildPrintHtml(finalDocument, ctx), `note-${patSlug}-${dateStr}.pdf`)}>
          ↓ PDF
        </button>

        <button type="button" style={hasFinal ? BTN_GHOST : btnDisabled(BTN_GHOST)}
          disabled={!hasFinal}
          onClick={() => printDoc(buildPrintHtml(finalDocument, ctx))}>
          🖨 Print
        </button>

        <button type="button" style={hasFinal ? BTN_GHOST : btnDisabled(BTN_GHOST)}
          disabled={!hasFinal}
          onClick={() => downloadAsWord(buildNoteWordBody(finalDocument, ctx), `note-${patSlug}-${dateStr}`, `Clinical Note — ${ctx.patientName || 'Patient'}`)}>
          📄 Word
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

        {ctx.encounterId && (
          <>
            <div style={{ width: 1, height: 20, background: '#e5e7eb', margin: '0 2px' }} />
            <button
              type="button"
              style={closing ? btnDisabled({ ...BTN_BASE, background: '#dc2626', color: '#fff', border: 'none' }) : { ...BTN_BASE, background: '#dc2626', color: '#fff', border: 'none' }}
              disabled={closing}
              onClick={() => void handleCloseEncounter()}
            >
              {closing ? '⏳ Closing…' : '✓ Close Encounter'}
            </button>
          </>
        )}
        {closeMsg && (
          <span style={{ fontSize: 11, color: closeMsg.startsWith('Error') ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
            {closeMsg}
          </span>
        )}
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
              onClick={() => void saveBlobAsPDF(buildReferralHtml(ctx, referTo, referNotes), `referral-${patSlug}-${dateStr}.pdf`)}>
              ↓ PDF
            </button>
            <button type="button" style={BTN_GHOST}
              onClick={() => printDoc(buildReferralHtml(ctx, referTo, referNotes))}>
              🖨 Print
            </button>
            <button type="button" style={BTN_GHOST}
              onClick={() => downloadAsWord(buildReferralWordBody(ctx, referTo, referNotes), `referral-${patSlug}-${dateStr}`, `Referral — ${ctx.patientName || 'Patient'}`)}>
              📄 Word
            </button>
            <button type="button" style={{ ...BTN_GHOST, marginLeft: 'auto' }} onClick={() => setShowReferral(false)}>× Close</button>
          </div>
        </div>
      )}

      {/* ── Discharge panel ── */}
      {showDischarge && (
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '14px 16px', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#075985' }}>📄 Discharge / Clinic Summary</div>
            <button type="button" style={{ ...BTN_GHOST, fontSize: 11 }} onClick={() => setShowDischarge(false)}>× Close</button>
          </div>

          {/* Condition on discharge */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', marginBottom: 5 }}>CONDITION ON DISCHARGE</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['Good', 'Satisfactory', 'Fair', 'Guarded', 'Poor'].map(c => (
                <button key={c} type="button" onClick={() => setDischargeCondition(c)}
                  style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
                    background: dischargeCondition === c ? '#0369a1' : '#e0f2fe',
                    color: dischargeCondition === c ? '#fff' : '#0369a1',
                    border: `1.5px solid ${dischargeCondition === c ? '#0369a1' : '#bae6fd'}` }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Discharge medications table */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', marginBottom: 5 }}>DISCHARGE MEDICATIONS</div>
            {dischargeMeds.length > 0 && (
              <div style={{ overflowX: 'auto', marginBottom: 6 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: '#e0f2fe' }}>
                      {['Drug', 'Dose', 'Route', 'Frequency', 'Duration', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '4px 6px', fontSize: 11, fontWeight: 700, color: '#0B2545', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dischargeMeds.map((m, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #e5e7eb' }}>
                        {(['drug', 'dose', 'route', 'frequency', 'duration'] as const).map(field => (
                          <td key={field} style={{ padding: '2px 4px' }}>
                            <input type="text" value={m[field]}
                              onChange={e => { const next = [...dischargeMeds]; next[i] = { ...next[i], [field]: e.target.value }; setDischargeMeds(next); }}
                              style={{ width: '100%', fontSize: 11.5, border: 'none', borderBottom: '1px solid #d1d5db', background: 'transparent', outline: 'none', padding: '2px 0' }}
                              placeholder={field.charAt(0).toUpperCase() + field.slice(1)} />
                          </td>
                        ))}
                        <td style={{ padding: '2px 4px' }}>
                          <button type="button" onClick={() => setDischargeMeds(dischargeMeds.filter((_, j) => j !== i))}
                            style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 2px' }}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button type="button" style={{ ...BTN_GHOST, fontSize: 11 }}
              onClick={() => setDischargeMeds([...dischargeMeds, { drug: '', dose: '', route: '', frequency: '', duration: '' }])}>
              + Add medication
            </button>
          </div>

          {/* Wound care + Diet */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', marginBottom: 5 }}>WOUND CARE</div>
              <textarea value={dischargeWound} onChange={e => setDischargeWound(e.target.value)}
                placeholder="Keep wound dry for 48 hrs; change dressing every 2 days…"
                style={{ width: '100%', fontSize: 12, minHeight: 64, borderRadius: 6, border: '1px solid #bae6fd', padding: '6px 8px', resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', marginBottom: 5 }}>DIET</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                {['Regular diet', 'Soft diet', 'Low-fat', 'Low-fibre', 'High-protein', 'Liquid only', 'Diabetic diet'].map(d => (
                  <button key={d} type="button"
                    onClick={() => setDischargeDiet(dischargeDiet.includes(d) ? dischargeDiet.filter(x => x !== d) : [...dischargeDiet, d])}
                    style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontWeight: 500,
                      background: dischargeDiet.includes(d) ? '#0369a1' : '#e0f2fe',
                      color: dischargeDiet.includes(d) ? '#fff' : '#0369a1',
                      border: `1px solid ${dischargeDiet.includes(d) ? '#0369a1' : '#bae6fd'}` }}>{d}</button>
                ))}
              </div>
              <input type="text" value={dischargeDietNotes} onChange={e => setDischargeDietNotes(e.target.value)}
                placeholder="Additional diet notes…"
                style={{ width: '100%', fontSize: 12, borderRadius: 6, border: '1px solid #bae6fd', padding: '6px 8px' }} />
            </div>
          </div>

          {/* Activity restrictions */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', marginBottom: 5 }}>ACTIVITY RESTRICTIONS</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
              {['No restrictions', 'Light duties only', 'No lifting >5 kg', 'No lifting >10 kg', 'No driving (2 weeks)', 'No driving (6 weeks)', 'Gradual mobilisation', 'Bedrest'].map(a => (
                <button key={a} type="button"
                  onClick={() => setDischargeActivity(dischargeActivity.includes(a) ? dischargeActivity.filter(x => x !== a) : [...dischargeActivity, a])}
                  style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontWeight: 500,
                    background: dischargeActivity.includes(a) ? '#0369a1' : '#e0f2fe',
                    color: dischargeActivity.includes(a) ? '#fff' : '#0369a1',
                    border: `1px solid ${dischargeActivity.includes(a) ? '#0369a1' : '#bae6fd'}` }}>{a}</button>
              ))}
            </div>
            <input type="text" value={dischargeActivityNotes} onChange={e => setDischargeActivityNotes(e.target.value)}
              placeholder="Additional activity notes…"
              style={{ width: '100%', fontSize: 12, borderRadius: 6, border: '1px solid #bae6fd', padding: '6px 8px' }} />
          </div>

          {/* Follow-up plan */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', marginBottom: 5 }}>FOLLOW-UP PLAN</div>
            <textarea value={dischargeFollowup} onChange={e => setDischargeFollowup(e.target.value)}
              placeholder="Review in OPD in 2 weeks for wound check and histology results…"
              style={{ width: '100%', fontSize: 12, minHeight: 52, borderRadius: 6, border: '1px solid #bae6fd', padding: '6px 8px', resize: 'vertical', fontFamily: 'inherit' }} />
          </div>

          {/* Red flags */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', marginBottom: 5 }}>⚠ RED FLAGS — RETURN IMMEDIATELY IF</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
              {[
                'Fever >38.5°C', 'Increasing or severe pain', 'Wound breakdown or discharge',
                'Wound swelling or redness', 'Persistent nausea or vomiting', 'Inability to eat or drink',
                'Rectal or wound bleeding', 'Chest pain', 'Shortness of breath',
                'Inability to pass urine', 'Jaundice (yellowing of skin/eyes)', 'Dizziness or collapse',
              ].map(f => (
                <button key={f} type="button"
                  onClick={() => setDischargeRedFlags(dischargeRedFlags.includes(f) ? dischargeRedFlags.filter(x => x !== f) : [...dischargeRedFlags, f])}
                  style={{ padding: '3px 9px', borderRadius: 20, fontSize: 11, cursor: 'pointer', fontWeight: 500,
                    background: dischargeRedFlags.includes(f) ? '#dc2626' : '#fef2f2',
                    color: dischargeRedFlags.includes(f) ? '#fff' : '#991b1b',
                    border: `1px solid ${dischargeRedFlags.includes(f) ? '#dc2626' : '#fca5a5'}` }}>{f}</button>
              ))}
            </div>
            <input type="text" value={dischargeWarnings} onChange={e => setDischargeWarnings(e.target.value)}
              placeholder="Additional warning signs…"
              style={{ width: '100%', fontSize: 12, borderRadius: 6, border: '1px solid #fca5a5', padding: '6px 8px' }} />
          </div>

          {/* AI draft */}
          <div style={{ borderTop: '1px solid #bae6fd', paddingTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <button type="button"
                style={dischargeDraftLoading || !ctx.assessment ? btnDisabled(BTN_WARN) : BTN_WARN}
                disabled={dischargeDraftLoading || !ctx.assessment}
                onClick={() => void generateDischargeDraft()}>
                {dischargeDraftLoading ? '⏳ Drafting…' : dischargeDraft ? '✦ Re-draft' : '✦ AI Draft Summary'}
              </button>
              {dischargeDraft && !dischargeDraftEditing && (
                <button type="button" style={BTN_GHOST}
                  onClick={() => { setDischargeDraftEditText(dischargeDraft); setDischargeDraftEditing(true); }}>
                  ✏ Edit draft
                </button>
              )}
              {!ctx.assessment && (
                <span style={{ fontSize: 11, color: '#b45309', fontStyle: 'italic' }}>Enter a diagnosis in the Assessment tab first</span>
              )}
            </div>
            {dischargeDraftError && (
              <div style={{ padding: '6px 10px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, fontSize: 12, color: '#b91c1c', marginBottom: 6 }}>
                ⚠ {dischargeDraftError}
              </div>
            )}
            {dischargeDraft && !dischargeDraftEditing && (
              <div style={{ padding: '10px 14px', background: '#fff', border: '1px solid #93c5fd', borderRadius: 8, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#1a1a1a', maxHeight: 360, overflowY: 'auto' }}>
                {dischargeDraft}
              </div>
            )}
            {dischargeDraftEditing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <textarea value={dischargeDraftEditText} onChange={e => setDischargeDraftEditText(e.target.value)}
                  style={{ width: '100%', minHeight: 200, fontSize: 12, lineHeight: 1.7, borderRadius: 6, border: '1px solid #93c5fd', padding: '8px 10px', resize: 'vertical', fontFamily: 'inherit' }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" style={BTN_ACCENT}
                    onClick={() => { setDischargeDraft(dischargeDraftEditText); setDischargeDraftEditing(false); }}>
                    ✓ Save changes
                  </button>
                  <button type="button" style={BTN_GHOST} onClick={() => setDischargeDraftEditing(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, paddingTop: 4, borderTop: '1px solid #bae6fd' }}>
            <button type="button" style={BTN_ACCENT}
              onClick={() => void saveBlobAsPDF(buildDischargeHtml(ctx, dischargePrintState), `discharge-${patSlug}-${dateStr}.pdf`)}>
              ↓ PDF
            </button>
            <button type="button" style={BTN_GHOST}
              onClick={() => printDoc(buildDischargeHtml(ctx, dischargePrintState))}>
              🖨 Print
            </button>
            <button type="button" style={BTN_GHOST}
              onClick={() => downloadAsWord(buildDischargeWordBody(ctx, dischargePrintState), `discharge-${patSlug}-${dateStr}`, `Discharge Summary — ${ctx.patientName || 'Patient'}`)}>
              📄 Word
            </button>
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
