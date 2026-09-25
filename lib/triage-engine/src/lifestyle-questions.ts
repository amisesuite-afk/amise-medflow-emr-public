// lifestyle-questions.ts
// Patient questionnaire (APCQ) questions on religious / ritual fasting and traditional or
// complementary treatments, and where they sit in the question queue.
//
// Used by apcq.ts, so both the front-desk token questionnaire (served by the api-server) and the
// public web intake (artifacts/front-desk/app/intake) ask them. They are information only: the
// wording gives no advice, names no medicine and has no instruction verb (hazard H-10).
//
// Queue rule: these questions never displace a clinical question. They always go last, and only
// while the session is below the APCQ question cap (placeLifestyleQuestions).
//
// Clinician-side use of the answers: lifestyle-practices.ts (structured record, prompts, plan
// suggestions). Source: practice evidence briefing (Dr D. D. Kabiye, Sept 2026), §4 and §6.

import type { Question } from './apcq';

export const LIFESTYLE_QUESTIONS: Record<string, Question> = {
  religious_fasting: {
    key: 'religious_fasting',
    text: 'Do you fast for religious or other reasons (for example Ramadan, Lent, a Daniel Fast or intermittent fasting)?',
    type: 'multi_choice',
    helpText: 'This is for information only, so the team can plan your care. Select all that apply.',
    options: [
      { value: 'none', label: 'No' },
      { value: 'ramadan', label: 'Ramadan', triggersKeys: ['religious_fasting_timing'] },
      { value: 'orthodox_lent', label: 'Orthodox or Lent fasting', triggersKeys: ['religious_fasting_timing'] },
      { value: 'daniel_fast', label: 'Daniel Fast', triggersKeys: ['religious_fasting_timing'] },
      { value: 'time_restricted', label: 'Intermittent fasting or time-restricted eating', triggersKeys: ['religious_fasting_timing'] },
      { value: 'other', label: 'Other', triggersKeys: ['religious_fasting_timing'] },
    ],
  },

  religious_fasting_timing: {
    key: 'religious_fasting_timing',
    text: 'Are you fasting at the moment, or planning a fast soon?',
    type: 'single_choice',
    options: [
      { value: 'now', label: 'Fasting now' },
      { value: 'within_month', label: 'Planning to fast within the next month' },
      { value: 'later', label: 'Planning to fast later' },
      { value: 'not_sure', label: 'Not sure' },
    ],
  },

  complementary_therapies: {
    key: 'complementary_therapies',
    text: 'Do you use any traditional or complementary treatments (for example acupuncture, cupping, yoga, detox or cleanse programmes, vitamin drips)?',
    type: 'multi_choice',
    helpText: 'This is for information only, so the team has a full picture. Select all that apply.',
    options: [
      { value: 'none', label: 'No' },
      { value: 'acupuncture', label: 'Acupuncture' },
      { value: 'cupping', label: 'Cupping' },
      { value: 'yoga', label: 'Yoga' },
      { value: 'tai_chi', label: 'Tai chi' },
      { value: 'mindfulness', label: 'Mindfulness or meditation' },
      { value: 'slow_breathing', label: 'Breathing exercises' },
      { value: 'detox_cleanse', label: 'Detox or cleanse programmes (including detox teas)' },
      { value: 'iv_vitamin_drips', label: 'Vitamin drips' },
      { value: 'other', label: 'Other' },
    ],
  },
};

/** Every lifestyle question key (none of them is a symptom). */
export const LIFESTYLE_QUESTION_KEYS: readonly string[] = Object.keys(LIFESTYLE_QUESTIONS);

/** Questionnaire templates that ask the lifestyle questions. */
export const LIFESTYLE_QUESTION_TEMPLATES: ReadonlySet<string> = new Set([
  'general_screening', 'new_consult', 'pre_op', 'second_opinion',
]);

const KEY_SET = new Set(LIFESTYLE_QUESTION_KEYS);

/**
 * The queue with the lifestyle questions moved to the end: the two opening questions for an
 * eligible template (unless already answered) and the timing follow-up when an answer queued
 * it, and only as many as fit under `maxQuestions`.
 */
export function placeLifestyleQuestions(
  queue: readonly string[],
  answeredKeys: ReadonlySet<string>,
  templateKey: string,
  maxQuestions: number,
): string[] {
  const rest = queue.filter(k => !KEY_SET.has(k));
  const pending: string[] = [];
  const eligible = LIFESTYLE_QUESTION_TEMPLATES.has(templateKey);
  if (eligible && !answeredKeys.has('religious_fasting')) pending.push('religious_fasting');
  if (queue.includes('religious_fasting_timing') && !answeredKeys.has('religious_fasting_timing')) {
    pending.push('religious_fasting_timing');
  }
  if (eligible && !answeredKeys.has('complementary_therapies')) pending.push('complementary_therapies');
  const room = Math.max(0, maxQuestions - answeredKeys.size - rest.length);
  return [...rest, ...pending.slice(0, room)];
}

const QUESTIONNAIRE_LINE_LABELS: Record<string, string> = {
  religious_fasting: 'Fasting (patient-reported)',
  religious_fasting_timing: 'Fasting timing (patient-reported)',
  complementary_therapies: 'Complementary treatments (patient-reported)',
};

/**
 * Short social-history line for a questionnaire answer to a lifestyle question, e.g.
 * "Fasting (patient-reported): Ramadan". `undefined` when `questionKey` is not a lifestyle
 * question; `null` when it is but the answer is empty or "No".
 */
export function lifestyleQuestionnaireLine(questionKey: string, answerDisplay: string): string | null | undefined {
  const label = QUESTIONNAIRE_LINE_LABELS[questionKey];
  if (!label) return undefined;
  const v = (answerDisplay ?? '').trim();
  if (!v || /^(no|none)$/i.test(v)) return null;
  return `${label}: ${v}`;
}
