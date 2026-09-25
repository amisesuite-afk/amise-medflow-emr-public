import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0 — obstetric emergencies. Every node is pregnancy-only (`applicability`):
// excluded for male patients and outside ages 10–55, boosted when "pregnancy possible" is ticked
// (engine/modifiers.ts). Priors are for pregnant / possibly pregnant women. Approximate
// sensitivities, to be signed off:
//  - Pre-eclampsia / HELLP / eclampsia: NICE NG133 (2019, 2023 update); ISSHP 2021 — new
//    hypertension ≥ 140/90 after 20 weeks (or up to 6 weeks postpartum) with proteinuria or organ
//    dysfunction; severe ≥ 160/110; headache, visual disturbance, epigastric / RUQ pain, vomiting,
//    low platelets, raised transaminases (HELLP); eclampsia = seizures.
//  - Placental abruption: RCOG Green-top Guideline 63 (2011) antepartum haemorrhage — abdominal
//    pain, uterine tenderness / tense uterus, vaginal bleeding (absent when concealed), shock out
//    of proportion to visible loss; trauma, hypertension, cocaine.
//  - Hyperemesis gravidarum: RCOG Green-top Guideline 69 (2016, 2024 update) — severe vomiting in
//    early pregnancy with dehydration, ketonuria, > 5 % weight loss.
const PREG = { sex: 'female' as const, pregnancy: 'required' as const };
registerModule({
  specialty: 'obstetrics',
  system: 'pregnancy',
  diseases: [
    {
      id: 'pre_eclampsia', label: 'Pre-eclampsia / HELLP Syndrome / Eclampsia', icd10: 'O14.90', prior: T.uncommon, course: 'acute', applicability: PREG,
      features: { pregnant: 0.90, postpartum: 0.10, raised_bp: 0.95, severe_hypertension: 0.45, proteinuria: 0.85, headache: 0.50, visual_disturbance: 0.30, epigastric_pain: 0.30, ruq_pain: 0.30, nausea_vomiting: 0.30, bilateral_leg_oedema: 0.50, seizure: 0.08, thrombocytopenia: 0.25, raised_liver_enzymes: 0.25, confusion: 0.05 },
    },
    {
      id: 'placental_abruption', label: 'Placental Abruption', icd10: 'O45.90', prior: T.rare, course: 'acute', applicability: PREG,
      features: { pregnant: 0.99, abdominal_pain: 0.80, abnormal_uterine_bleeding: 0.70, uterine_tenderness: 0.70, reduced_fetal_movements: 0.40, trauma_mechanism: 0.20, raised_bp: 0.25, hypotension: 0.25, tachycardia: 0.50, back_pain: 0.20, sudden_onset: 0.60 },
    },
    {
      id: 'hyperemesis_gravidarum', label: 'Hyperemesis Gravidarum', icd10: 'O21.1', prior: T.uncommon, course: 'subacute', applicability: PREG,
      features: { pregnant: 0.99, nausea_vomiting: 0.99, dehydration: 0.70, weight_loss: 0.50, ketonaemia: 0.40, tachycardia: 0.30, abdominal_pain: 0.10, fever: 0.02 },
    },
  ],
  features: [
    { id: 'pregnant', label: 'Currently pregnant', question: 'Is the patient pregnant?', category: 'history', baseRate: 0.03 },
    { id: 'postpartum', label: 'Within 6 weeks after delivery', question: 'Has the patient delivered within the last 6 weeks?', category: 'history', baseRate: 0.01 },
    { id: 'proteinuria', label: 'Proteinuria', question: 'Is there proteinuria on dipstick or PCR?', category: 'investigation', baseRate: 0.02 },
    { id: 'raised_liver_enzymes', label: 'Raised transaminases (ALT / AST)', question: 'Are ALT or AST raised?', category: 'investigation', baseRate: 0.05 },
    { id: 'uterine_tenderness', label: 'Uterine tenderness / tense "woody" uterus', question: 'Is the uterus tender or tense?', category: 'sign', baseRate: 0.002 },
    { id: 'reduced_fetal_movements', label: 'Reduced fetal movements', question: 'Are fetal movements reduced?', category: 'symptom', baseRate: 0.002 },
  ],
});
