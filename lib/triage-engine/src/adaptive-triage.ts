import { scanRedFlags, Severity, AppointmentType, PATHWAY_DEFINITIONS, PathwayPanel } from './rules';
import { matchSurgicalPathologies, SurgicalPathology } from './surgical-dictionary';
import { screenForCancer, detectReferrals, readCancerScreenLabs, CancerScreenResult, ReferralRecommendation, ScreeningInput } from './cancer-screening';
import { joinClauses, testAffirmed } from './negation';
import {
  assessEmergencies, paediatricVitalLimits, textReportsFever, EMERGENCY_REDIRECT,
  type EmergencyAssessment, type EmergencyLevel, type RecognisedEmergency, type SafeguardingFlag, type RiskModifier,
} from './emergency-recognition';
import type { News2Avpu, News2Evaluation } from './news2';

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
  /**
   * The rest of the record, read by the emergency-recognition layer (emergency-recognition.ts):
   * triage level = max(text rules, vital signs / NEWS2, blood pressure, critical labs, ECG,
   * confirmed diagnosis). All optional: the front-desk and API callers pass only the complaint.
   */
  examText?: string;
  /** Laboratory results, name → result text. */
  investigationResults?: Record<string, string>;
  /** Imaging / ECG / other report texts. */
  resultReports?: string[];
  /** Working / confirmed diagnosis: assessment text and ICD-10 codes. */
  diagnosis?: { text?: string | null; icd10?: Array<string | null | undefined> } | null;
  /** NEWS2 ACVPU and air/oxygen (null = not recorded). */
  avpu?: News2Avpu | null;
  onSupplementalO2?: boolean | null;
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
  /** Emergencies recognised from the whole record (recognise-and-redirect layer), most severe first. */
  recognisedEmergencies: RecognisedEmergency[];
  /** Safeguarding concerns (child maltreatment, domestic abuse). */
  safeguardingFlags: SafeguardingFlag[];
  /** Context that changes how findings should be read (immunosuppression, beta-blocker, …). */
  riskModifiers: RiskModifier[];
  /** NEWS2 when computed (adults ≥ 16, not pregnant, at least one observation). */
  news2: News2Evaluation | null;
  /** The 911 / emergency department redirect when the action is emergency_now, otherwise null. */
  emergencyRedirect: string | null;
}

const ERCP_TERMS = /(jaundice|yellow eyes|yellow skin|dark urine|pale stool|bile duct|cbd|stone|mrcp|ercp|cholangitis|pancreatitis|biliary)/i;
const BREAST_TERMS = /(breast|nipple|areola|mastitis|lump in breast|breast lump|discharge from nipple|bloody nipple)/i;
const POST_OP_TERMS = /(post.?op|after surgery|after operation|wound|stitches|drain|procedure|incision|suture)/i;
const HERNIA_TERMS = /(hernia|groin swelling|umbilical swelling|incisional bulge)/i;
const ENDOSCOPY_TERMS = /(colonoscopy|gastroscopy|ogd|endoscopy|occult blood|change in bowel|rectal bleed|dysphagia|reflux)/i;
const DIABETIC_FOOT_TERMS = /(diabetic foot|foot ulcer|foot wound|gangrene|foot infection|osteomyelitis|exposed bone|spreading redness)/i;
const GI_BLEED_TERMS = /(haematemesis|hematemesis|melaena|melena|rectal bleed|vomiting blood|black stool|blood in stool)/i;
// "left arm" / "jaw pain" alone are not chest pain (SURGEON-DECISIONS E2): "Excision of lipoma
// left arm" in the surgical history used to read as a cardiac event.
const CHEST_PAIN_TERMS = /\b(chest pain|chest pressure|chest tightness|crushing (chest )?pain|tearing (chest |back )pain)\b/i;
const BREATHLESS_TERMS = /\b(breathless\w*|short(ness)? of breath|dyspn(o)?ea|difficulty breathing|struggling to breathe)\b/i;

/** A past-history entry about a relative, not the patient. */
const FAMILY_ENTRY = /\b(family history|fam(ily)? hx|fhx|f\/h|mother|father|sister|brother|parents?|aunt|uncle|grand(mother|father|parent)s?|cousin|relatives?)\b/i;
/** Malignancy features that keep the "Possible malignancy" flag in a screening request. */
const MALIGNANCY_FEATURES = /\b(new lump|growing lump|breast lump|lump|mass|weight loss|losing weight|night sweats|bleeding|blood in|change in bowel habit|dysphagia|nipple discharge)\b/i;
const SCREENING_TOPIC = /\b(screening|screen(ed)?|check-?up|risk|family history|genetic\w*|brca\w*|lynch|hereditary|mother|father|sister|brother|relatives?)\b/i;
/** "No bowel symptoms", "asymptomatic", "no breast symptoms" — read literally (the negation is the point). */
const STATES_ASYMPTOMATIC = /\b(asymptomatic|symptom[- ]free|no (?:[a-z]+ ){0,2}symptoms|no complaints)\b/i;
/** Symptom chips that are administrative, not symptoms. */
const ADMIN_CHIPS = /^(annual review|screening|check-?up|wellness|health check|follow[- ]?up|review)$/i;

/**
 * An asymptomatic screening or risk-assessment request: the history states there are no symptoms,
 * names a screening / family-history topic, and no symptom chip is recorded.
 */
function isAsymptomaticScreeningRequest(data: NormalizedInput): boolean {
  if (data.symptoms.some(s => !ADMIN_CHIPS.test(s.trim()))) return false;
  return STATES_ASYMPTOMATIC.test(data.freeText) && SCREENING_TOPIC.test(data.freeText);
}

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

const LEVEL_RANK: Record<EmergencyLevel, number> = { priority: 1, urgent: 2, emergency: 3 };

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

/**
 * Vital-sign red flags. Adult thresholds apply from 16 years; children use the age-banded limits
 * of paediatricVitalLimits() (NICE NG51 high-risk heart / respiratory rate, which match NICE
 * NG143 for under 5s; AHA PALS 2020 hypotension), so a normal infant heart rate is not "shock".
 */
function computeVitalRedFlags(v: Required<VitalSigns>, ageYears: number | null = null): VitalRedFlag[] {
  const flags: VitalRedFlag[] = [];
  const L = paediatricVitalLimits(ageYears);
  if (L) {
    if (v.systolicBp !== null && v.systolicBp < L.sbpLow) flags.push({ label: 'Hypotension (for age)', severity: 'urgent', value: `SBP ${v.systolicBp} mmHg (< ${L.sbpLow}, ${L.band})` });
    if (v.heartRate !== null && v.heartRate >= L.hrHigh) flags.push({ label: 'Tachycardia (for age)', severity: 'urgent', value: `HR ${v.heartRate} bpm (≥ ${L.hrHigh}, ${L.band})` });
    if (v.heartRate !== null && v.heartRate < L.hrLow) flags.push({ label: 'Bradycardia (for age)', severity: 'urgent', value: `HR ${v.heartRate} bpm (< ${L.hrLow}, ${L.band})` });
    if (v.respiratoryRate !== null && v.respiratoryRate >= L.rrHigh) flags.push({ label: 'Tachypnoea (for age)', severity: 'urgent', value: `RR ${v.respiratoryRate}/min (≥ ${L.rrHigh}, ${L.band})` });
    if (v.temperatureC !== null && v.temperatureC >= 38) flags.push({ label: 'Fever', severity: 'priority', value: `Temp ${v.temperatureC}°C` });
    if (v.spo2 !== null && v.spo2 < L.spo2Low) flags.push({ label: 'Critical hypoxia', severity: 'urgent', value: `SpO₂ ${v.spo2}%` });
    else if (v.spo2 !== null && v.spo2 <= 95) flags.push({ label: 'Low SpO₂', severity: 'priority', value: `SpO₂ ${v.spo2}%` });
    if (v.glucoseMmol !== null && v.glucoseMmol > 20) flags.push({ label: 'Hyperglycaemia', severity: 'urgent', value: `RBS ${v.glucoseMmol} mmol/L` });
    if (v.glucoseMmol !== null && v.glucoseMmol < 3.5) flags.push({ label: 'Hypoglycaemia', severity: 'urgent', value: `RBS ${v.glucoseMmol} mmol/L` });
    return flags;
  }
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

function detectPathways(clinicalText: string, v: Required<VitalSigns>): PathwayPanel[] {
  const result: PathwayPanel[] = [];
  const vSummary = { sbp: v.systolicBp, hr: v.heartRate, temp: v.temperatureC, spo2: v.spo2 };
  for (const def of PATHWAY_DEFINITIONS) {
    if (!testAffirmed(def.trigger, clinicalText)) continue;
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
  // The same items, one clause each, for the clinical (symptom) rules: those are negation-aware,
  // so "No bleeding", "no vomiting", "No chest pain described" do not score (negation.ts), and a
  // clause break keeps a negation in one item from reaching into the next.
  // The past surgical history is NOT read by the symptom rules: "Excision of lipoma left arm"
  // is not a cardiac event and "Laparotomy for bleeding ulcer 2010" is not a current bleed
  // (clinical-validation findings; SURGEON-DECISIONS E2).
  const clinicalText = joinClauses([
    data.freeText,
    ...data.symptoms,
    ...data.comorbidities,
    ...data.medications,
    ...data.toxicHabits,
  ]);
  const has = (pattern: RegExp) => testAffirmed(pattern, clinicalText);
  const scanned = scanRedFlags(clinicalText);
  // An asymptomatic screening / risk request ("No bowel symptoms. Wants bowel cancer screening",
  // "Asymptomatic; sister had colon cancer at 48") is not a possible malignancy in this patient:
  // the bare word "cancer" is the topic of the visit, not a finding. The flag is kept whenever a
  // malignancy feature (lump, weight loss, night sweats) or a symptom chip is recorded
  // (clinical-validation screening over-triage; NICE NG12 lists symptoms, not a topic).
  const asymptomaticScreening = isAsymptomaticScreeningRequest(data);
  const redFlags = asymptomaticScreening
    ? { ...scanned, matches: scanned.matches.filter(m => m.reason !== 'Possible malignancy' || testAffirmed(MALIGNANCY_FEATURES, clinicalText)) }
    : scanned;

  // Recognise-and-redirect layer: the whole record (history, exam, vitals, NEWS2, BP, labs, ECG,
  // diagnosis). Its level is combined with every other source below as a maximum.
  const emergency: EmergencyAssessment = assessEmergencies({
    age: data.age,
    sex: data.sex,
    historyText: joinClauses([data.freeText, ...data.symptoms]),
    examText: input.examText ?? '',
    comorbidities: data.comorbidities,
    surgicalHistory: data.surgicalHistory,
    medications: data.medications,
    allergies: data.allergies,
    vitals: { ...data.vitalSigns, avpu: input.avpu ?? null, onSupplementalO2: input.onSupplementalO2 ?? null },
    investigationResults: input.investigationResults,
    resultReports: input.resultReports,
    diagnosis: input.diagnosis ?? null,
    pregnancyPossible: data.pregnancyPossible,
    isPostOp: data.isPostOp,
    postOpDays: data.postOpDays,
  });
  const ageYears = emergency.ageYears ?? data.age;
  const vitalRedFlags = computeVitalRedFlags(data.vitalSigns, ageYears);
  const limits = paediatricVitalLimits(ageYears);

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

  // A relative's disease ("Family history of colorectal cancer (father, 58)") is a risk factor for
  // screening, not this patient's comorbidity.
  const comorbText = data.comorbidities.filter(c => !FAMILY_ENTRY.test(c)).join(' ').toLowerCase();
  addScore(/(diabetes|renal|kidney|ckd|dialysis|heart failure|afib|atrial fibrillation|stroke|cancer|chemotherapy|immunosuppressed|steroid|cirrhosis|liver disease)/.test(comorbText), 12, 'Higher-risk comorbidity present', state);

  const medText = data.medications.join(' ').toLowerCase();
  addScore(/(warfarin|xarelto|rivaroxaban|eliquis|apixaban|dabigatran|clopidogrel|aspirin|heparin|enoxaparin)/.test(medText), 12, 'Anticoagulant or antiplatelet medication mentioned', state);
  addScore(/(insulin|gliclazide|diamicro?n|glibenclamide)/.test(medText), 6, 'Diabetes medication mentioned', state);

  addScore(data.painScore !== null && data.painScore >= 8, 20, 'Severe pain score', state);
  addScore(data.painScore !== null && data.painScore >= 5 && data.painScore < 8, 8, 'Moderate pain score', state);

  if (data.isPostOp || has(POST_OP_TERMS)) {
    addScore(true, data.postOpDays !== null && data.postOpDays <= 14 ? 25 : 15, 'Post-operative or recent-procedure concern', state);
  }

  addScore(data.pregnancyPossible, 12, 'Pregnancy possibility requires clinical review', state);
  // A written temperature below 38.0 °C is not a fever ("fever 37.6" does not count).
  const feverInText = textReportsFever(clinicalText) || has(/\b(chills|rigors?)\b/i);
  addScore(feverInText && has(ERCP_TERMS), 35, 'Possible cholangitis pattern', state);
  addScore(has(/(vomiting|unable to keep fluids|dehydrated)/i), 15, 'Vomiting or possible dehydration', state);
  addScore(has(GI_BLEED_TERMS), 25, 'Possible gastrointestinal bleeding', state);

  // Composite vital + symptom checks (paediatric limits under 16).
  const v = data.vitalSigns;
  const hasFever = v.temperatureC !== null && v.temperatureC >= 38;
  const hasHypotension = v.systolicBp !== null && v.systolicBp < (limits?.sbpLow ?? 90);
  const hasTachycardia = v.heartRate !== null && (limits ? v.heartRate >= limits.hrHigh : v.heartRate > 120);

  addScore(has(CHEST_PAIN_TERMS) && (v.spo2 !== null && v.spo2 < 95), 50, 'Chest pain with hypoxia — possible ACS / PE', state);
  addScore(has(ERCP_TERMS) && hasFever, 35, 'Jaundice with fever — cholangitis pattern', state);
  addScore(has(GI_BLEED_TERMS) && (hasHypotension || hasTachycardia), 60, 'GI bleed with haemodynamic instability — emergency', state);
  addScore(has(DIABETIC_FOOT_TERMS) && hasFever, 40, 'Diabetic foot infection with systemic fever', state);
  addScore(has(POST_OP_TERMS) && hasFever && (data.postOpDays === null || data.postOpDays <= 30), 35, 'Post-op fever — source must be identified', state);

  // Breathlessness, NEWS2 and recognised emergencies set the level directly (the floor applied
  // after the score thresholds below). They add reasons but no points, so several priority
  // findings cannot add up to an "emergency" through the legacy score threshold.
  // Breathlessness is graded by physiology, not treated as a post-operative concern in every
  // context (clinical-validation acutemed decision 3): emergency when SpO₂ / RR / NEWS2 warrant.
  let breathlessLevel: EmergencyLevel | null = null;
  if (has(BREATHLESS_TERMS)) {
    const news2Total = emergency.news2?.total ?? null;
    const rrHigh = limits ? limits.rrHigh : 25;
    const severe = (v.spo2 !== null && v.spo2 < 92) || (v.respiratoryRate !== null && v.respiratoryRate >= rrHigh)
      || (news2Total !== null && news2Total >= 5);
    const abnormal = (v.spo2 !== null && v.spo2 <= 95) || (v.respiratoryRate !== null && v.respiratoryRate >= (limits ? limits.rrHigh - 5 : 21))
      || (v.heartRate !== null && (limits ? v.heartRate >= limits.hrHigh - 10 : v.heartRate > 110));
    const noObs = v.spo2 === null && v.respiratoryRate === null;
    if (severe) {
      breathlessLevel = 'emergency';
      addScore(true, 0, 'Breathlessness with abnormal physiology (SpO₂, respiratory rate or NEWS2)', state);
    } else if (abnormal || noObs || data.isPostOp || has(POST_OP_TERMS)) {
      breathlessLevel = 'urgent';
      addScore(true, 0, noObs ? 'Breathlessness — record SpO₂, respiratory rate and NEWS2 now' : 'Breathlessness — same-day clinical assessment', state);
    } else {
      breathlessLevel = 'priority';
      addScore(true, 0, 'Breathlessness with normal observations — clinical review', state);
    }
  }

  // NEWS2 bands (RCP 2017): high → emergency response; medium or a single red score → urgent.
  let news2Level: EmergencyLevel | null = null;
  if (emergency.news2) {
    const n = emergency.news2;
    if (n.band === 'high') news2Level = 'emergency';
    else if (n.band === 'medium' || n.band === 'low_medium') news2Level = 'urgent';
    if (news2Level) addScore(true, 0, `${n.summary} — ${news2Level === 'emergency' ? 'emergency' : 'urgent'} response`, state);
  }

  for (const e of emergency.emergencies) {
    addScore(true, 0,
      `${e.level === 'emergency' ? 'Recognised emergency' : e.level === 'urgent' ? 'Urgent' : 'Priority'}: ${e.title} (${e.reasons.join('; ')})`, state);
  }
  for (const f of emergency.safeguarding) {
    addScore(true, 0, `${f.title}: ${f.reasons.join('; ')} — follow the practice's safeguarding procedure`, state);
  }
  for (const m of emergency.riskModifiers) state.reasons.push(m.text);

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

  const activePathways = detectPathways(clinicalText, data.vitalSigns);
  const missingCriticalFields = buildMissingFields(data, combined);
  const questionsToAsk = buildQuestions(data, combined, missingCriticalFields);
  // "Magnet first step": flag patients whose complaint matches a known
  // surgical pathology as early as booking/check-in, with suggested codes.
  const surgicalMatches = matchSurgicalPathologies(clinicalText);
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
    // The NG12 rules added in cancer-screening 1.1.0 read the clinician's free text and the lab
    // values (positive FIT, iron-deficiency anaemia), so a lab-found FIT or IDA raises triage.
    freeText: joinClauses([data.freeText, input.diagnosis?.text ?? '']),
    labs: readCancerScreenLabs(input.investigationResults ?? {}),
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

  // Triage level = max(text rules, vital signs / NEWS2, blood pressure, critical labs, ECG,
  // confirmed diagnosis). This only ever raises the level; nothing here lowers it.
  let floor: EmergencyLevel | null = emergency.level;
  for (const l of [breathlessLevel, news2Level]) {
    if (l && (!floor || LEVEL_RANK[l] > LEVEL_RANK[floor])) floor = l;
  }
  if (floor === 'emergency') {
    acuity = 'urgent';
    recommendedAction = 'emergency_now';
  } else if (floor === 'urgent' && recommendedAction !== 'emergency_now') {
    acuity = 'priority';
    recommendedAction = 'same_day_call';
  } else if (floor === 'priority' && recommendedAction === 'routine_booking') {
    acuity = 'review';
    recommendedAction = 'priority_24_48h';
  }

  const redirectTitles = emergency.emergencies.filter(e => e.redirect).map(e => e.title);
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
      ? `${redirectTitles.length ? `Recognised emergency: ${redirectTitles.join('; ')}. ` : ''}Do not auto-book. ${EMERGENCY_REDIRECT} Alert clinical staff immediately; any first actions shown are suggestions for the clinician.`
      : 'Administrative triage aid only. Diagnosis and treatment decisions remain with Dr Kabiye or clinical staff.',
    frontDeskScript: buildFrontDeskScript(recommendedAction, questionsToAsk),
    suggestedBlocks,
    missingCriticalFields,
    surgicalMatches,
    isPrimarilySurgical,
    cancerScreen: cancerScreen.triggered ? cancerScreen : null,
    referralRecommendations,
    recognisedEmergencies: emergency.emergencies,
    safeguardingFlags: emergency.safeguarding,
    riskModifiers: emergency.riskModifiers,
    news2: emergency.news2,
    emergencyRedirect: recommendedAction === 'emergency_now' ? EMERGENCY_REDIRECT : null,
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
    return `Thank you for the message. Because of the symptoms mentioned, this needs urgent clinical attention and should not wait for routine booking. ${EMERGENCY_REDIRECT} I am alerting the clinical team now.${questionLine}`;
  }
  if (action === 'same_day_call') {
    return `Thank you. I will flag this for a same-day clinical call/review rather than routine booking.${questionLine}`;
  }
  if (action === 'priority_24_48h') {
    return `Thank you. I will mark this for priority review within 24–48 hours and collect a few details for Dr Kabiye.${questionLine}`;
  }
  return `Thank you. I can proceed with routine booking once the basic intake details are complete.${questionLine}`;
}
