export type QuestionMode = 'screening' | 'condition_specific';
export type QuestionType = 'single_choice' | 'multi_choice' | 'text' | 'scale' | 'boolean' | 'date';
export type Specialty = 'general_surgery' | 'endoscopy' | 'breast_surgery' | 'post_op' | 'general_medical';
export type Urgency = 'routine' | 'priority' | 'urgent' | 'emergency';

export interface QuestionOption {
  value: string;
  label: string;
  triggersKeys?: string[];
  skipsKeys?: string[];
  isRedFlag?: boolean;
  urgencyIfSelected?: Urgency;
}

export interface Question {
  key: string;
  text: string;
  type: QuestionType;
  options?: QuestionOption[];
  isRedFlagScreen?: boolean;
  helpText?: string;
  required?: boolean;
  minValue?: number;
  maxValue?: number;
}

export interface Response {
  questionKey: string;
  questionText: string;
  answerValue: string | string[];
  answerDisplay: string;
  isRedFlag: boolean;
  sequenceNumber: number;
  answeredAt: string;
}

export interface RedFlag {
  questionKey: string;
  answerValue: string;
  severity: Urgency;
  message: string;
}

export interface SessionState {
  sessionId: string;
  templateKey: string;
  mode: QuestionMode;
  specialty?: Specialty;
  responses: Response[];
  redFlags: RedFlag[];
  queuedKeys: string[];
  answeredKeys: Set<string>;
  currentQuestion: Question | null;
  isComplete: boolean;
  estimatedRemaining: number;
}

const MAX_QUESTIONS = 12;
const MIN_SUFFICIENT_RESPONSES = 3;

export const QUESTION_BANK: Record<string, Question> = {
  chief_complaint: {
    key: 'chief_complaint',
    text: 'What is the main reason for your visit today?',
    type: 'multi_choice',
    required: true,
    options: [
      { value: 'abdominal_pain', label: 'Abdominal pain', triggersKeys: ['pain_location', 'pain_severity', 'pain_character', 'pain_radiation', 'peritoneal_signs', 'nausea_vomiting', 'last_bowel_movement', 'associated_fever'] },
      { value: 'rectal_bleeding', label: 'Rectal bleeding', triggersKeys: ['rectal_bleeding_character', 'rectal_bleeding_volume', 'bowel_habit_change', 'colonoscopy_history', 'family_history_cancer', 'alarm_features'] },
      { value: 'blood_in_vomit_stool', label: 'Blood in vomit/stool', triggersKeys: ['hematemesis_volume', 'rectal_bleeding_character', 'alarm_features'], isRedFlag: true, urgencyIfSelected: 'urgent' },
      { value: 'difficulty_swallowing', label: 'Difficulty swallowing', triggersKeys: ['dysphagia_severity', 'odynophagia', 'alarm_features'], isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'acid_reflux', label: 'Acid reflux/heartburn', triggersKeys: ['gerd_frequency', 'alarm_features', 'odynophagia'] },
      { value: 'lump_or_mass', label: 'Lump or mass', triggersKeys: ['breast_lump_duration', 'breast_lump_change', 'skin_changes'] },
      { value: 'breast_concern', label: 'Breast concern', triggersKeys: ['breast_lump_duration', 'breast_lump_change', 'nipple_discharge', 'skin_changes', 'breast_pain', 'mammogram_history', 'family_history_breast'] },
      { value: 'change_in_bowel_habit', label: 'Change in bowel habit', triggersKeys: ['bowel_habit_change', 'rectal_bleeding_character', 'colonoscopy_history', 'family_history_cancer', 'alarm_features'] },
      { value: 'nausea_vomiting', label: 'Nausea/vomiting', triggersKeys: ['nausea_vomiting', 'associated_fever', 'last_bowel_movement'] },
      { value: 'weight_loss', label: 'Weight loss (unintentional)', triggersKeys: ['alarm_features'], isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'post_op_concern', label: 'Post-operative concern', triggersKeys: ['surgery_date', 'surgery_type', 'wound_concerns', 'wound_concerns_severity', 'fever_post_op', 'diet_tolerance'] },
      { value: 'jaundice', label: 'Jaundice/yellowing', triggersKeys: ['associated_fever', 'alarm_features', 'dysphagia_severity'], isRedFlag: true, urgencyIfSelected: 'urgent' },
      { value: 'general_screening', label: 'General check-up/screening', triggersKeys: ['screening_reason', 'last_checkup'] },
    ],
  },

  symptom_duration: {
    key: 'symptom_duration',
    text: 'How long have you had this symptom?',
    type: 'single_choice',
    options: [
      { value: 'less_24h', label: 'Less than 24 hours' },
      { value: '1_7_days', label: '1–7 days' },
      { value: '1_4_weeks', label: '1–4 weeks' },
      { value: '1_3_months', label: '1–3 months' },
      { value: 'over_3_months', label: 'More than 3 months' },
    ],
  },

  pain_severity: {
    key: 'pain_severity',
    text: 'On a scale of 0 to 10, how severe is your pain right now? (0 = no pain, 10 = worst imaginable)',
    type: 'scale',
    isRedFlagScreen: true,
    minValue: 0,
    maxValue: 10,
    helpText: '8 or above is considered severe and will be flagged for urgent review.',
  },

  pain_character: {
    key: 'pain_character',
    text: 'How would you describe the character of your pain?',
    type: 'single_choice',
    options: [
      { value: 'constant', label: 'Constant/continuous' },
      { value: 'intermittent', label: 'Comes and goes' },
      { value: 'sharp', label: 'Sharp/stabbing' },
      { value: 'dull', label: 'Dull/aching' },
      { value: 'burning', label: 'Burning' },
      { value: 'cramping', label: 'Cramping' },
    ],
  },

  pain_radiation: {
    key: 'pain_radiation',
    text: 'Does the pain spread anywhere?',
    type: 'multi_choice',
    options: [
      { value: 'localised', label: 'Stays in one place' },
      { value: 'to_back', label: 'Spreads to back' },
      { value: 'to_chest', label: 'Spreads to chest' },
      { value: 'to_shoulder', label: 'Spreads to shoulder' },
      { value: 'to_groin', label: 'Spreads to groin' },
    ],
  },

  associated_fever: {
    key: 'associated_fever',
    text: 'Do you have a fever or feel feverish?',
    type: 'boolean',
    isRedFlagScreen: true,
  },

  prior_surgery: {
    key: 'prior_surgery',
    text: 'Have you had any previous surgery or procedures?',
    type: 'boolean',
  },

  current_medications: {
    key: 'current_medications',
    text: 'Please list any medications you are currently taking (including over-the-counter medicines and supplements).',
    type: 'text',
    helpText: 'Include blood thinners, diabetes medicines, or heart medicines if applicable.',
  },

  allergies: {
    key: 'allergies',
    text: 'Do you have any known medication allergies? If yes, please list them.',
    type: 'text',
  },

  smoking_status: {
    key: 'smoking_status',
    text: 'What is your smoking status?',
    type: 'single_choice',
    options: [
      { value: 'never', label: 'Never' },
      { value: 'ex_smoker', label: 'Ex-smoker' },
      { value: 'current', label: 'Current smoker' },
    ],
  },

  alcohol_use: {
    key: 'alcohol_use',
    text: 'How would you describe your alcohol use?',
    type: 'single_choice',
    options: [
      { value: 'none', label: 'None' },
      { value: 'occasional', label: 'Occasional (less than weekly)' },
      { value: 'regular', label: 'Regular (weekly)' },
      { value: 'heavy', label: 'Heavy (daily)' },
    ],
  },

  family_history_cancer: {
    key: 'family_history_cancer',
    text: 'Is there a family history of cancer (any type)?',
    type: 'boolean',
    isRedFlagScreen: true,
  },

  dysphagia_severity: {
    key: 'dysphagia_severity',
    text: 'Which best describes your difficulty swallowing?',
    type: 'single_choice',
    isRedFlagScreen: true,
    options: [
      { value: 'solids_only', label: 'Solids only' },
      { value: 'solids_and_liquids', label: 'Solids and liquids' },
      { value: 'liquids_only', label: 'Liquids only now', isRedFlag: true, urgencyIfSelected: 'urgent' },
      { value: 'saliva_only', label: 'Saliva only (cannot swallow anything)', isRedFlag: true, urgencyIfSelected: 'emergency' },
    ],
  },

  odynophagia: {
    key: 'odynophagia',
    text: 'Do you experience pain when swallowing?',
    type: 'boolean',
  },

  hematemesis_volume: {
    key: 'hematemesis_volume',
    text: 'How much blood have you vomited or seen?',
    type: 'single_choice',
    options: [
      { value: 'streaks', label: 'Streaks in spit' },
      { value: 'tablespoon', label: 'Tablespoon amount' },
      { value: 'cup_or_more', label: 'Cup or more', isRedFlag: true, urgencyIfSelected: 'urgent' },
      { value: 'coffee_ground', label: 'Coffee-ground vomit' },
    ],
  },

  gerd_frequency: {
    key: 'gerd_frequency',
    text: 'How often do you experience acid reflux or heartburn?',
    type: 'single_choice',
    options: [
      { value: 'rarely', label: 'Rarely (less than monthly)' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'daily', label: 'Daily' },
    ],
  },

  alarm_features: {
    key: 'alarm_features',
    text: 'Do you have any of the following? (Select all that apply)',
    type: 'multi_choice',
    isRedFlagScreen: true,
    options: [
      { value: 'weight_loss', label: 'Unintentional weight loss', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'anaemia', label: 'Anaemia/feeling pale or unusually tired', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'dysphagia', label: 'Difficulty swallowing', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'night_sweats', label: 'Night sweats', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'loss_of_appetite', label: 'Loss of appetite', isRedFlag: true, urgencyIfSelected: 'priority' },
    ],
  },

  rectal_bleeding_character: {
    key: 'rectal_bleeding_character',
    text: 'How would you describe the rectal bleeding?',
    type: 'single_choice',
    options: [
      { value: 'fresh_on_paper', label: 'Fresh red blood on toilet paper' },
      { value: 'fresh_mixed', label: 'Fresh blood mixed with stool' },
      { value: 'dark_tarry', label: 'Dark tarry stool', isRedFlag: true, urgencyIfSelected: 'urgent' },
      { value: 'mucus_blood', label: 'Mucus with blood' },
    ],
  },

  rectal_bleeding_volume: {
    key: 'rectal_bleeding_volume',
    text: 'How much blood have you noticed?',
    type: 'single_choice',
    options: [
      { value: 'spots', label: 'Spots' },
      { value: 'tablespoon', label: 'Tablespoon amount' },
      { value: 'cup', label: 'Cup or more', isRedFlag: true, urgencyIfSelected: 'urgent' },
    ],
  },

  bowel_habit_change: {
    key: 'bowel_habit_change',
    text: 'How has your bowel habit changed?',
    type: 'single_choice',
    options: [
      { value: 'more_frequent', label: 'More frequent' },
      { value: 'less_frequent', label: 'Less frequent' },
      { value: 'alternating', label: 'Alternating between constipation and loose stools' },
      { value: 'narrower', label: 'Narrower stools' },
      { value: 'incomplete', label: 'Feeling of incomplete emptying' },
    ],
  },

  colonoscopy_history: {
    key: 'colonoscopy_history',
    text: 'When did you last have a colonoscopy?',
    type: 'single_choice',
    options: [
      { value: 'never', label: 'Never' },
      { value: 'under_5_years', label: 'Less than 5 years ago' },
      { value: '5_10_years', label: '5–10 years ago' },
      { value: 'over_10_years', label: 'More than 10 years ago' },
    ],
  },

  pain_location: {
    key: 'pain_location',
    text: 'Where is your pain located?',
    type: 'single_choice',
    options: [
      { value: 'ruq', label: 'Right upper quadrant (under right ribs)' },
      { value: 'luq', label: 'Left upper quadrant (under left ribs)' },
      { value: 'rlq', label: 'Right lower quadrant', isRedFlag: true, urgencyIfSelected: 'urgent' },
      { value: 'llq', label: 'Left lower quadrant' },
      { value: 'central', label: 'Central/around the navel' },
      { value: 'suprapubic', label: 'Lower central (below the navel)' },
      { value: 'diffuse', label: 'Diffuse/whole abdomen', isRedFlag: true, urgencyIfSelected: 'urgent' },
    ],
  },

  peritoneal_signs: {
    key: 'peritoneal_signs',
    text: 'Is your belly very hard and stiff, or does pressing and letting go cause a sharp increase in pain?',
    type: 'boolean',
    isRedFlagScreen: true,
    helpText: 'A very hard, stiff belly or worsening pain on release may need urgent assessment.',
  },

  nausea_vomiting: {
    key: 'nausea_vomiting',
    text: 'Do you have nausea or vomiting?',
    type: 'single_choice',
    options: [
      { value: 'none', label: 'None' },
      { value: 'nausea_only', label: 'Nausea only' },
      { value: 'vomiting_once', label: 'Vomited once' },
      { value: 'repeated_vomiting', label: 'Repeated vomiting' },
      { value: 'unable_to_keep_fluids', label: 'Unable to keep any fluid down', isRedFlag: true, urgencyIfSelected: 'urgent' },
    ],
  },

  last_bowel_movement: {
    key: 'last_bowel_movement',
    text: 'When did you last have a bowel movement?',
    type: 'single_choice',
    options: [
      { value: 'today', label: 'Today' },
      { value: 'yesterday', label: 'Yesterday' },
      { value: '2_3_days', label: '2–3 days ago' },
      { value: 'over_3_days', label: 'More than 3 days ago', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'cannot_remember', label: 'Cannot remember' },
    ],
  },

  breast_lump_duration: {
    key: 'breast_lump_duration',
    text: 'How long have you noticed the breast lump or change?',
    type: 'single_choice',
    options: [
      { value: 'under_1_month', label: 'Less than 1 month' },
      { value: '1_3_months', label: '1–3 months' },
      { value: 'over_3_months', label: 'More than 3 months' },
      { value: 'not_sure', label: 'Not sure' },
    ],
  },

  breast_lump_change: {
    key: 'breast_lump_change',
    text: 'Has the lump changed since you first noticed it?',
    type: 'single_choice',
    options: [
      { value: 'getting_larger', label: 'Getting larger', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'stayed_same', label: 'Stayed the same' },
      { value: 'getting_smaller', label: 'Getting smaller' },
      { value: 'comes_and_goes', label: 'Comes and goes' },
    ],
  },

  nipple_discharge: {
    key: 'nipple_discharge',
    text: 'Do you have any nipple discharge?',
    type: 'boolean',
    triggersKeys: ['nipple_discharge_type'],
  } as Question & { triggersKeys?: string[] },

  nipple_discharge_type: {
    key: 'nipple_discharge_type',
    text: 'What does the nipple discharge look like?',
    type: 'single_choice',
    options: [
      { value: 'clear', label: 'Clear' },
      { value: 'bloody', label: 'Bloody', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'milky', label: 'Milky' },
      { value: 'yellow_green', label: 'Yellow/green' },
    ],
  },

  skin_changes: {
    key: 'skin_changes',
    text: 'Have you noticed any skin changes over the breast — such as dimpling, puckering, or redness?',
    type: 'boolean',
    isRedFlagScreen: true,
  },

  breast_pain: {
    key: 'breast_pain',
    text: 'Do you have breast pain?',
    type: 'boolean',
  },

  mammogram_history: {
    key: 'mammogram_history',
    text: 'When did you last have a mammogram?',
    type: 'single_choice',
    options: [
      { value: 'never', label: 'Never' },
      { value: 'within_1_year', label: 'Within 1 year' },
      { value: '1_2_years', label: '1–2 years ago' },
      { value: 'over_2_years', label: 'More than 2 years ago' },
    ],
  },

  family_history_breast: {
    key: 'family_history_breast',
    text: 'Is there a family history of breast or ovarian cancer?',
    type: 'boolean',
    isRedFlagScreen: true,
  },

  surgery_date: {
    key: 'surgery_date',
    text: 'What was the date of your surgery or procedure?',
    type: 'date',
  },

  surgery_type: {
    key: 'surgery_type',
    text: 'What type of surgery or procedure did you have?',
    type: 'text',
  },

  wound_concerns: {
    key: 'wound_concerns',
    text: 'Do you have any concerns about your wound? (Select all that apply)',
    type: 'multi_choice',
    options: [
      { value: 'redness', label: 'Redness' },
      { value: 'swelling', label: 'Swelling' },
      { value: 'discharge', label: 'Discharge' },
      { value: 'separation', label: 'Wound separation/opening' },
      { value: 'bleeding', label: 'Bleeding' },
      { value: 'none', label: 'None', skipsKeys: ['wound_concerns_severity'] },
    ],
  },

  wound_concerns_severity: {
    key: 'wound_concerns_severity',
    text: 'How severe are your wound concerns?',
    type: 'single_choice',
    options: [
      { value: 'mild', label: 'Mild' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'severe', label: 'Severe', isRedFlag: true, urgencyIfSelected: 'urgent' },
    ],
  },

  fever_post_op: {
    key: 'fever_post_op',
    text: 'Have you had a fever since your surgery?',
    type: 'boolean',
    isRedFlagScreen: true,
  },

  diet_tolerance: {
    key: 'diet_tolerance',
    text: 'How are you managing with eating and drinking?',
    type: 'single_choice',
    options: [
      { value: 'normal', label: 'Normal diet' },
      { value: 'soft', label: 'Soft diet only' },
      { value: 'liquids_only', label: 'Liquids only' },
      { value: 'unable_to_eat', label: 'Unable to eat', isRedFlag: true, urgencyIfSelected: 'urgent' },
    ],
  },

  screening_reason: {
    key: 'screening_reason',
    text: 'What is the reason for your check-up today?',
    type: 'single_choice',
    options: [
      { value: 'routine', label: 'Routine check' },
      { value: 'family_history', label: 'Family history' },
      { value: 'symptomatic', label: 'I have symptoms' },
      { value: 'follow_up', label: 'Follow-up from previous finding' },
    ],
  },

  last_checkup: {
    key: 'last_checkup',
    text: 'When did you last have a check-up?',
    type: 'single_choice',
    options: [
      { value: 'within_1_year', label: 'Within 1 year' },
      { value: '1_2_years', label: '1–2 years ago' },
      { value: '2_5_years', label: '2–5 years ago' },
      { value: 'over_5_years', label: 'More than 5 years ago' },
      { value: 'never', label: 'Never' },
    ],
  },
};

export const SPECIALTY_QUEUES: Record<string, string[]> = {
  general_screening: [
    'chief_complaint',
    'symptom_duration',
    'pain_severity',
    'associated_fever',
    'prior_surgery',
    'current_medications',
    'allergies',
    'family_history_cancer',
    'smoking_status',
  ],
  upper_gi: [
    'chief_complaint',
    'dysphagia_severity',
    'odynophagia',
    'hematemesis_volume',
    'gerd_frequency',
    'alarm_features',
    'symptom_duration',
    'prior_surgery',
    'current_medications',
    'allergies',
  ],
  colorectal: [
    'chief_complaint',
    'rectal_bleeding_character',
    'rectal_bleeding_volume',
    'bowel_habit_change',
    'colonoscopy_history',
    'family_history_cancer',
    'symptom_duration',
    'alarm_features',
    'current_medications',
    'allergies',
  ],
  abdominal_pain: [
    'chief_complaint',
    'pain_location',
    'pain_severity',
    'pain_character',
    'pain_radiation',
    'peritoneal_signs',
    'nausea_vomiting',
    'last_bowel_movement',
    'associated_fever',
    'prior_surgery',
    'current_medications',
    'allergies',
  ],
  breast: [
    'chief_complaint',
    'breast_lump_duration',
    'breast_lump_change',
    'nipple_discharge',
    'skin_changes',
    'breast_pain',
    'mammogram_history',
    'family_history_breast',
    'current_medications',
    'allergies',
  ],
  post_op: [
    'surgery_date',
    'surgery_type',
    'wound_concerns',
    'wound_concerns_severity',
    'fever_post_op',
    'diet_tolerance',
    'pain_severity',
    'current_medications',
    'allergies',
  ],
};

const ABDOMINAL_PAIN_KEYS = [
  'pain_location',
  'pain_severity',
  'pain_character',
  'pain_radiation',
  'peritoneal_signs',
  'nausea_vomiting',
  'last_bowel_movement',
  'associated_fever',
];

const COLORECTAL_KEYS = [
  'rectal_bleeding_character',
  'rectal_bleeding_volume',
  'bowel_habit_change',
  'colonoscopy_history',
  'family_history_cancer',
  'alarm_features',
];

const UPPER_GI_KEYS = [
  'dysphagia_severity',
  'odynophagia',
  'hematemesis_volume',
  'gerd_frequency',
  'alarm_features',
];

const BREAST_KEYS = [
  'breast_lump_duration',
  'breast_lump_change',
  'nipple_discharge',
  'skin_changes',
  'breast_pain',
  'mammogram_history',
  'family_history_breast',
];

const POST_OP_KEYS = [
  'surgery_date',
  'surgery_type',
  'wound_concerns',
  'wound_concerns_severity',
  'fever_post_op',
  'diet_tolerance',
];

function uniqKeys(keys: string[]): string[] {
  return Array.from(new Set(keys));
}

function toArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

function formatAnswerDisplay(question: Question, value: string | string[]): string {
  const values = toArray(value);
  if (!question.options) return values.join(', ');
  const labels = values.map(v => {
    const opt = question.options!.find(o => o.value === v);
    return opt ? opt.label : v;
  });
  return labels.join(', ');
}

export function checkRedFlag(question: Question, value: string | string[]): RedFlag | null {
  const values = toArray(value);

  if (question.type === 'scale') {
    const numeric = parseFloat(values[0] ?? '0');
    if (question.isRedFlagScreen && numeric >= 8) {
      return {
        questionKey: question.key,
        answerValue: values[0] ?? '',
        severity: numeric >= 9 ? 'urgent' : 'priority',
        message: `Pain score ${numeric}/10 — severe pain requiring clinical review.`,
      };
    }
    return null;
  }

  if (question.type === 'boolean') {
    const isTrue = values[0] === 'true' || values[0] === 'yes';
    if (question.isRedFlagScreen && isTrue) {
      return {
        questionKey: question.key,
        answerValue: values[0] ?? '',
        severity: 'priority',
        message: `Positive response to red flag screen: ${question.text}`,
      };
    }
    return null;
  }

  if (!question.options) return null;

  let worstFlag: RedFlag | null = null;
  const urgencyOrder: Urgency[] = ['routine', 'priority', 'urgent', 'emergency'];

  for (const v of values) {
    const opt = question.options.find(o => o.value === v);
    if (!opt?.isRedFlag) continue;
    const severity = opt.urgencyIfSelected ?? 'priority';
    if (
      worstFlag === null ||
      urgencyOrder.indexOf(severity) > urgencyOrder.indexOf(worstFlag.severity)
    ) {
      worstFlag = {
        questionKey: question.key,
        answerValue: v,
        severity,
        message: `${opt.label} — ${question.text}`,
      };
    }
  }
  return worstFlag;
}

export function detectSpecialty(chiefComplaintValues: string[]): Specialty {
  const vals = new Set(chiefComplaintValues);
  if (vals.has('post_op_concern')) return 'post_op';
  if (vals.has('breast_concern') || vals.has('lump_or_mass')) return 'breast_surgery';
  if (vals.has('rectal_bleeding') || vals.has('change_in_bowel_habit')) return 'endoscopy';
  if (vals.has('difficulty_swallowing') || vals.has('acid_reflux') || vals.has('blood_in_vomit_stool')) return 'endoscopy';
  if (vals.has('jaundice')) return 'endoscopy';
  if (vals.has('abdominal_pain')) return 'general_surgery';
  return 'general_medical';
}

function applyChiefComplaintBranching(
  values: string[],
  currentQueue: string[],
  answeredKeys: Set<string>,
): string[] {
  const additions: string[] = [];

  for (const v of values) {
    if (v === 'abdominal_pain') {
      additions.push(...ABDOMINAL_PAIN_KEYS);
    }
    if (v === 'rectal_bleeding' || v === 'change_in_bowel_habit') {
      additions.push(...COLORECTAL_KEYS);
    }
    if (v === 'difficulty_swallowing' || v === 'acid_reflux' || v === 'blood_in_vomit_stool') {
      additions.push(...UPPER_GI_KEYS);
    }
    if (v === 'breast_concern' || v === 'lump_or_mass') {
      additions.push(...BREAST_KEYS);
    }
    if (v === 'post_op_concern') {
      additions.push(...POST_OP_KEYS);
    }
    if (v === 'jaundice') {
      additions.push(...UPPER_GI_KEYS);
    }
  }

  const merged = uniqKeys([...currentQueue, ...additions]).filter(k => !answeredKeys.has(k));
  return merged;
}

function applyOptionBranching(
  question: Question,
  values: string[],
  currentQueue: string[],
  answeredKeys: Set<string>,
): string[] {
  if (!question.options) return currentQueue;

  const toAdd: string[] = [];
  const toRemove = new Set<string>();

  for (const v of values) {
    const opt = question.options.find(o => o.value === v);
    if (!opt) continue;
    if (opt.triggersKeys) toAdd.push(...opt.triggersKeys);
    if (opt.skipsKeys) opt.skipsKeys.forEach(k => toRemove.add(k));
  }

  let queue = uniqKeys([...currentQueue, ...toAdd]);
  queue = queue.filter(k => !toRemove.has(k) && !answeredKeys.has(k));
  return queue;
}

export function estimateRemaining(state: SessionState): number {
  return Math.max(0, state.queuedKeys.length);
}

export function getNextQuestion(state: SessionState): Question | null {
  if (state.isComplete) return null;
  if (state.queuedKeys.length === 0) return null;
  const nextKey = state.queuedKeys[0];
  if (!nextKey) return null;
  return QUESTION_BANK[nextKey] ?? null;
}

export function createSession(params: {
  sessionId: string;
  templateKey: string;
  mode: QuestionMode;
  specialty?: Specialty;
}): SessionState {
  const baseQueue = SPECIALTY_QUEUES[params.templateKey] ?? SPECIALTY_QUEUES['general_screening']!;
  const queuedKeys = [...baseQueue];
  const state: SessionState = {
    sessionId: params.sessionId,
    templateKey: params.templateKey,
    mode: params.mode,
    specialty: params.specialty,
    responses: [],
    redFlags: [],
    queuedKeys,
    answeredKeys: new Set<string>(),
    currentQuestion: null,
    isComplete: false,
    estimatedRemaining: queuedKeys.length,
  };
  state.currentQuestion = getNextQuestion(state);
  return state;
}

export function processAnswer(
  state: SessionState,
  answer: { questionKey: string; value: string | string[] },
): SessionState {
  const question = QUESTION_BANK[answer.questionKey];
  if (!question) return state;

  const values = toArray(answer.value);
  const redFlag = checkRedFlag(question, answer.value);

  const response: Response = {
    questionKey: answer.questionKey,
    questionText: question.text,
    answerValue: answer.value,
    answerDisplay: formatAnswerDisplay(question, answer.value),
    isRedFlag: redFlag !== null,
    sequenceNumber: state.responses.length + 1,
    answeredAt: new Date().toISOString(),
  };

  const newResponses = [...state.responses, response];
  const newRedFlags = redFlag ? [...state.redFlags, redFlag] : [...state.redFlags];
  const newAnsweredKeys = new Set(state.answeredKeys);
  newAnsweredKeys.add(answer.questionKey);

  let newQueue = state.queuedKeys.filter(k => k !== answer.questionKey);

  if (answer.questionKey === 'chief_complaint') {
    newQueue = applyChiefComplaintBranching(values, newQueue, newAnsweredKeys);
  } else {
    newQueue = applyOptionBranching(question, values, newQueue, newAnsweredKeys);
  }

  if (answer.questionKey === 'nipple_discharge' && (values[0] === 'true' || values[0] === 'yes')) {
    if (!newAnsweredKeys.has('nipple_discharge_type') && !newQueue.includes('nipple_discharge_type')) {
      newQueue = ['nipple_discharge_type', ...newQueue];
    }
  }

  const totalAnswered = newAnsweredKeys.size;
  const totalPlanned = totalAnswered + newQueue.length;
  if (totalPlanned > MAX_QUESTIONS) {
    const allowedRemaining = MAX_QUESTIONS - totalAnswered;
    newQueue = newQueue.slice(0, Math.max(0, allowedRemaining));
  }

  const isComplete =
    newQueue.length === 0 ||
    newAnsweredKeys.size >= MAX_QUESTIONS;

  const newState: SessionState = {
    ...state,
    responses: newResponses,
    redFlags: newRedFlags,
    queuedKeys: newQueue,
    answeredKeys: newAnsweredKeys,
    isComplete,
    estimatedRemaining: newQueue.length,
    currentQuestion: null,
  };

  newState.currentQuestion = isComplete ? null : getNextQuestion(newState);
  return newState;
}

export function buildResponseSummary(state: SessionState): string {
  if (state.responses.length === 0) return 'No responses recorded.';

  const lines: string[] = ['PRE-CONSULTATION QUESTIONNAIRE SUMMARY', ''];

  for (const r of state.responses) {
    lines.push(`Q: ${r.questionText}`);
    lines.push(`A: ${r.answerDisplay}${r.isRedFlag ? ' [RED FLAG]' : ''}`);
    lines.push('');
  }

  if (state.redFlags.length > 0) {
    lines.push('RED FLAGS IDENTIFIED:');
    for (const rf of state.redFlags) {
      lines.push(`  - [${rf.severity.toUpperCase()}] ${rf.message}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

export function isSessionSufficient(state: SessionState): boolean {
  if (state.responses.length < MIN_SUFFICIENT_RESPONSES) return false;
  const hasChiefComplaint = state.answeredKeys.has('chief_complaint');
  return hasChiefComplaint;
}
