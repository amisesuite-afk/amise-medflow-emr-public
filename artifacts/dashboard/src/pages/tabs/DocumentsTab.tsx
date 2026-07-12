import { useState, useEffect, useRef } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import CollapsibleCard from '@/components/CollapsibleCard';

interface DocumentRow {
  id: string;
  patient_id: string;
  encounter_id: string | null;
  document_type: string;
  original_filename: string;
  storage_path: string;
  mime_type: string;
  uploaded_by: string;
  description: string | null;
  created_at: string;
}

interface FileUploadState {
  file: File;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

const DOCUMENT_TYPES = [
  'Referral Letter',
  'Operative Note',
  'Discharge Summary',
  'Lab Report',
  'Imaging Report',
  'Pathology Report',
  'Consent Form',
  'Insurance Document',
  'Clinic Letter',
  'Other',
];

export default function DocumentsTab() {
  const { documents, setDocuments, patientId, encounterId } = useAppContext();
  const { session, profile } = useAuth();

  const userId = session?.user?.id ?? profile?.id ?? null;

  const [docList, setDocList] = useState<DocumentRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selectedType, setSelectedType] = useState(DOCUMENT_TYPES[0]);
  const [description, setDescription] = useState('');
  const [uploadStates, setUploadStates] = useState<FileUploadState[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function fetchDocuments() {
    if (!patientId || !supabase) return;
    setListLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    setListLoading(false);
    if (!error && data) setDocList(data as DocumentRow[]);
  }

  useEffect(() => {
    void fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  async function handleFiles(files: FileList) {
    if (!patientId || !supabase || !userId) return;

    const newStates: FileUploadState[] = Array.from(files).map(f => ({
      file: f,
      status: 'uploading' as const,
    }));
    setUploadStates(prev => [...prev, ...newStates]);

    // Capture description at time of upload
    const uploadDescription = description || null;
    const uploadType = selectedType;

    await Promise.all(
      newStates.map(async (state) => {
        const file = state.file;
        const path = `${patientId}/${Date.now()}-${file.name}`;

        const { error: uploadErr } = await supabase!.storage
          .from('patient-documents')
          .upload(path, file);

        if (uploadErr) {
          setUploadStates(prev =>
            prev.map(s =>
              s.file === file ? { ...s, status: 'error', error: uploadErr.message } : s
            )
          );
          return;
        }

        const { error: insertErr } = await supabase!.from('documents').insert({
          patient_id: patientId,
          encounter_id: encounterId ?? null,
          document_type: uploadType,
          original_filename: file.name,
          storage_path: path,
          mime_type: file.type,
          uploaded_by: userId,
          description: uploadDescription,
        });

        if (insertErr) {
          setUploadStates(prev =>
            prev.map(s =>
              s.file === file ? { ...s, status: 'error', error: insertErr.message } : s
            )
          );
          return;
        }

        setUploadStates(prev =>
          prev.map(s => s.file === file ? { ...s, status: 'done' } : s)
        );
      })
    );

    await fetchDocuments();
  }

  async function handleDownload(storagePath: string, filename: string) {
    if (!supabase) return;
    const { data, error } = await supabase.storage
      .from('patient-documents')
      .createSignedUrl(storagePath, 3600);
    if (error || !data?.signedUrl) {
      alert('Could not generate download link.');
      return;
    }
    const a = document.createElement('a');
    a.href = data.signedUrl;
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
                {DOCUMENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>

              <label>Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description of this document"
              />

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                <button
                  className="btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose file(s)
                </button>
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

            {/* Per-file upload statuses */}
            {uploadStates.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {uploadStates.map((s, i) => (
                  <div
                    key={i}
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
                        Error: {s.error}
                      </span>
                    )}
                    <span style={{ opacity: 0.8 }}>{s.file.name}</span>
                  </div>
                ))}
                {uploadStates.some(s => s.status === 'done') && (
                  <button
                    className="btn-ghost"
                    style={{ alignSelf: 'flex-start', marginTop: '0.25rem', fontSize: '0.85em' }}
                    onClick={() => setUploadStates(prev => prev.filter(s => s.status !== 'done'))}
                  >
                    Clear completed
                  </button>
                )}
              </div>
            )}

            {/* Document list */}
            {listLoading ? (
              <div style={{ opacity: 0.6, fontSize: '0.9em' }}>Loading documents...</div>
            ) : docList.length === 0 ? (
              <div style={{ opacity: 0.6, fontSize: '0.9em' }}>No documents uploaded yet.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border, #e5e7eb)', textAlign: 'left' }}>
                      <th style={{ padding: '0.4rem 0.5rem' }}>Type</th>
                      <th style={{ padding: '0.4rem 0.5rem' }}>Filename</th>
                      <th style={{ padding: '0.4rem 0.5rem' }}>Description</th>
                      <th style={{ padding: '0.4rem 0.5rem' }}>Uploaded</th>
                      <th style={{ padding: '0.4rem 0.5rem' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {docList.map(doc => (
                      <tr
                        key={doc.id}
                        style={{ borderBottom: '1px solid var(--color-border, #e5e7eb)' }}
                      >
                        <td style={{ padding: '0.4rem 0.5rem', whiteSpace: 'nowrap' }}>
                          {doc.document_type}
                        </td>
                        <td
                          style={{
                            padding: '0.4rem 0.5rem',
                            maxWidth: '180px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={doc.original_filename}
                        >
                          {doc.original_filename}
                        </td>
                        <td
                          style={{
                            padding: '0.4rem 0.5rem',
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={doc.description ?? undefined}
                        >
                          {doc.description ?? '—'}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', whiteSpace: 'nowrap' }}>
                          {formatDate(doc.created_at)}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          <button
                            className="btn-ghost"
                            style={{ fontSize: '0.85em' }}
                            onClick={() => void handleDownload(doc.storage_path, doc.original_filename)}
                          >
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
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
