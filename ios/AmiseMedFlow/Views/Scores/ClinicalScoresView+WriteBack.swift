// ClinicalScoresView+WriteBack.swift
// MEWS write-back and score result write-back to patient record.

import SwiftUI
import SwiftData

extension ClinicalScoresView {

    // MARK: - MEWS write-back

    func saveNEWS2ToVitals() {
        let entry = VitalsEntry(patient: patient)
        entry.respiratoryRate    = news2I.respiratoryRate
        entry.spo2               = news2I.spo2
        entry.bpSystolic         = news2I.systolicBP
        entry.heartRate          = news2I.heartRate
        entry.temperatureCelsius = news2I.temperatureCelsius
        entry.avpu               = news2I.avpu
        modelContext.insert(entry)
        news2Saved = true
    }

    func saveMEWSToVitals() {
        let entry = VitalsEntry(patient: patient)
        entry.respiratoryRate    = mewsI.respiratoryRate
        entry.spo2               = mewsI.oxygenSaturation
        entry.heartRate          = mewsI.heartRate
        entry.bpSystolic         = mewsI.systolicBP
        entry.temperatureCelsius = mewsI.temperature
        entry.avpu = switch mewsI.consciousnessAVPU {
        case .alert:        .alert
        case .voice:        .voice
        case .pain:         .pain
        case .unresponsive: .unresponsive
        }
        modelContext.insert(entry)
        mewsSaved = true
    }

    // MARK: - Score write-back

    func saveScoreToAssessment(_ r: ClinicalScore) {
        guard r.score.isFinite else { return }
        let fmt = DateFormatter()
        fmt.dateStyle = .medium
        fmt.timeStyle = .short
        let scoreStr     = r.score == Double(Int(r.score)) ? "\(Int(r.score))" : String(format: "%.1f", r.score)
        let maxStr       = r.maxScore.isFinite && r.maxScore == Double(Int(r.maxScore)) ? "\(Int(r.maxScore))" : String(format: "%.1f", r.maxScore)
        let scoreDisplay = r.maxScore > 0 ? "\(scoreStr)/\(maxStr)" : scoreStr
        var line = "[\(fmt.string(from: .now))] \(r.systemName): \(scoreDisplay) — \(r.risk.rawValue) Risk. \(r.interpretation)"

        // Layer 5: annotate when score strongly corroborates working diagnosis
        if let dx = patient.workingDiagnosis, !dx.isEmpty {
            let dxLower = dx.lowercased()
            let isCorroborating: Bool = bayesianCorroboration(score: r, workingDx: dxLower)
            if isCorroborating {
                line += " [Corroborates working diagnosis: \(dx)]"
            }
        }

        if let existing = patient.assessmentText, !existing.isEmpty {
            patient.assessmentText = existing + "\n" + line
        } else {
            patient.assessmentText = line
        }

        // Persist to score history (Layer 7)
        let entry = ScoreHistoryEntry(
            scoreName: r.systemName,
            abbreviation: r.abbreviation,
            scoreValue: r.score,
            maxScore: r.maxScore,
            riskRaw: r.risk.rawValue
        )
        entry.patient = patient
        modelContext.insert(entry)
        // Persist computed score to patient Bayesian fields so the engine picks it up
        if let score = selectedScore, let r = result {
            persistScoreToPatient(score, r)
        }
        patient.updatedAt   = .now
        patient.pendingSync = true
        scoreSaved = true
    }

    /// Layer 5 — returns true when a score result strongly supports the current working diagnosis.
    func bayesianCorroboration(score: ClinicalScore, workingDx: String) -> Bool {
        let name = score.systemName.lowercased()
        guard score.risk == .high || score.risk == .critical else { return false }
        if name.contains("alvarado")   && workingDx.contains("appendicit")       { return true }
        if name.contains("air")        && workingDx.contains("appendicit")       { return true }
        if name.contains("ripasa")     && workingDx.contains("appendicit")       { return true }
        if name.contains("tokyo")      && (workingDx.contains("cholecystitis") ||
                                           workingDx.contains("cholangitis"))    { return true }
        if name.contains("ranson")     && workingDx.contains("pancreatitis")     { return true }
        if name.contains("bisap")      && workingDx.contains("pancreatitis")     { return true }
        if name.contains("blatchford") && workingDx.contains("bleed")            { return true }
        if name.contains("rockall")    && workingDx.contains("bleed")            { return true }
        if name.contains("wells")      && (workingDx.contains("dvt") ||
                                           workingDx.contains("pulmonary embolism")) { return true }
        if name.contains("qsofa")      && workingDx.contains("sepsis")           { return true }
        if name.contains("lrinec")     && workingDx.contains("fasciitis")        { return true }
        if name.contains("fgsi")       && workingDx.contains("fournier")         { return true }
        if name.contains("abcd")       && (workingDx.contains("tia") ||
                                           workingDx.contains("stroke"))         { return true }
        if name.contains("cha2ds2")    && workingDx.contains("atrial")           { return true }
        if name.contains("heart")      && (workingDx.contains("acute coronary") ||
                                           workingDx.contains("acs") ||
                                           workingDx.contains("angina"))         { return true }
        if name.contains("timi")       && (workingDx.contains("nstemi") ||
                                           workingDx.contains("unstable angina") ||
                                           workingDx.contains("acs"))            { return true }
        if name.contains("grace")      && (workingDx.contains("myocardial") ||
                                           workingDx.contains("acs") ||
                                           workingDx.contains("nstemi"))         { return true }
        if name.contains("euroscore")  && (workingDx.contains("cardiac surgery") ||
                                           workingDx.contains("valve") ||
                                           workingDx.contains("cabg"))           { return true }
        if name.contains("duke")       && workingDx.contains("endocarditis")     { return true }
        return false
    }


}
