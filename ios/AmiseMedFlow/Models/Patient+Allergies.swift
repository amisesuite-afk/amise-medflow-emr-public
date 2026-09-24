// Patient+Allergies.swift
// Allergy status for notes, handovers, prescriptions and PDFs.
//
// An empty allergy list means "not recorded", never "no known drug allergies". NKDA is only
// reported when the chart explicitly records it: the "NKDA" entry added by the Allergies tab
// ("Mark NKDA") or by the pre-consultation "No known allergies" toggle.

import Foundation

extension Patient {

    /// Name of the explicit "no known drug allergies" entry stored in `allergies`.
    static let nkdaMarkerName = "NKDA"

    /// The explicit NKDA marker entry (reaction "None").
    static func nkdaMarkerEntry() -> AllergyEntry {
        AllergyEntry(name: nkdaMarkerName, severity: "Mild", reaction: "None")
    }

    /// True for the explicit "no known (drug) allergies" entry.
    static func isNKDAMarker(_ entry: AllergyEntry) -> Bool {
        let name = entry.name.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        return name == "NKDA" || name == "NKA"
    }

    /// Real recorded allergies: excludes the NKDA marker and blank names.
    var recordedAllergies: [AllergyEntry] {
        allergies.filter {
            !Patient.isNKDAMarker($0) && !$0.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
    }

    /// True when the chart holds the explicit NKDA entry (whatever else is recorded).
    var hasNKDAMarker: Bool { allergies.contains(where: Patient.isNKDAMarker) }

    /// True only when NKDA was explicitly recorded AND no allergy is recorded.
    var hasExplicitNKDA: Bool { hasNKDAMarker && recordedAllergies.isEmpty }

    /// True when NKDA was marked but an allergy was also recorded — the chart needs reconciling.
    var allergyRecordConflicts: Bool { hasNKDAMarker && !recordedAllergies.isEmpty }

    /// Text for when no allergy is recorded: "NKDA" if explicitly recorded, else "not recorded".
    var noAllergyStatusText: String { hasExplicitNKDA ? "NKDA" : "not recorded" }
}
