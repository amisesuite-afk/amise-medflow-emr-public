import type { Metadata } from 'next';
import Link from 'next/link';
import { WA_TAPION, WA_RODNEY, PHONE_TAPION, PHONE_RODNEY, WaSvg } from '@/app/components/shared';

export const metadata: Metadata = {
  title: 'Endoscopy Services — Colonoscopy, Gastroscopy & More',
  description: 'Expert endoscopy in Saint Lucia — colonoscopy, gastroscopy (OGD), flexible sigmoidoscopy, polypectomy, and capsule endoscopy, performed by Dr Dawit Daniel Kabiye, MD, DM at Tapion Hospital.',
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

function InfoCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2eeed', borderRadius: 12, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 28, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{title}</div>
      <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>{body}</div>
    </div>
  );
}

export default function EndoscopyPage() {
  return (
    <>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #eef7f6 0%, #f0fdf9 100%)', padding: '64px 40px 56px', borderBottom: '1px solid #e2eeed' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <Link href="/#services" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#0d9488', textDecoration: 'none', marginBottom: 20, fontWeight: 600 }}>
            ← Back to Services
          </Link>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>Amise Medical Services</div>
          <h1 style={{ margin: '0 0 16px', fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
            Endoscopy Services
          </h1>
          <p style={{ margin: '0 0 28px', fontSize: 17, color: '#374151', lineHeight: 1.8, maxWidth: 620 }}>
            Minimally invasive, camera-guided procedures to diagnose and treat conditions of the digestive system — performed by Dr Dawit Daniel Kabiye, MD, DM, a fellowship-trained endoscopist at Tapion Hospital, Saint Lucia.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/book" style={{ padding: '12px 28px', background: '#0d9488', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Book Endoscopy →
            </Link>
            <a href={WA_TAPION} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', background: '#fff', border: '1.5px solid #0d9488', color: '#0d9488', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              <WaSvg size={16} color="#0d9488" /> WhatsApp Us
            </a>
          </div>
        </div>
      </section>

      {/* Procedures Offered */}
      <section style={{ padding: '64px 40px', background: '#fff' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <SectionHeading sub="We offer the full range of upper and lower GI endoscopic procedures at Tapion Hospital.">
            Procedures We Offer
          </SectionHeading>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {[
              { icon: '🔭', title: 'Gastroscopy (OGD)', body: 'Examination of the oesophagus, stomach, and first part of the small intestine. Used to investigate reflux, ulcers, bleeding, dysphagia, and unexplained weight loss.' },
              { icon: '🔬', title: 'Colonoscopy', body: 'Examination of the entire large bowel. The gold-standard investigation for bowel cancer screening, polyps, IBD, rectal bleeding, and altered bowel habit.' },
              { icon: '🩺', title: 'Flexible Sigmoidoscopy', body: 'Examination of the lower colon and rectum. A shorter, quicker procedure ideal for investigating rectal bleeding, left-sided symptoms, or targeted surveillance.' },
              { icon: '✂️', title: 'Polypectomy', body: 'Removal of bowel polyps at the time of colonoscopy. Catching and removing polyps early prevents them from developing into colorectal cancer.' },
              { icon: '💊', title: 'Biopsy', body: 'Tissue sampling during upper or lower GI endoscopy for pathological analysis — used to diagnose coeliac disease, H. pylori, Barrett\'s oesophagus, IBD, and malignancy.' },
              { icon: '🩹', title: 'Haemostasis & Injection', body: 'Endoscopic treatment of active bleeding — adrenaline injection, clips, or thermal coagulation — performed during the same procedure when a bleeding source is found.' },
            ].map(p => <InfoCard key={p.title} {...p} />)}
          </div>
        </div>
      </section>

      {/* What to Expect */}
      <section style={{ padding: '64px 40px', background: '#f5fafa' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <SectionHeading>What to Expect</SectionHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { n: '1', title: 'Before your procedure', body: 'You will receive a preparation letter with fasting instructions. For colonoscopy, this includes a bowel cleansing preparation the day before. For gastroscopy, you will fast from midnight. Arrange a responsible adult to drive you home after sedation.' },
              { n: '2', title: 'On the day', body: 'Arrive at Tapion Hospital 30–45 minutes before your scheduled time. A nurse will check your details, weight, blood pressure, and any allergies. You will be given a hospital gown and a small cannula (IV line) placed in your arm for sedation medication.' },
              { n: '3', title: 'During the procedure', body: 'You will receive intravenous sedation (conscious sedation) so you are comfortable and relaxed. Most endoscopy procedures take 15–30 minutes. You will be monitored throughout with pulse oximetry and ECG.' },
              { n: '4', title: 'Recovery', body: 'You will rest in the recovery area for approximately 60 minutes while the sedation wears off. A nurse will check your observations. Dr Kabiye will speak with you to share findings before discharge. You must not drive, operate machinery, or sign legal documents for 24 hours.' },
              { n: '5', title: 'Results', body: 'Biopsy results typically return within 5–10 working days. You will receive a follow-up appointment or results letter. An endoscopy report is given to you before leaving.' },
            ].map(({ n, title, body }, i, arr) => (
              <div key={n} style={{ display: 'flex', gap: 20, paddingBottom: i < arr.length - 1 ? 28 : 0 }}>
                <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: '50%', background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff' }}>{n}</div>
                <div style={{ paddingTop: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{title}</div>
                  <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.8 }}>{body}</div>
                  {i < arr.length - 1 && <div style={{ width: 2, height: 20, background: '#d1fae5', marginTop: 12, marginLeft: -29 }} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preparation */}
      <section style={{ padding: '64px 40px', background: '#fff' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <SectionHeading>Preparation Instructions</SectionHeading>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={{ background: '#f0fdf9', border: '1px solid #a7f3d0', borderRadius: 12, padding: '28px 24px' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#065f46', marginBottom: 16 }}>Gastroscopy (Upper GI)</div>
              <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 14, color: '#374151', lineHeight: 2.0 }}>
                <li>Fast from midnight (no food or drink, including water)</li>
                <li>Take your regular morning medications with a small sip of water unless told otherwise</li>
                <li>Stop iron tablets 5 days before</li>
                <li>Inform us of blood thinners (warfarin, aspirin, clopidogrel)</li>
                <li>Do not wear nail varnish</li>
                <li>Arrange a driver — you cannot drive home</li>
              </ul>
            </div>
            <div style={{ background: '#f0fdf9', border: '1px solid #a7f3d0', borderRadius: 12, padding: '28px 24px' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#065f46', marginBottom: 16 }}>Colonoscopy / Sigmoidoscopy</div>
              <ul style={{ margin: 0, padding: '0 0 0 18px', fontSize: 14, color: '#374151', lineHeight: 2.0 }}>
                <li>Low residue diet 2–3 days before</li>
                <li>Bowel prep solution as prescribed — split-dose usually gives best results</li>
                <li>Clear liquids only on the day before</li>
                <li>Nothing by mouth from midnight before the procedure</li>
                <li>Stop iron tablets 5 days before</li>
                <li>Inform us of blood thinners or diabetes medication</li>
                <li>Arrange a driver — sedation means no driving for 24 hours</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Risks & Benefits */}
      <section style={{ padding: '64px 40px', background: '#f5fafa' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <SectionHeading>Risks &amp; Benefits</SectionHeading>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#065f46', marginBottom: 14 }}>Benefits</div>
              {[
                'Accurate diagnosis without surgery',
                'Treatment at the time of diagnosis (e.g., polyp removal)',
                'Short procedure — most take under 30 minutes',
                'Rapid recovery — home the same day',
                'Prevents cancer when polyps found early',
                'Avoids the need for open or keyhole surgery in many cases',
              ].map(b => (
                <div key={b} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, color: '#065f46', fontWeight: 800 }}>✓</div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{b}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#7f1d1d', marginBottom: 14 }}>Risks (uncommon)</div>
              {[
                { risk: 'Bleeding', detail: 'Occurs in fewer than 1 in 100 patients, more commonly after polypectomy. Usually self-limiting.' },
                { risk: 'Perforation', detail: 'A tear in the bowel wall — rare (around 1 in 1,000). May require surgical repair.' },
                { risk: 'Sedation reactions', detail: 'Mild reactions to sedation (nausea, dizziness) are uncommon. Serious reactions are very rare.' },
                { risk: 'Missed lesion', detail: 'No test is 100% accurate. Small flat polyps can be missed. High-quality bowel prep reduces this risk.' },
                { risk: 'Aspiration', detail: 'Rare risk during upper GI endoscopy if stomach contents enter the airways.' },
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

      {/* FAQs */}
      <section style={{ padding: '64px 40px', background: '#fff' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <SectionHeading sub="Common questions from our patients.">Frequently Asked Questions</SectionHeading>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { q: 'Will I be awake during the procedure?', a: 'You will receive conscious sedation, which means you are relaxed and drowsy but can still respond. Most patients have little or no memory of the procedure. You will not feel pain, though you may notice some mild pressure or bloating.' },
              { q: 'How long will I be at the hospital?', a: 'Plan for 2–3 hours in total, including preparation, the procedure itself (15–30 minutes), and recovery in the unit. You will be discharged once your nurse is satisfied your observations are stable.' },
              { q: 'Can I eat after the procedure?', a: 'After gastroscopy you may eat and drink once your throat is no longer numb (usually 30–60 minutes). After colonoscopy you may eat normally once you feel ready, usually a light meal first.' },
              { q: 'When will I know if I have polyps?', a: 'Dr Kabiye will tell you immediately after the procedure whether any polyps were found and removed. Biopsy results for tissue sent to pathology take 5–10 working days.' },
              { q: 'Do I need a referral?', a: 'A referral from your GP or specialist is recommended for most endoscopy procedures and may be required by your insurer. You can also self-refer — contact us and we will advise on next steps.' },
              { q: 'Is the procedure covered by insurance?', a: 'Most health insurance plans in Saint Lucia and the Eastern Caribbean cover diagnostic endoscopy. Please check with your insurer before attending. We can provide a pre-authorization letter on request.' },
              { q: 'What if something is found during the procedure?', a: 'In many cases, treatment (such as polyp removal or biopsy) is performed immediately during the same procedure. If something more complex is found, Dr Kabiye will discuss the findings and next steps with you before you leave.' },
            ].map(({ q, a }) => (
              <details key={q} style={{ background: '#f8fafc', border: '1px solid #e2eeed', borderRadius: 10, padding: '16px 20px' }}>
                <summary style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', cursor: 'pointer', listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {q}
                  <span style={{ fontSize: 18, color: '#0d9488', flexShrink: 0, marginLeft: 12 }}>+</span>
                </summary>
                <p style={{ margin: '12px 0 0', fontSize: 13, color: '#475569', lineHeight: 1.8 }}>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section style={{ padding: '56px 40px', background: '#0d9488', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: '#fff' }}>Ready to book your endoscopy?</h2>
          <p style={{ margin: '0 0 28px', fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
            Book online, WhatsApp us, or ask your GP to send a referral. Our team will confirm your appointment within one business day.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/book" style={{ padding: '13px 30px', background: '#fff', color: '#0d9488', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>
              Book Online →
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
