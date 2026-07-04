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
}

export interface RankedDifferential {
  id: string;
  name: string;
  category: string;
  urgency: DxUrgency;
  rawScore: number;
  confidence: number; // 0–100
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
];

// ─── Scoring ──────────────────────────────────────────────────────────────────

export interface InferenceInput {
  symptoms: string[];
  symptomDetails: Record<string, string[]>;
  age?: number | null;
  sex?: string;
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
  { symptoms, symptomDetails, age, sex }: InferenceInput,
): number {
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

  return Math.max(0, score);
}

/**
 * Returns differentials ranked by confidence, normalised so all confidence
 * values add to ≤ 100 (softmax-like).
 */
export function computeRankedDifferentials(input: InferenceInput): RankedDifferential[] {
  const scored = DIFFERENTIALS.map(dx => ({
    ...dx,
    rawScore: computeRawScore(dx, input),
  }));

  const total = scored.reduce((sum, d) => sum + d.rawScore, 0);
  const ranked = scored
    .map(d => ({
      id: d.id,
      name: d.name,
      category: d.category,
      urgency: d.urgency,
      rawScore: d.rawScore,
      confidence: total > 0 ? Math.round((d.rawScore / total) * 100) : 0,
    }))
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
