import type { Metadata } from 'next';
import Link from 'next/link';
import { AmsiseLogo } from './components/AmsiseLogo';

export const metadata: Metadata = {
  title: 'Amise Medical Services — Expert Surgical & Endoscopy Care, Saint Lucia',
  description:
    'Amise Medical Services — expert surgical and endoscopy care in Saint Lucia, led by Dr Dawit Daniel Kabiye, MD, DM. Colonoscopy, ERCP, hernia repair, breast clinic, thyroid surgery, diabetic foot care and more.',
};

const WA_TAPION    = 'https://wa.me/17582840557';
const WA_RODNEY    = 'https://wa.me/17587207111';
const PHONE_TAPION = '758-284-0557';
const PHONE_RODNEY = '758-720-7111';
const EMAIL        = 'info@amisemedical.com';

// ── WhatsApp SVG ──────────────────────────────────────────────────────────────

function WaSvg({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.534 5.857L.057 23.885l6.198-1.625A11.93 11.93 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.652-.49-5.189-1.348l-.371-.22-3.676.964.981-3.585-.242-.378A9.944 9.944 0 012 12c0-5.523 4.477-10 10-10s10 4.477 10 10-4.477 10-10 10z"/>
    </svg>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: '#services', label: 'Services'  },
  { href: '#offices',  label: 'Clinics'   },
  { href: '#about',    label: 'About'     },
  { href: '#contact',  label: 'Contact'   },
] as const;

function Nav() {
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)',
      borderBottom: '1px solid #e8f0ef', padding: '0 40px',
    }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 66 }}>
        <AmsiseLogo href="#home" />

        {/* Desktop links */}
        <div className="amise-nav-links">
          {NAV_LINKS.map(({ href, label }) => (
            <a key={href} href={href} style={{
              fontSize: 14, fontWeight: 500, textDecoration: 'none',
              color: '#4b5563', paddingBottom: 2,
              borderBottom: '2px solid transparent',
            }}>{label}</a>
          ))}

          {/* New patient / general info CTA */}
          <Link href="/patient/request" style={{
            fontSize: 14, fontWeight: 700, textDecoration: 'none',
            color: '#0d9488', whiteSpace: 'nowrap',
          }}>
            New Patient?
          </Link>

          {/* WhatsApp icon link */}
          <a href={WA_TAPION} target="_blank" rel="noopener noreferrer"
            aria-label="WhatsApp us"
            style={{ display: 'flex', alignItems: 'center', color: '#25D366', opacity: 0.9 }}
          >
            <WaSvg size={20} color="#25D366" />
          </a>

          {/* Primary CTA */}
          <Link href="/book" style={{
            padding: '10px 22px', background: '#0d9488', color: '#fff',
            borderRadius: 50, fontSize: 14, fontWeight: 700, textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}>
            Book Appointment
          </Link>
        </div>

        {/* Mobile: just show Book button */}
        <div className="amise-nav-mobile-book" style={{ gap: 12, alignItems: 'center' }}>
          <a href={WA_TAPION} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
            <WaSvg size={22} color="#25D366" />
          </a>
          <Link href="/book" style={{
            padding: '9px 18px', background: '#0d9488', color: '#fff',
            borderRadius: 50, fontSize: 13, fontWeight: 700, textDecoration: 'none',
          }}>
            Book
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section id="home" style={{ position: 'relative', background: '#eef7f6', overflow: 'hidden', minHeight: 580 }}>
      {/* Right-side building/landscape photo */}
      {/* Drop an aerial Saint Lucia coastal photo at public/locations/hero-bg.jpg */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/locations/hero-bg.jpg"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute', right: 0, top: 0,
          width: '52%', height: '100%',
          objectFit: 'cover', objectPosition: 'center',
        }}
      />
      {/* Fade gradient from left over the photo */}
      <div style={{
        position: 'absolute', right: '38%', top: 0, bottom: 0, width: '200px',
        background: 'linear-gradient(to right, #eef7f6, transparent)',
        zIndex: 1,
      }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 2,
        maxWidth: 1160, margin: '0 auto',
        padding: '88px 40px 80px',
        width: '55%',
      }}>
        <h1 style={{
          margin: '0 0 14px',
          fontSize: 'clamp(32px, 4.5vw, 56px)',
          fontWeight: 900, color: '#0f172a',
          lineHeight: 1.08, letterSpacing: '-0.03em',
        }}>
          Expert Surgical &amp;<br />Endoscopy Care
        </h1>

        <p style={{
          margin: '0 0 12px',
          fontSize: 'clamp(17px, 2vw, 22px)',
          fontStyle: 'italic', fontWeight: 600,
          color: '#0a6b62',
        }}>
          Compassionate. Advanced. Always.
        </p>

        <p style={{
          margin: '0 0 20px',
          fontSize: 15, color: '#475569', lineHeight: 1.7,
          maxWidth: 400,
        }}>
          Quality care you can trust. Our team is here to guide you every step of the way.
        </p>

        {/* New patient / general info CTA */}
        <Link href="/patient/request" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 20px', marginBottom: 18,
          background: '#fff', color: '#0d9488',
          border: '1.5px solid #0d9488', borderRadius: 50,
          fontSize: 13, fontWeight: 700, textDecoration: 'none',
        }}>
          New here? Tell us what you need →
        </Link>

        {/* Primary CTAs */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
          <Link href="/book" style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 22px', background: '#0d9488', color: '#fff',
            borderRadius: 8, textDecoration: 'none', minWidth: 190,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>Book Appointment</div>
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 1 }}>Routine Visit</div>
            </div>
          </Link>

          <Link href="/book" style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 22px', background: '#e63946', color: '#fff',
            borderRadius: 8, textDecoration: 'none', minWidth: 190,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <circle cx="12" cy="16" r="0.6" fill="white"/>
            </svg>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2 }}>Urgent Triage</div>
              <div style={{ fontSize: 11, opacity: 0.85, marginTop: 1 }}>Need Urgent Care?</div>
            </div>
          </Link>
        </div>

        {/* WhatsApp contacts */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          {[
            { label: 'WhatsApp Tapion',     num: PHONE_TAPION, href: WA_TAPION },
            { label: 'WhatsApp Rodney Bay', num: PHONE_RODNEY, href: WA_RODNEY },
          ].map(({ label, num, href }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 18px', background: '#fff',
              border: '1.5px solid #d1e8e5', borderRadius: 8,
              textDecoration: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}>
              <WaSvg size={18} color="#0d9488" />
              <div>
                <div style={{ fontSize: 11, color: '#0d9488', fontWeight: 600, lineHeight: 1.1 }}>{label}</div>
                <div style={{ fontSize: 14, color: '#0a6b62', fontWeight: 700, lineHeight: 1.3 }}>{num}</div>
              </div>
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: '#6b7280' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          Your information is secure and confidential.
        </div>
      </div>
    </section>
  );
}

// ── WhatsApp Strip ────────────────────────────────────────────────────────────

function WhatsAppStrip() {
  return (
    <div style={{
      background: '#0d9488', padding: '16px 40px',
    }}>
      <div style={{
        maxWidth: 1160, margin: '0 auto',
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16,
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <WaSvg size={22} color="#fff" />
          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
            Prefer to book on WhatsApp? Message us — we usually reply within 30 minutes.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href={WA_TAPION} target="_blank" rel="noopener noreferrer" style={{
            padding: '9px 18px', background: '#fff', color: '#0d9488',
            borderRadius: 50, fontSize: 13, fontWeight: 700, textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}>
            Tapion: {PHONE_TAPION} →
          </a>
          <a href={WA_RODNEY} target="_blank" rel="noopener noreferrer" style={{
            padding: '9px 18px', background: 'rgba(255,255,255,0.15)', color: '#fff',
            border: '1.5px solid rgba(255,255,255,0.5)',
            borderRadius: 50, fontSize: 13, fontWeight: 700, textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}>
            Rodney Bay: {PHONE_RODNEY} →
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Feature Tiles ─────────────────────────────────────────────────────────────

function FeatureTiles() {
  return (
    <section id="services" style={{ background: '#f5fafa', padding: '60px 40px', borderBottom: '1px solid #e2eeed' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        {/* Section heading */}
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, color: '#0f172a' }}>
            Specialist Surgical &amp; Endoscopy Care
          </h2>
          <div style={{ width: 48, height: 3, background: '#0d9488', borderRadius: 2, margin: '0 auto' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>

          {/* Surgical Care */}
          <Tile
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.6">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            }
            ringColor="#0d9488"
            title="Surgical Care"
            body="Hernia repair, cholecystectomy, colorectal, thyroid, diabetic foot surgery."
            cta="Book Surgical Consult →"
            ctaHref="/book"
            ctaColor="#0d9488"
          />

          {/* Endoscopy */}
          <Tile
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.6">
                <ellipse cx="12" cy="13" rx="4" ry="5"/>
                <path d="M8 13 C6 10 7 6 10 5"/>
                <path d="M16 13 C18 10 17 6 14 5"/>
                <path d="M10 5 C10 3 14 3 14 5"/>
                <circle cx="12" cy="8" r="1" fill="#0d9488"/>
              </svg>
            }
            ringColor="#0d9488"
            title="Endoscopy"
            body="Gastroscopy (OGD), colonoscopy, flexible sigmoidoscopy, polypectomy."
            cta="Book Endoscopy →"
            ctaHref="/book"
            ctaColor="#0d9488"
          />

          {/* ERCP / Biliary */}
          <Tile
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.6">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 12 C8 8 12 6 16 8"/>
                <path d="M8 12 C8 16 12 18 16 16"/>
                <circle cx="12" cy="12" r="2" fill="#0d9488"/>
              </svg>
            }
            ringColor="#0d9488"
            title="ERCP / Biliary"
            body="Advanced biliary and pancreatic procedures. Stenting, stone extraction, sphincterotomy."
            cta="ERCP Work-up →"
            ctaHref="/book"
            ctaColor="#0d9488"
          />

          {/* Breast Clinic */}
          <Tile
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.6">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
              </svg>
            }
            ringColor="#0d9488"
            title="Breast Clinic"
            body="Breast lump assessment, mammogram review, biopsy, surgical planning."
            cta="Book Breast Clinic →"
            ctaHref="/book"
            ctaColor="#0d9488"
          />

          {/* Thyroid & Neck */}
          <Tile
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.6">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
                <line x1="12" y1="11" x2="12" y2="15"/>
                <line x1="10" y1="13" x2="14" y2="13"/>
              </svg>
            }
            ringColor="#0d9488"
            title="Thyroid &amp; Neck"
            body="Thyroid nodule assessment, FNAC, thyroidectomy planning."
            cta="Book Thyroid Clinic →"
            ctaHref="/book"
            ctaColor="#0d9488"
          />

          {/* Diabetic Foot */}
          <Tile
            icon={
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.6">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            }
            ringColor="#0d9488"
            title="Diabetic Foot"
            body="Wound assessment, debridement, vascular review, amputations."
            cta="Book Foot Clinic →"
            ctaHref="/book"
            ctaColor="#0d9488"
          />

        </div>
      </div>
    </section>
  );
}

function Tile({
  icon, ringColor, ringBg, title, body, cta, ctaHref, ctaColor,
}: {
  icon: React.ReactNode; ringColor: string; ringBg?: string;
  title: string; body: string; cta: string; ctaHref: string; ctaColor: string;
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '32px 24px',
      boxShadow: '0 1px 8px rgba(0,0,0,0.07)', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        border: `2px solid ${ringColor}22`,
        background: ringBg ?? '#f0fdf9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 18, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.65, marginBottom: 18, flex: 1 }}>{body}</div>
      <a href={ctaHref} style={{ fontSize: 13, fontWeight: 700, color: ctaColor, textDecoration: 'none' }}>{cta}</a>
    </div>
  );
}

// ── Our Offices ────────────────────────────────────────────────────────────────

function Offices() {
  return (
    <section id="offices" style={{ padding: '72px 40px', background: '#fff', borderBottom: '1px solid #e2eeed' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        {/* Section title with underline accent */}
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, color: '#0f172a' }}>Our Offices</h2>
          <div style={{ width: 48, height: 3, background: '#0d9488', borderRadius: 2, margin: '0 auto' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>

          {/* Tapion */}
          <OfficeCard
            img="/locations/tapion.jpg"
            imgAlt="Tapion Hospital, La Toc, Castries, Saint Lucia"
            name="Tapion Hospital Office"
            services="Surgery, Endoscopy, ERCP, Urgent Reviews"
            phone={PHONE_TAPION}
            waHref={WA_TAPION}
            mapsHref="https://maps.google.com/?q=Tapion+Hospital+Castries+Saint+Lucia"
          />

          {/* Rodney Bay */}
          <OfficeCard
            img="/locations/rodney-bay.jpg"
            imgAlt="Providence Building, Rodney Bay, Saint Lucia"
            name="Rodney Bay / Providence Office"
            services="Consultations, Follow-ups, Administrative Services"
            phone={PHONE_RODNEY}
            waHref={WA_RODNEY}
            mapsHref="https://maps.google.com/?q=Providence+Building+Rodney+Bay+Saint+Lucia"
          />
        </div>
      </div>
    </section>
  );
}

function OfficeCard({ img, imgAlt, name, services, phone, waHref, mapsHref }: {
  img: string; imgAlt: string; name: string; services: string;
  phone: string; waHref: string; mapsHref: string;
}) {
  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 2px 16px rgba(0,0,0,0.1)',
      border: '1px solid #e2eeed',
      display: 'flex', background: '#fff',
    }}>
      {/* Building photo — left 42% */}
      <div style={{ position: 'relative', width: '42%', flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img} alt={imgAlt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        {/* Map pin badge */}
        <div style={{
          position: 'absolute', bottom: 14, left: 14,
          width: 34, height: 34, borderRadius: '50%',
          background: '#0d9488',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      </div>

      {/* Content — right 58% */}
      <div style={{ padding: '24px 24px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#0d9488', lineHeight: 1.3 }}>{name}</h3>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{services}</p>

        <a href={waHref} target="_blank" rel="noopener noreferrer" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 16, fontWeight: 700, color: '#374151',
          textDecoration: 'none', marginBottom: 20,
        }}>
          <WaSvg size={20} color="#0d9488" />
          {phone}
        </a>

        <a href={mapsHref} target="_blank" rel="noopener noreferrer" style={{
          display: 'block', padding: '11px 16px',
          background: '#0d9488', color: '#fff',
          borderRadius: 8, fontSize: 14, fontWeight: 700,
          textDecoration: 'none', textAlign: 'center',
        }}>
          Get Directions
        </a>
      </div>
    </div>
  );
}

// ── Why Choose Us ─────────────────────────────────────────────────────────────

function WhyUs() {
  const pillars = [
    {
      icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.7"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
      title: 'Experienced Specialists',
      body: 'Advanced care with compassion.',
    },
    {
      icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.7"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
      title: 'Timely Appointments',
      body: 'We respect your time.',
    },
    {
      icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.7"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
      title: 'Secure & Confidential',
      body: 'Your privacy is our priority.',
    },
    {
      icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.7"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
      title: 'Patient-Centered',
      body: 'Care tailored to your needs.',
    },
    {
      icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.7"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
      title: 'Advanced Procedures',
      body: 'Endoscopy, ERCP & minimally invasive surgery.',
    },
  ];

  return (
    <section style={{ padding: '60px 40px', background: '#f9fafb', borderBottom: '1px solid #e2eeed' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 44px' }}>
          Why Patients Choose Amise Medical Services
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          {pillars.map(({ icon, title, body }) => (
            <div key={title} style={{ textAlign: 'center', padding: '12px 8px' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                border: '1.5px solid #c0e4e0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px',
              }}>
                {icon}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>{title}</div>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>{body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── How It Works ──────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      n: '1',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
          <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
        </svg>
      ),
      title: 'Tell Us Why',
      body: 'Choose the reason for your visit.',
    },
    {
      n: '2',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
      title: 'Fill Your Details',
      body: 'Provide your information securely.',
    },
    {
      n: '3',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
        </svg>
      ),
      title: 'We Review',
      body: 'Our team reviews and confirms your request.',
    },
    {
      n: '4',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ),
      title: "You're Confirmed",
      body: 'Receive confirmation via WhatsApp or call.',
      done: true,
    },
  ];

  return (
    <section id="patients" style={{ padding: '72px 40px', background: '#fff', borderBottom: '1px solid #e2eeed' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 60, alignItems: 'center' }}>

        {/* Steps */}
        <div>
          <h2 style={{ margin: '0 0 48px', fontSize: 26, fontWeight: 800, color: '#0f172a' }}>How It Works</h2>

          {/* Horizontal step row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 40 }}>
            {steps.map(({ n, icon, title, body, done }, i) => (
              <div key={n} style={{ display: 'flex', alignItems: 'flex-start', flex: 1 }}>
                {/* Step + connector */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  {/* Circle */}
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: done ? '#0d9488' : '#0d9488',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(13,149,136,0.3)',
                    marginBottom: 14, flexShrink: 0,
                    position: 'relative',
                  }}>
                    {/* Step number badge */}
                    {!done && (
                      <div style={{
                        position: 'absolute', top: -6, left: -6,
                        width: 20, height: 20, borderRadius: '50%',
                        background: '#fff', border: '1.5px solid #0d9488',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800, color: '#0d9488',
                      }}>{n}</div>
                    )}
                    {icon}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 5 }}>{title}</div>
                  <div style={{ fontSize: 11.5, color: '#6b7280', lineHeight: 1.55, maxWidth: 120 }}>{body}</div>
                </div>

                {/* Dashed connector (not after last) */}
                {i < steps.length - 1 && (
                  <div style={{
                    flex: 0, alignSelf: 'flex-start', marginTop: 24,
                    width: 32, borderTop: '2px dashed #c0e4e0',
                    flexShrink: 0,
                  }} />
                )}
              </div>
            ))}
          </div>

          {/* Questionnaire CTA */}
          <div style={{
            background: '#f0fdf9', border: '1px solid #a7f3d0',
            borderRadius: 10, padding: '18px 22px', marginBottom: 24,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
              Before your visit: Complete our digital intake questionnaire
            </div>
            <Link href="/questionnaire" style={{
              display: 'inline-block', padding: '9px 20px',
              background: '#0d9488', color: '#fff',
              borderRadius: 6, fontSize: 13, fontWeight: 700,
              textDecoration: 'none', marginBottom: 10,
            }}>
              Start Questionnaire →
            </Link>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Takes 3–5 minutes. Reduces your consultation time significantly.
            </div>
          </div>

          <div>
            <Link href="/book" style={{
              display: 'inline-block', padding: '13px 32px',
              background: '#0d9488', color: '#fff',
              borderRadius: 8, fontSize: 15, fontWeight: 700,
              textDecoration: 'none',
            }}>
              Get Started Now →
            </Link>
          </div>
        </div>

        {/* Photo + floating review card */}
        <div style={{ position: 'relative', paddingBottom: 24 }}>
          <div style={{ borderRadius: 16, overflow: 'hidden', background: '#e2f4f1' }}>
            {/* Drop a healthcare team photo at public/locations/staff-photo.jpg */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/locations/staff-photo.jpg"
              alt="Amise Medical Services — clinical team"
              style={{ width: '100%', height: 380, objectFit: 'cover', objectPosition: 'top', display: 'block' }}
            />
          </div>
          {/* Floating review card */}
          <div style={{
            position: 'absolute', bottom: 0, right: -12,
            background: '#fff', borderRadius: 12,
            padding: '18px 22px', maxWidth: 210,
            boxShadow: '0 6px 24px rgba(0,0,0,0.13)',
            border: '1px solid #e8f0ef',
          }}>
            <div style={{ color: '#f59e0b', fontSize: 16, marginBottom: 8, letterSpacing: 1 }}>★★★★★</div>
            <p style={{ margin: '0 0 10px', fontSize: 13, color: '#374151', lineHeight: 1.6, fontStyle: 'italic' }}>
              &ldquo;Caring staff, quick appointments and excellent service.&rdquo;
            </p>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>— Patient Review</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Contact ───────────────────────────────────────────────────────────────────

function Contact() {
  return (
    <section id="contact" style={{ padding: '64px 40px', background: '#f9fafb', borderBottom: '1px solid #e2eeed' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 10px' }}>Get in Touch</h2>
        <p style={{ fontSize: 14, color: '#64748b', margin: '0 0 44px' }}>
          Book online, WhatsApp us, or call — whichever is easiest for you.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 18, marginBottom: 36 }}>
          {[
            { icon: '📅', title: 'Book Online',            desc: 'Routine or referral — confirm instantly.',      cta: 'Book Now →',     href: '/book',           color: '#0d9488' },
            { icon: '💬', title: 'WhatsApp — Tapion',       desc: PHONE_TAPION,                                   cta: 'Message Us →',   href: WA_TAPION,         color: '#25D366', external: true },
            { icon: '💬', title: 'WhatsApp — Rodney Bay',   desc: PHONE_RODNEY,                                   cta: 'Message Us →',   href: WA_RODNEY,         color: '#25D366', external: true },
            { icon: '✉️', title: 'Email',                   desc: EMAIL,                                          cta: 'Send Email →',   href: `mailto:${EMAIL}`, color: '#6366f1' },
          ].map(({ icon, title, desc, cta, href, color, external }) => (
            <a
              key={title}
              href={href}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '26px 18px', background: '#fff',
                border: '1px solid #e2eeed', borderRadius: 12,
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                textDecoration: 'none', textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{title}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16, flex: 1 }}>{desc}</div>
              <span style={{ fontSize: 12, fontWeight: 700, color }}>{cta}</span>
            </a>
          ))}
        </div>
        {/* Emergency */}
        <div style={{ padding: '18px 24px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 10, textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>⚠️ Medical Emergencies</div>
          <p style={{ margin: 0, fontSize: 13, color: '#7f1d1d', lineHeight: 1.7 }}>
            If you are experiencing a medical emergency — chest pain, difficulty breathing, stroke symptoms, severe bleeding — <strong>call 911 immediately</strong> or attend the nearest emergency department. Do not use this website in an emergency.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ background: '#0b2a35', color: '#94a3b8', padding: '44px 40px 28px' }}>
      <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', gap: 0, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 24 }}>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <AmsiseLogo dark href="#home" />
          <div style={{ borderLeft: '1px solid #1e4a5a', paddingLeft: 14 }}>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
              Surgical, Endoscopy &amp; Specialist Care<br />Saint Lucia
            </div>
          </div>
        </div>

        {/* Phone Tapion */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#1e4a5a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3-8.59A2 2 0 012.02 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{PHONE_TAPION}</div>
            <div style={{ fontSize: 11, color: '#4a7a8a' }}>Tapion Office</div>
          </div>
        </div>

        {/* Phone Rodney */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#1e4a5a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3-8.59A2 2 0 012.02 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{PHONE_RODNEY}</div>
            <div style={{ fontSize: 11, color: '#4a7a8a' }}>Rodney Bay Office</div>
          </div>
        </div>

        {/* Email */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#1e4a5a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{EMAIL}</div>
            <div style={{ fontSize: 11, color: '#4a7a8a' }}>General enquiries</div>
          </div>
        </div>

        {/* Social */}
        <div style={{ display: 'flex', gap: 10 }}>
          <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook"
            style={{ width: 38, height: 38, borderRadius: '50%', background: '#1e4a5a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#94a3b8">
              <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
            </svg>
          </a>
          <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram"
            style={{ width: 38, height: 38, borderRadius: '50%', background: '#1e4a5a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8">
              <rect x="2" y="2" width="20" height="20" rx="5"/>
              <circle cx="12" cy="12" r="4"/>
              <circle cx="17.5" cy="6.5" r="0.5" fill="#94a3b8"/>
            </svg>
          </a>
          <a href={WA_TAPION} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"
            style={{ width: 38, height: 38, borderRadius: '50%', background: '#25D36622', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <WaSvg size={18} color="#25D366" />
          </a>
        </div>
      </div>

      {/* Footer links row */}
      <div style={{ maxWidth: 1160, margin: '32px auto 0', borderTop: '1px solid #1e4a5a', paddingTop: 28, display: 'flex', flexWrap: 'wrap', gap: 40, rowGap: 20 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Patient Resources</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Link href="/guidance" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>Health Guidance &amp; Screening</Link>
            <Link href="/pathway" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>Care Pathways</Link>
            <Link href="/book" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>Book an Appointment</Link>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Healthcare Providers</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <Link href="/refer" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>Submit a Referral</Link>
            <Link href="/refer" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>FHIR Referral Portal</Link>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Services</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <a href="#services" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>What We Treat</a>
            <a href="#offices" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>Our Clinics</a>
            <a href="#about" style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none' }}>About Amise Medical Services</a>
          </div>
        </div>
      </div>

      {/* Bottom disclaimer */}
      <div style={{ maxWidth: 1160, margin: '20px auto 0', borderTop: '1px solid #1e4a5a', paddingTop: 18, fontSize: 11, color: '#2d5a6a', textAlign: 'center', lineHeight: 1.8 }}>
        This website is for administrative scheduling only and does not constitute medical advice or clinical triage.
        If you are experiencing a medical emergency, call 911 immediately. &nbsp;·&nbsp;
        © {new Date().getFullYear()} Amise Medical Services, Saint Lucia. All rights reserved.
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div style={{ background: '#fff', color: '#0f172a', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif', minHeight: '100vh' }}>
      <Nav />
      <main>
        <Hero />
        <WhatsAppStrip />
        <FeatureTiles />
        <Offices />
        <WhyUs />
        <HowItWorks />
        <Contact />

        {/* For Providers strip */}
        <section style={{ padding: '48px 40px', background: '#0b2a35', textAlign: 'center' }}>
          <div style={{ maxWidth: 700, margin: '0 auto' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Healthcare Providers</div>
            <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>Refer a Patient to Amise Medical Services</h2>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: '#4a7a8a', fontWeight: 600 }}>
              General &amp; Endoscopic Surgery — led by Dr Dawit Daniel Kabiye, MD, DM
            </p>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: '#94a3b8', lineHeight: 1.7 }}>
              Structured GP and specialist referral portal with HL7 FHIR R4 support. Priority, routine, and urgent referral tracks. Confirmation sent to you and your patient.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/refer" style={{ padding: '12px 28px', background: '#0d9488', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
                Submit a Referral →
              </a>
              <a href="/guidance" style={{ padding: '12px 28px', background: 'transparent', color: '#94a3b8', border: '1px solid #374151', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
                Patient Health Guidance
              </a>
            </div>
            <div style={{ marginTop: 20, fontSize: 12, color: '#4a7a8a' }}>
              FHIR R4 endpoint: POST /api/referral/fhir · Content-Type: application/fhir+json
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
