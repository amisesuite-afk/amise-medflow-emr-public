import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import CollapsibleCard from '@/components/CollapsibleCard';
import DocumentCapture from '@/components/DocumentCapture';
import ReportImportPanel from '@/components/report-import/ReportImportPanel';
import {
  uploadPatientDocument, loadPatientDocuments, documentDownloadLink, type PatientDocumentRow,
} from '@/lib/db';
import { UPLOAD_DOCUMENT_TYPES, documentTypeLabel } from '@/lib/document-types';

interface FileUploadState {
  file: File;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

/** The file name to show and download as (current column, then the older one). */
function rowFileName(doc: PatientDocumentRow): string {
  return doc.file_name ?? doc.original_filename ?? doc.title ?? 'document';
}

export default function DocumentsTab() {
  const { documents, setDocuments, patientId, encounterId } = useAppContext();
  const { session, profile } = useAuth();

  const userId = session?.user?.id ?? profile?.id ?? null;

  const [docList, setDocList] = useState<PatientDocumentRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState(UPLOAD_DOCUMENT_TYPES[0].label);
  const [description, setDescription] = useState('');
  const [uploadStates, setUploadStates] = useState<FileUploadState[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The patient whose list is wanted, so a slow load for the previous patient is dropped.
  const listFor = useRef<string | null>(null);
  listFor.current = patientId ?? null;

  async function fetchDocuments() {
    if (!patientId) return;
    const forPatient = patientId;
    setListLoading(true);
    const { rows, error } = await loadPatientDocuments(forPatient);
    if (listFor.current !== forPatient) return;
    setListLoading(false);
    setListError(error);
    if (!error) setDocList(rows);
  }

  useEffect(() => {
    setDocList([]);
    setListError(null);
    setUploadError(null);
    void fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  async function handleFiles(files: FileList) {
    if (!patientId) {
      setUploadError('Open a patient record before uploading documents.');
      return;
    }
    if (!userId) {
      setUploadError('Your session has expired. Sign in again to upload documents.');
      return;
    }
    setUploadError(null);

    const newStates: FileUploadState[] = Array.from(files).map(f => ({
      file: f,
      status: 'uploading' as const,
    }));
    setUploadStates(prev => [...prev, ...newStates]);

    // Capture type and description at time of upload
    const uploadDescription = description || null;
    const uploadType = selectedType;

    await Promise.all(
      newStates.map(async (state) => {
        const file = state.file;
        const { error } = await uploadPatientDocument({
          bucket:      'patient-documents',
          patientId,
          encounterId: encounterId ?? null,
          file,
          type:        uploadType,
          notes:       uploadDescription,
          userId,
        });
        setUploadStates(prev =>
          prev.map(s =>
            s.file !== file ? s
              : error ? { ...s, status: 'error' as const, error }
              : { ...s, status: 'done' as const }
          )
        );
      })
    );

    await fetchDocuments();
  }

  async function handleDownload(storagePath: string | null, filename: string) {
    const url = storagePath ? await documentDownloadLink(storagePath) : null;
    if (!url) {
      alert('Could not generate download link.');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  }

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="gap-y">
      {/* Lab / imaging report PDFs: read and checked against the chart in the browser (no AI).
          Front desk attaches the PDF; nurses and doctors can also save the results. */}
      {patientId && (
        <CollapsibleCard title="Import lab or imaging report" defaultOpen={false}>
          <ReportImportPanel onSaved={() => void fetchDocuments()} />
        </CollapsibleCard>
      )}
      <CollapsibleCard title="Documents and correspondence">
        {!patientId ? (
          <div className="placeholder-tab">
            <span className="ph-icon">📁</span>
            <span className="ph-title">No patient loaded</span>
            <span className="ph-sub">Open a patient record to view and upload documents.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Upload controls */}
            <div className="fld" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label>Document type</label>
              <select value={selectedType} onChange={e => setSelectedType(e.target.value)}>
                {UPLOAD_DOCUMENT_TYPES.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}
              </select>

              <label>Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description of this document"
              />

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                <button
                  className="btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose file(s)
                </button>
                <DocumentCapture
                  onFile={f => {
                    const dt = new DataTransfer();
                    dt.items.add(f);
                    void handleFiles(dt.files);
                  }}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.tiff,.bmp,.heic"
                  cameraLabel="📷 Camera"
                  fileLabel={null}
                />
                <span style={{ fontSize: '0.85em', opacity: 0.7 }}>PDF, image, or Word document</span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.tiff,.bmp,.heic,.txt,.rtf"
                style={{ display: 'none' }}
                onChange={e => {
                  if (e.target.files?.length) {
                    void handleFiles(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
            </div>

            {uploadError && (
              <div role="alert" style={{ color: 'var(--color-danger, #ef4444)', fontSize: '0.88em' }}>
                {uploadError}
              </div>
            )}

            {/* Per-file upload statuses */}
            {uploadStates.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {uploadStates.map((s, i) => (
                  <div
                    key={i}
                    role={s.status === 'error' ? 'alert' : undefined}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88em' }}
                  >
                    {s.status === 'uploading' && (
                      <span style={{ color: 'var(--color-info, #3b82f6)' }}>Uploading...</span>
                    )}
                    {s.status === 'done' && (
                      <span style={{ color: 'var(--color-success, #22c55e)' }}>Done</span>
                    )}
                    {s.status === 'error' && (
                      <span style={{ color: 'var(--color-danger, #ef4444)' }}>
                        {s.error}
                      </span>
                    )}
                    <span style={{ opacity: 0.8 }}>{s.file.name}</span>
                  </div>
                ))}
                {uploadStates.some(s => s.status !== 'uploading') && (
                  <button
                    className="btn-ghost"
                    style={{ alignSelf: 'flex-start', marginTop: '0.25rem', fontSize: '0.85em' }}
                    onClick={() => setUploadStates(prev => prev.filter(s => s.status === 'uploading'))}
                  >
                    Clear finished
                  </button>
                )}
              </div>
            )}

            {/* Document list */}
            {listError && (
              <div role="alert" style={{ color: 'var(--color-danger, #ef4444)', fontSize: '0.88em' }}>
                {listError}{' '}
                <button className="btn-ghost" style={{ fontSize: '0.9em' }} onClick={() => void fetchDocuments()}>
                  Retry
                </button>
              </div>
            )}
            {listLoading ? (
              <div style={{ opacity: 0.6, fontSize: '0.9em' }}>Loading documents...</div>
            ) : listError ? null : docList.length === 0 ? (
              <div style={{ opacity: 0.6, fontSize: '0.9em' }}>No documents uploaded yet.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border, #e5e7eb)', textAlign: 'left' }}>
                      <th style={{ padding: '0.4rem 0.5rem' }}>Type</th>
                      <th style={{ padding: '0.4rem 0.5rem' }}>Title</th>
                      <th style={{ padding: '0.4rem 0.5rem' }}>Description</th>
                      <th style={{ padding: '0.4rem 0.5rem' }}>Uploaded</th>
                      <th style={{ padding: '0.4rem 0.5rem' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {docList.map(doc => {
                      const fileName = rowFileName(doc);
                      const note = doc.notes ?? doc.description ?? null;
                      return (
                        <tr
                          key={doc.id}
                          style={{ borderBottom: '1px solid var(--color-border, #e5e7eb)' }}
                        >
                          <td style={{ padding: '0.4rem 0.5rem', whiteSpace: 'nowrap' }}>
                            {documentTypeLabel(doc.document_type)}
                          </td>
                          <td
                            style={{
                              padding: '0.4rem 0.5rem',
                              maxWidth: '180px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={fileName}
                          >
                            {doc.title || fileName}
                          </td>
                          <td
                            style={{
                              padding: '0.4rem 0.5rem',
                              maxWidth: '200px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={note ?? undefined}
                          >
                            {note ?? '—'}
                          </td>
                          <td style={{ padding: '0.4rem 0.5rem', whiteSpace: 'nowrap' }}>
                            {formatDate(doc.created_at)}
                          </td>
                          <td style={{ padding: '0.4rem 0.5rem' }}>
                            <button
                              className="btn-ghost"
                              style={{ fontSize: '0.85em' }}
                              disabled={!doc.storage_path}
                              onClick={() => void handleDownload(doc.storage_path, fileName)}
                            >
                              Download
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CollapsibleCard>

      <CollapsibleCard title="Clinical letter / discharge summary" defaultOpen={false}>
        <div className="fld">
          <label>Draft letter or discharge summary</label>
          <textarea
            value={documents}
            onChange={e => setDocuments(e.target.value)}
            placeholder="Dear Dr,&#10;&#10;Thank you for referring this patient…"
            style={{ minHeight: 200 }}
          />
        </div>
      </CollapsibleCard>

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
