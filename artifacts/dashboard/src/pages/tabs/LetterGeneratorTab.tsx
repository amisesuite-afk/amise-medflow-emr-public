import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import { getApiOrigin } from '@/lib/api-origin';

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
    patientName, age, sex, dob, phone,
    comorbidities, pmhNotes, medications, medicationsText, allergies,
    assessment, differentials, plan, icdCodes,
    hpiNotes, freeText,
    surgicalHistory,
  } = useAppContext();

  const [letterType, setLetterType] = useState<LetterType>('referral');
  const [recipient, setRecipient] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [reason, setReason] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true); setError(null); setOutput('');
    try {
      const context = {
        letterType,
        recipient, specialty, reason,
        patient: { name: patientName, age, sex, dob, phone },
        pmh: comorbidities,
        pmhNotes,
        surgicalHistory,
        medications: [...medications, ...medicationsText.split('\n').filter(Boolean)],
        allergies,
        hpi: hpiNotes || freeText,
        assessment,
        differentials,
        plan,
        icdCodes,
      };

      const res = await fetch(apiUrl('/api/generate-letter'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
            <button type="button" onClick={() => void copy()}
              style={{ fontSize: 12, padding: '4px 12px', borderRadius: 5, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button type="button" onClick={() => window.print()}
              style={{ fontSize: 12, padding: '4px 12px', borderRadius: 5, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              Print
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
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 20 }}>
              {new Date().toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric',
                timeZone: 'America/St_Lucia',
              })}
            </div>

            {/* Body */}
            <div style={{ fontSize: 13.5, lineHeight: 1.75, color: '#1e293b', whiteSpace: 'pre-wrap' }}>
              {output}
            </div>

            {/* Signature block */}
            <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0d2520' }}>Dr Dawit Daniel Kabiye, MD, DM</div>
              <div style={{ fontSize: 12, color: '#475569' }}>Consultant General &amp; Endoscopic Surgeon</div>
              <div style={{ fontSize: 12, color: '#475569' }}>Amise Medical Services, Saint Lucia</div>
            </div>
          </div>

          {/* Print styles */}
          <style>{`
            @media print {
              body > *:not(#letter-print-area) { display: none !important; }
              #letter-print-area {
                position: fixed; top: 0; left: 0; width: 100%;
                border: none !important; padding: 32px 48px !important;
              }
            }
          `}</style>
        </CollapsibleCard>
      )}
    </div>
  );
}
