'use client';

import { useState, useRef, useEffect, FormEvent, KeyboardEvent } from 'react';

interface ChatMessage {
  role: 'assistant' | 'patient';
  content: string;
}

type BannerType = 'emergent' | 'complete' | null;

const WELCOME_MESSAGE =
  "Good day! I'm the intake assistant for Amise Medical Services. I'll ask you a few questions to help our team prepare for your visit. Shall we begin?";

export default function IntakePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: WELCOME_MESSAGE },
  ]);
  const [input, setInput] = useState('');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<BannerType>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function sendMessage(e?: FormEvent) {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text || loading || banner) return;

    setError(null);
    setInput('');
    setMessages(prev => [...prev, { role: 'patient', content: text }]);
    setLoading(true);

    try {
      const res = await fetch('/api/intake/web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: threadId ?? undefined,
          message: text,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || 'Request failed');
      }

      const data = await res.json();
      setThreadId(data.threadId);

      // Add assistant reply
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);

      // Check for emergent or complete
      if (data.triage_level === 'EMERGENT') {
        setBanner('emergent');
      } else if (data.intake_complete) {
        setBanner('complete');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const conversationEnded = banner !== null;

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logoRow}>
          <div style={styles.logoIcon}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="6" fill="#0d9488" />
              <path d="M14 6v16M6 14h16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1 style={styles.logoText}>AMISE Medical Services</h1>
            <p style={styles.subtitle}>Patient Intake Assistant</p>
          </div>
        </div>
        <p style={styles.confidential}>Confidential &middot; Saint Lucia</p>
      </header>

      {/* Chat area */}
      <main style={styles.chatArea}>
        <div style={styles.messagesContainer}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                ...styles.bubbleRow,
                justifyContent: msg.role === 'assistant' ? 'flex-start' : 'flex-end',
              }}
            >
              <div
                style={{
                  ...(msg.role === 'assistant' ? styles.assistantBubble : styles.patientBubble),
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div style={{ ...styles.bubbleRow, justifyContent: 'flex-start' }}>
              <div style={{ ...styles.assistantBubble, ...styles.typingBubble }}>
                <span style={styles.dot} />
                <span style={{ ...styles.dot, animationDelay: '0.2s' }} />
                <span style={{ ...styles.dot, animationDelay: '0.4s' }} />
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div style={styles.errorBanner}>
              We encountered an issue. Please try sending your message again.
            </div>
          )}

          {/* Emergency banner */}
          {banner === 'emergent' && (
            <div style={styles.emergentBanner}>
              <strong>Please call 911 or go to the nearest emergency department immediately.</strong>
            </div>
          )}

          {/* Completion banner */}
          {banner === 'complete' && (
            <div style={styles.completeBanner}>
              <strong>Thank you!</strong>
              <p style={{ margin: '0.5rem 0 0' }}>
                Your information has been received. Our team will contact you shortly to arrange your appointment.
              </p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input area */}
      <footer style={styles.footer}>
        <form onSubmit={sendMessage} style={styles.inputRow}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={loading || conversationEnded}
            style={{
              ...styles.input,
              ...(conversationEnded ? styles.inputDisabled : {}),
            }}
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading || conversationEnded}
            style={{
              ...styles.sendBtn,
              ...((!input.trim() || loading || conversationEnded) ? styles.sendBtnDisabled : {}),
            }}
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
        <p style={styles.disclaimer}>
          This is not a substitute for emergency medical care. If you are experiencing a medical emergency, please call 911.
        </p>
        <p style={styles.powered}>Powered by Amise Medical Services</p>
      </footer>

      {/* Typing animation keyframes */}
      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

/* ---------- Inline styles ---------- */

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100dvh',
    maxWidth: 520,
    margin: '0 auto',
    background: '#fafaf9',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    color: '#1c1917',
  },

  /* Header */
  header: {
    padding: '1rem 1.25rem 0.75rem',
    borderBottom: '1px solid #e7e5e4',
    background: '#ffffff',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  logoIcon: {
    flexShrink: 0,
  },
  logoText: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#0d9488',
    letterSpacing: '-0.01em',
  },
  subtitle: {
    margin: 0,
    fontSize: '0.8125rem',
    color: '#78716c',
    fontWeight: 500,
  },
  confidential: {
    margin: '0.5rem 0 0',
    fontSize: '0.6875rem',
    color: '#a8a29e',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },

  /* Chat */
  chatArea: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '1rem 1rem 0.5rem',
    WebkitOverflowScrolling: 'touch' as unknown as undefined,
  },
  messagesContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.625rem',
  },
  bubbleRow: {
    display: 'flex',
    width: '100%',
  },
  assistantBubble: {
    maxWidth: '80%',
    padding: '0.75rem 1rem',
    borderRadius: '1rem 1rem 1rem 0.25rem',
    background: '#0d9488',
    color: '#ffffff',
    fontSize: '0.9375rem',
    lineHeight: 1.5,
    wordBreak: 'break-word' as const,
  },
  patientBubble: {
    maxWidth: '80%',
    padding: '0.75rem 1rem',
    borderRadius: '1rem 1rem 0.25rem 1rem',
    background: '#e7e5e4',
    color: '#1c1917',
    fontSize: '0.9375rem',
    lineHeight: 1.5,
    wordBreak: 'break-word' as const,
  },

  /* Typing indicator */
  typingBubble: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    padding: '0.75rem 1.25rem',
    minWidth: 60,
  },
  dot: {
    display: 'inline-block',
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#ffffff',
    animation: 'typing-dot 1.4s ease-in-out infinite',
  },

  /* Banners */
  errorBanner: {
    margin: '0.5rem 0',
    padding: '0.75rem 1rem',
    borderRadius: '0.5rem',
    background: '#fef2f2',
    color: '#991b1b',
    fontSize: '0.875rem',
    border: '1px solid #fecaca',
  },
  emergentBanner: {
    margin: '0.75rem 0',
    padding: '1rem',
    borderRadius: '0.75rem',
    background: '#dc2626',
    color: '#ffffff',
    fontSize: '1rem',
    textAlign: 'center' as const,
    lineHeight: 1.5,
  },
  completeBanner: {
    margin: '0.75rem 0',
    padding: '1rem',
    borderRadius: '0.75rem',
    background: '#059669',
    color: '#ffffff',
    fontSize: '0.9375rem',
    textAlign: 'center' as const,
    lineHeight: 1.5,
  },

  /* Footer / Input */
  footer: {
    padding: '0.5rem 1rem 0.75rem',
    borderTop: '1px solid #e7e5e4',
    background: '#ffffff',
  },
  inputRow: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: '0.75rem 1rem',
    borderRadius: '1.5rem',
    border: '1px solid #d6d3d1',
    fontSize: '0.9375rem',
    outline: 'none',
    background: '#fafaf9',
    color: '#1c1917',
    WebkitAppearance: 'none' as unknown as undefined,
  },
  inputDisabled: {
    background: '#f5f5f4',
    color: '#a8a29e',
    cursor: 'not-allowed',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: 'none',
    background: '#0d9488',
    color: '#ffffff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
  sendBtnDisabled: {
    background: '#a8a29e',
    cursor: 'not-allowed',
  },
  disclaimer: {
    margin: '0.625rem 0 0.25rem',
    fontSize: '0.6875rem',
    color: '#a8a29e',
    textAlign: 'center' as const,
    lineHeight: 1.4,
  },
  powered: {
    margin: '0 0 0',
    fontSize: '0.6875rem',
    color: '#d6d3d1',
    textAlign: 'center' as const,
  },
};
