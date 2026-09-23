// PatientScoreAutoPopulator+Pancreatitis.swift
// Pancreatitis severity auto-populate functions
// No AI, no network — HIPAA-safe. Surgeon retains full authority.

import Foundation

extension PatientScoreAutoPopulator {

    static func ranson(patient: Patient) -> (RansonInput, ScoreAutoFill) {
        var i = RansonInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        if patient.ageYears > 55 { i.ageOver55 = true; f.autoFieldKeys.insert("ageOver55") }

        let wbcKw = ["wbc","white blood cell","white cell count","leucocyte","leukocyte"]

        // WBC (×10⁹/L)
        if let wbc = patient.latestLab(named: wbcKw) {
            let val = wbc > 100 ? wbc / 1000 : wbc
            if val > 16 { i.wbcOver16k = true; f.autoFieldKeys.insert("wbcOver16k") }
        }

        // Glucose >11.1 mmol/L (= >200 mg/dL); values >30 = mg/dL
        if let glu = patient.latestLab(named: ["glucose","blood glucose","rbs"]) {
            let mmol = glu > 30 ? glu / 18.0 : glu
            if mmol > 11.1 { i.glucoseOver200 = true; f.autoFieldKeys.insert("glucoseOver200") }
        }

        // LDH >350 IU/L
        if let ldh = patient.latestLab(named: ["ldh","lactate dehydrogenase"]) {
            if ldh > 350 { i.ldhOver350 = true; f.autoFieldKeys.insert("ldhOver350") }
        }

        // AST >250 IU/L
        if let ast = patient.latestLab(named: ["ast","aspartate aminotransferase","aspartate transaminase"]) {
            if ast > 250 { i.astOver250 = true; f.autoFieldKeys.insert("astOver250") }
        }

        // 48 h serial criteria — cannot auto-detect from a single time-point reading
        f.addPending(key: "hctFallOver10",
            label: "Haematocrit fall >10% from admission value (48 h)",
            source: "Serial FBC — compare to admission Hct")
        f.addPending(key: "bunRiseOver5",
            label: "BUN rise >1.8 mmol/L from admission (48 h)",
            source: "Serial U&E — compare to admission BUN")
        f.addPending(key: "calciumBelow8",
            label: "Calcium <2.0 mmol/L (<8 mg/dL) at 48 h",
            source: "Electrolyte panel at 48 h")
        f.addPending(key: "pao2Below60",
            label: "PaO₂ <60 mmHg at 48 h",
            source: "Arterial blood gas")

        return (i, f)
    }

    // MARK: Glasgow Pancreatitis (from labs)

    static func glasgowPancreatitis(patient: Patient) -> (GlasgowPancreatitisInput, ScoreAutoFill) {
        var i = GlasgowPancreatitisInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        if patient.ageYears > 55 { i.ageOver55 = true; f.autoFieldKeys.insert("ageOver55") }

        let wbcKw = ["wbc","white blood cell","white cell count","leucocyte","leukocyte"]

        // WBC (×10⁹/L)
        if let wbc = patient.latestLab(named: wbcKw) {
            let val = wbc > 100 ? wbc / 1000 : wbc
            if val > 15 { i.wbcOver15k = true; f.autoFieldKeys.insert("wbcOver15k") }
        }

        // Glucose >10 mmol/L; values >30 = mg/dL
        if let glu = patient.latestLab(named: ["glucose","blood glucose","rbs"]) {
            let mmol = glu > 30 ? glu / 18.0 : glu
            if mmol > 10 { i.glucoseOver10 = true; f.autoFieldKeys.insert("glucoseOver10") }
        }

        // Urea >16 mmol/L; values >50 treated as BUN mg/dL → ÷2.8
        if let urea = patient.latestLab(named: ["urea","blood urea","bun","blood urea nitrogen"]) {
            let mmol = urea > 50 ? urea / 2.8 : urea
            if mmol > 16 { i.ureaOver16 = true; f.autoFieldKeys.insert("ureaOver16") }
        }

        // Calcium <2 mmol/L; values ≥5 treated as mg/dL → ÷4.0
        if let ca = patient.latestLab(named: ["calcium"]) {
            let mmol = ca >= 5 ? ca / 4.0 : ca
            if mmol < 2.0 { i.calciumBelow2 = true; f.autoFieldKeys.insert("calciumBelow2") }
        }

        // Albumin <32 g/L; values <10 treated as g/dL → ×10
        if let alb = patient.latestLab(named: ["albumin"]) {
            let gL = alb < 10 ? alb * 10 : alb
            if gL < 32 { i.albuminBelow32 = true; f.autoFieldKeys.insert("albuminBelow32") }
        }

        // LDH >600 IU/L or AST >200 IU/L
        let ldh = patient.latestLab(named: ["ldh","lactate dehydrogenase"])
        let ast = patient.latestLab(named: ["ast","aspartate aminotransferase"])
        if (ldh.map { $0 > 600 } ?? false) || (ast.map { $0 > 200 } ?? false) {
            i.ldhOver600OrAstOver200 = true; f.autoFieldKeys.insert("ldhOver600OrAstOver200")
        }

        f.addPending(key: "pao2Below60",
            label: "PaO₂ <60 mmHg",
            source: "Arterial blood gas")

        return (i, f)
    }

    // MARK: MELD-Na (from labs)

    static func bisap(patient: Patient) -> (ClinicalScoringEngine.BISAPInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.BISAPInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        // Age
        let ageYears = Calendar.current.dateComponents([.year], from: patient.dateOfBirth ?? Date(), to: .now).year ?? 0
        if ageYears > 60 { i.ageOver60 = true; f.autoFieldKeys.insert("ageOver60") }

        // SIRS components from latest vitals
        if let v = patient.latestVitals {
            let temp = v.temperatureCelsius ?? 37.0
            let hr   = v.heartRate ?? 0
            let rr   = v.respiratoryRate ?? 0
            var sirsCount = 0
            if temp > 38 || temp < 36  { sirsCount += 1 }
            if hr  > 90                { sirsCount += 1 }
            if rr  > 20                { sirsCount += 1 }
            if sirsCount >= 2 { i.sirs = true; f.autoFieldKeys.insert("sirs") }
        }

        f.addPending(key: "bunOver9mmolL",       label: "BUN >9 mmol/L (>25 mg/dL)",                  source: "U&E results")
        f.addPending(key: "impairedMentalStatus", label: "Impaired mental status (disorientation / stupor)", source: "Clinical assessment")
        f.addPending(key: "pleuralEffusion",      label: "Pleural effusion on imaging",                 source: "CXR / CT thorax")

        return (i, f)
    }

    // MARK: PSI/PORT (from patient demographics, vitals, and PMH)

    static func ctsi(patient: Patient) -> (CTSIInput, ScoreAutoFill) {
        let i = CTSIInput()
        var f = ScoreAutoFill()
        // All CTSI inputs require CT abdomen with IV contrast — no auto-fill possible
        f.addPending(key: "balthazarGrade",
            label: "Balthazar grade (A–E) — requires CT abdomen review",
            source: "CT report")
        f.addPending(key: "necrosisScore",
            label: "Pancreatic necrosis extent — requires CT with IV contrast",
            source: "CT report")
        return (i, f)
    }

    // MARK: - TIMI Risk Score (UA/NSTEMI)

    // MARK: - Harmless Acute Pancreatitis Score (#78)
    static func haps(patient: Patient) -> (ClinicalScoringEngine.HAPSInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.HAPSInput()
        var f = ScoreAutoFill()
        let text = [patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan, patient.pmhNotes]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Peritonism absence
        let peritonismKw = ["peritonism", "peritoneal irritation", "generalised tenderness",
                            "guarding", "rigidity", "board-like"]
        if peritonismKw.contains(where: { text.contains($0) }) {
            f.addPending(key: "peritonismAbsent", label: "Peritoneal signs detected — confirm absence/presence on examination", source: "Examination")
        } else {
            i.peritonismAbsent = true
            f.addAutoFilled(key: "peritonismAbsent", label: "No peritoneal irritation documented in clinical text", source: "History/Notes")
        }

        // Creatinine
        f.addPending(key: "creatinineNormal", label: "Serum creatinine ≤ 177 µmol/L — check urea and electrolytes", source: "U&E/Bloods")

        // Haematocrit
        f.addPending(key: "haematocritNormal", label: "Haematocrit ≤ 43% (male) / ≤ 39.6% (female) — check FBC", source: "FBC")

        return (i, f)
    }

    // MARK: – Glasgow-Imrie (48-h worst values)

    static func glasgowImrie(patient: Patient) -> (ClinicalScoringEngine.GlasgowImrieInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.GlasgowImrieInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        let text = [patient.chiefComplaint, patient.hpi, patient.assessmentText,
                    patient.pmhNotes, patient.workingDiagnosis].compactMap { $0 }.joined(separator: " ").lowercased()

        // Age > 55
        let ageYears = Calendar.current.dateComponents([.year], from: patient.dateOfBirth ?? Date(), to: .now).year ?? 0
        if ageYears > 55 {
            i.ageAbove55 = true
            f.addAutoFilled(key: "ageAbove55", label: "Age > 55 years (derived from date of birth)", source: "Demographics")
        }

        // Hyperglycaemia (non-diabetic context): > 10 mmol/L
        let diabetesKw = ["diabet", "insulin", "metformin", "hypoglycaem"]
        let hasDiabetes = diabetesKw.contains(where: { text.contains($0) })
        let glucoseKw = ["hyperglycaem", "raised glucose", "glucose > 10", "glucose >10",
                         "blood glucose 1", "blood sugar 1"]
        if !hasDiabetes && glucoseKw.contains(where: { text.contains($0) }) {
            i.glucoseAbove10 = true
            f.addAutoFilled(key: "glucoseAbove10", label: "Hyperglycaemia > 10 mmol/L detected in notes (non-diabetic)", source: "History/Notes")
        }

        // All laboratory values require manual confirmation
        f.addPending(key: "pao2Below59",    label: "PaO₂ < 59.2 mmHg (< 7.9 kPa) — check ABG (worst value in 48 h)",    source: "ABG")
        f.addPending(key: "wbcAbove15",     label: "WBC > 15 × 10⁹/L — check FBC (worst value in 48 h)",                  source: "FBC")
        f.addPending(key: "calciumBelow2",  label: "Serum calcium < 2.0 mmol/L — check bone profile (48-h worst)",         source: "Bloods")
        f.addPending(key: "albuminBelow32", label: "Serum albumin < 32 g/L — check LFTs / albumin (48-h worst)",           source: "LFTs")
        f.addPending(key: "ldh180",         label: "LDH > 600 IU/L or > 3× ULN — check LDH (48-h worst)",                 source: "Bloods")
        f.addPending(key: "ast100",         label: "AST/ALT > 200 IU/L — check LFTs (48-h worst)",                         source: "LFTs")

        return (i, f)
    }

    // MARK: - ALBI Score

}
