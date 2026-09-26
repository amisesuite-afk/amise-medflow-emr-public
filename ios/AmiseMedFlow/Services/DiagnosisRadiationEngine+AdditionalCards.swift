// DiagnosisRadiationEngine+AdditionalCards.swift
// Cards for diagnoses that had NO radiation card (clinical validation 2026-09: 207 confirmed
// diagnoses in the 397 vignettes reached no card, including every medical, obstetric and
// paediatric emergency). Checked AFTER the original dictionary, so an existing card still wins
// for the diagnoses it already covered. Emergencies outside surgery carry the recognise-and-
// redirect line (911 / OKEU Hospital, St Jude's Hospital or Tapion Hospital).
// Doses appear only where the named guideline states them; under-16s never see them (safety filter).

import Foundation

extension DiagnosisRadiationEngine {

    fileprivate typealias SI = DiagnosisRadiation.SuggestedInvestigation
    private typealias RS = DiagnosisRadiation.ReferralSuggestion

    fileprivate static func extraCard(_ keywords: [String], _ name: String, icd: String, inv: [SI], plan: String,
                                      consent: String? = nil, urgency: String?, redFlags: [String],
                                      followUp: String, ref: String) -> Entry {
        Entry(keywords: keywords, radiation: .init(
            conditionName: name, icd10Primary: icd, investigations: inv, planTemplate: plan,
            billingCodes: [.init(icd10: icd, icdDescription: name, cpt: nil, cptDescription: nil)],
            consentCategory: consent, urgencyNote: urgency, redFlags: redFlags, followUp: followUp,
            guidelineReference: ref))
    }

    static let additionalReferralTable: [String: [DiagnosisRadiation.ReferralSuggestion]] = [
        "Anaphylaxis": [RS(specialty: "Emergency Department", urgency: .emergency, reason: "Observation after anaphylaxis (biphasic reactions)", notes: EmergencyRedirect.text),
                        RS(specialty: "Allergy / Immunology", urgency: .routine, reason: "Specialist allergy clinic referral after anaphylaxis (NICE CG134)", notes: nil)],
        "Sepsis": [RS(specialty: "Emergency Department / Critical Care", urgency: .emergency, reason: "Sepsis with high-risk features — escalation", notes: nil)],
        "Bacterial Meningitis / Meningococcal Disease": [RS(specialty: "Emergency Department", urgency: .emergency, reason: "Suspected bacterial meningitis / meningococcal disease", notes: EmergencyRedirect.text)],
        "Cauda Equina Syndrome": [RS(specialty: "Spinal Surgery (neurosurgery / orthopaedic spinal team)", urgency: .emergency, reason: "Emergency MRI and decompression", notes: nil)],
        "Testicular Torsion": [RS(specialty: "Urology / General Surgery", urgency: .emergency, reason: "Emergency scrotal exploration", notes: "Do not delay for Doppler ultrasound")],
        "Ovarian Torsion": [RS(specialty: "Gynaecology", urgency: .emergency, reason: "Emergency laparoscopy — detorsion, ovary-sparing", notes: nil)],
        "Upper GI Bleeding": [RS(specialty: "Endoscopy / Gastroenterology", urgency: .urgent, reason: "OGD within 24 h (immediately after resuscitation if unstable)", notes: nil)],
        "Lower GI Bleeding": [RS(specialty: "Colorectal Surgery / Gastroenterology", urgency: .urgent, reason: "Colonoscopy on the next available list if major; CT angiography if unstable", notes: nil)],
        "Acute Diverticulitis": [RS(specialty: "General / Colorectal Surgery", urgency: .urgent, reason: "Complicated diverticulitis — drainage or surgery", notes: nil)],
        "Hyperkalaemia": [RS(specialty: "Renal / Nephrology", urgency: .urgent, reason: "Dialysis or refractory hyperkalaemia", notes: nil)],
        "Acute Exacerbation of COPD": [RS(specialty: "Respiratory Medicine", urgency: .urgent, reason: "Hypercapnic respiratory failure — NIV assessment", notes: nil)],
    ]

    static let _additionalEntries: [Entry] = [

        // ── Medical emergencies ─────────────────────────────────────────────────────────────

        extraCard(["anaphylaxis", "anaphylactic"], "Anaphylaxis", icd: "T78.2",
             inv: [SI(name: "Mast cell tryptase: as soon as possible, at 1–2 h and at ≥24 h", category: .blood, rationale: "Supports the diagnosis (Resus Council UK 2021)")],
             plan: """
\(redirectLine)
- IM adrenaline 1:1000 into the anterolateral thigh: adults 500 micrograms (0.5 mg); repeat after 5 minutes if no improvement (Resus Council UK 2021)
- Remove the trigger; call for help; lie flat with legs raised (sit up if breathing is worse)
- High-flow oxygen; IV fluid bolus (crystalloid) if shocked
- Refractory anaphylaxis (no response to 2 IM doses): adrenaline infusion by critical care (Resus Council UK 2021)
- Antihistamine and hydrocortisone are NOT first-line and must never delay adrenaline
- Observe (biphasic reactions); two adrenaline auto-injectors, allergy clinic referral and a written plan on discharge (NICE CG134)
- Record the allergy (drug and reaction) in the allergy list
""", urgency: "Anaphylaxis: IM adrenaline now. \(EmergencyRedirect.text)",
             redFlags: ["Stridor, hoarse voice, wheeze, hypotension, collapse → life-threatening"],
             followUp: "Allergy clinic; adrenaline auto-injector training; allergy recorded.",
             ref: "Resuscitation Council UK Emergency treatment of anaphylaxis (2021); NICE CG134 (2011, updated 2020)"),

        extraCard(["meningococcal", "bacterial meningitis", "meningitis"], "Bacterial Meningitis / Meningococcal Disease", icd: "G00.9",
             inv: [SI(name: "Blood cultures (before antibiotics if no delay)", category: .blood, rationale: "Organism"),
                   SI(name: "Meningococcal PCR, FBC, CRP, glucose, lactate, clotting", category: .blood, rationale: "Diagnosis and severity"),
                   SI(name: "CT head only if focal signs / reduced GCS; lumbar puncture when safe", category: .imaging, rationale: "Do not delay antibiotics for imaging or LP (NICE NG240)")],
             plan: """
\(redirectLine)
- Suspected meningococcal disease outside hospital: IM/IV benzylpenicillin if it will not delay transfer (NICE NG240)
- In hospital: IV ceftriaxone (or cefotaxime) without delay (NICE NG240)
- Add amoxicillin (or ampicillin) for Listeria when age >60, immunocompromised or pregnant (NICE NG240)
- Dexamethasone with or before the first antibiotic dose for suspected bacterial meningitis in adults (NICE NG240) — not in meningococcal septicaemia
- Long-term steroids: steroid cover (hydrocortisone)
- Notify public health (UKHSA/local health authority) — contacts may need prophylaxis
""", urgency: "Suspected bacterial meningitis / meningococcal disease: antibiotics now. \(EmergencyRedirect.text)",
             redFlags: ["Non-blanching rash, shock, reduced GCS → critical care"],
             followUp: "Hearing test and follow-up after bacterial meningitis (NICE NG240).",
             ref: "NICE NG240 (2024) Meningitis (bacterial) and meningococcal disease"),

        extraCard(["hyperkalaemia", "hyperkalemia"], "Hyperkalaemia", icd: "E87.5",
             inv: [SI(name: "12-lead ECG and continuous cardiac monitoring", category: .other, rationale: "Peaked T waves, broad QRS → treat as emergency"),
                   SI(name: "Repeat potassium (non-haemolysed), U&E, venous gas, glucose", category: .blood, rationale: "Confirm; acidosis; baseline glucose"),
                   SI(name: "Urinalysis / urine dipstick", category: .other, rationale: "Intrinsic renal disease")],
             plan: """
\(redirectLine)
- Severe (K⁺ ≥6.5 mmol/L) or ECG changes: IV calcium gluconate 10% 30 mL over 5–10 minutes (or calcium chloride 10% 10 mL) (UK Kidney Association 2023); repeat if ECG changes persist
- Insulin–glucose: 10 units soluble insulin (Actrapid) with 25 g glucose IV; monitor capillary glucose for 12 hours (hypoglycaemia risk) (UKKA 2023)
- Nebulised salbutamol 10–20 mg as adjunct (UKKA 2023)
- Stop / hold potassium-raising drugs: ACE inhibitors, ARBs, spironolactone, trimethoprim, potassium-sparing diuretics, NSAIDs
- Treat the cause (AKI, obstruction); fluid balance
- Dialysis patients / refractory hyperkalaemia: renal team for dialysis
- Elective surgery: defer until potassium is corrected (target <5.5 mmol/L; dialysis the day before for ESRF)
""", urgency: "Hyperkalaemia ≥6.5 mmol/L or ECG changes: emergency treatment. \(EmergencyRedirect.text)",
             redFlags: ["Broad QRS, bradycardia, sine-wave ECG → peri-arrest"],
             followUp: "Repeat potassium at 1, 2, 4, 6 and 24 h (UKKA 2023); medication review.",
             ref: "UK Kidney Association Treatment of acute hyperkalaemia in adults (2023)"),

        extraCard(["hyponatraemia", "hyponatremia"], "Hyponatraemia", icd: "E87.1",
             inv: [SI(name: "Serum and urine osmolality, urine sodium", category: .blood, rationale: "Classify (European guideline 2014)"),
                   SI(name: "Repeat serum sodium (2–4-hourly during treatment)", category: .blood, rationale: "Limit correction"),
                   SI(name: "TSH, 9 am cortisol, glucose", category: .blood, rationale: "Endocrine causes")],
             plan: """
- Severe symptoms (seizure, reduced consciousness, vomiting, cardiorespiratory distress): hypertonic 3% saline 150 mL IV over 20 minutes, recheck sodium, repeat up to twice until +5 mmol/L (European guideline 2014) — critical care
- Limit correction to 10 mmol/L in the first 24 h and 8 mmol/L each day after (overcorrection risks osmotic demyelination)
- Assess volume status first: hypovolaemic (e.g. high-output ileostomy) → volume replacement with 0.9% saline (isotonic); SIADH → fluid restriction; never restrict fluids when hypovolaemic
- Stop causative drugs: thiazides, SSRIs, and hypotonic IV fluids (5% glucose) (European guideline 2014)
""", urgency: "Hyponatraemia with severe symptoms: emergency hypertonic saline.",
             redFlags: ["Seizure or reduced GCS → 3% saline 150 mL bolus", "Rise >10 mmol/L in 24 h → risk of osmotic demyelination"],
             followUp: "Sodium monitoring until stable; medication review.",
             ref: "Spasovski G, et al. European clinical practice guideline on hyponatraemia (2014)"),

        extraCard(["hypercalcaemia", "hypercalcemia"], "Hypercalcaemia", icd: "E83.52",
             inv: [SI(name: "Adjusted calcium, PTH, phosphate, U&E, ALP", category: .blood, rationale: "PTH-dependent vs malignancy"),
                   SI(name: "12-lead ECG", category: .other, rationale: "Short QT, arrhythmia"),
                   SI(name: "Myeloma screen: serum protein electrophoresis, serum free light chains, urine Bence Jones protein", category: .blood, rationale: "Myeloma (lytic lesions, AKI, anaemia)"),
                   SI(name: "PTHrP and CT staging as indicated", category: .blood, rationale: "Malignancy")],
             plan: """
- Severe (≥3.5 mmol/L) or symptomatic: IV fluids — 0.9% saline rehydration; bisphosphonate after rehydration (Society for Endocrinology 2016)
- Stop thiazides, calcium and vitamin D supplements
- Hypercalcaemia of malignancy: oncology; treat the cause
- PTH-dependent: parathyroid surgery referral (NICE NG132)
""", urgency: "Adjusted calcium ≥3.5 mmol/L: same-day admission.",
             redFlags: ["Confusion, arrhythmia, AKI → emergency"],
             followUp: "Calcium monitoring; cause-specific follow-up.",
             ref: "Society for Endocrinology emergency guidance: acute hypercalcaemia (2016); NICE NG132"),

        extraCard(["hypocalcaemia", "hypocalcemia", "hypoparathyroidism"], "Hypocalcaemia (post-thyroidectomy)", icd: "E20.9",
             inv: [SI(name: "Adjusted calcium, magnesium, phosphate, PTH", category: .blood, rationale: "Post-surgical hypoparathyroidism"),
                   SI(name: "12-lead ECG (QTc)", category: .other, rationale: "Prolonged QT, arrhythmia")],
             plan: """
- Severe (adjusted calcium <1.9 mmol/L) or symptomatic (tetany, carpopedal spasm, seizure, arrhythmia): IV calcium gluconate 10% 10–20 mL in 50–100 mL of 5% glucose over 10 minutes, with ECG monitoring, then an infusion (Society for Endocrinology 2016)
- Correct magnesium
- Mild: oral calcium ± activated vitamin D (alfacalcidol) by the endocrine team
""", urgency: "Symptomatic hypocalcaemia: emergency IV calcium.",
             redFlags: ["Laryngospasm, seizure, arrhythmia → emergency"],
             followUp: "Calcium monitoring; endocrine follow-up for hypoparathyroidism.",
             ref: "Society for Endocrinology emergency guidance: acute hypocalcaemia (2016); BAETS"),

        extraCard(["exacerbation of copd", "copd exacerbation", "copd", "chronic obstructive"], "Acute Exacerbation of COPD", icd: "J44.1",
             inv: [SI(name: "Arterial blood gas (ABG)", category: .blood, rationale: "Hypercapnia, acidosis — NIV decision"),
                   SI(name: "CXR, FBC, CRP, U&E, sputum culture if purulent", category: .imaging, rationale: "Pneumonia, pneumothorax"),
                   SI(name: "12-lead ECG", category: .other, rationale: "Arrhythmia")],
             plan: """
- Controlled oxygen: target SpO₂ 88–92% via Venturi mask until blood gas known (BTS 2017 emergency oxygen)
- Nebulised bronchodilators: salbutamol ± ipratropium (driven by air if hypercapnic) (NICE NG115)
- Oral prednisolone 30 mg daily for 5 days (NICE NG115)
- Antibiotic only if sputum is purulent or clinical signs of pneumonia (NICE NG114)
- Non-invasive ventilation (NIV) for persistent hypercapnic respiratory acidosis (pH <7.35, PaCO₂ >6.5 kPa) despite treatment (BTS/ICS 2016)
- Mild exacerbation at home: increase short-acting bronchodilator; steroid / antibiotic per NICE NG115/NG114
""", urgency: "Hypercapnic respiratory failure → NIV.",
             redFlags: ["pH <7.35 with PaCO₂ >6.5 kPa → NIV", "Drowsiness, confusion → CO₂ narcosis — review oxygen"],
             followUp: "Pulmonary rehabilitation; inhaler review; smoking cessation.",
             ref: "BTS emergency oxygen (2017); NICE NG115 (2018, updated 2019); NICE NG114; BTS/ICS NIV (2016)"),

        extraCard(["cauda equina"], "Cauda Equina Syndrome", icd: "G83.4",
             inv: [SI(name: "Emergency MRI lumbosacral spine", category: .imaging, rationale: "Same-day diagnosis and level"),
                   SI(name: "Bladder scan / post-void residual", category: .other, rationale: "Retention (CES-R)")],
             plan: """
\(redirectLine)
- Emergency MRI and same-day referral to the spinal surgical team for decompression (GIRFT 2023 national CES pathway)
- Document perianal sensation, anal tone, lower-limb neurology and post-void residual
- Urinary catheter for retention
""", urgency: "Suspected cauda equina syndrome: emergency MRI. \(EmergencyRedirect.text)",
             redFlags: ["Painless retention, saddle anaesthesia, reduced anal tone → CES-R → decompression"],
             followUp: "Spinal surgical follow-up; bladder/bowel follow-up.",
             ref: "GIRFT National suspected cauda equina syndrome pathway (2023); NICE CKS"),

        extraCard(["testicular torsion", "torsion of testis", "torsion of the testis"], "Testicular Torsion", icd: "N44.00",
             inv: [SI(name: "Doppler ultrasound ONLY if it will not delay exploration", category: .imaging, rationale: "A normal Doppler does not exclude torsion")],
             plan: """
- Emergency scrotal exploration (within 6 h of onset gives the best salvage) — do not delay for imaging (EAU 2024)
- Detorsion and bilateral orchidopexy (fix the contralateral testis); orchidectomy if non-viable
- Analgesia; nil by mouth
""", consent: "Scrotal exploration ± orchidopexy / orchidectomy", urgency: "Testicular torsion: surgical emergency — theatre now.",
             redFlags: ["Onset >6 h → salvage falls — still explore urgently"],
             followUp: "Surgical review 2 weeks.",
             ref: "EAU Guidelines on Paediatric Urology / Urological Trauma (2024)"),

        extraCard(["ovarian torsion", "adnexal torsion"], "Ovarian Torsion", icd: "N83.519",
             inv: [SI(name: "Pregnancy test (hCG)", category: .blood, rationale: "Exclude ectopic pregnancy"),
                   SI(name: "Pelvic / transvaginal ultrasound (transabdominal in children)", category: .imaging, rationale: "Enlarged ovary, mass; Doppler flow can be normal")],
             plan: """
- Emergency laparoscopy by gynaecology (paediatric surgery / gynaecology in children)
- Detorsion with ovarian preservation (ovary-sparing) even if the ovary looks dusky; cystectomy for a dermoid (RCOG)
- Analgesia; nil by mouth
""", consent: "Laparoscopy, detorsion ± cystectomy", urgency: "Ovarian torsion: gynaecological surgical emergency.",
             redFlags: ["Sudden severe unilateral pain with vomiting and an adnexal mass"],
             followUp: "Gynaecology follow-up.",
             ref: "RCOG / BritSPAG guidance on adnexal torsion; ACOG Committee Opinion 783 (2019)"),

        extraCard(["pelvic inflammatory disease", "tubo-ovarian abscess", "pid"], "Pelvic Inflammatory Disease / Tubo-ovarian Abscess", icd: "N70.93",
             inv: [SI(name: "Pregnancy test; NAAT for chlamydia and gonorrhoea; HIV and syphilis", category: .blood, rationale: "BASHH 2019"),
                   SI(name: "Blood cultures, FBC, CRP", category: .blood, rationale: "Sepsis"),
                   SI(name: "Transvaginal ultrasound", category: .imaging, rationale: "Tubo-ovarian abscess")],
             plan: """
- Severe PID / tubo-ovarian abscess / sepsis: admit for IV (parenteral) antibiotics per BASHH 2019 (e.g. IV ceftriaxone + IV doxycycline + metronidazole)
- Drainage of a tubo-ovarian abscess (image-guided or surgical) if not responding
- Outpatient mild–moderate PID: BASHH 2019 regimen; partner notification
""", urgency: "Tubo-ovarian abscess with sepsis: admit.",
             redFlags: ["Peritonitis, sepsis, ruptured abscess → surgery"],
             followUp: "Sexual health follow-up; test of cure where indicated.",
             ref: "BASHH UK national guideline for PID (2019)"),

        extraCard(["hyperemesis gravidarum", "hyperemesis"], "Hyperemesis Gravidarum", icd: "O21.1",
             inv: [SI(name: "U&E, ketones, glucose, TFT, LFT", category: .blood, rationale: "Dehydration, electrolytes"),
                   SI(name: "Pelvic ultrasound", category: .imaging, rationale: "Multiple / molar pregnancy")],
             plan: """
- IV fluids (0.9% sodium chloride with potassium as needed); avoid dextrose-only fluids before thiamine (RCOG GTG 69)
- Thiamine supplementation (Wernicke's prevention) (RCOG GTG 69)
- Antiemetics by the obstetric team (first-line: cyclizine, prochlorperazine, promethazine) (RCOG GTG 69)
- Thromboprophylaxis (LMWH) when admitted (RCOG GTG 69); obstetric team
""", urgency: "Hyperemesis with dehydration/ketosis: admit.",
             redFlags: ["Weight loss >5%, ketonuria, electrolyte disturbance → admission"],
             followUp: "Obstetric follow-up.",
             ref: "RCOG Green-top 69 (2016, updated 2024) Nausea and vomiting of pregnancy and hyperemesis gravidarum"),

        extraCard(["seizure", "epilepsy", "status epilepticus"], "Seizure", icd: "R56.9",
             inv: [SI(name: "Glucose, U&E (sodium, calcium, magnesium), FBC", category: .blood, rationale: "Provoked causes"),
                   SI(name: "12-lead ECG", category: .other, rationale: "Cardiac cause of transient loss of consciousness"),
                   SI(name: "Neuroimaging (CT urgently if head injury, focal signs, anticoagulant; MRI as outpatient)", category: .imaging, rationale: "NICE NG217")],
             plan: """
- Seizure lasting ≥5 minutes: benzodiazepine (buccal midazolam or IV lorazepam) per NICE NG217 / APLS; call 911
- Pregnancy ≥20 weeks or postpartum: treat as eclampsia (magnesium sulfate) until proven otherwise (NICE NG133)
- First unprovoked seizure: 12-lead ECG; urgent referral to a specialist (first seizure clinic / neurologist) within 2 weeks (NICE NG217); driving advice
""", urgency: "Status epilepticus: \(EmergencyRedirect.text)",
             redFlags: ["Seizure ≥5 minutes, not regaining consciousness → status epilepticus"],
             followUp: "First-seizure clinic within 2 weeks; DVLA advice.",
             ref: "NICE NG217 (2022) Epilepsies; NICE NG133"),

        extraCard(["syncope", "collapse"], "Syncope / Transient Loss of Consciousness", icd: "R55",
             inv: [SI(name: "12-lead ECG", category: .other, rationale: "Heart block, long QT, Brugada, pre-excitation (NICE CG109)"),
                   SI(name: "Lying and standing BP, FBC, glucose", category: .blood, rationale: "Orthostatic / bleeding causes"),
                   SI(name: "Echocardiogram if murmur or exertional syncope", category: .imaging, rationale: "Aortic stenosis / cardiomyopathy")],
             plan: """
- 12-lead ECG for everyone with transient loss of consciousness (NICE CG109)
- Red flags → urgent cardiovascular assessment within 24 h: ECG abnormality, heart failure, exertional syncope, family history of sudden death <40, new breathlessness, age >65 without prodrome (NICE CG109)
- Complete heart block / bradycardia: continuous monitoring and pacing — \(EmergencyRedirect.text)
- Uncomplicated reflex (vasovagal) syncope: reassure, explain triggers; no driving restriction for simple faint
""", urgency: nil,
             redFlags: ["Exertional syncope, abnormal ECG, heart block → cardiology within 24 h"],
             followUp: "Cardiology if any red flag.",
             ref: "NICE CG109 (2010, updated 2023) Transient loss of consciousness"),

        extraCard(["delirium"], "Delirium", icd: "F05",
             inv: [SI(name: "4AT assessment", category: .other, rationale: "Screen and document"),
                   SI(name: "FBC, U&E, calcium, glucose, CRP, urinalysis only if symptoms, bladder scan", category: .blood, rationale: "Causes: infection, electrolytes, retention"),
                   SI(name: "Medication review (opioids, anticholinergics, benzodiazepines)", category: .other, rationale: "Drug causes")],
             plan: """
- Find and treat the cause: infection, pain, retention, constipation, hypoxia, electrolytes, drugs (NICE CG103)
- Non-pharmacological measures first: orientation, glasses/hearing aids, sleep, hydration, mobilisation, family
- Antipsychotic only for severe distress or risk, short-term and lowest dose (NICE CG103)
""", urgency: nil,
             redFlags: ["Hypoactive delirium is easily missed — screen with 4AT"],
             followUp: "Cognitive follow-up after discharge.",
             ref: "NICE CG103 (2010, updated 2023) Delirium"),

        // ── Surgical / GI ───────────────────────────────────────────────────────────────────

        extraCard(["upper gi bleed", "upper gastrointestinal bleed", "upper gi haemorrhage", "haematemesis", "melaena", "mallory-weiss",
                   "mallory weiss", "aorto-enteric"], "Upper GI Bleeding", icd: "K92.2",
             inv: [SI(name: "FBC, U&E (urea), LFTs, coagulation screen (INR), crossmatch", category: .blood, rationale: "Glasgow-Blatchford score; anticoagulant reversal"),
                   SI(name: "OGD within 24 h (immediately after resuscitation if unstable)", category: .endoscopy, rationale: "NICE CG141; ESGE 2021"),
                   SI(name: "CT angiography if unstable despite resuscitation or aorto-enteric fistula suspected", category: .imaging, rationale: "Localisation / interventional radiology")],
             plan: """
- Glasgow-Blatchford score: 0–1 → outpatient management may be possible (NICE CG141; ESGE 2021)
- Resuscitate: two large-bore cannulae; restrictive transfusion (Hb threshold 70 g/L, 80 g/L with cardiovascular disease) (ESGE 2021)
- No antifibrinolytic drug (HALT-IT 2020; ESGE 2021)
- Unstable despite resuscitation: critical care (ICU/HDU); failed endoscopic haemostasis → interventional radiology embolisation or surgery (under-running) (ESGE 2021)
- Stop NSAIDs; dual antiplatelet therapy or a coronary stent: cardiology input before stopping the P2Y12 inhibitor (ESGE 2021)
- Suspected aorto-enteric fistula (previous aortic graft / EVAR, herald bleed): CT angiography and the vascular surgery on-call team now; blood cultures (graft infection)
- PPI after endoscopic haemostasis (high-dose); no PPI before endoscopy needed to delay it
- Anticoagulants/antiplatelets: bleeding-specific plan — hold the anticoagulant; reversal if life-threatening (DOAC-specific reversal or prothrombin complex concentrate + vitamin K for warfarin); no LMWH bridging during active bleeding; continue aspirin for secondary prevention (ESGE 2021; BSG/ESGE antithrombotics)
- Suspected variceal bleeding → terlipressin + antibiotics (see variceal pathway)
""", urgency: "Upper GI bleed: resuscitate; endoscopy within 24 h.",
             redFlags: ["Shock, ongoing haematemesis, Hb falling → immediate endoscopy / IR / surgery"],
             followUp: "H. pylori test and eradication; review NSAIDs.",
             ref: "NICE CG141 (2012, updated 2016); ESGE non-variceal UGIH (2021); HALT-IT (Lancet 2020)"),

        extraCard(["lower gi bleed", "lower gastrointestinal bleed", "diverticular haemorrhage", "diverticular bleed", "rectal bleeding",
                   "post-polypectomy bleed", "post-polypectomy bleeding"], "Lower GI Bleeding", icd: "K92.2",
             inv: [SI(name: "FBC, U&E, clotting, crossmatch", category: .blood, rationale: "Oakland score"),
                   SI(name: "CT angiography if haemodynamically unstable (shock index >1)", category: .imaging, rationale: "BSG 2019 — before endoscopy in unstable patients"),
                   SI(name: "Colonoscopy on the next available list (major, stable)", category: .endoscopy, rationale: "BSG 2019")],
             plan: """
- Oakland score ≤8 (and no other indication for admission): discharge for outpatient investigation (BSG 2019)
- Unstable (shock index >1): CT angiography first, then interventional radiology embolisation; OGD if upper source possible (BSG 2019)
- Restrictive transfusion (Hb 70 g/L; 80 g/L with cardiovascular disease)
- Anticoagulants: hold; reverse warfarin with PCC + vitamin K if unstable; DOAC reversal agents for life-threatening bleeding; no bridging during active bleeding (BSG 2019)
- Post-polypectomy bleeding: endoscopic clip therapy
""", urgency: "Unstable lower GI bleed → CT angiography.",
             redFlags: ["Shock index >1 → CT angiography now"],
             followUp: "Colonoscopy if not done; anticoagulant restart plan.",
             ref: "BSG UK guideline on acute lower GI bleeding (Oakland 2019); ACG 2023 LGIB"),

        extraCard(["diverticulitis", "diverticular abscess", "pericolic abscess"], "Acute Diverticulitis", icd: "K57.32",
             inv: [SI(name: "CT abdomen/pelvis with IV contrast", category: .imaging, rationale: "Confirm; complicated (abscess, perforation) — modified Hinchey"),
                   SI(name: "FBC, CRP, U&E, lactate; blood cultures if septic", category: .blood, rationale: "Severity"),
                   SI(name: "Colonoscopy 6–8 weeks after complicated disease", category: .endoscopy, rationale: "Exclude cancer")],
             plan: """
- Uncomplicated (immunocompetent, no sepsis): outpatient, analgesia; antibiotics only selectively (WSES 2020; AGA 2021); review if worse
- Immunosuppressed or systemic signs: admit, IV antibiotics
- Pericolic abscess ≥4–5 cm: IV antibiotics + CT-guided percutaneous drainage (percutaneous drain); smaller: antibiotics (WSES 2020)
- Purulent (Hinchey III) or faecal (Hinchey IV) peritonitis: emergency surgery — Hartmann's or resection with anastomosis ± stoma (WSES 2020)
""", urgency: "Complicated diverticulitis: surgical review.",
             redFlags: ["Generalised peritonitis, free air → emergency surgery"],
             followUp: "Colonoscopy at 6–8 weeks after complicated disease.",
             ref: "WSES 2020 acute left colonic diverticulitis; AGA 2021; ASCRS 2020"),

        extraCard(["boerhaave", "oesophageal perforation", "esophageal perforation"], "Oesophageal Perforation (Boerhaave)", icd: "K22.3",
             inv: [SI(name: "CT chest/abdomen with oral water-soluble contrast", category: .imaging, rationale: "Leak, mediastinitis"),
                   SI(name: "Bloods, lactate, cultures", category: .blood, rationale: "Sepsis"),
                   SI(name: "12-lead ECG and troponin", category: .other, rationale: "Exclude acute coronary syndrome — chest pain")],
             plan: """
- Nil by mouth; IV fluids; broad-spectrum IV antibiotics and antifungal; PPI
- Emergency upper GI / thoracic surgical referral: surgical repair, stent or drainage by the specialist team
- Pleural drainage if effusion/empyema
""", consent: "Oesophageal repair", urgency: "Boerhaave: surgical emergency.",
             redFlags: ["Vomiting then chest pain, surgical emphysema → perforation"],
             followUp: "Upper GI surgical follow-up.",
             ref: "WSES 2019 oesophageal perforation guidance"),

        extraCard(["liver abscess", "hepatic abscess"], "Liver Abscess", icd: "K75.0",
             inv: [SI(name: "Blood cultures, FBC, CRP, LFTs", category: .blood, rationale: "Sepsis; organism"),
                   SI(name: "Ultrasound / CT liver", category: .imaging, rationale: "Size, number, drainability"),
                   SI(name: "Entamoeba histolytica serology", category: .blood, rationale: "Amoebic abscess (travel/endemic)")],
             plan: """
- Pyogenic: IV antibiotics (biliary/enteric cover) + percutaneous drainage of large abscesses; find the source (biliary, colonic)
- Amoebic: metronidazole then a luminal agent (paromomycin/diloxanide); drainage rarely needed
- Septic shock (cholangitic abscesses): resuscitation and critical care (ICU/HDU), biliary decompression (ERCP) and drainage
""", urgency: nil,
             redFlags: ["Septic shock → source control urgently"],
             followUp: "Repeat imaging; colonoscopy if Klebsiella / no biliary source.",
             ref: "BSG / IDSA intra-abdominal infection guidance"),

        extraCard(["neutropenic sepsis", "post-splenectomy infection", "opsi", "urosepsis", "septic shock", "sepsis"], "Sepsis", icd: "A41.9",
             inv: [SI(name: "Blood cultures ×2 before antibiotics", category: .blood, rationale: "Sepsis Six"),
                   SI(name: "Lactate (venous gas)", category: .blood, rationale: "Severity; ≥4 mmol/L = high risk"),
                   SI(name: "FBC (neutrophils), CRP, U&E, LFTs, clotting, glucose", category: .blood, rationale: "Organ dysfunction; neutropenia"),
                   SI(name: "Source: urine culture (catheter specimen after changing a long-term catheter), CXR, imaging of the suspected source", category: .other, rationale: "Source control")],
             plan: """
- Sepsis Six within 1 hour (NICE NG51; Surviving Sepsis Campaign 2021): oxygen to target, blood cultures, IV antibiotics, IV fluids, lactate, urine output
- IV fluids: 500 mL crystalloid bolus over 15 minutes, reassess; up to 30 mL/kg in the first 3 hours for hypotension or lactate ≥4 (SSC 2021)
- IV antibiotics within 1 hour per local guideline and suspected source
- Neutropenic sepsis (neutrophils <0.5 × 10⁹/L): IV piperacillin–tazobactam within 1 hour (NICE CG151)
- Asplenia / post-splenectomy (OPSI): IV ceftriaxone immediately — fulminant course (BCSH/BSH 2011 asplenia guideline)
- Long-term steroids: stress-dose hydrocortisone (steroid cover) (SfE/AAGBI 2020)
- Hold immunosuppressants such as methotrexate during acute infection (specialist advice)
- Source control (drainage, catheter change, surgery); escalate to critical care if lactate ≥4 or hypotension despite fluids
""", urgency: "Sepsis: Sepsis Six within 1 hour; escalate high-risk features.",
             redFlags: ["Systolic ≤90, lactate ≥4, new confusion, NEWS2 ≥7 → critical care review"],
             followUp: "Culture-directed antibiotics; review at 48–72 h (antimicrobial stewardship).",
             ref: "NICE NG51 (2016, updated 2024); Surviving Sepsis Campaign (2021); NICE CG151 (neutropenic sepsis)"),

        extraCard(["abscess", "cutaneous abscess", "skin abscess", "breast abscess"], "Cutaneous Abscess", icd: "L02.91",
             inv: [SI(name: "Pus swab for culture (MRSA risk factors)", category: .pathology, rationale: "Guide antibiotics"),
                   SI(name: "Capillary glucose", category: .blood, rationale: "Undiagnosed diabetes")],
             plan: """
- Incision and drainage is the treatment; antibiotics only with surrounding cellulitis, systemic features or immunosuppression (NICE NG141 / IDSA 2014)
- Groin abscess in a person who injects drugs: exclude a femoral pseudoaneurysm (duplex ultrasound) before incision; offer blood-borne virus testing (HIV, hepatitis B and C)
- MRSA risk (previous MRSA, injecting drug use) with cellulitis or systemic features: MRSA-active antibiotic — doxycycline or co-trimoxazole orally, vancomycin or teicoplanin IV if systemically unwell (IDSA 2014; NICE NG141)
- Breast abscess: ultrasound-guided aspiration first (breast team)
""", consent: "Incision and drainage", urgency: nil,
             redFlags: ["Pain out of proportion / crepitus → necrotising infection"],
             followUp: "Wound review 48 h.",
             ref: "IDSA SSTI (2014); NICE NG141 cellulitis"),

        extraCard(["urinary retention", "acute retention", "clot retention"], "Acute Urinary Retention", icd: "R33.9",
             inv: [SI(name: "Bladder scan", category: .other, rationale: "Residual volume"),
                   SI(name: "U&E / creatinine", category: .blood, rationale: "Obstructive AKI")],
             plan: """
- Urethral catheter (three-way with irrigation for clot retention); record residual volume
- Review precipitating drugs (anticholinergics, antihistamines, decongestants, opioids); alpha-blocker before trial without catheter (EAU)
- Anticoagulated haematuria / clot retention: urology; review anticoagulant with the prescriber
- High-pressure chronic retention with AKI: keep the catheter, monitor for post-obstructive diuresis, urology
""", urgency: nil,
             redFlags: ["Back pain with painless retention → exclude cauda equina"],
             followUp: "Urology follow-up; trial without catheter.",
             ref: "EAU Non-neurogenic male LUTS (2024); NICE CG97"),

        extraCard(["epididymo-orchitis", "epididymitis", "orchitis"], "Epididymo-orchitis", icd: "N45.3",
             inv: [SI(name: "NAAT for chlamydia and gonorrhoea; urine MSU", category: .other, rationale: "Cause (BASHH 2020)")],
             plan: """
- Exclude testicular torsion first — if in doubt, scrotal exploration
- STI-related (under 35 / sexual risk): BASHH 2020 regimen (e.g. ceftriaxone + doxycycline); partner notification
- Enteric organisms (older, urinary tract): per local guideline
""", urgency: nil,
             redFlags: ["Sudden onset, high-riding testis, absent cremasteric reflex → torsion"],
             followUp: "Sexual health follow-up.",
             ref: "BASHH UK national guideline for epididymo-orchitis (2020)"),

        extraCard(["burn", "scald", "tbsa"], "Burns", icd: "T30.0",
             inv: [SI(name: "TBSA estimate (Lund–Browder chart; rule of nines in adults)", category: .other, rationale: "Fluid threshold and referral"),
                   SI(name: "Carboxyhaemoglobin (COHb) if smoke exposure", category: .blood, rationale: "Inhalation injury"),
                   SI(name: "Weight, FBC, U&E, group and save", category: .blood, rationale: "Fluid calculation")],
             plan: """
- Cool the burn (20 minutes of cool running water within 3 h); cover with cling film; keep the patient warm
- Airway: inhalation injury / facial burns → early senior anaesthetic review and early intubation to secure the airway before swelling progresses (ATLS 10); 100% oxygen, COHb
- Formal IV fluid resuscitation from 15% TBSA in adults and 10% in children: Parkland 4 mL/kg/%TBSA over 24 h from the TIME OF BURN, half in the first 8 h — subtract fluid already given and time elapsed (practice default; ATLS 10 starting rates 2 mL/kg/%TBSA adults, 3 mL/kg/%TBSA children as a note; surgeon sign-off pending)
- Urine output target: 0.5 mL/kg/h adults, 1 mL/kg/h children; titrate fluids to it
- Circumferential full-thickness burns: escharotomy
- Chemical burns: copious irrigation, no neutralisation; eye involvement → ophthalmology
- Refer to a burns service (ABA / National Burn Care Referral Guidance): any full-thickness burn, partial thickness >10% adults (>5% children), face, hands, feet, genitalia, perineum, major joints, circumferential, inhalation, electrical, chemical, pregnancy, comorbidity, concomitant trauma, suspected non-accidental injury
- Tetanus status; analgesia
""", urgency: nil,
             redFlags: ["Stridor, hoarse voice, soot in the airway → intubate early",
                        "Glove-and-stocking scalds, delay, inconsistent history → safeguarding"],
             followUp: "Burns service; dressing review 48 h; safeguarding follow-up if concerned.",
             ref: "ATLS 10th ed. (2018); ABA / ISBI burn resuscitation; National Burn Care Referral Guidance (2012)"),

        extraCard(["electrical injury", "high-voltage", "high voltage", "electrocution"], "Electrical Injury", icd: "T75.4",
             inv: [SI(name: "12-lead ECG and cardiac monitoring", category: .other, rationale: "Arrhythmia after high-voltage injury"),
                   SI(name: "CK, U&E, urine myoglobin / dipstick for blood", category: .blood, rationale: "Rhabdomyolysis"),
                   SI(name: "Compartment pressures / clinical checks", category: .other, rationale: "Deep muscle injury")],
             plan: """
- Visible burn size underestimates deep injury: IV fluids and a urine-output target REGARDLESS of visible TBSA — 1–1.5 mL/kg/h when urine is pigmented (myoglobinuria) until it clears (ABA; BBA)
- Continuous cardiac monitoring; CK; renal function
- Check limb compartments; fasciotomy if compartment syndrome
- Refer to a burns centre (all high-voltage injuries)
""", urgency: "High-voltage electrical injury: burns centre referral; IV fluids regardless of visible TBSA.",
             redFlags: ["Dark urine (myoglobinuria), tense compartments, arrhythmia"],
             followUp: "Burns centre follow-up; cataract and neurological follow-up.",
             ref: "American Burn Association practice guidance; British Burn Association"),

        extraCard(["head injury", "traumatic brain injury", "tbi"], "Head Injury", icd: "S06.9",
             inv: [SI(name: "CT head — within 1 h if GCS <13, skull fracture signs, seizure, focal deficit, >1 vomit; within 8 h on anticoagulants (NICE NG232)", category: .imaging, rationale: "Intracranial haemorrhage"),
                   SI(name: "Clotting / INR, time of last anticoagulant dose", category: .blood, rationale: "Reversal decision")],
             plan: """
- ABCDE with cervical spine protection; GCS and pupils every 30 minutes
- CT head per NICE NG232 criteria; anticoagulated patients — CT within 8 hours of the injury (NICE NG232; wording to confirm with the surgeon)
- Intracranial bleed on an anticoagulant: reverse (PCC + vitamin K for warfarin; specific reversal for DOACs); neurosurgical referral
- Head-injury advice sheet and responsible adult on discharge
""", urgency: nil,
             redFlags: ["GCS falling, unequal pupils, seizure → neurosurgery"],
             followUp: "Head-injury advice; review if symptoms persist.",
             ref: "NICE NG232 (2023) Head injury"),

        extraCard(["tension pneumothorax", "haemothorax", "rib fractures"], "Chest Trauma (Tension Pneumothorax / Haemothorax)", icd: "S27.0",
             inv: [SI(name: "CXR / eFAST; CT chest when stable", category: .imaging, rationale: "Pneumothorax, haemothorax"),
                   SI(name: "Crossmatch, clotting (anticoagulants)", category: .blood, rationale: "Haemorrhage")],
             plan: """
- Tension pneumothorax: immediate decompression — adults at the 4th/5th intercostal space just anterior to the mid-axillary line (ATLS 10), then chest drain
- Haemothorax: large-bore chest drain; thoracotomy if massive (>1500 mL initially or ongoing >200 mL/h)
- Rib fractures: analgesia (regional block), physiotherapy; anticoagulated patients — reversal decision if bleeding
""", consent: "Chest drain insertion", urgency: "Tension pneumothorax: immediate decompression.",
             redFlags: ["Hypotension, tracheal deviation, absent breath sounds → decompress now"],
             followUp: "Repeat CXR; respiratory follow-up.",
             ref: "ATLS 10th ed. (2018)"),

        extraCard(["splenic injury", "splenic laceration", "blunt abdominal trauma", "stab wound", "penetrating",
                   "evisceration"], "Abdominal Trauma", icd: "S36.9",
             inv: [SI(name: "eFAST", category: .imaging, rationale: "Free fluid"),
                   SI(name: "CT abdomen/pelvis with IV contrast (only if haemodynamically stable)", category: .imaging, rationale: "Solid-organ grade (AAST)"),
                   SI(name: "FBC, crossmatch, clotting, lactate", category: .blood, rationale: "Haemorrhage")],
             plan: """
- ATLS primary survey; permissive resuscitation with blood products in haemorrhagic shock; tranexamic acid within 3 h of injury (CRASH-2; ATLS 10)
- Unstable with haemoperitoneum: laparotomy / damage control surgery
- Stable splenic / liver injury: non-operative management with monitoring, angioembolisation for contrast blush (WSES 2017)
- Evisceration or peritonitis after a stab wound: laparotomy; stable stab wound without peritonitis: selective non-operative management with serial examination (WSES)
- Post-splenectomy: vaccinations (pneumococcal, meningococcal, Hib, influenza) and antibiotic advice (BSH 2011)
""", consent: "Laparotomy", urgency: "Haemodynamically unstable abdominal trauma: theatre.",
             redFlags: ["Shock, peritonism, evisceration → laparotomy"],
             followUp: "Trauma follow-up; asplenia card if splenectomy.",
             ref: "ATLS 10th ed. (2018); WSES 2017 spleen trauma; CRASH-2"),

        extraCard(["acute limb ischaemia", "limb ischaemia", "limb ischemia"], "Acute Limb Ischaemia", icd: "I74.3",
             inv: [SI(name: "CT angiography — only if it will not delay revascularisation in Rutherford IIb", category: .imaging, rationale: "Level of occlusion"),
                   SI(name: "12-lead ECG (AF), FBC, clotting, CK, U&E", category: .blood, rationale: "Embolic source, reperfusion risk")],
             plan: """
- IV unfractionated heparin immediately unless contraindicated (ESVS 2020)
- Urgent vascular surgical referral: Rutherford IIb → emergency revascularisation; IIa → urgent (ESVS 2020)
- Analgesia; monitor for reperfusion injury and compartment syndrome (fasciotomy)
""", urgency: "Acute limb ischaemia: vascular emergency.",
             redFlags: ["Paralysis, sensory loss → Rutherford IIb/III"],
             followUp: "Vascular follow-up; anticoagulation for embolic source.",
             ref: "ESVS 2020 acute limb ischaemia"),

        extraCard(["superficial vein thrombosis", "superficial thrombophlebitis"], "Superficial Vein Thrombosis", icd: "I80.00",
             inv: [SI(name: "Duplex ultrasound", category: .imaging, rationale: "Extent; distance from the saphenofemoral junction; coexisting DVT")],
             plan: """
- Within 3 cm of the saphenofemoral junction: treat as DVT — therapeutic anticoagulation (NICE; ESVS 2021)
- ≥5 cm length and further from the junction: prophylactic-dose fondaparinux or LMWH for 45 days (ESVS 2021)
- NSAIDs / compression for symptoms when short and distal
""", urgency: nil,
             redFlags: ["Extension towards the junction → anticoagulate"],
             followUp: "Repeat duplex if symptoms extend.",
             ref: "ESVS 2021 venous thrombosis; NICE NG158"),

        extraCard(["non-accidental", "safeguarding", "domestic abuse", "domestic violence"], "Safeguarding Concern", icd: "T74.9",
             inv: [SI(name: "Child: skeletal survey (<2 years), CT head (<1 year), FBC, clotting", category: .imaging, rationale: "RCR/RCPCH child protection investigations"),
                   SI(name: "Photographs / body map (with consent)", category: .other, rationale: "Documentation")],
             plan: """
- Follow the practice safeguarding procedure: inform the safeguarding lead the same day (local contacts to be supplied by the practice) (NICE CG89)
- Children: bruising in a non-mobile infant, patterned or immersion injuries, delay or inconsistent history → child protection referral (NICE CG89)
- Adults: ask about domestic abuse in private; document; offer referral to support services (NICE PH50)
- Treat the injuries; do not discharge a child home until the safeguarding plan is agreed
""", urgency: "Safeguarding: same-day referral.",
             redFlags: ["Non-mobile infant with bruising → child protection referral"],
             followUp: "Safeguarding follow-up.",
             ref: "NICE CG89 (2009, updated 2017) Child maltreatment; NICE PH50 Domestic violence and abuse"),

        extraCard(["tetanus-prone", "contaminated laceration", "contaminated wound"], "Tetanus-prone Wound", icd: "T14.1",
             inv: [SI(name: "Tetanus immunisation history", category: .other, rationale: "Determines vaccine ± immunoglobulin")],
             plan: """
- Clean and debride the wound; delayed closure if heavily contaminated
- Tetanus-prone wound with unknown or incomplete immunisation: tetanus vaccine booster and human tetanus immunoglobulin (UKHSA Green Book, chapter 30)
- Antibiotics only for high-risk / infected wounds
""", urgency: nil,
             redFlags: ["Soil / manure contamination, devitalised tissue → high risk"],
             followUp: "Complete the vaccine course if incomplete.",
             ref: "UKHSA Immunisation against infectious disease (Green Book), chapter 30 — tetanus (2019)"),

        extraCard(["colonic polyp", "polypectomy", "endoscopic mucosal resection", "emr", "tubulovillous adenoma", "tubular adenoma", "colorectal adenoma"], "Colonic Polyp / Endoscopic Resection", icd: "K63.5",
             inv: [SI(name: "Histology of the resected polyp", category: .pathology, rationale: "Surveillance interval"),
                   SI(name: "FBC, clotting if on antithrombotics", category: .blood, rationale: "Bleeding risk")],
             plan: """
- Polypectomy of polyps ≥1 cm and EMR are HIGH bleeding-risk procedures; diagnostic colonoscopy is low risk (BSG/ESGE 2021)
- Antithrombotic plan: see the peri-procedural plan below when the patient takes one — no routine bridging
- Surveillance after polypectomy per BSG 2020 (risk-based: 3-year colonoscopy for high-risk findings; none for low-risk)
""", consent: "Colonoscopy with polypectomy / EMR", urgency: nil,
             redFlags: ["Delayed bleeding after polypectomy (up to 2 weeks) → urgent review"],
             followUp: "Histology review; surveillance per BSG 2020.",
             ref: "BSG/ESGE antithrombotics and endoscopy (2021); BSG post-polypectomy surveillance (2020)"),
    ]
}
