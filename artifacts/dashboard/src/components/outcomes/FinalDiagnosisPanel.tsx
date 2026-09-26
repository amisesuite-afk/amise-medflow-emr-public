import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAppContext } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { hasRole } from '@/lib/roles';
import {
  COMMON_ACUITIES, DEFAULT_OUTCOME_DUE_DAYS, OUTCOME_SOURCE_LABELS, OUTCOME_SOURCE_TYPES, pendingOutcomes,
  sanitizeFinalDiagnosis,
} from '@workspace/triage-engine/outcomes';
import type { CommonAcuity, OutcomeSourceType } from '@workspace/triage-engine/outcomes';
import {
  SAVE_STATUS_TEXT, loadOutcomeData, retractFinalDiagnosis, saveFinalDiagnosis,
} from '@/lib/outcomes-db';
import type { OutcomeData, StoredOutcome, StoredSnapshot } from '@/lib/outcomes-db';
import { paneIdForIcd, paneLabel, searchFinalDiagnoses } from '@/lib/outcomes-model';
import type { DiagnosisOption } from '@/lib/outcomes-model';

const card: CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', margin: '10px 14px' };
const small: CSSProperties = { fontSize: 12, color: '#64748b' };
const btn = (primary = false, disabled = false): CSSProperties => ({
  padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
  border: primary ? 'none' : '1px solid #cbd5e1', background: disabled ? '#e2e8f0' : primary ? '#0d9488' : '#fff',
  color: disabled ? '#94a3b8' : primary ? '#fff' : '#334155',
});

function stLuciaDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/St_Lucia' });
}
function stLuciaToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/St_Lucia' });
}
function newClientRef(): string {
  return `web:${crypto.randomUUID()}`;
}
function dxText(diseaseId: string | null, icd10: string | null): string {
  const label = paneLabel(diseaseId);
  return [icd10, label].filter(Boolean).join(' ') || diseaseId || '—';
}

const ACUITY_LABELS: Record<CommonAcuity, string> = {
  emergency: 'Emergency (same hour)', urgent: 'Urgent (same day)', soon: 'Soon (24–48 h)', routine: 'Routine',
};

/**
 * "Final diagnosis" (outcomes loop): the patient's completed encounters that have a prediction
 * snapshot, the confirmed final diagnosis for each, and a form to record one from histology /
 * a report, operative findings or note, a discharge summary or a follow-up visit. A gentle
 * "Final diagnosis not yet recorded" item marks encounters older than 14 days that had an
 * operation or pathology. Nurse, doctor and admin only (RLS enforces the same).
 *
 * Nothing is inferred into the record: the clinician picks the code, the source and the date,
 * and taps Confirm. A correction retracts the old row and confirms a new one.
 */
export default function FinalDiagnosisPanel() {
  const { patientId } = useAppContext();
  const { profile, loading: authLoading } = useAuth();
  const allowed = !authLoading && hasRole(profile?.role, 'nurse');
  const [data, setData] = useState<OutcomeData | null>(null);
  const [openRef, setOpenRef] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!patientId) { setData(null); return; }
    void loadOutcomeData(patientId).then(setData);
  }, [patientId]);

  useEffect(() => { if (allowed) reload(); }, [allowed, reload]);

  const due = useMemo(() => new Set(
    data ? pendingOutcomes(data.snapshots, data.outcomes, new Date(), DEFAULT_OUTCOME_DUE_DAYS).map(s => s.encounterRef) : [],
  ), [data]);

  if (!allowed || !patientId || !data) return null;
  if (!data.available) {
    return (
      <div style={{ ...card, ...small }} data-testid="final-dx-unavailable">
        Final diagnosis recording becomes available after the database update (Migration 94).
      </div>
    );
  }
  if (data.snapshots.length === 0 && !data.error) return null;

  const confirmedFor = (ref: string) => data.outcomes.find(o => o.encounterRef === ref && o.status === 'confirmed') ?? null;

  return (
    <div style={card} data-testid="final-dx-panel">
      <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>Final diagnosis</div>
      <div style={{ ...small, marginBottom: 8 }}>
        Confirmed later from histology, operative findings, a discharge summary or a follow-up visit, to measure how accurate the
        engines' predictions were. Codes only.
      </div>
      {data.error && <div style={{ ...small, color: '#b91c1c' }}>Could not load: {data.error}</div>}
      {data.snapshots.map(s => (
        <EncounterRow key={s.encounterRef} snapshot={s} outcome={confirmedFor(s.encounterRef)} due={due.has(s.encounterRef)}
          open={openRef === s.encounterRef} onOpen={() => setOpenRef(openRef === s.encounterRef ? null : s.encounterRef)}
          onChanged={() => { setOpenRef(null); reload(); }} userId={profile?.id ?? null} />
      ))}
    </div>
  );
}

function EncounterRow({ snapshot: s, outcome, due, open, onOpen, onChanged, userId }: {
  snapshot: StoredSnapshot; outcome: StoredOutcome | null; due: boolean; open: boolean;
  onOpen: () => void; onChanged: () => void; userId: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const leader = s.topDifferential[0];
  const retract = async () => {
    if (!outcome?.id) return;
    setBusy(true);
    const r = await retractFinalDiagnosis(outcome.id, userId);
    setBusy(false);
    if (r.status === 'saved') onChanged(); else setMsg(SAVE_STATUS_TEXT[r.status]);
  };
  return (
    <div style={{ borderTop: '1px solid #f1f5f9', padding: '8px 0' }} data-testid="final-dx-row">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>{stLuciaDay(s.completedAt)}</span>
        <span style={small}>
          Engines: {leader ? `${dxText(leader.diseaseId, leader.icd10)}${leader.probability !== null ? ` ${Math.round(leader.probability * 100)}%` : ''}` : '—'}
          {s.workingIcd10 || s.workingDiseaseId ? ` · Working: ${dxText(s.workingDiseaseId, s.workingIcd10)}` : ''}
        </span>
        {outcome ? (
          <span style={{ fontSize: 12, color: '#166534', fontWeight: 700 }}>
            Final: {dxText(outcome.finalDiseaseId, outcome.finalIcd10)} ({OUTCOME_SOURCE_LABELS[outcome.sourceType]}, {outcome.sourceDate})
          </span>
        ) : due ? (
          <span data-testid="final-dx-due" style={{ fontSize: 11.5, fontWeight: 700, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 999, padding: '1px 8px' }}>
            Final diagnosis not yet recorded
          </span>
        ) : null}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {outcome ? (
            <button type="button" style={btn(false, busy)} disabled={busy} onClick={() => void retract()}
              title="Keeps the row, marks it retracted; then record the correct one">Retract</button>
          ) : (
            <button type="button" style={btn(!open)} onClick={onOpen}>{open ? 'Cancel' : 'Record final diagnosis'}</button>
          )}
        </span>
      </div>
      {msg && <div style={{ ...small, color: '#b91c1c' }}>{msg}</div>}
      {open && !outcome && <FinalDiagnosisForm snapshot={s} onSaved={onChanged} userId={userId} />}
    </div>
  );
}

type ActionState = Record<string, 'done' | 'not' | 'unknown'>;

function FinalDiagnosisForm({ snapshot: s, onSaved, userId }: { snapshot: StoredSnapshot; onSaved: () => void; userId: string | null }) {
  const suggestion: DiagnosisOption | null = s.workingIcd10
    ? { icd10: s.workingIcd10, diseaseId: s.workingDiseaseId ?? paneIdForIcd(s.workingIcd10), label: paneLabel(s.workingDiseaseId) ?? 'Working diagnosis', source: 'code' }
    : null;
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<DiagnosisOption | null>(null);
  const [sourceType, setSourceType] = useState<OutcomeSourceType>(s.outcomeTriggers.includes('pathology') ? 'histology' : s.outcomeTriggers.includes('operation') ? 'operative_findings' : 'follow_up');
  const [sourceDate, setSourceDate] = useState(stLuciaToday());
  const [acuity, setAcuity] = useState<CommonAcuity | ''>('');
  const gradedOptions = s.decisionBands.filter(b => b.band === 'treat' || b.band === 'observe' || b.band === 'not-for-patient');
  const [actions, setActions] = useState<ActionState>({});
  const [clientRef] = useState(newClientRef);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const results = useMemo(() => searchFinalDiagnoses(query), [query]);

  const save = async () => {
    if (!picked) return;
    const parsed = sanitizeFinalDiagnosis({
      encounterRef: s.encounterRef, finalIcd10: picked.icd10, finalDiseaseId: picked.diseaseId ?? paneIdForIcd(picked.icd10),
      sourceType, sourceDate, retrospectiveAcuity: acuity || null,
      actionsTaken: Object.entries(actions).filter(([, v]) => v !== 'unknown').map(([optionId, v]) => ({ optionId, done: v === 'done' })),
    });
    if (!parsed.ok) { setMsg(`Not saved: ${parsed.error}.`); return; }
    setBusy(true);
    const r = await saveFinalDiagnosis({ diagnosis: parsed.value, patientId: s.patientId, encounterId: s.encounterId, clientRef, userId });
    setBusy(false);
    if (r.status === 'saved') onSaved(); else setMsg(SAVE_STATUS_TEXT[r.status]);
  };

  const label: CSSProperties = { fontSize: 11.5, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 2 };
  const input: CSSProperties = { fontSize: 12.5, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1' };
  return (
    <div style={{ marginTop: 8, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, display: 'grid', gap: 8 }} data-testid="final-dx-form">
      <div>
        <span style={label}>Final diagnosis (ICD-10)</span>
        {picked ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <strong style={{ fontSize: 12.5 }}>{picked.icd10} {picked.label}</strong>
            {picked.diseaseId && <span style={small}>PANE: {picked.diseaseId}</span>}
            <button type="button" style={btn()} onClick={() => setPicked(null)}>Change</button>
          </div>
        ) : (
          <>
            {suggestion && (
              <button type="button" style={{ ...btn(), marginBottom: 6 }} onClick={() => setPicked(suggestion)}>
                Same as the working diagnosis: {suggestion.icd10} {suggestion.label}
              </button>
            )}
            <input style={{ ...input, width: '100%' }} placeholder="Search a diagnosis or type an ICD-10 code" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search final diagnosis" />
            {results.length > 0 && (
              <div style={{ display: 'grid', gap: 2, marginTop: 4, maxHeight: 180, overflowY: 'auto' }}>
                {results.map(o => (
                  <button key={`${o.icd10}|${o.diseaseId ?? ''}`} type="button" onClick={() => setPicked(o)}
                    style={{ textAlign: 'left', fontSize: 12, padding: '3px 8px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>
                    <strong>{o.icd10}</strong> {o.label}{o.diseaseId ? '' : ' (no PANE node)'}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <label>
          <span style={label}>Source</span>
          <select style={input} value={sourceType} onChange={e => setSourceType(e.target.value as OutcomeSourceType)}>
            {OUTCOME_SOURCE_TYPES.map(t => <option key={t} value={t}>{OUTCOME_SOURCE_LABELS[t]}</option>)}
          </select>
        </label>
        <label>
          <span style={label}>Date of the source</span>
          <input type="date" style={input} value={sourceDate} max={stLuciaToday()} onChange={e => setSourceDate(e.target.value)} />
        </label>
        <label>
          <span style={label}>Urgency the case needed (optional)</span>
          <select style={input} value={acuity} onChange={e => setAcuity(e.target.value as CommonAcuity | '')}>
            <option value="">Not assessed</option>
            {COMMON_ACUITIES.map(a => <option key={a} value={a}>{ACUITY_LABELS[a]}</option>)}
          </select>
        </label>
      </div>
      {gradedOptions.length > 0 && (
        <div>
          <span style={label}>What was done (optional; compares the decision bands)</span>
          {gradedOptions.map(b => (
            <div key={`${b.decisionId}|${b.optionId}`} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
              <span style={{ minWidth: 200 }}>{b.optionId.replace(/[-_]/g, ' ')} <span style={small}>(suggested: {b.band})</span></span>
              <select style={input} value={actions[b.optionId] ?? 'unknown'}
                onChange={e => setActions(a => ({ ...a, [b.optionId]: e.target.value as ActionState[string] }))}
                aria-label={`Was ${b.optionId} done`}>
                <option value="unknown">Not recorded</option>
                <option value="done">Done</option>
                <option value="not">Not done</option>
              </select>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button type="button" style={btn(true, !picked || busy)} disabled={!picked || busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Confirm final diagnosis'}
        </button>
        {msg && <span style={{ ...small, color: '#b91c1c' }}>{msg}</span>}
      </div>
    </div>
  );
}
