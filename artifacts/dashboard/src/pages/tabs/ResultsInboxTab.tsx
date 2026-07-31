import { useState, useEffect, useCallback, useRef } from 'react';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import DocumentCapture from '@/components/DocumentCapture';

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
  patient_notified_at?: string | null;
  patient_notified_by?: string | null;
  notification_method?: string | null;
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
  patient_notified_at?: string | null;
  patient_notified_by?: string | null;
  notification_method?: string | null;
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
  patientName?: string | null;
  reportDate?: string | null;
  urgency?: 'urgent' | 'routine' | null;
  extractedFacts?: ExtractedFact[];
  suggestedPatientId?: string | null;
  suggestedPatientName?: string | null;
  suggestedPatientMrn?: string | null;
}

interface ReceivedDoc {
  id: string;
  title: string;
  document_type: string;
  mime_type: string | null;
  storage_path: string | null;
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
  if (ids.length === 0) return new Map();
  try {
    const res = await fetch(
      apiUrl(`/api/patients/names?ids=${ids.map(encodeURIComponent).join(',')}`),
      { headers: await staffAuthHeaders() },
    );
    if (!res.ok) return new Map();
    const body = await res.json() as { names?: Record<string, string> };
    return new Map(Object.entries(body.names ?? {}));
  } catch {
    return new Map();
  }
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

// ─── Notify patient section ───────────────────────────────────────────────────

const NOTIFY_METHODS = [
  { value: 'phone',      label: 'Phone call' },
  { value: 'sms',        label: 'SMS' },
  { value: 'whatsapp',   label: 'WhatsApp' },
  { value: 'in_person',  label: 'In person' },
  { value: 'letter',     label: 'Letter' },
];

function NotifyPatientSection({
  notifiedAt,
  notifiedBy,
  method,
  saving,
  onNotify,
}: {
  notifiedAt?: string | null;
  notifiedBy?: string | null;
  method?: string | null;
  saving: boolean;
  onNotify: (method: string) => void;
}) {
  const [selectedMethod, setSelectedMethod] = useState('phone');

  if (notifiedAt) {
    const methodLabel = NOTIFY_METHODS.find(m => m.value === method)?.label ?? method ?? '';
    return (
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11, fontWeight: 700, color: '#1d4ed8',
          padding: '3px 8px', borderRadius: 4,
          background: '#dbeafe', border: '1px solid #93c5fd',
          alignSelf: 'flex-start',
        }}>
          ✉ Patient notified{notifiedAt ? ` · ${relTime(notifiedAt)}` : ''}
        </span>
        {methodLabel && (
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>via {methodLabel}</span>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Notify patient via:</span>
      <select
        value={selectedMethod}
        onChange={e => setSelectedMethod(e.target.value)}
        style={{
          fontSize: 11, padding: '3px 7px', borderRadius: 4, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--fg)', cursor: 'pointer',
        }}
      >
        {NOTIFY_METHODS.map(m => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
      <button
        onClick={() => onNotify(selectedMethod)}
        disabled={saving}
        style={{
          fontSize: 11, padding: '3px 11px', borderRadius: 5, cursor: saving ? 'default' : 'pointer',
          border: '1px solid #3b82f6', background: saving ? '#93c5fd' : '#3b82f6',
          color: '#fff', fontWeight: 600,
        }}
      >
        {saving ? '…' : '✉ Mark notified'}
      </button>
    </div>
  );
}

// ─── Lab result card ─────────────────────────────────────────────────────────

function LabCard({
  result, name, reviewing, notifying, onAcknowledge, onNotify,
}: {
  result: LabResult;
  name: string;
  reviewing: boolean;
  notifying: boolean;
  onAcknowledge: (id: string, actionText: string | null) => void;
  onNotify: (id: string, method: string) => void;
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
        <>
          <ReviewedBadge acknowledgedAt={result.acknowledged_at} actionTaken={result.action_taken} />
          <NotifyPatientSection
            notifiedAt={result.patient_notified_at}
            notifiedBy={result.patient_notified_by}
            method={result.notification_method}
            saving={notifying}
            onNotify={method => onNotify(result.id, method)}
          />
        </>
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
  order, name, reviewing, notifying, onAcknowledge, onNotify,
}: {
  order: ImagingOrder;
  name: string;
  reviewing: boolean;
  notifying: boolean;
  onAcknowledge: (id: string, actionText: string | null) => void;
  onNotify: (id: string, method: string) => void;
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
        <>
          <ReviewedBadge acknowledgedAt={order.acknowledged_at} actionTaken={order.action_taken} />
          <NotifyPatientSection
            notifiedAt={order.patient_notified_at}
            notifiedBy={order.patient_notified_by}
            method={order.notification_method}
            saving={notifying}
            onNotify={method => onNotify(order.id, method)}
          />
        </>
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
  { value: 'lab_report',       label: 'Labs' },
  { value: 'imaging_report',   label: 'Imaging' },
  { value: 'endoscopy_report', label: 'Endoscopy report' },
  { value: 'histology_report', label: 'Histology report' },
  { value: 'other',            label: 'Other' },
];

function ManualUploadBar({ onUploaded, onBackfill }: { onUploaded: () => void; onBackfill: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType]     = useState('lab_report');
  const [provider, setProvider]   = useState('');
  const [err, setErr]             = useState<string | null>(null);
  const [ok, setOk]               = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillOk, setBackfillOk]   = useState<{ docs: number; already: number } | null>(null);


  async function triggerBackfill() {
    setBackfilling(true);
    setBackfillOk(null);
    setErr(null);
    try {
      const res = await fetch(apiUrl('/api/cron/email-documents/backfill?days=30'), {
        method: 'POST',
        headers: await staffAuthHeaders(),
      });
      const d = await res.json() as { documentsCreated?: number; alreadyStored?: number; errors?: unknown[]; error?: string };
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setBackfillOk({ docs: d.documentsCreated ?? 0, already: d.alreadyStored ?? 0 });
      setTimeout(() => { setBackfillOk(null); onBackfill(); }, 3000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Backfill failed');
    } finally {
      setBackfilling(false);
    }
  }

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
      // file input value is reset inside DocumentCapture after each pick
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Backfill row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', whiteSpace: 'nowrap' }}>Pull from Gmail</span>
        <span style={{ fontSize: 11, color: '#3b82f6', flex: 1 }}>
          {backfillOk
            ? `✓ Found ${backfillOk.docs} new · ${backfillOk.already} already stored`
            : 'Scans amisesuite@gmail.com for lab results from the past 30 days (all senders + dawitson forwards)'}
        </span>
        <button
          onClick={() => void triggerBackfill()}
          disabled={backfilling}
          style={{
            fontSize: 11, fontWeight: 700, padding: '5px 13px', borderRadius: 5, cursor: backfilling ? 'default' : 'pointer',
            border: 'none', background: backfillOk ? '#16a34a' : '#1d4ed8', color: '#fff',
            opacity: backfilling ? 0.7 : 1, whiteSpace: 'nowrap',
          }}
        >
          {backfilling ? 'Scanning…' : backfillOk ? '✓ Done' : '↙ Pull 30 days'}
        </button>
      </div>
      {/* Manual upload row */}
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
        {ok ? (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap' }}>✓ Queued</span>
        ) : uploading ? (
          <span style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>Uploading…</span>
        ) : (
          <DocumentCapture
            onFile={f => void handleFile(f)}
            accept=".pdf,image/jpeg,image/png,image/webp"
            cameraLabel="📷 Photo"
            fileLabel="📁 PDF / file"
            disabled={uploading}
          />
        )}
      </div>
      {err && <div style={{ fontSize: 11, color: '#b91c1c', padding: '4px 8px', background: '#fef2f2', borderRadius: 5 }}>{err}</div>}
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
  const aiName        = doc.ai_extracted_data?.patientName ?? null;
  const aiUrgency     = doc.ai_extracted_data?.urgency ?? 'routine';
  const suggestedId   = doc.ai_extracted_data?.suggestedPatientId ?? null;
  const suggestedName = doc.ai_extracted_data?.suggestedPatientName ?? null;
  const suggestedMrn  = doc.ai_extracted_data?.suggestedPatientMrn ?? null;

  const [showMatch, setShowMatch]   = useState(false);
  const [searchQ, setSearchQ]       = useState('');
  const [results, setResults]       = useState<PatientSearchResult[]>([]);
  const [searching, setSearching]   = useState(false);
  const [matching, setMatching]     = useState(false);
  const [matchErr, setMatchErr]     = useState<string | null>(null);
  const [creating, setCreating]     = useState(false);
  const [createErr, setCreateErr]   = useState<string | null>(null);
  const [urgency, setUrgency]       = useState<'urgent' | 'routine'>(aiUrgency === 'urgent' ? 'urgent' : 'routine');
  const [viewing, setViewing]       = useState(false);
  const [docUrl, setDocUrl]         = useState<string | null>(null);
  const [docMimeType, setDocMimeType] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function handleViewOriginal() {
    if (docUrl) { setDocUrl(null); return; } // toggle off
    setViewing(true);
    try {
      const res = await fetch(apiUrl(`/api/documents/${doc.id}/signed-url`), {
        headers: await staffAuthHeaders(),
      });
      const d = await res.json() as { url?: string; mimeType?: string; error?: string };
      if (!res.ok || !d.url) throw new Error(d.error ?? 'Could not open file');
      setDocUrl(d.url);
      setDocMimeType(d.mimeType ?? null);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not open file');
    } finally {
      setViewing(false);
    }
  }

  // Pre-fill search with AI-extracted patient name when match panel opens
  useEffect(() => {
    if (showMatch && aiName && !searchQ) setSearchQ(aiName);
  }, [showMatch]); // eslint-disable-line react-hooks/exhaustive-deps

  const facts = doc.ai_extracted_data?.extractedFacts ?? [];
  const flags = doc.ai_flags ?? [];

  // Guard: if the AI stored raw JSON as the summary, discard it
  const rawSummary = doc.ai_extracted_data?.documentSummary;
  const summary = (rawSummary && !rawSummary.trimStart().startsWith('{'))
    ? rawSummary
    : null;

  // If the document title itself is raw JSON (old extraction bug), try to salvage it
  const displayTitle = (() => {
    if (summary) return summary;
    const t = doc.title ?? '';
    if (!t.trimStart().startsWith('{')) return t;
    try { return (JSON.parse(t) as { documentSummary?: string }).documentSummary ?? t; } catch { return t; }
  })();

  // Extract provider name from notes
  const providerMatch = doc.notes?.match(/^Received by email from ([^(]+)/);
  const providerLabel = providerMatch ? providerMatch[1].trim() : 'Unknown sender';

  // Extract email subject from notes
  const subjectMatch = doc.notes?.match(/subject: "([^"]+)"/);
  const emailSubject = subjectMatch ? subjectMatch[1] : null;

  const isUnknownSender = doc.notes?.includes('⚠ Unknown sender') ?? false;

  const hasCriticalFlag = flags.some(f => f.severity === 'urgent') || urgency === 'urgent';
  const hasAbnormal     = facts.some(f => f.markedAbnormal);

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

  async function handleCreateAndMatch(name: string) {
    setCreating(true);
    setCreateErr(null);
    try {
      const res = await fetch(apiUrl('/api/admin/patients/quick-create'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ fullName: name }),
      });
      const d = await res.json() as { id?: string; mrn?: string; full_name?: string; error?: string };
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      if (!d.id) throw new Error('No patient ID returned');
      await handleMatch(d.id);
    } catch (e) {
      setCreateErr(e instanceof Error ? e.message : 'Failed to create patient');
    } finally {
      setCreating(false);
    }
  }

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
          {displayTitle}
        </span>

        {/* Urgency toggle badge */}
        <button
          title="Toggle urgency"
          onClick={() => setUrgency(u => u === 'urgent' ? 'routine' : 'urgent')}
          style={{
            fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
            border: 'none',
            background: urgency === 'urgent' ? '#b91c1c' : '#d1d5db',
            color:      urgency === 'urgent' ? '#fff'    : '#374151',
          }}
        >
          {urgency === 'urgent' ? 'URGENT' : 'ROUTINE'}
        </button>

        {hasCriticalFlag && urgency !== 'urgent' && (
          <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 4, background: '#b91c1c', color: '#fff' }}>
            URGENT FLAG
          </span>
        )}
        {!hasCriticalFlag && hasAbnormal && (
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#d97706', color: '#fff' }}>
            ABNORMAL
          </span>
        )}
        <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
          {relTime(doc.created_at)}
        </span>
        {doc.storage_path && (
          <button
            onClick={() => void handleViewOriginal()}
            disabled={viewing}
            title={docUrl ? 'Hide document' : 'Show original document inline'}
            style={{
              fontSize: 11, padding: '2px 9px', borderRadius: 5, cursor: viewing ? 'default' : 'pointer',
              border: `1px solid ${docUrl ? '#374151' : '#6366f1'}`,
              background: docUrl ? '#374151' : 'transparent',
              color: docUrl ? '#fff' : '#6366f1', fontWeight: 600,
              opacity: viewing ? 0.6 : 1, whiteSpace: 'nowrap',
            }}
          >
            {viewing ? 'Loading…' : docUrl ? '✕ Hide' : '📄 View original'}
          </button>
        )}
      </div>

      {/* Source + AI patient hint */}
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>
        <b style={{ color: isUnknownSender ? '#b45309' : '#6366f1' }}>Email from:</b> {providerLabel}
        {isUnknownSender && (
          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}>
            ⚠ Unknown sender
          </span>
        )}
        {emailSubject && <span style={{ color: 'var(--muted)' }}> · {emailSubject}</span>}
        {aiName && (
          <span style={{ marginLeft: 8, color: '#0d9488' }}>
            · <b>Patient (AI):</b> {aiName}
          </span>
        )}
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>

          {suggestedId ? (
            /* Patient found in system — one click to file */
            <button
              onClick={() => void handleMatch(suggestedId)}
              disabled={matching}
              style={{
                fontSize: 11, fontWeight: 700, padding: '5px 13px', borderRadius: 5,
                border: 'none', background: '#16a34a', color: '#fff',
                cursor: matching ? 'default' : 'pointer', opacity: matching ? 0.7 : 1,
              }}
            >
              {matching ? 'Filing…' : `✓ File for ${suggestedName}${suggestedMrn ? ` · ${suggestedMrn}` : ''} →`}
            </button>
          ) : aiName ? (
            /* AI found a name but no existing patient — one click to create + file */
            <button
              onClick={() => void handleCreateAndMatch(aiName)}
              disabled={creating || matching}
              style={{
                fontSize: 11, fontWeight: 700, padding: '5px 13px', borderRadius: 5,
                border: '1.5px dashed #0d9488', background: '#f0fdfa', color: '#0f766e',
                cursor: (creating || matching) ? 'default' : 'pointer', opacity: (creating || matching) ? 0.7 : 1,
              }}
            >
              {creating ? 'Creating…' : `+ Create & file for ${aiName}`}
            </button>
          ) : null}

          {/* Always show manual search option to override AI */}
          <button
            onClick={() => setShowMatch(true)}
            style={{
              fontSize: 11, padding: '4px 11px', borderRadius: 5, cursor: 'pointer', fontWeight: 700,
              border: '1px solid #6366f1',
              background: suggestedId || aiName ? 'transparent' : '#6366f1',
              color:      suggestedId || aiName ? '#6366f1'    : '#fff',
            }}
          >
            {suggestedId ? 'Wrong patient? Search →' : aiName ? 'Search instead →' : 'Match to patient →'}
          </button>

          {(matchErr || createErr) && (
            <div style={{ fontSize: 11, color: '#b91c1c', padding: '3px 8px', background: '#fef2f2', borderRadius: 5 }}>
              {matchErr ?? createErr}
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 6, padding: '10px 11px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)', marginBottom: 7 }}>
            Search for the patient this result belongs to
            {suggestedName && <span style={{ fontWeight: 400, color: '#0d9488', marginLeft: 6 }}>(AI matched: {suggestedName})</span>}
            {!suggestedName && aiName && <span style={{ fontWeight: 400, color: '#0d9488', marginLeft: 6 }}>(AI suggested: {aiName})</span>}
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
          {/* Create & file — shown as soon as a name is typed, whether or not results came back */}
          {!searching && searchQ.trim().length >= 2 && (
            <div style={{ marginBottom: 6 }}>
              {results.length === 0 && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>No existing patients found.</div>
              )}
              <button
                onClick={() => void handleCreateAndMatch(searchQ.trim())}
                disabled={creating || matching}
                style={{
                  fontSize: 11, fontWeight: 700, padding: '5px 13px', borderRadius: 5,
                  border: '1.5px dashed #0d9488', background: '#f0fdfa', color: '#0f766e',
                  cursor: (creating || matching) ? 'default' : 'pointer',
                  opacity: (creating || matching) ? 0.7 : 1,
                }}
              >
                {creating ? 'Creating patient…' : `+ New patient "${searchQ.trim()}" & file`}
              </button>
              {createErr && (
                <div style={{ fontSize: 11, color: '#b91c1c', padding: '4px 8px', background: '#fef2f2', borderRadius: 5, marginTop: 4 }}>
                  {createErr}
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => { setShowMatch(false); setSearchQ(''); setResults([]); setMatchErr(null); setCreateErr(null); }}
            style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, border: '1px solid var(--border)', background: 'none', color: 'var(--muted)', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Inline document viewer */}
      {docUrl && (
        <div style={{ marginTop: 10, borderRadius: 7, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {docMimeType?.startsWith('image/') ? (
            <img
              src={docUrl}
              alt="Original document"
              style={{ display: 'block', width: '100%', maxHeight: 700, objectFit: 'contain', background: '#f8fafc' }}
            />
          ) : (
            <embed
              src={docUrl}
              type="application/pdf"
              style={{ display: 'block', width: '100%', height: 700 }}
            />
          )}
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
  const [notifying, setNotifying]         = useState<Set<string>>(new Set());
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
    setReviewing(s => new Set(s).add(id));
    try {
      const headers = await staffAuthHeaders();
      const res = await fetch(apiUrl(`/api/investigations/review/${id}`), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, actionTaken: actionText }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { acknowledged_at?: string };
      const now = data.acknowledged_at ?? new Date().toISOString();

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

  async function notifyPatient(
    id: string,
    method: string,
    table: 'investigation_results' | 'imaging_orders',
  ) {
    setNotifying(s => new Set(s).add(id));
    try {
      const headers = await staffAuthHeaders();
      const res = await fetch(apiUrl(`/api/investigations/notify-patient/${id}`), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, method }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as { patient_notified_at?: string; notification_method?: string };
      const notifiedAt = data.patient_notified_at ?? new Date().toISOString();

      if (table === 'investigation_results') {
        setLabResults(prev =>
          prev.map(r =>
            r.id === id
              ? { ...r, patient_notified_at: notifiedAt, notification_method: method }
              : r,
          ),
        );
      } else {
        setImagingOrders(prev =>
          prev.map(r =>
            r.id === id
              ? { ...r, patient_notified_at: notifiedAt, notification_method: method }
              : r,
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Notify patient failed');
    } finally {
      setNotifying(s => { const n = new Set(s); n.delete(id); return n; });
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
          <ManualUploadBar onUploaded={() => void load()} onBackfill={() => void load()} />
          {receivedDocs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>
              <div style={{ fontSize: 15, marginBottom: 8 }}>No unmatched reports.</div>
              <div style={{ fontSize: 12 }}>
                Results received via amisesuite@gmail.com appear here automatically (15 min cron).<br />
                Use the upload button above to manually add a scan or photo.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', padding: '4px 2px 8px' }}>
                Match each report to a patient to file it in their record.
              </div>
              {(() => {
                const CATEGORY_ORDER = [
                  { key: 'lab_report',       label: 'Labs' },
                  { key: 'imaging_report',   label: 'Imaging' },
                  { key: 'endoscopy_report', label: 'Endoscopy reports' },
                  { key: 'histology_report', label: 'Histology reports' },
                  { key: 'other',            label: 'Other' },
                ];
                const knownKeys = new Set(CATEGORY_ORDER.map(c => c.key));
                // Docs with an unrecognised type get bucketed into 'other'
                const normalised = receivedDocs.map(d => ({
                  ...d,
                  document_type: knownKeys.has(d.document_type) ? d.document_type : 'other',
                }));
                return CATEGORY_ORDER
                  .map(cat => ({ ...cat, docs: normalised.filter(d => d.document_type === cat.key) }))
                  .filter(cat => cat.docs.length > 0)
                  .map(cat => (
                    <div key={cat.key} style={{ marginBottom: 14 }}>
                      <div style={{
                        fontSize: 10, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase',
                        color: 'var(--muted)', padding: '2px 4px 6px',
                        borderBottom: '1px solid var(--border)', marginBottom: 8,
                      }}>
                        {cat.label} <span style={{ fontWeight: 500, opacity: 0.7 }}>({cat.docs.length})</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {cat.docs.map(d => (
                          <ReceivedDocCard key={d.id} doc={d} onMatched={removeReceivedDoc} />
                        ))}
                      </div>
                    </div>
                  ));
              })()}
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
                notifying={notifying.has(r.id)}
                onAcknowledge={(id, text) => void acknowledge(id, text, 'investigation_results')}
                onNotify={(id, method) => void notifyPatient(id, method, 'investigation_results')}
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
                notifying={notifying.has(r.id)}
                onAcknowledge={(id, text) => void acknowledge(id, text, 'imaging_orders')}
                onNotify={(id, method) => void notifyPatient(id, method, 'imaging_orders')}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
