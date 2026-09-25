import {
  GENERAL_INFORMATION_NOTICE,
  formatReviewDate,
  type HealthArticle,
} from '@/content/health-info';

// Shared rendering for the public article page and the staff preview
// (app/staff/health-information). Server component — no client JS.

const TEXT = { fontSize: 15, color: '#374151', lineHeight: 1.8 } as const;

export function InformationNotice() {
  return (
    <div
      role="note"
      style={{
        padding: '14px 18px', background: '#fff7ed', border: '2px solid #f97316',
        borderRadius: 10, fontSize: 14, color: '#7c2d12', lineHeight: 1.7,
      }}
    >
      <strong>General information, not medical advice.</strong>{' '}
      {GENERAL_INFORMATION_NOTICE.replace(/^This is general information, not medical advice\.\s*/, '')}
    </div>
  );
}

export function ReviewLine({ article }: { article: HealthArticle }) {
  if (article.status !== 'approved') {
    return (
      <p style={{ margin: 0, fontSize: 13, color: '#b45309', fontWeight: 700 }}>
        DRAFT — not reviewed, not published (version {article.version})
      </p>
    );
  }
  return (
    <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>
      Last reviewed {formatReviewDate(article.lastReviewed)} by {article.reviewedBy}
      {' · '}Next review due {formatReviewDate(article.reviewDue)}
    </p>
  );
}

export function ArticleBody({ article }: { article: HealthArticle }) {
  return (
    <div>
      {article.sections.map(section => (
        <section key={section.heading} style={{ marginBottom: 32 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 21, fontWeight: 800, color: '#0f172a' }}>
            {section.heading}
          </h2>
          {section.paragraphs?.map(p => (
            <p key={p} style={{ margin: '0 0 12px', ...TEXT }}>{p}</p>
          ))}
          {section.bullets && (
            <ul style={{ margin: '0 0 12px', paddingLeft: 22, ...TEXT }}>
              {section.bullets.map(b => <li key={b} style={{ marginBottom: 6 }}>{b}</li>)}
            </ul>
          )}
        </section>
      ))}

      <section
        aria-labelledby={`urgent-${article.id}`}
        style={{ margin: '8px 0 32px', padding: '18px 22px', background: '#fff5f5', border: '1.5px solid #fca5a5', borderRadius: 12 }}
      >
        <h2 id={`urgent-${article.id}`} style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: '#b91c1c' }}>
          When to seek urgent care
        </h2>
        <p style={{ margin: '0 0 10px', fontSize: 14, color: '#7f1d1d', lineHeight: 1.7, fontWeight: 600 }}>
          {article.whenToSeekUrgentCare.intro}
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: '#7f1d1d', lineHeight: 1.75 }}>
          {article.whenToSeekUrgentCare.signs.map(s => <li key={s}>{s}</li>)}
        </ul>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Sources</h2>
        <p style={{ margin: '0 0 8px', fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
          This article is based on the following published guidance. Guidelines are updated from time
          to time; the article is reviewed on the schedule shown above.
        </p>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#475569', lineHeight: 1.7 }}>
          {article.sources.map(src => (
            <li key={src.name}>
              {src.url ? (
                <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0d9488' }}>{src.name}</a>
              ) : src.name}
              {' '}({src.year})
            </li>
          ))}
        </ul>
      </section>

      <InformationNotice />
    </div>
  );
}
