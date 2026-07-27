import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  return API_ORIGIN ? `${API_ORIGIN}${path}` : path;
}

// ─── API types ───────────────────────────────────────────────────────────────

interface Analyte {
  name: string;
  value: string;
  unit: string;
  ref: string;
  abnormal: boolean;
  critical: boolean;
}

interface LabResult {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  test_name: string;
  test_category: string;
  result_value: string | null;
  analytes: Analyte[] | null;
  is_abnormal: boolean;
  is_critical: boolean;
  status: string;
  reported_at: string | null;
  created_at: string;
  acknowledged_at?: string | null;
  action_taken?: string | null;
}

interface ImagingOrder {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  order_type: string;
  body_area: string | null;
  clinical_indication: string | null;
  urgency: string;
  status: string;
  report_received_at: string | null;
  report_text: string | null;
  radiologist: string | null;
  created_at: string;
  acknowledged_at?: string | null;
  action_taken?: string | null;
}

interface ExtractedFact {
  label: string;
  value: string;
  unit?: string | null;
  referenceRange?: string | null;
  markedAbnormal?: boolean;
}

interface AiFlag {
  type: string;
  label: string;
  severity: 'info' | 'attention' | 'urgent';
  detail?: string;
}

interface AiExtractedData {
  documentSummary?: string;
  reportDate?: string | null;
  extractedFacts?: ExtractedFact[];
}

interface ReceivedDoc {
  id: string;
  title: string;
  document_type: string;
  ai_extracted_data: AiExtractedData | null;
  ai_flags: AiFlag[] | null;
  notes: string | null;
  created_at: string;
  patient_id: string | null;
}

interface PatientSearchResult {
  id: string;
  full_name: string;
  mrn?: string;
  phone?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.floor(ms / 60_000)}m ago`;
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function dateLabel(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const URGENCY_STYLE: Record<string, { bg: string; fg: string; bd: string }> = {
  stat:    { bg: '#fef2f2', fg: '#b91c1c', bd: '#fca5a5' },
  urgent:  { bg: '#fffbeb', fg: '#92400e', bd: '#fcd34d' },
  routine: { bg: '#f1f5f9', fg: '#475569', bd: '#cbd5e1' },
};

const CAT_LABEL: Record<string, string> = {
  haematology: 'Haem', biochemistry: 'Biochem', cardiac: 'Cardiac',
  urine: 'Urine', stool: 'Stool', other: 'Other',
};

// ─── Patient name cache ───────────────────────────────────────────────────────

async function fetchPatientNames(ids: string[]): Promise<Map<string, string>> {
  if (!supabase || ids.length === 0) return new Map();
  const { data } = await supabase
    .from('patients')
    .select('id, full_name')
    .in('id', ids);
  const m = new Map<string, string>();
  for (const r of ((data ?? []) as Array<{ id: string; full_name: string | null }>)) {
    if (r.full_name) m.set(r.id, r.full_name);
  }
  return m;
}

// ─── Acknowledge inline form ──────────────────────────────────────────────────

function AcknowledgeForm({
  saving,
  onConfirm,
  onSkip,
  onCancel,
}: {
  saving: boolean;
  onConfirm: (text: string | null) => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const [actionText, setActionText] = useState('');

  return (
    <div style={{
      marginTop: 8,
      padding: '10px 11px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 7,
    }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5 }}>
        Action taken (optional)
      </label>
      <textarea
        value={actionText}
        onChange={e => setActionText(e.target.value)}
        placeholder="e.g. Contacted patient, GP notified, repeat test ordered…"
        rows={2}
        disabled={saving}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          fontSize: 12,
          padding: '6px 8px',
          borderRadius: 5,
          border: '1px solid var(--border)',
          background: saving ? '#f8fafc' : 'var(--bg, #fff)',
          color: 'var(--fg)',
          resize: 'vertical',
          fontFamily: 'inherit',
          lineHeight: 1.5,
        }}
      />
      <div style={{ display: 'flex', gap: 6, marginTop: 7, alignItems: 'center' }}>
        <button
          onClick={() => onConfirm(actionText.trim() || null)}
          disabled={saving}
          style={{
            fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 5, cursor: saving ? 'default' : 'pointer',
            border: '1px solid #16a34a', background: saving ? '#dcfce7' : '#16a34a', color: '#fff',
          }}
        >
          {saving ? 'Saving…' : 'Confirm'}
        </button>
        <button
          onClick={onSkip}
          disabled={saving}
          style={{
            fontSize: 11, fontWeight: 600, padding: '4px 11px', borderRadius: 5, cursor: saving ? 'default' : 'pointer',
            border: '1px solid #d1d5db', background: 'var(--surface)', color: '#374151',
          }}
        >
          Skip
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          style={{
            fontSize: 11, padding: '4px 8px', borderRadius: 5, cursor: saving ? 'default' : 'pointer',
            border: 'none', background: 'none', color: 'var(--muted)',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Reviewed badge ───────────────────────────────────────────────────────────

function ReviewedBadge({ acknowledgedAt, actionTaken }: { acknowledgedAt?: string | null; actionTaken?: string | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 11, fontWeight: 700, color: '#16a34a',
        padding: '3px 8px', borderRadius: 4,
        background: '#dcfce7', border: '1px solid #86efac',
        alignSelf: 'flex-start',
      }}>
        ✓ Reviewed{acknowledgedAt ? ` · ${relTime(acknowledgedAt)}` : ''}
      </span>
      {actionTaken && (
        <div style={{ fontSize: 11, color: 'var(--muted)', paddingLeft: 2 }}>
          Action: <span style={{ color: 'var(--fg)' }}>{actionTaken}</span>
        </div>
      )}
    </div>
  );
}

// ─── Lab result card ─────────────────────────────────────────────────────────

function LabCard({
  result, name, reviewing, onAcknowledge,
}: {
  result: LabResult;
  name: string;
  reviewing: boolean;
  onAcknowledge: (id: string, actionText: string | null) => void;
}) {
  const [showForm, setShowForm] = useState(false);

  const isReviewed = result.status === 'reviewed' || !!result.acknowledged_at;
  const critBorder = result.is_critical ? '#dc2626' : result.is_abnormal ? '#d97706' : 'var(--border)';
  const critBg     = result.is_critical ? '#fef2f2' : result.is_abnormal ? '#fffbeb' : 'var(--surface)';

  return (
    <div style={{
      border: `1px solid ${critBorder}`,
      borderLeft: `3px solid ${critBorder}`,
      borderRadius: 8,
      background: critBg,
      padding: '11px 13px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg)' }}>{result.test_name}</span>
        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
          {CAT_LABEL[result.test_category] ?? result.test_category}
        </span>
        {result.is_critical && (
          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: '#b91c1c', color: '#fff' }}>
            CRITICAL
          </span>
        )}
        {!result.is_critical && result.is_abnormal && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#d97706', color: '#fff' }}>
            ABNORMAL
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
          {relTime(result.reported_at ?? result.created_at)}
        </span>
      </div>

      {/* Patient + date */}
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>
        <b style={{ color: 'var(--fg)' }}>{name}</b>
        {result.reported_at && ` · ${dateLabel(result.reported_at)}`}
      </div>

      {/* Analytes */}
      {result.analytes && result.analytes.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {result.analytes.map((a, i) => (
            <span key={i} style={{
              fontSize: 11, padding: '2px 7px', borderRadius: 4,
              background: a.critical ? '#fee2e2' : a.abnormal ? '#fef3c7' : 'var(--neu-bg, #f8fafc)',
              color: a.critical ? '#b91c1c' : a.abnormal ? '#92400e' : 'var(--muted)',
              border: `1px solid ${a.critical ? '#fca5a5' : a.abnormal ? '#fcd34d' : '#e2e8f0'}`,
              fontFamily: 'monospace',
            }}>
              {a.name}: <b>{a.value}</b>{a.unit ? ` ${a.unit}` : ''}{a.ref ? ` [${a.ref}]` : ''}{a.critical ? ' ⚠' : a.abnormal ? ' ↑' : ''}
            </span>
          ))}
        </div>
      )}

      {/* Free-text result */}
      {result.result_value && (
        <div style={{ fontSize: 12, color: 'var(--fg)', marginBottom: 6, fontStyle: 'italic' }}>
          {result.result_value}
        </div>
      )}

      {/* Review / acknowledge area */}
      {isReviewed ? (
        <ReviewedBadge acknowledgedAt={result.acknowledged_at} actionTaken={result.action_taken} />
      ) : showForm ? (
        <AcknowledgeForm
          saving={reviewing}
          onConfirm={text => onAcknowledge(result.id, text)}
          onSkip={() => onAcknowledge(result.id, null)}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          style={{
            fontSize: 11, padding: '4px 11px', borderRadius: 5, cursor: 'pointer',
            border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600,
          }}
        >
          ✓ Mark reviewed
        </button>
      )}
    </div>
  );
}

// ─── Imaging order card ───────────────────────────────────────────────────────

function ImagingCard({
  order, name, reviewing, onAcknowledge,
}: {
  order: ImagingOrder;
  name: string;
  reviewing: boolean;
  onAcknowledge: (id: string, actionText: string | null) => void;
}) {
  const urgStyle = URGENCY_STYLE[order.urgency] ?? URGENCY_STYLE.routine;
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const isReviewed = order.status === 'reviewed' || !!order.acknowledged_at;

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${urgStyle.bd}`,
      borderRadius: 8,
      background: 'var(--surface)',
      padding: '11px 13px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg)' }}>{order.order_type}</span>
        {order.body_area && (
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{order.body_area}</span>
        )}
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
          background: urgStyle.bg, color: urgStyle.fg, border: `1px solid ${urgStyle.bd}`,
        }}>
          {order.urgency.toUpperCase()}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
          {relTime(order.report_received_at ?? order.created_at)}
        </span>
      </div>

      {/* Patient + date */}
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>
        <b style={{ color: 'var(--fg)' }}>{name}</b>
        {order.report_received_at && ` · ${dateLabel(order.report_received_at)}`}
        {order.radiologist && ` · ${order.radiologist}`}
      </div>

      {/* Indication */}
      {order.clinical_indication && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>
          Indication: <span style={{ color: 'var(--fg)' }}>{order.clinical_indication}</span>
        </div>
      )}

      {/* Report — collapsible */}
      {order.report_text && (
        <div style={{ marginBottom: 6 }}>
          <button
            onClick={() => setExpanded(x => !x)}
            style={{ fontSize: 11, color: '#1d4ed8', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
          >
            {expanded ? '▲ Hide report' : '▼ Show report'}
          </button>
          {expanded && (
            <pre style={{ marginTop: 6, fontSize: 12, whiteSpace: 'pre-wrap', fontFamily: 'inherit', color: 'var(--fg)', lineHeight: 1.5, background: '#f8fafc', borderRadius: 5, padding: '8px 10px', border: '1px solid #e2e8f0' }}>
              {order.report_text}
            </pre>
          )}
        </div>
      )}

      {/* Review / acknowledge area */}
      {isReviewed ? (
        <ReviewedBadge acknowledgedAt={order.acknowledged_at} actionTaken={order.action_taken} />
      ) : showForm ? (
        <AcknowledgeForm
          saving={reviewing}
          onConfirm={text => onAcknowledge(order.id, text)}
          onSkip={() => onAcknowledge(order.id, null)}
          onCancel={() => setShowForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowForm(true)}
          style={{
            fontSize: 11, padding: '4px 11px', borderRadius: 5, cursor: 'pointer',
            border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600,
          }}
        >
          ✓ Mark reviewed
        </button>
      )}
    </div>
  );
}

// ─── Manual upload bar ───────────────────────────────────────────────────────

const DOC_TYPES = [
  { value: 'lab_report',     label: 'Lab / Path report' },
  { value: 'imaging_report', label: 'Imaging / XR report' },
  { value: 'other',          label: 'Other' },
];

function ManualUploadBar({ onUploaded }: { onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType]     = useState('lab_report');
  const [provider, setProvider]   = useState('');
  const [err, setErr]             = useState<string | null>(null);
  const [ok, setOk]               = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      setErr('File too large (max 20 MB)');
      return;
    }
    setUploading(true);
    setErr(null);
    setOk(false);
    try {
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
        reader.onerror = () => reject(new Error('File read failed'));
      });
      const res = await fetch(apiUrl('/api/investigations/manual-upload-document'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({
          dataBase64: b64,
          mimeType: file.type || 'application/octet-stream',
          fileName: file.name,
          providerName: provider.trim() || undefined,
          documentType: docType,
        }),
      });
      const d = await res.json() as { id?: string; error?: string };
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setOk(true);
      setTimeout(() => { setOk(false); onUploaded(); }, 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9', whiteSpace: 'nowrap' }}>Upload scan / photo</span>
      <select
        value={docType}
        onChange={e => setDocType(e.target.value)}
        style={{ fontSize: 11, padding: '4px 8px', borderRadius: 5, border: '1px solid #c4b5fd', background: '#fff', color: '#374151', cursor: 'pointer' }}
      >
        {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <input
        type="text"
        placeholder="Provider / lab name (optional)"
        value={provider}
        onChange={e => setProvider(e.target.value)}
        style={{ flex: 1, minWidth: 140, fontSize: 11, padding: '4px 8px', borderRadius: 5, border: '1px solid #c4b5fd', outline: 'none', background: '#fff', color: '#374151' }}
      />
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{
          fontSize: 11, fontWeight: 700, padding: '5px 13px', borderRadius: 5, cursor: uploading ? 'default' : 'pointer',
          border: 'none', background: ok ? '#16a34a' : '#6d28d9', color: '#fff',
          opacity: uploading ? 0.7 : 1, whiteSpace: 'nowrap',
        }}
      >
        {uploading ? 'Uploading…' : ok ? '✓ Queued' : '+ Upload'}
      </button>
      {err && <span style={{ fontSize: 11, color: '#b91c1c' }}>{err}</span>}
    </div>
  );
}

// ─── Received-from-email document card ───────────────────────────────────────

function ReceivedDocCard({
  doc,
  onMatched,
}: {
  doc: ReceivedDoc;
  onMatched: (docId: string) => void;
}) {
  const [showMatch, setShowMatch]         = useState(false);
  const [searchQ, setSearchQ]             = useState('');
  const [results, setResults]             = useState<PatientSearchResult[]>([]);
  const [searching, setSearching]         = useState(false);
  const [matching, setMatching]           = useState(false);
  const [matchErr, setMatchErr]           = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const facts = doc.ai_extracted_data?.extractedFacts ?? [];
  const flags = doc.ai_flags ?? [];
  const summary = doc.ai_extracted_data?.documentSummary;

  // Extract provider name from notes
  const providerMatch = doc.notes?.match(/^Received by email from ([^(]+)/);
  const providerLabel = providerMatch ? providerMatch[1].trim() : 'Unknown sender';

  // Extract email subject from notes
  const subjectMatch = doc.notes?.match(/subject: "([^"]+)"/);
  const emailSubject = subjectMatch ? subjectMatch[1] : null;

  const hasCriticalFlag = flags.some(f => f.severity === 'urgent');
  const hasAbnormal = facts.some(f => f.markedAbnormal);

  useEffect(() => {
    if (!showMatch || searchQ.trim().length < 2) { setResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(apiUrl(`/api/patients/search?q=${encodeURIComponent(searchQ.trim())}&limit=8`), {
          headers: await staffAuthHeaders(),
        });
        const d = await res.json() as { patients?: PatientSearchResult[] };
        setResults(d.patients ?? []);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQ, showMatch]);

  async function handleMatch(patientId: string) {
    setMatching(true);
    setMatchErr(null);
    try {
      const res = await fetch(apiUrl(`/api/investigations/received-documents/${doc.id}/match`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ patientId }),
      });
      const d = await res.json() as { id?: string; isCritical?: boolean; error?: string };
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      if (d.isCritical) {
        alert('CRITICAL result filed — this result has been flagged as critical. Please notify the patient and/or clinician immediately.');
      }
      onMatched(doc.id);
    } catch (e) {
      setMatchErr(e instanceof Error ? e.message : 'Match failed');
    } finally {
      setMatching(false);
    }
  }

  const borderColor = hasCriticalFlag ? '#dc2626' : hasAbnormal ? '#d97706' : '#6366f1';
  const bgColor     = hasCriticalFlag ? '#fef2f2' : hasAbnormal ? '#fffbeb' : '#f5f3ff';

  return (
    <div style={{ border: `1px solid ${borderColor}`, borderLeft: `3px solid ${borderColor}`, borderRadius: 8, background: bgColor, padding: '11px 13px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--fg)' }}>
          {summary ?? doc.title}
        </span>
        {hasCriticalFlag && (
          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: '#b91c1c', color: '#fff' }}>
            URGENT FLAG
          </span>
        )}
        {!hasCriticalFlag && hasAbnormal && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#d97706', color: '#fff' }}>
            ABNORMAL
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
          {relTime(doc.created_at)}
        </span>
      </div>

      {/* Source */}
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>
        <b style={{ color: '#6366f1' }}>Email from:</b> {providerLabel}
        {emailSubject && <span style={{ color: 'var(--muted)' }}> · {emailSubject}</span>}
      </div>

      {/* Extracted facts */}
      {facts.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {facts.map((f, i) => (
            <span key={i} style={{
              fontSize: 11, padding: '2px 7px', borderRadius: 4, fontFamily: 'monospace',
              background: f.markedAbnormal ? '#fef3c7' : 'var(--neu-bg, #f8fafc)',
              color: f.markedAbnormal ? '#92400e' : 'var(--muted)',
              border: `1px solid ${f.markedAbnormal ? '#fcd34d' : '#e2e8f0'}`,
            }}>
              {f.label}: <b>{f.value}</b>{f.unit ? ` ${f.unit}` : ''}{f.referenceRange ? ` [${f.referenceRange}]` : ''}{f.markedAbnormal ? ' ↑' : ''}
            </span>
          ))}
        </div>
      )}

      {/* AI flags */}
      {flags.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 6 }}>
          {flags.map((fl, i) => (
            <div key={i} style={{
              fontSize: 11, padding: '4px 8px', borderRadius: 5,
              background: fl.severity === 'urgent' ? '#fee2e2' : fl.severity === 'attention' ? '#fef3c7' : '#f0f9ff',
              color: fl.severity === 'urgent' ? '#b91c1c' : fl.severity === 'attention' ? '#92400e' : '#0369a1',
              border: `1px solid ${fl.severity === 'urgent' ? '#fca5a5' : fl.severity === 'attention' ? '#fcd34d' : '#bae6fd'}`,
            }}>
              <b>{fl.label}:</b> {fl.detail}
            </div>
          ))}
        </div>
      )}

      {/* Match panel */}
      {!showMatch ? (
        <button
          onClick={() => setShowMatch(true)}
          style={{
            fontSize: 11, padding: '4px 11px', borderRadius: 5, cursor: 'pointer',
            border: '1px solid #6366f1', background: '#6366f1', color: '#fff', fontWeight: 700,
          }}
        >
          Match to patient →
        </button>
      ) : (
        <div style={{ marginTop: 6, padding: '10px 11px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)', marginBottom: 7 }}>
            Search for the patient this result belongs to
          </div>
          <input
            type="text"
            placeholder="Type patient name, phone, or MRN…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            autoFocus
            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 12, outline: 'none', marginBottom: 6 }}
          />
          {matchErr && (
            <div style={{ fontSize: 11, color: '#b91c1c', padding: '4px 8px', background: '#fef2f2', borderRadius: 5, marginBottom: 6 }}>
              {matchErr}
            </div>
          )}
          {searching && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Searching…</div>}
          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
              {results.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: '#fff', border: '1px solid var(--border)', borderRadius: 6 }}>
                  <div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)' }}>{p.full_name}</span>
                    {p.mrn && <span style={{ fontSize: 11, color: '#0d9488', marginLeft: 8 }}>{p.mrn}</span>}
                    {p.phone && <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>{p.phone}</span>}
                  </div>
                  <button
                    onClick={() => void handleMatch(p.id)}
                    disabled={matching}
                    style={{
                      fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 5,
                      border: 'none', background: '#6366f1', color: '#fff',
                      cursor: matching ? 'default' : 'pointer', opacity: matching ? 0.7 : 1,
                    }}
                  >
                    {matching ? 'Filing…' : 'File'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {!searching && searchQ.trim().length >= 2 && results.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>No patients found.</div>
          )}
          <button
            onClick={() => { setShowMatch(false); setSearchQ(''); setResults([]); setMatchErr(null); }}
            style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

type TabId = 'labs' | 'imaging' | 'received';
type Filter = 'all' | 'critical';

export default function ResultsInboxTab() {
  const [labResults, setLabResults]       = useState<LabResult[]>([]);
  const [imagingOrders, setImagingOrders] = useState<ImagingOrder[]>([]);
  const [receivedDocs, setReceivedDocs]   = useState<ReceivedDoc[]>([]);
  const [names, setNames]                 = useState<Map<string, string>>(new Map());
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [activeTab, setActiveTab]         = useState<TabId>('labs');
  const [filter, setFilter]               = useState<Filter>('all');
  const [reviewing, setReviewing]         = useState<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await staffAuthHeaders();
      const [pendingRes, receivedRes] = await Promise.all([
        fetch(apiUrl('/api/investigations/pending'), { headers }),
        fetch(apiUrl('/api/investigations/received-documents'), { headers }),
      ]);
      if (!pendingRes.ok) {
        const txt = await pendingRes.text().catch(() => pendingRes.statusText);
        throw new Error(txt || `HTTP ${pendingRes.status}`);
      }
      const body = await pendingRes.json() as { labResults: LabResult[]; imagingOrders: ImagingOrder[] };
      setLabResults(body.labResults ?? []);
      setImagingOrders(body.imagingOrders ?? []);

      if (receivedRes.ok) {
        const recBody = await receivedRes.json() as { documents?: ReceivedDoc[] };
        const docs = (recBody.documents ?? []).map(d => ({
          ...d,
          ai_extracted_data: typeof d.ai_extracted_data === 'string'
            ? JSON.parse(d.ai_extracted_data) as AiExtractedData
            : (d.ai_extracted_data ?? null),
          ai_flags: typeof d.ai_flags === 'string'
            ? JSON.parse(d.ai_flags) as AiFlag[]
            : (d.ai_flags ?? null),
        }));
        setReceivedDocs(docs);
        // Auto-switch to received tab if there are unmatched docs and no pending results
        if (docs.length > 0 && body.labResults.length === 0 && body.imagingOrders.length === 0) {
          setActiveTab('received');
        }
      }

      // Resolve patient names for filed results
      const allIds = [
        ...new Set([
          ...(body.labResults ?? []).map(r => r.patient_id),
          ...(body.imagingOrders ?? []).map(r => r.patient_id),
        ]),
      ];
      const nameMap = await fetchPatientNames(allIds);
      setNames(nameMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pending results');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    timerRef.current = setInterval(() => { void load(); }, 90_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  async function acknowledge(
    id: string,
    actionText: string | null,
    table: 'investigation_results' | 'imaging_orders',
  ) {
    if (!supabase) {
      setError('Supabase client not available');
      return;
    }
    setReviewing(s => new Set(s).add(id));
    try {
      const now = new Date().toISOString();
      const payload: Record<string, unknown> = {
        status: 'reviewed',
        acknowledged_at: now,
      };
      if (actionText !== null) payload.action_taken = actionText;

      const { error: sbErr } = await supabase
        .from(table)
        .update(payload)
        .eq('id', id);

      if (sbErr) throw sbErr;

      // Update local state: mark item as reviewed so the reviewed badge is shown.
      // The item will disappear from the list on the next refresh (90 s) since
      // the pending endpoint no longer returns reviewed results.
      if (table === 'investigation_results') {
        setLabResults(prev =>
          prev.map(r =>
            r.id === id
              ? { ...r, status: 'reviewed', acknowledged_at: now, action_taken: actionText }
              : r,
          ),
        );
      } else {
        setImagingOrders(prev =>
          prev.map(r =>
            r.id === id
              ? { ...r, status: 'reviewed', acknowledged_at: now, action_taken: actionText }
              : r,
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Acknowledge failed');
    } finally {
      setReviewing(s => { const n = new Set(s); n.delete(id); return n; });
    }
  }

  function removeReceivedDoc(docId: string) {
    setReceivedDocs(prev => prev.filter(d => d.id !== docId));
  }

  // Counts exclude already-reviewed items (reviewed in this session)
  const unreviewedLabCount  = labResults.filter(r => r.status !== 'reviewed' && !r.acknowledged_at).length;
  const unreviewedImgCount  = imagingOrders.filter(r => r.status !== 'reviewed' && !r.acknowledged_at).length;
  const criticalLabCount    = labResults.filter(r => r.is_critical && r.status !== 'reviewed' && !r.acknowledged_at).length;
  const receivedCount       = receivedDocs.length;
  const receivedUrgentCount = receivedDocs.filter(d => (d.ai_flags ?? []).some(f => f.severity === 'urgent')).length;

  const filteredLabs = filter === 'critical'
    ? labResults.filter(r => r.is_critical)
    : labResults;

  const filteredImaging = imagingOrders;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--fg)' }}>Results inbox</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>
            Unreviewed results across all patients
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {receivedUrgentCount > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: '#7c3aed', color: '#fff' }}>
              {receivedUrgentCount} urgent email
            </span>
          )}
          {criticalLabCount > 0 && (
            <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 6, background: '#b91c1c', color: '#fff' }}>
              {criticalLabCount} critical
            </span>
          )}
          <button
            onClick={() => void load()}
            disabled={loading}
            style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: loading ? 'default' : 'pointer' }}
          >
            {loading ? '…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 12, color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {/* Tab strip + filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        {([
          { id: 'received' as TabId, label: 'Received', count: receivedCount, accent: '#6366f1', critCount: receivedUrgentCount },
          { id: 'labs'     as TabId, label: 'Lab results', count: unreviewedLabCount, accent: '#0f172a', critCount: criticalLabCount },
          { id: 'imaging'  as TabId, label: 'Imaging', count: unreviewedImgCount, accent: '#0f172a', critCount: 0 },
        ]).map(({ id: t, label, count, accent, critCount }) => {
          const isActive = activeTab === t;
          return (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 6,
                border: isActive ? `1.5px solid ${accent}` : '1px solid var(--border)',
                background: isActive ? accent : 'var(--surface)',
                color: isActive ? '#fff' : 'var(--muted)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {label}
              {count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 800, padding: '1px 5px', borderRadius: 10,
                  background: isActive ? '#fff3' : (critCount > 0 ? (t === 'received' ? '#7c3aed' : '#b91c1c') : '#94a3b8'),
                  color: '#fff',
                  minWidth: 16, textAlign: 'center',
                }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}

        {activeTab === 'labs' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
            {(['all', 'critical'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  fontSize: 11, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
                  border: filter === f ? '1.5px solid #0f172a' : '1px solid var(--border)',
                  background: filter === f ? '#0f172a' : 'var(--surface)',
                  color: filter === f ? '#fff' : 'var(--muted)', fontWeight: 600,
                }}
              >
                {f === 'all' ? 'All' : 'Critical only'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {loading && (unreviewedLabCount + unreviewedImgCount + receivedCount) === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40, fontSize: 13 }}>Loading…</div>
      ) : activeTab === 'received' ? (
        <>
          <ManualUploadBar onUploaded={() => void load()} />
          {receivedDocs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>
              <div style={{ fontSize: 15, marginBottom: 8 }}>No unmatched reports.</div>
              <div style={{ fontSize: 12 }}>
                Results received via amisesuite@gmail.com appear here automatically (15 min cron).<br />
                Use the upload button above to manually add a scan or photo.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', padding: '4px 2px' }}>
                Match each report to a patient to file it in their record.
              </div>
              {receivedDocs.map(d => (
                <ReceivedDocCard
                  key={d.id}
                  doc={d}
                  onMatched={removeReceivedDoc}
                />
              ))}
            </div>
          )}
        </>
      ) : activeTab === 'labs' ? (
        filteredLabs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>
            {filter === 'critical' ? 'No critical results pending.' : 'No unreviewed lab results.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredLabs.map(r => (
              <LabCard
                key={r.id}
                result={r}
                name={names.get(r.patient_id) ?? r.patient_id}
                reviewing={reviewing.has(r.id)}
                onAcknowledge={(id, text) => void acknowledge(id, text, 'investigation_results')}
              />
            ))}
          </div>
        )
      ) : (
        filteredImaging.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)', fontSize: 13 }}>
            No unreviewed imaging reports.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredImaging.map(r => (
              <ImagingCard
                key={r.id}
                order={r}
                name={names.get(r.patient_id) ?? r.patient_id}
                reviewing={reviewing.has(r.id)}
                onAcknowledge={(id, text) => void acknowledge(id, text, 'imaging_orders')}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
