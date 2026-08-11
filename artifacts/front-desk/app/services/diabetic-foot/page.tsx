import type { Metadata } from 'next';
import Link from 'next/link';
import { WA_TAPION, WA_RODNEY, PHONE_TAPION, PHONE_RODNEY, WaSvg } from '@/app/components/shared';

export const metadata: Metadata = {
  title: 'Diabetic Foot Clinic — Wound Care, Prevention & Surgery',
  description: 'Specialist diabetic foot care in Saint Lucia — wound assessment, debridement, infection management, vascular review, and limb-salvage surgery by Dr Dawit Daniel Kabiye, MD, DM.',
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

export default function DiabeticFootPage() {
  return (
    <>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 60%, #eef7f6 100%)', padding: '64px 40px 56px', borderBottom: '1px solid #e2eeed' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <Link href="/#services" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0d9488', textDecoration: 'none', marginBottom: 20, fontWeight: 600 }}>
            ← Back to Services
          </Link>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Specialist Wound &amp; Limb Care</div>
          <h1 style={{ margin: '0 0 16px', fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
            Diabetic Foot Clinic
          </h1>
          <p style={{ margin: '0 0 16px', fontSize: 17, color: '#374151', lineHeight: 1.8, maxWidth: 640 }}>
            Diabetic foot complications are the leading cause of non-traumatic lower limb amputation worldwide — but most amputations are preventable with early, expert care. Our multidisciplinary approach focuses on wound healing, limb salvage, and giving you the knowledge to protect your feet long-term.
          </p>
          <div style={{ padding: '14px 20px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 10, marginBottom: 28, maxWidth: 560 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>⚠️ Seek urgent care if you notice:</div>
            <p style={{ margin: 0, fontSize: 13, color: '#7f1d1d', lineHeight: 1.7 }}>
              Spreading redness, rapidly worsening swelling, black or dark tissue, foul-smelling discharge, fever, or inability to bear weight. These are signs of serious infection that require same-day or emergency assessment.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/book" style={{ padding: '12px 28px', background: '#0d9488', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Book Foot Clinic →
            </Link>
            <a href={WA_TAPION} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: '#fff', border: '1.5px solid #0d9488', color: '#0d9488', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              <WaSvg size={16} color="#0d9488" /> WhatsApp Urgent
            </a>
          </div>
        </div>
      </section>

      {/* Wound Care Services */}
      <section style={{ padding: '64px 40px', background: '#fff' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <SectionHeading sub="A systematic, evidence-based approach to every diabetic foot wound.">
            Wound Care Services
          </SectionHeading>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {[
              { icon: '🔍', title: 'Comprehensive Wound Assessment', body: 'Full evaluation using the Wagner/Texas classification — wound depth, area, presence of ischaemia, infection signs, and neuropathy. Baseline photography for progress tracking.' },
              { icon: '🩹', title: 'Sharp Debridement', body: 'Removal of necrotic, sloughy, or infected tissue to promote a clean wound base. Carried out by Dr Kabiye in clinic or theatre depending on extent and depth.' },
              { icon: '💊', title: 'Infection Management', body: 'Wound swabs, targeted antibiotic therapy guided by culture results, and assessment for deep infection or osteomyelitis (bone infection) requiring more intensive treatment.' },
              { icon: '🦺', title: 'Offloading', body: 'Pressure redistribution using total contact casts, removable cast walkers, or custom orthotics. Correct offloading is the single most important factor in wound healing.' },
              { icon: '🩸', title: 'Vascular Assessment', body: 'Ankle-brachial pressure index (ABPI) measurement and assessment of peripheral arterial disease. If significant ischaemia is present, vascular surgery referral is arranged for revascularisation.' },
              { icon: '📈', title: 'Progress Monitoring', body: 'Regular clinic reviews to measure wound response, adjust dressings, modify offloading, and escalate if healing is not progressing. Clear wound healing targets at each visit.' },
            ].map(({ icon, title, body }) => (
              <div key={title} style={{ background: '#f8fafc', border: '1px solid #e2eeed', borderRadius: 12, padding: '24px 20px' }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>{icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{title}</div>
                <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Daily Tips */}
      <section style={{ padding: '64px 40px', background: '#fffbeb' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <SectionHeading sub="Simple daily habits that dramatically reduce your risk of foot complications.">
            Daily Foot Care — What You Can Do
          </SectionHeading>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 14 }}>Inspection &amp; Hygiene</div>
              {[
                'Inspect both feet every day — look between the toes for cuts, blisters, redness, or swelling. Use a mirror or ask someone to help if you cannot see clearly',
                'Wash feet daily in lukewarm (not hot) water. Test temperature with your elbow — neuropathy means you cannot reliably feel heat',
                'Dry thoroughly, especially between the toes. Moisture between toes promotes fungal infection',
                'Apply moisturiser to dry or cracked skin on the heel and sole — but not between the toes',
                'Cut toenails straight across, not curved. Never cut into the corners',
                'Do not use scissors, blades, or corn plasters on hard skin — see a podiatrist',
              ].map(tip => (
                <div key={tip} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, color: '#92400e', fontWeight: 800 }}>✓</div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{tip}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 14 }}>Footwear &amp; Activity</div>
              {[
                'Never walk barefoot — not indoors, not on the beach, not anywhere. A small injury can become a serious wound within days',
                'Wear well-fitting, cushioned shoes with a wide toe box. Avoid tight shoes, sandals with thin straps, and shoes without backs',
                'Shake out your shoes before putting them on — something inside (a stone, folded insole) can cause a pressure wound you cannot feel',
                'Change socks daily. Wear moisture-wicking, seamless socks without tight elastic tops',
                'Check the inside of new shoes frequently in the first days — watch for rub marks on your feet',
                'Keep blood sugar, blood pressure, and cholesterol in your target range — poor control dramatically slows wound healing',
                'Stop smoking. Smoking severely reduces blood flow to the feet and is the single biggest modifiable risk factor for amputation',
              ].map(tip => (
                <div key={tip} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, color: '#92400e', fontWeight: 800 }}>✓</div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{tip}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Urgent Symptoms */}
      <section style={{ padding: '64px 40px', background: '#fff' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <SectionHeading>When to Seek Urgent Care</SectionHeading>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.8, marginTop: 0, marginBottom: 24 }}>
            Diabetic foot infections can progress to limb-threatening and life-threatening within hours. Contact us immediately — or attend the nearest emergency department — if you experience any of the following:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {[
              { level: 'SAME DAY', color: '#dc2626', bg: '#fff5f5', border: '#fca5a5', signs: ['Spreading redness beyond the wound edge', 'Rapid increase in swelling', 'Pus or foul-smelling discharge', 'Fever or feeling unwell / shivering'] },
              { level: 'URGENT — within 48 hours', color: '#d97706', bg: '#fffbeb', border: '#fcd34d', signs: ['New wound, blister, or cut that is not healing', 'Increasing pain in a wound (can indicate worsening infection)', 'Wound larger than 2 cm or deeper than skin', 'Discolouration of toe or foot (blue, purple, or dark)'] },
              { level: 'THIS WEEK', color: '#0d9488', bg: '#f0fdf9', border: '#a7f3d0', signs: ['Wound not smaller after 2 weeks of home care', 'New numbness or tingling in foot', 'Pain walking or at rest (possible vascular disease)', 'Hard skin or callus over a bony area'] },
            ].map(({ level, color, bg, border, signs }) => (
              <div key={level} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: '22px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>{level}</div>
                {signs.map(s => (
                  <div key={s} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 9, fontWeight: 800, color }}>!</div>
                    <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>{s}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Surgical Options */}
      <section style={{ padding: '64px 40px', background: '#f5fafa' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <SectionHeading sub="Surgery is only considered when conservative measures are insufficient. Our goal is always limb preservation.">
            Surgical Options
          </SectionHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { title: 'Surgical Debridement', body: 'When wound debridement in clinic is insufficient — for deep, extensive, or heavily infected wounds — debridement is performed under anaesthesia in theatre. Allows complete excision of all non-viable tissue and reduces bacterial load rapidly.' },
              { title: 'Abscess Drainage', body: 'Established collections of pus are drained surgically when they cannot be managed with antibiotics alone. Deep spaces in the foot (plantar fascia, tendon sheaths) may require extended drainage under general anaesthesia.' },
              { title: 'Bone Resection for Osteomyelitis', body: 'When bone is infected (osteomyelitis), partial bone resection may be required. This allows the surrounding wound to heal while avoiding prolonged antibiotic courses where surgical cure is possible.' },
              { title: 'Toe or Ray Amputation', body: 'When a single toe or digit is gangrenous or unsalvageable, limited amputation preserves the rest of the foot. A ray amputation (toe + metatarsal head) is used when infection extends into the foot. Most patients can walk well after these procedures.' },
              { title: 'Below-knee Amputation', body: 'Reserved for limb-threatening infection or gangrene that cannot be controlled, or when ischaemia is too severe for healing. Every effort is made to preserve the knee joint, as below-knee amputees have significantly better rehabilitation outcomes.' },
              { title: 'Vascular Referral for Revascularisation', body: 'When poor blood supply is a primary factor, referral to a vascular surgeon for angioplasty, stenting, or bypass surgery can restore perfusion and enable wound healing that would otherwise be impossible.' },
            ].map(({ title, body }) => (
              <div key={title} style={{ background: '#fff', border: '1px solid #e2eeed', borderRadius: 10, padding: '18px 22px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0d9488', marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8 }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Multidisciplinary */}
      <section style={{ padding: '56px 40px', background: '#0b2a35' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Our Approach</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>Coordinated Multidisciplinary Care</h2>
          <div style={{ width: 40, height: 3, background: '#0d9488', borderRadius: 2, marginBottom: 24 }} />
          <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.9, marginBottom: 24 }}>
            Successful diabetic foot management requires collaboration across multiple specialties. Dr Kabiye coordinates care between surgeons, physicians, endocrinologists, podiatrists, vascular surgeons, and rehabilitation specialists to address every dimension of your condition.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {[
              { icon: '🔪', role: 'General Surgery', desc: 'Wound debridement, infection control, amputation decisions' },
              { icon: '💉', role: 'Endocrinology / Diabetes', desc: 'Blood sugar optimisation for wound healing' },
              { icon: '🫀', role: 'Vascular Surgery', desc: 'Revascularisation when blood supply is compromised' },
              { icon: '🦶', role: 'Podiatry', desc: 'Wound dressings, offloading, nail care, long-term prevention' },
              { icon: '🏃', role: 'Rehabilitation', desc: 'Post-amputation prosthetics, physiotherapy, and mobility' },
            ].map(({ icon, role, desc }) => (
              <div key={role} style={{ background: '#1e4a5a', borderRadius: 10, padding: '18px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>{role}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section style={{ padding: '56px 40px', background: '#0d9488', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: '#fff' }}>Protecting your feet starts with a single appointment</h2>
          <p style={{ margin: '0 0 28px', fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
            Whether you have an active wound, a concern about a healing foot ulcer, or you want a preventive diabetic foot check — we are here to help. Same-week and urgent appointments available.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/book" style={{ padding: '13px 30px', background: '#fff', color: '#0d9488', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Book Foot Clinic →
            </Link>
            <a href={WA_TAPION} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 24px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              <WaSvg size={16} color="#fff" /> Tapion: {PHONE_TAPION}
            </a>
            <a href={WA_RODNEY} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 24px', background: 'rgba(255,255,255,0.15)', color: '#fff', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              <WaSvg size={16} color="#fff" /> Rodney Bay: {PHONE_RODNEY}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
