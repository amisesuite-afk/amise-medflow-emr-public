/**
 * Maps a Chief Complaint name + SOCRATES answer record → pane-engine feature IDs.
 *
 * The extraction runs two passes:
 *  1. CC-level hints — the complaint name implies a cluster of features that
 *     are almost always present for that presentation.
 *  2. Answer-level scan — each SOCRATES answer string is matched against keyword
 *     patterns to extract individual features.
 *
 * Returns Record<featureId, boolean> where true = present, false = absent.
 * Only features with clear positive evidence are emitted; absence inference is
 * left to the Bayesian engine (DEFAULT_SENSITIVITY covers unlisted features).
 */

type FeatureMap = Record<string, boolean>;

// ── CC-level feature hints ────────────────────────────────────────────────────
// Keyed by lowercased partial CC name (substring match).

const CC_HINTS: Array<{ pattern: RegExp; features: FeatureMap }> = [
  // Appendix
  { pattern: /appendic/i,          features: { rlq_pain: true, anorexia: true, nausea_vomiting: true, fever: true } },
  // Biliary / cholecystitis
  { pattern: /cholecyst/i,         features: { ruq_pain: true, fatty_food_trigger: true, nausea_vomiting: true } },
  // CBD / choledocholithiasis
  { pattern: /choledocho|cbd stone/i, features: { ruq_pain: true, jaundice: true, dark_urine: true } },
  // Cholangitis
  { pattern: /cholangitis/i,       features: { ruq_pain: true, jaundice: true, fever: true, rigors: true } },
  // Pancreatitis
  { pattern: /pancreatit/i,        features: { epigastric_pain: true, radiation_to_back: true, nausea_vomiting: true, elevated_amylase: true } },
  // Peptic ulcer
  { pattern: /peptic ulcer|pud/i,  features: { epigastric_pain: true, nocturnal_pain: true, antacid_relief: true } },
  // GORD / reflux
  { pattern: /gord|reflux|gerd/i,  features: { heartburn: true, epigastric_pain: true, antacid_relief: true, regurgitation: true } },
  // Diverticulitis
  { pattern: /diverticul/i,        features: { lif_pain: true, fever: true } },
  // Bowel obstruction
  { pattern: /bowel obstruct|intestinal obstruct/i, features: { colicky_pain: true, abdominal_distension: true, absolute_constipation: true, nausea_vomiting: true } },
  // Colorectal cancer
  { pattern: /colorectal cancer|colon cancer|rectal cancer/i, features: { change_bowel_habit: true, pr_bleeding: true, weight_loss: true } },
  // Hernia — inguinal/femoral
  { pattern: /inguinal hernia|femoral hernia/i, features: { groin_swelling: true, groin_lump_reducible: true } },
  // Hernia — umbilical
  { pattern: /umbilical hernia/i,  features: { umbilical_swelling: true } },
  // Haemorrhoids
  { pattern: /haemorrhoid|hemorrhoid/i, features: { pr_bleeding: true, anal_pain: true } },
  // Anal fissure
  { pattern: /anal fissure/i,      features: { anal_pain: true, pr_bleeding: true } },
  // Perianal abscess / pilonidal
  { pattern: /perianal abscess|pilonidal/i, features: { anal_pain: true, perianal_swelling: true, fever: true } },
  // Breast lump / fibroadenoma / carcinoma
  { pattern: /breast/i,            features: { breast_lump: true } },
  // Thyroid / neck mass
  { pattern: /thyroid|neck lump|neck mass/i, features: { neck_lump: true } },
  // Renal / ureteric colic
  { pattern: /renal colic|ureteric colic|kidney stone/i, features: { loin_pain: true, radiation_to_groin: true, colicky_pain: true, haematuria: true } },
  // Testicular torsion / epididymo-orchitis
  { pattern: /testicular torsion|torsion/i, features: { testicular_pain: true, scrotal_swelling: true, nausea_vomiting: true, absent_cremasteric: true } },
  { pattern: /epididymo|orchitis/i,features: { testicular_pain: true, scrotal_swelling: true, fever: true } },
  // DVT
  { pattern: /dvt|deep vein thrombosis/i, features: { leg_swelling: true, calf_tenderness: true } },
  // PE
  { pattern: /pulmonary embolism|pe /i, features: { dyspnoea_pe: true, pleuritic_chest_pain: true } },
  // Peripheral arterial disease
  { pattern: /peripheral arterial|pad\b|arterial disease/i, features: { claudication: true, absent_pulses: true } },
  // Varicose veins
  { pattern: /varicose/i,          features: { varicosities: true, leg_swelling: true } },
  // Upper GI bleed
  { pattern: /upper gi bleed|haematemesis|hematemesis/i, features: { alcohol_use: false, nausea_vomiting: true } },
  // Oesophageal / dysphagia
  { pattern: /oesophageal|esophageal|barrett|achalasia/i, features: { dysphagia_progressive: true, regurgitation: true } },
  // Acute abdomen generic
  { pattern: /acute abdomen|peritonitis/i, features: { rebound_tenderness: true, fever: true, nausea_vomiting: true } },
  // Wound / post-op
  { pattern: /wound|post.?op|surgical site/i, features: { wound_erythema: true, wound_discharge: true } },
];

// ── Answer-level feature extraction ──────────────────────────────────────────

type AnswerRule = { pattern: RegExp; features: FeatureMap };

const SITE_RULES: AnswerRule[] = [
  { pattern: /\brlq\b|right (?:lower|iliac)|right iliac fossa/i,  features: { rlq_pain: true } },
  { pattern: /\bruq\b|right (?:upper|hypochondr)/i,               features: { ruq_pain: true } },
  { pattern: /epigastric|upper (?:abdomen|belly)|stomach/i,       features: { epigastric_pain: true } },
  { pattern: /\bllq\b|\blif\b|left (?:lower|iliac)|left iliac/i, features: { lif_pain: true } },
  { pattern: /periumbilical|around navel|around belly button/i,   features: { rlq_pain: true } },
  { pattern: /\bgroin\b|\binguinal\b|\bfemoral\b/i,              features: { groin_swelling: true } },
  { pattern: /\banal\b|\bperianal\b|\brectal\b|\bbottom\b/i,     features: { anal_pain: true } },
  { pattern: /\bloin\b|\bflank\b|\brenal angle\b/i,              features: { loin_pain: true } },
  { pattern: /\btesticular?\b|\bscrotum\b|\bscrotal\b/i,         features: { testicular_pain: true, scrotal_swelling: true } },
  { pattern: /\bbreast\b|\bnipple\b/i,                           features: { breast_lump: true } },
  { pattern: /\bneck\b|\bthyroid\b/i,                            features: { neck_lump: true } },
  { pattern: /\bcalf\b|\bleg\b|\bshin\b/i,                       features: { leg_swelling: true } },
  { pattern: /\bpelvic\b|\b(?:lower )?pelvis\b/i,                features: { pelvic_pain: true } },
  { pattern: /\bsuprapubic\b/i,                                  features: { suprapubic_pain: true } },
  { pattern: /\bwound\b|\bincision\b|\bscar\b/i,                 features: { wound_erythema: true } },
];

const RADIATION_RULES: AnswerRule[] = [
  { pattern: /\bback\b|\bdorsal\b/i,                             features: { radiation_to_back: true } },
  { pattern: /groin|genitalia|testicular?|scrotum/i,             features: { radiation_to_groin: true } },
  { pattern: /right shoulder tip|shoulder tip/i,                 features: { ruq_pain: true } },
  { pattern: /\bchest\b/i,                                       features: { chest_pain_oesophageal: true } },
];

const CHARACTER_RULES: AnswerRule[] = [
  { pattern: /colicky|griping|wave/i,                            features: { colicky_pain: true } },
  { pattern: /burning|heartburn/i,                               features: { heartburn: true } },
  { pattern: /\baching\b|\bdull\b/i,                             features: {} },
];

const ASSOC_RULES: AnswerRule[] = [
  { pattern: /nausea|vomit/i,                                    features: { nausea_vomiting: true } },
  { pattern: /\bfever\b|\bpyrexia\b|\btemperature\b/i,          features: { fever: true } },
  { pattern: /jaundice|yellow(?:ing)?/i,                         features: { jaundice: true } },
  { pattern: /pr.?bleed|rectal bleed|blood.?(?:in )?stool/i,    features: { pr_bleeding: true } },
  { pattern: /anorexia|loss of appetite|no appetite|poor appetite/i, features: { anorexia: true } },
  { pattern: /distension|bloating|bloated/i,                     features: { abdominal_distension: true } },
  { pattern: /\brigors?\b|chills?|shivering/i,                  features: { rigors: true } },
  { pattern: /change(?:d)? (?:in )?bowel|altered bowel/i,       features: { change_bowel_habit: true } },
  { pattern: /weight loss|losing weight/i,                       features: { weight_loss: true } },
  { pattern: /constipat|no flatus|obstipation/i,                features: { absolute_constipation: true } },
  { pattern: /dark urine|cola.coloured|tea.coloured/i,           features: { dark_urine: true } },
  { pattern: /itch|pruritus/i,                                   features: { pruritus: true } },
  { pattern: /heartburn|acid|reflux/i,                           features: { heartburn: true } },
  { pattern: /dysphagia|swallow/i,                               features: { dysphagia_progressive: true } },
  { pattern: /regurgitat/i,                                      features: { regurgitation: true } },
  { pattern: /dysuria|burning.{0,10}urin|painful urin/i,        features: { dysuria: true } },
  { pattern: /haematuria|blood.{0,10}urin|urine.*blood/i,        features: { haematuria: true } },
  { pattern: /vaginal discharge/i,                               features: { vaginal_discharge: true } },
  { pattern: /mucus.{0,10}stool|slime.{0,10}stool/i,            features: { mucus_pr: true } },
  { pattern: /tenesmus|feel.*not empty|incomplete.*empty/i,     features: { tenesmus: true } },
  { pattern: /\bhoarse/i,                                        features: { hoarseness: true } },
  { pattern: /shortness.{0,10}breath|breathless|dyspno/i,       features: { dyspnoea_pe: true } },
  { pattern: /\bfatigue\b|\btired\b|\blethargy\b/i,             features: { fatigue: true } },
  { pattern: /\bsweat/i,                                         features: { fever: true } },
  { pattern: /\bjoint/i,                                         features: {} },
];

const TIMING_RULES: AnswerRule[] = [
  { pattern: /nocturnal|night/i,                                 features: { nocturnal_pain: true } },
  { pattern: /after (?:fatty|greasy|fried)|postprandial/i,       features: { fatty_food_trigger: true } },
];

const TRIGGERS_RULES: AnswerRule[] = [
  { pattern: /fatty|greasy|fried|oily|after meal/i,              features: { fatty_food_trigger: true } },
  { pattern: /alcohol/i,                                         features: { alcohol_use: true } },
  { pattern: /antacid.*(?:help|reliev)|acid.*reliev/i,           features: { antacid_relief: true } },
];

const RELIEF_RULES: AnswerRule[] = [
  { pattern: /antacid|gaviscon|omeprazole|ranitidine/i,          features: { antacid_relief: true } },
];

const KEY_TO_RULES: Record<string, AnswerRule[]> = {
  site:      SITE_RULES,
  location:  SITE_RULES,
  radiation: RADIATION_RULES,
  character: CHARACTER_RULES,
  type:      CHARACTER_RULES,
  assoc:     ASSOC_RULES,
  associated: ASSOC_RULES,
  timing:    TIMING_RULES,
  pattern:   TIMING_RULES,
  triggers:  TRIGGERS_RULES,
  relief:    RELIEF_RULES,
};

function applyRules(text: string, rules: AnswerRule[]): FeatureMap {
  const out: FeatureMap = {};
  for (const rule of rules) {
    if (rule.pattern.test(text)) {
      Object.assign(out, rule.features);
    }
  }
  return out;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Extract pane-engine feature IDs from a CC name and SOCRATES answer map.
 *
 * @param cc        Chief complaint label (e.g. "Acute Abdominal Pain")
 * @param answers   Record<socratesKey, answerText> from ChiefComplaintStrip
 * @returns         Record<featureId, true> — only positively-evidenced features
 */
export function extractFeaturesFromSocrates(
  cc: string,
  answers: Record<string, string>,
): FeatureMap {
  const out: FeatureMap = {};

  // Pass 1 — CC-level hints
  for (const hint of CC_HINTS) {
    if (hint.pattern.test(cc)) {
      Object.assign(out, hint.features);
    }
  }

  // Pass 2 — per-answer rule sets
  for (const [key, text] of Object.entries(answers)) {
    if (!text.trim()) continue;
    const normKey = key.toLowerCase().replace(/[\s_-]+/g, '_').replace(/[^a-z_]/g, '');
    const rules = KEY_TO_RULES[normKey] ?? KEY_TO_RULES[normKey.split('_')[0]] ?? [];
    Object.assign(out, applyRules(text, rules));
  }

  // Remove false entries (only present = true is useful for seeding)
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v === true));
}
