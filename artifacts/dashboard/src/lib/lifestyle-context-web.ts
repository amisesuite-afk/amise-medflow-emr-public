/**
 * Builds the lifestyle-practices clinical context from the dashboard's consultation state.
 *
 * Rules and wording: @workspace/triage-engine/lifestyle-practices (twin of iOS
 * LifestylePractices.swift). Only a CONFIRMED working diagnosis (locked, or an ICD-10 code the
 * clinician recorded) counts as the diagnosis — CLAUDE.md "Central diagnosis radiation".
 * Pure: no React.
 */
import { joinClauses } from '@workspace/triage-engine';
import type { LifestyleContext, LifestyleHistory } from '@workspace/triage-engine/lifestyle-practices';

export interface LifestyleWebInput {
  lifestyle: LifestyleHistory;
  age: string;
  weightKg: string;
  heightCm: string;
  comorbidities: readonly string[];
  pmhNotes: string;
  symptoms: readonly string[];
  freeText: string;
  workingDiagnosis: { locked: boolean; diseaseLabel?: string; icdCode: string | null } | null;
  icdCodes: readonly string[];
  medications: readonly string[];
  medicationsText: string;
  visitType: string;
  encounterType: string;
}

/** Visit types / encounter types that mean a procedure or operation is booked or under way. */
const PROCEDURE_VISIT_TYPES = new Set(['pre_op', 'day_of_surgery', 'ercp', 'endoscopy_ogd', 'endoscopy_col']);
const PROCEDURE_ENCOUNTER_TYPES = new Set(['endoscopy', 'office_procedure']);

export function webAgeYears(age: string): number | null {
  const n = parseInt((age ?? '').trim(), 10);
  return Number.isFinite(n) && n >= 0 && n < 130 ? n : null;
}

export function webBmi(weightKg: string, heightCm: string): number | null {
  const w = parseFloat(weightKg);
  const h = parseFloat(heightCm);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h < 50 || h > 250) return null;
  const m = h / 100;
  return w / (m * m);
}

export function webProcedureBooked(input: Pick<LifestyleWebInput, 'visitType' | 'encounterType' | 'symptoms'>): boolean {
  return PROCEDURE_VISIT_TYPES.has(input.visitType)
    || PROCEDURE_ENCOUNTER_TYPES.has(input.encounterType)
    || input.symptoms.includes('Pre-operative visit');
}

export function lifestyleContextFromWeb(input: LifestyleWebInput): LifestyleContext {
  const wd = input.workingDiagnosis;
  const confirmedDx = wd?.locked ? [wd.diseaseLabel ?? '', wd.icdCode ?? ''] : [];
  // icdCodes entries look like "K80.2 — Calculus of gallbladder".
  return {
    lifestyle: input.lifestyle,
    ageYears: webAgeYears(input.age),
    diagnosisText: joinClauses([...confirmedDx, ...input.icdCodes]),
    problemText: joinClauses([...input.comorbidities, input.pmhNotes]),
    complaintText: joinClauses([...input.symptoms, input.freeText]),
    medicationText: joinClauses([...input.medications, input.medicationsText]),
    bmi: webBmi(input.weightKg, input.heightCm),
    procedureBooked: webProcedureBooked(input),
  };
}
