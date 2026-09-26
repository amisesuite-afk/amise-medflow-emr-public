import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0 — respiratory causes (clinval acutemed gap 1). Approximate sensitivities, to
// be signed off:
//  - Community-acquired pneumonia (adult and child): Metlay et al., JAMA 1997 "Does this patient
//    have community-acquired pneumonia?"; BTS CAP guideline 2009 (adults) and BTS 2011 (children);
//    NICE NG138 (2019). Lower-lobe pneumonia in children can present as abdominal pain.
//  - Post-operative pneumonia / atelectasis: NICE NG139 (2019) hospital-acquired pneumonia;
//    typically days 2–5 after surgery.
//  - Acute asthma: BTS/SIGN 158 (2019) and GINA 2024 — wheeze, breathlessness, cough, chest
//    tightness; severity by PEF, SpO₂, speech.
//  - COPD exacerbation: GOLD 2025; NICE NG115 (2018/2019) — increased dyspnoea, sputum volume and
//    purulence in a smoker with known COPD (diagnosis unlikely before 35).
registerModule({
  specialty: 'respiratory',
  system: 'respiratory',
  diseases: [
    {
      id: 'pneumonia', label: 'Community-acquired Pneumonia (Adult / Child)', icd10: 'J18.9', prior: T.frequent, course: 'acute',
      features: { cough: 0.85, productive_cough: 0.55, fever: 0.75, dyspnoea: 0.65, pleuritic_chest_pain: 0.35, chest_pain: 0.40, tachypnoea: 0.55, hypoxia: 0.45, crackles: 0.60, bronchial_breathing: 0.20, tachycardia: 0.45, confusion: 0.15, fatigue: 0.50, rigors: 0.30, myalgia: 0.20, headache: 0.20, elevated_wbc: 0.60, raised_crp: 0.75, consolidation: 0.85, abdominal_pain: 0.10, nausea_vomiting: 0.15, reduced_breath_sounds: 0.30, wheeze: 0.10 },
    },
    {
      id: 'postop_pneumonia', label: 'Post-operative Pneumonia / Atelectasis', icd10: 'J95.89', prior: T.rare, course: 'acute',
      features: { recent_surgery: 0.97, previous_surgery: 0.99, fever: 0.70, cough: 0.60, productive_cough: 0.40, dyspnoea: 0.60, hypoxia: 0.60, tachypnoea: 0.60, crackles: 0.50, reduced_breath_sounds: 0.40, tachycardia: 0.50, consolidation: 0.70, raised_crp: 0.75, elevated_wbc: 0.60, confusion: 0.15, pleuritic_chest_pain: 0.20 },
    },
    {
      id: 'asthma_exacerbation', label: 'Acute Asthma Exacerbation', icd10: 'J45.901', prior: T.frequent, course: 'acute',
      features: { wheeze: 0.85, dyspnoea: 0.95, cough: 0.60, chest_tightness: 0.60, tachypnoea: 0.60, tachycardia: 0.55, hypoxia: 0.35, known_asthma: 0.90, atopy: 0.60, reduced_peak_flow: 0.90, speech_breathless: 0.35, silent_chest: 0.05, fever: 0.10, allergen_exposure: 0.15 },
    },
    {
      id: 'copd_exacerbation', label: 'COPD Exacerbation (Chronic Obstructive Pulmonary Disease)', icd10: 'J44.1', prior: T.frequent, course: 'acute', applicability: { ageMin: 35 },
      features: { dyspnoea: 0.95, cough: 0.75, productive_cough: 0.65, purulent_sputum: 0.50, wheeze: 0.60, known_copd: 0.95, smoker: 0.90, hypoxia: 0.60, tachypnoea: 0.55, tachycardia: 0.45, fever: 0.25, confusion: 0.10, crackles: 0.30, hypercapnia: 0.35 },
    },
  ],
  features: [
    { id: 'dyspnoea', label: 'Breathlessness', question: 'Is the patient breathless?', category: 'symptom', baseRate: 0.06 },
    { id: 'orthopnoea', label: 'Orthopnoea / paroxysmal nocturnal dyspnoea', question: 'Is the breathlessness worse lying flat or waking the patient at night?', category: 'symptom', baseRate: 0.02 },
    { id: 'cough', label: 'Cough', question: 'Is there a cough?', category: 'symptom', baseRate: 0.08 },
    { id: 'productive_cough', label: 'Productive cough (sputum)', question: 'Is the cough productive of sputum?', category: 'symptom', baseRate: 0.04 },
    { id: 'purulent_sputum', label: 'Purulent (green / yellow) sputum', question: 'Is the sputum purulent?', category: 'symptom', baseRate: 0.02 },
    { id: 'haemoptysis', label: 'Haemoptysis', question: 'Is there haemoptysis?', category: 'symptom', baseRate: 0.005 },
    { id: 'wheeze', label: 'Wheeze', question: 'Is there wheeze?', category: 'sign', baseRate: 0.03 },
    { id: 'stridor', label: 'Stridor', question: 'Is there stridor?', category: 'sign', baseRate: 0.002 },
    { id: 'silent_chest', label: 'Silent chest', question: 'Is the chest silent on auscultation?', category: 'sign', baseRate: 0.001 },
    { id: 'speech_breathless', label: 'Too breathless to complete sentences', question: 'Is the patient unable to complete sentences?', category: 'sign', baseRate: 0.005 },
    { id: 'bronchial_breathing', label: 'Bronchial breathing / dullness to percussion', question: 'Is there bronchial breathing or dullness to percussion?', category: 'sign', baseRate: 0.005 },
    { id: 'consolidation', label: 'Consolidation on chest X-ray', question: 'Does the chest X-ray show consolidation?', category: 'investigation', baseRate: 0.01 },
    { id: 'reduced_peak_flow', label: 'Reduced peak flow (< 75 % best/predicted)', question: 'Is the peak flow below 75 % of best or predicted?', category: 'investigation', baseRate: 0.005 },
    { id: 'hypercapnia', label: 'Hypercapnia / respiratory acidosis on blood gas', question: 'Does the blood gas show a raised PaCO₂?', category: 'investigation', baseRate: 0.005 },
    { id: 'known_asthma', label: 'Known asthma', question: 'Does the patient have asthma?', category: 'history', baseRate: 0.08 },
    { id: 'known_copd', label: 'Known COPD', question: 'Does the patient have COPD?', category: 'history', baseRate: 0.04 },
    // ── Vital-sign features (derived by the feature mapper from recorded vitals) ──
    { id: 'tachypnoea', label: 'Tachypnoea (RR ≥ 22, age-adjusted in children)', question: 'Is the respiratory rate 22/min or more?', category: 'sign', baseRate: 0.04 },
    { id: 'hypoxia', label: 'Hypoxia (SpO₂ < 94 %)', question: 'Is the oxygen saturation below 94 %?', category: 'sign', baseRate: 0.03 },
  ],
});
