/**
 * The iOS front-desk iPad questionnaire asks the same lifestyle questions as the web intake:
 * ios/AmiseMedFlow/Services/LifestyleQuestions.swift must carry the same question text, help
 * text, option values and labels, and "(patient-reported)" line prefixes as
 * lib/triage-engine/src/lifestyle-questions.ts. Parsed from the Swift source (no Swift toolchain
 * in CI for the web job).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LIFESTYLE_QUESTIONS, lifestyleQuestionnaireLine } from '@workspace/triage-engine/lifestyle-questions';

const SWIFT = readFileSync(
  fileURLToPath(new URL('../../../../../ios/AmiseMedFlow/Services/LifestyleQuestions.swift', import.meta.url)), 'utf8');

function swiftString(name: string): string {
  const m = SWIFT.match(new RegExp(`static let ${name}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  if (!m) throw new Error(`LifestyleQuestions.swift: no static let ${name}`);
  return m[1];
}

function swiftOptions(name: string): { value: string; label: string }[] {
  const block = SWIFT.match(new RegExp(`static let ${name}: \\[Option\\] = \\[([\\s\\S]*?)\\n    \\]`))?.[1];
  if (!block) throw new Error(`LifestyleQuestions.swift: no static let ${name}`);
  return [...block.matchAll(/Option\(value: "([^"]*)", label: "([^"]*)"\)/g)].map(m => ({ value: m[1], label: m[2] }));
}

const webOptions = (key: string) => (LIFESTYLE_QUESTIONS[key].options ?? []).map(o => ({ value: o.value, label: o.label }));

describe('iOS lifestyle questions = web lifestyle-questions.ts', () => {
  it('question text and help text', () => {
    expect(swiftString('fastingText')).toBe(LIFESTYLE_QUESTIONS.religious_fasting.text);
    expect(swiftString('fastingHelp')).toBe(LIFESTYLE_QUESTIONS.religious_fasting.helpText);
    expect(swiftString('timingText')).toBe(LIFESTYLE_QUESTIONS.religious_fasting_timing.text);
    expect(swiftString('therapiesText')).toBe(LIFESTYLE_QUESTIONS.complementary_therapies.text);
    expect(swiftString('therapiesHelp')).toBe(LIFESTYLE_QUESTIONS.complementary_therapies.helpText);
  });

  it('option values and labels, in order', () => {
    expect(swiftOptions('fastingOptions')).toEqual(webOptions('religious_fasting'));
    expect(swiftOptions('timingOptions')).toEqual(webOptions('religious_fasting_timing'));
    expect(swiftOptions('therapyOptions')).toEqual(webOptions('complementary_therapies'));
  });

  it('the timing follow-up is triggered by every fast option except "No" (web triggersKeys)', () => {
    const triggering = (LIFESTYLE_QUESTIONS.religious_fasting.options ?? [])
      .filter(o => o.triggersKeys?.includes('religious_fasting_timing')).map(o => o.value);
    expect(triggering).toEqual(webOptions('religious_fasting').map(o => o.value).filter(v => v !== 'none'));
    expect(SWIFT).toContain('var asksTiming: Bool { fasting.contains { $0 != "none" } }');
  });

  it('social-history line prefixes', () => {
    const prefix = (key: string) => lifestyleQuestionnaireLine(key, 'X')!.replace(/ X$/, '');
    expect(swiftString('fastingLinePrefix')).toBe(prefix('religious_fasting'));
    expect(swiftString('timingLinePrefix')).toBe(prefix('religious_fasting_timing'));
    expect(swiftString('therapiesLinePrefix')).toBe(prefix('complementary_therapies'));
  });

  it('the questionnaire asks them last, after the Last Meal section', () => {
    const src = readFileSync(fileURLToPath(new URL(
      '../../../../../ios/AmiseMedFlow/Views/FrontDesk/AdaptiveQuestionnaireSheet+StepForms2.swift', import.meta.url)), 'utf8');
    const social = src.slice(src.indexOf('var phase6SocialSection'), src.indexOf('// ── Submit'));
    expect(social.indexOf('lifestyleQuestionSections')).toBeGreaterThan(social.indexOf('Label("Last Meal"'));
    expect(social.trimEnd().replace(/\s+/g, ' ')).toMatch(/lifestyleQuestionSections \}$/);
  });
});
