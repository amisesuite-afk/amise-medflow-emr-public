import type { Metadata } from 'next';
import Link from 'next/link';
import { WA_TAPION, WA_RODNEY, PHONE_TAPION, PHONE_RODNEY, WaSvg } from '@/app/components/shared';

export const metadata: Metadata = {
  title: 'ERCP & Biliary Services — Advanced Bile Duct Procedures',
  description: 'Expert ERCP and biliary procedures in Saint Lucia — gallstones, bile duct stenting, sphincterotomy, and cholangitis treatment by Dr Dawit Daniel Kabiye, MD, DM at Tapion Hospital.',
};

function SectionHeading({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{children}</h2>
      <div style={{ width: 40, height: 3, background: '#0d9488', borderRadius: 2, marginBottom: sub ? 12 : 0 }} />
      {sub && <p style={{ margin: 0, fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>{sub}</p>}
    </div>
  );
}

export default function ErpcPage() {
  return (
    <>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #eef7f6 0%, #f0fdf9 100%)', padding: '64px 40px 56px', borderBottom: '1px solid #e2eeed' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <Link href="/#services" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0d9488', textDecoration: 'none', marginBottom: 20, fontWeight: 600 }}>
            ← Back to Services
          </Link>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Advanced Biliary & Pancreatic Care</div>
          <h1 style={{ margin: '0 0 16px', fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
            ERCP &amp; Biliary Services
          </h1>
          <p style={{ margin: '0 0 28px', fontSize: 17, color: '#374151', lineHeight: 1.8, maxWidth: 640 }}>
            Endoscopic Retrograde Cholangiopancreatography (ERCP) is a specialised procedure combining endoscopy and X-ray to diagnose and treat conditions of the bile ducts and pancreatic duct. Dr Kabiye is one of the few surgeons in the Eastern Caribbean with dedicated ERCP expertise.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/book" style={{ padding: '12px 28px', background: '#0d9488', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Request ERCP Work-up →
            </Link>
            <a href={WA_TAPION} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: '#fff', border: '1.5px solid #0d9488', color: '#0d9488', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              <WaSvg size={16} color="#0d9488" /> WhatsApp Us
            </a>
          </div>
        </div>
      </section>

      {/* What is ERCP */}
      <section style={{ padding: '64px 40px', background: '#fff' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <SectionHeading>What is ERCP?</SectionHeading>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
            <div>
              <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.9, marginTop: 0 }}>
                ERCP uses a flexible camera (duodenoscope) passed through the mouth into the small intestine. A thin tube is then guided into the bile duct or pancreatic duct, and dye is injected under X-ray guidance to visualise the ducts.
              </p>
              <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.9 }}>
                Crucially, ERCP is not just a diagnostic tool — most procedures include treatment at the same sitting. A stone can be removed, a stricture dilated, or a stent placed, all without open surgery.
              </p>
            </div>
            <div style={{ background: '#f0fdf9', border: '1px solid #a7f3d0', borderRadius: 12, padding: '24px 20px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#065f46', marginBottom: 14 }}>ERCP at a Glance</div>
              {[
                ['Duration', '45–90 minutes'],
                ['Anaesthesia', 'Deep sedation or general anaesthesia'],
                ['Hospital stay', 'Usually same-day; overnight if complex'],
                ['Recovery', '1–3 days rest at home'],
                ['Success rate', '> 90% for bile duct stones'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #d1fae5', padding: '8px 0', fontSize: 13 }}>
                  <span style={{ color: '#374151', fontWeight: 600 }}>{k}</span>
                  <span style={{ color: '#0d9488', fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Conditions Treated */}
      <section style={{ padding: '64px 40px', background: '#f5fafa' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <SectionHeading sub="ERCP treats a range of conditions affecting the bile duct, gallbladder, and pancreatic duct.">
            Conditions We Treat
          </SectionHeading>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {[
              { icon: '🪨', title: 'Choledocholithiasis', body: 'Stones trapped in the common bile duct causing jaundice, pain, or cholangitis. ERCP with sphincterotomy and stone extraction is the first-line treatment.' },
              { icon: '🌡️', title: 'Acute Cholangitis', body: 'Bacterial infection of the bile duct causing fever, jaundice, and right upper quadrant pain. Emergency biliary drainage via ERCP is often life-saving.' },
              { icon: '🔒', title: 'Biliary Strictures', body: 'Narrowing of the bile duct due to post-operative scarring, chronic pancreatitis, or malignancy. A stent is placed to restore bile flow and relieve jaundice.' },
              { icon: '🦠', title: 'Primary Sclerosing Cholangitis', body: 'Progressive inflammatory narrowing of the bile ducts. ERCP with balloon dilation and stenting provides palliation and symptom relief.' },
              { icon: '🔧', title: 'Post-operative Bile Leak', body: 'Bile leakage after cholecystectomy or liver surgery. ERCP with sphincterotomy ± stenting seals most leaks without the need for reoperation.' },
              { icon: '🩺', title: 'Pancreatic Duct Disease', body: 'Strictures or stones in the pancreatic duct causing chronic pancreatitis pain. ERCP can drain the duct, decompress it, and reduce pain episodes.' },
            ].map(({ icon, title, body }) => (
              <div key={title} style={{ background: '#fff', border: '1px solid #e2eeed', borderRadius: 12, padding: '24px 20px' }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>{icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{title}</div>
                <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Procedures */}
      <section style={{ padding: '64px 40px', background: '#fff' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <SectionHeading>ERCP Procedures We Perform</SectionHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { title: 'Sphincterotomy', body: 'A small cut in the sphincter of Oddi (the muscle at the opening of the bile duct) to allow stones to pass and drainage to occur. The foundation of most ERCP procedures.' },
              { title: 'Stone Extraction', body: 'Using a retrieval balloon or basket passed through the scope, bile duct stones are caught and removed. Success rate exceeds 90% for most stones. Very large stones may require mechanical or laser lithotripsy first.' },
              { title: 'Biliary Stenting', body: 'A plastic or self-expanding metal stent is inserted to keep the bile duct open in cases of stricture, malignant obstruction, or bile leak. Relieves jaundice, itching, and infection rapidly.' },
              { title: 'Balloon Dilation', body: 'A balloon is inflated within the bile duct to widen a narrowed segment — used for benign strictures or as an adjunct to stone removal.' },
              { title: 'Nasobiliary Drain', body: 'A small tube left in the bile duct and exiting through the nose for temporary external bile drainage — used in severe cholangitis when definitive treatment cannot be completed in one session.' },
              { title: 'Tissue Sampling (Brush Cytology / Biopsy)', body: 'Cells or tissue are taken from within the bile duct to test for malignancy. Important when a stricture is of uncertain cause.' },
            ].map(({ title, body }) => (
              <div key={title} style={{ background: '#f8fafc', border: '1px solid #e2eeed', borderRadius: 10, padding: '16px 20px', display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, alignItems: 'start' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0d9488' }}>{title}</div>
                <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Risks & Benefits */}
      <section style={{ padding: '64px 40px', background: '#f5fafa' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <SectionHeading>Risks &amp; Benefits</SectionHeading>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#065f46', marginBottom: 14 }}>Benefits</div>
              {[
                'Treats bile duct stones without open or laparoscopic surgery',
                'Relieves jaundice, cholangitis, and bile leak in a single session',
                'Avoids the need for surgical exploration of the bile duct',
                'Same-day procedure in most cases',
                'Provides tissue diagnosis when malignancy is suspected',
                'Bridge to definitive surgery when the patient is unfit for immediate operation',
              ].map(b => (
                <div key={b} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, color: '#065f46', fontWeight: 800 }}>✓</div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{b}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#7f1d1d', marginBottom: 14 }}>Risks</div>
              {[
                { risk: 'Post-ERCP Pancreatitis (3–5%)', detail: 'Inflammation of the pancreas — the most common complication. Usually mild and self-limiting with fluids and rest; rarely severe.' },
                { risk: 'Bleeding (~1%)', detail: 'Occurs at the sphincterotomy site. Most episodes stop spontaneously or are controlled endoscopically.' },
                { risk: 'Perforation (<1%)', detail: 'Rarely, the endoscope can perforate the duodenum or bile duct. May require surgical repair.' },
                { risk: 'Cholangitis / Infection (~1%)', detail: 'Bile duct infection can occur if bile drainage is incomplete. Preventable with antibiotics and adequate drainage.' },
                { risk: 'Failed procedure (~5–10%)', detail: 'Difficult anatomy (previous surgery, tight stricture) can prevent successful duct cannulation. Alternative approaches are then considered.' },
              ].map(({ risk, detail }) => (
                <div key={risk} style={{ marginBottom: 12, background: '#fff', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 2 }}>{risk}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>{detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Amise */}
      <section style={{ padding: '64px 40px', background: '#0b2a35' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Why Amise Medical Services</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 800, color: '#f1f5f9' }}>Advanced ERCP Expertise in the Eastern Caribbean</h2>
          <div style={{ width: 40, height: 3, background: '#0d9488', borderRadius: 2, marginBottom: 28 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {[
              { icon: '🎓', title: 'Fellowship-trained specialist', body: 'Dr Kabiye holds advanced fellowship training in therapeutic endoscopy and ERCP, with extensive experience in complex biliary cases.' },
              { icon: '🏥', title: 'Full biliary surgery capability', body: 'As a consultant general surgeon, Dr Kabiye can provide the complete spectrum from ERCP to laparoscopic cholecystectomy to open biliary surgery when required.' },
              { icon: '⚡', title: 'Urgent availability', body: 'Acute cholangitis and obstructive jaundice require rapid access. We prioritise urgent ERCP cases with same-week or emergency availability at Tapion Hospital.' },
              { icon: '🤝', title: 'Coordinated care', body: 'We liaise directly with your referring physician, GI team, oncologist, or ICU to ensure seamless care. Procedure reports are sent on the day.' },
            ].map(({ icon, title, body }) => (
              <div key={title} style={{ background: '#1e4a5a', borderRadius: 12, padding: '24px 20px' }}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>{icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>{title}</div>
                <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>{body}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/book" style={{ padding: '13px 30px', background: '#0d9488', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Book a Consultation →
            </Link>
            <Link href="/refer" style={{ padding: '13px 24px', background: 'transparent', color: '#94a3b8', border: '1px solid #374151', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
              Submit a Referral
            </Link>
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section style={{ padding: '56px 40px', background: '#0d9488', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: '#fff' }}>Need an urgent ERCP assessment?</h2>
          <p style={{ margin: '0 0 28px', fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
            Call or WhatsApp our Tapion office directly. For GP and specialist referrals, please use our online referral portal.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={`tel:+1${PHONE_TAPION.replace(/-/g,'')}`} style={{ padding: '13px 30px', background: '#fff', color: '#0d9488', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Call Tapion: {PHONE_TAPION}
            </a>
            <a href={WA_TAPION} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 24px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              <WaSvg size={16} color="#fff" /> WhatsApp
            </a>
            <Link href="/refer" style={{ padding: '13px 24px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Refer a Patient
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
