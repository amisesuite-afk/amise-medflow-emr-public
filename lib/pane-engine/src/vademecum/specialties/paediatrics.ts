import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0 — paediatric surgical emergencies (clinval prevobspaed gap 1). Each node
// states its age range (`applicability`); priors are for children in that range. Approximate
// sensitivities, to be signed off:
//  - Intussusception: APLS 6th ed. (2016); BSPGHAN / BAPS guidance — episodic inconsolable
//    crying with drawing up of the legs, vomiting (bilious later), lethargy / pallor between
//    episodes, sausage-shaped mass, redcurrant-jelly stool (late; the classic triad in < 25 %);
//    peak 3 months–3 years.
//  - Infantile hypertrophic pyloric stenosis: APLS 2016; BAPS — non-bilious projectile vomiting
//    at 2–8 weeks (range 1–16), hungry after vomiting, weight loss, hypochloraemic alkalosis,
//    "olive" mass; M:F ≈ 4:1.
//  - Malrotation with midgut volvulus: APLS 2016; BAPS — BILIOUS vomiting in a neonate / infant
//    is volvulus until proven otherwise; distension and blood per rectum are late.
//  - IgA vasculitis (Henoch–Schönlein purpura): EULAR/PRINTO/PRES 2010 classification; SHARE
//    2019 recommendations — palpable purpura (legs, buttocks) plus colicky abdominal pain,
//    arthralgia / arthritis, haematuria / proteinuria; often after an upper respiratory infection.
registerModule({
  specialty: 'paediatrics',
  system: 'paediatric',
  diseases: [
    {
      id: 'intussusception', label: 'Intussusception', icd10: 'K56.1', prior: T.uncommon, course: 'acute', applicability: { ageMax: 16 },
      features: { target_sign: 0.90, pallor: 0.50, inconsolable_crying: 0.75, episodic_pain: 0.75, colicky_pain: 0.60, abdominal_pain: 0.90, nausea_vomiting: 0.80, bilious_vomiting: 0.30, lethargy: 0.45, pale_clammy: 0.35, pr_bleeding: 0.35, redcurrant_stool: 0.30, abdominal_mass: 0.45, poor_feeding: 0.40, fever: 0.20,
        // Lethargic / encephalopathic presentation without screaming episodes in ≈ 10–20 % (APLS 2016)
        tachycardia: 0.50, dehydration: 0.30, mottled_skin: 0.15, gcs_drop: 0.10, confusion: 0.10, fatigue: 0.30, elevated_wbc: 0.40 },
    },
    {
      id: 'pyloric_stenosis', label: 'Infantile Hypertrophic Pyloric Stenosis', icd10: 'Q40.0', prior: T.uncommon, course: 'subacute', applicability: { ageMax: 0.5 }, // 1–16 weeks; the record holds whole years, so age 0 = any infant
      features: { pyloric_thickening: 0.95, projectile_vomiting: 0.90, vomiting_effortless: 0.60, nausea_vomiting: 0.99, hungry_after_vomiting: 0.60, failure_to_thrive: 0.50, weight_loss: 0.40, dehydration: 0.50, abdominal_mass: 0.40, visible_peristalsis: 0.30, bilious_vomiting: 0.02, fever: 0.03, metabolic_alkalosis: 0.70 },
    },
    {
      id: 'malrotation_volvulus', label: 'Malrotation with Midgut Volvulus', icd10: 'Q43.3', prior: T.rare, course: 'acute', applicability: { ageMax: 18 },
      features: { pallor: 0.30, whirlpool_sign: 0.80, bilious_vomiting: 0.95, nausea_vomiting: 0.99, poor_feeding: 0.60, abdominal_distension: 0.40, inconsolable_crying: 0.45, lethargy: 0.40, pr_bleeding: 0.20, abdominal_tenderness: 0.40, hypotension: 0.15, tachycardia: 0.50, failure_to_thrive: 0.25 },
    },
    {
      id: 'hsp_iga_vasculitis', label: 'IgA Vasculitis (Henoch–Schönlein Purpura, HSP)', icd10: 'D69.0', prior: T.rare, course: 'subacute',
      features: { non_blanching_rash: 0.95, palpable_purpura: 0.95, abdominal_pain: 0.60, colicky_pain: 0.35, joint_pain: 0.75, haematuria: 0.40, sore_throat: 0.40, nausea_vomiting: 0.30, pr_bleeding: 0.15, fever: 0.20 },
    },
  ],
  features: [
    { id: 'inconsolable_crying', label: 'Episodic inconsolable crying / drawing up the legs', question: 'Does the child have episodes of inconsolable crying, drawing up the legs?', category: 'symptom', baseRate: 0.003 },
    { id: 'redcurrant_stool', label: 'Redcurrant-jelly stool', question: 'Is there redcurrant-jelly stool?', category: 'sign', baseRate: 0.0005 },
    { id: 'projectile_vomiting', label: 'Projectile vomiting', question: 'Is the vomiting projectile?', category: 'symptom', baseRate: 0.003 },
    { id: 'hungry_after_vomiting', label: 'Hungry immediately after vomiting', question: 'Is the baby hungry straight after vomiting?', category: 'symptom', baseRate: 0.001 },
    { id: 'failure_to_thrive', label: 'Poor weight gain / failure to thrive', question: 'Is the child failing to gain weight?', category: 'sign', baseRate: 0.003 },
    { id: 'poor_feeding', label: 'Poor feeding (infant)', question: 'Is the baby feeding poorly?', category: 'symptom', baseRate: 0.003 },
    { id: 'metabolic_alkalosis', label: 'Hypochloraemic metabolic alkalosis', question: 'Does the blood gas show a hypochloraemic metabolic alkalosis?', category: 'investigation', baseRate: 0.002 },
    { id: 'palpable_purpura', label: 'Palpable purpura (legs / buttocks)', question: 'Is there palpable purpura over the legs or buttocks?', category: 'sign', baseRate: 0.001 },
    { id: 'rash', label: 'Rash', question: 'Is there a rash?', category: 'sign', baseRate: 0.03 },
    { id: 'target_sign', label: 'Target / doughnut sign on ultrasound', question: 'Does ultrasound show a target (doughnut) sign?', category: 'investigation', baseRate: 0.0005 },
    { id: 'pyloric_thickening', label: 'Thickened / elongated pylorus on ultrasound', question: 'Does ultrasound show a thickened, elongated pylorus?', category: 'investigation', baseRate: 0.0005 },
    { id: 'whirlpool_sign', label: 'Whirlpool sign / abnormal SMA–SMV relationship', question: 'Does imaging show a whirlpool sign or abnormal SMA–SMV relationship?', category: 'investigation', baseRate: 0.0005 },
    { id: 'joint_pain', label: 'Joint pain / swelling', question: 'Is there joint pain or swelling?', category: 'symptom', baseRate: 0.04 },
  ],
});
