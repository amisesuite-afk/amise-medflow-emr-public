export interface DrugInteraction {
  drugs: [string, string];   // canonical lowercase drug names
  severity: 'contraindicated' | 'major' | 'moderate';
  effect: string;
  action: string;
}

// Partial list of clinically important interactions for surgical/general practice.
// Drug names are matched case-insensitively as substrings of the medication string.
export const INTERACTIONS: DrugInteraction[] = [
  // Anticoagulants
  { drugs: ['warfarin', 'aspirin'],        severity: 'major',           effect: 'Increased bleeding risk', action: 'Monitor INR closely; consider PPI cover' },
  { drugs: ['warfarin', 'nsaid'],          severity: 'major',           effect: 'Increased bleeding risk', action: 'Avoid NSAIDs; use paracetamol instead' },
  { drugs: ['warfarin', 'ibuprofen'],      severity: 'major',           effect: 'Increased bleeding risk', action: 'Avoid; use paracetamol instead' },
  { drugs: ['warfarin', 'metronidazole'],  severity: 'major',           effect: 'Potentiates anticoagulation — INR spike', action: 'Halve warfarin dose; daily INR for 5 days' },
  { drugs: ['warfarin', 'ciprofloxacin'],  severity: 'major',           effect: 'Potentiates anticoagulation', action: 'Monitor INR closely' },
  { drugs: ['warfarin', 'fluconazole'],    severity: 'major',           effect: 'CYP2C9 inhibition → elevated INR', action: 'Reduce warfarin dose; check INR after 3 days' },
  { drugs: ['warfarin', 'amiodarone'],     severity: 'major',           effect: 'Potentiates anticoagulation significantly', action: 'Reduce warfarin by 30–50%; frequent INR' },
  { drugs: ['heparin', 'nsaid'],           severity: 'moderate',        effect: 'Additive bleeding risk', action: 'Avoid NSAIDs; monitor for bleeding' },
  { drugs: ['rivaroxaban', 'aspirin'],     severity: 'major',           effect: 'Increased bleeding risk', action: 'Co-prescribe only if clearly indicated (ACS); add PPI' },
  { drugs: ['apixaban', 'nsaid'],          severity: 'major',           effect: 'Increased bleeding risk', action: 'Avoid NSAIDs; use paracetamol' },
  { drugs: ['clopidogrel', 'omeprazole'],  severity: 'moderate',        effect: 'CYP2C19 inhibition reduces clopidogrel activation', action: 'Use pantoprazole instead of omeprazole' },
  // Antibiotics
  { drugs: ['metronidazole', 'alcohol'],   severity: 'contraindicated', effect: 'Disulfiram-like reaction (flushing, vomiting)', action: 'Abstain from alcohol during and 48 h after course' },
  { drugs: ['ciprofloxacin', 'theophylline'], severity: 'major',        effect: 'Theophylline toxicity', action: 'Halve theophylline dose; monitor levels' },
  { drugs: ['ciprofloxacin', 'antacid'],   severity: 'moderate',        effect: 'Reduced ciprofloxacin absorption', action: 'Separate doses by ≥2 hours' },
  { drugs: ['gentamicin', 'furosemide'],   severity: 'major',           effect: 'Additive ototoxicity and nephrotoxicity', action: 'Use minimum effective doses; monitor renal function and hearing' },
  { drugs: ['clindamycin', 'neuromuscular blocking'], severity: 'moderate', effect: 'Enhanced neuromuscular blockade', action: 'Monitor for prolonged paralysis' },
  // Cardiovascular
  { drugs: ['metformin', 'contrast'],      severity: 'major',           effect: 'Lactic acidosis risk with iodinated contrast', action: 'Hold metformin 48 h before and after contrast; check eGFR' },
  { drugs: ['digoxin', 'amiodarone'],      severity: 'major',           effect: 'Digoxin toxicity (↑ digoxin levels)', action: 'Halve digoxin dose when adding amiodarone; monitor levels' },
  { drugs: ['digoxin', 'furosemide'],      severity: 'major',           effect: 'Hypokalaemia potentiates digoxin toxicity', action: 'Monitor potassium; replace aggressively' },
  { drugs: ['ace inhibitor', 'potassium'], severity: 'major',           effect: 'Hyperkalaemia', action: 'Monitor potassium closely; avoid potassium supplements unless clearly necessary' },
  { drugs: ['lisinopril', 'potassium'],    severity: 'major',           effect: 'Hyperkalaemia', action: 'Monitor potassium' },
  { drugs: ['amlodipine', 'simvastatin'],  severity: 'major',           effect: 'Increased simvastatin plasma level → myopathy', action: 'Limit simvastatin to 20 mg/day or switch to rosuvastatin' },
  // Analgesics / Anaesthesia
  { drugs: ['tramadol', 'ssri'],           severity: 'major',           effect: 'Serotonin syndrome risk', action: 'Avoid combination; use alternative analgesia' },
  { drugs: ['tramadol', 'sertraline'],     severity: 'major',           effect: 'Serotonin syndrome risk', action: 'Use alternative analgesic' },
  { drugs: ['tramadol', 'fluoxetine'],     severity: 'major',           effect: 'Serotonin syndrome risk', action: 'Use alternative analgesic' },
  { drugs: ['opioid', 'benzodiazepine'],   severity: 'contraindicated', effect: 'Additive CNS/respiratory depression; risk of fatal apnoea', action: 'Avoid combination if possible; monitor closely; have naloxone available' },
  { drugs: ['morphine', 'midazolam'],      severity: 'major',           effect: 'Additive respiratory depression', action: 'Reduce doses; monitor SpO2' },
  { drugs: ['nsaid', 'steroid'],           severity: 'major',           effect: 'Increased risk of peptic ulceration and GI bleed', action: 'Co-prescribe PPI (omeprazole 20mg od)' },
  { drugs: ['paracetamol', 'alcohol'],     severity: 'major',           effect: 'Hepatotoxicity risk in chronic alcohol use', action: 'Reduce paracetamol to 2g/day max in alcoholic patients' },
  // Endocrine / Metabolic
  { drugs: ['metformin', 'alcohol'],       severity: 'moderate',        effect: 'Increased lactic acidosis risk', action: 'Advise alcohol reduction' },
  { drugs: ['insulin', 'beta blocker'],    severity: 'moderate',        effect: 'Hypoglycaemia masked; delayed recovery', action: 'Monitor BGL closely; use cardioselective beta-blocker' },
  { drugs: ['steroid', 'insulin'],         severity: 'moderate',        effect: 'Corticosteroids raise blood glucose', action: 'Increase insulin monitoring; may need steroid cover protocol' },
  // Psychiatric / Neurological
  { drugs: ['maoi', 'tramadol'],           severity: 'contraindicated', effect: 'Severe serotonin syndrome', action: 'Contraindicated; do not co-administer' },
  { drugs: ['maoi', 'pethidine'],          severity: 'contraindicated', effect: 'Life-threatening serotonin crisis', action: 'Contraindicated; use morphine instead' },
  { drugs: ['lithium', 'nsaid'],           severity: 'major',           effect: 'Lithium toxicity (NSAIDs reduce renal lithium clearance)', action: 'Avoid NSAIDs; monitor lithium levels' },
  { drugs: ['lithium', 'diuretic'],        severity: 'major',           effect: 'Lithium toxicity', action: 'Monitor lithium levels closely; maintain adequate fluid intake' },
];

export interface FoundInteraction {
  interaction: DrugInteraction;
  matchedA: string;
  matchedB: string;
}

export function checkInteractions(medList: string[]): FoundInteraction[] {
  const lc = medList.map(m => m.toLowerCase());
  const found: FoundInteraction[] = [];

  for (const ix of INTERACTIONS) {
    const [a, b] = ix.drugs;
    const matchA = lc.filter(m => m.includes(a));
    const matchB = lc.filter(m => m.includes(b));
    if (matchA.length > 0 && matchB.length > 0) {
      found.push({ interaction: ix, matchedA: matchA[0], matchedB: matchB[0] });
    }
  }
  // Deduplicate by drug pair
  const seen = new Set<string>();
  return found.filter(f => {
    const key = [f.interaction.drugs[0], f.interaction.drugs[1]].sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
