/**
 * The iOS front-desk iPad questionnaire asks the same lifestyle questions as the web intake. The
 * wording (question and help text, option values and labels, "(patient-reported)" line labels) is
 * one shared file, clinical-content/rules/lifestyle-questions.json, read by
 * lib/triage-engine/src/lifestyle-questions.ts and ios/AmiseMedFlow/Services/LifestyleQuestions.swift
 * (lint:shared-content checks both platforms' types against its schema). This test checks that the
 * web export is the shared file, that the Swift source reads the same question keys and builds the
 * line prefixes the same way, and the iOS-only behaviour the file does not carry. Parsed from the
 * Swift source (no Swift toolchain in CI for the web job).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  LIFESTYLE_QUESTIONS, LIFESTYLE_QUESTION_KEYS, lifestyleQuestionnaireLine,
} from '@workspace/triage-engine/lifestyle-questions';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../../../../../${rel}`, import.meta.url)), 'utf8');
const SWIFT = read('ios/AmiseMedFlow/Services/LifestyleQuestions.swift');
const SHARED = JSON.parse(read('clinical-content/rules/lifestyle-questions.json')) as {
  questions: Record<string, unknown>;
  lineLabels: Record<string, string>;
};

function swiftKey(name: string): string {
  const m = SWIFT.match(new RegExp(`static let ${name}\\s*=\\s*"([^"]*)"`));
  if (!m) throw new Error(`LifestyleQuestions.swift: no static let ${name}`);
  return m[1];
}

const webOptions = (key: string) => (LIFESTYLE_QUESTIONS[key].options ?? []).map(o => ({ value: o.value, label: o.label }));

describe('iOS lifestyle questions = web lifestyle-questions.ts (one shared file)', () => {
  it('the web questions and line labels are the shared file', () => {
    expect(JSON.parse(JSON.stringify(LIFESTYLE_QUESTIONS))).toEqual(SHARED.questions);
    expect(LIFESTYLE_QUESTION_KEYS).toEqual(['religious_fasting', 'religious_fasting_timing', 'complementary_therapies']);
    for (const key of LIFESTYLE_QUESTION_KEYS) {
      expect(lifestyleQuestionnaireLine(key, 'X')).toBe(`${SHARED.lineLabels[key]}: X`);
    }
  });

  it('iOS loads the shared file and reads the same question keys', () => {
    expect(SWIFT).toMatch(/SharedClinicalContent\.load\(Content\.self, \.lifestyleQuestions\)/);
    expect(swiftKey('fastingKey')).toBe('religious_fasting');
    expect(swiftKey('timingKey')).toBe('religious_fasting_timing');
    expect(swiftKey('therapiesKey')).toBe('complementary_therapies');
    // The line prefix is the label and a colon, as the web line is "<label>: <answer>".
    expect(SWIFT).toContain('return label + ":"');
    // No wording is typed in Swift any more.
    for (const q of Object.values(LIFESTYLE_QUESTIONS)) {
      expect(SWIFT).not.toContain(q.text);
      for (const o of q.options ?? []) if (o.label.length > 12) expect(SWIFT).not.toContain(`"${o.label}"`);
    }
  });

  it('the timing follow-up is triggered by every fast option except "No" (web triggersKeys)', () => {
    const triggering = (LIFESTYLE_QUESTIONS.religious_fasting.options ?? [])
      .filter(o => o.triggersKeys?.includes('religious_fasting_timing')).map(o => o.value);
    expect(triggering).toEqual(webOptions('religious_fasting').map(o => o.value).filter(v => v !== 'none'));
    expect(SWIFT).toContain('var asksTiming: Bool { fasting.contains { $0 != "none" } }');
  });

  it('the questionnaire asks them last, after the Last Meal section', () => {
    const src = read('ios/AmiseMedFlow/Views/FrontDesk/AdaptiveQuestionnaireSheet+StepForms2.swift');
    const social = src.slice(src.indexOf('var phase6SocialSection'), src.indexOf('// ── Submit'));
    expect(social.indexOf('lifestyleQuestionSections')).toBeGreaterThan(social.indexOf('Label("Last Meal"'));
    expect(social.trimEnd().replace(/\s+/g, ' ')).toMatch(/lifestyleQuestionSections \}$/);
  });
});
