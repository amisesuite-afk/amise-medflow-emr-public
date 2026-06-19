import { useRef } from 'react';
import { useAppContext } from '@/context/AppContext';

const MAX_SIZE = 800;

function resizeImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > MAX_SIZE || h > MAX_SIZE) {
        const ratio = Math.min(MAX_SIZE / w, MAX_SIZE / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = dataUrl;
  });
}

export default function PatientPhotoCapture() {
  const { patientPhoto, setPatientPhoto } = useAppContext();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const resized = await resizeImage(reader.result as string);
      setPatientPhoto(resized);
    };
    reader.readAsDataURL(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    e.target.value = '';
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '4px 0' }}>
      {patientPhoto ? (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img
            src={patientPhoto}
            alt="Patient ID"
            style={{
              width: 80, height: 80, borderRadius: 10, objectFit: 'cover',
              border: '2px solid #e2e8f0',
            }}
          />
          <button
            type="button"
            onClick={() => setPatientPhoto('')}
            style={{
              position: 'absolute', top: -6, right: -6,
              width: 20, height: 20, borderRadius: '50%',
              background: '#ef4444', color: '#fff', border: 'none',
              fontSize: 12, cursor: 'pointer', lineHeight: '20px', textAlign: 'center',
            }}
            title="Remove photo"
          >×</button>
        </div>
      ) : (
        <div style={{
          width: 80, height: 80, borderRadius: 10,
          border: '2px dashed #cbd5e1', background: '#f8fafc',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#94a3b8', fontSize: 28, flexShrink: 0,
        }}>
          👤
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: '#0d9488', color: '#fff', border: 'none', cursor: 'pointer',
            }}
          >📷 Camera</button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', cursor: 'pointer',
            }}
          >📁 Upload</button>
        </div>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          ID / demographic photo · max 800 × 800 px
        </span>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="user" onChange={onFileChange} style={{ display: 'none' }} />
      <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />
    </div>
  );
}
