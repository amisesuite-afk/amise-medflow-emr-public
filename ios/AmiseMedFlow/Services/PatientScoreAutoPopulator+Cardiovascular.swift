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

        mergeRecord(&i, &f, patient: patient)   // record fill (WhatsMissingCore+Fill)
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

}
