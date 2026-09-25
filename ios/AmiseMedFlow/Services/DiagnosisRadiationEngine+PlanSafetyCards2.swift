// DiagnosisRadiationEngine+PlanSafetyCards2.swift
// Plan-safety cards, part 2: endocrine, breast, soft tissue, vascular, medical / paediatric
// emergencies and other diagnoses that reached no card (see DiagnosisRadiationEngine+PlanSafetyCards).

import Foundation

extension DiagnosisRadiationEngine {

    fileprivate typealias SI = DiagnosisRadiation.SuggestedInvestigation

    fileprivate static func psCard2(_ keywords: [String], _ name: String, icd: String, inv: [SI], plan: String,
                                    consent: String? = nil, urgency: String? = nil, redFlags: [String] = [],
                                    followUp: String, ref: String) -> Entry {
        Entry(keywords: keywords, radiation: .init(
            conditionName: name, icd10Primary: icd, investigations: inv, planTemplate: plan,
            billingCodes: [.init(icd10: icd, icdDescription: name, cpt: nil, cptDescription: nil)],
            consentCategory: consent, urgencyNote: urgency, redFlags: redFlags, followUp: followUp,
            guidelineReference: ref))
    }

    // MARK: - Endocrine and breast

    static let _planSafetyEndocrineBreastEntries: [Entry] = [

        psCard2(["neck haematoma", "neck hematoma", "post-thyroidectomy haematoma", "post-thyroidectomy neck"],
              "Post-thyroidectomy Neck Haematoma", icd: "L76.32",
              inv: [SI(name: "No imaging before decompression when the airway is threatened — imaging only if stable and after senior review", category: .other, rationale: "DAS/BAETS/ENT UK 2022")],
              plan: """
- Airway compromise: bedside decompression now — SCOOP: Skin exposure, Cut sutures, Open skin, Open muscles, Pack the wound (DAS/BAETS/ENT UK 2022)
- Call for senior surgical and anaesthetic help; oxygen; sit up
- Return to theatre for exploration and haemostasis after decompression
- Anticoagulated: reversal (see the patient-specific lines)
""", consent: "Neck exploration / evacuation of haematoma", urgency: "Neck haematoma with airway compromise: open the wound at the bedside now.",
              redFlags: ["Stridor, rapidly expanding swelling → SCOOP at the bedside"],
              followUp: "Airway review; calcium and voice check.",
              ref: "DAS / BAETS / ENT UK consensus on neck haematoma after thyroid and parathyroid surgery (2022)"),

        psCard2(["thyroid nodule", "bethesda", "toxic adenoma", "papillary thyroid", "follicular thyroid", "thyroid carcinoma", "thyroid cancer",
                 "anaplastic thyroid", "thyroid lymphoma", "thyroid mass", "multinodular goitre", "retrosternal goitre", "goitre"],
              "Thyroid Nodule / Goitre", icd: "E04.1",
              inv: [SI(name: "TSH (thyroid function)", category: .blood, rationale: "Suppressed TSH → toxic nodule (ATA 2015)"),
                    SI(name: "Neck ultrasound with TI-RADS / U-score", category: .imaging, rationale: "Risk stratification (BTA 2014; ACR TI-RADS)"),
                    SI(name: "US-guided FNA if TSH is not suppressed and the nodule meets size / TI-RADS criteria", category: .pathology, rationale: "Bethesda category"),
                    SI(name: "Thyroid radionuclide (technetium) uptake scan if TSH is suppressed", category: .imaging, rationale: "Hyperfunctioning (hot) nodule — no FNA"),
                    SI(name: "CT neck and chest (non-contrast or after thyroid planning) for retrosternal extension, tracheal compression or a rapidly enlarging mass", category: .imaging, rationale: "Airway and surgical planning"),
                    SI(name: "Urgent core biopsy (or open / incisional biopsy) for a rapidly enlarging mass", category: .pathology, rationale: "Anaplastic carcinoma vs lymphoma")],
              plan: """
- TSH first; suppressed TSH → radionuclide scan; a hyperfunctioning (hot) nodule needs no FNA — beta-blocker (propranolol) for symptoms, then radioiodine or hemithyroidectomy (ATA 2015)
- Euthyroid nodule: ultrasound (TI-RADS / U-score) and US-guided FNA when criteria are met (BTA 2014; ATA 2015)
- Bethesda I (non-diagnostic): repeat FNA under ultrasound after 3 months
- Bethesda II (benign): ultrasound surveillance at 12–24 months; no surgery unless compressive symptoms
- Bethesda III (AUS): repeat FNA, molecular testing or diagnostic lobectomy (hemithyroidectomy) — MDT
- Bethesda IV (follicular neoplasm): diagnostic lobectomy (hemithyroidectomy)
- Bethesda V–VI (suspicious / malignant): thyroid MDT — lobectomy or total thyroidectomy by size and nodal status (BTA 2014; ATA 2015)
- Papillary carcinoma with lateral neck nodes (N1b): total thyroidectomy with therapeutic lateral neck dissection (levels II–V) and central compartment dissection
- Rapidly enlarging mass with stridor: airway first — anaesthetic and ENT review (awake fibreoptic intubation / tracheostomy planning), urgent core biopsy for anaplastic carcinoma vs lymphoma, urgent MDT
- Retrosternal goitre with tracheal compression: total thyroidectomy (cervical approach; sternotomy with cardiothoracic surgery if needed) with anaesthetic airway planning
""", consent: "Thyroid surgery (lobectomy / total thyroidectomy)",
              redFlags: ["Stridor, rapid growth, hoarse voice, fixed mass → urgent (airway) referral"],
              followUp: "Thyroid MDT; ultrasound surveillance for benign nodules.",
              ref: "BTA guidelines for thyroid cancer (2014); ATA 2015; ACR TI-RADS (2017); Bethesda 2017"),

        psCard2(["adrenal incidentaloma", "adrenal mass", "adrenal adenoma", "adrenal nodule", "phaeochromocytoma", "pheochromocytoma"],
              "Adrenal Incidentaloma / Phaeochromocytoma", icd: "D44.1",
              inv: [SI(name: "Plasma free metanephrines (or 24-h urinary metanephrines)", category: .blood, rationale: "Exclude phaeochromocytoma in every adrenal mass (ESE/ENSAT 2023)"),
                    SI(name: "1 mg overnight dexamethasone suppression test", category: .blood, rationale: "Autonomous cortisol secretion"),
                    SI(name: "Aldosterone:renin ratio (hypertension or hypokalaemia)", category: .blood, rationale: "Primary aldosteronism"),
                    SI(name: "Indeterminate on unenhanced CT (> 10 HU): adrenal-protocol CT washout, MRI (chemical shift) or FDG-PET", category: .imaging, rationale: "ESE/ENSAT 2023")],
              plan: """
- Every adrenal incidentaloma: metanephrines, 1 mg dexamethasone suppression test, and aldosterone:renin ratio if hypertensive or hypokalaemic (ESE/ENSAT 2023)
- Never biopsy an adrenal mass before phaeochromocytoma is excluded
- Phaeochromocytoma: alpha-blockade (phenoxybenzamine or doxazosin) for 7–14 days before surgery with liberal salt and fluid intake; beta-blocker only after alpha-blockade (Endocrine Society 2014); laparoscopic adrenalectomy with an experienced anaesthetist
- Indeterminate or > 4 cm: adrenal MDT (adrenalectomy considered)
""", consent: "Laparoscopic adrenalectomy",
              redFlags: ["Paroxysmal hypertension, headache, sweating → phaeochromocytoma until excluded — no beta-blocker alone"],
              followUp: "Endocrine / adrenal MDT.",
              ref: "ESE/ENSAT adrenal incidentaloma guideline (2023); Endocrine Society phaeochromocytoma guideline (2014)"),

        psCard2(["breast abscess", "periareolar abscess", "periductal mastitis", "lactational abscess", "mastitis"],
              "Breast Abscess / Mastitis", icd: "N61.1",
              inv: [SI(name: "Breast ultrasound (± US-guided aspiration)", category: .imaging, rationale: "Confirms abscess; guides aspiration"),
                    SI(name: "Pus culture and sensitivity (C&S)", category: .pathology, rationale: "Organism (S. aureus; anaerobes in periductal mastitis)")],
              plan: """
- Ultrasound-guided needle aspiration (repeat as needed); incision and drainage only if the skin is necrotic or aspiration fails (ABS 2019)
- Lactational abscess (if lactational): flucloxacillin (clarithromycin if penicillin-allergic); continue breastfeeding or expressing from the affected breast (ABS; NICE CKS)
- Non-lactational / periductal mastitis: co-amoxiclav (or metronidazole plus an anti-staphylococcal agent) for anaerobic cover; smoking cessation (smoking is the main risk factor)
- Non-lactational abscess: exclude underlying carcinoma once settled — imaging (mammogram if age ≥ 40 or suspicious) and triple assessment
""", followUp: "Breast clinic 1–2 weeks; recurrent periareolar disease → duct excision.",
              ref: "Association of Breast Surgery (2019); NICE CKS mastitis and breast abscess"),

        psCard2(["breast lump", "breast mass", "triple assessment", "nipple discharge", "male breast"],
              "Breast Lump — Triple Assessment", icd: "N63.0",
              inv: [SI(name: "Breast ultrasound (and axillary ultrasound) — first line under 40 and in pregnancy", category: .imaging, rationale: "NICE NG12; ABS 2019"),
                    SI(name: "Bilateral mammography if age ≥ 40 (or suspicious features at any age; with abdominal shielding in pregnancy)", category: .imaging, rationale: "Triple assessment"),
                    SI(name: "Image-guided core needle biopsy (core biopsy) of the lesion", category: .pathology, rationale: "Histology before any treatment")],
              plan: """
- Triple assessment in a one-stop breast clinic: clinical examination, imaging (ultrasound ± mammography by age) and core biopsy (NICE NG12; ABS 2019)
- Suspicious features (age ≥ 30 with an unexplained lump, skin tethering, nodes): urgent 2-week suspected cancer referral (NICE NG12)
- Results discussed at the breast MDT before any operation
- Bloody single-duct nipple discharge: mammography + ultrasound; microdochectomy (duct excision) or ductoscopy for diagnosis
- Male breast mass: triple assessment; confirmed cancer → genetic referral (BRCA2)
- Pregnancy: ultrasound first and core biopsy — diagnosis must not wait for delivery
""", followUp: "Breast clinic with results; MDT outcome.",
              ref: "NICE NG12 (2015, updated 2023); Association of Breast Surgery best-practice diagnostic guidelines (2019)"),
    ]

    // MARK: - Soft tissue, vascular, urology, medical and paediatric

    static let _planSafetyOtherEntries: [Entry] = [

        psCard2(["charcot"], "Active Charcot Neuro-osteoarthropathy", icd: "M14.671",
              inv: [SI(name: "Foot X-ray (weight-bearing)", category: .imaging, rationale: "Baseline; may be normal early"),
                    SI(name: "MRI foot", category: .imaging, rationale: "Bone marrow oedema — active Charcot vs osteomyelitis"),
                    SI(name: "Foot temperature difference (infrared thermometry)", category: .other, rationale: "Activity (> 2 °C)")],
              plan: """
- Suspect active Charcot in a warm, swollen neuropathic foot — it is often misdiagnosed as cellulitis or gout
- Immediate offloading and immobilisation: non-removable knee-high total contact cast (or knee-high walker) until remission (IWGDF 2023; NICE NG19)
- Same-day referral to the multidisciplinary diabetic foot team
""", followUp: "Diabetic foot MDT weekly while active.",
              ref: "IWGDF 2023 Charcot guideline; NICE NG19 (2015, updated 2019)"),

        psCard2(["diabetic foot infection", "osteomyelitis"], "Diabetic Foot Infection / Osteomyelitis", icd: "E11.628",
              inv: [SI(name: "Foot X-ray (plain radiograph)", category: .imaging, rationale: "Osteomyelitis, gas, foreign body (IWGDF/IDSA 2023)"),
                    SI(name: "MRI foot or bone biopsy / bone culture if osteomyelitis is uncertain", category: .imaging, rationale: "IWGDF/IDSA 2023"),
                    SI(name: "Deep tissue samples (curettage) for culture — not superficial swabs", category: .pathology, rationale: "Guide antibiotics"),
                    SI(name: "Vascular assessment: ABPI, toe pressure / TBI, Doppler waveforms", category: .other, rationale: "Ischaemia (calcified vessels give false ABPI)"),
                    SI(name: "FBC, CRP, ESR, U&E, HbA1c; blood cultures if moderate / severe infection", category: .blood, rationale: "Severity; osteomyelitis; bacteraemia")],
              plan: """
- Classify the infection (IWGDF/IDSA 2023: mild / moderate / severe); moderate infection with osteomyelitis → antibiotic per local policy for 6 weeks (or shorter after resection), guided by bone culture
- Offloading (non-removable device where possible); debridement
- Same-day referral to the multidisciplinary foot care service (foot protection team / podiatry) (NICE NG19)
- Severe infection (systemic signs), wet gangrene or deep abscess: urgent surgical debridement / drainage (± amputation) and IV broad-spectrum antibiotics per local policy (e.g. piperacillin-tazobactam) (IWGDF/IDSA 2023)
- Glycaemic control (variable-rate insulin if severe or not eating)
- Ischaemia or absent pulses: vascular referral (duplex / angiography for revascularisation)
""", followUp: "Diabetic foot MDT.",
              ref: "IWGDF / IDSA diabetic foot infection guideline (2023); NICE NG19"),

        psCard2(["diabetic foot ulcer", "neuropathic ulcer", "ischaemic diabetic foot", "chronic limb-threatening ischaemia"],
              "Diabetic Foot Ulcer", icd: "E11.621",
              inv: [SI(name: "Vascular assessment: ABPI with toe pressure / toe-brachial index (TBI) and Doppler waveforms", category: .other, rationale: "Calcified vessels (ABPI > 1.3) → toe pressures (IWGDF 2023)"),
                    SI(name: "Arterial duplex (then CT or MR angiography if revascularisation is considered)", category: .imaging, rationale: "Anatomy for revascularisation (ESVS 2019 CLTI)"),
                    SI(name: "Foot X-ray if deep ulcer or probe-to-bone", category: .imaging, rationale: "Osteomyelitis")],
              plan: """
- Offloading (non-removable knee-high device), debridement and wound care; multidisciplinary foot care service (NICE NG19)
- Antibiotics only if infected (IWGDF/IDSA 2023) — not for an uninfected ulcer
- Ischaemic ulcer / chronic limb-threatening ischaemia: urgent vascular surgery referral for revascularisation (ESVS 2019 Global Vascular Guidelines)
- Glycaemic control; smoking cessation; statin and antiplatelet
""", followUp: "Foot protection service; vascular clinic.",
              ref: "IWGDF 2023; NICE NG19; Global Vascular Guidelines on CLTI (ESVS/SVS 2019)"),

        psCard2(["mesenteric venous thrombosis", "mesenteric vein thrombosis", "portomesenteric"], "Mesenteric Venous Thrombosis", icd: "K55.069",
              inv: [SI(name: "CT abdomen with portal-venous phase contrast", category: .imaging, rationale: "Diagnosis; bowel viability"),
                    SI(name: "Pregnancy test (β-hCG) in a woman of reproductive age — before anticoagulant choice and further imaging", category: .blood, rationale: "Anticoagulant and imaging choice"),
                    SI(name: "FBC, lactate, clotting; thrombophilia screen (before anticoagulation where possible); JAK2 if myeloproliferative features", category: .blood, rationale: "Cause (ESVS 2017)")],
              plan: """
- Immediate anticoagulation with heparin (LMWH or UFH) unless bleeding (ESVS 2017)
- Peritonitis / bowel infarction: laparotomy with resection and planned second look
- Oestrogen-containing contraception / HRT: stop the combined oral contraceptive (VTE risk factor — FSRH/UKMEC)
- Long-term anticoagulation for 3–6 months (longer if unprovoked or thrombophilia) with haematology
""", urgency: "Mesenteric venous thrombosis: anticoagulate now; surgical review.",
              redFlags: ["Peritonism, rising lactate → laparotomy"],
              followUp: "Haematology (thrombophilia, duration); surgical review.",
              ref: "ESVS 2017 mesenteric arterial and venous disease guideline"),

        psCard2(["visible haematuria", "haematuria", "hematuria", "clot retention"], "Visible Haematuria", icd: "R31.0",
              inv: [SI(name: "Flexible cystoscopy", category: .endoscopy, rationale: "Bladder cancer (NICE NG12)"),
                    SI(name: "CT urogram (upper tract imaging)", category: .imaging, rationale: "Upper tract urothelial cancer, stones"),
                    SI(name: "FBC, U&E, group and save; urine culture", category: .blood, rationale: "Blood loss; infection")],
              plan: """
- Unexplained visible haematuria age ≥ 45: urgent suspected cancer pathway (2-week) urology referral (NICE NG12)
- Clot retention: three-way catheter and continuous bladder irrigation; FBC and group and save; cystoscopy once settled
- Anticoagulated: haematuria on anticoagulation is still investigated (cystoscopy + CT urogram)
- Smoking cessation (main risk factor for bladder cancer)
""", followUp: "Urology clinic / cystoscopy results.",
              ref: "NICE NG12 (2015, updated 2023); BAUS haematuria guidance"),

        psCard2(["inguinal lymphadenopathy", "groin lymphadenopathy", "lymphadenopathy"], "Lymphadenopathy (Groin)", icd: "R59.0",
              inv: [SI(name: "Ultrasound of the groin nodes", category: .imaging, rationale: "Node vs hernia; architecture"),
                    SI(name: "Core biopsy or excision biopsy of the node (FNAC not enough for lymphoma)", category: .pathology, rationale: "Histology (BSH)"),
                    SI(name: "FBC, film, LDH, ESR, HIV test", category: .blood, rationale: "Lymphoma / infection")],
              plan: """
- Examine the drainage area (legs, perineum, anal canal, external genitalia) and other node groups; B symptoms → urgent suspected lymphoma referral (NICE NG12)
- Not a hernia: no groin hernia operation
- Haematology / lymphoma MDT with the biopsy result
""", followUp: "Haematology / MDT.",
              ref: "NICE NG12 (2015, updated 2023); BSH lymphoma diagnosis guidance"),

        psCard2(["hypertensive emergency", "hypertensive encephalopathy", "malignant hypertension", "hypertensive crisis"], "Hypertensive Emergency", icd: "I16.1",
              inv: [SI(name: "CT head (brain imaging)", category: .imaging, rationale: "Haemorrhage / PRES"),
                    SI(name: "U&E, FBC and film, urinalysis, troponin, ECG, fundoscopy", category: .blood, rationale: "Target-organ damage")],
              plan: """
\(redirectLine)
- Recognise: severe hypertension with acute target-organ damage (encephalopathy, retinopathy, AKI, pulmonary oedema, aortic dissection)
- IV antihypertensive in a monitored setting (critical care / HDU): labetalol, nicardipine or clevidipine; GTN infusion if pulmonary oedema or acute coronary syndrome (ESC/ESH 2018; ESC 2019 position paper)
- Controlled reduction: mean arterial pressure by 20–25% over the first hour, then cautiously — never to normal quickly (except aortic dissection)
- Pregnancy ≥ 20 weeks: treat as severe pre-eclampsia (obstetric team)
""", urgency: "Hypertensive emergency: \(EmergencyRedirect.text)",
              redFlags: ["Confusion, seizure, visual loss, chest pain → emergency"],
              followUp: "Secondary hypertension work-up after stabilisation.",
              ref: "ESC/ESH 2018 hypertension guideline; ESC Council on Hypertension position paper on hypertensive emergencies (2019)"),

        psCard2(["fever in an infant", "febrile infant", "infant under 3 months", "infant under three months"], "Febrile Infant under 3 Months", icd: "R50.9",
              inv: [SI(name: "Blood culture, FBC, CRP", category: .blood, rationale: "NICE NG143"),
                    SI(name: "Urine sample (clean-catch or catheter specimen) for dipstick and culture", category: .other, rationale: "UTI"),
                    SI(name: "Lumbar puncture (CSF) in infants under 1 month and in unwell infants 1–3 months", category: .other, rationale: "NICE NG143")],
              plan: """
\(redirectLine)
- Recognise: fever ≥ 38 °C in an infant under 3 months is high risk for serious bacterial infection (NICE NG143)
- Same-day paediatric emergency assessment and admission — do not manage in the surgical clinic
- Urine sample and blood tests; IV antibiotics as the paediatric team directs (weight-based — calculate per BNFc)
""", urgency: "Febrile infant under 3 months: \(EmergencyRedirect.text)",
              redFlags: ["Any fever under 3 months → paediatric emergency assessment"],
              followUp: "Paediatric team.",
              ref: "NICE NG143 (2019, updated 2021) Fever in under 5s"),

        psCard2(["asplenia", "hyposplenism"], "Asplenia / Post-splenectomy", icd: "D73.0",
              inv: [SI(name: "Vaccination record", category: .other, rationale: "Green Book chapter 7")],
              plan: """
- Vaccinate (UKHSA Green Book chapter 7): pneumococcal (PCV then PPV23), meningococcal ACWY and B, Haemophilus influenzae type b (Hib), annual influenza — ideally 2 weeks before elective or after emergency splenectomy
- Lifelong (or at least 1–2 years) antibiotic prophylaxis — phenoxymethylpenicillin (clarithromycin if penicillin-allergic), and a standby course for fever
- Education about overwhelming post-splenectomy infection (OPSI), alert card and travel advice (malaria)
""", followUp: "GP recall for boosters; annual influenza.",
              ref: "UKHSA Green Book chapter 7 (asplenia); BCSH 2011 prevention of infection in asplenia"),

        psCard2(["acute hepatitis", "hepatitis a", "viral hepatitis"], "Acute Viral Hepatitis", icd: "B15.9",
              inv: [SI(name: "LFTs, INR / prothrombin time (synthetic function)", category: .blood, rationale: "Acute liver failure screen"),
                    SI(name: "Viral hepatitis serology: hepatitis A IgM, HBsAg, anti-HBc IgM, anti-HCV (± hepatitis E IgM)", category: .blood, rationale: "Cause"),
                    SI(name: "Liver ultrasound", category: .imaging, rationale: "Exclude biliary obstruction")],
              plan: """
- Supportive care; avoid alcohol and hepatotoxic drugs; paracetamol only at reduced dose with specialist advice
- INR > 1.5 or encephalopathy: acute liver failure — urgent hepatology referral
- Notify public health (notifiable); household contacts offered vaccination / post-exposure prophylaxis
- No surgical or endoscopic intervention is indicated for hepatitis without obstruction
""", followUp: "Repeat LFTs and INR in 1–2 weeks.",
              ref: "UKHSA hepatitis A guidance (2019); EASL acute liver failure guideline (2017)"),
    ]
}
