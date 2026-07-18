import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#0d9488',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://amisemedical.com'),
  title: {
    default: 'Amise Medical Services — General & Endoscopic Surgery, Saint Lucia',
    template: '%s | Amise Medical Services',
  },
  description: 'Amise Medical Services — specialist surgical and endoscopy care in Saint Lucia, led by Dr Dawit Daniel Kabiye, MD, DM. Colonoscopy, ERCP, hernia, breast, thyroid, and more.',
  openGraph: {
    type: 'website',
    siteName: 'Amise Medical Services',
    locale: 'en_LC',
    title: 'Amise Medical Services — General & Endoscopic Surgery, Saint Lucia',
    description: 'Specialist surgical and endoscopy care in Saint Lucia, led by Dr Dawit Daniel Kabiye, MD, DM. Colonoscopy, ERCP, hernia repair, breast clinic, thyroid surgery, and more.',
  },
  twitter: {
    card: 'summary',
    title: 'Amise Medical Services — General & Endoscopic Surgery, Saint Lucia',
    description: 'Specialist surgical and endoscopy care in Saint Lucia, led by Dr Dawit Daniel Kabiye, MD, DM.',
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'Amise Medical',
    'facebook-domain-verification': 'qcp4vbmawm72o98totmkws67zp4kmn',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#ffffff', color: '#1c1917' }}>
        <noscript>
          <div style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: '#f8fafc', minHeight: '100vh' }}>
            <h1 style={{ fontSize: 20, marginBottom: 16 }}>Amise Medical Services</h1>
            <p style={{ fontSize: 14, marginBottom: 24, color: '#475569' }}>
              This website requires JavaScript to book appointments online.
            </p>
            <p style={{ fontSize: 14, color: '#475569' }}>
              To book by phone, call Tapion Hospital:
              <a href="tel:+17582840557" style={{ color: '#0d9488', fontWeight: 700 }}> 284-0557</a> or
              Rodney Bay:
              <a href="tel:+17587207111" style={{ color: '#0d9488', fontWeight: 700 }}> 720-7111</a>
            </p>
            <p style={{ fontSize: 14, color: '#475569' }}>
              WhatsApp:
              <a href="https://wa.me/17582840557" style={{ color: '#25D366', fontWeight: 700 }}> Tapion</a> ·
              <a href="https://wa.me/17587207111" style={{ color: '#25D366', fontWeight: 700 }}> Rodney Bay</a>
            </p>
          </div>
        </noscript>
        {children}
      </body>
    </html>
  );
}
