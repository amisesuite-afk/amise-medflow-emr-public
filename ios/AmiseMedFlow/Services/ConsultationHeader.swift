// ConsultationHeader.swift
// Patient identity and allergy status for the consultation screens (UX review M1–M2).
//
// - M1: the consultation never showed whose record was open (title "Consultation"), a
//   wrong-patient risk. The title is now the patient's name and a persistent header shows
//   name, age/sex and MRN on iPhone and iPad.
// - M2: a recorded "NKDA" raised the red "ALLERGY ALERT" banner. Red is for real allergies only;
//   NKDA is a neutral "No known drug allergies" line; an empty list is "Allergies not recorded".
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

    // MARK: Allergy banner (M2)

    enum AllergyBanner: Equatable {
        /// Real allergies recorded: the red "ALLERGY ALERT" banner lists these (never the NKDA marker).
        case alert([String])
        /// Only the explicit NKDA marker: a neutral "No known drug allergies" line.
        case noKnownAllergies
        /// Nothing recorded: an amber "Allergies not recorded" line.
        case notRecorded
    }

    /// Which allergy line to show. `recorded` = real allergies (Patient.recordedAllergies names).
    static func allergyBanner(recorded: [String], hasNKDAMarker: Bool) -> AllergyBanner {
        if !recorded.isEmpty { return .alert(recorded) }
        return hasNKDAMarker ? .noKnownAllergies : .notRecorded
    }

    static let noKnownAllergiesText = "No known drug allergies"
    static let allergiesNotRecordedText = "Allergies not recorded"
}

extension Patient {
    /// Consultation navigation title (the patient's name).
    var consultationTitle: String { ConsultationHeader.title(fullName: fullName) }

    /// Consultation header subtitle: age, sex and MRN.
    var consultationSubtitle: String {
        ConsultationHeader.subtitle(ageDisplay: ageDisplay, sex: sex, mrn: mrn)
    }

    /// Allergy line for the consultation: red alert only for real allergies.
    var consultationAllergyBanner: ConsultationHeader.AllergyBanner {
        ConsultationHeader.allergyBanner(recorded: recordedAllergies.map(\.name), hasNKDAMarker: hasNKDAMarker)
    }
}
