import { useState, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import CollapsibleCard from '@/components/CollapsibleCard';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AbxFirstChoice { agent: string; dose: string; route: string; timing: string; }
interface AbxAllergyAlt { agent: string; dose: string; route: string; }
interface AbxRec {
  firstChoice: AbxFirstChoice;
  redosing?: string;
  duration: string;
  allergyAlt: AbxAllergyAlt;
  evidence: string;
  notes?: string;
}
interface ProcedureEntry { id: string; group: string; label: string; rec: AbxRec; }

type PeriOpAction = 'continue' | 'hold_day' | 'hold_before' | 'bridge' | 'special' | 'unclassified';
interface MedRule { keywords: string[]; action: PeriOpAction; drugClass: string; instruction: string; }
interface ClassifiedMed { raw: string; drugClass: string; action: PeriOpAction; instruction: string; }

// ── Antibiotic prophylaxis data ───────────────────────────────────────────────

const PROCEDURES: ProcedureEntry[] = [
  {
    id: 'ercp_therapeutic', group: 'Endoscopy', label: 'ERCP (therapeutic / biliary obstruction)',
    rec: {
      firstChoice: { agent: 'Ciprofloxacin 400 mg IV', dose: '400 mg single dose', route: 'IV over 60 min', timing: 'At induction or 30–60 min before procedure' },
      duration: 'Single dose; extend to 5-day oral course if biliary drainage is incomplete',
      allergyAlt: { agent: 'Gentamicin 5 mg/kg IBW IV', dose: '5 mg/kg ideal body weight', route: 'IV over 30 min' },
      evidence: 'BSG Antibiotic Prophylaxis in GI Endoscopy (2021); ASGE Guidelines 2015',
      notes: 'Indications: biliary obstruction, cholangitis, PSC, liver transplant, incomplete drainage anticipated. NOT required for diagnostic ERCP with patent bile ducts. If drainage unexpectedly incomplete intra-procedure, commence ciprofloxacin immediately. Check local ciprofloxacin resistance patterns.',
    },
  },
  {
    id: 'ercp_diagnostic', group: 'Endoscopy', label: 'ERCP (diagnostic, unobstructed ducts)',
    rec: {
      firstChoice: { agent: 'No routine prophylaxis', dose: '—', route: '—', timing: '—' },
      duration: 'Not indicated',
      allergyAlt: { agent: 'Not applicable', dose: '—', route: '—' },
      evidence: 'BSG Antibiotic Prophylaxis in GI Endoscopy (2021)',
      notes: 'Routine antibiotic prophylaxis is NOT recommended for diagnostic ERCP when complete biliary drainage is expected. If incomplete drainage occurs, commence ciprofloxacin 400 mg IV immediately and continue orally.',
    },
  },
  {
    id: 'ogd', group: 'Endoscopy', label: 'OGD (diagnostic or therapeutic)',
    rec: {
      firstChoice: { agent: 'No routine prophylaxis', dose: '—', route: '—', timing: '—' },
      duration: 'Not routinely indicated',
      allergyAlt: { agent: 'Not applicable', dose: '—', route: '—' },
      evidence: 'BSG 2021; ESGE 2021',
      notes: 'Exceptions: PEG/PEJ insertion — cefazolin 1 g IV or co-amoxiclav 1.2 g IV (30–60 min before). Band ligation for oesophageal varices in cirrhosis — ciprofloxacin 400 mg IV (reduces SBP risk). Prosthetic valve + previous endocarditis: consult cardiology.',
    },
  },
  {
    id: 'colonoscopy', group: 'Endoscopy', label: 'Colonoscopy (diagnostic / polypectomy)',
    rec: {
      firstChoice: { agent: 'No routine prophylaxis', dose: '—', route: '—', timing: '—' },
      duration: 'Not routinely indicated',
      allergyAlt: { agent: 'Not applicable', dose: '—', route: '—' },
      evidence: 'BSG 2021; ESGE 2021',
      notes: 'High-quality polypectomy requires no antibiotic cover in immunocompetent patients. Consider for severely immunocompromised patients or if high-risk valvular heart disease with previous endocarditis (consult cardiology).',
    },
  },
  {
    id: 'lap_chole', group: 'Hepatobiliary', label: 'Laparoscopic cholecystectomy',
    rec: {
      firstChoice: { agent: 'Cefazolin', dose: '≤80 kg: 1 g | >80 kg: 2 g', route: 'IV slow bolus over 3–5 min', timing: '30–60 min before skin incision' },
      redosing: 'Repeat 2 g if operation >4 h or blood loss >1.5 L',
      duration: 'Single dose',
      allergyAlt: { agent: 'Clindamycin 600 mg IV + Gentamicin 3 mg/kg IBW IV', dose: 'As stated', route: 'IV (clindamycin over 20 min)' },
      evidence: 'SIGN 104 (2014); ASHP Therapeutic Guidelines 2013; WHO SSI Prevention Guidelines 2016',
      notes: 'For acute cholecystitis converted to open: treat as therapeutic antibiotics (co-amoxiclav 1.2 g IV TDS or cefuroxime + metronidazole), not prophylaxis.',
    },
  },
  {
    id: 'open_chole', group: 'Hepatobiliary', label: 'Open cholecystectomy / bile duct exploration',
    rec: {
      firstChoice: { agent: 'Cefazolin + Metronidazole', dose: 'Cefazolin ≤80 kg 1 g / >80 kg 2 g; Metronidazole 500 mg', route: 'IV', timing: '30–60 min before incision' },
      redosing: 'Cefazolin: repeat at 4 h intervals; Metronidazole: not routinely redosed',
      duration: 'Single dose; extend to 24 h only if gross contamination found',
      allergyAlt: { agent: 'Clindamycin 600 mg IV + Gentamicin 5 mg/kg IBW IV', dose: 'As stated', route: 'IV' },
      evidence: 'SIGN 104; ASHP 2013',
    },
  },
  {
    id: 'splenectomy', group: 'Hepatobiliary', label: 'Splenectomy',
    rec: {
      firstChoice: { agent: 'Cefazolin', dose: '≤80 kg: 1 g | >80 kg: 2 g', route: 'IV', timing: '30–60 min before incision' },
      duration: 'Single dose perioperative; PLUS lifelong post-splenectomy prophylaxis',
      allergyAlt: { agent: 'Clindamycin 600 mg IV', dose: '600 mg', route: 'IV over 20 min' },
      evidence: 'SIGN 104; BCSH Haematology Guidelines 2011',
      notes: '⚠ CRITICAL — post-splenectomy: (1) Update vaccinations pre-op if possible: Pneumococcal (PCV13 + PPV23), MenACWY, Hib. If emergency: vaccinate ≥14 days post-op. (2) Lifelong prophylaxis: amoxicillin 250 mg OD or phenoxymethylpenicillin 250 mg BD. (3) Provide OPSI alert card and instruct patient on fever protocol (any fever = present to ED immediately).',
    },
  },
  {
    id: 'appendicectomy', group: 'Colorectal', label: 'Appendicectomy',
    rec: {
      firstChoice: { agent: 'Co-amoxiclav 1.2 g IV', dose: '1.2 g single dose', route: 'IV over 3–4 min', timing: '30–60 min before incision' },
      duration: 'Single dose (non-perforated). Perforated / gangrenous: therapeutic 5-day course',
      allergyAlt: { agent: 'Clindamycin 600 mg IV + Gentamicin 5 mg/kg IBW IV', dose: 'As stated', route: 'IV' },
      evidence: 'SIGN 104; Cochrane Review (2012); NHS England SSI Collaborative',
      notes: 'If perforation or gangrene found intra-operatively: convert immediately to therapeutic antibiotics. Culture peritoneal fluid. Do NOT limit to prophylaxis duration.',
    },
  },
  {
    id: 'colorectal_resection', group: 'Colorectal', label: 'Colorectal resection (elective or emergency)',
    rec: {
      firstChoice: { agent: 'Cefuroxime 1.5 g IV + Metronidazole 500 mg IV', dose: 'Cef 1.5 g; Metro 500 mg', route: 'IV', timing: '30–60 min before incision' },
      redosing: 'Cefuroxime: repeat at 3–4 h intervals for prolonged operations. Metronidazole: not routinely redosed.',
      duration: 'Single dose (max 24 h for contaminated field)',
      allergyAlt: { agent: 'Clindamycin 600 mg IV + Gentamicin 5 mg/kg IBW IV', dose: 'As stated', route: 'IV' },
      evidence: 'SIGN 104; NHS England SSI Collaborative 2020; WHO SSI Prevention Guidelines 2016',
      notes: 'ERAS: oral bowel preparation (polyethylene glycol) combined with oral antibiotics (neomycin + metronidazole) the evening before further reduces SSI — discuss with anaesthetic / ERAS team.',
    },
  },
  {
    id: 'stoma_reversal', group: 'Colorectal', label: 'Stoma reversal / Hartmann\'s reversal',
    rec: {
      firstChoice: { agent: 'Cefuroxime 1.5 g IV + Metronidazole 500 mg IV', dose: 'As stated', route: 'IV', timing: '30–60 min before incision' },
      duration: 'Single dose',
      allergyAlt: { agent: 'Clindamycin 600 mg IV + Gentamicin 5 mg/kg IBW IV', dose: 'As stated', route: 'IV' },
      evidence: 'SIGN 104',
    },
  },
  {
    id: 'hernia_inguinal', group: 'Hernia', label: 'Inguinal / femoral hernia repair (mesh)',
    rec: {
      firstChoice: { agent: 'Cefazolin', dose: '≤80 kg: 1 g | >80 kg: 2 g', route: 'IV', timing: '30–60 min before incision' },
      duration: 'Single dose',
      allergyAlt: { agent: 'Clindamycin 600 mg IV', dose: '600 mg', route: 'IV over 20 min' },
      evidence: 'Cochrane Review — antibiotics for prevention of mesh infection (2017); SIGN 104; EHS Guidelines 2018',
      notes: 'Strongly recommended for all synthetic mesh repairs (Lichtenstein, TEP, TAPP). For tissue repair without mesh: evidence supports no prophylaxis, though many centres administer for uniformity.',
    },
  },
  {
    id: 'hernia_ventral', group: 'Hernia', label: 'Ventral / incisional hernia repair',
    rec: {
      firstChoice: { agent: 'Cefazolin', dose: '≤80 kg: 1 g | >80 kg: 2 g', route: 'IV', timing: '30–60 min before incision' },
      redosing: 'Repeat at 4 h for prolonged cases',
      duration: 'Single dose',
      allergyAlt: { agent: 'Clindamycin 600 mg IV + Gentamicin 3 mg/kg IBW IV', dose: 'As stated', route: 'IV' },
      evidence: 'SIGN 104; ASHP 2013',
      notes: 'Contaminated or infected fields: Altemeier Class III/IV — treat as therapeutic antibiotics, not prophylaxis.',
    },
  },
  {
    id: 'upper_gi', group: 'Upper GI', label: 'Upper GI surgery (gastric / oesophageal / bariatric)',
    rec: {
      firstChoice: { agent: 'Cefazolin + Metronidazole', dose: 'Cefazolin ≤80 kg 1 g / >80 kg 2 g; Metronidazole 500 mg', route: 'IV', timing: '30–60 min before incision' },
      redosing: 'Cefazolin: repeat at 4 h intervals',
      duration: 'Single dose (max 24 h)',
      allergyAlt: { agent: 'Clindamycin 600 mg IV + Gentamicin 5 mg/kg IBW IV', dose: 'As stated', route: 'IV' },
      evidence: 'SIGN 104; ASHP 2013; IFSO Bariatric Guidelines',
    },
  },
  {
    id: 'breast', group: 'Breast', label: 'Breast surgery (lumpectomy / mastectomy / implant)',
    rec: {
      firstChoice: { agent: 'Cefazolin', dose: '≤80 kg: 1 g | >80 kg: 2 g', route: 'IV', timing: '30–60 min before incision' },
      duration: 'Single dose',
      allergyAlt: { agent: 'Clindamycin 600 mg IV', dose: '600 mg', route: 'IV over 20 min' },
      evidence: 'SIGN 104; American Society of Breast Surgeons 2017; ASHP 2013',
      notes: 'Strongly recommended for all implant / expander / oncoplastic reconstruction. Evidence for simple wide local excision varies by guideline — most centres administer for uniformity.',
    },
  },
  {
    id: 'thyroid', group: 'Endocrine', label: 'Thyroid / parathyroid surgery',
    rec: {
      firstChoice: { agent: 'Cefazolin', dose: '≤80 kg: 1 g | >80 kg: 2 g', route: 'IV', timing: '30–60 min before incision' },
      duration: 'Single dose',
      allergyAlt: { agent: 'Clindamycin 600 mg IV', dose: '600 mg', route: 'IV over 20 min' },
      evidence: 'ASHP 2013; Meta-analysis: Ramirez et al. — head/neck endocrine surgery',
      notes: 'Clean surgery: evidence for uncomplicated thyroidectomy is mixed. Local policy varies. Consider if re-operative neck surgery, concurrent tracheostomy, immunosuppression, or patient risk factors for SSI.',
    },
  },
  {
    id: 'laparotomy', group: 'General', label: 'Exploratory laparotomy',
    rec: {
      firstChoice: { agent: 'Cefazolin + Metronidazole', dose: 'Cefazolin ≤80 kg 1 g / >80 kg 2 g; Metronidazole 500 mg', route: 'IV', timing: '30–60 min before incision' },
      redosing: 'Cefazolin: repeat at 4 h intervals',
      duration: 'Single dose; extend to 24 h if contaminated; therapeutic course if infected (Altemeier Class III/IV)',
      allergyAlt: { agent: 'Clindamycin 600 mg IV + Gentamicin 5 mg/kg IBW IV', dose: 'As stated', route: 'IV' },
      evidence: 'SIGN 104; ASHP 2013; Altemeier wound classification guides duration',
      notes: 'Duration by Altemeier class: Clean-contaminated → single dose; Contaminated → 24 h; Dirty/infected → 5-day therapeutic course. Culture intraoperative specimens.',
    },
  },
];

// ── Medication classification rules ──────────────────────────────────────────

const MED_RULES: MedRule[] = [
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractDrugName(med: string): string {
  return med
    .replace(/\s+\d[\d.]*\s*(?:mg|mcg|µg|g|ml|mL|IU|units?|%).*$/i, '')
    .replace(/\s+(?:tablet|capsule|solution|injection|syrup|cream|gel|patch|spray|inhaler|drops?)s?\b.*/i, '')
    .replace(/\s+(?:OD|BD|TDS|QDS|PRN|STAT|SR|MR|XR|XL|ER|LA|CR|DR)\b.*/i, '')
    .trim()
    .toLowerCase();
}

function parseDrugs(meds: string[], medText: string): string[] {
  const fromText = medText.split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  return [...meds, ...fromText].filter(Boolean);
}

function classifyMed(raw: string): ClassifiedMed {
  const name = extractDrugName(raw);
  const rule = MED_RULES.find(r => r.keywords.some(k => name.includes(k)));
  if (!rule) {
    return { raw, drugClass: 'Unclassified', action: 'unclassified', instruction: 'This medication was not automatically classified. Review perioperative management with the prescribing physician or anaesthetist.' };
  }
  return { raw, drugClass: rule.drugClass, action: rule.action, instruction: rule.instruction };
}

function hasPenAllergyFlag(allergies: string): boolean {
  const l = allergies.toLowerCase();
  return ['penicillin','amoxicillin','co-amoxiclav','ampicillin','beta-lactam','cephalosporin','piperacillin','flucloxacillin','dicloxacillin'].some(k => l.includes(k));
}

// ── Pre-op preparation checklist items ───────────────────────────────────────

const PREP_ITEMS: { id: string; text: string; critical?: boolean; group: string }[] = [
  { id: 'id_check',   group: 'Patient Verification', critical: true, text: 'Patient identity confirmed — name, DOB, hospital number, procedure' },
  { id: 'consent',    group: 'Patient Verification', critical: true, text: 'Written informed consent obtained and filed in notes' },
  { id: 'site_mark',  group: 'Patient Verification', text: 'Operative site marked by surgeon (if applicable)' },
  { id: 'allergy',    group: 'Patient Verification', critical: true, text: 'Allergy status documented and communicated to anaesthetic team and nursing staff' },
  { id: 'nbm_solids', group: 'Fasting',             critical: true, text: 'Nil by mouth — solid food for ≥6 h; patient understands (≥8 h if GLP-1 agonist or gastroparesis)' },
  { id: 'nbm_fluids', group: 'Fasting',             text: 'Nil by mouth — clear fluids for ≥2 h before anaesthesia (standard adult)' },
  { id: 'carb_load',  group: 'Fasting',             text: 'ERAS: pre-operative carbohydrate loading drink given 2–3 h before (if no diabetes or gastroparesis)' },
  { id: 'bowel_prep', group: 'Fasting',             text: 'Bowel preparation administered if required for colorectal procedure' },
  { id: 'fbc_coag',   group: 'Investigations',      critical: true, text: 'FBC and coagulation (INR / APTT) reviewed; no uncorrected coagulopathy' },
  { id: 'ue',         group: 'Investigations',      text: 'U&E, creatinine and eGFR reviewed; electrolytes within acceptable range' },
  { id: 'gxm',        group: 'Investigations',      text: 'Blood group and cross-match / group & save completed (if significant blood loss anticipated)' },
  { id: 'ecg',        group: 'Investigations',      text: 'ECG reviewed (age >50 or cardiac history)' },
  { id: 'imaging',    group: 'Investigations',      text: 'Pre-operative imaging available and reviewed by surgeon' },
  { id: 'cbg',        group: 'Investigations',      text: 'Capillary blood glucose checked and within range (if diabetic)' },
  { id: 'vte',        group: 'Risk & Prophylaxis',  critical: true, text: 'VTE risk assessed (Caprini score); thromboprophylaxis (pharmacological + mechanical) ordered as per risk' },
  { id: 'abx',        group: 'Risk & Prophylaxis',  critical: true, text: 'Antibiotic prophylaxis ordered — timing confirmed (30–60 min before skin incision)' },
  { id: 'ponv',       group: 'Risk & Prophylaxis',  text: 'PONV risk assessed (Apfel score); antiemetic prophylaxis plan in place (dexamethasone 8 mg ± ondansetron 4 mg)' },
  { id: 'warming',    group: 'Risk & Prophylaxis',  text: 'Normothermia protocol in place — forced-air warming blanket ordered; IV fluid warmer available' },
  { id: 'escort',     group: 'Patient Logistics',   text: 'Adult escort home arranged (day cases / same-day discharge)' },
  { id: 'postop_inst',group: 'Patient Logistics',   text: 'Post-operative care instructions given to patient and carer (verbal + written)' },
  { id: 'gp_letter',  group: 'Patient Logistics',   text: 'GP / referring provider notified of planned procedure' },
];

const PREP_GROUPS = [...new Set(PREP_ITEMS.map(i => i.group))];

// ── Colour helpers ────────────────────────────────────────────────────────────

const ACTION_META: Record<PeriOpAction, { label: string; color: string; bg: string; border: string }> = {
  continue:    { label: 'Continue',               color: '#166534', bg: '#f0fdf4', border: '#86efac' },
  hold_day:    { label: 'Hold on day of surgery', color: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
  hold_before: { label: 'Hold before surgery',    color: '#9a3412', bg: '#fff7ed', border: '#fdba74' },
  bridge:      { label: 'Bridge / special anticoagulation review', color: '#991b1b', bg: '#fef2f2', border: '#fca5a5' },
  special:     { label: 'Special perioperative instructions',      color: '#1e3a8a', bg: '#eff6ff', border: '#93c5fd' },
  unclassified:{ label: 'Unclassified — manual review',           color: '#374151', bg: '#f9fafb', border: '#d1d5db' },
};

const ACTION_ORDER: PeriOpAction[] = ['continue', 'hold_day', 'hold_before', 'bridge', 'special', 'unclassified'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PerioperativeTab() {
  const ctx = useAppContext();

  // ── Section 1: Antibiotic prophylaxis
  const [selectedProc, setSelectedProc] = useState('');
  const proc = PROCEDURES.find(p => p.id === selectedProc);
  const penAllergy = hasPenAllergyFlag(ctx.allergies);
  const noAbxProc = proc && proc.rec.firstChoice.agent.startsWith('No routine');
  const groups = [...new Set(PROCEDURES.map(p => p.group))];

  // ── Section 2: Medication management
  const allDrugs = useMemo(() => parseDrugs(ctx.medications, ctx.medicationsText), [ctx.medications, ctx.medicationsText]);
  const classified = useMemo<ClassifiedMed[]>(() => allDrugs.map(classifyMed), [allDrugs]);
  const byAction = useMemo<Partial<Record<PeriOpAction, ClassifiedMed[]>>>(() => {
    const map: Partial<Record<PeriOpAction, ClassifiedMed[]>> = {};
    for (const m of classified) {
      (map[m.action] ??= []).push(m);
    }
    return map;
  }, [classified]);

  // ── Section 3: Pre-op checklist
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const toggle = (id: string) => setChecked(c => ({ ...c, [id]: !c[id] }));
  const totalItems = PREP_ITEMS.length;
  const doneItems = PREP_ITEMS.filter(i => checked[i.id]).length;
  const allDone = doneItems === totalItems;

  return (
    <div className="gap-y">

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%)', borderRadius: 10, padding: '16px 20px', color: '#fff' }}>
        <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '0.01em' }}>Perioperative Safety Panel</div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
          Antibiotic prophylaxis · Medication management · Pre-operative preparation — evidence-based, allergy-aware
        </div>
      </div>

      {/* ─── Section 1: Antibiotic Prophylaxis ─────────────────────────────── */}
      <CollapsibleCard title="Surgical Antibiotic Prophylaxis" defaultOpen>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 6 }}>
            Select procedure type
          </label>
          <select
            value={selectedProc}
            onChange={e => setSelectedProc(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: 13, background: '#fff', color: '#1e293b' }}
          >
            <option value="">— Select procedure —</option>
            {groups.map(g => (
              <optgroup key={g} label={g}>
                {PROCEDURES.filter(p => p.group === g).map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Allergy alert banner */}
        {penAllergy && (
          <div style={{ padding: '8px 12px', borderRadius: 7, background: '#fef2f2', border: '1px solid #fca5a5', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⚠</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#991b1b' }}>Penicillin / beta-lactam allergy documented</div>
              <div style={{ fontSize: 11, color: '#991b1b', marginTop: 2 }}>
                First-choice agents below may be contraindicated. Allergy alternative is highlighted.
              </div>
            </div>
          </div>
        )}

        {!proc && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            Select a procedure to see the recommended antibiotic prophylaxis protocol.
          </div>
        )}

        {proc && noAbxProc && (
          <div style={{ padding: '14px 16px', borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac' }}>
            <div style={{ fontWeight: 700, color: '#166534', fontSize: 13, marginBottom: 4 }}>No routine antibiotic prophylaxis required</div>
            <div style={{ fontSize: 12, color: '#166534' }}>{proc.label}</div>
            {proc.rec.notes && (
              <div style={{ marginTop: 8, padding: '8px 10px', background: '#dcfce7', borderRadius: 6, fontSize: 12, color: '#14532d' }}>
                <strong>Clinical note:</strong> {proc.rec.notes}
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>Evidence: {proc.rec.evidence}</div>
          </div>
        )}

        {proc && !noAbxProc && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* First choice */}
            <div style={{ padding: '14px 16px', borderRadius: 8, background: penAllergy ? '#f9fafb' : '#f0fdf4', border: `1px solid ${penAllergy ? '#d1d5db' : '#86efac'}`, opacity: penAllergy ? 0.75 : 1 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: penAllergy ? '#6b7280' : '#166534', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {penAllergy ? 'First Choice (⚠ check allergy)' : 'First Choice'}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 6 }}>{proc.rec.firstChoice.agent}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                {([
                  ['Dose', proc.rec.firstChoice.dose],
                  ['Route', proc.rec.firstChoice.route],
                  ['Timing', proc.rec.firstChoice.timing],
                  ...(proc.rec.redosing ? [['Redosing', proc.rec.redosing]] : []),
                  ['Duration', proc.rec.duration],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} style={{ fontSize: 12 }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>{k}: </span>
                    <span style={{ color: '#1e293b' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Allergy alternative — always shown, highlighted when allergy present */}
            <div style={{ padding: '14px 16px', borderRadius: 8, background: penAllergy ? '#fef2f2' : '#f8fafc', border: `2px solid ${penAllergy ? '#fca5a5' : '#e2e8f0'}` }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: penAllergy ? '#991b1b' : '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {penAllergy ? '✓ Use this: Allergy Alternative' : 'Allergy Alternative'}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: 6 }}>{proc.rec.allergyAlt.agent}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                {[
                  ['Dose', proc.rec.allergyAlt.dose],
                  ['Route', proc.rec.allergyAlt.route],
                  ['Duration', proc.rec.duration],
                ].map(([k, v]) => (
                  <div key={k} style={{ fontSize: 12 }}>
                    <span style={{ color: '#64748b', fontWeight: 600 }}>{k}: </span>
                    <span style={{ color: '#1e293b' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {proc.rec.notes && (
              <div style={{ padding: '10px 12px', borderRadius: 7, background: '#fefce8', border: '1px solid #fde68a', fontSize: 12, color: '#78350f' }}>
                <strong>Clinical note:</strong> {proc.rec.notes}
              </div>
            )}

            {/* Evidence */}
            <div style={{ fontSize: 11, color: '#94a3b8', paddingLeft: 4 }}>
              Evidence: {proc.rec.evidence}
            </div>
          </div>
        )}
      </CollapsibleCard>

      {/* ─── Section 2: Medication Management ──────────────────────────────── */}
      <CollapsibleCard title={`Perioperative Medication Management${allDrugs.length > 0 ? ` — ${allDrugs.length} medication${allDrugs.length !== 1 ? 's' : ''}` : ''}`} defaultOpen>
        {allDrugs.length === 0 ? (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
            No medications recorded. Add medications in the Medications tab to see perioperative guidance.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', paddingLeft: 2 }}>
              Auto-classified from patient medication list. Always verify with the prescribing physician and anaesthetist.
            </div>

            {ACTION_ORDER.map(action => {
              const meds = byAction[action];
              if (!meds || meds.length === 0) return null;
              const meta = ACTION_META[action];
              return (
                <div key={action} style={{ borderRadius: 8, border: `1px solid ${meta.border}`, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 14px', background: meta.bg, borderBottom: `1px solid ${meta.border}` }}>
                    <span style={{ fontWeight: 700, fontSize: 12, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {meta.label}
                    </span>
                  </div>
                  {meds.map((m, idx) => (
                    <div key={idx} style={{ padding: '10px 14px', borderTop: idx > 0 ? `1px solid ${meta.border}` : undefined, background: meta.bg }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{m.raw}</div>
                      <div style={{ fontSize: 11, color: meta.color, fontStyle: 'italic', marginTop: 2 }}>{m.drugClass}</div>
                      <div style={{ fontSize: 12, color: '#374151', marginTop: 5, lineHeight: 1.55 }}>{m.instruction}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleCard>

      {/* ─── Section 3: Pre-operative Preparation ───────────────────────────── */}
      <CollapsibleCard title={`Pre-operative Preparation Checklist — ${doneItems}/${totalItems}`} defaultOpen={false}>
        {/* Progress bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
              {allDone ? '✓ All items complete' : `${totalItems - doneItems} item${totalItems - doneItems !== 1 ? 's' : ''} remaining`}
            </span>
            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{Math.round((doneItems / totalItems) * 100)}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, background: allDone ? '#22c55e' : '#3b82f6', width: `${(doneItems / totalItems) * 100}%`, transition: 'width 200ms ease' }} />
          </div>
        </div>

        {PREP_GROUPS.map(group => {
          const items = PREP_ITEMS.filter(i => i.group === group);
          const groupDone = items.every(i => checked[i.id]);
          return (
            <div key={group} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: groupDone ? '#166534' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                {groupDone ? <span style={{ fontSize: 13 }}>✓</span> : null}
                {group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.map(item => (
                  <label key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '7px 10px', borderRadius: 6, background: checked[item.id] ? '#f0fdf4' : item.critical ? '#fff' : '#fafafa', border: `1px solid ${checked[item.id] ? '#86efac' : item.critical ? '#fde68a' : '#f1f5f9'}` }}>
                    <input
                      type="checkbox"
                      checked={!!checked[item.id]}
                      onChange={() => toggle(item.id)}
                      style={{ marginTop: 1, flexShrink: 0, accentColor: '#16a34a' }}
                    />
                    <span style={{ fontSize: 12.5, color: checked[item.id] ? '#166534' : '#374151', fontWeight: item.critical ? 600 : 400, lineHeight: 1.45 }}>
                      {item.critical && !checked[item.id] && <span style={{ color: '#f59e0b', marginRight: 5 }}>★</span>}
                      {item.text}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}

        {allDone && (
          <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 7, background: '#f0fdf4', border: '1px solid #86efac', fontSize: 13, color: '#166534', fontWeight: 600 }}>
            ✓ Pre-operative preparation complete — patient is ready for the operating theatre.
          </div>
        )}
      </CollapsibleCard>

    </div>
  );
}
