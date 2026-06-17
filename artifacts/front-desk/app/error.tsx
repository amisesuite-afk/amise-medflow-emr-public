'use client';

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a1a1f', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#4db8ad', marginBottom: 12 }}>
          Amise Medical Services
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Something went wrong</h1>
        <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, marginBottom: 24 }}>
          We're sorry — an unexpected error occurred. Please try again, or contact our front desk if the problem persists.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={reset}
            style={{ padding: '10px 22px', borderRadius: 8, background: '#0d9278', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            Try again
          </button>
          <a href="tel:+17582840557" style={{ display: 'inline-block', padding: '10px 22px', borderRadius: 8, background: 'transparent', border: '1px solid #1e4a5a', color: '#4db8ad', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
            Call us: 284-0557
          </a>
        </div>
      </div>
    </div>
  );
}
