import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for Amise Medical Services — how we collect, use, and protect your information.',
};

export default function PrivacyPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px', fontFamily: 'system-ui, sans-serif', color: '#1c1917', lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>Privacy Policy</h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 40 }}>Amise Medical Services · Last updated: 18 July 2026</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: '#0f172a' }}>1. Who we are</h2>
        <p>Amise Medical Services is a specialist general and endoscopic surgery practice based in Saint Lucia, West Indies, led by Dr Dawit Daniel Kabiye, MD, DM. We operate outpatient clinics at Tapion Hospital and Rodney Bay.</p>
        <p style={{ marginTop: 8 }}>Contact: <a href="mailto:amisesuite@gmail.com" style={{ color: '#0d9488' }}>amisesuite@gmail.com</a> · <a href="tel:+17582840557" style={{ color: '#0d9488' }}>+1 758 284-0557</a></p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: '#0f172a' }}>2. Information we collect</h2>
        <p>When you use our online booking and intake services we may collect:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>Name, date of birth, and contact details (phone, email, WhatsApp)</li>
          <li>Symptom and health questionnaire responses submitted through our intake form</li>
          <li>Appointment requests and scheduling preferences</li>
          <li>Messages and voicemails you send to us by phone, SMS, or WhatsApp</li>
        </ul>
        <p style={{ marginTop: 8 }}>We do not collect payment card details through this website.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: '#0f172a' }}>3. How we use your information</h2>
        <p>We use the information you provide to:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>Schedule and manage your appointments</li>
          <li>Communicate with you about your appointment (confirmation, reminders, cancellations)</li>
          <li>Triage your inquiry and ensure you are seen with appropriate urgency</li>
          <li>Maintain administrative records required for the operation of the practice</li>
        </ul>
        <p style={{ marginTop: 8 }}>We do not use your information for advertising or sell it to third parties.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: '#0f172a' }}>4. Disclosure of information</h2>
        <p>Your information is accessible only to authorised staff of Amise Medical Services. We may share information with:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>Dr Kabiye and clinical staff directly involved in your care</li>
          <li>Third-party service providers who process data on our behalf (cloud storage, SMS, calendar) under strict confidentiality obligations</li>
          <li>Regulatory or legal authorities if required by law</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: '#0f172a' }}>5. Data retention</h2>
        <p>We retain appointment and contact records for a minimum of 7 years in accordance with medical record-keeping standards in Saint Lucia, unless you request earlier deletion and no legal obligation requires us to retain them.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: '#0f172a' }}>6. Your rights</h2>
        <p>You have the right to:</p>
        <ul style={{ paddingLeft: 20, marginTop: 8 }}>
          <li>Access the personal information we hold about you</li>
          <li>Request correction of inaccurate information</li>
          <li>Request deletion of your information where no legal obligation requires retention</li>
          <li>Withdraw consent to communications at any time</li>
        </ul>
        <p style={{ marginTop: 8 }}>To exercise any of these rights, contact us at <a href="mailto:amisesuite@gmail.com" style={{ color: '#0d9488' }}>amisesuite@gmail.com</a>.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: '#0f172a' }}>7. Security</h2>
        <p>We use industry-standard security measures including encrypted data transmission (HTTPS), access controls, and secure cloud storage to protect your information.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: '#0f172a' }}>8. Third-party platforms</h2>
        <p>Our online booking form is powered by technology hosted on Vercel (USA). Appointment communications may be delivered via Twilio (SMS) and Google (calendar, email). Each provider maintains their own privacy and security standards.</p>
        <p style={{ marginTop: 8 }}>Our WhatsApp Business account is operated through the Meta (Facebook) Business platform. Messages sent to our WhatsApp number are subject to <a href="https://www.whatsapp.com/legal/privacy-policy" style={{ color: '#0d9488' }}>WhatsApp&apos;s Privacy Policy</a> in addition to this policy.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: '#0f172a' }}>9. Changes to this policy</h2>
        <p>We may update this policy from time to time. The date at the top of this page reflects the most recent revision. Continued use of our services after a change constitutes acceptance of the updated policy.</p>
      </section>

      <section>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: '#0f172a' }}>10. Contact</h2>
        <p>Questions about this policy should be directed to:</p>
        <address style={{ marginTop: 8, fontStyle: 'normal' }}>
          Amise Medical Services<br />
          Tapion Hospital, Tapion, Castries, Saint Lucia<br />
          <a href="mailto:amisesuite@gmail.com" style={{ color: '#0d9488' }}>amisesuite@gmail.com</a><br />
          <a href="tel:+17582840557" style={{ color: '#0d9488' }}>+1 758 284-0557</a>
        </address>
      </section>
    </main>
  );
}
