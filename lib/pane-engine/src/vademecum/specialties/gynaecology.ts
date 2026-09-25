import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0. All diseases here apply to female patients only (`applicability`), with
// priors set for that population (priors.ts); unknown sex never excludes. Ectopic pregnancy
// applies only when pregnancy is possible (ages 10–55; boosted when "pregnancy possible" is
// ticked). Sources: NICE NG126 (2019, 2023 update) ectopic pregnancy — amenorrhoea, abdominal or
// pelvic pain, vaginal bleeding, shoulder-tip pain, collapse; RCOG GTG 21 (2016); BASHH 2019 PID;
// RCOG 2016 / ACOG 2019 adnexal torsion (sudden unilateral pain with vomiting).
const F = { sex: 'female' as const };
registerModule({
  specialty: 'gynaecology',
  system: 'female_reproductive',
  diseases: [
    {
      id: 'ectopic_pregnancy', label: 'Ectopic Pregnancy', icd10: 'O00.90', prior: T.uncommon, course: 'acute',
      applicability: { sex: 'female', pregnancy: 'required' },
      features: { pelvic_pain: 0.80, lif_pain: 0.35, rlq_pain: 0.35, abdominal_pain: 0.90, missed_period: 0.80, positive_pregnancy_test: 0.97, abnormal_uterine_bleeding: 0.60, adnexal_tenderness: 0.75, shoulder_tip_pain: 0.20, syncope: 0.15, hypotension: 0.15, tachycardia: 0.30, nausea_vomiting: 0.35, fever: 0.05, pelvic_free_fluid: 0.50 },
    },
    {
      id: 'ovarian_torsion', label: 'Ovarian Torsion', icd10: 'N83.51', prior: T.rare, course: 'acute', applicability: F,
      features: { pelvic_pain: 0.90, rlq_pain: 0.45, lif_pain: 0.40, sudden_onset: 0.70, nausea_vomiting: 0.75, adnexal_tenderness: 0.80, adnexal_mass: 0.70, fever: 0.15, missed_period: 0.05 },
    },
    {
      id: 'pelvic_inflammatory_disease', label: 'Pelvic Inflammatory Disease (PID) / Tubo-ovarian Abscess', icd10: 'N73.9', prior: T.uncommon, course: 'acute', applicability: F,
      features: { pelvic_pain: 0.90, suprapubic_pain: 0.30, vaginal_discharge: 0.60, fever: 0.50, adnexal_tenderness: 0.85, cervical_excitation: 0.75, dyspareunia: 0.50, elevated_wbc: 0.60, abnormal_uterine_bleeding: 0.30, adnexal_mass: 0.20 },
    },
    {
      id: 'ovarian_cyst', label: 'Ovarian Cyst (incl. Haemorrhagic / Ruptured Corpus Luteum)', icd10: 'N83.209', prior: T.frequent, course: 'any', applicability: F,
      features: { pelvic_pain: 0.70, rlq_pain: 0.30, lif_pain: 0.30, adnexal_tenderness: 0.60, adnexal_mass: 0.60, dyspareunia: 0.30, abnormal_uterine_bleeding: 0.20, nausea_vomiting: 0.25, pelvic_free_fluid: 0.30, sudden_onset: 0.35 },
    },
    {
      id: 'endometriosis', label: 'Endometriosis', icd10: 'N80.9', prior: T.uncommon, course: 'chronic', applicability: F,
      features: { pelvic_pain: 0.85, dysmenorrhoea: 0.80, dyspareunia: 0.70, abnormal_uterine_bleeding: 0.40, adnexal_tenderness: 0.40, episodic_pain: 0.50 },
    },
    {
      id: 'uterine_fibroids', label: 'Uterine Fibroids', icd10: 'D25.9', prior: T.frequent, course: 'chronic', applicability: F,
      features: { abnormal_uterine_bleeding: 0.80, pelvic_pain: 0.40, abdominal_distension: 0.30, abdominal_mass: 0.30, anaemia: 0.35 },
    },
    {
      id: 'cervical_carcinoma', label: 'Cervical Carcinoma', icd10: 'C53.9', prior: T.rare, course: 'chronic', applicability: F,
      features: { postcoital_bleeding: 0.70, abnormal_uterine_bleeding: 0.70, vaginal_discharge: 0.50, pelvic_pain: 0.35, weight_loss: 0.30 },
    },
    {
      id: 'ovarian_carcinoma', label: 'Ovarian Carcinoma', icd10: 'C56.9', prior: T.rare, course: 'chronic', applicability: F,
      // NICE CG122: persistent bloating, early satiety, pelvic/abdominal pain, urinary urgency
      features: { abdominal_distension: 0.70, early_satiety: 0.40, pelvic_pain: 0.50, weight_loss: 0.50, anorexia: 0.50, adnexal_mass: 0.60, frequency_urgency: 0.25, abdominal_mass: 0.40 },
    },
    {
      id: 'uterine_carcinoma', label: 'Uterine / Endometrial Carcinoma', icd10: 'C54.1', prior: T.rare, course: 'chronic', applicability: F,
      features: { abnormal_uterine_bleeding: 0.90, postmenopausal_bleeding: 0.85, pelvic_pain: 0.25, weight_loss: 0.20 },
    },
    {
      id: 'bartholin_abscess', label: "Bartholin's Abscess", icd10: 'N75.1', prior: T.uncommon, course: 'acute', applicability: F,
      features: { vulval_swelling: 0.95, perianal_swelling: 0.30, fever: 0.35, dyspareunia: 0.60, swelling_fluctuant_soft: 0.60 },
    },
  ],
  features: [
    { id: 'missed_period', label: 'Missed period / amenorrhoea', question: 'Has the patient missed a menstrual period or is she amenorrhoeic?', category: 'history', baseRate: 0.02 },
    { id: 'positive_pregnancy_test', label: 'Positive pregnancy test (urine or serum hCG)', question: 'Is the pregnancy test positive?', category: 'investigation', baseRate: 0.01 },
    { id: 'vaginal_discharge', label: 'Vaginal discharge', question: 'Is there abnormal vaginal discharge?', category: 'symptom', baseRate: 0.02 },
    { id: 'pelvic_pain', label: 'Pelvic / lower abdominal pain', question: 'Is there pelvic or lower abdominal pain?', category: 'symptom', baseRate: 0.03 },
    { id: 'dysmenorrhoea', label: 'Painful periods', question: 'Are periods painful?', category: 'symptom', baseRate: 0.03 },
    { id: 'dyspareunia', label: 'Dyspareunia', question: 'Is there pain during or after sexual intercourse (dyspareunia)?', category: 'symptom', baseRate: 0.01 },
    { id: 'postcoital_bleeding', label: 'Postcoital bleeding', question: 'Is there bleeding after sexual intercourse?', category: 'symptom', baseRate: 0.005 },
    { id: 'postmenopausal_bleeding', label: 'Postmenopausal bleeding', question: 'Is there bleeding after the menopause?', category: 'symptom', baseRate: 0.003 },
    { id: 'abnormal_uterine_bleeding', label: 'Abnormal uterine / vaginal bleeding', question: 'Is there abnormal uterine or vaginal bleeding (heavy, irregular, inter-menstrual, in pregnancy or postmenopausal)?', category: 'symptom', baseRate: 0.02 },
    { id: 'adnexal_tenderness', label: 'Adnexal tenderness', question: 'Is there adnexal or cervical excitation tenderness on examination?', category: 'sign', baseRate: 0.01 },
    { id: 'cervical_excitation', label: 'Cervical motion tenderness', question: 'Is there cervical motion (excitation) tenderness?', category: 'sign', baseRate: 0.005 },
    { id: 'adnexal_mass', label: 'Adnexal / ovarian mass on examination or imaging', question: 'Is there an adnexal or ovarian mass?', category: 'sign', baseRate: 0.005 },
    { id: 'pelvic_free_fluid', label: 'Free fluid in the pelvis / haemoperitoneum on imaging', question: 'Does imaging show pelvic free fluid or haemoperitoneum?', category: 'investigation', baseRate: 0.005 },
    { id: 'vulval_swelling', label: 'Vulval / labial swelling', question: 'Is there a vulval or labial swelling?', category: 'sign', baseRate: 0.003 },
    { id: 'early_satiety', label: 'Early satiety', question: 'Does the patient feel full after eating only a little?', category: 'symptom', baseRate: 0.02 },
  ],
});
