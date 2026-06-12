export function AmsiseLogo({ dark = false, href = '/' }: { dark?: boolean; href?: string }) {
  const text = dark ? '#fff' : '#0d7a74';
  const sub  = dark ? '#94a3b8' : '#64748b';
  return (
    <a href={href} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
      <img src="/amise-logo.jpg" alt="" width={42} height={42} style={{ borderRadius: 8, objectFit: 'cover' }} />
      <div>
        <div style={{ fontSize: 17, fontWeight: 900, color: text, letterSpacing: '0.04em', lineHeight: 1 }}>AMISE</div>
        <div style={{ fontSize: 8.5, fontWeight: 600, color: sub, letterSpacing: '0.1em', lineHeight: 1.4 }}>MEDICAL SERVICES</div>
      </div>
    </a>
  );
}
