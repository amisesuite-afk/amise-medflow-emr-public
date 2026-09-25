// ConsultationHeader.swift
// Patient identity for the consultation screens (UX review M1).
//
// - M1: the consultation never showed whose record was open (title "Consultation"), a
//   wrong-patient risk. The title is now the patient's name and a persistent header shows
//   name, age/sex and MRN on iPhone and iPad.
//
// Pure helpers (no SwiftUI) so they can be unit-tested: AmiseMedFlowTests/ConsultationHeaderTests.swift.

import Foundation

enum ConsultationHeader {

    // MARK: Identity (M1)

    /// Navigation title: the patient's name ("Unnamed patient" when blank — never "Consultation").
    static func title(fullName: String) -> String {
        let name = fullName.trimmingCharacters(in: .whitespacesAndNewlines)
        return name.isEmpty ? "Unnamed patient" : name
    }

    /// "46y · Female · MRN AM-2026-0001"; parts that are unknown are left out.
    static func subtitle(ageDisplay: String?, sex: Sex, mrn: String?) -> String {
        var parts: [String] = []
        if let age = ageDisplay, !age.isEmpty { parts.append(age) }
        if sex != .unspecified { parts.append(sex.rawValue) }
        if let mrn = mrn?.trimmingCharacters(in: .whitespacesAndNewlines), !mrn.isEmpty {
            parts.append("MRN \(mrn)")
        }
        return parts.joined(separator: " · ")
    }

    /// VoiceOver text for the identity header: "Consultation for Avery Sample, 46y · Female · MRN …".
    static func accessibilityText(title: String, subtitle: String) -> String {
        subtitle.isEmpty ? "Consultation for \(title)" : "Consultation for \(title), \(subtitle)"
    }
}

extension Patient {
    /// Consultation navigation title (the patient's name).
    var consultationTitle: String { ConsultationHeader.title(fullName: fullName) }

    /// Consultation header subtitle: age, sex and MRN.
    var consultationSubtitle: String {
        ConsultationHeader.subtitle(ageDisplay: ageDisplay, sex: sex, mrn: mrn)
    }
}
