import { useRef, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import CollapsibleCard from '@/components/CollapsibleCard';
import type { ClinicalAttachment } from '@/context/AppContext';

export type { ClinicalAttachment };

const SIZE_WARNING_THRESHOLD = 3_000_000; // ~2.2 MB in base64 chars

function ectNow(): string {
  return new Date().toLocaleString('en-GB', { timeZone: 'America/St_Lucia' });
}

function isPdf(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

type UploadStatus = 'uploading' | 'saved' | 'local';

export default function AttachmentsTab() {
  const { attachments, setAttachments, patientId } = useAppContext();
  const { session } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Per-attachment upload status and storage paths (local state only, not AppContext)
  const [uploadStatusMap, setUploadStatusMap] = useState<Record<string, UploadStatus>>({});
  const [storagePathMap, setStoragePathMap] = useState<Record<string, string>>({});
  const [uploadWarnings, setUploadWarnings] = useState<Record<string, string>>({});

  const totalSize = attachments.reduce((sum, a) => sum + a.dataUrl.length, 0);
  const showSizeWarning = totalSize > SIZE_WARNING_THRESHOLD;

  async function uploadAttachment(
    file: File,
    attachmentId: string,
  ): Promise<void> {
    const userId = session?.user?.id;
    if (!patientId || !userId || !supabase) {
      // No patient context, not authenticated, or Supabase unavailable — keep as local only
      setUploadStatusMap(prev => ({ ...prev, [attachmentId]: 'local' }));
      return;
    }

    const path = `${patientId}/${crypto.randomUUID()}-${file.name}`;
    setUploadStatusMap(prev => ({ ...prev, [attachmentId]: 'uploading' }));

    const { error: storageError } = await supabase.storage
      .from('clinical-attachments')
      .upload(path, file);

    if (storageError) {
      setUploadStatusMap(prev => ({ ...prev, [attachmentId]: 'local' }));
      setUploadWarnings(prev => ({
        ...prev,
        [attachmentId]: `Upload failed: ${storageError.message}`,
      }));
      return;
    }

    // Storage upload succeeded — record the path
    setStoragePathMap(prev => ({ ...prev, [attachmentId]: path }));

    // Insert into documents table
    const { error: dbError } = await supabase.from('documents').insert({
      patient_id: patientId,
      document_type: 'clinical_photo',
      original_filename: file.name,
      storage_path: path,
      mime_type: file.type || 'application/octet-stream',
      uploaded_by: userId,
    });

    if (dbError) {
      // Storage succeeded but DB insert failed — still show saved for storage,
      // but warn about the metadata record
      setUploadStatusMap(prev => ({ ...prev, [attachmentId]: 'saved' }));
      setUploadWarnings(prev => ({
        ...prev,
        [attachmentId]: `File saved to storage but metadata record failed: ${dbError.message}`,
      }));
      return;
    }

    setUploadStatusMap(prev => ({ ...prev, [attachmentId]: 'saved' }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    // Collect all new attachments and append after all FileReaders complete
    const fileList = Array.from(files);
    let pending = fileList.length;
    const newEntries: ClinicalAttachment[] = [];
    const fileMap: Record<string, File> = {};

    fileList.forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string;
        const attachmentId = crypto.randomUUID();
        newEntries.push({
          id: attachmentId,
          name: file.name,
          dataUrl,
          mimeType: file.type || 'application/octet-stream',
          anatomicalArea: '',
          dimensions: '',
          description: '',
          dateAdded: ectNow(),
        });
        fileMap[attachmentId] = file;
        pending -= 1;
        if (pending === 0) {
          setAttachments([...attachments, ...newEntries]);
          // Kick off background uploads after AppContext is updated
          newEntries.forEach(entry => {
            void uploadAttachment(fileMap[entry.id], entry.id);
          });
        }
      };
      reader.readAsDataURL(file);
    });
    // Reset so the same file can be re-added if needed
    e.target.value = '';
  }

  function updateField(id: string, field: keyof ClinicalAttachment, value: string) {
    setAttachments(attachments.map(a => (a.id === id ? { ...a, [field]: value } : a)));
  }

  function removeAttachment(id: string) {
    setAttachments(attachments.filter(a => a.id !== id));
    setUploadStatusMap(prev => { const n = { ...prev }; delete n[id]; return n; });
    setStoragePathMap(prev => { const n = { ...prev }; delete n[id]; return n; });
    setUploadWarnings(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  function renderUploadBadge(id: string) {
    const status = uploadStatusMap[id];
    if (!status || status === 'uploading') {
      return (
        <span style={{
          fontSize: 10,
          color: '#6b7280',
          background: '#f3f4f6',
          borderRadius: 4,
          padding: '1px 6px',
          fontWeight: 500,
          letterSpacing: 0.2,
        }}>
          {status === 'uploading' ? '↑ uploading…' : 'local'}
        </span>
      );
    }
    if (status === 'saved') {
      return (
        <span style={{
          fontSize: 10,
          color: '#16a34a',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 4,
          padding: '1px 6px',
          fontWeight: 500,
          letterSpacing: 0.2,
        }}>
          ☁ saved
        </span>
      );
    }
    // local
    return (
      <span style={{
        fontSize: 10,
        color: '#6b7280',
        background: '#f3f4f6',
        border: '1px solid #e5e7eb',
        borderRadius: 4,
        padding: '1px 6px',
        fontWeight: 500,
        letterSpacing: 0.2,
      }}>
        local
      </span>
    );
  }

  return (
    <div className="gap-y">
      <CollapsibleCard
        title="Clinical Images & File Attachments"
        badge={attachments.length > 0 ? attachments.length : undefined}
      >
        {/* Info note */}
        <div style={{
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: 8,
          padding: '9px 14px',
          fontSize: 12,
          color: '#0369a1',
          marginBottom: 14,
          lineHeight: 1.6,
        }}>
          Clinical images are stored locally in this session and uploaded to secure cloud storage when a patient is selected. They are included in the Final Document and printed clinical notes.
        </div>

        {/* Storage warning */}
        {showSizeWarning && (
          <div style={{
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: 8,
            padding: '8px 14px',
            fontSize: 12,
            color: '#92400e',
            marginBottom: 14,
            lineHeight: 1.6,
          }}>
            ⚠ Large attachments may slow performance. Consider removing old images.
          </div>
        )}

        {/* Attachment grid */}
        {attachments.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 14,
            marginBottom: 16,
          }}>
            {attachments.map(att => (
              <div
                key={att.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  background: '#fafafa',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Preview area */}
                {isPdf(att.mimeType) ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '14px 14px 10px',
                    background: '#f3f4f6',
                    borderBottom: '1px solid #e5e7eb',
                  }}>
                    <span style={{ fontSize: 32 }}>📄</span>
                    <span style={{
                      fontSize: 12,
                      color: '#374151',
                      fontWeight: 500,
                      wordBreak: 'break-all',
                    }}>{att.name}</span>
                  </div>
                ) : (
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    style={{
                      width: '100%',
                      maxHeight: 200,
                      objectFit: 'cover',
                      borderBottom: '1px solid #e5e7eb',
                      display: 'block',
                      borderRadius: '10px 10px 0 0',
                    }}
                  />
                )}

                {/* Fields */}
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Name (for images show truncated, for PDFs already shown above) */}
                  {!isPdf(att.mimeType) && (
                    <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500, wordBreak: 'break-all' }}>
                      {att.name}
                    </div>
                  )}

                  {/* Anatomical area */}
                  <div className="fld" style={{ margin: 0 }}>
                    <label style={{ fontSize: 11, marginBottom: 3 }}>Anatomical area</label>
                    <input
                      type="text"
                      value={att.anatomicalArea}
                      onChange={e => updateField(att.id, 'anatomicalArea', e.target.value)}
                      placeholder="e.g. Right upper quadrant, Left breast"
                      style={{ fontSize: 12 }}
                    />
                  </div>

                  {/* Clinical dimensions */}
                  <div className="fld" style={{ margin: 0 }}>
                    <label style={{ fontSize: 11, marginBottom: 3 }}>
                      Clinical dimensions
                      <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 5 }}>
                        (e.g. 3.2 × 2.1 cm)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={att.dimensions}
                      onChange={e => updateField(att.id, 'dimensions', e.target.value)}
                      placeholder="3.2 × 2.1 cm"
                      style={{ fontSize: 12 }}
                    />
                  </div>

                  {/* Description */}
                  <div className="fld" style={{ margin: 0 }}>
                    <label style={{ fontSize: 11, marginBottom: 3 }}>Description / findings</label>
                    <textarea
                      value={att.description}
                      onChange={e => updateField(att.id, 'description', e.target.value)}
                      placeholder="Clinical observation, lesion characteristics…"
                      rows={2}
                      style={{ fontSize: 12, resize: 'vertical' }}
                    />
                  </div>

                  {/* Upload warning */}
                  {uploadWarnings[att.id] && (
                    <div style={{
                      fontSize: 10,
                      color: '#b45309',
                      background: '#fffbeb',
                      border: '1px solid #fcd34d',
                      borderRadius: 4,
                      padding: '4px 8px',
                      lineHeight: 1.5,
                    }}>
                      ⚠ {uploadWarnings[att.id]}
                    </div>
                  )}

                  {/* Footer row: date + upload badge + delete */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 2,
                    gap: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>
                        Added {att.dateAdded}
                      </span>
                      {renderUploadBadge(att.id)}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(att.id)}
                      title="Remove attachment"
                      style={{
                        background: 'none',
                        border: '1px solid #fca5a5',
                        borderRadius: 6,
                        color: '#dc2626',
                        cursor: 'pointer',
                        fontSize: 13,
                        lineHeight: 1,
                        padding: '3px 8px',
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      × Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Add button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 18px',
            borderRadius: 8,
            border: '1.5px dashed #6b7280',
            background: '#f9fafb',
            color: '#374151',
            fontSize: 13,
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'border-color 0.15s',
          }}
        >
          + Add Image / File
        </button>

        {attachments.length === 0 && (
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 12 }}>
            No attachments yet. Add clinical photographs, wound images, or scanned documents.
          </div>
        )}
      </CollapsibleCard>
    </div>
  );
}
