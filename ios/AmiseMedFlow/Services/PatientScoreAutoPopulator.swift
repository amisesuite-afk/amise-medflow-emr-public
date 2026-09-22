// PatientScoreAutoPopulator.swift
// Derives clinical score input values deterministically from structured patient data.
// No AI, no network — HIPAA-safe. Surgeon retains full authority over all values.

import Foundation

// MARK: - Auto-fill metadata

struct PendingScoreField: Identifiable {
    let id: String     // same as key — unique per score
    let label: String
    let source: String
}

struct ScoreAutoFill {
    /// Field keys whose values were set from patient data (not blank defaults).
    var autoFieldKeys: Set<String> = []
    /// Fields that could not be determined and need clinical attention.
    var pendingFields: [PendingScoreField] = []
    /// True when the populator was called for this score (not just its default state).
    var isAttempted: Bool = false

    var hasPending: Bool { isAttempted && !pendingFields.isEmpty }
    func isAuto(_ key: String) -> Bool { autoFieldKeys.contains(key) }

    mutating func addPending(key: String, label: String, source: String) {
        pendingFields.append(PendingScoreField(id: key, label: label, source: source))
    }

    mutating func addAutoFilled(key: String, label: String = "", source: String = "") {
        autoFieldKeys.insert(key)
    }
}

// MARK: - Patient data helpers (module-internal)

private extension Patient {
    /// Searches PMH entries, PMH notes, HPI, CC, and working diagnosis for keywords.
    func clinicalTextContains(_ keywords: [String]) -> Bool {
        let blocks = ([pmhNotes, hpi, chiefComplaint, workingDiagnosis, assessmentText]
            .compactMap { $0 }
            + pmhEntries.map(\.condition))
            .joined(separator: " ")
            .lowercased()
        return keywords.contains { blocks.contains($0) }
    }

    func prescriptionsContain(_ keywords: [String]) -> Bool {
        let text = prescriptions
            .map { "\($0.drug) \($0.indication)".lowercased() }
            .joined(separator: " ")
        return keywords.contains { text.contains($0) }
    }

    var isSurgicalVisit: Bool {
        guard let vt = visitType else { return false }
        return vt == .surgeryElective || vt == .surgeryEmergency || vt == .dayOfSurgery
    }

    var isLaparoscopicProcedure: Bool {
        let n = surgeryData.procedureName.lowercased()
        return n.contains("laparoscop") || n.contains("keyhole") || n.contains("minimal")
    }

    var latestVitals: VitalsEntry? {
        vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first
    }

    func latestLab(named keywords: [String]) -> Double? {
        let match = investigations
            .filter { $0.status == .resulted }
            .filter { inv in keywords.contains { inv.name.lowercased().contains($0) } }
            .sorted { ($0.resultedAt ?? $0.orderedAt) < ($1.resultedAt ?? $1.orderedAt) }
            .last
        guard let entry = match else { return nil }
        return parseLabNumber(entry.result)
    }

    func parseLabNumber(_ text: String) -> Double? {
        var numStr = ""
        var foundDigit = false
        for scalar in text.unicodeScalars {
            let c = Character(scalar)
            if c.isNumber { numStr.append(c); foundDigit = true }
            else if c == "." && foundDigit { numStr.append(c) }
            else if foundDigit { break }
        }
        return foundDigit ? Double(numStr) : nil
    }

    // Returns creatinine in μmol/L, inferring units: value < 15 → mg/dL (×88.42), ≥ 15 → μmol/L
    func creatinineUmolL() -> Double? {
        guard let raw = latestLab(named: ["creatinine"]) else { return nil }
        return raw < 15 ? raw * 88.42 : raw
    }
}

// MARK: - Populator

enum PatientScoreAutoPopulator {

    // MARK: Caprini VTE Risk

    static func caprini(patient: Patient) -> (CapriniInput, ScoreAutoFill) {
        var i = CapriniInput()
        var f = ScoreAutoFill(); f.isAttempted = true
        let age = patient.ageYears

        // Age band (mutually exclusive)
        if age >= 75      { i.ageOver75  = true; f.autoFieldKeys.insert("ageOver75") }
        else if age >= 60 { i.age60to74  = true; f.autoFieldKeys.insert("age60to74") }
        else if age >= 41 { i.age41to59  = true; f.autoFieldKeys.insert("age41to59") }

        // BMI ≥40
        if let bmi = patient.latestBMI(), bmi >= 40 {
            i.bmi40Plus = true; f.autoFieldKeys.insert("bmi40Plus")
        }

        // Malignancy
        let cancerKw = ["cancer","carcinoma","malignancy","malignant","lymphoma","leukemia",
                        "leukaemia","sarcoma","melanoma","adenocarcinoma","neoplasm","tumour","tumor","metastas"]
        if patient.clinicalTextContains(cancerKw) {
            i.activeOrPriorMalignancy = true; f.autoFieldKeys.insert("activeOrPriorMalignancy")
        }

        // Prior VTE
        let vteKw = ["dvt","deep vein thrombosis","deep venous thrombosis",
                     "pulmonary embolism","vte","thromboembolism"]
        if patient.clinicalTextContains(vteKw) {
            i.priorVTE = true; f.autoFieldKeys.insert("priorVTE")
        }

        // Thrombophilia
        let thrKw = ["thrombophilia","factor v leiden","protein c deficiency",
                     "protein s deficiency","antiphospholipid","antithrombin deficiency"]
        if patient.clinicalTextContains(thrKw) {
            i.thrombophilia = true; f.autoFieldKeys.insert("thrombophilia")
        }

        // High-risk past events
        if patient.clinicalTextContains(["stroke","cva","cerebrovascular accident"]) {
            i.stroke = true; f.autoFieldKeys.insert("stroke")
        }
        if patient.clinicalTextContains(["myocardial infarction","heart attack","nstemi","stemi"," mi "]) {
            i.mi = true; f.autoFieldKeys.insert("mi")
        }
        if patient.clinicalTextContains(["spinal cord injury","paraplegia","quadriplegia","tetraplegia"]) {
            i.spinalCordInjury = true; f.autoFieldKeys.insert("spinalCordInjury")
        }

        // Surgery type
        if patient.isSurgicalVisit {
            if patient.isLaparoscopicProcedure {
                i.laparoscopicSurgeryOver45min = true; f.autoFieldKeys.insert("laparoscopicSurgeryOver45min")
            } else {
                i.majorSurgery = true; f.autoFieldKeys.insert("majorSurgery")
            }
        }

        // Hormonal therapy / OCP / aromatase inhibitors
        let hormKw = ["ocp","contraceptive","estrogen","oestrogen","hrt","hormone replacement",
                      "tamoxifen","raloxifene","letrozole","anastrozole","progesterone"]
        if patient.prescriptionsContain(hormKw) {
            i.hormonalTherapy = true; f.autoFieldKeys.insert("hormonalTherapy")
        }

        // Pending fields the surgeon must confirm
        if !f.isAuto("priorVTE") {
            f.addPending(key: "priorVTE",
                label: "Prior VTE (DVT / PE) — not found in PMH",
                source: "Ask patient")
        }
        if !f.isAuto("thrombophilia") {
            f.addPending(key: "thrombophilia",
                label: "Known thrombophilia (Factor V Leiden, APS, etc.)",
                source: "Ask patient / haematology records")
        }
        f.addPending(key: "familyHistoryVTE",
            label: "Family history of VTE (first-degree relative)",
            source: "Ask patient")
        f.addPending(key: "centralVenousAccess",
            label: "Central venous access (CVP line, PICC, port)",
            source: "Examine / review chart")
        f.addPending(key: "immobilityBedridden",
            label: "Immobility / bed-rest expected ≥3 days",
            source: "Clinical assessment")
        f.addPending(key: "sepsis30d",
            label: "Sepsis episode within the last 30 days",
            source: "Review recent notes")

        return (i, f)
    }

    // MARK: Wells DVT

    static func wellsDVT(patient: Patient) -> (WellsDVTInput, ScoreAutoFill) {
        var i = WellsDVTInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        let cancerKw = ["cancer","carcinoma","malignancy","malignant","lymphoma","leukemia",
                        "leukaemia","sarcoma","melanoma","adenocarcinoma","neoplasm","tumour","tumor"]
        if patient.clinicalTextContains(cancerKw) {
            i.activeCancer = true; f.autoFieldKeys.insert("activeCancer")
        }
        if patient.clinicalTextContains(["dvt","deep vein thrombosis","deep venous thrombosis"]) {
            i.previousDVT = true; f.autoFieldKeys.insert("previousDVT")
        }
        if patient.isSurgicalVisit {
            i.bedridden3dOrSurgery12w = true; f.autoFieldKeys.insert("bedridden3dOrSurgery12w")
        }

        f.addPending(key: "localizedTendernessDeepVein",
            label: "Localised tenderness along deep vein",
            source: "Clinical examination")
        f.addPending(key: "entireLegSwollen",
            label: "Entire leg swollen",
            source: "Clinical examination")
        f.addPending(key: "calfSwellingOver3cm",
            label: "Calf swelling >3 cm vs contralateral side",
            source: "Measure both calves")
        f.addPending(key: "pittingOedema",
            label: "Pitting oedema (more in suspected leg)",
            source: "Clinical examination")
        f.addPending(key: "collateralSuperficialVeins",
            label: "Non-varicose collateral superficial veins",
            source: "Clinical examination")
        f.addPending(key: "paralysisParesisPlastercast",
            label: "Paralysis, paresis, or recent plaster cast",
            source: "Ask patient / review")

        return (i, f)
    }

    // MARK: Wells PE

    static func wellsPE(patient: Patient) -> (WellsPEInput, ScoreAutoFill) {
        var i = WellsPEInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        let cancerKw = ["cancer","carcinoma","malignancy","malignant","lymphoma","leukemia",
                        "leukaemia","sarcoma","melanoma","adenocarcinoma","neoplasm","tumour","tumor"]
        if patient.clinicalTextContains(cancerKw) {
            i.malignancyActive = true; f.autoFieldKeys.insert("malignancyActive")
        }
        if patient.isSurgicalVisit {
            i.immobilisationOrSurgery4w = true; f.autoFieldKeys.insert("immobilisationOrSurgery4w")
        }
        if patient.clinicalTextContains(["dvt","deep vein thrombosis","pulmonary embolism","vte"]) {
            i.previousDVTOrPE = true; f.autoFieldKeys.insert("previousDVTOrPE")
        }

        f.addPending(key: "clinicalSignsDVT",
            label: "Clinical signs of DVT (oedema, tenderness)",
            source: "Clinical examination")
        f.addPending(key: "hrOver100",
            label: "Heart rate >100 bpm",
            source: "Measure pulse / review vitals")
        f.addPending(key: "haemoptysis",
            label: "Haemoptysis",
            source: "Ask patient / history")
        f.addPending(key: "alternativeDxLessLikely",
            label: "PE is the most likely / principal diagnosis",
            source: "Clinical judgement")

        return (i, f)
    }

    // MARK: RCRI Cardiac Risk

    static func rcri(patient: Patient) -> (RCRIInput, ScoreAutoFill) {
        var i = RCRIInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        // Intraabdominal / intrathoracic / suprainguinal vascular surgery
        if patient.isSurgicalVisit {
            i.highRiskSurgery = true; f.autoFieldKeys.insert("highRiskSurgery")
        }

        let ihdKw = ["ischaemic heart disease","ischemic heart disease","ihd","angina",
                     "coronary artery disease","cad","coronary heart disease",
                     "myocardial infarction","heart attack","nstemi","stemi"]
        if patient.clinicalTextContains(ihdKw) {
            i.ischemicHeartDisease = true; f.autoFieldKeys.insert("ischemicHeartDisease")
        }

        if patient.clinicalTextContains(["heart failure","chf","cardiac failure","congestive heart failure","ccf"]) {
            i.congestiveHeartFailure = true; f.autoFieldKeys.insert("congestiveHeartFailure")
        }

        if patient.clinicalTextContains(["stroke","cva","cerebrovascular","tia","transient ischemic","transient ischaemic"]) {
            i.cerebrovascularDisease = true; f.autoFieldKeys.insert("cerebrovascularDisease")
        }

        if patient.prescriptionsContain(["insulin"]) {
            i.insulinDependentDiabetes = true; f.autoFieldKeys.insert("insulinDependentDiabetes")
        }

        if !f.isAuto("insulinDependentDiabetes") {
            f.addPending(key: "insulinDependentDiabetes",
                label: "Insulin-dependent diabetes mellitus",
                source: "Ask patient / review medication list")
        }
        if let cr = patient.creatinineUmolL(), cr > 177 {
            i.preopCreatinineOver2 = true; f.autoFieldKeys.insert("preopCreatinineOver2")
        }
        if !f.isAuto("preopCreatinineOver2") {
            f.addPending(key: "preopCreatinineOver2",
                label: "Pre-op creatinine >177 μmol/L (>2 mg/dL)",
                source: "Blood test results")
        }

        return (i, f)
    }

    // MARK: STOP-BANG OSA Screen

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

    static func cha2ds2vasc(patient: Patient) -> (CHA2DS2VAScInput, ScoreAutoFill) {
        var i = CHA2DS2VAScInput()
        var f = ScoreAutoFill(); f.isAttempted = true
        let age = patient.ageYears

        if age >= 75      { i.ageOver75  = true; f.autoFieldKeys.insert("ageOver75") }
        else if age >= 65 { i.age65to74  = true; f.autoFieldKeys.insert("age65to74") }
        if patient.sex == .female { i.femaleSex = true; f.autoFieldKeys.insert("femaleSex") }

        if patient.clinicalTextContains(["diabetes","t1dm","t2dm","type 1 diab","type 2 diab"]) {
            i.diabetes = true; f.autoFieldKeys.insert("diabetes")
        }
        if patient.clinicalTextContains(["stroke","cva","tia","transient ischemic",
                                         "transient ischaemic","thromboembolism"]) {
            i.strokeOrTIA = true; f.autoFieldKeys.insert("strokeOrTIA")
        }
        if patient.clinicalTextContains(["heart failure","chf","cardiac failure","ccf"]) {
            i.congestiveHeartFailure = true; f.autoFieldKeys.insert("congestiveHeartFailure")
        }
        if patient.clinicalTextContains(["hypertension","htn","high blood pressure"]) {
            i.hypertension = true; f.autoFieldKeys.insert("hypertension")
        }
        if patient.clinicalTextContains(["myocardial infarction","heart attack"," mi ","mi,",
                                         "peripheral artery disease","pad","aortic plaque",
                                         "aortic atherosclerosis"]) {
            i.vascularDisease = true; f.autoFieldKeys.insert("vascularDisease")
        }

        if !f.isAuto("congestiveHeartFailure") {
            f.addPending(key: "congestiveHeartFailure",
                label: "Congestive heart failure (confirmed echo or clinical)",
                source: "Review PMH / echocardiogram")
        }
        if !f.isAuto("vascularDisease") {
            f.addPending(key: "vascularDisease",
                label: "Vascular disease (MI, PAD, aortic plaque)",
                source: "Review PMH / imaging")
        }

        return (i, f)
    }

    // MARK: HAS-BLED Bleeding Risk

    static func hasBled(patient: Patient) -> (HASBLEDInput, ScoreAutoFill) {
        var i = HASBLEDInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        if patient.ageYears > 65 { i.ageOver65 = true; f.autoFieldKeys.insert("ageOver65") }
        if patient.clinicalTextContains(["stroke","cva","cerebrovascular"]) {
            i.strokeHistory = true; f.autoFieldKeys.insert("strokeHistory")
        }

        let antiplateletKw = ["aspirin","clopidogrel","ticagrelor","prasugrel","dipyridamole",
                              "ibuprofen","naproxen","diclofenac","celecoxib","indomethacin",
                              "meloxicam","ketoprofen"]
        if patient.prescriptionsContain(antiplateletKw) {
            i.drugsOrAlcohol = true; f.autoFieldKeys.insert("drugsOrAlcohol")
        }

        // Renal dysfunction from labs (Cr >200 μmol/L) or clinical history
        if let cr = patient.creatinineUmolL(), cr > 200 {
            i.renalDysfunction = true; f.autoFieldKeys.insert("renalDysfunction")
        } else if patient.clinicalTextContains(["dialysis","haemodialysis","hemodialysis",
                                                "esrd","renal failure","ckd stage 5"]) {
            i.renalDysfunction = true; f.autoFieldKeys.insert("renalDysfunction")
        }

        // Labile INR from labs (outlier single reading as proxy)
        if let inr = patient.latestLab(named: ["inr","pt-inr"]), inr > 3.5 || inr < 1.0 {
            i.labileINR = true; f.autoFieldKeys.insert("labileINR")
        }

        // Liver dysfunction: bili >2×ULN (>34 μmol/L) or AST/ALT >3×ULN (>120 IU/L)
        let biliRaw = patient.latestLab(named: ["bilirubin"])
        let biliUmol = biliRaw.map { $0 < 5 ? $0 * 17.1 : $0 }
        let ast = patient.latestLab(named: ["ast","aspartate aminotransferase"])
        let alt = patient.latestLab(named: ["alt","alanine aminotransferase"])
        if (biliUmol.map { $0 > 34 } ?? false)
            || (ast.map { $0 > 120 } ?? false)
            || (alt.map { $0 > 120 } ?? false) {
            i.liverDysfunction = true; f.autoFieldKeys.insert("liverDysfunction")
        } else if patient.clinicalTextContains(["cirrhosis","chronic liver disease",
                                                "hepatic failure","liver failure"]) {
            i.liverDysfunction = true; f.autoFieldKeys.insert("liverDysfunction")
        }

        f.addPending(key: "hypertensionUncontrolled",
            label: "Uncontrolled hypertension (SBP >160 mmHg)",
            source: "Measure blood pressure")
        if !f.isAuto("renalDysfunction") {
            f.addPending(key: "renalDysfunction",
                label: "Renal dysfunction (dialysis or Cr >200 μmol/L)",
                source: "Blood test results")
        }
        if !f.isAuto("liverDysfunction") {
            f.addPending(key: "liverDysfunction",
                label: "Liver dysfunction (cirrhosis or bili ×2 + AST/ALT ×3)",
                source: "LFTs / clinical history")
        }
        f.addPending(key: "priorBleeding",
            label: "Prior bleeding or known bleeding tendency",
            source: "Ask patient / review PMH")
        if !f.isAuto("labileINR") {
            f.addPending(key: "labileINR",
                label: "Labile INR (time in therapeutic range <60%)",
                source: "Review INR records")
        }
        f.addPending(key: "alcoholUse",
            label: "Alcohol use ≥8 units/week",
            source: "Social history")

        return (i, f)
    }

    // MARK: ABCD² TIA/Stroke Risk

    static func abcd2(patient: Patient) -> (ABCD2Input, ScoreAutoFill) {
        var i = ABCD2Input()
        var f = ScoreAutoFill(); f.isAttempted = true

        if patient.ageYears > 60 { i.ageOver60 = true; f.autoFieldKeys.insert("ageOver60") }
        if patient.clinicalTextContains(["diabetes","t1dm","t2dm","diabetic"]) {
            i.diabetes = true; f.autoFieldKeys.insert("diabetes")
        }

        f.addPending(key: "bpOver140_90",
            label: "BP ≥140/90 mmHg at presentation",
            source: "Measure blood pressure")
        f.addPending(key: "unilateralWeakness",
            label: "Focal unilateral weakness (face, arm, or leg)",
            source: "Neurological examination")
        f.addPending(key: "speechWithoutWeakness",
            label: "Speech disturbance without focal weakness",
            source: "Clinical assessment")
        f.addPending(key: "durationOver60min",
            label: "Symptom duration ≥60 min",
            source: "Ask patient / history")
        f.addPending(key: "duration10to59min",
            label: "Symptom duration 10–59 min",
            source: "Ask patient / history")

        return (i, f)
    }

    // MARK: SIRS (from vitals + WBC)

    static func sirs(patient: Patient) -> (SIRSInput, ScoreAutoFill) {
        var i = SIRSInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        if let v = patient.latestVitals {
            if let t = v.temperatureCelsius, t > 38.0 || t < 36.0 {
                i.tempAbove38OrBelow36 = true; f.autoFieldKeys.insert("tempAbove38OrBelow36")
            }
            if let hr = v.heartRate, hr > 90 {
                i.heartRateOver90 = true; f.autoFieldKeys.insert("heartRateOver90")
            }
            if let rr = v.respiratoryRate, rr > 20 {
                i.rrOver20OrPaCO2Below32 = true; f.autoFieldKeys.insert("rrOver20OrPaCO2Below32")
            }
        }

        // WBC (×10⁹/L; values >100 assumed cells/μL → ÷1000)
        let wbcKw = ["wbc","white blood cell","white cell count","leucocyte","leukocyte"]
        if let wbc = patient.latestLab(named: wbcKw) {
            let val = wbc > 100 ? wbc / 1000 : wbc
            if val > 12 || val < 4 {
                i.wbcOver12kOrBelow4kOr10PctBands = true
                f.autoFieldKeys.insert("wbcOver12kOrBelow4kOr10PctBands")
            }
        }

        f.addPending(key: "suspectedInfection",
            label: "Suspected infection source identified",
            source: "Clinical assessment")
        if !f.isAuto("wbcOver12kOrBelow4kOr10PctBands") {
            f.addPending(key: "wbcOver12kOrBelow4kOr10PctBands",
                label: "WBC >12k, <4k, or >10% band neutrophils",
                source: "Blood test results")
        }

        return (i, f)
    }

    // MARK: qSOFA (from vitals)

    static func qsofa(patient: Patient) -> (QSOFAInput, ScoreAutoFill) {
        var i = QSOFAInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        if let v = patient.latestVitals {
            if v.avpu != .alert {
                i.alteredMentation = true; f.autoFieldKeys.insert("alteredMentation")
            }
            if let rr = v.respiratoryRate, rr > 22 {
                i.rrOver22 = true; f.autoFieldKeys.insert("rrOver22")
            } else if v.respiratoryRate == nil {
                f.addPending(key: "rrOver22",
                    label: "Respiratory rate >22/min",
                    source: "Measure at bedside")
            }
            if let sbp = v.bpSystolic, sbp < 100 {
                i.sbpUnder100 = true; f.autoFieldKeys.insert("sbpUnder100")
            } else if v.bpSystolic == nil {
                f.addPending(key: "sbpUnder100",
                    label: "Systolic BP <100 mmHg",
                    source: "Measure blood pressure")
            }
        } else {
            f.addPending(key: "alteredMentation",
                label: "Altered mentation (GCS <15)",
                source: "Assess patient")
            f.addPending(key: "rrOver22",
                label: "Respiratory rate >22/min",
                source: "Measure at bedside")
            f.addPending(key: "sbpUnder100",
                label: "Systolic BP <100 mmHg",
                source: "Measure blood pressure")
        }
        f.addPending(key: "suspectedInfection",
            label: "Suspected infection source identified",
            source: "Clinical assessment")

        return (i, f)
    }

    // MARK: Child-Pugh (from labs)

    static func childPugh(patient: Patient) -> (ChildPughInput, ScoreAutoFill) {
        var i = ChildPughInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        // Bilirubin → μmol/L (< 5 = mg/dL ×17.1, ≥ 5 = μmol/L)
        if let bili = patient.latestLab(named: ["bilirubin"]) {
            let umol = bili < 5 ? bili * 17.1 : bili
            i.bilirubinUmolL = max(0, min(400, umol))
            f.autoFieldKeys.insert("bilirubinUmolL")
        }

        // Albumin → g/dL (values > 10 treated as g/L → ÷10)
        if let alb = patient.latestLab(named: ["albumin"]) {
            let gdL = alb > 10 ? alb / 10 : alb
            i.albuminGdL = max(1.0, min(5.0, gdL))
            f.autoFieldKeys.insert("albuminGdL")
        }

        // INR
        if let inr = patient.latestLab(named: ["inr","pt-inr"]) {
            i.ptINR = max(0.8, min(5.0, inr))
            f.autoFieldKeys.insert("ptINR")
        }

        // Ascites and encephalopathy require clinical examination — no auto
        return (i, f)
    }

    // MARK: LRINEC (from labs)

    static func lrinec(patient: Patient) -> (LRINECInput, ScoreAutoFill) {
        var i = LRINECInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        let wbcKw = ["wbc","white blood cell","white cell count","leucocyte","leukocyte"]

        // CRP (mg/L)
        if let crp = patient.latestLab(named: ["crp","c-reactive protein","c reactive protein"]) {
            if crp > 150 { i.crpOver150 = true; f.autoFieldKeys.insert("crpOver150") }
        }

        // WBC (×10⁹/L)
        if let wbc = patient.latestLab(named: wbcKw) {
            let val = wbc > 100 ? wbc / 1000 : wbc
            if val > 25      { i.wbcOver25  = true; f.autoFieldKeys.insert("wbcOver25") }
            else if val >= 15 { i.wbc15to25 = true; f.autoFieldKeys.insert("wbc15to25") }
        }

        // Hb (g/dL; values >20 treated as g/L → ÷10)
        if let hb = patient.latestLab(named: ["haemoglobin","hemoglobin","hgb","hb"]) {
            let gdL = hb > 20 ? hb / 10 : hb
            if gdL < 11        { i.hbBelow11   = true; f.autoFieldKeys.insert("hbBelow11") }
            else if gdL <= 13.5 { i.hb11to13_5 = true; f.autoFieldKeys.insert("hb11to13_5") }
        }

        // Sodium
        if let na = patient.latestLab(named: ["sodium"]) {
            if na < 135 { i.sodiumBelow135 = true; f.autoFieldKeys.insert("sodiumBelow135") }
        }

        // Creatinine (via unit-inferred μmol/L)
        if let cr = patient.creatinineUmolL() {
            if cr > 177       { i.creatinineOver177   = true; f.autoFieldKeys.insert("creatinineOver177") }
            else if cr >= 141 { i.creatinine141to177  = true; f.autoFieldKeys.insert("creatinine141to177") }
        }

        // Glucose (mmol/L; values >30 treated as mg/dL → ÷18)
        if let glu = patient.latestLab(named: ["glucose","blood glucose","rbs","fasting glucose"]) {
            let mmol = glu > 30 ? glu / 18.0 : glu
            if mmol > 10 { i.glucoseOver10 = true; f.autoFieldKeys.insert("glucoseOver10") }
        }

        return (i, f)
    }

    // MARK: Ranson (at-admission criteria from labs; 48 h criteria as pending)

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

    static func news2(patient: Patient) -> (NEWS2Input, ScoreAutoFill) {
        var i = NEWS2Input()
        var f = ScoreAutoFill(); f.isAttempted = true

        guard let v = patient.latestVitals else {
            f.addPending(key: "all",
                label: "No vitals recorded — enter current readings",
                source: "Measure at bedside")
            return (i, f)
        }

        if let rr = v.respiratoryRate    { i.respiratoryRate    = rr;  f.autoFieldKeys.insert("respiratoryRate") }
        if let spo = v.spo2              { i.spo2               = spo; f.autoFieldKeys.insert("spo2") }
        if let sbp = v.bpSystolic        { i.systolicBP         = sbp; f.autoFieldKeys.insert("systolicBP") }
        if let hr = v.heartRate          { i.heartRate          = hr;  f.autoFieldKeys.insert("heartRate") }
        if let t = v.temperatureCelsius  { i.temperatureCelsius = t;   f.autoFieldKeys.insert("temperatureCelsius") }

        // AVPU maps directly (same enum type)
        i.avpu = v.avpu; f.autoFieldKeys.insert("avpu")

        if v.respiratoryRate   == nil { f.addPending(key: "respiratoryRate",   label: "Respiratory rate (breaths/min)", source: "Measure at bedside") }
        if v.spo2              == nil { f.addPending(key: "spo2",              label: "SpO₂ (%)",                       source: "Pulse oximetry") }
        if v.bpSystolic        == nil { f.addPending(key: "systolicBP",        label: "Systolic blood pressure (mmHg)", source: "Measure BP") }
        if v.heartRate         == nil { f.addPending(key: "heartRate",         label: "Heart rate (bpm)",               source: "Measure pulse") }
        if v.temperatureCelsius == nil { f.addPending(key: "temperatureCelsius", label: "Temperature (°C)",             source: "Measure") }
        f.addPending(key: "onSupplementalO2", label: "On supplemental oxygen?", source: "Clinical assessment")

        return (i, f)
    }

    // MARK: MEWS (from latest vitals)

    static func mews(patient: Patient) -> (MEWSInput, ScoreAutoFill) {
        var i = MEWSInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        guard let v = patient.latestVitals else {
            f.addPending(key: "all",
                label: "No vitals recorded — enter current readings",
                source: "Measure at bedside")
            return (i, f)
        }

        if let rr  = v.respiratoryRate   { i.respiratoryRate  = rr;  f.autoFieldKeys.insert("respiratoryRate") }
        if let spo = v.spo2              { i.oxygenSaturation = spo; f.autoFieldKeys.insert("oxygenSaturation") }
        if let hr  = v.heartRate         { i.heartRate        = hr;  f.autoFieldKeys.insert("heartRate") }
        if let sbp = v.bpSystolic        { i.systolicBP       = sbp; f.autoFieldKeys.insert("systolicBP") }
        if let t   = v.temperatureCelsius { i.temperature     = t;   f.autoFieldKeys.insert("temperature") }

        // Map AVPU from VitalsEntry to MEWSInput
        let avpuLevel: MEWSInput.AVPULevel = switch v.avpu {
        case .alert:            .alert
        case .confused, .voice: .voice
        case .pain:             .pain
        case .unresponsive:     .unresponsive
        }
        i.consciousnessAVPU = avpuLevel; f.autoFieldKeys.insert("consciousnessAVPU")

        if v.respiratoryRate   == nil { f.addPending(key: "respiratoryRate",  label: "Respiratory rate (breaths/min)", source: "Measure at bedside") }
        if v.spo2              == nil { f.addPending(key: "oxygenSaturation", label: "SpO₂ (%)",                       source: "Pulse oximetry") }
        if v.heartRate         == nil { f.addPending(key: "heartRate",        label: "Heart rate (bpm)",                source: "Measure pulse / ECG") }
        if v.bpSystolic        == nil { f.addPending(key: "systolicBP",       label: "Systolic blood pressure (mmHg)",  source: "Measure BP") }
        if v.temperatureCelsius == nil { f.addPending(key: "temperature",     label: "Temperature (°C)",                source: "Measure") }
        f.addPending(key: "urineOutput", label: "Urine output (last hour)", source: "Fluid balance chart")

        return (i, f)
    }

    // MARK: AIMS65 (from patient demographics, vitals, and labs)

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

    static func sofa(patient: Patient) -> (SOFAInput, ScoreAutoFill) {
        var i = SOFAInput()
        var f = ScoreAutoFill()

        let vitals = patient.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first

        // CNS: AVPU → GCS proxy
        if let v = vitals {
            switch v.avpu {
            case .alert:            i.cns = 0; f.autoFieldKeys.insert("cnsGCS")
            case .confused, .voice: i.cns = 1; f.autoFieldKeys.insert("cnsGCS")
            case .pain:             i.cns = 3; f.autoFieldKeys.insert("cnsGCS")
            case .unresponsive:     i.cns = 4; f.autoFieldKeys.insert("cnsGCS")
            }
        }

        // Cardiovascular: MAP from BP
        if let v = vitals, let sbp = v.bpSystolic, let dbp = v.bpDiastolic {
            let map = Double(dbp) + Double(sbp - dbp) / 3.0
            if map < 70 {
                i.cardiovascular = 1
                f.autoFieldKeys.insert("cardiovascular")
            } else {
                i.cardiovascular = 0
                f.autoFieldKeys.insert("cardiovascular")
            }
        }

        // Respiratory: SpO₂ proxy for oxygenation impairment
        if let v = vitals, let spo2 = v.spo2 {
            if spo2 < 90 && v.onSupplementalO2 {
                i.respiration = 3
                f.autoFieldKeys.insert("respiration")
            } else if spo2 < 94 && v.onSupplementalO2 {
                i.respiration = 2
                f.autoFieldKeys.insert("respiration")
            }
        }

        // All lab-based domains queued as pending
        f.addPending(key: "respirationElevated",  label: "Respiratory compromise (P:F <300 or O₂ requirement)", source: "ABG / oximetry")
        f.addPending(key: "coagulationElevated",  label: "Platelets <150 ×10³/µL",                             source: "FBC")
        f.addPending(key: "liverElevated",         label: "Bilirubin >20 µmol/L",                               source: "LFTs")
        f.addPending(key: "cnsElevated",           label: "GCS <15 (not explained by sedation)",                source: "Neurological assessment")
        f.addPending(key: "renalElevated",         label: "Creatinine >110 µmol/L or oliguria",                 source: "U&E / urine output")

        return (i, f)
    }

    // MARK: - FIB-4

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

    static func padua(patient: Patient) -> (PaduaInput, ScoreAutoFill) {
        var i = PaduaInput()
        var f = ScoreAutoFill(); f.isAttempted = true
        let age = patient.ageYears

        // Age ≥70
        if age >= 70 { i.ageOver70 = true; f.autoFieldKeys.insert("ageOver70") }

        // Active / recent cancer
        let cancerKw = ["cancer","carcinoma","malignancy","malignant","lymphoma","leukemia",
                        "leukaemia","sarcoma","melanoma","adenocarcinoma","neoplasm","tumour","tumor","metastas"]
        if patient.clinicalTextContains(cancerKw) {
            i.activeOrRecentCancer = true; f.autoFieldKeys.insert("activeOrRecentCancer")
        }

        // Previous VTE
        let vteKw = ["dvt","deep vein thrombosis","deep venous thrombosis",
                     "pulmonary embolism","vte","thromboembolism"]
        if patient.clinicalTextContains(vteKw) {
            i.previousVTE = true; f.autoFieldKeys.insert("previousVTE")
        }

        // Thrombophilia
        let thrKw = ["thrombophilia","factor v leiden","protein c deficiency",
                     "protein s deficiency","antiphospholipid","antithrombin deficiency"]
        if patient.clinicalTextContains(thrKw) {
            i.thrombophilia = true; f.autoFieldKeys.insert("thrombophilia")
        }

        // Reduced mobility / bed rest — inpatient setting or surgical
        if patient.setting == .inpatient || patient.isSurgicalVisit {
            i.reducedMobility = true; f.autoFieldKeys.insert("reducedMobility")
        }

        // Recent trauma or surgery ≤1 month
        if patient.isSurgicalVisit {
            i.recentTraumaOrSurgery = true; f.autoFieldKeys.insert("recentTraumaOrSurgery")
        }

        // Obesity: BMI ≥30
        if let bmi = patient.latestBMI(), bmi >= 30 {
            i.obese = true; f.autoFieldKeys.insert("obese")
        }

        // Heart failure or respiratory failure from PMH
        let hfKw = ["heart failure","cardiac failure","congestive heart failure","ccf","chf",
                    "respiratory failure","cor pulmonale"]
        if patient.clinicalTextContains(hfKw) {
            i.heartOrRespiratoryFailure = true; f.autoFieldKeys.insert("heartOrRespiratoryFailure")
        }

        // Acute MI or ischaemic stroke from PMH
        let miKw = ["myocardial infarction","heart attack","nstemi","stemi"," mi ","mi,",
                    "ischaemic stroke","ischemic stroke","stroke","cva"]
        if patient.clinicalTextContains(miKw) {
            i.acuteMIOrIschaemicStroke = true; f.autoFieldKeys.insert("acuteMIOrIschaemicStroke")
        }

        // Hormonal treatment from prescriptions
        let hormKw = ["ocp","contraceptive","estrogen","oestrogen","hrt","hormone replacement",
                      "tamoxifen","raloxifene","letrozole","anastrozole","progesterone"]
        if patient.prescriptionsContain(hormKw) {
            i.ongoingHormonalTreatment = true; f.autoFieldKeys.insert("ongoingHormonalTreatment")
        }

        // Pending: acute infection/inflammatory requires clinical judgement
        if !f.isAuto("reducedMobility") {
            f.addPending(key: "reducedMobility",
                label: "Reduced mobility ≥3 days (bed rest / wheelchair-bound)",
                source: "Clinical assessment")
        }
        f.addPending(key: "acuteInfectionOrInflammatory",
            label: "Active acute infection or rheumatological disorder",
            source: "Clinical assessment / inflammatory markers")

        return (i, f)
    }

    // MARK: - APACHE II

    static func apacheII(patient: Patient) -> (APACHEIIInput, ScoreAutoFill) {
        var i = APACHEIIInput()
        var f = ScoreAutoFill()

        // Age points
        let age = patient.ageYears
        let agePts: Int
        switch age {
        case ..<45:  agePts = 0
        case 45..<55: agePts = 2
        case 55..<65: agePts = 3
        case 65..<75: agePts = 5
        default:     agePts = 6
        }
        if agePts > 0 {
            i.agePoints = agePts
            f.autoFieldKeys.insert("agePoints")
        }
        i.gcs = 15  // default to fully alert; user adjusts if impaired

        // Vitals from latest entry
        if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first {
            // Temperature
            if let tempC = v.temperatureCelsius {
                let pts: Int
                switch tempC {
                case ..<30.0:  pts = 4
                case 30.0..<32.0: pts = 3
                case 32.0..<34.0: pts = 2
                case 34.0..<36.0: pts = 1
                case 36.0..<38.5: pts = 0
                case 38.5..<39.0: pts = 1
                case 39.0..<41.0: pts = 3
                default:       pts = 4  // ≥41°C
                }
                if pts > 0 {
                    i.tempPoints = pts; f.autoFieldKeys.insert("tempPoints")
                }
            }

            // Heart rate
            if let hr = v.heartRate {
                let pts: Int
                switch hr {
                case ..<40:    pts = 4
                case 40..<55:  pts = 3
                case 55..<70:  pts = 2
                case 70..<110: pts = 0
                case 110..<140: pts = 2
                case 140..<180: pts = 3
                default:       pts = 4  // ≥180
                }
                if pts > 0 {
                    i.hrPoints = pts; f.autoFieldKeys.insert("hrPoints")
                }
            }

            // Respiratory rate
            if let rr = v.respiratoryRate {
                let pts: Int
                switch rr {
                case ..<6:    pts = 4
                case 6..<10:  pts = 2
                case 10..<12: pts = 1
                case 12..<25: pts = 0
                case 25..<35: pts = 1
                case 35..<50: pts = 3
                default:      pts = 4  // ≥50
                }
                if pts > 0 {
                    i.rrPoints = pts; f.autoFieldKeys.insert("rrPoints")
                }
            }

            // MAP approximation from BP: MAP ≈ DBP + (SBP - DBP)/3
            if let sbp = v.bpSystolic, let dbp = v.bpDiastolic {
                let map = dbp + (sbp - dbp) / 3
                let pts: Int
                switch map {
                case ..<50:    pts = 4
                case 50..<70:  pts = 2
                case 70..<110: pts = 0
                case 110..<130: pts = 2
                case 130..<160: pts = 3
                default:       pts = 4  // ≥160
                }
                if pts > 0 {
                    i.mapPoints = pts; f.autoFieldKeys.insert("mapPoints")
                }
            }

            // SpO2-based oxygenation estimate (conservative — PaO2/A-a gradient preferred)
            if let spo2 = v.spo2 {
                let pts: Int
                switch spo2 {
                case ..<88:  pts = 4   // severe hypoxaemia (approximate PaO2 <55)
                case 88..<92: pts = 2  // moderate hypoxaemia
                case 92..<95: pts = 1  // mild hypoxaemia
                default:     pts = 0
                }
                if pts > 0 {
                    i.oxyPoints = pts; f.autoFieldKeys.insert("oxyPoints")
                }
            }
        }

        // Chronic health — severe organ system insufficiency from PMH
        let chronicKw = ["cirrhosis", "portal hypertension", "liver failure", "hepatic failure",
                         "chronic heart failure", "new york heart association class iv",
                         "nyha iv", "chronic respiratory failure", "hypercapnia",
                         "chronic renal failure", "chronic kidney disease stage 5", "dialysis",
                         "immunocompromised", "immunosuppressed", "chemotherapy",
                         "transplant", "hiv", "aids", "aplastic anaemia"]
        if patient.clinicalTextContains(chronicKw) {
            // Assume non-operative by default (higher penalty); elective postop = 2
            i.chronicHealthPoints = 5
            f.autoFieldKeys.insert("chronicHealthPoints")
        }

        // Pending: lab values require results
        f.addPending(key: "pHPoints",
            label: "Arterial pH (ABG required)",
            source: "Arterial blood gas")
        f.addPending(key: "sodiumPoints",
            label: "Serum sodium — check latest U&E",
            source: "Laboratory results")
        f.addPending(key: "potassiumPoints",
            label: "Serum potassium — check latest U&E",
            source: "Laboratory results")
        f.addPending(key: "creatininePoints",
            label: "Serum creatinine — check latest U&E (double if ARF)",
            source: "Laboratory results")
        f.addPending(key: "haematocritPoints",
            label: "Haematocrit — check latest FBC",
            source: "Laboratory results")
        f.addPending(key: "wbcPoints",
            label: "WBC — check latest FBC",
            source: "Laboratory results")

        return (i, f)
    }

    // MARK: P-POSSUM

    static func ppossum(patient: Patient) -> (PPOSSUMInput, ScoreAutoFill) {
        var i = PPOSSUMInput()
        var f = ScoreAutoFill(); f.isAttempted = true

        // Age (physiological score)
        let age = patient.ageYears
        switch age {
        case ..<61:  i.agePhys = 1
        case 61..<71: i.agePhys = 2
        case 71..<81: i.agePhys = 4
        default:     i.agePhys = 8
        }
        f.autoFieldKeys.insert("agePhys")

        // SBP and HR from latest vitals
        if let v = patient.latestVitals {
            if let sbp = v.bpSystolic {
                let pts: Int
                switch sbp {
                case ..<90:    pts = 8
                case 90..<100: pts = 4
                case 100..<110: pts = 2
                case 110...130: pts = 1
                case 131...170: pts = 2
                default:       pts = 4  // ≥171
                }
                i.sbpPhys = pts; f.autoFieldKeys.insert("sbpPhys")
            }
            if let hr = v.heartRate {
                let pts: Int
                switch hr {
                case ..<51:    pts = 2
                case 51..<81:  pts = 1
                case 81..<101: pts = 2
                case 101..<121: pts = 4
                default:       pts = 8  // ≥121
                }
                i.hrPhys = pts; f.autoFieldKeys.insert("hrPhys")
            }
        }

        // Cardiac signs from PMH/medications
        let raisedJvpKw = ["raised jvp", "raised jugular", "cardiomegaly", "jvp raised", "elevated jvp"]
        let oedemaDioxinKw = ["peripheral oedema", "ankle oedema", "warfarin", "digoxin"]
        let medicatedCardiacKw = ["antihypertensive", "beta blocker", "ace inhibitor", "arb ",
                                  "calcium channel", "amlodipine", "lisinopril", "atenolol",
                                  "ramipril", "bisoprolol", "carvedilol"]
        if patient.clinicalTextContains(raisedJvpKw) {
            i.cardiacSigns = 8; f.autoFieldKeys.insert("cardiacSigns")
        } else if patient.clinicalTextContains(oedemaDioxinKw) {
            i.cardiacSigns = 4; f.autoFieldKeys.insert("cardiacSigns")
        } else if patient.clinicalTextContains(medicatedCardiacKw)
                    || patient.prescriptionsContain(medicatedCardiacKw) {
            i.cardiacSigns = 2; f.autoFieldKeys.insert("cardiacSigns")
        }

        // Respiratory history from PMH
        let breathlessAtRestKw = ["breathless at rest", "orthopnoea", "paroxysmal nocturnal dyspnoea"]
        let limitingDyspnoeaKw = ["copd", "chronic obstructive", "limiting dyspnoea",
                                  "dyspnoea on minimal", "emphysema", "cor pulmonale"]
        let exertionalDyspnoeaKw = ["exertional dyspnoea", "dyspnoea on exertion",
                                    "shortness of breath on exercise", "sob on exertion"]
        if patient.clinicalTextContains(breathlessAtRestKw) {
            i.respiratoryHx = 8; f.autoFieldKeys.insert("respiratoryHx")
        } else if patient.clinicalTextContains(limitingDyspnoeaKw) {
            i.respiratoryHx = 4; f.autoFieldKeys.insert("respiratoryHx")
        } else if patient.clinicalTextContains(exertionalDyspnoeaKw) {
            i.respiratoryHx = 2; f.autoFieldKeys.insert("respiratoryHx")
        }

        // Malignancy from PMH
        let metastaticKw = ["metastas", "metastatic", "stage iv", "stage 4", "m1", "distant spread"]
        let nodalKw = ["nodal", "node positive", "n1", "n2", "n3", "lymph node metastas"]
        let cancerKw = ["cancer", "carcinoma", "malignancy", "malignant", "lymphoma", "leukemia",
                        "leukaemia", "sarcoma", "melanoma", "adenocarcinoma", "neoplasm", "tumour", "tumor"]
        if patient.clinicalTextContains(metastaticKw) {
            i.malignancy = 8; f.autoFieldKeys.insert("malignancy")
        } else if patient.clinicalTextContains(nodalKw) {
            i.malignancy = 4; f.autoFieldKeys.insert("malignancy")
        } else if patient.clinicalTextContains(cancerKw) {
            i.malignancy = 2; f.autoFieldKeys.insert("malignancy")
        }

        // Operative magnitude and urgency from surgical visit data
        if patient.isSurgicalVisit {
            let procName = patient.surgeryData.procedureName.lowercased()
            let majorPlusKw = ["whipple", "pancreatectomy", "hepatectomy", "pneumonectomy",
                               "oesophagectomy", "esophagectomy", "gastrectomy", "colectomy",
                               "proctocolectomy", "aortic"]
            let majorKw = ["laparotomy", "bowel resection", "colorectal", "hemicolectomy",
                           "anterior resection", "hartmann", "low anterior", "splenectomy",
                           "fundoplication"]
            let moderateKw = ["cholecystectomy", "hernia", "appendicectomy", "appendectomy",
                              "haemorrhoidectomy", "hemorrhoidectomy", "fistulectomy",
                              "pilonidal", "incisional"]
            if majorPlusKw.contains(where: { procName.contains($0) }) {
                i.operativeMagnitude = 8; f.autoFieldKeys.insert("operativeMagnitude")
            } else if majorKw.contains(where: { procName.contains($0) }) {
                i.operativeMagnitude = 4; f.autoFieldKeys.insert("operativeMagnitude")
            } else if moderateKw.contains(where: { procName.contains($0) }) {
                i.operativeMagnitude = 2; f.autoFieldKeys.insert("operativeMagnitude")
            }

            // Urgency — emergency setting with acute presentation suggests ≤2h window
            if patient.setting == .emergency {
                let acuteKw = ["perforated", "perforation", "ischaemia", "strangulated", "volvulus"]
                if patient.clinicalTextContains(acuteKw) {
                    i.urgency = 8; f.autoFieldKeys.insert("urgency")
                } else {
                    i.urgency = 4; f.autoFieldKeys.insert("urgency")
                }
            }
        }

        // Pending: labs and operative findings require intraoperative/lab data
        f.addPending(key: "haemoglobin",
            label: "Haemoglobin (g/dL) — check latest FBC",
            source: "Laboratory results")
        f.addPending(key: "wbcPhys",
            label: "WBC (×10³/μL) — check latest FBC",
            source: "Laboratory results")
        f.addPending(key: "urea",
            label: "Serum urea (mmol/L) — check latest U&E",
            source: "Laboratory results")
        f.addPending(key: "sodiumPhys",
            label: "Serum sodium (mmol/L) — check latest U&E",
            source: "Laboratory results")
        f.addPending(key: "potassiumPhys",
            label: "Serum potassium (mmol/L) — check latest U&E",
            source: "Laboratory results")
        f.addPending(key: "ecg",
            label: "ECG findings — review latest ECG trace",
            source: "ECG / chart review")
        if !f.isAuto("operativeMagnitude") {
            f.addPending(key: "operativeMagnitude",
                label: "Operative magnitude — confirm planned procedure",
                source: "Operative plan")
        }
        f.addPending(key: "bloodLoss",
            label: "Estimated blood loss — operative field measurement",
            source: "Operative note")
        f.addPending(key: "peritonealSoiling",
            label: "Peritoneal soiling — operative findings",
            source: "Operative note")
        if !f.isAuto("urgency") {
            f.addPending(key: "urgency",
                label: "Urgency — elective or emergency surgery",
                source: "Confirm with consultant")
        }

        return (i, f)
    }

    // MARK: - MPI (Mannheim Peritonitis Index)

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

    static func timi(patient: Patient) -> (TIMIInput, ScoreAutoFill) {
        var i = TIMIInput()
        var f = ScoreAutoFill()
        let allText = [patient.chiefComplaint, patient.hpi, patient.assessmentText,
                       patient.pmhNotes, patient.workingDiagnosis, patient.notes]
            .compactMap { $0 }.joined(separator: " ").lowercased()

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

    static func cfs(patient: Patient) -> (ClinicalFrailtyInput, ScoreAutoFill) {
        var i = ClinicalFrailtyInput()
        var f = ScoreAutoFill()
        let allText = [patient.chiefComplaint, patient.hpi, patient.assessmentText,
                       patient.examGeneral, patient.pmhNotes, patient.notes]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Try to infer frailty level from clinical text keywords
        if allText.contains("terminally ill") || allText.contains("terminal") ||
           allText.contains("end of life") || allText.contains("prognosis <6") {
            i.level = 9
            f.addAutoFilled(key: "level", label: "Terminal illness suspected from clinical text (CFS 9) — verify", source: "Clinical text")
        } else if allText.contains("very severely frail") || allText.contains("completely dependent") {
            i.level = 8
            f.addAutoFilled(key: "level", label: "Very severe frailty suggested from clinical text (CFS 8) — verify", source: "Clinical text")
        } else if allText.contains("severely frail") || allText.contains("severe frail") {
            i.level = 7
            f.addAutoFilled(key: "level", label: "Severe frailty suggested from clinical text (CFS 7) — verify", source: "Clinical text")
        } else if allText.contains("moderately frail") || allText.contains("moderate frail") {
            i.level = 6
            f.addAutoFilled(key: "level", label: "Moderate frailty suggested from clinical text (CFS 6) — verify", source: "Clinical text")
        } else if allText.contains("mildly frail") || allText.contains("mild frail") || allText.contains("frail") {
            i.level = 5
            f.addAutoFilled(key: "level", label: "Mild frailty suggested from clinical text (CFS 5) — verify", source: "Clinical text")
        } else {
            f.addPending(key: "level", label: "CFS level (1–9) — requires direct functional assessment; assess ADLs, mobility, energy", source: "Clinical assessment")
        }
        return (i, f)
    }

    // MARK: - Mallampati Airway Classification

    static func mallampati(patient: Patient) -> (MallampatiInput, ScoreAutoFill) {
        var i = MallampatiInput()
        var f = ScoreAutoFill()
        let allText = [patient.chiefComplaint, patient.hpi, patient.assessmentText,
                       patient.examGeneral, patient.pmhNotes, patient.notes]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Obesity predictor from clinical text or BMI
        if allText.contains("obese") || allText.contains("obesity") ||
           allText.contains("bmi ≥30") || allText.contains("bmi >30") ||
           allText.contains("bmi>30") || allText.contains("morbid") ||
           allText.contains("neck circumference") {
            i.obesity = true
            f.addAutoFilled(key: "obesity", label: "Obesity / large neck detected in clinical text", source: "Clinical text")
        }

        // Retrognathia from clinical text
        if allText.contains("retrognath") || allText.contains("micrognath") ||
           allText.contains("receding jaw") || allText.contains("small mandible") {
            i.retrognathia = true
            f.addAutoFilled(key: "retrognathia", label: "Retrognathia / micrognathia noted in clinical text", source: "Clinical text")
        }

        // Mallampati class requires direct examination — mark pending
        f.addPending(key: "mallampatiClass", label: "Mallampati class (I–IV) — requires direct oropharyngeal examination", source: "Physical examination")
        f.addPending(key: "mouthOpening", label: "Mouth opening — requires physical measurement", source: "Physical examination")
        f.addPending(key: "neckMobility", label: "Neck extension — requires physical assessment", source: "Physical examination")
        f.addPending(key: "thyromental", label: "Thyromental distance — requires physical measurement", source: "Physical examination")
        return (i, f)
    }

    // MARK: - HEART Score

    static func heart(patient: Patient) -> (HEARTInput, ScoreAutoFill) {
        var i = HEARTInput()
        var f = ScoreAutoFill()
        let allText = [patient.chiefComplaint, patient.hpi, patient.assessmentText,
                       patient.workingDiagnosis, patient.pmhNotes]
            .compactMap { $0 }.joined(separator: " ").lowercased()

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

    static func grace(patient: Patient) -> (GRACEInput, ScoreAutoFill) {
        var i = GRACEInput()
        var f = ScoreAutoFill()
        let allText = [patient.chiefComplaint, patient.hpi, patient.assessmentText,
                       patient.pmhNotes, patient.workingDiagnosis, patient.notes]
            .compactMap { $0 }.joined(separator: " ").lowercased()

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

    // MARK: - Surgical Apgar Score

    static func surgicalApgar(patient: Patient) -> (SurgicalApgarInput, ScoreAutoFill) {
        let i = SurgicalApgarInput()
        var f = ScoreAutoFill()
        // All three variables (EBL, lowest MAP, lowest HR) are intraoperative measurements
        // that require the anaesthetic or operative record — cannot be auto-populated from
        // pre-operative or administrative fields.
        f.addPending(key: "estimatedBloodLoss",
            label: "Estimated blood loss (mL) — requires operative/anaesthetic record",
            source: "Operative record")
        f.addPending(key: "lowestMAP",
            label: "Lowest intraoperative MAP (mmHg) — requires anaesthetic record",
            source: "Anaesthetic record")
        f.addPending(key: "lowestHeartRate",
            label: "Lowest intraoperative heart rate (bpm) — requires anaesthetic record",
            source: "Anaesthetic record")
        return (i, f)
    }

    // MARK: - Waterlow Pressure Ulcer Risk

    static func waterlow(patient: Patient) -> (WaterlowInput, ScoreAutoFill) {
        var i = WaterlowInput()
        var f = ScoreAutoFill()
        let allText = [patient.chiefComplaint, patient.hpi, patient.assessmentText,
                       patient.examGeneral, patient.examSkin, patient.pmhNotes,
                       patient.notes, patient.workingDiagnosis]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Sex and age combined score
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: Date()).year ?? 0
            let isMale = patient.sex == .male
            let sexAge: Int = switch age {
            case 81...:     5
            case 75...80:   isMale ? 3 : 4
            case 65...74:   isMale ? 2 : 3
            case 50...64:   isMale ? 1 : 2
            default:        isMale ? 0 : 1
            }
            i.sexAge = sexAge
            f.addAutoFilled(key: "sexAge", label: "Sex/age band \(sexAge) (from DOB + sex)", source: "Demographics")
        } else {
            f.addPending(key: "sexAge", label: "Sex/age combination — requires DOB", source: "Demographics")
        }

        // Obesity from clinical text
        if allText.contains("obese") || allText.contains("obesity") ||
           allText.contains("morbid") || allText.contains("bmi >30") ||
           allText.contains("bmi>30") || allText.contains("bmi ≥30") {
            i.buildWeight = 2
            f.addAutoFilled(key: "buildWeight", label: "Obesity detected in clinical text — verify weight category", source: "Clinical text")
        }

        // Tissue malnutrition risk factors
        if allText.contains("cachex") || allText.contains("terminal") ||
           allText.contains("cardiac failure") || allText.contains("heart failure") ||
           allText.contains("peripheral vascular") || allText.contains("anaemia") ||
           allText.contains("anemia") || allText.contains("smok") {
            i.tissuemalnutrition = true
            f.addAutoFilled(key: "tissuemalnutrition", label: "Tissue malnutrition risk factor detected — verify", source: "Clinical text / PMH")
        }

        // Neurological deficit
        if allText.contains("diabet") || allText.contains("paraplegia") ||
           allText.contains("paraplegi") || allText.contains("motor deficit") ||
           allText.contains("sensory deficit") || allText.contains("neuropath") {
            i.neurologicalDeficit = true
            f.addAutoFilled(key: "neurologicalDeficit", label: "Neurological deficit risk factor detected — verify", source: "Clinical text / PMH")
        }

        // Major surgery — orthopaedic / spinal / prolonged table
        if allText.contains("orthopaedic") || allText.contains("orthopedic") ||
           allText.contains("hip replacement") || allText.contains("knee replacement") ||
           allText.contains("spinal surgery") || allText.contains("spinal operation") ||
           allText.contains("laminect") || allText.contains("discectomy") {
            i.majorSurgery = true
            f.addAutoFilled(key: "majorSurgery", label: "Major orthopaedic/spinal surgery risk factor detected — verify", source: "Clinical text / surgical history")
        }

        // Skin type, continence, mobility, appetite require bedside assessment
        f.addPending(key: "skinType", label: "Skin type / visual risk area — requires bedside inspection", source: "Nursing assessment")
        f.addPending(key: "continence", label: "Continence status — requires nursing assessment", source: "Nursing assessment")
        f.addPending(key: "mobility", label: "Mobility level — requires clinical or nursing assessment", source: "Nursing assessment")
        f.addPending(key: "appetite", label: "Appetite / nutritional intake — requires dietary or nursing assessment", source: "Nursing assessment")
        return (i, f)
    }

    // MARK: - EuroSCORE II (Cardiac Surgery Operative Mortality)

    static func euroScoreII(patient: Patient) -> (EuroScoreIIInput, ScoreAutoFill) {
        var i = EuroScoreIIInput()
        var f = ScoreAutoFill()
        let allText = [patient.chiefComplaint, patient.hpi, patient.assessmentText,
                       patient.pmhNotes, patient.notes, patient.workingDiagnosis, patient.managementPlan]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Age from DOB — snap to nearest 5-year band supported by the picker
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: Date()).year ?? 60
            let snapped: Int = switch age {
            case 88...: 90
            case 82..<88: 85
            case 77..<82: 80
            case 72..<77: 75
            case 67..<72: 70
            case 62..<67: 65
            default: 60
            }
            i.age = snapped
            f.addAutoFilled(key: "age", label: "Age \(age)y → picker band \(snapped) (from DOB)", source: "Date of birth")
        } else {
            f.addPending(key: "age", label: "Age — requires date of birth", source: "Demographics")
        }

        // Female sex
        if patient.sex == .female {
            i.female = true
            f.addAutoFilled(key: "female", label: "Female sex (from patient record)", source: "Demographics")
        }

        // Previous cardiac surgery
        if allText.contains("previous cardiac") || allText.contains("prior cardiac") ||
           allText.contains("redo") || allText.contains("previous cabg") || allText.contains("prior bypass") ||
           allText.contains("previous valve") || allText.contains("prior valve") {
            i.previousCardiacSurgery = true
            f.addAutoFilled(key: "previousCardiacSurgery", label: "Previous cardiac surgery detected — verify", source: "PMH / clinical text")
        }

        // Chronic lung disease
        if allText.contains("copd") || allText.contains("chronic obstructive") ||
           allText.contains("bronchodilator") || allText.contains("steroid inhaler") ||
           allText.contains("chronic lung") || allText.contains("pulmonary fibrosis") {
            i.chronicLungDisease = true
            f.addAutoFilled(key: "chronicLungDisease", label: "Chronic lung disease detected — verify inhaler/steroid use", source: "Clinical text / PMH")
        }

        // Active endocarditis
        if allText.contains("endocardit") || allText.contains("valve vegetation") ||
           allText.contains("infective endocardit") {
            i.activeEndocarditis = true
            f.addAutoFilled(key: "activeEndocarditis", label: "Endocarditis detected — verify active antibiotic treatment", source: "Clinical text / diagnosis")
        }

        // Diabetes on insulin
        if allText.contains("insulin") && (allText.contains("diabet") || allText.contains("t1dm") || allText.contains("t2dm")) {
            i.diabetesOnInsulin = true
            f.addAutoFilled(key: "diabetesOnInsulin", label: "Insulin-treated diabetes detected", source: "PMH / medication list")
        }

        // Recent MI (<90 days)
        if allText.contains("recent mi") || allText.contains("recent myocardial") ||
           allText.contains("recent stemi") || allText.contains("recent nstemi") ||
           allText.contains("acute mi") || allText.contains("acute coronary") {
            i.recentMI = true
            f.addAutoFilled(key: "recentMI", label: "Recent MI detected — confirm within 90 days", source: "Clinical text / history")
        }

        // Extracardiac arteriopathy
        if allText.contains("claudication") || allText.contains("carotid stenosis") ||
           allText.contains("peripheral arterial") || allText.contains("aortic aneurysm") ||
           allText.contains("peripheral vascular disease") {
            i.extracardiacArteriopathy = true
            f.addAutoFilled(key: "extracardiacArteriopathy", label: "Extracardiac arteriopathy detected — verify", source: "Clinical text / PMH")
        }

        // Surgery on thoracic aorta
        if allText.contains("thoracic aorta") || allText.contains("aortic dissection") ||
           allText.contains("aortic aneurysm repair") || allText.contains("bentall") ||
           allText.contains("aortic root replacement") {
            i.surgeryOnThoracicAorta = true
            f.addAutoFilled(key: "surgeryOnThoracicAorta", label: "Thoracic aortic surgery detected — verify", source: "Clinical text / operative plan")
        }

        // Mark remaining quantitative fields as pending
        let filledKeys = f.autoFieldKeys
        let pendingFields: [(String, String)] = [
            ("renalImpairment", "Renal function (creatinine) — requires laboratory result"),
            ("nyhaClass", "NYHA class — requires clinical assessment"),
            ("lvFunction", "LV ejection fraction — requires echocardiogram or cardiac imaging"),
            ("pulmonaryHypertension", "Pulmonary artery systolic pressure — requires echo or RHC"),
            ("urgency", "Urgency classification — requires surgical team decision"),
            ("weightOfIntervention", "Planned procedure — requires surgical team input"),
            ("poorMobility", "Mobility limitation — requires clinical assessment")
        ]
        for (key, label) in pendingFields where !filledKeys.contains(key) {
            f.addPending(key: key, label: label, source: "Clinical/cardiac assessment")
        }
        return (i, f)
    }

    // MARK: - Barthel Index (ADL Functional Independence)

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

    static func dasi(patient: Patient) -> (DASIInput, ScoreAutoFill) {
        var i = DASIInput()
        var f = ScoreAutoFill()
        let allText = [patient.chiefComplaint, patient.hpi, patient.assessmentText,
                       patient.pmhNotes, patient.notes, patient.workingDiagnosis,
                       patient.managementPlan]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Self-care / ADLs
        if allText.contains("independent") || allText.contains("adl") ||
           allText.contains("self-care") || allText.contains("self care") ||
           allText.contains("able to dress") || allText.contains("ambulat") {
            i.takeCareOfSelf = true
            f.addAutoFilled(key: "takeCareOfSelf", label: "Independent ADLs suggested in clinical text — confirm with patient", source: "Clinical text")
        }

        // Walking ability from text
        if allText.contains("walks") || allText.contains("walking") ||
           allText.contains("mobile") || allText.contains("ambulat") ||
           allText.contains("independent gait") {
            i.walkIndoors = true
            i.walkOneOrTwoBlocks = true
            f.addAutoFilled(key: "walkIndoors", label: "Walking ability suggested — confirm with patient", source: "Clinical text")
            f.addAutoFilled(key: "walkOneOrTwoBlocks", label: "Community ambulation suggested — confirm with patient", source: "Clinical text")
        }

        // Stair climbing ability
        if allText.contains("stair") || allText.contains("climb") ||
           allText.contains("hill") || allText.contains("incline") {
            i.climbStairs = true
            f.addAutoFilled(key: "climbStairs", label: "Stair/hill climbing suggested — confirm with patient", source: "Clinical text")
        }

        // Exercise tolerance / running
        if allText.contains("jog") || allText.contains("run") || allText.contains("sprint") ||
           allText.contains("active") && allText.contains("exercise") {
            i.runShortDistance = true
            f.addAutoFilled(key: "runShortDistance", label: "Running / jogging suggested — confirm with patient", source: "Clinical text")
        }

        // Light housework
        if allText.contains("household") || allText.contains("housework") ||
           allText.contains("housekeep") || allText.contains("light domestic") {
            i.doLightWork = true
            f.addAutoFilled(key: "doLightWork", label: "Light housework ability suggested — confirm with patient", source: "Clinical text")
        }

        // Moderate housework / grocery
        if allText.contains("groceries") || allText.contains("vacuuming") ||
           allText.contains("sweeping") || allText.contains("moderate household") {
            i.doModerateWork = true
            f.addAutoFilled(key: "doModerateWork", label: "Moderate housework ability suggested — confirm with patient", source: "Clinical text")
        }

        // Strenuous sports / recreation
        if allText.contains("swim") || allText.contains("tennis") || allText.contains("football") ||
           allText.contains("basketball") || allText.contains("rugby") || allText.contains("cricket") ||
           allText.contains("marathon") || allText.contains("triathlon") {
            i.participateInStrenuous = true
            f.addAutoFilled(key: "participateInStrenuous", label: "Strenuous sport participation suggested — confirm with patient", source: "Clinical text")
        }

        // Moderate recreation
        if allText.contains("golf") || allText.contains("bowling") || allText.contains("dancing") ||
           allText.contains("recreational sport") || allText.contains("leisure") {
            i.participateInModerateRecreation = true
            f.addAutoFilled(key: "participateInModerateRecreation", label: "Moderate recreational activity suggested — confirm with patient", source: "Clinical text")
        }

        // Poor functional capacity markers — if present, set all fields to false and flag pending
        if allText.contains("bedbound") || allText.contains("bed-bound") ||
           allText.contains("wheelchair") || allText.contains("housebound") ||
           allText.contains("unable to walk") || allText.contains("non-ambulatory") ||
           allText.contains("poor functional") || allText.contains("limited mobility") ||
           allText.contains("less than 4 met") || allText.contains("<4 met") {
            // Override auto-fills — poor functional capacity; all confirmed as false
            i = DASIInput()
            f = ScoreAutoFill()
            f.addAutoFilled(key: "takeCareOfSelf", label: "Poor functional capacity suggested — all activities set to 'No'; verify with patient", source: "Clinical text")
        }

        // Most DASI fields require direct patient self-report — mark remaining unpopulated fields as pending
        if !f.autoFieldKeys.contains("takeCareOfSelf") && !i.takeCareOfSelf {
            f.addPending(key: "takeCareOfSelf", label: "Can patient take care of self (ADLs)? — requires patient self-report", source: "Patient interview")
        }
        if !f.autoFieldKeys.contains("walkIndoors") && !i.walkIndoors {
            f.addPending(key: "walkIndoors", label: "Can patient walk indoors on level ground? — requires patient self-report", source: "Patient interview")
        }
        if !f.autoFieldKeys.contains("walkOneOrTwoBlocks") && !i.walkOneOrTwoBlocks {
            f.addPending(key: "walkOneOrTwoBlocks", label: "Can patient walk 1–2 blocks? — requires patient self-report", source: "Patient interview")
        }
        if !f.autoFieldKeys.contains("climbStairs") && !i.climbStairs {
            f.addPending(key: "climbStairs", label: "Can patient climb a flight of stairs? — requires patient self-report", source: "Patient interview")
        }
        if !f.autoFieldKeys.contains("runShortDistance") && !i.runShortDistance {
            f.addPending(key: "runShortDistance", label: "Can patient run a short distance? — requires patient self-report", source: "Patient interview")
        }
        if !f.autoFieldKeys.contains("doHeavyWork") && !i.doHeavyWork {
            f.addPending(key: "doHeavyWork", label: "Can patient do heavy housework? — requires patient self-report", source: "Patient interview")
        }
        if !f.autoFieldKeys.contains("doYardWork") && !i.doYardWork {
            f.addPending(key: "doYardWork", label: "Can patient do yardwork? — requires patient self-report", source: "Patient interview")
        }
        return (i, f)
    }

    // MARK: - NIHSS (NIH Stroke Scale)

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
    static func fourT(patient: Patient) -> (ClinicalScoringEngine.FourTInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.FourTInput()
        var f = ScoreAutoFill()
        let text = [patient.chiefComplaint, patient.hpi, patient.pmhNotes,
                    patient.managementPlan, patient.assessmentText]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Thrombocytopenia: detect platelet-related keywords
        if text.contains("thrombocytopen") || text.contains("platelet") {
            // Can't quantify platelet fall without lab values — flag as pending
            f.addPending(key: "thrombocytopenia", label: "1. Degree of thrombocytopenia (platelet fall % and nadir)", source: "FBC result needed")
        } else {
            f.addPending(key: "thrombocytopenia", label: "1. Thrombocytopenia — check platelet count and fall from baseline", source: "Review FBC")
        }

        // Timing: detect recent heparin exposure
        if text.contains("heparin") || text.contains("lmwh") || text.contains("enoxaparin")
            || text.contains("tinzaparin") || text.contains("dalteparin") || text.contains("fondaparinux") {
            f.addAutoFilled(key: "timing", label: "Heparin exposure detected in clinical text", source: "HPI/medications")
        } else {
            f.addPending(key: "timing", label: "2. Timing of platelet fall relative to heparin start", source: "Verify heparin start date vs platelet trend")
        }

        // Thrombosis: detect new thromboembolic event keywords
        let thrombosisKeywords = ["deep vein thrombosis", "dvt", "pulmonary embolism",
                                   "thrombosis", "thromboembol", "skin necrosis", "limb ischaemia",
                                   "limb ischemia", "clot"]
        if thrombosisKeywords.contains(where: { text.contains($0) }) {
            i.thrombosis = 2
            f.addAutoFilled(key: "thrombosis", label: "Thrombotic event detected in clinical text (+2)", source: "HPI/assessment")
        }

        // Other cause: detect sepsis, DIC, or other causes of thrombocytopenia
        let otherCauseKeywords = ["sepsis", "septic", "dic ", "disseminated intravascular",
                                   "liver failure", "bone marrow", "chemotherapy", "itu", "icu"]
        if otherCauseKeywords.contains(where: { text.contains($0) }) {
            i.otherCause = 1   // Possible other cause
            f.addAutoFilled(key: "otherCause", label: "Possible other cause for thrombocytopaenia detected (1 pt)", source: "Clinical context")
        } else {
            f.addPending(key: "otherCause", label: "4. Other cause for thrombocytopenia — review clinical context", source: "Clinical assessment")
        }

        return (i, f)
    }

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
        if let vitals = patient.vitalsEntries?.sorted(by: { $0.recordedAt > $1.recordedAt }).first {
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
    static func rts(patient: Patient) -> (ClinicalScoringEngine.RTSInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.RTSInput()
        var f = ScoreAutoFill()

        // Pull GCS from stored score
        if let gcs = patient.gcsScore {
            i.glasgowComaScore = gcs
            f.addAutoFilled(key: "glasgowComaScore", label: "GCS \(gcs) from stored GCS score", source: "GCS score")
        } else {
            f.addPending(key: "glasgowComaScore", label: "Glasgow Coma Score — assess neurological status", source: "Neurological exam")
        }

        // Pull SBP and RR from latest vitals
        if let latest = patient.vitalsEntries?.sorted(by: { $0.recordedAt > $1.recordedAt }).first {
            if let sbp = latest.bpSystolic {
                i.systolicBP = sbp
                f.addAutoFilled(key: "systolicBP", label: "Systolic BP \(sbp) mmHg from latest vitals", source: "Vitals")
            } else {
                f.addPending(key: "systolicBP", label: "Systolic blood pressure — measure manually", source: "Vitals")
            }
            if let rr = latest.respiratoryRate {
                i.respiratoryRate = rr
                f.addAutoFilled(key: "respiratoryRate", label: "Respiratory rate \(rr) from latest vitals", source: "Vitals")
            } else {
                f.addPending(key: "respiratoryRate", label: "Respiratory rate — count for 1 minute", source: "Vitals")
            }
        } else {
            f.addPending(key: "systolicBP", label: "Systolic blood pressure — no vitals recorded", source: "Vitals")
            f.addPending(key: "respiratoryRate", label: "Respiratory rate — no vitals recorded", source: "Vitals")
        }
        return (i, f)
    }

    // MARK: - NUTRIC Score (#64)
    static func nutric(patient: Patient) -> (ClinicalScoringEngine.NUTRICInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.NUTRICInput()
        var f = ScoreAutoFill()
        // Auto-fill age
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: Date()).year ?? 50
            i.age = max(0, min(100, age))
            f.addAutoFilled(key: "age", label: "Age \(i.age) years from date of birth", source: "DOB")
        } else {
            f.addPending(key: "age", label: "Patient age required", source: "Demographics")
        }
        // Auto-fill APACHE II from stored score
        if let ap = patient.apacheIIScore {
            i.apacheII = ap
            f.addAutoFilled(key: "apacheII", label: "APACHE II \(ap) from stored score", source: "APACHE II score")
        } else {
            f.addPending(key: "apacheII", label: "APACHE II score required — calculate from ICU admission parameters", source: "APACHE II score")
        }
        // Auto-fill SOFA from stored score
        if let sf = patient.sofaScore {
            i.sofa = sf
            f.addAutoFilled(key: "sofa", label: "SOFA \(sf) from stored score", source: "SOFA score")
        } else {
            f.addPending(key: "sofa", label: "SOFA score required — calculate from organ function parameters", source: "SOFA score")
        }
        f.addPending(key: "comorbidities", label: "Number of comorbidities — review PMH", source: "Past medical history")
        f.addPending(key: "daysHospitalToICU", label: "Days from hospital admission to ICU — review admission notes", source: "Admission history")
        return (i, f)
    }

    // MARK: - Baux Score (#60)
    static func baux(patient: Patient) -> (ClinicalScoringEngine.BauxInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.BauxInput()
        var f = ScoreAutoFill()
        // Auto-fill age from DOB
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: Date()).year ?? 40
            i.age = max(0, min(120, age))
            f.addAutoFilled(key: "age", label: "Age \(i.age) years from date of birth", source: "DOB")
        } else {
            f.addPending(key: "age", label: "Patient age required for Baux score — enter DOB or age manually", source: "Demographics")
        }
        // Detect inhalation injury from text
        let text = [patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan]
            .compactMap { $0 }.joined(separator: " ").lowercased()
        let inhKw = ["inhalation injury", "smoke inhalation", "inhalation burn", "respiratory burn",
                     "airway burn", "carbonaceous sputum", "singed nasal", "hoarse voice", "stridor"]
        if inhKw.contains(where: { text.contains($0) }) {
            i.hasInhalationInjury = true
            f.addAutoFilled(key: "hasInhalationInjury", label: "Inhalation injury keyword detected", source: "History/Diagnosis")
        }
        f.addPending(key: "tbsa", label: "% TBSA burned — use Lund–Browder chart or Rule of Nines to estimate", source: "Burns assessment")
        return (i, f)
    }

    // MARK: - ISS (#61)
    static func iss(patient: Patient) -> (ClinicalScoringEngine.ISSInput, ScoreAutoFill) {
        let i = ClinicalScoringEngine.ISSInput()
        var f = ScoreAutoFill()
        f.addPending(key: "head", label: "Head/Neck AIS — review imaging and neurological assessment", source: "Trauma survey")
        f.addPending(key: "face", label: "Face AIS — review CT face / clinical examination", source: "Trauma survey")
        f.addPending(key: "chest", label: "Chest AIS — review CT thorax", source: "Imaging")
        f.addPending(key: "abdomen", label: "Abdomen/Pelvis AIS — review CT abdomen/pelvis", source: "Imaging")
        f.addPending(key: "extremity", label: "Extremity/Pelvis AIS — review X-rays and orthopaedic assessment", source: "Imaging")
        f.addPending(key: "external", label: "External AIS — burns/lacerations/contusions", source: "Clinical examination")
        return (i, f)
    }

    // MARK: - KDIGO AKI Staging (#59)
    static func kdigo(patient: Patient) -> (ClinicalScoringEngine.KDIGOInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.KDIGOInput()
        var f = ScoreAutoFill()
        let text = [patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan, patient.pmhNotes]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Check for RRT keywords
        let rrtKw = ["renal replacement therapy", "haemodialysis", "hemodialysis", "haemofiltration",
                     "hemofiltration", "crrt", "cvvh", "cvvhdf", "dialysis", "rrt", "prisma",
                     "continuous renal replacement"]
        if rrtKw.contains(where: { text.contains($0) }) {
            i.requiresRRT = true
            i.stage = 3
            f.addAutoFilled(key: "requiresRRT", label: "Renal replacement therapy keyword detected — Stage 3", source: "History/Management")
        } else {
            // Detect AKI context
            let akiKw = ["acute kidney injury", "aki", "acute renal failure", "arf",
                         "oliguria", "anuria", "rising creatinine", "renal impairment",
                         "nephrotoxic", "contrast nephropathy", "rhabdomyolysis",
                         "acute tubular necrosis", "atn", "prerenal"]
            if akiKw.contains(where: { text.contains($0) }) {
                f.addAutoFilled(key: "stage", label: "AKI keyword detected — confirm creatinine and urine output staging", source: "History/Diagnosis")
            }
            f.addPending(key: "creatinineRise", label: "Creatinine rise (×baseline) — review U&E trend", source: "Biochemistry")
            f.addPending(key: "urineOutput", label: "Urine output (mL/kg/h) — measure or review fluid balance chart", source: "Fluid balance")
        }
        return (i, f)
    }

    // MARK: - sPESI (#67)
    static func spesi(patient: Patient) -> (ClinicalScoringEngine.SPESIInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.SPESIInput()
        var f = ScoreAutoFill()
        let text = [patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan, patient.pmhNotes]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Age
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: .now).year ?? 0
            i.age = age
            if age > 80 {
                f.addAutoFilled(key: "ageAbove80", label: "Age > 80 years — sPESI point", source: "Demographics")
            }
        }

        // Cancer
        let cancerKw = ["cancer", "malignancy", "carcinoma", "tumour", "tumor", "oncology",
                        "chemotherapy", "radiotherapy", "palliative", "metastatic", "neoplasm"]
        if cancerKw.contains(where: { text.contains($0) }) {
            i.cancer = true
            f.addAutoFilled(key: "cancer", label: "Active cancer keyword detected", source: "PMH/Diagnosis")
        } else {
            f.addPending(key: "cancer", label: "Active cancer within 6 months or palliative — confirm", source: "PMH")
        }

        // Cardiopulmonary disease
        let cardioKw = ["heart failure", "cardiac failure", "ccf", "lv failure", "copd",
                        "chronic obstructive", "emphysema", "cor pulmonale", "pulmonary hypertension"]
        if cardioKw.contains(where: { text.contains($0) }) {
            i.cardiopulmonaryDisease = true
            f.addAutoFilled(key: "cardiopulmonaryDisease", label: "Chronic cardiopulmonary disease keyword detected", source: "PMH/Diagnosis")
        } else {
            f.addPending(key: "cardiopulmonaryDisease", label: "Chronic heart failure or COPD — confirm", source: "PMH")
        }

        // Vitals auto-fill
        if let v = patient.vitalsEntries?.sorted(by: { $0.recordedAt > $1.recordedAt }).first {
            if let hr = v.heartRate, hr >= 110 {
                i.heartRateAbove109 = true
                f.addAutoFilled(key: "heartRateAbove109", label: "HR \(hr) ≥ 110 bpm from latest vitals", source: "Vitals")
            }
            if let sbp = v.bpSystolic, sbp < 100 {
                i.sbpBelow100 = true
                f.addAutoFilled(key: "sbpBelow100", label: "SBP \(sbp) < 100 mmHg from latest vitals", source: "Vitals")
            }
            if let spo2 = v.spo2, spo2 < 90 {
                i.spo2Below90 = true
                f.addAutoFilled(key: "spo2Below90", label: "SpO₂ \(spo2)% < 90% from latest vitals", source: "Vitals")
            }
        } else {
            f.addPending(key: "heartRateAbove109", label: "HR ≥ 110 bpm — check vitals", source: "Vitals")
            f.addPending(key: "sbpBelow100", label: "SBP < 100 mmHg — check vitals", source: "Vitals")
            f.addPending(key: "spo2Below90", label: "SpO₂ < 90% — check latest SpO₂", source: "Vitals")
        }

        return (i, f)
    }

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
        if let v = patient.vitalsEntries?.sorted(by: { $0.recordedAt > $1.recordedAt }).first,
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
    static func perc(patient: Patient) -> (ClinicalScoringEngine.PERCInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.PERCInput()
        var f = ScoreAutoFill()
        let text = [patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan, patient.pmhNotes]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Age from DOB
        if let dob = patient.dateOfBirth {
            i.age = Calendar.current.dateComponents([.year], from: dob, to: .now).year ?? 40
        }

        // Vitals auto-fill
        if let v = patient.vitalsEntries?.sorted(by: { $0.recordedAt > $1.recordedAt }).first {
            if let hr = v.heartRate, hr >= 100 {
                i.hrAbove99 = true
                f.addAutoFilled(key: "hrAbove99", label: "HR \(hr) ≥ 100 bpm from latest vitals", source: "Vitals")
            }
            if let spo2 = v.spo2, spo2 < 95 {
                i.spo2Below95 = true
                f.addAutoFilled(key: "spo2Below95", label: "SpO₂ \(spo2)% < 95% from latest vitals", source: "Vitals")
            }
        } else {
            f.addPending(key: "hrAbove99", label: "HR ≥ 100 bpm — check vitals", source: "Vitals")
            f.addPending(key: "spo2Below95", label: "SpO₂ < 95% — check vitals", source: "Vitals")
        }

        // Leg swelling
        let legKw = ["leg swelling", "calf swelling", "leg oedema", "unilateral oedema",
                     "unilateral swelling", "left calf", "right calf", "dvt", "deep vein"]
        if legKw.contains(where: { text.contains($0) }) {
            i.legSwelling = true
            f.addAutoFilled(key: "legSwelling", label: "Leg swelling keyword detected", source: "History/Examination")
        } else {
            f.addPending(key: "legSwelling", label: "Unilateral leg swelling — confirm on examination", source: "Examination")
        }

        // Haemoptysis
        if text.contains("haemoptysis") || text.contains("hemoptysis") || text.contains("coughing blood") {
            i.haemoptysis = true
            f.addAutoFilled(key: "haemoptysis", label: "Haemoptysis keyword detected", source: "History")
        } else {
            f.addPending(key: "haemoptysis", label: "Haemoptysis — confirm from history", source: "History")
        }

        // Exogenous oestrogen
        let oeKw = ["oral contraceptive", "ocp", "combined pill", "hrt", "hormone replacement",
                    "oestrogen", "estrogen", "tamoxifen", "conjugated oestrogen"]
        if oeKw.contains(where: { text.contains($0) }) {
            i.exogenousEstrogen = true
            f.addAutoFilled(key: "exogenousEstrogen", label: "Exogenous oestrogen keyword detected", source: "Medications")
        } else {
            f.addPending(key: "exogenousEstrogen", label: "Exogenous oestrogen use (OCP, HRT) — check medications", source: "Medications")
        }

        // Prior DVT/PE
        let priorKw = ["prior dvt", "previous dvt", "prior pe", "previous pe", "prior pulmonary embolism",
                       "history of dvt", "history of pe", "recurrent pe", "recurrent dvt"]
        if priorKw.contains(where: { text.contains($0) }) {
            i.priorDVTorPE = true
            f.addAutoFilled(key: "priorDVTorPE", label: "Prior DVT/PE keyword detected", source: "PMH")
        } else {
            f.addPending(key: "priorDVTorPE", label: "Prior DVT or PE — confirm from PMH", source: "PMH")
        }

        // Recent surgery/trauma
        let sxKw = ["recent surgery", "recent operation", "post-operative", "postoperative",
                    "recent trauma", "hospitalised last 4 weeks", "hospitalised last month"]
        if sxKw.contains(where: { text.contains($0) }) {
            i.recentSurgeryOrTrauma = true
            f.addAutoFilled(key: "recentSurgeryOrTrauma", label: "Recent surgery/trauma keyword detected", source: "History")
        } else {
            f.addPending(key: "recentSurgeryOrTrauma", label: "Surgery or trauma requiring hospitalisation ≤ 4 weeks", source: "History")
        }

        return (i, f)
    }

    // MARK: - Shock Index (#72)
    static func shockIndex(patient: Patient) -> (ClinicalScoringEngine.ShockIndexInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.ShockIndexInput()
        var f = ScoreAutoFill()

        if let v = patient.vitalsEntries?.sorted(by: { $0.recordedAt > $1.recordedAt }).first {
            if let hr = v.heartRate {
                i.heartRate = hr
                f.addAutoFilled(key: "heartRate", label: "Heart rate \(hr) bpm from latest vitals", source: "Vitals")
            }
            if let sbp = v.bpSystolic {
                i.systolicBP = sbp
                f.addAutoFilled(key: "systolicBP", label: "Systolic BP \(sbp) mmHg from latest vitals", source: "Vitals")
            }
        } else {
            f.addPending(key: "heartRate", label: "Heart rate (bpm) — record from vitals", source: "Vitals")
            f.addPending(key: "systolicBP", label: "Systolic BP (mmHg) — record from vitals", source: "Vitals")
        }

        return (i, f)
    }

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
    static func parkland(patient: Patient) -> (ClinicalScoringEngine.ParklandInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.ParklandInput()
        var f = ScoreAutoFill()
        let text = [patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan, patient.pmhNotes]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Weight from latest vitals
        if let v = patient.vitalsEntries?.sorted(by: { $0.recordedAt > $1.recordedAt }).first,
           let wt = v.weightKg {
            i.weightKg = wt
            f.addAutoFilled(key: "weightKg", label: "Weight \(Int(wt)) kg from latest vitals", source: "Vitals")
        } else {
            f.addPending(key: "weightKg", label: "Body weight (kg) — required for Parkland calculation", source: "Vitals/Demographics")
        }

        // TBSA from free-text keywords
        let tbsaPattern = try? NSRegularExpression(pattern: #"(\d{1,3})\s*%\s*(?:tbsa|total body surface|burn)"#)
        if let m = tbsaPattern?.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
           let r = Range(m.range(at: 1), in: text), let pct = Double(text[r]) {
            i.tbsaPercent = min(pct, 100)
            f.addAutoFilled(key: "tbsaPercent", label: "\(Int(pct))% TBSA extracted from clinical text", source: "History/Examination")
        } else {
            f.addPending(key: "tbsaPercent", label: "Total body surface area burned (%) — assess from clinical examination", source: "Examination")
        }

        // Inhalation injury keywords
        let inhalKw = ["inhalation injury", "inhalation burn", "smoke inhalation",
                       "airway burn", "singed nasal hair", "carbonaceous sputum"]
        if inhalKw.contains(where: { text.contains($0) }) {
            i.hasInhalationInjury = true
            f.addAutoFilled(key: "hasInhalationInjury", label: "Inhalation injury keyword detected", source: "History")
        }

        return (i, f)
    }

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
        if let v = patient.vitalsEntries?.sorted(by: { $0.recordedAt > $1.recordedAt }).first,
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
    static func revisedGeneva(patient: Patient) -> (ClinicalScoringEngine.RevisedGenevaInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.RevisedGenevaInput()
        var f = ScoreAutoFill()
        let text = [patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan, patient.pmhNotes]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Age from DOB
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: .now).year ?? 0
            i.age = age
            if age > 65 {
                f.addAutoFilled(key: "age", label: "Age \(age) years from date of birth", source: "Demographics")
            }
        } else {
            f.addPending(key: "age", label: "Age — required for Revised Geneva (+1 pt if ≥ 65)", source: "Demographics")
        }

        // Prior DVT/PE
        let priorPEKw = ["prior pe", "previous pe", "prior dvt", "previous dvt", "prior pulmonary embolism",
                         "previous pulmonary embolism", "history of dvt", "history of pe"]
        if priorPEKw.contains(where: { text.contains($0) }) {
            i.priorDVTorPE = true
            f.addAutoFilled(key: "priorDVTorPE", label: "Prior DVT/PE keyword detected", source: "PMH")
        } else { f.addPending(key: "priorDVTorPE", label: "Prior DVT or PE — confirm from PMH", source: "PMH") }

        // Surgery / fracture within 1 month
        let sxKw = ["recent surgery", "post-operative", "recent fracture", "lower limb fracture",
                    "operated last month", "surgery last month", "hip fracture", "knee replacement"]
        if sxKw.contains(where: { text.contains($0) }) {
            i.surgeryOrFractureInMonth = true
            f.addAutoFilled(key: "surgeryOrFractureInMonth", label: "Recent surgery/fracture keyword detected", source: "History")
        } else { f.addPending(key: "surgeryOrFractureInMonth", label: "Surgery or lower-limb fracture within 1 month — confirm from history", source: "History") }

        // Active malignancy
        let malKw = ["malignancy", "cancer", "carcinoma", "oncology", "chemotherapy", "radiotherapy",
                     "active tumour", "active tumor", "metastatic"]
        if malKw.contains(where: { text.contains($0) }) {
            i.activeMalignancy = true
            f.addAutoFilled(key: "activeMalignancy", label: "Active malignancy keyword detected", source: "PMH")
        } else { f.addPending(key: "activeMalignancy", label: "Active malignancy — confirm from PMH/oncology", source: "PMH") }

        // Unilateral limb pain
        if ["unilateral leg pain", "unilateral limb pain", "calf pain", "leg pain"].contains(where: { text.contains($0) }) {
            i.unilateralLimbPain = true
            f.addAutoFilled(key: "unilateralLimbPain", label: "Unilateral limb pain keyword detected", source: "History")
        } else { f.addPending(key: "unilateralLimbPain", label: "Unilateral lower-limb pain — confirm from history", source: "History") }

        // Haemoptysis
        if ["haemoptysis", "hemoptysis", "coughing blood", "blood in sputum"].contains(where: { text.contains($0) }) {
            i.haemoptysis = true
            f.addAutoFilled(key: "haemoptysis", label: "Haemoptysis keyword detected", source: "History")
        } else { f.addPending(key: "haemoptysis", label: "Haemoptysis — confirm from history", source: "History") }

        // Heart rate from vitals
        if let v = patient.vitalsEntries?.sorted(by: { $0.recordedAt > $1.recordedAt }).first,
           let hr = v.heartRate {
            if hr >= 95 {
                i.heartRateAbove94 = true
                i.heartRateAbove74 = false
                f.addAutoFilled(key: "heartRateAbove94", label: "HR \(hr) bpm ≥ 95 from latest vitals", source: "Vitals")
            } else if hr >= 75 {
                i.heartRateAbove74 = true
                f.addAutoFilled(key: "heartRateAbove74", label: "HR \(hr) bpm 75–94 from latest vitals", source: "Vitals")
            }
        } else {
            f.addPending(key: "heartRateAbove74", label: "Heart rate (75–94 bpm) — check vitals", source: "Vitals")
            f.addPending(key: "heartRateAbove94", label: "Heart rate (≥ 95 bpm) — check vitals", source: "Vitals")
        }

        // Limb pain on palpation + oedema
        if ["deep vein thrombosis", "dvt", "limb oedema", "limb swelling", "calf swelling",
            "palpation limb", "limb tenderness"].contains(where: { text.contains($0) }) {
            i.painOnPalpationLimbAndEdema = true
            f.addAutoFilled(key: "painOnPalpationLimbAndEdema", label: "Limb pain/oedema keyword detected", source: "Examination")
        } else { f.addPending(key: "painOnPalpationLimbAndEdema", label: "Pain on deep palpation of lower limb + unilateral oedema — confirm on examination", source: "Examination") }

        return (i, f)
    }
}
