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
        let ageYears = Calendar.current.dateComponents([.year], from: patient.dateOfBirth, to: .now).year ?? 0
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
        let ageYears = Calendar.current.dateComponents([.year], from: patient.dateOfBirth, to: .now).year ?? 0
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
        let ageYears = calendar.dateComponents([.year], from: patient.dateOfBirth, to: .now).year ?? 0
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
            case .alert:    i.cns = 0; f.autoFieldKeys.insert("cnsGCS")
            case .voice:    i.cns = 1; f.autoFieldKeys.insert("cnsGCS")
            case .pain:     i.cns = 3; f.autoFieldKeys.insert("cnsGCS")
            case .unresponsive: i.cns = 4; f.autoFieldKeys.insert("cnsGCS")
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
}
