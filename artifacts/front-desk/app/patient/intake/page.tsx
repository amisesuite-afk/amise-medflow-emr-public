'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getPatientClient } from '@/lib/patient-supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

const TEAL = '#0d9488';

const COMMON_SYMPTOMS = [
  'Abdominal pain', 'Bloating', 'Nausea', 'Vomiting', 'Heartburn',
  'Difficulty swallowing', 'Change in bowel habits', 'Rectal bleeding',
  'Blood in stool', 'Unexplained weight loss', 'Loss of appetite',
  'Jaundice', 'Fatigue', 'Fever', 'Other',
];

const DURATION_OPTIONS = [
  { value: '1',   label: 'Less than 1 week' },
  { value: '7',   label: '1 – 2 weeks' },
  { value: '14',  label: '2 – 4 weeks' },
  { value: '30',  label: '1 – 3 months' },
  { value: '90',  label: '3 – 6 months' },
  { value: '180', label: 'More than 6 months' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function QuestionBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      padding: '20px 24px',
      marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

function SeverityRow({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
        const active = value === n;
        const color = n <= 3 ? '#065f46' : n <= 6 ? '#92400e' : '#991b1b';
        const bg    = n <= 3 ? '#d1fae5' : n <= 6 ? '#fef3c7' : '#fee2e2';
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              border: active ? `2px solid ${color}` : '1px solid #e2e8f0',
              background: active ? bg : '#f8fafc',
              color: active ? color : '#64748b',
              fontSize: 14,
              fontWeight: active ? 800 : 400,
              cursor: 'pointer',
            }}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function YesNoToggle({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {[{ label: 'Yes', val: true }, { label: 'No', val: false }].map(({ label, val }) => {
        const active = value === val;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(val)}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: active ? `2px solid ${TEAL}` : '1px solid #e2e8f0',
              background: active ? `${TEAL}18` : '#fff',
              color: active ? TEAL : '#64748b',
              fontSize: 14,
              fontWeight: active ? 700 : 400,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

interface IntakeRow {
  id: string;
  submitted_at: string;
  chief_complaint: string | null;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-LC', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function IntakePage() {
  const router = useRouter();
  const sb = getPatientClient();

  const [patientId, setPatientId] = useState<string | null>(null);
  const [priorIntakes, setPriorIntakes] = useState<IntakeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [duration, setDuration] = useState('');
  const [severity, setSeverity] = useState<number | null>(null);
  const [priorTreatment, setPriorTreatment] = useState('');
  const [currentMeds, setCurrentMeds] = useState('');
  const [allergiesNote, setAllergiesNote] = useState('');
  const [isReferral, setIsReferral] = useState<boolean | null>(null);
  const [referralDoc, setReferralDoc] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const toggleSymptom = useCallback((s: string) => {
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }, []);

  useEffect(() => {
    void (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/patient/login'); return; }

      const { data: patientData } = await sb.from('patients').select('id').single();
      if (!patientData) { setLoading(false); return; }

      setPatientId(patientData.id);

      const { data: intakes } = await sb
        .from('patient_intake')
        .select('id, submitted_at, chief_complaint')
        .eq('patient_id', patientData.id)
        .order('submitted_at', { ascending: false })
        .limit(5);

      setPriorIntakes(intakes ?? []);
      setLoading(false);
    })();
  }, [router, sb]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId || submitting) return;
    if (!chiefComplaint.trim()) { setError('Please describe your main concern.'); return; }

    setSubmitting(true);
    setError(null);

    const referralReason = isReferral
      ? (referralDoc.trim() ? `Referred by: ${referralDoc.trim()}` : 'Yes (referring doctor not specified)')
      : isReferral === false ? 'Self-referred' : null;

    const { error: insertErr } = await sb.from('patient_intake').insert({
      patient_id:      patientId,
      chief_complaint: chiefComplaint.trim() || null,
      symptoms:        symptoms.length > 0 ? symptoms : null,
      duration_days:   duration ? parseInt(duration) : null,
      severity:        severity,
      prior_treatment: priorTreatment.trim() || null,
      current_meds:    currentMeds.trim() || null,
      allergies_note:  allergiesNote.trim() || null,
      referral_reason: referralReason,
      additional_notes: additionalNotes.trim() || null,
    });

    setSubmitting(false);

    if (insertErr) {
      setError('Your form could not be submitted. Please check your connection and try again.');
      return;
    }

    setSubmitted(true);

    // Refresh prior submissions
    const { data: fresh } = await sb
      .from('patient_intake')
      .select('id, submitted_at, chief_complaint')
      .eq('patient_id', patientId)
      .order('submitted_at', { ascending: false })
      .limit(5);
    setPriorIntakes(fresh ?? []);
  }

  if (loading) {
    return <div style={{ textAlign: 'center', paddingTop: 64, color: '#94a3b8', fontSize: 14 }}>Loading…</div>;
  }

  if (submitted) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <button type="button" onClick={() => router.push('/patient')} style={{ background: 'none', border: 'none', color: TEAL, fontSize: 20, cursor: 'pointer', padding: 0 }} aria-label="Back">←</button>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#1e293b' }}>Pre-Visit Questionnaire</h1>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '40px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800, color: '#1e293b' }}>Thank you!</h2>
          <p style={{ margin: '0 0 28px', fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>
            Your questionnaire has been submitted. Our team will review it before your consultation.
          </p>
          <button
            type="button"
            onClick={() => router.push('/patient')}
            style={{ padding: '13px 28px', background: TEAL, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
          >
            Back to portal
          </button>
        </div>
      </div>
    );
  }

  const qlabel: React.CSSProperties = { display: 'block', fontSize: 15, fontWeight: 700, color: '#1e293b', marginBottom: 6 };
  const hint: React.CSSProperties = { display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 10 };
  const textarea: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, color: '#1e293b', background: '#fff', boxSizing: 'border-box', resize: 'vertical', outline: 'none', minHeight: 72, fontFamily: 'inherit' };
  const input: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, color: '#1e293b', background: '#fff', boxSizing: 'border-box', outline: 'none' };
  const sel: React.CSSProperties = { width: '100%', padding: '12px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, color: '#1e293b', background: '#fff', boxSizing: 'border-box', outline: 'none', cursor: 'pointer' };

  return (
    <div>
      <style>{`@keyframes amise-spin { to { transform: rotate(360deg); } } .amise-input:focus { border-color: ${TEAL} !important; box-shadow: 0 0 0 3px rgba(13,148,136,0.12); }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <button type="button" onClick={() => router.push('/patient')} style={{ background: 'none', border: 'none', color: TEAL, fontSize: 20, cursor: 'pointer', padding: 0 }} aria-label="Back">←</button>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#1e293b' }}>Pre-Visit Questionnaire</h1>
      </div>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 28, marginTop: 4 }}>
        Help us prepare for your visit by completing this short form. Your answers are shared only with your care team.
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} noValidate>

        {/* Q1 */}
        <QuestionBlock>
          <label style={qlabel} htmlFor="chief-complaint">1. What is your main concern today?</label>
          <span style={hint}>Describe your primary symptom or reason for visiting.</span>
          <textarea id="chief-complaint" className="amise-input" rows={3} style={textarea} value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} placeholder="e.g. I have been experiencing persistent abdominal pain for the past two weeks…" />
        </QuestionBlock>

        {/* Q2 */}
        <QuestionBlock>
          <span style={qlabel}>2. Which symptoms are you experiencing?</span>
          <span style={hint}>Select all that apply.</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {COMMON_SYMPTOMS.map(symptom => {
              const active = symptoms.includes(symptom);
              return (
                <button
                  key={symptom}
                  type="button"
                  onClick={() => toggleSymptom(symptom)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 20,
                    border: active ? `2px solid ${TEAL}` : '1px solid #e2e8f0',
                    background: active ? `${TEAL}15` : '#fff',
                    color: active ? TEAL : '#475569',
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {symptom}
                </button>
              );
            })}
          </div>
        </QuestionBlock>

        {/* Q3 */}
        <QuestionBlock>
          <label style={qlabel} htmlFor="duration">3. How long have you had these symptoms?</label>
          <select id="duration" className="amise-input" style={sel} value={duration} onChange={e => setDuration(e.target.value)}>
            <option value="">Select…</option>
            {DURATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </QuestionBlock>

        {/* Q4 */}
        <QuestionBlock>
          <span style={qlabel}>4. How would you rate your discomfort?</span>
          <span style={hint}>1 = very mild · 10 = severe</span>
          <SeverityRow value={severity} onChange={setSeverity} />
        </QuestionBlock>

        {/* Q5 */}
        <QuestionBlock>
          <label style={qlabel} htmlFor="prior-treatment">5. What have you already tried?</label>
          <textarea id="prior-treatment" className="amise-input" rows={2} style={textarea} value={priorTreatment} onChange={e => setPriorTreatment(e.target.value)} placeholder="e.g. antacids, dietary changes, previous medications…" />
        </QuestionBlock>

        {/* Q6 */}
        <QuestionBlock>
          <label style={qlabel} htmlFor="current-meds">6. Current medications</label>
          <textarea id="current-meds" className="amise-input" rows={2} style={textarea} value={currentMeds} onChange={e => setCurrentMeds(e.target.value)} placeholder="List any medications you are currently taking…" />
        </QuestionBlock>

        {/* Q7 */}
        <QuestionBlock>
          <label style={qlabel} htmlFor="allergies-note">7. Known allergies</label>
          <input id="allergies-note" className="amise-input" type="text" style={input} value={allergiesNote} onChange={e => setAllergiesNote(e.target.value)} placeholder="e.g. penicillin, ibuprofen, latex…" />
        </QuestionBlock>

        {/* Q8 */}
        <QuestionBlock>
          <span style={{ ...qlabel, display: 'block', marginBottom: 12 }}>8. Were you referred by another doctor?</span>
          <YesNoToggle value={isReferral} onChange={setIsReferral} />
          {isReferral === true && (
            <div style={{ marginTop: 14 }}>
              <label style={{ ...qlabel, fontSize: 13 }} htmlFor="referral-doc">Referring doctor / facility name</label>
              <input id="referral-doc" className="amise-input" type="text" style={input} value={referralDoc} onChange={e => setReferralDoc(e.target.value)} placeholder="e.g. Dr. Pierre, Victoria Hospital" />
            </div>
          )}
        </QuestionBlock>

        {/* Q9 */}
        <QuestionBlock>
          <label style={qlabel} htmlFor="additional-notes">9. Anything else you would like our team to know?</label>
          <textarea id="additional-notes" className="amise-input" rows={2} style={textarea} value={additionalNotes} onChange={e => setAdditionalNotes(e.target.value)} placeholder="Any additional information that may help us prepare for your visit…" />
        </QuestionBlock>

        {error && (
          <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b', fontSize: 14, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{ width: '100%', padding: '15px', background: submitting ? '#99f6e4' : TEAL, color: submitting ? '#0f766e' : '#fff', border: 'none', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: submitting ? 'default' : 'pointer', transition: 'background 0.2s' }}
        >
          {submitting ? 'Submitting…' : 'Submit Questionnaire'}
        </button>
      </form>

      {priorIntakes.length > 0 && (
        <div style={{ marginTop: 48 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
            Previous Submissions
          </p>
          {priorIntakes.map(intake => (
            <div key={intake.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Submitted {formatDateTime(intake.submitted_at)}</div>
              <div style={{ fontSize: 14, color: '#1e293b', lineHeight: 1.5 }}>
                {intake.chief_complaint ?? <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No main concern recorded</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
