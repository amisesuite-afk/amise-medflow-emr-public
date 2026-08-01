import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getApiOrigin } from '@/lib/api-origin';
import { supabase } from '@/lib/supabase';
import CollapsibleCard from '@/components/CollapsibleCard';

const API_ORIGIN = getApiOrigin();
function apiUrl(p: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${p}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${p}`;
}

type EndoProcType = 'ogd' | 'colonoscopy' | 'ercp' | 'bronch';

const TYPE_LABELS: Record<EndoProcType, string> = {
  ogd: 'OGD / Gastroscopy',
  colonoscopy: 'Colonoscopy',
  ercp: 'ERCP',
  bronch: 'Bronchoscopy',
};

// Pull the relevant fields from procedureData for each type.
// Handles string[], number, boolean, and nested object arrays (e.g. polyp lists).
function extractFields(type: EndoProcType, procedureData: Record<string, unknown>): Record<string, string> {
  const raw = (procedureData[type] ?? {}) as Record<string, unknown>;
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string' && v.trim()) {
      fields[k] = v;
    } else if (typeof v === 'number') {
      fields[k] = String(v);
    } else if (typeof v === 'boolean') {
      fields[k] = v ? 'Yes' : 'No';
    } else if (Array.isArray(v) && v.length > 0) {
      if (typeof v[0] === 'string') {
        // string[] — checkboxes (cardiacRisk, postopOrders, safetyChecks …)
        fields[k] = (v as string[]).join(', ');
      } else if (typeof v[0] === 'object' && v[0] !== null) {
        // object[] — polyp list, specimen list etc.
        fields[k] = (v as Record<string, unknown>[]).map((item, i) =>
          `[${i + 1}] ` + Object.entries(item)
            .filter(([, val]) => val !== '' && val !== null && val !== undefined)
            .map(([key, val]) => `${key}: ${val}`)
            .join(', ')
        ).join(' | ');
      }
    }
  }
  return fields;
}

export default function EndoscopyReportGenerator({ type }: { type: EndoProcType }) {
  const { patientName, age, sex, dob, procedureData } = useAppContext();
  const [report, setReport] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setGenerating(true);
    setReport('');
    setError(null);
    setCopied(false);

    const fields = extractFields(type, procedureData);
    const today = new Date().toLocaleDateString('en-LC', { timeZone: 'America/St_Lucia', dateStyle: 'long' });

    try {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const authHeaders: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};
      const res = await fetch(apiUrl('/api/generate-endoscopy-report'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          patient: { name: patientName || 'Unknown', age, sex, dob },
          procedureType: type,
          fields,
          date: today,
        }),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response body');

      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setReport(text);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  function copyReport() {
    if (!report) return;
    void navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function printReport() {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Endoscopy Report</title>
      <style>body{font-family:Georgia,serif;font-size:13px;max-width:700px;margin:40px auto;line-height:1.6}
      pre{white-space:pre-wrap;font-family:inherit}</style></head>
      <body><pre>${report.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre></body></html>`);
    w.document.close();
    w.print();
  }

  return (
    <CollapsibleCard title={`${TYPE_LABELS[type]} — AI Report Generator`} defaultOpen={false}>
      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
        Generates a formal endoscopy report from the procedure data entered above.
        Review and amend before adding to the medical record.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          type="button"
          onClick={() => { void generate(); }}
          disabled={generating}
          style={{
            padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: 700,
            background: generating ? '#9ca3af' : '#1e40af', color: '#fff',
            border: 'none', cursor: generating ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? '⏳ Generating…' : '✦ Generate Endoscopy Report'}
        </button>
        {report && (
          <>
            <button type="button" onClick={copyReport}
              style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
            <button type="button" onClick={printReport}
              style={{ padding: '8px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#f1f5f9', color: '#374151', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
              🖨 Print
            </button>
          </>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 7, background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 12, marginBottom: 10 }}>
          {error}
        </div>
      )}

      {report && (
        <div style={{ position: 'relative' }}>
          <textarea
            readOnly
            value={report}
            style={{
              width: '100%', minHeight: 420, fontFamily: 'Georgia, serif', fontSize: 12,
              lineHeight: 1.65, padding: '14px', borderRadius: 8,
              border: '1px solid #e2e8f0', background: '#f8fafc', color: '#1e293b',
              resize: 'vertical', boxSizing: 'border-box',
            }}
          />
          <div style={{ marginTop: 6, fontSize: 11, color: '#9ca3af' }}>
            AI-generated · clinician must review, verify, and sign before filing in the medical record
          </div>
        </div>
      )}
    </CollapsibleCard>
  );
}
