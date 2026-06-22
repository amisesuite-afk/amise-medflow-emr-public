'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getPatientClient } from '@/lib/patient-supabase';
import { API_BASE as API } from '@/lib/constants';

// ─── Constants ────────────────────────────────────────────────────────────────

const TEAL = '#0d9488';
const BUCKET = 'patient-documents';
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXT  = '.pdf, .jpg, .jpeg, .png, .webp';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocFile {
  name: string;       // full storage path
  filename: string;   // display name (trimmed)
  updatedAt: string;
  size: number;
}

interface DocStatus {
  ai_extraction_status: string | null;
  staff_reviewed_at: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: 'Received — queued for review', color: '#92400e', bg: '#fef3c7' },
  processing: { label: 'Received — processing',         color: '#92400e', bg: '#fef3c7' },
  done:       { label: 'Received — reviewed by AI triage', color: '#1e40af', bg: '#dbeafe' },
  skipped:    { label: 'Received',                       color: '#374151', bg: '#f3f4f6' },
  failed:     { label: 'Received',                       color: '#374151', bg: '#f3f4f6' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-LC', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fileIcon(name: string) {
  if (name.endsWith('.pdf')) return '📄';
  if (name.match(/\.(jpg|jpeg|png|webp)$/i)) return '🖼️';
  return '📎';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const router = useRouter();
  const sb = getPatientClient();

  const [authUid, setAuthUid] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocFile[]>([]);
  const [docStatuses, setDocStatuses] = useState<Record<string, DocStatus>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const loadDocs = async (uid: string) => {
    const { data, error } = await sb.storage.from(BUCKET).list(uid, {
      sortBy: { column: 'updated_at', order: 'desc' },
    });
    if (error || !data) return;
    setDocs(data.map(f => ({
      name: `${uid}/${f.name}`,
      filename: f.name.replace(/^\d+_/, ''),  // strip timestamp prefix
      updatedAt: f.updated_at ?? '',
      size: f.metadata?.size ?? 0,
    })));
  };

  // Lets patients see that an uploaded file has actually reached the care
  // team's review queue (and whether AI triage has looked at it yet), rather
  // than only seeing it sit in their own file list with no further signal.
  const loadDocStatuses = async () => {
    const { data, error } = await sb
      .from('documents')
      .select('storage_path, ai_extraction_status, staff_reviewed_at');
    if (error || !data) return;
    const byPath: Record<string, DocStatus> = {};
    for (const row of data) {
      if (row.storage_path) {
        byPath[row.storage_path] = {
          ai_extraction_status: row.ai_extraction_status,
          staff_reviewed_at: row.staff_reviewed_at,
        };
      }
    }
    setDocStatuses(byPath);
  };

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/patient/login'); return; }
      const uid = session.user.id;
      setAuthUid(uid);
      await Promise.all([loadDocs(uid), loadDocStatuses()]);
      setLoading(false);
    })();
  }, [router, sb]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !authUid) return;

    setUploadError(null);

    if (!ALLOWED_MIME.includes(file.type)) {
      setUploadError('Only PDF, JPEG, PNG, and WebP files are accepted.');
      if (fileRef.current) fileRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError('File is too large. Maximum size is 10 MB.');
      if (fileRef.current) fileRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
      return;
    }

    setUploading(true);
    setUploadSuccess(null);
    const ts = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${authUid}/${ts}_${safeName}`;

    const { error } = await sb.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

    if (fileRef.current) fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
    setUploading(false);

    if (error) {
      setUploadError('Upload failed. Please try again.');
      return;
    }

    // Register the file for the clinical pipeline (metadata row + AI triage
    // extraction). Best-effort — the upload itself already succeeded, so a
    // failure here shouldn't block the patient or surface as an error.
    void registerDocument(path, file);

    setUploadSuccess(`"${file.name}" received — your care team will review it.`);
    await loadDocs(authUid);
  }

  async function registerDocument(storagePath: string, file: File) {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) return;
      await fetch(`${API}/api/patient/documents/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          storage_path: storagePath,
          file_name: file.name,
          mime_type: file.type,
          file_size_bytes: file.size,
        }),
      });
    } catch {
      // best-effort — file is already safely in storage
    }
  }

  async function handleDelete(filePath: string) {
    if (!authUid || deletingId) return;
    setDeletingId(filePath);

    await sb.storage.from(BUCKET).remove([filePath]);
    setDocs(prev => prev.filter(d => d.name !== filePath));
    setDeletingId(null);
  }

  async function handleDownload(filePath: string, filename: string) {
    const { data } = await sb.storage.from(BUCKET).download(filePath);
    if (!data) return;
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div style={{ textAlign: 'center', paddingTop: 64, color: '#94a3b8', fontSize: 14 }}>Loading…</div>;
  }

  return (
    <div>
      <style>{`@keyframes amise-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <button type="button" onClick={() => router.push('/patient')} style={{ background: 'none', border: 'none', color: TEAL, fontSize: 20, cursor: 'pointer', padding: 0 }} aria-label="Back">←</button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#1e293b' }}>My Documents</h1>
      </div>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 28, marginTop: 4 }}>
        Upload referral letters, test results, and medical reports for your care team to review.
      </p>

      {/* Upload card */}
      <div style={{ background: '#fff', border: '2px dashed #e2e8f0', borderRadius: 14, padding: '28px 24px', textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>📤</div>
        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
          {uploading ? 'Uploading…' : 'Upload a document'}
        </p>
        <p style={{ margin: '0 0 18px', fontSize: 12, color: '#94a3b8' }}>
          PDF, JPEG, PNG, WebP · Max 10 MB
        </p>
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_EXT}
          onChange={(e) => void handleFileChange(e)}
          disabled={uploading}
          style={{ display: 'none' }}
          id="doc-upload"
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => void handleFileChange(e)}
          disabled={uploading}
          style={{ display: 'none' }}
          id="doc-camera-upload"
        />
        <div style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <label
            htmlFor="doc-upload"
            style={{
              display: 'inline-block',
              padding: '12px 28px',
              background: uploading ? '#99f6e4' : TEAL,
              color: uploading ? '#0f766e' : '#fff',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: uploading ? 'default' : 'pointer',
            }}
          >
            {uploading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'amise-spin 0.8s linear infinite' }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                Uploading…
              </span>
            ) : 'Choose File'}
          </label>
          <label
            htmlFor="doc-camera-upload"
            style={{
              display: 'inline-block',
              padding: '12px 28px',
              background: '#fff',
              color: uploading ? '#94a3b8' : TEAL,
              border: `1.5px solid ${uploading ? '#e2e8f0' : TEAL}`,
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: uploading ? 'default' : 'pointer',
            }}
          >
            📷 Take Photo
          </label>
        </div>

        {uploadError && (
          <p style={{ margin: '14px 0 0', fontSize: 13, color: '#dc2626' }}>{uploadError}</p>
        )}
        {uploadSuccess && (
          <p style={{ margin: '14px 0 0', fontSize: 13, color: '#0d9488' }}>{uploadSuccess}</p>
        )}
      </div>

      {/* File list */}
      {docs.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '24px 20px', color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>
          No documents uploaded yet.
        </div>
      ) : (
        <>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            Uploaded Files
          </p>
          {docs.map(doc => {
            const status = docStatuses[doc.name];
            const badge = status
              ? (status.staff_reviewed_at
                  ? { label: 'Reviewed by care team', color: '#166534', bg: '#dcfce7' }
                  : (STATUS_LABELS[status.ai_extraction_status ?? 'pending'] ?? STATUS_LABELS.pending))
              : null;
            return (
            <div
              key={doc.name}
              style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 }}
            >
              <span style={{ fontSize: 24, flexShrink: 0 }}>{fileIcon(doc.filename)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.filename}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  {fmtSize(doc.size)}{doc.updatedAt ? ` · ${fmtDate(doc.updatedAt)}` : ''}
                </div>
                {badge && (
                  <div style={{ display: 'inline-block', marginTop: 6, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, color: badge.color, background: badge.bg }}>
                    {badge.label}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => void handleDownload(doc.name, doc.filename)}
                  style={{ padding: '7px 14px', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(doc.name)}
                  disabled={deletingId === doc.name}
                  style={{ padding: '7px 14px', background: '#fff', border: '1px solid #fca5a5', borderRadius: 7, fontSize: 12, fontWeight: 600, color: '#dc2626', cursor: deletingId === doc.name ? 'default' : 'pointer', opacity: deletingId === doc.name ? 0.5 : 1 }}
                >
                  {deletingId === doc.name ? '…' : 'Delete'}
                </button>
              </div>
            </div>
            );
          })}
        </>
      )}

      <div style={{ marginTop: 32, padding: '14px 18px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12, color: '#64748b', lineHeight: 1.7 }}>
        Documents are stored securely and are only accessible by you and your care team at Amise Medical Services.
      </div>
    </div>
  );
}
