import Foundation

// MARK: - Diagnosis Radiation Engine
// Matches workingDiagnosis text → structured suggestions:
// investigations, management plan template, billing codes, consent category.
// All suggestions are PRESENTED to the clinician — never auto-applied.

// MARK: - Output types

struct DiagnosisRadiation {
    struct SuggestedInvestigation {
        let name: String
        let category: InvestigationEntry.InvCategory
        let rationale: String
    }
    struct BillingCode {
        let icd10: String
        let icdDescription: String
        let cpt: String?
        let cptDescription: String?
    }

    // MARK: - Clinical scoring criteria
    struct ScoreVariable {
        let id: String
        let label: String
        let unit: String
        let hint: String
        let cutoffValue: Double    // threshold; only used when isBinary == false
        let cutoffIsAbove: Bool    // true = scores if value > cutoff; false = scores if value < cutoff
        let autoFillAge: Int?      // if set, pre-fills with patient age
        let groupId: String?       // variables in same group contribute at most once (highest-priority first)
        let points: Int            // point contribution when this variable scores; can be 2 (weighted) or negative
        let isBinary: Bool         // true = Yes/No toggle; false = numeric field with cutoff threshold

        init(id: String, label: String, unit: String, hint: String,
             cutoffValue: Double, cutoffIsAbove: Bool,
             autoFillAge: Int? = nil, groupId: String? = nil,
             points: Int = 1, isBinary: Bool = false) {
            self.id = id; self.label = label; self.unit = unit; self.hint = hint
            self.cutoffValue = cutoffValue; self.cutoffIsAbove = cutoffIsAbove
            self.autoFillAge = autoFillAge; self.groupId = groupId
            self.points = points; self.isBinary = isBinary
        }
    }
    struct ScoringCriteria {
        let scoreName: String
        let variables: [ScoreVariable]
        let severeThreshold: Int
        let maxScore: Int
        let timingNote: String
        let aboveThresholdLabel: String  // badge label when score ≥ severeThreshold
        let belowThresholdLabel: String  // badge label when score < severeThreshold

        init(scoreName: String, variables: [ScoreVariable],
             severeThreshold: Int, maxScore: Int, timingNote: String,
             aboveThresholdLabel: String = "SEVERE",
             belowThresholdLabel: String = "MILD–MOD") {
            self.scoreName = scoreName; self.variables = variables
            self.severeThreshold = severeThreshold; self.maxScore = maxScore
            self.timingNote = timingNote
            self.aboveThresholdLabel = aboveThresholdLabel
            self.belowThresholdLabel = belowThresholdLabel
        }
    }

    let conditionName: String
    let icd10Primary: String
    let investigations: [SuggestedInvestigation]
    let planTemplate: String          // multiline, surgeon edits before saving
    let billingCodes: [BillingCode]
    let consentCategory: String?      // links to operative plan / consent
    let urgencyNote: String?
    let redFlags: [String]
    let followUp: String
    let guidelineReference: String?   // e.g. "NICE NG12; ASGE 2019"
    let scoringCriteria: ScoringCriteria?

    init(
        conditionName: String,
        icd10Primary: String,
        investigations: [SuggestedInvestigation],
        planTemplate: String,
        billingCodes: [BillingCode],
        consentCategory: String?,
        urgencyNote: String?,
        redFlags: [String],
        followUp: String,
        guidelineReference: String? = nil,
        scoringCriteria: ScoringCriteria? = nil
    ) {
        self.conditionName = conditionName
        self.icd10Primary = icd10Primary
        self.investigations = investigations
        self.planTemplate = planTemplate
        self.billingCodes = billingCodes
        self.consentCategory = consentCategory
        self.urgencyNote = urgencyNote
        self.redFlags = redFlags
        self.followUp = followUp
        self.guidelineReference = guidelineReference
        self.scoringCriteria = scoringCriteria
    }
}

// MARK: - Engine

enum DiagnosisRadiationEngine {

    // MARK: Public API

    static func radiate(
        workingDiagnosis: String?,
        ageYears: Int,
        sex: Sex
    ) -> DiagnosisRadiation? {
        guard let dx = workingDiagnosis, !dx.isEmpty else { return nil }
        let dxL = dx.lowercased()
        return allEntries.first { entry in
            entry.keywords.contains { dxL.contains($0) }
        }?.radiation
    }

    // MARK: Internal entry type

    private struct Entry {
        let keywords: [String]
        let radiation: DiagnosisRadiation
    }

    // MARK: - Full disease dictionary

    private static let allEntries: [Entry] = [

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

        // ══════════════════════════════════════════════════════════════
        // CARDIOVASCULAR
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["hypertension", "essential hypertension", "raised blood pressure", "high blood pressure"], radiation: .init(
            conditionName: "Essential Hypertension",
            icd10Primary: "I10",
            investigations: [
                .init(name: "FBC / U&E / Creatinine", category: .blood, rationale: "End-organ damage — renal function"),
                .init(name: "Fasting glucose / HbA1c", category: .blood, rationale: "Metabolic syndrome / diabetes screen"),
                .init(name: "Fasting lipid profile", category: .blood, rationale: "Cardiovascular risk — total cholesterol, LDL, HDL, TG"),
                .init(name: "Urine — microalbumin / creatinine ratio", category: .other, rationale: "Renal end-organ damage"),
                .init(name: "ECG (12-lead)", category: .other, rationale: "LVH, arrhythmia, ischaemia"),
                .init(name: "Echocardiogram", category: .other, rationale: "If LVH on ECG or cardiac symptoms"),
                .init(name: "Renal USS", category: .imaging, rationale: "Secondary cause — RAS, renal parenchymal disease"),
                .init(name: "Aldosterone / Renin ratio", category: .blood, rationale: "If hypokalaemia or resistant HTN"),
            ],
            planTemplate: """
- LIFESTYLE (mandatory alongside medications):
  • DASH diet — reduce sodium <2.3 g/day, increase potassium (fruit, vegetables)
  • Exercise: 150 min/week moderate aerobic activity
  • Weight loss (target BMI <25), alcohol reduction, smoking cessation
- STEP 1 (Stage 1: 130–139/80–89 mmHg + CVD risk >10%):
  • ACE inhibitor (lisinopril 5–10 mg OD) OR ARB (losartan 50 mg OD)
  • If Afro-Caribbean: CCB preferred (amlodipine 5 mg OD) — NICE guidance
- STEP 2: ACE/ARB + CCB
- STEP 3: ACE/ARB + CCB + thiazide (indapamide 1.5 mg OD)
- STEP 4 (resistant): add spironolactone 25 mg OD
- Target: <130/80 mmHg (diabetics / CKD); <140/90 mmHg (general)
- Monitor: U&E 1 week after starting ACE/ARB; renal function 3–6 monthly
""",
            billingCodes: [
                .init(icd10: "I10", icdDescription: "Essential (primary) hypertension", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: nil,
            redFlags: ["BP >180/120 + end-organ damage → hypertensive emergency → ER", "Headache + visual changes → rule out hypertensive encephalopathy"],
            followUp: "Review 4 weeks (med start), then 3-monthly when stable. Annual: U&E, lipids, glucose, urine ACR.",
            guidelineReference: "NICE NG136; ACC/AHA 2017; ISH 2020"
        )),

        Entry(keywords: ["acute coronary syndrome", "acs", "nstemi", "stemi", "myocardial infarction", "mi"], radiation: .init(
            conditionName: "Acute Coronary Syndrome",
            icd10Primary: "I21.9",
            investigations: [
                .init(name: "ECG (12-lead) — stat + repeat at 1h and 3h", category: .other, rationale: "STEMI vs NSTEMI vs UA"),
                .init(name: "High-sensitivity Troponin I/T — 0h and 3h", category: .blood, rationale: "NSTEMI diagnosis — rise and fall pattern"),
                .init(name: "FBC / U&E / Creatinine", category: .blood, rationale: "Baseline and contrast risk"),
                .init(name: "Fasting lipid profile", category: .blood, rationale: "Cardiovascular risk"),
                .init(name: "BNP / NT-proBNP", category: .blood, rationale: "Cardiac failure component"),
                .init(name: "Chest X-ray", category: .imaging, rationale: "Pulmonary oedema, mediastinum"),
                .init(name: "Echo", category: .other, rationale: "LV function, wall motion abnormality"),
            ],
            planTemplate: """
- STEMI → IMMEDIATE referral for primary PCI (cath lab activation) or thrombolysis if PCI >120 min
- NSTEMI / UA:
  • Dual antiplatelet: aspirin 300 mg stat + ticagrelor 180 mg stat (or clopidogrel 300 mg)
  • Anticoagulation: fondaparinux 2.5 mg SC OD (preferred) or enoxaparin
  • Nitrates: GTN sublingual PRN; IV GTN if ongoing ischaemia
  • High-intensity statin: atorvastatin 80 mg OD
  • Beta-blocker: metoprolol 25 mg BD (if no contraindication)
  • ACE inhibitor: ramipril 2.5 mg OD
  • TIMI / GRACE score → risk stratify → early invasive vs conservative
  • Cardiac rehab referral
""",
            billingCodes: [
                .init(icd10: "I21.9", icdDescription: "Acute myocardial infarction, unspecified", cpt: nil, cptDescription: "Medical / interventional management"),
            ],
            consentCategory: nil,
            urgencyNote: "EMERGENCY — STEMI: activate cath lab immediately. NSTEMI: admit CCU.",
            redFlags: ["Cardiogenic shock → vasopressors + urgent PCI", "VF → defibrillation", "Complete heart block → temporary pacing"],
            followUp: "Cardiology follow-up 4–6 weeks. Cardiac rehab 6–8 weeks. Echo at 3 months.",
            guidelineReference: "ESC 2023; NICE NG185; ACC/AHA NSTE-ACS"
        )),

        Entry(keywords: ["heart failure", "cardiac failure", "congestive heart failure", "chf", "pulmonary oedema"], radiation: .init(
            conditionName: "Heart Failure",
            icd10Primary: "I50.9",
            investigations: [
                .init(name: "BNP / NT-proBNP", category: .blood, rationale: "Diagnostic confirmation — >400 pg/mL highly suggestive"),
                .init(name: "ECG", category: .other, rationale: "Cause — AF, LVH, ischaemia"),
                .init(name: "Echocardiogram", category: .other, rationale: "EF assessment — HFrEF vs HFpEF"),
                .init(name: "Chest X-ray", category: .imaging, rationale: "Cardiomegaly, pulmonary oedema, effusions"),
                .init(name: "FBC / U&E / Creatinine / LFTs", category: .blood, rationale: "Renal function — guide diuretic dose; hepatic congestion"),
                .init(name: "Thyroid function (TSH)", category: .blood, rationale: "Thyroid cause — hypo/hyperthyroidism"),
                .init(name: "Iron studies / Ferritin", category: .blood, rationale: "Iron deficiency — IV iron improves outcomes"),
            ],
            planTemplate: """
- Acute decompensation: IV furosemide 40–80 mg stat; O₂; sit upright
- GDMT (Guideline-Directed Medical Therapy) for HFrEF (EF <40%):
  • ACE inhibitor (ramipril) or ARNI (sacubitril-valsartan) — if BP allows
  • Beta-blocker: bisoprolol 1.25 mg OD → uptitrate
  • MRA: spironolactone 25 mg OD (if eGFR >30)
  • SGLT2i: dapagliflozin 10 mg OD or empagliflozin 10 mg OD
  • Diuretic: furosemide 40 mg OD — adjust to fluid balance
- Fluid restriction: 1.5–2 L/day; sodium <2 g/day
- Daily weights — attend if gain >2 kg in 2 days
- Cardiology referral + echo within 2 weeks of new diagnosis
""",
            billingCodes: [
                .init(icd10: "I50.9", icdDescription: "Heart failure, unspecified", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "Admit if acute decompensation. Cardiology referral for new diagnosis.",
            redFlags: ["SaO₂ <90% + respiratory distress → emergency CPAP / NIV", "Cardiogenic shock → inotropes"],
            followUp: "Cardiology review 2 weeks. Echo 3 months. BNP target-guided therapy.",
            guidelineReference: "ESC 2021; NICE NG106"
        )),

        Entry(keywords: ["deep vein thrombosis", "dvt", "leg vein thrombosis", "calf thrombosis"], radiation: .init(
            conditionName: "Deep Vein Thrombosis (DVT)",
            icd10Primary: "I80.20",
            investigations: [
                .init(name: "Doppler Ultrasound — Lower Limb Veins", category: .imaging, rationale: "Gold standard — confirm DVT, extent, compressibility"),
                .init(name: "D-dimer", category: .blood, rationale: "Rule out if Wells <2 + negative D-dimer (high sensitivity)"),
                .init(name: "FBC / PT / INR / APTT", category: .blood, rationale: "Baseline coagulation before anticoagulation"),
                .init(name: "Renal function (U&E / Creatinine)", category: .blood, rationale: "DOAC dosing — eGFR <15: avoid DOACs"),
                .init(name: "Thrombophilia screen (if unprovoked <50y)", category: .blood, rationale: "Factor V Leiden, Prothrombin G20210A, Protein C/S, Antithrombin — do BEFORE anticoagulation"),
                .init(name: "Anti-phospholipid antibodies", category: .blood, rationale: "APS — warfarin preferred over DOACs"),
                .init(name: "CT Chest / Abdomen / Pelvis (if unprovoked)", category: .imaging, rationale: "Occult malignancy screen in first unprovoked DVT"),
            ],
            planTemplate: """
- Wells' score ≥2: USS + anticoagulate while awaiting
- Wells' score <2: D-dimer first; if negative → no DVT
- ANTICOAGULATION (first-line DOACs):
  • Rivaroxaban: 15 mg BD × 21 days, then 20 mg OD (with food)
  • Apixaban: 10 mg BD × 7 days, then 5 mg BD
  • LMWH → warfarin: if APS, CrCl <15, pregnant, or haematology preference
- Duration: provoked (reversible risk factor) → 3 months; unprovoked → ≥6 months; recurrent/malignancy → long-term
- Compression stockings: grade II, worn 2 years (reduces PTS)
- Elevation + early mobilisation — do NOT enforce bed rest
- Malignancy-associated: LMWH (tinzaparin 175 IU/kg OD) or rivaroxaban/apixaban
""",
            billingCodes: [
                .init(icd10: "I80.20", icdDescription: "Phlebitis and thrombophlebitis of unspecified deep vessel of lower extremity", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "Anticoagulate while imaging is arranged if high clinical suspicion (Wells ≥2).",
            redFlags: ["Phlegmasia cerulea dolens → vascular surgery urgently", "Massive DVT + haemodynamic compromise → catheter-directed thrombolysis"],
            followUp: "Review 4 weeks. Assess for PTS. Duration decision at 3 months. Thrombophilia result follow-up.",
            guidelineReference: "NICE NG158; ISTH 2021; ESC 2019",
            scoringCriteria: .init(
                scoreName: "Wells' DVT Score",
                variables: [
                    .init(id: "dvt_cancer",     label: "Active cancer",                             unit: "", hint: "treatment or palliation within 6 months",  cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "dvt_paralysis",  label: "Paralysis / plaster immobilisation",        unit: "", hint: "recent lower limb",                        cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "dvt_bedrest",    label: "Bedridden >3 days or major Sx <12 wks",     unit: "", hint: "",                                         cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "dvt_tenderness", label: "Localised deep venous tenderness",          unit: "", hint: "along deep venous distribution",            cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "dvt_swollen",    label: "Entire leg swollen",                        unit: "", hint: "",                                         cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "dvt_calf",       label: "Calf swelling >3 cm vs contralateral",     unit: "cm diff", hint: "measure 10 cm below tibial tuberosity", cutoffValue: 3, cutoffIsAbove: true, points: 1, isBinary: false),
                    .init(id: "dvt_oedema",     label: "Pitting oedema (symptomatic leg greater)",  unit: "", hint: "",                                         cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "dvt_collateral", label: "Collateral superficial veins (non-varicose)", unit: "", hint: "",                                       cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "dvt_prev",       label: "Previously documented DVT",                 unit: "", hint: "",                                         cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "dvt_alt_dx",     label: "Alternative dx as / more likely than DVT",  unit: "", hint: "subtracts 2 pts from total",                cutoffValue: 0, cutoffIsAbove: true, points: -2, isBinary: true),
                ],
                severeThreshold: 2,
                maxScore: 9,
                timingNote: "≥2 = DVT likely → USS + anticoagulate; <2 = unlikely → D-dimer first",
                aboveThresholdLabel: "DVT LIKELY",
                belowThresholdLabel: "DVT UNLIKELY"
            )
        )),

        Entry(keywords: ["pulmonary embolism", "pulmonary thromboembolism", "pe", "deep vein thrombosis with pe", "dvt with pe"], radiation: .init(
            conditionName: "Pulmonary Embolism (PE)",
            icd10Primary: "I26.99",
            investigations: [
                .init(name: "D-dimer", category: .blood, rationale: "Sensitive rule-out if Wells ≤4 — negative excludes PE"),
                .init(name: "CTPA (CT Pulmonary Angiogram)", category: .imaging, rationale: "Gold standard — confirms PE, extent, RV strain"),
                .init(name: "ECG", category: .other, rationale: "S1Q3T3, sinus tachycardia, new RBBB — not diagnostic"),
                .init(name: "Troponin I/T", category: .blood, rationale: "RV strain / myocardial injury — guides escalation"),
                .init(name: "BNP / NT-proBNP", category: .blood, rationale: "RV dysfunction — severity and prognosis"),
                .init(name: "ABG / SpO₂", category: .other, rationale: "Hypoxaemia, hypocapnia — severity"),
                .init(name: "FBC / INR / APTT / Renal function", category: .blood, rationale: "Baseline before anticoagulation"),
                .init(name: "ECHO (if haemodynamically unstable)", category: .other, rationale: "RV strain, thrombus in transit"),
                .init(name: "Doppler USS Lower Limbs", category: .imaging, rationale: "DVT confirmation — source of PE"),
            ],
            planTemplate: """
- Wells' PE score: if ≤4 → D-dimer; if >4 → CTPA directly
- HAEMODYNAMICALLY STABLE (most patients):
  • DOACs (preferred): rivaroxaban 15 mg BD × 21d → 20 mg OD; or apixaban 10 mg BD × 7d → 5 mg BD
  • LMWH (enoxaparin 1.5 mg/kg SC OD or 1 mg/kg BD) as bridge if needed
- HAEMODYNAMICALLY UNSTABLE (massive PE — SBP <90):
  • ADMIT ICU — thrombolysis: alteplase 100 mg IV over 2h (contraindications: recent surgery/stroke)
  • If thrombolysis contraindicated: surgical embolectomy / catheter-directed therapy
- O₂ supplementation to maintain SpO₂ ≥94%
- Duration: provoked → 3 months; unprovoked → ≥6 months; cancer-associated → DOAC long-term
""",
            billingCodes: [
                .init(icd10: "I26.99", icdDescription: "Other pulmonary embolism without acute cor pulmonale", cpt: nil, cptDescription: "Medical management"),
                .init(icd10: "I26.09", icdDescription: "Saddle embolus with acute cor pulmonale", cpt: nil, cptDescription: "Emergency management / ICU"),
            ],
            consentCategory: nil,
            urgencyNote: "Haemodynamically unstable PE → ICU + thrombolysis ± surgical embolectomy. Do not delay anticoagulation.",
            redFlags: ["SBP <90 + HR >100 → massive PE → thrombolysis", "Cardiac arrest → CPR + thrombolysis in cardiac arrest protocol"],
            followUp: "Review 4–6 weeks. Duration decision at 3 months. ECHO if RV dysfunction at index admission.",
            guidelineReference: "ESC 2019; NICE NG158; ACCP 2021",
            scoringCriteria: .init(
                scoreName: "Wells' PE Score",
                variables: [
                    .init(id: "pe_dvt_signs",   label: "Clinical signs/symptoms of DVT",           unit: "", hint: "leg swelling, erythema, tenderness",           cutoffValue: 0, cutoffIsAbove: true, points: 3, isBinary: true),
                    .init(id: "pe_likely",       label: "PE is #1 diagnosis / equally likely",      unit: "", hint: "clinical judgement after alternatives considered", cutoffValue: 0, cutoffIsAbove: true, points: 3, isBinary: true),
                    .init(id: "pe_hr",           label: "Heart rate > 100 bpm",                     unit: "bpm", hint: "> 100 scores 1 pt",                         cutoffValue: 100, cutoffIsAbove: true, points: 1, isBinary: false),
                    .init(id: "pe_immob",        label: "Immobilisation ≥3 days or Sx <4 wks",      unit: "", hint: "bedridden or recent surgery",                   cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "pe_prev_dvt_pe",  label: "Previous DVT / PE",                        unit: "", hint: "documented history",                           cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "pe_haemoptysis",  label: "Haemoptysis",                              unit: "", hint: "any blood-stained sputum",                      cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                    .init(id: "pe_malignancy",   label: "Malignancy",                               unit: "", hint: "on treatment or within 6 months or palliative", cutoffValue: 0, cutoffIsAbove: true, points: 1, isBinary: true),
                ],
                severeThreshold: 5,
                maxScore: 11,
                timingNote: ">4 = PE likely → CTPA; ≤4 = PE unlikely → D-dimer first",
                aboveThresholdLabel: "PE LIKELY",
                belowThresholdLabel: "PE UNLIKELY"
            )
        )),

        // ══════════════════════════════════════════════════════════════
        // RESPIRATORY
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["community-acquired pneumonia", "pneumonia", "cap"], radiation: .init(
            conditionName: "Community-Acquired Pneumonia",
            icd10Primary: "J18.9",
            investigations: [
                .init(name: "Chest X-ray (PA and lateral)", category: .imaging, rationale: "Infiltrate characterisation — lobar vs broncho"),
                .init(name: "FBC / CRP / Procalcitonin", category: .blood, rationale: "Severity and antibiotic guidance"),
                .init(name: "U&E / Creatinine / Urea", category: .blood, rationale: "CURB-65 scoring — urea >7 mmol/L = 1 point"),
                .init(name: "Blood cultures ×2", category: .blood, rationale: "Bacteraemia — before antibiotics"),
                .init(name: "Sputum MC&S + AFB", category: .other, rationale: "Microbiological diagnosis"),
                .init(name: "Urinary Legionella Antigen", category: .other, rationale: "Legionella — especially if severe / cluster"),
                .init(name: "Urinary Pneumococcal Antigen", category: .other, rationale: "Streptococcus pneumoniae"),
                .init(name: "ABG / O₂ sats", category: .other, rationale: "Severity — hypoxia"),
            ],
            planTemplate: """
- CURB-65 ≤1 → oral antibiotics + outpatient
- CURB-65 2 → consider admission; IV antibiotics
- CURB-65 ≥3 → admit; severe pneumonia; consider ICU
- MILD/MODERATE (outpatient / CURB-65 1–2):
  • Amoxicillin 500 mg TDS × 5 days PLUS azithromycin 500 mg OD × 5 days
- SEVERE (CURB-65 ≥3):
  • Co-amoxiclav 1.2 g IV 8h + azithromycin 500 mg IV OD
  • Or ceftriaxone 2 g IV OD + azithromycin
- Supplemental O₂: target SaO₂ 94–98%
- Adequate hydration; VTE prophylaxis (enoxaparin) if admitted
- Smoking cessation counselling
- Pneumococcal and influenza vaccines
""",
            billingCodes: [
                .init(icd10: "J18.9", icdDescription: "Pneumonia, unspecified organism", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "CURB-65 ≥3 or SaO₂ <93%: admit urgently.",
            redFlags: ["SaO₂ <90% → O₂ + escalate", "Shock + respiratory failure → ICU + broad-spectrum antibiotics"],
            followUp: "Chest X-ray 6 weeks to confirm resolution. Pneumococcal vaccine if not vaccinated.",
            guidelineReference: "NICE NG138; BTS 2009; CURB-65"
        )),

        Entry(keywords: ["asthma", "acute asthma", "bronchospasm"], radiation: .init(
            conditionName: "Asthma",
            icd10Primary: "J45.50",
            investigations: [
                .init(name: "Peak Expiratory Flow (PEF) — pre and post bronchodilator", category: .other, rationale: "Severity and reversibility"),
                .init(name: "Spirometry with reversibility", category: .other, rationale: "Diagnosis confirmation — FEV1/FVC + bronchodilator response"),
                .init(name: "Chest X-ray", category: .imaging, rationale: "Exclude pneumothorax, consolidation, hyperinflation"),
                .init(name: "FBC / CRP", category: .blood, rationale: "Infective trigger — eosinophilia"),
                .init(name: "IgE / RAST / skin prick tests", category: .other, rationale: "Allergic component — if severe/brittle"),
                .init(name: "ABG", category: .other, rationale: "Severe/life-threatening — rising CO₂ = critical sign"),
            ],
            planTemplate: """
- ACUTE SEVERE (PEF 33–50% predicted):
  • Salbutamol 5 mg nebulised back-to-back × 3 in first hour
  • Ipratropium 0.5 mg nebulised 4-hourly
  • Prednisolone 40–50 mg PO stat (or hydrocortisone 200 mg IV if unable to swallow)
  • O₂: maintain SaO₂ 94–98%
  • Admit if no improvement at 1h
- LIFE-THREATENING (PEF <33%, silent chest, cyanosis, SpO₂ <92%):
  • IV magnesium sulphate 1.2–2 g over 20 min
  • ICU referral — may need intubation
- CHRONIC MANAGEMENT (stepwise):
  • Step 1: SABA PRN (salbutamol inhaler)
  • Step 2: Low-dose ICS (beclomethasone 200 mcg BD)
  • Step 3: ICS + LABA (salmeterol)
  • Step 4: Specialist review + add-on therapy
- Written Asthma Action Plan; inhaler technique check
""",
            billingCodes: [
                .init(icd10: "J45.50", icdDescription: "Moderate persistent asthma, uncomplicated", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "LIFE-THREATENING features: silent chest / SpO₂ <92% / PEF <33% → emergency.",
            redFlags: ["Silent chest + hypoxia + cyanosis → intubation", "Rising CO₂ → ICU immediately"],
            followUp: "Review 48h after acute attack. Spirometry when well. Asthma Action Plan.",
            guidelineReference: "BTS/SIGN 2023; NICE NG80; GINA 2024"
        )),

        Entry(keywords: ["pulmonary tuberculosis", "tuberculosis", "tb", "mycobacterium tuberculosis"], radiation: .init(
            conditionName: "Pulmonary Tuberculosis",
            icd10Primary: "A15.0",
            investigations: [
                .init(name: "Chest X-ray (PA)", category: .imaging, rationale: "Apical infiltrate, cavitation, lymphadenopathy"),
                .init(name: "Sputum AFB smear × 3 (early morning)", category: .other, rationale: "Acid-fast bacilli — sensitivity ~60%"),
                .init(name: "Sputum Culture (Mycobacterium) — LJ medium / BACTEC", category: .other, rationale: "Gold standard diagnosis + drug sensitivity"),
                .init(name: "GeneXpert MTB/RIF (Xpert)", category: .other, rationale: "Rapid diagnosis + rifampicin resistance in 2h"),
                .init(name: "HIV test (consent)", category: .blood, rationale: "TB-HIV co-infection — management implications"),
                .init(name: "FBC / LFTs / U&E", category: .blood, rationale: "Pre-treatment baseline — drug toxicity monitoring"),
                .init(name: "CT Chest", category: .imaging, rationale: "If CXR equivocal or disseminated disease suspected"),
            ],
            planTemplate: """
- NOTIFY TB to public health authority (mandatory)
- Contact tracing: household contacts → tuberculin skin test / IGRA
- STANDARD 6-MONTH REGIMEN (drug-sensitive TB):
  • Intensive phase (2 months): HRZE — Isoniazid + Rifampicin + Pyrazinamide + Ethambutol daily
  • Continuation phase (4 months): HR — Isoniazid + Rifampicin daily
- Pyridoxine (vitamin B6) 10–25 mg OD with isoniazid to prevent peripheral neuropathy
- DOT (Directly Observed Therapy) — especially if adherence concern
- Monitor: LFTs monthly; visual acuity monthly (ethambutol); uric acid (pyrazinamide)
- Infectivity precautions: respiratory isolation until AFB smear-negative × 3
- Refer MDR-TB to specialist if rifampicin resistance on Xpert
""",
            billingCodes: [
                .init(icd10: "A15.0", icdDescription: "Tuberculosis of lung, confirmed by sputum smear", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "Notify Public Health. Isolate patient until non-infectious.",
            redFlags: ["Haemoptysis → bronchoscopy", "Miliary / CNS TB → IV steroids + extended treatment", "MDR-TB → specialist centre"],
            followUp: "Monthly: LFTs, clinical review, sputum smear. CXR at 2 months and end of treatment.",
            guidelineReference: "WHO 2022; NICE NG33"
        )),

        // ══════════════════════════════════════════════════════════════
        // ENDOCRINE / METABOLIC
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["diabetes mellitus type 2", "diabetes type 2", "dm2", "type 2 diabetes", "t2dm"], radiation: .init(
            conditionName: "Diabetes Mellitus Type 2",
            icd10Primary: "E11.9",
            investigations: [
                .init(name: "HbA1c", category: .blood, rationale: "Glycaemic control — diagnosis and monitoring"),
                .init(name: "Fasting glucose / random glucose", category: .blood, rationale: "Diagnostic confirmation"),
                .init(name: "FBC / U&E / Creatinine / eGFR", category: .blood, rationale: "Renal function — nephropathy screen"),
                .init(name: "Urine albumin:creatinine ratio (ACR)", category: .other, rationale: "Diabetic nephropathy"),
                .init(name: "Fasting lipid profile", category: .blood, rationale: "Cardiovascular risk — statin indication"),
                .init(name: "LFTs", category: .blood, rationale: "NAFLD — very common in T2DM"),
                .init(name: "TSH", category: .blood, rationale: "Thyroid disease — common comorbidity"),
                .init(name: "ECG", category: .other, rationale: "Cardiac complications"),
                .init(name: "Urine dipstick + MC&S", category: .other, rationale: "UTI screening — common in T2DM"),
                .init(name: "Foot examination + Monofilament test", category: .other, rationale: "Peripheral neuropathy / diabetic foot"),
            ],
            planTemplate: """
- LIFESTYLE (cornerstone):
  • Caloric restriction: 500 kcal/day deficit; Mediterranean / low-carb diet
  • Exercise: 150 min/week aerobic; resistance training
  • Weight loss target: ≥5% body weight
- STEP 1 — Metformin 500 mg OD (with food) → uptitrate to 1 g BD over 4 weeks
  • If eGFR 30–45: reduce dose; <30: stop metformin
- STEP 2 (HbA1c not at target after 3 months):
  • Add SGLT2 inhibitor (if CVD/CKD: dapagliflozin 10 mg or empagliflozin 10 mg)
  • Or GLP-1 RA (if obesity: semaglutide 0.25–1 mg weekly SC)
  • Or DPP-4 inhibitor (sitagliptin 100 mg OD — if hypoglycaemia risk)
- STEP 3: Add sulphonylurea (glibenclamide 2.5 mg OD) or insulin if HbA1c >10%
- HbA1c target: <53 mmol/mol (7%) general; <48 (6.5%) if low hypoglycaemia risk
- Statin: atorvastatin 20–40 mg OD (all T2DM if >40y or CVD risk)
- ACE inhibitor if microalbuminuria or hypertension
- Eye referral (diabetic retinopathy screen annually)
- Foot care education
""",
            billingCodes: [
                .init(icd10: "E11.9", icdDescription: "Type 2 diabetes mellitus without complications", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: nil,
            redFlags: ["HbA1c >12% + symptoms → consider insulin", "DKA → emergency IV fluids + insulin protocol", "Hypoglycaemia <4 mmol/L → 15–20 g fast-acting glucose"],
            followUp: "HbA1c every 3 months until target, then 6-monthly. Annual: eyes, feet, ACR, eGFR, lipids.",
            guidelineReference: "NICE NG28; ADA 2024; EASD 2023"
        )),

        Entry(keywords: ["hyperthyroidism", "thyrotoxicosis", "graves disease", "graves'"], radiation: .init(
            conditionName: "Hyperthyroidism / Graves' Disease",
            icd10Primary: "E05.00",
            investigations: [
                .init(name: "TSH / Free T4 / Free T3", category: .blood, rationale: "Confirm and characterise hyperthyroidism"),
                .init(name: "TSH receptor antibodies (TRAb)", category: .blood, rationale: "Graves' disease confirmation"),
                .init(name: "Thyroid peroxidase antibodies (TPO-Ab)", category: .blood, rationale: "Autoimmune thyroid disease"),
                .init(name: "Thyroid Ultrasound ± radioiodine uptake scan", category: .imaging, rationale: "Distinguish Graves' from toxic nodule / toxic MNG"),
                .init(name: "FBC / LFTs", category: .blood, rationale: "Pre-treatment baseline — antithyroid drug monitoring"),
                .init(name: "ECG", category: .other, rationale: "Atrial fibrillation — very common with hyperthyroidism"),
                .init(name: "Bone density (DEXA)", category: .other, rationale: "Osteoporosis risk if prolonged hyperthyroidism"),
            ],
            planTemplate: """
- SYMPTOMATIC CONTROL (immediate):
  • Beta-blocker: propranolol 40 mg TDS or atenolol 50 mg OD (reduces HR + tremor)
- ANTITHYROID DRUG (ATD):
  • Carbimazole 20–40 mg OD (titration block-replace or titration regimen)
  • Alternatives: propylthiouracil 100–200 mg TDS (first trimester pregnancy / agranulocytosis with carbimazole)
  • Monitor: FBC at 6 weeks — agranulocytosis (WBC <3.0 → STOP immediately → ER)
  • TFTs at 4–6 weeks until euthyroid, then 3-monthly
- DEFINITIVE THERAPY (after 12–18 months ATD or early relapse):
  • Radioiodine (I-131): preferred if single nodule, MNG, relapse, older patients
  • Thyroidectomy (total or near-total): if large goitre, compressive symptoms, suspicious nodule
- Ophthalmology referral if Graves' orbitopathy (exophthalmos)
""",
            billingCodes: [
                .init(icd10: "E05.00", icdDescription: "Thyrotoxicosis with diffuse goitre", cpt: "60240", cptDescription: "Thyroidectomy, total"),
            ],
            consentCategory: "Total Thyroidectomy",
            urgencyNote: "Thyroid storm: ICU — propranolol IV + carbimazole high-dose + dexamethasone + Lugol's iodine.",
            redFlags: ["Agranulocytosis (fever + sore throat on ATD) → STOP drug → FBC stat → haematology", "Thyroid storm → emergency"],
            followUp: "TFTs 4–6 weeks. Annual DEXA. Lifelong thyroxine after thyroidectomy or radioiodine.",
            guidelineReference: "BTA Guidelines; ATA 2016; ETA 2018"
        )),

        Entry(keywords: ["hypothyroidism", "hypothyroid", "underactive thyroid"], radiation: .init(
            conditionName: "Hypothyroidism",
            icd10Primary: "E03.9",
            investigations: [
                .init(name: "TSH / Free T4", category: .blood, rationale: "Confirm and grade hypothyroidism"),
                .init(name: "TPO antibodies", category: .blood, rationale: "Hashimoto's thyroiditis — autoimmune cause"),
                .init(name: "FBC", category: .blood, rationale: "Macrocytic anaemia — associated"),
                .init(name: "Lipid profile", category: .blood, rationale: "Dyslipidaemia — reversible with treatment"),
                .init(name: "CK / Creatinine", category: .blood, rationale: "Myopathy — common in hypothyroidism"),
            ],
            planTemplate: """
- Levothyroxine (L-T4):
  • Start low: 25–50 mcg OD in elderly or cardiac disease; 50–75 mcg OD in younger healthy patients
  • Take on empty stomach, 30–60 min before breakfast
  • Uptitrate by 25 mcg every 4–6 weeks until TSH within normal range (0.5–2.5 mIU/L)
  • Typical maintenance dose: 75–125 mcg OD
- Avoid calcium, iron supplements, antacids within 4h of levothyroxine
- Monitor: TFTs 6 weeks after dose change; annual once stable
- Subclinical hypothyroidism (TSH 4–10, normal T4):
  • Treat if TSH >10, symptomatic, TPO+, or pregnant
""",
            billingCodes: [
                .init(icd10: "E03.9", icdDescription: "Hypothyroidism, unspecified", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: nil,
            redFlags: ["Myxoedema coma — confusion + hypothermia → IV T4 + steroids + ICU"],
            followUp: "TFTs 6 weeks after initiating / changing dose. Annual monitoring when stable.",
            guidelineReference: "BTA Guidelines; ATA 2014"
        )),

        // ══════════════════════════════════════════════════════════════
        // INFECTIOUS / TROPICAL — CARIBBEAN SPECIFIC
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["dengue", "dengue fever", "dengue haemorrhagic fever", "dhf"], radiation: .init(
            conditionName: "Dengue Fever",
            icd10Primary: "A90",
            investigations: [
                .init(name: "Dengue NS1 antigen (days 1–5)", category: .blood, rationale: "Positive in first 5 days — most sensitive early"),
                .init(name: "Dengue IgM/IgG ELISA (day 5+)", category: .blood, rationale: "Seroconversion after day 5"),
                .init(name: "FBC — platelet count", category: .blood, rationale: "Thrombocytopaenia <100,000 → warning sign"),
                .init(name: "Haematocrit (serial)", category: .blood, rationale: "Rising haematocrit >20% → plasma leakage"),
                .init(name: "LFTs / ALT / AST", category: .blood, rationale: "Hepatitis — common in dengue"),
                .init(name: "Urine dipstick", category: .other, rationale: "Proteinuria in severe dengue"),
                .init(name: "CXR / Abdominal USS", category: .imaging, rationale: "Pleural effusion / ascites — severe dengue"),
            ],
            planTemplate: """
- NO aspirin, NSAIDs, or anticoagulants (thrombocytopaenia risk)
- Paracetamol 1 g QDS for fever and pain
- Oral hydration (ORS): 2–3 L/day — monitor urine output
- WARNING SIGNS requiring admission:
  • Abdominal pain, persistent vomiting, bleeding, lethargy, rapid clinical deterioration
  • Platelet <100,000 + symptoms
- SEVERE DENGUE (plasma leakage / organ impairment):
  • IV isotonic crystalloid: Hartmann's 5–10 mL/kg/h — titrate to haematocrit
  • Platelet transfusion only if <10,000 or active bleeding
  • ICU for shock (DSS)
- Monitor: platelet + haematocrit 12-hourly during critical phase (day 4–6)
- Notify Ministry of Health (mandatory — notifiable disease in St Lucia)
- Mosquito protection: DEET repellent, bed nets
""",
            billingCodes: [
                .init(icd10: "A90", icdDescription: "Dengue fever [classical dengue]", cpt: nil, cptDescription: "Supportive management"),
            ],
            consentCategory: nil,
            urgencyNote: "Monitor for warning signs. Admit if platelet trending down or any warning sign present.",
            redFlags: ["Plasma leakage → dengue shock syndrome → aggressive fluids + ICU", "Platelet <10,000 + bleeding → transfuse"],
            followUp: "Platelet count at day 6–7. Recovery usually by day 10–14. Avoid NSAIDs for 2 weeks.",
            guidelineReference: "WHO 2009; PAHO 2010; MOH St Lucia"
        )),

        Entry(keywords: ["leptospirosis", "weil's disease", "weil disease"], radiation: .init(
            conditionName: "Leptospirosis",
            icd10Primary: "A27.9",
            investigations: [
                .init(name: "Leptospira IgM ELISA (day 5–7+)", category: .blood, rationale: "Serological diagnosis — most sensitive after day 5"),
                .init(name: "MAT (Microscopic Agglutination Test)", category: .blood, rationale: "Gold standard serological test — 4× rise in paired sera"),
                .init(name: "Leptospira PCR (blood — days 1–5)", category: .blood, rationale: "Early diagnosis — first week of illness"),
                .init(name: "FBC — WBC, platelet", category: .blood, rationale: "Leukocytosis, thrombocytopaenia"),
                .init(name: "U&E / Creatinine / Urine", category: .blood, rationale: "Renal failure — Weil's disease"),
                .init(name: "LFTs / Bilirubin / CK", category: .blood, rationale: "Hepatic involvement and myositis"),
                .init(name: "CXR", category: .imaging, rationale: "Pulmonary haemorrhage — severe leptospirosis"),
                .init(name: "Blood cultures", category: .blood, rationale: "First week — leptospiraemia; exclude bacteraemia"),
            ],
            planTemplate: """
- MILD (febrile illness, no organ involvement):
  • Doxycycline 100 mg BD × 7 days (oral)
  • Alternative: amoxicillin 500 mg TDS × 7 days
- MODERATE-SEVERE (jaundice, renal impairment, haemorrhage):
  • ADMIT — IV penicillin G 1.5 MU 6-hourly × 7 days (Weil's disease)
  • Or ceftriaxone 1 g IV OD × 7 days
  • Monitor renal function daily — haemodialysis if AKI
  • Platelet + coagulation — DIC management
  • Pulmonary: O₂ support; consider steroids for haemorrhagic pneumonitis
- Notify Public Health — mandatory notifiable disease
- Exposure history: flood water, soil, rodents — workplace / environmental
""",
            billingCodes: [
                .init(icd10: "A27.9", icdDescription: "Leptospirosis, unspecified", cpt: nil, cptDescription: "Antibiotic management"),
            ],
            consentCategory: nil,
            urgencyNote: "Weil's disease (jaundice + renal failure): ADMIT immediately. IV penicillin.",
            redFlags: ["AKI → nephrology + possible dialysis", "Pulmonary haemorrhage → ICU + mechanical ventilation", "DIC → haematology"],
            followUp: "Renal function weekly × 4 weeks. LFTs normalise in 4–6 weeks.",
            guidelineReference: "WHO Guidelines; PAHO"
        )),

        Entry(keywords: ["typhoid", "typhoid fever", "enteric fever", "salmonella typhi"], radiation: .init(
            conditionName: "Typhoid Fever",
            icd10Primary: "A01.00",
            investigations: [
                .init(name: "Blood cultures (×2, different sites)", category: .blood, rationale: "Gold standard week 1–2 — Salmonella Typhi"),
                .init(name: "Widal test (week 2+)", category: .blood, rationale: "Serological — O titre >1:160 significant but non-specific"),
                .init(name: "Stool culture (week 3+)", category: .other, rationale: "Salmonella Typhi — late disease"),
                .init(name: "FBC — relative leucopaenia, anaemia", category: .blood, rationale: "Classic: WBC often normal or low"),
                .init(name: "LFTs", category: .blood, rationale: "Hepatic involvement"),
                .init(name: "U&E / Creatinine", category: .blood, rationale: "Renal function"),
                .init(name: "Chest X-ray", category: .imaging, rationale: "Pneumonia, perforation"),
            ],
            planTemplate: """
- MILD / UNCOMPLICATED:
  • Azithromycin 1 g OD × 5 days (treatment of choice for uncomplicated typhoid — highly effective in Caribbean region)
  • Alternative: ciprofloxacin 500 mg BD × 7–10 days (if susceptible — check fluoroquinolone resistance)
- SEVERE / COMPLICATED (admit):
  • IV ceftriaxone 2 g OD × 7–14 days
  • Or IV azithromycin 500 mg OD if IV route needed
- Perforation / haemorrhage → emergency surgical management
- Supportive: IV fluids + paracetamol for fever
- CONTACT TRACING: food handlers → stool culture
- Notify Public Health (mandatory)
- Food safety / hand hygiene education
""",
            billingCodes: [
                .init(icd10: "A01.00", icdDescription: "Typhoid fever, unspecified", cpt: nil, cptDescription: "Antibiotic management"),
            ],
            consentCategory: nil,
            urgencyNote: "Admit if toxic / unable to tolerate orals. Blood cultures before antibiotics.",
            redFlags: ["Intestinal perforation → emergency surgery", "Haemorrhage → transfusion + surgery", "Encephalopathy → IV antibiotics + steroids"],
            followUp: "Stool culture 3 months post-treatment. Typhoid vaccination for household contacts.",
            guidelineReference: "WHO 2011; CDC; IDSA"
        )),

        Entry(keywords: ["urinary tract infection", "uti", "cystitis", "pyelonephritis"], radiation: .init(
            conditionName: "Urinary Tract Infection",
            icd10Primary: "N39.0",
            investigations: [
                .init(name: "Urine dipstick (nitrites + leucocytes)", category: .other, rationale: "Bedside diagnosis — >90% sensitivity combined"),
                .init(name: "Urine MC&S", category: .other, rationale: "Culture and sensitivities — guide antibiotic choice"),
                .init(name: "FBC / CRP (if systemic features)", category: .blood, rationale: "Sepsis assessment"),
                .init(name: "U&E / Creatinine", category: .blood, rationale: "Renal function if pyelonephritis"),
                .init(name: "Blood cultures (if temp >38.5°C)", category: .blood, rationale: "Urosepsis — before antibiotics"),
                .init(name: "Renal Ultrasound", category: .imaging, rationale: "Obstruction — hydronephrosis, calculi"),
                .init(name: "CT KUB (no contrast)", category: .imaging, rationale: "Renal calculi if suspected"),
            ],
            planTemplate: """
- UNCOMPLICATED LOWER UTI (female, non-pregnant):
  • Nitrofurantoin 100 mg MR BD × 5 days (first-line — St Lucia)
  • Or trimethoprim 200 mg BD × 7 days (if low resistance)
  • Or amoxicillin-clavulanate 625 mg TDS × 5–7 days (if culture-guided)
- UPPER UTI / PYELONEPHRITIS (outpatient, mild):
  • Ciprofloxacin 500 mg BD × 7–14 days PO (if susceptible)
  • Or co-amoxiclav 625 mg TDS × 10–14 days
- PYELONEPHRITIS (severe / sepsis): ADMIT
  • IV ceftriaxone 1–2 g OD; switch to oral after 24h afebrile
- COMPLICATED UTI (catheter, immunosuppressed, male, pregnancy): culture-guided treatment
- Increase oral fluids >2 L/day; treat constipation
- If recurrent (≥3/year female): consider prophylaxis — trimethoprim 100 mg nocte
""",
            billingCodes: [
                .init(icd10: "N39.0", icdDescription: "Urinary tract infection, site not specified", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "Systemically unwell + sepsis criteria: admit urgently. Blood cultures before antibiotics.",
            redFlags: ["Sepsis criteria → IV antibiotics within 1h", "Obstructed infected kidney → emergency urology + nephrostomy"],
            followUp: "Urine MC&S 5–7 days post-antibiotic. If recurrent: renal USS + urology referral.",
            guidelineReference: "NICE NG112; EAU 2022"
        )),

        Entry(keywords: ["cellulitis", "soft tissue infection", "erysipelas"], radiation: .init(
            conditionName: "Cellulitis",
            icd10Primary: "L03.90",
            investigations: [
                .init(name: "FBC / CRP / Blood cultures (if systemic)", category: .blood, rationale: "Severity and bacteraemia"),
                .init(name: "Blood glucose / HbA1c", category: .blood, rationale: "Diabetes — major risk factor"),
                .init(name: "Wound swab", category: .other, rationale: "If open wound / ulcer — microbiological"),
                .init(name: "X-ray of affected area", category: .imaging, rationale: "Exclude osteomyelitis, gas (NF)"),
                .init(name: "MRI soft tissue", category: .imaging, rationale: "If necrotising fasciitis suspected"),
            ],
            planTemplate: """
- Mark the advancing edge with a skin marker pen + photograph — reassess at 24h
- MILD (no systemic features): ORAL
  • Flucloxacillin 500 mg QDS × 5–7 days (Staph/Strep — first choice)
  • If penicillin allergy: clarithromycin 500 mg BD or doxycycline 200 mg OD
- MODERATE / SEVERE (systemic features / spreading rapidly): ADMIT + IV
  • Flucloxacillin 2 g IV 6-hourly
  • MRSA risk (health-care associated / PVL): add vancomycin
- Elevate affected limb
- Treat underlying cause: tinea pedis (portal of entry) — clotrimazole cream
- Diabetes: optimise glycaemic control
""",
            billingCodes: [
                .init(icd10: "L03.90", icdDescription: "Cellulitis, unspecified", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "If rapidly spreading or systemically unwell: admit urgently. Rule out necrotising fasciitis.",
            redFlags: ["Crepitus / gas on imaging / extreme pain out of proportion → necrotising fasciitis → emergency OT"],
            followUp: "Review at 48h. If not improving → re-examine edge, consider IV switch or MRI.",
            guidelineReference: "NICE NG141; CREST 2005; IDSA 2014"
        )),

        // ══════════════════════════════════════════════════════════════
        // MUSCULOSKELETAL
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["gout", "gouty arthritis", "hyperuricaemia"], radiation: .init(
            conditionName: "Gout / Gouty Arthritis",
            icd10Primary: "M10.9",
            investigations: [
                .init(name: "Serum uric acid", category: .blood, rationale: "Baseline — note: may be normal during acute attack"),
                .init(name: "FBC / CRP / ESR", category: .blood, rationale: "Inflammatory markers — severity and exclude septic arthritis"),
                .init(name: "U&E / Creatinine / eGFR", category: .blood, rationale: "Renal function — urate excretion + ULT drug choice"),
                .init(name: "Synovial fluid aspiration + polarised light microscopy", category: .other, rationale: "Gold standard — negatively birefringent monosodium urate crystals"),
                .init(name: "X-ray of affected joint", category: .imaging, rationale: "Chronic gout: punched-out erosions, tophi"),
                .init(name: "Fasting glucose / HbA1c + lipid profile", category: .blood, rationale: "Metabolic syndrome screen"),
            ],
            planTemplate: """
- ACUTE ATTACK:
  • NSAIDs: naproxen 500 mg BD or indomethacin 50 mg TDS × 5–7 days (if no contraindication)
  • Colchicine: 1 mg stat, then 0.5 mg 1h later (max 1.5 mg in first day)
  • Or prednisolone 30–40 mg OD × 5 days (if NSAIDs + colchicine contraindicated)
  • Joint rest + ice packs; elevate limb
  • Avoid aspirin (increases uric acid at low doses)
- DO NOT START urate-lowering therapy (ULT) during acute attack — wait 4–6 weeks
- URATE-LOWERING THERAPY (after acute attack, ≥2 attacks/year):
  • Allopurinol: start 50–100 mg OD, uptitrate monthly to target SUA <360 µmol/L (6 mg/dL)
  • Or febuxostat 80 mg OD (if allopurinol intolerant)
  • Cover initiation with colchicine 0.5 mg OD prophylaxis × 6 months
- LIFESTYLE: avoid purine-rich foods (offal, shellfish, red meat), alcohol (esp. beer)
  • Increase water intake >2 L/day; weight loss; avoid fructose
""",
            billingCodes: [
                .init(icd10: "M10.9", icdDescription: "Gout, unspecified", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: nil,
            redFlags: ["Cannot exclude septic arthritis → joint aspiration mandatory", "First MTP joint: classic podagra — treat empirically if typical presentation"],
            followUp: "Uric acid 6 weeks after starting allopurinol; monthly until target. Annual: U&E, uric acid.",
            guidelineReference: "ACR 2020; EULAR 2016; BSR 2017"
        )),

        Entry(keywords: ["sickle cell", "sickle cell disease", "sickle cell crisis", "vaso-occlusive crisis", "hbs"], radiation: .init(
            conditionName: "Sickle Cell Disease / Vaso-Occlusive Crisis",
            icd10Primary: "D57.1",
            investigations: [
                .init(name: "FBC + reticulocyte count", category: .blood, rationale: "Haemoglobin level — baseline and crisis depth"),
                .init(name: "Blood film + sickle screen", category: .blood, rationale: "Sickle cells, Howell-Jolly bodies"),
                .init(name: "Haemoglobin electrophoresis / HPLC", category: .blood, rationale: "HbS%, HbF, HbA2 — disease characterisation"),
                .init(name: "U&E / Creatinine / LFTs", category: .blood, rationale: "Organ function — sickle nephropathy / hepatopathy"),
                .init(name: "Blood cultures (if febrile)", category: .blood, rationale: "Infection — functionally asplenic"),
                .init(name: "Chest X-ray (if chest symptoms)", category: .imaging, rationale: "Acute chest syndrome — pulmonary infiltrate"),
                .init(name: "Urine MC&S", category: .other, rationale: "UTI — common in SCD"),
                .init(name: "Group and Screen", category: .blood, rationale: "Extended phenotype — pre-transfusion"),
            ],
            planTemplate: """
- ACUTE VOC MANAGEMENT:
  • Pain: WHO ladder — paracetamol → NSAIDs → weak opioid → IV/SC morphine (0.1 mg/kg)
  • Patient-controlled analgesia (PCA) for severe pain
  • IV fluids (mild dehydration: 0.9% NaCl 1–1.5× maintenance)
  • O₂ only if SaO₂ <95% (avoid hyperoxia — worsens sickling)
  • Incentive spirometry — prevent acute chest syndrome
  • DVT prophylaxis: LMWH if admitted
- FEBRILE / ACUTE CHEST SYNDROME:
  • Empirical antibiotics: ceftriaxone 2 g IV OD + azithromycin (atypicals)
  • Transfusion: exchange transfusion if HbS >70% and critical
- CHRONIC MANAGEMENT:
  • Hydroxyurea: increases HbF — reduces crises (haematology referral)
  • Folic acid 5 mg OD — ongoing
  • Penicillin prophylaxis (if functionally asplenic): phenoxymethylpenicillin 250 mg BD
  • Vaccinations: pneumococcal, meningococcal, Hib, influenza — mandatory
""",
            billingCodes: [
                .init(icd10: "D57.1", icdDescription: "Sickle cell disease without crisis", cpt: nil, cptDescription: "Medical management"),
                .init(icd10: "D57.00", icdDescription: "Sickle cell disease with unspecified crisis", cpt: nil, cptDescription: "Acute crisis management"),
            ],
            consentCategory: nil,
            urgencyNote: "Acute chest syndrome: ADMIT + IV antibiotics + O₂ + urgent haematology.",
            redFlags: ["Acute chest syndrome → ICU consider", "Stroke → exchange transfusion + neurology", "Splenic sequestration → transfuse"],
            followUp: "Haematology review every 3–6 months. Annual: echo, renal function, retinal exam, DEXA.",
            guidelineReference: "BSH 2021; NHLBI 2014"
        )),

        // ══════════════════════════════════════════════════════════════
        // INFLAMMATORY BOWEL DISEASE
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["inflammatory bowel disease", "ulcerative colitis", "crohn's disease", "crohn disease"], radiation: .init(
            conditionName: "Inflammatory Bowel Disease",
            icd10Primary: "K51.90",
            investigations: [
                .init(name: "FBC / CRP / ESR / Ferritin", category: .blood, rationale: "Inflammation + iron deficiency anaemia"),
                .init(name: "Faecal calprotectin", category: .other, rationale: "Distinguishes IBD from IBS; disease activity monitoring"),
                .init(name: "Stool MC&S + CDiff toxin", category: .other, rationale: "Exclude infective colitis and superinfection"),
                .init(name: "Colonoscopy + biopsy", category: .endoscopy, rationale: "Gold standard diagnosis — extent and pattern"),
                .init(name: "MRI small bowel", category: .imaging, rationale: "Crohn's — assess small bowel extent and fistulae"),
                .init(name: "Vitamin B12 / Folate / Iron / Zinc", category: .blood, rationale: "Nutritional deficiencies — especially Crohn's"),
                .init(name: "U&E / LFTs / Albumin", category: .blood, rationale: "Nutritional status and PSC screen"),
                .init(name: "TPMT / NUDT15 genotype (pre-azathioprine)", category: .blood, rationale: "Myelosuppression risk with thiopurines"),
            ],
            planTemplate: """
- ACUTE SEVERE COLITIS (Truelove & Witts criteria — >6 stools/day + systemic features): ADMIT
  • IV hydrocortisone 100 mg 6-hourly × 3 days
  • IV fluids + electrolyte replacement
  • Thromboprophylaxis (LMWH)
  • CT abdomen (exclude toxic megacolon)
  • GI/surgery review — rescue therapy vs colectomy at day 3
  • Rescue: IV ciclosporin or infliximab (day 3 decision)
- MILD-MODERATE COLITIS:
  • 5-ASA: mesalazine 2.4–4.8 g/day PO + mesalazine enemas / foam
  • Oral prednisolone 40 mg OD tapering (5 mg/week)
- MAINTENANCE:
  • 5-ASA long-term; azathioprine 2–2.5 mg/kg/day; biological (infliximab, adalimumab)
  • IBD nurse support; diet: low-residue in flare
- CROHN'S specific:
  • Budesonide 9 mg OD for ileocaecal disease
  • Elemental nutrition as induction
  • Anti-TNF early if steroid-dependent or fistulising
""",
            billingCodes: [
                .init(icd10: "K51.90", icdDescription: "Ulcerative colitis, unspecified", cpt: "44388", cptDescription: "Colonoscopy with biopsy"),
            ],
            consentCategory: nil,
            urgencyNote: "Acute severe colitis (>6 bloody stools/day + fever/tachycardia): ADMIT urgently.",
            redFlags: ["Toxic megacolon → emergency colectomy", "Perforation → emergency OT", "Haemorrhage → transfuse + GI"],
            followUp: "GI review 4–6 weeks. Colonoscopy surveillance after 8–10 years (CRC risk). Annual FBC/CRP.",
            guidelineReference: "ECCO 2022; NICE NG130; ACG 2019"
        )),

        // ══════════════════════════════════════════════════════════════
        // VASCULAR SURGICAL
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["mesenteric ischaemia", "mesenteric ischemia", "acute mesenteric", "bowel ischaemia"], radiation: .init(
            conditionName: "Acute Mesenteric Ischaemia",
            icd10Primary: "K55.0",
            investigations: [
                .init(name: "CT Mesenteric Angiography (CT-MA)", category: .imaging, rationale: "Definitive — identifies embolus/thrombosis, extent, bowel viability"),
                .init(name: "Lactate (serum)", category: .blood, rationale: "Raised lactate >2 → bowel ischaemia; >4 → poor prognosis"),
                .init(name: "FBC / U&E / LFTs / Coagulation", category: .blood, rationale: "Leucocytosis, AKI, coagulopathy"),
                .init(name: "ABG / Metabolic screen", category: .blood, rationale: "Metabolic acidosis — severe ischaemia"),
                .init(name: "Amylase / Lipase", category: .blood, rationale: "Elevated in ischaemia; exclude pancreatitis"),
                .init(name: "ECG", category: .other, rationale: "Atrial fibrillation — most common embolic source"),
                .init(name: "Echocardiogram", category: .imaging, rationale: "Cardiac thrombus — embolic source"),
            ],
            planTemplate: """
- EMERGENCY SURGICAL REFERRAL — DO NOT DELAY
- Resuscitate: IV fluids (crystalloid), O₂, Foley catheter
- IV heparin anticoagulation (if embolic — after surgical review)
- NBM immediately
- SURGICAL OPTIONS (based on CT findings):
  • Embolectomy / thrombectomy: viable bowel + short ischaemia time
  • Resection of non-viable bowel + second-look laparotomy at 24–48h
  • Endovascular: catheter-directed thrombolysis for SMA thrombosis (selected cases)
- NON-OCCLUSIVE (NOMI): vasodilators (papaverine infusion) + treat underlying cause
- Post-op: heparin → warfarin/DOAC for AF-related embolism
- Broad-spectrum antibiotics (bowel flora): tazobactam/piperacillin or meropenem
- ICU/HDU monitoring post-operatively
""",
            billingCodes: [
                .init(icd10: "K55.0", icdDescription: "Acute vascular disorders of intestine", cpt: "44005", cptDescription: "Enterolysis (freeing of intestinal adhesion)"),
                .init(icd10: "K55.0", icdDescription: "Acute mesenteric ischaemia", cpt: "34151", cptDescription: "Embolectomy/thrombectomy, mesenteric artery"),
            ],
            consentCategory: "Emergency Laparotomy / Mesenteric Revascularisation",
            urgencyNote: "SURGICAL EMERGENCY — mortality >50% with delay. Immediate CT angiography + surgical review.",
            redFlags: ["Peritonism → immediate OT — no further delay", "Lactate >4 → resuscitate + emergency OT", "AF source → anticoagulate after surgical haemostasis"],
            followUp: "Anticoagulation review 6 weeks. Dietitian input (short bowel risk). Stoma follow-up if applicable.",
            guidelineReference: "ESVS 2017; ESTES 2016; BSG 2019"
        )),

        Entry(keywords: ["abdominal aortic aneurysm", "aaa", "aortic aneurysm", "ruptured aaa", "ruptured aneurysm"], radiation: .init(
            conditionName: "Abdominal Aortic Aneurysm",
            icd10Primary: "I71.4",
            investigations: [
                .init(name: "CT Aorta with contrast (CTA)", category: .imaging, rationale: "Defines size, morphology, extent — essential pre-operatively"),
                .init(name: "Abdominal Ultrasound (USS)", category: .imaging, rationale: "Screening and surveillance — size monitoring"),
                .init(name: "FBC / U&E / Creatinine / Coagulation", category: .blood, rationale: "Pre-operative assessment"),
                .init(name: "Group and Crossmatch (×6 units)", category: .blood, rationale: "For repair — ruptured AAA: emergency XM"),
                .init(name: "ECG / Troponin / Echo", category: .other, rationale: "Cardiac risk stratification pre-elective repair"),
                .init(name: "Lung Function / PFTs", category: .other, rationale: "Pre-operative respiratory assessment"),
                .init(name: "eGFR / Creatinine", category: .blood, rationale: "Renal function — EVAR contrast load; post-repair AKI risk"),
            ],
            planTemplate: """
- RUPTURED AAA (haemodynamically unstable): EMERGENCY OT
  • Permissive hypotension: target SBP 80–90 mmHg until aortic control
  • Massive transfusion protocol: 1:1:1 (PRBC:FFP:Plt)
  • EVAR preferred if anatomy allows — faster, lower mortality in experienced centres
  • Open repair (aorto-aortic / aorto-bi-iliac graft) if EVAR unsuitable
- ELECTIVE REPAIR (AAA ≥5.5 cm in men; ≥5.0 cm in women, or growth >1 cm/year):
  • EVAR (endovascular): preferred if suitable anatomy
  • Open repair: fit patients with unsuitable anatomy
- SURVEILLANCE (below repair threshold):
  • <4.5 cm: USS every 2 years; 4.5–5.4 cm: USS every 3–6 months
  • Control vascular risk: smoking cessation + statin + antihypertensive + aspirin
- EVAR post-op: CT at 1 month, 12 months, then annually (endoleak surveillance)
""",
            billingCodes: [
                .init(icd10: "I71.4", icdDescription: "Abdominal aortic aneurysm, without rupture", cpt: "34802", cptDescription: "EVAR, aorto-aortic"),
                .init(icd10: "I71.3", icdDescription: "Ruptured abdominal aortic aneurysm", cpt: "35102", cptDescription: "Open repair, ruptured AAA"),
            ],
            consentCategory: "Aortic Aneurysm Repair (EVAR / Open)",
            urgencyNote: "Ruptured AAA: highest surgical emergency — mortality 50% even with operative repair. Activate major haemorrhage protocol.",
            redFlags: ["Haemodynamic instability + back/abdominal pain → ruptured AAA → emergency OT", "AAA >5.5 cm → elective repair planning"],
            followUp: "Post-EVAR: CT at 1, 12 months then annually. Open repair: USS 5 years. Duplex for graft surveillance.",
            guidelineReference: "ESVS 2019; NICE NG156; SVS 2018"
        )),

        Entry(keywords: ["peripheral arterial disease", "pad", "peripheral vascular disease", "intermittent claudication", "critical limb ischaemia", "pvd"], radiation: .init(
            conditionName: "Peripheral Arterial Disease",
            icd10Primary: "I70.209",
            investigations: [
                .init(name: "ABPI (Ankle Brachial Pressure Index)", category: .other, rationale: "Diagnostic: <0.9 PAD; <0.5 critical ischaemia"),
                .init(name: "Duplex Arterial Ultrasound (lower limb)", category: .imaging, rationale: "Localise lesions — stenosis / occlusion pattern"),
                .init(name: "CT Angiography (CTA) lower limb", category: .imaging, rationale: "Pre-intervention anatomy — extent of disease"),
                .init(name: "Fasting glucose / HbA1c", category: .blood, rationale: "Diabetes — major modifiable risk factor"),
                .init(name: "Lipid profile", category: .blood, rationale: "Statin indication — very high cardiovascular risk"),
                .init(name: "FBC / Creatinine / eGFR", category: .blood, rationale: "Anaemia + renal function (contrast planning)"),
                .init(name: "ECG / Cardiology review", category: .other, rationale: "Concurrent coronary artery disease — very common"),
            ],
            planTemplate: """
- RISK FACTOR MODIFICATION (all patients):
  • Smoking cessation — most important intervention
  • Statin: atorvastatin 40–80 mg OD (target LDL <1.8 mmol/L)
  • Antiplatelet: aspirin 75 mg OD or clopidogrel 75 mg OD
  • Blood pressure control: ACE inhibitor + amlodipine (RAMPART evidence)
  • Diabetes optimisation: HbA1c <53 mmol/mol
- SUPERVISED EXERCISE PROGRAMME (claudication — first-line):
  • 3× per week for ≥12 weeks — proven to improve walking distance
- CILOSTAZOL 100 mg BD (claudication — if exercise programme insufficient):
  • Phosphodiesterase inhibitor — improves symptoms; contraindicated in HF
- REVASCULARISATION (critical limb ischaemia or lifestyle-limiting claudication):
  • Angioplasty ± stenting (endovascular — first choice aorto-iliac/fem-pop)
  • Bypass grafting (fem-pop, fem-distal — autologous vein preferred)
- CRITICAL LIMB ISCHAEMIA: urgent vascular surgical referral; LMWH; wound care
""",
            billingCodes: [
                .init(icd10: "I70.209", icdDescription: "Peripheral arterial disease, lower extremity", cpt: "35556", cptDescription: "Femoro-popliteal bypass graft"),
                .init(icd10: "I70.209", icdDescription: "PAD", cpt: "37221", cptDescription: "Iliac angioplasty with stent"),
            ],
            consentCategory: "Peripheral Vascular Reconstruction",
            urgencyNote: "Critical limb ischaemia (rest pain / ulcer / gangrene): urgent vascular referral — limb-threatening.",
            redFlags: ["Acute limb ischaemia (6 Ps: Pain, Pallor, Pulseless, Paraesthesia, Paralysis, Perishingly cold) → emergency OT"],
            followUp: "Duplex graft surveillance at 6 weeks, 6 months, then annually. Wound clinic for ulcers.",
            guidelineReference: "ESVS 2017; NICE NG19; AHA/ACC 2016"
        )),

        Entry(keywords: ["aortic dissection", "type a dissection", "type b dissection", "stanford a", "stanford b"], radiation: .init(
            conditionName: "Aortic Dissection",
            icd10Primary: "I71.00",
            investigations: [
                .init(name: "CT Aorta (ECG-gated CTA chest/abdomen/pelvis)", category: .imaging, rationale: "Diagnostic — Stanford type, extent, branch involvement"),
                .init(name: "CXR (widened mediastinum)", category: .imaging, rationale: "Rapid screening — abnormal in 60%"),
                .init(name: "ECG", category: .other, rationale: "Rule out ACS; inferior ST changes if RCA compromised"),
                .init(name: "FBC / U&E / Creatinine / LFTs / Lactate", category: .blood, rationale: "Organ malperfusion"),
                .init(name: "Troponin", category: .blood, rationale: "ACS exclusion / myocardial involvement"),
                .init(name: "D-dimer", category: .blood, rationale: "Elevation supports diagnosis (not diagnostic alone)"),
                .init(name: "Group and Crossmatch", category: .blood, rationale: "Type A: pre-operative requirement"),
            ],
            planTemplate: """
- STANFORD TYPE A (ascending aorta involved): EMERGENCY CARDIAC SURGERY
  • Emergency cardiothoracic referral
  • HR and BP control: IV labetalol or esmolol (target HR <60, SBP 100–120)
  • Analgesia: IV morphine
- STANFORD TYPE B (descending only, uncomplicated):
  • Medical management: IV beta-blocker + vasodilator (nicardipine)
  • Target SBP 100–120 mmHg; HR <60
  • Monitor for malperfusion (renal, limb, bowel)
- TYPE B COMPLICATED (malperfusion / rupture / expansion):
  • TEVAR (Thoracic EVAR) — preferred endovascular approach
- ICU/HDU monitoring mandatory
- Regular neurological assessment (spinal cord ischaemia)
- Anticoagulation: avoid in Type A pre-op; cautious in Type B
""",
            billingCodes: [
                .init(icd10: "I71.01", icdDescription: "Dissection of thoracoabdominal aorta", cpt: "33860", cptDescription: "Ascending aorta repair, Type A dissection"),
            ],
            consentCategory: "Emergency Aortic Surgery / TEVAR",
            urgencyNote: "Type A dissection: immediate cardiothoracic transfer — mortality 1–2% per hour untreated.",
            redFlags: ["Haemopericardium → tamponade", "Aortic regurgitation", "Coronary malperfusion → MI", "Neurological deficit → spinal cord ischaemia"],
            followUp: "CT surveillance at 1, 6, 12 months, then annually. Lifelong antihypertensive therapy.",
            guidelineReference: "ESC 2014; ESVS 2017; STS 2015"
        )),

        // ══════════════════════════════════════════════════════════════
        // ACUTE SURGICAL ABDOMEN
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["bowel obstruction", "small bowel obstruction", "sbo", "intestinal obstruction", "volvulus", "adhesion obstruction"], radiation: .init(
            conditionName: "Small Bowel Obstruction",
            icd10Primary: "K56.60",
            investigations: [
                .init(name: "AXR (Supine + Erect / Lateral decubitus)", category: .imaging, rationale: "Dilated loops >3 cm + air-fluid levels = SBO"),
                .init(name: "CT Abdomen/Pelvis (with contrast — IV ± oral)", category: .imaging, rationale: "Gold standard — identifies cause (adhesion, hernia, tumour), transition point, strangulation"),
                .init(name: "FBC / U&E / Creatinine / LFTs", category: .blood, rationale: "Electrolyte derangement; leucocytosis suggests strangulation"),
                .init(name: "Lactate (serum)", category: .blood, rationale: "Raised >2 → ischaemia / strangulation"),
                .init(name: "Amylase / Lipase", category: .blood, rationale: "Exclude pancreatitis; elevated in SBO"),
                .init(name: "Group and Screen", category: .blood, rationale: "Pre-operative requirement"),
            ],
            planTemplate: """
- IMMEDIATE:
  • NBM; IV access × 2; urinary catheter (fluid balance)
  • IV crystalloid resuscitation: 0.9% NaCl or Hartmann's
  • Nasogastric tube (NG) on free drainage — decompress + reduce vomiting
  • IV antiemetic: ondansetron 8 mg or metoclopramide 10 mg
  • Analgesia: IV morphine 2.5–5 mg titrated (do not withhold — does not mask signs)
  • Electrolyte replacement (K⁺ particularly)
- CONSERVATIVE TRIAL (adhesion SBO, no signs of strangulation):
  • 48–72h NG decompression + IV fluids; serial clinical examination
  • Water-soluble contrast study (Gastrografin) at 24h — therapeutic + diagnostic
  • 80% adhesion SBO resolves conservatively
- OPERATIVE INDICATIONS:
  • Strangulation (peritonism, fever, leucocytosis, lactate rise, blood supply)
  • Complete obstruction failing conservative × 48–72h
  • Hernia (external) → reduce/repair urgently
  • Tumour / volvulus / intussusception → surgery
- Surgical options: adhesiolysis, hernia repair, resection ± anastomosis
- Broad-spectrum antibiotics if operative: co-amoxiclav 1.2g IV or cefuroxime + metronidazole
""",
            billingCodes: [
                .init(icd10: "K56.60", icdDescription: "Unspecified intestinal obstruction", cpt: "44005", cptDescription: "Enterolysis (lysis of adhesions)"),
                .init(icd10: "K56.60", icdDescription: "SBO", cpt: "44120", cptDescription: "Enterectomy, resection of small intestine"),
            ],
            consentCategory: "Laparotomy / Adhesiolysis",
            urgencyNote: "Any signs of strangulation (fever, peritonism, tachycardia, raised lactate) → emergency OT — do not delay.",
            redFlags: ["Strangulation → emergency laparotomy", "Closed-loop obstruction → ischaemia rapid — CT urgent"],
            followUp: "Follow-up at 2–6 weeks post-operatively. Bowel function review. Recurrence counselling.",
            guidelineReference: "EAST Guidelines; ACPGBI 2020; WSES 2017"
        )),

        Entry(keywords: ["perforated", "viscus perforation", "gastric perforation", "duodenal perforation", "perforated peptic ulcer", "peritonitis", "pneumoperitoneum"], radiation: .init(
            conditionName: "Perforated Viscus / Peritonitis",
            icd10Primary: "K27.1",
            investigations: [
                .init(name: "Erect CXR (free gas under diaphragm)", category: .imaging, rationale: "Pneumoperitoneum — present in 75% of perforations"),
                .init(name: "CT Abdomen/Pelvis (IV contrast)", category: .imaging, rationale: "Confirms perforation site, extent, collections"),
                .init(name: "FBC / CRP / U&E / LFTs / Coagulation", category: .blood, rationale: "Sepsis assessment; pre-operative baseline"),
                .init(name: "Lactate", category: .blood, rationale: "Sepsis severity and organ perfusion"),
                .init(name: "Blood cultures × 2", category: .blood, rationale: "Before antibiotics — bacteraemia likely"),
                .init(name: "Group and Crossmatch", category: .blood, rationale: "Pre-operative requirement"),
                .init(name: "Urine MC&S / Catheter", category: .other, rationale: "Fluid balance monitoring; exclude renal cause"),
            ],
            planTemplate: """
- IMMEDIATE RESUSCITATION (Sepsis Six within 1 hour):
  • O₂ (target SpO₂ >94%)
  • IV access × 2 + blood cultures before antibiotics
  • IV broad-spectrum antibiotics: tazobactam/piperacillin 4.5g 8-hourly + metronidazole 500mg TDS
  • IV fluid resuscitation: 500 mL crystalloid bolus → reassess
  • Urinary catheter — strict fluid balance
  • Serial lactate
  • NBM + NG tube on free drainage
  • Analgesia: IV morphine (do not withhold)
  • Urgent surgical review
- OPERATIVE MANAGEMENT (most require surgery):
  • PERFORATED PU:
    - Laparoscopic washout + omental patch (Graham's patch)
    - Open repair if laparoscopy contraindicated / contamination heavy
  • COLONIC PERFORATION:
    - Hartmann's procedure (sigmoid — most common) or primary anastomosis if fit + low contamination
  • POST-OPERATIVE: proton pump inhibitor IV → oral; H. pylori eradication (PU)
- NON-OPERATIVE (sealed perforation — CT confirmed, stable, low CRP):
  • Selected cases: IV antibiotics + strict monitoring + CT at 48h
  • Surgery if any deterioration
""",
            billingCodes: [
                .init(icd10: "K27.1", icdDescription: "Peptic ulcer, acute with perforation", cpt: "43840", cptDescription: "Gastrorrhaphy, suture of perforated duodenal/gastric ulcer"),
            ],
            consentCategory: "Emergency Laparotomy / Laparoscopy for Perforated Viscus",
            urgencyNote: "Perforated viscus with peritonitis: SURGICAL EMERGENCY. Antibiotics + OT within 1 hour of decision.",
            redFlags: ["Septic shock → ICU-level resuscitation in parallel with OT", "Faecal peritonitis → higher mortality — senior surgeon required"],
            followUp: "H. pylori testing at 6 weeks post-discharge. PPI for 8 weeks. Endoscopy at 6–8 weeks to confirm healing.",
            guidelineReference: "NICE CG184; WSES 2016; BOA/ACPGBI 2018"
        )),

        // ══════════════════════════════════════════════════════════════
        // PILONIDAL DISEASE
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["pilonidal", "pilonidal sinus", "pilonidal abscess", "pilonidal cyst", "natal cleft"], radiation: .init(
            conditionName: "Pilonidal Sinus Disease",
            icd10Primary: "L05.91",
            investigations: [
                .init(name: "Clinical examination (natal cleft inspection)", category: .other, rationale: "Diagnosis is clinical — sinus pits, abscess, discharge"),
                .init(name: "FBC / CRP (if systemic features)", category: .blood, rationale: "Abscess with cellulitis or systemic infection"),
                .init(name: "Wound swab (if discharging)", category: .other, rationale: "Microbiological — guide antibiotics if infected"),
                .init(name: "MRI pelvis (if complex/recurrent)", category: .imaging, rationale: "Delineate complex sinus network; exclude fistula-in-ano"),
            ],
            planTemplate: """
- ACUTE PILONIDAL ABSCESS:
  • Incision & Drainage (I&D) under LA/GA — incision lateral to midline
  • Do NOT perform definitive sinus excision at time of acute abscess
  • Pack wound; review at 24–48h
  • Antibiotics only if significant surrounding cellulitis: flucloxacillin 500mg QDS × 5 days
- CHRONIC PILONIDAL SINUS (definitive surgery, elective):
  • Pit picking (Lord-Millar) — minimal, day case, high recurrence
  • Wide excision with primary closure (off-midline Z-plasty / Bascom cleft-lift) — preferred for complex/recurrent
  • Excision with Limberg flap or Karydakis procedure — best outcomes, low recurrence
  • Excision open (healing by secondary intention) — simple, slow healing
- HAIR REMOVAL: regular laser/IPL to natal cleft reduces recurrence
- BODY WEIGHT: obesity increases recurrence — weight management
- HYGIENE: keep natal cleft dry; avoid hair accumulation
""",
            billingCodes: [
                .init(icd10: "L05.01", icdDescription: "Pilonidal cyst with abscess", cpt: "10060", cptDescription: "Incision & drainage of abscess, simple"),
                .init(icd10: "L05.91", icdDescription: "Pilonidal cyst without abscess, uninfected", cpt: "11770", cptDescription: "Excision of pilonidal cyst, simple"),
                .init(icd10: "L05.91", icdDescription: "Pilonidal sinus", cpt: "11771", cptDescription: "Excision of pilonidal cyst, extensive"),
            ],
            consentCategory: "Pilonidal Sinus Excision / Flap Repair",
            urgencyNote: "Acute abscess → urgent I&D (can be done under LA in rooms); definitive excision planned 6–8 weeks later.",
            redFlags: ["Necrotising infection (rare but life-threatening) → broad-spectrum IV antibiotics + emergency OT"],
            followUp: "Wound review at 1–2 weeks. Recurrence rate post-excision 10–30% — counsel patient. Hair removal follow-up.",
            guidelineReference: "ACPGBI 2019; ASCRS 2019; Royal College of Surgeons 2018"
        )),

        // ══════════════════════════════════════════════════════════════
        // UROLOGY / RENAL
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["renal colic", "kidney stone", "ureteric calculus", "ureteric stone", "nephrolithiasis", "loin to groin pain"], radiation: .init(
            conditionName: "Renal Colic / Ureteric Calculus",
            icd10Primary: "N20.1",
            investigations: [
                .init(name: "CT KUB (non-contrast)", category: .imaging, rationale: "Gold standard — sensitivity >95%; stone size, site, obstruction"),
                .init(name: "Urine dipstick + MC&S", category: .other, rationale: "Haematuria; exclude infection (infected stone → emergency)"),
                .init(name: "FBC / U&E / Creatinine / CRP", category: .blood, rationale: "Renal function; sepsis assessment; AKI from obstruction"),
                .init(name: "Serum calcium / Uric acid / Parathyroid hormone", category: .blood, rationale: "Metabolic workup — recurrent stones or bilateral"),
                .init(name: "24h Urine (stone metabolic screen)", category: .other, rationale: "Calcium, oxalate, citrate, uric acid — recurrent disease"),
                .init(name: "Plain AXR (KUB)", category: .imaging, rationale: "Radio-opaque stones (calcium oxalate/phosphate) — follow-up"),
            ],
            planTemplate: """
- ANALGESIA (FIRST PRIORITY):
  • Diclofenac 75 mg IM or PR (NSAID — first line, reduces ureteric spasm)
  • If NSAID contraindicated: IV morphine 2.5–5 mg + antiemetic
  • Paracetamol 1g IV/PO as adjunct
- ANTIEMETIC: ondansetron 8 mg IV/PO or metoclopramide 10 mg
- ALPHA BLOCKER (MET — medical expulsive therapy):
  • Tamsulosin 400 mcg OD × 4 weeks (stones ≤10 mm distal ureter — improves passage rate)
- HYDRATION: IV fluids if vomiting; oral fluids otherwise (high-volume hydration does not speed passage)
- STONE MANAGEMENT:
  • <5 mm: observe — 90% pass spontaneously (MET)
  • 5–10 mm: MET + urology follow-up; ESWL if no spontaneous passage at 4 weeks
  • >10 mm or obstructed infected system:
    - Urgent urology referral → ureteroscopy (URS) + laser lithotripsy
    - JJ stent / nephrostomy if obstructed + infected (emergency drainage)
- ADMIT IF: fever + obstruction (infected obstructed kidney = emergency), AKI, intractable pain, solitary kidney
- METABOLIC WORKUP: 24h urine + calcium/uric acid after acute episode
""",
            billingCodes: [
                .init(icd10: "N20.1", icdDescription: "Calculus of ureter", cpt: "52356", cptDescription: "Ureteroscopy with laser lithotripsy"),
                .init(icd10: "N20.0", icdDescription: "Calculus of kidney", cpt: "50590", cptDescription: "Shock wave lithotripsy (ESWL), renal/ureteral"),
                .init(icd10: "N20.1", icdDescription: "Ureteric stone", cpt: "50386", cptDescription: "Removal of ureteric stent"),
            ],
            consentCategory: "Ureteroscopy / Laser Lithotripsy / ESWL",
            urgencyNote: "Infected obstructed system (fever + urinary obstruction) = UROLOGICAL EMERGENCY → drainage within 12 hours.",
            redFlags: ["Fever + flank pain + obstruction → septic shock risk → emergency urology drainage (nephrostomy or stent)", "AKI from bilateral obstruction or solitary kidney → urgent decompression"],
            followUp: "Urology at 4–6 weeks with stone analysis. 24h urine metabolic workup. Dietary advice (increase fluid, reduce oxalate). Urine MC&S 1 week post-procedure.",
            guidelineReference: "EAU Guidelines 2023; NICE CG194; AUA 2019"
        )),

        Entry(keywords: ["acute kidney injury", "aki", "renal failure acute", "oliguria", "anuria"], radiation: .init(
            conditionName: "Acute Kidney Injury",
            icd10Primary: "N17.9",
            investigations: [
                .init(name: "U&E / Creatinine (serial — baseline vs current)", category: .blood, rationale: "KDIGO staging: Stage 1 ×1.5 baseline; Stage 2 ×2; Stage 3 ×3 or >354 µmol/L"),
                .init(name: "Urinalysis + urine MC&S", category: .other, rationale: "Casts (ATN), protein/blood (GN), infection (prerenal from sepsis)"),
                .init(name: "Urine Na / urine osmolality", category: .other, rationale: "FENa <1% prerenal; >2% intrinsic; urine osmol >500 prerenal"),
                .init(name: "FBC / CRP / Blood cultures (if febrile)", category: .blood, rationale: "Sepsis — commonest cause of AKI; blood cultures before antibiotics"),
                .init(name: "Renal Ultrasound", category: .imaging, rationale: "Obstruction (hydronephrosis) — postrenal AKI → relieve urgently"),
                .init(name: "ECG", category: .other, rationale: "Hyperkalaemia — peaked T waves, wide QRS → emergency"),
                .init(name: "Calcium / Phosphate / Bicarbonate / Lactate", category: .blood, rationale: "Metabolic complications of AKI"),
            ],
            planTemplate: """
- IDENTIFY & TREAT CAUSE:
  • PRERENAL (commonest — dehydration, sepsis, cardiac output): IV fluid challenge; treat sepsis
  • INTRINSIC (ATN, nephritis, drugs): stop nephrotoxins (NSAIDs, aminoglycosides, contrast, ACE inhibitors in volume depletion)
  • POSTRENAL (obstruction): urgent renal USS → nephrostomy/stent if hydronephrosis
- FLUID MANAGEMENT:
  • Hypovolaemia: 500 mL 0.9% NaCl bolus → reassess response (JVP, UO, BP)
  • Oliguric AKI (UO <0.5 mL/kg/h): furosemide challenge 20–40 mg IV after adequate volume replacement
  • Fluid overload: fluid restrict ± furosemide; consider dialysis
- HYPERKALAEMIA MANAGEMENT:
  • K⁺ >6.0 or ECG changes: 10 mL 10% calcium gluconate IV (cardioprotection)
  • Insulin 10 units + 50% dextrose 50 mL IV (shift K⁺ intracellularly)
  • Salbutamol 10–20 mg nebulised (K⁺ shift)
  • Kayexalate / patiromer / sodium zirconium (GI elimination)
  • Restrict dietary K⁺; stop K⁺-sparing drugs
- RENAL REPLACEMENT THERAPY (RRT) — indications:
  • Refractory hyperkalaemia (K⁺ >6.5 despite treatment)
  • Refractory acidosis (pH <7.1)
  • Fluid overload unresponsive to diuretics
  • Uraemic encephalopathy or pericarditis
- DRUG DOSING: adjust all renally-cleared drugs; check BNF
""",
            billingCodes: [
                .init(icd10: "N17.9", icdDescription: "Acute kidney injury, unspecified", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "Hyperkalaemia >6.5 + ECG changes: IMMEDIATE treatment — calcium gluconate IV first.",
            redFlags: ["ECG changes (peaked T, wide QRS) → hyperkalaemia emergency", "Anuria → obstruction excluded? → urgent USS", "Uraemic encephalopathy → dialysis"],
            followUp: "Nephrology review if no recovery at 48–72h. Repeat U&E at 48h, then weekly until creatinine stable. Avoid nephrotoxins long-term.",
            guidelineReference: "KDIGO AKI 2012; NICE AKI 2013 (NG148); RCP 2015"
        )),

        // ══════════════════════════════════════════════════════════════
        // NEUROLOGY — STROKE / TIA
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["stroke", "ischaemic stroke", "cerebrovascular accident", "cva", "tia", "transient ischaemic attack"], radiation: .init(
            conditionName: "Ischaemic Stroke / TIA",
            icd10Primary: "I63.9",
            investigations: [
                .init(name: "CT Brain (non-contrast) — IMMEDIATE", category: .imaging, rationale: "Exclude haemorrhage before thrombolysis; haemorrhage evident immediately"),
                .init(name: "MRI Brain + DWI (diffusion-weighted)", category: .imaging, rationale: "DWI most sensitive for ischaemia within hours — confirms TIA territory"),
                .init(name: "CT/MR Angiography (intracranial + carotid)", category: .imaging, rationale: "Identify large vessel occlusion (LVO) for thrombectomy eligibility"),
                .init(name: "12-lead ECG + cardiac monitoring ≥24h", category: .other, rationale: "AF detection — paroxysmal AF in up to 25% of cryptogenic stroke"),
                .init(name: "FBC / Coagulation / U&E / Glucose", category: .blood, rationale: "Stroke mimics (hypoglycaemia); coagulopathy; anaemia"),
                .init(name: "Lipid profile / HbA1c", category: .blood, rationale: "Modifiable risk factors"),
                .init(name: "Carotid Doppler Ultrasound", category: .imaging, rationale: "Ipsilateral carotid stenosis >50% → carotid endarterectomy within 2 weeks"),
                .init(name: "Echocardiogram (TTE/TOE)", category: .imaging, rationale: "Cardioembolic source — thrombus, PFO, valvular disease"),
            ],
            planTemplate: """
- HYPERACUTE STROKE UNIT TRANSFER — time critical
- THROMBOLYSIS (IV alteplase 0.9 mg/kg max 90 mg):
  • Window: onset <4.5h (or last-known well <4.5h)
  • Contraindications: haemorrhage on CT, anticoagulation, BP >185/110 uncontrolled, recent surgery/trauma
  • ACTIVATE STROKE TEAM immediately
- MECHANICAL THROMBECTOMY:
  • LVO on CTA/MRA + salvageable penumbra (ASPECTS ≥6) + onset <24h
  • Transfers to thrombectomy-capable centre if not available locally
- BLOOD PRESSURE:
  • Pre-thrombolysis: treat if >185/110; target <185/110 for eligibility
  • Post-thrombolysis: <180/105 for 24h
  • Non-thrombolysis: avoid aggressive lowering <220/120 in acute 24h (collateral perfusion)
- ANTIPLATELET:
  • Start aspirin 300 mg stat if haemorrhage excluded (thrombolysis: delay 24h)
  • Dual antiplatelet (aspirin + clopidogrel) × 21 days for minor stroke/TIA (POINT trial)
  • Switch to clopidogrel 75 mg OD monotherapy after 21 days
- TIA: ABCD² score; high-risk (≥4) → admit / next-day stroke clinic + dual antiplatelet
  • Carotid endarterectomy within 2 weeks if stenosis >50% ipsilateral
- ANTICOAGULATION for AF:
  • DOAC (apixaban or rivaroxaban) after 2 weeks for most ischaemic strokes with AF
  • LMWH bridge in high-risk settings
""",
            billingCodes: [
                .init(icd10: "I63.9", icdDescription: "Cerebral infarction, unspecified", cpt: nil, cptDescription: "Medical management / thrombolysis"),
                .init(icd10: "G45.9", icdDescription: "Transient ischaemic attack, unspecified", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "STROKE: Time = Brain. Activate stroke pathway immediately. CT within 15 min of arrival.",
            redFlags: ["Large vessel occlusion → mechanical thrombectomy eligible → transfer urgently", "BP >185/110 pre-thrombolysis → control before giving alteplase", "TIA with ABCD² ≥4 → high 48h stroke risk → admit + dual antiplatelet"],
            followUp: "Stroke clinic at 1 week. Carotid Doppler at 24h. Cardiology follow-up if AF. BP/lipid optimisation. Speech/OT/physio rehabilitation.",
            guidelineReference: "RCP Stroke Guidelines 2023; ESO 2021; AHA/ASA 2019; NICE NG128"
        )),

        Entry(keywords: ["intracranial haemorrhage", "subarachnoid haemorrhage", "sah", "intracerebral haemorrhage", "thunderclap headache"], radiation: .init(
            conditionName: "Subarachnoid Haemorrhage / Intracranial Haemorrhage",
            icd10Primary: "I60.9",
            investigations: [
                .init(name: "CT Brain non-contrast (URGENT)", category: .imaging, rationale: "SAH: hyperdense blood in cisterns (sensitivity ~98% in first 6h)"),
                .init(name: "LP (lumbar puncture — 12h after headache onset if CT negative)", category: .other, rationale: "Xanthochromia — gold standard for SAH if CT negative"),
                .init(name: "CT Angiography (CTA)", category: .imaging, rationale: "Aneurysm identification — saccular aneurysm in 85% SAH"),
                .init(name: "FBC / Coagulation / U&E", category: .blood, rationale: "Pre-operative; hyponatraemia common in SAH (SIADH/CSW)"),
                .init(name: "ECG / Troponin", category: .blood, rationale: "Neurogenic cardiac effects of SAH (ST changes, troponin rise)"),
            ],
            planTemplate: """
- IMMEDIATE:
  • Urgent neurosurgical / neurology referral
  • ICU/HDU admission
  • Analgesia: paracetamol 1g QDS; avoid NSAIDs (platelet effects)
  • Bed rest; avoid Valsalva
  • IV nimodipine 60 mg 4-hourly (calcium channel blocker — reduces vasospasm after SAH)
  • IV fluids: maintain euvolaemia; avoid hyponatraemia
- ANEURYSMAL SAH:
  • Neurosurgical coiling (endovascular) or clipping (open) within 24–72h
  • Monitor for vasospasm (day 4–14): TCD monitoring; consider CTA
  • Treat vasospasm: IV fluids (triple H therapy cautious); vasopressors; intra-arterial nimodipine
- BLOOD PRESSURE: SBP <160 mmHg (pre-treatment of aneurysm); avoid hypotension
- ANTI-SEIZURE PROPHYLAXIS: levetiracetam 500 mg BD (controversial — local protocol)
- ICH (Intracerebral): reverse anticoagulation; neurosurgery for accessible haematoma with deterioration
""",
            billingCodes: [
                .init(icd10: "I60.9", icdDescription: "Subarachnoid haemorrhage, unspecified", cpt: nil, cptDescription: "Neurosurgical management"),
            ],
            consentCategory: nil,
            urgencyNote: "Thunderclap headache = SAH until proven otherwise. CT BRAIN STAT. Neurological emergency.",
            redFlags: ["Sentinel headache (mild preceding) → preceding leak → high rupture risk", "Rebleed before treatment → fatal → secure aneurysm urgently"],
            followUp: "CTA at 3–6 months (aneurysm occlusion check). Neuropsychological assessment. Annual follow-up for vasospasm sequelae.",
            guidelineReference: "NICE NG224; ESO 2021; Neurocritical Care Society"
        )),

        // ══════════════════════════════════════════════════════════════
        // CARDIOLOGY — ATRIAL FIBRILLATION
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["atrial fibrillation", "af", "paroxysmal af", "flutter", "irregular heartbeat", "palpitations irregular"], radiation: .init(
            conditionName: "Atrial Fibrillation",
            icd10Primary: "I48.91",
            investigations: [
                .init(name: "12-lead ECG (confirms AF)", category: .other, rationale: "Absent P waves + irregularly irregular rhythm + narrow QRS"),
                .init(name: "FBC / TFTs / U&E / LFTs", category: .blood, rationale: "Thyrotoxicosis; electrolyte imbalance; alcohol (hepatic)"),
                .init(name: "Echocardiogram (TTE)", category: .imaging, rationale: "Structural heart disease, LV function, LA size, valvular disease"),
                .init(name: "CXR", category: .imaging, rationale: "Cardiomegaly, pulmonary oedema"),
                .init(name: "Thyroid function (TSH / free T4)", category: .blood, rationale: "Thyrotoxicosis — commonest reversible cause"),
                .init(name: "HbA1c / Fasting glucose", category: .blood, rationale: "Diabetes — independent AF risk factor"),
                .init(name: "Holter monitor / 7-day event recorder (if paroxysmal)", category: .other, rationale: "Document paroxysmal AF; quantify burden"),
            ],
            planTemplate: """
- CHA₂DS₂-VASc SCORE (stroke risk — guide anticoagulation):
  • ≥2 men / ≥3 women: DOAC strongly recommended
  • 1 (men) / 2 (women): DOAC recommended (consider)
  • 0 (men) / 1 (women): no anticoagulation needed
- ANTICOAGULATION (preferred DOAC over warfarin):
  • Apixaban 5 mg BD (dose-reduced 2.5 mg BD if ≥2 of: age ≥80, weight ≤60 kg, Cr ≥133)
  • Rivaroxaban 20 mg OD with evening meal
  • Dabigatran 150 mg BD (110 mg if >75 or renal impairment)
  • Warfarin: target INR 2–3 (if DOAC contraindicated)
  • ASSESS BLEEDING RISK: HAS-BLED score — treat modifiable bleeding risk factors
- RATE CONTROL (most patients — target HR <110 at rest):
  • Beta-blocker: bisoprolol 2.5–5 mg OD (titrate to <110 bpm)
  • Or digoxin 125–250 mcg OD (if contraindication to beta-blocker; elderly; HFrEF)
  • Or rate-limiting calcium blocker: diltiazem 60 mg TDS (if no HF)
- RHYTHM CONTROL (selected: younger, symptomatic, recent onset <12 months, HF):
  • Electrical cardioversion (DCCV) after 4+ weeks anticoagulation (or TOE to exclude LA thrombus)
  • Flecainide 100–150 mg BD (pill-in-pocket for PAF if no structural disease)
  • Amiodarone 200 mg TDS × 1/52 → 200 mg BD × 1/52 → 200 mg OD maintenance
  • AF ablation: pulmonary vein isolation — paroxysmal AF in symptomatic patients
""",
            billingCodes: [
                .init(icd10: "I48.91", icdDescription: "Unspecified atrial fibrillation", cpt: "92960", cptDescription: "Electrical cardioversion"),
            ],
            consentCategory: nil,
            urgencyNote: "Haemodynamically unstable AF (SBP <90, pulmonary oedema): immediate synchronised DCCV.",
            redFlags: ["Haemodynamic compromise → immediate DCCV", "AF + WPW (delta wave on ECG) → DO NOT use beta-blockers/digoxin/adenosine → amiodarone or procainamide"],
            followUp: "Cardiology at 4–6 weeks. INR check 1 week if warfarin. BP and rate control at 2 weeks. Annual: TFTs, U&E, LFTs if amiodarone.",
            guidelineReference: "ESC 2020; NICE NG196; AHA/ACC 2023"
        )),

        // ══════════════════════════════════════════════════════════════
        // HAEMATOLOGY — ANAEMIA
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["anaemia", "anemia", "iron deficiency anaemia", "iron deficiency", "low haemoglobin"], radiation: .init(
            conditionName: "Iron Deficiency Anaemia",
            icd10Primary: "D50.9",
            investigations: [
                .init(name: "FBC (MCV, MCH, MCHC, Hb)", category: .blood, rationale: "Microcytic hypochromic anaemia — classic IDA pattern"),
                .init(name: "Iron studies (Serum iron / TIBC / Transferrin saturation)", category: .blood, rationale: "Low ferritin (<15) + low saturation (<20%) = IDA"),
                .init(name: "Ferritin", category: .blood, rationale: "Most sensitive marker for iron stores (elevated as acute phase reactant in inflammation)"),
                .init(name: "Reticulocyte count", category: .blood, rationale: "Assess marrow response; reticulocytosis after treatment = good response"),
                .init(name: "Blood film", category: .blood, rationale: "Target cells, pencil cells, hypochromia — confirms IDA pattern"),
                .init(name: "OGD + Colonoscopy (if ≥50y or male any age)", category: .endoscopy, rationale: "GI blood loss — colorectal cancer / PU — MANDATORY investigation"),
                .init(name: "Faecal occult blood (FOB) / FIT", category: .other, rationale: "Screen for GI blood loss"),
                .init(name: "Coeliac screen (anti-tTG IgA + total IgA)", category: .blood, rationale: "Malabsorption — commonest cause in young women after menorrhagia"),
                .init(name: "Urine dipstick (haematuria)", category: .other, rationale: "Renal loss of iron in haemoglobinuria"),
            ],
            planTemplate: """
- TREAT THE CAUSE (mandatory — do not just replace iron without investigation):
  • GI blood loss: colonoscopy/OGD → treat underlying cause
  • Menorrhagia: gynaecology referral
  • Coeliac: gluten-free diet
- ORAL IRON REPLACEMENT (mild-moderate, tolerating orals):
  • Ferrous sulfate 200 mg TDS (65 mg elemental iron per tablet) — first-line
  • Take on empty stomach; ascorbic acid (vitamin C) 250 mg enhances absorption
  • Continue for 3 months after Hb normalises (to replete stores)
  • Side effects: constipation, black stools, nausea (switch to ferrous gluconate 300 mg TDS if poor tolerance)
- IV IRON (if oral not tolerated / malabsorption / pre-operative rapid repletion):
  • Ferric carboxymaltose (Ferinject): 1000 mg IV over 15 min (max 1g per visit)
  • Ferric derisomaltose (Monofer): up to 20 mg/kg (large single dose)
  • Monitor for hypersensitivity reactions (ANAPHYLAXIS RISK — have resuscitation available)
  • Hb response at 4 weeks: +20 g/L expected
- PRE-OPERATIVE ANAEMIA: target Hb ≥100 g/L; IV iron if surgery within 4 weeks
- BLOOD TRANSFUSION: threshold Hb <70 g/L (or <80 g/L in cardiac disease / symptomatic)
""",
            billingCodes: [
                .init(icd10: "D50.9", icdDescription: "Iron deficiency anaemia, unspecified", cpt: nil, cptDescription: "Medical management"),
            ],
            consentCategory: nil,
            urgencyNote: "Hb <70 g/L + symptomatic or Hb <80 g/L + cardiac disease: consider blood transfusion.",
            redFlags: ["New IDA in men or post-menopausal women → MANDATORY GI investigation (bowel cancer until proven otherwise)", "Hb <60 g/L → consider inpatient transfusion"],
            followUp: "FBC at 4 weeks (confirm Hb rise ≥20 g/L). Ferritin at 3 months. Continue iron 3 months post-normalisation.",
            guidelineReference: "BSH 2021; NICE CG233; ESMO 2018 (perioperative anaemia)"
        )),

        // ══════════════════════════════════════════════════════════════
        // WOUND / SURGICAL SITE INFECTION
        // ══════════════════════════════════════════════════════════════

        Entry(keywords: ["wound infection", "surgical site infection", "ssi", "wound dehiscence", "wound discharge", "mesh infection"], radiation: .init(
            conditionName: "Surgical Site Infection / Wound Complication",
            icd10Primary: "T81.40XA",
            investigations: [
                .init(name: "Wound swab (MC&S)", category: .other, rationale: "Identify organism + sensitivities — guide targeted antibiotics"),
                .init(name: "FBC / CRP / Blood cultures (if systemic)", category: .blood, rationale: "Systemic infection; bacteraemia if unwell"),
                .init(name: "Blood glucose / HbA1c", category: .blood, rationale: "Diabetes — major risk factor for SSI and impaired healing"),
                .init(name: "Albumin / Prealbumin", category: .blood, rationale: "Nutritional status — hypoalbuminaemia impairs wound healing"),
                .init(name: "X-ray / Ultrasound of wound", category: .imaging, rationale: "Gas in tissues (necrotising fasciitis); deep collection; mesh position"),
                .init(name: "CT scan (deep SSI / mesh infection)", category: .imaging, rationale: "Collection depth, extent; mesh integrity; fistula"),
                .init(name: "MRI (necrotising fasciitis suspected)", category: .imaging, rationale: "Best modality for soft tissue planes — NF requires emergency OT"),
            ],
            planTemplate: """
- SUPERFICIAL SSI (skin / subcutaneous):
  • Open wound (remove sutures / staples over infected area)
  • Irrigate with saline; pack with Aquacel or similar dressing
  • Oral antibiotics (culture-guided): flucloxacillin 500 mg QDS × 5–7 days (Staph)
    If MRSA risk or penicillin allergy: doxycycline 200 mg OD or clindamycin 300 mg QDS
  • Mark wound margin; photograph; reassess at 48h
- DEEP SSI (below fascia / organ/space):
  • CT abdomen/pelvis to identify collection
  • Radiological drainage (USS/CT-guided) where accessible
  • Surgical drainage + washout if not amenable to radiological drainage
  • IV antibiotics: tazobactam/piperacillin 4.5 g 8-hourly (broad spectrum)
- WOUND DEHISCENCE (burst abdomen):
  • Wet pack wound immediately; do NOT attempt primary closure in ward
  • Emergency OT: mass closure (looped nylon or PDS) with retention sutures
  • NBM + IV fluids
- MESH INFECTION:
  • CT first — assess extent; fistula
  • May require mesh removal (especially if chronic / biofilm)
  • Prolonged antibiotic course: culture-guided × 6+ weeks
- NECROTISING FASCIITIS (SURGICAL EMERGENCY):
  • Extreme pain out of proportion, crepitus, rapidly advancing → EMERGENCY OT
  • IV meropenem + vancomycin + clindamycin (toxin inhibition)
  • Radical surgical debridement — return to OT at 24h; daily until clean
  • ICU + plastic surgery involvement
""",
            billingCodes: [
                .init(icd10: "T81.40XA", icdDescription: "Infection following a procedure, initial encounter", cpt: "10180", cptDescription: "Incision and drainage of complex postoperative wound infection"),
                .init(icd10: "T81.31XA", icdDescription: "Disruption of wound, initial encounter", cpt: "13160", cptDescription: "Secondary closure of surgical wound"),
            ],
            consentCategory: "Wound Exploration / Debridement / Secondary Closure",
            urgencyNote: "Crepitus / pain out of proportion / rapidly spreading → necrotising fasciitis → EMERGENCY OT.",
            redFlags: ["Gas in tissues on imaging → NF → emergency OT within 1h", "Systemic sepsis from wound → IV antibiotics + drainage urgent"],
            followUp: "Wound review at 48h and 1 week. Dressing team. Vacuum-assisted closure (VAC) for large defects. Plastic surgery for complex reconstruction.",
            guidelineReference: "NICE NG141; IDSA 2014; WHO SSI Prevention 2018"
        )),
    ]
}
