import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { SLOT_RULES, AppointmentType } from '@/lib/rules';

const BASE = import.meta.env.BASE_URL ?? '/';
function apiUrl(path: string) {
  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  return `${base}${path}`;
}

const APPT_LABELS: Record<string, string> = {
  new_consult:   'New Consultation',
  follow_up:     'Follow-up',
  post_op:       'Post-op Review',
  ercp_workup:   'ERCP Work-up',
  ercp:          'ERCP Procedure',
  breast:        'Breast Clinic',
  telephone:     'Telephone',
  diabetic_foot: 'Diabetic Foot',
};

interface SlotDisplay { day: string; date: string; time: string; location: string }

interface SlotResult {
  start: string;
  end: string;
  location: string;
  appointmentType: AppointmentType;
  display: SlotDisplay;
}

export default function SchedulingTab() {
  const ctx = useAppContext();
  const [apptType, setApptType] = useState<AppointmentType>(ctx.triageResult.appointmentType);
  const [slots, setSlots] = useState<SlotResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [booked, setBooked] = useState<SlotResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const rule = SLOT_RULES[apptType];

  async function fetchSlots() {
    setError('');
    setSlots([]);
    setBooked(null);
    setConfirmed(false);
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/scheduling/slots?type=${apptType}&max=6`));
      const data = await res.json() as { slots?: SlotResult[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSlots(data.slots ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-GB', {
      timeZone: 'America/St_Lucia', hour: '2-digit', minute: '2-digit',
    });
  }

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const staticDays = rule.days.map(d => DAY_NAMES[d]).join(', ') || 'By arrangement';

  return (
    <div className="gap-y" style={{ maxWidth: 720 }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="fld" style={{ minWidth: 200, marginBottom: 0 }}>
          <label>Appointment type</label>
          <select
            value={apptType}
            onChange={e => { setApptType(e.target.value as AppointmentType); setSlots([]); setBooked(null); setConfirmed(false); }}
          >
            {(Object.keys(SLOT_RULES) as AppointmentType[]).map(t => (
              <option key={t} value={t}>{APPT_LABELS[t] ?? t}</option>
            ))}
          </select>
        </div>
        <button
          className="summary-btn summary-btn--primary"
          onClick={() => void fetchSlots()}
          disabled={loading}
          style={{ height: 36, marginBottom: 0 }}
        >
          {loading ? 'Searching…' : '🗓 Find available slots'}
        </button>
      </div>

      {/* Slot rule summary */}
      <div style={{
        background: '#f0faf8', border: '1px solid #b2dfdb', borderRadius: 8,
        padding: '10px 14px', fontSize: 12, color: '#374151',
        display: 'flex', flexWrap: 'wrap', gap: '6px 20px',
      }}>
        <span><strong>Location:</strong> {rule.location.replace(/_/g, ' ')}</span>
        <span><strong>Days:</strong> {staticDays}</span>
        <span><strong>Duration:</strong> {rule.durationMin} min</span>
        <span><strong>Window:</strong> {rule.windowStart}–{rule.windowEnd}</span>
        <span><strong>Max/session:</strong> {rule.maxPerSession}</span>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
          <strong>⚠ {error}</strong>
          <div style={{ marginTop: 6, color: '#6b7280' }}>
            Calendar service unavailable — slots shown below are based on schedule rules.
            Ask admin to configure Google Calendar credentials to enable live slot checking.
          </div>
          <div style={{ marginTop: 10, fontWeight: 600 }}>Schedule preview ({APPT_LABELS[apptType]}):</div>
          <div style={{ marginTop: 4 }}>Days: {staticDays} · {rule.windowStart}–{rule.windowEnd} · {rule.durationMin} min · {rule.location.replace(/_/g, ' ')}</div>
        </div>
      )}

      {/* Booking confirmation */}
      {booked && !confirmed && (
        <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Confirm booking</div>
          <div style={{ fontSize: 12, marginBottom: 4 }}><strong>Patient:</strong> {ctx.patientName || '(no patient loaded)'}</div>
          <div style={{ fontSize: 12, marginBottom: 4 }}><strong>Type:</strong> {APPT_LABELS[booked.appointmentType]}</div>
          <div style={{ fontSize: 12, marginBottom: 4 }}><strong>Date:</strong> {booked.display.day} {booked.display.date}</div>
          <div style={{ fontSize: 12, marginBottom: 4 }}><strong>Time:</strong> {formatTime(booked.start)}</div>
          <div style={{ fontSize: 12, marginBottom: 12 }}><strong>Location:</strong> {booked.display.location}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="summary-btn summary-btn--primary"
              onClick={() => setConfirmed(true)}
              style={{ height: 34 }}
            >
              ✓ Confirm (dry run)
            </button>
            <button
              className="summary-btn summary-btn--ghost"
              onClick={() => setBooked(null)}
              style={{ height: 34 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {confirmed && booked && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '14px 18px', fontSize: 12 }}>
          <div style={{ fontWeight: 700, color: '#16a34a', marginBottom: 6 }}>✓ Booking prepared (dry run mode)</div>
          <div>This would create a calendar event for <strong>{ctx.patientName || 'the patient'}</strong> on <strong>{booked.display.day} {booked.display.date}</strong> at <strong>{formatTime(booked.start)}</strong>.</div>
          <div style={{ marginTop: 6, color: '#6b7280' }}>Set <code>MODE=supervised</code> or <code>MODE=auto</code> in environment to send live calendar invitations.</div>
          <button className="summary-btn summary-btn--ghost" style={{ marginTop: 10, height: 32 }} onClick={() => { setBooked(null); setConfirmed(false); }}>Done</button>
        </div>
      )}

      {/* Slot grid */}
      {slots.length > 0 && !confirmed && (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Available slots</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {slots.map(s => (
              <div key={s.start} style={{
                border: booked?.start === s.start ? '2px solid var(--accent)' : '1px solid #e5e7eb',
                borderRadius: 10, padding: '12px 14px', background: '#fff', cursor: 'pointer',
              }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{s.display.day}</div>
                <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>{s.display.date}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent2)', marginBottom: 4 }}>{formatTime(s.start)}</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 10 }}>{s.display.location} · {rule.durationMin} min</div>
                <button
                  className="summary-btn summary-btn--primary"
                  style={{ width: '100%', height: 30, fontSize: 12 }}
                  onClick={() => setBooked(s)}
                >
                  Select
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && slots.length === 0 && !error && (
        <div style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', paddingTop: 20 }}>
          Select an appointment type and click <strong>Find available slots</strong>.
        </div>
      )}
    </div>
  );
}
