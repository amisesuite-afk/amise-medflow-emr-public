import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Amise Medical Services — General & Endoscopic Surgery, Saint Lucia',
  description: 'Amise Medical Services — specialist surgical and endoscopy care in Saint Lucia, led by Dr Dawit Daniel Kabiye, MD, DM. Colonoscopy, ERCP, hernia, breast, thyroid, and more.',
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
