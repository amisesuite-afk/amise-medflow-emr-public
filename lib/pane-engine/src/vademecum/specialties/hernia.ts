import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0 (priors.ts tiers; unlisted features neutral). HerniaSurge 2018 (groin),
// EHS 2020 (umbilical/epigastric), EHS 2014/2018 (incisional, parastomal). Femoral and obturator
// hernias present as obstruction in older women (Howship–Romberg sign in obturator hernia).
// Incarcerated / strangulated hernia (any site, any age — incl. infants): WSES 2017 guidelines on
// emergency repair of complicated abdominal wall hernias — a tense, tender, irreducible hernia with
// pain, vomiting and obstruction; skin changes, fever, leucocytosis and lactate suggest
// strangulation. The elective hernia nodes below model uncomplicated hernias.
registerModule({
  specialty: 'hernia',
  system: 'abdominal_wall',
  diseases: [
    // inguinal_hernia already registered by generalSurgery; dedup handles it
    {
      id: 'incarcerated_hernia', label: 'Incarcerated / Strangulated Hernia (Groin, Umbilical or Incisional)', icd10: 'K46.0', prior: T.uncommon, course: 'acute',
      features: { hernia_swelling: 0.95, hernia_irreducible: 0.90, groin_swelling: 0.55, umbilical_swelling: 0.30, incisional_swelling: 0.15, localised_pain: 0.85, groin_pain: 0.45, severe_pain: 0.50, sudden_onset: 0.40, nausea_vomiting: 0.70, bilious_vomiting: 0.25, colicky_pain: 0.45, abdominal_distension: 0.45, absolute_constipation: 0.40, abdominal_tenderness: 0.60, tachycardia: 0.45, erythema_surrounding: 0.30, skin_necrosis: 0.10, elevated_wbc: 0.50, raised_lactate: 0.20, fever: 0.15, inconsolable_crying: 0.15, cough_impulse: 0.10, groin_lump_reducible: 0.03, hernia_compressible: 0.05 },
    },
    {
      id: 'femoral_hernia', label: 'Femoral Hernia', icd10: 'K41.90', prior: T.uncommon, course: 'any',
      features: { groin_swelling: 0.85, groin_pain: 0.50, hernia_irreducible: 0.55, colicky_pain: 0.40, nausea_vomiting: 0.40, bilious_vomiting: 0.15, groin_lump_reducible: 0.30, cough_impulse: 0.30, abdominal_distension: 0.30, absolute_constipation: 0.25, below_inguinal_ligament: 0.80, localised_pain: 0.40 },
    },
    {
      id: 'umbilical_hernia', label: 'Umbilical / Paraumbilical Hernia', icd10: 'K42.9', prior: T.frequent, course: 'any',
      features: { umbilical_swelling: 0.90, periumbilical_pain: 0.40, hernia_irreducible: 0.25, colicky_pain: 0.20, hernia_compressible: 0.65, cough_impulse: 0.60 },
    },
    {
      id: 'incisional_hernia', label: 'Incisional Hernia', icd10: 'K43.2', prior: T.uncommon, course: 'any',
      features: { previous_surgery: 0.97, incisional_swelling: 0.85, abdominal_distension: 0.30, colicky_pain: 0.30, hernia_irreducible: 0.30, hernia_compressible: 0.60, nausea_vomiting: 0.25, cough_impulse: 0.55 },
    },
    {
      id: 'epigastric_hernia', label: 'Epigastric Hernia', icd10: 'K43.6', prior: T.rare, course: 'any',
      features: { epigastric_pain: 0.50, umbilical_swelling: 0.40, epigastric_swelling: 0.85, hernia_compressible: 0.55, hernia_irreducible: 0.25, cough_impulse: 0.55 },
    },
    {
      id: 'spigelian_hernia', label: 'Spigelian Hernia', icd10: 'K43.7', prior: T.veryRare, course: 'any',
      features: { lif_pain: 0.40, rlq_pain: 0.30, hernia_irreducible: 0.40, abdominal_distension: 0.20, hernia_compressible: 0.45 },
    },
    {
      id: 'parastomal_hernia', label: 'Parastomal Hernia', icd10: 'K43.5', prior: T.rare, course: 'any',
      features: { previous_surgery: 0.99, stoma: 0.99, parastomal_bulge: 0.90, hernia_swelling: 0.95, hernia_compressible: 0.55, cough_impulse: 0.50, localised_pain: 0.40, worse_straining: 0.30, abdominal_distension: 0.30, colicky_pain: 0.35, hernia_irreducible: 0.25, nausea_vomiting: 0.25, known_malignancy: 0.40 },
    },
    {
      id: 'internal_hernia', label: 'Internal Hernia', icd10: 'K56.2', prior: T.veryRare, course: 'acute',
      features: { colicky_pain: 0.75, nausea_vomiting: 0.80, abdominal_distension: 0.65, previous_surgery: 0.80, absolute_constipation: 0.55, bariatric_surgery: 0.60 },
    },
    {
      id: 'sportsmans_hernia', label: "Sportsman's Hernia (Athletic Pubalgia)", icd10: 'M79.3', prior: T.rare, course: 'chronic',
      features: { groin_pain: 0.90, groin_swelling: 0.10, lif_pain: 0.20, cough_impulse: 0.20, previous_repair: 0.10 },
    },
    {
      id: 'obturator_hernia', label: 'Obturator Hernia', icd10: 'K45.8', prior: T.veryRare, course: 'acute',
      // Presents as small-bowel obstruction in thin elderly women; the hernia is rarely palpable
      features: { colicky_pain: 0.70, nausea_vomiting: 0.85, bilious_vomiting: 0.40, absolute_constipation: 0.65, constipation: 0.70, hernia_irreducible: 0.20, abdominal_distension: 0.60, periumbilical_pain: 0.30, diffuse_abdominal_pain: 0.30, tinkling_bowel_sounds: 0.50, howship_romberg: 0.45, medial_thigh_pain: 0.50, previous_surgery: 0.15 },
    },
  ],
  features: [
    { id: 'hernia_swelling', label: 'Hernia / abdominal-wall bulge (any site)', question: 'Is there a hernia or bulge in the groin or abdominal wall?', category: 'sign', baseRate: 0.02 },
    { id: 'umbilical_swelling', label: 'Umbilical / midline swelling', question: 'Is there a swelling at or near the umbilicus or midline?', category: 'sign', baseRate: 0.01 },
    { id: 'epigastric_swelling', label: 'Epigastric midline swelling', question: 'Is there a small midline swelling above the umbilicus?', category: 'sign', baseRate: 0.003 },
    { id: 'incisional_swelling', label: 'Swelling at a previous incision', question: 'Is there a swelling at or beside a previous surgical scar?', category: 'sign', baseRate: 0.005 },
    { id: 'hernia_compressible', label: 'Hernia compressible / reducible manually', question: 'Can the hernia be manually reduced / compressed?', category: 'sign', baseRate: 0.01 },
    { id: 'previous_repair', label: 'Previous hernia repair', question: 'Has the patient had a previous hernia repair at this site?', category: 'history', baseRate: 0.01 },
    { id: 'stoma', label: 'Stoma present', question: 'Does the patient have a stoma?', category: 'history', baseRate: 0.01 },
    { id: 'parastomal_bulge', label: 'Bulge around the stoma', question: 'Is there a bulge around the stoma?', category: 'sign', baseRate: 0.003 },
    { id: 'bariatric_surgery', label: 'Previous bariatric / gastric bypass surgery', question: 'Has the patient had gastric bypass or other bariatric surgery?', category: 'history', baseRate: 0.01 },
    { id: 'below_inguinal_ligament', label: 'Groin lump below and lateral to the pubic tubercle', question: 'Is the groin lump below the inguinal ligament, lateral to the pubic tubercle?', category: 'sign', baseRate: 0.003 },
    { id: 'howship_romberg', label: 'Howship–Romberg sign (medial thigh pain)', question: 'Is there pain down the inner thigh to the knee (Howship–Romberg)?', category: 'sign', baseRate: 0.002 },
    { id: 'medial_thigh_pain', label: 'Medial thigh / knee pain', question: 'Is there pain along the medial thigh or knee?', category: 'symptom', baseRate: 0.01 },
  ],
});
