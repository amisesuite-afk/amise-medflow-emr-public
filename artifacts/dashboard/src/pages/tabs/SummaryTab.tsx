import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import CollapsibleCard from '@/components/CollapsibleCard';
import { AMISE_LOGO_SVG } from './lib/docTemplate';
import { saveBlobAsPDF } from './lib/pdfExport';

// ── helpers ────────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const SOAP_MAIN_HEADERS = new Set(['SUBJECTIVE', 'OBJECTIVE', 'ASSESSMENT', 'PLAN']);
const SOAP_SUB_HEADERS = new Set([
  'Chief Complaint', 'History of Present Illness', 'Past Medical History',
  'Medications', 'Social History', 'Physical Examination', 'Laboratory/Diagnostic Results',
  'Laboratory/Diagnostics:', 'Primary Diagnosis', 'Differentials Considered',
  'Treatment Plan', 'Patient Education', 'Follow-up',
]);

function soapTextToHtml(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const t = line.trim();
    if (!t) { out.push('<div class="s-gap"></div>'); continue; }
    const safe = escHtml(t);

    if (SOAP_MAIN_HEADERS.has(t)) {
      if (inSection) out.push('</div>');
      out.push(`<div class="s-section"><div class="s-main-hdr">${safe}</div>`);
      inSection = true;
      continue;
    }
    if (inSection && SOAP_SUB_HEADERS.has(t)) {
      out.push(`<div class="s-sub-hdr">${safe}</div>`);
      continue;
    }
    if (/^[•\-\*]\s/.test(t)) {
      out.push(`<div class="s-bullet">${safe.replace(/^[•\-\*]\s*/, '')}</div>`);
      continue;
    }
    out.push(`<div class="s-line">${safe}</div>`);
  }
  if (inSection) out.push('</div>');
  return out.join('\n');
}

const SITE_INFO: Record<string, { name: string; address: string; phone: string }> = {
  rodney_bay: { name: 'Rodney Bay Office', address: 'Providence Building, First Floor, Apt#3, Rodney Bay, Saint Lucia', phone: '1 (758) 720 7111' },
  tapion:     { name: 'Tapion Hospital',   address: 'Tapion, Saint Lucia', phone: '1 (758) 459 2227 / 1 (758) 284 0557' },
};

const APPT_LABELS: Record<string, string> = {
  new_consult:   'New Consultation',
  follow_up:     'Follow-up Consultation',
  post_op:       'Post-operative Review',
  ercp_workup:   'ERCP Work-up',
  ercp:          'ERCP Procedure',
  breast:        'Breast Clinic',
  telephone:     'Telephone Consultation',
  diabetic_foot: 'Diabetic Foot Clinic',
};

const LOGO_SVG = AMISE_LOGO_SVG;

interface PrintMeta {
  patientName: string;
  patientId: string | null;
  age: string;
  dob: string;
  sex: string;
  phone: string;
  site: string;
  appointmentType: string;
}

function buildPrintHtml(text: string, meta: PrintMeta): string {
  const site = SITE_INFO[meta.site] ?? SITE_INFO.rodney_bay;
  const consultType = APPT_LABELS[meta.appointmentType] ?? 'Clinic Consultation';

  const now = new Date();
  const ectOptions: Intl.DateTimeFormatOptions = { timeZone: 'America/St_Lucia' };
  const consultDate = now.toLocaleString('en-GB', {
    ...ectOptions, day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  const generatedDate = now.toLocaleDateString('en-GB', {
    ...ectOptions, day: '2-digit', month: 'short', year: 'numeric',
  }).replace(/ /g, '.');

  const pidDisplay = meta.patientId
    ? `P${meta.patientId.replace(/-/g, '').slice(0, 16).toUpperCase()}`
    : '—';

  const sexLabel = meta.sex && meta.sex !== 'unknown'
    ? meta.sex.charAt(0).toUpperCase() + meta.sex.slice(1) : '';
  const ageLine = [
    meta.age ? `${meta.age} Years` : '',
    meta.dob ? `(${meta.dob})` : '',
    sexLabel,
  ].filter(Boolean).join(' ');

  const bodyHtml = soapTextToHtml(text);

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<title>Clinical Summary — ${escHtml(meta.patientName || 'Patient')}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1a1a;line-height:1.65;background:#fff;max-width:175mm;margin:0 auto;padding:20px 24px}
  /* ── Header ── */
  .hdr{display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;border-bottom:2.5px solid #1a3a5c;margin-bottom:16px}
  .hdr-brand{font-size:13px;font-weight:700;color:#1a3a5c;letter-spacing:.3px}
  .hdr-addr{font-size:11px;color:#555;line-height:1.7;margin-top:3px}
  /* ── Patient strip ── */
  .pt-strip{background:#f4f6f9;border:1px solid #d8dde6;border-radius:6px;padding:12px 16px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .pt-label{font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:700;margin-bottom:4px}
  .pt-val{font-size:12.5px;color:#1a1a1a;font-weight:700}
  .pt-sub{font-size:11px;color:#555;font-weight:400;margin-top:2px}
  /* ── Document title ── */
  .doc-title{font-size:15px;font-weight:700;text-align:center;color:#1a3a5c;letter-spacing:.5px;margin-bottom:18px;text-transform:uppercase;border-bottom:1px solid #e5e9ef;padding-bottom:8px}
  /* ── SOAP sections ── */
  .s-section{margin-bottom:18px}
  .s-main-hdr{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#1a3a5c;background:#eef1f6;padding:5px 12px;margin-bottom:10px;border-radius:4px}
  .s-sub-hdr{font-weight:700;font-size:12px;color:#333;margin:12px 0 4px}
  .s-line{font-size:12.5px;margin-bottom:4px;color:#222}
  .s-bullet{font-size:12.5px;padding-left:18px;position:relative;margin-bottom:4px;color:#222}
  .s-bullet::before{content:"•";position:absolute;left:5px;color:#1a3a5c}
  .s-gap{height:8px}
  /* ── Signature block ── */
  .sig-block{margin-top:48px;padding-top:14px;border-top:1.5px solid #ccc;display:flex;justify-content:space-between;align-items:flex-end}
  .sig-left{min-width:240px}
  .sig-line{border-bottom:1px solid #333;width:210px;margin-bottom:5px;height:26px}
  .sig-name{font-size:12.5px;font-weight:700;color:#1a1a1a}
  .sig-title{font-size:11px;color:#555;margin-top:2px}
  .sig-lic{font-size:10px;color:#888;margin-top:3px}
  .sig-right{font-size:10px;color:#aaa;text-align:right}
  @page{margin:16mm 18mm;size:A4}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;max-width:100%;padding:0}}
</style>
</head><body>

<!-- Letterhead -->
<div class="hdr">
  <div>
    <div class="hdr-brand">${escHtml(site.name)}</div>
    <div class="hdr-addr">${escHtml(site.address)}<br>Tel: ${escHtml(site.phone)} &nbsp;·&nbsp; amisesuite@gmail.com</div>
  </div>
  <div>${LOGO_SVG}</div>
</div>

<!-- Patient strip -->
<div class="pt-strip">
  <div>
    <div class="pt-label">Patient</div>
    <div class="pt-val">${escHtml(meta.patientName || '—')}</div>
    <div class="pt-sub">${escHtml(ageLine || '')}${meta.phone ? ' &nbsp;·&nbsp; ' + escHtml(meta.phone) : ''}</div>
    ${meta.patientId ? `<div class="pt-sub" style="margin-top:2px">ID: ${escHtml(pidDisplay)}</div>` : ''}
  </div>
  <div>
    <div class="pt-label">Consultation</div>
    <div class="pt-val">${escHtml(consultType)}</div>
    <div class="pt-sub">Dr. Dawit D Kabiye &nbsp;·&nbsp; ${escHtml(site.name)}</div>
    <div class="pt-sub">${escHtml(consultDate)}</div>
  </div>
</div>

<div class="doc-title">Clinical Summary</div>

${bodyHtml}

<!-- Signature — bottom left -->
<div class="sig-block">
  <div class="sig-left">
    <div class="sig-line"></div>
    <div class="sig-name">Dr. Dawit D Kabiye</div>
    <div class="sig-title">MD, DM &nbsp;·&nbsp; General &amp; Endoscopic Surgery</div>
    <div class="sig-lic">Licence #: ............&nbsp;&nbsp;&nbsp;&nbsp; Date: ${generatedDate}</div>
  </div>
  <div class="sig-right">Generated ${generatedDate}</div>
</div>

</body></html>`;
}

// Use VITE_API_URL when deployed (e.g. Render); fall back to same-origin proxy in dev
const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  return `${base}${path}`;
}

// ── Direct-export template builders ──────────────────────────────────────────

type DirectCtx = ReturnType<typeof useAppContext>;

function sharedHead(title: string): string {
  return `<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1a1a;line-height:1.65;background:#fff;max-width:175mm;margin:0 auto;padding:20px 24px}
  .hdr{display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;border-bottom:2.5px solid #1a3a5c;margin-bottom:16px}
  .hdr-office{font-size:13px;font-weight:700;color:#1a3a5c;letter-spacing:.3px}
  .hdr-sub{font-size:11px;color:#555;line-height:1.7;margin-top:3px}
  .title{font-size:15px;font-weight:700;text-align:center;color:#1a3a5c;letter-spacing:.5px;margin:0 0 18px;text-transform:uppercase;border-bottom:1px solid #e5e9ef;padding-bottom:8px}
  .pt-row{background:#f4f6f9;border:1px solid #d8dde6;border-radius:6px;padding:12px 16px;margin-bottom:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .pt-lbl{font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:#888;font-weight:700;margin-bottom:4px}
  .pt-val{font-size:12.5px;color:#1a1a1a;font-weight:700}
  .pt-sub{font-size:11px;color:#555;margin-top:2px}
  .section{margin:16px 0}
  .sec-hdr{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#1a3a5c;background:#eef1f6;padding:5px 12px;border-radius:4px;margin-bottom:10px}
  .sec-body{font-size:12.5px;padding:0 4px;line-height:1.65}
  .item{margin-bottom:5px;padding-left:16px;position:relative}
  .item::before{content:"•";position:absolute;left:4px;color:#1a3a5c}
  .sig{margin-top:48px;padding-top:14px;border-top:1.5px solid #ccc;display:flex;justify-content:space-between;align-items:flex-end}
  .sig-left{min-width:240px}
  .sig-line{border-bottom:1px solid #333;width:210px;height:26px;margin-bottom:5px}
  .sig-name{font-weight:700;font-size:12.5px;color:#1a1a1a}
  .sig-title{font-size:11px;color:#555;margin-top:2px}
  .sig-lic{font-size:10px;color:#888;margin-top:3px}
  .sig-right{font-size:10px;color:#aaa;text-align:right}
  @page{margin:16mm 18mm;size:A4}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;max-width:100%;padding:0}}
</style>
<title>${escHtml(title)}</title>`;
}

function sharedHeader(site: { name: string; address: string; phone: string }, consultDate: string): string {
  return `<div class="hdr">
  <div>
    <div class="hdr-office">${escHtml(site.name)}</div>
    <div class="hdr-sub">${escHtml(site.address)}</div>
    <div class="hdr-sub">Tel: ${escHtml(site.phone)} &nbsp;·&nbsp; amisesuite@gmail.com</div>
    <div class="hdr-sub" style="margin-top:2px;color:#1a3a5c">${escHtml(consultDate)}</div>
  </div>
  <div>${LOGO_SVG}</div>
</div>`;
}

function sharedPatient(ctx: DirectCtx): string {
  const ageLine = [ctx.age ? `${ctx.age} yrs` : '', ctx.dob ? `(${ctx.dob})` : '', ctx.sex !== 'unknown' ? ctx.sex : ''].filter(Boolean).join(' · ');
  return `<div class="pt-row">
  <div><div class="pt-lbl">Patient</div>
    <div>${escHtml(ctx.patientName || '—')}</div>
    <div>${escHtml(ageLine || '—')}</div>
    <div>${escHtml(ctx.phone || '—')}</div>
    ${ctx.address ? `<div>${escHtml(ctx.address)}</div>` : ''}
  </div>
  <div><div class="pt-lbl">Referring details</div>
    <div>Dr. Dawit D Kabiye, MD, DM</div>
    <div>General &amp; Endoscopic Surgery</div>
    ${ctx.referredBy ? `<div>Referred by: ${escHtml(ctx.referredBy)}</div>` : ''}
  </div>
</div>`;
}

function items(arr: string[]): string {
  return arr.map(a => `<div class="item">${escHtml(a)}</div>`).join('');
}

function buildDirectSummaryHtml(ctx: DirectCtx, meta: PrintMeta): string {
  const site = SITE_INFO[meta.site] ?? SITE_INFO.rodney_bay;
  const now = new Date();
  const ect = { timeZone: 'America/St_Lucia' };
  const consultDate = now.toLocaleString('en-GB', { ...ect, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

  const vitalsArr = Object.entries({
    'BP': ctx.vitals.systolicBp ? `${ctx.vitals.systolicBp}/${ctx.vitals.diastolicBp} mmHg` : '',
    'HR': ctx.vitals.heartRate ? `${ctx.vitals.heartRate} bpm` : '',
    'Temp': ctx.vitals.temperatureC ? `${ctx.vitals.temperatureC} °C` : '',
    'RR': ctx.vitals.respiratoryRate ? `${ctx.vitals.respiratoryRate}/min` : '',
    'SpO₂': ctx.vitals.spo2 ? `${ctx.vitals.spo2}%` : '',
    'BSL': ctx.vitals.glucoseMmol ? `${ctx.vitals.glucoseMmol} mmol/L` : '',
  }).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);

  const examLines = [
    ctx.examGeneral && `General: ${ctx.examGeneral}`,
    ctx.examCardio && `Cardiovascular: ${ctx.examCardio}`,
    ctx.examResp && `Respiratory: ${ctx.examResp}`,
    ctx.examAbdomen && `Abdomen: ${ctx.examAbdomen}`,
    ctx.examNeuro && `Neurological: ${ctx.examNeuro}`,
    ctx.examExtremities && `Extremities: ${ctx.examExtremities}`,
    ctx.examBreast && `Breast/Local: ${ctx.examBreast}`,
    ctx.examWound && `Wound: ${ctx.examWound}`,
  ].filter(Boolean) as string[];

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
${sharedHead(`Clinical Note — ${ctx.patientName || 'Patient'}`)}
</head><body>
${sharedHeader(site, consultDate)}
${sharedPatient(ctx)}
<div class="title">CLINICAL NOTE</div>

${ctx.symptoms.length || ctx.freeText ? `<div class="section">
<div class="sec-hdr">Presenting Complaint</div>
<div class="sec-body">
${items(ctx.symptoms)}
${ctx.freeText ? `<div style="margin-top:4px">${escHtml(ctx.freeText)}</div>` : ''}
${ctx.durationDays ? `<div>Duration: ${escHtml(ctx.durationDays)} days</div>` : ''}
${ctx.painScore ? `<div>Pain score: ${escHtml(ctx.painScore)}/10</div>` : ''}
</div></div>` : ''}

${vitalsArr.length ? `<div class="section">
<div class="sec-hdr">Vital Signs</div>
<div class="sec-body">${vitalsArr.map(v => `<span style="margin-right:18px">${escHtml(v)}</span>`).join('')}</div>
</div>` : ''}

${ctx.comorbidities.length || ctx.pmhNotes ? `<div class="section">
<div class="sec-hdr">Past Medical History</div>
<div class="sec-body">
${items(ctx.comorbidities)}
${ctx.pmhNotes ? `<div>${escHtml(ctx.pmhNotes)}</div>` : ''}
</div></div>` : ''}

${ctx.surgicalHistory.length || ctx.surgicalNotes ? `<div class="section">
<div class="sec-hdr">Surgical History</div>
<div class="sec-body">${items(ctx.surgicalHistory)}${ctx.surgicalNotes ? `<div>${escHtml(ctx.surgicalNotes)}</div>` : ''}</div>
</div>` : ''}

${ctx.medications.length || ctx.medicationsText ? `<div class="section">
<div class="sec-hdr">Medications</div>
<div class="sec-body">${items(ctx.medications)}${ctx.medicationsText ? `<div>${escHtml(ctx.medicationsText)}</div>` : ''}</div>
</div>` : ''}

${ctx.allergies ? `<div class="section">
<div class="sec-hdr">Allergies</div>
<div class="sec-body">${escHtml(ctx.allergies)}</div>
</div>` : ''}

${examLines.length ? `<div class="section">
<div class="sec-hdr">Physical Examination</div>
<div class="sec-body">${examLines.map(l => `<div class="item">${escHtml(l)}</div>`).join('')}</div>
</div>` : ''}

${ctx.orderedInvestigations.length ? `<div class="section">
<div class="sec-hdr">Investigations Ordered</div>
<div class="sec-body">${items(ctx.orderedInvestigations)}</div>
</div>` : ''}

${ctx.assessment || ctx.icdCodes.length || ctx.differentials ? `<div class="section">
<div class="sec-hdr">Assessment</div>
<div class="sec-body">
${ctx.icdCodes.length ? `<div style="font-weight:700;font-size:11px;color:#0B2545;margin-bottom:4px">Working Diagnosis: ${escHtml(ctx.icdCodes.join('  ·  '))}</div>` : ''}
${ctx.differentials ? `<div style="margin-bottom:6px"><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#475569">Differential Diagnoses</span><br>${escHtml(ctx.differentials).replace(/\n/g, '<br>')}</div>` : ''}
${ctx.assessment ? `<div style="white-space:pre-wrap;line-height:1.7">${escHtml(ctx.assessment).replace(/\n/g, '<br>')}</div>` : ''}
</div></div>` : ''}

${ctx.plan ? `<div class="section">
<div class="sec-hdr">Management Plan</div>
<div class="sec-body" style="font-family:monospace;font-size:11px;line-height:1.75;white-space:pre-wrap">${escHtml(ctx.plan)}</div>
</div>` : ''}

<div class="sig">
<div class="sig-left">
  <div class="sig-line"></div>
  <div class="sig-name">Dr. Dawit D Kabiye</div>
  <div class="sig-title">MD, DM &nbsp;·&nbsp; General &amp; Endoscopic Surgery</div>
  <div class="sig-lic">Licence #: ............&nbsp;&nbsp;&nbsp;&nbsp; Date: ..................</div>
</div>
<div class="sig-right">Generated ${consultDate}</div>
</div>
</body></html>`;
}

function buildReferralHtml(ctx: DirectCtx, meta: PrintMeta, referTo: string, referNotes: string): string {
  const site = SITE_INFO[meta.site] ?? SITE_INFO.rodney_bay;
  const now = new Date();
  const ect = { timeZone: 'America/St_Lucia' };
  const consultDate = now.toLocaleString('en-GB', { ...ect, day: 'numeric', month: 'long', year: 'numeric' });

  const ageLine = [ctx.age ? `${ctx.age} yrs` : '', ctx.sex !== 'unknown' ? ctx.sex : ''].filter(Boolean).join(', ');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
${sharedHead(`Referral Letter — ${ctx.patientName || 'Patient'}`)}
</head><body>
${sharedHeader(site, consultDate)}
<div class="title">REFERRAL LETTER</div>

<div style="font-size:11px;margin-bottom:10px">
  <div>Dear Colleague${referTo ? ` / ${escHtml(referTo)}` : ''},</div>
  <br>
  <div>I am writing to refer <strong>${escHtml(ctx.patientName || 'this patient')}</strong>${ageLine ? `, ${escHtml(ageLine)},` : ''} who attended ${escHtml(site.name)} on ${escHtml(consultDate)}.</div>
</div>

${ctx.symptoms.length || ctx.freeText ? `<div class="section">
<div class="sec-hdr">Presenting History</div>
<div class="sec-body">
${ctx.symptoms.length ? `<div>Presenting with: ${escHtml(ctx.symptoms.join(', '))}</div>` : ''}
${ctx.freeText ? `<div style="margin-top:4px">${escHtml(ctx.freeText)}</div>` : ''}
${ctx.durationDays ? `<div>Duration: ${escHtml(ctx.durationDays)} days</div>` : ''}
</div></div>` : ''}

${ctx.comorbidities.length || ctx.pmhNotes ? `<div class="section">
<div class="sec-hdr">Past Medical History</div>
<div class="sec-body">${items(ctx.comorbidities)}${ctx.pmhNotes ? `<div>${escHtml(ctx.pmhNotes)}</div>` : ''}</div>
</div>` : ''}

${ctx.medications.length || ctx.medicationsText ? `<div class="section">
<div class="sec-hdr">Current Medications</div>
<div class="sec-body">${items(ctx.medications)}${ctx.medicationsText ? `<div>${escHtml(ctx.medicationsText)}</div>` : ''}</div>
</div>` : ''}

${ctx.allergies ? `<div class="section">
<div class="sec-hdr">Allergies</div>
<div class="sec-body">${escHtml(ctx.allergies)}</div>
</div>` : ''}

${ctx.assessment ? `<div class="section">
<div class="sec-hdr">Clinical Assessment</div>
<div class="sec-body">${escHtml(ctx.assessment).replace(/\n/g, '<br>')}</div>
</div>` : ''}

${referNotes ? `<div class="section">
<div class="sec-hdr">Reason for Referral</div>
<div class="sec-body">${escHtml(referNotes).replace(/\n/g, '<br>')}</div>
</div>` : ''}

<div style="font-size:11px;margin-top:14px">
  <div>I would be grateful for your review and further management of this patient.</div>
  <br>
  <div>Please do not hesitate to contact our office should you require any further information.</div>
  <br>
  <div>Kind regards,</div>
</div>

<div class="sig">
<div class="sig-left">
  <div class="sig-line"></div>
  <div class="sig-name">Dr. Dawit D Kabiye</div>
  <div class="sig-title">MD, DM &nbsp;·&nbsp; General &amp; Endoscopic Surgery</div>
  <div class="sig-lic">${escHtml(site.name)} &nbsp;·&nbsp; ${escHtml(site.phone)}</div>
  <div class="sig-lic">Licence #: ............&nbsp;&nbsp;&nbsp;&nbsp; Date: ..................</div>
</div>
<div class="sig-right"></div>
</div>
</body></html>`;
}

function buildDischargeHtml(ctx: DirectCtx, meta: PrintMeta, dischargeNotes: string, followUp: string, warningSign: string): string {
  const site = SITE_INFO[meta.site] ?? SITE_INFO.rodney_bay;
  const now = new Date();
  const ect = { timeZone: 'America/St_Lucia' };
  const consultDate = now.toLocaleString('en-GB', { ...ect, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

  const ageLine = [ctx.age ? `${ctx.age} yrs` : '', ctx.sex !== 'unknown' ? ctx.sex : ''].filter(Boolean).join(', ');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
${sharedHead(`Discharge Note — ${ctx.patientName || 'Patient'}`)}
</head><body>
${sharedHeader(site, consultDate)}
${sharedPatient(ctx)}
<div class="title">DISCHARGE SUMMARY / CLINIC NOTE</div>

<div class="section">
<div class="sec-hdr">Patient</div>
<div class="sec-body">${escHtml(ctx.patientName || '—')}${ageLine ? `, ${escHtml(ageLine)}` : ''}</div>
</div>

${ctx.assessment || ctx.icdCodes.length ? `<div class="section">
<div class="sec-hdr">Diagnosis</div>
<div class="sec-body">
${ctx.assessment ? `<div>${escHtml(ctx.assessment).replace(/\n/g, '<br>')}</div>` : ''}
${ctx.icdCodes.length ? `<div style="margin-top:4px;font-size:10px;color:#555">ICD-10: ${escHtml(ctx.icdCodes.join(', '))}</div>` : ''}
</div></div>` : ''}

${ctx.procedures || ctx.plan ? `<div class="section">
<div class="sec-hdr">Procedures / Treatment</div>
<div class="sec-body">
${ctx.procedures ? `<div>${escHtml(ctx.procedures).replace(/\n/g, '<br>')}</div>` : ''}
${ctx.plan ? `<div style="margin-top:4px">${escHtml(ctx.plan).replace(/\n/g, '<br>')}</div>` : ''}
</div></div>` : ''}

${ctx.medications.length || ctx.medicationsText ? `<div class="section">
<div class="sec-hdr">Medications on Discharge</div>
<div class="sec-body">${items(ctx.medications)}${ctx.medicationsText ? `<div>${escHtml(ctx.medicationsText)}</div>` : ''}</div>
</div>` : ''}

${dischargeNotes ? `<div class="section">
<div class="sec-hdr">Discharge Instructions</div>
<div class="sec-body">${escHtml(dischargeNotes).replace(/\n/g, '<br>')}</div>
</div>` : ''}

${warningSign ? `<div class="section">
<div class="sec-hdr">Warning Signs — Return to Emergency If:</div>
<div class="sec-body" style="color:#b91c1c">${escHtml(warningSign).replace(/\n/g, '<br>')}</div>
</div>` : ''}

${followUp ? `<div class="section">
<div class="sec-hdr">Follow-up</div>
<div class="sec-body">${escHtml(followUp).replace(/\n/g, '<br>')}</div>
</div>` : ''}

<div class="sig">
<div class="sig-left">
  <div class="sig-line"></div>
  <div class="sig-name">Dr. Dawit D Kabiye</div>
  <div class="sig-title">MD, DM &nbsp;·&nbsp; General &amp; Endoscopic Surgery</div>
  <div class="sig-lic">Licence #: ............&nbsp;&nbsp;&nbsp;&nbsp; Date: ..................</div>
</div>
<div class="sig-right">Issued: ${consultDate}</div>
</div>
</body></html>`;
}

function printHtml(html: string) {
  const win = window.open('', '_blank');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    // Small delay so browser can lay out content before print dialog
    setTimeout(() => { try { win.print(); } catch { /* ignore */ } }, 450);
  } else {
    // Popup blocked — fall back to download
    downloadHtml(html, 'document.html');
  }
}

function downloadHtml(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const url = URL.createObjectURL(blob);
  if (isIOS) { window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 30_000); return; }
  const a = window.document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  window.document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

// ── Direct export panel ───────────────────────────────────────────────────────

const DISPOSITION_OPTIONS = [
  { id: 'home',       label: 'Home' },
  { id: 'ward',       label: 'Ward' },
  { id: 'icu',        label: 'ICU / HDU' },
  { id: 'theatre',    label: 'Theatre' },
  { id: 'referring',  label: 'Referring hospital' },
] as const;

function DirectExportPanel() {
  const ctx = useAppContext();
  const [docType, setDocType] = useState<'clinical' | 'referral' | 'discharge'>('clinical');
  const [referTo, setReferTo] = useState('');
  const [referNotes, setReferNotes] = useState('');
  const [dischargeNotes, setDischargeNotes] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [warningSign, setWarningSign] = useState('');
  const [disposition, setDisposition] = useState('');
  const [aiFilling, setAiFilling] = useState(false);
  const [aiError, setAiError] = useState('');
  const [showPreview, setShowPreview] = useState(true);

  async function handleAiFill() {
    setAiFilling(true);
    setAiError('');
    try {
      const apiOrigin = getApiOrigin();
      const url = apiOrigin ? `${apiOrigin}/api/ai/fill-document` : '/api/ai/fill-document';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({
          docType,
          patientName: ctx.patientName,
          age: ctx.age,
          sex: ctx.sex,
          symptoms: ctx.symptoms,
          assessment: ctx.assessment,
          plan: ctx.plan,
          procedures: ctx.procedures,
          medications: ctx.medications,
          comorbidities: ctx.comorbidities,
          investigationResults: ctx.investigationResults,
          referredBy: ctx.referredBy,
          disposition,
        }),
      });
      const data = await r.json() as {
        instructions?: string; warningSigns?: string; followUp?: string;
        referNotes?: string; error?: string;
      };
      if (!r.ok) { setAiError(data.error ?? 'AI fill failed'); return; }
      if (docType === 'discharge') {
        if (data.instructions) setDischargeNotes(data.instructions);
        if (data.warningSigns) setWarningSign(data.warningSigns);
        if (data.followUp) setFollowUp(data.followUp);
      } else if (docType === 'referral') {
        if (data.referNotes) setReferNotes(data.referNotes);
      }
    } catch {
      setAiError('Network error — please try again.');
    } finally {
      setAiFilling(false);
    }
  }

  function makeMeta(): PrintMeta {
    return {
      patientName: ctx.patientName, patientId: ctx.patientId,
      age: ctx.age, dob: ctx.dob, sex: ctx.sex, phone: ctx.phone,
      site: ctx.currentSite, appointmentType: ctx.triageResult.appointmentType,
    };
  }

  function getHtml(): string {
    const meta = makeMeta();
    if (docType === 'referral') return buildReferralHtml(ctx, meta, referTo, referNotes);
    if (docType === 'discharge') return buildDischargeHtml(ctx, meta, dischargeNotes, followUp, warningSign);
    return buildDirectSummaryHtml(ctx, meta);
  }

  function fileSlug(): { prefix: string; slug: string; date: string } {
    const slug = (ctx.patientName || 'patient').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const date = new Date().toISOString().slice(0, 10);
    const prefix = docType === 'referral' ? 'referral' : docType === 'discharge' ? 'discharge' : 'clinical-note';
    return { prefix, slug, date };
  }

  function filename(): string {
    const { prefix, slug, date } = fileSlug();
    return `${prefix}-${slug}-${date}.html`;
  }

  function pdfFilename(): string {
    const { prefix, slug, date } = fileSlug();
    return `${prefix}-${slug}-${date}.pdf`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Template selector */}
      <div style={{ display: 'flex', gap: 8 }}>
        {([['clinical', 'Clinical Note'], ['referral', 'Referral Letter'], ['discharge', 'Discharge Note']] as const).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setDocType(id)} style={{
            padding: '5px 14px', borderRadius: 8, fontSize: 12,
            border: docType === id ? '2px solid #1a5276' : '1px solid #d1d5db',
            background: docType === id ? '#1a5276' : '#f9fafb',
            color: docType === id ? '#fff' : '#374151', cursor: 'pointer', fontWeight: docType === id ? 700 : 400,
          }}>{label}</button>
        ))}
      </div>

      {/* Referral extras */}
      {docType === 'referral' && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => void handleAiFill()} disabled={aiFilling}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 7, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 12, fontWeight: 700, cursor: aiFilling ? 'wait' : 'pointer', opacity: aiFilling ? 0.7 : 1 }}>
              {aiFilling ? '⏳ Filling…' : '✨ AI Fill reason'}
            </button>
          </div>
          {aiError && <div style={{ fontSize: 11, color: '#dc2626' }}>{aiError}</div>}
          <div className="fld">
            <label style={{ fontSize: 12 }}>Refer to (name / department)</label>
            <input type="text" value={referTo} onChange={e => setReferTo(e.target.value)}
              placeholder="e.g. Dr Smith, Gastroenterology, OKEU" style={{ fontSize: 12 }} />
          </div>
          <div className="fld">
            <label style={{ fontSize: 12 }}>Reason for referral / clinical question</label>
            <textarea value={referNotes} onChange={e => setReferNotes(e.target.value)}
              placeholder="e.g. For further evaluation and management of suspected…" style={{ fontSize: 12, minHeight: 70 }} />
          </div>
        </div>
      )}

      {/* Discharge extras */}
      {docType === 'discharge' && (
        <div style={{ display: 'grid', gap: 8 }}>
          {/* Disposition + AI fill row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Disposition</span>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {DISPOSITION_OPTIONS.map(d => (
                <button key={d.id} type="button" onClick={() => setDisposition(d.id === disposition ? '' : d.id)} style={{
                  padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: disposition === d.id ? '1.5px solid #0d9488' : '1px solid #d1d5db',
                  background: disposition === d.id ? '#0d9488' : '#f9fafb',
                  color: disposition === d.id ? '#fff' : '#374151',
                }}>{d.label}</button>
              ))}
            </div>
            <button type="button" onClick={() => void handleAiFill()} disabled={aiFilling}
              style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 7, border: 'none', background: '#7c3aed', color: '#fff', fontSize: 12, fontWeight: 700, cursor: aiFilling ? 'wait' : 'pointer', opacity: aiFilling ? 0.7 : 1 }}>
              {aiFilling ? '⏳ Filling…' : '✨ AI Fill'}
            </button>
          </div>
          {aiError && <div style={{ fontSize: 11, color: '#dc2626' }}>{aiError}</div>}
          <div className="fld">
            <label style={{ fontSize: 12 }}>Discharge instructions</label>
            <textarea value={dischargeNotes} onChange={e => setDischargeNotes(e.target.value)}
              placeholder="Diet, activity restrictions, wound care, medications, dressing changes…" style={{ fontSize: 12, minHeight: 70 }} />
          </div>
          <div className="fld">
            <label style={{ fontSize: 12 }}>Warning signs — return if…</label>
            <textarea value={warningSign} onChange={e => setWarningSign(e.target.value)}
              placeholder="Fever >38.5°C, increasing pain, redness/swelling, inability to tolerate fluids…" style={{ fontSize: 12, minHeight: 50 }} />
          </div>
          <div className="fld">
            <label style={{ fontSize: 12 }}>Follow-up plan</label>
            <textarea value={followUp} onChange={e => setFollowUp(e.target.value)}
              placeholder="e.g. Review in 2 weeks at Rodney Bay. Histopathology results to be discussed at follow-up." style={{ fontSize: 12, minHeight: 50 }} />
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button"
          onClick={() => printHtml(getHtml())}
          style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #1a5276', background: '#1a5276', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          🖨 Print
        </button>
        <button type="button"
          onClick={() => void saveBlobAsPDF(getHtml(), pdfFilename())}
          style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #0b8278', background: '#0b8278', color: '#fff', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          ↓ PDF
        </button>
        <button type="button"
          onClick={() => downloadHtml(getHtml(), filename())}
          style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid #374151', background: '#f9fafb', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
          ↓ HTML
        </button>
        <button type="button"
          onClick={() => setShowPreview(p => !p)}
          style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 6, border: '1.5px solid #0d9488', background: showPreview ? '#f0fdfa' : '#fff', color: '#0d9488', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
          {showPreview ? '▲ Hide Preview' : '👁 Preview'}
        </button>
      </div>

      <div style={{ fontSize: 11, color: '#9ca3af' }}>
        Generated directly from entered data — no AI required. Review before printing.
      </div>

      {/* ── Inline document preview ── */}
      {showPreview && (
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(0,0,0,0.07)' }}>
          <div style={{
            padding: '7px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Document Preview
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Review before printing · updates live</span>
          </div>
          <div style={{ background: '#e5e7eb', padding: '16px 0', overflowY: 'auto', maxHeight: 740 }}>
            <iframe
              srcDoc={getHtml()}
              title="Document preview"
              style={{ display: 'block', width: '96%', maxWidth: 720, margin: '0 auto', minHeight: 640, border: 'none', background: '#fff', borderRadius: 4, boxShadow: '0 1px 6px rgba(0,0,0,0.12)' }}
              sandbox="allow-same-origin"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function SummaryTab() {
  const ctx = useAppContext();
  const [document, setDocument] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Auto-generate when navigating to this tab if the consultation has enough content
  useEffect(() => {
    const hasContent = ctx.symptoms.length > 0 || !!ctx.hpiNotes.trim() || !!ctx.assessment.trim();
    if (hasContent && !document && !loading) {
      void generate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    setError('');
    setLoading(true);
    try {
      const body = {
        patient: {
          name: ctx.patientName,
          age: ctx.age,
          sex: ctx.sex,
          dob: ctx.dob,
          phone: ctx.phone,
        },
        complaint: {
          symptoms: ctx.symptoms,
          symptomDetails: ctx.symptomDetails,
          hpiNotes: ctx.hpiNotes,
          duration: ctx.durationDays,
          painScore: ctx.painScore,
          freeText: ctx.freeText,
          isPostOp: ctx.isPostOp,
          postOpDays: ctx.postOpDays,
          pregnancyPossible: ctx.pregnancyPossible,
        },
        vitals: ctx.vitals as Record<string, string>,
        history: {
          pmh: ctx.comorbidities,
          pmhNotes: ctx.pmhNotes,
          surgicalHistory: ctx.surgicalHistory,
          surgicalNotes: ctx.surgicalNotes,
          medications: ctx.medications,
          medicationsText: ctx.medicationsText,
          allergies: ctx.allergies,
          familyHistory: ctx.familyHistory,
          familyHistoryNotes: ctx.familyHistoryNotes,
          toxicHabits: ctx.toxicHabits,
          occupation: ctx.occupation,
        },
        rosFindings: ctx.rosFindings,
        examination: {
          ...ctx.examNotes,
          General:       ctx.examGeneral      || ctx.examNotes['General']      || '',
          Cardiovascular: ctx.examCardio      || ctx.examNotes['Cardiovascular'] || '',
          Respiratory:   ctx.examResp         || ctx.examNotes['Respiratory']  || '',
          Abdomen:       ctx.examAbdomen      || ctx.examNotes['Abdomen']      || '',
          Neurological:  ctx.examNeuro        || ctx.examNotes['Neurological'] || '',
          Extremities:   ctx.examExtremities  || ctx.examNotes['Extremities']  || '',
          Breast:        ctx.examBreast       || ctx.examNotes['Breast']       || '',
          Wound:         ctx.examWound        || ctx.examNotes['Wound']        || '',
        },
        investigations: {
          ordered: ctx.orderedInvestigations,
          results: ctx.investigationResults,
          radiology: ctx.radiologyRequests,
        },
        assessment: ctx.assessment,
        differentials: ctx.differentials,
        icdCodes: ctx.icdCodes,
        cptCodes: ctx.cptCodes,
        plan: ctx.plan,
        followUpNotes: ctx.followUpNotes,
        referralNotes: ctx.referralNotes,
        triageAcuity: ctx.triageResult.acuity,
        triageScore: ctx.triageResult.score,
        date: new Date().toLocaleDateString('en-GB', {
          day: '2-digit', month: 'long', year: 'numeric',
        }),
      };

      let summaryText: string | null = null;

      const res = await fetch(apiUrl('/api/summary/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { document: string };
      summaryText = data.document;

      setDocument(summaryText ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function makePrintMeta(): PrintMeta {
    return {
      patientName: ctx.patientName,
      patientId: ctx.patientId,
      age: ctx.age,
      dob: ctx.dob,
      sex: ctx.sex,
      phone: ctx.phone,
      site: ctx.currentSite,
      appointmentType: ctx.triageResult.appointmentType,
    };
  }

  async function copy() {
    if (!document) return;
    await navigator.clipboard.writeText(document);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function printDoc() {
    if (!document) return;
    printHtml(buildPrintHtml(document, makePrintMeta()));
  }

  function downloadPdf() {
    if (!document) return;
    const patientSlug = (ctx.patientName || 'patient').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const dateStr = new Date().toISOString().slice(0, 10);
    void saveBlobAsPDF(buildPrintHtml(document, makePrintMeta()), `clinical-summary-${patientSlug}-${dateStr}.pdf`);
  }

  function downloadDoc() {
    if (!document) return;
    const patientSlug = (ctx.patientName || 'patient').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `clinical-summary-${patientSlug}-${dateStr}.html`;

    const html = buildPrintHtml(document, makePrintMeta());
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });

    // Web Share API — works on iOS Safari 15+ and mobile Chrome; preferred on mobile
    if ('share' in navigator && 'canShare' in navigator) {
      const file = new File([blob], filename, { type: 'text/html' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((navigator as any).canShare({ files: [file] })) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        void (navigator as any).share({ files: [file], title: `Clinical Summary — ${ctx.patientName || 'Patient'}` });
        return;
      }
    }

    // iOS Safari: blob <a download> silently yields 0-byte files — open in new tab instead
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const url = URL.createObjectURL(blob);
    if (isIOS) {
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      return;
    }

    // Desktop: standard anchor-click download
    const a = window.document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    window.document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  const hasData = ctx.symptoms.length > 0 || ctx.patientName.trim() || ctx.freeText.trim();

  return (
    <div className="summary-tab">

      {/* ── Print / Export — always visible compact bar ── */}
      <DirectExportPanel />

      {/* ── AI Summary — secondary, collapsed by default ── */}
      <CollapsibleCard title="AI Clinical Summary (optional)" defaultOpen={false}>
        {/* Sub-header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Claude drafts a structured SOAP note from all entered data — review before forwarding.
          </div>
          <div className="summary-actions">
            {document && (
              <>
                <button className="summary-btn summary-btn--ghost" onClick={() => void copy()}>
                  {copied ? '✓ Copied' : '⎘ Copy'}
                </button>
                <button className="summary-btn summary-btn--ghost" onClick={downloadPdf}>
                  ↓ PDF
                </button>
                <button className="summary-btn summary-btn--ghost" onClick={printDoc}>
                  🖨 Print
                </button>
                <button className="summary-btn summary-btn--ghost" onClick={() => setDocument('')}>
                  × Clear
                </button>
              </>
            )}
            <button
              className="summary-btn summary-btn--primary"
              onClick={() => void generate()}
              disabled={loading || !hasData}
              title={!hasData ? 'Enter at least a patient name or symptom first' : ''}
            >
              {loading ? (
                <><span className="summary-spinner" /> Drafting…</>
              ) : document ? (
                '↻ Regenerate'
              ) : (
                '✦ Draft AI summary'
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="summary-error" style={{ marginBottom: 10 }}>
            ⚠ {error}
            {error.includes('not configured') ? (
              <span> — Check that ANTHROPIC_API_KEY is set on the API server.</span>
            ) : null}
          </div>
        )}

        {/* Empty state */}
        {!document && !loading && (
          <div className="summary-checklist" style={{ padding: '10px 0' }}>
            <div className={`summary-check ${ctx.patientName ? 'ok' : ''}`}>
              {ctx.patientName ? '✓' : '○'} Patient name
            </div>
            <div className={`summary-check ${ctx.symptoms.length ? 'ok' : ''}`}>
              {ctx.symptoms.length ? '✓' : '○'} At least one symptom
            </div>
            <div className={`summary-check ${Object.values(ctx.vitals).some(v => v.trim()) ? 'ok' : ''}`}>
              {Object.values(ctx.vitals).some(v => v.trim()) ? '✓' : '○'} Vital signs (optional)
            </div>
          </div>
        )}

        {/* Generated document */}
        {(document || loading) && (
          <div className="summary-doc-wrap">
            <div className="summary-doc-bar">
              <span className="summary-doc-badge">DRAFT — FOR REVIEW</span>
              <span className="summary-doc-note">
                AI-drafted administrative summary. Edit freely before forwarding.
              </span>
            </div>
            <textarea
              ref={textRef}
              className="summary-doc"
              value={document}
              onChange={e => setDocument(e.target.value)}
              placeholder={loading ? 'Composing summary…' : ''}
              readOnly={loading}
              spellCheck
            />
          </div>
        )}
      </CollapsibleCard>

    </div>
  );
}
