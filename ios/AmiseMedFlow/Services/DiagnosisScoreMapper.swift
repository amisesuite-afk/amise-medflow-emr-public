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
    var id: ActiveScore { score }
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
           cc.contains("atrial") || cc.contains(" af") || cc.contains("cardiac") ||
           cc.contains("heart failure") || cc.contains("ccf") || cc.contains("chf") ||
           cc.contains("angina") || cc.contains("nstemi") || cc.contains("stemi") ||
           cc.contains("arrhythmia") || cc.contains("tachycardia") || cc.contains("bradycardia") {
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
        if mentionsTIA(cc) || cc.contains("stroke") || cc.contains("weakness") ||
           cc.contains("facial drop") || cc.contains("slurred speech") {
            return .neuro
        }
        return nil
    }

    /// "TIA" as a whole word, or "transient ischaemic/ischemic attack" (lowercased text).
    /// Substring matching read "dementia" and "initial" as TIA.
    static func mentionsTIA(_ lowercased: String) -> Bool {
        if lowercased.contains("transient ischaemic") || lowercased.contains("transient ischemic") { return true }
        let words = lowercased.split { !($0.isLetter || $0.isNumber) }
        return words.contains("tia") || words.contains("tias")
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

        // Stroke / TIA. "tia" is matched as a whole word ("dementia", "initial" contain it).
        // ABCD² is NOT recommended for TIA: NICE NG128 (2019, updated 2022) advises against using
        // ABCD² or any risk score to decide urgency — every suspected TIA gets aspirin 300 mg and
        // specialist assessment within 24 h of onset. The calculator stays in Clinical Scores
        // (with that note) for anyone who wants it for reference.
        if mentionsTIA(dx) || dx.contains("stroke") {
            add(.nihss, "NIHSS — acute stroke severity / residual deficit", 1)
            add(.mrs,   "mRS — functional outcome and disability grading", 2)
        }

        // ACS / Cardiac — risk + monitoring
        if dx.contains("acute coronary") || dx.contains("acs") ||
           dx.contains("nstemi") || dx.contains("stemi") || dx.contains("unstable angina") ||
           dx.contains("myocardial infarction") || dx.contains("angina") {
            add(.heart,       "HEART score — MACE risk stratification for chest pain", 1)
            add(.timi,        "TIMI — UA/NSTEMI 14-day risk", 2)
            add(.grace,       "GRACE — ACS in-hospital and 6-month mortality", 3)
            add(.news2,       "NEWS2 — continuous haemodynamic monitoring", 4)
            add(.shockIndex,  "Shock Index — early cardiogenic shock flag", 5)
            add(.mews,        "MEWS — early deterioration detection", 6)
        }

        // Heart failure / cardiac failure
        if dx.contains("heart failure") || dx.contains("cardiac failure") ||
           dx.contains("lvf") || dx.contains("ccf") || dx.contains("chf") ||
           dx.contains("left ventricular failure") || dx.contains("cardiomyopathy") {
            add(.news2,      "NEWS2 — haemodynamic trend monitoring", 1)
            add(.mews,       "MEWS — early warning for decompensation", 2)
            add(.cci,        "Charlson Comorbidity Index — mortality risk adjustment", 3)
            add(.ckdEpi,     "CKD-EPI — baseline eGFR (cardiorenal risk)", 4)
            add(.shockIndex, "Shock Index — cardiogenic shock screening", 5)
            add(.euroScoreII,"EuroSCORE II — cardiac surgical mortality if intervention planned", 6)
        }

        // AF — stroke + bleeding + monitoring
        if dx.contains("atrial fibrillation") || dx.contains("atrial flutter") ||
           dx.contains("arrhythmia") {
            add(.cha2ds2vasc, "CHA₂DS₂-VASc — AF stroke risk, guides anticoagulation", 1)
            add(.hasBled,     "HAS-BLED — bleeding risk score on anticoagulation", 2)
            add(.dasi,        "DASI — functional capacity for cardioversion/ablation planning", 3)
            add(.news2,       "NEWS2 — haemodynamic monitoring during rate control", 4)
        }

        // Cardiac surgery / pre-cardiac-op
        if dx.contains("cardiac surgery") || dx.contains("cabg") ||
           dx.contains("valve replacement") || dx.contains("valvuloplasty") ||
           dx.contains("aortic valve") || dx.contains("mitral valve") ||
           dx.contains("coronary artery bypass") {
            add(.euroScoreII, "EuroSCORE II — operative mortality for cardiac surgery", 1)
            add(.rcri,        "RCRI — revised cardiac risk index (pre-op)", 2)
            add(.dasi,        "DASI — functional capacity assessment", 3)
            add(.asa,         "ASA Physical Status — anaesthetic risk classification", 4)
            add(.news2,       "NEWS2 — pre-op baseline physiological status", 5)
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
            add(.stoneUreteric, "STONE score — probability of an uncomplicated ureteric stone before imaging", 1)
            add(.stone,  "Stone CT features (local 0–6 score, not STONE) — after CT KUB", 3)
            add(.ckdEpi, "CKD-EPI — baseline eGFR", 3)
        }

        // Injury decision rules (clinical-content/rules/decision-rules.json)
        if dx.contains("ankle") && (dx.contains("sprain") || dx.contains("fracture") || dx.contains("injur")) {
            add(.ottawaAnkle, "Ottawa ankle and foot rules — is an X-ray needed?", 1)
        }
        if dx.contains("knee") && (dx.contains("sprain") || dx.contains("fracture") || dx.contains("injur")) {
            add(.ottawaKnee, "Ottawa knee rule — is an X-ray needed?", 1)
        }
        if dx.contains("head injur") || dx.contains("concussion") {
            add(.canadianCTHead, "Canadian CT head rule — minor head injury, GCS 13–15", 1)
        }
        if dx.contains("neck injur") || dx.contains("whiplash") || dx.contains("cervical spine injur") {
            add(.canadianCSpine, "Canadian C-spine rule — imaging decision in alert, stable adults", 1)
            add(.nexus, "NEXUS low-risk criteria — cervical spine imaging", 2)
        }

        // Syncope (prognostic rules: they do not change the differential)
        if dx.contains("syncope") || dx.contains("faint") {
            add(.canadianSyncope, "Canadian syncope risk score — 30-day serious adverse events", 1)
            add(.sfSyncope, "San Francisco syncope rule (CHESS) — 7-day serious outcome", 2)
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

}
