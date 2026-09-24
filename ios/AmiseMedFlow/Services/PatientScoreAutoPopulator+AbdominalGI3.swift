// PatientScoreAutoPopulator+AbdominalGI3.swift
// LACE Index, Berlin ARDS Definition, FGSI, Rockall GI Bleed, ASA Physical Status auto-population.

import Foundation


extension PatientScoreAutoPopulator {

    // MARK: - #95 LACE Index

    static func fongCrs(patient: Patient) -> (ClinicalScoringEngine.FongCRSInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.FongCRSInput(
            nodePosivePrimaryTumour: false, diseaseFreeIntervalLess12Mo: false,
            moreThanOneHepaticTumour: false, largestTumourOver5cm: false, ceaOver200: false
        )
        var f = ScoreAutoFill()
        let text = [patient.chiefComplaint, patient.hpi, patient.assessmentText, patient.pmhNotes, patient.workingDiagnosis]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Node-positive primary
        if text.contains("node positive") || text.contains("lymph node involved") || text.contains("n1") || text.contains("n2") {
            i.nodePosivePrimaryTumour = true
            f.addAutoFilled(key: "nodePositive", label: "Node-positive primary tumour detected from notes", source: "History")
        } else {
            f.addPending(key: "nodePositive", label: "Was primary tumour lymph node positive? — staging records", source: "Records")
        }

        // DFI from admission date / text
        if text.contains("synchronous") || text.contains("same time as primary") {
            i.diseaseFreeIntervalLess12Mo = true
            f.addAutoFilled(key: "dfi", label: "Synchronous metastases — DFI < 12 months", source: "History")
        } else {
            f.addPending(key: "dfi", label: "Disease-free interval < 12 months from primary resection?", source: "History")
        }

        // All imaging-dependent fields — always pending
        f.addPending(key: "numMets",    label: "Number of hepatic metastases — CT/MRI report", source: "Imaging")
        f.addPending(key: "metSize",    label: "Largest hepatic metastasis size (> 5 cm?) — imaging", source: "Imaging")
        f.addPending(key: "cea",        label: "Preoperative CEA level (> 200 ng/mL?) — tumour markers", source: "Labs")
        return (i, f)
    }

    // MARK: - #101 Berlin ARDS Definition

    static func ripasa(patient: Patient) -> (ClinicalScoringEngine.RIPASAInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.RIPASAInput(
            male: false, age14to39: false, foreignNational: false, migratingToRIF: false,
            anorexia: false, nausea: false, vomiting: false, durationUnder48h: false,
            rofFossaTenderness: false, guarding: false, reboundTenderness: false, rovsing: false,
            fever37_5to38_5: false, elevatedWBC: false, abnormalUrinalysis: false)
        var f = ScoreAutoFill()

        // Sex from patient record
        if patient.sex == .male {
            i.male = true
            f.addAutoFilled(key: "male", label: "Male sex from patient record", source: "Demographics")
        }

        // Age 14–39 from DOB
        let cal = Calendar.current
        let age = patient.dateOfBirth.flatMap { cal.dateComponents([.year], from: $0, to: .now).year } ?? 0
        if age >= 14 && age <= 39 {
            i.age14to39 = true
            f.addAutoFilled(key: "age14to39", label: "Age \(age) years (14–39 bracket)", source: "Demographics")
        }

        // Vitals: fever, WBC
        let latestV = patient.latestVitals
        if let temp = latestV?.temperatureCelsius {
            if temp >= 37.5 && temp <= 38.5 {
                i.fever37_5to38_5 = true
                f.addAutoFilled(key: "fever", label: String(format: "Temperature %.1f °C from vitals", temp), source: "Vitals")
            }
        }

        // Text scan for symptoms
        let texts: [String?] = [patient.chiefComplaint, patient.hpi, patient.assessmentText]
        let text = texts.compactMap { $0 }.joined(separator: " ").lowercased()
        if text.contains("anorexia") || text.contains("loss of appetite") || text.contains("not eating") {
            i.anorexia = true
            f.addAutoFilled(key: "anorexia", label: "Anorexia detected in notes", source: "History")
        }
        if text.contains("nausea") {
            i.nausea = true
            f.addAutoFilled(key: "nausea", label: "Nausea mentioned in notes", source: "History")
        }
        if text.contains("vomit") {
            i.vomiting = true
            f.addAutoFilled(key: "vomiting", label: "Vomiting mentioned in notes", source: "History")
        }
        if text.contains("migrat") && (text.contains("rif") || text.contains("right iliac")) {
            i.migratingToRIF = true
            f.addAutoFilled(key: "migrating", label: "Pain migrating to RIF detected", source: "History")
        }

        f.addPending(key: "duration", label: "Duration of symptoms (< or ≥ 48 hours)", source: "History")
        f.addPending(key: "tenderness", label: "RIF tenderness / guarding / rebound (examination)", source: "Examination")
        f.addPending(key: "wbc", label: "WBC result (elevated = >11×10⁹/L)", source: "Labs")
        return (i, f)
    }

    // MARK: - #111 FGSI

    static func fgsi(patient: Patient) -> (ClinicalScoringEngine.FGSIInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.FGSIInput(
            temperature: 37.0, heartRate: 80, respiratoryRate: 16,
            sodium: 138.0, potassium: 4.0, creatinine: 88.0,
            haematocrit: 40.0, wbc: 7.0, bicarbonate: 24.0)
        var f = ScoreAutoFill()

        let latestV = patient.latestVitals

        if let temp = latestV?.temperatureCelsius {
            i.temperature = temp
            f.addAutoFilled(key: "temp", label: String(format: "Temperature %.1f °C from vitals", temp), source: "Vitals")
        } else {
            f.addPending(key: "temp", label: "Temperature (°C) — from vitals", source: "Vitals")
        }
        if let hr = latestV?.heartRate {
            i.heartRate = hr
            f.addAutoFilled(key: "hr", label: "Heart rate \(hr) bpm from vitals", source: "Vitals")
        } else {
            f.addPending(key: "hr", label: "Heart rate (bpm)", source: "Vitals")
        }
        if let rr = latestV?.respiratoryRate {
            i.respiratoryRate = rr
            f.addAutoFilled(key: "rr", label: "Respiratory rate \(rr)/min from vitals", source: "Vitals")
        } else {
            f.addPending(key: "rr", label: "Respiratory rate (/min)", source: "Vitals")
        }

        f.addPending(key: "sodium",      label: "Sodium (mmol/L) — U&E result", source: "Labs")
        f.addPending(key: "potassium",   label: "Potassium (mmol/L) — U&E result", source: "Labs")
        f.addPending(key: "creatinine",  label: "Creatinine (μmol/L) — U&E result", source: "Labs")
        f.addPending(key: "haematocrit", label: "Haematocrit (%) — FBC result", source: "Labs")
        f.addPending(key: "wbc",         label: "WBC (×10⁹/L) — FBC result", source: "Labs")
        f.addPending(key: "bicarb",      label: "Bicarbonate (mmol/L) — ABG/VBG result", source: "Labs")
        return (i, f)
    }

    // MARK: - Rockall GI Bleed Score
    // MARK: - Rockall GI Bleed Score
    static func rockall(patient: Patient) -> (RockallInput, ScoreAutoFill) {
        var i = RockallInput()
        var f = ScoreAutoFill()
        let text = [patient.chiefComplaint, patient.assessmentText, patient.hpi]
            .compactMap { $0 }.joined(separator: " ").lowercased()
        // Age
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: Date()).year ?? 0
            if age >= 80 {
                i.ageGroup = .over80
                f.addAutoFilled(key: "age", label: "Age ≥80 years (from DOB)", source: "Demographics")
            } else if age >= 60 {
                i.ageGroup = .sixtyTo79
                f.addAutoFilled(key: "age", label: "Age 60–79 years (from DOB)", source: "Demographics")
            } else {
                i.ageGroup = .under60
                f.addAutoFilled(key: "age", label: "Age <60 years (from DOB)", source: "Demographics")
            }
        } else {
            f.addPending(key: "age", label: "Age group — check DOB", source: "Demographics")
        }
        // Shock: latest vitals
        let latestV = patient.latestVitals
        if let v = latestV {
            if let sbp = v.bpSystolic, let hr = v.heartRate {
                if sbp < 100 {
                    i.shock = .sbpBelow100
                    f.addAutoFilled(key: "shock", label: "SBP <100 mmHg from vitals", source: "Vitals")
                } else if hr > 100 {
                    i.shock = .pulse100SBPOver100
                    f.addAutoFilled(key: "shock", label: "Pulse >100 with SBP ≥100 from vitals", source: "Vitals")
                }
            }
        } else {
            f.addPending(key: "shock", label: "Haemodynamic status — vitals required", source: "Vitals")
        }
        // Diagnosis and major stigmata are endoscopic findings — always pending
        f.addPending(key: "diagnosis",     label: "Endoscopic diagnosis — OGD result required", source: "Endoscopy")
        f.addPending(key: "stigmata",      label: "Major stigmata of bleeding — OGD finding", source: "Endoscopy")
        f.addPending(key: "comorbidity",   label: "Significant comorbidity (CCF/IHD/renal/liver/malignancy)", source: "PMH")
        // Scan PMH for comorbidity hints
        if text.contains("heart failure") || text.contains("ihd") || text.contains("ischaemic heart") {
            i.comorbidity = .anyMajor
            f.addAutoFilled(key: "comorbidity", label: "Cardiac comorbidity detected in history", source: "PMH text")
        } else if text.contains("renal failure") || text.contains("liver cirrhosis") || text.contains("malignancy") || text.contains("cancer") {
            i.comorbidity = .renalOrLiverOrMalignancy
            f.addAutoFilled(key: "comorbidity", label: "Renal/liver/malignancy comorbidity detected", source: "PMH text")
        }
        return (i, f)
    }

    // MARK: - ASA Physical Status

}
