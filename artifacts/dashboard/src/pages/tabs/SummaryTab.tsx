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

  function print() {
    if (!document) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html><head>
<title>Clinical Summary — Amise Medical Services</title>
<style>
  body { font-family: 'Georgia', serif; max-width: 720px; margin: 40px auto; line-height: 1.7; color: #111; }
  pre { white-space: pre-wrap; font-family: inherit; font-size: 14px; }
  @media print { body { margin: 0; } }
</style>
</head><body>
<pre>${document.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body></html>`);
    w.document.close();
    w.focus();
    w.print();
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
              <button className="summary-btn summary-btn--ghost" onClick={print}>
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
