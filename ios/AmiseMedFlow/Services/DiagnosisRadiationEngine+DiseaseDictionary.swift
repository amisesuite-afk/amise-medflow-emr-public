// DiagnosisRadiationEngine+DiseaseDictionary.swift
// Full disease dictionary (surgical specialties).
// allEntries aggregates surgical + medical sub-arrays for engine access.

extension DiagnosisRadiationEngine {

    // MARK: - Entry point (surgical + medical)
    static let allEntries: [Entry] = _surgicalEntries + _medicalEntries

    // MARK: - Surgical specialties
    // Hepatobiliary, Appendix/Acute Abdomen, Colorectal, Hernia,
    // Upper GI, Breast

    static let _surgicalEntries: [Entry] = [

        // ══════════════════════════════════════════════════════════════
        // SURGICAL — HEPATOBILIARY
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["biliary colic"], radiation: .init(
            conditionName: "Biliary Colic",
            icd10Primary: "K80.20",
            investigations: [
                .init(name: "Abdominal Ultrasound", category: .imaging, rationale: "Confirm gallstones, CBD diameter"),
                .init(name: "FBC", category: .blood, rationale: "Baseline"),
                .init(name: "LFTs / Bilirubin / ALP / GGT", category: .blood, rationale: "Exclude biliary obstruction"),
                .init(name: "Amylase / Lipase", category: .blood, rationale: "Exclude gallstone pancreatitis"),
            ],
            planTemplate: """
- Analgesia: diclofenac suppository 100 mg PR stat (if no contraindication) + Buscopan 20 mg IV/IM
- Low-fat diet counselling
- Refer for elective laparoscopic cholecystectomy
- Repeat USS in 6 weeks if equivocal
- Return precautions: fever, jaundice, worsening pain → ER
""",
            billingCodes: [
                .init(icd10: "K80.20", icdDescription: "Calculus of gallbladder without cholecystitis", cpt: "47562", cptDescription: "Laparoscopic cholecystectomy"),
            ],
            consentCategory: "Laparoscopic Cholecystectomy",
            urgencyNote: nil,
            redFlags: ["Fever → may be cholecystitis", "Jaundice → CBD stone", "Worsening pain → admit"],
            followUp: "Review 4–6 weeks with repeat USS and LFTs. Book elective cholecystectomy.",
            guidelineReference: "NICE CG188; SAGES Cholecystectomy Guidelines"
        )),

        Entry(keywords: ["acute cholecystitis", "cholecystitis"], radiation: .init(
            conditionName: "Acute Cholecystitis",
            icd10Primary: "K81.0",
            investigations: [
                .init(name: "Abdominal Ultrasound", category: .imaging, rationale: "Wall thickening, pericholecystic fluid, gallstones"),
                .init(name: "FBC", category: .blood, rationale: "WBC — infection severity"),
                .init(name: "CRP", category: .blood, rationale: "Inflammatory marker — Tokyo guidelines"),
                .init(name: "LFTs / Bilirubin", category: .blood, rationale: "CBD involvement"),
                .init(name: "Amylase / Lipase", category: .blood, rationale: "Exclude pancreatitis"),
                .init(name: "Blood cultures (×2)", category: .blood, rationale: "If febrile >38.5°C"),
                .init(name: "Urine MC&S", category: .other, rationale: "Exclude UTI as alternative source"),
            ],
            planTemplate: """
- IV access + IV fluids (0.9% NaCl 1 L over 4–6h)
- Analgesia: morphine 0.1 mg/kg IV/IM + antiemetic
- Antibiotics: Amoxicillin-clavulanate 1.2 g IV 8-hourly (or piperacillin-tazobactam if severe)
- NBM / low-fat diet
- Consider early laparoscopic cholecystectomy within 72h (Grade I–II Tokyo)
- Surgical referral / admission
- Repeat USS if not improving at 24–48h
""",
            billingCodes: [
                .init(icd10: "K81.0", icdDescription: "Acute cholecystitis", cpt: "47562", cptDescription: "Laparoscopic cholecystectomy"),
                .init(icd10: "K81.0", icdDescription: "Acute cholecystitis", cpt: "47563", cptDescription: "Laparoscopic cholecystectomy with IOC"),
            ],
            consentCategory: "Laparoscopic Cholecystectomy",
            urgencyNote: "Consider same-day surgical admission. Early cholecystectomy reduces complications.",
            redFlags: ["Septic shock → ICU", "Perforation signs → emergency OT", "CBD dilation → ERCP first"],
            followUp: "Post-cholecystectomy review 2 weeks.",
            guidelineReference: "Tokyo Guidelines 2018 (TG18)"
        )),

        Entry(keywords: ["choledocholithiasis", "cbd stone", "common bile duct stone"], radiation: .init(
            conditionName: "Choledocholithiasis",
            icd10Primary: "K80.50",
            investigations: [
                .init(name: "Abdominal Ultrasound", category: .imaging, rationale: "CBD diameter — >6 mm suggests obstruction"),
                .init(name: "MRCP", category: .imaging, rationale: "Gold standard non-invasive CBD stone detection"),
                .init(name: "LFTs / Bilirubin / ALP / GGT", category: .blood, rationale: "Obstructive pattern"),
                .init(name: "FBC / CRP", category: .blood, rationale: "Cholangitis screen"),
                .init(name: "INR / Coagulation", category: .blood, rationale: "Pre-ERCP"),
                .init(name: "Group and Save", category: .blood, rationale: "Pre-procedure"),
            ],
            planTemplate: """
- ERCP ± sphincterotomy + stone extraction (primary intervention)
- Post-ERCP: plan laparoscopic cholecystectomy within same admission or 6 weeks
- Antibiotics if cholangitis: piperacillin-tazobactam 4.5 g IV 8-hourly
- NBM for ERCP
- Consent for ERCP + cholecystectomy as staged procedures
""",
            billingCodes: [
                .init(icd10: "K80.50", icdDescription: "Calculus of bile duct without cholangitis or cholecystitis", cpt: "43264", cptDescription: "ERCP with removal of calculi from biliary and/or pancreatic ducts"),
            ],
            consentCategory: "ERCP",
            urgencyNote: "If Charcot's triad (fever + jaundice + RUQ pain): ascending cholangitis — admit urgently.",
            redFlags: ["Charcot's triad → ascending cholangitis → urgent ERCP", "Reynolds' pentad → septic shock → ICU"],
            followUp: "Review 2 weeks post-ERCP. Schedule cholecystectomy if not done.",
            guidelineReference: "ASGE 2019; ESGE 2019"
        )),

        Entry(keywords: ["ascending cholangitis", "cholangitis"], radiation: .init(
            conditionName: "Ascending Cholangitis",
            icd10Primary: "K83.09",
            investigations: [
                .init(name: "FBC + CRP + Blood cultures ×2", category: .blood, rationale: "Sepsis workup — culture before antibiotics"),
                .init(name: "LFTs / Bilirubin / ALP / GGT", category: .blood, rationale: "Obstructive jaundice pattern"),
                .init(name: "INR / PT", category: .blood, rationale: "Coagulopathy in severe cholangitis"),
                .init(name: "Abdominal Ultrasound", category: .imaging, rationale: "CBD dilation, gallstones"),
                .init(name: "MRCP", category: .imaging, rationale: "CBD stone characterisation"),
                .init(name: "Lactate", category: .blood, rationale: "Severity — septic shock marker"),
                .init(name: "U&E / Creatinine", category: .blood, rationale: "AKI — organ failure"),
            ],
            planTemplate: """
- ADMIT — sepsis pathway
- IV access × 2 + aggressive fluid resuscitation
- Antibiotics: piperacillin-tazobactam 4.5 g IV 8-hourly (or meropenem if severe)
- Urgent ERCP ± biliary decompression within 12–24h (Tokyo Grade II) or 12h (Grade III)
- Repeat LFTs + cultures at 48h
- ICU consult if Reynolds' pentad present
""",
            billingCodes: [
                .init(icd10: "K83.09", icdDescription: "Other specified diseases of biliary tract", cpt: "43264", cptDescription: "ERCP with biliary stone removal"),
            ],
            consentCategory: "ERCP",
            urgencyNote: "URGENT — Charcot's triad present. Admit. ERCP within 12–24h.",
            redFlags: ["Confusion + hypotension (Reynolds' pentad) → ICU + emergency decompression"],
            followUp: "Post-ERCP review 48h. Elective cholecystectomy after resolution.",
            guidelineReference: "Tokyo Guidelines 2018 — Grade II/III Cholangitis"
        )),

        Entry(keywords: ["acute pancreatitis", "pancreatitis"], radiation: .init(
            conditionName: "Acute Pancreatitis",
            icd10Primary: "K85.90",
            investigations: [
                .init(name: "Amylase / Lipase (×3 ULN)", category: .blood, rationale: "Diagnostic confirmation"),
                .init(name: "FBC / CRP", category: .blood, rationale: "Severity — CRP >150 at 48h = severe"),
                .init(name: "U&E / Creatinine / LFTs / Glucose", category: .blood, rationale: "Organ function, aetiology"),
                .init(name: "Calcium", category: .blood, rationale: "Hypercalcaemia as cause"),
                .init(name: "Triglycerides", category: .blood, rationale: "Hypertriglyceridaemia as cause"),
                .init(name: "Abdominal Ultrasound", category: .imaging, rationale: "Gallstone aetiology (within 24h)"),
                .init(name: "CECT Abdomen (Balthazar)", category: .imaging, rationale: "Severity — if CRP >150 or not improving at 48–72h"),
                .init(name: "Blood cultures", category: .blood, rationale: "If infected necrosis suspected"),
            ],
            planTemplate: """
- ADMIT — monitor fluid balance strictly
- IV fluids: Hartmann's 250–500 mL/h initially (aggressive resuscitation in first 24h)
- Analgesia: morphine IV/IM + antiemetic
- NBM initially; early oral/NG feeding within 24–48h if tolerated (reduces complications)
- Glasgow / Ranson scoring at 48h
- ERCP within 72h if gallstone aetiology + cholangitis
- Surgical/HDU input if CRP >150 or organ failure
- Alcohol counselling if alcohol aetiology
""",
            billingCodes: [
                .init(icd10: "K85.90", icdDescription: "Acute pancreatitis, unspecified", cpt: nil, cptDescription: "Medical management"),
                .init(icd10: "K80.50", icdDescription: "Biliary calculus — if gallstone aetiology", cpt: "43264", cptDescription: "ERCP if cholangitis"),
            ],
            consentCategory: nil,
            urgencyNote: "Admit. Assess severity (Glasgow/Ranson). Review at 24h and 48h.",
            redFlags: ["Glasgow ≥3 → severe → HDU", "Organ failure → ICU", "Infected necrosis → surgery or drainage"],
            followUp: "Review 4–6 weeks. Cholecystectomy before discharge if gallstone aetiology. Repeat USS.",
            guidelineReference: "BSG 2022; IAP/APA 2013; Atlanta Classification 2012"
        )),

        // ══════════════════════════════════════════════════════════════
        // SURGICAL — APPENDIX / ACUTE ABDOMEN
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["acute appendicitis", "appendicitis"], radiation: .init(
            conditionName: "Acute Appendicitis",
            icd10Primary: "K37",
            investigations: [
                .init(name: "FBC / CRP", category: .blood, rationale: "Leukocytosis + elevated CRP"),
                .init(name: "Urine dipstick / MC&S", category: .other, rationale: "Exclude UTI / ureteric colic"),
                .init(name: "BHCG (females <55y)", category: .blood, rationale: "Exclude ectopic pregnancy"),
                .init(name: "Abdominal Ultrasound", category: .imaging, rationale: "First-line — appendix diameter >6 mm + non-compressible"),
                .init(name: "CT Abdomen / Pelvis (with contrast)", category: .imaging, rationale: "If USS equivocal — sensitivity 94%"),
                .init(name: "U&E / Creatinine", category: .blood, rationale: "Pre-operative baseline"),
                .init(name: "Group and Save", category: .blood, rationale: "Pre-operative"),
                .init(name: "Alvarado / APPENDIX Score", category: .other, rationale: "Structured scoring for operative decision"),
            ],
            planTemplate: """
- ADMIT — surgical assessment
- IV access + IV fluids
- Analgesia: morphine 0.1 mg/kg IV/IM + ondansetron 4 mg IV
- NBM — prepare for theatre
- IV antibiotics pre-op: cefazolin 2 g + metronidazole 500 mg IV
- Laparoscopic appendicectomy (preferred) — consent + book OT
- Alvarado score: >7 → operate without CT; 5–6 → further imaging; <5 → observe
- Post-op: early mobilisation, discharge at 24–48h if uncomplicated
""",
            billingCodes: [
                .init(icd10: "K37", icdDescription: "Unspecified appendicitis", cpt: "44950", cptDescription: "Appendectomy"),
                .init(icd10: "K37", icdDescription: "Unspecified appendicitis", cpt: "44970", cptDescription: "Laparoscopic appendectomy"),
            ],
            consentCategory: "Laparoscopic Appendicectomy",
            urgencyNote: "URGENT — prepare for theatre. NBM. IV antibiotics within 1h of diagnosis.",
            redFlags: ["Perforation signs → emergency OT", "Peritonitis → aggressive fluid resuscitation"],
            followUp: "Post-op review 2 weeks. Histology review.",
            guidelineReference: "NICE NG61; SAGES Guidelines; Alvarado Score",
            scoringCriteria: .init(
                scoreName: "Alvarado Score (MANTRELS)",
                variables: [
                    // Symptoms — binary
                    .init(id: "alv_migration", label: "Migration of pain to RIF",  unit: "", hint: "periumbilical → RIF",    cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "alv_anorexia",  label: "Anorexia",                 unit: "", hint: "loss of appetite",        cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "alv_nausea",    label: "Nausea / Vomiting",         unit: "", hint: "",                        cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    // Signs — binary, RIF tenderness weighted ×2
                    .init(id: "alv_rif",       label: "RIF tenderness",            unit: "", hint: "direct palpation",        cutoffValue: 0, cutoffIsAbove: true, points: 2, isBinary: true),
                    .init(id: "alv_rebound",   label: "Rebound tenderness",        unit: "", hint: "Blumberg sign",           cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    // Labs
                    .init(id: "alv_temp",      label: "Elevated temperature",      unit: "°C",     hint: "> 37.3°C scores",  cutoffValue: 37.3, cutoffIsAbove: true,  points: 1, isBinary: false),
                    .init(id: "alv_wbc",       label: "Leukocytosis",              unit: "×10⁹/L", hint: "> 10 scores ×2",   cutoffValue: 10,   cutoffIsAbove: true,  points: 2, isBinary: false),
                    .init(id: "alv_shift",     label: "Left shift (neutrophils)",  unit: "%",      hint: "> 75% scores",     cutoffValue: 75,   cutoffIsAbove: true,  points: 1, isBinary: false),
                ],
                severeThreshold: 7,
                maxScore: 10,
                timingNote: "≥7 → operate; 5–6 → CT / observe; <5 → unlikely appendicitis",
                aboveThresholdLabel: "OPERATE",
                belowThresholdLabel: "OBSERVE / CT"
            )
        )),

        // ══════════════════════════════════════════════════════════════
        // SURGICAL — COLORECTAL / LOWER GI
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["colorectal carcinoma", "colorectal cancer", "colon cancer", "rectal cancer", "bowel cancer"], radiation: .init(
            conditionName: "Colorectal Carcinoma",
            icd10Primary: "C18.9",
            investigations: [
                .init(name: "FBC", category: .blood, rationale: "Iron deficiency anaemia — common presentation"),
                .init(name: "CEA", category: .blood, rationale: "Tumour marker — baseline and monitoring"),
                .init(name: "LFTs / ALP", category: .blood, rationale: "Liver metastases screen"),
                .init(name: "Colonoscopy + Biopsy", category: .endoscopy, rationale: "Gold standard — visualise and tissue diagnosis"),
                .init(name: "CT Chest / Abdomen / Pelvis (staging)", category: .imaging, rationale: "TNM staging — liver, lung, lymph nodes"),
                .init(name: "MRI Pelvis", category: .imaging, rationale: "Rectal cancer — CRM, local invasion"),
                .init(name: "Carcinoembryonic Antigen (CEA)", category: .blood, rationale: "Pre-operative baseline"),
                .init(name: "Group and Save / Cross-match", category: .blood, rationale: "Pre-operative"),
            ],
            planTemplate: """
- MDT referral — colorectal oncology
- Staging workup as above
- Bowel prep protocol pre-colonoscopy / pre-operatively
- Enhanced recovery after surgery (ERAS) pathway
- Stoma nurse referral if resection likely
- Consent: right / left hemicolectomy vs anterior resection vs abdominoperineal resection
- Neoadjuvant chemoradiation if locally advanced rectal cancer (MRI guided)
- Post-op follow-up: colonoscopy at 1 year, then 3-yearly; CEA 3-monthly × 2 years
""",
            billingCodes: [
                .init(icd10: "C18.9", icdDescription: "Malignant neoplasm of colon, unspecified", cpt: "44204", cptDescription: "Laparoscopic colectomy"),
                .init(icd10: "C19", icdDescription: "Malignant neoplasm of rectosigmoid junction", cpt: "44207", cptDescription: "Laparoscopic colectomy with anastomosis"),
            ],
            consentCategory: "Colorectal Resection",
            urgencyNote: "Urgent oncology referral. Target 2-week wait for staging CT.",
            redFlags: ["Obstruction → stenting or emergency surgery", "Perforation → emergency OT + peritonitis management"],
            followUp: "MDT within 2 weeks. Surgery within 4–6 weeks of diagnosis. CEA quarterly.",
            guidelineReference: "NICE NG12; ESMO 2022; ASCO-SSO Guidelines"
        )),

        Entry(keywords: ["haemorrhoid", "hemorrhoid", "piles", "internal haemorrhoid", "external haemorrhoid"], radiation: .init(
            conditionName: "Haemorrhoids",
            icd10Primary: "K64.9",
            investigations: [
                .init(name: "FBC", category: .blood, rationale: "Anaemia if chronic blood loss"),
                .init(name: "Flexible Sigmoidoscopy / Proctoscopy", category: .endoscopy, rationale: "Grade and assess — exclude higher pathology"),
                .init(name: "Colonoscopy (if >50y or red flags)", category: .endoscopy, rationale: "Exclude colorectal carcinoma"),
            ],
            planTemplate: """
- Grade I–II: conservative — high-fibre diet, adequate hydration, Sitz baths
- Topical: hydrocortisone + lidocaine cream (Anusol HC, Proctosedyl)
- Grade II–III: rubber band ligation (outpatient) — arrange
- Grade III–IV or failed banding: haemorrhoidectomy
- Avoid constipation — lactulose 15 mL BD or Movicol
- Dietary counselling: 25–35 g fibre/day
""",
            billingCodes: [
                .init(icd10: "K64.9", icdDescription: "Unspecified haemorrhoids", cpt: "46221", cptDescription: "Haemorrhoid ligation"),
                .init(icd10: "K64.9", icdDescription: "Unspecified haemorrhoids", cpt: "46260", cptDescription: "Haemorrhoidectomy, internal and external"),
            ],
            consentCategory: "Haemorrhoidectomy",
            urgencyNote: nil,
            redFlags: ["Haemoglobin <8 g/dL → transfuse", "Age >50 + change in bowel habit → colonoscopy"],
            followUp: "Review 6 weeks after banding. Colonoscopy if any red flags present.",
            guidelineReference: "ASCRS 2020; NICE CKS"
        )),

        Entry(keywords: ["anal fissure", "fissure in ano"], radiation: .init(
            conditionName: "Anal Fissure",
            icd10Primary: "K60.2",
            investigations: [
                .init(name: "Proctoscopy / Examination under anaesthesia (if too painful)", category: .endoscopy, rationale: "Confirm fissure, exclude Crohn's"),
                .init(name: "FBC", category: .blood, rationale: "If anaemia suspected"),
            ],
            planTemplate: """
- High-fibre diet + adequate hydration
- Topical: 0.2% glyceryl trinitrate ointment (GTN) BD × 8 weeks (first-line)
- Alternative: diltiazem 2% cream BD × 8 weeks
- Sitz baths after defaecation
- Stool softener: lactulose or Movicol
- If chronic / failed medical: lateral internal sphincterotomy
- Botulinum toxin injection: alternative to surgery
""",
            billingCodes: [
                .init(icd10: "K60.2", icdDescription: "Anal fissure, unspecified", cpt: "46080", cptDescription: "Anal sphincterotomy"),
                .init(icd10: "K60.2", icdDescription: "Anal fissure, unspecified", cpt: "46999", cptDescription: "Unlisted procedure, anus"),
            ],
            consentCategory: "Lateral Internal Sphincterotomy",
            urgencyNote: nil,
            redFlags: ["Non-healing fissure → Crohn's / carcinoma — biopsy"],
            followUp: "Review 8 weeks — if not healed on GTN, refer for surgery.",
            guidelineReference: "ASCRS 2022; NICE CKS; ACPGBI"
        )),

        Entry(keywords: ["perianal abscess", "anorectal abscess"], radiation: .init(
            conditionName: "Perianal Abscess",
            icd10Primary: "K61.0",
            investigations: [
                .init(name: "FBC / CRP", category: .blood, rationale: "Sepsis severity"),
                .init(name: "Blood glucose / HbA1c", category: .blood, rationale: "Diabetes — increased risk and poor healing"),
                .init(name: "Examination under anaesthesia (EUA)", category: .other, rationale: "Define anatomy, exclude fistula"),
            ],
            planTemplate: """
- URGENT: incision and drainage under anaesthesia (day surgery / emergency)
- Do NOT prescribe antibiotics without drainage — ineffective alone
- Post-drainage: wound packing, twice-daily dressing
- Fistula screen at time of EUA — probe gently
- Microbiological swab of pus
- If fistula found: seton placement / Ligation of intersphincteric fistula tract (LIFT)
""",
            billingCodes: [
                .init(icd10: "K61.0", icdDescription: "Anal abscess", cpt: "46040", cptDescription: "Incision and drainage of ischiorectal or ischianal abscess"),
            ],
            consentCategory: "Incision and Drainage — Perianal Abscess",
            urgencyNote: "URGENT — arrange I&D within 24h. Do not prescribe antibiotics alone.",
            redFlags: ["Necrotising fasciitis signs → emergency wide debridement + ICU"],
            followUp: "Review 2 weeks. If fistula: definitive repair.",
            guidelineReference: "ASCRS 2022; ACPGBI Guidelines"
        )),

        // ══════════════════════════════════════════════════════════════
        // SURGICAL — HERNIA & ABDOMINAL WALL
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["inguinal hernia"], radiation: .init(
            conditionName: "Inguinal Hernia",
            icd10Primary: "K40.90",
            investigations: [
                .init(name: "Ultrasound — Groin", category: .imaging, rationale: "If diagnosis in doubt — confirm hernia vs hydrocele/lymph node"),
                .init(name: "FBC / U&E / ECG", category: .blood, rationale: "Pre-operative assessment"),
                .init(name: "Group and Save", category: .blood, rationale: "Pre-operative"),
            ],
            planTemplate: """
- Elective laparoscopic (TEP/TAPP) or open hernia repair
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
                .init(name: "Pre-op bloods: FBC / U&E / Clotting", category: .blood, rationale: "Pre-operative baseline"),
            ],
            planTemplate: """
- Elective umbilical hernia repair (open Mayo repair or laparoscopic mesh)
- >2 cm defect: mesh reinforcement recommended
- Optimise: weight loss (BMI >35 increases recurrence), treat ascites if cirrhotic
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
            guidelineReference: "EHS 2019 Guidelines"
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
- Stop NSAIDs + aspirin if possible; use paracetamol instead
- PPI: omeprazole 40 mg OD × 8 weeks (healing dose)
- If H. pylori positive: triple therapy — clarithromycin 500 mg + amoxicillin 1 g + omeprazole 20 mg BD × 7–14 days
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
            redFlags: ["Haematemesis / melaena → urgent OGD within 24h", "Perforation → emergency OT"],
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
            redFlags: ["Progressive dysphagia → exclude carcinoma urgently (OGD within 2 weeks)"],
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
- Early stage: wide local excision + sentinel node biopsy ± mastectomy
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
