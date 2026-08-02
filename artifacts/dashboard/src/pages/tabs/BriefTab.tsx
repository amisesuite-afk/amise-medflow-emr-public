import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';

// ── Vitals definition (shared shape with ExaminationTab) ──────────────────────
const VITAL_KEYS = [
  { key: 'systolicBp'      as const, label: 'SBP',   unit: 'mmHg',   danger: (v: number) => v > 160 || v < 90  },
  { key: 'diastolicBp'     as const, label: 'DBP',   unit: 'mmHg',   danger: (v: number) => v > 100 || v < 60  },
  { key: 'heartRate'       as const, label: 'Pulse', unit: 'bpm',    danger: (v: number) => v > 120 || v < 50   },
  { key: 'temperatureC'    as const, label: 'Temp',  unit: '°C',     danger: (v: number) => v >= 38.5 || v < 36 },
  { key: 'respiratoryRate' as const, label: 'RR',    unit: '/min',   danger: (v: number) => v > 24 || v < 10   },
  { key: 'spo2'            as const, label: 'SpO₂',  unit: '%',      danger: (v: number) => v < 94              },
  { key: 'glucoseMmol'     as const, label: 'RBS',   unit: 'mmol/L', danger: (v: number) => v < 3.5 || v > 20  },
];

// ── Acuity styling ─────────────────────────────────────────────────────────────
function acuityStyle(a: string): { bg: string; text: string; border: string; icon: string; label: string } {
  switch (a) {
    case 'urgent':   return { bg: '#7f1d1d', text: '#fca5a5', border: '#b91c1c', icon: '🚨', label: 'URGENT' };
    case 'priority': return { bg: '#431407', text: '#fdba74', border: '#c2410c', icon: '⚠️', label: 'PRIORITY' };
    case 'review':   return { bg: '#1c2910', text: '#86efac', border: '#15803d', icon: '📋', label: 'REVIEW'  };
    default:         return { bg: '#0c1e1b', text: '#5eead4', border: '#0d9488', icon: '✓',  label: 'ROUTINE' };
  }
}

// ── Format a SOCRATES answers record into brief key-value pairs ───────────────
function formatAnswers(answers: Record<string, string>): Array<{ k: string; v: string }> {
  const LABEL_MAP: Record<string, string> = {
    site: 'Site', location: 'Site', onset: 'Onset', character: 'Character', severity: 'Severity',
    radiation: 'Radiation', assoc: 'Associated', symptoms: 'Associated', systemic: 'Systemic',
    timing: 'Timing', duration: 'Duration', exac: 'Exacerbated by', relief: 'Relieved by',
    prev: 'Prior episodes', meds: 'Treatment tried', alarm: 'Red flags', risk: 'Risk factors',
  };
  return Object.entries(answers)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => ({ k: LABEL_MAP[k] ?? k, v: v.trim() }));
}

// ── Sub-component: one CC card ─────────────────────────────────────────────────
interface CCEntry { complaint: string; answers: Record<string, string> }

function CcCard({ entry }: { entry: CCEntry }) {
  const [open, setOpen] = useState(true);
  const pairs = formatAnswers(entry.answers);

  return (
    <div style={{ border: '1px solid #1e3a5f', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '10px 14px',
          background: '#0d2137', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{entry.complaint}</span>
        <span style={{ fontSize: 12, color: '#475569' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && pairs.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '6px 20px', padding: '10px 14px 12px', background: '#0b1929',
        }}>
          {pairs.map(({ k, v }) => (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k}</span>
              <span style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      )}
      {open && pairs.length === 0 && (
        <div style={{ padding: '8px 14px 10px', background: '#0b1929', fontSize: 12, color: '#475569', fontStyle: 'italic' }}>
          No detail recorded — expand in HPI
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function BriefTab() {
  const {
    patientName, age, sex,
    vitals, updateVital,
    symptoms, procedureData,
    comorbidities, allergies,
    triageResult, freeText, durationDays, painScore,
    setActiveSection,
  } = useAppContext();

  const [editVitals, setEditVitals] = useState(false);

  const entries: CCEntry[] = (procedureData['cc'] as CCEntry[] | undefined) ?? [];
  const acuity = acuityStyle(triageResult.acuity);

  const recordedVitals = VITAL_KEYS.filter(v => vitals[v.key] && vitals[v.key] !== '');
  const hasVitals = recordedVitals.length > 0;

  const allergyList = allergies.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
  const hasAlerts = allergyList.length > 0 || comorbidities.length > 0;

  // Show CC derived from intake symptoms if no CC entries recorded yet
  const displaySymptoms = entries.length === 0 ? symptoms : [];

  return (
    <div className="gap-y" style={{ maxWidth: 860 }}>

      {/* ── Patient header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        padding: '12px 16px', borderRadius: 10,
        background: 'var(--card)', border: '1px solid var(--border)',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 22, flexShrink: 0,
          background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 800, color: '#fff',
        }}>
          {(patientName || '?').charAt(0).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>{patientName || 'Patient'}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            {[age && `${age}y`, sex && sex !== 'unknown' && sex].filter(Boolean).join(' · ')}
            {durationDays ? ` · Hx ${durationDays} day${durationDays === '1' ? '' : 's'}` : ''}
            {painScore ? ` · Pain ${painScore}/10` : ''}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8,
            background: acuity.bg, border: `1px solid ${acuity.border}`,
            fontSize: 12, fontWeight: 800, color: acuity.text, letterSpacing: '0.06em',
          }}>
            <span>{acuity.icon}</span>
            <span>{acuity.label}</span>
            {triageResult.score > 0 && (
              <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.75 }}>score {triageResult.score}</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Chief complaint ── */}
      <section>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          Chief Complaint
        </div>
        {entries.map((e, i) => <CcCard key={i} entry={e} />)}
        {displaySymptoms.map(s => (
          <div key={s} style={{
            padding: '9px 14px', borderRadius: 8, marginBottom: 6,
            border: '1px solid #1e3a5f', background: '#0d2137',
            fontSize: 14, color: '#cbd5e1', fontWeight: 600,
          }}>
            {s}
          </div>
        ))}
        {entries.length === 0 && symptoms.length === 0 && (
          <button
            type="button"
            onClick={() => setActiveSection('hpi')}
            style={{
              display: 'block', width: '100%', padding: '12px 14px', borderRadius: 8,
              border: '1px dashed #334155', background: 'transparent', cursor: 'pointer',
              fontSize: 13, color: '#475569', textAlign: 'left',
            }}
          >
            No chief complaint recorded — tap to open HPI →
          </button>
        )}
        {freeText.trim() && (
          <div style={{
            marginTop: 6, padding: '8px 12px', borderRadius: 6,
            background: 'var(--accent-lt)', border: '1px solid var(--accent)',
            fontSize: 12, color: 'var(--ink)', fontStyle: 'italic',
          }}>
            "{freeText.trim()}"
          </div>
        )}
      </section>

      {/* ── Vitals ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Vitals {hasVitals && <span style={{ fontWeight: 500, color: '#6b7280', textTransform: 'none' }}>(from nurse)</span>}
          </div>
          <button
            type="button"
            onClick={() => setEditVitals(e => !e)}
            style={{
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              padding: '3px 10px', borderRadius: 5,
              border: '1px solid #0d9488',
              background: editVitals ? '#0d9488' : 'transparent',
              color: editVitals ? '#fff' : '#0d9488',
            }}
          >
            {editVitals ? '✓ Done' : hasVitals ? '✎ Edit' : '+ Add'}
          </button>
        </div>
        {hasVitals && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: editVitals ? 10 : 0 }}>
            {recordedVitals.map(v => {
              const num = parseFloat(vitals[v.key]);
              const bad = Number.isFinite(num) && v.danger(num);
              return (
                <div key={v.key} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  padding: '4px 11px', borderRadius: 7,
                  background: bad ? '#fef2f2' : 'var(--card)',
                  border: `1px solid ${bad ? '#fca5a5' : 'var(--border)'}`,
                  minWidth: 52,
                }}>
                  <span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{v.label}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: bad ? '#dc2626' : 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                    {vitals[v.key]}
                    {bad && <span style={{ fontSize: 11, marginLeft: 2 }}>↑</span>}
                  </span>
                  <span style={{ fontSize: 9, color: 'var(--muted)' }}>{v.unit}</span>
                </div>
              );
            })}
          </div>
        )}
        {(editVitals || !hasVitals) && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8,
            padding: '10px', borderRadius: 8,
            background: 'var(--card)', border: '1px solid var(--border)',
          }}>
            {VITAL_KEYS.map(v => {
              const num = parseFloat(vitals[v.key]);
              const bad = vitals[v.key] !== '' && Number.isFinite(num) && v.danger(num);
              return (
                <label key={v.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: bad ? '#dc2626' : 'var(--muted)' }}>
                    {v.label} <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 9 }}>({v.unit})</span>
                  </span>
                  <input
                    type="number"
                    value={vitals[v.key] ?? ''}
                    onChange={e => updateVital(v.key, e.target.value)}
                    placeholder="—"
                    style={{
                      padding: '6px 8px', borderRadius: 6, width: '100%',
                      border: `1px solid ${bad ? '#fca5a5' : vitals[v.key] ? '#0d9488' : 'var(--border)'}`,
                      fontSize: 14, fontWeight: 700, outline: 'none',
                      background: bad ? '#fef2f2' : 'var(--card)',
                      color: bad ? '#dc2626' : 'var(--ink)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                </label>
              );
            })}
          </div>
        )}
        {!hasVitals && !editVitals && (
          <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', padding: '6px 0' }}>
            No vitals recorded
          </div>
        )}
      </section>

      {/* ── Alerts ── */}
      {hasAlerts && (
        <section>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Alerts
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {allergyList.map(a => (
              <span key={a} style={{
                padding: '4px 11px', borderRadius: 20,
                background: '#7f1d1d', color: '#fca5a5',
                fontSize: 12, fontWeight: 700, border: '1px solid #b91c1c',
              }}>
                ⚠ {a}
              </span>
            ))}
            {comorbidities.map(c => (
              <span key={c} style={{
                padding: '4px 11px', borderRadius: 20,
                background: '#1e293b', color: '#94a3b8',
                fontSize: 12, fontWeight: 600, border: '1px solid #334155',
              }}>
                {c}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ── Triage reasons (if any flags) ── */}
      {triageResult.reasons.length > 0 && (
        <section>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            Clinical Flags
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {triageResult.reasons.map(r => (
              <div key={r} style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                fontSize: 13, color: 'var(--ink)', padding: '6px 10px',
                borderRadius: 6, background: 'var(--card)', border: '1px solid var(--border)',
              }}>
                <span style={{ color: '#f59e0b', flexShrink: 0 }}>⚑</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Action row ── */}
      <section>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          Begin Documentation
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { section: 'hpi'         as const, label: '→ HPI',         desc: 'History of present illness' },
            { section: 'examination' as const, label: '→ Exam',        desc: 'Physical examination' },
            { section: 'assessment'  as const, label: '→ Assessment',  desc: 'Diagnosis & differentials' },
            { section: 'plan'        as const, label: '→ Plan',        desc: 'Management plan' },
          ].map(({ section, label, desc }) => (
            <button
              key={section}
              type="button"
              onClick={() => setActiveSection(section)}
              title={desc}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid var(--border)', background: 'var(--card)',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-lt)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{label}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{desc}</span>
            </button>
          ))}
        </div>
      </section>

    </div>
  );
}
