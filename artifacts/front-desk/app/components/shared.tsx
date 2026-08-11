import Link from 'next/link';
import { AmsiseLogo } from './AmsiseLogo';
import { MobileNavMenu } from './MobileNavMenu';

export const WA_TAPION     = 'https://wa.me/17582840557';
export const WA_RODNEY     = 'https://wa.me/17587207111';
export const PHONE_TAPION  = '758-284-0557';
export const PHONE_RODNEY  = '758-720-7111';
export const CONTACT_EMAIL = 'amisesuite@gmail.com';

export function WaSvg({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.534 5.857L.057 23.885l6.198-1.625A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.652-.49-5.189-1.348l-.371-.22-3.676.964.981-3.585-.242-.378A9.944 9.944 0 012 12c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10z"/>
    </svg>
  );
}

const NAV_LINKS = [
  { href: '/#services', label: 'Services' },
  { href: '/#offices',  label: 'Clinics'  },
  { href: '/#about',    label: 'About'    },
  { href: '/#contact',  label: 'Contact'  },
] as const;

export function SiteNav() {
  return (
    <nav className="amise-nav" style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)',
      borderBottom: '1px solid #e8f0ef', padding: '0 40px',
    }}>
      <MobileNavMenu links={NAV_LINKS} />
      <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 66 }}>
        <AmsiseLogo href="/" />
        <div className="amise-nav-links">
          {NAV_LINKS.map(({ href, label }) => (
            <a key={href} href={href} style={{ fontSize: 14, fontWeight: 500, textDecoration: 'none', color: '#4b5563', paddingBottom: 2, borderBottom: '2px solid transparent' }}>{label}</a>
          ))}
          <Link href="/intake" style={{ fontSize: 14, fontWeight: 700, textDecoration: 'none', color: '#0d9488', whiteSpace: 'nowrap' }}>New Patient?</Link>
          <a href={WA_TAPION} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp us" style={{ display: 'flex', alignItems: 'center', color: '#25D366', opacity: 0.9 }}>
            <WaSvg size={20} color="#25D366" />
          </a>
          <Link href="/book" style={{ padding: '10px 22px', background: '#0d9488', color: '#fff', borderRadius: 50, fontSize: 14, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Book Appointment
          </Link>
        </div>
        <div className="amise-nav-mobile-book" style={{ gap: 12, alignItems: 'center' }}>
          <a href={WA_TAPION} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><WaSvg size={22} color="#25D366" /></a>
          <Link href="/book" style={{ padding: '9px 18px', background: '#0d9488', color: '#fff', borderRadius: 50, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>Book</Link>
        </div>
      </div>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="amise-footer" style={{ background: '#0b2a35', color: '#94a3b8', padding: '44px 40px 28px' }}>
      <div className="amise-footer-main" style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', gap: 0, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <AmsiseLogo dark href="/" />
          <div style={{ borderLeft: '1px solid #1e4a5a', paddingLeft: 14 }}>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>Surgical, Endoscopy &amp; Specialist Care<br />Saint Lucia</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#1e4a5a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3-8.59A2 2 0 012.02 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{PHONE_TAPION}</div>
            <div style={{ fontSize: 11, color: '#4a7a8a' }}>Tapion Office</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#1e4a5a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3-8.59A2 2 0 012.02 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{PHONE_RODNEY}</div>
            <div style={{ fontSize: 11, color: '#4a7a8a' }}>Rodney Bay Office</div>
          </div>
        </div>
        <a href={`mailto:${CONTACT_EMAIL}`} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#1e4a5a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{CONTACT_EMAIL}</div>
            <div style={{ fontSize: 11, color: '#4a7a8a' }}>General enquiries</div>
          </div>
        </a>
        <div style={{ display: 'flex', gap: 10 }}>
          <a href={WA_TAPION} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" style={{ width: 38, height: 38, borderRadius: '50%', background: '#25D36622', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <WaSvg size={18} color="#25D366" />
          </a>
        </div>
      </div>

      <div className="amise-footer-links" style={{ maxWidth: 1160, margin: '32px auto 0', borderTop: '1px solid #1e4a5a', paddingTop: 28, display: 'flex', flexWrap: 'wrap', gap: 40, rowGap: 20 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Patient Resources</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Link href="/guidance" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>Health Guidance &amp; Screening</Link>
            <Link href="/pathway" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>Care Pathways</Link>
            <Link href="/book" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>Book an Appointment</Link>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Services</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Link href="/services/endoscopy" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>Endoscopy</Link>
            <Link href="/services/ercp" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>ERCP &amp; Biliary</Link>
            <Link href="/services/breast-clinic" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>Breast Clinic</Link>
            <Link href="/services/diabetic-foot" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>Diabetic Foot</Link>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Healthcare Providers</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Link href="/refer" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>Submit a Referral</Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1160, margin: '20px auto 0', borderTop: '1px solid #1e4a5a', paddingTop: 18, fontSize: 11, color: '#2d5a6a', textAlign: 'center', lineHeight: 1.8 }}>
        This website is for administrative scheduling only and does not constitute medical advice or clinical triage.
        If you are experiencing a medical emergency, call 911 immediately. &nbsp;·&nbsp;
        © {new Date().getFullYear()} Amise Medical Services, Saint Lucia. All rights reserved.
      </div>
    </footer>
  );
}
