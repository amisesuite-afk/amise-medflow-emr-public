import { useState, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';

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

const SITE_INFO: Record<string, { name: string; address: string }> = {
  rodney_bay: { name: 'Rodney Bay Office', address: 'Providence Building, First Floor, Apt#3, Rodney Bay, Saint Lucia' },
  castries:   { name: 'Castries Office',   address: 'Castries, Saint Lucia' },
  tapion:     { name: 'Tapion Hospital',   address: 'Tapion, Saint Lucia' },
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

const LOGO_SVG = `<svg width="130" height="46" viewBox="0 0 130 46" xmlns="http://www.w3.org/2000/svg">
  <g fill="#1a5276">
    <ellipse cx="17" cy="12" rx="7" ry="8"/>
    <path d="M10 19 C9 26 10 34 16 38 C20 40 24 38 24 35 C20 33 17 29 17 23 C17 19 19 18 21 18 C16 16 11 17 10 19Z"/>
  </g>
  <g fill="#c0392b">
    <ellipse cx="31" cy="12" rx="7" ry="8"/>
    <path d="M38 19 C39 26 38 34 32 38 C28 40 24 38 24 35 C28 33 31 29 31 23 C31 19 29 18 27 18 C32 16 37 17 38 19Z"/>
  </g>
  <text x="52" y="23" font-family="Arial,Helvetica,sans-serif" font-size="18" font-weight="bold" fill="#1a5276">AMISE</text>
  <text x="52" y="37" font-family="Arial,Helvetica,sans-serif" font-size="8" fill="#555" letter-spacing="1.5">MEDICAL SERVICES</text>
</svg>`;

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
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111;line-height:1.55}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:10px;border-bottom:1.5px solid #222;margin-bottom:10px}
  .hdr-left{font-size:10px;line-height:1.7}
  .hdr-office{font-size:11px;font-weight:600}
  .pt-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:8px 0;border-bottom:1px solid #ccc;margin-bottom:14px;font-size:10px}
  .pt-col-hdr{font-weight:bold;font-size:11px;margin-bottom:4px}
  .pt-line{margin-bottom:2px}
  .s-section{margin-bottom:14px}
  .s-main-hdr{font-size:11.5px;font-weight:bold;text-transform:uppercase;background:#f0f0f0;padding:3px 8px;margin-bottom:8px;border-left:3px solid #1a5276;letter-spacing:.5px}
  .s-sub-hdr{font-weight:bold;font-size:11px;margin:8px 0 3px}
  .s-line{font-size:11px;margin-bottom:2px}
  .s-bullet{font-size:11px;padding-left:14px;position:relative;margin-bottom:2px}
  .s-bullet::before{content:"•";position:absolute;left:4px}
  .s-gap{height:5px}
  .ftr{margin-top:24px;padding-top:8px;border-top:1px solid #ccc;display:flex;justify-content:space-between;align-items:flex-end;font-size:10px}
  .ftr-gen{color:#888}
  .ftr-doc{text-align:right;font-weight:bold;font-size:11px;line-height:1.5}
  .ftr-doc-sub{font-weight:normal;font-size:10px;color:#444}
  .licence{text-align:right;margin-top:8px;padding-top:6px;border-top:1px solid #ccc;font-size:10px;color:#555}
  @page{margin:18mm 20mm;size:A4}
  @media print{body{margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head><body>

<div class="hdr">
  <div class="hdr-left">
    <div class="hdr-office">${escHtml(site.name)}</div>
    <div>${escHtml(site.address)}</div>
    <div>1 (758) 720 7111, amisesuite@gmail.com</div>
  </div>
  <div>${LOGO_SVG}</div>
</div>

<div class="pt-row">
  <div>
    <div class="pt-col-hdr">Patient Details</div>
    <div class="pt-line">${escHtml(meta.patientName || '—')}</div>
    <div class="pt-line">PID : ${escHtml(pidDisplay)}</div>
    <div class="pt-line">${escHtml(ageLine || '—')}</div>
    <div class="pt-line">${escHtml(meta.phone || '—')}</div>
  </div>
  <div>
    <div class="pt-col-hdr">Consultation Details</div>
    <div class="pt-line">${escHtml(consultType)} at ${escHtml(site.name)}</div>
    <div class="pt-line">Dr. Dawit D Kabiye</div>
    <div class="pt-line">${escHtml(consultDate)}</div>
  </div>
</div>

${bodyHtml}

<div class="ftr">
  <div class="ftr-gen">Generated on ${generatedDate}</div>
  <div class="ftr-doc">Dr. Dawit D Kabiye<br><span class="ftr-doc-sub">MD,DM in General Surgery</span></div>
</div>
<div class="licence">Licence #: ............</div>

</body></html>`;
}

const BASE = import.meta.env.BASE_URL ?? '/';

function apiUrl(path: string) {
  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  return `${base}${path}`;
}

export default function SummaryTab() {
  const ctx = useAppContext();
  const [document, setDocument] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

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
          toxicHabits: ctx.toxicHabits,
        },
        examination: {
          General: ctx.examGeneral,
          Cardiovascular: ctx.examCardio,
          Respiratory: ctx.examResp,
          Abdomen: ctx.examAbdomen,
          Neurological: ctx.examNeuro,
          Extremities: ctx.examExtremities,
          Breast: ctx.examBreast,
          Wound: ctx.examWound,
        },
        assessment: ctx.assessment,
        differentials: ctx.differentials,
        plan: ctx.plan,
        triageAcuity: ctx.triageResult.acuity,
        triageScore: ctx.triageResult.score,
        date: new Date().toLocaleDateString('en-GB', {
          day: '2-digit', month: 'long', year: 'numeric',
        }),
      };

      const res = await fetch(apiUrl('/api/summary/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as { document: string };
      setDocument(data.document);
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
    const html = buildPrintHtml(document, makePrintMeta());

    // Inject a hidden iframe into the current page — avoids popup-blocker entirely
    const iframe = window.document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;';
    iframe.setAttribute('title', 'print-frame');
    window.document.body.appendChild(iframe);

    const iDoc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!iDoc) { iframe.remove(); return; }

    iDoc.open();
    iDoc.write(html);
    iDoc.close();

    // Wait for resources, then print; remove iframe after dialog closes
    const doprint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => iframe.remove(), 2000);
      }
    };

    if (iframe.contentDocument?.readyState === 'complete') {
      doprint();
    } else {
      iframe.onload = doprint;
    }
  }

  function downloadDoc() {
    if (!document) return;
    const patientSlug = (ctx.patientName || 'patient').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `clinical-summary-${patientSlug}-${dateStr}.html`;

    const html = buildPrintHtml(document, makePrintMeta());
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
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
      {/* Header */}
      <div className="summary-header">
        <div>
          <div className="summary-title">Clinical Intake Summary</div>
          <div className="summary-sub">
            AI-drafted from all collected data — review and edit before sending to Dr Kabiye
          </div>
        </div>
        <div className="summary-actions">
          {document && (
            <>
              <button className="summary-btn summary-btn--ghost" onClick={() => void copy()}>
                {copied ? '✓ Copied' : '⎘ Copy'}
              </button>
              <button className="summary-btn summary-btn--ghost" onClick={downloadDoc}>
                ↓ Download
              </button>
              <button className="summary-btn summary-btn--ghost" onClick={printDoc}>
                🖨 Print / Save PDF
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
              '✦ Draft clinical summary'
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="summary-error">
          ⚠ {error}
          {error.includes('ANTHROPIC') || error.includes('API') ? (
            <span> — Check that ANTHROPIC_API_KEY is set in environment secrets.</span>
          ) : null}
        </div>
      )}

      {/* Empty state */}
      {!document && !loading && (
        <div className="summary-empty">
          <div className="summary-empty-icon">📋</div>
          <div className="summary-empty-title">No summary yet</div>
          <div className="summary-empty-body">
            Fill in the patient intake, then click <strong>Draft clinical summary</strong> above.
            Claude will compose a structured document from all collected data, which you can edit
            before sending for Dr Kabiye's review.
          </div>
          <div className="summary-checklist">
            <div className={`summary-check ${ctx.patientName ? 'ok' : ''}`}>
              {ctx.patientName ? '✓' : '○'} Patient name
            </div>
            <div className={`summary-check ${ctx.symptoms.length ? 'ok' : ''}`}>
              {ctx.symptoms.length ? '✓' : '○'} At least one symptom selected
            </div>
            <div className={`summary-check ${Object.values(ctx.vitals).some(v => v.trim()) ? 'ok' : ''}`}>
              {Object.values(ctx.vitals).some(v => v.trim()) ? '✓' : '○'} Vital signs (optional)
            </div>
          </div>
        </div>
      )}

      {/* Generated document */}
      {(document || loading) && (
        <div className="summary-doc-wrap">
          <div className="summary-doc-bar">
            <span className="summary-doc-badge">DRAFT — FOR REVIEW</span>
            <span className="summary-doc-note">
              This is an AI-drafted administrative summary. Edit freely before forwarding.
              Clinical decisions remain with Dr Kabiye.
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
    </div>
  );
}
