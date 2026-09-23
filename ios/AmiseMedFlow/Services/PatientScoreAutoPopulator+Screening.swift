// PatientScoreAutoPopulator+Screening.swift
// Screening / Multidisciplinary auto-populate functions
// No AI, no network — HIPAA-safe. Surgeon retains full authority.

import Foundation

extension PatientScoreAutoPopulator {

    static func nrs2002(patient: Patient) -> (NRS2002Input, ScoreAutoFill) {
        var i = NRS2002Input()
        var f = ScoreAutoFill()

        // Age ≥70
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: .now).year ?? 0
            if age >= 70 { i.ageOver70 = true; f.autoFieldKeys.insert("ageOver70") }
        }

        // Disease severity from setting / surgical context
        let seriousKw = ["major abdominal", "laparotomy", "bowel resection", "colectomy",
                         "gastrectomy", "oesophagectomy", "pancreatectomy", "hepatectomy",
                         "stroke", "head injury", "bone marrow"]
        let minorKw = ["chemotherapy", "dialysis", "haemodialysis", "chronic obstructive",
                       "liver cirrhosis", "diabetes", "hip fracture"]
        let allText = [patient.chiefComplaint, patient.hpi, patient.workingDiagnosis,
                       patient.pmhNotes, patient.assessmentText,
                       patient.managementPlan].compactMap { $0 }.joined(separator: " ").lowercased()
        if seriousKw.contains(where: { allText.contains($0) }) {
            i.diseaseSeverity = 2; f.autoFieldKeys.insert("diseaseSeverity")
        } else if minorKw.contains(where: { allText.contains($0) }) {
            i.diseaseSeverity = 1; f.autoFieldKeys.insert("diseaseSeverity")
        }

        // Pending: nutritional status requires bedside assessment (weight, BMI, intake history)
        f.addPending(key: "nutritionalStatus",
            label: "Nutritional status — assess weight loss, BMI, and recent oral intake",
            source: "Dietitian / nursing assessment")

        return (i, f)
    }

    // MARK: - CTSI (Balthazar CT Severity Index)

    static func barthel(patient: Patient) -> (BarthelInput, ScoreAutoFill) {
        var i = BarthelInput()
        var f = ScoreAutoFill()
        let allText = [patient.chiefComplaint, patient.hpi, patient.assessmentText,
                       patient.examGeneral, patient.pmhNotes, patient.notes, patient.managementPlan]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Continence — urinary
        if allText.contains("continent") || allText.contains("no incontinence") ||
           allText.contains("voiding normally") {
            i.bladder = 10
            f.addAutoFilled(key: "bladder", label: "Urinary continence suggested — confirm with patient", source: "Clinical text")
        } else if allText.contains("incontinen") || allText.contains("urinary incontinen") ||
                  allText.contains("catheterised") || allText.contains("catheter") {
            i.bladder = 0
            f.addAutoFilled(key: "bladder", label: "Urinary incontinence or catheter detected — verify", source: "Clinical text")
        }

        // Bowels
        if allText.contains("bowel incontinence") || allText.contains("faecal incontinence") ||
           allText.contains("fecal incontinence") || allText.contains("doubly incontinen") {
            i.bowels = 0
            f.addAutoFilled(key: "bowels", label: "Bowel incontinence detected — verify", source: "Clinical text")
        }

        // Mobility
        if allText.contains("bedbound") || allText.contains("bed-bound") ||
           allText.contains("immobile") || allText.contains("non-ambulatory") ||
           allText.contains("unable to walk") {
            i.mobility = 0
            i.transfers = 0
            f.addAutoFilled(key: "mobility", label: "Immobility detected — confirm with nursing assessment", source: "Clinical text")
            f.addAutoFilled(key: "transfers", label: "Transfer dependency inferred from immobility — verify", source: "Clinical text")
        } else if allText.contains("wheelchair") {
            i.mobility = 5
            f.addAutoFilled(key: "mobility", label: "Wheelchair use detected — confirm independence level", source: "Clinical text")
        } else if allText.contains("walks independently") || allText.contains("mobile") ||
                  allText.contains("ambulat") && allText.contains("independent") {
            i.mobility = 15
            f.addAutoFilled(key: "mobility", label: "Independent mobility suggested — confirm with patient", source: "Clinical text")
        }

        // Fully independent — document notes independent in ADLs
        if allText.contains("independent in adl") || allText.contains("fully independent") ||
           allText.contains("self-caring") || allText.contains("self caring") {
            i.feeding = 10; i.bathing = 5; i.grooming = 5; i.dressing = 10
            i.bowels = 10; i.bladder = 10; i.toiletUse = 10
            i.transfers = 15; i.mobility = 15; i.stairs = 10
            f.addAutoFilled(key: "feeding", label: "Independent ADLs suggested — verify all Barthel items with patient", source: "Clinical text")
        }

        // Dementia or major neurological impairment — likely dependency
        if allText.contains("dementia") || allText.contains("alzheimer") ||
           allText.contains("severe cognitive") || allText.contains("severe stroke") {
            if i.feeding == 0 { f.addPending(key: "feeding", label: "Dementia/cognitive impairment: feeding — may be dependent; assess", source: "Clinical text / nursing") }
        }

        // Mark remaining fields pending if not auto-filled
        let filledKeys = f.autoFieldKeys
        let pendingFields: [(String, String)] = [
            ("feeding", "Feeding ability — requires nursing or OT assessment"),
            ("bathing", "Bathing ability — requires nursing or OT assessment"),
            ("grooming", "Grooming ability — requires nursing or OT assessment"),
            ("dressing", "Dressing ability — requires nursing or OT assessment"),
            ("bowels", "Bowel continence — requires nursing assessment"),
            ("bladder", "Bladder continence — requires nursing assessment"),
            ("toiletUse", "Toilet use ability — requires nursing or OT assessment"),
            ("transfers", "Transfer ability (bed-chair) — requires nursing or physiotherapy assessment"),
            ("mobility", "Mobility (level ground) — requires physiotherapy assessment"),
            ("stairs", "Stair climbing ability — requires physiotherapy assessment")
        ]
        for (key, label) in pendingFields where !filledKeys.contains(key) {
            f.addPending(key: key, label: label, source: "Clinical/nursing assessment")
        }
        return (i, f)
    }

    // MARK: - DASI (Duke Activity Status Index)

    static func nihss(patient: Patient) -> (NIHSSInput, ScoreAutoFill) {
        var i = NIHSSInput()
        var f = ScoreAutoFill()

        let allText = [patient.chiefComplaint, patient.hpi, patient.assessmentText,
                       patient.examNeuro, patient.notes]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Consciousness level — infer from documented GCS or clinical state
        if allText.contains("unresponsive") || allText.contains("gcs 3") || allText.contains("gcs 4") || allText.contains("gcs 5") {
            i.consciousness = 3
            f.addAutoFilled(key: "consciousness3", label: "Unresponsive / GCS ≤5 documented", source: "Clinical notes")
        } else if allText.contains("obtunded") || allText.contains("gcs 6") || allText.contains("gcs 7") || allText.contains("gcs 8") {
            i.consciousness = 2
            f.addAutoFilled(key: "consciousness2", label: "Obtunded / GCS 6–8 documented", source: "Clinical notes")
        } else if allText.contains("drowsy") || allText.contains("somnolent") || allText.contains("lethargic") {
            i.consciousness = 1
            f.addAutoFilled(key: "consciousness1", label: "Drowsy/somnolent documented", source: "Clinical notes")
        }

        // Motor — if hemiplegia/hemiparesis mentioned, flag laterality
        if allText.contains("left hemiplegia") || allText.contains("left-sided weakness") || allText.contains("left arm weakness") {
            i.motorArmLeft = 4
            i.motorLegLeft = 4
            f.addAutoFilled(key: "leftMotorplegia", label: "Left hemiplegia documented — motor arm/leg left set to 4 (no movement); verify at bedside", source: "Clinical notes")
        } else if allText.contains("left hemiparesis") {
            i.motorArmLeft = 2
            i.motorLegLeft = 2
            f.addAutoFilled(key: "leftMotorparesis", label: "Left hemiparesis documented — motor arm/leg left set to 2; verify at bedside", source: "Clinical notes")
        }
        if allText.contains("right hemiplegia") || allText.contains("right-sided weakness") || allText.contains("right arm weakness") {
            i.motorArmRight = 4
            i.motorLegRight = 4
            f.addAutoFilled(key: "rightMotorplegia", label: "Right hemiplegia documented — motor arm/leg right set to 4 (no movement); verify at bedside", source: "Clinical notes")
        } else if allText.contains("right hemiparesis") {
            i.motorArmRight = 2
            i.motorLegRight = 2
            f.addAutoFilled(key: "rightMotorparesis", label: "Right hemiparesis documented — motor arm/leg right set to 2; verify at bedside", source: "Clinical notes")
        }

        // Aphasia — language item
        if allText.contains("global aphasia") || allText.contains("mute") {
            i.language = 3
            f.addAutoFilled(key: "language3", label: "Global aphasia / mute documented", source: "Clinical notes")
        } else if allText.contains("severe aphasia") {
            i.language = 2
            f.addAutoFilled(key: "language2", label: "Severe aphasia documented", source: "Clinical notes")
        } else if allText.contains("aphasia") || allText.contains("dysphasia") {
            i.language = 1
            f.addAutoFilled(key: "language1", label: "Aphasia / dysphasia documented", source: "Clinical notes")
        }

        // Dysarthria
        if allText.contains("dysarthria") || allText.contains("slurred speech") {
            i.dysarthria = 1
            f.addAutoFilled(key: "dysarthria1", label: "Dysarthria / slurred speech documented", source: "Clinical notes")
        }

        // Most NIHSS items require direct bedside neurological examination — mark as pending
        f.addPending(key: "locQuestions", label: "1b. LOC questions — ask month and age at bedside", source: "Bedside exam")
        f.addPending(key: "locCommands", label: "1c. LOC commands — test eye opening and grip at bedside", source: "Bedside exam")
        f.addPending(key: "gazeDeviation", label: "2. Best gaze — assess horizontal eye movements", source: "Bedside exam")
        f.addPending(key: "visualFields", label: "3. Visual fields — confrontation testing required", source: "Bedside exam")
        f.addPending(key: "facialPalsy", label: "4. Facial palsy — observe facial symmetry", source: "Bedside exam")
        f.addPending(key: "limbAtaxia", label: "7. Limb ataxia — finger-nose-finger and heel-shin tests", source: "Bedside exam")
        f.addPending(key: "sensory", label: "8. Sensory — pinprick testing both sides", source: "Bedside exam")
        f.addPending(key: "extinction", label: "11. Extinction/inattention — double simultaneous stimulation", source: "Bedside exam")

        return (i, f)
    }

    // MARK: - MUST (Malnutrition Universal Screening Tool)

    static func must(patient: Patient) -> (ClinicalScoringEngine.MUSTInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.MUSTInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        // BMI score: derive from latest weight + stored height if available
        // Patient stores BMI indirectly via vitals weight; height not a dedicated field, so
        // we leave bmiScore as pending unless explicitly stored
        let latestWeight = patient.vitalsEntries
            .sorted { ($0.recordedAt) > ($1.recordedAt) }
            .compactMap { $0.weightKg }
            .first

        if let wt = latestWeight {
            // Without height we cannot compute BMI — surface weight as context but mark pending
            _ = wt
        }
        f.addPending(key: "bmiScore", label: "1. BMI category (>20 / 18.5–20 / <18.5 kg/m²) — weigh and measure height", source: "Measure at bedside")

        // Weight loss score: detect keywords in PMH / HPI / assessment text
        let text = ([patient.hpi, patient.pmhNotes, patient.chiefComplaint,
                     patient.assessmentText, patient.workingDiagnosis]
                    .compactMap { $0 } + patient.pmhEntries.map(\.condition))
                   .joined(separator: " ").lowercased()

        if text.contains("weight loss") || text.contains("losing weight") || text.contains("unintentional weight") {
            if text.contains(">10%") || text.contains("significant weight loss") || text.contains("severe weight loss") || text.contains("cachex") {
                i.weightLossScore = 2; f.addAutoFilled(key: "weightLossScore", label: "Weight loss >10% from clinical text", source: "PMH / clinical text")
            } else if text.contains("5%") || text.contains("10%") || text.contains("moderate weight loss") {
                i.weightLossScore = 1; f.addAutoFilled(key: "weightLossScore", label: "Weight loss 5–10% from clinical text", source: "PMH / clinical text")
            } else {
                // Unspecified weight loss — flag as pending for clinician to quantify
                f.addPending(key: "weightLossScore", label: "2. Weight loss magnitude (unspecified in notes) — quantify % over 3–6 months", source: "PMH / clinical text mentions weight loss")
            }
        } else {
            f.addPending(key: "weightLossScore", label: "2. Unintentional weight loss percentage over past 3–6 months", source: "Review patient history")
        }

        // Acute disease effect: acutely ill with likely nil/negligible oral intake >5 days
        let acuteIllKeywords = ["npo", "nil by mouth", "bowel obstruction", "ileus",
                                "icu", "critical care", "intensive care", "ventilat",
                                "unable to eat", "unable to swallow", "dysphagia",
                                "post-operative day", "post op day", "intubat"]
        if acuteIllKeywords.contains(where: { text.contains($0) }) {
            i.acuteDiseaseScore = 2
            f.addAutoFilled(key: "acuteDiseaseScore", label: "Acute disease effect (+2) — nil/negligible intake likely >5 days detected from clinical text", source: "HPI / clinical text")
        } else {
            f.addPending(key: "acuteDiseaseScore", label: "3. Acute disease effect — is patient acutely ill with no nutrition for >5 days?", source: "Clinical assessment")
        }

        return (i, f)
    }

    // MARK: - 4T Score (HIT)
    // MARK: - ECOG Performance Status (#57)
    static func ecog(patient: Patient) -> (ClinicalScoringEngine.ECOGInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.ECOGInput()
        var f = ScoreAutoFill()
        let text = [patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan, patient.pmhNotes]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Grade 4 keywords — bedbound
        let g4Kw = ["bedbound", "bed-bound", "bed bound", "completely disabled", "fully dependent",
                    "palliative", "terminally ill", "end of life", "end-of-life"]
        // Grade 3 keywords — limited self-care
        let g3Kw = ["limited self care", "confined to bed", "more than 50%", "housebound", "cannot walk"]
        // Grade 2 keywords — ambulatory but no work
        let g2Kw = ["ambulatory", "self-care", "cannot carry out work", "performance status 2",
                    "ps 2", "ecog 2", "zubrod 2", "cannot work", "significant fatigue",
                    "cancer", "malignancy", "carcinoma", "lymphoma", "sarcoma", "metastatic"]
        // Grade 1 keywords — restricted but working
        let g1Kw = ["restricted activity", "strenuous activity limited", "performance status 1",
                    "ps 1", "ecog 1", "zubrod 1", "light work", "frailty", "sarcopenia",
                    "deconditioning", "cachexia"]

        if g4Kw.contains(where: { text.contains($0) }) {
            i.grade = 4
            f.addAutoFilled(key: "grade", label: "Grade 4 — bedbound indicators detected", source: "History/Diagnosis")
        } else if g3Kw.contains(where: { text.contains($0) }) {
            i.grade = 3
            f.addAutoFilled(key: "grade", label: "Grade 3 — limited self-care indicators detected", source: "History")
        } else if g2Kw.contains(where: { text.contains($0) }) {
            i.grade = 2
            f.addAutoFilled(key: "grade", label: "Grade 2 — ambulatory/cancer keywords detected; confirm with clinical assessment", source: "Diagnosis")
        } else if g1Kw.contains(where: { text.contains($0) }) {
            i.grade = 1
            f.addAutoFilled(key: "grade", label: "Grade 1 — restricted activity keywords detected; confirm clinically", source: "History")
        } else {
            f.addPending(key: "grade", label: "ECOG grade requires direct clinical assessment", source: "Clinical examination")
        }
        return (i, f)
    }

    // MARK: - Revised Trauma Score (#58)
    // MARK: - AUDIT-C
    static func auditC(patient: Patient) -> (ClinicalScoringEngine.AUDITCInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.AUDITCInput()
        var f = ScoreAutoFill(); f.isAttempted = true
        let text = [patient.chiefComplaint, patient.hpi, patient.assessmentText,
                    patient.pmhNotes, patient.workingDiagnosis]
            .compactMap { $0 }.joined(separator: " ").lowercased()
        // Sex from patient model
        if patient.sex == .female { i.isFemale = true }
        // Alcohol use disorder keyword hints — if positive, set highest category as auto-filled
        let alcoholDisorderKw = ["alcohol use disorder", "alcohol dependence", "alcoholic liver",
                                 "alcoholic pancreatitis", "delirium tremens", "dt's", "wernicke"]
        if alcoholDisorderKw.contains(where: { text.contains($0) }) {
            i.frequency    = 4  // ≥4×/week
            i.typicalDrinks = 3  // 7–9 drinks
            i.bingeDrinks  = 3  // weekly binge
            f.addAutoFilled(key: "frequency", label: "Alcohol use disorder/dependence documented — maximum category pre-set", source: "History/PMH")
        } else {
            // All 3 questions are self-reported; mark as pending
            f.addPending(key: "q1frequency",    label: "Q1 — How often do you drink alcohol?",                        source: "Patient")
            f.addPending(key: "q2typical",      label: "Q2 — How many drinks on a typical drinking day?",             source: "Patient")
            f.addPending(key: "q3binge",        label: "Q3 — How often do you have 6 or more drinks on one occasion?", source: "Patient")
        }
        return (i, f)
    }

    // MARK: - PHQ-9
    // MARK: - PHQ-9
    static func phq9(patient: Patient) -> (ClinicalScoringEngine.PHQ9Input, ScoreAutoFill) {
        var i = ClinicalScoringEngine.PHQ9Input()
        var f = ScoreAutoFill(); f.isAttempted = true
        let text = [patient.chiefComplaint, patient.hpi, patient.assessmentText,
                    patient.pmhNotes, patient.workingDiagnosis]
            .compactMap { $0 }.joined(separator: " ").lowercased()
        // Documented severe depression / suicidal ideation — flag Q6 & Q9
        let severeKw = ["severe depression", "suicidal", "self-harm", "self harm", "overdose attempt"]
        if severeKw.contains(where: { text.contains($0) }) {
            i.depressedMood = 3; i.anhedonia = 3; i.suicidalThought = 2
            f.addAutoFilled(key: "depressedMood", label: "Severe depression/suicidal ideation documented — key items pre-set", source: "History")
        } else {
            // PHQ-9 is a patient-reported questionnaire — all items need clinician-assisted completion
            let phqItems = ["anhedonia","depressedMood","sleepProblem","fatigue","appetiteChange",
                            "selfWorth","concentration","psychomotor","suicidalThought"]
            for key in phqItems {
                f.addPending(key: key, label: "PHQ-9 item — requires patient self-report", source: "Patient")
            }
        }
        return (i, f)
    }

    // MARK: - SAPS II
    static func ipss(patient: Patient) -> (ClinicalScoringEngine.IPSSInput, ScoreAutoFill) {
        let i = ClinicalScoringEngine.IPSSInput()
        var f = ScoreAutoFill(); f.isAttempted = true
        // IPSS requires direct patient self-report; all items pending
        let items: [(String, String)] = [
            ("incompleteEmptying", "Incomplete bladder emptying (0–5)"),
            ("frequency",          "Urinary frequency (0–5)"),
            ("intermittency",      "Intermittency of stream (0–5)"),
            ("urgency",            "Urgency (0–5)"),
            ("weakStream",         "Weak stream (0–5)"),
            ("straining",          "Straining to void (0–5)"),
            ("nocturia",           "Nocturia frequency (0–5)"),
            ("qualityOfLife",      "Quality of life (0–6)"),
        ]
        for (key, label) in items {
            f.addPending(key: key, label: "\(label) — patient self-report required", source: "Patient")
        }
        return (i, f)
    }

}
