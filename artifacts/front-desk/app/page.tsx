import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Amise Medical Services — General & Endoscopic Surgery, Saint Lucia',
  description:
    'Dr Dawit Daniel Kabiye, MD, DM. General and endoscopic surgery specialist in Saint Lucia. Online appointment booking, colonoscopy, ERCP, hernia, breast clinic, diabetic foot care and more.',
};

const PHONE_PRIMARY   = '459-2227';
const PHONE_SECONDARY = '284-0557';
const WHATSAPP_LINK   = 'https://wa.me/17584592227';

// ─── Sub-components ──────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav style={{
      position:        'sticky', top: 0, zIndex: 50,
      background:      'rgba(15,23,42,0.96)',
      backdropFilter:  'blur(12px)',
      borderBottom:    '1px solid #1e293b',
      padding:         '0 24px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        {/* Logo */}
        <a href="#home" style={{ textDecoration: 'none' }}>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>Amise Medical Services</div>
            <div style={{ fontSize: 10, color: '#0d9488', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Saint Lucia</div>
          </div>
        </a>

        {/* Links */}
        <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
          {[
            { href: '#about',     label: 'About'     },
            { href: '#services',  label: 'Services'  },
            { href: '#locations', label: 'Locations' },
            { href: '#contact',   label: 'Contact'   },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'none', fontWeight: 500 }}
            >
              {label}
            </a>
          ))}
          <Link
            href="/book"
            style={{
              padding:       '8px 18px',
              background:    '#0d9488',
              color:         '#fff',
              borderRadius:  6,
              fontSize:      13,
              fontWeight:    700,
              textDecoration: 'none',
            }}
          >
            Book Appointment
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section id="home" style={{
      background:     'linear-gradient(160deg, #0f172a 0%, #0d1f2d 60%, #0a1f1e 100%)',
      padding:        '96px 24px 80px',
      borderBottom:   '1px solid #1e293b',
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', padding: '4px 14px', borderRadius: 100, background: '#0d948822', border: '1px solid #0d9488', fontSize: 11, fontWeight: 700, color: '#0d9488', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 24 }}>
          General &amp; Endoscopic Surgery · Saint Lucia
        </div>

        <h1 style={{ margin: '0 0 16px', fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, color: '#f1f5f9', lineHeight: 1.15, letterSpacing: '-0.03em' }}>
          Dr Dawit Daniel Kabiye
          <span style={{ display: 'block', fontSize: 'clamp(14px, 2.5vw, 20px)', fontWeight: 400, color: '#64748b', marginTop: 10, letterSpacing: 0 }}>
            MD, DM — Consultant Surgeon
          </span>
        </h1>

        <p style={{ margin: '0 0 40px', fontSize: 'clamp(14px, 2vw, 17px)', color: '#94a3b8', lineHeight: 1.8, maxWidth: 580, marginLeft: 'auto', marginRight: 'auto' }}>
          Specialist surgical care in Saint Lucia — covering general surgery, advanced endoscopy,
          breast surgery, thyroid, colorectal, hernia repair, and diabetic foot care. Serving patients
          at Rodney Bay, Castries, and Tapion Hospital.
        </p>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/book" style={{
            display: 'inline-block', padding: '14px 32px',
            background: '#0d9488', color: '#fff', borderRadius: 8,
            fontSize: 15, fontWeight: 700, textDecoration: 'none',
          }}>
            Book an Appointment
          </Link>
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" style={{
            display: 'inline-block', padding: '14px 32px',
            background: '#1e293b', color: '#e2e8f0',
            border: '1px solid #374151', borderRadius: 8,
            fontSize: 15, fontWeight: 600, textDecoration: 'none',
          }}>
            WhatsApp Us
          </a>
        </div>

        {/* Trust bar */}
        <div style={{ marginTop: 56, display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { icon: '🏥', text: 'Tapion Hospital' },
            { icon: '📍', text: 'Rodney Bay · Castries' },
            { icon: '📞', text: `${PHONE_PRIMARY} / ${PHONE_SECONDARY}` },
          ].map(({ icon, text }) => (
            <div key={text} style={{ fontSize: 13, color: '#475569', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" style={{ padding: '80px 24px', borderBottom: '1px solid #1e293b' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <SectionLabel>About Dr Kabiye</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 40, alignItems: 'start' }}>
          <div>
            <h2 style={{ margin: '0 0 16px', fontSize: 26, fontWeight: 800, color: '#f1f5f9', lineHeight: 1.3 }}>
              Specialist surgical expertise in Saint Lucia
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: '#94a3b8', lineHeight: 1.8 }}>
              Dr Dawit Daniel Kabiye is a Consultant General and Endoscopic Surgeon based in Saint Lucia,
              with specialist training and qualifications in general and minimally invasive surgery.
              He holds an MD and a DM (Doctorate in Medicine) and has extensive experience in both
              open and laparoscopic surgical techniques.
            </p>
            <p style={{ margin: 0, fontSize: 14, color: '#94a3b8', lineHeight: 1.8 }}>
              Dr Kabiye sees patients across a broad range of general and endoscopic surgical conditions —
              from routine consultations and endoscopy to complex elective surgery and specialist clinics
              including breast, thyroid, colorectal, and diabetic foot care.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Qualification',  value: 'MD, DM — General & Endoscopic Surgery' },
              { label: 'Practice',       value: 'Amise Medical Services, Saint Lucia' },
              { label: 'Hospital',       value: 'Tapion Hospital (La Toc, Castries)' },
              { label: 'Clinics',        value: 'Rodney Bay · Castries' },
              { label: 'Appointments',   value: 'Online booking · WhatsApp · Telephone' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#1e293b', borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 100, paddingTop: 1 }}>{label}</div>
                <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Services() {
  const services = [
    {
      icon: '🔬',
      title: 'Colonoscopy & Gastroscopy',
      body: 'Diagnostic and therapeutic upper and lower GI endoscopy. Polyp removal, biopsy, and investigation of bowel and stomach symptoms.',
    },
    {
      icon: '🫀',
      title: 'ERCP — Biliary Procedures',
      body: 'Advanced endoscopic retrograde cholangiopancreatography for bile duct stones, strictures, and pancreatic conditions. Performed at Tapion Hospital.',
    },
    {
      icon: '🩹',
      title: 'Hernia Repair',
      body: 'Laparoscopic and open repair of inguinal, umbilical, incisional, and other hernias. Minimally invasive techniques for faster recovery.',
    },
    {
      icon: '💛',
      title: 'Gallbladder Surgery',
      body: 'Laparoscopic cholecystectomy (gallbladder removal) for gallstones, biliary colic, and cholecystitis.',
    },
    {
      icon: '🩺',
      title: 'Breast Clinic',
      body: 'Assessment of breast lumps, nipple discharge, skin changes, and cancer screening. Includes review of mammogram and ultrasound results.',
    },
    {
      icon: '🦋',
      title: 'Thyroid Surgery',
      body: 'Total and partial thyroidectomy for goitre, thyroid nodules, and thyroid cancer. Pre-operative assessment and post-operative care.',
    },
    {
      icon: '🦶',
      title: 'Diabetic Foot Clinic',
      body: 'Specialist assessment and management of diabetic foot complications — ulcers, infections, vascular assessment, and preventive care.',
    },
    {
      icon: '🔴',
      title: 'Colorectal Surgery',
      body: 'Haemorrhoid surgery, rectal prolapse, colonic resection, and management of colorectal conditions including cancer.',
    },
    {
      icon: '🏥',
      title: 'Elective General Surgery',
      body: 'Wide range of planned surgical procedures. Full pre-operative assessment, surgical care, and structured post-operative follow-up.',
    },
    {
      icon: '✂️',
      title: 'Minor Procedures',
      body: 'Removal of lipomas, sebaceous cysts, skin lesions, and other minor surgical procedures under local anaesthesia at the clinic.',
    },
    {
      icon: '📋',
      title: 'Specialist Referrals',
      body: 'Fast-track appointments for patients referred by their GP or another specialist. Priority scheduling and referral verification.',
    },
    {
      icon: '📞',
      title: 'Telephone Review',
      body: 'Follow-up, post-result, and post-discharge telephone consultations. Convenient and efficient for ongoing care.',
    },
  ];

  return (
    <section id="services" style={{ padding: '80px 24px', background: '#080f1a', borderBottom: '1px solid #1e293b' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>
        <SectionLabel>Services</SectionLabel>
        <h2 style={{ margin: '0 0 12px', fontSize: 26, fontWeight: 800, color: '#f1f5f9' }}>
          What we treat
        </h2>
        <p style={{ margin: '0 0 48px', fontSize: 14, color: '#64748b', maxWidth: 500 }}>
          A broad range of general and endoscopic surgical conditions, managed at clinic and Tapion Hospital.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {services.map(({ icon, title, body }) => (
            <div key={title} style={{ background: '#1e293b', borderRadius: 10, padding: '20px 22px', border: '1px solid #374151' }}>
              <div style={{ fontSize: 26, marginBottom: 12 }}>{icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>{title}</div>
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.65 }}>{body}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BookingTracks() {
  const tracks = [
    {
      badge:   'Routine',
      colour:  '#0d9488',
      icon:    '📅',
      title:   'Routine Appointment',
      desc:    'Book directly online for a standard consultation or follow-up. Slots are confirmed immediately on booking.',
      steps:   ['Choose your appointment type', 'Enter your details', 'Select a slot — confirmed instantly', 'Receive confirmation via email and WhatsApp'],
      cta:     'Book Online →',
      href:    '/book',
    },
    {
      badge:   'Referral',
      colour:  '#6366f1',
      icon:    '📋',
      title:   'GP / Specialist Referral',
      desc:    'Your doctor has referred you to Dr Kabiye. Priority scheduling — staff confirm your appointment within 24 hours.',
      steps:   ['Submit your referral details online', 'Our team verifies your referral', 'We contact you to confirm your slot', 'Receive full prep instructions by email'],
      cta:     'Submit Referral →',
      href:    '/book',
    },
    {
      badge:   'Urgent',
      colour:  '#f59e0b',
      icon:    '⚡',
      title:   'Urgent Concern',
      desc:    'If your clinical situation requires prompt attention, call us directly. Staff will arrange a priority slot — same day or next available.',
      steps:   ['Call 459-2227 / 284-0557', 'Describe your urgent concern to our team', 'A priority appointment is arranged immediately', 'You will receive confirmation by phone and message'],
      cta:     `Call ${PHONE_PRIMARY}`,
      href:    `tel:+17584592227`,
    },
  ];

  return (
    <section id="booking" style={{ padding: '80px 24px', borderBottom: '1px solid #1e293b' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>
        <SectionLabel>Appointments</SectionLabel>
        <h2 style={{ margin: '0 0 12px', fontSize: 26, fontWeight: 800, color: '#f1f5f9' }}>
          How to book
        </h2>
        <p style={{ margin: '0 0 48px', fontSize: 14, color: '#64748b', maxWidth: 500 }}>
          Three ways to access care — choose the one that suits your situation.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {tracks.map(({ badge, colour, icon, title, desc, steps, cta, href }) => (
            <div key={badge} style={{ background: '#1e293b', borderRadius: 12, padding: '28px 24px', border: `1px solid ${colour}44`, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 22 }}>{icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: colour, textTransform: 'uppercase', letterSpacing: '0.08em', background: `${colour}18`, padding: '3px 10px', borderRadius: 100 }}>{badge}</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', marginBottom: 10 }}>{title}</div>
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7, marginBottom: 20 }}>{desc}</div>
              <ol style={{ margin: '0 0 24px', padding: '0 0 0 18px', color: '#64748b', fontSize: 12, lineHeight: 1.8 }}>
                {steps.map(step => <li key={step}>{step}</li>)}
              </ol>
              <div style={{ marginTop: 'auto' }}>
                <a href={href} style={{ display: 'inline-block', padding: '10px 20px', background: colour, color: '#fff', borderRadius: 6, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                  {cta}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Preparation() {
  const preps = [
    {
      type: 'Colonoscopy / Lower GI Endoscopy',
      colour: '#0d9488',
      items: [
        '2 days before: Low-fibre diet — avoid seeds, nuts, raw vegetables, and red meat.',
        '1 day before: Clear liquids only — water, apple juice, clear broth, plain jelly (no red or purple).',
        'Bowel preparation medication: take exactly as prescribed at the times given.',
        'After midnight: Nil by mouth (no food or drink).',
        'Arrange a responsible adult to drive you home — you cannot drive after sedation.',
      ],
    },
    {
      type: 'Gastroscopy / Upper GI Endoscopy',
      colour: '#6366f1',
      items: [
        'No food or milk for 6 hours before the procedure.',
        'Water only permitted up to 2 hours before.',
        'Continue regular medications with a small sip of water unless told otherwise.',
        'If sedation is planned: arrange a responsible adult to drive you home.',
      ],
    },
    {
      type: 'ERCP',
      colour: '#f59e0b',
      items: [
        'Nil by mouth (no food or drink including water) from midnight.',
        'Blood-thinning medications: stop as specifically instructed by Dr Kabiye.',
        'Diabetic patients: adjust insulin/tablets as directed.',
        'Arrange a responsible adult — you cannot drive for 24 hours after sedation.',
        'Plan for a full day at Tapion Hospital and possible overnight stay.',
      ],
    },
    {
      type: 'General Surgery (Elective)',
      colour: '#ef4444',
      items: [
        'Nil by mouth: no food for 6 hours; no clear fluids for 2 hours before surgery.',
        'Shower with antiseptic wash the evening before and morning of surgery.',
        'Remove nail polish, jewellery, piercings, and contact lenses.',
        'Hold morning diabetes medications unless instructed otherwise.',
        'Arrange transport — you cannot drive after general anaesthesia.',
      ],
    },
  ];

  return (
    <section id="preparation" style={{ padding: '80px 24px', background: '#080f1a', borderBottom: '1px solid #1e293b' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>
        <SectionLabel>Patient Information</SectionLabel>
        <h2 style={{ margin: '0 0 12px', fontSize: 26, fontWeight: 800, color: '#f1f5f9' }}>
          Procedure preparation
        </h2>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#64748b', maxWidth: 560, lineHeight: 1.7 }}>
          Key preparation steps for common procedures. <strong style={{ color: '#94a3b8' }}>Full written instructions are emailed to you automatically after booking.</strong>
        </p>
        <p style={{ margin: '0 0 40px', fontSize: 12, color: '#475569', maxWidth: 560, lineHeight: 1.7 }}>
          These are general guidelines only. Always follow the specific instructions given to you by Dr Kabiye and the clinical team, as individual circumstances vary.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {preps.map(({ type, colour, items }) => (
            <div key={type} style={{ background: '#1e293b', borderRadius: 10, padding: '20px 22px', borderLeft: `4px solid ${colour}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: colour, marginBottom: 14 }}>{type}</div>
              <ul style={{ margin: 0, padding: '0 0 0 16px', color: '#94a3b8', fontSize: 12, lineHeight: 1.85 }}>
                {items.map(item => <li key={item} style={{ marginBottom: 4 }}>{item}</li>)}
              </ul>
            </div>
          ))}
        </div>

        {/* What to bring */}
        <div style={{ marginTop: 32, background: '#1e293b', borderRadius: 10, padding: '24px 28px', border: '1px solid #374151' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 14 }}>Always bring to every appointment</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '8px 24px' }}>
            {[
              'Valid photo ID (passport or national ID)',
              'Health insurance card (if applicable)',
              'Complete list of current medications',
              'Relevant prior test results or imaging',
              'Hospital discharge letters or operation notes',
              'GP or specialist referral letter (if referred)',
            ].map(item => (
              <div key={item} style={{ fontSize: 13, color: '#94a3b8', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: '#0d9488', flexShrink: 0, marginTop: 2 }}>✓</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Locations() {
  const locations = [
    {
      name:    'Rodney Bay — Providence Building',
      icon:    '🏢',
      colour:  '#0d9488',
      clinics: ['New patient consultations', 'ERCP work-up clinic', 'Breast clinic', 'Diabetic foot clinic', 'Minor procedures'],
      info:    'Rodney Bay, Gros Islet, Saint Lucia',
      phone:   PHONE_PRIMARY,
    },
    {
      name:    'Castries Clinic',
      icon:    '🏥',
      colour:  '#6366f1',
      clinics: ['Follow-up appointments', 'Post-operative review', 'Specialist consultations'],
      info:    'Castries, Saint Lucia',
      phone:   PHONE_SECONDARY,
    },
    {
      name:    'Tapion Hospital',
      icon:    '⚕️',
      colour:  '#f59e0b',
      clinics: ['All surgical procedures', 'Colonoscopy & Gastroscopy', 'ERCP & biliary procedures', 'Emergency surgical admissions'],
      info:    'La Toc Road, Castries, Saint Lucia',
      phone:   PHONE_PRIMARY,
    },
  ];

  return (
    <section id="locations" style={{ padding: '80px 24px', borderBottom: '1px solid #1e293b' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>
        <SectionLabel>Locations</SectionLabel>
        <h2 style={{ margin: '0 0 12px', fontSize: 26, fontWeight: 800, color: '#f1f5f9' }}>
          Where to find us
        </h2>
        <p style={{ margin: '0 0 48px', fontSize: 14, color: '#64748b' }}>
          Three sites across Saint Lucia — bookings managed centrally.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {locations.map(({ name, icon, colour, clinics, info, phone }) => (
            <div key={name} style={{ background: '#1e293b', borderRadius: 12, padding: '28px 24px', border: `1px solid ${colour}33` }}>
              <div style={{ fontSize: 32, marginBottom: 14 }}>{icon}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>{name}</div>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 18 }}>{info}</div>
              <div style={{ marginBottom: 20 }}>
                {clinics.map(c => (
                  <div key={c} style={{ fontSize: 12, color: '#94a3b8', padding: '4px 0', borderBottom: '1px solid #263044', display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: colour, fontSize: 10 }}>●</span>
                    {c}
                  </div>
                ))}
              </div>
              <a href={`tel:+1758${phone.replace(/-/g, '')}`} style={{ fontSize: 13, color: colour, fontWeight: 600, textDecoration: 'none' }}>
                📞 {phone}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" style={{ padding: '80px 24px', background: '#080f1a', borderBottom: '1px solid #1e293b' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <SectionLabel>Contact Us</SectionLabel>
        <h2 style={{ margin: '0 0 12px', fontSize: 26, fontWeight: 800, color: '#f1f5f9' }}>
          Reach us your way
        </h2>
        <p style={{ margin: '0 0 48px', fontSize: 14, color: '#64748b' }}>
          Online booking, WhatsApp, or telephone — whichever is easiest for you.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <ContactCard
            icon="📅"
            colour="#0d9488"
            title="Book Online"
            desc="Choose your slot and confirm instantly — or submit a referral request."
            href="/book"
            cta="Book Now"
          />
          <ContactCard
            icon="💬"
            colour="#25D366"
            title="WhatsApp"
            desc="Message our team on WhatsApp for booking assistance, queries, and triage."
            href={WHATSAPP_LINK}
            cta="Open WhatsApp"
            external
          />
          <ContactCard
            icon="📞"
            colour="#6366f1"
            title="Telephone"
            desc={`Call Tapion Hospital reception for urgent matters and appointments.\n${PHONE_PRIMARY} / ${PHONE_SECONDARY}`}
            href={`tel:+1758${PHONE_PRIMARY.replace(/-/g, '')}`}
            cta={`Call ${PHONE_PRIMARY}`}
          />
        </div>

        {/* Emergency notice */}
        <div style={{ marginTop: 40, padding: '20px 24px', background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ef4444', marginBottom: 8 }}>⚠️ Medical Emergencies</div>
          <p style={{ margin: 0, fontSize: 13, color: '#fca5a5', lineHeight: 1.7 }}>
            If you believe you are experiencing a medical emergency — including chest pain, difficulty breathing,
            stroke symptoms, severe bleeding, or loss of consciousness — <strong>call 911 immediately</strong> or go to the nearest
            emergency department. <strong>Do not use this website or WhatsApp in an emergency.</strong>
          </p>
        </div>
      </div>
    </section>
  );
}

function ContactCard({
  icon, colour, title, desc, href, cta, external,
}: {
  icon: string; colour: string; title: string; desc: string;
  href: string; cta: string; external?: boolean;
}) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 10, padding: '24px 22px', border: '1px solid #374151', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.7, marginBottom: 20, flex: 1, whiteSpace: 'pre-line' }}>{desc}</div>
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        style={{ display: 'inline-block', padding: '9px 18px', background: colour, color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 700, textDecoration: 'none', textAlign: 'center' }}
      >
        {cta}
      </a>
    </div>
  );
}

function Footer() {
  return (
    <footer style={{ background: '#060d18', padding: '48px 24px 32px', borderTop: '1px solid #1e293b' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32, marginBottom: 40 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', marginBottom: 6 }}>Amise Medical Services</div>
            <div style={{ fontSize: 12, color: '#0d9488', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Saint Lucia</div>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.8 }}>
              Dr Dawit Daniel Kabiye, MD, DM<br />
              General &amp; Endoscopic Surgery
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Appointments</div>
            {[
              { label: 'Book Online',          href: '/book'         },
              { label: 'Routine Appointment',   href: '/book'         },
              { label: 'Referral Booking',      href: '/book'         },
              { label: 'WhatsApp',              href: WHATSAPP_LINK   },
            ].map(({ label, href }) => (
              <a key={label} href={href} style={{ display: 'block', fontSize: 12, color: '#475569', textDecoration: 'none', marginBottom: 8 }}>{label}</a>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Contact</div>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 2 }}>
              Tapion Hospital: {PHONE_PRIMARY}<br />
              Alt: {PHONE_SECONDARY}<br />
              Rodney Bay · Castries · Tapion
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Services</div>
            {['Colonoscopy & Gastroscopy', 'ERCP', 'Hernia Repair', 'Gallbladder Surgery', 'Breast Clinic', 'Thyroid Surgery', 'Diabetic Foot', 'Colorectal Surgery'].map(s => (
              <div key={s} style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>{s}</div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #1e293b', paddingTop: 24, fontSize: 11, color: '#374151', lineHeight: 1.8, textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px' }}>
            <strong style={{ color: '#475569' }}>Important:</strong> This website is for administrative scheduling only and does not constitute medical advice, clinical triage, or a diagnosis.
            Appointment availability is subject to confirmation. If you believe you are experiencing a medical emergency, call 911 or attend the nearest emergency department immediately.
          </p>
          <p style={{ margin: 0 }}>
            © {new Date().getFullYear()} Amise Medical Services, Saint Lucia. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
      {children}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <About />
        <Services />
        <BookingTracks />
        <Preparation />
        <Locations />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
