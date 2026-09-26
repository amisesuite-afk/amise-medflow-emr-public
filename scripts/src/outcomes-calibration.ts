/**
 * Outcomes loop — calibration report and proposed PANE adjustments, offline.
 *
 *   pnpm --filter @workspace/scripts run outcomes:calibration -- --input export.json [--out dir]
 *   pnpm --filter @workspace/scripts run outcomes:calibration -- --supabase [--out dir]
 *
 * Input:
 *   --input <file>  a de-identified research export (GET /api/outcomes/research-export, the admin
 *                   page's "Research export") or { "snapshots": [...rows], "outcomes": [...rows] }
 *                   with Migration 94 column names.
 *   --supabase      reads prediction_snapshots and diagnosis_outcomes with SUPABASE_URL and
 *                   SUPABASE_SERVICE_ROLE_KEY (PostgREST, read-only). Missing tables (Migration 94
 *                   not applied) are reported and the script exits 0 without writing a report.
 * Options: --out <dir> (default outcomes-calibration-out/, git-ignored), --due-days N,
 *          --min-cases-prior N, --min-cases-likelihood N, --prior-concentration N,
 *          --likelihood-pseudo-cases N, --min-likelihood-change X.
 *
 * Writes calibration-report.json / .md and pane-<version>-proposals.json / .md (a review diff with
 * counts and 95% credible intervals). It never edits an engine file: applying a proposal is a
 * content change with its own version bump, clinval A/B and the surgeon's sign-off
 * (docs/CLINICAL-CONTENT-UPGRADES.md §4.6).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calibrationReportMarkdown, computeCalibrationReport, joinCases, proposalsMarkdown, proposeAdjustments,
  researchExportToCases, rowToOutcome, rowToSnapshot,
} from '../../lib/triage-engine/src/outcomes/index';
import type {
  CalibrationReport, DiagnosisOutcomeRow, FinalDiagnosis, PredictionSnapshot, PredictionSnapshotRow, ProposalSet,
  ResearchExport, ShrinkageOptions,
} from '../../lib/triage-engine/src/outcomes/index';
import { paneShrinkageModel } from '../../artifacts/dashboard/src/lib/outcomes-model';

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

export interface CalibrationInput { snapshots: PredictionSnapshot[]; outcomes: FinalDiagnosis[] }

/** Accepts a research export or { snapshots, outcomes } database rows. */
export function parseInput(json: unknown): CalibrationInput {
  const x = json as Record<string, unknown>;
  if (x && x.format === 'deidentified-v1' && Array.isArray(x.cases)) return researchExportToCases(x as unknown as ResearchExport);
  if (x && Array.isArray(x.snapshots) && Array.isArray(x.outcomes)) {
    return {
      snapshots: (x.snapshots as PredictionSnapshotRow[]).map(rowToSnapshot).filter((s): s is PredictionSnapshot => !!s),
      outcomes: (x.outcomes as DiagnosisOutcomeRow[]).map(rowToOutcome).filter((o): o is FinalDiagnosis => !!o),
    };
  }
  throw new Error('Input must be a research export (format "deidentified-v1") or { "snapshots": [...], "outcomes": [...] }');
}

export function buildOutputs(input: CalibrationInput, now: Date, opts: { dueDays?: number } & Partial<ShrinkageOptions> = {}): {
  report: CalibrationReport; proposals: ProposalSet;
} {
  const report = computeCalibrationReport(input.snapshots, input.outcomes, { now, dueDays: opts.dueDays });
  const { cases } = joinCases(input.snapshots.filter(s => s.differentialEngine === 'pane'), input.outcomes);
  const proposals = proposeAdjustments(cases, paneShrinkageModel(), { ...opts, now });
  return { report, proposals };
}

class MissingTable extends Error {}

async function fetchTable<T>(url: string, key: string, table: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/${table}?select=*&order=created_at.asc`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}`, 'Range-Unit': 'items' },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { code?: string; message?: string };
      if (body.code === 'PGRST205' || body.code === '42P01' || res.status === 404) throw new MissingTable(table);
      throw new Error(`${table}: HTTP ${res.status} ${body.message ?? ''}`);
    }
    const rows = await res.json() as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function num(name: string): number | undefined {
  const v = arg(name);
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number`);
  return n;
}

async function main(): Promise<void> {
  let input: CalibrationInput;
  const file = arg('--input');
  if (file) {
    input = parseInput(JSON.parse(readFileSync(resolve(file), 'utf8')));
  } else if (process.argv.includes('--supabase')) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) { console.error('--supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'); process.exit(2); }
    try {
      input = parseInput({
        snapshots: await fetchTable<PredictionSnapshotRow>(url, key, 'prediction_snapshots'),
        outcomes: await fetchTable<DiagnosisOutcomeRow>(url, key, 'diagnosis_outcomes'),
      });
    } catch (e) {
      if (e instanceof MissingTable) {
        console.log(`The outcome tables are not in this database yet (${e.message} missing: Migration 94 not applied). Nothing to report.`);
        return;
      }
      throw e;
    }
  } else {
    console.error('Usage: outcomes:calibration -- --input <export.json> | --supabase [--out <dir>]');
    process.exit(2);
  }

  const outDir = resolve(arg('--out') ?? join(REPO_ROOT, 'outcomes-calibration-out'));
  const { report, proposals } = buildOutputs(input, new Date(), {
    dueDays: num('--due-days'), minCasesPrior: num('--min-cases-prior'), minCasesLikelihood: num('--min-cases-likelihood'),
    priorConcentration: num('--prior-concentration'), likelihoodPseudoCases: num('--likelihood-pseudo-cases'),
    minLikelihoodChange: num('--min-likelihood-change'),
  });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'calibration-report.json'), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(join(outDir, 'calibration-report.md'), calibrationReportMarkdown(report));
  const base = `pane-${proposals.modelVersion}-proposals`;
  writeFileSync(join(outDir, `${base}.json`), JSON.stringify(proposals, null, 2) + '\n');
  writeFileSync(join(outDir, `${base}.md`), proposalsMarkdown(proposals));
  console.log(`${report.cases} matched cases (${report.snapshots} snapshots, ${report.outcomes} final diagnoses, ${report.pendingOutcomes} overdue).`);
  for (const a of report.accuracy) {
    console.log(`  ${a.engine}: top-1 ${a.top1.k}/${a.n}, top-3 ${a.top3.k}/${a.n}, Brier ${a.brier ?? '—'}`);
  }
  console.log(`Proposals (not applied): ${proposals.priors.length} prior, ${proposals.likelihoods.length} likelihood. Written to ${outDir}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
