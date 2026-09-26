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

// The wording (question and help text, option values and labels, the "(patient-reported)" line
// labels) is the shared clinical rule file clinical-content/rules/lifestyle-questions.json, which
// LifestyleQuestions.swift reads too (through SharedClinicalContent); lint:shared-content checks it
// against its schema and both platforms' types, and lint:patient-instructions checks the wording.
// The queue rule and the templates below stay in code.

import type { Question } from './apcq';
import rawQuestions from '../../../clinical-content/rules/lifestyle-questions.json';

/** One answer option (a subset of the APCQ `QuestionOption`). */
export interface LifestyleQuestionOption {
  value: string;
  label: string;
  triggersKeys?: string[];
}

/** One question (a subset of the APCQ `Question`). */
export interface LifestyleQuestionContent {
  key: string;
  text: string;
  type: 'single_choice' | 'multi_choice';
  helpText?: string;
  options: LifestyleQuestionOption[];
}

/** clinical-content/rules/lifestyle-questions.json (part of the lifestyle-practices rule set). */
export interface LifestyleQuestionFile {
  version: string;
  /** Question key → question, in the order they are asked. */
  questions: Record<string, LifestyleQuestionContent>;
  /** Question key → social-history line label ("Fasting (patient-reported)"). */
  lineLabels: Record<string, string>;
}

const QUESTION_FILE = rawQuestions as unknown as LifestyleQuestionFile;

export const LIFESTYLE_QUESTIONS: Record<string, Question> = QUESTION_FILE.questions;
/** Content version of the shared file (= the lifestyle-practices rule set version). */
export const LIFESTYLE_QUESTIONS_VERSION: string = QUESTION_FILE.version;

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

const QUESTIONNAIRE_LINE_LABELS: Record<string, string> = QUESTION_FILE.lineLabels;

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
