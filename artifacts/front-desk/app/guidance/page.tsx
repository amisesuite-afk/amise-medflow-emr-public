import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Health Guidance & Preventive Screening — Amise Medical Services',
  description:
    'General health guidance and preventive screening information from Amise Medical Services. Dr Dawit Daniel Kabiye, MD, DM — General & Endoscopic Surgery, Saint Lucia.',
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScreeningCard {
  id: string;
  title: string;
  icon: string;
  body: React.ReactNode;
}

// ── Nav ───────────────────────────────────────────────────────────────────────

function GuidanceNav() {
  return (
    <nav className="amise-sub-nav">
      <div className="amise-sub-nav-inner">
        <Link href="/" style={{ fontSize: 14, fontWeight: 600, color: '#0d9488', textDecoration: 'none' }}>
          ← Amise Medical Services
        </Link>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link href="/pathway" style={{ fontSize: 13, fontWeight: 600, color: '#4b5563', textDecoration: 'none', padding: '8px 16px' }}>
            Care Pathways
          </Link>
          <Link href="/book" style={{
            padding: '9px 20px', background: '#0d9488', color: '#fff',
            borderRadius: 50, fontSize: 13, fontWeight: 700, textDecoration: 'none',
          }}>
            Book Appointment
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section style={{ background: '#f0fdf9', padding: '72px 40px 60px', borderBottom: '1px solid #e2eeed' }}>
      <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
        {/* Label */}
        <div style={{
          display: 'inline-block',
          fontSize: 11, fontWeight: 700, color: '#0d9488',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginBottom: 16,
        }}>
          Amise Medical Services · Saint Lucia
        </div>

        <h1 style={{
          margin: '0 0 16px',
          fontSize: 'clamp(28px, 4vw, 44px)',
          fontWeight: 900, color: '#0f172a',
          lineHeight: 1.1, letterSpacing: '-0.02em',
        }}>
          Health Guidance &amp; Preventive Screening
        </h1>

        <p style={{
          margin: '0 0 32px',
          fontSize: 16, color: '#475569', lineHeight: 1.75, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto',
        }}>
          Based on published international guidelines — not a substitute for a personal consultation with Dr Kabiye.
        </p>

        {/* Disclaimer banner */}
        <div style={{
          padding: '16px 24px',
          background: '#fff7ed', border: '2px solid #f97316',
          borderRadius: 10, textAlign: 'left', maxWidth: 640, margin: '0 auto',
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
            ⚠️ Important Disclaimer
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#7c2d12', lineHeight: 1.7 }}>
            This page provides <strong>general health information only</strong>. It is not a substitute for professional medical
            advice, diagnosis, or treatment. Screening recommendations depend on your personal health history.
            Always consult Dr Kabiye or your physician before making any health decision.
            <strong> If you believe you are experiencing a medical emergency, call 911 immediately.</strong>
          </p>
        </div>

        {/* Anchor links */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 36 }}>
          {[
            { href: '#colorectal', label: 'Colorectal' },
            { href: '#breast', label: 'Breast Health' },
            { href: '#upper-gi', label: 'Upper GI' },
            { href: '#gallbladder', label: 'Gallbladder' },
            { href: '#thyroid', label: 'Thyroid' },
            { href: '#diabetes', label: 'Metabolic Health' },
            { href: '#hernia', label: 'Hernia' },
            { href: '#post-op', label: 'Post-op' },
          ].map(({ href, label }) => (
            <a key={href} href={href} style={{
              padding: '7px 16px', borderRadius: 50,
              background: '#fff', border: '1.5px solid #d1e8e5',
              fontSize: 13, fontWeight: 600, color: '#0d9488',
              textDecoration: 'none',
            }}>{label}</a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Screening Section ─────────────────────────────────────────────────────────

const SCREENING_CARDS: ScreeningCard[] = [
  {
    id: 'colorectal',
    title: 'Colorectal Cancer Screening',
    icon: '🔬',
    body: (
      <div>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
          <strong>Colonoscopy is recommended from age 45</strong> for average-risk adults (ACS/USPSTF 2021).
          If normal, repeat every 10 years. Screening begins earlier and is performed more frequently
          if you have a first-degree relative with colorectal cancer or polyps.
        </p>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
          An <strong>annual FIT (faecal immunochemical test)</strong> is an acceptable alternative for average-risk
          individuals who prefer non-invasive screening. A positive FIT requires follow-up colonoscopy.
        </p>
        <div style={{ padding: '12px 16px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Red Flags — Seek Review Promptly</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#7f1d1d', lineHeight: 1.75 }}>
            <li>Rectal bleeding or blood in stool</li>
            <li>Persistent change in bowel habit (constipation or diarrhoea lasting more than 3 weeks)</li>
            <li>Unexplained weight loss</li>
            <li>Abdominal pain that persists or wakes you at night</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'breast',
    title: 'Breast Health',
    icon: '🩺',
    body: (
      <div>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
          <strong>Annual clinical breast examination</strong> is recommended for all adult women.
          Discuss <strong>mammography from age 40</strong> with your doctor — the decision depends on your
          personal risk profile, preferences, and family history.
        </p>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
          Patients with a family history of breast or ovarian cancer or known <strong>BRCA gene variants</strong> should
          discuss earlier and more intensive screening options with Dr Kabiye.
          Breast self-awareness (knowing how your breasts normally look and feel) is encouraged.
        </p>
        <div style={{ padding: '12px 16px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Report Promptly</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#7f1d1d', lineHeight: 1.75 }}>
            <li>Any new lump or thickening in the breast or armpit</li>
            <li>Skin changes — dimpling, redness, or puckering</li>
            <li>Nipple discharge (especially if bloodstained or spontaneous)</li>
            <li>Change in the shape or size of the breast</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'upper-gi',
    title: 'Upper GI & Oesophagus',
    icon: '🔭',
    body: (
      <div>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
          <strong>Gastroscopy (upper endoscopy)</strong> is indicated for patients with:
        </p>
        <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
          <li>Persistent acid reflux or heartburn not responding to treatment</li>
          <li>Difficulty or pain on swallowing (dysphagia)</li>
          <li>Unexplained iron-deficiency anaemia</li>
          <li>Persistent epigastric (upper abdominal) pain</li>
        </ul>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
          <strong>H. pylori infection:</strong> Test and treat is recommended for patients with peptic ulcer symptoms.
          Eradication reduces the risk of ulcer recurrence and gastric cancer.
        </p>
        <div style={{ padding: '12px 16px', background: '#f0fdf9', border: '1px solid #a7f3d0', borderRadius: 8 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#065f46', lineHeight: 1.75 }}>
            Screening upper endoscopy is <strong>not recommended</strong> for asymptomatic adults with no risk factors.
            Endoscopy is a diagnostic and therapeutic tool — it is arranged when clinically indicated.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'gallbladder',
    title: 'Gallbladder & Biliary',
    icon: '🫀',
    body: (
      <div>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
          An <strong>abdominal ultrasound</strong> is the first-line investigation for suspected gallbladder disease.
          Consider assessment if you experience right upper quadrant pain, nausea or discomfort after
          fatty meals, or jaundice (yellowing of the skin or eyes).
        </p>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
          <strong>Risk factors</strong> for gallstone disease include: obesity, rapid weight loss,
          diabetes, female sex, advancing age, and certain ethnic backgrounds (including Caribbean populations).
          Gallstones found incidentally on imaging should be discussed with Dr Kabiye to determine
          whether watchful waiting or treatment is appropriate.
        </p>
        <div style={{ padding: '12px 16px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Attend Emergency Department If</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#7f1d1d', lineHeight: 1.75 }}>
            <li>Severe, constant upper abdominal or right-sided pain lasting more than a few hours</li>
            <li>Fever with abdominal pain (possible infection — cholecystitis or cholangitis)</li>
            <li>New onset jaundice with pain or fever</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: 'thyroid',
    title: 'Thyroid',
    icon: '🦋',
    body: (
      <div>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
          There is <strong>no recommendation for universal population screening</strong> for thyroid disease.
          A <strong>TSH (thyroid stimulating hormone) blood test</strong> is appropriate if you experience:
        </p>
        <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
          <li>Unexplained fatigue or weight change (loss or gain)</li>
          <li>Visible or palpable neck swelling</li>
          <li>Temperature intolerance (feeling excessively hot or cold)</li>
          <li>Family history of thyroid disease</li>
          <li>Palpitations or tremor</li>
        </ul>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
          <strong>Neck lumps</strong> — any new or growing lump in the neck should be assessed promptly.
          Further investigation may include ultrasound, fine needle aspiration (FNA), or surgical excision.
          Dr Kabiye performs thyroid and parathyroid surgery and can guide you through the full pathway.
        </p>
      </div>
    ),
  },
  {
    id: 'diabetes',
    title: 'Diabetes & Metabolic Health',
    icon: '📊',
    body: (
      <div>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
          <strong>Annual screening</strong> with HbA1c, fasting blood glucose, and a full lipid profile is
          recommended for all adults with risk factors, including: obesity, hypertension, family history
          of diabetes, and Caribbean heritage (higher population prevalence).
        </p>
        <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
          <li><strong>Diabetic foot examination</strong> — annually for all patients with established diabetes</li>
          <li><strong>BMI and blood pressure check</strong> — at every GP visit</li>
          <li>Eye (retinal) examination and urine microalbumin test annually for diabetes patients</li>
        </ul>
        <div style={{ padding: '12px 16px', background: '#f0fdf9', border: '1px solid #a7f3d0', borderRadius: 8 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#065f46', lineHeight: 1.75 }}>
            Dr Kabiye&apos;s team offers a dedicated <strong>diabetic foot clinic</strong>. Early intervention significantly
            reduces the risk of serious complications. Do not wait for a wound to deteriorate before seeking review.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'hernia',
    title: 'Hernia',
    icon: '🩹',
    body: (
      <div>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
          Groin (inguinal or femoral) or abdominal wall bulges that appear on straining or standing should
          be assessed. Not all hernias require immediate surgery — the decision depends on your symptoms,
          size, and overall health.
        </p>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
          <strong>Risk factors</strong> include: heavy lifting, chronic cough (e.g. smokers), obesity,
          chronic constipation, previous abdominal surgery, and advancing age.
        </p>
        <div style={{ padding: '12px 16px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>
            ⚠️ Emergency — Attend Immediately If
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#7f1d1d', lineHeight: 1.75 }}>
            <li>A hernia cannot be pushed back in (irreducible or &quot;stuck&quot;)</li>
            <li>The hernia becomes hard, tender, red, or discoloured</li>
            <li>You develop vomiting or inability to pass wind alongside a new or worsening hernia</li>
          </ul>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#991b1b', fontStyle: 'italic' }}>
            A strangulated hernia is a surgical emergency — call 911 or attend the emergency department without delay.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'post-op',
    title: 'Post-operative Follow-up',
    icon: '📋',
    body: (
      <div>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
          All patients who have undergone surgery with Dr Kabiye should attend their scheduled post-operative
          review appointment as arranged at discharge. These appointments are important for monitoring healing,
          reviewing pathology results, and planning ongoing care.
        </p>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
          <strong>Do not wait for your scheduled appointment</strong> if you develop any of the following:
        </p>
        <div style={{ padding: '12px 16px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8 }}>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#7f1d1d', lineHeight: 1.75 }}>
            <li>Fever above 38°C / 100.4°F</li>
            <li>Increasing redness, swelling, warmth, or discharge at the wound site</li>
            <li>Increasing pain or pain not controlled by prescribed analgesia</li>
            <li>Nausea, vomiting, or inability to eat after the first 48 hours</li>
            <li>Swollen, painful, or red leg (possible clot)</li>
          </ul>
        </div>
        <p style={{ margin: '12px 0 0', fontSize: 14, color: '#374151', lineHeight: 1.75 }}>
          Contact the practice or attend the emergency department if you are concerned.
          Our team would always rather hear from you early.
        </p>
      </div>
    ),
  },
];

function ScreeningSection() {
  return (
    <section style={{ padding: '72px 40px', background: '#fff' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Section header */}
        <div style={{ textAlign: 'center', marginBottom: 52 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            Screening Guidelines
          </div>
          <h2 style={{ margin: '0 0 10px', fontSize: 28, fontWeight: 900, color: '#0f172a' }}>
            What to Screen For — and When
          </h2>
          <p style={{ margin: 0, fontSize: 15, color: '#64748b', lineHeight: 1.7 }}>
            Based on American Cancer Society, USPSTF, and international surgical guidelines.
            Your personal history may warrant different intervals — discuss with Dr Kabiye.
          </p>
        </div>

        {/* Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {SCREENING_CARDS.map(card => (
            <div
              key={card.id}
              id={card.id}
              style={{
                background: '#fff', border: '1.5px solid #e2eeed',
                borderRadius: 14, padding: '32px 36px',
                boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
                scrollMarginTop: 80,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: '#f0fdf9', border: '1.5px solid #99f6e4',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, flexShrink: 0,
                }}>
                  {card.icon}
                </div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                  {card.title}
                </h3>
              </div>
              {card.body}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Life Lessons Section ──────────────────────────────────────────────────────

const LIFE_LESSONS = [
  {
    icon: '🥗',
    title: 'Eat for your gut',
    body: 'High-fibre diet: vegetables, legumes, wholegrains, and local fruits. Limit processed meats and ultra-processed foods. Caribbean produce — dasheen, breadfruit, christophene, plantain, callaloo — are all excellent sources of fibre and nutrients.',
  },
  {
    icon: '🚶',
    title: 'Move more',
    body: '150 minutes of moderate activity per week (brisk walking, swimming, cycling). Regular physical activity reduces colorectal cancer, gallstone, and metabolic disease risk. Start gradually and build steadily.',
  },
  {
    icon: '📊',
    title: 'Know your numbers',
    body: 'Blood pressure, blood sugar, BMI, and cholesterol. Know your baselines. Track changes over time. Bring results to every appointment so your doctors can see trends, not just single readings.',
  },
  {
    icon: '🚭',
    title: 'Protect your gut',
    body: 'Avoid smoking — it raises oesophageal and colorectal cancer risk significantly. Limit alcohol intake. Maintain a healthy weight. Small, consistent changes compound into meaningful long-term health improvements.',
  },
  {
    icon: '🕐',
    title: "Don't delay care",
    body: 'Many surgical conditions are far simpler to treat when caught early. A lump, bleed, or persistent pain that lasts for more than 2–3 weeks deserves a medical review. Waiting rarely makes things better.',
  },
  {
    icon: '📋',
    title: 'Prepare for appointments',
    body: 'Write down your symptoms before your visit — when they started, how they have changed, what makes them better or worse. Bring all medications. Bring prior test results. Ask questions. You deserve clear answers.',
  },
];

function LifeLessons() {
  return (
    <section style={{ background: '#0d9488', padding: '72px 40px' }}>
      <div style={{ maxWidth: 1060, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#ccfbf1', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            Preventive Health
          </div>
          <h2 style={{ margin: '0 0 10px', fontSize: 26, fontWeight: 900, color: '#fff' }}>
            Small habits, long-term health.
          </h2>
          <p style={{ margin: 0, fontSize: 15, color: '#ccfbf1', lineHeight: 1.7 }}>
            Evidence-based lifestyle steps that make a real difference.
          </p>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {LIFE_LESSONS.map(({ icon, title, body }) => (
            <div key={title} style={{
              background: 'rgba(255,255,255,0.12)',
              borderRadius: 12, padding: '24px 22px',
              border: '1px solid rgba(255,255,255,0.2)',
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{title}</div>
              <p style={{ margin: 0, fontSize: 13, color: '#ccfbf1', lineHeight: 1.75 }}>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA Section ───────────────────────────────────────────────────────────────

function CtaSection() {
  return (
    <section style={{ padding: '72px 40px', background: '#f9fafb', textAlign: 'center' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          Take the Next Step
        </div>
        <h2 style={{ margin: '0 0 14px', fontSize: 24, fontWeight: 900, color: '#0f172a' }}>
          Ready to book a screening?
        </h2>
        <p style={{ margin: '0 0 32px', fontSize: 15, color: '#475569', lineHeight: 1.75 }}>
          Dr Kabiye and the Amise Medical Services team are here to guide you. Whether you need a routine
          colonoscopy, a breast clinic appointment, or specialist advice, we will ensure you receive timely,
          expert care.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/book" style={{
            padding: '13px 30px', background: '#0d9488', color: '#fff',
            borderRadius: 8, fontSize: 15, fontWeight: 700, textDecoration: 'none',
          }}>
            Book Appointment →
          </Link>
          <a href="https://wa.me/17582840557" target="_blank" rel="noopener noreferrer" style={{
            padding: '13px 30px', background: '#fff', color: '#0d9488',
            border: '1.5px solid #d1e8e5', borderRadius: 8, fontSize: 15, fontWeight: 600, textDecoration: 'none',
          }}>
            WhatsApp Us
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Footer Disclaimer ─────────────────────────────────────────────────────────

function GuidanceFooterDisclaimer() {
  return (
    <footer style={{ background: '#0b2a35', padding: '32px 40px', textAlign: 'center' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <p style={{ margin: '0 0 12px', fontSize: 12, color: '#4a7a8a', lineHeight: 1.9 }}>
          This page provides <strong style={{ color: '#64748b' }}>general health information only</strong>. It is not a substitute for professional
          medical advice, diagnosis, or treatment. Always consult Dr Kabiye or your personal physician before
          making any healthcare decision. Individual screening recommendations depend on your personal and
          family health history.
        </p>
        <p style={{ margin: 0, fontSize: 12, color: '#4a7a8a', lineHeight: 1.9 }}>
          <strong style={{ color: '#64748b' }}>If you believe you are experiencing a medical emergency, call 911 immediately.</strong>
          &nbsp;Do not use this website in an emergency.
          &nbsp;·&nbsp;© {new Date().getFullYear()} Amise Medical Services, Saint Lucia. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GuidancePage() {
  return (
    <div style={{
      background: '#fff', color: '#0f172a',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      minHeight: '100vh',
    }}>
      <GuidanceNav />
      <main>
        <Hero />
        <ScreeningSection />
        <LifeLessons />
        <CtaSection />
      </main>
      <GuidanceFooterDisclaimer />
    </div>
  );
}
