// PatientScoreAutoPopulator+CriticalCare2.swift
// MPI (Mannheim Peritonitis Index), 4T Score (HIT), Oakland Score, NUTRIC,
// Baux Score, KDIGO AKI, sPESI, SAPS II, STONE Score, CAGE, GCS.

import Foundation

extension PatientScoreAutoPopulator {

    // MARK: - MPI (Mannheim Peritonitis Index)

    // MARK: - 4T Score (HIT)
    static func fourT(patient: Patient) -> (ClinicalScoringEngine.FourTInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.FourTInput()
        var f = ScoreAutoFill()
        let text = ScoreText([patient.chiefComplaint, patient.hpi, patient.pmhNotes,
                    patient.managementPlan, patient.assessmentText])

        // Thrombocytopenia: detect platelet-related keywords
        if text.contains("thrombocytopen") || text.contains("platelet") {
            // Can't quantify platelet fall without lab values — flag as pending
            f.addPending(key: "thrombocytopenia", label: "1. Degree of thrombocytopenia (platelet fall % and nadir)", source: "FBC result needed")
        } else {
            f.addPending(key: "thrombocytopenia", label: "1. Thrombocytopenia — check platelet count and fall from baseline", source: "Review FBC")
        }

        // Timing: detect recent heparin exposure
        if text.contains("heparin") || text.contains("lmwh") || text.contains("enoxaparin")
            || text.contains("tinzaparin") || text.contains("dalteparin") || text.contains("fondaparinux") {
            f.addAutoFilled(key: "timing", label: "Heparin exposure detected in clinical text", source: "HPI/medications")
        } else {
            f.addPending(key: "timing", label: "2. Timing of platelet fall relative to heparin start", source: "Verify heparin start date vs platelet trend")
        }

        // Thrombosis: detect new thromboembolic event keywords
        let thrombosisKeywords = ["deep vein thrombosis", "dvt", "pulmonary embolism",
                                   "thrombosis", "thromboembol", "skin necrosis", "limb ischaemia",
                                   "limb ischemia", "clot"]
        if thrombosisKeywords.contains(where: { text.contains($0) }) {
            i.thrombosis = 2
            f.addAutoFilled(key: "thrombosis", label: "Thrombotic event detected in clinical text (+2)", source: "HPI/assessment")
        }

        // Other cause: detect sepsis, DIC, or other causes of thrombocytopenia
        let otherCauseKeywords = ["sepsis", "septic", "dic ", "disseminated intravascular",
                                   "liver failure", "bone marrow", "chemotherapy", "itu", "icu"]
        if otherCauseKeywords.contains(where: { text.contains($0) }) {
            i.otherCause = 1   // Possible other cause
            f.addAutoFilled(key: "otherCause", label: "Possible other cause for thrombocytopaenia detected (1 pt)", source: "Clinical context")
        } else {
            f.addPending(key: "otherCause", label: "4. Other cause for thrombocytopenia — review clinical context", source: "Clinical assessment")
        }

        return (i, f)
    }

    // MARK: - Oakland Score (LGIB)
    // MARK: - NUTRIC Score (#64)
    static func nutric(patient: Patient) -> (ClinicalScoringEngine.NUTRICInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.NUTRICInput()
        var f = ScoreAutoFill()
        // Auto-fill age
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: Date()).year ?? 50
            i.age = max(0, min(100, age))
            f.addAutoFilled(key: "age", label: "Age \(i.age) years from date of birth", source: "DOB")
        } else {
            f.addPending(key: "age", label: "Patient age required", source: "Demographics")
        }
        // Auto-fill APACHE II from stored score
        if let ap = patient.apacheIIScore {
            i.apacheII = ap
            f.addAutoFilled(key: "apacheII", label: "APACHE II \(ap) from stored score", source: "APACHE II score")
        } else {
            f.addPending(key: "apacheII", label: "APACHE II score required — calculate from ICU admission parameters", source: "APACHE II score")
        }
        // Auto-fill SOFA from stored score
        if let sf = patient.sofaScore {
            i.sofa = sf
            f.addAutoFilled(key: "sofa", label: "SOFA \(sf) from stored score", source: "SOFA score")
        } else {
            f.addPending(key: "sofa", label: "SOFA score required — calculate from organ function parameters", source: "SOFA score")
        }
        f.addPending(key: "comorbidities", label: "Number of comorbidities — review PMH", source: "Past medical history")
        f.addPending(key: "daysHospitalToICU", label: "Days from hospital admission to ICU — review admission notes", source: "Admission history")
        return (i, f)
    }

    // MARK: - Baux Score (#60)
    // MARK: - KDIGO AKI Staging (#59)
    static func kdigo(patient: Patient) -> (ClinicalScoringEngine.KDIGOInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.KDIGOInput()
        var f = ScoreAutoFill()
        let text = ScoreText([patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan, patient.pmhNotes])

        // Check for RRT keywords
        let rrtKw = ["renal replacement therapy", "haemodialysis", "hemodialysis", "haemofiltration",
                     "hemofiltration", "crrt", "cvvh", "cvvhdf", "dialysis", "rrt", "prisma",
                     "continuous renal replacement"]
        if rrtKw.contains(where: { text.contains($0) }) {
            i.requiresRRT = true
            i.stage = 3
            f.addAutoFilled(key: "requiresRRT", label: "Renal replacement therapy keyword detected — Stage 3", source: "History/Management")
        } else {
            // Detect AKI context
            let akiKw = ["acute kidney injury", "aki", "acute renal failure", "arf",
                         "oliguria", "anuria", "rising creatinine", "renal impairment",
                         "nephrotoxic", "contrast nephropathy", "rhabdomyolysis",
                         "acute tubular necrosis", "atn", "prerenal"]
            if akiKw.contains(where: { text.contains($0) }) {
                f.addAutoFilled(key: "stage", label: "AKI keyword detected — confirm creatinine and urine output staging", source: "History/Diagnosis")
            }
            f.addPending(key: "creatinineRise", label: "Creatinine rise (×baseline) — review U&E trend", source: "Biochemistry")
            f.addPending(key: "urineOutput", label: "Urine output (mL/kg/h) — measure or review fluid balance chart", source: "Fluid balance")
        }
        return (i, f)
    }

    // MARK: - sPESI (#67)
    // MARK: - SAPS II
    static func sapsII(patient: Patient) -> (ClinicalScoringEngine.SAPSIIInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.SAPSIIInput()
        var f = ScoreAutoFill(); f.isAttempted = true
        // Age from DOB
        let ageYears = Calendar.current.dateComponents([.year], from: patient.dateOfBirth ?? Date(), to: .now).year ?? 0
        if ageYears > 0 {
            i.ageYears = ageYears
            f.addAutoFilled(key: "age", label: "Age \(ageYears) years (from date of birth)", source: "Demographics")
        }
        // Admission type: surgical if patient has operative plans
        let plans = patient.operativePlans
        if !plans.isEmpty {
            i.scheduledSurgical = true
            f.addAutoFilled(key: "admissionType", label: "Operative plan found — pre-set as scheduled surgical", source: "Operative Plans")
        }
        // All ICU variables need measurement
        f.addPending(key: "heartRateMax",    label: "Worst heart rate (bpm) — first 24 h ICU",          source: "Vitals")
        f.addPending(key: "sbpMin",          label: "Worst systolic BP (mmHg) — first 24 h ICU",         source: "Vitals")
        f.addPending(key: "tempMax",         label: "Worst temperature (°C) — first 24 h ICU",           source: "Vitals")
        f.addPending(key: "urineOutput",     label: "Urine output (mL/24 h) — first 24 h ICU",           source: "Fluid balance")
        f.addPending(key: "bun",             label: "BUN / urea (mmol/L) — check U&E",                   source: "Bloods")
        f.addPending(key: "wbc",             label: "WBC (× 10⁹/L) — check FBC",                        source: "FBC")
        f.addPending(key: "sodium",          label: "Sodium (mmol/L) — check U&E",                       source: "Bloods")
        f.addPending(key: "potassium",       label: "Potassium (mmol/L) — check U&E",                    source: "Bloods")
        f.addPending(key: "bicarbonate",     label: "Bicarbonate (mmol/L) — check VBG or U&E",           source: "Bloods")
        f.addPending(key: "bilirubin",       label: "Bilirubin (μmol/L) — check LFTs",                   source: "LFTs")
        f.addPending(key: "gcs",             label: "GCS (3–15) — clinical assessment",                  source: "Neuro exam")
        return (i, f)
    }

    // MARK: - STONE Score
    static func berlinARDS(patient: Patient) -> (ClinicalScoringEngine.BerlinARDSInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.BerlinARDSInput(
            pao2FiO2Ratio: 300.0, peepOrCPAP: 5,
            acuteOnsetWithin1Week: true,
            bilateralOpacitiesOnImaging: false,
            notExplainedByCardiacFailure: false
        )
        var f = ScoreAutoFill()
        let text = ScoreText([patient.chiefComplaint, patient.hpi, patient.assessmentText, patient.pmhNotes])

        // Stored PF ratio if previously computed
        if let pf = patient.berlinPFRatio {
            i.pao2FiO2Ratio = pf
            f.addAutoFilled(key: "pfRatio", label: String(format: "PaO₂/FiO₂ ratio %.0f from stored score", pf), source: "Stored Score")
        } else {
            f.addPending(key: "pfRatio", label: "PaO₂/FiO₂ ratio — ABG and FiO₂ required", source: "Labs/Ventilator")
        }

        // Acute onset
        if text.contains("acute") || text.contains("sudden onset") || text.contains("rapid onset") {
            i.acuteOnsetWithin1Week = true
            f.addAutoFilled(key: "acuteOnset", label: "Acute onset documented in history", source: "History")
        }

        // Bilateral opacities
        if text.contains("bilateral opacit") || text.contains("bilateral infiltrat") || text.contains("bilateral chest") {
            i.bilateralOpacitiesOnImaging = true
            f.addAutoFilled(key: "bilateralOpacities", label: "Bilateral opacities noted in clinical notes", source: "Notes")
        } else {
            f.addPending(key: "bilateralOpacities", label: "Bilateral opacities on CXR/CT? — radiology report", source: "Imaging")
        }

        // Not cardiac failure
        if text.contains("no heart failure") || text.contains("no cardiac failure") || text.contains("non-cardiogenic") {
            i.notExplainedByCardiacFailure = true
            f.addAutoFilled(key: "nonCardiac", label: "Non-cardiogenic aetiology documented", source: "Notes")
        } else {
            f.addPending(key: "nonCardiac", label: "Exclude cardiac failure / fluid overload as primary cause", source: "Clinical")
        }

        f.addPending(key: "peep", label: "PEEP/CPAP setting (cmH₂O) — ventilator/oxygen delivery device", source: "Ventilator")
        return (i, f)
    }

    // MARK: - #102 CAGE Questionnaire

    // MARK: - GCS
    static func gcs(patient: Patient) -> (GCSInput, ScoreAutoFill) {
        var i = GCSInput()
        var f = ScoreAutoFill()
        // GCS components are bedside assessments — not derivable from stored data.
        // The assessmentText and hpi are scanned for qualitative cues only.
        let text = ScoreText([patient.assessmentText, patient.hpi, patient.chiefComplaint])
        if text.contains("unconscious") || text.contains("unresponsive") || text.contains("comatose") {
            i.eyeOpening    = .none
            i.verbalResponse = .none
            i.motorResponse  = .none
            f.addAutoFilled(key: "gcs", label: "Possible unresponsive state detected in assessment text — verify at bedside", source: "Assessment text")
        } else if text.contains("confused") || text.contains("disorientated") || text.contains("disoriented") {
            i.verbalResponse = .confused
            f.addAutoFilled(key: "verbal", label: "Confusion noted in assessment — verbal may be 4", source: "Assessment text")
        }
        f.addPending(key: "eye",    label: "Eye opening (E1–E4) — bedside assessment", source: "Clinical")
        f.addPending(key: "verbal", label: "Verbal response (V1–V5) — bedside assessment", source: "Clinical")
        f.addPending(key: "motor",  label: "Motor response (M1–M6) — bedside assessment", source: "Clinical")
        return (i, f)
    }

}
