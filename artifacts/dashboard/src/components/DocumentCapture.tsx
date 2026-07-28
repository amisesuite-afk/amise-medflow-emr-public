import { useRef } from 'react';

interface Props {
  onFile: (file: File) => void;
  accept?: string;
  disabled?: boolean;
  cameraLabel?: string;
  /** Pass null to hide the file-picker button entirely. */
  fileLabel?: string | null;
  style?: React.CSSProperties;
}

/**
 * Two-button file picker: "📷 Camera" opens the device camera directly on
 * mobile (capture="environment"); "📁 File" opens the standard file picker.
 * On desktop both fall back to the file picker — no special handling needed.
 */
export default function DocumentCapture({
  onFile,
  accept = 'image/*,application/pdf',
  disabled = false,
  cameraLabel = '📷 Camera',
  fileLabel = '📁 File' as string | null,
  style,
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

  function pick(ref: React.RefObject<HTMLInputElement | null>) {
    ref.current?.click();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    // Reset so the same file can be re-selected if needed
    e.target.value = '';
  }

  const btnBase: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '6px 14px', borderRadius: 6, border: '1.5px dashed #9ca3af',
    background: '#f9fafb', color: '#374151', fontSize: 12, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ display: 'inline-flex', gap: 6, ...style }}>
      {/* Camera capture — defaults to rear camera on mobile */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleChange}
        disabled={disabled}
      />
      <button type="button" style={btnBase} disabled={disabled} onClick={() => pick(cameraRef)}>
        {cameraLabel}
      </button>

      {/* Standard file picker — PDF / images on desktop (hidden when fileLabel is null) */}
      {fileLabel !== null && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            style={{ display: 'none' }}
            onChange={handleChange}
            disabled={disabled}
          />
          <button type="button" style={btnBase} disabled={disabled} onClick={() => pick(fileRef)}>
            {fileLabel}
          </button>
        </>
      )}
    </div>
  );
}
