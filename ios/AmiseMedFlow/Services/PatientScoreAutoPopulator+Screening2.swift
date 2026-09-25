// PatientScoreAutoPopulator+Screening2.swift
// Truelove-Witts Severity Index, Mirels Criteria, ARISCAT Score, Duke Criteria (IE).

import Foundation


extension PatientScoreAutoPopulator {

    // MARK: - Truelove-Witts Severity Index

    static func findRisc(patient: Patient) -> (ClinicalScoringEngine.FINDRISCInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.FINDRISCInput(
            ageGroup: 0, bmi: 22, waistCircumferenceCm: 80, sex: "male",
            physicalActivityMinPerWeek: 150, vegetablesFruitDaily: true,
            hypertensionMeds: false, highBloodGlucoseHistory: false, familyHistoryDiabetes: 0
        )
        var f = ScoreAutoFill()

        // Age from DOB
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: Date()).year ?? 0
            if age >= 65      { i.ageGroup = 4 }
            else if age >= 55 { i.ageGroup = 3 }
            else if age >= 45 { i.ageGroup = 2 }
            else              { i.ageGroup = 0 }
            f.addAutoFilled(key: "ageGroup", label: "Age \(age)y → age group \(i.ageGroup)", source: "Demographics")
        } else {
            f.addPending(key: "ageGroup", label: "Patient age — date of birth not recorded", source: "Demographics")
        }

        // Sex
        switch patient.sex {
        case .male:
            i.sex = "male"
            f.addAutoFilled(key: "sex", label: "Male — from demographics", source: "Demographics")
        case .female:
            i.sex = "female"
            f.addAutoFilled(key: "sex", label: "Female — from demographics", source: "Demographics")
        default:
            f.addPending(key: "sex", label: "Patient sex — set in demographics", source: "Demographics")
        }

        // BMI from latest vitals
        let latestVitals = patient.latestVitals
        if let wt = latestVitals?.weightKg, let ht = patient.heightCm, ht > 0 {
            let bmi = wt / pow(ht / 100, 2)
            i.bmi = bmi
            f.addAutoFilled(key: "bmi", label: String(format: "BMI %.1f from vitals", bmi), source: "Vitals")
        } else {
            f.addPending(key: "bmi", label: "BMI — record height and weight in vitals", source: "Vitals")
        }

        // Hypertension meds — from prescriptions
        let rxLow = patient.prescriptions.map { $0.drug.lowercased() }
        let htMedKw = ["amlodipine", "lisinopril", "losartan", "atenolol", "metoprolol",
                       "ramipril", "perindopril", "valsartan", "nifedipine", "hydrochlorothiazide",
                       "indapamide", "bisoprolol", "carvedilol", "telmisartan"]
        if rxLow.contains(where: { drug in htMedKw.contains(where: { drug.contains($0) }) }) {
            i.hypertensionMeds = true
            f.addAutoFilled(key: "hypertensionMeds", label: "Antihypertensive detected in prescriptions", source: "Medications")
        } else {
            f.addPending(key: "hypertensionMeds", label: "On antihypertensive medication? — confirm", source: "Medications")
        }

        // History of high blood glucose — from text
        let text = ScoreText([patient.chiefComplaint, patient.hpi, patient.assessmentText, patient.pmhNotes])
        if text.contains("high blood sugar") || text.contains("hyperglycaemia") || text.contains("hyperglycemia")
            || text.contains("impaired fasting") || text.contains("prediabet") || text.contains("glucose intol") {
            i.highBloodGlucoseHistory = true
            f.addAutoFilled(key: "highBloodGlucoseHistory", label: "History of high blood glucose detected", source: "History")
        } else {
            f.addPending(key: "highBloodGlucoseHistory", label: "History of high blood glucose — confirm", source: "History")
        }

        // Family history — pending
        f.addPending(key: "familyHistoryDiabetes", label: "Family history of diabetes (none/2nd-degree/1st-degree)", source: "History")
        // Physical activity and diet — patient self-report, always pending
        f.addPending(key: "physicalActivity", label: "Physical activity ≥30 min/day most days?", source: "History")
        f.addPending(key: "diet", label: "Vegetables/fruit eaten daily?", source: "History")
        f.addPending(key: "waist", label: "Waist circumference (cm) — measure at examination", source: "Examination")
        return (i, f)
    }

    // MARK: - #97 Mirels Criteria

    static func ckdEpi(patient: Patient) -> (ClinicalScoringEngine.CKDEPIInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.CKDEPIInput(serumCreatinineMgDL: 0.9, ageYears: 50, sex: "male", raceAA: false)
        var f = ScoreAutoFill()

        // Age from DOB
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: Date()).year ?? 50
            i.ageYears = max(18, age)
            f.addAutoFilled(key: "age", label: "Age \(i.ageYears)y from date of birth", source: "Demographics")
        } else {
            f.addPending(key: "age", label: "Patient age — date of birth not recorded", source: "Demographics")
        }

        // Sex
        switch patient.sex {
        case .male:
            i.sex = "male"
            f.addAutoFilled(key: "sex", label: "Male — from demographics", source: "Demographics")
        case .female:
            i.sex = "female"
            f.addAutoFilled(key: "sex", label: "Female — from demographics", source: "Demographics")
        default:
            f.addPending(key: "sex", label: "Patient sex — set in demographics", source: "Demographics")
        }

        // Creatinine always needs labs
        f.addPending(key: "creatinine", label: "Serum creatinine (mg/dL) — current renal function", source: "Labs")
        return (i, f)
    }

    // MARK: - #99 ARISCAT Score

    static func cage(patient: Patient) -> (ClinicalScoringEngine.CAGEInput, ScoreAutoFill) {
        let i = ClinicalScoringEngine.CAGEInput(
            feltCutDown: false, annoyedByCriticism: false,
            feltGuilty: false, eyeOpener: false
        )
        var f = ScoreAutoFill()
        let text = ScoreText([patient.chiefComplaint, patient.hpi, patient.assessmentText, patient.pmhNotes, patient.socialHistory])

        // Existing AUDIT-C or alcohol history suggests pre-fill context
        if let auditC = patient.auditCScore, auditC >= 4 {
            f.addAutoFilled(key: "context", label: "AUDIT-C \(auditC) — high-risk drinking pattern noted; CAGE criteria require patient interview", source: "AUDIT-C Score")
        }

        // Text clues
        let alcoholTerms = ["alcohol", "drinking", "drank", "ethanol", "aud ", "alcohol use disorder", "alcoholic"]
        let hasAlcoholContext = alcoholTerms.contains(where: { text.contains($0) })
        if hasAlcoholContext {
            f.addPending(key: "cage", label: "Alcohol use context detected — CAGE criteria require direct patient questionnaire", source: "History")
        } else {
            f.addPending(key: "cage", label: "CAGE questionnaire requires direct patient interview", source: "Patient Interview")
        }
        return (i, f)
    }

    // MARK: - #103 Duke Criteria (IE)

    static func dukeIE(patient: Patient) -> (ClinicalScoringEngine.DukeInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.DukeInput(
            positiveBloodCultures: 0, endocardialInvolvement: 0,
            predisposedHeartCondition: false, ivDrugUse: false, feverGe38: false,
            vascularPhenomena: false, immunologicPhenomena: false,
            positiveBloodCultureMinor: false, echoMinor: false
        )
        var f = ScoreAutoFill()
        let text = ScoreText([patient.chiefComplaint, patient.hpi, patient.assessmentText, patient.pmhNotes,
                    patient.examCVS, patient.examGeneral])

        // Fever from vitals
        let latestV = patient.latestVitals
        if let temp = latestV?.temperatureCelsius, temp >= 38.0 {
            i.feverGe38 = true
            f.addAutoFilled(key: "fever", label: String(format: "Temperature %.1f°C ≥38°C", temp), source: "Vitals")
        } else {
            f.addPending(key: "fever", label: "Fever ≥38°C — check vital signs", source: "Vitals")
        }

        // IV drug use
        if text.contains("ivdu") || text.contains("injection drug") || text.contains("intravenous drug") ||
           text.contains("iv drug") || text.contains("injecting drug") {
            i.ivDrugUse = true
            i.predisposedHeartCondition = true
            f.addAutoFilled(key: "ivdu", label: "Injection drug use documented", source: "History")
        }

        // Predisposing heart condition
        if text.contains("prosthetic valve") || text.contains("congenital heart") || text.contains("structural heart") ||
           text.contains("bicuspid") || text.contains("mitral valve") || text.contains("previous endocarditis") {
            i.predisposedHeartCondition = true
            f.addAutoFilled(key: "predisposing", label: "Predisposing cardiac condition noted in history", source: "PMH")
        } else if !i.ivDrugUse {
            f.addPending(key: "predisposing", label: "Predisposing heart condition? (prosthetic valve, CHD, prior IE)", source: "History")
        }

        // New murmur → endocardialInvolvement minor
        let cvsText = ScoreText([patient.examCVS])
        if cvsText.contains("new murmur") || cvsText.contains("new regurgitation") || cvsText.contains("aortic regurgitation") ||
           cvsText.contains("mitral regurgitation") || cvsText.contains("new diastolic") {
            i.echoMinor = true
            f.addAutoFilled(key: "murmur", label: "New regurgitation murmur documented on CVS exam", source: "Examination")
        } else {
            f.addPending(key: "murmur", label: "New valve regurgitation murmur on auscultation?", source: "Examination")
        }

        // Embolic/vascular phenomena
        if text.contains("janeway") || text.contains("emboli") || text.contains("septic embolus") ||
           text.contains("mycotic aneurysm") || text.contains("conjunctival haemorrhage") {
            i.vascularPhenomena = true
            f.addAutoFilled(key: "vascular", label: "Vascular phenomena noted in clinical documentation", source: "Examination/Notes")
        } else {
            f.addPending(key: "vascular", label: "Vascular phenomena? (emboli, Janeway lesions, mycotic aneurysm)", source: "Examination")
        }

        // Blood cultures and echo — always pending (results required)
        f.addPending(key: "bloodCultures", label: "Blood culture results (typical organism × ≥2 sets?)", source: "Microbiology")
        f.addPending(key: "echo", label: "Echocardiography (vegetation, abscess, new regurgitation?)", source: "Cardiology")
        return (i, f)
    }

    // MARK: - #104 mMRC Dyspnoea Scale

}
