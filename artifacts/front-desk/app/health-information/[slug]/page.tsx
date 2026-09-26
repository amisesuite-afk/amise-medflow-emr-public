import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getApprovedArticle, getApprovedArticles } from '@/content/health-info';
import { absoluteUrl } from '@/lib/site';
import { ArticleBody, ReviewLine } from '../ArticleView';

// Only approved articles are built; any other slug — including every draft —
// is a 404 (dynamicParams = false). Drafts are previewed at
// /staff/health-information.
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return getApprovedArticles().map(a => ({ slug: a.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const article = getApprovedArticle(params.slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.summary,
    alternates: { canonical: `/health-information/${article.slug}` },
    openGraph: { title: `${article.title} — Amise Medical Services`, description: article.summary, type: 'article' },
  };
}

export default function HealthArticlePage({ params }: { params: { slug: string } }) {
  const article = getApprovedArticle(params.slug);
  if (!article) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalWebPage',
    name: article.title,
    description: article.summary,
    url: absoluteUrl(`/health-information/${article.slug}`),
    lastReviewed: article.lastReviewed,
    reviewedBy: { '@type': 'Person', name: article.reviewedBy },
    publisher: { '@type': 'MedicalBusiness', name: 'Amise Medical Services' },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section style={{ background: 'linear-gradient(135deg, #eef7f6 0%, #f0fdf9 100%)', padding: '56px 40px 40px', borderBottom: '1px solid #e2eeed' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <Link href="/health-information" style={{ display: 'inline-flex', fontSize: 13, color: '#0d9488', textDecoration: 'none', marginBottom: 18, fontWeight: 600 }}>
            ← Health Information
          </Link>
          <h1 style={{ margin: '0 0 14px', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 900, color: '#0f172a', lineHeight: 1.15 }}>
            {article.title}
          </h1>
          <p style={{ margin: '0 0 16px', fontSize: 16, color: '#374151', lineHeight: 1.75 }}>{article.summary}</p>
          <ReviewLine article={article} />
        </div>
      </section>

      <article style={{ padding: '44px 40px 56px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <ArticleBody article={article} />
          <div style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/book" style={{ padding: '12px 26px', background: '#0d9488', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Book an appointment →
            </Link>
            <Link href="/health-information" style={{ padding: '12px 22px', background: '#fff', color: '#0d9488', border: '1.5px solid #0d9488', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              More health information
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}
