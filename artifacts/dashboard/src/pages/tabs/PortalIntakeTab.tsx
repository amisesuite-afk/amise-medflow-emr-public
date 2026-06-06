import { useState, useEffect } from 'react';
import { useAppContext } from '@/context/AppContext';
import { supabase as sb } from '@/lib/supabase';

const TEAL = '#0d9488';

interface IntakeSummaryParsed {
  chiefComplaint?: string;
  keyPositives?: string[];
  redFlags?: { symptom: string; severity: string; action: string }[];
  differentials?: string[];
  suggestedWorkup?: string[];
  estimatedUrgency?: string;
  summary?: string;
}

interface IntakeRow {
  id: string;
  submitted_at: string;
  visit_type: string | null;
  complaint_track: string | null;
  complexity_score: number | null;
  chief_complaint: string | null;
  symptoms: string[] | null;
  duration_days: number | null;
  severity: number | null;
  current_meds: string | null;
  allergies_note: string | null;
  referral_reason: string | null;
  additional_notes: string | null;
  ai_summary: string | null;
  ai_summary_at: string | null;
  ai_reviewed: boolean | null;
}

function urgencyColor(u: string | undefined) {
  switch (u) {
    case 'emergency': return { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', label: 'EMERGENCY' };
    case 'urgent':    return { bg: '#fff7ed', border: '#fdba74', text: '#9a3412', label: 'URGENT' };
    case 'priority':  return { bg: '#fefce8', border: '#fde047', text: '#854d0e', label: 'PRIORITY' };
    default:          return { bg: '#f0fdf4', border: '#86efac', text: '#166534', label: 'ROUTINE' };
  }
}

function complexityBadge(score: number | null) {
  if (score === null) return null;
  if (score >= 7) return { label: 'High complexity', bg: '#fee2e2', color: '#991b1b' };
  if (score >= 4) return { label: 'Moderate complexity', bg: '#fef3c7', color: '#92400e' };
  return { label: 'Routine', bg: '#d1fae5', color: '#065f46' };
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-LC', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function PortalIntakeTab() {
  const { patientId } = useAppContext();
  const [intakes, setIntakes] = useState<IntakeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<IntakeRow | null>(null);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!patientId || !sb) { setIntakes([]); setSelected(null); return; }
    setLoading(true);
    void sb
      .from('patient_intake')
      .select('*')
      .eq('patient_id', patientId)
      .order('submitted_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        const rows = (data ?? []) as IntakeRow[];
        setIntakes(rows);
        setSelected(rows[0] ?? null);
        setLoading(false);
      });
  }, [patientId]);

  async function markReviewed(id: string) {
    if (!sb) return;
    setMarking(true);
    await sb.from('patient_intake').update({ ai_reviewed: true }).eq('id', id);
    setIntakes(prev => prev.map(r => r.id === id ? { ...r, ai_reviewed: true } : r));
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, ai_reviewed: true } : prev);
    setMarking(false);
  }

  if (!patientId) {
    return (
      <div style={{ padding: 32, color: '#64748b', fontSize: 14, textAlign: 'center' }}>
        No patient selected. Use the Check-In tab to load a patient record.
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 32, color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>Loading portal intake submissions…</div>;
  }

  if (intakes.length === 0) {
    return (
      <div style={{ padding: 32, color: '#64748b', fontSize: 14, textAlign: 'center' }}>
        <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No portal intake on file</p>
        <p style={{ margin: 0 }}>This patient has not yet submitted a pre-visit form via the patient portal.</p>
      </div>
    );
  }

  let parsedSummary: IntakeSummaryParsed | null = null;
  if (selected?.ai_summary) {
    try { parsedSummary = JSON.parse(selected.ai_summary); } catch { parsedSummary = null; }
  }

  const urgency = urgencyColor(parsedSummary?.estimatedUrgency);
  const badge   = complexityBadge(selected?.complexity_score ?? null);

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%' }}>

      {/* Left — submission list */}
      <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid #e2e8f0', paddingRight: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Submissions</p>
        {intakes.map(r => {
          const isActive = r.id === selected?.id;
          return (
            <button key={r.id} type="button" onClick={() => setSelected(r)}
              style={{
                width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: 'none',
                background: isActive ? `${TEAL}15` : 'transparent',
                cursor: 'pointer', marginBottom: 4,
              }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: isActive ? TEAL : '#1e293b' }}>
                {r.visit_type ?? 'Unknown'} {r.ai_summary && !r.ai_reviewed ? '●' : ''}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{fmt(r.submitted_at)}</div>
              {badge && <div style={{ marginTop: 4, display: 'inline-block', fontSize: 10, fontWeight: 700, color: badge.color, background: badge.bg, borderRadius: 4, padding: '1px 5px' }}>{badge.label}</div>}
            </button>
          );
        })}
      </div>

      {/* Right — detail */}
      {selected && (
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* AI Summary block */}
          {parsedSummary ? (
            <div style={{ background: urgency.bg, border: `1px solid ${urgency.border}`, borderRadius: 12, padding: '18px 20px', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: urgency.text, background: urgency.bg, border: `1px solid ${urgency.border}`, borderRadius: 5, padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  {urgency.label}
                </span>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  AI summary · {selected.ai_summary_at ? fmt(selected.ai_summary_at) : '—'}
                </span>
                {!selected.ai_reviewed && (
                  <button type="button" onClick={() => void markReviewed(selected.id)} disabled={marking}
                    style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${TEAL}`, background: 'transparent', color: TEAL, cursor: 'pointer', fontWeight: 600 }}>
                    {marking ? '…' : 'Mark reviewed'}
                  </button>
                )}
                {selected.ai_reviewed && (
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#65a30d', fontWeight: 700 }}>✓ Reviewed</span>
                )}
              </div>

              {parsedSummary.chiefComplaint && (
                <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                  {parsedSummary.chiefComplaint}
                </p>
              )}

              {parsedSummary.summary && (
                <p style={{ margin: '0 0 14px', fontSize: 13, color: '#374151', lineHeight: 1.65 }}>{parsedSummary.summary}</p>
              )}

              {(parsedSummary.redFlags?.length ?? 0) > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Red flags</p>
                  {parsedSummary.redFlags!.map((f, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#7f1d1d', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '5px 10px', marginBottom: 4 }}>
                      <strong>{f.symptom}</strong>{f.action ? ` — ${f.action}` : ''}
                    </div>
                  ))}
                </div>
              )}

              {(parsedSummary.differentials?.length ?? 0) > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Differentials</p>
                  {parsedSummary.differentials!.map((d, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#374151', padding: '3px 0', borderBottom: '1px solid #f1f5f9' }}>
                      {i + 1}. {d}
                    </div>
                  ))}
                </div>
              )}

              {(parsedSummary.suggestedWorkup?.length ?? 0) > 0 && (
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Suggested workup</p>
                  {parsedSummary.suggestedWorkup!.map((w, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#374151', padding: '3px 0' }}>· {w}</div>
                  ))}
                </div>
              )}

              <p style={{ margin: '12px 0 0', fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>
                AI-generated suggestion — not a diagnosis. Physician review required.
              </p>
            </div>
          ) : selected.ai_summary === null ? (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', marginBottom: 18, fontSize: 13, color: '#64748b' }}>
              AI summary pending — generates automatically after submission.
            </div>
          ) : null}

          {/* Raw intake data */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>Patient responses</p>

            <Row label="Visit type"      value={selected.visit_type} />
            <Row label="Complaint track" value={selected.complaint_track} />
            <Row label="Chief complaint" value={selected.chief_complaint} />
            <Row label="Symptoms"        value={selected.symptoms?.join(', ')} />
            <Row label="Duration"        value={selected.duration_days != null ? `${selected.duration_days} days` : undefined} />
            <Row label="Severity"        value={selected.severity != null ? `${selected.severity}/10` : undefined} />
            <Row label="Medications"     value={selected.current_meds} />
            <Row label="Allergies"       value={selected.allergies_note} />
            <Row label="Referral"        value={selected.referral_reason} />
            <Row label="Notes"           value={selected.additional_notes} />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
      <span style={{ width: 130, flexShrink: 0, color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: 2 }}>{label}</span>
      <span style={{ color: '#1e293b', flex: 1 }}>{value}</span>
    </div>
  );
}
