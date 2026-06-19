import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { hasRole } from '@/lib/roles';
import ConsultationRequestsView from './ConsultationRequestsView';
import { errMsg } from '@/lib/err';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BookingRequest {
  id: string;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string | null;
  appointment_type: string;
  location: string;
  preferred_slot: string | null;
  reason: string | null;
  triage_acuity: string | null;
  triage_score: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  confirmed_slot: string | null;
  staff_confirmed_at: string | null;
  patient_confirmed_at: string | null;
  patient_ack_sent_at: string | null;
  staff_notified_at: string | null;
  staff_escalated_at: string | null;
  prep_sms_sent: boolean;
  reminder_sent_at: string | null;
  source?: string;
  whatsapp_from?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

const PREP_TYPES = new Set(['colonoscopy', 'ogd', 'egd', 'ercp_workup', 'pre_op', 'flexi_sig']);
function requiresPrep(type: string) { return PREP_TYPES.has(type.toLowerCase()); }

function apptLabel(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function fmtSlot(iso: string): string {
  return new Date(iso).toLocaleString('en-LC', {
    timeZone: 'America/St_Lucia',
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  pending:           { label: 'Pending',          bg: '#fffbeb', color: '#b45309', border: '#fcd34d' },
  waitlisted:        { label: 'Waitlisted',       bg: '#faf5ff', color: '#7c3aed', border: '#c4b5fd' },
  staff_confirmed:   { label: 'Slot Confirmed',   bg: '#eff6ff', color: '#1d4ed8', border: '#93c5fd' },
  patient_confirmed: { label: 'Patient Confirmed',bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
  lapsed:            { label: 'Lapsed',           bg: '#f9fafb', color: '#9ca3af', border: '#e5e7eb' },
  cancelled:         { label: 'Cancelled',        bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
};

const PREP_INSTRUCTIONS: Record<string, string> = {
  colonoscopy:  'Clear fluids only the day before. Take prescribed bowel prep solution as directed. Nothing by mouth from midnight. Patient must arrange a driver — sedation given.',
  ogd:          'Nothing to eat or drink from midnight. May take essential medications with a small sip of water. Arrange a driver home.',
  egd:          'Nothing to eat or drink from midnight. May take essential medications with a small sip of water. Arrange a driver home.',
  ercp_workup:  'Nothing by mouth from midnight. Stop blood thinners as advised by doctor. Must arrange a driver — cannot drive after sedation.',
  pre_op:       'Nothing by mouth from midnight. Continue essential medications with a small sip of water unless instructed otherwise. Bring full medication list to appointment.',
  flexi_sig:    'Follow bowel prep instructions provided. Clear fluids only on morning of procedure. Arrange a driver home.',
};

const LOCATION_LABELS: Record<string, string> = {
  rodney_bay: 'Rodney Bay Clinic',
  castries:   'Castries',
  tapion:     'Tapion Hospital / ERCP Suite',
};

const SOURCE_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  web:       { label: 'Web',       bg: '#eff6ff', color: '#1d4ed8', border: '#93c5fd' },
  whatsapp:  { label: 'WhatsApp',  bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
  manual:    { label: 'Manual',    bg: '#faf5ff', color: '#7c3aed', border: '#c4b5fd' },
  phone:     { label: 'Phone',     bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
  email:     { label: 'Email',     bg: '#f0f9ff', color: '#0369a1', border: '#7dd3fc' },
};

const APPOINTMENT_TYPE_OPTIONS = [
  { value: 'consultation',  label: 'Consultation' },
  { value: 'colonoscopy',   label: 'Colonoscopy' },
  { value: 'ogd',           label: 'OGD / Gastroscopy' },
  { value: 'ercp_workup',   label: 'ERCP Workup' },
  { value: 'pre_op',        label: 'Pre-Op Assessment' },
  { value: 'flexi_sig',     label: 'Flexible Sigmoidoscopy' },
  { value: 'follow_up',     label: 'Follow-Up' },
  { value: 'other',         label: 'Other' },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: 99,
      fontSize: 11, fontWeight: 700, letterSpacing: 0.2,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
  );
}

function AuditRow({ label, value, urgent }: { label: string; value: string | null; urgent?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12 }}>
      <span style={{ minWidth: 130, color: '#6b7280', flexShrink: 0 }}>{label}</span>
      <span style={{ color: urgent ? '#dc2626' : value ? '#111827' : '#9ca3af', fontWeight: value ? 600 : 400 }}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function SourceBadge({ source }: { source?: string }) {
  const cfg = SOURCE_CONFIG[source ?? ''] ?? { label: source ?? 'web', bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' };
  return (
    <span style={{
      display: 'inline-block', padding: '1px 7px', borderRadius: 99,
      fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>
      {cfg.label.toUpperCase()}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type InboxView = 'bookings' | 'consult_requests';

export interface BookingInboxTabProps {
  /** If provided, only bookings with this status are shown. */
  filterStatus?: string;
}

export default function BookingInboxTab({ filterStatus }: BookingInboxTabProps = {}) {
  const { profile } = useAuth();
  const userRole = profile?.role ?? 'front_desk';
  const isAdmin = hasRole(userRole, 'admin');

  const [requests, setRequests]           = useState<BookingRequest[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [selected, setSelected]           = useState<BookingRequest | null>(null);

  // Confirm form state
  const [confirmDate, setConfirmDate]     = useState(() => new Date().toISOString().slice(0, 10));
  const [confirmTime, setConfirmTime]     = useState('09:00');
  const [confirmLoc, setConfirmLoc]       = useState('rodney_bay');
  const [confirmNotes, setConfirmNotes]   = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [confirmErr, setConfirmErr]       = useState<string | null>(null);
  const [confirmOk, setConfirmOk]         = useState(false);

  // Waitlist action state
  const [waitlisting, setWaitlisting]     = useState(false);
  const [waitlistErr, setWaitlistErr]     = useState<string | null>(null);

  // Cancel action state
  const [cancelling, setCancelling]       = useState(false);
  const [cancelErr, setCancelErr]         = useState<string | null>(null);

  // Portal-access action state
  const [portalRegistering, setPortalRegistering] = useState(false);
  const [portalErr, setPortalErr]                 = useState<string | null>(null);
  const [portalOk, setPortalOk]                   = useState(false);

  // Manual entry state
  const [showNewRequest, setShowNewRequest]   = useState(false);
  const [nrName, setNrName]                   = useState('');
  const [nrPhone, setNrPhone]                 = useState('');
  const [nrEmail, setNrEmail]                 = useState('');
  const [nrType, setNrType]                   = useState('consultation');
  const [nrLocation, setNrLocation]           = useState('rodney_bay');
  const [nrSlot, setNrSlot]                   = useState(() => new Date().toISOString().slice(0, 10));
  const [nrSource, setNrSource]               = useState<'manual' | 'phone' | 'email' | 'whatsapp'>('manual');
  const [nrReason, setNrReason]               = useState('');
  const [nrSubmitting, setNrSubmitting]       = useState(false);
  const [nrErr, setNrErr]                     = useState<string | null>(null);
  const [nrOk, setNrOk]                       = useState(false);
  const nrNameRef                             = useRef<HTMLInputElement>(null);
  const [view, setView]                       = useState<InboxView>('bookings');

  const load = useCallback(async () => {
    try {
      const url = filterStatus
        ? apiUrl(`/api/booking/requests?status=${filterStatus}`)
        : apiUrl('/api/booking/requests');
      const r = await fetch(url, { headers: await staffAuthHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json() as { requests: BookingRequest[] };
      setRequests(d.requests ?? []);
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  // When a booking is selected, pre-fill location from its data and reset
  // any per-selection action state from the previously-viewed request
  useEffect(() => {
    if (selected) setConfirmLoc(selected.location || 'rodney_bay');
    setPortalOk(false);
    setPortalErr(null);
  }, [selected?.id]);

  async function handleConfirm() {
    if (!selected || !confirmDate) return;
    setSubmitting(true);
    setConfirmErr(null);
    try {
      const confirmed_slot = `${confirmDate}T${confirmTime}:00`;
      const r = await fetch(apiUrl(`/api/booking/staff-confirm/${selected.id}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({
          confirmed_slot: new Date(confirmed_slot).toISOString(),
          notes: confirmNotes || null,
        }),
      });
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        throw new Error(d.error ?? `HTTP ${r.status}`);
      }
      setConfirmOk(true);
      await load();
      setTimeout(() => {
        setConfirmOk(false);
        setSelected(null);
        setConfirmDate('');
        setConfirmTime('09:00');
        setConfirmNotes('');
      }, 2500);
    } catch (e) {
      setConfirmErr(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWaitlist() {
    if (!selected) return;
    setWaitlisting(true);
    setWaitlistErr(null);
    try {
      const r = await fetch(apiUrl(`/api/booking/waitlist/${selected.id}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ notes: confirmNotes || null }),
      });
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        throw new Error(d.error ?? `HTTP ${r.status}`);
      }
      await load();
      setSelected(null);
    } catch (e) {
      setWaitlistErr(errMsg(e));
    } finally {
      setWaitlisting(false);
    }
  }

  async function handleCancel() {
    if (!selected) return;
    if (!window.confirm(`Cancel this booking request for ${selected.patient_name}?`)) return;
    setCancelling(true);
    setCancelErr(null);
    try {
      const r = await fetch(apiUrl(`/api/booking/cancel/${selected.id}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ reason: 'Cancelled by staff' }),
      });
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        throw new Error(d.error ?? `HTTP ${r.status}`);
      }
      await load();
      setSelected(null);
    } catch (e) {
      setCancelErr(errMsg(e));
    } finally {
      setCancelling(false);
    }
  }

  async function handleEnablePortal() {
    if (!selected || !selected.patient_phone) return;
    setPortalRegistering(true);
    setPortalErr(null);
    try {
      const r = await fetch(apiUrl('/api/patient/portal/register-by-phone'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({
          patientName:  selected.patient_name,
          patientPhone: selected.patient_phone,
        }),
      });
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        throw new Error(d.error ?? `HTTP ${r.status}`);
      }
      setPortalOk(true);
    } catch (e) {
      setPortalErr(errMsg(e));
    } finally {
      setPortalRegistering(false);
    }
  }

  async function handleNewRequest() {
    if (!nrName.trim() || !nrType) return;
    setNrSubmitting(true);
    setNrErr(null);
    try {
      const r = await fetch(apiUrl('/api/booking/request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_name:     nrName.trim(),
          patient_email:    nrEmail.trim() || `manual.${Date.now()}@noreply.amise.internal`,
          patient_phone:    nrPhone.trim() || null,
          appointment_type: nrType,
          location:         nrLocation,
          preferred_slot:   nrSlot.trim() || null,
          reason:           nrReason.trim() || null,
          source:           nrSource,
        }),
      });
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        throw new Error(d.error ?? `HTTP ${r.status}`);
      }
      setNrOk(true);
      await load();
      setTimeout(() => {
        setShowNewRequest(false);
        setNrOk(false);
        setNrName(''); setNrPhone(''); setNrEmail('');
        setNrType('consultation'); setNrLocation('rodney_bay');
        setNrSlot(''); setNrReason(''); setNrSource('manual');
      }, 2000);
    } catch (e) {
      setNrErr(errMsg(e));
    } finally {
      setNrSubmitting(false);
    }
  }

  // Unified intake sort — surfaces the cases that need attention first,
  // regardless of which channel (web/WhatsApp/phone/email/manual) they
  // arrived on:
  //   1. Urgent acuity always leads — a life/limb-threatening case can't
  //      wait behind scheduling order just because it came in by phone.
  //   2. Procedures (endoscopy/OR-suite types needing prep + lead time for
  //      anaesthesia/lab coordination) get a fast path ahead of routine
  //      already-scheduled follow-ups — their logistics lock in early.
  //   3. Remaining acuity tiers (priority, then routine).
  //   4. Status — items still needing action (pending/waitlisted) before
  //      ones already actioned.
  //   5. Oldest first, as a fair tiebreaker.
  const ACUITY_RANK: Record<string, number> = { urgent: 0, priority: 1, routine: 2 };
  const STATUS_RANK: Record<string, number> = {
    pending: 0, waitlisted: 1, staff_confirmed: 2, patient_confirmed: 3, lapsed: 4, cancelled: 5,
  };
  const sorted = [...requests].sort((a, b) => {
    const aUrgent = a.triage_acuity === 'urgent' ? 0 : 1;
    const bUrgent = b.triage_acuity === 'urgent' ? 0 : 1;
    if (aUrgent !== bUrgent) return aUrgent - bUrgent;

    const aProc = requiresPrep(a.appointment_type) ? 0 : 1;
    const bProc = requiresPrep(b.appointment_type) ? 0 : 1;
    if (aProc !== bProc) return aProc - bProc;

    const aAcuity = ACUITY_RANK[a.triage_acuity ?? 'routine'] ?? ACUITY_RANK.routine;
    const bAcuity = ACUITY_RANK[b.triage_acuity ?? 'routine'] ?? ACUITY_RANK.routine;
    if (aAcuity !== bAcuity) return aAcuity - bAcuity;

    const aStatus = STATUS_RANK[a.status] ?? 9;
    const bStatus = STATUS_RANK[b.status] ?? 9;
    if (aStatus !== bStatus) return aStatus - bStatus;

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  // ── Layout ────────────────────────────────────────────────────────────────

  const TAB_STYLE = (active: boolean) => ({
    padding: '10px 16px', fontSize: 13, fontWeight: active ? 700 : 500,
    color: active ? '#0d9488' : '#6b7280', background: 'none', border: 'none',
    borderBottom: active ? '2px solid #0d9488' : '2px solid transparent',
    cursor: 'pointer', transition: 'color .15s',
  });

  const bookingsContent = loading ? (
    <div style={{ padding: '40px 24px', color: '#6b7280', textAlign: 'center' }}>
      Loading booking requests…
    </div>
  ) : error ? (
    <div style={{ padding: '24px' }}>
      <div style={{ padding: '12px 16px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 13 }}>
        Could not load bookings: {error}
        <button onClick={() => void load()} style={{ marginLeft: 12, padding: '2px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: 'white', color: '#dc2626', cursor: 'pointer', fontSize: 12 }}>Retry</button>
      </div>
    </div>
  ) : (
    <div style={{ display: 'flex', gap: 0, flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* ── Left: booking list ─────────────────────────────────────────────── */}
      <div style={{
        width: (selected || showNewRequest) ? 340 : '100%',
        maxWidth: (selected || showNewRequest) ? 340 : undefined,
        flexShrink: 0,
        borderRight: (selected || showNewRequest) ? '1px solid #e5e7eb' : 'none',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Booking Requests</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
              {pendingCount > 0
                ? <span style={{ color: '#b45309', fontWeight: 600 }}>{pendingCount} pending action{pendingCount !== 1 ? 's' : ''}</span>
                : 'All requests actioned'
              }
            </div>
          </div>
          <button
            onClick={() => void load()}
            style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: 12, cursor: 'pointer' }}
          >
            Refresh
          </button>
          <button
            onClick={() => { setShowNewRequest(true); setSelected(null); setTimeout(() => nrNameRef.current?.focus(), 50); }}
            style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            + New Request
          </button>
        </div>

        {/* List */}
        {sorted.length === 0 ? (
          <div style={{ padding: '40px 20px', color: '#9ca3af', textAlign: 'center', fontSize: 13 }}>
            No booking requests yet.
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            {sorted.map(req => {
              const isSelected = selected?.id === req.id;
              const isEscalated = !!req.staff_escalated_at;
              const isPending = req.status === 'pending';
              const hoursWaiting = Math.floor((Date.now() - new Date(req.created_at).getTime()) / 3_600_000);
              const overdue = isPending && hoursWaiting >= 2;

              return (
                <button
                  key={req.id}
                  onClick={() => { setShowNewRequest(false); setSelected(isSelected ? null : req); }}
                  style={{
                    width: '100%', textAlign: 'left', padding: '12px 20px',
                    borderBottom: '1px solid #f3f4f6',
                    background: isSelected ? '#f0fdf4' : overdue ? '#fffbeb' : '#fff',
                    border: 'none', cursor: 'pointer',
                    borderLeft: isSelected ? '3px solid #16a34a' : overdue ? '3px solid #f59e0b' : '3px solid transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  {/* Row 1: Name + status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {req.patient_name}
                    </span>
                    <StatusBadge status={req.status} />
                  </div>

                  {/* Row 2: Appt type + source + prep chip */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: '#374151' }}>{apptLabel(req.appointment_type)}</span>
                    <SourceBadge source={req.source} />
                    {requiresPrep(req.appointment_type) && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa' }}>
                        PREP
                      </span>
                    )}
                  </div>

                  {/* Row 3: Time + escalation warning */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: overdue ? '#b45309' : '#9ca3af' }}>
                      {timeAgo(req.created_at)}
                    </span>
                    {isEscalated && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                        ESCALATED
                      </span>
                    )}
                    {req.patient_phone && (
                      <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>{req.patient_phone}</span>
                    )}
                  </div>

                  {/* Preferred slot */}
                  {req.preferred_slot && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                      Preferred: {req.preferred_slot}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right: manual entry panel ────────────────────────────────────── */}
      {showNewRequest && !selected && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#111827', flex: 1 }}>New Booking Request</div>
            <button
              onClick={() => setShowNewRequest(false)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: 13 }}
            >
              ✕ Cancel
            </button>
          </div>

          <div style={{ padding: '16px', borderRadius: 10, background: '#fff', border: '2px solid #e5e7eb' }}>

            {/* Source channel */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Source channel *</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['manual', 'phone', 'email', 'whatsapp'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setNrSource(s)}
                    style={{
                      padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                      border: `1.5px solid ${nrSource === s ? (SOURCE_CONFIG[s]?.border ?? '#d1d5db') : '#e5e7eb'}`,
                      background: nrSource === s ? (SOURCE_CONFIG[s]?.bg ?? '#f3f4f6') : '#fff',
                      color: nrSource === s ? (SOURCE_CONFIG[s]?.color ?? '#374151') : '#6b7280',
                    }}
                  >
                    {SOURCE_CONFIG[s]?.label ?? s}
                  </button>
                ))}
              </div>
            </div>

            {/* Name + phone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Patient name *</label>
                <input
                  ref={nrNameRef}
                  type="text"
                  value={nrName}
                  onChange={e => setNrName(e.target.value)}
                  placeholder="Full name"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Phone number</label>
                <input
                  type="tel"
                  value={nrPhone}
                  onChange={e => setNrPhone(e.target.value)}
                  placeholder="+1 758 …"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Email address</label>
              <input
                type="email"
                value={nrEmail}
                onChange={e => setNrEmail(e.target.value)}
                placeholder="patient@example.com (optional)"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>

            {/* Appointment type + location */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Appointment type *</label>
                <select
                  value={nrType}
                  onChange={e => setNrType(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                >
                  {APPOINTMENT_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Location</label>
                <select
                  value={nrLocation}
                  onChange={e => setNrLocation(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                >
                  <option value="rodney_bay">Rodney Bay Clinic</option>
                  <option value="castries">Castries</option>
                  <option value="tapion">Tapion Hospital / ERCP Suite</option>
                </select>
              </div>
            </div>

            {/* Preferred slot */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Preferred date / time (free text)</label>
              <input
                type="text"
                value={nrSlot}
                onChange={e => setNrSlot(e.target.value)}
                placeholder="e.g. any morning next week, Tuesday afternoon"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>

            {/* Reason / notes */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Reason / notes</label>
              <textarea
                value={nrReason}
                onChange={e => setNrReason(e.target.value)}
                rows={3}
                placeholder="Patient's stated reason, referral notes, or conversation summary…"
                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 12, boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            {requiresPrep(nrType) && (
              <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 8, background: '#fff7ed', border: '1px solid #fed7aa' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#c2410c' }}>
                  ⚠ {apptLabel(nrType)} requires preparation instructions — these will be sent automatically in the 48h confirmation SMS.
                </div>
              </div>
            )}

            {nrErr && (
              <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12 }}>
                {nrErr}
              </div>
            )}
            {nrOk && (
              <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', fontSize: 12, fontWeight: 600 }}>
                ✓ Request created — staff will be notified.
              </div>
            )}

            <button
              onClick={() => void handleNewRequest()}
              disabled={!nrName.trim() || nrSubmitting || nrOk}
              style={{
                width: '100%', padding: '11px', borderRadius: 8, border: 'none',
                background: nrName.trim() && !nrSubmitting && !nrOk ? '#0d9488' : '#9ca3af',
                color: '#fff', fontWeight: 700, fontSize: 14,
                cursor: nrName.trim() && !nrSubmitting && !nrOk ? 'pointer' : 'not-allowed',
              }}
            >
              {nrSubmitting ? 'Creating…' : nrOk ? '✓ Created' : 'Create Booking Request'}
            </button>
          </div>
        </div>
      )}

      {/* ── Right: detail panel ───────────────────────────────────────────── */}
      {selected && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', minWidth: 0 }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 4 }}>{selected.patient_name}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusBadge status={selected.status} />
                <span style={{ fontSize: 12, color: '#6b7280' }}>Submitted {timeAgo(selected.created_at)}</span>
                {selected.triage_acuity && selected.triage_acuity !== 'routine' && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                    background: selected.triage_acuity === 'urgent' ? '#fef2f2' : '#fff7ed',
                    color: selected.triage_acuity === 'urgent' ? '#dc2626' : '#c2410c',
                    border: `1px solid ${selected.triage_acuity === 'urgent' ? '#fecaca' : '#fed7aa'}`,
                  }}>
                    {selected.triage_acuity.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: 13 }}
            >
              ✕ Close
            </button>
          </div>

          {/* Patient info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Email',       value: selected.patient_email },
              { label: 'Phone',       value: selected.patient_phone },
              { label: 'Appointment', value: apptLabel(selected.appointment_type) },
              { label: 'Location',    value: LOCATION_LABELS[selected.location] ?? selected.location },
              { label: 'Preferred slot', value: selected.preferred_slot ?? 'No preference' },
              { label: 'Triage acuity', value: selected.triage_acuity ?? 'Not assessed' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{value ?? '—'}</div>
              </div>
            ))}
            <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 5 }}>Source channel</div>
              <SourceBadge source={selected.source} />
            </div>
          </div>

          {/* Reason */}
          {selected.reason && (
            <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Reason / Notes from patient</div>
              <div style={{ fontSize: 13, color: '#374151' }}>{selected.reason}</div>
            </div>
          )}

          {/* Prep instructions */}
          {requiresPrep(selected.appointment_type) && (
            <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 8, background: '#fff7ed', border: '1px solid #fed7aa' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#c2410c', marginBottom: 6 }}>
                ⚠ Procedure Preparation Required — {apptLabel(selected.appointment_type)}
              </div>
              <div style={{ fontSize: 12, color: '#7c2d12', lineHeight: 1.6 }}>
                {PREP_INSTRUCTIONS[selected.appointment_type.toLowerCase()] ?? 'See procedure prep guidelines.'}
              </div>
              <div style={{ fontSize: 11, color: '#c2410c', marginTop: 8, fontWeight: 600 }}>
                {selected.prep_sms_sent
                  ? '✓ Prep instructions already sent to patient by SMS'
                  : 'Prep instructions will be included in the 48h confirmation SMS automatically.'}
              </div>
            </div>
          )}

          {/* ── Confirm slot section ─────────────────────────────────────── */}
          {selected.status === 'pending' && (
            <div style={{ marginBottom: 20, padding: '16px', borderRadius: 10, background: '#fff', border: '2px solid #e5e7eb' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 14 }}>
                Confirm Appointment Slot
              </div>

              {/* Contact patient quick link */}
              {selected.patient_phone && (
                <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
                  <a
                    href={`tel:${selected.patient_phone}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', fontWeight: 600, fontSize: 12, textDecoration: 'none' }}
                  >
                    📞 Call {selected.patient_name.split(' ')[0]}
                  </a>
                  <a
                    href={`https://wa.me/${selected.patient_phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 7, background: '#f0fdf9', border: '1px solid #99f6e4', color: '#0f766e', fontWeight: 600, fontSize: 12, textDecoration: 'none' }}
                  >
                    WhatsApp
                  </a>
                </div>
              )}

              {/* Slot picker */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Date *</label>
                  <input
                    type="date"
                    value={confirmDate}
                    onChange={e => setConfirmDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Time *</label>
                  <select
                    value={confirmTime}
                    onChange={e => setConfirmTime(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                  >
                    {['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
                      '13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Location</label>
                <select
                  value={confirmLoc}
                  onChange={e => setConfirmLoc(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                >
                  <option value="rodney_bay">Rodney Bay Clinic</option>
                  <option value="castries">Castries</option>
                  <option value="tapion">Tapion Hospital / ERCP Suite</option>
                </select>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Internal notes (optional)</label>
                <textarea
                  value={confirmNotes}
                  onChange={e => setConfirmNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Patient to bring insurance card, prep kit collected…"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 12, boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              {confirmErr && (
                <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12 }}>
                  {confirmErr}
                </div>
              )}
              {confirmOk && (
                <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', fontSize: 12, fontWeight: 600 }}>
                  ✓ Appointment confirmed — patient SMS will be sent in the next reminder cycle.
                </div>
              )}

              <button
                onClick={() => void handleConfirm()}
                disabled={!confirmDate || submitting || confirmOk}
                style={{
                  width: '100%', padding: '11px', borderRadius: 8, border: 'none',
                  background: confirmDate && !submitting && !confirmOk ? '#0d9488' : '#9ca3af',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                  cursor: confirmDate && !submitting && !confirmOk ? 'pointer' : 'not-allowed',
                  transition: 'background .15s',
                }}
              >
                {submitting ? 'Confirming…' : confirmOk ? '✓ Confirmed' : 'Confirm Appointment & Notify Patient'}
              </button>

              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8, textAlign: 'center' }}>
                Patient will receive a confirmation SMS with slot details{requiresPrep(selected.appointment_type) ? ' and preparation instructions' : ''}.
              </div>

              {waitlistErr && (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12 }}>
                  {waitlistErr}
                </div>
              )}

              <button
                onClick={() => void handleWaitlist()}
                disabled={waitlisting}
                style={{
                  width: '100%', marginTop: 10, padding: '9px', borderRadius: 8,
                  border: '1.5px solid #c4b5fd', background: '#faf5ff', color: '#7c3aed',
                  fontWeight: 600, fontSize: 13, cursor: waitlisting ? 'not-allowed' : 'pointer',
                }}
              >
                {waitlisting ? 'Moving to waitlist…' : 'No slot available — move to waitlist'}
              </button>
            </div>
          )}

          {/* Confirmed slot display */}
          {selected.status !== 'pending' && selected.confirmed_slot && (
            <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 10, background: '#eff6ff', border: '1px solid #93c5fd' }}>
              <div style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 700, marginBottom: 4 }}>Confirmed Slot</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a8a' }}>{fmtSlot(selected.confirmed_slot)}</div>
              <div style={{ fontSize: 12, color: '#1d4ed8', marginTop: 4 }}>{LOCATION_LABELS[selected.location] ?? selected.location}</div>
              {selected.notes && <div style={{ fontSize: 12, color: '#374151', marginTop: 6, fontStyle: 'italic' }}>{selected.notes}</div>}
            </div>
          )}

          {/* ── Cancel request ────────────────────────────────────────────── */}
          {['pending', 'waitlisted', 'staff_confirmed'].includes(selected.status) && (
            <div style={{ marginBottom: 20 }}>
              {cancelErr && (
                <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12 }}>
                  {cancelErr}
                </div>
              )}
              <button
                onClick={() => void handleCancel()}
                disabled={cancelling}
                style={{
                  width: '100%', padding: '9px', borderRadius: 8,
                  border: '1.5px solid #fecaca', background: '#fef2f2', color: '#b91c1c',
                  fontWeight: 600, fontSize: 13, cursor: cancelling ? 'not-allowed' : 'pointer',
                }}
              >
                {cancelling ? 'Cancelling…' : 'Cancel booking request'}
              </button>
            </div>
          )}

          {/* ── Patient portal access ────────────────────────────────────── */}
          {selected.status !== 'pending' && selected.patient_phone && (
            <div style={{ marginBottom: 20, padding: '16px', borderRadius: 10, background: '#fff', border: '2px solid #e5e7eb' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
                Patient Portal Access
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, lineHeight: 1.5 }}>
                No password to set up — the patient signs in with just their phone number and a one-time code sent by SMS each time.
              </div>

              {portalErr && (
                <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12 }}>
                  {portalErr}
                </div>
              )}
              {portalOk && (
                <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', fontSize: 12, fontWeight: 600 }}>
                  ✓ Portal access enabled — {selected.patient_name.split(' ')[0]} can sign in at the patient portal with {selected.patient_phone}.
                </div>
              )}

              <button
                onClick={() => void handleEnablePortal()}
                disabled={portalRegistering || portalOk}
                style={{
                  width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                  background: portalOk ? '#9ca3af' : '#0d9488',
                  color: '#fff', fontWeight: 700, fontSize: 13,
                  cursor: portalRegistering || portalOk ? 'not-allowed' : 'pointer',
                }}
              >
                {portalRegistering ? 'Enabling…' : portalOk ? '✓ Portal Access Enabled' : 'Enable Portal Access'}
              </button>
            </div>
          )}

          {/* ── Audit trail ─────────────────────────────────────────────── */}
          <div style={{ padding: '14px 16px', borderRadius: 10, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
              {isAdmin ? 'Full Audit Trail' : 'Status Trail'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <AuditRow label="Submitted"          value={fmtSlot(selected.created_at)} />
              <AuditRow label="Patient ack SMS"    value={selected.patient_ack_sent_at ? fmtSlot(selected.patient_ack_sent_at) : null} />
              <AuditRow label="Staff notified"     value={selected.staff_notified_at   ? fmtSlot(selected.staff_notified_at)   : null} />
              {(isAdmin || selected.staff_escalated_at) && (
                <AuditRow
                  label="Escalation sent"
                  value={selected.staff_escalated_at ? fmtSlot(selected.staff_escalated_at) : null}
                  urgent={!!selected.staff_escalated_at}
                />
              )}
              {isAdmin && (
                <AuditRow label="Booking ID" value={selected.id} />
              )}
              {isAdmin && selected.whatsapp_from && (
                <AuditRow label="WhatsApp from" value={selected.whatsapp_from} />
              )}
              {selected.staff_confirmed_at && (
                <AuditRow label="Slot confirmed"  value={fmtSlot(selected.staff_confirmed_at)} />
              )}
              {selected.patient_confirmed_at && (
                <AuditRow label="Patient confirmed" value={fmtSlot(selected.patient_confirmed_at)} />
              )}
              {selected.reminder_sent_at && (
                <AuditRow label="Reminder SMS sent" value={fmtSlot(selected.reminder_sent_at)} />
              )}
              {isAdmin && (
                <AuditRow label="Prep SMS sent" value={selected.prep_sms_sent ? 'Yes' : 'Not yet'} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Tab nav */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', paddingLeft: 8, flexShrink: 0, background: '#fafafa' }}>
        <button onClick={() => setView('bookings')} style={TAB_STYLE(view === 'bookings')}>
          Booking Requests{pendingCount > 0 ? ` (${pendingCount})` : ''}
        </button>
        <button onClick={() => setView('consult_requests')} style={TAB_STYLE(view === 'consult_requests')}>
          Public Enquiries
        </button>
      </div>
      {view === 'consult_requests' ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <ConsultationRequestsView />
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {bookingsContent}
        </div>
      )}
    </div>
  );
}
