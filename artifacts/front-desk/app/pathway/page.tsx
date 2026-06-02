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
      sub: 'amisemedicalservices.com/book',
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
      sub: 'amisemedicalservices.com/refer',
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

function DeploymentSection() {
  const services = [
    {
      name: 'Vercel',
      role: 'Hosting (Next.js)',
      detail: 'Connect GitHub repo → auto-deploy on push. Add all env vars in Project Settings → Environment Variables.',
      effort: 'Easy',
      colour: '#0f172a',
    },
    {
      name: 'Supabase',
      role: 'Database + Auth',
      detail: 'Create project → run supabase-schema.sql in SQL editor → copy URL and anon key (JWT format, eyJ…) to env.',
      effort: 'Easy',
      colour: '#3ecf8e',
    },
    {
      name: 'Google Cloud',
      role: 'Calendar + Gmail',
      detail: 'Enable Calendar API and Gmail API → create service account → grant domain-wide delegation → download JSON key → paste to GOOGLE_SERVICE_ACCOUNT_JSON.',
      effort: 'Moderate',
      colour: '#4285f4',
    },
    {
      name: 'Twilio',
      role: 'WhatsApp + SMS',
      detail: 'Create account → enrol WhatsApp Business sender → get approved (can take 1–2 days) → copy Account SID and Auth Token.',
      effort: 'Moderate',
      colour: '#f22f46',
    },
    {
      name: 'Anthropic',
      role: 'Claude AI intake',
      detail: 'Sign up at console.anthropic.com → generate API key → paste to ANTHROPIC_API_KEY.',
      effort: 'Easy',
      colour: '#d97706',
    },
    {
      name: 'Custom Domain',
      role: 'amisemedicalservices.com',
      detail: 'In Vercel: Project → Domains → add your domain → update DNS at your registrar (A record or CNAME to Vercel). HTTPS is automatic.',
      effort: 'Easy',
      colour: '#0d9488',
    },
  ];

  const effortColour = (e: string) =>
    e === 'Easy' ? '#059669' : e === 'Moderate' ? '#d97706' : '#dc2626';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
      {services.map(({ name, role, detail, effort, colour }) => (
        <div key={name} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e2eeed', padding: '20px 22px', borderLeft: `4px solid ${colour}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{name}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{role}</div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: effortColour(effort), background: `${effortColour(effort)}14`, padding: '2px 8px', borderRadius: 100, whiteSpace: 'nowrap' }}>
              {effort}
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.7 }}>{detail}</p>
        </div>
      ))}
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
          <a href="/" style={{ fontSize: 14, fontWeight: 600, color: '#0d9488', textDecoration: 'none' }}>← Amise Medical Services</a>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/guidance" style={{ fontSize: 13, fontWeight: 600, color: '#4b5563', textDecoration: 'none', padding: '8px 16px' }}>
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

        {/* ── Divider ── */}
        <div style={{ borderTop: '2px solid #e2eeed', margin: '0 0 56px' }} />

        {/* ── 6. Deployment ── */}
        <section id="deploy" style={{ marginBottom: 48 }}>
          <SectionTitle sub="Six services to configure. Copy .env.local.example, fill in credentials, deploy to Vercel.">
            6 · Deployment environment
          </SectionTitle>

          {/* Mode ladder */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2eeed', padding: '20px 24px', marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 14 }}>Go-live ladder — start slow, build confidence</div>
            <div style={{ display: 'flex', gap: 0 }}>
              {[
                { mode: 'dry_run',    label: 'Dry Run',    desc: 'Everything logs, nothing sends. Safe for development and initial testing.', colour: '#64748b' },
                { mode: 'supervised', label: 'Supervised', desc: 'AI drafts replies and bookings. Staff reviews and approves each one before it goes out.', colour: '#d97706' },
                { mode: 'auto',       label: 'Auto',       desc: 'Fully automated outbound. Use only after supervised mode has run cleanly for one week.', colour: '#0d9488' },
              ].map(({ mode, label, desc, colour }, i, arr) => (
                <div key={mode} style={{ flex: 1, display: 'flex', alignItems: 'stretch' }}>
                  <div style={{ flex: 1, padding: '14px 18px', background: `${colour}0f`, borderTop: `3px solid ${colour}`, borderRadius: i === 0 ? '8px 0 0 8px' : i === arr.length - 1 ? '0 8px 8px 0' : 0, border: `1px solid ${colour}33`, borderLeft: i > 0 ? 'none' : undefined }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: colour, marginBottom: 4 }}>MODE={mode}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.6 }}>{desc}</div>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0 0 0 0' }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c0e4e0" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DeploymentSection />

          {/* Env file note */}
          <div style={{ marginTop: 24, background: '#0f172a', borderRadius: 10, padding: '16px 20px', fontFamily: 'monospace', fontSize: 12, color: '#94a3b8' }}>
            <div style={{ color: '#0d9488', marginBottom: 8, fontWeight: 700 }}># Quick start</div>
            <div>cp artifacts/front-desk/.env.local.example artifacts/front-desk/.env.local</div>
            <div style={{ color: '#475569', marginTop: 2 }}># Fill in all values, then:</div>
            <div>pnpm --filter @workspace/front-desk run dev</div>
          </div>
        </section>

        {/* ── CTA ── */}
        <div style={{ background: '#0b2a35', borderRadius: 14, padding: '36px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', marginBottom: 6 }}>Ready to activate the system?</div>
            <div style={{ fontSize: 14, color: '#94a3b8' }}>Start in dry_run, book a test patient, review the logs, then promote to supervised.</div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/book"    style={{ padding: '12px 24px', background: '#0d9488', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Book Test Patient →</Link>
            <Link href="/refer"   style={{ padding: '12px 24px', background: 'transparent', color: '#94a3b8', border: '1px solid #374151', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Test GP Referral →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
