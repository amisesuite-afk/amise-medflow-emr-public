import { useState, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';

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

  async function copy() {
    if (!document) return;
    await navigator.clipboard.writeText(document);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function buildPrintHtml(text: string): string {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Clinical Summary — Amise Medical Services</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; max-width: 720px; margin: 32px auto; padding: 0 24px; line-height: 1.75; color: #111; font-size: 13px; }
  pre { white-space: pre-wrap; word-break: break-word; font-family: inherit; font-size: 13px; }
  h1 { font-size: 15px; margin-bottom: 6px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 11px; color: #555; }
  @page { margin: 20mm; }
  @media print { body { margin: 0; padding: 0; } }
</style>
</head><body>
<pre>${escaped}</pre>
<div class="footer">DRAFT — FOR REVIEW — Amise Medical Services, Saint Lucia. Clinical decisions remain with Dr Kabiye.</div>
</body></html>`;
  }

  function printDoc() {
    if (!document) return;
    const html = buildPrintHtml(document);

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
    const filename = `clinical-summary-${patientSlug}-${dateStr}.txt`;

    const blob = new Blob([document], { type: 'text/plain;charset=utf-8' });
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
