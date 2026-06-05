import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Amise Medical Services — General & Endoscopic Surgery, Saint Lucia',
  description: 'Dr Dawit Daniel Kabiye, MD, DM. Specialist surgical care in Saint Lucia — colonoscopy, ERCP, hernia, breast, thyroid, and more.',
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
