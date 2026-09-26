/**
 * outcomes:calibration — reads a research export or database rows, reports, proposes, and never
 * touches the model (the PANE disease table is identical before and after).
 */
import { describe, expect, it } from 'vitest';
import { DISEASES } from '../../lib/pane-engine/src/index';
import { buildOutputs, parseInput } from './outcomes-calibration';

const NOW = new Date('2026-09-26T12:00:00.000Z');

function row(i: number, finalId: string, features: Record<string, boolean>) {
  const ref = `web:eeeeeeee-0000-4000-8000-${String(i).padStart(12, '0')}`;
  return {
    snapshot: {
      patient_id: 'p', encounter_id: null, encounter_ref: ref, platform: 'web', completed_at: '2026-08-01T12:00:00Z',
      snapshot_version: 1, differential_engine: 'pane', differential_model_version: '1.0.1', model_versions: { pane: '1.0.1' },
      top_differential: [{ rank: 1, diseaseId: 'appendicitis', icd10: 'K35.80', probability: 0.6 }, { rank: 2, diseaseId: 'cholecystitis', icd10: 'K81.0', probability: 0.2 }],
      triage_level: 'priority', triage_scale: 'web-adaptive', scores: [], decision_bands: [], features,
      working_disease_id: null, working_icd10: null, recorded_icd10: [], expects_outcome: true, outcome_triggers: ['operation'],
    },
    outcome: {
      patient_id: 'p', encounter_id: null, encounter_ref: ref, client_ref: null, final_icd10: finalId === 'appendicitis' ? 'K35.80' : 'K81.0',
      final_disease_id: i % 3 === 0 ? null : finalId, source_type: 'histology', source_date: '2026-08-10', actions_taken: [],
      retrospective_acuity: 'urgent', status: 'confirmed',
    },
  };
}

describe('outcomes:calibration', () => {
  const rows = Array.from({ length: 40 }, (_, i) => row(i, i < 30 ? 'appendicitis' : 'cholecystitis', { fever: i < 28 }));
  const input = parseInput({ snapshots: rows.map(r => r.snapshot), outcomes: rows.map(r => r.outcome) });

  it('parses database rows (sanitised) and computes the report', () => {
    expect(input.snapshots).toHaveLength(40);
    expect(input.outcomes).toHaveLength(40);
    const before = JSON.stringify(DISEASES);
    const { report, proposals } = buildOutputs(input, NOW);
    expect(report.accuracy[0]).toMatchObject({ engine: 'pane@1.0.1', n: 40 });
    expect(report.accuracy[0].top1.k).toBe(30);
    expect(report.accuracy[0].top3.k).toBe(40);
    expect(proposals.status).toMatch(/not applied/);
    expect(proposals.casesUsed).toBe(40);
    // A proposal is computed, but the model itself is untouched.
    expect(JSON.stringify(DISEASES)).toBe(before);
  });

  it('respects the minimum counts passed on the command line (undefined keeps the default)', () => {
    const strict = buildOutputs(input, NOW, { minCasesPrior: 1000, minCasesLikelihood: 1000, dueDays: undefined });
    expect(strict.proposals.priors).toHaveLength(0);
    expect(strict.proposals.likelihoods).toHaveLength(0);
    const defaults = buildOutputs(input, NOW, { minCasesPrior: undefined });
    expect(defaults.proposals.options.minCasesPrior).toBe(10);
  });

  it('refuses input it does not recognise', () => {
    expect(() => parseInput({ rows: [] })).toThrow(/research export/);
  });
});
