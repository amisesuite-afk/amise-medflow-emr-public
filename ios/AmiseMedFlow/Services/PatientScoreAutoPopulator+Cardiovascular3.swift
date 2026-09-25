// PatientScoreAutoPopulator+Cardiovascular3.swift
// Hinchey Classification, Parkland Formula, Paediatric Appendicitis Score,
// Revised Geneva Score, Charlson Comorbidity Index, Child-Pugh Score.

import Foundation


extension PatientScoreAutoPopulator {

    // MARK: - Hinchey (#69)
    // MARK: - Parkland Formula (#73)
    static func parkland(patient: Patient) -> (ClinicalScoringEngine.ParklandInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.ParklandInput()
        var f = ScoreAutoFill()
        let fields = [patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                      patient.assessmentText, patient.managementPlan, patient.pmhNotes]
        let text = ScoreText(fields)
        // The TBSA regex reads the raw text (a percentage is a measurement, not a finding).
        let rawText = fields.compactMap { $0 }.joined(separator: " ").lowercased()

        // Weight from latest vitals
        if let v = patient.latestVitals,
           let wt = v.weightKg {
            i.weightKg = wt
            f.addAutoFilled(key: "weightKg", label: "Weight \(Int(wt)) kg from latest vitals", source: "Vitals")
        } else {
            f.addPending(key: "weightKg", label: "Body weight (kg) — required for Parkland calculation", source: "Vitals/Demographics")
        }

        // TBSA from free-text keywords
        let tbsaPattern = try? NSRegularExpression(pattern: #"(\d{1,3})\s*%\s*(?:tbsa|total body surface|burn)"#)
        if let m = tbsaPattern?.firstMatch(in: rawText, range: NSRange(rawText.startIndex..., in: rawText)),
           let r = Range(m.range(at: 1), in: rawText), let pct = Double(rawText[r]) {
            i.tbsaPercent = min(pct, 100)
            f.addAutoFilled(key: "tbsaPercent", label: "\(Int(pct))% TBSA extracted from clinical text", source: "History/Examination")
        } else {
            f.addPending(key: "tbsaPercent", label: "Total body surface area burned (%) — assess from clinical examination", source: "Examination")
        }

        // Child: formal fluids from 10% TBSA, urine output 1 mL/kg/h (burn fluid threshold).
        if patient.dateOfBirth != nil, patient.ageYears < 16 {
            i.isChild = true
            f.addAutoFilled(key: "isChild", label: "Under 16 — paediatric burn thresholds", source: "Date of birth")
        }
        // Electrical injury: IV fluids whatever the visible TBSA (ABA; BBA).
        if ["electrical injury", "high voltage", "high-voltage", "electrocution", "electric shock", "lightning"].contains(where: { text.contains($0) }) {
            i.isElectrical = true
            f.addAutoFilled(key: "isElectrical", label: "Electrical injury in the record", source: "History")
        }
        // The first half is due within 8 h of the BURN: the time of the burn is needed.
        f.addPending(key: "hoursSinceBurn", label: "Time of the burn — hours since injury (sets the rate for the first 8 h)", source: "History")
        f.addPending(key: "fluidGivenMl", label: "IV fluid already given since the burn (mL)", source: "Pre-hospital / referring notes")

        // Inhalation injury keywords
        let inhalKw = ["inhalation injury", "inhalation burn", "smoke inhalation",
                       "airway burn", "singed nasal hair", "carbonaceous sputum"]
        if inhalKw.contains(where: { text.contains($0) }) {
            i.hasInhalationInjury = true
            f.addAutoFilled(key: "hasInhalationInjury", label: "Inhalation injury keyword detected", source: "History")
        }

        return (i, f)
    }

    // MARK: - Paediatric Appendicitis Score (#74)
    // MARK: - Revised Geneva Score (#75)
    static func revisedGeneva(patient: Patient) -> (ClinicalScoringEngine.RevisedGenevaInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.RevisedGenevaInput()
        var f = ScoreAutoFill()
        let text = ScoreText([patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan, patient.pmhNotes])

        // Age from DOB
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: .now).year ?? 0
            i.age = age
            if age > 65 {
                f.addAutoFilled(key: "age", label: "Age \(age) years from date of birth", source: "Demographics")
            }
        } else {
            f.addPending(key: "age", label: "Age — required for Revised Geneva (+1 pt if ≥ 65)", source: "Demographics")
        }

        // Prior DVT/PE
        let priorPEKw = ["prior pe", "previous pe", "prior dvt", "previous dvt", "prior pulmonary embolism",
                         "previous pulmonary embolism", "history of dvt", "history of pe"]
        if priorPEKw.contains(where: { text.contains($0) }) {
            i.priorDVTorPE = true
            f.addAutoFilled(key: "priorDVTorPE", label: "Prior DVT/PE keyword detected", source: "PMH")
        } else { f.addPending(key: "priorDVTorPE", label: "Prior DVT or PE — confirm from PMH", source: "PMH") }

        // Surgery / fracture within 1 month
        let sxKw = ["recent surgery", "post-operative", "recent fracture", "lower limb fracture",
                    "operated last month", "surgery last month", "hip fracture", "knee replacement"]
        if sxKw.contains(where: { text.contains($0) }) {
            i.surgeryOrFractureInMonth = true
            f.addAutoFilled(key: "surgeryOrFractureInMonth", label: "Recent surgery/fracture keyword detected", source: "History")
        } else { f.addPending(key: "surgeryOrFractureInMonth", label: "Surgery or lower-limb fracture within 1 month — confirm from history", source: "History") }

        // Active malignancy
        let malKw = ["malignancy", "cancer", "carcinoma", "oncology", "chemotherapy", "radiotherapy",
                     "active tumour", "active tumor", "metastatic"]
        if malKw.contains(where: { text.contains($0) }) {
            i.activeMalignancy = true
            f.addAutoFilled(key: "activeMalignancy", label: "Active malignancy keyword detected", source: "PMH")
        } else { f.addPending(key: "activeMalignancy", label: "Active malignancy — confirm from PMH/oncology", source: "PMH") }

        // Unilateral limb pain
        if ["unilateral leg pain", "unilateral limb pain", "calf pain", "leg pain"].contains(where: { text.contains($0) }) {
            i.unilateralLimbPain = true
            f.addAutoFilled(key: "unilateralLimbPain", label: "Unilateral limb pain keyword detected", source: "History")
        } else { f.addPending(key: "unilateralLimbPain", label: "Unilateral lower-limb pain — confirm from history", source: "History") }

        // Haemoptysis
        if ["haemoptysis", "hemoptysis", "coughing blood", "blood in sputum"].contains(where: { text.contains($0) }) {
            i.haemoptysis = true
            f.addAutoFilled(key: "haemoptysis", label: "Haemoptysis keyword detected", source: "History")
        } else { f.addPending(key: "haemoptysis", label: "Haemoptysis — confirm from history", source: "History") }

        // Heart rate from vitals
        if let v = patient.latestVitals,
           let hr = v.heartRate {
            if hr >= 95 {
                i.heartRateAbove94 = true
                i.heartRateAbove74 = false
                f.addAutoFilled(key: "heartRateAbove94", label: "HR \(hr) bpm ≥ 95 from latest vitals", source: "Vitals")
            } else if hr >= 75 {
                i.heartRateAbove74 = true
                f.addAutoFilled(key: "heartRateAbove74", label: "HR \(hr) bpm 75–94 from latest vitals", source: "Vitals")
            }
        } else {
            f.addPending(key: "heartRateAbove74", label: "Heart rate (75–94 bpm) — check vitals", source: "Vitals")
            f.addPending(key: "heartRateAbove94", label: "Heart rate (≥ 95 bpm) — check vitals", source: "Vitals")
        }

        // Limb pain on palpation + oedema
        if ["deep vein thrombosis", "dvt", "limb oedema", "limb swelling", "calf swelling",
            "palpation limb", "limb tenderness"].contains(where: { text.contains($0) }) {
            i.painOnPalpationLimbAndEdema = true
            f.addAutoFilled(key: "painOnPalpationLimbAndEdema", label: "Limb pain/oedema keyword detected", source: "Examination")
        } else { f.addPending(key: "painOnPalpationLimbAndEdema", label: "Pain on deep palpation of lower limb + unilateral oedema — confirm on examination", source: "Examination") }

        return (i, f)
    }

    // MARK: - Charlson Comorbidity Index (#76)
    static func caprini(patient: Patient) -> (CapriniInput, ScoreAutoFill) {
        var i = CapriniInput()
        var f = ScoreAutoFill()
        let cal = Calendar.current
        let age = patient.dateOfBirth.flatMap { cal.dateComponents([.year], from: $0, to: .now).year } ?? 40

        // Age bracket
        if age >= 75 {
            i.ageOver75 = true
            f.addAutoFilled(key: "age", label: "Age \(age) years — Caprini 3-point age bracket", source: "Demographics")
        } else if age >= 60 {
            i.age60to74 = true
            f.addAutoFilled(key: "age", label: "Age \(age) years — Caprini 2-point age bracket", source: "Demographics")
        } else if age >= 41 {
            i.age41to59 = true
            f.addAutoFilled(key: "age", label: "Age \(age) years — Caprini 1-point age bracket", source: "Demographics")
        }

        let text = ScoreText([patient.chiefComplaint, patient.hpi, patient.assessmentText, patient.pmhNotes,
                    patient.workingDiagnosis, patient.prescriptions.map { $0.drug }.joined(separator: " ")])

        // Malignancy
        if text.contains("carcinoma") || text.contains("cancer") || text.contains("malignancy") || text.contains("tumour") {
            i.activeOrPriorMalignancy = true
            f.addAutoFilled(key: "malignancy", label: "Active malignancy detected from diagnosis/notes", source: "Diagnosis")
        }

        // VTE history
        if text.contains("dvt") || text.contains("deep vein thrombosis") || text.contains("pulmonary embolism") || text.contains("pe ") {
            i.priorVTE = true
            f.addAutoFilled(key: "personalVTE", label: "Personal history of VTE detected in notes", source: "History/PMH")
        }

        // Inpatient bed rest
        if patient.setting == .inpatient {
            i.immobilityBedridden = true
            f.addAutoFilled(key: "bedrest", label: "Inpatient setting — bedridden/at-risk status", source: "Setting")
        }

        // Hormone therapy from prescriptions
        let rxText = patient.prescriptions.map { $0.drug.lowercased() }.joined(separator: " ")
        if rxText.contains("estrogen") || rxText.contains("oestrogen") || rxText.contains("progesteron") ||
           rxText.contains("oral contraceptive") || rxText.contains("hrt") {
            i.hormonalTherapy = true
            f.addAutoFilled(key: "hrt", label: "OCP/HRT detected in prescription list", source: "Prescriptions")
        }

        // Sepsis
        if text.contains("sepsis") || text.contains("septic") {
            i.sepsis30d = true
            f.addAutoFilled(key: "sepsis", label: "Sepsis documented in clinical notes", source: "History/Notes")
        }

        f.addPending(key: "surgery",      label: "Planned surgery type and duration — operative details required", source: "Operative")
        f.addPending(key: "familyVTE",    label: "Family history of DVT/PE?", source: "Family History")
        f.addPending(key: "thrombophilia", label: "Known thrombophilia? (Factor V Leiden, prothrombin mutation, etc.)", source: "Labs/Genetics")
        return (i, f)
    }

    // MARK: - #108 Child-Pugh Score

}
