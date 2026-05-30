import { registerModule } from '../registry.js';

registerModule({
  specialty: 'hernia',
  system: 'abdominal_wall',
  diseases: [
    // inguinal_hernia already registered by generalSurgery; dedup handles it
    {
      id: 'femoral_hernia', label: 'Femoral Hernia', icd10: 'K41.90', prior: 0.02,
      features: { groin_swelling: 0.85, hernia_irreducible: 0.55, colicky_pain: 0.50, nausea_vomiting: 0.45, groin_lump_reducible: 0.40, cough_impulse: 0.35 },
    },
    {
      id: 'umbilical_hernia', label: 'Umbilical Hernia', icd10: 'K42.9', prior: 0.03,
      features: { umbilical_swelling: 0.90, hernia_irreducible: 0.30, colicky_pain: 0.35, abdominal_distension: 0.30, hernia_compressible: 0.65, cough_impulse: 0.60 },
    },
    {
      id: 'incisional_hernia', label: 'Incisional Hernia', icd10: 'K43.2', prior: 0.03,
      features: { previous_surgery: 0.95, abdominal_distension: 0.50, colicky_pain: 0.40, hernia_irreducible: 0.35, hernia_compressible: 0.60, nausea_vomiting: 0.35 },
    },
    {
      id: 'epigastric_hernia', label: 'Epigastric Hernia', icd10: 'K43.6', prior: 0.02,
      features: { epigastric_pain: 0.60, umbilical_swelling: 0.50, hernia_compressible: 0.55, hernia_irreducible: 0.25, cough_impulse: 0.55 },
    },
    {
      id: 'spigelian_hernia', label: 'Spigelian Hernia', icd10: 'K43.7', prior: 0.01,
      features: { lif_pain: 0.55, hernia_irreducible: 0.40, previous_surgery: 0.30, abdominal_distension: 0.25, hernia_compressible: 0.45 },
    },
    {
      id: 'parastomal_hernia', label: 'Parastomal Hernia', icd10: 'K43.5', prior: 0.01,
      features: { previous_surgery: 0.90, abdominal_distension: 0.60, colicky_pain: 0.45, hernia_irreducible: 0.35, nausea_vomiting: 0.40 },
    },
    {
      id: 'internal_hernia', label: 'Internal Hernia', icd10: 'K56.2', prior: 0.01,
      features: { colicky_pain: 0.75, nausea_vomiting: 0.80, abdominal_distension: 0.65, previous_surgery: 0.60, absolute_constipation: 0.55 },
    },
    {
      id: 'sportsmans_hernia', label: "Sportsman's Hernia (Athletic Pubalgia)", icd10: 'M79.3', prior: 0.01,
      features: { groin_swelling: 0.30, lif_pain: 0.50, colicky_pain: 0.30, cough_impulse: 0.35, previous_repair: 0.20 },
    },
    {
      id: 'obturator_hernia', label: 'Obturator Hernia', icd10: 'K45.8', prior: 0.005,
      features: { colicky_pain: 0.70, nausea_vomiting: 0.75, absolute_constipation: 0.70, hernia_irreducible: 0.35, abdominal_distension: 0.60 },
    },
  ],
  features: [
    { id: 'umbilical_swelling', label: 'Umbilical / midline swelling', question: 'Is there a swelling at or near the umbilicus or midline?', category: 'sign' },
    { id: 'hernia_compressible', label: 'Hernia compressible / reducible manually', question: 'Can the hernia be manually reduced / compressed?', category: 'sign' },
    { id: 'previous_repair', label: 'Previous hernia repair', question: 'Has the patient had a previous hernia repair at this site?', category: 'history' },
  ],
});
