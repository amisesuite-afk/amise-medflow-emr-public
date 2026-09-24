// PatientScoreAutoPopulator+Respiratory.swift
// Respiratory auto-populate functions
// No AI, no network — HIPAA-safe. Surgeon retains full authority.

import Foundation

extension PatientScoreAutoPopulator {

    static func stopBang(patient: Patient) -> (STOPBANGInput, ScoreAutoFill) {
        var i = STOPBANGInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        if patient.ageYears > 50 { i.ageOver50 = true; f.autoFieldKeys.insert("ageOver50") }
        if patient.sex == .male  { i.male = true;       f.autoFieldKeys.insert("male") }
        if let bmi = patient.latestBMI(), bmi > 35 {
            i.bmiOver35 = true; f.autoFieldKeys.insert("bmiOver35")
        }

        let htnKw = ["hypertension","htn","high blood pressure","elevated blood pressure"]
        let htnMeds = ["amlodipine","lisinopril","ramipril","enalapril","losartan","valsartan",
                       "atenolol","bisoprolol","metoprolol","carvedilol","hydrochlorothiazide",
                       "indapamide","nifedipine","doxazosin","perindopril","irbesartan",
                       "telmisartan","candesartan","olmesartan","chlortalidone"]
        if patient.clinicalTextContains(htnKw) || patient.prescriptionsContain(htnMeds) {
            i.pressureTreated = true; f.autoFieldKeys.insert("pressureTreated")
        }

        f.addPending(key: "snoring",
            label: "Loud snoring (audible through closed door)",
            source: "Ask patient / bed partner")
        f.addPending(key: "tired",
            label: "Often tired or drowsy during the day",
            source: "Ask patient")
        f.addPending(key: "observed",
            label: "Observed to stop breathing during sleep",
            source: "Ask bed partner")
        f.addPending(key: "neckOver40cm",
            label: "Neck circumference >40 cm",
            source: "Measure with tape")

        return (i, f)
    }

    // MARK: CHA₂DS₂-VASc

    static func psiPort(patient: Patient) -> (PSIPortInput, ScoreAutoFill) {
        var i = PSIPortInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        // Age and sex contribution
        let calendar = Calendar.current
        let ageYears = calendar.dateComponents([.year], from: patient.dateOfBirth ?? Date(), to: .now).year ?? 0
        if patient.sex == .male {
            i.ageMale = max(0, ageYears)
            f.autoFieldKeys.insert("ageMale")
        } else {
            i.ageFemale = max(0, ageYears - 10)
            f.autoFieldKeys.insert("ageFemale")
        }

        // Vitals thresholds
        if let v = patient.latestVitals {
            if let rr = v.respiratoryRate, rr > 30 {
                i.respiratoryRateOver30 = true; f.autoFieldKeys.insert("respiratoryRateOver30")
            }
            if let sbp = v.bpSystolic, sbp < 90 {
                i.systolicBPUnder90 = true; f.autoFieldKeys.insert("systolicBPUnder90")
            }
            if let temp = v.temperatureCelsius, (temp < 35 || temp > 40) {
                i.tempUnder35orOver40 = true; f.autoFieldKeys.insert("tempUnder35orOver40")
            }
            if let hr = v.heartRate, hr > 125 {
                i.heartRateOver125 = true; f.autoFieldKeys.insert("heartRateOver125")
            }
        }

        // Comorbidities from PMH free text
        let pmh = (patient.pmhNotes ?? "").lowercased()
        if ["cancer", "carcinoma", "malignancy", "neoplasm", "tumour", "tumor"].contains(where: { pmh.contains($0) }) {
            i.neoplasticDisease = true; f.autoFieldKeys.insert("neoplasticDisease")
        }
        if ["cirrhosis", "liver disease", "hepatic failure", "hepatitis"].contains(where: { pmh.contains($0) }) {
            i.liverDisease = true; f.autoFieldKeys.insert("liverDisease")
        }
        if ["heart failure", "cardiac failure", "ccf", "chf"].contains(where: { pmh.contains($0) }) {
            i.congestiveHeartFailure = true; f.autoFieldKeys.insert("congestiveHeartFailure")
        }
        if ["stroke", " tia ", "cva", "cerebrovascular"].contains(where: { pmh.contains($0) }) {
            i.cerebrovascularDisease = true; f.autoFieldKeys.insert("cerebrovascularDisease")
        }
        if ["renal failure", "kidney failure", "ckd", "crf", "end-stage renal"].contains(where: { pmh.contains($0) }) {
            i.renalDisease = true; f.autoFieldKeys.insert("renalDisease")
        }

        // Lab and radiology values require manual entry
        f.addPending(key: "alteredMentalStatus",      label: "Altered mental status (disorientation, stupor, coma)", source: "Clinical assessment")
        f.addPending(key: "arterialPHUnder735",        label: "Arterial pH <7.35",                                    source: "ABG")
        f.addPending(key: "bunOver11mmoL",             label: "BUN >11 mmol/L (>30 mg/dL)",                           source: "U&E results")
        f.addPending(key: "sodiumUnder130",            label: "Sodium <130 mmol/L",                                   source: "U&E results")
        f.addPending(key: "glucoseOver14",             label: "Glucose >14 mmol/L (>250 mg/dL)",                      source: "BMP / finger-stick")
        f.addPending(key: "haematocritUnder30",        label: "Haematocrit <30%",                                     source: "FBC results")
        f.addPending(key: "pao2Under60orSpO2Under90",  label: "PaO₂ <60 mmHg or SpO₂ <90%",                          source: "ABG or pulse oximetry")
        f.addPending(key: "pleuralEffusion",           label: "Pleural effusion on imaging",                          source: "CXR / CT thorax")
        f.addPending(key: "nursingHomeResident",       label: "Nursing home resident",                                source: "Social history")

        return (i, f)
    }

    // MARK: - SOFA

    static func curb65(patient: Patient) -> (CURB65Input, ScoreAutoFill) {
        var i = CURB65Input()
        var f = ScoreAutoFill(); f.isAttempted = true
        let age = patient.ageYears

        // Age ≥65
        if age >= 65 { i.ageOver65 = true; f.autoFieldKeys.insert("ageOver65") }

        // Respiratory rate ≥30 from latest vitals
        if let v = patient.latestVitals, let rr = v.respiratoryRate, rr >= 30 {
            i.respiratoryRateOver30 = true; f.autoFieldKeys.insert("respiratoryRateOver30")
        }

        // Low BP: SBP <90 or DBP ≤60 from latest vitals
        if let v = patient.latestVitals {
            let lowSBP = v.bpSystolic.map { $0 < 90 }  ?? false
            let lowDBP = v.bpDiastolic.map { $0 <= 60 } ?? false
            if lowSBP || lowDBP {
                i.lowBP = true; f.autoFieldKeys.insert("lowBP")
            }
        }

        // Urea >7 mmol/L from labs; values >50 = BUN mg/dL → ÷2.8
        if let urea = patient.latestLab(named: ["urea","blood urea","bun","blood urea nitrogen"]) {
            let mmol = urea > 50 ? urea / 2.8 : urea
            if mmol > 7 { i.ureaDOver7 = true; f.autoFieldKeys.insert("ureaDOver7") }
        }

        // Confusion requires clinical assessment
        f.addPending(key: "confusion",
            label: "Confusion: new disorientation to person, place, or time",
            source: "Clinical assessment / AMTS")
        if !f.isAuto("ureaDOver7") {
            f.addPending(key: "ureaDOver7",
                label: "Urea >7 mmol/L (BUN >19 mg/dL)",
                source: "U&E results")
        }
        if !f.isAuto("respiratoryRateOver30") {
            f.addPending(key: "respiratoryRateOver30",
                label: "Respiratory rate ≥30 /min",
                source: "Measure at bedside")
        }

        return (i, f)
    }

    // MARK: - Padua Prediction Score

    // MARK: - DECAF (#68)
    static func decaf(patient: Patient) -> (ClinicalScoringEngine.DECAFInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.DECAFInput()
        var f = ScoreAutoFill()
        let text = [patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan, patient.pmhNotes]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // MRC dyspnoea — attempt detection from text
        let mrc5Kw = ["unable to leave house", "too breathless to leave", "housebound", "confined to"]
        let mrc4Kw = ["stops after 100m", "100 metres", "100 meters", "severe dyspnoea", "severe breathlessness"]
        let mrc3Kw = ["slower than peers", "stops on flat", "moderate dyspnoea", "exertional dyspnoea"]
        if mrc5Kw.contains(where: { text.contains($0) }) {
            i.dyspnoeaMRC = 5
            f.addAutoFilled(key: "mrcGrade", label: "MRC Grade 5 keywords detected — housebound", source: "History")
        } else if mrc4Kw.contains(where: { text.contains($0) }) {
            i.dyspnoeaMRC = 4
            f.addAutoFilled(key: "mrcGrade", label: "MRC Grade 4 keywords detected — stops after 100 m", source: "History")
        } else if mrc3Kw.contains(where: { text.contains($0) }) {
            i.dyspnoeaMRC = 3
            f.addAutoFilled(key: "mrcGrade", label: "MRC Grade 3 keywords detected", source: "History")
        } else {
            f.addPending(key: "mrcGrade", label: "MRC dyspnoea grade (baseline, pre-exacerbation) — confirm", source: "History")
        }

        // Eosinopenia
        f.addPending(key: "eosinopenia", label: "Eosinopenia (eosinophils < 0.05 × 10⁹/L) — check FBC differential", source: "Haematology")

        // Consolidation
        let cxrKw = ["consolidation", "pneumonia", "lobar consolidation", "cxr consolidation",
                     "chest x-ray consolidation", "chest xray consolidation"]
        if cxrKw.contains(where: { text.contains($0) }) {
            i.consolidation = true
            f.addAutoFilled(key: "consolidation", label: "Consolidation keyword detected on CXR", source: "Imaging")
        } else {
            f.addPending(key: "consolidation", label: "Consolidation on CXR — confirm radiology report", source: "Imaging")
        }

        // Acidaemia
        let acidKw = ["acidaemia", "acidemia", "ph 7.2", "ph 7.1", "ph <7.3", "ph < 7.3",
                      "type 2 respiratory failure", "hypercapnic", "respiratory acidosis"]
        if acidKw.contains(where: { text.contains($0) }) {
            i.acidaemia = true
            f.addAutoFilled(key: "acidaemia", label: "Acidaemia/hypercapnia keyword detected", source: "History/ABG")
        } else {
            f.addPending(key: "acidaemia", label: "Acidaemia pH < 7.30 — check ABG", source: "Arterial blood gas")
        }

        // Atrial fibrillation
        let afKw = ["atrial fibrillation", "af ", " af,", "afib", "fast af", "fast atrial fibrillation",
                    "new af", "paroxysmal af"]
        if afKw.contains(where: { text.contains($0) }) {
            i.atrialFibrillation = true
            f.addAutoFilled(key: "atrialFibrillation", label: "Atrial fibrillation keyword detected", source: "History/ECG")
        } else {
            f.addPending(key: "atrialFibrillation", label: "Atrial fibrillation (new or pre-existing) — confirm ECG", source: "ECG")
        }

        return (i, f)
    }

    // MARK: - AIR Score (#70)
    static func centor(patient: Patient) -> (ClinicalScoringEngine.CentorInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.CentorInput()
        var f = ScoreAutoFill(); f.isAttempted = true
        let text = [patient.chiefComplaint, patient.hpi, patient.assessmentText]
            .compactMap { $0 }.joined(separator: " ").lowercased()
        // Exudate
        if text.contains("exudate") || text.contains("pus on tonsil") || text.contains("tonsillar exudate") {
            i.tonsillarExudate = true
            f.addAutoFilled(key: "tonsillarExudate", label: "Tonsillar exudate documented", source: "History")
        } else {
            f.addPending(key: "tonsillarExudate", label: "Tonsillar exudate — examination finding required", source: "Examination")
        }
        // Tender anterior cervical nodes
        if text.contains("tender cervical") || text.contains("anterior cervical lymph") || text.contains("lymphadenopathy") {
            i.tenderAnteriorCervical = true
            f.addAutoFilled(key: "tenderAnteriorCervical", label: "Tender anterior cervical lymphadenopathy documented", source: "History")
        } else {
            f.addPending(key: "tenderAnteriorCervical", label: "Tender anterior cervical nodes — examination required", source: "Examination")
        }
        // Fever
        if let v = patient.vitalsEntries.max(by: { ($0.recordedAt) < ($1.recordedAt) }),
           let t = v.temperatureCelsius, t >= 38.0 {
            i.feverHistory = true
            f.addAutoFilled(key: "feverHistory", label: "Fever ≥38°C from vitals", source: "Vitals")
        } else if text.contains("fever") || text.contains("pyrexia") || text.contains("temperature") {
            i.feverHistory = true
            f.addAutoFilled(key: "feverHistory", label: "Fever documented in history", source: "History")
        } else {
            f.addPending(key: "feverHistory", label: "Fever history — confirm temperature ≥38°C", source: "Vitals/History")
        }
        // Absence of cough (score positive = no cough)
        let coughKw = ["no cough", "absence of cough", "non-productive", "no productive cough"]
        if coughKw.contains(where: { text.contains($0) }) {
            i.noCough = true
            f.addAutoFilled(key: "noCough", label: "Absence of cough documented", source: "History")
        } else {
            f.addPending(key: "noCough", label: "Cough absence — confirm no cough present", source: "History")
        }
        // Age group from DOB
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: .now).year ?? 0
            if age < 15      { i.ageGroup = 0 }
            else if age < 45 { i.ageGroup = 1 }
            else             { i.ageGroup = 2 }
            f.addAutoFilled(key: "ageGroup", label: "Age group derived from date of birth", source: "Demographics")
        }
        return (i, f)
    }

    // MARK: - IPSS (International Prostate Symptom Score)

    static func ariscat(patient: Patient) -> (ClinicalScoringEngine.ARISCATInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.ARISCATInput(
            age: 50, spo2Preop: 98, respiratoryInfection: false,
            preOpHaemoglobin: 13.5, surgicalIncision: 0,
            surgicalDurationHrs: 1.0, emergencyProcedure: false
        )
        var f = ScoreAutoFill()

        // Age from DOB
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: Date()).year ?? 50
            i.age = max(18, age)
            f.addAutoFilled(key: "age", label: "Age \(i.age)y from date of birth", source: "Demographics")
        } else {
            f.addPending(key: "age", label: "Patient age — date of birth not recorded", source: "Demographics")
        }

        // SpO₂ from latest vitals
        let latestVitals = patient.latestVitals
        if let spo2 = latestVitals?.spo2 {
            i.spo2Preop = spo2
            f.addAutoFilled(key: "spo2", label: "SpO₂ \(spo2)% from latest vitals", source: "Vitals")
        } else {
            f.addPending(key: "spo2", label: "Pre-op SpO₂ (%) — record in vitals", source: "Vitals")
        }

        // Emergency from setting
        if patient.setting == .emergency {
            i.emergencyProcedure = true
            f.addAutoFilled(key: "emergency", label: "Emergency setting detected", source: "Setting")
        } else {
            f.addPending(key: "emergency", label: "Emergency vs elective procedure — confirm", source: "Setting")
        }

        // Haemoglobin, incision type, and duration — always pending
        f.addPending(key: "haemoglobin",   label: "Pre-op haemoglobin (g/dL) — FBC result", source: "Labs")
        f.addPending(key: "incision",      label: "Surgical incision type (peripheral/upper abdominal/intrathoracic)", source: "Operative")
        f.addPending(key: "duration",      label: "Planned surgical duration (hours)", source: "Operative")
        f.addPending(key: "urti",          label: "Acute respiratory infection in last month?", source: "History")
        return (i, f)
    }

    // MARK: - #100 Fong Clinical Risk Score

    static func mmrc(patient: Patient) -> (ClinicalScoringEngine.MMRCInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.MMRCInput(grade: 0)
        var f = ScoreAutoFill()
        let text = [patient.chiefComplaint, patient.hpi, patient.assessmentText, patient.pmhNotes]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Restore previously stored grade
        if let stored = patient.mmrcGrade {
            i.grade = stored
            f.addAutoFilled(key: "grade", label: "mMRC grade \(stored) from stored score", source: "Stored Score")
            return (i, f)
        }

        // Infer from text descriptors
        if text.contains("too breathless to leave") || text.contains("breathless when dress") || text.contains("grade 4") {
            i.grade = 4
            f.addAutoFilled(key: "grade", label: "Severe dyspnoea (Grade 4) inferred from history", source: "History")
        } else if text.contains("stop for breath") || text.contains("stops after 100m") || text.contains("grade 3") {
            i.grade = 3
            f.addAutoFilled(key: "grade", label: "Severe dyspnoea (Grade 3) inferred from history", source: "History")
        } else if text.contains("walks slower") || text.contains("stops after 15 min") || text.contains("grade 2") {
            i.grade = 2
            f.addAutoFilled(key: "grade", label: "Moderate dyspnoea (Grade 2) inferred from history", source: "History")
        } else if text.contains("breathless") || text.contains("dyspnoea") || text.contains("shortness of breath") || text.contains("sob ") {
            f.addPending(key: "grade", label: "Breathlessness noted — grade dyspnoea from patient interview", source: "Patient Interview")
        } else {
            f.addPending(key: "grade", label: "mMRC grade requires direct patient assessment (0–4)", source: "Patient Interview")
        }
        return (i, f)
    }

    // MARK: - #105 Paediatric Trauma Score


}
