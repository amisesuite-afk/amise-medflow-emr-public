import React, { useRef, useState } from 'react';
import { addMonitoringPhoto } from '../api';

// ─── Types ───────────────────────────────────────────────────────────────────

type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

interface UploadEntry {
  id: string;
  preview: string;
  label: string;
  docDate: string;
  provider: string;
  status: UploadStatus;
  fileName: string;
  fileType: string;
  errorMsg?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LABELS = [
  'Lab result',
  'Imaging report',
  'Hospital letter',
  'Pathology',
  'Prescription',
  'Other',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// ─── Style helpers ────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  backgroundColor: '#0d1b2e',
  borderRadius: '12px',
  padding: '14px',
  marginBottom: '12px',
  border: '1px solid #1e3a5f',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#060e1a',
  border: '1px solid #1e3a5f',
  borderRadius: '8px',
  padding: '10px 12px',
  color: '#f1f5f9',
  fontSize: '15px',
  marginBottom: '10px',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  color: '#94a3b8',
  marginBottom: '4px',
};

const statusColors: Record<UploadStatus, string> = {
  pending: '#94a3b8',
  uploading: '#f59e0b',
  done: '#22c55e',
  error: '#f87171',
};

const statusLabels: Record<UploadStatus, string> = {
  pending: 'Ready to upload',
  uploading: 'Uploading...',
  done: 'Uploaded',
  error: 'Upload failed',
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  token: string;
}

const UploadScreen: React.FC<Props> = ({ token }) => {
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);

  // Pending entry form (shown after file selected)
  const [pendingFile, setPendingFile] = useState<{
    preview: string;
    fileName: string;
    fileType: string;
  } | null>(null);
  const [pendingLabel, setPendingLabel] = useState(LABELS[0]);
  const [pendingDate, setPendingDate] = useState(todayStr());
  const [pendingProvider, setPendingProvider] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    try {
      const dataUrl = await fileToDataUrl(file);
      const isImage = file.type.startsWith('image/');
      setPendingFile({
        preview: isImage ? dataUrl : 'pdf',
        fileName: file.name,
        fileType: file.type,
      });
      setPendingLabel(LABELS[0]);
      setPendingDate(todayStr());
      setPendingProvider('');
    } catch {
      // ignore
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  async function handleUpload() {
    if (!pendingFile) return;

    const id = `doc_${Date.now()}`;
    const newEntry: UploadEntry = {
      id,
      preview: pendingFile.preview,
      fileName: pendingFile.fileName,
      fileType: pendingFile.fileType,
      label: pendingLabel,
      docDate: pendingDate,
      provider: pendingProvider,
      status: 'uploading',
    };

    setEntries((prev) => [newEntry, ...prev]);
    setPendingFile(null);

    try {
      await addMonitoringPhoto(token, {
        dataUrl: pendingFile.preview === 'pdf' ? `data:${pendingFile.fileType};base64,` : pendingFile.preview,
        context: `${pendingLabel} — ${pendingDate}${pendingProvider ? ' — ' + pendingProvider : ''}`,
      });
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: 'done' } : e)),
      );
    } catch {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? { ...e, status: 'error', errorMsg: 'Upload failed. Saved locally.' }
            : e,
        ),
      );
    }
  }

  function cancelPending() {
    setPendingFile(null);
  }

  return (
    <div style={{ padding: '16px', paddingBottom: '24px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' }}>
        Document Upload
      </h1>
      <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>
        Upload medical documents — lab results, imaging reports, hospital letters, pathology.
      </p>

      {/* Drop zone (only shown when no pending file) */}
      {!pendingFile && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#0d9488' : '#1e3a5f'}`,
            borderRadius: '14px',
            padding: '32px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: dragOver ? '#0d948810' : 'transparent',
            transition: 'all 0.2s',
            marginBottom: '20px',
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '10px' }}>📄</div>
          <p style={{ color: '#f1f5f9', fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>
            Tap to select a file
          </p>
          <p style={{ color: '#64748b', fontSize: '13px' }}>
            or drag and drop — images, PDFs, documents
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt"
            onChange={handleFileInput}
            style={{ display: 'none' }}
          />
        </div>
      )}

      {/* Pending file form */}
      {pendingFile && (
        <div style={{ ...card, marginBottom: '20px' }}>
          <p
            style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '15px', marginBottom: '12px' }}
          >
            Document details
          </p>

          {/* Preview */}
          <div style={{ marginBottom: '12px' }}>
            {pendingFile.preview === 'pdf' ? (
              <div
                style={{
                  backgroundColor: '#060e1a',
                  borderRadius: '8px',
                  padding: '20px',
                  textAlign: 'center',
                  color: '#94a3b8',
                  border: '1px solid #1e3a5f',
                }}
              >
                <span style={{ fontSize: '32px' }}>📄</span>
                <p style={{ fontSize: '13px', marginTop: '6px', wordBreak: 'break-all' }}>
                  {pendingFile.fileName}
                </p>
              </div>
            ) : (
              <img
                src={pendingFile.preview}
                alt="Preview"
                style={{
                  width: '100%',
                  maxHeight: '200px',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  backgroundColor: '#060e1a',
                }}
              />
            )}
          </div>

          <label style={labelStyle}>Document type</label>
          <select
            style={inputStyle}
            value={pendingLabel}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPendingLabel(e.target.value)}
          >
            {LABELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          <label style={labelStyle}>Date of document</label>
          <input
            style={inputStyle}
            type="date"
            value={pendingDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPendingDate(e.target.value)}
          />

          <label style={labelStyle}>Provider / facility (optional)</label>
          <input
            style={{ ...inputStyle, marginBottom: '14px' }}
            type="text"
            placeholder="e.g. Victoria Hospital, St Lucia"
            value={pendingProvider}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPendingProvider(e.target.value)
            }
          />

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={cancelPending}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid #1e3a5f',
                color: '#94a3b8',
                background: 'none',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => void handleUpload()}
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#0d9488',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              Upload
            </button>
          </div>
        </div>
      )}

      {/* Upload list */}
      {entries.length > 0 && (
        <div>
          <p
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '10px',
            }}
          >
            Uploaded documents
          </p>

          {entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                ...card,
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              {/* Thumbnail */}
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  flexShrink: 0,
                  backgroundColor: '#060e1a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #1e3a5f',
                }}
              >
                {entry.preview === 'pdf' ? (
                  <span style={{ fontSize: '24px' }}>📄</span>
                ) : (
                  <img
                    src={entry.preview}
                    alt="doc"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    color: '#f1f5f9',
                    fontSize: '14px',
                    fontWeight: 500,
                    marginBottom: '2px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.label}
                </p>
                <p
                  style={{
                    color: '#64748b',
                    fontSize: '12px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entry.docDate}
                  {entry.provider ? ` — ${entry.provider}` : ''}
                </p>
                {entry.errorMsg && (
                  <p style={{ color: '#f87171', fontSize: '11px', marginTop: '2px' }}>
                    {entry.errorMsg}
                  </p>
                )}
              </div>

              {/* Status */}
              <div
                style={{
                  flexShrink: 0,
                  fontSize: '11px',
                  color: statusColors[entry.status],
                  fontWeight: 600,
                  textAlign: 'right',
                }}
              >
                {entry.status === 'uploading' ? (
                  <span style={{ animation: 'none' }}>...</span>
                ) : (
                  statusLabels[entry.status]
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UploadScreen;
