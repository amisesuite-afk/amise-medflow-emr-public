/**
 * Unit tests for the APCQ (Adaptive Patient Consultation Questionnaire) engine.
 * Pure state-machine functions — no mocks required.
 */
import { describe, it, expect } from 'vitest';
import {
  createSession,
  processAnswer,
  getNextQuestion,
  isSessionSufficient,
  detectSpecialty,
  complaintSymptomType,
  QUESTION_BANK,
  SPECIALTY_QUEUES,
  type SessionState,
} from '@workspace/triage-engine/apcq.js';

// ── createSession ────────────────────────────────────────────────────────────

describe('createSession', () => {
  it('creates a session with the correct shape', () => {
    const s = createSession({ sessionId: 'test-1', templateKey: 'standard', mode: 'screening' });
    expect(s.sessionId).toBe('test-1');
    expect(s.templateKey).toBe('standard');
    expect(s.mode).toBe('screening');
    expect(s.isComplete).toBe(false);
    expect(Array.isArray(s.responses)).toBe(true);
    expect(s.responses).toHaveLength(0);
    expect(s.redFlags).toHaveLength(0);
    expect(s.answeredKeys).toBeInstanceOf(Set);
    expect(s.answeredKeys.size).toBe(0);
  });

  it('first question in queue is chief_complaint', () => {
    const s = createSession({ sessionId: 'test-2', templateKey: 'standard', mode: 'screening' });
    expect(s.queuedKeys[0]).toBe('chief_complaint');
  });

  it('getNextQuestion returns chief_complaint question', () => {
    const s = createSession({ sessionId: 'test-3', templateKey: 'standard', mode: 'screening' });
    const q = getNextQuestion(s);
    expect(q).not.toBeNull();
    expect(q!.key).toBe('chief_complaint');
  });

  it('accepts patientAge and specialty', () => {
    const s = createSession({
      sessionId: 'test-4',
      templateKey: 'standard',
      mode: 'condition_specific',
      specialty: 'general_surgery',
      patientAge: 55,
    });
    expect(s.patientAge).toBe(55);
    expect(s.specialty).toBe('general_surgery');
  });
});

// ── processAnswer ─────────────────────────────────────────────────────────────

describe('processAnswer', () => {
  function freshSession(): SessionState {
    return createSession({ sessionId: 'sess-x', templateKey: 'standard', mode: 'screening' });
  }

  it('records the answer in responses', () => {
    const s0 = freshSession();
    const s1 = processAnswer(s0, { questionKey: 'chief_complaint', value: ['abdominal_pain'] });
    expect(s1.responses.length).toBeGreaterThan(0);
    expect(s1.answeredKeys.has('chief_complaint')).toBe(true);
  });

  it('does not mutate the original session', () => {
    const s0 = freshSession();
    const s1 = processAnswer(s0, { questionKey: 'chief_complaint', value: ['abdominal_pain'] });
    expect(s0.responses).toHaveLength(0);
    expect(s1.responses.length).toBeGreaterThan(0);
  });

  it('triggered keys from chief_complaint answer are added to queue', () => {
    const s0 = freshSession();
    const s1 = processAnswer(s0, { questionKey: 'chief_complaint', value: ['abdominal_pain'] });
    // abdominal_pain triggers: pain_location, pain_severity, pain_character, etc.
    expect(s1.queuedKeys.length).toBeGreaterThan(0);
  });

  it('ignores unknown question keys gracefully', () => {
    const s0 = freshSession();
    const s1 = processAnswer(s0, { questionKey: 'nonexistent_key', value: 'something' });
    expect(s1.responses).toHaveLength(0); // unchanged
  });

  it('pain_severity value of 9 may flag as urgent', () => {
    const s0 = freshSession();
    // Answer chief_complaint first
    const s1 = processAnswer(s0, { questionKey: 'chief_complaint', value: ['abdominal_pain'] });
    // Answer pain_severity = 9 (isRedFlagScreen: true)
    const s2 = processAnswer(s1, { questionKey: 'pain_severity', value: '9' });
    // If redFlags are recorded for high pain, they should appear
    // (actual behaviour depends on implementation, but session should not break)
    expect(s2.answeredKeys.has('pain_severity')).toBe(true);
  });

  it('blood_in_vomit_stool answer raises a red flag', () => {
    const s0 = freshSession();
    const s1 = processAnswer(s0, { questionKey: 'chief_complaint', value: ['blood_in_vomit_stool'] });
    // blood_in_vomit_stool has isRedFlag: true and urgencyIfSelected: 'urgent'
    expect(s1.redFlags.length).toBeGreaterThan(0);
    expect(s1.redFlags.some(f => f.severity === 'urgent')).toBe(true);
  });
});

// ── isSessionSufficient ───────────────────────────────────────────────────────

describe('isSessionSufficient', () => {
  it('returns false for a fresh session (no answers)', () => {
    const s = createSession({ sessionId: 'suf-1', templateKey: 'standard', mode: 'screening' });
    expect(isSessionSufficient(s)).toBe(false);
  });

  it('returns false after only chief_complaint (< 3 responses)', () => {
    let s = createSession({ sessionId: 'suf-2', templateKey: 'standard', mode: 'screening' });
    s = processAnswer(s, { questionKey: 'chief_complaint', value: ['abdominal_pain'] });
    expect(isSessionSufficient(s)).toBe(false);
  });

  it('returns true once chief_complaint + 2 more questions are answered', () => {
    let s = createSession({ sessionId: 'suf-3', templateKey: 'standard', mode: 'screening' });
    s = processAnswer(s, { questionKey: 'chief_complaint', value: ['abdominal_pain'] });
    s = processAnswer(s, { questionKey: 'pain_severity', value: '5' });
    s = processAnswer(s, { questionKey: 'associated_fever', value: 'false' });
    expect(isSessionSufficient(s)).toBe(true);
  });
});

// ── getNextQuestion ───────────────────────────────────────────────────────────

describe('getNextQuestion', () => {
  it('returns null for a completed session', () => {
    const s = createSession({ sessionId: 'next-1', templateKey: 'standard', mode: 'screening' });
    const completed: SessionState = { ...s, isComplete: true };
    expect(getNextQuestion(completed)).toBeNull();
  });

  it('returns null when queue is empty', () => {
    const s = createSession({ sessionId: 'next-2', templateKey: 'standard', mode: 'screening' });
    const empty: SessionState = { ...s, queuedKeys: [] };
    expect(getNextQuestion(empty)).toBeNull();
  });

  it('returns a Question object with key, text, type', () => {
    const s = createSession({ sessionId: 'next-3', templateKey: 'standard', mode: 'screening' });
    const q = getNextQuestion(s);
    expect(q).not.toBeNull();
    expect(q).toHaveProperty('key');
    expect(q).toHaveProperty('text');
    expect(q).toHaveProperty('type');
  });
});

// ── detectSpecialty ───────────────────────────────────────────────────────────

describe('detectSpecialty', () => {
  it('post_op_concern → post_op specialty', () => {
    expect(detectSpecialty(['post_op_concern'])).toBe('post_op');
  });

  it('breast_concern → breast_surgery specialty', () => {
    expect(detectSpecialty(['breast_concern'])).toBe('breast_surgery');
  });

  it('rectal_bleeding → endoscopy specialty', () => {
    expect(detectSpecialty(['rectal_bleeding'])).toBe('endoscopy');
  });

  it('difficulty_swallowing → endoscopy specialty', () => {
    expect(detectSpecialty(['difficulty_swallowing'])).toBe('endoscopy');
  });

  it('abdominal_pain → general_surgery specialty', () => {
    expect(detectSpecialty(['abdominal_pain'])).toBe('general_surgery');
  });
});

// ── QUESTION_BANK ─────────────────────────────────────────────────────────────

describe('QUESTION_BANK', () => {
  it('contains chief_complaint question', () => {
    expect(QUESTION_BANK).toHaveProperty('chief_complaint');
  });

  it('chief_complaint has multi_choice type', () => {
    expect(QUESTION_BANK.chief_complaint.type).toBe('multi_choice');
  });

  it('pain_severity has scale type with min/max', () => {
    const q = QUESTION_BANK.pain_severity;
    expect(q).toBeDefined();
    expect(q.type).toBe('scale');
    expect(q.minValue).toBe(0);
    expect(q.maxValue).toBe(10);
  });

  it('all questions have key, text, and type', () => {
    for (const [key, q] of Object.entries(QUESTION_BANK)) {
      expect(q.key).toBe(key);
      expect(typeof q.text).toBe('string');
      expect(q.text.length).toBeGreaterThan(0);
      expect(typeof q.type).toBe('string');
    }
  });
});

// ── Lump questions follow the history-frames symptom type ───────────────────────
// "Lump or mass" used to get the breast questions ("How long have you noticed the breast lump…?").

describe('lump or mass gets lump questions', () => {
  const start = () => createSession({ sessionId: 'lump-1', templateKey: 'standard', mode: 'screening' });

  it('classifies the options by symptom type', () => {
    expect(complaintSymptomType('lump_or_mass')).toBe('lump');
    expect(complaintSymptomType('breast_concern')).toBe('breast');
    expect(complaintSymptomType('abdominal_pain')).toBe('pain');
  });

  it('queues the lump questions, not the breast or pain questions', () => {
    const s = processAnswer(start(), { questionKey: 'chief_complaint', value: ['lump_or_mass'] });
    expect(s.queuedKeys).toContain('lump_location');
    expect(s.queuedKeys).toContain('lump_change');
    for (const k of ['breast_lump_duration', 'nipple_discharge', 'hormone_use', 'pain_character', 'pain_radiation']) {
      expect(s.queuedKeys).not.toContain(k);
    }
  });

  it('a groin lump adds the hernia question; a breast lump the breast questions', () => {
    const s = processAnswer(start(), { questionKey: 'chief_complaint', value: ['lump_or_mass'] });
    expect(processAnswer(s, { questionKey: 'lump_location', value: ['groin'] }).queuedKeys).toContain('hernia_symptoms');
    const b = processAnswer(s, { questionKey: 'lump_location', value: ['breast'] });
    expect(b.queuedKeys).toContain('nipple_discharge');
    expect(b.queuedKeys).not.toContain('hernia_symptoms');
  });

  it('a breast concern keeps the breast questions', () => {
    const s = processAnswer(start(), { questionKey: 'chief_complaint', value: ['breast_concern'] });
    expect(s.queuedKeys).toContain('breast_lump_duration');
    expect(s.queuedKeys).not.toContain('lump_location');
  });
});
