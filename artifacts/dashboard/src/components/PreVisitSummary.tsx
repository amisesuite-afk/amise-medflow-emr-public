import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { getApiOrigin } from '@/lib/api-origin';
import PatientLinkPanel from './PatientLinkPanel';

const API_ORIGIN = getApiOrigin();
function apiUrl(path: string) {
  if (API_ORIGIN) return `${API_ORIGIN}${path}`;
  return `${(import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')}${path}`;
}

interface PrevisitSubmission {
  id: string;
  patient_id: string;
  patient_token: string;
  status: 'pending' | 'submitted' | 'ai_processed' | 'loaded_to_emr';
  cc_complete: boolean;
  hpi_complete: boolean;
  pmh_complete: boolean;
  meds_complete: boolean;
  surgical_complete: boolean;
  allergies_complete: boolean;
  ros_complete: boolean;
  photos_complete: boolean;
  cc: string | null;
  photos: Array<{ url: string; context: string; uploaded_at: string }> | null;
  ai_formatted: AiFormatted | null;
  ai_processed_at: string | null;
  monitoring_updates: Array<{ type: string; data: Record<string, unknown>; submitted_at: string }> | null;
  submitted_at: string | null;
}

interface AiFormatted {
  cc: string;
  hpi: string;
  pmh: string[];
  medications: string[];
  surgical_history: string[];
  allergies: string;
  ros_positive: string[];
  ros_negative: string[];
  red_flags: string[];
  suggestions: string[];
  urgency: 'routine' | 'soon' | 'urgent' | 'emergency';
}

interface SectionFlag {
  key: keyof PrevisitSubmission;
  label: string;
}

const SECTIONS: SectionFlag[] = [
  { key: 'cc_complete', label: 'CC' },
  { key: 'hpi_complete', label: 'HPI' },
  { key: 'pmh_complete', label: 'PMH' },
  { key: 'meds_complete', label: 'Meds' },
  { key: 'surgical_complete', label: 'Surgical' },
  { key: 'allergies_complete', label: 'Allergies' },
  { key: 'ros_complete', label: 'ROS' },
  { key: 'photos_complete', label: 'Photos' },
];

const URGENCY_COLOURS: Record<string, string> = {
  routine: '#16a34a',
  soon: '#d97706',
  urgent: '#ea580c',
  emergency: '#dc2626',
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString('en-LC', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export default function PreVisitSummary({ patientId }: { patientId: string }) {
  const {
    setHpiNotes,
    setComorbidities,
    setAssessment,
    setFreeText,
    setAllergies,
    phone,
  } = useAppContext();

  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<PrevisitSubmission | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [formatted, setFormatted] = useState<AiFormatted | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [submissionRefreshKey, setSubmissionRefreshKey] = useState(0);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    setFetchError(null);
    setSubmission(null);
    (async () => {
      try {
        const r = await fetch(apiUrl(`/api/previsit/${patientId}`), {
          headers: await staffAuthHeaders(),
        });
        if (!r.ok) {
          const body = await r.json() as { error?: string };
          setFetchError(body.error ?? `HTTP ${r.status}`);
          return;
        }
        const body = await r.json() as { submission: PrevisitSubmission | null };
        setSubmission(body.submission);
        if (body.submission?.ai_formatted) {
          setFormatted(body.submission.ai_formatted);
        }
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : 'Network error');
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId, submissionRefreshKey]);

  async function handleAiFormat() {
    if (!submission) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const r = await fetch(apiUrl('/api/previsit/ai-format'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await staffAuthHeaders()) },
        body: JSON.stringify({ patientId, submissionId: submission.id }),
      });
      const body = await r.json().catch(() => { throw new Error(`HTTP ${r.status}`); }) as { formatted?: AiFormatted; error?: string };
      if (!r.ok) {
        setAiError(body.error ?? `HTTP ${r.status}`);
        return;
      }
      if (body.formatted) {
        setFormatted(body.formatted);
        setPreviewOpen(true);
        setSubmission(prev => prev ? { ...prev, status: 'ai_processed', ai_formatted: body.formatted! } : prev);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setAiLoading(false);
    }
  }

  function handleLoadToEmr() {
    if (!formatted) return;
    setHpiNotes(formatted.hpi ?? '');
    setComorbidities(formatted.pmh ?? []);
    setAssessment('');
    setFreeText(formatted.cc ?? '');
    setAllergies(formatted.allergies ?? '');
    setLoaded(true);
  }

  if (loading) {
    return (
      <div style={{ padding: '12px 0', color: '#6b7280', fontSize: 13 }}>
        Checking pre-visit data…
      </div>
    );
  }

  if (fetchError) {
    return (
      <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', fontSize: 12 }}>
        Pre-visit check failed: {fetchError}
      </div>
    );
  }

  if (!submission) {
    return (
      <PatientLinkPanel
        patientId={patientId}
        patientPhone={phone || undefined}
        onLinkGenerated={() => setSubmissionRefreshKey(k => k + 1)}
      />
    );
  }

  const missingSections = SECTIONS.filter(s => !submission[s.key]);

  return (
    <div style={{ background: '#fff', borderRadius: 10, border: '1.5px solid #e2e8f0', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#374151', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          Pre-Visit Data
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
            background: submission.status === 'ai_processed' || submission.status === 'loaded_to_emr'
              ? '#dcfce7' : submission.status === 'submitted' ? '#fef9c3' : '#f1f5f9',
            color: submission.status === 'ai_processed' || submission.status === 'loaded_to_emr'
              ? '#16a34a' : submission.status === 'submitted' ? '#92400e' : '#475569',
          }}>
            {submission.status.replace('_', ' ')}
          </span>
          {submission.submitted_at && (
            <span style={{ fontSize: 10, color: '#9ca3af' }}>{fmtTime(submission.submitted_at)}</span>
          )}
        </div>
      </div>

      {/* Section completion grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {SECTIONS.map(s => {
          const done = Boolean(submission[s.key]);
          return (
            <div
              key={s.key}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                background: done ? '#dcfce7' : '#fef2f2',
                color: done ? '#15803d' : '#b91c1c',
                border: `1px solid ${done ? '#bbf7d0' : '#fecaca'}`,
              }}
            >
              <span>{done ? '✓' : '✗'}</span>
              <span>{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* Missing alert */}
      {missingSections.length > 0 && (
        <div style={{ padding: '7px 12px', borderRadius: 7, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 12, fontWeight: 600 }}>
          Missing: {missingSections.map(s => s.label).join(', ')}
        </div>
      )}

      {/* Photo thumbnails */}
      {submission.photos && submission.photos.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {submission.photos.map((ph, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img
                src={ph.url}
                alt={ph.context}
                style={{ width: 56, height: 56, borderRadius: 7, objectFit: 'cover', border: '1.5px solid #e2e8f0' }}
              />
              <div style={{ position: 'absolute', bottom: 2, left: 0, right: 0, textAlign: 'center', fontSize: 8, fontWeight: 700, color: '#fff', background: 'rgba(0,0,0,0.45)', borderRadius: '0 0 6px 6px' }}>
                {ph.context}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Format button — shown when not yet processed */}
      {submission.status === 'submitted' && !formatted && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            type="button"
            onClick={() => void handleAiFormat()}
            disabled={aiLoading}
            style={{
              padding: '10px 18px', borderRadius: 8, border: 'none',
              background: aiLoading ? '#9ca3af' : '#0d9488',
              color: '#fff', fontWeight: 700, fontSize: 14,
              cursor: aiLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {aiLoading
              ? <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />Formatting…</>
              : '✦ AI Format & Load to EMR'
            }
          </button>
          {aiError && (
            <div style={{ fontSize: 12, color: '#dc2626' }}>Format failed: {aiError}</div>
          )}
        </div>
      )}

      {/* Re-format button for pending/already processed — gives staff option to re-run */}
      {submission.status !== 'submitted' && !formatted && (
        <button
          type="button"
          onClick={() => void handleAiFormat()}
          disabled={aiLoading}
          style={{
            alignSelf: 'flex-start', padding: '7px 14px', borderRadius: 7,
            border: '1.5px solid #0d9488', background: '#f0fdfa',
            color: '#0d9488', fontWeight: 600, fontSize: 12, cursor: 'pointer',
          }}
        >
          {aiLoading ? 'Formatting…' : '✦ AI Format'}
        </button>
      )}

      {/* Formatted data preview */}
      {formatted && (
        <div style={{ border: '1.5px solid #d1fae5', borderRadius: 8, background: '#f0fdf4', overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setPreviewOpen(p => !p)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', background: 'transparent', border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#15803d',
            }}
          >
            <span>AI-formatted clinical summary</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {formatted.urgency && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
                  background: URGENCY_COLOURS[formatted.urgency] ?? '#6b7280',
                  color: '#fff',
                }}>
                  {formatted.urgency}
                </span>
              )}
              <span style={{ fontSize: 11, color: '#6b7280' }}>{previewOpen ? '▲ collapse' : '▼ expand'}</span>
            </div>
          </button>

          {previewOpen && (
            <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

              {formatted.cc && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#374151', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>CC</div>
                  <div style={{ fontSize: 13, color: '#111827' }}>{formatted.cc}</div>
                </div>
              )}

              {formatted.hpi && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#374151', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>HPI</div>
                  <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>{formatted.hpi}</div>
                </div>
              )}

              {formatted.pmh && formatted.pmh.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#374151', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>PMH</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#374151' }}>
                    {formatted.pmh.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>
              )}

              {formatted.medications && formatted.medications.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#374151', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>Medications</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#374151' }}>
                    {formatted.medications.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                </div>
              )}

              {formatted.allergies && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#374151', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>Allergies</div>
                  <div style={{ fontSize: 12, color: '#374151' }}>{formatted.allergies}</div>
                </div>
              )}

              {formatted.red_flags && formatted.red_flags.length > 0 && (
                <div style={{ padding: '8px 12px', borderRadius: 7, background: '#fef2f2', border: '1px solid #fecaca' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#b91c1c', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Red Flags</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#b91c1c' }}>
                    {formatted.red_flags.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}

              {formatted.suggestions && formatted.suggestions.length > 0 && (
                <div style={{ padding: '8px 12px', borderRadius: 7, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#1d4ed8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Clinical Suggestions</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#1e40af' }}>
                    {formatted.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Load to EMR / Loaded confirmation */}
          <div style={{ padding: '0 14px 14px' }}>
            {loaded ? (
              <div style={{ padding: '9px 14px', borderRadius: 7, background: '#dcfce7', border: '1px solid #bbf7d0', color: '#15803d', fontSize: 13, fontWeight: 700, textAlign: 'center' }}>
                ✓ Loaded — continue in guided mode
              </div>
            ) : (
              <button
                type="button"
                onClick={handleLoadToEmr}
                style={{
                  width: '100%', padding: '10px 18px', borderRadius: 7,
                  border: 'none', background: '#16a34a', color: '#fff',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                ✓ Load to EMR
              </button>
            )}
          </div>
        </div>
      )}

      {/* Re-format option when already AI-processed but user wants fresh run */}
      {formatted && submission.status === 'ai_processed' && (
        <button
          type="button"
          onClick={() => void handleAiFormat()}
          disabled={aiLoading}
          style={{
            alignSelf: 'flex-start', padding: '6px 12px', borderRadius: 6,
            border: '1px solid #d1d5db', background: 'transparent',
            color: '#6b7280', fontWeight: 600, fontSize: 11, cursor: 'pointer',
          }}
        >
          {aiLoading ? 'Reformatting…' : '↺ Reformat'}
        </button>
      )}

      {/* Resend / generate a new pre-visit link */}
      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
        <PatientLinkPanel
          patientId={patientId}
          patientPhone={phone || undefined}
        />
      </div>

      {/* Monitoring updates timeline */}
      {submission.monitoring_updates && submission.monitoring_updates.length > 0 && (
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#374151', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 6 }}>
            Monitoring Updates ({submission.monitoring_updates.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {submission.monitoring_updates.slice(-5).map((u, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 11, color: '#374151' }}>
                <span style={{ color: '#9ca3af', flexShrink: 0 }}>{fmtTime(u.submitted_at)}</span>
                <span style={{ fontWeight: 600 }}>{u.type.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
