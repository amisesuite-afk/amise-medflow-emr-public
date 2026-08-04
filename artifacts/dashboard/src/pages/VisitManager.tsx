import { useState, useEffect, useCallback } from 'react';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { errMsg } from '@/lib/err';

// ── Types ────────────────────────────────────────────────────────────────────

interface OpenEncounter {
  id: string;
  patient_id: string | null;
  encounter_date: string;
  encounter_type: string;
  visit_type: string | null;
  chief_complaint: string | null;
  status: string;
  site: string | null;
}

interface BookingRequest {
  id: string;
  patient_name: string;
  patient_email: string | null;
  patient_phone: string | null;
  appointment_type: string;
  location: string;
  preferred_slot: string | null;
  reason: string | null;
  status: string;
  confirmed_slot: string | null;
  created_at: string;
}

interface CompleteForm {
  encounterId: string;
  description: string;
  followUpDate: string;
  followUpNotes: string;
  referralTo: string;
  referralSpecialty: string;
  referralReason: string;
  medications: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

const SITE_LABELS: Record<string, string> = {
  rodney_bay: 'Rodney Bay',
  tapion: 'Tapion',
};

const SITE_ICON: Record<string, string> = {
  rodney_bay: '🏢',
  tapion: '🏥',
};

/** Map encounter_type (care setting) to icon + label */
const ENC_TYPE_META: Record<string, { icon: string; label: string }> = {
  outpatient:       { icon: '🩺', label: 'Outpatient'   },
  inpatient:        { icon: '🛏',  label: 'Inpatient'    },
  endoscopy:        { icon: '🔬', label: 'Endoscopy'    },
  quick_consult:    { icon: '⚡',  label: 'Quick Consult' },
  surgical_consult: { icon: '✂️', label: 'Surgical'     },
  major_emergency:  { icon: '🚨', label: 'Emergency'    },
};

/** Map visit_type key to icon + label */
const VISIT_TYPE_META: Record<string, { icon: string; label: string; color: string }> = {
  new_consult:      { icon: '🩺', label: 'First Consult',   color: '#0ea5e9' },
  follow_up:        { icon: '🔄', label: 'Follow-up',        color: '#8b5cf6' },
  post_op:          { icon: '✂️', label: 'Post-op Review',  color: '#f97316' },
  day_of_surgery:   { icon: '🏥', label: 'Day of Surgery',   color: '#ef4444' },
  ercp:             { icon: '🔬', label: 'ERCP',             color: '#6366f1' },
  endoscopy_ogd:    { icon: '🔭', label: 'OGD',              color: '#6366f1' },
  endoscopy_col:    { icon: '🔭', label: 'Colonoscopy',      color: '#6366f1' },
  breast:           { icon: '🎗️', label: 'Breast Clinic',   color: '#ec4899' },
  telephone:        { icon: '📞', label: 'Telephone',        color: '#14b8a6' },
  diabetic_foot:    { icon: '🦶', label: 'Diabetic Foot',   color: '#f59e0b' },
  urgent:           { icon: '🚨', label: 'Urgent',           color: '#dc2626' },
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-LC', {
    timeZone: 'America/St_Lucia',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function fmtSlot(iso: string): string {
  return new Date(iso).toLocaleString('en-LC', {
    timeZone: 'America/St_Lucia',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function apptLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Amber stripe for open/in-progress, green for complete */
function statusBorderColor(status: string): string {
  if (status === 'open' || status === 'in_progress') return '#f59e0b';
  if (status === 'complete' || status === 'closed') return '#22c55e';
  return '#cbd5e1';
}

function statusBg(status: string): string {
  if (status === 'open' || status === 'in_progress') return '#fffbeb';
  if (status === 'complete' || status === 'closed') return '#f0fdf4';
  return 'var(--card)';
}

// ── Styles ───────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--line)',
  borderRadius: 10,
  padding: 20,
  marginBottom: 20,
};

const headingStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--accent)',
  marginBottom: 14,
};

const btnBase: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 6,
  border: 'none',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const btnPrimary: React.CSSProperties   = { ...btnBase, background: 'var(--accent)', color: '#fff' };
const btnDanger: React.CSSProperties    = { ...btnBase, background: '#b91c1c', color: '#fff' };
const btnSecondary: React.CSSProperties = { ...btnBase, background: '#e2e8f0', color: '#334155' };
const btnSuccess: React.CSSProperties   = { ...btnBase, background: '#15803d', color: '#fff' };

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 4, display: 'block',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 6,
  border: '1px solid var(--line)', fontSize: 13, background: '#fff', color: 'var(--ink)',
};

const textareaStyle: React.CSSProperties = { ...inputStyle, minHeight: 70, resize: 'vertical' };

const emptyStyle: React.CSSProperties = {
  fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', padding: '12px 0',
};

const statusChipStyle: React.CSSProperties = {
  display: 'inline-block', padding: '2px 8px', borderRadius: 4,
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
};

// ── Sub-components ───────────────────────────────────────────────────────────

function EncounterRow({
  enc,
  isExpanded,
  onToggle,
  actionLoading,
}: {
  enc: OpenEncounter;
  isExpanded: boolean;
  onToggle: () => void;
  actionLoading: string | null;
}) {
  const vtMeta = enc.visit_type ? VISIT_TYPE_META[enc.visit_type] : null;
  const etMeta = ENC_TYPE_META[enc.encounter_type] ?? { icon: '🩺', label: enc.encounter_type };
  const borderColor = statusBorderColor(enc.status);
  const bg = statusBg(enc.status);
  const isOpen = enc.status === 'open' || enc.status === 'in_progress';

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 14px',
      borderRadius: 8,
      border: '1px solid var(--line)',
      borderLeft: `4px solid ${borderColor}`,
      marginBottom: 8,
      background: bg,
    }}>
      {/* Visit type / encounter type icon */}
      <div style={{
        fontSize: 22, lineHeight: 1, flexShrink: 0, paddingTop: 2,
        width: 32, textAlign: 'center',
      }}>
        {vtMeta?.icon ?? etMeta.icon}
      </div>

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Top row: visit type chip + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
          {vtMeta ? (
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
              padding: '1px 7px', borderRadius: 4,
              background: `${vtMeta.color}18`, color: vtMeta.color,
              border: `1px solid ${vtMeta.color}44`,
            }}>
              {vtMeta.icon} {vtMeta.label}
            </span>
          ) : (
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
              padding: '1px 7px', borderRadius: 4,
              background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1',
            }}>
              {etMeta.icon} {etMeta.label}
            </span>
          )}
          <span style={{
            ...statusChipStyle,
            background: isOpen ? '#fffbeb' : '#f0fdf4',
            color: isOpen ? '#b45309' : '#15803d',
            border: `1px solid ${isOpen ? '#fcd34d' : '#86efac'}`,
          }}>
            {isOpen ? '⏳ ' : '✓ '}{enc.status}
          </span>
        </div>

        {/* Chief complaint */}
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
          {enc.chief_complaint ?? 'No chief complaint recorded'}
        </div>

        {/* Date + time + location row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 11, color: 'var(--muted)' }}>
          <span>🕐 {fmtDateTime(enc.encounter_date)}</span>
          <span style={{ color: '#94a3b8' }}>·</span>
          <span style={{ color: isOpen ? '#b45309' : '#64748b' }}>{timeAgo(enc.encounter_date)}</span>
          {enc.site && (
            <>
              <span style={{ color: '#94a3b8' }}>·</span>
              <span>{SITE_ICON[enc.site] ?? '📍'} {SITE_LABELS[enc.site] ?? enc.site}</span>
            </>
          )}
          <span style={{ color: '#94a3b8' }}>·</span>
          <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{enc.id.slice(0, 8)}</span>
        </div>
      </div>

      {/* Complete button */}
      {isOpen && (
        <button
          style={{
            ...btnSuccess,
            background: isExpanded ? '#6b7280' : '#15803d',
          }}
          disabled={actionLoading === enc.id}
          onClick={onToggle}
        >
          {isExpanded ? 'Cancel' : 'Complete Visit'}
        </button>
      )}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function VisitManagerTab() {
  const [encounters, setEncounters] = useState<OpenEncounter[]>([]);
  const [appointments, setAppointments] = useState<BookingRequest[]>([]);
  const [loadingEncounters, setLoadingEncounters] = useState(true);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [completeForm, setCompleteForm] = useState<CompleteForm | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchEncounters = useCallback(async () => {
    setLoadingEncounters(true);
    try {
      const r = await fetch(apiUrl('/api/visit/open-encounters'), {
        headers: await staffAuthHeaders(),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as { encounters: OpenEncounter[] };
      setEncounters(d.encounters ?? []);
    } catch (e) {
      console.error('[visit-manager] fetch encounters error:', e);
    } finally {
      setLoadingEncounters(false);
    }
  }, []);

  const fetchAppointments = useCallback(async () => {
    setLoadingAppointments(true);
    try {
      const r = await fetch(apiUrl('/api/booking/requests?status=patient_confirmed'), {
        headers: await staffAuthHeaders(),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as { requests: BookingRequest[] };
      setAppointments(d.requests ?? []);
    } catch (e) {
      console.error('[visit-manager] fetch appointments error:', e);
    } finally {
      setLoadingAppointments(false);
    }
  }, []);

  useEffect(() => {
    void fetchEncounters();
    void fetchAppointments();
    const t = setInterval(() => {
      void fetchEncounters();
      void fetchAppointments();
    }, 30_000);
    return () => clearInterval(t);
  }, [fetchEncounters, fetchAppointments]);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);

  async function handleCheckIn(appointmentId: string) {
    setActionLoading(appointmentId);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/visit/check-in/${appointmentId}`), {
        method: 'POST',
        headers: { ...(await staffAuthHeaders()), 'Content-Type': 'application/json' },
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${r.status}`);
      }
      setSuccessMsg('Patient checked in successfully');
      void fetchEncounters();
      void fetchAppointments();
    } catch (e) {
      setError(`Check-in failed: ${errMsg(e)}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleNoShow(appointmentId: string) {
    if (!confirm('Mark this appointment as no-show?')) return;
    setActionLoading(appointmentId);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/visit/no-show/${appointmentId}`), {
        method: 'POST',
        headers: { ...(await staffAuthHeaders()), 'Content-Type': 'application/json' },
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${r.status}`);
      }
      setSuccessMsg('Appointment marked as no-show');
      void fetchEncounters();
      void fetchAppointments();
    } catch (e) {
      setError(`No-show failed: ${errMsg(e)}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCompleteVisit() {
    if (!completeForm) return;
    setActionLoading(completeForm.encounterId);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        planType: 'management',
        description: completeForm.description || undefined,
        followUpDate: completeForm.followUpDate || undefined,
        followUpNotes: completeForm.followUpNotes || undefined,
      };
      if (completeForm.referralTo) {
        body.referralTo = completeForm.referralTo;
        body.referralSpecialty = completeForm.referralSpecialty || undefined;
        body.referralReason = completeForm.referralReason || undefined;
      }

      const r = await fetch(apiUrl(`/api/visit/complete/${completeForm.encounterId}`), {
        method: 'POST',
        headers: { ...(await staffAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const respBody = await r.json().catch(() => ({}));
        throw new Error((respBody as { error?: string }).error ?? `HTTP ${r.status}`);
      }

      const medText = completeForm.medications.trim();
      if (medText) {
        const medications = medText
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            const parts = line.split(/\s*[-,]\s*/);
            return { drugName: parts[0] ?? line, dose: parts[1] ?? null, frequency: parts[2] ?? null };
          });
        if (medications.length > 0) {
          await fetch(apiUrl(`/api/visit/medication-reconciliation/${completeForm.encounterId}`), {
            method: 'POST',
            headers: { ...(await staffAuthHeaders()), 'Content-Type': 'application/json' },
            body: JSON.stringify({ medications }),
          });
        }
      }

      setSuccessMsg('Visit completed and encounter closed');
      setCompleteForm(null);
      void fetchEncounters();
    } catch (e) {
      setError(`Complete visit failed: ${errMsg(e)}`);
    } finally {
      setActionLoading(null);
    }
  }

  const openCount = encounters.filter(e => e.status === 'open' || e.status === 'in_progress').length;

  return (
    <div style={{ padding: '4px 0', maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>
          Visit Lifecycle
        </h2>
        {openCount > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
            background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d',
          }}>
            {openCount} open
          </span>
        )}
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
        Check in patients, complete visits, and manage no-shows.
        <span style={{ marginLeft: 12, color: '#f59e0b', fontWeight: 600 }}>🟡 Amber = open</span>
        <span style={{ marginLeft: 10, color: '#22c55e', fontWeight: 600 }}>🟢 Green = complete</span>
      </p>

      {successMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16,
          background: '#f0fdf4', border: '1px solid #86efac', color: '#166534',
          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>&#10003;</span> {successMsg}
        </div>
      )}

      {error && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16,
          background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
          fontSize: 13, fontWeight: 600,
        }}>
          {error}
        </div>
      )}

      {/* ── Today's Appointments ─────────────────────────────────────────────── */}
      <div style={panelStyle}>
        <div style={headingStyle}>Today's Appointments — Confirmed</div>

        {loadingAppointments ? (
          <div style={emptyStyle}>Loading appointments...</div>
        ) : appointments.length === 0 ? (
          <div style={emptyStyle}>No confirmed appointments awaiting check-in.</div>
        ) : (
          appointments.map(appt => (
            <div key={appt.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 8,
              border: '1px solid var(--line)', borderLeft: '4px solid #22c55e',
              marginBottom: 8, background: '#f0fdf4',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>
                  {appt.patient_name}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px', fontSize: 11, color: 'var(--muted)' }}>
                  <span>📋 {apptLabel(appt.appointment_type)}</span>
                  {appt.location && (
                    <span>{SITE_ICON[appt.location] ?? '📍'} {SITE_LABELS[appt.location] ?? appt.location}</span>
                  )}
                  {appt.confirmed_slot && (
                    <span>🕐 {fmtSlot(appt.confirmed_slot)}</span>
                  )}
                  {appt.reason && <span>· {appt.reason}</span>}
                </div>
              </div>
              <span style={{
                ...statusChipStyle, background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac',
              }}>
                Confirmed
              </span>
              <button style={btnPrimary} disabled={actionLoading === appt.id}
                onClick={() => void handleCheckIn(appt.id)}>
                {actionLoading === appt.id ? 'Checking in...' : 'Check In'}
              </button>
              <button style={btnDanger} disabled={actionLoading === appt.id}
                onClick={() => void handleNoShow(appt.id)}>
                No Show
              </button>
            </div>
          ))
        )}
      </div>

      {/* ── Open Encounters ──────────────────────────────────────────────────── */}
      <div style={panelStyle}>
        <div style={headingStyle}>Open Encounters</div>

        {loadingEncounters ? (
          <div style={emptyStyle}>Loading encounters...</div>
        ) : encounters.length === 0 ? (
          <div style={emptyStyle}>No open encounters.</div>
        ) : (
          encounters.map(enc => {
            const isExpanded = completeForm?.encounterId === enc.id;
            return (
              <div key={enc.id} style={{ marginBottom: 10 }}>
                <EncounterRow
                  enc={enc}
                  isExpanded={isExpanded}
                  onToggle={() => {
                    if (isExpanded) {
                      setCompleteForm(null);
                    } else {
                      setCompleteForm({
                        encounterId: enc.id,
                        description: '', followUpDate: '', followUpNotes: '',
                        referralTo: '', referralSpecialty: '', referralReason: '', medications: '',
                      });
                    }
                  }}
                  actionLoading={actionLoading}
                />

                {isExpanded && completeForm && (
                  <div style={{
                    border: '1px solid var(--accent)', borderRadius: 8,
                    padding: 16, marginTop: -4, background: '#f0f6f4',
                  }}>
                    <div style={{
                      fontSize: 12, fontWeight: 800, textTransform: 'uppercase',
                      letterSpacing: '0.05em', color: 'var(--accent)', marginBottom: 14,
                    }}>
                      Complete Visit
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Plan / Management Description</label>
                        <textarea
                          style={textareaStyle}
                          placeholder="Describe the plan..."
                          value={completeForm.description}
                          onChange={e => setCompleteForm(f => f ? { ...f, description: e.target.value } : f)}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Follow-up Date</label>
                        <input type="date" style={inputStyle}
                          value={completeForm.followUpDate}
                          onChange={e => setCompleteForm(f => f ? { ...f, followUpDate: e.target.value } : f)}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Follow-up Notes</label>
                        <input type="text" style={inputStyle}
                          placeholder="e.g. Review wound healing"
                          value={completeForm.followUpNotes}
                          onChange={e => setCompleteForm(f => f ? { ...f, followUpNotes: e.target.value } : f)}
                        />
                      </div>
                    </div>

                    <div style={{
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: 8,
                    }}>
                      Referral (optional)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                      <div>
                        <label style={labelStyle}>Refer To</label>
                        <input type="text" style={inputStyle} placeholder="Provider name"
                          value={completeForm.referralTo}
                          onChange={e => setCompleteForm(f => f ? { ...f, referralTo: e.target.value } : f)}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Specialty</label>
                        <input type="text" style={inputStyle} placeholder="e.g. Gastroenterology"
                          value={completeForm.referralSpecialty}
                          onChange={e => setCompleteForm(f => f ? { ...f, referralSpecialty: e.target.value } : f)}
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Reason</label>
                        <input type="text" style={inputStyle} placeholder="Reason for referral"
                          value={completeForm.referralReason}
                          onChange={e => setCompleteForm(f => f ? { ...f, referralReason: e.target.value } : f)}
                        />
                      </div>
                    </div>

                    <div style={{
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: 8,
                    }}>
                      Medication Reconciliation
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>Current Medications (one per line: Drug - Dose - Frequency)</label>
                      <textarea
                        style={{ ...textareaStyle, minHeight: 90 }}
                        placeholder={'Metformin - 500mg - twice daily\nAmlodipine - 5mg - once daily'}
                        value={completeForm.medications}
                        onChange={e => setCompleteForm(f => f ? { ...f, medications: e.target.value } : f)}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 10 }}>
                      <button style={btnSuccess} disabled={actionLoading === enc.id}
                        onClick={() => void handleCompleteVisit()}>
                        {actionLoading === enc.id ? 'Saving...' : 'Close Encounter'}
                      </button>
                      <button style={btnSecondary} onClick={() => setCompleteForm(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
