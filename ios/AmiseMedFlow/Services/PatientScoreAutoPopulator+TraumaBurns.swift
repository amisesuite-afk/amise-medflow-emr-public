// PatientScoreAutoPopulator+TraumaBurns.swift
// Trauma / Burns auto-populate functions
// No AI, no network — HIPAA-safe. Surgeon retains full authority.

import Foundation

extension PatientScoreAutoPopulator {

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
        if let latest = patient.latestVitals {
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
    static func pts(patient: Patient) -> (ClinicalScoringEngine.PTSInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.PTSInput(weight: 0, airway: 0, systolicBP: 0, cns: 0, openWound: 0, fracture: 0)
        var f = ScoreAutoFill()

        // Weight from patient record
        let latestV = patient.latestVitals
        if let kg = latestV?.weightKg {
            i.weight = kg > 20 ? 0 : (kg >= 10 ? 1 : 2)
            f.addAutoFilled(key: "weight", label: String(format: "Weight %.1f kg from vitals", kg), source: "Vitals")
        } else {
            f.addPending(key: "weight", label: "Child's weight (>20 kg / 10–20 kg / <10 kg)", source: "Vitals/Exam")
        }

        // Systolic BP from vitals
        if let sbp = latestV?.bpSystolic {
            i.systolicBP = sbp > 90 ? 0 : (sbp >= 50 ? 1 : 2)
            f.addAutoFilled(key: "sbp", label: "Systolic BP \(sbp) mmHg from vitals", source: "Vitals")
        } else {
            f.addPending(key: "sbp", label: "Systolic BP (>90 / 50–90 / <50 mmHg)", source: "Vitals")
        }

        // CNS — from AVPU if available
        if let avpu = latestV?.avpu {
            switch avpu {
            case .alert:    i.cns = 0; f.addAutoFilled(key: "cns", label: "AVPU Alert — CNS awake", source: "Vitals")
            case .confused, .voice: i.cns = 1; f.addAutoFilled(key: "cns", label: "AVPU Confused/Voice — CNS obtunded", source: "Vitals")
            case .pain:     i.cns = 1; f.addAutoFilled(key: "cns", label: "AVPU Pain — CNS obtunded", source: "Vitals")
            case .unresponsive: i.cns = 2; f.addAutoFilled(key: "cns", label: "AVPU Unresponsive — CNS comatose", source: "Vitals")
            }
        } else {
            f.addPending(key: "cns", label: "CNS status (Awake / Obtunded / Comatose)", source: "Examination")
        }

        f.addPending(key: "airway", label: "Airway (Normal / Maintainable / Unmaintainable)", source: "Examination")
        f.addPending(key: "wound", label: "Open wound (None / Minor / Major penetrating)", source: "Examination")
        f.addPending(key: "fracture", label: "Fracture (None / Closed / Open or multiple)", source: "Imaging/Exam")
        return (i, f)
    }

    // MARK: - #106 P-POSSUM


}
