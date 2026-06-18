import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#0d9488',
};

export const metadata: Metadata = {
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
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'apple-mobile-web-app-title': 'Amise Medical',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#0f172a', color: '#e2e8f0' }}>
        {children}
      </body>
    </html>
  );
}
