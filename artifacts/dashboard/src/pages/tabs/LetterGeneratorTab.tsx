import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import { getApiOrigin } from '@/lib/api-origin';
import { supabase } from '@/lib/supabase';
import { downloadAsWord } from './lib/pdfExport';

type LetterType = 'referral' | 'gp_summary' | 'insurance' | 'sick_cert' | 'patient_discharge' | 'clinical_discharge';

const LETTER_TYPES: { id: LetterType; label: string; icon: string; hint: string }[] = [
  { id: 'referral',          label: 'Referral letter',            icon: '📋', hint: 'Formal referral to specialist or facility' },
  { id: 'gp_summary',        label: 'GP summary',                 icon: '🏥', hint: 'Summary letter to family physician / GP' },
  { id: 'insurance',         label: 'Insurance report',           icon: '📑', hint: 'Medical report for insurance company' },
  { id: 'sick_cert',         label: 'Sick certificate',           icon: '📄', hint: 'Fit note / sick certificate for employer' },
  { id: 'patient_discharge', label: 'Patient discharge advice',   icon: '🏠', hint: 'Patient-facing discharge instructions (simple language)' },
  { id: 'clinical_discharge', label: 'Clinical discharge summary', icon: '📝', hint: 'Formal clinical summary for the medical record and referring doctor' },
];

function apiUrl(path: string) {
  const o = getApiOrigin();
  return o ? `${o}${path}` : path;
}

export default function LetterGeneratorTab() {
  const {
    patientName, age, sex, dob, nhiNumber, phone,
    comorbidities, pmhNotes, medications, medicationsText, allergies,
    assessment, differentials, plan, icdCodes,
    hpiNotes, freeText,
    surgicalHistory,
    examGeneral, examCardio, examResp, examAbdomen, examBreast, examWound, examNeuro, examExtremities,
    vitals,
    patientId, encounterId,
  } = useAppContext();

  const [letterType, setLetterType] = useState<LetterType>('referral');
  const [recipient, setRecipient] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [reason, setReason] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function generate() {
    setLoading(true); setError(null); setOutput('');
    try {
      const examFields: Record<string, string> = {};
      const examMap: [string, string][] = [
        ['General', examGeneral], ['Cardiovascular', examCardio], ['Respiratory', examResp],
        ['Abdomen', examAbdomen], ['Breast', examBreast], ['Wound', examWound],
        ['Neurological', examNeuro], ['Extremities', examExtremities],
      ];
      examMap.forEach(([k, v]) => { if (v?.trim()) examFields[k] = v.trim(); });

      const context = {
        letterType,
        recipient, specialty, reason,
        patient: { name: patientName, age, sex, dob, nhiNumber, phone },
        pmh: comorbidities,
        pmhNotes,
        surgicalHistory,
        medications: [...medications, ...medicationsText.split('\n').filter(Boolean)],
        allergies,
        hpi: hpiNotes || freeText,
        examination: Object.keys(examFields).length ? examFields : undefined,
        vitals: Object.values(vitals).some(v => v) ? vitals : undefined,
        assessment,
        differentials,
        plan,
        icdCodes,
      };

      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const authHeaders: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` } : {};
      const res = await fetch(apiUrl('/api/generate-letter'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(context),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => res.statusText);
        throw new Error(txt || `HTTP ${res.status}`);
      }

      // Stream response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');
      let draft = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        draft += decoder.decode(value, { stream: true });
        setOutput(draft);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const NOTE_TYPE_MAP: Record<LetterType, string> = {
    referral: 'referral_letter',
    clinical_discharge: 'discharge',
    patient_discharge: 'discharge',
    gp_summary: 'consultation',
    insurance: 'other',
    sick_cert: 'other',
  };

  function printLetter() {
    const label = LETTER_TYPES.find(l => l.id === letterType)?.label ?? 'Letter';
    const dateStr = new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/St_Lucia',
    });
    const safe = output.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const patientRef = [
      patientName,
      dob ? `DOB: ${dob}` : '',
      nhiNumber ? `NHI: ${nhiNumber}` : '',
    ].filter(Boolean).join(' · ');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>${label} — ${patientName || 'Patient'}</title>
    <style>
      body{font-family:Georgia,"Times New Roman",serif;max-width:700px;margin:40px auto;font-size:13.5px;line-height:1.75;color:#1e293b}
      .hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0d2520;padding-bottom:16px;margin-bottom:20px}
      .org{font-size:18px;font-weight:700;color:#0d2520}.org-sub{font-size:13px;color:#1e293b;font-style:italic;margin-top:3px}
      .org-dept{font-size:12px;color:#475569;margin-top:2px}.addr{text-align:right;font-size:11px;color:#475569;line-height:1.7}
      .date{font-size:12px;color:#475569;margin-bottom:8px}
      .pt-ref{font-size:12px;color:#374151;margin-bottom:20px;font-weight:600}
      .body{white-space:pre-wrap}
      .sig{margin-top:40px;padding-top:16px;border-top:1px solid #e2e8f0}
      .sig-name{font-size:13px;font-weight:600;color:#0d2520}.sig-role{font-size:12px;color:#475569}
      @media print{body{margin:24px;max-width:100%}}
    </style></head><body>
    <div class="hd">
      <div>
        <div class="org">Amise Medical Services</div>
        <div class="org-sub">Dr Dawit Daniel Kabiye, MD, DM</div>
        <div class="org-dept">General &amp; Endoscopic Surgery</div>
      </div>
      <div class="addr">
        <div>Rodney Bay, Providence Building</div><div>Tapion Hospital (ERCP / Surgery)</div>
        <div>Saint Lucia, W.I.</div>
        <div style="margin-top:4px">Tel: +1 (758) 284-0557</div><div>+1 (758) 720-7111</div>
      </div>
    </div>
    <div class="date">${dateStr}</div>
    ${patientRef ? `<div class="pt-ref">Re: ${patientRef}</div>` : ''}
    <div class="body">${safe}</div>
    <div class="sig">
      <div class="sig-name">Dr Dawit Daniel Kabiye, MD, DM</div>
      <div class="sig-role">Consultant General &amp; Endoscopic Surgeon</div>
      <div class="sig-role">Amise Medical Services, Saint Lucia</div>
      <div class="sig-role" style="margin-top:8px">Date: ______________________</div>
    </div>
    <script>window.onload = () => window.print();</script>
    </body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.open(); w.document.write(html); w.document.close(); }
  }

  async function saveToRecord() {
    if (!patientId || !output) return;
    setSaving(true);
    setError(null);
    try {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const authHeaders: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` } : {};
      const res = await fetch(apiUrl('/api/clinical-notes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          patientId,
          encounterId: encounterId ?? undefined,
          noteType: NOTE_TYPE_MAP[letterType] ?? 'other',
          content: output,
          aiAssisted: true,
          aiModelUsed: 'claude',
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setError(d.error ?? `Failed to save note (HTTP ${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setSaving(false);
    }
  }

  const inp: React.CSSProperties = { fontSize: 13, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none', width: '100%' };

  return (
    <div className="gap-y">
      <CollapsibleCard title="Letter type">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
          {LETTER_TYPES.map(lt => (
            <button key={lt.id} type="button" onClick={() => setLetterType(lt.id)}
              style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: `2px solid ${letterType === lt.id ? '#0f172a' : '#e2e8f0'}`, background: letterType === lt.id ? '#0f172a' : '#fff', cursor: 'pointer' }}>
              <div style={{ fontSize: 18, marginBottom: 3 }}>{lt.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: letterType === lt.id ? '#fff' : '#0f172a' }}>{lt.label}</div>
              <div style={{ fontSize: 11, color: letterType === lt.id ? '#94a3b8' : '#6b7280', marginTop: 2 }}>{lt.hint}</div>
            </button>
          ))}
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Letter details">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>RECIPIENT (NAME / TITLE)</label>
            <input value={recipient} onChange={e => setRecipient(e.target.value)} style={inp} placeholder="Dr Jane Smith / Claims Manager" />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>SPECIALTY / DEPARTMENT</label>
            <input value={specialty} onChange={e => setSpecialty(e.target.value)} style={inp} placeholder="Gastroenterology / HR Department" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>REASON / SPECIFIC FOCUS</label>
            <input value={reason} onChange={e => setReason(e.target.value)} style={inp} placeholder="e.g. Urgent ERCP, fitness for surgery, 2 weeks off work from…" />
          </div>
        </div>
      </CollapsibleCard>

      <button
        type="button"
        onClick={() => void generate()}
        disabled={loading || !patientName}
        style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', background: loading || !patientName ? '#d1d5db' : '#1d4ed8', color: '#fff', fontWeight: 700, fontSize: 14, cursor: loading || !patientName ? 'default' : 'pointer' }}
      >
        {loading ? 'Generating…' : 'Generate letter with AI'}
      </button>

      {!patientName && (
        <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center' }}>Load a patient first to generate a letter.</div>
      )}

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 13, color: '#991b1b' }}>{error}</div>
      )}

      {output && (
        <CollapsibleCard title="Generated letter">
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
            {patientId && (
              <button type="button" onClick={() => void saveToRecord()} disabled={saving || saved}
                style={{ fontSize: 12, padding: '4px 12px', borderRadius: 5, border: '1px solid var(--border,#d1d5db)', background: saved ? '#d1fae5' : 'var(--panel-hd,#0b9b8e)', color: saved ? '#065f46' : '#fff', cursor: saving || saved ? 'default' : 'pointer', fontWeight: 600 }}>
                {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save to record'}
              </button>
            )}
            <button type="button" onClick={() => void copy()}
              style={{ fontSize: 12, padding: '4px 12px', borderRadius: 5, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button type="button"
              onClick={() => {
                const label = LETTER_TYPES.find(l => l.id === letterType)?.label ?? 'Letter';
                const issued = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
                const patientRef = [patientName, dob ? `DOB: ${dob}` : '', nhiNumber ? `NHI: ${nhiNumber}` : ''].filter(Boolean).join(' &middot; ');
                const body = `
                  <div style="border-bottom:2pt solid #0B2545;margin-bottom:12px;padding-bottom:8px">
                    <div style="font-size:15pt;font-weight:700;color:#0B2545">Amise Medical Services</div>
                    <div style="font-size:9pt;color:#6B7280">Dr Dawit Daniel Kabiye, MD, DM &mdash; General &amp; Endoscopic Surgery &mdash; Saint Lucia</div>
                  </div>
                  <p style="font-size:10pt;color:#374151;font-weight:600;margin-bottom:12px">${issued}</p>
                  ${patientRef ? `<p style="font-size:10pt;font-weight:700;color:#0B2545;margin-bottom:16px">Re: ${patientRef}</p>` : ''}
                  <p class="narrative">${output.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}</p>
                  <div class="sig"><div class="sig-line"></div>
                    <p style="font-size:10pt;font-weight:700;color:#1A1A1A;margin-top:4px">Dr Dawit Daniel Kabiye, MD, DM</p>
                    <p style="font-size:9pt;color:#6B7280">Consultant General &amp; Endoscopic Surgeon</p>
                    <p style="font-size:9pt;color:#6B7280">Date: ______________________</p>
                  </div>
                  <div class="footer">Amise Medical Services &middot; Saint Lucia &middot; ${issued} &middot; AI-Assisted Draft &mdash; Reviewed, Approved &amp; Signed by Clinician</div>`;
                const fname = `${(patientName || 'Patient').replace(/\s+/g, '_')}_${label.replace(/[\s/]+/g, '_')}_${new Date().toISOString().slice(0, 10)}`;
                downloadAsWord(body, fname, `${label} — ${patientName || 'Patient'}`);
              }}
              style={{ fontSize: 12, padding: '4px 12px', borderRadius: 5, border: '1px solid #2563eb', background: '#eff6ff', color: '#1d4ed8', cursor: 'pointer', fontWeight: 700 }}>
              📄 Word
            </button>
            <button type="button" onClick={printLetter}
              style={{ fontSize: 12, padding: '4px 12px', borderRadius: 5, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              🖨 Print
            </button>
          </div>

          {/* Letterhead */}
          <div id="letter-print-area" style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
            padding: '28px 32px', fontFamily: 'Georgia, "Times New Roman", serif',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0d2520', paddingBottom: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#0d2520', letterSpacing: '-0.01em' }}>
                  Amise Medical Services
                </div>
                <div style={{ fontSize: 13, color: '#1e293b', marginTop: 3, fontStyle: 'italic' }}>
                  Dr Dawit Daniel Kabiye, MD, DM
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                  General &amp; Endoscopic Surgery
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 11, color: '#475569', lineHeight: 1.7 }}>
                <div>Rodney Bay, Providence Building</div>
                <div>Tapion Hospital (ERCP / Surgery)</div>
                <div>Saint Lucia, W.I.</div>
                <div style={{ marginTop: 4 }}>Tel: +1 (758) 284-0557</div>
                <div>+1 (758) 720-7111</div>
              </div>
            </div>

            {/* Date */}
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>
              {new Date().toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric',
                timeZone: 'America/St_Lucia',
              })}
            </div>

            {/* Patient reference */}
            {(patientName || dob || nhiNumber) && (
              <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, marginBottom: 20 }}>
                Re: {[patientName, dob ? `DOB: ${dob}` : '', nhiNumber ? `NHI: ${nhiNumber}` : ''].filter(Boolean).join(' · ')}
              </div>
            )}

            {/* Body — editable */}
            <textarea
              value={output}
              onChange={e => setOutput(e.target.value)}
              spellCheck
              style={{
                width: '100%', fontSize: 13.5, lineHeight: 1.75, color: '#1e293b',
                fontFamily: 'Georgia, "Times New Roman", serif',
                border: 'none', outline: 'none', resize: 'vertical',
                background: 'transparent', padding: 0,
                minHeight: Math.max(200, output.split('\n').length * 26),
              }}
            />

            {/* Signature block */}
            <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0d2520' }}>Dr Dawit Daniel Kabiye, MD, DM</div>
              <div style={{ fontSize: 12, color: '#475569' }}>Consultant General &amp; Endoscopic Surgeon</div>
              <div style={{ fontSize: 12, color: '#475569' }}>Amise Medical Services, Saint Lucia</div>
            </div>
          </div>

        </CollapsibleCard>
      )}
    </div>
  );
}
