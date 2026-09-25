// PatientScoreAutoPopulator+AbdominalGI.swift
// GI / Abdominal Surgery auto-populate functions
// No AI, no network — HIPAA-safe. Surgeon retains full authority.

import Foundation

extension PatientScoreAutoPopulator {

    static func alvarado(patient: Patient) -> (AlvaradoInput, ScoreAutoFill) {
        var i = AlvaradoInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        // Temperature ≥37.3°C from latest vitals
        if let t = patient.latestVitals?.temperatureCelsius, t >= 37.3 {
            i.elevatedTemperature = true; f.autoFieldKeys.insert("elevatedTemperature")
        }

        // WBC >10 ×10⁹/L from labs
        let wbcKw = ["wbc","white blood cell","white cell count","leucocyte","leukocyte"]
        if let wbc = patient.latestLab(named: wbcKw) {
            let val = wbc > 100 ? wbc / 1000 : wbc
            if val > 10 { i.wbcElevated = true; f.autoFieldKeys.insert("wbcElevated") }
        }

        return (i, f)
    }

    // MARK: Tokyo Cholecystitis (from labs)

    static func tokyoCholecystitis(patient: Patient) -> (TokyoCholecystitisInput, ScoreAutoFill) {
        var i = TokyoCholecystitisInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        // WBC >18 ×10⁹/L (Grade I criterion)
        let wbcKw = ["wbc","white blood cell","white cell count","leucocyte","leukocyte"]
        if let wbc = patient.latestLab(named: wbcKw) {
            let val = wbc > 100 ? wbc / 1000 : wbc
            if val > 18 { i.wbcAbove18 = true; f.autoFieldKeys.insert("wbcAbove18") }
        }

        // TG18 Grade III organ dysfunction from vitals, labs and the examination text.
        let organ = tg18OrganDysfunction(patient: patient)
        if organ.cardiovascular { i.cardiovascularDysfunction = true; f.autoFieldKeys.insert("cardiovascularDysfunction") }
        if organ.neurological { i.neurologicalDysfunction = true; f.autoFieldKeys.insert("neurologicalDysfunction") }
        if organ.renal { i.renalDysfunction = true; f.autoFieldKeys.insert("renalDysfunction") }
        if organ.hepatic { i.hepaticDysfunction = true; f.autoFieldKeys.insert("hepaticDysfunction") }
        if organ.haematological { i.haematologicalDysfunction = true; f.autoFieldKeys.insert("haematologicalDysfunction") }

        return (i, f)
    }

    // MARK: Tokyo Cholangitis (from vitals + labs)

    static func tokyoCholangitis(patient: Patient) -> (TokyoCholangitisInput, ScoreAutoFill) {
        var i = TokyoCholangitisInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        // Age >75
        if patient.ageYears > 75 { i.ageAbove75 = true; f.autoFieldKeys.insert("ageAbove75") }

        // Temperature >39°C from latest vitals
        if let t = patient.latestVitals?.temperatureCelsius, t > 39.0 {
            i.temperatureAbove39 = true; f.autoFieldKeys.insert("temperatureAbove39")
        }

        // WBC >12k or <4k ×10⁹/L from labs
        let wbcKw = ["wbc","white blood cell","white cell count","leucocyte","leukocyte"]
        if let wbc = patient.latestLab(named: wbcKw) {
            let val = wbc > 100 ? wbc / 1000 : wbc
            if val > 12 || val < 4 { i.wbcAbove12OrBelow4 = true; f.autoFieldKeys.insert("wbcAbove12OrBelow4") }
        }

        // Bilirubin >85 μmol/L (>5 mg/dL) — same unit inference as elsewhere
        if let bili = patient.latestLab(named: ["bilirubin"]) {
            let umol = bili < 5 ? bili * 17.1 : bili
            if umol > 85 { i.bilirubinAbove5 = true; f.autoFieldKeys.insert("bilirubinAbove5") }
        }

        // TG18 Grade III organ dysfunction from vitals, labs and the examination text.
        let organ = tg18OrganDysfunction(patient: patient)
        if organ.cardiovascular { i.cardiovascularDysfunction = true; f.autoFieldKeys.insert("cardiovascularDysfunction") }
        if organ.neurological { i.neurologicalDysfunction = true; f.autoFieldKeys.insert("neurologicalDysfunction") }
        if organ.renal { i.renalDysfunction = true; f.autoFieldKeys.insert("renalDysfunction") }
        if organ.hepatic { i.hepaticDysfunction = true; f.autoFieldKeys.insert("hepaticDysfunction") }
        if organ.haematological { i.haematologicalDysfunction = true; f.autoFieldKeys.insert("haematologicalDysfunction") }

        return (i, f)
    }

    // MARK: Blatchford (from vitals + labs + sex)

    static func blatchford(patient: Patient) -> (BlatchfordInput, ScoreAutoFill) {
        var i = BlatchfordInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        // Sex
        if patient.sex == .male { i.isMale = true; f.autoFieldKeys.insert("isMale") }

        // BUN / urea → mmol/L; values >50 treated as BUN mg/dL → ÷2.8
        if let urea = patient.latestLab(named: ["urea","blood urea","bun","blood urea nitrogen"]) {
            let mmol = urea > 50 ? urea / 2.8 : urea
            let bun: BlatchfordInput.BlatchfordBUN
            switch mmol {
            case ..<6.5:    bun = .under6_5
            case 6.5..<8.0: bun = .bun6_5to7_9
            case 8.0..<10.0: bun = .bun8to9_9
            case 10.0..<25.0: bun = .bun10to24_9
            default:        bun = .bunOver25
            }
            i.bloodUreaNitrogen = bun; f.autoFieldKeys.insert("bloodUreaNitrogen")
        }

        // Hb (g/dL; values >20 = g/L → ÷10) — sex-aware band selection
        if let hb = patient.latestLab(named: ["haemoglobin","hemoglobin","hgb","hb"]) {
            let gdL = hb > 20 ? hb / 10 : hb
            let isMale = patient.sex == .male
            let hbEnum: BlatchfordInput.BlatchfordHb
            if isMale {
                switch gdL {
                case 13...: hbEnum = .male13plus
                case 12..<13: hbEnum = .male12to12_9
                case 10..<12: hbEnum = .male10to11_9
                default:    hbEnum = .maleSub10
                }
            } else {
                switch gdL {
                case 12...: hbEnum = .female12plus
                case 10..<12: hbEnum = .female10to11_9
                default:    hbEnum = .femaleSub10
                }
            }
            i.haemoglobin = hbEnum; f.autoFieldKeys.insert("haemoglobin")
        }

        // SBP from latest vitals
        if let sbp = patient.latestVitals?.bpSystolic {
            let sbpEnum: BlatchfordInput.BlatchfordSBP
            switch sbp {
            case ..<90:    sbpEnum = .under90
            case 90..<100: sbpEnum = .sbp90to99
            case 100..<110: sbpEnum = .sbp100to109
            default:       sbpEnum = .over109
            }
            i.sbp = sbpEnum; f.autoFieldKeys.insert("sbp")
        }

        // HR >100 from latest vitals
        if let hr = patient.latestVitals?.heartRate, hr > 100 {
            i.heartRateOver100 = true; f.autoFieldKeys.insert("heartRateOver100")
        }

        return (i, f)
    }

    // MARK: NEWS2 (from latest vitals)

    static func aims65(patient: Patient) -> (ClinicalScoringEngine.AIMS65Input, ScoreAutoFill) {
        var i = ClinicalScoringEngine.AIMS65Input()
        var f = ScoreAutoFill(); f.isAttempted = true

        // Age ≥65
        let ageYears = Calendar.current.dateComponents([.year], from: patient.dateOfBirth ?? Date(), to: .now).year ?? 0
        if ageYears >= 65 { i.ageOver65 = true; f.autoFieldKeys.insert("ageOver65") }

        // Systolic BP ≤90 from latest vitals
        if let v = patient.latestVitals, let sbp = v.bpSystolic, sbp <= 90 {
            i.systolicBPUnder90 = true; f.autoFieldKeys.insert("systolicBPUnder90")
        }

        // Lab and clinical values need manual entry
        f.addPending(key: "albuminUnder3",       label: "Albumin <3.0 g/dL",                         source: "LFT / albumin result")
        f.addPending(key: "inrOver1point5",       label: "INR >1.5",                                  source: "Coagulation screen")
        f.addPending(key: "alteredMentalStatus",  label: "Altered mental status (disorientation, hepatic encephalopathy)", source: "Clinical assessment")

        return (i, f)
    }

    // MARK: BISAP (from patient demographics and vitals)

    static func mpi(patient: Patient) -> (MPIInput, ScoreAutoFill) {
        var i = MPIInput()
        var f = ScoreAutoFill()

        // Age >50
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: .now).year ?? 0
            if age > 50 { i.ageOver50 = true; f.autoFieldKeys.insert("ageOver50") }
        }

        // Female sex
        if patient.sex == .female { i.femaleSex = true; f.autoFieldKeys.insert("femaleSex") }

        // Malignancy from PMH keywords
        let cancerKw = ["cancer", "carcinoma", "malignancy", "malignant", "lymphoma", "leukemia",
                        "leukaemia", "sarcoma", "melanoma", "adenocarcinoma", "neoplasm", "tumour", "tumor"]
        if patient.clinicalTextContains(cancerKw) {
            i.malignancy = true; f.autoFieldKeys.insert("malignancy")
        }

        // Pending: operative and haemodynamic findings require intraoperative data
        f.addPending(key: "organFailure",
            label: "Organ failure (BP <80 mmHg, creatinine >177 µmol/L, or respiratory failure)",
            source: "Haemodynamic / laboratory assessment")
        f.addPending(key: "durationOver24h",
            label: "Peritonitis duration >24 h before operation",
            source: "History / operative note")
        f.addPending(key: "nonColonicOrigin",
            label: "Non-colonic source (gastric, duodenal, or small bowel)",
            source: "Operative findings")
        f.addPending(key: "generalizedPeritonitis",
            label: "Generalised 4-quadrant peritonitis",
            source: "Operative findings")
        f.addPending(key: "exudate",
            label: "Exudate character (serous / purulent / faecal)",
            source: "Operative findings")

        return (i, f)
    }

    // MARK: - NRS-2002 (Nutritional Risk Screening 2002)

    static func forrest(patient: Patient) -> (ForrestInput, ScoreAutoFill) {
        let i = ForrestInput()
        var f = ScoreAutoFill()
        // Forrest grade requires direct endoscopic visualisation — no auto-fill possible
        f.addPending(key: "grade",
            label: "Forrest grade (Ia–III) — requires upper GI endoscopy report",
            source: "Endoscopy report")
        return (i, f)
    }

    // MARK: - GRACE Score (ACS Mortality)

    // MARK: - Oakland Score (LGIB)
    static func oakland(patient: Patient) -> (ClinicalScoringEngine.OaklandInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.OaklandInput()
        var f = ScoreAutoFill()
        let text = ScoreText([patient.chiefComplaint, patient.hpi, patient.pmhNotes,
                    patient.assessmentText])

        // Age
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: Date()).year ?? 0
            if age >= 70 {
                i.ageScore = 2
                f.addAutoFilled(key: "ageScore", label: "Age ≥70 (+2)", source: "Date of birth")
            } else if age >= 40 {
                i.ageScore = 1
                f.addAutoFilled(key: "ageScore", label: "Age 40–69 (+1)", source: "Date of birth")
            } else {
                i.ageScore = 0
                f.addAutoFilled(key: "ageScore", label: "Age <40 (+0)", source: "Date of birth")
            }
        } else {
            f.addPending(key: "ageScore", label: "Age — enter date of birth", source: "Demographics")
        }

        // Sex
        if patient.sex == .male {
            i.sexMale = true
            f.addAutoFilled(key: "sexMale", label: "Male sex (+1)", source: "Demographics")
        } else {
            f.addAutoFilled(key: "sexMale", label: "Female sex (+0)", source: "Demographics")
        }

        // Previous LGIB
        let prevLGIBKeywords = ["previous lower gi bleed", "previous lgib", "previous rectal bleed",
                                 "previous pr bleed", "previous haematochezia", "prior lower gi"]
        if prevLGIBKeywords.contains(where: { text.contains($0) }) {
            i.previousLGIB = true
            f.addAutoFilled(key: "previousLGIB", label: "Previous LGIB detected (+1)", source: "PMH")
        }

        // Haemochezia / PR bleed keywords
        let lgibKeywords = ["lower gi bleed", "lgib", "rectal bleed", "pr bleed",
                            "haematochezia", "bright red blood per rectum", "brbpr",
                            "melaena", "per rectum", "rectal haemorrhage"]
        if !lgibKeywords.contains(where: { text.contains($0) }) {
            f.addPending(key: "dre", label: "Digital rectal examination — document findings", source: "Clinical examination")
        } else {
            f.addPending(key: "dre", label: "DRE result — blood present on examination?", source: "Physical examination")
        }

        // Vitals
        if let vitals = patient.latestVitals {
            if let hr = vitals.heartRate {
                if hr >= 90 { i.heartRate = 2 } else if hr >= 70 { i.heartRate = 1 }
                f.addAutoFilled(key: "heartRate", label: "Heart rate \(hr) bpm from latest vitals", source: "Vitals")
            }
            if let sbp = vitals.bpSystolic {
                if sbp < 100 { i.sbp = 3 } else if sbp < 130 { i.sbp = 2 } else if sbp < 160 { i.sbp = 1 }
                f.addAutoFilled(key: "sbp", label: "SBP \(sbp) mmHg from latest vitals", source: "Vitals")
            }
        }

        f.addPending(key: "hbScore", label: "Haemoglobin (g/dL) — enter FBC result", source: "Laboratory")
        return (i, f)
    }

}
