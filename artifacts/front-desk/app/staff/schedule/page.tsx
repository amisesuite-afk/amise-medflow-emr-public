'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';

const TEAL = '#0d9488';
const BORDER = '#334155';
const BG = '#0f172a';
const CARD = '#1e293b';
const MUTED = '#94a3b8';

// ── Types ─────────────────────────────────────────────────────────────────────

type Category = 'consult' | 'surgery' | 'anaesthesia' | 'lab';
type Priority = 'elective' | 'urgent' | 'emergency';
type ASAClass = 'I' | 'II' | 'III' | 'IV';

interface StaffBookingPayload {
  category: Category;
  patient_name: string;
  patient_dob: string;
  patient_phone: string;
  patient_email: string;
  // Consult
  consult_type?: string;
  consult_track?: string;
  consult_date?: string;
  consult_notes?: string;
  // Surgery
  surgery_procedure?: string;
  surgery_location?: string;
  surgery_priority?: Priority;
  surgery_duration_min?: number;
  surgery_anaesthetist?: string;
  surgery_date?: string;
  also_book_anaesthesia?: boolean;
  surgery_notes?: string;
  // Anaesthesia
  asa_class?: ASAClass;
  linked_procedure?: string;
  anaesthesia_date?: string;
  anaesthesia_notes?: string;
  // Lab
  lab_tests?: string[];
  lab_fasting?: boolean;
  lab_external?: string;
  lab_date?: string;
  result_alert_email?: string;
  lab_notes?: string;
}

interface BookingRecord {
  id: string;
  patient_name: string;
  appointment_type: string;
  location: string;
  preferred_slot: string | null;
  status: string;
  created_at: string;
  reason: string | null;
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const s = {
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    color: MUTED,
    marginBottom: 5,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '9px 11px',
    borderRadius: 7,
    border: `1px solid ${BORDER}`,
    background: BG,
    color: '#e2e8f0',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
  },
  select: {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '9px 11px',
    borderRadius: 7,
    border: `1px solid ${BORDER}`,
    background: BG,
    color: '#e2e8f0',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    cursor: 'pointer',
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '9px 11px',
    borderRadius: 7,
    border: `1px solid ${BORDER}`,
    background: BG,
    color: '#e2e8f0',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    resize: 'vertical' as const,
    minHeight: 72,
  },
  btn: {
    padding: '10px 22px',
    borderRadius: 7,
    background: TEAL,
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnSecondary: {
    padding: '10px 22px',
    borderRadius: 7,
    background: 'transparent',
    color: MUTED,
    fontWeight: 600,
    fontSize: 14,
    border: `1px solid ${BORDER}`,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  fieldRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14,
    marginBottom: 14,
  } as React.CSSProperties,
  field: {
    marginBottom: 14,
  },
  section: {
    borderTop: `1px solid ${BORDER}`,
    paddingTop: 16,
    marginTop: 4,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: TEAL,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: 12,
  },
  check: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    fontSize: 13,
    color: '#cbd5e1',
    marginBottom: 8,
  },
  badge: (status: string) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    background:
      status === 'staff_pending' ? '#1e3a5f' :
      status === 'confirmed'     ? '#134e3a' :
      status === 'waitlisted'    ? '#3d2a00' : '#1e293b',
    color:
      status === 'staff_pending' ? '#93c5fd' :
      status === 'confirmed'     ? '#6ee7b7' :
      status === 'waitlisted'    ? '#fbbf24' : MUTED,
  }),
};

// ── Consult type options ──────────────────────────────────────────────────────

const CONSULT_TYPES = [
  { key: 'new_consult',   label: 'New consultation with Dr Kabiye' },
  { key: 'follow_up',     label: 'Follow-up appointment' },
  { key: 'telephone',     label: 'Telephone review' },
  { key: 'pre_op',        label: 'Pre-operative assessment' },
  { key: 'post_op',       label: 'Post-operative review' },
  { key: 'breast',        label: 'Breast clinic' },
  { key: 'thyroid',       label: 'Thyroid clinic' },
  { key: 'diabetic_foot', label: 'Diabetic foot clinic' },
  { key: 'ogd',           label: 'Gastroscopy (OGD)' },
  { key: 'colonoscopy',   label: 'Colonoscopy' },
  { key: 'ercp_workup',   label: 'ERCP / Biliary investigation' },
  { key: 'flexi_sig',     label: 'Flexible sigmoidoscopy' },
];

const SURGERY_LOCATIONS = [
  { key: 'tapion',     label: 'Tapion Hospital, Castries' },
  { key: 'okeu',       label: 'OKEU Hospital, Castries' },
  { key: 'rodney_bay', label: 'Rodney Bay Medical Centre' },
];

const COMMON_LABS = [
  'FBC (Full Blood Count)',
  'U&E (Urea & Electrolytes)',
  'Creatinine / eGFR',
  'LFTs (Liver Function Tests)',
  'Lipid profile',
  'TFTs (Thyroid Function Tests)',
  'HbA1c',
  'Fasting glucose',
  'CRP / ESR',
  'Coagulation screen (INR/APTT)',
  'Blood culture × 2',
  'Group & Screen',
  'Urine M&S (midstream)',
  'Histology / biopsy',
  'Other (specify in notes)',
];

// ── Category tab ──────────────────────────────────────────────────────────────

function Tab({ active, onClick, children }: { active: boolean; onClick(): void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        borderRadius: 7,
        border: active ? `1px solid ${TEAL}` : `1px solid ${BORDER}`,
        background: active ? `${TEAL}22` : 'transparent',
        color: active ? TEAL : MUTED,
        fontWeight: active ? 700 : 500,
        fontSize: 13,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

// ── Patient section ───────────────────────────────────────────────────────────

interface PatientFields {
  name: string; dob: string; phone: string; email: string;
}
function PatientSection({ v, set }: { v: PatientFields; set(f: Partial<PatientFields>): void }) {
  return (
    <>
      <div style={s.fieldRow}>
        <div>
          <label style={s.label}>Full name *</label>
          <input style={s.input} value={v.name} onChange={e => set({ name: e.target.value })} required />
        </div>
        <div>
          <label style={s.label}>Date of birth</label>
          <input style={s.input} type="date" value={v.dob} onChange={e => set({ dob: e.target.value })} />
        </div>
      </div>
      <div style={s.fieldRow}>
        <div>
          <label style={s.label}>Phone</label>
          <input style={s.input} type="tel" value={v.phone} onChange={e => set({ phone: e.target.value })} />
        </div>
        <div>
          <label style={s.label}>Email</label>
          <input style={s.input} type="email" value={v.email} onChange={e => set({ email: e.target.value })} />
        </div>
      </div>
    </>
  );
}

// ── Category forms ────────────────────────────────────────────────────────────

function ConsultForm({ v, set }: { v: Partial<StaffBookingPayload>; set(p: Partial<StaffBookingPayload>): void }) {
  return (
    <div style={s.section}>
      <div style={s.sectionTitle}>Consultation details</div>
      <div style={s.fieldRow}>
        <div>
          <label style={s.label}>Appointment type *</label>
          <select style={s.select} value={v.consult_type ?? ''} onChange={e => set({ consult_type: e.target.value })}>
            <option value="">Select…</option>
            {CONSULT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={s.label}>Track</label>
          <select style={s.select} value={v.consult_track ?? 'routine'} onChange={e => set({ consult_track: e.target.value })}>
            <option value="routine">Routine</option>
            <option value="referral">GP / Specialist referral</option>
            <option value="urgent">Urgent — priority scheduling</option>
          </select>
        </div>
      </div>
      <div style={s.field}>
        <label style={s.label}>Preferred date</label>
        <input style={s.input} type="date" value={v.consult_date ?? ''} onChange={e => set({ consult_date: e.target.value })} />
      </div>
      <div style={s.field}>
        <label style={s.label}>Clinical summary / reason for referral</label>
        <textarea style={s.textarea} value={v.consult_notes ?? ''} onChange={e => set({ consult_notes: e.target.value })} rows={3} />
      </div>
    </div>
  );
}

function SurgeryForm({ v, set }: { v: Partial<StaffBookingPayload>; set(p: Partial<StaffBookingPayload>): void }) {
  return (
    <div style={s.section}>
      <div style={s.sectionTitle}>Surgery & Theatre</div>
      <div style={s.field}>
        <label style={s.label}>Procedure *</label>
        <input
          style={s.input}
          placeholder="e.g. Laparoscopic cholecystectomy"
          value={v.surgery_procedure ?? ''}
          onChange={e => set({ surgery_procedure: e.target.value })}
        />
      </div>
      <div style={s.fieldRow}>
        <div>
          <label style={s.label}>Hospital / Theatre</label>
          <select style={s.select} value={v.surgery_location ?? 'tapion'} onChange={e => set({ surgery_location: e.target.value })}>
            {SURGERY_LOCATIONS.map(l => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </div>
        <div>
          <label style={s.label}>Priority</label>
          <select style={s.select} value={v.surgery_priority ?? 'elective'} onChange={e => set({ surgery_priority: e.target.value as Priority })}>
            <option value="elective">Elective</option>
            <option value="urgent">Urgent (within 24–72 h)</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>
      </div>
      <div style={s.fieldRow}>
        <div>
          <label style={s.label}>Est. duration (min)</label>
          <select style={s.select} value={v.surgery_duration_min ?? 60} onChange={e => set({ surgery_duration_min: Number(e.target.value) })}>
            {[30, 45, 60, 90, 120, 150, 180, 240, 300].map(d => <option key={d} value={d}>{d} min</option>)}
          </select>
        </div>
        <div>
          <label style={s.label}>Preferred date</label>
          <input style={s.input} type="date" value={v.surgery_date ?? ''} onChange={e => set({ surgery_date: e.target.value })} />
        </div>
      </div>
      <div style={s.field}>
        <label style={s.label}>Anaesthetist</label>
        <input
          style={s.input}
          placeholder="Name (if pre-arranged)"
          value={v.surgery_anaesthetist ?? ''}
          onChange={e => set({ surgery_anaesthetist: e.target.value })}
        />
      </div>
      <label style={s.check}>
        <input
          type="checkbox"
          checked={v.also_book_anaesthesia ?? false}
          onChange={e => set({ also_book_anaesthesia: e.target.checked })}
          style={{ accentColor: TEAL }}
        />
        Also book anaesthesia pre-assessment appointment
      </label>
      <div style={s.field}>
        <label style={s.label}>Clinical notes</label>
        <textarea style={s.textarea} value={v.surgery_notes ?? ''} onChange={e => set({ surgery_notes: e.target.value })} rows={3} />
      </div>
    </div>
  );
}

function AnaesthesiaForm({ v, set }: { v: Partial<StaffBookingPayload>; set(p: Partial<StaffBookingPayload>): void }) {
  return (
    <div style={s.section}>
      <div style={s.sectionTitle}>Anaesthesia Pre-Assessment</div>
      <div style={s.fieldRow}>
        <div>
          <label style={s.label}>ASA physical status class</label>
          <select style={s.select} value={v.asa_class ?? ''} onChange={e => set({ asa_class: e.target.value as ASAClass })}>
            <option value="">Not yet assessed</option>
            <option value="I">ASA I — Normal healthy patient</option>
            <option value="II">ASA II — Mild systemic disease</option>
            <option value="III">ASA III — Severe systemic disease</option>
            <option value="IV">ASA IV — Life-threatening systemic disease</option>
          </select>
        </div>
        <div>
          <label style={s.label}>Preferred date</label>
          <input style={s.input} type="date" value={v.anaesthesia_date ?? ''} onChange={e => set({ anaesthesia_date: e.target.value })} />
        </div>
      </div>
      <div style={s.field}>
        <label style={s.label}>Planned / linked procedure</label>
        <input
          style={s.input}
          placeholder="e.g. Laparoscopic cholecystectomy"
          value={v.linked_procedure ?? ''}
          onChange={e => set({ linked_procedure: e.target.value })}
        />
      </div>
      <div style={s.field}>
        <label style={s.label}>Clinical notes for anaesthetist</label>
        <textarea style={s.textarea} value={v.anaesthesia_notes ?? ''} onChange={e => set({ anaesthesia_notes: e.target.value })} rows={3} />
      </div>
    </div>
  );
}

function LabForm({ v, set }: { v: Partial<StaffBookingPayload>; set(p: Partial<StaffBookingPayload>): void }) {
  const tests = v.lab_tests ?? [];
  function toggleTest(t: string) {
    set({ lab_tests: tests.includes(t) ? tests.filter(x => x !== t) : [...tests, t] });
  }
  return (
    <div style={s.section}>
      <div style={s.sectionTitle}>Laboratory collection</div>
      <div style={{ marginBottom: 14 }}>
        <label style={s.label}>Tests requested</label>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 4,
          background: BG,
          border: `1px solid ${BORDER}`,
          borderRadius: 7,
          padding: '10px 12px',
        }}>
          {COMMON_LABS.map(t => (
            <label key={t} style={s.check}>
              <input
                type="checkbox"
                checked={tests.includes(t)}
                onChange={() => toggleTest(t)}
                style={{ accentColor: TEAL }}
              />
              {t}
            </label>
          ))}
        </div>
      </div>
      <div style={s.fieldRow}>
        <div>
          <label style={s.label}>Fasting required?</label>
          <select style={s.select} value={v.lab_fasting ? 'yes' : 'no'} onChange={e => set({ lab_fasting: e.target.value === 'yes' })}>
            <option value="no">No — non-fasting</option>
            <option value="yes">Yes — minimum 8–10 h fast</option>
          </select>
        </div>
        <div>
          <label style={s.label}>Preferred date</label>
          <input style={s.input} type="date" value={v.lab_date ?? ''} onChange={e => set({ lab_date: e.target.value })} />
        </div>
      </div>
      <div style={s.field}>
        <label style={s.label}>External lab (if not in-house)</label>
        <input
          style={s.input}
          placeholder="e.g. SALCC Laboratory, Castries"
          value={v.lab_external ?? ''}
          onChange={e => set({ lab_external: e.target.value })}
        />
      </div>
      <div style={s.field}>
        <label style={s.label}>Result alert — email when results available</label>
        <input
          style={s.input}
          type="email"
          placeholder="staff@example.com or leave blank to suppress"
          value={v.result_alert_email ?? ''}
          onChange={e => set({ result_alert_email: e.target.value })}
        />
      </div>
      <div style={s.field}>
        <label style={s.label}>Additional instructions / notes</label>
        <textarea style={s.textarea} value={v.lab_notes ?? ''} onChange={e => set({ lab_notes: e.target.value })} rows={2} />
      </div>
    </div>
  );
}

// ── Recent bookings table ─────────────────────────────────────────────────────

function RecentBookingsTable({ rows, loading }: { rows: BookingRecord[]; loading: boolean }) {
  if (loading) return <div style={{ color: MUTED, fontSize: 13, padding: '12px 0' }}>Loading…</div>;
  if (!rows.length) return <div style={{ color: MUTED, fontSize: 13, padding: '12px 0' }}>No staff bookings in the last 7 days.</div>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
            {['Patient', 'Type', 'Location', 'Date', 'Status'].map(h => (
              <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: MUTED, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} style={{ borderBottom: `1px solid #1e293b` }}>
              <td style={{ padding: '8px 10px', color: '#e2e8f0', fontWeight: 500 }}>{r.patient_name}</td>
              <td style={{ padding: '8px 10px', color: '#cbd5e1' }}>{r.appointment_type.replace(/_/g, ' ')}</td>
              <td style={{ padding: '8px 10px', color: MUTED }}>{r.location}</td>
              <td style={{ padding: '8px 10px', color: MUTED }}>{r.preferred_slot ? new Date(r.preferred_slot).toLocaleDateString('en-LC') : '—'}</td>
              <td style={{ padding: '8px 10px' }}><span style={s.badge(r.status)}>{r.status.replace(/_/g, ' ')}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StaffSchedulePage() {
  const [category, setCategory] = useState<Category>('consult');
  const [patient, setPatient] = useState<PatientFields>({ name: '', dob: '', phone: '', email: '' });
  const [form, setForm] = useState<Partial<StaffBookingPayload>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [recentRows, setRecentRows] = useState<BookingRecord[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentLoaded, setRecentLoaded] = useState(false);

  function patchForm(p: Partial<StaffBookingPayload>) {
    setForm(prev => ({ ...prev, ...p }));
  }

  async function loadRecent() {
    if (recentLoading) return;
    setRecentLoading(true);
    try {
      const res = await fetch('/api/staff/bookings');
      if (res.ok) {
        const data = await res.json() as { bookings: BookingRecord[] };
        setRecentRows(data.bookings ?? []);
      }
    } finally {
      setRecentLoading(false);
      setRecentLoaded(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patient.name.trim()) { setResult({ ok: false, message: 'Patient name is required.' }); return; }
    setBusy(true);
    setResult(null);
    try {
      const payload: StaffBookingPayload = {
        ...form,
        category,
        patient_name:  patient.name,
        patient_dob:   patient.dob,
        patient_phone: patient.phone,
        patient_email: patient.email,
      };
      const res = await fetch('/api/staff/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { message?: string; error?: string };
      if (res.ok) {
        setResult({ ok: true, message: json.message ?? 'Booking created successfully.' });
        setPatient({ name: '', dob: '', phone: '', email: '' });
        setForm({});
        void loadRecent();
      } else {
        setResult({ ok: false, message: json.error ?? 'Booking failed — please try again.' });
      }
    } catch {
      setResult({ ok: false, message: 'Network error — please try again.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {/* Page title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0, marginBottom: 4 }}>
          Schedule appointment
        </h1>
        <p style={{ color: MUTED, fontSize: 13, margin: 0 }}>
          Create consultations, surgery listings, anaesthesia pre-assessments, and lab collections directly.
        </p>
      </div>

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        <Tab active={category === 'consult'}     onClick={() => setCategory('consult')}>Consultation</Tab>
        <Tab active={category === 'surgery'}     onClick={() => setCategory('surgery')}>Surgery & Theatre</Tab>
        <Tab active={category === 'anaesthesia'} onClick={() => setCategory('anaesthesia')}>Anaesthesia Pre-Assessment</Tab>
        <Tab active={category === 'lab'}         onClick={() => setCategory('lab')}>Lab Collection</Tab>
      </div>

      {/* Form card */}
      <div style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '24px 22px',
        marginBottom: 28,
      }}>
        <form onSubmit={e => { void handleSubmit(e); }}>
          {/* Patient section */}
          <div style={{ marginBottom: 4 }}>
            <div style={{ ...s.sectionTitle, marginBottom: 12 }}>Patient details</div>
            <PatientSection v={patient} set={patch => setPatient(prev => ({ ...prev, ...patch }))} />
          </div>

          {/* Category-specific form */}
          {category === 'consult'     && <ConsultForm     v={form} set={patchForm} />}
          {category === 'surgery'     && <SurgeryForm     v={form} set={patchForm} />}
          {category === 'anaesthesia' && <AnaesthesiaForm v={form} set={patchForm} />}
          {category === 'lab'         && <LabForm         v={form} set={patchForm} />}

          {/* Feedback */}
          {result && (
            <div style={{
              marginTop: 16,
              padding: '10px 14px',
              borderRadius: 7,
              background: result.ok ? '#134e3a22' : '#7f1d1d22',
              border: `1px solid ${result.ok ? '#065f46' : '#7f1d1d'}`,
              color: result.ok ? '#6ee7b7' : '#fca5a5',
              fontSize: 13,
            }}>
              {result.message}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
            <button
              type="button"
              style={s.btnSecondary}
              onClick={() => { setForm({}); setPatient({ name: '', dob: '', phone: '', email: '' }); setResult(null); }}
            >
              Clear
            </button>
            <button type="submit" style={{ ...s.btn, opacity: busy ? 0.7 : 1 }} disabled={busy}>
              {busy ? 'Saving…' : 'Create booking'}
            </button>
          </div>
        </form>
      </div>

      {/* Recent bookings */}
      <div style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '20px 22px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>Recent staff bookings</div>
          <button
            style={{ ...s.btnSecondary, padding: '6px 14px', fontSize: 12 }}
            onClick={() => { void loadRecent(); }}
          >
            {recentLoaded ? 'Refresh' : 'Load'}
          </button>
        </div>
        {recentLoaded && <RecentBookingsTable rows={recentRows} loading={recentLoading} />}
        {!recentLoaded && (
          <div style={{ color: MUTED, fontSize: 13 }}>Click Load to view recent staff-created bookings.</div>
        )}
      </div>
    </div>
  );
}
