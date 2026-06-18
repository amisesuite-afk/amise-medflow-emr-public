import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Patient Care Pathway — Amise Medical Services',
  description:
    'How patients move through Amise Medical Services — from first contact through triage, appointment, procedure, and follow-up. Condition-specific surgical and endoscopy care chains.',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChainStep { label: string; sub?: string }
interface CareChain {
  condition: string;
  tier: 'surgical' | 'endoscopy' | 'clinic';
  steps: ChainStep[];
  bookHref: string;
  urgency: 'urgent' | 'priority' | 'routine';
}

// ─── Care chains ──────────────────────────────────────────────────────────────

const CHAINS: CareChain[] = [
  // ── Surgical ──────────────────────────────────────────────────────────────
  {
    condition:  'Hernia Repair',
    tier:       'surgical',
    urgency:    'priority',
    bookHref:   '/book',
    steps: [
      { label: 'Surgical Consult',   sub: 'Clinical assessment, imaging if needed' },
      { label: 'Pre-op Assessment',  sub: 'Blood tests, anaesthesia review' },
      { label: 'Lap / Open Repair',  sub: 'Tapion Hospital' },
      { label: 'Post-op Review',     sub: 'Castries clinic, 2–4 weeks' },
    ],
  },
  {
    condition:  'Gallbladder (Cholecystectomy)',
    tier:       'surgical',
    urgency:    'priority',
    bookHref:   '/book',
    steps: [
      { label: 'Surgical Consult',   sub: 'History, ultrasound review' },
      { label: 'Pre-op Assessment',  sub: 'LFTs, bloods, anaesthesia' },
      { label: 'Lap Cholecystectomy',sub: 'Tapion Hospital, day case / overnight' },
      { label: 'Post-op Review',     sub: '1–2 weeks, low-fat diet advice' },
    ],
  },
  {
    condition:  'Colorectal Surgery',
    tier:       'surgical',
    urgency:    'priority',
    bookHref:   '/book',
    steps: [
      { label: 'Consult + Scope',    sub: 'Colonoscopy + histology' },
      { label: 'MDT / Staging',      sub: 'CT / MRI if indicated' },
      { label: 'Colonic Resection',  sub: 'Tapion Hospital' },
      { label: 'Oncology / Review',  sub: 'Coordinated follow-up' },
    ],
  },
  {
    condition:  'Breast Surgery',
    tier:       'surgical',
    urgency:    'priority',
    bookHref:   '/book',
    steps: [
      { label: 'Breast Clinic',      sub: 'Rodney Bay — clinical assessment' },
      { label: 'Imaging',            sub: 'Mammogram / ultrasound / MRI' },
      { label: 'Biopsy if needed',   sub: 'Core needle or excision biopsy' },
      { label: 'Surgical Plan',      sub: 'Lumpectomy / mastectomy / discharge' },
    ],
  },
  {
    condition:  'Thyroid Surgery',
    tier:       'surgical',
    urgency:    'priority',
    bookHref:   '/book',
    steps: [
      { label: 'Consult + USS',      sub: 'Thyroid ultrasound, TFTs' },
      { label: 'FNAC / Biopsy',      sub: 'Fine needle aspiration cytology' },
      { label: 'Thyroidectomy',      sub: 'Tapion Hospital — total or hemi' },
      { label: 'Post-op Review',     sub: 'Calcium + TFT check, thyroxine if needed' },
    ],
  },
  // ── Endoscopy ─────────────────────────────────────────────────────────────
  {
    condition:  'Colonoscopy',
    tier:       'endoscopy',
    urgency:    'routine',
    bookHref:   '/book',
    steps: [
      { label: 'Booking',            sub: 'Online or WhatsApp' },
      { label: 'Bowel Prep',         sub: 'Instructions emailed automatically' },
      { label: 'Procedure',          sub: 'Tapion Hospital — 30–60 min' },
      { label: 'Results + Plan',     sub: 'Follow-up or discharge' },
    ],
  },
  {
    condition:  'Gastroscopy (OGD)',
    tier:       'endoscopy',
    urgency:    'routine',
    bookHref:   '/book',
    steps: [
      { label: 'Booking',            sub: 'Online or WhatsApp' },
      { label: 'Fast from midnight', sub: 'Instructions emailed automatically' },
      { label: 'Procedure',          sub: 'Tapion Hospital — 15–30 min' },
      { label: 'Results + Plan',     sub: 'H. pylori / biopsy review' },
    ],
  },
  {
    condition:  'ERCP',
    tier:       'endoscopy',
    urgency:    'urgent',
    bookHref:   '/book',
    steps: [
      { label: 'ERCP Workup Clinic', sub: 'Imaging review, medication adjustment' },
      { label: 'Pre-procedure Prep', sub: 'NBM, bloods, anaesthesia consent' },
      { label: 'ERCP Procedure',     sub: 'Tapion Hospital — 60–90 min' },
      { label: 'Recovery + Review',  sub: 'Overnight if needed, biliary follow-up' },
    ],
  },
  // ── Clinic / outpatient ───────────────────────────────────────────────────
  {
    condition:  'New Consultation',
    tier:       'clinic',
    urgency:    'routine',
    bookHref:   '/book',
    steps: [
      { label: 'Book Online',        sub: 'Rodney Bay — 45 min slot' },
      { label: 'Assessment',         sub: 'History, examination, referral review' },
      { label: 'Investigations',     sub: 'Blood tests / imaging if required' },
      { label: 'Treatment Plan',     sub: 'Surgery / endoscopy / discharge' },
    ],
  },
  {
    condition:  'Diabetic Foot Clinic',
    tier:       'clinic',
    urgency:    'priority',
    bookHref:   '/book',
    steps: [
      { label: 'Book Clinic',        sub: 'Rodney Bay — bring glucose diary' },
      { label: 'Foot Assessment',    sub: 'Vascular, neurological, wound grading' },
      { label: 'Investigations',     sub: 'Doppler, HbA1c, cultures if wound' },
      { label: 'Treatment Plan',     sub: 'Wound care / surgery / DM team liaison' },
    ],
  },
  {
    condition:  'Post-operative Review',
    tier:       'clinic',
    urgency:    'routine',
    bookHref:   '/book',
    steps: [
      { label: 'Scheduled at Discharge', sub: 'Castries clinic' },
      { label: 'Wound Check',            sub: 'Suture removal / dressing review' },
      { label: 'Recovery Assessment',    sub: 'Activity, diet, return to work' },
      { label: 'Discharge or Plan',      sub: 'Pathology results / further care' },
    ],
  },
];

// ─── Triage rules ─────────────────────────────────────────────────────────────

const TRIAGE_TIERS = [
  {
    id:      'urgent',
    label:   'Urgent',
    colour:  '#dc2626',
    bg:      '#fef2f2',
    border:  '#fca5a5',
    time:    'Same day — within 48 hours',
    icon:    '⚡',
    conditions: [
      'Hernia that cannot be pushed back in (irreducible / strangulated)',
      'Biliary obstruction with fever and jaundice (possible cholangitis)',
      'Post-operative complication: fever, wound breakdown, severe pain',
      'Acute abdominal pain requiring urgent surgical assessment',
      'ERCP for acute biliary sepsis',
      'Rapidly enlarging neck or breast lump with systemic symptoms',
    ],
    action: 'Call 758-284-0557 directly. Staff will arrange same-day priority.',
  },
  {
    id:      'priority',
    label:   'Priority',
    colour:  '#d97706',
    bg:      '#fffbeb',
    border:  '#fcd34d',
    time:    'Within 7 days',
    icon:    '📋',
    conditions: [
      'GP or specialist referral for any surgical condition',
      'New symptomatic hernia (reducible, not acute)',
      'Symptomatic gallstones — biliary colic, cholecystitis',
      'New breast lump requiring assessment',
      'Thyroid nodule identified on imaging',
      'Rectal bleeding requiring colonoscopy',
      'Obstructive jaundice (non-acute) for ERCP workup',
    ],
    action: 'Submit via /refer (GP) or book online. Confirmed within 24 hours.',
  },
  {
    id:      'routine',
    label:   'Routine',
    colour:  '#059669',
    bg:      '#f0fdf4',
    border:  '#6ee7b7',
    time:    'Within 21 days',
    icon:    '📅',
    conditions: [
      'Screening colonoscopy (age 45+ or family history)',
      'Screening / surveillance gastroscopy',
      'Elective hernia repair (asymptomatic)',
      'Diabetic foot annual review',
      'Follow-up or post-operative review appointment',
      'Telephone review / results discussion',
    ],
    action: 'Book directly online at /book. Slot confirmed immediately.',
  },
];

// ─── Components ───────────────────────────────────────────────────────────────

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>{children}</h2>
      {sub && <p style={{ margin: '6px 0 0', fontSize: 14, color: '#64748b' }}>{sub}</p>}
    </div>
  );
}

function Arrow() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '12px 0' }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c0e4e0" strokeWidth="2">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <polyline points="19 12 12 19 5 12"/>
      </svg>
    </div>
  );
}

function EntryPoints() {
  const entries = [
    {
      icon: '🌐',
      label: 'Website Booking',
      sub: 'Online booking form',
      href: '/book',
      tracks: ['Routine self-booking', 'Referral submission'],
    },
    {
      icon: '💬',
      label: 'WhatsApp / SMS',
      sub: 'Tapion: 758-284-0557\nRodney Bay: 758-720-7111',
      href: 'https://wa.me/17582840557',
      tracks: ['AI intake assistant', 'Staff-reviewed reply'],
    },
    {
      icon: '📋',
      label: 'GP / Specialist Referral',
      sub: 'Structured referral form',
      href: '/refer',
      tracks: ['Structured referral form', 'HL7 FHIR R4 API'],
    },
    {
      icon: '📞',
      label: 'Telephone',
      sub: '758-284-0557 / 758-720-7111',
      href: 'tel:+17582840557',
      tracks: ['Staff manual booking', 'Urgent direct access'],
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 0 }}>
      {entries.map(({ icon, label, sub, href, tracks }) => (
        <a key={label} href={href} style={{
          background: '#fff', borderRadius: 12, padding: '22px 20px',
          border: '1px solid #e2eeed', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 0,
        }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'pre-line', marginBottom: 12, lineHeight: 1.6 }}>{sub}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 'auto' }}>
            {tracks.map(t => (
              <div key={t} style={{ fontSize: 11, color: '#0d9488', display: 'flex', gap: 5, alignItems: 'center' }}>
                <span style={{ color: '#c0e4e0' }}>●</span>{t}
              </div>
            ))}
          </div>
        </a>
      ))}
    </div>
  );
}

function TriageTiers() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
      {TRIAGE_TIERS.map(({ id, label, colour, bg, border, time, icon, conditions, action }) => (
        <div key={id} style={{
          background: bg, border: `1px solid ${border}`,
          borderTop: `4px solid ${colour}`,
          borderRadius: 10, padding: '22px 20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: colour }}>{label}</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: colour, marginBottom: 14, opacity: 0.8 }}>{time}</div>
          <ul style={{ margin: '0 0 16px', padding: '0 0 0 16px', color: '#374151', fontSize: 12, lineHeight: 1.8 }}>
            {conditions.map(c => <li key={c}>{c}</li>)}
          </ul>
          <div style={{ fontSize: 12, color: '#374151', background: `${colour}14`, borderRadius: 6, padding: '8px 12px', lineHeight: 1.6 }}>
            <strong>Action:</strong> {action}
          </div>
        </div>
      ))}
    </div>
  );
}

const TIER_LABELS: Record<string, { label: string; colour: string; bg: string }> = {
  surgical:  { label: 'Surgical',  colour: '#dc2626', bg: '#fef2f2' },
  endoscopy: { label: 'Endoscopy', colour: '#7c3aed', bg: '#f5f3ff' },
  clinic:    { label: 'Clinic',    colour: '#0d9488', bg: '#f0fdf9' },
};

function ChainCard({ chain }: { chain: CareChain }) {
  const tier = TIER_LABELS[chain.tier];
  const urgencyColour = chain.urgency === 'urgent' ? '#dc2626' : chain.urgency === 'priority' ? '#d97706' : '#059669';
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2eeed', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div style={{ background: tier.bg, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: tier.colour, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{tier.label}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{chain.condition}</div>
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: urgencyColour, background: `${urgencyColour}14`, padding: '3px 10px', borderRadius: 100, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {chain.urgency}
        </div>
      </div>

      {/* Steps */}
      <div style={{ padding: '16px 20px', display: 'flex', gap: 0, alignItems: 'stretch' }}>
        {chain.steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'stretch', flex: 1 }}>
            {/* Step box */}
            <div style={{ flex: 1, background: '#f8fafc', borderRadius: 8, padding: '10px 12px', border: '1px solid #e2eeed' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: tier.colour, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Step {i + 1}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{step.label}</div>
              {step.sub && <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{step.sub}</div>}
            </div>
            {/* Arrow connector */}
            {i < chain.steps.length - 1 && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c0e4e0" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Book CTA */}
      <div style={{ padding: '0 20px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <Link href={chain.bookHref} style={{
          fontSize: 12, fontWeight: 700, color: tier.colour,
          textDecoration: 'none', padding: '6px 14px',
          border: `1px solid ${tier.colour}33`, borderRadius: 6,
          background: tier.bg,
        }}>
          Book this pathway →
        </Link>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PathwayPage() {
  const surgical  = CHAINS.filter(c => c.tier === 'surgical');
  const endoscopy = CHAINS.filter(c => c.tier === 'endoscopy');
  const clinic    = CHAINS.filter(c => c.tier === 'clinic');

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <nav className="amise-sub-nav" style={{ background: 'rgba(255,255,255,0.97)' }}>
        <div className="amise-sub-nav-inner">
          <a href="/" style={{ fontSize: 14, fontWeight: 600, color: '#0d9488', textDecoration: 'none' }}>
            <span className="amise-sub-nav-back-full">← Amise Medical Services</span>
            <span className="amise-sub-nav-back-short">← Home</span>
          </a>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/guidance" className="amise-sub-nav-secondary" style={{ fontSize: 13, fontWeight: 600, color: '#4b5563', textDecoration: 'none', padding: '8px 16px' }}>
              Health Guidance
            </Link>
            <Link href="/book" style={{ fontSize: 13, padding: '9px 20px', background: '#0d9488', color: '#fff', borderRadius: 50, textDecoration: 'none', fontWeight: 700 }}>
              Book Appointment
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #0b2a35 0%, #134e4a 100%)', padding: '56px 40px' }}>
        <div style={{ maxWidth: 1160, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Patient Care Pathway
          </div>
          <h1 style={{ margin: '0 0 14px', fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 900, color: '#f1f5f9', lineHeight: 1.15 }}>
            From first contact to recovered —<br />every step with you
          </h1>
          <p style={{ margin: 0, fontSize: 15, color: '#94a3b8', lineHeight: 1.7, maxWidth: 600 }}>
            Dr Kabiye&apos;s practice handles a broad range of general surgical and endoscopic conditions.
            This page shows how each patient type moves through the system — from how they reach us,
            through triage and treatment, to post-operative care.
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 1160, margin: '0 auto', padding: '56px 40px' }}>

        {/* ── 1. Entry Points ── */}
        <section style={{ marginBottom: 16 }}>
          <SectionTitle sub="Four ways to reach Amise Medical Services — each feeds the same triage and scheduling system.">
            1 · How patients reach us
          </SectionTitle>
          <EntryPoints />
        </section>

        <Arrow />

        {/* ── 2. Triage ── */}
        <section style={{ marginBottom: 16 }}>
          <SectionTitle sub="Every contact is triaged against three priority tiers. Urgency drives slot allocation — urgent patients always get a slot, even if a squeeze is needed.">
            2 · Clinical triage
          </SectionTitle>
          <TriageTiers />
        </section>

        <Arrow />

        {/* ── 3. Surgical chains ── */}
        <section style={{ marginBottom: 48 }}>
          <SectionTitle sub="Clear surgical conditions with defined pathways from first assessment to discharge.">
            3 · Surgical care chains
          </SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {surgical.map(c => <ChainCard key={c.condition} chain={c} />)}
          </div>
        </section>

        {/* ── 4. Endoscopy chains ── */}
        <section style={{ marginBottom: 48 }}>
          <SectionTitle sub="Procedure-based pathways — preparation instructions sent automatically by email on booking.">
            4 · Endoscopy care chains
          </SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {endoscopy.map(c => <ChainCard key={c.condition} chain={c} />)}
          </div>
        </section>

        {/* ── 5. Clinic chains ── */}
        <section style={{ marginBottom: 64 }}>
          <SectionTitle sub="Outpatient and specialist clinic pathways.">
            5 · Clinic pathways
          </SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {clinic.map(c => <ChainCard key={c.condition} chain={c} />)}
          </div>
        </section>

        {/* ── CTA ── */}
        <div style={{ background: '#0b2a35', borderRadius: 14, padding: '36px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', marginBottom: 6 }}>Ready to get started?</div>
            <div style={{ fontSize: 14, color: '#94a3b8' }}>Book online, or ask your GP or specialist to send a referral — our team will take it from there.</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/book"    style={{ padding: '12px 24px', background: '#0d9488', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Book an Appointment →</Link>
            <Link href="/refer"   style={{ padding: '12px 24px', background: 'transparent', color: '#94a3b8', border: '1px solid #374151', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Refer a Patient →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
