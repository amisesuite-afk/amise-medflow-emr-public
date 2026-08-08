/**
 * Surgical clinical inference engine — derives safety prompts, investigation
 * cascades, screening, and follow-up actions from the full clinical picture:
 * demographics, CC, PMH, Fhx, social Hx, examination findings, lab results,
 * and imaging. All prompts require explicit surgeon confirmation.
 *
 * Rules reflect general & endoscopic surgery practice, Caribbean demographics.
 */

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
}

// ── Pattern helpers ────────────────────────────────────────────────────────────

function lo(s: string): string { return s.toLowerCase(); }

function hasCc(entries: CCEntry[], ...terms: string[]): boolean {
  return entries.some(e => terms.some(t => lo(e.complaint).includes(t)));
}
function hasSx(symptoms: string[], ...terms: string[]): boolean {
  return symptoms.some(s => terms.some(t => lo(s).includes(t)));
}
function hasPmh(comorbidities: string[], ...terms: string[]): boolean {
  return comorbidities.some(c => terms.some(t => lo(c).includes(t)));
}
function hasFhx(familyHistory: string[], ...terms: string[]): boolean {
  return familyHistory.some(f => terms.some(t => lo(f).includes(t)));
}
function hasToxic(toxicHabits: string[], ...terms: string[]): boolean {
  return toxicHabits.some(h => terms.some(t => lo(h).includes(t)));
}
function hasMed(medications: string[], medicationsText: string, ...terms: string[]): boolean {
  const text = [...medications, medicationsText].join(' ').toLowerCase();
  return terms.some(t => text.includes(t));
}
function exam(s: string, ...terms: string[]): boolean {
  const sl = lo(s);
  return terms.some(t => sl.includes(t));
}
function hasRadResult(
  requests: InferenceInput['radiologyRequests'],
  ...terms: string[]
): boolean {
  return requests.some(r =>
    r.resultReceived &&
    terms.some(t => lo(r.resultNotes).includes(t) || lo(r.indication).includes(t))
  );
}

/** Parse first numeric value from a lab result string. */
function numLab(results: Record<string, string>, ...keyFragments: string[]): number | null {
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
  const isPreOp = encounterType === 'surgical_consult' || encounterType === 'major_emergency'
    || hasSx(symptoms, 'pre-operative') || hasCc(ccEntries, 'pre-op', 'pre-operative');
  const hasAbdominalCc = hasCc(ccEntries,
    'abdominal', 'appendic', 'pelvic', 'groin', 'bowel', 'cholecyst', 'pancreatit',
    'peritonit', 'hernia', 'obstruct',
  ) || hasSx(symptoms, 'abdominal pain', 'pelvic pain', 'vomiting');

  const hasJaundice = hasSx(symptoms, 'jaundice')
    || hasCc(ccEntries, 'jaundice', 'biliary', 'cholangitis', 'cholecystitis', 'cbd', 'hepat')
    || exam(examGeneral, 'jaundice', 'icteric');
  const hasRuqPain = hasCc(ccEntries, 'right upper', 'ruq', 'biliary', 'cholecyst')
    || hasSx(symptoms, 'right upper quadrant', 'ruq pain');
  const hasFever = hasSx(symptoms, 'fever', 'pyrexia')
    || exam(examGeneral, 'fever', 'pyrexia', 'febrile', 'temp');

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
        { step: 6, text: 'ERCP for biliary decompression within 24h (Tokyo Grade II/III)', addToPlan: '• Arrange urgent ERCP — biliary decompression (Tokyo Grade II/III cholangitis).' },
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
        { step: 5, text: 'Laparoscopic cholecystectomy — early (within 72h) vs interval', addToPlan: '• Plan laparoscopic cholecystectomy — early (< 72h onset) or interval (≥ 6 weeks).' },
        { step: 6, text: 'Surgical consent', addToPlan: '• Obtain surgical consent — laparoscopic cholecystectomy risks/alternatives.' },
      ],
      followUp: { label: 'Post-cholecystectomy follow-up', daysFromNow: 14 },
    });
  }

  // McBurney's / Rebound / Rovsing → Appendicitis
  // Gate generic guarding/rebound on appendicitis-specific diagnosis or CC to avoid
  // triggering Alvarado score for cholecystitis, pancreatitis, etc.
  const assessmentHasAppend = lo(assessment ?? '').includes('append');
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
        { step: 3, text: 'CT abdomen/pelvis (if Alvarado 5–6 or atypical; skip if ≥ 7 + classic presentation)', addToPlan: '• CT abdomen/pelvis — appendix calibre, perforation, appendicolith.' },
        { step: 4, text: 'β-HCG if female of reproductive age (exclude ectopic)', addToInvestigations: isReproductiveAgeFemale ? 'Urine Pregnancy Test (F)' : undefined },
        { step: 5, text: 'NBM + IV access + analgesia + antibiotics', addToPlan: '• NBM, IV access, morphine PRN, IV Piperacillin-tazobactam 4.5g.' },
        { step: 6, text: 'Emergency laparoscopic appendicectomy — consent and theatre', addToPlan: '• Emergency laparoscopic appendicectomy — consent obtained, theatre booked.' },
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
        { step: 6, text: 'Emergency laparotomy consent — ICU post-op', addToPlan: '• Emergency laparotomy consent — source control; ICU post-operatively.' },
      ],
      followUp: { label: 'ICU/HDU post-laparotomy review', daysFromNow: 2 },
    });
  }

  // Breast lump → Triple assessment
  if (exam(examBreast, 'lump', 'mass', 'thickening', 'nodule', 'hard', 'irregular')) {
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
        { step: 1, text: 'USS breast (all ages) — cystic vs solid, BI-RADS', addToPlan: '• USS breast — BI-RADS classification, cystic vs solid characterisation.' },
        !isNaN(ageNum) && ageNum >= 35
          ? { step: 2, text: 'Mammogram (age ≥ 35) — microcalcifications, spiculation', addToPlan: '• Bilateral mammogram — screen for synchronous disease and microcalcifications.' }
          : { step: 2, text: 'MRI breast if young + dense tissue / high-risk', addToPlan: '• Consider MRI breast if dense glandular tissue or BRCA status.' },
        { step: 3, text: 'Core needle biopsy (CNB) — histological diagnosis', addToPlan: '• Core needle biopsy — 14G US-guided; send for ER/PR/HER2 if malignant.' },
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
        { step: 3, text: 'Emergency scrotal exploration + de-torsion + fixation', addToPlan: '• Emergency scrotal exploration — de-torsion, assess viability, bilateral fixation (orchidopexy).' },
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
  if (isReproductiveAgeFemale && (pregnancyPossible || hasAbdominalCc)) {
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

  // GI bleed
  if (hasSx(symptoms, 'rectal bleeding', 'black stool', 'haematemesis', 'melaena')
    || hasCc(ccEntries, 'bleeding', 'haematemesis', 'rectal bleed', 'melaena', 'haematochezia')) {
    add({
      id: 'gi_bleed_panel',
      type: 'safety',
      urgency: 'urgent',
      icon: '🩸',
      finding: 'GI haemorrhage',
      text: 'GI bleed resuscitation: FBC, Group & Screen, PT/INR, APTT, U&E',
      rationale: 'GI haemorrhage — haemoglobin baseline, blood bank preparation, coagulation status, and renal function (BUN:Cr ratio for upper GI source) before endoscopy.',
      actions: [
        { step: 1, text: 'IV access (2 × large-bore) + resuscitation', addToPlan: '• 2 × large-bore IV cannulae, Hartmann\'s 500ml bolus, crossmatch 2 units pRBC.' },
        { step: 2, text: 'FBC + Group & Screen / Crossmatch', addToInvestigations: 'Blood Group & Type' },
        { step: 3, text: 'PT/INR + APTT', addToInvestigations: 'Prothrombin Time (PT/INR)' },
        { step: 4, text: 'U&E + creatinine (BUN:Cr ratio for upper vs lower GI)', addToInvestigations: 'Urea & Electrolytes (U&E)' },
        { step: 5, text: 'Gastroscopy (upper GI) or colonoscopy (lower GI) — timing by stability', addToPlan: '• Urgent OGD / colonoscopy — within 24h of haemodynamic stabilisation.' },
        { step: 6, text: 'Reverse anticoagulation if applicable (Vitamin K / PCC)', addToPlan: '• Reverse anticoagulation if on warfarin/DOAC — Vitamin K IV + 4-factor PCC if life-threatening.' },
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
        { step: 4, text: 'CT chest/abdomen/pelvis — occult malignancy screen', addToPlan: '• CT chest/abdomen/pelvis — occult malignancy screen (alarm symptoms).' },
        { step: 5, text: 'Upper GI endoscopy if dysphagia / epigastric pain', addToPlan: '• Upper GI endoscopy if dysphagia or epigastric symptoms present.' },
      ],
    });
  }

  // Pre-operative standard workup
  if (isPreOp) {
    add({
      id: 'preop_haem',
      type: 'safety',
      urgency: 'priority',
      icon: '⚕️',
      finding: 'Pre-operative assessment',
      text: 'Pre-op bloods: FBC, PT/INR, APTT, Group & Screen',
      rationale: 'Standard pre-operative haematological screen — required before general anaesthesia.',
      actions: [
        { step: 1, text: 'FBC', addToInvestigations: 'Full Blood Count (FBC)' },
        { step: 2, text: 'PT/INR + APTT', addToInvestigations: 'Prothrombin Time (PT/INR)' },
        { step: 3, text: 'Group & Screen', addToInvestigations: 'Blood Group & Type' },
        { step: 4, text: 'U&E + creatinine', addToInvestigations: 'Urea & Electrolytes (U&E)' },
        !isNaN(ageNum) && ageNum >= 40
          ? { step: 5, text: '12-lead ECG (age ≥ 40)', addToPlan: '• 12-lead ECG — pre-operative cardiac baseline (age ≥ 40).' }
          : null,
        hasPmh(comorbidities, 'diabet')
          ? { step: 6, text: 'HbA1c (diabetic patient — target < 8.5% pre-op)', addToInvestigations: 'HbA1c' }
          : null,
      ].filter(Boolean) as ClinicalAction[],
    });
  }

  // Anticoagulants
  if (hasMed(medications, medicationsText, 'warfarin', 'rivaroxaban', 'apixaban', 'dabigatran', 'enoxaparin', 'heparin', 'fondaparinux', 'edoxaban')) {
    add({
      id: 'anticoag_check',
      type: 'safety',
      urgency: 'priority',
      icon: '💊',
      finding: 'Anticoagulation therapy',
      text: 'Anticoagulation monitoring + peri-operative bridging plan',
      rationale: 'Patient on anticoagulation — confirm therapeutic level and plan peri-operative bridging before any procedure.',
      actions: [
        { step: 1, text: 'PT/INR + APTT', addToInvestigations: 'Prothrombin Time (PT/INR)' },
        { step: 2, text: 'Renal function (DOAC dose adjustment)', addToInvestigations: 'Creatinine + eGFR' },
        { step: 3, text: 'Bridging protocol — hold DOAC 48h pre-op; warfarin bridge per INR target', addToPlan: '• Anticoagulant bridging: hold DOAC 48–72h pre-op (renal-adjusted); warfarin — bridge with LMWH per haematology protocol.' },
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
  if (wbc !== null && wbc > 15) {
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
        { step: 4, text: 'Identify and treat source — imaging if abdominal source', addToPlan: '• CT abdomen if abdominal source suspected — abscess, perforation, ischaemia.' },
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
        { step: 2, text: 'NBM + aggressive IV fluid resuscitation (Hartmann\'s 250–500ml/h)', addToPlan: '• NBM, IV Hartmann\'s 250ml/h — adjust to urine output ≥ 0.5ml/kg/h.' },
        { step: 3, text: 'CRP at 48h, calcium, LFTs (biliary aetiology?)', addToInvestigations: 'Calcium (corrected)' },
        { step: 4, text: 'USS abdomen — biliary cause, CBD stones', addToPlan: '• USS abdomen — biliary aetiology (gallstones, CBD diameter).' },
        { step: 5, text: 'CT pancreas (contrast-enhanced) at 48–72h if severe', addToPlan: '• CT pancreas (CECT) at 48–72h if severe — necrosectomy planning.' },
        { step: 6, text: 'HDU/ICU if Glasgow ≥ 3 or organ dysfunction', addToPlan: '• HDU/ICU — monitor renal, respiratory, cardiovascular function.' },
      ],
      followUp: { label: 'Post-pancreatitis 6-week review + cholecystectomy planning', daysFromNow: 42 },
    });
  }

  // INR > 1.5 → coagulopathy
  const inr = numLab(investigationResults, 'inr', 'pt/inr', 'prothrombin');
  if (inr !== null && inr > 1.5) {
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

  // Dilated CBD
  if (hasRadResult(radiologyRequests, 'dilated', 'cbd', 'common bile duct', 'bile duct dilation')) {
    add({
      id: 'dilated_cbd',
      type: 'safety',
      urgency: 'priority',
      icon: '🔍',
      finding: 'Dilated common bile duct on imaging',
      diagnosis: 'Biliary obstruction — choledocholithiasis / malignancy',
      text: 'Dilated CBD → MRCP + ERCP',
      rationale: 'Dilated CBD suggests biliary obstruction — most common causes: choledocholithiasis (if symptomatic) and malignancy (if painless).',
      actions: [
        { step: 1, text: 'LFTs + direct bilirubin + GGT', addToInvestigations: 'Liver Function Tests (LFTs)' },
        { step: 2, text: 'CA 19-9 + CEA — malignancy screen', addToInvestigations: 'CA 19-9' },
        { step: 3, text: 'MRCP — CBD stones, stricture, mass', addToPlan: '• MRCP — CBD diameter, stone burden, biliary stricture characterisation.' },
        { step: 4, text: 'ERCP — stone extraction or stenting if obstruction confirmed', addToPlan: '• ERCP — therapeutic: stone extraction (choledocholithiasis) or stenting (malignant stricture).' },
        { step: 5, text: 'HPB surgical review', addToPlan: '• HPB surgical review — Whipple / Hartmann\'s if resectable malignancy.' },
      ],
      followUp: { label: 'Post-ERCP CBD result', daysFromNow: 7 },
    });
  }

  // Inflamed / enlarged appendix on imaging
  if (hasRadResult(radiologyRequests, 'appendix', 'appendicitis', 'inflamed appendix', '>6mm', '6mm')) {
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
  if (hasRadResult(radiologyRequests, 'pelvic free fluid', 'free fluid', 'haemoperitoneum') && sex === 'female') {
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

  if (hasPmh(comorbidities, 'diabet')) {
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

  if (sex === 'female' && !isNaN(ageNum) && ageNum >= 21 && ageNum <= 65) {
    add({
      id: 'cervical_smear',
      type: 'preventative',
      urgency: 'routine',
      icon: '🎗️',
      finding: 'Cervical cancer screening due',
      text: 'Cervical smear — confirm up to date',
      rationale: `${ageNum}y female — cervical cancer screening every 3 years (21–65). Confirm last smear date and refer if overdue.`,
      actions: [
        { step: 1, text: 'Ask last smear date — document in notes', addToPlan: '• Confirm cervical smear date — document last result.' },
        { step: 2, text: 'Refer to gynaecology if overdue (> 3 years)', addToPlan: '• Refer gynaecology — cervical smear overdue (> 3 years).' },
      ],
      followUp: { label: 'Cervical smear result', daysFromNow: 14 },
    });
  }

  if (sex === 'female' && !isNaN(ageNum) && ageNum >= 40) {
    add({
      id: 'mammogram_check',
      type: 'preventative',
      urgency: 'routine',
      icon: '🎯',
      finding: 'Breast cancer screening due',
      text: 'Mammogram — confirm up to date',
      rationale: `${ageNum}y female — breast cancer screening. Annual mammogram recommended from age 40.`,
      actions: [
        { step: 1, text: 'Confirm last mammogram date', addToPlan: '• Document last mammogram date — refer to radiology if overdue.' },
        { step: 2, text: 'Arrange mammogram if overdue (> 1 year for 40–49; > 2 years for 50+)', addToPlan: '• Arrange bilateral mammogram — screening protocol.' },
      ],
      followUp: { label: 'Mammogram result', daysFromNow: 14 },
    });
  }

  if (sex === 'female' && hasFhx(familyHistory, 'breast', 'ovarian')) {
    add({
      id: 'brca_discussion',
      type: 'preventative',
      urgency: 'priority',
      icon: '🧬',
      finding: 'Family history of breast / ovarian cancer',
      text: 'BRCA1/2 discussion — high-risk screening protocol',
      rationale: 'First-degree relative with breast or ovarian cancer — BRCA1/2 genetic counselling and enhanced surveillance.',
      actions: [
        { step: 1, text: 'BRCA risk stratification (Manchester Score or Tyrer-Cuzick)', addToPlan: '• Calculate BRCA risk score (Manchester Score) — determines referral threshold.' },
        { step: 2, text: 'Genetics referral if high risk', addToPlan: '• Refer clinical genetics — BRCA1/2 testing if Manchester Score ≥ 17.' },
        { step: 3, text: 'Enhanced breast surveillance (annual MRI + mammogram from age 30)', addToPlan: '• Enhanced surveillance protocol: annual MRI + mammogram from age 30 if high-risk.' },
      ],
      followUp: { label: 'Genetics / high-risk breast clinic appointment', daysFromNow: 90 },
    });
  }

  if (sex === 'male' && !isNaN(ageNum) && ageNum >= 50) {
    add({
      id: 'psa_discussion',
      type: 'preventative',
      urgency: 'routine',
      icon: '🔬',
      finding: 'Prostate cancer screening — male ≥ 50',
      text: 'PSA screening discussion (male ≥ 50)',
      rationale: `${ageNum}y male — informed PSA discussion with shared decision-making.`,
      actions: [
        { step: 1, text: 'Shared decision-making discussion — PSA benefits and limitations', addToPlan: '• PSA discussion — document informed consent to proceed with test.' },
        { step: 2, text: 'PSA if patient consents after discussion', addToInvestigations: 'PSA (M)' },
      ],
      followUp: { label: 'PSA result review', daysFromNow: 14 },
    });
  }

  if (!isNaN(ageNum) && ageNum >= 50) {
    const hasCrcFhx = hasFhx(familyHistory, 'colorectal', 'colon', 'bowel', 'rectal cancer', 'colon cancer', 'bowel cancer');
    add({
      id: 'colorectal_screen',
      type: 'preventative',
      urgency: hasCrcFhx ? 'priority' : 'routine',
      icon: '🔭',
      finding: hasCrcFhx ? 'Age ≥ 50 + family history colorectal cancer' : 'Age ≥ 50',
      text: hasCrcFhx
        ? 'Colonoscopy — FHx colorectal cancer + age ≥ 50'
        : 'Colorectal screening — FOBT or colonoscopy',
      rationale: hasCrcFhx
        ? `Age ${ageNum} + first-degree family history of CRC — colonoscopy from age 40 or 10 years before youngest index case.`
        : `Age ${ageNum} — routine CRC screening: FOBT every 2 years or colonoscopy every 10 years.`,
      actions: hasCrcFhx
        ? [
            { step: 1, text: 'Arrange colonoscopy — FHx CRC + age ≥ 50', addToPlan: '• Arrange colonoscopy — FHx CRC, age ≥ 50.' },
            { step: 2, text: 'CEA baseline', addToInvestigations: 'CEA' },
          ]
        : [
            { step: 1, text: 'FOBT every 2 years (if colonoscopy declined)', addToPlan: '• Faecal occult blood test — CRC screening (if colonoscopy declined).' },
            { step: 2, text: 'Colonoscopy every 10 years', addToPlan: '• Colonoscopy — CRC screening, age ≥ 50.' },
          ],
      followUp: { label: 'Colorectal screening result', daysFromNow: 21 },
    });
  }

  if (!isNaN(ageNum) && ageNum >= 35 && ageNum < 50
    && hasFhx(familyHistory, 'colorectal', 'colon', 'bowel cancer', 'colon cancer', 'rectal cancer')) {
    add({
      id: 'early_colonoscopy',
      type: 'preventative',
      urgency: 'priority',
      icon: '🔭',
      finding: 'FHx colorectal cancer, age 35–49',
      text: 'Early colonoscopy — FHx colorectal cancer',
      rationale: `Age ${ageNum} with first-degree family history — colonoscopy 10 years before youngest affected relative, or at age 40 (whichever earlier).`,
      actions: [
        { step: 1, text: 'Arrange colonoscopy — early surveillance', addToPlan: '• Arrange colonoscopy — FHx CRC, early surveillance criterion.' },
        { step: 2, text: 'CEA baseline', addToInvestigations: 'CEA' },
      ],
      followUp: { label: 'Early colonoscopy result', daysFromNow: 21 },
    });
  }

  if (hasToxic(toxicHabits, 'smok', 'tobacco', 'cigarette') && !isNaN(ageNum) && ageNum >= 50) {
    add({
      id: 'lung_cancer_screen',
      type: 'preventative',
      urgency: 'routine',
      icon: '🫁',
      finding: 'Smoker ≥ 50 years',
      text: 'Lung cancer screening — LDCT chest (smoker ≥ 50)',
      rationale: `Smoker ≥ 50 years — low-dose CT chest for high-risk patients (≥ 20 pack-year history, per USPSTF/BTS criteria).`,
      actions: [
        { step: 1, text: 'Quantify smoking history — pack-years', addToPlan: '• Document pack-year history — lung CT screening threshold is ≥ 20 pack-years.' },
        { step: 2, text: 'Annual LDCT chest if ≥ 20 pack-years and age 50–74', addToPlan: '• Arrange annual low-dose CT chest — lung cancer screening.' },
        { step: 3, text: 'Smoking cessation referral', addToPlan: '• Smoking cessation referral — nicotine replacement + behavioural support.' },
      ],
      followUp: { label: 'LDCT chest result', daysFromNow: 14 },
    });
  }

  if (sex === 'female' && !isNaN(ageNum) && ageNum >= 65) {
    add({
      id: 'dxa_osteoporosis',
      type: 'preventative',
      urgency: 'routine',
      icon: '🦴',
      finding: 'Post-menopausal female ≥ 65',
      text: 'DXA bone density — osteoporosis screening',
      rationale: 'Post-menopausal female ≥ 65 — DXA scan for osteoporosis per NOGG/USPSTF guidelines.',
      actions: [
        { step: 1, text: 'DXA scan — T-score at hip and spine', addToPlan: '• DXA bone density scan — osteoporosis screening (female ≥ 65).' },
        { step: 2, text: 'Calcium + vitamin D levels', addToInvestigations: 'Calcium (corrected)' },
        { step: 3, text: 'Initiate Vitamin D + Calcium supplementation if deficient', addToPlan: '• Vitamin D 800IU + Calcium 1200mg daily if deficient (osteoporosis prevention).' },
      ],
      followUp: { label: 'DXA result + osteoporosis management', daysFromNow: 21 },
    });
  }

  if (!isNaN(ageNum) && ageNum >= 40 && !hasLabKey(investigationResults, 'glucose', 'hba1c') && !hasPmh(comorbidities, 'diabet')) {
    add({
      id: 'diabetes_screen',
      type: 'preventative',
      urgency: 'routine',
      icon: '🍬',
      finding: `Age ${ageNum} — diabetes screening`,
      text: 'Fasting glucose + HbA1c — diabetes screening (age ≥ 40)',
      rationale: `Age ${ageNum} — metabolic syndrome and type 2 diabetes are prevalent. Screening identifies pre-diabetes enabling lifestyle intervention.`,
      actions: [
        { step: 1, text: 'Fasting glucose', addToInvestigations: 'Fasting Blood Glucose' },
        { step: 2, text: 'HbA1c', addToInvestigations: 'HbA1c' },
        { step: 3, text: 'Lipid profile', addToInvestigations: 'Lipid Profile' },
      ],
      followUp: { label: 'Diabetes screening result', daysFromNow: 14 },
    });
  }

  // Wellness / general checkup
  if (encounterType === 'quick_consult'
    || hasSx(symptoms, 'general check', 'wellness', 'routine check', 'annual', 'health screen', 'checkup', 'well woman', 'well man')
    || hasCc(ccEntries, 'wellness', 'checkup', 'health screen', 'annual', 'well man', 'well woman')) {
    add({
      id: 'wellness_panel',
      type: 'preventative',
      urgency: 'routine',
      icon: '🩺',
      finding: 'General health screen / wellness visit',
      text: 'Wellness panel: FBC, lipid profile, glucose, HbA1c, TFTs, eGFR',
      rationale: 'General health screen — comprehensive metabolic and haematological baseline for primary prevention.',
      actions: [
        { step: 1, text: 'FBC', addToInvestigations: 'Full Blood Count (FBC)' },
        { step: 2, text: 'Lipid profile + fasting glucose', addToInvestigations: 'Lipid Profile' },
        { step: 3, text: 'HbA1c', addToInvestigations: 'HbA1c' },
        { step: 4, text: 'TFTs (TSH)', addToInvestigations: 'Thyroid Function Tests (TFTs)' },
        { step: 5, text: 'U&E + eGFR', addToInvestigations: 'Urea & Electrolytes (U&E)' },
        { step: 6, text: 'Document BP + BMI + waist circumference', addToPlan: '• Document BP, BMI, waist circumference — cardiovascular risk profiling.' },
      ],
      followUp: { label: 'Annual wellness review', daysFromNow: 365, recurring: true, recurringDays: 365 },
    });
  }

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
  const hasTachyVital   = hr   !== null && hr   >  100;
  const hasHypotension  = sbp  !== null && sbp  <   90;
  const hasHypoxia      = spo2 !== null && spo2 <   94;
  const hasBradycardia  = hr   !== null && hr   <   50;
  const hasHyperBP      = sbp  !== null && sbp  >= 180;

  // Sepsis criteria: fever + tachycardia (± hypotension)
  if (hasFeverVital && hasTachyVital) {
    const sepsisActions: ClinicalAction[] = [
      { step: 1, text: 'Blood cultures × 2 (peripheral + central if line in situ) — BEFORE antibiotics', addToPlan: '• Blood cultures × 2 before antibiotics.' },
      { step: 2, text: 'Broad-spectrum IV antibiotics within 1 hour', addToPlan: hasHypotension ? '• IV Meropenem 1g TDS + Vancomycin 25mg/kg (septic shock — broad cover).' : '• IV Piperacillin-tazobactam 4.5g TDS — empirical sepsis cover.' },
      { step: 3, text: 'IV fluid bolus 30ml/kg Hartmann\'s (if hypotensive)', addToPlan: hasHypotension ? '• IV fluid resuscitation: 30ml/kg Hartmann\'s bolus — reassess lactate and BP at 30 min.' : '• IV Hartmann\'s 1L over 4h — ensure adequate hydration.' },
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

  // Hypotension without fever → haemorrhagic / cardiogenic shock workup
  if (hasHypotension && !hasFeverVital) {
    add({
      id: 'shock_non_infective',
      type: 'safety',
      urgency: 'urgent',
      icon: '🚨',
      finding: `SBP ${sbp} mmHg — hypotension`,
      diagnosis: 'Shock — haemorrhagic / cardiogenic / obstructive',
      text: `SBP ${sbp} mmHg → Shock Protocol`,
      rationale: `Blood pressure ${sbp}/${dbp ?? '?'} mmHg — hypotension without fever. Differential: haemorrhagic (GI bleed, AAA, ectopic), cardiogenic (MI, tamponade), obstructive (PE, tension pneumothorax).`,
      actions: [
        { step: 1, text: '2 × large-bore IV access — 1L Hartmann\'s bolus, reassess', addToPlan: '• 2 × large-bore IV cannulae, Hartmann\'s 1L bolus — reassess BP and HR at 15 min.' },
        { step: 2, text: 'FBC + Group & Screen + Crossmatch 4 units, U&E, troponin, D-dimer, BNP', addToInvestigations: 'Blood Group & Type' },
        { step: 3, text: '12-lead ECG — MI / arrhythmia', addToPlan: '• 12-lead ECG — ST elevation MI, arrhythmia, right heart strain (PE).' },
        { step: 4, text: 'Portable CXR — cardiac silhouette, pulmonary oedema, pneumothorax', addToPlan: '• Portable CXR — cardiac outline, pulmonary oedema, pneumothorax.' },
        { step: 5, text: 'POCUS (point-of-care USS) — cardiac, IVC, pleural, aorta', addToPlan: '• POCUS: cardiac (effusion/tamponade), aorta (AAA), IVC collapsibility.' },
        { step: 6, text: 'Urgent cardiology or surgical review per source', addToPlan: '• Contact appropriate specialty immediately: cardiology (MI/tamponade), surgery (haemorrhage/AAA), emergency medicine (PE).' },
      ],
    });
  }

  // Hypoxia: SpO2 < 94%
  if (hasHypoxia) {
    const hypoxiaActions: ClinicalAction[] = [
      { step: 1, text: 'Supplemental O₂ — titrate to SpO₂ ≥ 94% (COPD: target 88–92%)', addToPlan: '• Supplemental O₂: Hudson mask 5–10L/min, titrate to SpO₂ ≥ 94%.' },
      { step: 2, text: 'ABG — type I vs type II failure, pH, pCO₂', addToInvestigations: 'Arterial Blood Gas (ABG)' },
      { step: 3, text: 'CXR — pneumonia, effusion, pneumothorax, pulmonary oedema', addToPlan: '• CXR — identify cause: consolidation, pneumothorax, effusion, cardiomegaly.' },
      { step: 4, text: 'D-dimer (if PE probability ≥ moderate — Wells score)', addToInvestigations: 'D-dimer' },
    ];
    if (spo2 !== null && spo2 < 90) {
      hypoxiaActions.push({ step: 5, text: 'Consider CPAP / NIV / intubation if SpO₂ < 90% or fatigue', addToPlan: '• Escalate: CPAP/NIV if SpO₂ < 90% or increasing respiratory effort — ITU review.' });
    }
    hypoxiaActions.push({ step: spo2 !== null && spo2 < 90 ? 6 : 5, text: 'CT pulmonary angiogram if PE likely (Wells ≥ 2)', addToPlan: '• CTPA if Wells score ≥ 2 and D-dimer positive — exclude pulmonary embolism.' });
    add({
      id: 'hypoxia_vitals',
      type: 'safety',
      urgency: spo2 !== null && spo2 < 90 ? 'urgent' : 'priority',
      icon: '🫁',
      finding: `SpO₂ ${spo2}% — hypoxia`,
      diagnosis: 'Hypoxaemic respiratory failure',
      text: `SpO₂ ${spo2}% → Respiratory Escalation`,
      rationale: `SpO₂ ${spo2}% — below safe threshold (target ≥ 94%). Underlying cause (PE, pneumonia, pneumothorax, LVF, ARDS) must be identified urgently.`,
      actions: hypoxiaActions,
    });
  }

  // Bradycardia < 50 bpm
  if (hasBradycardia) {
    const bradyActions: ClinicalAction[] = [
      { step: 1, text: '12-lead ECG — heart block, junctional, SSS', addToPlan: '• 12-lead ECG — P-wave morphology, PR interval, heart block grade.' },
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
  if (hasHyperBP && !hasHypotension) {
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
  if (hasTachyVital && hr !== null && hr > 110 && !hasFeverVital) {
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
        { step: 1, text: '12-lead ECG — AF, flutter, SVT, right heart strain (S1Q3T3)', addToPlan: '• 12-lead ECG — arrhythmia, right heart strain pattern (PE).' },
        { step: 2, text: 'FBC (anaemia), U&E, TFTs (thyrotoxicosis), D-dimer', addToInvestigations: 'D-dimer' },
        { step: 3, text: 'CTPA if D-dimer positive + Wells ≥ 2', addToPlan: '• CTPA if Wells score ≥ 2 — exclude pulmonary embolism.' },
        { step: 4, text: 'IV fluid challenge if hypovolaemia suspected — 500ml Hartmann\'s', addToPlan: '• IV fluid challenge 500ml if hypovolaemia likely — reassess HR at 30 min.' },
      ],
    });
  }

  // BGL > 15 mmol/L from vitals
  if (bgl !== null && bgl > 15) {
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
        { step: 4, text: 'VRIII — variable-rate insulin infusion + potassium replacement', addToPlan: '• Variable-rate insulin infusion (VRIII): DKA fixed-rate 0.1 units/kg/h. Monitor K⁺ hourly.' },
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
        { step: 6, text: 'Interval cholecystectomy if gallstone aetiology — within 2 weeks of discharge', addToPlan: '• Plan interval laparoscopic cholecystectomy — same admission or within 2 weeks (gallstone pancreatitis).' },
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
        { step: 4, text: sodium < 125 ? 'IV hypertonic saline 3% — 1–2ml/kg/h; target Na rise ≤ 10 mmol/L/24h' : 'Fluid restriction 1L/day if euvolaemic SIADH', addToPlan: sodium < 125 ? '• IV 3% saline 1–2ml/kg/h — raise Na by max 10 mmol/L in first 24h (osmotic demyelination risk). Endocrinology input.' : '• Fluid restriction 1L/day — euvolaemic SIADH. Correct slowly.' },
        { step: 5, text: 'Defer elective surgery until Na ≥ 130 mmol/L', addToPlan: '• Elective surgery deferred — sodium < 130 mmol/L anaesthetic risk; target ≥ 130 pre-op.' },
      ],
    });
  }

  // Hyperkalaemia > 5.5 → ECG + treatment
  const potassium = numLab(investigationResults, 'potassium', 'k+', ' k ');
  if (potassium !== null && potassium > 5.5) {
    const kActions: ClinicalAction[] = [
      { step: 1, text: '12-lead ECG — peaked T-waves, wide QRS, sine wave (K⁺ > 6.5)', addToPlan: '• 12-lead ECG urgently — peaked T-waves, widened QRS, AV block, sine wave pattern.' },
    ];
    if (potassium > 6.5) {
      kActions.push({ step: 2, text: 'IV Calcium gluconate 10ml 10% — cardiac membrane stabilisation (if ECG changes)', addToPlan: '• IV Calcium gluconate 10ml 10% — cardiac membrane protection (not lowering K⁺). Onset 1–3 min, repeat at 5 min if ECG not improving.' });
    }
    kActions.push({ step: 3, text: 'IV Actrapid 10 units + 50ml 50% dextrose — drive K⁺ intracellularly', addToPlan: '• IV Actrapid 10 units + 50ml 50% dextrose — shift K⁺ intracellularly. Onset 15–30 min, duration 6h. Monitor BGL.' });
    kActions.push({ step: 4, text: 'Salbutamol 10–20mg nebulised — adjunct (if no cardiac disease)', addToPlan: '• Nebulised salbutamol 10–20mg — adjunct K⁺ shift (additive to insulin-dextrose).' });
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

  // Cholecystectomy pathway
  if (hasGallstoneIndication) {
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
• NBM from midnight (or ≥ 6h solids / 2h clear fluids).
• IV Co-amoxiclav 1.2g at induction (single prophylactic dose).
• LMWH (Enoxaparin 40mg SC) night before + day of surgery; TED stockings.
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
• Paracetamol 1g QDS (regular) + Ibuprofen 400mg TDS (if eGFR normal).
• Morphine 2.5–5mg SC/IV PRN for pain > 5/10.
• Free fluids at 2h post-op; light diet same evening if tolerating fluids.
• IV antibiotics: Co-amoxiclav 1.2g TDS × 24h (complicated cholecystitis only).
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
  if (hasAppendicitisIndication) {
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
• Simple appendicitis: IV Amoxiclav 1.2g TDS × 24h → oral Co-amoxiclav × 5 days.
• Perforated appendicitis: IV Pip-Tazo 4.5g TDS + Metronidazole 500mg TDS × 5 days; convert to oral when tolerating PO.
• Paracetamol 1g QDS + Ibuprofen 400mg TDS (regular).
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

  // Inguinal / groin hernia → repair pathway
  if (hasHerniaIndication) {
    const isIncarcerated = exam(examAbdomen, 'irreducible', 'tender', 'incarcerat', 'strangulat')
      || hasCc(ccEntries, 'irreducible', 'incarcerat', 'strangulat', 'obstructed');
    const herniaPreOpActions: ClinicalAction[] = isIncarcerated
      ? [
          { step: 1, text: 'Attempt gentle manual reduction under analgesia (Trendelenburg position)', addToPlan: '• Attempt manual reduction: Trendelenburg + analgesia. Do NOT forcibly reduce if tender — strangulation risk.' },
          { step: 2, text: 'Emergency Theatre — irreducible / strangulated hernia', addToPlan: '• Emergency Theatre: irreducible / strangulated hernia — bowel resection risk, consent accordingly.' },
        ]
      : [
          { step: 1, text: 'Confirm hernia type: inguinal (direct vs indirect), femoral, umbilical, incisional', addToPlan: '• Document: side, type (inguinal direct/indirect/femoral), reducibility, skin changes, scrotal extension.' },
          { step: 2, text: 'Pre-op: FBC, Group & Screen, ECG (if ≥ 40), PSA if male ≥ 50 and not done', addToInvestigations: 'Full Blood Count (FBC)' },
        ];
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
        : 'Symptomatic inguinal/groin hernia — laparoscopic TAPP repair is preferred (bilateral disease, recurrence, bilateral, active patients). Lichtenstein for high anaesthetic risk.',
      actions: [
        ...herniaPreOpActions,
        { step: 3, text: 'Consent — recurrence, chronic pain, mesh, cord/nerve injury, contralateral risk', addToPlan: '• Consent: hernia repair — recurrence (1–2% TAPP), chronic groin pain (5%), mesh infection (< 1%), testicular ischaemia/vas injury (< 1%), haematoma.' },
        {
          step: 4,
          text: 'Pre-populate TAPP operative plan',
          addToPlan: `${isIncarcerated ? 'EMERGENCY ' : ''}LAPAROSCOPIC INGUINAL HERNIA REPAIR (TAPP) — OPERATIVE PLAN
─────────────────────────────────────────────────────────────
PRE-OPERATIVE:
• NBM from midnight. Consent signed.
• Antibiotics: Co-amoxiclav 1.2g IV at induction (optional — low infection risk if no mesh contamination).
• LMWH + TED stockings.
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
• Paracetamol 1g QDS + Ibuprofen 400mg TDS (regular analgesia).
• Morphine 5mg PRN if pain > 5/10.
• Scrotal support 48h if male (reduces haematoma).
• Ice pack to groin PRN × 24h.
• Day-case discharge: pain controlled on oral analgesia, tolerating oral fluids, voiding.
• Activity: walking from day 1; avoid heavy lifting (> 10kg) for 4 weeks; driving after 1–2 weeks (when emergency stop possible).
• Wound review at 10 days.
• Outpatient review 6 weeks — check for recurrence, chronic pain, mesh complications.`,
        },
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

  if (hasBowelObstruction) {
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
        { step: 5, text: 'Colonoscopy + stenting for obstructing left-sided colonic cancer (bridge to elective surgery)', addToPlan: '• If LBO due to colonic malignancy: colonic stent as bridge to elective resection (vs emergency Hartmann\'s).' },
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

  // Thyroidectomy pathway — triggered by FNAC result or Bethesda III+
  if (hasRadResult(radiologyRequests, 'bethesda', 'malignant', 'suspicious', 'follicular neoplasm', 'papillary', 'thyroid cancer')
    || (exam(examGeneral, 'thyroid nodule', 'neck mass', 'goitre')
    && (hasCc(ccEntries, 'thyroid', 'neck mass') || hasSx(symptoms, 'thyroid', 'neck mass')))) {
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

  if (hasBreastMalignancy) {
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
