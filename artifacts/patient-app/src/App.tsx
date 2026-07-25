import React, { useEffect, useState } from 'react';
import Header from './components/Header';
import BottomNav, { type TabId } from './components/BottomNav';
import PassportScreen from './screens/PassportScreen';
import PreVisitScreen from './screens/PreVisitScreen';
import MonitoringScreen from './screens/MonitoringScreen';
import UploadScreen from './screens/UploadScreen';
import VoiceScreen from './screens/VoiceScreen';
import LoginScreen from './screens/LoginScreen';
import ChangePasswordScreen from './screens/ChangePasswordScreen';
import { getStoredSession, saveSession, clearSession, getPatientProfile, exchangeMagicLink } from './api';
import type { PatientSession, PatientProfile } from './api';

// ── URL param helpers ─────────────────────────────────────────────────────────

function getUrlParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    email: p.get('email') ?? '',
    pw: p.get('pw') ?? '',
    token: p.get('token') ?? '',
  };
}

function stripUrlCredentials() {
  const url = new URL(window.location.href);
  url.searchParams.delete('email');
  url.searchParams.delete('pw');
  url.searchParams.delete('token');
  window.history.replaceState({}, '', url.toString());
}

// ── App ───────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const urlParams = getUrlParams();

  const [session, setSession] = useState<PatientSession | null>(() => getStoredSession());
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('passport');
  const [isExchanging, setIsExchanging] = useState(!!urlParams.token);
  const [exchangeError, setExchangeError] = useState<string | null>(null);

  // Exchange magic link token on first render if present in URL
  useEffect(() => {
    if (!urlParams.token) return;
    setIsExchanging(true);
    exchangeMagicLink(urlParams.token)
      .then(s => {
        saveSession(s);
        setSession(s);
        setActiveTab('previsit');
      })
      .catch(err => {
        setExchangeError(err instanceof Error ? err.message : 'This link has expired or already been used.');
      })
      .finally(() => {
        stripUrlCredentials();
        setIsExchanging(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh profile whenever we have a session
  useEffect(() => {
    if (!session) { setProfile(null); return; }
    setProfileLoading(true);
    getPatientProfile(session.sessionToken)
      .then(p => {
        setProfile(p);
        // Return patients land on passport; new patients with a pending
        // pre-visit land on pre-visit tab; otherwise default to passport.
        if (!p.isReturnPatient && p.hasPendingPrevisit) {
          setActiveTab('previsit');
        }
      })
      .catch(() => {
        // Session expired or network error
        clearSession();
        setSession(null);
      })
      .finally(() => setProfileLoading(false));
  }, [session]);

  function handleLogin(s: PatientSession) {
    saveSession(s);
    setSession(s);
    stripUrlCredentials();
    // Return patient → passport; new patient with pending previsit → previsit
    if (!s.isReturnPatient) setActiveTab('previsit');
  }

  function handleLogout() {
    clearSession();
    setSession(null);
    setProfile(null);
  }

  // ── Magic link in progress ───────────────────────────────────────────────

  if (isExchanging) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#060e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '32px' }}>⏳</div>
        <p style={{ color: '#94a3b8', fontSize: '15px' }}>Signing you in…</p>
      </div>
    );
  }

  if (exchangeError) {
    return (
      <div style={{ minHeight: '100dvh', backgroundColor: '#060e1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px', padding: '24px' }}>
        <div style={{ fontSize: '32px' }}>⚠️</div>
        <p style={{ color: '#f87171', fontSize: '15px', textAlign: 'center', maxWidth: '320px' }}>{exchangeError}</p>
        <button
          onClick={() => setExchangeError(null)}
          style={{ padding: '12px 24px', borderRadius: '10px', border: 'none', backgroundColor: '#0d9488', color: '#fff', fontSize: '15px', cursor: 'pointer' }}
        >
          Go to login
        </button>
      </div>
    );
  }

  // ── No session → Login ───────────────────────────────────────────────────

  if (!session) {
    return (
      <LoginScreen
        prefillEmail={urlParams.email}
        prefillPassword={urlParams.pw}
        onLogin={handleLogin}
      />
    );
  }

  // ── Must change password (first login with temp password) ────────────────

  if (session.mustChangePassword) {
    return (
      <ChangePasswordScreen
        sessionToken={session.sessionToken}
        onDone={() => {
          const updated: PatientSession = { ...session, mustChangePassword: false };
          saveSession(updated);
          setSession(updated);
        }}
      />
    );
  }

  // ── Main app ─────────────────────────────────────────────────────────────

  const patientName = profile?.patientName ?? session.patientName;

  const renderScreen = () => {
    switch (activeTab) {
      case 'passport':
        return <PassportScreen token={session.sessionToken} />;
      case 'previsit':
        return <PreVisitScreen token={session.sessionToken} />;
      case 'monitoring':
        return <MonitoringScreen token={session.sessionToken} />;
      case 'upload':
        return <UploadScreen token={session.sessionToken} />;
      case 'voice':
        return <VoiceScreen token={session.sessionToken} />;
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        maxWidth: '480px',
        margin: '0 auto',
        backgroundColor: '#060e1a',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Header
        patientName={patientName ?? null}
        loading={profileLoading}
        onLogout={handleLogout}
      />
      <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {renderScreen()}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default App;
