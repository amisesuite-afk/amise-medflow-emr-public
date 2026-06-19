import React from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { ToastProvider } from '@/components/ToastProvider';
import HomePage from '@/pages/Home';
import LoginPage from '@/components/LoginPage';

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
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0d2520', color: '#4db8ad', fontSize: 13, fontWeight: 700,
        letterSpacing: '.06em', fontFamily: '-apple-system, sans-serif',
      }}>
        Loading...
      </div>
    );
  }

  if (!profile) return <LoginPage />;

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
