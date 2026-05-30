import { registerModule } from '../registry.js';

// All diseases here are female-specific. Priors assume mixed-sex population;
// modifiers.ts suppresses these to near-zero for male patients and boosts for females.
registerModule({
  specialty: 'gynaecology',
  system: 'female_reproductive',
  diseases: [
    {
      id: 'ectopic_pregnancy', label: 'Ectopic Pregnancy', icd10: 'O00.90', prior: 0.02,
      features: { lif_pain: 0.55, pelvic_pain: 0.90, missed_period: 0.80, vaginal_discharge: 0.30, adnexal_tenderness: 0.85, fever: 0.25, nausea_vomiting: 0.60 },
    },
    {
      id: 'ovarian_torsion', label: 'Ovarian Torsion', icd10: 'N83.51', prior: 0.02,
      features: { pelvic_pain: 0.95, nausea_vomiting: 0.80, adnexal_tenderness: 0.85, fever: 0.35, lif_pain: 0.55, missed_period: 0.15 },
    },
    {
      id: 'pelvic_inflammatory_disease', label: 'Pelvic Inflammatory Disease (PID)', icd10: 'N73.9', prior: 0.03,
      features: { pelvic_pain: 0.85, vaginal_discharge: 0.70, fever: 0.65, adnexal_tenderness: 0.80, dyspareunia: 0.65, elevated_wbc: 0.75 },
    },
    {
      id: 'ovarian_cyst', label: 'Ovarian Cyst', icd10: 'N83.209', prior: 0.04,
      features: { pelvic_pain: 0.70, adnexal_tenderness: 0.65, lif_pain: 0.50, dyspareunia: 0.45, abnormal_uterine_bleeding: 0.30, nausea_vomiting: 0.30 },
    },
    {
      id: 'endometriosis', label: 'Endometriosis', icd10: 'N80.9', prior: 0.02,
      features: { pelvic_pain: 0.85, dyspareunia: 0.80, abnormal_uterine_bleeding: 0.65, adnexal_tenderness: 0.60, nausea_vomiting: 0.40, lif_pain: 0.45 },
    },
    {
      id: 'uterine_fibroids', label: 'Uterine Fibroids', icd10: 'D25.9', prior: 0.03,
      features: { abnormal_uterine_bleeding: 0.80, pelvic_pain: 0.65, adnexal_tenderness: 0.40, abdominal_distension: 0.45, nausea_vomiting: 0.20 },
    },
    {
      id: 'cervical_carcinoma', label: 'Cervical Carcinoma', icd10: 'C53.9', prior: 0.01,
      features: { postcoital_bleeding: 0.80, abnormal_uterine_bleeding: 0.70, vaginal_discharge: 0.65, pelvic_pain: 0.55, weight_loss: 0.45 },
    },
    {
      id: 'ovarian_carcinoma', label: 'Ovarian Carcinoma', icd10: 'C56.9', prior: 0.01,
      features: { abdominal_distension: 0.70, pelvic_pain: 0.60, weight_loss: 0.65, anorexia: 0.60, abnormal_uterine_bleeding: 0.30, adnexal_tenderness: 0.50 },
    },
    {
      id: 'uterine_carcinoma', label: 'Uterine / Endometrial Carcinoma', icd10: 'C54.1', prior: 0.01,
      features: { abnormal_uterine_bleeding: 0.90, postcoital_bleeding: 0.55, pelvic_pain: 0.45, weight_loss: 0.50, adnexal_tenderness: 0.35 },
    },
    {
      id: 'bartholin_abscess', label: "Bartholin's Abscess", icd10: 'N75.1', prior: 0.01,
      features: { pelvic_pain: 0.80, perianal_swelling: 0.85, fever: 0.55, elevated_wbc: 0.60, vaginal_discharge: 0.50, dyspareunia: 0.75 },
    },
  ],
  features: [
    { id: 'missed_period', label: 'Missed period / amenorrhoea', question: 'Has the patient missed a menstrual period or is she amenorrhoeic?', category: 'history' },
    { id: 'vaginal_discharge', label: 'Vaginal discharge', question: 'Is there abnormal vaginal discharge?', category: 'symptom' },
    { id: 'pelvic_pain', label: 'Pelvic / lower abdominal pain', question: 'Is there pelvic or lower abdominal pain?', category: 'symptom' },
    { id: 'dyspareunia', label: 'Dyspareunia', question: 'Is there pain during or after sexual intercourse (dyspareunia)?', category: 'symptom' },
    { id: 'postcoital_bleeding', label: 'Postcoital bleeding', question: 'Is there bleeding after sexual intercourse?', category: 'symptom' },
    { id: 'abnormal_uterine_bleeding', label: 'Abnormal uterine bleeding', question: 'Is there abnormal uterine bleeding (heavy, irregular, inter-menstrual, or postmenopausal)?', category: 'symptom' },
    { id: 'adnexal_tenderness', label: 'Adnexal tenderness', question: 'Is there adnexal or cervical excitation tenderness on examination?', category: 'sign' },
  ],
});
