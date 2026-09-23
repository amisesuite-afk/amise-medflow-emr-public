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
        let text = [patient.chiefComplaint, patient.hpi, patient.pmhNotes,
                    patient.assessmentText]
            .compactMap { $0 }.joined(separator: " ").lowercased()

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
        if let vitals = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first {
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

    // MARK: - AIR Score (#70)
    static func airScore(patient: Patient) -> (ClinicalScoringEngine.AIRInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.AIRInput()
        var f = ScoreAutoFill()
        let text = [patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan, patient.pmhNotes]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Vomiting
        let vomitKw = ["vomiting", "nausea and vomiting", "vomited", "emesis", "sick"]
        if vomitKw.contains(where: { text.contains($0) }) {
            i.vomiting = true
            f.addAutoFilled(key: "vomiting", label: "Vomiting keyword detected", source: "History")
        } else {
            f.addPending(key: "vomiting", label: "Vomiting — confirm from history", source: "History")
        }

        // RIF pain
        let rifKw = ["right iliac fossa", "rif", "right lower quadrant", "rlq",
                     "mcburney", "right lower abdominal", "right sided abdominal pain"]
        if rifKw.contains(where: { text.contains($0) }) {
            i.painRIF = true
            f.addAutoFilled(key: "painRIF", label: "Right iliac fossa pain keyword detected", source: "History")
        } else {
            f.addPending(key: "painRIF", label: "Pain in right iliac fossa — confirm on examination", source: "Examination")
        }

        // Temperature
        if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first,
           let temp = v.temperatureCelsius, temp >= 38.5 {
            i.tempAbove38point5 = true
            f.addAutoFilled(key: "tempAbove38point5", label: "Temperature \(temp)°C ≥ 38.5°C from latest vitals", source: "Vitals")
        } else {
            f.addPending(key: "tempAbove38point5", label: "Temperature ≥ 38.5°C — check vitals", source: "Vitals")
        }

        // Rebound tenderness, PMN, WBC, CRP — must be confirmed manually
        f.addPending(key: "reboundTenderness", label: "Rebound tenderness / guarding grade — clinical examination", source: "Examination")
        f.addPending(key: "pmn", label: "PMN % — check FBC differential (polymorphonuclear leucocytes)", source: "Haematology")
        f.addPending(key: "wbc", label: "WBC — check FBC total white cell count", source: "Haematology")
        f.addPending(key: "crp", label: "CRP (mg/L) — check inflammatory markers", source: "Biochemistry")

        return (i, f)
    }

    // MARK: - PERC Rule (#71)
    // MARK: - Hinchey (#69)
    static func hinchey(patient: Patient) -> (ClinicalScoringEngine.HincheyInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.HincheyInput()
        var f = ScoreAutoFill()
        let text = [patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan, patient.pmhNotes]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Grade detection from text
        let grade4Kw = ["faecal peritonitis", "fecal peritonitis", "hinchey 4", "hinchey iv",
                        "hinchey grade 4", "faecal contamination", "fecal contamination"]
        let grade3Kw = ["purulent peritonitis", "hinchey 3", "hinchey iii", "hinchey grade 3",
                        "generalised peritonitis", "generalized peritonitis", "free perforation"]
        let grade2Kw = ["pelvic abscess", "hinchey 2", "hinchey ii", "hinchey grade 2",
                        "distant abscess", "mesenteric abscess"]
        let grade1Kw = ["pericolic abscess", "hinchey 1", "hinchey i ", "hinchey grade 1",
                        "mesorectal abscess", "localised abscess"]

        if grade4Kw.contains(where: { text.contains($0) }) {
            i.grade = 4
            f.addAutoFilled(key: "grade", label: "Hinchey IV (faecal peritonitis) keyword detected", source: "History/Imaging")
        } else if grade3Kw.contains(where: { text.contains($0) }) {
            i.grade = 3
            f.addAutoFilled(key: "grade", label: "Hinchey III (purulent peritonitis) keyword detected", source: "History/Imaging")
        } else if grade2Kw.contains(where: { text.contains($0) }) {
            i.grade = 2
            f.addAutoFilled(key: "grade", label: "Hinchey II (pelvic abscess) keyword detected", source: "History/Imaging")
        } else if grade1Kw.contains(where: { text.contains($0) }) {
            i.grade = 1
            f.addAutoFilled(key: "grade", label: "Hinchey I (pericolic abscess) keyword detected", source: "History/CT")
        } else {
            // Check for diverticulitis context
            let divKw = ["diverticulitis", "diverticular disease", "complicated diverticulitis",
                         "sigmoid diverticulitis", "diverticular abscess", "diverticular perforation"]
            if divKw.contains(where: { text.contains($0) }) {
                f.addPending(key: "grade", label: "Diverticulitis detected — confirm Hinchey grade from CT report", source: "CT Abdomen/Pelvis")
            }
        }

        return (i, f)
    }

    // MARK: - Parkland Formula (#73)
    // MARK: - Paediatric Appendicitis Score (#74)
    static func pas(patient: Patient) -> (ClinicalScoringEngine.PASInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.PASInput()
        var f = ScoreAutoFill()
        let text = [patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan, patient.pmhNotes]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Anorexia
        if ["anorexia", "not eating", "reduced appetite", "loss of appetite", "off food"].contains(where: { text.contains($0) }) {
            i.anorexia = true
            f.addAutoFilled(key: "anorexia", label: "Anorexia keyword detected", source: "History")
        } else { f.addPending(key: "anorexia", label: "Anorexia — confirm from history", source: "History") }

        // Nausea / vomiting
        if ["nausea", "vomiting", "vomit", "nauseous"].contains(where: { text.contains($0) }) {
            i.nausea = true
            f.addAutoFilled(key: "nausea", label: "Nausea/vomiting keyword detected", source: "History")
        } else { f.addPending(key: "nausea", label: "Nausea or vomiting — confirm from history", source: "History") }

        // Migration of pain
        if ["migrat", "moved to right", "moved to rif", "started periumbilical", "periumbilical pain"].contains(where: { text.contains($0) }) {
            i.migration = true
            f.addAutoFilled(key: "migration", label: "Pain migration to RIF keyword detected", source: "History")
        } else { f.addPending(key: "migration", label: "Migration of pain to right iliac fossa — confirm from history", source: "History") }

        // RIF tenderness
        if ["rif tenderness", "right iliac fossa tenderness", "mcburney", "right lower quadrant tender"].contains(where: { text.contains($0) }) {
            i.tendernessRIF = true
            f.addAutoFilled(key: "tendernessRIF", label: "RIF tenderness keyword detected", source: "Examination")
        } else { f.addPending(key: "tendernessRIF", label: "Tenderness in right iliac fossa — confirm on examination", source: "Examination") }

        // Cough/percussion/hop
        if ["rovsing", "cough tenderness", "percussion tenderness", "hop test", "rebound"].contains(where: { text.contains($0) }) {
            i.coughPercussionHop = true
            f.addAutoFilled(key: "coughPercussionHop", label: "Pain with cough/percussion keyword detected", source: "Examination")
        } else { f.addPending(key: "coughPercussionHop", label: "Pain with cough, percussion, or hopping — confirm on examination", source: "Examination") }

        // Pyrexia
        if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first,
           let temp = v.temperatureCelsius, temp >= 38.0 {
            i.pyrexia = true
            f.addAutoFilled(key: "pyrexia", label: "Temperature \(String(format: "%.1f", temp))°C ≥ 38°C from vitals", source: "Vitals")
        } else if text.contains("fever") || text.contains("febrile") || text.contains("pyrexia") {
            i.pyrexia = true
            f.addAutoFilled(key: "pyrexia", label: "Pyrexia keyword detected", source: "History")
        } else { f.addPending(key: "pyrexia", label: "Pyrexia (temperature ≥ 38°C) — check vitals", source: "Vitals") }

        // Leukocytosis (WBC ≥ 10)
        if text.contains("leukocytosis") || text.contains("raised wbc") || text.contains("elevated wbc")
            || text.contains("wbc > 10") || text.contains("wbc ≥ 10") {
            i.leukocytosis = true
            f.addAutoFilled(key: "leukocytosis", label: "Leukocytosis keyword detected", source: "FBC")
        } else { f.addPending(key: "leukocytosis", label: "Leukocytosis (WBC ≥ 10 × 10⁹/L) — check FBC", source: "FBC") }

        // PMN shift
        if text.contains("neutrophilia") || text.contains("left shift") || text.contains("neutrophil > 75")
            || text.contains("pmn > 75") || text.contains("polymorphonuclear") {
            i.polymorphonuclearShift = true
            f.addAutoFilled(key: "polymorphonuclearShift", label: "Polymorphonuclear shift keyword detected", source: "FBC")
        } else { f.addPending(key: "polymorphonuclearShift", label: "PMN leucocyte shift > 75% — check FBC differential", source: "FBC") }

        return (i, f)
    }

    // MARK: - Revised Geneva Score (#75)
    // MARK: - STONE Score
    static func stone(patient: Patient) -> (ClinicalScoringEngine.STONEInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.STONEInput()
        var f = ScoreAutoFill(); f.isAttempted = true
        let text = [patient.chiefComplaint, patient.hpi, patient.assessmentText,
                    patient.workingDiagnosis]
            .compactMap { $0 }.joined(separator: " ").lowercased()
        // Nausea keyword
        let nauseaKw = ["nausea", "vomiting", "nauseous", "vomit"]
        if nauseaKw.contains(where: { text.contains($0) }) {
            i.nausea = true
            f.addAutoFilled(key: "nausea", label: "Nausea/vomiting documented", source: "History/Notes")
        }
        // Haematuria keyword
        let hemKw = ["haematuria", "hematuria", "blood in urine", "frank haematuria"]
        if hemKw.contains(where: { text.contains($0) }) {
            i.erythrocytes = true
            f.addAutoFilled(key: "erythrocytes", label: "Haematuria documented", source: "History/Notes")
        }
        // Stone size and obstruction require CT — mark as pending
        f.addPending(key: "stoneSizeCT", label: "Stone size (mm) on CT KUB — check report",             source: "CT KUB")
        f.addPending(key: "obstruction", label: "Hydronephrosis / ureteric obstruction — check CT KUB", source: "CT KUB")
        return (i, f)
    }

    // MARK: - Los Angeles Classification
    // MARK: - Los Angeles Classification
    static func losAngeles(patient: Patient) -> (ClinicalScoringEngine.LosAngelesInput, ScoreAutoFill) {
        let i = ClinicalScoringEngine.LosAngelesInput()
        var f = ScoreAutoFill(); f.isAttempted = true
        // Grade must be assigned from OGD report — no auto-fill possible
        f.addPending(key: "laGrade", label: "LA Grade (A–D) — record from OGD report", source: "Endoscopy")
        return (i, f)
    }

    // MARK: - MELD 3.0
    static func trueloveWitts(patient: Patient) -> (ClinicalScoringEngine.TruelovewIttsInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.TruelovewIttsInput()
        var f = ScoreAutoFill(); f.isAttempted = true
        let text = [patient.chiefComplaint, patient.hpi, patient.assessmentText]
            .compactMap { $0 }.joined(separator: " ").lowercased()
        // Stool frequency — needs clinical input
        f.addPending(key: "stoolsPerDay", label: "Stool frequency per day — current episode", source: "Clinical")
        // Blood in stool
        if text.contains("blood in stool") || text.contains("bloody stool") || text.contains("haematochezia") || text.contains("rectal bleed") {
            i.macroscopicBlood = true
            f.addAutoFilled(key: "macroscopicBlood", label: "Blood in stool documented", source: "History")
        } else {
            f.addPending(key: "macroscopicBlood", label: "Macroscopic blood in stool — confirm", source: "Examination")
        }
        // HR from vitals
        if let v = patient.vitalsEntries.max(by: { $0.recordedAt < $1.recordedAt }),
           let hr = v.heartRate, hr > 90 {
            i.hrAbove90 = true
            f.addAutoFilled(key: "hrAbove90", label: "HR \(hr) bpm > 90 — from vitals", source: "Vitals")
        } else {
            f.addPending(key: "hrAbove90", label: "Heart rate > 90 bpm — confirm from vitals", source: "Vitals")
        }
        // Temperature from vitals
        if let v = patient.vitalsEntries.max(by: { $0.recordedAt < $1.recordedAt }),
           let t = v.temperatureCelsius, t > 37.5 {
            i.tempAbove375 = true
            f.addAutoFilled(key: "tempAbove375", label: "Temp \(String(format: "%.1f", t))°C > 37.5 — from vitals", source: "Vitals")
        } else {
            f.addPending(key: "tempAbove375", label: "Temperature > 37.5°C — confirm from vitals", source: "Vitals")
        }
        // Haemoglobin and ESR need lab results
        f.addPending(key: "hbBelow105",  label: "Haemoglobin < 10.5 g/dL — lab result required", source: "Labs")
        f.addPending(key: "esrAbove30",  label: "ESR > 30 mm/h — lab result required",            source: "Labs")
        return (i, f)
    }

    // MARK: - Harvey-Bradshaw Index

    static func harveyBradshaw(patient: Patient) -> (ClinicalScoringEngine.HarveyBradshawInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.HarveyBradshawInput()
        var f = ScoreAutoFill(); f.isAttempted = true
        let text = [patient.chiefComplaint, patient.hpi, patient.assessmentText]
            .compactMap { $0 }.joined(separator: " ").lowercased()
        // Wellbeing — patient self-report
        f.addPending(key: "generalWellbeing", label: "General wellbeing (0–4) — patient self-report", source: "Patient")
        // Abdominal pain severity
        let painKw = ["severe abdominal pain", "severe pain", "abdominal pain +++"]
        if painKw.contains(where: { text.contains($0) }) {
            i.abdominalPain = 3
            f.addAutoFilled(key: "abdominalPain", label: "Severe abdominal pain documented", source: "History")
        } else {
            f.addPending(key: "abdominalPain", label: "Abdominal pain (0–3) — confirm severity", source: "History")
        }
        // Liquid stool count
        f.addPending(key: "liquidStoolsPerDay", label: "Liquid stool count per day — current episode", source: "Clinical")
        // Abdominal mass — exam
        f.addPending(key: "abdominalMass", label: "Abdominal mass (0–3) — examination finding", source: "Examination")
        // Complications
        let compKw = ["arthralgia", "arthritis", "uveitis", "erythema nodosum", "pyoderma", "fistula", "abscess"]
        let compCount = compKw.filter { text.contains($0) }.count
        if compCount > 0 {
            i.complications = min(compCount, 10)
            f.addAutoFilled(key: "complications", label: "\(compCount) extraintestinal complication(s) detected", source: "History")
        } else {
            f.addPending(key: "complications", label: "Extraintestinal complications (number) — review history", source: "History")
        }
        return (i, f)
    }

    // MARK: - #93 Maddrey Discriminant Function

    static func maddrey(patient: Patient) -> (ClinicalScoringEngine.MaddreyInput, ScoreAutoFill) {
        let i = ClinicalScoringEngine.MaddreyInput(ptSeconds: 14, controlPTSeconds: 12, bilirubinMgDL: 1.0)
        var f = ScoreAutoFill()
        // PT and bilirubin require laboratory results — always pending
        f.addPending(key: "ptSeconds",        label: "Patient prothrombin time (seconds) — coagulation screen", source: "Labs")
        f.addPending(key: "controlPTSeconds", label: "Control PT / lab reference range (seconds)", source: "Labs")
        f.addPending(key: "bilirubinMgDL",    label: "Serum bilirubin (mg/dL) — LFT result", source: "Labs")
        return (i, f)
    }

    // MARK: - #94 Manning Criteria for IBS

    static func manning(patient: Patient) -> (ClinicalScoringEngine.ManningInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.ManningInput(
            painRelievedByDefecation: false,
            looserStoolsWithOnsetOfPain: false,
            increasedFrequencyWithOnsetOfPain: false,
            abdomenVisiblyDistended: false,
            mucusPerRectum: false,
            feelingOfIncompleteEmptying: false
        )
        var f = ScoreAutoFill()
        let text = [patient.chiefComplaint, patient.hpi, patient.assessmentText]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        if text.contains("relieved by defaec") || text.contains("relieved by bowel") || text.contains("better after stool") {
            i.painRelievedByDefecation = true
            f.addAutoFilled(key: "painRelievedByDefecation", label: "Pain relief with defecation documented", source: "History")
        } else {
            f.addPending(key: "painRelievedByDefecation", label: "Pain relieved by defecation — confirm", source: "History")
        }
        if text.contains("loose stool") || text.contains("liquid stool") || text.contains("diarrhoea with pain") {
            i.looserStoolsWithOnsetOfPain = true
            f.addAutoFilled(key: "looserStoolsWithOnsetOfPain", label: "Looser stools with pain onset documented", source: "History")
        } else {
            f.addPending(key: "looserStoolsWithOnsetOfPain", label: "Looser stools with onset of pain — confirm", source: "History")
        }
        if text.contains("frequent stool") || text.contains("increased frequency") {
            i.increasedFrequencyWithOnsetOfPain = true
            f.addAutoFilled(key: "increasedFrequencyWithOnsetOfPain", label: "Increased stool frequency documented", source: "History")
        } else {
            f.addPending(key: "increasedFrequencyWithOnsetOfPain", label: "Increased frequency with pain — confirm", source: "History")
        }
        if text.contains("distended") || text.contains("bloating") || text.contains("bloated") {
            i.abdomenVisiblyDistended = true
            f.addAutoFilled(key: "abdomenVisiblyDistended", label: "Abdominal distension documented", source: "History")
        } else {
            f.addPending(key: "abdomenVisiblyDistended", label: "Visible abdominal distension — examine", source: "Examination")
        }
        if text.contains("mucus") || text.contains("slime per rectum") {
            i.mucusPerRectum = true
            f.addAutoFilled(key: "mucusPerRectum", label: "Mucus per rectum documented", source: "History")
        } else {
            f.addPending(key: "mucusPerRectum", label: "Mucus per rectum — confirm", source: "History")
        }
        if text.contains("incomplete emptying") || text.contains("tenesmus") {
            i.feelingOfIncompleteEmptying = true
            f.addAutoFilled(key: "feelingOfIncompleteEmptying", label: "Incomplete emptying / tenesmus documented", source: "History")
        } else {
            f.addPending(key: "feelingOfIncompleteEmptying", label: "Feeling of incomplete emptying — confirm", source: "History")
        }
        return (i, f)
    }

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
        let latestV = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first
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

        let latestV = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first

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
        let latestV = patient.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first
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
