import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getApprovedArticles, formatReviewDate } from '@/content/health-info';
import { InformationNotice } from './ArticleView';

// Only approved articles are public (content/health-info.ts). With none
// approved, this page is a 404 and is left out of the sitemap and site links.
// Rendered per request so that the 404 is a real 404 status: a statically
// prerendered notFound() is served with 200 (a "soft 404").
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: '/health-information' },
  title: 'Health Information',
  description:
    'General patient information about common surgical and endoscopy conditions from Amise Medical Services, Saint Lucia. Each article shows when it was last clinically reviewed and the guidance it is based on.',
};

export default function HealthInformationIndex() {
  const articles = getApprovedArticles();
  if (articles.length === 0) notFound();

  return (
    <>
      <section style={{ background: 'linear-gradient(135deg, #eef7f6 0%, #f0fdf9 100%)', padding: '64px 40px 48px', borderBottom: '1px solid #e2eeed' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
            Patient Information Library
          </div>
          <h1 style={{ margin: '0 0 16px', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
            Health Information
          </h1>
          <p style={{ margin: '0 0 24px', fontSize: 16, color: '#374151', lineHeight: 1.8, maxWidth: 680 }}>
            Clear, general information about common surgical and endoscopy conditions, written for patients and
            families. Each article is clinically reviewed before it is published, and shows who reviewed it, when, and
            the guidance it is based on.
          </p>
          <InformationNotice />
        </div>
      </section>

      <section style={{ padding: '48px 40px 64px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {articles.map(a => (
            <Link
              key={a.slug}
              href={`/health-information/${a.slug}`}
              style={{ display: 'block', background: '#fff', border: '1.5px solid #e2eeed', borderRadius: 12, padding: '22px 20px', textDecoration: 'none', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}
            >
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>{a.title}</div>
              <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.7, marginBottom: 12 }}>{a.summary}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Last reviewed {formatReviewDate(a.lastReviewed)}</div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
