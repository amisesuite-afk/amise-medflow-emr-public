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
          <SectionHeading>Colonoscopy Preparation — Step by Step</SectionHeading>
          <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.8, marginTop: 0, marginBottom: 32 }}>
            Your bowel must be completely clean for Dr Kabiye to see the lining clearly. An incompletely prepared colon increases the risk of missing abnormalities. Please read all instructions as soon as you receive them and call us if you have any questions.
          </p>

          {/* Timeline cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>

            {/* 5 days before */}
            <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 12, padding: '22px 24px' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>5 Days Before</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Stop blood-thinning medicines</div>
              <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.8 }}>
                Stop iron tablets, Aspirin, Plavix, Warfarin, Xarelto, and any other anticoagulants.
                Also stop turmeric, ginger, and cinnamon supplements. <strong>Do not stop any medication without first speaking to your doctor.</strong> If you are diabetic or have other medical conditions, please inform us.
              </p>
            </div>

            {/* 3 days before */}
            <div style={{ background: '#f0fdf9', border: '1px solid #a7f3d0', borderRadius: 12, padding: '22px 24px' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>3 Days Before</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Low residue diet</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 6 }}>You may eat:</div>
                  <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 13, color: '#374151', lineHeight: 1.9 }}>
                    <li>White flour, white rice, pasta, macaroni</li>
                    <li>Cheese, eggs, meat, fish</li>
                    <li>Soup, noodle soup, chicken</li>
                    <li>Refined cereals: corn meal, cream of wheat</li>
                  </ul>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Avoid completely:</div>
                  <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 13, color: '#374151', lineHeight: 1.9 }}>
                    <li>Dasheen, yam, and high-fibre vegetables</li>
                    <li>Mangoes and fruits with seeds (e.g. guavas)</li>
                    <li>Beans, lentils, corn, nuts</li>
                    <li>Brown bread, dried fruit, dried coconut</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* 1 day before */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '22px 24px' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>The Day Before — Liquids Only</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Clear fluid diet all day, then first bowel prep dose at 6 pm</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>Allowed fluids:</div>
                  <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 13, color: '#374151', lineHeight: 1.9 }}>
                    <li>Water, coconut water</li>
                    <li>Tea or coffee (no milk)</li>
                    <li>Clear juices: orange juice, apple juice</li>
                    <li>Malta, strained clear soup (no noodles)</li>
                  </ul>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>Avoid:</div>
                  <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 13, color: '#374151', lineHeight: 1.9 }}>
                    <li>All solid food</li>
                    <li>Drinks or jellies with red dye</li>
                    <li>Milk or dairy-based drinks</li>
                  </ul>
                </div>
              </div>
              <div style={{ background: '#fff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#1e40af', fontWeight: 600 }}>
                🕕 At 6:00 pm — Drink your first bottle of magnesium citrate, followed immediately by at least 4–5 large glasses of coconut water.
              </div>
            </div>

            {/* Examination day */}
            <div style={{ background: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: 12, padding: '22px 24px' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#5b21b6', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Examination Day</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Second prep dose at 5 am — nothing to eat or drink after 6 am</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#fff', border: '1px solid #c4b5fd', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#5b21b6', width: 52, flexShrink: 0 }}>5:00 am</div>
                  <div style={{ fontSize: 13, color: '#374151' }}>Drink your second bottle of magnesium citrate, followed by at least 4–5 large glasses of coconut water.</div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#fff', border: '1px solid #c4b5fd', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#5b21b6', width: 52, flexShrink: 0 }}>6:00 am</div>
                  <div style={{ fontSize: 13, color: '#374151' }}>Take your regular medications with a small sip of water. <strong>Blood pressure medication MUST be taken.</strong> Diabetic medication should <strong>NOT</strong> be taken on the day of the procedure unless your doctor has specifically instructed otherwise.</div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#dc2626', width: 52, flexShrink: 0 }}>After 6 am</div>
                  <div style={{ fontSize: 13, color: '#7f1d1d', fontWeight: 600 }}>Nothing to eat or drink — no water, no medication.</div>
                </div>
              </div>
            </div>

            {/* After the procedure */}
            <div style={{ background: '#f0fdf9', border: '1px solid #a7f3d0', borderRadius: 12, padding: '22px 24px' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>After Your Procedure</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>You will recover in the unit for 30–60 minutes</div>
              <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 13, color: '#374151', lineHeight: 1.9 }}>
                <li><strong>You must be accompanied</strong> by a family member or responsible adult — you cannot go home alone after sedation</li>
                <li>Do not drive, operate machinery, or sign legal documents for 24 hours</li>
                <li>You may eat normally as soon as you feel ready after the procedure</li>
                <li>Some bloating and gas are normal — this settles quickly</li>
                <li>Ask your doctor when it is safe to restart blood-thinning medications</li>
                <li>If biopsies were taken, results may take up to 6 weeks — we will contact you</li>
              </ul>
              <div style={{ marginTop: 14, padding: '12px 16px', background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, fontSize: 13, color: '#7f1d1d' }}>
                <strong>Call us immediately</strong> if after your procedure you develop severe abdominal pain, a firm or bloated abdomen, vomiting, fever, or rectal bleeding greater than a couple of tablespoons.
              </div>
            </div>
          </div>

          {/* Gastroscopy reminder */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2eeed', borderRadius: 12, padding: '22px 24px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Gastroscopy (Upper GI) Preparation</div>
            <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 13, color: '#374151', lineHeight: 1.9 }}>
              <li>Fast from midnight — no food or drink, including water</li>
              <li>Take your regular morning medications with a small sip of water unless told otherwise</li>
              <li>Stop iron tablets 5 days before</li>
              <li>Inform us of blood-thinning medications (warfarin, aspirin, clopidogrel, Xarelto)</li>
              <li>Arrange a responsible adult to drive you home — no driving for 24 hours after sedation</li>
            </ul>
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
              { q: 'When will I know if I have polyps?', a: 'Dr Kabiye will tell you immediately after the procedure whether any polyps were found and removed. Biopsy results for tissue sent to pathology may take up to 6 weeks — we will contact you. If you have not heard within that timeframe, please call us.' },
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
