// PatientScoreAutoPopulator+CriticalCare.swift
// Sepsis / ICU / Critical Care auto-populate functions
// No AI, no network — HIPAA-safe. Surgeon retains full authority.

import Foundation

extension PatientScoreAutoPopulator {

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

    static func sofa(patient: Patient) -> (SOFAInput, ScoreAutoFill) {
        var i = SOFAInput()
        var f = ScoreAutoFill()

        let vitals = patient.latestVitals

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
        if let v = patient.latestVitals {
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

}
