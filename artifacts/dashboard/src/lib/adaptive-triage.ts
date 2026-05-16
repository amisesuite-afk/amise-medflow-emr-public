import { scanRedFlags, Severity, AppointmentType } from './rules';

export type Sex = 'female' | 'male' | 'other' | 'unknown';

export interface VitalSigns {
  systolicBp?: number | null;
  diastolicBp?: number | null;
  heartRate?: number | null;
  temperatureC?: number | null;
  respiratoryRate?: number | null;
  spo2?: number | null;
  glucoseMmol?: number | null;
}

export interface AdaptiveTriageInput {
  age?: number | null;
  sex?: Sex;
  symptoms: string[];
  freeText?: string;
  comorbidities?: string[];
  surgicalHistory?: string[];
  medications?: string[];
  allergies?: string[];
  toxicHabits?: string[];
  vitalSigns?: VitalSigns;
  durationDays?: number | null;
  painScore?: number | null;
  isPostOp?: boolean;
  postOpDays?: number | null;
  pregnancyPossible?: boolean;
}

export interface AdaptiveTriageResult {
  acuity: Severity | 'routine';
  score: number;
  reasons: string[];
  recommendedAction: 'emergency_now' | 'same_day_call' | 'priority_24_48h' | 'routine_booking' | 'admin_review';
  appointmentType: AppointmentType;
  questionsToAsk: string[];
  safetyMessage: string;
  frontDeskScript: string;
  suggestedBlocks: string[];
  missingCriticalFields: string[];
}

const ERCP_TERMS = /(jaundice|yellow eyes|yellow skin|dark urine|pale stool|bile duct|cbd|stone|mrcp|ercp|cholangitis|pancreatitis|biliary)/i;
const BREAST_TERMS = /(breast|nipple|areola|mastitis|lump in breast|breast lump|discharge from nipple|bloody nipple)/i;
const POST_OP_TERMS = /(post.?op|after surgery|after operation|wound|stitches|drain|procedure|incision|suture)/i;
const HERNIA_TERMS = /(hernia|groin swelling|umbilical swelling|incisional bulge)/i;
const ENDOSCOPY_TERMS = /(colonoscopy|gastroscopy|ogd|endoscopy|occult blood|change in bowel|rectal bleed|dysphagia|reflux)/i;

interface NormalizedInput {
  age: number | null;
  sex: Sex;
  symptoms: string[];
  freeText: string;
  comorbidities: string[];
  surgicalHistory: string[];
  medications: string[];
  allergies: string[];
  toxicHabits: string[];
  vitalSigns: Required<VitalSigns>;
  durationDays: number | null;
  painScore: number | null;
  isPostOp: boolean;
  postOpDays: number | null;
  pregnancyPossible: boolean;
}

function cleanList(values?: string[]): string[] {
  return (values || []).map(v => v.trim()).filter(Boolean);
}

function boundedNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.min(Math.max(value, min), max);
}

function normalise(input: AdaptiveTriageInput): NormalizedInput {
  const vitals = input.vitalSigns || {};
  return {
    age: boundedNumber(input.age, 0, 120),
    sex: input.sex || 'unknown',
    symptoms: cleanList(input.symptoms),
    freeText: input.freeText?.trim() || '',
    comorbidities: cleanList(input.comorbidities),
    surgicalHistory: cleanList(input.surgicalHistory),
    medications: cleanList(input.medications),
    allergies: cleanList(input.allergies),
    toxicHabits: cleanList(input.toxicHabits),
    vitalSigns: {
      systolicBp: boundedNumber(vitals.systolicBp, 40, 260),
      diastolicBp: boundedNumber(vitals.diastolicBp, 20, 160),
      heartRate: boundedNumber(vitals.heartRate, 20, 240),
      temperatureC: boundedNumber(vitals.temperatureC, 30, 43),
      respiratoryRate: boundedNumber(vitals.respiratoryRate, 5, 60),
      spo2: boundedNumber(vitals.spo2, 50, 100),
      glucoseMmol: boundedNumber(vitals.glucoseMmol, 0, 60),
    },
    durationDays: boundedNumber(input.durationDays, 0, 3650),
    painScore: boundedNumber(input.painScore, 0, 10),
    isPostOp: Boolean(input.isPostOp),
    postOpDays: boundedNumber(input.postOpDays, 0, 3650),
    pregnancyPossible: Boolean(input.pregnancyPossible),
  };
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function addScore(condition: boolean, points: number, reason: string, state: { score: number; reasons: string[] }) {
  if (!condition) return;
  state.score += points;
  state.reasons.push(reason);
}

export function adaptiveTriage(input: AdaptiveTriageInput): AdaptiveTriageResult {
  const data = normalise(input);
  const combined = [
    data.freeText,
    ...data.symptoms,
    ...data.comorbidities,
    ...data.surgicalHistory,
    ...data.medications,
    ...data.toxicHabits,
  ].join(' ');
  const redFlags = scanRedFlags(combined);

  const state = { score: 0, reasons: [] as string[] };

  for (const match of redFlags.matches) {
    state.score += match.severity === 'urgent' ? 40 : match.severity === 'priority' ? 25 : 12;
    state.reasons.push(match.reason);
  }

  addScore(data.age !== null && data.age >= 70, 12, 'Age 70 or older', state);
  addScore(data.age !== null && data.age >= 60 && data.age < 70, 7, 'Age 60 or older', state);

  const comorbText = data.comorbidities.join(' ').toLowerCase();
  addScore(/(diabetes|renal|kidney|ckd|dialysis|heart failure|afib|atrial fibrillation|stroke|cancer|chemotherapy|immunosuppressed|steroid|cirrhosis|liver disease)/.test(comorbText), 12, 'Higher-risk comorbidity present', state);

  const medText = data.medications.join(' ').toLowerCase();
  addScore(/(warfarin|xarelto|rivaroxaban|eliquis|apixaban|dabigatran|clopidogrel|aspirin|heparin|enoxaparin)/.test(medText), 12, 'Anticoagulant or antiplatelet medication mentioned', state);
  addScore(/(insulin|gliclazide|diamicro?n|glibenclamide)/.test(medText), 6, 'Diabetes medication mentioned', state);

  addScore(data.painScore !== null && data.painScore >= 8, 20, 'Severe pain score', state);
  addScore(data.painScore !== null && data.painScore >= 5 && data.painScore < 8, 8, 'Moderate pain score', state);

  const v = data.vitalSigns;
  addScore(v.temperatureC !== null && v.temperatureC >= 38, 20, 'Fever recorded', state);
  addScore(v.spo2 !== null && v.spo2 < 94, 30, 'Low oxygen saturation', state);
  addScore(v.heartRate !== null && v.heartRate >= 120, 20, 'Marked tachycardia', state);
  addScore(v.systolicBp !== null && v.systolicBp < 90, 30, 'Low systolic blood pressure', state);
  addScore(v.glucoseMmol !== null && (v.glucoseMmol < 3.5 || v.glucoseMmol > 20), 18, 'Concerning blood glucose value', state);

  if (data.isPostOp || POST_OP_TERMS.test(combined)) {
    addScore(true, data.postOpDays !== null && data.postOpDays <= 14 ? 25 : 15, 'Post-operative or recent-procedure concern', state);
  }

  addScore(data.pregnancyPossible, 12, 'Pregnancy possibility requires clinical review', state);
  addScore(/(fever|chills|rigors)/i.test(combined) && ERCP_TERMS.test(combined), 35, 'Possible cholangitis pattern', state);
  addScore(/(vomiting|unable to keep fluids|dehydrated)/i.test(combined), 15, 'Vomiting or possible dehydration', state);
  addScore(/(black stool|melena|melaena|rectal bleeding|blood in stool)/i.test(combined), 25, 'Possible gastrointestinal bleeding', state);

  let appointmentType: AppointmentType = 'new_consult';
  if (/follow.?up|review/i.test(combined)) appointmentType = 'follow_up';
  if (ERCP_TERMS.test(combined)) appointmentType = 'ercp_workup';
  if (BREAST_TERMS.test(combined)) appointmentType = 'breast';
  if (data.isPostOp || POST_OP_TERMS.test(combined)) appointmentType = 'post_op';
  if (/telephone|phone call|call me/i.test(combined)) appointmentType = 'telephone';

  let acuity: AdaptiveTriageResult['acuity'] = 'routine';
  let recommendedAction: AdaptiveTriageResult['recommendedAction'] = 'routine_booking';

  if (state.score >= 45 || redFlags.matches.some(m => m.severity === 'urgent')) {
    acuity = 'urgent';
    recommendedAction = 'emergency_now';
  } else if (state.score >= 28 || redFlags.matches.some(m => m.severity === 'priority')) {
    acuity = 'priority';
    recommendedAction = 'same_day_call';
  } else if (state.score >= 14 || redFlags.matches.some(m => m.severity === 'review')) {
    acuity = 'review';
    recommendedAction = 'priority_24_48h';
  }

  const missingCriticalFields = buildMissingFields(data, combined);
  const questionsToAsk = buildQuestions(data, combined, missingCriticalFields);
  const suggestedBlocks = buildSuggestedBlocks(data, combined, appointmentType);

  return {
    acuity,
    score: state.score,
    reasons: uniq(state.reasons),
    recommendedAction,
    appointmentType,
    questionsToAsk,
    safetyMessage: recommendedAction === 'emergency_now'
      ? 'Do not auto-book. Advise urgent emergency assessment / Tapion contact and alert clinical staff immediately.'
      : 'Administrative triage aid only. Diagnosis and treatment decisions remain with Dr Kabiye or clinical staff.',
    frontDeskScript: buildFrontDeskScript(recommendedAction, questionsToAsk),
    suggestedBlocks,
    missingCriticalFields,
  };
}

function buildMissingFields(data: NormalizedInput, combined: string): string[] {
  const missing: string[] = [];
  if (data.age === null) missing.push('age');
  if (data.sex === 'unknown') missing.push('sex');
  if (!data.symptoms.length && !data.freeText) missing.push('main complaint');
  if (data.durationDays === null) missing.push('duration');
  if (!data.medications.length) missing.push('medications');
  if (!data.allergies.length) missing.push('allergies');
  if (/(pain|ache|colic|abdomen|belly|wound|breast|hernia)/i.test(combined) && data.painScore === null) missing.push('pain score');
  return missing;
}

function buildQuestions(data: NormalizedInput, combined: string, missing: string[]): string[] {
  const questions: string[] = [];
  if (missing.includes('age')) questions.push('Patient age?');
  if (missing.includes('sex')) questions.push('Patient sex?');
  if (missing.includes('main complaint')) questions.push('Main symptom or reason for visit?');
  if (missing.includes('duration')) questions.push('How long has this been present?');
  if (missing.includes('pain score')) questions.push('Pain score from 0 to 10?');
  if (missing.includes('medications')) questions.push('Current medications, especially blood thinners or diabetes medicines?');
  if (missing.includes('allergies')) questions.push('Any medication allergies?');
  if (BREAST_TERMS.test(combined)) questions.push('Any breast redness, fever, nipple discharge, new lump, or rapid enlargement?');
  if (ERCP_TERMS.test(combined)) questions.push('Any fever, chills, jaundice, dark urine, pale stools, or worsening abdominal pain?');
  if (data.isPostOp || POST_OP_TERMS.test(combined)) questions.push('Operation/procedure date and any fever, discharge, bleeding, or wound opening?');
  if (HERNIA_TERMS.test(combined)) questions.push('Is the hernia painful, irreducible, red, or associated with vomiting?');
  if (ENDOSCOPY_TERMS.test(combined)) questions.push('Any weight loss, dysphagia, black stool, rectal bleeding, or anticoagulant use?');
  return uniq(questions).slice(0, 10);
}

function buildSuggestedBlocks(data: NormalizedInput, combined: string, appointmentType: AppointmentType): string[] {
  const blocks = ['Demographics', 'Contact details', 'PMH', 'Medication/allergy list', 'Reason for visit'];
  if (appointmentType === 'breast') blocks.push('Breast symptoms', 'Family history', 'Prior imaging/biopsy');
  if (appointmentType === 'ercp_workup') blocks.push('LFT/imaging summary', 'Anticoagulants', 'Previous ERCP/surgery');
  if (appointmentType === 'post_op' || data.isPostOp) blocks.push('Operation details', 'Wound/drain status', 'Temperature/vitals');
  if (ENDOSCOPY_TERMS.test(combined)) blocks.push('GI alarm symptoms', 'Bowel habit', 'Anticoagulants');
  if (HERNIA_TERMS.test(combined)) blocks.push('Hernia reducibility', 'Obstruction symptoms', 'Prior repairs');
  if (data.vitalSigns.temperatureC || data.vitalSigns.spo2 || data.vitalSigns.heartRate) blocks.push('Vital signs trend');
  return uniq(blocks);
}

function buildFrontDeskScript(action: AdaptiveTriageResult['recommendedAction'], questions: string[]): string {
  const questionLine = questions.length ? ` Please confirm: ${questions.slice(0, 4).join(' ')}` : '';
  if (action === 'emergency_now') {
    return `Thank you for the message. Because of the symptoms mentioned, this needs urgent clinical attention and should not wait for routine booking. Please contact Tapion Hospital / emergency services now while I alert the clinical team.${questionLine}`;
  }
  if (action === 'same_day_call') {
    return `Thank you. I will flag this for a same-day clinical call/review rather than routine booking.${questionLine}`;
  }
  if (action === 'priority_24_48h') {
    return `Thank you. I will mark this for priority review within 24–48 hours and collect a few details for Dr Kabiye.${questionLine}`;
  }
  return `Thank you. I can proceed with routine booking once the basic intake details are complete.${questionLine}`;
}
