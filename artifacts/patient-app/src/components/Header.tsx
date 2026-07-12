import React from 'react';

interface HeaderProps {
  patientName: string | null;
  loading: boolean;
  onLogout?: () => void;
}

const Header: React.FC<HeaderProps> = ({ patientName, loading, onLogout }) => {
  return (
    <header
      style={{
        backgroundColor: '#0d1b2e',
        borderBottom: '1px solid #1e3a5f',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div>
        <span style={{ color: '#0d9488', fontWeight: 700, fontSize: '18px', letterSpacing: '0.05em' }}>
          AMISE
        </span>
        <span style={{ color: '#94a3b8', fontSize: '12px', marginLeft: '6px' }}>
          Patient App
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: '13px', color: '#94a3b8', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {loading ? <span style={{ opacity: 0.5 }}>Loading…</span> : patientName ?? null}
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            title="Sign out"
            style={{
              background: 'none', border: 'none', color: '#475569',
              fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '2px 4px',
            }}
          >
            ⏏
          </button>
        )}
      </div>
    </header>
  );
};

export default Header;
