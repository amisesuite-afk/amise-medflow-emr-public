/**
 * Deterministic drug-interaction screen (decision support; display only).
 *
 * Rule terms are either classes ("nsaid", "opioid", "ssri", "qt prolonging") or specific
 * drugs ("warfarin"). Every term MUST be defined in `drug-classes.ts` (class members,
 * synonyms and Caribbean/UK/US brand names, each with its BNF / Stockley's / SmPC source);
 * `__tests__/drug-interactions.test.ts` fails if a rule names an unmapped term. Before
 * H-07 the class names were only substring-matched, so "warfarin" + "diclofenac" raised
 * no alert.
 *
 * Parity with iOS (`ios/AmiseMedFlow/Services/DrugInteractionService.swift`): every rule pair
 * on either platform is raised on the other (same pair, or a broader class rule). Checked in
 * CI by `pnpm --filter @workspace/scripts run lint:interaction-parity`.
 */
import { matchTerm } from './drug-classes';

export interface DrugInteraction {
  drugs: [string, string];   // rule terms (lowercase): a class or drug key in DRUG_TERMS
  severity: 'contraindicated' | 'major' | 'moderate';
  effect: string;
  action: string;
}

// Partial list of clinically important interactions for surgical/general practice.
// Terms match case-insensitively: any class member / synonym / brand as a whole word, OR the
// raw term itself — as a substring for terms the original 36 rules use (pre-H-07 behaviour,
// kept), as a whole word for terms only the H-07 rules use.
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

  // ── Class-based rules added for H-07 ───────────────────────────────────────────────────
  // Appended AFTER the original rules so that, when two rules hit the same pair, the
  // original (more specific) wording is shown first. Severity is this app's 3-level scale.
  // Source for each: BNF Interactions appendix and Stockley's Drug Interactions unless
  // stated; MHRA Drug Safety Updates / SmPCs where cited.
  // Bleeding — BNF: NSAIDs, antiplatelets and SSRIs/SNRIs each increase bleeding risk with
  // coumarins, DOACs and heparins.
  { drugs: ['anticoagulant', 'nsaid'],     severity: 'major',           effect: 'Increased bleeding risk', action: 'Avoid NSAIDs; use paracetamol instead. If unavoidable, add PPI and monitor for bleeding' },
  { drugs: ['anticoagulant', 'antiplatelet'], severity: 'major',        effect: 'Increased bleeding risk', action: 'Combine only with a clear indication (e.g. recent ACS/stent) and specialist input; add PPI; minimise duration' },
  { drugs: ['anticoagulant', 'ssri'],      severity: 'moderate',        effect: 'Increased bleeding risk (SSRIs impair platelet serotonin uptake)', action: 'Monitor for bleeding; check INR when starting/stopping an SSRI with warfarin; consider PPI' },
  { drugs: ['anticoagulant', 'snri'],      severity: 'moderate',        effect: 'Increased bleeding risk (SNRIs impair platelet serotonin uptake)', action: 'Monitor for bleeding; check INR when starting/stopping an SNRI with warfarin; consider PPI' },
  { drugs: ['nsaid', 'ssri'],              severity: 'moderate',        effect: 'Increased risk of GI bleeding', action: 'Consider PPI gastroprotection; avoid if previous GI bleed' },
  { drugs: ['nsaid', 'snri'],              severity: 'moderate',        effect: 'Increased risk of GI bleeding', action: 'Consider PPI gastroprotection; avoid if previous GI bleed' },
  // Serotonin toxicity — BNF; tramadol and SSRI/SNRI SmPCs (MAOI + SSRI/SNRI contraindicated,
  // including for 14 days after stopping an irreversible MAOI).
  { drugs: ['tramadol', 'snri'],           severity: 'major',           effect: 'Serotonin syndrome risk', action: 'Avoid combination; use alternative analgesia' },
  { drugs: ['maoi', 'ssri'],               severity: 'contraindicated', effect: 'Severe serotonin syndrome', action: 'Contraindicated; do not co-administer (observe MAOI washout)' },
  { drugs: ['maoi', 'snri'],               severity: 'contraindicated', effect: 'Severe serotonin syndrome', action: 'Contraindicated; do not co-administer (observe MAOI washout)' },
  // Respiratory depression — MHRA DSU Oct 2017 (gabapentin), Feb 2021 (pregabalin).
  { drugs: ['opioid', 'gabapentinoid'],    severity: 'major',           effect: 'Additive CNS/respiratory depression', action: 'Use lowest effective doses; monitor sedation and respiratory rate, especially elderly/post-op' },
  // QT — CredibleMeds "Known Risk of TdP"; BNF. Two DIFFERENT QT-prolonging drugs.
  { drugs: ['qt prolonging', 'qt prolonging'], severity: 'major',       effect: 'Additive QT prolongation — risk of torsade de pointes', action: 'Avoid combination where possible; check baseline ECG (QTc), potassium and magnesium; stop if QTc >500 ms' },
  // Warfarin potentiation — BNF (macrolides; azoles). MHRA DSU June 2016: miconazole oral gel.
  { drugs: ['warfarin', 'macrolide'],      severity: 'major',           effect: 'Potentiates anticoagulation — INR rise', action: 'Check INR within 3–5 days of starting; adjust warfarin dose' },
  { drugs: ['warfarin', 'azole antifungal'], severity: 'major',         effect: 'Potentiates anticoagulation — INR rise (CYP2C9/3A4 inhibition)', action: 'Avoid miconazole oral gel; otherwise reduce warfarin and monitor INR closely' },
  // Statin myopathy — Zocor (simvastatin) and Klaricid SmPCs: strong CYP3A4-inhibiting
  // macrolides are contraindicated with simvastatin.
  { drugs: ['clarithromycin', 'simvastatin'], severity: 'contraindicated', effect: 'Greatly raised simvastatin levels — myopathy / rhabdomyolysis', action: 'Withhold simvastatin for the course, or use a non-interacting antibiotic (e.g. azithromycin)' },
  { drugs: ['erythromycin', 'simvastatin'],   severity: 'contraindicated', effect: 'Greatly raised simvastatin levels — myopathy / rhabdomyolysis', action: 'Withhold simvastatin for the course, or use a non-interacting antibiotic (e.g. azithromycin)' },
  // Hyperkalaemia — BNF: ACE inhibitors / ARBs with potassium-sparing diuretics, aldosterone
  // antagonists or potassium salts.
  { drugs: ['ace inhibitor', 'potassium-sparing diuretic'], severity: 'major', effect: 'Hyperkalaemia', action: 'Monitor potassium and renal function closely' },
  { drugs: ['arb', 'potassium-sparing diuretic'],           severity: 'major', effect: 'Hyperkalaemia', action: 'Monitor potassium and renal function closely' },
  { drugs: ['arb', 'potassium'],                            severity: 'major', effect: 'Hyperkalaemia', action: 'Monitor potassium closely; avoid potassium supplements unless clearly necessary' },
  // Renal — BNF: NSAIDs with ACE inhibitors / ARBs increase the risk of renal impairment and
  // reduce the antihypertensive effect (also on the iOS rule list).
  { drugs: ['nsaid', 'ace inhibitor'],     severity: 'moderate',        effect: 'Risk of acute kidney injury; reduced antihypertensive effect', action: 'Avoid in CKD, dehydration or with a diuretic; monitor renal function and potassium' },
  { drugs: ['nsaid', 'arb'],               severity: 'moderate',        effect: 'Risk of acute kidney injury; reduced antihypertensive effect', action: 'Avoid in CKD, dehydration or with a diuretic; monitor renal function and potassium' },
  // Methotrexate — BNF: NSAIDs reduce methotrexate excretion (also on the iOS rule list).
  { drugs: ['methotrexate', 'nsaid'],      severity: 'major',           effect: 'Methotrexate toxicity (reduced renal clearance)', action: 'Avoid; if unavoidable, monitor FBC, renal and liver function' },

  // ── Rules ported from the iOS list (platform parity) ──────────────────────────────────
  // Same terms, grade, effect and action as `DrugInteractionService.swift` (its effect is
  // `clinicalEffect`, its action `management`). Every other iOS-only rule is already raised here
  // by a broader class rule (e.g. iOS warfarin + clopidogrel ⊂ anticoagulant + antiplatelet).
  // `lint:interaction-parity` fails if either platform has a rule pair the other cannot raise.
  // Aminoglycosides — BNF: additive nephrotoxicity (vancomycin); NSAIDs reduce renal perfusion.
  { drugs: ['gentamicin', 'vancomycin'],   severity: 'major',           effect: 'Acute kidney injury — additive renal tubular toxicity', action: 'Monitor renal function and drug levels closely; ensure adequate hydration' },
  { drugs: ['gentamicin', 'nsaid'],        severity: 'moderate',        effect: 'Increased nephrotoxicity and ototoxicity', action: 'Avoid if possible; monitor renal function and gentamicin levels' },
  // Methotrexate — BNF: ciprofloxacin and penicillins reduce methotrexate excretion.
  { drugs: ['methotrexate', 'ciprofloxacin'], severity: 'major',        effect: 'Methotrexate toxicity', action: 'Avoid; use alternative antibiotic' },
  { drugs: ['methotrexate', 'co-amoxiclav'], severity: 'moderate',      effect: 'Risk of methotrexate accumulation and toxicity', action: 'Use alternative antibiotic where possible; monitor FBC' },
  // Clopidogrel + PPI — CYP2C19 inhibition (see also clopidogrel + omeprazole above).
  { drugs: ['clopidogrel', 'lansoprazole'], severity: 'moderate',       effect: 'Reduced antiplatelet effect', action: 'Prefer pantoprazole; cardiologist input for dual antiplatelet patients' },

  // ── Herbal products and supplements (supplement-catalogue.ts) ─────────────────────────
  // A supplement recorded in "Herbs, teas, bush remedies & supplements" is screened like a drug.
  // Sources: Ang-Lee MK et al. JAMA 2001;286:208-16; OpenAnesthesia / SPAQI 2025; Proc (Bayl Univ
  // Med Cent) 2022 (supplements and bleeding); BNF interactions (St John's wort); NIDDK LiverTox.
  // Grades are conservative (major for bleeding, serotonin toxicity and transplant-drug levels)
  // and await the surgeon's review. Same terms, grade and wording as iOS (`lint:interaction-parity`
  // compares the wording of every supplement rule). Stop times are for the clinician only.
  // Bleeding — antiplatelet effects added to anticoagulants, antiplatelets and NSAIDs.
  { drugs: ['garlic', 'anticoagulant'],    severity: 'major', effect: 'Increased bleeding risk (garlic inhibits platelet aggregation)', action: 'Review before any procedure; commonly cited stop time before elective surgery at least 7 days (many advise 2 weeks) — clinician to confirm; monitor for bleeding' },
  { drugs: ['garlic', 'antiplatelet'],     severity: 'major', effect: 'Increased bleeding risk (garlic inhibits platelet aggregation)', action: 'Review before any procedure; commonly cited stop time before elective surgery at least 7 days (many advise 2 weeks) — clinician to confirm; monitor for bleeding' },
  { drugs: ['garlic', 'nsaid'],            severity: 'major', effect: 'Increased bleeding risk (garlic inhibits platelet aggregation)', action: 'Review before any procedure; commonly cited stop time before elective surgery at least 7 days (many advise 2 weeks) — clinician to confirm; monitor for bleeding' },
  { drugs: ['ginkgo', 'anticoagulant'],    severity: 'major', effect: 'Increased bleeding risk (ginkgo inhibits platelet-activating factor)', action: 'Review before any procedure; commonly cited stop time before elective surgery at least 36 hours (SPAQI advises 2 weeks) — clinician to confirm; monitor for bleeding' },
  { drugs: ['ginkgo', 'antiplatelet'],     severity: 'major', effect: 'Increased bleeding risk (ginkgo inhibits platelet-activating factor)', action: 'Review before any procedure; commonly cited stop time before elective surgery at least 36 hours (SPAQI advises 2 weeks) — clinician to confirm; monitor for bleeding' },
  { drugs: ['ginkgo', 'nsaid'],            severity: 'major', effect: 'Increased bleeding risk (ginkgo inhibits platelet-activating factor)', action: 'Review before any procedure; commonly cited stop time before elective surgery at least 36 hours (SPAQI advises 2 weeks) — clinician to confirm; monitor for bleeding' },
  { drugs: ['ginger', 'anticoagulant'],    severity: 'major', effect: 'Increased bleeding risk (ginger inhibits thromboxane synthetase)', action: 'Review before any procedure; commonly cited stop time before elective surgery 2 weeks (SPAQI) — clinician to confirm; monitor for bleeding' },
  { drugs: ['ginger', 'antiplatelet'],     severity: 'major', effect: 'Increased bleeding risk (ginger inhibits thromboxane synthetase)', action: 'Review before any procedure; commonly cited stop time before elective surgery 2 weeks (SPAQI) — clinician to confirm; monitor for bleeding' },
  { drugs: ['ginger', 'nsaid'],            severity: 'major', effect: 'Increased bleeding risk (ginger inhibits thromboxane synthetase)', action: 'Review before any procedure; commonly cited stop time before elective surgery 2 weeks (SPAQI) — clinician to confirm; monitor for bleeding' },
  { drugs: ['turmeric', 'anticoagulant'],  severity: 'major', effect: 'Increased bleeding risk (curcumin has antiplatelet effects)', action: 'Review before any procedure; commonly cited stop time before elective surgery 2 weeks — clinician to confirm; monitor for bleeding' },
  { drugs: ['turmeric', 'antiplatelet'],   severity: 'major', effect: 'Increased bleeding risk (curcumin has antiplatelet effects)', action: 'Review before any procedure; commonly cited stop time before elective surgery 2 weeks — clinician to confirm; monitor for bleeding' },
  { drugs: ['turmeric', 'nsaid'],          severity: 'major', effect: 'Increased bleeding risk (curcumin has antiplatelet effects)', action: 'Review before any procedure; commonly cited stop time before elective surgery 2 weeks — clinician to confirm; monitor for bleeding' },
  { drugs: ['ginseng', 'anticoagulant'],   severity: 'major', effect: 'Possible increased bleeding risk (ginseng may inhibit platelet function)', action: 'Review before any procedure; commonly cited stop time before elective surgery at least 7 days (SPAQI advises 2 weeks) — clinician to confirm; monitor for bleeding' },
  { drugs: ['ginseng', 'antiplatelet'],    severity: 'major', effect: 'Possible increased bleeding risk (ginseng may inhibit platelet function)', action: 'Review before any procedure; commonly cited stop time before elective surgery at least 7 days (SPAQI advises 2 weeks) — clinician to confirm; monitor for bleeding' },
  { drugs: ['ginseng', 'nsaid'],           severity: 'major', effect: 'Possible increased bleeding risk (ginseng may inhibit platelet function)', action: 'Review before any procedure; commonly cited stop time before elective surgery at least 7 days (SPAQI advises 2 weeks) — clinician to confirm; monitor for bleeding' },
  // St John's wort — CYP3A4 / P-glycoprotein induction; serotonergic (BNF: avoid with each of these).
  { drugs: ['st johns wort', 'warfarin'],  severity: 'major', effect: "Reduced warfarin effect — INR falls (St John's wort induces warfarin metabolism)", action: "Avoid combination; if St John's wort is stopped, check INR closely (it may rise)" },
  { drugs: ['st johns wort', 'doac'],      severity: 'major', effect: 'Reduced DOAC levels (CYP3A4 / P-glycoprotein induction) — risk of thrombosis', action: 'Avoid combination' },
  { drugs: ['st johns wort', 'calcineurin inhibitor'], severity: 'major', effect: 'Reduced ciclosporin / tacrolimus levels (CYP3A4 / P-glycoprotein induction) — risk of transplant rejection', action: 'Avoid combination; check drug levels if it has been taken' },
  { drugs: ['st johns wort', 'ssri'],      severity: 'major', effect: 'Serotonin syndrome risk', action: 'Avoid combination' },
  { drugs: ['st johns wort', 'snri'],      severity: 'major', effect: 'Serotonin syndrome risk', action: 'Avoid combination' },
  { drugs: ['st johns wort', 'triptan'],   severity: 'major', effect: 'Serotonin syndrome risk', action: 'Avoid combination' },
  { drugs: ['st johns wort', 'combined oral contraceptive'], severity: 'major', effect: 'Reduced contraceptive efficacy (enzyme induction) — breakthrough bleeding and unplanned pregnancy', action: 'Avoid combination; advise additional or alternative contraception' },
  // Ginseng — hypoglycaemia (especially while fasting); reduced INR reported with warfarin.
  { drugs: ['ginseng', 'insulin'],         severity: 'moderate', effect: 'Hypoglycaemia risk, especially in fasting patients (pre-op fast or religious fast)', action: 'Monitor blood glucose, especially while fasting; commonly cited stop time before elective surgery at least 7 days (SPAQI advises 2 weeks) — clinician to confirm' },
  { drugs: ['ginseng', 'sulfonylurea'],    severity: 'moderate', effect: 'Hypoglycaemia risk, especially in fasting patients (pre-op fast or religious fast)', action: 'Monitor blood glucose, especially while fasting; commonly cited stop time before elective surgery at least 7 days (SPAQI advises 2 weeks) — clinician to confirm' },
  { drugs: ['ginseng', 'warfarin'],        severity: 'moderate', effect: 'Reduced INR reported (American ginseng)', action: 'Check INR when ginseng is started or stopped' },
  // Kava and valerian — potentiate sedation and anaesthesia.
  { drugs: ['kava', 'benzodiazepine'],     severity: 'moderate', effect: 'Additive sedation / CNS depression', action: 'Avoid combining; commonly cited stop time before surgery 24 hours — clinician to confirm; tell the anaesthetist' },
  { drugs: ['kava', 'opioid'],             severity: 'moderate', effect: 'Additive sedation / CNS depression', action: 'Avoid combining; commonly cited stop time before surgery 24 hours — clinician to confirm; tell the anaesthetist' },
  { drugs: ['kava', 'sedative hypnotic'],  severity: 'moderate', effect: 'Additive sedation / CNS depression', action: 'Avoid combining; commonly cited stop time before surgery 24 hours — clinician to confirm; tell the anaesthetist' },
  { drugs: ['kava', 'general anaesthetic'], severity: 'moderate', effect: 'Potentiates anaesthetic sedation', action: 'Commonly cited stop time before surgery 24 hours — clinician to confirm; tell the anaesthetist' },
  { drugs: ['valerian', 'benzodiazepine'], severity: 'moderate', effect: 'Additive sedation / CNS depression', action: 'Avoid combining; valerian is tapered over 1–2 weeks rather than stopped suddenly — clinician to confirm; tell the anaesthetist' },
  { drugs: ['valerian', 'opioid'],         severity: 'moderate', effect: 'Additive sedation / CNS depression', action: 'Avoid combining; valerian is tapered over 1–2 weeks rather than stopped suddenly — clinician to confirm; tell the anaesthetist' },
  { drugs: ['valerian', 'sedative hypnotic'], severity: 'moderate', effect: 'Additive sedation / CNS depression', action: 'Avoid combining; valerian is tapered over 1–2 weeks rather than stopped suddenly — clinician to confirm; tell the anaesthetist' },
  { drugs: ['valerian', 'general anaesthetic'], severity: 'moderate', effect: 'Potentiates anaesthetic sedation; abrupt withdrawal can cause a benzodiazepine-like withdrawal', action: 'Taper valerian over 1–2 weeks before elective surgery rather than stopping suddenly — clinician to confirm; tell the anaesthetist' },
  // Ephedra (ma huang) — sympathomimetic.
  { drugs: ['ephedra', 'maoi'],            severity: 'contraindicated', effect: 'Hypertensive crisis', action: 'Contraindicated; do not co-administer' },
  { drugs: ['ephedra', 'sympathomimetic'], severity: 'major', effect: 'Hypertension, tachycardia and arrhythmia (additive sympathomimetic effect)', action: 'Avoid combination' },
  { drugs: ['ephedra', 'general anaesthetic'], severity: 'major', effect: 'Intra-operative haemodynamic instability — hypertension and arrhythmia', action: 'Commonly cited stop time before surgery at least 24 hours (ideally avoid entirely) — clinician to confirm; tell the anaesthetist' },
  // Ashwagandha — thyroid, sedation, immune effects.
  { drugs: ['ashwagandha', 'levothyroxine'], severity: 'moderate', effect: 'May raise thyroid hormone levels (additive with levothyroxine)', action: 'Check thyroid function; ashwagandha is best avoided in thyroid disease' },
  { drugs: ['ashwagandha', 'benzodiazepine'], severity: 'moderate', effect: 'Additive sedation', action: 'Avoid combining; tell the anaesthetist' },
  { drugs: ['ashwagandha', 'sedative hypnotic'], severity: 'moderate', effect: 'Additive sedation', action: 'Avoid combining; tell the anaesthetist' },
  { drugs: ['ashwagandha', 'immunosuppressant'], severity: 'moderate', effect: 'May stimulate immune function and oppose immunosuppression', action: 'Avoid in transplant recipients and before planned immunosuppression' },
  // Echinacea — immune-stimulating.
  { drugs: ['echinacea', 'immunosuppressant'], severity: 'moderate', effect: 'May oppose immunosuppression (immune-stimulating effects)', action: 'Avoid in transplant recipients; stop early before planned immunosuppression or transplant-type surgery' },
];

export interface FoundInteraction {
  interaction: DrugInteraction;
  /** The medication entries as written (lowercased), e.g. "diclofenac 50mg tds". */
  matchedA: string;
  matchedB: string;
  /** Class label when a side matched through class membership (e.g. "NSAID"). */
  viaClassA?: string;
  viaClassB?: string;
  /**
   * Other rules that hit the SAME pair of medications with a different effect. Nothing is
   * dropped: the most severe rule is shown as the headline and the rest are listed here.
   */
  related: DrugInteraction[];
}

/**
 * The first ORIGINAL_RULE_COUNT entries of INTERACTIONS are the pre-H-07 rules, unchanged.
 * Only the terms they name keep the pre-H-07 raw-substring match (so every old alert still
 * fires). Terms only the H-07 class rules use ("arb", "anticoagulant", "qt prolonging", …)
 * match as whole words only: a raw "arb" fired inside "carbamazepine" and "sodium bicarbonate".
 * Same rule as iOS `DrugInteractionService.legacyTerms` (whose original list has 27 rules).
 */
export const ORIGINAL_RULE_COUNT = 36;
export const LEGACY_TERMS: ReadonlySet<string> = new Set(
  INTERACTIONS.slice(0, ORIGINAL_RULE_COUNT).flatMap(r => r.drugs),
);

/**
 * Clinical rank, higher = more severe. Always sort by this, never by the severity name
 * (alphabetical order would put "major" before "contraindicated"). Same order as iOS
 * `DrugInteraction.Severity.rank` (contraindicated > major > moderate > minor; the web scale
 * has no "minor" grade).
 */
export const SEVERITY_RANK: Record<DrugInteraction['severity'], number> = {
  contraindicated: 3,
  major: 2,
  moderate: 1,
};

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Deterministic interaction screen over a free-text medication list.
 *
 * A rule term matches an entry by (1) the pre-H-07 raw substring test, kept unchanged but only
 * for terms in LEGACY_TERMS, OR (2) whole-word membership of the term's class / synonym list
 * in `drug-classes.ts` (a name after "<digit>-" is not a word start: "5-ASA" is not aspirin),
 * OR (3) for non-legacy terms, the literal term as a whole word ("ARB", "SNRI").
 * Class matches only ever ADD alerts. A class match must pair two different list entries
 * (e.g. "losartan potassium" alone is not "ARB + potassium"); a same-class rule (QT + QT)
 * additionally needs two different drugs. Hits on the same pair of entries are merged into
 * one card (most severe first) with every other distinct effect kept in `related`.
 * Display only — never blocks or edits a prescription.
 */
export function checkInteractions(medList: string[]): FoundInteraction[] {
  const lc = medList.map(norm).filter(Boolean);
  type Hit = { ix: DrugInteraction; ruleOrder: number; mA: string; mB: string; vA?: string; vB?: string };
  const byPair = new Map<string, Hit[]>();
  const pairIdx = new Map<string, [number, number]>();
  const hitsFor = (term: string) => {
    const fallback = LEGACY_TERMS.has(term);
    return lc.map((m, i) => ({ i, m, hit: matchTerm(term, m, fallback) })).filter(x => x.hit !== null);
  };

  INTERACTIONS.forEach((ix, ruleOrder) => {
    const [a, b] = ix.drugs;
    const sameTerm = a === b;
    const hitsA = hitsFor(a);
    if (hitsA.length === 0) return;
    const hitsB = hitsFor(b);

    for (const A of hitsA) {
      for (const B of hitsB) {
        const ha = A.hit!, hb = B.hit!;
        if (A.i === B.i) {
          // Pre-H-07 behaviour allowed one entry to match both sides by raw substring; keep
          // that (never remove an alert) but never create a new self-pair via class lookup.
          if (sameTerm || !(ha.legacy && hb.legacy)) continue;
        }
        // Same-class rule (QT + QT): two different entries AND two different drugs.
        if (sameTerm && (A.i > B.i || ha.canonical === hb.canonical)) continue;

        const key = A.i <= B.i ? `${A.i}|${B.i}` : `${B.i}|${A.i}`;
        pairIdx.set(key, [Math.min(A.i, B.i), Math.max(A.i, B.i)]);
        const list = byPair.get(key) ?? [];
        if (!list.some(h => h.ix === ix)) {
          list.push({ ix, ruleOrder, mA: A.m, mB: B.m, vA: ha.viaClass, vB: hb.viaClass });
        }
        byPair.set(key, list);
      }
    }
  });

  const ranked: { found: FoundInteraction; ruleOrder: number; lo: number; hi: number }[] = [];
  for (const [key, hits] of byPair) {
    // Most severe first; original rule order breaks ties (original wording wins).
    hits.sort((x, y) =>
      SEVERITY_RANK[y.ix.severity] - SEVERITY_RANK[x.ix.severity] || x.ruleOrder - y.ruleOrder);
    // Collapse only exact duplicates of the same effect (keeping the most severe); every
    // distinct effect stays visible.
    const kept: Hit[] = [];
    for (const h of hits) if (!kept.some(k => norm(k.ix.effect) === norm(h.ix.effect))) kept.push(h);
    const [head, ...rest] = kept;
    const [lo, hi] = pairIdx.get(key)!;
    ranked.push({
      found: {
        interaction: head.ix,
        matchedA: head.mA, matchedB: head.mB,
        viaClassA: head.vA, viaClassB: head.vB,
        related: rest.map(r => r.ix),
      },
      ruleOrder: head.ruleOrder, lo, hi,
    });
  }
  // Clinical severity first (explicit rank), then original rule order, then list position —
  // the same deterministic order as iOS `DrugInteractionService.check`.
  ranked.sort((x, y) =>
    SEVERITY_RANK[y.found.interaction.severity] - SEVERITY_RANK[x.found.interaction.severity]
    || x.ruleOrder - y.ruleOrder || x.lo - y.lo || x.hi - y.hi);
  return ranked.map(r => r.found);
}
