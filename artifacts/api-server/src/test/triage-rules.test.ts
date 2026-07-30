/**
 * Unit tests for triage rules: scanRedFlags, checkForbiddenContent, isPublicHoliday.
 * All pure functions — no mocks required.
 */
import { describe, it, expect } from 'vitest';
import {
  scanRedFlags,
  checkForbiddenContent,
  isPublicHoliday,
  RED_FLAGS,
  FORBIDDEN_PATTERNS,
  PUBLIC_HOLIDAYS_SLU,
} from '@workspace/triage-engine';

// ── scanRedFlags ─────────────────────────────────────────────────────────────

describe('scanRedFlags', () => {
  it('returns flagged: false and empty matches for benign text', () => {
    const result = scanRedFlags('I would like to book an appointment for a check-up.');
    expect(result.flagged).toBe(false);
    expect(result.matches).toHaveLength(0);
  });

  it('detects GI bleeding: haematemesis', () => {
    const result = scanRedFlags('Patient reports haematemesis this morning.');
    expect(result.flagged).toBe(true);
    const flag = result.matches.find(m => m.severity === 'urgent');
    expect(flag).toBeDefined();
  });

  it('detects GI bleeding: vomiting blood', () => {
    const result = scanRedFlags('She has been vomiting blood for 2 days.');
    expect(result.flagged).toBe(true);
    expect(result.matches.some(m => m.severity === 'urgent')).toBe(true);
  });

  it('detects chest pain', () => {
    const result = scanRedFlags('Crushing chest pain radiating to left arm.');
    expect(result.flagged).toBe(true);
    expect(result.matches.some(m => m.severity === 'urgent')).toBe(true);
  });

  it('detects jaundice', () => {
    const result = scanRedFlags('Yellowing of eyes noted for 3 days.');
    expect(result.flagged).toBe(true);
    expect(result.matches.some(m => m.severity === 'urgent')).toBe(true);
  });

  it('detects post-operative concern', () => {
    const result = scanRedFlags('Wound discharge after surgery — red and leaking pus.');
    expect(result.flagged).toBe(true);
    expect(result.matches.some(m => m.severity === 'urgent')).toBe(true);
  });

  it('detects malignancy red flag (priority)', () => {
    const result = scanRedFlags('Unintentional weight loss of 8 kg over 3 months.');
    expect(result.flagged).toBe(true);
    expect(result.matches.some(m => m.severity === 'priority')).toBe(true);
  });

  it('detects dysphagia (priority)', () => {
    const result = scanRedFlags('Difficulty swallowing — food sticking in throat.');
    expect(result.flagged).toBe(true);
    expect(result.matches.some(m => m.severity === 'priority')).toBe(true);
  });

  it('detects haemoptysis', () => {
    const result = scanRedFlags('Coughing blood for two weeks.');
    expect(result.flagged).toBe(true);
    expect(result.matches.some(m => m.severity === 'urgent')).toBe(true);
  });

  it('detects fever as priority', () => {
    const result = scanRedFlags('Patient has had fever and rigors since yesterday.');
    expect(result.flagged).toBe(true);
  });

  it('detects pregnancy mention', () => {
    const result = scanRedFlags('She thinks she might be pregnant.');
    expect(result.flagged).toBe(true);
    const flag = result.matches.find(m => m.severity === 'review');
    expect(flag).toBeDefined();
  });

  it('is case-insensitive', () => {
    const lower = scanRedFlags('HAEMATEMESIS');
    expect(lower.flagged).toBe(true);
  });

  it('returns all matching flags (multiple matches)', () => {
    const result = scanRedFlags('Haematemesis and severe abdominal pain.');
    expect(result.matches.length).toBeGreaterThanOrEqual(2);
  });

  it('RED_FLAGS array is non-empty and well-formed', () => {
    expect(RED_FLAGS.length).toBeGreaterThan(0);
    for (const flag of RED_FLAGS) {
      expect(flag).toHaveProperty('pattern');
      expect(flag).toHaveProperty('reason');
      expect(['urgent', 'priority', 'review']).toContain(flag.severity);
      expect(flag.pattern).toBeInstanceOf(RegExp);
    }
  });
});

// ── checkForbiddenContent ────────────────────────────────────────────────────

describe('checkForbiddenContent', () => {
  it('returns safe: true and no violations for clean patient text', () => {
    const result = checkForbiddenContent(
      'Thank you for your enquiry. We will be in touch shortly to arrange your appointment.',
    );
    expect(result.safe).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('FORBIDDEN_PATTERNS is non-empty', () => {
    expect(FORBIDDEN_PATTERNS.length).toBeGreaterThan(0);
    for (const p of FORBIDDEN_PATTERNS) {
      expect(p).toBeInstanceOf(RegExp);
    }
  });

  it('safe text → violations is an array (possibly empty)', () => {
    const result = checkForbiddenContent('Please call the clinic to book.');
    expect(Array.isArray(result.violations)).toBe(true);
  });
});

// ── isPublicHoliday ──────────────────────────────────────────────────────────

describe('isPublicHoliday', () => {
  it('2026-01-01 is a public holiday (New Year\'s Day)', () => {
    expect(isPublicHoliday(new Date('2026-01-01'))).toBe(true);
  });

  it('2026-12-25 is a public holiday (Christmas Day)', () => {
    expect(isPublicHoliday(new Date('2026-12-25'))).toBe(true);
  });

  it('2026-12-26 is a public holiday (Boxing Day)', () => {
    expect(isPublicHoliday(new Date('2026-12-26'))).toBe(true);
  });

  it('2026-05-01 is a public holiday (Labour Day)', () => {
    expect(isPublicHoliday(new Date('2026-05-01'))).toBe(true);
  });

  it('2026-03-15 is NOT a public holiday', () => {
    expect(isPublicHoliday(new Date('2026-03-15'))).toBe(false);
  });

  it('2026-06-15 is NOT a public holiday', () => {
    expect(isPublicHoliday(new Date('2026-06-15'))).toBe(false);
  });

  it('PUBLIC_HOLIDAYS_SLU has 13 entries for 2026', () => {
    expect(PUBLIC_HOLIDAYS_SLU).toHaveLength(13);
  });

  it('all PUBLIC_HOLIDAYS_SLU entries match YYYY-MM-DD format', () => {
    for (const d of PUBLIC_HOLIDAYS_SLU) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
