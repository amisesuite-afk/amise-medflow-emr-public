import Foundation

// MARK: - Diagnosis → Score mapping engine
//
// Maps workingDiagnosis text, workingDiagnosisICD prefix, and chiefComplaint
// to a priority-ordered list of clinically relevant ActiveScore cases.
//
// This drives Layers 1–2 of the 7-layer score architecture:
//  Layer 1 — chief complaint → suggested ScoreCategory auto-filter
//  Layer 2 — working diagnosis + ICD → ranked recommended scores
//
// Pure Swift, no network, no AI — safe for all environments.

struct DiagnosisScoreRecommendation: Identifiable {
    let id: ActiveScore
    let score: ActiveScore
    let rationale: String
    let priority: Int
}

enum DiagnosisScoreMapper {

    // MARK: - Primary API

    /// Returns priority-ordered recommendations for the patient.
    /// Integrates working diagnosis text, ICD-10 prefix, and chief complaint.
    static func recommendations(for patient: Patient) -> [DiagnosisScoreRecommendation] {
        var results: [DiagnosisScoreRecommendation] = []

        if let dx = patient.workingDiagnosis?.lowercased() {
            results += dxRecommendations(dx)
        }
        if let icd = patient.workingDiagnosisICD {
            for icdRec in icdRecommendations(icd) {
                if let idx = results.firstIndex(where: { $0.score == icdRec.score }) {
                    // Boost priority when both dx and ICD agree
                    let existing = results[idx]
                    results[idx] = DiagnosisScoreRecommendation(
                        score: existing.score,
                        rationale: existing.rationale,
                        priority: min(existing.priority, icdRec.priority)
                    )
                } else {
                    results.append(icdRec)
                }
            }
        }
        if let cc = patient.chiefComplaint?.lowercased() {
            for ccRec in ccAugmentations(cc) {
                if !results.contains(where: { $0.score == ccRec.score }) {
                    results.append(ccRec)
                }
            }
        }

        var seen = Set<ActiveScore>()
        return results
            .filter { seen.insert($0.score).inserted }
            .sorted { $0.priority < $1.priority }
    }

    /// Returns the most relevant ScoreCategory for the chief complaint.
    static func suggestedCategory(for chiefComplaint: String?) -> ScoreCategory? {
        guard let cc = chiefComplaint?.lowercased() else { return nil }
        if cc.contains("abdominal") || cc.contains("abdomen") || cc.contains("abdo") ||
           cc.contains("appendix") || cc.contains("appendicitis") ||
           cc.contains("gallstone") || cc.contains("cholecyst") ||
           cc.contains("pancreat") || cc.contains("hernia") ||
           cc.contains("bowel") || cc.contains("diverticu") || cc.contains("periton") {
            return .acute
        }
        if cc.contains("bleed") || cc.contains("haematemesis") || cc.contains("melena") ||
           cc.contains("rectal bleed") || cc.contains("pr bleed") ||
           cc.contains("gerd") || cc.contains("reflux") || cc.contains("liver") ||
           cc.contains("jaundice") || cc.contains("hepatit") || cc.contains("endoscop") {
            return .gi
        }
        if cc.contains("chest pain") || cc.contains("palpitation") ||
           cc.contains("atrial") || cc.contains(" af") || cc.contains("cardiac") {
            return .cardiac
        }
        if cc.contains("dvt") || cc.contains("thrombos") || cc.contains("pulmonary embolism") ||
           cc.contains("swollen leg") || cc.contains("calf pain") {
            return .vascular
        }
        if cc.contains("fever") || cc.contains("sepsis") || cc.contains("infected") ||
           cc.contains("pneumonia") || cc.contains("breath") || cc.contains("dyspnoea") {
            return .sepsis
        }
        if cc.contains("tia") || cc.contains("stroke") || cc.contains("weakness") ||
           cc.contains("facial drop") || cc.contains("slurred speech") {
            return .neuro
        }
        return nil
    }

    // MARK: - Diagnosis keyword mapping

    // swiftlint:disable:next function_body_length cyclomatic_complexity
    private static func dxRecommendations(_ dx: String) -> [DiagnosisScoreRecommendation] {
        var r: [DiagnosisScoreRecommendation] = []

        func add(_ score: ActiveScore, _ rationale: String, _ priority: Int) {
            r.append(DiagnosisScoreRecommendation(score: score, rationale: rationale, priority: priority))
        }

        // Appendicitis
        if dx.contains("appendicitis") || dx.contains("appendix") {
            add(.alvarado,  "Primary scoring tool for suspected appendicitis", 1)
            add(.airScore,  "AIR score — guides admission vs discharge decision", 2)
            add(.ripasa,    "RIPASA — validated across diverse populations", 3)
            if dx.contains("paediatric") || dx.contains("pediatric") || dx.contains("child") {
                add(.pas, "Paediatric Appendicitis Score (<18 years)", 2)
            }
            add(.news2,  "Baseline physiological status", 7)
            add(.rcri,   "Cardiac risk if appendicectomy planned", 8)
            add(.asa,    "Anaesthetic risk classification", 9)
        }

        // Cholecystitis / Biliary colic
        if dx.contains("cholecystitis") || dx.contains("gallstone") || dx.contains("biliary colic") {
            add(.tokyoChole, "Tokyo Guidelines grading — guides surgery timing", 1)
            add(.news2,      "Track physiological deterioration", 5)
            add(.rcri,       "Cardiac risk if cholecystectomy planned", 6)
            add(.asa,        "Anaesthetic classification", 7)
        }

        // Cholangitis / ERCP
        if dx.contains("cholangitis") || dx.contains("ercp") || dx.contains("choledocho") {
            add(.tokyoCholang, "Tokyo Guidelines — guides ERCP urgency and ICU need", 1)
            add(.qsofa,        "Sepsis screening (cholangitis is septic until proven otherwise)", 2)
            add(.sofa,         "Organ failure assessment", 3)
            add(.news2,        "Continuous physiological monitoring", 6)
        }

        // Pancreatitis
        if dx.contains("pancreatitis") || dx.contains("pancreas") {
            add(.ranson,       "Ranson criteria — 48-hour severity", 1)
            add(.bisap,        "BISAP — 24-hour bedside severity (most accessible)", 2)
            add(.glasgow,      "Glasgow score — modified Imrie 48-hour criteria", 3)
            add(.haps,         "HAPS — identifies harmless AP, guides early discharge", 4)
            add(.glasgowImrie, "Full Glasgow-Imrie with all 8 parameters", 5)
            add(.ctsi,         "CT Severity Index — when cross-sectional imaging available", 6)
            add(.nutric,       "NUTRIC nutritional risk — ICU patients", 9)
        }

        // Upper GI Bleed
        if dx.contains("upper gi bleed") || dx.contains("ugib") ||
           dx.contains("haematemesis") || dx.contains("peptic ulcer") ||
           dx.contains("variceal") || dx.contains("mallory") || dx.contains("gi bleed") {
            add(.blatchford, "Blatchford — pre-endoscopy risk, guides admission decision", 1)
            add(.rockall,    "Rockall — post-endoscopy re-bleed/mortality risk", 2)
            add(.aims65,     "AIMS65 — in-hospital mortality prediction", 3)
            add(.forrest,    "Forrest Classification — endoscopic stigmata of bleeding", 4)
        }

        // Lower GI Bleed
        if dx.contains("lower gi bleed") || dx.contains("lgib") ||
           dx.contains("pr bleed") || dx.contains("haematochezia") || dx.contains("rectal bleeding") {
            add(.oakland, "Oakland score — safe early discharge threshold for LGIB", 1)
            add(.rockall,  "Rockall — also applied to LGIB", 2)
        }

        // Diverticulitis
        if dx.contains("diverticulitis") || dx.contains("diverticular") {
            add(.hinchey, "Hinchey classification — guides surgery vs conservative management", 1)
            add(.qsofa,   "Sepsis screening", 3)
            add(.mpi,     "Mannheim Peritonitis Index — if peritonitis present", 4)
            add(.news2,   "Physiological monitoring", 5)
        }

        // Peritonitis
        if dx.contains("peritonitis") {
            add(.mpi,   "Mannheim Peritonitis Index — primary severity tool", 1)
            add(.qsofa, "qSOFA sepsis criteria", 2)
            add(.sofa,  "Organ failure staging", 3)
            add(.sirs,  "SIRS criteria", 4)
        }

        // Hernia
        if dx.contains("hernia") {
            add(.asa,      "ASA classification — universal pre-operative assessment", 1)
            add(.rcri,     "RCRI — revised cardiac risk index", 2)
            add(.dasi,     "DASI — functional capacity (METs equivalent)", 3)
            add(.stopBang, "STOP-BANG — OSA screening before general anaesthesia", 4)
            add(.ariscat,  "ARISCAT — pulmonary complication risk", 5)
            add(.caprini,  "Caprini — perioperative VTE risk stratification", 6)
        }

        // Bowel obstruction
        if dx.contains("obstruction") || dx.contains("volvulus") || dx.contains("ileus") {
            add(.asa,   "Anaesthetic risk if surgery required", 3)
            add(.rcri,  "Cardiac risk", 4)
            add(.qsofa, "Sepsis screening — if strangulation/ischaemia suspected", 5)
            add(.mpi,   "Peritonitis index — if perforation present", 6)
        }

        // Pulmonary Embolism
        if dx.contains("pulmonary embolism") || dx.contains("pe)") ||
           (dx.contains(" pe") && !dx.contains("pelv") && !dx.contains("peri")) {
            add(.wellsPE,       "Wells PE — pre-test probability scoring", 1)
            add(.perc,          "PERC rule — excludes PE in low-risk patients", 2)
            add(.spesi,         "sPESI — 30-day mortality, guides treatment level", 3)
            add(.revisedGeneva, "Revised Geneva — clinical probability (no subjective criteria)", 4)
        }

        // DVT
        if dx.contains("deep vein thrombosis") || dx.contains("dvt") {
            add(.wellsDVT, "Wells DVT score — pre-test probability", 1)
            add(.caprini,  "Caprini — VTE risk stratification", 2)
            add(.padua,    "Padua — medical patient VTE prophylaxis threshold", 3)
            add(.fourT,    "4T score — HIT probability if on heparin", 5)
        }

        // Liver / Cirrhosis
        if dx.contains("cirrhosis") || dx.contains("liver failure") ||
           dx.contains("hepatic") || dx.contains("portal hypertension") {
            add(.childPugh,    "Child-Pugh — liver reserve, predicts operative mortality", 1)
            add(.meld,         "MELD-Na — 90-day mortality and transplant allocation", 2)
            add(.meld3,        "MELD 3.0 — updated severity including female sex adjustment", 3)
            add(.albi,         "ALBI — albumin-bilirubin score for HCC", 4)
            add(.kingsCriteria, "King's College Criteria — ALF transplant listing threshold", 5)
        }

        // Sepsis
        if dx.contains("sepsis") || dx.contains("septic") {
            add(.qsofa,    "qSOFA — bedside 2/3 trigger for sepsis workup", 1)
            add(.sirs,     "SIRS criteria", 2)
            add(.sofa,     "SOFA — sequential organ failure score", 3)
            add(.news2,    "NEWS2 — aggregate physiological track", 4)
            add(.apacheII, "APACHE II — ICU admission severity", 6)
        }

        // Necrotising fasciitis / NF
        if dx.contains("necrotis") || dx.contains("fasciitis") || dx.contains("necrotizing") {
            add(.lrinec, "LRINEC — differentiates NF from soft tissue infection (≥6 is high risk)", 1)
            add(.fgsi,   "FGSI — if Fournier's gangrene is the presentation", 2)
            add(.qsofa,  "qSOFA — NF is a surgical sepsis emergency", 3)
            add(.sofa,   "SOFA — organ failure staging", 4)
        }

        // Fournier's gangrene
        if dx.contains("fournier") {
            add(.fgsi,   "FGSI — validated severity score for Fournier's gangrene", 1)
            add(.lrinec, "LRINEC — supports necrotising fasciitis diagnosis", 2)
            add(.qsofa,  "qSOFA — Fournier's mandates sepsis workup", 3)
        }

        // Colorectal cancer / liver mets
        if dx.contains("colorectal") || dx.contains("colon cancer") || dx.contains("rectal cancer") {
            add(.fongCrs,  "Fong CRS — colorectal liver metastases prognosis", 1)
            add(.cci,      "CCI — Charlson Comorbidity Index for survival", 2)
            add(.asa,      "Anaesthetic classification", 3)
            add(.rcri,     "Cardiac risk", 4)
            add(.caprini,  "Caprini VTE — malignancy is major risk factor", 5)
            add(.nrs2002,  "NRS-2002 — nutritional risk pre-operatively", 6)
        }

        // Stroke / TIA
        if dx.contains("tia") || dx.contains("transient ischaemic") || dx.contains("stroke") {
            add(.abcd2, "ABCD² — 48-hour stroke risk after TIA", 1)
            add(.nihss, "NIHSS — acute stroke severity", 2)
            add(.mrs,   "mRS — functional outcome and disability grading", 3)
        }

        // ACS / Cardiac
        if dx.contains("acute coronary") || dx.contains("acs") ||
           dx.contains("nstemi") || dx.contains("stemi") || dx.contains("unstable angina") {
            add(.heart, "HEART score — MACE risk stratification for chest pain", 1)
            add(.timi,  "TIMI — UA/NSTEMI 14-day risk", 2)
            add(.grace, "GRACE — ACS in-hospital and 6-month mortality", 3)
        }

        // AF
        if dx.contains("atrial fibrillation") || dx.contains("atrial flutter") {
            add(.cha2ds2vasc, "CHA₂DS₂-VASc — AF stroke risk, guides anticoagulation", 1)
            add(.hasBled,     "HAS-BLED — bleeding risk score on anticoagulation", 2)
        }

        // Burns
        if dx.contains("burn") {
            add(.parkland, "Parkland formula — 24-hour fluid resuscitation", 1)
            add(.baux,     "Baux score — burn mortality prediction", 2)
        }

        // UC / Crohn's
        if dx.contains("ulcerative colitis") {
            add(.trueloveWitts, "Truelove-Witts — UC flare severity classification", 1)
        }
        if dx.contains("crohn") {
            add(.harveyBradshaw, "Harvey-Bradshaw Index — Crohn's disease activity", 1)
        }

        // Pneumonia
        if dx.contains("pneumonia") {
            add(.curb65,  "CURB-65 — CAP severity, guides admission decision", 1)
            add(.psiPort, "PSI/PORT — pneumonia severity index", 2)
        }

        // Kidney stone / urology
        if dx.contains("kidney stone") || dx.contains("nephrolithiasis") ||
           dx.contains("urolithiasis") || dx.contains("ureteric") || dx.contains("renal calculus") {
            add(.stone,  "STONE score — CT-confirmed stone probability", 1)
            add(.ckdEpi, "CKD-EPI — baseline eGFR", 3)
        }

        // AKI
        if dx.contains("acute kidney injury") || (dx.contains("aki") && dx.count < 30) {
            add(.kdigo,  "KDIGO AKI staging — severity classification", 1)
            add(.ckdEpi, "CKD-EPI — baseline eGFR for staging", 2)
        }

        // ARDS
        if dx.contains("ards") || dx.contains("acute respiratory distress") {
            add(.berlinARDS, "Berlin Definition — ARDS severity (mild/moderate/severe)", 1)
            add(.sofa,       "SOFA — accompanying organ failure", 2)
        }

        // Alcoholic hepatitis
        if dx.contains("alcoholic hepatitis") || dx.contains("alcohol hepatitis") {
            add(.maddrey, "Maddrey Discriminant Function — steroid therapy threshold (≥32)", 1)
            add(.meld,    "MELD-Na — mortality and transplant priority", 2)
        }

        // GERD / Oesophagitis
        if dx.contains("gerd") || dx.contains("gastro-oesophageal") ||
           dx.contains("gastroesophageal") || dx.contains("oesophagitis") {
            add(.losAngeles, "LA Classification — endoscopic GERD severity grading", 1)
        }

        // Prostate / LUTS
        if dx.contains("prostate") || dx.contains("bph") || dx.contains("luts") {
            add(.ipss, "IPSS — Lower Urinary Tract Symptom severity", 1)
        }

        // Infective endocarditis
        if dx.contains("endocarditis") {
            add(.dukeIE, "Duke Criteria — IE diagnosis classification", 1)
            add(.qsofa,  "qSOFA — sepsis screening", 2)
        }

        // General pre-op
        if dx.contains("elective") || dx.contains("pre-op") || dx.contains("preop") {
            add(.asa,      "ASA classification — universal pre-operative assessment", 1)
            add(.rcri,     "RCRI — revised cardiac risk index", 2)
            add(.dasi,     "DASI — functional capacity", 3)
            add(.stopBang, "STOP-BANG — OSA screening before GA", 4)
            add(.ariscat,  "ARISCAT — pulmonary complication risk", 5)
            add(.caprini,  "Caprini — perioperative VTE risk", 6)
            add(.nrs2002,  "NRS-2002 — nutritional risk screening", 7)
        }

        return r
    }

    // MARK: - ICD-10 prefix mapping

    private static func icdRecommendations(_ icd: String) -> [DiagnosisScoreRecommendation] {
        let code = icd.uppercased().trimmingCharacters(in: .whitespaces)
        var r: [DiagnosisScoreRecommendation] = []

        func add(_ score: ActiveScore, _ rationale: String, _ priority: Int) {
            r.append(DiagnosisScoreRecommendation(score: score, rationale: rationale, priority: priority))
        }

        // K35–K37: Appendicitis
        if code.hasPrefix("K35") || code.hasPrefix("K36") || code.hasPrefix("K37") {
            add(.alvarado, "Alvarado — appendicitis severity (ICD \(code))", 1)
            add(.airScore, "AIR Score — admission vs discharge guidance", 2)
            add(.ripasa,   "RIPASA — appendicitis probability score", 3)
        }
        // K80–K83: Biliary
        if code.hasPrefix("K80") || code.hasPrefix("K81") || code.hasPrefix("K82") || code.hasPrefix("K83") {
            add(.tokyoChole,   "Tokyo cholecystitis grading (ICD \(code))", 1)
            add(.tokyoCholang, "Tokyo cholangitis grading", 2)
        }
        // K85–K86: Pancreatitis
        if code.hasPrefix("K85") || code.hasPrefix("K86") {
            add(.bisap,   "BISAP severity (ICD \(code))", 1)
            add(.ranson,  "Ranson criteria", 2)
            add(.glasgow, "Glasgow score", 3)
        }
        // K57: Diverticular disease
        if code.hasPrefix("K57") {
            add(.hinchey, "Hinchey classification (ICD \(code))", 1)
        }
        // K92: GI Haemorrhage
        if code.hasPrefix("K92") {
            add(.blatchford, "Blatchford — pre-endoscopy risk (ICD \(code))", 1)
            add(.rockall,    "Rockall — post-endoscopy risk", 2)
        }
        // I26: PE
        if code.hasPrefix("I26") {
            add(.wellsPE, "Wells PE probability (ICD \(code))", 1)
            add(.spesi,   "sPESI 30-day mortality", 2)
        }
        // I80/I82: DVT
        if code.hasPrefix("I82") || code.hasPrefix("I80") {
            add(.wellsDVT, "Wells DVT probability (ICD \(code))", 1)
        }
        // I48: AF
        if code.hasPrefix("I48") {
            add(.cha2ds2vasc, "CHA₂DS₂-VASc stroke risk (ICD \(code))", 1)
            add(.hasBled,     "HAS-BLED bleeding risk", 2)
        }
        // K70/K74/K72: Liver disease
        if code.hasPrefix("K70") || code.hasPrefix("K74") || code.hasPrefix("K72") {
            add(.childPugh, "Child-Pugh liver reserve (ICD \(code))", 1)
            add(.meld,      "MELD-Na severity", 2)
        }
        // A41/A40: Sepsis
        if code.hasPrefix("A41") || code.hasPrefix("A40") {
            add(.qsofa, "qSOFA sepsis screen (ICD \(code))", 1)
            add(.sofa,  "SOFA organ failure", 2)
        }
        // N20: Kidney stone
        if code.hasPrefix("N20") || code.hasPrefix("N21") {
            add(.stone,  "STONE score (ICD \(code))", 1)
            add(.ckdEpi, "CKD-EPI baseline eGFR", 3)
        }
        // N17: AKI
        if code.hasPrefix("N17") {
            add(.kdigo,  "KDIGO AKI staging (ICD \(code))", 1)
            add(.ckdEpi, "CKD-EPI eGFR", 2)
        }

        return r
    }

    // MARK: - Chief complaint augmentation

    private static func ccAugmentations(_ cc: String) -> [DiagnosisScoreRecommendation] {
        var r: [DiagnosisScoreRecommendation] = []

        func add(_ score: ActiveScore, _ rationale: String, _ priority: Int) {
            r.append(DiagnosisScoreRecommendation(score: score, rationale: rationale, priority: priority))
        }

        // Baseline monitoring for any acute presentation
        if cc.contains("fever") || cc.contains("unwell") || cc.contains("pain") ||
           cc.contains("emergency") || cc.contains("admitted") {
            add(.news2, "NEWS2 — recommended for all acute admissions", 10)
            add(.mews,  "MEWS — modified early warning score", 11)
        }
        // VTE prophylaxis for surgical admissions
        if cc.contains("surg") || cc.contains("operat") || cc.contains("laparoscop") ||
           cc.contains("appendicectomy") || cc.contains("cholecystectomy") ||
           cc.contains("hernia repair") {
            add(.caprini, "Caprini VTE risk — perioperative prophylaxis decision", 9)
        }
        // Weight loss / anaemia — nutritional / oncology risk
        if cc.contains("weight loss") || cc.contains("anaemia") || cc.contains("anemia") {
            add(.must, "MUST — malnutrition universal screening tool", 10)
            add(.cci,  "CCI — comorbidity index for survival context", 12)
        }

        return r
    }
}
