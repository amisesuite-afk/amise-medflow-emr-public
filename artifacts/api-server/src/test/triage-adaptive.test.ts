/**
 * Unit tests for the adaptive triage scoring engine.
 * All functions are pure — no mocks required.
 *
 * Scoring constants (from adaptive-triage.ts):
 *   Pain ≥8             → +20     Post-op ≤14 d       → +25
 *   Pain 5-7            → +8      Age ≥70              → +12
 *   Red flag urgent     → +40     Age 60-69            → +7
 *   Red flag priority   → +25     High-risk comorbidity → +12
 *   Vital urgent        → +30     GI bleed text        → +25
 *   Composite GI bleed + shock → +60
 *   Composite ERCP + fever     → +35
 *
 * Acuity thresholds:
 *   ≥45 OR any urgent flag → urgent
 *   ≥28 OR any priority flag → priority
 *   ≥14 OR any review flag → review
 *   else → routine
 */
import { describe, it, expect } from 'vitest';
import { adaptiveTriage, type AdaptiveTriageInput } from '@workspace/triage-engine';

const base: AdaptiveTriageInput = { symptoms: [] };

describe('adaptiveTriage — return shape', () => {
  it('returns all required fields for minimal input', () => {
    const r = adaptiveTriage(base);
    expect(r).toHaveProperty('acuity');
    expect(r).toHaveProperty('score');
    expect(r).toHaveProperty('reasons');
    expect(r).toHaveProperty('vitalRedFlags');
    expect(r).toHaveProperty('recommendedAction');
    expect(r).toHaveProperty('appointmentType');
    expect(r).toHaveProperty('questionsToAsk');
    expect(r).toHaveProperty('safetyMessage');
    expect(r).toHaveProperty('missingCriticalFields');
    expect(r).toHaveProperty('surgicalMatches');
    expect(r).toHaveProperty('cancerScreen');
    expect(Array.isArray(r.reasons)).toBe(true);
    expect(Array.isArray(r.vitalRedFlags)).toBe(true);
  });

  it('minimal input → routine acuity', () => {
    const r = adaptiveTriage(base);
    expect(r.acuity).toBe('routine');
  });
});

describe('adaptiveTriage — pain score', () => {
  it('pain score 10 → score ≥20, acuity at least review', () => {
    const r = adaptiveTriage({ ...base, painScore: 10 });
    expect(r.score).toBeGreaterThanOrEqual(20);
    expect(['urgent', 'priority', 'review']).toContain(r.acuity);
  });

  it('pain score 6 → score increases by ~8', () => {
    const baseline = adaptiveTriage(base).score;
    const r = adaptiveTriage({ ...base, painScore: 6 });
    expect(r.score).toBeGreaterThan(baseline);
  });

  it('pain score 0 → no pain contribution', () => {
    const baseline = adaptiveTriage(base).score;
    const r = adaptiveTriage({ ...base, painScore: 0 });
    expect(r.score).toBe(baseline);
  });
});

describe('adaptiveTriage — vital red flags', () => {
  it('SBP < 90 → urgent vital flag', () => {
    const r = adaptiveTriage({ ...base, vitalSigns: { systolicBp: 80 } });
    expect(r.acuity).toBe('urgent');
    const flag = r.vitalRedFlags.find(f => f.severity === 'urgent');
    expect(flag).toBeDefined();
  });

  it('HR > 120 → urgent vital flag', () => {
    const r = adaptiveTriage({ ...base, vitalSigns: { heartRate: 130 } });
    expect(r.acuity).toBe('urgent');
  });

  it('Temp ≥ 39.5 → urgent vital flag', () => {
    const r = adaptiveTriage({ ...base, vitalSigns: { temperatureC: 40.1 } });
    expect(r.acuity).toBe('urgent');
  });

  it('Temp 38.5 → priority vital flag', () => {
    const r = adaptiveTriage({ ...base, vitalSigns: { temperatureC: 38.5 } });
    const priorityOrUrgent = r.vitalRedFlags.some(
      f => f.severity === 'priority' || f.severity === 'urgent',
    );
    expect(priorityOrUrgent).toBe(true);
  });

  it('SpO₂ < 94% → urgent vital flag', () => {
    const r = adaptiveTriage({ ...base, vitalSigns: { spo2: 91 } });
    expect(r.acuity).toBe('urgent');
  });

  it('RR > 24 → urgent vital flag', () => {
    const r = adaptiveTriage({ ...base, vitalSigns: { respiratoryRate: 28 } });
    expect(r.acuity).toBe('urgent');
  });

  it('glucose > 20 mmol/L → urgent vital flag', () => {
    const r = adaptiveTriage({ ...base, vitalSigns: { glucoseMmol: 25 } });
    expect(r.acuity).toBe('urgent');
  });

  it('normal vitals → no vital red flags', () => {
    const r = adaptiveTriage({
      ...base,
      vitalSigns: { systolicBp: 120, heartRate: 75, temperatureC: 37.2, spo2: 98, respiratoryRate: 16 },
    });
    expect(r.vitalRedFlags).toHaveLength(0);
  });
});

describe('adaptiveTriage — red flag text matching', () => {
  it('haematemesis in freeText → urgent', () => {
    const r = adaptiveTriage({ ...base, freeText: 'Patient has haematemesis' });
    expect(r.acuity).toBe('urgent');
  });

  it('chest pain in freeText → urgent', () => {
    const r = adaptiveTriage({ ...base, freeText: 'severe chest pain radiating to arm' });
    expect(r.acuity).toBe('urgent');
  });

  it('jaundice in freeText → urgent', () => {
    const r = adaptiveTriage({ ...base, freeText: 'yellowing of eyes and skin' });
    expect(r.acuity).toBe('urgent');
  });

  it('weight loss in freeText → priority minimum', () => {
    const r = adaptiveTriage({ ...base, freeText: 'unintentional weight loss over 6 months' });
    expect(['urgent', 'priority']).toContain(r.acuity);
  });

  it('dysphagia in freeText → priority minimum', () => {
    const r = adaptiveTriage({ ...base, freeText: 'trouble swallowing, food sticking' });
    expect(['urgent', 'priority']).toContain(r.acuity);
  });
});

describe('adaptiveTriage — age scoring', () => {
  it('age 75 → higher score than age 40', () => {
    const elderly = adaptiveTriage({ ...base, age: 75 });
    const young   = adaptiveTriage({ ...base, age: 40 });
    expect(elderly.score).toBeGreaterThan(young.score);
  });

  it('age 65 → score increase vs age 40', () => {
    const sixties = adaptiveTriage({ ...base, age: 65 });
    const young   = adaptiveTriage({ ...base, age: 40 });
    expect(sixties.score).toBeGreaterThan(young.score);
  });
});

describe('adaptiveTriage — post-op scoring', () => {
  it('post-op day 7 → score ≥25, acuity at least review', () => {
    const r = adaptiveTriage({ ...base, isPostOp: true, postOpDays: 7 });
    expect(r.score).toBeGreaterThanOrEqual(25);
    expect(['urgent', 'priority', 'review']).toContain(r.acuity);
  });

  it('post-op ≤14 d scores more than post-op >14 d', () => {
    const early = adaptiveTriage({ ...base, isPostOp: true, postOpDays: 7 });
    const late  = adaptiveTriage({ ...base, isPostOp: true, postOpDays: 21 });
    expect(early.score).toBeGreaterThan(late.score);
  });

  it('post-op + fever composite → urgent', () => {
    const r = adaptiveTriage({
      ...base,
      isPostOp: true,
      postOpDays: 5,
      freeText: 'fever since surgery',
    });
    expect(r.acuity).toBe('urgent');
  });
});

describe('adaptiveTriage — composite scores', () => {
  it('GI bleed + hypotension → urgent (composite +60)', () => {
    const r = adaptiveTriage({
      ...base,
      freeText: 'haematemesis',
      vitalSigns: { systolicBp: 85 },
    });
    expect(r.acuity).toBe('urgent');
    expect(r.score).toBeGreaterThanOrEqual(45);
  });

  it('ERCP + fever → urgent (composite +35)', () => {
    const r = adaptiveTriage({
      ...base,
      freeText: 'post ERCP fever and chills',
    });
    expect(r.acuity).toBe('urgent');
  });

  it('chest pain + SpO₂ < 95 → urgent (composite +50)', () => {
    const r = adaptiveTriage({
      ...base,
      freeText: 'chest pain',
      vitalSigns: { spo2: 93 },
    });
    expect(r.acuity).toBe('urgent');
    expect(r.score).toBeGreaterThanOrEqual(45);
  });
});

describe('adaptiveTriage — acuity thresholds', () => {
  it('score <14 with no flags → routine', () => {
    const r = adaptiveTriage({ symptoms: [], age: 35 });
    expect(r.acuity).toBe('routine');
  });

  it('recommended action is one of the valid enum values', () => {
    const validActions = [
      'emergency_now', 'same_day_call', 'priority_24_48h',
      'routine_booking', 'admin_review',
    ];
    const r = adaptiveTriage(base);
    expect(validActions).toContain(r.recommendedAction);
  });

  it('score is a non-negative number', () => {
    const r = adaptiveTriage(base);
    expect(typeof r.score).toBe('number');
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

describe('adaptiveTriage — pregnancy', () => {
  it('pregnancyPossible → score increase', () => {
    const withPreg    = adaptiveTriage({ ...base, pregnancyPossible: true });
    const withoutPreg = adaptiveTriage(base);
    expect(withPreg.score).toBeGreaterThan(withoutPreg.score);
  });
});

describe('adaptiveTriage — comorbidities', () => {
  it('high-risk comorbidity → score increase', () => {
    const withCo    = adaptiveTriage({ ...base, comorbidities: ['diabetes'] });
    const withoutCo = adaptiveTriage(base);
    expect(withCo.score).toBeGreaterThan(withoutCo.score);
  });

  it('anticoagulant medication → score increase', () => {
    const withMed    = adaptiveTriage({ ...base, medications: ['warfarin'] });
    const withoutMed = adaptiveTriage(base);
    expect(withMed.score).toBeGreaterThan(withoutMed.score);
  });
});
