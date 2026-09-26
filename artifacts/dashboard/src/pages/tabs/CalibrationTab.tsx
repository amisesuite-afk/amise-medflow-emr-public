import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  DEFAULT_OUTCOME_DUE_DAYS, calibrationReportMarkdown, computeCalibrationReport, joinCases, pendingOutcomes,
  proposalsMarkdown, proposeAdjustments,
} from '@workspace/triage-engine/outcomes';
import type { CalibrationReport, Proportion, ProposalSet } from '@workspace/triage-engine/outcomes';
import { getApiOrigin } from '@/lib/api-origin';
import { staffAuthHeaders } from '@/lib/staff-auth';
import { supabase } from '@/lib/supabase';
import { loadOutcomeData } from '@/lib/outcomes-db';
import type { OutcomeData } from '@/lib/outcomes-db';
import { paneShrinkageModel } from '@/lib/outcomes-model';

const wrap: CSSProperties = { padding: '14px 18px', color: '#0f172a', display: 'grid', gap: 14, maxWidth: 1100 };
const card: CSSProperties = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' };
const h: CSSProperties = { fontSize: 14, fontWeight: 800, margin: '0 0 6px' };
const small: CSSProperties = { fontSize: 12, color: '#64748b' };
const th: CSSProperties = { textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: '#475569', padding: '4px 8px', borderBottom: '1px solid #e2e8f0' };
const td: CSSProperties = { fontSize: 12.5, padding: '4px 8px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' };
const btn: CSSProperties = { padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid #cbd5e1', background: '#fff', color: '#334155' };

function pct(p: Proportion): string {
  if (p.rate === null) return '—';
  return `${(p.rate * 100).toFixed(1)}% (${(p.ci.low * 100).toFixed(0)}–${(p.ci.high * 100).toFixed(0)}%) · ${p.k}/${p.n}`;
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead><tr>{head.map(x => <th key={x} style={th}>{x}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={td}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/**
 * Engine accuracy (admin only): prediction snapshots joined to confirmed final diagnoses —
 * accuracy, calibration, Brier, per-diagnosis sensitivity / PPV, triage, decision-band agreement
 * — and proposed PANE adjustments for the surgeon's sign-off. Report only: nothing on this page
 * changes an engine. The research export is de-identified, admin-only and audit-logged by the
 * API before it is released.
 */
export default function CalibrationTab() {
  const [data, setData] = useState<OutcomeData | null>(null);
  const [mrns, setMrns] = useState<Record<string, string>>({});
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { void loadOutcomeData(null).then(setData); }, []);

  const now = useMemo(() => new Date(), [data]);
  const report: CalibrationReport | null = useMemo(
    () => (data?.available ? computeCalibrationReport(data.snapshots, data.outcomes, { now }) : null), [data, now]);
  const proposals: ProposalSet | null = useMemo(() => {
    if (!data?.available) return null;
    const { cases } = joinCases(data.snapshots.filter(s => s.differentialEngine === 'pane'), data.outcomes);
    return proposeAdjustments(cases, paneShrinkageModel(), { now });
  }, [data, now]);
  const pending = useMemo(
    () => (data?.available ? pendingOutcomes(data.snapshots, data.outcomes, now, DEFAULT_OUTCOME_DUE_DAYS) : []), [data, now]);

  useEffect(() => {
    const ids = [...new Set(pending.slice(0, 50).map(s => s.patientId).filter(Boolean))];
    if (!ids.length || !supabase) return;
    void supabase.from('patients').select('id, mrn').in('id', ids).then(({ data: rows }) => {
      const m: Record<string, string> = {};
      for (const r of (rows ?? []) as { id: string; mrn: string | null }[]) if (r.mrn) m[r.id] = r.mrn;
      setMrns(m);
    });
  }, [pending]);

  const researchExport = async () => {
    setExporting(true); setExportMsg(null);
    try {
      const res = await fetch(`${getApiOrigin()}/api/outcomes/research-export`, { headers: { ...(await staffAuthHeaders()) as Record<string, string> } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) setExportMsg(body.error ?? `Export refused (HTTP ${res.status}).`);
      else if (body.available === false) setExportMsg(body.reason ?? 'The outcome tables are not available yet.');
      else {
        download(`amise-outcomes-${body.generatedMonth}-deidentified.json`, JSON.stringify(body, null, 2), 'application/json');
        setExportMsg(`Exported ${body.cases?.length ?? 0} de-identified cases. The export was recorded in the audit log.`);
      }
    } catch {
      setExportMsg('The API server could not be reached.');
    }
    setExporting(false);
  };

  if (!data) return <div style={wrap}><span style={small}>Loading…</span></div>;
  if (!data.available) {
    return (
      <div style={wrap} data-testid="calibration-unavailable">
        <div style={card}>
          <div style={h}>Engine accuracy</div>
          <div style={small}>Available after the database update (Migration 94, prediction snapshots and final diagnoses).</div>
        </div>
      </div>
    );
  }
  if (!report || !proposals) return null;

  return (
    <div style={wrap} data-testid="calibration-page">
      <div style={card}>
        <div style={h}>Engine accuracy on this practice's patients</div>
        <div style={small}>
          {report.snapshots} completed encounters with a prediction snapshot · {report.outcomes} confirmed final diagnoses ·{' '}
          <strong>{report.cases} matched cases</strong> · {report.pendingOutcomes} final diagnoses overdue (&gt; {DEFAULT_OUTCOME_DUE_DAYS} days after an operation or pathology).
        </div>
        <div style={{ ...small, marginTop: 4, color: '#92400e' }}>Report only. Nothing on this page changes an engine; proposals below need the surgeon's sign-off.</div>
        {data.error && <div style={{ ...small, color: '#b91c1c' }}>{data.error}</div>}
        <ul style={{ ...small, margin: '6px 0 0', paddingLeft: 18 }}>{report.notes.map(n => <li key={n}>{n}</li>)}</ul>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <button type="button" style={btn} onClick={() => download(`calibration-report-${now.toISOString().slice(0, 10)}.md`, calibrationReportMarkdown(report), 'text/markdown')}>Download report (Markdown)</button>
          <button type="button" style={btn} onClick={() => download(`calibration-report-${now.toISOString().slice(0, 10)}.json`, JSON.stringify(report, null, 2), 'application/json')}>Download report (JSON)</button>
          <button type="button" style={btn} disabled={exporting} onClick={() => void researchExport()} data-testid="research-export">
            {exporting ? 'Exporting…' : 'Research export (de-identified, audit-logged)'}
          </button>
        </div>
        {exportMsg && <div style={{ ...small, marginTop: 6 }}>{exportMsg}</div>}
      </div>

      <div style={card}>
        <div style={h}>Accuracy by engine and model version</div>
        <Table head={['Engine', 'Cases', 'Top-1', 'Top-3', 'Top-5', 'Brier', 'Leader Brier', 'Overconfident leaders']}
          rows={report.accuracy.map(a => [a.engine, a.n, pct(a.top1), pct(a.top3), pct(a.top5), a.brier ?? '—', a.top1Brier ?? '—', a.overconfidentLeaders])} />
        {report.accuracy.length === 0 && <div style={small}>No matched cases yet.</div>}
      </div>

      {report.reliability.map(r => (
        <div key={r.engine} style={card}>
          <div style={h}>Calibration — {r.engine}</div>
          <div style={small}>Each listed candidate's probability against how often it was the final diagnosis.</div>
          <Table head={['Predicted', 'Candidates', 'Mean predicted', 'Observed (95% CI)']}
            rows={r.bins.filter(b => b.n > 0).map(b => [
              `${(b.range[0] * 100).toFixed(0)}–${(b.range[1] * 100).toFixed(0)}%`, b.n,
              b.meanPredicted === null ? '—' : `${(b.meanPredicted * 100).toFixed(1)}%`, pct(b.observed),
            ])} />
        </div>
      ))}

      {report.perDiagnosis.map(p => (
        <div key={p.engine} style={card}>
          <div style={h}>Per diagnosis — {p.engine}</div>
          <Table head={['Final diagnosis', 'Cases', 'Sensitivity (top-1)', 'Sensitivity (top-3)', 'PPV (top-1)']}
            rows={p.rows.slice(0, 40).map(d => [d.key, d.cases, pct(d.sensitivityTop1), pct(d.sensitivityTop3), pct(d.ppvTop1)])} />
        </div>
      ))}

      <div style={card}>
        <div style={h}>Triage against the urgency the case needed</div>
        {report.triage.length === 0
          ? <div style={small}>No case has both a triage level and a retrospective urgency recorded yet.</div>
          : <Table head={['Scale', 'Cases', 'Agree', 'Over-triage', 'Under-triage']}
              rows={report.triage.map(t => [t.scale, t.n, pct(t.agree), pct(t.over), <strong key="u">{pct(t.under)}</strong>])} />}
      </div>

      <div style={card}>
        <div style={h}>Decision bands against what was done</div>
        <div style={small}>Overall agreement: {pct(report.bands.overall)}. Treat + done and observe / not for this patient + not done agree; test bands are not graded.</div>
        {report.bands.rows.length > 0 && (
          <Table head={['Decision', 'Option', 'Band', 'Graded', 'Agree', 'Disagree', 'Not graded']}
            rows={report.bands.rows.map(b => [b.decisionId, b.optionId, b.band, b.graded, b.agree, b.disagree, b.notGraded])} />
        )}
      </div>

      <div style={card} data-testid="calibration-proposals">
        <div style={h}>Proposed adjustments — PANE {proposals.modelVersion} (for sign-off; never applied automatically)</div>
        <div style={small}>
          Empirical Bayes, shrunk towards the current values: priors need ≥ {proposals.options.minCasesPrior} cases of a diagnosis and a change of tier;
          likelihoods need ≥ {proposals.options.minCasesLikelihood} recorded cases and a change ≥ {proposals.options.minLikelihoodChange}. {proposals.casesUsed} confirmed cases used.
        </div>
        <ul style={{ ...small, margin: '6px 0', paddingLeft: 18 }}>{proposals.caveats.map(c => <li key={c}>{c}</li>)}</ul>
        {proposals.priors.length > 0 && (
          <Table head={['Disease', 'Cases', 'Current prior (tier)', 'Proposed prior (tier)', 'Share: current → proposed (95% CrI)']}
            rows={proposals.priors.map(x => [x.diseaseId, `${x.cases}/${x.totalCases}`, `${x.currentPrior} (${x.currentTier ?? '—'})`,
              `${x.proposedPrior} (${x.proposedTier ?? '—'})`, `${x.currentShare} → ${x.proposedShare} (${x.shareInterval.low}–${x.shareInterval.high})`])} />
        )}
        {proposals.likelihoods.length > 0 && (
          <Table head={['Disease', 'Feature', 'Present / recorded', 'Current', 'Proposed (95% CrI)', 'LR vs background']}
            rows={proposals.likelihoods.map(x => [x.diseaseId, x.featureId, `${x.present}/${x.recorded}`, x.current,
              `${x.proposed} (${x.interval.low}–${x.interval.high})`, `${x.currentLrVsBackground ?? '—'} → ${x.proposedLrVsBackground ?? '—'}`])} />
        )}
        {proposals.priors.length === 0 && proposals.likelihoods.length === 0 && (
          <div style={small}>No proposal yet: not enough confirmed cases for any prior or likelihood.</div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button type="button" style={btn} onClick={() => download(`pane-${proposals.modelVersion}-proposals.json`, JSON.stringify(proposals, null, 2), 'application/json')}>Download proposals (JSON)</button>
          <button type="button" style={btn} onClick={() => download(`pane-${proposals.modelVersion}-proposals.md`, proposalsMarkdown(proposals), 'text/markdown')}>Download proposals (Markdown diff)</button>
        </div>
        <div style={{ ...small, marginTop: 4 }}>iOS (DiagnosticDatabase): accuracy is reported above once iOS snapshots reach the server; iOS weight proposals wait for the log-unit fixes (C-2 to C-4 in docs/CLINICAL-CONTENT-UPGRADES.md).</div>
      </div>

      <div style={card}>
        <div style={h}>Final diagnoses overdue</div>
        {pending.length === 0 ? <div style={small}>None.</div> : (
          <>
            <div style={small}>Open the patient's summary to record the final diagnosis.</div>
            <Table head={['Completed', 'MRN', 'Expected from']}
              rows={pending.slice(0, 50).map(s => [
                new Date(s.completedAt).toLocaleDateString('en-CA', { timeZone: 'America/St_Lucia' }),
                mrns[s.patientId] ?? '—',
                s.outcomeTriggers.join(', '),
              ])} />
          </>
        )}
      </div>
    </div>
  );
}
