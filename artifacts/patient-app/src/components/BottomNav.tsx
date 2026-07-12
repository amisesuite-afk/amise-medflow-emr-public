import React from 'react';

export type TabId = 'passport' | 'previsit' | 'monitoring' | 'upload' | 'voice';

interface NavItem {
  id: TabId;
  label: string;
  emoji: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'passport', label: 'Passport', emoji: '🪪' },
  { id: 'previsit', label: 'Pre-Visit', emoji: '📋' },
  { id: 'monitoring', label: 'Monitoring', emoji: '📸' },
  { id: 'upload', label: 'Upload', emoji: '📂' },
  { id: 'voice', label: 'Messages', emoji: '🎙' },
];

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  return (
    <nav
      style={{
        backgroundColor: '#0d1b2e',
        borderTop: '1px solid #1e3a5f',
        display: 'flex',
        alignItems: 'stretch',
        flexShrink: 0,
        position: 'sticky',
        bottom: 0,
        zIndex: 50,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 4px 8px',
              minHeight: '56px',
              background: 'none',
              border: 'none',
              borderTop: `2px solid ${isActive ? '#0d9488' : 'transparent'}`,
              cursor: 'pointer',
              color: isActive ? '#0d9488' : '#64748b',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{item.emoji}</span>
            <span
              style={{
                fontSize: '10px',
                marginTop: '3px',
                fontWeight: isActive ? 600 : 400,
                letterSpacing: '0.02em',
              }}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
