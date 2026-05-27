import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

// ── Local minimal types for RadiologyRequest and ClinicalAttachment ───────────

interface RRLocal {
  modality: string;
  anatomicalRegion: string;
  laterality: string;
  urgency: string;
  indication: string;
  clinicalQuestion: string;
  ctContrast: string;
  ctEgfr: string;
  mriProtocol: string;
  scopeType: string;
  functionalType: string;
  resultReceived: boolean;
  resultNotes: string;
}

interface CALocal {
  name: string;
  anatomicalArea: string;
  dimensions: string;
  description: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SITE_LABELS: Record<string, string> = {
  rodney_bay: 'Rodney Bay Office',
  castries:   'Castries Office',
  tapion:     'Tapion Hospital',
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

const DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

function ectNow(): string {
  return new Date().toLocaleString('en-GB', { timeZone: 'America/St_Lucia' });
}

// ── Text helpers ──────────────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function bullet(items: string[]): string {
  return items.map(i => `  • ${i}`).join('\n');
}

function sectionHeader(title: string): string {
  return `\n${title}\n${'─'.repeat(title.length)}`;
}

function skipIfEmpty(content: string): string {
  return content.trim() ? content : '';
}

// ── buildDocument ─────────────────────────────────────────────────────────────

type AppCtx = ReturnType<typeof useAppContext>;

function buildDocument(ctx: AppCtx): string {
  const now = ectNow();
  const siteName = SITE_LABELS[ctx.currentSite] ?? ctx.currentSite;
  const apptLabel = APPT_LABELS[ctx.triageResult.appointmentType] ?? ctx.triageResult.appointmentType;

  const lines: string[] = [];

  // ── Header ──
  lines.push('AMISE MEDICAL SERVICES');
  lines.push(`Encounter Record — ${apptLabel}`);
  lines.push(`${siteName} · ${now}`);
  lines.push(DIVIDER);

  // ── Patient Demographics ──
  lines.push(sectionHeader('PATIENT DEMOGRAPHICS'));
  if (ctx.patientName) lines.push(`Patient:      ${ctx.patientName}`);
  const ageDob = [ctx.age ? `${ctx.age} years` : '', ctx.dob ? `(${ctx.dob})` : ''].filter(Boolean).join(' ');
  if (ageDob) lines.push(`Age/DOB:      ${ageDob}`);
  if (ctx.sex && ctx.sex !== 'unknown') lines.push(`Sex:          ${ctx.sex.charAt(0).toUpperCase() + ctx.sex.slice(1)}`);
  if (ctx.phone) lines.push(`Phone:        ${ctx.phone}`);
  if (ctx.address) lines.push(`Address:      ${ctx.address}`);
  if (ctx.referredBy) lines.push(`Referred by:  ${ctx.referredBy}`);

  // ── Encounter ──
  const encounterLines: string[] = [];
  encounterLines.push(`Consultation type:  ${apptLabel}`);
  encounterLines.push(`Acuity:             ${ctx.triageResult.acuity.toUpperCase()} (Score: ${ctx.triageResult.score})`);
  if (ctx.isPostOp && ctx.postOpDays) {
    encounterLines.push(`Post-operative day: ${ctx.postOpDays}`);
  }
  if (ctx.pregnancyPossible) {
    encounterLines.push('Pregnancy:          Possible');
  }
  lines.push(sectionHeader('ENCOUNTER'));
  lines.push(encounterLines.join('\n'));

  // ── Presenting Complaint ──
  const complaintParts: string[] = [];
  if (ctx.symptoms.length > 0) {
    complaintParts.push(`Chief complaint:  ${ctx.symptoms.join(', ')}`);
  }
  if (ctx.durationDays) {
    complaintParts.push(`Duration:         ${ctx.durationDays} days`);
  }
  if (ctx.painScore) {
    complaintParts.push(`Pain score:       ${ctx.painScore}/10`);
  }
  if (ctx.freeText) {
    complaintParts.push('');
    complaintParts.push(ctx.freeText);
  }
  const complaintBlock = skipIfEmpty(complaintParts.join('\n'));
  if (complaintBlock) {
    lines.push(sectionHeader('PRESENTING COMPLAINT'));
    lines.push(complaintBlock);
  }

  // ── Past Medical History ──
  const pmhParts: string[] = [];
  if (ctx.comorbidities.length > 0) pmhParts.push(bullet(ctx.comorbidities));
  if (ctx.pmhNotes) pmhParts.push(ctx.pmhNotes);
  const pmhBlock = skipIfEmpty(pmhParts.join('\n'));
  if (pmhBlock) {
    lines.push(sectionHeader('PAST MEDICAL HISTORY'));
    lines.push(pmhBlock);
  }

  // ── Surgical History ──
  const surgParts: string[] = [];
  if (ctx.surgicalHistory.length > 0) surgParts.push(bullet(ctx.surgicalHistory));
  if (ctx.surgicalNotes) surgParts.push(ctx.surgicalNotes);
  const surgBlock = skipIfEmpty(surgParts.join('\n'));
  if (surgBlock) {
    lines.push(sectionHeader('SURGICAL HISTORY'));
    lines.push(surgBlock);
  }

  // ── Family History ──
  const famParts: string[] = [];
  if (ctx.familyHistory.length > 0) famParts.push(bullet(ctx.familyHistory));
  if (ctx.familyHistoryNotes) famParts.push(ctx.familyHistoryNotes);
  const famBlock = skipIfEmpty(famParts.join('\n'));
  if (famBlock) {
    lines.push(sectionHeader('FAMILY HISTORY'));
    lines.push(famBlock);
  }

  // ── Social / Toxic Habits ──
  if (ctx.toxicHabits.length > 0) {
    lines.push(sectionHeader('SOCIAL / TOXIC HABITS'));
    lines.push(bullet(ctx.toxicHabits));
  }

  // ── Medications ──
  const medParts: string[] = [];
  if (ctx.medications.length > 0) medParts.push(bullet(ctx.medications));
  if (ctx.medicationsText) medParts.push(ctx.medicationsText);
  const medBlock = skipIfEmpty(medParts.join('\n'));
  if (medBlock) {
    lines.push(sectionHeader('MEDICATIONS'));
    lines.push(medBlock);
  }

  // ── Allergies ──
  if (ctx.allergies) {
    lines.push(sectionHeader('ALLERGIES'));
    lines.push(ctx.allergies);
  }

  // ── Vital Signs ──
  const v = ctx.vitals;
  const vitalLines: string[] = [];
  const bpPart = v.systolicBp && v.diastolicBp ? `BP: ${v.systolicBp}/${v.diastolicBp} mmHg` : '';
  const hrPart = v.heartRate ? `HR: ${v.heartRate} bpm` : '';
  const tempPart = v.temperatureC ? `Temp: ${v.temperatureC} °C` : '';
  const rrPart = v.respiratoryRate ? `RR: ${v.respiratoryRate}/min` : '';
  const spo2Part = v.spo2 ? `SpO₂: ${v.spo2}%` : '';
  const bslPart = v.glucoseMmol ? `BSL: ${v.glucoseMmol} mmol/L` : '';
  const row1 = [bpPart, hrPart, tempPart].filter(Boolean).join('   ');
  const row2 = [rrPart, spo2Part, bslPart].filter(Boolean).join('   ');
  const row3Parts: string[] = [];
  if (ctx.weightKg) row3Parts.push(`Weight: ${ctx.weightKg} kg`);
  if (ctx.heightCm) row3Parts.push(`Height: ${ctx.heightCm} cm`);
  if (row1) vitalLines.push(row1);
  if (row2) vitalLines.push(row2);
  if (row3Parts.length > 0) vitalLines.push(row3Parts.join('   '));
  if (vitalLines.length > 0) {
    lines.push(sectionHeader('VITAL SIGNS'));
    lines.push(vitalLines.join('\n'));
  }

  // ── Physical Examination ──
  const examPairs: [string, string][] = [
    ['General', ctx.examGeneral],
    ['Cardiovascular', ctx.examCardio],
    ['Respiratory', ctx.examResp],
    ['Abdomen', ctx.examAbdomen],
    ['Neurological', ctx.examNeuro],
    ['Extremities', ctx.examExtremities],
    ['Breast / Local', ctx.examBreast],
    ['Wound', ctx.examWound],
  ];
  const examLines = examPairs.filter(([, val]) => val).map(([label, val]) => `${label}: ${val}`);
  if (examLines.length > 0) {
    lines.push(sectionHeader('PHYSICAL EXAMINATION'));
    lines.push(examLines.join('\n'));
  }

  // ── Review of Systems ──
  const rosEntries = Object.entries(ctx.rosFindings).filter(
    ([, f]) => f.status !== 'not-asked' && (f.details.length > 0 || f.notes)
  );
  if (rosEntries.length > 0) {
    lines.push(sectionHeader('REVIEW OF SYSTEMS'));
    rosEntries.forEach(([sys, f]) => {
      const detailStr = f.details.length > 0 ? f.details.join(', ') : '';
      const noteStr = f.notes ? (detailStr ? ` — ${f.notes}` : f.notes) : '';
      lines.push(`  ${sys} [${f.status}]: ${detailStr}${noteStr}`);
    });
  }

  // ── Investigations Ordered ──
  if (ctx.orderedInvestigations.length > 0) {
    lines.push(sectionHeader('INVESTIGATIONS ORDERED'));
    ctx.orderedInvestigations.forEach(inv => {
      const result = ctx.investigationResults[inv];
      lines.push(result ? `  • ${inv}: ${result}` : `  • ${inv}`);
    });
  }

  // ── Radiology / Imaging Requests ──
  if (ctx.radiologyRequests.length > 0) {
    lines.push(sectionHeader('RADIOLOGY / IMAGING REQUESTS'));
    (ctx.radiologyRequests as unknown as RRLocal[]).forEach((rr, idx) => {
      lines.push(`  [${idx + 1}] ${rr.modality}${rr.anatomicalRegion ? ` — ${rr.anatomicalRegion}` : ''}${rr.laterality ? ` (${rr.laterality})` : ''}`);
      if (rr.urgency) lines.push(`      Urgency:           ${rr.urgency}`);
      if (rr.indication) lines.push(`      Indication:        ${rr.indication}`);
      if (rr.clinicalQuestion) lines.push(`      Clinical question: ${rr.clinicalQuestion}`);
      if (rr.ctContrast && rr.ctContrast !== 'none') lines.push(`      CT contrast:       ${rr.ctContrast}${rr.ctEgfr ? `, eGFR: ${rr.ctEgfr}` : ''}`);
      if (rr.mriProtocol) lines.push(`      MRI protocol:      ${rr.mriProtocol}`);
      if (rr.scopeType) lines.push(`      Scope type:        ${rr.scopeType}`);
      if (rr.functionalType) lines.push(`      Functional type:   ${rr.functionalType}`);
      if (rr.resultReceived) {
        lines.push(`      Result received:   Yes`);
        if (rr.resultNotes) lines.push(`      Result notes:      ${rr.resultNotes}`);
      }
    });
  }

  // ── Assessment ──
  const assessParts: string[] = [];
  if (ctx.assessment) assessParts.push(`Working diagnosis: ${ctx.assessment}`);
  if (ctx.icdCodes.length > 0) assessParts.push(`ICD-10 codes: ${ctx.icdCodes.join(', ')}`);
  if (ctx.differentials) {
    assessParts.push('');
    assessParts.push('Differential diagnoses:');
    assessParts.push(ctx.differentials);
  }
  const assessBlock = skipIfEmpty(assessParts.join('\n'));
  if (assessBlock) {
    lines.push(sectionHeader('ASSESSMENT'));
    lines.push(assessBlock);
  }

  // ── Management Plan ──
  const planParts: string[] = [];
  if (ctx.plan) planParts.push(ctx.plan);
  if (ctx.cptCodes.length > 0) planParts.push(`CPT codes: ${ctx.cptCodes.join(', ')}`);
  if (ctx.procedures) {
    planParts.push('');
    planParts.push(`Procedures: ${ctx.procedures}`);
  }
  const planBlock = skipIfEmpty(planParts.join('\n'));
  if (planBlock) {
    lines.push(sectionHeader('MANAGEMENT PLAN'));
    lines.push(planBlock);
  }

  // ── Clinical Attachments ──
  if (ctx.attachments.length > 0) {
    lines.push(sectionHeader('CLINICAL ATTACHMENTS'));
    (ctx.attachments as unknown as CALocal[]).forEach((att, idx) => {
      lines.push(`  [${idx + 1}] ${att.name}`);
      if (att.anatomicalArea) lines.push(`      Anatomical area: ${att.anatomicalArea}`);
      if (att.dimensions) lines.push(`      Dimensions:      ${att.dimensions}`);
      if (att.description) lines.push(`      Description:     ${att.description}`);
    });
  }

  // ── Footer ──
  lines.push('');
  lines.push(DIVIDER);
  lines.push('Clinician: Dr. Dawit D Kabiye, MD, DM');
  lines.push('           General & Endoscopic Surgery');
  lines.push('           Amise Medical Services, Saint Lucia');
  lines.push('Signature: ______________________________');
  lines.push('Licence #: ________________  Date: ________________');
  lines.push(`Generated: ${now}`);

  return lines.join('\n');
}

// ── Print / Download helpers ──────────────────────────────────────────────────

function buildPrintHtml(text: string, patientName: string, siteName: string): string {
  const now = ectNow();
  const safe = escHtml(text);

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

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<title>Encounter Record — ${escHtml(patientName || 'Patient')}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#1a1a1a;line-height:1.65;background:#fff;max-width:175mm;margin:0 auto;padding:20px 24px}
  .hdr{display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;border-bottom:2.5px solid #1a3a5c;margin-bottom:16px}
  .hdr-office{font-size:13px;font-weight:700;color:#1a3a5c;letter-spacing:.3px}
  .hdr-sub{font-size:11px;color:#555;line-height:1.7;margin-top:3px}
  .doc-title{font-size:15px;font-weight:700;text-align:center;color:#1a3a5c;letter-spacing:.5px;margin-bottom:18px;text-transform:uppercase;border-bottom:1px solid #e5e9ef;padding-bottom:8px}
  pre{font-family:Arial,Helvetica,sans-serif;font-size:12.5px;white-space:pre-wrap;word-break:break-word;line-height:1.65;color:#1a1a1a}
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
</head><body>

<div class="hdr">
  <div>
    <div class="hdr-office">${escHtml(siteName)}</div>
    <div class="hdr-sub">Tel: 1 (758) 720 7111 &nbsp;·&nbsp; amisesuite@gmail.com</div>
    <div class="hdr-sub" style="margin-top:2px;color:#1a3a5c">${escHtml(now)}</div>
  </div>
  <div>${LOGO_SVG}</div>
</div>

<div class="doc-title">Encounter Record</div>

<pre>${safe}</pre>

<div class="sig">
  <div class="sig-left">
    <div class="sig-line"></div>
    <div class="sig-name">Dr. Dawit D Kabiye</div>
    <div class="sig-title">MD, DM &nbsp;·&nbsp; General &amp; Endoscopic Surgery</div>
    <div class="sig-lic">Licence #: ............&nbsp;&nbsp;&nbsp;&nbsp; Date: ..................</div>
  </div>
  <div class="sig-right">Generated ${escHtml(now)}</div>
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
    setTimeout(() => { try { win.print(); } catch { /* ignore */ } }, 450);
  }
}

function downloadHtml(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const url = URL.createObjectURL(blob);
  if (isIOS) {
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return;
  }
  const a = window.document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  window.document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FinalDocTab() {
  const ctx = useAppContext();
  const { finalDocument, setFinalDocument } = ctx;

  const siteName = SITE_LABELS[ctx.currentSite] ?? ctx.currentSite;

  function handlePopulate() {
    const doc = buildDocument(ctx);
    setFinalDocument(doc);
  }

  function handlePrint() {
    if (!finalDocument) return;
    const html = buildPrintHtml(finalDocument, ctx.patientName, siteName);
    printHtml(html);
  }

  function handleDownload() {
    if (!finalDocument) return;
    const slug = (ctx.patientName || 'patient')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `encounter-record-${slug}-${dateStr}.html`;
    const html = buildPrintHtml(finalDocument, ctx.patientName, siteName);
    downloadHtml(html, filename);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <CollapsibleCard title="Final Encounter Document" defaultOpen>

        {/* Action bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 12,
        }}>
          <button
            type="button"
            onClick={handlePopulate}
            style={{
              padding: '7px 16px',
              borderRadius: 8,
              border: '1.5px solid #1a5276',
              background: '#1a5276',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ↺ Populate from data
          </button>

          <button
            type="button"
            onClick={handlePrint}
            disabled={!finalDocument}
            style={{
              padding: '7px 16px',
              borderRadius: 8,
              border: finalDocument ? '1px solid #374151' : '1px solid #d1d5db',
              background: finalDocument ? '#f9fafb' : '#f3f4f6',
              color: finalDocument ? '#1a1a1a' : '#9ca3af',
              fontSize: 13,
              cursor: finalDocument ? 'pointer' : 'default',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            🖨 Print / PDF
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={!finalDocument}
            style={{
              padding: '7px 16px',
              borderRadius: 8,
              border: finalDocument ? '1px solid #374151' : '1px solid #d1d5db',
              background: finalDocument ? '#f9fafb' : '#f3f4f6',
              color: finalDocument ? '#1a1a1a' : '#9ca3af',
              fontSize: 13,
              cursor: finalDocument ? 'pointer' : 'default',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ↓ Download HTML
          </button>

          <span style={{
            fontSize: 11,
            color: '#9ca3af',
            marginLeft: 4,
          }}>
            This document is editable. Changes are saved to this session.
          </span>
        </div>

        {/* Empty state */}
        {!finalDocument && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 220,
            gap: 8,
            color: '#9ca3af',
            border: '1.5px dashed #e5e7eb',
            borderRadius: 10,
            background: '#fafafa',
            padding: 32,
          }}>
            <span style={{ fontSize: 38 }}>📋</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#6b7280' }}>No final document yet</span>
            <span style={{ fontSize: 13, textAlign: 'center', maxWidth: 340, lineHeight: 1.6 }}>
              Click <strong style={{ color: '#1a5276' }}>↺ Populate from data</strong> to build it from all
              entered encounter data.
            </span>
          </div>
        )}

        {/* Editable document textarea */}
        {finalDocument && (
          <textarea
            value={finalDocument}
            onChange={e => setFinalDocument(e.target.value)}
            spellCheck
            style={{
              width: '100%',
              minHeight: '70vh',
              fontFamily: 'monospace',
              fontSize: 13,
              lineHeight: 1.65,
              color: '#1a1a1a',
              background: '#fafafa',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              padding: '14px 16px',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        )}

      </CollapsibleCard>
    </div>
  );
}
