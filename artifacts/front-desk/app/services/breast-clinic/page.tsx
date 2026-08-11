import type { Metadata } from 'next';
import Link from 'next/link';
import { WA_TAPION, WA_RODNEY, PHONE_TAPION, PHONE_RODNEY, WaSvg } from '@/app/components/shared';

export const metadata: Metadata = {
  title: 'Breast Clinic — Early Detection, Assessment & Surgical Care',
  description: 'Breast clinic in Saint Lucia — lump assessment, biopsy, mammogram review, and surgical planning by Dr Dawit Daniel Kabiye, MD, DM. Early detection saves lives.',
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

export default function BreastClinicPage() {
  return (
    <>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #fdf4ff 0%, #fce7f3 60%, #eef7f6 100%)', padding: '64px 40px 56px', borderBottom: '1px solid #e2eeed' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <Link href="/#services" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0d9488', textDecoration: 'none', marginBottom: 20, fontWeight: 600 }}>
            ← Back to Services
          </Link>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Breast Health &amp; Surgery</div>
          <h1 style={{ margin: '0 0 16px', fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
            Breast Clinic
          </h1>
          <p style={{ margin: '0 0 16px', fontSize: 17, color: '#374151', lineHeight: 1.8, maxWidth: 640 }}>
            Early detection is the most powerful tool against breast cancer. Our dedicated breast clinic offers rapid assessment, imaging review, biopsy, and expert surgical planning — all in one place.
          </p>
          <div style={{ padding: '14px 20px', background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.25)', borderRadius: 10, marginBottom: 28, maxWidth: 560 }}>
            <p style={{ margin: 0, fontSize: 13, color: '#065f46', fontWeight: 600, lineHeight: 1.7 }}>
              💡 If you have noticed a breast lump, skin change, nipple discharge, or other concern — do not wait. Early review gives the best outcome. Same-week appointments are available.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/book" style={{ padding: '12px 28px', background: '#0d9488', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Book Breast Clinic →
            </Link>
            <a href={WA_TAPION} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: '#fff', border: '1.5px solid #0d9488', color: '#0d9488', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              <WaSvg size={16} color="#0d9488" /> WhatsApp Us
            </a>
          </div>
        </div>
      </section>

      {/* Early Detection Banner */}
      <section style={{ padding: '48px 40px', background: '#0d9488' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: '#fff' }}>Early Detection Saves Lives</h2>
          <p style={{ margin: '0 0 28px', fontSize: 14, color: 'rgba(255,255,255,0.9)', lineHeight: 1.8, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
            When breast cancer is caught at Stage I, survival rates exceed 99%. Regular self-examination, annual clinical review, and timely investigation of any new change are the cornerstones of early detection.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 700, margin: '0 auto' }}>
            {[
              { stat: '99%', label: 'Survival — Stage I detected early' },
              { stat: '1 in 8', label: 'Women affected in their lifetime' },
              { stat: '40%', label: 'Mortality reduction with screening' },
            ].map(({ stat, label }) => (
              <div key={stat} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '16px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{stat}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section style={{ padding: '64px 40px', background: '#fff' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <SectionHeading sub="We offer a complete breast diagnostic and surgical service in a single, coordinated pathway.">
            Our Breast Clinic Services
          </SectionHeading>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {[
              { icon: '🩺', title: 'Clinical Breast Examination', body: 'A thorough, systematic physical examination to assess any lump, skin change, nipple inversion, or axillary lymphadenopathy. The starting point for every breast concern.' },
              { icon: '🔬', title: 'Mammogram Review', body: 'We review your existing mammogram with you, explain the findings, and arrange additional imaging or biopsy if required. We work with all Saint Lucia imaging centres.' },
              { icon: '🖥️', title: 'Ultrasound-guided Assessment', body: 'Targeted breast ultrasound to characterise lumps, assess lymph nodes, and guide biopsy needles to exactly the right spot. Particularly useful for younger patients and dense breast tissue.' },
              { icon: '🧬', title: 'Fine Needle Aspiration (FNAC)', body: 'A thin needle removes cells from a lump for rapid pathological analysis. Usually performed in clinic without local anaesthetic. Results within days.' },
              { icon: '🔩', title: 'Core Needle Biopsy', body: 'A slightly larger needle obtains a core of tissue for detailed histological analysis — giving a definitive tissue diagnosis including receptor status for any cancer found.' },
              { icon: '📋', title: 'Surgical Planning & MDT Review', body: 'All significant findings are reviewed as part of a multidisciplinary approach. Dr Kabiye will discuss surgical options, oncology referral, and reconstruction options at a dedicated planning appointment.' },
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

      {/* Symptoms */}
      <section style={{ padding: '64px 40px', background: '#f5fafa' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <SectionHeading>Symptoms to Watch For</SectionHeading>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.8, marginBottom: 24, marginTop: 0 }}>
            Most breast changes are not cancer, but any new or unexplained symptom should be reviewed promptly. Please contact us if you notice any of the following:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              'A new lump or thickening in the breast or armpit',
              'Change in size, shape, or feel of one or both breasts',
              'Skin dimpling, puckering, or redness',
              'Nipple inversion (pulling inward) — especially if new',
              'Nipple discharge — especially if bloody or from one side',
              'Rash, scaling, or crusting on or around the nipple',
              'Persistent breast pain (especially in one spot)',
              'Swollen or lumpy lymph nodes in the armpit',
            ].map(s => (
              <div key={s} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#fff', border: '1px solid #e2eeed', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12 }}>⚠️</div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{s}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, padding: '16px 20px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>Important</div>
            <p style={{ margin: 0, fontSize: 13, color: '#7f1d1d', lineHeight: 1.7 }}>
              This list is for awareness only — it does not replace a professional examination. If you are in any doubt, please book a clinical review. A normal finding after assessment is reassuring; a missed finding is not.
            </p>
          </div>
        </div>
      </section>

      {/* Surgical Options */}
      <section style={{ padding: '64px 40px', background: '#fff' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <SectionHeading sub="When surgery is indicated, Dr Kabiye will discuss all available options with you at your consultation.">
            Surgical Options
          </SectionHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { title: 'Wide Local Excision (Lumpectomy)', body: 'Removal of the tumour with a margin of normal tissue, preserving the breast. The standard surgical treatment for most early breast cancers when the tumour-to-breast ratio allows. Usually followed by radiotherapy.' },
              { title: 'Mastectomy', body: 'Removal of the whole breast — indicated for larger tumours, multifocal disease, BRCA-positive patients, or patient preference. Can be skin-sparing or nipple-sparing to facilitate reconstruction.' },
              { title: 'Sentinel Lymph Node Biopsy (SLNB)', body: 'Minimally invasive technique to assess the first draining lymph node in the axilla. If negative, further lymph node surgery is avoided. Standard of care for early breast cancer.' },
              { title: 'Axillary Lymph Node Clearance', body: 'Removal of the lymph nodes in the armpit when sentinel node biopsy is positive or macroscopic node involvement is present. Important for staging and regional control.' },
              { title: 'Benign Lump Excision', body: 'Surgical removal of fibroadenomas, cysts, or other benign lumps when they are large, symptomatic, rapidly growing, or causing distress — or when a biopsy result requires excision for certainty.' },
              { title: 'Reconstructive Referral', body: 'Where reconstruction is desired after mastectomy, Dr Kabiye coordinates with plastic surgery colleagues for implant-based or tissue-based reconstruction, ensuring continuity of care.' },
            ].map(({ title, body }) => (
              <div key={title} style={{ background: '#f0fdf9', border: '1px solid #a7f3d0', borderRadius: 10, padding: '18px 22px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#065f46', marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.8 }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What to Expect at Appointment */}
      <section style={{ padding: '64px 40px', background: '#f5fafa' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <SectionHeading>What to Expect at Your Appointment</SectionHeading>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            {[
              { n: '1', title: 'History', body: 'Discussion of your symptoms, when you noticed them, family history of breast or ovarian cancer, and previous imaging or biopsies.' },
              { n: '2', title: 'Examination', body: 'Clinical breast examination and assessment of axillary lymph nodes in a private, chaperoned setting.' },
              { n: '3', title: 'Imaging review', body: 'Any existing mammograms or ultrasound scans are reviewed and discussed with you.' },
              { n: '4', title: 'Biopsy if indicated', body: 'FNAC or core biopsy may be arranged the same day or at a separate session, depending on findings.' },
              { n: '5', title: 'Plan & next steps', body: 'A clear explanation of findings, recommended investigations, timeline, and surgical options if relevant.' },
            ].map(({ n, title, body }) => (
              <div key={n} style={{ background: '#fff', border: '1px solid #e2eeed', borderRadius: 12, padding: '20px 18px', textAlign: 'center' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 15, fontWeight: 800, color: '#fff' }}>{n}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{title}</div>
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.7 }}>{body}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 24, padding: '14px 20px', background: '#f0fdf9', border: '1px solid #a7f3d0', borderRadius: 10, fontSize: 13, color: '#065f46', lineHeight: 1.7 }}>
            <strong>You are welcome to bring a support person</strong> to your breast clinic appointment. Please bring any previous imaging on a CD or a report if you have one.
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section style={{ padding: '56px 40px', background: '#0d9488', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: '#fff' }}>Don&apos;t delay — book your breast clinic appointment today</h2>
          <p style={{ margin: '0 0 28px', fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
            Same-week appointments are available. Early review of any breast concern is always the right decision.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/book" style={{ padding: '13px 30px', background: '#fff', color: '#0d9488', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Book Breast Clinic →
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
