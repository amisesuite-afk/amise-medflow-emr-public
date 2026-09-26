/**
 * Outcomes loop — the iOS records (ios/AmiseMedFlow/Services/OutcomeSnapshot.swift,
 * OutcomeSnapshotTests.swift) use the same JSON keys as the web snapshot, so a future iOS push
 * (or an export of the device records) is accepted by the same sanitisers and the same
 * calibration report. These literals are what JSONEncoder writes for OutcomePredictionRecord /
 * OutcomeFinalDiagnosisRecord (nil optionals omitted, plus the local `sync` bookkeeping, which
 * the sanitiser drops). Change both platforms together.
 */
import { describe, expect, it } from 'vitest';
import { computeCalibrationReport, sanitizeFinalDiagnosis, sanitizeSnapshot } from '@workspace/triage-engine/outcomes';

const IOS_PREDICTION = {
  snapshotVersion: 1,
  platform: 'ios',
  encounterRef: 'ios:11111111-2222-4333-8444-555555555555',
  completedAt: '2026-09-21T14:13:20Z',
  differentialEngine: 'ios-bayes',
  differentialModelVersion: '2.1.0',
  modelVersions: { diagnosticDatabase: '2.1.0', differentialSource: 'database', acuity: '1.2.0', planSafety: '1.1.0', radiation: '1.3.0', reasoning: '1.0.0' },
  topDifferential: [{ rank: 1, icd10: 'K35.80', probability: 0.72 }, { rank: 2, icd10: 'K81.0', probability: 0.11 }],
  triageLevel: 'urgent',
  triageScale: 'ios-acuity',
  scores: [{ key: 'news2', value: 5, source: 'record' }],
  decisionBands: [],
  features: {},
  recordedIcd10: ['K35.80'],
  workingIcd10: 'K35.80',
  expectsOutcome: true,
  outcomeTriggers: ['operation'],
  sync: { clientRef: 'ios:AAAAAAAA-0000-4000-8000-000000000001', pendingSync: true, updatedAt: '2026-09-21T14:13:20Z' },
};

const IOS_FINAL = {
  encounterRef: 'ios:11111111-2222-4333-8444-555555555555',
  finalIcd10: 'K35.2',
  sourceType: 'operative_findings',
  sourceDate: '2026-09-22',
  actionsTaken: [],
  retrospectiveAcuity: 'urgent',
  status: 'confirmed',
  confirmedAt: '2026-09-22T10:00:00Z',
  sync: { clientRef: 'ios:BBBBBBBB-0000-4000-8000-000000000002', pendingSync: true, updatedAt: '2026-09-22T10:00:00Z' },
};

describe('iOS outcome records follow the shared contract', () => {
  it('the prediction record is accepted as-is (sync bookkeeping dropped)', () => {
    const r = sanitizeSnapshot(IOS_PREDICTION);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({
      platform: 'ios', differentialEngine: 'ios-bayes', differentialModelVersion: '2.1.0', triageLevel: 'urgent',
      topDifferential: [{ rank: 1, diseaseId: null, icd10: 'K35.80', probability: 0.72 }, { rank: 2, diseaseId: null, icd10: 'K81.0', probability: 0.11 }],
      expectsOutcome: true,
    });
    expect(JSON.stringify(r.value)).not.toContain('clientRef');
  });

  it('the final diagnosis record is accepted and scores against the prediction by ICD-10 category', () => {
    const f = sanitizeFinalDiagnosis(IOS_FINAL);
    expect(f.ok).toBe(true);
    if (!f.ok) return;
    const s = sanitizeSnapshot(IOS_PREDICTION);
    if (!s.ok) throw new Error('snapshot');
    const report = computeCalibrationReport([s.value], [f.value], { now: new Date('2026-09-26T00:00:00Z') });
    expect(report.accuracy[0]).toMatchObject({ engine: 'ios-bayes@2.1.0', n: 1, top1: { k: 1 } });
    expect(report.triage[0]).toMatchObject({ scale: 'ios-acuity', agree: { k: 1 } });
  });
});
