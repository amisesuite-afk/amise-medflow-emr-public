import { registerModule } from '../registry.js';

registerModule({
  specialty: 'skin_soft_tissue',
  system: 'skin_subcutaneous',
  diseases: [
    {
      id: 'melanoma', label: 'Melanoma', icd10: 'C43.9', prior: 0.01,
      features: { skin_lesion_change: 0.90, skin_lesion_bleed: 0.55, ulcerated_lesion: 0.45, lymph_node_skin_area: 0.35, weight_loss: 0.20, skin_lesion: 0.95 },
    },
    {
      id: 'bcc', label: 'Basal Cell Carcinoma (BCC)', icd10: 'C44.91', prior: 0.03,
      features: { skin_lesion: 0.95, ulcerated_lesion: 0.60, skin_lesion_bleed: 0.50, skin_lesion_change: 0.65, lymph_node_skin_area: 0.05 },
    },
    {
      id: 'scc_skin', label: 'Squamous Cell Carcinoma of Skin (SCC)', icd10: 'C44.92', prior: 0.02,
      features: { skin_lesion: 0.95, ulcerated_lesion: 0.70, skin_lesion_bleed: 0.60, skin_lesion_change: 0.75, lymph_node_skin_area: 0.20 },
    },
    {
      id: 'lipoma', label: 'Lipoma', icd10: 'D17.9', prior: 0.06,
      features: { skin_lesion: 0.80, swelling_fluctuant_soft: 0.40, skin_lesion_change: 0.05, skin_lesion_bleed: 0.01, erythema_surrounding: 0.05 },
    },
    {
      id: 'sebaceous_cyst', label: 'Epidermoid / Sebaceous Cyst', icd10: 'L72.0', prior: 0.06,
      features: { skin_lesion: 0.90, swelling_fluctuant_soft: 0.55, skin_lesion_bleed: 0.10, erythema_surrounding: 0.30, skin_lesion_change: 0.20 },
    },
    {
      id: 'skin_abscess', label: 'Skin Abscess / Furuncle', icd10: 'L02.91', prior: 0.04,
      features: { swelling_fluctuant_soft: 0.90, erythema_surrounding: 0.90, fever: 0.55, skin_lesion_bleed: 0.20, elevated_wbc: 0.65, skin_lesion: 0.75 },
    },
    {
      id: 'cellulitis', label: 'Cellulitis', icd10: 'L03.90', prior: 0.04,
      features: { erythema_surrounding: 0.95, fever: 0.60, elevated_wbc: 0.70, swelling_fluctuant_soft: 0.15, skin_ulceration: 0.25, skin_lesion: 0.60 },
    },
    {
      id: 'necrotising_fasciitis', label: 'Necrotising Fasciitis', icd10: 'M72.6', prior: 0.003,
      features: { erythema_surrounding: 0.85, fever: 0.90, elevated_wbc: 0.90, crepitus_soft_tissue: 0.70, haemodynamic_instability: 0.55, skin_ulceration: 0.60 },
    },
    {
      id: 'sarcoma_soft_tissue', label: 'Soft Tissue Sarcoma', icd10: 'C49.9', prior: 0.003,
      features: { skin_lesion: 0.70, swelling_fluctuant_soft: 0.30, skin_lesion_change: 0.80, weight_loss: 0.30, lymph_node_skin_area: 0.25 },
    },
    {
      id: 'desmoid_tumour', label: 'Desmoid Tumour (Aggressive Fibromatosis)', icd10: 'D48.1', prior: 0.001,
      features: { skin_lesion: 0.50, skin_lesion_change: 0.75, previous_surgery: 0.40, abdominal_tenderness: 0.55 },
    },
  ],
  features: [
    { id: 'skin_lesion', label: 'Skin lesion / lump present', question: 'Is there a visible or palpable skin lesion, lump, or growth?', category: 'sign' },
    { id: 'skin_lesion_change', label: 'Change in lesion (ABCDE criteria)', question: 'Has the lesion changed in size, shape, colour, border, or elevation (ABCDE)?', category: 'symptom' },
    { id: 'skin_lesion_bleed', label: 'Lesion bleeds spontaneously', question: 'Does the lesion bleed spontaneously or on minimal contact?', category: 'symptom' },
    { id: 'ulcerated_lesion', label: 'Ulcerated or crusted skin lesion', question: 'Is the lesion ulcerated, eroded, or has a persistent crust that does not heal?', category: 'sign' },
    { id: 'lymph_node_skin_area', label: 'Regional lymphadenopathy (draining skin area)', question: 'Are there enlarged lymph nodes draining the region of the skin lesion?', category: 'sign' },
    { id: 'erythema_surrounding', label: 'Surrounding erythema / warmth', question: 'Is there redness, warmth, or induration surrounding the lesion?', category: 'sign' },
    { id: 'swelling_fluctuant_soft', label: 'Fluctuant or soft compressible swelling', question: 'Is there a fluctuant, compressible, or cystic soft tissue swelling?', category: 'sign' },
    { id: 'crepitus_soft_tissue', label: 'Soft tissue crepitus (gas in tissues)', question: 'Is there crepitus or crackling on palpation of the soft tissues, suggesting gas?', category: 'sign' },
  ],
});
