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
  castries: 'Castries',
  tapion: 'Tapion',
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

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid var(--line)',
  marginBottom: 8,
  background: '#fafcfb',
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

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: 'var(--accent)',
  color: '#fff',
};

const btnDanger: React.CSSProperties = {
  ...btnBase,
  background: '#b91c1c',
  color: '#fff',
};

const btnSecondary: React.CSSProperties = {
  ...btnBase,
  background: '#e2e8f0',
  color: '#334155',
};

const btnSuccess: React.CSSProperties = {
  ...btnBase,
  background: '#15803d',
  color: '#fff',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--muted)',
  marginBottom: 4,
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid var(--line)',
  fontSize: 13,
  background: '#fff',
  color: 'var(--ink)',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 70,
  resize: 'vertical',
};

const emptyStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--muted)',
  fontStyle: 'italic',
  padding: '12px 0',
};

const statusChipStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

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

  // ── Fetch open encounters ──────────────────────────────────────────────────

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

  // ── Fetch confirmed appointments ───────────────────────────────────────────

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

  // ── Clear success message after a few seconds ──────────────────────────────

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);

  // ── Actions ────────────────────────────────────────────────────────────────

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
      // Complete the encounter
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

      // Submit medication reconciliation if any were entered
      const medText = completeForm.medications.trim();
      if (medText) {
        const medications = medText
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean)
          .map(line => {
            const parts = line.split(/\s*[-,]\s*/);
            return {
              drugName: parts[0] ?? line,
              dose: parts[1] ?? null,
              frequency: parts[2] ?? null,
            };
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '4px 0', maxWidth: 960 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
        Visit Lifecycle
      </h2>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
        Check in patients, complete visits, and manage no-shows.
      </p>

      {/* Success banner */}
      {successMsg && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16,
          background: '#f0fdf4', border: '1px solid #86efac', color: '#166534',
          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>&#10003;</span> {successMsg}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16,
          background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
          fontSize: 13, fontWeight: 600,
        }}>
          {error}
        </div>
      )}

      {/* ── Today's Appointments ───────────────────────────────────────────── */}
      <div style={panelStyle}>
        <div style={headingStyle}>Today's Appointments -- Confirmed</div>

        {loadingAppointments ? (
          <div style={emptyStyle}>Loading appointments...</div>
        ) : appointments.length === 0 ? (
          <div style={emptyStyle}>No confirmed appointments awaiting check-in.</div>
        ) : (
          appointments.map(appt => (
            <div key={appt.id} style={rowStyle}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                  {appt.patient_name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {apptLabel(appt.appointment_type)}
                  {appt.location ? ` -- ${SITE_LABELS[appt.location] ?? appt.location}` : ''}
                </div>
                {appt.reason && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {appt.reason}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {appt.confirmed_slot ? fmtSlot(appt.confirmed_slot) : 'No slot confirmed'}
                </div>
              </div>
              <span style={{
                ...statusChipStyle,
                background: '#f0fdf4',
                color: '#15803d',
                border: '1px solid #86efac',
              }}>
                Confirmed
              </span>
              <button
                style={btnPrimary}
                disabled={actionLoading === appt.id}
                onClick={() => void handleCheckIn(appt.id)}
              >
                {actionLoading === appt.id ? 'Checking in...' : 'Check In'}
              </button>
              <button
                style={btnDanger}
                disabled={actionLoading === appt.id}
                onClick={() => void handleNoShow(appt.id)}
              >
                No Show
              </button>
            </div>
          ))
        )}
      </div>

      {/* ── Open Encounters ────────────────────────────────────────────────── */}
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
                <div style={rowStyle}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                      {enc.chief_complaint ?? 'No chief complaint'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {enc.encounter_type}
                      {enc.site ? ` -- ${SITE_LABELS[enc.site] ?? enc.site}` : ''}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      Opened {timeAgo(enc.encounter_date)}
                      {' '}&middot;{' '}
                      <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{enc.id.slice(0, 8)}</span>
                    </div>
                  </div>
                  <span style={{
                    ...statusChipStyle,
                    background: enc.status === 'open' ? '#eff6ff' : '#fffbeb',
                    color: enc.status === 'open' ? '#1d4ed8' : '#b45309',
                    border: `1px solid ${enc.status === 'open' ? '#93c5fd' : '#fcd34d'}`,
                  }}>
                    {enc.status}
                  </span>
                  <button
                    style={btnSuccess}
                    disabled={actionLoading === enc.id}
                    onClick={() => {
                      if (isExpanded) {
                        setCompleteForm(null);
                      } else {
                        setCompleteForm({
                          encounterId: enc.id,
                          description: '',
                          followUpDate: '',
                          followUpNotes: '',
                          referralTo: '',
                          referralSpecialty: '',
                          referralReason: '',
                          medications: '',
                        });
                      }
                    }}
                  >
                    {isExpanded ? 'Cancel' : 'Complete Visit'}
                  </button>
                </div>

                {/* ── Complete Visit Form ── */}
                {isExpanded && completeForm && (
                  <div style={{
                    border: '1px solid var(--accent)',
                    borderRadius: 8,
                    padding: 16,
                    marginTop: -4,
                    background: '#f0f6f4',
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
                          onChange={e =>
                            setCompleteForm(f => f ? { ...f, description: e.target.value } : f)
                          }
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Follow-up Date</label>
                        <input
                          type="date"
                          style={inputStyle}
                          value={completeForm.followUpDate}
                          onChange={e =>
                            setCompleteForm(f => f ? { ...f, followUpDate: e.target.value } : f)
                          }
                        />
                      </div>

                      <div>
                        <label style={labelStyle}>Follow-up Notes</label>
                        <input
                          type="text"
                          style={inputStyle}
                          placeholder="e.g. Review wound healing"
                          value={completeForm.followUpNotes}
                          onChange={e =>
                            setCompleteForm(f => f ? { ...f, followUpNotes: e.target.value } : f)
                          }
                        />
                      </div>
                    </div>

                    {/* Referral section */}
                    <div style={{
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: 8,
                    }}>
                      Referral (optional)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
                      <div>
                        <label style={labelStyle}>Refer To</label>
                        <input
                          type="text"
                          style={inputStyle}
                          placeholder="Provider name"
                          value={completeForm.referralTo}
                          onChange={e =>
                            setCompleteForm(f => f ? { ...f, referralTo: e.target.value } : f)
                          }
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Specialty</label>
                        <input
                          type="text"
                          style={inputStyle}
                          placeholder="e.g. Gastroenterology"
                          value={completeForm.referralSpecialty}
                          onChange={e =>
                            setCompleteForm(f => f ? { ...f, referralSpecialty: e.target.value } : f)
                          }
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Reason</label>
                        <input
                          type="text"
                          style={inputStyle}
                          placeholder="Reason for referral"
                          value={completeForm.referralReason}
                          onChange={e =>
                            setCompleteForm(f => f ? { ...f, referralReason: e.target.value } : f)
                          }
                        />
                      </div>
                    </div>

                    {/* Medication reconciliation */}
                    <div style={{
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: 8,
                    }}>
                      Medication Reconciliation
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={labelStyle}>
                        Current Medications (one per line: Drug - Dose - Frequency)
                      </label>
                      <textarea
                        style={{ ...textareaStyle, minHeight: 90 }}
                        placeholder={'Metformin - 500mg - twice daily\nAmlodipine - 5mg - once daily'}
                        value={completeForm.medications}
                        onChange={e =>
                          setCompleteForm(f => f ? { ...f, medications: e.target.value } : f)
                        }
                      />
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        style={btnSuccess}
                        disabled={actionLoading === enc.id}
                        onClick={() => void handleCompleteVisit()}
                      >
                        {actionLoading === enc.id ? 'Saving...' : 'Close Encounter'}
                      </button>
                      <button
                        style={btnSecondary}
                        onClick={() => setCompleteForm(null)}
                      >
                        Cancel
                      </button>
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
