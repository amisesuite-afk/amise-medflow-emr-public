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
import { getStoredSession, saveSession, clearSession, getPatientProfile } from './api';
import type { PatientSession, PatientProfile } from './api';

// ── URL param helpers ─────────────────────────────────────────────────────────

function getUrlParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    email: p.get('email') ?? '',
    pw: p.get('pw') ?? '',
  };
}

function stripUrlCredentials() {
  const url = new URL(window.location.href);
  url.searchParams.delete('email');
  url.searchParams.delete('pw');
  window.history.replaceState({}, '', url.toString());
}

// ── App ───────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const urlParams = getUrlParams();

  const [session, setSession] = useState<PatientSession | null>(() => getStoredSession());
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('passport');

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
