import { useRef, useState } from 'react';
import { useAppContext, type ExamPhoto } from '@/context/AppContext';

const MAX_PHOTOS = 5;
const MAX_PX = 2000;

const BODY_REGIONS = [
  'Head / Face', 'Neck / Thyroid', 'Chest / Thorax',
  'Breast (L)', 'Breast (R)',
  'Abdomen', 'Groin / Inguinal',
  'Upper limb (L)', 'Upper limb (R)',
  'Lower limb (L)', 'Lower limb (R)',
  'Back / Flank', 'Perineum / Perianal',
  'Wound / Incision', 'Other',
];

const DISTANCE_OPTIONS = [
  { value: '15',  label: '15 cm — macro / close-up detail' },
  { value: '30',  label: '30 cm — lesion with margin' },
  { value: '60',  label: '60 cm — regional view' },
  { value: '120', label: '120 cm — full anatomical region' },
];

function resizeImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > MAX_PX || h > MAX_PX) {
        const ratio = Math.min(MAX_PX / w, MAX_PX / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.90));
    };
    img.src = dataUrl;
  });
}

export default function ExamPhotoPanel() {
  const { examPhotos, setExamPhotos } = useAppContext();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [region, setRegion] = useState(BODY_REGIONS[0]);
  const [distance, setDistance] = useState('30');
  const [desc, setDesc] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = async () => {
      const resized = await resizeImage(reader.result as string);
      const photo: ExamPhoto = {
        id: crypto.randomUUID(),
        dataUrl: resized,
        mimeType: 'image/jpeg',
        bodyRegion: region,
        description: desc,
        distanceCm: distance,
        dateAdded: new Date().toISOString(),
      };
      setExamPhotos(prev => [...prev, photo]);
      setDesc('');
    };
    reader.readAsDataURL(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    e.target.value = '';
  }

  function removePhoto(id: string) {
    setExamPhotos(prev => prev.filter(p => p.id !== id));
    if (preview === id) setPreview(null);
  }

  const atLimit = examPhotos.length >= MAX_PHOTOS;

  return (
    <div>
      {/* Photography guidelines toggle */}
      <button
        type="button"
        onClick={() => setShowGuide(!showGuide)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 12, color: '#0d9488', fontWeight: 600, padding: '4px 0', marginBottom: 8,
        }}
      >
        {showGuide ? '▾ Hide' : '▸ Show'} photography guidelines
      </button>

      {showGuide && (
        <div style={{
          background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 8,
          padding: '12px 16px', marginBottom: 14, fontSize: 12, lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: '#0f766e' }}>
            Medical Photography Standards
          </div>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #99f6e4' }}>
                <th style={{ textAlign: 'left', padding: '2px 8px 4px 0', color: '#0f766e' }}>Distance</th>
                <th style={{ textAlign: 'left', padding: '2px 8px 4px 0', color: '#0f766e' }}>Use</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ padding: '2px 8px 2px 0' }}>15 cm</td><td>Macro — suture detail, skin lesion texture</td></tr>
              <tr><td style={{ padding: '2px 8px 2px 0' }}>30 cm</td><td>Standard — lesion with 5 cm surrounding margin</td></tr>
              <tr><td style={{ padding: '2px 8px 2px 0' }}>60 cm</td><td>Regional — anatomical context (e.g. entire breast)</td></tr>
              <tr><td style={{ padding: '2px 8px 2px 0' }}>120 cm</td><td>Overview — full limb, torso section</td></tr>
            </tbody>
          </table>
          <div style={{ marginTop: 8, color: '#475569' }}>
            <strong>Resolution:</strong> minimum 3000 × 2000 px (6 MP). Use rear camera, not selfie.
          </div>
          <div style={{ color: '#475569' }}>
            <strong>Lighting:</strong> Even, diffuse light. Avoid flash and harsh shadows.
          </div>
          <div style={{ color: '#475569' }}>
            <strong>Colour reference:</strong> Include a white card or ruler beside the lesion when possible.
          </div>
          <div style={{ color: '#475569' }}>
            <strong>Consent:</strong> Obtain verbal or written consent before photographing.
          </div>
        </div>
      )}

      {/* Capture controls */}
      {!atLimit && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end', marginBottom: 12 }}>
          <div style={{ flex: '1 1 140px', minWidth: 120 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 2 }}>Body region</label>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              style={{ width: '100%', fontSize: 13, padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db' }}
            >
              {BODY_REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 140px', minWidth: 120 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 2 }}>Distance</label>
            <select
              value={distance}
              onChange={e => setDistance(e.target.value)}
              style={{ width: '100%', fontSize: 13, padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db' }}
            >
              {DISTANCE_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
          <div style={{ flex: '2 1 200px', minWidth: 140 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 2 }}>Description</label>
            <input
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="e.g. RUQ incision day 3"
              style={{ width: '100%', fontSize: 13, padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: '#0d9488', color: '#fff', border: 'none', cursor: 'pointer',
              }}
            >📷 Capture</button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', cursor: 'pointer',
              }}
            >📁 File</button>
          </div>
        </div>
      )}

      {atLimit && (
        <div style={{ fontSize: 12, color: '#b45309', marginBottom: 10 }}>
          Maximum {MAX_PHOTOS} photos reached. Remove one to add another.
        </div>
      )}

      {/* Photo grid */}
      {examPhotos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {examPhotos.map(photo => (
            <div key={photo.id} style={{
              position: 'relative', borderRadius: 8, overflow: 'hidden',
              border: preview === photo.id ? '2px solid #0d9488' : '1px solid #e2e8f0',
              background: '#f8fafc',
            }}>
              <img
                src={photo.dataUrl}
                alt={photo.bodyRegion}
                onClick={() => setPreview(preview === photo.id ? null : photo.id)}
                style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', cursor: 'pointer', display: 'block' }}
              />
              <div style={{ padding: '6px 8px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {photo.bodyRegion}
                </div>
                <div style={{ fontSize: 10, color: '#64748b' }}>
                  {photo.distanceCm} cm · {new Date(photo.dateAdded).toLocaleDateString('en-LC', { day: 'numeric', month: 'short' })}
                </div>
                {photo.description && (
                  <div style={{ fontSize: 10, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {photo.description}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none',
                  fontSize: 12, cursor: 'pointer', lineHeight: '20px', textAlign: 'center',
                }}
                title="Remove"
              >×</button>
            </div>
          ))}
        </div>
      )}

      {/* Full-size preview */}
      {preview && (() => {
        const photo = examPhotos.find(p => p.id === preview);
        if (!photo) return null;
        return (
          <div style={{
            marginTop: 12, borderRadius: 8, overflow: 'hidden',
            border: '1px solid #e2e8f0', background: '#000',
          }}>
            <img
              src={photo.dataUrl}
              alt={photo.bodyRegion}
              style={{ width: '100%', maxHeight: 500, objectFit: 'contain', display: 'block' }}
            />
            <div style={{ padding: '8px 12px', background: '#1e293b', color: '#e2e8f0', fontSize: 12 }}>
              {photo.bodyRegion} · {photo.distanceCm} cm · {photo.description || 'No description'}
            </div>
          </div>
        );
      })()}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={onFileChange} style={{ display: 'none' }} />
      <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }} />

      {examPhotos.length === 0 && !atLimit && (
        <div style={{ padding: '16px 0', color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>
          No exam photos yet. Use rear camera for best quality (≥ 6 MP).
        </div>
      )}
    </div>
  );
}
