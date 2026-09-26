// DiagnosisRadiationEngine+DiseaseDictionary2a.swift
// Surgical disease dictionary — Hernia & Abdominal Wall, Upper GI, Breast.

import Foundation

extension DiagnosisRadiationEngine {

    static let _surgicalEntries2: [Entry] = [

        // SURGICAL — HERNIA & ABDOMINAL WALL
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["inguinal hernia"], radiation: .init(
            conditionName: "Inguinal Hernia",
            icd10Primary: "K40.90",
            investigations: [
                .init(name: "Ultrasound — Groin", category: .imaging, rationale: "If diagnosis in doubt — confirm hernia vs hydrocele/lymph node"),
                .init(name: "FBC / U&E; ECG only if age ≥ 65 or cardiovascular, renal or diabetic disease (NICE NG45)", category: .blood, rationale: "Pre-operative assessment"),
                .init(name: "Group and Save", category: .blood, rationale: "Pre-operative"),
            ],
            planTemplate: """
- Elective laparoscopic (TEP/TAPP) or open hernia repair
- Strangulated / obstructed (tender, irreducible, small bowel obstruction): emergency surgery — emergency hernia repair with assessment of bowel viability ± resection; do not attempt reduction if strangulation is suspected (WSES 2017; HerniaSurge 2018)
- Truss if patient unfit for surgery
- Advise: avoid heavy lifting >5 kg until review
- Pre-op: weight optimisation (BMI >35 → increased risk), smoking cessation
- Bilateral inguinal hernia: laparoscopic TEP preferred (single anaesthetic)
- Consent: risk of recurrence (~2%), chronic groin pain, injury to vas/testicular vessels
""",
            billingCodes: [
                .init(icd10: "K40.90", icdDescription: "Unilateral inguinal hernia", cpt: "49505", cptDescription: "Repair initial inguinal hernia, age 5+, reducible"),
                .init(icd10: "K40.90", icdDescription: "Unilateral inguinal hernia", cpt: "49650", cptDescription: "Laparoscopic repair of initial inguinal hernia"),
            ],
            consentCategory: "Inguinal Hernia Repair",
            urgencyNote: nil,
            redFlags: ["Irreducible → emergency repair", "Obstructed bowel → emergency OT"],
            followUp: "Review 6 weeks post-repair. Return precautions: sudden pain, non-reducible → ER.",
            guidelineReference: "HerniaSurge 2018; EHS Guidelines"
        )),

        Entry(keywords: ["umbilical hernia", "paraumbilical hernia"], radiation: .init(
            conditionName: "Umbilical / Paraumbilical Hernia",
            icd10Primary: "K42.9",
            investigations: [
                .init(name: "Abdominal Ultrasound", category: .imaging, rationale: "Hernia content — exclude bowel / omentum"),
                .init(name: "Pre-op bloods: FBC / U&E", category: .blood, rationale: "Pre-operative baseline — no routine clotting test before elective surgery; clotting only with liver disease, a vitamin K antagonist or heparin, a bleeding disorder or jaundice (NICE NG45)"),
            ],
            planTemplate: """
- Elective umbilical hernia repair (open Mayo repair or laparoscopic mesh)
- Umbilical / epigastric defect ≥ 1 cm: mesh repair (preperitoneal or retromuscular flat mesh); defect < 1 cm: suture repair may be considered (EHS/AHS 2020)
- Smoking cessation and weight optimisation before elective repair where possible (BMI >35 increases recurrence)
- Cirrhosis with ascites: control ascites first (diuretics, therapeutic paracentesis ± TIPS) with hepatology before repair; thinning or ulcerated skin → urgent repair because of the rupture risk (EASL 2018; EHS)
- Advise against heavy lifting and straining
- Consent: recurrence, mesh complications, wound infection
""",
            billingCodes: [
                .init(icd10: "K42.9", icdDescription: "Umbilical hernia without obstruction or gangrene", cpt: "49585", cptDescription: "Repair umbilical hernia, reducible"),
            ],
            consentCategory: "Umbilical Hernia Repair",
            urgencyNote: nil,
            redFlags: ["Acute onset irreducibility → emergency OT"],
            followUp: "Review 6 weeks post-repair.",
            guidelineReference: "EHS/AHS 2020 umbilical and epigastric hernia guideline; EHS 2019 Guidelines"
        )),

        // ══════════════════════════════════════════════════════════════
        // SURGICAL — UPPER GI
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["peptic ulcer", "gastric ulcer", "duodenal ulcer"], radiation: .init(
            conditionName: "Peptic Ulcer Disease",
            icd10Primary: "K27.90",
            investigations: [
                .init(name: "OGD (Oesophagogastroduodenoscopy)", category: .endoscopy, rationale: "Visualise, biopsy, H. pylori CLO test"),
                .init(name: "H. pylori — Urea Breath Test or Stool Antigen", category: .other, rationale: "Identify treatable cause"),
                .init(name: "FBC", category: .blood, rationale: "Anaemia from bleeding ulcer"),
                .init(name: "LFTs / U&E", category: .blood, rationale: "Baseline — guide NSAID use"),
            ],
            planTemplate: """
- Stop NSAIDs; use paracetamol instead. Low-dose aspirin for secondary prevention: continue (or restart once haemostasis is secure) with PPI cover — decide with cardiology / neurology (BSG/ESGE 2021; NICE CG184)
- PPI: omeprazole 40 mg OD × 8 weeks (healing dose)
- If H. pylori positive: triple therapy — clarithromycin 500 mg + amoxicillin 1 g + omeprazole 20 mg BD × 7–14 days
- Penicillin allergy: penicillin-free regimen — bismuth quadruple therapy (PPI + bismuth + tetracycline + metronidazole) (Maastricht VI / Florence 2022)
- Repeat breath test 4–6 weeks after eradication
- Avoid alcohol and smoking
- Repeat OGD at 8 weeks for gastric ulcers (exclude malignancy)
- If bleeding ulcer: IV PPI (esomeprazole 80 mg bolus then 8 mg/h × 72h) + endoscopic haemostasis
""",
            billingCodes: [
                .init(icd10: "K27.90", icdDescription: "Peptic ulcer, unspecified", cpt: "43239", cptDescription: "EGD with biopsy"),
            ],
            consentCategory: nil,
            urgencyNote: nil,
            redFlags: ["Haematemesis / melaena → urgent OGD within 24h", "Perforation → emergency OT",
                       "NSAID use (including over-the-counter ibuprofen / diclofenac) — stop it; bleeding and perforation risk"],
            followUp: "OGD at 8 weeks for gastric ulcer. Breath test 4 weeks post-eradication.",
            guidelineReference: "NICE CG17; ACG 2017; Maastricht VI / Florence 2022"
        )),

        Entry(keywords: ["gerd", "gord", "reflux", "oesophagitis", "barrett"], radiation: .init(
            conditionName: "GERD / GORD / Oesophagitis",
            icd10Primary: "K21.00",
            investigations: [
                .init(name: "OGD", category: .endoscopy, rationale: "Grade oesophagitis (Los Angeles), exclude Barrett's / carcinoma"),
                .init(name: "24-hour pH Impedance Study", category: .other, rationale: "If PPI-refractory or pre-surgical"),
                .init(name: "H. pylori Testing", category: .other, rationale: "Test and treat"),
                .init(name: "Barium Swallow", category: .imaging, rationale: "Hiatus hernia characterisation"),
            ],
            planTemplate: """
- Lifestyle: head of bed elevation 15–20 cm, avoid lying flat for 3h post meals
- Weight loss + small frequent meals; avoid fatty/spicy food, caffeine, alcohol, smoking
- PPI: omeprazole 20–40 mg OD before breakfast × 8 weeks; maintenance if recurrent
- Antacids PRN: Gaviscon after meals and at bedtime
- If PPI-refractory: laparoscopic Nissen fundoplication — discuss
- Barrett's oesophagus: long-term PPI + surveillance OGD every 2–3 years
""",
            billingCodes: [
                .init(icd10: "K21.00", icdDescription: "GORD with oesophagitis", cpt: "43239", cptDescription: "EGD with biopsy"),
                .init(icd10: "K44.9", icdDescription: "Diaphragmatic hernia", cpt: "43280", cptDescription: "Laparoscopic repair of paraesophageal hernia"),
            ],
            consentCategory: nil,
            urgencyNote: nil,
            redFlags: ["Progressive dysphagia → exclude carcinoma urgently (OGD within 2 weeks)",
                       "Weight loss, anaemia or age ≥ 55 with weight loss → suspected upper GI cancer: urgent 2-week OGD (NICE NG12)"],
            followUp: "Review 8 weeks. Barrett's: OGD surveillance per guideline.",
            guidelineReference: "NICE CG30; ACG 2022; BSG Barrett's Guidelines"
        )),

        Entry(keywords: ["oesophageal carcinoma", "esophageal cancer", "oesophageal cancer"], radiation: .init(
            conditionName: "Oesophageal Carcinoma",
            icd10Primary: "C15.9",
            investigations: [
                .init(name: "OGD + Biopsy", category: .endoscopy, rationale: "Tissue diagnosis — mandatory"),
                .init(name: "CT Chest / Abdomen / Pelvis", category: .imaging, rationale: "Staging — lymph nodes, distant metastases"),
                .init(name: "Endoscopic Ultrasound (EUS)", category: .endoscopy, rationale: "T and N staging — local invasion"),
                .init(name: "PET-CT", category: .imaging, rationale: "Distant metastasis / node positivity"),
                .init(name: "FBC / U&E / LFTs / Albumin", category: .blood, rationale: "Nutritional status and fitness"),
                .init(name: "Lung function tests", category: .other, rationale: "If oesophagectomy planned"),
            ],
            planTemplate: """
- URGENT MDT referral — upper GI oncology
- Nutritional support: RD referral; nasogastric / jejunostomy feeding if needed
- Staging: CT + EUS + PET-CT
- Resectable disease: neoadjuvant chemotherapy (FLOT/CROSS) → oesophagectomy
- Locally advanced / metastatic: palliative chemo (FLOT, carboplatin/paclitaxel) ± stenting
- Oesophageal stenting for dysphagia palliation
- Dietitian + palliative care referral
""",
            billingCodes: [
                .init(icd10: "C15.9", icdDescription: "Malignant neoplasm of oesophagus, unspecified", cpt: "43107", cptDescription: "Total or near-total oesophagectomy"),
            ],
            consentCategory: "Oesophagectomy",
            urgencyNote: "URGENT — 2-week wait MDT referral. Nutritional support immediately.",
            redFlags: ["Complete obstruction → urgent stenting", "Haematemesis → urgent endoscopy"],
            followUp: "MDT within 1 week. Oncology review within 2 weeks.",
            guidelineReference: "NICE NG83; ESMO 2023"
        )),

        // ══════════════════════════════════════════════════════════════
        // SURGICAL — BREAST
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["breast carcinoma", "breast cancer", "breast malignancy"], radiation: .init(
            conditionName: "Breast Carcinoma",
            icd10Primary: "C50.919",
            investigations: [
                .init(name: "Mammogram (bilateral)", category: .imaging, rationale: "Triple assessment — imaging"),
                .init(name: "Ultrasound — Breast", category: .imaging, rationale: "Lesion characterisation — especially <35y"),
                .init(name: "Core needle biopsy", category: .pathology, rationale: "Tissue diagnosis — ER/PR/HER2 receptors"),
                .init(name: "FBC / U&E / LFTs / ALP / Calcium", category: .blood, rationale: "Staging — bone/liver mets"),
                .init(name: "CT Chest / Abdomen / Pelvis", category: .imaging, rationale: "Staging if high-grade or locally advanced"),
                .init(name: "Bone scan / PET-CT", category: .imaging, rationale: "If T3/T4 or symptomatic"),
            ],
            planTemplate: """
- URGENT MDT referral — breast oncology
- Receptor status (ER/PR/HER2) drives systemic therapy decision
- Early stage (not for inflammatory breast cancer): wide local excision + sentinel node biopsy ± mastectomy
- Inflammatory breast cancer: urgent breast oncology MDT; neoadjuvant systemic therapy first, then modified radical mastectomy with axillary node dissection and post-mastectomy radiotherapy (NCCN). Breast-conserving surgery (wide local excision) and sentinel node biopsy are not recommended in inflammatory breast cancer (NCCN)
- Adjuvant: endocrine therapy if ER+ (tamoxifen / aromatase inhibitor), Herceptin if HER2+
- BRCA testing if strong FH or <45y
- Breast reconstruction discussion pre-operatively
- Oncology referral for chemotherapy if node-positive or triple-negative
""",
            billingCodes: [
                .init(icd10: "C50.919", icdDescription: "Malignant neoplasm of breast", cpt: "19307", cptDescription: "Mastectomy, modified radical"),
                .init(icd10: "C50.919", icdDescription: "Malignant neoplasm of breast", cpt: "19301", cptDescription: "Partial mastectomy"),
            ],
            consentCategory: "Mastectomy / Wide Local Excision",
            urgencyNote: "URGENT — 2-week wait. MDT referral today.",
            redFlags: ["Inflammatory breast cancer (skin oedema, erythema) → urgent admit"],
            followUp: "MDT within 1 week. Surgery within 3 weeks of diagnosis.",
            guidelineReference: "NICE NG101; ASCO/ASTRO 2023; St Gallen 2023"
        )),

    ]

}
