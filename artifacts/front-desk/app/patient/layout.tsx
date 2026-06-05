import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Amise Medical — Patient Portal',
  description: 'View your appointments, medications, and health records with Amise Medical Services.',
  robots: 'noindex',
};

export default function PatientPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
      {/* Portal header */}
      <header style={{
        background: '#0f172a',
        borderBottom: '1px solid #1e293b',
        padding: '0 24px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            Amise
          </span>
          <span style={{ fontSize: 12, color: '#475569', borderLeft: '1px solid #334155', paddingLeft: 12 }}>
            Patient Portal
          </span>
        </div>
        <div style={{ fontSize: 11, color: '#475569' }}>
          Amise Medical Services · Saint Lucia
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid #e2e8f0',
        padding: '16px 24px',
        textAlign: 'center',
        fontSize: 11,
        color: '#94a3b8',
        lineHeight: 1.7,
      }}>
        Amise Medical Services · Saint Lucia<br />
        Tapion Hospital: 459-2227 · 284-0557 · Rodney Bay · Castries<br />
        For medical emergencies call 911 or go to your nearest emergency department.
      </footer>
    </div>
  );
}
