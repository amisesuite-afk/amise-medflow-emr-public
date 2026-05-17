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
  /** Base probability before any symptoms (0–60). Higher = more common in this practice. */
  basePrior: number;
  /** Top-level symptom chip → score added when present */
  symptomWeights: Record<string, number>;
  /** "symptom.detail" → score added when symptom detail is selected */
  detailWeights?: Record<string, number>;
  /** Symptoms that reduce the score when present */
  negativeWeights?: Record<string, number>;
  ageModifier?: { gt: number; add: number };
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
];

// ─── Scoring ──────────────────────────────────────────────────────────────────

interface InferenceInput {
  symptoms: string[];
  symptomDetails: Record<string, string[]>;
  age?: number | null;
  sex?: string;
}

function computeRawScore(
  dx: DifferentialEntry,
  { symptoms, symptomDetails, age, sex }: InferenceInput,
): number {
  let score = dx.basePrior;

  for (const sym of symptoms) {
    score += dx.symptomWeights[sym] ?? 0;
    score += dx.negativeWeights?.[sym] ?? 0;
  }

  for (const [sym, details] of Object.entries(symptomDetails)) {
    for (const detail of details) {
      const key = `${sym}.${detail}`;
      score += dx.detailWeights?.[key] ?? 0;
    }
  }

  if (dx.ageModifier && age != null && age > dx.ageModifier.gt) {
    score += dx.ageModifier.add;
  }
  if (dx.sexModifier && sex === dx.sexModifier.sex) {
    score += dx.sexModifier.add;
  }

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
