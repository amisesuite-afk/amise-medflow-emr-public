/**
 * Surgical clinical inference engine — derives investigation, screening, and
 * preventative action prompts from patient demographics, CC, PMH, family
 * history, and social history. All prompts require surgeon confirmation.
 *
 * Rules reflect general & endoscopic surgery practice, Caribbean demographics.
 */

interface CCEntry { complaint: string; answers: Record<string, string> }

export interface ClinicalPrompt {
  id: string;
  type: 'safety' | 'investigation' | 'preventative';
  urgency: 'urgent' | 'priority' | 'routine';
  icon: string;
  text: string;
  rationale: string;
  /** Lab name to append to orderedInvestigations on confirm */
  addToInvestigations?: string;
  /** Text to append to plan on confirm */
  addToPlan?: string;
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
}

// ── Pattern matchers ───────────────────────────────────────────────────────────

function hasCc(entries: CCEntry[], ...terms: string[]): boolean {
  return entries.some(e => terms.some(t => e.complaint.toLowerCase().includes(t)));
}
function hasSx(symptoms: string[], ...terms: string[]): boolean {
  return symptoms.some(s => terms.some(t => s.toLowerCase().includes(t)));
}
function hasPmh(comorbidities: string[], ...terms: string[]): boolean {
  return comorbidities.some(c => terms.some(t => c.toLowerCase().includes(t)));
}
function hasFhx(familyHistory: string[], ...terms: string[]): boolean {
  return familyHistory.some(f => terms.some(t => f.toLowerCase().includes(t)));
}
function hasToxic(toxicHabits: string[], ...terms: string[]): boolean {
  return toxicHabits.some(h => terms.some(t => h.toLowerCase().includes(t)));
}
function hasMed(medications: string[], medicationsText: string, ...terms: string[]): boolean {
  const text = [...medications, medicationsText].join(' ').toLowerCase();
  return terms.some(t => text.includes(t));
}

// ── Main engine ────────────────────────────────────────────────────────────────

export function computeClinicalPrompts(input: InferenceInput): ClinicalPrompt[] {
  const {
    age, sex, symptoms, comorbidities, familyHistory, toxicHabits,
    medications, medicationsText, pregnancyPossible, ccEntries, encounterType,
  } = input;

  const ageNum = parseInt(age, 10);
  const hasAnyData = !isNaN(ageNum) || sex || symptoms.length > 0 || comorbidities.length > 0 || ccEntries.length > 0;
  if (!hasAnyData) return [];

  const prompts: ClinicalPrompt[] = [];
  const add = (p: ClinicalPrompt) => { if (!prompts.some(x => x.id === p.id)) prompts.push(p); };

  const isReproductiveAgeFemale = sex === 'female' && ageNum >= 12 && ageNum <= 55;
  const isPreOp = encounterType === 'surgical_consult' || encounterType === 'major_emergency'
    || hasSx(symptoms, 'pre-operative') || hasCc(ccEntries, 'pre-op', 'pre-operative');
  const hasAbdominalCc = hasCc(ccEntries,
    'abdominal', 'appendic', 'pelvic', 'groin', 'bowel', 'cholecyst', 'pancreatit',
    'peritonit', 'hernia', 'obstruct',
  ) || hasSx(symptoms, 'abdominal pain', 'pelvic pain', 'vomiting');

  // ── SAFETY ─────────────────────────────────────────────────────────────────

  // β-HCG: reproductive-age female with any abdominal/pelvic complaint
  if (isReproductiveAgeFemale && (pregnancyPossible || hasAbdominalCc)) {
    add({
      id: 'bhcg_safety',
      type: 'safety',
      urgency: 'urgent',
      icon: '🤰',
      text: 'Urine Pregnancy Test (β-HCG)',
      rationale: `Reproductive-age female (${ageNum}y) with abdominal/pelvic complaint — must exclude ectopic pregnancy and intrauterine pregnancy before surgery, imaging, or opioid prescribing.`,
      addToInvestigations: 'Urine Pregnancy Test (F)',
    });
  }

  // Acute abdomen workup
  if (hasAbdominalCc) {
    add({
      id: 'acute_abdomen_panel',
      type: 'safety',
      urgency: 'priority',
      icon: '🧪',
      text: 'Acute abdomen panel: FBC, CRP, amylase/lipase, U&E',
      rationale: 'Abdominal pain — FBC for leucocytosis, CRP for systemic inflammation, amylase/lipase for pancreatitis, U&E for electrolyte disturbance.',
      addToInvestigations: 'Amylase',
    });
  }

  // Jaundice
  if (hasSx(symptoms, 'jaundice') || hasCc(ccEntries, 'jaundice', 'biliary', 'cholangitis', 'cholecystitis', 'cbd', 'hepat')) {
    add({
      id: 'jaundice_panel',
      type: 'safety',
      urgency: 'priority',
      icon: '🟡',
      text: 'Jaundice panel: LFTs, direct bilirubin, GGT, ALP, PT/INR, hepatitis B & C serology',
      rationale: 'Jaundice — LFT pattern distinguishes obstructive vs hepatocellular; PT/INR assesses hepatic synthetic function; viral serology identifies hepatitis aetiology.',
      addToInvestigations: 'Liver Function Tests (LFTs)',
    });
  }

  // GI bleed
  if (hasSx(symptoms, 'rectal bleeding', 'black stool')
    || hasCc(ccEntries, 'bleeding', 'haemorrhag', 'haematemesis', 'rectal bleed', 'melaena', 'haematochezia')) {
    add({
      id: 'gi_bleed_panel',
      type: 'safety',
      urgency: 'urgent',
      icon: '🩸',
      text: 'GI bleed: FBC, Group & Screen, PT/INR, APTT, U&E',
      rationale: 'GI haemorrhage — haemoglobin baseline, blood bank preparation, coagulation status, and renal function before any intervention.',
      addToInvestigations: 'Blood Group & Type',
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
      text: 'Urgent colonoscopy — rectal bleeding in patient ≥ 50',
      rationale: `Red flag: age ${ageNum} with rectal bleeding requires colonoscopy to exclude colorectal carcinoma per NICE DG56.`,
      addToPlan: '• Arrange urgent colonoscopy — rectal bleeding, age ≥ 50 (red-flag criterion).',
    });
  }

  // Unintentional weight loss → cancer screen
  if (hasSx(symptoms, 'weight loss') || hasCc(ccEntries, 'weight loss', 'occult malignancy')) {
    add({
      id: 'weight_loss_screen',
      type: 'safety',
      urgency: 'priority',
      icon: '⚖️',
      text: 'Alarm symptom panel: FBC, ESR, CRP, LFTs, TFTs, CEA, CA 19-9',
      rationale: 'Unintentional weight loss is an alarm symptom — requires systemic cancer and inflammatory disease exclusion.',
      addToInvestigations: 'CEA',
    });
  }

  // Pre-operative standard workup
  if (isPreOp) {
    add({
      id: 'preop_haem',
      type: 'safety',
      urgency: 'priority',
      icon: '⚕️',
      text: 'Pre-op bloods: FBC, PT/INR, APTT, Group & Screen',
      rationale: 'Standard pre-operative haematological screen — required before general anaesthesia.',
      addToInvestigations: 'Prothrombin Time (PT/INR)',
    });
    if (!isNaN(ageNum) && ageNum >= 40) {
      add({
        id: 'preop_ecg',
        type: 'safety',
        urgency: 'priority',
        icon: '🫀',
        text: 'Pre-op ECG (age ≥ 40)',
        rationale: 'Baseline 12-lead ECG for anaesthetic cardiovascular risk stratification in patients ≥ 40 years.',
        addToPlan: '• Request 12-lead ECG — pre-operative cardiac baseline (age ≥ 40).',
      });
    }
    if (hasPmh(comorbidities, 'diabet')) {
      add({
        id: 'preop_hba1c',
        type: 'safety',
        urgency: 'priority',
        icon: '📊',
        text: 'Pre-op HbA1c — diabetic patient',
        rationale: 'Diabetic patient pre-operatively — HbA1c for glycaemic control; target < 8.5% (69 mmol/mol) for elective surgery per AAGBI guidance.',
        addToInvestigations: 'HbA1c',
      });
    }
  }

  // Anticoagulants
  if (hasMed(medications, medicationsText, 'warfarin', 'rivaroxaban', 'apixaban', 'dabigatran', 'enoxaparin', 'heparin', 'fondaparinux', 'edoxaban')) {
    add({
      id: 'anticoag_check',
      type: 'safety',
      urgency: 'priority',
      icon: '💊',
      text: 'Anticoagulation monitoring: PT/INR, APTT',
      rationale: 'Patient on anticoagulation — confirm therapeutic level and plan peri-operative bridging protocol before any procedure.',
      addToInvestigations: 'Prothrombin Time (PT/INR)',
    });
  }

  // NSAIDs → renal check
  if (hasMed(medications, medicationsText, 'ibuprofen', 'naproxen', 'diclofenac', 'ketorolac', 'indomethacin', 'celecoxib', 'meloxicam')) {
    add({
      id: 'nsaid_renal',
      type: 'investigation',
      urgency: 'routine',
      icon: '🧫',
      text: 'Creatinine + eGFR — NSAID use',
      rationale: 'Regular NSAID use — baseline renal function to guide safe peri-operative prescribing and monitor nephrotoxicity.',
      addToInvestigations: 'Creatinine + eGFR',
    });
  }

  // ── INVESTIGATION — PMH-driven ─────────────────────────────────────────────

  if (hasPmh(comorbidities, 'diabet')) {
    add({
      id: 'diabetes_hba1c',
      type: 'investigation',
      urgency: 'routine',
      icon: '📊',
      text: 'HbA1c + creatinine/eGFR — diabetes monitoring',
      rationale: 'Diabetic patient — HbA1c for glycaemic control (target ≤ 53 mmol/mol); creatinine + eGFR for nephropathy screening.',
      addToInvestigations: 'HbA1c',
    });
  }

  if (hasPmh(comorbidities, 'hypertens', 'htn')) {
    add({
      id: 'htn_metabolic',
      type: 'investigation',
      urgency: 'routine',
      icon: '🫀',
      text: 'U&E + creatinine + eGFR — hypertension monitoring',
      rationale: 'Hypertensive patient (especially on ACE-I/ARBs or diuretics) — check electrolytes and renal function for treatment effect.',
      addToInvestigations: 'Urea & Electrolytes (U&E)',
    });
  }

  if (hasToxic(toxicHabits, 'alcohol', 'etoh')) {
    add({
      id: 'alcohol_lfts',
      type: 'investigation',
      urgency: 'routine',
      icon: '🫗',
      text: 'LFTs + GGT — alcohol use',
      rationale: 'Reported alcohol use — LFTs and GGT as hepatotoxicity marker; raised GGT indicates induction from chronic use.',
      addToInvestigations: 'Liver Function Tests (LFTs)',
    });
  }

  // Sickle cell — highly relevant in Caribbean practice
  if (hasPmh(comorbidities, 'sickle') || hasFhx(familyHistory, 'sickle')) {
    add({
      id: 'sickle_screen',
      type: 'investigation',
      urgency: 'priority',
      icon: '🩺',
      text: 'FBC + peripheral blood film — sickle cell screen',
      rationale: 'Known or family history of sickle cell disease/trait — FBC to assess haemoglobin and film for crisis markers. Pre-op HPLC if trait status unknown.',
      addToInvestigations: 'Full Blood Count (FBC)',
    });
  }

  // Liver disease / hepatitis history
  if (hasPmh(comorbidities, 'hepatitis', 'cirrhosis', 'liver disease', 'hep b', 'hep c')) {
    add({
      id: 'liver_disease_check',
      type: 'investigation',
      urgency: 'priority',
      icon: '🟡',
      text: 'Liver panel: LFTs, PT/INR, albumin, AFP (HCC surveillance)',
      rationale: 'Known liver disease — synthetic function (PT, albumin), hepatic enzymes, and AFP as hepatocellular carcinoma surveillance.',
      addToInvestigations: 'AFP',
    });
  }

  // ── PREVENTATIVE / SCREENING ────────────────────────────────────────────────

  if (sex === 'female' && !isNaN(ageNum) && ageNum >= 21 && ageNum <= 65) {
    add({
      id: 'cervical_smear',
      type: 'preventative',
      urgency: 'routine',
      icon: '🎗️',
      text: 'Cervical smear — confirm up to date',
      rationale: `${ageNum}-year-old female — cervical cancer screening every 3 years (age 21–65). Confirm last smear date and refer if overdue.`,
      addToPlan: '• Confirm cervical smear status — refer to gynaecology if overdue (>3 years).',
    });
  }

  if (sex === 'female' && !isNaN(ageNum) && ageNum >= 40) {
    add({
      id: 'mammogram_check',
      type: 'preventative',
      urgency: 'routine',
      icon: '🎯',
      text: 'Mammogram — confirm up to date',
      rationale: `${ageNum}-year-old female — breast cancer screening. Annual mammogram recommended from age 40 (biannually age 50–74 per some guidelines).`,
      addToPlan: '• Confirm mammogram status — arrange if overdue.',
    });
  }

  if (sex === 'female' && hasFhx(familyHistory, 'breast')) {
    add({
      id: 'brca_discussion',
      type: 'preventative',
      urgency: 'priority',
      icon: '🧬',
      text: 'BRCA discussion — family history of breast cancer',
      rationale: 'First-degree relative with breast cancer — BRCA1/2 genetic counselling and earlier / more frequent mammographic surveillance protocol.',
      addToPlan: '• Discuss BRCA1/2 genetic testing — refer to genetics or oncology for high-risk breast surveillance programme.',
    });
  }

  if (sex === 'male' && !isNaN(ageNum) && ageNum >= 50) {
    add({
      id: 'psa_discussion',
      type: 'preventative',
      urgency: 'routine',
      icon: '🔬',
      text: 'PSA — prostate cancer screening discussion (male ≥ 50)',
      rationale: `${ageNum}-year-old male — informed PSA discussion with shared decision-making. Test offered with explanation of benefits and limitations.`,
      addToInvestigations: 'PSA (M)',
    });
  }

  if (!isNaN(ageNum) && ageNum >= 50) {
    const hasCrcFhx = hasFhx(familyHistory, 'colorectal', 'colon', 'bowel', 'rectal cancer', 'colon cancer', 'bowel cancer');
    add({
      id: 'colorectal_screen',
      type: 'preventative',
      urgency: hasCrcFhx ? 'priority' : 'routine',
      icon: '🔭',
      text: hasCrcFhx
        ? 'Colonoscopy — age ≥ 50 with family history of colorectal cancer'
        : 'Colorectal cancer screening — FOBT or colonoscopy',
      rationale: hasCrcFhx
        ? `Age ${ageNum} + first-degree family history of CRC — colonoscopy from age 40 or 10 years before youngest index case.`
        : `Age ${ageNum} — routine CRC screening: FOBT every 2 years or colonoscopy every 10 years per evidence-based guidelines.`,
      addToPlan: hasCrcFhx
        ? '• Arrange colonoscopy — age ≥ 50 + family history of colorectal cancer.'
        : '• Discuss colorectal cancer screening — FOBT or colonoscopy (age ≥ 50).',
    });
  }

  // Early colonoscopy — family history but age < 50
  if (!isNaN(ageNum) && ageNum >= 35 && ageNum < 50
    && hasFhx(familyHistory, 'colorectal', 'colon', 'bowel cancer', 'colon cancer', 'rectal cancer')) {
    add({
      id: 'early_colonoscopy',
      type: 'preventative',
      urgency: 'priority',
      icon: '🔭',
      text: 'Early colonoscopy — family history of colorectal cancer',
      rationale: `Age ${ageNum} with first-degree family history — colonoscopy 10 years before youngest affected relative, or at age 40 (whichever earlier).`,
      addToPlan: '• Arrange colonoscopy — family history CRC, early surveillance criterion met.',
    });
  }

  // Smoker + age ≥ 50 → lung cancer screening
  if (hasToxic(toxicHabits, 'smok', 'tobacco', 'cigarette') && !isNaN(ageNum) && ageNum >= 50) {
    add({
      id: 'lung_cancer_screen',
      type: 'preventative',
      urgency: 'routine',
      icon: '🫁',
      text: 'Lung cancer screening — smoker ≥ 50',
      rationale: `Smoker ≥ 50 years — low-dose CT chest screening for high-risk patients (≥ 20 pack-year history, per USPSTF/BTS criteria).`,
      addToPlan: '• Discuss annual low-dose CT chest for lung cancer screening — smoking history + age ≥ 50.',
    });
  }

  // DXA — female ≥ 65
  if (sex === 'female' && !isNaN(ageNum) && ageNum >= 65) {
    add({
      id: 'dxa_osteoporosis',
      type: 'preventative',
      urgency: 'routine',
      icon: '🦴',
      text: 'DXA bone density — osteoporosis screening (female ≥ 65)',
      rationale: 'Post-menopausal female ≥ 65 — DXA scan for osteoporosis screening per NOGG/USPSTF guidelines.',
      addToPlan: '• Arrange DXA bone density scan — osteoporosis screening (female ≥ 65).',
    });
  }

  // General checkup / wellness
  if (hasSx(symptoms, 'general check', 'wellness', 'routine check', 'annual', 'health screen', 'checkup', 'well woman', 'well man')) {
    add({
      id: 'wellness_panel',
      type: 'preventative',
      urgency: 'routine',
      icon: '🩺',
      text: 'Wellness panel: FBC, lipid profile, fasting glucose, HbA1c, TFTs, eGFR',
      rationale: 'General health screen — comprehensive metabolic and haematological baseline for primary prevention and cardiovascular risk assessment.',
      addToInvestigations: 'Lipid Profile',
    });
    add({
      id: 'wellness_bp',
      type: 'preventative',
      urgency: 'routine',
      icon: '💉',
      text: 'Document BP + BMI — primary prevention baseline',
      rationale: 'Annual wellness visit — ensure blood pressure and anthropometric measurements are recorded for cardiovascular risk profiling.',
      addToPlan: '• Document BP, weight, height, BMI — primary prevention monitoring baseline.',
    });
  }

  // ── Sort: urgent safety first → priority → routine; within tier: safety > investigation > preventative ──

  const URGENCY_ORDER: Record<string, number> = { urgent: 0, priority: 1, routine: 2 };
  const TYPE_ORDER:    Record<string, number> = { safety: 0, investigation: 1, preventative: 2 };

  prompts.sort((a, b) => {
    const uo = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
    if (uo !== 0) return uo;
    return TYPE_ORDER[a.type] - TYPE_ORDER[b.type];
  });

  return prompts;
}
