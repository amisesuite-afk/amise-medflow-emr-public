// PatientScoreAutoPopulator+Cardiovascular.swift
// Cardiovascular / VTE auto-populate functions
// No AI, no network — HIPAA-safe. Surgeon retains full authority.

import Foundation

extension PatientScoreAutoPopulator {

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
        if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first {
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
        if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first {
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
    // MARK: - Shock Index (#72)
    static func shockIndex(patient: Patient) -> (ClinicalScoringEngine.ShockIndexInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.ShockIndexInput()
        var f = ScoreAutoFill()

        if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first {
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
    // MARK: - Parkland Formula (#73)
    static func parkland(patient: Patient) -> (ClinicalScoringEngine.ParklandInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.ParklandInput()
        var f = ScoreAutoFill()
        let text = [patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan, patient.pmhNotes]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Weight from latest vitals
        if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first,
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
        if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first,
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

    // MARK: - Charlson Comorbidity Index (#76)
    static func caprini(patient: Patient) -> (CapriniInput, ScoreAutoFill) {
        var i = CapriniInput()
        var f = ScoreAutoFill()
        let cal = Calendar.current
        let age = patient.dateOfBirth.flatMap { cal.dateComponents([.year], from: $0, to: .now).year } ?? 40

        // Age bracket
        if age >= 75 {
            i.ageOver75 = true
            f.addAutoFilled(key: "age", label: "Age \(age) years — Caprini 3-point age bracket", source: "Demographics")
        } else if age >= 60 {
            i.age60to74 = true
            f.addAutoFilled(key: "age", label: "Age \(age) years — Caprini 2-point age bracket", source: "Demographics")
        } else if age >= 41 {
            i.age41to59 = true
            f.addAutoFilled(key: "age", label: "Age \(age) years — Caprini 1-point age bracket", source: "Demographics")
        }

        let text = [patient.chiefComplaint, patient.hpi, patient.assessmentText, patient.pmhNotes,
                    patient.workingDiagnosis, patient.prescriptions.map { $0.drug }.joined(separator: " ")]
            .compactMap { $0 }.joined(separator: " ").lowercased()

        // Malignancy
        if text.contains("carcinoma") || text.contains("cancer") || text.contains("malignancy") || text.contains("tumour") {
            i.activeOrPriorMalignancy = true
            f.addAutoFilled(key: "malignancy", label: "Active malignancy detected from diagnosis/notes", source: "Diagnosis")
        }

        // VTE history
        if text.contains("dvt") || text.contains("deep vein thrombosis") || text.contains("pulmonary embolism") || text.contains("pe ") {
            i.priorVTE = true
            f.addAutoFilled(key: "personalVTE", label: "Personal history of VTE detected in notes", source: "History/PMH")
        }

        // Inpatient bed rest
        if patient.setting == .inpatient {
            i.immobilityBedridden = true
            f.addAutoFilled(key: "bedrest", label: "Inpatient setting — bedridden/at-risk status", source: "Setting")
        }

        // Hormone therapy from prescriptions
        let rxText = patient.prescriptions.map { $0.drug.lowercased() }.joined(separator: " ")
        if rxText.contains("estrogen") || rxText.contains("oestrogen") || rxText.contains("progesteron") ||
           rxText.contains("oral contraceptive") || rxText.contains("hrt") {
            i.hormonalTherapy = true
            f.addAutoFilled(key: "hrt", label: "OCP/HRT detected in prescription list", source: "Prescriptions")
        }

        // Sepsis
        if text.contains("sepsis") || text.contains("septic") {
            i.sepsis30d = true
            f.addAutoFilled(key: "sepsis", label: "Sepsis documented in clinical notes", source: "History/Notes")
        }

        f.addPending(key: "surgery",      label: "Planned surgery type and duration — operative details required", source: "Operative")
        f.addPending(key: "familyVTE",    label: "Family history of DVT/PE?", source: "Family History")
        f.addPending(key: "thrombophilia", label: "Known thrombophilia? (Factor V Leiden, prothrombin mutation, etc.)", source: "Labs/Genetics")
        return (i, f)
    }

    // MARK: - #108 Child-Pugh Score


}
