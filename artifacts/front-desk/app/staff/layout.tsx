import type { ReactNode } from 'react';

export const metadata = { title: 'Staff Scheduling — Amise MedFlow' };

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      color: '#e2e8f0',
    }}>
      <header style={{
        borderBottom: '1px solid #1e293b',
        padding: '0 24px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        background: '#0f172a',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#0d9488', fontWeight: 800, fontSize: 15, letterSpacing: '-0.02em' }}>MedFlow</span>
          <span style={{ color: '#334155', fontSize: 13 }}>/</span>
          <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 500 }}>Staff Scheduling</span>
        </div>
        <a
          href="/staff/login"
          style={{ fontSize: 12, color: '#64748b', textDecoration: 'none', padding: '4px 10px',
                   borderRadius: 6, border: '1px solid #1e293b' }}
        >
          Sign out
        </a>
      </header>
      <main style={{ padding: '28px 24px', maxWidth: 900, margin: '0 auto' }}>
        {children}
      </main>
    </div>
  );
}
