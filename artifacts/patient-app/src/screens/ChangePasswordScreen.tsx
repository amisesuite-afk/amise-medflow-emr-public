import React, { useState } from 'react';
import { changePassword } from '../api';

interface Props {
  sessionToken: string;
  onDone: () => void;
}

export default function ChangePasswordScreen({ sessionToken, onDone }: Props) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && pw !== confirm;
  const valid = pw.length >= 8 && pw === confirm;

  async function handleSubmit() {
    if (!valid) return;
    setLoading(true);
    setError(null);
    try {
      await changePassword(sessionToken, pw);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', background: '#060e1a',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '32px 24px',
    }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ color: '#0d9488', fontWeight: 800, fontSize: 22, letterSpacing: '0.12em', textAlign: 'center' }}>
          AMISE
        </div>
        <div style={{ color: '#f1f5f9', fontSize: 18, fontWeight: 700, textAlign: 'center' }}>
          Set your password
        </div>
        <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 1.6 }}>
          Choose a password you'll remember. At least 8 characters.
        </div>

        {error && (
          <div style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: 8, color: '#fca5a5', fontSize: 13, padding: '10px 14px' }}>
            {error}
          </div>
        )}

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>
            New password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="Minimum 8 characters"
            style={{ width: '100%', background: '#0d1b2e', border: '1.5px solid #1e3a5f', borderRadius: 8, color: '#f1f5f9', fontSize: 16, padding: '12px 14px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>
            Confirm password
          </label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && void handleSubmit()}
            placeholder="Repeat password"
            style={{
              width: '100%', background: '#0d1b2e', borderRadius: 8, color: '#f1f5f9',
              fontSize: 16, padding: '12px 14px', outline: 'none', boxSizing: 'border-box',
              border: `1.5px solid ${mismatch ? '#ef4444' : '#1e3a5f'}`,
            }}
          />
          {mismatch && (
            <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>Passwords do not match</div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={loading || !valid}
          style={{
            width: '100%', padding: '14px', borderRadius: 10, border: 'none',
            background: '#0d9488', color: '#fff', fontSize: 16, fontWeight: 700,
            cursor: loading || !valid ? 'not-allowed' : 'pointer',
            opacity: loading || !valid ? 0.55 : 1,
          }}
        >
          {loading ? 'Saving…' : 'Set password & continue →'}
        </button>
      </div>
    </div>
  );
}
