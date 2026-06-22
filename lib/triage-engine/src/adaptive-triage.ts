import { scanRedFlags, Severity, AppointmentType, PATHWAY_DEFINITIONS, PathwayPanel } from './rules';
import { matchSurgicalPathologies, SurgicalPathology } from './surgical-dictionary';
import { screenForCancer, detectReferrals, CancerScreenResult, ReferralRecommendation, ScreeningInput } from './cancer-screening';

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
  symptomDetails?: Record<string, string[]>;
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

export interface VitalRedFlag {
  label: string;
  severity: Severity;
  value: string;
}

export interface AdaptiveTriageResult {
  acuity: Severity | 'routine';
  score: number;
  reasons: string[];
  vitalRedFlags: VitalRedFlag[];
  activePathways: PathwayPanel[];
  recommendedAction: 'emergency_now' | 'same_day_call' | 'priority_24_48h' | 'routine_booking' | 'admin_review';
  appointmentType: AppointmentType;
  questionsToAsk: string[];
  safetyMessage: string;
  frontDeskScript: string;
  suggestedBlocks: string[];
  missingCriticalFields: string[];
  /** Surgical pathologies (with ICD-10/CPT codes) matched against the patient's reason/free text, most urgent first. */
  surgicalMatches: SurgicalPathology[];
  /** "Magnet first step" flag -- true when the patient's complaint matches a known surgical pathology. */
  isPrimarilySurgical: boolean;
  /** NICE NG12 cancer screening result when criteria are met. */
  cancerScreen: CancerScreenResult | null;
  /** Internal medicine / allied referral recommendations when pathology is non-surgical. */
  referralRecommendations: ReferralRecommendation[];
}

const ERCP_TERMS = /(jaundice|yellow eyes|yellow skin|dark urine|pale stool|bile duct|cbd|stone|mrcp|ercp|cholangitis|pancreatitis|biliary)/i;
const BREAST_TERMS = /(breast|nipple|areola|mastitis|lump in breast|breast lump|discharge from nipple|bloody nipple)/i;
const POST_OP_TERMS = /(post.?op|after surgery|after operation|wound|stitches|drain|procedure|incision|suture)/i;
const HERNIA_TERMS = /(hernia|groin swelling|umbilical swelling|incisional bulge)/i;
const ENDOSCOPY_TERMS = /(colonoscopy|gastroscopy|ogd|endoscopy|occult blood|change in bowel|rectal bleed|dysphagia|reflux)/i;
const DIABETIC_FOOT_TERMS = /(diabetic foot|foot ulcer|foot wound|gangrene|foot infection|osteomyelitis|exposed bone|spreading redness)/i;
const GI_BLEED_TERMS = /(haematemesis|hematemesis|melaena|melena|rectal bleed|vomiting blood|black stool|blood in stool)/i;
const CHEST_PAIN_TERMS = /(chest pain|crushing pain|left arm|jaw pain|tearing pain)/i;

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
  const detailFlat = Object.values(input.symptomDetails || {}).flat();
  return {
    age: boundedNumber(input.age, 0, 120),
    sex: input.sex || 'unknown',
    symptoms: [...cleanList(input.symptoms), ...cleanList(detailFlat)],
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

function computeVitalRedFlags(v: Required<VitalSigns>): VitalRedFlag[] {
  const flags: VitalRedFlag[] = [];
  if (v.systolicBp !== null && v.systolicBp < 90) flags.push({ label: 'Hypotension', severity: 'urgent', value: `SBP ${v.systolicBp} mmHg` });
  if (v.heartRate !== null && v.heartRate > 120) flags.push({ label: 'Tachycardia', severity: 'urgent', value: `HR ${v.heartRate} bpm` });
  if (v.respiratoryRate !== null && v.respiratoryRate > 24) flags.push({ label: 'Tachypnoea', severity: 'urgent', value: `RR ${v.respiratoryRate}/min` });
  if (v.temperatureC !== null && v.temperatureC >= 38) flags.push({ label: 'Fever', severity: 'priority', value: `Temp ${v.temperatureC}°C` });
  if (v.temperatureC !== null && v.temperatureC >= 39.5) flags.push({ label: 'High fever', severity: 'urgent', value: `Temp ${v.temperatureC}°C` });
  if (v.spo2 !== null && v.spo2 < 94) flags.push({ label: 'Low SpO₂', severity: 'urgent', value: `SpO₂ ${v.spo2}%` });
  if (v.spo2 !== null && v.spo2 < 90) flags.push({ label: 'Critical hypoxia', severity: 'urgent', value: `SpO₂ ${v.spo2}%` });
  if (v.glucoseMmol !== null && v.glucoseMmol > 20) flags.push({ label: 'Hyperglycaemia', severity: 'urgent', value: `RBS ${v.glucoseMmol} mmol/L` });
  if (v.glucoseMmol !== null && v.glucoseMmol < 3.5) flags.push({ label: 'Hypoglycaemia', severity: 'urgent', value: `RBS ${v.glucoseMmol} mmol/L` });
  return flags;
}

function detectPathways(combined: string, v: Required<VitalSigns>): PathwayPanel[] {
  const result: PathwayPanel[] = [];
  const vSummary = { sbp: v.systolicBp, hr: v.heartRate, temp: v.temperatureC, spo2: v.spo2 };
  for (const def of PATHWAY_DEFINITIONS) {
    if (!def.trigger.test(combined)) continue;
    if (def.compositeCheck && !def.compositeCheck(vSummary)) continue;
    result.push({
      id: def.id,
      title: def.title,
      severity: def.severity,
      checklist: def.checklist,
      contacts: def.contacts,
      doctorNotes: def.doctorNotes,
    });
  }
  return result;
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
  const vitalRedFlags = computeVitalRedFlags(data.vitalSigns);

  const state = { score: 0, reasons: [] as string[] };

  for (const match of redFlags.matches) {
    state.score += match.severity === 'urgent' ? 40 : match.severity === 'priority' ? 25 : 12;
    state.reasons.push(match.reason);
  }

  for (const vf of vitalRedFlags) {
    state.score += vf.severity === 'urgent' ? 30 : 15;
    state.reasons.push(vf.label);
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

  if (data.isPostOp || POST_OP_TERMS.test(combined)) {
    addScore(true, data.postOpDays !== null && data.postOpDays <= 14 ? 25 : 15, 'Post-operative or recent-procedure concern', state);
  }

  addScore(data.pregnancyPossible, 12, 'Pregnancy possibility requires clinical review', state);
  addScore(/(fever|chills|rigors)/i.test(combined) && ERCP_TERMS.test(combined), 35, 'Possible cholangitis pattern', state);
  addScore(/(vomiting|unable to keep fluids|dehydrated)/i.test(combined), 15, 'Vomiting or possible dehydration', state);
  addScore(GI_BLEED_TERMS.test(combined), 25, 'Possible gastrointestinal bleeding', state);

  // Composite vital + symptom checks
  const v = data.vitalSigns;
  const hasFever = v.temperatureC !== null && v.temperatureC >= 38;
  const hasHypotension = v.systolicBp !== null && v.systolicBp < 90;
  const hasTachycardia = v.heartRate !== null && v.heartRate > 120;

  addScore(CHEST_PAIN_TERMS.test(combined) && (v.spo2 !== null && v.spo2 < 95), 50, 'Chest pain with hypoxia — possible ACS / PE', state);
  addScore(ERCP_TERMS.test(combined) && hasFever, 35, 'Jaundice with fever — cholangitis pattern', state);
  addScore(GI_BLEED_TERMS.test(combined) && (hasHypotension || hasTachycardia), 60, 'GI bleed with haemodynamic instability — emergency', state);
  addScore(DIABETIC_FOOT_TERMS.test(combined) && hasFever, 40, 'Diabetic foot infection with systemic fever', state);
  addScore(POST_OP_TERMS.test(combined) && hasFever && (data.postOpDays === null || data.postOpDays <= 30), 35, 'Post-op fever — source must be identified', state);

  let appointmentType: AppointmentType = 'new_consult';
  if (/follow.?up|review/i.test(combined)) appointmentType = 'follow_up';
  if (ERCP_TERMS.test(combined)) appointmentType = 'ercp_workup';
  if (BREAST_TERMS.test(combined)) appointmentType = 'breast';
  if (data.isPostOp || POST_OP_TERMS.test(combined)) appointmentType = 'post_op';
  if (/telephone|phone call|call me/i.test(combined)) appointmentType = 'telephone';
  if (DIABETIC_FOOT_TERMS.test(combined)) appointmentType = 'diabetic_foot';

  let acuity: AdaptiveTriageResult['acuity'] = 'routine';
  let recommendedAction: AdaptiveTriageResult['recommendedAction'] = 'routine_booking';

  if (state.score >= 45 || redFlags.matches.some(m => m.severity === 'urgent') || vitalRedFlags.some(f => f.severity === 'urgent')) {
    acuity = 'urgent';
    recommendedAction = 'emergency_now';
  } else if (state.score >= 28 || redFlags.matches.some(m => m.severity === 'priority') || vitalRedFlags.some(f => f.severity === 'priority')) {
    acuity = 'priority';
    recommendedAction = 'same_day_call';
  } else if (state.score >= 14 || redFlags.matches.some(m => m.severity === 'review')) {
    acuity = 'review';
    recommendedAction = 'priority_24_48h';
  }

  const activePathways = detectPathways(combined, data.vitalSigns);
  const missingCriticalFields = buildMissingFields(data, combined);
  const questionsToAsk = buildQuestions(data, combined, missingCriticalFields);
  // "Magnet first step": flag patients whose complaint matches a known
  // surgical pathology as early as booking/check-in, with suggested codes.
  const surgicalMatches = matchSurgicalPathologies(combined);
  const isPrimarilySurgical = surgicalMatches.length > 0;

  const suggestedBlocks = buildSuggestedBlocks(data, combined, appointmentType, surgicalMatches);

  // An urgent surgical pathology (e.g. strangulated hernia, GI bleed,
  // diabetic foot gangrene) should never be triaged below "priority", even
  // if the symptom-score rules above didn't already flag it.
  if (surgicalMatches.some(m => m.surgicalPriority === 'urgent') && acuity !== 'urgent') {
    acuity = 'priority';
    if (recommendedAction === 'routine_booking' || recommendedAction === 'priority_24_48h') {
      recommendedAction = 'same_day_call';
    }
  }

  const screeningInput: ScreeningInput = {
    age: data.age,
    sex: data.sex === 'unknown' ? 'unknown' : data.sex,
    chiefComplaints: data.symptoms,
    symptoms: data.symptoms,
    familyHistory: data.comorbidities.filter(c => /family|hereditary|brca|lynch/i.test(c)),
    responses: {},
  };
  const cancerScreen = screenForCancer(screeningInput);
  const referralRecommendations = detectReferrals(screeningInput);

  if (cancerScreen.triggered && cancerScreen.referralUrgency === 'two_week_wait') {
    addScore(true, 30, `Cancer screening triggered (${cancerScreen.cancerType}) -- 2-week-wait referral criteria met`, state);
    if (acuity === 'routine' || acuity === 'review') {
      acuity = 'priority';
      recommendedAction = 'same_day_call';
    }
  }

  return {
    acuity,
    score: state.score,
    reasons: uniq(state.reasons),
    vitalRedFlags,
    activePathways,
    recommendedAction,
    appointmentType,
    questionsToAsk,
    safetyMessage: recommendedAction === 'emergency_now'
      ? 'Do not auto-book. Advise urgent emergency assessment / Tapion contact and alert clinical staff immediately.'
      : 'Administrative triage aid only. Diagnosis and treatment decisions remain with Dr Kabiye or clinical staff.',
    frontDeskScript: buildFrontDeskScript(recommendedAction, questionsToAsk),
    suggestedBlocks,
    missingCriticalFields,
    surgicalMatches,
    isPrimarilySurgical,
    cancerScreen: cancerScreen.triggered ? cancerScreen : null,
    referralRecommendations,
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
  if (DIABETIC_FOOT_TERMS.test(combined)) questions.push('Wound appearance, peripheral pulses, fever, and spreading redness?');
  return uniq(questions).slice(0, 10);
}

function buildSuggestedBlocks(data: NormalizedInput, combined: string, appointmentType: AppointmentType, surgicalMatches: SurgicalPathology[]): string[] {
  const blocks = ['Demographics', 'Contact details', 'PMH', 'Medication/allergy list', 'Reason for visit'];
  if (appointmentType === 'breast') blocks.push('Breast symptoms', 'Family history', 'Prior imaging/biopsy');
  if (appointmentType === 'ercp_workup') blocks.push('LFT/imaging summary', 'Anticoagulants', 'Previous ERCP/surgery');
  if (appointmentType === 'post_op' || data.isPostOp) blocks.push('Operation details', 'Wound/drain status', 'Temperature/vitals');
  if (appointmentType === 'diabetic_foot') blocks.push('Wound assessment', 'Peripheral pulses', 'HbA1c / glucose', 'Vascular referral');
  if (ENDOSCOPY_TERMS.test(combined)) blocks.push('GI alarm symptoms', 'Bowel habit', 'Anticoagulants');
  if (HERNIA_TERMS.test(combined)) blocks.push('Hernia reducibility', 'Obstruction symptoms', 'Prior repairs');
  if (data.vitalSigns.temperatureC || data.vitalSigns.spo2 || data.vitalSigns.heartRate) blocks.push('Vital signs trend');
  for (const category of uniq(surgicalMatches.map(m => m.category))) {
    blocks.push(`Surgical workup: ${category}`);
  }
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
