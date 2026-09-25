import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import {
  HEALTH_ARTICLES,
  HEALTH_INFO_LIBRARY_VERSION,
  formatReviewDate,
  type HealthArticle,
} from '@/content/health-info';
import { auditHealthLibrary, todayInStLucia } from '@/content/health-info-governance';
import { extractStaffToken, verifyStaffToken, type StaffAuthClient } from '@/lib/staff-auth';
import { getServiceClient } from '@/lib/supabase';
import { ArticleBody, ReviewLine } from '@/app/health-information/ArticleView';

// Staff preview of the whole health-information library, drafts included.
// middleware.ts redirects when there is no staff cookie; this page also
// verifies the session with Supabase and requires a staff role, because it
// shows unpublished (unreviewed) clinical text.

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Health information — staff preview',
  robots: { index: false, follow: false },
};

const CARD = '#1e293b';
const BORDER = '#334155';
const MUTED = '#94a3b8';

function StatusBadge({ article }: { article: HealthArticle }) {
  const approved = article.status === 'approved';
  return (
    <span style={{
      fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
      padding: '3px 8px', borderRadius: 6,
      background: approved ? '#064e3b' : '#78350f', color: approved ? '#6ee7b7' : '#fcd34d',
    }}>
      {approved ? 'Approved · public' : 'Draft · not public'}
    </span>
  );
}

export default async function StaffHealthInformationPage() {
  const token = extractStaffToken({ headers: headers(), cookies: cookies() } as unknown as Pick<NextRequest, 'headers' | 'cookies'>);
  const auth = await verifyStaffToken(token, getServiceClient() as unknown as StaffAuthClient);
  if (!auth.ok) {
    if (auth.status === 503) {
      return <p style={{ color: '#fca5a5' }}>{auth.error}</p>;
    }
    redirect('/staff/login?next=/staff/health-information');
  }

  const today = todayInStLucia();
  const report = auditHealthLibrary(HEALTH_ARTICLES, today);
  const approvedCount = HEALTH_ARTICLES.filter(a => a.status === 'approved').length;

  return (
    <div>
      <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>Health information library</h1>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: MUTED }}>
        Library version {HEALTH_INFO_LIBRARY_VERSION} · {HEALTH_ARTICLES.length} articles · {approvedCount} approved and public · today {formatReviewDate(today)}
      </p>

      <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px 18px', marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: '#e2e8f0' }}>How to approve an article</h2>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#cbd5e1', lineHeight: 1.8 }}>
          <li>Dr Kabiye reads the draft below and marks any changes.</li>
          <li>He tells the developer which articles are approved, with the review date and the date the next review is due (normally one year later).</li>
          <li>The developer sets <code>status: &apos;approved&apos;</code>, <code>lastReviewed</code>, <code>reviewedBy</code>, <code>reviewDue</code> and <code>version: &apos;1.0.0&apos;</code> in <code>artifacts/front-desk/content/health-info.ts</code>, and bumps the library version and the registry entry.</li>
          <li>After the next deployment the article appears at /health-information, and the site links to the library.</li>
        </ol>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: MUTED }}>
          Any later change to an approved article needs a new review. The full workflow is in docs/CLINICAL-CONTENT-UPGRADES.md §9.
        </p>
      </section>

      {(report.failures.length > 0 || report.warnings.length > 0) && (
        <section style={{ background: '#450a0a', border: '1px solid #7f1d1d', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 800, color: '#fecaca' }}>Review status</h2>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#fecaca', lineHeight: 1.7 }}>
            {[...report.failures, ...report.warnings].map(m => <li key={m}>{m}</li>)}
          </ul>
        </section>
      )}

      <section style={{ marginBottom: 28, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: '#cbd5e1' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: MUTED }}>
              {['Article', 'Status', 'Version', 'Last reviewed', 'Reviewed by', 'Review due'].map(h => (
                <th key={h} style={{ padding: '6px 8px', borderBottom: `1px solid ${BORDER}`, fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {HEALTH_ARTICLES.map(a => (
              <tr key={a.id}>
                <td style={{ padding: '6px 8px', borderBottom: `1px solid ${BORDER}` }}>
                  <a href={`#${a.slug}`} style={{ color: '#5eead4', textDecoration: 'none' }}>{a.title}</a>
                </td>
                <td style={{ padding: '6px 8px', borderBottom: `1px solid ${BORDER}` }}><StatusBadge article={a} /></td>
                <td style={{ padding: '6px 8px', borderBottom: `1px solid ${BORDER}` }}>{a.version}</td>
                <td style={{ padding: '6px 8px', borderBottom: `1px solid ${BORDER}` }}>{formatReviewDate(a.lastReviewed)}</td>
                <td style={{ padding: '6px 8px', borderBottom: `1px solid ${BORDER}` }}>{a.reviewedBy ?? '—'}</td>
                <td style={{ padding: '6px 8px', borderBottom: `1px solid ${BORDER}` }}>{formatReviewDate(a.reviewDue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {HEALTH_ARTICLES.map(a => (
        <article
          key={a.id}
          id={a.slug}
          style={{ background: '#fff', color: '#0f172a', borderRadius: 12, padding: '28px 28px 24px', marginBottom: 28, scrollMarginTop: 64 }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <StatusBadge article={a} />
            <span style={{ fontSize: 12, color: '#64748b' }}>/health-information/{a.slug}</span>
          </div>
          <h2 style={{ margin: '0 0 10px', fontSize: 26, fontWeight: 900, color: '#0f172a' }}>{a.title}</h2>
          <p style={{ margin: '0 0 10px', fontSize: 15, color: '#374151', lineHeight: 1.7 }}>{a.summary}</p>
          <div style={{ marginBottom: 24 }}><ReviewLine article={a} /></div>
          <ArticleBody article={a} />
        </article>
      ))}
    </div>
  );
}
