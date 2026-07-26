import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { hasRole } from '@/lib/roles';
import ConsultationRequestsView from './ConsultationRequestsView';
import { errMsg } from '@/lib/err';
import { fmtPhone } from '@/lib/fmt';
import { supabase } from '@/lib/supabase';
import { loadPMH, loadEncounterData, getLatestOpenEncounter, getLatestClosedEncounter } from '@/lib/db';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BookingRequest {
  id: string;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string | null;
  // New column names (app code canonical)
  appointment_type?: string;
  location?: string;
  preferred_slot?: string | null;
  triage_acuity?: string | null;
  triage_score?: number | null;
  // Production DB column names (may exist instead of the above)
  chief_complaint?: string;
  preferred_site?: string;
  preferred_date?: string | null;
  triage_level?: string | null;
  // Common columns
  reason: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  confirmed_slot?: string | null;
  staff_confirmed_at?: string | null;
  patient_confirmed_at?: string | null;
  patient_ack_sent_at?: string | null;
  staff_notified_at?: string | null;
  staff_escalated_at?: string | null;
  prep_sms_sent?: boolean;
  reminder_sent_at?: string | null;
  source?: string;
  whatsapp_from?: string | null;
}

/** Resolve appointment type from whichever column is populated. */
function resolveApptType(r: BookingRequest): string {
  return r.appointment_type || r.chief_complaint || 'consultation';
}

/** Resolve location from whichever column is populated. */
function resolveLocation(r: BookingRequest): string {
  return r.location || r.preferred_site || 'rodney_bay';
}

/** Resolve preferred slot from whichever column is populated. */
function resolvePreferredSlot(r: BookingRequest): string | null | undefined {
  return r.preferred_slot ?? r.preferred_date;
}

/** Resolve triage acuity from whichever column is populated. */
function resolveTriageAcuity(r: BookingRequest): string | null | undefined {
  return r.triage_acuity ?? r.triage_level;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

const PREP_TYPES = new Set(['colonoscopy', 'ogd', 'egd', 'ercp_workup', 'pre_op', 'flexi_sig']);
function requiresPrep(type: string) { return PREP_TYPES.has(type.toLowerCase()); }

function mapApptTypeToVisitType(apptType: string): string {
  const t = apptType.toLowerCase().replace(/-/g, '_');
  if (t.includes('follow') || t === 'review') return 'follow_up';
  if (t.includes('post_op') || t.includes('postop')) return 'post_op';
  if (t === 'ercp' || t.startsWith('ercp')) return 'ercp';
  if (t.includes('ogd') || t.includes('egd') || t.includes('upper_gi')) return 'endoscopy_ogd';
  if (t.includes('colon') || t.includes('lower_gi')) return 'endoscopy_col';
  if (t.includes('breast')) return 'breast';
  if (t === 'telephone' || t.includes('phone_consult')) return 'telephone';
  if (t.includes('diabetic') || t.includes('foot')) return 'diabetic_foot';
  if (t.includes('urgent') || t.includes('emergency')) return 'urgent';
  return 'new_consult';
}

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
  pending:             { label: 'Pending',             bg: '#fffbeb', color: '#b45309', border: '#fcd34d' },
  waitlisted:          { label: 'Waitlisted',          bg: '#faf5ff', color: '#7c3aed', border: '#c4b5fd' },
  staff_confirmed:     { label: 'Slot Confirmed',      bg: '#eff6ff', color: '#1d4ed8', border: '#93c5fd' },
  staff_pending:       { label: 'Staff Booking',       bg: '#f0f9ff', color: '#0369a1', border: '#7dd3fc' },
  doctor_confirmed:    { label: 'Doctor Confirmed',    bg: '#f0fdf4', color: '#15803d', border: '#86efac' },
  patient_confirmed:   { label: 'Patient Confirmed',   bg: '#dcfce7', color: '#166534', border: '#4ade80' },
  lapsed:              { label: 'Lapsed',              bg: '#f9fafb', color: '#9ca3af', border: '#e5e7eb' },
  cancelled:           { label: 'Cancelled',           bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' },
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

type InboxView = 'bookings' | 'consult_requests' | 'today_queue';

const DEMO_PATIENTS_KEY = 'amise-patients-v1';
interface DemoPatient { id: string; full_name: string; age?: string; sex?: string; dob?: string; phone?: string; savedAt?: string }

function loadTodayQueue(): DemoPatient[] {
  try {
    const raw = localStorage.getItem(DEMO_PATIENTS_KEY);
    const all: DemoPatient[] = raw ? (JSON.parse(raw) as DemoPatient[]) : [];
    const today = new Date().toISOString().slice(0, 10);
    return all.filter(p => p.savedAt && p.savedAt.slice(0, 10) === today);
  } catch { return []; }
}

export interface BookingInboxTabProps {
  /** If provided, only bookings with this status are shown. */
  filterStatus?: string;
}

function useNarrow(bp = 768) {
  const [narrow, setNarrow] = useState(() => window.innerWidth < bp);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp - 1}px)`);
    const h = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [bp]);
  return narrow;
}

export default function BookingInboxTab({ filterStatus }: BookingInboxTabProps = {}) {
  const { profile } = useAuth();
  const {
    currentSite,
    setPatientName, setAge, setSex, setDob, setPhone, setPatientId,
    setTopSection, clearPatient,
    setComorbidities, setAllergies, setMedications, setSurgicalHistory, setSurgicalNotes,
    setEncounterId, setVisitType,
    setPriorEncounterSummary,
    setClinicalScores, setExtractedLabs,
  } = useAppContext();
  const narrow = useNarrow();

  // Today's walk-in queue (front-desk check-ins from IntakeTab)
  const [todayQueue, setTodayQueue] = useState<DemoPatient[]>(() => loadTodayQueue());
  const userRole = profile?.role ?? 'front_desk';
  const isAdmin = hasRole(userRole, 'admin');

  const [requests, setRequests]           = useState<BookingRequest[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [selected, setSelected]           = useState<BookingRequest | null>(null);
  const [lastRefresh, setLastRefresh]     = useState<Date | null>(null);
  const [statusFilter, setStatusFilter]   = useState<string>(filterStatus ?? '');

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

  // Check-in action state
  const [checkingIn, setCheckingIn]               = useState(false);
  const [checkInErr, setCheckInErr]               = useState<string | null>(null);
  const [checkInOk, setCheckInOk]                 = useState(false);
  const [checkedInEncounterId, setCheckedInEncounterId] = useState<string | null>(null);

  // Portal-access action state
  const [portalRegistering, setPortalRegistering] = useState(false);
  const [portalErr, setPortalErr]                 = useState<string | null>(null);
  const [portalOk, setPortalOk]                   = useState(false);

  // Patient account link state
  type AcctStatus = null | 'loading' | 'not_found' | { id: string; patient_id: string | null; patient_name: string | null };
  const [acctStatus, setAcctStatus]               = useState<AcctStatus>(null);
  const [linkSearchQ, setLinkSearchQ]             = useState('');
  const [linkSearchResults, setLinkSearchResults] = useState<Array<{ id: string; full_name: string; mrn?: string; phone?: string }>>([]);
  const [linkSearching, setLinkSearching]         = useState(false);
  const [linking, setLinking]                     = useState(false);
  const [linkOk, setLinkOk]                       = useState(false);
  const [linkErr, setLinkErr]                     = useState<string | null>(null);
  const [showLinkSearch, setShowLinkSearch]       = useState(false);
  const linkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Manual entry state
  const [showNewRequest, setShowNewRequest]   = useState(false);
  const [nrName, setNrName]                   = useState('');
  const [nrPhone, setNrPhone]                 = useState('');
  const [nrEmail, setNrEmail]                 = useState('');
  const [nrType, setNrType]                   = useState('consultation');
  const [nrLocation, setNrLocation]           = useState(currentSite);
  const [nrSlot, setNrSlot]                   = useState(() => new Date().toISOString().slice(0, 10));
  const [nrSource, setNrSource]               = useState<'manual' | 'phone' | 'email' | 'whatsapp'>('manual');
  const [nrReason, setNrReason]               = useState('');
  const [nrSubmitting, setNrSubmitting]       = useState(false);
  const [nrErr, setNrErr]                     = useState<string | null>(null);
  const [nrOk, setNrOk]                       = useState(false);
  const nrNameRef                             = useRef<HTMLInputElement>(null);
  const [view, setView]                       = useState<InboxView>('bookings');

  // Pre-populate consultation context from Supabase patient data.
  // Called fire-and-forget after patient identity is set; errors are non-fatal.
  const loadPatientContext = useCallback(async (patientId: string, apptType?: string) => {
    if (apptType) setVisitType(mapApptTypeToVisitType(apptType));
    const [pmhResult, encResult] = await Promise.all([
      loadPMH(patientId),
      getLatestOpenEncounter(patientId),
    ]);
    if (!pmhResult.error && pmhResult.conditions.length > 0) {
      setComorbidities(pmhResult.conditions);
    }
    if (!encResult.error && encResult.encounterId) {
      setEncounterId(encResult.encounterId);
      const encData = await loadEncounterData(encResult.encounterId, patientId);
      if (!encData.error && encData.data) {
        const d = encData.data;
        if (d.allergens.length) setAllergies(d.allergens.join(', '));
        if (d.medications.length) setMedications(d.medications);
        if (d.surgicalHistory.length) setSurgicalHistory(d.surgicalHistory);
        if (d.surgicalNotes) setSurgicalNotes(d.surgicalNotes);
        if (Object.keys(d.clinicalScores).length) setClinicalScores(d.clinicalScores);
        if (Object.keys(d.extractedLabs).length) setExtractedLabs(d.extractedLabs);
      }
    }
    // Non-blocking: prior closed encounter for follow-up baseline strip
    void getLatestClosedEncounter(patientId).then(({ data }) => {
      setPriorEncounterSummary(data);
    });
  }, [setVisitType, setComorbidities, setEncounterId, setAllergies, setMedications, setSurgicalHistory, setSurgicalNotes, setPriorEncounterSummary, setClinicalScores, setExtractedLabs]);

  const load = useCallback(async () => {
    try {
      const url = statusFilter
        ? apiUrl(`/api/booking/requests?status=${statusFilter}`)
        : apiUrl('/api/booking/requests');
      const r = await fetch(url, { headers: await staffAuthHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json() as { requests: BookingRequest[] };
      setRequests(d.requests ?? []);
      setDegradedRead(false);
      setError(null);
      setLastRefresh(new Date());
    } catch (apiErr) {
      // Fallback: query Supabase directly when the API server is unreachable
      if (supabase) {
        try {
          let query = supabase
            .from('appointment_requests')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(200);
          if (statusFilter) query = query.eq('status', statusFilter);
          const { data, error: sbErr } = await query;
          if (sbErr) throw sbErr;
          setRequests((data ?? []) as BookingRequest[]);
          setDegradedRead(true);
          setError(null);
          setLastRefresh(new Date());
          return;
        } catch {
          // Supabase fallback also failed — show original API error
        }
      }
      setError(errMsg(apiErr));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  // Supabase Realtime — live updates without waiting for the 30 s poll
  useEffect(() => {
    const sb = supabase;
    if (!sb) return;
    const channel = sb
      .channel('booking-inbox-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_requests' }, () => {
        void load();
      })
      .subscribe();
    return () => { void sb.removeChannel(channel); };
  }, [load]);

  // When a booking is selected, pre-fill location from its data and reset
  // any per-selection action state from the previously-viewed request
  useEffect(() => {
    if (selected) setConfirmLoc(resolveLocation(selected));
    setPortalOk(false);
    setPortalErr(null);
    setCheckInOk(false);
    setCheckInErr(null);
    setCheckedInEncounterId(null);
    setAcctStatus(null);
    setLinkSearchQ('');
    setLinkSearchResults([]);
    setLinkOk(false);
    setLinkErr(null);
    setShowLinkSearch(false);
  }, [selected?.id]);

  // Fetch account status whenever a booking with an email is selected
  useEffect(() => {
    if (!selected?.patient_email) return;
    setAcctStatus('loading');
    void (async () => {
      try {
        const r = await fetch(apiUrl(`/api/admin/patient-accounts?email=${encodeURIComponent(selected.patient_email!)}`), {
          headers: await staffAuthHeaders(),
        });
        const d = await r.json() as { accounts?: Array<{ id: string; patient_id: string | null; patient_name: string | null }> };
        const acct = d.accounts?.[0] ?? null;
        setAcctStatus(acct ? { id: acct.id, patient_id: acct.patient_id, patient_name: acct.patient_name } : 'not_found');
      } catch { setAcctStatus('not_found'); }
    })();
  }, [selected?.id, selected?.patient_email]);

  // Patient search debounce inside link panel
  useEffect(() => {
    if (!showLinkSearch) return;
    if (linkSearchQ.trim().length < 2) { setLinkSearchResults([]); return; }
    if (linkTimer.current) clearTimeout(linkTimer.current);
    linkTimer.current = setTimeout(async () => {
      setLinkSearching(true);
      try {
        const r = await fetch(apiUrl(`/api/patients/search?q=${encodeURIComponent(linkSearchQ.trim())}&limit=6`), {
          headers: await staffAuthHeaders(),
        });
        const d = await r.json() as { patients?: Array<{ id: string; full_name: string; mrn?: string; phone?: string }> };
        setLinkSearchResults(d.patients ?? []);
      } catch { setLinkSearchResults([]); }
      finally { setLinkSearching(false); }
    }, 300);
    return () => { if (linkTimer.current) clearTimeout(linkTimer.current); };
  }, [linkSearchQ, showLinkSearch]);

  async function handleLinkAccount(patientId: string) {
    if (typeof acctStatus !== 'object' || !acctStatus) return;
    setLinking(true);
    setLinkErr(null);
    try {
      const r = await fetch(apiUrl(`/api/admin/patient-accounts/${acctStatus.id}/link`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ patient_id: patientId }),
      });
      const d = await r.json() as { success?: boolean; patient_name?: string; error?: string };
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      setAcctStatus({ ...acctStatus, patient_id: patientId, patient_name: d.patient_name ?? null });
      setLinkOk(true);
      setShowLinkSearch(false);
    } catch (e) {
      setLinkErr(e instanceof Error ? e.message : 'Link failed');
    } finally {
      setLinking(false);
    }
  }

  async function handleCheckIn() {
    if (!selected) return;
    setCheckingIn(true);
    setCheckInErr(null);
    try {
      const r = await fetch(apiUrl(`/api/visit/check-in/${selected.id}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ site: resolveLocation(selected) }),
      });
      if (!r.ok) {
        const d = await r.json() as { error?: string };
        throw new Error(d.error ?? `HTTP ${r.status}`);
      }
      const d = await r.json() as { encounterId: string; patientId?: string };
      setCheckedInEncounterId(d.encounterId);
      setCheckInOk(true);
      await load();
      clearPatient();
      setPatientName(selected.patient_name);
      if (selected.patient_phone) setPhone(selected.patient_phone);
      if (d.patientId) {
        setPatientId(d.patientId);
        setEncounterId(d.encounterId);
        const apptType = resolveApptType(selected);
        setVisitType(mapApptTypeToVisitType(apptType));
        void loadPMH(d.patientId).then(r => {
          if (!r.error && r.conditions.length > 0) setComorbidities(r.conditions);
        });
      }
      setTopSection('consultation');
    } catch (e) {
      setCheckInErr(errMsg(e));
    } finally {
      setCheckingIn(false);
    }
  }

  const [degradedWrite, setDegradedWrite] = useState(false);
  const [degradedRead,  setDegradedRead]  = useState(false);

  async function handleConfirm() {
    if (!selected || !confirmDate) return;
    setSubmitting(true);
    setConfirmErr(null);
    setDegradedWrite(false);
    try {
      const confirmed_slot = `${confirmDate}T${confirmTime}:00`;
      const slotIso = new Date(confirmed_slot).toISOString();
      const r = await fetch(apiUrl(`/api/booking/staff-confirm/${selected.id}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({
          confirmed_slot: slotIso,
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
    } catch (apiErr) {
      if (supabase) {
        try {
          const { error: sbErr } = await supabase
            .from('appointment_requests')
            .update({
              status: 'staff_confirmed',
              confirmed_slot: new Date(`${confirmDate}T${confirmTime}:00`).toISOString(),
              staff_confirmed_at: new Date().toISOString(),
              notes: confirmNotes || null,
            })
            .eq('id', selected.id);
          if (sbErr) throw sbErr;
          setDegradedWrite(true);
          setConfirmOk(true);
          await load();
          setTimeout(() => {
            setConfirmOk(false);
            setDegradedWrite(false);
            setSelected(null);
            setConfirmDate('');
            setConfirmTime('09:00');
            setConfirmNotes('');
          }, 5000);
          return;
        } catch { /* Supabase fallback also failed */ }
      }
      setConfirmErr(errMsg(apiErr));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWaitlist() {
    if (!selected) return;
    setWaitlisting(true);
    setWaitlistErr(null);
    setDegradedWrite(false);
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
    } catch (apiErr) {
      if (supabase) {
        try {
          const { error: sbErr } = await supabase
            .from('appointment_requests')
            .update({ status: 'waitlisted', notes: confirmNotes || null })
            .eq('id', selected.id);
          if (sbErr) throw sbErr;
          setDegradedWrite(true);
          await load();
          setSelected(null);
          return;
        } catch { /* Supabase fallback also failed */ }
      }
      setWaitlistErr(errMsg(apiErr));
    } finally {
      setWaitlisting(false);
    }
  }

  async function handleCancel() {
    if (!selected) return;
    if (!window.confirm(`Cancel this booking request for ${selected.patient_name}?`)) return;
    setCancelling(true);
    setCancelErr(null);
    setDegradedWrite(false);
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
    } catch (apiErr) {
      if (supabase) {
        try {
          const { error: sbErr } = await supabase
            .from('appointment_requests')
            .update({ status: 'cancelled', notes: 'Cancelled by staff' })
            .eq('id', selected.id);
          if (sbErr) throw sbErr;
          setDegradedWrite(true);
          await load();
          setSelected(null);
          return;
        } catch { /* Supabase fallback also failed */ }
      }
      setCancelErr(errMsg(apiErr));
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
    setDegradedWrite(false);
    try {
      const r = await fetch(apiUrl('/api/booking/request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_name:     nrName.trim(),
          patient_email:    nrEmail.trim() || null,
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
        setNrType('consultation'); setNrLocation(currentSite);
        setNrSlot(''); setNrReason(''); setNrSource('manual');
      }, 2000);
    } catch (apiErr) {
      if (supabase) {
        try {
          const { error: sbErr } = await supabase
            .from('appointment_requests')
            .insert({
              patient_name:     nrName.trim(),
              patient_email:    nrEmail.trim() || null,
              patient_phone:    nrPhone.trim() || null,
              appointment_type: nrType,
              location:         nrLocation,
              preferred_slot:   nrSlot.trim() || null,
              reason:           nrReason.trim() || null,
              source:           nrSource,
              status:           'pending',
            });
          if (sbErr) throw sbErr;
          setDegradedWrite(true);
          setNrOk(true);
          await load();
          setTimeout(() => {
            setShowNewRequest(false);
            setNrOk(false);
            setDegradedWrite(false);
            setNrName(''); setNrPhone(''); setNrEmail('');
            setNrType('consultation'); setNrLocation(currentSite);
            setNrSlot(''); setNrReason(''); setNrSource('manual');
          }, 4000);
          return;
        } catch { /* Supabase fallback also failed */ }
      }
      setNrErr(errMsg(apiErr));
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
    pending: 0, waitlisted: 1, staff_confirmed: 2, doctor_confirmed: 3, patient_confirmed: 4, lapsed: 5, cancelled: 6,
  };
  const sorted = [...requests].sort((a, b) => {
    const aUrgent = resolveTriageAcuity(a) === 'urgent' ? 0 : 1;
    const bUrgent = resolveTriageAcuity(b) === 'urgent' ? 0 : 1;
    if (aUrgent !== bUrgent) return aUrgent - bUrgent;

    const aProc = requiresPrep(resolveApptType(a)) ? 0 : 1;
    const bProc = requiresPrep(resolveApptType(b)) ? 0 : 1;
    if (aProc !== bProc) return aProc - bProc;

    const aAcuity = ACUITY_RANK[resolveTriageAcuity(a) ?? 'routine'] ?? ACUITY_RANK.routine;
    const bAcuity = ACUITY_RANK[resolveTriageAcuity(b) ?? 'routine'] ?? ACUITY_RANK.routine;
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

  const degradedBanner = (degradedRead || degradedWrite) ? (
    <div role="alert" style={{ padding: '10px 16px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, margin: '12px 20px 0', fontSize: 12, color: '#9a3412', fontWeight: 600 }}>
      {degradedWrite
        ? 'API server offline — changes saved directly to database. Patient SMS, email, and calendar updates were not sent — follow up manually.'
        : 'API server offline — showing data read directly from database. Confirm, waitlist, and cancel actions will not trigger SMS or calendar updates until the server recovers.'}
    </div>
  ) : null;

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
        width: (selected || showNewRequest) ? (narrow ? '100%' : 340) : '100%',
        maxWidth: (selected || showNewRequest) ? (narrow ? undefined : 340) : undefined,
        flexShrink: 0,
        borderRight: (selected || showNewRequest) && !narrow ? '1px solid #e5e7eb' : 'none',
        overflowY: 'auto',
        display: narrow && (selected || showNewRequest) ? 'none' : 'flex',
        flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Booking Requests</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                {pendingCount > 0
                  ? <span style={{ color: '#b45309', fontWeight: 600 }}>{pendingCount} pending action{pendingCount !== 1 ? 's' : ''}</span>
                  : 'All requests actioned'
                }
                {lastRefresh && (
                  <span style={{ marginLeft: 8, color: '#9ca3af', fontSize: 10 }}>
                    Updated {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
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
          <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
            {[
              { value: '', label: 'All' },
              { value: 'pending', label: 'Pending' },
              { value: 'waitlisted', label: 'Waitlisted' },
              { value: 'staff_confirmed', label: 'Needs Dr ✓' },
              { value: 'doctor_confirmed', label: 'Dr Confirmed' },
              { value: 'patient_confirmed', label: 'Patient OK' },
              { value: 'lapsed', label: 'Lapsed' },
              { value: 'cancelled', label: 'Cancelled' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                style={{
                  padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: statusFilter === opt.value ? '1px solid #0d9488' : '1px solid #e5e7eb',
                  background: statusFilter === opt.value ? '#ecfdf5' : '#fff',
                  color: statusFilter === opt.value ? '#0d9488' : '#6b7280',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
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
                    <span style={{ fontSize: 12, color: '#374151' }}>{apptLabel(resolveApptType(req))}</span>
                    <SourceBadge source={req.source} />
                    {requiresPrep(resolveApptType(req)) && (
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
                      <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 'auto' }}>{fmtPhone(req.patient_phone)}</span>
                    )}
                  </div>

                  {/* Preferred slot */}
                  {resolvePreferredSlot(req) && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                      Preferred: {resolvePreferredSlot(req)}
                    </div>
                  )}

                  {/* Dual-confirmation reminder */}
                  {req.status === 'staff_confirmed' && (
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#7c3aed', marginTop: 3 }}>
                      ⏳ Awaiting doctor sign-off before complete
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
          {narrow && (
            <button
              onClick={() => setShowNewRequest(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 0', marginBottom: 8, background: 'none', border: 'none', color: '#0d9488', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              ← Back to list
            </button>
          )}
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
                  onChange={e => setNrLocation(e.target.value as typeof currentSite)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1.5px solid #d1d5db', fontSize: 13, boxSizing: 'border-box' }}
                >
                  <option value="rodney_bay">Rodney Bay Clinic</option>
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
          {narrow && (
            <button
              onClick={() => setSelected(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 0', marginBottom: 8, background: 'none', border: 'none', color: '#0d9488', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              ← Back to list
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 4 }}>{selected.patient_name}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <StatusBadge status={selected.status} />
                <span style={{ fontSize: 12, color: '#6b7280' }}>Submitted {timeAgo(selected.created_at)}</span>
                {resolveTriageAcuity(selected) && resolveTriageAcuity(selected) !== 'routine' && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                    background: resolveTriageAcuity(selected) === 'urgent' ? '#fef2f2' : '#fff7ed',
                    color: resolveTriageAcuity(selected) === 'urgent' ? '#dc2626' : '#c2410c',
                    border: `1px solid ${resolveTriageAcuity(selected) === 'urgent' ? '#fecaca' : '#fed7aa'}`,
                  }}>
                    {(resolveTriageAcuity(selected) ?? '').toUpperCase()}
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
              { label: 'Phone',       value: fmtPhone(selected.patient_phone) || null },
              { label: 'Appointment', value: apptLabel(resolveApptType(selected)) },
              { label: 'Location',    value: LOCATION_LABELS[resolveLocation(selected)] ?? resolveLocation(selected) },
              { label: 'Preferred slot', value: resolvePreferredSlot(selected) ?? 'No preference' },
              { label: 'Triage acuity', value: resolveTriageAcuity(selected) ?? 'Not assessed' },
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
          {requiresPrep(resolveApptType(selected)) && (
            <div style={{ marginBottom: 16, padding: '12px 14px', borderRadius: 8, background: '#fff7ed', border: '1px solid #fed7aa' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#c2410c', marginBottom: 6 }}>
                ⚠ Procedure Preparation Required — {apptLabel(resolveApptType(selected))}
              </div>
              <div style={{ fontSize: 12, color: '#7c2d12', lineHeight: 1.6 }}>
                {PREP_INSTRUCTIONS[resolveApptType(selected).toLowerCase()] ?? 'See procedure prep guidelines.'}
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
                Patient will receive a confirmation SMS with slot details{requiresPrep(resolveApptType(selected)) ? ' and preparation instructions' : ''}.
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
              <div style={{ fontSize: 12, color: '#1d4ed8', marginTop: 4 }}>{LOCATION_LABELS[resolveLocation(selected)] ?? resolveLocation(selected)}</div>
              {selected.notes && <div style={{ fontSize: 12, color: '#374151', marginTop: 6, fontStyle: 'italic' }}>{selected.notes}</div>}
            </div>
          )}

          {/* ── Check In Patient ─────────────────────────────────────────── */}
          {['doctor_confirmed', 'patient_confirmed', 'staff_confirmed'].includes(selected.status) && !checkInOk && (
            <div style={{ marginBottom: 20, padding: '16px', borderRadius: 10, background: '#fff', border: '2px solid #0d9488' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f766e', marginBottom: 6 }}>
                Patient Arrived — Check In
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, lineHeight: 1.5 }}>
                Creates an encounter and opens the patient chart. If this is a new patient, a chart record will be created automatically.
              </div>
              {checkInErr && (
                <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12 }}>
                  {checkInErr}
                </div>
              )}
              <button
                onClick={() => void handleCheckIn()}
                disabled={checkingIn}
                style={{
                  width: '100%', padding: '12px', borderRadius: 8, border: 'none',
                  background: checkingIn ? '#9ca3af' : '#0d9488',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                  cursor: checkingIn ? 'not-allowed' : 'pointer',
                  transition: 'background .15s',
                }}
              >
                {checkingIn ? 'Checking in…' : `Check In ${selected.patient_name.split(' ')[0]} →`}
              </button>
            </div>
          )}
          {checkInOk && (
            <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 10, background: '#f0fdf4', border: '2px solid #16a34a' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 4 }}>
                ✓ Patient checked in — chart is open in Consultation
              </div>
              {checkedInEncounterId && (
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>Encounter ID: {checkedInEncounterId}</div>
              )}
            </div>
          )}

          {/* Doctor sign-off — for staff_confirmed bookings awaiting doctor review */}
          {selected.status === 'staff_confirmed' && (
            <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 10, background: '#faf5ff', border: '1.5px solid #c4b5fd' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#5b21b6', marginBottom: 6 }}>
                Doctor Sign-off Required
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10, lineHeight: 1.5 }}>
                Front desk has confirmed the slot. Please review and approve to complete the booking. The patient will remain on the scheduling reminder until you sign off.
              </div>
              <button
                onClick={async () => {
                  if (!selected) return;
                  try {
                    await fetch(apiUrl(`/api/booking/staff-confirm/${selected.id}`), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
                      body: JSON.stringify({ confirmed_slot: selected.confirmed_slot, notes: (selected.notes ?? '') + ' [Doctor reviewed]', status_override: 'doctor_confirmed' }),
                    });
                  } catch { /* degraded mode */ }
                  if (supabase) {
                    try { await supabase.from('appointment_requests').update({ status: 'doctor_confirmed' }).eq('id', selected.id); } catch { /* ignore */ }
                  }
                  await load();
                  setSelected(null);
                }}
                style={{
                  width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                  background: '#7c3aed', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                ✓ Doctor Sign-off — Approve Schedule
              </button>
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

          {/* ── Patient account link ─────────────────────────────────── */}
          {selected.patient_email && acctStatus !== null && acctStatus !== 'loading' && (
            <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 10, background: '#fff', border: '2px solid #e5e7eb' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                Patient Portal Account
              </div>
              {acctStatus === 'not_found' ? (
                <div style={{ fontSize: 12, color: '#6b7280' }}>
                  No portal account for <strong>{selected.patient_email}</strong> yet.
                  Use "Send Access" above to create one.
                </div>
              ) : (
                <>
                  {linkOk && (
                    <div style={{ marginBottom: 8, padding: '6px 10px', borderRadius: 6, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', fontSize: 12, fontWeight: 600 }}>
                      ✓ Account linked to {acctStatus.patient_name}
                    </div>
                  )}
                  {!linkOk && (
                    <div style={{ fontSize: 12, color: '#374151', marginBottom: 10 }}>
                      Account: <strong>{selected.patient_email}</strong>
                      {acctStatus.patient_name ? (
                        <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 99, background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', fontWeight: 700, fontSize: 11 }}>
                          ✓ Linked — {acctStatus.patient_name}
                        </span>
                      ) : (
                        <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 99, background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', fontWeight: 700, fontSize: 11 }}>
                          Not linked to a patient record
                        </span>
                      )}
                    </div>
                  )}
                  {!acctStatus.patient_name && !linkOk && (
                    <>
                      <button
                        onClick={() => setShowLinkSearch(s => !s)}
                        style={{
                          padding: '7px 14px', borderRadius: 7, border: '1px solid #0d9488',
                          background: showLinkSearch ? '#0d9488' : 'transparent',
                          color: showLinkSearch ? '#fff' : '#0d9488',
                          fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        {showLinkSearch ? '✕ Cancel' : 'Link to patient record →'}
                      </button>
                      {showLinkSearch && (
                        <div style={{ marginTop: 10 }}>
                          <input
                            type="text"
                            placeholder="Search by name, phone, or MRN…"
                            value={linkSearchQ}
                            onChange={e => setLinkSearchQ(e.target.value)}
                            autoFocus
                            style={{ width: '100%', padding: '8px 12px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 6 }}
                          />
                          {linkErr && (
                            <div style={{ padding: '6px 10px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', fontSize: 12, marginBottom: 6 }}>
                              {linkErr}
                            </div>
                          )}
                          {linkSearching && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Searching…</div>}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {linkSearchResults.map(p => (
                              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 7, background: '#f9fafb', border: '1px solid #e5e7eb' }}>
                                <div>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{p.full_name}</span>
                                  {p.mrn && <span style={{ fontSize: 11, color: '#0d9488', marginLeft: 8 }}>{p.mrn}</span>}
                                  {p.phone && <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>{p.phone}</span>}
                                </div>
                                <button
                                  onClick={() => void handleLinkAccount(p.id)}
                                  disabled={linking}
                                  style={{ padding: '4px 12px', borderRadius: 6, border: 'none', background: '#0d9488', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: linking ? 0.6 : 1 }}
                                >
                                  {linking ? '…' : 'Link'}
                                </button>
                              </div>
                            ))}
                          </div>
                          {!linkSearching && linkSearchQ.trim().length >= 2 && linkSearchResults.length === 0 && (
                            <div style={{ fontSize: 12, color: '#9ca3af' }}>No patients found</div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
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
                <AuditRow label="Prep SMS sent" value={selected.prep_sms_sent === true ? 'Yes' : 'Not yet'} />
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
        <button
          onClick={() => { setTodayQueue(loadTodayQueue()); setView('today_queue'); }}
          style={TAB_STYLE(view === 'today_queue')}
        >
          Today's Queue{todayQueue.length > 0 ? ` (${todayQueue.length})` : ''}
        </button>
        <button onClick={() => setView('consult_requests')} style={TAB_STYLE(view === 'consult_requests')}>
          Public Enquiries
        </button>
      </div>
      {degradedBanner}
      {view === 'consult_requests' ? (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <ConsultationRequestsView />
        </div>
      ) : view === 'today_queue' ? (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#111827' }}>Walk-in Queue — Today</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                Patients checked in by front desk · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>
            <button
              onClick={() => setTodayQueue(loadTodayQueue())}
              style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', color: '#6b7280', cursor: 'pointer' }}
            >
              ↻ Refresh
            </button>
          </div>
          {todayQueue.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af', fontSize: 13 }}>
              No walk-in patients checked in yet today.<br />
              <span style={{ fontSize: 12 }}>Use the Intake tab → Check in &amp; Queue to add patients.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {todayQueue.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 10,
                    background: '#fff', border: '1px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  {/* Position badge */}
                  <div style={{
                    flexShrink: 0, width: 32, height: 32, borderRadius: '50%',
                    background: '#0d948820', border: '2px solid #0d9488',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 800, color: '#0d9488',
                  }}>
                    {i + 1}
                  </div>
                  {/* Patient info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{p.full_name}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                      {p.sex ? p.sex.charAt(0).toUpperCase() + p.sex.slice(1) : ''}
                      {p.age ? ` · ${p.age}y` : ''}
                      {p.dob ? ` · DOB ${new Date(p.dob).toLocaleDateString('en-GB')}` : ''}
                      {p.phone ? ` · ${p.phone}` : ''}
                      {p.savedAt ? ` · Checked in ${new Date(p.savedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </div>
                  </div>
                  {/* Open consultation button */}
                  <button
                    type="button"
                    onClick={() => {
                      clearPatient();
                      setPatientName(p.full_name);
                      if (p.dob) {
                        setDob(p.dob);
                        const dob = new Date(p.dob);
                        const today = new Date();
                        let a = today.getFullYear() - dob.getFullYear();
                        const m = today.getMonth() - dob.getMonth();
                        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) a--;
                        setAge(String(a));
                      } else if (p.age) {
                        setAge(p.age);
                      }
                      if (p.sex) setSex(p.sex as Parameters<typeof setSex>[0]);
                      if (p.phone) setPhone(p.phone);
                      setPatientId(p.id);
                      setTopSection('consultation');
                      void loadPatientContext(p.id);
                    }}
                    style={{
                      flexShrink: 0, padding: '7px 14px', borderRadius: 7,
                      border: 'none', cursor: 'pointer',
                      background: '#0d9488', color: '#fff',
                      fontSize: 12, fontWeight: 700,
                    }}
                  >
                    Open → Consultation
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {bookingsContent}
        </div>
      )}
    </div>
  );
}
