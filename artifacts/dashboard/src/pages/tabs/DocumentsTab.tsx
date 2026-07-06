import { useState, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedData {
  patientName: string | null;
  diagnosis: string | null;
  staging: string | null;
  histology: string | null;
  mmrStatus: string | null;
  treatmentSummary: string[];
  currentAssessment: string | null;
  plan: string | null;
  medications: string[];
  investigations: string[];
  surveillancePlan: string[];
  pendingActions: string[];
  keyFlags: string[];
  prognosis: string | null;
  fullText: string;
}

// Which extracted fields the reviewer has accepted
type AcceptedFields = Record<string, boolean>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result as string;
      // Strip the "data:...;base64," prefix — send only the raw base64 data
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function listOrNull(arr: string[] | null | undefined): string[] {
  if (!arr) return [];
  return arr.filter(Boolean);
}

// ─── Proof-reading field ──────────────────────────────────────────────────────

function ProofField({
  label, value, accepted, onToggle, onEdit,
  multiLine = false, highlight = false,
}: {
  label: string;
  value: string | null;
  accepted: boolean;
  onToggle: () => void;
  onEdit: (v: string) => void;
  multiLine?: boolean;
  highlight?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(value ?? '');

  if (!value && !editing) {
    return (
      <div style={{ padding: '8px 12px', borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb', marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</div>
        <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic', marginTop: 3 }}>Not found in document</div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 8, marginBottom: 8,
      background: highlight ? '#fefce8' : accepted ? '#f0fdf4' : '#fff',
      border: `1.5px solid ${highlight ? '#fde047' : accepted ? '#86efac' : '#e5e7eb'}`,
      transition: 'background .15s, border-color .15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
          <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: '#f0f9ff', color: '#0369a1', letterSpacing: '0.04em' }}>AI</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => { setEditing(true); setEditVal(value ?? ''); }}
            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', cursor: 'pointer', fontWeight: 600 }}
          >
            ✎ Edit
          </button>
          <button
            type="button"
            onClick={onToggle}
            style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 5,
              border: `1px solid ${accepted ? '#16a34a' : '#d1d5db'}`,
              background: accepted ? '#dcfce7' : '#f9fafb',
              color: accepted ? '#166534' : '#6b7280',
              cursor: 'pointer', fontWeight: 700,
            }}
          >
            {accepted ? '✓ Accepted' : '○ Accept'}
          </button>
        </div>
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {multiLine ? (
            <textarea
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              style={{ fontSize: 13, padding: '7px 9px', borderRadius: 6, border: '1.5px solid #0d9488', minHeight: 80, resize: 'vertical' }}
              autoFocus
            />
          ) : (
            <input
              type="text"
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              style={{ fontSize: 13, padding: '7px 9px', borderRadius: 6, border: '1.5px solid #0d9488' }}
              autoFocus
            />
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => { onEdit(editVal); setEditing(false); }}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: 'none', background: '#0d9488', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{value}</div>
      )}
    </div>
  );
}

function ListProofField({
  label, items, accepted, onToggle, onEdit,
}: {
  label: string;
  items: string[];
  accepted: boolean;
  onToggle: () => void;
  onEdit: (items: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(items.join('\n'));

  if (items.length === 0) return null;

  return (
    <div style={{
      padding: '10px 12px', borderRadius: 8, marginBottom: 8,
      background: accepted ? '#f0fdf4' : '#fff',
      border: `1.5px solid ${accepted ? '#86efac' : '#e5e7eb'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
          <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3, background: '#f0f9ff', color: '#0369a1' }}>AI</span>
          <span style={{ fontSize: 10, color: '#9ca3af' }}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => { setEditing(true); setEditVal(items.join('\n')); }}
            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', cursor: 'pointer', fontWeight: 600 }}
          >
            ✎ Edit
          </button>
          <button
            type="button"
            onClick={onToggle}
            style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 5,
              border: `1px solid ${accepted ? '#16a34a' : '#d1d5db'}`,
              background: accepted ? '#dcfce7' : '#f9fafb',
              color: accepted ? '#166534' : '#6b7280',
              cursor: 'pointer', fontWeight: 700,
            }}
          >
            {accepted ? '✓ Accepted' : '○ Accept'}
          </button>
        </div>
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>One item per line</div>
          <textarea
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            style={{ fontSize: 13, padding: '7px 9px', borderRadius: 6, border: '1.5px solid #0d9488', minHeight: 80, resize: 'vertical' }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => {
                onEdit(editVal.split('\n').map(s => s.trim()).filter(Boolean));
                setEditing(false);
              }}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: 'none', background: '#0d9488', color: '#fff', cursor: 'pointer', fontWeight: 700 }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, border: '1px solid #d1d5db', background: '#fff', color: '#6b7280', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
          {items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DocumentsTab() {
  const {
    documents, setDocuments,
    assessment, setAssessment,
    plan, setPlan,
    setMedications,
    setHpiNotes,
  } = useAppContext();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // Scan state
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPreview, setScanPreview] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);

  // Editable copies of extracted fields (for inline editing)
  const [editedData, setEditedData] = useState<ExtractedData | null>(null);
  const [accepted, setAccepted] = useState<AcceptedFields>({});
  const [imported, setImported] = useState(false);

  function updateField<K extends keyof ExtractedData>(key: K, val: ExtractedData[K]) {
    setEditedData(prev => prev ? { ...prev, [key]: val } : prev);
  }

  function toggleAccept(key: string) {
    setAccepted(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleFile(file: File) {
    setScanFile(file);
    setScanError(null);
    setExtracted(null);
    setEditedData(null);
    setAccepted({});
    setImported(false);

    // Preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => setScanPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setScanPreview('');
    }
  }

  async function handleScan() {
    if (!scanFile) return;
    setScanning(true);
    setScanError(null);

    try {
      const base64 = await fileToBase64(scanFile);
      const r = await fetch(apiUrl('/api/document-scan'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ imageBase64: base64, mimeType: scanFile.type }),
      });

      if (!r.ok) {
        const d = await r.json() as { error: string };
        setScanError(d.error ?? `Server error ${r.status}`);
        return;
      }

      const { extracted: data } = await r.json() as { extracted: ExtractedData };
      setExtracted(data);
      setEditedData({ ...data });
      // Pre-accept non-empty fields to speed up workflow
      const preAccepted: AcceptedFields = {};
      if (data.diagnosis) preAccepted.diagnosis = false;
      if (data.currentAssessment) preAccepted.currentAssessment = false;
      if (data.plan) preAccepted.plan = false;
      if (data.treatmentSummary?.length) preAccepted.treatmentSummary = false;
      if (data.surveillancePlan?.length) preAccepted.surveillancePlan = false;
      if (data.medications?.length) preAccepted.medications = false;
      setAccepted(preAccepted);
    } catch (err) {
      setScanError(`Network error — check API server is running`);
      console.error('[document-scan]', err);
    } finally {
      setScanning(false);
    }
  }

  function handleAcceptAll() {
    if (!editedData) return;
    const all: AcceptedFields = {};
    if (editedData.diagnosis) all.diagnosis = true;
    if (editedData.staging) all.staging = true;
    if (editedData.histology) all.histology = true;
    if (editedData.mmrStatus) all.mmrStatus = true;
    if (editedData.currentAssessment) all.currentAssessment = true;
    if (editedData.plan) all.plan = true;
    if (editedData.prognosis) all.prognosis = true;
    if (editedData.treatmentSummary?.length) all.treatmentSummary = true;
    if (editedData.surveillancePlan?.length) all.surveillancePlan = true;
    if (editedData.medications?.length) all.medications = true;
    if (editedData.investigations?.length) all.investigations = true;
    if (editedData.pendingActions?.length) all.pendingActions = true;
    setAccepted(all);
  }

  function handleImport() {
    if (!editedData) return;

    // Build a combined assessment string from accepted fields
    const assessmentParts: string[] = [];
    if (accepted.diagnosis && editedData.diagnosis) assessmentParts.push(editedData.diagnosis);
    if (accepted.staging && editedData.staging) assessmentParts.push(`Stage: ${editedData.staging}`);
    if (accepted.histology && editedData.histology) assessmentParts.push(`Histology: ${editedData.histology}`);
    if (accepted.mmrStatus && editedData.mmrStatus) assessmentParts.push(`MMR: ${editedData.mmrStatus}`);
    if (accepted.currentAssessment && editedData.currentAssessment) assessmentParts.push(editedData.currentAssessment);
    if (accepted.prognosis && editedData.prognosis) assessmentParts.push(`Prognosis: ${editedData.prognosis}`);
    if (assessmentParts.length) setAssessment(assessmentParts.join(' · '));

    // Plan
    const planParts: string[] = [];
    if (accepted.plan && editedData.plan) planParts.push(editedData.plan);
    if (accepted.surveillancePlan && editedData.surveillancePlan?.length) {
      planParts.push('Surveillance:\n' + editedData.surveillancePlan.map(s => `• ${s}`).join('\n'));
    }
    if (accepted.pendingActions && editedData.pendingActions?.length) {
      planParts.push('Pending:\n' + editedData.pendingActions.map(s => `• ${s}`).join('\n'));
    }
    if (planParts.length) setPlan(planParts.join('\n\n'));

    // Medications
    if (accepted.medications && editedData.medications?.length) {
      setMedications(editedData.medications);
    }

    // Treatment history → HPI notes
    if (accepted.treatmentSummary && editedData.treatmentSummary?.length) {
      setHpiNotes('Treatment history (imported):\n' + editedData.treatmentSummary.map(s => `• ${s}`).join('\n'));
    }

    // Full text → documents (correspondence / letter draft)
    if (editedData.fullText) {
      setDocuments(editedData.fullText);
    }

    setImported(true);
  }

  const acceptedCount = Object.values(accepted).filter(Boolean).length;
  const data = editedData;

  return (
    <div className="gap-y">

      {/* ── Document Scan & Import ── */}
      <CollapsibleCard title="Document Scan & AI Import" defaultOpen>

        {/* Clinical warning */}
        <div style={{
          background: '#fef9c3', border: '1.5px solid #fde047', borderRadius: 8,
          padding: '10px 14px', fontSize: 12, color: '#713f12',
          lineHeight: 1.6, marginBottom: 14,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠</span>
          <div>
            <strong>Clinician proof-reading required.</strong> All AI-extracted fields must be reviewed and accepted individually before importing to the medical record.
            AI interpretation may miss nuance — verify every field against the original document. Nothing imports without your explicit approval.
          </div>
        </div>

        {/* Upload area */}
        {!extracted && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                border: '2px dashed #0d9488', borderRadius: 12, padding: '28px 24px',
                textAlign: 'center', background: '#f0fdfa', cursor: 'pointer',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>📄</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0d9488' }}>Drop a document here, or click to upload</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>JPEG · PNG · PDF · max 10 MB</div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => cameraRef.current?.click()}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid #0d9488', background: '#f0fdfa', color: '#0d9488', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                📷 Photograph Document
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                📁 Browse Files
              </button>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }} />
          </div>
        )}

        {/* File staged — awaiting scan */}
        {scanFile && !extracted && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: 22 }}>{scanFile.type.startsWith('image/') ? '🖼' : '📄'}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{scanFile.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{(scanFile.size / 1024).toFixed(0)} KB · {scanFile.type}</div>
              </div>
              <button type="button" onClick={() => { setScanFile(null); setScanPreview(''); }}
                style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                Remove
              </button>
            </div>

            {scanPreview && (
              <img src={scanPreview} alt="Document preview" style={{ maxHeight: 200, borderRadius: 8, objectFit: 'contain', border: '1px solid #e5e7eb', alignSelf: 'flex-start' }} />
            )}

            {scanError && (
              <div style={{ padding: '9px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12 }}>
                {scanError}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleScan()}
              disabled={scanning}
              style={{
                padding: '13px 28px', borderRadius: 10, border: 'none',
                background: scanning ? '#9ca3af' : '#0d9488', color: '#fff',
                fontWeight: 800, fontSize: 15, cursor: scanning ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
              }}
            >
              {scanning ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
                  Extracting clinical data…
                </>
              ) : (
                <>🔍 Scan & Extract Clinical Data</>
              )}
            </button>
          </div>
        )}

        {/* ── Proof-reading panel ── */}
        {data && (
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Header strip */}
            <div style={{
              background: '#0f172a', borderRadius: 10, padding: '14px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#0d9488', letterSpacing: '0.08em', textTransform: 'uppercase' }}>AI Extraction Complete</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginTop: 2 }}>
                  {data.patientName ?? 'Patient name not detected'}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  Review and accept each field before importing to the record
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={handleAcceptAll}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #0d9488', background: 'transparent', color: '#5eead4', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Accept All
                </button>
                <button type="button" onClick={() => { setExtracted(null); setEditedData(null); setScanFile(null); setScanPreview(''); setAccepted({}); setImported(false); }}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  ← New Scan
                </button>
              </div>
            </div>

            {/* Key flags — always shown first, not importable */}
            {listOrNull(data.keyFlags).length > 0 && (
              <div style={{ padding: '12px 14px', borderRadius: 8, background: '#fff7ed', border: '2px solid #fed7aa' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#92400e', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                  ⚑ Clinical Flags — Review Required
                </div>
                {listOrNull(data.keyFlags).map((flag, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#7c2d12', marginBottom: 4, display: 'flex', gap: 8 }}>
                    <span style={{ color: '#ea580c', fontWeight: 700, flexShrink: 0 }}>!</span>
                    <span>{flag}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Structured fields */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
                Clinical Fields — Accept to import
              </div>

              <ProofField label="Diagnosis" value={data.diagnosis}
                accepted={!!accepted.diagnosis} onToggle={() => toggleAccept('diagnosis')}
                onEdit={v => updateField('diagnosis', v)} />

              <ProofField label="Staging" value={data.staging}
                accepted={!!accepted.staging} onToggle={() => toggleAccept('staging')}
                onEdit={v => updateField('staging', v)} />

              <ProofField label="Histology" value={data.histology}
                accepted={!!accepted.histology} onToggle={() => toggleAccept('histology')}
                onEdit={v => updateField('histology', v)} />

              <ProofField label="MMR / MSI Status" value={data.mmrStatus}
                accepted={!!accepted.mmrStatus} onToggle={() => toggleAccept('mmrStatus')}
                onEdit={v => updateField('mmrStatus', v)} />

              <ListProofField label="Treatment History (chronological)"
                items={listOrNull(data.treatmentSummary)}
                accepted={!!accepted.treatmentSummary} onToggle={() => toggleAccept('treatmentSummary')}
                onEdit={items => updateField('treatmentSummary', items)} />

              <ProofField label="Current Assessment" value={data.currentAssessment}
                accepted={!!accepted.currentAssessment} onToggle={() => toggleAccept('currentAssessment')}
                onEdit={v => updateField('currentAssessment', v)} multiLine />

              <ProofField label="Management Plan" value={data.plan}
                accepted={!!accepted.plan} onToggle={() => toggleAccept('plan')}
                onEdit={v => updateField('plan', v)} multiLine />

              <ListProofField label="Surveillance Plan"
                items={listOrNull(data.surveillancePlan)}
                accepted={!!accepted.surveillancePlan} onToggle={() => toggleAccept('surveillancePlan')}
                onEdit={items => updateField('surveillancePlan', items)} />

              <ListProofField label="Pending Actions"
                items={listOrNull(data.pendingActions)}
                accepted={!!accepted.pendingActions} onToggle={() => toggleAccept('pendingActions')}
                onEdit={items => updateField('pendingActions', items)} />

              <ListProofField label="Medications"
                items={listOrNull(data.medications)}
                accepted={!!accepted.medications} onToggle={() => toggleAccept('medications')}
                onEdit={items => updateField('medications', items)} />

              <ListProofField label="Investigations / Results"
                items={listOrNull(data.investigations)}
                accepted={!!accepted.investigations} onToggle={() => toggleAccept('investigations')}
                onEdit={items => updateField('investigations', items)} />

              <ProofField label="Prognosis" value={data.prognosis}
                accepted={!!accepted.prognosis} onToggle={() => toggleAccept('prognosis')}
                onEdit={v => updateField('prognosis', v)} multiLine />
            </div>

            {/* Import action */}
            <div style={{
              padding: '14px 18px', borderRadius: 10,
              background: imported ? '#f0fdf4' : '#f8fafc',
              border: `2px solid ${imported ? '#16a34a' : '#0d9488'}`,
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            }}>
              {imported ? (
                <>
                  <div style={{ fontSize: 22 }}>✓</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#166534' }}>Imported to patient record</div>
                    <div style={{ fontSize: 12, color: '#16a34a', marginTop: 2 }}>
                      {acceptedCount} field{acceptedCount !== 1 ? 's' : ''} imported · Full text saved to Documents tab
                    </div>
                  </div>
                  <button type="button" onClick={() => { setExtracted(null); setEditedData(null); setScanFile(null); setScanPreview(''); setAccepted({}); setImported(false); }}
                    style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    Scan Another Document
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                      {acceptedCount} field{acceptedCount !== 1 ? 's' : ''} accepted
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
                      Accepted fields will populate Assessment, Plan, Medications, and History
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={acceptedCount === 0}
                    style={{
                      marginLeft: 'auto', padding: '11px 24px', borderRadius: 9,
                      border: 'none',
                      background: acceptedCount > 0 ? '#0d9488' : '#9ca3af',
                      color: '#fff', fontWeight: 800, fontSize: 14,
                      cursor: acceptedCount > 0 ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Import {acceptedCount > 0 ? `${acceptedCount} Field${acceptedCount !== 1 ? 's' : ''}` : '—'} to Record →
                  </button>
                </>
              )}
            </div>

            {/* Original document preview (collapsed) */}
            {scanPreview && (
              <details style={{ marginTop: 4 }}>
                <summary style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', cursor: 'pointer', padding: '6px 0' }}>
                  View original document image
                </summary>
                <img src={scanPreview} alt="Original document" style={{ marginTop: 8, maxWidth: '100%', borderRadius: 8, border: '1px solid #e5e7eb' }} />
              </details>
            )}
          </div>
        )}
      </CollapsibleCard>

      {/* ── Clinical letter / discharge summary ── */}
      <CollapsibleCard title="Clinical letter / discharge summary" defaultOpen={false}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
          {documents ? 'Content below — manually edited or imported from a scanned document.' : 'Type a draft letter, or scan a document above to auto-populate.'}
        </div>
        <div className="fld">
          <label>Draft letter or discharge summary</label>
          <textarea
            value={documents}
            onChange={e => setDocuments(e.target.value)}
            placeholder="Dear Dr,&#10;&#10;Thank you for referring this patient…"
            style={{ minHeight: 240 }}
          />
        </div>
      </CollapsibleCard>

      {/* ── Linked imaging / results ── */}
      <CollapsibleCard title="Linked imaging / results" defaultOpen={false}>
        <div className="placeholder-tab">
          <span className="ph-icon">🔬</span>
          <span className="ph-title">Results linking</span>
          <span className="ph-sub">Link to external PACS / RIS / LIS in a future integration phase.</span>
        </div>
      </CollapsibleCard>

    </div>
  );
}
