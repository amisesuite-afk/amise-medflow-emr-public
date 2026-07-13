import React, { useEffect, useState } from 'react';
import { sendMessage, getMessages, type PatientMessage } from '../api';

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('en-LC', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const card: React.CSSProperties = {
  backgroundColor: '#0d1b2e',
  borderRadius: '12px',
  padding: '14px',
  marginBottom: '10px',
  border: '1px solid #1e3a5f',
};

interface Props {
  token: string;
}

const VoiceScreen: React.FC<Props> = ({ token }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<PatientMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMessages(token)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    setError('');
    try {
      await sendMessage(token, trimmed);
      const optimistic: PatientMessage = {
        id: `pending-${Date.now()}`,
        created_at: new Date().toISOString(),
        transcript: trimmed,
        staff_notes: null,
        status: 'voicemail',
      };
      setMessages((prev) => [optimistic, ...prev]);
      setText('');
    } catch {
      setError('Failed to send. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ padding: '16px', paddingBottom: '24px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' }}>
        Messages
      </h1>
      <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '16px' }}>
        Type your message or tap the microphone on your keyboard to dictate. Our team will review
        and respond.
      </p>

      {/* Quick contact */}
      <div style={{
        backgroundColor: '#0d1b2e',
        borderRadius: '12px',
        padding: '14px',
        marginBottom: '16px',
        border: '1px solid #1e3a5f',
      }}>
        <p style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
          Call or WhatsApp us directly
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <a
            href="https://wa.me/17582840557"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '11px 14px', borderRadius: '10px',
              backgroundColor: '#14532d22', border: '1px solid #16a34a55',
              textDecoration: 'none', color: '#4ade80',
            }}
          >
            <span style={{ fontSize: '18px' }}>💬</span>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>WhatsApp — Tapion</p>
              <p style={{ fontSize: '11px', color: '#86efac', margin: 0 }}>758-284-0557</p>
            </div>
          </a>
          <a
            href="https://wa.me/17587207111"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '11px 14px', borderRadius: '10px',
              backgroundColor: '#14532d22', border: '1px solid #16a34a55',
              textDecoration: 'none', color: '#4ade80',
            }}
          >
            <span style={{ fontSize: '18px' }}>💬</span>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>WhatsApp — Rodney Bay</p>
              <p style={{ fontSize: '11px', color: '#86efac', margin: 0 }}>758-720-7111</p>
            </div>
          </a>
          <a
            href="tel:+17584592227"
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '11px 14px', borderRadius: '10px',
              backgroundColor: '#0c2a4a', border: '1px solid #1e3a5f',
              textDecoration: 'none', color: '#93c5fd',
            }}
          >
            <span style={{ fontSize: '18px' }}>📞</span>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>Call — Tapion landline</p>
              <p style={{ fontSize: '11px', color: '#7dd3fc', margin: 0 }}>758-459-2227</p>
            </div>
          </a>
        </div>
      </div>

      {/* Message input */}
      <div style={card}>
        <textarea
          rows={4}
          placeholder="Describe your symptoms, ask a question, or leave an update for the clinic…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{
            width: '100%',
            backgroundColor: '#060e1a',
            border: '1px solid #1e3a5f',
            borderRadius: '8px',
            padding: '12px',
            color: '#f1f5f9',
            fontSize: '15px',
            resize: 'none',
            marginBottom: '12px',
            boxSizing: 'border-box',
            lineHeight: 1.5,
          }}
        />

        <p style={{ fontSize: '12px', color: '#475569', marginBottom: '12px' }}>
          Tip: tap the 🎙 mic on your keyboard to speak instead of type.
        </p>

        {error && (
          <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '10px' }}>{error}</p>
        )}

        <button
          onClick={() => void handleSend()}
          disabled={sending || !text.trim()}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: sending || !text.trim() ? '#0d948850' : '#0d9488',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 600,
            cursor: sending || !text.trim() ? 'default' : 'pointer',
          }}
        >
          {sending ? 'Sending…' : 'Send to clinic'}
        </button>
      </div>

      {/* Message history */}
      <p style={{
        fontSize: '13px', fontWeight: 600, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px',
      }}>
        Sent messages
      </p>

      {loading ? (
        <p style={{ color: '#64748b', fontSize: '14px' }}>Loading…</p>
      ) : messages.length === 0 ? (
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          No messages yet. Use the box above to send your first message.
        </p>
      ) : (
        messages.map((m) => (
          <div key={m.id} style={card}>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
              {fmtTime(m.created_at)}
            </p>
            <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: 1.5 }}>
              {m.transcript ?? '—'}
            </p>
            {m.staff_notes && (
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px', fontStyle: 'italic' }}>
                Note: {m.staff_notes}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default VoiceScreen;
