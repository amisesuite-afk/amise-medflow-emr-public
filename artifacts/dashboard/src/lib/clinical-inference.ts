/**
 * Surgical clinical inference engine — derives safety prompts, investigation
 * cascades, screening, and follow-up actions from the full clinical picture:
 * demographics, CC, PMH, Fhx, social Hx, examination findings, lab results,
 * and imaging. All prompts require explicit surgeon confirmation.
 *
 * Rules reflect general & endoscopic surgery practice, Caribbean demographics.
 */

import {
  containsAffirmed, containsAnyAffirmed, assessEmergencies, paediatricVitalLimits, diagnosisHead,
  readPersonalRisk, EMERGENCY_REDIRECT, type EmergencyAssessment, type RecognisedEmergency,
} from '@workspace/triage-engine';
import { computePreventivePrompts } from './preventive-screening-prompts';
import { computeSupplementPrompts, type SupplementPrompt } from './supplement-prompts';
import { EMPTY_SUPPLEMENT_HISTORY, type SupplementHistory } from './supplement-catalogue';

interface CCEntry { complaint: string; answers: Record<string, string> }

export interface ClinicalAction {
  step: number;
  text: string;
  addToInvestigations?: string;
  addToPlan?: string;
}

export interface FollowUpSpec {
  label: string;
  daysFromNow: number;
  recurring?: boolean;
  recurringDays?: number;
}

export interface ClinicalPrompt {
  id: string;
  type: 'safety' | 'investigation' | 'preventative';
  urgency: 'urgent' | 'priority' | 'routine';
  icon: string;
  finding: string;
  diagnosis?: string;
  text: string;
  rationale: string;
  actions: ClinicalAction[];
  followUp?: FollowUpSpec;
}

export interface InferenceInput {
  age: string;
  sex: string;
  symptoms: string[];
  comorbidities: string[];
  familyHistory: string[];
  toxicHabits: string[];
  medications: string[];
  medicationsText: string;
  pregnancyPossible: boolean;
  ccEntries: CCEntry[];
  encounterType: string;
  examGeneral: string;
  examAbdomen: string;
  examBreast: string;
  examCardio: string;
  examResp: string;
  examNeuro: string;
  examExtremities: string;
  investigationResults: Record<string, string>;
  radiologyRequests: Array<{
    modality: string;
    anatomicalRegion: string;
    resultReceived: boolean;
    resultNotes: string;
    indication: string;
  }>;
  vitals?: Record<string, string>;
  assessment?: string;
  /**
   * Optional context for the recognise-and-redirect emergency layer (emergency-recognition.ts in
   * @workspace/triage-engine) and the peri-operative alerts. All optional so older callers work.
   */
  /** HPI / free-text history (the chief complaint entries are read already). */
  historyText?: string;
  surgicalHistory?: string[];
  allergies?: string[];
  /** ICD-10 codes of the working / confirmed diagnosis. */
  icdCodes?: string[];
  isPostOp?: boolean;
  postOpDays?: number | null;
  /** Other examination text (skin, wound, other) not covered by the named fields. */
  examOther?: string;
  /** "Herbs, teas, bush remedies & supplements" history (supplement-prompts.ts). */
  supplementHistory?: SupplementHistory;
}

// ── Pattern helpers ────────────────────────────────────────────────────────────
// Every free-text test is negation-aware (lib/triage-engine/src/negation.ts): "no guarding",
// "Murphy's sign negative", "afebrile", "not jaundiced", "no free gas", "Non-smoker" do not match.
// Terms keep substring semantics ("append" finds "appendicitis").

function lo(s: string): string { return s.toLowerCase(); }

/** Any item of `items` affirms any of `terms`. */
function anyAffirmed(items: string[], terms: string[]): boolean {
  return items.some(s => containsAnyAffirmed(s, terms));
}

function hasCc(entries: CCEntry[], ...terms: string[]): boolean {
  return anyAffirmed(entries.map(e => e.complaint), terms);
}
function hasSx(symptoms: string[], ...terms: string[]): boolean {
  return anyAffirmed(symptoms, terms);
}
function hasPmh(comorbidities: string[], ...terms: string[]): boolean {
  return anyAffirmed(comorbidities, terms);
}
function hasFhx(familyHistory: string[], ...terms: string[]): boolean {
  return anyAffirmed(familyHistory, terms);
}
function hasToxic(toxicHabits: string[], ...terms: string[]): boolean {
  return anyAffirmed(toxicHabits, terms);
}
function hasMed(medications: string[], medicationsText: string, ...terms: string[]): boolean {
  return anyAffirmed([...medications, medicationsText], terms);
}
function exam(s: string, ...terms: string[]): boolean {
  return containsAnyAffirmed(s, terms);
}
function hasRadResult(
  requests: InferenceInput['radiologyRequests'],
  ...terms: string[]
): boolean {
  return requests.some(r =>
    r.resultReceived &&
    (containsAnyAffirmed(r.resultNotes, terms) || containsAnyAffirmed(r.indication, terms))
  );
}

/**
 * A raised temperature written in the general examination: "temp 38.6", "temperature 39",
 * "raised temperature", "pyrexial". The bare word "temp"/"temperature" used to count as fever,
 * so "Temperature 36.8" raised the Charcot's-triad alarm. Fever threshold as elsewhere in this
 * file (≥ 38.0 °C, see hasFeverVital).
 */
function examRecordsRaisedTemperature(s: string): boolean {
  const lower = lo(s);
  const re = /\btemp(?:erature)?\b[^0-9.;,\n]{0,12}(\d{2}(?:\.\d+)?)/g;
  for (let m = re.exec(lower); m; m = re.exec(lower)) {
    if (parseFloat(m[1]) >= 38.0) return true;
  }
  return containsAffirmed(lower, /\b(?:raised|high|elevated|spiking)\s+temp(?:erature)?s?\b|\btemp(?:erature)?\s+(?:raised|high|elevated|spiking|spikes)\b/);
}

/** Parse first numeric value from a lab result string. Exported for the report-import tests. */
export function numLab(results: Record<string, string>, ...keyFragments: string[]): number | null {
  for (const [k, v] of Object.entries(results)) {
    const kl = lo(k);
    if (keyFragments.some(f => kl.includes(lo(f)))) {
      const match = v.match(/\d+\.?\d*/);
      if (match) {
        const n = parseFloat(match[0]);
        if (Number.isFinite(n)) return n;
      }
    }
  }
  return null;
}

/** Haemoglobin in g/dL (g/L converted), whole-word; HbA1c / glycated haemoglobin are not Hb. */
function haemoglobinGdl(results: Record<string, string>): number | null {
  for (const [k, v] of Object.entries(results)) {
    if (!/\b(haemoglobin|hemoglobin|hgb|hb)\b/i.test(k) || /a1c|glyc/i.test(k)) continue;
    const m = v.match(/\d+\.?\d*/);
    if (!m) continue;
    const n = parseFloat(m[0]);
    if (Number.isFinite(n)) return n > 25 ? n / 10 : n;
  }
  return null;
}

function hasLabKey(results: Record<string, string>, ...keyFragments: string[]): boolean {
  return Object.keys(results).some(k => keyFragments.some(f => lo(k).includes(lo(f))));
}

/** Parse a vital sign numeric value. Keys: systolicBp, diastolicBp, heartRate, temperatureC, respiratoryRate, spo2, glucoseMmol */
function numVital(vitals: Record<string, string> | undefined, key: string): number | null {
  if (!vitals) return null;
  const val = vitals[key] ?? '';
  if (!val.trim()) return null;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : null;
}

/** A recognised emergency (shared layer) as a safety prompt: alarm + first actions as suggestions. */
function emergencyPrompt(e: RecognisedEmergency): ClinicalPrompt {
  return {
    id: `emergency_${e.id}`,
    type: 'safety',
    urgency: e.level === 'priority' ? 'priority' : 'urgent',
    icon: e.level === 'emergency' ? '🚑' : '⚠️',
    finding: e.title,
    diagnosis: e.redirect ? 'Recognise and redirect — emergency department' : undefined,
    text: e.redirect ? `${e.title} → ${EMERGENCY_REDIRECT}` : e.title,
    rationale: `${e.reasons.join('; ')}. Source: ${e.guideline}. First actions are suggestions for the clinician; nothing is ordered automatically.`,
    actions: e.actions.map((a, i) => a.kind === 'investigation'
      ? { step: i + 1, text: a.text, addToInvestigations: a.text }
      : { step: i + 1, text: a.text, addToPlan: `• ${a.text}` }),
  };
}

/** A supplement alert / "ask about" prompt as a clinical prompt (every action needs a clinician tap). */
function supplementClinicalPrompt(sp: SupplementPrompt): ClinicalPrompt {
  const periop = sp.id.startsWith('periop_');
  const safety = periop || sp.id === 'not_asked' || sp.id === 'ashwagandha_avoid';
  const actions: ClinicalAction[] = periop
    ? [{ step: 1, text: 'Discuss with the patient; the clinician decides whether it is stopped (nothing is stopped automatically)', addToPlan: `• ${sp.detail} Clinician to confirm.` }]
    : sp.id === 'not_asked'
      ? [{ step: 1, text: 'Ask the question and record the answer under Medications → Herbs, teas, bush remedies & supplements' }]
      : sp.id === 'lead'
        ? [
            { step: 1, text: 'Ask about Ayurvedic (rasa shastra) preparations and turmeric products', addToPlan: '• Herbal / Ayurvedic product history taken (heavy-metal risk).' },
            { step: 2, text: 'Consider a blood lead level', addToInvestigations: 'Blood lead level' },
          ]
        : [{ step: 1, text: sp.title.split(' — ').pop() ?? sp.title, addToPlan: `• ${sp.title}: asked.` }];
  return {
    id: `supplement_${sp.id}`,
    type: safety ? 'safety' : 'investigation',
    urgency: sp.level === 'high' || sp.level === 'moderate' ? 'priority' : 'routine',
    icon: '🌿',
    finding: sp.title,
    text: sp.title,
    rationale: sp.detail,
    actions,
  };
}

const PAEDIATRIC_DOSE_NOTE ='weight-based dose — calculate per BNFc';

/**
 * Suspected PE: the two-level Wells score (NICE NG158, 2020; ESC 2019). Wells > 4 (PE likely) →
 * CTPA directly (interim anticoagulation if it is delayed); Wells ≤ 4 → D-dimer first, CTPA only
 * if it is positive. The DVT cut-off (≥ 2) and a D-dimer gate for a likely PE are not used.
 */
function PE_WELLS_ACTION(step: number): ClinicalAction {
  return {
    step,
    text: 'Suspected PE: two-level Wells score (NICE NG158) — > 4: CTPA directly; ≤ 4: D-dimer first',
    addToPlan: '• Suspected pulmonary embolism — two-level Wells score (NICE NG158): Wells > 4 (PE likely) → CTPA directly, with interim anticoagulation if CTPA is delayed; Wells ≤ 4 → D-dimer, and CTPA only if it is positive. D-dimer is unhelpful after recent surgery and in pregnancy.',
  };
}

/**
 * Under-16s never see an adult dose (owner-approved default, 2026-09-25; BNFc): a fixed dose or
 * volume in a prompt action ("Paracetamol 1g", "Hartmann's 1L bolus", "Pip-Tazo 4.5g",
 * "30ml/kg") is replaced by "weight-based dose — calculate per BNFc". No paediatric number is
 * invented. The emergency-layer prompts are age-aware already and are left unchanged.
 */
const DOSE_RE = /\b\d+(?:\.\d+)?\s?(?:[–-]\s?\d+(?:\.\d+)?\s?)?(?:mg|g|mcg|micrograms?|units?|ml|l)\b(?:\s?\/\s?(?:kg|h|hr|day|min)(?:\s?\/\s?(?:h|hr|day|min))?)?/gi;
function stripAdultDoses(text: string): string {
  let replaced = false;
  const out = text.replace(DOSE_RE, () => { replaced = true; return `[${PAEDIATRIC_DOSE_NOTE}]`; });
  return replaced ? out.replace(/(\[weight-based dose — calculate per BNFc\]\s*[+,/]?\s*)+(?=\[weight-based)/g, '') : text;
}

const PENICILLIN_RE = /\b(co-?amoxiclav|amoxiclav|amoxicillin|ampicillin|piperacillin|pip-?tazo|tazocin|flucloxacillin|benzylpenicillin|phenoxymethylpenicillin|penicillin)\b/gi;
const NSAID_RE = /\s*\+?\s*\b(ibuprofen|diclofenac|naproxen|ketorolac|parecoxib|celecoxib)\b[^.;\n•]*/gi;

// ── Main engine ────────────────────────────────────────────────────────────────

export function computeClinicalPrompts(input: InferenceInput): ClinicalPrompt[] {
  const {
    age, sex, symptoms, comorbidities, familyHistory, toxicHabits,
    medications, medicationsText, pregnancyPossible, ccEntries, encounterType,
    examGeneral, examAbdomen, examBreast, examExtremities,
    investigationResults, radiologyRequests,
    vitals, assessment,
  } = input;

  const ageNum = parseInt(age, 10);
  const hasAnyData = !isNaN(ageNum) || sex || symptoms.length > 0
    || comorbidities.length > 0 || ccEntries.length > 0
    || Object.keys(investigationResults).length > 0
    || examAbdomen || examGeneral;
  if (!hasAnyData) return [];

  const prompts: ClinicalPrompt[] = [];
  const add = (p: ClinicalPrompt) => { if (!prompts.some(x => x.id === p.id)) prompts.push(p); };

  const isReproductiveAgeFemale = sex === 'female' && ageNum >= 12 && ageNum <= 55;
  // Diabetes in THIS patient, by the preventive module's rule (readPersonalRisk().knownDiabetes,
  // lib/triage-engine/src/screening/preventive.ts): read from the structured past history only;
  // not "previous gestational diabetes", pre-diabetes, "screen for diabetes" or a relative's
  // diabetes (a risk factor is not a diagnosis — clinical-validation prevobspaed finding).
  // Entries naming a relative ("Mother type 2 diabetes") are left out first.
  const ownComorbidities = comorbidities.filter(c => !/\b(mother|father|sister|brother|parents?|grand\w*|aunt|uncle|cousin|relatives?)\b/i.test(c));
  const hasDiabetes = readPersonalRisk(ownComorbidities).knownDiabetes;
  const hasType1Diabetes = hasDiabetes && ownComorbidities.some(c => containsAnyAffirmed(c, ['type 1 diabetes', 'type 1 diabetic', 't1dm', 'insulin-dependent']));
  const isPreOp = encounterType === 'surgical_consult' || encounterType === 'major_emergency'
    || hasSx(symptoms, 'pre-operative') || hasCc(ccEntries, 'pre-op', 'pre-operative');
  const hasAbdominalCc = hasCc(ccEntries,
    'abdominal', 'appendic', 'pelvic', 'groin', 'bowel', 'cholecyst', 'pancreatit',
    'peritonit', 'hernia', 'obstruct',
  ) || hasSx(symptoms, 'abdominal pain', 'pelvic pain', 'vomiting');

  const hasJaundice = hasSx(symptoms, 'jaundice')
    || hasCc(ccEntries, 'jaundice', 'biliary', 'cholangitis', 'cholecystitis', 'cbd', 'hepat')
    || exam(examGeneral, 'jaundice', 'icteric');
  // Jaundice in THIS patient (sign, symptom or bilirubin ≥ 34 µmol/L) — hasJaundice above also
  // fires on a biliary complaint, which is too broad for SIGN 104 risk or NICE NG45 clotting tests.
  const bilirubinLab = numLab(investigationResults, 'bilirubin');
  const clinicalJaundice = hasSx(symptoms, 'jaundice') || exam(examGeneral, 'jaundice', 'jaundiced', 'icteric')
    || (bilirubinLab !== null && bilirubinLab >= 34);
  const hasRuqPain = hasCc(ccEntries, 'right upper', 'ruq', 'biliary', 'cholecyst')
    || hasSx(symptoms, 'right upper quadrant', 'ruq pain');
  const hasFever = hasSx(symptoms, 'fever', 'pyrexia')
    || exam(examGeneral, 'fever', 'pyrexia', 'febrile')
    || examRecordsRaisedTemperature(examGeneral);

  // ── RECOGNISE AND REDIRECT (shared emergency layer) ──────────────────────
  // Medical, obstetric, paediatric and neurological emergencies are recognised from the whole
  // record and shown as a safety prompt naming the emergency, its standard first actions (as
  // suggestions) and the 911 / emergency department redirect. Same engine as the triage level.
  const emergencyLayer: EmergencyAssessment = assessEmergencies({
    age: Number.isNaN(ageNum) ? null : ageNum,
    sex,
    historyText: [
      ...ccEntries.map(e => [e.complaint, ...Object.values(e.answers ?? {})].filter(Boolean).join('. ')),
      input.historyText ?? '', ...symptoms,
    ].filter(Boolean).join('.\n'),
    examText: [examGeneral, input.examCardio, input.examResp, examAbdomen, input.examNeuro, examExtremities, examBreast, input.examOther ?? '']
      .filter(Boolean).join('\n'),
    comorbidities, surgicalHistory: input.surgicalHistory ?? [], medications: [...medications, medicationsText].filter(Boolean),
    allergies: input.allergies ?? [],
    vitals: {
      systolicBp: numVital(vitals, 'systolicBp'), diastolicBp: numVital(vitals, 'diastolicBp'), heartRate: numVital(vitals, 'heartRate'),
      respiratoryRate: numVital(vitals, 'respiratoryRate'), temperatureC: numVital(vitals, 'temperatureC'), spo2: numVital(vitals, 'spo2'),
      glucoseMmol: numVital(vitals, 'glucoseMmol'),
      avpu: (['A', 'C', 'V', 'P', 'U'] as const).find(x => x === vitals?.avpu) ?? null,
      onSupplementalO2: vitals?.onSupplementalO2 === 'o2' ? true : vitals?.onSupplementalO2 === 'air' ? false : null,
    },
    investigationResults,
    resultReports: radiologyRequests.filter(r => r.resultReceived).map(r => `${r.modality} ${r.anatomicalRegion}: ${r.resultNotes}`),
    diagnosis: { text: assessment ?? '', icd10: input.icdCodes ?? [] },
    pregnancyPossible,
    isPostOp: input.isPostOp ?? false,
    postOpDays: input.postOpDays ?? null,
  });
  const paed = emergencyLayer.paediatric;
  const pregnant = emergencyLayer.pregnancy.pregnant;
  // Imaging choice: a recorded pregnancy (the "pregnancy possible" tick alone is a β-HCG question).
  const pregnancyForImaging = pregnant;
  const paedLimits = paediatricVitalLimits(emergencyLayer.ageYears);
  const recognised = (id: string) => emergencyLayer.emergencies.some(e => e.id === id);
  for (const e of emergencyLayer.emergencies) {
    if (e.id === 'confirmed_diagnosis') continue;
    add(emergencyPrompt(e));
  }
  for (const f of emergencyLayer.safeguarding) {
    add({
      id: `safeguarding_${f.id}`, type: 'safety', urgency: 'urgent', icon: '🛡️',
      finding: f.title,
      text: `${f.title} — follow the practice's safeguarding procedure`,
      rationale: `${f.reasons.join('; ')}. ${f.guideline}. The practice's local safeguarding contacts are held in its safeguarding procedure.`,
      actions: f.actions.map((a, i) => a.kind === 'investigation'
        ? { step: i + 1, text: a.text, addToInvestigations: a.text }
        : { step: i + 1, text: a.text, addToPlan: `• ${a.text}` }),
    });
  }
  // Working diagnosis (leading clause of the assessment) — operative templates follow it,
  // never the examination signs alone (clinical-validation findings: prevobspaed gap 5, hpb gap 1).
  const dxHead = diagnosisHead(assessment ?? '');
  const hfOrPeEarly = recognised('acute_heart_failure')
    || comorbidities.some(c => containsAnyAffirmed(c, ['heart failure', 'cardiac failure', 'reduced ejection', 'lvsd']));
  const dxSupports = (...terms: string[]) => containsAnyAffirmed(dxHead, terms);

  // ── EXAMINATION-TRIGGERED SAFETY PROMPTS ──────────────────────────────────

  // Charcot's triad: RUQ pain + fever + jaundice → Acute Cholangitis
  if (hasJaundice && hasFever && hasRuqPain) {
    add({
      id: 'charcots_triad',
      type: 'safety',
      urgency: 'urgent',
      icon: '🚨',
      finding: 'Charcot\'s triad (RUQ pain + fever + jaundice)',
      diagnosis: 'Acute Cholangitis',
      text: 'Charcot\'s Triad → Acute Cholangitis',
      rationale: 'RUQ pain + fever + jaundice meets Charcot\'s triad — acute cholangitis until proven otherwise. Mortality up to 30% without prompt biliary decompression.',
      actions: [
        { step: 1, text: 'IV access + resuscitation (1L Hartmann\'s)', addToPlan: '• IV access, fluid resuscitation — Hartmann\'s 1L.' },
        { step: 2, text: 'IV antibiotics: Piperacillin-tazobactam 4.5g TDS', addToPlan: '• IV Piperacillin-tazobactam 4.5g TDS — empirical cholangitis cover.' },
        { step: 3, text: 'Blood cultures × 2 before antibiotics', addToPlan: '• Blood cultures × 2 before first antibiotic dose.' },
        { step: 4, text: 'FBC, CRP, LFTs, amylase, PT/INR, U&E', addToInvestigations: 'Liver Function Tests (LFTs)' },
        { step: 5, text: 'USS RUQ — CBD diameter, stones, abscess', addToPlan: '• Urgent USS RUQ — CBD calibre and biliary anatomy.' },
        { step: 6, text: 'ERCP for biliary decompression if obstruction is confirmed (dilated duct / stone): within 24 h, urgent if severe (TG18; ACG 2024)', addToPlan: '• ERCP for biliary decompression if obstruction is confirmed on imaging (dilated duct / stone) — within 24 h, urgently if Tokyo Grade III (TG18; ACG 2024). Exclude hepatitis if the duct is not dilated.' },
        { step: 7, text: 'HDU/ICU admission — monitor for septic shock', addToPlan: '• HDU admission — hourly obs, urine output, early shock recognition.' },
      ],
      followUp: { label: 'Post-ERCP cholangitis review', daysFromNow: 7 },
    });
  }

  // Courvoisier's sign: painless jaundice + palpable gallbladder → HPB malignancy
  if (exam(examAbdomen, 'courvoisier', 'palpable gallbladder', 'gallbladder palpable')
    || (hasJaundice && exam(examAbdomen, 'palpable', 'gallbladder'))) {
    add({
      id: 'courvoisier_sign',
      type: 'safety',
      urgency: 'urgent',
      icon: '🔴',
      finding: 'Courvoisier\'s sign (palpable non-tender gallbladder + jaundice)',
      diagnosis: 'HPB malignancy — pancreatic / cholangiocarcinoma',
      text: 'Courvoisier\'s Sign → HPB Malignancy',
      rationale: 'Palpable non-tender gallbladder with obstructive jaundice — Courvoisier\'s law: malignant obstruction until proven otherwise (gallstone disease rarely distends a scarred gallbladder).',
      actions: [
        { step: 1, text: 'CA 19-9 + CEA + AFP', addToInvestigations: 'CA 19-9' },
        { step: 2, text: 'LFTs, PT/INR, albumin — hepatic synthetic function', addToInvestigations: 'Liver Function Tests (LFTs)' },
        { step: 3, text: 'CT abdomen/pelvis with pancreatic protocol (triple-phase)', addToPlan: '• Arrange CT abdomen/pelvis — pancreatic protocol (triple-phase contrast).' },
        { step: 4, text: 'MRCP — biliary anatomy and extent of obstruction', addToPlan: '• MRCP — biliary tree anatomy and level of obstruction.' },
        { step: 5, text: 'ERCP + biliary stenting if jaundice + pruritis severe', addToPlan: '• Discuss ERCP biliary stenting — jaundice palliation if indicated.' },
        { step: 6, text: 'Hepatopancreatobiliary (HPB) oncology referral', addToPlan: '• Refer HPB oncology — staging and multidisciplinary team discussion.' },
      ],
      followUp: { label: 'HPB oncology MDT result', daysFromNow: 7 },
    });
  }

  // Murphy's sign → Acute Cholecystitis
  if (exam(examAbdomen, 'murphy', "murphy's")) {
    add({
      id: 'murphys_sign',
      type: 'safety',
      urgency: 'priority',
      icon: '🫁',
      finding: 'Murphy\'s sign positive',
      diagnosis: 'Acute Cholecystitis',
      text: 'Murphy\'s Sign → Acute Cholecystitis',
      rationale: 'Inspiratory arrest on deep RUQ palpation — Murphy\'s sign with sensitivity ~65% for acute cholecystitis. Requires USS confirmation and surgical planning.',
      actions: [
        { step: 1, text: 'USS RUQ — gallbladder wall thickness, pericholecystic fluid, stones', addToPlan: '• USS RUQ — confirm cholecystitis (wall thickening, pericholecystic fluid).' },
        { step: 2, text: 'FBC, CRP, LFTs, amylase', addToInvestigations: 'Full Blood Count (FBC)' },
        { step: 3, text: 'IV antibiotics if Tokyo Grade II/III (fever, WBC > 18)', addToPlan: '• IV Co-amoxiclav 1.2g TDS if systemic inflammatory criteria met.' },
        { step: 4, text: 'NBM + IV fluids + analgesia', addToPlan: '• NBM, IV Hartmann\'s, regular analgesia (paracetamol + morphine PRN).' },
        // Operative steps follow the working diagnosis, never the sign alone.
        ...(dxSupports('cholecyst', 'gallstone', 'biliary colic', 'cholelith', 'gallbladder') ? [
          { step: 5, text: 'Laparoscopic cholecystectomy — early (within 72h) vs interval', addToPlan: '• Plan laparoscopic cholecystectomy — early (< 72h onset) or interval (≥ 6 weeks).' },
          { step: 6, text: 'Surgical consent', addToPlan: '• Obtain surgical consent — laparoscopic cholecystectomy risks/alternatives.' },
        ] : [
          { step: 5, text: 'Confirm the diagnosis before any operative plan (USS; exclude hepatitis, pneumonia, pre-eclampsia/HELLP, ACS)', addToPlan: '• Confirm the diagnosis (USS) before any operative plan — Murphy\'s sign alone is not a surgical indication.' },
        ]),
      ],
      followUp: { label: 'Post-cholecystectomy follow-up', daysFromNow: 14 },
    });
  }

  // McBurney's / Rebound / Rovsing → Appendicitis
  // Gate generic guarding/rebound on appendicitis-specific diagnosis or CC to avoid
  // triggering Alvarado score for cholecystitis, pancreatitis, etc.
  const assessmentHasAppend = containsAffirmed(assessment ?? '', 'append');
  const ccIsAppend = hasCc(ccEntries, 'append', 'right iliac', 'rlq');
  if (exam(examAbdomen, 'mcburney', 'rovsing', 'psoas sign', 'obturator sign')
    || (exam(examAbdomen, 'rebound', 'guarding') && hasAbdominalCc && (assessmentHasAppend || ccIsAppend))) {
    add({
      id: 'appendicitis_signs',
      type: 'safety',
      urgency: 'urgent',
      icon: '🔥',
      finding: 'Peritoneal signs (McBurney\'s / Rebound / Rovsing)',
      diagnosis: 'Acute Appendicitis',
      text: 'Appendiceal Signs → Acute Appendicitis',
      rationale: 'Classic peritoneal signs in right iliac fossa — acute appendicitis until proven otherwise. Alvarado score guides imaging vs direct theatre.',
      actions: [
        { step: 1, text: 'Calculate Alvarado score', addToPlan: '• Calculate Alvarado score (document: migratory pain, anorexia, nausea, RIF tenderness, rebound, elevated temp, leucocytosis, left shift).' },
        { step: 2, text: 'FBC, CRP, U&E — leucocytosis + CRP elevation', addToInvestigations: 'Full Blood Count (FBC)' },
        // Children and pregnancy: ultrasound first; CT (child) or MRI (pregnancy) only if the
        // ultrasound is inconclusive (WSES 2020; RCR iRefer; ACR Appropriateness Criteria 2018).
        paed
          ? { step: 3, text: 'Child: ultrasound first; CT only if ultrasound is inconclusive and the diagnosis is still uncertain (WSES 2020)', addToPlan: '• Child: ultrasound of the appendix first; CT only if ultrasound is inconclusive and the diagnosis is still uncertain (WSES 2020; RCR iRefer).' }
          : pregnancyForImaging
            ? { step: 3, text: 'Pregnancy: ultrasound first; MRI if ultrasound is inconclusive (WSES 2020; ACR 2018)', addToPlan: '• Pregnancy: ultrasound first; MRI (not CT) if ultrasound is inconclusive (WSES 2020; ACR 2018).' }
            : { step: 3, text: 'CT abdomen/pelvis (if Alvarado 5–6 or atypical; skip if ≥ 7 + classic presentation)', addToPlan: '• CT abdomen/pelvis if the diagnosis is uncertain (Alvarado 5–6 or atypical) — appendix calibre, perforation, appendicolith.' },
        { step: 4, text: 'β-HCG if female of reproductive age (exclude ectopic)', addToInvestigations: isReproductiveAgeFemale ? 'Urine Pregnancy Test (F)' : undefined },
        { step: 5, text: 'NBM + IV access + analgesia + antibiotics', addToPlan: '• NBM, IV access, morphine PRN, IV Piperacillin-tazobactam 4.5g.' },
        ...(dxSupports('append') ? [
          { step: 6, text: 'Emergency laparoscopic appendicectomy — consent and theatre', addToPlan: '• Emergency laparoscopic appendicectomy — consent obtained, theatre booked.' },
        ] : [
          { step: 6, text: 'Operative decision only once appendicitis is the working diagnosis (imaging / senior review)', addToPlan: '• Senior surgical review — operative decision only once appendicitis is the working diagnosis.' },
        ]),
      ],
      followUp: { label: 'Post-appendicectomy wound review', daysFromNow: 14 },
    });
  }

  // Generalised guarding / Rigidity / Board-like → Perforated viscus
  if (exam(examAbdomen, 'generalised guarding', 'board', 'rigid', 'peritonism', 'generalised tenderness')
    && !exam(examAbdomen, 'murphy', 'mcburney')) {
    add({
      id: 'peritonism',
      type: 'safety',
      urgency: 'urgent',
      icon: '⚠️',
      finding: 'Generalised peritonism (guarding / rigidity)',
      diagnosis: 'Perforated viscus / Generalised Peritonitis',
      text: 'Peritonism → Perforated Viscus / Peritonitis',
      rationale: 'Generalised guarding and rigidity indicates peritoneal irritation — perforated viscus until proven otherwise. Surgical emergency requiring immediate escalation.',
      actions: [
        { step: 1, text: 'Erect CXR — free subdiaphragmatic air', addToPlan: '• Erect CXR — free air under diaphragm (pneumoperitoneum).' },
        { step: 2, text: 'IV access (2 large-bore), resuscitation, urinary catheter', addToPlan: '• 2 large-bore IV cannulae, Hartmann\'s 1L bolus, urinary catheter + fluid balance.' },
        { step: 3, text: 'FBC, CRP, amylase, U&E, lactate, Group & Screen', addToInvestigations: 'Blood Group & Type' },
        { step: 4, text: 'IV Piperacillin-tazobactam + Metronidazole', addToPlan: '• IV Piperacillin-tazobactam 4.5g TDS + Metronidazole 500mg TDS.' },
        { step: 5, text: 'CT abdomen/pelvis if haemodynamically stable', addToPlan: '• CT abdomen/pelvis — source of perforation, free fluid volume, staging.' },
        { step: 6, text: 'Senior surgical decision on source control — emergency laparotomy if generalised peritonitis or perforation is confirmed', addToPlan: '• Senior surgical review now — emergency laparotomy if generalised peritonitis or perforation is confirmed (source control; ICU post-operatively). Exclude medical causes of peritonism-like pain (DKA, pneumonia, MI).' },
      ],
      followUp: { label: 'ICU/HDU post-laparotomy review', daysFromNow: 2 },
    });
  }

  // Breast lump → Triple assessment
  if (exam(examBreast, 'lump', 'mass', 'thickening', 'nodule', 'hard', 'irregular')
    || hasCc(ccEntries, 'breast lump', 'breast mass', 'lump in breast', 'lump in the breast')
    || hasSx(symptoms, 'breast lump', 'breast mass')
    || containsAnyAffirmed(input.historyText ?? '', [/\b(breast (lump|mass)|lump in (the |her |my )?(left |right )?breast)\b/])) {
    add({
      id: 'breast_lump',
      type: 'safety',
      urgency: 'priority',
      icon: '🎗️',
      finding: 'Breast lump / mass on examination',
      diagnosis: 'Breast mass — triple assessment required',
      text: 'Breast Mass → Triple Assessment',
      rationale: 'Any discrete breast lump requires triple assessment (clinical + imaging + histology) to exclude malignancy. NICE NG12: 2-week wait pathway if suspicious features.',
      actions: [
        { step: 1, text: 'USS breast (all ages) — cystic vs solid, BI-RADS', addToInvestigations: 'USS breast — BI-RADS classification, cystic vs solid' },
        !isNaN(ageNum) && ageNum >= 35
          ? { step: 2, text: 'Mammogram (age ≥ 35) — microcalcifications, spiculation', addToPlan: '• Bilateral mammogram — screen for synchronous disease and microcalcifications.' }
          : { step: 2, text: 'MRI breast if young + dense tissue / high-risk', addToPlan: '• Consider MRI breast if dense glandular tissue or BRCA status.' },
        { step: 3, text: 'Core needle biopsy (CNB) — histological diagnosis', addToInvestigations: 'Core needle biopsy (US-guided) — histology, ER/PR/HER2 if malignant' },
        { step: 4, text: 'Breast oncology referral', addToPlan: '• Refer breast oncology — 2-week wait pathway if clinically suspicious.' },
        { step: 5, text: 'Document family history — BRCA1/2 screening if relevant', addToPlan: '• Document family history of breast/ovarian cancer — BRCA risk assessment.' },
      ].filter(Boolean) as ClinicalAction[],
      followUp: { label: 'Biopsy result review', daysFromNow: 7 },
    });
  }

  // Testicular torsion (exam extremities or symptoms)
  if (exam(examExtremities, 'testicular', 'scrotal', 'testes')
    || (hasSx(symptoms, 'testicular pain', 'scrotal pain', 'scrotal swelling') && sex === 'male')) {
    add({
      id: 'testicular_torsion',
      type: 'safety',
      urgency: 'urgent',
      icon: '🚑',
      finding: 'Testicular / scrotal signs',
      diagnosis: 'Testicular Torsion until proven otherwise',
      text: 'Scrotal Findings → Testicular Torsion',
      rationale: 'Acute testicular pain — torsion until proven otherwise. Six-hour window for viable salvage. Do NOT delay for Doppler USS if clinical presentation is typical.',
      actions: [
        { step: 1, text: '⚠️ DO NOT delay for imaging if high clinical suspicion', addToPlan: '• Clinical diagnosis: do NOT delay exploration for imaging if torsion likely.' },
        { step: 2, text: 'Doppler USS scrotum only if diagnosis genuinely uncertain', addToPlan: '• Doppler USS scrotum — absent flow confirms torsion (use only if diagnosis uncertain).' },
        { step: 3, text: 'Emergency scrotal exploration if torsion cannot be excluded + de-torsion + fixation', addToPlan: '• Emergency scrotal exploration if torsion cannot be excluded — de-torsion, assess viability, bilateral fixation (orchidopexy) (EAU 2024).' },
        { step: 4, text: 'Consent — risk of orchidectomy if non-viable testis', addToPlan: '• Surgical consent includes risk of orchidectomy (non-viable testis).' },
      ],
      followUp: { label: 'Post-orchidopexy review', daysFromNow: 14 },
    });
  }

  // Rectal mass on PR exam
  if (exam(examAbdomen, 'rectal mass', 'pr mass', 'hard mass pr', 'rectal tumour', 'rectal lesion')) {
    add({
      id: 'rectal_mass',
      type: 'safety',
      urgency: 'priority',
      icon: '🔭',
      finding: 'Rectal mass on PR examination',
      diagnosis: 'Colorectal malignancy until proven otherwise',
      text: 'Rectal Mass → CRC Workup',
      rationale: 'Hard rectal mass on PR examination — colorectal malignancy until proven otherwise. NICE 2-week wait criteria met.',
      actions: [
        { step: 1, text: 'CEA + CA 19-9', addToInvestigations: 'CEA' },
        { step: 2, text: 'FBC + iron studies', addToInvestigations: 'Full Blood Count (FBC)' },
        { step: 3, text: 'Colonoscopy + biopsy', addToPlan: '• Urgent colonoscopy + biopsy — 2-week wait pathway.' },
        { step: 4, text: 'MRI pelvis — T staging', addToPlan: '• MRI pelvis — rectal tumour T/N staging.' },
        { step: 5, text: 'CT chest/abdomen/pelvis — M staging', addToPlan: '• CT chest/abdomen/pelvis — distant metastasis staging.' },
        { step: 6, text: 'Colorectal oncology MDT referral', addToPlan: '• Refer colorectal oncology MDT.' },
      ],
      followUp: { label: 'Colonoscopy + MDT result', daysFromNow: 14 },
    });
  }

  // Thyroid nodule / neck lump
  if (exam(examGeneral, 'thyroid nodule', 'thyroid lump', 'neck lump', 'neck mass', 'goitre')
    || hasCc(ccEntries, 'thyroid', 'neck lump', 'neck mass')) {
    add({
      id: 'thyroid_nodule',
      type: 'safety',
      urgency: 'priority',
      icon: '🦋',
      finding: 'Thyroid nodule / neck mass',
      diagnosis: 'Thyroid neoplasm — requires USS + FNAC',
      text: 'Thyroid Nodule → USS + FNAC',
      rationale: 'Thyroid nodule requires USS characterisation (TIRADS) and cytology if sonographically suspicious (TIRADS ≥ 3, size ≥ 1cm).',
      actions: [
        { step: 1, text: 'TFTs (TSH, free T4) — functional status', addToInvestigations: 'Thyroid Function Tests (TFTs)' },
        { step: 2, text: 'USS neck — TIRADS classification, nodule characterisation', addToPlan: '• USS neck — TIRADS score, nodule vascularity, lymphadenopathy.' },
        { step: 3, text: 'FNAC (USS-guided) if TIRADS ≥ 3 or size ≥ 1cm', addToPlan: '• FNAC USS-guided — Bethesda classification.' },
        { step: 4, text: 'Calcium + vitamin D (pre-op if surgery planned)', addToInvestigations: 'Calcium (corrected)' },
        { step: 5, text: 'Endocrine surgery referral if Bethesda III–VI', addToPlan: '• Refer endocrine surgery if Bethesda III or above.' },
      ],
      followUp: { label: 'FNAC Bethesda result', daysFromNow: 7 },
    });
  }

  // ── SAFETY — Symptom / CC driven ──────────────────────────────────────────

  // β-HCG: reproductive-age female with abdominal/pelvic complaint
  // Not when the pregnancy (or a delivery in the last 6 weeks) is already recorded.
  const knownPregnancyOrPostpartum = pregnant || (emergencyLayer.pregnancy.postpartumWeeks !== null && emergencyLayer.pregnancy.postpartumWeeks <= 6);
  if (isReproductiveAgeFemale && (pregnancyPossible || hasAbdominalCc) && !knownPregnancyOrPostpartum) {
    add({
      id: 'bhcg_safety',
      type: 'safety',
      urgency: 'urgent',
      icon: '🤰',
      finding: 'Reproductive-age female with abdominal complaint',
      text: 'Urine Pregnancy Test (β-HCG) — mandatory',
      rationale: `Reproductive-age female (${ageNum}y) — β-HCG must be excluded before surgery, CT, opioid prescribing, or diagnostic laparoscopy. Ectopic pregnancy is a surgical emergency.`,
      actions: [
        { step: 1, text: 'Urine β-HCG before any intervention', addToInvestigations: 'Urine Pregnancy Test (F)' },
        { step: 2, text: 'If positive → serum β-HCG + USS pelvis (transvaginal)', addToPlan: '• If urine β-HCG positive: serum quantitative β-HCG + urgent TVS — exclude ectopic.' },
        { step: 3, text: 'If ectopic suspected → emergency gynaecology referral', addToPlan: '• If ectopic suspected: emergency gynaecology referral — surgical or medical management.' },
      ],
    });
  }

  // Acute abdomen workup
  if (hasAbdominalCc) {
    add({
      id: 'acute_abdomen_panel',
      type: 'safety',
      urgency: 'priority',
      icon: '🧪',
      finding: 'Acute abdominal presentation',
      text: 'Acute abdomen panel: FBC, CRP, amylase, U&E',
      rationale: 'Abdominal pain — FBC for leucocytosis, CRP for systemic inflammation, amylase for pancreatitis, U&E for electrolyte and renal status.',
      actions: [
        { step: 1, text: 'FBC + CRP', addToInvestigations: 'Full Blood Count (FBC)' },
        { step: 2, text: 'Amylase / lipase', addToInvestigations: 'Amylase' },
        { step: 3, text: 'U&E + creatinine', addToInvestigations: 'Urea & Electrolytes (U&E)' },
        { step: 4, text: 'Erect CXR — free air, pneumonia base', addToPlan: '• Erect CXR — exclude free air and basal pneumonia.' },
      ],
    });
  }

  // Jaundice
  if (hasJaundice) {
    add({
      id: 'jaundice_panel',
      type: 'safety',
      urgency: 'priority',
      icon: '🟡',
      finding: 'Jaundice',
      text: 'Jaundice panel: LFTs, bilirubin, GGT, ALP, PT/INR, hepatitis serology',
      rationale: 'LFT pattern distinguishes obstructive (high ALP/GGT, normal ALT) from hepatocellular (high ALT/AST). PT/INR assesses hepatic synthetic function. Viral serology identifies infective aetiology.',
      actions: [
        { step: 1, text: 'LFTs — ALT, AST, ALP, GGT, direct + total bilirubin', addToInvestigations: 'Liver Function Tests (LFTs)' },
        { step: 2, text: 'PT/INR + albumin', addToInvestigations: 'Prothrombin Time (PT/INR)' },
        { step: 3, text: 'Hepatitis B surface antigen + Hepatitis C antibody', addToInvestigations: 'Hepatitis B Surface Antigen' },
        { step: 4, text: 'USS abdomen — biliary dilation, gallstones, hepatic lesion', addToPlan: '• USS abdomen — biliary tree, gallstones, hepatic parenchyma.' },
      ],
    });
  }

  // GI bleed — resuscitation, cross-match and transfusion only when the bleed is haemodynamically
  // significant (BSG 2019 acute LGIB: shock index > 1 = unstable; NICE CG141; restrictive
  // transfusion Hb 70 g/L, 80 g/L with cardiovascular disease). A stable bleed is risk-stratified
  // (Oakland / Glasgow-Blatchford) first — a young patient with a fissure or haemorrhoidal bleeding
  // and a normal Hb does not need 2 large-bore cannulae and 2 units cross-matched.
  if (hasSx(symptoms, 'rectal bleeding', 'black stool', 'haematemesis', 'melaena')
    || hasCc(ccEntries, 'bleeding', 'haematemesis', 'rectal bleed', 'melaena', 'haematochezia')) {
    const giSbp = numVital(vitals, 'systolicBp');
    const giHr = numVital(vitals, 'heartRate');
    const giHbGdl = haemoglobinGdl(investigationResults);
    const giUnstable = (giSbp !== null && giSbp < 90)
      || (giSbp !== null && giHr !== null && giHr / Math.max(giSbp, 1) > 1)
      || (giHbGdl !== null && giHbGdl < 8)
      || containsAnyAffirmed([input.historyText ?? '', ...ccEntries.map(e => e.complaint)].join('\n'), ['collapse', 'syncope', 'fainted', 'massive', 'large volume', 'passing clots', 'heavy bleeding']);
    const lowerGi = hasSx(symptoms, 'rectal bleeding') || hasCc(ccEntries, 'rectal bleed', 'haematochezia', 'lower gi bleed');
    add({
      id: 'gi_bleed_panel',
      type: 'safety',
      urgency: giUnstable ? 'urgent' : 'priority',
      icon: '🩸',
      finding: giUnstable ? 'GI haemorrhage — haemodynamically significant' : 'GI bleeding — haemodynamically stable',
      text: giUnstable ? 'GI bleed resuscitation: FBC, Group & Screen, PT/INR, APTT, U&E' : 'GI bleeding: risk-stratify (Oakland / Glasgow-Blatchford); FBC, Group & Screen, U&E',
      rationale: giUnstable
        ? 'Haemodynamically significant GI bleeding (shock index > 1, SBP < 90, Hb < 80 g/L or a large-volume bleed): resuscitate, cross-match, restrictive transfusion (BSG 2019; NICE CG141).'
        : 'Stable GI bleeding: risk-stratify before deciding on admission — Oakland score for lower GI bleeding (≤ 8: outpatient investigation), Glasgow-Blatchford for upper GI bleeding (0–1: outpatient management) (BSG 2019; NICE CG141).',
      actions: [
        giUnstable
          ? { step: 1, text: 'IV access (2 × large-bore) + resuscitation', addToPlan: '• Haemodynamically significant bleed: 2 × large-bore IV cannulae, crystalloid resuscitation, crossmatch; restrictive red-cell transfusion — threshold Hb 70 g/L (80 g/L with cardiovascular disease) (BSG 2019; NICE CG141).' }
          : { step: 1, text: 'Haemodynamically stable: IV access and bloods; risk-stratify before admission', addToPlan: lowerGi
              ? '• Haemodynamically stable lower GI bleeding: Oakland score — ≤ 8 with no other indication for admission: discharge for outpatient investigation; > 8: admit, colonoscopy on the next available list (BSG 2019).'
              : '• Haemodynamically stable upper GI bleeding: Glasgow-Blatchford score — 0–1: outpatient management and endoscopy; higher: admit, endoscopy within 24 h (NICE CG141; ESGE 2021).' },
        { step: 2, text: giUnstable ? 'FBC + Group & Screen / Crossmatch' : 'FBC + Group & Screen', addToInvestigations: 'Blood Group & Type' },
        { step: 3, text: 'PT/INR + APTT', addToInvestigations: 'Prothrombin Time (PT/INR)' },
        { step: 4, text: 'U&E + creatinine (BUN:Cr ratio for upper vs lower GI)', addToInvestigations: 'Urea & Electrolytes (U&E)' },
        ...(giUnstable ? [{ step: 5, text: 'Gastroscopy (upper GI) or colonoscopy (lower GI) — timing by stability', addToPlan: '• Urgent OGD / colonoscopy — within 24h of haemodynamic stabilisation.' }] : []),
        ...(hasMed(medications, medicationsText, 'warfarin', 'rivaroxaban', 'apixaban', 'dabigatran', 'edoxaban')
          ? [{ step: 6, text: 'Anticoagulant recorded: withhold and reverse by drug with haematology (see the anticoagulation prompt)', addToPlan: '• Anticoagulant recorded: withhold and reverse by drug with haematology — warfarin: IV vitamin K + 4-factor PCC; dabigatran: idarucizumab; factor Xa inhibitor: andexanet alfa or PCC (ACC 2020 ECDP).' }]
          : []),
        // Unstable lower GI bleeding: CT angiography first (BSG 2019 acute LGIB guideline).
        ...(((numVital(vitals, 'systolicBp') ?? 999) < 90 || ((numVital(vitals, 'heartRate') ?? 0) / Math.max(numVital(vitals, 'systolicBp') ?? 999, 1)) > 1)
          && (hasSx(symptoms, 'rectal bleeding') || hasCc(ccEntries, 'rectal bleed', 'haematochezia', 'lower gi bleed') || containsAnyAffirmed(input.historyText ?? '', ['rectal bleeding', 'haematochezia', 'fresh blood per rectum', 'passing blood']))
          ? [{ step: 7, text: 'Haemodynamically unstable lower GI bleeding (shock index > 1): CT angiography first (BSG 2019)', addToInvestigations: 'CT angiography (mesenteric) — unstable lower GI bleed, before endoscopy (BSG 2019)' }]
          : []),
      ],
      followUp: { label: 'Post-haemorrhage GI review', daysFromNow: 14 },
    });
  }

  // Rectal bleeding ≥ 50 → urgent colonoscopy
  if (!isNaN(ageNum) && ageNum >= 50
    && (hasSx(symptoms, 'rectal bleeding') || hasCc(ccEntries, 'rectal bleed', 'haematochezia', 'lower gi bleed'))) {
    add({
      id: 'colonoscopy_urgent',
      type: 'safety',
      urgency: 'priority',
      icon: '🔭',
      finding: 'Rectal bleeding, age ≥ 50',
      diagnosis: 'Colorectal malignancy (red flag)',
      text: 'Urgent colonoscopy — rectal bleeding ≥ age 50',
      rationale: `Age ${ageNum} + rectal bleeding = NICE DG56 2-week wait red flag criterion. Must exclude colorectal carcinoma.`,
      actions: [
        { step: 1, text: 'FBC + iron studies (anaemia screen)', addToInvestigations: 'Full Blood Count (FBC)' },
        { step: 2, text: 'CEA baseline', addToInvestigations: 'CEA' },
        { step: 3, text: 'Urgent colonoscopy — 2-week wait pathway', addToPlan: '• Urgent colonoscopy — 2-week wait, rectal bleeding age ≥ 50.' },
        { step: 4, text: 'PR examination under anaesthesia if rigid scope positive', addToPlan: '• PR / proctoscopy in clinic — haemorrhoids vs rectal pathology.' },
      ],
      followUp: { label: 'Colonoscopy result review', daysFromNow: 14, recurring: false },
    });
  }

  // Unintentional weight loss → cancer screen
  if (hasSx(symptoms, 'weight loss') || hasCc(ccEntries, 'weight loss')) {
    add({
      id: 'weight_loss_screen',
      type: 'safety',
      urgency: 'priority',
      icon: '⚖️',
      finding: 'Unintentional weight loss (alarm symptom)',
      text: 'Alarm symptom panel: FBC, ESR, CRP, LFTs, TFTs, CEA, CA 19-9',
      rationale: 'Unintentional weight loss is an alarm symptom requiring systemic cancer and inflammatory disease exclusion.',
      actions: [
        { step: 1, text: 'FBC + ESR + CRP', addToInvestigations: 'Full Blood Count (FBC)' },
        { step: 2, text: 'LFTs + TFTs', addToInvestigations: 'Thyroid Function Tests (TFTs)' },
        { step: 3, text: 'CEA + CA 19-9 + AFP', addToInvestigations: 'CEA' },
        // Pregnancy: no ionising "occult malignancy" imaging without a specific clinical question;
        // ultrasound first, MRI if needed (ACOG Committee Opinion 723, 2017).
        pregnancyForImaging
          ? { step: 4, text: 'Pregnancy recorded: no CT screen for occult malignancy — ultrasound first, MRI for a specific question (ACOG CO 723)', addToPlan: '• Pregnancy: imaging for weight loss only for a specific clinical question — ultrasound first, MRI if needed; no ionising occult-malignancy screen (ACOG CO 723, 2017). Weight loss with vomiting in pregnancy: consider hyperemesis gravidarum.' }
          : { step: 4, text: 'CT chest/abdomen/pelvis — occult malignancy screen', addToPlan: '• CT chest/abdomen/pelvis — occult malignancy screen (alarm symptoms).' },
        { step: 5, text: 'Upper GI endoscopy if dysphagia / epigastric pain', addToPlan: '• Upper GI endoscopy if dysphagia or epigastric symptoms present.' },
      ],
    });
  }

  // Pre-operative standard workup. Haemostasis tests are not routine before elective surgery (NICE
  // NG45): only with chronic liver disease, a vitamin K antagonist or heparin to be managed, a known
  // bleeding disorder, jaundice, or an emergency operation. A DOAC with standard interruption needs
  // no coagulation test (PAUSE; ACCP 2022).
  const coagIndicated = encounterType === 'major_emergency'
    || hasPmh(comorbidities, 'cirrhosis', 'liver disease', 'hepatic', 'haemophilia', 'hemophilia', 'von willebrand', 'bleeding disorder', 'coagulopathy', 'thrombocytopenia')
    || hasMed(medications, medicationsText, 'warfarin', 'acenocoumarol', 'phenindione', 'heparin')
    || clinicalJaundice;
  if (isPreOp) {
    add({
      id: 'preop_haem',
      type: 'safety',
      urgency: 'priority',
      icon: '⚕️',
      finding: 'Pre-operative assessment',
      text: coagIndicated ? 'Pre-op bloods: FBC, PT/INR, APTT, Group & Screen' : 'Pre-op bloods: FBC, Group & Screen, U&E (no routine clotting screen — NICE NG45)',
      rationale: coagIndicated
        ? 'Pre-operative haematological screen; haemostasis tests because of liver disease, a vitamin K antagonist / heparin, a bleeding disorder, jaundice or an emergency operation (NICE NG45).'
        : 'Pre-operative haematological screen. Haemostasis tests are not offered routinely before elective surgery without liver disease, anticoagulant management or a bleeding disorder (NICE NG45).',
      actions: [
        { step: 1, text: 'FBC', addToInvestigations: 'Full Blood Count (FBC)' },
        ...(coagIndicated ? [{ step: 2, text: 'PT/INR + APTT', addToInvestigations: 'Prothrombin Time (PT/INR)' }] : []),
        { step: 3, text: 'Group & Screen', addToInvestigations: 'Blood Group & Type' },
        { step: 4, text: 'U&E + creatinine', addToInvestigations: 'Urea & Electrolytes (U&E)' },
        !isNaN(ageNum) && ageNum >= 40
          ? { step: 5, text: '12-lead ECG (age ≥ 40)', addToPlan: '• 12-lead ECG — pre-operative cardiac baseline (age ≥ 40).' }
          : null,
        hasDiabetes
          ? { step: 6, text: 'HbA1c (diabetic patient — target < 8.5% pre-op)', addToInvestigations: 'HbA1c' }
          : null,
      ].filter(Boolean) as ClinicalAction[],
    });
  }

  // Anticoagulants — one template for everyone was wrong for most patients (clinical-validation
  // periop gap 1). Active bleeding → withhold and reverse (no bridging); otherwise a
  // procedure-specific plan: BSG/ESGE 2021 (endoscopy), ACCP 2022 / BRIDGE (no routine bridging
  // for AF), PAUSE (DOAC interruption by drug and renal function).
  const anticoagNames = ['warfarin', 'rivaroxaban', 'apixaban', 'dabigatran', 'enoxaparin', 'heparin', 'fondaparinux', 'edoxaban'];
  const onAnticoag = hasMed(medications, medicationsText, ...anticoagNames);
  const historyAll = [input.historyText ?? '', ...ccEntries.map(e => e.complaint), ...symptoms].join('.\n');
  // Active haemorrhage (not the chronic rectal bleeding of a known cancer): acute bleeding words,
  // bleeding with haemodynamic compromise, or a bleeding working diagnosis.
  const sbpNow = numVital(vitals, 'systolicBp');
  const hrNow = numVital(vitals, 'heartRate');
  const activeBleeding = containsAnyAffirmed(historyAll, ['haematemesis', 'hematemesis', 'melaena', 'melena', 'vomiting blood', 'haemoperitoneum', 'active bleeding', 'heavy bleeding', 'massive bleeding', 'black stool', 'passing clots'])
    || (containsAnyAffirmed(historyAll, ['bleeding', 'haemorrhage', 'hemorrhage', 'fresh blood']) && ((sbpNow !== null && sbpNow < 100) || (hrNow !== null && hrNow > 100)))
    || containsAnyAffirmed(dxHead, ['bleed', 'haemorrhag', 'hemorrhag', 'haemoperitoneum', 'haematoma', 'haemothorax', 'hemothorax'])
    || hasRadResult(radiologyRequests, 'haemoperitoneum', 'active extravasation', 'intracranial haemorrhage', 'subdural');
  if (onAnticoag) {
    const drug = anticoagNames.find(d => hasMed(medications, medicationsText, d)) ?? 'anticoagulant';
    const warfarin = drug === 'warfarin';
    const doac = ['rivaroxaban', 'apixaban', 'dabigatran', 'edoxaban'].includes(drug);
    const mechanicalValve = hasPmh([...comorbidities, ...(input.surgicalHistory ?? [])], 'mechanical valve', 'mechanical mitral', 'mechanical aortic', 'mechanical heart valve', 'metallic valve');
    // An injury on an anticoagulant (fall, head injury, fracture) is not an elective peri-procedural
    // question: imaging and reversal readiness, not interruption intervals or bridging
    // (NICE NG232 2023; ACC 2020 ECDP).
    const injuryOnAnticoag = !activeBleeding && containsAnyAffirmed([historyAll, dxHead].join('\n'), [
      'head injury', 'hit her head', 'hit his head', 'hit my head', 'hit head', 'hit her forehead', 'hit his forehead',
      /\bfell\b/, /\bfall (at home|down|from|onto|on)\b/, 'trauma', 'road traffic', 'collision', 'assault', 'fracture',
    ]);
    if (injuryOnAnticoag) {
      add({
        id: 'anticoag_check',
        type: 'safety',
        urgency: 'urgent',
        icon: '💊',
        finding: `Injury on ${drug}`,
        text: 'Injury on an anticoagulant → exclude bleeding; reversal ready',
        rationale: 'An injured patient on an anticoagulant: exclude bleeding (CT head within 8 hours of a head injury, NICE NG232) and keep drug-specific reversal ready (ACC 2020 ECDP). Elective interruption plans do not apply.',
        actions: [
          warfarin
            ? { step: 1, text: 'INR now', addToInvestigations: 'Prothrombin Time (PT/INR)' }
            : { step: 1, text: `${drug}: time of the last dose and renal function`, addToInvestigations: 'Creatinine + eGFR' },
          { step: 2, text: 'Head injury on an anticoagulant: CT head within 8 hours of the injury (NICE NG232)', addToPlan: '• Head injury on an anticoagulant: CT head within 8 hours of the injury, even without other risk factors (NICE NG232 2023).' },
          { step: 3, text: `Withhold the ${drug} until bleeding is excluded; drug-specific reversal if bleeding is confirmed or the patient is unstable`, addToPlan: `• Withhold the ${drug} until bleeding is excluded. If bleeding is confirmed or the patient is unstable: ${warfarin ? 'IV vitamin K + four-factor PCC' : drug === 'dabigatran' ? 'idarucizumab' : doac ? 'andexanet alfa or four-factor PCC' : 'protamine'} with haematology (ACC 2020 ECDP).` },
        ],
      });
    } else add({
      id: 'anticoag_check',
      type: 'safety',
      urgency: activeBleeding ? 'urgent' : 'priority',
      icon: '💊',
      finding: activeBleeding ? `Bleeding on ${drug}` : `Anticoagulation therapy (${drug})`,
      text: activeBleeding ? 'Bleeding on an anticoagulant → withhold and reverse' : 'Anticoagulation — procedure-specific peri-procedural plan',
      rationale: activeBleeding
        ? 'Active bleeding on an anticoagulant: withhold and reverse per haematology; no bridging during active bleeding (ACC 2020 ECDP; BSG/ESGE 2021; ESGE 2021).'
        : 'Plan by the procedure\'s bleeding risk and the patient\'s thrombotic risk (BSG/ESGE 2021 for endoscopy; ACCP 2022 for surgery). Routine LMWH bridging is not recommended for atrial fibrillation (BRIDGE trial).',
      actions: activeBleeding
        ? [
            { step: 1, text: 'PT/INR, APTT, FBC, renal function', addToInvestigations: 'Prothrombin Time (PT/INR)' },
            { step: 2, text: `Withhold the ${drug} now`, addToPlan: `• Withhold the ${drug} now (active bleeding).` },
            { step: 3, text: warfarin
                ? 'Warfarin reversal: IV vitamin K + four-factor prothrombin complex concentrate (PCC) for major bleeding'
                : drug === 'dabigatran' ? 'Dabigatran reversal: idarucizumab for life-threatening bleeding'
                : doac ? 'Factor Xa inhibitor reversal: andexanet alfa or four-factor prothrombin complex concentrate (PCC) per local protocol for major bleeding'
                : 'Heparin / LMWH: protamine reversal per haematology for major bleeding',
              addToPlan: `• Anticoagulant reversal with haematology (ACC 2020 ECDP): ${warfarin ? 'IV vitamin K + four-factor PCC' : drug === 'dabigatran' ? 'idarucizumab' : doac ? 'andexanet alfa or four-factor PCC' : 'protamine'} for major / life-threatening bleeding.` },
          ]
        : [
            // Coagulation test by drug: INR for a vitamin K antagonist; none with standard DOAC
            // interruption (PAUSE; ACCP 2022).
            ...(warfarin
              ? [{ step: 1, text: 'INR (vitamin K antagonist)', addToInvestigations: 'Prothrombin Time (PT/INR)' }]
              : doac
                ? [{ step: 1, text: 'No routine coagulation test with standard DOAC interruption (PAUSE; ACCP 2022)' }]
                : []),
            { step: 2, text: 'Renal function (DOAC interruption interval)', addToInvestigations: 'Creatinine + eGFR' },
            ...(warfarin ? [
              { step: 3, text: 'Warfarin: high-bleeding-risk procedure — stop warfarin 5 days before and check INR; low-risk endoscopy — continue and check INR is in range (BSG/ESGE 2021)', addToPlan: '• High-bleeding-risk procedure (e.g. polypectomy, sphincterotomy, surgery): stop warfarin 5 days before and check INR before the procedure. Low-risk endoscopy (diagnostic OGD / colonoscopy ± biopsy): continue warfarin, check INR is not above the therapeutic range (BSG/ESGE 2021; ACCP 2022).' },
            ] : []),
            ...(doac ? [
              { step: 3, text: `${drug}: omit before high-bleeding-risk procedures for an interval set by drug and renal function (PAUSE; BSG/ESGE 2021); low-risk endoscopy — omit the morning dose only`, addToPlan: `• ${drug}: high-bleeding-risk procedure — omit for the interval set by drug and creatinine clearance (PAUSE; BSG/ESGE 2021). Low-risk endoscopy — omit the morning dose only. No LMWH bridging for a DOAC.` },
            ] : []),
            { step: 4, text: mechanicalValve ? 'Mechanical heart valve: high thrombotic risk — bridging plan with cardiology / haematology' : 'No routine LMWH bridging for atrial fibrillation (BRIDGE; ACCP 2022)', addToPlan: mechanicalValve
                ? '• Mechanical heart valve: high thrombotic risk — bridging with LMWH or IV heparin while warfarin is stopped, planned with cardiology / haematology (ACCP 2022).'
                : '• No routine LMWH bridging for atrial fibrillation (BRIDGE trial; ACCP 2022); bridging only for high thrombotic risk (e.g. mechanical mitral valve, VTE in the last 3 months), decided with haematology.' },
          ],
    });
  }

  // Antiplatelets and coronary stents (ESC/ESAIC 2022; BSG/ESGE 2021)
  const p2y12 = ['clopidogrel', 'ticagrelor', 'prasugrel'].find(d => hasMed(medications, medicationsText, d));
  const stentText = [historyAll, ...comorbidities, ...(input.surgicalHistory ?? []), assessment ?? ''].join('.\n').toLowerCase();
  const stentMatch = stentText.match(/\b(stent|pci|nstemi|stemi|acute coronary syndrome|myocardial infarction|angioplasty)\b[^.;\n]{0,40}?\b(\d{1,2})\s*(weeks?|months?)\s*(ago|before|previously|earlier)|\b(\d{1,2})\s*(weeks?|months?)\s*(after|since|following)\b[^.;\n]{0,15}\b(stent|pci|nstemi|stemi|acs|myocardial infarction|angioplasty)\b/);
  const stentMonths = stentMatch ? (() => {
    const n = parseInt(stentMatch[2] ?? stentMatch[5], 10);
    const unit = stentMatch[3] ?? stentMatch[6];
    return unit.startsWith('week') ? n / 4.3 : n;
  })() : null;
  const acsStent = stentMatch ? /nstemi|stemi|acute coronary|myocardial infarction|acs/.test(stentMatch[0]) : false;
  const inStentWindow = stentMonths !== null && stentMonths < (acsStent ? 12 : 6);
  if ((p2y12 || inStentWindow) && isPreOp) {
    add({
      id: 'antiplatelet_stent',
      type: 'safety',
      urgency: inStentWindow ? 'urgent' : 'priority',
      icon: '🫀',
      finding: inStentWindow ? `Coronary stent / ACS ${Math.round(stentMonths ?? 0)} months ago on antiplatelet therapy` : `P2Y12 inhibitor (${p2y12})`,
      text: inStentWindow ? 'Inside the dual antiplatelet window → defer elective surgery; cardiology' : 'Antiplatelet plan by procedure bleeding risk',
      rationale: 'Premature interruption of dual antiplatelet therapy after a coronary stent risks stent thrombosis: elective non-cardiac surgery is deferred until 6 months after elective PCI and 12 months after ACS unless cardiology agrees (ESC/ESAIC 2022). For endoscopy, BSG/ESGE 2021 sets P2Y12 interruption by procedure risk.',
      actions: [
        ...(inStentWindow ? [
          { step: 1, text: 'Defer elective surgery / high-risk procedure until the stent window has passed unless cardiology agrees (ESC/ESAIC 2022)', addToPlan: `• Defer elective surgery — coronary stent / ACS ${Math.round(stentMonths ?? 0)} months ago is inside the ${acsStent ? '12' : '6'}-month dual antiplatelet window (ESC/ESAIC 2022). Do not stop antiplatelets without cardiology.` },
          { step: 2, text: 'Cardiology liaison before any interruption of antiplatelet therapy', addToPlan: '• Cardiology liaison: timing of surgery and antiplatelet management.' },
        ] : []),
        ...(p2y12 && !inStentWindow ? [
          { step: 3, text: `High-bleeding-risk endoscopic procedure (e.g. polypectomy ≥ 1 cm, EMR, sphincterotomy): stop ${p2y12} before the procedure per BSG/ESGE 2021 timing, continue aspirin, if thrombotic risk is low`, addToPlan: `• High-risk endoscopic procedure: stop ${p2y12} before the procedure per BSG/ESGE 2021 (continue aspirin) if thrombotic risk is low; high thrombotic risk (recent stent) → cardiology first. Low-risk procedures: continue.` },
        ] : []),
      ],
    });
  }

  // ── LAB RESULT CASCADES ────────────────────────────────────────────────────

  // Haemoglobin < 8 → severe anaemia
  const hb = numLab(investigationResults, 'haemoglobin', 'hgb', 'hb');
  if (hb !== null && hb < 8) {
    add({
      id: 'severe_anaemia',
      type: 'safety',
      urgency: hb < 7 ? 'urgent' : 'priority',
      icon: '🩸',
      finding: `Haemoglobin ${hb} g/dL — severe anaemia`,
      diagnosis: 'Severe anaemia — transfusion threshold',
      text: `Hb ${hb} g/dL → Anaemia Cascade`,
      rationale: `Haemoglobin ${hb} g/dL — below transfusion trigger (< 7 g/dL symptomatic; < 8 g/dL pre-op). Underlying cause must be identified.`,
      actions: [
        { step: 1, text: 'Group & Screen / Crossmatch (2 units pRBC if Hb < 7)', addToInvestigations: 'Blood Group & Type' },
        { step: 2, text: 'Reticulocyte count + iron studies + B12/folate', addToInvestigations: 'Iron Studies' },
        { step: 3, text: 'Peripheral blood film', addToInvestigations: 'Peripheral Blood Film' },
        { step: 4, text: 'Upper + lower GI scope if iron deficiency (occult GI blood loss)', addToPlan: '• GI scope (OGD + colonoscopy) — iron deficiency anaemia workup, exclude GI blood loss.' },
        { step: 5, text: hb < 7 ? 'Transfuse 2 units pRBC — reassess Hb post-transfusion' : 'Consider transfusion — weigh symptom burden vs transfusion risks', addToPlan: hb < 7 ? '• Transfusion: 2 units pRBC — post-transfusion Hb target ≥ 8 g/dL.' : '• Discuss transfusion threshold with patient (Hb < 8, symptomatic).' },
      ],
      followUp: { label: 'Post-transfusion Hb check + GI scope result', daysFromNow: 7 },
    });
  }

  // WBC > 15 → leucocytosis / sepsis
  const wbc = numLab(investigationResults, 'white blood', 'wbc', 'wcc', 'leucocyte');
  // Acute pancreatitis raises the WBC through sterile inflammation. Without a documented infection
  // (cholangitis, infected necrosis, another source) the leucocytosis prompt must not suggest
  // antibiotics: prophylactic antibiotics are not recommended, even in predicted severe disease
  // (ACG 2024; IAP/APA 2013).
  const amylaseForWbc = numLab(investigationResults, 'amylase', 'lipase');
  const pancreatitisForWbc = (amylaseForWbc !== null && amylaseForWbc > 300) || dxSupports('pancreatit');
  const infectionDocumented = (hasJaundice && hasFever && hasRuqPain)
    || containsAnyAffirmed([assessment ?? '', input.historyText ?? ''].join('.\n'), [
      'cholangitis', 'infected necrosis', 'gas in the collection', 'gas within the collection',
      'pneumonia', 'urinary tract infection', 'pyelonephritis', 'positive blood culture', 'bacteraemia',
    ]);
  if (wbc !== null && wbc > 15 && pancreatitisForWbc && !infectionDocumented) {
    add({
      id: 'leucocytosis',
      type: 'safety',
      urgency: 'priority',
      icon: '🦠',
      finding: `WBC ${wbc} × 10⁹/L in acute pancreatitis`,
      diagnosis: 'Inflammatory leucocytosis (acute pancreatitis) — infection not documented',
      text: `WBC ${wbc} in pancreatitis → no prophylactic antibiotics`,
      rationale: `Leucocytosis ${wbc} × 10⁹/L is expected in acute pancreatitis (sterile inflammation). Prophylactic antibiotics are not recommended, including in predicted severe disease or sterile necrosis (ACG 2024; IAP/APA 2013). Look for a source if infection is suspected.`,
      actions: [
        { step: 1, text: 'No prophylactic antibiotics (ACG 2024; IAP/APA 2013)', addToPlan: '• No prophylactic antibiotics in acute pancreatitis (ACG 2024; IAP/APA 2013) — antibiotics only if infection is suspected or confirmed (cholangitis, infected necrosis, another source).' },
        { step: 2, text: 'Lactate and severity assessment', addToInvestigations: 'Lactate' },
        { step: 3, text: 'If infection is suspected: blood cultures and look for the source', addToPlan: '• If infection is suspected: blood cultures ×2 and look for the source (cholangitis, infected necrosis on CECT, chest, urine).' },
      ],
    });
  } else if (wbc !== null && wbc > 15) {
    add({
      id: 'leucocytosis',
      type: 'safety',
      urgency: 'priority',
      icon: '🦠',
      finding: `WBC ${wbc} × 10⁹/L — leucocytosis`,
      diagnosis: 'Sepsis / systemic infection',
      text: `WBC ${wbc} → Sepsis Screen`,
      rationale: `Leucocytosis ${wbc} × 10⁹/L — systemic infection / sepsis. Sepsis-3 criteria apply; escalate if qSOFA ≥ 2.`,
      actions: [
        { step: 1, text: 'Blood cultures × 2 before antibiotics', addToPlan: '• Blood cultures × 2 before first antibiotic dose.' },
        { step: 2, text: 'Procalcitonin + lactate', addToInvestigations: 'Lactate' },
        { step: 3, text: 'Sepsis-6 bundle within 1 hour', addToPlan: '• Sepsis-6 bundle: O₂, cultures, antibiotics, IV fluids, urine output monitoring, blood glucose.' },
        { step: 4, text: 'Identify and treat source — imaging if abdominal source', addToPlan: paed
            ? '• Abdominal source suspected in a child: ultrasound first; CT only if ultrasound is inconclusive (RCR iRefer; ALARA).'
            : pregnancyForImaging
              ? '• Abdominal source suspected in pregnancy: ultrasound first, MRI if needed; CT only when the benefit outweighs the risk (ACOG CO 723).'
              : '• CT abdomen if abdominal source suspected — abscess, perforation, ischaemia.' },
      ],
    });
  }

  // Amylase > 1000 → acute pancreatitis
  const amylase = numLab(investigationResults, 'amylase', 'lipase');
  if (amylase !== null && amylase > 1000) {
    add({
      id: 'pancreatitis_confirmed',
      type: 'safety',
      urgency: 'urgent',
      icon: '🔥',
      finding: `Amylase ${amylase} U/L — severe elevation`,
      diagnosis: 'Acute Pancreatitis',
      text: `Amylase ${amylase} U/L → Acute Pancreatitis`,
      rationale: `Amylase ${amylase} U/L (> 3× ULN) — acute pancreatitis confirmed biochemically. Severity stratification guides ICU need.`,
      actions: [
        { step: 1, text: 'Glasgow/Ranson/BISAP severity score', addToPlan: '• Calculate Glasgow severity score — document at 48h (score ≥ 3 = severe).' },
        { step: 2, text: 'Moderate, goal-directed IV fluids — not aggressive (WATERFALL 2022; ACG 2024); cautious with heart failure', addToPlan: `• Moderate goal-directed IV fluid with Hartmann's${hfOrPeEarly ? ' — heart failure recorded: small boluses with close review' : ''}: 10 ml/kg bolus only if hypovolaemic, then 1.5 ml/kg/h, reassessed against urine output, HR and BP (WATERFALL 2022; ACG 2024) — avoid aggressive fluid regimens.` },
        { step: 3, text: 'CRP at 48h, calcium, LFTs (biliary aetiology?)', addToInvestigations: 'Calcium (corrected)' },
        { step: 4, text: 'USS abdomen — biliary cause, CBD stones', addToPlan: '• USS abdomen — biliary aetiology (gallstones, CBD diameter).' },
        { step: 5, text: 'CT pancreas (contrast-enhanced) at 48–72h if severe', addToPlan: '• CT pancreas (CECT) at 48–72h if severe — necrosectomy planning.' },
        { step: 6, text: 'HDU/ICU if Glasgow ≥ 3 or organ dysfunction', addToPlan: '• HDU/ICU — monitor renal, respiratory, cardiovascular function.' },
      ],
      followUp: { label: 'Post-pancreatitis 6-week review + cholecystectomy planning', daysFromNow: 42 },
    });
  }

  // Pancreatitis: stop a possible causative drug (B16; ACG 2024 — azathioprine, valproate, …)
  const pancreatitisContext = (amylase !== null && amylase > 300) || dxSupports('pancreatit');
  const pancreatitisDrug = ['azathioprine', 'mercaptopurine', 'valproate', 'sodium valproate', 'didanosine', 'mesalazine', 'furosemide', 'gliptin', 'exenatide', 'liraglutide', 'semaglutide']
    .find(d => hasMed(medications, medicationsText, d));
  if (pancreatitisContext && pancreatitisDrug) {
    add({
      id: 'pancreatitis_drug',
      type: 'safety',
      urgency: 'priority',
      icon: '💊',
      finding: `Pancreatitis on ${pancreatitisDrug}`,
      text: `Possible drug-induced pancreatitis → stop ${pancreatitisDrug}`,
      rationale: `${pancreatitisDrug} is a recognised cause of acute pancreatitis (ACG 2024). Stop the drug and discuss the alternative with the prescribing specialist.`,
      actions: [
        { step: 1, text: `Stop ${pancreatitisDrug} (possible causative drug)`, addToPlan: `• Stop ${pancreatitisDrug} — possible drug-induced pancreatitis (ACG 2024); inform the prescribing specialist.` },
      ],
    });
  }

  // INR > 1.5 → coagulopathy
  const inr = numLab(investigationResults, 'inr', 'pt/inr', 'prothrombin');
  const onWarfarin = hasMed(medications, medicationsText, 'warfarin');
  if (inr !== null && inr > 1.5 && onWarfarin && !activeBleeding && inr <= 5) {
    add({
      id: 'coagulopathy',
      type: 'safety',
      urgency: 'priority',
      icon: '⚠️',
      finding: `INR ${inr} on warfarin`,
      text: `INR ${inr} on warfarin → peri-procedural plan (no reversal)`,
      rationale: `INR ${inr} in a patient on warfarin is expected anticoagulation, not a coagulopathy to correct. Manage with the procedure-specific plan (BSG/ESGE 2021; ACCP 2022).`,
      actions: [
        { step: 1, text: 'Follow the peri-procedural anticoagulation plan; vitamin K / PCC only if bleeding or urgent surgery', addToPlan: `• INR ${inr} on warfarin: follow the peri-procedural anticoagulation plan — vitamin K / PCC only if bleeding or urgent surgery.` },
      ],
    });
  } else if (inr !== null && inr > 1.5) {
    add({
      id: 'coagulopathy',
      type: 'safety',
      urgency: inr > 3 ? 'urgent' : 'priority',
      icon: '⚠️',
      finding: `INR ${inr} — coagulopathy`,
      text: `INR ${inr} → Hold Surgery / Correct`,
      rationale: `INR ${inr} — surgical bleeding risk unacceptable (target < 1.5 for elective surgery). Identify cause and correct.`,
      actions: [
        { step: 1, text: 'Hold elective surgery until INR < 1.5', addToPlan: '• Elective surgery deferred — INR must be < 1.5 pre-operatively.' },
        { step: 2, text: inr > 3 ? 'Vitamin K IV 5–10mg + 4-factor PCC (emergency)' : 'Vitamin K PO 1–2mg (warfarin reversal)', addToPlan: inr > 3 ? '• IV Vitamin K 10mg + 4-factor PCC — emergency reversal (INR > 3).' : '• PO Vitamin K 1–2mg — slow INR correction (avoid over-reversal in warfarin patients).' },
        { step: 3, text: 'LFTs + hepatitis serology — hepatic cause?', addToInvestigations: 'Liver Function Tests (LFTs)' },
        { step: 4, text: 'Repeat INR in 24–48h', addToPlan: '• Repeat INR in 24–48h — confirm correction before rescheduling surgery.' },
      ],
    });
  }

  // AFP elevated → HCC
  const afp = numLab(investigationResults, 'afp', 'alpha-fetoprotein', 'alpha fetoprotein');
  if (afp !== null && afp > 20) {
    add({
      id: 'afp_elevated',
      type: 'safety',
      urgency: 'priority',
      icon: '🟠',
      finding: `AFP ${afp} ng/mL — elevated`,
      diagnosis: 'Hepatocellular carcinoma (HCC) — investigate',
      text: `AFP ${afp} → HCC Investigation`,
      rationale: `AFP ${afp} ng/mL — elevated. Liver cirrhosis + AFP > 20 ng/mL carries significant HCC risk; > 200 ng/mL is diagnostic with typical imaging.`,
      actions: [
        { step: 1, text: 'Triple-phase CT liver (or MRI liver with contrast)', addToPlan: '• Triple-phase CT liver — HCC characterisation (arterial enhancement + washout).' },
        { step: 2, text: 'Child-Pugh / MELD score — hepatic reserve', addToPlan: '• Calculate Child-Pugh and MELD score — hepatic reserve and prognosis.' },
        { step: 3, text: 'Hepatology referral', addToPlan: '• Urgent hepatology referral — Barcelona Clinic Liver Cancer (BCLC) staging.' },
        { step: 4, text: 'Hepatitis B + C serology if not already done', addToInvestigations: 'Hepatitis B Surface Antigen' },
      ],
      followUp: { label: 'HCC staging CT result + hepatology MDT', daysFromNow: 7 },
    });
  }

  // PSA > 4 → urology referral
  const psa = numLab(investigationResults, 'psa', 'prostate specific');
  if (psa !== null && psa > 4 && sex === 'male') {
    add({
      id: 'psa_elevated',
      type: 'safety',
      urgency: 'priority',
      icon: '🔬',
      finding: `PSA ${psa} ng/mL — elevated`,
      diagnosis: 'Prostate malignancy — investigate',
      text: `PSA ${psa} ng/mL → Prostate Workup`,
      rationale: `PSA ${psa} ng/mL — elevated (> 4 ng/mL requires further assessment). Age-adjusted PSA and free:total ratio guide biopsy decision.`,
      actions: [
        { step: 1, text: 'Free PSA + PSA density calculation', addToPlan: '• Free PSA ratio (free:total) — low ratio (< 15%) increases malignancy risk.' },
        { step: 2, text: 'mpMRI prostate (PI-RADS scoring)', addToPlan: '• mpMRI prostate — PI-RADS classification before biopsy decision.' },
        { step: 3, text: 'Urology referral — transperineal biopsy if PI-RADS ≥ 3', addToPlan: '• Urology referral — PI-RADS-guided transperineal biopsy decision.' },
      ],
      followUp: { label: 'PSA + MRI prostate result', daysFromNow: 14 },
    });
  }

  // CA 19-9 elevated → pancreatic / biliary
  const ca199 = numLab(investigationResults, 'ca 19-9', 'ca19-9', 'ca19', 'ca-19');
  if (ca199 !== null && ca199 > 37) {
    add({
      id: 'ca199_elevated',
      type: 'safety',
      urgency: 'priority',
      icon: '🟡',
      finding: `CA 19-9 ${ca199} U/mL — elevated`,
      diagnosis: 'Pancreatic / biliary malignancy',
      text: `CA 19-9 ${ca199} → HPB Malignancy Workup`,
      rationale: `CA 19-9 ${ca199} U/mL — elevated (> 37 U/mL). High sensitivity for pancreatic and biliary malignancy when combined with clinical symptoms.`,
      actions: [
        { step: 1, text: 'CT pancreas protocol (triple-phase)', addToPlan: '• CT abdomen/pelvis — pancreatic protocol (triple-phase contrast).' },
        { step: 2, text: 'MRCP — biliary anatomy, pancreatic duct dilation', addToPlan: '• MRCP — pancreatic duct and biliary tree anatomy.' },
        { step: 3, text: 'CEA + AFP — additional tumour markers', addToInvestigations: 'CEA' },
        { step: 4, text: 'ERCP + tissue sampling if biliary obstruction', addToPlan: '• ERCP — biliary decompression and brush cytology if obstructive jaundice.' },
        { step: 5, text: 'HPB / Oncology MDT referral', addToPlan: '• HPB oncology MDT referral — resectability assessment.' },
      ],
      followUp: { label: 'HPB MDT staging result', daysFromNow: 7 },
    });
  }

  // CEA elevated → colorectal
  const cea = numLab(investigationResults, 'cea', 'carcinoembryonic');
  if (cea !== null && cea > 5) {
    add({
      id: 'cea_elevated',
      type: 'safety',
      urgency: 'priority',
      icon: '🔭',
      finding: `CEA ${cea} ng/mL — elevated`,
      diagnosis: 'Colorectal malignancy (or recurrence)',
      text: `CEA ${cea} ng/mL → Colorectal Malignancy Workup`,
      rationale: `CEA ${cea} ng/mL — elevated (> 5 ng/mL) in non-smoker. Primary colorectal malignancy or recurrence should be excluded.`,
      actions: [
        { step: 1, text: 'Colonoscopy + biopsy', addToPlan: '• Urgent colonoscopy + biopsy — 2-week wait pathway (elevated CEA + alarm symptoms).' },
        { step: 2, text: 'CT chest/abdomen/pelvis — M staging', addToPlan: '• CT chest/abdomen/pelvis — distant metastasis staging.' },
        { step: 3, text: 'CA 19-9 (concurrent GI malignancy marker)', addToInvestigations: 'CA 19-9' },
        { step: 4, text: 'Colorectal oncology referral if malignancy confirmed', addToPlan: '• Colorectal oncology referral and MDT discussion.' },
      ],
      followUp: { label: 'Colonoscopy + staging CT result', daysFromNow: 14 },
    });
  }

  // Creatinine elevated → AKI
  const creat = numLab(investigationResults, 'creatinine');
  if (creat !== null && creat > 130) {
    add({
      id: 'aki_creatinine',
      type: 'safety',
      urgency: creat > 300 ? 'urgent' : 'priority',
      icon: '🫘',
      finding: `Creatinine ${creat} μmol/L — elevated`,
      diagnosis: 'Acute Kidney Injury / CKD',
      text: `Creatinine ${creat} → AKI / Renal Impairment`,
      rationale: `Creatinine ${creat} μmol/L — renal impairment. Peri-operative risk elevated; nephrotoxics must be reviewed.`,
      actions: [
        { step: 1, text: 'Urine dipstick + urinalysis + ACR', addToPlan: '• Urine dipstick, urinalysis, albumin:creatinine ratio — AKI vs CKD differentiation.' },
        { step: 2, text: 'Hold NSAIDs, ACE-I/ARBs, metformin, nephrotoxics', addToPlan: '• Hold NSAIDs, ACE-I, ARBs, metformin — nephrotoxic drugs peri-operatively.' },
        { step: 3, text: 'IV fluid challenge if pre-renal (dehydration/sepsis)', addToPlan: '• IV fluid challenge (500ml Hartmann\'s) if pre-renal cause — reassess creatinine in 4–6h.' },
        { step: 4, text: 'Repeat U&E + creatinine in 24h', addToInvestigations: 'Urea & Electrolytes (U&E)' },
        { step: 5, text: 'Nephrology referral if creatinine > 300 or oliguria/anuria', addToPlan: creat > 300 ? '• Urgent nephrology referral — AKI stage 3 (creatinine > 300 μmol/L).' : '• Consider nephrology input if creatinine not improving after fluid resuscitation.' },
      ],
    });
  }

  // Bilirubin elevated (standalone if no jaundice already detected)
  const bili = numLab(investigationResults, 'bilirubin', 'bili');
  if (bili !== null && bili > 40 && !hasJaundice) {
    add({
      id: 'hyperbilirubinaemia',
      type: 'investigation',
      urgency: 'priority',
      icon: '🟡',
      finding: `Bilirubin ${bili} μmol/L — elevated`,
      text: `Bilirubin ${bili} → Jaundice Workup`,
      rationale: `Bilirubin ${bili} μmol/L — jaundice threshold (> 40 μmol/L). LFT pattern + USS to distinguish obstructive from hepatocellular aetiology.`,
      actions: [
        { step: 1, text: 'LFTs — direct vs indirect bilirubin + hepatic pattern', addToInvestigations: 'Liver Function Tests (LFTs)' },
        { step: 2, text: 'PT/INR — synthetic function', addToInvestigations: 'Prothrombin Time (PT/INR)' },
        { step: 3, text: 'Hepatitis B + C serology', addToInvestigations: 'Hepatitis B Surface Antigen' },
        { step: 4, text: 'USS abdomen — biliary system, gallstones, hepatic lesion', addToPlan: '• USS abdomen — biliary dilation, gallstones, hepatic parenchyma.' },
      ],
    });
  }

  // Glucose > 11 → hyperglycaemia management
  const glucose = numLab(investigationResults, 'glucose', 'blood sugar', 'bm');
  if (glucose !== null && glucose > 11) {
    add({
      id: 'hyperglycaemia',
      type: 'investigation',
      urgency: 'priority',
      icon: '📊',
      finding: `Glucose ${glucose} mmol/L — hyperglycaemia`,
      text: `Glucose ${glucose} mmol/L → Diabetes Management`,
      rationale: `Glucose ${glucose} mmol/L — uncontrolled hyperglycaemia. Pre-operative glucose should be < 10 mmol/L; inpatient sliding scale if > 11 mmol/L.`,
      actions: [
        { step: 1, text: 'HbA1c — chronic glycaemic control', addToInvestigations: 'HbA1c' },
        { step: 2, text: 'Ketones (urine or blood) — exclude DKA', addToPlan: '• Urine ketones — exclude diabetic ketoacidosis.' },
        { step: 3, text: 'Insulin sliding scale if inpatient + glucose > 11 mmol/L', addToPlan: '• Variable-rate insulin infusion (VRIII) if inpatient glucose consistently > 11 mmol/L.' },
        { step: 4, text: 'Endocrinology / diabetology referral if poorly controlled', addToPlan: '• Diabetology review — adjust long-term insulin/OHG regimen.' },
      ],
    });
  }

  // ── IMAGING RESULT CASCADES ────────────────────────────────────────────────

  // Dilated CBD — only when a dilated duct is written: a measured CBD > 6 mm (> 8 mm after
  // cholecystectomy), or "dilated CBD / common bile duct / biliary dilatation". Any mention of
  // "CBD" (even "CBD 4 mm") and "dilated proximal ureter" used to fire it (SURGEON-DECISIONS E3).
  // The threshold (and any age adjustment) is listed under "Needs sign-off".
  const postChole = hasPmh(input.surgicalHistory ?? [], 'cholecystectomy');
  const cbdLimit = postChole ? 8 : 6;
  const cbdMeasured = radiologyRequests.some(r => {
    if (!r.resultReceived) return false;
    const t = lo(r.resultNotes);
    const re = /\b(?:cbd|common bile duct|bile duct|common duct)\b[^.;\n]{0,25}?(\d{1,2}(?:\.\d)?)\s*mm\b/g;
    for (let m = re.exec(t); m; m = re.exec(t)) if (parseFloat(m[1]) > cbdLimit) return true;
    return false;
  });
  const cbdDilatedWords = radiologyRequests.some(r => r.resultReceived && containsAnyAffirmed(r.resultNotes, [
    /\bdilated (cbd|common bile duct|bile ducts?|biliary tree|intrahepatic ducts?)\b/, /\b(cbd|common bile duct|bile ducts?|biliary tree)\b[^.;\n]{0,15}\bdilated\b/,
    /\b(biliary|bile duct|cbd|intrahepatic duct) dilatation\b/, /\bbile duct dilation\b/,
  ]));
  const cbdAnyNumber = radiologyRequests.some(r => r.resultReceived && /\b(?:cbd|common bile duct|bile duct)\b[^.;\n]{0,25}?\d{1,2}(?:\.\d)?\s*mm\b/.test(lo(r.resultNotes)));
  if (cbdMeasured || (cbdDilatedWords && !cbdAnyNumber)) {
    add({
      id: 'dilated_cbd',
      type: 'safety',
      urgency: 'priority',
      icon: '🔍',
      finding: 'Dilated common bile duct on imaging',
      diagnosis: 'Biliary obstruction — choledocholithiasis / malignancy',
      text: 'Dilated CBD → MRCP + ERCP',
      rationale: `Dilated CBD (> ${cbdLimit} mm${postChole ? ' after cholecystectomy' : ''}) suggests biliary obstruction — most common causes: choledocholithiasis (if symptomatic) and malignancy (if painless).`,
      actions: [
        { step: 1, text: 'LFTs + direct bilirubin + GGT', addToInvestigations: 'Liver Function Tests (LFTs)' },
        { step: 2, text: 'CA 19-9 + CEA — malignancy screen', addToInvestigations: 'CA 19-9' },
        { step: 3, text: 'MRCP — CBD stones, stricture, mass', addToPlan: '• MRCP — CBD diameter, stone burden, biliary stricture characterisation.' },
        { step: 4, text: 'ERCP — only if obstruction is confirmed (stone or stricture)', addToPlan: '• ERCP only if MRCP / EUS confirms an obstructing stone or stricture — therapeutic stone extraction or stenting.' },
        { step: 5, text: 'HPB surgical review if a mass or stricture is found', addToPlan: '• HPB surgical review if a mass or stricture is found.' },
      ],
      followUp: { label: 'Post-ERCP CBD result', daysFromNow: 7 },
    });
  }

  // Inflamed / enlarged appendix on imaging
  if (hasRadResult(radiologyRequests, 'appendicitis', 'inflamed appendix', 'dilated appendix', 'thickened appendix', 'appendicolith', 'appendix > 6', 'appendix >6')) {
    add({
      id: 'appendix_imaging',
      type: 'safety',
      urgency: 'urgent',
      icon: '🔥',
      finding: 'Appendix > 6mm / inflamed on imaging',
      diagnosis: 'Acute Appendicitis — imaging confirmed',
      text: 'Imaging Confirms Appendicitis → Emergency Theatre',
      rationale: 'Appendix > 6mm or periappendiceal inflammation on CT/USS — acute appendicitis confirmed. Emergency appendicectomy indicated.',
      actions: [
        { step: 1, text: 'NBM immediately — emergency theatre preparation', addToPlan: '• NBM — emergency theatre booking, laparoscopic appendicectomy.' },
        { step: 2, text: 'IV Piperacillin-tazobactam + Metronidazole', addToPlan: '• IV Piperacillin-tazobactam 4.5g TDS + Metronidazole 500mg TDS — pre-op.' },
        { step: 3, text: 'Surgical consent + anaesthetic review', addToPlan: '• Surgical consent — laparoscopic appendicectomy (risk of conversion, wound infection, stump leak).' },
        { step: 4, text: 'FBC + Group & Screen pre-op', addToInvestigations: 'Blood Group & Type' },
      ],
      followUp: { label: 'Post-appendicectomy wound review', daysFromNow: 14 },
    });
  }

  // Free air / pneumoperitoneum on imaging
  if (hasRadResult(radiologyRequests, 'free air', 'pneumoperitoneum', 'free gas', 'subdiaphragmatic')) {
    add({
      id: 'free_air_imaging',
      type: 'safety',
      urgency: 'urgent',
      icon: '🚨',
      finding: 'Pneumoperitoneum on imaging',
      diagnosis: 'Perforated viscus — emergency surgery',
      text: 'Pneumoperitoneum → Emergency Laparotomy',
      rationale: 'Free intraperitoneal air indicates visceral perforation. Surgical emergency — mortality increases by ~1% per hour of delay.',
      actions: [
        { step: 1, text: 'IV access, resuscitation, urinary catheter, NG tube', addToPlan: '• IV access, Hartmann\'s resuscitation, urinary catheter (fluid balance), NG tube (decompression).' },
        { step: 2, text: 'IV Piperacillin-tazobactam 4.5g + Metronidazole 500mg', addToPlan: '• IV Piperacillin-tazobactam 4.5g TDS + Metronidazole 500mg TDS.' },
        { step: 3, text: 'Group & Screen + FBC + PT/INR + U&E + lactate', addToInvestigations: 'Blood Group & Type' },
        { step: 4, text: 'Emergency laparotomy consent — ICU post-op', addToPlan: '• Emergency laparotomy consent — source control; ICU post-operatively.' },
        { step: 5, text: 'Theatre now — do not delay for further imaging', addToPlan: '• Do NOT delay theatre for further imaging — clinical + CXR diagnosis sufficient.' },
      ],
    });
  }

  // Pelvic free fluid in female → ruptured ectopic
  if (hasRadResult(radiologyRequests, 'pelvic free fluid', 'free fluid', 'haemoperitoneum') && sex === 'female'
    && isReproductiveAgeFemale && emergencyLayer.labs.pregnancyTest !== 'negative') {
    add({
      id: 'pelvic_free_fluid_female',
      type: 'safety',
      urgency: 'urgent',
      icon: '🚑',
      finding: 'Pelvic free fluid on imaging — female patient',
      diagnosis: 'Ruptured ectopic pregnancy until proven otherwise',
      text: 'Pelvic Free Fluid → Ruptured Ectopic Protocol',
      rationale: 'Pelvic free fluid in female of reproductive age — ruptured ectopic pregnancy is a surgical emergency with significant haemorrhagic mortality risk.',
      actions: [
        { step: 1, text: 'Serum β-HCG (quantitative)', addToInvestigations: 'Serum β-HCG (quantitative)' },
        { step: 2, text: 'Group & Crossmatch 4 units pRBC', addToInvestigations: 'Blood Group & Type' },
        { step: 3, text: 'IV access × 2 — large bore — resuscitate', addToPlan: '• 2 × large-bore IV cannulae, O-neg blood if haemodynamically unstable, cross-match 4 units.' },
        { step: 4, text: 'Emergency gynaecology referral — laparoscopic salpingectomy', addToPlan: '• Emergency gynaecology referral — ruptured ectopic protocol, laparoscopic salpingectomy.' },
        { step: 5, text: 'TVS if stable — confirm ectopic location', addToPlan: '• Transvaginal USS if haemodynamically stable — confirm ectopic location before theatre.' },
      ],
    });
  }

  // Hepatic lesion on imaging
  if (hasRadResult(radiologyRequests, 'hepatic lesion', 'liver lesion', 'liver mass', 'hepatic mass', 'liver lump')) {
    add({
      id: 'hepatic_lesion_imaging',
      type: 'safety',
      urgency: 'priority',
      icon: '🟠',
      finding: 'Hepatic lesion on imaging',
      diagnosis: 'Liver lesion — characterisation required',
      text: 'Liver Lesion → Triple-Phase CT + AFP',
      rationale: 'Indeterminate hepatic lesion — characterisation with triple-phase CT or MRI liver required to distinguish HCC, metastasis, haemangioma, or other.',
      actions: [
        { step: 1, text: 'AFP + CEA + CA 19-9', addToInvestigations: 'AFP' },
        { step: 2, text: 'LFTs + PT/INR — hepatic reserve', addToInvestigations: 'Liver Function Tests (LFTs)' },
        { step: 3, text: 'Triple-phase CT liver (or MRI liver with gadolinium)', addToPlan: '• Triple-phase CT liver — arterial/venous/delayed phases for HCC characterisation (LI-RADS).' },
        { step: 4, text: 'Hepatology / HPB surgical referral', addToPlan: '• Hepatology referral — BCLC staging and treatment planning.' },
      ],
      followUp: { label: 'Liver lesion staging result + hepatology MDT', daysFromNow: 7 },
    });
  }

  // ── INVESTIGATION — PMH-driven ─────────────────────────────────────────────

  if (hasDiabetes) {
    add({
      id: 'diabetes_hba1c',
      type: 'investigation',
      urgency: 'routine',
      icon: '📊',
      finding: 'Diabetes mellitus',
      text: 'HbA1c + eGFR — diabetes monitoring',
      rationale: 'Diabetic patient — HbA1c for glycaemic control (target ≤ 53 mmol/mol); eGFR for nephropathy.',
      actions: [
        { step: 1, text: 'HbA1c', addToInvestigations: 'HbA1c' },
        { step: 2, text: 'Creatinine + eGFR', addToInvestigations: 'Creatinine + eGFR' },
        { step: 3, text: 'Urine ACR — microalbuminuria', addToPlan: '• Urine albumin:creatinine ratio — diabetic nephropathy screening.' },
      ],
    });
  }

  if (hasPmh(comorbidities, 'hypertens', 'htn')) {
    add({
      id: 'htn_metabolic',
      type: 'investigation',
      urgency: 'routine',
      icon: '🫀',
      finding: 'Hypertension',
      text: 'U&E + eGFR — hypertension monitoring',
      rationale: 'Hypertensive patient on ACE-I/ARBs or diuretics — check electrolytes and renal function for treatment effect.',
      actions: [
        { step: 1, text: 'U&E + creatinine + eGFR', addToInvestigations: 'Urea & Electrolytes (U&E)' },
        { step: 2, text: 'Urine ACR', addToPlan: '• Urine ACR — hypertensive nephropathy screen.' },
        { step: 3, text: 'Blood pressure measured and documented both arms', addToPlan: '• Document bilateral BP — coarctation exclusion if > 20mmHg differential.' },
      ],
    });
  }

  if (hasToxic(toxicHabits, 'alcohol', 'etoh')) {
    add({
      id: 'alcohol_lfts',
      type: 'investigation',
      urgency: 'routine',
      icon: '🫗',
      finding: 'Alcohol use',
      text: 'LFTs + GGT — alcohol-related liver disease screen',
      rationale: 'Alcohol use — LFTs and GGT for hepatotoxicity; raised GGT indicates enzyme induction from chronic use.',
      actions: [
        { step: 1, text: 'LFTs + GGT', addToInvestigations: 'Liver Function Tests (LFTs)' },
        { step: 2, text: 'FBC (macrocytosis — B12/folate deficiency)', addToInvestigations: 'Full Blood Count (FBC)' },
        { step: 3, text: 'Clotting (hepatic synthetic function)', addToInvestigations: 'Prothrombin Time (PT/INR)' },
        { step: 4, text: 'FIB-4 score or FibroScan if AST/ALT elevated', addToPlan: '• Calculate FIB-4 score — non-invasive fibrosis assessment (cirrhosis risk).' },
      ],
    });
  }

  // Sickle cell
  if (hasPmh(comorbidities, 'sickle') || hasFhx(familyHistory, 'sickle')) {
    add({
      id: 'sickle_screen',
      type: 'investigation',
      urgency: 'priority',
      icon: '🩺',
      finding: 'Sickle cell history',
      text: 'FBC + HPLC — sickle cell status',
      rationale: 'Sickle cell disease/trait — Caribbean relevance is high. Pre-op HPLC if trait status unknown; avoid hypoxia, hypothermia, dehydration peri-operatively.',
      actions: [
        { step: 1, text: 'FBC + peripheral blood film', addToInvestigations: 'Full Blood Count (FBC)' },
        { step: 2, text: 'HPLC (Hb electrophoresis) if trait status unknown', addToPlan: '• HPLC — sickle cell haemoglobin quantification if trait status not on record.' },
        { step: 3, text: 'Peri-op precautions: IV fluids, O₂, warming, avoid tourniquet', addToPlan: '• Peri-operative sickle precautions: IV hydration, supplemental O₂, active warming, avoid tourniquet in known SCD.' },
      ],
    });
  }

  if (hasPmh(comorbidities, 'hepatitis', 'cirrhosis', 'liver disease', 'hep b', 'hep c')) {
    add({
      id: 'liver_disease_check',
      type: 'investigation',
      urgency: 'priority',
      icon: '🟡',
      finding: 'Known liver disease',
      text: 'Liver panel + AFP — HCC surveillance',
      rationale: 'Known liver disease — synthetic function (PT, albumin), hepatic enzymes, and AFP as HCC surveillance.',
      actions: [
        { step: 1, text: 'LFTs + PT/INR + albumin', addToInvestigations: 'Liver Function Tests (LFTs)' },
        { step: 2, text: 'AFP (6-monthly HCC surveillance in cirrhosis)', addToInvestigations: 'AFP' },
        { step: 3, text: 'USS abdomen 6-monthly', addToPlan: '• USS abdomen — 6-monthly HCC surveillance (cirrhosis + viral hepatitis).' },
        { step: 4, text: 'MELD / Child-Pugh score', addToPlan: '• Calculate MELD and Child-Pugh score — hepatic reserve and surgical risk.' },
      ],
      followUp: { label: 'HCC surveillance USS + AFP', daysFromNow: 180, recurring: true, recurringDays: 180 },
    });
  }

  // NSAIDs → renal check
  if (hasMed(medications, medicationsText, 'ibuprofen', 'naproxen', 'diclofenac', 'ketorolac', 'indomethacin', 'celecoxib', 'meloxicam')) {
    add({
      id: 'nsaid_renal',
      type: 'investigation',
      urgency: 'routine',
      icon: '🧫',
      finding: 'NSAID use',
      text: 'Creatinine + eGFR — NSAID nephrotoxicity',
      rationale: 'Regular NSAID use — baseline renal function to guide safe peri-operative prescribing.',
      actions: [
        { step: 1, text: 'Creatinine + eGFR', addToInvestigations: 'Creatinine + eGFR' },
        { step: 2, text: 'Hold NSAIDs peri-operatively', addToPlan: '• Hold NSAIDs 48h pre-operatively — renal protection.' },
      ],
    });
  }

  // ── PREVENTATIVE / SCREENING ────────────────────────────────────────────────
  // Screening, surveillance and suspected-cancer (NG12) prompts: lib/triage-engine screening
  // engines, via preventive-screening-prompts.ts (SURGEON-DECISIONS G2.19 / C9).
  for (const p of computePreventivePrompts(input)) add(p);

  void assessment; // reserved for future AI narrative integration

  // ── VITAL SIGN CASCADES ─────────────────────────────────────────────────────

  const sbp  = numVital(vitals, 'systolicBp');
  const dbp  = numVital(vitals, 'diastolicBp');
  const hr   = numVital(vitals, 'heartRate');
  const temp = numVital(vitals, 'temperatureC');
  const rr   = numVital(vitals, 'respiratoryRate');
  const spo2 = numVital(vitals, 'spo2');
  const bgl  = numVital(vitals, 'glucoseMmol');

  void rr; // available for future respiratory cascade rules

  const hasFeverVital   = temp !== null && temp >= 38.0;
  // Under 16: age-banded limits (NICE NG51 / NG143 heart and respiratory rate; AHA PALS 2020
  // hypotension) so a normal infant heart rate or SBP is not labelled tachycardia or "shock".
  const hasTachyVital   = hr   !== null && (paedLimits ? hr >= paedLimits.hrHigh : hr > 100);
  const hasHypotension  = sbp  !== null && sbp < (paedLimits?.sbpLow ?? 90);
  const hasHypoxia      = spo2 !== null && spo2 <   94;
  const hasBradycardia  = hr   !== null && hr < (paedLimits?.hrLow ?? 50);
  const hasHyperBP      = sbp  !== null && sbp  >= 180 && !paed;
  // Heart-failure signs or suspected / confirmed PE: no fluid bolus (ESC 2021 HF; ESC 2019 PE).
  const hfOrPe = recognised('acute_heart_failure') || recognised('pe') || recognised('pe_suspected')
    || containsAnyAffirmed([examGeneral, input.examCardio, input.examResp].join('\n'), ['raised jvp', 'jvp raised', 'jvp elevated', 'pulmonary oedema', 'pulmonary edema', 'bibasal crackles', 'orthopnoea', 'orthopnea', 'gallop'])
    || hasPmh(comorbidities, 'heart failure', 'cardiac failure', 'lvsd', 'reduced ejection');
  const copd = hasPmh(comorbidities, 'copd', 'chronic obstructive', 'emphysema', 'chronic bronchitis', 'hypercapni', 'type 2 respiratory failure', 'co2 retain', 'co₂ retain');

  // Sepsis criteria: fever + tachycardia (± hypotension). Children: the emergency layer's
  // paediatric sepsis prompt (NICE NG51 / NG143) replaces this adult bundle.
  if (hasFeverVital && hasTachyVital && !paed) {
    const sepsisActions: ClinicalAction[] = [
      { step: 1, text: 'Blood cultures × 2 (peripheral + central if line in situ) — BEFORE antibiotics', addToPlan: '• Blood cultures × 2 before antibiotics.' },
      { step: 2, text: 'Broad-spectrum IV antibiotics within 1 hour', addToPlan: hasHypotension ? '• IV Meropenem 1g TDS + Vancomycin 25mg/kg (septic shock — broad cover).' : '• IV Piperacillin-tazobactam 4.5g TDS — empirical sepsis cover.' },
      hfOrPe
        ? { step: 3, text: 'Heart-failure signs or suspected PE recorded: no fluid bolus — senior review of fluid strategy (ESC 2021 HF; ESC 2019 PE)', addToPlan: '• No IV fluid bolus: heart-failure signs or suspected PE recorded — senior review of fluid strategy (ESC 2021; ESC 2019).' }
        : { step: 3, text: 'IV fluid bolus 30ml/kg Hartmann\'s (if hypotensive)', addToPlan: hasHypotension ? '• IV fluid resuscitation: 30ml/kg Hartmann\'s bolus — reassess lactate and BP at 30 min.' : '• IV Hartmann\'s 1L over 4h — ensure adequate hydration.' },
      { step: 4, text: 'Sepsis bloods: FBC, CRP, lactate, U&E, LFTs, procalcitonin', addToInvestigations: 'Lactate' },
      { step: 5, text: 'Urine output monitoring — catheterise, target ≥ 0.5ml/kg/h', addToPlan: '• Urinary catheter — strict fluid balance, urine output ≥ 0.5ml/kg/h.' },
    ];
    if (hasHypotension) {
      sepsisActions.push({ step: 6, text: 'Vasopressors if fluid-unresponsive: Noradrenaline — target MAP ≥ 65 mmHg', addToPlan: '• Vasopressors: Noradrenaline 0.01–0.5 mcg/kg/min if MAP < 65 after 30ml/kg fluid.' });
      sepsisActions.push({ step: 7, text: 'HDU/ICU admission — continuous monitoring', addToPlan: '• HDU/ICU admission — continuous BP monitoring, lactate trend.' });
    }
    sepsisActions.push({ step: hasHypotension ? 8 : 6, text: 'Identify source: CT abdomen/pelvis, CXR, urine dipstick, wound review', addToPlan: '• Identify source of infection: CXR + urine dipstick + abdominal CT if no clear focus.' });
    add({
      id: 'sepsis_vitals',
      type: 'safety',
      urgency: hasHypotension ? 'urgent' : 'priority',
      icon: '🌡️',
      finding: `Fever ${temp}°C + HR ${hr} bpm${hasHypotension ? ` + SBP ${sbp} mmHg — septic shock` : ''}`,
      diagnosis: hasHypotension ? 'Septic Shock' : 'Sepsis (SIRS criteria)',
      text: hasHypotension ? 'Septic Shock → Immediate Bundle' : 'Sepsis Criteria → Hour-1 Bundle',
      rationale: hasHypotension
        ? `SBP ${sbp} mmHg + fever ${temp}°C + HR ${hr} bpm — septic shock (Sepsis-3). Organ dysfunction requiring immediate resuscitation and vasopressors if fluid-unresponsive.`
        : `Fever ${temp}°C + tachycardia ${hr} bpm — SIRS/sepsis criteria met. Identify source; begin hour-1 bundle.`,
      actions: sepsisActions,
      followUp: hasHypotension
        ? { label: 'Post-septic shock HDU review', daysFromNow: 1 }
        : { label: 'Sepsis source review + culture results', daysFromNow: 2 },
    });
  }

  // Hypotension without fever → shock workup. Anaphylaxis and a leaking AAA are named first:
  // IM adrenaline (RCUK 2021) and permissive hypotension (ESVS 2024) come before any bolus, and
  // no bolus is offered with heart-failure signs or suspected PE (ESC 2021 HF; ESC 2019 PE).
  // Children: the emergency layer's paediatric prompts apply instead of this adult protocol.
  if (hasHypotension && !hasFeverVital && !paed) {
    const anaphylaxis = recognised('anaphylaxis');
    const aaa = recognised('aaa');
    const shockFirst: ClinicalAction[] = anaphylaxis
      ? [{ step: 1, text: 'Anaphylaxis recognised: IM adrenaline first (RCUK 2021) — see the anaphylaxis prompt', addToPlan: '• Anaphylaxis: IM adrenaline first (RCUK 2021) — fluids only after adrenaline, per the anaphylaxis algorithm.' }]
      : aaa
        ? [{ step: 1, text: 'Suspected ruptured AAA: permissive hypotension — no large fluid bolus while conscious (ESVS 2024)', addToPlan: '• Suspected ruptured AAA: permissive hypotension, blood via major haemorrhage pathway, immediate vascular surgery (ESVS 2024) — no crystalloid bolus.' }]
        : hfOrPe
          ? [{ step: 1, text: 'Heart-failure signs or suspected PE recorded: no fluid bolus — cardiogenic / obstructive shock work-up', addToPlan: '• No IV fluid bolus (heart-failure signs or suspected PE recorded — ESC 2021 HF; ESC 2019 PE); urgent echocardiography and senior review.' }]
          : [{ step: 1, text: 'First exclude anaphylaxis (IM adrenaline) and a leaking AAA (permissive hypotension); then 2 × large-bore IV access with a cautious fluid bolus and reassessment', addToPlan: '• Consider anaphylaxis (IM adrenaline, RCUK 2021) and ruptured AAA (permissive hypotension, ESVS 2024) before fluids. Otherwise: 2 × large-bore IV cannulae, Hartmann\'s 500ml bolus — reassess BP and HR at 15 min.' }];
    add({
      id: 'shock_non_infective',
      type: 'safety',
      urgency: 'urgent',
      icon: '🚨',
      finding: `SBP ${sbp} mmHg — hypotension`,
      diagnosis: anaphylaxis ? 'Anaphylactic (distributive) shock' : aaa ? 'Shock — suspected ruptured AAA' : 'Shock — anaphylactic / haemorrhagic / cardiogenic / obstructive',
      text: `SBP ${sbp} mmHg → Shock Protocol`,
      rationale: `Blood pressure ${sbp}/${dbp ?? '?'} mmHg — hypotension without fever. Differential: anaphylaxis (distributive), haemorrhagic (GI bleed, AAA, ectopic), cardiogenic (MI, tamponade), obstructive (PE, tension pneumothorax).`,
      actions: [
        ...shockFirst,
        { step: 2, text: 'FBC + Group & Screen + Crossmatch 4 units, U&E, troponin, D-dimer, BNP', addToInvestigations: 'Blood Group & Type' },
        { step: 3, text: '12-lead ECG — MI / arrhythmia, right heart strain', addToInvestigations: '12-lead ECG — ST elevation MI, arrhythmia, right heart strain (PE)' },
        { step: 4, text: 'Portable CXR — cardiac silhouette, pulmonary oedema, pneumothorax', addToInvestigations: 'Chest X-ray (portable) — cardiac outline, pulmonary oedema, pneumothorax' },
        { step: 5, text: 'POCUS (point-of-care USS) — cardiac, IVC, pleural, aorta', addToPlan: '• POCUS: cardiac (effusion/tamponade), aorta (AAA — bedside ultrasound of the aorta), IVC collapsibility.' },
        { step: 6, text: 'Urgent cardiology or surgical review per source', addToPlan: '• Contact appropriate specialty immediately: cardiology (MI/tamponade), surgery (haemorrhage/AAA), emergency medicine (PE).' },
      ],
    });
  }

  // Hypoxia: SpO2 < 94% (adult protocol; children: the emergency-layer prompts apply)
  if (hasHypoxia && !paed) {
    const hypoxiaActions: ClinicalAction[] = [
      copd
        ? { step: 1, text: 'COPD / hypercapnic risk: controlled oxygen, target SpO₂ 88–92% (BTS 2017)', addToPlan: '• Controlled oxygen via Venturi mask (24–28%), target SpO₂ 88–92% (BTS 2017 — COPD / hypercapnic risk); arterial blood gas within 1 hour; NIV if pH < 7.35 with raised PaCO₂.' }
        : { step: 1, text: 'Supplemental O₂ — titrate to SpO₂ 94–98% (BTS 2017)', addToPlan: '• Supplemental O₂: titrate to SpO₂ 94–98% (BTS 2017); reassess.' },
      { step: 2, text: 'ABG — type I vs type II failure, pH, pCO₂', addToInvestigations: 'Arterial Blood Gas (ABG)' },
      { step: 3, text: 'CXR — pneumonia, effusion, pneumothorax, pulmonary oedema', addToInvestigations: 'Chest X-ray — consolidation, pneumothorax, effusion, pulmonary oedema' },
      PE_WELLS_ACTION(4),
    ];
    if (spo2 !== null && spo2 < 90) {
      hypoxiaActions.push({ step: 5, text: 'Consider CPAP / NIV / intubation if SpO₂ < 90% or fatigue', addToPlan: '• Escalate: CPAP/NIV if SpO₂ < 90% or increasing respiratory effort — ITU review.' });
    }
    add({
      id: 'hypoxia_vitals',
      type: 'safety',
      urgency: spo2 !== null && spo2 < 90 ? 'urgent' : 'priority',
      icon: '🫁',
      finding: `SpO₂ ${spo2}% — hypoxia`,
      diagnosis: 'Hypoxaemic respiratory failure',
      text: `SpO₂ ${spo2}% → Respiratory Escalation`,
      rationale: `SpO₂ ${spo2}% — below target (${copd ? '88–92% in COPD / hypercapnic risk' : '94–98%'}; BTS 2017). Underlying cause (PE, pneumonia, pneumothorax, LVF, ARDS) must be identified urgently.`,
      actions: hypoxiaActions,
    });
  }

  // Bradycardia < 50 bpm
  if (hasBradycardia) {
    const bradyActions: ClinicalAction[] = [
      { step: 1, text: '12-lead ECG — heart block, junctional, SSS', addToInvestigations: '12-lead ECG — heart block, P-wave morphology, PR interval' },
      { step: 2, text: 'U&E (hyperkalaemia), TFTs (hypothyroidism), digoxin level if applicable', addToInvestigations: 'Urea & Electrolytes (U&E)' },
    ];
    if (hr !== null && hr < 40) {
      bradyActions.push({ step: 3, text: 'Atropine 500mcg IV — if symptomatic (dizziness, syncope, hypotension)', addToPlan: '• Atropine 500mcg IV if symptomatic bradycardia — repeat to max 3mg. Prepare temporary pacing.' });
    }
    bradyActions.push({ step: 4, text: 'Hold beta-blockers, rate-limiting CCBs, digoxin pending review', addToPlan: '• Hold beta-blockers, diltiazem/verapamil, digoxin — pending cardiology review.' });
    bradyActions.push({ step: 5, text: 'Cardiology referral — pacing assessment', addToPlan: '• Urgent cardiology review — temporary or permanent pacing assessment.' });
    add({
      id: 'bradycardia_vitals',
      type: 'safety',
      urgency: hr !== null && hr < 40 ? 'urgent' : 'priority',
      icon: '🫀',
      finding: `HR ${hr} bpm — bradycardia`,
      diagnosis: 'Bradyarrhythmia',
      text: `HR ${hr} bpm → Bradycardia Protocol`,
      rationale: `Heart rate ${hr} bpm — symptomatic bradycardia. Causes: complete heart block, SSS, hypothyroidism, drug toxicity (beta-blocker, digoxin), hyperkalemia.`,
      actions: bradyActions,
    });
  }

  // Hypertensive urgency: SBP ≥ 180
  if (hasHyperBP && !hasHypotension && !recognised('pre_eclampsia') && !recognised('hypertensive_emergency')) {
    const hyperBpActions: ClinicalAction[] = [
      { step: 1, text: 'Exclude end-organ damage: neurological exam, fundoscopy, ECG, troponin', addToPlan: '• Assess for end-organ damage: headache (SAH), visual change (papilloedema), focal neurology (stroke), chest pain (aortic dissection).' },
      { step: 2, text: 'U&E + creatinine (renal crisis), troponin (cardiac), urinalysis', addToInvestigations: 'Urea & Electrolytes (U&E)' },
      { step: 3, text: 'CXR — cardiomegaly, pulmonary oedema, mediastinal widening', addToPlan: '• CXR — mediastinal widening (dissection), pulmonary oedema (LVF).' },
      { step: 4, text: 'Oral antihypertensives: amlodipine 5mg + bisoprolol 2.5mg if not already on treatment', addToPlan: '• Oral antihypertensives: Amlodipine 5mg OD. Aim to reduce SBP by 25% over 24–48h (not acutely — risk of stroke).' },
    ];
    if (sbp !== null && sbp >= 220) {
      hyperBpActions.push({ step: 5, text: 'IV labetalol or GTN if hypertensive emergency (end-organ damage)', addToPlan: '• If hypertensive emergency: IV labetalol 20mg bolus or GTN infusion — target MAP reduction 20–25% over 1h.' });
    }
    hyperBpActions.push({ step: 6, text: 'Defer elective surgery — SBP must be < 180 mmHg pre-operatively', addToPlan: '• Elective surgery deferred — SBP must be controlled < 180/110 mmHg pre-operatively.' });
    add({
      id: 'hypertensive_urgency',
      type: 'safety',
      urgency: sbp !== null && sbp >= 220 ? 'urgent' : 'priority',
      icon: '📈',
      finding: `SBP ${sbp} mmHg — hypertensive urgency`,
      diagnosis: 'Hypertensive urgency / emergency',
      text: `SBP ${sbp} mmHg → Hypertension Management`,
      rationale: `SBP ${sbp} mmHg — hypertensive urgency (≥ 180 mmHg). If end-organ damage present (headache, chest pain, visual change, focal neurology) → hypertensive emergency requiring controlled IV reduction.`,
      actions: hyperBpActions,
    });
  }

  // Tachycardia without fever (HR > 110, no fever) — PE / hypovolaemia / arrhythmia
  if (hasTachyVital && hr !== null && hr > 110 && !hasFeverVital && !paed) {
    add({
      id: 'tachycardia_afebrile',
      type: 'safety',
      urgency: 'priority',
      icon: '💗',
      finding: `HR ${hr} bpm — unexplained tachycardia`,
      diagnosis: 'Tachycardia — PE / hypovolaemia / arrhythmia',
      text: `HR ${hr} bpm → Tachycardia Workup`,
      rationale: `Tachycardia ${hr} bpm without fever — differential: pulmonary embolism, hypovolaemia, pain, anaemia, arrhythmia, thyrotoxicosis. Must not be attributed to pain alone without workup.`,
      actions: [
        { step: 1, text: '12-lead ECG — AF, flutter, SVT, right heart strain (S1Q3T3)', addToInvestigations: '12-lead ECG — arrhythmia (AF, flutter, SVT), right heart strain (PE)' },
        { step: 2, text: 'FBC (anaemia), U&E, TFTs (thyrotoxicosis)', addToInvestigations: 'Full Blood Count (FBC)' },
        PE_WELLS_ACTION(3),
        hfOrPe
          ? { step: 4, text: 'Heart-failure signs or suspected PE recorded: IV fluids withheld — BNP, echocardiography and diuretic review (ESC 2021 HF; ESC 2019 PE)', addToPlan: '• Heart-failure signs or suspected PE recorded: IV fluids withheld — BNP, echocardiography and diuretic review (ESC 2021; ESC 2019).' }
          : { step: 4, text: 'IV fluid challenge if hypovolaemia suspected — 500ml Hartmann\'s', addToPlan: '• IV fluid challenge 500ml if hypovolaemia likely — reassess HR at 30 min.' },
      ],
    });
  }

  // BGL > 15 mmol/L from vitals
  if (bgl !== null && bgl > 15 && !recognised('dka') && !recognised('hhs')) {
    add({
      id: 'hyperglycaemia_vitals',
      type: 'safety',
      urgency: bgl > 20 ? 'urgent' : 'priority',
      icon: '🍬',
      finding: `BGL ${bgl} mmol/L — severe hyperglycaemia`,
      diagnosis: 'DKA / HHS — exclude',
      text: `BGL ${bgl} mmol/L → DKA / HHS Screen`,
      rationale: `Blood glucose ${bgl} mmol/L — DKA (type 1, elevated ketones) or HHS (type 2, extreme hyperglycaemia, no ketones) must be excluded before any operative intervention.`,
      actions: [
        { step: 1, text: 'Ketones — blood or urine (> 3 mmol/L = DKA)', addToPlan: '• Ketones urgently — blood ketones > 3 mmol/L = DKA; urine ketones > 2+ = DKA screen positive.' },
        { step: 2, text: 'ABG — pH (< 7.3 = acidosis = DKA), bicarbonate', addToInvestigations: 'Arterial Blood Gas (ABG)' },
        { step: 3, text: 'U&E — potassium (hypokalaemia in DKA on insulin), sodium', addToInvestigations: 'Urea & Electrolytes (U&E)' },
        { step: 4, text: 'DKA (ketones ≥ 3 + acidosis): fixed-rate insulin 0.1 units/kg/h (JBDS 2023). HHS: 0.9% saline first; insulin only when glucose stops falling, 0.05 units/kg/h (JBDS 2022)', addToPlan: '• If DKA (ketones ≥ 3 mmol/L + pH < 7.3 or bicarbonate < 15): fixed-rate IV insulin 0.1 units/kg/h with potassium replacement (JBDS 2023). If HHS (osmolality ≥ 320, ketones < 3): IV 0.9% sodium chloride first; fixed-rate insulin 0.05 units/kg/h only once glucose stops falling with fluids (JBDS 2022). Monitor K⁺ hourly.' },
        { step: 5, text: 'Defer elective surgery until glucose < 12 mmol/L and ketones < 0.5', addToPlan: '• Defer elective surgery — target glucose 6–10 mmol/L, ketones < 0.5 mmol/L pre-operatively.' },
      ],
    });
  }

  // ── ADDITIONAL LAB CASCADES ─────────────────────────────────────────────────

  // Amylase 300–1000 → mild/moderate pancreatitis
  const amylaseMild = numLab(investigationResults, 'amylase', 'lipase');
  if (amylaseMild !== null && amylaseMild >= 300 && amylaseMild <= 1000) {
    add({
      id: 'pancreatitis_mild',
      type: 'safety',
      urgency: 'priority',
      icon: '🔥',
      finding: `Amylase/lipase ${amylaseMild} U/L — 3–10× upper limit`,
      diagnosis: 'Acute Pancreatitis — mild/moderate',
      text: `Amylase ${amylaseMild} → Pancreatitis Management`,
      rationale: `Amylase/lipase ${amylaseMild} U/L — consistent with mild to moderate acute pancreatitis. Severity stratification at 48h guides escalation.`,
      actions: [
        { step: 1, text: 'NBM + IV Hartmann\'s 150ml/h + analgesia (morphine PRN)', addToPlan: '• NBM, IV Hartmann\'s 150ml/h, paracetamol 1g QDS + morphine 5mg PRN.' },
        { step: 2, text: 'USS abdomen — gallstone aetiology, CBD dilation', addToPlan: '• USS abdomen — biliary aetiology (gallstones, CBD calibre).' },
        { step: 3, text: 'Repeat amylase + CRP at 48h — Glasgow score (≥ 3 = severe)', addToInvestigations: 'CRP' },
        { step: 4, text: 'LFTs — obstructive (ALP/GGT rise) vs alcoholic (AST > ALT × 2)', addToInvestigations: 'Liver Function Tests (LFTs)' },
        { step: 5, text: 'CECT pancreas if no improvement at 48–72h', addToPlan: '• CT pancreas (contrast-enhanced) at 72h if no improvement — necrosis, collections.' },
        { step: 6, text: 'Gallstone pancreatitis: cholecystectomy in the same admission if mild; defer until collections resolve if necrosis / peripancreatic collections (IAP/APA 2013; ACG 2024)', addToPlan: '• Gallstone pancreatitis: laparoscopic cholecystectomy in the same admission if mild; defer until peripancreatic collections have resolved (or at least 6 weeks) if collections or necrosis are present (IAP/APA 2013; ACG 2024).' },
      ],
      followUp: { label: 'Post-pancreatitis cholecystectomy planning', daysFromNow: 21 },
    });
  }

  // Low sodium < 130 → hyponatraemia workup
  const sodium = numLab(investigationResults, 'sodium', 'na+', 'na ');
  if (sodium !== null && sodium < 130) {
    add({
      id: 'hyponatraemia',
      type: 'safety',
      urgency: sodium < 125 ? 'urgent' : 'priority',
      icon: '🧂',
      finding: `Sodium ${sodium} mmol/L — hyponatraemia`,
      diagnosis: 'Hyponatraemia — classify and treat',
      text: `Na⁺ ${sodium} mmol/L → Hyponatraemia Workup`,
      rationale: `Sodium ${sodium} mmol/L — hyponatraemia (< 130 mmol/L). Severity classification (mild 130–134 / moderate 125–129 / profound < 125) guides rate of correction. Rapid correction causes osmotic demyelination.`,
      actions: [
        { step: 1, text: 'Urine sodium + osmolality + serum osmolality — classify aetiology', addToPlan: '• Urine Na (> 20: SIADH/renal loss; < 20: hypovolaemic/oedematous states), urine osmolality, serum osmolality.' },
        { step: 2, text: 'Review medications — diuretics, SSRIs, NSAIDs, carbamazepine (SIADH)', addToPlan: '• Review medications for SIADH causes: diuretics, SSRIs, carbamazepine.' },
        { step: 3, text: 'CXR + CT head if SIADH — exclude malignancy (lung, brain), meningitis', addToPlan: '• Exclude secondary SIADH causes: CXR (lung malignancy), CT head (CNS lesion/meningitis).' },
        { step: 4, text: 'Assess volume status first: hypovolaemic → isotonic 0.9% saline; euvolaemic (SIADH) → fluid restriction; hypervolaemic → treat the cause (European guideline 2014)', addToPlan: '• Assess volume status first (European guideline 2014): hypovolaemic (e.g. high stoma output, vomiting) → IV 0.9% sodium chloride, not fluid restriction; euvolaemic SIADH → restrict fluids; limit the rise to 10 mmol/L in the first 24 h.' },
        { step: 5, text: 'Severe symptoms (seizure, reduced consciousness, vomiting): 150 mL 3% hypertonic saline over 20 min, repeat up to twice (European guideline 2014)', addToPlan: '• Severe symptoms only: 150 mL 3% hypertonic saline IV over 20 minutes, recheck Na⁺, repeat up to twice aiming for a 5 mmol/L rise (European guideline 2014) — HDU / endocrinology.' },
        { step: 6, text: 'Stop thiazides and other causative drugs', addToPlan: '• Stop thiazide / thiazide-like diuretics and review SSRIs, carbamazepine and other causative drugs.' },
        { step: 7, text: 'Defer elective surgery until Na ≥ 130 mmol/L', addToPlan: '• Elective surgery deferred — sodium < 130 mmol/L anaesthetic risk; target ≥ 130 pre-op.' },
      ],
    });
  }

  // Hyperkalaemia > 5.5 → ECG + treatment
  const potassium = numLab(investigationResults, 'potassium', 'k+', ' k ');
  if (potassium !== null && potassium > 5.5) {
    const kActions: ClinicalAction[] = [
      { step: 1, text: '12-lead ECG — peaked T-waves, wide QRS, sine wave (K⁺ > 6.5)', addToInvestigations: '12-lead ECG urgently — peaked T-waves, widened QRS, AV block, sine wave' },
    ];
    if (potassium >= 6.5 || recognised('hyperkalaemia')) {
      // UK Kidney Association 2023: 30 mL of 10% calcium gluconate (or 10 mL of 10% calcium chloride).
      kActions.push({ step: 2, text: 'IV calcium gluconate 10% 30 mL over 5–10 min if ECG changes (UKKA 2023) — cardiac membrane stabilisation', addToPlan: '• If hyperkalaemic ECG changes: IV calcium gluconate 10% 30 mL (or calcium chloride 10% 10 mL) over 5–10 minutes — cardiac membrane protection, does not lower K⁺ (UKKA 2023). Repeat ECG; repeat dose if changes persist.' });
    }
    // UKKA 2023 bands: mild 5.5–5.9 → treat the cause and recheck (no shift therapy); moderate
    // 6.0–6.4 → insulin–glucose; severe ≥ 6.5 → insulin–glucose + nebulised salbutamol adjunct.
    if (potassium >= 6.0 || recognised('hyperkalaemia')) {
      kActions.push({ step: 3, text: 'IV insulin–glucose: 10 units soluble insulin with 25 g glucose (UKKA 2023)', addToPlan: '• IV insulin–glucose: 10 units soluble insulin with 25 g glucose — shift K⁺ intracellularly; monitor capillary glucose for hypoglycaemia (UKKA 2023).' });
    } else {
      kActions.push({ step: 3, text: 'Mild hyperkalaemia (K⁺ 5.5–5.9, UKKA 2023): treat the cause and repeat K⁺ (exclude a haemolysed sample); no potassium-shifting treatment below 6.0', addToPlan: '• Mild hyperkalaemia (K⁺ 5.5–5.9 mmol/L — UKKA 2023): treat the cause, stop contributing drugs, repeat K⁺ (exclude haemolysis); shifting treatment is for K⁺ ≥ 6.0 mmol/L.' });
    }
    if (potassium >= 6.5 || recognised('hyperkalaemia')) {
      kActions.push({ step: 4, text: 'Salbutamol 10–20mg nebulised — adjunct (if no cardiac disease)', addToPlan: '• Nebulised salbutamol 10–20mg — adjunct K⁺ shift (additive to insulin–glucose; UKKA 2023).' });
    }
    kActions.push({ step: 5, text: 'Identify cause: AKI, ACE-I, spironolactone, haemolysis, rhabdomyolysis', addToPlan: '• Identify and treat cause: hold ACE-I/ARBs/spironolactone; assess for AKI, rhabdomyolysis.' });
    kActions.push({ step: 6, text: 'Defer ALL surgery until K⁺ < 5.5 mmol/L', addToPlan: '• Surgery DEFERRED — K⁺ must be < 5.5 mmol/L before any general or regional anaesthesia.' });
    add({
      id: 'hyperkalaemia',
      type: 'safety',
      urgency: potassium > 6.5 ? 'urgent' : 'priority',
      icon: '⚡',
      finding: `Potassium ${potassium} mmol/L — hyperkalaemia`,
      diagnosis: 'Hyperkalaemia — cardiac arrest risk',
      text: `K⁺ ${potassium} mmol/L → Hyperkalaemia Protocol`,
      rationale: `Potassium ${potassium} mmol/L — hyperkalaemia. K⁺ > 6.5 mmol/L: cardiac arrest risk from ventricular fibrillation. Must be treated before any surgery.`,
      actions: kActions,
    });
  }

  // Low albumin < 30 → malnutrition / hepatic / nephrotic
  const albumin = numLab(investigationResults, 'albumin');
  if (albumin !== null && albumin < 30) {
    add({
      id: 'hypoalbuminaemia',
      type: 'safety',
      urgency: 'priority',
      icon: '🥗',
      finding: `Albumin ${albumin} g/L — hypoalbuminaemia`,
      diagnosis: 'Malnutrition / hepatic / nephrotic syndrome',
      text: `Albumin ${albumin} g/L → Nutritional and Surgical Risk`,
      rationale: `Albumin ${albumin} g/L (normal 35–50 g/L) — marker of malnutrition, hepatic synthetic failure, or protein-losing nephropathy. Associated with 5× increased post-operative complication risk.`,
      actions: [
        { step: 1, text: 'LFTs + PT/INR — hepatic synthetic function', addToInvestigations: 'Liver Function Tests (LFTs)' },
        { step: 2, text: 'Urine protein:creatinine ratio — nephrotic syndrome', addToPlan: '• Urine protein:creatinine ratio — nephrotic syndrome (PCR > 300mg/mmol).' },
        { step: 3, text: 'Dietitian referral — pre-operative nutritional optimisation', addToPlan: '• Dietitian referral — pre-operative nutritional support. Delay elective surgery ≥ 4 weeks if possible.' },
        { step: 4, text: 'Pre-operative oral nutritional supplements (ONS) ×2 weeks if elective', addToPlan: '• Prescribe ONS (Ensure/Fortisip) ×2 — pre-op nutritional optimisation (ERAS).' },
        { step: 5, text: 'Consider NG or TPN if severely malnourished and urgent surgery required', addToPlan: '• If albumin < 25 g/L and surgery urgent: parenteral nutrition pre-operatively with nutrition team support.' },
      ],
    });
  }

  // HbA1c > 8.5% → poor DM control — delay elective surgery
  const hba1c = numLab(investigationResults, 'hba1c', 'glycated', 'glycohaemoglobin');
  if (hba1c !== null && hba1c > 8.5) {
    add({
      id: 'poor_dm_control',
      type: 'safety',
      urgency: 'priority',
      icon: '📊',
      finding: `HbA1c ${hba1c}% — poorly controlled diabetes`,
      diagnosis: 'Suboptimal glycaemic control — surgical risk elevated',
      text: `HbA1c ${hba1c}% → Optimise Before Elective Surgery`,
      rationale: `HbA1c ${hba1c}% — above recommended pre-operative threshold (target < 8.5% / 69 mmol/mol). Poorly controlled diabetes doubles surgical infection risk and impairs wound healing.`,
      actions: [
        { step: 1, text: 'Diabetology referral — insulin regimen optimisation', addToPlan: '• Refer diabetology — insulin regimen intensification or OHG escalation.' },
        { step: 2, text: 'Delay elective surgery 4–8 weeks for glycaemic optimisation if possible', addToPlan: '• Delay elective surgery 4–8 weeks — target HbA1c < 8.5% / 69 mmol/mol pre-operatively.' },
        { step: 3, text: 'Pre-operative VRIII protocol if HbA1c > 10%', addToPlan: '• If HbA1c > 10%: pre-operative VRIII on day of surgery — glucose target 6–10 mmol/L intraoperatively.' },
        { step: 4, text: 'Foot exam + urine ACR — DM complication screen', addToPlan: '• Diabetic foot exam + urine ACR — complication screen before anaesthetic.' },
      ],
    });
  }

  // ── SURGICAL PATHWAY CASCADE — OPERATIVE PLANS ────────────────────────────────────────────────
  // Fires when surgery is strongly indicated. addToPlan pre-populates the Plan tab
  // with a complete pre-op / operative steps / post-op block for surgeon to review and edit.

  const hasGallstoneIndication =
    exam(examAbdomen, "murphy", "murphy's") ||
    hasRadResult(radiologyRequests, 'cholecystitis', 'gallstone', 'gallbladder wall', 'pericholecystic') ||
    hasSx(symptoms, 'right upper quadrant', 'biliary colic', 'cholecystitis') ||
    hasCc(ccEntries, 'cholecystitis', 'cholecyst', 'biliary colic', 'gallstone');

  const hasAppendicitisIndication =
    hasRadResult(radiologyRequests, 'appendicitis', 'appendix', '>6mm', 'inflamed') ||
    exam(examAbdomen, 'rovsing', 'mcburney', 'rebound', 'guarding') ||
    hasCc(ccEntries, 'appendic') ||
    hasSx(symptoms, 'appendic');

  const hasHerniaIndication =
    exam(examAbdomen, 'hernia', 'inguinal', 'groin lump', 'umbilical hernia', 'incisional') ||
    hasCc(ccEntries, 'hernia', 'groin lump', 'inguinal', 'umbilical') ||
    hasSx(symptoms, 'hernia', 'groin lump', 'groin swelling');

  // Operative templates fire only when the WORKING DIAGNOSIS supports them — never from signs,
  // words or imaging alone (clinical-validation findings: appendicectomy plans in torsion, TOA,
  // DKA and HELLP; cholecystectomy in HELLP; adult TAPP in a febrile infant).
  const gallDx = dxSupports('cholecyst', 'gallstone', 'biliary colic', 'cholelith', 'gallbladder', 'biliary pain');
  const appendDx = dxSupports('append');
  const herniaDx = dxSupports('hernia');
  const obstructionDx = dxSupports('obstruct', 'volvulus', 'adhesion', 'ileus');
  const obstetricEmergency = recognised('pre_eclampsia') || recognised('ectopic') || recognised('obstetric_trauma');

  // ── Shared operative-template lines (clinical-validation periop findings) ─────────────────
  // Fasting: food up to 6 h and clear fluids up to 2 h (AAGBI 2010; ESA 2011), not an overnight fast.
  const FASTING_LINE = '• Fasting: food up to 6 h and clear fluids up to 2 h before anaesthesia (AAGBI 2010; ESA 2011).';
  // Renal impairment / dialysis: NSAIDs avoided (NICE NG148) and LMWH adjusted (NICE NG89; BNF).
  const egfrLab = numLab(investigationResults, 'egfr');
  const onDialysis = hasPmh(comorbidities, 'dialysis', 'haemodialysis', 'hemodialysis', 'end-stage renal', 'esrf', 'eskd', 'end stage renal');
  const renalImpairment = onDialysis || (egfrLab !== null && egfrLab < 60)
    || hasPmh(comorbidities, 'ckd', 'chronic kidney', 'renal impairment', 'renal failure', 'kidney disease', 'nephropathy', 'renal insufficiency');
  const nsaidReasons = [
    renalImpairment ? 'renal impairment' : null,
    !isNaN(ageNum) && ageNum >= 75 ? 'age ≥ 75' : null,
    hasPmh(comorbidities, 'heart failure', 'cardiac failure') ? 'heart failure' : null,
    hasPmh(comorbidities, 'peptic ulcer', 'gi bleed', 'gastrointestinal bleed', 'upper gi bleed') ? 'peptic ulcer / GI bleeding history' : null,
    onAnticoag ? 'anticoagulant' : null,
  ].filter((x): x is string => x !== null);
  const ANALGESIA_LINE = nsaidReasons.length
    ? `• Paracetamol 1g QDS (regular); NSAIDs avoided (${nsaidReasons.join(', ')} — NICE NG148; BNF).`
    : '• Paracetamol 1g QDS + Ibuprofen 400mg TDS (regular) if renal function is normal.';
  const VTE_LINE = onDialysis
    ? '• VTE prophylaxis (NICE NG89): mechanical prophylaxis; pharmacological prophylaxis dose-adjusted for renal failure — unfractionated heparin or a renally adjusted LMWH on dialysis, per renal team / local protocol (BNF).'
    : renalImpairment
      ? '• VTE prophylaxis (NICE NG89): mechanical prophylaxis + LMWH dose-adjusted for renal function (enoxaparin 20 mg once daily if CrCl < 30 mL/min — BNF).'
      : '• VTE prophylaxis per NICE NG89 risk assessment: mechanical prophylaxis ± LMWH (e.g. enoxaparin 40 mg once daily) unless bleeding risk outweighs it.';

  // Cholecystectomy pathway. Antibiotic prophylaxis only for high-risk laparoscopic cholecystectomy
  // (SIGN 104: acute cholecystitis, jaundice, pregnancy, immunosuppression, …); none after
  // cholecystectomy for TG18 Grade I–II cholecystitis.
  const acuteCholecystitisDx = dxSupports('cholecystitis') && !dxSupports('chronic cholecystitis');
  const lapCholeHighRisk = acuteCholecystitisDx || clinicalJaundice || pregnant || dxSupports('pancreatitis')
    || hasPmh(comorbidities, 'immunosuppress', 'transplant', 'chemotherapy', 'hiv');
  const LAP_CHOLE_PROPHYLAXIS_LINE = lapCholeHighRisk
    ? '• Antibiotic prophylaxis: single dose at induction per the local antimicrobial policy (SIGN 104 high-risk laparoscopic cholecystectomy); check the allergy record.'
    : '• Antibiotic prophylaxis not indicated for low-risk elective laparoscopic cholecystectomy (SIGN 104); a single dose if the operation becomes high-risk (conversion, bile spillage, cholangiography).';
  if (hasGallstoneIndication && gallDx && !obstetricEmergency) {
    add({
      id: 'lap_chole_pathway',
      type: 'safety',
      urgency: hasFever || hasFeverVital ? 'urgent' : 'priority',
      icon: '⚕️',
      finding: 'Cholecystitis / gallstone disease — surgical indication',
      diagnosis: 'Laparoscopic Cholecystectomy',
      text: 'Gallstone Disease → Operative Plan Pre-populated',
      rationale: 'Laparoscopic cholecystectomy is the gold standard for symptomatic cholelithiasis and acute cholecystitis. Early surgery (< 72h from onset) preferred over delayed interval if fit.',
      actions: [
        { step: 1, text: 'USS RUQ — confirm diagnosis, wall thickness, CBD dilation', addToPlan: '• USS RUQ — gallbladder wall thickness (> 4mm), pericholecystic fluid, stones, CBD diameter.' },
        { step: 2, text: 'FBC, CRP, LFTs, amylase — severity stratification', addToInvestigations: 'Full Blood Count (FBC)' },
        { step: 3, text: 'Pre-op bloods: Group & Screen, U&E, ECG (if ≥ 40)', addToInvestigations: 'Blood Group & Type' },
        { step: 4, text: 'Consent: laparoscopic cholecystectomy — risks and alternatives', addToPlan: '• Consent: laparoscopic cholecystectomy — bile duct injury (0.3%), haemorrhage, conversion to open, bile leak, retained stone, wound infection.' },
        {
          step: 5,
          text: 'Pre-populate operative plan and post-op orders',
          addToPlan: `LAPAROSCOPIC CHOLECYSTECTOMY — OPERATIVE PLAN
─────────────────────────────────────────────
PRE-OPERATIVE:
${FASTING_LINE}
${LAP_CHOLE_PROPHYLAXIS_LINE}
${VTE_LINE}
• IV access; identify allergy status.
• Consent signed and documented.

ANAESTHESIA: General anaesthesia + neuromuscular blockade.
POSITION: Supine, arms out, reverse Trendelenburg + right-side-up tilt.
SURGEON: Dr Dawit Daniel Kabiye MD DM.

OPERATIVE STEPS:
1. Hassan technique (or Veress needle) → 12mm umbilical port → CO₂ insufflation to 12mmHg.
2. 5mm epigastric port (subxiphoid), 5mm right anterior axillary, 5mm right mid-clavicular ports.
3. Inspect abdomen — adhesions, gallbladder distension, anatomy.
4. Grasp fundus → retract cephalad and laterally. Grasp Hartmann's pouch.
5. Dissect Calot's triangle — peritoneum over anterior and posterior aspects.
6. Achieve Critical View of Safety (CVS): two structures entering gallbladder base, lower third of gallbladder cleared of fat/peritoneum. [DOCUMENT CVS before clipping.]
7. Clip-clip-cut cystic artery → clip-clip-cut cystic duct.
8. On-table cholangiogram if: CBD dilated, LFTs raised, clinical indication. [or: Not performed — anatomy clear.]
9. Retrograde cholecystectomy — diathermy dissection off liver bed. Control bleeding points.
10. Place gallbladder in retrieval bag → extract via umbilical port.
11. Inspect gallbladder bed and Calot's triangle — haemostasis confirmed, no bile leak.
12. No drain placed (routine). [or: RUQ drain if complicated / bile spillage.]
13. Desufflate. Port closure: umbilical fascia 2/0 Vicryl; all wounds 4/0 Monocryl subcuticular; Steri-Strips.

INTRAOPERATIVE FINDINGS: [dictate findings here]
EBL: [X] ml. Specimen: gallbladder to histopathology. Swab count correct × 2.

POST-OPERATIVE ORDERS:
${ANALGESIA_LINE}
• Morphine 2.5–5mg SC/IV PRN for pain > 5/10.
• Free fluids at 2h post-op; light diet same evening if tolerating fluids.${acuteCholecystitisDx ? '\n• Post-operative antibiotics are not needed after cholecystectomy for TG18 Grade I–II acute cholecystitis; continue only for complicated disease (gangrene, perforation, abscess) (TG18).' : ''}
• Remove IV cannula when tolerating PO.
• Discharge criteria: pain controlled on oral analgesia, tolerating diet, mobile.
• Wound review at 7 days (GP or nurse-led).
• Outpatient review 6 weeks post-op — histology, diet tolerance, return to activity.
• Return to normal activity in 2 weeks; heavy lifting avoid for 4 weeks.
• Low-fat diet initially; normal diet expected by 4–6 weeks.`,
        },
      ],
      followUp: { label: 'Post-cholecystectomy review + histology', daysFromNow: 42 },
    });
  }

  // Appendicectomy pathway
  if (hasAppendicitisIndication && appendDx && !obstetricEmergency) {
    add({
      id: 'appendicectomy_pathway',
      type: 'safety',
      urgency: 'urgent',
      icon: '⚕️',
      finding: 'Appendicitis — emergency surgical indication',
      diagnosis: 'Emergency Laparoscopic Appendicectomy',
      text: 'Appendicitis → Emergency Operative Plan',
      rationale: 'Acute appendicitis — emergency laparoscopic appendicectomy is indicated. Perforation rate increases 5% per 12h delay beyond 24h of symptoms.',
      actions: [
        { step: 1, text: 'Alvarado score — document all 8 criteria', addToPlan: '• Alvarado score: migration of pain (1), anorexia (1), nausea (1), RIF tenderness (2), rebound (1), elevated temp > 37.3 (1), leucocytosis (2), left shift (1). Score ≥ 7 = highly likely appendicitis.' },
        { step: 2, text: 'FBC + CRP + Group & Screen pre-op', addToInvestigations: 'Blood Group & Type' },
        { step: 3, text: 'IV Piperacillin-tazobactam 4.5g + Metronidazole 500mg at induction', addToPlan: '• IV Pip-Tazo 4.5g + Metronidazole 500mg — antibiotic prophylaxis at induction.' },
        { step: 4, text: 'β-HCG if female of reproductive age', addToInvestigations: isReproductiveAgeFemale ? 'Urine Pregnancy Test (F)' : undefined },
        {
          step: 5,
          text: 'Pre-populate emergency appendicectomy plan',
          addToPlan: `LAPAROSCOPIC APPENDICECTOMY — OPERATIVE PLAN
─────────────────────────────────────────────
PRE-OPERATIVE:
• NBM — emergency case, starved status documented.
• IV Pip-Tazo 4.5g + Metronidazole 500mg at induction.
• LMWH + TED stockings (DVT prophylaxis).
• Consent obtained (emergency consent if incapacitated): perforation risk, conversion to open, wound infection, right-sided port-site hernia, stump leak (< 1%), Hartmann's pouch if appendix not identifiable.
• β-HCG confirmed negative (female of reproductive age).
• Group & Screen available; cross-match if perforated or unstable.

ANAESTHESIA: General anaesthesia + endotracheal intubation. OGT / NG decompression if ileus.
POSITION: Supine, Trendelenburg + left lateral tilt (pelvis access). Arms tucked.
SURGEON: Dr Dawit Daniel Kabiye MD DM.

OPERATIVE STEPS:
1. 12mm umbilical Hassan port → CO₂ to 12mmHg.
2. 5mm suprapubic midline port. 5mm left iliac fossa port (operating port).
3. Systematic inspection: peritoneal soiling grade, caecum, appendix, terminal ileum (Meckel's), pelvis (female: ovary, fallopian tube).
4. Appendix identification — grasp mesoappendix, expose base at caecum.
5. Mesoappendix: LigaSure / harmonic sealing and division (or clips and scissors).
6. Appendix base: two Endoloops proximal (tied firmly), one Endoloop distal → divide appendix between.
7. Specimen in bag — extract via umbilical port. Send to histopathology.
8. Peritoneal lavage if perforated or faecal contamination: warm 0.9% NaCl 1–2L; irrigate RIF + pelvis; suction dry.
9. Drain: RIF closed suction drain (Blake/JP) if perforated — remove day 2 if < 30ml.
10. Port-site closure: umbilical fascia 2/0 Vicryl; all wounds 4/0 Monocryl subcuticular.

INTRAOPERATIVE FINDINGS: Appendix [inflamed/perforated/gangrenous/normal] at [position]. Soiling: [localised/generalised]. [Other findings].
EBL: [X] ml. Swab count correct × 2.

POST-OPERATIVE ORDERS:
• Uncomplicated appendicitis: no post-operative antibiotics after appendicectomy (WSES 2020).
• Complicated appendicitis (perforation, gangrene, abscess): IV Pip-Tazo 4.5g TDS for 3–5 days after adequate source control (maximum 7), switch to oral when tolerating PO (WSES 2020; STOP-IT).
${ANALGESIA_LINE}
• Morphine 5mg PRN if pain > 5/10.
• Regular diet as tolerated (day 1 if simple; day 2–3 if perforated).
• Mobilise day 1 — physiotherapy if perforated.
• Wound review 10–14 days.
• Outpatient review 4 weeks — histology result, recovery assessment.
• Return to work: sedentary 1 week; manual 4 weeks.`,
        },
      ],
      followUp: { label: 'Post-appendicectomy wound review + histology', daysFromNow: 14 },
    });
  }

  // Paediatric hernia: paediatric surgery (herniotomy, no mesh), never the adult template (A22).
  if (hasHerniaIndication && herniaDx && paed) {
    add({
      id: 'hernia_paediatric',
      type: 'safety',
      urgency: 'priority',
      icon: '⚕️',
      finding: 'Hernia in a child',
      diagnosis: 'Paediatric hernia — paediatric surgery',
      text: 'Paediatric hernia → paediatric surgical referral',
      rationale: 'Inguinal hernia in infants and children is repaired by herniotomy (no mesh) by a paediatric surgeon; infants are repaired promptly because of the incarceration risk. Adult mesh repair templates, trusses and watchful waiting do not apply (BAPS).',
      actions: [
        { step: 1, text: 'Refer to paediatric surgery for herniotomy (no mesh); expedite in infants', addToPlan: '• Paediatric surgery referral for inguinal herniotomy (no mesh; not an adult repair template) — expedited in infants because of incarceration risk.' },
        { step: 2, text: 'Safety-net: irreducible, tender or discoloured lump or vomiting → emergency', addToPlan: `• Safety-net: an irreducible, tender or discoloured lump, or vomiting — ${EMERGENCY_REDIRECT}` },
      ],
    });
  }

  // Inguinal / groin hernia → repair pathway (adults, hernia working diagnosis)
  if (hasHerniaIndication && herniaDx && !paed) {
    // "Tender" alone (e.g. suprapubic tenderness) no longer makes a hernia incarcerated.
    const isIncarcerated = exam(examAbdomen, 'irreducible', 'incarcerat', 'strangulat')
      || hasCc(ccEntries, 'irreducible', 'incarcerat', 'strangulat', 'obstructed')
      || dxSupports('irreducible', 'incarcerat', 'strangulat', 'obstructed hernia', 'with obstruction');
    const strangulationSuspected = isIncarcerated && (exam(examAbdomen, 'tender', 'erythem', 'discolour', 'strangulat', 'skin changes')
      || dxSupports('strangulat', 'gangren') || hasSx(symptoms, 'vomiting'));
    const herniaPreOpActions: ClinicalAction[] = isIncarcerated
      ? [
          strangulationSuspected
            ? { step: 1, text: 'Do not attempt manual reduction — strangulation suspected (WSES 2017)', addToPlan: '• Do not attempt manual reduction when strangulation is suspected (WSES 2017): emergency repair with assessment of bowel viability.' }
            : { step: 1, text: 'Incarcerated hernia with no signs of strangulation: gentle reduction only by a senior surgeon; admit and observe (WSES 2017)', addToPlan: '• Incarcerated hernia with no signs of strangulation: gentle reduction may be attempted by a senior surgeon — never forced; admit and observe; urgent repair (WSES 2017).' },
          { step: 2, text: 'Emergency Theatre — irreducible / strangulated hernia', addToPlan: '• Emergency Theatre: irreducible / strangulated hernia — bowel resection risk, consent accordingly.' },
        ]
      : [
          { step: 1, text: 'Confirm hernia type: inguinal (direct vs indirect), femoral, umbilical, incisional', addToPlan: '• Document: side, type (inguinal direct/indirect/femoral), reducibility, skin changes, scrotal extension.' },
          { step: 2, text: 'Pre-op: FBC, Group & Screen; ECG per NICE NG45', addToInvestigations: 'Full Blood Count (FBC)' },
        ];
    // The operative template follows the hernia site: a ventral (umbilical / paraumbilical /
    // epigastric / incisional / parastomal) hernia is not repaired with the inguinal TAPP plan
    // (EHS/AHS 2020 umbilical and epigastric hernia guideline; EHS 2014 incisional hernia).
    const herniaSiteText = [dxHead, ...ccEntries.map(e => e.complaint), examAbdomen].join('\n');
    const groinHernia = containsAnyAffirmed(herniaSiteText, ['inguinal', 'femoral', 'groin', 'scrotal']);
    const ventralHernia = !containsAnyAffirmed(dxHead, ['inguinal', 'femoral', 'groin'])
      && containsAnyAffirmed(herniaSiteText, ['umbilical', 'paraumbilical', 'para-umbilical', 'epigastric', 'ventral', 'incisional', 'parastomal', 'spigelian', 'linea alba']);
    // Cirrhosis with ascites: ascites control first, inpatient repair, never day-case (EHS/AHS 2020).
    const cirrhosisAscites = hasPmh(comorbidities, 'cirrhosis', 'ascites', 'portal hypertension', 'liver failure')
      || containsAnyAffirmed([dxHead, examAbdomen].join('\n'), ['ascites', 'cirrhosis']);
    const HERNIA_PROPHYLAXIS_LINE = isIncarcerated
      ? '• Antibiotic prophylaxis: single dose at induction per the local antimicrobial policy (emergency repair; possible contamination); check the allergy record.'
      : '• Antibiotic prophylaxis: not routinely recommended for elective mesh repair in average-risk patients (HerniaSurge 2018); a single dose for high-risk patients per local policy.';
    const CIRRHOSIS_LINE = '• Cirrhosis / ascites: hepatology optimisation first — control ascites (diuretics, paracentesis; consider TIPS), correct coagulopathy; repair as an inpatient (planned admission); urgent repair if the skin is thinning, ulcerated or leaking, or the hernia incarcerates (EHS/AHS 2020).';
    const DISCHARGE_LINE = cirrhosisAscites
      ? '• Inpatient post-operative care (cirrhosis / ascites): monitor for ascitic leak, wound breakdown, encephalopathy and renal function; drain ascites as planned with hepatology.'
      : '• Day-case discharge: pain controlled on oral analgesia, tolerating oral fluids, voiding.';
    const herniaTemplateAction: ClinicalAction = ventralHernia && !groinHernia
      ? {
          step: 4,
          text: 'Pre-populate ventral (umbilical / incisional) hernia operative plan',
          addToPlan: `${isIncarcerated ? 'EMERGENCY ' : ''}VENTRAL (UMBILICAL / PARAUMBILICAL / INCISIONAL) HERNIA REPAIR — OPERATIVE PLAN
─────────────────────────────────────────────────────────────
PRE-OPERATIVE:
${cirrhosisAscites ? `${CIRRHOSIS_LINE}\n` : ''}${FASTING_LINE}
${HERNIA_PROPHYLAXIS_LINE}
${VTE_LINE}
• Smoking cessation and weight optimisation before elective repair where possible.

REPAIR (EHS/AHS 2020; EHS 2014):
• Umbilical / epigastric defect ≥ 1 cm: mesh repair (preperitoneal or retromuscular flat mesh); defect < 1 cm: suture repair may be considered.
• Incisional hernia: mesh repair (retromuscular / sublay preferred); laparoscopic IPOM as an alternative.
• Emergency / contaminated field: assess bowel viability; resect if non-viable; mesh use per contamination.

INTRAOPERATIVE FINDINGS: Defect size [cm], contents [omentum/bowel], bowel viable [yes/no]. Mesh: [type/size/position].
EBL: [X] ml. Swab count correct × 2.

POST-OPERATIVE ORDERS:
${ANALGESIA_LINE}
• Morphine 5mg PRN if pain > 5/10.
${DISCHARGE_LINE}
• Activity: walking from day 1; avoid heavy lifting for 4 weeks.
• Wound review at 10 days; outpatient review 6 weeks — recurrence, seroma, mesh complications.`,
        }
      : {
          step: 4,
          text: 'Pre-populate TAPP operative plan',
          addToPlan: `${isIncarcerated ? 'EMERGENCY ' : ''}LAPAROSCOPIC INGUINAL HERNIA REPAIR (TAPP) — OPERATIVE PLAN
─────────────────────────────────────────────────────────────
PRE-OPERATIVE:
${cirrhosisAscites ? `${CIRRHOSIS_LINE}\n` : ''}${FASTING_LINE} Consent signed.
${HERNIA_PROPHYLAXIS_LINE}
${VTE_LINE}
• Urinary catheter for bilateral or complex repairs (optional for unilateral).

ANAESTHESIA: General anaesthesia. Spinal ± sedation for high anaesthetic risk (Lichtenstein alternative).
POSITION: Supine, Trendelenburg. Arms tucked.
SURGEON: Dr Dawit Daniel Kabiye MD DM.

OPERATIVE STEPS (TAPP):
1. 12mm umbilical port → CO₂ to 12mmHg. 5mm bilateral iliac fossa ports.
2. Inspect: hernia site, bowel viability (strangulated cases — resect if non-viable).
3. Open peritoneum: transverse incision 2cm above hernia defect, medial to ASIS to pubic symphysis.
4. Develop preperitoneal space (Retzius + Bogros spaces): blunt dissection.
5. Identify anatomical landmarks: iliopubic tract, Cooper's ligament, inferior epigastric vessels, spermatic cord, vas deferens, gonadal vessels.
6. Reduce hernia sac: direct (invert peritoneum); indirect (dissect sac off cord structures — avoid vas and vessels).
7. Ensure adequate space for mesh (≥ 15×10cm) — medial to pubic symphysis, lateral past ASIS.
8. Mesh: 15×10cm lightweight polypropylene — lay flat, cover direct + indirect + femoral spaces. No wrinkles.
9. Tack fixation (optional): Cooper's ligament and lateral abdominal wall. [AVOID triangle of pain (lateral to iliopubic tract) and triangle of doom (medial cord structures).]
10. Peritoneal closure: running 2/0 Vicryl — completely cover mesh.
11. Port closure: umbilical fascia 2/0 Vicryl; wounds 4/0 Monocryl subcuticular.

INTRAOPERATIVE FINDINGS: [Side] inguinal hernia — [direct/indirect/combined]. Sac: [lipoma/bowel/omentum]. Bowel viable: [yes/no]. [Other findings].
EBL: [X] ml. Mesh: [brand/size]. Swab count correct × 2.

POST-OPERATIVE ORDERS:
${ANALGESIA_LINE}
• Morphine 5mg PRN if pain > 5/10.
• Scrotal support 48h if male (reduces haematoma).
• Ice pack to groin PRN × 24h.
${DISCHARGE_LINE}
• Activity: walking from day 1; avoid heavy lifting (> 10kg) for 4 weeks; driving after 1–2 weeks (when emergency stop possible).
• Wound review at 10 days.
• Outpatient review 6 weeks — check for recurrence, chronic pain, mesh complications.`,
        };
    const herniaConsentLine = ventralHernia && !groinHernia
      ? '• Consent: ventral hernia repair — recurrence, seroma, wound infection, mesh infection, bowel injury, chronic pain.'
      : '• Consent: hernia repair — recurrence (1–2% TAPP), chronic groin pain (5%), mesh infection (< 1%), testicular ischaemia/vas injury (< 1%), haematoma.';
    add({
      id: 'hernia_repair_pathway',
      type: 'safety',
      urgency: isIncarcerated ? 'urgent' : 'priority',
      icon: '⚕️',
      finding: isIncarcerated ? 'Incarcerated / strangulated hernia' : 'Hernia — elective repair indicated',
      diagnosis: 'Hernia Repair',
      text: isIncarcerated ? 'Strangulated Hernia → Emergency Repair' : 'Hernia → Elective Repair Plan',
      rationale: isIncarcerated
        ? 'Irreducible tender hernia — strangulation risk. Emergency operative repair required without delay; bowel viability must be assessed.'
        : ventralHernia && !groinHernia
          ? 'Symptomatic ventral (umbilical / incisional) hernia — mesh repair for defects ≥ 1 cm (EHS/AHS 2020).'
          : 'Symptomatic inguinal/groin hernia — laparoscopic TAPP repair is preferred (bilateral disease, recurrence, bilateral, active patients). Lichtenstein for high anaesthetic risk.',
      actions: [
        ...herniaPreOpActions,
        { step: 3, text: 'Consent — recurrence, chronic pain, mesh, cord/nerve injury, contralateral risk', addToPlan: herniaConsentLine },
        herniaTemplateAction,
      ],
      followUp: { label: 'Post-hernia repair review', daysFromNow: 42 },
    });
  }

  // Bowel obstruction → management cascade
  const hasBowelObstruction =
    (exam(examAbdomen, 'distend', 'distension', 'tympan', 'hyperactive', 'absent bowel sounds') &&
     (hasSx(symptoms, 'vomiting', 'abdominal pain', 'constipation', 'obstipation') ||
      hasCc(ccEntries, 'obstruct', 'bowel obstruct', 'distension'))) ||
    hasRadResult(radiologyRequests, 'small bowel obstruction', 'sbo', 'large bowel obstruction', 'lbo', 'dilated bowel', 'transition point');

  // Malignant large-bowel obstruction: the colonic stent (SEMS) option depends on the side of the
  // tumour and on its contraindications (WSES 2018 obstructing colon cancer; ESGE 2020 colonic
  // stenting). A stent is not offered with perforation, peritonitis, caecal ischaemia /
  // pneumatosis, a closed loop or a caecum ≥ 12 cm (impending perforation), and not for a right-sided
  // tumour, where right (extended) hemicolectomy with primary anastomosis is the standard.
  const obstructionText = [dxHead, assessment ?? '', ...radiologyRequests.filter(r => r.resultReceived).map(r => r.resultNotes)].join('.\n');
  const TUMOUR = '(?:tumou?r|cancer|carcinoma|malignan\\w*|mass|lesion|stricture)';
  const RIGHT_SITE = '(?:caecum|caecal|cecum|cecal|ascending colon|hepatic flexure|right colon|right[- ]sided colon|right hemicolon)';
  const rightSidedTumour = containsAnyAffirmed(obstructionText, [
    new RegExp(`\\b${TUMOUR}\\s+(?:at|of|in|involving|arising (?:at|in|from))\\s+(?:the\\s+)?${RIGHT_SITE}\\b`),
    new RegExp(`\\b${RIGHT_SITE}\\b[^.;\\n]{0,20}\\b${TUMOUR}\\b`),
  ]);
  const caecumCm = (() => {
    const m = /\b(?:caecum|caecal|cecum|cecal)\b[^.;\n]{0,25}?(\d{1,2}(?:\.\d)?)\s*cm\b/i.exec(obstructionText);
    return m ? parseFloat(m[1]) : null;
  })();
  const stentContraindications: string[] = [];
  if (containsAnyAffirmed(obstructionText + '\n' + examAbdomen, ['perforat', 'free gas', 'pneumoperitoneum', 'free air'])) stentContraindications.push('perforation or impending perforation');
  if (containsAnyAffirmed(examAbdomen, ['peritonitis', 'peritonism', 'rebound', 'guarding']) || containsAnyAffirmed(obstructionText, ['peritonitis'])) stentContraindications.push('peritonitis / peritonism');
  if (containsAnyAffirmed(obstructionText, ['pneumatosis', 'ischaem', 'ischem', 'gangren', 'non-viable'])) stentContraindications.push('caecal / colonic ischaemia or pneumatosis');
  if (containsAnyAffirmed(obstructionText, ['closed loop', 'closed-loop'])) stentContraindications.push('closed-loop obstruction');
  if (caecumCm !== null && caecumCm >= 12) stentContraindications.push(`caecum ${caecumCm} cm`);
  const malignantLbo = containsAnyAffirmed(obstructionText, [/\b(colonic|colorectal|colon|sigmoid|rectal|rectosigmoid|caecal|splenic flexure|descending colon|hepatic flexure)\b[^.;\n]{0,15}\b(cancer|carcinoma|tumou?r|malignan\w*)\b/, /\b(cancer|carcinoma|tumou?r)\b[^.;\n]{0,30}\b(colon|sigmoid|rectum|rectosigmoid|flexure|caecum)\b/, 'malignant large bowel obstruction', 'malignant lbo']);
  const lboRecorded = containsAnyAffirmed(obstructionText, ['large bowel obstruction', /\blbo\b/, 'colonic obstruction', 'obstructing colon', 'obstructing sigmoid', 'obstructing rectal']);
  let lboCancerStep: ClinicalAction | null = null;
  if (malignantLbo && stentContraindications.length > 0) {
    lboCancerStep = { step: 5, text: `Colonic stent contraindicated (${stentContraindications.join(', ')}) — emergency surgery (WSES 2018; ESGE 2020)`, addToPlan: `• Colonic stenting is contraindicated (${stentContraindications.join(', ')}): emergency surgery — resection (subtotal colectomy when the caecum is ischaemic or perforating) after resuscitation and antibiotics (WSES 2018; ESGE 2020).` };
  } else if (malignantLbo && rightSidedTumour) {
    lboCancerStep = { step: 5, text: 'Right-sided obstructing colon cancer: right (extended) hemicolectomy with primary anastomosis if stable (WSES 2018)', addToPlan: '• Right-sided obstructing colon cancer: right (extended) hemicolectomy with primary ileocolic anastomosis if the patient is stable; ileostomy if unstable or contaminated. Stenting is not routinely recommended for right-sided lesions (WSES 2018).' };
  } else if (malignantLbo) {
    lboCancerStep = { step: 5, text: 'Left-sided obstructing colon cancer: stent as a bridge to surgery or emergency resection (MDT; WSES 2018; ESGE 2020)', addToPlan: '• Left-sided obstructing colon cancer without perforation, peritonitis, ischaemia or a closed loop: colonic stent as a bridge to elective resection (selected patients, MDT), or emergency resection / Hartmann\'s procedure (WSES 2018; ESGE 2020).' };
  } else if (lboRecorded) {
    lboCancerStep = { step: 5, text: 'If the cause is a colonic cancer: stent vs resection by side and contraindications (WSES 2018)', addToPlan: '• If the large-bowel obstruction is due to a left-sided colonic cancer with no perforation, peritonitis, ischaemia or closed loop: colonic stent as a bridge to elective resection, or emergency resection (WSES 2018; ESGE 2020). Right-sided cancer: right hemicolectomy.' };
  }

  if (hasBowelObstruction && (obstructionDx || herniaDx) && !paed) {
    add({
      id: 'bowel_obstruction_pathway',
      type: 'safety',
      urgency: 'urgent',
      icon: '🚨',
      finding: 'Bowel obstruction — clinical or imaging evidence',
      diagnosis: 'Small / Large Bowel Obstruction',
      text: 'Bowel Obstruction → Conservative Trial / Operative Plan',
      rationale: 'Bowel obstruction — initial conservative management (NGT decompression, IV fluids, NBM, serial exams). Urgent surgery if: vascular compromise, closed-loop obstruction, failure to resolve at 48–72h.',
      actions: [
        { step: 1, text: 'NG tube (Ryle\'s) — nasogastric decompression, free drainage', addToPlan: '• NG tube (16Fr): free drainage + 4-hourly aspiration. Document aspirate volume and character.' },
        { step: 2, text: 'IV Hartmann\'s 1L over 4h + strict fluid balance + IDC', addToPlan: '• IV Hartmann\'s 1–2L + IDC — fluid balance, electrolyte replacement (check K⁺ daily).' },
        { step: 3, text: 'AXR + CT abdomen/pelvis (contrast) — level, transition point, viability', addToPlan: '• CT abdomen/pelvis with IV contrast — level (SBO/LBO), transition point, closed loop, ischaemia (pneumatosis).' },
        { step: 4, text: 'FBC, CRP, U&E, lactate — ischaemia markers', addToInvestigations: 'Lactate' },
        ...(lboCancerStep ? [lboCancerStep] : []),
        {
          step: 6,
          text: 'Operative plan if surgical indication (ischaemia / failure to resolve)',
          addToPlan: `BOWEL OBSTRUCTION — OPERATIVE PLAN (if conservative fails or signs of ischaemia)
─────────────────────────────────────────────────────────────────────────────────
INDICATIONS FOR SURGERY:
• Signs of bowel ischaemia (peritonism, lactate rising, pneumatosis on CT)
• Closed-loop obstruction on CT
• Complete SBO failing conservative management > 48h
• Strangulating hernia as cause

PRE-OPERATIVE:
• Resuscitate: IV fluids, NG drainage, IDC, electrolyte correction.
• Group & Crossmatch 2–4 units, FBC, coagulation.
• Broad-spectrum antibiotics: Pip-Tazo 4.5g + Metronidazole 500mg IV.
• ICU/HDU notification.
• Consent: laparotomy or laparoscopic adhesiolysis, possible bowel resection, possible stoma, ICU post-op.

ANAESTHESIA: GA + endotracheal intubation. NG in situ.
POSITION: Supine. Arms out.

OPERATIVE STEPS:
1. Midline laparotomy — xiphoid to pubis (or laparoscopic if adhesions likely manageable).
2. Systematic abdominal survey — identify dilated vs collapsed bowel, transition point.
3. Cause identification: adhesional band, hernia, volvulus, malignancy.
4. Adhesiolysis — sharp division of obstructing band; enter correct tissue planes.
5. Assess bowel viability: colour, peristalsis, Doppler signal. Warm pack × 5 min if borderline.
6. Bowel resection if non-viable: resect with adequate margins. Primary anastomosis vs defunctioning stoma based on: contamination, patient stability, nutritional state.
7. If volvulus: de-tort + assess viability; resect if necrotic.
8. Thorough lavage if contaminated.
9. Fascial closure: looped mass PDS (Jenkins rule). Skin: primary if clean; delayed (day 3–5) if contaminated.

POST-OPERATIVE ORDERS:
• ICU/HDU — strict fluid balance, vasopressors if required.
• IV Pip-Tazo + Metronidazole × 5 days.
• NG tube until bowel sounds return / passing flatus.
• DVT prophylaxis: LMWH from day 1 post-op.
• Nutrition: NG feeding early if prolonged ileus likely; TPN if unable to feed enterally.
• Second-look laparotomy 48h if bowel viability marginal.`,
        },
      ],
      followUp: { label: 'Post-bowel obstruction review', daysFromNow: 7 },
    });
  }

  // Thyroidectomy pathway — Bethesda V / VI or confirmed thyroid malignancy only. Bethesda I–IV
  // are managed by repeat FNA, surveillance or diagnostic lobectomy, not a total-thyroidectomy
  // template (A8; BTA 2014, ATA 2015). A nodule on examination alone no longer fires it.
  const thyroidMalignantTerms: Array<string | RegExp> = [/\bbethesda (category |class )?(v|vi|5|6)\b/, 'papillary carcinoma', 'papillary thyroid', 'thyroid cancer', 'thyroid carcinoma', 'medullary carcinoma', 'anaplastic', 'follicular carcinoma'];
  const thyroidMalignant = radiologyRequests.some(r => r.resultReceived && containsAnyAffirmed(r.resultNotes, thyroidMalignantTerms))
    || containsAnyAffirmed(dxHead, thyroidMalignantTerms);
  // A compressive (retrosternal / multinodular) goitre is also an indication for thyroidectomy (BTA).
  const compressiveGoitre = dxSupports('goitre', 'goiter') && containsAnyAffirmed([dxHead, historyAll, examGeneral].join('\n'),
    ['compress', 'retrosternal', 'substernal', 'tracheal deviation', 'stridor', 'dysphagia', 'breathless']);
  if ((thyroidMalignant || compressiveGoitre) && !dxSupports('parathyroid')) {
    add({
      id: 'thyroidectomy_pathway',
      type: 'safety',
      urgency: 'priority',
      icon: '🦋',
      finding: 'Thyroid malignancy / Bethesda suspicious cytology',
      diagnosis: 'Total / Hemithyroidectomy',
      text: 'Thyroid Malignancy → Thyroidectomy Plan',
      rationale: 'Bethesda class III–VI or clinical thyroid malignancy — total thyroidectomy (bilateral/malignant) or hemithyroidectomy (Bethesda III/IV unilateral, low-risk) per BAETS/BTA guidelines.',
      actions: [
        { step: 1, text: 'ENT/endocrine surgery referral — staging and operative planning', addToPlan: '• Endocrine surgery referral — total vs hemithyroidectomy decision per Bethesda class and staging.' },
        { step: 2, text: 'Pre-op: USS neck (nodes), TFTs, calcium + PTH, vocal cord assessment (ENT nasal endoscopy)', addToInvestigations: 'Calcium (corrected)' },
        { step: 3, text: 'CT neck/chest if large goitre, substernal extension, or lymphadenopathy', addToPlan: '• CT neck + chest — retrosternal extension, lymphadenopathy staging.' },
        {
          step: 4,
          text: 'Pre-populate thyroidectomy operative plan',
          addToPlan: `TOTAL THYROIDECTOMY — OPERATIVE PLAN
──────────────────────────────────────
PRE-OPERATIVE:
• TFTs normal (euthyroid) pre-operatively — propylthiouracil / carbimazole if thyrotoxic.
• Ca²⁺ + PTH baseline. Vitamin D level — supplement if deficient (reduce post-op hypocalcaemia risk).
• Vocal cord assessment: ENT nasal endoscopy — document cord function pre-op.
• Consent: hypoparathyroidism (transient 10%, permanent 1–2%), recurrent laryngeal nerve (RLN) injury (unilateral 1–2%, bilateral < 0.5%), haemorrhage / haematoma (1%), need for lifelong thyroxine, chyle leak.
• Group & Screen. IV access. IV Dexamethasone 8mg at induction (reduces post-op nausea).
• Intraoperative neuromonitoring (IONM) set-up.

ANAESTHESIA: GA + endotracheal intubation (IONM tube if available).
POSITION: Supine, neck extended (shoulder roll / ring), arms tucked, table tilted 20° reverse Trendelenburg.
SURGEON: Dr Dawit Daniel Kabiye MD DM.

OPERATIVE STEPS:
1. Transverse (Kocher) cervical incision — 2cm below cricoid cartilage, in skin crease, 5–6cm length.
2. Raise subplatysmal flaps — superior to thyroid notch, inferior to sternal notch.
3. Midline fascial incision — split strap muscles vertically (divide sternohyoid/thyrohyoid if needed for exposure).
4. Medial rotation of thyroid lobe — expose lateral surface.
5. Superior pole dissection: identify and preserve superior parathyroid + external branch of SLN (EBSLN). Ligate superior thyroid vessels close to capsule.
6. Identify and preserve RLN: trace from entry into larynx (cricothyroid junction) to inferior thyroid artery crossing. IONM monitoring throughout.
7. Inferior pole: identify inferior parathyroid. Ligate inferior thyroid artery branches lateral to gland (preserve parathyroid blood supply).
8. Parathyroid identification: if inadvertently devascularised — auto-transplant to sternomastoid (mince to 1mm³ fragments × 6–8, place in muscle pocket, mark with clip).
9. Remove lobe + isthmus + contralateral lobe (total) or lobe alone (hemithyroidectomy).
10. Haemostasis: bipolar diathermy; no drain if haemostasis perfect; Blake drain if any concern.
11. Strap muscle repair. Platysma: 3/0 Vicryl continuous. Skin: 4/0 Monocryl subcuticular + Steri-Strips.

INTRAOPERATIVE FINDINGS: [Thyroid size, nodule location, lymph nodes, parathyroid glands identified]. RLN: [intact bilaterally]. Haemostasis: [complete]. Specimen to histopathology.
EBL: [X] ml. Swab count correct × 2.

POST-OPERATIVE ORDERS:
• Monitor calcium at 4h, 24h, and 48h post-op. Parathyroid at 24h.
• Calcium supplementation prophylactic: Calcium Carbonate 1.5g TDS + Alfacalcidol 1mcg OD (total thyroidectomy).
• Chvostek / Trousseau sign monitoring — nurse education.
• If Ca²⁺ < 2.0 mmol/L symptomatic: IV Calcium gluconate 10ml 10% over 10 min.
• Thyroxine: Levothyroxine 1.6mcg/kg/day — start day 1 post-op (total thyroidectomy).
• RLN: dysphonia assessment at 24h — refer ENT if voice change persists > 48h.
• Diet: soft diet day of surgery; normal day 1.
• Drain (if placed): remove < 30ml/shift (day 1–2).
• Wound: no submersion × 2 weeks; Steri-Strips until clinic.
• Outpatient review: 2 weeks (wound, voice, calcium); 6 weeks (TFTs, histology, RAI discussion).`,
        },
      ],
      followUp: { label: 'Thyroid histology + endocrine review', daysFromNow: 14 },
    });
  }

  // Breast cancer — operative plan
  const hasBreastMalignancy =
    hasRadResult(radiologyRequests, 'malignant', 'bi-rads 5', 'bi-rads 4', 'invasive carcinoma', 'ductal carcinoma', 'lobular carcinoma', 'suspicious breast') ||
    (exam(examBreast, 'hard', 'fixed', 'tethering', 'peau') && exam(examBreast, 'mass', 'lump', 'nodule'));

  const breastDx = dxSupports('breast cancer', 'breast carcinoma', 'carcinoma', 'malignan', 'ductal', 'lobular', 'dcis');
  const inflammatoryBreast = containsAnyAffirmed([dxHead, examBreast].join('\n'), ['inflammatory breast', 'inflammatory carcinoma', 'peau d\'orange', "peau d'orange"]);
  if (inflammatoryBreast && (breastDx || hasBreastMalignancy)) {
    add({
      id: 'breast_inflammatory',
      type: 'safety',
      urgency: 'urgent',
      icon: '🎗️',
      finding: 'Suspected inflammatory breast cancer',
      diagnosis: 'Inflammatory breast cancer — neoadjuvant therapy first',
      text: 'Inflammatory breast cancer → urgent breast MDT; breast-conserving surgery and SLNB are not recommended',
      rationale: 'Inflammatory breast cancer is treated with neoadjuvant systemic therapy first, then modified radical mastectomy; breast-conserving surgery and sentinel node biopsy are not recommended (NCCN breast cancer guideline).',
      actions: [
        { step: 1, text: 'Urgent breast MDT / oncology — core biopsy with skin punch biopsy, staging', addToPlan: '• Urgent breast oncology MDT: core biopsy + skin punch biopsy, staging CT; neoadjuvant systemic therapy first, then modified radical mastectomy with axillary node dissection (NCCN). Breast-conserving surgery (wide local excision) and sentinel node biopsy are not recommended in inflammatory breast cancer (NCCN).' },
      ],
    });
  }
  if (hasBreastMalignancy && breastDx && !inflammatoryBreast) {
    add({
      id: 'breast_cancer_pathway',
      type: 'safety',
      urgency: 'priority',
      icon: '🎗️',
      finding: 'Breast malignancy — imaging or examination features',
      diagnosis: 'Breast carcinoma — surgical planning',
      text: 'Breast Malignancy → Breast MDT + Operative Plan',
      rationale: 'Suspicious / malignant breast mass — breast oncology MDT discussion required before definitive surgery. Wide local excision (WLE) + SLNB vs mastectomy ± immediate reconstruction per tumour characteristics and patient preference.',
      actions: [
        { step: 1, text: 'Breast MDT referral — staging, receptor status, surgical options', addToPlan: '• Breast oncology MDT referral — tumour size, grade, ER/PR/HER2 status, nodal staging.' },
        { step: 2, text: 'Staging CT chest/abdomen/pelvis + bone scan (if stage II–III)', addToPlan: '• Staging CT C/A/P + bone scan (if clinically node-positive or stage ≥ IIA).' },
        { step: 3, text: 'Sentinel lymph node biopsy (SLNB) planning — isotope + blue dye', addToPlan: '• SLNB: Tc99m isotope injection day before; patent blue dye at induction. Gamma probe harvesting.' },
        {
          step: 4,
          text: 'Pre-populate WLE + SLNB operative plan',
          addToPlan: `WIDE LOCAL EXCISION (WLE) + SENTINEL LYMPH NODE BIOPSY (SLNB) — OPERATIVE PLAN
────────────────────────────────────────────────────────────────────────────────
PRE-OPERATIVE:
• Sentinel node isotope injection: Tc99m 0.4ml × 4 injections periareolar — day before surgery.
• Wire / ultrasound-guided seed localisation if impalpable lesion — radiology day of surgery.
• Patent blue dye: 1–2ml intradermal perilesional at induction.
• Consent: WLE — incomplete excision requiring re-excision (15–25%), SLNB — lymphoedema (< 5%), seroma, blue skin discolouration permanent.
• Pre-op: FBC, Group & Screen, ECG (if ≥ 40), CXR.

ANAESTHESIA: GA.
POSITION: Supine, ipsilateral arm abducted 90° on arm board. Ipsilateral shoulder roll.
SURGEON: Dr Dawit Daniel Kabiye MD DM.

OPERATIVE STEPS:
1. Mark tumour position (wire/seed localisation confirmed by radiology).
2. Elliptical excision of skin overlying tumour (if skin involved) or transverse incision over Langer's lines.
3. WLE: excise tumour with minimum 1cm macroscopic margin in all directions.
4. Orient specimen: sutures — superior (short), lateral (long), medial (double). Send fresh for margin assessment / frozen section.
5. Cavity shavings: superior, inferior, medial, lateral, anterior, posterior — send separately if margins close.
6. SLNB: transverse axillary incision 4cm. Use gamma probe — identify hot node (≥ 10× ex-vivo background count). Blue node identification. Retrieve all hot/blue nodes (typically 1–3).
7. Haemostasis in WLE cavity. Consider cavity marking clips (for radiotherapy planning).
8. Reconstruction: advancement flap if large defect; or oncoplastic reshaping (if breast surgery trained).
9. Wound closure: deep 2/0 Vicryl, subcuticular 4/0 Monocryl. Axillary: deep 2/0 Vicryl, subcuticular 4/0 Monocryl.
10. Drain: axilla — JP drain × 1 (remove < 30ml/day, usually day 1–2). Breast cavity: no drain (routine).

INTRAOPERATIVE FINDINGS: [Tumour size, location, skin involvement]. SLNB: [number of nodes retrieved, hot/blue/both]. [Other].
Specimen orientation: [Superior-short/Lateral-long/Medial-double]. To radiology for specimen x-ray, then histopathology.
EBL: [X] ml. Swab count correct × 2.

POST-OPERATIVE ORDERS:
• Paracetamol 1g QDS + Ibuprofen 400mg TDS regular.
• Morphine 5mg PRN.
• Drain removal: when < 30ml / 24h (axilla, usually day 1–2).
• Arm exercises from day 1 — physiotherapy referral.
• Wound review 7–10 days.
• Histology result at 2-week clinic: margin status, SLN status, grade/receptor result.
• If margins involved: plan re-excision or mastectomy (MDT decision).
• If SLNB positive: axillary clearance vs radiotherapy (AMAROS trial approach per MDT).
• Oncology referral: adjuvant chemotherapy (if indicated), radiotherapy (mandatory post-WLE), hormone therapy (ER+), Herceptin (HER2+).`,
        },
      ],
      followUp: { label: 'Breast MDT + histology + oncology referral', daysFromNow: 14 },
    });
  }

  // ── PREGNANCY: obstetric handover (owner default 5; C7; RCOG / NICE NG126, NG133) ─────
  if (pregnant) {
    const weeks = emergencyLayer.pregnancy.weeks;
    const viable = weeks === null || weeks >= 22;
    add({
      id: 'pregnancy_obstetric',
      type: 'safety',
      urgency: 'urgent',
      icon: '🤰',
      finding: `Pregnant${weeks !== null ? ` (${weeks} weeks)` : ''}`,
      text: 'Pregnancy — obstetric team involvement; pregnancy-safe plan',
      rationale: 'An acute presentation in pregnancy needs obstetric input: fetal assessment when viable, pregnancy-safe drugs and imaging (no NSAIDs from 20 weeks; LMWH — DOACs and warfarin are contraindicated in pregnancy; ultrasound / MRI before ionising imaging where they answer the question).',
      actions: [
        { step: 1, text: 'Inform the obstetric / maternity team', addToPlan: '• Pregnancy: inform the obstetric / maternity team — joint care.' },
        ...(viable ? [{ step: 2, text: 'Fetal monitoring (CTG / fetal heart) — viable gestation', addToPlan: '• Fetal monitoring (CTG / fetal heart rate) with the obstetric team.' }] : []),
        { step: 3, text: 'Pregnancy-safe prescribing and imaging: no NSAIDs from 20 weeks; anticoagulation with LMWH (DOACs and warfarin are contraindicated in pregnancy); ultrasound or MRI in preference to CT where it answers the question', addToPlan: '• Pregnancy-safe plan: no NSAIDs from 20 weeks (MHRA 2020); anticoagulation with LMWH — DOACs and warfarin are contraindicated in pregnancy (warfarin is teratogenic) (RCOG GTG 37a/b); ultrasound or MRI before ionising imaging where it answers the question.' },
      ],
    });
  }

  // Urinary infection / pyelonephritis: urine culture before antibiotics (NICE NG111; EAU 2024)
  if (containsAnyAffirmed([historyAll, dxHead].join('\n'), ['pyelonephritis', 'urinary tract infection', 'urosepsis', 'dysuria', /\buti\b/, 'loin pain'])
    && (hasFeverVital || hasFever || containsAnyAffirmed([historyAll, dxHead].join('\n'), ['pyelonephritis', 'urosepsis', 'rigors']))) {
    add({
      id: 'urine_culture',
      type: 'investigation',
      urgency: 'priority',
      icon: '🧫',
      finding: 'Upper urinary tract infection / urosepsis suspected',
      text: 'Urine culture (MSU) before antibiotics',
      rationale: 'Send a midstream urine (MSU) for culture before antibiotics in pyelonephritis and urosepsis, and review the choice against the culture result (NICE NG111; EAU 2024).',
      actions: [
        { step: 1, text: 'Midstream urine (MSU) for culture and sensitivity', addToInvestigations: 'Urine culture (MSU) — before antibiotics' },
      ],
    });
  }

  // Bloody diarrhoea: stool culture incl. STEC (UKHSA STEC guidance 2023)
  if (containsAnyAffirmed([historyAll, ...symptoms].join('\n'), ['bloody diarrhoea', 'bloody diarrhea', 'blood in the diarrhoea', /\bdiarrhoea\b[^.;\n]{0,25}\bblood\b/])) {
    add({
      id: 'stool_culture',
      type: 'investigation',
      urgency: 'priority',
      icon: '🧫',
      finding: 'Bloody diarrhoea',
      text: 'Stool culture including STEC (E. coli O157) — before antibiotics',
      rationale: 'Bloody diarrhoea needs stool culture including Shiga toxin-producing E. coli; antibiotics are avoided when STEC is suspected (haemolytic uraemic syndrome risk — UKHSA 2023).',
      actions: [
        { step: 1, text: 'Stool culture and STEC / Shiga toxin PCR; C. difficile toxin if recent antibiotics', addToInvestigations: 'Stool culture + STEC (Shiga toxin) PCR' },
      ],
    });
  }

  // Diabetic foot infection: plain X-ray for osteomyelitis (IWGDF/IDSA 2023)
  if (containsAnyAffirmed([historyAll, examExtremities, input.examOther ?? '', dxHead].join('\n'), ['diabetic foot', 'foot ulcer', 'toe ulcer', 'osteomyelitis', 'probe to bone', 'probe-to-bone'])
    && hasDiabetes) {
    add({
      id: 'diabetic_foot_xray',
      type: 'investigation',
      urgency: 'priority',
      icon: '🦶',
      finding: 'Diabetic foot ulcer / infection',
      text: 'Plain X-ray of the foot — osteomyelitis, gas, foreign body',
      rationale: 'Plain radiographs of the foot are the first imaging for suspected diabetic foot osteomyelitis (IWGDF/IDSA 2023).',
      actions: [
        { step: 1, text: 'Plain X-ray of the foot', addToInvestigations: 'Plain X-ray of the foot — osteomyelitis (IWGDF/IDSA 2023)' },
      ],
    });
  }

  // Alcohol excess with an acute illness: thiamine before glucose (NICE CG100)
  if (hasToxic(toxicHabits, 'alcohol excess', 'heavy drink', 'alcohol dependence', 'etoh excess')
    || containsAnyAffirmed([historyAll, dxHead, ...comorbidities].join('\n'), [/\b(alcohol (excess|dependence|misuse|withdrawal|related)|alcoholic|heavy drink\w*|binge drink\w*|\d{2,3} units (a|per) week)\b/])) {
    add({
      id: 'alcohol_thiamine',
      type: 'safety',
      urgency: 'priority',
      icon: '🍺',
      finding: 'Alcohol excess',
      text: 'Thiamine (Pabrinex) and alcohol-withdrawal assessment',
      rationale: 'Harmful drinking with an acute illness: parenteral thiamine to prevent Wernicke encephalopathy and assessment for withdrawal (NICE CG100).',
      actions: [
        { step: 1, text: 'Parenteral thiamine (Pabrinex) before glucose (NICE CG100)', addToPlan: '• Thiamine: parenteral (Pabrinex) if Wernicke risk / malnourished, oral otherwise (NICE CG100).' },
        { step: 2, text: 'Assess for alcohol withdrawal (CIWA-Ar) and treat per protocol', addToPlan: '• Alcohol withdrawal assessment (CIWA-Ar) and symptom-triggered treatment per protocol (NICE CG100).' },
      ],
    });
  }

  // ── PERI-OPERATIVE ALERTS (G2.3, G2.5, G2.6) ──────────────────────────────
  const modifier = (id: string) => emergencyLayer.riskModifiers.some(m => m.id === id);
  const hazardActions: ClinicalAction[] = [];
  if (modifier('anaesthetic_mh')) hazardActions.push({ step: hazardActions.length + 1, text: 'Malignant hyperthermia susceptible: trigger-free anaesthesia (TIVA — no volatile agents, no suxamethonium); dantrolene available (EMHG 2021)', addToPlan: '• Malignant hyperthermia susceptibility: alert the anaesthetist — trigger-free anaesthesia (TIVA; avoid volatile agents and suxamethonium), dantrolene immediately available (EMHG 2021; AAGBI).' });
  if (modifier('anaesthetic_sux')) hazardActions.push({ step: hazardActions.length + 1, text: 'Suxamethonium apnoea: avoid suxamethonium and mivacurium (butyrylcholinesterase deficiency)', addToPlan: '• Suxamethonium apnoea (butyrylcholinesterase deficiency): alert the anaesthetist — avoid suxamethonium and mivacurium; alternative neuromuscular blocker (e.g. rocuronium) is the anaesthetist\'s decision; check the patient carries an alert card.' });
  if (modifier('anaesthetic_latex')) hazardActions.push({ step: hazardActions.length + 1, text: 'Latex allergy: latex-free theatre and ward', addToPlan: '• Latex allergy: latex-free environment and equipment in theatre, recovery and the ward (AAGBI anaphylaxis guidance).' });
  if (modifier('anaesthetic_airway')) hazardActions.push({ step: hazardActions.length + 1, text: 'Known difficult airway: anaesthetic pre-assessment and airway plan (DAS 2015)', addToPlan: '• Known difficult airway: anaesthetic pre-assessment; airway plan per Difficult Airway Society 2015 guidance.' });
  if (modifier('anaesthetic_osa')) hazardActions.push({ step: hazardActions.length + 1, text: 'Obstructive sleep apnoea / STOP-Bang risk: anaesthetic review and post-operative monitoring', addToPlan: '• Obstructive sleep apnoea (STOP-Bang): anaesthetic pre-assessment; bring CPAP; opioid-sparing analgesia and post-operative monitoring plan.' });
  if (modifier('steroids') && isPreOp) hazardActions.push({ step: hazardActions.length + 1, text: 'Long-term glucocorticoid: peri-operative hydrocortisone cover', addToPlan: '• Long-term steroids: peri-operative hydrocortisone steroid cover per the AAGBI / Society for Endocrinology 2020 guideline (Woodcock et al.); do not omit the usual dose.' });
  if (hasMed(medications, medicationsText, 'gliflozin', 'sglt2', 'sglt-2') && isPreOp) hazardActions.push({ step: hazardActions.length + 1, text: 'SGLT2 inhibitor: withhold the day before and the day of surgery; check ketones peri-operatively (CPOC 2021)', addToPlan: '• SGLT2 inhibitor: withhold the day before and the day of surgery (CPOC 2021); check blood ketones if unwell peri-operatively (euglycaemic DKA); restart only when eating and drinking normally.' });
  if (hasType1Diabetes && isPreOp) hazardActions.push({ step: hazardActions.length + 1, text: 'Type 1 diabetes: never omit basal insulin — continue long-acting basal insulin; VRIII if more than one missed meal (CPOC 2021)', addToPlan: '• Type 1 diabetes: continue long-acting basal insulin throughout (never omit — DKA risk); variable-rate IV insulin infusion if more than one meal will be missed (CPOC 2021).' });
  if (hazardActions.length) {
    add({
      id: 'periop_alerts',
      type: 'safety',
      urgency: 'urgent',
      icon: '🩺',
      finding: 'Anaesthetic / peri-operative hazard recorded',
      text: 'Peri-operative alert — tell the anaesthetist before any procedure',
      rationale: 'Anaesthetic hazards and peri-operative drug rules recorded in the history must reach the plan (clinical-validation periop gap G2.5). The anaesthetist and surgeon acknowledge them before the procedure.',
      actions: hazardActions,
    });
  }

  // Tetanus-prone wound (UKHSA Green Book ch. 30). No schedule numbers are invented here.
  const traumaText = [historyAll, examGeneral, input.examOther ?? '', examExtremities].join('.\n');
  const traumaticWound = containsAnyAffirmed(traumaText, [/\b(laceration|puncture wound|bite|cut (his|her|my|himself|herself)|stab\w*|nail|glass|cutlass|machete|graze|abrasion)\b/, /\bwound\b[^.;\n]{0,40}\b(injur\w*|fall|fell|trauma|accident)\b/]);
  const tetanusProne = containsAnyAffirmed(traumaText, [/\b(soil|manure|farm\w*|rusty|contaminat\w*|dirty|puncture|devitali[sz]\w*|compound fracture|foreign body|animal bite|garden\w*)\b/]);
  if (traumaticWound && tetanusProne) {
    add({
      id: 'tetanus_prone_wound',
      type: 'safety',
      urgency: 'priority',
      icon: '💉',
      finding: 'Tetanus-prone wound',
      text: 'Tetanus-prone wound → immunisation status, vaccine ± immunoglobulin',
      rationale: 'Wounds contaminated with soil or manure, puncture wounds, devitalised tissue and bites are tetanus-prone. Management depends on the immunisation history and the wound risk (UKHSA Green Book chapter 30).',
      actions: [
        { step: 1, text: 'Thorough wound cleaning and debridement of devitalised tissue', addToPlan: '• Tetanus-prone wound: thorough cleaning, irrigation and debridement of devitalised tissue.' },
        { step: 2, text: 'Check tetanus immunisation history: if incomplete, unknown or not up to date — tetanus-containing vaccine booster (UKHSA Green Book ch. 30)', addToPlan: '• Tetanus immunisation status: if incomplete, unknown or not up to date, give a tetanus-containing vaccine booster and plan completion of the course (UKHSA Green Book ch. 30).' },
        { step: 3, text: 'High-risk tetanus-prone wound with incomplete or unknown immunisation: human tetanus immunoglobulin (HTIG) as well (UKHSA Green Book ch. 30)', addToPlan: '• High-risk tetanus-prone wound with incomplete or unknown immunisation: human tetanus immunoglobulin (HTIG) in addition to the vaccine (UKHSA Green Book ch. 30).' },
      ],
    });
  }

  // Asplenia / post-splenectomy (UKHSA Green Book ch. 7; BSH 2011)
  const asplenic = modifier('asplenia') || (input.icdCodes ?? []).some(c => /^(Z90\.81|D73\.0|Q89\.01)/i.test(c)) || dxSupports('splenectomy', 'asplenia', 'hyposplenism');
  if (asplenic) {
    add({
      id: 'asplenia_vaccination',
      type: 'preventative',
      urgency: 'priority',
      icon: '🛡️',
      finding: 'Asplenia / post-splenectomy',
      text: 'Post-splenectomy: vaccinations, antibiotic prophylaxis, alert card',
      rationale: 'Asplenic patients are at lifelong risk of overwhelming post-splenectomy infection. Vaccination follows the current UKHSA Green Book chapter 7 schedule (BSH 2011 guideline).',
      actions: [
        { step: 1, text: 'Vaccinate per UKHSA Green Book ch. 7: pneumococcal, Haemophilus influenzae type b / meningococcal C, MenACWY, MenB, annual influenza', addToPlan: '• Asplenia vaccinations per the current UKHSA Green Book ch. 7 schedule: pneumococcal, Hib/MenC, meningococcal ACWY (MenACWY) and meningococcal B (MenB), and annual influenza.' },
        { step: 2, text: 'Offer lifelong antibiotic prophylaxis and an emergency standby antibiotic supply; alert card', addToPlan: '• Offer antibiotic prophylaxis and an emergency standby course (BSH 2011); splenectomy alert card; seek urgent assessment for any fever.' },
      ],
    });
  }

  // VTE prophylaxis in operative plans (NICE NG89, 2018 updated 2019)
  const operativePrompt = prompts.some(p => /_pathway$/.test(p.id) && p.id !== 'bowel_obstruction_pathway')
    || dxSupports('ectomy', 'repair', 'resection', 'laparotomy', 'laparoscop', 'hartmann', 'whipple', 'anastomos', 'fixation', 'operation', 'surgery');
  if (operativePrompt && isPreOp && !paed) {
    add({
      id: 'vte_prophylaxis',
      type: 'safety',
      urgency: 'priority',
      icon: '🦵',
      finding: 'Operative plan — VTE risk assessment',
      text: 'VTE prophylaxis (NICE NG89)',
      rationale: 'Every surgical admission needs a VTE and bleeding risk assessment; prophylaxis continues after discharge for major abdominal or pelvic cancer surgery (NICE NG89).',
      actions: [
        { step: 1, text: 'VTE and bleeding risk assessment (NICE NG89)', addToPlan: '• VTE risk assessment on admission (NICE NG89).' },
        { step: 2, text: 'Mechanical prophylaxis (anti-embolism stockings or intermittent pneumatic compression) unless contraindicated', addToPlan: '• Mechanical prophylaxis: anti-embolism stockings or intermittent pneumatic compression unless contraindicated (NICE NG89).' },
        { step: 3, text: activeBleeding ? 'Active bleeding: pharmacological prophylaxis withheld — mechanical only until bleeding risk settles' : 'Pharmacological prophylaxis with LMWH unless bleeding risk outweighs it; adjust for renal function; 28 days after major abdominal / pelvic cancer surgery', addToPlan: activeBleeding
            ? '• Active bleeding: pharmacological VTE prophylaxis withheld — mechanical prophylaxis only; reassess daily (NICE NG89).'
            : '• Pharmacological VTE prophylaxis with LMWH unless bleeding risk outweighs it (dose adjusted for renal function); extended to 28 days after major abdominal or pelvic cancer surgery (NICE NG89).' },
      ],
    });
  }

  const penicillinAllergy = (input.allergies ?? []).some(a => /penicillin|amoxicillin|co-amoxiclav|flucloxacillin|beta-?lactam/i.test(a));

  // ── Post-processing: assumed results, pregnancy, children ─────────────────
  for (const p of prompts) {
    const own = p.id.startsWith('emergency_') || p.id.startsWith('safeguarding_');
    for (const a of p.actions) {
      const fix = (t: string | undefined): string | undefined => {
        if (!t) return t;
        // A5: a β-HCG result is never assumed.
        let out = t.replace(/β-HCG confirmed negative/gi, 'β-HCG: result required');
        // A4 / G2.11: no NSAIDs in pregnancy (avoid from 20 weeks — MHRA 2020, FDA 2020).
        if (pregnant && NSAID_RE.test(out)) {
          NSAID_RE.lastIndex = 0;
          out = out.replace(NSAID_RE, ' — no NSAIDs in pregnancy (avoid from 20 weeks; MHRA 2020)');
        }
        NSAID_RE.lastIndex = 0;
        // Penicillin allergy recorded: a penicillin is never proposed (C5). Each line that proposes
        // one is replaced by a withheld line naming the class and the alternative route; lines
        // that already deal with the allergy (e.g. "if penicillin allergy: …") are left as written.
        if (penicillinAllergy && PENICILLIN_RE.test(out)) {
          PENICILLIN_RE.lastIndex = 0;
          out = out.split('\n').map(line => {
            PENICILLIN_RE.lastIndex = 0;
            if (!PENICILLIN_RE.test(line) || /allerg|anaphyla/i.test(line)) return line;
            const bullet = /^\s*•/.test(line) ? '• ' : '';
            return `${bullet}⚠ PENICILLIN ALLERGY recorded — the penicillin-class antibiotic proposed here is withheld: use a non-penicillin alternative per the local antimicrobial guideline (after anaphylaxis, avoid cephalosporins and carbapenems too unless allergy advice says otherwise).`;
          }).join('\n');
        }
        PENICILLIN_RE.lastIndex = 0;
        // Under 16: no adult fixed doses.
        if (paed && !own) out = stripAdultDoses(out);
        return out;
      };
      a.text = fix(a.text) ?? a.text;
      a.addToPlan = fix(a.addToPlan);
    }
  }

  // ── Herbs, teas, bush remedies & supplements (owner's evidence briefing §5 / §7) ──
  // Perioperative alert per recorded product, the mandatory pre-procedure question, and the
  // "ask about" prompts (supplement-prompts.ts; iOS twin SupplementAlerts.swift). Display and
  // suggestion only: the clinician decides whether anything is stopped.
  for (const sp of computeSupplementPrompts({
    history: input.supplementHistory ?? EMPTY_SUPPLEMENT_HISTORY,
    preOp: isPreOp,
    clinicalText: [
      ...comorbidities, input.historyText ?? '', ...ccEntries.map(e => e.complaint), ...symptoms,
      assessment ?? '', examGeneral, examAbdomen, input.examNeuro ?? '', input.examOther ?? '', examExtremities,
    ].filter(Boolean).join('.\n'),
    conditionsText: [...comorbidities, assessment ?? ''].filter(Boolean).join('.\n'),
    sex,
    pregnant,
    labs: investigationResults,
    temperatureC: numVital(vitals, 'temperatureC'),
  })) {
    add(supplementClinicalPrompt(sp));
  }

  // ── Sort: urgent first → priority → routine; within tier: safety > investigation > preventative ──

  const URGENCY_ORDER: Record<string, number> = { urgent: 0, priority: 1, routine: 2 };
  const TYPE_ORDER: Record<string, number> = { safety: 0, investigation: 1, preventative: 2 };

  prompts.sort((a, b) => {
    const uo = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
    if (uo !== 0) return uo;
    return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
  });

  return prompts;
}
