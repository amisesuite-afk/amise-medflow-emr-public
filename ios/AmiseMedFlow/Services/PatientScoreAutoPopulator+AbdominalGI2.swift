// PatientScoreAutoPopulator+AbdominalGI2.swift
// AIR Score, PERC Rule, Hinchey, Parkland, PAS, Revised Geneva, STONE Score.
// No AI, no network calls — HIPAA-safe.

import Foundation

extension PatientScoreAutoPopulator {

    // MARK: - AIR Score (#70)
    static func airScore(patient: Patient) -> (ClinicalScoringEngine.AIRInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.AIRInput()
        var f = ScoreAutoFill()
        let text = ScoreText([patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan, patient.pmhNotes])

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
        if let v = patient.latestVitals,
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
        let text = ScoreText([patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan, patient.pmhNotes])

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
        let text = ScoreText([patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan, patient.pmhNotes])

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
        if let v = patient.latestVitals,
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
        let text = ScoreText([patient.chiefComplaint, patient.hpi, patient.assessmentText,
                    patient.workingDiagnosis])
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
        let text = ScoreText([patient.chiefComplaint, patient.hpi, patient.assessmentText])
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
        let text = ScoreText([patient.chiefComplaint, patient.hpi, patient.assessmentText])
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
        let text = ScoreText([patient.chiefComplaint, patient.hpi, patient.assessmentText])

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

}
