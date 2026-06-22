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

export interface ApcqRedFlag {
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
  patientAge?: number;
  patientSex?: 'male' | 'female' | 'other';
  responses: Response[];
  redFlags: ApcqRedFlag[];
  queuedKeys: string[];
  answeredKeys: Set<string>;
  currentQuestion: Question | null;
  isComplete: boolean;
  estimatedRemaining: number;
}

const MAX_QUESTIONS = 18;
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
      { value: 'blood_in_vomit_stool', label: 'Blood in vomit or stool (haematemesis/melaena)', triggersKeys: ['hematemesis_volume', 'rectal_bleeding_character', 'alarm_features'], isRedFlag: true, urgencyIfSelected: 'urgent' },
      { value: 'difficulty_swallowing', label: 'Difficulty swallowing (dysphagia)', triggersKeys: ['dysphagia_severity', 'odynophagia', 'alarm_features'], isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'acid_reflux', label: 'Acid reflux/heartburn (GERD)', triggersKeys: ['gerd_frequency', 'alarm_features', 'odynophagia'] },
      { value: 'lump_or_mass', label: 'Lump or mass', triggersKeys: ['breast_lump_duration', 'breast_lump_change', 'skin_changes'] },
      { value: 'breast_concern', label: 'Breast concern', triggersKeys: ['breast_lump_duration', 'breast_lump_change', 'nipple_discharge', 'skin_changes', 'breast_pain', 'mammogram_history', 'family_history_breast'] },
      { value: 'change_in_bowel_habit', label: 'Change in bowel habit', triggersKeys: ['bowel_habit_change', 'rectal_bleeding_character', 'colonoscopy_history', 'family_history_cancer', 'alarm_features'] },
      { value: 'nausea_vomiting', label: 'Nausea/vomiting', triggersKeys: ['nausea_vomiting', 'associated_fever', 'last_bowel_movement'] },
      { value: 'weight_loss', label: 'Weight loss (unintentional)', triggersKeys: ['alarm_features'], isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'post_op_concern', label: 'Post-operative concern', triggersKeys: ['surgery_date', 'surgery_type', 'wound_concerns', 'wound_concerns_severity', 'fever_post_op', 'diet_tolerance'] },
      { value: 'jaundice', label: 'Yellowing of skin or eyes (jaundice)', triggersKeys: ['associated_fever', 'alarm_features', 'dysphagia_severity'], isRedFlag: true, urgencyIfSelected: 'urgent' },
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
    text: 'Which best describes your difficulty or inability to swallow (dysphagia)?',
    type: 'single_choice',
    isRedFlagScreen: true,
    options: [
      { value: 'solids_only', label: 'Solids only' },
      { value: 'solids_and_liquids', label: 'Solids and liquids' },
      { value: 'liquids_only', label: 'Liquids only now', isRedFlag: true, urgencyIfSelected: 'urgent' },
      { value: 'saliva_only', label: 'Cannot swallow anything (saliva only)', isRedFlag: true, urgencyIfSelected: 'emergency' },
    ],
  },

  odynophagia: {
    key: 'odynophagia',
    text: 'Do you experience pain when swallowing (odynophagia)?',
    type: 'boolean',
  },

  hematemesis_volume: {
    key: 'hematemesis_volume',
    text: 'How much blood have you vomited (haematemesis)?',
    type: 'single_choice',
    options: [
      { value: 'streaks', label: 'Streaks in spit' },
      { value: 'tablespoon', label: 'About a tablespoon' },
      { value: 'cup_or_more', label: 'A cup or more', isRedFlag: true, urgencyIfSelected: 'urgent' },
      { value: 'coffee_ground', label: 'Dark coffee-ground vomit' },
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
    text: 'Do you have any of the following warning signs? (Select all that apply)',
    type: 'multi_choice',
    isRedFlagScreen: true,
    options: [
      { value: 'weight_loss', label: 'Unexplained weight loss', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'anaemia', label: 'Feeling unusually pale or tired (anaemia)', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'dysphagia', label: 'Difficulty swallowing (dysphagia)', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'night_sweats', label: 'Night sweats', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'loss_of_appetite', label: 'Loss of appetite', isRedFlag: true, urgencyIfSelected: 'priority' },
    ],
  },

  rectal_bleeding_character: {
    key: 'rectal_bleeding_character',
    text: 'How would you describe the bleeding from your back passage (rectal bleeding)?',
    type: 'single_choice',
    options: [
      { value: 'fresh_on_paper', label: 'Fresh red blood on toilet paper' },
      { value: 'fresh_mixed', label: 'Fresh blood mixed with stool' },
      { value: 'dark_tarry', label: 'Dark tarry stool (melaena)', isRedFlag: true, urgencyIfSelected: 'urgent' },
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
    text: 'Does your pain get significantly worse with coughing, movement, or walking?',
    type: 'boolean',
    isRedFlagScreen: true,
    helpText: 'Pain that worsens with coughing or movement may need urgent assessment.',
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
  // --- Diagnostic pathway questions (guideline-based) ---

  // Biliary colic / cholecystitis pattern (Murphy's equivalent for patients)
  biliary_pattern: {
    key: 'biliary_pattern',
    text: 'Does the pain come in waves after eating fatty or heavy meals, mainly under the right ribs?',
    type: 'boolean',
    isRedFlagScreen: true,
    helpText: 'A pattern of pain after fatty food under the right ribs may suggest gallbladder problems (biliary colic).',
  },

  // Appendicitis pattern (adapted Alvarado score components)
  pain_migration: {
    key: 'pain_migration',
    text: 'Did the pain start around your navel and then move to the lower right side of your belly?',
    type: 'boolean',
    isRedFlagScreen: true,
    helpText: 'Pain that migrates from the centre to the lower right may suggest appendicitis.',
  },

  appetite_lost_before_pain: {
    key: 'appetite_lost_before_pain',
    text: 'Did you lose your appetite before the pain started?',
    type: 'boolean',
  },

  // Bowel obstruction pattern
  obstruction_symptoms: {
    key: 'obstruction_symptoms',
    text: 'Do you have any of these symptoms? (Select all that apply)',
    type: 'multi_choice',
    options: [
      { value: 'bloating', label: 'Belly bloating or distension (swelling)' },
      { value: 'no_gas', label: 'Unable to pass wind (flatus)', isRedFlag: true, urgencyIfSelected: 'urgent' },
      { value: 'no_stool', label: 'Unable to pass stool for more than 24 hours' },
      { value: 'projectile_vomiting', label: 'Vomiting large amounts or repeatedly', isRedFlag: true, urgencyIfSelected: 'urgent' },
      { value: 'crampy_waves', label: 'Pain coming in waves/cramping' },
      { value: 'none', label: 'None of the above' },
    ],
  },

  // Hernia-specific
  hernia_symptoms: {
    key: 'hernia_symptoms',
    text: 'If you have a lump or bulge, which best describes it?',
    type: 'single_choice',
    options: [
      { value: 'reducible', label: 'I can push it back in or it goes away when I lie down' },
      { value: 'intermittent', label: 'It comes and goes, especially when I cough or strain' },
      { value: 'irreducible', label: 'It will not go back in', isRedFlag: true, urgencyIfSelected: 'urgent' },
      { value: 'painful_irreducible', label: 'It will not go back in and it is painful', isRedFlag: true, urgencyIfSelected: 'urgent' },
      { value: 'no_lump', label: 'I do not have a lump' },
    ],
  },

  // Pancreatitis pattern
  pancreatitis_pattern: {
    key: 'pancreatitis_pattern',
    text: 'Is the pain in the upper middle of your belly going straight through to your back, and does sitting forward ease it?',
    type: 'boolean',
    isRedFlagScreen: true,
    helpText: 'Epigastric pain radiating to the back, eased by leaning forward, is a pattern seen in pancreatitis.',
  },

  alcohol_binge: {
    key: 'alcohol_binge',
    text: 'Have you consumed a large amount of alcohol in the past few days?',
    type: 'boolean',
  },

  // Diabetic foot specific
  foot_wound_duration: {
    key: 'foot_wound_duration',
    text: 'How long has the foot wound or ulcer been present?',
    type: 'single_choice',
    options: [
      { value: 'under_1_week', label: 'Less than 1 week' },
      { value: '1_4_weeks', label: '1–4 weeks' },
      { value: '1_3_months', label: '1–3 months' },
      { value: 'over_3_months', label: 'More than 3 months' },
    ],
  },

  foot_sensation: {
    key: 'foot_sensation',
    text: 'Can you feel normally in your feet?',
    type: 'single_choice',
    options: [
      { value: 'normal', label: 'Yes, normal feeling' },
      { value: 'reduced', label: 'Reduced feeling or numbness (neuropathy)' },
      { value: 'none', label: 'No feeling at all', isRedFlag: true, urgencyIfSelected: 'priority' },
    ],
  },

  spreading_redness: {
    key: 'spreading_redness',
    text: 'Is there redness around the wound that is spreading or getting worse?',
    type: 'boolean',
    isRedFlagScreen: true,
    helpText: 'Spreading redness (cellulitis) with a diabetic foot wound needs urgent assessment.',
  },

  // Cancer screening specific
  screening_age_appropriate: {
    key: 'screening_age_appropriate',
    text: 'Are you interested in any of the following screening tests? (Select all that apply)',
    type: 'multi_choice',
    options: [
      { value: 'colonoscopy', label: 'Bowel cancer screening (colonoscopy)' },
      { value: 'gastroscopy', label: 'Stomach check (gastroscopy/OGD)' },
      { value: 'breast', label: 'Breast screening (mammogram/ultrasound)' },
      { value: 'general', label: 'General surgical check-up' },
      { value: 'none', label: 'Not at this time' },
    ],
  },

  fobt_result: {
    key: 'fobt_result',
    text: 'Have you had a stool test for hidden blood (FOBT/FIT test)? If so, what was the result?',
    type: 'single_choice',
    options: [
      { value: 'positive', label: 'Positive (blood detected)', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'negative', label: 'Negative (normal)' },
      { value: 'not_done', label: 'Not done / not sure' },
    ],
  },

  iron_deficiency: {
    key: 'iron_deficiency',
    text: 'Have you been told you have low iron or anaemia?',
    type: 'boolean',
    isRedFlagScreen: true,
    helpText: 'Iron deficiency anaemia in adults can be a sign of hidden bleeding and may need endoscopy.',
  },

  // --- Age/sex-relevant and CC-specific questions ---
  aggravating_factors: {
    key: 'aggravating_factors',
    text: 'What makes the pain worse? (Select all that apply)',
    type: 'multi_choice',
    options: [
      { value: 'eating', label: 'Eating or drinking' },
      { value: 'movement', label: 'Movement or walking' },
      { value: 'coughing', label: 'Coughing or straining', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'lying_flat', label: 'Lying flat' },
      { value: 'deep_breath', label: 'Taking a deep breath' },
      { value: 'nothing_specific', label: 'Nothing specific' },
    ],
  },

  relieving_factors: {
    key: 'relieving_factors',
    text: 'What eases the pain? (Select all that apply)',
    type: 'multi_choice',
    options: [
      { value: 'rest', label: 'Rest or lying still' },
      { value: 'antacids', label: 'Antacids or acid tablets' },
      { value: 'painkillers', label: 'Painkillers' },
      { value: 'heat', label: 'Heat or warm compress' },
      { value: 'vomiting', label: 'After vomiting' },
      { value: 'nothing', label: 'Nothing helps', isRedFlag: true, urgencyIfSelected: 'priority' },
    ],
  },

  relation_to_meals: {
    key: 'relation_to_meals',
    text: 'Is the pain related to eating?',
    type: 'single_choice',
    options: [
      { value: 'worse_after', label: 'Worse after eating' },
      { value: 'better_after', label: 'Better after eating' },
      { value: 'no_relation', label: 'No relation to meals' },
      { value: 'cannot_eat', label: 'Unable to eat at all', isRedFlag: true, urgencyIfSelected: 'urgent' },
    ],
  },

  menstrual_history: {
    key: 'menstrual_history',
    text: 'When was your last menstrual period?',
    type: 'single_choice',
    options: [
      { value: 'current', label: 'Currently on period' },
      { value: 'within_4_weeks', label: 'Within the last 4 weeks' },
      { value: 'over_4_weeks', label: 'More than 4 weeks ago' },
      { value: 'missed', label: 'Missed or late period', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'postmenopausal', label: 'Post-menopausal' },
      { value: 'not_applicable', label: 'Not applicable' },
    ],
  },

  pregnancy_possible: {
    key: 'pregnancy_possible',
    text: 'Is there any chance you could be pregnant?',
    type: 'boolean',
    isRedFlagScreen: true,
  },

  appetite_change: {
    key: 'appetite_change',
    text: 'Has your appetite changed recently?',
    type: 'single_choice',
    options: [
      { value: 'normal', label: 'Normal appetite' },
      { value: 'decreased', label: 'Reduced appetite' },
      { value: 'no_appetite', label: 'No appetite at all', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'early_satiety', label: 'Feeling full quickly after small amounts (early satiety)' },
    ],
  },

  haemorrhoid_history: {
    key: 'haemorrhoid_history',
    text: 'Have you been told you have piles (haemorrhoids) before?',
    type: 'boolean',
  },

  anal_symptoms: {
    key: 'anal_symptoms',
    text: 'Do you have any of the following? (Select all that apply)',
    type: 'multi_choice',
    options: [
      { value: 'pain', label: 'Pain around the back passage' },
      { value: 'itch', label: 'Itching' },
      { value: 'lump', label: 'Lump or swelling near the back passage' },
      { value: 'straining', label: 'Straining to pass stool' },
      { value: 'tenesmus', label: 'Feeling of needing to go but unable to (tenesmus)' },
      { value: 'none', label: 'None of the above' },
    ],
  },

  dvt_symptoms: {
    key: 'dvt_symptoms',
    text: 'Since your surgery, have you noticed any of the following in your legs? (Select all that apply)',
    type: 'multi_choice',
    options: [
      { value: 'calf_pain', label: 'Pain or tenderness in one calf', isRedFlag: true, urgencyIfSelected: 'urgent' },
      { value: 'swelling', label: 'Swelling in one leg more than the other', isRedFlag: true, urgencyIfSelected: 'urgent' },
      { value: 'redness', label: 'Redness or warmth in one leg', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'none', label: 'None of the above' },
    ],
  },

  post_op_mobility: {
    key: 'post_op_mobility',
    text: 'How is your mobility since the surgery?',
    type: 'single_choice',
    options: [
      { value: 'normal', label: 'Walking normally' },
      { value: 'limited', label: 'Walking with difficulty' },
      { value: 'bed_bound', label: 'Mostly in bed', isRedFlag: true, urgencyIfSelected: 'priority' },
    ],
  },

  urinary_retention: {
    key: 'urinary_retention',
    text: 'Are you able to pass urine normally since your surgery?',
    type: 'single_choice',
    options: [
      { value: 'normal', label: 'Yes, normal' },
      { value: 'difficulty', label: 'Some difficulty starting' },
      { value: 'unable', label: 'Unable to pass urine', isRedFlag: true, urgencyIfSelected: 'urgent' },
    ],
  },

  hormone_use: {
    key: 'hormone_use',
    text: 'Are you taking any hormones — such as the contraceptive pill, HRT, or hormone therapy?',
    type: 'boolean',
  },

  comorbidities: {
    key: 'comorbidities',
    text: 'Do you have any of the following conditions? (Select all that apply)',
    type: 'multi_choice',
    options: [
      { value: 'diabetes', label: 'Diabetes', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'heart_disease', label: 'Heart disease', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'blood_thinners', label: 'On blood thinners (anticoagulants)', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'kidney_disease', label: 'Kidney disease' },
      { value: 'liver_disease', label: 'Liver disease' },
      { value: 'cancer_history', label: 'Previous cancer', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'immunosuppressed', label: 'Weakened immune system (immunosuppressed)' },
      { value: 'none', label: 'None of the above' },
    ],
  },

  // --- Review of Systems (ROS) ---
  ros_constitutional: {
    key: 'ros_constitutional',
    text: 'In the past 2 weeks, have you experienced any of the following general symptoms? (Select all that apply)',
    type: 'multi_choice',
    options: [
      { value: 'fatigue', label: 'Unusual tiredness or fatigue' },
      { value: 'fever', label: 'Fever or chills', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'weight_change', label: 'Unexplained weight loss or gain', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'night_sweats', label: 'Night sweats', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'none', label: 'None of the above' },
    ],
  },

  ros_gastrointestinal: {
    key: 'ros_gastrointestinal',
    text: 'Have you had any of these stomach or bowel symptoms recently? (Select all that apply)',
    type: 'multi_choice',
    options: [
      { value: 'nausea', label: 'Nausea or vomiting' },
      { value: 'heartburn', label: 'Heartburn or acid reflux (GERD)' },
      { value: 'bloating', label: 'Bloating or feeling full quickly' },
      { value: 'constipation', label: 'Constipation' },
      { value: 'diarrhoea', label: 'Diarrhoea' },
      { value: 'blood_in_stool', label: 'Blood in stool', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'none', label: 'None of the above' },
    ],
  },

  ros_cardiovascular: {
    key: 'ros_cardiovascular',
    text: 'Have you had any of these heart or circulation symptoms? (Select all that apply)',
    type: 'multi_choice',
    options: [
      { value: 'chest_pain', label: 'Chest pain or tightness', isRedFlag: true, urgencyIfSelected: 'urgent' },
      { value: 'palpitations', label: 'Palpitations (heart racing or skipping)' },
      { value: 'shortness_of_breath', label: 'Shortness of breath (dyspnoea)', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'leg_swelling', label: 'Swelling in legs or ankles (oedema)' },
      { value: 'none', label: 'None of the above' },
    ],
  },

  ros_respiratory: {
    key: 'ros_respiratory',
    text: 'Have you had any breathing or lung symptoms? (Select all that apply)',
    type: 'multi_choice',
    options: [
      { value: 'cough', label: 'Persistent cough' },
      { value: 'wheezing', label: 'Wheezing' },
      { value: 'coughing_blood', label: 'Coughing up blood (haemoptysis)', isRedFlag: true, urgencyIfSelected: 'urgent' },
      { value: 'none', label: 'None of the above' },
    ],
  },

  ros_urinary: {
    key: 'ros_urinary',
    text: 'Have you had any urinary symptoms? (Select all that apply)',
    type: 'multi_choice',
    options: [
      { value: 'burning', label: 'Burning or pain when passing urine (dysuria)' },
      { value: 'frequency', label: 'Going more often than usual' },
      { value: 'blood_in_urine', label: 'Blood in urine (haematuria)', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'difficulty', label: 'Difficulty starting or weak stream' },
      { value: 'none', label: 'None of the above' },
    ],
  },

  // --- Pre-operative assessment (ASA / fitness for surgery) ---
  asa_exercise_tolerance: {
    key: 'asa_exercise_tolerance',
    text: 'How far can you walk on flat ground without stopping due to breathlessness or chest pain?',
    type: 'single_choice',
    options: [
      { value: 'unlimited', label: 'No limit -- I can walk as far as I like' },
      { value: 'over_200m', label: 'More than 200 metres (2 blocks)' },
      { value: 'under_200m', label: 'Less than 200 metres', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'housebound', label: 'I can barely walk around the house', isRedFlag: true, urgencyIfSelected: 'urgent' },
    ],
    helpText: 'Exercise tolerance helps us assess your fitness for surgery and anaesthesia.',
  },

  asa_cardiac_history: {
    key: 'asa_cardiac_history',
    text: 'Do you have any of these heart conditions? (Select all that apply)',
    type: 'multi_choice',
    options: [
      { value: 'hypertension', label: 'High blood pressure (hypertension)' },
      { value: 'angina', label: 'Chest pain on exertion (angina)', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'heart_attack', label: 'Previous heart attack', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'heart_failure', label: 'Heart failure', isRedFlag: true, urgencyIfSelected: 'urgent' },
      { value: 'valve_disease', label: 'Heart valve disease' },
      { value: 'pacemaker', label: 'Pacemaker or defibrillator' },
      { value: 'none', label: 'None of the above' },
    ],
  },

  asa_respiratory_history: {
    key: 'asa_respiratory_history',
    text: 'Do you have any of these breathing conditions? (Select all that apply)',
    type: 'multi_choice',
    options: [
      { value: 'asthma', label: 'Asthma' },
      { value: 'copd', label: 'COPD or emphysema', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'sleep_apnoea', label: 'Sleep apnoea (use a CPAP machine)' },
      { value: 'home_oxygen', label: 'I use oxygen at home', isRedFlag: true, urgencyIfSelected: 'urgent' },
      { value: 'none', label: 'None of the above' },
    ],
  },

  anaesthesia_history: {
    key: 'anaesthesia_history',
    text: 'Have you had any problems with anaesthesia (being put to sleep for surgery) in the past?',
    type: 'single_choice',
    options: [
      { value: 'none', label: 'No problems' },
      { value: 'nausea', label: 'Severe nausea or vomiting after' },
      { value: 'difficult_airway', label: 'I was told my airway was difficult', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'family_reaction', label: 'A family member had a bad reaction to anaesthesia', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'not_sure', label: 'Not sure' },
    ],
  },

  blood_thinners_detail: {
    key: 'blood_thinners_detail',
    text: 'Are you taking any blood-thinning medicines? If so, which one?',
    type: 'single_choice',
    options: [
      { value: 'none', label: 'None' },
      { value: 'aspirin', label: 'Aspirin' },
      { value: 'warfarin', label: 'Warfarin (Coumadin)' },
      { value: 'rivaroxaban', label: 'Rivaroxaban (Xarelto)' },
      { value: 'apixaban', label: 'Apixaban (Eliquis)' },
      { value: 'clopidogrel', label: 'Clopidogrel (Plavix)' },
      { value: 'other', label: 'Other blood thinner' },
    ],
    helpText: 'Blood thinners may need to be stopped before surgery -- this is important for planning.',
  },

  fasting_status: {
    key: 'fasting_status',
    text: 'When did you last eat or drink anything?',
    type: 'single_choice',
    options: [
      { value: 'over_8h', label: 'More than 8 hours ago' },
      { value: '6_8h', label: '6-8 hours ago' },
      { value: '2_6h', label: '2-6 hours ago' },
      { value: 'under_2h', label: 'Less than 2 hours ago', isRedFlag: true, urgencyIfSelected: 'priority' },
    ],
    helpText: 'Fasting before procedures reduces the risk of aspiration.',
  },

  // --- Second opinion pathway ---
  external_diagnosis: {
    key: 'external_diagnosis',
    text: 'What diagnosis or condition were you given by your previous doctor?',
    type: 'text',
    helpText: 'If you have a letter or report, please bring it or upload it.',
  },

  previous_treatment: {
    key: 'previous_treatment',
    text: 'What treatment have you had so far for this condition?',
    type: 'text',
  },

  second_opinion_reason: {
    key: 'second_opinion_reason',
    text: 'What is the main reason you are seeking a second opinion?',
    type: 'single_choice',
    options: [
      { value: 'confirm_diagnosis', label: 'I want to confirm the diagnosis' },
      { value: 'explore_options', label: 'I want to explore other treatment options' },
      { value: 'surgery_recommended', label: 'Surgery was recommended and I want another view' },
      { value: 'not_improving', label: 'Treatment is not working' },
      { value: 'other', label: 'Other reason' },
    ],
  },

  external_investigations: {
    key: 'external_investigations',
    text: 'Do you have any test results, scans, or reports to share?',
    type: 'single_choice',
    options: [
      { value: 'have_physical', label: 'Yes -- I will bring paper copies' },
      { value: 'have_digital', label: 'Yes -- I can upload them' },
      { value: 'can_request', label: 'No, but I can request them from my doctor' },
      { value: 'none', label: 'No investigations done' },
    ],
  },

  // --- Follow-up specific ---
  followup_since_last: {
    key: 'followup_since_last',
    text: 'Since your last visit, how are you doing overall?',
    type: 'single_choice',
    options: [
      { value: 'much_better', label: 'Much better' },
      { value: 'somewhat_better', label: 'Somewhat better' },
      { value: 'same', label: 'About the same' },
      { value: 'worse', label: 'Getting worse', isRedFlag: true, urgencyIfSelected: 'priority' },
      { value: 'much_worse', label: 'Much worse', isRedFlag: true, urgencyIfSelected: 'urgent' },
    ],
  },

  medication_compliance: {
    key: 'medication_compliance',
    text: 'Have you been taking your prescribed medicines as directed?',
    type: 'single_choice',
    options: [
      { value: 'yes_all', label: 'Yes, all of them' },
      { value: 'most', label: 'Most of them' },
      { value: 'some', label: 'Some -- I stopped or missed doses' },
      { value: 'none', label: 'I have not been taking them' },
    ],
  },

  new_symptoms_since: {
    key: 'new_symptoms_since',
    text: 'Have you developed any new symptoms since your last visit?',
    type: 'boolean',
  },
};

export const SPECIALTY_QUEUES: Record<string, string[]> = {
  general_screening: [
    'chief_complaint',
    'symptom_duration',
    'pain_severity',
    'associated_fever',
    'ros_constitutional',
    'ros_gastrointestinal',
    'ros_cardiovascular',
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
    'relation_to_meals',
    'appetite_change',
    'alarm_features',
    'symptom_duration',
    'comorbidities',
    'ros_constitutional',
    'ros_gastrointestinal',
    'prior_surgery',
    'current_medications',
    'allergies',
  ],
  colorectal: [
    'chief_complaint',
    'rectal_bleeding_character',
    'rectal_bleeding_volume',
    'bowel_habit_change',
    'haemorrhoid_history',
    'anal_symptoms',
    'colonoscopy_history',
    'family_history_cancer',
    'symptom_duration',
    'appetite_change',
    'alarm_features',
    'comorbidities',
    'ros_constitutional',
    'ros_gastrointestinal',
    'current_medications',
    'allergies',
  ],
  abdominal_pain: [
    'chief_complaint',
    'pain_location',
    'pain_severity',
    'pain_character',
    'pain_radiation',
    'aggravating_factors',
    'relieving_factors',
    'relation_to_meals',
    'peritoneal_signs',
    'nausea_vomiting',
    'last_bowel_movement',
    'appetite_change',
    'associated_fever',
    'comorbidities',
    'ros_constitutional',
    'ros_gastrointestinal',
    'ros_urinary',
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
    'hormone_use',
    'comorbidities',
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
    'dvt_symptoms',
    'post_op_mobility',
    'urinary_retention',
    'current_medications',
    'allergies',
  ],
  pre_op: [
    'surgery_type',
    'asa_exercise_tolerance',
    'asa_cardiac_history',
    'asa_respiratory_history',
    'anaesthesia_history',
    'blood_thinners_detail',
    'comorbidities',
    'current_medications',
    'allergies',
    'smoking_status',
    'alcohol_use',
    'prior_surgery',
    'ros_constitutional',
    'ros_cardiovascular',
    'ros_respiratory',
    'fasting_status',
  ],
  second_opinion: [
    'second_opinion_reason',
    'external_diagnosis',
    'previous_treatment',
    'external_investigations',
    'chief_complaint',
    'symptom_duration',
    'prior_surgery',
    'current_medications',
    'allergies',
    'comorbidities',
    'family_history_cancer',
    'ros_constitutional',
    'ros_gastrointestinal',
  ],
  follow_up: [
    'followup_since_last',
    'new_symptoms_since',
    'medication_compliance',
    'pain_severity',
    'appetite_change',
    'current_medications',
    'allergies',
  ],
  new_consult: [
    'chief_complaint',
    'symptom_duration',
    'pain_severity',
    'associated_fever',
    'prior_surgery',
    'current_medications',
    'allergies',
    'smoking_status',
    'family_history_cancer',
    'ros_constitutional',
    'ros_gastrointestinal',
    'comorbidities',
  ],
};

const ABDOMINAL_PAIN_KEYS = [
  'pain_location',
  'pain_severity',
  'pain_character',
  'pain_radiation',
  'aggravating_factors',
  'relieving_factors',
  'relation_to_meals',
  'peritoneal_signs',
  'nausea_vomiting',
  'last_bowel_movement',
  'appetite_change',
  'associated_fever',
];

const COLORECTAL_KEYS = [
  'rectal_bleeding_character',
  'rectal_bleeding_volume',
  'bowel_habit_change',
  'haemorrhoid_history',
  'anal_symptoms',
  'colonoscopy_history',
  'family_history_cancer',
  'appetite_change',
  'alarm_features',
];

const UPPER_GI_KEYS = [
  'dysphagia_severity',
  'odynophagia',
  'hematemesis_volume',
  'gerd_frequency',
  'relation_to_meals',
  'appetite_change',
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
  'dvt_symptoms',
  'post_op_mobility',
  'urinary_retention',
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

export function checkRedFlag(question: Question, value: string | string[]): ApcqRedFlag | null {
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

  let worstFlag: ApcqRedFlag | null = null;
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
  patientAge?: number,
  patientSex?: 'male' | 'female' | 'other',
): string[] {
  const additions: string[] = [];

  for (const v of values) {
    if (v === 'abdominal_pain') {
      additions.push(...ABDOMINAL_PAIN_KEYS);
      additions.push('aggravating_factors', 'relieving_factors', 'relation_to_meals', 'appetite_change');
      additions.push('biliary_pattern', 'pain_migration', 'appetite_lost_before_pain');
      additions.push('obstruction_symptoms', 'pancreatitis_pattern');
      if (patientSex === 'female' && (patientAge === undefined || patientAge < 55)) {
        additions.push('menstrual_history', 'pregnancy_possible');
      }
    }
    if (v === 'rectal_bleeding' || v === 'change_in_bowel_habit') {
      additions.push(...COLORECTAL_KEYS);
      additions.push('haemorrhoid_history', 'anal_symptoms', 'appetite_change');
      if (patientAge !== undefined && patientAge >= 45) {
        additions.push('alarm_features', 'iron_deficiency', 'fobt_result');
      }
      if (patientAge !== undefined && patientAge >= 50) {
        additions.push('screening_age_appropriate');
      }
    }
    if (v === 'difficulty_swallowing' || v === 'acid_reflux' || v === 'blood_in_vomit_stool') {
      additions.push(...UPPER_GI_KEYS);
      additions.push('relation_to_meals', 'appetite_change');
      if (v === 'blood_in_vomit_stool') {
        additions.push('alcohol_binge');
      }
    }
    if (v === 'breast_concern' || v === 'lump_or_mass') {
      additions.push(...BREAST_KEYS);
      additions.push('hormone_use');
    }
    if (v === 'post_op_concern') {
      additions.push(...POST_OP_KEYS);
      additions.push('dvt_symptoms', 'post_op_mobility', 'urinary_retention');
    }
    if (v === 'jaundice') {
      additions.push(...UPPER_GI_KEYS);
      additions.push('appetite_change', 'pancreatitis_pattern', 'alcohol_binge');
    }
    if (v === 'nausea_vomiting') {
      additions.push('obstruction_symptoms');
      if (patientSex === 'female' && (patientAge === undefined || patientAge < 55)) {
        additions.push('pregnancy_possible');
      }
    }
    if (v === 'weight_loss') {
      additions.push('appetite_change', 'iron_deficiency');
      if (patientAge !== undefined && patientAge >= 50) {
        additions.push('screening_age_appropriate', 'fobt_result');
      }
    }
    if (v === 'general_screening') {
      if (patientAge !== undefined && patientAge >= 45) {
        additions.push('screening_age_appropriate', 'fobt_result', 'iron_deficiency');
      }
    }
  }

  if (patientAge !== undefined && patientAge >= 50) {
    additions.push('comorbidities');
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

function applyResponseBranching(
  questionKey: string,
  values: string[],
  currentQueue: string[],
  answeredKeys: Set<string>,
  state: SessionState,
): string[] {
  const toAdd: string[] = [];

  if (questionKey === 'pain_location') {
    if (values.includes('ruq')) {
      toAdd.push('biliary_pattern', 'relation_to_meals');
    }
    if (values.includes('rlq')) {
      toAdd.push('pain_migration', 'appetite_lost_before_pain');
    }
    if (values.includes('central') || values.includes('diffuse')) {
      toAdd.push('obstruction_symptoms');
    }
    if (values.includes('suprapubic')) {
      toAdd.push('ros_urinary');
      if (state.patientSex === 'female' && (state.patientAge === undefined || state.patientAge < 55)) {
        toAdd.push('menstrual_history', 'pregnancy_possible');
      }
    }
  }

  if (questionKey === 'pain_radiation') {
    if (values.includes('to_back')) {
      toAdd.push('pancreatitis_pattern', 'alcohol_binge');
    }
    if (values.includes('to_groin')) {
      toAdd.push('hernia_symptoms');
    }
  }

  if (questionKey === 'biliary_pattern' && (values[0] === 'true' || values[0] === 'yes')) {
    toAdd.push('associated_fever');
  }

  if (questionKey === 'nausea_vomiting') {
    if (values.includes('unable_to_keep_fluids') || values.includes('repeated_vomiting')) {
      toAdd.push('obstruction_symptoms');
    }
  }

  if (questionKey === 'last_bowel_movement') {
    if (values.includes('over_3_days')) {
      toAdd.push('obstruction_symptoms');
    }
  }

  if (questionKey === 'comorbidities') {
    if (values.includes('diabetes')) {
      toAdd.push('foot_wound_duration', 'foot_sensation');
    }
  }

  if (questionKey === 'foot_wound_duration') {
    toAdd.push('spreading_redness');
  }

  if (toAdd.length === 0) return currentQueue;
  return uniqKeys([...currentQueue, ...toAdd]).filter(k => !answeredKeys.has(k));
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
  patientAge?: number;
  patientSex?: 'male' | 'female' | 'other';
}): SessionState {
  const baseQueue = SPECIALTY_QUEUES[params.templateKey] ?? SPECIALTY_QUEUES['general_screening']!;
  const queuedKeys = [...baseQueue];
  const state: SessionState = {
    sessionId: params.sessionId,
    templateKey: params.templateKey,
    mode: params.mode,
    specialty: params.specialty,
    patientAge: params.patientAge,
    patientSex: params.patientSex,
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
    newQueue = applyChiefComplaintBranching(values, newQueue, newAnsweredKeys, state.patientAge, state.patientSex);
  } else {
    newQueue = applyOptionBranching(question, values, newQueue, newAnsweredKeys);
  }

  newQueue = applyResponseBranching(answer.questionKey, values, newQueue, newAnsweredKeys, state);

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
