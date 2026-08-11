import { SiteNav, SiteFooter } from '@/app/components/shared';

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', color: '#0f172a', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', minHeight: '100vh' }}>
      <a href="#main" className="skip-to-main">Skip to main content</a>
      <SiteNav />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}
