import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Amise Medical — Patient Check-In',
  robots: 'noindex',
};

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#060d18',
        color: '#e2e8f0',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        touchAction: 'manipulation',
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
