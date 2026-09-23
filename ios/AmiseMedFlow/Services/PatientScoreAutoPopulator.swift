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

extension Patient {
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

enum PatientScoreAutoPopulator {}
