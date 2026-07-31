/**
 * Unit tests for surgical pathology matching and cancer screening.
 * All pure functions — no mocks required.
 */
import { describe, it, expect } from 'vitest';
import {
  matchSurgicalPathologies,
  isPrimarilySurgical,
  SURGICAL_PATHOLOGIES,
} from '@workspace/triage-engine';
import { screenForCancer, detectReferrals } from '@workspace/triage-engine';

// ── isPrimarilySurgical ───────────────────────────────────────────────────────

describe('isPrimarilySurgical', () => {
  it('returns true for cholecystitis', () => {
    expect(isPrimarilySurgical('acute cholecystitis')).toBe(true);
  });

  it('returns true for appendicitis', () => {
    expect(isPrimarilySurgical('appendicitis')).toBe(true);
  });

  it('returns true for hernia', () => {
    expect(isPrimarilySurgical('inguinal hernia')).toBe(true);
  });

  it('returns true for bowel obstruction', () => {
    expect(isPrimarilySurgical('bowel obstruction')).toBe(true);
  });

  it('returns false for benign flu symptoms', () => {
    expect(isPrimarilySurgical('cold and flu with runny nose')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isPrimarilySurgical('')).toBe(false);
  });
});

// ── matchSurgicalPathologies ──────────────────────────────────────────────────

describe('matchSurgicalPathologies', () => {
  it('returns matches for "appendicitis"', () => {
    const matches = matchSurgicalPathologies('appendicitis');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('returns empty array for unrelated text', () => {
    const matches = matchSurgicalPathologies('sunburn on the left arm');
    expect(matches).toHaveLength(0);
  });

  it('each match has id, label, category, icd10, cpt', () => {
    const matches = matchSurgicalPathologies('cholecystitis gallbladder');
    for (const m of matches) {
      expect(m).toHaveProperty('id');
      expect(m).toHaveProperty('label');
      expect(m).toHaveProperty('category');
      expect(Array.isArray(m.icd10)).toBe(true);
      expect(Array.isArray(m.cpt)).toBe(true);
    }
  });

  it('results are sorted urgent/priority before routine', () => {
    const matches = matchSurgicalPathologies('appendicitis cholecystitis hernia');
    const severities = matches.map(m => m.surgicalPriority);
    const RANK: Record<string, number> = { urgent: 0, priority: 1, review: 2, routine: 3 };
    for (let i = 1; i < severities.length; i++) {
      expect(RANK[severities[i]!] ?? 99).toBeGreaterThanOrEqual(RANK[severities[i - 1]!] ?? 0);
    }
  });

  it('SURGICAL_PATHOLOGIES has at least 20 entries', () => {
    expect(SURGICAL_PATHOLOGIES.length).toBeGreaterThanOrEqual(20);
  });
});

// ── screenForCancer ───────────────────────────────────────────────────────────

describe('screenForCancer', () => {
  const baseInput = {
    age: 45,
    sex: 'male' as const,
    chiefComplaints: [],
    symptoms: [],
    familyHistory: [],
    responses: {},
  };

  it('returns a CancerScreenResult shape for benign input', () => {
    const r = screenForCancer(baseInput);
    expect(r).toHaveProperty('triggered');
    expect(r).toHaveProperty('criteria');
    expect(r).toHaveProperty('referralUrgency');
    expect(r).toHaveProperty('recommendedInvestigation');
    expect(typeof r.triggered).toBe('boolean');
    expect(Array.isArray(r.criteria)).toBe(true);
  });

  it('triggers for rectal bleeding in 65-year-old (NICE NG12 colorectal)', () => {
    const r = screenForCancer({
      ...baseInput,
      age: 65,
      chiefComplaints: ['rectal_bleeding', 'change_in_bowel_habit'],
      symptoms: ['rectal_bleeding', 'change_in_bowel_habit'],
    });
    expect(r.triggered).toBe(true);
    expect(['two_week_wait', 'urgent']).toContain(r.referralUrgency);
  });

  it('does not trigger for young patient with non-alarm symptoms', () => {
    const r = screenForCancer({
      ...baseInput,
      age: 22,
      chiefComplaints: ['acid_reflux'],
      symptoms: ['acid_reflux'],
    });
    expect(r.triggered).toBe(false);
  });

  it('referralUrgency is one of the valid enum values', () => {
    const valid = ['two_week_wait', 'urgent', 'routine_screening', 'none'];
    const r = screenForCancer(baseInput);
    expect(valid).toContain(r.referralUrgency);
  });
});

// ── detectReferrals ───────────────────────────────────────────────────────────

describe('detectReferrals', () => {
  it('returns an array', () => {
    const r = detectReferrals({
      age: 50, sex: 'female', chiefComplaints: [], symptoms: [], familyHistory: [], responses: {},
    });
    expect(Array.isArray(r)).toBe(true);
  });

  it('each referral has specialty, reason, urgency', () => {
    const r = detectReferrals({
      age: 65, sex: 'male',
      chiefComplaints: ['chest_pain'],
      symptoms: ['chest_pain', 'shortness_of_breath'],
      familyHistory: [],
      responses: {},
    });
    for (const ref of r) {
      expect(ref).toHaveProperty('specialty');
      expect(ref).toHaveProperty('reason');
      expect(ref).toHaveProperty('urgency');
    }
  });
});
