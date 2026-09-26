/**
 * Returning patient: follow-up of the last problem, or a new problem (owner's instruction,
 * 2026-09-25). Web counterpart of the iOS consultation start (ConsultationView.handleAppear) and
 * its "Continuing from" card.
 *
 *  1. When a new encounter for a returning patient opens in the consultation, the visit type is
 *     flagged automatically — Follow-up, or First consult when today's complaint is a different,
 *     new one — without a picker. Specific bookings stand (visit-continuity-web.ts).
 *  2. A chip shows why ("Follow-up — last seen 14 days ago · Continuing: …" / "New complaint —
 *     last visit was for …") with a one-tap change.
 *  3. "Continuing from": last visit date, diagnosis and plan, and the standing history (PMH,
 *     surgery, medicines, allergies) marked "carried forward — review". Nothing here is marked as
 *     verified today: the medicines from the last visit are added to today's list only when the
 *     clinician taps, allergies stay "not recorded" until recorded, and the diagnosis stays the
 *     last visit's — today's diagnosis is still made on the Assess step.
 */
import { useEffect, useMemo, useState } from 'react';
import { useAppContext, type EncounterType } from '@/context/AppContext';
import { allergyStatus } from '@/lib/allergy-status';
import { loadEncounterMedicationList } from '@/lib/db';
import { resolveEncounterContext, VISIT_TYPES } from '@/lib/visit-types';
import {
  computeContinuity, currentComplaintText, decideAutoVisitType, encounterIsStarting,
  medicationsToCarryForward,
} from '@/lib/visit-continuity-web';
import { previousVisitProblem } from '@workspace/triage-engine/visit-continuity';

/**
 * Encounters whose visit type was already decided this session. A later manual change is never
 * overridden; the decision is made again only when no visit type is set (visit type is not stored
 * with the encounter, so it is empty again after the patient is reloaded).
 */
const decidedEncounters = new Set<string>();

type ContinuityVisitType = 'follow_up' | 'new_consult';

const LABEL: Record<ContinuityVisitType, string> = {
  follow_up: 'Follow-up',
  new_consult: 'First consult — new problem',
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/St_Lucia',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export default function VisitContinuityPanel() {
  const {
    patientId, encounterId, recentEncounters, recentEncountersPatientId,
    visitType, setVisitType, encounterMode, encounterType, setEncounterType,
    procedureData, symptoms, freeText,
    comorbidities, pmhNotes, surgicalHistory, surgicalNotes,
    medications, setMedications, medicationsText, setMedicationsText,
    allergies, setActiveSection, hpiNotes, setHpiNotes,
  } = useAppContext();

  const encountersLoaded = !!patientId && recentEncountersPatientId === patientId;
  const complaint = useMemo(
    () => currentComplaintText({ procedureData, symptoms, freeText }),
    [procedureData, symptoms, freeText],
  );

  /** Mirrors the header visit-type select, without downgrading an encounter tier that a
   *  complaint template already raised (endoscopy / emergency / procedure). */
  function applyVisitType(vt: ContinuityVisitType) {
    setVisitType(vt);
    const next = resolveEncounterContext(vt).encounterType;
    const generic: EncounterType[] = ['quick_consult', 'surgical_consult'];
    if (next && generic.includes(encounterType)) setEncounterType(next);
  }

  // ── 1. Flag the visit type automatically when a returning patient's encounter starts ────────
  useEffect(() => {
    if (!encounterId) return;
    if (decidedEncounters.has(encounterId) && visitType) return;
    const d = decideAutoVisitType({
      visitType, encounterMode, currentEncounterId: encounterId,
      encounters: recentEncounters, encountersLoaded, complaint,
    });
    if (d.action === 'wait') return;
    decidedEncounters.add(encounterId);
    if (d.action === 'set' && d.visitType !== visitType) applyVisitType(d.visitType);
  // Decide once the patient's encounter list is in; later complaint edits only update the chip.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterId, encountersLoaded, visitType]);

  const state = useMemo(
    () => (encountersLoaded && encounterIsStarting(encounterId, recentEncounters)
      ? computeContinuity({ encounters: recentEncounters, currentEncounterId: encounterId, complaint })
      : null),
    [encountersLoaded, encounterId, recentEncounters, complaint],
  );

  // Last visit's medicine list (read-only until the clinician adds it to today's).
  const prevEncounterId = state?.previous.encounterId ?? null;
  const [lastMeds, setLastMeds] = useState<{ encounterId: string; chips: string[]; freeText: string } | null>(null);
  useEffect(() => {
    if (!patientId || !prevEncounterId) { setLastMeds(null); return; }
    let cancelled = false;
    void loadEncounterMedicationList(patientId, prevEncounterId).then(r => {
      if (!cancelled) setLastMeds({ encounterId: prevEncounterId, chips: r.chips, freeText: r.freeText });
    });
    return () => { cancelled = true; };
  }, [patientId, prevEncounterId]);

  const [expandedFor, setExpandedFor] = useState<Record<string, boolean>>({});

  if (!state || !encounterId) return null;
  if (visitType !== 'follow_up' && visitType !== 'new_consult') return null;

  const { previous, recommendation } = state;
  const current = visitType as ContinuityVisitType;
  const other: ContinuityVisitType = current === 'follow_up' ? 'new_consult' : 'follow_up';
  const disagrees = recommendation.visitType !== current;
  const expanded = expandedFor[encounterId] ?? current === 'follow_up';
  const problem = previousVisitProblem(previous);
  const accent = current === 'follow_up' ? '#2563eb' : '#0d9488';
  const icon = VISIT_TYPES.find(v => v.id === current)?.icon ?? '🩺';

  const days = recommendation.daysAgo;
  const lastSeen = `last seen ${days} day${days === 1 ? '' : 's'} ago`;
  const headline = current === 'follow_up'
    ? [`Follow-up — ${lastSeen}`, problem ? `Continuing: ${problem}` : null].filter(Boolean).join(' · ')
    : `New complaint — last visit was for ${problem ?? 'another problem'} (${lastSeen})`;

  const medsSameEncounter = lastMeds && lastMeds.encounterId === prevEncounterId ? lastMeds : null;
  const medsToAdd = medsSameEncounter ? medicationsToCarryForward(medsSameEncounter.chips, medications) : [];
  const freeTextToAdd = medsSameEncounter?.freeText && !medicationsText.trim() ? medsSameEncounter.freeText : '';
  const allergy = allergyStatus(allergies);
  const hasPmh = comorbidities.length > 0 || !!pmhNotes.trim();
  const hasSurgery = surgicalHistory.length > 0 || !!surgicalNotes.trim();
  const lastVisitMeds = medsSameEncounter
    ? [...medsSameEncounter.chips, medsSameEncounter.freeText].filter(Boolean)
    : [];
  const canCarryMeds = medsToAdd.length > 0 || !!freeTextToAdd;

  /** One tap: open the interval history with what this visit continues (only into an empty field). */
  function startIntervalHistory() {
    if (hpiNotes.trim()) { setActiveSection('hpi'); return; }
    const planText = previous.plan ? ` Plan at the last visit: ${truncate(previous.plan.replace(/\s+/g, ' ').trim(), 300)}` : '';
    setHpiNotes(`Follow-up of ${problem ?? 'the problem seen at the last visit'}, last seen ${fmtDate(previous.date)}.${planText}\nSince the last visit: `);
    setActiveSection('hpi');
  }

  function carryMedsForward() {
    if (medsToAdd.length) setMedications([...medications, ...medsToAdd]);
    if (freeTextToAdd) setMedicationsText(freeTextToAdd);
  }

  const rowLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase',
    letterSpacing: '0.06em', minWidth: 74, paddingTop: 2,
  };
  const marker: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: '#92400e', background: '#fef3c7',
    border: '1px solid #fcd34d', borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap',
  };
  const linkBtn: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: accent, background: 'none', border: 'none',
    cursor: 'pointer', padding: '2px 4px',
  };

  // A plain function, not a nested component, so the rows are not remounted on every render.
  function historyRow({ label, value, status, section, action }: {
    label: string; value: React.ReactNode; status: React.ReactNode;
    section: Parameters<typeof setActiveSection>[0]; action?: React.ReactNode;
  }) {
    return (
      <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap', padding: '5px 0', borderTop: '1px solid #e2e8f0' }}>
        <span style={rowLabel}>{label}</span>
        <span style={{ flex: '1 1 200px', fontSize: 12, color: '#1e293b', minWidth: 0, overflowWrap: 'anywhere' }}>{value}</span>
        <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {status}
          {action}
          <button type="button" style={linkBtn} onClick={() => setActiveSection(section)}>Open</button>
        </span>
      </div>
    );
  }

  const carried = <span style={marker}>carried forward — review</span>;
  const noneOnRecord = <span style={{ color: '#64748b' }}>None on record</span>;

  return (
    <section
      aria-label="Visit continuity"
      data-testid="visit-continuity"
      style={{
        // flexShrink 0: the consultation column is a fixed-height flex column; without it a tall
        // step below squeezes this panel to a hairline.
        marginBottom: 8, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
        border: `1.5px solid ${accent}55`, background: '#fff',
      }}
    >
      {/* ── Chip: what this visit is, why, and a one-tap change ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '8px 12px', background: `${accent}0d` }}>
        <span style={{
          fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em',
          color: accent, background: `${accent}1a`, border: `1px solid ${accent}40`,
          borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap',
        }}>
          {icon} {LABEL[current]}
        </span>
        <span style={{ flex: '1 1 240px', fontSize: 12, color: '#1e293b', minWidth: 0 }}>{headline}</span>
        <button
          type="button"
          onClick={() => applyVisitType(other)}
          style={{
            fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
            border: `1px solid ${disagrees ? '#d97706' : '#cbd5e1'}`,
            background: disagrees ? '#fffbeb' : '#fff', color: disagrees ? '#92400e' : '#334155',
          }}
        >
          Change to {other === 'follow_up' ? 'Follow-up' : 'First consult (new problem)'}
        </button>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpandedFor(p => ({ ...p, [encounterId]: !expanded }))}
          style={linkBtn}
        >
          {expanded ? 'Hide last visit ▲' : 'Continuing from ▼'}
        </button>
      </div>

      {disagrees && (
        <div role="status" style={{ padding: '6px 12px', fontSize: 12, color: '#92400e', background: '#fffbeb', borderTop: '1px solid #fde68a' }}>
          Today's complaint suggests <strong>{LABEL[recommendation.visitType]}</strong>: {recommendation.reasons[recommendation.reasons.length - 1]}
        </div>
      )}

      {/* ── Continuing from: last visit + standing history for review ── */}
      {expanded && (
        <div style={{ padding: '8px 12px 10px', borderTop: `1px solid ${accent}26` }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Continuing from
          </div>
          <div style={{ fontSize: 12, color: '#1e293b', marginBottom: 2 }}>
            <strong>Last visit {fmtDate(previous.date)}</strong>
            <span style={{ color: '#64748b' }}> · {days} day{days === 1 ? '' : 's'} ago</span>
          </div>
          <div style={{ fontSize: 12, color: '#1e293b', marginBottom: 2 }}>
            <span style={{ fontWeight: 700, color: '#475569' }}>Diagnosis: </span>
            {problem ?? <span style={{ color: '#64748b' }}>not recorded</span>}
          </div>
          <div style={{ fontSize: 12, color: '#1e293b', marginBottom: 8, whiteSpace: 'pre-wrap' }}>
            <span style={{ fontWeight: 700, color: '#475569' }}>Plan: </span>
            {previous.plan ? truncate(previous.plan, 400) : <span style={{ color: '#64748b' }}>not recorded</span>}
          </div>
          {current === 'follow_up' && !hpiNotes.trim() && (
            <button
              type="button"
              onClick={startIntervalHistory}
              style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', border: `1px solid ${accent}`, background: '#fff', color: accent, marginBottom: 8 }}
              title="Starts S — Interval history with the last visit's problem, date and plan. Edit it before signing."
            >
              Start interval history from last visit
            </button>
          )}

          <div style={{ fontSize: 10, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
            Standing history — review and update today
          </div>
          {historyRow({
            label: 'PMH', section: 'pmh',
            value: hasPmh
              ? [comorbidities.join(', '), pmhNotes.trim() ? truncate(pmhNotes.trim(), 160) : ''].filter(Boolean).join(' — ')
              : noneOnRecord,
            status: hasPmh ? carried : null,
          })}
          {historyRow({
            label: 'Surgery', section: 'surgical',
            value: hasSurgery
              ? [surgicalHistory.join(', '), surgicalNotes.trim() ? truncate(surgicalNotes.trim(), 160) : ''].filter(Boolean).join(' — ')
              : noneOnRecord,
            status: hasSurgery ? carried : null,
          })}
          {historyRow({
            label: 'Meds', section: 'medications',
            value: !medsSameEncounter
              ? <span style={{ color: '#64748b' }}>Loading last visit's list…</span>
              : lastVisitMeds.length
                ? <>Last visit: {lastVisitMeds.join(', ')}</>
                : <span style={{ color: '#64748b' }}>None listed at the last visit</span>,
            status: lastVisitMeds.length
              ? (canCarryMeds
                ? carried
                : <span style={{ ...marker, color: '#166534', background: '#f0fdf4', borderColor: '#86efac' }}>on today's list — check doses</span>)
              : null,
            action: canCarryMeds ? (
              <button
                type="button"
                onClick={carryMedsForward}
                style={{ fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '3px 9px', cursor: 'pointer', border: `1px solid ${accent}`, background: '#fff', color: accent }}
                title="Adds the last visit's medicines to today's list. Stop or change any the patient no longer takes."
              >
                Add {medsToAdd.length + (freeTextToAdd ? 1 : 0)} to today's list
              </button>
            ) : undefined,
          })}
          {historyRow({
            label: 'Allergies', section: 'allergies',
            value: allergy.kind === 'not_recorded'
              ? <span style={{ color: '#b45309', fontWeight: 700 }}>Not recorded — ask and record</span>
              : allergy.kind === 'nkda'
                ? 'No known drug allergies (NKDA)'
                : <span style={{ color: '#b91c1c', fontWeight: 700 }}>⚠ {allergy.allergies.join(', ')}{allergy.conflictsWithNkda ? ' (NKDA also marked — reconcile)' : ''}</span>,
            status: allergy.kind === 'not_recorded' ? null : carried,
          })}
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
            From the record — confirm with the patient. Today's findings and diagnosis are documented on the S / O / A / P steps.
          </div>
        </div>
      )}
    </section>
  );
}
