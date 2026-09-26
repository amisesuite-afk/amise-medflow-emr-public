// PatientScoreAutoPopulator+Perioperative2.swift
// FINDRISC, CKD-EPI eGFR, Caprini VTE Risk, ASA, modified Rankin, Clavien-Dindo, Aldrete auto-population.

import Foundation


extension PatientScoreAutoPopulator {

    // MARK: - #96 FINDRISC

    static func mirels(patient: Patient) -> (ClinicalScoringEngine.MirelsInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.MirelsInput(site: 2, pain: 1, lesionType: 1, lesionSizeRatio: 1)
        var f = ScoreAutoFill()
        let text = ScoreText([patient.chiefComplaint, patient.hpi, patient.assessmentText, patient.workingDiagnosis])

        // Site — from diagnosis / history keywords
        if text.contains("peritrochanteric") || text.contains("femoral neck") || text.contains("trochanter") {
            i.site = 3
            f.addAutoFilled(key: "site", label: "Peritrochanteric site detected", source: "History")
        } else if text.contains("femur") || text.contains("tibia") || text.contains("lower limb") || text.contains("leg") {
            i.site = 2
            f.addAutoFilled(key: "site", label: "Lower limb site detected", source: "History")
        } else if text.contains("humerus") || text.contains("upper limb") || text.contains("arm") {
            i.site = 1
            f.addAutoFilled(key: "site", label: "Upper limb site detected", source: "History")
        } else {
            f.addPending(key: "site", label: "Lesion site (upper limb / lower limb / peritrochanteric)", source: "Imaging")
        }

        // Pain — from keywords
        if text.contains("functional pain") || text.contains("unable to weight") || text.contains("cannot walk") {
            i.pain = 3
            f.addAutoFilled(key: "pain", label: "Functional pain detected", source: "History")
        } else if text.contains("moderate pain") || text.contains("severe pain") {
            i.pain = 2
            f.addAutoFilled(key: "pain", label: "Moderate pain detected", source: "History")
        } else {
            f.addPending(key: "pain", label: "Pain severity (mild / moderate / functional) — confirm", source: "History")
        }

        // Lesion type and size — always from imaging
        f.addPending(key: "lesionType", label: "Lesion radiological type (blastic/mixed/lytic) — imaging report", source: "Imaging")
        f.addPending(key: "lesionSize", label: "Lesion size as fraction of cortical diameter — imaging", source: "Imaging")
        return (i, f)
    }

    // MARK: - #98 CKD-EPI eGFR

    static func ppossum(patient: Patient) -> (PPOSSUMInput, ScoreAutoFill) {
        var i = PPOSSUMInput()
        var f = ScoreAutoFill()
        let cal = Calendar.current
        let age = patient.dateOfBirth.flatMap { cal.dateComponents([.year], from: $0, to: .now).year } ?? 50

        // Age → physiological point score
        i.agePhys = age >= 81 ? 8 : age >= 71 ? 4 : age >= 61 ? 2 : 1
        f.addAutoFilled(key: "age", label: "Age \(age) years → POSSUM age score \(i.agePhys)", source: "Demographics")

        // SBP from vitals → physiological point score
        let latestV = patient.latestVitals
        if let sbp = latestV?.bpSystolic {
            i.sbpPhys = sbp >= 171 || sbp <= 89 ? 8 : (sbp >= 131 || sbp <= 109) ? 2 : 1
            f.addAutoFilled(key: "sbp", label: "Systolic BP \(sbp) mmHg → score \(i.sbpPhys)", source: "Vitals")
        } else { f.addPending(key: "sbp", label: "Systolic BP (mmHg)", source: "Vitals") }

        if let hr = latestV?.heartRate {
            i.hrPhys = hr >= 121 ? 8 : hr >= 101 ? 4 : (hr <= 50 || hr >= 81) ? 2 : 1
            f.addAutoFilled(key: "hr", label: "Heart rate \(hr) bpm → score \(i.hrPhys)", source: "Vitals")
        } else { f.addPending(key: "hr", label: "Heart rate (bpm)", source: "Vitals") }

        // Emergency urgency
        if patient.setting == .emergency {
            i.urgency = 8
            f.addAutoFilled(key: "urgency", label: "Emergency setting → urgency = emergency not resuscitated (8 pts)", source: "Setting")
        }

        // Malignancy
        let text = ScoreText([patient.workingDiagnosis, patient.assessmentText, patient.hpi, patient.pmhNotes])
        if text.contains("carcinoma") || text.contains("malignancy") || text.contains("cancer") || text.contains("metastas") {
            i.malignancy = text.contains("metastas") ? 8 : text.contains("nodal") ? 4 : 2
            f.addAutoFilled(key: "malignancy", label: "Malignancy detected → score \(i.malignancy)", source: "Diagnosis/Notes")
        }

        f.addPending(key: "haemoglobin",    label: "Haemoglobin (g/dL) — FBC result",                 source: "Labs")
        f.addPending(key: "urea",           label: "Urea (mmol/L) — renal function",                   source: "Labs")
        f.addPending(key: "sodium",         label: "Sodium (mmol/L) — electrolytes",                   source: "Labs")
        f.addPending(key: "wbc",            label: "White cell count (×10⁹/L) — FBC result",           source: "Labs")
        f.addPending(key: "opMagnitude",    label: "Operative magnitude (minor/moderate/major/major+)", source: "Operative")
        f.addPending(key: "contamination",  label: "Peritoneal contamination — intraoperative finding", source: "Operative")
        f.addPending(key: "bloodLoss",      label: "Estimated blood loss (mL) — intraoperative",       source: "Operative")
        return (i, f)
    }

    // MARK: - #107 Caprini VTE Risk Score

    // MARK: - ASA Physical Status
    static func asa(patient: Patient) -> (ASAInput, ScoreAutoFill) {
        var i = ASAInput()
        var f = ScoreAutoFill()
        let text = ScoreText([patient.chiefComplaint, patient.assessmentText, patient.pmhNotes, patient.hpi])
        // Heuristic: scan for severe/critical/moribund indicators
        if text.contains("moribund") || text.contains("not expected to survive") || text.contains("asa v") {
            i.asaClass = .v
            f.addAutoFilled(key: "asa", label: "Possible ASA V — moribund indicators in text", source: "Assessment text")
        } else if text.contains("life-threatening") || text.contains("end-stage") || text.contains("asa iv") {
            i.asaClass = .iv
            f.addAutoFilled(key: "asa", label: "Possible ASA IV — life-threatening condition detected", source: "Assessment text")
        } else if text.contains("poorly controlled") || text.contains("moderate") || text.contains("asa iii") {
            i.asaClass = .iii
            f.addAutoFilled(key: "asa", label: "Possible ASA III — poorly controlled/significant systemic disease", source: "Assessment text")
        } else if text.contains("well controlled") || text.contains("mild") || text.contains("asa ii") || text.contains("hypertension") || text.contains("diabetes") {
            i.asaClass = .ii
            f.addAutoFilled(key: "asa", label: "Possible ASA II — mild systemic disease detected", source: "PMH text")
        } else {
            f.addPending(key: "asa", label: "ASA class — clinical assessment required", source: "Clinical")
        }
        return (i, f)
    }

    // MARK: - modified Rankin Scale
    // MARK: - modified Rankin Scale
    static func mRS(patient: Patient) -> (ClinicalScoringEngine.MRSInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.MRSInput()
        var f = ScoreAutoFill()
        let text = ScoreText([patient.assessmentText, patient.hpi, patient.chiefComplaint])
        // Scan for disability indicators
        if text.contains("no disability") || text.contains("fully independent") {
            i.level = 0
            f.addAutoFilled(key: "mRS", label: "No disability detected in assessment text", source: "Assessment text")
        } else if text.contains("hemiplegia") || text.contains("hemipleg") || text.contains("bedridden") {
            i.level = 4
            f.addAutoFilled(key: "mRS", label: "Severe disability indicators detected — verify mRS level", source: "Assessment text")
        } else if text.contains("wheelchair") || text.contains("immobile") {
            i.level = 5
            f.addAutoFilled(key: "mRS", label: "Possible mRS 5 — immobility indicators in text", source: "Assessment text")
        } else {
            f.addPending(key: "mRS", label: "Disability level (0–6) — bedside assessment required", source: "Clinical")
        }
        return (i, f)
    }

    // MARK: - Clavien-Dindo Complication Grade
    // MARK: - Clavien-Dindo Complication Grade
    static func clavienDindo(patient: Patient) -> (ClinicalScoringEngine.ClavienDindoInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.ClavienDindoInput()
        var f = ScoreAutoFill()
        let text = ScoreText([patient.assessmentText, patient.hpi, patient.chiefComplaint])
        // Scan for complication severity
        if text.contains("icu") || text.contains("intensive care") || text.contains("organ failure") {
            i.grade = 5   // IVa (single organ) or IVb — set conservatively
            f.addAutoFilled(key: "grade", label: "ICU/organ failure detected — possible Grade IVa/IVb", source: "Assessment text")
        } else if text.contains("re-operation") || text.contains("reoperation") || text.contains("surgical intervention") {
            i.grade = 4   // Grade IIIb
            f.addAutoFilled(key: "grade", label: "Possible Grade IIIb — re-operation indicators detected", source: "Assessment text")
        } else if text.contains("drug therapy") || text.contains("antibiotic") || text.contains("transfusion") {
            i.grade = 2   // Grade II
            f.addAutoFilled(key: "grade", label: "Possible Grade II — pharmacological treatment detected", source: "Assessment text")
        } else {
            f.addPending(key: "grade", label: "Complication grade (0–V) — classify postoperative complication", source: "Clinical")
        }
        return (i, f)
    }

    // MARK: - Modified Aldrete PACU Score
    // MARK: - Modified Aldrete PACU Score
    static func aldrete(patient: Patient) -> (ClinicalScoringEngine.AldreteInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.AldreteInput()
        var f = ScoreAutoFill()
        // Fill SpO2 from latest vitals
        let latestV = patient.latestVitals
        if let spo2 = latestV?.spo2 {
            if spo2 >= 92 {
                i.oxygenSat = 2
            } else if spo2 >= 90 {
                i.oxygenSat = 1
            } else {
                i.oxygenSat = 0
            }
            f.addAutoFilled(key: "spo2", label: "SpO₂ \(spo2)% from vitals", source: "Vitals")
        } else {
            f.addPending(key: "spo2", label: "SpO₂ — vitals required", source: "Vitals")
        }
        // All other parameters require bedside PACU assessment
        f.addPending(key: "activity",       label: "Voluntary limb movement — PACU assessment", source: "Clinical")
        f.addPending(key: "respiration",    label: "Respiration adequacy — PACU assessment", source: "Clinical")
        f.addPending(key: "circulation",    label: "BP vs pre-operative baseline — PACU assessment", source: "Clinical")
        f.addPending(key: "consciousness",  label: "Consciousness level — PACU assessment", source: "Clinical")
        return (i, f)
    }

    // MARK: - GCS

}
