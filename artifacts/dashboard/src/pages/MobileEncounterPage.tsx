/**
 * Mobile Encounter Page — rendered at /mobile.
 *
 * A compact, touch-friendly encounter view for clinicians accessing the EMR
 * from a mobile phone (theatre, ward, bedside). Reads directly from Supabase
 * so it works independently from any in-progress desktop session.
 *
 * Accessible at: <dashboard-host>/mobile
 * No React Router needed — App.tsx detects the pathname and renders this.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface PatientRef {
  full_name: string;
  date_of_birth: string | null;
  sex: string | null;
}

interface EncounterRow {
  id: string;
  patient_id: string;
  encounter_date: string;
  encounter_type: string;
  chief_complaint: string | null;
  status: string;
  site: string | null;
  // Supabase returns related rows as an array even for a single FK join
  patients: PatientRef[] | PatientRef | null;
}

interface EncounterDetail {
  encounter: EncounterRow;
  vitals: {
    bp_systolic: number | null; bp_diastolic: number | null;
    heart_rate: number | null; temperature_c: number | null;
    oxygen_saturation: number | null; weight_kg: number | null;
    recorded_at: string;
  } | null;
  assessment: { diagnosis: string | null; differentials: string | null; notes: string | null } | null;
  plan: { description: string | null; plan_type: string | null; follow_up_date: string | null } | null;
}

export default function MobileEncounterPage() {
  const [encounters, setEncounters] = useState<EncounterRow[]>([]);
  const [selected, setSelected] = useState<EncounterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  const loadEncounters = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('encounters')
        .select('id, patient_id, encounter_date, encounter_type, chief_complaint, status, site, patients(full_name, date_of_birth, sex)')
        .order('encounter_date', { ascending: false })
        .limit(30);
      if (err) throw err;
      setEncounters((data ?? []) as EncounterRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load encounters');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadEncounters(); }, [loadEncounters]);

  async function openDetail(enc: EncounterRow) {
    if (!supabase) return;
    setDetailLoading(true);
    try {
      const [vitRes, assRes, planRes] = await Promise.all([
        supabase
          .from('vitals')
          .select('bp_systolic, bp_diastolic, heart_rate, temperature_c, oxygen_saturation, weight_kg, recorded_at')
          .eq('encounter_id', enc.id)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('assessments')
          .select('diagnosis, differentials, notes')
          .eq('encounter_id', enc.id)
          .maybeSingle(),
        supabase
          .from('plans')
          .select('description, plan_type, follow_up_date')
          .eq('encounter_id', enc.id)
          .in('plan_type', ['management', null as unknown as string])
          .limit(1)
          .maybeSingle(),
      ]);
      setSelected({
        encounter: enc,
        vitals: vitRes.data ?? null,
        assessment: assRes.data ?? null,
        plan: planRes.data ?? null,
      });
    } finally {
      setDetailLoading(false);
    }
  }

  const pt = pickPatient(selected ? selected.encounter.patients : null);
  const age = pt?.date_of_birth
    ? `${Math.floor((Date.now() - new Date(pt.date_of_birth).getTime()) / 31_557_600_000)}y`
    : null;

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg, #f8fafc)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#0d2520', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        {selected && (
          <button
            type="button"
            onClick={() => setSelected(null)}
            style={{
              background: 'none', border: 'none', color: '#4db8ad',
              fontSize: 20, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
            }}
            aria-label="Back"
          >
            ←
          </button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ color: '#4db8ad', fontSize: 11, fontWeight: 700, letterSpacing: '.1em' }}>
            AMISE MEDFLOW
          </div>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginTop: 1 }}>
            {selected
              ? (pickPatient(selected.encounter.patients)?.full_name ?? 'Patient')
              : 'Recent Encounters'}
          </div>
        </div>
        <div style={{ color: '#64748b', fontSize: 12 }}>
          {profile?.full_name ?? ''}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 8, marginBottom: 16,
            background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* ── Encounter list ── */}
        {!selected && (
          loading
            ? <LoadingSpinner />
            : encounters.length === 0
              ? <EmptyPlaceholder text="No encounters found" />
              : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {encounters.map(enc => (
                    <button
                      key={enc.id}
                      type="button"
                      onClick={() => void openDetail(enc)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
                        padding: '14px 16px', cursor: 'pointer',
                        boxShadow: '0 1px 4px rgba(0,0,0,.06)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 3 }}>
                          {pickPatient(enc.patients)?.full_name ?? 'Unknown patient'}
                        </div>
                        <StatusPill status={enc.status} />
                      </div>
                      <div style={{ fontSize: 13, color: '#64748b' }}>
                        {enc.encounter_type.replace(/_/g, ' ')}
                        {enc.chief_complaint ? ` · ${enc.chief_complaint}` : ''}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                        {formatDate(enc.encounter_date)}
                        {enc.site ? ` · ${enc.site.replace(/_/g, ' ')}` : ''}
                      </div>
                    </button>
                  ))}
                </div>
        )}

        {/* ── Encounter detail ── */}
        {selected && (
          detailLoading
            ? <LoadingSpinner />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Demographics strip */}
                <div style={{
                  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 16px',
                }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>
                    {selected.encounter.encounter_type.replace(/_/g, ' ')} · {formatDate(selected.encounter.encounter_date)}
                  </div>
                  <div style={{ fontSize: 14, color: '#1e293b' }}>
                    {[pt?.sex, age].filter(Boolean).join(', ')}
                    {selected.encounter.chief_complaint
                      ? ` · CC: ${selected.encounter.chief_complaint}` : ''}
                  </div>
                </div>

                {/* Vitals */}
                {selected.vitals && (
                  <DetailCard title="Vitals" accent="#0d9488">
                    <VitalsGrid v={selected.vitals} />
                  </DetailCard>
                )}

                {/* Assessment */}
                {selected.assessment && (selected.assessment.diagnosis || selected.assessment.notes) && (
                  <DetailCard title="Assessment" accent="#6366f1">
                    {selected.assessment.diagnosis && (
                      <Field label="Diagnosis" value={selected.assessment.diagnosis} />
                    )}
                    {selected.assessment.differentials && (
                      <Field label="Differentials" value={selected.assessment.differentials} />
                    )}
                    {selected.assessment.notes && (
                      <Field label="Notes" value={selected.assessment.notes} />
                    )}
                  </DetailCard>
                )}

                {/* Plan */}
                {selected.plan && selected.plan.description && (
                  <DetailCard title="Plan" accent="#0ea5e9">
                    <Field label="Management" value={selected.plan.description} />
                    {selected.plan.follow_up_date && (
                      <Field label="Follow-up" value={formatDate(selected.plan.follow_up_date)} />
                    )}
                  </DetailCard>
                )}

                {!selected.assessment && !selected.plan && (
                  <EmptyPlaceholder text="No clinical notes recorded yet for this encounter" />
                )}

                <div style={{ height: 32 }} />
              </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pickPatient(raw: EncounterRow['patients']): PatientRef | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const colours: Record<string, [string, string]> = {
    open:        ['#dcfce7', '#166534'],
    in_progress: ['#dbeafe', '#1e40af'],
    closed:      ['#f3f4f6', '#4b5563'],
    cancelled:   ['#fef2f2', '#b91c1c'],
  };
  const [bg, fg] = colours[status] ?? ['#f3f4f6', '#4b5563'];
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
      background: bg, color: fg, flexShrink: 0,
    }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function DetailCard({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid #e2e8f0',
        fontWeight: 700, fontSize: 13, color: accent,
        borderLeft: `4px solid ${accent}`,
      }}>
        {title}
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#1e293b', whiteSpace: 'pre-wrap' }}>{value}</div>
    </div>
  );
}

function VitalsGrid({ v }: { v: NonNullable<EncounterDetail['vitals']> }) {
  const items = [
    { label: 'BP', value: v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : null, unit: 'mmHg' },
    { label: 'HR', value: v.heart_rate?.toString() ?? null, unit: 'bpm' },
    { label: 'SpO₂', value: v.oxygen_saturation?.toString() ?? null, unit: '%' },
    { label: 'Temp', value: v.temperature_c?.toString() ?? null, unit: '°C' },
    { label: 'Wt', value: v.weight_kg?.toString() ?? null, unit: 'kg' },
  ].filter(i => i.value);

  if (items.length === 0) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {items.map(i => (
        <div key={i.label} style={{
          background: '#f8fafc', borderRadius: 8, padding: '8px 10px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>{i.label}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b' }}>{i.value}</div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>{i.unit}</div>
        </div>
      ))}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '3px solid #e2e8f0', borderTopColor: '#0d9488',
        animation: 'spin .8s linear infinite', margin: '0 auto',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

function EmptyPlaceholder({ text }: { text: string }) {
  return (
    <div style={{
      padding: 32, borderRadius: 12, border: '1px dashed #e2e8f0',
      textAlign: 'center', color: '#94a3b8', fontSize: 14,
    }}>
      {text}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-LC', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
}
