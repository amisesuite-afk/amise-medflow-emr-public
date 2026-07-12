import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { getApiOrigin } from '@/lib/api-origin';
import { SLOT_RULES, AppointmentType } from '@workspace/triage-engine';
import TheatreBookingCard from '@/components/TheatreBookingCard';
import TheatreListBuilderCard from '@/components/TheatreListBuilderCard';
import PreopDayChecklist from '@/components/PreopDayChecklist';
import PostOpMilestonesCard from '@/components/PostOpMilestonesCard';
import { staffAuthHeaders } from '@/lib/staff-auth';

// Use VITE_API_URL when deployed (e.g. Render); fall back to same-origin proxy in dev
const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  return `${base}${path}`;
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function generateMockSlots(apptType: AppointmentType, max: number): SlotResult[] {
  const rule = SLOT_RULES[apptType];
  const results: SlotResult[] = [];
  const TZ = 'America/St_Lucia';

  // Start from tomorrow (ECT)
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  for (let d = 0; d < 60 && results.length < max; d++) {
    const candidate = new Date(tomorrow);
    candidate.setDate(tomorrow.getDate() + d);

    const dow = candidate.getDay();
    if (!rule.days.includes(dow)) continue;

    const [startH, startM] = rule.windowStart.split(':').map(Number);
    const slotStart = new Date(candidate);
    slotStart.setHours(startH, startM, 0, 0);

    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotEnd.getMinutes() + rule.durationMin);

    const dayAbbr = DAY_ABBR[dow];
    const dateStr = `${candidate.getDate()} ${MONTH_ABBR[candidate.getMonth()]} ${candidate.getFullYear()}`;
    const timeStr = rule.windowStart;

    results.push({
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
      location: rule.location,
      appointmentType: apptType,
      display: { day: dayAbbr, date: dateStr, time: timeStr, location: rule.location },
    });
  }

  return results;
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

interface SlotsResponse {
  slots?: SlotResult[];
  error?: string;
  mock?: boolean;
}

const ACUITY_BANNER_STYLES: Record<string, React.CSSProperties> = {
  urgent:   { background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b' },
  priority: { background: '#ffedd5', border: '1px solid #fdba74', color: '#9a3412' },
  review:   { background: '#fefce8', border: '1px solid #fde047', color: '#854d0e' },
  routine:  { background: '#dcfce7', border: '1px solid #86efac', color: '#166534' },
};

const ACUITY_PATHWAY_LABEL: Record<string, string> = {
  urgent:   'emergency pathway — book within same day',
  priority: 'priority pathway — book within 24–48 hours',
  review:   'review pathway — book within 1 week',
  routine:  'routine pathway',
};

interface PendingBooking {
  id: string;
  patient_name: string;
  appointment_type?: string;
  chief_complaint?: string;
  location?: string;
  preferred_site?: string;
  confirmed_slot?: string | null;
  preferred_slot?: string | null;
  preferred_date?: string | null;
  status: string;
  created_at: string;
  triage_acuity?: string | null;
  triage_level?: string | null;
}

function fmtBookingSlot(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-LC', {
    timeZone: 'America/St_Lucia',
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

const BOOKING_STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  pending:           { bg: '#fffbeb', color: '#b45309', label: 'Pending' },
  staff_confirmed:   { bg: '#eff6ff', color: '#1d4ed8', label: 'Awaiting Doctor' },
  patient_confirmed: { bg: '#f0fdf4', color: '#15803d', label: 'Patient OK' },
  waitlisted:        { bg: '#faf5ff', color: '#7c3aed', label: 'Waitlisted' },
};

export default function SchedulingTab() {
  const ctx = useAppContext();
  const [apptType, setApptType] = useState<AppointmentType>(ctx.triageResult.appointmentType);
  const [slots, setSlots] = useState<SlotResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [mock, setMock] = useState(false);
  const [booked, setBooked] = useState<SlotResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Pending bookings reminder panel
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [reminderCollapsed, setReminderCollapsed] = useState(false);

  const fetchPendingBookings = useCallback(async () => {
    try {
      const headers = await staffAuthHeaders();
      const r = await fetch(apiUrl('/api/booking/requests'), { headers });
      if (r.ok) {
        const d = await r.json() as { requests: PendingBooking[] };
        // Show pending and staff_confirmed bookings as reminders for doctor sign-off
        const reminders = (d.requests ?? []).filter(b =>
          b.status === 'pending' || b.status === 'staff_confirmed' || b.status === 'waitlisted'
        );
        setPendingBookings(reminders);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void fetchPendingBookings();
    const t = setInterval(() => void fetchPendingBookings(), 60_000);
    return () => clearInterval(t);
  }, [fetchPendingBookings]);

  // Sync appointment type when triage result changes (e.g. navigating from TriageTab)
  useEffect(() => {
    setApptType(ctx.triageResult.appointmentType);
  }, [ctx.triageResult.appointmentType]);

  const rule = SLOT_RULES[apptType];
  const acuity = ctx.triageResult.acuity;
  const score = ctx.triageResult.score;

  async function fetchSlots() {
    setSlots([]);
    setMock(false);
    setBooked(null);
    setConfirmed(false);
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/scheduling/slots?type=${apptType}&max=6`));
      let data: SlotsResponse;
      try {
        data = await res.json() as SlotsResponse;
      } catch {
        throw new Error('API unavailable');
      }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSlots(data.slots ?? []);
      setMock(data.mock === true);
    } catch {
      // API unavailable — generate mock slots client-side from SLOT_RULES
      const mockSlots = generateMockSlots(apptType, 6);
      setSlots(mockSlots);
      setMock(true);
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
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
    {/* ── Main scheduling area ── */}
    <div className="gap-y" style={{ flex: 1, minWidth: 0 }}>
      {/* Acuity banner */}
      {ctx.patientName.trim() && (
        <div style={{
          ...ACUITY_BANNER_STYLES[acuity] ?? ACUITY_BANNER_STYLES.routine,
          borderRadius: 8, padding: '10px 14px',
          fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {acuity} · Score {score}
          </span>
          <span style={{ fontWeight: 400 }}>
            {ctx.patientName} — {ACUITY_PATHWAY_LABEL[acuity] ?? 'standard pathway'}
          </span>
        </div>
      )}

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
              ✓ Confirm Booking
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
          <div style={{ fontWeight: 700, color: '#16a34a', marginBottom: 6 }}>✓ Booking confirmed</div>
          <div>Calendar event for <strong>{ctx.patientName || 'the patient'}</strong> on <strong>{booked.display.day} {booked.display.date}</strong> at <strong>{formatTime(booked.start)}</strong>.</div>
          <button className="summary-btn summary-btn--ghost" style={{ marginTop: 10, height: 32 }} onClick={() => { setBooked(null); setConfirmed(false); }}>Done</button>
        </div>
      )}

      {/* Mock calendar notice */}
      {mock && slots.length > 0 && !confirmed && (
        <div style={{ background: '#fffbeb', border: '1px solid rgba(251,191,36,.5)', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#92400e' }}>
          Calendar service not connected — slots shown are based on clinic schedule and subject to confirmation
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

      {!loading && slots.length === 0 && (
        <div style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', paddingTop: 20 }}>
          Select an appointment type and click <strong>Find available slots</strong>.
        </div>
      )}

      <TheatreListBuilderCard />
      <TheatreBookingCard />
      <PreopDayChecklist />
      <PostOpMilestonesCard />
    </div>

    {/* ── Right: Pending Booking Reminders ── */}
    <div style={{
      width: reminderCollapsed ? 36 : 280,
      flexShrink: 0,
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      overflow: 'hidden',
      transition: 'width .2s ease',
      alignSelf: 'flex-start',
    }}>
      {/* Header row */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: reminderCollapsed ? '10px 6px' : '10px 12px',
          background: pendingBookings.length > 0 ? '#fffbeb' : '#f9fafb',
          borderBottom: reminderCollapsed ? 'none' : '1px solid #e5e7eb',
          cursor: 'pointer',
        }}
        onClick={() => setReminderCollapsed(c => !c)}
        title={reminderCollapsed ? 'Show booking reminders' : 'Collapse'}
      >
        {reminderCollapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 14 }}>📋</span>
            {pendingBookings.length > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 800, background: '#b45309', color: '#fff',
                borderRadius: 99, padding: '1px 5px', lineHeight: 1.4,
              }}>
                {pendingBookings.length}
              </span>
            )}
          </div>
        ) : (
          <>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Booking Reminders</div>
              <div style={{ fontSize: 10, color: '#6b7280', marginTop: 1 }}>
                {pendingBookings.length === 0
                  ? 'No pending bookings'
                  : `${pendingBookings.length} awaiting action`}
              </div>
            </div>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>✕</span>
          </>
        )}
      </div>

      {/* Booking list */}
      {!reminderCollapsed && (
        <div style={{ maxHeight: 480, overflowY: 'auto' }}>
          {pendingBookings.length === 0 ? (
            <div style={{ padding: '20px 12px', textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
              All bookings actioned ✓
            </div>
          ) : (
            pendingBookings.map(b => {
              const apptType = b.appointment_type || b.chief_complaint || 'consultation';
              const slot = b.confirmed_slot || b.preferred_slot || b.preferred_date;
              const sc = BOOKING_STATUS_COLORS[b.status] ?? { bg: '#f3f4f6', color: '#6b7280', label: b.status };
              const acuity = b.triage_acuity || b.triage_level;

              return (
                <div
                  key={b.id}
                  style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid #f3f4f6',
                    background: b.status === 'pending' && acuity === 'urgent' ? '#fff8f8' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4, marginBottom: 3 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {b.patient_name}
                    </div>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, flexShrink: 0,
                      background: sc.bg, color: sc.color, border: `1px solid ${sc.color}33`,
                    }}>
                      {sc.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>
                    {apptType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </div>
                  {slot && (
                    <div style={{ fontSize: 10, color: '#1d4ed8', fontWeight: 600 }}>
                      {b.status === 'staff_confirmed' ? '✓ Slot: ' : 'Pref: '}{fmtBookingSlot(slot)}
                    </div>
                  )}
                  {acuity && acuity !== 'routine' && (
                    <div style={{
                      marginTop: 3, fontSize: 9, fontWeight: 700,
                      color: acuity === 'urgent' ? '#dc2626' : '#c2410c',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      ⚠ {acuity}
                    </div>
                  )}
                  {b.status === 'staff_confirmed' && (
                    <div style={{ marginTop: 4, fontSize: 10, color: '#7c3aed', fontStyle: 'italic' }}>
                      Awaiting doctor sign-off
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
      {!reminderCollapsed && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid #f3f4f6' }}>
          <button
            type="button"
            onClick={() => void fetchPendingBookings()}
            style={{ width: '100%', fontSize: 11, color: '#6b7280', background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 0', cursor: 'pointer' }}
          >
            Refresh
          </button>
        </div>
      )}
    </div>
    </div>
  );
}
