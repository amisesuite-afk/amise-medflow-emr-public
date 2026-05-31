import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Amise Medical Services — Expert Surgical & Endoscopy Care, Saint Lucia',
  description:
    'Dr Dawit Daniel Kabiye, MD, DM. Expert surgical and endoscopy care in Saint Lucia — colonoscopy, ERCP, hernia repair, breast clinic, thyroid surgery, diabetic foot care and more. Book online or WhatsApp us.',
};

// ─── Constants ───────────────────────────────────────────────────────────────

const WA_TAPION    = 'https://wa.me/17582840557';
const WA_RODNEY    = 'https://wa.me/17587207111';
const PHONE_TAPION = '758-284-0557';
const PHONE_RODNEY = '758-720-7111';
const EMAIL        = 'info@amisemedical.com';

// ─── Logo SVG ────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <a href="#home" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="18" cy="18" r="18" fill="#0d9488" />
        {/* Person silhouette */}
        <circle cx="18" cy="11" r="4" fill="white" />
        <path d="M10 30 C10 22 14 18 18 18 C22 18 26 22 26 30" fill="white" />
        {/* Small cross */}
        <rect x="22" y="6" width="2" height="6" rx="1" fill="white" />
        <rect x="19" y="9" width="8" height="2" rx="1" fill="white" />
      </svg>
      <div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#0d9488', letterSpacing: '-0.01em', lineHeight: 1.1 }}>AMISE</div>
        <div style={{ fontSize: 9, fontWeight: 600, color: '#64748b', letterSpacing: '0.04em', lineHeight: 1.1 }}>MEDICAL SERVICES</div>
      </div>
    </a>
  );
}

// ─── Navigation ──────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(255,255,255,0.97)',
      backdropFilter: 'blur(8px)',
      borderBottom: '1px solid #e2e8f0',
      padding: '0 32px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
        <Logo />
        <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          {[
            { href: '#home',    label: 'Home'        },
            { href: '#services',label: 'Services'    },
            { href: '#patients',label: 'For Patients' },
            { href: '#offices', label: 'Our Offices'  },
            { href: '#about',   label: 'About Us'     },
            { href: '#contact', label: 'Contact'      },
          ].map(({ href, label }) => (
            <a key={href} href={href} style={{ fontSize: 14, color: '#374151', textDecoration: 'none', fontWeight: 500 }}>
              {label}
            </a>
          ))}
          <a
            href={WA_TAPION}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', background: '#0d9488', color: '#fff',
              borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.534 5.857L.057 23.885l6.198-1.625A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.652-.49-5.189-1.348l-.371-.22-3.676.964.981-3.585-.242-.378A9.944 9.944 0 012 12c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10z" fillRule="evenodd" clipRule="evenodd"/>
            </svg>
            WhatsApp Us
          </a>
        </div>
      </div>
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section id="home" style={{ position: 'relative', overflow: 'hidden', background: '#f0f7f7', minHeight: 560 }}>
      {/* Background aerial photo — place your Saint Lucia coastal aerial at /locations/hero-bg.jpg */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/locations/hero-bg.jpg"
        alt=""
        aria-hidden="true"
        style={{ position: 'absolute', right: 0, top: 0, width: '55%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
      />
      {/* Fade overlay from left */}
      <div style={{ position: 'absolute', right: '35%', top: 0, bottom: 0, width: '25%', background: 'linear-gradient(to right, #f0f7f7, transparent)', zIndex: 1 }} />

      <div style={{ position: 'relative', zIndex: 2, margin: '0 auto', padding: '80px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: '50%', minHeight: 560, boxSizing: 'border-box' }}>
        <h1 style={{ margin: '0 0 10px', fontSize: 'clamp(30px, 4vw, 52px)', fontWeight: 900, color: '#0f172a', lineHeight: 1.1, letterSpacing: '-0.03em' }}>
          Expert Surgical &amp;<br />Endoscopy Care
        </h1>
        <p style={{ margin: '0 0 8px', fontSize: 'clamp(16px, 2vw, 22px)', fontStyle: 'italic', color: '#0d9488', fontWeight: 600 }}>
          Compassionate. Advanced. Always.
        </p>
        <p style={{ margin: '0 0 32px', fontSize: 15, color: '#475569', lineHeight: 1.7, maxWidth: 420 }}>
          Quality care you can trust. Our team is here to guide you every step of the way.
        </p>

        {/* Primary CTAs */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
          <Link href="/book" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '13px 24px', background: '#0d9488', color: '#fff',
            borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Book Appointment</div>
              <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.85 }}>Routine Visit</div>
            </div>
          </Link>
          <Link href="/book" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '13px 24px', background: '#e63946', color: '#fff',
            borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/>
            </svg>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Urgent Triage</div>
              <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.85 }}>Need Urgent Care?</div>
            </div>
          </Link>
        </div>

        {/* WhatsApp contacts */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          {[
            { label: 'WhatsApp Tapion',     num: PHONE_TAPION, href: WA_TAPION    },
            { label: 'WhatsApp Rodney Bay', num: PHONE_RODNEY, href: WA_RODNEY    },
          ].map(({ label, num, href }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', background: '#fff', border: '1px solid #e2e8f0',
              borderRadius: 8, fontSize: 13, color: '#0d9488', textDecoration: 'none',
              fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#0d9488">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.534 5.857L.057 23.885l6.198-1.625A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.652-.49-5.189-1.348l-.371-.22-3.676.964.981-3.585-.242-.378A9.944 9.944 0 012 12c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10z" fillRule="evenodd" clipRule="evenodd"/>
              </svg>
              <div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1 }}>{label}</div>
                <div style={{ fontSize: 13, lineHeight: 1.4 }}>{num}</div>
              </div>
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          Your information is secure and confidential.
        </div>
      </div>
    </section>
  );
}

// ─── Feature Tiles ────────────────────────────────────────────────────────────

function FeatureTiles() {
  const tiles = [
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
      colour: '#0d9488',
      title: 'Routine Booking',
      body: 'Book consultations, follow-ups and specialist visits.',
      cta: 'Book Now →',
      href: '/book',
      ctaColour: '#0d9488',
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e63946" strokeWidth="1.8">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
      colour: '#e63946',
      title: 'Urgent Appointment',
      body: 'Answer a few questions so we can prioritise your care.',
      cta: 'Start Triage →',
      href: '/book',
      ctaColour: '#e63946',
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4l3 3"/>
          <path d="M7 3.34A10 10 0 003 12"/>
        </svg>
      ),
      colour: '#0d9488',
      title: 'Endoscopy / ERCP',
      body: 'Schedule procedures and get preparation instructions.',
      cta: 'Learn More →',
      href: '#services',
      ctaColour: '#0d9488',
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8">
          <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
          <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
        </svg>
      ),
      colour: '#0d9488',
      title: 'Upload Reports',
      body: 'Upload medical reports, scans or referral letters securely.',
      cta: 'Upload Now →',
      href: '/book',
      ctaColour: '#0d9488',
    },
  ];

  return (
    <section id="services" style={{ background: '#f8fafc', padding: '56px 32px', borderBottom: '1px solid #e2e8f0' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
        {tiles.map(({ icon, title, body, cta, href, ctaColour }) => (
          <div key={title} style={{ background: '#fff', borderRadius: 12, padding: '28px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ width: 52, height: 52, borderRadius: 12, background: '#f0fdf9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              {icon}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.65, marginBottom: 16, flex: 1 }}>{body}</div>
            <a href={href} style={{ fontSize: 13, fontWeight: 700, color: ctaColour, textDecoration: 'none' }}>{cta}</a>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Our Offices ──────────────────────────────────────────────────────────────

function Offices() {
  const offices = [
    {
      name:     'Tapion Hospital Office',
      img:      '/locations/tapion.jpg',
      imgAlt:   'Tapion Hospital, La Toc, Castries, Saint Lucia',
      services: 'Surgery, Endoscopy, ERCP, Urgent Reviews',
      phone:    PHONE_TAPION,
      wa:       WA_TAPION,
      mapsHref: 'https://maps.google.com/?q=Tapion+Hospital+Castries+Saint+Lucia',
    },
    {
      name:     'Rodney Bay / Providence Office',
      img:      '/locations/rodney-bay.jpg',
      imgAlt:   'Providence Building, Rodney Bay, Saint Lucia',
      services: 'Consultations, Follow-ups, Administrative Services',
      phone:    PHONE_RODNEY,
      wa:       WA_RODNEY,
      mapsHref: 'https://maps.google.com/?q=Providence+Building+Rodney+Bay+Saint+Lucia',
    },
  ];

  return (
    <section id="offices" style={{ padding: '72px 32px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 40px' }}>
          Our Offices
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 28 }}>
          {offices.map(({ name, img, imgAlt, services, phone, wa, mapsHref }) => (
            <div key={name} style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.1)', background: '#fff', border: '1px solid #e2e8f0' }}>
              {/* Building photo — 200px tall */}
              <div style={{ position: 'relative', height: 200, background: '#e2f4f1', overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt={imgAlt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {/* Map pin badge */}
                <div style={{
                  position: 'absolute', bottom: 12, left: 12,
                  width: 32, height: 32, borderRadius: '50%',
                  background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  </svg>
                </div>
              </div>

              {/* Card body */}
              <div style={{ padding: '22px 24px' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: '#0d9488' }}>{name}</h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{services}</p>

                <a href={wa} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: '#0d9488', textDecoration: 'none', marginBottom: 16 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#0d9488">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.534 5.857L.057 23.885l6.198-1.625A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.652-.49-5.189-1.348l-.371-.22-3.676.964.981-3.585-.242-.378A9.944 9.944 0 012 12c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10z" fillRule="evenodd" clipRule="evenodd"/>
                  </svg>
                  {phone}
                </a>

                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block', width: '100%', boxSizing: 'border-box',
                    padding: '11px', background: '#0d9488', color: '#fff',
                    borderRadius: 8, fontSize: 14, fontWeight: 700,
                    textDecoration: 'none', textAlign: 'center',
                  }}
                >
                  Get Directions
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Why Choose Us ────────────────────────────────────────────────────────────

function WhyUs() {
  const pillars = [
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      ),
      title: 'Experienced Specialists',
      body: 'Advanced care with compassion.',
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
      title: 'Timely Appointments',
      body: 'We respect your time.',
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      ),
      title: 'Secure & Confidential',
      body: 'Your privacy is our priority.',
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
        </svg>
      ),
      title: 'Patient-Centered',
      body: 'Care tailored to your needs.',
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
      title: 'Advanced Procedures',
      body: 'Endoscopy, ERCP & minimally invasive surgery.',
    },
  ];

  return (
    <section style={{ padding: '64px 32px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 40px' }}>
          Why Patients Choose Amise Medical Services
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20 }}>
          {pillars.map(({ icon, title, body }) => (
            <div key={title} style={{ background: '#fff', borderRadius: 12, padding: '24px 20px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid #e2f4f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {icon}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>{body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    { n: '1', title: 'Tell Us Why',       body: 'Choose the reason for your visit.' },
    { n: '2', title: 'Fill Your Details', body: 'Provide your information securely.' },
    { n: '3', title: 'We Review',         body: 'Our team reviews and confirms your request.' },
    { n: '4', title: "You're Confirmed",  body: 'Receive confirmation via WhatsApp or call.' },
  ];

  return (
    <section id="patients" style={{ padding: '72px 32px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, alignItems: 'center' }}>
        {/* Steps */}
        <div>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 40px' }}>How It Works</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {steps.map(({ n, title, body }, i) => (
              <div key={n} style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: i < steps.length - 1 ? 0 : 0 }}>
                {/* Step indicator + connector */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: n === '4' ? '#0d9488' : '#f0fdf9',
                    border: `2px solid ${n === '4' ? '#0d9488' : '#0d9488'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: n === '4' ? '#fff' : '#0d9488',
                    flexShrink: 0,
                  }}>
                    {n === '4'
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      : n}
                  </div>
                  {i < steps.length - 1 && (
                    <div style={{ width: 2, height: 40, background: '#e2f4f1', margin: '4px 0' }} />
                  )}
                </div>
                <div style={{ paddingBottom: i < steps.length - 1 ? 20 : 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 36 }}>
            <Link href="/book" style={{
              display: 'inline-block', padding: '13px 28px',
              background: '#0d9488', color: '#fff',
              borderRadius: 8, fontSize: 15, fontWeight: 700, textDecoration: 'none',
            }}>
              Get Started Now →
            </Link>
          </div>
        </div>

        {/* Photo + review card */}
        <div style={{ position: 'relative' }}>
          <div style={{ borderRadius: 16, overflow: 'hidden', background: '#e2f4f1', minHeight: 360 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/locations/staff-photo.jpg"
              alt="Amise Medical Services clinical team"
              style={{ width: '100%', height: 360, objectFit: 'cover' }}
            />
          </div>
          {/* Floating review card */}
          <div style={{
            position: 'absolute', bottom: -20, right: -20,
            background: '#fff', borderRadius: 12, padding: '16px 20px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)', maxWidth: 220,
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ color: '#f59e0b', fontSize: 16, marginBottom: 8 }}>★★★★★</div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, fontStyle: 'italic', marginBottom: 8 }}>
              "Caring staff, quick appointments and excellent service."
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>— Patient Review</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── About ───────────────────────────────────────────────────────────────────

function About() {
  return (
    <section id="about" style={{ padding: '72px 32px', background: '#f0f7f7', borderBottom: '1px solid #e2e8f0' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 48, alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            About Dr Kabiye
          </div>
          <h2 style={{ margin: '0 0 18px', fontSize: 26, fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>
            Specialist surgical expertise — Dr Dawit Daniel Kabiye, MD, DM
          </h2>
          <p style={{ margin: '0 0 14px', fontSize: 14, color: '#475569', lineHeight: 1.8 }}>
            Dr Kabiye is a Consultant General and Endoscopic Surgeon based in Saint Lucia,
            with specialist qualifications in general and minimally invasive surgery. He holds
            an MD and DM (Doctorate in Medicine) with extensive experience in open and laparoscopic techniques.
          </p>
          <p style={{ margin: 0, fontSize: 14, color: '#475569', lineHeight: 1.8 }}>
            He sees patients across a broad range of surgical conditions — from routine consultations
            and endoscopy to complex elective surgery and specialist clinics including breast, thyroid,
            colorectal, and diabetic foot care.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            { icon: '🔬', label: 'Advanced Endoscopy', sub: 'Colonoscopy, Gastroscopy, ERCP' },
            { icon: '🏥', label: 'General Surgery',    sub: 'Hernia, Gallbladder, Colorectal' },
            { icon: '🩺', label: 'Specialist Clinics', sub: 'Breast, Thyroid, Diabetic Foot'  },
            { icon: '⚡', label: 'Urgent Care',         sub: 'Priority slots available'        },
          ].map(({ icon, label, sub }) => (
            <div key={label} style={{ background: '#fff', borderRadius: 12, padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Contact ─────────────────────────────────────────────────────────────────

function Contact() {
  return (
    <section id="contact" style={{ padding: '72px 32px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '0 0 12px' }}>Get in Touch</h2>
        <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 48px' }}>
          Book online, WhatsApp us, or call — whichever is easiest.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 40 }}>
          <a href="/book" style={contactCardStyle('#0d9488')}>
            <div style={{ fontSize: 26, marginBottom: 10 }}>📅</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Book Online</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>Routine or referral — confirm your slot instantly.</div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#0d9488' }}>Book Now →</span>
          </a>
          <a href={WA_TAPION} target="_blank" rel="noopener noreferrer" style={contactCardStyle('#25D366')}>
            <div style={{ fontSize: 26, marginBottom: 10 }}>💬</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>WhatsApp — Tapion</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>{PHONE_TAPION}</div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#25D366' }}>Message Us →</span>
          </a>
          <a href={WA_RODNEY} target="_blank" rel="noopener noreferrer" style={contactCardStyle('#25D366')}>
            <div style={{ fontSize: 26, marginBottom: 10 }}>💬</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>WhatsApp — Rodney Bay</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>{PHONE_RODNEY}</div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#25D366' }}>Message Us →</span>
          </a>
          <a href={`mailto:${EMAIL}`} style={contactCardStyle('#6366f1')}>
            <div style={{ fontSize: 26, marginBottom: 10 }}>✉️</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Email</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>{EMAIL}</div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#6366f1' }}>Send Email →</span>
          </a>
        </div>

        {/* Emergency notice */}
        <div style={{ padding: '18px 24px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>⚠️ Medical Emergencies</div>
          <p style={{ margin: 0, fontSize: 13, color: '#7f1d1d', lineHeight: 1.7 }}>
            If you are experiencing a medical emergency — chest pain, difficulty breathing, stroke symptoms, severe bleeding — <strong>call 911 immediately</strong> or go to the nearest emergency department. Do not use this website in an emergency.
          </p>
        </div>
      </div>
    </section>
  );
}

function contactCardStyle(colour: string): React.CSSProperties {
  return {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '24px 20px', background: '#fff',
    border: '1px solid #e2e8f0', borderRadius: 12,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    textDecoration: 'none', textAlign: 'center',
    transition: 'box-shadow 0.2s',
  };
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ background: '#0f172a', color: '#94a3b8', padding: '40px 32px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32, marginBottom: 32, alignItems: 'start' }}>
          {/* Brand */}
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0d9488', marginBottom: 4 }}>Amise Medical Services</div>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.8 }}>
              Surgical, Endoscopy &amp; Specialist Care<br />Saint Lucia
            </div>
          </div>

          {/* Tapion */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3-8.59A2 2 0 012.02 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{PHONE_TAPION}</div>
              <div style={{ fontSize: 11, color: '#475569' }}>Tapion Office</div>
            </div>
          </div>

          {/* Rodney Bay */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3-8.59A2 2 0 012.02 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{PHONE_RODNEY}</div>
              <div style={{ fontSize: 11, color: '#475569' }}>Rodney Bay Office</div>
            </div>
          </div>

          {/* Email + Social */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{EMAIL}</div>
                <div style={{ fontSize: 11, color: '#475569' }}>General enquiries</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { href: 'https://facebook.com',   label: 'Facebook',  d: 'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z' },
                { href: 'https://instagram.com',  label: 'Instagram', d: 'M16 8A8 8 0 110 8a8 8 0 0116 0zm-8 4a4 4 0 100-8 4 4 0 000 8zm6.5-9.5a1 1 0 100 2 1 1 0 000-2z' },
                { href: WA_TAPION,                label: 'WhatsApp',  d: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z' },
              ].map(({ href, label, d }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} style={{
                  width: 36, height: 36, borderRadius: '50%', background: '#1e293b',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#0d9488">
                    <path d={d} fillRule="evenodd" clipRule="evenodd" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #1e293b', paddingTop: 20, fontSize: 11, color: '#374151', textAlign: 'center', lineHeight: 1.8 }}>
          <p style={{ margin: '0 0 6px' }}>
            This website is for administrative scheduling purposes only and does not constitute medical advice, clinical triage, or a diagnosis. If you are experiencing a medical emergency, call 911 immediately.
          </p>
          <p style={{ margin: 0 }}>
            © {new Date().getFullYear()} Amise Medical Services, Saint Lucia. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div style={{ background: '#fff', color: '#0f172a', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Nav />
      <main>
        <Hero />
        <FeatureTiles />
        <Offices />
        <WhyUs />
        <HowItWorks />
        <About />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}
