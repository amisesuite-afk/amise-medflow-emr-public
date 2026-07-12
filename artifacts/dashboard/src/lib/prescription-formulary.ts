/**
 * Surgical practice drug formulary for Amise Medical Services.
 *
 * Categories cover the most commonly prescribed medications in a
 * general and endoscopic surgery outpatient practice.  Default doses
 * are standard adult doses — prescribers must adjust for renal/hepatic
 * impairment, weight, allergies, and clinical context.
 *
 * This file is an administrative reference for the prescribing UI.
 * It does NOT constitute medical advice.
 */

export interface FormularyDrug {
  drugName: string;
  defaultDose: string;
  defaultFrequency: string;
  defaultRoute: string;
  category: string;
  commonIndications: string[];
}

export const FORMULARY: FormularyDrug[] = [
  // ──────────────────────────────────────────────
  // 1. Analgesics
  // ──────────────────────────────────────────────
  {
    drugName: 'Paracetamol',
    defaultDose: '1 g',
    defaultFrequency: 'QDS (every 6 hours)',
    defaultRoute: 'PO',
    category: 'Analgesics',
    commonIndications: [
      'Mild-to-moderate post-operative pain',
      'Pyrexia',
      'First-line analgesic ladder',
    ],
  },
  {
    drugName: 'Tramadol',
    defaultDose: '50 mg',
    defaultFrequency: 'QDS (every 6 hours)',
    defaultRoute: 'PO',
    category: 'Analgesics',
    commonIndications: [
      'Moderate post-operative pain',
      'Breakthrough pain not controlled by paracetamol/NSAIDs',
    ],
  },
  {
    drugName: 'Diclofenac',
    defaultDose: '50 mg',
    defaultFrequency: 'TDS (every 8 hours)',
    defaultRoute: 'PO',
    category: 'Analgesics',
    commonIndications: [
      'Post-operative inflammation and pain',
      'Musculoskeletal pain',
      'Renal colic',
    ],
  },
  {
    drugName: 'Ibuprofen',
    defaultDose: '400 mg',
    defaultFrequency: 'TDS (every 8 hours)',
    defaultRoute: 'PO',
    category: 'Analgesics',
    commonIndications: [
      'Mild-to-moderate pain',
      'Anti-inflammatory',
      'Post-operative analgesia (short course)',
    ],
  },
  {
    drugName: 'Morphine Sulphate',
    defaultDose: '5–10 mg',
    defaultFrequency: 'Every 4 hours PRN',
    defaultRoute: 'SC/IV',
    category: 'Analgesics',
    commonIndications: [
      'Severe post-operative pain',
      'Acute abdomen (after diagnosis established)',
      'Palliative pain management',
    ],
  },
  {
    drugName: 'Ketorolac',
    defaultDose: '30 mg',
    defaultFrequency: 'Every 6 hours (max 2 days)',
    defaultRoute: 'IV/IM',
    category: 'Analgesics',
    commonIndications: [
      'Short-term severe post-operative pain',
      'Renal colic',
      'Opioid-sparing analgesia',
    ],
  },

  // ──────────────────────────────────────────────
  // 2. Antibiotics
  // ──────────────────────────────────────────────
  {
    drugName: 'Amoxicillin',
    defaultDose: '500 mg',
    defaultFrequency: 'TDS (every 8 hours)',
    defaultRoute: 'PO',
    category: 'Antibiotics',
    commonIndications: [
      'Skin and soft-tissue infections',
      'Upper respiratory tract infections',
      'Helicobacter pylori eradication (triple therapy)',
    ],
  },
  {
    drugName: 'Co-Amoxiclav (Augmentin)',
    defaultDose: '625 mg',
    defaultFrequency: 'TDS (every 8 hours)',
    defaultRoute: 'PO',
    category: 'Antibiotics',
    commonIndications: [
      'Surgical wound infections',
      'Intra-abdominal infections (mild)',
      'Bite wounds',
      'Perioperative prophylaxis',
    ],
  },
  {
    drugName: 'Metronidazole',
    defaultDose: '500 mg',
    defaultFrequency: 'TDS (every 8 hours)',
    defaultRoute: 'PO/IV',
    category: 'Antibiotics',
    commonIndications: [
      'Anaerobic infections',
      'Intra-abdominal sepsis',
      'Perioperative prophylaxis (colorectal)',
      'Helicobacter pylori eradication',
      'Clostridium difficile infection',
    ],
  },
  {
    drugName: 'Ciprofloxacin',
    defaultDose: '500 mg',
    defaultFrequency: 'BD (every 12 hours)',
    defaultRoute: 'PO',
    category: 'Antibiotics',
    commonIndications: [
      'Urinary tract infections',
      'Intra-abdominal infections (with metronidazole)',
      'Diverticulitis',
      'Gram-negative coverage',
    ],
  },
  {
    drugName: 'Ceftriaxone',
    defaultDose: '1 g',
    defaultFrequency: 'OD (once daily)',
    defaultRoute: 'IV/IM',
    category: 'Antibiotics',
    commonIndications: [
      'Perioperative surgical prophylaxis',
      'Biliary sepsis',
      'Severe soft-tissue infections',
      'Community-acquired pneumonia',
    ],
  },
  {
    drugName: 'Piperacillin-Tazobactam (Tazocin)',
    defaultDose: '4.5 g',
    defaultFrequency: 'TDS (every 8 hours)',
    defaultRoute: 'IV',
    category: 'Antibiotics',
    commonIndications: [
      'Severe intra-abdominal sepsis',
      'Hospital-acquired infections',
      'Complicated surgical-site infections',
      'Empiric broad-spectrum cover',
    ],
  },
  {
    drugName: 'Flucloxacillin',
    defaultDose: '500 mg',
    defaultFrequency: 'QDS (every 6 hours)',
    defaultRoute: 'PO',
    category: 'Antibiotics',
    commonIndications: [
      'Staphylococcal skin infections',
      'Cellulitis',
      'Wound infections',
      'Abscess (post-drainage)',
    ],
  },
  {
    drugName: 'Doxycycline',
    defaultDose: '100 mg',
    defaultFrequency: 'BD (every 12 hours)',
    defaultRoute: 'PO',
    category: 'Antibiotics',
    commonIndications: [
      'Skin and soft-tissue infections (penicillin allergy)',
      'Pelvic inflammatory disease',
      'Chronic wound infections',
    ],
  },
  {
    drugName: 'Azithromycin',
    defaultDose: '500 mg',
    defaultFrequency: 'OD (once daily)',
    defaultRoute: 'PO',
    category: 'Antibiotics',
    commonIndications: [
      'Upper/lower respiratory tract infections',
      'Skin and soft-tissue infections (penicillin allergy)',
      'Traveller\'s diarrhoea',
    ],
  },

  // ──────────────────────────────────────────────
  // 3. PPIs / Antacids
  // ──────────────────────────────────────────────
  {
    drugName: 'Omeprazole',
    defaultDose: '20 mg',
    defaultFrequency: 'OD (once daily)',
    defaultRoute: 'PO',
    category: 'PPIs/Antacids',
    commonIndications: [
      'Gastro-oesophageal reflux disease (GORD)',
      'Peptic ulcer disease',
      'H. pylori eradication (triple therapy)',
      'NSAID gastroprotection',
      'Stress ulcer prophylaxis',
    ],
  },
  {
    drugName: 'Pantoprazole',
    defaultDose: '40 mg',
    defaultFrequency: 'OD (once daily)',
    defaultRoute: 'PO/IV',
    category: 'PPIs/Antacids',
    commonIndications: [
      'GORD',
      'Peptic ulcer disease',
      'Upper GI bleed (IV infusion)',
      'Zollinger-Ellison syndrome',
    ],
  },
  {
    drugName: 'Ranitidine',
    defaultDose: '150 mg',
    defaultFrequency: 'BD (every 12 hours)',
    defaultRoute: 'PO',
    category: 'PPIs/Antacids',
    commonIndications: [
      'GORD (PPI intolerance)',
      'Duodenal ulcer',
      'Pre-operative aspiration prophylaxis',
    ],
  },
  {
    drugName: 'Magnesium Trisilicate',
    defaultDose: '10 mL',
    defaultFrequency: 'TDS (every 8 hours) PRN',
    defaultRoute: 'PO',
    category: 'PPIs/Antacids',
    commonIndications: [
      'Dyspepsia',
      'Symptomatic heartburn relief',
      'Adjunct to PPI therapy',
    ],
  },

  // ──────────────────────────────────────────────
  // 4. Antiemetics
  // ──────────────────────────────────────────────
  {
    drugName: 'Ondansetron',
    defaultDose: '4 mg',
    defaultFrequency: 'TDS (every 8 hours)',
    defaultRoute: 'PO/IV',
    category: 'Antiemetics',
    commonIndications: [
      'Post-operative nausea and vomiting',
      'Opioid-induced nausea',
      'Chemotherapy-induced nausea',
    ],
  },
  {
    drugName: 'Metoclopramide',
    defaultDose: '10 mg',
    defaultFrequency: 'TDS (every 8 hours)',
    defaultRoute: 'PO/IV',
    category: 'Antiemetics',
    commonIndications: [
      'Nausea and vomiting',
      'Gastroparesis',
      'Post-operative ileus (prokinetic)',
    ],
  },
  {
    drugName: 'Domperidone',
    defaultDose: '10 mg',
    defaultFrequency: 'TDS (every 8 hours)',
    defaultRoute: 'PO',
    category: 'Antiemetics',
    commonIndications: [
      'Nausea and vomiting',
      'Dyspepsia with gastroparesis',
      'Functional dyspepsia',
    ],
  },

  // ──────────────────────────────────────────────
  // 5. Laxatives
  // ──────────────────────────────────────────────
  {
    drugName: 'Lactulose',
    defaultDose: '15 mL',
    defaultFrequency: 'BD (every 12 hours)',
    defaultRoute: 'PO',
    category: 'Laxatives',
    commonIndications: [
      'Post-operative constipation',
      'Opioid-induced constipation',
      'Hepatic encephalopathy',
    ],
  },
  {
    drugName: 'Bisacodyl',
    defaultDose: '10 mg',
    defaultFrequency: 'OD (at night)',
    defaultRoute: 'PO/PR',
    category: 'Laxatives',
    commonIndications: [
      'Constipation',
      'Pre-operative bowel preparation (adjunct)',
      'Post-operative constipation',
    ],
  },
  {
    drugName: 'Senna',
    defaultDose: '15 mg (2 tablets)',
    defaultFrequency: 'OD (at night)',
    defaultRoute: 'PO',
    category: 'Laxatives',
    commonIndications: [
      'Constipation',
      'Opioid-induced constipation',
      'Pre-operative bowel clearance (adjunct)',
    ],
  },
  {
    drugName: 'Macrogol (Movicol)',
    defaultDose: '1 sachet in 125 mL water',
    defaultFrequency: 'OD to TDS',
    defaultRoute: 'PO',
    category: 'Laxatives',
    commonIndications: [
      'Chronic constipation',
      'Faecal impaction (8 sachets/day regimen)',
      'Post-operative constipation',
    ],
  },

  // ──────────────────────────────────────────────
  // 6. DVT Prophylaxis
  // ──────────────────────────────────────────────
  {
    drugName: 'Enoxaparin',
    defaultDose: '40 mg',
    defaultFrequency: 'OD (once daily)',
    defaultRoute: 'SC',
    category: 'DVT Prophylaxis',
    commonIndications: [
      'Post-operative VTE prophylaxis',
      'Medical thromboprophylaxis',
      'Treatment of DVT/PE (1 mg/kg BD)',
    ],
  },
  {
    drugName: 'Heparin (Unfractionated)',
    defaultDose: '5 000 units',
    defaultFrequency: 'BD to TDS',
    defaultRoute: 'SC',
    category: 'DVT Prophylaxis',
    commonIndications: [
      'VTE prophylaxis (renal impairment)',
      'Perioperative anticoagulation bridging',
      'Acute VTE treatment (IV infusion)',
    ],
  },
  {
    drugName: 'Rivaroxaban',
    defaultDose: '10 mg',
    defaultFrequency: 'OD (once daily)',
    defaultRoute: 'PO',
    category: 'DVT Prophylaxis',
    commonIndications: [
      'Extended VTE prophylaxis post-surgery',
      'DVT/PE treatment (15 mg BD for 21 days then 20 mg OD)',
      'Stroke prevention in atrial fibrillation',
    ],
  },
  {
    drugName: 'Aspirin',
    defaultDose: '75 mg',
    defaultFrequency: 'OD (once daily)',
    defaultRoute: 'PO',
    category: 'DVT Prophylaxis',
    commonIndications: [
      'Adjunct VTE prophylaxis (low-risk patients)',
      'Cardiovascular risk reduction',
      'Post-orthopaedic surgery thromboprophylaxis',
    ],
  },

  // ──────────────────────────────────────────────
  // 7. Steroids
  // ──────────────────────────────────────────────
  {
    drugName: 'Dexamethasone',
    defaultDose: '8 mg',
    defaultFrequency: 'OD (once daily)',
    defaultRoute: 'IV',
    category: 'Steroids',
    commonIndications: [
      'Post-operative nausea and vomiting prophylaxis',
      'Anti-inflammatory (peri-operative)',
      'Cerebral oedema',
      'Anaphylaxis (adjunct)',
    ],
  },
  {
    drugName: 'Prednisolone',
    defaultDose: '40 mg',
    defaultFrequency: 'OD (once daily, morning)',
    defaultRoute: 'PO',
    category: 'Steroids',
    commonIndications: [
      'Inflammatory bowel disease flare',
      'Acute allergic reactions',
      'Asthma exacerbation',
      'Short-course anti-inflammatory',
    ],
  },
  {
    drugName: 'Hydrocortisone',
    defaultDose: '100 mg',
    defaultFrequency: 'QDS (every 6 hours)',
    defaultRoute: 'IV',
    category: 'Steroids',
    commonIndications: [
      'Acute adrenal insufficiency',
      'Anaphylaxis',
      'Severe inflammatory response',
      'Peri-operative steroid cover (chronic steroid patients)',
    ],
  },

  // ──────────────────────────────────────────────
  // 8. GI Specific
  // ──────────────────────────────────────────────
  {
    drugName: 'Hyoscine Butylbromide (Buscopan)',
    defaultDose: '20 mg',
    defaultFrequency: 'QDS (every 6 hours) PRN',
    defaultRoute: 'PO/IV',
    category: 'GI Specific',
    commonIndications: [
      'Abdominal cramps and colic',
      'Irritable bowel syndrome',
      'Endoscopy — reducing bowel spasm',
      'Biliary colic',
    ],
  },
  {
    drugName: 'Mebeverine',
    defaultDose: '135 mg',
    defaultFrequency: 'TDS (every 8 hours)',
    defaultRoute: 'PO',
    category: 'GI Specific',
    commonIndications: [
      'Irritable bowel syndrome',
      'Functional abdominal pain',
      'GI smooth-muscle spasm',
    ],
  },
  {
    drugName: 'Loperamide',
    defaultDose: '2 mg',
    defaultFrequency: 'After each loose stool (max 16 mg/day)',
    defaultRoute: 'PO',
    category: 'GI Specific',
    commonIndications: [
      'Acute diarrhoea',
      'Chronic diarrhoea (functional)',
      'Ileostomy high-output management',
    ],
  },
  {
    drugName: 'Mesalazine',
    defaultDose: '800 mg',
    defaultFrequency: 'TDS (every 8 hours)',
    defaultRoute: 'PO',
    category: 'GI Specific',
    commonIndications: [
      'Ulcerative colitis (maintenance and flare)',
      'Crohn\'s colitis (mild)',
      'Inflammatory bowel disease',
    ],
  },

  // ──────────────────────────────────────────────
  // 9. Bowel Prep
  // ──────────────────────────────────────────────
  {
    drugName: 'Polyethylene Glycol (PEG / Klean-Prep)',
    defaultDose: '1 sachet in 1 L water',
    defaultFrequency: '4 sachets over 4–6 hours (split or same-day)',
    defaultRoute: 'PO',
    category: 'Bowel Prep',
    commonIndications: [
      'Pre-colonoscopy bowel preparation',
      'Pre-operative bowel preparation (colorectal surgery)',
    ],
  },
  {
    drugName: 'Sodium Picosulfate (Picolax)',
    defaultDose: '1 sachet (10 mg)',
    defaultFrequency: '2 sachets: first morning, second afternoon (day before)',
    defaultRoute: 'PO',
    category: 'Bowel Prep',
    commonIndications: [
      'Pre-colonoscopy bowel preparation',
      'Pre-operative bowel preparation',
      'Alternative to PEG-based preps',
    ],
  },

  // ──────────────────────────────────────────────
  // 10. Wound Care
  // ──────────────────────────────────────────────
  {
    drugName: 'Mupirocin 2% Ointment',
    defaultDose: 'Apply thin layer',
    defaultFrequency: 'TDS (every 8 hours)',
    defaultRoute: 'Topical',
    category: 'Wound Care',
    commonIndications: [
      'Superficial wound infections',
      'MRSA decolonisation (nasal)',
      'Impetigo',
      'Minor surgical-site infections',
    ],
  },
  {
    drugName: 'Silver Sulfadiazine 1% Cream',
    defaultDose: 'Apply 2–3 mm layer',
    defaultFrequency: 'OD to BD',
    defaultRoute: 'Topical',
    category: 'Wound Care',
    commonIndications: [
      'Burn wounds',
      'Skin graft donor sites',
      'Infected chronic wounds',
      'Ulcer management',
    ],
  },
  {
    drugName: 'Chlorhexidine 0.05% Solution',
    defaultDose: 'Irrigate or apply with gauze',
    defaultFrequency: 'BD to TDS',
    defaultRoute: 'Topical',
    category: 'Wound Care',
    commonIndications: [
      'Wound irrigation',
      'Pre-operative skin antisepsis',
      'Drain-site care',
      'Post-operative wound cleansing',
    ],
  },
];

/** Unique category names in formulary order. */
export const FORMULARY_CATEGORIES = [...new Set(FORMULARY.map(d => d.category))];

/**
 * Free-text search across drug name, category, and indications.
 * Returns all matching entries (case-insensitive).
 */
export function searchFormulary(query: string): FormularyDrug[] {
  const q = query.toLowerCase();
  return FORMULARY.filter(
    d =>
      d.drugName.toLowerCase().includes(q) ||
      d.category.toLowerCase().includes(q) ||
      d.commonIndications.some(i => i.toLowerCase().includes(q)),
  );
}

/**
 * Return all drugs in a given category (case-insensitive match).
 */
export function getByCategory(category: string): FormularyDrug[] {
  const c = category.toLowerCase();
  return FORMULARY.filter(d => d.category.toLowerCase() === c);
}
