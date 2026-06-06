import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Amise Medical Services',
  description: 'Patient portal — appointments, records, and pre-visit forms for Amise Medical Services, Saint Lucia.',
  robots: 'noindex',
};

export default function PatientPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      WebkitFontSmoothing: 'antialiased',
    }}>
      {/* Minimal header */}
      <header style={{
        background: '#fff',
        borderBottom: '1px solid #f1f5f9',
        padding: '0 20px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <a href="/patient" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>Amise</span>
          <span style={{ fontSize: 11, color: '#0d9488', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Medical</span>
        </a>
        <span style={{ fontSize: 11, color: '#94a3b8', letterSpacing: '0.02em' }}>Saint Lucia</span>
      </header>

      {/* Content */}
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '28px 20px 80px' }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        fontSize: 11,
        color: '#94a3b8',
        lineHeight: 2,
        padding: '20px 24px 32px',
      }}>
        Amise Medical Services · Saint Lucia<br />
        <strong style={{ color: '#64748b' }}>Emergencies: Tapion Hospital 459-2227 · 284-0557</strong>
      </footer>
    </div>
  );
}
