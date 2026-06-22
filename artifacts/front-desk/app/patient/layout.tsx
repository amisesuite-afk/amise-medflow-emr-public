import type { Metadata } from 'next';
import { AmsiseLogo } from '../components/AmsiseLogo';

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
        padding: '6px 20px',
        minHeight: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <AmsiseLogo href="/patient" />
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
        <strong style={{ color: '#dc2626' }}>Medical emergency? Call emergency services or go to the nearest emergency room.</strong><br />
        Clinic hours: Mon–Fri, 9am–5pm — call us during these hours for guidance.<br />
        Front desk —{' '}
        <a href="tel:+17582840557" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 600 }}>Tapion 284-0557</a>
        {' · '}
        <a href="https://wa.me/17582840557" target="_blank" rel="noopener noreferrer" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 600 }}>WhatsApp</a>
        {' · '}
        <a href="tel:+17587207111" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 600 }}>Rodney Bay 720-7111</a>
        {' · '}
        <a href="https://wa.me/17587207111" target="_blank" rel="noopener noreferrer" style={{ color: '#64748b', textDecoration: 'none', fontWeight: 600 }}>WhatsApp</a>
      </footer>
    </div>
  );
}
