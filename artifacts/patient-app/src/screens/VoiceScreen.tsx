import React, { useEffect, useRef, useState } from 'react';
import { getVoiceNotes, uploadVoiceNote, type VoiceNote } from '../api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-LC', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

type SendStatus = 'idle' | 'sending' | 'sent' | 'error';

interface PendingMessage {
  blobUrl: string;
  blob: Blob;
  duration: number;
  note: string;
  status: SendStatus;
  errorMsg?: string;
  transcript?: string;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  backgroundColor: '#0d1b2e',
  borderRadius: '12px',
  padding: '14px',
  marginBottom: '10px',
  border: '1px solid #1e3a5f',
};

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props {
  token: string;
}

const VoiceScreen: React.FC<Props> = ({ token }) => {
  // Recording state
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pending, setPending] = useState<PendingMessage | null>(null);

  // Sent messages from server
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load history ─────────────────────────────────────────────────────────

  useEffect(() => {
    setLoadingNotes(true);
    getVoiceNotes(token)
      .then(setNotes)
      .catch(() => setNotes([]))
      .finally(() => setLoadingNotes(false));
  }, [token]);

  // ── Recording controls ───────────────────────────────────────────────────

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Prefer webm/opus; fall back to whatever the browser supports
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorder.current = mr;
      chunks.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: mimeType || 'audio/webm' });
        const blobUrl = URL.createObjectURL(blob);
        setPending({
          blob,
          blobUrl,
          duration: elapsed,
          note: '',
          status: 'idle',
        });
        setElapsed(0);
      };

      mr.start(250); // collect chunks every 250 ms
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      alert('Microphone access is required to send a voice message.');
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorder.current?.stop();
    setRecording(false);
  }

  function cancelPending() {
    if (pending) URL.revokeObjectURL(pending.blobUrl);
    setPending(null);
  }

  async function sendVoiceNote() {
    if (!pending) return;
    setPending((p) => p ? { ...p, status: 'sending' } : p);

    try {
      const result = await uploadVoiceNote(token, pending.blob, pending.note);
      setPending(null);
      // Optimistically prepend to history until refresh
      const optimistic: VoiceNote = {
        id: result.call_log_id,
        created_at: new Date().toISOString(),
        duration_s: pending.duration,
        staff_notes: pending.note || null,
        transcript: null,
        status: 'voicemail',
      };
      setNotes((prev) => [optimistic, ...prev]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Send failed';
      setPending((p) => p ? { ...p, status: 'error', errorMsg: msg } : p);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '16px', paddingBottom: '24px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' }}>
        Voice Messages
      </h1>
      <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
        Record a message for the clinic — symptoms, questions, or updates. Our team will review
        it and respond via the app or phone.
      </p>

      {/* ── Record button ── */}
      {!pending && (
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          {recording ? (
            <>
              <div
                style={{
                  fontSize: '13px',
                  color: '#f87171',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  marginBottom: '16px',
                }}
              >
                ● REC &nbsp;{fmtDuration(elapsed)}
              </div>
              <button
                onClick={stopRecording}
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: '#f87171',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '28px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 0 8px #f8717130',
                }}
                aria-label="Stop recording"
              >
                ⏹
              </button>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '12px' }}>
                Tap to stop
              </p>
            </>
          ) : (
            <>
              <button
                onClick={() => void startRecording()}
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: '#0d9488',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '28px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 0 8px #0d948820',
                }}
                aria-label="Start recording"
              >
                🎙
              </button>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '12px' }}>
                Tap to record
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Pending message review ── */}
      {pending && (
        <div style={{ ...card, marginBottom: '20px' }}>
          <p style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '15px', marginBottom: '12px' }}>
            Review your message
          </p>

          <audio
            src={pending.blobUrl}
            controls
            style={{ width: '100%', marginBottom: '12px', borderRadius: '8px' }}
          />

          <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px' }}>
            Duration: {fmtDuration(pending.duration)}
          </p>

          <label
            style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}
          >
            Add a note (optional)
          </label>
          <textarea
            rows={3}
            placeholder="e.g. I've had pain since yesterday..."
            value={pending.note}
            onChange={(e) => setPending((p) => p ? { ...p, note: e.target.value } : p)}
            style={{
              width: '100%',
              backgroundColor: '#060e1a',
              border: '1px solid #1e3a5f',
              borderRadius: '8px',
              padding: '10px 12px',
              color: '#f1f5f9',
              fontSize: '14px',
              resize: 'none',
              marginBottom: '14px',
              boxSizing: 'border-box',
            }}
          />

          {pending.errorMsg && (
            <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '10px' }}>
              {pending.errorMsg}
            </p>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={cancelPending}
              disabled={pending.status === 'sending'}
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
              Discard
            </button>
            <button
              onClick={() => void sendVoiceNote()}
              disabled={pending.status === 'sending'}
              style={{
                flex: 2,
                padding: '12px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: pending.status === 'sending' ? '#0d948860' : '#0d9488',
                color: '#fff',
                cursor: pending.status === 'sending' ? 'default' : 'pointer',
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              {pending.status === 'sending' ? 'Sending…' : 'Send to clinic'}
            </button>
          </div>
        </div>
      )}

      {/* ── Message history ── */}
      <p
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: '#94a3b8',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '10px',
        }}
      >
        Sent messages
      </p>

      {loadingNotes ? (
        <p style={{ color: '#64748b', fontSize: '14px' }}>Loading…</p>
      ) : notes.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          No voice messages yet. Tap the microphone above to send your first message.
        </p>
      ) : (
        notes.map((n) => (
          <div key={n.id} style={card}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '6px',
              }}
            >
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>{fmtTime(n.created_at)}</span>
              {n.duration_s != null && (
                <span style={{ fontSize: '12px', color: '#475569' }}>
                  {fmtDuration(n.duration_s)}
                </span>
              )}
            </div>

            {n.transcript ? (
              <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: 1.5 }}>
                {n.transcript}
              </p>
            ) : (
              <p style={{ fontSize: '13px', color: '#475569', fontStyle: 'italic' }}>
                Transcription pending…
              </p>
            )}

            {n.staff_notes && (
              <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                Note: {n.staff_notes}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default VoiceScreen;
