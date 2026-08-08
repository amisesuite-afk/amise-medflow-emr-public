/**
 * Adaptive Bayesian symptom inference engine
 * Scores differential diagnoses based on selected symptoms + patient data,
 * then ranks unasked symptoms by information gain so the picker can
 * surface the most discriminating questions first.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type DxUrgency = 'urgent' | 'priority' | 'routine';

export interface DifferentialEntry {
  id: string;
  name: string;
  category: string;
  urgency: DxUrgency;
  /** Base probability before any symptoms (1–20). Higher = more common in this practice. */
  basePrior: number;
  /** Flag for predominantly paediatric conditions. */
  paediatric?: boolean;
  /** Short plain-language summary of classic presentation (shown in DxPanel). */
  keywords?: string[];
  /** Key investigations that help confirm / exclude this diagnosis. */
  investigations?: string[];
  /** Top-level symptom chip → score added when present */
  symptomWeights: Record<string, number>;
  /** "symptom.detail" → score added when symptom detail is selected */
  detailWeights?: Record<string, number>;
  /** Symptoms that reduce the score when present */
  negativeWeights?: Record<string, number>;
  /**
   * Age modifier — gt: lower bound (exclusive), lt: upper bound (exclusive).
   * Omit gt to match all ages from 0; omit lt for no upper cap.
   * Example paediatric: { lt: 16, add: 20 }
   */
  ageModifier?: { gt?: number; lt?: number; add: number };
  sexModifier?: { sex: string; add: number };
  /** Signs whose presence alone is near-diagnostic — checked against combined exam text */
  pathognomonic?: string[];
  /** Signs whose presence strongly argues AGAINST this diagnosis */
  exclusionSigns?: string[];
}

export interface RankedDifferential {
  id: string;
  name: string;
  category: string;
  urgency: DxUrgency;
  rawScore: number;
  confidence: number; // 0–100
  pathognomicMatchSign?: string; // which pathognomonic sign matched, if any
}

export type SymptomTier = 1 | 2 | 3;

export interface SuggestedSymptom {
  symptom: string;
  tier: SymptomTier;      // 1 = large/prominent, 2 = normal, 3 = small/dim
  infoGain: number;       // 0–100, higher = more discriminating
  topDxName: string;      // which dx it most supports
}

// ─── Differential knowledge base ──────────────────────────────────────────────

export const DIFFERENTIALS: DifferentialEntry[] = [
  // ── Biliary ──────────────────────────────────────────────────────
  {
    id: 'cbd_obstruction',
    name: 'CBD stone / obstructive jaundice',
    category: 'Biliary',
    urgency: 'priority',
    basePrior: 12,
    symptomWeights: {
      'jaundice': 32,
      'dark urine': 28,
      'pale stool': 28,
      'abdominal pain': 10,
      'vomiting': 6,
      'weight loss': 5,
    },
    detailWeights: {
      'abdominal pain.RUQ': 16,
      'jaundice.Dark urine': 22,
      'jaundice.Pale stool': 22,
      'jaundice.Known gallstones': 14,
      'jaundice.Previous episodes': 10,
      'jaundice.Prior ERCP': 10,
      'jaundice.Pruritus': 10,
    },
    negativeWeights: { 'fever after surgery': -5 }, // fever tips toward cholangitis
    sexModifier: { sex: 'female', add: 6 },
    ageModifier: { gt: 40, add: 5 },
  },
  {
    id: 'acute_cholangitis',
    name: 'Acute cholangitis',
    category: 'Biliary',
    urgency: 'urgent',
    basePrior: 6,
    symptomWeights: {
      'jaundice': 25,
      'fever after surgery': 30,
      'dark urine': 14,
      'pale stool': 14,
      'abdominal pain': 12,
      'vomiting': 8,
    },
    detailWeights: {
      'abdominal pain.RUQ': 18,
      'jaundice.Fever': 35,
      'jaundice.Rigors': 35,
      'jaundice.Dark urine': 14,
      'jaundice.Pale stool': 14,
      'jaundice.Abdominal pain': 15,
    },
    ageModifier: { gt: 50, add: 5 },
  },
  {
    id: 'acute_cholecystitis',
    name: 'Acute cholecystitis',
    category: 'Biliary',
    urgency: 'priority',
    basePrior: 14,
    symptomWeights: {
      'abdominal pain': 20,
      'fever after surgery': 18,
      'vomiting': 12,
      'jaundice': 8,
    },
    detailWeights: {
      'abdominal pain.RUQ': 30,
      'abdominal pain.Radiation to shoulder tip': 20,
      'abdominal pain.Fever': 18,
      'abdominal pain.Constant': 12,
      'vomiting.After meals': 10,
    },
    negativeWeights: {
      'dark urine': -4,
      'pale stool': -4,
    },
    sexModifier: { sex: 'female', add: 8 },
    ageModifier: { gt: 35, add: 5 },
  },
  {
    id: 'gallstone_pancreatitis',
    name: 'Gallstone pancreatitis',
    category: 'Biliary',
    urgency: 'priority',
    basePrior: 8,
    symptomWeights: {
      'abdominal pain': 18,
      'vomiting': 18,
      'fever after surgery': 10,
      'jaundice': 8,
    },
    detailWeights: {
      'abdominal pain.Epigastric': 25,
      'abdominal pain.Radiation to back': 30,
      'abdominal pain.Constant': 12,
      'vomiting.Continuous': 12,
      'vomiting.Multiple episodes daily': 12,
    },
    sexModifier: { sex: 'female', add: 5 },
  },

  // ── GI Bleed ─────────────────────────────────────────────────────
  {
    id: 'upper_gi_bleed',
    name: 'Upper GI haemorrhage',
    category: 'GI Bleed',
    urgency: 'urgent',
    basePrior: 8,
    symptomWeights: {
      'black stool': 38,
      'vomiting': 10,
      'abdominal pain': 6,
      'weight loss': 5,
    },
    detailWeights: {
      'vomiting.Blood': 40,
      'vomiting.Coffee grounds': 40,
      'black stool.Tarry / melaena': 30,
      'black stool.Sticky': 20,
      'black stool.Risk factors.NSAIDs': 12,
      'black stool.Risk factors.Alcohol': 10,
    },
  },
  {
    id: 'lower_gi_bleed',
    name: 'Lower GI bleed / colorectal',
    category: 'GI Bleed',
    urgency: 'priority',
    basePrior: 10,
    symptomWeights: {
      'rectal bleeding': 38,
      'abdominal pain': 8,
      'weight loss': 12,
    },
    detailWeights: {
      'rectal bleeding.Fresh red': 22,
      'rectal bleeding.Mixed with stool': 30,
      'rectal bleeding.Associated.Weight loss': 20,
      'rectal bleeding.Associated.Diarrhoea': 10,
      'rectal bleeding.Associated.Constipation': 8,
    },
    ageModifier: { gt: 50, add: 15 },
  },
  {
    id: 'colorectal_cancer',
    name: 'Colorectal carcinoma',
    category: 'Colorectal',
    urgency: 'priority',
    basePrior: 7,
    symptomWeights: {
      'rectal bleeding': 22,
      'weight loss': 22,
      'abdominal pain': 10,
      'dysphagia': 3,
    },
    detailWeights: {
      'rectal bleeding.Mixed with stool': 20,
      'rectal bleeding.Associated.Weight loss': 25,
      'weight loss.Unintentional': 20,
      'weight loss.> 10 kg': 25,
      'weight loss.Associated.Altered bowel habit': 22,
      'weight loss.Associated.Abdominal mass': 25,
    },
    ageModifier: { gt: 50, add: 20 },
  },

  // ── Upper GI ─────────────────────────────────────────────────────
  {
    id: 'oesophageal_cancer',
    name: 'Oesophageal / gastric carcinoma',
    category: 'Upper GI',
    urgency: 'priority',
    basePrior: 5,
    symptomWeights: {
      'dysphagia': 35,
      'weight loss': 25,
      'vomiting': 10,
      'abdominal pain': 5,
    },
    detailWeights: {
      'dysphagia.Type.Solids only': 22,
      'dysphagia.Type.Progressive': 30,
      'dysphagia.Associated.Weight loss': 28,
      'dysphagia.Associated.Regurgitation': 12,
      'dysphagia.Associated.Hoarse voice': 20,
      'weight loss.Unintentional': 18,
      'weight loss.> 10 kg': 22,
    },
    ageModifier: { gt: 55, add: 15 },
  },
  {
    id: 'peptic_ulcer',
    name: 'Peptic ulcer disease',
    category: 'Upper GI',
    urgency: 'routine',
    basePrior: 12,
    symptomWeights: {
      'abdominal pain': 22,
      'vomiting': 8,
      'black stool': 12,
    },
    detailWeights: {
      'abdominal pain.Epigastric': 25,
      'abdominal pain.Burning': 18,
      'abdominal pain.Character.Burning': 18,
      'black stool.Risk factors.NSAIDs': 20,
      'black stool.Risk factors.Aspirin': 15,
      'black stool.Risk factors.Prior PUD': 25,
    },
  },

  // ── Appendix / Acute abdomen ──────────────────────────────────────
  {
    id: 'acute_appendicitis',
    name: 'Acute appendicitis',
    category: 'Acute Abdomen',
    urgency: 'urgent',
    basePrior: 10,
    symptomWeights: {
      'abdominal pain': 22,
      'fever after surgery': 18,
      'vomiting': 14,
      'weight loss': 2,
    },
    detailWeights: {
      'abdominal pain.RLQ': 32,
      'abdominal pain.Periumbilical': 18,
      'abdominal pain.Associated.Fever': 20,
      'abdominal pain.Associated.Anorexia': 15,
      'abdominal pain.Associated.Vomiting': 12,
      'abdominal pain.Constant': 10,
    },
    ageModifier: { gt: 80, add: -5 }, // less common in elderly
  },
  {
    id: 'diverticulitis',
    name: 'Diverticulitis',
    category: 'Acute Abdomen',
    urgency: 'priority',
    basePrior: 8,
    symptomWeights: {
      'abdominal pain': 20,
      'fever after surgery': 16,
    },
    detailWeights: {
      'abdominal pain.LLQ': 30,
      'abdominal pain.LIF': 28,
      'abdominal pain.Associated.Fever': 18,
      'abdominal pain.Associated.Constipation': 10,
      'abdominal pain.Associated.Diarrhoea': 8,
    },
    ageModifier: { gt: 50, add: 12 },
  },

  // ── Hernia ───────────────────────────────────────────────────────
  {
    id: 'hernia_reducible',
    name: 'Reducible groin / abdominal hernia',
    category: 'Hernia',
    urgency: 'routine',
    basePrior: 12,
    symptomWeights: {
      'hernia': 45,
      'abdominal pain': 5,
    },
    detailWeights: {
      'hernia.Location.Right groin': 20,
      'hernia.Location.Left groin': 20,
      'hernia.Location.Umbilical': 15,
      'hernia.Location.Incisional': 15,
      'hernia.Reducibility.Easily reducible': 20,
      'hernia.Reducibility.Reducible with effort': 12,
    },
    negativeWeights: {
      'vomiting': -6,
      'fever after surgery': -6,
    },
    sexModifier: { sex: 'male', add: 12 },
  },
  {
    id: 'hernia_strangulated',
    name: 'Obstructed / strangulated hernia',
    category: 'Hernia',
    urgency: 'urgent',
    basePrior: 5,
    symptomWeights: {
      'hernia': 30,
      'abdominal pain': 18,
      'vomiting': 20,
      'fever after surgery': 12,
    },
    detailWeights: {
      'hernia.Reducibility.Irreducible': 35,
      "hernia.Reducibility.Can't assess": 20,
      'abdominal pain.Constant': 12,
      'vomiting.Bile': 12,
      'vomiting.Faeculent': 20,
    },
  },

  // ── Breast ───────────────────────────────────────────────────────
  {
    id: 'breast_cancer',
    name: 'Breast carcinoma',
    category: 'Breast',
    urgency: 'priority',
    basePrior: 8,
    symptomWeights: {
      'breast lump': 35,
      'breast pain': 5,
      'nipple discharge': 12,
      'weight loss': 10,
    },
    detailWeights: {
      'breast lump.Character.Hard': 25,
      'breast lump.Character.Fixed': 28,
      'breast lump.Associated.Skin change': 25,
      'breast lump.Associated.Skin tethering': 30,
      'breast lump.Associated.Nipple inversion': 22,
      'breast lump.Associated.Axillary lump': 28,
      'breast lump.Duration.Months': 12,
      'breast lump.Duration.Years': 8,
      'breast lump.Risk factors.Family history': 15,
      'breast lump.Risk factors.Prior breast cancer': 30,
      'breast lump.Risk factors.BRCA known': 25,
      'nipple discharge.Character.Bloody': 22,
    },
    sexModifier: { sex: 'female', add: 15 },
    ageModifier: { gt: 40, add: 12 },
  },
  {
    id: 'fibroadenoma',
    name: 'Fibroadenoma / benign breast lump',
    category: 'Breast',
    urgency: 'routine',
    basePrior: 10,
    symptomWeights: {
      'breast lump': 35,
      'breast pain': 10,
    },
    detailWeights: {
      'breast lump.Character.Soft': 15,
      'breast lump.Character.Mobile': 28,
      'breast lump.Character.Tender': 12,
      'breast lump.Duration.< 2 weeks': 10,
      'breast lump.Duration.2–6 weeks': 8,
    },
    sexModifier: { sex: 'female', add: 10 },
    ageModifier: { gt: 50, add: -8 }, // less likely post-menopausal
  },

  // ── Post-op ──────────────────────────────────────────────────────
  {
    id: 'postop_complication',
    name: 'Post-operative complication',
    category: 'Surgical',
    urgency: 'priority',
    basePrior: 8,
    symptomWeights: {
      'fever after surgery': 30,
      'wound discharge': 28,
      'abdominal pain': 12,
      'shortness of breath': 10,
    },
    detailWeights: {
      'fever after surgery.Within 1 week': 20,
      'wound discharge.Purulent': 25,
      'wound discharge.Haematoma': 15,
    },
  },

  // ── Diabetic foot ────────────────────────────────────────────────
  {
    id: 'diabetic_foot',
    name: 'Diabetic foot infection / ischaemia',
    category: 'Vascular',
    urgency: 'priority',
    basePrior: 7,
    symptomWeights: {
      'diabetic foot infection': 50,
      'fever after surgery': 15,
      'wound discharge': 20,
    },
  },

  // ── Malignancy / weight loss ─────────────────────────────────────
  {
    id: 'occult_malignancy',
    name: 'Occult malignancy / systemic disease',
    category: 'Oncology',
    urgency: 'priority',
    basePrior: 5,
    symptomWeights: {
      'weight loss': 35,
      'jaundice': 12,
      'dysphagia': 15,
      'rectal bleeding': 8,
      'abdominal pain': 6,
    },
    detailWeights: {
      'weight loss.Unintentional': 25,
      'weight loss.> 10 kg': 30,
      'weight loss.Associated.Night sweats': 20,
      'weight loss.Associated.Fatigue': 12,
      'weight loss.Associated.Abdominal mass': 28,
    },
    ageModifier: { gt: 50, add: 15 },
  },

  // ── ENT ──────────────────────────────────────────────────────────
  {
    id: 'allergic_rhinitis',
    name: 'Allergic rhinitis / hay fever',
    category: 'ENT',
    urgency: 'routine',
    basePrior: 8,
    symptomWeights: {
      'nasal discharge': 35,
      'post-nasal drip': 22,
      'loss of smell': 15,
      'snoring': 10,
      'cough': 8,
      'dry cough': 8,
      'pruritus': 6,
      'ear pain': 4,
    },
    negativeWeights: { 'fever': -4 },
  },
  {
    id: 'sinusitis',
    name: 'Acute / chronic sinusitis',
    category: 'ENT',
    urgency: 'routine',
    basePrior: 7,
    symptomWeights: {
      'facial pain': 30,
      'nasal discharge': 25,
      'headache': 15,
      'post-nasal drip': 18,
      'loss of smell': 12,
      'fever': 10,
    },
  },
  {
    id: 'urti',
    name: 'Upper respiratory tract infection (URTI)',
    category: 'ENT',
    urgency: 'routine',
    basePrior: 10,
    symptomWeights: {
      'sore throat': 25,
      'nasal discharge': 20,
      'cough': 18,
      'dry cough': 12,
      'fever': 16,
      'malaise': 12,
      'headache': 10,
      'fatigue': 8,
    },
  },
  {
    id: 'pharyngitis_tonsillitis',
    name: 'Pharyngitis / tonsillitis',
    category: 'ENT',
    urgency: 'routine',
    basePrior: 8,
    symptomWeights: {
      'sore throat': 35,
      'fever': 18,
      'neck swelling': 12,
      'jaw pain': 8,
      'ear pain': 6,
      'dysphagia': 8,
    },
  },
  {
    id: 'otitis_media',
    name: 'Otitis media',
    category: 'ENT',
    urgency: 'routine',
    basePrior: 6,
    symptomWeights: {
      'ear pain': 35,
      'fever': 15,
      'hearing loss': 18,
      'tinnitus': 8,
    },
  },
  {
    id: 'otitis_externa',
    name: 'Otitis externa',
    category: 'ENT',
    urgency: 'routine',
    basePrior: 5,
    symptomWeights: {
      'ear pain': 30,
      'pruritus': 15,
      'hearing loss': 10,
    },
  },
  {
    id: 'laryngitis',
    name: 'Laryngitis / vocal cord pathology',
    category: 'ENT',
    urgency: 'routine',
    basePrior: 5,
    symptomWeights: {
      'hoarse voice': 35,
      'sore throat': 15,
      'cough': 12,
      'dry cough': 12,
      'stridor': 8,
    },
  },
  {
    id: 'epistaxis_ent',
    name: 'Epistaxis (nosebleed)',
    category: 'ENT',
    urgency: 'routine',
    basePrior: 5,
    symptomWeights: {
      'epistaxis': 55,
      'nasal discharge': 8,
    },
  },

  // ── Respiratory ───────────────────────────────────────────────────
  {
    id: 'pneumonia',
    name: 'Community-acquired pneumonia',
    category: 'Respiratory',
    urgency: 'priority',
    basePrior: 8,
    symptomWeights: {
      'productive cough': 28,
      'fever': 22,
      'shortness of breath': 18,
      'pleuritic chest pain': 18,
      'malaise': 12,
      'rigors': 15,
      'haemoptysis': 10,
    },
  },
  {
    id: 'asthma',
    name: 'Asthma / reactive airways disease',
    category: 'Respiratory',
    urgency: 'priority',
    basePrior: 9,
    symptomWeights: {
      'wheeze': 35,
      'chest tightness': 22,
      'dry cough': 18,
      'shortness of breath': 18,
      'dyspnoea on exertion': 14,
      'nocturnal dyspnoea': 15,
      'cough': 12,
    },
    negativeWeights: { 'productive cough': -5 },
  },
  {
    id: 'copd_exacerbation',
    name: 'COPD / chronic bronchitis exacerbation',
    category: 'Respiratory',
    urgency: 'priority',
    basePrior: 7,
    symptomWeights: {
      'shortness of breath': 22,
      'productive cough': 22,
      'wheeze': 18,
      'dyspnoea on exertion': 18,
      'cough': 14,
    },
    ageModifier: { gt: 50, add: 12 },
  },
  {
    id: 'pulmonary_embolism',
    name: 'Pulmonary embolism',
    category: 'Respiratory',
    urgency: 'urgent',
    basePrior: 5,
    symptomWeights: {
      'pleuritic chest pain': 28,
      'shortness of breath': 22,
      'haemoptysis': 18,
      'syncope': 15,
      'leg swelling': 15,
    },
  },
  {
    id: 'pneumothorax',
    name: 'Spontaneous pneumothorax',
    category: 'Respiratory',
    urgency: 'urgent',
    basePrior: 4,
    symptomWeights: {
      'pleuritic chest pain': 30,
      'shortness of breath': 25,
    },
    sexModifier: { sex: 'male', add: 8 },
  },
  {
    id: 'tuberculosis',
    name: 'Pulmonary tuberculosis',
    category: 'Respiratory',
    urgency: 'priority',
    basePrior: 7,
    symptomWeights: {
      'haemoptysis': 28,
      'night sweats': 25,
      'weight loss': 22,
      'productive cough': 20,
      'fever': 15,
      'fatigue': 12,
      'drenching sweats': 20,
    },
    ageModifier: { gt: 60, add: 8 },
  },
  {
    id: 'lung_cancer',
    name: 'Lung carcinoma',
    category: 'Respiratory',
    urgency: 'priority',
    basePrior: 5,
    symptomWeights: {
      'haemoptysis': 28,
      'weight loss': 22,
      'dry cough': 15,
      'hoarse voice': 18,
      'shortness of breath': 12,
      'dyspnoea on exertion': 10,
    },
    ageModifier: { gt: 50, add: 15 },
  },
  {
    id: 'pleural_effusion',
    name: 'Pleural effusion',
    category: 'Respiratory',
    urgency: 'priority',
    basePrior: 5,
    symptomWeights: {
      'shortness of breath': 22,
      'pleuritic chest pain': 18,
      'dyspnoea on exertion': 18,
      'dry cough': 10,
    },
  },

  // ── Cardiovascular ────────────────────────────────────────────────
  {
    id: 'acs',
    name: 'Acute coronary syndrome (ACS / NSTEMI / STEMI)',
    category: 'Cardiovascular',
    urgency: 'urgent',
    basePrior: 6,
    symptomWeights: {
      'chest pain': 35,
      'shortness of breath': 18,
      'palpitations': 12,
      'syncope': 12,
      'nausea': 10,
      'exertional chest tightness': 20,
    },
    detailWeights: {
      'chest pain.Radiating to arm': 25,
      'chest pain.Radiating to jaw': 22,
      'chest pain.Crushing': 22,
    },
    ageModifier: { gt: 45, add: 10 },
  },
  {
    id: 'heart_failure',
    name: 'Heart failure',
    category: 'Cardiovascular',
    urgency: 'priority',
    basePrior: 7,
    symptomWeights: {
      'shortness of breath': 22,
      'ankle oedema': 28,
      'bilateral leg oedema': 28,
      'leg swelling': 20,
      'orthopnoea': 30,
      'nocturnal dyspnoea': 30,
      'dyspnoea on exertion': 22,
      'fatigue': 12,
    },
    ageModifier: { gt: 55, add: 12 },
  },
  {
    id: 'atrial_fibrillation',
    name: 'Atrial fibrillation / flutter',
    category: 'Cardiovascular',
    urgency: 'priority',
    basePrior: 6,
    symptomWeights: {
      'palpitations': 35,
      'shortness of breath': 18,
      'syncope': 12,
      'near-syncope': 12,
      'fatigue': 10,
    },
    ageModifier: { gt: 55, add: 10 },
  },
  {
    id: 'pericarditis',
    name: 'Pericarditis / myocarditis',
    category: 'Cardiovascular',
    urgency: 'priority',
    basePrior: 3,
    symptomWeights: {
      'chest pain': 28,
      'pleuritic chest pain': 22,
      'fever': 18,
      'shortness of breath': 12,
      'malaise': 10,
    },
  },
  {
    id: 'aortic_dissection',
    name: 'Aortic dissection',
    category: 'Cardiovascular',
    urgency: 'urgent',
    basePrior: 2,
    symptomWeights: {
      'chest pain': 28,
      'back pain': 25,
      'syncope': 15,
    },
    detailWeights: {
      'chest pain.Tearing': 35,
      'chest pain.Sudden onset': 20,
    },
    ageModifier: { gt: 50, add: 8 },
  },
  {
    id: 'dvt',
    name: 'Deep vein thrombosis (DVT)',
    category: 'Cardiovascular',
    urgency: 'priority',
    basePrior: 5,
    symptomWeights: {
      'leg swelling': 28,
      'ankle oedema': 18,
      'limb pain': 15,
    },
  },
  {
    id: 'peripheral_arterial_disease',
    name: 'Peripheral arterial disease / limb ischaemia',
    category: 'Vascular',
    urgency: 'priority',
    basePrior: 5,
    symptomWeights: {
      'claudication': 38,
      'rest pain': 35,
      'cold extremities': 22,
      'cold foot': 22,
      'limb pain': 15,
      'numbness feet': 12,
    },
    ageModifier: { gt: 50, add: 10 },
  },

  // ── Neurological ─────────────────────────────────────────────────
  {
    id: 'stroke_tia',
    name: 'Stroke / TIA',
    category: 'Neurological',
    urgency: 'urgent',
    basePrior: 5,
    symptomWeights: {
      'facial weakness': 38,
      'limb weakness': 35,
      'speech difficulty': 32,
      'word-finding difficulty': 28,
      'headache': 10,
      'confusion': 15,
      'numbness': 18,
      'visual loss': 22,
      'double vision': 15,
    },
    ageModifier: { gt: 55, add: 12 },
  },
  {
    id: 'meningitis',
    name: 'Meningitis / encephalitis',
    category: 'Neurological',
    urgency: 'urgent',
    basePrior: 4,
    symptomWeights: {
      'neck stiffness': 38,
      'headache': 22,
      'fever': 25,
      'photophobia': 30,
      'confusion': 22,
      'rash': 20,
      'petechiae': 30,
      'purpura': 25,
    },
  },
  {
    id: 'migraine_disorder',
    name: 'Migraine',
    category: 'Neurological',
    urgency: 'routine',
    basePrior: 10,
    symptomWeights: {
      'headache': 25,
      'migraine': 45,
      'visual aura': 30,
      'photophobia': 28,
      'nausea': 15,
      'vomiting': 12,
      'dizziness': 10,
    },
  },
  {
    id: 'subarachnoid_haemorrhage',
    name: 'Subarachnoid haemorrhage',
    category: 'Neurological',
    urgency: 'urgent',
    basePrior: 3,
    symptomWeights: {
      'thunderclap headache': 50,
      'neck stiffness': 22,
      'loss of consciousness': 18,
      'blackout': 15,
      'vomiting': 10,
    },
  },
  {
    id: 'epilepsy',
    name: 'Epilepsy / seizure disorder',
    category: 'Neurological',
    urgency: 'priority',
    basePrior: 5,
    symptomWeights: {
      'seizure': 50,
      'loss of consciousness': 20,
      'blackout': 18,
      'confusion': 12,
    },
  },
  {
    id: 'vertigo_vestibular',
    name: 'BPPV / labyrinthitis / vestibular neuritis',
    category: 'Neurological',
    urgency: 'routine',
    basePrior: 8,
    symptomWeights: {
      'vertigo': 42,
      'dizziness': 28,
      'nausea': 15,
      'vomiting': 10,
      'tinnitus': 12,
      'hearing loss': 8,
      'unsteady gait': 14,
    },
  },
  {
    id: 'vasovagal_syncope',
    name: 'Vasovagal / reflex syncope',
    category: 'Neurological',
    urgency: 'routine',
    basePrior: 8,
    symptomWeights: {
      'syncope': 38,
      'pre-syncope': 30,
      'near-syncope': 30,
      'blackout': 22,
      'dizziness': 15,
    },
  },
  {
    id: 'peripheral_neuropathy',
    name: 'Peripheral neuropathy',
    category: 'Neurological',
    urgency: 'routine',
    basePrior: 6,
    symptomWeights: {
      'numbness': 28,
      'tingling': 28,
      'numbness feet': 30,
      'tingling feet': 30,
      'muscle weakness': 15,
      'unsteady gait': 12,
    },
  },

  // ── Endocrine ─────────────────────────────────────────────────────
  {
    id: 'dka_hhs',
    name: 'DKA / hyperglycaemic hyperosmolar state',
    category: 'Endocrine',
    urgency: 'urgent',
    basePrior: 5,
    symptomWeights: {
      'excessive thirst': 30,
      'polyuria': 30,
      'dehydration': 22,
      'confusion': 18,
      'vomiting': 15,
      'abdominal pain': 12,
      'malaise': 12,
      'fatigue': 10,
    },
  },
  {
    id: 'hypoglycaemia',
    name: 'Hypoglycaemia',
    category: 'Endocrine',
    urgency: 'urgent',
    basePrior: 6,
    symptomWeights: {
      'hypoglycaemia episode': 55,
      'confusion': 18,
      'excessive hunger': 20,
      'tremor': 18,
      'syncope': 12,
      'generalised weakness': 12,
    },
  },
  {
    id: 'hyperthyroidism',
    name: 'Hyperthyroidism / thyrotoxicosis',
    category: 'Endocrine',
    urgency: 'priority',
    basePrior: 5,
    symptomWeights: {
      'palpitations': 22,
      'weight loss': 20,
      'tremor': 22,
      'fatigue': 12,
      'diarrhoea': 12,
      'anxiety': 15,
      'drenching sweats': 12,
    },
  },
  {
    id: 'hypothyroidism',
    name: 'Hypothyroidism',
    category: 'Endocrine',
    urgency: 'routine',
    basePrior: 6,
    symptomWeights: {
      'weight gain': 22,
      'fatigue': 22,
      'cold extremities': 15,
      'memory loss': 18,
      'constipation': 15,
      'hair loss': 18,
      'depression': 12,
      'low mood': 12,
    },
    sexModifier: { sex: 'female', add: 8 },
  },
  {
    id: 'addison',
    name: 'Addisonian crisis / adrenal insufficiency',
    category: 'Endocrine',
    urgency: 'urgent',
    basePrior: 2,
    symptomWeights: {
      'fatigue': 20,
      'generalised weakness': 22,
      'vomiting': 18,
      'dehydration': 20,
      'skin discolouration': 18,
      'low mood': 10,
    },
  },

  // ── Haematological ────────────────────────────────────────────────
  {
    id: 'anaemia',
    name: 'Anaemia',
    category: 'Haematology',
    urgency: 'priority',
    basePrior: 8,
    symptomWeights: {
      'fatigue': 22,
      'dyspnoea on exertion': 22,
      'generalised weakness': 20,
      'dizziness': 18,
      'shortness of breath': 15,
      'palpitations': 12,
    },
  },
  {
    id: 'sickle_cell',
    name: 'Sickle cell crisis',
    category: 'Haematology',
    urgency: 'priority',
    basePrior: 6,
    symptomWeights: {
      'bone pain': 35,
      'joint pain': 18,
      'fatigue': 15,
      'jaundice': 15,
      'abdominal pain': 12,
      'fever': 12,
    },
  },
  {
    id: 'lymphoma',
    name: 'Lymphoma (Hodgkin / non-Hodgkin)',
    category: 'Haematology',
    urgency: 'priority',
    basePrior: 4,
    symptomWeights: {
      'neck swelling': 28,
      'night sweats': 25,
      'weight loss': 22,
      'fatigue': 18,
      'pruritus': 18,
      'fever': 12,
      'drenching sweats': 20,
    },
    ageModifier: { gt: 40, add: 8 },
  },
  {
    id: 'leukaemia',
    name: 'Leukaemia / haematological malignancy',
    category: 'Haematology',
    urgency: 'priority',
    basePrior: 3,
    symptomWeights: {
      'fatigue': 18,
      'bruising': 28,
      'petechiae': 30,
      'purpura': 25,
      'weight loss': 15,
      'fever': 12,
      'bone pain': 15,
      'night sweats': 15,
    },
    ageModifier: { gt: 50, add: 8 },
  },

  // ── Genitourinary ─────────────────────────────────────────────────
  {
    id: 'uti',
    name: 'Urinary tract infection (UTI)',
    category: 'Urinary',
    urgency: 'routine',
    basePrior: 10,
    symptomWeights: {
      'dysuria': 40,
      'urinary frequency': 30,
      'suprapubic pain': 25,
      'haematuria': 18,
      'fever': 12,
      'nocturia': 12,
    },
    sexModifier: { sex: 'female', add: 10 },
  },
  {
    id: 'pyelonephritis',
    name: 'Pyelonephritis',
    category: 'Urinary',
    urgency: 'priority',
    basePrior: 6,
    symptomWeights: {
      'loin pain': 35,
      'fever': 25,
      'dysuria': 22,
      'urinary frequency': 18,
      'rigors': 20,
      'nausea': 12,
      'vomiting': 10,
    },
    sexModifier: { sex: 'female', add: 8 },
  },
  {
    id: 'renal_colic',
    name: 'Renal colic / urolithiasis',
    category: 'Urinary',
    urgency: 'priority',
    basePrior: 7,
    symptomWeights: {
      'renal colic': 50,
      'loin pain': 35,
      'haematuria': 25,
      'vomiting': 15,
      'nausea': 12,
    },
  },
  {
    id: 'bph',
    name: 'Benign prostatic hyperplasia (BPH)',
    category: 'Urinary',
    urgency: 'routine',
    basePrior: 8,
    symptomWeights: {
      'poor urinary stream': 38,
      'hesitancy': 32,
      'nocturia': 22,
      'urinary frequency': 18,
      'incomplete bladder emptying': 28,
      'urinary retention': 20,
    },
    sexModifier: { sex: 'male', add: 20 },
    ageModifier: { gt: 50, add: 15 },
  },
  {
    id: 'testicular_epididymis',
    name: 'Testicular torsion / epididymo-orchitis',
    category: 'Urinary',
    urgency: 'urgent',
    basePrior: 3,
    symptomWeights: {
      'scrotal swelling': 45,
      'groin pain': 25,
    },
    sexModifier: { sex: 'male', add: 15 },
  },
  {
    id: 'sti',
    name: 'STI / urethritis / cervicitis',
    category: 'Urinary',
    urgency: 'routine',
    basePrior: 5,
    symptomWeights: {
      'penile discharge': 45,
      'vaginal discharge': 30,
      'dysuria': 18,
      'pelvic pain': 12,
    },
  },

  // ── Gynaecological ───────────────────────────────────────────────
  {
    id: 'ectopic_pregnancy',
    name: 'Ectopic pregnancy',
    category: 'Gynaecological',
    urgency: 'urgent',
    basePrior: 3,
    symptomWeights: {
      'pelvic pain': 30,
      'vaginal bleeding': 25,
      'amenorrhoea': 25,
    },
    sexModifier: { sex: 'female', add: 15 },
  },
  {
    id: 'pid',
    name: 'Pelvic inflammatory disease (PID)',
    category: 'Gynaecological',
    urgency: 'priority',
    basePrior: 5,
    symptomWeights: {
      'pelvic pain': 30,
      'vaginal discharge': 25,
      'fever': 18,
      'dyspareunia': 20,
      'irregular periods': 8,
    },
    sexModifier: { sex: 'female', add: 15 },
  },
  {
    id: 'ovarian_torsion',
    name: 'Ovarian torsion / ovarian cyst',
    category: 'Gynaecological',
    urgency: 'urgent',
    basePrior: 3,
    symptomWeights: {
      'pelvic pain': 35,
      'vomiting': 15,
      'nausea': 12,
    },
    sexModifier: { sex: 'female', add: 15 },
  },
  {
    id: 'endometriosis',
    name: 'Endometriosis',
    category: 'Gynaecological',
    urgency: 'routine',
    basePrior: 6,
    symptomWeights: {
      'dysmenorrhoea': 35,
      'pelvic pain': 28,
      'dyspareunia': 25,
      'menorrhagia': 18,
      'irregular periods': 12,
    },
    sexModifier: { sex: 'female', add: 15 },
  },
  {
    id: 'fibroids',
    name: 'Uterine fibroids',
    category: 'Gynaecological',
    urgency: 'routine',
    basePrior: 7,
    symptomWeights: {
      'menorrhagia': 32,
      'pelvic pressure': 25,
      'pelvic pain': 20,
      'dysmenorrhoea': 15,
      'urinary frequency': 8,
    },
    sexModifier: { sex: 'female', add: 15 },
    ageModifier: { gt: 30, add: 8 },
  },
  {
    id: 'cervical_pathology',
    name: 'Cervical pathology / cervical cancer',
    category: 'Gynaecological',
    urgency: 'priority',
    basePrior: 4,
    symptomWeights: {
      'post-coital bleeding': 38,
      'intermenstrual bleeding': 28,
      'vaginal discharge': 18,
      'pelvic pain': 12,
    },
    sexModifier: { sex: 'female', add: 15 },
  },

  // ── Dermatological ────────────────────────────────────────────────
  {
    id: 'cellulitis_skin',
    name: 'Cellulitis / soft tissue infection',
    category: 'Dermatology',
    urgency: 'priority',
    basePrior: 7,
    symptomWeights: {
      'cellulitis': 45,
      'rash': 10,
      'fever': 18,
      'limb pain': 15,
      'skin discolouration': 12,
    },
  },
  {
    id: 'skin_abscess',
    name: 'Skin abscess / furuncle',
    category: 'Dermatology',
    urgency: 'routine',
    basePrior: 6,
    symptomWeights: {
      'abscess': 50,
      'fever': 12,
      'skin lesion': 12,
    },
  },
  {
    id: 'necrotising_fasciitis',
    name: 'Necrotising fasciitis',
    category: 'Dermatology',
    urgency: 'urgent',
    basePrior: 2,
    symptomWeights: {
      'cellulitis': 20,
      'fever': 25,
      'rigors': 20,
      'limb pain': 22,
    },
  },
  {
    id: 'inflammatory_skin',
    name: 'Eczema / psoriasis / inflammatory dermatosis',
    category: 'Dermatology',
    urgency: 'routine',
    basePrior: 7,
    symptomWeights: {
      'rash': 22,
      'pruritus': 22,
      'eczema': 40,
      'psoriasis': 40,
      'skin lesion': 12,
      'skin discolouration': 10,
    },
  },
  {
    id: 'melanoma',
    name: 'Melanoma / skin malignancy',
    category: 'Dermatology',
    urgency: 'priority',
    basePrior: 3,
    symptomWeights: {
      'pigmented lesion': 42,
      'skin lesion': 20,
      'ulcer': 12,
    },
    ageModifier: { gt: 40, add: 8 },
  },
  {
    id: 'urticaria',
    name: 'Urticaria / allergic reaction',
    category: 'Dermatology',
    urgency: 'routine',
    basePrior: 6,
    symptomWeights: {
      'rash': 28,
      'pruritus': 25,
    },
  },

  // ── Musculoskeletal ───────────────────────────────────────────────
  {
    id: 'osteoarthritis',
    name: 'Osteoarthritis',
    category: 'Musculoskeletal',
    urgency: 'routine',
    basePrior: 9,
    symptomWeights: {
      'joint pain': 28,
      'knee pain': 30,
      'hip pain': 28,
      'joint stiffness': 22,
      'lower back pain': 18,
      'back pain': 15,
      'ankle pain': 15,
    },
    ageModifier: { gt: 50, add: 15 },
  },
  {
    id: 'rheumatoid_arthritis',
    name: 'Rheumatoid arthritis',
    category: 'Musculoskeletal',
    urgency: 'routine',
    basePrior: 5,
    symptomWeights: {
      'joint pain': 25,
      'morning stiffness': 35,
      'joint swelling': 28,
      'fatigue': 15,
      'wrist pain': 22,
      'elbow pain': 15,
      'shoulder pain': 15,
    },
    sexModifier: { sex: 'female', add: 8 },
  },
  {
    id: 'gout',
    name: 'Gout / pseudogout',
    category: 'Musculoskeletal',
    urgency: 'routine',
    basePrior: 6,
    symptomWeights: {
      'joint pain': 22,
      'ankle pain': 28,
      'knee pain': 22,
      'joint swelling': 28,
    },
    sexModifier: { sex: 'male', add: 10 },
    ageModifier: { gt: 40, add: 8 },
  },
  {
    id: 'septic_arthritis',
    name: 'Septic arthritis',
    category: 'Musculoskeletal',
    urgency: 'urgent',
    basePrior: 3,
    symptomWeights: {
      'joint pain': 20,
      'joint swelling': 25,
      'fever': 25,
      'joint stiffness': 15,
    },
  },
  {
    id: 'lumbar_disc_disease',
    name: 'Lumbar disc disease / sciatica',
    category: 'Musculoskeletal',
    urgency: 'routine',
    basePrior: 8,
    symptomWeights: {
      'lower back pain': 35,
      'back pain': 20,
      'limb pain': 22,
      'numbness': 18,
      'tingling': 18,
      'muscle weakness': 12,
    },
  },
  {
    id: 'acute_limb_ischaemia',
    name: 'Acute limb ischaemia',
    category: 'Vascular',
    urgency: 'urgent',
    basePrior: 3,
    symptomWeights: {
      'rest pain': 35,
      'cold extremities': 28,
      'cold foot': 28,
      'limb pain': 22,
      'limb weakness': 18,
      'numbness': 15,
    },
  },

  // ── GI (General medicine additions) ──────────────────────────────
  {
    id: 'gord',
    name: 'GORD / acid reflux / oesophagitis',
    category: 'Upper GI',
    urgency: 'routine',
    basePrior: 12,
    symptomWeights: {
      'heartburn': 45,
      'regurgitation': 38,
      'chest pain': 15,
      'indigestion': 28,
      'belching': 18,
      'nausea': 12,
      'epigastric pain': 20,
      'cough': 10,
      'hoarse voice': 8,
    },
  },
  {
    id: 'ibs',
    name: 'Irritable bowel syndrome (IBS)',
    category: 'GI',
    urgency: 'routine',
    basePrior: 10,
    symptomWeights: {
      'abdominal pain': 18,
      'diarrhoea': 22,
      'constipation': 18,
      'change in bowel habit': 22,
      'bloating': 25,
      'flatulence': 20,
      'faecal urgency': 18,
    },
    sexModifier: { sex: 'female', add: 6 },
  },
  {
    id: 'ibd',
    name: "Inflammatory bowel disease (Crohn's / UC)",
    category: 'GI',
    urgency: 'priority',
    basePrior: 6,
    symptomWeights: {
      'diarrhoea': 28,
      'abdominal pain': 18,
      'rectal bleeding': 20,
      'change in bowel habit': 18,
      'weight loss': 15,
      'fatigue': 12,
      'mucus in stool': 20,
      'tenesmus': 18,
    },
  },
  {
    id: 'gastroenteritis',
    name: 'Acute gastroenteritis',
    category: 'GI',
    urgency: 'routine',
    basePrior: 10,
    symptomWeights: {
      'diarrhoea': 30,
      'vomiting': 25,
      'nausea': 22,
      'abdominal pain': 18,
      'fever': 12,
      'dehydration': 18,
    },
  },
  {
    id: 'haemorrhoids',
    name: 'Haemorrhoids / anorectal disease',
    category: 'Colorectal',
    urgency: 'routine',
    basePrior: 12,
    symptomWeights: {
      'rectal bleeding': 28,
      'perianal pain': 28,
      'anal discharge': 18,
      'rectal pain': 22,
      'pruritus': 15,
      'incomplete evacuation': 12,
    },
    negativeWeights: { 'weight loss': -8 },
  },
  {
    id: 'liver_disease',
    name: 'Liver disease / hepatitis / cirrhosis',
    category: 'Biliary',
    urgency: 'priority',
    basePrior: 5,
    symptomWeights: {
      'jaundice': 28,
      'abdominal distension': 28,
      'right upper quadrant pain': 22,
      'pruritus': 20,
      'dark urine': 15,
      'pale stool': 12,
      'fatigue': 15,
      'nausea': 10,
    },
    ageModifier: { gt: 40, add: 8 },
  },

  // ── Psychiatric / Functional ──────────────────────────────────────
  {
    id: 'depression',
    name: 'Major depressive disorder',
    category: 'Psychiatric',
    urgency: 'routine',
    basePrior: 8,
    symptomWeights: {
      'depression': 45,
      'low mood': 40,
      'fatigue': 20,
      'insomnia': 20,
      'social withdrawal': 28,
      'weight loss': 12,
      'poor concentration': 22,
      'loss of appetite': 15,
      'fatigue (functional)': 22,
    },
  },
  {
    id: 'anxiety_gad',
    name: 'Generalised anxiety disorder',
    category: 'Psychiatric',
    urgency: 'routine',
    basePrior: 9,
    symptomWeights: {
      'anxiety': 45,
      'palpitations': 18,
      'shortness of breath': 12,
      'panic attacks': 20,
      'dizziness': 12,
      'chest tightness': 12,
      'insomnia': 18,
      'poor concentration': 18,
      'fatigue (functional)': 18,
    },
  },
  {
    id: 'panic_disorder',
    name: 'Panic disorder',
    category: 'Psychiatric',
    urgency: 'routine',
    basePrior: 7,
    symptomWeights: {
      'panic attacks': 50,
      'palpitations': 22,
      'shortness of breath': 18,
      'chest tightness': 18,
      'dizziness': 15,
      'anxiety': 25,
    },
  },
  {
    id: 'functional_somatic',
    name: 'Functional / somatic disorder (MUS)',
    category: 'Psychiatric',
    urgency: 'routine',
    basePrior: 6,
    symptomWeights: {
      'unexplained symptoms': 45,
      'fatigue (functional)': 38,
      'anxiety': 15,
      'depression': 12,
      'stress': 15,
    },
  },

  // ── Infectious / Tropical ─────────────────────────────────────────
  {
    id: 'sepsis',
    name: 'Sepsis / systemic infection',
    category: 'Infectious',
    urgency: 'urgent',
    basePrior: 5,
    symptomWeights: {
      'fever': 28,
      'rigors': 28,
      'confusion': 22,
      'generalised weakness': 18,
      'drenching sweats': 22,
      'malaise': 15,
      'shortness of breath': 15,
    },
  },
  {
    id: 'malaria',
    name: 'Malaria',
    category: 'Infectious',
    urgency: 'urgent',
    basePrior: 6,
    symptomWeights: {
      'fever': 25,
      'rigors': 30,
      'headache': 18,
      'malaise': 15,
      'vomiting': 15,
      'fatigue': 12,
      'drenching sweats': 25,
    },
  },
  {
    id: 'dengue',
    name: 'Dengue fever',
    category: 'Infectious',
    urgency: 'priority',
    basePrior: 7,
    symptomWeights: {
      'fever': 25,
      'joint pain': 25,
      'muscle pain': 25,
      'bone pain': 25,
      'rash': 20,
      'headache': 18,
      'rigors': 15,
      'fatigue': 15,
      'petechiae': 18,
    },
  },
  {
    id: 'leptospirosis',
    name: 'Leptospirosis',
    category: 'Infectious',
    urgency: 'priority',
    basePrior: 4,
    symptomWeights: {
      'fever': 22,
      'muscle pain': 25,
      'headache': 18,
      'jaundice': 18,
      'malaise': 15,
      'rigors': 15,
    },
  },
  {
    id: 'covid19',
    name: 'COVID-19 / viral respiratory illness',
    category: 'Infectious',
    urgency: 'priority',
    basePrior: 5,
    symptomWeights: {
      'fever': 20,
      'dry cough': 22,
      'shortness of breath': 18,
      'fatigue': 18,
      'loss of smell': 30,
      'malaise': 15,
      'headache': 12,
    },
  },
  {
    id: 'pancreatic_cancer',
    name: 'Pancreatic adenocarcinoma',
    category: 'HPB',
    urgency: 'priority',
    basePrior: 4,
    keywords: ['painless jaundice', 'weight loss', 'epigastric pain', 'back pain', 'anorexia'],
    investigations: ['CT pancreas protocol', 'CA 19-9', 'MRCP / ERCP', 'EUS + biopsy', 'LFTs + bilirubin'],
    symptomWeights: {
      'jaundice': 28,
      'weight loss': 22,
      'epigastric pain': 18,
      'abdominal pain': 14,
      'dark urine': 16,
      'pale stool': 16,
      'anorexia': 14,
      'pruritus': 12,
      'fatigue': 10,
    },
    detailWeights: {
      'jaundice.Painless': 30,
      'abdominal pain.Radiation to back': 22,
      'epigastric pain.Radiation to back': 22,
    },
    ageModifier: { gt: 55, add: 10 },
  },
  {
    id: 'gastric_cancer',
    name: 'Gastric carcinoma',
    category: 'Oncology',
    urgency: 'priority',
    basePrior: 4,
    keywords: ['early satiety', 'weight loss', 'epigastric pain', 'dysphagia', 'melaena'],
    investigations: ['OGD + biopsy', 'CT chest/abdomen/pelvis', 'EUS staging', 'FBC + iron studies', 'CEA / CA 72-4'],
    symptomWeights: {
      'weight loss': 22,
      'epigastric pain': 18,
      'early satiety': 20,
      'anorexia': 16,
      'dysphagia': 14,
      'nausea': 10,
      'vomiting': 10,
      'melaena': 14,
      'haematemesis': 12,
      'fatigue': 8,
    },
    detailWeights: {
      'epigastric pain.Persistent': 15,
      'weight loss.Unintentional': 18,
      'dysphagia.Progressive': 14,
    },
    ageModifier: { gt: 50, add: 12 },
  },
  {
    id: 'hepatocellular_carcinoma',
    name: 'Hepatocellular carcinoma (HCC)',
    category: 'HPB',
    urgency: 'priority',
    basePrior: 4,
    keywords: ['hepatitis B/C background', 'RUQ mass', 'weight loss', 'cirrhosis', 'raised AFP'],
    investigations: ['Alpha-fetoprotein (AFP)', 'Ultrasound liver', 'CT / MRI liver (LI-RADS protocol)', 'LFTs + coagulation', 'Hepatitis B/C serology', 'Core needle biopsy'],
    symptomWeights: {
      'right upper quadrant pain': 22,
      'weight loss': 18,
      'jaundice': 14,
      'abdominal distension': 14,
      'fatigue': 12,
      'anorexia': 14,
      'lump in abdomen': 16,
      'abdominal pain': 10,
    },
    detailWeights: {
      'right upper quadrant pain.Progressive': 16,
      'abdominal distension.Ascites': 14,
    },
    ageModifier: { gt: 40, add: 8 },
    sexModifier: { sex: 'male', add: 8 },
  },
  {
    id: 'cholangiocarcinoma',
    name: 'Cholangiocarcinoma',
    category: 'HPB',
    urgency: 'priority',
    basePrior: 3,
    keywords: ['progressive jaundice', 'pruritus', 'weight loss', 'pale stool', 'dark urine'],
    investigations: ['MRCP', 'CT abdomen/chest', 'CA 19-9 + CEA', 'ERCP + biliary brushings', 'LFTs / bilirubin', 'EUS'],
    symptomWeights: {
      'jaundice': 28,
      'pruritus': 20,
      'dark urine': 18,
      'pale stool': 18,
      'weight loss': 18,
      'right upper quadrant pain': 14,
      'anorexia': 12,
      'fatigue': 10,
      'abdominal pain': 8,
    },
    detailWeights: {
      'jaundice.Painless': 20,
      'jaundice.Progressive': 24,
      'pruritus.Without rash': 16,
    },
    ageModifier: { gt: 55, add: 10 },
  },
  {
    id: 'chronic_pancreatitis',
    name: 'Chronic pancreatitis',
    category: 'HPB',
    urgency: 'routine',
    basePrior: 5,
    keywords: ['recurrent epigastric pain', 'radiation to back', 'steatorrhoea', 'weight loss', 'alcohol history'],
    investigations: ['Serum lipase / amylase', 'CT pancreas', 'MRCP', 'Faecal elastase', 'HbA1c + fasting glucose', 'Nutritional markers (albumin, B12, fat-soluble vitamins)'],
    symptomWeights: {
      'epigastric pain': 22,
      'abdominal pain': 16,
      'weight loss': 14,
      'diarrhoea': 12,
      'nausea': 10,
      'vomiting': 8,
      'anorexia': 10,
      'fatigue': 8,
      'bloating': 8,
    },
    detailWeights: {
      'epigastric pain.Radiation to back': 20,
      'abdominal pain.Radiation to back': 20,
      'diarrhoea.Fatty / oily stool': 15,
      'epigastric pain.Worse after eating': 14,
    },
  },
  {
    id: 'alcohol_pancreatitis',
    name: 'Acute alcoholic pancreatitis',
    category: 'HPB',
    urgency: 'priority',
    basePrior: 5,
    keywords: ['severe epigastric pain', 'radiation to back', 'nausea and vomiting', 'alcohol use', 'elevated lipase'],
    investigations: ['Serum lipase / amylase', 'CT abdomen (Balthazar grading)', 'FBC / CRP / LFTs', 'Calcium / glucose', 'U&E / creatinine', 'Urine / serum alcohol level'],
    symptomWeights: {
      'epigastric pain': 26,
      'abdominal pain': 18,
      'nausea': 18,
      'vomiting': 18,
      'fever': 10,
      'anorexia': 10,
      'abdominal distension': 8,
      'malaise': 8,
    },
    detailWeights: {
      'epigastric pain.Radiation to back': 22,
      'abdominal pain.Radiation to back': 22,
      'epigastric pain.Severe': 20,
      'epigastric pain.Worse after alcohol': 18,
    },
    sexModifier: { sex: 'male', add: 6 },
  },
  {
    id: 'small_bowel_obstruction',
    name: 'Adhesive small bowel obstruction',
    category: 'HPB',
    urgency: 'urgent',
    basePrior: 7,
    keywords: ['colicky abdominal pain', 'bile-stained vomiting', 'abdominal distension', 'absolute constipation', 'previous abdominal surgery'],
    investigations: ['Erect + supine AXR', 'CT abdomen/pelvis with contrast', 'FBC / U&E / serum lactate', 'Serum amylase / lipase'],
    symptomWeights: {
      'abdominal pain': 24,
      'vomiting': 22,
      'abdominal distension': 22,
      'constipation': 18,
      'nausea': 14,
      'bloating': 12,
      'fever': 8,
    },
    detailWeights: {
      'abdominal pain.Colicky': 22,
      'vomiting.Bile-stained': 18,
      'constipation.Absolute (no flatus)': 20,
    },
  },
  {
    id: 'large_bowel_obstruction',
    name: 'Large bowel obstruction',
    category: 'HPB',
    urgency: 'urgent',
    basePrior: 5,
    keywords: ['progressive abdominal distension', 'absolute constipation', 'colicky pain', 'change in bowel habit'],
    investigations: ['CT abdomen/pelvis with contrast', 'Erect + supine AXR', 'FBC / U&E / serum lactate', 'CEA / CA 19-9', 'Colonoscopy (if clinically stable)'],
    symptomWeights: {
      'abdominal distension': 24,
      'constipation': 24,
      'abdominal pain': 18,
      'vomiting': 14,
      'nausea': 10,
      'change in bowel habit': 16,
      'bloating': 12,
      'rectal bleeding': 10,
    },
    detailWeights: {
      'constipation.Absolute (no flatus)': 22,
      'abdominal distension.Progressive': 18,
      'change in bowel habit.Recent onset': 14,
    },
    ageModifier: { gt: 50, add: 8 },
  },
  {
    id: 'sigmoid_volvulus',
    name: 'Sigmoid volvulus',
    category: 'HPB',
    urgency: 'urgent',
    basePrior: 4,
    keywords: ['sudden massive distension', 'absolute constipation', 'colicky pain', 'coffee-bean sign on AXR'],
    investigations: ['Erect AXR (coffee-bean sign)', 'CT abdomen/pelvis', 'FBC / U&E / serum lactate', 'Flexible sigmoidoscopy (diagnosis and decompression)'],
    symptomWeights: {
      'abdominal distension': 26,
      'abdominal pain': 20,
      'constipation': 22,
      'vomiting': 12,
      'nausea': 10,
      'bloating': 12,
      'fever': 8,
    },
    detailWeights: {
      'constipation.Absolute (no flatus)': 20,
      'abdominal distension.Sudden onset': 22,
      'abdominal pain.Colicky': 16,
    },
    ageModifier: { gt: 60, add: 8 },
  },
  {
    id: 'mesenteric_ischaemia',
    name: 'Acute mesenteric ischaemia',
    category: 'Vascular',
    urgency: 'urgent',
    basePrior: 3,
    keywords: ['pain out of proportion to examination', 'atrial fibrillation', 'bloody diarrhoea', 'raised lactate', 'sudden onset'],
    investigations: ['CT mesenteric angiography', 'Serum lactate', 'FBC / coagulation / U&E', 'ECG (atrial fibrillation?)', 'LFTs / amylase', 'ABG / base excess'],
    symptomWeights: {
      'abdominal pain': 28,
      'nausea': 16,
      'vomiting': 14,
      'diarrhoea': 14,
      'rectal bleeding': 12,
      'fever': 8,
      'palpitations': 10,
    },
    detailWeights: {
      'abdominal pain.Severe': 24,
      'abdominal pain.Sudden onset': 22,
      'diarrhoea.Bloody': 18,
      'abdominal pain.Out of proportion to tenderness': 26,
    },
    ageModifier: { gt: 60, add: 10 },
  },
  {
    id: 'perforated_peptic_ulcer',
    name: 'Perforated peptic ulcer',
    category: 'HPB',
    urgency: 'urgent',
    basePrior: 6,
    keywords: ['sudden severe epigastric pain', 'board-like rigidity', 'free gas on CXR', 'generalised peritonitis'],
    investigations: ['Erect CXR (subdiaphragmatic free gas)', 'CT abdomen (pneumoperitoneum)', 'FBC / U&E / amylase / CRP', 'H. pylori testing', 'Serum lactate'],
    symptomWeights: {
      'epigastric pain': 26,
      'abdominal pain': 22,
      'nausea': 14,
      'vomiting': 12,
      'fever': 12,
      'rigors': 8,
      'malaise': 8,
    },
    detailWeights: {
      'epigastric pain.Sudden onset': 25,
      'epigastric pain.Severe': 22,
      'abdominal pain.Generalised': 18,
      'abdominal pain.Sudden onset': 22,
    },
  },
  {
    id: 'aaa_symptomatic',
    name: 'Symptomatic / ruptured abdominal aortic aneurysm',
    category: 'Vascular',
    urgency: 'urgent',
    basePrior: 3,
    keywords: ['pulsatile abdominal mass', 'severe back or flank pain', 'haemodynamic collapse', 'older male smoker'],
    investigations: ['Emergency bedside USS (AAA screen)', 'CT aorta with contrast (if stable)', 'FBC + crossmatch + coagulation', 'U&E / creatinine', 'ECG'],
    symptomWeights: {
      'abdominal pain': 22,
      'back pain': 22,
      'loin pain': 18,
      'pulsatile mass': 28,
      'syncope': 16,
      'near-syncope': 14,
      'fatigue': 6,
    },
    detailWeights: {
      'abdominal pain.Sudden onset': 20,
      'back pain.Sudden onset': 20,
      'abdominal pain.Tearing': 22,
      'loin pain.Sudden onset': 18,
    },
    ageModifier: { gt: 60, add: 12 },
    sexModifier: { sex: 'male', add: 10 },
  },
  {
    id: 'portal_hypertension',
    name: 'Portal hypertension / oesophageal varices',
    category: 'HPB',
    urgency: 'priority',
    basePrior: 4,
    keywords: ['haematemesis', 'ascites', 'cirrhosis background', 'splenomegaly', 'variceal bleeding'],
    investigations: ['OGD (variceal assessment and banding)', 'USS abdomen + portal Doppler', 'LFTs / coagulation / FBC', 'Hepatitis B/C serology', 'Serum albumin + INR', 'CT abdomen'],
    symptomWeights: {
      'haematemesis': 28,
      'melaena': 22,
      'abdominal distension': 20,
      'jaundice': 14,
      'fatigue': 10,
      'weight loss': 10,
      'ankle oedema': 10,
      'abdominal pain': 8,
      'coffee-ground vomiting': 16,
      'black stool': 14,
    },
    detailWeights: {
      'haematemesis.Massive': 25,
      'haematemesis.Fresh blood': 22,
      'abdominal distension.Ascites': 18,
    },
  },
  {
    id: 'mesenteric_adenitis',
    name: 'Mesenteric adenitis',
    category: 'Infectious',
    urgency: 'routine',
    basePrior: 5,
    keywords: ['right iliac fossa pain', 'recent viral URTI', 'lymphadenopathy', 'young patient', 'no peritonism'],
    investigations: ['USS abdomen (enlarged mesenteric nodes)', 'FBC + CRP + ESR', 'CT abdomen/pelvis (if appendicitis cannot be excluded)', 'Throat swab / viral serology', 'EBV / Monospot test'],
    symptomWeights: {
      'abdominal pain': 22,
      'fever': 16,
      'nausea': 12,
      'vomiting': 10,
      'malaise': 12,
      'sore throat': 14,
      'lymphadenopathy': 14,
      'diarrhoea': 8,
    },
    detailWeights: {
      'abdominal pain.Right iliac fossa': 20,
      'sore throat.Recent': 14,
      'fever.Low-grade': 12,
    },
    ageModifier: { lt: 20, add: 10 },
  },
  {
    id: 'gist',
    name: 'Gastrointestinal stromal tumour (GIST)',
    category: 'Oncology',
    urgency: 'priority',
    basePrior: 2,
    keywords: ['GI bleeding', 'abdominal mass', 'early satiety', 'incidental finding on imaging', 'epigastric pain'],
    investigations: ['CT abdomen/pelvis with contrast', 'OGD / colonoscopy', 'EUS + core biopsy', 'CD117 / DOG1 immunohistochemistry', 'KIT / PDGFRA mutation analysis', 'PET-CT (staging)'],
    symptomWeights: {
      'abdominal pain': 18,
      'melaena': 16,
      'haematemesis': 14,
      'early satiety': 16,
      'weight loss': 14,
      'lump in abdomen': 20,
      'fatigue': 12,
      'nausea': 8,
      'rectal bleeding': 10,
    },
    detailWeights: {
      'lump in abdomen.Smooth mobile': 16,
      'abdominal pain.Epigastric': 14,
      'melaena.Without obvious cause': 18,
    },
    ageModifier: { gt: 50, add: 6 },
  },
  {
    id: 'anal_fissure',
    name: 'Anal fissure',
    category: 'Anorectal',
    urgency: 'routine',
    basePrior: 8,
    keywords: ['tearing anal pain on defecation', 'bright red rectal bleeding', 'constipation', 'anal spasm'],
    investigations: [
      'Proctoscopy / anoscopy',
      'EUA if examination not tolerated in clinic',
      'Digital rectal examination',
      'Colonoscopy if age >45 or atypical features',
    ],
    symptomWeights: {
      'rectal pain': 28,
      'perianal pain': 24,
      'rectal bleeding': 20,
      'constipation': 16,
      'incomplete evacuation': 10,
    },
    detailWeights: {
      'rectal pain.During defecation': 22,
      'rectal bleeding.Bright red': 18,
      'constipation.Chronic': 8,
    },
    negativeWeights: {
      'fever': -14,
      'perianal lump': -10,
      'anal discharge': -8,
      'weight loss': -12,
    },
  },
  {
    id: 'perianal_abscess',
    name: 'Perianal abscess',
    category: 'Anorectal',
    urgency: 'priority',
    basePrior: 7,
    keywords: ['throbbing perianal pain', 'perianal swelling', 'fever', 'fluctuant tender mass'],
    investigations: [
      'Clinical examination',
      'FBC + CRP + blood cultures',
      'MRI pelvis (horseshoe / supralevator abscess)',
      'EUA if complex or not fully assessed in clinic',
      'Blood glucose (screen for diabetes)',
    ],
    symptomWeights: {
      'perianal pain': 28,
      'perianal lump': 26,
      'abscess': 24,
      'fever': 22,
      'rectal pain': 14,
      'anal discharge': 12,
    },
    detailWeights: {
      'perianal pain.Constant throbbing': 20,
      'fever.High grade': 16,
      'perianal lump.Tender': 20,
    },
    negativeWeights: {
      'weight loss': -8,
      'rectal bleeding': -6,
      'change in bowel habit': -6,
      'rectal prolapse': -14,
    },
    ageModifier: { gt: 20, lt: 60, add: 4 },
  },
  {
    id: 'pilonidal_abscess',
    name: 'Pilonidal sinus / abscess',
    category: 'Anorectal',
    urgency: 'priority',
    basePrior: 6,
    keywords: ['natal cleft pain and swelling', 'midline pit / sinus', 'hairy young male', 'sacrococcygeal abscess'],
    investigations: [
      'Clinical examination',
      'FBC + CRP',
      'MRI sacrococcygeal region (complex / recurrent disease)',
      'Wound swab for culture and sensitivity',
    ],
    symptomWeights: {
      'abscess': 24,
      'wound discharge': 20,
      'perianal pain': 22,
      'fever': 16,
      'anal discharge': 12,
    },
    detailWeights: {
      'abscess.Sacrococcygeal': 28,
      'wound discharge.Purulent': 14,
      'perianal pain.Natal cleft': 20,
    },
    negativeWeights: {
      'rectal bleeding': -10,
      'rectal prolapse': -14,
      'faecal incontinence': -12,
      'change in bowel habit': -8,
    },
    ageModifier: { gt: 15, lt: 40, add: 10 },
    sexModifier: { sex: 'male', add: 8 },
  },
  {
    id: 'anal_fistula',
    name: 'Fistula in ano',
    category: 'Anorectal',
    urgency: 'routine',
    basePrior: 6,
    keywords: ['chronic perianal discharge', 'recurrent perianal abscess', 'external opening on perianal skin', 'intermittent pain'],
    investigations: [
      'MRI pelvis (gold standard for tract mapping)',
      'EUA + probing of tract',
      'Proctoscopy / anoscopy',
      'Endoanal ultrasound',
      'Colonoscopy if Crohn\'s disease suspected',
    ],
    symptomWeights: {
      'anal discharge': 28,
      'wound discharge': 22,
      'perianal pain': 18,
      'perianal lump': 16,
      'abscess': 14,
      'rectal pain': 12,
    },
    detailWeights: {
      'anal discharge.Chronic / recurrent': 24,
      'perianal pain.Intermittent': 14,
      'abscess.Recurrent': 20,
    },
    negativeWeights: {
      'fever': -6,
      'rectal bleeding': -8,
      'weight loss': -10,
      'change in bowel habit': -6,
    },
  },
  {
    id: 'fournier_gangrene',
    name: "Fournier's gangrene",
    category: 'Anorectal',
    urgency: 'urgent',
    basePrior: 2,
    keywords: ['perineal necrotising fasciitis', 'rapidly spreading erythema / crepitus', 'systemic sepsis', 'scrotal / perineal pain'],
    investigations: [
      'CT abdomen/pelvis (gas tracking in soft tissues)',
      'FBC + CRP + lactate + blood cultures',
      'U&E + LFTs + coagulation screen',
      'Blood glucose (diabetes common comorbidity)',
      'EUA + urgent surgical debridement',
    ],
    symptomWeights: {
      'perianal pain': 26,
      'fever': 24,
      'scrotal swelling': 22,
      'cellulitis': 20,
      'rigors': 18,
      'malaise': 16,
    },
    detailWeights: {
      'fever.High grade': 18,
      'perianal pain.Rapidly worsening': 24,
      'cellulitis.Spreading': 22,
      'scrotal swelling.Rapidly enlarging': 20,
    },
    negativeWeights: {
      'rectal bleeding': -6,
      'constipation': -8,
      'weight loss': -6,
    },
    ageModifier: { gt: 50, add: 8 },
    sexModifier: { sex: 'male', add: 10 },
  },
  {
    id: 'hidradenitis',
    name: 'Hidradenitis suppurativa',
    category: 'Anorectal',
    urgency: 'routine',
    basePrior: 4,
    keywords: ['recurrent axillary / groin / perianal abscesses', 'sinus tracts and scarring', 'multiple sites', 'chronic relapsing course'],
    investigations: [
      'Clinical examination and Hurley staging',
      'Wound swab and culture',
      'Skin biopsy if diagnosis uncertain',
      'MRI pelvis if deep perianal tracts present',
      'Dermatology / colorectal MDT review',
    ],
    symptomWeights: {
      'abscess': 24,
      'wound discharge': 20,
      'skin lesion': 20,
      'cellulitis': 16,
      'perianal pain': 14,
      'anal discharge': 12,
    },
    detailWeights: {
      'abscess.Recurrent': 28,
      'abscess.Multiple sites': 24,
      'skin lesion.Scarring / sinus tracts': 22,
      'wound discharge.Chronic': 16,
    },
    negativeWeights: {
      'fever': -6,
      'rectal bleeding': -10,
      'weight loss': -8,
      'rectal prolapse': -14,
    },
    ageModifier: { gt: 18, lt: 45, add: 8 },
  },
  {
    id: 'rectal_prolapse',
    name: 'Rectal prolapse',
    category: 'Anorectal',
    urgency: 'routine',
    basePrior: 4,
    keywords: ['tissue protruding from anus on straining', 'faecal incontinence', 'mucus discharge', 'post-menopausal female'],
    investigations: [
      'Clinical examination with straining',
      'Defecating proctogram / dynamic MRI defecography',
      'Colonoscopy (exclude colorectal pathology)',
      'Anorectal physiology and manometry',
      'Endoanal ultrasound (sphincter integrity)',
    ],
    symptomWeights: {
      'rectal prolapse': 30,
      'faecal incontinence': 24,
      'mucus in stool': 18,
      'incomplete evacuation': 16,
      'rectal bleeding': 14,
      'constipation': 12,
    },
    detailWeights: {
      'rectal prolapse.Full thickness': 28,
      'faecal incontinence.Passive': 18,
      'mucus in stool.On underwear': 16,
    },
    negativeWeights: {
      'fever': -10,
      'weight loss': -12,
      'perianal pain': -6,
      'abscess': -12,
    },
    ageModifier: { gt: 50, add: 10 },
    sexModifier: { sex: 'female', add: 8 },
  },
  {
    id: 'anal_cancer',
    name: 'Squamous cell carcinoma of the anus',
    category: 'Anorectal',
    urgency: 'priority',
    basePrior: 2,
    keywords: ['anal mass / ulcer', 'persistent rectal bleeding', 'anal pain', 'HPV-associated', 'perianal induration'],
    investigations: [
      'EUA + biopsy (histology essential)',
      'MRI pelvis (local staging)',
      'CT chest / abdomen / pelvis (distant staging)',
      'PET-CT (nodal and distant disease)',
      'HIV and HPV testing',
      'Inguinal lymph node assessment',
    ],
    symptomWeights: {
      'rectal bleeding': 22,
      'perianal lump': 22,
      'perianal pain': 20,
      'ulcer': 20,
      'weight loss': 18,
      'anal discharge': 14,
      'change in bowel habit': 14,
    },
    detailWeights: {
      'perianal lump.Hard / irregular': 26,
      'ulcer.Non-healing': 24,
      'rectal bleeding.Persistent': 18,
      'weight loss.Unintentional': 16,
    },
    negativeWeights: {
      'fever': -6,
      'constipation': -4,
      'rectal prolapse': -12,
    },
    ageModifier: { gt: 45, add: 10 },
  },
  {
    id: 'stemi',
    name: 'ST-elevation myocardial infarction (STEMI)',
    category: 'Cardiovascular',
    urgency: 'urgent',
    basePrior: 6,
    keywords: ['crushing chest pain', 'radiation to arm or jaw', 'ST elevation on ECG', 'troponin rise', 'diaphoresis'],
    investigations: [
      '12-lead ECG (immediate)',
      'High-sensitivity troponin I/T (serial)',
      'Echocardiogram',
      'Urgent coronary angiography / primary PCI',
      'CXR',
      'FBC, U&E, coagulation screen',
    ],
    symptomWeights: {
      'chest pain': 40,
      'shortness of breath': 18,
      'palpitations': 12,
      'nausea': 12,
      'vomiting': 8,
      'syncope': 10,
      'near-syncope': 8,
      'fatigue': 6,
    },
    detailWeights: {
      'chest pain.Radiation to left arm': 22,
      'chest pain.Radiation to jaw': 20,
      'chest pain.Crushing or pressure quality': 18,
      'chest pain.Onset at rest': 12,
    },
    negativeWeights: {
      'pleuritic chest pain': -10,
      'cough': -6,
    },
    ageModifier: { gt: 45, add: 8 },
    sexModifier: { sex: 'male', add: 6 },
  },
  
  {
    id: 'hypertensive_emergency',
    name: 'Hypertensive emergency / hypertensive encephalopathy',
    category: 'Cardiovascular',
    urgency: 'urgent',
    basePrior: 5,
    keywords: ['severe headache', 'very high blood pressure', 'confusion', 'visual disturbance', 'end-organ damage'],
    investigations: [
      'BP measurement both arms (serial)',
      'CT head (exclude haemorrhage)',
      'ECG',
      'Fundoscopy (papilloedema / haemorrhages)',
      'Renal function, urinalysis',
      'FBC, troponin, echocardiogram',
    ],
    symptomWeights: {
      'headache': 32,
      'confusion': 26,
      'visual loss': 20,
      'nausea': 14,
      'vomiting': 12,
      'chest pain': 14,
      'shortness of breath': 12,
      'seizure': 14,
      'epistaxis': 8,
      'word-finding difficulty': 10,
    },
    detailWeights: {
      'headache.Severe or worst ever': 20,
      'headache.Occipital': 12,
      'visual loss.Bilateral': 14,
      'confusion.Acute onset': 16,
    },
    ageModifier: { gt: 40, add: 6 },
  },
  
  {
    id: 'infective_endocarditis',
    name: 'Infective endocarditis',
    category: 'Cardiovascular',
    urgency: 'urgent',
    basePrior: 3,
    keywords: ['prolonged fever', 'new cardiac murmur', 'embolic phenomena', 'positive blood cultures', 'Osler nodes / Janeway lesions'],
    investigations: [
      'Blood cultures x3 (before antibiotics)',
      'Transthoracic echocardiogram (TTE)',
      'Transoesophageal echocardiogram (TOE)',
      'FBC, CRP, ESR',
      '12-lead ECG',
      'Renal function, urinalysis',
    ],
    symptomWeights: {
      'fever': 30,
      'rigors': 18,
      'fatigue': 16,
      'malaise': 14,
      'night sweats': 14,
      'joint pain': 12,
      'shortness of breath': 12,
      'weight loss': 10,
      'ankle oedema': 8,
      'loss of appetite': 8,
    },
    detailWeights: {
      'fever.Prolonged more than two weeks': 22,
      'malaise.Progressive': 12,
      'fatigue.Associated with new murmur': 14,
    },
    ageModifier: { gt: 30, add: 5 },
  },
  
  {
    id: 'cardiac_tamponade',
    name: 'Cardiac tamponade',
    category: 'Cardiovascular',
    urgency: 'urgent',
    basePrior: 2,
    keywords: ["Beck's triad", 'muffled heart sounds', 'raised JVP', 'pulsus paradoxus', 'pericardial effusion'],
    investigations: [
      'Bedside echocardiogram (urgent — diastolic collapse)',
      'CXR (enlarged globular cardiac silhouette)',
      'ECG (low voltage / electrical alternans)',
      'Pericardiocentesis (diagnostic and therapeutic)',
      'FBC, CRP, troponin',
      'Blood cultures if infective aetiology suspected',
    ],
    symptomWeights: {
      'shortness of breath': 34,
      'chest pain': 22,
      'dyspnoea on exertion': 18,
      'orthopnoea': 16,
      'near-syncope': 14,
      'palpitations': 10,
      'syncope': 10,
      'fatigue': 12,
      'ankle oedema': 8,
    },
    detailWeights: {
      'shortness of breath.Rapidly progressive': 18,
      'chest pain.Dull or pressure': 10,
      'chest pain.Relieved leaning forward': 14,
      'shortness of breath.Worse lying flat': 12,
    },
    negativeWeights: {
      'pleuritic chest pain': -6,
    },
  },
  
  {
    id: 'tension_pneumothorax',
    name: 'Tension pneumothorax',
    category: 'Respiratory',
    urgency: 'urgent',
    basePrior: 3,
    keywords: ['sudden severe dyspnoea', 'tracheal deviation', 'absent breath sounds unilateral', 'hypoxia', 'haemodynamic collapse'],
    investigations: [
      'Clinical diagnosis — treat before imaging if haemodynamically unstable',
      'CXR (after needle decompression if unstable)',
      'CT chest',
      'ABG / pulse oximetry',
      'ECG',
    ],
    symptomWeights: {
      'shortness of breath': 38,
      'chest pain': 26,
      'pleuritic chest pain': 22,
      'near-syncope': 16,
      'palpitations': 10,
      'dyspnoea on exertion': 14,
      'cough': 8,
    },
    detailWeights: {
      'chest pain.Sudden onset': 20,
      'shortness of breath.Sudden onset': 18,
      'pleuritic chest pain.Unilateral': 16,
      'chest pain.Unilateral': 12,
    },
    negativeWeights: {
      'productive cough': -8,
      'fever': -6,
      'night sweats': -6,
      'weight loss': -6,
    },
  },
  
  {
    id: 'empyema_thoracis',
    name: 'Empyema thoracis',
    category: 'Respiratory',
    urgency: 'priority',
    basePrior: 3,
    keywords: ['persistent swinging fever', 'pleuritic chest pain', 'dyspnoea', 'purulent pleural fluid', 'post-pneumonia'],
    investigations: [
      'CXR',
      'CT chest with contrast',
      'Pleural ultrasound and diagnostic tap',
      "Pleural fluid MC&S, pH, LDH, protein (Light's criteria)",
      'FBC, CRP, blood cultures',
      'Chest drain or VATS decortication',
    ],
    symptomWeights: {
      'fever': 28,
      'pleuritic chest pain': 24,
      'chest pain': 18,
      'shortness of breath': 18,
      'productive cough': 16,
      'rigors': 14,
      'night sweats': 12,
      'weight loss': 10,
      'fatigue': 8,
    },
    detailWeights: {
      'fever.Persistent or swinging': 20,
      'pleuritic chest pain.Worsening': 12,
      'productive cough.Following recent pneumonia': 14,
      'fever.Not responding to antibiotics': 16,
    },
    ageModifier: { gt: 50, add: 4 },
  },
  
  {
    id: 'lung_abscess',
    name: 'Lung abscess',
    category: 'Respiratory',
    urgency: 'priority',
    basePrior: 3,
    keywords: ['putrid foul-smelling sputum', 'high swinging fever', 'cavitating lesion', 'haemoptysis', 'weight loss'],
    investigations: [
      'CXR (cavity with air-fluid level)',
      'CT chest',
      'Sputum MC&S including AFB',
      'Bronchoscopy and BAL',
      'Blood cultures',
      'FBC, CRP, LFTs',
    ],
    symptomWeights: {
      'productive cough': 28,
      'fever': 26,
      'haemoptysis': 18,
      'weight loss': 16,
      'night sweats': 14,
      'anorexia': 12,
      'chest pain': 10,
      'malaise': 10,
      'fatigue': 8,
      'loss of appetite': 8,
    },
    detailWeights: {
      'productive cough.Foul-smelling or putrid': 28,
      'productive cough.Large volume': 18,
      'fever.Prolonged': 14,
      'productive cough.Blood-stained': 12,
    },
    ageModifier: { gt: 40, add: 4 },
  },
  
  {
    id: 'ards',
    name: 'Acute respiratory distress syndrome (ARDS)',
    category: 'Respiratory',
    urgency: 'urgent',
    basePrior: 3,
    keywords: ['acute hypoxaemia', 'bilateral infiltrates', 'non-cardiogenic pulmonary oedema', 'low PaO2/FiO2 ratio', 'rapid respiratory failure'],
    investigations: [
      'ABG (PaO2/FiO2 ratio < 300 mmHg)',
      'CXR and CT chest (bilateral infiltrates)',
      'Echocardiogram (exclude cardiogenic pulmonary oedema)',
      'FBC, CRP, blood cultures, procalcitonin',
      'LFTs, renal function, coagulation screen',
      'Bronchoalveolar lavage if infective cause sought',
    ],
    symptomWeights: {
      'shortness of breath': 38,
      'dyspnoea on exertion': 22,
      'cough': 14,
      'dry cough': 10,
      'fever': 14,
      'fatigue': 12,
      'confusion': 12,
    },
    detailWeights: {
      'shortness of breath.Rapidly progressive': 20,
      'shortness of breath.Refractory to supplemental oxygen': 18,
      'confusion.Associated with hypoxia': 14,
    },
  },
  {
    id: 'cushings_syndrome',
    name: "Cushing's syndrome",
    category: 'Endocrine',
    urgency: 'routine',
    basePrior: 2,
    keywords: ['central obesity', 'purple striae', 'proximal weakness', 'moon face', 'easy bruising', 'buffalo hump'],
    investigations: [
      '24-hour urinary free cortisol',
      'Overnight 1 mg dexamethasone suppression test',
      'Midnight salivary cortisol',
      'Plasma ACTH level',
      'MRI pituitary',
      'CT adrenals',
    ],
    symptomWeights: {
      'weight gain': 22,
      'generalised weakness': 18,
      'bruising': 16,
      'fatigue': 14,
      'skin discolouration': 12,
      'back pain': 12,
      'depression': 10,
      'polyuria': 8,
      'excessive thirst': 8,
      'headache': 6,
    },
    detailWeights: {
      'weight gain.Central / abdominal': 18,
      'generalised weakness.Proximal muscles': 18,
    },
    negativeWeights: {
      'weight loss': -12,
    },
    sexModifier: { sex: 'female', add: 5 },
    ageModifier: { gt: 20, lt: 65, add: 3 },
  },
  
  {
    id: 'phaeochromocytoma',
    name: 'Phaeochromocytoma',
    category: 'Endocrine',
    urgency: 'priority',
    basePrior: 2,
    keywords: ['paroxysmal hypertension', 'severe headache', 'diaphoresis', 'palpitations', 'pallor', 'panic attacks'],
    investigations: [
      'Plasma free metanephrines',
      '24-hour urine metanephrines and catecholamines',
      'CT / MRI adrenals',
      'MIBG scintigraphy',
      'Genetic testing (SDHx, RET, VHL)',
    ],
    symptomWeights: {
      'headache': 22,
      'palpitations': 22,
      'drenching sweats': 20,
      'anxiety': 14,
      'dizziness': 12,
      'tremor': 12,
      'chest pain': 10,
      'near-syncope': 10,
      'nausea': 8,
    },
    detailWeights: {
      'headache.Episodic / paroxysmal': 22,
      'palpitations.Episodic / paroxysmal': 18,
      'drenching sweats.Episodic': 18,
    },
  },
  
  {
    id: 'primary_hyperaldosteronism',
    name: "Primary hyperaldosteronism (Conn's syndrome)",
    category: 'Endocrine',
    urgency: 'routine',
    basePrior: 2,
    keywords: ['resistant hypertension', 'hypokalaemia', 'muscle weakness', 'polyuria', 'nocturia', 'muscle cramps'],
    investigations: [
      'Aldosterone:renin ratio (ARR)',
      'Serum electrolytes (potassium)',
      'CT adrenals',
      'Adrenal vein sampling',
      'Fludrocortisone suppression test',
    ],
    symptomWeights: {
      'generalised weakness': 18,
      'polyuria': 16,
      'nocturia': 14,
      'muscle pain': 14,
      'headache': 12,
      'fatigue': 12,
      'tingling': 12,
      'palpitations': 10,
    },
    detailWeights: {
      'headache.Hypertension-related': 12,
      'generalised weakness.Limb muscles': 14,
    },
  },
  
  {
    id: 'hyperparathyroidism',
    name: 'Primary hyperparathyroidism / hypercalcaemia',
    category: 'Endocrine',
    urgency: 'routine',
    basePrior: 3,
    keywords: ['hypercalcaemia', 'renal stones', 'bone pain', 'constipation', 'polyuria', 'fatigue'],
    investigations: [
      'Serum calcium and albumin-adjusted calcium',
      'Intact PTH level',
      '24-hour urine calcium',
      'Neck ultrasound + sestamibi parathyroid scan',
      'DEXA bone densitometry',
      'Renal USS (nephrolithiasis)',
    ],
    symptomWeights: {
      'bone pain': 18,
      'renal colic': 16,
      'constipation': 14,
      'abdominal pain': 14,
      'polyuria': 14,
      'excessive thirst': 12,
      'fatigue': 12,
      'nausea': 10,
      'depression': 10,
      'confusion': 10,
    },
    detailWeights: {
      'bone pain.Widespread / diffuse': 14,
      'renal colic.Recurrent': 14,
    },
    sexModifier: { sex: 'female', add: 5 },
    ageModifier: { gt: 50, add: 6 },
  },
  
  {
    id: 'thyroid_cancer',
    name: 'Thyroid carcinoma',
    category: 'Endocrine',
    urgency: 'priority',
    basePrior: 4,
    keywords: ['neck swelling', 'painless thyroid nodule', 'hoarse voice', 'dysphagia', 'lymphadenopathy', 'neck mass'],
    investigations: [
      'Thyroid USS + FNA cytology',
      'Thyroid function tests (TSH, free T4)',
      'Thyroglobulin and calcitonin',
      'CT neck and chest (staging)',
      'Nuclear medicine thyroid scan',
    ],
    symptomWeights: {
      'neck swelling': 28,
      'hoarse voice': 20,
      'dysphagia': 18,
      'lymphadenopathy': 18,
      'stridor': 14,
      'neck pain': 10,
      'weight loss': 8,
    },
    detailWeights: {
      'neck swelling.Thyroid / anterior midline': 24,
      'neck swelling.Painless and growing': 20,
      'hoarse voice.Progressive': 16,
    },
    sexModifier: { sex: 'female', add: 6 },
    ageModifier: { gt: 30, lt: 70, add: 4 },
  },
  
  {
    id: 'aki',
    name: 'Acute kidney injury',
    category: 'Renal',
    urgency: 'urgent',
    basePrior: 6,
    keywords: ['oliguria', 'rising creatinine', 'fluid overload', 'uraemia', 'haematuria', 'bilateral oedema'],
    investigations: [
      'Serum U&E and creatinine (serial)',
      'Urine dipstick + microscopy + culture',
      'Renal USS',
      'Urine protein:creatinine ratio',
      'Venous blood gas / bicarbonate',
      'FBC, LFTs, coagulation screen',
    ],
    symptomWeights: {
      'urinary retention': 20,
      'bilateral leg oedema': 18,
      'ankle oedema': 14,
      'confusion': 16,
      'haematuria': 14,
      'nausea': 14,
      'vomiting': 12,
      'loin pain': 12,
      'fatigue': 10,
    },
    detailWeights: {
      'urinary retention.Acute onset': 18,
      'bilateral leg oedema.Acute / rapid onset': 14,
    },
  },
  
  {
    id: 'nephrotic_syndrome',
    name: 'Nephrotic syndrome',
    category: 'Renal',
    urgency: 'priority',
    basePrior: 3,
    keywords: ['frothy urine', 'bilateral pitting oedema', 'periorbital puffiness', 'proteinuria', 'hypoalbuminaemia', 'ascites'],
    investigations: [
      'Spot urine protein:creatinine ratio / 24-hour urine protein',
      'Serum albumin and lipid profile',
      'Serum U&E and creatinine',
      'Renal biopsy',
      'ANA, ANCA, complement levels, hepatitis B/C, HIV screen',
    ],
    symptomWeights: {
      'frothy urine': 24,
      'bilateral leg oedema': 24,
      'ankle oedema': 18,
      'weight gain': 16,
      'abdominal distension': 14,
      'shortness of breath': 10,
      'fatigue': 10,
    },
    detailWeights: {
      'bilateral leg oedema.Pitting': 16,
      'frothy urine.Persistent / significant': 22,
      'weight gain.Rapid / fluid related': 14,
    },
  },
  
  {
    id: 'bladder_cancer',
    name: 'Bladder transitional cell carcinoma',
    category: 'Urogenital',
    urgency: 'priority',
    basePrior: 4,
    keywords: ['painless haematuria', 'irritative LUTS', 'frequency', 'dysuria', 'recurrent UTIs', 'pelvic pain'],
    investigations: [
      'Cystoscopy + biopsy',
      'CT urogram',
      'Urine cytology (x3 early morning specimens)',
      'Urine culture and sensitivity',
      'FBC, U&E',
    ],
    symptomWeights: {
      'haematuria': 28,
      'dysuria': 14,
      'urinary frequency': 14,
      'suprapubic pain': 12,
      'pelvic pain': 10,
      'weight loss': 8,
      'fatigue': 6,
    },
    detailWeights: {
      'haematuria.Painless': 24,
      'haematuria.Visible / macroscopic': 22,
      'haematuria.Recurrent episodes': 18,
    },
    sexModifier: { sex: 'male', add: 5 },
    ageModifier: { gt: 55, add: 8 },
  },
  
  {
    id: 'prostate_cancer',
    name: 'Prostate adenocarcinoma',
    category: 'Urogenital',
    urgency: 'priority',
    basePrior: 7,
    keywords: ['LUTS', 'elevated PSA', 'bone pain', 'haematuria', 'urinary retention', 'hesitancy'],
    investigations: [
      'PSA (total and free/total ratio)',
      'Digital rectal examination',
      'Multiparametric MRI prostate (mp-MRI)',
      'Transperineal / transrectal biopsy',
      'Bone scan / PSMA PET-CT (staging)',
      'FBC, U&E, LFTs, ALP',
    ],
    symptomWeights: {
      'poor urinary stream': 18,
      'hesitancy': 18,
      'nocturia': 14,
      'urinary frequency': 14,
      'haematuria': 14,
      'urinary retention': 12,
      'bone pain': 14,
      'lower back pain': 12,
      'weight loss': 8,
      'fatigue': 8,
    },
    detailWeights: {
      'poor urinary stream.Progressive': 14,
      'bone pain.Lumbar spine or pelvis': 18,
      'hesitancy.Progressive': 12,
    },
    sexModifier: { sex: 'male', add: 12 },
    ageModifier: { gt: 60, add: 12 },
  },
  
  {
    id: 'testicular_cancer',
    name: 'Testicular germ cell tumour',
    category: 'Urogenital',
    urgency: 'priority',
    basePrior: 3,
    keywords: ['painless testicular lump', 'scrotal swelling', 'back pain from retroperitoneal mets', 'gynaecomastia', 'dragging sensation'],
    investigations: [
      'Scrotal USS',
      'AFP, beta-hCG, LDH (tumour markers)',
      'CT chest / abdomen / pelvis (staging)',
      'Radical inguinal orchidectomy (diagnostic and therapeutic)',
      'MRI spine if neurological symptoms',
    ],
    symptomWeights: {
      'scrotal swelling': 26,
      'back pain': 14,
      'loin pain': 12,
      'breast swelling': 10,
      'weight loss': 8,
      'fatigue': 6,
    },
    detailWeights: {
      'scrotal swelling.Painless': 24,
      'scrotal swelling.Unilateral / firm': 20,
      'back pain.Flank / retroperitoneal': 14,
    },
    sexModifier: { sex: 'male', add: 12 },
    ageModifier: { gt: 15, lt: 45, add: 10 },
  },
  
  {
    id: 'renal_cell_carcinoma',
    name: 'Renal cell carcinoma',
    category: 'Renal',
    urgency: 'priority',
    basePrior: 3,
    keywords: ['haematuria', 'loin pain', 'flank mass', 'weight loss', 'paraneoplastic fever', 'fatigue'],
    investigations: [
      'CT urogram / CT abdomen and pelvis with contrast',
      'Renal USS',
      'MRI kidney (complex cystic lesions)',
      'CT chest (staging)',
      'FBC, U&E, LFTs, calcium, LDH',
      'Renal biopsy (metastatic or non-surgical candidates)',
    ],
    symptomWeights: {
      'haematuria': 24,
      'loin pain': 20,
      'weight loss': 18,
      'lump in abdomen': 14,
      'fatigue': 14,
      'fever': 12,
      'night sweats': 10,
    },
    detailWeights: {
      'haematuria.Painless': 18,
      'loin pain.Unilateral flank': 16,
      'lump in abdomen.Unilateral flank / loin': 16,
    },
    sexModifier: { sex: 'male', add: 5 },
    ageModifier: { gt: 50, add: 8 },
  },
  
  {
    id: 'carcinoid',
    name: 'Carcinoid / neuroendocrine tumour',
    category: 'Oncology',
    urgency: 'routine',
    basePrior: 2,
    keywords: ['episodic flushing', 'secretory diarrhoea', 'wheeze', 'carcinoid syndrome', 'right heart disease'],
    investigations: [
      'Chromogranin A',
      '24-hour urine 5-HIAA',
      'Ga-68 DOTATATE PET-CT / octreotide scintigraphy',
      'CT chest / abdomen / pelvis',
      'Echocardiogram (right-sided cardiac involvement)',
      'Serotonin level',
    ],
    symptomWeights: {
      'diarrhoea': 20,
      'skin discolouration': 18,
      'wheeze': 16,
      'abdominal pain': 14,
      'weight loss': 12,
      'fatigue': 12,
      'ankle oedema': 8,
      'shortness of breath': 8,
    },
    detailWeights: {
      'diarrhoea.Episodic / intermittent': 14,
      'skin discolouration.Episodic flushing': 20,
      'wheeze.Episodic / intermittent': 14,
    },
  },
  
  {
    id: 'varicocele',
    name: 'Varicocele',
    category: 'Urogenital',
    urgency: 'routine',
    basePrior: 5,
    keywords: ['scrotal swelling', 'dull scrotal ache', 'left-sided bag of worms', 'dragging sensation', 'infertility'],
    investigations: [
      'Scrotal USS with colour Doppler',
      'Semen analysis',
      'Testosterone and FSH / LH',
      'Renal USS (exclude secondary varicocele from left renal vein obstruction)',
    ],
    symptomWeights: {
      'scrotal swelling': 24,
      'groin pain': 16,
      'groin swelling': 14,
      'loin pain': 10,
      'pelvic pressure': 8,
    },
    detailWeights: {
      'scrotal swelling.Left-sided': 20,
      'groin pain.Dull ache or dragging': 16,
      'scrotal swelling.Worse on standing': 14,
    },
    negativeWeights: {
      'haematuria': -8,
      'dysuria': -6,
    },
    sexModifier: { sex: 'male', add: 12 },
    ageModifier: { gt: 15, lt: 40, add: 8 },
  },
  {
    id: 'typhoid_fever',
    name: 'Typhoid fever',
    category: 'Tropical',
    urgency: 'priority',
    basePrior: 6,
    keywords: ['stepwise fever', 'rose spots', 'relative bradycardia', 'abdominal pain', 'constipation'],
    investigations: ['Blood culture (gold standard)', 'Widal / Typhidot IgM', 'FBC + differential', 'LFTs', 'Stool and urine cultures'],
    symptomWeights: {
      'fever': 22,
      'headache': 14,
      'abdominal pain': 16,
      'constipation': 12,
      'diarrhoea': 8,
      'malaise': 12,
      'anorexia': 12,
      'rigors': 8,
      'rash': 10,
      'nausea': 10,
      'fatigue': 10,
    },
    detailWeights: {
      'fever.Prolonged more than 7 days': 18,
      'rash.Rose spots on trunk': 20,
    },
    negativeWeights: {
      'haemoptysis': -10,
      'joint pain': -6,
    },
    ageModifier: { lt: 35, add: 5 },
  },
  {
    id: 'chikungunya',
    name: 'Chikungunya fever',
    category: 'Tropical',
    urgency: 'priority',
    basePrior: 7,
    keywords: ['acute polyarthralgia', 'high fever', 'maculopapular rash', 'joint swelling', 'myalgia'],
    investigations: ['Chikungunya IgM / IgG serology', 'RT-PCR (first 5 days of illness)', 'FBC (lymphopenia, thrombocytopenia)', 'CRP / ESR', 'Dengue co-infection screen'],
    symptomWeights: {
      'fever': 20,
      'joint pain': 26,
      'joint swelling': 18,
      'muscle pain': 16,
      'rash': 14,
      'headache': 10,
      'fatigue': 12,
      'malaise': 10,
    },
    detailWeights: {
      'joint pain.Severe bilateral polyarthralgia': 26,
      'fever.Acute high onset': 18,
      'rash.Maculopapular widespread': 16,
    },
    negativeWeights: {
      'weight loss': -8,
      'haemoptysis': -14,
    },
  },
  {
    id: 'zika_virus',
    name: 'Zika virus infection',
    category: 'Tropical',
    urgency: 'routine',
    basePrior: 5,
    keywords: ['mild fever', 'maculopapular rash', 'conjunctivitis', 'arthralgia', 'pregnancy teratogen risk'],
    investigations: ['Zika RT-PCR serum and urine within 14 days', 'Zika IgM serology', 'FBC', 'Dengue and Chikungunya co-screen', 'Pregnancy test if applicable'],
    symptomWeights: {
      'fever': 14,
      'rash': 22,
      'joint pain': 14,
      'headache': 12,
      'muscle pain': 10,
      'fatigue': 10,
      'malaise': 8,
    },
    detailWeights: {
      'rash.Maculopapular pruritic spreading': 22,
      'fever.Low grade mild': 12,
    },
    negativeWeights: {
      'weight loss': -10,
      'haemoptysis': -14,
      'night sweats': -10,
    },
  },
  {
    id: 'brucellosis',
    name: 'Brucellosis',
    category: 'Infectious',
    urgency: 'routine',
    basePrior: 2,
    keywords: ['undulant fever', 'drenching night sweats', 'sacroiliitis', 'hepatosplenomegaly', 'animal contact'],
    investigations: ['Brucella serology (SAT / Rose Bengal)', 'Blood culture with prolonged incubation', 'FBC', 'LFTs', 'MRI sacroiliac joints or spine if back pain'],
    symptomWeights: {
      'fever': 18,
      'night sweats': 18,
      'drenching sweats': 16,
      'joint pain': 16,
      'back pain': 14,
      'fatigue': 14,
      'weight loss': 10,
      'rigors': 12,
      'malaise': 12,
    },
    detailWeights: {
      'fever.Undulant pattern': 22,
      'back pain.Sacroiliac or vertebral': 20,
    },
    negativeWeights: {
      'rash': -8,
      'haemoptysis': -12,
      'productive cough': -10,
    },
  },
  {
    id: 'sickle_cell_crisis',
    name: 'Sickle cell vaso-occlusive crisis',
    category: 'Haematology',
    urgency: 'urgent',
    basePrior: 5,
    keywords: ['severe bone pain', 'vaso-occlusive crisis', 'known sickle cell disease', 'anaemia', 'acute chest risk'],
    investigations: ['FBC + reticulocyte count', 'Blood film (sickle forms)', 'LDH and bilirubin', 'CXR (acute chest syndrome)', 'Blood cultures if febrile', 'Group and screen'],
    symptomWeights: {
      'bone pain': 28,
      'limb pain': 22,
      'chest pain': 18,
      'abdominal pain': 14,
      'back pain': 16,
      'fever': 12,
      'fatigue': 14,
      'generalised weakness': 12,
    },
    detailWeights: {
      'bone pain.Severe crisis pain': 30,
      'chest pain.Pleuritic or acute chest': 22,
      'limb pain.Bilateral or migratory': 18,
    },
    negativeWeights: {
      'weight loss': -6,
      'haemoptysis': -8,
    },
  },
  {
    id: 'sle',
    name: 'Systemic lupus erythematosus',
    category: 'Rheumatology',
    urgency: 'priority',
    basePrior: 4,
    keywords: ['butterfly malar rash', 'polyarthritis', 'photosensitivity', 'renal involvement', 'young woman'],
    investigations: ['ANA (screening test)', 'Anti-dsDNA antibodies', 'Complement C3 and C4', 'FBC (cytopenias)', 'Urinalysis with protein:creatinine ratio'],
    symptomWeights: {
      'rash': 22,
      'joint pain': 18,
      'joint swelling': 14,
      'fatigue': 16,
      'fever': 12,
      'hair loss': 16,
      'pleuritic chest pain': 12,
      'haematuria': 14,
      'mouth ulcers': 12,
    },
    detailWeights: {
      'rash.Butterfly malar distribution': 30,
      'rash.Photosensitive worsened by sun': 24,
      'haematuria.Proteinuria or casts': 18,
      'hair loss.Diffuse': 14,
    },
    sexModifier: { sex: 'female', add: 12 },
    ageModifier: { gt: 15, lt: 50, add: 8 },
  },
  {
    id: 'systemic_vasculitis',
    name: 'ANCA-associated vasculitis',
    category: 'Rheumatology',
    urgency: 'priority',
    basePrior: 2,
    keywords: ['haemoptysis', 'haematuria', 'bloody nasal crusting', 'renal impairment', 'weight loss'],
    investigations: ['ANCA cANCA and pANCA', 'Urinalysis (red cell casts, proteinuria)', 'Creatinine and eGFR', 'CXR and HRCT chest', 'Renal biopsy'],
    symptomWeights: {
      'haemoptysis': 26,
      'haematuria': 24,
      'weight loss': 16,
      'fatigue': 14,
      'nasal discharge': 16,
      'epistaxis': 12,
      'shortness of breath': 14,
      'joint pain': 10,
      'fever': 10,
    },
    detailWeights: {
      'haematuria.Microscopic with casts': 22,
      'nasal discharge.Bloody crusting sinusitis': 22,
      'haemoptysis.Recurrent': 20,
    },
    negativeWeights: {
      'heartburn': -8,
      'bloating': -8,
    },
    ageModifier: { gt: 40, add: 6 },
  },
  {
    id: 'hiv_aids',
    name: 'HIV / AIDS presentation',
    category: 'Infectious',
    urgency: 'priority',
    basePrior: 5,
    keywords: ['unexplained weight loss', 'generalised lymphadenopathy', 'opportunistic infections', 'night sweats', 'recurrent infections'],
    investigations: ['HIV 4th generation Ag/Ab test', 'CD4 count', 'HIV viral load', 'FBC (lymphopenia)', 'STI screen', 'Chest X-ray'],
    symptomWeights: {
      'weight loss': 24,
      'lymphadenopathy': 22,
      'night sweats': 18,
      'fatigue': 16,
      'fever': 14,
      'diarrhoea': 12,
      'mouth ulcers': 14,
      'malaise': 12,
      'anorexia': 12,
      'rash': 10,
    },
    detailWeights: {
      'weight loss.Unexplained more than 10 percent': 28,
      'lymphadenopathy.Generalised persistent': 26,
      'mouth ulcers.Oral candidiasis': 20,
    },
    ageModifier: { gt: 18, lt: 55, add: 5 },
  },
  {
    id: 'schistosomiasis',
    name: 'Schistosomiasis (S. mansoni)',
    category: 'Tropical',
    urgency: 'routine',
    basePrior: 2,
    keywords: ['freshwater exposure', 'hepatosplenomegaly', 'rectal bleeding', 'eosinophilia', 'portal hypertension'],
    investigations: ['Stool microscopy for ova', 'Schistosoma serology (ELISA)', 'FBC (eosinophilia)', 'LFTs and abdominal ultrasound', 'Rectal snip biopsy if stool negative'],
    symptomWeights: {
      'abdominal pain': 16,
      'diarrhoea': 14,
      'rectal bleeding': 14,
      'fatigue': 14,
      'weight loss': 12,
      'fever': 12,
      'abdominal distension': 14,
      'pruritus': 10,
      'haematuria': 6,
    },
    detailWeights: {
      'abdominal distension.Hepatosplenomegaly': 20,
      'diarrhoea.Bloody': 14,
      'pruritus.After freshwater swimming': 18,
    },
    negativeWeights: {
      'chest pain': -8,
      'joint swelling': -8,
    },
  },
  {
    id: 'compartment_syndrome',
    name: 'Acute compartment syndrome',
    category: 'Musculoskeletal',
    urgency: 'urgent',
    basePrior: 3,
    keywords: ['disproportionate limb pain', 'tense compartment', 'paraesthesia after trauma', 'pain on passive stretch', 'post-fracture or crush'],
    investigations: ['Compartment pressure measurement (> 30 mmHg diagnostic)', 'Serum CK', 'Creatinine and urine myoglobin (rhabdomyolysis)', 'Plain X-ray underlying fracture', 'Urgent surgical consult'],
    symptomWeights: {
      'limb pain': 28,
      'muscle pain': 20,
      'numbness': 20,
      'tingling': 16,
      'wound swelling': 18,
      'wound pain': 22,
    },
    detailWeights: {
      'limb pain.Severe disproportionate to injury': 30,
      'wound swelling.Tense compartment': 26,
      'numbness.After fracture or crush injury': 22,
    },
    negativeWeights: {
      'fever': -6,
      'weight loss': -16,
    },
  },
  {
    id: 'osteomyelitis_adult',
    name: 'Osteomyelitis (adult)',
    category: 'Musculoskeletal',
    urgency: 'priority',
    basePrior: 3,
    keywords: ['localised bone pain', 'bone tenderness', 'raised CRP and ESR', 'fever', 'sinus tract discharge'],
    investigations: ['MRI bone (investigation of choice)', 'Bone scan Tc-99m', 'CRP, ESR, WBC', 'Blood cultures', 'Plain X-ray (changes after 10-21 days)'],
    symptomWeights: {
      'bone pain': 26,
      'fever': 18,
      'limb pain': 18,
      'wound discharge': 18,
      'wound redness': 14,
      'wound swelling': 14,
      'fatigue': 10,
      'malaise': 10,
    },
    detailWeights: {
      'bone pain.Localised point tenderness': 24,
      'wound discharge.Sinus tract': 26,
      'fever.Low grade persistent': 16,
    },
    negativeWeights: {
      'weight loss': -8,
      'night sweats': -6,
    },
  },
  {
    id: 'carpal_tunnel',
    name: 'Carpal tunnel syndrome',
    category: 'Musculoskeletal',
    urgency: 'routine',
    basePrior: 7,
    keywords: ['nocturnal hand numbness', 'wrist and hand tingling', 'median nerve distribution', 'Tinel and Phalen positive', 'hand shaking relief'],
    investigations: ['Nerve conduction study and EMG', 'Wrist X-ray', 'Thyroid function tests', 'Fasting glucose and HbA1c', 'Rheumatoid factor if bilateral'],
    symptomWeights: {
      'numbness': 22,
      'tingling': 26,
      'wrist pain': 20,
      'muscle weakness': 14,
      'limb pain': 10,
    },
    detailWeights: {
      'numbness.Nocturnal hand and fingers': 30,
      'tingling.Thumb index and middle finger': 28,
      'wrist pain.Relief on shaking hand': 22,
    },
    negativeWeights: {
      'fever': -10,
      'weight loss': -10,
      'night sweats': -10,
      'bone pain': -8,
    },
    sexModifier: { sex: 'female', add: 6 },
    ageModifier: { gt: 40, add: 5 },
  },
  {
    id: 'rotator_cuff',
    name: 'Rotator cuff tear / shoulder impingement',
    category: 'Musculoskeletal',
    urgency: 'routine',
    basePrior: 7,
    keywords: ['shoulder pain', 'painful arc 60-120 degrees', 'weakness on abduction', 'night pain', 'overhead activity difficulty'],
    investigations: ['Shoulder MRI (full thickness tear)', 'Shoulder ultrasound', 'Plain X-ray shoulder', 'Subacromial injection diagnostic and therapeutic', 'Physiotherapy assessment'],
    symptomWeights: {
      'shoulder pain': 30,
      'muscle weakness': 18,
      'joint pain': 14,
      'joint stiffness': 14,
      'limb pain': 12,
      'muscle pain': 10,
    },
    detailWeights: {
      'shoulder pain.Painful arc 60 to 120 degrees': 28,
      'shoulder pain.Night pain disturbing sleep': 24,
      'muscle weakness.Abduction and external rotation weakness': 22,
    },
    negativeWeights: {
      'fever': -10,
      'weight loss': -10,
      'bone pain': -6,
    },
    ageModifier: { gt: 40, add: 8 },
  },
  {
    id: 'achilles_tendon',
    name: 'Achilles tendinopathy / rupture',
    category: 'Musculoskeletal',
    urgency: 'priority',
    basePrior: 5,
    keywords: ['posterior heel pain', 'Achilles tenderness', 'sudden snap during sport', 'Thompson test positive', 'morning heel stiffness'],
    investigations: ['Ultrasound Achilles tendon', 'MRI ankle (partial versus full thickness tear)', 'Plain X-ray ankle (exclude fracture)', 'Thompson squeeze test clinical assessment'],
    symptomWeights: {
      'ankle pain': 30,
      'limb pain': 14,
      'morning stiffness': 14,
      'muscle pain': 10,
      'joint stiffness': 10,
    },
    detailWeights: {
      'ankle pain.Posterior heel tenderness on palpation': 32,
      'ankle pain.Sudden audible pop during activity': 30,
      'morning stiffness.Heel stiffness first steps': 20,
    },
    negativeWeights: {
      'fever': -10,
      'weight loss': -12,
      'bone pain': -8,
    },
    ageModifier: { gt: 30, add: 5 },
  },
  {
    id: 'sciatica',
    name: 'Sciatica / lumbar radiculopathy',
    category: 'Musculoskeletal',
    urgency: 'routine',
    basePrior: 9,
    keywords: ['lower back pain radiating to leg', 'SLR positive', 'L4 L5 S1 dermatomal distribution', 'numbness', 'tingling in leg'],
    investigations: ['MRI lumbar spine', 'Neurological examination', 'Nerve conduction study and EMG', 'Plain X-ray lumbar spine', 'CT lumbar if MRI unavailable'],
    symptomWeights: {
      'lower back pain': 28,
      'back pain': 18,
      'limb pain': 24,
      'numbness': 20,
      'tingling': 20,
      'muscle weakness': 14,
    },
    detailWeights: {
      'lower back pain.Radiation below knee': 32,
      'numbness.Below knee dermatomal': 24,
      'limb pain.Worsened by sitting or coughing': 20,
      'muscle weakness.Foot drop': 22,
    },
    negativeWeights: {
      'fever': -8,
      'weight loss': -10,
      'bone pain': -6,
    },
    ageModifier: { gt: 30, add: 6 },
  },
  {
    id: 'paed_intussusception',
    name: 'Intussusception',
    category: 'Paediatric Surgical',
    urgency: 'urgent',
    basePrior: 6,
    paediatric: true,
    keywords: ['episodic colicky crying', 'currant jelly stool', 'abdominal mass', 'vomiting', 'pallor episodes'],
    investigations: ['Abdominal USS (diagnostic + therapeutic)', 'AXR', 'Air / contrast enema reduction', 'FBC + CRP + IV access', 'Urgent surgical referral if enema fails'],
    symptomWeights: {
      'inconsolable crying': 28,
      'rectal bleeding': 26,
      'vomiting': 20,
      'abdominal pain': 20,
      'abdominal distension': 12,
      'poor feeding': 14,
    },
    detailWeights: {
      'rectal bleeding.Currant jelly': 32,
      'abdominal pain.Episodic colicky with pallor': 28,
      'inconsolable crying.Episodic drawing up legs': 26,
    },
    ageModifier: { lt: 4, add: 18 },
  },
  {
    id: 'pyloric_stenosis',
    name: 'Hypertrophic pyloric stenosis',
    category: 'Paediatric Surgical',
    urgency: 'priority',
    basePrior: 5,
    paediatric: true,
    keywords: ['projectile non-bilious vomiting', 'hungry after vomiting', '2-8 weeks of age', 'olive-shaped mass', 'male infant'],
    investigations: ['USS pylorus (muscle thickness ≥4 mm, channel length ≥17 mm)', 'U&E (hypokalaemic hypochloraemic metabolic alkalosis)', 'ABG', 'FBC', 'Surgical referral for Ramstedt pyloromyotomy'],
    symptomWeights: {
      'vomiting': 30,
      'poor feeding': 18,
      'dehydration': 20,
      'weight loss': 16,
      'failure to thrive': 14,
      'constipation': 10,
    },
    detailWeights: {
      'vomiting.Projectile non-bilious': 34,
      'vomiting.Immediately after every feed': 28,
      'poor feeding.Hungry immediately after vomiting': 22,
    },
    sexModifier: { sex: 'male', add: 6 },
    ageModifier: { lt: 1, add: 18 },
  },
  {
    id: 'malrotation_volvulus',
    name: 'Malrotation / midgut volvulus',
    category: 'Paediatric Surgical',
    urgency: 'urgent',
    basePrior: 4,
    paediatric: true,
    keywords: ['bilious vomiting', 'abdominal distension', 'acute onset in infant', 'intestinal obstruction', 'surgical emergency'],
    investigations: ['AXR (double-bubble, gasless abdomen)', 'Upper GI contrast study (gold standard)', 'Abdominal USS (whirlpool sign)', 'FBC + U&E + LFTs + lactate', 'Immediate surgical referral'],
    symptomWeights: {
      'bilious vomiting': 36,
      'abdominal distension': 22,
      'inconsolable crying': 20,
      'abdominal pain': 18,
      'vomiting': 20,
      'poor feeding': 16,
    },
    detailWeights: {
      'vomiting.Bilious green sudden onset': 36,
      'abdominal pain.Sudden onset infant': 22,
      'abdominal distension.Diffuse infant': 20,
    },
    ageModifier: { lt: 2, add: 18 },
  },
  {
    id: 'hirschsprung',
    name: "Hirschsprung's disease",
    category: 'Paediatric Surgical',
    urgency: 'priority',
    basePrior: 4,
    paediatric: true,
    keywords: ['failure to pass meconium >48h', 'chronic constipation from birth', 'abdominal distension', 'enterocolitis risk', 'male predominance'],
    investigations: ['AXR (dilated proximal colon, absent rectal gas)', 'Contrast enema (transition zone)', 'Rectal suction biopsy (absent ganglion cells — gold standard)', 'Anorectal manometry', 'FBC + CRP (if enterocolitis)'],
    symptomWeights: {
      'constipation': 30,
      'abdominal distension': 28,
      'failure to thrive': 18,
      'bilious vomiting': 16,
      'vomiting': 14,
      'poor feeding': 14,
    },
    detailWeights: {
      'constipation.Failure to pass meconium beyond 48h': 36,
      'constipation.Since birth never normal': 32,
      'abdominal distension.Progressive chronic': 24,
    },
    sexModifier: { sex: 'male', add: 6 },
    ageModifier: { lt: 5, add: 18 },
  },
  {
    id: 'meckel_diverticulum',
    name: "Meckel's diverticulum",
    category: 'Paediatric Surgical',
    urgency: 'priority',
    basePrior: 4,
    paediatric: true,
    keywords: ['painless rectal bleeding', 'melaena', 'brick-red stool', 'child under 5', 'rule of twos'],
    investigations: ['Technetium-99m pertechnetate scan (Meckel scan)', 'FBC (iron-deficiency anaemia)', 'AXR', 'Abdominal USS', 'Diagnostic laparoscopy if scan negative and high suspicion'],
    symptomWeights: {
      'rectal bleeding': 30,
      'melaena': 22,
      'black stool': 18,
      'abdominal pain': 16,
      'fatigue': 12,
      'vomiting': 10,
    },
    detailWeights: {
      'rectal bleeding.Painless brick-red': 32,
      'rectal bleeding.Recurrent episodes child': 28,
      'melaena.Without upper GI source': 22,
    },
    ageModifier: { lt: 16, add: 18 },
  },
  {
    id: 'paed_appendicitis',
    name: 'Acute appendicitis (paediatric)',
    category: 'Paediatric Surgical',
    urgency: 'urgent',
    basePrior: 9,
    paediatric: true,
    keywords: ['right iliac fossa pain', 'fever', 'nausea and vomiting', 'peritonism', 'migrating periumbilical pain'],
    investigations: ['FBC + CRP + ESR', 'USS abdomen (first line in children)', 'CT abdomen/pelvis (if USS inconclusive)', 'Urine MC&S (exclude UTI)', 'Paediatric Alvarado / PAS score'],
    symptomWeights: {
      'abdominal pain': 28,
      'fever': 22,
      'nausea': 18,
      'vomiting': 16,
      'anorexia': 16,
      'poor feeding': 10,
    },
    detailWeights: {
      'abdominal pain.Migration to right iliac fossa': 32,
      'abdominal pain.Right iliac fossa maximal': 28,
      'abdominal pain.Worse on movement': 22,
      'fever.Low grade progressive': 14,
    },
    ageModifier: { gt: 5, lt: 16, add: 18 },
  },
  {
    id: 'paed_inguinal_hernia',
    name: 'Inguinal hernia (paediatric)',
    category: 'Paediatric Surgical',
    urgency: 'routine',
    basePrior: 7,
    paediatric: true,
    keywords: ['groin swelling', 'intermittent reducible lump', 'appears with crying or straining', 'male infant', 'risk of incarceration'],
    investigations: ['Clinical examination (key)', 'Abdominal USS (if diagnosis uncertain)', 'Paediatric surgical referral', 'FBC if incarcerated or strangulated'],
    symptomWeights: {
      'hernia': 28,
      'groin swelling': 30,
      'groin pain': 18,
      'scrotal swelling': 20,
      'inconsolable crying': 16,
    },
    detailWeights: {
      'groin swelling.Appears with crying or straining': 30,
      'groin swelling.Reducible on lying down': 26,
      'scrotal swelling.Soft reducible': 22,
      'inconsolable crying.With irreducible groin mass': 28,
    },
    sexModifier: { sex: 'male', add: 8 },
    ageModifier: { lt: 16, add: 18 },
  },
  {
    id: 'wilms_tumour',
    name: 'Wilms tumour / nephroblastoma',
    category: 'Paediatric Surgical',
    urgency: 'priority',
    basePrior: 3,
    paediatric: true,
    keywords: ['abdominal mass', 'haematuria', 'abdominal distension', 'child under 8', 'hypertension'],
    investigations: ['Abdominal USS (first line)', 'CT chest/abdomen/pelvis (staging)', 'FBC + U&E + LFTs', 'Urinalysis + spot urine catecholamines (exclude neuroblastoma)', 'Paediatric oncology referral'],
    symptomWeights: {
      'lump in abdomen': 34,
      'abdominal distension': 26,
      'haematuria': 22,
      'abdominal pain': 16,
      'fever': 12,
      'weight loss': 14,
    },
    detailWeights: {
      'lump in abdomen.Smooth non-tender flank mass': 32,
      'lump in abdomen.Does not cross midline': 26,
      'haematuria.Painless in child': 24,
    },
    ageModifier: { lt: 8, add: 18 },
  },
  {
    id: 'febrile_convulsion',
    name: 'Febrile convulsion',
    category: 'Paediatric Medical',
    urgency: 'priority',
    basePrior: 8,
    paediatric: true,
    keywords: ['seizure with fever', 'generalised tonic-clonic', 'post-ictal drowsiness', 'age 6 months to 5 years', 'no focal neurology'],
    investigations: ['Temperature + full clinical examination', 'Blood glucose', 'FBC + CRP + blood culture (if source unclear)', 'Urine MC&S', 'LP if meningism, atypical, or age <12 months'],
    symptomWeights: {
      'seizure': 32,
      'fever': 28,
      'loss of consciousness': 20,
      'malaise': 12,
    },
    detailWeights: {
      'seizure.Associated with fever': 34,
      'seizure.Generalised tonic-clonic': 28,
      'seizure.Duration less than 15 minutes': 22,
      'fever.Acute rapid rise': 20,
    },
    negativeWeights: {
      'neck stiffness': -20,
      'non-blanching rash': -25,
      'photophobia': -18,
    },
    ageModifier: { lt: 6, add: 18 },
  },
  {
    id: 'paed_meningitis',
    name: 'Bacterial meningitis (paediatric)',
    category: 'Paediatric Medical',
    urgency: 'urgent',
    basePrior: 5,
    paediatric: true,
    keywords: ['non-blanching rash', 'neck stiffness', 'photophobia', 'high fever', 'bulging fontanelle in infant', 'meningism'],
    investigations: ['IV ceftriaxone + dexamethasone (start empirically before LP if unstable)', 'LP (CSF MC&S, culture, PCR) — after CT if focal signs', 'FBC + CRP + blood culture', 'CT head (if focal neurology, papilloedema, or GCS ≤12)', 'Blood glucose + U&E'],
    symptomWeights: {
      'non-blanching rash': 36,
      'neck stiffness': 32,
      'fever': 24,
      'photophobia': 26,
      'headache': 20,
      'vomiting': 16,
      'seizure': 20,
      'inconsolable crying': 18,
    },
    detailWeights: {
      'non-blanching rash.Petechial or purpuric': 38,
      'neck stiffness.Kernig or Brudzinski positive': 30,
      'fever.High grade rapid onset': 24,
      'inconsolable crying.With bulging fontanelle': 28,
    },
    ageModifier: { lt: 16, add: 18 },
  },
  {
    id: 'bronchiolitis',
    name: 'Bronchiolitis (RSV)',
    category: 'Paediatric Medical',
    urgency: 'priority',
    basePrior: 9,
    paediatric: true,
    keywords: ['infant wheeze', 'respiratory distress', 'RSV season', 'feeding difficulty', 'subcostal recession', 'dry cough'],
    investigations: ['Clinical diagnosis (primary)', 'Pulse oximetry', 'Respiratory viral PCR / RSV antigen test', 'CXR (if atypical or severe)', 'FBC + CRP (if secondary bacterial infection suspected)'],
    symptomWeights: {
      'wheeze': 30,
      'shortness of breath': 26,
      'dry cough': 22,
      'poor feeding': 22,
      'fever': 16,
      'chest tightness': 14,
    },
    detailWeights: {
      'wheeze.Diffuse bilateral infant': 28,
      'shortness of breath.Worsening over 3-5 days': 22,
      'poor feeding.Reduced intake due to breathlessness': 24,
    },
    ageModifier: { lt: 2, add: 18 },
  },
  {
    id: 'croup',
    name: 'Croup / laryngotracheobronchitis',
    category: 'Paediatric Medical',
    urgency: 'priority',
    basePrior: 8,
    paediatric: true,
    keywords: ['barking seal cough', 'inspiratory stridor', 'hoarse voice', 'night-time onset', 'child 6 months to 3 years'],
    investigations: ['Clinical diagnosis', 'Pulse oximetry', 'Westley croup score', 'CXR (steeple sign, only if severe or atypical)', 'Neck XR lateral (only if epiglottitis suspected)'],
    symptomWeights: {
      'stridor': 32,
      'dry cough': 30,
      'hoarse voice': 26,
      'shortness of breath': 18,
      'fever': 16,
    },
    detailWeights: {
      'dry cough.Barking seal-like': 36,
      'stridor.Inspiratory worse at night': 32,
      'hoarse voice.Child gradual onset': 24,
      'shortness of breath.Worse at night or when upset': 20,
    },
    ageModifier: { lt: 4, add: 18 },
  },
  {
    id: 'kawasaki',
    name: 'Kawasaki disease',
    category: 'Paediatric Medical',
    urgency: 'priority',
    basePrior: 4,
    paediatric: true,
    keywords: ['prolonged fever >5 days', 'strawberry tongue', 'polymorphous rash', 'cervical lymphadenopathy', 'coronary aneurysm risk', 'conjunctival injection'],
    investigations: ['FBC + CRP + ESR (markedly elevated)', 'Echocardiography (coronary arteries — key)', 'LFTs + albumin + bilirubin', 'Urinalysis (sterile pyuria)', 'IV immunoglobulin + aspirin (treatment)'],
    symptomWeights: {
      'fever': 28,
      'strawberry tongue': 32,
      'rash': 24,
      'lymphadenopathy': 22,
      'neck swelling': 18,
      'joint pain': 12,
    },
    detailWeights: {
      'fever.Persistent more than 5 days child': 34,
      'strawberry tongue.With cracked erythematous lips': 30,
      'rash.Polymorphous non-vesicular': 26,
      'lymphadenopathy.Unilateral cervical greater than 1.5cm': 24,
    },
    ageModifier: { lt: 5, add: 18 },
  },
  {
    id: 'hsp',
    name: 'Henoch-Schönlein purpura',
    category: 'Paediatric Medical',
    urgency: 'routine',
    basePrior: 5,
    paediatric: true,
    keywords: ['palpable purpura buttocks and legs', 'abdominal pain', 'joint pain', 'haematuria', 'post-URTI'],
    investigations: ['Urinalysis + urine protein:creatinine (haematuria/proteinuria)', 'FBC + CRP', 'U&E + creatinine (renal function)', 'Renal USS', 'Skin biopsy (IgA deposition) if diagnosis uncertain'],
    symptomWeights: {
      'purpura': 36,
      'rash': 26,
      'haematuria': 24,
      'abdominal pain': 22,
      'joint pain': 20,
    },
    detailWeights: {
      'purpura.Palpable non-thrombocytopenic': 36,
      'purpura.Buttocks and lower limbs': 34,
      'abdominal pain.Colicky post-URTI child': 22,
      'joint pain.Ankles and knees': 20,
    },
    ageModifier: { gt: 3, lt: 16, add: 18 },
  },
  {
    id: 'paed_uti',
    name: 'UTI (paediatric)',
    category: 'Paediatric Medical',
    urgency: 'priority',
    basePrior: 8,
    paediatric: true,
    keywords: ['dysuria', 'urinary frequency', 'fever without source', 'offensive urine', 'poor feeding in infant'],
    investigations: ['Urine MC&S (clean catch or catheter — not bag)', 'Dipstick urinalysis', 'FBC + CRP (if febrile / pyelonephritis)', 'Renal USS (first UTI in child <2 or recurrent)', 'MCUG (after recurrent UTIs)'],
    symptomWeights: {
      'dysuria': 26,
      'urinary frequency': 24,
      'fever': 22,
      'suprapubic pain': 20,
      'abdominal pain': 16,
      'poor feeding': 14,
      'nocturia': 12,
    },
    detailWeights: {
      'fever.Without obvious source in infant': 26,
      'suprapubic pain.Tenderness on palpation': 22,
      'dysuria.Child': 26,
    },
    sexModifier: { sex: 'female', add: 6 },
    ageModifier: { lt: 16, add: 18 },
  },
  {
    id: 'scfe',
    name: 'Slipped capital femoral epiphysis (SCFE)',
    category: 'Paediatric Surgical',
    urgency: 'priority',
    basePrior: 4,
    paediatric: true,
    keywords: ['adolescent limp', 'hip pain radiating to knee', 'restricted internal rotation', 'obese teenager', 'male'],
    investigations: ['X-ray hip AP + frog-leg lateral (Klein line violation)', 'X-ray contralateral hip (bilateral in 25%)', 'FBC + ESR + CRP (exclude septic arthritis)', 'MRI hip (if pre-slip or avascular necrosis)', 'Urgent orthopaedic referral (non-weight-bearing)'],
    symptomWeights: {
      'hip pain': 28,
      'limp': 26,
      'knee pain': 22,
      'limb pain': 18,
    },
    detailWeights: {
      'hip pain.Adolescent overweight restricted internal rotation': 30,
      'knee pain.No local knee pathology referred': 24,
      'limp.Gradual onset adolescent': 24,
      'hip pain.External rotation deformity': 28,
    },
    sexModifier: { sex: 'male', add: 6 },
    ageModifier: { gt: 10, lt: 17, add: 18 },
  },
  {
    id: 'perthes',
    name: "Perthes disease",
    category: 'Paediatric Surgical',
    urgency: 'routine',
    basePrior: 3,
    paediatric: true,
    keywords: ['painless limp child', 'hip pain', 'avascular necrosis femoral head', 'age 4-10 years', 'male'],
    investigations: ['X-ray hip AP + frog-leg lateral (may be normal early)', 'MRI hip (early avascular necrosis)', 'FBC + ESR + CRP', 'Bone scan (if MRI unavailable)', 'Orthopaedic referral'],
    symptomWeights: {
      'limp': 30,
      'hip pain': 26,
      'knee pain': 16,
      'limb pain': 14,
    },
    detailWeights: {
      'limp.Painless or minimal pain child': 30,
      'hip pain.Gradual insidious onset child 4-10': 28,
      'limp.Child male gradual': 26,
      'knee pain.No local pathology referred': 18,
    },
    sexModifier: { sex: 'male', add: 6 },
    ageModifier: { gt: 4, lt: 10, add: 18 },
  },
  {
    id: 'paed_osteomyelitis',
    name: 'Osteomyelitis (paediatric)',
    category: 'Paediatric Medical',
    urgency: 'priority',
    basePrior: 5,
    paediatric: true,
    keywords: ['localised bone tenderness', 'fever', 'limb pain', 'refusal to weight-bear', 'soft tissue swelling'],
    investigations: ['FBC + CRP + ESR + blood culture (before antibiotics)', 'X-ray (normal early, periosteal reaction late)', 'MRI (modality of choice — early diagnosis)', 'Bone scan', 'Joint aspiration if septic arthritis also suspected'],
    symptomWeights: {
      'bone pain': 32,
      'limb pain': 26,
      'fever': 24,
      'limp': 22,
      'joint swelling': 18,
    },
    detailWeights: {
      'bone pain.Point tenderness over metaphysis': 34,
      'limb pain.Refusal to use limb': 30,
      'fever.With localised bone tenderness': 28,
    },
    ageModifier: { lt: 16, add: 18 },
  },
  {
    id: 'neonatal_jaundice',
    name: 'Neonatal jaundice',
    category: 'Paediatric Medical',
    urgency: 'priority',
    basePrior: 10,
    paediatric: true,
    keywords: ['jaundice within 24h of birth', 'prolonged jaundice beyond 14 days', 'poor feeding', 'dark urine', 'G6PD deficiency in Caribbean'],
    investigations: ['Serum bilirubin (total + direct/conjugated)', 'FBC + blood group + direct Coombs test', 'G6PD assay (critical in Caribbean population)', 'Urinalysis', 'TFTs + septic screen if prolonged or conjugated'],
    symptomWeights: {
      'neonatal jaundice': 38,
      'jaundice': 28,
      'poor feeding': 18,
      'dark urine': 16,
      'failure to thrive': 14,
    },
    detailWeights: {
      'neonatal jaundice.Within 24h of birth': 38,
      'neonatal jaundice.Prolonged beyond 14 days': 30,
      'neonatal jaundice.Associated pale acholic stool': 26,
      'dark urine.Neonate': 20,
    },
    ageModifier: { lt: 1, add: 18 },
  },
  {
    id: 'biliary_atresia',
    name: 'Biliary atresia',
    category: 'Paediatric Surgical',
    urgency: 'priority',
    basePrior: 3,
    paediatric: true,
    keywords: ['persistent conjugated jaundice', 'pale acholic stool', 'dark urine', 'hepatomegaly', 'neonate Kasai procedure'],
    investigations: ['Serum bilirubin direct fraction (>20% of total)', 'LFTs + GGT (markedly elevated GGT)', 'USS abdomen (absent or small gallbladder, triangular cord sign)', 'HIDA (hepatobiliary iminodiacetic acid) scan', 'Liver biopsy + intraoperative cholangiogram (definitive)'],
    symptomWeights: {
      'neonatal jaundice': 34,
      'jaundice': 26,
      'pale stool': 36,
      'dark urine': 28,
      'failure to thrive': 20,
      'abdominal distension': 18,
      'poor feeding': 16,
    },
    detailWeights: {
      'pale stool.Acholic persistent neonate': 38,
      'neonatal jaundice.Conjugated persistent beyond 14 days': 36,
      'dark urine.Conjugated bilirubin neonate': 30,
    },
    ageModifier: { lt: 1, add: 18 },
  },
  {
    id: 'scarlet_fever',
    name: 'Scarlet fever',
    category: 'Paediatric Medical',
    urgency: 'priority',
    basePrior: 6,
    paediatric: true,
    keywords: ['sandpaper rash', 'strawberry tongue', 'sore throat', 'fever', 'perioral pallor', 'Group A Streptococcus'],
    investigations: ['Throat swab (RADT + culture)', 'FBC + CRP', 'ASOT titres (later confirmation)', 'ECG (if rheumatic fever suspected)', 'Urinalysis (post-streptococcal glomerulonephritis surveillance)'],
    symptomWeights: {
      'rash': 30,
      'strawberry tongue': 28,
      'sore throat': 26,
      'fever': 24,
      'malaise': 16,
    },
    detailWeights: {
      'rash.Erythematous sandpaper texture': 34,
      'rash.Spares perioral area': 28,
      'strawberry tongue.Red with prominent papillae': 30,
      'sore throat.Exudative with fever and rash': 24,
    },
    ageModifier: { lt: 14, add: 18 },
  },
  {
    id: 'epiglottitis',
    name: 'Epiglottitis',
    category: 'Paediatric Medical',
    urgency: 'urgent',
    basePrior: 4,
    paediatric: true,
    keywords: ['drooling', 'muffled hot-potato voice', 'tripod position', 'inspiratory stridor', 'high fever', 'acute airway emergency'],
    investigations: ['Clinical diagnosis — do NOT examine throat if suspected', 'Lateral neck XR (thumbprint sign — only if stable)', 'Direct laryngoscopy in theatre with anaesthetic team', 'FBC + blood culture (after airway secured)', 'Throat swab for Haemophilus influenzae type b'],
    symptomWeights: {
      'stridor': 32,
      'shortness of breath': 28,
      'fever': 26,
      'dysphagia': 24,
      'odynophagia': 24,
      'sore throat': 22,
      'hoarse voice': 22,
    },
    detailWeights: {
      'stridor.Inspiratory severe rapid onset': 34,
      'fever.High grade sudden onset': 28,
      'dysphagia.Severe with drooling tripod position': 32,
      'hoarse voice.Muffled hot-potato': 28,
    },
    ageModifier: { lt: 16, add: 18 },
  },
];

// ─── Scoring ──────────────────────────────────────────────────────────────────

export interface InferenceInput {
  symptoms: string[];
  symptomDetails: Record<string, string[]>;
  age?: number | null;
  sex?: string;
  /** Combined examination text (examAbdomen + examGeneral + etc.) for pathognomonic matching */
  examText?: string;
}

// ─── Dual-marker system ───────────────────────────────────────────────────────

/**
 * For each differential in the ranked list, indicates which explanatory
 * "best-by" marker applies:
 *
 *  mostCommonId     — highest base prior (most prevalent in this practice)
 *  clinicalBestId   — highest symptom + detail score, ignoring demographics
 *  demographicBestId— dx that receives the biggest age/sex uplift for THIS patient
 *  anatomicalBestId — top-ranked dx in the dominant anatomical body region
 *  temporalBestId   — best match for selected temporal detail clues
 */
export interface DxMarkerSet {
  mostCommonId: string;
  clinicalBestId: string | null;
  demographicBestId: string | null;
  anatomicalBestId: string | null;
  temporalBestId: string | null;
}

// Words in a detailWeight key that indicate temporal clues
const TEMPORAL_KEYWORDS = [
  'sudden', 'onset', 'acute', 'gradual', 'progressive', 'constant', 'continuous',
  'intermittent', 'nocturnal', 'morning', 'evening', 'duration', 'chronic',
  'weeks', 'months', 'hours', 'days', 'tarry', 'tearing', 'episodic',
  'recurrent', 'worsening', 'fluctuating',
];

// Category → broad anatomical body region
const CATEGORY_REGION: Record<string, string> = {
  'Biliary': 'Abdominal',
  'GI Bleed': 'Abdominal',
  'Colorectal': 'Abdominal',
  'Upper GI': 'Abdominal',
  'Abdominal': 'Abdominal',
  'Hernia': 'Abdominal',
  'Appendix': 'Abdominal',
  'Liver': 'Abdominal',
  'HPB': 'Abdominal',
  'Anorectal': 'Abdominal',
  'Paediatric Surgical': 'Abdominal',
  'Respiratory': 'Thoracic',
  'Cardiovascular': 'Thoracic',
  'Vascular': 'Vascular / Limb',
  'Neurological': 'Head / Neurological',
  'Paediatric Medical': 'Systemic',
  'Endocrine': 'Systemic',
  'Rheumatology': 'Systemic',
  'Haematology': 'Systemic',
  'Infectious': 'Systemic',
  'Skin': 'Skin',
  'Renal': 'Urogenital',
  'Urogenital': 'Urogenital',
  'ENT': 'Head / ENT',
  'Musculoskeletal': 'Musculoskeletal',
  'Orthopaedic': 'Musculoskeletal',
  'Breast': 'Breast',
  'Gynaecological': 'Urogenital',
  'Psychiatric': 'Systemic',
  'Oncology': 'Systemic',
  'Tropical': 'Systemic',
};

// ─── Pathognomonic & exclusion signs by disease ID ───────────────────────────
// Checked case-insensitively against combined clinical text (symptoms + examText).
// Pathognomonic: single sign drives score +150 (essentially confirms).
// Exclusion: presence multiplies score × 0.05 (near-rules-out).
const PATHOGNOMONIC_SIGNS: Record<string, string[]> = {
  acute_cholecystitis:    ["murphy's sign", "murphy sign"],
  acute_cholangitis:      ["charcot's triad", "reynolds' pentad", "reynolds pentad"],
  cbd_obstruction:        ["courvoisier's sign", "courvoisier sign", "painless palpable gallbladder"],
  acute_appendicitis:     ["rovsing's sign", "psoas sign", "obturator sign", "mcburney's sign", "mcburney's point"],
  perforated_peptic_ulcer:["pneumoperitoneum", "board-like rigidity", "boardlike rigidity"],
  aaa_symptomatic:        ["pulsatile expansile mass", "expansile pulsatile", "pulsatile mass"],
  aortic_dissection:      ["blood pressure differential", "bp differential arm", "pulse differential arm"],
  mesenteric_ischaemia:   ["pain out of proportion to signs", "severe pain minimal signs"],
  cardiac_tamponade:      ["beck's triad", "pulsus paradoxus"],
  tension_pneumothorax:   ["tracheal deviation", "absent breath sounds unilateral"],
  stemi:                  ["st elevation", "tombstone t waves", "new lbbb"],
  necrotising_fasciitis:  ["crepitus skin", "gas tracking fascia", "skin necrosis tracking"],
  fournier_gangrene:      ["crepitus perineum", "gas perineum", "necrotic perineum", "necrotic scrotum"],
  paed_intussusception:   ["redcurrant jelly stool", "red currant jelly", "sausage mass rlq", "dance sign"],
  sigmoid_volvulus:       ["coffee bean sign", "bent inner tube sign", "coffee-bean xray"],
  portal_hypertension:    ["caput medusae"],
  testicular_epididymis:  ["cremasteric reflex absent", "horizontal lie testis", "high-riding testis"],
  pneumothorax:           ["absent breath sounds", "hyper-resonance unilateral"],
  epiglottitis:           ["thumb sign epiglottis", "tripod position", "drooling stridor"],
  large_bowel_obstruction:["caecal volvulus", "sigmoid volvulus pattern"],
  hepatocellular_carcinoma:["bruit hepatic", "arterial bruit liver"],
};

const EXCLUSION_SIGNS: Record<string, string[]> = {
  acute_appendicitis:   ["murphy's sign", "murphy sign"],
  acute_cholecystitis:  ["rovsing's sign", "psoas sign", "mcburney's sign"],
};

export function computeDxMarkers(
  ranked: RankedDifferential[],
  input: InferenceInput,
): DxMarkerSet {
  const { symptoms, symptomDetails, age, sex } = input;
  const hasSymptoms = symptoms.length > 0;

  // ── 1. Most common: highest basePrior ──
  const mostCommon = DIFFERENTIALS.reduce((best, dx) =>
    dx.basePrior > best.basePrior ? dx : best,
  DIFFERENTIALS[0]);

  // ── 2. Clinical best: symptom + detail score, no demographics ──
  let clinicalBestId: string | null = null;
  if (hasSymptoms) {
    let best = -Infinity;
    for (const dx of DIFFERENTIALS) {
      let s = dx.basePrior;
      for (const sym of symptoms) {
        s += dx.symptomWeights[sym] ?? 0;
        s += dx.negativeWeights?.[sym] ?? 0;
      }
      for (const [sym, details] of Object.entries(symptomDetails)) {
        for (const d of details) s += dx.detailWeights?.[`${sym}.${d}`] ?? 0;
      }
      if (s > best) { best = s; clinicalBestId = dx.id; }
    }
  }

  // ── 3. Demographic best: biggest age + sex modifier for this patient ──
  let demographicBestId: string | null = null;
  let bestDemoBoost = 0;
  for (const dx of DIFFERENTIALS) {
    let boost = 0;
    if (dx.ageModifier && age != null) {
      const { gt, lt, add } = dx.ageModifier;
      if ((gt === undefined || age > gt) && (lt === undefined || age < lt)) boost += add;
    }
    if (dx.sexModifier && sex === dx.sexModifier.sex) boost += dx.sexModifier.add;
    if (boost > bestDemoBoost) { bestDemoBoost = boost; demographicBestId = dx.id; }
  }

  // ── 4. Anatomical best: top-ranked dx in the dominant body region ──
  let anatomicalBestId: string | null = null;
  if (hasSymptoms && ranked.length > 0) {
    const regionCount: Record<string, number> = {};
    for (const r of ranked.slice(0, 6)) {
      const entry = DIFFERENTIALS.find(d => d.id === r.id);
      if (entry) {
        const region = CATEGORY_REGION[entry.category] ?? entry.category;
        regionCount[region] = (regionCount[region] ?? 0) + 1;
      }
    }
    const dominantRegion = Object.entries(regionCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    if (dominantRegion) {
      const topInRegion = ranked.find(r => {
        const entry = DIFFERENTIALS.find(d => d.id === r.id);
        return entry && (CATEGORY_REGION[entry.category] ?? entry.category) === dominantRegion;
      });
      if (topInRegion) anatomicalBestId = topInRegion.id;
    }
  }

  // ── 5. Temporal best: best match for temporal detail clues selected ──
  let temporalBestId: string | null = null;
  if (hasSymptoms) {
    const temporalDetails: string[] = [];
    for (const [sym, details] of Object.entries(symptomDetails)) {
      for (const d of details) {
        const key = `${sym}.${d}`;
        if (TEMPORAL_KEYWORDS.some(kw => key.toLowerCase().includes(kw))) {
          temporalDetails.push(key);
        }
      }
    }
    if (temporalDetails.length > 0) {
      let bestT = 0;
      for (const dx of DIFFERENTIALS) {
        let ts = 0;
        for (const key of temporalDetails) ts += dx.detailWeights?.[key] ?? 0;
        if (ts > bestT) { bestT = ts; temporalBestId = dx.id; }
      }
    }
  }

  return { mostCommonId: mostCommon.id, clinicalBestId, demographicBestId, anatomicalBestId, temporalBestId };
}

function computeRawScore(
  dx: DifferentialEntry,
  { symptoms, symptomDetails, age, sex, examText }: InferenceInput,
): number {
  // ── Pathognomonic check: single sign drives score +150 ────────────────────
  const fullClinicalText = [...symptoms, examText ?? ''].join(' ').toLowerCase();
  const pathoSigns = PATHOGNOMONIC_SIGNS[dx.id];
  const matchedSign = pathoSigns?.find(s => fullClinicalText.includes(s.toLowerCase()));

  const exclusionSigns = EXCLUSION_SIGNS[dx.id] ?? dx.exclusionSigns;
  const isExcluded = exclusionSigns?.some(s => fullClinicalText.includes(s.toLowerCase()));
  if (isExcluded) return 0;

  let score = dx.basePrior;
  let symptomHit = false;

  for (const sym of symptoms) {
    const sw = dx.symptomWeights[sym] ?? 0;
    score += sw;
    score += dx.negativeWeights?.[sym] ?? 0;
    if (sw > 0) symptomHit = true;
  }

  for (const [sym, details] of Object.entries(symptomDetails)) {
    for (const detail of details) {
      const key = `${sym}.${detail}`;
      const dw = dx.detailWeights?.[key] ?? 0;
      score += dw;
      if (dw > 0) symptomHit = true;
    }
  }

  if (dx.ageModifier && age != null) {
    const { gt, lt, add } = dx.ageModifier;
    const aboveFloor = gt === undefined || age > gt;
    const belowCeiling = lt === undefined || age < lt;
    if (aboveFloor && belowCeiling) score += add;
  }
  if (dx.sexModifier && sex === dx.sexModifier.sex) {
    score += dx.sexModifier.add;
  }

  // When the clinician has selected symptoms but none appear in this differential's
  // weight tables, apply a strong relevance penalty (×0.15) so high-basePrior /
  // demographically-boosted conditions cannot dominate unrelated presentations.
  // (e.g. acute cholecystitis must not rank #1 when the only symptom is facial weakness)
  if (symptoms.length > 0 && !symptomHit) score *= 0.15;

  if (matchedSign) score += 150;
  return Math.max(0, score);
}

/**
 * Returns differentials ranked by confidence, normalised so all confidence
 * values add to ≤ 100 (softmax-like).
 */
export function computeRankedDifferentials(input: InferenceInput): RankedDifferential[] {
  const fullClinicalText = [...input.symptoms, input.examText ?? ''].join(' ').toLowerCase();
  const scored = DIFFERENTIALS.map(dx => ({
    ...dx,
    rawScore: computeRawScore(dx, input),
  }));

  const total = scored.reduce((sum, d) => sum + d.rawScore, 0);
  const ranked = scored
    .map(d => {
      const pathoSigns = PATHOGNOMONIC_SIGNS[d.id];
      const matchedSign = pathoSigns?.find(s => fullClinicalText.includes(s.toLowerCase()));
      return {
        id: d.id,
        name: d.name,
        category: d.category,
        urgency: d.urgency,
        rawScore: d.rawScore,
        confidence: total > 0 ? Math.round((d.rawScore / total) * 100) : 0,
        pathognomicMatchSign: matchedSign,
      };
    })
    .sort((a, b) => b.rawScore - a.rawScore);

  return ranked;
}

// ─── Next-best-question algorithm ─────────────────────────────────────────────

/**
 * Every unselected top-level symptom gets an "information gain" score:
 *   infoGain = (weight in #1 dx) * 0.55 + |weight_#1 - weight_#2| * 0.45
 *
 * Tier 1 (large chips): infoGain > 18
 * Tier 2 (normal):      infoGain > 8
 * Tier 3 (small/dim):   otherwise
 */
export function getSuggestedSymptoms(
  allSymptoms: string[],
  selected: string[],
  ranked: RankedDifferential[],
): SuggestedSymptom[] {
  const rank1 = DIFFERENTIALS.find(d => d.id === ranked[0]?.id);
  const rank2 = DIFFERENTIALS.find(d => d.id === ranked[1]?.id);
  if (!rank1) return [];

  const unselected = allSymptoms.filter(s => !selected.includes(s));

  return unselected
    .map(sym => {
      const w1 = rank1.symptomWeights[sym] ?? 0;
      const w2 = rank2 ? (rank2.symptomWeights[sym] ?? 0) : 0;
      const infoGain = w1 * 0.55 + Math.abs(w1 - w2) * 0.45;
      const tier: SymptomTier = infoGain > 18 ? 1 : infoGain > 8 ? 2 : 3;
      return {
        symptom: sym,
        tier,
        infoGain: Math.round(infoGain),
        topDxName: rank1.name,
      };
    })
    .sort((a, b) => b.infoGain - a.infoGain);
}

// ─── Confidence label ─────────────────────────────────────────────────────────

export function getLeadingDiagnosis(
  ranked: RankedDifferential[],
  symptoms: string[],
): { name: string; confidence: number; urgency: DxUrgency } | null {
  if (!symptoms.length || !ranked.length) return null;
  const top = ranked[0];
  // Only surface a "working diagnosis" banner when confidence ≥ 60%
  if (top.confidence < 60) return null;
  return { name: top.name, confidence: top.confidence, urgency: top.urgency };
}
