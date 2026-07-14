import React from 'react';
import * as Sentry from '@sentry/react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { ToastProvider } from '@/components/ToastProvider';
import HomePage from '@/pages/Home';
import LoginPage from '@/components/LoginPage';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null; componentStack: string | null }
> {
  state: { error: Error | null; componentStack: string | null } = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    this.setState({ componentStack: info.componentStack ?? null });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0d2520', fontFamily: '-apple-system, sans-serif', padding: 16, boxSizing: 'border-box',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 560, width: '100%' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f87171', marginBottom: 8 }}>
              Something went wrong
            </div>
            <div style={{ fontSize: 13, color: '#f87171', marginBottom: 12, fontFamily: 'monospace', background: '#1e3a3a', padding: '8px 12px', borderRadius: 6, textAlign: 'left', overflowX: 'auto' }}>
              {this.state.error.message}
            </div>
            {this.state.componentStack && (
              <details style={{ marginBottom: 16, textAlign: 'left' }}>
                <summary style={{ fontSize: 11, color: '#94a3b8', cursor: 'pointer', marginBottom: 6 }}>Component stack (tap to expand)</summary>
                <pre style={{ fontSize: 10, color: '#64748b', background: '#1e3a3a', padding: '8px 12px', borderRadius: 6, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 }}>
                  {this.state.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={() => { this.setState({ error: null, componentStack: null }); window.location.reload(); }}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none',
                background: '#0d9488', color: '#fff', fontWeight: 700,
                fontSize: 14, cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AuthGuard() {
  const { profile, loading, sessionExpired } = useAuth();

  if (loading) {
    return (
      <div style={{
        height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 16, background: '#0d2520',
        fontFamily: '-apple-system, sans-serif',
      }}>
        <div style={{
          width: 32, height: 32, border: '3px solid #1e3a3a',
          borderTopColor: '#0d9488', borderRadius: '50%',
          animation: 'spin .8s linear infinite',
        }} />
        <div style={{ color: '#4db8ad', fontSize: 12, fontWeight: 700, letterSpacing: '.08em' }}>
          AMISE MEDFLOW
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (!profile) return <LoginPage sessionExpired={sessionExpired} />;

  return (
    <AppProvider>
      <ToastProvider>
        <HomePage />
      </ToastProvider>
    </AppProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthGuard />
      </AuthProvider>
    </ErrorBoundary>
  );
}
