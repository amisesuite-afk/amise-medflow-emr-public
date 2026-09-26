// DiagnosisRadiationEngine+PrecedenceCards.swift
// Cards checked BEFORE the original dictionary (DiagnosisRadiationEngine.lookupOrder): specific
// diagnoses that a generic keyword elsewhere used to capture (SURGEON-DECISIONS E6: parathyroid →
// renal colic via "nephrolithiasis", large bowel obstruction → small bowel obstruction; clinical
// validation: hypoglycaemia → stroke card, spinal metastases → breast carcinoma card, malrotation
// with volvulus → adult small-bowel-obstruction card). Added 2026-09 (clinical validation).
// Doses appear only where the named guideline states them; under-16s never see them (safety filter).

import Foundation

extension DiagnosisRadiationEngine {

    fileprivate typealias SI = DiagnosisRadiation.SuggestedInvestigation

    fileprivate static func precedenceCard(_ keywords: [String], _ name: String, icd: String, inv: [SI], plan: String,
                                           consent: String? = nil, urgency: String?, redFlags: [String],
                                           followUp: String, ref: String) -> Entry {
        Entry(keywords: keywords, radiation: .init(
            conditionName: name, icd10Primary: icd, investigations: inv, planTemplate: plan,
            billingCodes: [.init(icd10: icd, icdDescription: name, cpt: nil, cptDescription: nil)],
            consentCategory: consent, urgencyNote: urgency, redFlags: redFlags, followUp: followUp,
            guidelineReference: ref))
    }

    static let redirectLine = "- RECOGNISE AND REDIRECT: \(EmergencyRedirect.text) The clinic does not manage this emergency; give the first actions below while arranging transfer."

    static let _precedenceEntries: [Entry] = [

        precedenceCard(["primary hyperparathyroidism", "hyperparathyroidism", "parathyroid adenoma"], "Primary Hyperparathyroidism", icd: "E21.0",
             inv: [SI(name: "Adjusted calcium, PTH, phosphate, 25-OH vitamin D", category: .blood, rationale: "Confirm PTH-dependent hypercalcaemia"),
                   SI(name: "U&E / eGFR", category: .blood, rationale: "Renal criterion for surgery (eGFR <60)"),
                   SI(name: "24-h urine calcium (or calcium:creatinine clearance ratio)", category: .other, rationale: "Exclude familial hypocalciuric hypercalcaemia"),
                   SI(name: "Renal tract ultrasound", category: .imaging, rationale: "Nephrolithiasis / nephrocalcinosis"),
                   SI(name: "DXA bone density", category: .imaging, rationale: "Osteoporosis criterion"),
                   SI(name: "Localisation: neck ultrasound + sestamibi (or 4D-CT)", category: .imaging, rationale: "Only once surgery is planned")],
             plan: """
- Confirm PTH-dependent hypercalcaemia; exclude FHH (urine calcium) before referral
- Surgical referral (parathyroidectomy) when any criterion is met (NICE NG132): symptoms, end-organ disease (renal stones, eGFR <60, osteoporosis or fragility fracture), or adjusted calcium ≥2.85 mmol/L
- Hydration; avoid thiazides and calcium-raising drugs
- Localisation imaging only after the decision to operate
- Severe hypercalcaemia (≥3.5 mmol/L or symptomatic) / hypercalcaemic crisis: IV fluids — 0.9% saline rehydration — then IV bisphosphonate (zoledronic acid or pamidronate) once rehydrated; urgent medical review (Society for Endocrinology 2016)
""", consent: "Parathyroidectomy", urgency: nil,
             redFlags: ["Adjusted calcium ≥3.5 mmol/L or confusion/vomiting → hypercalcaemic crisis — same-day admission"],
             followUp: "Endocrine surgery clinic; calcium and PTH after surgery; bone density follow-up.",
             ref: "NICE NG132 (2019) Hyperparathyroidism (primary); Society for Endocrinology emergency guidance (2016)"),

        precedenceCard(["large bowel obstruction", "colonic obstruction", "obstructing carcinoma", "obstructing sigmoid", "obstructing colon",
                        "obstructing hepatic flexure", "malignant large bowel", "caecal volvulus", "sigmoid volvulus"], "Large Bowel Obstruction", icd: "K56.69",
             inv: [SI(name: "CT abdomen/pelvis with IV contrast", category: .imaging, rationale: "Level, cause, caecal diameter, ischaemia, perforation, metastases"),
                   SI(name: "FBC / U&E / lactate / CRP / group and save", category: .blood, rationale: "Dehydration, ischaemia, pre-operative"),
                   SI(name: "CEA and CT chest (if malignant)", category: .imaging, rationale: "Staging when time allows")],
             plan: """
- NBM, IV fluids, NG tube if vomiting, correct electrolytes; analgesia
- Emergency surgery if perforation, peritonitis, ischaemia/closed loop, caecal diameter ≥12 cm with tenderness (impending perforation) — stent contraindicated (WSES 2018)
- Impending caecal perforation: emergency laparotomy — resection (extended right hemicolectomy or subtotal colectomy) (WSES 2018)
- Left-sided obstructing colon cancer without perforation, peritonitis, ischaemia or a closed loop: colonic stent as a bridge to elective resection (selected patients, MDT), or emergency resection / Hartmann's procedure (WSES 2018; ESGE 2020)
- Right-sided / hepatic flexure tumour: right (extended) hemicolectomy with primary anastomosis (WSES 2018)
- Sigmoid volvulus only if no ischaemia or peritonitis: endoscopic decompression (flexible sigmoidoscopy), then sigmoidectomy in the same admission
- Gangrenous volvulus or peritonitis: emergency laparotomy with sigmoid resection and end colostomy — no endoscopic decompression; critical care (ASCRS 2021; WSES 2023)
- Caecal volvulus: operative management — right hemicolectomy (ASCRS 2021); no endoscopic detorsion
- Colorectal MDT and stoma nurse
""", consent: "Emergency laparotomy / colectomy", urgency: "Large bowel obstruction: urgent surgical review; emergency if peritonism, caecum ≥12 cm or ischaemia.",
             redFlags: ["Caecal tenderness / diameter ≥12 cm, peritonism, pneumatosis → impending perforation → theatre, no stent",
                        "Gangrenous volvulus → resection, no endoscopic decompression"],
             followUp: "Colorectal MDT; histology; stoma review; surveillance per cancer pathway.",
             ref: "WSES 2018 obstructing colorectal cancer; ASCRS 2021 volvulus; WSES 2023 sigmoid volvulus"),

        precedenceCard(["hypoglycaemia", "hypoglycemia"], "Hypoglycaemia", icd: "E16.2",
             inv: [SI(name: "Capillary and laboratory glucose", category: .blood, rationale: "Confirm and repeat after treatment"),
                   SI(name: "U&E / eGFR", category: .blood, rationale: "Renal impairment prolongs sulfonylurea / insulin action"),
                   SI(name: "Medication review (sulfonylurea, insulin, timing)", category: .other, rationale: "Cause and risk of recurrence")],
             plan: """
\(redirectLine)
- Able to swallow: 15–20 g quick-acting carbohydrate (e.g. glucose gel / sugary drink); recheck capillary glucose after 10–15 minutes and repeat up to 3 times (JBDS 2023)
- Unable to swallow / unconscious: IV glucose (10% glucose 150–200 mL over 15 minutes, or 20% glucose 75–100 mL) or IM glucagon 1 mg (JBDS 2023)
- Once glucose ≥4.0 mmol/L: long-acting carbohydrate; monitor capillary glucose hourly — sulfonylurea-induced hypoglycaemia is prolonged and recurrent (admit)
- Review and reduce / stop the sulfonylurea (gliclazide) or insulin dose; check renal function
- Check glucose before any stroke pathway decision — hypoglycaemia mimics stroke (NICE NG128); no thrombolysis until glucose corrected and deficit reassessed
""", urgency: "Hypoglycaemia (<4.0 mmol/L): treat now. \(EmergencyRedirect.text)",
             redFlags: ["Reduced consciousness / seizure → IV glucose or IM glucagon, emergency transfer",
                        "Sulfonylurea overdose or CKD → prolonged / recurrent hypoglycaemia → admit"],
             followUp: "Diabetes team review of regimen; DVLA advice; hypoglycaemia education.",
             ref: "JBDS-IP Hospital management of hypoglycaemia (2023 edition); NICE NG128 stroke mimics"),

        precedenceCard(["diabetic ketoacidosis", "euglycaemic dka", "euglycemic dka", "ketoacidosis", "dka"], "Diabetic Ketoacidosis (DKA)", icd: "E10.10",
             inv: [SI(name: "Blood ketones (capillary or laboratory)", category: .blood, rationale: "Diagnosis (≥3.0 mmol/L) and hourly monitoring"),
                   SI(name: "Venous blood gas (pH, bicarbonate)", category: .blood, rationale: "pH <7.3 and/or bicarbonate <15 mmol/L; repeat 1–2-hourly"),
                   SI(name: "U&E (potassium), glucose, FBC, CRP, lactate", category: .blood, rationale: "Potassium guides replacement; precipitant"),
                   SI(name: "12-lead ECG", category: .other, rationale: "Potassium effects; silent MI as precipitant"),
                   SI(name: "Pregnancy test (women of childbearing age)", category: .blood, rationale: "Pregnancy changes the management (obstetric input)"),
                   SI(name: "Blood cultures, urine, CXR as indicated", category: .other, rationale: "Infection as precipitant")],
             plan: """
\(redirectLine)
- IV 0.9% sodium chloride: 1 L over 1 hour, then per JBDS 2023 protocol (smaller volumes in the elderly, heart failure, pregnancy)
- Fixed-rate IV insulin infusion (FRIII) 0.1 units/kg/h; continue the patient's long-acting (basal) insulin (JBDS 2023)
- Potassium replacement in each litre after the first, guided by the potassium level (none if >5.5 mmol/L) (JBDS 2023)
- Add 10% glucose when glucose falls below 14 mmol/L, alongside 0.9% sodium chloride (JBDS 2023)
- Hourly capillary ketones and glucose; venous gas at 1, 2 and 6 hours; strict fluid balance
- SGLT2 inhibitor (empagliflozin, dapagliflozin, canagliflozin): stop it — euglycaemic DKA (glucose may be <11 mmol/L); treat by ketones and pH, with 10% glucose from the start (JBDS 2023; CPOC 2021)
- Pregnancy: DKA in pregnancy is an obstetric emergency — fetal monitoring (CTG) and obstetric team (JBDS 2023)
- Children: BSPED paediatric DKA guideline — risk of cerebral oedema; neurological observations; fluids and insulin by weight
- Find and treat the precipitant; VTE prophylaxis
- Abdominal pain in DKA usually settles with treatment — reassess before any surgical decision
""", urgency: "DKA: medical emergency. \(EmergencyRedirect.text)",
             redFlags: ["pH <7.1, bicarbonate <5, ketones >6, potassium <3.5 on admission, GCS <12, SpO₂ <92% → HDU/ICU (JBDS severe DKA)",
                        "Children: headache, bradycardia, rising BP, falling GCS → cerebral oedema"],
             followUp: "Diabetes team before discharge; sick-day rules; SGLT2 inhibitor review.",
             ref: "JBDS-IP Management of DKA in adults (2023); BSPED DKA guideline (2021); CPOC perioperative diabetes (2021)"),

        precedenceCard(["hyperosmolar hyperglycaemic", "hyperosmolar hyperglycemic", "hyperosmolar", "hhs"], "Hyperosmolar Hyperglycaemic State (HHS)", icd: "E11.00",
             inv: [SI(name: "Serum osmolality (measured) — or calculated 2Na + glucose + urea", category: .blood, rationale: "Diagnosis (≥320 mOsm/kg) and to guide the fall"),
                   SI(name: "Glucose, U&E (sodium, potassium), blood ketones", category: .blood, rationale: "Glucose ≥30; ketones <3.0 mmol/L distinguishes from DKA"),
                   SI(name: "Venous gas, FBC, CRP, lactate, CK", category: .blood, rationale: "Acidosis, precipitant, rhabdomyolysis"),
                   SI(name: "12-lead ECG, cultures, CXR", category: .other, rationale: "Precipitant (MI, infection)")],
             plan: """
\(redirectLine)
- IV 0.9% sodium chloride first — fluid replacement alone lowers glucose (JBDS 2022 HHS)
- Measure osmolality hourly at first; aim for a gradual fall (3–8 mOsm/kg/h); avoid rapid sodium changes
- Insulin ONLY once glucose stops falling with fluids alone (or if ketones ≥1.0): low fixed-rate 0.05 units/kg/h (JBDS 2022) — not the DKA rate
- Potassium replacement guided by the level
- Prophylactic LMWH (high VTE risk) unless contraindicated (JBDS 2022)
- Foot protection / heel checks (high risk of pressure ulceration)
- Hold metformin (AKI / lactic acidosis risk); find and treat the precipitant
""", urgency: "HHS: medical emergency. \(EmergencyRedirect.text)",
             redFlags: ["Osmolality >350, sodium >160, pH <7.1, hypothermia, GCS <12 → HDU/ICU"],
             followUp: "Diabetes team; review glucose-lowering therapy before discharge.",
             ref: "JBDS-IP Management of HHS in adults (2022)"),

        precedenceCard(["metastatic spinal cord compression", "spinal cord compression", "cord compression", "mscc", "spinal metastases",
                        "spinal metastasis"], "Metastatic Spinal Cord Compression (MSCC)", icd: "G95.20",
             inv: [SI(name: "MRI whole spine — immediately if neurological deficit, within 24 h (NICE NG234)", category: .imaging, rationale: "Level(s) of compression; plan"),
                   SI(name: "FBC, U&E, calcium, PSA (if prostate)", category: .blood, rationale: "Hypercalcaemia, baseline"),
                   SI(name: "Bladder scan / post-void residual", category: .other, rationale: "Autonomic involvement")],
             plan: """
\(redirectLine)
- Dexamethasone 16 mg (oral or IV) as soon as MSCC is suspected, unless contraindicated (NICE NG234), with gastroprotection and glucose monitoring
- Neutral spinal alignment / log-roll if pain or instability suspected; analgesia
- Contact the MSCC coordinator / acute oncology and spinal surgical team the same day; definitive radiotherapy or surgery decided by them
- Catheter if retention; VTE prophylaxis; pressure-area care
- No deficit yet: safety-net — seek urgent help immediately if leg weakness, numbness or bladder / bowel disturbance develops (NICE NG234)
""", urgency: "Suspected MSCC: MRI within 24 h (immediately with neurological deficit). \(EmergencyRedirect.text)",
             redFlags: ["Progressive leg weakness, sensory level, sphincter disturbance → emergency MRI and treatment"],
             followUp: "Oncology / spinal team; rehabilitation.",
             ref: "NICE NG234 (2023) Spinal metastases and metastatic spinal cord compression"),

        precedenceCard(["eclampsia", "hellp", "pre-eclampsia", "preeclampsia", "severe pre-eclampsia"], "Pre-eclampsia / Eclampsia / HELLP", icd: "O14.10",
             inv: [SI(name: "Urine protein:creatinine ratio (uPCR)", category: .other, rationale: "Proteinuria >30 mg/mmol (NICE NG133)"),
                   SI(name: "FBC (platelets), LFTs (ALT), creatinine, LDH, clotting", category: .blood, rationale: "HELLP and organ involvement"),
                   SI(name: "Fetal assessment: CTG and ultrasound (obstetric team)", category: .imaging, rationale: "Fetal wellbeing")],
             plan: """
\(redirectLine)
- Obstetric emergency — same-day obstetric admission; the obstetric team leads (NICE NG133)
- Severe hypertension (≥160/110): antihypertensive by the obstetric team — labetalol, nifedipine or IV hydralazine (NICE NG133); ACE-i/ARB contraindicated antenatally
- Eclampsia or severe pre-eclampsia: magnesium sulfate — Collaborative Eclampsia Trial regimen, 4 g IV over 5–15 minutes then 1 g/hour for 24 hours (NICE NG133)
- Seizure: left lateral position, airway, oxygen, magnesium sulfate; the definitive treatment is delivery (obstetric decision)
- Fluid restriction (80 mL/h) in severe pre-eclampsia unless ongoing losses (NICE NG133); strict fluid balance
- Postpartum pre-eclampsia (up to 6 weeks): same thresholds; enalapril or nifedipine/amlodipine postnatally (NICE NG133)
- Epigastric / right upper quadrant pain in pregnancy ≥20 weeks is pre-eclampsia/HELLP until proven otherwise — not "gallbladder" until excluded
""", urgency: "Pre-eclampsia / eclampsia / HELLP: obstetric emergency. \(EmergencyRedirect.text)",
             redFlags: ["Seizure, severe headache, visual disturbance, epigastric pain, platelets <100, rising ALT/creatinine → severe features"],
             followUp: "Obstetric follow-up; BP monitoring postnatally; aspirin in future pregnancies.",
             ref: "NICE NG133 (2019, updated 2023) Hypertension in pregnancy"),

        precedenceCard(["ectopic pregnancy", "ectopic", "pregnancy of unknown location"], "Ectopic Pregnancy", icd: "O00.90",
             inv: [SI(name: "Serum hCG (and urine pregnancy test now)", category: .blood, rationale: "Confirm pregnancy; serial hCG if PUL (NICE NG126)"),
                   SI(name: "Transvaginal ultrasound", category: .imaging, rationale: "Location; free fluid / haemoperitoneum"),
                   SI(name: "FBC, group and save / crossmatch, blood group and RhD", category: .blood, rationale: "Bleeding; anti-D if RhD negative and surgery")],
             plan: """
\(redirectLine)
- Any woman of reproductive age with abdominal pain or bleeding: pregnancy test (NICE NG126)
- Refer to the early pregnancy / gynaecology service the same day
- RUPTURED or haemodynamically unstable: resuscitate, crossmatch, emergency laparoscopy/laparotomy (salpingectomy) — surgery only; methotrexate and expectant management are NOT options once ruptured (NICE NG126)
- Unruptured, stable: management (surgical, medical or expectant) chosen by gynaecology on hCG level, size and symptoms (NICE NG126)
- Anti-D immunoglobulin for RhD-negative women having surgery (NICE NG126)
""", consent: "Emergency laparoscopy / salpingectomy", urgency: "Suspected ectopic pregnancy: same-day gynaecology; ruptured → emergency surgery. \(EmergencyRedirect.text)",
             redFlags: ["Shoulder-tip pain, collapse, peritonism, free fluid → rupture → theatre"],
             followUp: "Gynaecology follow-up; serial hCG until negative when managed medically/expectantly.",
             ref: "NICE NG126 (2019, updated 2023) Ectopic pregnancy and miscarriage"),

        precedenceCard(["placental abruption", "abruption", "trauma in pregnancy", "abdominal trauma in pregnancy"], "Trauma in Pregnancy / Placental Abruption", icd: "O45.90",
             inv: [SI(name: "FBC, clotting, fibrinogen, crossmatch, Kleihauer, blood group and RhD", category: .blood, rationale: "Haemorrhage, DIC, fetomaternal haemorrhage"),
                   SI(name: "CTG / fetal assessment (obstetric team)", category: .other, rationale: "Fetal distress is an early sign of maternal shock"),
                   SI(name: "FAST / ultrasound; CT when indicated for the mother", category: .imaging, rationale: "Maternal injury comes first")],
             plan: """
\(redirectLine)
- ABCDE with left lateral tilt / manual uterine displacement from 20 weeks (ATLS 10)
- Call the obstetric team immediately; continuous CTG from viability
- Kleihauer test and anti-D immunoglobulin for RhD-negative women (RCOG)
- Placental abruption: resuscitate, correct coagulopathy (fibrinogen), delivery decision by the obstetric team
- Safeguarding: ask privately about domestic abuse (NICE PH50); inform the safeguarding lead (local contacts to be supplied by the practice)
""", urgency: "Trauma in pregnancy / abruption: obstetric emergency. \(EmergencyRedirect.text)",
             redFlags: ["Uterine tenderness, vaginal bleeding, hard uterus, fetal distress → abruption"],
             followUp: "Obstetric follow-up; safeguarding follow-up.",
             ref: "ATLS 10th ed. (2018); RCOG Green-top 63 (antepartum haemorrhage); NICE PH50 (domestic abuse)"),

        precedenceCard(["necrotising fasciitis", "necrotizing fasciitis", "necrotising soft", "necrotizing soft", "fournier",
                        "nsti"], "Necrotising Soft-Tissue Infection (NSTI) / Fournier's Gangrene", icd: "M72.6",
             inv: [SI(name: "Blood cultures ×2, FBC, CRP, U&E, glucose, lactate, CK", category: .blood, rationale: "Sepsis, LRINEC components (a low LRINEC does not exclude NSTI)"),
                   SI(name: "Tissue samples / Gram stain at surgery", category: .pathology, rationale: "Organism and sensitivities"),
                   SI(name: "CT only if it will not delay surgery", category: .imaging, rationale: "Gas / extent — imaging must not delay exploration (WSES 2018)")],
             plan: """
- EMERGENCY surgical exploration and debridement — clinical suspicion is enough; do not wait for imaging or scores (WSES 2018)
- Sepsis Six: blood cultures, IV fluids, lactate, oxygen, urine output
- IV broad-spectrum antibiotics per local guideline: piperacillin–tazobactam (or a carbapenem) ± MRSA cover (vancomycin/linezolid) (WSES 2018)
- Add clindamycin (toxin suppression) to every empirical regimen (WSES 2018; IDSA 2014)
- Relook in theatre within 24–48 h; ICU
- Fournier's: urology/colorectal input; faecal / urinary diversion as needed; SGLT2 inhibitor — stop it (MHRA 2019 warning)
- LRINEC <6 does NOT exclude necrotising infection (WSES 2018)
""", consent: "Emergency debridement", urgency: "NSTI: surgical emergency — theatre now.",
             redFlags: ["Pain out of proportion, crepitus, bullae, skin necrosis, rapid spread, sepsis → theatre"],
             followUp: "Serial debridement; plastic surgery for reconstruction; diabetes review.",
             ref: "WSES/SIS 2018 skin and soft-tissue infections; MHRA 2019 (SGLT2 inhibitors and Fournier's gangrene)"),

        precedenceCard(["malrotation", "midgut volvulus"], "Malrotation with Midgut Volvulus", icd: "Q43.3",
             inv: [SI(name: "Upper GI contrast study (paediatric radiology)", category: .imaging, rationale: "Duodenojejunal flexure position — only if it will not delay surgery"),
                   SI(name: "Blood gas, U&E, glucose", category: .blood, rationale: "Dehydration, acidosis (ischaemia)")],
             plan: """
\(redirectLine)
- Bilious (green) vomiting in an infant is malrotation with volvulus until proven otherwise — emergency paediatric surgical referral
- Nil by mouth, NG decompression, IV access and fluids by weight (weight-based dosing — calculate per BNFc / APLS)
- Unstable or peritonitic: straight to theatre (Ladd's procedure) without imaging
""", consent: "Emergency laparotomy (Ladd's procedure)", urgency: "Bilious vomiting in an infant: paediatric surgical emergency. \(EmergencyRedirect.text)",
             redFlags: ["Abdominal distension, blood per rectum, shock → ischaemic midgut → theatre now"],
             followUp: "Paediatric surgical follow-up.",
             ref: "APLS (ALSG, 6th ed.); British Association of Paediatric Surgeons guidance"),

        precedenceCard(["intussusception"], "Intussusception", icd: "K56.1",
             inv: [SI(name: "Abdominal ultrasound (target sign)", category: .imaging, rationale: "Diagnosis in children"),
                   SI(name: "FBC, U&E, blood gas", category: .blood, rationale: "Dehydration, ischaemia")],
             plan: """
\(redirectLine)
- Paediatric surgical referral now; IV access and fluids by weight (weight-based dosing — calculate per BNFc / APLS)
- Stable, no peritonitis: image-guided air (pneumatic) enema reduction by the paediatric team
- Peritonitis, perforation or failed reduction: operative reduction / resection
- Adults: intussusception usually has a lead point — CT and resection
""", consent: "Operative reduction of intussusception", urgency: "Intussusception: paediatric surgical emergency. \(EmergencyRedirect.text)",
             redFlags: ["Lethargy, shock, peritonism, 'redcurrant jelly' stool → ischaemia"],
             followUp: "Paediatric surgical follow-up; safety-net for recurrence.",
             ref: "APLS (ALSG, 6th ed.); British Society of Paediatric Radiology intussusception guidance"),

        precedenceCard(["pyloric stenosis"], "Infantile Hypertrophic Pyloric Stenosis", icd: "Q40.0",
             inv: [SI(name: "Pyloric ultrasound", category: .imaging, rationale: "Muscle thickness and channel length"),
                   SI(name: "Venous gas and electrolytes (chloride, potassium)", category: .blood, rationale: "Hypochloraemic hypokalaemic metabolic alkalosis")],
             plan: """
- Correct fluid and electrolytes before surgery (weight-based fluids — calculate per BNFc / APLS)
- Paediatric surgical referral: pyloromyotomy once the alkalosis is corrected
""", consent: "Pyloromyotomy", urgency: "Urgent paediatric surgical referral (same day).",
             redFlags: ["Lethargy, severe dehydration → resuscitate first"],
             followUp: "Paediatric surgical follow-up.",
             ref: "APLS (ALSG, 6th ed.)"),

        precedenceCard(["variceal haemorrhage", "variceal bleed", "variceal"], "Variceal Haemorrhage", icd: "I85.11",
             inv: [SI(name: "FBC, clotting, U&E, LFTs, crossmatch", category: .blood, rationale: "Severity, liver function"),
                   SI(name: "Urgent OGD within 12 h (after resuscitation)", category: .endoscopy, rationale: "Band ligation (Baveno VII)")],
             plan: """
- Resuscitate: two large-bore cannulae; restrictive transfusion — target Hb 70–80 g/L (Baveno VII)
- Terlipressin (vasoactive drug) as soon as variceal bleeding is suspected (Baveno VII; BSG 2015)
- Antibiotic prophylaxis for cirrhosis with GI bleeding, e.g. ceftriaxone (Baveno VII)
- Endoscopy within 12 h: band ligation (oesophageal) / cyanoacrylate (gastric); TIPSS if uncontrolled
- Correct coagulopathy selectively; avoid over-transfusion
""", urgency: "Variceal haemorrhage: emergency — resuscitate and endoscopy within 12 h.",
             redFlags: ["Ongoing haematemesis, shock → balloon tamponade / TIPSS as bridge"],
             followUp: "Hepatology; carvedilol / non-selective beta-blocker; banding programme.",
             ref: "Baveno VII (2022); BSG UK guideline on variceal haemorrhage (2015)"),
    ]
}
