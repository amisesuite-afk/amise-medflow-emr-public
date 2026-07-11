import React, { useEffect, useState } from 'react';
import { addMonitoringPhoto } from '../api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MonitoringEntry {
  id: string;
  date: string;
  photoDataUrl: string;
  note: string;
  painScore: number;
  synced: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function storageKey(token: string) {
  return `amise_monitoring_${token}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function loadEntries(token: string): MonitoringEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(token));
    if (raw) return JSON.parse(raw) as MonitoringEntry[];
  } catch {
    // ignore
  }
  return [];
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

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  token: string;
}

const MonitoringScreen: React.FC<Props> = ({ token }) => {
  const [entries, setEntries] = useState<MonitoringEntry[]>(() => loadEntries(token));
  const [adding, setAdding] = useState(false);

  // Capture form state
  const [capturePhoto, setCapturePhoto] = useState<string | null>(null);
  const [captureNote, setCaptureNote] = useState('');
  const [capturePain, setCapturePain] = useState(5);
  const [captureDate, setCaptureDate] = useState(todayStr());
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Persist entries
  useEffect(() => {
    localStorage.setItem(storageKey(token), JSON.stringify(entries));
  }, [entries, token]);

  function resetCaptureForm() {
    setCapturePhoto(null);
    setCaptureNote('');
    setCapturePain(5);
    setCaptureDate(todayStr());
    setUploadError(null);
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setCapturePhoto(dataUrl);
    } catch {
      setUploadError('Could not read the photo. Please try again.');
    }
    e.target.value = '';
  }

  async function handleAddEntry() {
    if (!capturePhoto) {
      setUploadError('Please select a photo.');
      return;
    }
    setUploading(true);
    setUploadError(null);

    const entry: MonitoringEntry = {
      id: `mon_${Date.now()}`,
      date: captureDate,
      photoDataUrl: capturePhoto,
      note: captureNote,
      painScore: capturePain,
      synced: false,
    };

    // Try to sync immediately
    try {
      await addMonitoringPhoto(token, {
        dataUrl: capturePhoto,
        context: `monitoring_${captureDate}`,
      });
      entry.synced = true;
    } catch {
      // Save locally even if sync fails
    }

    setEntries((prev) => [entry, ...prev]);
    resetCaptureForm();
    setAdding(false);
    setUploading(false);
  }

  // Sorted newest first
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div style={{ padding: '16px', paddingBottom: '24px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' }}>
        Monitoring Diary
      </h1>
      <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>
        Track your recovery with photos and notes. Your surgeon will review these at your
        follow-up.
      </p>

      {/* Add today's update button */}
      {!adding && (
        <button
          onClick={() => {
            resetCaptureForm();
            setAdding(true);
          }}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: '#0d9488',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: '20px',
          }}
        >
          + Add today's update
        </button>
      )}

      {/* Capture form */}
      {adding && (
        <div style={{ ...card, marginBottom: '20px' }}>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: '#f1f5f9',
              marginBottom: '14px',
            }}
          >
            New update
          </div>

          {/* Photo capture */}
          {capturePhoto ? (
            <div style={{ marginBottom: '10px' }}>
              <img
                src={capturePhoto}
                alt="Preview"
                style={{
                  width: '100%',
                  maxHeight: '220px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  marginBottom: '8px',
                }}
              />
              <button
                onClick={() => setCapturePhoto(null)}
                style={{
                  color: '#f87171',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  padding: 0,
                }}
              >
                Remove photo
              </button>
            </div>
          ) : (
            <label
              htmlFor="mon-photo"
              style={{
                display: 'block',
                textAlign: 'center',
                padding: '20px',
                border: '2px dashed #1e3a5f',
                borderRadius: '10px',
                cursor: 'pointer',
                marginBottom: '10px',
                color: '#0d9488',
                fontSize: '14px',
              }}
            >
              📷 Take or upload photo *
              <input
                id="mon-photo"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => void handlePhotoSelect(e)}
                style={{ display: 'none' }}
              />
            </label>
          )}

          {/* Date */}
          <label style={labelStyle}>Date</label>
          <input
            style={inputStyle}
            type="date"
            value={captureDate}
            max={todayStr()}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCaptureDate(e.target.value)}
          />

          {/* Pain score */}
          <label style={labelStyle}>
            Pain score: <strong style={{ color: '#f1f5f9' }}>{capturePain} / 10</strong>
          </label>
          <input
            style={{ width: '100%', accentColor: '#0d9488', marginBottom: '10px' }}
            type="range"
            min={0}
            max={10}
            step={1}
            value={capturePain}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setCapturePain(Number(e.target.value))
            }
          />

          {/* Note */}
          <label style={labelStyle}>
            Notes (optional) — changes, colour, discharge, other symptoms?
          </label>
          <textarea
            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', marginBottom: '10px' }}
            placeholder="e.g. Wound looks less red today. Some clear discharge. No fever."
            value={captureNote}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setCaptureNote(e.target.value)
            }
          />

          {uploadError && (
            <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '8px' }}>
              {uploadError}
            </p>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                setAdding(false);
                resetCaptureForm();
              }}
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
              onClick={() => void handleAddEntry()}
              disabled={uploading || !capturePhoto}
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#0d9488',
                color: '#fff',
                cursor: uploading || !capturePhoto ? 'not-allowed' : 'pointer',
                opacity: uploading || !capturePhoto ? 0.6 : 1,
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              {uploading ? 'Saving...' : 'Save update'}
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {sorted.length === 0 && !adding && (
        <div
          style={{
            textAlign: 'center',
            padding: '32px 16px',
            color: '#64748b',
            fontSize: '14px',
          }}
        >
          No updates yet. Add your first photo to start your diary.
        </div>
      )}

      {sorted.map((entry, idx) => (
        <div
          key={entry.id}
          style={{
            display: 'flex',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          {/* Timeline spine */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: idx === 0 ? '#0d9488' : '#1e3a5f',
                marginTop: '16px',
                flexShrink: 0,
              }}
            />
            {idx < sorted.length - 1 && (
              <div
                style={{
                  flex: 1,
                  width: '2px',
                  backgroundColor: '#1e3a5f',
                  marginTop: '4px',
                }}
              />
            )}
          </div>

          {/* Entry card */}
          <div
            style={{
              flex: 1,
              backgroundColor: '#0d1b2e',
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid #1e3a5f',
            }}
          >
            <img
              src={entry.photoDataUrl}
              alt={`Update ${formatDate(entry.date)}`}
              style={{
                width: '100%',
                maxHeight: '180px',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            <div style={{ padding: '12px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}
              >
                <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                  {formatDate(entry.date)}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      backgroundColor: '#0d948820',
                      color: '#0d9488',
                      borderRadius: '6px',
                      padding: '2px 8px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    Pain {entry.painScore}/10
                  </span>
                  {entry.synced && (
                    <span style={{ color: '#22c55e', fontSize: '11px' }}>✓ synced</span>
                  )}
                </div>
              </div>
              {entry.note && (
                <p style={{ color: '#cbd5e1', fontSize: '13px', lineHeight: 1.5 }}>
                  {entry.note}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MonitoringScreen;
