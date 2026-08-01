import { useRef, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { getApiOrigin } from '@/lib/api-origin';

const API_ORIGIN = getApiOrigin();
function apiUrl(p: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${p}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${p}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProcImage {
  id: string;
  dataUrl: string;   // base64 data URI — stored in procedureData for session persistence
  mimeType: string;
  label: string;     // anatomical site (procedure-specific dropdown)
  finding: string;   // description / impression for this frame
  timestamp: string; // ISO — capture time
}

interface Props {
  images: ProcImage[];
  onChange: (images: ProcImage[]) => void;
  siteLabels?: string[];
  title?: string;
  procType?: string; // ogd | colonoscopy | ercp | bronch | surgical
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

async function filesToImages(files: FileList | null, siteLabels: string[]): Promise<ProcImage[]> {
  if (!files) return [];
  const results: ProcImage[] = [];
  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue;
    const dataUrl = await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target!.result as string);
      reader.readAsDataURL(file);
    });
    results.push({
      id: uid(), dataUrl, mimeType: file.type,
      label: siteLabels[0] ?? '',
      finding: '',
      timestamp: new Date().toISOString(),
    });
  }
  return results;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ProcedureImagePanel({ images, onChange, siteLabels = [], title = 'Endoscopic / Operative Images', procType }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { nhiNumber } = useAppContext();
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    const newImgs = await filesToImages(files, siteLabels);
    onChange([...images, ...newImgs]);
    if (fileRef.current) fileRef.current.value = '';
  }

  function update(id: string, field: 'label' | 'finding', value: string) {
    onChange(images.map(img => img.id === id ? { ...img, [field]: value } : img));
  }

  function remove(id: string) {
    onChange(images.filter(img => img.id !== id));
  }

  async function fetchFromCapture() {
    setFetching(true);
    setFetchMsg(null);
    try {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const authHeaders: Record<string, string> = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {};

      const params = new URLSearchParams();
      if (nhiNumber) params.set('nhi', nhiNumber);
      if (procType) params.set('type', procType);

      const res = await fetch(apiUrl(`/api/endoscopy-capture/pending?${params}`), { headers: authHeaders });
      if (!res.ok) throw new Error(`Server error ${res.status}`);

      const json = await res.json() as { images: Array<{ dataUrl: string; mimeType: string; timestamp: string; stationId: string }>; count: number };
      if (json.count === 0) {
        setFetchMsg('No images waiting in capture queue.');
        return;
      }

      const newImgs: ProcImage[] = json.images.map(ci => ({
        id: uid(),
        dataUrl: ci.dataUrl,
        mimeType: ci.mimeType,
        label: siteLabels[0] ?? '',
        finding: ci.stationId !== 'Capture station' ? ci.stationId : '',
        timestamp: ci.timestamp,
      }));
      onChange([...images, ...newImgs]);

      // Clear the queue after successful fetch
      await fetch(apiUrl(`/api/endoscopy-capture/pending?${params}`), { method: 'DELETE', headers: authHeaders });
      setFetchMsg(`${newImgs.length} image${newImgs.length !== 1 ? 's' : ''} imported from capture software.`);
      setTimeout(() => setFetchMsg(null), 4000);
    } catch (e) {
      setFetchMsg(e instanceof Error ? e.message : 'Fetch failed');
    } finally {
      setFetching(false);
    }
  }

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0d9488', letterSpacing: '0.04em' }}>
          {title.toUpperCase()} {images.length > 0 && <span style={{ color: '#94a3b8', fontWeight: 400 }}>({images.length})</span>}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button type="button" onClick={() => void fetchFromCapture()} disabled={fetching}
            title="Pull images from MediView / endoscopy capture software via the API bridge"
            style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid #0d9488', background: fetching ? '#e5e7eb' : '#fff', color: '#0d9488', cursor: fetching ? 'not-allowed' : 'pointer', opacity: fetching ? 0.7 : 1 }}>
            {fetching ? '⏳ Fetching…' : '📡 Fetch from capture'}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}
            style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px dashed #0d9488', background: '#f0fdfa', color: '#0d9488', cursor: 'pointer' }}>
            + Import images
          </button>
          <input ref={fileRef} type="file" multiple accept="image/*" style={{ display: 'none' }}
            onChange={e => void handleFiles(e.target.files)} />
        </div>
      </div>
      {fetchMsg && (
        <div style={{ marginBottom: 8, padding: '5px 10px', borderRadius: 6, fontSize: 12, background: fetchMsg.includes('No images') ? '#fef3c7' : '#d1fae5', color: fetchMsg.includes('No images') ? '#92400e' : '#065f46' }}>
          {fetchMsg}
        </div>
      )}

      {/* Drop zone (empty state) */}
      {images.length === 0 && (
        <div
          onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.background = '#f0fdfa'; }}
          onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#fafafa'; }}
          onDrop={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.background = '#fafafa'; void handleFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          style={{
            border: '2px dashed #a7f3d0', borderRadius: 8, padding: '22px 16px',
            textAlign: 'center', background: '#fafafa', cursor: 'pointer',
            color: '#6b7280', fontSize: 12, userSelect: 'none',
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 6 }}>🖼️</div>
          <div style={{ fontWeight: 600, marginBottom: 3 }}>Import images from MediView or endoscopy capture software</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>JPEG · PNG · drag &amp; drop or click to browse</div>
        </div>
      )}

      {/* Thumbnail grid */}
      {images.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
          {images.map((img, i) => (
            <div key={img.id} style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              {/* Thumbnail */}
              <div style={{ position: 'relative', background: '#0a0a0a', aspectRatio: '4/3', overflow: 'hidden' }}>
                <img src={img.dataUrl} alt={img.label || `Image ${i + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                <div style={{ position: 'absolute', top: 4, left: 6, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4 }}>
                  {i + 1}
                </div>
                <button type="button" onClick={() => remove(img.id)}
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ×
                </button>
              </div>
              {/* Metadata */}
              <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {siteLabels.length > 0 ? (
                  <select value={img.label} onChange={e => update(img.id, 'label', e.target.value)}
                    style={{ fontSize: 11, borderRadius: 4, border: '1px solid #d1d5db', padding: '2px 4px', color: '#0d9488', fontWeight: 600, background: '#f0fdfa' }}>
                    <option value="">— site / view —</option>
                    {siteLabels.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                ) : (
                  <input type="text" value={img.label} onChange={e => update(img.id, 'label', e.target.value)}
                    placeholder="Anatomical site"
                    style={{ fontSize: 11, borderRadius: 4, border: '1px solid #d1d5db', padding: '2px 6px', color: '#0d9488', fontWeight: 600 }} />
                )}
                <input type="text" value={img.finding} onChange={e => update(img.id, 'finding', e.target.value)}
                  placeholder="Finding / description"
                  style={{ fontSize: 11, borderRadius: 4, border: '1px solid #e2e8f0', padding: '2px 6px', color: '#374151' }} />
              </div>
            </div>
          ))}

          {/* Add-more tile */}
          <div
            onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.background = '#f0fdfa'; }}
            onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#fafafa'; }}
            onDrop={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.background = '#fafafa'; void handleFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            style={{
              border: '2px dashed #a7f3d0', borderRadius: 8, minHeight: 100,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 4, cursor: 'pointer', background: '#fafafa',
              color: '#9ca3af', fontSize: 11,
            }}
          >
            <span style={{ fontSize: 22, color: '#0d9488' }}>+</span>
            <span>Add images</span>
          </div>
        </div>
      )}
    </div>
  );
}
