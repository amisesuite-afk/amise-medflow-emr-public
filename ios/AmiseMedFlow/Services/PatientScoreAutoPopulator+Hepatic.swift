// PatientScoreAutoPopulator+Hepatic.swift
// Hepatic disease auto-populate functions
// No AI, no network — HIPAA-safe. Surgeon retains full authority.

import Foundation

extension PatientScoreAutoPopulator {

    static func meld(patient: Patient) -> (MELDInput, ScoreAutoFill) {
        var i = MELDInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        // Bilirubin → mg/dL. Values < 5 treated as mg/dL, ≥ 5 as μmol/L (÷17.1)
        if let bili = patient.latestLab(named: ["bilirubin"]) {
            let mgDL = bili < 5 ? bili : bili / 17.1
            i.bilirubinMgDL = max(1.0, min(40.0, mgDL))
            f.autoFieldKeys.insert("bilirubinMgDL")
        }

        // Creatinine: creatinineUmolL() returns μmol/L → convert to mg/dL (÷88.42)
        if let cr = patient.creatinineUmolL() {
            i.creatinineMgDL = max(1.0, min(4.0, cr / 88.42))
            f.autoFieldKeys.insert("creatinineMgDL")
        }

        // INR
        if let inr = patient.latestLab(named: ["inr","pt-inr"]) {
            i.inrValue = max(1.0, min(8.0, inr))
            f.autoFieldKeys.insert("inrValue")
        }

        // Sodium (lab result already in mmol/L)
        if let na = patient.latestLab(named: ["sodium"]) {
            i.sodiumMmolL = max(110.0, min(145.0, na))
            f.autoFieldKeys.insert("sodiumMmolL")
        }

        // Dialysis from clinical history
        if patient.clinicalTextContains(["dialysis","haemodialysis","hemodialysis",
                                         "esrd","renal replacement therapy"]) {
            i.onDialysis = true; f.autoFieldKeys.insert("onDialysis")
        }

        return (i, f)
    }

    // MARK: Alvarado (from vitals + labs)

    static func fib4(patient: Patient) -> (FIB4Input, ScoreAutoFill) {
        var i = FIB4Input()
        var f = ScoreAutoFill()

        // Age from DOB
        if let dob = patient.dateOfBirth {
            let years = Calendar.current.dateComponents([.year], from: dob, to: Date()).year ?? 40
            i.age = max(18, min(100, years))
            f.autoFieldKeys.insert("age")
        }

        // All lab values require manual entry
        f.addPending(key: "astIUL",        label: "AST (IU/L)",           source: "LFTs")
        f.addPending(key: "platelet10_9L", label: "Platelets (×10⁹/L)",   source: "FBC")
        f.addPending(key: "altIUL",        label: "ALT (IU/L)",           source: "LFTs")

        return (i, f)
    }

    // MARK: - CURB-65

    static func kingsCriteria(patient: Patient) -> (ClinicalScoringEngine.KingsCriteriaInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.KingsCriteriaInput()
        var f = ScoreAutoFill()

        let text = ([patient.chiefComplaint, patient.hpi, patient.pmhNotes,
                     patient.workingDiagnosis, patient.assessmentText]
            .compactMap { $0 }.joined(separator: " ")).lowercased()

        let paracetamolKw = ["paracetamol", "acetaminophen", "panadol", "calpol",
                             "paracetamol overdose", "acetaminophen overdose", "paracetamol toxicity"]
        if paracetamolKw.contains(where: { text.contains($0) }) {
            i.isParacetamol = true
            f.addAutoFilled(key: "isParacetamol", label: "Paracetamol aetiology detected", source: "History/diagnosis")
        }

        let alfKw = ["acute liver failure", "fulminant liver failure", "acute hepatic failure",
                     "fulminant hepatitis", "hepatic encephalopathy", "subacute liver failure"]
        if alfKw.contains(where: { text.contains($0) }) {
            f.addAutoFilled(key: "aetiology", label: "Acute liver failure context detected", source: "Working diagnosis")
        }

        let unfavKw = ["drug-induced", "seronegative", "indeterminate", "cryptogenic",
                       "wilson", "budd-chiari", "mushroom", "amanita"]
        if unfavKw.contains(where: { text.contains($0) }) {
            i.unfavourableAetiology = true
            f.addAutoFilled(key: "unfavourableAetiology", label: "Unfavourable aetiology keyword detected", source: "History")
        }

        let ageKw = ["age < 10", "age under 10", "paediatric", "pediatric", "age > 40", "age over 40"]
        if ageKw.contains(where: { text.contains($0) }) {
            i.ageUnder10OrAbove40 = true
            f.addAutoFilled(key: "ageUnder10OrAbove40", label: "Age criterion detected from notes", source: "History")
        } else if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: Date()).year ?? 0
            if age < 10 || age > 40 {
                i.ageUnder10OrAbove40 = true
                f.addAutoFilled(key: "ageUnder10OrAbove40", label: "Age \(age) — criterion met (<10 or >40)", source: "DOB")
            } else {
                f.addAutoFilled(key: "ageUnder10OrAbove40", label: "Age \(age) — criterion not met", source: "DOB")
            }
        }

        // All coagulation, creatinine, bilirubin and encephalopathy data require lab/clinical input
        f.addPending(key: "ptAbove100", label: "Prothrombin time > 100 s — document INR/PT result", source: "Coagulation screen")
        f.addPending(key: "ptAbove50", label: "Prothrombin time > 50 s (non-paracetamol minor criterion)", source: "Coagulation screen")
        f.addPending(key: "acidosisPhBelow730", label: "Arterial pH < 7.30 after resuscitation (paracetamol arm)", source: "ABG")
        f.addPending(key: "creatinineAbove300", label: "Creatinine > 300 µmol/L (paracetamol arm)", source: "U&E")
        f.addPending(key: "encephalopathyGrade34", label: "Hepatic encephalopathy grade III or IV", source: "Clinical examination")
        f.addPending(key: "jaundiceToDays", label: "Jaundice to encephalopathy interval > 7 days", source: "Clinical history")
        f.addPending(key: "bilirubinAbove300", label: "Bilirubin > 300 µmol/L (non-paracetamol minor criterion)", source: "LFTs")

        return (i, f)
    }

    // MARK: - ECOG Performance Status (#57)
    // MARK: - ALBI Score
    static func albi(patient: Patient) -> (ClinicalScoringEngine.ALBIInput, ScoreAutoFill) {
        let i = ClinicalScoringEngine.ALBIInput()
        var f = ScoreAutoFill(); f.isAttempted = true
        // ALBI requires current lab values — both are pending for clinician entry
        f.addPending(key: "albumin",   label: "Serum albumin (g/L) — check LFTs",        source: "LFTs")
        f.addPending(key: "bilirubin", label: "Serum bilirubin (μmol/L) — check LFTs",   source: "LFTs")
        return (i, f)
    }

    // MARK: - AUDIT-C
    // MARK: - MELD 3.0
    static func meld3(patient: Patient) -> (ClinicalScoringEngine.MELD3Input, ScoreAutoFill) {
        var i = ClinicalScoringEngine.MELD3Input()
        var f = ScoreAutoFill(); f.isAttempted = true
        // Sex from patient model
        if patient.sex == .female { i.isFemale = true; f.addAutoFilled(key: "sex", label: "Female sex (from patient record)", source: "Demographics") }
        // All lab values require current results
        f.addPending(key: "creatinine",  label: "Creatinine (μmol/L) — check U&E",    source: "Bloods")
        f.addPending(key: "bilirubin",   label: "Bilirubin (μmol/L) — check LFTs",    source: "LFTs")
        f.addPending(key: "inr",         label: "INR — check clotting screen",         source: "Bloods")
        f.addPending(key: "sodium",      label: "Sodium (mmol/L) — check U&E",         source: "Bloods")
        f.addPending(key: "albumin",     label: "Albumin (g/L) — check LFTs",          source: "LFTs")
        return (i, f)
    }

    // MARK: - Braden Scale
    static func childPugh(patient: Patient) -> (ChildPughInput, ScoreAutoFill) {
        var i = ChildPughInput()
        var f = ScoreAutoFill()

        let text = [patient.chiefComplaint, patient.hpi, patient.assessmentText, patient.pmhNotes, patient.workingDiagnosis]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Ascites inference
        if text.contains("refractory ascites") || text.contains("large volume ascites") || text.contains("tense ascites") {
            i.ascites = .refractory
            f.addAutoFilled(key: "ascites", label: "Refractory ascites detected in notes", source: "History/Notes")
        } else if text.contains("ascites") || text.contains("shifting dullness") || text.contains("fluid wave") {
            i.ascites = .controlled
            f.addAutoFilled(key: "ascites", label: "Ascites documented in clinical notes", source: "History/Exam")
        }

        // Encephalopathy inference
        if text.contains("hepatic encephalopathy grade iii") || text.contains("hepatic encephalopathy grade iv") ||
           text.contains("he grade 3") || text.contains("he grade 4") || text.contains("comatose") {
            i.encephalopathy = .grade3to4
            f.addAutoFilled(key: "he", label: "Grade III–IV encephalopathy detected in notes", source: "Notes")
        } else if text.contains("hepatic encephalopathy") || text.contains("asterixis") || text.contains("he grade") || text.contains("confusion") {
            i.encephalopathy = .grade1to2
            f.addAutoFilled(key: "he", label: "Hepatic encephalopathy Grade I–II detected", source: "Notes")
        }

        f.addPending(key: "bilirubin", label: "Total bilirubin (μmol/L) — LFT result", source: "Labs")
        f.addPending(key: "albumin",   label: "Albumin (g/dL) — LFT/serum protein result", source: "Labs")
        f.addPending(key: "inr",       label: "INR — coagulation screen result", source: "Labs")
        return (i, f)
    }

    // MARK: - #110 RIPASA Score


}
