export function AmsiseLogo({ dark = false, href = '/' }: { dark?: boolean; href?: string }) {
  const text = dark ? '#fff' : '#0d7a74';
  const sub  = dark ? '#94a3b8' : '#64748b';
  return (
    <a href={href} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
      <svg width="42" height="42" viewBox="0 0 42 42" fill="none">
        <circle cx="21" cy="21" r="21" fill="#0d9488" />
        {/* Stylised running figure */}
        <circle cx="25" cy="10" r="3.5" fill="white"/>
        <path d="M16 38 Q18 28 22 24 Q26 20 28 26 Q30 30 27 34" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        <path d="M22 24 L18 30 L13 32" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
        {/* Medical cross on upper-right */}
        <rect x="28" y="6"  width="1.8" height="6"   rx="0.9" fill="white"/>
        <rect x="25.5" y="8.1" width="6.8" height="1.8" rx="0.9" fill="white"/>
      </svg>
      <div>
        <div style={{ fontSize: 17, fontWeight: 900, color: text, letterSpacing: '0.04em', lineHeight: 1 }}>AMISE</div>
        <div style={{ fontSize: 8.5, fontWeight: 600, color: sub, letterSpacing: '0.1em', lineHeight: 1.4 }}>MEDICAL SERVICES</div>
      </div>
    </a>
  );
}
