import React from 'react';
import * as Sentry from '@sentry/react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { ToastProvider } from '@/components/ToastProvider';
import HomePage from '@/pages/Home';
import LoginPage from '@/components/LoginPage';
import IdleLock from '@/components/IdleLock';
import MobileEncounterPage from '@/pages/MobileEncounterPage';
import PwaUpdatePrompt from '@/components/PwaUpdatePrompt';

const IS_MOBILE_PATH = typeof window !== 'undefined' && window.location.pathname.startsWith('/mobile');

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0d2520', fontFamily: '-apple-system, sans-serif',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f87171', marginBottom: 8 }}>
              Something went wrong
            </div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
              {this.state.error.message}
            </div>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
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

  if (IS_MOBILE_PATH) return <MobileEncounterPage />;

  return (
    <>
      {/* Skip-navigation — visually hidden, shown on focus for keyboard users (WCAG 2.4.1) */}
      <a
        href="#main-content"
        style={{
          position: 'absolute', left: '-9999px', top: 'auto', width: 1, height: 1,
          overflow: 'hidden', zIndex: 9999,
        }}
        onFocus={e => Object.assign((e.currentTarget as HTMLAnchorElement).style, {
          left: '50%', top: 8, width: 'auto', height: 'auto',
          transform: 'translateX(-50%)', overflow: 'visible',
          padding: '8px 20px', background: '#0d9488', color: '#fff',
          fontWeight: 700, borderRadius: 6,
        })}
        onBlur={e => Object.assign((e.currentTarget as HTMLAnchorElement).style, {
          left: '-9999px', width: 1, height: 1, overflow: 'hidden', transform: 'none',
        })}
      >
        Skip to main content
      </a>
      <IdleLock />
      <AppProvider>
        <ToastProvider>
          <HomePage />
        </ToastProvider>
      </AppProvider>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthGuard />
      </AuthProvider>
      <PwaUpdatePrompt />
    </ErrorBoundary>
  );
}
