// PatientScoreAutoPopulator+Cardiovascular2a.swift
// APACHE II Score, Clinical Frailty Scale, Forrest Classification auto-population.

import Foundation


extension PatientScoreAutoPopulator {

    // MARK: - APACHE II

    static func timi(patient: Patient) -> (TIMIInput, ScoreAutoFill) {
        var i = TIMIInput()
        var f = ScoreAutoFill()
        let allText = ScoreText([patient.chiefComplaint, patient.hpi, patient.assessmentText,
                       patient.pmhNotes, patient.workingDiagnosis, patient.notes])

        // Age
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: Date()).year ?? 0
            if age >= 65 {
                i.ageOver65 = true
                f.addAutoFilled(key: "ageOver65", label: "Age ≥65 (from DOB)", source: "Date of birth")
            }
        }

        // CAD risk factors from clinical text
        let riskFactorKeywords = ["hypertension", "hypercholesterol", "hyperlipid", "diabetes",
                                   "diabet", "smoker", "smoking", "family history of cad",
                                   "family history of coronary", "ischaemic heart disease"]
        let riskCount = riskFactorKeywords.filter { allText.contains($0) }.count
        if riskCount >= 3 {
            i.threeOrMoreRiskFactors = true
            f.addAutoFilled(key: "threeOrMoreRiskFactors", label: "≥3 CAD risk factors detected — verify", source: "PMH / clinical text")
        }

        // Prior coronary stenosis
        if allText.contains("coronary artery disease") || allText.contains("cad") ||
           allText.contains("coronary stenosis") || allText.contains("prior mi") ||
           allText.contains("previous mi") || allText.contains("pci") ||
           allText.contains("cabg") || allText.contains("stent") {
            i.priorCoronaryArteryStenosis = true
            f.addAutoFilled(key: "priorCoronaryArteryStenosis", label: "Prior CAD detected from clinical text — verify stenosis ≥50%", source: "PMH / clinical text")
        }

        // Aspirin use
        if allText.contains("aspirin") || allText.contains("acetylsalicylic") {
            i.aspirinUseInLast7Days = true
            f.addAutoFilled(key: "aspirinUseInLast7Days", label: "Aspirin use noted in clinical text — verify recent use", source: "Clinical text / medications")
        }

        // ST deviation and cardiac markers require ECG/lab — mark pending
        f.addPending(key: "stDeviationOnECG", label: "ST deviation — requires current ECG", source: "ECG")
        f.addPending(key: "twoOrMoreAnginalEvents", label: "Anginal episodes in prior 24 h — clinical history", source: "Clinical history")
        f.addPending(key: "elevatedCardiacMarkers", label: "Cardiac markers (troponin / CK-MB) — requires laboratory result", source: "Laboratory")
        return (i, f)
    }

    // MARK: - Clinical Frailty Scale

    static func heart(patient: Patient) -> (HEARTInput, ScoreAutoFill) {
        var i = HEARTInput()
        var f = ScoreAutoFill()
        let allText = ScoreText([patient.chiefComplaint, patient.hpi, patient.assessmentText,
                       patient.workingDiagnosis, patient.pmhNotes])

        // Age score
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: Date()).year ?? 0
            if age >= 65 {
                i.ageScore = 2
                f.addAutoFilled(key: "ageScore", label: "Age ≥65 (score 2)", source: "Date of birth")
            } else if age >= 45 {
                i.ageScore = 1
                f.addAutoFilled(key: "ageScore", label: "Age 45–64 (score 1)", source: "Date of birth")
            } else {
                i.ageScore = 0
                f.addAutoFilled(key: "ageScore", label: "Age <45 (score 0)", source: "Date of birth")
            }
        } else {
            f.addPending(key: "ageScore", label: "Age — required for HEART score", source: "Date of birth")
        }

        // Risk factors from PMH / clinical text
        let riskKeywords = ["hypertension", "hypercholesterol", "hyperlipid", "diabetes", "diabet",
                             "smoker", "smoking", "obesity", "obese", "bmi", "family history",
                             "coronary artery disease", "cad", "atheroscler", "myocardial infarction",
                             "mi", "pci", "cabg", "stent", "stroke", "peripheral arterial", "pad"]
        let riskCount = riskKeywords.filter { allText.contains($0) }.count
        if allText.contains("known atheroscler") || allText.contains("prior mi") ||
           allText.contains("previous mi") || allText.contains("cabg") ||
           allText.contains("prior pci") || riskCount >= 3 {
            i.riskFactors = 2
            f.addAutoFilled(key: "riskFactors", label: "Known atherosclerosis or ≥3 risk factors (score 2) — verify", source: "PMH / clinical text")
        } else if riskCount >= 1 {
            i.riskFactors = 1
            f.addAutoFilled(key: "riskFactors", label: "1–2 risk factors detected (score 1) — verify", source: "PMH / clinical text")
        }

        // History — clinician must assess; mark as pending
        f.addPending(key: "history", label: "History score (0–2) — clinician assessment of cardiac suspicion", source: "Clinical assessment")
        // ECG — requires ECG trace
        f.addPending(key: "ecg", label: "ECG findings (0–2) — requires current ECG review", source: "ECG report")
        // Troponin — requires lab result
        f.addPending(key: "troponin", label: "Troponin result (0–2) — requires laboratory result", source: "Laboratory")
        return (i, f)
    }

    // MARK: - Forrest Classification

    static func grace(patient: Patient) -> (GRACEInput, ScoreAutoFill) {
        var i = GRACEInput()
        var f = ScoreAutoFill()
        let allText = ScoreText([patient.chiefComplaint, patient.hpi, patient.assessmentText,
                       patient.pmhNotes, patient.workingDiagnosis, patient.notes])

        // Age category from DOB
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: Date()).year ?? 0
            let cat: Int = switch age {
            case 80...: 5
            case 70..<80: 4
            case 60..<70: 3
            case 50..<60: 2
            case 40..<50: 1
            default: 0
            }
            i.ageCategory = cat
            f.addAutoFilled(key: "ageCategory", label: "Age category \(cat) (from DOB)", source: "Date of birth")
        } else {
            f.addPending(key: "ageCategory", label: "Age category — requires DOB", source: "Demographics")
        }

        // Cardiac arrest from text
        if allText.contains("cardiac arrest") || allText.contains("vf arrest") ||
           allText.contains("vt arrest") || allText.contains("resuscit") ||
           allText.contains("cpr") || allText.contains("rosc") {
            i.cardiacArrest = true
            f.addAutoFilled(key: "cardiacArrest", label: "Cardiac arrest mentioned in clinical text — verify at admission", source: "Clinical text")
        }

        // Elevated cardiac markers from text
        if allText.contains("troponin") || allText.contains("ck-mb") || allText.contains("elevated marker") ||
           allText.contains("positive trop") || allText.contains("high troponin") {
            i.elevatedMarkers = true
            f.addAutoFilled(key: "elevatedMarkers", label: "Elevated cardiac markers detected in clinical text — verify result", source: "Clinical text")
        }

        // ST deviation from text
        if allText.contains("st depression") || allText.contains("st elevation") ||
           allText.contains("st segment") || allText.contains("stemi") || allText.contains("nstemi") ||
           allText.contains("st change") || allText.contains("ischaemic ecg") {
            i.stDeviation = true
            f.addAutoFilled(key: "stDeviation", label: "ST-segment deviation mentioned in clinical text — verify on ECG", source: "Clinical text / ECG")
        }

        // HR, SBP, creatinine, Killip require measurements — mark pending
        f.addPending(key: "heartRate", label: "Heart rate (bpm) — requires current vital signs", source: "Vital signs")
        f.addPending(key: "systolicBP", label: "Systolic BP (mmHg) — requires current vital signs", source: "Vital signs")
        f.addPending(key: "creatinine", label: "Serum creatinine (mg/dL) — requires laboratory result", source: "Laboratory")
        f.addPending(key: "killipClass", label: "Killip class (I–IV) — clinical assessment of heart failure signs", source: "Clinical assessment")
        return (i, f)
    }

}
