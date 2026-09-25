import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0 (priors.ts tiers; unlisted features neutral). Sources: IDSA 2014 SSTI
// guideline; WSES/SIS-E 2018 necrotising soft-tissue infection (pain out of proportion,
// crepitus, bullae/necrosis, systemic toxicity); IWGDF/IDSA 2023 diabetic foot infection
// (ulcer + local signs, probe-to-bone → osteomyelitis); IWGDF 2023 Charcot foot (warm, red,
// swollen neuropathic foot, often painless, mimics cellulitis); NICE NG12 (unexplained lymph
// nodes; skin lesions, ABCDE); NICE NG14 melanoma.
registerModule({
  specialty: 'skin_soft_tissue',
  system: 'skin_subcutaneous',
  diseases: [
    {
      id: 'melanoma', label: 'Melanoma', icd10: 'C43.9', prior: T.rare, course: 'chronic',
      features: { skin_lesion_change: 0.90, skin_lesion_bleed: 0.40, ulcerated_lesion: 0.30, lymph_node_skin_area: 0.20, pigmented_lesion: 0.85, skin_lesion: 0.95 },
    },
    {
      id: 'bcc', label: 'Basal Cell Carcinoma (BCC)', icd10: 'C44.91', prior: T.uncommon, course: 'chronic',
      features: { skin_lesion: 0.95, ulcerated_lesion: 0.60, skin_lesion_bleed: 0.45, skin_lesion_change: 0.60, lymph_node_skin_area: 0.02 },
    },
    {
      id: 'scc_skin', label: 'Squamous Cell Carcinoma of Skin (SCC)', icd10: 'C44.92', prior: T.uncommon, course: 'chronic',
      features: { skin_lesion: 0.95, ulcerated_lesion: 0.65, skin_lesion_bleed: 0.50, skin_lesion_change: 0.75, lymph_node_skin_area: 0.10, rapid_growth: 0.30 },
    },
    {
      id: 'lipoma', label: 'Lipoma', icd10: 'D17.9', prior: T.common, course: 'chronic',
      features: { skin_lesion: 0.80, soft_tissue_lump: 0.90, swelling_fluctuant_soft: 0.40, skin_lesion_change: 0.05, skin_lesion_bleed: 0.01, erythema_surrounding: 0.02 },
    },
    {
      id: 'sebaceous_cyst', label: 'Epidermoid / Sebaceous Cyst', icd10: 'L72.0', prior: T.common, course: 'chronic',
      features: { skin_lesion: 0.90, soft_tissue_lump: 0.80, swelling_fluctuant_soft: 0.50, punctum: 0.50, skin_lesion_bleed: 0.05, erythema_surrounding: 0.20, skin_lesion_change: 0.15 },
    },
    {
      id: 'skin_abscess', label: 'Skin Abscess / Furuncle', icd10: 'L02.91', prior: T.frequent, course: 'acute',
      features: { swelling_fluctuant_soft: 0.90, soft_tissue_lump: 0.60, erythema_surrounding: 0.90, fever: 0.35, skin_lesion_bleed: 0.05, elevated_wbc: 0.50, skin_lesion: 0.60, localised_pain: 0.90, discharge_pus: 0.40, injecting_drug_use: 0.05 },
    },
    {
      id: 'cellulitis', label: 'Cellulitis', icd10: 'L03.90', prior: T.frequent, course: 'acute',
      features: { erythema_surrounding: 0.95, spreading_redness: 0.80, localised_pain: 0.80, fever: 0.50, elevated_wbc: 0.60, swelling_fluctuant_soft: 0.10, leg_swelling: 0.40, unilateral_leg_swelling: 0.35, limb_pain: 0.50, skin_ulceration: 0.15, skin_lesion: 0.30 },
    },
    {
      id: 'necrotising_fasciitis', label: 'Necrotising Fasciitis (NSTI)', icd10: 'M72.6', prior: T.veryRare, course: 'acute',
      features: { erythema_surrounding: 0.85, spreading_redness: 0.70, pain_out_of_proportion: 0.75, localised_pain: 0.90, limb_pain: 0.60, fever: 0.75, tachycardia: 0.75, hypotension: 0.35, elevated_wbc: 0.85, crepitus_soft_tissue: 0.35, skin_necrosis: 0.45, haemodynamic_instability: 0.35, known_diabetes: 0.50, confusion: 0.20 },
    },
    {
      id: 'diabetic_foot_infection', label: 'Diabetic Foot Infection / Osteomyelitis', icd10: 'E11.628', prior: T.uncommon, course: 'subacute',
      features: { foot_problem: 0.95, known_diabetes: 0.98, foot_ulcer: 0.85, erythema_surrounding: 0.70, discharge_pus: 0.50, fever: 0.30, elevated_wbc: 0.50, probe_to_bone: 0.40, skin_necrosis: 0.20, peripheral_neuropathy: 0.70, localised_pain: 0.40, absent_pulses: 0.40 },
    },
    {
      id: 'charcot_foot', label: 'Charcot Neuro-osteoarthropathy (Acute Charcot Foot)', icd10: 'M14.671', prior: T.veryRare, course: 'subacute',
      features: { foot_problem: 0.98, known_diabetes: 0.95, peripheral_neuropathy: 0.95, warm_swollen_foot: 0.90, erythema_surrounding: 0.60, localised_pain: 0.30, fever: 0.05, foot_ulcer: 0.15, elevated_wbc: 0.05 },
    },
    {
      id: 'inguinal_lymphadenopathy', label: 'Inguinal Lymphadenopathy (Infection / Lymphoma / Metastasis)', icd10: 'R59.0', prior: T.uncommon, course: 'any',
      features: { groin_swelling: 0.90, inguinal_nodes: 0.90, groin_pain: 0.30, cough_impulse: 0.02, groin_lump_reducible: 0.02, fever: 0.25, weight_loss: 0.20, night_sweats: 0.20, lymph_node_skin_area: 0.40, hernia_irreducible: 0.40 },
    },
    {
      id: 'sarcoma_soft_tissue', label: 'Soft Tissue Sarcoma', icd10: 'C49.9', prior: T.veryRare, course: 'chronic',
      // NICE NG12 / BSG 2016: deep, > 5 cm, enlarging lump
      features: { soft_tissue_lump: 0.90, skin_lesion: 0.40, rapid_growth: 0.60, deep_lump: 0.70, skin_lesion_change: 0.60, weight_loss: 0.20 },
    },
    {
      id: 'desmoid_tumour', label: 'Desmoid Tumour (Aggressive Fibromatosis)', icd10: 'D48.1', prior: T.veryRare, course: 'chronic',
      features: { soft_tissue_lump: 0.80, skin_lesion_change: 0.50, previous_surgery: 0.40, abdominal_mass: 0.30 },
    },
  ],
  features: [
    { id: 'skin_lesion', label: 'Skin lesion / lump present', question: 'Is there a visible or palpable skin lesion, lump, or growth?', category: 'sign', baseRate: 0.03 },
    { id: 'soft_tissue_lump', label: 'Soft-tissue lump', question: 'Is there a subcutaneous or soft-tissue lump?', category: 'sign', baseRate: 0.02 },
    { id: 'deep_lump', label: 'Deep / fixed / > 5 cm soft-tissue lump', question: 'Is the lump deep to fascia, fixed or larger than 5 cm?', category: 'sign', baseRate: 0.002 },
    { id: 'punctum', label: 'Central punctum', question: 'Is there a central punctum?', category: 'sign', baseRate: 0.005 },
    { id: 'pigmented_lesion', label: 'Pigmented skin lesion', question: 'Is the lesion pigmented (brown/black)?', category: 'sign', baseRate: 0.01 },
    { id: 'skin_lesion_change', label: 'Change in lesion (ABCDE criteria)', question: 'Has the lesion changed in size, shape, colour, border, or elevation (ABCDE)?', category: 'symptom', baseRate: 0.01 },
    { id: 'skin_lesion_bleed', label: 'Lesion bleeds spontaneously', question: 'Does the lesion bleed spontaneously or on minimal contact?', category: 'symptom', baseRate: 0.005 },
    { id: 'ulcerated_lesion', label: 'Ulcerated or crusted skin lesion', question: 'Is the lesion ulcerated, eroded, or has a persistent crust that does not heal?', category: 'sign', baseRate: 0.005 },
    { id: 'lymph_node_skin_area', label: 'Regional lymphadenopathy (draining skin area)', question: 'Are there enlarged lymph nodes draining the region of the skin lesion?', category: 'sign', baseRate: 0.01 },
    { id: 'erythema_surrounding', label: 'Surrounding erythema / warmth', question: 'Is there redness, warmth, or induration surrounding the lesion?', category: 'sign', baseRate: 0.03 },
    { id: 'spreading_redness', label: 'Spreading redness', question: 'Is the redness spreading?', category: 'sign', baseRate: 0.01 },
    { id: 'localised_pain', label: 'Localised pain / tenderness at the lesion', question: 'Is the area painful and tender?', category: 'symptom', baseRate: 0.05 },
    { id: 'discharge_pus', label: 'Pus / purulent discharge', question: 'Is there pus or purulent discharge?', category: 'sign', baseRate: 0.01 },
    { id: 'swelling_fluctuant_soft', label: 'Fluctuant or soft compressible swelling', question: 'Is there a fluctuant, compressible, or cystic soft tissue swelling?', category: 'sign', baseRate: 0.01 },
    { id: 'crepitus_soft_tissue', label: 'Soft tissue crepitus (gas in tissues)', question: 'Is there crepitus or crackling on palpation of the soft tissues, suggesting gas?', category: 'sign', baseRate: 0.001 },
    { id: 'skin_necrosis', label: 'Skin necrosis / bullae / dusky skin', question: 'Is there skin necrosis, haemorrhagic bullae or dusky/grey skin?', category: 'sign', baseRate: 0.002 },
    { id: 'foot_problem', label: 'Foot complaint (ulcer, swelling, infection)', question: 'Is the complaint in the foot?', category: 'symptom', baseRate: 0.02 },
    { id: 'foot_ulcer', label: 'Foot ulcer', question: 'Is there an ulcer on the foot?', category: 'sign', baseRate: 0.005 },
    { id: 'probe_to_bone', label: 'Probe to bone positive / bone exposed / osteomyelitis on imaging', question: 'Does the probe reach bone, or does imaging show osteomyelitis?', category: 'sign', baseRate: 0.001 },
    { id: 'peripheral_neuropathy', label: 'Peripheral neuropathy (loss of protective sensation)', question: 'Is there loss of protective sensation in the feet?', category: 'sign', baseRate: 0.03 },
    { id: 'warm_swollen_foot', label: 'Hot, swollen foot (often painless)', question: 'Is the foot hot and swollen, out of proportion to pain?', category: 'sign', baseRate: 0.003 },
    { id: 'inguinal_nodes', label: 'Palpable inguinal lymph nodes', question: 'Are there enlarged inguinal lymph nodes (firm, multiple, below the inguinal ligament, no cough impulse)?', category: 'sign', baseRate: 0.005 },
    { id: 'night_sweats', label: 'Night sweats', question: 'Are there drenching night sweats?', category: 'symptom', baseRate: 0.02 },
  ],
});
