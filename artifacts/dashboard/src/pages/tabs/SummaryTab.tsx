import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import type { Section } from '@/context/AppContext';
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
  /* ── Clinical note extras ── */
  .sub-lbl{font-size:9.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;color:#64748b;margin-bottom:4px}
  .lbl{font-weight:700;color:#475569}
  .sec-hdr--warn{background:#fef2f2;color:#b91c1c}
  .dx-field{background:#0B2545;color:#fff;padding:10px 16px;border-radius:6px;margin-bottom:12px}
  .dx-label{font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:#93c5fd;margin-bottom:4px;font-weight:700}
  .dx-name{font-size:14px;font-weight:700;letter-spacing:.2px}
  .diff-block{border-left:3px solid #1a3a5c;padding:8px 14px;margin-bottom:10px;background:#f8fafc;border-radius:0 4px 4px 0}
  .diff-lbl{font-size:9px;text-transform:uppercase;letter-spacing:1px;font-weight:700;color:#64748b;margin-bottom:5px}
  .diff-item{font-size:12px;padding:2px 0;color:#1e293b}
  .med-table{width:100%;border-collapse:collapse;font-size:11px;margin-top:4px}
  .med-table th{background:#1a3a5c;color:#fff;padding:5px 8px;text-align:left;font-weight:700;font-size:9.5px;text-transform:uppercase;letter-spacing:.5px}
  .med-table td{padding:5px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  .med-table tr:nth-child(even) td{background:#f8fafc}
  .med-ind{font-size:10px;color:#64748b;font-style:italic}
  /* ── Plan renderer ── */
  .pl-title{font-size:13px;font-weight:700;color:#0B2545;margin-bottom:4px}
  .pl-icd{font-size:10px;color:#94a3b8;margin-bottom:8px;font-style:italic}
  .pl-section-box{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#b91c1c;border:1px solid #fca5a5;background:#fef2f2;padding:4px 10px;border-radius:4px;margin:10px 0 6px}
  .pl-checkbox{font-size:12px;padding-left:20px;position:relative;margin-bottom:4px;color:#334155;cursor:pointer;user-select:none}
  .pl-checkbox::before{content:"☐";position:absolute;left:3px;font-size:11px;color:#1a3a5c}
  .pl-checked{color:#15803d;font-weight:600}
  .pl-checked::before{content:"■";color:#15803d}
  .pl-warn{font-size:12px;padding-left:18px;position:relative;color:#b91c1c;font-weight:600;margin-bottom:4px}
  .pl-warn::before{content:"⚠";position:absolute;left:1px;font-size:11px}
  .pl-note{font-size:11px;color:#64748b;font-style:italic;padding-left:14px;margin-bottom:3px}
  .pl-bullet{font-size:12px;padding-left:18px;position:relative;margin-bottom:4px;color:#1e293b;cursor:pointer;user-select:none}
  .pl-bullet::before{content:"•";position:absolute;left:5px;color:#1a3a5c}
  .pl-crossed{opacity:0.38;text-decoration:line-through;color:#64748b}
  .pl-crossed::before{content:"✗";color:#94a3b8}
  .pl-num-row{display:flex;gap:10px;margin:8px 0 4px;align-items:flex-start}
  .pl-num{min-width:20px;height:20px;background:#0B2545;color:#fff;border-radius:50%;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
  .pl-num-body{flex:1}
  .pl-num-label{font-size:12.5px;font-weight:700;color:#1a3a5c;margin-bottom:3px}
  .pl-badge{font-size:9px;font-weight:700;letter-spacing:.5px;padding:1px 5px;border-radius:3px;text-transform:uppercase;vertical-align:middle;margin-left:4px}
  .pl-urgent{background:#fee2e2;color:#b91c1c}
  .pl-stat{background:#dcfce7;color:#15803d}
  .pl-routine{background:#dbeafe;color:#1d4ed8}
  .pl-gap{height:5px}
  .pl-line{font-size:12px;color:#334155;margin-bottom:3px}
  .pl-edit-btn{display:inline-block;margin-left:6px;padding:1px 5px;background:none;border:1px solid #1a3a5c33;border-radius:3px;cursor:pointer;font-size:10px;color:#64748b;vertical-align:middle;opacity:0;transition:opacity .15s;line-height:1.4}
  .pl-num-row:hover .pl-edit-btn{opacity:1}
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

function planTextToHtml(plan: string): string {
  const lines = plan.split('\n');
  const out: string[] = [];
  let inNumbered = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t   = raw.trimEnd();
    const ts  = t.trim();

    if (!ts) {
      if (inNumbered) { out.push('</div>'); inNumbered = false; }
      out.push('<div class="pl-gap"></div>');
      continue;
    }

    // First line: plan title (may contain ⚠)
    if (i === 0) {
      out.push(`<div class="pl-title">${escHtml(ts)}</div>`);
      continue;
    }

    // ICD-10 subtitle
    if (ts.startsWith('ICD-10:')) {
      out.push(`<div class="pl-icd">${escHtml(ts)}</div>`);
      continue;
    }

    // ━━━ SECTION BOX ━━━
    if (ts.startsWith('━━━')) {
      if (inNumbered) { out.push('</div>'); inNumbered = false; }
      const label = ts.replace(/━/g, '').trim();
      out.push(`<div class="pl-section-box">${escHtml(label)}</div>`);
      continue;
    }

    // □/■ checkbox items — interactive (click toggles via postMessage to parent)
    if (ts.startsWith('□ ') || ts.startsWith('■ ')) {
      const checked = ts.startsWith('■ ');
      const cls = checked ? 'pl-checkbox pl-checked' : 'pl-checkbox';
      out.push(`<div class="${cls}" data-idx="${i}" onclick="parent.postMessage({type:'PLAN_CB',idx:${i}},'*')">${escHtml(ts.slice(2))}</div>`);
      continue;
    }

    // ⚠ warning line
    if (ts.startsWith('⚠ ') || ts.startsWith('⚠')) {
      out.push(`<div class="pl-warn">${escHtml(ts.replace(/^⚠\s*/, ''))}</div>`);
      continue;
    }

    // → indication / note line
    if (ts.startsWith('→ ')) {
      out.push(`<div class="pl-note">${escHtml(ts.slice(2))}</div>`);
      continue;
    }

    // • bullet or ✗ crossed-out item — both clickable
    if (/^[•\-✗]\s/.test(ts)) {
      const crossed = ts.startsWith('✗ ');
      const cls = crossed ? 'pl-bullet pl-crossed' : 'pl-bullet';
      const inner = escHtml(ts.replace(/^[•\-✗]\s*/, ''))
        .replace(/\[URGENT\]/g, '<span class="pl-badge pl-urgent">URGENT</span>')
        .replace(/\[STAT\]/g,   '<span class="pl-badge pl-stat">STAT</span>')
        .replace(/\[ROUTINE\]/g,'<span class="pl-badge pl-routine">ROUTINE</span>');
      out.push(`<div class="${cls}" data-idx="${i}" onclick="parent.postMessage({type:'PLAN_CB',idx:${i}},'*')">${inner}</div>`);
      continue;
    }

    // Numbered section: "1. Label:" or "1. Label"
    const numMatch = ts.match(/^(\d+)\.\s+(.+)$/);
    if (numMatch) {
      if (inNumbered) out.push('</div>');
      const [, num, label] = numMatch;
      const labelInner = escHtml(label)
        .replace(/\[URGENT\]/g, '<span class="pl-badge pl-urgent">URGENT</span>')
        .replace(/\[STAT\]/g,   '<span class="pl-badge pl-stat">STAT</span>')
        .replace(/\[ROUTINE\]/g,'<span class="pl-badge pl-routine">ROUTINE</span>');
      out.push(`<div class="pl-num-row"><span class="pl-num">${escHtml(num)}</span><div class="pl-num-body"><div class="pl-num-label">${labelInner}<button class="pl-edit-btn" onclick="parent.postMessage({type:'PLAN_SECTION_EDIT',lineStart:${i}},'*')">✎</button></div>`);
      inNumbered = true;
      continue;
    }

    // Plain [BADGE] standalone line
    if (/^\[(URGENT|STAT|ROUTINE)\]/.test(ts)) {
      const inner = escHtml(ts)
        .replace(/\[URGENT\]/g, '<span class="pl-badge pl-urgent">URGENT</span>')
        .replace(/\[STAT\]/g,   '<span class="pl-badge pl-stat">STAT</span>')
        .replace(/\[ROUTINE\]/g,'<span class="pl-badge pl-routine">ROUTINE</span>');
      out.push(`<div class="pl-line">${inner}</div>`);
      continue;
    }

    // Indented lines (2+ spaces or tab) inside numbered section — clickable
    if (inNumbered && /^\s{2,}/.test(raw)) {
      const crossed = ts.startsWith('✗ ');
      const cls = crossed ? 'pl-bullet pl-crossed' : 'pl-bullet';
      const inner = escHtml(ts.replace(/^[•\-✗]\s*/, ''))
        .replace(/\[URGENT\]/g, '<span class="pl-badge pl-urgent">URGENT</span>')
        .replace(/\[STAT\]/g,   '<span class="pl-badge pl-stat">STAT</span>')
        .replace(/\[ROUTINE\]/g,'<span class="pl-badge pl-routine">ROUTINE</span>');
      out.push(`<div class="${cls}" data-idx="${i}" onclick="parent.postMessage({type:'PLAN_CB',idx:${i}},'*')">${inner}</div>`);
      continue;
    }

    // Close numbered block before a plain line
    if (inNumbered) { out.push('</div></div>'); inNumbered = false; }

    // Default plain line
    const inner = escHtml(ts)
      .replace(/\[URGENT\]/g, '<span class="pl-badge pl-urgent">URGENT</span>')
      .replace(/\[STAT\]/g,   '<span class="pl-badge pl-stat">STAT</span>')
      .replace(/\[ROUTINE\]/g,'<span class="pl-badge pl-routine">ROUTINE</span>');
    out.push(`<div class="pl-line">${inner}</div>`);
  }

  if (inNumbered) out.push('</div></div>');
  return out.join('\n');
}

function buildDirectSummaryHtml(ctx: DirectCtx, meta: PrintMeta): string {
  const site = SITE_INFO[meta.site] ?? SITE_INFO.rodney_bay;
  const now = new Date();
  const ect = { timeZone: 'America/St_Lucia' };
  const consultDate = now.toLocaleString('en-GB', {
    ...ect, day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  const vitalsArr = Object.entries({
    'BP':   ctx.vitals.systolicBp      ? `${ctx.vitals.systolicBp}/${ctx.vitals.diastolicBp} mmHg` : '',
    'HR':   ctx.vitals.heartRate       ? `${ctx.vitals.heartRate} bpm` : '',
    'Temp': ctx.vitals.temperatureC    ? `${ctx.vitals.temperatureC} °C` : '',
    'RR':   ctx.vitals.respiratoryRate ? `${ctx.vitals.respiratoryRate}/min` : '',
    'SpO₂': ctx.vitals.spo2           ? `${ctx.vitals.spo2}%` : '',
    'BSL':  ctx.vitals.glucoseMmol    ? `${ctx.vitals.glucoseMmol} mmol/L` : '',
  }).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);

  const examLines = [
    ctx.examGeneral     && `General: ${ctx.examGeneral}`,
    ctx.examCardio      && `Cardiovascular: ${ctx.examCardio}`,
    ctx.examResp        && `Respiratory: ${ctx.examResp}`,
    ctx.examAbdomen     && `Abdomen: ${ctx.examAbdomen}`,
    ctx.examNeuro       && `Neurological: ${ctx.examNeuro}`,
    ctx.examExtremities && `Extremities: ${ctx.examExtremities}`,
    ctx.examBreast      && `Breast / Local: ${ctx.examBreast}`,
    ctx.examWound       && `Wound: ${ctx.examWound}`,
  ].filter(Boolean) as string[];

  // Prescribed medications table — rendered from protocol queue if populated
  const hasMedTable = ctx.pendingPrescriptions && ctx.pendingPrescriptions.length > 0;
  const medTableHtml = hasMedTable
    ? `<table class="med-table">
<thead><tr><th>Drug</th><th>Dose</th><th>Route</th><th>Frequency</th><th>Duration</th><th>Phase</th></tr></thead>
<tbody>
${ctx.pendingPrescriptions.map(m => `<tr>
  <td><strong>${escHtml(m.drugName)}</strong>${m.alternativeTo ? `<br><span class="med-ind">alt: ${escHtml(m.alternativeTo)}</span>` : ''}</td>
  <td>${escHtml(m.dose)}</td>
  <td>${escHtml(m.route)}</td>
  <td>${escHtml(m.frequency)}</td>
  <td>${m.duration ? escHtml(m.duration) : '—'}</td>
  <td style="text-transform:capitalize">${escHtml(m.phase)}</td>
</tr>
<tr><td colspan="6" style="padding:0 8px 6px;border-bottom:1.5px solid #cbd5e1" class="med-ind">↳ ${escHtml(m.indication)}</td></tr>`).join('')}
</tbody></table>`
    : '';

  const hasPmhSurgHx = ctx.comorbidities.length || ctx.pmhNotes || ctx.surgicalHistory.length || ctx.surgicalNotes;
  const hasInvestigations = ctx.orderedInvestigations.length || (ctx.radiologyRequests && ctx.radiologyRequests.length);
  const hasAssessment = ctx.assessment || ctx.icdCodes.length || ctx.differentials;

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
${ctx.freeText ? `<div style="margin-top:4px;white-space:pre-wrap">${escHtml(ctx.freeText)}</div>` : ''}
${ctx.durationDays ? `<div style="margin-top:6px"><span class="lbl">Duration:</span> ${escHtml(ctx.durationDays)} days</div>` : ''}
${ctx.painScore ? `<div><span class="lbl">Pain score:</span> ${escHtml(ctx.painScore)}/10</div>` : ''}
</div></div>` : ''}

${vitalsArr.length ? `<div class="section">
<div class="sec-hdr">Vital Signs</div>
<div class="sec-body"><div style="display:flex;flex-wrap:wrap;gap:4px 22px;font-variant-numeric:tabular-nums">
${vitalsArr.map(v => `<span>${escHtml(v)}</span>`).join('')}
</div></div></div>` : ''}

${hasPmhSurgHx ? `<div class="section">
<div class="sec-hdr">Medical &amp; Surgical History</div>
<div class="sec-body">
${ctx.comorbidities.length || ctx.pmhNotes ? `<div style="margin-bottom:8px">
<div class="sub-lbl">Past Medical</div>
${items(ctx.comorbidities)}
${ctx.pmhNotes ? `<div>${escHtml(ctx.pmhNotes)}</div>` : ''}
</div>` : ''}
${ctx.surgicalHistory.length || ctx.surgicalNotes ? `<div>
<div class="sub-lbl">Surgical</div>
${items(ctx.surgicalHistory)}
${ctx.surgicalNotes ? `<div>${escHtml(ctx.surgicalNotes)}</div>` : ''}
</div>` : ''}
</div></div>` : ''}

${ctx.medications.length || ctx.medicationsText ? `<div class="section">
<div class="sec-hdr">Current Medications</div>
<div class="sec-body">${items(ctx.medications)}${ctx.medicationsText ? `<div>${escHtml(ctx.medicationsText)}</div>` : ''}</div>
</div>` : ''}

${ctx.allergies ? `<div class="section">
<div class="sec-hdr sec-hdr--warn">Allergies</div>
<div class="sec-body" style="font-weight:700;color:#b91c1c">${escHtml(ctx.allergies)}</div>
</div>` : ''}

<div class="section">
<div class="sec-hdr">Physical Examination</div>
<div class="sec-body">${examLines.length
  ? examLines.map(l => `<div class="item">${escHtml(l)}</div>`).join('')
  : '<div style="color:#94a3b8;font-size:12px;font-style:italic">Not yet documented — <span style="cursor:pointer;color:#0d9488;text-decoration:underline" onclick="parent.postMessage({type:\'NAV\',target:\'examination\'},\'*\')">complete in examination phase →</span></div>'
}</div>
</div>

${hasInvestigations ? `<div class="section">
<div class="sec-hdr">Investigations Ordered</div>
<div class="sec-body">
${ctx.orderedInvestigations.length ? `<div style="margin-bottom:6px">
<div class="sub-lbl">Laboratory</div>
${items(ctx.orderedInvestigations)}
</div>` : ''}
${ctx.radiologyRequests && ctx.radiologyRequests.length ? `<div>
<div class="sub-lbl">Radiology / Imaging</div>
${ctx.radiologyRequests.map(r => {
  const label = [r.modality, r.anatomicalRegion, r.laterality && r.laterality !== 'N/A' ? r.laterality : ''].filter(Boolean).join(' — ');
  const detail = [r.urgency, r.indication].filter(Boolean).join(' · ');
  return `<div class="item">${escHtml(label)}${detail ? `<span style="color:#64748b;font-size:11px"> (${escHtml(detail)})</span>` : ''}</div>`;
}).join('')}
</div>` : ''}
</div></div>` : ''}

${hasAssessment ? `<div class="section">
<div class="sec-hdr">Assessment</div>
<div class="sec-body">
${ctx.icdCodes.length ? `<div class="dx-field">
<div class="dx-label">Working Diagnosis</div>
<div class="dx-name">${escHtml(ctx.icdCodes.join('  ·  '))}</div>
</div>` : ''}
${ctx.differentials ? `<div class="diff-block">
<div class="diff-lbl">Ranked Differential Diagnoses</div>
${escHtml(ctx.differentials).split('\n').filter(l => l.trim()).map(l => `<div class="diff-item">${l}</div>`).join('')}
</div>` : ''}
${(() => {
  if (!ctx.assessment) return '';
  // Strip any history preamble — assessment must start at a clinical marker
  let body = ctx.assessment.trim();
  if (/^(Presenting History|Past Medical History|Surgical History|Medications?|Allergies?|History)\s*:/i.test(body)) {
    const wdIdx = body.search(/Working Diagnosis:|Clinical Impression:|Impression:|Assessment\s*:/i);
    body = wdIdx > 0 ? body.slice(wdIdx).trim() : '';
  } else {
    const wdIdx = body.search(/Working Diagnosis:|Clinical Impression:|Impression:|Assessment\s*:/i);
    if (wdIdx > 10) body = body.slice(wdIdx).trim();
  }
  // Also strip any trailing ranked differentials block (they have their own section)
  const diffIdx = body.search(/\n*Ranked differentials?:/i);
  if (diffIdx > 0) body = body.slice(0, diffIdx).trimEnd();
  return body ? `<div contenteditable="true" id="edit-assess" spellcheck="false" onfocus="this.style.outline='1.5px solid #0d9488';parent.postMessage({type:'EDIT_START'},'*')" onblur="this.style.outline='none';parent.postMessage({type:'EDIT_ASSESSMENT',content:this.innerText},'*');parent.postMessage({type:'EDIT_END'},'*')" style="white-space:pre-wrap;line-height:1.8;font-size:12.5px${ctx.icdCodes.length || ctx.differentials ? ';margin-top:10px' : ''};outline:none;border-radius:3px;cursor:text;padding:2px 4px;transition:outline .15s">${escHtml(body)}</div>` : '';
})()}
</div></div>` : ''}

${ctx.plan ? `<div class="section">
<div class="sec-hdr">Management Plan</div>
<div class="sec-body" style="line-height:1.75">${(() => {
  let planBody = ctx.plan;
  // Sync plan title with working diagnosis from assessment so they always match
  const wdLabel = ctx.assessment?.match(/Working Diagnosis:\s*([^⚠\n]+)/i)?.[1]?.trim();
  if (wdLabel) {
    planBody = planBody.replace(/^(Management Plan\s*(?:—|-)\s*)[^\n]*/m, `$1${wdLabel}`);
  }
  const dedupNote = hasInvestigations
    ? '<div style="font-size:11px;color:#0d9488;background:#f0fdfa;border:1px solid #99f6e4;border-radius:4px;padding:5px 10px;margin-bottom:10px">↑ Investigations already ordered above — plan sections 1–2 may overlap</div>'
    : '';
  return dedupNote + planTextToHtml(planBody);
})()}</div>
</div>` : ''}

${medTableHtml ? `<div class="section">
<div class="sec-hdr">Prescribed Medications</div>
<div class="sec-body">${medTableHtml}</div>
</div>` : ''}

${ctx.followUpNotes ? `<div class="section">
<div class="sec-hdr">Follow-up</div>
<div class="sec-body">${escHtml(ctx.followUpNotes).replace(/\n/g, '<br>')}</div>
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
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const editingRef = useRef(false);
  const lastHtmlRef = useRef('');
  const [refreshTick, setRefreshTick] = useState(0); // eslint-disable-line -- triggers re-render after inline edit ends
  const [sectionEdit, setSectionEdit] = useState<{lineStart: number; lineEnd: number; title: string; text: string} | null>(null);

  // Listen for messages from the preview iframe
  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      if (typeof ev.data !== 'object' || ev.data === null) return;
      const msg = ev.data as Record<string, unknown>;

      // ── Inline assessment editing ─────────────────────────────────────
      if (msg.type === 'EDIT_START') {
        editingRef.current = true;
        return;
      }
      if (msg.type === 'EDIT_END') {
        editingRef.current = false;
        setRefreshTick(t => t + 1);
        return;
      }
      if (msg.type === 'EDIT_ASSESSMENT') {
        ctxRef.current.setAssessment((msg.content as string ?? '').trim());
        return;
      }

      // ── Navigation to consultation phase ─────────────────────────────
      if (msg.type === 'NAV') {
        ctxRef.current.setActiveSection(msg.target as Section);
        return;
      }

      // ── Plan section block edit ───────────────────────────────────────
      if (msg.type === 'PLAN_SECTION_EDIT') {
        const lineStart = msg.lineStart as number;
        const lines = ctxRef.current.plan.split('\n');
        let lineEnd = lineStart + 1;
        while (lineEnd < lines.length) {
          const bl = lines[lineEnd].trim();
          if (!bl || bl.startsWith('━━━') || /^\d+\./.test(bl)) break;
          lineEnd++;
        }
        const title = lines[lineStart] ?? '';
        const sectionLines = lines.slice(lineStart + 1, lineEnd)
          .map(l => l.replace(/^ {0,2}/, ''))
          .filter(l => l.trim());
        setSectionEdit({ lineStart, lineEnd, title, text: sectionLines.join('\n') });
        return;
      }

      // ── Checkbox / bullet toggle ──────────────────────────────────────
      if (msg.type !== 'PLAN_CB') return;
      const idx = msg.idx as number;
      const lines = ctxRef.current.plan.split('\n');
      if (idx < 0 || idx >= lines.length) return;
      const line = lines[idx];
      const leading = /^(\s*)/.exec(line)?.[1] ?? '';
      const trimmed = line.trimStart();

      if (trimmed.startsWith('□ ')) {
        // Radio behavior: selecting one removes the other □ options in the same severity block
        const newLines = [...lines];
        newLines[idx] = leading + '■ ' + trimmed.slice(2);
        // Find block start (the ━━━ header above)
        let blockStart = idx - 1;
        while (blockStart >= 0 && !newLines[blockStart].trim().startsWith('━━━')) blockStart--;
        // Find block end (next ━━━, next numbered section, or empty line)
        let blockEnd = idx + 1;
        while (blockEnd < newLines.length) {
          const bl = newLines[blockEnd].trim();
          if (!bl || bl.startsWith('━━━') || /^\d+\./.test(bl)) break;
          blockEnd++;
        }
        // Remove all other □ lines within the block
        const filtered = newLines.filter((l, i) => {
          if (i <= blockStart || i >= blockEnd) return true;
          if (i === idx) return true;
          return !l.trimStart().startsWith('□ ');
        });
        ctxRef.current.setPlan(filtered.join('\n'));
      } else if (trimmed.startsWith('■ ')) {
        lines[idx] = leading + '□ ' + trimmed.slice(2);
        ctxRef.current.setPlan(lines.join('\n'));
      } else if (trimmed.startsWith('✗ ')) {
        lines[idx] = leading + trimmed.slice(2);
        ctxRef.current.setPlan(lines.join('\n'));
      } else if (trimmed.startsWith('• ') || /^\[(?:URGENT|STAT|ROUTINE)\]/.test(trimmed)) {
        lines[idx] = leading + '✗ ' + trimmed;
        ctxRef.current.setPlan(lines.join('\n'));
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

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

  // Ref-based iframe refresh — skips updates while user is inline-editing the preview
  useEffect(() => {
    if (editingRef.current) return;
    const frame = iframeRef.current;
    if (!frame) return;
    const html = getHtml();
    if (html === lastHtmlRef.current) return;
    lastHtmlRef.current = html;
    frame.setAttribute('srcdoc', html);
  });

  // Suppress the refreshTick warning — it exists only to force a re-render after editing ends
  void refreshTick;

  function saveSectionEdit() {
    if (!sectionEdit) return;
    const lines = ctxRef.current.plan.split('\n');
    const newSectionLines = sectionEdit.text
      .split('\n')
      .map(l => l.trim() ? '  ' + l.replace(/^\s+/, '') : '')
      .filter(Boolean);
    lines.splice(sectionEdit.lineStart + 1, sectionEdit.lineEnd - sectionEdit.lineStart - 1, ...newSectionLines);
    ctx.setPlan(lines.join('\n'));
    setSectionEdit(null);
  }

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

      {/* ── Plan section inline editor ── */}
      {sectionEdit && (
        <div style={{ border: '1.5px solid #0d9488', borderRadius: 8, padding: 12, background: '#f0fdfa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Editing: {sectionEdit.title.replace(/^\d+\.\s*/, '')}
            </span>
            <button type="button" onClick={() => setSectionEdit(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#94a3b8', lineHeight: 1 }}>✕</button>
          </div>
          <textarea
            value={sectionEdit.text}
            onChange={e => setSectionEdit({ ...sectionEdit, text: e.target.value })}
            style={{ width: '100%', fontSize: 12, fontFamily: 'monospace', minHeight: 100, borderRadius: 4, border: '1px solid #d1d5db', padding: '6px 8px', resize: 'vertical' }}
            placeholder="• item one&#10;• item two&#10;→ indication or note"
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" onClick={saveSectionEdit}
              style={{ padding: '5px 16px', borderRadius: 6, border: 'none', background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Save
            </button>
            <button type="button" onClick={() => setSectionEdit(null)}
              style={{ padding: '5px 14px', borderRadius: 6, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

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
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Click assessment text to edit · hover plan sections for ✎ · updates live</span>
          </div>
          <div style={{ background: '#e5e7eb', padding: '16px 0', overflowY: 'auto', maxHeight: 740 }}>
            <iframe
              ref={iframeRef}
              title="Document preview"
              style={{ display: 'block', width: '96%', maxWidth: 720, margin: '0 auto', minHeight: 640, border: 'none', background: '#fff', borderRadius: 4, boxShadow: '0 1px 6px rgba(0,0,0,0.12)' }}
              sandbox="allow-same-origin allow-scripts"
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
