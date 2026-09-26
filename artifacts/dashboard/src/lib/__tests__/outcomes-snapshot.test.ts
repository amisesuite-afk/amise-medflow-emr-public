/**
 * Outcomes loop — the web completion snapshot (lib/outcomes-snapshot.ts): coded data only, the
 * PANE leaders, the clinician's confirmed working diagnosis, triggers for a later final diagnosis,
 * and every version stamp.
 */
import { describe, expect, it } from 'vitest';
import { DISEASES, FEATURES, PANE_MODEL_VERSION } from '@workspace/pane-engine';
import { buildWebPredictionSnapshot, outcomeTriggers, webModelVersions } from '../outcomes-snapshot';
import type { WebSnapshotInput } from '../outcomes-snapshot';
import type { DecisionSupportResult } from '@workspace/pane-engine';

const ENC = '11111111-2222-4333-8444-555555555555';
const appendix = DISEASES.find(d => d.id === 'appendicitis')!;
const chole = DISEASES.find(d => d.id === 'cholecystitis')!;

function input(extra: Partial<WebSnapshotInput> = {}): WebSnapshotInput {
  return {
    encounterId: ENC,
    completedAt: '2026-09-26T14:00:00.000Z',
    paneTop: [{ disease: appendix, probability: 0.72 }, { disease: chole, probability: 0.11 }],
    paneState: { posteriors: {}, answered: { [FEATURES[0].id]: true, 'Mr Smith said so': true }, iteration: 1 },
    triageAcuity: 'priority',
    decision: null,
    decisionScores: [{ key: 'alvarado', value: 8, source: 'calculator' }],
    workingDiagnosis: { diseaseId: 'appendicitis', icdCode: 'K35.80', locked: true },
    icdCodes: ['K35.80 — Acute appendicitis'],
    cptCodes: [],
    orderedInvestigations: ['FBC', 'CRP'],
    ...extra,
  };
}

describe('buildWebPredictionSnapshot', () => {
  it('records the PANE leaders, triage, scores, working diagnosis and versions as codes', () => {
    const s = buildWebPredictionSnapshot(input())!;
    expect(s.encounterRef).toBe(`web:${ENC}`);
    expect(s.differentialEngine).toBe('pane');
    expect(s.differentialModelVersion).toBe(PANE_MODEL_VERSION);
    expect(s.modelVersions).toEqual(webModelVersions());
    expect(Object.keys(s.modelVersions).sort()).toEqual(['decision', 'emergency', 'management', 'pane', 'planSafety', 'reasoning', 'rules']);
    expect(s.topDifferential).toEqual([
      { rank: 1, diseaseId: 'appendicitis', icd10: appendix.icd10, probability: 0.72 },
      { rank: 2, diseaseId: 'cholecystitis', icd10: chole.icd10, probability: 0.11 },
    ]);
    expect(s.triageLevel).toBe('priority');
    expect(s.triageScale).toBe('web-adaptive');
    expect(s.scores).toEqual([{ key: 'alvarado', value: 8, source: 'calculator' }]);
    expect(s.workingDiseaseId).toBe('appendicitis');
    expect(s.workingIcd10).toBe('K35.80');
    expect(s.recordedIcd10).toEqual(['K35.80']);
    expect(s.features).toEqual({ [FEATURES[0].id]: true });
    expect(JSON.stringify(s)).not.toMatch(/Acute appendicitis|Smith|FBC/);
    expect(s.expectsOutcome).toBe(false);
  });

  it('an unconfirmed (PANE-suggested) working diagnosis is not recorded as the clinician\'s', () => {
    const s = buildWebPredictionSnapshot(input({ workingDiagnosis: { diseaseId: 'appendicitis', icdCode: 'K35.80', locked: false } }))!;
    expect(s.workingDiseaseId).toBeNull();
    expect(s.workingIcd10).toBeNull();
  });

  it('falls back to the stored PANE state when the live leaders are empty', () => {
    const s = buildWebPredictionSnapshot(input({
      paneTop: [],
      paneState: { posteriors: { cholecystitis: 0.6, appendicitis: 0.3 }, answered: {}, iteration: 2 },
    }))!;
    expect(s.topDifferential.map(d => d.diseaseId)).toEqual(['cholecystitis', 'appendicitis']);
  });

  it('keeps every decision option band', () => {
    const decision = {
      contentVersion: 'x', scoreActions: [], resultActions: [], activeFactors: [],
      decisions: [{ id: 'appendicitis', probability: 0.72, options: [
        { id: 'appendicectomy', kind: 'operation', band: 'treat' },
        { id: 'antibiotics-first', kind: 'antibiotic', band: 'observe' },
      ] }],
    } as unknown as DecisionSupportResult;
    const s = buildWebPredictionSnapshot(input({ decision }))!;
    expect(s.decisionBands).toEqual([
      { decisionId: 'appendicitis', optionId: 'appendicectomy', kind: 'operation', band: 'treat', probability: 0.72 },
      { decisionId: 'appendicitis', optionId: 'antibiotics-first', kind: 'antibiotic', band: 'observe', probability: 0.72 },
    ]);
  });

  it('flags a final diagnosis as expected after an operation or pathology (flags only)', () => {
    expect(outcomeTriggers({ cptCodes: ['44970'], orderedInvestigations: [] })).toEqual(['operation']);
    expect(outcomeTriggers({ cptCodes: [], procedureName: 'Laparoscopic appendicectomy', orderedInvestigations: [] })).toEqual(['operation']);
    expect(outcomeTriggers({ cptCodes: [], orderedInvestigations: ['Histology — appendix'] })).toEqual(['pathology']);
    expect(outcomeTriggers({ cptCodes: [], orderedInvestigations: [], radiologyStudies: ['US-guided core needle biopsy'] })).toEqual(['pathology']);
    expect(outcomeTriggers({ cptCodes: [], orderedInvestigations: ['FBC', 'Biochemistry'] })).toEqual([]);
    const s = buildWebPredictionSnapshot(input({ cptCodes: ['44970'], orderedInvestigations: ['Histopathology'] }))!;
    expect(s.expectsOutcome).toBe(true);
    expect(s.outcomeTriggers).toEqual(['operation', 'pathology']);
  });

  it('returns null without a usable encounter id', () => {
    expect(buildWebPredictionSnapshot(input({ encounterId: 'not an id!' }))).toBeNull();
  });
});
