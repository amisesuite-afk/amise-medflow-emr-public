export type PeriOpAction = 'continue' | 'hold_day' | 'hold_before' | 'bridge' | 'special' | 'unclassified';

export interface MedRule { keywords: string[]; action: PeriOpAction; drugClass: string; instruction: string; }
export interface ClassifiedMed { raw: string; drugClass: string; action: PeriOpAction; instruction: string; }

export const ACTION_META: Record<PeriOpAction, { label: string; color: string; bg: string; border: string }> = {
  continue:    { label: 'Continue',               color: '#166534', bg: '#f0fdf4', border: '#86efac' },
  hold_day:    { label: 'Hold on day of surgery', color: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
  hold_before: { label: 'Hold before surgery',    color: '#9a3412', bg: '#fff7ed', border: '#fdba74' },
  bridge:      { label: 'Bridge / special anticoagulation review', color: '#991b1b', bg: '#fef2f2', border: '#fca5a5' },
  special:     { label: 'Special perioperative instructions',      color: '#1e3a8a', bg: '#eff6ff', border: '#93c5fd' },
  unclassified:{ label: 'Unclassified — manual review',           color: '#374151', bg: '#f9fafb', border: '#d1d5db' },
};

export const ACTION_ORDER: PeriOpAction[] = ['continue', 'hold_day', 'hold_before', 'bridge', 'special', 'unclassified'];

export const MED_RULES: MedRule[] = [
  // Continue
  { keywords: ['bisoprolol','metoprolol','atenolol','carvedilol','labetalol','propranolol','nebivolol'], action: 'continue', drugClass: 'Beta-blocker', instruction: 'Continue — take on morning of surgery. Abrupt withdrawal risks rebound hypertension and perioperative cardiac events. Inform anaesthetist.' },
  { keywords: ['amlodipine','nifedipine','felodipine','diltiazem','verapamil'], action: 'continue', drugClass: 'Calcium channel blocker', instruction: 'Continue — take on morning of surgery with a sip of water.' },
  { keywords: ['atorvastatin','simvastatin','rosuvastatin','pravastatin','fluvastatin','pitavastatin'], action: 'continue', drugClass: 'Statin', instruction: 'Continue — perioperative statins are cardioprotective; continuing reduces major cardiac events.' },
  { keywords: ['levothyroxine','liothyronine','thyroxine'], action: 'continue', drugClass: 'Thyroid hormone', instruction: 'Continue — long half-life means missing one dose is safe, but continue for consistency. Take with sip of water.' },
  { keywords: ['salbutamol','salmeterol','budesonide','beclomethasone','fluticasone','tiotropium','ipratropium','formoterol','ciclesonide','umeclidinium'], action: 'continue', drugClass: 'Inhaler / bronchodilator', instruction: 'Continue — essential for perioperative airway management. Use inhalers on morning of surgery as prescribed. Inform anaesthetist of baseline respiratory status.' },
  { keywords: ['omeprazole','lansoprazole','pantoprazole','esomeprazole','rabeprazole'], action: 'continue', drugClass: 'Proton pump inhibitor', instruction: 'Continue — important perioperatively to reduce aspiration risk and stress-related mucosal disease.' },
  { keywords: ['valproate','lamotrigine','levetiracetam','carbamazepine','phenytoin','topiramate','phenobarbital'], action: 'continue', drugClass: 'Antiepileptic', instruction: 'Continue — NEVER stop without specialist advice. Seizure risk is life-threatening. Take on morning of surgery; if NBM >12 h, arrange IV equivalent. Inform anaesthetist.' },
  { keywords: ['hydroxychloroquine','chloroquine'], action: 'continue', drugClass: 'Antimalarial / DMARD', instruction: 'Continue — no adverse perioperative effects. Evidence supports continuation perioperatively for RA and lupus.' },
  { keywords: ['cetirizine','loratadine','fexofenadine','chlorphenamine','promethazine'], action: 'continue', drugClass: 'Antihistamine', instruction: 'Continue. Sedating antihistamines (promethazine, chlorphenamine) potentiate anaesthetic sedation — inform anaesthetist.' },
  { keywords: ['alendronate','risedronate','zoledronic','denosumab','ibandronate'], action: 'continue', drugClass: 'Bone-modifying agent', instruction: 'Continue. No clinically relevant perioperative interaction. Document if jaw osteonecrosis risk exists.' },
  { keywords: ['digoxin'], action: 'continue', drugClass: 'Digoxin', instruction: 'Continue with caution. Check digoxin level and electrolytes (K⁺, Mg²⁺) pre-operatively. Hypo-kalaemia increases digoxin toxicity risk; treat any electrolyte abnormality before surgery.' },

  // Hold on day of surgery
  { keywords: ['lisinopril','ramipril','perindopril','captopril','enalapril','fosinopril','quinapril','trandolapril','cilazapril'], action: 'hold_day', drugClass: 'ACE inhibitor', instruction: 'Hold on morning of surgery — risk of refractory intraoperative hypotension (vasodilation under anaesthesia). Restart post-operatively when haemodynamically stable (usually day 2–3, tolerating oral intake).' },
  { keywords: ['losartan','valsartan','candesartan','irbesartan','olmesartan','telmisartan','eprosartan','azilsartan'], action: 'hold_day', drugClass: 'ARB (angiotensin receptor blocker)', instruction: 'Hold on morning of surgery — same mechanism as ACEi, similar hypotension risk. Restart when haemodynamically stable post-operatively.' },
  { keywords: ['furosemide','bumetanide','bendroflumethiazide','hydrochlorothiazide','indapamide','chlorthalidone'], action: 'hold_day', drugClass: 'Diuretic (thiazide / loop)', instruction: 'Hold on morning of surgery — risk of volume depletion and electrolyte disturbance. Check K⁺ pre-operatively. Restart when normovolaemic and tolerating oral intake.' },
  { keywords: ['spironolactone','eplerenone'], action: 'hold_day', drugClass: 'Aldosterone antagonist', instruction: 'Hold on day of surgery — hyperkalaemia risk perioperatively. Check K⁺ pre-operatively. Restart when electrolytes stable and patient tolerating diet.' },
  { keywords: ['metformin','glucophage','diaformin'], action: 'hold_day', drugClass: 'Biguanide (metformin)', instruction: 'Hold 24–48 h pre-operatively and on day of surgery — risk of lactic acidosis with dehydration or IV contrast. Restart when eating normally and eGFR confirmed adequate (typically 48 h post-op for major surgery; earlier for day cases).' },
  { keywords: ['gliclazide','glipizide','glimepiride','glibenclamide','tolbutamide'], action: 'hold_day', drugClass: 'Sulphonylurea', instruction: 'Hold on day of surgery — hypoglycaemia risk while nil by mouth. Monitor capillary blood glucose ≥1-hourly perioperatively (target 6–10 mmol/L). Resume when eating normally.' },
  { keywords: ['sitagliptin','saxagliptin','alogliptin','linagliptin','vildagliptin'], action: 'hold_day', drugClass: 'DPP-4 inhibitor (gliptin)', instruction: 'Hold on day of surgery — risk of hypoglycaemia if nil by mouth, though lower than sulphonylureas. Restart when tolerating diet.' },

  // Hold before surgery
  { keywords: ['ibuprofen','diclofenac','naproxen','indomethacin','ketoprofen','mefenamic','piroxicam','meloxicam'], action: 'hold_before', drugClass: 'Non-selective NSAID', instruction: 'Hold at least 48 h pre-operatively — non-selective NSAIDs impair platelet function for up to 3 days. Monitor renal function post-op before restarting (AKI risk in surgical patients).' },
  { keywords: ['celecoxib','etoricoxib','parecoxib'], action: 'hold_before', drugClass: 'COX-2 inhibitor (selective NSAID)', instruction: 'COX-2 inhibitors do NOT inhibit platelet function and can be continued pre-operatively. May be used for pre-emptive analgesia. Discuss cardiovascular risk and anastomotic healing risk with surgeon.' },
  { keywords: ['aspirin'], action: 'hold_before', drugClass: 'Aspirin (antiplatelet)', instruction: 'Secondary prevention: CONTINUE for most surgery — cardiovascular benefit outweighs bleeding risk (laparoscopic, endoscopy, GI, hepatobiliary, colorectal). Hold (7–10 days) ONLY for neurosurgery, posterior segment eye surgery, or surgeon-specified high-bleeding-risk operations. Confirm with surgeon.' },
  { keywords: ['garlic','ginkgo','ginseng','kava','st john','fish oil','omega-3','evening primrose','saw palmetto','echinacea','valerian'], action: 'hold_before', drugClass: 'Herbal supplement', instruction: 'Hold at least 2 weeks before surgery — bleeding risk (garlic, ginkgo, fish oil), hypoglycaemia (ginseng), sedation augmentation (kava, valerian), serotonin syndrome risk (St John\'s wort). Document which herbals the patient uses.' },

  // Bridge required
  { keywords: ['warfarin','acenocoumarol','phenindione'], action: 'bridge', drugClass: 'Vitamin K antagonist (VKA / warfarin)', instruction: 'Hold warfarin 5 days pre-operatively. Check INR on day of surgery (target <1.5; <1.2 for neuraxial or neurosurgery). Bridge with LMWH if high thromboembolic risk (mechanical prosthetic valve, AF CHA₂DS₂-VASc ≥4, VTE within 3 months) — discuss with haematologist. If INR still elevated day of surgery: vitamin K 2.5–5 mg PO. Restart warfarin on evening of surgery once haemostasis secured.' },
  { keywords: ['rivaroxaban','apixaban','edoxaban'], action: 'bridge', drugClass: 'DOAC — factor Xa inhibitor (rivaroxaban / apixaban / edoxaban)', instruction: 'Hold 24 h pre-op (low-risk bleeding); hold 48 h (high-risk bleeding or neuraxial anaesthesia). NO bridging therapy — this would increase bleeding without preventing thrombosis. Restart 24 h post-op (low-risk) or 48–72 h (major surgery). Check renal function and dose-adjust if CrCl <50.' },
  { keywords: ['dabigatran'], action: 'bridge', drugClass: 'DOAC — direct thrombin inhibitor (dabigatran)', instruction: 'Hold 24–48 h if CrCl ≥50; hold 48–72 h if CrCl 30–50; avoid surgery if CrCl <30. No bridging needed. Restart 24–48 h post-op. Idarucizumab (Praxbind) is the reversal agent for emergency. Check renal function pre-operatively.' },
  { keywords: ['clopidogrel'], action: 'bridge', drugClass: 'P2Y12 antiplatelet — clopidogrel', instruction: 'Hold 5–7 days before elective surgery. Recent coronary stent (<6 weeks bare-metal; <12 months drug-eluting): cardiology review MANDATORY before stopping — stent thrombosis is life-threatening. Aspirin usually continued. Bridge not routinely used (no proven benefit, increased bleeding).' },
  { keywords: ['ticagrelor'], action: 'bridge', drugClass: 'P2Y12 antiplatelet — ticagrelor', instruction: 'Hold 5 days before surgery. Recent DES <12 months: cardiology review mandatory. Aspirin continue. No bridging. Platelet transfusion effective if emergency reversal needed (ticagrelor is plasma-bound, not platelet-irreversible).' },
  { keywords: ['prasugrel'], action: 'bridge', drugClass: 'P2Y12 antiplatelet — prasugrel', instruction: 'Hold 7 days before surgery. Highest bleeding risk of P2Y12 agents. Recent DES: cardiology review mandatory. No bridging. Emergency: platelet transfusion.' },
  { keywords: ['dipyridamole'], action: 'bridge', drugClass: 'Dipyridamole', instruction: 'Hold 24–48 h pre-operatively. If prescribed as Aggrenox (aspirin + dipyridamole): aspirin may continue; discuss dipyridamole timing with cardiologist.' },
  { keywords: ['enoxaparin','dalteparin','tinzaparin','nadroparin'], action: 'bridge', drugClass: 'Low molecular weight heparin (LMWH)', instruction: 'Therapeutic LMWH: hold last dose 24 h before surgery. Prophylactic dose: hold 12 h before. Restart prophylactic dose 6–12 h post-op once haemostasis secured; restart therapeutic dose 48–72 h post-op. Anti-Xa monitoring may be needed in renal impairment or extremes of weight.' },

  // Special
  { keywords: ['prednisolone','dexamethasone','hydrocortisone','methylprednisolone','prednisone','betamethasone','fludrocortisone','triamcinolone'], action: 'special', drugClass: 'Systemic corticosteroid', instruction: 'Continue on day of surgery. Assess HPA axis suppression: prednisolone ≥10 mg/day for ≥3 weeks = likely suppressed. If suppressed: stress dosing — hydrocortisone 25 mg IV at induction (minor surgery); 50–100 mg IV at induction + 25 mg Q8H for 24–48 h (major surgery). Inform anaesthetist. Monitor for poor wound healing and sepsis post-op.' },
  { keywords: ['insulin','glargine','detemir','degludec','lispro','aspart','glulisine','mixtard','humalog','novomix','novorapid','actrapid','humulin'], action: 'special', drugClass: 'Insulin', instruction: 'Reduce long-acting (basal) insulin by 20–50% on night before and morning of surgery. Hold rapid-acting (mealtime) insulin while nil by mouth. Target perioperative CBG 6–10 mmol/L; monitor 1–2 hourly. CBG >12: commence variable rate insulin infusion (VRIII). Inform anaesthetist — highest perioperative risk among antidiabetics.' },
  { keywords: ['liraglutide','semaglutide','dulaglutide','exenatide','albiglutide'], action: 'special', drugClass: 'GLP-1 receptor agonist', instruction: 'Hold on day of surgery — delayed gastric emptying increases aspiration risk under general anaesthesia. Extended fasting protocol may be required (solids 8 h; clear fluids 6 h); discuss with anaesthetist. Restart when tolerating oral diet post-operatively.' },
  { keywords: ['lithium','priadel','camcolit'], action: 'special', drugClass: 'Lithium', instruction: 'Continue cautiously. Check lithium level and electrolytes pre-operatively. Dehydration raises lithium levels → toxicity. Avoid NSAIDs and ACEi (both raise lithium levels). IV fluids: use 0.9% NaCl (not Hartmann\'s/lactated Ringer\'s). Neuromuscular blockade prolonged by lithium — inform anaesthetist.' },
  { keywords: ['sertraline','fluoxetine','paroxetine','citalopram','escitalopram','fluvoxamine'], action: 'special', drugClass: 'SSRI antidepressant', instruction: 'Continue — abrupt withdrawal causes discontinuation syndrome. Increased bleeding risk (platelet serotonin depletion) — inform surgeon for high-risk operations. Serotonin syndrome risk with tramadol, pethidine, fentanyl (high-dose), linezolid — inform anaesthetist. Do NOT co-prescribe tramadol unless benefit outweighs risk.' },
  { keywords: ['venlafaxine','duloxetine','desvenlafaxine'], action: 'special', drugClass: 'SNRI antidepressant', instruction: 'Continue — venlafaxine has very short half-life; even one missed dose causes discontinuation symptoms (dizziness, "electric shocks"). Serotonin syndrome risk as for SSRIs. Inform anaesthetist. Increased bleeding risk.' },
  { keywords: ['mirtazapine'], action: 'special', drugClass: 'Mirtazapine (NaSSA)', instruction: 'Continue. Useful sedating antiemetic property perioperatively. No serotonin syndrome risk (NaSSA mechanism). Potentiates sedation of anaesthetic agents — inform anaesthetist of dose.' },
  { keywords: ['phenelzine','tranylcypromine','isocarboxazid','selegiline'], action: 'special', drugClass: 'MAOI antidepressant', instruction: '⚠ CRITICAL: Hold MAOIs at least 2 weeks before any elective surgery — severe interactions with sympathomimetics (ephedrine → hypertensive crisis), pethidine/meperidine (hyperpyrexia, convulsions), indirect vasopressors. Discuss urgently with psychiatrist and anaesthetist. If emergency surgery: anaesthetist must be briefed.' },
  { keywords: ['clozapine'], action: 'special', drugClass: 'Clozapine (antipsychotic)', instruction: 'Continue — abrupt discontinuation causes rapid psychotic relapse. Risk of paralytic ileus and constipation perioperatively. Ciprofloxacin raises clozapine levels 3-fold — avoid or use alternative antibiotic. Brief psychiatry and anaesthetist. FBC monitoring: clozapine-induced agranulocytosis increases infection risk.' },
  { keywords: ['methotrexate'], action: 'special', drugClass: 'Methotrexate (DMARD)', instruction: 'For elective surgery: discuss with rheumatologist. Most guidelines support continuing for minor surgery (infection risk minimal). For major surgery: some centres hold 1–2 weeks. Post-op: check FBC and renal function — AKI markedly increases methotrexate toxicity. Wound healing may be impaired.' },
  { keywords: ['azathioprine','mycophenolate','tacrolimus','cyclosporine','ciclosporin'], action: 'special', drugClass: 'Transplant immunosuppressant', instruction: 'Continue — stopping risks acute graft rejection. Discuss any dose adjustment with the transplant centre. Increased infection risk — wound care and aseptic technique are critical. Nephrotoxic agents (tacrolimus, cyclosporine) + aminoglycosides or NSAIDs → acute renal failure risk. Monitor renal function post-op.' },
];

export function extractDrugName(med: string): string {
  return med
    .replace(/\s+\d[\d.]*\s*(?:mg|mcg|µg|g|ml|mL|IU|units?|%).*$/i, '')
    .replace(/\s+(?:tablet|capsule|solution|injection|syrup|cream|gel|patch|spray|inhaler|drops?)s?\b.*/i, '')
    .replace(/\s+(?:OD|BD|TDS|QDS|PRN|STAT|SR|MR|XR|XL|ER|LA|CR|DR)\b.*/i, '')
    .trim()
    .toLowerCase();
}

export function parseDrugs(meds: string[], medText: string): string[] {
  const fromText = medText.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  return [...meds, ...fromText].filter(Boolean);
}

export function classifyMed(raw: string): ClassifiedMed {
  const name = extractDrugName(raw);
  const rule = MED_RULES.find(r => r.keywords.some(k => name.includes(k)));
  if (!rule) {
    return { raw, drugClass: 'Unclassified', action: 'unclassified', instruction: 'This medication was not automatically classified. Review perioperative management with the prescribing physician or anaesthetist.' };
  }
  return { raw, drugClass: rule.drugClass, action: rule.action, instruction: rule.instruction };
}

export function hasPenAllergyFlag(allergies: string): boolean {
  const l = allergies.toLowerCase();
  return ['penicillin','amoxicillin','co-amoxiclav','ampicillin','beta-lactam','cephalosporin','piperacillin','flucloxacillin','dicloxacillin'].some(k => l.includes(k));
}
