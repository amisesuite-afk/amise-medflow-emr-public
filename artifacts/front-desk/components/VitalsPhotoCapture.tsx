'use client';

import { useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedVitals {
  systolicBp?: number | null;
  diastolicBp?: number | null;
  heartRate?: number | null;
  temperatureC?: number | null;
  spo2?: number | null;
  respiratoryRate?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
  glucoseMmol?: number | null;
  deviceType?: string | null;
  rawText?: string | null;
  confidence?: 'high' | 'medium' | 'low';
}

interface VitalsPhotoTheme {
  card?: string;
  border?: string;
  text?: string;
  muted?: string;
  accent?: string;
  inputBg?: string;
}

interface VitalsPhotoCaptureProps {
  apiBase: string;
  token: string;
  onContinue: () => void;
  onSkip: () => void;
  theme?: VitalsPhotoTheme;
}

const VITAL_FIELD_LABELS: Record<string, { label: string; unit: string }> = {
  systolicBp: { label: 'Systolic BP', unit: 'mmHg' },
  diastolicBp: { label: 'Diastolic BP', unit: 'mmHg' },
  heartRate: { label: 'Heart rate', unit: 'bpm' },
  temperatureC: { label: 'Temperature', unit: '°C' },
  spo2: { label: 'Oxygen saturation', unit: '%' },
  respiratoryRate: { label: 'Respiratory rate', unit: '/min' },
  weightKg: { label: 'Weight', unit: 'kg' },
  heightCm: { label: 'Height', unit: 'cm' },
  glucoseMmol: { label: 'Glucose', unit: 'mmol/L' },
};

const DEFAULT_THEME: Required<VitalsPhotoTheme> = {
  card: '#1e293b',
  border: '#374151',
  text: '#f1f5f9',
  muted: '#94a3b8',
  accent: '#0d9488',
  inputBg: '#0f172a',
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lets a patient (own device, via the questionnaire link) or kiosk user
 * photograph a home medical device display — BP monitor, scale,
 * thermometer, pulse oximeter, or glucometer. Claude Vision reads off the
 * values and stages them on the session for nurse review; nothing is
 * written to the clinical record from here.
 */
export default function VitalsPhotoCapture({ apiBase, token, onContinue, onSkip, theme }: VitalsPhotoCaptureProps) {
  const t = { ...DEFAULT_THEME, ...theme };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [vitals, setVitals] = useState<ExtractedVitals | null>(null);
  const [photoCount, setPhotoCount] = useState(0);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const dataBase64 = await fileToBase64(file);
      const res = await fetch(`${apiBase}/api/questionnaire/session/${token}/vitals-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataBase64, mimeType: file.type }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setError(err.error ?? 'Could not read that photo. Please try again with a clearer image.');
        return;
      }

      const data = (await res.json()) as { vitals: ExtractedVitals };
      setVitals(data.vitals);
      setPhotoCount(n => n + 1);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const readings = vitals
    ? Object.entries(VITAL_FIELD_LABELS).filter(([key]) => vitals[key as keyof ExtractedVitals] != null)
    : [];

  return (
    <div style={{ background: t.card, border: `1px solid ${t.border}`, borderRadius: 12, padding: '28px 24px', marginBottom: 16 }}>
      <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: t.text }}>
        Optional: Add your vitals readings
      </h2>
      <p style={{ fontSize: 13, color: t.muted, lineHeight: 1.7, margin: '0 0 18px' }}>
        If you have a blood pressure monitor, weighing scale, thermometer, pulse oximeter or
        glucometer to hand, you can photograph the display and we&apos;ll read the values for the
        nurse to check. This step is optional — you can skip it.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={e => void handleFileChange(e)}
        style={{ display: 'none' }}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: 8,
          border: 'none',
          background: uploading ? t.inputBg : t.accent,
          color: uploading ? t.muted : '#fff',
          fontWeight: 700,
          fontSize: 15,
          cursor: uploading ? 'not-allowed' : 'pointer',
          marginBottom: 12,
        }}
      >
        {uploading ? 'Reading photo…' : photoCount > 0 ? 'Add another photo' : 'Take or upload a photo'}
      </button>

      {error && (
        <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {readings.length > 0 && (
        <div style={{
          background: t.inputBg,
          border: `1px solid ${t.border}`,
          borderRadius: 8,
          padding: '14px 16px',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
            Readings captured
          </div>
          {readings.map(([key, { label, unit }]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: t.text, padding: '4px 0' }}>
              <span style={{ color: t.muted }}>{label}</span>
              <span style={{ fontWeight: 600 }}>{String(vitals?.[key as keyof ExtractedVitals])} {unit}</span>
            </div>
          ))}
          {vitals?.confidence === 'low' && (
            <div style={{ fontSize: 12, color: '#fbbf24', marginTop: 8 }}>
              Some values may be unclear — a nurse will double-check these.
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button
          type="button"
          onClick={onSkip}
          style={{
            flex: '0 0 auto',
            padding: '12px 18px',
            borderRadius: 8,
            border: `1px solid ${t.border}`,
            background: 'transparent',
            color: t.muted,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Skip
        </button>
        <button
          type="button"
          onClick={onContinue}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: 8,
            border: 'none',
            background: t.accent,
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          {photoCount > 0 ? 'Done' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
