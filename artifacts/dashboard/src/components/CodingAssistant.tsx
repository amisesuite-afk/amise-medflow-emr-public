import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import CollapsibleCard from '@/components/CollapsibleCard';

const API_ORIGIN = getApiOrigin();
function apiUrl(p: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${p}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${p}`;
}

interface CodeSuggestion {
  code: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
}

interface SuggestResponse {
  icd10: CodeSuggestion[];
  cpt: CodeSuggestion[];
  notes: string;
}

const CONF_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  high:   { bg: '#f0fdf4', text: '#15803d', border: '#86efac' },
  medium: { bg: '#fffbeb', text: '#92400e', border: '#fcd34d' },
  low:    { bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb' },
};

export default function CodingAssistant() {
  const { assessment, plan, procedures, symptoms, age, sex, icdCodes, setIcdCodes, cptCodes, setCptCodes } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function suggest() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/suggest-codes'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ assessment, plan, procedures, symptoms, patientAge: age, patientSex: sex }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      setResult(await res.json() as SuggestResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Suggestion failed');
    } finally {
      setLoading(false);
    }
  }

  function addIcd(s: CodeSuggestion) {
    const entry = `${s.code} — ${s.description}`;
    if (!icdCodes.includes(entry)) setIcdCodes([...icdCodes, entry]);
  }

  function addCpt(s: CodeSuggestion) {
    const entry = `${s.code} — ${s.description}`;
    if (!cptCodes.includes(entry)) setCptCodes([...cptCodes, entry]);
  }

  function CodeRow({ s, onAdd, added }: { s: CodeSuggestion; onAdd: () => void; added: boolean }) {
    const cs = CONF_STYLE[s.confidence] ?? CONF_STYLE.low;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 7, border: `1px solid ${cs.border}`, background: cs.bg, marginBottom: 4 }}>
        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#1e293b', flexShrink: 0 }}>{s.code}</span>
        <span style={{ flex: 1, fontSize: 12, color: '#374151' }}>{s.description}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: cs.text, flexShrink: 0 }}>{s.confidence.toUpperCase()}</span>
        <button
          type="button"
          onClick={onAdd}
          disabled={added}
          style={{
            padding: '3px 10px', borderRadius: 5, fontSize: 11, fontWeight: 700,
            background: added ? '#f0fdf4' : '#1e40af', color: added ? '#15803d' : '#fff',
            border: added ? '1px solid #86efac' : 'none', cursor: added ? 'default' : 'pointer', flexShrink: 0,
          }}
        >
          {added ? '✓ Added' : '+ Add'}
        </button>
      </div>
    );
  }

  return (
    <CollapsibleCard title="Clinical Coding Assistant — ICD-10 / CPT" defaultOpen={false}
      badge={icdCodes.length + cptCodes.length > 0 ? `${icdCodes.length} ICD · ${cptCodes.length} CPT` : undefined}>
      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>
        Suggests diagnosis and procedure codes from the assessment, plan, and procedures entered.
        Click <strong>+ Add</strong> to stage a code — review before submitting a claim.
      </p>

      <button
        type="button"
        onClick={() => { void suggest(); }}
        disabled={loading}
        style={{
          padding: '8px 18px', borderRadius: 7, fontSize: 13, fontWeight: 700,
          background: loading ? '#9ca3af' : '#1e40af', color: '#fff',
          border: 'none', cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 14,
        }}
      >
        {loading ? '⏳ Analysing…' : '✦ Suggest codes'}
      </button>

      {error && (
        <div style={{ padding: '9px 12px', borderRadius: 7, background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontSize: 12, marginBottom: 10 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {result.icd10.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                ICD-10-CM — Diagnoses
              </div>
              {result.icd10.map(s => (
                <CodeRow key={s.code} s={s} onAdd={() => addIcd(s)}
                  added={icdCodes.some(c => c.startsWith(s.code))} />
              ))}
            </div>
          )}

          {result.cpt.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                CPT — Procedure Codes
              </div>
              {result.cpt.map(s => (
                <CodeRow key={s.code} s={s} onAdd={() => addCpt(s)}
                  added={cptCodes.some(c => c.startsWith(s.code))} />
              ))}
            </div>
          )}

          {result.notes && (
            <div style={{ padding: '9px 12px', borderRadius: 7, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, color: '#1e3a8a' }}>
              <strong>Coder's note:</strong> {result.notes}
            </div>
          )}
        </div>
      )}

      {/* Staged codes */}
      {(icdCodes.length > 0 || cptCodes.length > 0) && (
        <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 7, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Staged codes</div>
          {icdCodes.map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span>{c}</span>
              <button type="button" onClick={() => setIcdCodes(icdCodes.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 11 }}>✕</button>
            </div>
          ))}
          {cptCodes.map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#1e40af' }}>CPT {c}</span>
              <button type="button" onClick={() => setCptCodes(cptCodes.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 11 }}>✕</button>
            </div>
          ))}
        </div>
      )}
    </CollapsibleCard>
  );
}
