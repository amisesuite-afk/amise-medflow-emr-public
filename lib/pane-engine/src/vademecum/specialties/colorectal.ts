import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0 (priors.ts tiers; unlisted features neutral). Added nodes:
//  - Anal squamous cell carcinoma: ASCRS Clinical Practice Guideline for anal SCC (2018);
//    NICE NG12 (anal mass or ulceration). Bleeding, pain, mass, pruritus; risk: HIV, HPV, smoking.
//  - Fournier's gangrene (perineal necrotising soft-tissue infection): WSES/SIS-E 2018 soft-tissue
//    infection guideline; UK MHRA 2019 SGLT2-inhibitor alert. Perineal/scrotal pain out of
//    proportion, swelling, crepitus, fever, diabetes.
//  - Sigmoid volvulus: ASCRS 2021 colonic volvulus guideline. Elderly, massive distension,
//    absolute constipation, colicky pain.
//  - C. difficile colitis is in acuteMedicine.ts; infective colitis in gastroenteritis.
registerModule({
  specialty: 'colorectal',
  system: 'lower_gi',
  diseases: [
    {
      id: 'haemorrhoids', label: 'Haemorrhoids', icd10: 'K64.9', prior: T.common, course: 'any',
      features: { pr_bleeding: 0.90, anal_pain: 0.35, perianal_swelling: 0.50, prolapse_pr: 0.55, pruritus_ani: 0.40, change_bowel_habit: 0.15, constipation: 0.40, worse_straining: 0.30 },
    },
    {
      id: 'anal_fissure', label: 'Anal Fissure', icd10: 'K60.2', prior: T.frequent, course: 'any',
      features: { anal_pain: 0.95, pain_on_defaecation: 0.90, pr_bleeding: 0.70, constipation: 0.45, perianal_swelling: 0.15, posterior_midline: 0.85, tenesmus: 0.15 },
    },
    {
      id: 'perianal_abscess', label: 'Perianal Abscess / Fistula', icd10: 'K61.0', prior: T.frequent, course: 'acute',
      features: { anal_pain: 0.90, perianal_swelling: 0.90, fever: 0.55, elevated_wbc: 0.65, discharge_perianal: 0.60, pr_bleeding: 0.10, erythema_surrounding: 0.55, swelling_fluctuant_soft: 0.50 },
    },
    {
      id: 'crohns_disease', label: "Crohn's Disease", icd10: 'K50.90', prior: T.uncommon, course: 'chronic',
      features: { ulcerative_colitis_history: 0.80, rlq_pain: 0.45, lif_pain: 0.15, change_bowel_habit: 0.75, diarrhoea: 0.75, weight_loss: 0.60, fever: 0.40, pr_bleeding: 0.30, anorexia: 0.50, perianal_swelling: 0.25, discharge_perianal: 0.25, anaemia: 0.40, abdominal_mass: 0.15 },
    },
    {
      id: 'ulcerative_colitis', label: 'Ulcerative Colitis', icd10: 'K51.90', prior: T.uncommon, course: 'chronic',
      // Acute severe UC (Truelove & Witts; BSG 2019 IBD): ≥ 6 bloody stools/day with tachycardia, fever, anaemia or CRP > 30
      features: { ulcerative_colitis_history: 0.85, immunosuppression: 0.25, pr_bleeding: 0.90, bloody_diarrhoea: 0.80, diarrhoea: 0.85, mucus_pr: 0.65, tenesmus: 0.55, lif_pain: 0.40, diffuse_abdominal_pain: 0.25, change_bowel_habit: 0.80, fever: 0.35, weight_loss: 0.35, tachycardia: 0.35, anaemia: 0.40, raised_crp: 0.65 },
    },
    {
      id: 'rectal_carcinoma', label: 'Rectal Carcinoma', icd10: 'C20', prior: T.rare, course: 'chronic',
      features: { pr_bleeding: 0.75, change_bowel_habit: 0.70, tenesmus: 0.50, weight_loss: 0.50, anorexia: 0.45, mucus_pr: 0.35, lif_pain: 0.15, rectal_mass: 0.70, anaemia: 0.35, positive_fit: 0.85, progressive_course: 0.50 },
    },
    {
      id: 'anal_cancer', label: 'Anal Cancer (Squamous Cell Carcinoma of the Anus)', icd10: 'C21.0', prior: T.rare, course: 'chronic',
      features: { pr_bleeding: 0.55, anal_pain: 0.60, perianal_swelling: 0.45, anal_mass_ulcer: 0.70, pruritus_ani: 0.25, discharge_perianal: 0.25, inguinal_nodes: 0.20, immunosuppression: 0.30, weight_loss: 0.20, pain_on_defaecation: 0.40, progressive_course: 0.55 },
    },
    {
      // BSG 2019 acute lower GI bleeding (Oakland et al., Gut 2019): diverticular bleeding and
      // angiodysplasia in older people on antithrombotics — painless maroon / red blood PR.
      id: 'lower_gi_bleed', label: 'Lower GI Haemorrhage (Diverticular / Angiodysplasia)', icd10: 'K92.1', prior: T.uncommon, course: 'acute',
      features: { pr_bleeding: 0.95, visible_blood_pr_large: 0.40, anaemia: 0.45, raised_urea: 0.20, anticoagulant_use: 0.30, antiplatelet_use: 0.35, tachycardia: 0.30, hypotension: 0.12, syncope: 0.08, dizziness: 0.20, pallor: 0.30, abdominal_pain: 0.20, colicky_pain: 0.15, change_bowel_habit: 0.10, sudden_onset: 0.40, episodic_pain: 0.20 },
    },
    {
      id: 'ischaemic_colitis', label: 'Ischaemic Colitis', icd10: 'K55.9', prior: T.rare, course: 'acute',
      features: { mesenteric_ct_signs: 0.15, lif_pain: 0.65, pr_bleeding: 0.80, bloody_diarrhoea: 0.60, change_bowel_habit: 0.45, nausea_vomiting: 0.40, fever: 0.30, elevated_wbc: 0.60, sudden_onset: 0.40, vascular_risk: 0.60 },
    },
    {
      id: 'rectal_prolapse', label: 'Rectal Prolapse', icd10: 'K62.3', prior: T.rare, course: 'any',
      // ASCRS 2017 rectal prolapse: incarceration → oedematous, dusky mucosa (strangulation) needs urgent reduction
      features: { prolapse_pr: 0.95, pr_bleeding: 0.40, mucus_pr: 0.50, tenesmus: 0.35, faecal_incontinence: 0.45, worse_straining: 0.50, constipation: 0.40, hernia_irreducible: 0.25, anal_pain: 0.45, localised_pain: 0.40, skin_necrosis: 0.08, elevated_wbc: 0.20, tachycardia: 0.20 },
    },
    {
      id: 'pilonidal_disease', label: 'Pilonidal Disease', icd10: 'L05.91', prior: T.uncommon, course: 'any',
      features: { natal_cleft: 0.90, perianal_swelling: 0.40, anal_pain: 0.40, posterior_midline: 0.60, discharge_perianal: 0.60, fever: 0.35, elevated_wbc: 0.35, swelling_fluctuant_soft: 0.50, erythema_surrounding: 0.50 },
    },
    {
      id: 'appendix_mass', label: 'Appendix Mass / Late Appendicitis', icd10: 'K35.3', prior: T.rare, course: 'subacute',
      features: { rlq_pain: 0.90, fever: 0.70, elevated_wbc: 0.80, anorexia: 0.60, nausea_vomiting: 0.50, abdominal_distension: 0.25, abdominal_mass: 0.70 },
    },
    {
      id: 'fournier_gangrene', label: "Fournier's Gangrene (Perineal Necrotising Fasciitis)", icd10: 'N49.3', prior: T.veryRare, course: 'acute',
      features: { perineal_pain: 0.90, scrotal_swelling: 0.65, perianal_swelling: 0.50, erythema_surrounding: 0.80, crepitus_soft_tissue: 0.50, fever: 0.75, tachycardia: 0.70, hypotension: 0.30, known_diabetes: 0.55, pain_out_of_proportion: 0.60, skin_necrosis: 0.45, elevated_wbc: 0.85, sglt2_inhibitor: 0.10 },
    },
    {
      // BSG 2019 IBD / ECCO: acute severe colitis with colonic dilatation > 6 cm and systemic toxicity
      id: 'toxic_megacolon', label: 'Toxic Megacolon (Acute Severe Colitis) / Colonic Perforation Risk', icd10: 'K59.31', prior: T.veryRare, course: 'acute',
      features: { dilated_colon: 0.90, abdominal_distension: 0.85, tympanic_abdomen: 0.50, diarrhoea: 0.75, bloody_diarrhoea: 0.60, pr_bleeding: 0.60, ulcerative_colitis_history: 0.60, cdiff_positive: 0.20, fever: 0.65, tachycardia: 0.85, hypotension: 0.25, raised_crp: 0.90, elevated_wbc: 0.75, anaemia: 0.45, diffuse_abdominal_pain: 0.50, guarding: 0.35, raised_lactate: 0.25, confusion: 0.10, recent_antibiotics: 0.20 },
    },
    {
      id: 'sigmoid_volvulus', label: 'Sigmoid Volvulus', icd10: 'K56.2', prior: T.rare, course: 'acute',
      features: { abdominal_distension: 0.95, absolute_constipation: 0.85, colicky_pain: 0.60, nausea_vomiting: 0.45, diffuse_abdominal_pain: 0.40, constipation: 0.80, tympanic_abdomen: 0.70 },
    },
  ],
  features: [
    { id: 'tenesmus', label: 'Tenesmus', question: 'Is there tenesmus (sensation of incomplete bowel emptying)?', category: 'symptom', baseRate: 0.02 },
    { id: 'anal_pain', label: 'Anal / perianal pain', question: 'Is there anal or perianal pain, especially on defaecation?', category: 'symptom', baseRate: 0.03 },
    { id: 'pain_on_defaecation', label: 'Pain on defaecation', question: 'Is the pain worst during or after passing a stool?', category: 'symptom', baseRate: 0.02 },
    { id: 'perianal_swelling', label: 'Perianal swelling / lump', question: 'Is there a visible or palpable perianal swelling or lump?', category: 'sign', baseRate: 0.02 },
    { id: 'mucus_pr', label: 'Mucus per rectum', question: 'Is there mucus discharge per rectum?', category: 'symptom', baseRate: 0.02 },
    { id: 'prolapse_pr', label: 'Rectal / anal prolapse', question: 'Is there tissue prolapsing through the anus, especially on straining?', category: 'sign', baseRate: 0.01 },
    { id: 'discharge_perianal', label: 'Perianal discharge / pus', question: 'Is there pus or discharge from the perianal area?', category: 'sign', baseRate: 0.01 },
    { id: 'pruritus_ani', label: 'Pruritus ani', question: 'Is there perianal itching?', category: 'symptom', baseRate: 0.02 },
    { id: 'posterior_midline', label: 'Posterior midline / natal cleft site', question: 'Is the lesion in the posterior midline of the anal canal or natal cleft?', category: 'sign', baseRate: 0.005 },
    { id: 'natal_cleft', label: 'Natal cleft swelling / sinus', question: 'Is there a swelling, pit or sinus in the natal cleft?', category: 'sign', baseRate: 0.003 },
    { id: 'rectal_mass', label: 'Rectal mass on digital examination', question: 'Is there a rectal mass on digital rectal examination?', category: 'sign', baseRate: 0.003 },
    { id: 'anal_mass_ulcer', label: 'Anal mass / non-healing ulcer / indurated lesion', question: 'Is there an anal mass, indurated lesion or non-healing ulcer?', category: 'sign', baseRate: 0.003 },
    { id: 'faecal_incontinence', label: 'Faecal incontinence / soiling', question: 'Is there faecal incontinence or soiling?', category: 'symptom', baseRate: 0.02 },
    { id: 'visible_blood_pr_large', label: 'Large-volume / maroon rectal bleeding', question: 'Is the rectal bleeding large-volume, maroon or with clots?', category: 'symptom', baseRate: 0.005 },
    { id: 'bloody_diarrhoea', label: 'Bloody diarrhoea', question: 'Is there diarrhoea mixed with blood?', category: 'symptom', baseRate: 0.01 },
    { id: 'perineal_pain', label: 'Perineal / scrotal-perineal pain', question: 'Is there pain in the perineum?', category: 'symptom', baseRate: 0.01 },
    { id: 'dilated_colon', label: 'Dilated colon (> 6 cm) on imaging / megacolon', question: 'Does imaging show a colon dilated beyond 6 cm?', category: 'investigation', baseRate: 0.003 },
    { id: 'tympanic_abdomen', label: 'Tympanic / massively distended abdomen', question: 'Is the abdomen tympanic or massively distended?', category: 'sign', baseRate: 0.01 },
  ],
});
