import React, { useEffect, useState } from 'react';
import Header from './components/Header';
import BottomNav, { type TabId } from './components/BottomNav';
import PassportScreen from './screens/PassportScreen';
import PreVisitScreen from './screens/PreVisitScreen';
import MonitoringScreen from './screens/MonitoringScreen';
import UploadScreen from './screens/UploadScreen';
import { getPatientProfile, type PatientProfile } from './api';

const TOKEN_KEY = 'amise_patient_token';

function readTokenFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('token');
}

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('passport');

  // Resolve token on mount
  useEffect(() => {
    const urlToken = readTokenFromUrl();
    if (urlToken) {
      localStorage.setItem(TOKEN_KEY, urlToken);
      setToken(urlToken);
    } else {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (stored) setToken(stored);
    }
  }, []);

  // Load profile once token is available
  useEffect(() => {
    if (!token) return;
    setProfileLoading(true);
    getPatientProfile(token)
      .then((p) => {
        setProfile(p);
      })
      .catch(() => {
        // Profile endpoint may not be live yet; degrade gracefully
        setProfile(null);
      })
      .finally(() => {
        setProfileLoading(false);
      });
  }, [token]);

  // No token — show error screen
  if (!token) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          backgroundColor: '#060e1a',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            color: '#0d9488',
            fontWeight: 700,
            fontSize: '22px',
            marginBottom: '8px',
          }}
        >
          AMISE
        </div>
        <div
          style={{
            color: '#f1f5f9',
            fontSize: '18px',
            fontWeight: 600,
            marginBottom: '12px',
          }}
        >
          Access link required
        </div>
        <div style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '300px' }}>
          Please open the link sent to you by Amise Medical Services. If you
          believe this is an error, contact the clinic directly.
        </div>
      </div>
    );
  }

  const renderScreen = () => {
    switch (activeTab) {
      case 'passport':
        return <PassportScreen token={token} />;
      case 'previsit':
        return <PreVisitScreen token={token} />;
      case 'monitoring':
        return <MonitoringScreen token={token} />;
      case 'upload':
        return <UploadScreen token={token} />;
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
        patientName={profile?.patientName ?? null}
        loading={profileLoading}
      />
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {renderScreen()}
      </main>
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default App;
