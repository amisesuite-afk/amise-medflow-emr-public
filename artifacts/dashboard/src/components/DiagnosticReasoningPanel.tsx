/**
 * "Diagnostic reasoning" — Assessment step. Deterministic, engine-derived (PANE); no AI.
 *
 * Shows, for the leading diagnoses, the recorded findings for / against / missing / that don't fit
 * (with each finding's likelihood ratio and source), the best next discriminator, "Doesn't fit the
 * working diagnosis" alerts, a diagnostic time-out, the zebra check and the longitudinal pattern
 * view. Nothing is written to the record except by an explicit tap ("Add to differential",
 * "Add test to plan"). lib/diagnostic-reasoning.ts holds the logic; iOS twin:
 * ios/AmiseMedFlow/Views/Consultation/DiagnosticReasoningCard.swift.
 *
 * Keyboard: Alt+R opens / closes the panel.
 */
import { useEffect, useMemo, useState } from 'react';
import { DISEASES, applyModifiers } from '@workspace/pane-engine';
import type { EvidenceLine, Explanation, LongitudinalInput, MeasurementPoint } from '@workspace/triage-engine/diagnostic-reasoning';
import { fmtPct, formatLr, lowerFirst, TIME_OUT_SOURCES, ZEBRA_RULES_VERSION } from '@workspace/triage-engine/diagnostic-reasoning';
import CollapsibleCard from '@/components/CollapsibleCard';
import { useAppContext } from '@/context/AppContext';
import { isConfirmedDiagnosis } from '@/lib/diagnosis-suggestion';
import {
  buildDiagnosticReasoning, news2Series, numericLabs, reasoningRecordText,
} from '@/lib/diagnostic-reasoning';
import type { EvidenceMove, ExamEvidenceLine } from '@/lib/diagnostic-reasoning';
import { paneContextFromConsultation } from '@/lib/socrates-to-features';
import { listPatientEncounters, loadPatientLabResults } from '@/lib/db';
import type { EncounterSummary, ImportedLabResultRow } from '@/lib/db';
import { currentComplaintText, firstClinicalLine } from '@/lib/visit-continuity-web';

const C = {
  ink: 'var(--ink, #122320)',
  muted: '#5a706c',
  line: 'rgba(15,95,118,0.18)',
  forFg: '#0b6b52', forBg: 'rgba(16,185,129,0.08)',
  againstFg: '#b91c1c', againstBg: 'rgba(239,68,68,0.07)',
  missingFg: '#475569', missingBg: 'rgba(148,163,184,0.12)',
  fitFg: '#a16207', fitBg: 'rgba(234,179,8,0.10)',
  accent: '#0f766e',
};

const COST_LABEL: Record<string, string> = { ask: 'Ask', bedside: 'Bedside', lab: 'Lab', imaging: 'Imaging', advanced: 'Advanced' };

function num(v: string | undefined | null): number | null {
  if (v === undefined || v === null || !String(v).trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function Chip({ children, title, fg, bg }: { children: React.ReactNode; title?: string; fg: string; bg: string }) {
  return (
    <span title={title} style={{
      display: 'inline-block', fontSize: 11, lineHeight: '16px',
      padding: '1px 6px', borderRadius: 4, color: fg, background: bg, border: `1px solid ${bg}`,
    }}>{children}</span>
  );
}

function EvidenceList({ title, items, fg, bg, empty, render }: {
  title: string; items: EvidenceLine[]; fg: string; bg: string; empty: string;
  render: (e: EvidenceLine) => React.ReactNode;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: fg, marginBottom: 3 }}>
        {title} {items.length > 0 && <span style={{ opacity: 0.7 }}>({items.length})</span>}
      </div>
      {items.length === 0
        ? <div style={{ fontSize: 11, color: C.muted }}>{empty}</div>
        : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {items.slice(0, 6).map(e => (
              <Chip key={e.findingId} fg={fg} bg={bg} title={`Source: ${e.source || 'engine'}`}>{render(e)}</Chip>
            ))}
            {items.length > 6 && <span style={{ fontSize: 11, color: C.muted }}>+{items.length - 6}</span>}
          </div>
        )}
    </div>
  );
}

/** " · 12 % → 28 %" for an examination-sign or decision-rule finding (the posterior it moved). */
function moved(moves: Record<string, EvidenceMove> | undefined, findingId: string): string {
  const m = moves?.[findingId];
  return m ? ` · ${fmtPct(m.from)} → ${fmtPct(m.to)}` : '';
}

const EFFECT_LABEL: Record<string, string> = {
  engine: 'applied', twin: 'recorded as a red-flag finding', display: 'shown only', 'not-applied': 'not applied',
};

/** Examination signs and decision rules recorded on the Exam / Scales steps, with what they did. */
function ExamEvidenceList({ lines }: { lines: ExamEvidenceLine[] }) {
  return (
    <div data-testid="reasoning-exam-evidence" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {lines.map(({ item, moves }) => (
        <div key={`${item.kind}:${item.id}`} style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${C.line}`, fontSize: 12, color: C.ink }}
          title={`${item.source}${item.fromMemory ? ' — value not yet verified against the source' : ''} (${item.quality})`}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <b>{item.label}</b>
            <span>{item.lr === null ? 'LR not established' : <>LR <b>{item.lrText}</b></>} for {item.target}</span>
            {moves.map(m => (
              <Chip key={m.label} fg={m.to >= m.from ? C.forFg : C.againstFg} bg={m.to >= m.from ? C.forBg : C.againstBg}>
                {m.label} {fmtPct(m.from)} → {fmtPct(m.to)}
              </Chip>
            ))}
            <Chip fg={C.missingFg} bg={C.missingBg}>{EFFECT_LABEL[item.effect] ?? item.effect}</Chip>
            {item.fromMemory && <Chip fg={C.fitFg} bg={C.fitBg} title="Awaiting verification against the source and the surgeon's sign-off">unverified</Chip>}
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>{item.risk ? `${item.risk}. ` : ''}{item.reason}.</div>
        </div>
      ))}
    </div>
  );
}

function HypothesisBlock({ e, rank, range, working, onAdd, moves }: {
  e: Explanation; rank: number | null; range: { low: number; high: number } | undefined; working: boolean; onAdd: () => void;
  moves?: Record<string, EvidenceMove>;
}) {
  const band = range && (range.high - range.low) >= 0.01 ? ` (${fmtPct(range.low)}–${fmtPct(range.high)} leaving out any one finding)` : '';
  return (
    <div data-testid="reasoning-hypothesis" style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>
          {rank !== null ? `${rank}. ` : ''}{e.label}
        </span>
        {working && <Chip fg="#fff" bg={C.accent}>working diagnosis</Chip>}
        <span style={{ fontSize: 11, color: C.muted }} title="Engine estimate, not a recorded fact">
          engine {fmtPct(e.probability)}{band}
        </span>
        {e.lowEvidence && <Chip fg={C.fitFg} bg={C.fitBg} title="No recorded finding supports it with a likelihood ratio of 2 or more">low evidence</Chip>}
        <span style={{ flex: 1 }} />
        <button type="button" onClick={onAdd} style={btn()} title="Adds this diagnosis to the differentials text">Add to differential</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
        <EvidenceList title="For" items={e.forFindings} fg={C.forFg} bg={C.forBg} empty="No recorded finding supports it"
          render={x => <>{x.label} <b>LR {formatLr(x.lr)}</b>{moved(moves, x.findingId)}</>} />
        <EvidenceList title="Against" items={e.against} fg={C.againstFg} bg={C.againstBg} empty="Nothing recorded against it"
          render={x => <>{x.status === 'absent' ? `no ${lowerFirst(x.label)}` : x.label} <b>LR {formatLr(x.lr)}</b>{moved(moves, x.findingId)}</>} />
        <EvidenceList title="Expected, missing" items={e.missing} fg={C.missingFg} bg={C.missingBg} empty="Cardinal findings all recorded"
          render={x => <>{x.label} <i>{x.documented ? 'absent' : 'not recorded'}</i></>} />
        <EvidenceList title="Doesn't fit" items={e.doesntFit} fg={C.fitFg} bg={C.fitBg} empty="Every recorded finding fits"
          render={x => <>{x.label}{x.favours ? <> → <b>{x.favours}</b></> : ' (unexplained)'}</>} />
      </div>
    </div>
  );
}

function btn(primary = false): React.CSSProperties {
  return {
    padding: '3px 9px', borderRadius: 4, fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
    border: primary ? 'none' : '1px solid #94a3b8', background: primary ? C.accent : 'transparent',
    color: primary ? '#fff' : '#334155',
  };
}

function sectionTitle(text: string, note?: string) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
      <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.accent }}>{text}</span>
      {note && <span style={{ fontSize: 11, color: C.muted }}>{note}</span>}
    </div>
  );
}

function labPoints(rows: ImportedLabResultRow[], names: RegExp, exclude: RegExp): MeasurementPoint[] {
  const out: MeasurementPoint[] = [];
  for (const r of rows) {
    const date = r.collected_at ?? r.reported_at ?? r.created_at;
    for (const a of r.analytes ?? []) {
      const name = typeof a.name === 'string' ? a.name : '';
      if (!names.test(name) || exclude.test(name)) continue;
      const v = typeof a.value === 'number' ? a.value : Number(String(a.value ?? '').replace(/[^\d.-]/g, ''));
      if (Number.isFinite(v) && date) out.push({ date, value: v });
    }
  }
  return out;
}

export default function DiagnosticReasoningPanel() {
  const app = useAppContext();
  const {
    paneState, age, sex, pregnancyPossible, workingDiagnosis, vitals, vitalRecords, labRecords, investigationResults,
    symptoms, comorbidities, medications, surgicalHistory, supplementHistory, freeText, procedureData,
    patientId, encounterId, differentials, setDifferentials, plan, setPlan, setActiveSection,
  } = app;
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [labRows, setLabRows] = useState<ImportedLabResultRow[]>([]);
  const [added, setAdded] = useState<Set<string>>(new Set());

  // Alt+R toggles the panel (keyboard-first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === 'r' || e.key === 'R' || e.code === 'KeyR')) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Read-only: earlier encounters and imported lab results for the longitudinal view.
  useEffect(() => {
    setDismissed(new Set());
    setAdded(new Set());
    if (!patientId) { setEncounters([]); setLabRows([]); return; }
    let live = true;
    void listPatientEncounters(patientId).then(list => { if (live) setEncounters(list); }).catch(() => undefined);
    void loadPatientLabResults(patientId).then(rows => { if (live) setLabRows(rows); }).catch(() => undefined);
    return () => { live = false; };
  }, [patientId, encounterId]);

  const reasoning = useMemo(() => {
    if (!paneState || Object.keys(paneState.answered ?? {}).length === 0) return null;
    const diseases = applyModifiers(DISEASES, parseInt(age, 10) || null, sex, undefined, { pregnancyPossible });
    const confirmed = isConfirmedDiagnosis(workingDiagnosis) ? workingDiagnosis : null;
    const readings = [
      ...[...vitalRecords].sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0)).map(r => ({
        respiratoryRate: num(r.rr), spo2: num(r.spo2), onOxygen: r.o2 === 'o2' ? true : r.o2 === 'air' ? false : null,
        systolicBP: num(r.sbp), heartRate: num(r.hr), temperatureCelsius: num(r.temp), avpu: r.avpu ?? null,
      })),
      {
        respiratoryRate: num(vitals.respiratoryRate), spo2: num(vitals.spo2),
        onOxygen: vitals.onSupplementalO2 === 'o2' ? true : vitals.onSupplementalO2 === 'air' ? false : null,
        systolicBP: num(vitals.systolicBp), heartRate: num(vitals.heartRate), temperatureCelsius: num(vitals.temperatureC),
        avpu: vitals.avpu || null,
      },
    ];
    const series = news2Series(readings);
    // The current reading is usually also the last charted record: drop an exact repeat.
    const dedup = series.length >= 2 && series[series.length - 1] === series[series.length - 2] ? series.slice(0, -1) : series;
    const ctx = paneContextFromConsultation(app);
    const complaint = currentComplaintText({ procedureData, symptoms, freeText });
    const supplements = supplementHistory.status === 'taking' ? supplementHistory.entries.map(e => e.name) : [];
    const recordLabs = labRecords.flatMap(r => r.tests.map(t => ({ name: t.name, value: t.value, date: r.timestamp })));
    const labMap: Record<string, string> = { ...investigationResults };
    for (const l of recordLabs) if (!(l.name in labMap)) labMap[l.name] = l.value;
    const recordPoints = (re: RegExp, ex: RegExp): MeasurementPoint[] => recordLabs
      .filter(l => re.test(l.name) && !ex.test(l.name) && Number.isFinite(Number(l.value)) && String(l.value).trim() !== '')
      .map(l => ({ date: l.date, value: Number(l.value) }));
    const CREAT = /\bcreatinine\b/i; const CREAT_X = /ratio|clearance|urine/i;
    const HB = /\b(haemoglobin|hemoglobin|hb|hgb)\b/i; const HB_X = /a1c|glycated|mean|urine/i;
    const longitudinal: LongitudinalInput = {
      visits: encounters.filter(e => e.id !== encounterId && e.status !== 'cancelled').map(e => ({
        date: e.createdAt, complaint: firstClinicalLine(e.chiefComplaint, 300), diagnosis: firstClinicalLine(e.diagnosis),
      })),
      creatinine: [...labPoints(labRows, CREAT, CREAT_X), ...recordPoints(CREAT, CREAT_X)],
      haemoglobin: [...labPoints(labRows, HB, HB_X), ...recordPoints(HB, HB_X)],
      weight: vitalRecords.filter(r => num(r.weight) !== null).map(r => ({ date: r.timestamp, value: num(r.weight)! })),
    };
    return buildDiagnosticReasoning({
      state: paneState,
      diseases,
      working: confirmed ? {
        diseaseId: confirmed.diseaseId, icdCode: confirmed.icdCode,
        label: confirmed.diseaseLabel || confirmed.icdCode || 'Working diagnosis',
      } : null,
      news2Series: dedup,
      recordText: reasoningRecordText({
        chiefComplaint: complaint, narrative: ctx.narrative ?? [], symptoms, comorbidities,
        medications: [...medications, app.medicationsText].filter(Boolean), surgicalHistory,
        investigationResults: labMap, supplements,
      }),
      labs: numericLabs(labMap),
      longitudinal,
      currentComplaint: complaint,
      evidence: ctx.evidence ?? null,
    });
  // `app` is read only for the consultation text fields; the listed values cover its changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneState, age, sex, pregnancyPossible, workingDiagnosis, vitals, vitalRecords, labRecords, investigationResults,
    symptoms, comorbidities, medications, surgicalHistory, supplementHistory, freeText, procedureData, encounters, labRows,
    encounterId, app.hpiNotes, app.pmhNotes, app.examAbdomen, app.examGeneral, app.examCardio, app.examResp, app.examNeuro,
    app.examNotes, app.medicationsText, app.toxicHabits, app.examFindings, app.clinicalScores]);

  function addDifferential(name: string) {
    const current = differentials.trim();
    if (current.split('\n').some(l => l.trim().toLowerCase() === name.toLowerCase())) return;
    setDifferentials(current ? `${current}\n${name}` : name);
    setAdded(prev => new Set(prev).add(`dx:${name}`));
  }

  function addToPlan(line: string) {
    const current = plan.trim();
    if (current.includes(line)) return;
    setPlan(current ? `${current}\n${line}` : line);
    setAdded(prev => new Set(prev).add(`plan:${line}`));
  }

  const alerts = (reasoning?.closureAlerts ?? []).filter(a => !dismissed.has(a.key));

  return (
    <CollapsibleCard
      title="Diagnostic reasoning"
      badge={alerts.length ? `${alerts.length} doesn't fit` : reasoning?.timeOut.suggested ? 'time-out' : 'engine'}
      badgeVariant={alerts.length ? 'danger' : reasoning?.timeOut.suggested ? 'warn' : 'default'}
      open={open}
      onOpenChange={setOpen}
    >
      <div data-testid="diagnostic-reasoning" aria-keyshortcuts="Alt+R" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 11, color: C.muted, margin: 0 }}>
          Engine-derived suggestions (PANE model, deterministic) — findings are what the record says; likelihood ratios and
          percentages are engine estimates, not facts. Nothing is added to the record unless you tap. Alt+R hides this panel.
        </p>

        {!reasoning && (
          <div style={{ fontSize: 12, color: C.muted }}>
            Record the history, examination or results first: the reasoning panel explains the PANE differential once it has
            findings to work with.
          </div>
        )}

        {reasoning && (
          <>
            {/* ── Premature-closure guard ── */}
            {alerts.length > 0 && (
              <div role="alert" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {alerts.map(a => (
                  <div key={a.key} data-testid="reasoning-closure-alert" style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 10px', borderRadius: 6,
                    background: C.fitBg, border: '1px solid rgba(202,138,4,0.45)',
                  }}>
                    <span style={{ fontSize: 12.5, color: '#713f12', flex: 1 }}>{a.text}</span>
                    <button type="button" style={btn()} onClick={() => setDismissed(prev => new Set(prev).add(a.key))}
                      title="Hide this alert for this visit">Dismiss</button>
                  </div>
                ))}
              </div>
            )}

            {/* ── Diagnostic time-out ── */}
            {reasoning.timeOut.suggested && (
              <details data-testid="reasoning-timeout" style={{ border: `1px dashed ${C.line}`, borderRadius: 8, padding: '6px 10px' }}>
                <summary style={{ fontSize: 12.5, fontWeight: 700, color: C.ink, cursor: 'pointer' }}>
                  Diagnostic time-out suggested — {reasoning.timeOut.reasons.join(' ')}
                </summary>
                <ol style={{ margin: '6px 0 4px 18px', padding: 0, fontSize: 12, color: C.ink }}>
                  {reasoning.timeOut.checklist.map(q => <li key={q} style={{ marginBottom: 2 }}>{q}</li>)}
                </ol>
                <div style={{ fontSize: 10.5, color: C.muted }}>A prompt for reflection; nothing is recorded. {TIME_OUT_SOURCES[1]}</div>
              </details>
            )}

            {/* ── For / against / missing / doesn't fit ── */}
            {sectionTitle('Why these diagnoses', `${reasoning.findingsUsed} recorded finding${reasoning.findingsUsed === 1 ? '' : 's'} used`)}
            {reasoning.explanations.map((e, i) => (
              <HypothesisBlock
                key={e.hypothesisId}
                e={e}
                rank={i < 3 ? i + 1 : null}
                range={reasoning.ranges[e.hypothesisId]}
                working={reasoning.workingId === e.hypothesisId}
                onAdd={() => addDifferential(e.label)}
                moves={reasoning.evidenceMoves[e.hypothesisId]}
              />
            ))}

            {/* ── Examination signs and decision rules (Exam / Scales steps) ── */}
            {reasoning.examEvidence.length > 0 && (
              <>
                {sectionTitle('Examination signs and decision rules', 'likelihood ratio and how far each moved the probability (without it → with it)')}
                <ExamEvidenceList lines={reasoning.examEvidence} />
              </>
            )}

            {/* ── Best next discriminator ── */}
            {sectionTitle('Best next discriminator', reasoning.discriminators[0] ? `separates ${reasoning.discriminators[0].separates.join(' · ')}` : undefined)}
            {reasoning.discriminators.length === 0
              ? <div style={{ fontSize: 12, color: C.muted }}>No single question or test separates the leading diagnoses much further.</div>
              : reasoning.discriminators.map((d, i) => {
                const line = `Consider ${d.probe.label} — to separate ${d.separates.join(' / ')} (diagnostic reasoning suggestion)`;
                return (
                  <div key={d.probe.id} data-testid="reasoning-discriminator" style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 10px', borderRadius: 6,
                    border: `1px solid ${C.line}`, background: i === 0 ? 'rgba(15,118,110,0.05)' : 'transparent',
                  }}>
                    <Chip fg="#fff" bg={d.probe.cost === 'advanced' ? '#9a3412' : C.accent}>{COST_LABEL[d.probe.cost]}</Chip>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>{d.question}</div>
                      <div style={{ fontSize: 11.5, color: C.muted }}>
                        {d.why} <span title="Expected information gain over the diagnoses separated">(gain {d.probe.gain.toFixed(2)} nats)</span>
                      </div>
                    </div>
                    {d.probe.kind === 'investigation' && (
                      <button type="button" style={btn(!added.has(`plan:${line}`))} disabled={added.has(`plan:${line}`)}
                        onClick={() => addToPlan(line)} title="Adds a 'Consider …' line to the plan text; nothing is ordered">
                        {added.has(`plan:${line}`) ? 'Added' : 'Add test to plan'}
                      </button>
                    )}
                  </div>
                );
              })}

            {/* ── Zebra check ── */}
            {reasoning.zebras.length > 0 && (
              <>
                {sectionTitle('Zebra check', 'rare but real — the combination recorded fits')}
                {reasoning.zebras.map(z => (
                  <div key={z.id} data-testid="reasoning-zebra" style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${C.line}` }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: C.ink }}>{z.condition}</span>
                      <span style={{ fontSize: 11, color: C.muted }}>{z.icd10}</span>
                      {z.inDifferential && <Chip fg={C.forFg} bg={C.forBg}>already in the differential</Chip>}
                      <span style={{ flex: 1 }} />
                      {z.link === 'supplements' && (
                        <button type="button" style={btn()} onClick={() => setActiveSection('medications')}
                          title="Open the herbs, teas, bush remedies and supplements history">Supplements</button>
                      )}
                      <button type="button" style={btn()} onClick={() => addDifferential(z.condition)}
                        disabled={added.has(`dx:${z.condition}`)}>
                        {added.has(`dx:${z.condition}`) ? 'Added' : 'Add to differential'}
                      </button>
                    </div>
                    <div style={{ fontSize: 11.5, color: C.ink }}>{z.explains}. Recorded: {z.matched.join(' + ')}.</div>
                    <div style={{ fontSize: 10.5, color: C.muted }}>{z.citation}</div>
                  </div>
                ))}
              </>
            )}

            {/* ── Longitudinal pattern view ── */}
            {reasoning.longitudinal && (reasoning.longitudinal.recurring.length + reasoning.longitudinal.trends.length + reasoning.longitudinal.unheld.length) > 0 && (
              <>
                {sectionTitle('Across visits', 'read-only, from earlier encounters and results')}
                <ul data-testid="reasoning-longitudinal" style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.ink }}>
                  {reasoning.longitudinal.recurring.map(r => (
                    <li key={`r-${r.problem}`}>Recurring: {r.problem} — {r.count} visits ({r.dates.join(', ')})</li>
                  ))}
                  {reasoning.longitudinal.trends.map(t => <li key={`t-${t.analyte}`}>{t.text}</li>)}
                  {reasoning.longitudinal.unheld.map(u => (
                    <li key={`u-${u.date}-${u.diagnosis}`}>Earlier diagnosis revised: {u.diagnosis} ({u.date}) → {u.replacedBy} ({u.replacedOn})</li>
                  ))}
                </ul>
              </>
            )}

            <div style={{ fontSize: 10.5, color: C.muted }}>
              Diagnostic reasoning {reasoning.version} · zebra rules {ZEBRA_RULES_VERSION} · unreviewed content awaiting the surgeon&apos;s sign-off.
              The clinician decides; the engine only explains its own numbers.
            </div>
          </>
        )}
      </div>
    </CollapsibleCard>
  );
}
