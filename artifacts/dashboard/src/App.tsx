import { AuthProvider, useAuth } from '@/context/AuthContext';
import { AppProvider } from '@/context/AppContext';
import { ToastProvider } from '@/components/ToastProvider';
import HomePage from '@/pages/Home';
import LoginPage from '@/components/LoginPage';

function AuthGuard() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0d2520', color: '#4db8ad', fontSize: 13, fontWeight: 700,
        letterSpacing: '.06em', fontFamily: '-apple-system, sans-serif',
      }}>
        Loading…
      </div>
    );
  }

  if (!session) return <LoginPage />;

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
    <AuthProvider>
      <AuthGuard />
    </AuthProvider>
  );
}
