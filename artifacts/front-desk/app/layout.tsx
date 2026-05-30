import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Amise Front Desk',
  description: 'AI patient intake assistant — Amise Medical Services',
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
