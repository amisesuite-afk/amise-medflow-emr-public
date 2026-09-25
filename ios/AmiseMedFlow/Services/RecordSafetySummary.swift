// RecordSafetySummary.swift
// Text for the record header safety strip (UX review M3): NEWS2 with its age, the allergy summary
// (every recorded allergy, not only severe ones) and the antithrombotic the patient is on.
//
// Before: the iPad header showed an 11-pt shield icon for *severe* allergies only and an
// unlabelled drop icon for anticoagulants; a non-severe allergy was invisible in the header.
//
// Pure helpers (no SwiftUI) so they can be unit-tested: AmiseMedFlowTests/ConsultationSeamlessTests.swift.

import Foundation

enum RecordSafetySummary {

    // MARK: Allergies

    enum AllergyState: Equatable {
        /// Real allergies recorded (the NKDA marker is never listed).
        case allergies([String])
        /// Only the explicit NKDA marker.
        case noKnownAllergies
        /// Nothing recorded yet ("not asked" is never shown as NKDA).
        case notRecorded
    }

    /// `recorded` = real allergies (name, severity), NKDA marker already excluded.
    static func allergyState(recorded: [(name: String, severity: String)],
                             hasNKDAMarker: Bool) -> AllergyState {
        let items: [String] = recorded.compactMap { entry in
            let name = entry.name.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !name.isEmpty else { return nil }
            let severity = entry.severity.trimmingCharacters(in: .whitespacesAndNewlines)
            return severity.isEmpty ? name : "\(name) (\(severity))"
        }
        if !items.isEmpty { return .allergies(items) }
        return hasNKDAMarker ? .noKnownAllergies : .notRecorded
    }

    /// "Allergies: Penicillin (Severe), Latex (Mild)" · "NKDA (recorded)" · "Allergies not recorded".
    static func allergyText(_ state: AllergyState) -> String {
        switch state {
        case .allergies(let items):
            return (items.count == 1 ? "Allergy: " : "Allergies: ") + items.joined(separator: ", ")
        case .noKnownAllergies:
            return "NKDA (recorded)"
        case .notRecorded:
            return ConsultationHeader.allergiesNotRecordedText
        }
    }

    // MARK: Antithrombotics

    /// "Antithrombotic: Warfarin, Aspirin" (names as prescribed, duplicates removed, in order),
    /// nil when the patient is on none. Anticoagulants and antiplatelets both count
    /// (Patient.activeAnticoagulants), so the label says "antithrombotic", not "anticoagulant".
    static func antithromboticText(drugs: [String]) -> String? {
        var seen = Set<String>()
        var names: [String] = []
        for drug in drugs {
            let name = drug.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !name.isEmpty, seen.insert(name.lowercased()).inserted else { continue }
            names.append(name)
        }
        guard !names.isEmpty else { return nil }
        return "Antithrombotic: " + names.joined(separator: ", ")
    }

    // MARK: NEWS2 age

    /// How long ago the vitals behind the NEWS2 were taken: "just now", "25 min ago", "3 h ago",
    /// "2 d ago". A NEWS2 from yesterday must not read as current.
    static func vitalsAge(recordedAt: Date, now: Date = .now) -> String {
        let seconds = max(0, now.timeIntervalSince(recordedAt))
        let minutes = Int(seconds / 60)
        if minutes < 1 { return "just now" }
        if minutes < 60 { return "\(minutes) min ago" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours) h ago" }
        return "\(hours / 24) d ago"
    }
}

extension Patient {
    /// Allergy state for the header safety strip (every real allergy, with severity).
    var safetyAllergyState: RecordSafetySummary.AllergyState {
        RecordSafetySummary.allergyState(recorded: recordedAllergies.map { ($0.name, $0.severity) },
                                         hasNKDAMarker: hasNKDAMarker)
    }

    /// Antithrombotic line for the header safety strip, nil when none is prescribed.
    var safetyAntithromboticText: String? {
        RecordSafetySummary.antithromboticText(drugs: activeAnticoagulants.map(\.drug))
    }
}
